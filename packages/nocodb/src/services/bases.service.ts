// 导入 Node.js util 模块中的 promisify 函数，用于将回调函数转换为 Promise
import { promisify } from 'util';
// 导入 NestJS 的 Injectable 装饰器，用于标记服务类可被依赖注入
import { Injectable } from '@nestjs/common';
// 导入 DOMPurify 库，用于清理和过滤 HTML 内容，防止 XSS 攻击
import * as DOMPurify from 'isomorphic-dompurify';
// 导入 nanoid 库的 customAlphabet 函数，用于生成自定义字符集的唯一 ID
import { customAlphabet } from 'nanoid';
// 从 nocodb-sdk 导入多个工具和类型
import {
  AppEvents,
  extractRolesObj,
  IntegrationsType,
  OrgUserRoles,
  SqlUiFactory,
} from 'nocodb-sdk';
// 从 nocodb-sdk 导入类型定义
import type {
  ProjectReqType,
  ProjectUpdateReqType,
  UserType,
} from 'nocodb-sdk';
// 导入 Express 的 Request 类型
import type { Request } from 'express';
// 导入自定义的 NcContext 和 NcRequest 类型
import type { NcContext, NcRequest } from '~/interface/config';
// 导入应用钩子服务
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
// 导入辅助函数
import { populateMeta, validatePayload } from '~/helpers';
// 导入错误处理类
import { NcError } from '~/helpers/catchError';
// 导入属性提取和清理函数
import { extractPropsAndSanitize } from '~/helpers/extractProps';
// 导入同步迁移函数
import syncMigration from '~/helpers/syncMigration';
// 导入模型类
import { Base, BaseUser, Integration } from '~/models';
// 导入 Noco 主类
import Noco from '~/Noco';
// 导入工具目录获取函数
import { getToolDir } from '~/utils/nc-config';
// 导入元数据服务
import { MetaService } from '~/meta/meta.service';
// 导入全局常量
import { MetaTable, RootScopes } from '~/utils/globals';
// 导入表格服务
import { TablesService } from '~/services/tables.service';
// 导入元数据属性字符串化函数
import { stringifyMetaProp } from '~/utils/modelUtils';

// 创建一个自定义的 nanoid 生成器，使用指定字符集生成长度为 4 的 ID
const nanoid = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyz_', 4);

// 使用 Injectable 装饰器标记 BasesService 类可被依赖注入
@Injectable()
export class BasesService {
  // 构造函数，注入所需的服务
  constructor(
    // 注入应用钩子服务
    protected readonly appHooksService: AppHooksService,
    // 注入元数据服务
    protected metaService: MetaService,
    // 注入表格服务
    protected tablesService: TablesService,
  ) {}

  // 获取基地列表的方法
  async baseList(
    context: NcContext,
    param: {
      user: { id: string; roles?: string | Record<string, boolean> };
      query?: any;
    },
  ) {
    // 根据用户角色决定获取全部基地列表还是用户有权限的基地列表
    const bases = extractRolesObj(param.user?.roles)[OrgUserRoles.SUPER_ADMIN]
      ? await Base.list()
      : await BaseUser.getProjectsList(param.user.id, param.query);

    return bases;
  }

  // 获取单个项目的方法
  async getProject(context: NcContext, param: { baseId: string }) {
    // 根据基地 ID 获取基地信息
    const base = await Base.get(context, param.baseId);
    return base;
  }

  // 获取带有详细信息的项目
  async getProjectWithInfo(
    context: NcContext,
    param: { baseId: string; includeConfig?: boolean },
  ) {
    // 解构参数，设置默认值
    const { includeConfig = true } = param;
    // 获取带有详细信息的基地
    const base = await Base.getWithInfo(context, param.baseId, includeConfig);
    return base;
  }

  // 清理项目数据，移除敏感信息
  sanitizeProject(base: any) {
    // 创建基地的副本
    const sanitizedProject = { ...base };
    // 遍历所有数据源，删除配置信息
    sanitizedProject.sources?.forEach((b: any) => {
      ['config'].forEach((k) => delete b[k]);
    });
    return sanitizedProject;
  }

