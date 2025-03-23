import { Injectable, Optional } from '@nestjs/common';
import { customAlphabet } from 'nanoid';
import CryptoJS from 'crypto-js';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import type * as knex from 'knex';
import type { Knex } from 'knex';
import type { Condition } from '~/db/CustomKnex';
import XcMigrationSource from '~/meta/migrations/XcMigrationSource';
import XcMigrationSourcev2 from '~/meta/migrations/XcMigrationSourcev2';
import { XKnex } from '~/db/CustomKnex';
import { NcConfig } from '~/utils/nc-config';
import { MetaTable, RootScopes, RootScopeTables } from '~/utils/globals';
import { NcError } from '~/helpers/catchError';

dayjs.extend(utc);
dayjs.extend(timezone);

const nanoid = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyz_', 4);
const nanoidv2 = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyz', 14);

/**
 * MetaService 类 - 负责处理 NocoDB 的元数据操作
 * 包括数据库连接、数据迁移、元数据的增删改查等操作
 */
@Injectable()
export class MetaService {
  private _knex: knex.Knex; // Knex 数据库连接实例
  private _config: any; // 配置信息

  /**
   * 构造函数 - 初始化数据库连接和配置
   * @param config - NocoDB 配置信息
   * @param trx - 可选的事务对象
   */
  constructor(config: NcConfig, @Optional() trx = null) {
    this._config = config;
    this._knex = XKnex({
      ...this._config.meta.db,
      useNullAsDefault: true,
    });
    this.trx = trx;
  }

  // 获取 Knex 实例的 getter
  get knexInstance(): knex.Knex {
    return this._knex;
  }

  // 获取配置信息的 getter
  get config(): NcConfig {
    return this._config;
  }

  // 获取数据库连接
  public get connection() {
    return this.trx ?? this.knexInstance;
  }

  // 获取 Knex 连接
  get knexConnection() {
    return this.connection;
  }

  // 获取 Knex 实例的公共方法
  public get knex(): any {
    return this.knexConnection;
  }

  /**
   * 添加上下文条件到查询中
   * @param query - Knex 查询构建器
   * @param workspace_id - 工作空间ID
   * @param base_id - 基础ID
   * @param target - 目标表名
   */
  public contextCondition(
    query: Knex.QueryBuilder,
    workspace_id: string,
    base_id: string,
    target: string,
  ) {
    if (workspace_id === base_id || base_id === RootScopes.WORKSPACE) {
      return;
    }

    if (target !== MetaTable.PROJECT) {
      query.where('base_id', base_id);
    } else {
      query.where('id', base_id);
    }
  }

  /**
   * 从元数据中获取单条记录
   * @param workspace_id - 工作空间ID
   * @param base_id - 基础ID
   * @param target - 目标表名
   * @param idOrCondition - ID或查询条件
   * @param fields - 要查询的字段
   */
  public async metaGet(
    workspace_id: string,
    base_id: string,
    target: string,
    idOrCondition: string | { [p: string]: any },
    fields?: string[],
  ): Promise<any> {
    return this.metaGet2(workspace_id, base_id, target, idOrCondition, fields);
  }

  /**
   * 向元数据中插入记录
   * @param workspace_id - 工作空间ID
   * @param base_id - 基础ID
   * @param target - 目标表名
   * @param data - 要插入的数据
   * @param ignoreIdGeneration - 是否忽略ID生成
   */
  public async metaInsert2(
    workspace_id: string,
    base_id: string,
    target: string,
    data: any,
    ignoreIdGeneration?: boolean,
  ): Promise<any> {
    const insertObj = {
      ...data,
      ...(ignoreIdGeneration
        ? {}
        : { id: data?.id || (await this.genNanoid(target)) }),
    };

    // 验证工作空间和基础ID
    if (workspace_id === base_id) {
      if (!Object.values(RootScopes).includes(workspace_id as RootScopes)) {
        NcError.metaError({
          message: 'Invalid scope',
          sql: '',
        });
      }

      if (!RootScopeTables[workspace_id].includes(target)) {
        NcError.metaError({
          message: 'Table not accessible from this scope',
          sql: '',
        });
      }
    } else {
      if (!base_id) {
        NcError.metaError({
          message: 'Base ID is required',
          sql: '',
        });
      }
      if (base_id !== RootScopes.WORKSPACE) insertObj.base_id = base_id;
    }

    // 插入记录
    await this.knexConnection(target).insert({
      ...insertObj,
      created_at: this.now(),
      updated_at: this.now(),
    });

    return insertObj;
  }

