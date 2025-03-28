// 导入所需的 NestJS 装饰器和类型
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
// 导入网格列请求类型定义
import { GridColumnReqType } from 'nocodb-sdk';
// 导入全局守卫
import { GlobalGuard } from '~/guards/global/global.guard';
// 导入网格列服务
import { GridColumnsService } from '~/services/grid-columns.service';
// 导入访问控制中间件
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
// 导入元数据 API 限制守卫
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
// 导入租户上下文装饰器
import { TenantContext } from '~/decorators/tenant-context.decorator';
// 导入上下文和请求接口定义
import { NcContext, NcRequest } from '~/interface/config';

// 声明这是一个控制器类
@Controller()
// 使用元数据 API 限制守卫和全局守卫
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class GridColumnsController {
  // 构造函数，注入网格列服务
  constructor(private readonly gridColumnsService: GridColumnsService) {}

  // 定义获取列表的 GET 路由，支持 v1 和 v2 两个版本的 API
  @Get([
    '/api/v1/db/meta/grids/:gridViewId/grid-columns',
    '/api/v2/meta/grids/:gridViewId/grid-columns',
  ])
  // 应用访问控制，检查 columnList 权限
  @Acl('columnList')
  // 列表查询方法
  async columnList(
    // 注入租户上下文
    @TenantContext() context: NcContext,
    // 获取路由参数中的网格视图 ID
    @Param('gridViewId') gridViewId: string,
  ) {
    // 调用服务层方法获取列表数据
    return await this.gridColumnsService.columnList(context, {
      gridViewId,
    });
  }

  // 定义更新列的 PATCH 路由，支持 v1 和 v2 两个版本的 API
  @Patch([
    '/api/v1/db/meta/grid-columns/:gridViewColumnId',
    '/api/v2/meta/grid-columns/:gridViewColumnId',
  ])
  // 应用访问控制，检查 gridColumnUpdate 权限
  @Acl('gridColumnUpdate')
  // 网格列更新方法
  async gridColumnUpdate(
    // 注入租户上下文
    @TenantContext() context: NcContext,
    // 获取路由参数中的网格列 ID
    @Param('gridViewColumnId') gridViewColumnId: string,
    // 获取请求体数据
    @Body() body: GridColumnReqType,
    // 注入请求对象
    @Req() req: NcRequest,
  ) {
    // 调用服务层方法更新列数据
    return this.gridColumnsService.gridColumnUpdate(context, {
      gridViewColumnId,
      grid: body,
      req,
    });
  }
}
