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
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
// 导入过滤器请求类型
import { FilterReqType } from 'nocodb-sdk';
// 导入全局守卫
import { GlobalGuard } from '~/guards/global/global.guard';
// 导入分页响应实现类
import { PagedResponseImpl } from '~/helpers/PagedResponse';
// 导入过滤器服务
import { FiltersService } from '~/services/filters.service';
// 导入访问控制中间件
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
// 导入元数据 API 限制守卫
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
// 导入租户上下文装饰器
import { TenantContext } from '~/decorators/tenant-context.decorator';
// 导入上下文和请求接口类型
import { NcContext, NcRequest } from '~/interface/config';

// 声明控制器
@Controller()
// 使用元数据 API 限制守卫和全局守卫
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class FiltersController {
  // 构造函数，注入过滤器服务
  constructor(protected readonly filtersService: FiltersService) {}

  // 获取视图的过滤器列表
  @Get([
    '/api/v1/db/meta/views/:viewId/filters',
    '/api/v2/meta/views/:viewId/filters',
  ])
  // 访问控制装饰器
  @Acl('filterList')
  async filterList(
    // 获取租户上下文
    @TenantContext() context: NcContext,
    // 获取视图 ID 参数
    @Param('viewId') viewId: string,
    // 获取是否包含所有过滤器的查询参数
    @Query('includeAllFilters') includeAllFilters: string,
  ) {
    // 返回分页响应
    return new PagedResponseImpl(
      await this.filtersService.filterList(context, {
        viewId,
        includeAllFilters: includeAllFilters === 'true',
      }),
    );
  }

  // 创建视图过滤器
  @Post([
    '/api/v1/db/meta/views/:viewId/filters',
    '/api/v2/meta/views/:viewId/filters',
  ])
  // 设置 HTTP 状态码为 200
  @HttpCode(200)
  // 访问控制装饰器
  @Acl('filterCreate')
  async filterCreate(
    // 获取租户上下文
    @TenantContext() context: NcContext,
    // 获取视图 ID 参数
    @Param('viewId') viewId: string,
    // 获取请求体
    @Body() body: FilterReqType,
    // 获取请求对象
    @Req() req: NcRequest,
  ) {
    // 创建过滤器并返回结果
    const filter = await this.filtersService.filterCreate(context, {
      filter: body,
      viewId: viewId,
      user: req.user,
      req,
    });
    return filter;
  }

  // 创建钩子过滤器
  @Post([
    '/api/v1/db/meta/hooks/:hookId/filters',
    '/api/v2/meta/hooks/:hookId/filters',
  ])
  // 设置 HTTP 状态码为 200
  @HttpCode(200)
  // 访问控制装饰器
  @Acl('hookFilterCreate')
  async hookFilterCreate(
    // 获取租户上下文
    @TenantContext() context: NcContext,
    // 获取钩子 ID 参数
    @Param('hookId') hookId: string,
    // 获取请求体
    @Body() body: FilterReqType,
    // 获取请求对象
    @Req() req: NcRequest,
  ) {
    // 创建钩子过滤器并返回结果
    const filter = await this.filtersService.hookFilterCreate(context, {
      filter: body,
      hookId,
      user: req.user,
      req,
    });
    return filter;
  }

  // 获取单个过滤器详情
  @Get(['/api/v1/db/meta/filters/:filterId', '/api/v2/meta/filters/:filterId'])
  // 访问控制装饰器
  @Acl('filterGet')
  async filterGet(
    // 获取租户上下文
    @TenantContext() context: NcContext,
    // 获取过滤器 ID 参数
    @Param('filterId') filterId: string,
  ) {
    // 获取并返回过滤器详情
    return await this.filtersService.filterGet(context, { filterId });
  }

  // 获取过滤器的子过滤器列表
  @Get([
    '/api/v1/db/meta/filters/:filterParentId/children',
    '/api/v2/meta/filters/:filterParentId/children',
  ])
  // 访问控制装饰器
  @Acl('filterChildrenRead')
  async filterChildrenRead(
    // 获取租户上下文
    @TenantContext() context: NcContext,
    // 获取父过滤器 ID 参数
    @Param('filterParentId') filterParentId: string,
  ) {
    // 返回分页响应
    return new PagedResponseImpl(
      await this.filtersService.filterChildrenList(context, {
        filterId: filterParentId,
      }),
    );
  }

  // 更新过滤器
  @Patch([
    '/api/v1/db/meta/filters/:filterId',
    '/api/v2/meta/filters/:filterId',
  ])
  // 访问控制装饰器
  @Acl('filterUpdate')
  async filterUpdate(
    // 获取租户上下文
    @TenantContext() context: NcContext,
    // 获取过滤器 ID 参数
    @Param('filterId') filterId: string,
    // 获取请求体
    @Body() body: FilterReqType,
    // 获取请求对象
    @Req() req: NcRequest,
  ) {
    // 更新过滤器并返回结果
    const filter = await this.filtersService.filterUpdate(context, {
      filterId: filterId,
      filter: body,
      user: req.user,
      req,
    });
    return filter;
  }

  // 删除过滤器
  @Delete([
    '/api/v1/db/meta/filters/:filterId',
    '/api/v2/meta/filters/:filterId',
  ])
  // 访问控制装饰器
  @Acl('filterDelete')
  async filterDelete(
    // 获取租户上下文
    @TenantContext() context: NcContext,
    // 获取过滤器 ID 参数
    @Param('filterId') filterId: string,
    // 获取请求对象
    @Req() req: NcRequest,
  ) {
    // 删除过滤器并返回结果
    const filter = await this.filtersService.filterDelete(context, {
      req,
      filterId,
    });
    return filter;
  }

  // 获取钩子的过滤器列表
  @Get([
    '/api/v1/db/meta/hooks/:hookId/filters',
    '/api/v2/meta/hooks/:hookId/filters',
  ])
  // 访问控制装饰器
  @Acl('hookFilterList')
  async hookFilterList(
    // 获取租户上下文
    @TenantContext() context: NcContext,
    // 获取钩子 ID 参数
    @Param('hookId') hookId: string,
  ) {
    // 返回分页响应
    return new PagedResponseImpl(
      await this.filtersService.hookFilterList(context, {
        hookId: hookId,
      }),
    );
  }
}