  /**
   * 批量插入元数据记录
   * @param workspace_id - 工作空间ID
   * @param base_id - 基础ID
   * @param target - 目标表名
   * @param data - 要插入的数据数组
   * @param ignoreIdGeneration - 是否忽略ID生成
   */
  public async bulkMetaInsert(
    workspace_id: string,
    base_id: string,
    target: string,
    data: any | any[],
    ignoreIdGeneration?: boolean,
  ): Promise<any> {
    if (Array.isArray(data) ? !data.length : !data) {
      return [];
    }

    const insertObj = [];
    const at = this.now();

    const commonProps: Record<string, any> = {
      created_at: at,
      updated_at: at,
    };

    // 验证工作空间和基础ID
    if (workspace_id === base_id) {
      if (!Object.values(RootScopes).includes(workspace_id as RootScopes)) {
        NcError.metaError({
          message: 'Invalid scope',
          sql: '',
        });
      }

      if (!RootScopeTables[workspace_id].includes(target)) {
        NcError.metaError({
          message: 'Table not accessible from this scope',
          sql: '',
        });
      }
    } else {
      if (!base_id) {
        NcError.metaError({
          message: 'Base ID is required',
          sql: '',
        });
      }
      commonProps.base_id = base_id;
    }

    // 处理每条记录
    for (const d of Array.isArray(data) ? data : [data]) {
      const id = d?.id || (await this.genNanoid(target));
      const tempObj = {
        ...d,
        ...(ignoreIdGeneration ? {} : { id }),
        ...commonProps,
      };
      insertObj.push(tempObj);
    }

    // 批量插入记录
    await this.knexConnection.batchInsert(target, insertObj);

    return insertObj;
  }

  /**
   * 批量更新元数据记录
   * @param workspace_id - 工作空间ID
   * @param base_id - 基础ID
   * @param target - 目标表名
   * @param data - 要更新的数据
   * @param ids - 要更新的记录ID数组
   * @param condition - 额外的查询条件
   */
  public async bulkMetaUpdate(
    workspace_id: string,
    base_id: string,
    target: string,
    data: any | any[],
    ids: string[],
    condition?: { [p: string]: any },
  ): Promise<any> {
    if (Array.isArray(data) ? !data.length : !data) {
      return [];
    }

    const query = this.knexConnection(target);
    const at = this.now();

    // 验证工作空间和基础ID
    if (workspace_id === base_id) {
      if (!Object.values(RootScopes).includes(workspace_id as RootScopes)) {
        NcError.metaError({
          message: 'Invalid scope',
          sql: '',
        });
      }

      if (!RootScopeTables[workspace_id].includes(target)) {
        NcError.metaError({
          message: 'Table not accessible from this scope',
          sql: '',
        });
      }
    } else {
      if (!base_id) {
        NcError.metaError({
          message: 'Base ID is required',
          sql: '',
        });
      }
    }

    const updateObj = {
      ...data,
      updated_at: at,
    };

    // 执行更新操作
    if (!condition) {
      query.whereIn('id', ids).update(updateObj);
    } else {
      if (![MetaTable.FILE_REFERENCES].includes(target as MetaTable)) {
        NcError.metaError({
          message: 'This table does not support conditional bulk update',
          sql: '',
        });
      }

      query.where(condition);
      this.checkConditionPresent(query, 'update');
      query.update(updateObj);
    }

    this.contextCondition(query, workspace_id, base_id, target);

    return query;
  }

