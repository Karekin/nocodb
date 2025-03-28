// 导入NestJS的Injectable装饰器，用于标记该类可以被依赖注入系统使用
import { Injectable } from '@nestjs/common';
// 导入UI类型定义，用于识别字段类型
import { UITypes } from 'nocodb-sdk';
// 导入路径参数类型定义
import type { PathParams } from '~/helpers/dataHelpers';
// 导入NocoDB上下文接口定义
import type { NcContext } from '~/interface/config';
// 导入错误处理工具
import { NcError } from '~/helpers/catchError';
// 导入分页响应实现类
import { PagedResponseImpl } from '~/helpers/PagedResponse';
// 导入数据辅助函数，用于获取列和视图/模型
import {
  getColumnByIdOrName,
  getViewAndModelByAliasOrId,
} from '~/helpers/dataHelpers';
// 导入Model和Source模型
import { Model, Source } from '~/models';
// 导入连接管理器
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';

// 使用Injectable装饰器标记该服务可被依赖注入
@Injectable()
// 数据别名嵌套服务类，处理嵌套数据关系的操作
export class DataAliasNestedService {
  // todo: handle case where the given column is not ltar
  // 获取多对多关系列表数据
  async mmList(
    // 上下文参数
    context: NcContext,
    // 路径参数，包含查询条件、列名和行ID
    param: PathParams & {
      query: any;
      columnName: string;
      rowId: string;
    },
  ) {
    // 通过别名或ID获取视图和模型
    const { model, view } = await getViewAndModelByAliasOrId(context, param);

    // 如果模型不存在，抛出表未找到错误
    if (!model) NcError.tableNotFound(param.tableName);

    // 获取数据源
    const source = await Source.get(context, model.source_id);

    // 获取基础模型SQL实例
    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    // 通过ID或名称获取列
    const column = await getColumnByIdOrName(context, param.columnName, model);

    // 验证列是否存在且是否为链接到另一条记录类型
    if (
      !column ||
      ![UITypes.LinkToAnotherRecord, UITypes.Links].includes(column.uidt)
    )
      NcError.badRequest('Column is not LTAR');

    // 获取多对多关系数据
    const data = await baseModel.mmList(
      {
        colId: column.id,
        parentId: param.rowId,
      },
      param.query as any,
    );
    // 获取数据总数
    const count: any = await baseModel.mmListCount(
      {
        colId: column.id,
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

  // 获取多对多关系排除列表数据
  async mmExcludedList(
    // 上下文参数
    context: NcContext,
    // 路径参数，包含查询条件、列名和行ID
    param: PathParams & {
      query: any;
      columnName: string;
      rowId: string;
    },
  ) {
    // 通过别名或ID获取视图和模型
    const { model, view } = await getViewAndModelByAliasOrId(context, param);
    // 如果模型不存在，抛出表未找到错误
    if (!model) NcError.tableNotFound(param.tableName);

    // 获取数据源
    const source = await Source.get(context, model.source_id);

    // 获取基础模型SQL实例
    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });
    // 通过ID或名称获取列
    const column = await getColumnByIdOrName(context, param.columnName, model);

    // 获取多对多关系排除列表数据
    const data = await baseModel.getMmChildrenExcludedList(
      {
        colId: column.id,
        pid: param.rowId,
      },
      param.query,
    );

    // 获取排除列表数据总数
    const count = await baseModel.getMmChildrenExcludedListCount(
      {
        colId: column.id,
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

  // 获取一对多关系排除列表数据
  async hmExcludedList(
    // 上下文参数
    context: NcContext,
    // 路径参数，包含查询条件、列名和行ID
    param: PathParams & {
      query: any;
      columnName: string;
      rowId: string;
    },
  ) {
    // 通过别名或ID获取视图和模型
    const { model, view } = await getViewAndModelByAliasOrId(context, param);

    // 如果模型不存在，抛出表未找到错误
    if (!model) NcError.tableNotFound(param.tableName);

    // 获取数据源
    const source = await Source.get(context, model.source_id);

    // 获取基础模型SQL实例
    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    // 通过ID或名称获取列
    const column = await getColumnByIdOrName(context, param.columnName, model);

    // 获取一对多关系排除列表数据
    const data = await baseModel.getHmChildrenExcludedList(
      {
        colId: column.id,
        pid: param.rowId,
      },
      param.query,
    );

    // 获取排除列表数据总数
    const count = await baseModel.getHmChildrenExcludedListCount(
      {
        colId: column.id,
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

  // 获取多对一关系排除列表数据
  async btExcludedList(
    // 上下文参数
    context: NcContext,
    // 路径参数，包含查询条件、列名和行ID
    param: PathParams & {
      query: any;
      columnName: string;
      rowId: string;
    },
  ) {
    // 通过别名或ID获取视图和模型
    const { model, view } = await getViewAndModelByAliasOrId(context, param);
    // 如果模型不存在，抛出表未找到错误
    if (!model) NcError.tableNotFound(param.tableName);

    // 获取数据源
    const source = await Source.get(context, model.source_id);

    // 获取基础模型SQL实例
    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    // 通过ID或名称获取列
    const column = await getColumnByIdOrName(context, param.columnName, model);

    // 获取多对一关系排除列表数据
    const data = await baseModel.getBtChildrenExcludedList(
      {
        colId: column.id,
        cid: param.rowId,
      },
      param.query,
    );

    // 获取排除列表数据总数
    const count = await baseModel.getBtChildrenExcludedListCount(
      {
        colId: column.id,
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

  // 获取一对一关系排除列表数据
  async ooExcludedList(
    // 上下文参数
    context: NcContext,
    // 路径参数，包含查询条件、列名和行ID
    param: PathParams & {
      query: any;
      columnName: string;
      rowId: string;
    },
  ) {
    // 通过别名或ID获取视图和模型
    const { model, view } = await getViewAndModelByAliasOrId(context, param);
    // 如果模型不存在，抛出表未找到错误
    if (!model) NcError.notFound('Table not found');

    // 获取数据源
    const source = await Source.get(context, model.source_id);

    // 获取基础模型SQL实例
    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    // 通过ID或名称获取列
    const column = await getColumnByIdOrName(context, param.columnName, model);

    // 获取一对一关系排除列表数据
    const data = await baseModel.getExcludedOneToOneChildrenList(
      {
        colId: column.id,
        cid: param.rowId,
      },
      param.query,
    );

    // 获取排除列表数据总数
    const count = await baseModel.countExcludedOneToOneChildren(
      {
        colId: column.id,
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

  // todo: handle case where the given column is not ltar
  // 获取一对多关系列表数据
  async hmList(
    // 上下文参数
    context: NcContext,
    // 路径参数，包含查询条件、列名和行ID
    param: PathParams & {
      query: any;
      columnName: string;
      rowId: string;
    },
  ) {
    // 通过别名或ID获取视图和模型
    const { model, view } = await getViewAndModelByAliasOrId(context, param);

    // 如果模型不存在，抛出表未找到错误
    if (!model) NcError.tableNotFound(param.tableName);

    // 获取数据源
    const source = await Source.get(context, model.source_id);

    // 获取基础模型SQL实例
    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    // 通过ID或名称获取列
    const column = await getColumnByIdOrName(context, param.columnName, model);

    // 验证列是否为链接到另一条记录类型
    if (![UITypes.LinkToAnotherRecord, UITypes.Links].includes(column.uidt))
      NcError.badRequest('Column is not LTAR');

    // 获取一对多关系数据
    const data = await baseModel.hmList(
      {
        colId: column.id,
        id: param.rowId,
      },
      param.query,
    );

    // 获取数据总数
    const count = await baseModel.hmListCount(
      {
        colId: column.id,
        id: param.rowId,
      },
      param.query,
    );

    // 返回分页响应
    return new PagedResponseImpl(data, {
      count,
      ...param.query,
    } as any);
  }

  // 移除关系数据
  async relationDataRemove(
    // 上下文参数
    context: NcContext,
    // 路径参数，包含列名、行ID、引用行ID和cookie
    param: PathParams & {
      columnName: string;
      rowId: string;
      refRowId: string;
      cookie: any;
    },
  ) {
    // 通过别名或ID获取视图和模型
    const { model, view } = await getViewAndModelByAliasOrId(context, param);
    // 如果模型不存在，抛出表未找到错误
    if (!model) NcError.tableNotFound(param.tableName);

    // 获取数据源
    const source = await Source.get(context, model.source_id);

    // 获取基础模型SQL实例
    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    // 通过ID或名称获取列
    const column = await getColumnByIdOrName(context, param.columnName, model);

    // 移除子记录关系
    await baseModel.removeChild({
      colId: column.id,
      childId: param.refRowId,
      rowId: param.rowId,
      cookie: param.cookie,
    });

    // 返回成功标志
    return true;
  }

  // todo: Give proper error message when reference row is already related and handle duplicate ref row id in hm
  // 添加关系数据
  async relationDataAdd(
    // 上下文参数
    context: NcContext,
    // 路径参数，包含列名、行ID、引用行ID和cookie
    param: PathParams & {
      columnName: string;
      rowId: string;
      refRowId: string;
      cookie: any;
    },
  ) {
    // 通过别名或ID获取视图和模型
    const { model, view } = await getViewAndModelByAliasOrId(context, param);
    // 如果模型不存在，抛出表未找到错误
    if (!model) NcError.tableNotFound(param.tableName);

    // 获取数据源
    const source = await Source.get(context, model.source_id);

    // 获取基础模型SQL实例
    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
    });

    // 通过ID或名称获取列
    const column = await getColumnByIdOrName(context, param.columnName, model);
    // 添加子记录关系
    await baseModel.addChild({
      colId: column.id,
      childId: param.refRowId,
      rowId: param.rowId,
      cookie: param.cookie,
    });

    // 返回成功标志
    return true;
  }
}
