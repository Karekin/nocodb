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
// 导入 Hook 相关的请求类型
import { HookReqType, HookTestReqType } from 'nocodb-sdk';
// 导入 Hook 类型定义
import type { HookType } from 'nocodb-sdk';
// 导入全局守卫
import { GlobalGuard } from '~/guards/global/global.guard';
// 导入分页响应实现类
import { PagedResponseImpl } from '~/helpers/PagedResponse';
// 导入 Hooks 服务
import { HooksService } from '~/services/hooks.service';
// 导入访问控制中间件
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
// 导入 Meta API 限制器守卫
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
// 导入租户上下文装饰器
import { TenantContext } from '~/decorators/tenant-context.decorator';
// 导入上下文和请求接口定义
import { NcContext, NcRequest } from '~/interface/config';

// 声明控制器
@Controller()
// 使用 Meta API 限制器守卫和全局守卫
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class HooksController {
  // 构造函数，注入 HooksService
  constructor(private readonly hooksService: HooksService) {}

  // 获取指定表的所有 hooks 列表
  @Get([
    '/api/v1/db/meta/tables/:tableId/hooks',
    '/api/v2/meta/tables/:tableId/hooks',
  ])
  // 使用 hookList 访问控制
  @Acl('hookList')
  async hookList(
    // 获取租户上下文
    @TenantContext() context: NcContext,
    // 获取表 ID 参数
    @Param('tableId') tableId: string,
  ) {
    return new PagedResponseImpl(
      await this.hooksService.hookList(context, { tableId }),
    );
  }

  // 为指定表创建新的 hook
  @Post([
    '/api/v1/db/meta/tables/:tableId/hooks',
    '/api/v2/meta/tables/:tableId/hooks',
  ])
  // 设置 HTTP 状态码为 200
  @HttpCode(200)
  // 使用 hookCreate 访问控制
  @Acl('hookCreate')
  async hookCreate(
    // 获取租户上下文
    @TenantContext() context: NcContext,
    // 获取表 ID 参数
    @Param('tableId') tableId: string,
    // 获取请求体
    @Body() body: HookReqType,
    // 获取请求对象
    @Req() req: NcRequest,
  ) {
    const hook = await this.hooksService.hookCreate(context, {
      hook: body,
      tableId,
      req,
    });
    return hook;
  }

  // 删除指定的 hook
  @Delete(['/api/v1/db/meta/hooks/:hookId', '/api/v2/meta/hooks/:hookId'])
  // 使用 hookDelete 访问控制
  @Acl('hookDelete')
  async hookDelete(
    // 获取租户上下文
    @TenantContext() context: NcContext,
    // 获取 hook ID 参数
    @Param('hookId') hookId: string,
    // 获取请求对象
    @Req() req: NcRequest,
  ) {
    return await this.hooksService.hookDelete(context, { hookId, req });
  }

  // 更新指定的 hook
  @Patch(['/api/v1/db/meta/hooks/:hookId', '/api/v2/meta/hooks/:hookId'])
  // 使用 hookUpdate 访问控制
  @Acl('hookUpdate')
  async hookUpdate(
    // 获取租户上下文
    @TenantContext() context: NcContext,
    // 获取 hook ID 参数
    @Param('hookId') hookId: string,
    // 获取请求体
    @Body() body: HookReqType,
    // 获取请求对象
    @Req() req: NcRequest,
  ) {
    return await this.hooksService.hookUpdate(context, {
      hookId,
      hook: body,
      req,
    });
  }

  // 测试指定表的 hook
  @Post([
    '/api/v1/db/meta/tables/:tableId/hooks/test',
    '/api/v2/meta/tables/:tableId/hooks/test',
  ])
  // 设置 HTTP 状态码为 200
  @HttpCode(200)
  // 使用 hookTest 访问控制
  @Acl('hookTest')
  async hookTest(
    // 获取租户上下文
    @TenantContext() context: NcContext,
    // 获取请求体
    @Body() body: HookTestReqType,
    // 获取请求对象
    @Req() req: NcRequest,
  ) {
    try {
      await this.hooksService.hookTest(context, {
        hookTest: {
          ...body,
          payload: {
            ...body.payload,
            user: (req as any)?.user,
          },
        },
        tableId: req.params.tableId,
        req,
      });
      return { msg: 'The hook has been tested successfully' };
    } catch (e) {
      console.error(e);
      throw e;
    }
  }

  // 获取指定表的示例 payload 数据
  @Get([
    '/api/v1/db/meta/tables/:tableId/hooks/samplePayload/:operation/:version',
    '/api/v2/meta/tables/:tableId/hooks/samplePayload/:operation/:version',
  ])
  // 使用 tableSampleData 访问控制
  @Acl('tableSampleData')
  async tableSampleData(
    // 获取租户上下文
    @TenantContext() context: NcContext,
    // 获取表 ID 参数
    @Param('tableId') tableId: string,
    // 获取操作类型参数
    @Param('operation') operation: HookType['operation'],
    // 获取版本参数
    @Param('version') version: HookType['version'],
  ) {
    return await this.hooksService.tableSampleData(context, {
      tableId,
      operation,
      version,
    });
  }

  // 获取指定 hook 的日志列表
  @Get([
    '/api/v1/db/meta/hooks/:hookId/logs',
    '/api/v2/meta/hooks/:hookId/logs',
  ])
  // 使用 hookLogList 访问控制
  @Acl('hookLogList')
  async hookLogList(
    // 获取租户上下文
    @TenantContext() context: NcContext,
    // 获取 hook ID 参数
    @Param('hookId') hookId: string,
    // 获取请求对象
    @Req() req: NcRequest,
  ) {
    return new PagedResponseImpl(
      await this.hooksService.hookLogList(context, {
        query: req.query,
        hookId,
      }),
      {
        ...req.query,
        count: await this.hooksService.hookLogCount(context, {
          hookId,
        }),
      },
    );
  }

  // 手动触发指定 hook
  @Post(['/api/v2/meta/hooks/:hookId/trigger/:rowId'])
  // 使用 hookTrigger 访问控制
  @Acl('hookTrigger')
  async hookTrigger(
    // 获取租户上下文
    @TenantContext() context: NcContext,
    // 获取 hook ID 参数
    @Param('hookId') hookId: string,
    // 获取行 ID 参数
    @Param('rowId') rowId: string,
    // 获取请求对象
    @Req() req: NcRequest,
  ) {
    return await this.hooksService.hookTrigger(context, {
      hookId,
      req,
      rowId,
    });
  }
}
