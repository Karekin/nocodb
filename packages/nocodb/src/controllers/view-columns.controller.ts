// 导入所需的 NestJS 装饰器和工具
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
// 导入 nocodb-sdk 中的 APIContext 和 ViewColumnReqType 类型
import { APIContext, ViewColumnReqType } from 'nocodb-sdk';
// 导入 nocodb-sdk 中的各种列类型定义
import type {
  CalendarColumnReqType,
  FormColumnReqType,
  GalleryColumnReqType,
  GridColumnReqType,
  KanbanColumnReqType,
} from 'nocodb-sdk';
// 导入全局守卫
import { GlobalGuard } from '~/guards/global/global.guard';
// 导入分页响应实现类
import { PagedResponseImpl } from '~/helpers/PagedResponse';
// 导入视图列服务
import { ViewColumnsService } from '~/services/view-columns.service';
// 导入访问控制列表中间件
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
// 导入元数据 API 限制器守卫
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
// 导入租户上下文装饰器
import { TenantContext } from '~/decorators/tenant-context.decorator';
// 导入 NcContext 和 NcRequest 接口
import { NcContext, NcRequest } from '~/interface/config';

// 定义控制器
@Controller()
// 使用 MetaApiLimiterGuard 和 GlobalGuard 守卫
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class ViewColumnsController {
  // 构造函数，注入 ViewColumnsService 服务
  constructor(private readonly viewColumnsService: ViewColumnsService) {}

  // 获取视图列表的 API 端点（支持 v1 和 v2 版本）
  @Get([
    '/api/v1/db/meta/views/:viewId/columns/',
    '/api/v2/meta/views/:viewId/columns/',
  ])
  // 应用 columnList 访问控制
  @Acl('columnList')
  async columnList(
    // 注入租户上下文
    @TenantContext() context: NcContext,
    // 获取路径参数 viewId
    @Param('viewId') viewId: string,
  ) {
    // 返回分页响应，包含视图列表数据
    return new PagedResponseImpl(
      await this.viewColumnsService.columnList(context, {
        viewId,
      }),
    );
  }

  // 添加视图列的 API 端点（支持 v1 和 v2 版本）
  @Post([
    '/api/v1/db/meta/views/:viewId/columns/',
    '/api/v2/meta/views/:viewId/columns/',
  ])
  // 设置 HTTP 状态码为 200
  @HttpCode(200)
  // 应用 columnAdd 访问控制
  @Acl('columnAdd')
  async columnAdd(
    // 注入租户上下文
    @TenantContext() context: NcContext,
    // 获取路径参数 viewId
    @Param('viewId') viewId: string,
    // 获取请求体
    @Body() body: ViewColumnReqType,
    // 获取请求对象
    @Req() req: NcRequest,
  ) {
    // 调用服务添加视图列
    const viewColumn = await this.viewColumnsService.columnAdd(context, {
      viewId,
      column: body,
      req,
    });
    // 返回添加的视图列
    return viewColumn;
  }

  // 更新视图列的 API 端点（支持 v1 和 v2 版本）
  @Patch([
    '/api/v1/db/meta/views/:viewId/columns/:columnId',
    '/api/v2/meta/views/:viewId/columns/:columnId',
  ])
  // 应用 viewColumnUpdate 访问控制
  @Acl('viewColumnUpdate')
  async viewColumnUpdate(
    // 注入租户上下文
    @TenantContext() context: NcContext,
    // 获取路径参数 viewId
    @Param('viewId') viewId: string,
    // 获取路径参数 columnId
    @Param('columnId') columnId: string,
    // 获取请求体
    @Body() body: ViewColumnReqType,
    // 获取请求对象
    @Req() req: NcRequest,
  ) {
    // 调用服务更新视图列
    const result = await this.viewColumnsService.columnUpdate(context, {
      viewId,
      columnId,
      column: body,
      req,
    });
    // 返回更新结果
    return result;
  }

  // 批量更新视图列的 API 端点（v3 版本）
  @Patch('/api/v3/meta/views/:viewId/columns')
  // 应用 columnUpdate 访问控制
  @Acl('columnUpdate')
  async viewColumnUpdateV3(
    // 注入租户上下文
    @TenantContext() context: NcContext,
    // 获取请求对象
    @Req() req,
    // 获取路径参数 viewId
    @Param('viewId') viewId: string,
    // 获取请求体，支持多种列类型或列类型数组或复杂的记录结构
    @Body()
    body:
      | GridColumnReqType
      | GalleryColumnReqType
      | KanbanColumnReqType
      | FormColumnReqType
      | CalendarColumnReqType[]
      | Record<
          APIContext.VIEW_COLUMNS,
          Record<
            string,
            | GridColumnReqType
            | GalleryColumnReqType
            | KanbanColumnReqType
            | FormColumnReqType
            | CalendarColumnReqType
          >
        >,
  ) {
    // 返回分页响应，包含更新后的列数据
    return new PagedResponseImpl(
      await this.viewColumnsService.columnsUpdate(context, {
        viewId,
        columns: body,
        req,
      }),
    );
  }

  // 获取视图列表的 API 端点（v3 版本）
  @Get('/api/v3/meta/views/:viewId/columns')
  // 应用 columnList 访问控制
  @Acl('columnList')
  async viewColumnListV3(
    // 注入租户上下文
    @TenantContext() context: NcContext,
    // 获取请求对象
    @Req() req,
    // 获取路径参数 viewId
    @Param('viewId') viewId: string,
  ) {
    // 返回包含视图列表的对象，使用 APIContext.VIEW_COLUMNS 作为键
    return {
      [APIContext.VIEW_COLUMNS]: await this.viewColumnsService.viewColumnList(
        context,
        {
          viewId,
          req,
        },
      ),
    };
  }
}
