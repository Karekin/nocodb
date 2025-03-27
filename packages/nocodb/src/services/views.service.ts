import { Injectable } from '@nestjs/common';
import { AppEvents, ProjectRoles, ViewTypes } from 'nocodb-sdk';
import type {
  SharedViewReqType,
  UserType,
  ViewUpdateReqType,
} from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { validatePayload } from '~/helpers';
import { NcError } from '~/helpers/catchError';
import {
  BaseUser,
  CustomUrl,
  Model,
  ModelRoleVisibility,
  User,
  View,
} from '~/models';

// 获取视图可见性元数据的辅助函数
// todo: move
async function xcVisibilityMetaGet(
  context: NcContext,
  param: {
    baseId: string; // 基础ID
    includeM2M?: boolean; // 是否包含多对多关系
    models?: Model[]; // 模型列表
  },
) {
  const { includeM2M = true, baseId, models: _models } = param ?? {};

  // 定义角色列表
  // todo: move to
  const roles = ['owner', 'creator', 'viewer', 'editor', 'commenter', 'guest'];

  // 创建默认的禁用状态对象，所有角色默认为false（不禁用）
  const defaultDisabled = roles.reduce((o, r) => ({ ...o, [r]: false }), {});

  // 获取模型列表，如果未提供则从数据库加载
  let models =
    _models ||
    (await Model.list(context, {
      base_id: baseId,
      source_id: undefined,
    }));

  // 根据includeM2M参数过滤模型
  models = includeM2M ? models : (models.filter((t) => !t.mm) as Model[]);

  // 为每个模型的每个视图构建结果对象
  const result = await models.reduce(async (_obj, model) => {
    const obj = await _obj;

    // 获取当前模型的所有视图
    const views = await model.getViews(context);
    for (const view of views) {
      // 为每个视图创建一个条目，包含模型和视图信息
      obj[view.id] = {
        ptn: model.table_name, // 物理表名
        _ptn: model.title, // 模型标题
        ptype: model.type, // 模型类型
        tn: view.title, // 视图标题
        _tn: view.title, // 视图标题（重复）
        table_meta: model.meta, // 表元数据
        ...view, // 视图的所有属性
        disabled: { ...defaultDisabled }, // 默认禁用状态
      };
    }

    return obj;
  }, Promise.resolve({}));

  // 获取角色可见性禁用列表
  const disabledList = await ModelRoleVisibility.list(context, baseId);

  // 更新结果对象中的禁用状态
  for (const d of disabledList) {
    if (result[d.fk_view_id])
      result[d.fk_view_id].disabled[d.role] = !!d.disabled;
  }

  // 返回结果对象的值数组
  return Object.values(result);
}

// 视图服务类
@Injectable()
export class ViewsService {
  constructor(private appHooksService: AppHooksService) {}

  /**
   * 获取视图列表
   * @param context - NocoDB上下文
   * @param param - 包含tableId和用户信息的参数对象
   * @returns 过滤后的视图列表
   */
  async viewList(
    context: NcContext,
    param: {
      tableId: string;
      user: {
        roles?: Record<string, boolean> | string;
        base_roles?: Record<string, boolean>;
        id: string;
      };
    },
  ) {
    // 获取模型信息
    const model = await Model.get(context, param.tableId);

    // 如果模型不存在，抛出错误
    if (!model) {
      NcError.tableNotFound(param.tableId);
    }

    // 获取视图可见性元数据
    const viewList = await xcVisibilityMetaGet(context, {
      baseId: model.base_id,
      models: [model],
    });

    // 根据用户角色过滤视图列表
    // todo: user roles
    //await View.list(param.tableId)
    const filteredViewList = viewList.filter((view: any) => {
      // 个人视图的访问控制逻辑（已注释）
      // if (
      //   view.lock_type === ViewLockType.Personal &&
      //   view.owned_by !== param.user.id &&
      //   !(!view.owned_by && !param.user.base_roles?.[ProjectRoles.OWNER])
      // ) {
      //   return false;
      // }

      // 检查用户是否有权限访问该视图
      return Object.values(ProjectRoles).some(
        (role) => param?.user?.['base_roles']?.[role] && !view.disabled[role],
      );
    });

    return filteredViewList;
  }

  /**
   * 共享视图
   * @param context - NocoDB上下文
   * @param param - 包含viewId、用户信息和请求对象的参数
   * @returns 共享结果
   */
  async shareView(
    context: NcContext,
    param: { viewId: string; user: UserType; req: NcRequest },
  ) {
    // 共享视图
    const res = await View.share(context, param.viewId);

    // 获取视图信息
    const view = await View.get(context, param.viewId);

    // 如果视图不存在，抛出错误
    if (!view) {
      NcError.viewNotFound(param.viewId);
    }

    // 触发共享视图创建事件
    this.appHooksService.emit(AppEvents.SHARED_VIEW_CREATE, {
      user: param.user,
      view,
      req: param.req,
      context,
    });

    return res;
  }

