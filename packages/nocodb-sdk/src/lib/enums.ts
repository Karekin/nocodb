/**
 * 组织用户角色枚举
 * 定义了组织级别的用户角色类型
 */
export declare enum OrgUserRoles {
  /** 超级管理员角色 */
  SUPER_ADMIN = "super",
  /** 组织级别创建者角色 */
  CREATOR = "org-level-creator",
  /** 组织级别查看者角色 */
  VIEWER = "org-level-viewer"
}

/**
* 云端组织用户角色枚举
* 定义了云端组织级别的用户角色类型
*/
export declare enum CloudOrgUserRoles {
  /** 云端组织级别创建者角色 */
  CREATOR = "cloud-org-level-creator",
  /** 云端组织级别查看者角色 */
  VIEWER = "cloud-org-level-viewer",
  /** 云端组织级别所有者角色 */
  OWNER = "cloud-org-level-owner"
}

/**
* 项目角色枚举
* 定义了项目级别的用户角色类型
*/
export declare enum ProjectRoles {
  /** 所有者角色 */
  OWNER = "owner",
  /** 创建者角色 */
  CREATOR = "creator",
  /** 编辑者角色 */
  EDITOR = "editor",
  /** 评论者角色 */
  COMMENTER = "commenter",
  /** 查看者角色 */
  VIEWER = "viewer",
  /** 无访问权限角色 */
  NO_ACCESS = "no-access"
}

/**
* 工作区用户角色枚举
* 定义了工作区级别的用户角色类型
*/
export declare enum WorkspaceUserRoles {
  /** 工作区级别所有者角色 */
  OWNER = "workspace-level-owner",
  /** 工作区级别创建者角色 */
  CREATOR = "workspace-level-creator",
  /** 工作区级别编辑者角色 */
  EDITOR = "workspace-level-editor",
  /** 工作区级别评论者角色 */
  COMMENTER = "workspace-level-commenter",
  /** 工作区级别查看者角色 */
  VIEWER = "workspace-level-viewer",
  /** 工作区级别无访问权限角色 */
  NO_ACCESS = "workspace-level-no-access"
}

