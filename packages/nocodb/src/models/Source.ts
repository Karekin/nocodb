import { UITypes } from 'nocodb-sdk';
import { v4 as uuidv4 } from 'uuid';
import type { DriverClient } from '~/utils/nc-config';
import type { BoolType, SourceType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import { Base, Model, SyncSource } from '~/models';
import NocoCache from '~/cache/NocoCache';
import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
} from '~/utils/globals';
import Noco from '~/Noco';
import { extractProps } from '~/helpers/extractProps';
import { NcError } from '~/helpers/catchError';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import {
  parseMetaProp,
  prepareForDb,
  prepareForResponse,
  stringifyMetaProp,
} from '~/utils/modelUtils';
import { JobsRedis } from '~/modules/jobs/redis/jobs-redis';
import { InstanceCommands } from '~/interface/Jobs';
import View from '~/models/View';
import {
  decryptPropIfRequired,
  deepMerge,
  encryptPropIfRequired,
  isEncryptionRequired,
  partialExtract,
} from '~/utils';

/**
 * Source 类 - 实现数据源的核心功能
 * 包括数据源的创建、更新、删除、查询等操作
 */
export default class Source implements SourceType {
  // 基础属性定义
  id?: string; // 数据源ID
  fk_workspace_id?: string; // 工作空间ID
  base_id?: string; // 基础项目ID
  alias?: string; // 数据源别名
  type?: DriverClient; // 数据源类型
  is_meta?: BoolType; // 是否为元数据源
  is_local?: BoolType; // 是否为本地数据源
  is_schema_readonly?: BoolType; // 是否只读模式
  is_data_readonly?: BoolType; // 是否数据只读
  config?: string; // 数据源配置
  inflection_column?: string; // 列名转换规则
  inflection_table?: string; // 表名转换规则
  order?: number; // 排序顺序
  erd_uuid?: string; // ERD UUID
  enabled?: BoolType; // 是否启用
  meta?: any; // 元数据
  fk_integration_id?: string; // 集成ID
  integration_config?: string; // 集成配置
  integration_title?: string; // 集成标题
  is_encrypted?: boolean; // 是否加密

  // 临时属性
  upgraderMode?: boolean; // 升级模式
  upgraderQueries?: string[] = []; // 升级查询

  /**
   * 构造函数 - 初始化数据源
   * @param source - 数据源数据
   */
  constructor(source: Partial<SourceType>) {
    Object.assign(this, source);
  }

  /**
   * 类型转换方法 - 将普通对象转换为Source实例
   * @param source - 数据源数据
   */
  protected static castType(source: Source): Source {
    return source && new Source(source);
  }

  /**
   * 加密配置信息
   * @param obj - 需要加密的对象
   */
  protected static encryptConfigIfRequired(obj: Record<string, unknown>) {
    obj.config = encryptPropIfRequired({ data: obj });
    obj.is_encrypted = isEncryptionRequired();
  }

  /**
   * 创建基础数据源
   * @param context - 上下文信息
   * @param source - 数据源数据
   * @param ncMeta - 元数据服务实例
   */
  public static async createBase(
    context: NcContext,
    source: SourceType & {
      baseId: string;
      created_at?;
      updated_at?;
      meta?: any;
      is_encrypted?: boolean;
    },
    ncMeta = Noco.ncMeta,
  ) {
    // 提取需要插入的属性
    const insertObj = extractProps(source, [
      'id',
      'alias',
      'config',
      'type',
      'is_meta',
      'is_local',
      'inflection_column',
      'inflection_table',
      'order',
      'enabled',
      'meta',
      'is_schema_readonly',
      'is_data_readonly',
      'fk_integration_id',
      'is_encrypted',
    ]);

    // 加密配置信息
    this.encryptConfigIfRequired(insertObj);

    // 处理元数据
    if ('meta' in insertObj) {
      insertObj.meta = stringifyMetaProp(insertObj);
    }

    // 设置排序顺序
    insertObj.order = await ncMeta.metaGetNextOrder(MetaTable.SOURCES, {
      base_id: source.baseId,
    });

    // 插入数据源数据
    const { id } = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.SOURCES,
      insertObj,
    );

