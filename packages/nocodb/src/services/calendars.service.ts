// 导入 NestJS 的 Injectable 装饰器，用于依赖注入
import { Injectable } from '@nestjs/common';
// 导入 nocodb-sdk 中的 AppEvents 和 ViewTypes 枚举
import { AppEvents, ViewTypes } from 'nocodb-sdk';
// 导入 nocodb-sdk 中的类型定义
import type {
  CalendarUpdateReqType,
  UserType,
  ViewCreateReqType,
} from 'nocodb-sdk';
// 导入项目内部的配置接口类型
import type { NcContext, NcRequest } from '~/interface/config';
// 导入应用钩子服务
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
// 导入验证负载的辅助函数
import { validatePayload } from '~/helpers';
// 导入错误处理辅助类
import { NcError } from '~/helpers/catchError';
// 导入数据模型
import { CalendarView, Model, User, View } from '~/models';
// 导入缓存管理模块
import NocoCache from '~/cache/NocoCache';
// 导入缓存作用域常量
import { CacheScope } from '~/utils/globals';

// 使用 Injectable 装饰器标记该服务可被依赖注入系统使用
@Injectable()
export class CalendarsService {
  // 构造函数，注入 AppHooksService 服务
  constructor(private readonly appHooksService: AppHooksService) {}

  // 获取日历视图的方法
  // 参数：上下文和包含日历视图ID的参数对象
  async calendarViewGet(context: NcContext, param: { calendarViewId: string }) {
    // 调用 CalendarView 模型的 get 方法获取日历视图数据并返回
    return await CalendarView.get(context, param.calendarViewId);
  }

  // 创建日历视图的方法
  // 参数：上下文和包含表ID、日历配置、用户信息、请求对象和可选的所有者ID的参数对象
  async calendarViewCreate(
    context: NcContext,
    param: {
      tableId: string;
      calendar: ViewCreateReqType;
      user: UserType;
      req: NcRequest;
      ownedBy?: string;
    },
  ) {
    // 验证日历配置是否符合 swagger 定义的模式
    validatePayload(
      'swagger.json#/components/schemas/ViewCreateReq',
      param.calendar,
    );

    // 获取表模型数据
    const model = await Model.get(context, param.tableId);

    // 插入视图元数据，只创建视图记录而不处理关联数据
    const { id } = await View.insertMetaOnly(context, {
      view: {
        ...param.calendar,
        fk_model_id: param.tableId,
        type: ViewTypes.CALENDAR,
        base_id: model.base_id,
        source_id: model.source_id,
        created_by: param.user?.id,
        owned_by: param.ownedBy || param.user?.id,
      },
      model,
      req: param.req,
    });

    // 获取刚创建的视图完整数据
    const view = await View.get(context, id);

    // 将新视图添加到缓存列表中
    await NocoCache.appendToList(
      CacheScope.VIEW,
      [view.fk_model_id],
      `${CacheScope.VIEW}:${id}`,
    );

    // 设置所有者信息，默认为请求用户
    let owner = param.req.user;

    // 如果指定了所有者ID，则获取所有者信息
    if (param.ownedBy) {
      owner = await User.get(param.ownedBy);
    }

    // 触发日历创建事件
    this.appHooksService.emit(AppEvents.CALENDAR_CREATE, {
      view: {
        ...view,
        ...param.calendar,
      },
      req: param.req,
      context,
      owner,
    });

    // 返回创建的视图数据
    return view;
  }

  // 更新日历视图的方法
  // 参数：上下文和包含日历视图ID、日历更新配置和请求对象的参数对象
  async calendarViewUpdate(
    context: NcContext,
    param: {
      calendarViewId: string;
      calendar: CalendarUpdateReqType;
      req: NcRequest;
    },
  ) {
    // 验证日历更新配置是否符合 swagger 定义的模式
    validatePayload(
      'swagger.json#/components/schemas/CalendarUpdateReq',
      param.calendar,
    );

    // 获取视图数据
    const view = await View.get(context, param.calendarViewId);

    // 如果视图不存在，抛出错误
    if (!view) {
      NcError.viewNotFound(param.calendarViewId);
    }

    // 获取更新前的日历视图数据
    const oldCalendarView = await CalendarView.get(
      context,
      param.calendarViewId,
    );

    // 更新日历视图
    const res = await CalendarView.update(
      context,
      param.calendarViewId,
      param.calendar,
    );

    // 设置所有者信息，默认为请求用户
    let owner = param.req.user;

    // 如果视图有所有者且不是当前请求用户，则获取所有者信息
    if (view.owned_by && view.owned_by !== param.req.user?.id) {
      owner = await User.get(view.owned_by);
    }

    // 触发日历更新事件
    this.appHooksService.emit(AppEvents.CALENDAR_UPDATE, {
      view: {
        ...view,
        ...param.calendar,
      },
      calendarView: param.calendar,
      oldCalendarView,
      req: param.req,
      context,
      owner,
    });
    // 返回更新结果
    return res;
  }
}
