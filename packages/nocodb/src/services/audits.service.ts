// 导入 NestJS 的 Injectable 装饰器，用于声明该服务可被依赖注入
import { Injectable } from '@nestjs/common';
// 导入应用钩子监听服务，用于处理应用程序钩子事件
import { AppHooksListenerService } from '~/services/app-hooks-listener.service';
// 导入 Audit 模型，用于处理审计相关的数据操作
import { Audit } from '~/models';
// 导入应用钩子服务，用于管理应用程序钩子
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';

// 使用 Injectable 装饰器标记该类为可注入的服务
@Injectable()
// 定义审计服务类，用于处理系统中的审计相关功能
export class AuditsService {
  // 构造函数，通过依赖注入接收所需的服务
  constructor(
    // 注入应用钩子监听服务
    protected readonly appHooksListenerService: AppHooksListenerService,
    // 注入应用钩子服务
    protected readonly appHooksService: AppHooksService,
  ) {}

  // 获取特定行和模型的审计列表
  async auditOnlyList(param: {
    // 定义查询参数的类型
    query: {
      // 行ID
      row_id: string;
      // 外键模型ID
      fk_model_id: string;
      // 可选的限制条数
      limit?: string | number;
      // 可选的偏移量
      offset?: string | number;
    };
  }) {
    // 调用 Audit 模型的 auditList 方法并返回结果
    return await Audit.auditList(param.query);
  }

  // 获取特定行和模型的审计记录数量
  async auditOnlyCount(param: {
    // 定义可选的查询参数类型
    query?: {
      // 行ID
      row_id: string;
      // 外键模型ID
      fk_model_id: string;
    };
  }) {
    // 调用 Audit 模型的 auditCount 方法并返回结果
    return await Audit.auditCount({
      // 传递外键模型ID
      fk_model_id: param.query.fk_model_id,
      // 传递行ID
      row_id: param.query.row_id,
    });
  }

  // 获取特定基础(base)的审计列表
  async auditList(param: { query: any; baseId: string }) {
    // 调用 Audit 模型的 baseAuditList 方法并返回结果
    return await Audit.baseAuditList(param.baseId, param.query);
  }

  // 获取特定基础(base)的审计记录数量
  async auditCount(param: { query?: any; baseId: string }) {
    // 调用 Audit 模型的 baseAuditCount 方法并返回结果
    return await Audit.baseAuditCount(param.baseId, param.query);
  }

  // 获取特定数据源的审计列表
  async sourceAuditList(param: { query: any; sourceId: any }) {
    // 调用 Audit 模型的 sourceAuditList 方法并返回结果
    return await Audit.sourceAuditList(param.sourceId, param.query);
  }

  // 获取特定数据源的审计记录数量
  async sourceAuditCount(param: { query: any; sourceId: string }) {
    // 调用 Audit 模型的 sourceAuditCount 方法并返回结果
    return await Audit.sourceAuditCount(param.sourceId);
  }

  // 获取项目的审计列表
  async projectAuditList(param: { query: any }) {
    // 调用 Audit 模型的 projectAuditList 方法并返回结果
    return await Audit.projectAuditList(param.query);
  }

  // 获取项目的审计记录数量
  async projectAuditCount() {
    // 调用 Audit 模型的 projectAuditCount 方法并返回结果
    return await Audit.projectAuditCount();
  }
}
