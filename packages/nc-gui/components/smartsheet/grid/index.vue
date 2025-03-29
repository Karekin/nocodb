<script lang="ts" setup>
// 导入类型定义：ColumnType表示列类型，GridType表示网格视图类型
import type { ColumnType, GridType } from 'nocodb-sdk'
// 导入子组件：无限滚动表格组件
import InfiniteTable from './InfiniteTable.vue'
// 导入子组件：基础表格组件
import Table from './Table.vue'
// 导入子组件：分组视图组件
import GroupBy from './GroupBy.vue'
// 导入子组件：Canvas表格组件
import CanvasTable from './canvas/index.vue'

// 注入当前表格的元数据，如果没有则使用空ref
const meta = inject(MetaInj, ref())

// 注入当前视图数据，如果没有则使用空ref
const view = inject(ActiveViewInj, ref())

// 注入视图数据重新加载的钩子函数，如果没有则创建新的事件钩子
const reloadViewDataHook = inject(ReloadViewDataHookInj, createEventHook())

// 获取路由实例
const router = useRouter()

// 获取当前路由信息
const route = router.currentRoute

// 从智能表格存储中解构出xWhere条件和事件总线
const { xWhere, eventBus } = useSmartsheetStoreOrThrow()

// 获取国际化工具函数
const { t } = useI18n()

// 获取功能开关检查函数
const { isFeatureEnabled } = useBetaFeatureToggle()

// 批量更新对话框的显示状态
const bulkUpdateDlg = ref(false)

// 计算属性：获取当前路由的查询参数并转换为字符串字典类型
const routeQuery = computed(() => route.value.query as Record<string, string>)

// 展开表单对话框的显示状态
const expandedFormDlg = ref(false)
// 当前展开表单的行数据
const expandedFormRow = ref<Row>()
// 展开表单的行状态数据
const expandedFormRowState = ref<Record<string, any>>()

// 创建可见数据重新加载的事件钩子
const reloadVisibleDataHook = createEventHook()

// 提供可见数据重新加载的钩子给子组件使用
provide(ReloadVisibleDataHookInj, reloadVisibleDataHook)

// 表格组件的引用
const tableRef = ref<typeof InfiniteTable>()

// 使用视图聚合数据提供函数
useProvideViewAggregate(view, meta, xWhere, reloadVisibleDataHook)

// 从网格视图数据hook中解构出各种方法和状态
const {
  loadData, // 加载数据方法
  selectedRows, // 当前选中的行
  updateOrSaveRow, // 更新或保存行
  addEmptyRow: _addEmptyRow, // 添加空行方法(重命名为_addEmptyRow)
  deleteRow, // 删除行
  deleteSelectedRows, // 删除选中的行
  cachedRows, // 缓存的行数据
  clearCache, // 清空缓存
  removeRowIfNew, // 如果是新行则移除
  navigateToSiblingRow, // 导航到相邻行
  deleteRangeOfRows, // 删除范围内的行
  bulkUpdateRows, // 批量更新行
  bulkUpsertRows, // 批量插入或更新行
  syncCount, // 同步计数
  totalRows, // 总行数
  syncVisibleData, // 同步可见数据
  optimisedQuery, // 是否启用优化查询
  isLastRow, // 是否是最后一行
  isFirstRow, // 是否是第一行
  chunkStates, // 数据块状态
  updateRecordOrder, // 更新记录顺序
  clearInvalidRows, // 清除无效行
  isRowSortRequiredRows, // 行是否需要排序
  applySorting, // 应用排序
  isBulkOperationInProgress, // 是否正在进行批量操作
  selectedAllRecords, // 是否选中所有记录
  bulkDeleteAll, // 批量删除所有
  getRows, // 获取行数据
} = useGridViewData(meta, view, xWhere, reloadVisibleDataHook)

// 计算行高度
const rowHeight = computed(() => {
  // 如果视图中有定义行高度
  if ((view.value?.view as GridType)?.row_height !== undefined) {
    // 根据行高度枚举值返回对应的行高倍数
    switch ((view.value?.view as GridType)?.row_height) {
      case 0: // 紧凑
        return 1
      case 1: // 中等
        return 2
      case 2: // 宽松
        return 4
      case 3: // 超宽松
        return 6
      default: // 默认紧凑
        return 1
    }
  }
})

// 提供当前是否为表单视图的上下文(设置为false)
provide(IsFormInj, ref(false))

