import { UITypes } from 'nocodb-sdk'; // 导入UI类型
import type { BoolType, KanbanType, MetaType } from 'nocodb-sdk'; // 导入类型定义
import type { NcContext } from '~/interface/config'; // 导入上下文类型
import View from '~/models/View'; // 导入View模型
import Noco from '~/Noco'; // 导入Noco核心类
import NocoCache from '~/cache/NocoCache'; // 导入缓存模块
import { extractProps } from '~/helpers/extractProps'; // 导入属性提取工具
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals'; // 导入缓存相关常量
import {
  parseMetaProp,
  prepareForDb,
  prepareForResponse,
  stringifyMetaProp,
} from '~/utils/modelUtils'; // 导入模型工具函数

// 看板视图类，实现KanbanType接口
export default class KanbanView implements KanbanType {
  fk_view_id: string; // 视图ID
  title: string; // 视图标题
  fk_workspace_id?: string; // 工作区ID（可选）
  base_id?: string; // 基础ID（可选）
  source_id?: string; // 数据源ID（可选）
  fk_grp_col_id?: string; // 分组列ID（可选）
  fk_cover_image_col_id?: string; // 封面图片列ID（可选）
  meta?: MetaType; // 元数据（可选）

  // 以下字段目前未使用，暂时保留
  show?: BoolType; // 是否显示
  order?: number; // 排序
  uuid?: string; // 唯一标识符
  public?: BoolType; // 是否公开
  password?: string; // 密码
  show_all_fields?: BoolType; // 是否显示所有字段

  // 构造函数，初始化看板视图
  constructor(data: KanbanView) {
    Object.assign(this, data);
  }

  // 静态方法：根据视图ID获取看板视图
  public static async get(
    context: NcContext,
    viewId: string,
    ncMeta = Noco.ncMeta,
  ) {
    // 首先尝试从缓存中获取
    let view =
      viewId &&
      (await NocoCache.get(
        `${CacheScope.KANBAN_VIEW}:${viewId}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!view) {
      // 如果缓存中没有，则从数据库中获取
      view = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.KANBAN_VIEW,
        {
          fk_view_id: viewId,
        },
      );

      // 准备响应数据
      view = prepareForResponse(view);

      // 将结果存入缓存
      await NocoCache.set(`${CacheScope.KANBAN_VIEW}:${viewId}`, view);
    }

    // 返回看板视图实例
    return view && new KanbanView(view);
  }

  // 静态方法：根据分组列ID获取相关视图
  public static async getViewsByGroupingColId(
    context: NcContext,
    columnId: string,
    ncMeta = Noco.ncMeta,
  ) {
    return await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.KANBAN_VIEW,
      {
        condition: {
          fk_grp_col_id: columnId,
        },
      },
    );
  }

  // 静态方法：插入新的看板视图
  static async insert(
    context: NcContext,
    view: Partial<KanbanView>,
    ncMeta = Noco.ncMeta,
  ) {
    // 获取视图的列信息
    const columns = await View.get(context, view.fk_view_id, ncMeta)
      .then((v) => v?.getModel(context, ncMeta))
      .then((m) => m.getColumns(context, ncMeta));

    // 提取需要插入的属性
    const insertObj = extractProps(view, [
      'base_id',
      'source_id',
      'fk_view_id',
      'fk_grp_col_id',
      'meta',
    ]);

    // 设置封面图片列ID，如果未指定则使用第一个附件类型的列
    insertObj.fk_cover_image_col_id =
      view?.fk_cover_image_col_id !== undefined
        ? view?.fk_cover_image_col_id
        : columns?.find((c) => c.uidt === UITypes.Attachment)?.id;

    // 设置元数据中的封面图片显示方式
    insertObj.meta = {
      fk_cover_image_object_fit:
        parseMetaProp(insertObj)?.fk_cover_image_object_fit || 'fit',
    };

    // 将元数据转换为字符串
    insertObj.meta = stringifyMetaProp(insertObj);

    // 获取视图引用
    const viewRef = await View.get(context, insertObj.fk_view_id, ncMeta);

    // 如果未指定数据源ID，则使用视图引用的数据源ID
    if (!insertObj.source_id) {
      insertObj.source_id = viewRef.source_id;
    }

    // 插入数据到数据库
    await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.KANBAN_VIEW,
      insertObj,
      true,
    );

    // 返回新创建的看板视图
    return this.get(context, view.fk_view_id, ncMeta);
  }

  // 静态方法：更新看板视图
  static async update(
    context: NcContext,
    kanbanId: string,
    body: Partial<KanbanView>,
    ncMeta = Noco.ncMeta,
  ) {
    // 提取需要更新的属性
    const updateObj = extractProps(body, [
      'fk_cover_image_col_id',
      'fk_grp_col_id',
      'meta',
    ]);

    // 更新数据库中的元数据
    const res = await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.KANBAN_VIEW,
      prepareForDb(updateObj),
      {
        fk_view_id: kanbanId,
      },
    );

    // 更新缓存
    await NocoCache.update(
      `${CacheScope.KANBAN_VIEW}:${kanbanId}`,
      prepareForResponse(updateObj),
    );

    // 获取视图实例
    const view = await View.get(context, kanbanId);

    // 更新时清除相关的单查询缓存
    await View.clearSingleQueryCache(
      context,
      view.fk_model_id,
      [{ id: kanbanId }],
      ncMeta,
    );

    // 返回更新结果
    return res;
  }
}
