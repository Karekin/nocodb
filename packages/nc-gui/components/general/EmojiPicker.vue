<script lang="ts" setup>
// 导入emoji-mart-vue-fast库中的Apple表情数据
import data from 'emoji-mart-vue-fast/data/apple.json'
// 导入emoji-mart-vue-fast的CSS样式
import 'emoji-mart-vue-fast/css/emoji-mart.css'
// 导入Iconify的Icon组件，用于显示图标
import { Icon } from '@iconify/vue'
// 导入emoji-mart-vue-fast库中的EmojiIndex和Picker组件
import { EmojiIndex, Picker } from 'emoji-mart-vue-fast/src'

// 定义组件的属性
const props = defineProps<{
  // 初始表情符号
  emoji?: string | undefined
  // 表情符号大小，可选值为xsmall、small、medium、large、xlarge
  size?: 'xsmall' | 'small' | 'medium' | 'large' | 'xlarge'
  // 是否为只读模式
  readonly?: boolean
  // 是否禁用清除功能
  disableClearing?: boolean
  // 容器的自定义类名
  containerClass?: string
}>()

// 定义组件的事件
const emit = defineEmits(['emojiSelected'])

// 从props中解构出需要的属性，并设置默认值
const { emoji: initialEmoji, size = 'medium', readonly, containerClass } = props

// 计算属性：是否可清除表情符号
const clearable = computed(() => {
  return !props.disableClearing && !readonly
})

// 表情选择器是否打开的状态
const isOpen = ref(false)

// 创建EmojiIndex实例，用于过滤和搜索表情符号
const emojiIndex = new EmojiIndex(data, {
  // 过滤表情符号的函数
  emojisToShowFilter: (emoji: any) => {
    // 过滤掉Unicode 14.0及以上版本的表情符号
    if (Number(emoji.added_in) >= 14) {
      return false
    }

    return true
  },
})
// 当前选中的表情符号引用
const emojiRef = ref(initialEmoji || '')

// 选择表情符号的处理函数
function selectEmoji(_emoji: any) {
  // 更新当前选中的表情符号
  emojiRef.value = _emoji.native
  // 触发emojiSelected事件，传递选中的表情符号
  emit('emojiSelected', _emoji.native)

  // 关闭表情选择器
  isOpen.value = false
}

// 点击表情符号容器的处理函数
const onClick = (e: Event) => {
  // 如果是只读模式，则不做任何处理
  if (readonly) return

  // 阻止事件冒泡
  e.stopPropagation()

  // 切换表情选择器的打开/关闭状态
  isOpen.value = !isOpen.value
}

// 清除表情符号的处理函数
const clearEmoji = () => {
  // 清空当前选中的表情符号
  emojiRef.value = ''
  // 触发emojiSelected事件，传递空字符串
  emit('emojiSelected', '')

  // 关闭表情选择器
  isOpen.value = false
}

// 计算属性：是否显示清除按钮
const showClearButton = computed(() => {
  // 当有表情符号且可清除时显示清除按钮
  return !!emojiRef.value && clearable.value
})

// 监听表情选择器的打开状态
watch(isOpen, (val) => {
  // 如果表情选择器未打开，则不做任何处理
  if (!val) return
  // 在下一个DOM更新周期执行
  nextTick(() => {
    // 设置延时，确保DOM已经渲染完成
    setTimeout(() => {
      // 获取表情搜索输入框元素
      const input = document.querySelector<HTMLInputElement>('.emoji-mart-search input')
      // 如果输入框不存在，则不做任何处理
      if (!input) return
      // 让输入框获得焦点
      input.focus()
      // 选中输入框中的所有文本
      input.select()
    }, 250)
  })
})
</script>

