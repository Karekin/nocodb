<script lang="ts" setup>
// 导入 ant-design-vue 的 Empty 组件
import { Empty } from 'ant-design-vue'
// 导入 BaseType 类型定义
import type { BaseType } from 'nocodb-sdk'
// 导入项目角色、项目状态、工作区用户角色和时间转换函数
import { ProjectRoles, ProjectStatus, WorkspaceUserRoles, timeAgo } from 'nocodb-sdk'
// 导入 nextTick 函数，用于在 DOM 更新后执行回调
import { nextTick } from '@vue/runtime-core'

// 获取工作区存储实例
const workspaceStore = useWorkspace()

// 从工作区存储中解构获取更新项目标题的方法
const { updateProjectTitle } = workspaceStore

// 使用 storeToRefs 获取工作区存储中的活动页面引用
const { activePage } = storeToRefs(workspaceStore)

// 获取基础存储实例
const basesStore = useBases()

// 使用 storeToRefs 获取基础列表和项目加载状态的引用
const { basesList, isProjectsLoading } = storeToRefs(basesStore)

// 获取全局导航方法
const { navigateToProject } = useGlobal()

// 获取事件跟踪实例
const { $e } = useNuxtApp()

// 获取角色权限检查方法
const { isUIAllowed } = useRoles()

// 定义基础删除模态框显示状态
const showBaseDeleteModal = ref(false)

// 定义待删除基础ID的响应式引用
const toBeDeletedBaseId = ref<string | undefined>()

// 打开基础的异步函数
const openBase = async (base: BaseType) => {
  // 导航到指定项目
  navigateToProject({
    // 设置基础ID
    baseId: base.id!,
    // 设置项目类型
    type: base.type as NcProjectType,
  })
}

// 角色别名映射对象
const roleAlias = {
  // 工作区所有者
  [WorkspaceUserRoles.OWNER]: 'Workspace Owner',
  // 工作区查看者
  [WorkspaceUserRoles.VIEWER]: 'Workspace Viewer',
  // 工作区创建者
  [WorkspaceUserRoles.CREATOR]: 'Workspace Creator',
  // 工作区编辑者
  [WorkspaceUserRoles.EDITOR]: 'Workspace Editor',
  // 工作区评论者
  [WorkspaceUserRoles.COMMENTER]: 'Workspace Commenter',
  // 基础创建者
  [ProjectRoles.CREATOR]: 'Base Creator',
  // 基础编辑者
  [ProjectRoles.EDITOR]: 'Base Editor',
  // 基础查看者
  [ProjectRoles.VIEWER]: 'Base Viewer',
  // 基础评论者
  [ProjectRoles.COMMENTER]: 'Base Commenter',
  // 基础所有者
  [ProjectRoles.OWNER]: 'Base Owner',
}

// 删除基础的函数
const deleteBase = (base: BaseType) => {
  // 触发基础删除事件
  $e('c:base:delete')

  // 显示基础删除模态框
  showBaseDeleteModal.value = true
  // 设置待删除的基础ID
  toBeDeletedBaseId.value = base.id
}

// 重命名输入框的引用
const renameInput = ref<HTMLInputElement>()

// 启用编辑模式的函数
const enableEdit = (index: number) => {
  // 设置临时标题为当前标题
  basesList.value![index]!.temp_title = basesList.value![index].title
  // 启用编辑模式
  basesList.value![index]!.edit = true
  // 在DOM更新后执行
  nextTick(() => {
    // 聚焦到重命名输入框
    renameInput.value?.focus()
    // 选中输入框中的文本
    renameInput.value?.select()
  })
}

// 禁用编辑模式的函数
const disableEdit = (index: number) => {
  // 清除临时标题
  basesList.value![index]!.temp_title = undefined
  // 禁用编辑模式
  basesList.value![index]!.edit = false
}

// 自定义行属性的函数
const customRow = (record: BaseType) => ({
  // 点击行时的处理函数
  onClick: async () => {
    // 打开基础
    openBase(record)

    // 触发基础打开事件
    $e('a:base:open')
  },
  // 添加组样式类
  class: ['group'],
})

