// 导入 NestJS 的 Injectable 装饰器，用于依赖注入
import { Injectable } from '@nestjs/common';
// 导入 nocodb-sdk 中的 AppEvents 和 ClientType 枚举
import { AppEvents, ClientType } from 'nocodb-sdk';
// 导入 nocodb-sdk 中的 IntegrationsType 枚举
import { IntegrationsType } from 'nocodb-sdk';
// 导入 IntegrationReqType 类型定义
import type { IntegrationReqType } from 'nocodb-sdk';
// 导入 NcContext 和 NcRequest 接口类型
import type { NcContext, NcRequest } from '~/interface/config';
// 导入 AppHooksService 服务
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
// 导入验证负载的辅助函数
import { validatePayload } from '~/helpers';
// 导入 Base 和 Integration 模型
import { Base, Integration } from '~/models';
// 导入错误处理相关的类
import { NcBaseError, NcError } from '~/helpers/catchError';
// 导入 Source 模型
import { Source } from '~/models';
// 导入全局常量和枚举
import { CacheScope, MetaTable, RootScopes } from '~/utils/globals';
// 导入 Noco 主类
import Noco from '~/Noco';
// 导入缓存管理类
import NocoCache from '~/cache/NocoCache';
// 导入连接管理器
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
// 导入 Redis 任务管理
import { JobsRedis } from '~/modules/jobs/redis/jobs-redis';
// 导入实例命令枚举
import { InstanceCommands } from '~/interface/Jobs';
// 导入 SourcesService 服务
import { SourcesService } from '~/services/sources.service';
// 导入生成唯一名称的辅助函数
import { generateUniqueName } from '~/helpers/exportImportHelpers';

// 使用 Injectable 装饰器标记该类可被依赖注入系统使用
@Injectable()
export class IntegrationsService {
  // 构造函数，注入所需的服务
  constructor(
    // 注入 AppHooksService 服务，用于处理应用钩子
    protected readonly appHooksService: AppHooksService,
    // 注入 SourcesService 服务，用于处理数据源
    protected readonly sourcesService: SourcesService,
  ) {}

  // 获取集成配置的方法
  async integrationGetWithConfig(
    // 上下文参数
    context: NcContext,
    // 方法参数，包含集成ID和是否包含数据源
    param: { integrationId: any; includeSources?: boolean },
  ) {
    // 根据ID获取集成
    const integration = await Integration.get(context, param.integrationId);

    // 如果集成不存在，抛出错误
    if (!integration) {
      NcError.integrationNotFound(param.integrationId);
    }

    // 获取集成的连接配置
    integration.config = await integration.getConnectionConfig();

    // 如果需要包含数据源，则获取相关数据源
    if (param.includeSources) {
      await integration.getSources();
    }

    // 返回集成对象
    return integration;
  }

  // 更新集成的方法
  async integrationUpdate(
    // 上下文参数
    context: NcContext,
    // 方法参数，包含集成ID、集成对象和请求对象
    param: {
      integrationId: string;
      integration: IntegrationReqType;
      req: NcRequest;
    },
  ) {
    // 验证请求负载是否符合规范
    validatePayload(
      'swagger.json#/components/schemas/IntegrationReq',
      param.integration,
    );
    // 获取旧的集成对象
    const oldIntegration = await Integration.get(context, param.integrationId);

    // 获取集成请求体
    const integrationBody = param.integration;
    // 更新集成
    const integration = await Integration.updateIntegration(
      context,
      param.integrationId,
      {
        ...integrationBody,
        id: param.integrationId,
      },
    );

    // 更新使用此集成的数据源的缓存配置
    await this.updateIntegrationSourceConfig({ integration });

    // 清除配置信息（出于安全考虑）
    integration.config = undefined;

    // 触发集成更新事件
    this.appHooksService.emit(AppEvents.INTEGRATION_UPDATE, {
      integration,
      req: param.req,
      user: param.req?.user,
      oldIntegration,
      context: {
        ...context,
        base_id: null,
      },
    });

    // 返回更新后的集成对象
    return integration;
  }

