// 导入必要的类型和工具
// 从nocodb-sdk导入类型定义
import type { FilterType, KanbanType, SortType, TableType, ViewType } from 'nocodb-sdk'
// 从nocodb-sdk导入常量和方法
import { NcApiVersion, ViewLockType, ViewTypes, extractFilterFromXwhere } from 'nocodb-sdk'
// 从vue导入Ref类型
import type { Ref } from 'vue'
// 导入本地类型定义
import type { SmartsheetStoreEvents } from '#imports'

// 创建一个可注入的状态管理store
// 使用useInjectionState创建响应式状态，可以在组件树中共享
const [useProvideSmartsheetStore, useSmartsheetStore] = useInjectionState(
  (
    // _view参数已弃用，现在使用viewsStore代替
    _view: Ref<ViewType | undefined>,
    // 表格或看板的元数据
    meta: Ref<TableType | KanbanType | undefined>,
    // 是否共享视图，默认为false
    shared = false,
    // 初始排序配置，可选
    initialSorts?: Ref<SortType[]>,
    // 初始过滤器配置，可选
    initialFilters?: Ref<FilterType[]>,
  ) => {
    // 注入是否是公共视图的状态，默认为false
    const isPublic = inject(IsPublicInj, ref(false))

    // 获取Nuxt应用实例中的api
    const { $api } = useNuxtApp()

    // 获取路由实例和当前路由
    const router = useRouter()
    const route = router.currentRoute

    // 从全局状态中获取用户信息
    const { user } = useGlobal()

    // 从viewsStore中获取活动视图、嵌套过滤器和排序
    const { activeView: view, activeNestedFilters, activeSorts } = storeToRefs(useViewsStore())

    // 获取基础store
    const baseStore = useBase()

    // 从基础store中获取SQL UI配置
    const { sqlUis } = storeToRefs(baseStore)

    // 计算当前使用的SQL UI
    // 如果元数据中有source_id，则使用对应的SQL UI，否则使用第一个
    const sqlUi = computed(() =>
      (meta.value as TableType)?.source_id ? sqlUis.value[(meta.value as TableType).source_id!] : Object.values(sqlUis.value)[0],
    )

    // 获取字段查询功能
    const { search } = useFieldQuery()

    // 创建事件总线用于组件间通信
    const eventBus = useEventBus<SmartsheetStoreEvents>(Symbol('SmartsheetStore'))

    // 计算属性：视图是否被锁定
    // 判断条件：1. 个人锁定且当前用户不是所有者 2. 完全锁定
    const isLocked = computed(
      () =>
        (view.value?.lock_type === ViewLockType.Personal && user.value?.id !== view.value?.owned_by) ||
        view.value?.lock_type === ViewLockType.Locked,
    )
    // 计算属性：是否有主键可用
    const isPkAvail = computed(() => (meta.value as TableType)?.columns?.some((c) => c.pk))
    // 计算属性：是否是网格视图
    const isGrid = computed(() => view.value?.type === ViewTypes.GRID)
    // 计算属性：是否是表单视图
    const isForm = computed(() => view.value?.type === ViewTypes.FORM)
    // 计算属性：是否是画廊视图
    const isGallery = computed(() => view.value?.type === ViewTypes.GALLERY)
    // 计算属性：是否是日历视图
    const isCalendar = computed(() => view.value?.type === ViewTypes.CALENDAR)
    // 计算属性：是否是看板视图
    const isKanban = computed(() => view.value?.type === ViewTypes.KANBAN)
    // 计算属性：是否是地图视图
    const isMap = computed(() => view.value?.type === ViewTypes.MAP)
    // 计算属性：是否是共享表单
    const isSharedForm = computed(() => isForm.value && shared)
    // 计算属性：是否是默认视图
    const isDefaultView = computed(() => view.value?.is_default)

    // 计算属性：创建列标题到列对象的映射
    const aliasColObjMap = computed(() => {
      const colObj = (meta.value as TableType)?.columns?.reduce((acc, col) => {
        acc[col.title] = col
        return acc
      }, {})
      return colObj
    })

    // 计算属性：从URL中解析where查询时的错误
    const whereQueryFromUrlError = computed(() => {
      if (route.value.query.where) {
        return extractFilterFromXwhere({ api_version: NcApiVersion.V1 }, route.value.query.where, aliasColObjMap.value, false)
          ?.errors
      }
    })
    // 计算属性：从URL中获取where查询
    const whereQueryFromUrl = computed(() => {
      if (whereQueryFromUrlError.value?.length) {
        return
      }

      return route.value.query.where
    })

    // 计算属性：构建完整的where查询条件
    const xWhere = computed(() => {
      let where

      // 如果URL中已经有where条件，直接使用
      if (whereQueryFromUrl.value) {
        where = whereQueryFromUrl.value
      }

      // 查找搜索字段对应的列
      const col =
        (meta.value as TableType)?.columns?.find(({ id }) => id === search.value.field) ||
        (meta.value as TableType)?.columns?.find((v) => v.pv)
      if (!col) return where

      // 如果搜索查询为空，直接返回现有where条件
      if (!search.value.query.trim()) return where

      // 根据列类型构建不同的where条件
      if (sqlUi.value && ['text', 'string'].includes(sqlUi.value.getAbstractType(col)) && col.dt !== 'bigint') {
        // 文本类型使用like模糊匹配
        where = `${where ? `${where}~and` : ''}(${col.title},like,%${search.value.query.trim()}%)`
      } else {
        // 其他类型使用精确匹配
        where = `${where ? `${where}~and` : ''}(${col.title},eq,${search.value.query.trim()})`
      }

      return where
    })

    // 操作面板是否激活的状态
    const isActionPaneActive = ref(false)

    // 操作面板大小
    const actionPaneSize = ref(40)

    // 计算属性：是否是SQL视图
    const isSqlView = computed(() => (meta.value as TableType)?.type === 'view')
    // 排序状态
    const sorts = ref<SortType[]>(unref(initialSorts) ?? [])
    // 嵌套过滤器状态
    const nestedFilters = ref<FilterType[]>(unref(initialFilters) ?? [])

    // 所有过滤器状态
    const allFilters = ref<FilterType[]>([])

    // 监听排序变化，更新activeSorts
    watch(
      sorts,
      () => {
        activeSorts.value = sorts.value
      },
      {
        immediate: true,
      },
    )

    // 监听嵌套过滤器变化，更新activeNestedFilters
    watch(
      nestedFilters,
      () => {
        activeNestedFilters.value = nestedFilters.value
      },
      {
        immediate: true,
      },
    )

    // 视图列映射缓存
    const viewColumnsMap = reactive<Record<string, Record<string, any>[]>>({})
    // 正在进行的请求缓存
    const pendingRequests = new Map()

    // 获取视图列的方法
    const getViewColumns = async (viewId: string) => {
      // 如果是公共视图，返回空数组
      if (isPublic.value) return []

      // 如果已有缓存，直接返回
      if (viewColumnsMap[viewId]) return viewColumnsMap[viewId]

      // 如果请求正在进行，返回相同的promise
      if (pendingRequests.has(viewId)) {
        return pendingRequests.get(viewId)
      }

      // 发起API请求获取视图列
      const promise = $api.dbViewColumn
        .list(viewId)
        .then((result) => {
          // 请求成功，缓存结果
          viewColumnsMap[viewId] = result.list
          pendingRequests.delete(viewId)
          return result.list
        })
        .catch((error) => {
          // 请求失败，清除缓存
          pendingRequests.delete(viewId)
          throw error
        })

      // 缓存promise
      pendingRequests.set(viewId, promise)

      return promise
    }

    // 返回store的所有状态和方法
    return {
      view,
      meta,
      isLocked,
      $api,
      xWhere,
      isPkAvail,
      isForm,
      isGrid,
      isGallery,
      isKanban,
      isMap,
      isCalendar,
      isSharedForm,
      sorts,
      nestedFilters,
      isSqlView,
      eventBus,
      sqlUi,
      allFilters,
      isDefaultView,
      actionPaneSize,
      isActionPaneActive,
      viewColumnsMap,
      getViewColumns,
    }
  },
  // 注入状态的唯一标识
  'smartsheet-store',
)

// 导出提供store的方法
export { useProvideSmartsheetStore }

// 导出获取store的方法，如果store不存在则抛出错误
export function useSmartsheetStoreOrThrow() {
  const state = useSmartsheetStore()

  if (!state) throw new Error('Please call `useProvideSmartsheetStore` on the appropriate parent component')

  return state
}
