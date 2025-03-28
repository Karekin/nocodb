<script lang="ts" setup>
// 导入 Vue Use 核心库中的 useTitle 钩子，用于动态设置页面标题
import { useTitle } from '@vueuse/core'

// 定义组件属性，包含可选的 workspaceId 字符串参数
const props = defineProps<{
  workspaceId?: string
}>()

// 获取路由实例，用于页面导航
const router = useRouter()
// 获取当前路由信息
const route = router.currentRoute

// 从 useRoles 钩子中解构出 isUIAllowed 方法，用于检查用户是否有权限访问特定 UI 元素
const { isUIAllowed } = useRoles()

// 获取工作区存储实例
const workspaceStore = useWorkspace()

// 从 useRoles 钩子中解构出 loadRoles 方法，用于加载角色信息
const { loadRoles } = useRoles()
// 从工作区存储中解构出活动工作区、所有工作区和正在删除的工作区引用
const { activeWorkspace: _activeWorkspace, workspaces, deletingWorkspace } = storeToRefs(workspaceStore)
// 从工作区存储中解构出加载协作者和加载工作区的方法
const { loadCollaborators, loadWorkspace } = workspaceStore

// 获取组织存储实例
const orgStore = useOrg()
// 从组织存储中解构出组织 ID 和组织信息引用
const { orgId, org } = storeToRefs(orgStore)

// 使用 computedAsync 创建一个异步计算属性，用于获取当前工作区
const currentWorkspace = computedAsync(async () => {
  // 如果工作区正在删除中，则返回 undefined
  if (deletingWorkspace.value) return
  let ws
  // 如果提供了工作区 ID，则尝试从已加载的工作区中获取
  if (props.workspaceId) {
    ws = workspaces.value.get(props.workspaceId)
    // 如果工作区未加载，则加载该工作区
    if (!ws) {
      await loadWorkspace(props.workspaceId)
      ws = workspaces.value.get(props.workspaceId)
    }
  } else {
    // 如果未提供工作区 ID，则使用当前活动的工作区
    ws = _activeWorkspace.value
  }
  // 加载与工作区关联的角色信息
  await loadRoles(undefined, ws?.id)
  // 返回工作区对象
  return ws
})

// 创建一个计算属性，用于处理标签页的获取和设置
const tab = computed({
  // 获取当前活动的标签页，默认为 'collaborators'
  get() {
    return route.value.query?.tab ?? 'collaborators'
  },
  // 设置活动标签页并更新路由
  set(tab: string) {
    // 如果切换到协作者标签页，则加载协作者数据
    if (tab === 'collaborators') loadCollaborators({} as any, props.workspaceId)
    // 更新路由查询参数，保留其他查询参数不变
    router.push({ query: { ...route.value.query, tab } })
  },
})

// 监听当前工作区标题的变化
watch(
  // 监听的源
  () => currentWorkspace.value?.title,
  // 回调函数，处理标题变化
  (title) => {
    // 如果标题不存在，则直接返回
    if (!title) return

    // 将标题首字母大写
    const capitalizedTitle = title.charAt(0).toUpperCase() + title.slice(1)

    // 设置页面标题
    useTitle(capitalizedTitle)
  },
  // 配置选项，立即执行一次回调
  {
    immediate: true,
  },
)

// 组件挂载时执行
onMounted(() => {
  // 等待当前工作区 ID 可用
  until(() => currentWorkspace.value?.id)
    // 确保 ID 存在
    .toMatch((v) => !!v)
    // ID 可用后加载协作者数据
    .then(async () => {
      await loadCollaborators({} as any, currentWorkspace.value!.id)
    })
})
</script>

