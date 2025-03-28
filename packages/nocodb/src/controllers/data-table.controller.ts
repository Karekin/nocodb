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
// 导入访问控制中间件
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
// 导入数据表服务
import { DataTableService } from '~/services/data-table.service';
// 导入时间解析工具函数
import { parseHrtimeToMilliSeconds } from '~/helpers';
// 导入数据 API 限制守卫
import { DataApiLimiterGuard } from '~/guards/data-api-limiter.guard';
// 导入全局守卫
import { GlobalGuard } from '~/guards/global/global.guard';
// 导入租户上下文装饰器
import { TenantContext } from '~/decorators/tenant-context.decorator';
// 导入自定义上下文和请求接口
import { NcContext, NcRequest } from '~/interface/config';

// 声明控制器
@Controller()
// 使用数据 API 限制守卫和全局守卫
@UseGuards(DataApiLimiterGuard, GlobalGuard)
export class DataTableController {
  // 构造函数，注入数据表服务
  constructor(protected readonly dataTableService: DataTableService) {}

  // 获取数据列表的接口
  @Get('/api/v2/tables/:modelId/records')
  // 使用数据列表访问控制
  @Acl('dataList')
  async dataList(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Res() res: Response,
    @Param('modelId') modelId: string,
    @Query('viewId') viewId: string,
    @Query('includeSortAndFilterColumns')
    includeSortAndFilterColumns: string,
  ) {
    // 记录开始时间
    const startTime = process.hrtime();
    // 调用服务获取数据列表
    const responseData = await this.dataTableService.dataList(context, {
      query: req.query,
      modelId: modelId,
      viewId: viewId,
      includeSortAndFilterColumns: includeSortAndFilterColumns === 'true',
    });
    // 计算响应时间
    const elapsedSeconds = parseHrtimeToMilliSeconds(process.hrtime(startTime));
    // 设置响应头部，包含数据库响应时间
    res.setHeader('xc-db-response', elapsedSeconds);
    // 返回数据
    res.json(responseData);
  }

  // 获取数据计数的接口
  @Get(['/api/v2/tables/:modelId/records/count'])
  // 使用数据计数访问控制
  @Acl('dataCount')
  async dataCount(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Res() res: Response,
    @Param('modelId') modelId: string,
    @Query('viewId') viewId: string,
  ) {
    // 调用服务获取数据计数
    const countResult = await this.dataTableService.dataCount(context, {
      query: req.query,
      modelId,
      viewId,
    });
    // 返回计数结果
    res.json(countResult);
  }

  // 插入数据的接口
  @Post(['/api/v2/tables/:modelId/records'])
  // 设置 HTTP 状态码为 200
  @HttpCode(200)
  // 使用数据插入访问控制
  @Acl('dataInsert')
  async dataInsert(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('modelId') modelId: string,
    @Query('viewId') viewId: string,
    @Body() body: any,
    @Query('undo') undo: any,
  ) {
    // 调用服务插入数据
    return await this.dataTableService.dataInsert(context, {
      modelId: modelId,
      body: body,
      viewId,
      cookie: req,
      undo: undo === 'true',
    });
  }

  // 更新数据的接口
  @Patch(['/api/v2/tables/:modelId/records'])
  // 使用数据更新访问控制
  @Acl('dataUpdate')
  async dataUpdate(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('modelId') modelId: string,
    @Query('viewId') viewId: string,
    @Param('rowId') _rowId: string,
  ) {
    // 调用服务更新数据
    return await this.dataTableService.dataUpdate(context, {
      modelId: modelId,
      body: req.body,
      cookie: req,
      viewId,
    });
  }

  // 删除数据的接口
  @Delete(['/api/v2/tables/:modelId/records'])
  // 使用数据删除访问控制
  @Acl('dataDelete')
  async dataDelete(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('modelId') modelId: string,
    @Query('viewId') viewId: string,
    @Param('rowId') _rowId: string,
  ) {
    // 调用服务删除数据
    return await this.dataTableService.dataDelete(context, {
      modelId: modelId,
      cookie: req,
      viewId,
      body: req.body,
    });
  }

  // 获取聚合数据的接口
  @Get(['/api/v2/tables/:modelId/aggregate'])
  // 使用数据聚合访问控制
  @Acl('dataAggregate')
  async dataAggregate(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('modelId') modelId: string,
    @Query('viewId') viewId: string,
  ) {
    // 调用服务获取聚合数据
    return await this.dataTableService.dataAggregate(context, {
      query: req.query,
      modelId,
      viewId,
    });
  }

