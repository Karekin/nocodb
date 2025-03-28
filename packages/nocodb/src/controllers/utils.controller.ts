// 导入文件系统模块，用于读取文件
import fs from 'fs';
// 导入 util 模块中的 promisify 函数，用于将回调函数转换为 Promise
import { promisify } from 'util';
// 导入 NestJS 相关装饰器和类型
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Request,
  UseGuards,
} from '@nestjs/common';
// 从 nocodb-sdk 导入项目角色和 SSL 属性验证函数
import { ProjectRoles, validateAndExtractSSLProp } from 'nocodb-sdk';
// 从 nocodb-sdk 导入错误报告请求类型、测试数据库名称获取函数、集成类型和组织用户角色
import {
  ErrorReportReqType,
  getTestDatabaseName,
  IntegrationsType,
  OrgUserRoles,
} from 'nocodb-sdk';
// 导入全局守卫
import { GlobalGuard } from '~/guards/global/global.guard';
// 导入工具服务
import { UtilsService } from '~/services/utils.service';
// 导入访问控制中间件
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
// 导入元数据 API 限制器守卫
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
// 导入公共 API 限制器守卫
import { PublicApiLimiterGuard } from '~/guards/public-api-limiter.guard';
// 导入遥测服务
import { TelemetryService } from '~/services/telemetry.service';
// 导入 NcRequest 接口
import { NcRequest } from '~/interface/config';
// 导入集成模型
import { Integration } from '~/models';
// 导入元数据表和根作用域常量
import { MetaTable, RootScopes } from '~/utils/globals';
// 导入错误处理工具
import { NcError } from '~/helpers/catchError';
// 导入深度合并函数和企业版标志
import { deepMerge, isEE } from '~/utils';
// 导入 Noco 主类
import Noco from '~/Noco';

// 定义控制器
@Controller()
export class UtilsController {
  // 版本信息私有属性
  private version: string;

  // 构造函数，注入工具服务和遥测服务
  constructor(
    protected readonly utilsService: UtilsService,
    protected readonly telemetryService: TelemetryService,
  ) {}

  // 获取版本信息的 API 端点，使用公共 API 限制器守卫
  @UseGuards(PublicApiLimiterGuard)
  @Get('/api/v1/version')
  async getVersion() {
    // 如果不是云环境，则返回工具服务提供的版本信息
    if (process.env.NC_CLOUD !== 'true') {
      return this.utilsService.versionInfo();
    }

    // 如果是云环境且版本信息未缓存，则尝试从文件读取
    if (!this.version) {
      try {
        // 从 public/nc.txt 文件读取版本信息
        this.version = await promisify(fs.readFile)('./public/nc.txt', 'utf-8');
      } catch {
        // 如果读取失败，设置为不可用
        this.version = 'Not available';
      }
    }
    // 返回版本信息
    return this.version;
  }

  // 测试数据库连接的 API 端点，使用元数据 API 限制器和全局守卫
  @UseGuards(MetaApiLimiterGuard, GlobalGuard)
  @Post(['/api/v1/db/meta/connection/test', '/api/v2/meta/connection/test'])
  // 使用访问控制中间件，设置作用域为组织
  @Acl('testConnection', {
    scope: 'org',
  })
  // 设置 HTTP 状态码为 200
  @HttpCode(200)
  async testConnection(@Body() body: any, @Req() req: NcRequest) {
    // 设置连接池配置
    body.pool = {
      min: 0,
      max: 1,
    };

    // 创建配置对象的副本
    let config = { ...body };

    // 如果请求体中包含集成 ID
    if (body.fk_integration_id) {
      // 获取集成信息
      const integration = await Integration.get(
        {
          workspace_id: RootScopes.BYPASS,
        },
        body.fk_integration_id,
      );

      // 如果集成不存在或类型不是数据库，抛出错误
      if (!integration || integration.type !== IntegrationsType.Database) {
        NcError.integrationNotFound(body.fk_integration_id);
      }

      // 如果集成是私有的且不是当前用户创建的，抛出权限错误
      if (integration.is_private && integration.created_by !== req.user.id) {
        NcError.forbidden('You do not have access to this integration');
      }

      // 如果用户不是创建者角色
      if (!req.user.roles[OrgUserRoles.CREATOR]) {
        // 检查用户是否在工作区的任何基础中拥有所有者/创建者角色
        const baseWithPermission = await Noco.ncMeta
          .knex(MetaTable.PROJECT_USERS)
          .innerJoin(
            MetaTable.PROJECT,
            `${MetaTable.PROJECT}.id`,
            `${MetaTable.PROJECT_USERS}.base_id`,
          )
          .where(`${MetaTable.PROJECT_USERS}.fk_user_id`, req.user.id)
          .where((qb) => {
            qb.where(
              `${MetaTable.PROJECT_USERS}.roles`,
              ProjectRoles.OWNER,
            ).orWhere(`${MetaTable.PROJECT_USERS}.roles`, ProjectRoles.CREATOR);
          })
          .first();

        // 如果没有找到具有权限的基础，抛出权限错误
        if (!baseWithPermission)
          NcError.forbidden('You do not have access to this integration');
      }

      // 获取集成配置
      config = await integration.getConfig();
      // 深度合并配置和请求体
      deepMerge(config, body);

      // 如果配置中包含数据库连接信息，设置为测试数据库名称
      if (config?.connection?.database) {
        config.connection.database = getTestDatabaseName(config);
      }
    }

    // 如果配置中包含 SSL 连接信息，验证并提取 SSL 属性
    if (config.connection?.ssl) {
      config.connection.ssl = validateAndExtractSSLProp(
        config.connection,
        config.sslUse,
        config.client,
      );
    }

    // 调用工具服务测试连接并返回结果
    return await this.utilsService.testConnection({ body: config });
  }