<template>
  <!-- 使用NcDropdown组件作为表情选择器的容器 -->
  <NcDropdown v-model:visible="isOpen" :disabled="readonly" destroy-popup-on-hide overlay-class-name="overflow-hidden">
    <!-- 表情符号显示区域 -->
    <div
      class="flex-none flex flex-row justify-center items-center select-none rounded-md nc-emoji"
      :class="[
        {
          'hover:bg-gray-500 hover:bg-opacity-15 cursor-pointer': !readonly,
          'bg-gray-500 bg-opacity-15': isOpen,
          'h-4 w-4 text-[16px] leading-4': size === 'xsmall',
          'h-6 w-6 text-lg': size === 'small',
          'h-8 w-8 text-xl': size === 'medium',
          'h-10 w-10 text-2xl': size === 'large',
          'h-14 w-16 text-5xl': size === 'xlarge',
        },
        containerClass,
      ]"
      @click="onClick"
    >
      <!-- 当没有选中表情符号时，显示默认插槽内容 -->
      <template v-if="!emojiRef">
        <slot name="default" />
      </template>
      <!-- 当选中的是Unicode表情符号时，直接显示 -->
      <template v-else-if="isUnicodeEmoji(emojiRef)">
        {{ emojiRef }}
      </template>
      <!-- 当选中的是图标时，使用Icon组件显示 -->
      <template v-else>
        <Icon :data-testid="`nc-icon-${emojiRef}`" class="text-lg" :icon="emojiRef"></Icon>
      </template>
    </div>
    <!-- 下拉菜单内容 -->
    <template #overlay>
      <!-- 表情选择器容器 -->
      <div
        class="relative"
        :class="{
          clearable: showClearButton,
        }"
      >
        <!-- 使用Picker组件显示表情选择器 -->
        <Picker
          :data="emojiIndex"
          :native="true"
          :show-preview="false"
          color="#40444D"
          :auto-focus="true"
          class="nc-emoji-picker"
          @select="selectEmoji"
          @click.stop="() => {}"
        >
        </Picker>
        <!-- 清除按钮 -->
        <div v-if="showClearButton" class="absolute top-10 right-1.5">
          <div
            role="button"
            class="flex flex-row items-center h-[32px] -mt-[1px] bg-white border-1 border-gray-100 py-0.5 px-2.5 rounded hover:bg-gray-100 cursor-pointer"
            @click="clearEmoji"
          >
            Remove
          </div>
        </div>
      </div>
    </template>
  </NcDropdown>
</template>

<style lang="scss">
// 当显示清除按钮时，调整搜索框的右内边距
.clearable {
  .emoji-mart-search {
    @apply pr-22;
  }
}
// 表情选择器的样式
.nc-emoji-picker.emoji-mart {
  // 设置宽度并移除边框
  @apply !w-90;
  @apply border-none;

  // 设置表情符号为可点击状态
  span.emoji-type-native {
    @apply cursor-pointer;
  }

  // 设置锚点（分类导航）的样式
  .emoji-mart-anchor {
    @apply h-8 py-1.5;
    // 设置SVG图标的高度
    svg {
      @apply h-3.5 !important;
    }
  }

  // 设置搜索框的样式
  .emoji-mart-search {
    // 设置输入框的样式
    input {
      @apply text-sm pl-[11px] rounded-lg !py-5px transition-all duration-300 !outline-none ring-0;

      // 设置输入框获得焦点时的样式
      &:focus {
        @apply !outline-none ring-0 shadow-selected border-primary;
      }
    }
  }

  // 设置滚动区域的样式
  .emoji-mart-scroll {
    @apply mt-1 px-1 overflow-x-hidden;

    // 设置分类标签的样式
    h3.emoji-mart-category-label {
      @apply text-xs text-gray-500 mb-0;
    }

    // 设置分类的宽度
    .emoji-mart-category {
      @apply w-88;
    }
  }

  // 设置滚动区域的滚动条样式
  .emoji-mart-scroll {
    // 使用overlay滚动方式
    overflow-y: overlay;

    // 设置滚动条的样式
    &::-webkit-scrollbar {
      width: 3px;
    }
    // 设置滚动条轨道的样式
    &::-webkit-scrollbar-track {
      background: #f6f6f600 !important;
    }
    // 设置滚动条滑块的样式
    &::-webkit-scrollbar-thumb {
      background: #f6f6f600;
    }
    // 设置滚动条滑块悬停时的样式
    &::-webkit-scrollbar-thumb:hover {
      background: #f6f6f600;
    }
  }
  // 设置滚动区域悬停时的滚动条样式
  .emoji-mart-scroll:hover {
    // 设置滚动条的宽度
    &::-webkit-scrollbar {
      width: 3px;
    }
    // 设置滚动条轨道的样式
    &::-webkit-scrollbar-track {
      background: #f6f6f600 !important;
    }
    // 设置滚动条滑块的样式
    &::-webkit-scrollbar-thumb {
      background: rgb(215, 215, 215);
    }
    // 设置滚动条滑块悬停时的样式
    &::-webkit-scrollbar-thumb:hover {
      background: rgb(203, 203, 203);
    }
  }

  // 设置表情符号的内边距和外边距
  .emoji-mart-emoji {
    @apply !px-1 !py-0.75 !m-0.5;
  }
  // 设置表情符号悬停时的样式
  .emoji-mart-emoji:hover:before {
    @apply !rounded-md;
  }
}
</style>