/**
* 应用事件枚举
* 定义了系统中所有可能发生的事件类型
*/
export declare enum AppEvents {
  /** 项目创建事件 */
  PROJECT_CREATE = "base.create",
  /** 项目邀请事件 */
  PROJECT_INVITE = "base.invite",
  /** 项目用户更新事件 */
  PROJECT_USER_UPDATE = "base.user.update",
  /** 项目用户重新发送邀请事件 */
  PROJECT_USER_RESEND_INVITE = "base.user.resend.invite",
  /** 项目删除事件 */
  PROJECT_DELETE = "base.delete",
  /** 项目更新事件 */
  PROJECT_UPDATE = "base.update",
  /** 项目克隆事件 */
  PROJECT_CLONE = "base.clone",
  /** 欢迎事件 */
  WELCOME = "app.welcome",
  /** 工作区用户邀请事件 */
  WORKSPACE_USER_INVITE = "workspace.invite",
  /** 工作区用户更新事件 */
  WORKSPACE_USER_UPDATE = "workspace.user.update",
  /** 工作区用户删除事件 */
  WORKSPACE_USER_DELETE = "workspace.user.delete",
  /** 工作区创建事件 */
  WORKSPACE_CREATE = "workspace.create",
  /** 工作区删除事件 */
  WORKSPACE_DELETE = "workspace.delete",
  /** 工作区更新事件 */
  WORKSPACE_UPDATE = "workspace.update",
  /** 用户注册事件 */
  USER_SIGNUP = "user.signup",
  /** 用户登录事件 */
  USER_SIGNIN = "user.signin",
  /** 用户邀请事件 */
  USER_INVITE = "user.invite",
  /** 用户更新事件 */
  USER_UPDATE = "user.update",
  /** 用户密码重置事件 */
  USER_PASSWORD_RESET = "user.password.reset",
  /** 用户密码更改事件 */
  USER_PASSWORD_CHANGE = "user.password.change",
  /** 用户忘记密码事件 */
  USER_PASSWORD_FORGOT = "user.password.forgot",
  /** 用户删除事件 */
  USER_DELETE = "user.delete",
  /** 用户邮箱验证事件 */
  USER_EMAIL_VERIFICATION = "user.email.verification",
  /** 表格创建事件 */
  TABLE_CREATE = "table.create",
  /** 表格删除事件 */
  TABLE_DELETE = "table.delete",
  /** 表格更新事件 */
  TABLE_UPDATE = "table.update",
  /** 视图创建事件 */
  VIEW_CREATE = "view.create",
  /** 视图删除事件 */
  VIEW_DELETE = "view.delete",
  /** 视图更新事件 */
  VIEW_UPDATE = "view.update",
  /** 共享视图创建事件 */
  SHARED_VIEW_CREATE = "shared.view.create",
  /** 共享视图删除事件 */
  SHARED_VIEW_DELETE = "shared.view.delete",
  /** 共享视图更新事件 */
  SHARED_VIEW_UPDATE = "shared.view.update",
  /** 过滤器创建事件 */
  FILTER_CREATE = "filter.create",
  /** 过滤器删除事件 */
  FILTER_DELETE = "filter.delete",
  /** 过滤器更新事件 */
  FILTER_UPDATE = "filter.update",
  /** 排序创建事件 */
  SORT_CREATE = "sort.create",
  /** 排序删除事件 */
  SORT_DELETE = "sort.delete",
  /** 排序更新事件 */
  SORT_UPDATE = "sort.update",
  /** 列创建事件 */
  COLUMN_CREATE = "column.create",
  /** 列删除事件 */
  COLUMN_DELETE = "column.delete",
  /** 列更新事件 */
  COLUMN_UPDATE = "column.update",
  /** 数据创建事件 */
  DATA_CREATE = "data.create",
  /** 数据删除事件 */
  DATA_DELETE = "data.delete",
  /** 数据更新事件 */
  DATA_UPDATE = "data.update",
  /** 组织用户邀请事件 */
  ORG_USER_INVITE = "org.user.invite",
  /** 组织用户重新发送邀请事件 */
  ORG_USER_RESEND_INVITE = "org.user.resend.invite",
  /** 视图列创建事件 */
  VIEW_COLUMN_CREATE = "view.column.create",
  /** 视图列更新事件 */
  VIEW_COLUMN_UPDATE = "view.column.update",
  /** API令牌创建事件 */
  API_TOKEN_CREATE = "api.token.create",
  /** API令牌删除事件 */
  API_TOKEN_DELETE = "api.token.delete",
  /** API令牌更新事件 */
  API_TOKEN_UPDATE = "api.token.update",
  /** 图片上传事件 */
  IMAGE_UPLOAD = "image.upload",
  /** 表单列更新事件 */
  FORM_COLUMN_UPDATE = "form.column.update",
  /** 表单创建事件 */
  FORM_CREATE = "form.create",
  /** 表单更新事件 */
  FORM_UPDATE = "form.update",
  /** 画廊创建事件 */
  GALLERY_CREATE = "gallery.create",
  /** 画廊更新事件 */
  GALLERY_UPDATE = "gallery.update",
  /** 地图创建事件 */
  MAP_CREATE = "map.create",
  /** 地图更新事件 */
  MAP_UPDATE = "map.update",
  /** 地图删除事件 */
  MAP_DELETE = "map.delete",
  /** 看板创建事件 */
  KANBAN_CREATE = "kanban.create",
  /** 看板更新事件 */
  KANBAN_UPDATE = "kanban.update",
  /** 元数据差异同步事件 */
  META_DIFF_SYNC = "meta.diff.sync",
  /** 网格创建事件 */
  GRID_CREATE = "grid.create",
  /** 网格更新事件 */
  GRID_UPDATE = "grid.update",
  /** 网格列更新事件 */
  GRID_COLUMN_UPDATE = "grid.column.update",
  /** Webhook创建事件 */
  WEBHOOK_CREATE = "webhook.create",
  /** Webhook更新事件 */
  WEBHOOK_UPDATE = "webhook.update",
  /** Webhook删除事件 */
  WEBHOOK_DELETE = "webhook.delete",
  /** Webhook测试事件 */
  WEBHOOK_TEST = "webhook.test",
  /** Webhook触发事件 */
  WEBHOOK_TRIGGER = "webhook.trigger",
  /** UI访问控制列表更新事件 */
  UI_ACL_UPDATE = "ui.acl.update",
  /** 组织API令牌创建事件 */
  ORG_API_TOKEN_CREATE = "org.api.token.create",
  /** 组织API令牌删除事件 */
  ORG_API_TOKEN_DELETE = "org.api.token.delete",
  /** 组织API令牌更新事件 */
  ORG_API_TOKEN_UPDATE = "org.api.token.update",
  /** 插件测试事件 */
  PLUGIN_TEST = "plugin.test",
  /** 插件安装事件 */
  PLUGIN_INSTALL = "plugin.install",
  /** 插件卸载事件 */
  PLUGIN_UNINSTALL = "plugin.uninstall",
  /** 同步源创建事件 */
  SYNC_SOURCE_CREATE = "sync.source.create",
  /** 同步源更新事件 */
  SYNC_SOURCE_UPDATE = "sync.source.update",
  /** 同步源删除事件 */
  SYNC_SOURCE_DELETE = "sync.source.delete",
  /** 关系删除事件 */
  RELATION_DELETE = "relation.delete",
  /** 关系创建事件 */
  RELATION_CREATE = "relation.create",
  /** 共享基础生成链接事件 */
  SHARED_BASE_GENERATE_LINK = "shared.base.generate.link",
  /** 共享基础删除链接事件 */
  SHARED_BASE_DELETE_LINK = "shared.base.delete.link",
  /** 附件上传事件 */
  ATTACHMENT_UPLOAD = "attachment.upload",
  /** API创建事件 */
  APIS_CREATED = "apis.created",
  /** 扩展创建事件 */
  EXTENSION_CREATE = "extension.create",
  /** 扩展更新事件 */
  EXTENSION_UPDATE = "extension.update",
  /** 扩展删除事件 */
  EXTENSION_DELETE = "extension.delete",
  /** 评论创建事件 */
  COMMENT_CREATE = "comment.create",
  /** 评论删除事件 */
  COMMENT_DELETE = "comment.delete",
  /** 评论更新事件 */
  COMMENT_UPDATE = "comment.update",
  /** 集成删除事件 */
  INTEGRATION_DELETE = "integration.delete",
  /** 集成创建事件 */
  INTEGRATION_CREATE = "integration.create",
  /** 集成更新事件 */
  INTEGRATION_UPDATE = "integration.update",
  /** 行用户提及事件 */
  ROW_USER_MENTION = "row.user.mention",
  /** 日历创建事件 */
  CALENDAR_CREATE = "calendar.create",
  /** 表单复制事件 */
  FORM_DUPLICATE = "form.duplicate",
  /** 日历更新事件 */
  CALENDAR_UPDATE = "calendar.update",
  /** 日历删除事件 */
  CALENDAR_DELETE = "calendar.delete",
  /** 表单删除事件 */
  FORM_DELETE = "form.delete",
  /** 源创建事件 */
  SOURCE_CREATE = "source.create",
  /** 源更新事件 */
  SOURCE_UPDATE = "source.update",
  /** 源删除事件 */
  SOURCE_DELETE = "source.delete",
  /** 共享基础撤销链接事件 */
  SHARED_BASE_REVOKE_LINK = "shared.base.revoke.link",
  /** 网格删除事件 */
  GRID_DELETE = "grid.delete",
  /** 网格复制事件 */
  GRID_DUPLICATE = "grid.duplicate",
  /** 看板删除事件 */
  KANBAN_DELETE = "kanban.delete",
  /** 看板复制事件 */
  KANBAN_DUPLICATE = "kanban.duplicate",
  /** 画廊删除事件 */
  GALLERY_DELETE = "gallery.delete",
  /** 画廊复制事件 */
  GALLERY_DUPLICATE = "gallery.duplicate",
  /** 基础复制开始事件 */
  BASE_DUPLICATE_START = "base.duplicate.start",
  /** 基础复制完成事件 */
  BASE_DUPLICATE_COMPLETE = "base.duplicate.complete",
  /** 基础复制失败事件 */
  BASE_DUPLICATE_FAIL = "base.duplicate.fail",
  /** 表格复制开始事件 */
  TABLE_DUPLICATE_START = "table.duplicate.start",
  /** 表格复制完成事件 */
  TABLE_DUPLICATE_COMPLETE = "table.duplicate.complete",
  /** 表格复制失败事件 */
  TABLE_DUPLICATE_FAIL = "table.duplicate.fail",
  /** 列复制开始事件 */
  COLUMN_DUPLICATE_START = "column.duplicate.start",
  /** 列复制完成事件 */
  COLUMN_DUPLICATE_COMPLETE = "column.duplicate.complete",
  /** 列复制失败事件 */
  COLUMN_DUPLICATE_FAIL = "column.duplicate.fail",
  /** 视图复制开始事件 */
  VIEW_DUPLICATE_START = "view.duplicate.start",
  /** 视图复制完成事件 */
  VIEW_DUPLICATE_COMPLETE = "view.duplicate.complete",
  /** 视图复制失败事件 */
  VIEW_DUPLICATE_FAIL = "view.duplicate.fail",
  /** 用户登出事件 */
  USER_SIGNOUT = "user.signout",
  /** 项目用户删除事件 */
  PROJECT_USER_DELETE = "base.user.delete",
  /** UI访问控制列表事件 */
  UI_ACL = "model.role.ui.acl",
  /** 快照创建事件 */
  SNAPSHOT_CREATE = "snapshot.create",
  /** 快照删除事件 */
  SNAPSHOT_DELETE = "snapshot.delete",
  /** 快照恢复事件 */
  SNAPSHOT_RESTORE = "snapshot.restore",
  /** 数据导出事件 */
  DATA_EXPORT = "data.export",
  /** 数据导入事件 */
  DATA_IMPORT = "data.import",
  /** 用户资料更新事件 */
  USER_PROFILE_UPDATE = "user.profile.update"
}

