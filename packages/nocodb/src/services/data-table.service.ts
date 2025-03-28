// 导入 NestJS 的 Injectable 装饰器，用于依赖注入
import { Injectable } from '@nestjs/common';
// 导入 nocodb-sdk 中的工具函数和类型定义
import { isLinksOrLTAR, RelationTypes, ViewTypes } from 'nocodb-sdk';
// 导入验证负载的辅助函数
import { validatePayload } from 'src/helpers';
// 导入 NcApiVersion 类型
import type { NcApiVersion } from 'nocodb-sdk';
// 导入 LinkToAnotherRecordColumn 类型
import type { LinkToAnotherRecordColumn } from '~/models';
// 导入 NcContext 接口类型
import type { NcContext } from '~/interface/config';
// 导入 nocoExecute 工具函数
import { nocoExecute } from '~/utils';
// 导入模型相关的类
import { Column, Model, Source, View } from '~/models';
// 导入数据服务
import { DatasService } from '~/services/datas.service';
// 导入错误处理辅助类
import { NcError } from '~/helpers/catchError';
// 导入获取抽象语法树的辅助函数
import getAst from '~/helpers/getAst';
// 导入分页响应实现类
import { PagedResponseImpl } from '~/helpers/PagedResponse';
// 导入连接管理器
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';

// 使用 Injectable 装饰器标记该服务可被注入
@Injectable()
export class DataTableService {
  // 构造函数，注入 DatasService
  constructor(protected datasService: DatasService) {}

  // 获取数据列表的方法
  async dataList(
    context: NcContext,
    param: {
      baseId?: string;
      modelId: string;
      query: any;
      viewId?: string;
      ignorePagination?: boolean;
      apiVersion?: NcApiVersion;
      includeSortAndFilterColumns?: boolean;
    },
  ) {
    // 解构参数
    const { modelId, viewId, baseId, ...rest } = param;
    // 获取模型和视图
    const { model, view } = await this.getModelAndView(context, {
      modelId,
      viewId,
      baseId,
    });
    // 调用数据服务的 dataList 方法获取数据列表
    return await this.datasService.dataList(context, {
      ...rest,
      model,
      view,
      apiVersion: param.apiVersion,
      includeSortAndFilterColumns: param?.includeSortAndFilterColumns,
    });
  }

  // 读取单条数据记录的方法
  async dataRead(
    context: NcContext,
    param: {
      baseId?: string;
      modelId: string;
      rowId: string;
      viewId?: string;
      query: any;
      apiVersion?: NcApiVersion;
    },
  ) {
    // 获取模型和视图
    const { model, view } = await this.getModelAndView(context, param);
    // 获取数据源
    const source = await Source.get(context, model.source_id);
    // 获取基础模型 SQL
    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    // 通过主键读取记录
    const row = await baseModel.readByPk(param.rowId, false, param.query, {
      throwErrorIfInvalidParams: true,
      apiVersion: param.apiVersion,
    });

    // 如果记录不存在，抛出错误
    if (!row) {
      NcError.recordNotFound(param.rowId);
    }

    // 返回记录
    return row;
  }

  // 数据聚合方法
  async dataAggregate(
    context: NcContext,
    param: {
      baseId?: string;
      modelId: string;
      viewId?: string;
      query: any;
    },
  ) {
    // 获取模型和视图
    const { model, view } = await this.getModelAndView(context, param);
    // 获取数据源
    const source = await Source.get(context, model.source_id);
    // 获取基础模型 SQL
    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    // 如果视图类型不是网格视图，抛出错误
    if (view.type !== ViewTypes.GRID) {
      NcError.badRequest('Aggregation is only supported on grid views');
    }

    // 准备列表参数
    const listArgs: any = { ...param.query };

    // 尝试解析过滤数组 JSON
    try {
      listArgs.filterArr = JSON.parse(listArgs.filterArrJson);
    } catch (e) {}

    // 尝试解析聚合 JSON
    try {
      listArgs.aggregation = JSON.parse(listArgs.aggregation);
    } catch (e) {}

    // 执行聚合操作
    const data = await baseModel.aggregate(listArgs, view);

    // 返回聚合数据
    return data;
  }

