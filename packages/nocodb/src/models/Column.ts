import {
  AllowedColumnTypesForQrAndBarcodes,
  enumColors,
  isAIPromptCol,
  isLinksOrLTAR,
  LongTextAiMetaProp,
  UITypes,
} from 'nocodb-sdk';
import { Logger } from '@nestjs/common';
import type { MetaService } from 'src/meta/meta.service';
import type { ColumnReqType, ColumnType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import FormulaColumn from '~/models/FormulaColumn';
import LinkToAnotherRecordColumn from '~/models/LinkToAnotherRecordColumn';
import LookupColumn from '~/models/LookupColumn';
import RollupColumn from '~/models/RollupColumn';
import SelectOption from '~/models/SelectOption';
import Model from '~/models/Model';
import View from '~/models/View';
import Sort from '~/models/Sort';
import Filter from '~/models/Filter';
import QrCodeColumn from '~/models/QrCodeColumn';
import BarcodeColumn from '~/models/BarcodeColumn';
import AIColumn from '~/models/AIColumn';
import {
  ButtonColumn,
  FileReference,
  GalleryView,
  KanbanView,
  LinksColumn,
} from '~/models';
import { extractProps } from '~/helpers/extractProps';
import { NcError } from '~/helpers/catchError';
import addFormulaErrorIfMissingColumn from '~/helpers/addFormulaErrorIfMissingColumn';
import Noco from '~/Noco';
import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
} from '~/utils/globals';
import NocoCache from '~/cache/NocoCache';
import {
  parseMetaProp,
  prepareForDb,
  prepareForResponse,
} from '~/utils/modelUtils';
import { getFormulasReferredTheColumn } from '~/helpers/formulaHelpers';

const selectColors = enumColors.light;

const logger = new Logger('Column');

const requiredColumnsToRecreate = {
  [UITypes.LinkToAnotherRecord]: [
    'type',
    'fk_child_column_id',
    'fk_parent_column_id',
    'fk_related_model_id',
  ],
  [UITypes.Links]: [
    'type',
    'fk_child_column_id',
    'fk_parent_column_id',
    'fk_related_model_id',
  ],
  [UITypes.Rollup]: ['fk_relation_column_id', 'fk_rollup_column_id'],
  [UITypes.Lookup]: ['fk_relation_column_id', 'fk_lookup_column_id'],
  [UITypes.QrCode]: ['fk_qr_value_column_id'],
  [UITypes.Barcode]: ['fk_barcode_value_column_id'],
  [UITypes.Button]: ['type', 'label'],
  [UITypes.Formula]: ['formula'],
};

/**
 * Column 类 - 表示数据库中的列
 * 实现了 ColumnType 接口
 */
export default class Column<T = any> implements ColumnType {
  // 列的基本属性
  public fk_model_id: string; // 关联的模型ID
  public fk_workspace_id?: string; // 工作区ID
  public base_id: string; // 基础ID
  public source_id: string; // 源ID

  public column_name: string; // 列名
  public title: string; // 标题
  public description: string; // 描述

  public uidt: UITypes; // UI数据类型
  public dt: string; // 数据类型
  public np: string; // 精度
  public ns: string; // 刻度
  public clen: string; // 字符长度
  public cop: string; // 复制选项
  public pk: boolean; // 是否为主键
  public pv: boolean; // 是否为私有
  public rqd: boolean; // 是否必填
  public un: boolean; // 是否唯一
  public ct: string; // 列类型
  public ai: boolean; // 是否自增
  public unique: boolean; // 是否唯一
  public cdf: string; // 默认值
  public cc: string; // 列约束
  public csn: string; // 列序列名
  public dtx: string; // 数据类型扩展
  public dtxp: string; // 数据类型参数
  public dtxs: string; // 数据类型大小
  public au: boolean; // 是否自动更新
  public system: boolean; // 是否为系统字段

  public colOptions: T; // 列选项
  public model: Model; // 关联的模型

  public order: number; // 排序
  public validate: any; // 验证规则
  public meta: any; // 元数据
  public asId?: string; // 别名ID
  public readonly?: boolean; // 是否只读

  /**
   * 构造函数
   * @param data 列数据
   */
  constructor(data: Partial<(ColumnType & { asId?: string }) | Column>) {
    Object.assign(this, data);
  }

  /**
   * 获取关联的模型
   * @param context 上下文
   * @param ncMeta 元数据服务
   * @returns 模型实例
   */
  public async getModel(
    context: NcContext,
    ncMeta = Noco.ncMeta,
  ): Promise<Model> {
    return Model.getByIdOrName(
      context,
      {
        id: this.fk_model_id,
      },
      ncMeta,
    );
  }

  /**
   * 插入新列
   * @param context 上下文
   * @param column 列数据
   * @param ncMeta 元数据服务
   * @returns 新创建的列
   */
  public static async insert<T>(
    context: NcContext,
    column: Partial<T> & {
      source_id?: string;
      [key: string]: any;
      fk_model_id: string;
      uidt: UITypes | string;
      view_id?: string;
    } & Pick<ColumnReqType, 'column_order'>,
    ncMeta = Noco.ncMeta,
  ) {
    // 验证模型ID是否存在
    if (!column.fk_model_id) NcError.badRequest('Missing model id');

    // 提取列属性
    const insertObj = extractProps(column as any, [
      'id',
      'fk_model_id',
      'column_name',
      'title',
      'uidt',
      'dt',
      'np',
      'ns',
      'clen',
      'cop',
      'pk',
      'rqd',
      'un',
      'ct',
      'ai',
      'unique',
      'cdf',
      'cc',
      'csn',
      'dtx',
      'dtxp',
      'dtxs',
      'au',
      'pv',
      'order',
      'base_id',
      'source_id',
      'system',
      'meta',
      'virtual',
      'description',
      'readonly',
    ]);

    // 设置列名和标题
    if (!insertObj.column_name) {
      insertObj.column_name = column.cn;
    }

    if (!insertObj.title) {
      insertObj.title = column._cn;
    }

    // 处理元数据
    if (insertObj.meta && typeof insertObj.meta === 'object') {
      insertObj.meta = JSON.stringify(insertObj.meta);
    }

    // 设置列顺序
    insertObj.order =
      column.order ??
      (await ncMeta.metaGetNextOrder(MetaTable.COLUMNS, {
        fk_model_id: column.fk_model_id,
      }));

    // 处理验证规则
    if (column.validate) {
      if (typeof column.validate === 'string')
        insertObj.validate = column.validate;
      else insertObj.validate = JSON.stringify(column.validate);
    }

    // 设置源ID
    if (!column.source_id) {
      const model = await Model.getByIdOrName(
        context,
        { id: column.fk_model_id },
        ncMeta,
      );
      insertObj.source_id = model.source_id;
    }

    // 验证UI数据类型
    if (!column.uidt) throw new Error('UI Datatype not found');

    // 插入列数据
    const row = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.COLUMNS,
      insertObj,
    );

    // 获取创建的列
    const col = await this.get(context, { colId: row.id }, ncMeta);

    // 更新缓存
    await NocoCache.appendToList(
      CacheScope.COLUMN,
      [column.fk_model_id],
      `${CacheScope.COLUMN}:${row.id}`,
    );

