// 导入所需的类型和工具
import type { BoolType, MetaType } from 'nocodb-sdk'; // 导入布尔类型和元数据类型
import type { CalendarType } from 'nocodb-sdk'; // 导入日历视图类型
import type { NcContext } from '~/interface/config'; // 导入上下文类型
import { extractProps } from '~/helpers/extractProps'; // 导入属性提取工具
import { prepareForDb, prepareForResponse } from '~/utils/modelUtils'; // 导入数据库和响应数据准备工具
import NocoCache from '~/cache/NocoCache'; // 导入缓存模块
import Noco from '~/Noco'; // 导入Noco核心模块
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals'; // 导入缓存相关常量
import CalendarRange from '~/models/CalendarRange'; // 导入日历范围模型

// 定义CalendarView类，实现CalendarType接口
export default class CalendarView implements CalendarType {
  fk_view_id: string; // 视图ID
  title: string; // 标题
  fk_workspace_id?: string; // 工作区ID（可选）
  base_id?: string; // 基础ID（可选）
  source_id?: string; // 数据源ID（可选）
  meta?: MetaType; // 元数据（可选）
  calendar_range?: Array<Partial<CalendarRange>>; // 日历范围数组（可选）
  fk_cover_image_col_id?: string; // 封面图片列ID（可选）
  
  // 以下字段目前未使用，暂时保留
  show?: BoolType; // 是否显示（可选）
  public?: BoolType; // 是否公开（可选）
  password?: string; // 密码（可选）
  show_all_fields?: BoolType; // 是否显示所有字段（可选）

  // 构造函数，使用传入的数据初始化对象
  constructor(data: CalendarView) {
    Object.assign(this, data);
  }

  // 静态方法：根据视图ID获取日历视图
  public static async get(
    context: NcContext, // 上下文对象
    viewId: string, // 视图ID
    ncMeta = Noco.ncMeta, // 元数据操作对象，默认为Noco的ncMeta
  ) {
    // 尝试从缓存中获取视图
    let view =
      viewId &&
      (await NocoCache.get(
        `${CacheScope.CALENDAR_VIEW}:${viewId}`,
        CacheGetType.TYPE_OBJECT,
      ));
    
    if (view) {
      // 如果缓存中存在视图，读取日历范围
      const calendarRange = await CalendarRange.read(context, viewId, ncMeta);
      if (calendarRange) {
        view.calendar_range = calendarRange.ranges;
      } else {
        view.calendar_range = [];
      }
    } else {
      // 如果缓存中不存在，从数据库中获取
      view = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.CALENDAR_VIEW,
        {
          fk_view_id: viewId,
        },
      );
      // 读取日历范围
      const calendarRange = await CalendarRange.read(context, viewId, ncMeta);
      if (view && calendarRange) {
        view.calendar_range = calendarRange.ranges;
      }
      // 将结果存入缓存
      await NocoCache.set(`${CacheScope.CALENDAR_VIEW}:${viewId}`, view);
    }

    // 返回新的CalendarView实例
    return view && new CalendarView(view);
  }

  // 静态方法：插入新的日历视图
  static async insert(
    context: NcContext, // 上下文对象
    view: Partial<CalendarView>, // 要插入的视图数据
    ncMeta = Noco.ncMeta, // 元数据操作对象，默认为Noco的ncMeta
  ) {
    // 准备插入对象
    const insertObj = {
      base_id: view.base_id,
      source_id: view.source_id,
      fk_view_id: view.fk_view_id,
      meta: view.meta,
    };

    // 执行插入操作
    await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.CALENDAR_VIEW,
      insertObj,
      true,
    );

    // 返回新插入的视图
    return this.get(context, view.fk_view_id, ncMeta);
  }

  // 静态方法：更新日历视图
  static async update(
    context: NcContext, // 上下文对象
    calendarId: string, // 日历ID
    body: Partial<CalendarView>, // 要更新的数据
    ncMeta = Noco.ncMeta, // 元数据操作对象，默认为Noco的ncMeta
  ) {
    // 提取需要更新的属性
    const updateObj = extractProps(body, ['fk_cover_image_col_id', 'meta']);

    // 如果更新了日历范围
    if (body.calendar_range) {
      // 删除旧的日历范围
      await ncMeta.metaDelete(
        context.workspace_id,
        context.base_id,
        MetaTable.CALENDAR_VIEW_RANGE,
        {
          fk_view_id: calendarId,
        },
      );
      // 删除缓存
      await NocoCache.del(`${CacheScope.CALENDAR_VIEW}:${calendarId}`);
      // 批量插入新的日历范围
      await CalendarRange.bulkInsert(
        context,
        body.calendar_range.map((range) => {
          return {
            fk_view_id: calendarId,
            ...range,
          };
        }),
        ncMeta,
      );
    }

    // 更新元数据
    const res = await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.CALENDAR_VIEW,
      prepareForDb(updateObj),
      {
        fk_view_id: calendarId,
      },
    );

    // 更新缓存
    await NocoCache.update(
      `${CacheScope.CALENDAR_VIEW}:${calendarId}`,
      prepareForResponse(updateObj),
    );

    // 返回更新结果
    return res;
  }
}
