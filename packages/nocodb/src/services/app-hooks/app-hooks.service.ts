import { Inject, Injectable } from '@nestjs/common';

import { Logger } from '@nestjs/common';
import type { AppEvents } from 'nocodb-sdk';
import type {
  // 导入各种事件类型接口
  ApiCreatedEvent,
  ApiTokenCreateEvent,
  ApiTokenDeleteEvent,
  AttachmentEvent,
  BaseDuplicateEvent,
  CalendarViewUpdateEvent,
  ColumnDuplicateEvent,
  ColumnEvent,
  ColumnUpdateEvent,
  DataExportEvent,
  DataImportEvent,
  FilterEvent,
  FilterUpdateEvent,
  FormColumnEvent,
  FormViewUpdateEvent,
  GalleryViewUpdateEvent,
  GridColumnEvent,
  GridViewUpdateEvent,
  IntegrationUpdateEvent,
  KanbanViewUpdateEvent,
  MetaDiffEvent,
  OrgUserInviteEvent,
  PluginEvent,
  PluginTestEvent,
  ProjectCreateEvent,
  ProjectDeleteEvent,
  ProjectInviteEvent,
  ProjectUpdateEvent,
  ProjectUserResendInviteEvent,
  ProjectUserUpdateEvent,
  RelationEvent,
  RowCommentEvent,
  SharedBaseDeleteEvent,
  SharedBaseEvent,
  SharedViewUpdateEvent,
  SortEvent,
  SortUpdateEvent,
  SourceEvent,
  SourceUpdateEvent,
  SyncSourceEvent,
  TableDuplicateEvent,
  TableEvent,
  TableUpdateEvent,
  UIAclEvent,
  UserEmailVerificationEvent,
  UserInviteEvent,
  UserPasswordChangeEvent,
  UserPasswordForgotEvent,
  UserPasswordResetEvent,
  UserProfileUpdateEvent,
  UserSigninEvent,
  UserSignoutEvent,
  UserSignupEvent,
  ViewColumnEvent,
  ViewColumnUpdateEvent,
  ViewCreateEvent,
  ViewDeleteEvent,
  ViewDuplicateEvent,
  ViewEvent,
  ViewUpdateEvent,
  WebhookEvent,
  WelcomeEvent,
} from '~/services/app-hooks/interfaces';
import type { IntegrationEvent } from '~/services/app-hooks/interfaces';
import type { RowMentionEvent } from '~/services/app-hooks/interfaces';
import type { WebhookUpdateEvent } from '~/services/app-hooks/interfaces';
import type { ProjectUserDeleteEvent } from '~/services/app-hooks/interfaces';
import { IEventEmitter } from '~/modules/event-emitter/event-emitter.interface';

// 定义一个常量，用于表示所有事件的通配符
const ALL_EVENTS = '__nc_all_events__';

// 使用NestJS的Injectable装饰器，标记该服务可被依赖注入系统使用
@Injectable()
export class AppHooksService {
  // 创建一个日志记录器实例
  logger = new Logger('AppHooksService');

  // 存储监听器及其对应的取消订阅函数的映射
  protected listenerUnsubscribers: Map<(...args: any[]) => void, () => void> =
    new Map();

  // 构造函数，注入事件发射器接口
  constructor(
    @Inject('IEventEmitter') protected readonly eventEmitter: IEventEmitter,
  ) {}

