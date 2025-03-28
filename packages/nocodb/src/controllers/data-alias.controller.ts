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
  Res,
  UseGuards,
} from '@nestjs/common';
// 导入 Express 的 Response 类型
import { Response } from 'express';
// 导入全局守卫
import { GlobalGuard } from '~/guards/global/global.guard';
// 导入时间解析工具函数
import { parseHrtimeToMilliSeconds } from '~/helpers';
// 导入访问控制中间件
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
// 导入数据服务
import { DatasService } from '~/services/datas.service';
// 导入数据 API 限制守卫
import { DataApiLimiterGuard } from '~/guards/data-api-limiter.guard';
// 导入租户上下文装饰器
import { TenantContext } from '~/decorators/tenant-context.decorator';
// 导入自定义上下文和请求接口
import { NcContext, NcRequest } from '~/interface/config';

// 声明控制器
@Controller()
// 使用数据 API 限制守卫和全局守卫
@UseGuards(DataApiLimiterGuard, GlobalGuard)
export class DataAliasController {
  // 构造函数，注入数据服务
  constructor(private readonly datasService: DatasService) {}

  // 获取数据列表的接口
  @Get([
    '/api/v1/db/data/:orgs/:baseName/:tableName',
    '/api/v1/db/data/:orgs/:baseName/:tableName/views/:viewName',
  ])
  // 使用访问控制装饰器
  @Acl('dataList')
  async dataList(
    // 获取租户上下文
    @TenantContext() context: NcContext,
    // 获取请求对象
    @Req() req: NcRequest,
    // 获取响应对象
    @Res() res: Response,
    // 获取基础名称参数
    @Param('baseName') baseName: string,
    // 获取表名参数
    @Param('tableName') tableName: string,
    // 获取视图名参数
    @Param('viewName') viewName: string,
    // 获取优化选项查询参数
    @Query('opt') opt: string,
    // 获取是否显示隐藏列查询参数
    @Query('getHiddenColumns') getHiddenColumns: string,
    // 获取是否包含排序和过滤列查询参数
    @Query('includeSortAndFilterColumns')
    includeSortAndFilterColumns: string,
  ) {
    // 记录开始时间
    const startTime = process.hrtime();
    // 调用数据服务获取数据列表
    const responseData = await this.datasService.dataList(context, {
      query: req.query,
      baseName: baseName,
      tableName: tableName,
      viewName: viewName,
      disableOptimization: opt === 'false',
      getHiddenColumns: getHiddenColumns === 'true',
      includeSortAndFilterColumns: includeSortAndFilterColumns === 'true',
    });
    // 计算执行时间
    const elapsedMilliSeconds = parseHrtimeToMilliSeconds(
      process.hrtime(startTime),
    );
    // 设置响应头部，包含数据库响应时间
    res.setHeader('xc-db-response', elapsedMilliSeconds);
    // 如果存在统计信息，添加 API 处理时间
    if (responseData['stats']) {
      responseData['stats'].apiHandlingTime = elapsedMilliSeconds;
    }
    // 返回 JSON 响应
    res.json(responseData);
  }

  // 查找单条数据的接口
  @Get([
    '/api/v1/db/data/:orgs/:baseName/:tableName/find-one',
    '/api/v1/db/data/:orgs/:baseName/:tableName/views/:viewName/find-one',
  ])
  @Acl('dataFindOne')
  async dataFindOne(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('baseName') baseName: string,
    @Param('tableName') tableName: string,
    @Param('viewName') viewName: string,
  ) {
    // 调用数据服务查找单条数据
    return await this.datasService.dataFindOne(context, {
      query: req.query,
      baseName: baseName,
      tableName: tableName,
      viewName: viewName,
    });
  }

  // 数据分组接口
  @Get([
    '/api/v1/db/data/:orgs/:baseName/:tableName/groupby',
    '/api/v1/db/data/:orgs/:baseName/:tableName/views/:viewName/groupby',
  ])
  @Acl('dataGroupBy')
  async dataGroupBy(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('baseName') baseName: string,
    @Param('tableName') tableName: string,
    @Param('viewName') viewName: string,
  ) {
    // 调用数据服务执行分组操作
    return await this.datasService.dataGroupBy(context, {
      query: req.query,
      baseName: baseName,
      tableName: tableName,
      viewName: viewName,
    });
  }

  // 获取数据计数的接口
  @Get([
    '/api/v1/db/data/:orgs/:baseName/:tableName/count',
    '/api/v1/db/data/:orgs/:baseName/:tableName/views/:viewName/count',
  ])
  @Acl('dataCount')
  async dataCount(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Res() res: Response,
    @Param('baseName') baseName: string,
    @Param('tableName') tableName: string,
    @Param('viewName') viewName: string,
  ) {
    // 调用数据服务获取计数结果
    const countResult = await this.datasService.dataCount(context, {
      query: req.query,
      baseName: baseName,
      tableName: tableName,
      viewName: viewName,
    });
    // 返回计数结果
    res.json(countResult);
  }

