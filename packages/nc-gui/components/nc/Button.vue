<script lang="ts" setup>
// 导入Ant Design Vue按钮类型定义
import type { ButtonType } from 'ant-design-vue/lib/button'
// 导入Vue的useSlots钩子函数
import { useSlots } from 'vue'
// 导入Loader组件的属性类型定义
import type { GeneralLoaderProps } from '../general/Loader.vue'

/**
 * @description
 * Button component
 *
 * @example
 * <NcButton type="primary" size="medium" :loading="loading" @click="onClick">
 *  Save
 *  <template #loading> Saving </template>
 * </NcButton>
 */

// 定义组件的属性接口
interface Props {
  // 是否显示加载状态
  loading?: boolean
  // 是否禁用按钮
  disabled?: boolean
  // 是否显示为禁用状态（视觉效果）但实际可点击
  showAsDisabled?: boolean
  // 按钮类型，可以是Ant Design的类型或自定义的'danger'/'secondary'
  type?: ButtonType | 'danger' | 'secondary' | undefined
  // 按钮尺寸
  size?: NcButtonSize
  // 加载图标的尺寸
  loaderSize?: GeneralLoaderProps['size']
  // 内容是否居中
  centered?: boolean
  // 是否占满容器宽度
  fullWidth?: boolean
  // 是否仅显示图标
  iconOnly?: boolean
  // 图标位置：左侧或右侧
  iconPosition?: 'left' | 'right'
  // 按钮主题：默认或AI主题
  theme?: 'default' | 'ai'
  // 是否显示边框
  bordered?: boolean
  // 是否显示阴影
  shadow?: boolean
}

// 定义属性的默认值
const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  showAsDisabled: false,
  size: 'medium',
  loaderSize: 'medium',
  type: 'primary',
  fullWidth: false,
  centered: true,
  iconPosition: 'left',
  theme: 'default',
  bordered: true,
  shadow: true,
})

// 定义组件可触发的事件
const emits = defineEmits(['update:loading'])

// 获取插槽
const slots = useSlots()

// 创建按钮元素的引用
const NcButton = ref<HTMLElement | null>(null)

// 使用toRefs解构props，保持响应性
const { size, loaderSize, type, theme, bordered } = toRefs(props)

// 创建loading状态的双向绑定
const loading = useVModel(props, 'loading', emits)

// 定义按钮焦点状态
const isFocused = ref(false)
// 定义按钮点击状态
const isClicked = ref(false)

// 处理按钮获得焦点事件
const onFocus = (e: FocusEvent) => {
  // Only focus when coming from another element which is not a mouse click
  // 在下一个DOM更新周期执行
  nextTick(() => {
    // 如果是通过点击获得焦点，则不显示焦点状态
    if (isClicked.value) {
      isFocused.value = false
    } else {
      // 获取相关目标元素（从哪个元素切换过来的）
      const relatedTarget = e.relatedTarget as HTMLElement | null

      // 只有当从其他元素切换过来时才显示焦点状态
      isFocused.value = !!relatedTarget
    }

    // 重置点击状态
    isClicked.value = false
  })
}

// 处理按钮失去焦点事件
const onBlur = () => {
  // 重置焦点和点击状态
  isFocused.value = false
  isClicked.value = false
}

// 监听按钮的鼠标按下事件
useEventListener(NcButton, 'mousedown', () => {
  // 设置点击状态为true
  isClicked.value = true
})
</script>

