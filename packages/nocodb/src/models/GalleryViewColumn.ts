import type { BoolType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import View from '~/models/View';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { extractProps } from '~/helpers/extractProps';
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';

/**
 * 画廊视图列模型类，用于管理画廊视图中的列配置
 */
export default class GalleryViewColumn {
  id: string; // 列ID
  title?: string; // 列标题
  show?: BoolType; // 是否显示列
  order?: number; // 列顺序

  fk_view_id: string; // 关联的视图ID
  fk_column_id: string; // 关联的列ID
  fk_workspace_id?: string; // 关联的工作区ID
  base_id?: string; // 关联的基础ID
  source_id?: string; // 关联的数据源ID

  /**
   * 构造函数
   * @param data 初始化数据
   */
  constructor(data: GalleryViewColumn) {
    Object.assign(this, data);
  }

  /**
   * 根据ID获取画廊视图列
   * @param context 上下文对象
   * @param galleryViewColumnId 画廊视图列ID
   * @param ncMeta NocoDB元数据实例
   * @returns 返回GalleryViewColumn实例
   */
  public static async get(
    context: NcContext,
    galleryViewColumnId: string,
    ncMeta = Noco.ncMeta,
  ) {
    // 首先尝试从缓存中获取
    let viewColumn =
      galleryViewColumnId &&
      (await NocoCache.get(
        `${CacheScope.GALLERY_VIEW_COLUMN}:${galleryViewColumnId}`,
        CacheGetType.TYPE_OBJECT,
      ));
    // 如果缓存中没有，则从数据库中获取
    if (!viewColumn) {
      viewColumn = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.GALLERY_VIEW_COLUMNS,
        galleryViewColumnId,
      );
      // 如果从数据库获取到数据，则更新缓存
      if (viewColumn) {
        await NocoCache.set(
          `${CacheScope.GALLERY_VIEW_COLUMN}:${galleryViewColumnId}`,
          viewColumn,
        );
      }
    }
    // 返回新的GalleryViewColumn实例
    return viewColumn && new GalleryViewColumn(viewColumn);
  }

  /**
   * 插入新的画廊视图列
   * @param context 上下文对象
   * @param column 要插入的列数据
   * @param ncMeta NocoDB元数据实例
   * @returns 返回新创建的GalleryViewColumn实例
   */
  static async insert(
    context: NcContext,
    column: Partial<GalleryViewColumn>,
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
      MetaTable.GALLERY_VIEW_COLUMNS,
      {
        fk_view_id: column.fk_view_id,
      },
    );

    // 如果没有提供source_id，则从关联视图中获取
    if (!insertObj.source_id) {
      const viewRef = await View.get(context, insertObj.fk_view_id, ncMeta);
      insertObj.source_id = viewRef.source_id;
    }

    // 插入新记录到数据库
    const { id } = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.GALLERY_VIEW_COLUMNS,
      insertObj,
    );

    // 清除相关的单查询缓存
    {
      const view = await View.get(context, column.fk_view_id, ncMeta);
      await View.clearSingleQueryCache(
        context,
        view.fk_model_id,
        [view],
        ncMeta,
      );
    }

    // 返回新创建的列实例，并更新缓存列表
    return this.get(context, id, ncMeta).then(async (viewColumn) => {
      await NocoCache.appendToList(
        CacheScope.GALLERY_VIEW_COLUMN,
        [column.fk_view_id],
        `${CacheScope.GALLERY_VIEW_COLUMN}:${id}`,
      );
      return viewColumn;
    });
  }

  /**
   * 获取指定视图的所有画廊视图列
   * @param context 上下文对象
   * @param viewId 视图ID
   * @param ncMeta NocoDB元数据实例
   * @returns 返回GalleryViewColumn实例数组
   */
  public static async list(
    context: NcContext,
    viewId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<GalleryViewColumn[]> {
    // 首先尝试从缓存中获取列表
    const cachedList = await NocoCache.getList(CacheScope.GALLERY_VIEW_COLUMN, [
      viewId,
    ]);
    let { list: views } = cachedList;
    const { isNoneList } = cachedList;
    // 如果缓存中没有有效数据，则从数据库获取
    if (!isNoneList && !views.length) {
      views = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.GALLERY_VIEW_COLUMNS,
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
      await NocoCache.setList(CacheScope.GALLERY_VIEW_COLUMN, [viewId], views);
    }
    // 按order字段排序
    views.sort(
      (a, b) =>
        (a.order != null ? a.order : Infinity) -
        (b.order != null ? b.order : Infinity),
    );
    // 返回GalleryViewColumn实例数组
    return views?.map((v) => new GalleryViewColumn(v));
  }

  /**
   * 更新画廊视图列
   * @param context 上下文对象
   * @param columnId 要更新的列ID
   * @param body 更新数据
   * @param ncMeta NocoDB元数据实例
   * @returns 返回更新结果
   */
  static async update(
    context: NcContext,
    columnId: string,
    body: Partial<GalleryViewColumn>,
    ncMeta = Noco.ncMeta,
  ) {
    // 提取可更新的属性
    const updateObj = extractProps(body, ['order', 'show']);

    // 更新数据库记录
    const res = await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.GALLERY_VIEW_COLUMNS,
      updateObj,
      columnId,
    );

    // 更新缓存
    const key = `${CacheScope.GALLERY_VIEW_COLUMN}:${columnId}`;
    await NocoCache.update(key, updateObj);

    // 清除相关的单查询缓存
    {
      const viewCol = await this.get(context, columnId, ncMeta);
      const view = await View.get(context, viewCol.fk_view_id, ncMeta);
      await View.clearSingleQueryCache(context, view.fk_model_id, [view]);
    }

    return res;
  }
}
