<script lang="ts" setup>
// 从全局状态中解构获取用户登录状态、加载状态、用户信息、当前版本和应用信息等
const { signOut, signedIn, isLoading, user, currentVersion, appInfo } = useGlobal()

// 使用侧边栏组件，设置ID为'nc-left-sidebar'，初始状态为不显示侧边栏
useSidebar('nc-left-sidebar', { hasSidebar: false })

// 获取当前路由对象
const route = useRoute()

// 从beta特性切换钩子中获取特性启用状态检查函数
const { isFeatureEnabled } = useBetaFeatureToggle()

// 计算属性：获取用户邮箱，如果不存在则显示'---'
const email = computed(() => user.value?.email ?? '---')

// 创建响应式变量，用于控制侧边栏是否显示
const hasSider = ref(false)

// 创建侧边栏DOM引用
const sidebar = ref<HTMLDivElement>()

// 登出函数：调用全局登出方法并重定向到登录页
const logout = async () => {
  await signOut({
    redirectToSignin: true,
  })
}

// 获取Nuxt应用实例中的钩子
const { hooks } = useNuxtApp()

// 计算属性：判断当前是否在仪表盘页面，通过检查路由参数中是否有typeOrId
const isDashboard = computed(() => !!route.params.typeOrId)

// 当页面加载完成后，检查侧边栏元素是否被传送到布局中
/** when page suspensions have finished, check if a sidebar element was teleported into the layout */
hooks.hook('page:finish', () => {
  // 如果侧边栏DOM引用存在
  if (sidebar.value) {
    // 通过检查子元素数量来判断侧边栏是否有内容，并更新显示状态
    hasSider.value = sidebar.value?.children.length > 0
  }
})
</script>

