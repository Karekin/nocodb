// 导入 NestJS 的依赖注入和服务装饰器
import { Inject, Injectable } from '@nestjs/common';
// 导入应用事件类型
import { AppEvents } from 'nocodb-sdk';
// 导入视图模型
import View from '../models/View';
// 导入钩子相关的类型定义
import type { HookReqType, HookTestReqType, HookType } from 'nocodb-sdk';
// 导入上下文和请求接口类型
import type { NcContext, NcRequest } from '~/interface/config';
// 导入应用钩子服务
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
// 导入验证负载的辅助函数
import { validatePayload } from '~/helpers';
// 导入错误处理辅助类
import { NcError } from '~/helpers/catchError';
// 导入样本负载填充辅助函数
import {
  populateSamplePayload,
  populateSamplePayloadV2,
} from '~/helpers/populateSamplePayload';
// 导入调用 webhook 的辅助函数
import { invokeWebhook } from '~/helpers/webhookHelpers';
// 导入数据模型
import { ButtonColumn, Hook, HookLog, Model } from '~/models';
// 导入数据服务
import { DatasService } from '~/services/datas.service';
// 导入任务类型
import { JobTypes } from '~/interface/Jobs';
// 导入任务服务接口
import { IJobsService } from '~/modules/jobs/jobs-service.interface';

// 使用 Injectable 装饰器标记该类为可注入的服务
@Injectable()
export class HooksService {
  // 构造函数，注入依赖服务
  constructor(
    // 应用钩子服务
    protected readonly appHooksService: AppHooksService,
    // 数据服务
    protected readonly dataService: DatasService,
    // 使用 Inject 装饰器注入任务服务
    @Inject('JobsService') protected readonly jobsService: IJobsService,
  ) {}

  // 验证钩子负载的方法
  validateHookPayload(notificationJsonOrObject: string | Record<string, any>) {
    // 初始化通知对象
    let notification: { type?: string } = {};
    try {
      // 尝试解析通知对象，如果是字符串则解析为 JSON，否则直接使用
      notification =
        typeof notificationJsonOrObject === 'string'
          ? JSON.parse(notificationJsonOrObject)
          : notificationJsonOrObject;
    } catch {}

    // 如果在云环境中且通知类型不是 URL，则抛出错误
    if (notification.type !== 'URL' && process.env.NC_CLOUD === 'true') {
      NcError.badRequest('Only URL notification is supported');
    }
  }

  // 获取钩子列表的方法
  async hookList(context: NcContext, param: { tableId: string }) {
    // 返回指定表的钩子列表
    return await Hook.list(context, { fk_model_id: param.tableId });
  }

  // 获取钩子日志列表的方法
  async hookLogList(context: NcContext, param: { query: any; hookId: string }) {
    // 返回指定钩子的日志列表
    return await HookLog.list(
      context,
      { fk_hook_id: param.hookId },
      param.query,
    );
  }

  // 创建钩子的方法
  async hookCreate(
    context: NcContext,
    param: {
      tableId: string;
      hook: HookReqType;
      req: NcRequest;
    },
  ) {
    // 验证钩子请求的负载
    validatePayload('swagger.json#/components/schemas/HookReq', param.hook);

    // 验证钩子的通知负载
    this.validateHookPayload(param.hook.notification);

    // 插入钩子记录
    const hook = await Hook.insert(context, {
      ...param.hook,
      fk_model_id: param.tableId,
    } as any);

    // 触发钩子创建事件
    this.appHooksService.emit(AppEvents.WEBHOOK_CREATE, {
      hook,
      req: param.req,
      context,
      tableId: hook.fk_model_id,
    });

    // 返回创建的钩子
    return hook;
  }

  // 删除钩子的方法
  async hookDelete(
    context: NcContext,
    param: { hookId: string; req: NcRequest },
  ) {
    // 获取钩子信息
    const hook = await Hook.get(context, param.hookId);

    // 如果钩子不存在，抛出错误
    if (!hook) {
      NcError.hookNotFound(param.hookId);
    }

    // 获取使用该钩子的按钮列
    const buttonCols = await Hook.hookUsages(context, param.hookId);

    // 如果有按钮列使用该钩子
    if (buttonCols.length) {
      // 遍历按钮列，移除钩子引用
      for (const button of buttonCols) {
        await ButtonColumn.update(context, button.fk_column_id, {
          fk_webhook_id: null,
        });
      }
      // 清除视图缓存
      await View.clearSingleQueryCache(context, hook.fk_model_id);
    }

    // 删除钩子
    await Hook.delete(context, param.hookId);

    // 触发钩子删除事件
    this.appHooksService.emit(AppEvents.WEBHOOK_DELETE, {
      hook,
      req: param.req,
      context,
      tableId: hook.fk_model_id,
    });
    // 返回成功标志
    return true;
  }

