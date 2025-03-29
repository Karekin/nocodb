// 从 Vue 导入类型定义：ComputedRef（计算属性引用）、Ref（响应式引用）和 ToRefs（将响应式对象转换为引用对象）
import type { ComputedRef, Ref, ToRefs } from 'vue'
// 从 Vue 的响应式系统导入可写计算属性引用类型
import type { WritableComputedRef } from '@vue/reactivity'
// 从 jwt-decode 库导入 JWT 载荷类型
import type { JwtPayload } from 'jwt-decode'
// 从 nocodb-sdk 导入项目角色类型
import type { ProjectRoles } from 'nocodb-sdk'
// 从 axios 导入 AxiosInstance 类型，用于 HTTP 请求
import type { AxiosInstance } from 'axios'
// 从本地导入 NcProjectType 类型
import type { NcProjectType } from '#imports'

// 定义应用信息接口，包含应用的各种配置和状态
export interface AppInfo {
  // NocoDB 站点 URL
  ncSiteUrl: string
  // 认证类型，可以是 JWT 或无认证
  authType: 'jwt' | 'none'
  // 是否允许连接到外部数据库
  connectToExternalDB: boolean
  // 默认查询限制数
  defaultLimit: number
  // 默认分组限制配置
  defaultGroupByLimit: {
    // 分组限制数
    limitGroup: number
    // 记录限制数
    limitRecord: number
  }
  // 是否为首次使用的用户
  firstUser: boolean
  // 是否启用 GitHub 认证
  githubAuthEnabled: boolean
  // 是否启用 Google 认证
  googleAuthEnabled: boolean
  // 是否启用 OIDC 认证
  oidcAuthEnabled: boolean
  // OIDC 提供商名称，可以为空
  oidcProviderName: string | null
  // 是否为最小化版本
  ncMin: boolean
  // 是否为一键部署版本
  oneClick: boolean
  // 基础是否有管理员
  baseHasAdmin: boolean
  // 是否启用遥测
  teleEnabled: boolean
  // 是否启用错误报告
  errorReportingEnabled: boolean
  // 是否启用审计
  auditEnabled: boolean
  // 应用类型
  type: string
  // 应用版本
  version: string
  // 是否为企业版
  ee?: boolean
  // 附件字段大小限制
  ncAttachmentFieldSize: number
  // 最大允许附件数
  ncMaxAttachmentsAllowed: number
  // 是否为云版本
  isCloud: boolean
  // 自动化日志级别：关闭、仅错误或全部
  automationLogLevel: 'OFF' | 'ERROR' | 'ALL'
  // 基础主机名，可选
  baseHostName?: string
  // 是否禁用邮箱认证
  disableEmailAuth: boolean
  // 主子域名，可选
  mainSubDomain?: string
  // 仪表盘路径
  dashboardPath: string
  // 是否仅允许邀请注册
  inviteOnlySignup: boolean
  // 是否启用 SAML 认证
  samlAuthEnabled: boolean
  // SAML 提供商名称，可以为空
  samlProviderName: string | null
  // 礼品 URL
  giftUrl: string
  // 是否启用反馈
  feedEnabled: boolean
  // Sentry 数据源名称，用于错误跟踪
  sentryDSN: string
  // 是否为本地部署版本
  isOnPrem: boolean
}

// 定义存储状态接口，包含需要持久化的应用状态
export interface StoredState {
  // 用户认证令牌，可以为空
  token: string | null
  // 语言设置，使用 Language 枚举的键
  lang: keyof typeof Language
  // 是否启用暗黑模式
  darkMode: boolean
  // 是否自动保存过滤器
  filterAutoSave: boolean
  // 预览角色，可以为空
  previewAs: ProjectRoles | null
  // 是否包含多对多关系
  includeM2M: boolean
  // 是否显示空值
  showNull: boolean
  // 当前版本，可以为空
  currentVersion: string | null
  // 最新发布版本，可以为空
  latestRelease: string | null
  // 隐藏的发布版本，可以为空
  hiddenRelease: string | null
  // 是否为移动模式，可以为空
  isMobileMode: boolean | null
  // 最后打开的工作区 ID，可以为空
  lastOpenedWorkspaceId: string | null
  // 网格视图页面大小
  gridViewPageSize: number
  // 左侧边栏大小配置
  leftSidebarSize: {
    // 旧大小
    old: number
    // 当前大小
    current: number
  }
  // 是否为添加新记录的网格模式
  isAddNewRecordGridMode: boolean
  // 同步数据投票数组
  syncDataUpvotes: string[]
  // 礼品横幅关闭次数
  giftBannerDismissedCount: number
}

