// 导入 NestJS 的 Injectable 装饰器，用于声明该服务可被依赖注入
import { Injectable } from '@nestjs/common';
// 导入 dayjs 库，用于日期时间处理
import dayjs from 'dayjs';
// 导入 NcContext 和 NcRequest 类型定义
import type { NcContext, NcRequest } from '~/interface/config';
// 导入 JobTypes 类型定义
import type { JobTypes } from '~/interface/Jobs';
// 导入 JobStatus 枚举，用于表示任务状态
import { JobStatus } from '~/interface/Jobs';
// 导入 Job 模型
import { Job } from '~/models';
// 导入 Noco 类
import Noco from '~/Noco';

// 使用 Injectable 装饰器标记该类为可注入服务
@Injectable()
// 定义 JobsMetaService 类，用于处理任务元数据相关操作
export class JobsMetaService {
  // 构造函数，目前没有依赖注入
  constructor() {}

  // 列出任务的异步方法
  // 参数：context - NcContext 上下文对象
  //      param - 包含可选的 job 和 status 过滤条件
  //      req - NcRequest 请求对象
  async list(
    context: NcContext,
    param: { job?: JobTypes; status?: JobStatus },
    req: NcRequest,
  ) {
    /*
     * List jobs for the current base.
     * If the job is not created by the current user, exclude the result.
     * List jobs updated in the last 1 hour or jobs that are still active(, waiting, or delayed).
     */
    // 调用 Job 模型的 list 方法获取任务列表
    return Job.list(context, {
      // 设置查询条件
      xcCondition: {
        // 使用 _and 操作符组合多个条件
        _and: [
          // 如果提供了 job 参数，添加 job 等于指定值的条件
          ...(param.job
            ? [
                {
                  job: {
                    eq: param.job,
                  },
                },
              ]
            : []),
          // 如果提供了 status 参数，添加 status 等于指定值的条件
          ...(param.status
            ? [
                {
                  status: {
                    eq: param.status,
                  },
                },
              ]
            : []),
          // 添加时间或状态相关的条件
          {
            // 使用 _or 操作符表示满足以下任一条件即可
            _or: [
              // 条件1：更新时间在过去1小时内
              {
                updated_at: {
                  gt: Noco.ncMeta.formatDateTime(
                    dayjs().subtract(1, 'hour').toISOString(),
                  ),
                },
              },
              // 条件2：状态为 ACTIVE（活跃）
              {
                status: {
                  eq: JobStatus.ACTIVE,
                },
              },
              // 条件3：状态为 WAITING（等待中）
              {
                status: {
                  eq: JobStatus.WAITING,
                },
              },
              // 条件4：状态为 DELAYED（延迟）
              {
                status: {
                  eq: JobStatus.DELAYED,
                },
              },
            ],
          },
        ],
      },
      // 处理查询结果
    }).then((jobs) => {
      // 遍历任务列表并处理每个任务
      return jobs.map((job) => {
        // 如果任务是当前用户创建的，返回完整任务信息
        if (job.fk_user_id === req.user.id) {
          return job;
        } else {
          // 如果任务不是当前用户创建的，排除 result 字段后返回其余信息
          const { result, ...rest } = job;
          return rest;
        }
      });
    });
  }
}
