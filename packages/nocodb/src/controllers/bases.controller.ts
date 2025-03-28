// 导入所需的 NestJS 装饰器和类型
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
// 导入用于检测是否在 Docker 环境中运行的工具
import isDocker from 'is-docker';
// 导入项目请求类型定义
import { ProjectReqType } from 'nocodb-sdk';
// 导入基础类型定义
import type { BaseType } from 'nocodb-sdk';
// 导入全局守卫
import { GlobalGuard } from '~/guards/global/global.guard';
// 导入分页响应实现类
import { PagedResponseImpl } from '~/helpers/PagedResponse';
// 导入 Noco 核心类
import Noco from '~/Noco';
// 导入包版本信息
import { packageVersion } from '~/utils/packageVersion';
// 导入基础服务
import { BasesService } from '~/services/bases.service';
// 导入访问控制中间件
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
// 导入过滤器模型
import { Filter } from '~/models';
// 导入元数据 API 限制守卫
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
// 导入租户上下文装饰器
import { TenantContext } from '~/decorators/tenant-context.decorator';
// 导入上下文和请求接口定义
import { NcContext, NcRequest } from '~/interface/config';

// 使用 API 限制守卫和全局守卫
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
// 声明控制器
@Controller()
export class BasesController {
  // 构造函数，注入基础服务
  constructor(protected readonly projectsService: BasesService) {}

  // 获取基础列表的接口
  @Acl('baseList', {
    scope: 'org',
  })
  // 定义 GET 请求路由
  @Get(['/api/v1/db/meta/projects/', '/api/v2/meta/bases/'])
  async list(
    @TenantContext() context: NcContext,
    @Query() queryParams: Record<string, any>,
    @Req() req: NcRequest,
  ) {
    // 调用服务获取基础列表
    const bases = await this.projectsService.baseList(context, {
      user: req.user,
      query: queryParams,
    });
    // 返回分页响应
    return new PagedResponseImpl(bases as BaseType[], {
      count: bases.length,
      limit: bases.length,
    });
  }

  // 获取基础信息的接口
  @Acl('baseInfoGet')
  // 定义 GET 请求路由
  @Get([
    '/api/v1/db/meta/projects/:baseId/info',
    '/api/v2/meta/bases/:baseId/info',
  ])
  async baseInfoGet() {
    // 返回系统和应用信息
    return {
      Node: process.version,
      Arch: process.arch,
      Platform: process.platform,
      Docker: isDocker(),
      RootDB: Noco.getConfig()?.meta?.db?.client,
      PackageVersion: packageVersion,
    };
  }

  // 获取单个基础详情的接口
  @Acl('baseGet')
  // 定义 GET 请求路由
  @Get(['/api/v1/db/meta/projects/:baseId', '/api/v2/meta/bases/:baseId'])
  async baseGet(
    @TenantContext() context: NcContext,
    @Param('baseId') baseId: string,
  ) {
    // 获取项目信息
    const base = await this.projectsService.getProjectWithInfo(context, {
      baseId: baseId,
      includeConfig: false,
    });

    // 清理项目数据
    this.projectsService.sanitizeProject(base);

    return base;
  }

  // 更新基础信息的接口
  @Acl('baseUpdate')
  // 定义 PATCH 请求路由
  @Patch(['/api/v1/db/meta/projects/:baseId', '/api/v2/meta/bases/:baseId'])
  async baseUpdate(
    @TenantContext() context: NcContext,
    @Param('baseId') baseId: string,
    @Body() body: Record<string, any>,
    @Req() req: NcRequest,
  ) {
    // 更新基础信息
    const base = await this.projectsService.baseUpdate(context, {
      baseId,
      base: body,
      user: req.user,
      req,
    });

    return base;
  }

  // 删除基础的接口
  @Acl('baseDelete')
  // 定义 DELETE 请求路由
  @Delete(['/api/v1/db/meta/projects/:baseId', '/api/v2/meta/bases/:baseId'])
  async baseDelete(
    @TenantContext() context: NcContext,
    @Param('baseId') baseId: string,
    @Req() req: NcRequest,
  ) {
    // 软删除基础
    const deleted = await this.projectsService.baseSoftDelete(context, {
      baseId,
      user: req.user,
      req,
    });

    return deleted;
  }

  // 创建基础的接口
  @Acl('baseCreate', {
    scope: 'org',
  })
  // 定义 POST 请求路由
  @Post(['/api/v1/db/meta/projects', '/api/v2/meta/bases'])
  // 设置响应状态码为 200
  @HttpCode(200)
  async baseCreate(
    @TenantContext() context: NcContext,
    @Body() baseBody: ProjectReqType,
    @Req() req: NcRequest,
  ) {
    // 创建新的基础
    const base = await this.projectsService.baseCreate({
      base: baseBody,
      req,
      user: req['user'],
    });

    return base;
  }

  // 检查是否存在空或空值过滤器的接口
  @Acl('hasEmptyOrNullFilters')
  // 定义 GET 请求路由
  @Get([
    '/api/v1/db/meta/projects/:baseId/has-empty-or-null-filters',
    '/api/v2/meta/bases/:baseId/has-empty-or-null-filters',
  ])
  async hasEmptyOrNullFilters(
    @TenantContext() context: NcContext,
    @Param('baseId') baseId: string,
  ) {
    // 检查是否存在空或空值过滤器
    return await Filter.hasEmptyOrNullFilters(context, baseId);
  }
}