  // 插入数据方法
  async dataInsert(
    context: NcContext,
    param: {
      baseId?: string;
      viewId?: string;
      modelId: string;
      body: any;
      cookie: any;
      undo?: boolean;
      apiVersion?: NcApiVersion;
    },
  ) {
    // 获取模型和视图
    const { model, view } = await this.getModelAndView(context, param);
    // 获取数据源
    const source = await Source.get(context, model.source_id);
    // 获取基础模型 SQL
    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
    });

    // 如果是数组则执行批量插入
    const result = await baseModel.bulkInsert(
      Array.isArray(param.body) ? param.body : [param.body],
      {
        cookie: param.cookie,
        insertOneByOneAsFallback: true,
        isSingleRecordInsertion: !Array.isArray(param.body),
        typecast: (param.cookie?.query?.typecast ?? '') === 'true',
        undo: param.undo,
        apiVersion: param.apiVersion,
      },
    );

    // 返回结果，如果输入是数组则返回数组结果，否则返回单个结果
    return Array.isArray(param.body) ? result : result[0];
  }

  // 移动数据记录方法
  async dataMove(
    context: NcContext,
    param: {
      baseId?: string;
      modelId: string;
      rowId: string;
      cookie: any;
      beforeRowId?: string;
    },
  ) {
    // 获取模型和视图
    const { model, view } = await this.getModelAndView(context, param);
    // 获取数据源
    const source = await Source.get(context, model.source_id);
    // 获取基础模型 SQL
    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
    });

    // 移动记录
    await baseModel.moveRecord({
      cookie: param.cookie,
      rowId: param.rowId,
      beforeRowId: param.beforeRowId,
    });

    // 返回成功标志
    return true;
  }

  // 更新数据方法
  async dataUpdate(
    context: NcContext,
    param: {
      baseId?: string;
      modelId: string;
      viewId?: string;
      // rowId: string;
      body: any;
      cookie: any;
      apiVersion?: NcApiVersion;
    },
  ) {
    // 获取模型和视图
    const { model, view } = await this.getModelAndView(context, param);
    // 检查是否有重复行
    await this.checkForDuplicateRow(context, { rows: param.body, model });
    // 获取数据源
    const source = await Source.get(context, model.source_id);
    // 获取基础模型 SQL
    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
    });

    // 执行批量更新
    await baseModel.bulkUpdate(
      Array.isArray(param.body) ? param.body : [param.body],
      {
        cookie: param.cookie,
        throwExceptionIfNotExist: true,
        isSingleRecordUpdation: !Array.isArray(param.body),
        apiVersion: param.apiVersion,
      },
    );

    // 提取并返回 ID 对象
    return this.extractIdObj(context, { body: param.body, model });
  }

  // 删除数据方法
  async dataDelete(
    context: NcContext,
    param: {
      baseId?: string;
      modelId: string;
      viewId?: string;
      // rowId: string;
      cookie: any;
      body: any;
    },
  ) {
    // 获取模型和视图
    const { model, view } = await this.getModelAndView(context, param);
    // 检查是否有重复行
    await this.checkForDuplicateRow(context, { rows: param.body, model });
    // 获取数据源
    const source = await Source.get(context, model.source_id);
    // 获取基础模型 SQL
    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
    });

    // 执行批量删除
    await baseModel.bulkDelete(
      Array.isArray(param.body) ? param.body : [param.body],
      {
        cookie: param.cookie,
        throwExceptionIfNotExist: true,
        isSingleRecordDeletion: !Array.isArray(param.body),
      },
    );

    // 提取并返回 ID 对象
    return this.extractIdObj(context, { body: param.body, model });
  }

  // 获取数据计数方法
  async dataCount(
    context: NcContext,
    param: {
      baseId?: string;
      viewId?: string;
      modelId: string;
      query: any;
      apiVersion?: NcApiVersion;
    },
  ) {
    // 获取模型和视图
    const { model, view } = await this.getModelAndView(context, param);
    // 获取数据源
    const source = await Source.get(context, model.source_id);
    // 获取基础模型 SQL
    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
    });

    // 准备计数参数
    const countArgs: any = { ...param.query };
    // 尝试解析过滤数组 JSON
    try {
      countArgs.filterArr = JSON.parse(countArgs.filterArrJson);
    } catch (e) {}

    // 执行计数操作
    const count: number = await baseModel.count(countArgs, false, true);

    // 返回计数结果
    return { count };
  }

  // 获取模型和视图的受保护方法
  protected async getModelAndView(
    context: NcContext,
    param: {
      baseId?: string;
      viewId?: string;
      modelId: string;
    },
  ) {
    // 获取模型
    const model = await Model.get(context, param.modelId);

    // 如果模型不存在，抛出错误
    if (!model) {
      NcError.tableNotFound(param.modelId);
    }

    // 如果提供了 baseId 但模型不属于该 base，抛出错误
    if (param.baseId && model.base_id !== param.baseId) {
      throw new Error('Table not belong to base');
    }

    let view: View;

    // 如果提供了 viewId，获取视图
    if (param.viewId) {
      view = await View.get(context, param.viewId);
      // 如果视图不存在或不属于该模型，抛出错误
      if (!view || (view.fk_model_id && view.fk_model_id !== param.modelId)) {
        NcError.viewNotFound(param.viewId);
      }
    }

    // 返回模型和视图
    return { model, view };
  }

  // 提取 ID 对象的私有方法
  private async extractIdObj(
    context: NcContext,
    {
      model,
      body,
    }: {
      body: Record<string, any> | Record<string, any>[];
      model: Model;
    },
  ) {
    // 获取主键列
    const pkColumns = await model
      .getColumns(context)
      .then((cols) => cols.filter((col) => col.pk));

    // 从每行数据中提取主键值
    const result = (Array.isArray(body) ? body : [body]).map((row) => {
      return pkColumns.reduce((acc, col) => {
        acc[col.title] = row[col.title] ?? row[col.column_name];
        return acc;
      }, {});
    });

    // 返回结果，如果输入是数组则返回数组结果，否则返回单个结果
    return Array.isArray(body) ? result : result[0];
  }

  // 检查重复行的私有方法
  private async checkForDuplicateRow(
    context: NcContext,
    {
      rows,
      model,
    }: {
      rows: any[] | any;
      model: Model;
    },
  ) {
    // 如果没有行或只有一行，直接返回
    if (!rows || !Array.isArray(rows) || rows.length === 1) {
      return;
    }

    // 获取模型的列
    await model.getColumns(context);

    // 用于存储主键的集合
    const keys = new Set();

    // 遍历每一行
    for (const row of rows) {
      let pk;
      // 如果只有一个主键，则提取该值
      if (model.primaryKeys.length === 1)
        pk = row[model.primaryKey.title] ?? row[model.primaryKey.column_name];
      // 如果是复合主键，则将值用 ___ 连接
      else
        pk = model.primaryKeys
          .map((pk) =>
            (row[pk.title] ?? row[pk.column_name])
              ?.toString?.()
              ?.replaceAll('_', '\\_'),
          )
          .join('___');
      // 如果有重复，抛出错误
      if (keys.has(pk)) {
        NcError.unprocessableEntity('Duplicate record with id ' + pk);
      }

      // 如果主键为 undefined 或 null，抛出错误
      if (pk === undefined || pk === null) {
        NcError.unprocessableEntity('Primary key is required');
      }
      // 将主键添加到集合中
      keys.add(pk);
    }
  }

  // 获取嵌套数据列表方法
  async nestedDataList(
    context: NcContext,
    param: {
      viewId: string;
      modelId: string;
      query: any;
      rowId: string | string[] | number | number[];
      columnId: string;
      apiVersion?: NcApiVersion;
    },
  ) {
    // 获取模型和视图
    const { model, view } = await this.getModelAndView(context, param);
    // 获取数据源
    const source = await Source.get(context, model.source_id);
    // 获取基础模型 SQL
    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
    });

    // 检查行是否存在
    if (!(await baseModel.exist(param.rowId))) {
      NcError.recordNotFound(`${param.rowId}`);
    }

    // 获取列
    const column = await this.getColumn(context, param);
    // 获取列选项
    const colOptions = await column.getColOptions<LinkToAnotherRecordColumn>(
      context,
    );
    // 获取关联模型
    const relatedModel = await colOptions.getRelatedTable(context);

    // 获取抽象语法树和依赖字段
    const { ast, dependencyFields } = await getAst(context, {
      model: relatedModel,
      query: param.query,
      extractOnlyPrimaries: !(param.query?.f || param.query?.fields),
    });

    // 准备列表参数
    const listArgs: any = dependencyFields;
    // 尝试解析过滤数组 JSON
    try {
      listArgs.filterArr = JSON.parse(listArgs.filterArrJson);
    } catch (e) {}
    // 尝试解析排序数组 JSON
    try {
      listArgs.sortArr = JSON.parse(listArgs.sortArrJson);
    } catch (e) {}

    let data: any[];
    let count: number;
    // 根据关系类型获取数据
    if (colOptions.type === RelationTypes.MANY_TO_MANY) {
      // 多对多关系
      data = await baseModel.mmList(
        {
          colId: column.id,
          parentId: param.rowId,
          apiVersion: param.apiVersion,
        },
        listArgs as any,
      );
      // 获取计数
      count = (await baseModel.mmListCount(
        {
          colId: column.id,
          parentId: param.rowId,
        },
        param.query,
      )) as number;
    } else if (colOptions.type === RelationTypes.HAS_MANY) {
      // 一对多关系
      data = await baseModel.hmList(
        {
          colId: column.id,
          id: param.rowId,
          apiVersion: param.apiVersion,
        },
        listArgs as any,
      );
      // 获取计数
      count = (await baseModel.hmListCount(
        {
          colId: column.id,
          id: param.rowId,
        },
        param.query,
      )) as number;
    } else {
      // 多对一关系
      data = await baseModel.btRead(
        {
          colId: column.id,
          id: param.rowId,
          apiVersion: param.apiVersion,
        },
        param.query as any,
      );
    }

    // 执行 AST 处理
    data = await nocoExecute(ast, data, {}, listArgs);

    // 如果是多对一关系，直接返回数据
    if (colOptions.type === RelationTypes.BELONGS_TO) return data;

    // 返回分页响应
    return new PagedResponseImpl(data, {
      count,
      ...param.query,
    });
  }

  // 获取列的私有方法
  private async getColumn(
    context: NcContext,
    param: { modelId: string; columnId: string },
  ) {
    // 获取列
    const column = await Column.get(context, { colId: param.columnId });

    // 如果列不存在，抛出错误
    if (!column) NcError.fieldNotFound(param.columnId);

    // 如果列不属于该模型，抛出错误
    if (column.fk_model_id !== param.modelId)
      NcError.badRequest('Column not belong to model');

    // 如果列不是链接或 LTAR 类型，抛出错误
    if (!isLinksOrLTAR(column)) NcError.badRequest('Column is not LTAR');
    // 返回列
    return column;
  }

  // 嵌套链接方法
  async nestedLink(
    context: NcContext,
    param: {
      cookie: any;
      viewId: string;
      modelId: string;
      columnId: string;
      query: any;
      refRowIds:
        | string
        | string[]
        | number
        | number[]
        | Record<string, any>
        | Record<string, any>[];
      rowId: string;
    },
  ) {
    // 验证 ID
    this.validateIds(param.refRowIds);

    // 获取模型和视图
    const { model, view } = await this.getModelAndView(context, param);
    // 获取数据源
    const source = await Source.get(context, model.source_id);
    // 获取基础模型 SQL
    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
    });

    // 获取列
    const column = await this.getColumn(context, param);

    // 添加链接
    await baseModel.addLinks({
      colId: column.id,
      childIds: Array.isArray(param.refRowIds)
        ? param.refRowIds
        : [param.refRowIds],
      rowId: param.rowId,
      cookie: param.cookie,
    });

    // 返回成功标志
    return true;
  }

  // 嵌套取消链接方法
  async nestedUnlink(
    context: NcContext,
    param: {
      cookie: any;
      viewId: string;
      modelId: string;
      columnId: string;
      query: any;
      refRowIds: string | string[] | number | number[] | Record<string, any>;
      rowId: string;
    },
  ) {
    // 验证 ID
    this.validateIds(param.refRowIds);

    // 获取模型和视图
    const { model, view } = await this.getModelAndView(context, param);
    // 如果模型不存在，抛出错误
    if (!model) NcError.tableNotFound(param.modelId);

    // 获取数据源
    const source = await Source.get(context, model.source_id);
    // 获取基础模型 SQL
    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
    });

    // 获取列
    const column = await this.getColumn(context, param);

    // 移除链接
    await baseModel.removeLinks({
      colId: column.id,
      childIds: Array.isArray(param.refRowIds)
        ? param.refRowIds
        : [param.refRowIds],
      rowId: param.rowId,
      cookie: param.cookie,
    });

    // 返回成功标志
    return true;
  }

  // 嵌套列表复制粘贴或全部删除方法
  // todo: 命名和优化
  async nestedListCopyPasteOrDeleteAll(
    context: NcContext,
    param: {
      cookie: any;
      viewId: string;
      modelId: string;
      columnId: string;
      query: any;
      data: {
        operation: 'copy' | 'paste' | 'deleteAll';
        rowId: string;
        columnId: string;
        fk_related_model_id: string;
      }[];
    },
  ) {
    // 验证负载
    validatePayload(
      'swagger.json#/components/schemas/nestedListCopyPasteOrDeleteAllReq',
      param.data,
    );

    // 将操作映射到对象
    const operationMap = param.data.reduce(
      (map, p) => {
        map[p.operation] = p;
        return map;
      },
      {} as Record<
        'copy' | 'paste' | 'deleteAll',
        {
          operation: 'copy' | 'paste' | 'deleteAll';
          rowId: string;
          columnId: string;
          fk_related_model_id: string;
        }
      >,
    );

    // 如果不是删除全部操作，且复制和粘贴的关联模型 ID 不同，抛出错误
    if (
      !operationMap.deleteAll &&
      operationMap.copy.fk_related_model_id !==
        operationMap.paste.fk_related_model_id
    ) {
      throw new Error(
        'The operation is not supported on different fk_related_model_id',
      );
    }

    // 获取模型和视图
    const { model, view } = await this.getModelAndView(context, param);
    // 获取数据源
    const source = await Source.get(context, model.source_id);
    // 获取基础模型 SQL
    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
    });

    // 检查行是否存在
    if (
      operationMap.deleteAll &&
      !(await baseModel.exist(operationMap.deleteAll.rowId))
    ) {
      NcError.recordNotFound(operationMap.deleteAll.rowId);
    } else if (operationMap.copy && operationMap.paste) {
      // 检查复制和粘贴的行是否存在
      const [existsCopyRow, existsPasteRow] = await Promise.all([
        baseModel.exist(operationMap.copy.rowId),
        baseModel.exist(operationMap.paste.rowId),
      ]);

      // 如果两行都不存在，抛出错误
      if (!existsCopyRow && !existsPasteRow) {
        NcError.recordNotFound(
          `'${operationMap.copy.rowId}' and '${operationMap.paste.rowId}'`,
        );
      } else if (!existsCopyRow) {
        // 如果复制行不存在，抛出错误
        NcError.recordNotFound(operationMap.copy.rowId);
      } else if (!existsPasteRow) {
        // 如果粘贴行不存在，抛出错误
        NcError.recordNotFound(operationMap.paste.rowId);
      }
    }

    // 获取列
    const column = await this.getColumn(context, param);
    // 获取列选项
    const colOptions = await column.getColOptions<LinkToAnotherRecordColumn>(
      context,
    );
    // 获取关联模型
    const relatedModel = await colOptions.getRelatedTable(context);
    // 获取关联模型的列
    await relatedModel.getColumns(context);

    // 如果不是多对多关系，直接返回
    if (colOptions.type !== RelationTypes.MANY_TO_MANY) return;

    // 获取依赖字段
    const { dependencyFields } = await getAst(context, {
      model: relatedModel,
      query: param.query,
      extractOnlyPrimaries: !(param.query?.f || param.query?.fields),
    });

    // 准备列表参数
    const listArgs: any = dependencyFields;

    // 尝试解析过滤数组 JSON
    try {
      listArgs.filterArr = JSON.parse(listArgs.filterArrJson);
    } catch (e) {}

    // 尝试解析排序数组 JSON
    try {
      listArgs.sortArr = JSON.parse(listArgs.sortArrJson);
    } catch (e) {}

    // 处理删除全部操作
    if (operationMap.deleteAll) {
      // 获取要删除的嵌套列表
      let deleteCellNestedList = await baseModel.mmList(
        {
          colId: column.id,
          parentId: operationMap.deleteAll.rowId,
        },
        listArgs as any,
        true,
      );

      // 如果嵌套列表存在且是数组
      if (deleteCellNestedList && Array.isArray(deleteCellNestedList)) {
        // 移除链接
        await baseModel.removeLinks({
          colId: column.id,
          childIds: deleteCellNestedList,
          rowId: operationMap.deleteAll.rowId,
          cookie: param.cookie,
        });

        // 提取只包含主键的行数据
        deleteCellNestedList = deleteCellNestedList.map((nestedList) => {
          return relatedModel.primaryKeys.reduce((acc, col) => {
            acc[col.title || col.column_name] =
              nestedList[col.title || col.column_name];
            return acc;
          }, {});
        });
      } else {
        // 如果嵌套列表不存在或不是数组，设置为空数组
        deleteCellNestedList = [];
      }

      // 返回链接和取消链接的结果
      return { link: [], unlink: deleteCellNestedList };
    } else if (operationMap.copy && operationMap.paste) {
      // 获取复制和粘贴的嵌套列表
      const [copiedCellNestedList, pasteCellNestedList] = await Promise.all([
        baseModel.mmList(
          {
            colId: operationMap.copy.columnId,
            parentId: operationMap.copy.rowId,
          },
          listArgs as any,
          true,
        ),
        baseModel.mmList(
          {
            colId: column.id,
            parentId: operationMap.paste.rowId,
          },
          listArgs as any,
          true,
        ),
      ]);

      // 过滤出需要链接的行
      const filteredRowsToLink = this.filterAndMapRows(
        copiedCellNestedList,
        pasteCellNestedList,
        relatedModel.primaryKeys,
      );

      // 过滤出需要取消链接的行
      const filteredRowsToUnlink = this.filterAndMapRows(
        pasteCellNestedList,
        copiedCellNestedList,
        relatedModel.primaryKeys,
      );

      // 并行执行添加链接和移除链接操作
      await Promise.all([
        filteredRowsToLink.length &&
          baseModel.addLinks({
            colId: column.id,
            childIds: filteredRowsToLink,
            rowId: operationMap.paste.rowId,
            cookie: param.cookie,
          }),
        filteredRowsToUnlink.length &&
          baseModel.removeLinks({
            colId: column.id,
            childIds: filteredRowsToUnlink,
            rowId: operationMap.paste.rowId,
            cookie: param.cookie,
          }),
      ]);

      // 返回链接和取消链接的结果
      return { link: filteredRowsToLink, unlink: filteredRowsToUnlink };
    }
  }

  // 验证 ID 的私有方法
  private validateIds(rowIds: any[] | any) {
    // 如果是数组，检查每个 ID
    if (Array.isArray(rowIds)) {
      const map = new Map<string, boolean>();
      const set = new Set<string>();
      for (const rowId of rowIds) {
        // 如果 ID 为 undefined 或 null，抛出错误
        if (rowId === undefined || rowId === null)
          NcError.recordNotFound(rowId);
        // 如果 ID 已存在，添加到重复集合中
        if (map.has(rowId)) {
          set.add(rowId);
        } else {
          // 否则添加到映射中
          map.set(rowId, true);
        }
      }

      // 如果有重复 ID，抛出错误
      if (set.size > 0) NcError.duplicateRecord([...set]);
    } else if (rowIds === undefined || rowIds === null) {
      // 如果单个 ID 为 undefined 或 null，抛出错误
      NcError.recordNotFound(rowIds);
    }
  }
  // 过滤和映射行的私有方法
  private filterAndMapRows(
    sourceList: Record<string, any>[],
    targetList: Record<string, any>[],
    primaryKeys: Column<any>[],
  ): Record<string, any>[] {
    return sourceList
      .filter(
        (sourceRow: Record<string, any>) =>
          !targetList.some((targetRow: Record<string, any>) =>
            primaryKeys.every(
              (key) =>
                sourceRow[key.title || key.column_name] ===
                targetRow[key.title || key.column_name],
            ),
          ),
      )
      .map((item: Record<string, any>) =>
        primaryKeys.reduce((acc, key) => {
          acc[key.title || key.column_name] =
            item[key.title || key.column_name];
          return acc;
        }, {} as Record<string, any>),
      );
  }

  // 批量数据列表方法
  async bulkDataList(
    context: NcContext,
    param: {
      baseId?: string;
      modelId: string;
      viewId?: string;
      query: any;
      body: any;
    },
  ) {
    // 获取模型和视图
    const { model, view } = await this.getModelAndView(context, param);

    // 获取批量过滤列表
    let bulkFilterList = param.body;

    // 尝试解析 JSON
    try {
      bulkFilterList = JSON.parse(bulkFilterList);
    } catch (e) {}

    // 如果批量过滤列表无效，抛出错误
    if (!bulkFilterList?.length) {
      NcError.badRequest('Invalid bulkFilterList');
    }

    // 对每个过滤条件执行数据列表查询
    const dataListResults = await bulkFilterList.reduce(
      async (accPromise, dF: any) => {
        const acc = await accPromise;
        // 调用数据服务的 dataList 方法
        const result = await this.datasService.dataList(context, {
          query: {
            ...dF,
          },
          model,
          view,
        });
        // 将结果添加到累加器中
        acc[dF.alias] = result;
        return acc;
      },
      Promise.resolve({}),
    );

    // 返回数据列表结果
    return dataListResults;
  }

  // 批量分组方法
  async bulkGroupBy(
    context: NcContext,
    param: {
      baseId?: string;
      modelId: string;
      viewId?: string;
      query: any;
      body: any;
    },
  ) {
    // 获取模型和视图
    const { model, view } = await this.getModelAndView(context, param);
    // 获取数据源
    const source = await Source.get(context, model.source_id);
    // 获取基础模型 SQL
    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
    });

    // 获取批量过滤列表
    let bulkFilterList = param.body;

    // 准备列表参数
    const listArgs: any = { ...param.query };
    // 尝试解析批量过滤列表 JSON
    try {
      bulkFilterList = JSON.parse(bulkFilterList);
    } catch (e) {}

    // 尝试解析过滤数组 JSON
    try {
      listArgs.filterArr = JSON.parse(listArgs.filterArrJSON);
    } catch (e) {}

    // 如果批量过滤列表无效，抛出错误
    if (!bulkFilterList?.length) {
      NcError.badRequest('Invalid bulkFilterList');
    }

    // 并行执行批量分组和批量分组计数
    const [data, count] = await Promise.all([
      baseModel.bulkGroupBy(listArgs, bulkFilterList, view),
      baseModel.bulkGroupByCount(listArgs, bulkFilterList, view),
    ]);

    // 处理每个过滤条件的结果
    bulkFilterList.forEach((dF: any) => {
      // sqlite3 返回数据为字符串，需要转换为 JSON 对象
      let parsedData = data[dF.alias];

      if (typeof parsedData === 'string') {
        parsedData = JSON.parse(parsedData);
      }

      // 解析计数结果
      let parsedCount = count[dF.alias];

      if (typeof parsedCount === 'string') {
        parsedCount = JSON.parse(parsedCount);
      }

      // 创建分页响应
      data[dF.alias] = new PagedResponseImpl(parsedData, {
        ...dF,
        count: parsedCount?.count,
      });
    });

    // 返回数据
    return data;
  }
}
