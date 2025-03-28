<script lang="ts" setup>
// 导入Vue运行时核心的ComponentPublicInstance类型
import type { ComponentPublicInstance } from '@vue/runtime-core'
// 导入Ant Design Vue的Form和SelectProps类型
import type { Form as AntForm, SelectProps } from 'ant-design-vue'
// 导入nocodb-sdk中的各种类型定义
import {
  type CalendarType,
  type ColumnType,
  type FormType,
  FormulaDataTypes,
  type GalleryType,
  type GridType,
  type KanbanType,
  type LookupType,
  type MapType,
  type SerializedAiViewType,
  type TableType,
  stringToViewTypeMap,
  viewTypeToStringMap,
} from 'nocodb-sdk'
// 导入nocodb-sdk中的UITypes和ViewTypes枚举
import { UITypes, ViewTypes } from 'nocodb-sdk'
// 导入AI向导标签类型
import { AiWizardTabsType } from '#imports'

// 定义组件属性并设置默认值
const props = withDefaults(defineProps<Props>(), {
  selectedViewId: undefined,
  groupingFieldColumnId: undefined,
  geoDataFieldColumnId: undefined,
  calendarRange: undefined,
  coverImageColumnId: undefined,
})

// 定义组件事件
const emits = defineEmits<Emits>()

// 设置最大选择数量为100
const maxSelectionCount = 100

// 定义Props接口，描述组件接收的属性
interface Props {
  modelValue: boolean
  type: ViewTypes | 'AI'
  baseId: string
  tableId: string
  title?: string
  selectedViewId?: string
  groupingFieldColumnId?: string
  geoDataFieldColumnId?: string
  description?: string
  calendarRange?: Array<{
    fk_from_column_id: string
    fk_to_column_id: string | null // 仅用于企业版
  }>
  coverImageColumnId?: string
}

// 定义Emits接口，描述组件可以触发的事件
interface Emits {
  // 更新modelValue事件
  (event: 'update:modelValue', value: boolean): void
  // 创建视图成功后触发的事件
  (event: 'created', value: GridType | KanbanType | GalleryType | FormType | MapType | CalendarType): void
}

// 定义表单接口，描述表单数据结构
interface Form {
  title: string
  type: ViewTypes | 'AI'
  description?: string
  copy_from_id: string | null
  // 仅用于看板视图
  fk_grp_col_id: string | null
  fk_geo_data_col_id: string | null

  // 仅用于日历视图
  calendar_range: Array<{
    fk_from_column_id: string
    fk_to_column_id: string | null // 仅用于企业版
  }>
  fk_cover_image_col_id: string | null | undefined
}

// 定义AI建议视图类型，扩展自SerializedAiViewType
type AiSuggestedViewType = SerializedAiViewType & {
  selected?: boolean
  tab?: AiWizardTabsType
}

// 获取Nuxt应用实例中的$e方法（用于事件跟踪）
const { $e } = useNuxtApp()

// 使用useMetas钩子获取元数据相关功能
const { metas, getMeta } = useMetas()

// 获取工作区存储
const workspaceStore = useWorkspace()

// 从视图存储中获取按表分组的视图
const { viewsByTable } = storeToRefs(useViewsStore())

// 获取刷新命令面板的方法
const { refreshCommandPalette } = useCommandPalette()

// 获取特性开关检查方法
const { isFeatureEnabled } = useBetaFeatureToggle()

// 将props中的相关属性转换为响应式引用
const { selectedViewId, groupingFieldColumnId, geoDataFieldColumnId, tableId, coverImageColumnId, baseId } = toRefs(props)

// 创建表元数据的响应式引用
const meta = ref<TableType | undefined>()

// 创建输入元素的引用
const inputEl = ref<ComponentPublicInstance>()

// 创建AI提示输入框的引用
const aiPromptInputRef = ref<HTMLElement>()

// 创建描述输入元素的引用
const descriptionInputEl = ref<ComponentPublicInstance>()

// 创建表单验证器的引用
const formValidator = ref<typeof AntForm>()

// 创建双向绑定的modelValue
const vModel = useVModel(props, 'modelValue', emits)

// 获取国际化函数
const { t } = useI18n()

// 获取API实例
const { api } = useApi()

// 创建视图创建状态的响应式引用
const isViewCreating = ref(false)

// 计算属性：获取当前表的所有视图
const views = computed(() => viewsByTable.value.get(tableId.value) ?? [])

// 创建必要列是否存在的响应式引用
const isNecessaryColumnsPresent = ref(true)

// 定义不同视图类型的错误消息
const errorMessages = {
  [ViewTypes.KANBAN]: t('msg.warning.kanbanNoFields'),
  [ViewTypes.MAP]: t('msg.warning.mapNoFields'),
  [ViewTypes.CALENDAR]: t('msg.warning.calendarNoFields'),
}

// 创建响应式表单对象
const form = reactive<Form>({
  title: props.title || '',
  type: props.type,
  copy_from_id: null,
  fk_grp_col_id: null,
  fk_geo_data_col_id: null,
  calendar_range: props.calendarRange || [],
  fk_cover_image_col_id: undefined,
  description: props.description || '',
})

// 创建视图选择字段选项的响应式引用
const viewSelectFieldOptions = ref<SelectProps['options']>([])

// 定义视图名称验证规则
const viewNameRules = [
  // 名称是必填的
  { required: true, message: `${t('labels.viewName')} ${t('general.required').toLowerCase()}` },
  // 名称必须唯一
  {
    validator: (_: unknown, v: string) =>
      new Promise((resolve, reject) => {
        views.value.every((v1) => v1.title !== v) ? resolve(true) : reject(new Error(`View name should be unique`))
      }),
    message: 'View name should be unique',
  },
]

// 定义分组字段列验证规则
const groupingFieldColumnRules = [{ required: true, message: `${t('general.groupingField')} ${t('general.required')}` }]

// 定义地理数据字段列验证规则
const geoDataFieldColumnRules = [{ required: true, message: `${t('general.geoDataField')} ${t('general.required')}` }]

// 计算属性：获取视图类型别名
const typeAlias = computed(
  () =>
    ({
      [ViewTypes.GRID]: 'grid',
      [ViewTypes.GALLERY]: 'gallery',
      [ViewTypes.FORM]: 'form',
      [ViewTypes.KANBAN]: 'kanban',
      [ViewTypes.MAP]: 'map',
      [ViewTypes.CALENDAR]: 'calendar',
      // 待办：添加AI视图文档路由
      AI: '',
    }[props.type]),
)

// 使用NocoAI钩子获取AI相关功能
const { aiIntegrationAvailable, aiLoading, aiError, predictViews: _predictViews, createViews } = useNocoAi()

// 创建AI模式状态的响应式引用
const aiMode = ref(false)

// 定义AI步骤枚举
enum AiStep {
  init = 'init',
  pick = 'pick',
}

// 创建AI模式步骤的响应式引用
const aiModeStep = ref<AiStep | null>(null)

// 计算属性：判断是否为AI视图创建模式
const isAIViewCreateMode = computed(() => props.type === 'AI')

// 创建已调用函数名称的响应式引用
const calledFunction = ref<string>()

// 创建提示文本的响应式引用
const prompt = ref<string>('')

// 创建旧提示文本的响应式引用
const oldPrompt = ref<string>('')

// 创建提示是否已生成的响应式引用
const isPromtAlreadyGenerated = ref<boolean>(false)

