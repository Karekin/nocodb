<script lang="ts" setup>
// 导入分割面板相关组件
import { Pane, Splitpanes } from 'splitpanes'
// 导入分割面板的样式
import 'splitpanes/dist/splitpanes.css'

// 获取路由器实例
const router = useRouter()
// 获取当前路由对象
const route = router.currentRoute

// 从全局状态中获取设置左侧边栏大小的方法
const { setLeftSidebarSize } = useGlobal()

// 从配置存储中获取移动模式状态
const { isMobileMode } = storeToRefs(useConfigStore())

// 从侧边栏存储中获取多个状态引用
const {
  // 侧边栏是否打开
  isLeftSidebarOpen,
  // 左侧边栏宽度百分比
  leftSidebarWidthPercent,
  // 左侧边栏大小（重命名为sideBarSize以便在组件中使用）
  leftSideBarSize: sideBarSize,
  // 左侧边栏状态（重命名为sidebarState以便在组件中使用）
  leftSidebarState: sidebarState,
  // 移动设备上的侧边栏大小标准化值
  mobileNormalizedSidebarSize,
} = storeToRefs(useSidebarStore())

// 创建对侧边栏包装器DOM元素的引用
const wrapperRef = ref<HTMLDivElement>()

// 设置动画持续时间（毫秒）
const animationDuration = 250
// 存储视口宽度的响应式引用
const viewportWidth = ref(window.innerWidth)

// 计算属性：当前侧边栏大小，支持获取和设置
const currentSidebarSize = computed({
  // 获取当前侧边栏大小
  get: () => sideBarSize.value.current,
  // 设置当前侧边栏大小，同时更新旧值
  set: (val) => {
    sideBarSize.value.current = val
    sideBarSize.value.old = val
  },
})

// 从配置存储中获取处理移动设备上非视图页面侧边栏打开的方法
const { handleSidebarOpenOnMobileForNonViews } = useConfigStore()

// 计算属性：移动设备上内容区域的标准化大小
const mobileNormalizedContentSize = computed(() => {
  // 如果是移动模式
  if (isMobileMode.value) {
    // 如果侧边栏打开，内容区域大小为0，否则为100%
    return isLeftSidebarOpen.value ? 0 : 100
  }

  // 非移动模式下，内容区域大小为100%减去侧边栏宽度百分比
  return 100 - leftSidebarWidthPercent.value
})

// 监听当前侧边栏大小的变化
watch(currentSidebarSize, () => {
  // 更新侧边栏宽度百分比
  leftSidebarWidthPercent.value = (currentSidebarSize.value / viewportWidth.value) * 100
  // 设置左侧边栏大小到全局状态
  setLeftSidebarSize({ current: currentSidebarSize.value, old: sideBarSize.value.old })
})

// 计算属性：侧边栏宽度
const sidebarWidth = computed(() => (isMobileMode.value ? viewportWidth.value : sideBarSize.value.old))

// 辅助函数：将rem单位转换为像素
const remToPx = (rem: number) => {
  // 获取根元素的字体大小
  const fontSize = parseFloat(getComputedStyle(document.documentElement).fontSize)
  // 返回rem值乘以字体大小
  return rem * fontSize
}

// 计算属性：标准化后的侧边栏宽度
const normalizedWidth = computed(() => {
  // 根据视口宽度确定最大尺寸
  const maxSize = remToPx(viewportWidth.value <= 1560 ? 20 : 35)
  // 设置最小尺寸
  const minSize = remToPx(16)

  // 如果侧边栏宽度大于最大尺寸，返回最大尺寸
  if (sidebarWidth.value > maxSize) {
    return maxSize
    // 如果侧边栏宽度小于最小尺寸，返回最小尺寸
  } else if (sidebarWidth.value < minSize) {
    return minSize
    // 否则返回当前侧边栏宽度
  } else {
    return sidebarWidth.value
  }
})

// 监听侧边栏打开状态的变化
watch(isLeftSidebarOpen, () => {
  // 将当前侧边栏大小设置为旧值
  sideBarSize.value.current = sideBarSize.value.old

  // 如果侧边栏打开
  if (isLeftSidebarOpen.value) {
    // 立即设置侧边栏状态为开始打开
    setTimeout(() => (sidebarState.value = 'openStart'), 0)

    // 动画结束后设置侧边栏状态为完全打开
    setTimeout(() => (sidebarState.value = 'openEnd'), animationDuration)
  } else {
    // 如果侧边栏关闭，保存当前大小到旧值
    sideBarSize.value.old = sideBarSize.value.current
    // 将当前大小设置为0
    sideBarSize.value.current = 0

    // 设置侧边栏状态为开始隐藏
    sidebarState.value = 'hiddenStart'

    // 动画结束后设置侧边栏状态为完全隐藏
    setTimeout(() => {
      sidebarState.value = 'hiddenEnd'
    }, animationDuration)
  }
})