  /**
   * 生成指定目标的 nanoid
   * @param target - 目标表名
   * @returns 生成的 nanoid
   */
  public async genNanoid(target: string) {
    // 定义表名前缀映射
    const prefixMap: { [key: string]: string } = {
      [MetaTable.PROJECT]: 'p',
      [MetaTable.SOURCES]: 'b',
      [MetaTable.MODELS]: 'm',
      [MetaTable.COLUMNS]: 'c',
      [MetaTable.COL_RELATIONS]: 'l',
      [MetaTable.COL_SELECT_OPTIONS]: 's',
      [MetaTable.COL_LOOKUP]: 'lk',
      [MetaTable.COL_ROLLUP]: 'rl',
      [MetaTable.COL_FORMULA]: 'f',
      [MetaTable.FILTER_EXP]: 'fi',
      [MetaTable.SORT]: 'so',
      [MetaTable.SHARED_VIEWS]: 'sv',
      [MetaTable.ACL]: 'ac',
      [MetaTable.FORM_VIEW]: 'fv',
      [MetaTable.FORM_VIEW_COLUMNS]: 'fvc',
      [MetaTable.GALLERY_VIEW]: 'gv',
      [MetaTable.GALLERY_VIEW_COLUMNS]: 'gvc',
      [MetaTable.KANBAN_VIEW]: 'kv',
      [MetaTable.KANBAN_VIEW_COLUMNS]: 'kvc',
      [MetaTable.CALENDAR_VIEW]: 'cv',
      [MetaTable.CALENDAR_VIEW_COLUMNS]: 'cvc',
      [MetaTable.CALENDAR_VIEW_RANGE]: 'cvr',
      [MetaTable.USERS]: 'us',
      [MetaTable.ORGS_OLD]: 'org',
      [MetaTable.TEAMS]: 'tm',
      [MetaTable.VIEWS]: 'vw',
      [MetaTable.HOOKS]: 'hk',
      [MetaTable.HOOK_LOGS]: 'hkl',
      [MetaTable.AUDIT]: 'adt',
      [MetaTable.API_TOKENS]: 'tkn',
      [MetaTable.EXTENSIONS]: 'ext',
      [MetaTable.COMMENTS]: 'com',
      [MetaTable.COMMENTS_REACTIONS]: 'cre',
      [MetaTable.USER_COMMENTS_NOTIFICATIONS_PREFERENCE]: 'cnp',
      [MetaTable.JOBS]: 'job',
      [MetaTable.INTEGRATIONS]: 'int',
      [MetaTable.FILE_REFERENCES]: 'at',
      [MetaTable.COL_BUTTON]: 'btn',
      [MetaTable.SNAPSHOT]: 'snap',
      [MetaTable.SCRIPTS]: 'scr',
      [MetaTable.SYNC_CONFIGS]: 'sync',
    };

    const prefix = prefixMap[target] || 'nc';
    return `${prefix}${nanoidv2()}`;
  }

  private trx: Knex.Transaction; // 事务对象

  /**
   * 删除元数据记录
   * @param workspace_id - 工作空间ID
   * @param base_id - 基础ID
   * @param target - 目标表名
   * @param idOrCondition - ID或查询条件
   * @param xcCondition - 额外的复杂查询条件
   * @param force - 是否强制删除
   */
  public async metaDelete(
    workspace_id: string,
    base_id: string,
    target: string,
    idOrCondition: string | { [p: string]: any },
    xcCondition?: Condition,
    force = false,
  ): Promise<void> {
    const query = this.knexConnection(target);

    // 验证工作空间和基础ID
    if (workspace_id === base_id) {
      if (!Object.values(RootScopes).includes(workspace_id as RootScopes)) {
        NcError.metaError({
          message: 'Invalid scope',
          sql: '',
        });
      }

      if (!RootScopeTables[workspace_id].includes(target)) {
        NcError.metaError({
          message: 'Table not accessible from this scope',
          sql: '',
        });
      }
    } else {
      if (!base_id) {
        NcError.metaError({
          message: 'Base ID is required',
          sql: '',
        });
      }
    }

    // 构建删除条件
    if (typeof idOrCondition !== 'object') {
      query.where('id', idOrCondition);
    } else if (idOrCondition) {
      query.where(idOrCondition);
    }

    if (xcCondition) {
      query.condition(xcCondition, {});
    }

    // 检查删除条件
    if (!force) {
      this.checkConditionPresent(query, 'delete');
    }

    // 应用上下文条件
    this.contextCondition(query, workspace_id, base_id, target);

    return query.del();
  }

