// 导入 NestJS 依赖注入装饰器
import { Injectable } from '@nestjs/common';
// 导入 nocodb-sdk 中的类型定义
import { APIContext, AppEvents, ViewTypes } from 'nocodb-sdk';
// 导入不同视图类型的列模型
import GridViewColumn from '../models/GridViewColumn';
import GalleryViewColumn from '../models/GalleryViewColumn';
import KanbanViewColumn from '../models/KanbanViewColumn';
import MapViewColumn from '../models/MapViewColumn';
import FormViewColumn from '../models/FormViewColumn';
// 导入各种视图列的请求类型定义
import type {
  CalendarColumnReqType,
  FormColumnReqType,
  GalleryColumnReqType,
  GridColumnReqType,
  KanbanColumnReqType,
  ViewColumnReqType,
  ViewColumnUpdateReqType,
} from 'nocodb-sdk';
// 导入配置接口类型
import type { NcContext, NcRequest } from '~/interface/config';
// 导入应用钩子服务
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
// 导入辅助函数
import { validatePayload } from '~/helpers';
// 导入模型
import { CalendarViewColumn, Column, View } from '~/models';
// 导入错误处理工具
import { NcError } from '~/helpers/catchError';
// 导入 Noco 核心类
import Noco from '~/Noco';

// 视图列服务类，使用 @Injectable 装饰器标记为可注入的服务
@Injectable()
export class ViewColumnsService {
  // 构造函数，注入 AppHooksService
  constructor(private appHooksService: AppHooksService) {}

  // 获取列表方法
  async columnList(context: NcContext, param: { viewId: string }) {
    return await View.getColumns(context, param.viewId, undefined);
  }

  // 添加列方法
  async columnAdd(
    context: NcContext,
    param: {
      viewId: string;
      column: ViewColumnReqType;
      req: NcRequest;
    },
  ) {
    // 验证请求负载
    validatePayload(
      'swagger.json#/components/schemas/ViewColumnReq',
      param.column,
    );

    // 插入或更新列
    const viewColumn = await View.insertOrUpdateColumn(
      context,
      param.viewId,
      param.column.fk_column_id,
      {
        order: param.column.order,
        show: param.column.show,
      },
    );
    // this.appHooksService.emit(AppEvents.VIEW_COLUMN_CREATE, {
    //   viewColumn,
    //   req: param.req,
    //   context,
    // });

    return viewColumn;
  }

  // 更新列方法
  async columnUpdate(
    context: NcContext,
    param: {
      viewId: string;
      columnId: string;
      column: ViewColumnUpdateReqType;
      req: NcRequest;
      internal?: boolean;
    },
  ) {
    // 验证更新请求负载
    validatePayload(
      'swagger.json#/components/schemas/ViewColumnUpdateReq',
      param.column,
    );

    // 获取视图信息
    const view = await View.get(context, param.viewId);

    // 检查视图是否存在
    if (!view) {
      NcError.viewNotFound(param.viewId);
    }

    // 获取旧的视图列信息
    const oldViewColumn = await View.getColumn(
      context,
      param.viewId,
      param.columnId,
    );

    // 获取列信息
    const column = await Column.get(context, {
      colId: oldViewColumn.fk_column_id,
    });

    // 更新列
    const result = await View.updateColumn(
      context,
      param.viewId,
      param.columnId,
      param.column,
    );

    // 获取更新后的视图列信息
    const viewColumn = await View.getColumn(
      context,
      param.viewId,
      param.columnId,
    );

    // 触发视图列更新事件
    this.appHooksService.emit(AppEvents.VIEW_COLUMN_UPDATE, {
      viewColumn,
      oldViewColumn,
      view,
      column,
      internal: param.internal,
      req: param.req,
      context,
    });

    return result;
  }

