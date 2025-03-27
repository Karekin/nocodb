// 导入 NestJS 的 Injectable 装饰器，用于依赖注入
import { Injectable } from '@nestjs/common';
// 导入 nocodb-sdk 中的相关工具和类型
import {
  AppEvents, // 应用事件枚举
  extractRolesObj, // 提取角色对象的工具函数
  OrgUserRoles, // 组织用户角色枚举
  PluginCategory, // 插件类别枚举
} from 'nocodb-sdk';
// 导入 uuid 库，用于生成唯一标识符
import { v4 as uuidv4 } from 'uuid';
// 导入 validator 库，用于验证邮箱等数据
import validator from 'validator';
// 导入 UserType 类型定义
import type { UserType } from 'nocodb-sdk';
// 导入请求接口类型
import type { NcRequest } from '~/interface/config';
// 导入相关服务
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { BaseUsersService } from '~/services/base-users/base-users.service';
import { MailService } from '~/services/mail/mail.service';
// 导入应用设置常量
import { NC_APP_SETTINGS } from '~/constants';
// 导入辅助函数
import { validatePayload } from '~/helpers';
import { NcError } from '~/helpers/catchError';
import { extractProps } from '~/helpers/extractProps';
import { randomTokenString } from '~/helpers/stringHelpers';
// 导入数据模型
import { BaseUser, PresignedUrl, Store, SyncSource, User } from '~/models';

import Noco from '~/Noco';
// 导入全局常量
import { MetaTable, RootScopes } from '~/utils/globals';
// 导入邮件事件枚举
import { MailEvent } from '~/interface/Mail';

// 使用 Injectable 装饰器标记该服务可被注入
@Injectable()
export class OrgUsersService {
  // 构造函数，注入依赖的服务
  constructor(
    protected readonly baseUsersService: BaseUsersService,
    protected readonly appHooksService: AppHooksService,
    protected readonly mailService: MailService,
  ) {}

  /**
   * 获取用户列表
   * @param param 包含查询参数的对象
   * @returns 返回用户列表
   */
  async userList(param: {
    // todo: add better typing
    query: Record<string, any>;
  }) {
    // 获取用户列表
    const users = await User.list(param.query);

    // 为用户头像签名预签名URL
    await PresignedUrl.signMetaIconImage(users);

    return users;
  }

  /**
   * 更新用户信息
   * @param param 包含用户信息、用户ID和请求对象的参数
   * @returns 返回更新后的用户信息
   */
  async userUpdate(param: {
    // todo: better typing
    user: Partial<UserType>;
    userId: string;
    req: NcRequest;
  }) {
    // 验证请求负载是否符合规范
    validatePayload('swagger.json#/components/schemas/OrgUserReq', param.user);

    // 提取用户角色属性
    const updateBody = extractProps(param.user, ['roles']);

    // 获取用户信息
    const user = await User.get(param.userId);

    // 如果是超级管理员，则不允许更新角色
    if (extractRolesObj(user.roles)[OrgUserRoles.SUPER_ADMIN]) {
      NcError.badRequest('Cannot update super admin roles');
    }

    // 发送角色更新邮件通知
    await this.mailService.sendMail({
      mailEvent: MailEvent.ORGANIZATION_ROLE_UPDATE,
      payload: {
        req: param.req,
        user,
        newRole: param.user.roles as OrgUserRoles,
        oldRole: user.roles as OrgUserRoles,
      },
    });

    // 更新用户信息并返回
    return await User.update(param.userId, {
      ...updateBody,
    });
  }

  /**
   * 删除用户
   * @param param 包含用户ID的参数对象
   * @returns 返回操作结果
   */
  async userDelete(param: { userId: string }) {
    // 开始事务
    const ncMeta = await Noco.ncMeta.startTransaction();
    try {
      // 获取用户信息
      const user = await User.get(param.userId, ncMeta);

      // 如果是超级管理员，则不允许删除
      if (extractRolesObj(user.roles)[OrgUserRoles.SUPER_ADMIN]) {
        NcError.badRequest('Cannot delete super admin');
      }

      // 获取用户关联的项目列表
      const baseUsers = await BaseUser.getProjectsIdList(param.userId, ncMeta);

      // todo: clear cache

      // TODO: assign super admin as base owner
      // 删除用户与项目的关联
      for (const baseUser of baseUsers) {
        await BaseUser.delete(
          {
            workspace_id: baseUser.fk_workspace_id,
            base_id: baseUser.base_id,
          },
          baseUser.base_id,
          baseUser.fk_user_id,
          ncMeta,
        );
      }

      // 删除用户的同步源条目
      await SyncSource.deleteByUserId(param.userId, ncMeta);

      // 删除用户
      await User.delete(param.userId, ncMeta);
      // 提交事务
      await ncMeta.commit();
    } catch (e) {
      // 发生错误时回滚事务
      await ncMeta.rollback(e);
      throw e;
    }

    return true;
  }