  // 以下是各种事件监听方法的重载声明
  // 用于监听评论相关事件
  on(
    event:
      | AppEvents.COMMENT_CREATE
      | AppEvents.COMMENT_UPDATE
      | AppEvents.COMMENT_DELETE,
    listener: (data: RowCommentEvent) => void,
  ): () => void;
  // 用于监听项目邀请事件
  on(
    event: AppEvents.PROJECT_INVITE,
    listener: (data: ProjectInviteEvent) => void,
  ): () => void;
  // 用于监听项目创建事件
  on(
    event: AppEvents.PROJECT_CREATE,
    listener: (data: ProjectCreateEvent) => void,
  ): () => void;
  // 用于监听项目更新事件
  on(
    event: AppEvents.PROJECT_UPDATE,
    listener: (data: ProjectUpdateEvent) => void,
  ): () => void;
  // 用于监听项目删除事件
  on(
    event: AppEvents.PROJECT_DELETE,
    listener: (data: ProjectDeleteEvent) => void,
  ): () => void;
  // 用于监听用户注册事件
  on(
    event: AppEvents.USER_SIGNUP,
    listener: (data: UserSignupEvent) => void,
  ): () => void;
  // 用于监听用户邀请事件
  on(
    event: AppEvents.USER_INVITE,
    listener: (data: UserInviteEvent) => void,
  ): () => void;
  // 用于监听用户登录事件
  on(
    event: AppEvents.USER_SIGNIN,
    listener: (data: UserSigninEvent) => void,
  ): () => void;
  // 用于监听用户登出事件
  on(
    event: AppEvents.USER_SIGNOUT,
    listener: (data: UserSignoutEvent) => void,
  ): () => void;
  // 用于监听欢迎事件
  on(
    event: AppEvents.WELCOME,
    listener: (data: WelcomeEvent) => void,
  ): () => void;
  // 用于监听表格创建和删除事件
  on(
    event: AppEvents.TABLE_CREATE | AppEvents.TABLE_DELETE,
    listener: (data: TableEvent) => void,
  ): () => void;
  // 用于监听表格更新事件
  on(
    event: AppEvents.TABLE_UPDATE,
    listener: (data: TableUpdateEvent) => void,
  ): () => void;
  // 用于监听视图相关事件
  on(
    event:
      | AppEvents.VIEW_UPDATE
      | AppEvents.VIEW_DELETE
      | AppEvents.VIEW_CREATE
      | AppEvents.SHARED_VIEW_DELETE
      | AppEvents.SHARED_VIEW_CREATE,
    listener: (data: ViewEvent) => void,
  ): () => void;

  // 用于监听共享视图更新事件
  on(
    event: AppEvents.SHARED_VIEW_UPDATE,
    listener: (data: SharedViewUpdateEvent) => void,
  ): void;
  // 用于监听过滤器创建和删除事件
  on(
    event: AppEvents.FILTER_DELETE | AppEvents.FILTER_CREATE,
    listener: (data: FilterEvent) => void,
  ): () => void;
  // 用于监听过滤器更新事件
  on(
    event: AppEvents.FILTER_UPDATE,
    listener: (data: FilterUpdateEvent) => void,
  ): () => void;
  // 用于监听排序相关事件
  on(
    event:
      | AppEvents.SORT_UPDATE
      | AppEvents.SORT_DELETE
      | AppEvents.SORT_CREATE,
    listener: (data: SortEvent | SortUpdateEvent) => void,
  ): () => void;
  // 用于监听列相关事件
  on(
    event:
      | AppEvents.COLUMN_UPDATE
      | AppEvents.COLUMN_DELETE
      | AppEvents.COLUMN_CREATE,
    listener: (data: ColumnEvent) => void,
  ): () => void;

  // 用于监听行用户提及事件
  on(
    event: AppEvents.ROW_USER_MENTION,
    listener: (data: RowMentionEvent) => void,
  ): () => void;
  // 用于监听集成相关事件
  on(
    event:
      | AppEvents.INTEGRATION_UPDATE
      | AppEvents.INTEGRATION_DELETE
      | AppEvents.INTEGRATION_CREATE,
    listener: (data: IntegrationEvent) => void,
  ): () => void;
  // on方法的实际实现
  on(event, listener): () => void {
    // 调用事件发射器的on方法注册监听器
    const unsubscribe = this.eventEmitter.on(event, listener);

    // 将监听器和对应的取消订阅函数存储到Map中
    this.listenerUnsubscribers.set(listener, unsubscribe);

    // 返回取消订阅函数
    return unsubscribe;
  }

