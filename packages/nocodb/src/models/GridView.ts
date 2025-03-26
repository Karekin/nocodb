// 导入必要的类型和依赖
import type { GridType, MetaType } from 'nocodb-sdk'; // 导入网格视图类型和元数据类型接口
import type { NcContext } from '~/interface/config'; // 导入NocoDB上下文接口
import GridViewColumn from '~/models/GridViewColumn'; // 导入网格视图列模型
import View from '~/models/View'; // 导入基础视图模型
import Noco from '~/Noco'; // 导入Noco主类
import NocoCache from '~/cache/NocoCache'; // 导入缓存管理类
import { extractProps } from '~/helpers/extractProps'; // 导入属性提取工具函数
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals'; // 导入缓存相关常量和元数据表枚举
import { prepareForDb, prepareForResponse } from '~/utils/modelUtils'; // 导入数据库和响应数据处理工具

/**
 * GridView类 - 实现网格视图功能
 * 实现了GridType接口，用于管理表格形式的数据视图
 */
export default class GridView implements GridType {
  fk_view_id: string; // 关联的视图ID（外键）
  fk_workspace_id?: string; // 关联的工作区ID（外键，可选）
  base_id?: string; // 关联的基础ID（可选）
  source_id?: string; // 数据源ID（可选）
  meta?: MetaType; // 元数据信息（可选）
  row_height?: number; // 行高设置（可选）
  columns?: GridViewColumn[]; // 网格视图列数组（可选）

  /**
   * 构造函数 - 初始化网格视图对象
   * @param data 网格视图数据
   */
  constructor(data: GridView) {
    Object.assign(this, data); // 将传入的数据对象属性复制到当前实例
  }

  /**
   * 获取网格视图的所有列
   * @param context NocoDB上下文
   * @returns 返回网格视图列数组
   */
  async getColumns(context: NcContext): Promise<GridViewColumn[]> {
    return (this.columns = await GridViewColumn.list(context, this.fk_view_id));
  }

  /**
   * 静态方法：根据视图ID获取网格视图
   * @param context NocoDB上下文
   * @param viewId 视图ID
   * @param ncMeta 元数据管理器，默认使用Noco.ncMeta
   * @returns 返回网格视图实例或null
   */
  public static async get(
    context: NcContext,
    viewId: string,
    ncMeta = Noco.ncMeta,
  ) {
    // 尝试从缓存获取视图数据
    let view =
      viewId &&
      (await NocoCache.get(
        `${CacheScope.GRID_VIEW}:${viewId}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!view) {
      // 缓存未命中，从数据库获取
      view = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.GRID_VIEW,
        {
          fk_view_id: viewId,
        },
      );
      // 将获取的数据存入缓存
      await NocoCache.set(`${CacheScope.GRID_VIEW}:${viewId}`, view);
    }

    // 如果找到视图数据，返回新的GridView实例，否则返回null
    return view && new GridView(view);
  }

  /**
   * 静态方法：插入新的网格视图
   * @param context NocoDB上下文
   * @param view 要插入的网格视图数据
   * @param ncMeta 元数据管理器，默认使用Noco.ncMeta
   * @returns 返回插入后的网格视图实例
   */
  static async insert(
    context: NcContext,
    view: Partial<GridView>,
    ncMeta = Noco.ncMeta,
  ) {
    // 提取需要插入的属性
    const insertObj = extractProps(view, [
      'fk_view_id',
      'base_id',
      'source_id',
      'row_height',
    ]);

    // 获取关联的视图引用
    const viewRef = await View.get(context, insertObj.fk_view_id, ncMeta);

    // 如果未提供source_id，则使用关联视图的source_id
    if (!insertObj.source_id) {
      insertObj.source_id = viewRef.source_id;
    }

    // 将数据插入到元数据表中
    await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.GRID_VIEW,
      insertObj,
      true,
    );

    // 返回新插入的网格视图实例
    return this.get(context, view.fk_view_id, ncMeta);
  }

  /**
   * 静态方法：获取网格视图及其相关信息
   * @param context NocoDB上下文
   * @param id 视图ID
   * @param ncMeta 元数据管理器，默认使用Noco.ncMeta
   * @returns 返回网格视图实例
   */
  static async getWithInfo(
    context: NcContext,
    id: string,
    ncMeta = Noco.ncMeta,
  ) {
    const view = await this.get(context, id, ncMeta);
    return view;
  }

  /**
   * 静态方法：更新网格视图
   * @param context NocoDB上下文
   * @param viewId 要更新的视图ID
   * @param body 包含更新数据的对象
   * @param ncMeta 元数据管理器，默认使用Noco.ncMeta
   * @returns 返回更新操作的结果
   */
  static async update(
    context: NcContext,
    viewId: string,
    body: Partial<GridView>,
    ncMeta = Noco.ncMeta,
  ) {
    // 提取需要更新的属性
    const updateObj = extractProps(body, ['row_height', 'meta']);

    // 更新元数据表中的记录
    const res = await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.GRID_VIEW,
      prepareForDb(updateObj), // 将数据准备为数据库格式
      {
        fk_view_id: viewId,
      },
    );

    // 更新缓存中的数据
    await NocoCache.update(
      `${CacheScope.GRID_VIEW}:${viewId}`,
      prepareForResponse(updateObj), // 将数据准备为响应格式
    );

    return res; // 返回更新结果
  }
}
