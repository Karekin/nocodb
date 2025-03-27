// 导入 SyncSource 类型
import type { SyncSource } from '~/models';
// 导入各种类型定义
import type {
  BaseType,
  ColumnType,
  CommentType,
  FilterType,
  HookType,
  IntegrationType,
  PluginTestReqType,
  PluginType,
  ProjectRoles,
  ProjectUserReqType,
  SortType,
  SourceType,
  TableType,
  UserType,
  ViewType,
} from 'nocodb-sdk';
// 导入 NcContext 和 NcRequest 类型
import type { NcContext, NcRequest } from '~/interface/config';
// 导入 CustomUrl 类型
import type { CustomUrl } from '~/models';

// 定义 Optional 类型，使 T 类型中的 K 键变为可选
export type Optional<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>;

// 定义基础事件接口，所有事件都继承自此接口
export interface NcBaseEvent {
  context: NcContext;
  req: NcRequest;
  clientId?: string;
}

// 项目邀请事件接口
export interface ProjectInviteEvent extends NcBaseEvent {
  base: BaseType;
  user: UserType;
  invitedBy: UserType;
  role: ProjectRoles | string;
}

// 行评论事件接口
export interface RowCommentEvent extends NcBaseEvent {
  base: BaseType;
  user: UserType;
  model: TableType;
  rowId: string;
  comment: CommentType;
  ip?: string;
}

// 行提及事件接口
export interface RowMentionEvent extends NcBaseEvent {
  model: TableType;
  rowId: string;
  user: UserType;
  column: ColumnType;
  mentions: string[];
}

// 项目用户更新事件接口
export interface ProjectUserUpdateEvent extends NcBaseEvent {
  base: BaseType;
  user: UserType;
  baseUser: Partial<ProjectUserReqType>;
  oldBaseUser: Partial<ProjectUserReqType>;
}
// 用户资料更新事件接口
export interface UserProfileUpdateEvent
  extends Optional<NcBaseEvent, 'context'> {
  user: UserType;
  oldUser: Partial<UserType>;
}

// 项目用户删除事件接口
export interface ProjectUserDeleteEvent extends NcBaseEvent {
  base: BaseType;
  user: UserType;
}

// 项目用户重新发送邀请事件接口
export interface ProjectUserResendInviteEvent extends NcBaseEvent {
  base: BaseType;
  user: UserType;
  baseUser: ProjectUserReqType;
}

// 项目创建事件接口
export interface ProjectCreateEvent extends NcBaseEvent {
  base: BaseType;
  user: UserType;
  xcdb: boolean;
}

// 项目更新事件接口
export interface ProjectUpdateEvent extends NcBaseEvent {
  base: BaseType;
  updateObj: Record<string, any>;
  oldBaseObj: BaseType;
  user: UserType;
}

// 表格更新事件接口
export interface TableUpdateEvent extends NcBaseEvent {
  table: Partial<TableType>;
  prevTable: TableType;
}

// 项目删除事件接口
export interface ProjectDeleteEvent extends NcBaseEvent {
  base: BaseType;
  user: UserType;
}

// 欢迎事件接口
export interface WelcomeEvent extends Optional<NcBaseEvent, 'context'> {
  user: UserType;
}

// 用户注册事件接口
export interface UserSignupEvent extends Optional<NcBaseEvent, 'context'> {
  user: UserType;
}

// 用户邀请事件接口
export interface UserInviteEvent extends Optional<NcBaseEvent, 'context'> {
  user: UserType;
  role: string;
  workspaceInvite?: boolean;
  workspaceId?: string;
}

// 用户登录事件接口
export interface UserSigninEvent extends Optional<NcBaseEvent, 'context'> {
  user: UserType;
}

// 用户登出事件接口
export interface UserSignoutEvent extends Optional<NcBaseEvent, 'context'> {
  user: UserType;
}

// API创建事件接口
export interface ApiCreatedEvent extends NcBaseEvent {
  info: any;
}

// 用户密码更改事件接口
export interface UserPasswordChangeEvent
  extends Optional<NcBaseEvent, 'context'> {
  user: UserType;
}

// 用户忘记密码事件接口
export interface UserPasswordForgotEvent
  extends Optional<NcBaseEvent, 'context'> {
  user: UserType;
}

// 用户重置密码事件接口
export interface UserPasswordResetEvent
  extends Optional<NcBaseEvent, 'context'> {
  user: UserType;
}

// 用户邮箱验证事件接口
export interface UserEmailVerificationEvent
  extends Optional<NcBaseEvent, 'context'> {
  user: UserType;
}

