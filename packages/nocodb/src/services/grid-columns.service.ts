// 导入 NestJS 的 Injectable 装饰器，用于声明该服务可被依赖注入
import { Injectable } from '@nestjs/common';
// 导入应用事件枚举，用于触发钩子事件
import { AppEvents } from 'nocodb-sdk';
// 导入网格列请求类型的类型定义
import type { GridColumnReqType } from 'nocodb-sdk';
// 导入 NcContext 和 NcRequest 类型，用于处理上下文和请求
import type { NcContext, NcRequest } from '~/interface/config';
// 导入应用钩子服务，用于处理事件触发
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
// 导入验证负载的辅助函数
import { validatePayload } from '~/helpers';
// 导入数据模型：列、网格视图列和视图
import { Column, GridViewColumn, View } from '~/models';
// 导入提取属性的辅助函数
import { extractProps } from '~/helpers/extractProps';

// 使用 Injectable 装饰器标记该类为可注入服务
@Injectable()
export class GridColumnsService {
  // 构造函数，注入 AppHooksService 服务
  constructor(private readonly appHooksService: AppHooksService) {}

  // 获取列表方法，返回指定网格视图的所有列
  async columnList(context: NcContext, param: { gridViewId: string }) {
    // 调用 GridViewColumn 模型的 list 方法获取列表
    return await GridViewColumn.list(context, param.gridViewId);
  }

  // 更新网格列方法
  async gridColumnUpdate(
    context: NcContext,
    param: {
      // 网格视图列 ID
      gridViewColumnId: string;
      // 网格列更新数据
      grid: GridColumnReqType;
      // 请求对象
      req: NcRequest;
    },
  ) {
    // 验证请求负载是否符合 swagger 定义的模式
    validatePayload(
      'swagger.json#/components/schemas/GridColumnReq',
      param.grid,
    );

    // 获取旧的网格视图列数据
    const oldGridViewColumn = await GridViewColumn.get(
      context,
      param.gridViewColumnId,
    );

    // 获取关联的列信息
    const column = await Column.get(context, {
      colId: oldGridViewColumn.fk_column_id,
    });

    // 获取关联的视图信息
    const view = await View.get(context, oldGridViewColumn.fk_view_id);
    // 更新网格视图列
    const res = await GridViewColumn.update(
      context,
      param.gridViewColumnId,
      param.grid,
    );

    // 触发视图列更新事件
    this.appHooksService.emit(AppEvents.VIEW_COLUMN_UPDATE, {
      // 旧的视图列数据
      oldViewColumn: oldGridViewColumn,
      // todo: 改进并将其移至一个地方而不是重复
      // 提取更新后的视图列属性
      viewColumn: extractProps(param.grid, [
        'order',
        'show',
        'width',
        'group_by',
        'group_by_order',
        'group_by_sort',
        'aggregation',
      ]),
      // 列信息
      column,
      // 视图信息
      view,
      // 请求对象
      req: param.req,
      // 上下文
      context,
    });

    // 返回更新结果
    return res;
  }
}