  /**
   * 更新视图
   * @param context - NocoDB上下文
   * @param param - 包含viewId、视图更新数据、用户信息和请求对象的参数
   * @returns 更新结果
   */
  async viewUpdate(
    context: NcContext,
    param: {
      viewId: string;
      view: ViewUpdateReqType;
      user: UserType;
      req: NcRequest;
    },
  ) {
    // 验证请求负载
    validatePayload(
      'swagger.json#/components/schemas/ViewUpdateReq',
      param.view,
    );
    // 获取旧视图信息
    const oldView = await View.get(context, param.viewId);

    // 如果视图不存在，抛出错误
    if (!oldView) {
      NcError.viewNotFound(param.viewId);
    }

    // 初始化所有者、创建者和更新标志
    let ownedBy = oldView.owned_by;
    let createdBy = oldView.created_by;
    let includeCreatedByAndUpdateBy = false;

    // 处理锁定类型变更为"个人"的情况
    // 检查锁定类型是否更改为"个人"，并且只允许所有者进行此更改
    // 如果owned_by与用户不同，则抛出错误
    // 如果owned_by为空，则只允许项目所有者进行更改
    if (
      param.view.lock_type === 'personal' &&
      param.view.lock_type !== oldView.lock_type
    ) {
      // 如果owned_by不为空，则检查用户是否是项目所有者
      if (ownedBy && ownedBy !== param.user.id) {
        NcError.unauthorized('Only owner/creator can change to personal view');
      }

      // 如果为空，则检查当前用户是否是项目所有者，然后允许并更新owned_by
      if (!ownedBy && (param.user as any).base_roles?.[ProjectRoles.OWNER]) {
        includeCreatedByAndUpdateBy = true;
        ownedBy = param.user.id;
        if (!createdBy) {
          createdBy = param.user.id;
        }
      } else if (!ownedBy) {
        // 移动到catchError
        NcError.unauthorized('Only owner can change to personal view');
      }
    }

    // 处理视图所有权转移
    if (ownedBy && param.view.owned_by && ownedBy !== param.view.owned_by) {
      // 提取用户角色，并允许创建者和所有者更改为个人视图
      if (
        param.user.id !== ownedBy &&
        !(param.user as any).base_roles?.[ProjectRoles.OWNER] &&
        !(param.user as any).base_roles?.[ProjectRoles.CREATOR]
      ) {
        NcError.unauthorized('Only owner/creator can transfer view ownership');
      }

      ownedBy = param.view.owned_by;

      // 验证新的owned_by是否是有权访问基础/工作区的有效用户
      // 如果不是，则抛出错误
      const baseUser = await BaseUser.get(
        context,
        context.base_id,
        param.view.owned_by,
      );

      if (!baseUser) {
        NcError.badRequest('Invalid user');
      }

      includeCreatedByAndUpdateBy = true;
    }

    // 执行视图更新
    const result = await View.update(
      context,
      param.viewId,
      {
        ...param.view,
        owned_by: ownedBy,
        created_by: createdBy,
      },
      includeCreatedByAndUpdateBy,
    );

    // 确定所有者
    let owner = param.req.user;

    if (ownedBy && ownedBy !== param.req.user?.id) {
      owner = await User.get(ownedBy);
    }

    // 触发视图更新事件
    this.appHooksService.emit(AppEvents.VIEW_UPDATE, {
      view: {
        ...oldView,
        ...param.view,
      },
      oldView,
      user: param.user,
      req: param.req,
      context,
      owner,
    });
    return result;
  }

  /**
   * 删除视图
   * @param context - NocoDB上下文
   * @param param - 包含viewId、用户信息和请求对象的参数
   * @returns 删除结果
   */
  async viewDelete(
    context: NcContext,
    param: { viewId: string; user: UserType; req: NcRequest },
  ) {
    // 获取视图信息
    const view = await View.get(context, param.viewId);

    // 如果视图不存在，抛出错误
    if (!view) {
      NcError.viewNotFound(param.viewId);
    }

    // 执行视图删除
    await View.delete(context, param.viewId);

    // 根据视图类型确定删除事件
    let deleteEvent = AppEvents.GRID_DELETE;

    // 根据视图类型决定事件
    if (view.type === ViewTypes.FORM) {
      deleteEvent = AppEvents.FORM_DELETE;
    } else if (view.type === ViewTypes.CALENDAR) {
      deleteEvent = AppEvents.CALENDAR_DELETE;
    } else if (view.type === ViewTypes.GALLERY) {
      deleteEvent = AppEvents.GALLERY_DELETE;
    } else if (view.type === ViewTypes.KANBAN) {
      deleteEvent = AppEvents.KANBAN_DELETE;
    } else if (view.type === ViewTypes.MAP) {
      deleteEvent = AppEvents.MAP_DELETE;
    }

    // 确定所有者
    let owner = param.req.user;

    if (view.owned_by && view.owned_by !== param.req.user?.id) {
      owner = await User.get(view.owned_by);
    }

    // 触发删除事件
    this.appHooksService.emit(deleteEvent, {
      view,
      user: param.user,
      owner,
      req: param.req,
      context,
    });

    return true;
  }