  // 更新钩子的方法
  async hookUpdate(
    context: NcContext,
    param: {
      hookId: string;
      hook: HookReqType;
      req: NcRequest;
    },
  ) {
    // 验证钩子请求的负载
    validatePayload('swagger.json#/components/schemas/HookReq', param.hook);

    // 获取钩子信息
    const hook = await Hook.get(context, param.hookId);

    // 如果钩子不存在，抛出错误
    if (!hook) {
      NcError.hookNotFound(param.hookId);
    }

    // 验证钩子的通知负载
    this.validateHookPayload(param.hook.notification);

    // 如果钩子从活动状态变为非活动状态，或者事件类型改变
    if (
      (hook.active && !param.hook.active) ||
      hook.event !== param.hook.event
    ) {
      // 获取使用该钩子的按钮列
      const buttonCols = await Hook.hookUsages(context, param.hookId);
      if (buttonCols.length) {
        // 遍历按钮列，移除钩子引用
        for (const button of buttonCols) {
          await ButtonColumn.update(context, button.fk_column_id, {
            fk_webhook_id: null,
          });
        }
      }
      // 清除视图缓存
      await View.clearSingleQueryCache(context, hook.fk_model_id);
    }

    // 更新钩子
    const res = await Hook.update(context, param.hookId, param.hook);

    // 触发钩子更新事件
    this.appHooksService.emit(AppEvents.WEBHOOK_UPDATE, {
      hook: {
        ...hook,
        ...param.hook,
      },
      oldHook: hook,
      tableId: hook.fk_model_id,
      req: param.req,
      context,
    });

    // 返回更新结果
    return res;
  }

  // 触发钩子的方法
  async hookTrigger(
    context: NcContext,
    param: {
      req: NcRequest;
      hookId: string;
      rowId: string;
    },
  ) {
    // 获取钩子信息
    const hook = await Hook.get(context, param.hookId);

    // 如果钩子不存在或事件类型不是手动，抛出错误
    if (!hook && hook.event !== 'manual') {
      NcError.badRequest('Hook not found');
    }

    // 读取行数据
    const row = await this.dataService.dataRead(context, {
      rowId: param.rowId,
      query: {},
      baseName: hook.base_id,
      tableName: hook.fk_model_id,
    });

    // 如果行不存在，抛出错误
    if (!row) {
      NcError.badRequest('Row not found');
    }

    // 获取模型信息
    const model = await Model.get(context, hook.fk_model_id);

    try {
      // 添加处理 webhook 的任务
      await this.jobsService.add(JobTypes.HandleWebhook, {
        hookId: hook.id,
        modelId: model.id,
        viewId: null,
        prevData: null,
        newData: row,
        user: param.req.user,
        context,
      });
    } catch (e) {
      // 抛出捕获的错误
      throw e;
    } finally {
      /*this.appHooksService.emit(AppEvents.WEBHOOK_TRIGGER, {
        hook,
        req: param.req,
      });*/
    }

    // 返回成功标志
    return true;
  }

  // 测试钩子的方法
  async hookTest(
    context: NcContext,
    param: {
      tableId: string;
      hookTest: HookTestReqType;
      req: NcRequest;
    },
  ) {
    // 验证钩子测试请求的负载
    validatePayload(
      'swagger.json#/components/schemas/HookTestReq',
      param.hookTest,
    );

    // 验证钩子的通知负载
    this.validateHookPayload(param.hookTest.hook?.notification);

    // 获取模型信息
    const model = await Model.getByIdOrName(context, { id: param.tableId });

    // 解构测试参数
    const {
      hook,
      payload: { data, user },
    } = param.hookTest;
    try {
      // 调用 webhook
      await invokeWebhook(context, {
        hook: new Hook(hook),
        model: model,
        view: null,
        prevData: null,
        newData: data.rows,
        user: user,
        testFilters: (hook as any)?.filters,
        throwErrorOnFailure: true,
        testHook: true,
      });
    } catch (e) {
      // 抛出捕获的错误
      throw e;
    } finally {
      // 触发钩子测试事件
      this.appHooksService.emit(AppEvents.WEBHOOK_TEST, {
        hook,
        req: param.req,
        context,
        tableId: hook.fk_model_id,
      });
    }

    // 返回成功标志
    return true;
  }

  // 获取表样本数据的方法
  async tableSampleData(
    context: NcContext,
    param: {
      tableId: string;
      operation: HookType['operation'];
      version: any; // HookType['version'];
    },
  ) {
    // 获取并实例化模型
    const model = new Model(
      await Model.getByIdOrName(context, { id: param.tableId }),
    );

    // 根据版本选择不同的样本负载填充方法
    if (param.version === 'v1') {
      return await populateSamplePayload(
        context,
        model,
        false,
        param.operation,
      );
    }
    return await populateSamplePayloadV2(
      context,
      model,
      false,
      param.operation,
    );
  }

  // 获取钩子日志数量的方法
  async hookLogCount(context: NcContext, param: { hookId: string }) {
    // 返回指定钩子的日志数量
    return await HookLog.count(context, { hookId: param.hookId });
  }
}
