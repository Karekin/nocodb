<script setup lang="ts">
// 从全局状态中获取应用信息、礼品横幅关闭次数和用户信息
const { appInfo, giftBannerDismissedCount, user } = useGlobal()

// 从Nuxt应用实例中获取事件跟踪函数
const { $e } = useNuxtApp()

// 定义横幅是否关闭的响应式状态，初始值为true
const isBannerClosed = ref(true)
// 定义确认对话框是否显示的响应式状态，初始值为false
const confirmDialog = ref(false)
// 根据窗口高度决定是否隐藏图片，当窗口高度小于780像素时隐藏
const hideImage = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0) < 780

// 计算属性：判断礼品横幅是否可用
const isAvailable = computed(() => {
  return (
    // 非企业版UI
    !isEeUI &&
    // 用户有邮箱
    user.value?.email &&
    // 用户邮箱不是常见的个人邮箱域名
    !/^[a-zA-Z0-9._%+-]+@(gmail|yahoo|hotmail|outlook|aol|icloud|qq|163|126|sina|nocodb)(\.com)?$/i.test(user.value?.email) &&
    // 横幅关闭次数小于5次
    (!giftBannerDismissedCount.value || giftBannerDismissedCount.value < 5)
  )
})

// 如果用户之前关闭过横幅
if (giftBannerDismissedCount.value) {
  // 设置定时器，根据关闭次数延迟显示横幅（每次关闭增加1分钟延迟）
  setTimeout(() => {
    isBannerClosed.value = false
  }, giftBannerDismissedCount.value * 60000)
} else {
  // 如果用户从未关闭过横幅，直接显示
  isBannerClosed.value = false
}

// 打开礼品链接的函数
const open = () => {
  // 增加横幅关闭次数
  giftBannerDismissedCount.value++
  // 触发事件跟踪
  $e('a:claim:gift:coupon')
  // 在新标签页中打开礼品URL
  window.open(appInfo.value?.giftUrl, '_blank', 'noopener,noreferrer')
}

// 关闭横幅的函数
const closeBanner = () => {
  // 如果关闭次数小于4次，显示确认对话框
  if (!giftBannerDismissedCount.value || giftBannerDismissedCount.value < 4) {
    confirmDialog.value = true
  } else {
    // 否则直接关闭横幅并增加关闭次数
    isBannerClosed.value = true
    giftBannerDismissedCount.value++
  }
}

// "不再显示"按钮的处理函数
const dontShowAgain = () => {
  // 关闭横幅
  isBannerClosed.value = true
  // 将关闭次数设为5，表示达到最大关闭次数
  giftBannerDismissedCount.value = 5
  // 关闭确认对话框
  confirmDialog.value = false
}

// "是"按钮的处理函数，表示稍后再提醒
const closeAndShowAgain = () => {
  // 关闭横幅
  isBannerClosed.value = true
  // 增加关闭次数
  giftBannerDismissedCount.value++
  // 关闭确认对话框
  confirmDialog.value = false
}
</script>

<template>
  <!-- 礼品横幅容器，仅在满足条件时显示 -->
  <div v-if="isAvailable && !isBannerClosed && appInfo.giftUrl" class="container" @click="open">
    <!-- 横幅内容包装器 -->
    <div class="wrapper">
      <!-- 横幅标题区域 -->
      <div class="header">
        <!-- 礼品图标 -->
        <GeneralIcon class="icon" icon="gift" size="xlarge" />
        <!-- 标题文本 -->
        <h4>Gifts Unlocked!</h4>
      </div>
      <!-- 横幅正文内容 -->
      <div class="body">We are giving away $25 worth of amazon coupons to our pro open source users!</div>
    </div>
    <!-- 礼品卡图片区域，仅在窗口高度足够且用户首次看到时显示 -->
    <div v-if="!hideImage && !giftBannerDismissedCount" class="img-wrapper">
      <!-- 礼品卡图片 -->
      <img src="~assets/img/giftCard.svg" />
    </div>

    <!-- 关闭按钮 -->
    <NcButton type="text" size="small" class="close-icon" @click.stop="closeBanner">
      <!-- 关闭图标 -->
      <GeneralIcon icon="close" size="xlarge" />
    </NcButton>
    <!-- 确认对话框 -->
    <NcModal v-model:visible="confirmDialog" size="small">
      <div>
        <!-- 确认对话框提示文本 -->
        <div class="mt-1 text-sm">Do you want to remind later on your next visit?</div>
        <!-- 确认对话框按钮区域 -->
        <div class="flex justify-end mt-7 gap-x-2">
          <!-- "不再显示"按钮 -->
          <NcButton type="secondary" size="small" @click="dontShowAgain"> Don't show again </NcButton>
          <!-- "是"按钮 -->
          <NcButton type="primary" size="small" @click="closeAndShowAgain"> Yes </NcButton>
        </div>
      </div>
    </NcModal>
  </div>
</template>

<style scoped lang="scss">
// 容器样式
.container {
  @apply relative bg-white hover:(shadow-default bg-gray-50) overflow-hidden cursor-pointer rounded-lg;
  // 内容包装器样式
  .wrapper {
    @apply p-3;

    // 标题区域样式
    .header {
      @apply flex items-center gap-3 mb-2;
      // 图标样式
      .icon {
        @apply -mt-1;
      }

      // 标题文本样式
      h4 {
        @apply text-lg mb-0 font-weight-bold;
      }
    }

    // 正文内容样式
    .body {
      @apply text-gray-600;
    }
  }

  // 图片包装器样式
  .img-wrapper {
    @apply flex justify-center items-center bg-maroon-50 py-5 px-2 w-full;
    // 图片样式
    img {
      @apply !max-w-[170px];
    }
  }

  // 关闭图标样式
  .close-icon {
    @apply absolute top-3 right-3;
  }
}
</style>
