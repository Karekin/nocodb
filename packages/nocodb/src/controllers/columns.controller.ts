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
// 导入列请求类型定义
import { ColumnReqType } from 'nocodb-sdk';
// 导入列模型类型
import type { Column } from '~/models';
// 导入全局守卫
import { GlobalGuard } from '~/guards/global/global.guard';
// 导入列服务
import { ColumnsService } from '~/services/columns.service';
// 导入访问控制中间件
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
// 导入 API 限流守卫
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
// 导入租户上下文装饰器
import { TenantContext } from '~/decorators/tenant-context.decorator';
// 导入上下文和请求接口定义
import { NcContext, NcRequest } from '~/interface/config';

// 声明这是一个控制器类
@Controller()
// 使用 API 限流守卫和全局守卫
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class ColumnsController {
  // 构造函数，注入列服务
  constructor(private readonly columnsService: ColumnsService) {}

  // 添加列的 POST 接口，支持 v1 和 v2 版本
  @Post([
    '/api/v1/db/meta/tables/:tableId/columns/',
    '/api/v2/meta/tables/:tableId/columns/',
  ])
  // 设置 HTTP 状态码为 200
  @HttpCode(200)
  // 设置访问控制权限
  @Acl('columnAdd')
  async columnAdd(
    // 获取租户上下文
    @TenantContext() context: NcContext,
    // 获取表 ID 参数
    @Param('tableId') tableId: string,
    // 获取请求体
    @Body() body: ColumnReqType,
    // 获取请求对象
    @Req() req: NcRequest,
  ) {
    return await this.columnsService.columnAdd(context, {
      tableId,
      column: body,
      req,
      user: req.user,
    });
  }

  // 更新列的 PATCH 接口，支持 v1 和 v2 版本
  @Patch([
    '/api/v1/db/meta/columns/:columnId',
    '/api/v2/meta/columns/:columnId',
  ])
  // 设置访问控制权限
  @Acl('columnUpdate')
  async columnUpdate(
    // 获取租户上下文
    @TenantContext() context: NcContext,
    // 获取列 ID 参数
    @Param('columnId') columnId: string,
    // 获取请求体
    @Body() body: ColumnReqType,
    // 获取请求对象
    @Req() req: NcRequest,
  ) {
    return await this.columnsService.columnUpdate(context, {
      columnId: columnId,
      column: body,
      req,
      user: req.user,
    });
  }

  // 删除列的 DELETE 接口，支持 v1 和 v2 版本
  @Delete([
    '/api/v1/db/meta/columns/:columnId',
    '/api/v2/meta/columns/:columnId',
  ])
  // 设置访问控制权限
  @Acl('columnDelete')
  async columnDelete(
    // 获取租户上下文
    @TenantContext() context: NcContext,
    // 获取列 ID 参数
    @Param('columnId') columnId: string,
    // 获取请求对象
    @Req() req: NcRequest,
  ) {
    return await this.columnsService.columnDelete(context, {
      columnId,
      req,
      user: req.user,
    });
  }

  // 获取列信息的 GET 接口，支持 v1 和 v2 版本
  @Get(['/api/v1/db/meta/columns/:columnId', '/api/v2/meta/columns/:columnId'])
  // 设置访问控制权限
  @Acl('columnGet')
  async columnGet(
    // 获取租户上下文
    @TenantContext() context: NcContext,
    // 获取列 ID 参数
    @Param('columnId') columnId: string,
  ) {
    return await this.columnsService.columnGet(context, { columnId });
  }

  // 设置列为主键的 POST 接口，支持 v1 和 v2 版本
  @Post([
    '/api/v1/db/meta/columns/:columnId/primary',
    '/api/v2/meta/columns/:columnId/primary',
  ])
  // 设置 HTTP 状态码为 200
  @HttpCode(200)
  // 设置访问控制权限
  @Acl('columnSetAsPrimary')
  async columnSetAsPrimary(
    // 获取租户上下文
    @TenantContext() context: NcContext,
    // 获取列 ID 参数
    @Param('columnId') columnId: string,
    // 获取请求对象
    @Req() req: NcRequest,
  ) {
    return await this.columnsService.columnSetAsPrimary(context, {
      columnId,
      req,
    });
  }

  // 获取列哈希值的 GET 接口，支持 v1 和 v2 版本
  @Get([
    '/api/v1/db/meta/tables/:tableId/columns/hash',
    '/api/v2/meta/tables/:tableId/columns/hash',
  ])
  // 设置访问控制权限
  @Acl('columnsHash')
  async columnsHash(
    // 获取租户上下文
    @TenantContext() context: NcContext,
    // 获取表 ID 参数
    @Param('tableId') tableId: string,
  ) {
    return await this.columnsService.columnsHash(context, tableId);
  }

  // 批量操作列的 POST 接口，支持 v1 和 v2 版本
  @Post([
    '/api/v1/db/meta/tables/:tableId/columns/bulk',
    '/api/v2/meta/tables/:tableId/columns/bulk',
  ])
  // 设置 HTTP 状态码为 200
  @HttpCode(200)
  // 设置访问控制权限
  @Acl('columnBulk')
  async columnBulk(
    // 获取租户上下文
    @TenantContext() context: NcContext,
    // 获取表 ID 参数
    @Param('tableId') tableId: string,
    // 获取请求体，包含哈希值和操作数组
    @Body()
    body: {
      hash: string;
      ops: {
        op: 'add' | 'update' | 'delete';
        column: Partial<Column>;
      }[];
    },
    // 获取请求对象
    @Req() req: NcRequest,
  ) {
    return await this.columnsService.columnBulk(context, tableId, body, req);
  }
}