  /**
   * 获取元数据记录
   * @param workspace_id - 工作空间ID
   * @param base_id - 基础ID
   * @param target - 目标表名
   * @param idOrCondition - ID或查询条件
   * @param fields - 要查询的字段
   * @param xcCondition - 额外的复杂查询条件
   */
  public async metaGet2(
    workspace_id: string,
    base_id: string,
    target: string,
    idOrCondition: string | { [p: string]: any },
    fields?: string[],
    xcCondition?: Condition,
  ): Promise<any> {
    const query = this.knexConnection(target);

    // 添加复杂查询条件
    if (xcCondition) {
      query.condition(xcCondition);
    }

    // 选择指定字段
    if (fields?.length) {
      query.select(...fields);
    }

    // 验证工作空间和基础ID
    if (workspace_id === RootScopes.BYPASS && base_id === RootScopes.BYPASS) {
      // 跳过验证
    } else if (workspace_id === base_id) {
      if (!Object.values(RootScopes).includes(workspace_id as RootScopes)) {
        NcError.metaError({
          message: 'Invalid scope',
          sql: '',
        });
      }

      if (!RootScopeTables[workspace_id].includes(target)) {
        NcError.metaError({
          message: 'Table not accessible from this scope',
          sql: '',
        });
      }
    } else {
      if (!base_id) {
        NcError.metaError({
          message: 'Base ID is required',
          sql: '',
        });
      }

      this.contextCondition(query, workspace_id, base_id, target);
    }

    // 添加查询条件
    if (!idOrCondition) {
      return query.first();
    }

    if (typeof idOrCondition !== 'object') {
      query.where('id', idOrCondition);
    } else {
      query.where(idOrCondition);
    }
    return query.first();
  }

  /**
   * 获取下一条记录的排序值
   * @param target - 目标表名
   * @param condition - 查询条件
   */
  public async metaGetNextOrder(
    target: string,
    condition: { [key: string]: any },
  ): Promise<number> {
    const query = this.knexConnection(target);

    query.where(condition);
    query.max('order', { as: 'order' });

    return (+(await query.first())?.order || 0) + 1;
  }

  /**
   * 获取元数据记录列表
   * @param workspace_id - 工作空间ID
   * @param base_id - 基础ID
   * @param target - 目标表名
   * @param args - 查询参数
   */
  public async metaList2(
    workspace_id: string,
    base_id: string,
    target: string,
    args?: {
      condition?: { [p: string]: any };
      limit?: number;
      offset?: number;
      xcCondition?: Condition;
      fields?: string[];
      orderBy?: { [key: string]: 'asc' | 'desc' };
    },
  ): Promise<any[]> {
    const query = this.knexConnection(target);

    // 验证工作空间和基础ID
    if (workspace_id === base_id) {
      if (!Object.values(RootScopes).includes(workspace_id as RootScopes)) {
        NcError.metaError({
          message: 'Invalid scope',
          sql: '',
        });
      }

      if (!RootScopeTables[workspace_id].includes(target)) {
        NcError.metaError({
          message: 'Table not accessible from this scope',
          sql: '',
        });
      }
    } else {
      if (!base_id) {
        NcError.metaError({
          message: 'Base ID is required',
          sql: '',
        });
      }

      this.contextCondition(query, workspace_id, base_id, target);
    }

    // 添加查询条件
    if (args?.condition) {
      query.where(args.condition);
    }
    if (args?.limit) {
      query.limit(args.limit);
    }
    if (args?.offset) {
      query.offset(args.offset);
    }
    if (args?.xcCondition) {
      (query as any).condition(args.xcCondition);
    }

    // 添加排序
    if (args?.orderBy) {
      for (const [col, dir] of Object.entries(args.orderBy)) {
        query.orderBy(col, dir);
      }
    }
    if (args?.fields?.length) {
      query.select(...args.fields);
    }

    return query;
  }

