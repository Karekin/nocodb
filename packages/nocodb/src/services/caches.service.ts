// 导入 NestJS 框架中的 Injectable 装饰器，用于标记该服务可被依赖注入系统使用
import { Injectable } from '@nestjs/common';
// 导入 NocoCache 缓存工具类，用于处理应用程序的缓存操作
import NocoCache from '~/cache/NocoCache';

// 使用 Injectable 装饰器标记 CachesService 类，使其可以被 NestJS 依赖注入系统识别和管理
@Injectable()
// 定义 CachesService 服务类，用于管理应用程序的缓存操作
export class CachesService {
  // 定义异步方法 cacheGet，用于获取当前缓存中的所有数据
  async cacheGet() {
    // 调用 NocoCache 的 export 方法导出所有缓存数据并返回
    return await NocoCache.export();
  }

  // 定义异步方法 cacheDelete，用于清除所有缓存数据
  async cacheDelete() {
    // 调用 NocoCache 的 destroy 方法销毁所有缓存
    await NocoCache.destroy();
    // 操作成功后返回 true
    return true;
  }
}
