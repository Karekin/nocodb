<script lang="ts" setup>
// 从Ant Design Vue图标库中导入加载中图标组件
import { LoadingOutlined } from '@ant-design/icons-vue'

// 导出Loader组件的属性接口，用于类型定义
export interface GeneralLoaderProps {
  // 加载图标的尺寸，可以是预定义的字符串值或自定义的数字（像素）
  size?: 'small' | 'medium' | 'large' | 'xlarge' | 'regular' | number
  // 自定义加载器的CSS类名
  loaderClass?: string
}

// 定义组件的属性
const props = defineProps<GeneralLoaderProps>()

// 根据传入的size属性获取对应的字体大小CSS类
function getFontSize() {
  // 从props中解构size属性，默认值为'medium'
  const { size = 'medium' } = props

  // 根据size的值返回对应的Tailwind CSS类名
  switch (size) {
    case 'small':
      return 'text-xs' // 超小字体
    case 'medium':
      return 'text-sm' // 小字体
    case 'large':
      return 'text-xl' // 大字体
    case 'xlarge':
      return 'text-3xl' // 超大字体
    case 'regular':
      return 'text-[16px] leading-4' // 常规字体，16像素，行高为1rem
  }
}

// 创建加载指示器组件
// 使用Vue的h函数（createElement）创建LoadingOutlined组件的实例
const indicator = h(LoadingOutlined, {
  // 设置组件的CSS类，包括字体大小、布局和继承背景色与文本颜色
  // !前缀表示强制应用样式，覆盖默认样式
  class: `!${getFontSize()} flex flex-row items-center !bg-inherit !hover:bg-inherit !text-inherit ${props.loaderClass || ''}}`,
  // 如果size是数字类型，则直接设置fontSize样式为对应的像素值
  style: { ...(typeof props.size === 'number' && props.size ? { fontSize: `${props.size}px` } : {}) },
  // 设置图标为旋转状态
  spin: true,
})
</script>

<template>
  <!-- 使用Ant Design的Spin组件作为加载器 -->
  <!-- 添加nc-loader类名和flex布局相关的类 -->
  <!-- 通过indicator属性传入自定义的加载指示器 -->
  <a-spin class="nc-loader !flex flex-row items-center" :indicator="indicator" />
</template>

<style lang="scss" scoped>
// 使用:deep()选择器深度选择子组件中的元素
// 为anticon-spin类添加flex布局
:deep(.anticon-spin) {
  @apply flex;
}
</style>