  // 列出集成的方法
  async integrationList(param: {
    // 请求对象
    req: NcRequest;
    // 是否包含数据库信息
    includeDatabaseInfo: boolean;
    // 集成类型（可选）
    type?: IntegrationsType;
    // 分页限制（可选）
    limit?: number;
    // 分页偏移（可选）
    offset?: number;
    // 查询字符串（可选）
    query?: string;
  }) {
    // 调用 Integration 模型的 list 方法获取集成列表
    const integrations = await Integration.list({
      userId: param.req.user?.id,
      includeDatabaseInfo: param.includeDatabaseInfo,
      type: param.type,
      includeSourceCount: true,
      query: param.query,
    });

    // 返回集成列表
    return integrations;
  }

  // 删除集成的方法
  async integrationDelete(
    // 上下文参数（不包含 base_id）
    context: Omit<NcContext, 'base_id'>,
    // 方法参数，包含集成ID、请求对象和是否强制删除
    param: { integrationId: string; req: any; force: boolean },
  ) {
    // 开始事务
    const ncMeta = await Noco.ncMeta.startTransaction();
    try {
      // 获取集成对象
      const integration = await Integration.get(
        context,
        param.integrationId,
        true,
        ncMeta,
      );

      // 如果集成不存在，抛出错误
      if (!integration) {
        NcError.integrationNotFound(param.integrationId);
      }

      // 构建查询，获取与该集成关联的数据源
      const sourceListQb = ncMeta
        .knex(MetaTable.SOURCES)
        .where({
          fk_integration_id: integration.id,
        })
        .where((qb) => {
          qb.where('deleted', false).orWhere('deleted', null);
        });

      // 如果集成属于某个工作区，添加工作区条件
      if (integration.fk_workspace_id) {
        sourceListQb.where('fk_workspace_id', integration.fk_workspace_id);
      }

      // 执行查询，获取数据源列表
      const sources: Pick<Source, 'id' | 'base_id'>[] =
        await sourceListQb.select('id', 'base_id');

      // 如果有关联的数据源且不是强制删除，则抛出错误
      if (sources.length > 0 && !param.force) {
        // 获取所有关联的基础对象
        const bases = await Promise.all(
          sources.map(async (source) => {
            return await Base.get(
              {
                workspace_id: integration.fk_workspace_id,
                base_id: source.base_id,
              },
              source.base_id,
              ncMeta,
            );
          }),
        );

        // 抛出错误，表示集成与多个对象关联
        NcError.integrationLinkedWithMultiple(bases, sources);
      }

      // 删除集成
      await integration.delete(ncMeta);
      // 触发集成删除事件
      this.appHooksService.emit(AppEvents.INTEGRATION_DELETE, {
        integration,
        req: param.req,
        user: param.req?.user,
        context: {
          ...context,
          base_id: null,
        },
      });

      // 提交事务
      await ncMeta.commit();
    } catch (e) {
      // 回滚事务
      await ncMeta.rollback(e);
      // 如果是已知错误类型，直接抛出
      if (e instanceof NcError || e instanceof NcBaseError) throw e;
      // 否则包装为 badRequest 错误
      NcError.badRequest(e);
    }

    // 返回成功标志
    return true;
  }