<template>
  <a-button
    ref="NcButton"
    :class="{
      'small': size === 'small',
      'medium': size === 'medium',
      'xsmall': size === 'xsmall',
      'xxsmall': size === 'xxsmall',
      'size-xs': size === 'xs',
      'focused': isFocused,
      'theme-default': theme === 'default',
      'theme-ai': theme === 'ai',
      'bordered': bordered,
      'nc-btn-shadow': shadow,
      'nc-show-as-disabled': props.showAsDisabled,
    }"
    :disabled="props.disabled"
    :loading="loading"
    :tabindex="props.disabled ? -1 : 0"
    :type="type"
    class="nc-button"
    @blur="onBlur"
    @focus="onFocus"
  >
    <!-- 按钮内容容器 -->
    <div
      :class="{
        'justify-center': props.centered,
        'justify-start': !props.centered,
      }"
      class="flex flex-row gap-x-2.5 nc-btn-inner w-full"
    >
      <!-- 左侧图标插槽 -->
      <template v-if="iconPosition === 'left'">
        <!-- 加载状态时显示加载图标 -->
        <slot v-if="loading" name="loadingIcon">
          <GeneralLoader class="flex !bg-inherit !text-inherit" :size="loaderSize" />
        </slot>
        <!-- 非加载状态时显示普通图标 -->
        <slot v-else name="icon" />
      </template>
      <!-- 按钮文本内容 -->
      <div
        v-if="!(size === 'xxsmall' && loading) && !props.iconOnly"
        :class="{
          'font-medium': type === 'primary' || type === 'danger',
          'w-full': props.fullWidth,
        }"
        class="flex flex-row items-center"
      >
        <!-- 加载状态且有loading插槽时显示loading插槽内容 -->
        <slot v-if="loading && slots.loading" name="loading" />
        <!-- 否则显示默认插槽内容 -->
        <slot v-else />
      </div>
      <!-- 右侧图标插槽 -->
      <template v-if="iconPosition === 'right'">
        <!-- 加载状态时显示加载图标 -->
        <slot v-if="loading" name="loadingIcon">
          <GeneralLoader class="flex !bg-inherit !text-inherit" :size="loaderSize" />
        </slot>
        <!-- 非加载状态时显示普通图标 -->
        <slot v-else name="icon" />
      </template>
    </div>
  </a-button>
</template>

<style lang="scss">
// 隐藏Ant Design按钮的默认before伪元素
.ant-btn:before {
  display: none !important;
}

.nc-button {
  // 非图标元素的行高设置
  :not(.nc-icon):not(.material-symbols) {
    line-height: 0.95;
  }
  // 隐藏Ant Design的默认加载图标
  > .ant-btn-loading-icon {
    display: none !important;
  }
}

.nc-button {
  // 在xs屏幕尺寸下移除轮廓
  @apply !xs:(outline-none);

  // 按钮阴影样式
  &.nc-btn-shadow {
    box-shadow: 0px 3px 1px -2px rgba(0, 0, 0, 0.06), 0px 5px 3px -2px rgba(0, 0, 0, 0.02);
  }
  // 移除默认轮廓
  outline: none;
}

// 桌面设备样式
.desktop {
  // 焦点状态下的按钮样式
  .nc-button.ant-btn.focused {
    // 默认主题焦点样式
    &.theme-default {
      box-shadow: 0px 0px 0px 2px #fff, 0px 0px 0px 4px #3069fe;
    }

    // AI主题焦点样式
    &.theme-ai {
      box-shadow: 0px 0px 0px 2px #fff, 0px 0px 0px 4px #7d26cd;
    }
  }

  // 文本按钮焦点状态样式
  .nc-button.ant-btn-text.focused {
    // 默认主题文本按钮焦点样式
    &.theme-default {
      @apply text-brand-500;
    }

    // AI主题文本按钮焦点样式
    &.theme-ai {
      @apply text-nc-content-purple-dark;
    }
  }
}

// 基础按钮样式
.nc-button.ant-btn {
  @apply rounded-lg font-medium;
}

// 小尺寸按钮样式
.nc-button.ant-btn.small {
  @apply py-1 px-1.75 h-8 min-w-8;
}

// 中等尺寸按钮样式
.nc-button.ant-btn.medium {
  @apply py-2 px-4 h-10 min-w-10 xs:(h-10.5 max-h-10.5 min-w-10.5 !px-3);
}

// 超小尺寸按钮样式
.nc-button.ant-btn.size-xs {
  @apply px-2 py-0 h-7 min-w-7 rounded-lg text-small leading-[18px];

  // 内部div元素间距调整
  & > div {
    @apply gap-x-2;
  }
}

// 特小尺寸按钮样式
.nc-button.ant-btn.xsmall {
  @apply p-0.25 h-6.25 min-w-6.25 rounded-md;
}

// 超特小尺寸按钮样式
.nc-button.ant-btn.xxsmall {
  @apply p-0 h-5.75 min-w-5.75 rounded-md;
}