/**
* ClickHouse表枚举
* 定义了ClickHouse数据库中的表名
*/
export declare enum ClickhouseTables {
  /** API调用表 */
  API_CALLS = "usage_api_calls",
  /** API计数表 */
  API_COUNT = "usage_api_count",
  /** 通知表 */
  NOTIFICATION = "nc_notification",
  /** 页面快照表 */
  PAGE_SNAPSHOT = "docs_page_snapshot",
  /** 遥测数据表 */
  TELEMETRY = "usage_telemetry",
  /** 审计表 */
  AUDIT = "nc_audit"
}

/**
* 工作区状态枚举
* 定义了工作区的不同状态
*/
export declare enum WorkspaceStatus {
  /** 创建中状态 */
  CREATING = 0,
  /** 已创建状态 */
  CREATED = 1,
  /** 删除中状态 */
  DELETING = 2,
  /** 已删除状态 */
  DELETED = 3,
  /** 失败状态 */
  FAILED = 4
}

/**
* 工作区计划枚举
* 定义了工作区的不同订阅计划类型
*/
export declare enum WorkspacePlan {
  /** 免费计划 */
  FREE = "free",
  /** 团队计划 */
  TEAM = "team",
  /** 商业计划 */
  BUSINESS = "business"
}

/**
* 角色标签常量
* 定义了各种角色的显示名称
*/
export declare const RoleLabels: {
  "workspace-level-owner": string;
  "workspace-level-creator": string;
  "workspace-level-editor": string;
  "workspace-level-commenter": string;
  "workspace-level-viewer": string;
  "workspace-level-no-access": string;
  owner: string;
  creator: string;
  editor: string;
  commenter: string;
  viewer: string;
  "no-access": string;
  super: string;
  "org-level-creator": string;
  "org-level-viewer": string;
  "cloud-org-level-owner": string;
  "cloud-org-level-creator": string;
  "cloud-org-level-viewer": string;
};