  /**
   * 更新共享视图
   * @param context - NocoDB上下文
   * @param param - 包含viewId、共享视图数据、用户信息和请求对象的参数
   * @returns 更新结果
   */
  async shareViewUpdate(
    context: NcContext,
    param: {
      viewId: string;
      sharedView: SharedViewReqType & {
        custom_url_path?: string;
      };
      user: UserType;
      req: NcRequest;
    },
  ) {
    // 验证请求负载
    validatePayload(
      'swagger.json#/components/schemas/SharedViewReq',
      param.sharedView,
    );

    // 获取视图信息
    const view = await View.get(context, param.viewId);

    // 如果视图不存在，抛出错误
    if (!view) {
      NcError.viewNotFound(param.viewId);
    }

    // 获取自定义URL信息
    let customUrl: CustomUrl | undefined = await CustomUrl.get({
      view_id: view.id,
      id: view.fk_custom_url_id,
    });

    // 如果自定义URL存在，则更新
    if (customUrl?.id) {
      const original_path = await View.getSharedViewPath(context, view.id);

      if (param.sharedView.custom_url_path) {
        // 有条件地准备更新字段
        const updates: Partial<CustomUrl> = {
          original_path,
        };

        if (param.sharedView.custom_url_path !== undefined) {
          updates.custom_path = param.sharedView.custom_url_path;
        }

        // 如果有更改，则执行更新
        if (Object.keys(updates).length > 0) {
          await CustomUrl.update(view.fk_custom_url_id, updates);
        }
      } else if (param.sharedView.custom_url_path !== undefined) {
        // 如果只有自定义路径未定义，则删除自定义URL
        await CustomUrl.delete({ id: view.fk_custom_url_id as string });
        customUrl = undefined;
      }
    } else if (param.sharedView.custom_url_path) {
      // 如果自定义URL不存在，则插入新的自定义URL

      const original_path = await View.getSharedViewPath(context, view.id);

      customUrl = await CustomUrl.insert({
        fk_workspace_id: view.fk_workspace_id,
        base_id: view.base_id,
        fk_model_id: view.fk_model_id,
        view_id: view.id,
        original_path,
        custom_path: param.sharedView.custom_url_path,
      });
    }

    // 执行视图更新
    const result = await View.update(context, param.viewId, {
      ...param.sharedView,
      fk_custom_url_id: customUrl?.id ?? null,
    });

    // 触发共享视图更新事件
    this.appHooksService.emit(AppEvents.SHARED_VIEW_UPDATE, {
      user: param.user,
      sharedView: { ...view, ...param.sharedView },
      oldSharedView: { ...view },
      view,
      req: param.req,
      context,
    });

    return result;
  }

  /**
   * 删除共享视图
   * @param context - NocoDB上下文
   * @param param - 包含viewId、用户信息和请求对象的参数
   * @returns 删除结果
   */
  async shareViewDelete(
    context: NcContext,
    param: {
      viewId: string;
      user: UserType;
      req: NcRequest;
    },
  ) {
    // 获取视图信息
    const view = await View.get(context, param.viewId);

    // 如果视图不存在，抛出错误
    if (!view) {
      NcError.viewNotFound(param.viewId);
    }

    // 执行共享视图删除
    await View.sharedViewDelete(context, param.viewId);

    // 触发共享视图删除事件
    this.appHooksService.emit(AppEvents.SHARED_VIEW_DELETE, {
      user: param.user,
      view,
      req: param.req,
      context,
    });

    return true;
  }

  /**
   * 显示所有列
   * @param context - NocoDB上下文
   * @param param - 包含viewId和要忽略的ID列表的参数
   * @returns 操作结果
   */
  async showAllColumns(
    context: NcContext,
    param: { viewId: string; ignoreIds?: string[] },
  ) {
    await View.showAllColumns(context, param.viewId, param.ignoreIds || []);
    return true;
  }

  /**
   * 隐藏所有列
   * @param context - NocoDB上下文
   * @param param - 包含viewId和要忽略的ID列表的参数
   * @returns 操作结果
   */
  async hideAllColumns(
    context: NcContext,
    param: { viewId: string; ignoreIds?: string[] },
  ) {
    await View.hideAllColumns(context, param.viewId, param.ignoreIds || []);
    return true;
  }

  /**
   * 获取共享视图列表
   * @param context - NocoDB上下文
   * @param param - 包含tableId的参数
   * @returns 共享视图列表
   */
  async shareViewList(context: NcContext, param: { tableId: string }) {
    return await View.shareViewList(context, param.tableId);
  }
}
