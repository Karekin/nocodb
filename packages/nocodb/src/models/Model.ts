import {
  isLinksOrLTAR,
  isVirtualCol,
  ModelTypes,
  UITypes,
  ViewTypes,
} from 'nocodb-sdk';
import dayjs from 'dayjs';
import { Logger } from '@nestjs/common';
import hash from 'object-hash';
import type { NcRequest } from 'nocodb-sdk';
import type { BoolType, TableReqType, TableType } from 'nocodb-sdk';
import type { XKnex } from '~/db/CustomKnex';
import type { LinksColumn, LinkToAnotherRecordColumn } from '~/models/index';
import type { NcContext } from '~/interface/config';
import Hook from '~/models/Hook';
import View from '~/models/View';
import Comment from '~/models/Comment';
import Column from '~/models/Column';
import { extractProps } from '~/helpers/extractProps';
import { sanitize } from '~/helpers/sqlSanitize';
import { NcError } from '~/helpers/catchError';
import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
} from '~/utils/globals';
import NocoCache from '~/cache/NocoCache';
import Noco from '~/Noco';
import { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';
import { FileReference } from '~/models';
import { cleanCommandPaletteCache } from '~/helpers/commandPaletteHelpers';
import {
  parseMetaProp,
  prepareForDb,
  prepareForResponse,
} from '~/utils/modelUtils';
import { Source } from '~/models';

const logger = new Logger('Model');

/**
 * Model 类 - 表示数据库中的表/模型
 * 实现了 TableType 接口
 */
export default class Model implements TableType {
  // 基本属性
  copy_enabled: BoolType; // 是否启用复制功能
  source_id: 'db' | string; // 数据源ID
  deleted: BoolType; // 是否已删除
  enabled: BoolType; // 是否启用
  export_enabled: BoolType; // 是否允许导出
  id: string; // 模型ID
  order: number; // 排序顺序
  parent_id: string; // 父级ID
  password: string; // 密码
  pin: BoolType; // 是否置顶
  fk_workspace_id?: string; // 工作区ID
  base_id: string; // 基础ID
  schema: any; // 数据库模式
  show_all_fields: boolean; // 是否显示所有字段
  tags: string; // 标签
  type: ModelTypes; // 模型类型

  // 表相关属性
  table_name: string; // 表名
  title: string; // 标题
  description?: string; // 描述

  // 多对多关系标记
  mm: BoolType; // 是否为多对多关系表

  // 唯一标识符
  uuid: string; // 通用唯一标识符

  // 关联属性
  columns?: Column[]; // 列列表
  columnsById?: { [id: string]: Column }; // 按ID索引的列映射
  columnsHash?: string; // 列哈希值
  views?: View[]; // 视图列表
  meta?: Record<string, any> | string; // 元数据

  // 同步状态
  synced?: boolean; // 是否已同步

  /**
   * 构造函数
   * @param data 模型数据
   */
  constructor(data: Partial<TableType | Model>) {
    Object.assign(this, data);
  }

  /**
   * 类型转换方法
   * @param data 模型数据
   * @returns 转换后的Model实例
   */
  public static castType(data: Model): Model {
    return data && new Model(data);
  }

  /**
   * 获取模型的列列表
   * @param context 上下文
   * @param ncMeta 元数据服务
   * @param defaultViewId 默认视图ID
   * @param updateColumns 是否更新列
   * @returns 列列表
   */
  public async getColumns(
    context: NcContext,
    ncMeta = Noco.ncMeta,
    defaultViewId = undefined,
    updateColumns = true,
  ): Promise<Column[]> {
    // 获取列列表
    const columns = await Column.list(
      context,
      {
        fk_model_id: this.id,
        fk_default_view_id: defaultViewId,
      },
      ncMeta,
    );

    // 如果不更新列，直接返回
    if (!updateColumns) return columns;

    // 更新实例的列信息
    this.columns = columns;

    // 创建列ID映射
    this.columnsById = this.columns.reduce((agg, c) => {
      agg[c.id] = c;
      return agg;
    }, {});

    return this.columns;
  }

  /**
   * 获取列的哈希值
   * @param context 上下文
   * @param ncMeta 元数据服务
   * @returns 列哈希值
   */
  public async getColumnsHash(
    context: NcContext,
    ncMeta = Noco.ncMeta,
  ): Promise<string> {
    const columns = await this.getColumns(context, ncMeta, undefined, false);
    return (this.columnsHash = hash(columns));
  }

  /**
   * 获取缓存的列列表
   * @param context 上下文
   * @param ncMeta 元数据服务
   * @returns 列列表
   */
  public async getCachedColumns(
    context: NcContext,
    ncMeta = Noco.ncMeta,
  ): Promise<Column[]> {
    if (this.columns) return this.columns;
    return this.getColumns(context, ncMeta);
  }

  /**
   * 获取模型的视图列表
   * @param context 上下文
   * @param force 是否强制刷新
   * @param ncMeta 元数据服务
   * @returns 视图列表
   */
  public async getViews(
    context: NcContext,
    force = false,
    ncMeta = Noco.ncMeta,
  ): Promise<View[]> {
    this.views = await View.listWithInfo(context, this.id, ncMeta);
    return this.views;
  }

  /**
   * 获取主键列
   * @returns 主键列
   */
  public get primaryKey(): Column {
    if (!this.columns) return null;
    // 返回第一个自增或自动生成的列
    // 如果没有找到，返回第一个主键列
    return (
      this.columns.find((c) => c.pk && (c.ai || c.meta?.ag)) ||
      this.columns?.find((c) => c.pk)
    );
  }

  /**
   * 获取所有主键列
   * @returns 主键列列表
   */
  public get primaryKeys(): Column[] {
    if (!this.columns) return null;
    return this.columns?.filter((c) => c.pk);
  }

  /**
   * 获取显示值列
   * 如果没有标记为显示值的列，则获取主键后的第一列
   * 如果是多对多表，则返回第一列
   * @returns 显示值列
   */
  public get displayValue(): Column {
    if (!this.columns) return null;
    const pCol = this.columns?.find((c) => c.pv);
    if (pCol) return pCol;
    if (this.mm) {
      // 多对多表默认没有默认值，使用第一列
      return this.columns[0];
    }
    const pkIndex = this.columns.indexOf(this.primaryKey);
    if (pkIndex < this.columns.length - 1) return this.columns[pkIndex + 1];
    return this.columns[0];
  }

  /**
   * 插入新模型
   * @param context 上下文
   * @param baseId 基础ID
   * @param sourceId 数据源ID
   * @param model 模型数据
   * @param ncMeta 元数据服务
   * @returns 新创建的模型
   */
  public static async insert(
    context: NcContext,
    baseId,
    sourceId,
    model: Partial<TableReqType> & {
      mm?: BoolType;
      type?: ModelTypes;
      source_id?: string;
      user_id: string;
    },
    ncMeta = Noco.ncMeta,
  ) {
    // 提取模型属性
    const insertObj = extractProps(model, [
      'table_name',
      'title',
      'description',
      'mm',
      'order',
      'type',
      'id',
      'meta',
      'synced',
    ]);

    // 设置多对多标记
    insertObj.mm = !!insertObj.mm;

    // 设置排序顺序
    if (!insertObj.order) {
      insertObj.order = await ncMeta.metaGetNextOrder(
        MetaTable.FORM_VIEW_COLUMNS,
        {
          base_id: baseId,
          source_id: sourceId,
        },
      );
    }

    // 设置模型类型
    if (!insertObj.type) {
      insertObj.type = ModelTypes.TABLE;
    }

    // 设置数据源ID
    insertObj.source_id = sourceId;

    // 插入模型数据
    const { id } = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.MODELS,
      insertObj,
    );

    // 批量插入列
    const insertedColumns = await Column.bulkInsert(
      context,
      {
        columns: (model?.columns || []) as Column[],
        fk_model_id: id,
        source_id: sourceId,
        base_id: baseId,
      },
      ncMeta,
    );

    // 插入默认视图
    await View.insertMetaOnly(
      context,
      {
        view: {
          fk_model_id: id,
          title: model.title || model.table_name,
          is_default: true,
          type: ViewTypes.GRID,
          base_id: baseId,
          source_id: sourceId,
          created_by: model.user_id,
          owned_by: model.user_id,
        },
        model: {
          getColumns: async () => insertedColumns,
        },
        req: { user: {} } as unknown as NcRequest,
      },
      ncMeta,
    );

    // 获取创建的模型
    const modelRes = await this.getWithInfo(context, { id }, ncMeta);

    // 更新缓存
    if (sourceId) {
      await NocoCache.appendToList(
        CacheScope.MODEL,
        [baseId, sourceId],
        `${CacheScope.MODEL}:${id}`,
      );
    }
    await NocoCache.appendToList(
      CacheScope.MODEL,
      [baseId],
      `${CacheScope.MODEL}:${id}`,
    );

    // 清理命令面板缓存
    cleanCommandPaletteCache(context.workspace_id).catch(() => {
      logger.error('Failed to clean command palette cache');
    });

    return modelRes;
  }

  /**
   * 获取模型列表
   * @param context 上下文
   * @param param 查询参数
   * @param ncMeta 元数据服务
   * @returns 模型列表
   */
  public static async list(
    context: NcContext,
    {
      base_id,
      source_id,
    }: {
      base_id: string;
      source_id: string;
    },
    ncMeta = Noco.ncMeta,
  ): Promise<Model[]> {
    // 从缓存获取模型列表
    const cachedList = await NocoCache.getList(CacheScope.MODEL, [
      base_id,
      source_id,
    ]);
    let { list: modelList } = cachedList;
    const { isNoneList } = cachedList;

    // 如果缓存中没有数据，从数据库获取
    if (!isNoneList && !modelList.length) {
      modelList = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.MODELS,
        {
          orderBy: {
            order: 'asc',
          },
          ...(source_id ? { condition: { source_id } } : {}),
        },
      );

      // 解析每个模型的元数据
      for (const model of modelList) {
        model.meta = parseMetaProp(model);
      }

      // 更新缓存
      if (source_id) {
        await NocoCache.setList(
          CacheScope.MODEL,
          [base_id, source_id],
          modelList,
        );
      } else {
        await NocoCache.setList(CacheScope.MODEL, [base_id], modelList);
      }
    }

    // 按顺序排序
    modelList.sort(
      (a, b) =>
        (a.order != null ? a.order : Infinity) -
        (b.order != null ? b.order : Infinity),
    );

    // 更新非默认视图计数
    for (const model of modelList) {
      if (model.meta?.hasNonDefaultViews === undefined) {
        model.meta = {
          ...(model.meta ?? {}),
          hasNonDefaultViews: await Model.getNonDefaultViewsCountAndReset(
            context,
            { modelId: model.id },
            ncMeta,
          ),
        };
      }
    }

    return modelList.map((m) => this.castType(m));
  }

  /**
   * 获取带详细信息的模型列表
   * @param context 上下文
   * @param param 查询参数
   * @param ncMeta 元数据服务
   * @returns 模型列表
   */
  public static async listWithInfo(
    context: NcContext,
    {
      base_id,
      db_alias,
    }: {
      base_id: string;
      db_alias: string;
    },
    ncMeta = Noco.ncMeta,
  ): Promise<Model[]> {
    // 从缓存获取模型列表
    const cachedList = await NocoCache.getList(CacheScope.MODEL, [
      base_id,
      db_alias,
    ]);
    let { list: modelList } = cachedList;
    const { isNoneList } = cachedList;

    // 如果缓存中没有数据，从数据库获取
    if (!isNoneList && !modelList.length) {
      modelList = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.MODELS,
      );

      // 解析每个模型的元数据
      for (const model of modelList) {
        model.meta = parseMetaProp(model);
      }

      // 更新缓存
      await NocoCache.setList(CacheScope.MODEL, [base_id], modelList);
    }

    // 更新非默认视图计数
    for (const model of modelList) {
      if (model.meta?.hasNonDefaultViews === undefined) {
        model.meta = {
          ...(model.meta ?? {}),
          hasNonDefaultViews: await Model.getNonDefaultViewsCountAndReset(
            context,
            { modelId: model.id },
            ncMeta,
          ),
        };
      }
    }

    return modelList.map((m) => this.castType(m));
  }

  /**
   * 获取单个模型
   * @param context 上下文
   * @param id 模型ID
   * @param ncMeta 元数据服务
   * @returns 模型实例
   */
  public static async get(
    context: NcContext,
    id: string,
    ncMeta = Noco.ncMeta,
  ): Promise<Model> {
    // 从缓存获取模型数据
    let modelData =
      id &&
      (await NocoCache.get(
        `${CacheScope.MODEL}:${id}`,
        CacheGetType.TYPE_OBJECT,
      ));

    // 如果缓存中没有，从数据库获取
    if (!modelData) {
      modelData = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.MODELS,
        id,
      );

      if (modelData) {
        modelData.meta = parseMetaProp(modelData);
        await NocoCache.set(`${CacheScope.MODEL}:${modelData.id}`, modelData);
      }
    }

    return this.castType(modelData);
  }

  /**
   * 根据ID或名称获取模型
   * @param context 上下文
   * @param args 查询参数
   * @param ncMeta 元数据服务
   * @returns 模型实例
   */
  public static async getByIdOrName(
    context: NcContext,
    args:
      | {
          base_id: string;
          source_id: string;
          table_name: string;
        }
      | {
          id?: string;
        },
    ncMeta = Noco.ncMeta,
  ): Promise<Model> {
    const k = 'id' in args ? args?.id : args;
    
    // 从缓存获取模型数据
    let modelData =
      k &&
      (await NocoCache.get(
        `${CacheScope.MODEL}:${k}`,
        CacheGetType.TYPE_OBJECT,
      ));

    // 如果缓存中没有，从数据库获取
    if (!modelData) {
      modelData = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.MODELS,
        k,
      );
      if (modelData) {
        modelData.meta = parseMetaProp(modelData);
      }
    }

    // 更新缓存并返回模型实例
    if (modelData) {
      modelData.meta = parseMetaProp(modelData);
      await NocoCache.set(`${CacheScope.MODEL}:${modelData.id}`, modelData);
      return this.castType(modelData);
    }
    return null;
  }

  /**
   * 获取带详细信息的模型
   * @param context 上下文
   * @param param 查询参数
   * @param ncMeta 元数据服务
   * @returns 模型实例
   */
  public static async getWithInfo(
    context: NcContext,
    {
      table_name,
      id,
    }: {
      table_name?: string;
      id?: string;
    },
    ncMeta = Noco.ncMeta,
  ): Promise<Model> {
    // 从缓存获取模型数据
    let modelData =
      id &&
      (await NocoCache.get(
        `${CacheScope.MODEL}:${id}`,
        CacheGetType.TYPE_OBJECT,
      ));

    // 如果缓存中没有，从数据库获取
    if (!modelData) {
      modelData = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.MODELS,
        id || {
          table_name,
        },
      );
      if (modelData) {
        modelData.meta = parseMetaProp(modelData);
        await NocoCache.set(`${CacheScope.MODEL}:${modelData.id}`, modelData);
      }
    }

    // 如果找到模型数据，加载详细信息
    if (modelData) {
      const m = this.castType(modelData);

      // 加载视图
      await m.getViews(context, false, ncMeta);

      // 获取默认视图ID
      const defaultViewId = m.views.find((view) => view.is_default).id;

      // 加载列信息
      await m.getColumns(context, ncMeta, defaultViewId);

      // 计算列哈希值
      await m.getColumnsHash(context, ncMeta);

      return m;
    }
    return null;
  }

  /**
   * 获取基础SQL模型
   * @param context 上下文
   * @param args 参数
   * @param ncMeta 元数据服务
   * @returns SQL模型实例
   */
  public static async getBaseModelSQL(
    context: NcContext,
    args: {
      id?: string;
      viewId?: string;
      dbDriver: XKnex;
      model?: Model;
      extractDefaultView?: boolean;
      source?: Source;
    },
    ncMeta = Noco.ncMeta,
  ): Promise<BaseModelSqlv2> {
    // 获取模型和数据源
    const model = args?.model || (await this.get(context, args.id, ncMeta));
    const source =
      args.source ||
      (await Source.get(context, model.source_id, false, ncMeta));

    // 获取默认视图ID
    if (!args?.viewId && args.extractDefaultView) {
      const view = await View.getDefaultView(context, model.id, ncMeta);
      args.viewId = view.id;
    }

    // 获取数据库模式
    let schema: string;
    if (source?.isMeta(true, 1)) {
      schema = source.getConfig()?.schema;
    } else if (source?.type === 'pg') {
      schema = source.getConfig()?.searchPath?.[0];
    }

    // 创建并返回SQL模型实例
    return new BaseModelSqlv2({
      context,
      dbDriver: args.dbDriver,
      viewId: args.viewId,
      model,
      schema,
    });
  }

  /**
   * 删除模型
   * @param context 上下文
   * @param ncMeta 元数据服务
   * @param force 是否强制删除
   * @returns 是否删除成功
   */
  async delete(
    context: NcContext,
    ncMeta = Noco.ncMeta,
    force = false,
  ): Promise<boolean> {
    // 删除模型注释
    await Comment.deleteModelComments(context, this.id, ncMeta);

    // 删除所有视图
    for (const view of await this.getViews(context, true, ncMeta)) {
      await view.delete(context, ncMeta);
    }

    // 删除关联的钩子
    for (const hook of await Hook.list(
      context,
      { fk_model_id: this.id },
      ncMeta,
    )) {
      await Hook.delete(context, hook.id, ncMeta);
    }

    // 删除所有列
    for (const col of await this.getColumns(context, ncMeta)) {
      let colOptionTableName = null;
      let cacheScopeName = null;

      // 根据列类型确定要删除的表和缓存范围
      switch (col.uidt) {
        case UITypes.Rollup:
          colOptionTableName = MetaTable.COL_ROLLUP;
          cacheScopeName = CacheScope.COL_ROLLUP;
          break;
        case UITypes.Lookup:
          colOptionTableName = MetaTable.COL_LOOKUP;
          cacheScopeName = CacheScope.COL_LOOKUP;
          break;
        case UITypes.ForeignKey:
        case UITypes.LinkToAnotherRecord:
          colOptionTableName = MetaTable.COL_RELATIONS;
          cacheScopeName = CacheScope.COL_RELATION;
          break;
        case UITypes.MultiSelect:
        case UITypes.SingleSelect:
          colOptionTableName = MetaTable.COL_SELECT_OPTIONS;
          cacheScopeName = CacheScope.COL_SELECT_OPTION;
          break;
        case UITypes.Formula:
          colOptionTableName = MetaTable.COL_FORMULA;
          cacheScopeName = CacheScope.COL_FORMULA;
          break;
        case UITypes.QrCode:
          colOptionTableName = MetaTable.COL_QRCODE;
          cacheScopeName = CacheScope.COL_QRCODE;
          break;
        case UITypes.Barcode:
          colOptionTableName = MetaTable.COL_BARCODE;
          cacheScopeName = CacheScope.COL_BARCODE;
          break;
      }

      // 删除列选项
      if (colOptionTableName && cacheScopeName) {
        await ncMeta.metaDelete(
          context.workspace_id,
          context.base_id,
          colOptionTableName,
          {
            fk_column_id: col.id,
          },
        );
        await NocoCache.deepDel(
          `${cacheScopeName}:${col.id}`,
          CacheDelDirection.CHILD_TO_PARENT,
        );
      }
    }

    // 强制删除时处理剩余的关系列
    if (force) {
      const leftOverColumns = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.COL_RELATIONS,
        {
          condition: {
            fk_related_model_id: this.id,
          },
        },
      );

      for (const col of leftOverColumns) {
        await NocoCache.deepDel(
          `${CacheScope.COL_RELATION}:${col.fk_column_id}`,
          CacheDelDirection.CHILD_TO_PARENT,
        );
      }

      await ncMeta.metaDelete(
        context.workspace_id,
        context.base_id,
        MetaTable.COL_RELATIONS,
        {
          fk_related_model_id: this.id,
        },
      );
    }

    // 删除列缓存和列数据
    await NocoCache.deepDel(
      `${CacheScope.COLUMN}:${this.id}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );
    await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.COLUMNS,
      {
        fk_model_id: this.id,
      },
    );

    // 删除文件引用
    await FileReference.bulkDelete(context, { fk_model_id: this.id }, ncMeta);

    // 删除模型缓存和模型数据
    await NocoCache.deepDel(
      `${CacheScope.MODEL}:${this.id}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );
    await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.MODELS,
      this.id,
    );

    // 删除别名缓存
    await NocoCache.del([
      `${CacheScope.MODEL_ALIAS}:${this.base_id}:${this.id}`,
      `${CacheScope.MODEL_ALIAS}:${this.base_id}:${this.source_id}:${this.id}`,
      `${CacheScope.MODEL_ALIAS}:${this.base_id}:${this.title}`,
      `${CacheScope.MODEL_ALIAS}:${this.base_id}:${this.source_id}:${this.title}`,
    ]);

    // 清理命令面板缓存
    cleanCommandPaletteCache(context.workspace_id).catch(() => {
      logger.error('Failed to clean command palette cache');
    });

    return true;
  }

  /**
   * 将别名映射到列
   * @param context 上下文
   * @param data 数据对象
   * @param clientMeta 客户端元数据
   * @param knex 数据库连接
   * @param columns 列列表
   * @returns 映射后的对象
   */
  async mapAliasToColumn(
    context: NcContext,
    data,
    clientMeta = {
      isMySQL: false,
      isSqlite: false,
      isMssql: false,
      isPg: false,
    },
    knex,
    columns?: Column[],
  ) {
    const insertObj = {};

    // 遍历所有列进行映射
    for (const col of columns || (await this.getColumns(context))) {
      if (isVirtualCol(col)) continue;

      // 获取列值
      let val =
        data?.[col.column_name] !== undefined
          ? data?.[col.column_name]
          : data?.[col.title];

      if (val !== undefined) {
        // 处理附件类型
        if (col.uidt === UITypes.Attachment && typeof val !== 'string') {
          val = JSON.stringify(val);
        }

        // 处理日期时间类型
        if (col.uidt === UITypes.DateTime && dayjs(val).isValid()) {
          const { isMySQL, isSqlite, isMssql, isPg } = clientMeta;

          // 处理时区
          if (
            val.indexOf('-') < 0 &&
            val.indexOf('+') < 0 &&
            val.slice(-1) !== 'Z'
          ) {
            val += '+00:00';
          }

          // 根据不同数据库类型处理日期时间
          if (isMySQL) {
            val = knex.raw(`CONVERT_TZ(?, '+00:00', @@GLOBAL.time_zone)`, [
              dayjs(val).utc().format('YYYY-MM-DD HH:mm:ss'),
            ]);
          } else if (isSqlite) {
            val = dayjs(val).utc().format('YYYY-MM-DD HH:mm:ssZ');
          } else if (isPg) {
            val = knex.raw(`? AT TIME ZONE CURRENT_SETTING('timezone')`, [
              dayjs(val).utc().format('YYYY-MM-DD HH:mm:ssZ'),
            ]);
          } else if (isMssql) {
            val = knex.raw(
              `SWITCHOFFSET(CONVERT(datetimeoffset, ?), DATENAME(TzOffset, SYSDATETIMEOFFSET()))`,
              [dayjs(val).utc().format('YYYY-MM-DD HH:mm:ssZ')],
            );
          } else {
            val = dayjs(val).utc().format('YYYY-MM-DD HH:mm:ssZ');
          }
        }

        // 设置列值
        insertObj[sanitize(col.column_name)] = val;

        // 处理PostgreSQL的bytea类型
        if (clientMeta.isPg && col.dt === 'bytea') {
          insertObj[sanitize(col.column_name)] = knex.raw(
            `decode(?, '${col.meta?.format === 'hex' ? 'hex' : 'escape'}')`,
            [
              col.meta?.format === 'hex' && (val + '').length % 2 === 1
                ? '0' + val
                : val,
            ],
          );
        }
      }
    }

    return insertObj;
  }

  /**
   * 将列映射到别名
   * @param context 上下文
   * @param data 数据对象
   * @param columns 列列表
   * @returns 映射后的对象
   */
  async mapColumnToAlias(context: NcContext, data, columns?: Column[]) {
    const res = {};

    // 遍历所有列进行映射
    for (const col of columns || (await this.getColumns(context))) {
      if (isVirtualCol(col)) continue;

      // 获取列值
      let val =
        data?.[col.title] !== undefined
          ? data?.[col.title]
          : data?.[col.column_name];

      if (val !== undefined) {
        // 处理附件类型
        if (col.uidt === UITypes.Attachment && typeof val !== 'string') {
          val = JSON.stringify(val);
        }

        // 设置列值
        res[sanitize(col.title)] = val;
      }
    }

    return res;
  }

  /**
   * 更新模型别名和表名
   * @param context 上下文
   * @param tableId 表ID
   * @param title 标题
   * @param table_name 表名
   * @param ncMeta 元数据服务
   * @returns 更新结果
   */
  static async updateAliasAndTableName(
    context: NcContext,
    tableId,
    title: string,
    table_name: string,
    ncMeta = Noco.ncMeta,
  ) {
    // 验证参数
    if (!title) {
      NcError.badRequest("Missing 'title' property in body");
    }
    if (!table_name) {
      NcError.badRequest("Missing 'table_name' property in body");
    }

    // 获取旧模型
    const oldModel = await this.get(context, tableId, ncMeta);

    // 更新模型数据
    const res = await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.MODELS,
      {
        title,
        table_name,
      },
      tableId,
    );

    // 更新默认视图
    {
      const defaultView = await View.getDefaultView(context, tableId, ncMeta);
      if (defaultView) {
        await View.update(context, defaultView.id, {
          title,
        });
      }
    }

    // 更新缓存
    await NocoCache.update(`${CacheScope.MODEL}:${tableId}`, {
      title,
      table_name,
    });

    // 删除别名缓存
    await NocoCache.del([
      `${CacheScope.MODEL_ALIAS}:${oldModel.base_id}:${oldModel.id}`,
      `${CacheScope.MODEL_ALIAS}:${oldModel.base_id}:${oldModel.source_id}:${oldModel.id}`,
      `${CacheScope.MODEL_ALIAS}:${oldModel.base_id}:${oldModel.title}`,
      `${CacheScope.MODEL_ALIAS}:${oldModel.base_id}:${oldModel.source_id}:${oldModel.title}`,
    ]);

    // 清理命令面板缓存
    cleanCommandPaletteCache(context.workspace_id).catch(() => {
      logger.error('Failed to clean command palette cache');
    });

    // 清除查询缓存
    await View.clearSingleQueryCache(context, tableId, null, ncMeta);

    // 清除关联模型的查询缓存
    for (const col of await this.get(context, tableId).then((t) =>
      t.getColumns(context),
    )) {
      if (!isLinksOrLTAR(col)) continue;

      const colOptions = await col.getColOptions<LinkToAnotherRecordColumn>(
        context,
        ncMeta,
      );

      if (colOptions.fk_related_model_id === tableId) continue;

      await View.clearSingleQueryCache(
        context,
        colOptions.fk_related_model_id,
        null,
        ncMeta,
      );
    }

    return res;
  }

  /**
   * 标记为多对多表
   * @param context 上下文
   * @param tableId 表ID
   * @param isMm 是否为多对多表
   * @param ncMeta 元数据服务
   * @returns 更新结果
   */
  static async markAsMmTable(
    context: NcContext,
    tableId,
    isMm = true,
    ncMeta = Noco.ncMeta,
  ) {
    // 更新模型数据
    const res = await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.MODELS,
      {
        mm: isMm,
      },
      tableId,
    );

    // 更新缓存
    await NocoCache.update(`${CacheScope.MODEL}:${tableId}`, {
      mm: isMm,
    });

    return res;
  }

  /**
   * 获取别名到列的映射
   * @param context 上下文
   * @returns 映射对象
   */
  async getAliasColMapping(context: NcContext) {
    return (await this.getColumns(context)).reduce((o, c) => {
      if (c.column_name) {
        o[c.title] = c.column_name;
      }
      return o;
    }, {});
  }

  /**
   * 获取列到别名的映射
   * @param context 上下文
   * @returns 映射对象
   */
  async getColAliasMapping(context: NcContext) {
    return (await this.getColumns(context)).reduce((o, c) => {
      if (c.column_name) {
        o[c.column_name] = c.title;
      }
      return o;
    }, {});
  }

  /**
   * 更新模型顺序
   * @param context 上下文
   * @param tableId 表ID
   * @param order 顺序
   * @param ncMeta 元数据服务
   * @returns 更新结果
   */
  static async updateOrder(
    context: NcContext,
    tableId: string,
    order: number,
    ncMeta = Noco.ncMeta,
  ) {
    // 更新模型数据
    const res = await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.MODELS,
      {
        order,
      },
      tableId,
    );

    // 更新缓存
    await NocoCache.update(`${CacheScope.MODEL}:${tableId}`, {
      order,
    });

    return res;
  }

  /**
   * 更新主键列
   * @param context 上下文
   * @param tableId 表ID
   * @param columnId 列ID
   * @param ncMeta 元数据服务
   * @returns 是否更新成功
   */
  static async updatePrimaryColumn(
    context: NcContext,
    tableId: string,
    columnId: string,
    ncMeta = Noco.ncMeta,
  ) {
    // 获取模型和新主键列
    const model = await this.getWithInfo(context, { id: tableId }, ncMeta);
    const newPvCol = model.columnsById[columnId];

    if (!newPvCol) NcError.fieldNotFound(columnId);

    // 清除现有主键列
    for (const col of model.columns?.filter((c) => c.pv) || []) {
      // 更新列数据
      await ncMeta.metaUpdate(
        context.workspace_id,
        context.base_id,
        MetaTable.COLUMNS,
        {
          pv: false,
        },
        col.id,
      );

      // 更新缓存
      await NocoCache.update(`${CacheScope.COLUMN}:${col.id}`, {
        pv: false,
      });
    }

    // 设置新的主键列
    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.COLUMNS,
      {
        pv: true,
      },
      newPvCol.id,
    );

    // 更新缓存
    await NocoCache.update(`${CacheScope.COLUMN}:${newPvCol.id}`, {
      pv: true,
    });

    // 更新网格视图列
    const grid_views_with_column = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.GRID_VIEW_COLUMNS,
      {
        condition: {
          fk_column_id: newPvCol.id,
        },
      },
    );

    if (grid_views_with_column.length) {
      for (const gv of grid_views_with_column) {
        await View.fixPVColumnForView(context, gv.fk_view_id, ncMeta);
      }
    }

    // 获取关联模型ID
    const relatedModelIds = new Set<string>();

    // 清除关联视图的查询缓存
    for (const col of model.columns) {
      if (!isLinksOrLTAR(col)) continue;
      const colOptions = await col.getColOptions<
        LinkToAnotherRecordColumn | LinksColumn
      >(context);
      relatedModelIds.add(colOptions?.fk_related_model_id);
    }

    // 清除所有关联模型的查询缓存
    await Promise.all(
      Array.from(relatedModelIds).map(async (modelId: string) => {
        await View.clearSingleQueryCache(context, modelId, null, ncMeta);
      }),
    );

    return true;
  }

  /**
   * 设置为多对多表
   * @param context 上下文
   * @param id 表ID
   * @param ncMeta 元数据服务
   */
  static async setAsMm(context: NcContext, id: any, ncMeta = Noco.ncMeta) {
    // 更新模型数据
    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.MODELS,
      {
        mm: true,
      },
      id,
    );

    // 更新缓存
    await NocoCache.update(`${CacheScope.MODEL}:${id}`, {
      mm: true,
    });
  }

  /**
   * 根据别名或ID获取模型
   * @param context 上下文
   * @param param 查询参数
   * @param ncMeta 元数据服务
   * @returns 模型实例
   */
  static async getByAliasOrId(
    context: NcContext,
    {
      base_id,
      source_id,
      aliasOrId,
    }: {
      base_id: string;
      source_id?: string;
      aliasOrId: string;
    },
    ncMeta = Noco.ncMeta,
  ) {
    // 构建缓存键
    const cacheKey = source_id
      ? `${CacheScope.MODEL_ALIAS}:${base_id}:${source_id}:${aliasOrId}`
      : `${CacheScope.MODEL_ALIAS}:${base_id}:${aliasOrId}`;

    // 从缓存获取模型ID
    const modelId =
      base_id &&
      aliasOrId &&
      (await NocoCache.get(cacheKey, CacheGetType.TYPE_STRING));

    // 如果缓存中没有，从数据库获取
    if (!modelId) {
      const model = source_id
        ? await ncMeta.metaGet2(
            context.workspace_id,
            context.base_id,
            MetaTable.MODELS,
            { base_id, source_id },
            null,
            {
              _or: [
                {
                  id: {
                    eq: aliasOrId,
                  },
                },
                {
                  title: {
                    eq: aliasOrId,
                  },
                },
              ],
            },
          )
        : await ncMeta.metaGet2(
            context.workspace_id,
            context.base_id,
            MetaTable.MODELS,
            { base_id },
            null,
            {
              _or: [
                {
                  id: {
                    eq: aliasOrId,
                  },
                },
                {
                  title: {
                    eq: aliasOrId,
                  },
                },
              ],
            },
          );

      // 更新缓存
      if (model) {
        await NocoCache.set(cacheKey, model.id);
        await NocoCache.set(`${CacheScope.MODEL}:${model.id}`, model);
      }
      return this.castType(model);
    }

    return modelId && this.get(context, modelId);
  }

  /**
   * 检查表名是否可用
   * @param context 上下文
   * @param param 查询参数
   * @param ncMeta 元数据服务
   * @returns 是否可用
   */
  static async checkTitleAvailable(
    context: NcContext,
    {
      table_name,
      source_id,
      exclude_id,
    }: { table_name; base_id; source_id; exclude_id? },
    ncMeta = Noco.ncMeta,
  ) {
    return !(await ncMeta.metaGet2(
      context.workspace_id,
      context.base_id,
      MetaTable.MODELS,
      {
        table_name,
        ...(source_id ? { source_id } : {}),
      },
      null,
      exclude_id && { id: { neq: exclude_id } },
    ));
  }

  /**
   * 检查别名是否可用
   * @param context 上下文
   * @param param 查询参数
   * @param ncMeta 元数据服务
   * @returns 是否可用
   */
  static async checkAliasAvailable(
    context: NcContext,
    {
      title,
      source_id,
      exclude_id,
    }: { title; base_id; source_id; exclude_id? },
    ncMeta = Noco.ncMeta,
  ) {
    return !(await ncMeta.metaGet2(
      context.workspace_id,
      context.base_id,
      MetaTable.MODELS,
      {
        title,
        ...(source_id ? { source_id } : {}),
      },
      null,
      exclude_id && { id: { neq: exclude_id } },
    ));
  }

  /**
   * 获取别名到列对象的映射
   * @param context 上下文
   * @param columns 列列表
   * @returns 映射对象
   */
  async getAliasColObjMap(context: NcContext, columns?: Column[]) {
    return (columns || (await this.getColumns(context))).reduce(
      (sortAgg, c) => ({ ...sortAgg, [c.title]: c }),
      {},
    );
  }

  /**
   * 更新模型元数据
   * @param context 上下文
   * @param tableId 表ID
   * @param model 模型数据
   * @param ncMeta 元数据服务
   * @returns 更新结果
   */
  static async updateMeta(
    context: NcContext,
    tableId: string,
    model: Pick<TableReqType, 'meta' | 'description'>,
    ncMeta = Noco.ncMeta,
  ) {
    // 提取需要更新的属性
    const updateObj = extractProps(model, ['description', 'meta']);

    // 更新模型数据
    const res = await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.MODELS,
      prepareForDb(updateObj),
      tableId,
    );

    // 更新缓存
    await NocoCache.update(
      `${CacheScope.MODEL}:${tableId}`,
      prepareForResponse(updateObj),
    );

    return res;
  }

  /**
   * 获取并重置非默认视图计数
   * @param context 上下文
   * @param param 参数
   * @param ncMeta 元数据服务
   * @returns 是否有非默认视图
   */
  static async getNonDefaultViewsCountAndReset(
    context: NcContext,
    {
      modelId,
      userId: _,
    }: {
      modelId: string;
      userId?: string;
    },
    ncMeta = Noco.ncMeta,
  ) {
    // 获取模型
    const model = await this.get(context, modelId, ncMeta);
    let modelMeta = parseMetaProp(model);

    // 获取视图列表
    const views = await View.list(context, modelId, ncMeta);
    modelMeta = {
      ...(modelMeta ?? {}),
      hasNonDefaultViews: views.length > 1,
    };

    // 更新模型元数据
    await this.updateMeta(context, modelId, { meta: modelMeta }, ncMeta);

    return modelMeta?.hasNonDefaultViews;
  }
}