/**
* 角色颜色常量
* 定义了各种角色的显示颜色
*/
export declare const RoleColors: {
  "workspace-level-owner": string;
  "workspace-level-creator": string;
  "workspace-level-editor": string;
  "workspace-level-commenter": string;
  "workspace-level-viewer": string;
  "workspace-level-no-access": string;
  owner: string;
  creator: string;
  editor: string;
  commenter: string;
  viewer: string;
  super: string;
  "no-access": string;
  "org-level-creator": string;
  "org-level-viewer": string;
  "cloud-org-level-owner": string;
  "cloud-org-level-creator": string;
  "cloud-org-level-viewer": string;
};

/**
* 角色描述常量
* 定义了各种角色的详细描述
*/
export declare const RoleDescriptions: {
  "workspace-level-owner": string;
  "workspace-level-creator": string;
  "workspace-level-editor": string;
  "workspace-level-commenter": string;
  "workspace-level-viewer": string;
  "workspace-level-no-access": string;
  owner: string;
  creator: string;
  editor: string;
  commenter: string;
  viewer: string;
  "no-access": string;
  super: string;
  "org-level-creator": string;
  "org-level-viewer": string;
};

/**
* 角色图标常量
* 定义了各种角色的图标
*/
export declare const RoleIcons: {
  "workspace-level-owner": string;
  "workspace-level-creator": string;
  "workspace-level-editor": string;
  "workspace-level-commenter": string;
  "workspace-level-viewer": string;
  "workspace-level-no-access": string;
  owner: string;
  creator: string;
  editor: string;
  commenter: string;
  viewer: string;
  "no-access": string;
  super: string;
  "org-level-creator": string;
  "org-level-viewer": string;
  "cloud-org-level-owner": string;
  "cloud-org-level-creator": string;
  "cloud-org-level-viewer": string;
};