// 计算表格列配置
const columns = computed(() => [
  {
    // 基础名称列
    title: 'Base Name',
    dataIndex: 'title',
    // 排序配置
    sorter: {
      // 比较函数，按标题字母顺序排序
      compare: (a, b) => a.title?.localeCompare(b.title),
      // 排序优先级
      multiple: 5,
    },
  },
  // 条件性添加工作区名称列
  ...(isEeUI && activePage.value !== 'workspace'
    ? [
        {
          // 工作区名称列
          title: 'Workspace Name',
          dataIndex: 'workspace_title',
          // 排序配置
          sorter: {
            // 比较函数，按工作区标题字母顺序排序
            compare: (a, b) => a.workspace_title?.localeCompare(b.workspace_title),
            // 排序优先级
            multiple: 4,
          },
        },
      ]
    : []),
  {
    // 角色列
    title: 'Role',
    dataIndex: 'workspace_role',
    // 排序配置
    sorter: {
      // 比较函数，按角色数值排序
      compare: (a, b) => a - b,
      // 排序优先级
      multiple: 1,
    },
  },
  {
    // 最后打开时间列
    title: 'Last Opened',
    dataIndex: 'last_accessed',
    // 排序配置
    sorter: {
      // 比较函数，按最后访问时间倒序排序
      compare: (a, b) => new Date(b.last_accessed) - new Date(a.last_accessed),
      // 排序优先级
      multiple: 2,
    },
  },

  {
    // 操作列（空标题）
    title: '',
    dataIndex: 'id',
    // 隐藏列
    hidden: true,
    // 列宽
    width: '24px',
    // 样式配置
    style: {
      padding: 0,
    },
  },
])

// 移动对话框显示状态
const isMoveDlgOpen = ref(false)
// 选中要移动的项目
const selectedProjectToMove = ref()

// 工作区移动项目成功后的回调函数
const workspaceMoveProjectOnSuccess = async (workspaceId: string) => {
  // 关闭移动对话框
  isMoveDlgOpen.value = false
  // 导航到新的工作区
  navigateTo({
    query: {
      workspaceId,
      page: 'workspace',
    },
  })
}

// 复制对话框显示状态
const isDuplicateDlgOpen = ref(false)

// 选中要复制的项目
const selectedProjectToDuplicate = ref()

// 复制项目的函数
const duplicateProject = (base: BaseType) => {
  // 设置选中要复制的项目
  selectedProjectToDuplicate.value = base
  // 显示复制对话框
  isDuplicateDlgOpen.value = true
}

// 点击计数器
let clickCount = 0

// 定时器引用
let timer: any = null

// 延迟时间（毫秒）
const delay = 250

// 项目标题点击处理函数
function onProjectTitleClick(index: number) {
  // 增加点击计数
  clickCount++
  // 如果是单击
  if (clickCount === 1) {
    // 设置延迟定时器
    timer = setTimeout(function () {
      // 打开基础
      openBase(basesList.value![index])
      // 重置点击计数
      clickCount = 0
    }, delay)
  } else {
    // 如果是双击，清除定时器
    clearTimeout(timer)
    // 启用编辑模式
    enableEdit(index)
    // 重置点击计数
    clickCount = 0
  }
}

// 设置颜色的异步函数
const setColor = async (color: string, base: BaseType) => {
  try {
    // 创建新的元数据对象
    const meta = {
      // 展开现有元数据
      ...parseProp(base.meta),
      // 设置图标颜色
      iconColor: color,
    }

    // 更新项目元数据
    basesStore.updateProject(base.id!, { meta: JSON.stringify(meta) })

    // 触发图标颜色更改事件
    $e('a:base:icon:color:navdraw', { iconColor: color })
  } catch (e: any) {
    // 显示错误消息
    message.error(await extractSdkResponseErrorMsg(e))
  }
}
</script>