// 创建活动AI标签的本地响应式引用
const activeAiTabLocal = ref<AiWizardTabsType>(AiWizardTabsType.AUTO_SUGGESTIONS)

// 计算属性：判断AI是否正在保存
const isAiSaving = computed(() => aiLoading.value && calledFunction.value === 'createViews')

// 计算属性：活动AI标签
const activeAiTab = computed({
  get: () => {
    return activeAiTabLocal.value
  },
  set: (value: AiWizardTabsType) => {
    activeAiTabLocal.value = value

    aiError.value = ''

    if (value === AiWizardTabsType.PROMPT) {
      nextTick(() => {
        aiPromptInputRef.value?.focus()
      })
    }

    if (aiMode.value) {
      $e(`c:view:ai:tab-change:${value}`)
    }
  },
})

// 创建预测视图的响应式引用
const predictedViews = ref<AiSuggestedViewType[]>([])

// 计算属性：获取活动标签的预测视图
const activeTabPredictedViews = computed(() => predictedViews.value.filter((t) => t.tab === activeAiTab.value))

// 创建预测历史的响应式引用
const predictHistory = ref<AiSuggestedViewType[]>([])

// 计算属性：获取活动标签的预测历史
const activeTabPredictHistory = computed(() => predictHistory.value.filter((t) => t.tab === activeAiTab.value))

// 计算属性：获取活动标签的已选视图
const activeTabSelectedViews = computed(() => {
  return predictedViews.value.filter((v) => !!v.selected && v.tab === activeAiTab.value)
})

// 在组件挂载前初始化
onBeforeMount(init)

// 监听props.type的变化
watch(
  () => props.type,
  (newType) => {
    form.type = newType
  },
)

// AI确认按钮点击处理函数
const onAiEnter = async () => {
  calledFunction.value = 'createViews'

  $e('a:view:ai:create')

  if (activeTabSelectedViews.value.length) {
    try {
      const data = await createViews(activeTabSelectedViews.value, baseId.value)

      emits('created', ncIsArray(data) && data.length ? data[0] : undefined)
    } catch (e) {
      message.error(e)
    } finally {
      await refreshCommandPalette()
    }

    vModel.value = false
  }
}

// 获取默认视图元数据
const getDefaultViewMetas = (viewType: ViewTypes) => {
  switch (viewType) {
    case ViewTypes.FORM:
      return {
        submit_another_form: false,
        show_blank_form: false,
        meta: {
          hide_branding: false,
          background_color: '#F9F9FA',
          hide_banner: false,
        },
      }
  }
  return {}
}

// 表单提交处理函数
async function onSubmit() {
  if (aiMode.value) {
    return onAiEnter()
  }

  let isValid = null

  try {
    isValid = await formValidator.value?.validateFields()
  } catch (e) {
    console.error(e)
  }

  if (form.title) {
    form.title = form.title.trim()
  }

  if (isValid && form.type) {
    if (!tableId.value) return

    try {
      let data: GridType | KanbanType | GalleryType | FormType | MapType | null = null

      isViewCreating.value = true

      switch (form.type) {
        case ViewTypes.GRID:
          data = await api.dbView.gridCreate(tableId.value, form)
          break
        case ViewTypes.GALLERY:
          data = await api.dbView.galleryCreate(tableId.value, form)
          break
        case ViewTypes.FORM:
          data = await api.dbView.formCreate(tableId.value, {
            ...form,
            ...getDefaultViewMetas(ViewTypes.FORM),
          })
          break
        case ViewTypes.KANBAN:
          data = await api.dbView.kanbanCreate(tableId.value, form)
          break
        case ViewTypes.MAP:
          data = await api.dbView.mapCreate(tableId.value, form)
          break
        case ViewTypes.CALENDAR:
          data = await api.dbView.calendarCreate(tableId.value, {
            ...form,
            calendar_range: form.calendar_range.map((range) => ({
              fk_from_column_id: range.fk_from_column_id,
              fk_to_column_id: range.fk_to_column_id,
            })),
          })
          break
      }

      if (data) {
        // 视图创建成功
        // message.success(t('msg.toast.createView'))

        emits('created', data)
      }
    } catch (e: any) {
      message.error(e.message)
    } finally {
      await refreshCommandPalette()
    }

    vModel.value = false

    setTimeout(() => {
      isViewCreating.value = false
    }, 500)
  }
}

/*
// 添加日历范围的函数
const addCalendarRange = async () => {
  form.calendar_range.push({
    fk_from_column_id: viewSelectFieldOptions.value[0].value as string,
    fk_to_column_id: null,
  })
}
*/

// 计算属性：判断范围功能是否启用
const isRangeEnabled = computed(() => isFeatureEnabled(FEATURE_FLAG.CALENDAR_VIEW_RANGE))

// 创建启用描述的响应式引用
const enableDescription = ref(false)

// 移除描述的处理函数
const removeDescription = () => {
  form.description = ''
  enableDescription.value = false
}

// 切换描述显示状态的处理函数
const toggleDescription = () => {
  if (enableDescription.value) {
    enableDescription.value = false
  } else {
    enableDescription.value = true
    setTimeout(() => {
      descriptionInputEl.value?.focus()
    }, 100)
  }
}

// 创建元数据加载状态的响应式引用
const isMetaLoading = ref(false)