  /**
   * 添加用户
   * @param param 包含用户信息和请求对象的参数
   * @returns 返回操作结果
   */
  async userAdd(param: {
    user: UserType;
    // todo: refactor
    req: NcRequest;
  }) {
    // 验证请求负载是否符合规范
    validatePayload('swagger.json#/components/schemas/OrgUserReq', param.user);

    // 只允许查看者或创建者角色
    if (
      param.user.roles &&
      ![OrgUserRoles.VIEWER, OrgUserRoles.CREATOR].includes(
        param.user.roles as OrgUserRoles,
      )
    ) {
      NcError.badRequest('Invalid role');
    }

    // 从请求体中提取邮箱，支持多个邮箱用逗号分隔
    const emails = (param.user.email || '')
      .toLowerCase()
      .split(/\s*,\s*/)
      .map((v) => v.trim());

    // 检查无效的邮箱
    const invalidEmails = emails.filter((v) => !validator.isEmail(v));

    // 如果没有邮箱，返回错误
    if (!emails.length) {
      return NcError.badRequest('Invalid email address');
    }
    // 如果有无效邮箱，返回错误
    if (invalidEmails.length) {
      NcError.badRequest('Invalid email address : ' + invalidEmails.join(', '));
    }

    // 生成邀请令牌
    const invite_token = uuidv4();
    const error = [];

    // 遍历处理每个邮箱
    for (const email of emails) {
      // 检查用户是否已存在
      let user = await User.getByEmail(email);

      if (user) {
        NcError.badRequest('User already exist');
      } else {
        try {
          // 创建带有邀请令牌的新用户
          user = await User.insert({
            invite_token,
            invite_token_expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24小时后过期
            email,
            roles: param.user.roles || OrgUserRoles.VIEWER, // 默认为查看者角色
            token_version: randomTokenString(),
          });

          // 获取用户总数
          const count = await User.count();

          // 触发用户邀请事件
          this.appHooksService.emit(AppEvents.ORG_USER_INVITE, {
            user,
            count,
            req: param.req,
          });

          // 单个用户情况下，检查SMTP失败
          // 如果失败则返回令牌
          if (emails.length === 1) {
            try {
              const res = await this.mailService.sendMail({
                mailEvent: MailEvent.ORGANIZATION_INVITE,
                payload: {
                  user,
                  req: param.req,
                  token: invite_token,
                },
              });

              if (!res) {
                return { invite_token, email };
              }
            } catch (e) {
              return { invite_token, email };
            }
          } else {
            // 多个用户情况下发送邮件
            await this.mailService.sendMail({
              mailEvent: MailEvent.ORGANIZATION_INVITE,
              payload: {
                user,
                req: param.req,
                token: invite_token,
              },
            });
          }
        } catch (e) {
          console.log(e);
          // 单个用户出错时直接抛出异常
          if (emails.length === 1) {
            throw e;
          } else {
            // 多个用户时记录错误
            error.push({ email, error: e.message });
          }
        }
      }
    }

    // 根据邮箱数量返回不同的结果
    if (emails.length === 1) {
      return {
        msg: 'success',
      };
    } else {
      return { invite_token, emails, error };
    }
  }

  /**
   * 获取用户设置
   * @param _param 参数对象
   * @returns 返回用户设置
   */
  async userSettings(_param): Promise<any> {
    // 未实现的方法
    NcError.notImplemented();
  }

  /**
   * 重新发送用户邀请
   * @param param 包含用户ID和请求对象的参数
   * @returns 返回操作结果
   */
  async userInviteResend(param: {
    userId: string;
    req: NcRequest;
  }): Promise<any> {
    // 获取用户信息
    const user = await User.get(param.userId);

    // 如果用户不存在，抛出错误
    if (!user) {
      NcError.userNotFound(param.userId);
    }

    // 生成新的邀请令牌
    const invite_token = uuidv4();

    // 更新用户的邀请令牌和过期时间
    await User.update(user.id, {
      invite_token,
      invite_token_expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24小时后过期
    });

    // 检查是否有活跃的邮件插件
    const pluginData = await Noco.ncMeta.metaGet2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.PLUGIN,
      {
        category: PluginCategory.EMAIL,
        active: true,
      },
    );

    // 如果没有邮件插件，返回错误
    if (!pluginData) {
      NcError.badRequest(
        `No Email Plugin is found. Please go to App Store to configure first or copy the invitation URL to users instead.`,
      );
    }

    // 发送邀请邮件
    await this.mailService.sendMail({
      mailEvent: MailEvent.ORGANIZATION_INVITE,
      payload: {
        user,
        req: param.req,
        token: invite_token,
      },
    });

    // 触发重新发送邀请事件
    this.appHooksService.emit(AppEvents.ORG_USER_RESEND_INVITE, {
      user: user as UserType,
      req: param.req,
    });

    return true;
  }

  /**
   * 生成重置密码URL
   * @param param 包含用户ID和站点URL的参数
   * @returns 返回重置令牌和URL
   */
  async generateResetUrl(param: { userId: string; siteUrl: string }) {
    // 获取用户信息
    const user = await User.get(param.userId);

    // 如果用户不存在，抛出错误
    if (!user) {
      NcError.userNotFound(param.userId);
    }
    // 生成重置令牌
    const token = uuidv4();
    // 更新用户的重置令牌和过期时间
    await User.update(user.id, {
      email: user.email,
      reset_password_token: token,
      reset_password_expires: new Date(Date.now() + 60 * 60 * 1000), // 1小时后过期
      token_version: randomTokenString(),
    });

    // 返回重置令牌和URL
    return {
      reset_password_token: token,
      reset_password_url: param.siteUrl + `/dashboard/#/reset/${token}`,
    };
  }

  /**
   * 获取应用设置
   * @returns 返回应用设置
   */
  async appSettingsGet() {
    let settings = {};
    try {
      // 尝试从存储中获取应用设置并解析JSON
      settings = JSON.parse((await Store.get(NC_APP_SETTINGS))?.value);
    } catch {}
    return settings;
  }

  /**
   * 设置应用设置
   * @param param 包含设置的参数对象
   * @returns 返回操作结果
   */
  async appSettingsSet(param: { settings: any }) {
    // 保存或更新应用设置
    await Store.saveOrUpdate({
      value: JSON.stringify(param.settings),
      key: NC_APP_SETTINGS,
    });
    return true;
  }
}
