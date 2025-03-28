// 从 @nestjs/common 导入所需的装饰器和类型
import { Body, Controller, Param, Patch, Req, UseGuards } from '@nestjs/common';
// 导入全局守卫
import { GlobalGuard } from '~/guards/global/global.guard';
// 导入表单列服务
import { FormColumnsService } from '~/services/form-columns.service';
// 导入访问控制中间件
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
// 导入 Meta API 限制器守卫
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
// 导入租户上下文装饰器
import { TenantContext } from '~/decorators/tenant-context.decorator';
// 导入上下文和请求接口类型
import { NcContext, NcRequest } from '~/interface/config';

// 定义表单列更新请求类型（当前为空类）
class FormColumnUpdateReqType {}

// 声明这是一个控制器类
@Controller()
// 使用 MetaApiLimiterGuard 和 GlobalGuard 作为守卫
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class FormColumnsController {
  // 构造函数，注入 FormColumnsService 服务
  constructor(private readonly formColumnsService: FormColumnsService) {}

  // 定义 PATCH 请求路由，支持 v1 和 v2 两个版本的 API
  @Patch([
    '/api/v1/db/meta/form-columns/:formViewColumnId',
    '/api/v2/meta/form-columns/:formViewColumnId',
  ])
  // 设置访问控制权限为 formViewUpdate
  @Acl('formViewUpdate')
  // 定义列更新方法
  async columnUpdate(
    // 获取租户上下文
    @TenantContext() context: NcContext,
    // 获取表单视图列 ID 参数
    @Param('formViewColumnId') formViewColumnId: string,
    // 获取请求体数据
    @Body() formViewColumnbody: FormColumnUpdateReqType,
    // 获取请求对象
    @Req() req: NcRequest,
  ) {
    // 调用服务层的 columnUpdate 方法并返回结果
    return await this.formColumnsService.columnUpdate(context, {
      formViewColumnId,
      formViewColumn: formViewColumnbody,
      req,
    });
  }
}