  // 批量更新列方法
  async columnsUpdate(
    context: NcContext,
    param: {
      viewId: string;
      columns:
        | GridColumnReqType
        | GalleryColumnReqType
        | KanbanColumnReqType
        | FormColumnReqType
        | CalendarColumnReqType[]
        | Record<
            APIContext.VIEW_COLUMNS,
            Record<
              string,
              | GridColumnReqType
              | GalleryColumnReqType
              | KanbanColumnReqType
              | FormColumnReqType
              | CalendarColumnReqType
            >
          >;
      req: any;
    },
  ) {
    const { viewId } = param;

    // 处理列数据格式
    const columns = Array.isArray(param.columns)
      ? param.columns
      : param.columns?.[APIContext.VIEW_COLUMNS];

    // 检查列数据是否存在
    if (!columns) {
      NcError.badRequest('Invalid request - fields not found');
    }

    // 获取视图信息
    const view = await View.get(context, viewId);

    // 存储更新或插入操作的 Promise 数组
    const updateOrInsertOptions: Promise<any>[] = [];

    let result: any;
    // 开启事务
    const ncMeta = await Noco.ncMeta.startTransaction();

    // 检查视图是否存在
    if (!view) {
      NcError.notFound('View not found');
    }

    try {
      // 获取视图列表名
      const table = View.extractViewColumnsTableName(view);

      // iterate over view columns and update/insert accordingly
      for (const [indexOrId, column] of Object.entries(columns)) {
        // 获取列 ID
        const columnId =
          typeof param.columns === 'object' ? indexOrId : column['id'];

        // 查询已存在的列
        const existingCol = await ncMeta.metaGet2(
          context.workspace_id,
          context.base_id,
          table,
          {
            fk_view_id: viewId,
            fk_column_id: columnId,
          },
        );

        // 根据视图类型处理不同的列更新逻辑
        switch (view.type) {
          case ViewTypes.GRID:
            validatePayload(
              'swagger.json#/components/schemas/GridColumnReq',
              column,
            );
            if (existingCol) {
              updateOrInsertOptions.push(
                GridViewColumn.update(context, existingCol.id, column, ncMeta),
              );
            } else {
              updateOrInsertOptions.push(
                GridViewColumn.insert(
                  context,
                  {
                    ...(column as GridColumnReqType),
                    fk_view_id: viewId,
                    fk_column_id: columnId,
                  },
                  ncMeta,
                ),
              );
            }
            break;
          case ViewTypes.GALLERY:
            validatePayload(
              'swagger.json#/components/schemas/GalleryColumnReq',
              column,
            );
            if (existingCol) {
              updateOrInsertOptions.push(
                GalleryViewColumn.update(
                  context,
                  existingCol.id,
                  column,
                  ncMeta,
                ),
              );
            } else {
              updateOrInsertOptions.push(
                GalleryViewColumn.insert(
                  context,
                  {
                    ...(column as GalleryColumnReqType),
                    fk_view_id: viewId,
                    fk_column_id: columnId,
                  },
                  ncMeta,
                ),
              );
            }
            break;
          case ViewTypes.KANBAN:
            validatePayload(
              'swagger.json#/components/schemas/KanbanColumnReq',
              column,
            );
            if (existingCol) {
              updateOrInsertOptions.push(
                KanbanViewColumn.update(
                  context,
                  existingCol.id,
                  column,
                  ncMeta,
                ),
              );
            } else {
              updateOrInsertOptions.push(
                KanbanViewColumn.insert(
                  context,
                  {
                    ...(column as KanbanColumnReqType),
                    fk_view_id: viewId,
                    fk_column_id: columnId,
                  },
                  ncMeta,
                ),
              );
            }
            break;
          case ViewTypes.MAP:
            validatePayload(
              'swagger.json#/components/schemas/MapColumn',
              column,
            );
            if (existingCol) {
              updateOrInsertOptions.push(
                MapViewColumn.update(context, existingCol.id, column, ncMeta),
              );
            } else {
              updateOrInsertOptions.push(
                MapViewColumn.insert(
                  context,
                  {
                    ...(column as MapViewColumn),
                    fk_view_id: viewId,
                    fk_column_id: columnId,
                  },
                  ncMeta,
                ),
              );
            }
            break;
          case ViewTypes.FORM:
            validatePayload(
              'swagger.json#/components/schemas/FormColumnReq',
              column,
            );
            if (existingCol) {
              updateOrInsertOptions.push(
                FormViewColumn.update(context, existingCol.id, column, ncMeta),
              );
            } else {
              updateOrInsertOptions.push(
                FormViewColumn.insert(
                  context,
                  {
                    ...(column as FormColumnReqType),
                    fk_view_id: viewId,
                    fk_column_id: columnId,
                  },
                  ncMeta,
                ),
              );
            }
            break;
          case ViewTypes.CALENDAR:
            validatePayload(
              'swagger.json#/components/schemas/CalendarColumnReq',
              column,
            );
            if (existingCol) {
              updateOrInsertOptions.push(
                CalendarViewColumn.update(
                  context,
                  existingCol.id,
                  column,
                  ncMeta,
                ),
              );
            } else {
              updateOrInsertOptions.push(
                CalendarViewColumn.insert(
                  context,
                  {
                    ...(column as CalendarColumnReqType),
                    fk_view_id: viewId,
                    fk_column_id: columnId,
                  },
                  ncMeta,
                ),
              );
            }
            break;
        }
      }

      await Promise.all(updateOrInsertOptions);

      // 提交事务
      await ncMeta.commit();

      // 清除查询缓存
      await View.clearSingleQueryCache(context, view.fk_model_id, [view]);

      return result;
    } catch (e) {
      // 发生错误时回滚事务
      await ncMeta.rollback();
      throw e;
    }
  }

  // 获取视图列表方法
  async viewColumnList(
    context: NcContext,
    param: { viewId: string; req: any },
  ) {
    // 获取列表数据
    const columnList = await View.getColumns(context, param.viewId, undefined);

    // 生成列 ID 和列信息的键值对映射
    const columnMap = columnList.reduce((acc, column) => {
      acc[column.fk_column_id] = column;
      return acc;
    }, {});

    return columnMap;
  }
}