  // 以下是各种事件发射方法的重载声明
  // 用于发射项目邀请事件
  emit(event: AppEvents.PROJECT_INVITE, data: ProjectInviteEvent): void;
  // 用于发射项目创建事件
  emit(event: AppEvents.PROJECT_CREATE, data: ProjectCreateEvent): void;
  // 用于发射项目删除事件
  emit(event: AppEvents.PROJECT_DELETE, data: ProjectDeleteEvent): void;
  // 用于发射项目更新事件
  emit(event: AppEvents.PROJECT_UPDATE, data: ProjectUpdateEvent): void;
  // 用于发射用户注册事件
  emit(event: AppEvents.USER_SIGNUP, data: UserSignupEvent): void;
  // 用于发射用户登录事件
  emit(event: AppEvents.USER_SIGNIN, data: UserSigninEvent): void;
  // 用于发射用户登出事件
  emit(event: AppEvents.USER_SIGNOUT, data: UserSignoutEvent): void;
  // 用于发射API创建事件
  emit(event: AppEvents.APIS_CREATED, data: ApiCreatedEvent): void;
  // 用于发射用户密码修改事件
  emit(
    event: AppEvents.USER_PASSWORD_CHANGE,
    data: UserPasswordChangeEvent,
  ): void;
  // 用于发射用户忘记密码事件
  emit(
    event: AppEvents.USER_PASSWORD_FORGOT,
    data: UserPasswordForgotEvent,
  ): void;
  // 用于发射用户重置密码事件
  emit(
    event: AppEvents.USER_PASSWORD_RESET,
    data: UserPasswordResetEvent,
  ): void;
  // 用于发射欢迎事件
  emit(event: AppEvents.WELCOME, data: WelcomeEvent): void;
  // 用于发射项目用户更新事件
  emit(
    event: AppEvents.PROJECT_USER_UPDATE,
    data: ProjectUserUpdateEvent,
  ): void;
  // 用于发射项目用户删除事件
  emit(
    event: AppEvents.PROJECT_USER_DELETE,
    data: ProjectUserDeleteEvent,
  ): void;
  // 用于发射项目用户重新邀请事件
  emit(
    event: AppEvents.PROJECT_USER_RESEND_INVITE,
    data: ProjectUserResendInviteEvent,
  ): void;
  // 用于发射共享视图更新事件
  emit(event: AppEvents.SHARED_VIEW_UPDATE, data: SharedViewUpdateEvent): void;
  // 用于发射视图相关事件
  emit(
    event:
      | AppEvents.VIEW_DELETE
      | AppEvents.VIEW_CREATE
      | AppEvents.SHARED_VIEW_UPDATE
      | AppEvents.SHARED_VIEW_DELETE
      | AppEvents.SHARED_VIEW_CREATE,
    data: ViewEvent,
  ): void;
  // 用于发射视图更新事件
  emit(event: AppEvents.VIEW_UPDATE, data: ViewUpdateEvent): void;
  // 用于发射评论相关事件
  emit(
    event:
      | AppEvents.COMMENT_CREATE
      | AppEvents.COMMENT_UPDATE
      | AppEvents.COMMENT_DELETE,
    data: RowCommentEvent,
  ): void;
  // 用于发射过滤器创建和删除事件
  emit(
    event: AppEvents.FILTER_DELETE | AppEvents.FILTER_CREATE,
    data: FilterEvent,
  ): void;
  // 用于发射过滤器更新事件
  emit(event: AppEvents.FILTER_UPDATE, data: FilterUpdateEvent): void;
  // 用于发射表格创建和删除事件
  emit(
    event: AppEvents.TABLE_CREATE | AppEvents.TABLE_DELETE,
    data: TableEvent,
  ): void;
  // 用于发射表格更新事件
  emit(event: AppEvents.TABLE_UPDATE, data: TableUpdateEvent): void;
  // 用于发射排序创建和删除事件
  emit(
    event: AppEvents.SORT_CREATE | AppEvents.SORT_DELETE,
    data: SortEvent,
  ): void;
  // 用于发射排序更新事件
  emit(event: AppEvents.SORT_UPDATE, data: SortUpdateEvent): void;
  // 用于发射列创建和删除事件
  emit(
    event: AppEvents.COLUMN_CREATE | AppEvents.COLUMN_DELETE,
    data: ColumnEvent,
  ): void;
  // 用于发射列更新事件
  emit(event: AppEvents.COLUMN_UPDATE, data: ColumnUpdateEvent): void;
  // 用于发射Webhook相关事件
  emit(
    event:
      | AppEvents.WEBHOOK_CREATE
      | AppEvents.WEBHOOK_DELETE
      | AppEvents.WEBHOOK_TRIGGER
      | AppEvents.WEBHOOK_TEST,
    data: WebhookEvent,
  ): void;
  // 用于发射Webhook更新事件
  emit(event: AppEvents.WEBHOOK_UPDATE, data: WebhookUpdateEvent): void;
  // 用于发射同步源相关事件
  emit(
    event:
      | AppEvents.SYNC_SOURCE_UPDATE
      | AppEvents.SYNC_SOURCE_CREATE
      | AppEvents.SYNC_SOURCE_DELETE,
    data: SyncSourceEvent,
  ): void;
  // 用于发射API令牌创建事件
  emit(event: AppEvents.API_TOKEN_CREATE, data: ApiTokenCreateEvent): void;
  // 用于发射API令牌删除事件
  emit(event: AppEvents.API_TOKEN_DELETE, data: ApiTokenDeleteEvent): void;
  // 用于发射组织用户邀请事件
  emit(event: AppEvents.ORG_USER_INVITE, data: OrgUserInviteEvent): void;
  // 用于发射组织用户重新邀请事件
  emit(event: AppEvents.ORG_USER_RESEND_INVITE, data: OrgUserInviteEvent): void;
  // 用于发射视图列创建事件
  emit(event: AppEvents.VIEW_COLUMN_CREATE, data: ViewColumnEvent): void;
  // 用于发射视图列更新事件
  emit(event: AppEvents.VIEW_COLUMN_UPDATE, data: ViewColumnUpdateEvent): void;
  // 用于发射关系创建和删除事件
  emit(
    event: AppEvents.RELATION_DELETE | AppEvents.RELATION_CREATE,
    data: RelationEvent,
  ): void;
  // 用于发射插件测试事件
  emit(event: AppEvents.PLUGIN_TEST, data: PluginTestEvent): void;
  // 用于发射插件安装和卸载事件
  emit(
    event: AppEvents.PLUGIN_INSTALL | AppEvents.PLUGIN_UNINSTALL,
    data: PluginEvent,
  ): void;
  // 用于发射共享基础生成链接事件
  emit(event: AppEvents.SHARED_BASE_GENERATE_LINK, data: SharedBaseEvent): void;
  // 用于发射共享基础删除链接事件
  emit(
    event: AppEvents.SHARED_BASE_DELETE_LINK,
    data: SharedBaseDeleteEvent,
  ): void;
  // 用于发射源创建和删除事件
  emit(
    event: AppEvents.SOURCE_DELETE | AppEvents.SOURCE_CREATE,
    data: SourceEvent,
  ): void;
  // 用于发射源更新事件
  emit(event: AppEvents.SOURCE_UPDATE, data: SourceUpdateEvent): void;
  // 用于发射附件上传事件
  emit(event: AppEvents.ATTACHMENT_UPLOAD, data: AttachmentEvent): void;
  // 用于发射表单列更新事件
  emit(event: AppEvents.FORM_COLUMN_UPDATE, data: FormColumnEvent): void;
  // 用于发射网格列更新事件
  emit(event: AppEvents.GRID_COLUMN_UPDATE, data: GridColumnEvent): void;
  // 用于发射元数据差异同步事件
  emit(event: AppEvents.META_DIFF_SYNC, data: MetaDiffEvent): void;
  // 用于发射UI访问控制列表事件
  emit(event: AppEvents.UI_ACL, data: UIAclEvent): void;
  // 用于发射组织API令牌创建事件
  emit(event: AppEvents.ORG_API_TOKEN_CREATE, data: ApiTokenCreateEvent): void;
  // 用于发射组织API令牌删除事件
  emit(event: AppEvents.ORG_API_TOKEN_DELETE, data: ApiTokenDeleteEvent): void;
  // 用于发射用户邮箱验证事件
  emit(
    event: AppEvents.USER_EMAIL_VERIFICATION,
    data: UserEmailVerificationEvent,
  ): void;
  // 用于发射行用户提及事件
  emit(event: AppEvents.ROW_USER_MENTION, data: RowMentionEvent): void;

