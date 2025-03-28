// 导入所需的 NestJS 装饰器和类型
import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
// 导入作业状态和类型的类型定义
import type { JobStatus, JobTypes } from '~/interface/Jobs';
// 导入全局守卫
import { GlobalGuard } from '~/guards/global/global.guard';
// 导入访问控制中间件
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
// 导入 Meta API 限制器守卫
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
// 导入租户上下文装饰器
import { TenantContext } from '~/decorators/tenant-context.decorator';
// 导入上下文和请求接口定义
import { NcContext, NcRequest } from '~/interface/config';
// 导入作业元数据服务
import { JobsMetaService } from '~/services/jobs-meta.service';

// 声明这是一个控制器类
@Controller()
// 使用 Meta API 限制器守卫和全局守卫来保护该控制器
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class JobsMetaController {
  // 构造函数，注入作业元数据服务
  constructor(private readonly jobsMetaService: JobsMetaService) {}

  // 定义 POST 请求路由，处理作业列表获取
  @Post(['/api/v2/jobs/:baseId'])
  // 使用访问控制装饰器，限制对 jobList 的访问
  @Acl('jobList')
  async jobList(
    // 注入租户上下文
    @TenantContext() context: NcContext,
    // 注入请求对象
    @Req() req: NcRequest,
    // 注入请求体，包含可选的筛选条件
    @Body()
    conditions?: {
      // 可选的作业类型筛选
      job?: JobTypes;
      // 可选的作业状态筛选
      status?: JobStatus;
    },
  ) {
    // 调用服务层方法获取作业列表
    return await this.jobsMetaService.list(context, conditions, req);
  }
}
