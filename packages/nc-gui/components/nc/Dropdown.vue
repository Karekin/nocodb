<script lang="ts" setup>
// 定义组件的属性，使用 withDefaults 设置默认值
const props = withDefaults(
  // 使用 TypeScript 泛型定义属性类型
  defineProps<{
    // 触发下拉菜单的方式数组，可以是点击、悬停或右键菜单
    trigger?: Array<'click' | 'hover' | 'contextmenu'>
    // 控制下拉菜单是否可见
    visible?: boolean | undefined
    // 下拉菜单容器的自定义类名
    overlayClassName?: string | undefined
    // 下拉菜单容器的自定义样式对象
    overlayStyle?: Record<string, any>
    // 是否禁用下拉菜单
    disabled?: boolean
    // 下拉菜单的弹出位置
    placement?: 'bottom' | 'top' | 'bottomLeft' | 'bottomRight' | 'topLeft' | 'topRight' | 'topCenter' | 'bottomCenter' | 'right'
    // 是否自动关闭下拉菜单（点击外部或按ESC键时）
    autoClose?: boolean
  }>(),
  // 设置属性的默认值
  {
    // 默认触发方式为点击
    trigger: () => ['click'],
    // 默认可见性为未定义（由父组件控制）
    visible: undefined,
    // 默认弹出位置为左下方
    placement: 'bottomLeft',
    // 默认不禁用
    disabled: false,
    // 默认无自定义类名
    overlayClassName: undefined,
    // 默认自动关闭
    autoClose: true,
    // 默认无自定义样式
    overlayStyle: () => ({}),
  },
)

// 定义组件可触发的事件
const emits = defineEmits(['update:visible'])

// 将 trigger 属性转换为响应式引用
const trigger = toRef(props, 'trigger')

// 将 overlayClassName 属性转换为响应式引用
const overlayClassName = toRef(props, 'overlayClassName')

// 将 placement 属性转换为响应式引用
const placement = toRef(props, 'placement')

// 将 overlayStyle 属性转换为响应式引用
const overlayStyle = toRef(props, 'overlayStyle')

// 创建计算属性，返回 autoClose 的值
const autoClose = computed(() => props.autoClose)

// 使用 useVModel 创建双向绑定的响应式引用，用于控制下拉菜单的可见性
const visible = useVModel(props, 'visible', emits)

// 创建本地可见性状态，初始值为 props.visible
const localIsVisible = ref<boolean | undefined>(props.visible)

// 计算最终的 overlayClassName，组合基础类名和自定义类名
const overlayClassNameComputed = computed(() => {
  // 基础类名，设置下拉菜单的基本样式
  let className = 'nc-dropdown bg-white rounded-lg border-1 border-gray-200 shadow-lg'
  // 如果有自定义类名，则添加到基础类名后
  if (overlayClassName.value) {
    className += ` ${overlayClassName.value}`
  }
  // 根据可见性状态添加 active 类
  className += visible.value ? ' active' : ' '
  // 返回最终的类名
  return className
})

// 监听 ESC 键按下事件，如果下拉菜单可见且启用了自动关闭，则关闭下拉菜单
onKeyStroke('Escape', () => {
  // 检查下拉菜单是否可见且启用了自动关闭
  if (visible.value && autoClose.value) {
    // 关闭下拉菜单
    visible.value = false
  }
})

// 创建下拉菜单容器的 DOM 引用
const overlayWrapperDomRef = ref<HTMLElement | null>(null)

// 监听点击下拉菜单外部的事件，如果启用了自动关闭，则关闭下拉菜单
onClickOutside(overlayWrapperDomRef, () => {
  // 如果未启用自动关闭，则直接返回
  if (!autoClose.value) return

  // 关闭下拉菜单
  visible.value = false
})

// 处理可见性更新的函数
const onVisibleUpdate = (event: boolean) => {
  // 更新本地可见性状态
  localIsVisible.value = event

  // 如果 visible 不是 undefined，则更新 visible 的值
  if (visible !== undefined) {
    // 更新 visible 的值
    visible.value = event
  } else {
    // 否则触发 update:visible 事件
    emits('update:visible', event)
  }
}

// 监视 visible 的变化，同步更新本地可见性状态
watch(
  // 监视的响应式引用
  visible,
  // 监视回调函数
  (newValue) => {
    // 如果新值与本地状态相同，则不做任何操作
    if (newValue === localIsVisible.value) return

    // 更新本地可见性状态
    localIsVisible.value = visible.value
  },
  // 立即执行一次监视回调
  { immediate: true },
)
</script>

<template>
  <!-- 使用 Ant Design Vue 的 a-dropdown 组件 -->
  <a-dropdown
    :disabled="disabled"
    :visible="visible"
    :placement="placement as any"
    :trigger="trigger"
    :overlay-class-name="overlayClassNameComputed"
    :overlay-style="overlayStyle"
    @update:visible="onVisibleUpdate"
  >
    <slot :visible="localIsVisible" :on-change="onVisibleUpdate" />

    <!-- overlay 插槽，用于放置下拉菜单的内容 -->
    <template #overlay>
      <slot ref="overlayWrapperDomRef" name="overlay" :visible="localIsVisible" :on-change="onVisibleUpdate" />
    </template>
  </a-dropdown>
</template>
