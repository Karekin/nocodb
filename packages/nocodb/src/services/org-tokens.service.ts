// 导入 NestJS 的 Injectable 装饰器，用于依赖注入
import { Injectable } from '@nestjs/common';
// 导入 nocodb-sdk 中的事件、角色提取和组织用户角色相关功能
import { AppEvents, extractRolesObj, OrgUserRoles } from 'nocodb-sdk';
// 导入 User 类型定义
import type { User } from '~/models';
// 导入 API 令牌请求类型定义
import type { ApiTokenReqType } from 'nocodb-sdk';
// 导入 NcRequest 类型定义，用于处理请求
import type { NcRequest } from '~/interface/config';
// 导入应用钩子服务，用于事件触发
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
// 导入验证负载的辅助函数
import { validatePayload } from '~/helpers';
// 导入错误处理类
import { NcError } from '~/helpers/catchError';
// 导入分页响应实现类
import { PagedResponseImpl } from '~/helpers/PagedResponse';
// 导入 ApiToken 模型
import { ApiToken } from '~/models';

// 使用 Injectable 装饰器标记该服务可被注入
@Injectable()
export class OrgTokensService {
  // 构造函数，注入 AppHooksService 服务
  constructor(protected readonly appHooksService: AppHooksService) {}

  /**
   * 获取 API 令牌列表
   * @param param 包含用户信息和查询参数的对象
   * @returns 分页的 API 令牌列表
   */
  async apiTokenList(param: { user: User; query: any }) {
    // 获取用户 ID
    const fk_user_id = param.user.id;
    // 默认不包含未映射的令牌
    let includeUnmappedToken = false;
    // 如果用户是超级管理员，则包含未映射的令牌
    if (extractRolesObj(param.user.roles)[OrgUserRoles.SUPER_ADMIN]) {
      includeUnmappedToken = true;
    }

    // 返回分页响应，包含令牌列表和计数信息
    return new PagedResponseImpl(
      // 获取带创建者信息的令牌列表
      await ApiToken.listWithCreatedBy({
        ...param.query,
        fk_user_id,
        includeUnmappedToken,
      }),
      {
        ...param.query,
        // 获取符合条件的令牌总数
        count: await ApiToken.count({
          includeUnmappedToken,
          fk_user_id,
        }),
      },
    );
  }

  /**
   * 创建 API 令牌
   * @param param 包含用户信息、令牌数据和请求对象的参数
   * @returns 创建的 API 令牌
   */
  async apiTokenCreate(param: {
    user: User;
    apiToken: ApiTokenReqType;
    req: NcRequest;
  }) {
    // 验证请求负载是否符合 API 令牌请求的 schema
    validatePayload(
      'swagger.json#/components/schemas/ApiTokenReq',
      param.apiToken,
    );

    // 插入 API 令牌记录，关联到当前用户
    const apiToken = await ApiToken.insert({
      ...param.apiToken,
      fk_user_id: param['user'].id,
    });

    // 触发组织 API 令牌创建事件
    this.appHooksService.emit(AppEvents.ORG_API_TOKEN_CREATE, {
      tokenTitle: apiToken.description,
      userId: param.user?.id,
      tokenId: apiToken.id,
      req: param.req,
    });

    // 返回创建的令牌
    return apiToken;
  }

  /**
   * 删除 API 令牌
   * @param param 包含用户信息、令牌 ID 和请求对象的参数
   * @returns 删除操作的结果
   */
  async apiTokenDelete(param: { user: User; tokenId: string; req: NcRequest }) {
    // 获取用户 ID
    const fk_user_id = param.user.id;
    // 获取要删除的令牌信息
    const apiToken = await ApiToken.get(param.tokenId);
    // 如果用户不是超级管理员且令牌不属于该用户，则抛出"未找到令牌"错误
    if (
      !extractRolesObj(param.user.roles)[OrgUserRoles.SUPER_ADMIN] &&
      apiToken.fk_user_id !== fk_user_id
    ) {
      NcError.notFound('Token not found');
    }
    // 删除令牌
    const res = await ApiToken.delete(param.tokenId);

    // 触发组织 API 令牌删除事件
    this.appHooksService.emit(AppEvents.ORG_API_TOKEN_DELETE, {
      tokenId: param.tokenId,
      tokenTitle: apiToken.description,
      userId: param.user?.id,
      req: param['req'],
    });

    // 返回删除操作的结果
    return res;
  }
}
