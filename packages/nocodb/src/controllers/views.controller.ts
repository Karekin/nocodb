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
  UseGuards,
} from '@nestjs/common';
import { ViewUpdateReqType } from 'nocodb-sdk';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import { GlobalGuard } from '~/guards/global/global.guard';
import { ViewsService } from '~/services/views.service';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext, NcRequest } from '~/interface/config';

// 使用Controller装饰器定义控制器
@Controller()
// 使用全局守卫和API限流守卫
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class ViewsController {
  // 构造函数，注入ViewsService
  constructor(private readonly viewsService: ViewsService) {}

  // 获取视图列表的GET请求
  @Get([
    '/api/v1/db/meta/tables/:tableId/views',
    '/api/v2/meta/tables/:tableId/views',
  ])
  // 访问控制，需要viewList权限
  @Acl('viewList')
  async viewList(
    @TenantContext() context: NcContext, // 租户上下文
    @Param('tableId') tableId: string, // 表ID参数
    @Req() req: NcRequest,
  ) {
    // 返回分页的视图列表
    return new PagedResponseImpl(
      await this.viewsService.viewList(context, {
        tableId,
        user: req.user,
      }),
    );
  }

  // 更新视图的PATCH请求
  @Patch(['/api/v1/db/meta/views/:viewId', '/api/v2/meta/views/:viewId'])
  @Acl('viewUpdate')
  async viewUpdate(
    @TenantContext() context: NcContext,
    @Param('viewId') viewId: string, // 视图ID参数
    @Body() body: ViewUpdateReqType, // 请求体
    @Req() req: NcRequest,
  ) {
    // 调用服务层更新视图
    const result = await this.viewsService.viewUpdate(context, {
      viewId,
      view: body,
      user: req.user,
      req,
    });
    return result;
  }

  // 删除视图的DELETE请求
  @Delete(['/api/v1/db/meta/views/:viewId', '/api/v2/meta/views/:viewId'])
  @Acl('viewDelete')
  async viewDelete(
    @TenantContext() context: NcContext,
    @Param('viewId') viewId: string,
    @Req() req: NcRequest,
  ) {
    // 调用服务层删除视图
    const result = await this.viewsService.viewDelete(context, {
      viewId,
      user: req.user,
      req,
    });
    return result;
  }

  // 显示所有列的POST请求
  @Post([
    '/api/v1/db/meta/views/:viewId/show-all',
    '/api/v2/meta/views/:viewId/show-all',
  ])
  @HttpCode(200) // 设置HTTP状态码为200
  @Acl('showAllColumns')
  async showAllColumns(
    @TenantContext() context: NcContext,
    @Param('viewId') viewId: string,
    @Query('ignoreIds') ignoreIds: string[], // 忽略的列ID列表
  ) {
    // 调用服务层显示所有列
    return await this.viewsService.showAllColumns(context, {
      viewId,
      ignoreIds,
    });
  }

  // 隐藏所有列的POST请求
  @Post([
    '/api/v1/db/meta/views/:viewId/hide-all',
    '/api/v2/meta/views/:viewId/hide-all',
  ])
  @HttpCode(200)
  @Acl('hideAllColumns')
  async hideAllColumns(
    @TenantContext() context: NcContext,
    @Param('viewId') viewId: string,
    @Query('ignoreIds') ignoreIds: string[],
  ) {
    // 调用服务层隐藏所有列
    return await this.viewsService.hideAllColumns(context, {
      viewId,
      ignoreIds,
    });
  }

  // 分享视图的POST请求
  @Post([
    '/api/v1/db/meta/views/:viewId/share',
    '/api/v2/meta/views/:viewId/share',
  ])
  @HttpCode(200)
  @Acl('shareView')
  async shareView(
    @TenantContext() context: NcContext,
    @Param('viewId') viewId: string,
    @Req() req: NcRequest,
  ) {
    // 调用服务层分享视图
    return await this.viewsService.shareView(context, {
      viewId,
      user: req.user,
      req,
    });
  }

  // 获取分享视图列表的GET请求
  @Get([
    '/api/v1/db/meta/tables/:tableId/share',
    '/api/v2/meta/tables/:tableId/share',
  ])
  @Acl('shareViewList')
  async shareViewList(
    @TenantContext() context: NcContext,
    @Param('tableId') tableId: string,
  ) {
    // 返回分页的分享视图列表
    return new PagedResponseImpl(
      await this.viewsService.shareViewList(context, {
        tableId,
      }),
    );
  }

  // 更新分享视图的PATCH请求
  @Patch([
    '/api/v1/db/meta/views/:viewId/share',
    '/api/v2/meta/views/:viewId/share',
  ])
  @Acl('shareViewUpdate')
  async shareViewUpdate(
    @TenantContext() context: NcContext,
    @Param('viewId') viewId: string,
    @Body()
    body: ViewUpdateReqType & {
      custom_url_path?: string; // 自定义URL路径
    },
    @Req() req: NcRequest,
  ) {
    // 调用服务层更新分享视图
    return await this.viewsService.shareViewUpdate(context, {
      viewId,
      sharedView: body,
      user: req.user,
      req,
    });
  }

  // 删除分享视图的DELETE请求
  @Delete([
    '/api/v1/db/meta/views/:viewId/share',
    '/api/v2/meta/views/:viewId/share',
  ])
  @Acl('shareViewDelete')
  async shareViewDelete(
    @TenantContext() context: NcContext,
    @Param('viewId') viewId: string,
    @Req() req: NcRequest,
  ) {
    // 调用服务层删除分享视图
    return await this.viewsService.shareViewDelete(context, {
      viewId,
      user: req.user,
      req,
    });
  }
}
