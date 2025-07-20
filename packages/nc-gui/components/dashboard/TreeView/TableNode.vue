<script lang="ts" setup>
// 导入类型定义和枚举
import { type BaseType, type TableType, ViewTypes } from 'nocodb-sdk'

// 导入自定义类型
import type { SidebarTableNode } from '~/lib/types'

// 定义组件属性，并设置默认值
const props = withDefaults(
  defineProps<{
    // 数据库基础信息
    base: BaseType
    // 表格节点信息
    table: SidebarTableNode
    // 数据源索引
    sourceIndex: number
  }>(),
  { sourceIndex: 0 }, // 默认数据源索引为0
)

// 将props转换为响应式引用
const { base, table, sourceIndex } = toRefs(props)

// 初始化表格打开功能
const { openTable: _openTable } = useTableNew({
  baseId: base.value.id!, // 使用基础ID初始化
})

// 获取当前路由信息
const route = useRoute()

// 检查用户角色权限
const { isUIAllowed } = useRoles()

// 检查是否为移动设备模式
const { isMobileMode } = useGlobal()

// 使用标签页存储
const tabStore = useTabs()
const { updateTab } = tabStore

// 获取Nuxt应用实例
const { $e, $api } = useNuxtApp()

// 检查数据库类型
const { isMysql, isMssql, isPg } = useBase()

// 再次初始化表格功能（可能用于不同场景）
useTableNew({
  baseId: base.value.id!,
})

// 使用魔术键（键盘快捷键）
const { meta: metaKey, control } = useMagicKeys()

// 注入项目角色信息
const baseRole = inject(ProjectRoleInj)
// 提供表格上下文
provide(SidebarTableInj, table)

// 注入树视图功能
const {
  setMenuContext, // 设置菜单上下文
  handleTableRename, // 处理表格重命名
  openTableDescriptionDialog: _openTableDescriptionDialog, // 打开表格描述对话框
  duplicateTable: _duplicateTable, // 复制表格
  tableRenameId, // 表格重命名ID
} = inject(TreeViewInj)!

// 使用视图存储
const { loadViews: _loadViews, navigateToView, duplicateView } = useViewsStore()
// 获取活动视图和表格视图
const { activeView, activeViewTitleOrId, viewsByTable } = storeToRefs(useViewsStore())
// 获取侧边栏状态
const { isLeftSidebarOpen } = storeToRefs(useSidebarStore())

// 使用命令面板
const { refreshCommandPalette } = useCommandPalette()

// 临时获取表格列表
const { baseTables } = storeToRefs(useTablesStore())
const tables = computed(() => baseTables.value.get(base.value.id!) ?? [])

// 计算当前打开的表格ID
const openedTableId = computed(() => route.params.viewId)

// 计算当前数据源
const source = computed(() => {
  return base.value?.sources?.[sourceIndex.value]
})

// 定义删除表格对话框可见性
const isTableDeleteDialogVisible = ref(false)

// 定义选项菜单打开状态
const isOptionsOpen = ref(false)

// 定义同步模态框打开状态
const isSyncModalOpen = ref(false)

// 定义输入框引用
const input = ref<HTMLInputElement>()

// 是否正在编辑表格名称
const isEditing = ref(false)

// 辅助检查编辑是否被禁用
const isStopped = ref(false)

// 使用表单验证
const useForm = Form.useForm

// 表单状态
const formState = reactive({
  title: '', // 表格名称
})

// 验证规则
const validators = computed(() => {
  return {
    title: [
      validateTableName, // 验证表格名称
      {
        validator: (rule: any, value: any) => {
          return new Promise<void>((resolve, reject) => {
            // 根据数据库类型设置表格名称长度限制
            let tableNameLengthLimit = 255
            if (isMysql(source.value?.id)) {
              tableNameLengthLimit = 64
            } else if (isPg(source.value?.id)) {
              tableNameLengthLimit = 63
            } else if (isMssql(source.value?.id)) {
              tableNameLengthLimit = 128
            }
            const basePrefix = base?.value?.prefix || ''
            if ((basePrefix + value).length > tableNameLengthLimit) {
              return reject(new Error(`Table name exceeds ${tableNameLengthLimit} characters`))
            }
            resolve()
          })
        },
      },
      {
        validator: (rule: any, value: any) => {
          return new Promise<void>((resolve, reject) => {
            // 检查表格名称是否重复
            if (
              !(tables?.value || []).every(
                (t) => t.id === table.value.id || t.title.toLowerCase() !== (value?.trim() || '').toLowerCase(),
              )
            ) {
              return reject(new Error('Duplicate table alias'))
            }
            resolve()
          })
        },
      },
    ],
  }
})