// 组件挂载后执行
onMounted(async () => {
  if (form.copy_from_id) {
    enableDescription.value = true
  }

  if (
    [ViewTypes.GALLERY, ViewTypes.KANBAN, ViewTypes.MAP, ViewTypes.CALENDAR].includes(props.type) ||
    aiIntegrationAvailable.value
  ) {
    isMetaLoading.value = true
    try {
      meta.value = (await getMeta(tableId.value))!

      if (props.type === ViewTypes.MAP) {
        viewSelectFieldOptions.value = meta
          .value!.columns!.filter((el) => el.uidt === UITypes.GeoData)
          .map((field) => {
            return {
              value: field.id,
              label: field.title,
            }
          })

        if (geoDataFieldColumnId.value) {
          // 使用复制视图中的值
          form.fk_geo_data_col_id = geoDataFieldColumnId.value
        } else if (viewSelectFieldOptions.value?.length) {
          // 如果有地理数据列，选择第一个选项
          form.fk_geo_data_col_id = viewSelectFieldOptions.value?.[0]?.value as string
        } else {
          // 如果没有地理数据列，禁用创建按钮
          isNecessaryColumnsPresent.value = false
        }
      }

      // 预设封面图片字段
      if (props.type === ViewTypes.GALLERY) {
        viewSelectFieldOptions.value = [
          { value: null, label: t('labels.noImage') },
          ...(meta.value.columns || [])
            .filter((el) => el.uidt === UITypes.Attachment)
            .map((field) => {
              return {
                value: field.id,
                label: field.title,
                uidt: field.uidt,
              }
            }),
        ]
        const lookupColumns = (meta.value.columns || [])?.filter((c) => c.uidt === UITypes.Lookup)

        const attLookupColumnIds: Set<string> = new Set()

        const loadLookupMeta = async (originalCol: ColumnType, column: ColumnType, metaId?: string): Promise<void> => {
          const relationColumn =
            metaId || meta.value?.id
              ? metas.value[metaId || meta.value?.id]?.columns?.find(
                  (c: ColumnType) => c.id === (column?.colOptions as LookupType)?.fk_relation_column_id,
                )
              : undefined

          if (relationColumn?.colOptions?.fk_related_model_id) {
            await getMeta(relationColumn.colOptions.fk_related_model_id!)

            const lookupColumn = metas.value[relationColumn.colOptions.fk_related_model_id]?.columns?.find(
              (c: any) => c.id === (column?.colOptions as LookupType)?.fk_lookup_column_id,
            ) as ColumnType | undefined

            if (lookupColumn && isAttachment(lookupColumn)) {
              attLookupColumnIds.add(originalCol.id)
            } else if (lookupColumn && lookupColumn?.uidt === UITypes.Lookup) {
              await loadLookupMeta(originalCol, lookupColumn, relationColumn.colOptions.fk_related_model_id)
            }
          }
        }

        await Promise.allSettled(lookupColumns.map((col) => loadLookupMeta(col, col)))

        const lookupAttColumns = lookupColumns
          .filter((column) => attLookupColumnIds.has(column?.id))
          .map((c) => {
            return {
              value: c.id,
              label: c.title,
              uidt: c.uidt,
            }
          })

        viewSelectFieldOptions.value = [...viewSelectFieldOptions.value, ...lookupAttColumns]

        if (coverImageColumnId.value) {
          form.fk_cover_image_col_id = coverImageColumnId.value
        } else if (viewSelectFieldOptions.value.length > 1 && !form.copy_from_id) {
          form.fk_cover_image_col_id = viewSelectFieldOptions.value[1].value as string
        } else {
          form.fk_cover_image_col_id = undefined
        }
      }

      // 预设分组字段列
      if (props.type === ViewTypes.KANBAN) {
        viewSelectFieldOptions.value = meta.value
          .columns!.filter((el) => el.uidt === UITypes.SingleSelect)
          .map((field) => {
            return {
              value: field.id,
              label: field.title,
              uidt: field.uidt,
            }
          })

        if (groupingFieldColumnId.value) {
          // 使用复制视图中的值
          form.fk_grp_col_id = groupingFieldColumnId.value
        } else if (viewSelectFieldOptions.value?.length) {
          // 选择第一个选项
          form.fk_grp_col_id = viewSelectFieldOptions.value[0].value as string
        } else {
          // 如果没有分组字段列，禁用创建按钮
          isNecessaryColumnsPresent.value = false
        }

        if (coverImageColumnId.value) {
          form.fk_cover_image_col_id = coverImageColumnId.value
        } else if (viewSelectFieldOptions.value.length > 1 && !form.copy_from_id) {
          form.fk_cover_image_col_id = viewSelectFieldOptions.value[1].value as string
        } else {
          form.fk_cover_image_col_id = undefined
        }
      }

      if (props.type === ViewTypes.CALENDAR) {
        viewSelectFieldOptions.value = meta
          .value!.columns!.filter(
            (el) =>
              [UITypes.DateTime, UITypes.Date, UITypes.CreatedTime, UITypes.LastModifiedTime].includes(el.uidt) ||
              (el.uidt === UITypes.Formula && (el.colOptions as any)?.parsed_tree?.dataType === FormulaDataTypes.DATE),
          )
          .map((field) => {
            return {
              value: field.id,
              label: field.title,
              uidt: field.uidt,
            }
          })
          .sort((a, b) => {
            const priority = {
              [UITypes.DateTime]: 1,
              [UITypes.Date]: 2,
              [UITypes.Formula]: 3,
              [UITypes.CreatedTime]: 4,
              [UITypes.LastModifiedTime]: 5,
            }

            return (priority[a.uidt] || 6) - (priority[b.uidt] || 6)
          })

        if (viewSelectFieldOptions.value?.length) {
          // 选择第一个选项
          if (form.calendar_range.length === 0) {
            form.calendar_range = [
              {
                fk_from_column_id: viewSelectFieldOptions.value[0].value as string,
                fk_to_column_id: null, // 仅用于企业版
              },
            ]
          }
        } else {
          // 如果没有分组字段列，禁用创建按钮
          isNecessaryColumnsPresent.value = false
        }
      }
    } catch (e) {
      console.error(e)
    } finally {
      isMetaLoading.value = false
    }
  }
})

// 判断日历是否为只读
const isCalendarReadonly = (calendarRange?: Array<{ fk_from_column_id: string; fk_to_column_id: string | null }>) => {
  if (!calendarRange) return false
  return calendarRange.some((range) => {
    const column = viewSelectFieldOptions.value?.find((c) => c.value === range?.fk_from_column_id)
    return !column || ![UITypes.DateTime, UITypes.Date].includes(column.uidt)
  })
}

// 计算属性：判断是否禁用
const isDisabled = computed(() => {
  return (
    [UITypes.DateTime, UITypes.CreatedTime, UITypes.LastModifiedTime, UITypes.Formula].includes(
      viewSelectFieldOptions.value.find((f) => f.value === form.calendar_range[0]?.fk_from_column_id)?.uidt,
    ) && !isRangeEnabled.value
  )
})

// 值变更处理函数
const onValueChange = async () => {
  form.calendar_range = form.calendar_range.map((range, i) => {
    if (i === 0) {
      return {
        fk_from_column_id: range.fk_from_column_id,
        fk_to_column_id: null,
      }
    }
    return range
  })
}

// 预测视图函数
const predictViews = async (): Promise<AiSuggestedViewType[]> => {
  const viewType =
    !isAIViewCreateMode.value && form.type && viewTypeToStringMap[form.type] ? viewTypeToStringMap[form.type] : undefined

  return (
    await _predictViews(
      tableId.value,
      activeTabPredictHistory.value,
      baseId.value,
      activeAiTab.value === AiWizardTabsType.PROMPT ? prompt.value : undefined,
      viewType,
    )
  )
    .filter((v: AiSuggestedViewType) => !ncIsArrayIncludes(activeTabPredictedViews.value, v.title, 'title'))
    .map((v: AiSuggestedViewType) => {
      return {
        ...v,
        tab: activeAiTab.value,
        selected: false,
      }
    })
}

// 预测更多视图
const predictMore = async () => {
  calledFunction.value = 'predictMore'

  const predictions = await predictViews()

  if (predictions.length) {
    predictedViews.value.push(...predictions)
    predictHistory.value.push(...predictions)
  } else if (!aiError.value) {
    message.info(`No more auto suggestions were found for ${meta.value?.title || 'the current table'}`)
  }
}

// 刷新预测
const predictRefresh = async () => {
  calledFunction.value = 'predictRefresh'

  const predictions = await predictViews()

  if (predictions.length) {
    predictedViews.value = [...predictedViews.value.filter((t) => t.tab !== activeAiTab.value), ...predictions]
    predictHistory.value.push(...predictions)
  } else if (!aiError.value) {
    message.info(`No auto suggestions were found for ${meta.value?.title || 'the current table'}`)
  }
  aiModeStep.value = AiStep.pick
}

// 根据提示预测视图
const predictFromPrompt = async () => {
  calledFunction.value = 'predictFromPrompt'

  const predictions = await predictViews()

  if (predictions.length) {
    predictedViews.value = [...predictedViews.value.filter((t) => t.tab !== activeAiTab.value), ...predictions]
    predictHistory.value.push(...predictions)
    oldPrompt.value = prompt.value
  } else if (!aiError.value) {
    message.info('No suggestions were found with the given prompt. Try again after modifying the prompt.')
  }

  aiModeStep.value = AiStep.pick
  isPromtAlreadyGenerated.value = true
}

