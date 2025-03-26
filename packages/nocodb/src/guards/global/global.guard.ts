import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { lastValueFrom, Observable } from 'rxjs';
import { extractRolesObj } from 'nocodb-sdk';
import type { Request } from 'express';
import type { ExecutionContext } from '@nestjs/common';
import { JwtStrategy } from '~/strategies/jwt.strategy';

@Injectable()
export class GlobalGuard extends AuthGuard(['jwt']) {
  // 构造函数，注入JwtStrategy
  constructor(private jwtStrategy: JwtStrategy) {
    super();
  }

  // 核心方法，决定请求是否被允许
  async canActivate(context: ExecutionContext) {
    let result;

    // 获取请求对象
    const req = context.switchToHttp().getRequest();

    // 如果请求头包含xc-auth，尝试进行JWT认证
    if (req.headers?.['xc-auth']) {
      try {
        // 调用父类的canActivate方法并获取结果
        result = await this.extractBoolVal(super.canActivate(context));
      } catch (e) {
        // 捕获并打印异常
        console.log(e);
      }
    }

    // 如果认证成功且不是共享基础请求
    if (result && !req.headers['xc-shared-base-id']) {
      // 检查是否为预览请求且用户角色为owner或creator
      if (
        req.path.indexOf('/user/me') === -1 &&
        req.header('xc-preview') &&
        ['owner', 'creator'].some((role) => req.user.roles?.[role])
      ) {
        // 返回修改后的用户对象，包含预览角色
        return (req.user = {
          ...req.user,
          isAuthorized: true,
          roles: extractRolesObj(req.header('xc-preview')),
        });
      }
    }

    // 如果认证成功，直接返回true
    if (result) return true;

    // 处理xc-token认证
    if (req.headers['xc-token']) {
      let canActivate = false;
      try {
        // 创建authtoken守卫并尝试认证
        const guard = new (AuthGuard('authtoken'))(context);
        canActivate = await this.extractBoolVal(guard.canActivate(context));
      } catch {}

      // 如果认证成功，返回认证后的用户
      if (canActivate) {
        return this.authenticate(req, {
          ...req.user,
          isAuthorized: true,
          roles: req.user.roles,
        });
      }
    } else if (req.headers['xc-shared-base-id']) {
      let canActivate = false;
      try {
        // 创建base-view守卫并尝试认证
        const guard = new (AuthGuard('base-view'))(context);
        canActivate = await this.extractBoolVal(guard.canActivate(context));
      } catch {}

      // 如果认证成功，返回认证后的用户
      if (canActivate) {
        return this.authenticate(req, {
          ...req.user,
          isAuthorized: true,
          isPublicBase: true,
        });
      }
    }

    // 如果JWT认证失败，使用回退策略设置默认用户
    return await this.authenticate(req);
  }

  // 认证方法，用于验证用户
  private async authenticate(
    req: Request,
    user: any = {
      roles: {
        guest: true,
      },
    },
  ): Promise<any> {
    // 使用JwtStrategy验证用户
    const u = await this.jwtStrategy.validate(req, user);
    // 将验证后的用户设置到请求对象中
    req.user = u;
    return true;
  }

  // 提取布尔值的方法，处理不同类型的返回值
  async extractBoolVal(
    canActivate: boolean | Promise<boolean> | Observable<boolean>,
  ) {
    // 如果是Observable，转换为Promise并获取值
    if (canActivate instanceof Observable) {
      return lastValueFrom(canActivate);
    } else if (
      typeof canActivate === 'boolean' ||
      canActivate instanceof Promise
    ) {
      return canActivate;
    }
  }
}
