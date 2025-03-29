<script lang="ts" setup>
// 从 @vueuse/core 导入 onKeyStroke 函数，用于监听键盘按键事件
import { onKeyStroke } from '@vueuse/core'
// 导入 CSSProperties 类型，用于定义 CSS 样式属性
import type { CSSProperties } from '@vue/runtime-dom'
// 导入 TooltipPlacement 类型，用于定义工具提示的位置
import type { TooltipPlacement } from 'ant-design-vue/lib/tooltip'

// 定义组件的属性接口
interface Props {
  // Key to be pressed on hover to trigger the tooltip
  // 定义悬停时需要按下的键以触发工具提示
  modifierKey?: string
  // 定义工具提示的样式
  tooltipStyle?: CSSProperties
  // 定义传递给组件的额外属性
  attrs?: Record<string, unknown>
  // force disable tooltip
  // 定义工具提示的颜色主题，可以是深色或浅色
  color?: 'dark' | 'light'
  // 定义是否禁用工具提示
  disabled?: boolean
  // 定义工具提示的位置
  placement?: TooltipPlacement | undefined
  // 定义是否仅在文本截断时显示工具提示
  showOnTruncateOnly?: boolean
  // 定义点击时是否隐藏工具提示
  hideOnClick?: boolean
  // 定义工具提示的额外类名
  overlayClassName?: string
  // 定义包裹子元素的 HTML 标签名
  wrapChild?: keyof HTMLElementTagNameMap
  // 定义鼠标离开后延迟隐藏的时间
  mouseLeaveDelay?: number
  // 定义工具提示内部样式
  overlayInnerStyle?: object
}

// 定义组件的属性
const props = defineProps<Props>()

// 创建计算属性获取修饰键
const modifierKey = computed(() => props.modifierKey)
// 创建计算属性获取工具提示样式
const tooltipStyle = computed(() => props.tooltipStyle)
// 创建计算属性获取是否禁用
const disabled = computed(() => props.disabled)
// 创建计算属性获取是否仅在文本截断时显示
const showOnTruncateOnly = computed(() => props.showOnTruncateOnly)
// 创建计算属性获取点击时是否隐藏
const hideOnClick = computed(() => props.hideOnClick)
// 创建计算属性获取位置，默认为顶部
const placement = computed(() => props.placement ?? 'top')
// 创建计算属性获取包裹子元素的标签名，默认为 div
const wrapChild = computed(() => props.wrapChild ?? 'div')
// 创建计算属性获取额外属性
const attributes = computed(() => props.attrs)

// 创建计算属性获取颜色主题，默认为深色
const color = computed(() => (props.color ? props.color : 'dark'))

// 创建对子元素的引用
const el = ref()

// 创建对工具提示内容元素的引用
const element = ref()

// 创建一个受控的引用，用于控制工具提示的显示状态
const showTooltip = controlledRef(false, {
  // 在改变前检查是否应该显示
  onBeforeChange: (shouldShow) => {
    // 如果应该显示但被禁用，则返回 false
    if (shouldShow && disabled.value) return false
  },
})

// 使用 useElementHover 检测子元素是否被悬停
const isHovering = useElementHover(() => el.value)

// 使用 useElementHover 检测工具提示内容是否被悬停
const isOverlayHovering = useElementHover(() => element.value)

// 获取所有传递给组件的属性
const allAttrs = useAttrs()

// 创建一个引用，用于跟踪修饰键是否被按下
const isKeyPressed = ref(false)

// 创建计算属性获取工具提示的额外类名
const overlayClassName = computed(() => props.overlayClassName)

// 监听修饰键的按下事件
onKeyStroke(
  // 检查按下的键是否是指定的修饰键
  (e) => e.key === modifierKey.value,
  // 当修饰键被按下时执行的回调函数
  (e) => {
    // 阻止默认行为
    e.preventDefault()

    // 如果子元素正在被悬停，则显示工具提示
    if (isHovering.value) {
      showTooltip.value = true
    }

    // 标记修饰键为已按下
    isKeyPressed.value = true
  },
  // 指定事件名为 keydown
  { eventName: 'keydown' },
)

// 监听修饰键的释放事件
onKeyStroke(
  // 检查释放的键是否是指定的修饰键
  (e) => e.key === modifierKey.value,
  // 当修饰键被释放时执行的回调函数
  (e) => {
    // 阻止默认行为
    e.preventDefault()

    // 隐藏工具提示
    showTooltip.value = false
    // 标记修饰键为未按下
    isKeyPressed.value = false
  },
  // 指定事件名为 keyup
  { eventName: 'keyup' },
)