// 切换标签选择状态
const onToggleTag = (view: AiSuggestedViewType) => {
  if (
    isAiSaving.value ||
    (!view.selected &&
      (activeTabSelectedViews.value.length >= maxSelectionCount ||
        ncIsArrayIncludes(activeTabSelectedViews.value, view.title, 'title')))
  ) {
    return
  }

  predictedViews.value = predictedViews.value.map((v) => {
    if (v.title === view.title && v.tab === activeAiTab.value) {
      v.selected = !view.selected
    }
    return v
  })
}

// 全选处理函数
const onSelectAll = () => {
  if (activeTabSelectedViews.value.length >= maxSelectionCount) return

  let count = activeTabSelectedViews.value.length

  predictedViews.value = predictedViews.value.map((view) => {
    // 检查项目是否可以被选择
    if (view.tab === activeAiTab.value && !view.selected && count < maxSelectionCount) {
      view.selected = true
      count++
    }
    return view
  })
}

// 切换到AI模式
const toggleAiMode = async (from = false) => {
  if (aiMode.value) return

  if (from) {
    $e('c:view:ai:toggle:true')
  }

  formValidator.value?.clearValidate()
  aiError.value = ''

  aiMode.value = true
  aiModeStep.value = AiStep.init
  predictedViews.value = []
  predictHistory.value = []
  prompt.value = ''
  oldPrompt.value = ''
  isPromtAlreadyGenerated.value = false

  if (aiIntegrationAvailable.value) {
    await predictRefresh()
  }
}

// 禁用AI模式
const disableAiMode = () => {
  if (isAIViewCreateMode.value) return

  $e('c:view:ai:toggle:false')

  aiMode.value = false
  aiModeStep.value = null
  predictedViews.value = []
  predictHistory.value = []
  prompt.value = ''
  oldPrompt.value = ''
  isPromtAlreadyGenerated.value = false
  activeAiTab.value = AiWizardTabsType.AUTO_SUGGESTIONS

  nextTick(() => {
    inputEl.value?.focus()
    inputEl.value?.select()
  })
}

// 全自动处理函数
const fullAuto = async (e) => {
  const target = e.target as HTMLElement
  if (
    !aiIntegrationAvailable.value ||
    !isNecessaryColumnsPresent.value ||
    aiLoading.value ||
    aiError.value ||
    target.closest('button, input, .nc-button, textarea')
  ) {
    return
  }

  if (!aiModeStep.value) {
    await toggleAiMode(true)
  } else if (aiModeStep.value === AiStep.pick && activeTabSelectedViews.value.length === 0) {
    await onSelectAll()
  } else if (aiModeStep.value === AiStep.pick && activeTabSelectedViews.value.length > 0) {
    await onAiEnter()
  }
}

// 计算属性：判断是否正在从提示预测
const isPredictFromPromptLoading = computed(() => {
  return aiLoading.value && calledFunction.value === 'predictFromPrompt'
})

// 处理导航到集成页面的函数
const handleNavigateToIntegrations = () => {
  vModel.value = false

  workspaceStore.navigateToIntegrations(undefined, undefined, {
    categories: 'ai',
  })
}

// 处理错误时刷新的函数
const handleRefreshOnError = () => {
  switch (calledFunction.value) {
    case 'predictMore':
      return predictMore()
    case 'predictRefresh':
      return predictRefresh()
    case 'predictFromPrompt':
      return predictFromPrompt()

    default:
  }
}

// 组件挂载前初始化
onBeforeMount(init)

// 监听props.type的变化
watch(
  () => props.type,
  (newType) => {
    form.type = newType
  },
)

// 初始化函数
function init() {
  if (props.type === 'AI') {
    toggleAiMode()
  } else {
    form.title = t(`objects.viewType.${typeAlias.value}`)

    if (selectedViewId.value) {
      form.copy_from_id = selectedViewId?.value
      const selectedViewName = views.value.find((v) => v.id === selectedViewId.value)?.title || form.title

      form.title = generateUniqueTitle(`${selectedViewName} copy`, views.value, 'title', '_', true)
    } else {
      const repeatCount = views.value.filter((v) => v.title.startsWith(form.title)).length

      if (repeatCount) {
        form.title = `${form.title}-${repeatCount}`
      }
    }

    nextTick(() => {
      const el = inputEl.value?.$el as HTMLInputElement

      if (el) {
        el.focus()
        el.select()
      }
    })
  }
}

// 获取复数名称的函数
const getPluralName = (name: string) => {
  if (aiMode.value) {
    return `${name}Plural`
  }
  return name
}
</script>

