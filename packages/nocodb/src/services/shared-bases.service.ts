// 导入必要的依赖
import { Injectable } from '@nestjs/common'; // 导入NestJS的Injectable装饰器，用于依赖注入
import { AppEvents } from 'nocodb-sdk'; // 导入应用事件枚举
import { v4 as uuidv4 } from 'uuid'; // 导入UUID生成函数
import { ConfigService } from '@nestjs/config'; // 导入配置服务
import type { AppConfig, NcContext, NcRequest } from '~/interface/config'; // 导入类型定义
import { AppHooksService } from '~/services/app-hooks/app-hooks.service'; // 导入应用钩子服务
import { validatePayload } from '~/helpers'; // 导入负载验证辅助函数
import { NcError } from '~/helpers/catchError'; // 导入错误处理辅助类
import { Base, CustomUrl } from '~/models'; // 导入数据模型

// todo: 从配置中加载
// 定义配置对象，包含仪表盘路径
const config = {
  dashboardPath: '/nc',
};

@Injectable() // 标记为可注入的服务
export class SharedBasesService {
  constructor(
    private readonly appHooksService: AppHooksService, // 注入应用钩子服务
    private configService: ConfigService<AppConfig>, // 注入配置服务
  ) {}

  /**
   * 创建共享基地链接
   * @param context - NocoDB上下文
   * @param param - 包含创建共享链接所需参数的对象
   * @returns 返回创建的共享链接数据
   */
  async createSharedBaseLink(
    context: NcContext,
    param: {
      baseId: string; // 基地ID
      roles: string; // 角色权限
      password: string; // 访问密码
      siteUrl: string; // 站点URL

      req: NcRequest; // 请求对象
    },
  ): Promise<any> {
    // 验证请求负载是否符合API规范
    validatePayload('swagger.json#/components/schemas/SharedBaseReq', param);

    // 获取基地信息
    const base = await Base.get(context, param.baseId);

    // 处理角色参数，如果未提供或无效，默认为viewer（查看者）
    let roles = param?.roles;
    if (!roles || (roles !== 'editor' && roles !== 'viewer')) {
      roles = 'viewer';
    }

    // 如果角色为editor（编辑者），抛出错误，因为目前只支持viewer角色
    if (roles === 'editor') {
      NcError.badRequest('Only viewer role is supported');
    }

    // 如果基地不存在，抛出错误
    if (!base) {
      NcError.baseNotFound(param.baseId);
    }

    // 准备要更新的数据
    const data: any = {
      uuid: uuidv4(), // 生成新的UUID
      password: param?.password, // 设置密码
      roles, // 设置角色
    };

    // 更新基地信息
    await Base.update(context, base.id, data);

    // 获取共享链接URL
    data.url = this.getUrl({
      base,
      siteUrl: param.siteUrl,
    });

    // 从返回数据中删除密码
    delete data.password;

    // 触发共享基地生成链接事件
    this.appHooksService.emit(AppEvents.SHARED_BASE_GENERATE_LINK, {
      link: data.url,
      base,
      req: param.req,
      uuid: data.uuid,
      sharedBaseRole: roles,
      context: {
        ...context,
      },
    });

    // 返回创建的共享链接数据
    return data;
  }

