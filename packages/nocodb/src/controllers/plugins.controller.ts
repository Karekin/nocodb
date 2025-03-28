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
// 导入全局守卫
import { GlobalGuard } from '~/guards/global/global.guard';
// 导入分页响应实现类
import { PagedResponseImpl } from '~/helpers/PagedResponse';
// 导入插件服务
import { PluginsService } from '~/services/plugins.service';
// 导入访问控制列表中间件
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
// 导入元数据 API 限制器守卫
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
// 导入 NcRequest 接口
import { NcRequest } from '~/interface/config';

// todo: move to a interceptor
// const blockInCloudMw = (_req, res, next) => {
//   if (process.env.NC_CLOUD === 'true') {
//     res.status(403).send('Not allowed');
//   } else next();
// };

// 定义控制器
@Controller()
// 使用元数据 API 限制器守卫和全局守卫
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class PluginsController {
  // 构造函数，注入插件服务
  constructor(private readonly pluginsService: PluginsService) {}

  // 获取所有插件列表的 GET 请求处理方法
  @Get(['/api/v1/db/meta/plugins', '/api/v2/meta/plugins'])
  // 应用访问控制，权限为 'pluginList'，作用域为组织级别
  @Acl('pluginList', {
    scope: 'org',
  })
  async pluginList() {
    // 返回分页响应，包含插件列表
    return new PagedResponseImpl(await this.pluginsService.pluginList());
  }

  // 获取所有 webhook 插件列表的 GET 请求处理方法
  @Get(['/api/v1/db/meta/plugins/webhook', '/api/v2/meta/plugins/webhook'])
  // 应用访问控制，权限为 'webhookPluginList'，作用域为组织级别
  @Acl('webhookPluginList', {
    scope: 'org',
  })
  async webhookPluginList() {
    // 返回分页响应，包含 webhook 插件列表
    return new PagedResponseImpl(await this.pluginsService.webhookPluginList());
  }

  // 测试插件的 POST 请求处理方法
  @Post(['/api/v1/db/meta/plugins/test', '/api/v2/meta/plugins/test'])
  // 设置 HTTP 状态码为 200
  @HttpCode(200)
  // 应用访问控制，权限为 'pluginTest'，作用域为组织级别
  @Acl('pluginTest', {
    scope: 'org',
  })
  async pluginTest(@Body() body: any, @Req() req: NcRequest) {
    // 调用插件服务的测试方法，传入请求体和请求对象
    return await this.pluginsService.pluginTest({ body: body, req });
  }

  // 读取特定插件信息的 GET 请求处理方法
  @Get(['/api/v1/db/meta/plugins/:pluginId', '/api/v2/meta/plugins/:pluginId'])
  // 应用访问控制，权限为 'pluginRead'，作用域为组织级别
  @Acl('pluginRead', {
    scope: 'org',
  })
  async pluginRead(@Param('pluginId') pluginId: string) {
    // 调用插件服务的读取方法，传入插件 ID
    return await this.pluginsService.pluginRead({ pluginId: pluginId });
  }

  // 更新特定插件的 PATCH 请求处理方法
  @Patch([
    '/api/v1/db/meta/plugins/:pluginId',
    '/api/v2/meta/plugins/:pluginId',
  ])
  // 应用访问控制，权限为 'pluginUpdate'，作用域为组织级别
  @Acl('pluginUpdate', {
    scope: 'org',
  })
  async pluginUpdate(
    @Body() body: any,
    @Param('pluginId') pluginId: string,
    @Req() req: NcRequest,
  ) {
    // 调用插件服务的更新方法，传入插件 ID、插件数据和请求对象
    const plugin = await this.pluginsService.pluginUpdate({
      pluginId: pluginId,
      plugin: body,
      req,
    });
    // 返回更新后的插件
    return plugin;
  }

  // 检查插件是否激活的 GET 请求处理方法
  @Get([
    '/api/v1/db/meta/plugins/:pluginId/status',
    '/api/v2/meta/plugins/:pluginId/status',
  ])
  // 应用访问控制，权限为 'isPluginActive'，作用域为组织级别
  @Acl('isPluginActive', {
    scope: 'org',
  })
  async isPluginActive(@Param('pluginId') pluginId: string) {
    // 调用插件服务的检查插件激活状态方法，传入插件 ID
    return await this.pluginsService.isPluginActive({
      pluginId,
    });
  }
}
