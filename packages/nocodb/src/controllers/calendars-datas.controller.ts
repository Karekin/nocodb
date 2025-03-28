// 导入所需的 NestJS 装饰器和类型
import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
// 导入 Express 的 Response 类型
import { Response } from 'express';
// 导入全局守卫
import { GlobalGuard } from '~/guards/global/global.guard';
// 导入数据 API 限制器守卫
import { DataApiLimiterGuard } from '~/guards/data-api-limiter.guard';
// 导入日历数据服务
import { CalendarDatasService } from '~/services/calendar-datas.service';
// 导入高精度时间转换为毫秒的工具函数
import { parseHrtimeToMilliSeconds } from '~/helpers';

// 导入访问控制列表中间件
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
// 导入租户上下文装饰器
import { TenantContext } from '~/decorators/tenant-context.decorator';
// 导入自定义上下文和请求接口
import { NcContext, NcRequest } from '~/interface/config';

// 声明这是一个控制器类
@Controller()
// 使用数据 API 限制器守卫和全局守卫
@UseGuards(DataApiLimiterGuard, GlobalGuard)
export class CalendarDatasController {
  // 构造函数，注入日历数据服务
  constructor(private readonly calendarDatasService: CalendarDatasService) {}

  // 获取日历数据列表的路由
  @Get(['/api/v1/db/calendar-data/:orgs/:baseName/:tableName/views/:viewName'])
  // 使用数据列表访问控制
  @Acl('dataList')
  async dataList(
    // 获取租户上下文
    @TenantContext() context: NcContext,
    // 获取请求对象
    @Req() req: NcRequest,
    // 获取视图 ID 参数
    @Param('viewName') viewId: string,
    // 获取开始日期查询参数
    @Query('from_date') fromDate: string,
    // 获取结束日期查询参数
    @Query('to_date') toDate: string,
  ) {
    // 返回日历数据列表
    return await this.calendarDatasService.getCalendarDataList(context, {
      viewId: viewId,
      query: req.query,
      from_date: fromDate,
      to_date: toDate,
    });
  }

  // 获取日历数据计数的路由
  @Get([
    '/api/v1/db/calendar-data/:orgs/:baseName/:tableName/views/:viewName/countByDate/',
  ])
  // 使用数据列表访问控制
  @Acl('dataList')
  async calendarDataCount(
    // 获取租户上下文
    @TenantContext() context: NcContext,
    // 获取请求对象
    @Req() req: NcRequest,
    // 获取响应对象
    @Res() res: Response,
    // 获取数据库名称参数
    @Param('baseName') baseName: string,
    // 获取表名参数
    @Param('tableName') tableName: string,
    // 获取视图名称参数
    @Param('viewName') viewName: string,
    // 获取开始日期查询参数
    @Query('from_date') fromDate: string,
    // 获取结束日期查询参数
    @Query('to_date') toDate: string,
  ) {
    // 记录开始时间
    const startTime = process.hrtime();

    // 获取日历记录计数
    const data = await this.calendarDatasService.getCalendarRecordCount(
      context,
      {
        query: req.query,
        viewId: viewName,
        from_date: fromDate,
        to_date: toDate,
      },
    );

    // 计算响应时间
    const elapsedSeconds = parseHrtimeToMilliSeconds(process.hrtime(startTime));
    // 设置响应头部，包含数据库响应时间
    res.setHeader('xc-db-response', elapsedSeconds);
    // 返回数据
    res.json(data);
  }

  // 获取公共日历视图按日期计数的路由（支持 v1 和 v2 API）
  @Get([
    '/api/v1/db/public/calendar-view/:sharedViewUuid/countByDate',
    '/api/v2/public/calendar-view/:sharedViewUuid/countByDate',
  ])
  async countByDate(
    // 获取租户上下文
    @TenantContext() context: NcContext,
    // 获取请求对象
    @Req() req: NcRequest,
    // 获取共享视图 UUID 参数
    @Param('sharedViewUuid') sharedViewUuid: string,
    // 获取开始日期查询参数
    @Query('from_date') fromDate: string,
    // 获取结束日期查询参数
    @Query('to_date') toDate: string,
  ) {
    // 返回公共日历记录计数
    return await this.calendarDatasService.getPublicCalendarRecordCount(
      context,
      {
        query: req.query,
        password: req.headers?.['xc-password'] as string,
        sharedViewUuid,
        from_date: fromDate,
        to_date: toDate,
      },
    );
  }

  // 获取公共日历数据列表的路由（支持 v1 和 v2 API）
  @Get([
    '/api/v1/db/public/calendar-view/:sharedViewUuid',
    '/api/v2/public/calendar-view/:sharedViewUuid',
  ])
  async getPublicCalendarDataList(
    // 获取租户上下文
    @TenantContext() context: NcContext,
    // 获取请求对象
    @Req() req: NcRequest,
    // 获取共享视图 UUID 参数
    @Param('sharedViewUuid') sharedViewUuid: string,
    // 获取开始日期查询参数
    @Query('from_date') fromDate: string,
    // 获取结束日期查询参数
    @Query('to_date') toDate: string,
  ) {
    // 返回公共日历数据列表
    return await this.calendarDatasService.getPublicCalendarDataList(context, {
      query: req.query,
      password: req.headers?.['xc-password'] as string,
      sharedViewUuid,
      from_date: fromDate,
      to_date: toDate,
    });
  }
}
