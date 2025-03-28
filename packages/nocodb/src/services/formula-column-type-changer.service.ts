// 导入必要的 NestJS 装饰器和工具
import {
  forwardRef,
  Inject,
  Injectable,
  NotImplementedException,
} from '@nestjs/common';
// 导入 NocoDB SDK 中的类型定义
import { NcApiVersion, type NcContext, type NcRequest } from 'nocodb-sdk';
// 导入生成审计数据的工具函数
import { generateUpdateAuditV1Payload } from 'src/utils';
// 导入 NocoDB SDK 中的类型定义
import type {
  AuditV1,
  ColumnReqType,
  DataUpdatePayload,
  UserType,
} from 'nocodb-sdk';
// 导入基础 SQL 模型类型
import type { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';
// 导入公式列类型
import type { FormulaColumn } from '~/models';
// 导入可重用参数类型
import type { ReusableParams } from '~/services/columns.service.type';
// 导入公式数据迁移驱动接口
import type { FormulaDataMigrationDriver } from '~/services/formula-column-type-changer';
// 导入公式列类型转换器接口
import type { IFormulaColumnTypeChanger } from './formula-column-type-changer.types';
// 导入数据库辅助函数
import {
  getBaseModelSqlFromModelId,
  isDataAuditEnabled,
} from '~/helpers/dbHelpers';
// 导入审计和列模型
import { Audit, Column } from '~/models';
// 导入列服务
import { ColumnsService } from '~/services/columns.service';
// 导入 MySQL 数据迁移实现
import { MysqlDataMigration } from '~/services/formula-column-type-changer/mysql-data-migration';
// 导入 PostgreSQL 数据迁移实现
import { PgDataMigration } from '~/services/formula-column-type-changer/pg-data-migration';
// 导入 SQLite 数据迁移实现
import { SqliteDataMigration } from '~/services/formula-column-type-changer/sqlite-data-migration';

// 定义默认批处理限制
export const DEFAULT_BATCH_LIMIT = 100000;

// 使用 Injectable 装饰器标记该服务可被依赖注入
@Injectable()
// 定义公式列类型转换器类，实现 IFormulaColumnTypeChanger 接口
export class FormulaColumnTypeChanger implements IFormulaColumnTypeChanger {
  // 构造函数，注入 ColumnsService
  constructor(
    // 使用 forwardRef 解决循环依赖问题
    @Inject(forwardRef(() => ColumnsService))
    private readonly columnsService: ColumnsService,
  ) {
    // 创建 PostgreSQL 数据迁移驱动实例
    const pgDriver = new PgDataMigration();
    // 创建 MySQL 数据迁移驱动实例
    const mysqlDriver = new MysqlDataMigration();
    // 创建 SQLite 数据迁移驱动实例
    const sqliteDriver = new SqliteDataMigration();
    // 注册 PostgreSQL 驱动
    this.dataMigrationDriver['postgre'] = pgDriver;
    this.dataMigrationDriver[pgDriver.dbDriverName] = pgDriver;
    // 注册 MariaDB 和 MySQL 驱动
    this.dataMigrationDriver['mariadb'] = mysqlDriver;
    this.dataMigrationDriver['mysql2'] = mysqlDriver;
    this.dataMigrationDriver[mysqlDriver.dbDriverName] = mysqlDriver;
    // 注册 SQLite 驱动
    this.dataMigrationDriver[sqliteDriver.dbDriverName] = sqliteDriver;
    this.dataMigrationDriver['sqlite3'] = sqliteDriver;
  }

  // 数据迁移驱动映射表，键为数据库类型，值为对应的迁移驱动实例
  dataMigrationDriver: {
    [key: string]: FormulaDataMigrationDriver;
  } = {};

  // 开始更改公式列类型的方法
  async startChangeFormulaColumnType(
    context: NcContext,
    params: {
      req: NcRequest;
      formulaColumn: Column;
      user: UserType;
      reuse?: ReusableParams;
      newColumnRequest: ColumnReqType & { colOptions?: any };
    },
  ) {
    // 获取基础模型
    const baseModel = await getBaseModelSqlFromModelId({
      context,
      modelId: params.formulaColumn.fk_model_id,
    });
    // 检查是否支持当前数据库类型
    if (!this.dataMigrationDriver[baseModel.dbDriver.clientType()]) {
      throw new NotImplementedException(
        `${baseModel.dbDriver.clientType()} database is not supported in this operation`,
      );
    }
    // 保存原始列标题
    const oldTitle = params.formulaColumn.title;
    // 如果新列标题与旧列标题相同
    if (params.newColumnRequest.title === oldTitle) {
      // 先重命名别名，以避免创建临时列时出现重复别名
      await Column.updateAlias(context, params.formulaColumn.id, {
        title: '__nc_temp_field',
      });
    }

    // 声明新列变量
    let newColumn: Column;
    try {
      // 添加新列
      newColumn = await this.columnsService.columnAdd(context, {
        tableId: baseModel.model.id,
        column: params.newColumnRequest,
        req: params.req,
        user: params.user,
        apiVersion: NcApiVersion.V3,
        reuse: params.reuse,
        suppressFormulaError: true,
      });

      try {
        // 开始数据迁移
        await this.startMigrateData(context, {
          formulaColumn: params.formulaColumn,
          destinationColumn: newColumn,
          baseModel,
          req: params.req,
        });
      } catch (ex) {
        // 如果迁移失败，删除新创建的列
        await this.columnsService.columnDelete(context, {
          columnId: newColumn.id,
          req: params.req,
          user: params.user,
          reuse: params.reuse,
          forceDeleteSystem: false,
        });
        // 重新抛出异常
        throw ex;
      }
    } catch (ex) {
      // 如果在创建新列过程中出现任何原因的失败
      // 需要回滚旧列的名称/标题
      if (params.newColumnRequest.title === oldTitle) {
        await Column.updateAlias(context, params.formulaColumn.id, {
          title: oldTitle,
        });
      }
      // 重新抛出异常
      throw ex;
    }
    // 更新公式列为新类型并返回结果
    return await Column.updateFormulaColumnToNewType(context, {
      formulaColumn: params.formulaColumn,
      destinationColumn: newColumn,
    });
  }

  // 开始迁移数据的方法
  async startMigrateData(
    context: NcContext,
    {
      formulaColumn,
      destinationColumn,
      baseModel,
      req,
    }: {
      formulaColumn: Column;
      destinationColumn: Column;
      baseModel?: BaseModelSqlv2;
      req: NcRequest;
    },
  ) {
    // 如果未提供基础模型，则获取它
    baseModel =
      baseModel ??
      (await getBaseModelSqlFromModelId({
        context,
        modelId: formulaColumn.fk_model_id,
      }));
    // 获取行数
    const rowCount = await baseModel.count();
    // 如果没有数据，直接返回
    if (rowCount === 0) {
      return;
    }
    // 获取公式列选项
    const formulaColumnOption =
      await formulaColumn.getColOptions<FormulaColumn>(context);
    // 分批处理数据
    for (let i = 0; i < rowCount; i += DEFAULT_BATCH_LIMIT) {
      await this.migrateData({
        baseModelSqlV2: baseModel,
        destinationColumn,
        formulaColumn,
        formulaColumnOption,
        offset: i,
        limit: DEFAULT_BATCH_LIMIT,
        req,
      });
    }
  }

  // 迁移数据的方法
  async migrateData({
    baseModelSqlV2,
    formulaColumn,
    formulaColumnOption,
    destinationColumn,
    offset = 0,
    limit = DEFAULT_BATCH_LIMIT,
    req,
  }: {
    baseModelSqlV2: BaseModelSqlv2;
    formulaColumn: Column<any>;
    destinationColumn: Column<any>;
    formulaColumnOption: FormulaColumn;
    req: NcRequest;
    offset?: number;
    limit?: number;
  }) {
    // 获取数据库驱动
    const qb = baseModelSqlV2.dbDriver;
    // 获取对应的数据迁移驱动
    const dataMigrationDriver = this.dataMigrationDriver[qb.clientType()];
    // 检查是否支持当前数据库类型
    if (!dataMigrationDriver) {
      throw new NotImplementedException(
        `${qb.clientType()} database is not supported in this operation`,
      );
    }

    // 执行数据迁移
    const updatedRows = await dataMigrationDriver.migrate({
      baseModelSqlV2,
      destinationColumn,
      formulaColumn,
      formulaColumnOption,
      limit,
      offset,
    });
    // 如果启用了数据审计
    if (isDataAuditEnabled()) {
      // 创建审计负载数组
      const auditPayloads: AuditV1<DataUpdatePayload>[] = [];
      // 为每一行更新的数据创建审计记录
      for (const row of updatedRows) {
        auditPayloads.push(
          await generateUpdateAuditV1Payload({
            baseModelSqlV2,
            rowId: row.primaryKeys,
            data: row.row,
            oldData: {
              ...row.row,
              [destinationColumn.title]: null,
            },
            req,
          }),
        );
      }
      // 批量插入审计记录
      await Promise.all(
        auditPayloads.map((auditPayload) => Audit.insert(auditPayload)),
      );
    }
  }
}
