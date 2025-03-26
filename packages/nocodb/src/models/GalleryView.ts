// 导入必要的类型和工具
import { UITypes } from 'nocodb-sdk';
import type {
  BoolType,  // 布尔类型
  GalleryColumnType,  // 画廊列类型
  GalleryType,  // 画廊视图类型
  MetaType,  // 元数据类型
} from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';  // 导入上下文接口
import View from '~/models/View';  // 导入视图模型
import Noco from '~/Noco';  // 导入Noco核心类
import NocoCache from '~/cache/NocoCache';  // 导入缓存工具
import { extractProps } from '~/helpers/extractProps';  // 导入属性提取工具
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';  // 导入缓存和元数据表常量
import {
  parseMetaProp,  // 解析元数据属性
  prepareForDb,  // 为数据库准备数据
  prepareForResponse,  // 为响应准备数据
  stringifyMetaProp,  // 将元数据属性转为字符串
} from '~/utils/modelUtils';

/**
 * 画廊视图类 - 实现GalleryType接口
 * 用于管理和操作画廊视图的数据和行为
 */
export default class GalleryView implements GalleryType {
  fk_view_id?: string;  // 关联视图ID
  deleted?: BoolType;  // 是否已删除
  order?: number;  // 排序顺序
  next_enabled?: BoolType;  // 是否启用下一页
  prev_enabled?: BoolType;  // 是否启用上一页
  cover_image_idx?: number;  // 封面图片索引
  cover_image?: string;  // 封面图片
  restrict_types?: string;  // 限制类型
  restrict_size?: string;  // 限制大小
  restrict_number?: string;  // 限制数量
  public?: BoolType;  // 是否公开
  password?: string;  // 密码保护
  show_all_fields?: BoolType;  // 是否显示所有字段
  fk_cover_image_col_id?: string;  // 封面图片列ID

  fk_workspace_id?: string;  // 工作区ID
  base_id?: string;  // 基础ID
  source_id?: string;  // 源ID

  columns?: GalleryColumnType[];  // 画廊列配置
  meta?: MetaType;  // 元数据

  /**
   * 构造函数 - 初始化画廊视图实例
   * @param data 画廊视图数据
   */
  constructor(data: GalleryView) {
    Object.assign(this, data);
  }

  /**
   * 获取画廊视图
   * @param context 上下文信息
   * @param viewId 视图ID
   * @param ncMeta 元数据管理器，默认使用Noco.ncMeta
   * @returns 返回画廊视图实例或null
   */
  public static async get(
    context: NcContext,
    viewId: string,
    ncMeta = Noco.ncMeta,
  ) {
    // 尝试从缓存获取视图
    let view =
      viewId &&
      (await NocoCache.get(
        `${CacheScope.GALLERY_VIEW}:${viewId}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!view) {
      // 缓存未命中，从数据库获取
      view = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.GALLERY_VIEW,
        {
          fk_view_id: viewId,
        },
      );
      // 设置缓存
      await NocoCache.set(`${CacheScope.GALLERY_VIEW}:${viewId}`, view);
    }

    // 如果找到视图，返回新的GalleryView实例
    return view && new GalleryView(view);
  }

  /**
   * 插入新的画廊视图
   * @param context 上下文信息
   * @param view 要插入的视图数据
   * @param ncMeta 元数据管理器
   * @returns 返回插入后的画廊视图实例
   */
  static async insert(
    context: NcContext,
    view: Partial<GalleryView>,
    ncMeta = Noco.ncMeta,
  ) {
    // 获取关联视图的列信息
    const columns = await View.get(context, view.fk_view_id, ncMeta)
      .then((v) => v?.getModel(context, ncMeta))
      .then((m) => m.getColumns(context, ncMeta));

    // 提取需要插入的属性
    const insertObj = extractProps(view, [
      'base_id',
      'source_id',
      'fk_view_id',
      'next_enabled',
      'prev_enabled',
      'cover_image_idx',
      'cover_image',
      'restrict_types',
      'restrict_size',
      'restrict_number',
      'meta',
    ]);

    // 设置封面图片列ID，如果未指定则查找附件类型的列
    insertObj.fk_cover_image_col_id =
      view?.fk_cover_image_col_id !== undefined
        ? view?.fk_cover_image_col_id
        : columns?.find((c) => c.uidt === UITypes.Attachment)?.id;

    // 设置元数据，包括封面图片适配方式
    insertObj.meta = {
      fk_cover_image_object_fit:
        parseMetaProp(insertObj)?.fk_cover_image_object_fit || 'fit',
    };

    // 将元数据转为字符串
    insertObj.meta = stringifyMetaProp(insertObj);

    // 获取视图引用
    const viewRef = await View.get(context, insertObj.fk_view_id, ncMeta);

    // 如果未指定source_id，则使用视图的source_id
    if (!insertObj.source_id) {
      insertObj.source_id = viewRef.source_id;
    }

    // 执行插入操作
    await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.GALLERY_VIEW,
      insertObj,
      true,
    );

    // 返回插入后的画廊视图
    return this.get(context, view.fk_view_id, ncMeta);
  }

  /**
   * 更新画廊视图
   * @param context 上下文信息
   * @param galleryId 画廊视图ID
   * @param body 要更新的数据
   * @param ncMeta 元数据管理器
   * @returns 返回更新结果
   */
  static async update(
    context: NcContext,
    galleryId: string,
    body: Partial<GalleryView>,
    ncMeta = Noco.ncMeta,
  ) {
    // 提取需要更新的属性
    const updateObj = extractProps(body, ['fk_cover_image_col_id', 'meta']);

    // 更新元数据
    const res = await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.GALLERY_VIEW,
      prepareForDb(updateObj),  // 为数据库准备数据
      {
        fk_view_id: galleryId,
      },
    );

    // 更新缓存
    await NocoCache.update(
      `${CacheScope.GALLERY_VIEW}:${galleryId}`,
      prepareForResponse(updateObj),  // 为响应准备数据
    );

    // 获取视图信息
    const view = await View.get(context, galleryId, ncMeta);

    // 更新时，清除任何优化的单查询缓存
    await View.clearSingleQueryCache(
      context,
      view.fk_model_id,
      [{ id: galleryId }],
      ncMeta,
    );

    // 返回更新结果
    return res;
  }
}
