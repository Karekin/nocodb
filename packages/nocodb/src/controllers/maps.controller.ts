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
// 导入地图更新请求类型和视图创建请求类型
import { MapUpdateReqType, ViewCreateReqType } from 'nocodb-sdk';
// 导入全局守卫
import { GlobalGuard } from '~/guards/global/global.guard';
// 导入地图服务
import { MapsService } from '~/services/maps.service';
// 导入访问控制中间件
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
// 导入元数据 API 限制守卫
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
// 导入租户上下文装饰器
import { TenantContext } from '~/decorators/tenant-context.decorator';
// 导入上下文和请求接口类型
import { NcContext, NcRequest } from '~/interface/config';

// 声明这是一个控制器类
@Controller()
// 使用元数据 API 限制守卫和全局守卫
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class MapsController {
  // 构造函数，注入地图服务
  constructor(private readonly mapsService: MapsService) {}

  // 获取地图视图的路由处理器（支持 v1 和 v2 API）
  @Get(['/api/v1/db/meta/maps/:mapViewId', '/api/v2/meta/maps/:mapViewId'])
  // 使用访问控制装饰器，检查 mapViewGet 权限
  @Acl('mapViewGet')
  async mapViewGet(
    // 获取租户上下文
    @TenantContext() context: NcContext,
    // 获取地图视图 ID 参数
    @Param('mapViewId') mapViewId: string,
  ) {
    // 调用服务层方法获取地图视图数据
    return await this.mapsService.mapViewGet(context, { mapViewId });
  }

  // 创建地图视图的路由处理器（支持 v1 和 v2 API）
  @Post([
    '/api/v1/db/meta/tables/:tableId/maps',
    '/api/v2/meta/tables/:tableId/maps',
  ])
  // 设置响应状态码为 200
  @HttpCode(200)
  // 使用访问控制装饰器，检查 mapViewCreate 权限
  @Acl('mapViewCreate')
  async mapViewCreate(
    // 获取租户上下文
    @TenantContext() context: NcContext,
    // 获取表 ID 参数
    @Param('tableId') tableId: string,
    // 获取请求体数据
    @Body() body: ViewCreateReqType,
    // 获取请求对象
    @Req() req: NcRequest,
  ) {
    // 调用服务层方法创建地图视图
    const view = await this.mapsService.mapViewCreate(context, {
      tableId,
      map: body,
      user: req.user,
      req,
    });
    return view;
  }

  // 更新地图视图的路由处理器（支持 v1 和 v2 API）
  @Patch(['/api/v1/db/meta/maps/:mapViewId', '/api/v2/meta/maps/:mapViewId'])
  // 使用访问控制装饰器，检查 mapViewUpdate 权限
  @Acl('mapViewUpdate')
  async mapViewUpdate(
    // 获取租户上下文
    @TenantContext() context: NcContext,
    // 获取地图视图 ID 参数
    @Param('mapViewId') mapViewId: string,
    // 获取请求体数据
    @Body() body: MapUpdateReqType,
    // 获取请求对象
    @Req() req: NcRequest,
  ) {
    // 调用服务层方法更新地图视图
    return await this.mapsService.mapViewUpdate(context, {
      mapViewId: mapViewId,
      map: body,
      req,
    });
  }
}
