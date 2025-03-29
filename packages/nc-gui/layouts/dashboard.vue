<!-- 使用 setup 语法的 TypeScript 脚本块 -->
<script lang="ts" setup>
// 获取路由器实例，用于编程式导航
const router = useRouter()
// 获取当前路由对象，用于访问路由信息
const route = router.currentRoute
</script>

<!-- 常规 TypeScript 脚本块，用于定义组件选项 -->
<script lang="ts">
export default {
  // 定义组件名称为 'DashboardLayout'
  name: 'DashboardLayout',
}
</script>

<!-- 模板部分，定义组件的 HTML 结构 -->
<template>
  <!-- 使用 NuxtLayout 组件作为布局容器 -->
  <NuxtLayout>
    <!-- 条件渲染：如果当前路由的 meta 中 hasSidebar 为 false，则只渲染 content 插槽 -->
    <slot v-if="!route.meta.hasSidebar" name="content" />

    <!-- 条件渲染：如果当前路由的 meta 中 hasSidebar 为 true，则使用 LazyDashboardView 组件 -->
    <LazyDashboardView v-else>
      <!-- 侧边栏插槽，用于接收父组件传入的侧边栏内容 -->
      <template #sidebar>
        <slot name="sidebar" />
      </template>
      <!-- 内容插槽，用于接收父组件传入的主要内容 -->
      <template #content>
        <slot name="content" />
      </template>
    </LazyDashboardView>
  </NuxtLayout>
</template>
