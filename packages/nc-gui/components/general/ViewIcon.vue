<script lang="ts" setup>
// 导入 ViewType 类型定义，用于视图元数据的类型约束
import type { ViewType } from 'nocodb-sdk'

// 定义组件的属性
// meta: 视图的元数据，类型为 ViewType
// ignoreColor: 可选布尔值，用于控制是否忽略视图图标的颜色
const props = defineProps<{
  meta: ViewType
  ignoreColor?: boolean
}>()

// 创建 meta 属性的响应式引用，方便在模板中使用
const viewMeta = toRef(props, 'meta')
</script>

<template>
  <!-- 当视图元数据中包含自定义图标时，显示表情符号选择器 -->
  <LazyGeneralEmojiPicker
    v-if="viewMeta?.meta?.icon"
    :data-testid="`nc-emoji-${viewMeta.meta?.icon}`"
    size="xsmall"
    :emoji="viewMeta.meta?.icon"
    readonly
  />
  <!-- 当没有自定义图标但有视图类型时，显示对应类型的默认图标 -->
  <component
    :is="viewIcons[viewMeta.type]?.icon"
    v-else-if="viewMeta?.type"
    class="nc-view-icon group-hover"
    :style="{
      // 根据 ignoreColor 属性决定是否应用视图类型的默认颜色
      color: !props.ignoreColor ? viewIcons[viewMeta.type]?.color : undefined,
      fontWeight: 500,
    }"
  />
</template>

<style>
/* 设置视图图标的基本样式 */
.nc-view-icon {
  font-size: 1.05rem;
}
</style>