  // 获取应用信息的 API 端点，使用公共 API 限制器守卫
  @UseGuards(PublicApiLimiterGuard)
  @Get([
    '/api/v1/db/meta/nocodb/info',
    '/api/v2/meta/nocodb/info',
    '/api/v1/meta/nocodb/info',
  ])
  async appInfo(@Req() req: NcRequest) {
    // 调用工具服务获取应用信息并返回结果
    return await this.utilsService.appInfo({
      req: {
        ncSiteUrl: (req as any).ncSiteUrl,
      },
    });
  }

  // 获取应用健康状态的 API 端点
  @Get('/api/v1/health')
  async appHealth() {
    // 调用工具服务获取应用健康状态并返回结果
    return await this.utilsService.appHealth();
  }

  // 发起 Axios 请求的 API 端点，使用公共 API 限制器守卫
  @UseGuards(PublicApiLimiterGuard)
  @Post(['/api/v1/db/meta/axiosRequestMake', '/api/v2/meta/axiosRequestMake'])
  // 设置 HTTP 状态码为 200
  @HttpCode(200)
  async axiosRequestMake(@Body() body: any) {
    // 调用工具服务发起 Axios 请求并返回结果
    return await this.utilsService.axiosRequestMake({ body });
  }

  // 将 URL 转换为数据库配置的 API 端点，使用公共 API 限制器守卫
  @UseGuards(PublicApiLimiterGuard)
  @Post('/api/v1/url_to_config')
  // 设置 HTTP 状态码为 200
  @HttpCode(200)
  async urlToDbConfig(@Body() body: any) {
    // 调用工具服务将 URL 转换为数据库配置并返回结果
    return await this.utilsService.urlToDbConfig({
      body,
    });
  }

  // 获取聚合元数据信息的 API 端点，使用公共 API 限制器守卫
  @UseGuards(PublicApiLimiterGuard)
  @Get('/api/v1/aggregated-meta-info')
  async aggregatedMetaInfo() {
    // todo: refactor
    // 调用工具服务获取聚合元数据信息并返回结果
    return (await this.utilsService.aggregatedMetaInfo()) as any;
  }

  // 获取信息流的 API 端点，使用公共 API 限制器守卫
  @UseGuards(PublicApiLimiterGuard)
  @Get('/api/v2/feed')
  async feed(@Request() req: NcRequest) {
    // 调用工具服务获取信息流并返回结果
    return await this.utilsService.feed(req);
  }

  // 报告错误的 API 端点，使用公共 API 限制器守卫
  @UseGuards(PublicApiLimiterGuard)
  @Post('/api/v1/error-reporting')
  async reportErrors(@Req() req: NcRequest, @Body() body: ErrorReportReqType) {
    // 如果禁用错误报告、是企业版或已配置 Sentry DSN，则返回空对象
    if (
      `${process.env.NC_DISABLE_ERR_REPORTS}` === 'true' ||
      isEE ||
      process.env.NC_SENTRY_DSN
    ) {
      return {};
    }

    // 调用工具服务报告错误并返回结果
    return (await this.utilsService.reportErrors({
      req,
      body,
    })) as any;
  }
}