  /**
   * 更新共享基地链接
   * @param context - NocoDB上下文
   * @param param - 包含更新共享链接所需参数的对象
   * @returns 返回更新后的共享链接数据
   */
  async updateSharedBaseLink(
    context: NcContext,
    param: {
      baseId: string; // 基地ID
      roles: string; // 角色权限
      password: string; // 访问密码
      siteUrl: string; // 站点URL
      req: NcRequest; // 请求对象
      custom_url_path?: string; // 自定义URL路径（可选）
    },
  ): Promise<any> {
    // 验证请求负载是否符合API规范
    validatePayload('swagger.json#/components/schemas/SharedBaseReq', param);

    // 获取基地信息
    const base = await Base.get(context, param.baseId);

    // 处理角色参数，如果未提供或无效，默认为viewer（查看者）
    let roles = param.roles;
    if (!roles || (roles !== 'editor' && roles !== 'viewer')) {
      roles = 'viewer';
    }

    // 如果基地不存在，抛出错误
    if (!base) {
      NcError.baseNotFound(param.baseId);
    }

    // 如果是云环境且角色为editor，抛出错误
    if (roles === 'editor' && process.env.NC_CLOUD === 'true') {
      NcError.badRequest('Only viewer role is supported');
    }

    // 获取现有的自定义URL（如果存在）
    let customUrl: CustomUrl | undefined = base.fk_custom_url_id
      ? await CustomUrl.get({
          id: base.fk_custom_url_id,
        })
      : undefined;

    // 如果存在自定义URL，则更新它
    if (customUrl?.id) {
      const original_path = `/base/${base.uuid}`;

      if (param.custom_url_path) {
        // 准备有条件地更新的字段
        const updates: Partial<CustomUrl> = {
          original_path,
        };

        if (param.custom_url_path !== undefined) {
          updates.custom_path = param.custom_url_path;
        }

        // 如果有变更，执行更新
        if (Object.keys(updates).length > 0) {
          await CustomUrl.update(base.fk_custom_url_id, updates);
        }
      } else if (param.custom_url_path !== undefined) {
        // 如果自定义路径为undefined，删除自定义URL
        await CustomUrl.delete({ id: base.fk_custom_url_id as string });
        customUrl = undefined;
      }
    } else if (param.custom_url_path) {
      // 如果不存在自定义URL但提供了自定义路径，则创建新的自定义URL

      const original_path = `/base/${base.uuid}`;

      customUrl = await CustomUrl.insert({
        fk_workspace_id: base.fk_workspace_id,
        base_id: base.id,
        original_path,
        custom_path: param.custom_url_path,
      });
    }

    // 准备要更新的数据
    const data: any = {
      uuid: base.uuid || uuidv4(), // 使用现有UUID或生成新的
      password: param.password, // 设置密码
      roles, // 设置角色
      fk_custom_url_id: customUrl?.id ?? null, // 设置自定义URL ID
    };

    // 更新基地信息
    await Base.update(context, base.id, data);

    // 获取共享链接URL
    data.url = this.getUrl({
      base,
      siteUrl: param.siteUrl,
    });

    // 从返回数据中删除密码
    delete data.password;

    // 触发共享基地生成链接事件
    this.appHooksService.emit(AppEvents.SHARED_BASE_GENERATE_LINK, {
      link: data.url,
      base,
      req: param.req,
      sharedBaseRole: roles,
      context,
      uuid: data.uuid,
      customUrl,
    });

    // 返回更新后的共享链接数据
    return data;
  }

  /**
   * 获取共享基地的URL
   * @param base - 基地对象
   * @param _siteUrl - 站点URL
   * @returns 返回完整的共享基地URL
   * @private
   */
  private getUrl({ base, siteUrl: _siteUrl }: { base: Base; siteUrl: string }) {
    let siteUrl = _siteUrl;

    // 获取基地域名环境变量
    const baseDomain = process.env.NC_BASE_HOST_NAME;
    // 从配置服务获取仪表盘路径
    const dashboardPath = this.configService.get('dashboardPath', {
      infer: true,
    });

    // 如果设置了基地域名，构建特定的URL格式
    if (baseDomain) {
      siteUrl = `https://${base['fk_workspace_id']}.${baseDomain}${dashboardPath}`;
    }

    // 返回完整的URL
    return `${siteUrl}${config.dashboardPath}#/base/${base.uuid}`;
  }

  /**
   * 禁用共享基地链接
   * @param context - NocoDB上下文
   * @param param - 包含禁用共享链接所需参数的对象
   * @returns 返回禁用后的状态
   */
  async disableSharedBaseLink(
    context: NcContext,
    param: {
      baseId: string; // 基地ID
      req: NcRequest; // 请求对象
    },
  ): Promise<any> {
    // 获取基地信息
    const base = await Base.get(context, param.baseId);

    // 如果基地不存在，抛出错误
    if (!base) {
      NcError.baseNotFound(param.baseId);
    }

    // 准备要更新的数据，将UUID和自定义URL ID设为null
    const data: any = {
      uuid: null,
      fk_custom_url_id: null,
    };

    // 更新基地信息
    await Base.update(context, base.id, data);

    // 如果存在自定义URL，删除它
    if (base.fk_custom_url_id) {
      await CustomUrl.delete({ id: base.fk_custom_url_id });
    }

    // 触发共享基地删除链接事件
    this.appHooksService.emit(AppEvents.SHARED_BASE_DELETE_LINK, {
      base,
      req: param.req,
      context,
      uuid: base.uuid,
    });

    // 返回禁用后的状态
    return { uuid: null };
  }

  /**
   * 获取共享基地链接
   * @param context - NocoDB上下文
   * @param param - 包含获取共享链接所需参数的对象
   * @returns 返回共享链接数据
   */
  async getSharedBaseLink(
    context: NcContext,
    param: {
      baseId: string; // 基地ID
      siteUrl: string; // 站点URL
    },
  ): Promise<any> {
    // 获取基地信息
    const base = await Base.get(context, param.baseId);

    // 如果基地不存在，抛出错误
    if (!base) {
      NcError.baseNotFound(param.baseId);
    }

    // 准备返回数据
    const data: any = {
      uuid: base.uuid,
      roles: base.roles,
      fk_custom_url_id: base.fk_custom_url_id,
    };

    // 如果存在UUID，构建完整URL
    if (data.uuid)
      data.url = `${param.siteUrl}${config.dashboardPath}#/base/${data.shared_base_id}`;

    // 返回共享链接数据
    return data;
  }
}
