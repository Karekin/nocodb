// 导入所需的依赖
import { Injectable } from '@nestjs/common';
import { AppEvents } from 'nocodb-sdk';
import type { VisibilityRuleReqType } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import type { UIAclEvent } from '~/services/app-hooks/interfaces';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { validatePayload } from '~/helpers';
import { NcError } from '~/helpers/catchError';
import { Base, Model, ModelRoleVisibility, View } from '~/models';

// 使用 Injectable 装饰器标记该服务可被依赖注入
@Injectable()
export class ModelVisibilitiesService {
  // 构造函数，注入 AppHooksService 服务
  constructor(private readonly appHooksService: AppHooksService) {}

  // 设置所有模型可见性规则的方法
  async xcVisibilityMetaSetAll(
    context: NcContext,
    param: {
      visibilityRule: VisibilityRuleReqType; // 可见性规则
      baseId: string; // 基础ID
      req: NcRequest; // 请求对象
    },
  ) {
    // 验证传入的可见性规则是否符合 swagger 定义的格式
    validatePayload(
      'swagger.json#/components/schemas/VisibilityRuleReq',
      param.visibilityRule,
    );

    // 获取基础信息
    const base = await Base.getWithInfo(context, param.baseId);

    // 如果基础不存在，抛出错误
    if (!base) {
      NcError.baseNotFound(param.baseId);
    }

    // 遍历所有可见性规则
    for (const d of param.visibilityRule) {
      // 遍历每个规则中的所有角色
      for (const role of Object.keys(d.disabled)) {
        // 获取视图信息
        const view = await View.get(context, d.id);

        // 验证视图是否属于指定的基础
        if (view.base_id !== param.baseId) {
          NcError.badRequest('View does not belong to the base');
        }

        // 从数据库获取现有的角色可见性设置
        const dataInDb = await ModelRoleVisibility.get(context, {
          role,
          fk_view_id: d.id,
        });

        // 处理现有数据的更新或删除
        if (dataInDb) {
          if (d.disabled[role]) {
            // 如果需要禁用且当前未禁用，则更新
            if (!dataInDb.disabled) {
              await ModelRoleVisibility.update(context, d.id, role, {
                disabled: d.disabled[role],
              });
            }
          } else {
            // 如果不需要禁用，则删除现有记录
            await dataInDb.delete(context);
          }
        } else if (d.disabled[role]) {
          // 如果数据库中不存在且需要禁用，则插入新记录
          await ModelRoleVisibility.insert(context, {
            fk_view_id: d.id,
            disabled: d.disabled[role],
            role,
          });
        }

        // 如果可见性状态发生变化，触发 UI_ACL 事件
        if (!!d.disabled[role] !== !!dataInDb?.disabled) {
          this.appHooksService.emit(AppEvents.UI_ACL, {
            base,
            req: param.req,
            context,
            view,
            role,
            disabled: !!d.disabled[role],
          } as UIAclEvent);
        }
      }
    }

    return true;
  }

  // 获取模型可见性元数据的方法
  async xcVisibilityMetaGet(
    context: NcContext,
    param: {
      baseId: string; // 基础ID
      includeM2M?: boolean; // 是否包含多对多关系
      models?: Model[]; // 可选的模型列表
    },
  ) {
    // 解构参数，设置默认值
    const { includeM2M = true, baseId, models: _models } = param ?? {};

    // 定义系统支持的角色列表
    const roles = [
      'owner',
      'creator',
      'viewer',
      'editor',
      'commenter',
      'guest',
    ];

    // 创建默认的禁用状态对象，所有角色默认为 false
    const defaultDisabled = roles.reduce((o, r) => ({ ...o, [r]: false }), {});

    // 获取模型列表，如果未提供则从数据库查询
    let models =
      _models ||
      (await Model.list(context, {
        base_id: baseId,
        source_id: undefined,
      }));

    // 根据 includeM2M 参数过滤多对多关系模型
    models = includeM2M ? models : (models.filter((t) => !t.mm) as Model[]);

    // 构建结果对象，包含每个视图的详细信息
    const result = await models.reduce(async (_obj, model) => {
      const obj = await _obj;

      const views = await model.getViews(context);
      for (const view of views) {
        obj[view.id] = {
          ptn: model.table_name, // 物理表名
          _ptn: model.title, // 模型标题
          ptype: model.type, // 模型类型
          tn: view.title, // 视图标题
          _tn: view.title, // 视图标题（别名）
          table_meta: model.meta, // 表元数据
          ...view, // 展开视图属性
          disabled: { ...defaultDisabled }, // 默认禁用状态
        };
      }

      return obj;
    }, Promise.resolve({}));

    // 获取已禁用的角色列表
    const disabledList = await ModelRoleVisibility.list(context, baseId);

    // 更新结果对象中的禁用状态
    for (const d of disabledList) {
      if (result[d.fk_view_id])
        result[d.fk_view_id].disabled[d.role] = !!d.disabled;
    }

    // 返回结果数组
    return Object.values(result);
  }
}