// 定义状态类型，继承自 StoredState 的引用版本（除了 token）并添加额外属性
export type State = ToRefs<Omit<StoredState, 'token'>> & {
  // 存储状态的引用
  storage: Ref<StoredState>
  // 用户信息引用，可以为空
  user: Ref<User | null>
  // 令牌的可写计算属性引用
  token: WritableComputedRef<StoredState['token']>
  // JWT 载荷的计算属性引用，包含用户信息，可以为空
  jwtPayload: ComputedRef<(JwtPayload & User) | null>
  // 时间戳引用
  timestamp: Ref<number>
  // 运行中的请求计数器
  runningRequests: ReturnType<typeof useCounter>
  // 错误信息引用
  error: Ref<any>
  // 应用信息引用
  appInfo: Ref<AppInfo>
}

// 定义获取器接口，包含派生状态
export interface Getters {
  // 是否已登录的计算属性引用
  signedIn: ComputedRef<boolean>
  // 是否正在加载的可写计算属性引用
  isLoading: WritableComputedRef<boolean>
}

// 定义登出参数接口
export interface SignOutParams {
  // 是否重定向到登录页面，可选
  redirectToSignin?: boolean
  // 登录 URL，可选
  signinUrl?: string
  // 是否跳过重定向，可选
  skipRedirect?: boolean
  // 是否跳过 API 调用，可选
  skipApiCall?: boolean
}

// 定义操作接口，包含可执行的方法
export interface Actions {
  // 登出方法，接受登出参数，返回 Promise
  signOut: (signOutParams?: SignOutParams) => Promise<void>
  // 登录方法，接受令牌和是否保留属性参数
  signIn: (token: string, keepProps?: boolean) => void
  // 刷新令牌方法，接受参数对象，返回 Promise
  refreshToken: (params: {
    // Axios 实例，可选
    axiosInstance?: AxiosInstance
    // 是否跳过登出，可选
    skipLogout?: boolean
    // 是否仅 Cognito，可选
    cognitoOnly?: boolean
  }) => Promise<string | null | void>
  // 加载应用信息方法
  loadAppInfo: () => void
  // 设置移动模式方法
  setIsMobileMode: (isMobileMode: boolean) => void
  // 导航到项目方法，接受参数对象
  navigateToProject: (params: { workspaceId?: string; baseId?: string; type?: NcProjectType; query?: any }) => void
  // NocoDB 导航方法，接受参数对象
  ncNavigateTo: (params: {
    // 工作区 ID，可选
    workspaceId?: string
    // 基础 ID，可选
    baseId?: string
    // 项目类型，可选
    type?: NcProjectType
    // 查询参数，可选
    query?: any
    // 表格 ID，可选
    tableId?: string
    // 视图 ID，可选
    viewId?: string
  }) => void
  // 获取基础 URL 方法，接受工作区 ID
  getBaseUrl: (workspaceId: string) => string | undefined
  // 获取主 URL 方法，接受工作区 ID
  getMainUrl: (workspaceId: string) => string | undefined
  // 设置网格视图页面大小方法
  setGridViewPageSize: (pageSize: number) => void
  // 设置左侧边栏大小方法，接受参数对象
  setLeftSidebarSize: (params: { old?: number; current?: number }) => void
  // 设置添加新记录网格模式方法
  setAddNewRecordGridMode: (isGridMode: boolean) => void
  // 更新同步数据投票方法
  updateSyncDataUpvotes: (upvotes: string[]) => void
}

// 定义只读状态类型，包含只读的 token 和 user，以及其他状态属性
export type ReadonlyState = Readonly<Pick<State, 'token' | 'user'>> & Omit<State, 'token' | 'user'>

// 定义全局状态返回类型，合并获取器、操作和只读状态
export type UseGlobalReturn = Getters & Actions & ReadonlyState
