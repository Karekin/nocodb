// 导入 nocodb-sdk 中的 ViewTypes 枚举，用于定义不同的视图类型
import { ViewTypes } from 'nocodb-sdk'
// 导入 iconUtils 文件中的 iconMap 对象，包含各种图标
import { iconMap } from './iconUtils'
// 导入 Language 类型定义
import type { Language } from '~/lib/types'
// 导入用户图标组件
import UsersIcon from '~icons/nc-icons/users'
// 导入锁定图标组件
import LockIcon from '~icons/nc-icons-v2/lock'
// 导入个人图标组件
import PersonalIcon from '~icons/nc-icons/personal'

// 定义视图图标映射对象，为每种视图类型指定对应的图标和颜色
export const viewIcons: Record<number | string, { icon: any; color: string }> = {
  // 网格视图的图标和颜色
  [ViewTypes.GRID]: { icon: iconMap.grid, color: '#36BFFF' },
  // 表单视图的图标和颜色
  [ViewTypes.FORM]: { icon: iconMap.form, color: '#7D26CD' },
  // 日历视图的图标和颜色
  [ViewTypes.CALENDAR]: { icon: iconMap.calendar, color: '#B33771' },
  // 画廊视图的图标和颜色
  [ViewTypes.GALLERY]: { icon: iconMap.gallery, color: '#FC3AC6' },
  // 地图视图的图标和颜色
  [ViewTypes.MAP]: { icon: iconMap.map, color: 'blue' },
  // 看板视图的图标和颜色
  [ViewTypes.KANBAN]: { icon: iconMap.kanban, color: '#FF9052' },
  // 默认视图的图标和颜色
  view: { icon: iconMap.view, color: 'blue' },
}

// 判断语言是否为从右到左书写的语言（如阿拉伯语、波斯语）
export const isRtlLang = (lang: keyof typeof Language) => ['fa', 'ar'].includes(lang)

// 定义从右到左的文本方向常量
const rtl = 'rtl' as const
// 定义从左到右的文本方向常量
const ltr = 'ltr' as const

// 应用语言方向到文档体
export function applyLanguageDirection(dir: typeof rtl | typeof ltr) {
  // 确定相反的方向
  const oppositeDirection = dir === ltr ? rtl : ltr

  // 从文档体中移除相反方向的类
  document.body.classList.remove(oppositeDirection)
  // 向文档体添加当前方向的类
  document.body.classList.add(dir)
  // 设置文档体的方向样式
  document.body.style.direction = dir
}

// 根据键获取视图图标
export const getViewIcon = (key?: string | number) => {
  // 如果没有提供键，则返回 undefined
  if (!key) return

  // 返回对应键的视图图标
  return viewIcons[key]
}

// 应用不可选择状态到文档体
export function applyNonSelectable() {
  // 向文档体添加不可选择类
  document.body.classList.add('non-selectable')
}

// 定义视图锁定图标映射对象，包含不同锁定类型的标题、图标和副标题
export const viewLockIcons = {
  // 个人锁定类型
  [LockType.Personal]: {
    // 个人视图的标题（国际化键）
    title: 'title.personal',
    // 个人视图的图标
    icon: PersonalIcon,
    // 个人视图的副标题（国际化键）
    subtitle: 'msg.info.personalView',
  },
  // 协作锁定类型
  [LockType.Collaborative]: {
    // 协作视图的标题（国际化键）
    title: 'title.collaborative',
    // 协作视图的图标
    icon: UsersIcon,
    // 协作视图的副标题（国际化键）
    subtitle: 'msg.info.collabView',
  },
  // 锁定类型
  [LockType.Locked]: {
    // 锁定视图的标题（国际化键）
    title: 'title.locked',
    // 锁定视图的图标
    icon: LockIcon,
    // 锁定视图的副标题（国际化键）
    subtitle: 'msg.info.lockedView',
  },
}
