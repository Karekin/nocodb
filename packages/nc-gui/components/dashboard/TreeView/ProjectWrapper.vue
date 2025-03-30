<script lang="ts" setup>
// 从 nocodb-sdk 导入 BaseType 类型定义，用于项目基础类型的类型检查
import type { BaseType } from 'nocodb-sdk'

// 定义组件的属性，使用 withDefaults 设置默认值
// defineProps 定义了两个属性：baseRole（项目角色）和 base（项目基础对象）
const props = withDefaults(
  defineProps<{
    // baseRole 属性，可以是字符串或字符串数组，表示用户在项目中的角色
    baseRole: string | string[]
    // base 属性，类型为 BaseType，包含项目的基础信息
    base: BaseType
  }>(),
  {
    // 设置 baseRole 的默认值为空字符串
    baseRole: '',
  },
)

// 使用 toRef 创建对 props.baseRole 的响应式引用，方便在组件内部使用和传递
const baseRole = toRef(props, 'baseRole')
// 使用 toRef 创建对 props.base 的响应式引用，方便在组件内部使用和传递
const base = toRef(props, 'base')

// 使用 provide 将 baseRole 提供给子组件，使用 ProjectRoleInj 作为注入键
// 这样子组件可以通过 inject(ProjectRoleInj) 获取项目角色信息
provide(ProjectRoleInj, baseRole)
// 使用 provide 将 base 提供给子组件，使用 ProjectInj 作为注入键
// 这样子组件可以通过 inject(ProjectInj) 获取项目基础信息
provide(ProjectInj, base)
</script>

<template>
  <!-- 使用插槽渲染子组件内容，允许父组件将任何内容传递给这个包装器 -->
  <slot />
</template>