<template>
  <!-- 应用主布局容器，设置ID和类名，指定有侧边栏 -->
  <a-layout id="nc-app" class="nc-app" has-sider>
    <!-- 侧边栏过渡动画 -->
    <Transition name="slide">
      <!-- 侧边栏容器，根据hasSider状态显示或隐藏，并绑定ref引用 -->
      <div v-show="hasSider" id="nc-sidebar-left" ref="sidebar" />
    </Transition>

    <!-- 主内容区布局，设置为垂直方向排列并占满屏幕高度 -->
    <a-layout class="!flex-col h-screen">
      <!-- 
        顶部导航栏，在以下条件下显示：
        1. 不是公共页面
        2. 用户已登录
        3. 路由元数据中未设置隐藏头部
      -->
      <a-layout-header v-if="!route.meta.public && signedIn && !route.meta.hideHeader" class="nc-navbar">
        <!-- 
          品牌图标区域，在非baseType页面显示
          添加事件跟踪标记和测试ID
          设置样式和点击事件导航到首页
        -->
        <div
          v-if="!route.params.baseType"
          v-e="['c:navbar:home']"
          data-testid="nc-noco-brand-icon"
          class="transition-all duration-200 p-2 cursor-pointer transform hover:scale-105 nc-noco-brand-icon"
          @click="navigateTo('/')"
        >
          <!-- 显示版本信息的工具提示 -->
          <a-tooltip placement="bottom">
            <template #title>
              {{ currentVersion }}
            </template>
            <!-- 品牌图标容器 -->
            <div class="flex items-center gap-2">
              <!-- 根据是否在仪表盘页面显示不同大小的图标 -->
              <img v-if="!isDashboard" width="120" alt="NocoDB" src="~/assets/img/brand/nocodb-full.png" />
              <img v-else width="25" alt="NocoDB" src="~/assets/img/icons/256x256.png" />
            </div>
          </a-tooltip>
        </div>

        <!-- 加载状态显示区域 -->
        <div class="!text-white flex justify-center">
          <!-- 当正在加载时显示加载提示和旋转图标 -->
          <div v-show="isLoading" class="flex items-center gap-2 ml-3" data-testid="nc-loading">
            {{ $t('general.loading') }}

            <!-- 使用动态组件显示加载图标，并在加载时添加旋转动画 -->
            <component :is="iconMap.reload" :class="{ 'animate-infinite animate-spin': isLoading }" />
          </div>
        </div>

        <!-- 弹性空间，将后续元素推到右侧 -->
        <div class="flex-1" />

        <!-- 懒加载发布信息组件 -->
        <LazyGeneralReleaseInfo />

        <!-- 语言切换工具提示 -->
        <a-tooltip placement="bottom" :mouse-enter-delay="1" class="mr-4">
          <template #title>{{ $t('title.switchLanguage') }}</template>

          <!-- 语言切换按钮容器 -->
          <div class="flex items-center">
            <!-- 懒加载语言切换组件 -->
            <LazyGeneralLanguage class="cursor-pointer text-2xl hover:text-accent" />
          </div>
        </a-tooltip>

        <!-- 用户登录后显示的用户菜单 -->
        <template v-if="signedIn">
          <!-- 下拉菜单组件，点击触发 -->
          <a-dropdown :trigger="['click']" overlay-class-name="nc-dropdown-user-accounts-menu">
            <!-- 三点垂直菜单图标 -->
            <component
              :is="iconMap.threeDotVertical"
              data-testid="nc-menu-accounts"
              class="md:text-xl cursor-pointer hover:text-accent nc-menu-accounts"
              @click.prevent
            />

            <!-- 下拉菜单内容 -->
            <template #overlay>
              <a-menu class="!py-0 leading-8 !rounded">
                <!-- 用户设置菜单项 -->
                <a-menu-item key="0" data-testid="nc-menu-accounts__user-settings" class="!rounded-t">
                  <!-- 账户页面链接 -->
                  <nuxt-link v-e="['c:navbar:user:email']" class="nc-base-menu-item group !no-underline" to="/account/users">
                    <!-- 用户图标 -->
                    <component :is="iconMap.accountCircle" class="mt-1 group-hover:text-accent" />&nbsp;
                    <!-- 用户信息显示 -->
                    <div class="prose group-hover:text-primary">
                      <div>Account</div>
                      <div class="text-xs text-gray-500">{{ email }}</div>
                    </div>
                  </nuxt-link>
                </a-menu-item>

                <!-- 
                  注释掉的管理员菜单项
                <a-menu-divider class="!m-0" />
                <a-menu-item v-if="isUIAllowed('superAdminAppStore')" key="0" class="!rounded-t">
                  <nuxt-link
                    v-e="['c:settings:appstore', { page: true }]"
                    class="nc-base-menu-item group !no-underline"
                    to="/admin/users"
                  >
                    <MdiShieldAccountOutline class="mt-1 group-hover:text-accent" />&nbsp;
                    <span class="prose group-hover:text-primary">{{ $t('title.accountManagement') }}</span>
                  </nuxt-link>
                </a-menu-item>

                <a-menu-divider class="!m-0" /> 
                -->

                <!-- 登出菜单项 -->
                <a-menu-item key="1" class="!rounded-b group" data-testid="nc-menu-accounts__sign-out">
                  <!-- 登出按钮 -->
                  <div v-e="['a:navbar:user:sign-out']" class="nc-base-menu-item group" @click="logout">
                    <!-- 登出图标 -->
                    <component :is="iconMap.signout" class="group-hover:text-accent" />&nbsp;

                    <!-- 登出文本 -->
                    <span class="prose group-hover:text-primary">
                      {{ $t('general.signOut') }}
                    </span>
                  </div>
                </a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>
        </template>
      </a-layout-header>

      <!-- 
        未登录状态下的语言切换按钮工具提示
        显示条件：非企业版或语言特性已启用或是本地部署版本
      -->
      <a-tooltip v-if="!appInfo.ee || isFeatureEnabled(FEATURE_FLAG.LANGUAGE) || appInfo.isOnPrem" placement="bottom">
        <template #title>{{ $t('title.switchLanguage') }}</template>

        <!-- 
          未登录状态下的语言切换按钮
          显示条件：未登录且不在特定页面
        -->
        <LazyGeneralLanguage v-if="!signedIn && !route.params.baseId && !route.params.erdUuid" class="nc-lang-btn" />
      </a-tooltip>

      <!-- 主内容区域容器 -->
      <div class="w-full h-full overflow-hidden nc-layout-base-inner">
        <!-- 插槽用于渲染页面内容 -->
        <slot />
      </div>
    </a-layout>
  </a-layout>
</template>

<style lang="scss">
// 语言切换按钮样式
.nc-lang-btn {
  // 应用多个样式：颜色过渡、弹性布局、固定定位等
  @apply color-transition flex items-center justify-center fixed bottom-10 right-10 z-99 w-12 h-12 rounded-full shadow-md shadow-gray-500 p-2 !bg-primary text-white ring-opacity-100 active:(ring ring-accent) hover:(ring ring-accent);

  // 伪元素样式，创建背景效果
  &::after {
    // 应用圆角、绝对定位和过渡效果
    @apply rounded-full absolute top-0 left-0 right-0 bottom-0 transition-all duration-150 ease-in-out bg-primary;
    // 设置内容为空
    content: '';
    // 设置层级
    z-index: -1;
  }

  // 悬停时伪元素样式
  &:hover::after {
    // 应用变换和环形效果
    @apply transform scale-110 ring ring-accent ring-opacity-100;
  }

  // 激活时伪元素样式
  &:active::after {
    // 应用环形效果
    @apply ring ring-accent ring-opacity-100;
  }
}

// 导航栏样式
.nc-navbar {
  // 应用弹性布局、白色背景和内边距
  @apply flex !bg-white items-center !pl-2 !pr-5;
}

// 内部布局容器样式
.nc-layout-base-inner > div {
  // 应用满高度
  @apply h-full;
}
</style>