  // 用于发射扩展创建事件
  emit(event: AppEvents.EXTENSION_CREATE, data: any): void;
  // 用于发射扩展更新事件
  emit(event: AppEvents.EXTENSION_UPDATE, data: any): void;
  // 用于发射扩展删除事件
  emit(event: AppEvents.EXTENSION_DELETE, data: any): void;

  // 用于发射集成创建和删除事件
  emit(
    event: AppEvents.INTEGRATION_CREATE | AppEvents.INTEGRATION_DELETE,
    data: IntegrationEvent,
  ): void;
  // 用于发射集成更新事件
  emit(event: AppEvents.INTEGRATION_UPDATE, data: IntegrationUpdateEvent): void;
  // 用于发射各种视图创建事件
  emit(
    event:
      | AppEvents.FORM_CREATE
      | AppEvents.GRID_CREATE
      | AppEvents.CALENDAR_CREATE
      | AppEvents.GALLERY_CREATE
      | AppEvents.KANBAN_CREATE
      | AppEvents.MAP_CREATE,
    data: ViewCreateEvent,
  ): void;
  // 用于发射各种视图删除事件
  emit(
    event:
      | AppEvents.FORM_DELETE
      | AppEvents.GRID_DELETE
      | AppEvents.CALENDAR_DELETE
      | AppEvents.GALLERY_DELETE
      | AppEvents.KANBAN_DELETE
      | AppEvents.MAP_DELETE,
    data: ViewDeleteEvent,
  ): void;
  // 用于发射各种视图更新事件
  emit(
    event:
      | AppEvents.GRID_UPDATE
      | AppEvents.CALENDAR_UPDATE
      | AppEvents.GALLERY_UPDATE
      | AppEvents.KANBAN_UPDATE
      | AppEvents.MAP_UPDATE,
    data:
      | ViewUpdateEvent
      | GridViewUpdateEvent
      | GalleryViewUpdateEvent
      | KanbanViewUpdateEvent
      | CalendarViewUpdateEvent
      | FormViewUpdateEvent,
  ): void;
  // 用于发射基础复制相关事件
  emit(
    event:
      | AppEvents.BASE_DUPLICATE_START
      | AppEvents.BASE_DUPLICATE_FAIL
      | AppEvents.BASE_DUPLICATE_COMPLETE,
    data: BaseDuplicateEvent,
  ): void;
  // 用于发射表格复制相关事件
  emit(
    event:
      | AppEvents.TABLE_DUPLICATE_START
      | AppEvents.TABLE_DUPLICATE_FAIL
      | AppEvents.TABLE_DUPLICATE_COMPLETE,
    data: TableDuplicateEvent,
  ): void;
  // 用于发射列复制相关事件
  emit(
    event:
      | AppEvents.COLUMN_DUPLICATE_START
      | AppEvents.COLUMN_DUPLICATE_FAIL
      | AppEvents.COLUMN_DUPLICATE_COMPLETE,
    data: ColumnDuplicateEvent,
  ): void;
  // 用于发射视图复制相关事件
  emit(
    event:
      | AppEvents.VIEW_DUPLICATE_START
      | AppEvents.VIEW_DUPLICATE_FAIL
      | AppEvents.VIEW_DUPLICATE_COMPLETE,
    data: ViewDuplicateEvent,
  ): void;
  // 用于发射Webhook测试事件
  emit(event: AppEvents.WEBHOOK_TEST, data: WebhookEvent): void;
  // 用于发射用户资料更新事件
  emit(
    event: AppEvents.USER_PROFILE_UPDATE,
    data: UserProfileUpdateEvent,
  ): void;
  // 用于发射数据导出事件
  emit(event: AppEvents.DATA_EXPORT, data: DataExportEvent): void;
  // 用于发射数据导入事件
  emit(event: AppEvents.DATA_IMPORT, data: DataImportEvent): void;

