<script lang="ts" setup>
// 导入 ViewType 类型定义
import type { ViewType } from 'nocodb-sdk'
// 导入视图类型枚举和别名映射
import { ViewTypes, viewTypeAlias } from 'nocodb-sdk'
// 导入 SortableEvent 类型定义，用于拖拽排序事件
import type { SortableEvent } from 'sortablejs'
// 导入 Sortable 库，用于实现拖拽排序功能
import Sortable from 'sortablejs'
// 导入 Ant Design Vue 的 Menu 组件类型
import type { Menu as AntMenu } from 'ant-design-vue'

// 定义组件的事件接口
interface Emits {
  // 打开模态框事件，传递视图类型和相关配置
  (
    event: 'openModal',
    data: {
      // 视图类型
      type: ViewTypes
      // 视图标题（可选）
      title?: string
      // 要复制的视图ID（可选）
      copyViewId?: string
      // 分组字段列ID（可选）
      groupingFieldColumnId?: string
      // 封面图片列ID（可选）
      coverImageColumnId?: string
    },
  ): void

  // 删除事件
  (event: 'deleted'): void
}

// 定义组件的事件
const emits = defineEmits<Emits>()
// 注入当前项目/基础信息
const base = inject(ProjectInj)!
// 注入当前表格信息
const table = inject(SidebarTableInj)!

// 从侧边栏存储中获取左侧侧边栏是否打开的状态
const { isLeftSidebarOpen } = storeToRefs(useSidebarStore())

// 从表格存储中获取当前活动表格ID
const { activeTableId } = storeToRefs(useTablesStore())

// 获取权限检查函数
const { isUIAllowed } = useRoles()

// 获取是否为移动设备模式
const { isMobileMode } = useGlobal()

// 获取是否为共享基础的状态
const { isSharedBase } = storeToRefs(useBase())

// 获取事件跟踪函数
const { $e } = useNuxtApp()

// 获取国际化翻译函数
const { t } = useI18n()

// 从视图存储中获取表格视图映射、当前活动视图和所有最近访问的视图
const { viewsByTable, activeView, allRecentViews } = storeToRefs(useViewsStore())

// 获取导航到表格的函数
const { navigateToTable } = useTablesStore()

// 计算当前表格的所有非默认视图
const views = computed(() => viewsByTable.value.get(table.value.id!)?.filter((v) => !v.is_default) ?? [])

// 获取API实例
const { api } = useApi()

// 获取刷新命令面板的函数
const { refreshCommandPalette } = useCommandPalette()

// 获取撤销/重做相关函数
const { addUndo, defineModelScope } = useUndoRedo()

// 获取视图导航、加载和从最近视图中移除的函数
const { navigateToView, loadViews, removeFromRecentViews } = useViewsStore()

// 选中的视图ID数组，用于菜单高亮
const selected = ref<string[]>([])

// 是否正在拖拽视图项
const dragging = ref(false)

// 菜单引用，用于获取DOM元素
const menuRef = ref<typeof AntMenu>()

// 标记的视图ID，用于排序后短暂高亮
const isMarked = ref<string | false>(false)

// 监视当前活动视图变化，以便在菜单中标记它
watch(activeView, (nextActiveView) => {
  if (nextActiveView && nextActiveView.id) {
    selected.value = [nextActiveView.id]
  }
})

// 短暂标记一个项目（排序后）
function markItem(id: string) {
  isMarked.value = id
  // 300毫秒后取消标记
  setTimeout(() => {
    isMarked.value = false
  }, 300)
}

// 计算当前数据源
const source = computed(() => base.value?.sources?.find((b) => b.id === table.value.source_id))

// 计算是否为默认数据源
const isDefaultSource = computed(() => {
  // 如果只有一个数据源，则为默认
  if (base.value?.sources?.length === 1) return true

  // 如果没有找到数据源，则不是默认
  if (!source.value) return false

  // 检查是否为默认基础
  return isDefaultBase(source.value)
})

// 验证视图标题
function validate(view: ViewType) {
  // 检查标题是否为空
  if (!view.title || view.title.trim().length < 0) {
    return t('msg.error.viewNameRequired')
  }

  // 检查标题是否重复
  if (views.value.some((v) => v.title === view.title && v.id !== view.id)) {
    return t('msg.error.viewNameDuplicate')
  }

  // 验证通过
  return true
}

// Sortable实例
let sortable: Sortable

// 排序开始时的处理函数
function onSortStart(evt: SortableEvent) {
  // 阻止事件冒泡和默认行为
  evt.stopImmediatePropagation()
  evt.preventDefault()
  // 设置拖拽状态为true
  dragging.value = true
}