/**
* 工作区角色到项目角色的映射常量
* 定义了工作区角色如何映射到项目角色
*/
export declare const WorkspaceRolesToProjectRoles: {
  "workspace-level-owner": ProjectRoles;
  "workspace-level-creator": ProjectRoles;
  "workspace-level-editor": ProjectRoles;
  "workspace-level-commenter": ProjectRoles;
  "workspace-level-viewer": ProjectRoles;
  "workspace-level-no-access": ProjectRoles;
};

/**
* 有序工作区角色数组
* 按权限级别排序的工作区角色列表
*/
export declare const OrderedWorkspaceRoles: WorkspaceUserRoles[];

/**
* 有序组织角色数组
* 按权限级别排序的组织角色列表
*/
export declare const OrderedOrgRoles: OrgUserRoles[];

/**
* 有序项目角色数组
* 按权限级别排序的项目角色列表
*/
export declare const OrderedProjectRoles: ProjectRoles[];

/**
* 计划限制类型枚举
* 定义了不同订阅计划的限制类型
*/
export declare enum PlanLimitTypes {
  /** 免费工作区限制 */
  FREE_WORKSPACE_LIMIT = "FREE_WORKSPACE_LIMIT",
  /** 工作区用户限制 */
  WORKSPACE_USER_LIMIT = "WORKSPACE_USER_LIMIT",
  /** 工作区行数限制 */
  WORKSPACE_ROW_LIMIT = "WORKSPACE_ROW_LIMIT",
  /** 基础限制 */
  BASE_LIMIT = "BASE_LIMIT",
  /** 源限制 */
  SOURCE_LIMIT = "SOURCE_LIMIT",
  /** 表格限制 */
  TABLE_LIMIT = "TABLE_LIMIT",
  /** 列限制 */
  COLUMN_LIMIT = "COLUMN_LIMIT",
  /** 表格行数限制 */
  TABLE_ROW_LIMIT = "TABLE_ROW_LIMIT",
  /** Webhook限制 */
  WEBHOOK_LIMIT = "WEBHOOK_LIMIT",
  /** 视图限制 */
  VIEW_LIMIT = "VIEW_LIMIT",
  /** 过滤器限制 */
  FILTER_LIMIT = "FILTER_LIMIT",
  /** 排序限制 */
  SORT_LIMIT = "SORT_LIMIT"
}