  // 插入数据的接口
  @Post([
    '/api/v1/db/data/:orgs/:baseName/:tableName',
    '/api/v1/db/data/:orgs/:baseName/:tableName/views/:viewName',
  ])
  // 设置 HTTP 状态码为 200
  @HttpCode(200)
  @Acl('dataInsert')
  async dataInsert(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('baseName') baseName: string,
    @Param('tableName') tableName: string,
    @Param('viewName') viewName: string,
    // 获取请求体数据
    @Body() body: any,
    @Query('opt') opt: string,
    @Query('before') before: string,
    @Query('undo') undo: string,
  ) {
    // 调用数据服务插入数据
    return await this.datasService.dataInsert(context, {
      baseName: baseName,
      tableName: tableName,
      viewName: viewName,
      body: body,
      cookie: req,
      disableOptimization: opt === 'false',
      query: {
        before,
        undo: undo === 'true',
      },
    });
  }

  // 更新数据的接口
  @Patch([
    '/api/v1/db/data/:orgs/:baseName/:tableName/:rowId',
    '/api/v1/db/data/:orgs/:baseName/:tableName/views/:viewName/:rowId',
  ])
  @Acl('dataUpdate')
  async dataUpdate(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('baseName') baseName: string,
    @Param('tableName') tableName: string,
    @Param('viewName') viewName: string,
    @Param('rowId') rowId: string,
    @Query('opt') opt: string,
  ) {
    // 调用数据服务更新数据
    return await this.datasService.dataUpdate(context, {
      baseName: baseName,
      tableName: tableName,
      viewName: viewName,
      body: req.body,
      cookie: req,
      rowId: rowId,
      disableOptimization: opt === 'false',
    });
  }

  // 删除数据的接口
  @Delete([
    '/api/v1/db/data/:orgs/:baseName/:tableName/:rowId',
    '/api/v1/db/data/:orgs/:baseName/:tableName/views/:viewName/:rowId',
  ])
  @Acl('dataDelete')
  async dataDelete(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('baseName') baseName: string,
    @Param('tableName') tableName: string,
    @Param('viewName') viewName: string,
    @Param('rowId') rowId: string,
  ) {
    // 调用数据服务删除数据
    return await this.datasService.dataDelete(context, {
      baseName: baseName,
      tableName: tableName,
      viewName: viewName,
      cookie: req,
      rowId: rowId,
    });
  }

  // 读取单条数据的接口
  @Get([
    '/api/v1/db/data/:orgs/:baseName/:tableName/:rowId',
    '/api/v1/db/data/:orgs/:baseName/:tableName/views/:viewName/:rowId',
  ])
  @Acl('dataRead')
  async dataRead(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('baseName') baseName: string,
    @Param('tableName') tableName: string,
    @Param('viewName') viewName: string,
    @Param('rowId') rowId: string,
    @Query('opt') opt: string,
    @Query('getHiddenColumn') getHiddenColumn: string,
  ) {
    // 调用数据服务读取数据
    return await this.datasService.dataRead(context, {
      baseName: baseName,
      tableName: tableName,
      viewName: viewName,
      rowId: rowId,
      query: req.query,
      disableOptimization: opt === 'false',
      getHiddenColumn: getHiddenColumn === 'true',
    });
  }

  // 检查数据是否存在的接口
  @Get([
    '/api/v1/db/data/:orgs/:baseName/:tableName/:rowId/exist',
    '/api/v1/db/data/:orgs/:baseName/:tableName/views/:viewName/:rowId/exist',
  ])
  @Acl('dataExist')
  async dataExist(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Res() res: Response,
    @Param('baseName') baseName: string,
    @Param('tableName') tableName: string,
    @Param('viewName') viewName: string,
    @Param('rowId') rowId: string,
  ) {
    // 调用数据服务检查数据是否存在
    const exists = await this.datasService.dataExist(context, {
      baseName: baseName,
      tableName: tableName,
      viewName: viewName,
      rowId: rowId,
      query: req.query,
    });
    // 返回存在性检查结果
    res.json(exists);
  }

  // 获取分组数据列表的接口
  @Get([
    '/api/v1/db/data/:orgs/:baseName/:tableName/group/:columnId',
    '/api/v1/db/data/:orgs/:baseName/:tableName/views/:viewName/group/:columnId',
  ])
  @Acl('groupedDataList')
  async groupedDataList(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Res() res: Response,
    @Param('baseName') baseName: string,
    @Param('tableName') tableName: string,
    @Param('viewName') viewName: string,
    @Param('columnId') columnId: string,
  ) {
    // 记录开始时间
    const startTime = process.hrtime();
    // 调用数据服务获取分组数据
    const groupedData = await this.datasService.groupedDataList(context, {
      baseName: baseName,
      tableName: tableName,
      viewName: viewName,
      query: req.query,
      columnId: columnId,
    });
    // 计算执行时间
    const elapsedSeconds = parseHrtimeToMilliSeconds(process.hrtime(startTime));
    // 设置响应头部，包含数据库响应时间
    res.setHeader('xc-db-response', elapsedSeconds);
    // 返回分组数据
    res.json(groupedData);
  }
}
