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
// 导入数据服务
import { DatasService } from '~/services/datas.service';
// 导入访问控制中间件
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
// 导入数据 API 限制器守卫
import { DataApiLimiterGuard } from '~/guards/data-api-limiter.guard';
// 导入租户上下文装饰器
import { TenantContext } from '~/decorators/tenant-context.decorator';
// 导入自定义上下文和请求接口
import { NcContext, NcRequest } from '~/interface/config';

// 声明控制器
@Controller()
// 使用数据 API 限制器和全局守卫
@UseGuards(DataApiLimiterGuard, GlobalGuard)
export class DatasController {
  // 构造函数，注入数据服务
  constructor(private readonly datasService: DatasService) {}

  // 获取视图数据列表的端点
  @Get('/data/:viewId/')
  // 访问控制：数据列表权限
  @Acl('dataList')
  async dataList(
    // 注入租户上下文
    @TenantContext() context: NcContext,
    // 注入请求对象
    @Req() req: NcRequest,
    // 注入视图 ID 参数
    @Param('viewId') viewId: string,
  ) {
    return await this.datasService.dataListByViewId(context, {
      viewId: viewId,
      query: req.query,
    });
  }

  // 获取多对多关系列表的端点
  @Get('/data/:viewId/:rowId/mm/:colId')
  // 访问控制：多对多列表权限
  @Acl('mmList')
  async mmList(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('viewId') viewId: string,
    @Param('colId') colId: string,
    @Param('rowId') rowId: string,
  ) {
    return await this.datasService.mmList(context, {
      viewId: viewId,
      colId: colId,
      rowId: rowId,
      query: req.query,
    });
  }

  // 获取多对多关系排除列表的端点
  @Get('/data/:viewId/:rowId/mm/:colId/exclude')
  // 访问控制：多对多排除列表权限
  @Acl('mmExcludedList')
  async mmExcludedList(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('viewId') viewId: string,
    @Param('colId') colId: string,
    @Param('rowId') rowId: string,
  ) {
    return await this.datasService.mmExcludedList(context, {
      viewId: viewId,
      colId: colId,
      rowId: rowId,
      query: req.query,
    });
  }

  // 获取一对多关系排除列表的端点
  @Get('/data/:viewId/:rowId/hm/:colId/exclude')
  // 访问控制：一对多排除列表权限
  @Acl('hmExcludedList')
  async hmExcludedList(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('viewId') viewId: string,
    @Param('colId') colId: string,
    @Param('rowId') rowId: string,
  ) {
    await this.datasService.hmExcludedList(context, {
      viewId: viewId,
      colId: colId,
      rowId: rowId,
      query: req.query,
    });
  }

  // 获取属于关系排除列表的端点
  @Get('/data/:viewId/:rowId/bt/:colId/exclude')
  // 访问控制：属于关系排除列表权限
  @Acl('btExcludedList')
  async btExcludedList(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('viewId') viewId: string,
    @Param('colId') colId: string,
    @Param('rowId') rowId: string,
  ) {
    return await this.datasService.btExcludedList(context, {
      viewId: viewId,
      colId: colId,
      rowId: rowId,
      query: req.query,
    });
  }

  // 获取一对多关系列表的端点
  @Get('/data/:viewId/:rowId/hm/:colId')
  // 访问控制：一对多列表权限
  @Acl('hmList')
  async hmList(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('viewId') viewId: string,
    @Param('colId') colId: string,
    @Param('rowId') rowId: string,
  ) {
    return await this.datasService.hmList(context, {
      viewId: viewId,
      colId: colId,
      rowId: rowId,
      query: req.query,
    });
  }

  // 读取单条数据记录的端点
  @Get('/data/:viewId/:rowId')
  // 访问控制：数据读取权限
  @Acl('dataRead')
  async dataRead(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('viewId') viewId: string,
    @Param('rowId') rowId: string,
  ) {
    return await this.datasService.dataReadByViewId(context, {
      viewId,
      rowId,
      query: req.query,
    });
  }

  // 插入新数据记录的端点
  @Post('/data/:viewId/')
  // 设置 HTTP 状态码为 200
  @HttpCode(200)
  // 访问控制：数据插入权限
  @Acl('dataInsert')
  async dataInsert(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('viewId') viewId: string,
    @Body() body: any,
  ) {
    return await this.datasService.dataInsertByViewId(context, {
      viewId: viewId,
      body: body,
      cookie: req,
    });
  }

  // 更新数据记录的端点
  @Patch('/data/:viewId/:rowId')
  // 访问控制：数据更新权限
  @Acl('dataUpdate')
  async dataUpdate(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('viewId') viewId: string,
    @Param('rowId') rowId: string,
    @Body() body: any,
  ) {
    return await this.datasService.dataUpdateByViewId(context, {
      viewId: viewId,
      rowId: rowId,
      body: body,
      cookie: req,
    });
  }

  // 删除数据记录的端点
  @Delete('/data/:viewId/:rowId')
  // 访问控制：数据删除权限
  @Acl('dataDelete')
  async dataDelete(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('viewId') viewId: string,
    @Param('rowId') rowId: string,
  ) {
    return await this.datasService.dataDeleteByViewId(context, {
      viewId: viewId,
      rowId: rowId,
      cookie: req,
    });
  }

  // 删除关联数据的端点
  @Delete('/data/:viewId/:rowId/:relationType/:colId/:childId')
  // 访问控制：关联数据删除权限
  @Acl('relationDataDelete')
  async relationDataDelete(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('viewId') viewId: string,
    @Param('rowId') rowId: string,
    @Param('relationType') relationType: string,
    @Param('colId') colId: string,
    @Param('childId') childId: string,
  ) {
    await this.datasService.relationDataDelete(context, {
      viewId: viewId,
      colId: colId,
      childId: childId,
      rowId: rowId,
      cookie: req,
    });

    return { msg: 'The relation data has been deleted successfully' };
  }

  // 添加关联数据的端点
  @Post('/data/:viewId/:rowId/:relationType/:colId/:childId')
  // 设置 HTTP 状态码为 200
  @HttpCode(200)
  // 访问控制：关联数据添加权限
  @Acl('relationDataAdd')
  async relationDataAdd(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('viewId') viewId: string,
    @Param('rowId') rowId: string,
    @Param('relationType') relationType: string,
    @Param('colId') colId: string,
    @Param('childId') childId: string,
  ) {
    await this.datasService.relationDataAdd(context, {
      viewId: viewId,
      colId: colId,
      childId: childId,
      rowId: rowId,
      cookie: req,
    });

    return { msg: 'The relation data has been created successfully' };
  }
}