// 提供当前是否为画廊视图的上下文(设置为false)
provide(IsGalleryInj, ref(false))

// 提供当前是否为网格视图的上下文(设置为true)
provide(IsGridInj, ref(true))

// 提供当前是否为日历视图的上下文(设置为false)
provide(IsCalendarInj, ref(false))

// 提供行高度给子组件使用
provide(RowHeightInj, rowHeight)

// 注入是否为公共视图的标志，默认为false
const isPublic = inject(IsPublicInj, ref(false))

// 提供行数据重新加载的钩子给子组件使用
provide(ReloadRowDataHookInj, reloadViewDataHook)

// 是否跳过取消时的行移除操作
const skipRowRemovalOnCancel = ref(false)

// 展开表单函数
function expandForm(row: Row, state?: Record<string, any>, fromToolbar = false) {
  // 从行数据中提取主键ID
  const rowId = extractPkFromRow(row.row, meta.value?.columns as ColumnType[])
  // 保存行状态
  expandedFormRowState.value = state
  // 如果有行ID且不是公共视图
  if (rowId && !isPublic.value) {
    // 清空当前展开的行
    expandedFormRow.value = undefined
    // 导航到带rowId查询参数的路由
    router.push({
      query: {
        ...routeQuery.value,
        rowId,
      },
    })
  } else {
    // 否则直接打开对话框
    expandedFormRow.value = row
    expandedFormDlg.value = true
    // 设置是否跳过取消时的行移除操作
    skipRowRemovalOnCancel.value = !fromToolbar
  }
}

// 暴露打开列创建的方法
const exposeOpenColumnCreate = (data: any) => {
  tableRef.value?.openColumnCreate(data)
}

// 定义暴露给父组件的方法
defineExpose({
  loadData, // 加载数据方法
  openColumnCreate: exposeOpenColumnCreate, // 打开列创建方法
})

// 计算属性：是否通过rowId展开表单对话框
const expandedFormOnRowIdDlg = computed({
  get() {
    // 检查路由查询中是否有rowId参数
    return !!routeQuery.value.rowId
  },
  set(val) {
    // 如果设置为false，则从路由查询中移除rowId参数
    if (!val)
      router.push({
        query: {
          ...routeQuery.value,
          rowId: undefined,
        },
      })
  },
})

// 添加行展开关闭时的回调
const addRowExpandOnClose = (row: Row) => {
  // 如果不跳过取消时的行移除操作
  if (!skipRowRemovalOnCancel.value) {
    // 发出清除新行的事件
    eventBus.emit(SmartsheetStoreEvents.CLEAR_NEW_ROW, row)
  }
}

// 切换优化查询状态
const toggleOptimisedQuery = () => {
  // 如果当前是优化查询状态
  if (optimisedQuery.value) {
    // 关闭优化查询
    optimisedQuery.value = false
    // 显示提示信息
    message.info(t('msg.optimizedQueryDisabled'))
  } else {
    // 否则开启优化查询
    optimisedQuery.value = true
    // 显示提示信息
    message.info(t('msg.optimizedQueryEnabled'))
  }
}

// 从视图分组hook中解构出各种方法和状态
const {
  rootGroup, // 根分组
  groupBy, // 分组依据
  isGroupBy, // 是否分组
  loadGroups, // 加载分组
  loadGroupData, // 加载分组数据
  loadGroupPage, // 加载分组页
  groupWrapperChangePage, // 分组包装器换页
  redistributeRows, // 重新分配行
  loadGroupAggregation, // 加载分组聚合
} = useViewGroupByOrThrow()

// 获取侧边栏存储
const sidebarStore = useSidebarStore()

// 从侧边栏存储中解构出窗口大小和左侧边栏宽度
const { windowSize, leftSidebarWidth } = toRefs(sidebarStore)

// 视图宽度
const viewWidth = ref(0)

// 监听事件总线
eventBus.on((event) => {
  // 如果是分组重新加载或数据重新加载事件
  if (event === SmartsheetStoreEvents.GROUP_BY_RELOAD || event === SmartsheetStoreEvents.DATA_RELOAD) {
    // 触发视图数据重新加载
    reloadViewDataHook?.trigger()
  }
})

// 导航到下一行
const goToNextRow = () => {
  navigateToSiblingRow(NavigateDir.NEXT)
}

// 导航到上一行
const goToPreviousRow = () => {
  navigateToSiblingRow(NavigateDir.PREV)
}

