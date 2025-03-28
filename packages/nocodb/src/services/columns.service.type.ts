// 导入所需的类型定义
import type {
  // 列请求类型
  ColumnReqType,
  // NocoDB API 版本枚举
  NcApiVersion,
  // NocoDB 上下文对象类型
  NcContext,
  // NocoDB 请求对象类型
  NcRequest,
  // 用户类型
  UserType,
} from 'nocodb-sdk';
// 导入基础模型 SQL v2 类型
import type { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';
// 导入自定义 Knex 类型
import type CustomKnex from '~/db/CustomKnex';
// 导入 SQL 客户端类型
import type SqlClient from '~/db/sql-client/lib/SqlClient';
// 导入 SQL 管理器 v2 类型
import type SqlMgrv2 from '~/db/sql-mgr/v2/SqlMgrv2';
// 导入元数据服务类型
import type { MetaService } from '~/meta/meta.service';
// 导入基础、列、模型和数据源类型
import type { Base, Column, Model, Source } from '~/models';

// 定义可重用参数接口，用于在服务方法间共享数据库相关对象
export interface ReusableParams {
  // 表模型
  table?: Model;
  // 数据源
  source?: Source;
  // 基础对象
  base?: Base;
  // 数据库驱动
  dbDriver?: CustomKnex;
  // SQL 客户端
  sqlClient?: SqlClient;
  // SQL 管理器
  sqlMgr?: SqlMgrv2;
  // 基础模型
  baseModel?: BaseModelSqlv2;
}

// 定义列服务接口，包含列的添加、更新和删除操作
export interface IColumnsService {
  // 添加列方法，支持泛型 API 版本
  columnAdd<T extends NcApiVersion = NcApiVersion | null | undefined>(
    // 上下文参数
    context: NcContext,
    // 方法参数对象
    param: {
      // 请求对象
      req: NcRequest;
      // 表 ID
      tableId: string;
      // 列配置
      column: ColumnReqType;
      // 用户信息
      user: UserType;
      // 可重用参数
      reuse?: ReusableParams;
      // 是否抑制公式错误
      suppressFormulaError?: boolean;
      // API 版本
      apiVersion?: T;
    },
    // 返回值根据 API 版本不同而不同：V3 版本返回 Column 对象，其他版本返回 Model 对象
  ): Promise<T extends NcApiVersion.V3 ? Column : Model>;

  // 更新列方法
  columnUpdate(
    // 上下文参数
    context: NcContext,
    // 方法参数对象
    param: {
      // 请求对象
      req: NcRequest;
      // 列 ID
      columnId: string;
      // 列配置，包含可选的列选项
      column: ColumnReqType & { colOptions?: any };
      // 用户信息
      user: UserType;
      // 可重用参数
      reuse?: ReusableParams;
      // API 版本
      apiVersion?: NcApiVersion;
    },
    // 返回 Model 或 Column 对象
  ): Promise<Model | Column<any>>;

  // 删除列方法
  columnDelete(
    // 上下文参数
    context: NcContext,
    // 方法参数对象
    param: {
      // 请求对象（可选）
      req?: any;
      // 列 ID
      columnId: string;
      // 用户信息
      user: UserType;
      // 是否强制删除系统列
      forceDeleteSystem?: boolean;
      // 可重用参数
      reuse?: ReusableParams;
    },
    // 元数据服务（可选）
    ncMeta?: MetaService,
    // 返回 Model 对象
  ): Promise<Model>;
}
