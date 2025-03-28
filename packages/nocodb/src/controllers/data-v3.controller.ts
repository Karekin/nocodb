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
// 导入 NocoDB SDK 的 API 版本枚举
import { NcApiVersion } from 'nocodb-sdk';
// 导入访问控制中间件
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
// 导入时间解析工具函数
import { parseHrtimeToMilliSeconds } from '~/helpers';
// 导入数据 API 限制守卫
import { DataApiLimiterGuard } from '~/guards/data-api-limiter.guard';
// 导入全局守卫
import { GlobalGuard } from '~/guards/global/global.guard';
// 导入租户上下文装饰器
import { TenantContext } from '~/decorators/tenant-context.decorator';
// 导入 NocoDB 上下文和请求接口
import { NcContext, NcRequest } from '~/interface/config';
// 导入数据服务
import { DataV3Service } from '~/services/v3/data-v3.service';
import { DataTableService } from '~/services/data-table.service';
// 导入分页响应实现类
import {
  PagedResponseImpl,
  PagedResponseV3Impl,
} from '~/helpers/PagedResponse';

// 声明控制器
@Controller()
// 使用数据 API 限制守卫和全局守卫
@UseGuards(DataApiLimiterGuard, GlobalGuard)
export class Datav3Controller {
  // 构造函数，注入所需服务
  constructor(
    protected readonly dataV3Service: DataV3Service,
    protected readonly dataTableService: DataTableService,
  ) {}

  // 获取记录列表的接口
  @Get('/api/v3/tables/:modelId/records')
  // 使用数据列表访问控制
  @Acl('dataList')
  async dataList(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Res() res: Response,
    @Param('modelId') modelId: string,
    @Query('view_id') viewId: string,
  ) {
    // 记录开始时间
    const startTime = process.hrtime();
    // 调用服务获取数据列表
    const responseData = await this.dataV3Service.dataList(context, {
      query: req.query,
      modelId: modelId,
      viewId: viewId,
      req,
    });
    // 计算响应时间
    const elapsedSeconds = parseHrtimeToMilliSeconds(process.hrtime(startTime));
    // 设置响应头部，包含数据库响应时间
    res.setHeader('xc-db-response', elapsedSeconds);
    // 返回响应数据
    res.json(responseData);
  }

  // 插入记录的接口
  @Post(['/api/v3/tables/:modelId/records'])
  // 设置 HTTP 状态码为 200
  @HttpCode(200)
  // 使用数据插入访问控制
  @Acl('dataInsert')
  async dataInsert(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('modelId') modelId: string,
    @Query('view_id') viewId: string,
    @Body() body: any,
  ) {
    // 调用服务插入数据
    return await this.dataV3Service.dataInsert(context, {
      modelId: modelId,
      body: body,
      viewId,
      cookie: req,
    });
  }

  // 删除记录的接口
  @Delete(['/api/v3/tables/:modelId/records'])
  // 使用数据删除访问控制
  @Acl('dataDelete')
  async dataDelete(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('modelId') modelId: string,
    @Query('view_id') viewId: string,
  ) {
    // 调用服务删除数据
    return await this.dataV3Service.dataDelete(context, {
      modelId: modelId,
      cookie: req,
      viewId,
      body: req.body,
    });
  }

  // 更新记录的接口
  @Patch(['/api/v3/tables/:modelId/records'])
  // 使用数据更新访问控制
  @Acl('dataUpdate')
  async dataUpdate(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('modelId') modelId: string,
    @Query('view_id') viewId: string,
  ) {
    // 调用服务更新数据
    return await this.dataV3Service.dataUpdate(context, {
      modelId: modelId,
      body: req.body,
      cookie: req,
      viewId,
    });
  }

  // 获取嵌套数据列表的接口
  @Get(['/api/v3/tables/:modelId/links/:columnId/records/:rowId'])
  // 使用嵌套数据列表访问控制
  @Acl('nestedDataList')
  async nestedDataList(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('modelId') modelId: string,
    @Query('view_id') viewId: string,
    @Param('columnId') columnId: string,
    @Param('rowId') rowId: string,
  ) {
    // 调用服务获取嵌套数据列表
    const response = await this.dataTableService.nestedDataList(context, {
      modelId,
      rowId: rowId,
      query: req.query,
      viewId,
      columnId,
      apiVersion: NcApiVersion.V3,
    });

    // 如果响应不是分页响应实现，直接返回
    if (!(response instanceof PagedResponseImpl)) {
      return response;
    }

    // 返回 V3 版本的分页响应
    return new PagedResponseV3Impl(response as PagedResponseImpl<any>, {
      baseUrl: req.baseUrl,
      tableId: modelId,
    });
  }

  // 创建嵌套链接的接口
  @Post(['/api/v3/tables/:modelId/links/:columnId/records/:rowId'])
  // 使用嵌套数据链接访问控制
  @Acl('nestedDataLink')
  async nestedLink(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('modelId') modelId: string,
    @Query('view_id') viewId: string,
    @Param('columnId') columnId: string,
    @Param('rowId') rowId: string,
    @Body()
    refRowIds:
      | string
      | string[]
      | number
      | number[]
      | Record<string, any>
      | Record<string, any>[],
  ) {
    // 调用服务创建嵌套链接
    return await this.dataTableService.nestedLink(context, {
      modelId,
      rowId: rowId,
      query: req.query,
      viewId,
      columnId,
      refRowIds,
      cookie: req,
    });
  }

  // 删除嵌套链接的接口
  @Delete(['/api/v3/tables/:modelId/links/:columnId/records/:rowId'])
  // 使用嵌套数据取消链接访问控制
  @Acl('nestedDataUnlink')
  async nestedUnlink(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('modelId') modelId: string,
    @Query('view_id') viewId: string,
    @Param('columnId') columnId: string,
    @Param('rowId') rowId: string,
    @Body()
    refRowIds: string | string[] | number | number[] | Record<string, any>,
  ) {
    // 调用服务删除嵌套链接
    return await this.dataTableService.nestedUnlink(context, {
      modelId,
      rowId: rowId,
      query: req.query,
      viewId,
      columnId,
      refRowIds,
      cookie: req,
    });
  }

  // 读取单条记录的接口
  @Get(['/api/v3/tables/:modelId/records/:rowId'])
  // 使用数据读取访问控制
  @Acl('dataRead')
  async dataRead(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('modelId') modelId: string,
    @Query('view_id') viewId: string,
    @Param('rowId') rowId: string,
  ) {
    // 调用服务读取数据
    return await this.dataTableService.dataRead(context, {
      modelId,
      rowId: rowId,
      query: req.query,
      viewId,
      apiVersion: NcApiVersion.V3,
    });
  }

  // 获取记录数量的接口
  @Get(['/api/v3/tables/:modelId/records/count'])
  // 使用数据计数访问控制
  @Acl('dataCount')
  async dataCount(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Res() res: Response,
    @Param('modelId') modelId: string,
    @Query('view_id') viewId: string,
  ) {
    // 调用服务获取数据计数
    const countResult = await this.dataTableService.dataCount(context, {
      query: req.query,
      modelId,
      viewId,
      apiVersion: NcApiVersion.V3,
    });

    // 返回计数结果
    res.json(countResult);
  }
}