<template>
  <div>
    <!-- 当没有基础列表或正在加载时显示的内容 -->
    <div
      v-if="!basesList || basesList?.length === 0 || isProjectsLoading"
      class="w-full flex flex-row justify-center items-center"
      style="height: calc(100vh - 16rem)"
    >
      <!-- 加载中显示加载器 -->
      <div v-if="isProjectsLoading">
        <GeneralLoader size="xlarge" />
      </div>
      <!-- 没有数据时显示的内容 -->
      <div v-else class="flex flex-col items-center gap-y-5">
        <!-- 显示收件箱图标 -->
        <MaterialSymbolsInboxOutlineRounded
          class="text-2xl text-primary"
          :class="{
            'h-8 w-8': activePage === 'workspace',
            'h-12 w-12': activePage !== 'workspace',
          }"
        />
        <!-- 工作区页面的欢迎信息 -->
        <template v-if="activePage === 'workspace'">
          <div class="font-medium text-xl">Welcome to nocoDB</div>
          <div class="font-medium">Create your first Base!</div>
        </template>
        <!-- 最近项目页面的提示信息 -->
        <template v-else-if="activePage === 'recent'">
          <div class="font-medium text-lg">No Recent Projects</div>
        </template>
        <!-- 星标项目页面的提示信息 -->
        <template v-else-if="activePage === 'starred'">
          <div class="font-medium text-lg">No Starred Projects</div>
        </template>
        <!-- 共享项目页面的提示信息 -->
        <template v-else-if="activePage === 'shared'">
          <div class="font-medium text-lg">No Shared Projects</div>
        </template>
      </div>
    </div>
    <!-- 基础列表表格 -->
    <a-table
      v-else
      v-model:data-source="basesList"
      class="h-full"
      :class="{
        'full-height-table': activePage !== 'workspace',
      }"
      :custom-row="customRow"
      :columns="columns"
      :pagination="false"
      :scroll="{ y: 'calc(100% - 54px)' }"
    >
      <!-- 空数据显示模板 -->
      <template #emptyText>
        <a-empty :image="Empty.PRESENTED_IMAGE_SIMPLE" :description="$t('labels.noData')" />
      </template>

      <!-- 表格单元格自定义渲染 -->
      <template #bodyCell="{ column, text, record, index: i }">
        <!-- 标题列的自定义渲染 -->
        <template v-if="column.dataIndex === 'title'">
          <div class="flex items-center nc-base-title gap-2.5 max-w-full -ml-1.5">
            <!-- 图标颜色选择器 -->
            <div class="flex items-center gap-2 text-center">
              <GeneralBaseIconColorPicker
                :key="`${record.id}_${parseProp(record.meta).iconColor}`"
                :type="record?.type"
                :model-value="parseProp(record.meta).iconColor"
                :readonly="(record?.type && record?.type !== 'database') || !isUIAllowed('baseRename')"
                @update:model-value="setColor($event, record)"
              >
              </GeneralBaseIconColorPicker>
              <!-- todo: replace with switch -->
            </div>

            <!-- 标题显示/编辑区域 -->
            <div class="min-w-10">
              <!-- 编辑模式下显示输入框 -->
              <input
                v-if="record.edit"
                ref="renameInput"
                v-model="record.temp_title"
                class="!leading-none p-1 bg-transparent max-w-full !w-auto"
                autofocus
                @click.stop
                @blur="disableEdit(i)"
                @keydown.enter="updateProjectTitle(record)"
                @keydown.esc="disableEdit(i)"
              />

              <!-- 非编辑模式下显示标题文本 -->
              <div
                v-else
                :title="record.title"
                class="whitespace-nowrap overflow-hidden overflow-ellipsis cursor-pointer"
                @click.stop="onProjectTitleClick(i)"
              >
                {{ record.title }}
              </div>
            </div>

            <!--            <div v-if="!record.edit" class="nc-click-transition-1" @click.stop> -->
            <!--              <MdiStar v-if="record.starred" class="text-yellow-400 cursor-pointer" @click="removeFromFavourite(record.id)" /> -->
            <!--              <MdiStarOutline -->
            <!--                v-else -->
            <!--                class="opacity-0 group-hover:opacity-100 transition transition-opacity text-yellow-400 cursor-pointer" -->
            <!--                @click="addToFavourite(record.id)" -->
            <!--              /> -->
            <!--            </div> -->
          </div>
        </template>

        <!-- 最后访问时间列的自定义渲染 -->
        <div v-if="column.dataIndex === 'last_accessed'" class="text-xs text-gray-500">
          {{ text ? timeAgo(text) : 'Newly invited' }}
        </div>

        <!-- 工作区标题列的自定义渲染 -->
        <div v-if="column.dataIndex === 'workspace_title'" class="text-xs text-gray-500">
          <span v-if="text" class="text-xs text-gray-500 whitespace-nowrap overflow-hidden overflow-ellipsis">
            <!-- 工作区链接 -->
            <nuxt-link
              :to="{
                query: {
                  page: 'workspace',
                  workspaceId: 'default',
                },
              }"
              class="!text-gray-500 !no-underline !hover:underline !hover:text-gray-500"
              @click.stop
            >
              {{ text }}
            </nuxt-link>
          </span>
        </div>

        <!-- 工作区角色列的自定义渲染 -->
        <div v-if="column.dataIndex === 'workspace_role'" class="flex flex-row text-xs justify-between text-gray-500">
          <div class="flex">
            {{ roleAlias[record.workspace_role || record.project_role] }}
          </div>
          <div class="flex items-center gap-2"></div>
        </div>

        <!-- ID列（操作列）的自定义渲染 -->
        <template v-if="column.dataIndex === 'id'">
          <!-- 操作下拉菜单 -->
          <a-dropdown
            v-if="isUIAllowed('baseActionMenu', { roles: [record.workspace_role, record.project_role].join() })"
            :trigger="['click']"
          >
            <!-- 下拉菜单触发按钮 -->
            <div @click.stop>
              <!-- 项目状态为JOB时显示加载图标 -->
              <template v-if="record.status === ProjectStatus.JOB">
                <component :is="iconMap.reload" class="animate-infinite animate-spin" />
              </template>
              <!-- 其他状态显示三点菜单图标 -->
              <GeneralIcon v-else icon="threeDotVertical" class="outline-0 nc-workspace-menu nc-click-transition" />
            </div>
            <!-- 下拉菜单内容 -->
            <template #overlay>
              <a-menu>
                <!-- 重命名菜单项 -->
                <a-menu-item @click="enableEdit(i)">
                  <div class="nc-menu-item-wrapper">
                    <GeneralIcon icon="rename" class="text-gray-700" />
                    {{ $t('general.rename') }} {{ $t('objects.project') }}
                  </div>
                </a-menu-item>
                <!-- 复制菜单项 -->
                <a-menu-item
                  v-if="
                    record.type === NcProjectType.DB &&
                    isUIAllowed('baseDuplicate', { roles: [record.workspace_role, record.project_role].join() })
                  "
                  @click="duplicateProject(record)"
                >
                  <div class="nc-menu-item-wrapper">
                    <GeneralIcon icon="duplicate" class="text-gray-700" />
                    {{ $t('general.duplicate') }} {{ $t('objects.project') }}
                  </div>
                </a-menu-item>
                <!--
                <a-menu-item
                  v-if="false && isUIAllowed('baseMove', { roles: [record.workspace_role, record.project_role].join() })"
                  @click="moveProject(record)"
                >
                  <div class="nc-menu-item-wrapper">
                    <GeneralIcon icon="move" class="text-gray-700" />
                    {{ $t('general.move') }} {{ $t('objects.project') }}
                  </div>
                </a-menu-item>
                -->
                <!-- 删除菜单项 -->
                <a-menu-item
                  v-if="isUIAllowed('baseDelete', { roles: [record.workspace_role, record.project_role].join() })"
                  @click="deleteBase(record)"
                >
                  <div class="nc-menu-item-wrapper text-red-500">
                    <GeneralIcon icon="delete" />
                    {{ $t('general.delete') }} {{ $t('objects.project') }}
                  </div>
                </a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>
          <!-- 无权限时显示空内容 -->
          <div v-else></div>
        </template>
      </template>
    </a-table>
    <!-- 基础删除对话框 -->
    <DlgBaseDelete v-if="toBeDeletedBaseId" v-model:visible="showBaseDeleteModal" :base-id="toBeDeletedBaseId" />
    <!-- 工作区移动项目对话框 -->
    <WorkspaceMoveProjectDlg
      v-if="selectedProjectToMove"
      v-model="isMoveDlgOpen"
      :base="selectedProjectToMove"
      @success="workspaceMoveProjectOnSuccess"
    />
    <!-- 基础复制对话框 -->
    <DlgBaseDuplicate v-if="selectedProjectToDuplicate" v-model="isDuplicateDlgOpen" :base="selectedProjectToDuplicate" />
  </div>