<template>
  <!-- 模态对话框组件 -->
  <NcModal
    v-model:visible="vModel"
    class="nc-view-create-modal !top-[25vh]"
    :show-separator="false"
    size="xs"
    height="auto"
    :centered="false"
    nc-modal-class-name="!p-0"
    wrap-class-name="nc-modal-view-create-wrapper"
  >
    <!-- 主要内容区域 -->
    <div class="py-5 flex flex-col gap-5" @dblclick.stop="fullAuto">
      <!-- 标题区域 -->
      <div class="px-5 flex w-full flex-row justify-between items-center">
        <div class="flex font-bold text-base gap-x-3 items-center">
          <!-- AI视图创建模式图标 -->
          <GeneralIcon v-if="isAIViewCreateMode" icon="ncAutoAwesome" class="text-nc-content-purple-dark h-6 w-6" />
          <!-- 普通视图图标 -->
          <GeneralViewIcon v-else :meta="{ type: form.type }" class="nc-view-icon !text-[24px] !leading-6 max-h-6 max-w-6" />
          <!-- 网格视图标题 -->
          <template v-if="form.type === ViewTypes.GRID">
            <template v-if="form.copy_from_id">
              {{ $t('labels.duplicateGridView') }}
            </template>
            <template v-else>
              {{ $t(`labels.${getPluralName('createGridView')}`) }}
            </template>
          </template>
          <!-- 画廊视图标题 -->
          <template v-else-if="form.type === ViewTypes.GALLERY">
            <template v-if="form.copy_from_id">
              {{ $t('labels.duplicateGalleryView') }}
            </template>
            <template v-else>
              {{ $t(`labels.${getPluralName('createGalleryView')}`) }}
            </template>
          </template>
          <!-- 表单视图标题 -->
          <template v-else-if="form.type === ViewTypes.FORM">
            <template v-if="form.copy_from_id">
              {{ $t('labels.duplicateFormView') }}
            </template>
            <template v-else>
              {{ $t(`labels.${getPluralName('createFormView')}`) }}
            </template>
          </template>
          <!-- 看板视图标题 -->
          <template v-else-if="form.type === ViewTypes.KANBAN">
            <template v-if="form.copy_from_id">
              {{ $t('labels.duplicateKanbanView') }}
            </template>
            <template v-else>
              {{ $t(`labels.${getPluralName('createKanbanView')}`) }}
            </template>
          </template>
          <!-- 日历视图标题 -->
          <template v-else-if="form.type === ViewTypes.CALENDAR">
            <template v-if="form.copy_from_id">
              {{ $t('labels.duplicateCalendarView') }}
            </template>
            <template v-else>
              {{ $t(`labels.${getPluralName('createCalendarView')}`) }}
            </template>
          </template>
          <!-- AI视图标题 -->
          <template v-else-if="form.type === 'AI'">
            {{ $t('labels.createViewUsingAi') }}
          </template>
          <!-- 其他视图标题 -->
          <template v-else>
            <template v-if="form.copy_from_id">
              {{ $t('labels.duplicateMapView') }}
            </template>
            <template v-else>
              {{ $t('labels.duplicateView') }}
            </template>
          </template>
        </div>
        <!-- 文档链接（已注释） -->
        <!-- <a
          v-if="!form.copy_from_id"
          class="text-sm !text-gray-600 !font-default !hover:text-gray-600"
          :href="`https://docs.nocodb.com/views/view-types/${typeAlias}`"
          target="_blank"
        >
          Docs
        </a> -->
        <!-- NocoAI按钮 -->
        <div
          v-if="!isAIViewCreateMode && isNecessaryColumnsPresent && isFeatureEnabled(FEATURE_FLAG.AI_FEATURES)"
          :class="{
            'cursor-wait': aiLoading,
          }"
        >
          <NcButton
            type="text"
            size="small"
            class="-my-1 !text-nc-content-purple-dark hover:text-nc-content-purple-dark"
            :class="{
              '!pointer-events-none !cursor-not-allowed': aiLoading,
              '!bg-nc-bg-purple-dark hover:!bg-gray-100': aiMode,
            }"
            @click.stop="aiMode ? disableAiMode() : toggleAiMode(true)"
          >
            <div class="flex items-center justify-center">
              <GeneralIcon icon="ncAutoAwesome" />
              <span
                class="overflow-hidden trasition-all ease duration-200"
                :class="{ 'w-[0px] invisible': aiMode, 'ml-1 w-[78px]': !aiMode }"
              >
                Use NocoAI
              </span>
            </div>
          </NcButton>
        </div>
      </div>
      <!-- 表单区域 -->
      <a-form
        v-if="isNecessaryColumnsPresent"
        ref="formValidator"
        :model="form"
        layout="vertical"
        class="flex flex-col gap-y-5"
        :class="{
          '!px-5': !aiMode,
        }"
      >
        <!-- 非AI模式表单内容 -->
        <template v-if="!aiMode">
          <!-- 视图名称输入框 -->
          <a-form-item :rules="viewNameRules" name="title" class="relative">
            <a-input
              ref="inputEl"
              v-model:value="form.title"
              :placeholder="$t('labels.viewName')"
              autofocus
              class="nc-view-input nc-input-sm nc-input-shadow"
              @keydown.enter="onSubmit"
            />
          </a-form-item>

          <!-- 画廊视图封面图片字段选择 -->
          <a-form-item
            v-if="form.type === ViewTypes.GALLERY && !form.copy_from_id"
            :label="`${$t('labels.coverImageField')}`"
            name="fk_cover_image_col_id"
          >
            <NcSelect
              v-model:value="form.fk_cover_image_col_id"
              :disabled="isMetaLoading"
              :loading="isMetaLoading"
              dropdown-match-select-width
              :not-found-content="$t('placeholder.selectGroupFieldNotFound')"
              :placeholder="$t('placeholder.selectCoverImageField')"
              class="nc-select-shadow w-full nc-gallery-cover-image-field-select"
            >
              <a-select-option v-for="option of viewSelectFieldOptions" :key="option.value" :value="option.value">
                <div class="w-full flex gap-2 items-center justify-between" :title="option.label">
                  <div class="flex-1 flex items-center gap-1 max-w-[calc(100%_-_24px)]">
                    <SmartsheetHeaderIcon v-if="option.value" :column="option" class="!ml-0" />

                    <NcTooltip class="flex-1 max-w-[calc(100%_-_20px)] truncate" show-on-truncate-only>
                      <template #title>
                        {{ option.label }}
                      </template>
                      <template #default>{{ option.label }}</template>
                    </NcTooltip>
                  </div>
                  <GeneralIcon
                    v-if="form.fk_cover_image_col_id === option.value"
                    id="nc-selected-item-icon"
                    icon="check"
                    class="flex-none text-primary w-4 h-4"
                  />
                </div>
              </a-select-option>
            </NcSelect>
          </a-form-item>
          <!-- 看板视图分组字段选择 -->
          <a-form-item
            v-if="form.type === ViewTypes.KANBAN && !form.copy_from_id"
            :label="$t('general.groupingField')"
            :rules="groupingFieldColumnRules"
            name="fk_grp_col_id"
          >
            <NcSelect
              v-model:value="form.fk_grp_col_id"
              :disabled="isMetaLoading"
              :loading="isMetaLoading"
              dropdown-match-select-width
              :not-found-content="$t('placeholder.selectGroupFieldNotFound')"
              :placeholder="$t('placeholder.selectGroupField')"
              class="nc-select-shadow w-full nc-kanban-grouping-field-select"
            >
              <a-select-option v-for="option of viewSelectFieldOptions" :key="option.value" :value="option.value">
                <div class="w-full flex gap-2 items-center justify-between" :title="option.label">
                  <div class="flex-1 flex items-center gap-1 max-w-[calc(100%_-_24px)]">
                    <SmartsheetHeaderIcon :column="option" class="!ml-0" />

                    <NcTooltip class="flex-1 max-w-[calc(100%_-_20px)] truncate" show-on-truncate-only>
                      <template #title>
                        {{ option.label }}
                      </template>
                      <template #default>{{ option.label }}</template>
                    </NcTooltip>
                  </div>
                  <GeneralIcon
                    v-if="form.fk_grp_col_id === option.value"
                    id="nc-selected-item-icon"
                    icon="check"
                    class="flex-none text-primary w-4 h-4"
                  />
                </div>
              </a-select-option>
            </NcSelect>
          </a-form-item>
          <!-- 地图视图地理数据字段选择 -->
          <a-form-item
            v-if="form.type === ViewTypes.MAP"
            :label="$t('general.geoDataField')"
            :rules="geoDataFieldColumnRules"
            name="fk_geo_data_col_id"
          >
            <NcSelect
              v-model:value="form.fk_geo_data_col_id"
              :disabled="isMetaLoading"
              :loading="isMetaLoading"
              :not-found-content="$t('placeholder.selectGeoFieldNotFound')"
              :options="viewSelectFieldOptions"
              :placeholder="$t('placeholder.selectGeoField')"
              class="nc-select-shadow w-full"
            />
          </a-form-item>
          <!-- 日历视图设置 -->
          <template v-if="form.type === ViewTypes.CALENDAR && !form.copy_from_id">
            <div
              v-for="(range, index) in form.calendar_range"
              :key="`range-${index}`"
              :class="{
                '!gap-2': range.fk_to_column_id === null,
              }"
              class="flex flex-col w-full gap-6"
            >
              <!-- 日期字段选择 -->
              <div class="w-full space-y-2">
                <div class="text-gray-800">
                  {{ $t('labels.organiseBy') }}
                </div>

                <a-select
                  v-model:value="range.fk_from_column_id"
                  class="nc-select-shadow w-full nc-from-select !rounded-lg"
                  dropdown-class-name="!rounded-lg"
                  :placeholder="$t('placeholder.notSelected')"
                  data-testid="nc-calendar-range-from-field-select"
                  @click.stop
                  @change="onValueChange"
                >
                  <template #suffixIcon><GeneralIcon icon="arrowDown" class="text-gray-700" /></template>
                  <a-select-option
                    v-for="(option, id) in [...viewSelectFieldOptions!].filter((f) => {
                  // 如果第一个范围的fk_from_column_id是Date，那么所有其他范围也应该是Date
                  // 如果第一个范围的fk_from_column_id是DateTime，那么所有其他范围也应该是DateTime
                  if (index === 0) return true
                  const firstRange = viewSelectFieldOptions!.find((f) => f.value === form.calendar_range[0].fk_from_column_id)
                  return firstRange?.uidt === f.uidt
                })"
                    :key="id"
                    :value="option.value"
                  >
                    <div class="w-full flex gap-2 items-center justify-between" :title="option.label">
                      <div class="flex items-center gap-1 max-w-[calc(100%_-_20px)]">
                        <SmartsheetHeaderIcon :column="option" />

                        <NcTooltip class="flex-1 max-w-[calc(100%_-_20px)] truncate" show-on-truncate-only>
                          <template #title>
                            {{ option.label }}
                          </template>
                          <template #default>{{ option.label }}</template>
                        </NcTooltip>
                      </div>
                      <GeneralIcon
                        v-if="option.value === range.fk_from_column_id"
                        id="nc-selected-item-icon"
                        icon="check"
                        class="flex-none text-primary w-4 h-4"
                      />
                    </div>
                  </a-select-option>
                </a-select>
              </div>
              <!-- 企业版结束日期设置 -->
              <div v-if="isEeUI" class="w-full space-y-2">
                <NcTooltip v-if="range.fk_to_column_id === null" placement="left" :disabled="!isDisabled">
                  <NcButton size="small" type="text" :disabled="isDisabled" @click="range.fk_to_column_id = undefined">
                    <div class="flex items-center gap-1">
                      <component :is="iconMap.plus" class="h-4 w-4" />
                      {{ $t('activity.endDate') }}
                    </div>
                  </NcButton>
                  <template #title> Coming Soon!! Currently, range support is only available for Date field. </template>
                </NcTooltip>

                <template v-else-if="isEeUI">
                  <span class="text-gray-700">
                    {{ $t('activity.withEndDate') }}
                  </span>

                  <div class="flex">
                    <a-select
                      v-model:value="range.fk_to_column_id"
                      class="nc-select-shadow w-full flex-1"
                      allow-clear
                      :disabled="isMetaLoading || isDisabled"
                      :loading="isMetaLoading"
                      :placeholder="$t('placeholder.notSelected')"
                      data-testid="nc-calendar-range-to-field-select"
                      dropdown-class-name="!rounded-lg"
                      @click.stop
                    >
                      <template #suffixIcon><GeneralIcon icon="arrowDown" class="text-gray-700" /></template>

                      <a-select-option
                        v-for="(option, id) in [...viewSelectFieldOptions].filter((f) => {
                          // 如果第一个范围的fk_from_column_id是Date，那么所有其他范围也应该是Date
                          // 如果第一个范围的fk_from_column_id是DateTime，那么所有其他范围也应该是DateTime

                          const firstRange = viewSelectFieldOptions.find(
                            (f) => f.value === form.calendar_range[0].fk_from_column_id,
                          )
                          return firstRange?.uidt === f.uidt && f.value !== range.fk_from_column_id
                        })"
                        :key="id"
                        :value="option.value"
                      >
                        <div class="w-full flex gap-2 items-center justify-between" :title="option.label">
                          <div class="flex items-center gap-1 max-w-[calc(100%_-_20px)]">
                            <SmartsheetHeaderIcon :column="option" />

                            <NcTooltip class="flex-1 max-w-[calc(100%_-_20px)] truncate" show-on-truncate-only>
                              <template #title>
                                {{ option.label }}
                              </template>
                              <template #default>{{ option.label }}</template>
                            </NcTooltip>
                          </div>
                          <GeneralIcon
                            v-if="option.value === range.fk_from_column_id"
                            id="nc-selected-item-icon"
                            icon="check"
                            class="flex-none text-primary w-4 h-4"
                          />
                        </div>
                      </a-select-option>
                    </a-select>
                  </div>
                  <!-- 移除范围按钮 -->
                  <NcButton
                    v-if="index !== 0"
                    size="small"
                    type="secondary"
                    @click="
                      () => {
                        form.calendar_range = form.calendar_range.filter((_, i) => i !== index)
                      }
                    "
                  >
                    <component :is="iconMap.close" />
                  </NcButton>
                </template>
              </div>
            </div>

            <!-- 添加另一个日期字段按钮（已注释） -->
            <!--          <NcButton class="mt-2" size="small" type="secondary" @click="addCalendarRange">
            <component :is="iconMap.plus" />
            Add another date field
          </NcButton> -->

            <!-- 日历只读提示 -->
            <div
              v-if="isCalendarReadonly(form.calendar_range)"
              class="flex flex-row p-4 border-gray-200 border-1 gap-x-4 rounded-lg w-full"
            >
              <div class="text-gray-500 flex gap-4">
                <GeneralIcon class="min-w-6 h-6 text-orange-500" icon="info" />
                <div class="flex flex-col gap-1">
                  <h2 class="font-semibold text-sm mb-0 text-gray-800">Calendar is readonly</h2>
                  <span class="text-gray-500 font-default text-sm"> {{ $t('msg.info.calendarReadOnly') }}</span>
                </div>
              </div>
            </div>
          </template>
        </template>
        <!-- AI模式表单内容 -->
        <template v-else>
          <!-- AI视图向导 -->
          <div v-if="!aiIntegrationAvailable" class="flex items-center gap-3 px-5 pt-2.5 pb-4.5">
            <GeneralIcon icon="alertTriangleSolid" class="!text-nc-content-orange-medium w-4 h-4" />
            <div class="text-sm text-nc-content-gray-subtle flex-1">{{ $t('title.noAiIntegrationAvailable') }}</div>
          </div>
          <!-- AI向导标签页 -->
          <AiWizardTabs v-else v-model:active-tab="activeAiTab">
            <!-- 自动建议内容 -->
            <template #AutoSuggestedContent>
              <div class="px-5 pt-5 pb-2">
                <!-- 错误信息显示 -->
                <div v-if="aiError" class="w-full flex items-center gap-3">
                  <GeneralIcon icon="ncInfoSolid" class="flex-none !text-nc-content-red-dark w-4 h-4" />

                  <NcTooltip class="truncate flex-1 text-sm text-nc-content-gray-subtle" show-on-truncate-only>
                    <template #title>
                      {{ aiError }}
                    </template>
                    {{ aiError }}
                  </NcTooltip>

                  <NcButton size="small" type="text" class="!text-nc-content-brand" @click.stop="handleRefreshOnError">
                    {{ $t('general.refresh') }}
                  </NcButton>
                </div>

                <!-- 初始化状态显示 -->
                <div v-else-if="aiModeStep === 'init'">
                  <div class="text-nc-content-purple-light text-sm h-7 flex items-center gap-2">
                    <GeneralLoader size="regular" class="!text-nc-content-purple-dark" />

                    <div class="nc-animate-dots">Auto suggesting views for {{ meta?.title }}</div>
                  </div>
                </div>
                <!-- 选择状态显示 -->
                <div v-else-if="aiModeStep === 'pick'" class="flex gap-3 items-start">
                  <div class="flex-1 flex gap-2 flex-wrap">
                    <template v-if="activeTabPredictedViews.length">
                      <template v-for="v of activeTabPredictedViews" :key="v.title">
                        <NcTooltip :disabled="!(activeTabSelectedViews.length >= maxSelectionCount || !!v?.description)">
                          <template #title>
                            <div v-if="activeTabSelectedViews.length >= maxSelectionCount" class="w-[150px]">
                              You can only select {{ maxSelectionCount }} views to create at a time.
                            </div>
                            <div v-else>{{ v?.description }}</div>
                          </template>

                          <!-- AI建议标签 -->
                          <a-tag
                            class="nc-ai-suggested-tag"
                            :class="{
                              'nc-disabled': isAiSaving || (!v.selected && activeTabSelectedViews.length >= maxSelectionCount),
                              'nc-selected': v.selected,
                            }"
                            :disabled="activeTabSelectedViews.length >= maxSelectionCount"
                            @click="onToggleTag(v)"
                          >
                            <div class="flex flex-row items-center gap-2 py-[3px] text-small leading-[18px]">
                              <NcCheckbox
                                :checked="v.selected"
                                theme="ai"
                                class="!-mr-0.5"
                                :disabled="isAiSaving || (!v.selected && activeTabSelectedViews.length >= maxSelectionCount)"
                              />

                              <GeneralViewIcon
                                :meta="{ type: stringToViewTypeMap[v.type] }"
                                :class="{
                                  'opacity-60': isAiSaving || (!v.selected && activeTabSelectedViews.length >= maxSelectionCount),
                                }"
                              />

                              <div>{{ v.title }}</div>
                            </div>
                          </a-tag>
                        </NcTooltip>
                      </template>
                    </template>
                    <div v-else class="text-nc-content-gray-subtle2">{{ $t('labels.noData') }}</div>
                  </div>
                  <div class="flex items-center gap-1">
                    <NcTooltip
                      v-if="
                        activeTabPredictHistory.length < activeTabSelectedViews.length
                          ? activeTabPredictHistory.length + activeTabSelectedViews.length < 10
                          : activeTabPredictHistory.length < 10
                      "
                      title="Suggest more"
                      placement="top"
                    >
                      <NcButton
                        v-e="['a:view:ai:predict-more']"
                        size="xs"
                        class="!px-1"
                        type="text"
                        theme="ai"
                        :disabled="isAiSaving"
                        :loading="aiLoading && calledFunction === 'predictMore'"
                        icon-only
                        @click="predictMore"
                      >
                        <template #icon>
                          <GeneralIcon icon="ncPlusAi" class="!text-current" />
                        </template>
                      </NcButton>
                    </NcTooltip>
                    <NcTooltip title="Clear all and Re-suggest" placement="top">
                      <NcButton
                        v-e="['a:view:ai:predict-refresh']"
                        size="xs"
                        class="!px-1"
                        type="text"
                        theme="ai"
                        :disabled="isAiSaving"
                        :loading="aiLoading && calledFunction === 'predictRefresh'"
                        @click="predictRefresh"
                      >
                        <template #loadingIcon>
                          <!-- eslint-disable vue/no-lone-template -->
                          <template></template>
                        </template>
                        <GeneralIcon
                          icon="refresh"
                          class="!text-current"
                          :class="{
                            'animate-infinite animate-spin': aiLoading && calledFunction === 'predictRefresh',
                          }"
                        />
                      </NcButton>
                    </NcTooltip>
                  </div>
                </div>
              </div>
            </template>
            <!-- 提示内容模板 -->
            <template #PromptContent>
              <!-- 主容器，设置内边距和间距 -->
              <div class="px-5 pt-5 pb-2 flex flex-col gap-5">
                <!-- 文本输入区域容器，使用相对定位以便放置发送按钮 -->
                <div class="relative">
                  <!-- AI提示输入文本框 -->
                  <a-textarea
                    ref="aiPromptInputRef"
                    v-model:value="prompt"
                    :disabled="isAiSaving"
                    placeholder="Enter your prompt to get view suggestions.."
                    class="nc-ai-input nc-input-shadow !px-3 !pt-2 !pb-3 !text-sm !min-h-[120px] !rounded-lg"
                    @keydown.enter.stop
                  >
                  </a-textarea>

                  <!-- 发送提示按钮，位于文本框右下角 -->
                  <NcButton
                    size="xs"
                    type="primary"
                    theme="ai"
                    class="!px-1 !absolute bottom-2 right-2"
                    :disabled="
                      !prompt.trim() ||
                      isPredictFromPromptLoading ||
                      (!!prompt.trim() && prompt.trim() === oldPrompt.trim()) ||
                      isAiSaving
                    "
                    :loading="isPredictFromPromptLoading"
                    icon-only
                    @click="
                      () => {
                        $e('a:view:ai:predict-from-prompt', { prompt })
                        predictFromPrompt()
                      }
                    "
                  >
                    <!-- 加载中图标模板 -->
                    <template #loadingIcon>
                      <GeneralLoader class="!text-purple-700" size="medium" />
                    </template>
                    <!-- 默认图标模板 -->
                    <template #icon>
                      <GeneralIcon icon="send" class="flex-none h-4 w-4" />
                    </template>
                  </NcButton>
                </div>

                <!-- 错误信息显示区域 -->
                <div v-if="aiError" class="w-full flex items-center gap-3">
                  <!-- 错误图标 -->
                  <GeneralIcon icon="ncInfoSolid" class="flex-none !text-nc-content-red-dark w-4 h-4" />

                  <!-- 错误信息提示框，当文本过长时显示完整内容 -->
                  <NcTooltip class="truncate flex-1 text-sm text-nc-content-gray-subtle" show-on-truncate-only>
                    <!-- 提示框标题 -->
                    <template #title>
                      {{ aiError }}
                    </template>
                    <!-- 提示框内容 -->
                    {{ aiError }}
                  </NcTooltip>

                  <!-- 刷新按钮 -->
                  <NcButton size="small" type="text" class="!text-nc-content-brand" @click.stop="handleRefreshOnError">
                    {{ $t('general.refresh') }}
                  </NcButton>
                </div>

                <!-- 已生成提示的视图显示区域 -->
                <div v-else-if="isPromtAlreadyGenerated" class="flex flex-col gap-3">
                  <!-- 标题 -->
                  <div class="text-nc-content-purple-dark font-semibold text-xs">Generated Views(s)</div>
                  <!-- 视图标签容器 -->
                  <div class="flex gap-2 flex-wrap">
                    <!-- 当有预测视图时显示 -->
                    <template v-if="activeTabPredictedViews.length">
                      <!-- 遍历每个预测视图 -->
                      <template v-for="v of activeTabPredictedViews" :key="v.title">
                        <!-- 视图提示框，当达到最大选择数量或有描述时显示 -->
                        <NcTooltip :disabled="!(activeTabSelectedViews.length >= maxSelectionCount || !!v?.description)">
                          <!-- 提示框标题 -->
                          <template #title>
                            <!-- 当达到最大选择数量时显示提示 -->
                            <div v-if="activeTabSelectedViews.length >= maxSelectionCount" class="w-[150px]">
                              You can only select {{ maxSelectionCount }} views to create at a time.
                            </div>
                            <!-- 否则显示视图描述 -->
                            <div v-else>{{ v?.description }}</div>
                          </template>

                          <!-- 视图标签 -->
                          <a-tag
                            class="nc-ai-suggested-tag"
                            :class="{
                              'nc-disabled': isAiSaving || (!v.selected && activeTabSelectedViews.length >= maxSelectionCount),
                              'nc-selected': v.selected,
                            }"
                            :disabled="activeTabSelectedViews.length >= maxSelectionCount"
                            @click="onToggleTag(v)"
                          >
                            <!-- 标签内容 -->
                            <div class="flex flex-row items-center gap-2 py-[3px] text-small leading-[18px]">
                              <!-- 复选框 -->
                              <NcCheckbox
                                :checked="v.selected"
                                theme="ai"
                                class="!-mr-0.5"
                                :disabled="isAiSaving || (!v.selected && activeTabSelectedViews.length >= maxSelectionCount)"
                              />

                              <!-- 视图类型图标 -->
                              <GeneralViewIcon
                                :meta="{ type: stringToViewTypeMap[v.type] }"
                                :class="{
                                  'opacity-60': isAiSaving || (!v.selected && activeTabSelectedViews.length >= maxSelectionCount),
                                }"
                              />

                              <!-- 视图标题 -->
                              <div>{{ v.title }}</div>
                            </div>
                          </a-tag>
                        </NcTooltip>
                      </template>
                    </template>
                    <!-- 当没有预测视图时显示无数据提示 -->
                    <div v-else class="text-nc-content-gray-subtle2">{{ $t('labels.noData') }}</div>
                  </div>
                </div>
              </div>
            </template>
          </AiWizardTabs>
        </template>
      </a-form>
            <!-- 当必要的列不存在时显示的提示信息 -->
            <div v-else-if="!isNecessaryColumnsPresent" class="px-5">
        <!-- 警告框容器，使用弹性布局，添加内边距和圆角 -->
        <div class="flex flex-row p-4 border-gray-200 border-1 gap-x-4 rounded-lg w-full">
          <!-- 警告信息内容区域 -->
          <div class="text-gray-500 flex gap-4">
            <!-- 警告图标 -->
            <GeneralIcon class="min-w-6 h-6 text-orange-500" icon="alertTriangle" />
            <!-- 警告文本内容区域 -->
            <div class="flex flex-col gap-1">
              <!-- 警告标题 -->
              <h2 class="font-semibold text-sm mb-0 text-gray-800">Suitable fields not present</h2>
              <!-- 警告详细信息，根据视图类型显示不同的错误消息 -->
              <span class="text-gray-500 font-default text-sm"> {{ errorMessages[form.type] }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 描述输入区域，仅在启用描述且非AI模式时显示 -->
      <a-form-item v-if="enableDescription && !aiMode" class="!px-5">
        <!-- 描述标题和删除按钮区域 -->
        <div class="flex gap-3 text-gray-800 h-7 mt-4 mb-1 items-center justify-between">
          <!-- 描述标签文本 -->
          <span class="text-[13px]">
            {{ $t('labels.description') }}
          </span>

          <!-- 删除描述按钮 -->
          <NcButton type="text" class="!h-6 !w-5" size="xsmall" @click="removeDescription">
            <!-- 删除图标 -->
            <GeneralIcon icon="delete" class="text-gray-700 w-3.5 h-3.5" />
          </NcButton>
        </div>

        <!-- 描述文本输入框 -->
        <a-textarea
          ref="descriptionInputEl"
          v-model:value="form.description"
          class="nc-input-sm nc-input-text-area nc-input-shadow px-3 !text-gray-800 max-h-[150px] min-h-[100px]"
          hide-details
          data-testid="create-table-title-input"
          :placeholder="$t('msg.info.enterViewDescription')"
        />
      </a-form-item>

      <!-- 底部按钮区域 -->
      <div
        class="flex flex-row w-full justify-between gap-x-2 px-5"
        :class="{
          '-mt-2': aiMode,
        }"
      >
        <!-- 添加描述按钮，仅在未启用描述且非AI模式时显示 -->
        <NcButton v-if="!enableDescription && !aiMode" size="small" type="text" @click.stop="toggleDescription">
          <!-- 按钮内容区域 -->
          <div class="flex !text-gray-700 items-center gap-2">
            <!-- 添加图标 -->
            <GeneralIcon icon="plus" class="h-4 w-4" />

            <!-- 按钮文本，首字母大写 -->
            <span class="first-letter:capitalize">
              {{ $t('labels.addDescription') }}
            </span>
          </div>
        </NcButton>
        <!-- 占位元素，用于保持布局平衡 -->
        <div v-else></div>
        <!-- 操作按钮组 -->
        <div class="flex gap-2 items-center">
          <!-- 取消按钮 -->
          <NcButton type="secondary" size="small" :disabled="isAiSaving" @click="vModel = false">
            {{ $t('general.cancel') }}
          </NcButton>

          <!-- 创建视图按钮（非AI模式） -->
          <NcButton
            v-if="!aiMode"
            v-e="[form.copy_from_id ? 'a:view:duplicate' : 'a:view:create']"
            :disabled="!isNecessaryColumnsPresent || isViewCreating"
            :loading="isViewCreating"
            type="primary"
            size="small"
            @click="onSubmit"
          >
            <!-- 按钮默认文本 -->
            {{ $t('labels.createView') }}
            <!-- 加载中状态的文本 -->
            <template #loading> {{ $t('labels.creatingView') }}</template>
          </NcButton>
          <!-- AI模式下的创建按钮（当AI集成可用时） -->
          <NcButton
            v-else-if="aiIntegrationAvailable"
            type="primary"
            size="small"
            theme="ai"
            :disabled="activeTabSelectedViews.length === 0 || isAiSaving"
            :loading="isAiSaving"
            @click="onSubmit"
          >
            <!-- 按钮内容区域 -->
            <div class="flex items-center gap-2 h-5">
              {{
                activeTabSelectedViews.length
                  ? activeTabSelectedViews.length > 1
                    ? $t('labels.createViews_plural', {
                        count: activeTabSelectedViews.length,
                      })
                    : $t('labels.createViews', {
                        count: activeTabSelectedViews.length,
                      })
                  : $t('labels.createView')
              }}
            </div>
            <!-- 加载中状态的文本 -->
            <template #loading> {{ $t('labels.creatingView') }} </template>
          </NcButton>
          <!-- 当AI集成不可用时显示的添加AI集成按钮 -->
          <NcButton v-else type="primary" size="small" @click="handleNavigateToIntegrations"> Add AI integration </NcButton>
        </div>
      </div>
    </div>
  </NcModal>