    // 获取并返回数据源信息
    const returnBase = await this.get(context, id, false, ncMeta);

    // 更新缓存
    await NocoCache.appendToList(
      CacheScope.SOURCE,
      [source.baseId],
      `${CacheScope.SOURCE}:${id}`,
    );

    return returnBase;
  }

  /**
   * 更新数据源
   * @param context - 上下文信息
   * @param sourceId - 数据源ID
   * @param source - 更新数据
   * @param ncMeta - 元数据服务实例
   */
  public static async update(
    context: NcContext,
    sourceId: string,
    source: SourceType & {
      meta?: any;
      deleted?: boolean;
      fk_sql_executor_id?: string;
      is_encrypted?: boolean;
    },
    ncMeta = Noco.ncMeta,
  ) {
    // 获取原有数据源
    const oldSource = await this.get(context, sourceId, false, ncMeta);

    if (!oldSource) NcError.sourceNotFound(sourceId);

    // 提取需要更新的属性
    const updateObj = extractProps(source, [
      'alias',
      'config',
      'type',
      'is_meta',
      'is_local',
      'inflection_column',
      'inflection_table',
      'order',
      'enabled',
      'meta',
      'deleted',
      'fk_sql_executor_id',
      'is_schema_readonly',
      'is_data_readonly',
      'fk_integration_id',
      'is_encrypted',
    ]);

    // 加密配置信息
    if (updateObj.config) {
      this.encryptConfigIfRequired(updateObj);
    }

    // 处理类型属性
    if (!updateObj.type) {
      updateObj.type = oldSource.type;
    }

    // 处理元数据
    if ('meta' in updateObj) {
      updateObj.meta = stringifyMetaProp(updateObj);
    }

    // 处理排序顺序
    if (!oldSource.order && !updateObj.order) {
      updateObj.order = await ncMeta.metaGetNextOrder(MetaTable.SOURCES, {
        base_id: oldSource.base_id,
      });

      if (updateObj.order <= 1 && !oldSource.isMeta()) {
        updateObj.order = 2;
      }
    }

    // 保持默认数据源的顺序为1
    if (oldSource.isMeta()) {
      updateObj.order = 1;
    }

    // 非默认数据源的处理
    if (!oldSource.isMeta()) {
      if (updateObj.order <= 1) {
        NcError.badRequest('Cannot change order to 1 or less');
      }

      // 如果非默认数据源顺序为1，将其移到最后
      if (oldSource.order <= 1 && !updateObj.order) {
        updateObj.order = await ncMeta.metaGetNextOrder(MetaTable.SOURCES, {
          base_id: oldSource.base_id,
        });
      }
    }

    // 更新数据源数据
    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.SOURCES,
      prepareForDb(updateObj),
      oldSource.id,
    );

    // 更新缓存
    await NocoCache.update(
      `${CacheScope.SOURCE}:${sourceId}`,
      prepareForResponse(updateObj),
    );

    // 触发缓存清理
    this.updateRelatedCaches(context, sourceId, ncMeta).catch((e) => {
      console.error(e);
    });

    // 释放工作进程
    if (JobsRedis.available) {
      await JobsRedis.emitWorkerCommand(InstanceCommands.RELEASE, sourceId);
      await JobsRedis.emitPrimaryCommand(InstanceCommands.RELEASE, sourceId);
    }

    return await this.get(context, oldSource.id, false, ncMeta);
  }

  /**
   * 获取数据源列表
   * @param context - 上下文信息
   * @param args - 查询参数
   * @param ncMeta - 元数据服务实例
   */
  static async list(
    context: NcContext,
    args: { baseId: string; includeDeleted?: boolean },
    ncMeta = Noco.ncMeta,
  ): Promise<Source[]> {
    // 从缓存获取数据源列表
    const cachedList = await NocoCache.getList(CacheScope.SOURCE, [
      args.baseId,
    ]);
    let { list: sourceDataList } = cachedList;
    const { isNoneList } = cachedList;

    // 如果缓存中没有数据，从数据库获取
    if (!isNoneList && !sourceDataList.length) {
      const qb = ncMeta
        .knex(MetaTable.SOURCES)
        .select(`${MetaTable.SOURCES}.*`)
        .where(`${MetaTable.SOURCES}.base_id`, context.base_id);

      // 处理删除标记
      if (!args.includeDeleted) {
        qb.where((whereQb) => {
          whereQb
            .where(`${MetaTable.SOURCES}.deleted`, false)
            .orWhereNull(`${MetaTable.SOURCES}.deleted`);
        });
      }

      // 按顺序排序
      qb.orderBy(`${MetaTable.SOURCES}.order`, 'asc');

      // 扩展查询
      this.extendQb(qb, context);

      sourceDataList = await qb;

      // 解析元数据
      for (const source of sourceDataList) {
        source.meta = parseMetaProp(source, 'meta');
      }

      // 更新缓存
      await NocoCache.setList(CacheScope.SOURCE, [args.baseId], sourceDataList);
    }

    // 排序处理
    sourceDataList.sort(
      (a, b) => (a?.order ?? Infinity) - (b?.order ?? Infinity),
    );

    return sourceDataList?.map((sourceData) => {
      return this.castType(sourceData);
    });
  }

  /**
   * 获取单个数据源
   * @param context - 上下文信息
   * @param id - 数据源ID
   * @param force - 是否强制获取
   * @param ncMeta - 元数据服务实例
   */
  static async get(
    context: NcContext,
    id: string,
    force = false,
    ncMeta = Noco.ncMeta,
  ): Promise<Source> {
    // 从缓存获取数据源
    let sourceData =
      id &&
      (await NocoCache.get(
        `${CacheScope.SOURCE}:${id}`,
        CacheGetType.TYPE_OBJECT,
      ));

    // 如果缓存中没有数据，从数据库获取
    if (!sourceData) {
      const qb = ncMeta
        .knex(MetaTable.SOURCES)
        .select(`${MetaTable.SOURCES}.*`)
        .where(`${MetaTable.SOURCES}.id`, id)
        .where(`${MetaTable.SOURCES}.base_id`, context.base_id);

      // 扩展查询
      this.extendQb(qb, context);

      // 处理删除标记
      if (!force) {
        qb.where((whereQb) => {
          whereQb
            .where(`${MetaTable.SOURCES}.deleted`, false)
            .orWhereNull(`${MetaTable.SOURCES}.deleted`);
        });
      }

      sourceData = await qb.first();

      // 解析元数据
      if (sourceData) {
        sourceData.meta = parseMetaProp(sourceData, 'meta');
      }

      // 更新缓存
      await NocoCache.set(`${CacheScope.SOURCE}:${id}`, sourceData);
    }
    return this.castType(sourceData);
  }

  /**
   * 获取连接配置
   */
  public async getConnectionConfig(): Promise<any> {
    // 处理元数据源和本地数据源
    if (this.is_meta || this.is_local) {
      const metaConfig = await NcConnectionMgrv2.getDataConfig();
      const config = { ...metaConfig };
      if (config.client === 'sqlite3') {
        config.connection = metaConfig;
      }
      return config;
    }

    // 获取配置
    const config = this.getConfig();

    // 处理 SQLite 配置
    if (config?.client === 'sqlite3') {
      config.connection.filename =
        config.connection.filename || config.connection?.connection.filename;
    }

    return config;
  }

  /**
   * 获取配置信息
   * @param skipIntegrationConfig - 是否跳过集成配置
   */
  public getConfig(skipIntegrationConfig = false): any {
    // 处理元数据源
    if (this.is_meta) {
      const metaConfig = Noco.getConfig()?.meta?.db;
      const config = { ...metaConfig };
      if (config.client === 'sqlite3') {
        config.connection = metaConfig;
      }
      return config;
    }

    // 解密配置
    const config = decryptPropIfRequired({
      data: this,
    });

    if (skipIntegrationConfig) {
      return config;
    }

    // 处理集成配置
    if (!this.integration_config) {
      return config;
    }

    // 解密集成配置
    const integrationConfig = decryptPropIfRequired({
      data: this,
      prop: 'integration_config',
    });

    // 合并配置
    let mergedConfig = deepMerge(
      integrationConfig,
      partialExtract(config || {}, [
        ['connection', 'database'],
        ['searchPath'],
      ]),
    );

    // 处理搜索路径
    if (
      (!Array.isArray(mergedConfig.searchPath) &&
        typeof mergedConfig.searchPath !== 'string') ||
      !mergedConfig.searchPath?.length
    ) {
      mergedConfig = { ...mergedConfig, searchPath: undefined };
    }

    return mergedConfig;
  }

  /**
   * 获取数据源配置
   */
  public getSourceConfig(): any {
    return this.getConfig(true);
  }

  /**
   * 获取项目信息
   * @param context - 上下文信息
   * @param ncMeta - 元数据服务实例
   */
  getProject(context: NcContext, ncMeta = Noco.ncMeta): Promise<Base> {
    return Base.get(context, this.base_id, ncMeta);
  }

  /**
   * 清理数据源
   * @param _ncMeta - 元数据服务实例
   */
  async sourceCleanup(_ncMeta = Noco.ncMeta) {
    // 删除连接
    await NcConnectionMgrv2.deleteAwait(this);

    // 释放工作进程
    if (JobsRedis.available) {
      await JobsRedis.emitWorkerCommand(InstanceCommands.RELEASE, this.id);
      await JobsRedis.emitPrimaryCommand(InstanceCommands.RELEASE, this.id);
    }
  }

  /**
   * 删除数据源
   * @param context - 上下文信息
   * @param ncMeta - 元数据服务实例
   * @param options - 删除选项
   */
  async delete(
    context: NcContext,
    ncMeta = Noco.ncMeta,
    { force }: { force?: boolean } = {},
  ) {
    // 获取数据源列表
    const sources = await Source.list(
      context,
      { baseId: this.base_id },
      ncMeta,
    );

    // 检查是否可以删除
    if ((sources[0].id === this.id || this.isMeta()) && !force) {
      NcError.badRequest('Cannot delete first source');
    }

    // 获取模型列表
    const models = await Model.list(
      context,
      {
        source_id: this.id,
        base_id: this.base_id,
      },
      ncMeta,
    );

    // 处理关联列
    const relColumns = [];
    const relRank = {
      [UITypes.Lookup]: 1,
      [UITypes.Rollup]: 2,
      [UITypes.ForeignKey]: 3,
      [UITypes.LinkToAnotherRecord]: 4,
    };

    // 收集关联列
    for (const model of models) {
      for (const col of await model.getColumns(context, ncMeta)) {
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
          case UITypes.ForeignKey:
          case UITypes.LinkToAnotherRecord:
            colOptionTableName = MetaTable.COL_RELATIONS;
            cacheScopeName = CacheScope.COL_RELATION;
            break;
        }
        if (colOptionTableName && cacheScopeName) {
          relColumns.push({ col, colOptionTableName, cacheScopeName });
        }
      }
    }

    // 按优先级排序
    relColumns.sort((a, b) => {
      return relRank[a.col.uidt] - relRank[b.col.uidt];
    });

    // 删除关联列
    for (const relCol of relColumns) {
      await ncMeta.metaDelete(
        context.workspace_id,
        context.base_id,
        relCol.colOptionTableName,
        {
          fk_column_id: relCol.col.id,
        },
      );
      await NocoCache.deepDel(
        `${relCol.cacheScopeName}:${relCol.col.id}`,
        CacheDelDirection.CHILD_TO_PARENT,
      );
    }

    // 删除模型
    for (const model of models) {
      await model.delete(context, ncMeta, true);
    }

    // 删除同步源
    const syncSources = await SyncSource.list(
      context,
      this.base_id,
      this.id,
      ncMeta,
    );
    for (const syncSource of syncSources) {
      await SyncSource.delete(context, syncSource.id, ncMeta);
    }

    // 清理数据源
    await this.sourceCleanup(ncMeta);

    // 删除数据源数据
    const res = await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.SOURCES,
      this.id,
    );

    // 清理缓存
    await NocoCache.deepDel(
      `${CacheScope.SOURCE}:${this.id}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );

    return res;
  }

  /**
   * 软删除数据源
   * @param context - 上下文信息
   * @param ncMeta - 元数据服务实例
   * @param options - 删除选项
   */
  async softDelete(
    context: NcContext,
    ncMeta = Noco.ncMeta,
    { force }: { force?: boolean } = {},
  ) {
    // 获取数据源列表
    const sources = await Source.list(
      context,
      { baseId: this.base_id },
      ncMeta,
    );

    // 检查是否可以删除
    if ((sources[0].id === this.id || this.isMeta()) && !force) {
      NcError.badRequest('Cannot delete first base');
    }

    // 更新删除标记
    await Source.update(context, this.id, { deleted: true }, ncMeta);

    // 清理缓存
    await NocoCache.deepDel(
      `${CacheScope.SOURCE}:${this.id}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );
  }

  /**
   * 获取模型列表
   * @param context - 上下文信息
   * @param ncMeta - 元数据服务实例
   */
  async getModels(context: NcContext, ncMeta = Noco.ncMeta) {
    return await Model.list(
      context,
      { base_id: this.base_id, source_id: this.id },
      ncMeta,
    );
  }

  /**
   * 共享 ERD
   * @param context - 上下文信息
   * @param ncMeta - 元数据服务实例
   */
  async shareErd(context: NcContext, ncMeta = Noco.ncMeta) {
    if (!this.erd_uuid) {
      // 生成 UUID
      const uuid = uuidv4();
      this.erd_uuid = uuid;

      // 更新元数据
      await ncMeta.metaUpdate(
        context.workspace_id,
        context.base_id,
        MetaTable.SOURCES,
        {
          erd_uuid: this.erd_uuid,
        },
        this.id,
      );

      // 更新缓存
      await NocoCache.update(`${CacheScope.SOURCE}:${this.id}`, {
        erd_uuid: this.erd_uuid,
      });
    }
    return this;
  }

  /**
   * 禁用 ERD 共享
   * @param context - 上下文信息
   * @param ncMeta - 元数据服务实例
   */
  async disableShareErd(context: NcContext, ncMeta = Noco.ncMeta) {
    if (this.erd_uuid) {
      this.erd_uuid = null;

      // 更新元数据
      await ncMeta.metaUpdate(
        context.workspace_id,
        context.base_id,
        MetaTable.SOURCES,
        {
          erd_uuid: this.erd_uuid,
        },
        this.id,
      );

      // 更新缓存
      await NocoCache.update(`${CacheScope.SOURCE}:${this.id}`, {
        erd_uuid: this.erd_uuid,
      });
    }
    return this;
  }

  /**
   * 检查是否为元数据源
   * @param _only - 是否仅检查元数据源
   * @param _mode - 检查模式
   */
  isMeta(_only = false, _mode = 0) {
    if (_only) {
      if (_mode === 0) {
        return this.is_meta;
      }
      return this.is_local;
    } else {
      return this.is_meta || this.is_local;
    }
  }

  /**
   * 扩展查询构建器
   * @param qb - 查询构建器
   * @param _context - 上下文信息
   */
  protected static extendQb(qb: any, _context: NcContext) {
    qb.select(
      `${MetaTable.INTEGRATIONS}.config as integration_config`,
      `${MetaTable.INTEGRATIONS}.title as integration_title`,
    ).leftJoin(
      MetaTable.INTEGRATIONS,
      `${MetaTable.SOURCES}.fk_integration_id`,
      `${MetaTable.INTEGRATIONS}.id`,
    );
  }

  /**
   * 更新相关缓存
   * @param context - 上下文信息
   * @param sourceId - 数据源ID
   * @param ncMeta - 元数据服务实例
   */
  private static async updateRelatedCaches(
    context: NcContext,
    sourceId: string,
    ncMeta = Noco.ncMeta,
  ) {
    // 获取模型列表
    const models = await Model.list(
      context,
      { source_id: sourceId, base_id: context.base_id },
      ncMeta,
    );

    // 清理模型查询缓存
    for (const model of models) {
      await View.clearSingleQueryCache(context, model.id, null, ncMeta);
    }
  }
}
