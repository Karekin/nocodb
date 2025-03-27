// 导入NestJS的Injectable装饰器，用于依赖注入
import { Injectable } from '@nestjs/common';
// 从nocodb-sdk导入必要的事件、类型和工具函数
import {
  AppEvents, // 应用事件枚举
  IntegrationsType, // 集成类型枚举
  validateAndExtractSSLProp, // 验证和提取SSL属性的工具函数
} from 'nocodb-sdk';
// 导入类型定义
import type { BaseReqType, IntegrationType } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
// 导入应用钩子服务
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
// 导入辅助函数
import { populateMeta, validatePayload } from '~/helpers';
import { populateRollupColumnAndHideLTAR } from '~/helpers/populateMeta';
import { syncBaseMigration } from '~/helpers/syncMigration';
// 导入模型
import { Base, Integration, Source } from '~/models';
// 导入错误处理工具
import { NcError } from '~/helpers/catchError';
// 导入Noco主类
import Noco from '~/Noco';

// 使用Injectable装饰器标记该服务可被依赖注入
@Injectable()
export class SourcesService {
  // 构造函数，注入AppHooksService
  constructor(protected readonly appHooksService: AppHooksService) {}

  /**
   * 获取数据源及其配置
   * @param context - NocoDB上下文
   * @param param - 包含sourceId的参数对象
   * @returns 返回数据源对象
   */
  async baseGetWithConfig(context: NcContext, param: { sourceId: any }) {
    // 获取数据源
    const source = await Source.get(context, param.sourceId);

    // 如果数据源不存在，抛出错误
    if (!source) {
      NcError.sourceNotFound(param.sourceId);
    }

    // 获取数据源配置并添加到数据源对象
    source.config = await source.getSourceConfig();

    return source;
  }

  /**
   * 更新数据源
   * @param context - NocoDB上下文
   * @param param - 包含sourceId、source、baseId和req的参数对象
   * @returns 返回更新后的数据源
   */
  async baseUpdate(
    context: NcContext,
    param: {
      sourceId: string;
      source: BaseReqType;
      baseId: string;
      req: NcRequest;
    },
  ) {
    // 验证请求负载是否符合BaseReq模式
    validatePayload('swagger.json#/components/schemas/BaseReq', param.source);

    // 获取旧的数据源
    const oldSource = await Source.get(context, param.sourceId);

    // 如果数据源不存在，抛出错误
    if (!oldSource) {
      NcError.sourceNotFound(param.sourceId);
    }

    // 获取请求体
    const baseBody = param.source;
    // 更新数据源
    const source = await Source.update(context, param.sourceId, {
      ...baseBody,
      type: baseBody.config?.client,
      id: param.sourceId,
    });

    // 清除配置信息（出于安全考虑）
    source.config = undefined;

    // 获取关联的集成
    const integration = await Integration.get(
      context,
      source.fk_integration_id,
    );

    // 触发数据源更新事件
    this.appHooksService.emit(AppEvents.SOURCE_UPDATE, {
      source,
      oldSource,
      req: param.req,
      integration,
      context,
    });

    return source;
  }

  /**
   * 列出指定基础的所有数据源
   * @param context - NocoDB上下文
   * @param param - 包含baseId的参数对象
   * @returns 返回数据源列表
   */
  async baseList(context: NcContext, param: { baseId: string }) {
    // 获取指定基础的所有数据源
    const sources = await Source.list(context, { baseId: param.baseId });

    return sources;
  }

  /**
   * 删除数据源
   * @param context - NocoDB上下文
   * @param param - 包含sourceId和req的参数对象
   * @param ncMeta - 元数据对象，默认为Noco.ncMeta
   * @returns 返回操作是否成功
   */
  async baseDelete(
    context: NcContext,
    param: { sourceId: string; req: any },
    ncMeta = Noco.ncMeta,
  ) {
    try {
      // 获取数据源
      const source = await Source.get(context, param.sourceId, true, ncMeta);
      // 获取关联的集成
      const integration = await Integration.get(
        context,
        source.fk_integration_id,
      );
      // 删除数据源
      await source.delete(context, ncMeta);
      // 触发数据源删除事件
      this.appHooksService.emit(AppEvents.SOURCE_DELETE, {
        source: {
          ...source,
          config: undefined, // 清除配置信息
        },
        req: param.req,
        integration: {
          ...integration,
          config: undefined, // 清除配置信息
        },
        context,
      });
    } catch (e) {
      // 处理错误
      NcError.badRequest(e);
    }
    return true;
  }