  // 软删除集成的方法
  async integrationSoftDelete(
    // 上下文参数（不包含 base_id）
    context: Omit<NcContext, 'base_id'>,
    // 方法参数，包含集成ID和请求对象
    param: { integrationId: string; req: any },
  ) {
    try {
      // 获取集成对象
      const integration = await Integration.get(context, param.integrationId);
      // 如果集成不存在，抛出错误
      if (!integration) {
        NcError.integrationNotFound(param.integrationId);
      }

      // 开始事务
      const ncMeta = await Noco.ncMeta.startTransaction();
      try {
        // 构建查询，获取与该集成关联的数据源
        const sourceListQb = ncMeta
          .knex(MetaTable.SOURCES)
          .where({
            fk_integration_id: integration.id,
          })
          .where((qb) => {
            qb.where('deleted', false).orWhere('deleted', null);
          });

        // 如果集成属于某个工作区，添加工作区条件
        if (integration.fk_workspace_id) {
          sourceListQb.where('fk_workspace_id', integration.fk_workspace_id);
        }

        // 执行查询，获取数据源列表
        const sources: Pick<Source, 'id' | 'base_id'>[] =
          await sourceListQb.select('id', 'base_id');

        // 对每个数据源执行软删除
        for (const source of sources) {
          await this.sourcesService.baseSoftDelete(
            {
              workspace_id: integration.fk_workspace_id,
              base_id: source.base_id,
            },
            {
              sourceId: source.id,
            },
            ncMeta,
          );
        }

        // 软删除集成
        await integration.softDelete(ncMeta);
        // 触发集成删除事件
        this.appHooksService.emit(AppEvents.INTEGRATION_DELETE, {
          integration,
          req: param.req,
          user: param.req?.user,
        });

        // 提交事务
        await ncMeta.commit();
      } catch (e) {
        // 回滚事务
        await ncMeta.rollback(e);
        // 如果是已知错误类型，直接抛出
        if (e instanceof NcError || e instanceof NcBaseError) throw e;
        // 否则包装为 badRequest 错误
        NcError.badRequest(e);
      }
    } catch (e) {
      // 包装为 badRequest 错误
      NcError.badRequest(e);
    }

    // 返回成功标志
    return true;
  }

  // 创建集成的方法
  async integrationCreate(
    // 上下文参数
    context: NcContext,
    // 方法参数，包含集成对象、日志记录器和请求对象
    param: {
      integration: IntegrationReqType;
      logger?: (message: string) => void;
      req: any;
    },
  ) {
    // 验证请求负载是否符合规范
    validatePayload(
      'swagger.json#/components/schemas/IntegrationReq',
      param.integration,
    );

    let integrationBody;

    // 如果是从现有集成复制
    if (param.integration.copy_from_id) {
      // 获取源集成
      integrationBody = await Integration.get(
        context,
        param.integration.copy_from_id,
      );

      // 如果源集成不存在，抛出错误
      if (!integrationBody?.id) {
        NcError.integrationNotFound(param.integration.copy_from_id);
      }

      // 获取源集成的连接配置
      integrationBody.config = await integrationBody.getConnectionConfig();
    } else {
      // 否则使用请求中的集成对象
      integrationBody = param.integration;
    }
    // 记录日志（如果提供了日志记录器）
    param.logger?.('Creating the integration');

    // 对于 SQLite 类型的集成，检查是否已存在引用相同文件的集成
    if (integrationBody.sub_type === 'sqlite3') {
      // 获取所有 SQLite 类型的集成
      const integrations = await Integration.list({
        userId: param.req.user?.id,
        includeDatabaseInfo: true,
        type: IntegrationsType.Database,
        sub_type: ClientType.SQLITE,
        includeSourceCount: false,
        query: '',
      });

      // 检查是否有集成引用相同的文件
      if (integrations.list && integrations.list.length > 0) {
        for (const integration of integrations.list) {
          const config = integration.config as any;
          if (
            (config?.connection?.filename ||
              config?.connection?.connection?.filename) ===
            (integrationBody.config?.connection?.filename ||
              integrationBody.config?.connection?.connection?.filename)
          ) {
            // 如果存在，抛出错误
            NcError.badRequest('Integration with same file already exists');
          }
        }
      }
    }

    let uniqueTitle = '';

    // 如果是从现有集成复制，生成唯一的标题
    if (param.integration.copy_from_id) {
      // 获取所有集成
      const integrations =
        (
          await Integration.list({
            userId: param.req.user?.id,
            includeSourceCount: false,
            query: '',
          })
        ).list || [];

      // 生成唯一标题
      uniqueTitle = generateUniqueName(
        `${integrationBody.title} copy`,
        integrations.map((p) => p.title),
      );
    }

    // 创建集成
    const integration = await Integration.createIntegration({
      ...integrationBody,
      // 如果是复制，使用生成的唯一标题
      ...(param.integration.copy_from_id ? { title: uniqueTitle } : {}),
      // 设置创建者
      created_by: param.req.user.id,
    });

    // 清除配置信息（出于安全考虑）
    integration.config = undefined;

    // 触发集成创建事件
    this.appHooksService.emit(AppEvents.INTEGRATION_CREATE, {
      integration,
      req: param.req,
      user: param.req?.user,
      context: {
        ...context,
        base_id: null,
      },
    });

    // 返回创建的集成对象
    return integration;
  }

