<script setup lang="ts">
// 引入并使用工作区存储
const workspaceStore = useWorkspace()

// 从侧边栏存储中解构出左侧边栏是否打开的状态
const { isLeftSidebarOpen } = storeToRefs(useSidebarStore())

// 从工作区存储中解构出当前活动的工作区和工作区加载状态
const { activeWorkspace, isWorkspaceLoading } = storeToRefs(workspaceStore)

// 从视图存储中解构出当前活动视图的标题或ID
const { activeViewTitleOrId } = storeToRefs(useViewsStore())

// 从表格存储中解构出当前活动表格的ID
const { activeTableId } = storeToRefs(useTablesStore())

// 从全局存储中获取是否为移动模式
const { isMobileMode } = useGlobal()

// 计算属性：决定是否显示侧边栏按钮
// 在移动模式下，如果没有活动视图和活动表格，则不显示
const showSidebarBtn = computed(() => !(isMobileMode.value && !activeViewTitleOrId.value && !activeTableId.value))
</script>

<template>
  <!-- 侧边栏头部容器 -->
  <div
    class="flex items-center nc-sidebar-header w-full border-b-1 border-gray-200 group md:(px-2 py-1.2) xs:(px-1 py-1)"
    :data-workspace-title="activeWorkspace?.title"
    style="height: var(--topbar-height)"
  >
    <!-- 工作区加载完成后显示的内容 -->
    <div v-if="!isWorkspaceLoading" class="flex flex-row items-center w-full">
      <!-- 工作区菜单组件 -->
      <WorkspaceMenu />

      <!-- 弹性空间，用于将后续元素推到右侧 -->
      <div class="flex flex-grow min-w-1"></div>

      <!-- 侧边栏切换按钮的工具提示 -->
      <NcTooltip
        class="flex"
        :class="{
          '!opacity-100': !isLeftSidebarOpen,
        }"
        placement="bottom"
        hide-on-click
      >
        <!-- 工具提示标题模板 -->
        <template #title>
          <!-- 根据侧边栏状态显示不同的提示文本 -->
          {{ isLeftSidebarOpen ? `${$t('title.hideSidebar')}` : `${$t('title.showSidebar')}` }}
        </template>
        <!-- 侧边栏切换按钮 -->
        <NcButton
          v-if="showSidebarBtn"
          v-e="['c:leftSidebar:hideToggle']"
          :type="isMobileMode ? 'secondary' : 'text'"
          :size="isMobileMode ? 'medium' : 'small'"
          class="nc-sidebar-left-toggle-icon !text-gray-700 !hover:text-gray-800 !xs:(h-10.5 max-h-10.5 max-w-10.5) !md:(hover:bg-gray-200)"
          @click="isLeftSidebarOpen = !isLeftSidebarOpen"
        >
          <!-- 按钮内容容器 -->
          <div class="flex items-center text-inherit">
            <!-- 移动模式下显示关闭图标 -->
            <GeneralIcon v-if="isMobileMode" icon="close" />
            <!-- 非移动模式下显示双箭头图标，根据侧边栏状态旋转 -->
            <GeneralIcon
              v-else
              icon="doubleLeftArrow"
              class="duration-150 transition-all !text-lg -mt-0.5 !text-gray-500/75"
              :class="{
                'transform rotate-180': !isLeftSidebarOpen,
              }"
            />
          </div>
        </NcButton>
      </NcTooltip>
    </div>
    <!-- 工作区加载中时显示的骨架屏 -->
    <div v-else class="flex flex-row items-center w-full mt-0.25 ml-2.5 gap-x-3">
      <!-- 第一个骨架输入框，用于工作区图标占位 -->
      <a-skeleton-input :active="true" class="!w-6 !h-6 !rounded overflow-hidden" />
      <!-- 第二个骨架输入框，用于工作区标题占位 -->
      <a-skeleton-input :active="true" class="!w-40 !h-6 !rounded overflow-hidden" />
    </div>
  </div>
</template>