// 排序结束时的处理函数
async function onSortEnd(evt: SortableEvent, undo = false) {
  // 如果不是撤销操作
  if (!undo) {
    // 阻止事件冒泡和默认行为
    evt.stopImmediatePropagation()
    evt.preventDefault()
    // 设置拖拽状态为false
    dragging.value = false
  }

  // 如果视图数量少于2，则不需要排序
  if (views.value.length < 2) return

  // 获取新旧索引
  let { newIndex = 0, oldIndex = 0 } = evt

  // 调整索引（减1是因为第一个元素是"创建视图"按钮）
  newIndex = newIndex - 1
  oldIndex = oldIndex - 1

  // 如果位置没有变化，则不做任何处理
  if (newIndex === oldIndex) return

  // 如果不是撤销操作，添加撤销/重做记录
  if (!undo) {
    addUndo({
      // 重做操作
      redo: {
        fn: async () => {
          // 获取当前排序顺序
          const ord = sortable.toArray()
          // 从旧位置移除元素
          const temp = ord.splice(oldIndex, 1)
          // 插入到新位置
          ord.splice(newIndex, 0, temp[0])
          // 应用新排序
          sortable.sort(ord)
          // 执行排序结束处理
          await onSortEnd(evt, true)
        },
        args: [],
      },
      // 撤销操作
      undo: {
        fn: async () => {
          // 获取当前排序顺序
          const ord = sortable.toArray()
          // 从新位置移除元素
          const temp = ord.splice(newIndex, 1)
          // 插入到旧位置
          ord.splice(oldIndex, 0, temp[0])
          // 应用新排序
          sortable.sort(ord)
          // 执行排序结束处理（交换新旧索引）
          await onSortEnd({ ...evt, oldIndex: newIndex, newIndex: oldIndex }, true)
        },
        args: [],
      },
      // 定义模型作用域
      scope: defineModelScope({ view: activeView.value }),
    })
  }

  // 获取所有子元素
  const children = Array.from(evt.to.children as unknown as HTMLLIElement[])

  // 移除"创建视图"子元素
  children.shift()

  // 获取前一个和后一个元素
  const previousEl = children[newIndex - 1]
  const nextEl = children[newIndex + 1]

  // 查找当前项
  const currentItem = views.value.find((v) => v.id === evt.item.id)

  // 如果找不到当前项或ID，则退出
  if (!currentItem || !currentItem.id) return

  // 设置默认顺序值为0（如果找不到项）
  const previousItem = (previousEl ? views.value.find((v) => v.id === previousEl.id) ?? { order: 0 } : { order: 0 }) as ViewType
  const nextItem = (nextEl ? views.value.find((v) => v.id === nextEl.id) : {}) as ViewType

  // 下一个顺序值
  let nextOrder: number

  // 根据新顺序设置顺序值
  if (views.value.length - 1 === newIndex) {
    // 如果是最后一项，则顺序值为前一项的顺序值加1
    nextOrder = parseFloat(String(previousItem.order)) + 1
  } else if (newIndex === 0) {
    // 如果是第一项，则顺序值为后一项的顺序值除以2
    nextOrder = parseFloat(String(nextItem.order)) / 2
  } else {
    // 如果是中间项，则顺序值为前后两项顺序值的平均值
    nextOrder = (parseFloat(String(previousItem.order)) + parseFloat(String(nextItem.order))) / 2
  }

  // 如果计算出的顺序值不是数字，则使用旧索引
  const _nextOrder = !isNaN(Number(nextOrder)) ? nextOrder : oldIndex

  // 更新当前项的顺序值
  currentItem.order = _nextOrder

  // 调用API更新视图顺序
  await api.dbView.update(currentItem.id, { order: _nextOrder })

  // 标记当前项（短暂高亮）
  markItem(currentItem.id)

  // 记录视图重新排序事件
  $e('a:view:reorder')
}

// 初始化拖拽排序功能
const initSortable = (el: HTMLElement) => {
  // 如果已存在Sortable实例，先销毁它
  if (sortable) sortable.destroy()
  // 如果是移动设备模式，则不启用拖拽
  if (isMobileMode.value) return

  // 创建新的Sortable实例
  sortable = new Sortable(el, {
    // 设置拖拽句柄（已注释）
    // handle: '.nc-drag-icon',
    // 设置拖拽时的幽灵类
    ghostClass: 'ghost',
    // 拖拽开始时的回调
    onStart: onSortStart,
    // 拖拽结束时的回调
    onEnd: onSortEnd,
    // 过滤触摸事件
    filter: isTouchEvent,
  })
}

// 组件挂载后初始化拖拽功能
onMounted(() => menuRef.value && isUIAllowed('viewCreateOrEdit') && initSortable(menuRef.value.$el))

