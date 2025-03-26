// 导入Vue相关的类型
import type { ComputedRef, Ref } from 'vue'
// 导入NocoDB SDK中的类型
import type { GalleryType, TableType, ViewType } from 'nocodb-sdk'

/**
 * 用于处理画廊视图数据的组合式函数
 * @param _meta 表格元数据，可以是Ref或ComputedRef类型
 * @param viewMeta 视图元数据，可以是Ref或ComputedRef类型，包含id字段
 * @param where 可选的查询条件，ComputedRef类型
 */
export function useGalleryViewData(
  _meta: Ref<TableType | undefined> | ComputedRef<TableType | undefined>,
  viewMeta: Ref<ViewType | undefined> | ComputedRef<(ViewType & { id: string }) | undefined>,
  where?: ComputedRef<string | undefined>,
) {
  // 注入是否是公共视图的标志
  const isPublic = inject(IsPublicInj, ref(false))

  // 获取Nuxt应用实例
  const { $api } = useNuxtApp()

  // 获取表格存储实例
  const tablesStore = useTablesStore()

  // 从表格存储中获取当前活动表格
  const { activeTable } = storeToRefs(tablesStore)

  // 获取共享视图相关数据
  const { sharedView } = useSharedView()

  // 计算属性，获取最终的元数据（优先使用传入的_meta，否则使用当前活动表格）
  const meta = computed(() => _meta.value || activeTable.value)

  // 用于存储画廊视图数据的ref
  const viewData = ref<GalleryType | undefined>()

  // 使用无限数据加载功能
  const {
    cachedRows,       // 缓存的行数据
    syncCount,        // 同步计数
    clearCache,       // 清除缓存的方法
    deleteRow,        // 删除行的方法
    loadData,         // 加载数据的方法
    navigateToSiblingRow, // 导航到相邻行的方法
    totalRows,        // 总行数
    fetchChunk,       // 获取数据块的方法
    chunkStates,      // 数据块状态
    isFirstRow,       // 是否是第一行
    isLastRow,        // 是否是最后一行
  } = useInfiniteData({
    meta,            // 元数据
    viewMeta,        // 视图元数据
    callbacks: {},   // 回调函数对象
    where,           // 查询条件
  })

  /**
   * 加载画廊数据的方法
   */
  async function loadGalleryData() {
    // 如果没有视图ID则直接返回
    if (!viewMeta?.value?.id) return
    // 如果是公共视图，使用共享视图数据，否则通过API获取画廊数据
    viewData.value = isPublic.value 
      ? (sharedView.value?.view as GalleryType) 
      : await $api.dbView.galleryRead(viewMeta.value.id)
  }

  // 返回所有需要暴露的属性和方法
  return {
    cachedRows,
    deleteRow,
    loadData,
    navigateToSiblingRow,
    loadGalleryData,
    viewData,
    totalRows,
    clearCache,
    chunkStates,
    syncCount,
    fetchChunk,
    isFirstRow,
    isLastRow,
  }
}
