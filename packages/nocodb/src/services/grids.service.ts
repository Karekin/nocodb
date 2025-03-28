// 导入 NestJS 的 Injectable 装饰器，用于声明该服务可被依赖注入
import { Injectable } from '@nestjs/common';
// 导入 nocodb-sdk 中的 AppEvents 和 ViewTypes 枚举
import { AppEvents, ViewTypes } from 'nocodb-sdk';
// 导入 nocodb-sdk 中的类型定义，用于网格更新和视图创建的请求类型
import type { GridUpdateReqType, ViewCreateReqType } from 'nocodb-sdk';
// 导入应用上下文和请求接口类型
import type { NcContext, NcRequest } from '~/interface/config';
// 导入应用钩子服务，用于事件触发
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
// 导入验证负载的辅助函数
import { validatePayload } from '~/helpers';
// 导入错误处理辅助类
import { NcError } from '~/helpers/catchError';
// 导入数据模型类
import { GridView, Model, User, View } from '~/models';
// 导入缓存管理类
import NocoCache from '~/cache/NocoCache';
// 导入缓存作用域常量
import { CacheScope } from '~/utils/globals';

// 使用 Injectable 装饰器标记该类为可注入服务
@Injectable()
export class GridsService {
  // 构造函数，注入 AppHooksService 服务
  constructor(private readonly appHooksService: AppHooksService) {}

  // 创建网格视图的异步方法
  async gridViewCreate(
    // 应用上下文参数
    context: NcContext,
    // 方法参数对象
    param: {
      // 表格ID
      tableId: string;
      // 网格视图创建请求数据
      grid: ViewCreateReqType;
      // HTTP请求对象
      req: NcRequest;
      // 可选的拥有者ID
      ownedBy?: string;
    },
  ) {
    // 验证请求负载是否符合 Swagger 定义的模式
    validatePayload(
      'swagger.json#/components/schemas/ViewCreateReq',
      param.grid,
    );

    // 获取表格模型数据
    const model = await Model.get(context, param.tableId);

    // 仅插入视图元数据，返回插入后的ID
    const { id } = await View.insertMetaOnly(context, {
      view: {
        ...param.grid,
        // todo: 需要进行数据清理
        fk_model_id: param.tableId,
        type: ViewTypes.GRID,
        base_id: model.base_id,
        source_id: model.source_id,
        created_by: param.req.user?.id,
        owned_by: param.ownedBy || param.req.user?.id,
      },
      model,
      req: param.req,
    });

    // 获取完整的视图数据并填充缓存，由于列表缓存已存在，将新视图添加到列表中
    const view = await View.get(context, id);
    await NocoCache.appendToList(
      CacheScope.VIEW,
      [view.fk_model_id],
      `${CacheScope.VIEW}:${id}`,
    );
    // 设置拥有者为请求用户
    let owner = param.req.user;

    // 如果指定了拥有者ID，则获取该拥有者的用户信息
    if (param.ownedBy) {
      owner = await User.get(param.ownedBy);
    }

    // 触发网格创建事件
    this.appHooksService.emit(AppEvents.GRID_CREATE, {
      view,
      req: param.req,
      owner,
      context,
    });

    // 返回创建的视图数据
    return view;
  }

  // 更新网格视图的异步方法
  async gridViewUpdate(
    // 应用上下文参数
    context: NcContext,
    // 方法参数对象
    param: {
      // 视图ID
      viewId: string;
      // 网格视图更新请求数据
      grid: GridUpdateReqType;
      // HTTP请求对象
      req: NcRequest;
    },
  ) {
    // 验证请求负载是否符合 Swagger 定义的模式
    validatePayload(
      'swagger.json#/components/schemas/GridUpdateReq',
      param.grid,
    );

    // 获取视图数据
    const view = await View.get(context, param.viewId);

    // 如果视图不存在，抛出错误
    if (!view) {
      NcError.viewNotFound(param.viewId);
    }

    // 获取旧的网格视图数据
    const oldGridView = await GridView.get(context, param.viewId);
    // 更新网格视图数据
    const res = await GridView.update(context, param.viewId, param.grid);

    // 设置拥有者为请求用户
    let owner = param.req.user;

    // 如果视图有拥有者且不是当前请求用户，则获取该拥有者的用户信息
    if (view.owned_by && view.owned_by !== param.req.user?.id) {
      owner = await User.get(view.owned_by);
    }

    // 触发网格更新事件
    this.appHooksService.emit(AppEvents.GRID_UPDATE, {
      view,
      gridView: param.grid,
      oldGridView,
      req: param.req,
      owner,
      context,
    });

    // 返回更新结果
    return res;
  }
}