// 通过改变URL参数导航到视图
async function changeView(view: ViewType) {
  // 导航到指定视图
  await navigateToView({
    view,
    tableId: table.value.id!,
    baseId: base.value.id!,
    // 如果是表单视图且当前已选中，则强制重新加载
    hardReload: view.type === ViewTypes.FORM && selected.value[0] === view.id,
    // 不切换标签页
    doNotSwitchTab: true,
  })

  // 如果是移动设备模式，则关闭左侧侧边栏
  if (isMobileMode.value) {
    isLeftSidebarOpen.value = false
  }
}

// 重命名视图
async function onRename(view: ViewType, originalTitle?: string, undo = false) {
  try {
    // 调用API更新视图标题和顺序
    await api.dbView.update(view.id!, {
      title: view.title,
      order: view.order,
    })

    // 导航到更新后的视图
    navigateToView({
      view,
      tableId: table.value.id!,
      baseId: base.value.id!,
      // 如果是表单视图且当前已选中，则强制重新加载
      hardReload: view.type === ViewTypes.FORM && selected.value[0] === view.id,
    })

    // 刷新命令面板
    refreshCommandPalette()

    // 如果不是撤销操作，添加撤销/重做记录
    if (!undo) {
      addUndo({
        // 重做操作
        redo: {
          fn: (v: ViewType, title: string) => {
            // 保存临时标题
            const tempTitle = v.title
            // 设置新标题
            v.title = title
            // 执行重命名
            onRename(v, tempTitle, true)
          },
          args: [view, view.title],
        },
        // 撤销操作
        undo: {
          fn: (v: ViewType, title: string) => {
            // 保存临时标题
            const tempTitle = v.title
            // 恢复原标题
            v.title = title
            // 执行重命名
            onRename(v, tempTitle, true)
          },
          args: [view, originalTitle],
        },
        // 定义模型作用域
        scope: defineModelScope({ view: activeView.value }),
      })
    }
    // 更新最近视图中的视图名称
    allRecentViews.value = allRecentViews.value.map((rv) => {
      if (rv.viewId === view.id && rv.tableID === view.fk_model_id) {
        rv.viewName = view.title
      }
      return rv
    })

    // 视图重命名成功（已注释）
    // message.success(t('msg.success.viewRenamed'))
  } catch (e: any) {
    // 显示错误消息
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

// 打开删除对话框
function openDeleteDialog(view: ViewType) {
  // 创建对话框打开状态
  const isOpen = ref(true)

  // 使用对话框组件
  const { close } = useDialog(resolveComponent('DlgViewDelete'), {
    // 绑定模型值
    'modelValue': isOpen,
    // 传递视图对象
    'view': view,
    // 监听模型值更新
    'onUpdate:modelValue': closeDialog,
    // 删除成功后的回调
    'onDeleted': async () => {
      // 关闭对话框
      closeDialog()

      // 触发删除事件
      emits('deleted')

      // 从最近视图中移除
      removeFromRecentViews({
        viewId: view.id,
        tableId: view.fk_model_id,
        baseId: base.value.id,
      })
      // 刷新命令面板
      refreshCommandPalette()
      // 如果当前活动视图是被删除的视图，则导航到表格
      if (activeView.value?.id === view.id) {
        navigateToTable({
          tableId: table.value.id!,
          baseId: base.value.id!,
        })
      }

      // 重新加载视图
      await loadViews({
        tableId: table.value.id!,
        force: true,
      })

      // 获取活动的非默认视图
      const activeNonDefaultViews = viewsByTable.value.get(table.value.id!)?.filter((v) => !v.is_default) ?? []

      // 更新表格元数据
      table.value.meta = {
        ...(table.value.meta as object),
        hasNonDefaultViews: activeNonDefaultViews.length > 1,
      }
    },
  })

  // 关闭对话框函数
  function closeDialog() {
    isOpen.value = false

    // 延迟关闭
    close(1000)
  }
}

// 设置视图图标
const setIcon = async (icon: string, view: ViewType) => {
  try {
    // 修改元数据中的图标属性
    view.meta = {
      ...parseProp(view.meta),
      icon,
    }

    // 调用API更新视图元数据
    api.dbView.update(view.id as string, {
      meta: view.meta,
    })

    // 记录设置图标事件
    $e('a:view:icon:sidebar', { icon })
  } catch (e: any) {
    // 显示错误消息
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

// 打开模态框
function onOpenModal({
  title = '',
  type,
  copyViewId,
  groupingFieldColumnId,
  calendarRange,
  coverImageColumnId,
}: {
  // 标题（可选）
  title?: string
  // 视图类型
  type: ViewTypes
  // 要复制的视图ID（可选）
  copyViewId?: string
  // 分组字段列ID（可选）
  groupingFieldColumnId?: string
  // 日历范围（可选）
  calendarRange?: Array<{
    fk_from_column_id: string
    fk_to_column_id: string | null // 仅用于企业版
  }>
  // 封面图片列ID（可选）
  coverImageColumnId?: string
}) {
  // 创建对话框打开状态
  const isOpen = ref(true)

  // 使用对话框组件
  const { close } = useDialog(resolveComponent('DlgViewCreate'), {
    // 绑定模型值
    'modelValue': isOpen,
    // 传递标题
    title,
    // 传递类型
    type,
    // 传递表格ID
    'tableId': table.value.id,
    // 传递选中的视图ID
    'selectedViewId': copyViewId,
    // 传递分组字段列ID
    groupingFieldColumnId,
    // 传递视图列表
    'views': views,
    // 传递日历范围
    calendarRange,
    // 传递封面图片列ID
    coverImageColumnId,
    // 传递基础ID
    'baseId': base.value.id,
    // 监听模型值更新
    'onUpdate:modelValue': closeDialog,
    // 创建成功后的回调
    'onCreated': async (view?: ViewType) => {
      // 关闭对话框
      closeDialog()

      // 刷新命令面板
      refreshCommandPalette()

      // 重新加载视图
      await loadViews({
        force: true,
        tableId: table.value.id!,
      })

      // 如果创建了视图，则导航到该视图
      if (view) {
        navigateToView({
          view,
          tableId: table.value.id!,
          baseId: base.value.id!,
          // 如果是表单视图且当前已选中，则强制重新加载
          hardReload: view.type === ViewTypes.FORM && selected.value[0] === view.id,
        })
      }

      // 记录创建视图事件
      $e('a:view:create', { view: view?.type || type })
    },
  })

  // 关闭对话框函数
  function closeDialog() {
    isOpen.value = false

    // 延迟关闭
    close(1000)
  }
}
</script>

<template>
  <!-- 视图菜单 -->
  <a-menu
    ref="menuRef"
    :class="{ dragging }"
    :selected-keys="selected"
    class="nc-views-menu flex flex-col w-full !border-r-0 !bg-inherit"
  >
    <!-- 非共享基础时显示创建视图按钮 -->
    <template v-if="!isSharedBase">
      <DashboardTreeViewCreateViewBtn
        v-if="isUIAllowed('viewCreateOrEdit')"
        :align-left-level="isDefaultSource ? 1 : 2"
        :class="{
          '!pl-13.3 !xs:(pl-13.5)': isDefaultSource,
          '!pl-18.6 !xs:(pl-20)': !isDefaultSource,
        }"
        :source="source"
      >
        <!-- 创建视图按钮内容 -->
        <div
          :class="{
            'text-brand-500 hover:text-brand-600': activeTableId === table.id,
            'text-gray-500 hover:text-brand-500': activeTableId !== table.id,
          }"
          class="nc-create-view-btn flex flex-row items-center cursor-pointer rounded-md w-full"
          role="button"
        >
          <div class="flex flex-row items-center pl-1.25 !py-1.5 text-inherit">
            <!-- 加号图标 -->
            <GeneralIcon icon="plus" />
            <div class="pl-1.75">
              {{
                $t('general.createEntity', {
                  entity: $t('objects.view'),
                })
              }}
            </div>
          </div>
        </div>
      </DashboardTreeViewCreateViewBtn>
    </template>
    <!-- 如果有视图则显示视图列表 -->
    <template v-if="views.length">
      <DashboardTreeViewViewsNode
        v-for="view of views"
        :id="view.id"
        :key="view.id"
        :class="{
          'bg-gray-200': isMarked === view.id,
          'active': activeView?.id === view.id,
          [`nc-${view.type ? viewTypeAlias[view.type] : undefined || view.type}-view-item`]: true,
        }"
        :data-view-id="view.id"
        :on-validate="validate"
        :table="table"
        :view="view"
        class="nc-view-item !rounded-md !px-0.75 !py-0.5 w-full transition-all ease-in duration-100"
        @delete="openDeleteDialog"
        @rename="onRename"
        @change-view="changeView"
        @open-modal="onOpenModal"
        @select-icon="setIcon($event, view)"
      />
    </template>
  </a-menu>
</template>

<style lang="scss">
.nc-views-menu {
  // 幽灵元素和其子元素样式
  .ghost,
  .ghost > * {
    @apply !pointer-events-none;
  }

  // 拖拽时的样式
  &.dragging {
    // 隐藏图标
    .nc-icon {
      @apply !hidden;
    }

    // 显示视图图标
    .nc-view-icon {
      @apply !block;
    }
  }

  // 非选中菜单项的样式
  .ant-menu-item:not(.sortable-chosen) {
    @apply color-transition;
  }

  // 菜单标题内容样式
  .ant-menu-title-content {
    @apply !w-full;
  }

  // 被选中进行排序的元素样式
  .sortable-chosen {
    @apply !bg-gray-200;
  }

  // 活动项样式
  .active {
    @apply !bg-primary-selected font-medium;
  }
}
</style>
