<script setup lang="ts">
// 导入可拖拽组件
import Draggable from 'vuedraggable'
// 导入表格类型和视图类型的接口定义
import type { TableType, ViewType } from 'nocodb-sdk'
// 导入项目包装器组件
import ProjectWrapper from './ProjectWrapper.vue'

// 从角色工具函数中获取 isUIAllowed 方法，用于检查用户是否有权限访问特定 UI 元素
const { isUIAllowed } = useRoles()

// 从 Nuxt 应用实例中获取事件跟踪器和 API 客户端
const { $e, $api } = useNuxtApp()

// 获取路由器实例
const router = useRouter()

// 获取当前路由
const route = router.currentRoute

// 获取基础存储（项目存储）
const basesStore = useBases()

// 从基础存储中解构出创建项目和更新项目的方法
const { createProject: _createProject, updateProject } = basesStore

// 从基础存储中获取响应式引用：基础映射、基础列表和活动项目 ID
const { bases, basesList, activeProjectId } = storeToRefs(basesStore)

// 从工作区存储中获取工作区加载状态的响应式引用
const { isWorkspaceLoading } = storeToRefs(useWorkspace())

// 创建一个响应式引用，用于控制基础创建对话框是否打开
const baseCreateDlg = ref(false)

// 获取基础存储（单个基础/项目的存储）
const baseStore = useBase()

// 从基础存储中获取加载表格的方法
const { loadTables } = baseStore

// 从基础存储中获取响应式引用：是否为共享基础和当前基础
const { isSharedBase, base } = storeToRefs(baseStore)

// 从标签页存储中获取更新标签页的方法
const { updateTab } = useTabs()

// 获取表格存储
const tablesStore = useTablesStore()

// 从表格存储中获取加载项目表格的方法
const { loadProjectTables } = tablesStore

// 从表格存储中获取活动表格的响应式引用
const { activeTable: _activeTable } = storeToRefs(tablesStore)

// 从全局状态中获取是否为移动模式
const { isMobileMode } = useGlobal()

// 从元数据存储中获取设置元数据的方法
const { setMeta } = useMetas()

// 从视图存储中获取所有最近视图的响应式引用
const { allRecentViews } = storeToRefs(useViewsStore())

// 从命令面板中获取刷新命令面板的方法
const { refreshCommandPalette } = useCommandPalette()

// 从撤销重做功能中获取添加撤销和定义项目范围的方法
const { addUndo, defineProjectScope } = useUndoRedo()

// 创建一个响应式对象，用于存储上下文菜单的目标类型和值
const contextMenuTarget = reactive<{ type?: 'base' | 'source' | 'table' | 'main' | 'layout'; value?: any }>({})

// 设置菜单上下文的函数，接收类型和值作为参数
const setMenuContext = (type: 'base' | 'source' | 'table' | 'main' | 'layout', value?: any) => {
  contextMenuTarget.type = type
  contextMenuTarget.value = value
}

// 打开视图描述对话框的函数
function openViewDescriptionDialog(view: ViewType) {
  // 如果视图不存在或没有 ID，则返回
  if (!view || !view.id) return

  // 触发视图描述事件
  $e('c:view:description')

  // 创建一个响应式引用，用于控制对话框是否打开
  const isOpen = ref(true)

  // 使用对话框工具函数打开视图描述更新对话框
  const { close } = useDialog(resolveComponent('DlgViewDescriptionUpdate'), {
    'modelValue': isOpen,
    'view': view,
    'onUpdate:modelValue': closeDialog,
  })

  // 关闭对话框的函数
  function closeDialog() {
    isOpen.value = false

    // 延迟关闭对话框
    close(1000)
  }
}

