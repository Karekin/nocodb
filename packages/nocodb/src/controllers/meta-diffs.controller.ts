// 导入所需的 NestJS 装饰器和类型
import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
// 导入全局守卫
import { GlobalGuard } from '~/guards/global/global.guard';
// 导入元数据差异服务
import { MetaDiffsService } from '~/services/meta-diffs.service';
// 导入访问控制中间件
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
// 导入 API 限流守卫
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
// 导入租户上下文装饰器
import { TenantContext } from '~/decorators/tenant-context.decorator';
// 导入自定义的上下文和请求接口类型
import { NcContext, NcRequest } from '~/interface/config';

// 声明这是一个控制器类
@Controller()
// 使用 API 限流守卫和全局守卫
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class MetaDiffsController {
  // 通过依赖注入注入 MetaDiffsService 服务
  constructor(private readonly metaDiffsService: MetaDiffsService) {}

  // 定义 GET 请求路由，支持 v1 和 v2 两个版本的 API
  @Get([
    '/api/v1/db/meta/projects/:baseId/meta-diff',
    '/api/v2/meta/bases/:baseId/meta-diff',
  ])
  // 添加访问控制，禁止 API 令牌访问
  @Acl('metaDiff', {
    blockApiTokenAccess: true,
  })
  // 获取元数据差异的方法
  async metaDiff(
    // 获取租户上下文
    @TenantContext() context: NcContext,
    // 获取路由参数 baseId
    @Param('baseId') baseId: string,
  ) {
    // 调用服务层方法获取元数据差异
    return await this.metaDiffsService.metaDiff(context, { baseId });
  }

  // 定义获取特定源的元数据差异的 GET 请求路由
  @Get([
    '/api/v1/db/meta/projects/:baseId/meta-diff/:sourceId',
    '/api/v2/meta/bases/:baseId/meta-diff/:sourceId',
  ])
  // 添加访问控制，禁止 API 令牌访问
  @Acl('metaDiff', {
    blockApiTokenAccess: true,
  })
  // 获取特定源的元数据差异的方法
  async baseMetaDiff(
    // 获取租户上下文
    @TenantContext() context: NcContext,
    // 获取路由参数 baseId
    @Param('baseId') baseId: string,
    // 获取路由参数 sourceId
    @Param('sourceId') sourceId: string,
    // 获取请求对象
    @Req() req: NcRequest,
  ) {
    // 调用服务层方法获取特定源的元数据差异
    return await this.metaDiffsService.baseMetaDiff(context, {
      sourceId,
      baseId,
      user: req.user,
    });
  }
}
