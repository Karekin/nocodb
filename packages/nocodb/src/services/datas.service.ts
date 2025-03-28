// 导入 NestJS 的依赖注入和日志模块
import { Injectable, Logger } from '@nestjs/common';
// 导入 nocodb-sdk 中的工具函数，用于检查列是否为链接或LTAR类型以及是否为系统列
import { isLinksOrLTAR, isSystemColumn } from 'nocodb-sdk';
// 导入 XLSX 库用于处理 Excel 文件
import * as XLSX from 'xlsx';
// 导入 papaparse 库用于处理 CSV 文件
import papaparse from 'papaparse';
// 导入 NcApiVersion 类型
import type { NcApiVersion } from 'nocodb-sdk';
// 导入 BaseModelSqlv2 类型
import type { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';
// 导入 PathParams 类型
import type { PathParams } from '~/helpers/dataHelpers';
// 导入 NcContext 类型
import type { NcContext } from '~/interface/config';
// 导入 Filter 类型
import type { Filter } from '~/models';
// 导入 LinkToAnotherRecordColumn 类型
import type LinkToAnotherRecordColumn from '../models/LinkToAnotherRecordColumn';
// 导入 nocoExecute 工具函数
import { nocoExecute } from '~/utils';
// 导入数据帮助函数
import { getDbRows, getViewAndModelByAliasOrId } from '~/helpers/dataHelpers';
// 导入模型类
import { Base, Column, Model, Source, View } from '~/models';
// 导入错误处理类
import { NcBaseError, NcError } from '~/helpers/catchError';
// 导入 AST 生成函数
import getAst from '~/helpers/getAst';
// 导入分页响应实现类
import { PagedResponseImpl } from '~/helpers/PagedResponse';
// 导入连接管理器
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';

// 使用 Injectable 装饰器标记该服务可被依赖注入
@Injectable()
// 定义数据服务类
export class DatasService {
  // 创建一个受保护的日志记录器实例
  protected logger = new Logger(DatasService.name);

  // 构造函数
  constructor() {}

  // 获取数据列表的方法
  async dataList(
    // 上下文参数
    context: NcContext,
    // 方法参数，包含路径参数或视图和模型对象，以及查询参数和其他选项
    param: (PathParams | { view?: View; model: Model }) & {
      query: any;
      disableOptimization?: boolean;
      ignorePagination?: boolean;
      limitOverride?: number;
      throwErrorIfInvalidParams?: boolean;
      getHiddenColumns?: boolean;
      includeSortAndFilterColumns?: boolean;
      apiVersion?: NcApiVersion;
    },
  ) {
    // 从参数中解构出模型和视图
    let { model, view } = param as { view?: View; model?: Model };

    // 如果没有提供模型，则通过别名或ID获取模型和视图
    if (!model) {
      const modelAndView = await getViewAndModelByAliasOrId(
        context,
        param as PathParams,
      );
      model = modelAndView.model;
      view = modelAndView.view;
    }

    // 检查查询参数中是否有linkColumnId，并处理它
    if (param.query.linkColumnId) {
      // 获取链接列
      const linkColumn = await Column.get<LinkToAnotherRecordColumn>(context, {
        colId: param.query.linkColumnId,
      });

      // 验证链接列是否有效
      if (
        !linkColumn ||
        !isLinksOrLTAR(linkColumn) ||
        linkColumn.colOptions.fk_related_model_id !== model.id
      ) {
        // 如果链接列无效，抛出字段未找到错误
        NcError.fieldNotFound(param.query?.linkColumnId, {
          customMessage: `Link column with id ${param.query.linkColumnId} not found`,
        });
      }

      // 如果链接列有目标视图ID，则获取该视图
      if (linkColumn.colOptions.fk_target_view_id) {
        view = await View.get(context, linkColumn.colOptions.fk_target_view_id);
      }
    }

    // 调用getDataList方法获取数据列表
    return await this.getDataList(context, {
      model,
      view,
      query: param.query,
      throwErrorIfInvalidParams: true,
      ignorePagination: param.ignorePagination,
      limitOverride: param.limitOverride,
      getHiddenColumns: param.getHiddenColumns,
      apiVersion: param.apiVersion,
      includeSortAndFilterColumns: param.includeSortAndFilterColumns,
    });
  }

  // 查找单条数据记录的方法
  async dataFindOne(context: NcContext, param: PathParams & { query: any }) {
    // 通过别名或ID获取模型和视图
    const { model, view } = await getViewAndModelByAliasOrId(context, param);
    // 调用getFindOne方法获取单条记录
    return await this.getFindOne(context, { model, view, query: param.query });
  }

  // 数据分组方法
  async dataGroupBy(context: NcContext, param: PathParams & { query: any }) {
    // 通过别名或ID获取模型和视图
    const { model, view } = await getViewAndModelByAliasOrId(context, param);
    // 调用getDataGroupBy方法获取分组数据
    return await this.getDataGroupBy(context, {
      model,
      view,
      query: param.query,
    });
  }

  // 获取数据计数的方法
  async dataCount(context: NcContext, param: PathParams & { query: any }) {
    // 通过别名或ID获取模型和视图
    const { model, view } = await getViewAndModelByAliasOrId(context, param);

    // 获取数据源
    const source = await Source.get(context, model.source_id);

    // 获取基础模型SQL实例
    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    // 准备计数参数
    const countArgs: any = { ...param.query, throwErrorIfInvalidParams: true };
    // 尝试解析过滤数组JSON
    try {
      countArgs.filterArr = JSON.parse(countArgs.filterArrJson);
    } catch (e) {}

    // 调用count方法获取计数
    const count: number = await baseModel.count(countArgs);

    // 返回计数结果
    return { count };
  }

  // 插入数据的方法
  async dataInsert(
    context: NcContext,
    param: PathParams & {
      body: unknown;
      cookie: any;
      disableOptimization?: boolean;
      query: any;
    },
  ) {
    // 通过别名或ID获取模型和视图
    const { model, view } = await getViewAndModelByAliasOrId(context, param);

    // 获取数据源
    const source = await Source.get(context, model.source_id);

    // 获取基础模型SQL实例
    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    // 调用嵌套插入方法插入数据
    return await baseModel.nestedInsert(
      param.body,
      param.cookie,
      null,
      param?.query,
    );
  }

  // 更新数据的方法
  async dataUpdate(
    context: NcContext,
    param: PathParams & {
      body: unknown;
      cookie: any;
      rowId: string;
      disableOptimization?: boolean;
    },
  ) {
    // 通过别名或ID获取模型和视图
    const { model, view } = await getViewAndModelByAliasOrId(context, param);
    // 获取数据源
    const source = await Source.get(context, model.source_id);

    // 获取基础模型SQL实例
    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    // 通过主键更新数据
    return await baseModel.updateByPk(
      param.rowId,
      param.body,
      null,
      param.cookie,
      param.disableOptimization,
    );
  }

  // 删除数据的方法
  async dataDelete(
    context: NcContext,
    param: PathParams & { rowId: string; cookie: any },
  ) {
    // 通过别名或ID获取模型和视图
    const { model, view } = await getViewAndModelByAliasOrId(context, param);
    // 获取数据源
    const source = await Source.get(context, model.source_id);
    // 获取基础模型SQL实例
    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    // 如果不是元数据源，检查LTAR数据
    if (!source.isMeta()) {
      // 检查是否有LTAR数据
      const message = await baseModel.hasLTARData(param.rowId, model);
      if (message.length) {
        // 如果有LTAR数据，抛出错误
        NcError.badRequest(message);
      }
    }

    // 通过主键删除数据
    return await baseModel.delByPk(param.rowId, null, param.cookie);
  }

  // 获取数据列表的核心方法
  async getDataList(
    context: NcContext,
    param: {
      model: Model;
      view?: View;
      query: any;
      baseModel?: BaseModelSqlv2;
      throwErrorIfInvalidParams?: boolean;
      ignoreViewFilterAndSort?: boolean;
      ignorePagination?: boolean;
      limitOverride?: number;
      customConditions?: Filter[];
      getHiddenColumns?: boolean;
      apiVersion?: NcApiVersion;
      includeSortAndFilterColumns?: boolean;
    },
  ) {
    // 从参数中解构出需要的变量
    const {
      model,
      view: view,
      query = {},
      ignoreViewFilterAndSort = false,
      includeSortAndFilterColumns = false,
      apiVersion,
    } = param;

    // 获取数据源
    const source = await Source.get(context, model.source_id);

    // 获取基础模型SQL实例，如果已提供则使用提供的实例
    const baseModel =
      param.baseModel ||
      (await Model.getBaseModelSQL(context, {
        id: model.id,
        viewId: view?.id,
        dbDriver: await NcConnectionMgrv2.get(source),
        source,
      }));

    // 获取AST和依赖字段
    const { ast, dependencyFields } = await getAst(context, {
      model,
      query,
      view: view,
      throwErrorIfInvalidParams: param.throwErrorIfInvalidParams,
      getHiddenColumn: param.getHiddenColumns,
      apiVersion,
      includeSortAndFilterColumns: includeSortAndFilterColumns,
    });

    // 准备列表参数
    const listArgs: any = dependencyFields;
    // 尝试解析过滤数组JSON
    try {
      listArgs.filterArr = JSON.parse(listArgs.filterArrJson);
    } catch (e) {}
    // 尝试解析排序数组JSON
    try {
      listArgs.sortArr = JSON.parse(listArgs.sortArrJson);
    } catch (e) {}

    // 设置自定义条件
    listArgs.customConditions = param.customConditions;

    // 并行获取数据计数和数据列表
    const [count, data] = await Promise.all([
      // 获取数据计数
      baseModel.count(listArgs, false, param.throwErrorIfInvalidParams),
      // 获取数据列表
      (async () => {
        let data = [];
        try {
          // 执行查询并处理结果
          data = await nocoExecute(
            ast,
            await baseModel.list(
              { ...listArgs, apiVersion: param.apiVersion },
              {
                ignoreViewFilterAndSort,
                throwErrorIfInvalidParams: param.throwErrorIfInvalidParams,
                ignorePagination: param.ignorePagination,
                limitOverride: param.limitOverride,
              },
            ),
            {},
            listArgs,
          );
        } catch (e) {
          // 如果是NcBaseError类型的错误，直接抛出
          if (e instanceof NcBaseError) throw e;
          // 记录错误日志
          this.logger.error(e);
          // 抛出内部服务器错误
          NcError.internalServerError(
            'Please check server log for more details',
          );
        }
        return data;
      })(),
    ]);
    // 返回分页响应
    return new PagedResponseImpl(data, {
      ...query,
      ...(param.limitOverride ? { limitOverride: param.limitOverride } : {}),
      count,
    });
  }

  // 获取单条记录的方法
  async getFindOne(
    context: NcContext,
    param: { model: Model; view: View; query: any },
  ) {
    // 从参数中解构出需要的变量
    const { model, view, query = {} } = param;

    // 获取数据源
    const source = await Source.get(context, model.source_id);

    // 获取基础模型SQL实例
    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    // 准备参数
    const args: any = { ...query };
    // 尝试解析过滤数组JSON
    try {
      args.filterArr = JSON.parse(args.filterArrJson);
    } catch (e) {}
    // 尝试解析排序数组JSON
    try {
      args.sortArr = JSON.parse(args.sortArrJson);
    } catch (e) {}

    // 获取AST和依赖字段
    const { ast, dependencyFields } = await getAst(context, {
      model,
      query: args,
      view,
    });

    // 查找单条记录
    const data = await baseModel.findOne({ ...args, ...dependencyFields });
    // 如果找到数据，处理并返回；否则返回空对象
    return data ? await nocoExecute(ast, data, {}, dependencyFields) : {};
  }

  // 获取分组数据的方法
  async getDataGroupBy(
    context: NcContext,
    param: { model: Model; view: View; query?: any },
  ) {
    // 从参数中解构出需要的变量
    const { model, view, query = {} } = param;

    // 获取数据源
    const source = await Source.get(context, model.source_id);

    // 获取基础模型SQL实例
    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    // 准备列表参数
    const listArgs: any = { ...query };

    // 尝试解析过滤数组JSON
    try {
      listArgs.filterArr = JSON.parse(listArgs.filterArrJson);
    } catch (e) {}
    // 尝试解析排序数组JSON
    try {
      listArgs.sortArr = JSON.parse(listArgs.sortArrJson);
    } catch (e) {}

    // 获取分组数据
    const data = await baseModel.groupBy(listArgs);
    // 获取分组数据计数
    const count = await baseModel.groupByCount(listArgs);

    // 返回分页响应
    return new PagedResponseImpl(data, {
      ...query,
      count,
    });
  }

  // 读取单条数据的方法
  async dataRead(
    context: NcContext,
    param: PathParams & {
      query: any;
      rowId: string;
      disableOptimization?: boolean;
      getHiddenColumn?: boolean;
    },
  ) {
    // 通过别名或ID获取模型和视图
    const { model, view } = await getViewAndModelByAliasOrId(context, param);

    // 获取数据源
    const source = await Source.get(context, model.source_id);

    // 获取基础模型SQL实例
    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });
    // 通过主键读取数据
    const row = await baseModel.readByPk(param.rowId, false, param.query, {
      getHiddenColumn: param.getHiddenColumn,
    });

    // 如果没有找到记录，抛出记录未找到错误
    if (!row) {
      NcError.recordNotFound(param.rowId);
    }

    // 返回找到的记录
    return row;
  }

  // 检查数据是否存在的方法
  async dataExist(
    context: NcContext,
    param: PathParams & { rowId: string; query: any },
  ) {
    // 通过别名或ID获取模型和视图
    const { model, view } = await getViewAndModelByAliasOrId(context, param);

    // 获取数据源
    const source = await Source.get(context, model.source_id);

    // 获取基础模型SQL实例
    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    // 检查记录是否存在
    return await baseModel.exist(param.rowId);
  }

  // 获取分组数据列表的方法
  // TODO: 处理视图不属于模型的错误情况
  async groupedDataList(
    context: NcContext,
    param: PathParams & { query: any; columnId: string },
  ) {
    // 通过别名或ID获取模型和视图
    const { model, view } = await getViewAndModelByAliasOrId(context, param);
    // 获取分组数据列表
    const groupedData = await this.getGroupedDataList(context, {
      model,
      view,
      query: param.query,
      columnId: param.columnId,
    });
    return groupedData;
  }

  // 获取分组数据列表的核心方法
  async getGroupedDataList(
    context: NcContext,
    param: {
      model;
      view: View;
      query: any;
      columnId: string;
    },
  ) {
    // 从参数中解构出需要的变量
    const { model, view, query = {} } = param;

    // 获取数据源
    const source = await Source.get(context, model.source_id);

    // 获取基础模型SQL实例
    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    // 获取AST和依赖字段
    const { ast, dependencyFields } = await getAst(context, {
      model,
      query,
      view,
    });

    // 准备列表参数
    const listArgs: any = { ...dependencyFields };
    // 尝试解析过滤数组JSON
    try {
      listArgs.filterArr = JSON.parse(listArgs.filterArrJson);
    } catch (e) {}
    // 尝试解析排序数组JSON
    try {
      listArgs.sortArr = JSON.parse(listArgs.sortArrJson);
    } catch (e) {}
    // 尝试解析选项数组JSON
    try {
      listArgs.options = JSON.parse(listArgs.optionsArrJson);
    } catch (e) {}

    // 初始化数据数组
    let data = [];

    // 获取分组列表数据
    const groupedData = await baseModel.groupedList({
      ...listArgs,
      groupColumnId: param.columnId,
    });
    // 处理分组数据
    data = await nocoExecute({ key: 1, value: ast }, groupedData, {}, listArgs);
    // 获取分组列表计数
    const countArr = await baseModel.groupedListCount({
      ...listArgs,
      groupColumnId: param.columnId,
    });
    // 处理每个分组项，添加分页信息
    data = data.map((item) => {
      // TODO: 使用map避免循环
      const count =
        countArr.find((countItem: any) => countItem.key === item.key)?.count ??
        0;

      // 为每个分组项添加分页响应
      item.value = new PagedResponseImpl(item.value, {
        ...query,
        count: count,
      });
      return item;
    });

    // 返回处理后的分组数据
    return data;
  }

  // 通过视图ID获取数据列表的方法
  async dataListByViewId(
    context: NcContext,
    param: { viewId: string; query: any; apiVersion?: NcApiVersion },
  ) {
    // 获取视图
    const view = await View.get(context, param.viewId);

    // 通过ID或名称获取模型
    const model = await Model.getByIdOrName(context, {
      id: view?.fk_model_id || param.viewId,
    });

    // 如果没有找到模型，抛出表未找到错误
    if (!model) NcError.tableNotFound(view?.fk_model_id || param.viewId);

    // 获取数据列表
    return await this.getDataList(context, {
      model,
      view,
      query: param.query,
      apiVersion: param.apiVersion,
    });
  }

  // 获取多对多关系列表的方法
  async mmList(
    context: NcContext,
    param: {
      viewId: string;
      colId: string;
      query: any;
      rowId: string;
    },
  ) {
    // 获取视图
    const view = await View.get(context, param.viewId);

    // 通过ID或名称获取模型
    const model = await Model.getByIdOrName(context, {
      id: view?.fk_model_id || param.viewId,
    });

    // 如果没有找到模型，抛出表未找到错误
    if (!model) NcError.tableNotFound(view?.fk_model_id || param.viewId);

    // 获取数据源
    const source = await Source.get(context, model.source_id);

    // 获取基础模型SQL实例
    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    // 创建请求对象的键
    const key = `${model.title}List`;
    // 创建请求对象
    const requestObj: any = {
      [key]: 1,
    };

    // 执行查询并获取数据
    const data = (
      await nocoExecute(
        requestObj,
        {
          [key]: async (args) => {
            return await baseModel.mmList(
              {
                colId: param.colId,
                parentId: param.rowId,
              },
              args,
            );
          },
        },
        {},

        { nested: { [key]: param.query } },
      )
    )?.[key];

    // 获取计数
    const count: any = await baseModel.mmListCount(
      {
        colId: param.colId,
        parentId: param.rowId,
      },
      param.query,
    );

    // 返回分页响应
    return new PagedResponseImpl(data, {
      count,
      ...param.query,
    });
  }

  // 获取多对多关系排除列表的方法
  async mmExcludedList(
    context: NcContext,
    param: {
      viewId: string;
      colId: string;
      query: any;
      rowId: string;
    },
  ) {
    // 获取视图
    const view = await View.get(context, param.viewId);

    // 通过ID或名称获取模型
    const model = await Model.getByIdOrName(context, {
      id: view?.fk_model_id || param.viewId,
    });

    // 如果没有找到模型，抛出表未找到错误
    if (!model) NcError.tableNotFound(view?.fk_model_id || param.viewId);

    // 获取数据源
    const source = await Source.get(context, model.source_id);

    // 获取基础模型SQL实例
    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    // 创建请求对象的键
    const key = 'List';
    // 创建请求对象
    const requestObj: any = {
      [key]: 1,
    };

    // 执行查询并获取数据
    const data = (
      await nocoExecute(
        requestObj,
        {
          [key]: async (args) => {
            return await baseModel.getMmChildrenExcludedList(
              {
                colId: param.colId,
                pid: param.rowId,
              },
              args,
            );
          },
        },
        {},

        { nested: { [key]: param.query } },
      )
    )?.[key];

    // 获取计数
    const count = await baseModel.getMmChildrenExcludedListCount(
      {
        colId: param.colId,
        pid: param.rowId,
      },
      param.query,
    );

    // 返回分页响应
    return new PagedResponseImpl(data, {
      count,
      ...param.query,
    });
  }

  // 获取一对多关系排除列表的方法
  async hmExcludedList(
    context: NcContext,
    param: {
      viewId: string;
      colId: string;
      query: any;
      rowId: string;
    },
  ) {
    // 获取视图
    const view = await View.get(context, param.viewId);

    // 通过ID或名称获取模型
    const model = await Model.getByIdOrName(context, {
      id: view?.fk_model_id || param.viewId,
    });

    // 如果没有找到模型，抛出表未找到错误
    if (!model) NcError.tableNotFound(view?.fk_model_id || param.viewId);

    // 获取数据源
    const source = await Source.get(context, model.source_id);

    // 获取基础模型SQL实例
    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    // 创建请求对象的键
    const key = 'List';
    // 创建请求对象
    const requestObj: any = {
      [key]: 1,
    };

    // 执行查询并获取数据
    const data = (
      await nocoExecute(
        requestObj,
        {
          [key]: async (args) => {
            return await baseModel.getHmChildrenExcludedList(
              {
                colId: param.colId,
                pid: param.rowId,
              },
              args,
            );
          },
        },
        {},

        { nested: { [key]: param.query } },
      )
    )?.[key];

    // 获取计数
    const count = await baseModel.getHmChildrenExcludedListCount(
      {
        colId: param.colId,
        pid: param.rowId,
      },
      param.query,
    );

    // 返回分页响应
    return new PagedResponseImpl(data, {
      count,
      ...param.query,
    });
  }

  // 获取属于关系排除列表的方法
  // 获取属于关系排除列表的方法
  async btExcludedList(
    // 上下文参数
    context: NcContext,
    // 方法参数，包含视图ID、列ID、查询参数和行ID
    param: {
      viewId: string;
      colId: string;
      query: any;
      rowId: string;
    },
  ) {
    // 获取视图
    const view = await View.get(context, param.viewId);

    // 通过ID或名称获取模型
    const model = await Model.getByIdOrName(context, {
      id: view?.fk_model_id || param.viewId,
    });

    // 如果没有找到模型，返回表未找到错误
    if (!model) return NcError.tableNotFound(view?.fk_model_id || param.viewId);

    // 获取数据源
    const source = await Source.get(context, model.source_id);

    // 获取基础模型SQL实例
    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    // 创建请求对象的键
    const key = 'List';
    // 创建请求对象
    const requestObj: any = {
      [key]: 1,
    };

    // 执行查询并获取数据
    const data = (
      await nocoExecute(
        requestObj,
        {
          // 定义异步函数获取排除的子记录列表
          [key]: async (args) => {
            return await baseModel.getBtChildrenExcludedList(
              {
                // 设置列ID和当前记录ID
                colId: param.colId,
                cid: param.rowId,
              },
              args,
            );
          },
        },
        // 空对象参数
        {},
        // 嵌套查询参数
        { nested: { [key]: param.query } },
      )
    )?.[key];

    // 获取排除列表的计数
    const count = await baseModel.getBtChildrenExcludedListCount(
      {
        // 设置列ID和当前记录ID
        colId: param.colId,
        cid: param.rowId,
      },
      param.query,
    );

    // 返回分页响应
    return new PagedResponseImpl(data, {
      count,
      ...param.query,
    });
  }

  // 获取一对多关系列表的方法
  async hmList(
    // 上下文参数
    context: NcContext,
    // 方法参数，包含视图ID、列ID、查询参数和行ID
    param: {
      viewId: string;
      colId: string;
      query: any;
      rowId: string;
    },
  ) {
    // 获取视图
    const view = await View.get(context, param.viewId);

    // 通过ID或名称获取模型
    const model = await Model.getByIdOrName(context, {
      id: view?.fk_model_id || param.viewId,
    });

    // 如果没有找到模型，抛出表未找到错误
    if (!model) NcError.tableNotFound(view?.fk_model_id || param.viewId);

    // 获取数据源
    const source = await Source.get(context, model.source_id);

    // 获取基础模型SQL实例
    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    // 创建请求对象的键，使用模型标题
    const key = `${model.title}List`;
    // 创建请求对象
    const requestObj: any = {
      [key]: 1,
    };

    // 执行查询并获取数据
    const data = (
      await nocoExecute(
        requestObj,
        {
          // 定义异步函数获取一对多关系列表
          [key]: async (args) => {
            return await baseModel.hmList(
              {
                // 设置列ID和记录ID
                colId: param.colId,
                id: param.rowId,
              },
              args,
            );
          },
        },
        // 空对象参数
        {},
        // 嵌套查询参数
        { nested: { [key]: param.query } },
      )
    )?.[key];

    // 获取一对多关系列表的计数
    const count = await baseModel.hmListCount(
      {
        // 设置列ID和记录ID
        colId: param.colId,
        id: param.rowId,
      },
      param.query,
    );

    // 返回分页响应，使用totalRows作为计数
    return new PagedResponseImpl(data, {
      totalRows: count,
    } as any);
  }

  // 通过视图ID读取数据的方法
  async dataReadByViewId(
    // 上下文参数
    context: NcContext,
    // 方法参数，包含视图ID、行ID和查询参数
    param: { viewId: string; rowId: string; query: any },
  ) {
    try {
      // 通过ID或名称获取模型
      const model = await Model.getByIdOrName(context, {
        id: param.viewId,
      });
      // 如果没有找到模型，抛出表未找到错误
      if (!model) NcError.tableNotFound(param.viewId);

      // 获取数据源
      const source = await Source.get(context, model.source_id);

      // 获取基础模型SQL实例
      const baseModel = await Model.getBaseModelSQL(context, {
        id: model.id,
        dbDriver: await NcConnectionMgrv2.get(source),
        source,
      });

      // 获取AST和依赖字段
      const { ast, dependencyFields } = await getAst(context, {
        model,
        query: param.query,
      });

      // 执行查询并返回结果
      return await nocoExecute(
        ast,
        await baseModel.readByPk(param.rowId, false),
        {},
        dependencyFields,
      );
    } catch (e) {
      // 记录错误日志
      this.logger.error(e);
      // 抛出内部服务器错误
      NcError.internalServerError('Please check server log for more details');
    }
  }

  // 通过视图ID插入数据的方法
  async dataInsertByViewId(
    // 上下文参数
    context: NcContext,
    // 方法参数，包含视图ID、请求体和cookie
    param: { viewId: string; body: any; cookie: any },
  ) {
    // 通过ID或名称获取模型
    const model = await Model.getByIdOrName(context, {
      id: param.viewId,
    });
    // 如果没有找到模型，返回表未找到错误
    if (!model) return NcError.tableNotFound(param.viewId);

    // 获取数据源
    const source = await Source.get(context, model.source_id);

    // 获取基础模型SQL实例
    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    // 插入数据并返回结果
    return await baseModel.insert(param.body, null, param.cookie);
  }

  // 通过视图ID更新数据的方法
  async dataUpdateByViewId(
    // 上下文参数
    context: NcContext,
    // 方法参数，包含视图ID、行ID、请求体和cookie
    param: {
      viewId: string;
      rowId: string;
      body: any;
      cookie: any;
    },
  ) {
    // 通过ID或名称获取模型
    const model = await Model.getByIdOrName(context, {
      id: param.viewId,
    });
    // 如果没有找到模型，抛出表未找到错误
    if (!model) NcError.tableNotFound(param.viewId);

    // 获取数据源
    const source = await Source.get(context, model.source_id);

    // 获取基础模型SQL实例
    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    // 通过主键更新数据并返回结果
    return await baseModel.updateByPk(
      param.rowId,
      param.body,
      null,
      param.cookie,
    );
  }

  // 通过视图ID删除数据的方法
  async dataDeleteByViewId(
    // 上下文参数
    context: NcContext,
    // 方法参数，包含视图ID、行ID和cookie
    param: {
      viewId: string;
      rowId: string;
      cookie: any;
    },
  ) {
    // 通过ID或名称获取模型
    const model = await Model.getByIdOrName(context, {
      id: param.viewId,
    });
    // 如果没有找到模型，抛出表未找到错误
    if (!model) NcError.tableNotFound(param.viewId);

    // 获取数据源
    const source = await Source.get(context, model.source_id);

    // 获取基础模型SQL实例
    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    // 通过主键删除数据并返回结果
    return await baseModel.delByPk(param.rowId, null, param.cookie);
  }

  // 删除关系数据的方法
  async relationDataDelete(
    // 上下文参数
    context: NcContext,
    // 方法参数，包含视图ID、列ID、子记录ID、行ID和cookie
    param: {
      viewId: string;
      colId: string;
      childId: string;
      rowId: string;
      cookie: any;
    },
  ) {
    // 获取视图
    const view = await View.get(context, param.viewId);

    // 通过ID或名称获取模型
    const model = await Model.getByIdOrName(context, {
      id: view?.fk_model_id || param.viewId,
    });

    // 如果没有找到模型，抛出表未找到错误
    if (!model) NcError.tableNotFound(view?.fk_model_id || param.viewId);

    // 获取数据源
    const source = await Source.get(context, model.source_id);

    // 获取基础模型SQL实例
    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    // 移除子记录
    await baseModel.removeChild({
      colId: param.colId,
      childId: param.childId,
      rowId: param.rowId,
      cookie: param.cookie,
    });

    // 返回成功标志
    return true;
  }

  // 添加关系数据的方法
  async relationDataAdd(
    // 上下文参数
    context: NcContext,
    // 方法参数，包含视图ID、列ID、子记录ID、行ID和cookie
    param: {
      viewId: string;
      colId: string;
      childId: string;
      rowId: string;
      cookie: any;
    },
  ) {
    // 获取视图
    const view = await View.get(context, param.viewId);

    // 通过ID或名称获取模型
    const model = await Model.getByIdOrName(context, {
      id: view?.fk_model_id || param.viewId,
    });

    // 如果没有找到模型，抛出表未找到错误
    if (!model) NcError.tableNotFound(view?.fk_model_id || param.viewId);

    // 获取数据源
    const source = await Source.get(context, model.source_id);

    // 获取基础模型SQL实例
    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    // 添加子记录
    await baseModel.addChild({
      colId: param.colId,
      childId: param.childId,
      rowId: param.rowId,
      cookie: param.cookie,
    });

    // 返回成功标志
    return true;
  }

  // 从请求中通过别名或ID获取视图和模型的方法
  async getViewAndModelFromRequestByAliasOrId(
    // 上下文参数
    context: NcContext,
    // 请求对象
    req,
    // 注释掉的类型定义
    // :
    // | Request<{ baseName: string; tableName: string; viewName?: string }>
    // | Request,
  ) {
    // 通过标题或ID获取基础信息
    const base = await Base.getWithInfoByTitleOrId(
      context,
      req.params.baseName,
    );

    // 通过别名或ID获取模型
    const model = await Model.getByAliasOrId(context, {
      base_id: base.id,
      aliasOrId: req.params.tableName,
    });
    // 如果提供了视图名称，则通过标题或ID获取视图
    const view =
      req.params.viewName &&
      (await View.getByTitleOrId(context, {
        titleOrId: req.params.viewName,
        fk_model_id: model.id,
      }));
    // 如果没有找到模型，抛出表未找到错误
    if (!model) NcError.tableNotFound(req.params.tableName);
    // 返回模型和视图
    return { model, view };
  }

  // 提取Excel数据的方法
  async extractXlsxData(
    // 上下文参数
    context: NcContext,
    // 方法参数，包含视图、查询参数和站点URL
    param: { view: View; query: any; siteUrl: string },
  ) {
    // 从参数中解构出需要的变量
    const { view, query, siteUrl } = param;
    // 获取数据源
    const source = await Source.get(context, view.source_id);

    // 获取视图的模型信息
    await view.getModelWithInfo(context);
    // 获取视图的列
    await view.getColumns(context);

    // 过滤和处理视图的列
    view.model.columns = view.columns
      .filter((c) => c.show)
      .map(
        (c) =>
          new Column({
            ...c,
            ...view.model.columnsById[c.fk_column_id],
          } as any),
      )
      .filter((column) => !isSystemColumn(column) || view.show_system_fields);

    // 获取基础模型SQL实例
    const baseModel = await Model.getBaseModelSQL(context, {
      id: view.model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    // 获取数据库行数据
    const { offset, dbRows, elapsed } = await getDbRows(context, {
      baseModel,
      view,
      query,
      siteUrl,
    });

    // 获取字段列表
    const fields = query.fields as string[];

    // 将数据转换为Excel工作表
    const data = XLSX.utils.json_to_sheet(dbRows, { header: fields });

    // 返回结果
    return { offset, dbRows, elapsed, data };
  }

  // 提取CSV数据的方法
  async extractCsvData(
    // 上下文参数
    context: NcContext,
    // 视图参数
    view: View,
    // 请求对象
    req,
  ) {
    // 获取数据源
    const source = await Source.get(context, view.source_id);
    // 获取字段列表
    const fields = req.query.fields;

    // 获取视图的模型信息
    await view.getModelWithInfo(context);
    // 获取视图的列
    await view.getColumns(context);

    // 过滤和处理视图的列
    view.model.columns = view.columns
      .filter((c) => c.show)
      .map(
        (c) =>
          new Column({
            ...c,
            ...view.model.columnsById[c.fk_column_id],
          } as any),
      )
      .filter((column) => !isSystemColumn(column) || view.show_system_fields);

    // 获取基础模型SQL实例
    const baseModel = await Model.getBaseModelSQL(context, {
      id: view.model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    // 获取数据库行数据
    const { offset, dbRows, elapsed } = await getDbRows(context, {
      baseModel,
      view,
      query: req.query,
      siteUrl: (req as any).ncSiteUrl,
    });

    // 使用papaparse将数据转换为CSV格式
    const data = papaparse.unparse(
      {
        // 处理字段顺序和过滤
        fields: view.model.columns
          .sort((c1, c2) =>
            Array.isArray(fields)
              ? fields.indexOf(c1.title as any) -
                fields.indexOf(c2.title as any)
              : 0,
          )
          .filter(
            (c) =>
              !fields ||
              !Array.isArray(fields) ||
              fields.includes(c.title as any),
          )
          .map((c) => c.title),
        data: dbRows,
      },
      {
        // 转义公式以防止CSV注入
        escapeFormulae: true,
      },
    );

    // 返回结果
    return { offset, dbRows, elapsed, data };
  }

  // 通过ID或名称获取列的方法
  async getColumnByIdOrName(
    // 上下文参数
    context: NcContext,
    // 列名或ID
    columnNameOrId: string,
    // 模型
    model: Model,
  ) {
    // 获取模型的所有列，并查找匹配的列
    const column = (await model.getColumns(context)).find(
      (c) =>
        c.title === columnNameOrId ||
        c.id === columnNameOrId ||
        c.column_name === columnNameOrId,
    );

    // 如果没有找到列，抛出字段未找到错误
    if (!column) NcError.fieldNotFound(columnNameOrId);

    // 返回找到的列
    return column;
  }
}