  /**
   * 获取元数据记录数量
   * @param workspace_id - 工作空间ID
   * @param base_id - 基础ID
   * @param target - 目标表名
   * @param args - 查询参数
   */
  public async metaCount(
    workspace_id: string,
    base_id: string,
    target: string,
    args?: {
      condition?: { [p: string]: any };
      xcCondition?: Condition;
      aggField?: string;
    },
  ): Promise<number> {
    const query = this.knexConnection(target);

    // 验证工作空间和基础ID
    if (workspace_id === RootScopes.BYPASS && base_id === RootScopes.BYPASS) {
      // 跳过验证
    } else if (workspace_id === base_id) {
      if (!Object.values(RootScopes).includes(workspace_id as RootScopes)) {
        NcError.metaError({
          message: 'Invalid scope',
          sql: '',
        });
      }

      if (!RootScopeTables[workspace_id].includes(target)) {
        NcError.metaError({
          message: 'Table not accessible from this scope',
          sql: '',
        });
      }
    } else {
      if (!base_id) {
        NcError.metaError({
          message: 'Base ID is required',
          sql: '',
        });
      }

      this.contextCondition(query, workspace_id, base_id, target);
    }

    // 添加查询条件
    if (args?.condition) {
      query.where(args.condition);
    }

    if (args?.xcCondition) {
      (query as any).condition(args.xcCondition);
    }

    // 执行计数查询
    query.count(args?.aggField || 'id', { as: 'count' }).first();

    return +(await query)?.['count'] || 0;
  }

  /**
   * 更新元数据记录
   * @param workspace_id - 工作空间ID
   * @param base_id - 基础ID
   * @param target - 目标表名
   * @param data - 要更新的数据
   * @param idOrCondition - ID或查询条件
   * @param xcCondition - 额外的复杂查询条件
   * @param skipUpdatedAt - 是否跳过更新时间更新
   * @param force - 是否强制更新
   */
  public async metaUpdate(
    workspace_id: string,
    base_id: string,
    target: string,
    data: any,
    idOrCondition?: string | { [p: string]: any },
    xcCondition?: Condition,
    skipUpdatedAt = false,
    force = false,
  ): Promise<any> {
    const query = this.knexConnection(target);

    // 验证工作空间和基础ID
    if (workspace_id === base_id) {
      if (!Object.values(RootScopes).includes(workspace_id as RootScopes)) {
        NcError.metaError({
          message: 'Invalid scope',
          sql: '',
        });
      }

      if (!RootScopeTables[workspace_id].includes(target)) {
        NcError.metaError({
          message: 'Table not accessible from this scope',
          sql: '',
        });
      }
    } else {
      if (!base_id) {
        NcError.metaError({
          message: 'Base ID is required',
          sql: '',
        });
      }
    }

    // 处理更新时间
    delete data.created_at;
    if (!skipUpdatedAt) {
      data.updated_at = this.now();
    }

    // 构建更新查询
    query.update({ ...data });
    if (typeof idOrCondition !== 'object') {
      query.where('id', idOrCondition);
    } else if (idOrCondition) {
      query.where(idOrCondition);
    }
    if (xcCondition) {
      query.condition(xcCondition);
    }

    // 检查更新条件
    if (!force) {
      this.checkConditionPresent(query, 'update');
    }

    // 应用上下文条件
    this.contextCondition(query, workspace_id, base_id, target);

    return await query;
  }

  /**
   * 提交事务
   */
  async commit() {
    if (this.trx) {
      await this.trx.commit();
    }
    this.trx = null;
  }

