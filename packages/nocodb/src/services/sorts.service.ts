// 导入 NestJS 的 Injectable 装饰器，用于依赖注入
import { Injectable } from '@nestjs/common';
// 导入应用事件枚举
import { AppEvents } from 'nocodb-sdk';
// 导入排序请求类型接口
import type { SortReqType } from 'nocodb-sdk';
// 导入 NocoDB 上下文和请求接口
import type { NcContext, NcRequest } from '~/interface/config';
// 导入应用钩子服务
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
// 导入验证负载的辅助函数
import { validatePayload } from '~/helpers';
// 导入错误处理辅助类
import { NcError } from '~/helpers/catchError';
// 导入数据模型
import { Column, Sort, View } from '~/models';

// 使用 Injectable 装饰器标记该服务可被依赖注入
@Injectable()
export class SortsService {
  // 构造函数，注入 AppHooksService
  constructor(protected readonly appHooksService: AppHooksService) {}

  /**
   * 获取指定 ID 的排序
   * @param context - NocoDB 上下文
   * @param param - 包含排序 ID 的参数对象
   * @returns 返回排序对象
   */
  async sortGet(context: NcContext, param: { sortId: string }) {
    return Sort.get(context, param.sortId);
  }

  /**
   * 删除指定 ID 的排序
   * @param context - NocoDB 上下文
   * @param param - 包含排序 ID 和请求对象的参数
   * @returns 返回布尔值表示删除是否成功
   */
  async sortDelete(
    context: NcContext,
    param: { sortId: string; req: NcRequest },
  ) {
    // 获取要删除的排序对象
    const sort = await Sort.get(context, param.sortId);

    // 如果排序不存在，抛出错误
    if (!sort) {
      NcError.badRequest('Sort not found');
    }

    // 获取与排序关联的列
    const column = await Column.get(context, { colId: sort.fk_column_id });

    // 获取与排序关联的视图
    const view = await View.get(context, sort.fk_view_id);

    // 执行排序删除操作
    await Sort.delete(context, param.sortId);

    // 触发排序删除事件
    this.appHooksService.emit(AppEvents.SORT_DELETE, {
      sort,
      req: param.req,
      view,
      column,
      context,
    });
    return true;
  }

  /**
   * 更新指定 ID 的排序
   * @param context - NocoDB 上下文
   * @param param - 包含排序 ID、排序数据和请求对象的参数
   * @returns 返回更新后的排序对象
   */
  async sortUpdate(
    context: NcContext,
    param: { sortId: any; sort: SortReqType; req: NcRequest },
  ) {
    // 验证排序请求数据是否符合 Swagger 定义的模式
    validatePayload('swagger.json#/components/schemas/SortReq', param.sort);

    // 获取要更新的排序对象
    const sort = await Sort.get(context, param.sortId);

    // 如果排序不存在，抛出错误
    if (!sort) {
      NcError.badRequest('Sort not found');
    }

    // 获取与排序关联的列
    const column = await Column.get(context, { colId: sort.fk_column_id });

    // 获取与排序关联的视图
    const view = await View.get(context, sort.fk_view_id);

    // 执行排序更新操作
    const res = await Sort.update(context, param.sortId, param.sort);

    // 触发排序更新事件
    this.appHooksService.emit(AppEvents.SORT_UPDATE, {
      sort: {
        ...sort,
        ...param.sort,
      },
      oldSort: sort,
      column,
      view,
      req: param.req,
      context,
    });

    return res;
  }

  /**
   * 创建新的排序
   * @param context - NocoDB 上下文
   * @param param - 包含视图 ID、排序数据和请求对象的参数
   * @returns 返回创建的排序对象
   */
  async sortCreate(
    context: NcContext,
    param: { viewId: string; sort: SortReqType; req: NcRequest },
  ) {
    // 验证排序请求数据是否符合 Swagger 定义的模式
    validatePayload('swagger.json#/components/schemas/SortReq', param.sort);

    // 插入新的排序记录，并关联到指定的视图
    const sort = await Sort.insert(context, {
      ...param.sort,
      fk_view_id: param.viewId,
    } as Sort);

    // 获取与排序关联的视图
    const view = await View.get(context, param.viewId);

    // 如果视图不存在，抛出错误
    if (!view) {
      NcError.badRequest('View not found');
    }

    // 获取与排序关联的列
    const column = await Column.get(context, { colId: sort.fk_column_id });

    // 触发排序创建事件
    this.appHooksService.emit(AppEvents.SORT_CREATE, {
      sort,
      view,
      column,
      req: param.req,
      context,
    });

    return sort;
  }

  /**
   * 获取指定视图的所有排序列表
   * @param context - NocoDB 上下文
   * @param param - 包含视图 ID 的参数对象
   * @returns 返回排序对象数组
   */
  async sortList(context: NcContext, param: { viewId: string }) {
    return Sort.list(context, { viewId: param.viewId });
  }
}
