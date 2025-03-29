// 从 @vueuse/core 导入 useStorage 钩子，用于在 localStorage 中存储响应式状态
import { useStorage } from '@vueuse/core'
// 导入 JWT 载荷类型定义
import type { JwtPayload } from 'jwt-decode'
// 导入应用信息、状态和存储状态的类型定义
import type { AppInfo, State, StoredState } from './types'
// 导入左侧边栏初始宽度常量
import { INITIAL_LEFT_SIDEBAR_WIDTH } from '~/lib/constants'

// 导出全局状态函数，接受存储键参数，默认为 'nocodb-gui-v2'，返回状态对象
export function useGlobalState(storageKey = 'nocodb-gui-v2'): State {
  /** get the preferred languages of a user, according to browser settings */
  // 获取用户根据浏览器设置的首选语言
  const preferredLanguages = usePreferredLanguages()
  /** todo: reimplement; get the preferred dark mode setting, according to browser settings */
  // 获取用户根据浏览器设置的首选暗黑模式设置（待重新实现）
  //   const prefersDarkMode = $(usePreferredDark())
  // 暂时将暗黑模式设置为 false
  const prefersDarkMode = false

  /** reactive timestamp to check token expiry against */
  // 创建响应式时间戳，用于检查令牌是否过期，立即启动并每 100 毫秒更新一次
  const timestamp = useTimestamp({ immediate: true, interval: 100 })

  // 从 Nuxt 应用实例中获取 Vue 应用和国际化对象
  const {
    vueApp: { i18n },
  } = useNuxtApp()

  /**
   * Set initial language based on browser settings.
   * If the user has not set a preferred language, we fall back to 'en'.
   * If the user has set a preferred language, we try to find a matching locale in the available locales.
   */
  // 根据浏览器设置设置初始语言
  // 如果用户没有设置首选语言，我们默认使用 'en'
  // 如果用户设置了首选语言，我们尝试在可用的语言环境中找到匹配的语言环境
  const preferredLanguage = preferredLanguages.value.reduce<keyof typeof Language>((locale, language) => {
    /** split language to language and code, e.g. en-GB -> [en, GB] */
    // 将语言拆分为语言和代码，例如 en-GB -> [en, GB]
    const [lang, code] = language.split(/[_-]/)

    /** find all locales that match the language */
    // 查找所有匹配该语言的语言环境
    let availableLocales = i18n.global.availableLocales.filter((locale) => locale.startsWith(lang))

    /** If we can match more than one locale, we check if the code of the language matches as well */
    // 如果我们可以匹配多个语言环境，我们还检查语言的代码是否匹配
    if (availableLocales.length > 1) {
      availableLocales = availableLocales.filter((locale) => locale.endsWith(code))
    }

    /** if there are still multiple locales, pick the first one */
    // 如果仍然有多个语言环境，选择第一个
    const availableLocale = availableLocales[0]

    /** if we found a matching locale, return it */
    // 如果我们找到了匹配的语言环境，返回它
    if (availableLocale) locale = availableLocale as keyof typeof Language

    // 返回找到的语言环境或默认语言环境
    return locale
  }, 'en' /** fallback locale */)

  /** State */
  // 定义初始状态对象
  const initialState: StoredState = {
    // 令牌，初始为 null
    token: null,
    // 语言，使用首选语言
    lang: preferredLanguage,
    // 暗黑模式，使用首选暗黑模式设置
    darkMode: prefersDarkMode,
    // 过滤器自动保存，默认为 true
    filterAutoSave: true,
    // 预览角色，初始为 null
    previewAs: null,
    // 是否包含多对多关系，默认为 false
    includeM2M: false,
    // 是否显示空值，默认为 false
    showNull: false,
    // 当前版本，初始为 null
    currentVersion: null,
    // 最新发布版本，初始为 null
    latestRelease: null,
    // 隐藏的发布版本，初始为 null
    hiddenRelease: null,
    // 是否为移动模式，初始为 null
    isMobileMode: null,
    // 最后打开的工作区 ID，初始为 null
    lastOpenedWorkspaceId: null,
    // 网格视图页面大小，默认为 25
    gridViewPageSize: 25,
    // 左侧边栏大小配置
    leftSidebarSize: {
      // 旧大小，使用初始宽度
      old: INITIAL_LEFT_SIDEBAR_WIDTH,
      // 当前大小，使用初始宽度
      current: INITIAL_LEFT_SIDEBAR_WIDTH,
    },
    // 是否为添加新记录的网格模式，默认为 true
    isAddNewRecordGridMode: true,
    // 同步数据投票数组，初始为空
    syncDataUpvotes: [],
    // 礼品横幅关闭次数，初始为 0
    giftBannerDismissedCount: 0,
  }

  /** saves a reactive state, any change to these values will write/delete to localStorage */
  // 保存响应式状态，对这些值的任何更改都将写入/删除到 localStorage
  const storage = useStorage<StoredState>(storageKey, initialState, localStorage, { mergeDefaults: true })

  /** force turn off of dark mode, regardless of previously stored settings */
  // 强制关闭暗黑模式，无论之前存储的设置如何
  storage.value.darkMode = false

  /** current token ref, used by `useJwt` to reactively parse our token payload */
  // 当前令牌引用，由 `useJwt` 用于响应式解析令牌载荷
  const token = computed({
    // 获取令牌值，如果为 null 则返回空字符串
    get: () => storage.value.token || '',
    // 设置令牌值
    set: (val) => {
      storage.value.token = val
    },
  })

  // 获取运行时配置
  const config = useRuntimeConfig()

  // 创建应用信息响应式引用
  const appInfo = ref<AppInfo>({
    // NocoDB 站点 URL，使用配置中的后端 URL 或回退 URL
    ncSiteUrl: config.public.ncBackendUrl || BASE_FALLBACK_URL,
    // 认证类型，设置为 JWT
    authType: 'jwt',
    // 是否允许连接到外部数据库，默认为 false
    connectToExternalDB: false,
    // 默认查询限制数，设置为 0
    defaultLimit: 0,
    // 是否为首次使用的用户，默认为 true
    firstUser: true,
    // 是否启用 GitHub 认证，默认为 false
    githubAuthEnabled: false,
    // 是否启用 Google 认证，默认为 false
    googleAuthEnabled: false,
    // 是否启用 OIDC 认证，默认为 false
    oidcAuthEnabled: false,
    // OIDC 提供商名称，初始为 null
    oidcProviderName: null,
    // 是否启用 SAML 认证，默认为 false
    samlAuthEnabled: false,
    // SAML 提供商名称，初始为 null
    samlProviderName: null,
    // 是否为最小化版本，默认为 false
    ncMin: false,
    // 是否为一键部署版本，默认为 false
    oneClick: false,
    // 基础是否有管理员，默认为 false
    baseHasAdmin: false,
    // 是否启用遥测，默认为 true
    teleEnabled: true,
    // 是否启用错误报告，默认为 false
    errorReportingEnabled: false,
    // 是否启用审计，默认为 true
    auditEnabled: true,
    // 应用类型，设置为 'nocodb'
    type: 'nocodb',
    // 应用版本，设置为 '0.0.0'
    version: '0.0.0',
    // 附件字段大小限制，设置为 20
    ncAttachmentFieldSize: 20,
    // 最大允许附件数，设置为 10
    ncMaxAttachmentsAllowed: 10,
    // 是否为云版本，默认为 false
    isCloud: false,
    // 自动化日志级别，设置为 'OFF'
    automationLogLevel: 'OFF',
    // 是否禁用邮箱认证，默认为 false
    disableEmailAuth: false,
    // 仪表盘路径，设置为 '/dashboard'
    dashboardPath: '/dashboard',
    // 是否仅允许邀请注册，默认为 false
    inviteOnlySignup: false,
    // 礼品 URL，初始为空字符串
    giftUrl: '',
    // 是否为本地部署版本，默认为 false
    isOnPrem: false,
  })

  /** reactive token payload */
  // 响应式令牌载荷，使用 useJwt 钩子解析令牌
  const { payload } = useJwt<JwtPayload & User>(token)

  /** currently running requests */
  // 当前运行的请求计数器
  const runningRequests = useCounter()

  /** global error */
  // 全局错误引用
  const error = ref()

  /** our local user object */
  // 本地用户对象引用，初始为 null
  const user = ref<User | null>(null)

  // 返回状态对象，包含存储状态的引用版本和其他状态属性
  return {
    // 展开存储状态的引用版本
    ...toRefs(storage.value),
    // 存储状态引用
    storage,
    // 令牌计算属性
    token,
    // JWT 载荷
    jwtPayload: payload,
    // 时间戳
    timestamp,
    // 运行中的请求计数器
    runningRequests,
    // 错误引用
    error,
    // 用户引用
    user,
    // 应用信息引用
    appInfo,
  }
}
