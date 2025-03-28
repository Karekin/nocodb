// 导入所需的 NestJS 装饰器和类型
import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
// 导入公共元数据服务
import { PublicMetasService } from '~/services/public-metas.service';
// 导入公共 API 限制器守卫
import { PublicApiLimiterGuard } from '~/guards/public-api-limiter.guard';
// 导入租户上下文装饰器
import { TenantContext } from '~/decorators/tenant-context.decorator';
// 导入 NcContext 和 NcRequest 接口
import { NcContext, NcRequest } from '~/interface/config';

// 使用 PublicApiLimiterGuard 守卫来限制公共 API 的访问频率
@UseGuards(PublicApiLimiterGuard)
// 定义控制器
@Controller()
// 导出公共元数据控制器类
export class PublicMetasController {
  // 构造函数，注入 PublicMetasService 服务
  constructor(private readonly publicMetasService: PublicMetasService) {}

  // 定义 GET 请求路由，支持两个版本的 API 路径
  @Get([
    '/api/v1/db/public/shared-view/:sharedViewUuid/meta',
    '/api/v2/public/shared-view/:sharedViewUuid/meta',
  ])
  // 获取共享视图元数据的方法
  async viewMetaGet(
    // 使用 TenantContext 装饰器获取上下文
    @TenantContext() context: NcContext,
    // 获取请求对象
    @Req() req: NcRequest,
    // 获取路由参数中的共享视图 UUID
    @Param('sharedViewUuid') sharedViewUuid: string,
  ) {
    // 调用服务方法获取视图元数据
    return await this.publicMetasService.viewMetaGet(context, {
      // 从请求头中获取密码
      password: req.headers?.['xc-password'] as string,
      // 传递共享视图 UUID
      sharedViewUuid: sharedViewUuid,
    });
  }

  // 定义 GET 请求路由，支持两个版本的 API 路径
  @Get([
    '/api/v1/db/public/shared-base/:sharedBaseUuid/meta',
    '/api/v2/public/shared-base/:sharedBaseUuid/meta',
  ])
  // 获取公共共享基础元数据的方法
  async publicSharedBaseGet(
    // 使用 TenantContext 装饰器获取上下文
    @TenantContext() context: NcContext,
    // 获取路由参数中的共享基础 UUID
    @Param('sharedBaseUuid') sharedBaseUuid: string,
  ): Promise<any> {
    // 调用服务方法获取公共共享基础元数据
    return await this.publicMetasService.publicSharedBaseGet(context, {
      // 传递共享基础 UUID
      sharedBaseUuid,
    });
  }
}
