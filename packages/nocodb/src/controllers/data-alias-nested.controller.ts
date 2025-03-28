// 导入所需的 NestJS 装饰器和类型
import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
// 导入数据别名嵌套服务
import { DataAliasNestedService } from '~/services/data-alias-nested.service';
// 导入全局守卫
import { GlobalGuard } from '~/guards/global/global.guard';
// 导入访问控制中间件
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
// 导入数据 API 限制器守卫
import { DataApiLimiterGuard } from '~/guards/data-api-limiter.guard';
// 导入租户上下文装饰器
import { TenantContext } from '~/decorators/tenant-context.decorator';
// 导入上下文和请求接口类型
import { NcContext, NcRequest } from '~/interface/config';

// 声明控制器
@Controller()
// 使用数据 API 限制器和全局守卫
@UseGuards(DataApiLimiterGuard, GlobalGuard)
export class DataAliasNestedController {
  // 构造函数，注入数据别名嵌套服务
  constructor(private dataAliasNestedService: DataAliasNestedService) {}

  // 获取多对多关系列表的接口
  @Get(['/api/v1/db/data/:orgs/:baseName/:tableName/:rowId/mm/:columnName'])
  // 使用访问控制装饰器
  @Acl('mmList')
  async mmList(
    // 获取租户上下文
    @TenantContext() context: NcContext,
    // 获取请求对象
    @Req() req: NcRequest,
    // 获取列名参数
    @Param('columnName') columnName: string,
    // 获取行 ID 参数
    @Param('rowId') rowId: string,
    // 获取数据库名参数
    @Param('baseName') baseName: string,
    // 获取表名参数
    @Param('tableName') tableName: string,
  ) {
    // 调用服务方法并返回结果
    return await this.dataAliasNestedService.mmList(context, {
      query: req.query,
      columnName: columnName,
      rowId: rowId,
      baseName: baseName,
      tableName: tableName,
    });
  }

  // 获取多对多关系排除列表的接口
  @Get([
    '/api/v1/db/data/:orgs/:baseName/:tableName/:rowId/mm/:columnName/exclude',
  ])
  // 使用访问控制装饰器
  @Acl('mmExcludedList')
  async mmExcludedList(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('columnName') columnName: string,
    @Param('rowId') rowId: string,
    @Param('baseName') baseName: string,
    @Param('tableName') tableName: string,
  ) {
    // 调用服务方法并返回结果
    return await this.dataAliasNestedService.mmExcludedList(context, {
      query: req.query,
      columnName: columnName,
      rowId: rowId,
      baseName: baseName,
      tableName: tableName,
    });
  }

  // 获取一对多关系排除列表的接口
  @Get([
    '/api/v1/db/data/:orgs/:baseName/:tableName/:rowId/hm/:columnName/exclude',
  ])
  // 使用访问控制装饰器
  @Acl('hmExcludedList')
  async hmExcludedList(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('columnName') columnName: string,
    @Param('rowId') rowId: string,
    @Param('baseName') baseName: string,
    @Param('tableName') tableName: string,
  ) {
    // 调用服务方法并返回结果
    return await this.dataAliasNestedService.hmExcludedList(context, {
      query: req.query,
      columnName: columnName,
      rowId: rowId,
      baseName: baseName,
      tableName: tableName,
    });
  }

  // 获取属于关系排除列表的接口
  @Get([
    '/api/v1/db/data/:orgs/:baseName/:tableName/:rowId/bt/:columnName/exclude',
  ])
  // 使用访问控制装饰器
  @Acl('btExcludedList')
  async btExcludedList(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('columnName') columnName: string,
    @Param('rowId') rowId: string,
    @Param('baseName') baseName: string,
    @Param('tableName') tableName: string,
  ) {
    // 调用服务方法并返回结果
    return await this.dataAliasNestedService.btExcludedList(context, {
      query: req.query,
      columnName: columnName,
      rowId: rowId,
      baseName: baseName,
      tableName: tableName,
    });
  }

  // 获取一对一关系排除列表的接口
  @Get([
    '/api/v1/db/data/:orgs/:baseName/:tableName/:rowId/oo/:columnName/exclude',
  ])
  // 使用访问控制装饰器
  @Acl('ooExcludedList')
  async ooExcludedList(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('columnName') columnName: string,
    @Param('rowId') rowId: string,
    @Param('baseName') baseName: string,
    @Param('tableName') tableName: string,
  ) {
    // 调用服务方法并返回结果
    return await this.dataAliasNestedService.ooExcludedList(context, {
      query: req.query,
      columnName: columnName,
      rowId: rowId,
      baseName: baseName,
      tableName: tableName,
    });
  }

  // 获取一对多关系列表的接口
  @Get(['/api/v1/db/data/:orgs/:baseName/:tableName/:rowId/hm/:columnName'])
  // 使用访问控制装饰器
  @Acl('hmList')
  async hmList(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('columnName') columnName: string,
    @Param('rowId') rowId: string,
    @Param('baseName') baseName: string,
    @Param('tableName') tableName: string,
  ) {
    // 调用服务方法并返回结果
    return await this.dataAliasNestedService.hmList(context, {
      query: req.query,
      columnName: columnName,
      rowId: rowId,
      baseName: baseName,
      tableName: tableName,
    });
  }

  // 删除关系数据的接口
  @Delete([
    '/api/v1/db/data/:orgs/:baseName/:tableName/:rowId/:relationType/:columnName/:refRowId',
  ])
  // 使用访问控制装饰器
  @Acl('relationDataRemove')
  async relationDataRemove(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('columnName') columnName: string,
    @Param('rowId') rowId: string,
    @Param('baseName') baseName: string,
    @Param('tableName') tableName: string,
    @Param('refRowId') refRowId: string,
  ) {
    // 调用服务方法删除关系数据
    await this.dataAliasNestedService.relationDataRemove(context, {
      columnName: columnName,
      rowId: rowId,
      baseName: baseName,
      tableName: tableName,
      cookie: req,
      refRowId: refRowId,
    });

    // 返回成功消息
    return { msg: 'The relation data has been deleted successfully' };
  }

  // 添加关系数据的接口
  @Post([
    '/api/v1/db/data/:orgs/:baseName/:tableName/:rowId/:relationType/:columnName/:refRowId',
  ])
  // 使用访问控制装饰器
  @Acl('relationDataAdd')
  // 设置 HTTP 状态码为 200
  @HttpCode(200)
  async relationDataAdd(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('columnName') columnName: string,
    @Param('rowId') rowId: string,
    @Param('baseName') baseName: string,
    @Param('tableName') tableName: string,
    @Param('refRowId') refRowId: string,
  ) {
    // 调用服务方法添加关系数据
    await this.dataAliasNestedService.relationDataAdd(context, {
      columnName: columnName,
      rowId: rowId,
      baseName: baseName,
      tableName: tableName,
      cookie: req,
      refRowId: refRowId,
    });

    // 返回成功消息
    return { msg: 'The relation data has been created successfully' };
  }
}