// 使用 watchDebounced 监视多个值的变化，并添加防抖处理
watchDebounced(
  // 监视的值数组
  [isOverlayHovering, isHovering, () => modifierKey.value, () => disabled.value],
  // 当监视的值变化时执行的回调函数
  ([overlayHovering, hovering, key, isDisabled]) => {
    // 如果设置了仅在文本截断时显示
    if (showOnTruncateOnly?.value) {
      // 获取目标元素
      const targetElement = el?.value
      // 检查元素是否被截断（内容宽度大于可见宽度）
      const isElementTruncated = targetElement && targetElement.scrollWidth > targetElement.clientWidth
      // 如果元素没有被截断
      if (!isElementTruncated) {
        // 但如果工具提示内容正在被悬停，则保持显示
        if (overlayHovering) {
          showTooltip.value = true
          return
        }
        // 否则隐藏工具提示
        showTooltip.value = false
        return
      }
    }
    // 如果工具提示内容正在被悬停，则显示工具提示
    if (overlayHovering) {
      showTooltip.value = true
      return
    }
    // 如果子元素没有被悬停或工具提示被禁用，且没有设置鼠标离开延迟，则隐藏工具提示
    if ((!hovering || isDisabled) && !props.mouseLeaveDelay) {
      showTooltip.value = false
      return
    }

    // Show tooltip on mouseover if no modifier key is provided
    // 如果没有设置修饰键，则在鼠标悬停时显示工具提示
    if (hovering && !key) {
      showTooltip.value = true
      return
    }

    // While hovering if the modifier key was changed and the key is not pressed, hide tooltip
    // 如果在悬停时修饰键被更改且该键未被按下，则隐藏工具提示
    if (hovering && key && !isKeyPressed.value) {
      showTooltip.value = false
      return
    }

    // When mouse leaves the element, then re-enters the element while key stays pressed, show the tooltip
    // 当鼠标离开元素后再次进入元素，且修饰键保持按下状态时，显示工具提示
    if (!showTooltip.value && hovering && key && isKeyPressed.value) {
      showTooltip.value = true
    }
  },
  // 防抖配置
  {
    // 防抖延迟时间为 100 毫秒
    debounce: 100,
  },
)

// 计算 div 的样式和类
const divStyles = computed(() => ({
  // 从所有属性中获取样式
  style: allAttrs.style as CSSProperties,
  // 从所有属性中获取类名
  class: allAttrs.class as string,
}))

// 点击事件处理函数
const onClick = () => {
  // 如果设置了点击时隐藏且工具提示当前正在显示，则隐藏工具提示
  if (hideOnClick.value && showTooltip.value) {
    showTooltip.value = false
  }
}
</script>

<template>
  <!-- 使用 ant-design-vue 的 Tooltip 组件 -->
  <a-tooltip
    v-model:visible="showTooltip"
    :overlay-class-name="`nc-tooltip-${color} ${showTooltip ? 'visible' : 'hidden'} ${overlayClassName}`"
    :overlay-style="tooltipStyle"
    :overlay-inner-style="overlayInnerStyle"
    arrow-point-at-center
    :trigger="[]"
    :placement="placement"
    :mouse-leave-delay="mouseLeaveDelay"
  >
    <!-- 工具提示标题插槽 -->
    <template #title>
      <!-- 工具提示内容容器 -->
      <div ref="element">
        <!-- 使用名为 title 的插槽内容 -->
        <slot name="title" />
      </div>
    </template>

    <!-- 动态组件，根据 wrapChild 属性决定使用哪种 HTML 标签 -->
    <component
      :is="wrapChild"
      ref="el"
      v-bind="{
        ...divStyles,
        ...attributes,
      }"
      @mousedown="onClick"
    >
      <!-- 使用默认插槽内容 -->
      <slot />
    </component>
  </a-tooltip>
</template>

<style lang="scss">
// 隐藏的工具提示样式
.nc-tooltip.hidden {
  @apply invisible;
}
// 深色主题工具提示样式
.nc-tooltip-dark {
  // 工具提示内部样式
  .ant-tooltip-inner {
    @apply !px-2 !py-1 !rounded-lg !bg-gray-800;
  }
  // 工具提示箭头内容样式
  .ant-tooltip-arrow-content {
    @apply !bg-gray-800;
  }
}

// 浅色主题工具提示样式
.nc-tooltip-light {
  // 工具提示内部样式
  .ant-tooltip-inner {
    @apply !px-2 !py-1 !text-gray-800 !rounded-lg !bg-gray-200;
  }
  // 工具提示箭头内容样式
  .ant-tooltip-arrow-content {
    @apply !bg-gray-200;
  }
}
</style>
