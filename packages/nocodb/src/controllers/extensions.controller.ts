// 导入所需的 NestJS 装饰器和类型
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
// 导入扩展请求类型定义
import type { ExtensionReqType } from 'nocodb-sdk';
// 导入全局守卫
import { GlobalGuard } from '~/guards/global/global.guard';
// 导入扩展服务
import { ExtensionsService } from '~/services/extensions.service';
// 导入访问控制中间件
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
// 导入 API 限流守卫
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
// 导入分页响应实现类
import { PagedResponseImpl } from '~/helpers/PagedResponse';
// 导入租户上下文装饰器
import { TenantContext } from '~/decorators/tenant-context.decorator';
// 导入上下文和请求接口定义
import { NcContext, NcRequest } from '~/interface/config';

// 声明这是一个控制器类
@Controller()
// 使用 API 限流守卫和全局守卫
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class ExtensionsController {
  // 构造函数，注入扩展服务
  constructor(private readonly extensionsService: ExtensionsService) {}

  // 获取指定 baseId 的扩展列表
  @Get(['/api/v2/extensions/:baseId'])
  // 需要 extensionList 权限
  @Acl('extensionList')
  async extensionList(
    // 获取租户上下文
    @TenantContext() context: NcContext,
    // 获取路径参数 baseId
    @Param('baseId') baseId: string,
    // 获取请求对象
    @Req() _req: NcRequest,
  ) {
    // 返回分页响应
    return new PagedResponseImpl(
      await this.extensionsService.extensionList(context, { baseId }),
    );
  }

  // 创建新的扩展
  @Post(['/api/v2/extensions/:baseId'])
  // 需要 extensionCreate 权限
  @Acl('extensionCreate')
  async extensionCreate(
    // 获取租户上下文
    @TenantContext() context: NcContext,
    // 获取路径参数 baseId
    @Param('baseId') baseId: string,
    // 获取请求体数据
    @Body() body: Partial<ExtensionReqType>,
    // 获取请求对象
    @Req() req: NcRequest,
  ) {
    // 调用服务创建扩展
    return await this.extensionsService.extensionCreate(context, {
      extension: {
        ...body,
        base_id: baseId,
      },
      req,
    });
  }

  // 读取指定扩展的详细信息
  @Get(['/api/v2/extensions/:extensionId'])
  // 需要 extensionRead 权限
  @Acl('extensionRead')
  async extensionRead(
    // 获取租户上下文
    @TenantContext() context: NcContext,
    // 获取路径参数 extensionId
    @Param('extensionId') extensionId: string,
  ) {
    // 调用服务读取扩展信息
    return await this.extensionsService.extensionRead(context, { extensionId });
  }

  // 更新指定扩展的信息
  @Patch(['/api/v2/extensions/:extensionId'])
  // 需要 extensionUpdate 权限
  @Acl('extensionUpdate')
  async extensionUpdate(
    // 获取租户上下文
    @TenantContext() context: NcContext,
    // 获取路径参数 extensionId
    @Param('extensionId') extensionId: string,
    // 获取请求体数据
    @Body() body: Partial<ExtensionReqType>,
    // 获取请求对象
    @Req() req: NcRequest,
  ) {
    // 调用服务更新扩展信息
    return await this.extensionsService.extensionUpdate(context, {
      extensionId,
      extension: body,
      req,
    });
  }

  // 删除指定的扩展
  @Delete(['/api/v2/extensions/:extensionId'])
  // 需要 extensionDelete 权限
  @Acl('extensionDelete')
  async extensionDelete(
    // 获取租户上下文
    @TenantContext() context: NcContext,
    // 获取路径参数 extensionId
    @Param('extensionId') extensionId: string,
    // 获取请求对象
    @Req() req: NcRequest,
  ) {
    // 调用服务删除扩展
    return await this.extensionsService.extensionDelete(context, {
      extensionId,
      req,
    });
  }
}
