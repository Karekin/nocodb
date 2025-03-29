<script lang="ts" setup>
// 引入并使用工作区存储
const workspaceStore = useWorkspace()

// 从工作区存储中解构出工作区加载状态
const { isWorkspaceLoading } = storeToRefs(workspaceStore)

// 从基础存储中解构出是否为共享基础的状态
const { isSharedBase } = storeToRefs(useBase())

// 从全局存储中解构出移动模式状态和应用信息
const { isMobileMode, appInfo } = useGlobal()

// 创建树视图DOM引用
const treeViewDom = ref<HTMLElement>()

// 创建树视图是否滚动到顶部的状态引用
const isTreeViewOnScrollTop = ref(false)

// 检查滚动位置是否大于零的函数
const checkScrollTopMoreThanZero = () => {
  // 如果是移动模式，则直接返回
  if (isMobileMode.value) return

  // 检查树视图DOM是否存在
  if (treeViewDom.value) {
    // 如果滚动位置大于0，设置isTreeViewOnScrollTop为true
    if (treeViewDom.value.scrollTop > 0) {
      isTreeViewOnScrollTop.value = true
    } else {
      // 否则设置为false
      isTreeViewOnScrollTop.value = false
    }
  }
  return false
}

// 组件挂载时添加滚动事件监听器
onMounted(() => {
  treeViewDom.value?.addEventListener('scroll', checkScrollTopMoreThanZero)
})

// 组件卸载时移除滚动事件监听器
onUnmounted(() => {
  treeViewDom.value?.removeEventListener('scroll', checkScrollTopMoreThanZero)
})
</script>

<template>
  <!-- 侧边栏主容器 -->
  <div
    class="nc-sidebar flex flex-col bg-gray-50 outline-r-1 outline-gray-100 select-none w-full h-full font-medium"
    :style="{
      outlineWidth: '1px',
    }"
  >
    <!-- 侧边栏顶部容器 -->
    <div class="flex flex-col">
      <!-- 侧边栏头部组件 -->
      <DashboardSidebarHeader />

      <!-- 侧边栏顶部部分组件，非共享基础时显示 -->
      <DashboardSidebarTopSection v-if="!isSharedBase" />
    </div>
    <!-- 树视图容器 -->
    <div
      ref="treeViewDom"
      class="flex flex-col nc-scrollbar-dark-md flex-grow xs:(border-transparent pt-2 pr-2)"
      :class="{
        'border-t-1': !isSharedBase,
        'border-transparent': !isTreeViewOnScrollTop,
        'pt-0.25': isSharedBase,
      }"
    >
      <!-- 工作区加载完成后显示树视图组件 -->
      <DashboardTreeView v-if="!isWorkspaceLoading" />
    </div>
    <!-- 侧边栏底部部分，非共享基础时显示 -->
    <div v-if="!isSharedBase" class="nc-sidebar-bottom-section">
      <!-- 非企业版UI时显示礼物组件 -->
      <GeneralGift v-if="!isEeUI" />
      <!-- 用户信息前的侧边栏组件 -->
      <DashboardSidebarBeforeUserInfo />
      <!-- 启用feed时显示侧边栏feed组件 -->
      <DashboardSidebarFeed v-if="appInfo.feedEnabled" />
      <!-- 侧边栏用户信息组件 -->
      <DashboardSidebarUserInfo />
    </div>
  </div>
</template>

<style lang="scss" scoped>
// 侧边栏顶部按钮样式
.nc-sidebar-top-button {
  @apply flex flex-row mx-1 px-3.5 rounded-md items-center py-0.75 my-0.5 gap-x-2 hover:bg-gray-200 cursor-pointer;
}

// 侧边栏底部部分样式
.nc-sidebar-bottom-section {
  @apply flex-none overflow-auto p-1 border-t-1;

  // 底部部分中所有直接子元素的样式
  & > * {
    @apply my-0.5;
  }

  // 底部部分中第一个直接子元素的样式
  & > :first-child {
    @apply mt-0;
  }
  // 底部部分中最后一个直接子元素的样式
  & > :last-child {
    @apply mb-0;
  }
}
</style>
