import type { BoolType, KanbanColumnType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import View from '~/models/View';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { extractProps } from '~/helpers/extractProps';
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';

/**
 * Kanban视图列模型类，实现KanbanColumnType接口
 */
export default class KanbanViewColumn implements KanbanColumnType {
  id: string; // 列ID
  title?: string; // 列标题
  show?: BoolType; // 是否显示
  order?: number; // 排序顺序

  fk_view_id: string; // 关联的视图ID
  fk_column_id: string; // 关联的列ID
  fk_workspace_id?: string; // 关联的工作区ID
  base_id?: string; // 关联的基础ID
  source_id?: string; // 数据源ID

  /**
   * 构造函数
   * @param data - KanbanViewColumn类型的数据对象
   */
  constructor(data: KanbanViewColumn) {
    Object.assign(this, data);
  }

  /**
   * 根据ID获取Kanban视图列
   * @param context - NcContext上下文对象
   * @param kanbanViewColumnId - Kanban视图列ID
   * @param ncMeta - NocoDB元数据实例，默认为Noco.ncMeta
   * @returns 返回KanbanViewColumn实例
   */
  public static async get(
    context: NcContext,
    kanbanViewColumnId: string,
    ncMeta = Noco.ncMeta,
  ) {
    // 首先尝试从缓存中获取
    let viewColumn =
      kanbanViewColumnId &&
      (await NocoCache.get(
        `${CacheScope.KANBAN_VIEW_COLUMN}:${kanbanViewColumnId}`,
        CacheGetType.TYPE_OBJECT,
      ));
    // 如果缓存中没有，则从数据库中获取
    if (!viewColumn) {
      viewColumn = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.KANBAN_VIEW_COLUMNS,
        kanbanViewColumnId,
      );
      // 如果从数据库获取到数据，则更新缓存
      if (viewColumn) {
        await NocoCache.set(
          `${CacheScope.KANBAN_VIEW_COLUMN}:${kanbanViewColumnId}`,
          viewColumn,
        );
      }
    }
    // 返回新的KanbanViewColumn实例
    return viewColumn && new KanbanViewColumn(viewColumn);
  }

  /**
   * 插入新的Kanban视图列
   * @param context - NcContext上下文对象
   * @param column - 要插入的列数据
   * @param ncMeta - NocoDB元数据实例，默认为Noco.ncMeta
   * @returns 返回新创建的KanbanViewColumn实例
   */
  static async insert(
    context: NcContext,
    column: Partial<KanbanViewColumn>,
    ncMeta = Noco.ncMeta,
  ) {
    // 提取需要的属性
    const insertObj = extractProps(column, [
      'fk_view_id',
      'fk_column_id',
      'show',
      'base_id',
      'source_id',
    ]);

    // 获取下一个排序值
    insertObj.order = await ncMeta.metaGetNextOrder(
      MetaTable.KANBAN_VIEW_COLUMNS,
      {
        fk_view_id: column.fk_view_id,
      },
    );

    // 如果未提供source_id，则从关联的视图中获取
    if (!insertObj.source_id) {
      const viewRef = await View.get(context, insertObj.fk_view_id, ncMeta);
      insertObj.source_id = viewRef.source_id;
    }

    // 插入数据库
    const { id } = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.KANBAN_VIEW_COLUMNS,
      insertObj,
    );

    // 返回新创建的实例，并更新缓存
    return this.get(context, id, ncMeta).then(async (kanbanViewColumn) => {
      await NocoCache.appendToList(
        CacheScope.KANBAN_VIEW_COLUMN,
        [column.fk_view_id],
        `${CacheScope.KANBAN_VIEW_COLUMN}:${id}`,
      );
      return kanbanViewColumn;
    });
  }

  /**
   * 获取指定视图的所有Kanban视图列
   * @param context - NcContext上下文对象
   * @param viewId - 视图ID
   * @param ncMeta - NocoDB元数据实例，默认为Noco.ncMeta
   * @returns 返回KanbanViewColumn实例数组
   */
  public static async list(
    context: NcContext,
    viewId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<KanbanViewColumn[]> {
    // 首先尝试从缓存中获取列表
    const cachedList = await NocoCache.getList(CacheScope.KANBAN_VIEW_COLUMN, [
      viewId,
    ]);
    let { list: views } = cachedList;
    const { isNoneList } = cachedList;
    // 如果缓存中没有，则从数据库获取
    if (!isNoneList && !views.length) {
      views = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.KANBAN_VIEW_COLUMNS,
        {
          condition: {
            fk_view_id: viewId,
          },
          orderBy: {
            order: 'asc',
          },
        },
      );
      // 更新缓存
      await NocoCache.setList(CacheScope.KANBAN_VIEW_COLUMN, [viewId], views);
    }
    // 按order排序
    views.sort(
      (a, b) =>
        (a.order != null ? a.order : Infinity) -
        (b.order != null ? b.order : Infinity),
    );
    // 返回新的KanbanViewColumn实例数组
    return views?.map((v) => new KanbanViewColumn(v));
  }

  /**
   * 更新Kanban视图列
   * @param context - NcContext上下文对象
   * @param columnId - 要更新的列ID
   * @param body - 更新内容
   * @param ncMeta - NocoDB元数据实例，默认为Noco.ncMeta
   * @returns 返回更新结果
   */
  static async update(
    context: NcContext,
    columnId: string,
    body: Partial<KanbanViewColumn>,
    ncMeta = Noco.ncMeta,
  ) {
    // 提取可更新的属性
    const updateObj = extractProps(body, ['order', 'show']);

    // 更新数据库
    const res = await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.KANBAN_VIEW_COLUMNS,
      updateObj,
      columnId,
    );

    // 更新缓存
    const key = `${CacheScope.KANBAN_VIEW_COLUMN}:${columnId}`;
    await NocoCache.update(key, updateObj);

    // 更新视图列后，清除相关的单查询缓存
    {
      const viewCol = await this.get(context, columnId, ncMeta);
      const view = await View.get(context, viewCol.fk_view_id, ncMeta);
      await View.clearSingleQueryCache(context, view.fk_model_id, [view]);
    }

    return res;
  }
}
