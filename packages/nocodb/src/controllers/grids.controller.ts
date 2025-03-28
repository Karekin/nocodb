// 导入所需的 NestJS 装饰器和类型
import {
  Body,
  Controller,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
// 导入视图创建请求类型
import { ViewCreateReqType } from 'nocodb-sdk';
// 导入全局守卫
import { GlobalGuard } from '~/guards/global/global.guard';
// 导入网格服务
import { GridsService } from '~/services/grids.service';
// 导入访问控制中间件
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
// 导入元数据 API 限制守卫
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
// 导入租户上下文装饰器
import { TenantContext } from '~/decorators/tenant-context.decorator';
// 导入自定义上下文和请求接口
import { NcContext, NcRequest } from '~/interface/config';

// 声明这是一个控制器类
@Controller()
// 使用元数据 API 限制守卫和全局守卫
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class GridsController {
  // 构造函数，注入网格服务
  constructor(private readonly gridsService: GridsService) {}

  // POST 请求处理方法，支持 v1 和 v2 两个版本的 API 路径
  @Post([
    '/api/v1/db/meta/tables/:tableId/grids/',
    '/api/v2/meta/tables/:tableId/grids/',
  ])
  // 设置 HTTP 响应状态码为 200
  @HttpCode(200)
  // 设置访问控制权限为 gridViewCreate
  @Acl('gridViewCreate')
  async gridViewCreate(
    // 获取租户上下文
    @TenantContext() context: NcContext,
    // 获取 URL 参数中的 tableId
    @Param('tableId') tableId: string,
    // 获取请求体数据
    @Body() body: ViewCreateReqType,
    // 获取请求对象
    @Req() req: NcRequest,
  ) {
    // 调用服务创建网格视图
    const view = await this.gridsService.gridViewCreate(context, {
      grid: body,
      tableId,
      req,
    });
    // 返回创建的视图
    return view;
  }

  // PATCH 请求处理方法，支持 v1 和 v2 两个版本的 API 路径
  @Patch(['/api/v1/db/meta/grids/:viewId', '/api/v2/meta/grids/:viewId'])
  // 设置访问控制权限为 gridViewUpdate
  @Acl('gridViewUpdate')
  async gridViewUpdate(
    // 获取租户上下文
    @TenantContext() context: NcContext,
    // 获取 URL 参数中的 viewId
    @Param('viewId') viewId: string,
    // 获取请求体数据
    @Body() body,
    // 获取请求对象
    @Req() req: NcRequest,
  ) {
    // 调用服务更新网格视图并返回结果
    return await this.gridsService.gridViewUpdate(context, {
      viewId,
      grid: body,
      req,
    });
  }
}
