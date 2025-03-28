// 导入所需的 NestJS 装饰器和类型
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
// 导入 BaseReqType 类型定义
import { BaseReqType } from 'nocodb-sdk';
// 导入全局守卫
import { GlobalGuard } from '~/guards/global/global.guard';
// 导入分页响应实现类
import { PagedResponseImpl } from '~/helpers/PagedResponse';
// 导入访问控制列表中间件
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
// 导入数据源服务
import { SourcesService } from '~/services/sources.service';
// 导入元数据 API 限制器守卫
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
// 导入租户上下文装饰器
import { TenantContext } from '~/decorators/tenant-context.decorator';
// 导入 NcContext 和 NcRequest 接口
import { NcContext, NcRequest } from '~/interface/config';
// 导入 Knex 配置掩码辅助函数
import { maskKnexConfig } from '~/helpers/responseHelpers';

// 声明控制器
@Controller()
// 使用元数据 API 限制器守卫和全局守卫
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class SourcesController {
  // 构造函数，注入 SourcesService
  constructor(private readonly sourcesService: SourcesService) {}

  // 获取单个数据源的 GET 请求处理器，支持 v1 和 v2 API 路径
  @Get([
    '/api/v1/db/meta/projects/:baseId/bases/:sourceId',
    '/api/v2/meta/bases/:baseId/sources/:sourceId',
  ])
  // 应用 baseGet 访问控制
  @Acl('baseGet')
  async baseGet(
    // 获取租户上下文
    @TenantContext() context: NcContext,
    // 获取路径参数 sourceId
    @Param('sourceId') sourceId: string,
  ) {
    // 调用服务获取数据源及其配置
    const source = await this.sourcesService.baseGetWithConfig(context, {
      sourceId,
    });

    // 如果是元数据源，清除配置信息
    if (source.isMeta()) {
      source.config = undefined;
    }
    // 清除集成配置信息
    source.integration_config = undefined;

    // 掩码 Knex 配置中的敏感信息
    maskKnexConfig(source);

    // 返回处理后的数据源
    return source;
  }

  // 更新数据源的 PATCH 请求处理器，支持 v1 和 v2 API 路径
  @Patch([
    '/api/v1/db/meta/projects/:baseId/bases/:sourceId',
    '/api/v2/meta/bases/:baseId/sources/:sourceId',
  ])
  // 应用 baseUpdate 访问控制
  @Acl('baseUpdate')
  async baseUpdate(
    // 获取租户上下文
    @TenantContext() context: NcContext,
    // 获取路径参数 sourceId
    @Param('sourceId') sourceId: string,
    // 获取路径参数 baseId
    @Param('baseId') baseId: string,
    // 获取请求体
    @Body() body: BaseReqType,
    // 获取请求对象
    @Req() req: NcRequest,
  ) {
    // 调用服务更新数据源
    const source = await this.sourcesService.baseUpdate(context, {
      sourceId,
      source: body,
      baseId,
      req,
    });

    // 清除配置信息
    source.config = undefined;
    // 清除集成配置信息
    source.integration_config = undefined;

    // 返回更新后的数据源
    return source;
  }

  // 获取数据源列表的 GET 请求处理器，支持 v1 和 v2 API 路径
  @Get([
    '/api/v1/db/meta/projects/:baseId/bases',
    '/api/v2/meta/bases/:baseId/sources',
  ])
  // 应用 baseList 访问控制
  @Acl('baseList')
  async baseList(
    // 获取租户上下文
    @TenantContext() context: NcContext,
    // 获取路径参数 baseId
    @Param('baseId') baseId: string,
  ) {
    // 调用服务获取数据源列表
    const sources = await this.sourcesService.baseList(context, {
      baseId,
    });

    // 遍历所有数据源，清除敏感配置信息
    for (const source of sources) {
      source.config = undefined;
      source.integration_config = undefined;
    }

    // 返回分页响应，包含数据源列表和分页信息
    return new PagedResponseImpl(sources, {
      count: sources.length,
      limit: sources.length,
    });
  }
}
