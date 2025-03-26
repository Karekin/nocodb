// 导入必要的类型和依赖
import type { BoolType, GridColumnType } from 'nocodb-sdk';  // 导入布尔类型和网格列类型
import type { NcContext } from '~/interface/config';  // 导入NocoDB上下文接口
import type Upgrader from '~/Upgrader';  // 导入升级器类型
import View from '~/models/View';  // 导入视图模型
import Noco from '~/Noco';  // 导入Noco核心类
import { extractProps } from '~/helpers/extractProps';  // 导入属性提取工具
import NocoCache from '~/cache/NocoCache';  // 导入缓存管理器
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';  // 导入缓存相关常量和元数据表枚举

// 网格视图列类，实现GridColumnType接口
export default class GridViewColumn implements GridColumnType {
  id: string;  // 列唯一标识符
  show: BoolType;  // 是否显示该列
  order: number;  // 列的排序顺序
  width?: string;  // 列宽度

  fk_view_id: string;  // 关联的视图ID
  fk_column_id: string;  // 关联的列ID
  fk_workspace_id?: string;  // 关联的工作区ID
  base_id?: string;  // 基础ID
  source_id?: string;  // 源ID

  group_by?: BoolType;  // 是否按此列分组
  group_by_order?: number;  // 分组顺序
  group_by_sort?: string;  // 分组排序方式

  aggregation?: string;  // 聚合函数

  // 构造函数，接收GridViewColumn类型的数据并赋值给当前实例
  constructor(data: GridViewColumn) {
    Object.assign(this, data);
  }

  /**
   * 列出指定视图ID下的所有网格视图列
   * @param context NocoDB上下文
   * @param viewId 视图ID
   * @param ncMeta 元数据访问对象，默认使用Noco.ncMeta
   * @returns 返回GridViewColumn数组
   */
  public static async list(
    context: NcContext,
    viewId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<GridViewColumn[]> {
    // 尝试从缓存获取列表
    const cachedList = await NocoCache.getList(CacheScope.GRID_VIEW_COLUMN, [
      viewId,
    ]);
    let { list: views } = cachedList;
    const { isNoneList } = cachedList;
    // 如果缓存中没有数据，则从数据库获取
    if (!isNoneList && !views.length) {
      views = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.GRID_VIEW_COLUMNS,
        {
          condition: {
            fk_view_id: viewId,
          },
          orderBy: {
            order: 'asc',
          },
        },
      );
      // 将获取的数据存入缓存
      await NocoCache.setList(CacheScope.GRID_VIEW_COLUMN, [viewId], views);
    }
    // 按order字段排序，null值视为Infinity（排在最后）
    views.sort(
      (a, b) =>
        (a.order != null ? a.order : Infinity) -
        (b.order != null ? b.order : Infinity),
    );
    // 将每个视图对象转换为GridViewColumn实例并返回
    return views?.map((v) => new GridViewColumn(v));
  }

  /**
   * 获取指定ID的网格视图列
   * @param context NocoDB上下文
   * @param gridViewColumnId 网格视图列ID
   * @param ncMeta 元数据访问对象，默认使用Noco.ncMeta
   * @returns 返回GridViewColumn实例或null
   */
  public static async get(
    context: NcContext,
    gridViewColumnId: string,
    ncMeta = Noco.ncMeta,
  ) {
    // 尝试从缓存获取
    let viewColumn =
      gridViewColumnId &&
      (await NocoCache.get(
        `${CacheScope.GRID_VIEW_COLUMN}:${gridViewColumnId}`,
        CacheGetType.TYPE_OBJECT,
      ));
    // 如果缓存中没有，则从数据库获取
    if (!viewColumn) {
      viewColumn = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.GRID_VIEW_COLUMNS,
        gridViewColumnId,
      );
      // 如果找到了数据，则存入缓存
      if (viewColumn) {
        await NocoCache.set(
          `${CacheScope.GRID_VIEW_COLUMN}:${gridViewColumnId}`,
          viewColumn,
        );
      }
    }
    // 如果找到数据，则返回GridViewColumn实例，否则返回null
    return viewColumn && new GridViewColumn(viewColumn);
  }

  /**
   * 插入新的网格视图列
   * @param context NocoDB上下文
   * @param column 要插入的列数据
   * @param ncMeta 元数据访问对象，默认使用Noco.ncMeta
   * @returns 返回插入后的GridViewColumn实例
   */
  static async insert(
    context: NcContext,
    column: Partial<GridViewColumn>,
    ncMeta = Noco.ncMeta,
  ) {
    // 提取需要插入的属性
    const insertObj = extractProps(column, [
      'fk_view_id',
      'fk_column_id',
      'show',
      'base_id',
      'source_id',
      'order',
      'width',
      'group_by',
      'group_by_order',
      'group_by_sort',
    ]);

    // 设置列顺序，如果未提供则获取下一个可用顺序
    insertObj.order =
      column?.order ??
      (await ncMeta.metaGetNextOrder(MetaTable.GRID_VIEW_COLUMNS, {
        fk_view_id: column.fk_view_id,
      }));

    // 如果未提供source_id，则从关联的视图获取
    if (!insertObj.source_id) {
      const viewRef = await View.get(context, insertObj.fk_view_id, ncMeta);
      insertObj.source_id = viewRef.source_id;
    }

    // 设置默认列宽度
    insertObj.width = column?.width ?? '180px';

    // 执行插入操作
    const { id } = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.GRID_VIEW_COLUMNS,
      insertObj,
    );

    // 如果不是在升级模式下，修复主视图列
    if (!(ncMeta as Upgrader).upgrader_mode) {
      // TODO: optimize this function & try to avoid if possible
      await View.fixPVColumnForView(context, column.fk_view_id, ncMeta);
    }

    // 在新增视图列时，清除任何优化的单查询缓存
    {
      const view = await View.get(context, column.fk_view_id, ncMeta);
      await View.clearSingleQueryCache(
        context,
        view.fk_model_id,
        [view],
        ncMeta,
      );
    }

    // 获取插入后的列实例并更新缓存
    return this.get(context, id, ncMeta).then(async (viewColumn) => {
      await NocoCache.appendToList(
        CacheScope.GRID_VIEW_COLUMN,
        [column.fk_view_id],
        `${CacheScope.GRID_VIEW_COLUMN}:${id}`,
      );
      return viewColumn;
    });
  }

  /**
   * 更新网格视图列
   * @param context NocoDB上下文
   * @param columnId 要更新的列ID
   * @param body 更新的数据
   * @param ncMeta 元数据访问对象，默认使用Noco.ncMeta
   * @returns 返回更新结果
   */
  static async update(
    context: NcContext,
    columnId: string,
    body: Partial<GridViewColumn>,
    ncMeta = Noco.ncMeta,
  ) {
    // 提取需要更新的属性
    const updateObj = extractProps(body, [
      'order',
      'show',
      'width',
      'group_by',
      'group_by_order',
      'group_by_sort',
      'aggregation',
    ]);

    // 更新元数据
    const res = await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.GRID_VIEW_COLUMNS,
      updateObj,
      columnId,
    );

    // 更新缓存
    await NocoCache.update(
      `${CacheScope.GRID_VIEW_COLUMN}:${columnId}`,
      updateObj,
    );

    // 在视图列更新时，清除任何优化的单查询缓存
    {
      const gridCol = await this.get(context, columnId, ncMeta);
      const view = await View.get(context, gridCol.fk_view_id, ncMeta);
      await View.clearSingleQueryCache(
        context,
        view.fk_model_id,
        [view],
        ncMeta,
      );
    }

    return res;
  }
}