// 处理鼠标移动事件的函数
function handleMouseMove(e: MouseEvent) {
  // 如果是移动模式，不处理
  if (isMobileMode.value) return
  // 如果侧边栏包装器引用不存在，不处理
  if (!wrapperRef.value) return
  // 如果侧边栏状态为完全打开，不处理
  if (sidebarState.value === 'openEnd') return

  // 如果鼠标位于屏幕最左侧且侧边栏处于隐藏状态
  if (e.clientX < 4 && ['hiddenEnd', 'peekCloseEnd'].includes(sidebarState.value)) {
    // 设置侧边栏状态为开始预览打开
    sidebarState.value = 'peekOpenStart'

    // 动画结束后设置侧边栏状态为预览打开结束
    setTimeout(() => {
      sidebarState.value = 'peekOpenEnd'
    }, animationDuration)
    // 如果鼠标移出侧边栏区域且侧边栏处于预览打开状态
  } else if (e.clientX > sidebarWidth.value + 10 && sidebarState.value === 'peekOpenEnd') {
    // 设置侧边栏状态为预览关闭开始
    sidebarState.value = 'peekCloseOpen'

    // 动画结束后设置侧边栏状态为预览关闭结束
    setTimeout(() => {
      sidebarState.value = 'peekCloseEnd'
    }, animationDuration)
  }
}

// 窗口大小调整处理函数
function onWindowResize(e?: any): void {
  // 更新视口宽度
  viewportWidth.value = window.innerWidth

  // 如果用户隐藏侧边栏并刷新页面，则侧边栏将再次可见，需要设置侧边栏宽度
  if (!e && isLeftSidebarOpen.value && !sideBarSize.value.current && !isMobileMode.value) {
    currentSidebarSize.value = sideBarSize.value.old
  }

  // 更新左侧边栏宽度百分比
  leftSidebarWidthPercent.value = (currentSidebarSize.value / viewportWidth.value) * 100

  // 如果侧边栏宽度大于标准化宽度且此函数是从窗口调整大小事件调用的（不是从模板调用的），则更新左侧边栏宽度
  if (e && normalizedWidth.value < sidebarWidth.value) {
    onResize(leftSidebarWidthPercent.value)
  }
}

// 组件挂载时
onMounted(() => {
  // 添加鼠标移动事件监听器
  document.addEventListener('mousemove', handleMouseMove)
  // 添加窗口大小调整事件监听器
  window.addEventListener('resize', onWindowResize)
})

// 组件卸载前
onBeforeUnmount(() => {
  // 移除鼠标移动事件监听器
  document.removeEventListener('mousemove', handleMouseMove)
  // 移除窗口大小调整事件监听器
  window.removeEventListener('resize', onWindowResize)
})

// 监听路由变化
watch(route, () => {
  // 如果当前路由是首页，打开侧边栏
  if (route.value.name === 'index-index') {
    isLeftSidebarOpen.value = true
  }
})

// 监听移动模式状态变化
watch(isMobileMode, () => {
  // 如果不是移动模式，打开侧边栏；如果是移动模式，关闭侧边栏
  isLeftSidebarOpen.value = !isMobileMode.value
})

// 监听侧边栏状态变化
watch(sidebarState, () => {
  // 如果侧边栏状态为预览关闭结束
  if (sidebarState.value === 'peekCloseEnd') {
    // 动画结束后设置侧边栏状态为完全隐藏
    setTimeout(() => {
      sidebarState.value = 'hiddenEnd'
    }, animationDuration)
  }
})

// 组件挂载时
onMounted(() => {
  // 处理移动设备上非视图页面的侧边栏打开
  handleSidebarOpenOnMobileForNonViews()
})

// 调整大小处理函数
function onResize(widthPercent: any) {
  // 如果是移动模式，不处理
  if (isMobileMode.value) return

  // 计算像素宽度
  const width = (widthPercent * viewportWidth.value) / 100

  // 获取根元素的字体大小
  const fontSize = parseFloat(getComputedStyle(document.documentElement).fontSize)

  // 如果视口宽度小于等于1560px，侧边栏最大宽度应为20rem
  if (viewportWidth.value <= 1560) {
    if (width > remToPx(20)) {
      // 设置旧侧边栏大小为20rem
      sideBarSize.value.old = 20 * fontSize
      // 如果侧边栏打开，更新当前大小
      if (isLeftSidebarOpen.value) sideBarSize.value.current = sideBarSize.value.old
      return
    }
  }

  // 计算宽度的rem值
  const widthRem = width / fontSize

  // 如果宽度小于16rem
  if (widthRem < 16) {
    // 设置旧侧边栏大小为16rem
    sideBarSize.value.old = 16 * fontSize
    // 如果侧边栏打开，更新当前大小
    if (isLeftSidebarOpen.value) sideBarSize.value.current = sideBarSize.value.old
    return
    // 如果宽度大于35rem
  } else if (widthRem > 35) {
    // 设置旧侧边栏大小为35rem
    sideBarSize.value.old = 35 * fontSize
    // 如果侧边栏打开，更新当前大小
    if (isLeftSidebarOpen.value) sideBarSize.value.current = sideBarSize.value.old

    return
  }

  // 设置旧侧边栏大小为当前宽度
  sideBarSize.value.old = width
  // 更新当前侧边栏大小
  sideBarSize.value.current = sideBarSize.value.old
}
</script>

