// 导入 NestJS 的依赖注入和日志模块
import { Injectable, Logger } from '@nestjs/common';
// 导入应用事件枚举
import { AppEvents } from 'nocodb-sdk';
// 导入 NestJS 生命周期接口类型
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
// 导入事件接口类型
import type {
  MetaDiffEvent,
  UserInviteEvent,
  UserSignupEvent,
} from '~/services/app-hooks/interfaces';
// 导入工具类
import { T } from '~/utils';
// 导入审计模型
import { Audit } from '~/models';
// 导入遥测服务
import { TelemetryService } from '~/services/telemetry.service';
// 导入应用钩子服务
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';

// 使用 Injectable 装饰器标记该服务可被依赖注入
@Injectable()
// 定义应用钩子监听服务类，实现模块初始化和销毁接口
export class AppHooksListenerService implements OnModuleInit, OnModuleDestroy {
  // 定义取消订阅函数
  protected unsubscribe: () => void;
  // 创建日志记录器实例
  protected logger = new Logger(AppHooksListenerService.name);

  // 构造函数，注入依赖服务
  constructor(
    // 注入应用钩子服务
    protected readonly appHooksService: AppHooksService,
    // 注入遥测服务
    protected readonly telemetryService: TelemetryService,
  ) {}

  // 定义钩子处理函数，处理各种应用事件
  protected async hookHandler({
    event,
    data,
  }: {
    event: AppEvents;
    data: any;
  }) {
    // 从数据中解构请求和客户端ID
    const { req, clientId } = data;
    // 根据事件类型进行不同处理
    switch (event) {
      // 用户登录事件
      case AppEvents.USER_SIGNIN:
        break;
      // 用户登出事件
      case AppEvents.USER_SIGNOUT:
        break;
      // 用户注册事件
      case AppEvents.USER_SIGNUP:
        {
          // 将数据转换为用户注册事件类型
          const param = data as UserSignupEvent;

          // 将用户分配给请求对象（因为这是自事件）
          param.req.user = param.user;

          // 发送遥测事件
          this.telemetryService.sendEvent({
            evt_type: 'a:signup',
            req,
            clientId,
            email: param.user?.email,
          });
        }
        break;
      // 用户邀请事件
      case AppEvents.USER_INVITE:
        {
          // 将数据转换为用户邀请事件类型
          const param = data as UserInviteEvent;

          // 发送遥测事件
          this.telemetryService.sendEvent({
            evt_type: 'a:signup',
            req,
            clientId,
            email: param.user?.email,
          });
        }
        break;
      // 用户更新事件
      case AppEvents.USER_UPDATE:
        break;
      // 用户密码更改事件
      case AppEvents.USER_PASSWORD_CHANGE:
        break;
      // 用户忘记密码事件
      case AppEvents.USER_PASSWORD_FORGOT:
        break;
      // 用户删除事件
      case AppEvents.USER_DELETE:
        break;
      // 用户密码重置事件
      case AppEvents.USER_PASSWORD_RESET:
        break;
      // 用户邮箱验证事件
      case AppEvents.USER_EMAIL_VERIFICATION:
        break;
      // 项目邀请事件
      case AppEvents.PROJECT_INVITE:
        break;
      // 项目用户更新事件
      case AppEvents.PROJECT_USER_UPDATE:
        break;
      // 项目用户重新发送邀请事件
      case AppEvents.PROJECT_USER_RESEND_INVITE:
        break;
      // 表格创建事件
      case AppEvents.TABLE_CREATE:
        break;
      // 表格删除事件
      case AppEvents.TABLE_DELETE:
        break;
      // 表格更新事件
      case AppEvents.TABLE_UPDATE:
        break;
      // 视图创建事件
      case AppEvents.VIEW_CREATE:
        break;
      // 视图删除事件
      case AppEvents.VIEW_DELETE:
        break;
      // 列创建事件
      case AppEvents.COLUMN_CREATE:
        break;
      // 列更新事件
      case AppEvents.COLUMN_UPDATE:
        break;
      // 数据创建事件
      case AppEvents.DATA_CREATE:
        break;
      // 数据删除事件
      case AppEvents.DATA_DELETE:
        break;
      // 数据更新事件
      case AppEvents.DATA_UPDATE:
        break;
      // 列删除事件
      case AppEvents.COLUMN_DELETE:
        break;
      // 元数据差异同步事件
      case AppEvents.META_DIFF_SYNC:
        {
          // 将数据转换为元数据差异事件类型
          const param = data as MetaDiffEvent;

          // 根据是否有源参数发送不同的遥测事件
          if (param.source) {
            this.telemetryService.sendEvent({
              evt_type: 'a:baseMetaDiff:synced',
              req,
              clientId,
            });
          } else {
            this.telemetryService.sendEvent({
              evt_type: 'a:metaDiff:synced',
              req,
              clientId,
            });
          }
        }
        break;
      // 组织用户邀请事件
      case AppEvents.ORG_USER_INVITE:
        break;
      // 组织用户重新发送邀请事件
      case AppEvents.ORG_USER_RESEND_INVITE:
        break;
      // 视图列更新事件
      case AppEvents.VIEW_COLUMN_UPDATE:
        break;
      // 图片上传事件
      case AppEvents.IMAGE_UPLOAD:
        break;
      // 表单列更新事件
      case AppEvents.FORM_COLUMN_UPDATE:
        break;

      // 项目创建事件
      case AppEvents.PROJECT_CREATE:
        break;

      // 项目更新事件
      case AppEvents.PROJECT_UPDATE:
        break;
      // 项目克隆事件
      case AppEvents.PROJECT_CLONE:
        break;
      // 欢迎事件
      case AppEvents.WELCOME:
        break;
      // 工作区创建事件
      case AppEvents.WORKSPACE_CREATE:
        break;
      // 工作区删除事件
      case AppEvents.WORKSPACE_DELETE:
        break;
      // 工作区更新事件
      case AppEvents.WORKSPACE_UPDATE:
        break;

      // 项目删除事件
      case AppEvents.PROJECT_DELETE:
        break;

      // 网格创建事件
      case AppEvents.GRID_CREATE:
        break;
      // 网格列更新事件
      case AppEvents.GRID_COLUMN_UPDATE:
        break;
      // 网格删除事件
      case AppEvents.GRID_DELETE:
        break;
      // 网格复制事件
      case AppEvents.GRID_DUPLICATE:
        break;
      // 表单创建事件
      case AppEvents.FORM_CREATE:
        break;
      // 表单更新事件、网格更新事件、日历更新事件、画廊更新事件、看板更新事件、视图更新事件
      case AppEvents.FORM_UPDATE:
      case AppEvents.GRID_UPDATE:
      case AppEvents.CALENDAR_UPDATE:
      case AppEvents.GALLERY_UPDATE:
      case AppEvents.KANBAN_UPDATE:
      case AppEvents.VIEW_UPDATE:
        break;
      // 表单删除事件
      case AppEvents.FORM_DELETE:
        break;
      // 看板创建事件
      case AppEvents.KANBAN_CREATE:
        break;
      // 看板删除事件
      case AppEvents.KANBAN_DELETE:
        break;
      // 画廊创建事件
      case AppEvents.GALLERY_CREATE:
        break;
      // 画廊删除事件
      case AppEvents.GALLERY_DELETE:
        break;
      // 日历创建事件
      case AppEvents.CALENDAR_CREATE:
        break;
      // 日历删除事件
      case AppEvents.CALENDAR_DELETE:
        break;

      // 过滤器创建事件
      case AppEvents.FILTER_CREATE:
        break;
      // 过滤器更新事件
      case AppEvents.FILTER_UPDATE:
        break;
      // 过滤器删除事件
      case AppEvents.FILTER_DELETE:
        break;

      // Webhook创建事件
      case AppEvents.WEBHOOK_CREATE:
        break;
      // Webhook更新事件
      case AppEvents.WEBHOOK_UPDATE:
        break;

      // Webhook删除事件
      case AppEvents.WEBHOOK_DELETE:
        break;

      // 排序创建事件
      case AppEvents.SORT_CREATE:
        break;

      // 排序更新事件
      case AppEvents.SORT_UPDATE:
        break;

      // 排序删除事件
      case AppEvents.SORT_DELETE:
        break;

      // API令牌创建事件、组织API令牌创建事件
      case AppEvents.API_TOKEN_CREATE:
      case AppEvents.ORG_API_TOKEN_CREATE:
        break;

      // 插件测试事件
      case AppEvents.PLUGIN_TEST:
        break;
      // 插件安装事件
      case AppEvents.PLUGIN_INSTALL:
        break;
      // 插件卸载事件
      case AppEvents.PLUGIN_UNINSTALL:
        break;
      // 同步源创建事件
      case AppEvents.SYNC_SOURCE_CREATE:
        break;
      // 同步源更新事件
      case AppEvents.SYNC_SOURCE_UPDATE:
        break;
      // 同步源删除事件
      case AppEvents.SYNC_SOURCE_DELETE:
        break;
      // 关系删除事件
      case AppEvents.RELATION_DELETE:
        break;
      // 关系创建事件
      case AppEvents.RELATION_CREATE:
        break;

      // API令牌删除事件、组织API令牌删除事件
      case AppEvents.API_TOKEN_DELETE:
      case AppEvents.ORG_API_TOKEN_DELETE:
        break;

      // 共享视图创建事件
      case AppEvents.SHARED_VIEW_CREATE:
        break;

      // 共享视图更新事件
      case AppEvents.SHARED_VIEW_UPDATE:
        break;

      // 共享视图删除事件
      case AppEvents.SHARED_VIEW_DELETE:
        break;

      // 共享基础生成链接事件
      case AppEvents.SHARED_BASE_GENERATE_LINK:
        break;
      // 共享基础删除链接事件
      case AppEvents.SHARED_BASE_DELETE_LINK:
        break;
      // 附件上传事件
      case AppEvents.ATTACHMENT_UPLOAD:
        break;
      // API创建事件
      case AppEvents.APIS_CREATED:
        break;
      // 扩展创建事件
      case AppEvents.EXTENSION_CREATE:
        break;
      // 扩展更新事件
      case AppEvents.EXTENSION_UPDATE:
        break;
      // 扩展删除事件
      case AppEvents.EXTENSION_DELETE:
        break;
      // 评论创建事件
      case AppEvents.COMMENT_CREATE:
        break;
      // 评论删除事件
      case AppEvents.COMMENT_DELETE:
        break;
      // 评论更新事件
      case AppEvents.COMMENT_UPDATE:
        break;
      // 集成删除事件
      case AppEvents.INTEGRATION_DELETE:
        break;
      // 集成创建事件
      case AppEvents.INTEGRATION_CREATE:
        break;
      // 集成更新事件
      case AppEvents.INTEGRATION_UPDATE:
        break;
      // 行用户提及事件
      case AppEvents.ROW_USER_MENTION:
        break;

      // 源创建事件
      case AppEvents.SOURCE_CREATE:
        break;

      // 源更新事件
      case AppEvents.SOURCE_UPDATE:
        break;

      // 源删除事件
      case AppEvents.SOURCE_DELETE:
        break;

      // 基础复制开始事件、基础复制失败事件
      case AppEvents.BASE_DUPLICATE_START:
      case AppEvents.BASE_DUPLICATE_FAIL:
        break;

      // 表格复制开始事件、表格复制失败事件
      case AppEvents.TABLE_DUPLICATE_START:
      case AppEvents.TABLE_DUPLICATE_FAIL:
        break;
      // 列复制开始事件、列复制失败事件
      case AppEvents.COLUMN_DUPLICATE_START:
      case AppEvents.COLUMN_DUPLICATE_FAIL:
        break;
      // 视图复制开始事件、视图复制失败事件
      case AppEvents.VIEW_DUPLICATE_START:
      case AppEvents.VIEW_DUPLICATE_FAIL:
        break;

      // UI访问控制列表事件
      case AppEvents.UI_ACL:
        break;
    }
  }

  // 模块销毁时执行的方法，取消事件订阅
  onModuleDestroy(): any {
    this.unsubscribe?.();
  }

  // 模块初始化时执行的方法，订阅所有应用钩子事件
  onModuleInit(): any {
    this.unsubscribe = this.appHooksService.onAll(this.hookHandler.bind(this));
  }

  // 审计插入方法，用于记录审计日志
  async auditInsert(param: Partial<Audit>) {
    try {
      // 插入审计记录
      await Audit.insert(param);
      // 触发事件，添加创建时间
      T.event({ ...param, created_at: Date.now() });
    } catch (e) {
      // 记录错误日志
      this.logger.error(e);
    }
  }
}