// 表格事件接口
export interface TableEvent extends NcBaseEvent {
  table: TableType;
  user: UserType;
  source?: SourceType;
}

// 视图事件接口
export interface ViewEvent extends NcBaseEvent {
  view: ViewType;
  user?: UserType;
}

// 视图创建事件接口
export interface ViewCreateEvent extends NcBaseEvent {
  view: ViewType;
  owner: UserType;
  user?: UserType;
}
// 视图删除事件接口
export interface ViewDeleteEvent extends NcBaseEvent {
  view: ViewType;
  owner: UserType;
  user?: UserType;
}

// 共享视图更新事件接口
export interface SharedViewUpdateEvent extends NcBaseEvent {
  view: ViewType;
  sharedView: any;
  oldSharedView: any;
  user?: UserType;
}

// 视图更新事件接口
export interface ViewUpdateEvent extends ViewEvent {
  oldView: ViewType;
  owner: UserType;
}

// 表单视图更新事件接口
export interface FormViewUpdateEvent extends NcBaseEvent {
  view: ViewType;
  formView: any;
  oldFormView: any;
}

// 网格视图更新事件接口
export interface GridViewUpdateEvent extends NcBaseEvent {
  view: ViewType;
  gridView: any;
  oldGridView: any;
  owner: UserType;
}

// 看板视图更新事件接口
export interface KanbanViewUpdateEvent extends NcBaseEvent {
  view: ViewType;
  kanbanView: any;
  oldKanbanView: any;
  owner: UserType;
}

// 画廊视图更新事件接口
export interface GalleryViewUpdateEvent extends NcBaseEvent {
  view: ViewType;
  galleryView: any;
  oldGalleryView: any;
  owner: UserType;
}

// 日历视图更新事件接口
export interface CalendarViewUpdateEvent extends NcBaseEvent {
  view: ViewType;
  calendarView: any;
  oldCalendarView: any;
  owner: UserType;
}

// 表单视图更新事件接口（重复定义，可能是代码错误）
export interface FormViewUpdateEvent extends NcBaseEvent {
  view: ViewType;
  formView: any;
  oldFormView: any;
  owner: UserType;
}

// 过滤器事件附加属性类型
type FilterEventAdditionalProp =
  | {
      hook: HookType;
    }
  | {
      view: ViewType;
    }
  | {
      linkColumn: ColumnType;
    };

// 过滤器事件类型
export type FilterEvent = NcBaseEvent & {
  filter: FilterType;
  ip?: string;
  column?: ColumnType;
} & FilterEventAdditionalProp;

// 过滤器更新事件类型
export type FilterUpdateEvent = FilterEvent & {
  oldFilter: FilterType;
};

// 列事件接口
export interface ColumnEvent extends NcBaseEvent {
  table: TableType;
  columnId: string;
  column: ColumnType;
  columns: ColumnType[];
}

// 列更新事件接口
export interface ColumnUpdateEvent extends ColumnEvent {
  oldColumn: ColumnType;
}

// 排序事件接口
export interface SortEvent extends NcBaseEvent {
  sort: SortType;
  ip?: string;
  view: ViewType;
  column: ColumnType;
}

// 排序更新事件接口
export interface SortUpdateEvent extends SortEvent {
  oldSort: SortType;
}

// 组织用户邀请事件接口
export interface OrgUserInviteEvent extends Omit<NcBaseEvent, 'context'> {
  user: UserType;
  count?: number;
  context?: NcContext;
}

// 视图列事件接口
export interface ViewColumnEvent extends NcBaseEvent {
  viewColumn: any;
  view: ViewType;
  column: ColumnType;
}

// 视图列更新事件接口
export interface ViewColumnUpdateEvent extends ViewColumnEvent {
  oldViewColumn: any;
  internal?: boolean;
}

// 关系事件接口
export interface RelationEvent extends NcBaseEvent {
  column: ColumnType;
}

// Webhook事件接口
export interface WebhookEvent extends NcBaseEvent {
  hook: HookType;
  tableId: string;
}

// Webhook更新事件接口
export interface WebhookUpdateEvent extends WebhookEvent {
  oldHook: HookType;
}

// Webhook触发事件接口
export interface WebhookTriggerEvent extends NcBaseEvent {
  hook: HookType;
  data: any;
}

// API令牌创建事件接口
export interface ApiTokenCreateEvent extends Optional<NcBaseEvent, 'context'> {
  userId: string;
  tokenId: string;
  tokenTitle: string;
}

