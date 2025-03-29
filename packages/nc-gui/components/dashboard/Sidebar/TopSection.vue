<script setup lang="ts">
// 引入并使用工作区存储
const workspaceStore = useWorkspace()
// 引入并使用基础存储
const baseStore = useBase()

// 从角色工具函数中获取 isUIAllowed 方法，用于检查用户是否有权限访问特定 UI 元素
const { isUIAllowed } = useRoles()

// 从全局状态中获取应用信息
const { appInfo } = useGlobal()

// 使用 useMagicKeys 获取特殊键状态，包括 meta 键（Mac 上的 Command 键）和 control 键
const { meta: metaKey, control } = useMagicKeys()

// 从工作区存储中解构出工作区加载状态、工作区设置页面是否打开、集成页面是否打开的响应式引用
const { isWorkspaceLoading, isWorkspaceSettingsPageOpened, isIntegrationsPageOpened } = storeToRefs(workspaceStore)

// 从工作区存储中解构出导航到工作区设置和导航到集成页面的方法
const { navigateToWorkspaceSettings, navigateToIntegrations: _navigateToIntegrations } = workspaceStore

// 从基础存储中解构出是否为共享基础的响应式引用
const { isSharedBase } = storeToRefs(baseStore)

// 创建一个响应式引用，用于控制创建项目模态框是否打开
const isCreateProjectOpen = ref(false)

// 定义导航到设置页面的方法
const navigateToSettings = () => {
  // 根据操作系统确定使用 Command 键还是 Control 键
  const cmdOrCtrl = isMac() ? metaKey.value : control.value

  // TODO: Handle cloud case properly
  // 调用工作区存储中的导航方法，传入空字符串和修饰键状态
  navigateToWorkspaceSettings('', cmdOrCtrl)

  // 注释掉的云端处理逻辑
  // if (appInfo.value.baseHostName) {
  //   window.location.href = `https://app.${appInfo.value.baseHostName}/dashboard`
  // } else {
  // }
}

// 定义导航到集成页面的方法
const navigateToIntegrations = () => {
  // 根据操作系统确定使用 Command 键还是 Control 键
  const cmdOrCtrl = isMac() ? metaKey.value : control.value

  // 调用工作区存储中的导航方法，传入空字符串和修饰键状态
  _navigateToIntegrations('', cmdOrCtrl)
}
</script>

<template>
  <!-- 当工作区正在加载时显示的骨架屏 -->
  <template v-if="isWorkspaceLoading">
    <!-- 骨架屏容器 -->
    <div class="flex flex-col w-full gap-y-3.75 ml-3 mt-3.75">
      <!-- 企业版特有的骨架屏元素 -->
      <div v-if="appInfo.ee" class="flex flex-row items-center w-full gap-x-3">
        <!-- 图标骨架 -->
        <a-skeleton-input :active="true" class="!w-4 !h-4 !rounded overflow-hidden" />
        <!-- 文本骨架 -->
        <a-skeleton-input :active="true" class="!w-40 !h-4 !rounded overflow-hidden" />
      </div>
      <!-- 第二行骨架屏元素 -->
      <div class="flex flex-row items-center w-full gap-x-3">
        <!-- 图标骨架 -->
        <a-skeleton-input :active="true" class="!w-4 !h-4 !rounded overflow-hidden" />
        <!-- 文本骨架 -->
        <a-skeleton-input :active="true" class="!w-40 !h-4 !rounded overflow-hidden" />
      </div>
      <!-- 第三行骨架屏元素 -->
      <div class="flex flex-row items-center w-full gap-x-3">
        <!-- 图标骨架 -->
        <a-skeleton-input :active="true" class="!w-4 !h-4 !rounded overflow-hidden" />
        <!-- 文本骨架 -->
        <a-skeleton-input :active="true" class="!w-40 !h-4 !rounded overflow-hidden" />
      </div>
    </div>
  </template>
  <!-- 当工作区加载完成且不是共享基础时显示的内容 -->
  <template v-else-if="!isSharedBase">
    <!-- 顶部部分容器，在小屏幕上隐藏 -->
    <div class="xs:hidden flex flex-col p-1 mt-0.25 mb-0.5 truncate">
      <!-- 注释掉的顶部部分标题组件 -->
      <!-- <DashboardSidebarTopSectionHeader /> -->

      <!-- 团队和设置按钮，仅当用户有权限时显示 -->
      <NcButton
        v-if="isUIAllowed('workspaceSettings') || isUIAllowed('workspaceCollaborators')"
        v-e="['c:team:settings']"
        type="text"
        size="xsmall"
        class="nc-sidebar-top-button !xs:hidden my-0.5 !h-7"
        data-testid="nc-sidebar-team-settings-btn"
        :centered="false"
        :class="{
          '!text-brand-600 !bg-brand-50 !hover:bg-brand-50': isWorkspaceSettingsPageOpened,
          '!hover:(bg-gray-200 text-gray-700)': !isWorkspaceSettingsPageOpened,
        }"
        @click="navigateToSettings"
      >
        <!-- 按钮内容容器 -->
        <div
          class="flex items-center gap-2"
          :class="{
            'font-semibold': isWorkspaceSettingsPageOpened,
          }"
        >
          <!-- 设置图标 -->
          <GeneralIcon icon="ncSettings" class="!h-4 w-4" />
          <!-- 按钮文本 -->
          <div>{{ $t('title.teamAndSettings') }}</div>
        </div>
      </NcButton>
      <!-- 集成按钮，仅当用户有权限时显示 -->
      <NcButton
        v-if="isUIAllowed('workspaceSettings')"
        v-e="['c:integrations']"
        type="text"
        size="xsmall"
        class="nc-sidebar-top-button !xs:hidden my-0.5 !h-7"
        data-testid="nc-sidebar-integrations-btn"
        :centered="false"
        :class="{
          '!text-brand-600 !bg-brand-50 !hover:bg-brand-50': isIntegrationsPageOpened,
          '!hover:(bg-gray-200 text-gray-700)': !isIntegrationsPageOpened,
        }"
        @click="navigateToIntegrations"
      >
        <!-- 按钮内容容器 -->
        <div
          class="flex items-center gap-2"
          :class="{
            'font-semibold': isIntegrationsPageOpened,
          }"
        >
          <!-- 集成图标 -->
          <GeneralIcon icon="integration" class="!h-4" />
          <!-- 按钮文本 -->
          <div>{{ $t('general.integrations') }}</div>
        </div>
      </NcButton>
      <!-- 创建项目按钮 -->
      <WorkspaceCreateProjectBtn
        v-model:is-open="isCreateProjectOpen"
        modal
        type="text"
        class="nc-sidebar-top-button !hover:(bg-gray-200 text-gray-700) !xs:hidden !h-7 my-0.5"
        data-testid="nc-sidebar-create-base-btn"
      >
        <!-- 按钮内容容器 -->
        <div class="gap-x-2 flex flex-row w-full items-center">
          <!-- 加号图标 -->
          <GeneralIcon icon="plus" />

          <!-- 按钮文本 -->
          <div class="flex">{{ $t('title.createBase') }}</div>
        </div>
      </WorkspaceCreateProjectBtn>
    </div>
  </template>
</template>

<style lang="scss" scoped>
// 侧边栏顶部按钮的样式
.nc-sidebar-top-button {
  @apply w-full !rounded-md !font-medium !px-3;
}
</style>