// 验证表单
const { validate } = useForm(formState, validators)

// 设置表格图标
const setIcon = async (icon: string, table: TableType) => {
  try {
    // 更新表格元数据
    table.meta = {
      ...((table.meta as object) || {}),
      icon,
    }
    // 更新表格列表
    tables.value.splice(tables.value.indexOf(table), 1, { ...table })

    // 更新标签页
    updateTab({ id: table.id }, { meta: table.meta })

    // 更新API
    await $api.dbTable.update(table.id as string, {
      meta: table.meta,
    })

    // 记录事件
    $e('a:table:icon:navdraw', { icon })
  } catch (e) {
    // 显示错误消息
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

// 检查是否为共享基础
const { isSharedBase } = useBase()
// const isMultiBase = computed(() => base.sources && base.sources.length > 1)

// 检查用户是否可以编辑表情
const canUserEditEmote = computed(() => {
  return isUIAllowed('tableIconEdit', { roles: baseRole?.value })
})

// 表格展开状态
const isExpanded = ref(false)
// 加载状态
const isLoading = ref(false)

// 处理表格展开/折叠
const onExpand = async () => {
  if (isExpanded.value) {
    isExpanded.value = false
    return
  }

  isLoading.value = true
  try {
    // 加载视图
    await _loadViews({ tableId: table.value.id, ignoreLoading: true })
  } catch (e) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isLoading.value = false
    isExpanded.value = true
  }
}

// 打开表格
const onOpenTable = async () => {
  if (isEditing.value || isStopped.value) return

  if (isMac() ? metaKey.value : control.value) {
    // 使用快捷键打开新标签页
    await _openTable(table.value, true)
    return
  }

  isLoading.value = true
  try {
    // 打开表格
    await _openTable(table.value)

    // 移动设备模式下关闭侧边栏
    if (isMobileMode.value) {
      isLeftSidebarOpen.value = false
    }
  } catch (e) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isLoading.value = false
    isExpanded.value = true
  }
}

// 监视活动视图变化
watch(
  () => activeView.value?.id,
  () => {
    if (!activeView.value) return

    // 如果活动视图属于当前表格，展开表格
    if (activeView.value?.fk_model_id === table.value?.id) {
      isExpanded.value = true
    }
  },
  {
    immediate: true,
  },
)

// 检查表格是否已打开
const isTableOpened = computed(() => {
  return openedTableId.value === table.value?.id && (activeView.value?.is_default || !activeViewTitleOrId.value)
})

// 监视打开的表格ID变化
let tableTimeout: NodeJS.Timeout

watch(openedTableId, () => {
  if (tableTimeout) {
    clearTimeout(tableTimeout)
  }

  // 如果表格已关闭且没有视图，折叠表格
  if (table.value.id !== openedTableId.value && isExpanded.value) {
    const views = viewsByTable.value.get(table.value.id!)?.filter((v) => !v.is_default) ?? []

    if (views.length) return

    tableTimeout = setTimeout(() => {
      if (isExpanded.value) {
        isExpanded.value = false
      }
      clearTimeout(tableTimeout)
    }, 10000)
  }
})

// 复制表格
const duplicateTable = (table: SidebarTableNode) => {
  isOptionsOpen.value = false
  _duplicateTable(table)
}

// 打开同步选项
const onSyncOptions = () => {
  isOptionsOpen.value = false
  isSyncModalOpen.value = true
}

// 聚焦输入框
const focusInput = () => {
  setTimeout(() => {
    input.value?.focus()
    input.value?.select()
  })
}

