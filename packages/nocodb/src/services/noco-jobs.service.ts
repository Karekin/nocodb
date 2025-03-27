// 导入所需的 NestJS 装饰器和工具
import { Inject, Injectable, Logger } from '@nestjs/common';
// 导入 Bull 队列的任务选项类型
import type { JobOptions } from 'bull';
// 导入任务服务接口
import { IJobsService } from '~/modules/jobs/jobs-service.interface';

// 标记该类为可注入的服务
@Injectable()
export class NocoJobsService {
  // 创建日志记录器实例，使用当前类名作为日志标识
  protected logger = new Logger(NocoJobsService.name);

  // 构造函数，注入任务服务实现
  constructor(
    @Inject('JobsService') private readonly jobsService: IJobsService,
  ) {}

  // 获取任务队列实例的 getter 方法
  get jobsQueue() {
    return this.jobsService.jobsQueue;
  }

  // 添加新任务到队列
  // @param name - 任务名称
  // @param data - 任务数据
  // @param options - Bull 队列的任务配置选项
  async add(name: string, data: any, options?: JobOptions) {
    return this.jobsService.add(name, data, options);
  }

  // 根据任务 ID 获取特定任务
  // @param jobId - 任务唯一标识
  async getJob(jobId: string) {
    return this.jobsQueue.getJob(jobId);
  }

  // 获取指定任务的状态
  // @param jobId - 任务唯一标识
  async getJobStatus(jobId: string) {
    return this.jobsService.jobStatus(jobId);
  }

  // 获取任务列表
  async getJobList() {
    return this.jobsService.jobList();
  }

  // 暂停任务队列
  async pauseQueue() {
    return this.jobsService.pauseQueue();
  }

  // 恢复任务队列
  async resumeQueue() {
    return this.jobsService.resumeQueue();
  }

  // 切换任务队列状态（暂停/恢复）
  async toggleQueue() {
    return this.jobsService.toggleQueue();
  }
}
