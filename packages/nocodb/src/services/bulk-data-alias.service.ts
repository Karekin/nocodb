// 导入 NestJS 的 Injectable 装饰器，用于依赖注入
import { Injectable } from '@nestjs/common';
// 导入 NcRequest 类型，用于处理请求对象
import type { NcRequest } from 'nocodb-sdk';
// 导入 PathParams 类型，用于处理路径参数
import type { PathParams } from '~/helpers/dataHelpers';
// 导入 BaseModelSqlv2 类型，用于数据库操作
import type { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';
// 导入 NcContext 类型，用于处理上下文信息
import type { NcContext } from '~/interface/config';
// 导入 getViewAndModelByAliasOrId 函数，用于通过别名或ID获取视图和模型
import { getViewAndModelByAliasOrId } from '~/helpers/dataHelpers';
// 导入 NcConnectionMgrv2，用于管理数据库连接
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
// 导入 Model 和 Source 模型，用于数据操作
import { Model, Source } from '~/models';

// 定义批量操作类型，包括批量插入、更新、全部更新、删除、更新插入和全部删除
type BulkOperation =
  | 'bulkInsert'
  | 'bulkUpdate'
  | 'bulkUpdateAll'
  | 'bulkDelete'
  | 'bulkUpsert'
  | 'bulkDeleteAll';

// 使用 Injectable 装饰器标记该服务可被注入
@Injectable()
export class BulkDataAliasService {
  // 获取模型、视图和数据源的基础方法
  async getModelViewBase(context: NcContext, param: PathParams) {
    // 通过别名或ID获取模型和视图
    const { model, view } = await getViewAndModelByAliasOrId(context, param);

    // 获取数据源信息
    const source = await Source.get(context, model.source_id);
    // 返回模型、视图和数据源信息
    return { model, view, source };
  }

  // 执行批量操作的通用方法，使用泛型T来指定操作类型
  async executeBulkOperation<T extends BulkOperation>(
    context: NcContext,
    param: PathParams & {
      operation: T;
      options: Parameters<(typeof BaseModelSqlv2.prototype)[T]>;
    },
  ) {
    // 获取模型、视图和数据源信息
    const { model, view, source } = await this.getModelViewBase(context, param);
    // 获取基础模型SQL实例
    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
    });
    // 调用指定的批量操作方法并返回结果
    return await baseModel[param.operation].apply(null, param.options);
  }

  // todo: Integrate with filterArrJson bulkDataUpdateAll
  // 批量数据插入方法
  async bulkDataInsert(
    context: NcContext,
    param: PathParams & {
      body: any; // 请求体数据
      cookie: NcRequest; // 请求cookie
      chunkSize?: number; // 分块大小
      foreign_key_checks?: boolean; // 是否检查外键
      skip_hooks?: boolean; // 是否跳过钩子函数
      raw?: boolean; // 是否返回原始结果
      allowSystemColumn?: boolean; // 是否允许系统列
      undo?: boolean; // 是否支持撤销
    },
  ) {
    // 调用通用批量操作方法执行批量插入
    return await this.executeBulkOperation(context, {
      ...param,
      operation: 'bulkInsert',
      options: [
        param.body,
        {
          cookie: param.cookie,
          foreign_key_checks: param.foreign_key_checks,
          skip_hooks: param.skip_hooks,
          raw: param.raw,
          allowSystemColumn: param.allowSystemColumn,
          undo: param.undo,
        },
      ],
    });
  }

  // todo: Integrate with filterArrJson bulkDataUpdateAll
  // 批量数据更新方法
  async bulkDataUpdate(
    context: NcContext,
    param: PathParams & {
      body: any; // 请求体数据
      cookie: NcRequest; // 请求cookie
      raw?: boolean; // 是否返回原始结果
      allowSystemColumn?: boolean; // 是否允许系统列
    },
  ) {
    // 调用通用批量操作方法执行批量更新
    return await this.executeBulkOperation(context, {
      ...param,
      operation: 'bulkUpdate',
      options: [
        param.body,
        {
          cookie: param.cookie,
          raw: param.raw,
          allowSystemColumn: param.allowSystemColumn,
        },
      ],
    });
  }

  // todo: Integrate with filterArrJson bulkDataUpdateAll
  // 批量更新所有符合条件的数据方法
  async bulkDataUpdateAll(
    context: NcContext,
    param: PathParams & {
      body: any; // 请求体数据
      cookie: NcRequest; // 请求cookie
      query: any; // 查询条件
    },
  ) {
    // 调用通用批量操作方法执行批量更新所有
    return await this.executeBulkOperation(context, {
      ...param,
      operation: 'bulkUpdateAll',
      options: [param.query, param.body, { cookie: param.cookie }],
    });
  }

  // 批量数据删除方法
  async bulkDataDelete(
    context: NcContext,
    param: PathParams & {
      body: any; // 请求体数据
      cookie: NcRequest; // 请求cookie
    },
  ) {
    // 调用通用批量操作方法执行批量删除
    return await this.executeBulkOperation(context, {
      ...param,
      operation: 'bulkDelete',
      options: [param.body, { cookie: param.cookie }],
    });
  }

  // todo: Integrate with filterArrJson bulkDataDeleteAll
  // 批量删除所有符合条件的数据方法
  async bulkDataDeleteAll(
    context: NcContext,
    param: PathParams & {
      query: any; // 查询条件
      req: NcRequest; // 请求对象
    },
  ) {
    // 调用通用批量操作方法执行批量删除所有
    return await this.executeBulkOperation(context, {
      ...param,
      operation: 'bulkDeleteAll',
      options: [param.query, { cookie: param.req }],
    });
  }

  // 批量数据更新插入方法（如果存在则更新，不存在则插入）
  async bulkDataUpsert(
    context: NcContext,
    param: PathParams & {
      body: any; // 请求体数据
      cookie: NcRequest; // 请求cookie
      undo: boolean; // 是否支持撤销
    },
  ) {
    // 调用通用批量操作方法执行批量更新插入
    return await this.executeBulkOperation(context, {
      ...param,
      operation: 'bulkUpsert',
      options: [param.body, { cookie: param.cookie, undo: param.undo }],
    });
  }
}