  // 更新基地信息的方法
  async baseUpdate(
    context: NcContext,
    param: {
      baseId: string;
      base: ProjectUpdateReqType;
      user: UserType;
      req: NcRequest;
    },
  ) {
    // 验证请求负载是否符合 Swagger 定义
    validatePayload(
      'swagger.json#/components/schemas/ProjectUpdateReq',
      param.base,
    );

    // 获取带有详细信息的基地
    const base = await Base.getWithInfo(context, param.baseId);

    // 如果包含 meta 属性，将其字符串化以便后续处理
    if ('meta' in param.base) {
      param.base.meta = stringifyMetaProp(param.base);
    }

    // 提取并清理更新数据中的指定属性
    const data: Partial<Base> = extractPropsAndSanitize(param?.base as Base, [
      'title',
      'meta',
      'color',
      'status',
      'order',
      'description',
    ]);
    // 验证项目标题是否有效
    await this.validateProjectTitle(context, data, base);

    // 确保 order 属性为数字类型
    if (data?.order !== undefined) {
      data.order = !isNaN(+data.order) ? +data.order : 0;
    }

    // 更新基地信息
    const result = await Base.update(context, param.baseId, data);

    // 触发项目更新事件
    this.appHooksService.emit(AppEvents.PROJECT_UPDATE, {
      base: {
        ...base,
        ...data,
      },
      updateObj: data,
      oldBaseObj: base,
      user: param.user,
      req: param.req,
      context,
    });

    return result;
  }

  // 验证项目标题是否有效的受保护方法
  protected async validateProjectTitle(
    context: NcContext,
    data: Partial<Base>,
    base: Base,
  ) {
    // 检查标题是否已更改且是否已被使用
    if (
      data?.title &&
      base.title !== data.title &&
      (await Base.getByTitle(
        {
          workspace_id: RootScopes.BASE,
          base_id: RootScopes.BASE,
        },
        data.title,
      ))
    ) {
      // 如果标题已被使用，抛出错误
      NcError.badRequest('Base title already in use');
    }
  }

  // 软删除基地的方法
  async baseSoftDelete(
    context: NcContext,
    param: { baseId: any; user: UserType; req: NcRequest },
  ) {
    // 获取带有详细信息的基地
    const base = await Base.getWithInfo(context, param.baseId);

    // 如果基地不存在，抛出错误
    if (!base) {
      NcError.baseNotFound(param.baseId);
    }

    // 执行软删除操作
    await Base.softDelete(context, param.baseId);

    // 触发项目删除事件
    this.appHooksService.emit(AppEvents.PROJECT_DELETE, {
      base,
      user: param.user,
      req: param.req,
      context,
    });

    return true;
  }