<template>
  <!-- 分割面板容器，用于实现可调整大小的侧边栏和内容区域 -->
  <Splitpanes
    class="nc-sidebar-content-resizable-wrapper !w-screen h-full"
    :class="{
      'hide-resize-bar': !isLeftSidebarOpen || sidebarState === 'openStart',
    }"
    @ready="() => onWindowResize()"
    @resize="(event: any) => onResize(event[0].size)"
  >
    <!-- 侧边栏面板 -->
    <Pane
      min-size="15%"
      :size="mobileNormalizedSidebarSize"
      max-size="60%"
      class="nc-sidebar-splitpane !sm:max-w-140 relative !overflow-visible flex"
      :style="{
        'width': `${mobileNormalizedSidebarSize}%`,
        'min-width': `${mobileNormalizedSidebarSize}%`,
      }"
    >
      <!-- 侧边栏包装器 -->
      <div
        ref="wrapperRef"
        class="nc-sidebar-wrapper relative flex flex-col h-full justify-center !sm:(max-w-140) absolute overflow-visible"
        :class="{
          'mobile': isMobileMode,
          'minimized-height': !isLeftSidebarOpen,
          'hide-sidebar': ['hiddenStart', 'hiddenEnd', 'peekCloseEnd'].includes(sidebarState),
        }"
        :style="{
          width: sidebarState === 'hiddenEnd' ? '0px' : `${sidebarWidth}px`,
          minWidth: sidebarState === 'hiddenEnd' ? '0px' : `${normalizedWidth}px`,
        }"
      >
        <!-- 侧边栏内容插槽 -->
        <slot name="sidebar" />
      </div>
    </Pane>
    <!-- 内容区域面板 -->
    <Pane
      :size="mobileNormalizedContentSize"
      class="flex-grow"
      :style="{
        'min-width': `${mobileNormalizedContentSize}%`,
      }"
    >
      <!-- 内容插槽 -->
      <slot name="content" />
    </Pane>
  </Splitpanes>
</template>

<style lang="scss">
/* 当侧边栏最小化时，其子元素的样式 */
.nc-sidebar-wrapper.minimized-height > * {
  @apply h-4/5 pb-2 !(rounded-r-lg border-1 border-gray-200 shadow-lg);
  width: calc(100% + 4px);
}

/* 移动模式下最小化侧边栏的子元素样式 */
.mobile.nc-sidebar-wrapper.minimized-height > * {
  @apply !h-full;
}

/* 侧边栏包装器的子元素样式 */
.nc-sidebar-wrapper > * {
  transition: all 0.2s ease-in-out;
  @apply z-10 absolute;
}

/* 隐藏侧边栏时的样式 */
.nc-sidebar-wrapper.hide-sidebar {
  @apply !min-w-0;

  > * {
    @apply opacity-0;
    z-index: -1 !important;
    transform: translateX(-100%);
  }
}

/** 分割面板CSS */

/* 分割面板分隔线的样式 */
.nc-sidebar-content-resizable-wrapper > {
  .splitpanes__splitter {
    @apply !w-0 relative overflow-visible;
  }
  .splitpanes__splitter:before {
    @apply bg-gray-200 w-0.25 absolute left-0 top-0 h-full z-40;
    content: '';
  }

  /* 鼠标悬停在分隔线上时的样式 */
  .splitpanes__splitter:hover:before {
    @apply bg-scrollbar;
    width: 3px !important;
    left: 0px;
  }

  /* 拖动分隔线时的样式 */
  .splitpanes--dragging .splitpanes__splitter:before {
    @apply bg-scrollbar;
    width: 3px !important;
    left: 0px;
  }

  /* 拖动分隔线时的样式 */
  .splitpanes--dragging .splitpanes__splitter {
    @apply w-1 mr-0;
  }
}

/* 隐藏调整大小栏时的样式 */
.nc-sidebar-content-resizable-wrapper.hide-resize-bar > {
  .splitpanes__splitter {
    cursor: default !important;
    opacity: 0 !important;
    background-color: transparent !important;
  }
}

/* 分割面板的过渡效果 */
.splitpanes__pane {
  transition: width 0.15s ease-in-out !important;
}

/* 拖动时的样式 */
.splitpanes--dragging {
  cursor: col-resize;

  > .splitpanes__pane {
    transition: none !important;
  }
}
</style>