  // 集成存储操作的方法
  async integrationStore(
    // 上下文参数
    context: NcContext,
    // 集成对象
    integration: Integration,
    // 操作负载，可以是列表、获取或求和操作
    payload?:
      | {
          op: 'list';
          limit: number;
          offset: number;
        }
      | {
          op: 'get';
        }
      | {
          op: 'sum';
          fields: string[];
        },
  ) {
    // 根据操作类型执行不同的操作
    if (payload.op === 'list') {
      // 列表操作
      return await integration.storeList(
        context,
        payload.limit,
        payload.offset,
      );
    } else if (payload.op === 'sum') {
      // 求和操作
      return await integration.storeSum(context, payload.fields);
    } else if (payload.op === 'get') {
      // 获取最新操作
      return await integration.storeGetLatest(context);
    }
  }

  // 更新使用此集成的所有数据源配置的方法
  // 我们用新的集成配置覆盖数据源配置，但排除数据库名称和模式名称
  protected async updateIntegrationSourceConfig(
    // 参数对象，包含集成
    {
      integration,
    }: {
      integration: Integration;
    },
    // 元数据管理器，默认为 Noco.ncMeta
    ncMeta = Noco.ncMeta,
  ) {
    // 获取使用此集成的所有基础对象
    const sources = await ncMeta.metaList2(
      integration.fk_workspace_id,
      RootScopes.WORKSPACE,
      MetaTable.SOURCES,
      {
        condition: {
          fk_integration_id: integration.id,
        },
        xcCondition: {
          _or: [
            {
              deleted: {
                eq: false,
              },
            },
            {
              deleted: {
                eq: null,
              },
            },
          ],
        },
      },
    );

    // 遍历并更新数据源的缓存
    for (const sourceObj of sources) {
      // 创建数据源对象
      const source = new Source(sourceObj);

      // 使用新配置更新缓存（已加密）
      await NocoCache.update(`${CacheScope.SOURCE}:${source.id}`, {
        integration_config: integration.config,
      });

      // 删除连接引用
      await NcConnectionMgrv2.deleteAwait(source);

      // 从工作器释放连接
      if (JobsRedis.available) {
        await JobsRedis.emitWorkerCommand(InstanceCommands.RELEASE, source.id);
        await JobsRedis.emitPrimaryCommand(InstanceCommands.RELEASE, source.id);
      }
    }
  }

  // 调用集成端点的公共方法
  public async callIntegrationEndpoint(
    // 上下文参数
    context: NcContext,
    // 方法参数，包含集成ID、端点名称和负载
    params: {
      integrationId: string;
      endpoint: string;
      payload?: any;
    },
  ) {
    // 获取集成对象
    const integration = await Integration.get(context, params.integrationId);

    // 获取集成元数据
    const integrationMeta = integration.getIntegrationMeta();

    // 获取集成包装器
    const wrapper = integration.getIntegrationWrapper();

    // 如果元数据或包装器不存在，抛出错误
    if (!integrationMeta || !wrapper) {
      NcError.badRequest('Invalid integration');
    }

    // 检查端点是否有效
    if (
      !integrationMeta.exposedEndpoints?.includes(params.endpoint) ||
      !(params.endpoint in wrapper) ||
      typeof wrapper[params.endpoint] !== 'function'
    ) {
      // 如果端点不存在或不是函数，抛出错误
      NcError.genericNotFound('Endpoint', params.endpoint);
    }

    // 调用端点函数并返回结果
    return wrapper[params.endpoint](context, params.payload);
  }
}
