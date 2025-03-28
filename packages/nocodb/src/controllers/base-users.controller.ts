// 导入所需的 NestJS 装饰器和类型
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
// 导入项目角色和用户请求类型
import { ProjectRoles, ProjectUserReqType } from 'nocodb-sdk';
// 导入全局守卫
import { GlobalGuard } from '~/guards/global/global.guard';
// 导入基础用户服务
import { BaseUsersService } from '~/services/base-users/base-users.service';
// 导入错误处理工具
import { NcError } from '~/helpers/catchError';
// 导入访问控制中间件
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
// 导入 API 限制器守卫
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
// 导入租户上下文装饰器
import { TenantContext } from '~/decorators/tenant-context.decorator';
// 导入上下文和请求接口类型
import { NcContext, NcRequest } from '~/interface/config';

// 使用 API 限制器和全局守卫
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
// 声明控制器
@Controller()
export class BaseUsersController {
  // 构造函数，注入基础用户服务
  constructor(protected readonly baseUsersService: BaseUsersService) {}

  // 获取用户列表的路由（支持 v1 和 v2 API）
  @Get([
    '/api/v1/db/meta/projects/:baseId/users',
    '/api/v2/meta/bases/:baseId/users',
  ])
  // 使用访问控制装饰器
  @Acl('baseUserList')
  async userList(
    @TenantContext() context: NcContext,
    @Param('baseId') baseId: string,
    @Req() req: NcRequest,
  ) {
    // 获取用户的基础角色
    const baseRoles = Object.keys((req.user as any)?.base_roles ?? {});
    // 根据用户角色确定查看模式
    const mode =
      baseRoles.includes(ProjectRoles.OWNER) ||
      baseRoles.includes(ProjectRoles.CREATOR)
        ? 'full'
        : 'viewer';

    // 返回用户列表
    return {
      users: await this.baseUsersService.userList(context, {
        baseId,
        mode,
      }),
    };
  }

  // 邀请用户的路由
  @Post([
    '/api/v1/db/meta/projects/:baseId/users',
    '/api/v2/meta/bases/:baseId/users',
  ])
  // 设置 HTTP 状态码为 200
  @HttpCode(200)
  // 使用访问控制装饰器
  @Acl('userInvite')
  async userInvite(
    @TenantContext() context: NcContext,
    @Param('baseId') baseId: string,
    @Req() req: NcRequest,
    @Body() body: ProjectUserReqType,
  ): Promise<any> {
    // 验证邮箱是否存在
    if (!body.email) {
      NcError.badRequest('Email is required');
    }
    // 调用服务发送邀请
    return await this.baseUsersService.userInvite(context, {
      baseId,
      baseUser: body,
      req,
    });
  }

  // 更新用户信息的路由
  @Patch([
    '/api/v1/db/meta/projects/:baseId/users/:userId',
    '/api/v2/meta/bases/:baseId/users/:userId',
  ])
  // 使用访问控制装饰器
  @Acl('baseUserUpdate')
  async baseUserUpdate(
    @TenantContext() context: NcContext,
    @Param('baseId') baseId: string,
    @Param('userId') userId: string,
    @Req() req: NcRequest,
    @Body()
    body: ProjectUserReqType & {
      base_id: string;
    },
  ): Promise<any> {
    // 调用服务更新用户信息
    await this.baseUsersService.baseUserUpdate(context, {
      baseUser: body,
      baseId,
      userId,
      req,
    });
    // 返回成功消息
    return {
      msg: 'The user has been updated successfully',
    };
  }

  // 删除用户的路由
  @Delete([
    '/api/v1/db/meta/projects/:baseId/users/:userId',
    '/api/v2/meta/bases/:baseId/users/:userId',
  ])
  // 使用访问控制装饰器
  @Acl('baseUserDelete')
  async baseUserDelete(
    @TenantContext() context: NcContext,
    @Param('baseId') baseId: string,
    @Param('userId') userId: string,
    @Req() req: NcRequest,
  ): Promise<any> {
    // 调用服务删除用户
    await this.baseUsersService.baseUserDelete(context, {
      baseId,
      userId,
      req,
    });
    // 返回成功消息
    return {
      msg: 'The user has been deleted successfully',
    };
  }

  // 重新发送邀请的路由
  @Post([
    '/api/v1/db/meta/projects/:baseId/users/:userId/resend-invite',
    '/api/v2/meta/bases/:baseId/users/:userId/resend-invite',
  ])
  // 设置 HTTP 状态码为 200
  @HttpCode(200)
  // 使用访问控制装饰器
  @Acl('baseUserInviteResend')
  async baseUserInviteResend(
    @TenantContext() context: NcContext,
    @Param('baseId') baseId: string,
    @Param('userId') userId: string,
    @Req() req: NcRequest,
    @Body() body: ProjectUserReqType,
  ): Promise<any> {
    // 调用服务重新发送邀请
    await this.baseUsersService.baseUserInviteResend(context, {
      baseId: baseId,
      userId: userId,
      baseUser: body,
      req,
    });
    // 返回成功消息
    return {
      msg: 'The invitation has been sent to the user',
    };
  }

  // 更新用户元数据的路由
  @Patch([
    '/api/v1/db/meta/projects/:baseId/user',
    '/api/v2/meta/bases/:baseId/user',
  ])
  // 使用访问控制装饰器
  @Acl('baseUserMetaUpdate')
  async baseUserMetaUpdate(
    @TenantContext() context: NcContext,
    @Param('baseId') baseId: string,
    @Req() req: NcRequest,
    @Body() body: ProjectUserReqType,
  ): Promise<any> {
    // 调用服务更新用户元数据
    return await this.baseUsersService.baseUserMetaUpdate(context, {
      baseId,
      body,
      user: req.user,
      req,
    });
  }
}
