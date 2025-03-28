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
// 导入视图创建请求类型
import { ViewCreateReqType } from 'nocodb-sdk';
// 导入全局守卫
import { GlobalGuard } from '~/guards/global/global.guard';
// 导入日历服务
import { CalendarsService } from '~/services/calendars.service';
// 导入元数据 API 限制守卫
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
// 导入访问控制装饰器
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
// 导入租户上下文装饰器
import { TenantContext } from '~/decorators/tenant-context.decorator';
// 导入上下文和请求接口类型
import { NcContext, NcRequest } from '~/interface/config';

// 声明这是一个控制器类
@Controller()
// 使用元数据 API 限制守卫和全局守卫
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class CalendarsController {
  // 构造函数，注入日历服务
  constructor(private readonly calendarsService: CalendarsService) {}

  // 获取日历视图的 GET 请求处理方法，支持 v1 和 v2 两个版本的 API
  @Get([
    '/api/v1/db/meta/calendars/:calendarViewId',
    '/api/v2/meta/calendars/:calendarViewId',
  ])
  // 应用访问控制，检查 calendarViewGet 权限
  @Acl('calendarViewGet')
  async calendarViewGet(
    // 注入租户上下文
    @TenantContext() context: NcContext,
    // 获取路径参数 calendarViewId
    @Param('calendarViewId') calendarViewId: string,
  ) {
    // 调用服务层方法获取日历视图数据
    return await this.calendarsService.calendarViewGet(context, {
      calendarViewId,
    });
  }

  // 创建日历视图的 POST 请求处理方法，支持 v1 和 v2 两个版本的 API
  @Post([
    '/api/v1/db/meta/tables/:tableId/calendars',
    '/api/v2/meta/tables/:tableId/calendars',
  ])
  // 设置响应状态码为 200
  @HttpCode(200)
  // 应用访问控制，检查 calendarViewCreate 权限
  @Acl('calendarViewCreate')
  async calendarViewCreate(
    // 注入租户上下文
    @TenantContext() context: NcContext,
    // 获取路径参数 tableId
    @Param('tableId') tableId: string,
    // 获取请求体数据
    @Body() body: ViewCreateReqType,
    // 获取请求对象
    @Req() req: NcRequest,
  ) {
    // 调用服务层方法创建日历视图
    return await this.calendarsService.calendarViewCreate(context, {
      tableId,
      calendar: body,
      user: req.user,
      req,
    });
  }

  // 更新日历视图的 PATCH 请求处理方法，支持 v1 和 v2 两个版本的 API
  @Patch([
    '/api/v1/db/meta/calendars/:calendarViewId',
    '/api/v2/meta/calendars/:calendarViewId',
  ])
  // 应用访问控制，检查 calendarViewUpdate 权限
  @Acl('calendarViewUpdate')
  async calendarViewUpdate(
    // 注入租户上下文
    @TenantContext() context: NcContext,
    // 获取路径参数 calendarViewId
    @Param('calendarViewId') calendarViewId: string,
    // 获取请求体数据
    @Body() body,
    // 获取请求对象
    @Req() req: NcRequest,
  ) {
    // 调用服务层方法更新日历视图
    return await this.calendarsService.calendarViewUpdate(context, {
      calendarViewId,
      calendar: body,
      req,
    });
  }
}
