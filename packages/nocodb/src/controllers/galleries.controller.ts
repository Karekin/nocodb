// 导入所需的 NestJS 装饰器和类型
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
// 导入画廊更新请求类型和视图创建请求类型
import { GalleryUpdateReqType, ViewCreateReqType } from 'nocodb-sdk';
// 导入全局守卫
import { GlobalGuard } from '~/guards/global/global.guard';
// 导入画廊服务
import { GalleriesService } from '~/services/galleries.service';
// 导入访问控制中间件
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
// 导入元数据 API 限制器守卫
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
// 导入租户上下文装饰器
import { TenantContext } from '~/decorators/tenant-context.decorator';
// 导入上下文和请求接口类型
import { NcContext, NcRequest } from '~/interface/config';

// 声明这是一个控制器类
@Controller()
// 使用元数据 API 限制器守卫和全局守卫
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class GalleriesController {
  // 构造函数，注入画廊服务
  constructor(private readonly galleriesService: GalleriesService) {}

  // 获取画廊视图的 GET 请求处理方法，支持 v1 和 v2 API
  @Get([
    '/api/v1/db/meta/galleries/:galleryViewId',
    '/api/v2/meta/galleries/:galleryViewId',
  ])
  // 应用画廊视图获取权限控制
  @Acl('galleryViewGet')
  async galleryViewGet(
    // 注入租户上下文
    @TenantContext() context: NcContext,
    // 获取路径参数中的画廊视图 ID
    @Param('galleryViewId') galleryViewId: string,
  ) {
    // 调用服务方法获取画廊视图数据
    return await this.galleriesService.galleryViewGet(context, {
      galleryViewId,
    });
  }

  // 创建画廊视图的 POST 请求处理方法，支持 v1 和 v2 API
  @Post([
    '/api/v1/db/meta/tables/:tableId/galleries',
    '/api/v2/meta/tables/:tableId/galleries',
  ])
  // 设置响应状态码为 200
  @HttpCode(200)
  // 应用画廊视图创建权限控制
  @Acl('galleryViewCreate')
  async galleryViewCreate(
    // 注入租户上下文
    @TenantContext() context: NcContext,
    // 获取路径参数中的表 ID
    @Param('tableId') tableId: string,
    // 获取请求体数据
    @Body() body: ViewCreateReqType,
    // 注入请求对象
    @Req() req: NcRequest,
  ) {
    // 调用服务方法创建画廊视图
    return await this.galleriesService.galleryViewCreate(context, {
      gallery: body,
      // todo: sanitize
      tableId,
      req,
      user: req.user,
    });
  }

  // 更新画廊视图的 PATCH 请求处理方法，支持 v1 和 v2 API
  @Patch([
    '/api/v1/db/meta/galleries/:galleryViewId',
    '/api/v2/meta/galleries/:galleryViewId',
  ])
  // 应用画廊视图更新权限控制
  @Acl('galleryViewUpdate')
  async galleryViewUpdate(
    // 注入租户上下文
    @TenantContext() context: NcContext,
    // 获取路径参数中的画廊视图 ID
    @Param('galleryViewId') galleryViewId: string,
    // 获取请求体数据
    @Body() body: GalleryUpdateReqType,
    // 注入请求对象
    @Req() req: NcRequest,
  ) {
    // 调用服务方法更新画廊视图
    return await this.galleriesService.galleryViewUpdate(context, {
      galleryViewId,
      gallery: body,
      req,
    });
  }
}
