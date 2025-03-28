<!-- 项目移动对话框组件 -->
<script setup lang="ts">
// 导入 BaseType 类型定义
import type { BaseType } from 'nocodb-sdk'
// 导入工作区用户角色枚举
import { WorkspaceUserRoles } from 'nocodb-sdk'

// 定义组件属性
const props = defineProps<{
  // 控制对话框显示状态的布尔值
  modelValue: boolean
  // 要移动的项目基础信息
  base: BaseType
}>()

// 定义组件事件
const emit = defineEmits(['update:modelValue', 'success'])

// 创建双向绑定的对话框显示状态变量
const dialogShow = useVModel(props, 'modelValue', emit)

// 获取工作区存储
const workspaceStore = useWorkspace()
// 从工作区存储中解构获取移动工作区的方法
const { moveWorkspace } = workspaceStore
// 从工作区存储中获取工作区列表的响应式引用
const { workspacesList } = storeToRefs(workspaceStore)

// 定义目标工作区ID的响应式变量
const workspaceId = ref()

// 移动工作区的方法
const _moveWorkspace = async () => {
  // 调用工作区存储中的移动方法，将项目移动到选定的工作区
  await moveWorkspace(workspaceId.value, props.base.id!)
  // 移动成功后触发成功事件，并传递目标工作区ID
  emit('success', workspaceId.value)
}

// 监听对话框显示状态的变化
watch(dialogShow, (val) => {
  // 当对话框关闭时
  if (!val) {
    // 重置工作区ID
    workspaceId.value = null
  }
})

// 计算属性：获取用户拥有的工作区列表
const ownedWorkspaces = computed(() => {
  // 过滤出用户角色为OWNER的工作区
  return workspacesList.value.filter((w) => w.roles === WorkspaceUserRoles.OWNER)
})
</script>

<!-- 组件模板 -->
<template>
  <!-- Ant Design 模态对话框 -->
  <a-modal
    v-model:visible="dialogShow"
    :class="{ active: dialogShow }"
    width="max(30vw, 600px)"
    centered
    wrap-class-name="nc-modal-workspace-create"
    @keydown.esc="dialogShow = false"
  >
    <!-- 对话框底部按钮区域 -->
    <template #footer>
      <!-- 取消按钮 -->
      <a-button key="back" size="large" @click="dialogShow = false">{{ $t('general.cancel') }}</a-button>

      <!-- 移动按钮，当未选择工作区时禁用 -->
      <a-button key="submit" :disabled="!workspaceId" size="large" type="primary" @click="_moveWorkspace">{{
        $t('general.move')
      }}</a-button>
    </template>

    <!-- 对话框内容区域 -->
    <div class="pl-10 pr-10 pt-5">
      <!-- 标题 -->
      <div class="prose-xl font-bold self-center my-4">{{ $t('activity.moveProject') }}</div>

      <!-- 工作区选择标签 -->
      <div class="mb-2">{{ $t('objects.workspace') }}</div>
      <!-- 工作区选择下拉框，支持搜索 -->
      <a-select v-model:value="workspaceId" class="w-full" show-search>
        <!-- 为每个拥有的工作区创建选项 -->
        <a-select-option v-for="workspace of ownedWorkspaces" :key="workspace.id" :value="workspace.id">
          {{ workspace.title }}
        </a-select-option>
      </a-select>
    </div>
  </a-modal>
</template>

<!-- 组件样式 -->
<style scoped lang="scss">
// 工作区高级选项的样式
.nc-workspace-advanced-options {
  // 初始状态下高度为0
  max-height: 0;
  // 高度变化的过渡效果
  transition: 0.3s max-height;
  // 隐藏溢出内容
  overflow: hidden;

  // 激活状态下的样式
  &.active {
    // 激活时的最大高度
    max-height: 200px;
  }
}
</style>
