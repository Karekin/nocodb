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
// 导入视图创建请求类型
import { ViewCreateReqType } from 'nocodb-sdk';
// 导入全局守卫
import { GlobalGuard } from '~/guards/global/global.guard';
// 导入表单服务
import { FormsService } from '~/services/forms.service';
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
export class FormsController {
  // 构造函数，注入表单服务
  constructor(private readonly formsService: FormsService) {}

  // 获取表单视图的路由处理器（支持 v1 和 v2 API）
  @Get(['/api/v1/db/meta/forms/:formViewId', '/api/v2/meta/forms/:formViewId'])
  // 使用访问控制装饰器
  @Acl('formViewGet')
  async formViewGet(
    // 注入租户上下文
    @TenantContext() context: NcContext,
    // 获取路由参数中的表单视图 ID
    @Param('formViewId') formViewId: string,
  ) {
    // 调用服务获取表单视图数据
    const formViewData = await this.formsService.formViewGet(context, {
      formViewId,
    });
    return formViewData;
  }

  // 创建表单视图的路由处理器（支持 v1 和 v2 API）
  @Post([
    '/api/v1/db/meta/tables/:tableId/forms',
    '/api/v2/meta/tables/:tableId/forms',
  ])
  // 设置 HTTP 状态码为 200
  @HttpCode(200)
  // 使用访问控制装饰器
  @Acl('formViewCreate')
  async formViewCreate(
    // 注入租户上下文
    @TenantContext() context: NcContext,
    // 获取路由参数中的表格 ID
    @Param('tableId') tableId: string,
    // 获取请求体数据
    @Body() body: ViewCreateReqType,
    // 获取请求对象
    @Req() req: NcRequest,
  ) {
    // 调用服务创建表单视图
    const view = await this.formsService.formViewCreate(context, {
      body,
      tableId,
      user: req.user,
      req,
    });
    return view;
  }

  // 更新表单视图的路由处理器（支持 v1 和 v2 API）
  @Patch([
    '/api/v1/db/meta/forms/:formViewId',
    '/api/v2/meta/forms/:formViewId',
  ])
  // 使用访问控制装饰器
  @Acl('formViewUpdate')
  async formViewUpdate(
    // 注入租户上下文
    @TenantContext() context: NcContext,
    // 获取路由参数中的表单视图 ID
    @Param('formViewId') formViewId: string,
    // 获取请求体数据
    @Body() body,
    // 获取请求对象
    @Req() req: NcRequest,
  ) {
    // 调用服务更新表单视图
    return await this.formsService.formViewUpdate(context, {
      formViewId,
      form: body,
      req,
    });
  }
}
