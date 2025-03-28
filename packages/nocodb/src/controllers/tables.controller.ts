// 导入所需的 NestJS 装饰器和工具
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
  Request,
  UseGuards,
} from '@nestjs/common';
// 导入 nocodb-sdk 中的工具函数和类型
import { extractRolesObj, NcRequest, TableReqType } from 'nocodb-sdk';
// 导入全局守卫
import { GlobalGuard } from '~/guards/global/global.guard';
// 导入表格服务
import { TablesService } from '~/services/tables.service';
// 导入访问控制中间件
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
// 导入分页响应实现
import { PagedResponseImpl } from '~/helpers/PagedResponse';
// 导入元数据 API 限制器守卫
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
// 导入租户上下文装饰器
import { TenantContext } from '~/decorators/tenant-context.decorator';
// 导入 NcContext 接口
import { NcContext } from '~/interface/config';

// 定义控制器
@Controller()
// 使用 MetaApiLimiterGuard 和 GlobalGuard 守卫
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class TablesController {
  // 构造函数，注入 TablesService
  constructor(private readonly tablesService: TablesService) {}

  // 获取表格列表的 GET 请求处理器
  // 支持多个 API 路径
  @Get([
    '/api/v1/db/meta/projects/:baseId/tables',
    '/api/v1/db/meta/projects/:baseId/:sourceId/tables',
    '/api/v2/meta/bases/:baseId/tables',
    '/api/v2/meta/bases/:baseId/:sourceId/tables',
  ])
  // 应用 tableList 访问控制
  @Acl('tableList')
  async tableList(
    // 获取租户上下文
    @TenantContext() context: NcContext,
    // 获取基础 ID 参数
    @Param('baseId') baseId: string,
    // 获取源 ID 参数
    @Param('sourceId') sourceId: string,
    // 获取是否包含多对多关系的查询参数
    @Query('includeM2M') includeM2M: string,
    // 获取请求对象
    @Request() req,
  ) {
    // 返回分页响应，包含可访问的表格列表
    return new PagedResponseImpl(
      await this.tablesService.getAccessibleTables(context, {
        baseId,
        sourceId,
        includeM2M: includeM2M === 'true',
        roles: extractRolesObj(req.user.base_roles),
      }),
    );
  }

  // 创建表格的 POST 请求处理器
  // 支持多个 API 路径
  @Post([
    '/api/v1/db/meta/projects/:baseId/tables',
    '/api/v1/db/meta/projects/:baseId/:sourceId/tables',
    '/api/v2/meta/bases/:baseId/tables',
    '/api/v2/meta/bases/:baseId/:sourceId/tables',
  ])
  // 设置 HTTP 状态码为 200
  @HttpCode(200)
  // 应用 tableCreate 访问控制
  @Acl('tableCreate')
  async tableCreate(
    // 获取租户上下文
    @TenantContext() context: NcContext,
    // 获取基础 ID 参数
    @Param('baseId') baseId: string,
    // 获取源 ID 参数
    @Param('sourceId') sourceId: string,
    // 获取请求体
    @Body() body: TableReqType,
    // 获取请求对象
    @Request() req,
  ) {
    // 调用服务创建表格
    const result = await this.tablesService.tableCreate(context, {
      baseId: baseId,
      sourceId: sourceId,
      table: body,
      user: req.user,
      req,
    });

    // 返回创建结果
    return result;
  }

  // 获取单个表格的 GET 请求处理器
  @Get(['/api/v1/db/meta/tables/:tableId', '/api/v2/meta/tables/:tableId'])
  // 应用 tableGet 访问控制
  @Acl('tableGet')
  async tableGet(
    // 获取租户上下文
    @TenantContext() context: NcContext,
    // 获取表格 ID 参数
    @Param('tableId') tableId: string,
    // 获取请求对象
    @Request() req,
  ) {
    // 获取表格及其可访问的视图
    const table = await this.tablesService.getTableWithAccessibleViews(
      context,
      {
        tableId: req.params.tableId,
        user: req.user,
      },
    );

    // 返回表格数据
    return table;
  }

  // 更新表格的 PATCH 请求处理器
  @Patch(['/api/v1/db/meta/tables/:tableId', '/api/v2/meta/tables/:tableId'])
  // 应用 tableUpdate 访问控制
  @Acl('tableUpdate')
  async tableUpdate(
    // 获取租户上下文
    @TenantContext() context: NcContext,
    // 获取表格 ID 参数
    @Param('tableId') tableId: string,
    // 获取请求体
    @Body() body: TableReqType,
    // 获取请求对象
    @Request() req,
  ) {
    // 调用服务更新表格
    await this.tablesService.tableUpdate(context, {
      tableId: tableId,
      table: body,
      baseId: req.ncBaseId,
      user: req.ncBaseId,
      req,
    });
    // 返回成功消息
    return { msg: 'The table has been updated successfully' };
  }

  // 删除表格的 DELETE 请求处理器
  @Delete(['/api/v1/db/meta/tables/:tableId', '/api/v2/meta/tables/:tableId'])
  // 应用 tableDelete 访问控制
  @Acl('tableDelete')
  async tableDelete(
    // 获取租户上下文
    @TenantContext() context: NcContext,
    // 获取表格 ID 参数
    @Param('tableId') tableId: string,
    // 获取请求对象
    @Request() req,
  ) {
    // 调用服务删除表格
    const result = await this.tablesService.tableDelete(context, {
      tableId: req.params.tableId,
      user: (req as any).user,
      req,
    });

    // 返回删除结果
    return result;
  }

  // 重新排序表格的 POST 请求处理器
  @Post([
    '/api/v1/db/meta/tables/:tableId/reorder',
    '/api/v2/meta/tables/:tableId/reorder',
  ])
  // 应用 tableReorder 访问控制
  @Acl('tableReorder')
  // 设置 HTTP 状态码为 200
  @HttpCode(200)
  async tableReorder(
    // 获取租户上下文
    @TenantContext() context: NcContext,
    // 获取表格 ID 参数
    @Param('tableId') tableId: string,
    // 获取请求体，包含排序信息
    @Body() body: { order: number },
    // 获取请求对象，使用 NcRequest 类型
    @Req() req: NcRequest,
  ) {
    // 调用服务重新排序表格
    return this.tablesService.reorderTable(context, {
      tableId,
      order: body.order,
      req,
    });
  }
}