// 打开表格描述对话框的函数
function openTableDescriptionDialog(table: TableType) {
  // 如果表格不存在或没有 ID，则返回
  if (!table || !table.id) return

  // 触发表格描述事件
  $e('c:table:description')

  // 创建一个响应式引用，用于控制对话框是否打开
  const isOpen = ref(true)

  // 使用对话框工具函数打开表格描述更新对话框
  const { close } = useDialog(resolveComponent('DlgTableDescriptionUpdate'), {
    'modelValue': isOpen,
    'tableMeta': table,
    'onUpdate:modelValue': closeDialog,
  })

  // 关闭对话框的函数
  function closeDialog() {
    isOpen.value = false

    // 延迟关闭对话框
    close(1000)
  }
}

/**
 * tableRenameId is combination of tableId & sourceId
 * @example `${tableId}:${sourceId}`
 */
// 创建一个响应式引用，用于存储表格重命名 ID（表格 ID 和源 ID 的组合）
const tableRenameId = ref('')

// 处理表格重命名的异步函数
async function handleTableRename(
  table: TableType,
  title: string,
  originalTitle: string,
  updateTitle: (title: string) => void,
  undo = false,
  disableTitleDiffCheck?: boolean,
) {
  // 如果表格不存在或没有源 ID，则返回
  if (!table || !table.source_id) return

  // 如果标题存在，则去除首尾空格
  if (title) {
    title = title.trim()
  }

  // 如果标题与原始标题相同且未禁用标题差异检查，则返回
  if (title === originalTitle && !disableTitleDiffCheck) return

  // 更新标题
  updateTitle(title)

  try {
    // 调用 API 更新表格
    await $api.dbTable.update(table.id as string, {
      base_id: table.base_id,
      table_name: title,
      title,
    })

    // 重新加载项目表格
    await loadProjectTables(table.base_id!, true)

    // 如果不是撤销操作，则添加撤销记录
    if (!undo) {
      addUndo({
        // 重做操作
        redo: {
          fn: (table: TableType, t: string, ot: string, updateTitle: (title: string) => void) => {
            handleTableRename(table, t, ot, updateTitle, true, true)
          },
          args: [table, title, originalTitle, updateTitle],
        },
        // 撤销操作
        undo: {
          fn: (table: TableType, t: string, ot: string, updateTitle: (title: string) => void) => {
            handleTableRename(table, t, ot, updateTitle, true, true)
          },
          args: [table, originalTitle, title, updateTitle],
        },
        // 定义项目范围
        scope: defineProjectScope({ model: table }),
      })
    }

    // 加载表格
    await loadTables()

    // 更新最近视图，如果默认视图被重命名
    allRecentViews.value = allRecentViews.value.map((v) => {
      if (v.tableID === table.id) {
        if (v.isDefault) v.viewName = title

        v.tableName = title
      }
      return v
    })

    // 更新元数据
    const newMeta = await $api.dbTable.read(table.id as string)
    await setMeta(newMeta)

    // 更新标签页
    updateTab({ id: table.id }, { title: newMeta.title })

    // 刷新命令面板
    refreshCommandPalette()

    // 触发表格重命名事件
    $e('a:table:rename')
  } catch (e: any) {
    // 显示错误消息
    message.error(await extractSdkResponseErrorMsg(e))
    // 恢复原始标题
    updateTitle(originalTitle)
  }
}

// 打开表格创建对话框的函数
function openTableCreateDialog(sourceId?: string, baseId?: string) {
  // 如果没有源 ID 且没有基础 ID 或基础列表的第一个项目的 ID，则返回
  if (!sourceId && !(baseId || basesList.value[0].id)) return

  // 触发表格创建事件
  $e('c:table:create:navdraw')

  // 创建一个响应式引用，用于控制对话框是否打开
  const isOpen = ref(true)

  // 使用对话框工具函数打开表格创建对话框
  const { close } = useDialog(resolveComponent('DlgTableCreate'), {
    'modelValue': isOpen,
    'sourceId': sourceId, // || sources.value[0].id,
    'baseId': baseId || basesList.value[0].id,
    'onUpdate:modelValue': closeDialog,
  })

  // 关闭对话框的函数
  function closeDialog() {
    isOpen.value = false

    // 延迟关闭对话框
    close(1000)
  }
}