// API令牌更新事件接口
export interface ApiTokenUpdateEvent extends Optional<NcBaseEvent, 'context'> {
  userId: string;
  tokenTitle: string;
  oldTokenTitle: string;
}

// API令牌删除事件接口
export interface ApiTokenDeleteEvent extends Optional<NcBaseEvent, 'context'> {
  userId: string;
  tokenId: string;
  tokenTitle: string;
}

// 插件测试事件接口
export interface PluginTestEvent extends Optional<NcBaseEvent, 'context'> {
  testBody: PluginTestReqType;
}

// 插件事件接口
export interface PluginEvent extends Optional<NcBaseEvent, 'context'> {
  plugin: PluginType;
}

// 共享基础事件接口
export interface SharedBaseEvent extends NcBaseEvent {
  link?: string;
  base?: BaseType;
  sharedBaseRole: string;
  uuid: string;
  customUrl?: CustomUrl;
}

// 共享基础删除事件接口
export interface SharedBaseDeleteEvent
  extends Omit<SharedBaseEvent, 'sharedBaseRole'> {}

// 数据源事件接口
export interface SourceEvent extends NcBaseEvent {
  source: SourceType;
  integration: IntegrationType;
}

// 附件事件接口
export interface AttachmentEvent extends Optional<NcBaseEvent, 'context'> {
  type: 'url' | 'file';
}

// 表单列事件接口
export interface FormColumnEvent extends NcBaseEvent {
  formColumn: any;
}

// 网格列事件接口
export interface GridColumnEvent extends NcBaseEvent {}

// 元数据差异事件接口
export interface MetaDiffEvent extends NcBaseEvent {
  base: BaseType;
  source?: SourceType;
}

// UI访问控制列表事件接口
export interface UIAclEvent extends NcBaseEvent {
  base: any;
  role: string;
  view: any;
  disabled: boolean;
}

// 同步源事件接口
export interface SyncSourceEvent extends NcBaseEvent {
  syncSource: Partial<SyncSource>;
}

// 集成事件接口
export interface IntegrationEvent extends Optional<NcBaseEvent, 'context'> {
  integration: IntegrationType;
  user: UserType;
  ip?: string;
}

// 数据源更新事件接口
export interface SourceUpdateEvent extends SourceEvent {
  oldSource: Partial<SourceType>;
}

// 基础复制事件接口
export interface BaseDuplicateEvent extends NcBaseEvent {
  sourceBase: BaseType;
  destBase?: BaseType;
  user: UserType;
  id?: string;
  error?: string;
  options?: unknown;
}

// 表格复制事件接口
export interface TableDuplicateEvent extends NcBaseEvent {
  sourceTable: TableType;
  destTable?: TableType;
  user: UserType;
  id?: string;
  error?: string;
  title?: string;
  options?: unknown;
}

// 列复制事件接口
export interface ColumnDuplicateEvent extends NcBaseEvent {
  table: TableType;
  sourceColumn: ColumnType;
  destColumn?: ColumnType;
  user: UserType;
  id?: string;
  error?: string;
  options?: unknown;
}

// 视图复制事件接口
export interface ViewDuplicateEvent extends NcBaseEvent {
  sourceView: ViewType;
  destView?: ViewType;
  id?: string;
  error?: string;
}

// 模型角色可见性事件接口
export interface ModelRoleVisibilityEvent extends NcBaseEvent {
  view: ViewType;
  role: string;
  disabled: boolean;
}

// 数据导入事件接口
export interface DataImportEvent extends NcBaseEvent {
  view: ViewType;
  table: TableType;
  type: 'excel' | 'csv';
  id: string;
}

// 集成事件接口（重复定义，可能是代码错误）
export interface IntegrationEvent extends Optional<NcBaseEvent, 'context'> {
  integration: IntegrationType;
  user: UserType;
  ip?: string;
}

// 集成更新事件接口
export interface IntegrationUpdateEvent extends IntegrationEvent {
  oldIntegration: IntegrationType;
}

// 数据导出事件接口
export interface DataExportEvent extends NcBaseEvent {
  view: ViewType;
  table: TableType;
  type: 'excel' | 'csv';
}

// 应用事件载荷类型，包含多种事件类型的联合
export type AppEventPayload =
  | ProjectInviteEvent
  | ProjectCreateEvent
  | ProjectUpdateEvent
  | ProjectDeleteEvent
  | WelcomeEvent
  | UserSignupEvent
  | UserSigninEvent
  | TableEvent
  | ViewEvent
  | FilterEvent
  | SortEvent
  | RowCommentEvent
  | RowMentionEvent
  | WebhookTriggerEvent
  | ColumnEvent;
