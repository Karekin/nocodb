// 导入所需的NestJS装饰器和类型
import {
  Body,
  Controller,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
// 导入SQL视图服务
import { SqlViewsService } from '~/services/sql-views.service';
// 导入全局守卫
import { GlobalGuard } from '~/guards/global/global.guard';
// 导入访问控制列表中间件
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
// 导入元API限制器守卫
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
// 导入租户上下文装饰器
import { TenantContext } from '~/decorators/tenant-context.decorator';
// 导入NocoDB上下文接口
import { NcContext } from '~/interface/config';

// 声明这是一个控制器类
@Controller()
// 使用元API限制器守卫和全局守卫来保护所有路由
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class SqlViewsController {
  // 通过依赖注入构造函数，注入SQL视图服务
  constructor(private readonly sqlViewsService: SqlViewsService) {}

  // 定义POST请求路由，支持v1和v2两个API版本
  @Post([
    '/api/v1/db/meta/projects/:baseId/bases/:sourceId/sqlView',
    '/api/v2/meta/bases/:baseId/sources/:sourceId/sqlView',
  ])
  // 应用访问控制列表中间件，检查用户是否有创建SQL视图的权限
  @Acl('sqlViewCreate')
  // 创建SQL视图的异步方法
  async sqlViewCreate(
    // 获取租户上下文
    @TenantContext() context: NcContext,
    // 获取URL参数中的baseId
    @Param('baseId') baseId: string,
    // 获取URL参数中的sourceId
    @Param('sourceId') sourceId: string,
    // 获取完整的请求对象
    @Request() req,
    // 获取请求体
    @Body() body,
  ) {
    // 调用SQL视图服务的创建方法，传入必要参数
    const table = await this.sqlViewsService.sqlViewCreate(context, {
      // 客户端IP地址
      clientIp: (req as any).clientIp,
      // 请求体数据
      body,
      // 基础ID
      baseId,
      // 源ID
      sourceId,
      // 用户信息
      user: (req as any).user,
    });
    // 返回创建的表对象
    return table;
  }
}
