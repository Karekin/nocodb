<!-- 使用 TypeScript 的 Vue 组件，采用组合式 API (setup) -->
<script lang="ts" setup>
// 从全局状态中解构获取 appInfo 对象，包含应用程序信息如版本号等
const { appInfo } = useGlobal()
</script>

<!-- 组件模板部分 -->
<template>
  <!-- 主容器，使用 flex 布局，设置内边距和圆角，宽度为100%但最大宽度有限制 -->
  <div class="flex flex-row flex-grow pl-0.5 pr-1 py-0.5 rounded-md w-full" style="max-width: calc(100% - 2.5rem)">
    <!-- 内部容器，允许伸展并设置最小宽度 -->
    <div class="flex-grow min-w-20">
      <!-- 工作区菜单容器，包含测试ID，使用flex布局并设置溢出隐藏和内边距 -->
      <div
        data-testid="nc-workspace-menu"
        class="flex items-center nc-workspace-menu overflow-hidden py-1.25 pr-0.25 justify-center w-full ml-2"
      >
        <!-- 链接到NocoDB GitHub仓库的锚标签，设置过渡动画效果和宽度 -->
        <a
          class="transition-all duration-200 transform w-24 min-w-10"
          href="https://github.com/nocodb/nocodb"
          target="_blank"
          rel="noopener noreferrer"
        >
          <!-- 工具提示组件，当没有版本信息或是企业版UI时禁用 -->
          <NcTooltip :disabled="!appInfo?.version || isEeUI">
            <!-- 工具提示标题插槽，显示应用版本号 -->
            <template #title>{{ appInfo?.version }}</template>
            <!-- NocoDB logo图片 -->
            <img alt="NocoDB" src="~/assets/img/brand/nocodb.png" />
          </NcTooltip>
        </a>
        <!-- 空白填充区域，用于布局调整 -->
        <div class="flex flex-grow"></div>
      </div>
    </div>
  </div>
</template>

<!-- 组件局部样式，使用SCSS预处理器 -->
<style scoped lang="scss">
// 工作区菜单项的样式，应用Tailwind CSS类
.nc-workspace-menu-item {
  @apply flex items-center pl-2 py-2 gap-2 text-sm hover:text-black;
}
</style>
