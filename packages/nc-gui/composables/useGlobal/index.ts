// 导入全局状态的操作方法
import { useGlobalActions } from './actions'
// 导入全局状态的获取器方法
import { useGlobalGetters } from './getters'
// 导入全局状态的状态定义
import { useGlobalState } from './state'
// 导入全局状态返回类型的接口定义
import type { UseGlobalReturn } from './types'

/**
 * Global state is injected by {@link import('~/plugins/state') state} plugin into our nuxt app (available as `$state`).
 * You can still call `useGlobal` to receive the `$state` object and access the global state.
 * If it's not available yet, a new global state object is created and injected into the nuxt app.
 *
 * Part of the state is stored in {@link WindowLocalStorage localStorage}, so it will be available even if the user closes the browser tab.
 * Check the {@link StoredState StoredState} type for more information.
 *
 * @example
 * ```js
 *
 *
 * const { $state } = useNuxtApp()
 *
 * const token = $state.token.value
 * const user = $state.user.value
 * ```
 *
 * @example
 * ```js
 *
 *
 * const globalState = useGlobal()
 *
 * cont token = globalState.token.value
 * const user = globalState.user.value
 *
 * console.log(state.isLoading.value) // isLoading = true if any api request is still running
 * ```
 */
// 使用 createGlobalState 创建一个全局状态管理器，确保在整个应用中只有一个实例
export const useGlobal = createGlobalState((): UseGlobalReturn => {
  // 从 Nuxt 应用实例中获取 provide 方法，用于提供依赖注入
  const { provide } = useNuxtApp()

  // 初始化全局状态
  const state = useGlobalState()

  // 初始化全局状态的获取器，传入状态对象
  const getters = useGlobalGetters(state)

  // 初始化全局状态的操作方法，传入状态对象和获取器
  const actions = useGlobalActions(state, getters)

  // 监听 JWT 载荷的变化
  watch(
    // 监听的对象：JWT 载荷
    state.jwtPayload,
    // 当 JWT 载荷变化时执行的回调函数
    (nextPayload) => {
      // 如果有新的载荷数据
      if (nextPayload) {
        // 更新用户信息
        state.user.value = {
          // keep existing props if user id same as before
          // 如果用户 ID 相同，保留现有属性，否则使用空对象
          ...(state.user.value?.id === nextPayload.id ? state.user.value || {} : {}),
          // 设置用户 ID
          id: nextPayload.id,
          // 设置用户邮箱
          email: nextPayload.email,
          // 设置用户名
          firstname: nextPayload.firstname,
          // 设置用户姓
          lastname: nextPayload.lastname,
          // 设置用户角色
          roles: nextPayload.roles,
          // 设置用户显示名称
          display_name: nextPayload.display_name,
        }
      }
    },
    // 配置选项：立即执行监听回调
    { immediate: true },
  )

  // 合并状态、获取器和操作方法，创建完整的全局状态对象
  const globalState = { ...state, ...getters, ...actions } as UseGlobalReturn

  /** provide a fresh state instance into nuxt app */
  // 将全局状态对象注入到 Nuxt 应用中，使其可以通过 $state 访问
  provide('state', globalState)

  // 返回全局状态对象
  return globalState
})
