<!-- 使用Vue 3的<script setup>语法，并指定TypeScript -->
<script setup lang="ts">
// 导入错误边界组件，用于捕获和处理组件树中的JavaScript错误
import ErrorBoundary from './components/nc/ErrorBoundary.vue'
// 导入命令面板类型定义
import type { CommandPaletteType } from '~/lib/types'

// 获取路由器实例
const router = useRouter()

// 获取当前路由
const route = router.currentRoute

// 创建一个响应式变量，用于控制命令K面板的显示状态
const cmdK = ref(false)

// 创建一个响应式变量，用于控制命令L面板的显示状态
const cmdL = ref(false)

// 计算属性，用于确定是否禁用基本布局
// 当路径以'/nc/view'或'/nc/form'开头时禁用基本布局
const disableBaseLayout = computed(() => route.value.path.startsWith('/nc/view') || route.value.path.startsWith('/nc/form'))

// 使用主题钩子，应用主题设置
useTheme()

// 从命令面板钩子中解构获取相关功能和状态
const { commandPalette, cmdData, cmdPlaceholder, activeScope, loadTemporaryScope } = useCommandPalette()

// 应用不可选择性，防止用户选择某些元素
applyNonSelectable()
// 添加全局键盘事件监听器
useEventListener(document, 'keydown', async (e: KeyboardEvent) => {
  // 根据操作系统确定命令键（Mac使用meta键，其他系统使用ctrl键）
  const cmdOrCtrl = isMac() ? e.metaKey : e.ctrlKey
  // 当命令键被按下时
  if (cmdOrCtrl) {
    // 根据按下的键执行不同操作
    switch (e.key.toLowerCase()) {
      case 'a':
        // 防止在非可编辑节点上使用Ctrl + A全选
        if (!['input', 'textarea'].includes((e.target as any).nodeName.toLowerCase())) {
          e.preventDefault()
        }
        break
      case 'k':
        // 阻止默认行为
        e.preventDefault()
        break
      case 'l':
        // 阻止默认行为
        e.preventDefault()
        break
      case 'j':
        // 阻止默认行为
        e.preventDefault()
        break
    }
  }
})

// TODO: 当 https://github.com/vuejs/core/issues/5513 修复后移除
// 创建一个响应式变量，用于强制重新渲染组件
const key = ref(0)

// 定义可能出现的错误消息数组
const messages = [
  `Uncaught NotFoundError: Failed to execute 'insertBefore' on 'Node': The node before which the new node is to be inserted is not a child of this node.`, // 基于Chromium的浏览器
  `NotFoundError: The object can not be found here.`, // Safari浏览器
  "Cannot read properties of null (reading 'parentNode')",
]

// 仅在浏览器环境中执行
if (typeof window !== 'undefined') {
  // @ts-expect-error 使用任意window键
  // 检查是否已经初始化过
  if (!window.__ncvue) {
    // 添加全局错误事件监听器
    window.addEventListener('error', (event) => {
      // 如果错误消息在预定义的消息列表中
      if (messages.includes(event.message)) {
        // 阻止默认错误处理
        event.preventDefault()
        // 输出警告信息
        console.warn('Re-rendering layout because of https://github.com/vuejs/core/issues/5513')
        // 增加key值，强制重新渲染
        key.value++
      }
    })
  }

  // @ts-expect-error 使用任意window键
  // 标记已初始化
  window.__ncvue = true
}

// 处理作用域变化的函数
function onScope(scope: string) {
  // 如果作用域是'root'且启用了企业版UI
  if (scope === 'root' && isEeUI) {
    // 加载临时作用域
    loadTemporaryScope({ scope: 'root', data: {} })
  }
}

// 设置活动命令视图的函数
function setActiveCmdView(cmd: CommandPaletteType) {
  // 如果命令是'cmd-k'
  if (cmd === 'cmd-k') {
    // 显示命令K面板，隐藏命令L面板
    cmdK.value = true
    cmdL.value = false
    // 如果命令是'cmd-l'
  } else if (cmd === 'cmd-l') {
    // 显示命令L面板，隐藏命令K面板
    cmdL.value = true
    cmdK.value = false
    // 其他命令
  } else {
    // 隐藏所有命令面板
    cmdL.value = false
    cmdK.value = false
    // 触发键盘事件J
    document.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'J',
        // 根据操作系统设置ctrl或meta键
        ctrlKey: !isMac() || undefined,
        metaKey: isMac() || undefined,
      }),
    )
  }
}

// 参考: https://github.com/vuejs/vue-cli/issues/7431#issuecomment-1793385162
// 防止ResizeObserver错误
// 定义防抖函数
const debounce = (callback: (...args: any[]) => void, delay: number) => {
  // 定义定时器ID
  let tid: any
  // 返回防抖处理后的函数
  return function (...args: any[]) {
    // 保存上下文
    const ctx = self
    // 如果定时器存在，清除它
    tid && clearTimeout(tid)
    // 设置新的定时器
    tid = setTimeout(() => {
      // 在延迟后调用原始回调函数
      callback.apply(ctx, args)
    }, delay)
  }
}

// 保存原始的ResizeObserver
const _ = (window as any).ResizeObserver
// 重新定义ResizeObserver类
;(window as any).ResizeObserver = class ResizeObserver extends _ {
  // 构造函数
  constructor(callback: (...args: any[]) => void) {
    // 对回调函数应用防抖处理
    callback = debounce(callback, 20)
    // 调用父类构造函数
    super(callback)
  }
}
</script>

<!-- 模板部分 -->
<template>
  <!-- Ant Design配置提供者 -->
  <a-config-provider>
    <!-- 使用Nuxt布局，根据disableBaseLayout决定是否使用基本布局 -->
    <NuxtLayout :name="disableBaseLayout ? false : 'base'">
      <!-- 错误边界组件，用于捕获子组件中的错误 -->
      <ErrorBoundary>
        <!-- Nuxt页面组件，使用key强制重新渲染，禁用过渡效果 -->
        <NuxtPage :key="key" :transition="false" />
      </ErrorBoundary>
    </NuxtLayout>
  </a-config-provider>

  <!-- 错误边界组件，用于捕获命令面板相关错误 -->
  <ErrorBoundary>
    <div>
      <!-- 命令菜单 -->
      <CmdK
        ref="commandPalette"
        v-model:open="cmdK"
        :scope="activeScope.scope"
        :data="cmdData"
        :placeholder="cmdPlaceholder"
        :load-temporary-scope="loadTemporaryScope"
        :set-active-cmd-view="setActiveCmdView"
        @scope="onScope"
      />
      <!-- 最近视图。循环浏览最近访问的视图 -->
      <CmdL v-model:open="cmdL" :set-active-cmd-view="setActiveCmdView" />
      <!-- 文档。直接在产品内集成NocoDB文档 -->
      <CmdJ />
    </div>
  </ErrorBoundary>
</template>
