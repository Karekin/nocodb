<script setup lang="ts">
// 导入NocoDB SDK中的BaseType和TableType类型定义
import type { BaseType, TableType } from 'nocodb-sdk'
// 导入Pinia的storeToRefs函数，用于从store中提取响应式属性
import { storeToRefs } from 'pinia'
// 导入Sortable库，用于实现拖拽排序功能
import Sortable from 'sortablejs'
// 导入TableNode组件，用于渲染表格节点
import TableNode from './TableNode.vue'

// 定义组件属性并设置默认值
const props = withDefaults(
  defineProps<{
    // 基础/项目对象
    base: BaseType
    // 数据源索引
    sourceIndex?: number
  }>(),
  {
    // 默认使用第一个数据源（索引为0）
    sourceIndex: 0,
  },
)

// 将base属性转换为响应式引用
const base = toRef(props, 'base')
// 将sourceIndex属性转换为响应式引用
const sourceIndex = toRef(props, 'sourceIndex')

// 计算当前使用的数据源
const source = computed(() => base.value?.sources?.[sourceIndex.value])

// 从全局状态中获取是否为移动模式
const { isMobileMode } = useGlobal()

// 从角色工具中获取权限检查函数
const { isUIAllowed } = useRoles()

// 从表格存储中获取基础表格映射
const { baseTables } = storeToRefs(useTablesStore())
// 计算当前基础/项目的所有表格
const tables = computed(() => baseTables.value.get(base.value.id!) ?? [])

// 获取API实例
const { $api } = useNuxtApp()

// 创建表格ID到表格对象的映射，方便通过ID快速查找表格
const tablesById = computed(() =>
  tables.value.reduce<Record<string, TableType>>((acc, table) => {
    // 将表格添加到累加器对象中，以ID为键
    acc[table.id!] = table

    return acc
  }, {}),
)

// 用于强制重新渲染列表的键值映射
const keys = ref<Record<string, number>>({})

// 菜单引用，用于获取DOM元素以初始化拖拽功能
const menuRefs = ref<HTMLElement[] | HTMLElement>()

// 存储每个数据源的Sortable实例
const sortables: Record<string, Sortable> = {}

