/**
 * 导入必要的依赖
 */
import { Injectable } from '@nestjs/common'; // 导入NestJS的Injectable装饰器，用于依赖注入
import { extractRolesObj, OrgUserRoles } from 'nocodb-sdk'; // 导入角色提取函数和组织用户角色枚举
import type { UserType } from 'nocodb-sdk'; // 导入用户类型接口
import { PagedResponseImpl } from '~/helpers/PagedResponse'; // 导入分页响应实现类
import { ApiToken } from '~/models'; // 导入API令牌模型

/**
 * 组织令牌企业版服务
 * 该服务处理与组织API令牌相关的企业版功能
 */
@Injectable()
export class OrgTokensEeService {
  /**
   * 获取API令牌列表（企业版功能）
   *
   * @param param 包含用户信息和查询参数的对象
   * @param param.user 当前用户信息
   * @param param.query 查询参数
   * @returns 返回分页的API令牌列表
   */
  async apiTokenListEE(param: { user: UserType; query: any }) {
    // 默认情况下，只获取当前用户的令牌
    let fk_user_id = param.user.id;

    // 如果用户是超级管理员，则获取所有令牌
    if (extractRolesObj(param.user.roles)[OrgUserRoles.SUPER_ADMIN]) {
      fk_user_id = undefined; // 将用户ID设为undefined以获取所有令牌
    }

    // 返回分页响应，包含API令牌列表和分页信息
    return new PagedResponseImpl(
      // 获取带有创建者信息的API令牌列表
      await ApiToken.listWithCreatedBy({ ...param.query, fk_user_id }),
      {
        // 合并查询参数
        ...(param.query || {}),
        // 获取API令牌总数
        count: await ApiToken.count({}),
      },
    );
  }
}
