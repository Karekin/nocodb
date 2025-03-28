// 导入所需的 NestJS 装饰器和类型
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
// 导入集成相关的类型定义
import { IntegrationReqType, IntegrationsType } from 'nocodb-sdk';
// This service is overwritten entirely in the cloud and does not extend there.
// As a result, it refers to services from OSS to avoid type mismatches.
// 导入集成服务
import { IntegrationsService } from 'src/services/integrations.service';
// 导入全局守卫
import { GlobalGuard } from '~/guards/global/global.guard';
// 导入访问控制中间件
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
// 导入 API 限制器守卫
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
// 导入租户上下文装饰器
import { TenantContext } from '~/decorators/tenant-context.decorator';
// 导入上下文和请求接口
import { NcContext, NcRequest } from '~/interface/config';
// 导入集成模型
import { Integration } from '~/models';
// 导入配置掩码辅助函数
import { maskKnexConfig } from '~/helpers/responseHelpers';

// 声明控制器
@Controller()
// 使用 API 限制器和全局守卫
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class IntegrationsController {
  // 构造函数，注入集成服务
  constructor(protected readonly integrationsService: IntegrationsService) {}

  // 获取单个集成详情的接口
  @Get(['/api/v2/meta/integrations/:integrationId'])
  // 设置访问控制，范围为组织级别
  @Acl('integrationGet', {
    scope: 'org',
  })
  async integrationGet(
    @TenantContext() context: NcContext,
    @Param('integrationId') integrationId: string,
    @Query('includeConfig') includeConfig: string,
    @Query('includeSources') includeSources: string,
    @Req() req: NcRequest,
  ) {
    // 调用服务获取集成配置
    const integration = await this.integrationsService.integrationGetWithConfig(
      context,
      {
        integrationId,
        includeSources: includeSources === 'true',
      },
    );

    // 如果未请求配置或用户不是所有者，则隐藏配置信息
    if (
      includeConfig !== 'true' ||
      (integration.is_private && req.user.id !== integration.created_by)
    )
      integration.config = undefined;

    // 如果是数据库类型的集成，则掩码处理配置
    if (integration.type === IntegrationsType.Database) {
      maskKnexConfig(integration);
    }

    return integration;
  }

  // 创建新集成的接口
  @Post(['/api/v2/meta/integrations'])
  // 设置访问控制，范围为组织级别
  @Acl('integrationCreate', {
    scope: 'org',
  })
  async integrationCreate(
    @TenantContext() context: NcContext,
    @Body() integration: IntegrationReqType,
    @Req() req: NcRequest,
  ) {
    // 调用服务创建集成
    return await this.integrationsService.integrationCreate(context, {
      integration,
      req,
    });
  }

  // 删除集成的接口
  @Delete(['/api/v2/meta/integrations/:integrationId'])
  // 设置访问控制，范围为组织级别
  @Acl('integrationDelete', {
    scope: 'org',
  })
  async integrationDelete(
    @TenantContext() context: NcContext,
    @Param('integrationId') integrationId: string,
    @Req() req: NcRequest,
    @Query('force') force: string,
  ) {
    // 调用服务删除集成
    return await this.integrationsService.integrationDelete(context, {
      req,
      integrationId,
      force: force === 'true',
    });
  }

  // 更新集成的接口
  @Patch(['/api/v2/meta/integrations/:integrationId'])
  // 设置访问控制，范围为组织级别
  @Acl('integrationUpdate', {
    scope: 'org',
  })
  async integrationUpdate(
    @TenantContext() context: NcContext,
    @Param('integrationId') integrationId: string,
    @Body() body: IntegrationReqType,
    @Req() req: NcRequest,
  ) {
    // 调用服务更新集成
    const integration = await this.integrationsService.integrationUpdate(
      context,
      {
        integration: body,
        integrationId,
        req,
      },
    );

    return integration;
  }

  // 获取集成列表的接口
  @Get(['/api/v2/meta/integrations'])
  // 设置访问控制，范围为组织级别，扩展范围为基础
  @Acl('integrationList', {
    scope: 'org',
    extendedScope: 'base',
  })
  async integrationList(
    @Req() req: NcRequest,
    @Query('type') type: IntegrationsType,
    @Query('includeDatabaseInfo') includeDatabaseInfo?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('query') query?: string,
  ) {
    // 调用服务获取集成列表
    const integrations = await this.integrationsService.integrationList({
      req,
      includeDatabaseInfo: includeDatabaseInfo === 'true',
      type,
      query,
    });

    // 如果不包含数据库信息，则移除配置信息
    if (!includeDatabaseInfo) {
      for (const integration of integrations.list) {
        integration.config = undefined;
      }
    }

    return integrations;
  }

  // 获取可用集成列表的接口
  @Get(['/api/v2/integrations'])
  async availableIntegrations() {
    // 返回经过排序的可用集成列表
    return Integration.availableIntegrations
      .sort((a, b) => a.type.localeCompare(b.type))
      .sort((a, b) => a.sub_type.localeCompare(b.sub_type))
      .map((i) => ({
        type: i.type,
        sub_type: i.sub_type,
        meta: i.meta,
      }));
  }

  // 获取特定类型集成元数据的接口
  @Get(['/api/v2/integrations/:type/:subType'])
  async getIntegrationMeta(
    @Param('type') type: IntegrationsType,
    @Param('subType') subType: string,
  ) {
    // 查找指定类型的集成
    const integration = Integration.availableIntegrations.find(
      (i) => i.type === type && i.sub_type === subType,
    );

    // 如果未找到集成则抛出错误
    if (!integration) {
      throw new Error('Integration not found!');
    }

    // 返回集成元数据
    return {
      integrationType: integration.type,
      integrationSubType: integration.sub_type,
      form: integration.form,
      meta: integration.meta,
    };
  }

  // 存储集成数据的接口
  @Post(['/api/v2/integrations/:integrationId/store'])
  async storeIntegration(
    @TenantContext() context: NcContext,
    @Param('integrationId') integrationId: string,
    @Body()
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
    // 获取集成实例
    const integration = await Integration.get(context, integrationId);

    // 如果未找到集成则抛出错误
    if (!integration) {
      throw new Error('Integration not found!');
    }

    // 调用服务存储集成数据
    return await this.integrationsService.integrationStore(
      context,
      integration,
      payload,
    );
  }

  // 调用集成端点的接口
  @Post(['/api/v2/integrations/:integrationId/:endpoint'])
  async integrationEndpointGet(
    @TenantContext() context: NcContext,
    @Param('integrationId') integrationId: string,
    @Param('endpoint') endpoint: string,
    @Body() body: any,
  ) {
    // 调用服务处理集成端点请求
    return await this.integrationsService.callIntegrationEndpoint(context, {
      integrationId,
      endpoint,
      payload: body,
    });
  }
}
