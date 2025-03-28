import { Inject, Injectable, Logger } from '@nestjs/common';
import { UITypes, ViewTypes } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type { FormColumnType, FormType, HookType } from 'nocodb-sdk';
import type { ColumnType } from 'nocodb-sdk';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { transformDataForMailRendering } from '~/helpers/webhookHelpers';
import { IEventEmitter } from '~/modules/event-emitter/event-emitter.interface';
import { Base, FormView, Hook, Model, Source, View } from '~/models';
import { JobTypes } from '~/interface/Jobs';
import { IJobsService } from '~/modules/jobs/jobs-service.interface';
import { MailService } from '~/services/mail/mail.service';
import { MailEvent } from '~/interface/Mail';

// 定义处理webhook的事件名称常量
export const HANDLE_WEBHOOK = '__nc_handleHooks';

/**
 * Hook处理器服务类
 * 负责处理表单提交和webhook事件
 * 实现了OnModuleInit和OnModuleDestroy接口，用于管理事件订阅的生命周期
 */
@Injectable()
export class HookHandlerService implements OnModuleInit, OnModuleDestroy {
  private logger = new Logger(HookHandlerService.name);
  private unsubscribe: () => void;

  constructor(
    @Inject('IEventEmitter') private readonly eventEmitter: IEventEmitter,
    @Inject('JobsService') private readonly jobsService: IJobsService,
    private readonly mailService: MailService,
  ) {}

  /**
   * 处理hooks的主要方法
   * @param context - NcContext上下文对象
   * @param params - 包含hook相关参数的对象
   */
  public async handleHooks(
    context: NcContext,
    { hookName, prevData, newData, user, viewId, modelId },
  ): Promise<void> {
    // 获取视图和模型信息
    const view = await View.get(context, viewId);
    const model = await Model.get(context, modelId);

    // 处理表单视图的数据提交
    // 当hook事件为after.insert或after.bulkInsert，且视图类型为FORM时触发
    if (
      (hookName === 'after.insert' || hookName === 'after.bulkInsert') &&
      view.type === ViewTypes.FORM
    ) {
      try {
        // 获取表单视图信息
        const formView = await view.getView<FormView>(context);

        // 解析并过滤有效的邮箱地址
        const emails = Object.entries(JSON.parse(formView?.email) || {})
          .filter((a) => a[1])
          .map((a) => a[0]);

        if (emails?.length) {
          // 获取表单视图的列信息和所有列
          const { columns } = await FormView.getWithInfo(
            context,
            formView.fk_view_id,
          );
          const allColumns = await model.getColumns(context);

          // 创建列ID到列信息的映射
          const fieldById = columns.reduce(
            (o: Record<string, FormColumnType>, f: FormColumnType) => {
              return Object.assign(o, { [f.fk_column_id]: f });
            },
            {},
          );

          // 处理列的顺序和过滤
          let order = 1;
          const filteredColumns = allColumns
            ?.map((c: ColumnType) => {
              return {
                ...c,
                fk_column_id: c.id,
                fk_view_id: formView.fk_view_id,
                ...(fieldById[c.id] ? fieldById[c.id] : {}),
                order: (fieldById[c.id] && fieldById[c.id].order) || order++,
                id: fieldById[c.id] && fieldById[c.id].id,
              };
            })
            .sort((a: ColumnType, b: ColumnType) => a.order - b.order)
            // 过滤掉不需要显示的列类型
            .filter(
              (f: ColumnType & FormColumnType) =>
                f.show &&
                f.uidt !== UITypes.Rollup &&
                f.uidt !== UITypes.Lookup &&
                f.uidt !== UITypes.Formula &&
                f.uidt !== UITypes.QrCode &&
                f.uidt !== UITypes.Barcode &&
                f.uidt !== UITypes.SpecificDBType &&
                f.uidt !== UITypes.Button,
            )
            .sort((a: ColumnType, b: ColumnType) => a.order - b.order)
            .map((c: ColumnType & FormColumnType) => {
              c.required = !!(c.required || 0);
              return c;
            });

          // 获取数据源和模型信息
          const source = await Source.get(context, model.source_id);
          const models = await source.getModels(context);

          // 创建模型ID到模型信息的映射
          const metas = models.reduce((o, m) => {
            return Object.assign(o, { [m.id]: m });
          }, {});

          // 转换数据用于邮件渲染
          const formattedData = transformDataForMailRendering(
            newData,
            filteredColumns,
            source,
            model,
            metas,
          );

          // 设置表单视图标题并获取基础信息
          formView.title = view.title;
          const base = await Base.get(context, model.base_id);

          // 发送表单提交邮件
          await this.mailService.sendMail({
            mailEvent: MailEvent.FORM_SUBMISSION,
            payload: {
              formView: formView as FormType,
              base,
              emails,
              model,
              data: formattedData,
            },
          });
        }
      } catch (e) {
        // 记录发送表单提交邮件时的错误
        this.logger.error({
          error: e,
          details: 'Error while sending form submission email',
          hookName,
        });
      }
    }

    // 处理webhook事件
    const [event, operation] = hookName.split('.');
    // 获取符合条件的hooks列表
    const hooks = await Hook.list(context, {
      fk_model_id: modelId,
      event: event as HookType['event'],
      operation: operation as HookType['operation'],
    });

    // 遍历并处理每个活跃的hook
    for (const hook of hooks) {
      if (hook.active) {
        try {
          // 添加webhook处理任务到任务队列
          await this.jobsService.add(JobTypes.HandleWebhook, {
            context,
            hookId: hook.id,
            modelId,
            viewId,
            prevData,
            newData,
            user,
          });
        } catch (e) {
          // 记录webhook调用时的错误
          this.logger.error({
            error: e,
            details: 'Error while invoking webhook',
            hook: hook.id,
          });
        }
      }
    }
  }

  /**
   * 模块初始化时订阅webhook处理事件
   */
  onModuleInit(): any {
    this.unsubscribe = this.eventEmitter.on(HANDLE_WEBHOOK, async (arg) => {
      const { context, ...rest } = arg;
      return this.handleHooks(context, rest);
    });
  }

  /**
   * 模块销毁时取消事件订阅
   */
  onModuleDestroy() {
    this.unsubscribe?.();
  }
}