</template>

<style lang="scss" scoped>
.nc-input-text-area {
  padding-block: 8px !important;
}
.ant-form-item-required {
  @apply !text-gray-800 font-medium;
  &:before {
    @apply !content-[''];
  }
}

.ant-form-item {
  @apply !mb-0;
}

.nc-input-sm {
  @apply !mb-0;
}

.nc-view-create-modal {
  :deep(.nc-modal) {
  }
}

:deep(.ant-form-item-label > label) {
  @apply !text-sm text-gray-800 flex;

  &.ant-form-item-required:not(.ant-form-item-required-mark-optional)::before {
    @apply content-[''] m-0;
  }
}

.nc-nocoai-footer {
  @apply px-6 py-1 flex items-center gap-2 text-nc-content-purple-dark border-t-1 border-purple-100;

  .nc-nocoai-settings {
    &:not(:disabled) {
      @apply hover:!bg-nc-bg-purple-light;
    }
    &.nc-ai-loading {
      @apply !cursor-wait;
    }
  }
}
.nc-view-ai-mode {
  .nc-view-input {
    &:not(:focus) {
      @apply !rounded-r-none !border-r-0;

      & ~ .nc-view-ai-toggle-btn {
        button {
          @apply !pl-[7px] z-11 !border-l-1;
        }
      }
    }
  }
}
</style>

<style lang="scss">
.nc-modal-wrapper.nc-modal-view-create-wrapper {
  .ant-modal-content {
    @apply !rounded-5;
  }
}
:deep(.ant-select) {
  .ant-select-selector {
    @apply !rounded-lg;
  }
}
</style>