</template>

<style scoped lang="scss">
// 第一个表格单元格左内边距
:deep(.ant-table-cell:first-child) {
  @apply !pl-6;
}

// 最后一个表格单元格左右内边距
:deep(.ant-table-cell:last-child) {
  @apply !plr6;
}

// 表格标题单元格字体粗细
:deep(th.ant-table-cell) {
  @apply font-weight-400;
}

// 表格包装器及其子元素高度设置
:deep(.ant-table-wrapper) {
  .ant-spin-nested-loading,
  .ant-spin-container,
  .ant-table,
  .ant-table-container {
    @apply h-full;
  }
}

// 表格行鼠标指针样式
:deep(.ant-table-row) {
  @apply cursor-pointer;
}

// 表格标题单元格文本颜色
:deep(th.ant-table-cell) {
  @apply !text-gray-500;
}

// 最后一个表格单元格内边距
:deep(.ant-table-cell:last-child) {
  @apply !p-0;
}

// 最后一行表格单元格底部边框
:deep(.ant-table-row:last-child > td) {
  @apply !border-b-0;
}

// 第二个表格单元格内边距
:deep(.ant-table-cell:nth-child(2)) {
  @apply !p-0;
}

// 表格主体样式
:deep(.ant-table-body) {
  @apply !p-0 w-full !overflow-y-auto;
}