// 更新视图宽度
const updateViewWidth = () => {
  // 如果是公共视图
  if (isPublic.value) {
    // 视图宽度等于窗口宽度
    viewWidth.value = windowSize.value
    return
  }
  // 否则视图宽度等于窗口宽度减去左侧边栏宽度
  viewWidth.value = windowSize.value - leftSidebarWidth.value
}

// 计算基础背景颜色
const baseColor = computed(() => {
  // 根据分组层级返回不同的背景色
  switch (groupBy.value.length) {
    case 1: // 一级分组
      return '#F9F9FA'
    case 2: // 二级分组
      return '#F4F4F5'
    case 3: // 三级分组
      return '#E7E7E9'
    default: // 默认
      return '#F9F9FA'
  }
})

// 计算属性：是否启用无限滚动
const isInfiniteScrollingEnabled = computed(() => isFeatureEnabled(FEATURE_FLAG.INFINITE_SCROLLING))

// 计算属性：是否启用Canvas表格
const isCanvasTableEnabled = computed(() => isFeatureEnabled(FEATURE_FLAG.CANVAS_GRID_VIEW))

// 监听窗口大小和左侧边栏宽度变化，更新视图宽度
watch([windowSize, leftSidebarWidth], updateViewWidth)

// 组件挂载时更新视图宽度
onMounted(() => {
  updateViewWidth()
})

// 从视图数据hook中解构出各种方法和状态(带p前缀)
const {
  selectedAllRecords: pSelectedAllRecords, // 是否选中所有记录
  formattedData: pData, // 格式化后的数据
  paginationData: pPaginationData, // 分页数据
  loadData: pLoadData, // 加载数据
  changePage: pChangePage, // 换页
  aggCommentCount: pAggCommentCount, // 聚合评论计数
  addEmptyRow: pAddEmptyRow, // 添加空行
  deleteRow: pDeleteRow, // 删除行
  updateOrSaveRow: pUpdateOrSaveRow, // 更新或保存行
  deleteSelectedRows: pDeleteSelectedRows, // 删除选中的行
  deleteRangeOfRows: pDeleteRangeOfRows, // 删除范围内的行
  bulkUpdateRows: pBulkUpdateRows, // 批量更新行
  removeRowIfNew: pRemoveRowIfNew, // 如果是新行则移除
  isFirstRow: pisFirstRow, // 是否是第一行
  islastRow: pisLastRow, // 是否是最后一行
  getExpandedRowIndex: pGetExpandedRowIndex, // 获取展开行的索引
  changePage: pChangeView, // 切换视图
} = useViewData(meta, view, xWhere)

// 更新行评论计数
const updateRowCommentCount = (count: number) => {
  // 如果没有rowId则返回
  if (!routeQuery.value.rowId) return

  // 如果启用了无限滚动
  if (isInfiniteScrollingEnabled.value) {
    // 从缓存行中查找当前行索引
    const currentRowIndex = Array.from(cachedRows.value.values()).find(
      (row) => extractPkFromRow(row.row, meta.value!.columns!) === routeQuery.value.rowId,
    )?.rowMeta.rowIndex

    // 如果找不到索引则返回
    if (currentRowIndex === undefined) return

    // 获取当前行
    const currentRow = cachedRows.value.get(currentRowIndex)
    if (!currentRow) return

    // 更新评论计数
    currentRow.rowMeta.commentCount = count

    // 同步可见数据
    syncVisibleData?.()
  } else {
    // 否则使用普通分页模式
    // 查找聚合评论计数索引
    const aggCommentCountIndex = pAggCommentCount.value.findIndex((row) => row.row_id === routeQuery.value.rowId)
    // 查找当前行索引
    const currentRowIndex = pData.value.findIndex(
      (row) => extractPkFromRow(row.row, meta.value?.columns as ColumnType[]) === routeQuery.value.rowId,
    )

    // 如果找不到索引则返回
    if (aggCommentCountIndex === -1 || currentRowIndex === -1) return

    // 如果评论计数没有变化则返回
    if (Number(pAggCommentCount.value[aggCommentCountIndex].count) === count) return
    // 更新聚合评论计数
    pAggCommentCount.value[aggCommentCountIndex].count = count
    // 更新行数据的评论计数
    pData.value[currentRowIndex].rowMeta.commentCount = count
  }
}

