// 导入 NestJS 的 Injectable 装饰器，用于声明该服务可被依赖注入
import { Injectable } from '@nestjs/common';
// 导入 nocodb-sdk 中的 AppEvents 枚举，用于事件触发
import { AppEvents } from 'nocodb-sdk';
// 导入 nocodb-sdk 中的类型定义
import type { FilterReqType, UserType } from 'nocodb-sdk';
// 导入应用配置相关的接口类型
import type { NcContext, NcRequest } from '~/interface/config';
// 导入应用钩子服务
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
// 导入验证负载的辅助函数
import { validatePayload } from '~/helpers';
// 导入错误处理辅助类
import { NcError } from '~/helpers/catchError';
// 导入数据模型
import { Filter, Hook, View } from '~/models';

// 使用 Injectable 装饰器标记该类为可注入的服务
@Injectable()
export class FiltersService {
  // 构造函数，注入 AppHooksService 服务
  constructor(protected readonly appHooksService: AppHooksService) {}

  // 创建与钩子关联的过滤器
  async hookFilterCreate(
    context: NcContext,
    param: {
      filter: FilterReqType;
      hookId: any;
      user: UserType;
      req: NcRequest;
    },
  ) {
    // 验证过滤器请求数据是否符合 swagger 定义的格式
    validatePayload('swagger.json#/components/schemas/FilterReq', param.filter);

    // 获取指定 ID 的钩子
    const hook = await Hook.get(context, param.hookId);

    // 如果钩子不存在，抛出错误
    if (!hook) {
      NcError.badRequest('Hook not found');
    }

    // 插入新的过滤器记录，并关联到指定的钩子
    const filter = await Filter.insert(context, {
      ...param.filter,
      fk_hook_id: param.hookId,
    });

    // 触发过滤器创建事件
    this.appHooksService.emit(AppEvents.FILTER_CREATE, {
      filter,
      hook,
      req: param.req,
      context,
    });
    // 返回创建的过滤器
    return filter;
  }

  // 获取指定钩子关联的所有根级过滤器列表
  async hookFilterList(context: NcContext, param: { hookId: any }) {
    return Filter.rootFilterListByHook(context, { hookId: param.hookId });
  }

  // 删除指定的过滤器
  async filterDelete(
    context: NcContext,
    param: { filterId: string; req: NcRequest },
  ) {
    // 获取指定 ID 的过滤器
    const filter = await Filter.get(context, param.filterId);

    // 如果过滤器不存在，抛出错误
    if (!filter) {
      NcError.badRequest('Filter not found');
    }

    // 提取与过滤器相关的父级元数据
    const parentData = await filter.extractRelatedParentMetas(context);

    // 删除过滤器
    await Filter.delete(context, param.filterId);

    // 触发过滤器删除事件
    this.appHooksService.emit(AppEvents.FILTER_DELETE, {
      filter,
      req: param.req,
      context,
      ...parentData,
    });

    // 返回删除成功标志
    return true;
  }

  // 为视图创建新的过滤器
  async filterCreate(
    context: NcContext,
    param: {
      filter: FilterReqType;
      viewId: string;
      user: UserType;
      req: NcRequest;
    },
  ) {
    // 验证过滤器请求数据是否符合 swagger 定义的格式
    validatePayload('swagger.json#/components/schemas/FilterReq', param.filter);

    // 获取指定 ID 的视图
    const view = await View.get(context, param.viewId);

    // 插入新的过滤器记录，并关联到指定的视图
    const filter = await Filter.insert(context, {
      ...param.filter,
      fk_view_id: param.viewId,
    });

    // 触发过滤器创建事件
    this.appHooksService.emit(AppEvents.FILTER_CREATE, {
      filter,
      view,
      req: param.req,
      context,
    });

    // 返回创建的过滤器
    return filter;
  }

  // 更新指定的过滤器
  async filterUpdate(
    context: NcContext,
    param: {
      filter: FilterReqType;
      filterId: string;
      user: UserType;
      req: NcRequest;
    },
  ) {
    // 验证过滤器请求数据是否符合 swagger 定义的格式
    validatePayload('swagger.json#/components/schemas/FilterReq', param.filter);

    // 获取指定 ID 的过滤器
    const filter = await Filter.get(context, param.filterId);

    // 如果过滤器不存在，抛出错误
    if (!filter) {
      NcError.badRequest('Filter not found');
    }
    // todo: 类型修正
    // 更新过滤器
    const res = await Filter.update(
      context,
      param.filterId,
      param.filter as Filter,
    );

    // 提取与过滤器相关的父级元数据
    const parentData = await filter.extractRelatedParentMetas(context);

    // 触发过滤器更新事件
    this.appHooksService.emit(AppEvents.FILTER_UPDATE, {
      filter: { ...filter, ...param.filter },
      oldFilter: filter,
      req: param.req,
      ...parentData,
      context,
    });

    // 返回更新结果
    return res;
  }

  // 获取指定过滤器的子过滤器列表
  async filterChildrenList(context: NcContext, param: { filterId: string }) {
    return Filter.parentFilterList(context, {
      parentId: param.filterId,
    });
  }

  // 获取指定 ID 的过滤器
  async filterGet(context: NcContext, param: { filterId: string }) {
    const filter = await Filter.get(context, param.filterId);
    return filter;
  }

  // 获取视图的过滤器列表，可选择是否包含所有过滤器
  async filterList(
    context: NcContext,
    param: { viewId: string; includeAllFilters?: boolean },
  ) {
    // 根据 includeAllFilters 参数决定获取所有过滤器还是仅根级过滤器
    const filter = await (param.includeAllFilters
      ? Filter.allViewFilterList(context, { viewId: param.viewId })
      : Filter.rootFilterList(context, { viewId: param.viewId }));

    return filter;
  }

  // 创建链接过滤器的占位方法
  async linkFilterCreate(
    _context: NcContext,
    _param: {
      filter: any;
      columnId: string;
      user: UserType;
      req: NcRequest;
    },
  ): Promise<any> {
    // 占位方法
    return null;
  }
}
