// 导入NestJS的核心装饰器和类型
import { Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';

// 使用@Injectable()装饰器将该类标记为可注入的provider
@Injectable()
// 实现CanActivate接口，用于创建路由守卫
export class MetaApiLimiterGuard implements CanActivate {
  // 实现canActivate方法，该方法决定是否允许请求继续
  async canActivate(_context: ExecutionContext): Promise<boolean> {
    // 当前直接返回true，表示允许所有请求通过
    // 实际应用中可在此添加限流逻辑，如检查请求频率等
    return true;
  }
}