// 复制表格的异步函数
const duplicateTable = async (table: TableType) => {
  // 如果表格不存在或没有 ID 或基础 ID，则返回
  if (!table || !table.id || !table.base_id) return

  // 创建一个响应式引用，用于控制对话框是否打开
  const isOpen = ref(true)

  // 触发表格复制事件
  $e('c:table:duplicate')

  // 使用对话框工具函数打开表格复制对话框
  const { close } = useDialog(resolveComponent('DlgTableDuplicate'), {
    'modelValue': isOpen,
    'table': table,
    'onUpdate:modelValue': closeDialog,
  })

  // 关闭对话框的函数
  function closeDialog() {
    isOpen.value = false

    // 延迟关闭对话框
    close(1000)
  }
}

// 计算是否允许创建表格
const isCreateTableAllowed = computed(
  () =>
    // 基础的第一个源存在
    base.value?.sources?.[0] &&
    // 用户有权限创建表格
    isUIAllowed('tableCreate', { source: base.value?.sources?.[0] }) &&
    // 当前路由不是以下任何一个
    route.value.name !== 'index' &&
    route.value.name !== 'index-index' &&
    route.value.name !== 'index-index-create' &&
    route.value.name !== 'index-index-create-external' &&
    route.value.name !== 'index-user-index',
)

// 添加键盘事件监听器
useEventListener(document, 'keydown', async (e: KeyboardEvent) => {
  // 根据操作系统确定命令键或控制键
  const cmdOrCtrl = isMac() ? e.metaKey : e.ctrlKey

  // 如果存在活动的输入元素，则返回
  if (isActiveInputElementExist()) {
    return
  }

  // 如果按下了 Alt 键，但没有按下 Shift 键和命令/控制键
  if (e.altKey && !e.shiftKey && !cmdOrCtrl) {
    switch (e.keyCode) {
      case 84: {
        // ALT + T
        if (isCreateTableAllowed.value && !isDrawerOrModalExist()) {
          // 防止键 `T` 输入到表格标题输入框
          e.preventDefault()
          // 触发快捷键事件
          $e('c:shortcut', { key: 'ALT + T' })
          // 获取活动项目 ID
          const baseId = activeProjectId.value
          // 获取基础
          const base = baseId ? bases.value.get(baseId) : undefined
          // 如果基础不存在，则返回
          if (!base) return

          // 如果基础 ID 存在，则打开表格创建对话框
          if (baseId) openTableCreateDialog(base.sources?.[0].id, baseId)
        }
        break
      }
      // ALT + L - 只显示活动基础
      case 76: {
        if (route.value.params.baseId) {
          // 导航到当前路由，但更新查询参数
          router.push({
            query: {
              ...route.value.query,
              clear: route.value.query.clear === '1' ? undefined : '1',
            },
          })
        }
        break
      }
      // ALT + D - 打开基础创建对话框
      case 68: {
        // 阻止事件传播
        e.stopPropagation()
        // 打开基础创建对话框
        baseCreateDlg.value = true
        break
      }
    }
  }
})

// 处理上下文菜单的函数
const handleContext = (e: MouseEvent) => {
  // 如果点击的不是源上下文或表格上下文元素，则设置主菜单上下文
  if (!document.querySelector('.source-context, .table-context')?.contains(e.target as Node)) {
    setMenuContext('main')
  }
}

// 提供树视图注入，使子组件可以访问这些方法和属性
provide(TreeViewInj, {
  setMenuContext,
  duplicateTable,
  handleTableRename,
  openViewDescriptionDialog,
  openTableDescriptionDialog,
  contextMenuTarget,
  tableRenameId,
})

// 添加上下文菜单事件监听器
useEventListener(document, 'contextmenu', handleContext, true)

// 滚动到表格节点的函数
const scrollTableNode = () => {
  // 查找活动表格的 DOM 元素
  const activeTableDom = document.querySelector(`.nc-treeview [data-table-id="${_activeTable.value?.id}"]`)
  // 如果元素不存在，则返回
  if (!activeTableDom) return

  // 滚动到表格节点
  activeTableDom?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
}

