// 导入 NestJS 的 Injectable 装饰器，用于依赖注入
import { Injectable } from '@nestjs/common';
// 导入 nocodb-sdk 中的事件类型、UI类型和视图类型常量
import { AppEvents, UITypes, ViewTypes } from 'nocodb-sdk';
// 导入类型定义
import type {
  KanbanUpdateReqType, // 看板更新请求类型
  UserType, // 用户类型
  ViewCreateReqType, // 视图创建请求类型
} from 'nocodb-sdk';
// 导入应用上下文和请求接口类型
import type { NcContext, NcRequest } from '~/interface/config';
// 导入应用钩子服务，用于事件触发
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
// 导入验证负载的辅助函数
import { validatePayload } from '~/helpers';
// 导入错误处理辅助类
import { NcError } from '~/helpers/catchError';
// 导入模型类
import { KanbanView, Model, User, View } from '~/models';
// 导入缓存管理类
import NocoCache from '~/cache/NocoCache';
// 导入缓存作用域常量
import { CacheScope } from '~/utils/globals';

// 使用 Injectable 装饰器标记该服务可被依赖注入系统使用
@Injectable()
export class KanbansService {
  // 构造函数，注入 AppHooksService 服务
  constructor(private readonly appHooksService: AppHooksService) {}

  /**
   * 获取看板视图
   * @param context - 应用上下文
   * @param param - 包含看板视图ID的参数对象
   * @returns 返回看板视图数据
   */
  async kanbanViewGet(context: NcContext, param: { kanbanViewId: string }) {
    return await KanbanView.get(context, param.kanbanViewId);
  }

  /**
   * 创建看板视图
   * @param context - 应用上下文
   * @param param - 创建看板所需的参数
   * @param param.tableId - 表格ID
   * @param param.kanban - 看板视图创建请求数据
   * @param param.user - 用户信息
   * @param param.req - HTTP请求对象
   * @param param.ownedBy - 可选的所有者ID
   * @returns 返回创建的看板视图
   */
  async kanbanViewCreate(
    context: NcContext,
    param: {
      tableId: string;
      kanban: ViewCreateReqType;
      user: UserType;
      req: NcRequest;
      ownedBy?: string;
    },
  ) {
    // 验证请求负载是否符合API规范
    validatePayload(
      'swagger.json#/components/schemas/ViewCreateReq',
      param.kanban,
    );

    // 获取表格模型
    const model = await Model.get(context, param.tableId);

    // 获取封面图片列ID，如果未提供则为null
    let fk_cover_image_col_id =
      (param.kanban as KanbanView).fk_cover_image_col_id ?? null;

    // 如果未指定封面图片列且不是复制操作，则尝试自动选择第一个附件类型的列作为封面
    // 如果附件字段未映射(undefined)且模型中至少存在一个附件字段
    // 映射第一个附件字段，如果是复制操作则跳过
    // 如果存在copy_from_id(表示正在复制)则跳过
    if (
      (param.kanban as KanbanView).fk_cover_image_col_id === undefined &&
      !(param.kanban as { copy_from_id: string }).copy_from_id
    ) {
      // 查找第一个附件类型的列
      const attachmentField = (await model.getColumns(context)).find(
        (column) => column.uidt === UITypes.Attachment,
      );
      if (attachmentField) {
        fk_cover_image_col_id = attachmentField.id;
      }
    }

    // 插入视图元数据
    const { id } = await View.insertMetaOnly(context, {
      view: {
        ...param.kanban,
        // todo: 需要进行数据清理
        fk_model_id: param.tableId,
        type: ViewTypes.KANBAN, // 设置视图类型为看板
        base_id: model.base_id, // 设置基础ID
        source_id: model.source_id, // 设置数据源ID
        created_by: param.user?.id, // 设置创建者ID
        owned_by: param.ownedBy || param.user?.id, // 设置所有者ID
        fk_cover_image_col_id, // 设置封面图片列ID
      },
      model,
      req: param.req,
    });

    // 填充缓存并添加到列表，因为列表缓存已经存在
    const view = await View.get(context, id);
    await NocoCache.appendToList(
      CacheScope.VIEW,
      [view.fk_model_id],
      `${CacheScope.VIEW}:${id}`,
    );

    // 设置所有者信息
    let owner = param.req.user;

    if (param.ownedBy) {
      owner = await User.get(param.ownedBy);
    }

    // 触发看板创建事件
    this.appHooksService.emit(AppEvents.KANBAN_CREATE, {
      view: {
        ...view,
        ...param.kanban,
      },
      user: param.user,
      req: param.req,
      owner,
      context,
    });

    return view;
  }

  /**
   * 更新看板视图
   * @param context - 应用上下文
   * @param param - 更新看板所需的参数
   * @param param.kanbanViewId - 看板视图ID
   * @param param.kanban - 看板更新请求数据
   * @param param.req - HTTP请求对象
   * @returns 返回更新结果
   */
  async kanbanViewUpdate(
    context: NcContext,
    param: {
      kanbanViewId: string;
      kanban: KanbanUpdateReqType;
      req: NcRequest;
    },
  ) {
    // 验证请求负载是否符合API规范
    validatePayload(
      'swagger.json#/components/schemas/KanbanUpdateReq',
      param.kanban,
    );

    // 获取视图信息
    const view = await View.get(context, param.kanbanViewId);

    // 如果视图不存在，抛出错误
    if (!view) {
      NcError.viewNotFound(param.kanbanViewId);
    }

    // 获取更新前的看板视图信息
    const oldKanbanView = await KanbanView.get(context, param.kanbanViewId);

    // 执行看板视图更新
    const res = await KanbanView.update(
      context,
      param.kanbanViewId,
      param.kanban,
    );

    // 设置所有者信息
    let owner = param.req.user;

    if (view.owned_by && view.owned_by !== param.req.user?.id) {
      owner = await User.get(view.owned_by);
    }

    // 获取更新后的看板视图信息
    const kanbanView = await KanbanView.get(context, param.kanbanViewId);

    // 触发看板更新事件
    this.appHooksService.emit(AppEvents.KANBAN_UPDATE, {
      view: view,
      oldKanbanView,
      kanbanView: kanbanView,
      req: param.req,
      owner,
      context,
    });

    return res;
  }
}
