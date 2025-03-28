// 导入所需的 NestJS 装饰器和类型
import {
  Body,
  Controller,
  Delete,
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
// 导入批量数据别名服务
import { BulkDataAliasService } from '~/services/bulk-data-alias.service';
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
export class BulkDataAliasController {
  // 构造函数，注入批量数据别名服务
  constructor(protected bulkDataAliasService: BulkDataAliasService) {}

  // 批量插入数据的路由
  @Post(['/api/v1/db/data/bulk/:orgs/:baseName/:tableName'])
  // 设置响应状态码为 200
  @HttpCode(200)
  // 设置访问控制权限
  @Acl('bulkDataInsert')
  async bulkDataInsert(
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
    // 获取请求体
    @Body() body: any,
    // 获取撤销操作查询参数
    @Query('undo') undo: string,
  ) {
    // 调用服务执行批量插入操作
    const exists = await this.bulkDataAliasService.bulkDataInsert(context, {
      body: body,
      cookie: req,
      baseName: baseName,
      tableName: tableName,
      undo: undo === 'true',
    });

    // 设置操作 ID 头部并返回结果
    res.header('nc-operation-id', req.ncParentAuditId).json(exists);
  }

  // 批量更新数据的路由
  @Patch(['/api/v1/db/data/bulk/:orgs/:baseName/:tableName'])
  // 设置访问控制权限
  @Acl('bulkDataUpdate')
  async bulkDataUpdate(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('baseName') baseName: string,
    @Param('tableName') tableName: string,
    @Body() body: any,
  ) {
    // 调用服务执行批量更新操作
    return await this.bulkDataAliasService.bulkDataUpdate(context, {
      body: body,
      cookie: req,
      baseName: baseName,
      tableName: tableName,
    });
  }

  // 批量更新所有数据的路由
  @Patch(['/api/v1/db/data/bulk/:orgs/:baseName/:tableName/all'])
  // 设置访问控制权限
  @Acl('bulkDataUpdateAll')
  async bulkDataUpdateAll(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('baseName') baseName: string,
    @Param('tableName') tableName: string,
    @Body() body: any,
  ) {
    // 调用服务执行批量更新所有操作
    return await this.bulkDataAliasService.bulkDataUpdateAll(context, {
      body: body,
      cookie: req,
      baseName: baseName,
      tableName: tableName,
      query: req.query,
    });
  }

  // 批量删除数据的路由
  @Delete(['/api/v1/db/data/bulk/:orgs/:baseName/:tableName'])
  // 设置访问控制权限
  @Acl('bulkDataDelete')
  async bulkDataDelete(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('baseName') baseName: string,
    @Param('tableName') tableName: string,
    @Body() body: any,
  ) {
    // 调用服务执行批量删除操作
    return await this.bulkDataAliasService.bulkDataDelete(context, {
      body: body,
      cookie: req,
      baseName: baseName,
      tableName: tableName,
    });
  }

  // 批量删除所有数据的路由
  @Delete(['/api/v1/db/data/bulk/:orgs/:baseName/:tableName/all'])
  // 设置访问控制权限
  @Acl('bulkDataDeleteAll')
  async bulkDataDeleteAll(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('baseName') baseName: string,
    @Param('tableName') tableName: string,
  ) {
    // 调用服务执行批量删除所有操作
    return await this.bulkDataAliasService.bulkDataDeleteAll(context, {
      baseName: baseName,
      tableName: tableName,
      query: req.query,
      viewName: req.query.viewId,
      req,
    });
  }

  // 批量更新插入（upsert）数据的路由
  @Post(['/api/v1/db/data/bulk/:orgs/:baseName/:tableName/upsert'])
  // 设置访问控制权限
  @Acl('bulkDataUpsert')
  async bulkDataUpsert(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('baseName') baseName: string,
    @Param('tableName') tableName: string,
    @Body() body: any,
    @Query('undo') undo: string,
  ) {
    // 调用服务执行批量更新插入操作
    return await this.bulkDataAliasService.bulkDataUpsert(context, {
      body: body,
      cookie: req,
      baseName: baseName,
      tableName: tableName,
      undo: undo === 'true',
    });
  }
}
