// 导入 NestJS 的 Injectable 装饰器，用于标记该服务可被依赖注入
import { Injectable } from '@nestjs/common';
// 导入应用事件、角色提取函数和组织用户角色枚举
import { AppEvents, extractRolesObj, OrgUserRoles } from 'nocodb-sdk';
// 导入 User 类型
import type { User } from '~/models';
// 导入 API 令牌请求类型
import type { ApiTokenReqType } from 'nocodb-sdk';
// 导入 NcRequest 类型，用于处理请求
import type { NcRequest } from '~/interface/config';
// 导入应用钩子服务，用于触发事件
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
// 导入错误处理工具
import { NcError } from '~/helpers/catchError';
// 导入负载验证工具
import { validatePayload } from '~/helpers';
// 导入 ApiToken 模型
import { ApiToken } from '~/models';

// 使用 Injectable 装饰器标记该类为可注入服务
@Injectable()
// 定义 API 令牌服务类
export class ApiTokensService {
  // 构造函数，注入 AppHooksService 服务
  constructor(protected readonly appHooksService: AppHooksService) {}

  // 获取用户的 API 令牌列表
  async apiTokenList(param: { userId: string }) {
    // 调用 ApiToken 模型的 list 方法获取指定用户的所有令牌
    return await ApiToken.list(param.userId);
  }

  // 创建新的 API 令牌
  async apiTokenCreate(param: {
    userId: string;
    tokenBody: ApiTokenReqType;
    req: NcRequest;
  }) {
    // 验证请求体是否符合 API 令牌请求的 schema 定义
    validatePayload(
      'swagger.json#/components/schemas/ApiTokenReq',
      param.tokenBody,
    );
    // 插入新的 API 令牌记录，包含请求体内容和用户 ID
    const token = await ApiToken.insert({
      ...param.tokenBody,
      fk_user_id: param.userId,
    });

    // 触发 API 令牌创建事件
    this.appHooksService.emit(AppEvents.API_TOKEN_CREATE, {
      userId: param.userId,
      tokenTitle: param.tokenBody.description,
      tokenId: token.id,
      req: param.req,
    });

    // 返回创建的令牌
    return token;
  }

  // 删除 API 令牌
  async apiTokenDelete(param: { tokenId: string; user: User; req: NcRequest }) {
    // 获取指定 ID 的 API 令牌
    const apiToken = await ApiToken.get(param.tokenId);
    // 检查用户权限：如果不是超级管理员且令牌不属于当前用户，则抛出"未找到令牌"错误
    if (
      !extractRolesObj(param.user.roles)[OrgUserRoles.SUPER_ADMIN] &&
      apiToken.fk_user_id !== param.user.id
    ) {
      NcError.notFound('Token not found');
    }

    // 触发 API 令牌删除事件
    this.appHooksService.emit(AppEvents.API_TOKEN_DELETE, {
      userId: param.user?.id,
      tokenId: apiToken.id,
      tokenTitle: apiToken.description,
      req: param.req,
    });

    // TODO: 验证令牌是否属于用户
    // 删除指定 ID 的 API 令牌并返回结果
    return await ApiToken.delete(param.tokenId);
  }
}
