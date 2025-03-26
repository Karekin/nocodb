import type { BoolType, MetaType } from 'nocodb-sdk'; // 导入布尔类型和元数据类型
import type { NcContext } from '~/interface/config'; // 导入上下文类型
import View from '~/models/View'; // 导入视图模型
import Noco from '~/Noco'; // 导入Noco核心类
import NocoCache from '~/cache/NocoCache'; // 导入缓存类
import { extractProps } from '~/helpers/extractProps'; // 导入属性提取工具
import { deserializeJSON } from '~/utils/serialize'; // 导入JSON反序列化工具
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals'; // 导入缓存相关常量

// 日历视图列模型类
export default class CalendarViewColumn {
  id?: string; // 唯一标识符
  fk_workspace_id?: string; // 关联的工作区ID
  base_id?: string; // 关联的数据库ID
  fk_view_id?: string; // 关联的视图ID
  fk_column_id?: string; // 关联的列ID
  source_id?: string; // 数据源ID
  show?: BoolType; // 是否显示
  underline?: BoolType; // 是否加下划线
  bold?: BoolType; // 是否加粗
  italic?: BoolType; // 是否斜体
  order?: number; // 排序顺序
  meta?: MetaType; // 元数据

  // 构造函数，用于初始化日历视图列对象
  constructor(data: CalendarViewColumn) {
    Object.assign(this, data);
  }

  // 获取单个日历视图列
  public static async get(
    context: NcContext, // 上下文对象
    calendarViewColumnId: string, // 日历视图列ID
    ncMeta = Noco.ncMeta, // 元数据操作对象
  ) {
    // 首先尝试从缓存中获取
    let viewColumn =
      calendarViewColumnId &&
      (await NocoCache.get(
        `${CacheScope.CALENDAR_VIEW_COLUMN}:${calendarViewColumnId}`,
        CacheGetType.TYPE_OBJECT,
      ));
    
    // 如果缓存中没有，则从数据库中获取
    if (!viewColumn) {
      viewColumn = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.CALENDAR_VIEW_COLUMNS,
        calendarViewColumnId,
      );
      
      // 如果从数据库获取成功，处理元数据并更新缓存
      if (viewColumn) {
        viewColumn.meta =
          viewColumn.meta && typeof viewColumn.meta === 'string'
            ? JSON.parse(viewColumn.meta)
            : viewColumn.meta;

        await NocoCache.set(
          `${CacheScope.CALENDAR_VIEW_COLUMN}:${calendarViewColumnId}`,
          viewColumn,
        );
      }
    }

    // 返回新的CalendarViewColumn实例
    return viewColumn && new CalendarViewColumn(viewColumn);
  }

  // 插入新的日历视图列
  static async insert(
    context: NcContext, // 上下文对象
    column: Partial<CalendarViewColumn>, // 要插入的列数据
    ncMeta = Noco.ncMeta, // 元数据操作对象
  ) {
    // 提取需要的属性
    const insertObj = extractProps(column, [
      'fk_view_id',
      'fk_column_id',
      'show',
      'base_id',
      'source_id',
      'underline',
      'bold',
      'italic',
    ]);

    // 获取下一个排序值
    insertObj.order = await ncMeta.metaGetNextOrder(
      MetaTable.CALENDAR_VIEW_COLUMNS,
      {
        fk_view_id: insertObj.fk_view_id,
      },
    );

    // 如果没有提供source_id，则从关联的视图中获取
    if (!insertObj.source_id) {
      const viewRef = await View.get(context, insertObj.fk_view_id, ncMeta);
      insertObj.source_id = viewRef.source_id;
    }

    // 插入数据库
    const { id } = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.CALENDAR_VIEW_COLUMNS,
      insertObj,
    );

    // 清除相关视图的缓存
    {
      const view = await View.get(context, column.fk_view_id, ncMeta);
      await View.clearSingleQueryCache(
        context,
        view.fk_model_id,
        [view],
        ncMeta,
      );
    }

    // 返回新创建的列并更新缓存列表
    return this.get(context, id, ncMeta).then(async (viewColumn) => {
      await NocoCache.appendToList(
        CacheScope.CALENDAR_VIEW_COLUMN,
        [column.fk_view_id],
        `${CacheScope.CALENDAR_VIEW_COLUMN}:${id}`,
      );
      return viewColumn;
    });
  }

  // 获取视图下的所有日历视图列
  public static async list(
    context: NcContext, // 上下文对象
    viewId: string, // 视图ID
    ncMeta = Noco.ncMeta, // 元数据操作对象
  ): Promise<CalendarViewColumn[]> {
    // 首先尝试从缓存中获取列表
    const cachedList = await NocoCache.getList(
      CacheScope.CALENDAR_VIEW_COLUMN,
      [viewId],
    );
    let { list: viewColumns } = cachedList;
    const { isNoneList } = cachedList;
    
    // 如果缓存中没有有效数据，则从数据库获取
    if (!isNoneList && !viewColumns.length) {
      viewColumns = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.CALENDAR_VIEW_COLUMNS,
        {
          condition: {
            fk_view_id: viewId,
          },
          orderBy: {
            order: 'asc',
          },
        },
      );

      // 处理每个列的元数据
      for (const viewColumn of viewColumns) {
        viewColumn.meta = deserializeJSON(viewColumn.meta);
      }

      // 更新缓存
      await NocoCache.setList(
        CacheScope.CALENDAR_VIEW_COLUMN,
        [viewId],
        viewColumns,
      );
    }
    
    // 按order排序
    viewColumns.sort(
      (a, b) =>
        (a.order != null ? a.order : Infinity) -
        (b.order != null ? b.order : Infinity),
    );
    
    // 返回CalendarViewColumn实例数组
    return viewColumns?.map((v) => new CalendarViewColumn(v));
  }

  // 更新日历视图列
  static async update(
    context: NcContext, // 上下文对象
    columnId: string, // 要更新的列ID
    body: Partial<CalendarViewColumn>, // 更新内容
    ncMeta = Noco.ncMeta, // 元数据操作对象
  ) {
    // 提取可更新的属性
    const updateObj = extractProps(body, [
      'show',
      'order',
      'underline',
      'bold',
      'italic',
    ]);

    // 更新数据库
    const res = await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.CALENDAR_VIEW_COLUMNS,
      updateObj,
      columnId,
    );

    // 更新缓存
    await NocoCache.update(
      `${CacheScope.CALENDAR_VIEW_COLUMN}:${columnId}`,
      updateObj,
    );

    // 清除相关视图的缓存
    {
      const viewCol = await this.get(context, columnId, ncMeta);
      const view = await View.get(context, viewCol.fk_view_id, ncMeta);
      await View.clearSingleQueryCache(context, view.fk_model_id, [view]);
    }

    return res;
  }
}