  // 创建基地的方法
  async baseCreate(
    param: { base: ProjectReqType; user: any; req: any },
    ncMeta = Noco.ncMeta,
  ) {
    // 验证请求负载是否符合 Swagger 定义
    validatePayload('swagger.json#/components/schemas/ProjectReq', param.base);

    // 生成基地 ID
    const baseId = await this.metaService.genNanoid(MetaTable.PROJECT);

    // 创建基地主体对象
    const baseBody: ProjectReqType & Record<string, any> = param.base;
    baseBody.id = baseId;

    // 如果不是外部基地，设置相关属性
    if (!baseBody.external) {
      // 生成随机 ID
      const ranId = nanoid();
      // 设置前缀
      baseBody.prefix = `nc_${ranId}__`;
      // 标记为元数据
      baseBody.is_meta = true;
      // 获取数据配置
      const dataConfig = await Noco.getConfig()?.meta?.db;

      // 如果是 PostgreSQL 且未禁用数据反射
      if (
        dataConfig?.client === 'pg' &&
        process.env.NC_DISABLE_PG_DATA_REFLECTION !== 'true'
      ) {
        // 清空前缀
        baseBody.prefix = '';
        // 设置数据源
        baseBody.sources = [
          {
            type: 'pg',
            is_local: true,
            is_meta: false,
            config: {
              schema: baseId,
            },
            inflection_column: 'camelize',
            inflection_table: 'camelize',
          },
        ];
      } else if (
        // 如果是 SQLite3 且启用了最小数据库模式
        dataConfig?.client === 'sqlite3' &&
        process.env.NC_MINIMAL_DBS === 'true'
      ) {
        // 如果环境变量 NC_MINIMAL_DBS 已设置，则为每个基地创建一个 SQLite 文件/连接
        // 每个文件将命名为 nc_<random_id>.db
        const fs = require('fs');
        // 获取工具目录
        const toolDir = getToolDir();
        // 创建自定义 nanoid 生成器
        const nanoidv2 = customAlphabet(
          '1234567890abcdefghijklmnopqrstuvwxyz',
          14,
        );
        // 如果最小数据库目录不存在，创建它
        if (!(await promisify(fs.exists)(`${toolDir}/nc_minimal_dbs`))) {
          await promisify(fs.mkdir)(`${toolDir}/nc_minimal_dbs`);
        }
        // 生成数据库 ID
        const dbId = nanoidv2();
        // 清理基地标题
        const baseTitle = DOMPurify.sanitize(baseBody.title);
        // 清空前缀
        baseBody.prefix = '';
        // 设置数据源
        baseBody.sources = [
          {
            type: 'sqlite3',
            is_meta: false,
            is_local: true,
            config: {
              client: 'sqlite3',
              connection: {
                client: 'sqlite3',
                database: baseTitle,
                connection: {
                  filename: `${toolDir}/nc_minimal_dbs/${baseTitle}_${dbId}.db`,
                },
              },
            },
            inflection_column: 'camelize',
            inflection_table: 'camelize',
          },
        ];
      } else {
        // 其他情况，使用默认配置
        const db = Noco.getConfig().meta?.db;
        baseBody.sources = [
          {
            type: db?.client,
            config: null,
            is_meta: true,
            inflection_column: 'camelize',
            inflection_table: 'camelize',
          },
        ];
      }
    } else {
      // 如果是外部基地
      // 检查是否禁用了连接外部数据库
      if (process.env.NC_CONNECT_TO_EXTERNAL_DB_DISABLED) {
        NcError.badRequest('Connecting to external db is disabled');
      }

      // 处理每个数据源
      for (const source of baseBody.sources || []) {
        // 如果没有集成 ID，创建一个新的集成
        if (!source.fk_integration_id) {
          const integration = await Integration.createIntegration(
            {
              title: source.alias || baseBody.title,
              type: IntegrationsType.Database,
              sub_type: source.config?.client,
              is_private: !!param.req.user?.id,
              config: source.config,
              workspaceId: param.req?.ncWorkspaceId,
              created_by: param.req.user?.id,
            },
            ncMeta,
          );

          // 设置集成 ID 和配置
          source.fk_integration_id = integration.id;
          source.config = {
            client: baseBody.config?.client,
          };
        }
      }
      // 标记为非元数据
      baseBody.is_meta = false;
    }

    // 检查标题长度是否超过限制
    if (baseBody?.title.length > 50) {
      // 限制是为了保持表、视图、列等标识符名称的一致行为
      NcError.badRequest('Base title exceeds 50 characters');
    }

    // 清理标题并设置 slug
    baseBody.title = DOMPurify.sanitize(baseBody.title);
    baseBody.slug = baseBody.title;

    // 创建项目
    const base = await Base.createProject(baseBody, ncMeta);

    // 创建上下文对象
    const context = {
      workspace_id: base.fk_workspace_id,
      base_id: base.id,
    };

    // TODO: 在此处创建 n:m 实例
    // 插入基地用户关系
    await BaseUser.insert(
      context,
      {
        fk_user_id: (param as any).user.id,
        base_id: base.id,
        roles: 'owner',
      },
      ncMeta,
    );

    // 同步迁移
    await syncMigration(base);

    // 如果是现有表，填充元数据
    for (const source of await base.getSources(undefined, ncMeta)) {
      if (process.env.NC_CLOUD !== 'true' && !base.is_meta) {
        // 填充元数据
        const info = await populateMeta(context, {
          source,
          base,
          user: param.user,
        });

        // 触发 API 创建事件
        this.appHooksService.emit(AppEvents.APIS_CREATED, {
          info,
          req: param.req,
          context,
        });

        // 清除配置信息
        source.config = undefined;
      }
    }

    // 触发项目创建事件
    this.appHooksService.emit(AppEvents.PROJECT_CREATE, {
      base,
      user: param.user,
      xcdb: !baseBody.external,
      req: param.req,
      context,
    });

    return base;
  }

  // 创建默认基地的方法
  async createDefaultBase(
    param: { user: UserType; req: Request },
    ncMeta = Noco.ncMeta,
  ) {
    // 创建基地
    const base = await this.baseCreate(
      {
        base: {
          title: 'Getting Started',
          type: 'database',
        } as any,
        user: param.user,
        req: param.req,
      },
      ncMeta,
    );

    // 创建上下文对象
    const context = {
      workspace_id: base.fk_workspace_id,
      base_id: base.id,
    };

    // 创建 SQL UI 实例
    const sqlUI = SqlUiFactory.create({ client: base.sources[0].type });
    // 获取新表列
    const columns = sqlUI?.getNewTableColumns() as any;

    // 创建表格
    const table = await this.tablesService.tableCreate(context, {
      baseId: base.id,
      sourceId: base.sources[0].id,
      table: {
        title: 'Features',
        table_name: 'Features',
        columns,
      },
      user: param.user,
      req: param.req,
    });

    // 将表格添加到基地对象
    (base as any).tables = [table];

    return base;
  }
}