// 分页模式下的导航到下一行
const pGoToNextRow = () => {
  // 获取当前展开行的索引
  const currentIndex = pGetExpandedRowIndex()
  /* 当到达当前页的最后一行时，应该移动到下一页 */
  if (!pPaginationData.value.isLastPage && currentIndex === pPaginationData.value.pageSize) {
    // 计算下一页页码
    const nextPage = pPaginationData.value?.page ? pPaginationData.value?.page + 1 : 1
    // 切换视图到下一页
    pChangeView(nextPage)
  }
  // 导航到下一行
  navigateToSiblingRow(NavigateDir.NEXT)
}

// 分页模式下的导航到上一行
const pGoToPreviousRow = () => {
  // 获取当前展开行的索引
  const currentIndex = pGetExpandedRowIndex()
  /* 当到达当前页的第一行时点击返回，应该加载上一页 */
  if (!pPaginationData.value.isFirstPage && currentIndex === 1) {
    // 计算上一页页码
    const nextPage = pPaginationData.value?.page ? pPaginationData.value?.page - 1 : 1
    // 切换视图到上一页
    pChangeView(nextPage)
  }
  // 导航到上一行
  navigateToSiblingRow(NavigateDir.PREV)
}
</script>

<template>
  <!-- 主容器：相对定位的弹性列布局，占满高度和宽度的网格包装器 -->
  <div
    class="relative flex flex-col h-full min-h-0 w-full nc-grid-wrapper"
    data-testid="nc-grid-wrapper"
    :style="`background-color: ${isGroupBy ? `${baseColor}` : 'var(--nc-grid-bg)'};`"
  >
    <!-- 基础表格组件：当不是分组视图且未启用无限滚动时显示 -->
    <Table
      v-if="!isGroupBy && !isInfiniteScrollingEnabled"
      ref="tableRef"
      v-model:selected-all-records="pSelectedAllRecords"
      :data="pData"
      :pagination-data="pPaginationData"
      :load-data="pLoadData"
      :change-page="pChangePage"
      :call-add-empty-row="pAddEmptyRow"
      :delete-row="pDeleteRow"
      :update-or-save-row="pUpdateOrSaveRow"
      :delete-selected-rows="pDeleteSelectedRows"
      :delete-range-of-rows="pDeleteRangeOfRows"
      :bulk-update-rows="pBulkUpdateRows"
      :expand-form="expandForm"
      :remove-row-if-new="pRemoveRowIfNew"
      :row-height-enum="rowHeight"
      @toggle-optimised-query="toggleOptimisedQuery"
      @bulk-update-dlg="bulkUpdateDlg = true"
    />

    <!-- Canvas表格组件：当不是分组视图且启用了无限滚动和Canvas表格功能时显示 -->
    <CanvasTable
      v-else-if="!isGroupBy && isInfiniteScrollingEnabled && isCanvasTableEnabled"
      ref="tableRef"
      v-model:selected-all-records="selectedAllRecords"
      :load-data="loadData"
      :call-add-empty-row="_addEmptyRow"
      :delete-row="deleteRow"
      :update-or-save-row="updateOrSaveRow"
      :delete-selected-rows="deleteSelectedRows"
      :delete-range-of-rows="deleteRangeOfRows"
      :apply-sorting="applySorting"
      :bulk-update-rows="bulkUpdateRows"
      :bulk-upsert-rows="bulkUpsertRows"
      :update-record-order="updateRecordOrder"
      :bulk-delete-all="bulkDeleteAll"
      :clear-cache="clearCache"
      :clear-invalid-rows="clearInvalidRows"
      :data="cachedRows"
      :total-rows="totalRows"
      :sync-count="syncCount"
      :get-rows="getRows"
      :chunk-states="chunkStates"
      :expand-form="expandForm"
      :remove-row-if-new="removeRowIfNew"
      :row-height-enum="rowHeight"
      :selected-rows="selectedRows"
      :row-sort-required-rows="isRowSortRequiredRows"
      :is-bulk-operation-in-progress="isBulkOperationInProgress"
      @toggle-optimised-query="toggleOptimisedQuery"
      @bulk-update-dlg="bulkUpdateDlg = true"
    />

    <!-- 无限滚动表格组件：当不是分组视图且启用了无限滚动但未启用Canvas表格时显示 -->
    <InfiniteTable
      v-else-if="!isGroupBy"
      ref="tableRef"
      v-model:selected-all-records="selectedAllRecords"
      :load-data="loadData"
      :call-add-empty-row="_addEmptyRow"
      :delete-row="deleteRow"
      :update-or-save-row="updateOrSaveRow"
      :delete-selected-rows="deleteSelectedRows"
      :delete-range-of-rows="deleteRangeOfRows"
      :apply-sorting="applySorting"
      :bulk-update-rows="bulkUpdateRows"
      :bulk-upsert-rows="bulkUpsertRows"
      :get-rows="getRows"
      :update-record-order="updateRecordOrder"
      :bulk-delete-all="bulkDeleteAll"
      :clear-cache="clearCache"
      :clear-invalid-rows="clearInvalidRows"
      :data="cachedRows"
      :total-rows="totalRows"
      :sync-count="syncCount"
      :chunk-states="chunkStates"
      :expand-form="expandForm"
      :remove-row-if-new="removeRowIfNew"
      :row-height-enum="rowHeight"
      :selected-rows="selectedRows"
      :row-sort-required-rows="isRowSortRequiredRows"
      :is-bulk-operation-in-progress="isBulkOperationInProgress"
      @toggle-optimised-query="toggleOptimisedQuery"
      @bulk-update-dlg="bulkUpdateDlg = true"
    />

    <!-- 分组视图组件：当启用分组视图时显示 -->
    <GroupBy
      v-else
      :group="rootGroup"
      :load-groups="loadGroups"
      :load-group-data="loadGroupData"
      :call-add-empty-row="pAddEmptyRow"
      :expand-form="expandForm"
      :load-group-page="loadGroupPage"
      :group-wrapper-change-page="groupWrapperChangePage"
      :row-height="rowHeight"
      :load-group-aggregation="loadGroupAggregation"
      :max-depth="groupBy.length"
      :redistribute-rows="redistributeRows"
      :view-width="viewWidth"
    />
    <!-- 异步加载组件包装器：用于延迟加载展开表单组件 -->
    <Suspense>
      <!-- 懒加载的智能表格展开表单：当有展开的行且展开表单对话框为真时显示 -->
      <LazySmartsheetExpandedForm
        v-if="expandedFormRow && expandedFormDlg"
        v-model="expandedFormDlg"
        :load-row="!isPublic"
        :row="expandedFormRow"
        :state="expandedFormRowState"
        :meta="meta"
        :view="view"
        @update:model-value="addRowExpandOnClose(expandedFormRow)"
      />
    </Suspense>
    <!-- 智能表格展开表单：当通过路由查询参数rowId展开表单对话框且有元数据ID且不是分组视图时显示 -->
    <SmartsheetExpandedForm
      v-if="expandedFormOnRowIdDlg && meta?.id && !isGroupBy"
      v-model="expandedFormOnRowIdDlg"
      :row="expandedFormRow ?? { row: {}, oldRow: {}, rowMeta: {} }"
      :meta="meta"
      :load-row="!isPublic"
      :state="expandedFormRowState"
      :row-id="routeQuery.rowId"
      :view="view"
      show-next-prev-icons
      :first-row="isInfiniteScrollingEnabled ? isFirstRow : pisFirstRow"
      :last-row="isInfiniteScrollingEnabled ? isLastRow : pisLastRow"
      :expand-form="expandForm"
      @next="isInfiniteScrollingEnabled ? goToNextRow() : pGoToNextRow()"
      @prev="isInfiniteScrollingEnabled ? goToPreviousRow() : pGoToPreviousRow()"
      @update-row-comment-count="updateRowCommentCount"
    />
    <!-- 异步加载组件包装器：用于延迟加载批量更新对话框组件 -->
    <Suspense>
      <!-- 懒加载的批量更新对话框：当批量更新对话框为真时显示 -->
      <LazyDlgBulkUpdate
        v-if="bulkUpdateDlg"
        v-model="bulkUpdateDlg"
        :meta="meta"
        :view="view"
        :bulk-update-rows="bulkUpdateRows"
        :rows="selectedRows"
      />
    </Suspense>
  </div>
</template>

<style lang="scss">
/* 网格分页包装器中的下拉按钮样式 */
.nc-grid-pagination-wrapper .ant-dropdown-button {
  /* 主按钮样式：内边距为0，左侧圆角，悬停时边框颜色为灰色 */
  > .ant-btn {
    @apply !p-0 !rounded-l-lg hover:border-gray-300;
  }

  /* 下拉触发器样式：右侧圆角，左侧无圆角 */
  > .ant-dropdown-trigger {
    @apply !rounded-r-lg;
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
  }

  /* 整个按钮组样式：四周圆角 */
  @apply !rounded-lg;
}
</style>