// todo: replace with vuedraggable
// 初始化拖拽排序功能
const initSortable = (el: Element) => {
  // 获取元素上的数据源ID属性
  const source_id = el.getAttribute('nc-source')
  // 如果没有数据源ID，则退出
  if (!source_id) return
  // 如果是移动模式，则退出（移动设备上不启用拖拽）
  if (isMobileMode.value) return

  // 如果该数据源已经初始化过Sortable，则先销毁它
  if (sortables[source_id]) sortables[source_id].destroy()
  // 创建新的Sortable实例
  Sortable.create(el as HTMLLIElement, {
    // 拖拽结束时的回调函数
    onEnd: async (evt) => {
      // 计算表格在数组中的偏移量
      const offset = tables.value.findIndex((table) => table.source_id === source_id)

      // 获取新旧索引位置
      const { newIndex = 0, oldIndex = 0 } = evt

      // 如果位置没有变化，则不做任何处理
      if (newIndex === oldIndex) return

      // 获取被拖拽的元素
      const itemEl = evt.item as HTMLLIElement
      // 通过元素的data-id属性获取对应的表格对象
      const item = tablesById.value[itemEl.dataset.id as string]

      // 获取所有列表项的HTML集合
      const children: HTMLCollection = evt.to.children

      // 如果只有一个子元素，则跳过（无需排序）
      if (children.length < 2) return

      // 获取被移动项前后的元素
      const itemBeforeEl = children[newIndex - 1] as HTMLLIElement
      const itemAfterEl = children[newIndex + 1] as HTMLLIElement

      // 获取被移动项前后元素对应的表格对象
      const itemBefore = itemBeforeEl && tablesById.value[itemBeforeEl.dataset.id as string]
      const itemAfter = itemAfterEl && tablesById.value[itemAfterEl.dataset.id as string]

      // 根据新位置计算表格的order值
      if (children.length - 1 === evt.newIndex) {
        // 如果移动到最后，则order值为前一项的order值加1
        item.order = (itemBefore.order as number) + 1
      } else if (newIndex === 0) {
        // 如果移动到最前，则order值为后一项的order值除以2
        item.order = (itemAfter.order as number) / 2
      } else {
        // 如果移动到中间位置，则order值为前后两项order值的平均值
        item.order = ((itemBefore.order as number) + (itemAfter.order as number)) / 2
      }

      // 更新表格数组中的顺序
      tables.value?.splice(newIndex + offset, 0, ...tables.value?.splice(oldIndex + offset, 1))

      // 强制重新渲染列表
      if (keys.value[source_id]) {
        // 如果已有键值，则递增
        keys.value[source_id] = keys.value[source_id] + 1
      } else {
        // 否则初始化为1
        keys.value[source_id] = 1
      }

      // 调用API更新表格的order值
      await $api.dbTable.reorder(item.id as string, {
        order: item.order,
      })
    },
    // 设置动画持续时间（毫秒）
    animation: 150,
    // 设置拖拽时的数据传输
    setData(dataTransfer, dragEl) {
      // 将表格信息序列化为JSON字符串
      dataTransfer.setData(
        'text/json',
        JSON.stringify({
          id: dragEl.dataset.id,
          title: dragEl.dataset.title,
          type: dragEl.dataset.type,
          sourceId: dragEl.dataset.sourceId,
        }),
      )
    },
    // 拖拽取消时恢复原位
    revertOnSpill: true,
    // 过滤触摸事件
    filter: isTouchEvent,
  })
}

// 监视menuRefs的变化，当其值变化且用户有权限时初始化拖拽功能
watchEffect(() => {
  if (menuRefs.value && isUIAllowed('viewCreateOrEdit')) {
    if (menuRefs.value instanceof HTMLElement) {
      // 如果是单个元素，直接初始化
      initSortable(menuRefs.value)
    } else {
      // 如果是元素数组，则遍历初始化
      menuRefs.value.forEach((el) => initSortable(el))
    }
  }
})

// 计算当前数据源下可用的表格
const availableTables = computed(() => {
  // 过滤出source_id与当前数据源ID匹配的表格
  return tables.value.filter((table) => table.source_id === base.value?.sources?.[sourceIndex.value].id)
})
</script>

<template>
  <!-- 无边框的可排序列表容器 -->
  <div class="border-none sortable-list">
    <!-- 当base存在时渲染内容 -->
    <template v-if="base">
      <!-- 当没有可用表格时显示空提示 -->
      <div
        v-if="availableTables.length === 0"
        class="py-0.5 text-gray-500"
        :class="{
          'ml-8.5': sourceIndex === 0,
          'ml-14.5 xs:(ml-15.25)': sourceIndex !== 0,
        }"
      >
        {{ $t('general.empty') }}
      </div>
      <!-- 当数据源启用时渲染表格列表 -->
      <div
        v-if="base.sources?.[sourceIndex] && base!.sources[sourceIndex].enabled"
        ref="menuRefs"
        :key="`sortable-${source?.id}-${source?.id && source?.id in keys ? keys[source?.id] : '0'}`"
        :nc-source="source?.id"
      >
        <!-- 遍历可用表格并渲染TableNode组件 -->
        <TableNode
          v-for="table of availableTables"
          :key="table.id"
          class="nc-tree-item text-sm"
          :data-order="table.order"
          :data-id="table.id"
          :table="table"
          :base="base"
          :source-index="sourceIndex"
          :data-title="table.title"
          :data-source-id="source?.id"
          :data-type="table.type"
        >
        </TableNode>
      </div>
    </template>
  </div>
</template>
