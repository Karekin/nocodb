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
// 导入同步服务
import { SyncService } from '~/services/sync.service';
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
// 使用 MetaApiLimiterGuard 和 GlobalGuard 守卫保护所有路由
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class SyncController {
  // 通过依赖注入构造函数，注入 SyncService
  constructor(private readonly syncService: SyncService) {}

  // 定义 GET 请求处理方法，用于获取同步源列表
  // 支持多个 API 路径，包括 v1 和 v2 版本
  @Get([
    '/api/v1/db/meta/projects/:baseId/syncs',
    '/api/v1/db/meta/projects/:baseId/syncs/:sourceId',
    '/api/v2/meta/bases/:baseId/syncs',
    '/api/v2/meta/bases/:baseId/syncs/:sourceId',
  ])
  // 应用 'syncSourceList' 访问控制
  @Acl('syncSourceList')
  // 定义异步方法处理同步源列表请求
  async syncSourceList(
    // 获取租户上下文
    @TenantContext() context: NcContext,
    // 获取路径参数 baseId
    @Param('baseId') baseId: string,
    // 获取可选的路径参数 sourceId
    @Param('sourceId') sourceId?: string,
  ) {
    // 调用同步服务的 syncSourceList 方法并返回结果
    return await this.syncService.syncSourceList(context, {
      baseId,
      sourceId,
    });
  }

  // 定义 POST 请求处理方法，用于创建同步源
  // 支持多个 API 路径，包括 v1 和 v2 版本
  @Post([
    '/api/v1/db/meta/projects/:baseId/syncs',
    '/api/v1/db/meta/projects/:baseId/syncs/:sourceId',
    '/api/v2/meta/bases/:baseId/syncs',
    '/api/v2/meta/bases/:baseId/syncs/:sourceId',
  ])
  // 设置 HTTP 状态码为 200
  @HttpCode(200)
  // 应用 'syncSourceCreate' 访问控制
  @Acl('syncSourceCreate')
  // 定义异步方法处理同步源创建请求
  async syncCreate(
    // 获取租户上下文
    @TenantContext() context: NcContext,
    // 获取路径参数 baseId
    @Param('baseId') baseId: string,
    // 获取请求体
    @Body() body: any,
    // 获取请求对象
    @Req() req: NcRequest,
    // 获取可选的路径参数 sourceId
    @Param('sourceId') sourceId?: string,
  ) {
    // 调用同步服务的 syncCreate 方法并返回结果
    return await this.syncService.syncCreate(context, {
      baseId: baseId,
      sourceId: sourceId,
      userId: (req as any).user.id,
      syncPayload: body,
      req,
    });
  }

  // 定义 DELETE 请求处理方法，用于删除同步源
  // 支持 v1 和 v2 版本的 API 路径
  @Delete(['/api/v1/db/meta/syncs/:syncId', '/api/v2/meta/syncs/:syncId'])
  // 应用 'syncSourceDelete' 访问控制
  @Acl('syncSourceDelete')
  // 定义异步方法处理同步源删除请求
  async syncDelete(
    // 获取租户上下文
    @TenantContext() context: NcContext,
    // 获取路径参数 syncId
    @Param('syncId') syncId: string,
    // 获取请求对象
    @Req() req: NcRequest,
  ) {
    // 调用同步服务的 syncDelete 方法并返回结果
    return await this.syncService.syncDelete(context, {
      syncId: syncId,
      req,
    });
  }

  // 定义 PATCH 请求处理方法，用于更新同步源
  // 支持 v1 和 v2 版本的 API 路径
  @Patch(['/api/v1/db/meta/syncs/:syncId', '/api/v2/meta/syncs/:syncId'])
  // 应用 'syncSourceUpdate' 访问控制
  @Acl('syncSourceUpdate')
  // 定义异步方法处理同步源更新请求
  async syncUpdate(
    // 获取租户上下文
    @TenantContext() context: NcContext,
    // 获取路径参数 syncId
    @Param('syncId') syncId: string,
    // 获取请求体
    @Body() body: any,
    // 获取请求对象
    @Req() req: NcRequest,
  ) {
    // 调用同步服务的 syncUpdate 方法并返回结果
    return await this.syncService.syncUpdate(context, {
      syncId: syncId,
      syncPayload: body,
      req,
    });
  }
}