// 处理项目移动的异步函数
const onMove = async (_event: { moved: { newIndex: number; oldIndex: number; element: NcProject } }) => {
  // 从事件中解构出移动的信息
  const {
    moved: { newIndex = 0, oldIndex = 0, element },
  } = _event

  // 如果元素不存在或没有 ID，则返回
  if (!element?.id) return

  // 声明下一个顺序变量
  let nextOrder: number

  // 根据项目在列表中的新位置设置新的顺序值
  if (basesList.value.length - 1 === newIndex) {
    // 如果移动到末尾，则将 nextOrder 设置为列表中最大顺序值加 1
    nextOrder = Math.max(...basesList.value.map((item) => item?.order ?? 0)) + 1
  } else if (newIndex === 0) {
    // 如果移动到开头，则将 nextOrder 设置为列表中最小顺序值除以 2
    nextOrder = Math.min(...basesList.value.map((item) => item?.order ?? 0)) / 2
  } else {
    // 否则，将 nextOrder 设置为前一个项目和后一个项目的顺序值的平均值
    nextOrder =
      (parseFloat(String(basesList.value[newIndex - 1]?.order ?? 0)) +
        parseFloat(String(basesList.value[newIndex + 1]?.order ?? 0))) /
      2
  }

  // 如果 nextOrder 不是数字，则使用旧索引
  const _nextOrder = !isNaN(Number(nextOrder)) ? nextOrder : oldIndex

  // 更新项目的顺序
  await updateProject(element.id, {
    order: _nextOrder,
  })

  // 触发基础重新排序事件
  $e('a:base:reorder')
}

// 监视活动表格 ID 的变化
watch(
  () => _activeTable.value?.id,
  () => {
    // 如果活动表格 ID 不存在，则返回
    if (!_activeTable.value?.id) return

    // TODO: Find a better way to scroll to the table node
    // 延迟滚动到表格节点
    setTimeout(() => {
      scrollTableNode()
    }, 1000)
  },
  {
    // 立即执行监视回调
    immediate: true,
  },
)
</script>

<template>
  <!-- 树视图容器 -->
  <div class="nc-treeview-container flex flex-col justify-between select-none">
    <!-- 如果不是共享基础，则显示项目标题 -->
    <div v-if="!isSharedBase" class="text-gray-500 font-medium pl-3.5 mb-1">{{ $t('objects.projects') }}</div>
    <!-- 树视图主体 -->
    <div mode="inline" class="nc-treeview pb-0.5 flex-grow min-h-50 overflow-x-hidden">
      <!-- 如果基础列表有内容，则显示可拖拽的基础列表 -->
      <div v-if="basesList?.length">
        <Draggable
          :model-value="basesList"
          :disabled="isMobileMode || !isUIAllowed('baseReorder') || basesList?.length < 2"
          item-key="id"
          handle=".base-title-node"
          ghost-class="ghost"
          :filter="isTouchEvent"
          @change="onMove($event)"
        >
          <!-- 项目模板 -->
          <template #item="{ element: baseItem }">
            <div :key="baseItem.id">
              <!-- 项目包装器组件 -->
              <ProjectWrapper :base-role="baseItem.project_role" :base="baseItem">
                <!-- 项目节点组件 -->
                <DashboardTreeViewProjectNode />
              </ProjectWrapper>
            </div>
          </template>
        </Draggable>
      </div>

      <!-- 如果基础列表为空且工作区不在加载中，则显示工作区空占位符 -->
      <WorkspaceEmptyPlaceholder v-else-if="!isWorkspaceLoading" />
    </div>
    <!-- 工作区创建项目对话框 -->
    <WorkspaceCreateProjectDlg v-model="baseCreateDlg" />
  </div>
</template>

<style scoped lang="scss">
/* 幽灵元素和其子元素的样式 */
.ghost,
.ghost > * {
  @apply pointer-events-none;
}
/* 幽灵元素的样式 */
.ghost {
  @apply bg-primary-selected;
}
</style>