<template>
  <!-- 主容器，仅在当前工作区存在时显示 -->
  <div v-if="currentWorkspace" class="flex w-full flex-col nc-workspace-settings">
    <!-- 顶部导航栏，仅在未提供工作区 ID 时显示 -->
    <div
      v-if="!props.workspaceId"
      class="min-w-0 p-2 h-[var(--topbar-height)] border-b-1 border-gray-200 flex items-center gap-3"
    >
      <!-- 面包屑导航 -->
      <div class="flex-1 nc-breadcrumb nc-no-negative-margin pl-1 nc-workspace-title">
        <!-- 工作区标题 -->
        <div class="nc-breadcrumb-item capitalize">
          {{ currentWorkspace?.title }}
        </div>
        <!-- 分隔符图标 -->
        <GeneralIcon icon="ncSlash1" class="nc-breadcrumb-divider" />

        <!-- 当前页面标题 -->
        <h1 class="nc-breadcrumb-item active">
          {{ $t('title.teamAndSettings') }}
        </h1>
      </div>
      <!-- 命令面板快捷键组件 -->
      <SmartsheetTopbarCmdK />
    </div>
    <!-- 当提供工作区 ID 时显示的替代导航 -->
    <template v-else>
      <!-- 面包屑导航 -->
      <div class="nc-breadcrumb px-2">
        <!-- 组织标题 -->
        <div class="nc-breadcrumb-item">
          {{ org.title }}
        </div>
        <!-- 分隔符图标 -->
        <GeneralIcon icon="ncSlash1" class="nc-breadcrumb-divider" />

        <!-- 工作区列表链接 -->
        <NuxtLink
          :href="`/admin/${orgId}/workspaces`"
          class="!hover:(text-gray-800 underline-gray-600) flex items-center !text-gray-700 !underline-transparent max-w-1/4"
        >
          <div class="nc-breadcrumb-item">
            {{ $t('labels.workspaces') }}
          </div>
        </NuxtLink>
        <!-- 分隔符图标 -->
        <GeneralIcon icon="ncSlash1" class="nc-breadcrumb-divider" />

        <!-- 当前工作区标题 -->
        <div class="nc-breadcrumb-item active truncate capitalize">
          {{ currentWorkspace?.title }}
        </div>
      </div>
      <!-- 页面头部组件 -->
      <NcPageHeader>
        <!-- 图标插槽 -->
        <template #icon>
          <div class="flex justify-center items-center h-6 w-6">
            <!-- 工作区图标 -->
            <GeneralWorkspaceIcon :workspace="currentWorkspace" size="medium" />
          </div>
        </template>
        <!-- 标题插槽 -->
        <template #title>
          <span data-rec="true" class="capitalize">
            {{ currentWorkspace?.title }}
          </span>
        </template>
      </NcPageHeader>
    </template>

    <!-- 标签页组件 -->
    <NcTabs v-model:activeKey="tab">
      <!-- 左侧额外内容插槽 -->
      <template #leftExtra>
        <div class="w-3"></div>
      </template>
      <!-- 协作者标签页，仅在用户有权限时显示 -->
      <template v-if="isUIAllowed('workspaceCollaborators')">
        <a-tab-pane key="collaborators" class="w-full">
          <!-- 标签页标题插槽 -->
          <template #tab>
            <div class="tab-title">
              <!-- 用户图标 -->
              <GeneralIcon icon="users" class="h-4 w-4" />
              {{ $t('labels.members') }}
            </div>
          </template>
          <!-- 工作区协作者列表组件 -->
          <WorkspaceCollaboratorsList :workspace-id="currentWorkspace.id" />
        </a-tab-pane>
      </template>

      <!-- 设置标签页，仅在用户有管理权限时显示 -->
      <template v-if="isUIAllowed('workspaceManage')">
        <a-tab-pane key="settings" class="w-full">
          <!-- 标签页标题插槽 -->
          <template #tab>
            <div class="tab-title" data-testid="nc-workspace-settings-tab-settings">
              <!-- 设置图标 -->
              <GeneralIcon icon="ncSettings" class="h-4 w-4" />
              {{ $t('labels.settings') }}
            </div>
          </template>
          <!-- 工作区设置组件 -->
          <WorkspaceSettings :workspace-id="currentWorkspace.id" />
        </a-tab-pane>
      </template>
    </NcTabs>
  </div>
</template>

<style lang="scss" scoped>
// 标签样式
.tab {
  @apply flex flex-row items-center gap-x-2;
}

// 深度选择器修改 Ant Design 标签导航样式
:deep(.ant-tabs-nav) {
  @apply !pl-0;
}
// 深度选择器修改 Ant Design 标签样式
:deep(.ant-tabs-tab) {
  @apply pt-2 pb-3;
}
// 深度选择器修改 Ant Design 标签内容样式
:deep(.ant-tabs-content) {
  @apply nc-content-max-w;
}
// 顶部标签内容样式
.ant-tabs-content-top {
  @apply !h-full;
}
// 标签信息样式
.tab-info {
  @apply flex pl-1.25 px-1.5 py-0.75 rounded-md text-xs;
}
// 标签标题样式
.tab-title {
  @apply flex flex-row items-center gap-x-2 py-[1px];
}
</style>