// 打开重命名菜单
const onRenameMenuClick = (table: SidebarTableNode) => {
  if (isMobileMode.value || !isUIAllowed('tableRename', { roles: baseRole?.value, source: source.value })) return

  isOptionsOpen.value = false

  if (!isEditing.value) {
    isEditing.value = true
    formState.title = table.title

    nextTick(() => {
      focusInput()
    })
  }
}

// 监视表格重命名ID变化
watch(
  tableRenameId,
  (n, o) => {
    if (n === o) return

    // 如果重命名ID匹配，打开重命名菜单
    if (n && `${table.value.id}:${source.value?.id}` === tableRenameId.value) {
      onRenameMenuClick(table.value)
    } else {
      isEditing.value = false
      onCancel()
    }
  },
  { immediate: true },
)

// 打开表格描述对话框
const openTableDescriptionDialog = (table: SidebarTableNode) => {
  isOptionsOpen.value = false
  _openTableDescriptionDialog(table)
}

// 删除表格
const deleteTable = () => {
  isOptionsOpen.value = false
  isTableDeleteDialogVisible.value = true
}

// 复制表格视图
const isOnDuplicateLoading = ref<boolean>(false)

async function onDuplicate() {
  isOnDuplicateLoading.value = true

  // 加载视图（如果未加载）
  if (!viewsByTable.value.get(table.value.id as string)) {
    await _openTable(table.value, undefined, false)
  }

  const views = viewsByTable.value.get(table.value.id as string)
  const defaultView = views?.find((v) => v.is_default) || views?.[0]

  if (defaultView) {
    // 复制视图
    const view = await duplicateView(defaultView)

    // 刷新命令面板
    refreshCommandPalette()

    // 重新加载视图
    await _loadViews({
      force: true,
      tableId: table.value!.id!,
    })

    if (view) {
      // 导航到新视图
      navigateToView({
        view,
        tableId: table.value!.id!,
        baseId: base.value.id!,
        hardReload: view.type === ViewTypes.FORM,
      })

      // 记录事件
      $e('a:view:create', { view: view.type, sidebar: true })
    }
  }

  isOnDuplicateLoading.value = false
  isOptionsOpen.value = false
}

// 刷新视图
const refreshViews = async () => {
  isExpanded.value = false
  await nextTick()
  isExpanded.value = true
}

// 取消重命名
function onCancel() {
  if (!isEditing.value) return

  onStopEdit()
}

// 停止编辑
function onStopEdit() {
  isStopped.value = true
  isEditing.value = false
  formState.title = ''
  tableRenameId.value = ''

  setTimeout(() => {
    isStopped.value = false
  }, 250)
}

// 处理键盘事件
function onKeyDown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    onKeyEsc(event)
  } else if (event.key === 'Enter') {
    onKeyEnter(event)
  }
}

// 处理Enter键
function onKeyEnter(event: KeyboardEvent) {
  event.stopImmediatePropagation()
  event.preventDefault()

  onRename()
}

// 处理Escape键
function onKeyEsc(event: KeyboardEvent) {
  event.stopImmediatePropagation()
  event.preventDefault()

  onCancel()
}

// 监听Enter键
onKeyStroke('Enter', (event) => {
  if (isEditing.value) {
    onKeyEnter(event)
  }
})

// 验证标题
const validateTitle = async () => {
  try {
    await validate()
    return true
  } catch (e: any) {
    console.log('e', e)
    const errMsg = e.errorFields?.[0]?.errors?.[0]

    if (errMsg) {
      message.error(errMsg)
    }
  }
}

// 重命名表格
async function onRename() {
  if (!isEditing.value) return

  if (!formState.title?.trim() || table.value.title === formState.title) {
    onCancel()
    return
  }

  const isValid = await validateTitle()

  if (!isValid) {
    onCancel()
    return
  }

  const originalTitle = table.value.title

  table.value.title = formState.title.trim() || ''

  const updateTitle = (title: string) => {
    table.value.title = title
  }

  handleTableRename(table.value, formState.title, originalTitle, updateTitle)

  onStopEdit()

  onCancel()
}
</script>

