// 导入 NestJS 的依赖注入装饰器
import { Injectable } from '@nestjs/common';
// 导入工具包中的 packageInfo（包信息）和 T（遥测工具）
import { packageInfo, T } from '~/utils';

// 使用 @Injectable 装饰器标记该类可以被依赖注入系统使用
@Injectable()
// 定义遥测服务类
export class TelemetryService {
  // 声明默认载荷属性，类型为 any
  private defaultPayload: any;

  // 构造函数
  constructor() {
    // 初始化默认载荷，包含包版本信息
    this.defaultPayload = {
      package_id: packageInfo.version,
    };
  }

  // 发送遥测事件的公共方法
  public sendEvent({
    // 解构参数，将 evt_type 重命名为 event
    evt_type: event,
    // 收集剩余的参数到 payload 对象中
    ...payload
  }: {
    // 定义 evt_type 参数类型为字符串
    evt_type: string;
    // 允许传入任意其他键值对参数
    [key: string]: any;
  }) {
    // 如果事件类型是页面访问，则调用页面跟踪方法
    if (event === '$pageview') T.page({ ...payload, event });
    // 否则调用普通事件跟踪方法
    else T.event({ ...payload, event });
  }
}
