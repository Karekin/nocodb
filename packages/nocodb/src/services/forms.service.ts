// 导入 NestJS 的 Injectable 装饰器，用于声明该服务可被依赖注入
import { Injectable } from '@nestjs/common';
// 导入 nocodb-sdk 中的 AppEvents 和 ViewTypes 枚举
import { AppEvents, ViewTypes } from 'nocodb-sdk';
// 导入 nocodb-sdk 中的类型定义
import type {
  FormUpdateReqType,
  UserType,
  ViewCreateReqType,
} from 'nocodb-sdk';
// 导入项目内部的配置接口类型
import type { NcContext, NcRequest } from '~/interface/config';
// 导入应用钩子服务
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
// 导入验证负载的辅助函数
import { validatePayload } from '~/helpers';
// 导入错误处理辅助类
import { NcError } from '~/helpers/catchError';
// 导入数据模型
import { FormView, Model, Source, User, View } from '~/models';
// 导入缓存管理模块
import NocoCache from '~/cache/NocoCache';
// 导入缓存作用域常量
import { CacheScope } from '~/utils/globals';

// 使用 Injectable 装饰器标记该类为可注入的服务
@Injectable()
export class FormsService {
  // 构造函数，注入 AppHooksService 服务
  constructor(private readonly appHooksService: AppHooksService) {}

  // 获取表单视图数据的方法
  // 参数：上下文和包含表单视图ID的参数对象
  async formViewGet(context: NcContext, param: { formViewId: string }) {
    // 使用 FormView 模型的 getWithInfo 方法获取表单视图数据
    const formViewData = await FormView.getWithInfo(context, param.formViewId);
    // 返回获取到的表单视图数据
    return formViewData;
  }

  // 创建表单视图的方法
  // 参数：上下文和包含表格ID、请求体、用户信息、请求对象和可选的所有者ID的参数对象
  async formViewCreate(
    context: NcContext,
    param: {
      tableId: string;
      body: ViewCreateReqType;
      user: UserType;
      req: NcRequest;
      ownedBy?: string;
    },
  ) {
    // 验证请求体是否符合 ViewCreateReq 的 schema 定义
    validatePayload(
      'swagger.json#/components/schemas/ViewCreateReq',
      param.body,
    );

    // 获取表格模型数据
    const model = await Model.get(context, param.tableId);

    // 获取数据源信息
    const source = await Source.get(context, model.source_id);

    // 如果数据源是只读的，抛出错误
    if (source.is_data_readonly) {
      NcError.sourceDataReadOnly(source.alias);
    }

    // 插入视图元数据，只创建视图记录而不处理关联数据
    const { id } = await View.insertMetaOnly(context, {
      view: {
        ...param.body,
        // todo: 需要进行数据清理
        fk_model_id: param.tableId,
        type: ViewTypes.FORM,
        base_id: model.base_id,
        source_id: model.source_id,
        created_by: param.user?.id,
        owned_by: param.ownedBy || param.user?.id,
      },
      model,
      req: param.req,
    });

    // 填充缓存并添加到列表中，因为列表缓存已经存在
    const view = await View.get(context, id);
    await NocoCache.appendToList(
      CacheScope.VIEW,
      [view.fk_model_id],
      `${CacheScope.VIEW}:${id}`,
    );

    // 设置所有者为请求用户
    let owner = param.req.user;

    // 如果指定了所有者ID，则获取该所有者的信息
    if (param.ownedBy) {
      owner = await User.get(param.ownedBy);
    }

    // 触发表单创建事件
    this.appHooksService.emit(AppEvents.FORM_CREATE, {
      user: param.user,
      view,
      req: param.req,
      owner,
      context,
    });

    // 返回创建的视图
    return view;
  }

  // 更新表单视图的方法
  // 参数：上下文和包含表单视图ID、表单数据和请求对象的参数对象
  async formViewUpdate(
    context: NcContext,
    param: {
      formViewId: string;
      form: FormUpdateReqType;
      req: NcRequest;
    },
  ) {
    // 验证表单数据是否符合 FormUpdateReq 的 schema 定义
    validatePayload(
      'swagger.json#/components/schemas/FormUpdateReq',
      param.form,
    );
    // 获取视图信息
    const view = await View.get(context, param.formViewId);

    // 如果视图不存在，抛出错误
    if (!view) {
      NcError.viewNotFound(param.formViewId);
    }

    // 获取更新前的表单视图数据
    const oldFormView = await FormView.get(context, param.formViewId);

    // 更新表单视图
    const res = await FormView.update(context, param.formViewId, param.form);

    // 设置所有者为请求用户
    let owner = param.req.user;

    // 如果视图有所有者且不是当前请求用户，则获取该所有者的信息
    if (view.owned_by && view.owned_by !== param.req.user?.id) {
      owner = await User.get(view.owned_by);
    }

    // 触发表单更新事件
    this.appHooksService.emit(AppEvents.FORM_UPDATE, {
      view: { ...view, ...param.form },
      req: param.req,
      formView: param.form,
      oldFormView: oldFormView,
      context,
      owner,
    });

    // 返回更新结果
    return res;
  }
}