/**
* API上下文枚举
* 定义了API操作的上下文类型
*/
export declare enum APIContext {
  /** 视图列上下文 */
  VIEW_COLUMNS = "fields",
  /** 过滤器上下文 */
  FILTERS = "filters",
  /** 排序上下文 */
  SORTS = "sorts"
}

/**
* 源限制枚举
* 定义了数据源的限制类型
*/
export declare enum SourceRestriction {
  /** 架构只读限制 */
  SCHEMA_READONLY = "is_schema_readonly",
  /** 数据只读限制 */
  DATA_READONLY = "is_data_readonly"
}

/**
* 客户端类型枚举
* 定义了不同的数据库客户端类型
*/
export declare enum ClientType {
  /** MySQL客户端 */
  MYSQL = "mysql2",
  /** MSSQL客户端 */
  MSSQL = "mssql",
  /** PostgreSQL客户端 */
  PG = "pg",
  /** SQLite客户端 */
  SQLITE = "sqlite3",
  /** Vitess客户端 */
  VITESS = "vitess",
  /** Snowflake客户端 */
  SNOWFLAKE = "snowflake",
  /** Databricks客户端 */
  DATABRICKS = "databricks"
}

/**
* SSL使用枚举
* 定义了SSL连接的不同使用方式
*/
export declare enum SSLUsage {
  /** 不使用SSL */
  No = "No",
  /** 允许使用SSL */
  Allowed = "Allowed",
  /** 优先使用SSL */
  Preferred = "Preferred",
  /** 要求使用SSL */
  Required = "Required",
  /** 要求使用带CA的SSL */
  RequiredWithCa = "Required-CA",
  /** 要求使用带身份验证的SSL */
  RequiredWithIdentity = "Required-Identity"
}

/**
* 同步数据类型枚举
* 定义了可以同步的不同数据源类型
*/
export declare enum SyncDataType {
  /** NocoDB数据源 */
  NOCODB = "nocodb",
  /** Microsoft Access数据源 */
  MICROSOFT_ACCESS = "microsoft-access",
  /** Tableau数据源 */
  TABLEAU = "tableau",
  /** Oracle数据源 */
  ORACLE = "oracle",
  /** OpenAI数据源 */
  OPENAI = "openai",
  /** Claude数据源 */
  CLAUDE = "claude",
  /** Ollama数据源 */
  OLLAMA = "ollama",
  /** Groq数据源 */
  GROQ = "groq",
  /** Slack数据源 */
  SLACK = "slack",
  /** Discord数据源 */
  DISCORD = "discord",
  /** Twillo数据源 */
  TWILLO = "twillo",
  /** Microsoft Outlook数据源 */
  MICROSOFT_OUTLOOK = "microsoft-outlook",
  /** Microsoft Teams数据源 */
  MICROSOFT_TEAMS = "microsoft-teams",
  /** Telegram数据源 */
  TELEGRAM = "telegram",
  /** Gmail数据源 */
  GMAIL = "gmail",
  /** WhatsApp数据源 */
  WHATSAPP = "whatsapp",
  /** Asana数据源 */
  ASANA = "asana",
  /** Jira数据源 */
  JIRA = "jira",
  /** Miro数据源 */
  MIRO = "miro",
  /** Trello数据源 */
  TRELLO = "trello",
  /** Salesforce数据源 */
  SALESFORCE = "salesforce",
  /** Pipedrive数据源 */
  PIPEDRIVE = "pipedrive",
  /** Microsoft Dynamics 365数据源 */
  MICROSOFT_DYNAMICS_365 = "microsoft-dynamics-365",
  /** Zoho CRM数据源 */
  ZOHO_CRM = "zoho-crm",
  /** HubSpot数据源 */
  HUBSPOT = "hubspot",
  /** Mailchimp数据源 */
  MAILCHIMP = "mailchimp",
  /** SurveyMonkey数据源 */
  SURVEYMONKEY = "surveymonkey",
  /** Typeform数据源 */
  TYPEFORM = "typeform",
  /** Workday数据源 */
  WORKDAY = "workday",
  /** Greenhouse数据源 */
  GREENHOUSE = "greenhouse",
  /** Lever数据源 */
  LEVER = "lever",
  /** GitHub数据源 */
  GITHUB = "github",
  /** GitLab数据源 */
  GITLAB = "gitlab",
  /** Bitbucket数据源 */
  BITBUCKET = "bitbucket",
  /** Stripe数据源 */
  STRIPE = "stripe",
  /** QuickBooks数据源 */
  QUICKBOOKS = "quickbooks",
  /** Freshdesk数据源 */
  FRESHDESK = "freshdesk",
  /** Intercom数据源 */
  INTERCOM = "intercom",
  /** Zendesk数据源 */
  ZENDESK = "zendesk",
  /** HubSpot Service Hub数据源 */
  HUBSPOT_SERVICE_HUB = "hubspot-service-hub",
  /** Salesforce Service Cloud数据源 */
  SALESFORCE_SERVICE_CLOUD = "salesforce-service-cloud",
  /** Box数据源 */
  BOX = "box",
  /** Google Drive数据源 */
  GOOGLE_DRIVE = "google-drive",
  /** Dropbox数据源 */
  DROPBOX = "dropbox",
  /** Apple Numbers数据源 */
  APPLE_NUMBERS = "apple-numbers",
  /** Google Calendar数据源 */
  GOOGLE_CALENDAR = "google-calendar",
  /** Microsoft Excel数据源 */
  MICROSOFT_EXCEL = "microsoft-excel",
  /** Google Sheets数据源 */
  GOOGLE_SHEETS = "google-sheets"
}