// 禁用状态按钮样式
.nc-button.ant-btn[disabled],
.ant-btn-text.nc-button.ant-btn[disabled] {
  // 移除阴影
  box-shadow: none !important;

  // 移除边框并设置不可点击光标
  @apply border-0 !cursor-not-allowed;

  // 默认主题禁用样式
  &.theme-default {
    @apply bg-gray-50 text-gray-300 md:(hover:bg-gray-50);
  }

  // AI主题禁用样式
  &.theme-ai {
    @apply bg-purple-50 text-purple-300 md:(hover:bg-purple-50);
  }
}

// 视觉禁用状态按钮样式
.nc-button.ant-btn.nc-show-as-disabled,
.ant-btn-text.nc-button.ant-btn.nc-show-as-disabled {
  // 移除阴影
  box-shadow: none !important;

  // 移除边框
  @apply border-0;

  // 默认主题视觉禁用样式
  &.theme-default {
    @apply bg-gray-50 text-gray-300 md:(hover:bg-gray-50);
  }

  // AI主题视觉禁用样式
  &.theme-ai {
    @apply bg-purple-50 text-purple-300 md:(hover:bg-purple-50);
  }
}

// 文本按钮禁用和视觉禁用状态样式
.nc-button.ant-btn-text.ant-btn[disabled],
.nc-button.ant-btn-text.ant-btn.nc-show-as-disabled {
  // 默认和AI主题的文本按钮禁用样式
  &.theme-default,
  &.theme-ai {
    @apply bg-transparent hover:bg-transparent;
  }
}

// 次要按钮禁用和视觉禁用状态样式
.nc-button.ant-btn-secondary[disabled],
.nc-button.ant-btn-secondary.nc-show-as-disabled {
  // 设置边框宽度
  @apply border-1;

  // 无边框样式
  &:not(.bordered) {
    @apply border-transparent;
  }

  // 默认主题次要按钮禁用样式
  &.theme-default {
    @apply bg-white hover:bg-white border-gray-100 text-gray-300;

    // 有边框样式
    &.bordered {
      @apply border-gray-100;
    }
  }

  // AI主题次要按钮禁用样式
  &.theme-ai {
    @apply bg-purple-50 hover:bg-purple-50  text-purple-300;

    // 有边框样式
    &.bordered {
      @apply border-purple-100;
    }
  }
}

// 主要按钮样式
.nc-button.ant-btn-primary {
  // 移除边框并设置白色文本
  @apply border-0 xs:(hover:border-0) text-white;

  // 默认主题主要按钮样式
  &.theme-default {
    @apply bg-brand-500 md:(hover:bg-brand-600);
  }

  // AI主题主要按钮样式
  &.theme-ai {
    @apply bg-purple-700 md:(hover:bg-purple-800);
  }
}

// 次要按钮样式
.nc-button.ant-btn-secondary {
  // 设置边框宽度
  @apply border-1;

  // 无边框样式
  &:not(.bordered) {
    @apply border-transparent;
  }

  // 默认主题次要按钮样式
  &.theme-default {
    @apply bg-white text-gray-700 md:(hover:bg-gray-100);

    // 有边框样式
    &.bordered {
      @apply border-gray-200;
    }
  }

  // AI主题次要按钮样式
  &.theme-ai {
    @apply bg-purple-50  text-purple-700 md:(hover:bg-purple-100);

    // 有边框样式
    &.bordered {
      @apply border-purple-200;
    }
  }
}

// 危险按钮样式
.nc-button.ant-btn-danger {
  @apply bg-red-500 border-0 hover:border-0 md:(hover:bg-red-600);
}

// 文本按钮样式
.nc-button.ant-btn-text {
  // 移除阴影
  box-shadow: none;

  // 设置透明背景和无边框
  @apply bg-transparent border-0;

  // 默认主题文本按钮样式
  &.theme-default {
    @apply text-gray-700 hover:text-gray-900 hover:bg-gray-100;
  }

  // AI主题文本按钮样式
  &.theme-ai {
    @apply text-nc-content-purple-dark hover:text-nc-content-purple-dark hover:bg-nc-bg-purple-dark;
  }

  // 焦点状态移除阴影
  &:focus {
    box-shadow: none;
  }
}
</style>