<template>
  <!-- 表格节点容器 -->
  <div
    class="nc-tree-item nc-table-node-wrapper text-sm select-none w-full"
    :data-order="table.order"
    :data-id="table.id"
    :data-table-id="table.id"
    :class="[`nc-base-tree-tbl nc-base-tree-tbl-${table.title?.replaceAll(' ', '')}`]"
    :data-active="openedTableId === table.id"
  >
    <div class="flex items-center py-0.5">
      <!-- 表格内容容器 -->
      <div
        v-e="['a:table:open']"
        class="flex-none flex-1 table-context flex items-center gap-1 h-full nc-tree-item-inner nc-sidebar-node pr-0.75 mb-0.25 rounded-md h-7 w-full group cursor-pointer hover:bg-gray-200"
        :class="{
          'hover:bg-gray-200': openedTableId !== table.id,
          'pl-13.5': sourceIndex !== 0,
          'pl-7.5 xs:(pl-6)': sourceIndex === 0,
          '!bg-primary-selected': isTableOpened,
        }"
        :data-testid="`nc-tbl-side-node-${table.title}`"
        @contextmenu="setMenuContext('table', table)"
        @click="onOpenTable"
      >
        <div class="flex flex-row h-full items-center">
          <div class="flex w-auto" :data-testid="`tree-view-table-draggable-handle-${table.title}`">
            <!-- 加载状态或图标 -->
            <GeneralLoader v-if="table.isViewsLoading" class="flex items-center w-6 h-full !text-gray-600" />
            <div
              v-else
              v-e="['c:table:emoji-picker']"
              class="flex items-center nc-table-icon"
              :class="{
                'pointer-events-none': !canUserEditEmote,
              }"
              @click.stop
            >
              <!-- 表情选择器 -->
              <LazyGeneralEmojiPicker
                :key="table.meta?.icon"
                :emoji="table.meta?.icon"
                size="small"
                :readonly="!canUserEditEmote || isMobileMode"
                @emoji-selected="setIcon($event, table)"
              >
                <template #default>
                  <!-- 工具提示 -->
                  <NcTooltip class="flex" placement="topLeft" hide-on-click :disabled="!canUserEditEmote">
                    <template #title>
                      {{ $t('general.changeIcon') }}
                    </template>

                    <!-- 表格图标 -->
                    <component
                      :is="iconMap.sync"
                      v-if="table?.synced"
                      class="w-4 text-sm"
                      :class="isTableOpened ? '!text-brand-600/85' : '!text-gray-600/75'"
                    />

                    <component
                      :is="iconMap.table"
                      v-else-if="table.type === 'table'"
                      class="w-4 text-sm"
                      :class="isTableOpened ? '!text-brand-600/85' : '!text-gray-600/75'"
                    />

                    <MdiEye v-else class="flex w-5 text-sm" :class="isTableOpened ? '!text-brand-600' : '!text-gray-600'" />
                  </NcTooltip>
                </template>
              </LazyGeneralEmojiPicker>
            </div>
          </div>
        </div>
        <!-- 重命名表单 -->
        <a-form v-if="isEditing" :model="formState" name="rename-table-form" class="w-full" @finish.prevent>
          <a-input
            ref="input"
            v-model:value="formState.title"
            class="!bg-transparent !pr-1.5 !flex-1 mr-4 !rounded-md !h-6 animate-sidebar-node-input-padding"
            :class="{
              '!font-semibold !text-brand-600': isTableOpened,
            }"
            :style="{
              fontWeight: 'inherit',
            }"
            @blur="onRename"
            @keydown.stop="onKeyDown($event)"
          />
        </a-form>
        <!-- 表格名称显示 -->
        <NcTooltip
          v-else
          class="nc-tbl-title nc-sidebar-node-title text-ellipsis overflow-hidden select-none !flex-1"
          show-on-truncate-only
        >
          <template #title>{{ table.title }}</template>
          <span
            :class="isTableOpened ? 'text-brand-600 font-semibold' : 'text-gray-700'"
            :data-testid="`nc-tbl-title-${table.title}`"
            :style="{ wordBreak: 'keep-all', whiteSpace: 'nowrap', display: 'inline' }"
            @dblclick.stop="onRenameMenuClick(table)"
          >
            {{ table.title }}
          </span>
        </NcTooltip>
        <!-- 表格操作按钮 -->
        <div v-if="!isEditing" class="flex items-center">
          <!-- 表格描述信息 -->
          <NcTooltip v-if="table.description?.length" placement="bottom">
            <template #title>
              {{ table.description }}
            </template>

            <NcButton type="text" class="!hover:bg-transparent" size="xsmall">
              <GeneralIcon icon="info" class="!w-3.5 !h-3.5 nc-info-icon group-hover:opacity-100 text-gray-600 opacity-0" />
            </NcButton>
          </NcTooltip>

          <!-- 表格选项菜单 -->
          <NcDropdown v-model:visible="isOptionsOpen" :trigger="['click']" @click.stop>
            <NcButton
              v-e="['c:table:option']"
              class="nc-sidebar-node-btn nc-tbl-context-menu text-gray-700 hover:text-gray-800"
              :class="{
                '!opacity-100 !inline-block': isOptionsOpen,
              }"
              data-testid="nc-sidebar-table-context-menu"
              type="text"
              size="xxsmall"
              @click.stop
            >
              <MdiDotsHorizontal class="!text-current" />
            </NcButton>

            <template #overlay>
              <!-- 表格上下文菜单 -->
              <NcMenu class="!min-w-62.5" :data-testid="`sidebar-table-context-menu-list-${table.title}`" variant="small">
                <!-- 复制ID选项 -->
                <NcMenuItemCopyId
                  v-if="table"
                  :id="table.id"
                  :tooltip="$t('labels.clickToCopyTableID')"
                  :label="
                    $t('labels.tableIdColon', {
                      tableId: table.id,
                    })
                  "
                />

                <!-- 编辑描述选项 -->
                <NcMenuItem
                  v-if="
                    isUIAllowed('tableDescriptionEdit', { roles: baseRole, source }) &&
                    !isUIAllowed('tableRename', { roles: baseRole, source })
                  "
                  :data-testid="`sidebar-table-description-${table.title}`"
                  class="nc-table-description"
                  @click="openTableDescriptionDialog(table)"
                >
                  <div v-e="['c:table:update-description']" class="flex gap-2 items-center">
                    <GeneralIcon icon="ncAlignLeft" class="opacity-80" />
                    {{ $t('labels.editDescription') }}
                  </div>
                </NcMenuItem>

                <!-- 表格操作选项 -->
                <template
                  v-if="
                    !isSharedBase &&
                    (isUIAllowed('tableRename', { roles: baseRole, source }) ||
                      isUIAllowed('tableDelete', { roles: baseRole, source }))
                  "
                >
                  <NcDivider />
                  <!-- 重命名选项 -->
                  <NcMenuItem
                    v-if="isUIAllowed('tableRename', { roles: baseRole, source })"
                    :data-testid="`sidebar-table-rename-${table.title}`"
                    class="nc-table-rename"
                    @click="onRenameMenuClick(table)"
                  >
                    <div v-e="['c:table:rename']" class="flex gap-2 items-center">
                      <GeneralIcon icon="rename" class="opacity-80" />
                      {{ $t('general.rename') }} {{ $t('objects.table').toLowerCase() }}
                    </div>
                  </NcMenuItem>

                  <!-- 同步选项 -->
                  <NcMenuItem
                    v-if="isUIAllowed('tableRename', { roles: baseRole, source })"
                    :data-testid="`sidebar-table-sync-${table.title}`"
                    class="nc-table-sync"
                    @click="onSyncOptions"
                  >
                    <div v-e="['c:table:sync']" class="flex gap-2 items-center">
                      <GeneralIcon icon="sync" class="opacity-80" />
                      Sync Options
                    </div>
                  </NcMenuItem>

                  <!-- 编辑描述选项 -->
                  <NcMenuItem
                    v-if="isUIAllowed('tableDescriptionEdit', { roles: baseRole, source })"
                    :data-testid="`sidebar-table-description-${table.title}`"
                    class="nc-table-description"
                    @click="openTableDescriptionDialog(table)"
                  >
                    <div v-e="['c:table:update-description']" class="flex gap-2 items-center">
                      <GeneralIcon icon="ncAlignLeft" class="opacity-80" />
                      {{ $t('labels.editDescription') }}
                    </div>
                  </NcMenuItem>

                  <!-- 复制表格选项 -->
                  <NcMenuItem
                    v-if="
                      isUIAllowed('tableDuplicate', {
                        source,
                      }) &&
                      base.sources?.[sourceIndex] &&
                      (source?.is_meta || source?.is_local)
                    "
                    :data-testid="`sidebar-table-duplicate-${table.title}`"
                    @click="duplicateTable(table)"
                  >
                    <div v-e="['c:table:duplicate']" class="flex gap-2 items-center">
                      <GeneralIcon icon="duplicate" class="opacity-80" />
                      {{ $t('general.duplicate') }} {{ $t('objects.table').toLowerCase() }}
                    </div>
                  </NcMenuItem>
                  <NcDivider />

                  <!-- 复制视图选项 -->
                  <NcMenuItem @click="onDuplicate">
                    <GeneralLoader v-if="isOnDuplicateLoading" size="regular" />
                    <GeneralIcon v-else class="nc-view-copy-icon opacity-80" icon="duplicate" />
                    {{
                      $t('general.duplicateEntity', {
                        entity: $t('title.defaultView').toLowerCase(),
                      })
                    }}
                  </NcMenuItem>

                  <NcDivider />
                  <!-- 删除表格选项 -->
                  <NcMenuItem
                    v-if="isUIAllowed('tableDelete', { roles: baseRole, source })"
                    :data-testid="`sidebar-table-delete-${table.title}`"
                    class="!text-red-500 !hover:bg-red-50 nc-table-delete"
                    @click="deleteTable"
                  >
                    <div v-e="['c:table:delete']" class="flex gap-2 items-center">
                      <GeneralIcon icon="delete" class="opacity-80" />
                      {{ $t('general.delete') }} {{ $t('objects.table').toLowerCase() }}
                    </div>
                  </NcMenuItem>
                </template>
              </NcMenu>
            </template>
          </NcDropdown>

          <!-- 展开/折叠按钮 -->
          <NcButton
            v-e="['c:table:toggle-expand']"
            type="text"
            size="xxsmall"
            class="nc-sidebar-node-btn nc-sidebar-expand text-gray-700 hover:text-gray-800"
            :class="{
              '!opacity-100 !visible': isOptionsOpen,
            }"
            @click.stop="onExpand"
          >
            <GeneralIcon
              icon="chevronRight"
              class="nc-sidebar-source-node-btns cursor-pointer transform transition-transform duration-200 !text-current text-[20px]"
              :class="{ '!rotate-90': isExpanded }"
            />
          </NcButton>
        </div>
      </div>
    </div>
    <!-- 删除表格对话框 -->
    <DlgTableDelete
      v-if="table.id && base?.id"
      v-model:visible="isTableDeleteDialogVisible"
      :table-id="table.id"
      :base-id="base.id"
    />
    <!-- 同步编辑对话框 -->
    <LazyDashboardSettingsSyncEdit
      v-if="table && table.id && table.synced && base?.id && isSyncModalOpen"
      v-model:open="isSyncModalOpen"
      :table-id="table.id"
      :base-id="base.id"
    />

    <!-- 表格视图列表 -->
    <DashboardTreeViewViewsList v-if="isExpanded" :table-id="table.id" :base-id="base.id" @deleted="refreshViews" />
  </div>
</template>

<style scoped lang="scss">
/* 树项样式 */
.nc-tree-item {
  @apply relative after:(pointer-events-none content-[''] rounded absolute top-0 left-0  w-full h-full right-0 !bg-current transition duration-100 opacity-0);
}

/* 图标样式 */
.nc-tree-item svg {
  &:not(.nc-info-icon) {
    @apply text-primary text-opacity-60;
  }
}
</style>