/**
* 集成类别类型枚举
* 定义了不同的集成类别
*/
export declare enum IntegrationCategoryType {
  /** 数据库类别 */
  DATABASE = "database",
  /** AI类别 */
  AI = "ai",
  /** 通信类别 */
  COMMUNICATION = "communication",
  /** 电子表格类别 */
  SPREAD_SHEET = "spread-sheet",
  /** 项目管理类别 */
  PROJECT_MANAGEMENT = "project-management",
  /** CRM类别 */
  CRM = "crm",
  /** 营销类别 */
  MARKETING = "marketing",
  /** 申请跟踪系统类别 */
  ATS = "ats",
  /** 开发类别 */
  DEVELOPMENT = "development",
  /** 财务类别 */
  FINANCE = "finance",
  /** 工单系统类别 */
  TICKETING = "ticketing",
  /** 存储类别 */
  STORAGE = "storage",
  /** 其他类别 */
  OTHERS = "others",
  /** 同步类别 */
  SYNC = "sync",
  /** 认证类别 */
  AUTH = "auth"
}

/**
* 视图锁定类型枚举
* 定义了视图的不同锁定状态
*/
export declare enum ViewLockType {
  /** 个人锁定 - 仅创建者可编辑 */
  Personal = "personal",
  /** 锁定 - 所有人都不能编辑 */
  Locked = "locked",
  /** 协作 - 所有有权限的人都可以编辑 */
  Collaborative = "collaborative"
}

/**
* 公共附件范围枚举
* 定义了公共附件的不同使用范围
*/
export declare enum PublicAttachmentScope {
  /** 工作区图片 */
  WORKSPACEPICS = "workspacePics",
  /** 个人资料图片 */
  PROFILEPICS = "profilePics",
  /** 组织图片 */
  ORGANIZATIONPICS = "organizationPics"
}

/**
* 图标类型枚举
* 定义了系统中使用的不同图标类型
*/
export declare enum IconType {
  /** 图片类型图标 */
  IMAGE = "IMAGE",
  /** 表情符号类型图标 */
  EMOJI = "EMOJI",
  /** 矢量图标类型 */
  ICON = "ICON"
}

/**
* NocoDB API版本枚举
* 定义了API的不同版本
*/
export declare enum NcApiVersion {
  /** API版本1 */
  V1 = 0,
  /** API版本2 */
  V2 = 1,
  /** API版本3 */
  V3 = 2
}
