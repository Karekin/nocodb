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
// 导入排序请求类型
import { SortReqType } from 'nocodb-sdk';
// 导入全局守卫
import { GlobalGuard } from '~/guards/global/global.guard';
// 导入分页响应实现类
import { PagedResponseImpl } from '~/helpers/PagedResponse';
// 导入排序服务
import { SortsService } from '~/services/sorts.service';
// 导入访问控制列表中间件
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
// 导入元数据 API 限制器守卫
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
// 导入租户上下文装饰器
import { TenantContext } from '~/decorators/tenant-context.decorator';
// 导入 NocoDB 上下文和请求接口
import { NcContext, NcRequest } from '~/interface/config';

// 声明这是一个控制器类
@Controller()
// 使用元数据 API 限制器守卫和全局守卫
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class SortsController {
  // 构造函数，注入排序服务
  constructor(private readonly sortsService: SortsService) {}

  // 获取视图下所有排序的 GET 请求处理器，支持 v1 和 v2 API
  @Get([
    '/api/v1/db/meta/views/:viewId/sorts/',
    '/api/v2/meta/views/:viewId/sorts/',
  ])
  // 应用 'sortList' 访问控制
  @Acl('sortList')
  async sortList(
    // 注入租户上下文
    @TenantContext() context: NcContext,
    // 获取路径参数 viewId
    @Param('viewId') viewId: string,
  ) {
    // 返回分页响应，包含排序列表
    return new PagedResponseImpl(
      await this.sortsService.sortList(context, {
        viewId,
      }),
    );
  }

  // 创建新排序的 POST 请求处理器，支持 v1 和 v2 API
  @Post([
    '/api/v1/db/meta/views/:viewId/sorts/',
    '/api/v2/meta/views/:viewId/sorts/',
  ])
  // 设置 HTTP 状态码为 200
  @HttpCode(200)
  // 应用 'sortCreate' 访问控制
  @Acl('sortCreate')
  async sortCreate(
    // 注入租户上下文
    @TenantContext() context: NcContext,
    // 获取路径参数 viewId
    @Param('viewId') viewId: string,
    // 获取请求体
    @Body() body: SortReqType,
    // 获取请求对象
    @Req() req: NcRequest,
  ) {
    // 调用服务创建排序并返回结果
    const sort = await this.sortsService.sortCreate(context, {
      sort: body,
      viewId,
      req,
    });
    return sort;
  }

  // 获取单个排序的 GET 请求处理器，支持 v1 和 v2 API
  @Get(['/api/v1/db/meta/sorts/:sortId', '/api/v2/meta/sorts/:sortId'])
  // 应用 'sortGet' 访问控制
  @Acl('sortGet')
  async sortGet(
    // 注入租户上下文
    @TenantContext() context: NcContext,
    // 获取路径参数 sortId
    @Param('sortId') sortId: string,
  ) {
    // 调用服务获取排序并返回结果
    const sort = await this.sortsService.sortGet(context, {
      sortId,
    });
    return sort;
  }

  // 更新排序的 PATCH 请求处理器，支持 v1 和 v2 API
  @Patch(['/api/v1/db/meta/sorts/:sortId', '/api/v2/meta/sorts/:sortId'])
  // 应用 'sortUpdate' 访问控制
  @Acl('sortUpdate')
  async sortUpdate(
    // 注入租户上下文
    @TenantContext() context: NcContext,
    // 获取路径参数 sortId
    @Param('sortId') sortId: string,
    // 获取请求体
    @Body() body: SortReqType,
    // 获取请求对象
    @Req() req: NcRequest,
  ) {
    // 调用服务更新排序并返回结果
    const sort = await this.sortsService.sortUpdate(context, {
      sortId,
      sort: body,
      req,
    });
    return sort;
  }

  // 删除排序的 DELETE 请求处理器，支持 v1 和 v2 API
  @Delete(['/api/v1/db/meta/sorts/:sortId', '/api/v2/meta/sorts/:sortId'])
  // 应用 'sortDelete' 访问控制
  @Acl('sortDelete')
  async sortDelete(
    // 注入租户上下文
    @TenantContext() context: NcContext,
    // 获取路径参数 sortId
    @Param('sortId') sortId: string,
    // 获取请求对象
    @Req() req: NcRequest,
  ) {
    // 调用服务删除排序并返回结果
    const sort = await this.sortsService.sortDelete(context, {
      sortId,
      req,
    });
    return sort;
  }
}