  // 批量分组数据的接口
  @Post(['/api/v2/tables/:modelId/bulk/group'])
  // 使用数据分组访问控制
  @Acl('dataGroupBy')
  async bulkGroupBy(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('modelId') modelId: string,
    @Query('viewId') viewId: string,
  ) {
    // 调用服务进行批量分组
    return await this.dataTableService.bulkGroupBy(context, {
      query: req.query,
      modelId,
      viewId,
      body: req.body,
    });
  }

  // 批量获取数据列表的接口
  @Post(['/api/v2/tables/:modelId/bulk/datalist'])
  // 使用数据列表访问控制
  @Acl('dataList')
  async bulkDataList(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('modelId') modelId: string,
    @Query('viewId') viewId: string,
  ) {
    // 调用服务批量获取数据列表
    return await this.dataTableService.bulkDataList(context, {
      query: req.query,
      modelId,
      viewId,
      body: req.body,
    });
  }

  // 读取单条数据记录的接口
  @Get(['/api/v2/tables/:modelId/records/:rowId'])
  // 使用数据读取访问控制
  @Acl('dataRead')
  async dataRead(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('modelId') modelId: string,
    @Query('viewId') viewId: string,
    @Param('rowId') rowId: string,
  ) {
    // 调用服务读取单条数据
    return await this.dataTableService.dataRead(context, {
      modelId,
      rowId: rowId,
      query: req.query,
      viewId,
    });
  }

  // 移动数据行的接口
  @Post(['/api/v2/tables/:modelId/records/:rowId/move'])
  // 使用数据更新访问控制
  @Acl('dataUpdate')
  async rowMove(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('modelId') modelId: string,
    @Param('rowId') rowId: string,
    @Query('before') before: string,
  ) {
    // 调用服务移动数据行
    return await this.dataTableService.dataMove(context, {
      modelId: modelId,
      rowId: rowId,
      beforeRowId: before,
      cookie: req,
    });
  }

  // 获取嵌套数据列表的接口
  @Get(['/api/v2/tables/:modelId/links/:columnId/records/:rowId'])
  // 使用嵌套数据列表访问控制
  @Acl('nestedDataList')
  async nestedDataList(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('modelId') modelId: string,
    @Query('viewId') viewId: string,
    @Param('columnId') columnId: string,
    @Param('rowId') rowId: string,
  ) {
    // 调用服务获取嵌套数据列表
    return await this.dataTableService.nestedDataList(context, {
      modelId,
      rowId: rowId,
      query: req.query,
      viewId,
      columnId,
    });
  }

  // 创建嵌套数据链接的接口
  @Post(['/api/v2/tables/:modelId/links/:columnId/records/:rowId'])
  // 使用嵌套数据链接访问控制
  @Acl('nestedDataLink')
  async nestedLink(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('modelId') modelId: string,
    @Query('viewId') viewId: string,
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
    // 调用服务创建嵌套数据链接
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

  // 解除嵌套数据链接的接口
  @Delete(['/api/v2/tables/:modelId/links/:columnId/records/:rowId'])
  // 使用嵌套数据解除链接访问控制
  @Acl('nestedDataUnlink')
  async nestedUnlink(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('modelId') modelId: string,
    @Query('viewId') viewId: string,
    @Param('columnId') columnId: string,
    @Param('rowId') rowId: string,
    @Body()
    refRowIds: string | string[] | number | number[] | Record<string, any>,
  ) {
    // 调用服务解除嵌套数据链接
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

  // 嵌套数据列表复制粘贴或批量删除的接口
  @Post(['/api/v2/tables/:modelId/links/:columnId/records'])
  // 使用嵌套数据列表复制粘贴或删除访问控制
  @Acl('nestedDataListCopyPasteOrDeleteAll')
  async nestedListCopyPasteOrDeleteAll(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('modelId') modelId: string,
    @Query('viewId') viewId: string,
    @Param('columnId') columnId: string,
    @Body()
    data: {
      operation: 'copy' | 'paste';
      rowId: string;
      columnId: string;
      fk_related_model_id: string;
    }[],
  ) {
    // 调用服务处理嵌套数据列表的复制粘贴或批量删除操作
    return await this.dataTableService.nestedListCopyPasteOrDeleteAll(context, {
      modelId,
      query: req.query,
      viewId,
      columnId,
      data,
      cookie: req,
    });
  }
}
