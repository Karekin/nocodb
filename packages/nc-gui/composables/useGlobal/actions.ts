// 从 pinia 导入获取活动 Pinia 实例的函数
import { getActivePinia } from 'pinia'
// 导入类型定义：Actions（操作接口）、AppInfo（应用信息接口）、Getters（获取器接口）和 State（状态接口）
import type { Actions, AppInfo, Getters, State } from './types'
// 导入 NcProjectType 类型
import type { NcProjectType } from '#imports'

// 导出全局操作函数，接收状态和获取器作为参数，返回操作对象
export function useGlobalActions(state: State, _getters: Getters): Actions {
  // 创建一个状态变量，用于跟踪令牌是否在当前标签页中更新
  const isTokenUpdatedTab = useState('isTokenUpdatedTab', () => false)

  // 设置移动模式的函数
  const setIsMobileMode = (isMobileMode: boolean) => {
    // 更新状态中的移动模式值
    state.isMobileMode.value = isMobileMode
  }

  /** Sign out by deleting the token from localStorage */
  // 登出函数，通过删除 localStorage 中的令牌实现
  const signOut: Actions['signOut'] = async ({
    // 是否重定向到登录页面
    redirectToSignin,
    // 登录页面的 URL，默认为 '/signin'
    signinUrl = '/signin',
    // 是否跳过 API 调用，默认为 false
    skipApiCall = false,
  }: SignOutParams = {}) => {
    try {
      // call and invalidate refresh token only if user manually triggered logout
      // 只有在用户手动触发登出时才调用并使刷新令牌失效
      if (!skipApiCall) {
        // 获取 Nuxt 应用实例
        const nuxtApp = useNuxtApp()
        // 调用 API 的登出方法
        await nuxtApp.$api.auth.signout()
      }
    } catch {
      // ignore error
      // 忽略错误
    } finally {
      // 清除令牌
      state.token.value = null
      // 清除用户信息
      state.user.value = null

      // 如果需要重定向到登录页面
      if (redirectToSignin) {
        // 导航到登录页面
        await navigateTo(signinUrl)
      }

      // clear all stores data on logout
      // 在登出时清除所有存储的数据
      // 获取活动的 Pinia 实例
      const pn = getActivePinia()
      // 如果 Pinia 实例存在
      if (pn) {
        // 遍历所有存储
        pn._s.forEach((store) => {
          // 释放存储
          store.$dispose()
          // 从 Pinia 状态中删除存储
          delete pn.state.value[store.$id]
        })
      }
    }
  }

  /** Sign in by setting the token in localStorage
   * keepProps - is for keeping any existing role info if user id is same as previous user
   * */
  // 登录函数，通过在 localStorage 中设置令牌实现
  // keepProps - 如果用户 ID 与之前的用户相同，则保留现有的角色信息
  const signIn: Actions['signIn'] = (newToken, keepProps = false) => {
    // 标记令牌已在当前标签页中更新
    isTokenUpdatedTab.value = true
    // 设置新令牌
    state.token.value = newToken

    // 如果 JWT 载荷存在
    if (state.jwtPayload.value) {
      // 更新用户信息
      state.user.value = {
        // 如果 keepProps 为 true 且用户 ID 相同，则保留现有属性，否则使用空对象
        ...(keepProps && state.user.value?.id === state.jwtPayload.value.id ? state.user.value || {} : {}),
        // 设置用户 ID
        id: state.jwtPayload.value.id,
        // 设置用户邮箱
        email: state.jwtPayload.value.email,
        // 设置用户名
        firstname: state.jwtPayload.value.firstname,
        // 设置用户姓
        lastname: state.jwtPayload.value.lastname,
        // 设置用户角色
        roles: state.jwtPayload.value.roles,
        // 设置用户显示名称
        display_name: state.jwtPayload.value.display_name,
      }
    }
  }

  /** manually try to refresh token */
  // 手动尝试刷新令牌的内部函数
  const _refreshToken = async ({
    // Axios 实例
    axiosInstance,
    // 是否跳过登出，默认为 false
    skipSignOut = false,
  }: {
    axiosInstance?: any
    skipSignOut?: boolean
  } = {}) => {
    // 获取 Nuxt 应用实例
    const nuxtApp = useNuxtApp()
    // 获取国际化翻译函数
    const t = nuxtApp.vueApp.i18n.global.t

    // 如果未提供 Axios 实例
    if (!axiosInstance) {
      // 使用 Nuxt 应用中的 API 实例
      axiosInstance = nuxtApp.$api?.instance
    }

    try {
      // 发送刷新令牌请求
      const response = await axiosInstance.post('/auth/token/refresh', null, {
        // 包含凭证（如 cookies）
        withCredentials: true,
      })
      // 如果响应中包含令牌
      if (response.data?.token) {
        // 使用新令牌登录，并保留现有属性
        signIn(response.data.token, true)
        // 返回新令牌
        return response.data.token
      }
      // 如果没有令牌，返回 null
      return null
    } catch (e) {
      // 如果有令牌和用户信息，且不跳过登出
      if (state.token.value && state.user.value && !skipSignOut) {
        // 执行登出，跳过 API 调用
        await signOut({
          skipApiCall: true,
        })
        // 显示错误消息
        message.error(t('msg.error.youHaveBeenSignedOut'))
      }
      // 返回 null
      return null
    }
  }

  // 使用共享执行函数包装刷新令牌函数，避免多次并发调用
  const refreshToken = useSharedExecutionFn('refreshToken', _refreshToken, {
    // 超时时间为 10 秒
    timeout: 10000,
    // 存储延迟为 1 秒
    storageDelay: 1000,
  })

  // 加载应用信息的函数
  const loadAppInfo = async () => {
    try {
      // 获取 Nuxt 应用实例
      const nuxtApp = useNuxtApp()
      // 调用 API 获取应用信息，并将结果转换为 AppInfo 类型
      state.appInfo.value = (await nuxtApp.$api.utils.appInfo()) as AppInfo
    } catch (e) {
      // 打印错误信息
      console.error(e)
    }
  }

  // 导航到项目的函数
  const navigateToProject = ({
    // 工作区 ID
    workspaceId: _workspaceId,
    // 项目类型
    type: _type,
    // 基础 ID
    baseId,
    // 查询参数
    query,
  }: {
    workspaceId?: string
    baseId?: string
    type?: NcProjectType
    query?: any
  }) => {
    // 如果未提供工作区 ID，则使用默认值 'nc'
    const workspaceId = _workspaceId || 'nc'
    // 声明路径变量
    let path: string

    // 构建查询参数字符串
    const queryParams = query ? `?${new URLSearchParams(query).toString()}` : ''

    // 如果提供了基础 ID
    if (baseId) {
      // 构建包含基础 ID 的路径
      path = `/${workspaceId}/${baseId}${queryParams}`
    } else {
      // 构建不包含基础 ID 的路径
      path = `/${workspaceId}${queryParams}`
    }

    // 导航到构建的路径
    navigateTo({
      path,
    })
  }

  // NocoDB 导航函数，提供更多参数选项
  const ncNavigateTo = ({
    // 工作区 ID
    workspaceId: _workspaceId,
    // 项目类型
    type: _type,
    // 基础 ID
    baseId,
    // 查询参数
    query,
    // 表格 ID
    tableId,
    // 视图 ID
    viewId,
  }: {
    workspaceId?: string
    baseId?: string
    type?: NcProjectType
    query?: any
    tableId?: string
    viewId?: string
  }) => {
    // 构建表格路径部分
    const tablePath = tableId ? `/${tableId}${viewId ? `/${viewId}` : ''}` : ''
    // 如果未提供工作区 ID，则使用默认值 'nc'
    const workspaceId = _workspaceId || 'nc'
    // 声明路径变量
    let path: string

    // 构建查询参数字符串
    const queryParams = query ? `?${new URLSearchParams(query).toString()}` : ''

    // 如果提供了基础 ID
    if (baseId) {
      // 构建包含基础 ID 和表格路径的完整路径
      path = `/${workspaceId}/${baseId}${tablePath}${queryParams}`
    } else {
      // 构建不包含基础 ID 的路径
      path = `/${workspaceId}${queryParams}`
    }

    // 导航到构建的路径并返回导航结果
    return navigateTo({
      path,
    })
  }

  // 获取基础 URL 的函数
  const getBaseUrl = (workspaceId: string) => {
    // if baseUrl is set in appInfo, use it
    // 如果在应用信息中设置了基础 URL，则使用它
    if (state.appInfo.value.baseUrl) {
      return state.appInfo.value.baseUrl
    }

    // 如果设置了基础主机名，且当前主机名不是工作区的子域名
    if (state.appInfo.value.baseHostName && location.hostname !== `${workspaceId}.${state.appInfo.value.baseHostName}`) {
      // 返回工作区的完整 URL
      return `https://${workspaceId}.${state.appInfo.value.baseHostName}`
    }
    // 如果没有匹配条件，返回 undefined
    return undefined
  }

  // 获取主 URL 的函数
  const getMainUrl = () => {
    // 返回 undefined
    return undefined
  }

  // 设置网格视图页面大小的函数
  const setGridViewPageSize = (pageSize: number) => {
    // 更新状态中的网格视图页面大小
    state.gridViewPageSize.value = pageSize
  }

  // 设置左侧边栏大小的函数
  const setLeftSidebarSize = ({ old, current }: { old?: number; current?: number }) => {
    // 更新状态中的左侧边栏大小
    state.leftSidebarSize.value = {
      // 如果提供了旧大小，则使用它，否则保持不变
      old: old ?? state.leftSidebarSize.value.old,
      // 如果提供了当前大小，则使用它，否则保持不变
      current: current ?? state.leftSidebarSize.value.current,
    }
  }

  // 设置添加新记录网格模式的函数
  const setAddNewRecordGridMode = (isGridMode: boolean) => {
    // 更新状态中的添加新记录网格模式
    state.isAddNewRecordGridMode.value = isGridMode
  }

  // 更新同步数据投票的函数
  const updateSyncDataUpvotes = (upvotes: string[]) => {
    // 更新状态中的同步数据投票
    state.syncDataUpvotes.value = upvotes
  }

  // 返回所有操作函数
  return {
    signIn,
    signOut,
    refreshToken,
    loadAppInfo,
    setIsMobileMode,
    navigateToProject,
    getBaseUrl,
    ncNavigateTo,
    getMainUrl,
    setGridViewPageSize,
    setLeftSidebarSize,
    setAddNewRecordGridMode,
    updateSyncDataUpvotes,
  }
}
