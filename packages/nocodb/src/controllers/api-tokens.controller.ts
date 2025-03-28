// 导入所需的 NestJS 装饰器和类型
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
// 导入全局守卫
import { GlobalGuard } from '~/guards/global/global.guard';
// 导入分页响应实现类
import { PagedResponseImpl } from '~/helpers/PagedResponse';
// 导入 API 令牌服务
import { ApiTokensService } from '~/services/api-tokens.service';
// 导入访问控制装饰器
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
// 导入 Meta API 限制器守卫
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
// 导入请求接口类型
import { NcRequest } from '~/interface/config';

// 声明这是一个控制器类
@Controller()
// 使用 Meta API 限制器守卫和全局守卫
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class ApiTokensController {
  // 构造函数，注入 API 令牌服务
  constructor(private readonly apiTokensService: ApiTokensService) {}

  // 获取 API 令牌列表的路由
  @Get([
    '/api/v1/db/meta/projects/:baseId/api-tokens',
    '/api/v2/meta/bases/:baseId/api-tokens',
  ])
  // 应用访问控制，检查是否有列表权限
  @Acl('baseApiTokenList')
  // API 令牌列表获取方法
  async apiTokenList(@Req() req: NcRequest) {
    // 返回分页后的 API 令牌列表
    return new PagedResponseImpl(
      await this.apiTokensService.apiTokenList({ userId: req['user'].id }),
    );
  }

  // 创建 API 令牌的路由
  @Post([
    '/api/v1/db/meta/projects/:baseId/api-tokens',
    '/api/v2/meta/bases/:baseId/api-tokens',
  ])
  // 设置 HTTP 响应状态码为 200
  @HttpCode(200)
  // 应用访问控制，检查是否有创建权限
  @Acl('baseApiTokenCreate')
  // API 令牌创建方法
  async apiTokenCreate(@Req() req: NcRequest, @Body() body) {
    // 调用服务创建 API 令牌
    return await this.apiTokensService.apiTokenCreate({
      tokenBody: body,
      userId: req['user'].id,
      req,
    });
  }

  // 删除 API 令牌的路由
  @Delete([
    '/api/v1/db/meta/projects/:baseId/api-tokens/:tokenId',
    '/api/v2/meta/bases/:baseId/api-tokens/:tokenId',
  ])
  // 应用访问控制，检查是否有删除权限
  @Acl('baseApiTokenDelete')
  // API 令牌删除方法
  async apiTokenDelete(
    @Req() req: NcRequest,
    @Param('tokenId') tokenId: string,
  ) {
    // 调用服务删除指定的 API 令牌
    return await this.apiTokensService.apiTokenDelete({
      tokenId,
      user: req['user'],
      req,
    });
  }
}
