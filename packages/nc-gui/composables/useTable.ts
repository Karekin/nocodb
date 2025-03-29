// 导入类型定义：ColumnType(列类型)、LinkToAnotherRecordType(关联记录类型)、TableType(表类型)
import type { ColumnType, LinkToAnotherRecordType, TableType } from 'nocodb-sdk'

// 导入工具方法和枚举：UITypes(UI类型枚举)、isLinksOrLTAR(判断是否为关联列)、isSystemColumn(判断是否为系统列)
import { UITypes, isLinksOrLTAR, isSystemColumn } from 'nocodb-sdk'

// 导入工具方法：generateUniqueTitle(生成唯一标题)
import { generateUniqueTitle as generateTitle } from '#imports'

// 定义并导出useTable组合式函数
// 参数：onTableCreate - 表创建后的回调函数，可选；sourceId - 数据源ID，可选
export function useTable(onTableCreate?: (tableMeta: TableType) => void, sourceId?: string) {
  // 定义响应式表对象，包含标题、表名和列数组
  const table = reactive<{ title: string; table_name: string; columns: string[] }>({
    title: '',
    table_name: '',
    columns: SYSTEM_COLUMNS, // 初始列设置为系统列
  })

  // 使用国际化hook获取翻译函数
  const { t } = useI18n()

  // 使用Nuxt应用上下文，获取事件总线和API实例
  const { $e, $api } = useNuxtApp()

  // 使用元数据hook，获取获取和移除元数据的方法
  const { getMeta, removeMeta } = useMetas()

  // 使用标签页hook，获取关闭标签页的方法
  const { closeTab } = useTabs()

  // 使用基础存储hook
  const baseStore = useBase()
  // 从基础存储中解构加载表方法和检查是否为XCDB基础的方法
  const { loadTables, isXcdbBase } = baseStore
  // 从基础存储的响应式引用中解构SQL UI、基础信息和表列表
  const { sqlUis, base, tables } = storeToRefs(baseStore)

  // 使用命令面板hook，获取刷新命令面板的方法
  const { refreshCommandPalette } = useCommandPalette()

  // 使用NocoEE扩展hook，获取创建表和创建模式的魔法方法
  const { createTableMagic: _createTableMagic, createSchemaMagic: _createSchemaMagic } = useNocoEe()

  // 计算属性：获取当前数据源对应的SQL UI，如果没有指定数据源则获取第一个
  const sqlUi = computed(() => (sourceId && sqlUis.value[sourceId] ? sqlUis.value[sourceId] : Object.values(sqlUis.value)[0]))

  // 创建表的异步方法，可选参数baseId用于指定基础ID
  const createTable = async (baseId?: string) => {
    // 如果没有指定数据源ID，则使用基础信息中的第一个数据源ID
    if (!sourceId) {
      sourceId = base.value.sources?.[0].id
    }

    // 如果没有SQL UI则直接返回
    if (!sqlUi?.value) return

    // 获取新表的列并过滤，只保留表对象中指定的列
    const columns = sqlUi?.value?.getNewTableColumns().filter((col: ColumnType) => {
      // 特殊处理ID列，如果包含id_ag则使用AG类型
      if (col.column_name === 'id' && table.columns.includes('id_ag')) {
        Object.assign(col, sqlUi?.value?.getDataTypeForUiType({ uidt: UITypes.ID }, 'AG'))
        col.dtxp = sqlUi?.value?.getDefaultLengthForDatatype(col.dt)
        col.dtxs = sqlUi?.value?.getDefaultScaleForDatatype(col.dt)
        return true
      }
      return table.columns.includes(col.column_name!)
    })

    try {
      // 调用API创建表
      const tableMeta = await $api.source.tableCreate(
        baseId ?? (base?.value?.id as string), // 使用传入的baseId或基础ID
        (sourceId || base?.value?.sources?.[0].id)!, // 使用当前sourceId或第一个数据源ID
        {
          ...table, // 展开表对象
          columns, // 添加过滤后的列
        },
      )
      // 触发表创建事件
      $e('a:table:create')
      // 如果有表创建回调则调用
      onTableCreate?.(tableMeta)
      // 刷新命令面板
      refreshCommandPalette()
    } catch (e: any) {
      // 捕获并显示错误信息
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  // 创建表的魔法方法
  const createTableMagic = async () => {
    // 如果没有SQL UI或数据源ID则直接返回
    if (!sqlUi?.value || !sourceId) return

    // 调用扩展的创建表魔法方法
    await _createTableMagic(base, sourceId, table, onTableCreate)
  }

  // 创建模式的魔法方法
  const createSchemaMagic = async () => {
    // 如果没有SQL UI或数据源ID则直接返回
    if (!sqlUi?.value || !sourceId) return

    // 调用扩展的创建模式魔法方法并返回结果
    return await _createSchemaMagic(base, sourceId, table, onTableCreate)
  }

  // 创建SQL视图的异步方法
  const createSqlView = async (sql: string) => {
    // 如果没有SQL UI则直接返回
    if (!sqlUi?.value) return
    // 如果SQL为空或只有空白字符则直接返回
    if (!sql || sql.trim() === '') return

    try {
      // 调用API创建SQL视图
      const tableMeta = await $api.source.createSqlView(base?.value?.id as string, sourceId as string, {
        view_name: table.table_name, // 使用表对象中的表名作为视图名
        view_definition: sql, // 传入的SQL作为视图定义
      })

      // 如果有表创建回调则调用
      onTableCreate?.(tableMeta as TableType)
      // 刷新命令面板
      refreshCommandPalette()
    } catch (e: any) {
      // 捕获并显示警告信息
      message.warning(e)
    }
  }

  // 监听表标题的变化，自动更新表名
  watch(
    () => table.title,
    (title) => {
      table.table_name = `${title}`
    },
  )

  // 生成唯一标题的方法
  const generateUniqueTitle = () => {
    // 使用工具方法生成唯一标题，前缀为'Sheet'，基于现有表列表，比较'title'字段
    table.title = generateTitle('Sheet', tables.value, 'title')
  }

  // 删除表的异步方法
  const deleteTable = (table: TableType) => {
    // 触发表删除事件
    $e('c:table:delete')
    // 显示确认对话框
    Modal.confirm({
      title: `${t('msg.info.deleteTableConfirmation')} : ${table.title}?`, // 国际化确认消息
      wrapClassName: 'nc-modal-table-delete', // 对话框包裹类名
      okText: t('general.yes'), // 确定按钮文本
      okType: 'danger', // 确定按钮类型为危险
      cancelText: t('general.no'), // 取消按钮文本
      width: 450, // 对话框宽度
      // 确定按钮回调
      async onOk() {
        try {
          // 获取表的元数据
          const meta = (await getMeta(table.id as string, true)) as TableType
          // 过滤出关联列（非系统列）
          const relationColumns = meta?.columns?.filter((c) => isLinksOrLTAR(c) && !isSystemColumn(c))

          // 检查表是否有关联列（XCDB源除外）
          if (relationColumns?.length && !isXcdbBase(table.source_id)) {
            // 生成关联列信息消息
            const refColMsgs = await Promise.all(
              relationColumns.map(async (c, i) => {
                const refMeta = (await getMeta(
                  (c?.colOptions as LinkToAnotherRecordType)?.fk_related_model_id as string,
                )) as TableType
                return `${i + 1}. ${c.title} is a LinkToAnotherRecord of ${(refMeta && refMeta.title) || c.title}`
              }),
            )
            // 显示无法删除的消息
            message.info(
              h('div', {
                innerHTML: `<div style="padding:10px 4px">Unable to delete tables because of the following.
              <br><br>${refColMsgs.join('<br>')}<br><br>
              Delete them & try again</div>`,
              }),
            )
            return
          }

          // 调用API删除表
          await $api.dbTable.delete(table?.id as string)

          // 关闭对应的标签页
          await closeTab({
            type: TabType.TABLE, // 标签页类型为表
            id: table.id, // 表ID
            title: table.title, // 表标题
          })

          // 重新加载表列表
          await loadTables()

          // 移除表的元数据
          removeMeta(table.id as string)
          // 刷新命令面板
          refreshCommandPalette()
          // 显示表删除成功消息
          message.info(t('msg.info.tableDeleted'))
          // 触发表删除成功事件
          $e('a:table:delete')
        } catch (e: any) {
          // 捕获并显示错误信息
          message.error(await extractSdkResponseErrorMsg(e))
        }
      },
    })
  }

  // 返回暴露给组件的方法和属性
  return {
    table, // 响应式表对象
    createTable, // 创建表方法
    createTableMagic, // 创建表魔法方法
    createSchemaMagic, // 创建模式魔法方法
    createSqlView, // 创建SQL视图方法
    generateUniqueTitle, // 生成唯一标题方法
    tables, // 表列表引用
    base, // 基础信息引用
    deleteTable, // 删除表方法
  }
}
