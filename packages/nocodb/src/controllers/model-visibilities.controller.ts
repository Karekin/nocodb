// 导入所需的 NestJS 装饰器和类型
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
// 导入全局守卫
import { GlobalGuard } from '~/guards/global/global.guard';
// 导入模型可见性服务
import { ModelVisibilitiesService } from '~/services/model-visibilities.service';
// 导入访问控制列表中间件
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
// 导入元数据 API 限制器守卫
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
// 导入租户上下文装饰器
import { TenantContext } from '~/decorators/tenant-context.decorator';
// 导入 NocoDB 上下文和请求接口
import { NcContext, NcRequest } from '~/interface/config';

// 声明控制器
@Controller()
// 使用元数据 API 限制器守卫和全局守卫
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class ModelVisibilitiesController {
  // 构造函数，注入模型可见性服务
  constructor(
    private readonly modelVisibilitiesService: ModelVisibilitiesService,
  ) {}

  // 定义 POST 路由，支持 v1 和 v2 API
  @Post([
    '/api/v1/db/meta/projects/:baseId/visibility-rules',
    '/api/v2/meta/bases/:baseId/visibility-rules',
  ])
  // 设置 HTTP 状态码为 200
  @HttpCode(200)
  // 应用访问控制列表，指定权限为 modelVisibilitySet
  @Acl('modelVisibilitySet')
  // 定义设置所有可见性元数据的方法
  async xcVisibilityMetaSetAll(
    // 获取租户上下文
    @TenantContext() context: NcContext,
    // 获取路径参数 baseId
    @Param('baseId') baseId: string,
    // 获取请求体
    @Body() body: any,
    // 获取请求对象
    @Req() req: NcRequest,
  ) {
    // 调用服务方法设置所有可见性元数据
    await this.modelVisibilitiesService.xcVisibilityMetaSetAll(context, {
      visibilityRule: body,
      baseId,
      req,
    });

    // 返回成功消息
    return { msg: 'UI ACL has been created successfully' };
  }

  // 定义 GET 路由，支持 v1 和 v2 API
  @Get([
    '/api/v1/db/meta/projects/:baseId/visibility-rules',
    '/api/v2/meta/bases/:baseId/visibility-rules',
  ])
  // 应用访问控制列表，指定权限为 modelVisibilityList
  @Acl('modelVisibilityList')
  // 定义获取模型可见性列表的方法
  async modelVisibilityList(
    // 获取租户上下文
    @TenantContext() context: NcContext,
    // 获取路径参数 baseId
    @Param('baseId') baseId: string,
    // 获取查询参数 includeM2M
    @Query('includeM2M') includeM2M: boolean | string,
  ) {
    // 调用服务方法获取可见性元数据并返回结果
    return await this.modelVisibilitiesService.xcVisibilityMetaGet(context, {
      baseId,
      includeM2M: includeM2M === true || includeM2M === 'true',
    });
  }
}
