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
  Req,
  UseGuards,
} from '@nestjs/common';
// 导入全局守卫
import { GlobalGuard } from '~/guards/global/global.guard';
// 导入共享基地服务
import { SharedBasesService } from '~/services/shared-bases.service';
// 导入访问控制列表中间件
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
// 导入元数据 API 限制器守卫
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
// 导入租户上下文装饰器
import { TenantContext } from '~/decorators/tenant-context.decorator';
// 导入 NcContext 和 NcRequest 接口
import { NcContext, NcRequest } from '~/interface/config';

// 定义控制器
@Controller()
// 使用 MetaApiLimiterGuard 和 GlobalGuard 守卫
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class SharedBasesController {
  // 构造函数，注入 SharedBasesService
  constructor(private readonly sharedBasesService: SharedBasesService) {}

  // 创建共享基地链接的 POST 请求处理方法
  // 支持两个 API 路径
  @Post([
    '/api/v1/db/meta/projects/:baseId/shared',
    '/api/v2/meta/bases/:baseId/shared',
  ])
  // 设置 HTTP 状态码为 200
  @HttpCode(200)
  // 设置访问控制权限
  @Acl('createSharedBaseLink')
  async createSharedBaseLink(
    // 获取租户上下文
    @TenantContext() context: NcContext,
    // 获取请求对象
    @Req() req: NcRequest,
    // 获取请求体
    @Body() body: any,
    // 获取路径参数 baseId
    @Param('baseId') baseId: string,
  ): Promise<any> {
    // 调用服务创建共享基地链接
    const sharedBase = await this.sharedBasesService.createSharedBaseLink(
      context,
      {
        baseId: baseId,
        roles: body?.roles,
        password: body?.password,
        siteUrl: req.ncSiteUrl,
        req,
      },
    );

    // 返回创建的共享基地
    return sharedBase;
  }

  // 更新共享基地链接的 PATCH 请求处理方法
  // 支持两个 API 路径
  @Patch([
    '/api/v1/db/meta/projects/:baseId/shared',
    '/api/v2/meta/bases/:baseId/shared',
  ])
  // 设置访问控制权限
  @Acl('updateSharedBaseLink')
  async updateSharedBaseLink(
    // 获取租户上下文
    @TenantContext() context: NcContext,
    // 获取请求对象
    @Req() req: NcRequest,
    // 获取请求体
    @Body() body: any,
    // 获取路径参数 baseId
    @Param('baseId') baseId: string,
  ): Promise<any> {
    // 调用服务更新共享基地链接
    const sharedBase = await this.sharedBasesService.updateSharedBaseLink(
      context,
      {
        baseId: baseId,
        roles: body?.roles,
        password: body?.password,
        siteUrl: req.ncSiteUrl,
        req,
        custom_url_path: body.custom_url_path,
      },
    );

    // 返回更新后的共享基地
    return sharedBase;
  }

  // 禁用共享基地链接的 DELETE 请求处理方法
  // 支持两个 API 路径
  @Delete([
    '/api/v1/db/meta/projects/:baseId/shared',
    '/api/v2/meta/bases/:baseId/shared',
  ])
  // 设置访问控制权限
  @Acl('disableSharedBaseLink')
  async disableSharedBaseLink(
    // 获取租户上下文
    @TenantContext() context: NcContext,
    // 获取路径参数 baseId
    @Param('baseId') baseId: string,
    // 获取请求对象
    @Req() req: NcRequest,
  ): Promise<any> {
    // 调用服务禁用共享基地链接
    const sharedBase = await this.sharedBasesService.disableSharedBaseLink(
      context,
      {
        baseId,
        req,
      },
    );

    // 返回禁用后的共享基地
    return sharedBase;
  }

  // 获取共享基地链接的 GET 请求处理方法
  // 支持两个 API 路径
  @Get([
    '/api/v1/db/meta/projects/:baseId/shared',
    '/api/v2/meta/bases/:baseId/shared',
  ])
  // 设置访问控制权限
  @Acl('getSharedBaseLink')
  async getSharedBaseLink(
    // 获取租户上下文
    @TenantContext() context: NcContext,
    // 获取请求对象
    @Req() req: NcRequest,
    // 获取路径参数 baseId
    @Param('baseId') baseId: string,
  ): Promise<any> {
    // 调用服务获取共享基地链接
    const sharedBase = await this.sharedBasesService.getSharedBaseLink(
      context,
      {
        baseId: baseId,
        siteUrl: req.ncSiteUrl,
      },
    );

    // 返回获取的共享基地
    return sharedBase;
  }
}