  // 用于发射各种表单和视图更新事件
  emit(
    event:
      | AppEvents.FORM_UPDATE
      | AppEvents.GRID_UPDATE
      | AppEvents.CALENDAR_UPDATE
      | AppEvents.GALLERY_UPDATE
      | AppEvents.KANBAN_UPDATE
      | AppEvents.MAP_UPDATE,
    data:
      | ViewUpdateEvent
      | GridViewUpdateEvent
      | GalleryViewUpdateEvent
      | KanbanViewUpdateEvent
      | CalendarViewUpdateEvent
      | FormViewUpdateEvent,
  ): void;
  // emit方法的实际实现
  emit(event, data): void {
    // 发射特定事件
    this.eventEmitter.emit(event, data);
    // 同时发射ALL_EVENTS事件，包含原始事件和数据
    this.eventEmitter.emit(ALL_EVENTS, { event, data: data });
  }

  // 移除特定事件的特定监听器
  removeListener(
    event: AppEvents | 'notification',
    listener: (args: any) => void,
  ) {
    // 调用存储的取消订阅函数
    this.listenerUnsubscribers.get(listener)?.();
    // 从Map中删除监听器
    this.listenerUnsubscribers.delete(listener);
  }

  // 移除特定事件的所有监听器
  removeListeners(event: AppEvents | 'notification') {
    return this.eventEmitter.removeAllListeners(event);
  }

  // 移除特定监听器的所有事件订阅
  removeAllListener(listener) {
    // 调用存储的取消订阅函数
    this.listenerUnsubscribers.get(listener)?.();
    // 从Map中删除监听器
    this.listenerUnsubscribers.delete(listener);
  }

  // 监听所有事件
  onAll(
    listener: (payload: {
      event: AppEvents | 'notification';
      data: any;
    }) => void | Promise<void>,
  ) {
    // 注册ALL_EVENTS事件的监听器
    const unsubscribe = this.eventEmitter.on(ALL_EVENTS, async (...args) => {
      try {
        // 异步调用监听器函数
        await listener(...args);
      } catch (e) {
        // 捕获并记录错误
        this.logger.error(e?.message, e?.stack);
      }
    });
    // 将监听器和对应的取消订阅函数存储到Map中
    this.listenerUnsubscribers.set(listener, unsubscribe);
    // 返回取消订阅函数
    return unsubscribe;
  }
}