    // 插入列选项
    await this.insertColOption(context, column, row.id, ncMeta);

    // 将列添加到所有视图中
    await View.insertColumnToAllViews(
      context,
      {
        fk_column_id: row.id,
        fk_model_id: column.fk_model_id,
        column_show: {
          show:
            column.uidt === UITypes.LinkToAnotherRecord ||
            (column.uidt === UITypes.Links &&
              column.type === 'mm' &&
              !column.view_id)
              ? false
              : !column.view_id,
          view_id: column.view_id,
        },
        column_order: column.column_order,
      },
      ncMeta,
    );

    // 清除单查询缓存
    await View.clearSingleQueryCache(context, column.fk_model_id, null, ncMeta);

    return col;
  }

  /**
   * 插入列选项
   * @param context 上下文
   * @param column 列数据
   * @param colId 列ID
   * @param ncMeta 元数据服务
   */
  private static async insertColOption<T>(
    context,
    column: Partial<T> & { source_id?: string; [p: string]: any },
    colId,
    ncMeta = Noco.ncMeta,
  ) {
    // 根据列类型插入不同的列选项
    switch (column.uidt || column.ui_data_type) {
      case UITypes.Lookup: {
        // 插入查找列选项
        await LookupColumn.insert(
          context,
          {
            fk_column_id: colId,
            fk_relation_column_id: column.fk_relation_column_id,
            fk_lookup_column_id: column.fk_lookup_column_id,
          },
          ncMeta,
        );
        break;
      }
      case UITypes.Rollup: {
        // 插入汇总列选项
        await RollupColumn.insert(
          context,
          {
            fk_column_id: colId,
            fk_relation_column_id: column.fk_relation_column_id,
            fk_rollup_column_id: column.fk_rollup_column_id,
            rollup_function: column.rollup_function,
          },
          ncMeta,
        );
        break;
      }
      case UITypes.Links:
      case UITypes.LinkToAnotherRecord: {
        // 插入链接列选项
        await LinkToAnotherRecordColumn.insert(
          context,
          {
            fk_column_id: colId,
            type: column.type,
            fk_child_column_id: column.fk_child_column_id,
            fk_parent_column_id: column.fk_parent_column_id,
            fk_target_view_id: column.fk_target_view_id,
            fk_mm_model_id: column.fk_mm_model_id,
            fk_mm_child_column_id: column.fk_mm_child_column_id,
            fk_mm_parent_column_id: column.fk_mm_parent_column_id,
            ur: column.ur,
            dr: column.dr,
            fk_index_name: column.fk_index_name,
            fk_related_model_id: column.fk_related_model_id,
            virtual: column.virtual,
          },
          ncMeta,
        );
        break;
      }
      case UITypes.QrCode: {
        // 插入二维码列选项
        await QrCodeColumn.insert(
          context,
          {
            fk_column_id: colId,
            fk_qr_value_column_id: column.fk_qr_value_column_id,
          },
          ncMeta,
        );
        break;
      }
      case UITypes.Barcode: {
        // 插入条形码列选项
        await BarcodeColumn.insert(
          context,
          {
            fk_column_id: colId,
            fk_barcode_value_column_id: column.fk_barcode_value_column_id,
            barcode_format: column.barcode_format,
          },
          ncMeta,
        );
        break;
      }
      case UITypes.Button: {
        // 插入按钮列选项
        await ButtonColumn.insert(context, {
          fk_column_id: colId,
          formula: column?.formula,
          formula_raw: column?.formula_raw,
          parsed_tree: column?.parsed_tree,
          error: column?.error,
          icon: column?.icon,
          type: column.type,
          theme: column.theme,
          color: column.color,
          fk_webhook_id: column?.fk_webhook_id,
          fk_script_id: column?.fk_script_id,
          label: column.label,
          fk_integration_id: column.fk_integration_id,
          model: column.model,
          output_column_ids: column.output_column_ids,
        });
        break;
      }
      case UITypes.Formula: {
        // 插入公式列选项
        await FormulaColumn.insert(
          context,
          {
            error: column.error,
            fk_column_id: colId,
            formula: column.formula,
            formula_raw: column.formula_raw,
            parsed_tree: column.parsed_tree,
          },
          ncMeta,
        );
        break;
      }
      case UITypes.MultiSelect: {
        // 插入多选列选项
        if (!column.colOptions?.options) {
          const bulkOptions = [];
          for (const [i, option] of column.dtxp?.split(',').entries() ||
            [].entries()) {
            bulkOptions.push({
              fk_column_id: colId,
              title: option.replace(/^'/, '').replace(/'$/, ''),
              order: i + 1,
              color: selectColors[i % selectColors.length],
            });
          }
          await SelectOption.bulkInsert(context, bulkOptions, ncMeta);
        } else {
          const bulkOptions = [];
          for (const [i, option] of column.colOptions.options.entries() ||
            [].entries()) {
            if (column.dt === 'enum' || column.dt === 'set') {
              option.title = option.title.trimEnd();
            }
            bulkOptions.push({
              color: selectColors[i % selectColors.length],
              ...option,
              fk_column_id: colId,
              order: i + 1,
            });
          }
          await SelectOption.bulkInsert(context, bulkOptions, ncMeta);
        }
        break;
      }
      case UITypes.SingleSelect: {
        // 插入单选列选项
        if (!column.colOptions?.options) {
          const bulkOptions = [];
          for (const [i, option] of column.dtxp?.split(',').entries() ||
            [].entries()) {
            bulkOptions.push({
              fk_column_id: colId,
              title: option.replace(/^'/, '').replace(/'$/, ''),
              order: i + 1,
              color: selectColors[i % selectColors.length],
            });
          }
          await SelectOption.bulkInsert(context, bulkOptions, ncMeta);
        } else {
          const bulkOptions = [];
          for (const [i, option] of column.colOptions.options.entries() ||
            [].entries()) {
            if (column.dt === 'enum' || column.dt === 'set') {
              option.title = option.title.trimEnd();
            }
            bulkOptions.push({
              color: selectColors[i % selectColors.length],
              ...option,
              fk_column_id: colId,
              order: i + 1,
            });
          }
          await SelectOption.bulkInsert(context, bulkOptions, ncMeta);
        }
        break;
      }
      case UITypes.LongText: {
        // 插入长文本列选项
        if (column.meta?.[LongTextAiMetaProp] === true) {
          await AIColumn.insert(
            context,
            {
              fk_model_id: column.fk_model_id,
              fk_column_id: colId,
              fk_integration_id: column.fk_integration_id,
              model: column.model,
              prompt: column.prompt,
              prompt_raw: column.prompt_raw,
              error: column.error,
            },
            ncMeta,
          );
        }
        break;
      }
    }
  }

  /**
   * 获取列选项
   * @param context 上下文
   * @param ncMeta 元数据服务
   * @returns 列选项
   */
  public async getColOptions<U = T>(
    context: NcContext,
    ncMeta = Noco.ncMeta,
  ): Promise<U> {
    let res: any;

    // 根据列类型获取不同的列选项
    switch (this.uidt) {
      case UITypes.Lookup:
        res = await LookupColumn.read(context, this.id, ncMeta);
        break;
      case UITypes.Rollup:
        res = await RollupColumn.read(context, this.id, ncMeta);
        break;
      case UITypes.LinkToAnotherRecord:
        res = await LinkToAnotherRecordColumn.read(context, this.id, ncMeta);
        break;
      case UITypes.Links:
        res = await LinksColumn.read(context, this.id, ncMeta);
        break;
      case UITypes.MultiSelect:
        res = await SelectOption.read(context, this.id, ncMeta);
        break;
      case UITypes.SingleSelect:
        res = await SelectOption.read(context, this.id, ncMeta);
        break;
      case UITypes.Formula:
        res = await FormulaColumn.read(context, this.id, ncMeta);
        break;
      case UITypes.Button:
        res = await ButtonColumn.read(context, this.id, ncMeta);

        // 添加默认值
        if (!res) {
          res = {
            type: 'url',
            theme: 'solid',
            color: 'brand',
            label: 'Button',
            error: 'Invalid configuration',
            formula_raw: '',
          };
        }
        break;
      case UITypes.QrCode:
        res = await QrCodeColumn.read(context, this.id, ncMeta);
        break;
      case UITypes.Barcode:
        res = await BarcodeColumn.read(context, this.id, ncMeta);
        break;
      case UITypes.LongText:
        if (this.meta?.[LongTextAiMetaProp] === true) {
          res = await AIColumn.read(context, this.id, ncMeta);
        }
        break;
    }
    this.colOptions = res;
    return res;
  }

  /**
   * 加载关联的模型
   * @param context 上下文
   * @param force 是否强制重新加载
   * @param ncMeta 元数据服务
   * @returns 模型实例
   */
  async loadModel(
    context: NcContext,
    force = false,
    ncMeta = Noco.ncMeta,
  ): Promise<Model> {
    if (!this.model || force) {
      this.model = await Model.getByIdOrName(
        context,
        {
          id: this.fk_model_id,
        },
        ncMeta,
      );
    }

    return this.model;
  }

  /**
   * 获取列列表
   * @param context 上下文
   * @param param 查询参数
   * @param ncMeta 元数据服务
   * @returns 列列表
   */
  public static async list(
    context: NcContext,
    {
      fk_model_id,
      fk_default_view_id,
    }: {
      fk_model_id: string;
      fk_default_view_id?: string;
    },
    ncMeta = Noco.ncMeta,
  ): Promise<Column[]> {
    // 从缓存获取列列表
    const cachedList = await NocoCache.getList(CacheScope.COLUMN, [
      fk_model_id,
    ]);
    let { list: columnsList } = cachedList;
    const { isNoneList } = cachedList;

    // 获取默认视图列
    const defaultViewColumns = fk_default_view_id
      ? await View.getColumns(context, fk_default_view_id, ncMeta)
      : [];

    // 创建默认视图列映射
    const defaultViewColumnMap = defaultViewColumns.reduce((acc, col) => {
      acc[col.fk_column_id] = col;
      return acc;
    }, {});

    // 如果缓存中没有数据，从数据库获取
    if (!isNoneList && !columnsList.length) {
      columnsList = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.COLUMNS,
        {
          condition: {
            fk_model_id,
          },
          orderBy: {
            order: 'asc',
          },
        },
      );

      // 解析元数据
      columnsList.forEach((column) => {
        column.meta = parseMetaProp(column);
      });

      // 更新缓存
      await NocoCache.setList(CacheScope.COLUMN, [fk_model_id], columnsList);
    }

    // 按顺序排序
    columnsList.sort(
      (a, b) =>
        (a.order != null ? a.order : Infinity) -
        (b.order != null ? b.order : Infinity),
    );

    // 返回列列表
    return Promise.all(
      columnsList.map(async (m) => {
        if (defaultViewColumns.length) {
          m.meta = {
            ...parseMetaProp(m),
            defaultViewColOrder: defaultViewColumnMap[m.id]?.order,
            defaultViewColVisibility: defaultViewColumnMap[m.id]?.show,
          };
        }

        const column = new Column(m);
        await column.getColOptions(context, ncMeta);
        return column;
      }),
    );
  }

  /**
   * 获取单个列
   * @param context 上下文
   * @param param 查询参数
   * @param ncMeta 元数据服务
   * @returns 列实例
   */
  public static async get<T = any>(
    context: NcContext,
    {
      colId,
    }: {
      source_id?: string;
      db_alias?: string;
      colId: string;
    },
    ncMeta = Noco.ncMeta,
  ): Promise<Column<T>> {
    // 从缓存获取列数据
    let colData =
      colId &&
      (await NocoCache.get(
        `${CacheScope.COLUMN}:${colId}`,
        CacheGetType.TYPE_OBJECT,
      ));
    
    // 如果缓存中没有，从数据库获取
    if (!colData) {
      colData = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.COLUMNS,
        colId,
      );
      if (colData) {
        try {
          colData.meta = JSON.parse(colData.meta);
        } catch {
          colData.meta = {};
        }
        await NocoCache.set(`${CacheScope.COLUMN}:${colId}`, colData);
      }
    }

    // 创建并返回列实例
    if (colData) {
      const column = new Column(colData);
      await column.getColOptions(
        {
          workspace_id: column.fk_workspace_id,
          base_id: column.base_id,
        },
        ncMeta,
      );
      return column;
    }
    return null;
  }

  id: string;

  /**
   * 删除列
   * @param context 上下文
   * @param id 列ID
   * @param ncMeta 元数据服务
   */
  static async delete(context: NcContext, id, ncMeta = Noco.ncMeta) {
    // 获取列信息
    const col = await this.get(context, { colId: id }, ncMeta);

    // 如果列不存在，直接返回
    if (!col) {
      return;
    }

    // 删除相关的二维码列
    {
      const qrCodeCols = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.COL_QRCODE,
        {
          condition: { fk_qr_value_column_id: id },
        },
      );
      for (const qrCodeCol of qrCodeCols) {
        await Column.delete(context, qrCodeCol.fk_column_id, ncMeta);
      }
    }

    // 删除相关的条形码列
    {
      const barcodeCols = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.COL_BARCODE,
        {
          condition: { fk_barcode_value_column_id: id },
        },
      );
      for (const barcodeCol of barcodeCols) {
        await Column.delete(context, barcodeCol.fk_column_id, ncMeta);
      }
    }

    // 删除相关的查找列
    {
      const cachedList = await NocoCache.getList(CacheScope.COL_LOOKUP, [id]);
      let { list: lookups } = cachedList;
      const { isNoneList } = cachedList;
      if (!isNoneList && !lookups.length) {
        lookups = await ncMeta.metaList2(
          context.workspace_id,
          context.base_id,
          MetaTable.COL_LOOKUP,
          {
            condition: { fk_lookup_column_id: id },
          },
        );
      }
      for (const lookup of lookups) {
        await Column.delete(context, lookup.fk_column_id, ncMeta);
      }
    }

    // 删除相关的汇总列
    {
      const cachedList = await NocoCache.getList(CacheScope.COL_ROLLUP, [id]);
      let { list: rollups } = cachedList;
      const { isNoneList } = cachedList;
      if (!isNoneList && !rollups.length) {
        rollups = await ncMeta.metaList2(
          context.workspace_id,
          context.base_id,
          MetaTable.COL_ROLLUP,
          {
            condition: { fk_rollup_column_id: id },
          },
        );
      }
      for (const rollup of rollups) {
        await Column.delete(context, rollup.fk_column_id, ncMeta);
      }
    }

    // 处理按钮列
    {
      const cachedList = await NocoCache.getList(CacheScope.COLUMN, [
        col.fk_model_id,
      ]);
      let { list: buttonColumns } = cachedList;
      const { isNoneList } = cachedList;
      if (!isNoneList && !buttonColumns.length) {
        buttonColumns = await ncMeta.metaList2(
          context.workspace_id,
          context.base_id,
          MetaTable.COLUMNS,
          {
            condition: {
              fk_model_id: col.fk_model_id,
              uidt: UITypes.Button,
            },
          },
        );
      }
      buttonColumns = buttonColumns.filter((c) => c.uidt === UITypes.Button);

      for (const buttonCol of buttonColumns) {
        const button = await new Column(buttonCol).getColOptions<ButtonColumn>(
          context,
          ncMeta,
        );

        if (button.type === 'url') {
          if (
            button.formula &&
            addFormulaErrorIfMissingColumn({
              formula: button,
              columnId: id,
              title: col?.title,
            })
          )
            await ButtonColumn.update(
              context,
              buttonCol.id,
              button as ButtonColumn & { parsed_tree?: any },
              ncMeta,
            );
        }
      }
    }

    // 处理AI列
    {
      const cachedList = await NocoCache.getList(CacheScope.COLUMN, [
        col.fk_model_id,
      ]);
      let { list: aiColumns } = cachedList;
      const { isNoneList } = cachedList;
      if (!isNoneList && !aiColumns.length) {
        aiColumns = await ncMeta.metaList2(
          context.workspace_id,
          context.base_id,
          MetaTable.COLUMNS,
          {
            condition: {
              fk_model_id: col.fk_model_id,
              uidt: UITypes.LongText,
            },
          },
        );
      }

      parseMetaProp(col);

      aiColumns = aiColumns.filter((c) => isAIPromptCol(c));

      for (const aiCol of aiColumns) {
        const ai = await new Column(aiCol).getColOptions<AIColumn>(
          context,
          ncMeta,
        );

        if (!ai) continue;

        if (ai.prompt && ai.prompt.match(/{column_id}/)) {
          ai.error = `Field '${col.title}' not found`;
          await AIColumn.update(context, aiCol.id, ai, ncMeta);
        }
      }
    }

    // 处理公式列
    {
      const cachedList = await NocoCache.getList(CacheScope.COLUMN, [
        col.fk_model_id,
      ]);
      let { list: formulaColumns } = cachedList;
      const { isNoneList } = cachedList;
      if (!isNoneList && !formulaColumns.length) {
        formulaColumns = await ncMeta.metaList2(
          context.workspace_id,
          context.base_id,
          MetaTable.COLUMNS,
          {
            condition: {
              fk_model_id: col.fk_model_id,
              uidt: UITypes.Formula,
            },
          },
        );
      }
      formulaColumns = formulaColumns.filter((c) => c.uidt === UITypes.Formula);

      for (const formulaCol of formulaColumns) {
        const formula = await new Column(
          formulaCol,
        ).getColOptions<FormulaColumn>(context, ncMeta);
        if (
          formula.formula &&
          addFormulaErrorIfMissingColumn({
            formula,
            columnId: id,
            title: col?.title,
          })
        )
          await FormulaColumn.update(
            context,
            formulaCol.id,
            formula as FormulaColumn & { parsed_tree?: any },
            ncMeta,
          );
      }
    }

    // 处理关系列
    if (isLinksOrLTAR(col.uidt)) {
      // 删除相关的查找列
      {
        const cachedList = await NocoCache.getList(CacheScope.COL_LOOKUP, [id]);
        let { list: lookups } = cachedList;
        const { isNoneList } = cachedList;
        if (!isNoneList && !lookups.length) {
          lookups = await ncMeta.metaList2(
            context.workspace_id,
            context.base_id,
            MetaTable.COL_LOOKUP,
            {
              condition: { fk_relation_column_id: id },
            },
          );
        }
        for (const lookup of lookups) {
          await Column.delete(context, lookup.fk_column_id, ncMeta);
        }
      }

      // 删除相关的汇总列
      {
        const cachedList = await NocoCache.getList(CacheScope.COL_ROLLUP, [id]);
        let { list: rollups } = cachedList;
        const { isNoneList } = cachedList;
        if (!isNoneList && !rollups.length) {
          rollups = await ncMeta.metaList2(
            context.workspace_id,
            context.base_id,
            MetaTable.COL_ROLLUP,
            {
              condition: { fk_relation_column_id: id },
            },
          );
        }
        for (const rollup of rollups) {
          await Column.delete(context, rollup.fk_column_id, ncMeta);
        }
      }
    }

    // 删除排序配置
    {
      const cachedList = await NocoCache.getList(CacheScope.SORT, [id]);
      let { list: sorts } = cachedList;
      const { isNoneList } = cachedList;
      if (!isNoneList && !sorts.length) {
        sorts = await ncMeta.metaList2(
          context.workspace_id,
          context.base_id,
          MetaTable.SORT,
          {
            condition: {
              fk_column_id: id,
            },
          },
        );
      }
      for (const sort of sorts) {
        await Sort.delete(context, sort.id, ncMeta);
      }
    }

    // 删除过滤配置
    {
      const cachedList = await NocoCache.getList(CacheScope.FILTER_EXP, [id]);
      let { list: filters } = cachedList;
      const { isNoneList } = cachedList;
      if (!isNoneList && !filters.length) {
        filters = await ncMeta.metaList2(
          context.workspace_id,
          context.base_id,
          MetaTable.FILTER_EXP,
          {
            condition: {
              fk_column_id: id,
            },
          },
        );
      }
      for (const filter of filters) {
        if (filter.fk_parent_id) continue;
        await Filter.delete(context, filter.id, ncMeta);
      }
    }

    // 删除所有父级过滤配置
    {
      await Filter.deleteAllByParentColumn(context, id, ncMeta);
    }

    // 更新图库和看板视图的封面图片列ID
    await Column.deleteCoverImageColumnId(context, id, ncMeta);

    // 删除视图列
    let colOptionTableName = null;
    let cacheScopeName = null;
    switch (col.uidt) {
      case UITypes.Rollup:
        colOptionTableName = MetaTable.COL_ROLLUP;
        cacheScopeName = CacheScope.COL_ROLLUP;
        break;
      case UITypes.Lookup:
        colOptionTableName = MetaTable.COL_LOOKUP;
        cacheScopeName = CacheScope.COL_LOOKUP;
        break;
      case UITypes.LinkToAnotherRecord:
      case UITypes.Links:
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
      case UITypes.Button:
        colOptionTableName = MetaTable.COL_BUTTON;
        cacheScopeName = CacheScope.COL_BUTTON;
        break;
      case UITypes.QrCode:
        colOptionTableName = MetaTable.COL_QRCODE;
        cacheScopeName = CacheScope.COL_QRCODE;
        break;
      case UITypes.Barcode:
        colOptionTableName = MetaTable.COL_BARCODE;
        cacheScopeName = CacheScope.COL_BARCODE;
        break;
      case UITypes.LongText:
        if (col.meta?.[LongTextAiMetaProp] === true) {
          colOptionTableName = MetaTable.COL_LONG_TEXT;
          cacheScopeName = CacheScope.COL_LONG_TEXT;
        }
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

    // 删除所有视图列
    const viewColumnTables = [
      MetaTable.GRID_VIEW_COLUMNS,
      MetaTable.FORM_VIEW_COLUMNS,
      MetaTable.KANBAN_VIEW_COLUMNS,
      MetaTable.GALLERY_VIEW_COLUMNS,
      MetaTable.CALENDAR_VIEW_COLUMNS,
    ];
    const viewColumnCacheScope = [
      CacheScope.GRID_VIEW_COLUMN,
      CacheScope.FORM_VIEW_COLUMN,
      CacheScope.KANBAN_VIEW_COLUMN,
      CacheScope.GALLERY_VIEW_COLUMN,
      CacheScope.CALENDAR_VIEW_COLUMN,
    ];

    for (let i = 0; i < viewColumnTables.length; i++) {
      const table = viewColumnTables[i];
      const cacheScope = viewColumnCacheScope[i];
      const viewColumns = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        table,
        {
          condition: { fk_column_id: id },
        },
      );
      await ncMeta.metaDelete(context.workspace_id, context.base_id, table, {
        fk_column_id: id,
      });
      for (const viewColumn of viewColumns) {
        await NocoCache.deepDel(
          `${cacheScope}:${viewColumn.id}`,
          CacheDelDirection.CHILD_TO_PARENT,
        );
      }
    }

    // 获取引用当前列作为外键的LTAR列
    const ltarColumns = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.COL_RELATIONS,
      {
        xcCondition: {
          _or: [
            { fk_child_column_id: { eq: col.id } },
            { fk_parent_column_id: { eq: col.id } },
            { fk_mm_child_column_id: { eq: col.id } },
            { fk_mm_parent_column_id: { eq: col.id } },
          ],
        },
      },
    );

    // 删除引用当前列作为外键的LTAR列
    for (const ltarColumn of ltarColumns) {
      await Column.delete(context, ltarColumn.fk_column_id, ncMeta);
    }

    // 删除文件引用
    await FileReference.bulkDelete(context, { fk_column_id: col.id }, ncMeta);

    // 删除列
    await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.COLUMNS,
      col.id,
    );
    await NocoCache.deepDel(
      `${CacheScope.COLUMN}:${col.id}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );

    // 清除单查询缓存
    {
      await View.clearSingleQueryCache(context, col.fk_model_id, null, ncMeta);
    }
  }

  /**
   * 更新列
   * @param context 上下文
   * @param colId 列ID
   * @param column 更新数据
   * @param skipFormulaInvalidate 是否跳过公式验证
   * @param ncMeta 元数据服务
   */
  static async update(
    context: NcContext,
    colId: string,
    column: Partial<Column> & Partial<Pick<ColumnReqType, 'column_order'>>,
    ncMeta = Noco.ncMeta,
    skipFormulaInvalidate = false,
  ) {
    // 获取原有列
    const oldCol = await Column.get(context, { colId }, ncMeta);
    const requiredColAvail =
      !requiredColumnsToRecreate[oldCol.uidt] ||
      requiredColumnsToRecreate[oldCol.uidt].every((k) => column[k]);

    // 根据列类型删除旧的列选项
    if (requiredColAvail) {
      switch (oldCol.uidt) {
        case UITypes.Lookup: {
          await ncMeta.metaDelete(
            context.workspace_id,
            context.base_id,
            MetaTable.COL_LOOKUP,
            {
              fk_column_id: colId,
            },
          );
          await NocoCache.deepDel(
            `${CacheScope.COL_LOOKUP}:${colId}`,
            CacheDelDirection.CHILD_TO_PARENT,
          );
          break;
        }
        case UITypes.Rollup: {
          await ncMeta.metaDelete(
            context.workspace_id,
            context.base_id,
            MetaTable.COL_ROLLUP,
            {
              fk_column_id: colId,
            },
          );
          await NocoCache.deepDel(
            `${CacheScope.COL_ROLLUP}:${colId}`,
            CacheDelDirection.CHILD_TO_PARENT,
          );
          break;
        }

        case UITypes.Links:
        case UITypes.LinkToAnotherRecord: {
          await ncMeta.metaDelete(
            context.workspace_id,
            context.base_id,
            MetaTable.COL_RELATIONS,
            {
              fk_column_id: colId,
            },
          );
          await NocoCache.deepDel(
            `${CacheScope.COL_RELATION}:${colId}`,
            CacheDelDirection.CHILD_TO_PARENT,
          );
          break;
        }
        case UITypes.Formula: {
          await ncMeta.metaDelete(
            context.workspace_id,
            context.base_id,
            MetaTable.COL_FORMULA,
            {
              fk_column_id: colId,
            },
          );

          await NocoCache.deepDel(
            `${CacheScope.COL_FORMULA}:${colId}`,
            CacheDelDirection.CHILD_TO_PARENT,
          );
          break;
        }

        case UITypes.Button: {
          await ncMeta.metaDelete(
            context.workspace_id,
            context.base_id,
            MetaTable.COL_BUTTON,
            {
              fk_column_id: colId,
            },
          );

          await NocoCache.deepDel(
            `${CacheScope.COL_BUTTON}:${colId}`,
            CacheDelDirection.CHILD_TO_PARENT,
          );
          break;
        }

        case UITypes.QrCode: {
          await ncMeta.metaDelete(
            context.workspace_id,
            context.base_id,
            MetaTable.COL_QRCODE,
            {
              fk_column_id: colId,
            },
          );

          await NocoCache.deepDel(
            `${CacheScope.COL_QRCODE}:${colId}`,
            CacheDelDirection.CHILD_TO_PARENT,
          );
          break;
        }

        case UITypes.Barcode: {
          await ncMeta.metaDelete(
            context.workspace_id,
            context.base_id,
            MetaTable.COL_BARCODE,
            {
              fk_column_id: colId,
            },
          );

          await NocoCache.deepDel(
            `${CacheScope.COL_BARCODE}:${colId}`,
            CacheDelDirection.CHILD_TO_PARENT,
          );
          break;
        }

        case UITypes.MultiSelect:
        case UITypes.SingleSelect: {
          await ncMeta.metaDelete(
            context.workspace_id,
            context.base_id,
            MetaTable.COL_SELECT_OPTIONS,
            {
              fk_column_id: colId,
            },
          );

          await NocoCache.deepDel(
            `${CacheScope.COL_SELECT_OPTION}:${colId}:list`,
            CacheDelDirection.PARENT_TO_CHILD,
          );
          break;
        }

        case UITypes.LongText: {
          await ncMeta.metaDelete(
            context.workspace_id,
            context.base_id,
            MetaTable.COL_LONG_TEXT,
            {
              fk_column_id: colId,
            },
          );

          await NocoCache.deepDel(
            `${CacheScope.COL_LONG_TEXT}:${colId}`,
            CacheDelDirection.CHILD_TO_PARENT,
          );
          break;
        }
      }
    }

    // 提取需要更新的属性
    const updateObj = extractProps(column, [
      'column_name',
      'title',
      'description',
      'uidt',
      'dt',
      'np',
      'ns',
      'clen',
      'cop',
      'pk',
      'rqd',
      'un',
      'ct',
      'ai',
      'unique',
      'cdf',
      'cc',
      'csn',
      'dtx',
      'dtxp',
      'dtxs',
      'au',
      'pv',
      'system',
      'validate',
      'meta',
      'readonly',
    ]);

    // 处理验证规则
    if (column.validate) {
      if (typeof column.validate === 'string')
        updateObj.validate = column.validate;
      else updateObj.validate = JSON.stringify(column.validate);
    }

    // 处理二维码和条形码列
    if (!AllowedColumnTypesForQrAndBarcodes.includes(updateObj.uidt)) {
      const qrCodeCols = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.COL_QRCODE,
        {
          condition: { fk_qr_value_column_id: colId },
        },
      );
      const barcodeCols = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.COL_BARCODE,
        {
          condition: { fk_barcode_value_column_id: colId },
        },
      );
      for (const qrCodeCol of qrCodeCols) {
        await Column.delete(context, qrCodeCol.fk_column_id, ncMeta);
      }
      for (const barcodeCol of barcodeCols) {
        await Column.delete(context, barcodeCol.fk_column_id, ncMeta);
      }
    }

    // 更新列顺序
    if (
      column.column_order &&
      column.column_order.order &&
      column.column_order.view_id
    ) {
      const viewColumn = (
        await View.getColumns(context, column.column_order.view_id, ncMeta)
      ).find((col) => col.fk_column_id === column.id);
      await View.updateColumn(
        context,
        column.column_order.view_id,
        viewColumn.id,
        {
          order: column.column_order.order,
        },
        ncMeta,
      );
    }

    // 处理附件列
    if (
      column.uidt &&
      oldCol.uidt === UITypes.Attachment &&
      oldCol.uidt !== column.uidt
    ) {
      await Column.deleteCoverImageColumnId(context, colId, ncMeta);
    }

    // 更新列数据
    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.COLUMNS,
      prepareForDb(updateObj),
      colId,
    );

    // 更新缓存
    await NocoCache.update(
      `${CacheScope.COLUMN}:${colId}`,
      prepareForResponse(updateObj),
    );

    // 插入新的列选项
    if (requiredColAvail)
      await this.insertColOption(context, column, colId, ncMeta);

    // 清除单查询缓存
    await View.clearSingleQueryCache(context, oldCol.fk_model_id, null, ncMeta);

    // 获取更新后的列
    const updatedColumn = await Column.get(context, { colId }, ncMeta);
    if (!skipFormulaInvalidate) {
      // 使引用当前列的公式/按钮的解析树失效
      getFormulasReferredTheColumn(
        context,
        {
          column: updatedColumn,
          columns: await Column.list(
            context,
            { fk_model_id: oldCol.fk_model_id },
            ncMeta,
          ),
        },
        ncMeta,
      )
        .then(async (formulas) => {
          for (const formula of formulas) {
            if (formula.uidt === UITypes.Formula) {
              await FormulaColumn.update(
                context,
                formula.id,
                {
                  parsed_tree: null,
                },
                ncMeta,
              );
            } else if (formula.uidt === UITypes.Button) {
              await ButtonColumn.update(
                context,
                formula.id,
                {
                  parsed_tree: null,
                },
                ncMeta,
              );
            }
          }
        })
        .catch((err) => {
          logger.error(err);
        });
    }

    // 清除相关表的缓存
    {
      const ltarColumns = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.COL_RELATIONS,
        {
          xcCondition: {
            _and: [
              {
                _or: [
                  { fk_child_column_id: { eq: colId } },
                  { fk_parent_column_id: { eq: colId } },
                  { fk_mm_child_column_id: { eq: colId } },
                  { fk_mm_parent_column_id: { eq: colId } },
                ],
              },
              {
                fk_related_model_id: { neq: oldCol.fk_model_id },
              },
            ],
          },
        },
      );

      for (const linkCol of ltarColumns) {
        await View.clearSingleQueryCache(
          context,
          (linkCol as LinksColumn).fk_related_model_id,
          null,
          ncMeta,
        );
      }
    }
  }

  /**
   * 更新公式列到新类型
   * @param context 上下文
   * @param param 参数
   * @param ncMeta 元数据服务
   */
  static async updateFormulaColumnToNewType(
    context: NcContext,
    {
      formulaColumn,
      destinationColumn,
      ncMeta = Noco.ncMeta,
    }: {
      formulaColumn: Column;
      destinationColumn: Column;
      ncMeta?: MetaService;
    },
  ) {
    // 提取需要更新的属性
    const updateObj = extractProps(destinationColumn, [
      'column_name',
      'title',
      'description',
      'uidt',
      'dt',
      'np',
      'ns',
      'clen',
      'cop',
      'pk',
      'rqd',
      'un',
      'ct',
      'ai',
      'unique',
      'cdf',
      'cc',
      'csn',
      'dtx',
      'dtxp',
      'dtxs',
      'au',
      'pv',
      'system',
      'validate',
      'meta',
    ]);

    // 更新列数据
    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.COLUMNS,
      prepareForDb(updateObj),
      formulaColumn.id,
    );

    // 删除公式列选项
    await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.COL_FORMULA,
      {
        fk_column_id: formulaColumn.id,
      },
    );

    // 删除目标列
    await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.COLUMNS,
      destinationColumn.id,
    );

    // 更新缓存
    await NocoCache.update(
      `${CacheScope.COLUMN}:${formulaColumn.id}`,
      prepareForResponse(updateObj),
    );
    await NocoCache.del(`${CacheScope.COLUMN}:${destinationColumn.id}`);
  }

  /**
   * 更新列别名
   * @param context 上下文
   * @param colId 列ID
   * @param param 参数
   * @param ncMeta 元数据服务
   */
  static async updateAlias(
    context: NcContext,
    colId: string,
    { title }: { title: string },
    ncMeta = Noco.ncMeta,
  ) {
    // 更新列标题
    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.COLUMNS,
      {
        title,
      },
      colId,
    );

    // 更新缓存
    await NocoCache.update(`${CacheScope.COLUMN}:${colId}`, { title });

    // 获取列信息
    const column = await Column.get(context, { colId }, ncMeta);

    // 清除单查询缓存
    await View.clearSingleQueryCache(context, column.fk_model_id, null, ncMeta);
  }

  /**
   * 获取验证规则
   * @returns 验证规则对象
   */
  public getValidators(): any {
    if (this.validate && typeof this.validate === 'string')
      try {
        return JSON.parse(this.validate);
      } catch {}
    return null;
  }

  /**
   * 删除列
   * @param context 上下文
   * @param ncMeta 元数据服务
   */
  async delete(context: NcContext, ncMeta = Noco.ncMeta) {
    return await Column.delete(context, this.id, ncMeta);
  }

  /**
   * 检查列名是否可用
   * @param context 上下文
   * @param param 参数
   * @param ncMeta 元数据服务
   * @returns 是否可用
   */
  static async checkTitleAvailable(
    context: NcContext,
    {
      column_name,
      fk_model_id,
      exclude_id,
    }: { column_name; fk_model_id; exclude_id? },
    ncMeta = Noco.ncMeta,
  ) {
    return !(await ncMeta.metaGet2(
      context.workspace_id,
      context.base_id,
      MetaTable.COLUMNS,
      {
        column_name,
        fk_model_id,
      },
      null,
      exclude_id && { id: { neq: exclude_id } },
    ));
  }

  /**
   * 检查别名是否可用
   * @param context 上下文
   * @param param 参数
   * @param ncMeta 元数据服务
   * @returns 是否可用
   */
  static async checkAliasAvailable(
    context: NcContext,
    { title, fk_model_id, exclude_id }: { title; fk_model_id; exclude_id? },
    ncMeta = Noco.ncMeta,
  ) {
    return !(await ncMeta.metaGet2(
      context.workspace_id,
      context.base_id,
      MetaTable.COLUMNS,
      {
        title,
        fk_model_id,
      },
      null,
      exclude_id && { id: { neq: exclude_id } },
    ));
  }

  /**
   * 标记为系统字段
   * @param context 上下文
   * @param colId 列ID
   * @param system 是否为系统字段
   * @param ncMeta 元数据服务
   */
  static async markAsSystemField(
    context: NcContext,
    colId: string,
    system = true,
    ncMeta = Noco.ncMeta,
  ) {
    // 更新系统字段标记
    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.COLUMNS,
      {
        system,
      },
      colId,
    );

    // 更新缓存
    await NocoCache.update(`${CacheScope.COLUMN}:${colId}`, { system });
  }

  /**
   * 获取最大列名长度
   * @param sqlClientType SQL客户端类型
   * @returns 最大长度
   */
  static getMaxColumnNameLength(sqlClientType: string) {
    let fieldLengthLimit = 255; // SQLite默认限制
    if (sqlClientType === 'mysql2' || sqlClientType === 'mysql') {
      fieldLengthLimit = 64;
    } else if (sqlClientType === 'pg') {
      fieldLengthLimit = 59;
    } else if (sqlClientType === 'mssql') {
      fieldLengthLimit = 128;
    }
    return fieldLengthLimit;
  }

  /**
   * 更新列元数据
   * @param context 上下文
   * @param param 参数
   * @param ncMeta 元数据服务
   */
  static async updateMeta(
    context: NcContext,
    { colId, meta }: { colId: string; meta: any },
    ncMeta = Noco.ncMeta,
  ) {
    // 更新元数据
    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.COLUMNS,
      prepareForDb({ meta }),
      colId,
    );

    // 更新缓存
    await NocoCache.update(
      `${CacheScope.COLUMN}:${colId}`,
      prepareForResponse({ meta }),
    );
  }

  /**
   * 更新验证规则
   * @param context 上下文
   * @param param 参数
   * @param ncMeta 元数据服务
   */
  static async updateValidation(
    context: NcContext,
    { colId, validate }: { colId: string; validate: any },
    ncMeta = Noco.ncMeta,
  ) {
    // 更新验证规则
    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.COLUMNS,
      prepareForDb({ validate }, 'validate'),
      colId,
    );

    // 更新缓存
    await NocoCache.update(`${CacheScope.COLUMN}:${colId}`, { validate });
  }

  /**
   * 更新目标视图
   * @param context 上下文
   * @param param 参数
   * @param ncMeta 元数据服务
   */
  static async updateTargetView(
    context: NcContext,
    { colId, fk_target_view_id }: { colId: string; fk_target_view_id: string },
    ncMeta = Noco.ncMeta,
  ) {
    // 更新目标视图
    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.COL_RELATIONS,
      {
        fk_target_view_id,
      },
      {
        fk_column_id: colId,
      },
    );

    // 更新缓存
    await NocoCache.update(`${CacheScope.COL_RELATION}:${colId}`, {
      fk_target_view_id,
    });
  }

  /**
   * 批量插入列
   * @param context 上下文
   * @param param 参数
   * @param ncMeta 元数据服务
   * @returns 插入的列列表
   */
  static async bulkInsert(
    context: NcContext,
    param: {
      columns: Column[];
      fk_model_id: any;
      source_id: string;
      base_id: string;
    },
    ncMeta = Noco.ncMeta,
  ) {
    const extractedColumnMetas = [];
    const columns = [];

    // 为每个列添加模型ID
    for (const column of param.columns) {
      // 预填充列元数据
      const id = await ncMeta.genNanoid(MetaTable.COLUMNS);
      const colWithId = {
        ...column,
        id,
        base_id: param.base_id,
        source_id: param.source_id,
        fk_model_id: param.fk_model_id,
      };

      // 提取列属性
      const insertObj = extractProps(colWithId as any, [
        'id',
        'fk_model_id',
        'column_name',
        'description',
        'title',
        'uidt',
        'dt',
        'np',
        'ns',
        'clen',
        'cop',
        'pk',
        'rqd',
        'un',
        'ct',
        'ai',
        'unique',
        'cdf',
        'cc',
        'csn',
        'dtx',
        'dtxp',
        'dtxs',
        'au',
        'pv',
        'order',
        'base_id',
        'source_id',
        'system',
        'meta',
        'readonly',
      ]);

      // 处理元数据
      if (column.meta && typeof column.meta === 'object') {
        insertObj.meta = JSON.stringify(column.meta);
      }

      // 处理验证规则
      if (column.validate) {
        if (typeof column.validate === 'string')
          insertObj.validate = column.validate;
        else insertObj.validate = JSON.stringify(column.validate);
      }
      extractedColumnMetas.push(insertObj);

      columns.push(colWithId);
    }

    if (columns.length === 0) return [];

    // 批量插入列
    await ncMeta.bulkMetaInsert(
      context.workspace_id,
      context.base_id,
      MetaTable.COLUMNS,
      extractedColumnMetas,
      true,
    );

    // 批量插入列选项
    await Column.bulkInsertColOption(context, columns, ncMeta);

    return columns;
  }

  /**
   * 批量插入列选项
   * @param context 上下文
   * @param columns 列列表
   * @param ncMeta 元数据服务
   */
  private static async bulkInsertColOption<T>(
    context: NcContext,
    columns: (Partial<T> & { source_id?: string; [p: string]: any })[],
    ncMeta = Noco.ncMeta,
  ) {
    const insertGroups = new Map<UITypes, Record<string, any>[]>();

    // 根据列类型分组
    for (const column of columns) {
      const groupKey =
        column.uidt === UITypes.MultiSelect
          ? UITypes.SingleSelect
          : column.uidt;
      let insertArr = insertGroups.get(groupKey);
      if (!insertArr) {
        insertGroups.set(groupKey, (insertArr = []));
      }

      // 根据列类型处理不同的列选项
      switch (column.uidt || column.ui_data_type) {
        case UITypes.Lookup:
          insertArr.push({
            fk_column_id: column.id,
            fk_relation_column_id: column.fk_relation_column_id,
            fk_lookup_column_id: column.fk_lookup_column_id,
          });
          break;

        case UITypes.Rollup: {
          insertArr.push({
            fk_column_id: column.id,
            fk_relation_column_id: column.fk_relation_column_id,
            fk_rollup_column_id: column.fk_rollup_column_id,
            rollup_function: column.rollup_function,
          });
          break;
        }
        case UITypes.Links:
        case UITypes.LinkToAnotherRecord: {
          insertArr.push({
            fk_column_id: column.id,
            type: column.type,
            fk_child_column_id: column.fk_child_column_id,
            fk_parent_column_id: column.fk_parent_column_id,
            fk_mm_model_id: column.fk_mm_model_id,
            fk_mm_child_column_id: column.fk_mm_child_column_id,
            fk_mm_parent_column_id: column.fk_mm_parent_column_id,
            ur: column.ur,
            dr: column.dr,
            fk_index_name: column.fk_index_name,
            fk_related_model_id: column.fk_related_model_id,
            virtual: column.virtual,
          });
          break;
        }
        case UITypes.QrCode: {
          insertArr.push(
            {
              fk_column_id: column.id,
              fk_qr_value_column_id: column.fk_qr_value_column_id,
            },
            ncMeta,
          );
          break;
        }
        case UITypes.Barcode: {
          insertArr.push({
            fk_column_id: column.id,
            fk_barcode_value_column_id: column.fk_barcode_value_column_id,
            barcode_format: column.barcode_format,
          });
          break;
        }
        case UITypes.Formula: {
          insertArr.push({
            fk_column_id: column.id,
            formula: column.formula,
            formula_raw: column.formula_raw,
            parsed_tree: column.parsed_tree,
          });
          break;
        }
        case UITypes.MultiSelect: {
          if (!column.colOptions?.options) {
            for (const [i, option] of column.dtxp?.split(',').entries() ||
              [].entries()) {
              insertArr.push({
                fk_column_id: column.id,
                title: option.replace(/^'/, '').replace(/'$/, ''),
                order: i + 1,
                color: selectColors[i % selectColors.length],
              });
            }
          } else {
            for (const [i, option] of column.colOptions.options.entries() ||
              [].entries()) {
              if (column.dt === 'enum' || column.dt === 'set') {
                option.title = option.title.trimEnd();
              }
              insertArr.push({
                color: selectColors[i % selectColors.length],
                ...extractProps(option, ['title', 'fk_column_id', 'color']),
                fk_column_id: column.id,
                order: i + 1,
              });
            }
          }
          break;
        }
        case UITypes.SingleSelect: {
          if (!column.colOptions?.options) {
            for (const [i, option] of column.dtxp?.split(',').entries() ||
              [].entries()) {
              insertArr.push({
                fk_column_id: column.id,
                title: option.replace(/^'/, '').replace(/'$/, ''),
                order: i + 1,
                color: selectColors[i % selectColors.length],
              });
            }
          } else {
            for (const [i, option] of column.colOptions.options.entries() ||
              [].entries()) {
              if (column.dt === 'enum' || column.dt === 'set') {
                option.title = option.title.trimEnd();
              }
              insertArr.push({
                color: selectColors[i % selectColors.length],
                ...extractProps(option, ['title', 'fk_column_id', 'color']),
                fk_column_id: column.id,
                order: i + 1,
              });
            }
          }
          break;
        }
        case UITypes.LongText: {
          if (column.meta?.[LongTextAiMetaProp] === true) {
            insertArr.push({
              fk_model_id: column.fk_model_id,
              fk_column_id: column.id,
              fk_integration_id: column.fk_integration_id,
              model: column.model,
              prompt: column.prompt,
              prompt_raw: column.prompt_raw,
              error: column.error,
            });
          }
          break;
        }
      }
    }

    // 批量插入列选项
    for (const group of insertGroups.keys()) {
      switch (group) {
        case UITypes.SingleSelect:
        case UITypes.MultiSelect:
          await ncMeta.bulkMetaInsert(
            context.workspace_id,
            context.base_id,
            MetaTable.COL_SELECT_OPTIONS,
            insertGroups.get(group),
          );
          break;

        case UITypes.Lookup:
          await ncMeta.bulkMetaInsert(
            context.workspace_id,
            context.base_id,
            MetaTable.COL_LOOKUP,
            insertGroups.get(group),
          );
          break;

        case UITypes.Rollup:
          await ncMeta.bulkMetaInsert(
            context.workspace_id,
            context.base_id,
            MetaTable.COL_ROLLUP,
            insertGroups.get(group),
          );
          break;
        case UITypes.Links:
        case UITypes.LinkToAnotherRecord:
          await ncMeta.bulkMetaInsert(
            context.workspace_id,
            context.base_id,
            MetaTable.COL_RELATIONS,
            insertGroups.get(group),
          );
          break;
        case UITypes.QrCode:
          await ncMeta.bulkMetaInsert(
            context.workspace_id,
            context.base_id,
            MetaTable.COL_QRCODE,
            insertGroups.get(group),
          );
          break;
        case UITypes.Barcode:
          await ncMeta.bulkMetaInsert(
            context.workspace_id,
            context.base_id,
            MetaTable.COL_BARCODE,
            insertGroups.get(group),
          );
          break;
        case UITypes.Formula:
          await ncMeta.bulkMetaInsert(
            context.workspace_id,
            context.base_id,
            MetaTable.COL_FORMULA,
            insertGroups.get(group),
          );
          break;
        case UITypes.LongText:
          await ncMeta.bulkMetaInsert(
            context.workspace_id,
            context.base_id,
            MetaTable.COL_LONG_TEXT,
            insertGroups.get(group),
          );
          break;
      }
    }
  }

  /**
   * 删除封面图片列ID
   * @param context 上下文
   * @param id 列ID
   * @param ncMeta 元数据服务
   */
  private static async deleteCoverImageColumnId(
    context: NcContext,
    id: string,
    ncMeta = Noco.ncMeta,
  ) {
    const promises = [];

    // 更新图库视图
    const galleryViews: GalleryView[] = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.GALLERY_VIEW,
      {
        condition: {
          fk_cover_image_col_id: id,
        },
      },
    );

    for (const galleryView of galleryViews) {
      promises.push(
        GalleryView.update(
          context,
          galleryView.fk_view_id,
          {
            fk_cover_image_col_id: null,
          },
          ncMeta,
        ),
      );
    }

    // 更新看板视图
    const kanbanViews: KanbanView[] = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.KANBAN_VIEW,
      {
        condition: {
          fk_cover_image_col_id: id,
        },
      },
    );

    for (const kanbanView of kanbanViews) {
      promises.push(
        KanbanView.update(
          context,
          kanbanView.fk_view_id,
          {
            fk_cover_image_col_id: null,
          },
          ncMeta,
        ),
      );
    }

    // 等待所有更新完成
    await Promise.all(promises);
  }
}