  /**
   * 回滚事务
   * @param e - 错误对象
   */
  async rollback(e?) {
    if (this.trx) {
      await this.trx.rollback(e);
    }
    this.trx = null;
  }

  /**
   * 开始事务
   */
  async startTransaction(): Promise<MetaService> {
    const trx = await this.connection.transaction();

    // 扩展事务对象
    Object.assign(trx, {
      clientType: this.connection.clientType,
      searchPath: (this.connection as any).searchPath,
    });

    return new MetaService(this.config, trx);
  }

  /**
   * 更新基础配置
   * @param baseId - 基础ID
   * @param config - 配置信息
   */
  public async baseUpdate(baseId: string, config: any): Promise<any> {
    if (!baseId) {
      NcError.metaError({
        message: 'Base Id is required to update base config',
        sql: '',
      });
    }

    try {
      // 加密配置信息
      const base = {
        config: CryptoJS.AES.encrypt(
          JSON.stringify(config, null, 2),
          'secret', // TODO: 需要替换为实际的密钥
        ).toString(),
      };
      // 更新配置
      await this.knexConnection('nc_projects').update(base).where({
        id: baseId,
      });
    } catch (e) {
      console.log(e);
    }
  }

  /**
   * 获取基础列表（包含解密后的配置）
   */
  public async baseList(): Promise<any[]> {
    // 检查表是否存在
    const tableExists = await this.knexConnection.schema.hasTable(
      'nc_projects',
    );

    if (!tableExists) {
      return [];
    }

    // 获取并解密配置
    return (await this.knexConnection('nc_projects').select()).map((p) => {
      p.config = CryptoJS.AES.decrypt(
        p.config,
        'secret', // TODO: 需要替换为实际的密钥
      ).toString(CryptoJS.enc.Utf8);
      return p;
    });
  }

  /**
   * 生成 nanoid
   */
  private getNanoId() {
    return nanoid();
  }

  /**
   * 检查是否为 MySQL 数据库
   */
  private isMySQL(): boolean {
    return (
      this.connection.clientType() === 'mysql' ||
      this.connection.clientType() === 'mysql2'
    );
  }

  /**
   * 检查是否为 MSSQL 数据库
   */
  private isMssql(): boolean {
    return this.connection.clientType() === 'mssql';
  }

  /**
   * 获取当前时间
   */
  public now(): any {
    return dayjs()
      .utc()
      .format(
        this.isMySQL() || this.isMssql()
          ? 'YYYY-MM-DD HH:mm:ss'
          : 'YYYY-MM-DD HH:mm:ssZ',
      );
  }

  /**
   * 格式化日期时间
   * @param date - 日期字符串
   */
  public formatDateTime(date: string): string {
    return dayjs(date)
      .utc()
      .format(
        this.isMySQL() || this.isMssql()
          ? 'YYYY-MM-DD HH:mm:ss'
          : 'YYYY-MM-DD HH:mm:ssZ',
      );
  }

  /**
   * 初始化数据库迁移
   */
  public async init(): Promise<boolean> {
    // 执行数据库迁移
    await this.connection.migrate.latest({
      migrationSource: new XcMigrationSource(),
      tableName: 'xc_knex_migrations',
    });
    await this.connection.migrate.latest({
      migrationSource: new XcMigrationSourcev2(),
      tableName: 'xc_knex_migrationsv2',
    });
    return true;
  }

  /**
   * 检查查询构建器中是否存在条件
   * @param queryBuilder - Knex 查询构建器
   * @param operation - 操作类型
   */
  protected checkConditionPresent(
    queryBuilder: Knex.QueryBuilder,
    operation: 'delete' | 'update',
  ) {
    const sql = queryBuilder.toString();

    if (queryBuilder.hasWhere() && /\bWHERE\b/i.test(sql)) {
      return;
    }

    NcError.metaError({
      message: 'A condition is required to ' + operation + ' records.',
      sql,
    });
  }
}