// 表格标题行背景
:deep(.ant-table-thead > tr > th) {
  @apply !bg-transparent;
}

// 表格单元格伪元素宽度
:deep(.ant-table-cell::before) {
  width: 0 !important;
}

// 表格列排序器颜色
:deep(.ant-table-column-sorter) {
  @apply text-gray-100 !hover:text-gray-300;
}

// 表格列排序器布局
:deep(.ant-table-column-sorters) {
  @apply !justify-start !gap-x-2;
}

// 表格列标题弹性布局
:deep(.ant-table-column-sorters > .ant-table-column-title) {
  flex: none;
}

// 全高表格主体高度
:deep(.full-height-table .ant-table-body) {
  height: calc(100vh - var(--topbar-height) - 9rem) !important;
}

// 表格主体滚动条样式
:deep(.ant-table-body) {
  overflow-y: overlay;
  height: calc(100vh - var(--topbar-height) - 13.45rem);

  // 滚动条宽度
  &::-webkit-scrollbar {
    width: 4px;
  }
  // 滚动条轨道背景
  &::-webkit-scrollbar-track {
    background: #f6f6f600 !important;
  }
  // 滚动条滑块
  &::-webkit-scrollbar-thumb {
    background: #f6f6f600;
  }
  // 滚动条滑块悬停
  &::-webkit-scrollbar-thumb:hover {
    background: #f6f6f600;
  }
}

// 表格主体滚动条样式（重复定义，可能是为了兼容性）
:deep(.ant-table-body) {
  // 滚动条宽度
  &::-webkit-scrollbar {
    width: 4px;
  }
  // 滚动条轨道背景
  &::-webkit-scrollbar-track {
    background: #f6f6f600 !important;
  }
  // 滚动条滑块
  &::-webkit-scrollbar-thumb {
    background: rgb(215, 215, 215);
  }
  // 滚动条滑块悬停
  &::-webkit-scrollbar-thumb:hover {
    background: rgb(203, 203, 203);
  }
}
</style>
