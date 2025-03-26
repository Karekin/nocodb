import type {
  BoolType,
  FormColumnType,
  MetaType,
  StringOrNullType,
} from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import View from '~/models/View';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { extractProps } from '~/helpers/extractProps';
import { deserializeJSON, serializeJSON } from '~/utils/serialize';
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';
import { prepareForDb, prepareForResponse } from '~/utils/modelUtils';

// 表单视图列模型类，实现FormColumnType接口
export default class FormViewColumn implements FormColumnType {
  id?: string; // 列ID
  fk_view_id?: string; // 关联的视图ID
  fk_column_id?: string; // 关联的列ID
  fk_workspace_id?: string; // 关联的工作区ID
  base_id?: string; // 关联的基表ID
  source_id?: string; // 数据源ID
  label?: StringOrNullType; // 列标签
  help?: StringOrNullType; // 帮助文本
  description?: StringOrNullType; // 描述信息
  required?: BoolType; // 是否必填
  enable_scanner?: BoolType; // 是否启用扫描功能
  uuid?: StringOrNullType; // 唯一标识符
  show?: BoolType; // 是否显示
  order?: number; // 排序顺序
  meta?: MetaType; // 元数据

  // 构造函数，使用传入的数据初始化对象
  constructor(data: FormViewColumn) {
    Object.assign(this, data);
  }

  // 静态方法：根据ID获取表单视图列
  public static async get(
    context: NcContext,
    formViewColumnId: string,
    ncMeta = Noco.ncMeta,
  ) {
    // 首先尝试从缓存中获取
    let viewColumn =
      formViewColumnId &&
      (await NocoCache.get(
        `${CacheScope.FORM_VIEW_COLUMN}:${formViewColumnId}`,
        CacheGetType.TYPE_OBJECT,
      ));
    
    // 如果缓存中没有，则从数据库中获取
    if (!viewColumn) {
      viewColumn = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.FORM_VIEW_COLUMNS,
        formViewColumnId,
      );

      // 如果从数据库获取成功，处理meta字段并更新缓存
      if (viewColumn) {
        viewColumn.meta =
          viewColumn.meta && typeof viewColumn.meta === 'string'
            ? JSON.parse(viewColumn.meta)
            : viewColumn.meta;

        await NocoCache.set(
          `${CacheScope.FORM_VIEW_COLUMN}:${formViewColumnId}`,
          viewColumn,
        );
      }
    }

    // 返回FormViewColumn实例
    return viewColumn && new FormViewColumn(viewColumn);
  }

  // 静态方法：插入新的表单视图列
  static async insert(
    context: NcContext,
    column: Partial<FormViewColumn>,
    ncMeta = Noco.ncMeta,
  ) {
    // 提取需要的属性
    const insertObj = extractProps(column, [
      'fk_view_id',
      'fk_column_id',
      'show',
      'base_id',
      'source_id',
      'label',
      'help',
      'description',
      'required',
      'enable_scanner',
      'meta',
    ]);

    // 获取下一个排序值
    insertObj.order = await ncMeta.metaGetNextOrder(
      MetaTable.FORM_VIEW_COLUMNS,
      {
        fk_view_id: insertObj.fk_view_id,
      },
    );

    // 序列化meta字段
    if (insertObj.meta) {
      insertObj.meta = serializeJSON(insertObj.meta);
    }

    // 如果没有source_id，从关联视图中获取
    if (!insertObj.source_id) {
      const viewRef = await View.get(context, insertObj.fk_view_id, ncMeta);
      insertObj.source_id = viewRef.source_id;
    }

    // 插入数据库
    const { id } = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.FORM_VIEW_COLUMNS,
      insertObj,
    );

    // 返回新创建的列并更新缓存
    return this.get(context, id, ncMeta).then(async (viewColumn) => {
      await NocoCache.appendToList(
        CacheScope.FORM_VIEW_COLUMN,
        [column.fk_view_id],
        `${CacheScope.FORM_VIEW_COLUMN}:${id}`,
      );
      return viewColumn;
    });
  }

  // 静态方法：获取指定视图的所有表单视图列
  public static async list(
    context: NcContext,
    viewId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<FormViewColumn[]> {
    // 首先尝试从缓存中获取
    const cachedList = await NocoCache.getList(CacheScope.FORM_VIEW_COLUMN, [
      viewId,
    ]);
    let { list: viewColumns } = cachedList;
    const { isNoneList } = cachedList;
    
    // 如果缓存中没有，则从数据库中获取
    if (!isNoneList && !viewColumns.length) {
      viewColumns = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.FORM_VIEW_COLUMNS,
        {
          condition: {
            fk_view_id: viewId,
          },
          orderBy: {
            order: 'asc',
          },
        },
      );

      // 反序列化meta字段
      for (const viewColumn of viewColumns) {
        viewColumn.meta = deserializeJSON(viewColumn.meta);
      }

      // 更新缓存
      await NocoCache.setList(
        CacheScope.FORM_VIEW_COLUMN,
        [viewId],
        viewColumns,
      );
    }
    
    // 按order字段排序
    viewColumns.sort(
      (a, b) =>
        (a.order != null ? a.order : Infinity) -
        (b.order != null ? b.order : Infinity),
    );
    
    // 返回FormViewColumn实例数组
    return viewColumns?.map((v) => new FormViewColumn(v));
  }

  // 静态方法：更新表单视图列
  static async update(
    context: NcContext,
    columnId: string,
    body: Partial<FormViewColumn>,
    ncMeta = Noco.ncMeta,
  ) {
    // 提取可更新的属性
    const updateObj = extractProps(body, [
      'label',
      'help',
      'description',
      'required',
      'show',
      'order',
      'meta',
      'enable_scanner',
    ]);

    // 更新数据库
    const res = await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.FORM_VIEW_COLUMNS,
      prepareForDb(updateObj),
      columnId,
    );

    // 更新缓存
    await NocoCache.update(
      `${CacheScope.FORM_VIEW_COLUMN}:${columnId}`,
      prepareForResponse(updateObj),
    );

    return res;
  }
}
