// 导入所需的 NestJS 装饰器和类型
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
// 导入看板视图创建请求类型
import { ViewCreateReqType } from 'nocodb-sdk';
// 导入全局守卫
import { GlobalGuard } from '~/guards/global/global.guard';
// 导入看板服务
import { KanbansService } from '~/services/kanbans.service';
// 导入访问控制中间件
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
// 导入元数据 API 限制守卫
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
// 导入租户上下文装饰器
import { TenantContext } from '~/decorators/tenant-context.decorator';
// 导入上下文和请求接口类型
import { NcContext, NcRequest } from '~/interface/config';

// 声明这是一个控制器类
@Controller()
// 使用元数据 API 限制守卫和全局守卫
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class KanbansController {
  // 构造函数，注入看板服务
  constructor(private readonly kanbansService: KanbansService) {}

  // 获取看板视图的 GET 请求处理方法，支持 v1 和 v2 API
  @Get([
    '/api/v1/db/meta/kanbans/:kanbanViewId',
    '/api/v2/meta/kanbans/:kanbanViewId',
  ])
  // 应用访问控制，检查 kanbanViewGet 权限
  @Acl('kanbanViewGet')
  async kanbanViewGet(
    // 注入租户上下文
    @TenantContext() context: NcContext,
    // 获取路由参数中的看板视图 ID
    @Param('kanbanViewId') kanbanViewId: string,
  ) {
    // 调用服务方法获取看板视图数据
    return await this.kanbansService.kanbanViewGet(context, {
      kanbanViewId,
    });
  }

  // 创建看板视图的 POST 请求处理方法，支持 v1 和 v2 API
  @Post([
    '/api/v1/db/meta/tables/:tableId/kanbans',
    '/api/v2/meta/tables/:tableId/kanbans',
  ])
  // 设置响应状态码为 200
  @HttpCode(200)
  // 应用访问控制，检查 kanbanViewCreate 权限
  @Acl('kanbanViewCreate')
  async kanbanViewCreate(
    // 注入租户上下文
    @TenantContext() context: NcContext,
    // 获取路由参数中的表 ID
    @Param('tableId') tableId: string,
    // 获取请求体数据
    @Body() body: ViewCreateReqType,
    // 注入请求对象
    @Req() req: NcRequest,
  ) {
    // 调用服务方法创建看板视图
    return await this.kanbansService.kanbanViewCreate(context, {
      tableId,
      kanban: body,
      user: req.user,
      req,
    });
  }

  // 更新看板视图的 PATCH 请求处理方法，支持 v1 和 v2 API
  @Patch([
    '/api/v1/db/meta/kanbans/:kanbanViewId',
    '/api/v2/meta/kanbans/:kanbanViewId',
  ])
  // 应用访问控制，检查 kanbanViewUpdate 权限
  @Acl('kanbanViewUpdate')
  async kanbanViewUpdate(
    // 注入租户上下文
    @TenantContext() context: NcContext,
    // 获取路由参数中的看板视图 ID
    @Param('kanbanViewId') kanbanViewId: string,
    // 获取请求体数据
    @Body() body,
    // 注入请求对象
    @Req() req: NcRequest,
  ) {
    // 调用服务方法更新看板视图
    return await this.kanbansService.kanbanViewUpdate(context, {
      kanbanViewId,
      kanban: body,
      req,
    });
  }
}
