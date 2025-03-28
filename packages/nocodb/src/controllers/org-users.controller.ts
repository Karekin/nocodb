// 导入所需的 NestJS 装饰器和工具
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
  Request,
  UseGuards,
} from '@nestjs/common';
// 导入组织用户角色枚举
import { OrgUserRoles } from 'nocodb-sdk';
// This service is overwritten entirely in the cloud and does not extend there.
// As a result, it refers to services from OSS to avoid type mismatches.
// 导入组织用户服务
import { OrgUsersService } from 'src/services/org-users.service';
// 导入全局守卫
import { GlobalGuard } from '~/guards/global/global.guard';
// 导入分页响应实现类
import { PagedResponseImpl } from '~/helpers/PagedResponse';
// 导入用户模型
import { User } from '~/models';
// 导入访问控制列表中间件
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
// 导入元API限制器守卫
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
// 导入NocoDB请求接口
import { NcRequest } from '~/interface/config';

// 声明控制器
@Controller()
// 使用元API限制器守卫和全局守卫
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class OrgUsersController {
  // 构造函数，注入组织用户服务
  constructor(protected readonly orgUsersService: OrgUsersService) {}

  // 获取用户列表的API端点
  @Get('/api/v1/users')
  // 访问控制设置，仅允许超级管理员访问，阻止API令牌访问
  @Acl('userList', {
    scope: 'org',
    allowedRoles: [OrgUserRoles.SUPER_ADMIN],
    blockApiTokenAccess: true,
  })
  // 用户列表方法
  async userList(@Req() req: NcRequest) {
    // 返回分页响应，包含用户列表和计数信息
    return new PagedResponseImpl(
      await this.orgUsersService.userList({
        query: req.query,
      }),
      {
        ...req.query,
        // todo: fix - wrong count
        // 获取用户总数
        count: await User.count(req.query),
      },
    );
  }

  // 更新用户信息的API端点
  @Patch('/api/v1/users/:userId')
  // 访问控制设置，仅允许超级管理员访问，阻止API令牌访问
  @Acl('userUpdate', {
    scope: 'org',
    allowedRoles: [OrgUserRoles.SUPER_ADMIN],
    blockApiTokenAccess: true,
  })
  // 用户更新方法
  async userUpdate(
    // 请求体参数
    @Body() body,
    // 用户ID参数
    @Param('userId') userId: string,
    // 请求对象
    @Request() req: NcRequest,
  ) {
    // 调用服务更新用户并返回结果
    return await this.orgUsersService.userUpdate({
      user: body,
      userId,
      req,
    });
  }

  // 删除用户的API端点
  @Delete('/api/v1/users/:userId')
  // 访问控制设置，仅允许超级管理员访问，阻止API令牌访问
  @Acl('userDelete', {
    scope: 'org',
    allowedRoles: [OrgUserRoles.SUPER_ADMIN],
    blockApiTokenAccess: true,
  })
  // 用户删除方法
  async userDelete(@Param('userId') userId: string) {
    // 调用服务删除用户
    await this.orgUsersService.userDelete({
      userId,
    });
    // 返回成功消息
    return { msg: 'The user has been deleted successfully' };
  }

  // 添加用户的API端点
  @Post('/api/v1/users')
  // 设置HTTP状态码为200
  @HttpCode(200)
  // 访问控制设置，仅允许超级管理员访问，阻止API令牌访问
  @Acl('userAdd', {
    scope: 'org',
    allowedRoles: [OrgUserRoles.SUPER_ADMIN],
    blockApiTokenAccess: true,
  })
  // 用户添加方法
  async userAdd(@Body() body, @Req() req: NcRequest) {
    // 调用服务添加用户
    const result = await this.orgUsersService.userAdd({
      user: req.body,
      req,
    });

    // 返回添加结果
    return result;
  }

  // 用户设置的API端点
  @Post('/api/v1/users/settings')
  // 设置HTTP状态码为200
  @HttpCode(200)
  // 访问控制设置，仅允许超级管理员访问，阻止API令牌访问
  @Acl('userSettings', {
    scope: 'org',
    allowedRoles: [OrgUserRoles.SUPER_ADMIN],
    blockApiTokenAccess: true,
  })
  // 用户设置方法
  async userSettings(@Body() body): Promise<any> {
    // 调用服务更新用户设置
    await this.orgUsersService.userSettings(body);
    // 返回空对象
    return {};
  }

  // 重新发送用户邀请的API端点
  @Post('/api/v1/users/:userId/resend-invite')
  // 设置HTTP状态码为200
  @HttpCode(200)
  // 访问控制设置，仅允许超级管理员访问，阻止API令牌访问
  @Acl('userInviteResend', {
    scope: 'org',
    allowedRoles: [OrgUserRoles.SUPER_ADMIN],
    blockApiTokenAccess: true,
  })
  // 重新发送用户邀请方法
  async userInviteResend(
    // 请求对象
    @Req() req: NcRequest,
    // 用户ID参数
    @Param('userId') userId: string,
  ): Promise<any> {
    // 调用服务重新发送邀请
    await this.orgUsersService.userInviteResend({
      userId,
      req,
    });

    // 返回成功消息
    return { msg: 'The invitation has been sent to the user' };
  }

  // 生成重置URL的API端点
  @Post('/api/v1/users/:userId/generate-reset-url')
  // 设置HTTP状态码为200
  @HttpCode(200)
  // 访问控制设置，仅允许超级管理员访问，阻止API令牌访问
  @Acl('generateResetUrl', {
    scope: 'org',
    allowedRoles: [OrgUserRoles.SUPER_ADMIN],
    blockApiTokenAccess: true,
  })
  // 生成重置URL方法
  async generateResetUrl(
    // 请求对象
    @Req() req: NcRequest,
    // 用户ID参数
    @Param('userId') userId: string,
  ) {
    // 调用服务生成重置URL
    const result = await this.orgUsersService.generateResetUrl({
      siteUrl: req.ncSiteUrl,
      userId,
    });

    // 返回生成结果
    return result;
  }

  // 获取应用设置的API端点
  @Get('/api/v1/app-settings')
  // 访问控制设置，仅允许超级管理员访问，阻止API令牌访问
  @Acl('appSettingsGet', {
    scope: 'org',
    allowedRoles: [OrgUserRoles.SUPER_ADMIN],
    blockApiTokenAccess: true,
  })
  // 获取应用设置方法
  async appSettingsGet() {
    // 调用服务获取应用设置
    const settings = await this.orgUsersService.appSettingsGet();
    // 返回设置
    return settings;
  }

  // 设置应用设置的API端点
  @Post('/api/v1/app-settings')
  // 设置HTTP状态码为200
  @HttpCode(200)
  // 访问控制设置，仅允许超级管理员访问，阻止API令牌访问
  @Acl('appSettingsSet', {
    scope: 'org',
    allowedRoles: [OrgUserRoles.SUPER_ADMIN],
    blockApiTokenAccess: true,
  })
  // 设置应用设置方法
  async appSettingsSet(@Body() body) {
    // 调用服务设置应用设置
    await this.orgUsersService.appSettingsSet({
      settings: body,
    });

    // 返回成功消息
    return { msg: 'The app settings have been saved' };
  }
}