  /**
   * 软删除数据源（标记为删除但不实际删除）
   * @param context - NocoDB上下文
   * @param param - 包含sourceId的参数对象
   * @param ncMeta - 元数据对象，默认为Noco.ncMeta
   * @returns 返回操作是否成功
   */
  async baseSoftDelete(
    context: NcContext,
    param: { sourceId: string },
    ncMeta = Noco.ncMeta,
  ) {
    try {
      // 获取数据源
      const source = await Source.get(context, param.sourceId, false, ncMeta);
      // 软删除数据源
      await source.softDelete(context, ncMeta);
    } catch (e) {
      // 处理错误
      NcError.badRequest(e);
    }
    return true;
  }

  /**
   * 创建新的数据源
   * @param context - NocoDB上下文
   * @param param - 包含baseId、source、logger和req的参数对象
   * @returns 返回创建的数据源和可能的错误
   */
  async baseCreate(
    context: NcContext,
    param: {
      baseId: string;
      source: BaseReqType;
      logger?: (message: string) => void;
      req: any;
    },
  ): Promise<{
    source: Source;
    error?: any;
  }> {
    // 验证请求负载是否符合BaseReq模式
    validatePayload('swagger.json#/components/schemas/BaseReq', param.source);

    // 获取请求体和基础信息
    const baseBody = param.source;
    const base = await Base.getWithInfo(context, param.baseId);

    let error;

    // 记录日志：创建数据源
    param.logger?.('Creating the source');
    let integration: IntegrationType;

    // 如果缺少集成ID，创建一个新的私有集成并映射到数据源
    if (!(baseBody as any).fk_integration_id) {
      integration = await Integration.createIntegration({
        title: baseBody.alias,
        type: IntegrationsType.Database,
        sub_type: baseBody.config?.client,
        is_private: !!param.req.user?.id,
        config: baseBody.config,
        workspaceId: context.workspace_id,
        created_by: param.req.user?.id,
      });

      // 设置集成ID和配置
      (baseBody as any).fk_integration_id = integration.id;
      baseBody.config = {
        client: baseBody.config?.client,
      };
      baseBody.type = baseBody.config?.client as unknown as BaseReqType['type'];
    } else {
      // 获取现有集成
      integration = await Integration.get(
        context,
        (baseBody as any).fk_integration_id,
      );

      // 检查集成是否存在
      if (!integration) {
        NcError.integrationNotFound((baseBody as any).fk_integration_id);
      }

      // 检查集成类型是否为数据库
      if (
        integration.type !== IntegrationsType.Database ||
        !integration.sub_type
      ) {
        NcError.badRequest('Integration type should be Database');
      }

      // 设置类型
      baseBody.type = integration.sub_type as unknown as BaseReqType['type'];
    }

    // 更新无效的SSL配置值（如果存在）
    if (baseBody.config?.connection?.ssl) {
      baseBody.config.connection.ssl = validateAndExtractSSLProp(
        baseBody.config.connection,
        baseBody.config.sslUse,
        baseBody.config.client,
      );
    }

    // 创建数据源
    const source = await Source.createBase(context, {
      ...baseBody,
      baseId: base.id,
    });

    try {
      // 同步基础迁移
      await syncBaseMigration(base, source);

      // 记录日志：填充元数据
      param.logger?.('Populating meta');

      // 填充元数据
      const info = await populateMeta(context, {
        source,
        base,
        logger: param.logger,
        user: param.req.user,
      });

      // 填充汇总列并隐藏LTAR
      await populateRollupColumnAndHideLTAR(context, source, base);

      // 触发API创建事件
      this.appHooksService.emit(AppEvents.APIS_CREATED, {
        info,
        req: param.req,
        context,
      });

      // 清除配置信息
      source.config = undefined;

      // 触发数据源创建事件
      this.appHooksService.emit(AppEvents.SOURCE_CREATE, {
        source,
        req: param.req,
        integration,
        context,
      });
    } catch (e) {
      // 捕获错误
      error = e;
    }

    // 返回创建的数据源和可能的错误
    return { source, error };
  }
}
