import { Logger } from '@nestjs/common';
import type { BaseType, BoolType, MetaType } from 'nocodb-sdk';
import type { DB_TYPES } from '~/utils/globals';
import type { NcContext } from '~/interface/config';
import { BaseUser, CustomUrl, DataReflection, Source } from '~/models';
import Noco from '~/Noco';
import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
  RootScopes,
} from '~/utils/globals';
import { extractProps } from '~/helpers/extractProps';
import NocoCache from '~/cache/NocoCache';
import { parseMetaProp, stringifyMetaProp } from '~/utils/modelUtils';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import { cleanCommandPaletteCache } from '~/helpers/commandPaletteHelpers';
import { NcError } from '~/helpers/catchError';

const logger = new Logger('Base');

/**
 * Base 类 - 实现基础项目的核心功能
 * 包括项目的创建、更新、删除、查询等操作
 */
export default class Base implements BaseType {
  // 基础属性定义
  public id: string; // 项目ID
  public fk_workspace_id?: string; // 工作空间ID
  public title: string; // 项目标题
  public prefix: string; // 项目前缀
  public status: string; // 项目状态
  public description: string; // 项目描述
  public meta: MetaType; // 项目元数据
  public color: string; // 项目颜色
  public deleted: BoolType | number; // 删除标记
  public order: number; // 排序顺序
  public is_meta: boolean | number = false; // 是否为元数据项目
  public sources?: Source[]; // 数据源列表
  public linked_db_projects?: Base[]; // 关联的数据库项目

  // 共享基础属性
  uuid?: string; // 唯一标识符
  password?: string; // 密码
  roles?: string; // 角色
  fk_custom_url_id?: string; // 自定义URL ID

  /**
   * 构造函数 - 初始化基础项目
   * @param base - 基础项目数据
   */
  constructor(base: Partial<Base>) {
    Object.assign(this, base);
  }

  /**
   * 类型转换方法 - 将普通对象转换为Base实例
   * @param base - 基础项目数据
   */
  public static castType(base: Base): Base {
    return base && new Base(base);
  }

  /**
   * 创建新项目
   * @param base - 项目数据
   * @param ncMeta - 元数据服务实例
   */
  public static async createProject(
    base: Partial<BaseType>,
    ncMeta = Noco.ncMeta,
  ): Promise<Base> {
    // 提取需要插入的属性
    const insertObj = extractProps(base, [
      'id',
      'title',
      'prefix',
      'description',
      'is_meta',
      'status',
      'meta',
      'color',
      'order',
    ]);

    // 设置排序顺序
    if (!insertObj.order) {
      insertObj.order = await ncMeta.metaGetNextOrder(MetaTable.PROJECT, {});
    }

    // 处理元数据
    if (insertObj.meta) {
      insertObj.meta = stringifyMetaProp(insertObj);
    } else if (!('meta' in insertObj)) {
      insertObj.meta = '{"iconColor":"#36BFFF"}';
    }

    // 插入项目数据
    const { id: baseId } = await ncMeta.metaInsert2(
      RootScopes.BASE,
      RootScopes.BASE,
      MetaTable.PROJECT,
      insertObj,
    );

    // 创建上下文
    const context = {
      workspace_id: (base as any).fk_workspace_id,
      base_id: baseId,
    };

    // 创建数据源
    for (const source of base.sources) {
      await Source.createBase(
        context,
        {
          type: source.config?.client as (typeof DB_TYPES)[number],
          ...source,
          baseId,
        },
        ncMeta,
      );
    }

    // 清除缓存
    await NocoCache.del(CacheScope.INSTANCE_META);

    // 授予基础权限
    await DataReflection.grantBase(base.fk_workspace_id, base.id, ncMeta);

    // 清理命令面板缓存
    cleanCommandPaletteCache(context.workspace_id).catch(() => {
      logger.error('Failed to clean command palette cache');
    });

    // 获取并返回项目信息
    return this.getWithInfo(context, baseId, true, ncMeta).then(
      async (base) => {
        await NocoCache.appendToList(
          CacheScope.PROJECT,
          [],
          `${CacheScope.PROJECT}:${baseId}`,
        );
        return base;
      },
    );
  }

  /**
   * 获取项目列表
   * @param workspaceId - 工作空间ID
   * @param ncMeta - 元数据服务实例
   */
  static async list(
    workspaceId?: string,
    ncMeta = Noco.ncMeta,
  ): Promise<Base[]> {
    // 从缓存获取项目列表
    const cachedList = await NocoCache.getList(CacheScope.PROJECT, []);
    let { list: baseList } = cachedList;
    const { isNoneList } = cachedList;

    // 如果缓存中没有数据，从数据库获取
    if (!isNoneList && !baseList.length) {
      baseList = await ncMeta.metaList2(
        RootScopes.BASE,
        RootScopes.BASE,
        MetaTable.PROJECT,
        {
          xcCondition: {
            _or: [
              {
                deleted: {
                  eq: false,
                },
              },
              {
                deleted: {
                  eq: null,
                },
              },
            ],
          },
          orderBy: {
            order: 'asc',
          },
        },
      );
      await NocoCache.setList(CacheScope.PROJECT, [], baseList);
    }

    const promises = [];

    // 处理项目列表
    const castedProjectList = baseList
      .filter(
        (p) => p.deleted === 0 || p.deleted === false || p.deleted === null,
      )
      .sort(
        (a, b) =>
          (a.order != null ? a.order : Infinity) -
          (b.order != null ? b.order : Infinity),
      )
      .map((p) => {
        const base = this.castType(p);
        promises.push(base.getSources(false, ncMeta));
        return base;
      });

    await Promise.all(promises);

    return castedProjectList;
  }

  /**
   * 获取单个项目
   * @param context - 上下文信息
   * @param baseId - 项目ID
   * @param ncMeta - 元数据服务实例
   */
  static async get(
    context: NcContext,
    baseId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<Base> {
    // 从缓存获取项目数据
    let baseData =
      baseId &&
      (await NocoCache.get(
        `${CacheScope.PROJECT}:${baseId}`,
        CacheGetType.TYPE_OBJECT,
      ));

    // 如果缓存中没有数据，从数据库获取
    if (!baseData) {
      baseData = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.PROJECT,
        {
          id: baseId,
          deleted: false,
        },
      );
      if (baseData) {
        baseData.meta = parseMetaProp(baseData);
        await NocoCache.set(`${CacheScope.PROJECT}:${baseId}`, baseData);
      }
    } else {
      if (baseData.deleted) {
        baseData = null;
      }
    }
    return this.castType(baseData);
  }

  /**
   * 获取项目的数据源
   * @param includeConfig - 是否包含配置信息
   * @param ncMeta - 元数据服务实例
   */
  async getSources(
    includeConfig = true,
    ncMeta = Noco.ncMeta,
  ): Promise<Source[]> {
    const sources = await Source.list(
      { workspace_id: this.fk_workspace_id, base_id: this.id },
      { baseId: this.id },
      ncMeta,
    );
    this.sources = sources;
    if (!includeConfig) {
      sources.forEach((s) => {
        s.config = undefined;
        s.integration_config = undefined;
      });
    }
    return sources;
  }

  /**
   * 获取项目详细信息
   * @param context - 上下文信息
   * @param baseId - 项目ID
   * @param includeConfig - 是否包含配置信息
   * @param ncMeta - 元数据服务实例
   */
  static async getWithInfo(
    context: NcContext,
    baseId: string,
    includeConfig = true,
    ncMeta = Noco.ncMeta,
  ): Promise<Base> {
    // 从缓存获取项目数据
    let baseData =
      baseId &&
      (await NocoCache.get(
        `${CacheScope.PROJECT}:${baseId}`,
        CacheGetType.TYPE_OBJECT,
      ));

    // 如果缓存中没有数据，从数据库获取
    if (!baseData) {
      baseData = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.PROJECT,
        {
          id: baseId,
          deleted: false,
        },
      );
      if (baseData) {
        baseData.meta = parseMetaProp(baseData);
        await NocoCache.set(`${CacheScope.PROJECT}:${baseId}`, baseData);
      }
      if (baseData?.uuid) {
        await NocoCache.set(
          `${CacheScope.PROJECT_ALIAS}:${baseData.uuid}`,
          baseId,
        );
      }
    } else {
      if (baseData?.deleted) {
        baseData = null;
      }
    }

    // 获取项目数据源
    if (baseData) {
      const base = this.castType(baseData);
      await base.getSources(includeConfig, ncMeta);
      return base;
    }
    return null;
  }

  /**
   * 软删除项目
   * @param context - 上下文信息
   * @param baseId - 项目ID
   * @param ncMeta - 元数据服务实例
   */
  static async softDelete(
    context: NcContext,
    baseId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<any> {
    const base = (await this.get(context, baseId, ncMeta)) as Base;

    // 清理连接池
    await this.clearConnectionPool(context, baseId, ncMeta);

    if (base) {
      // 删除缓存
      await NocoCache.del([
        `${CacheScope.PROJECT_ALIAS}:${base.title}`,
        `${CacheScope.PROJECT_ALIAS}:${base.uuid}`,
        `${CacheScope.PROJECT_ALIAS}:ref:${base.title}`,
        `${CacheScope.PROJECT_ALIAS}:ref:${base.id}`,
      ]);
    }

    await NocoCache.del(CacheScope.INSTANCE_META);

    // 从缓存列表中移除
    await NocoCache.deepDel(
      `${CacheScope.PROJECT}:${baseId}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );

    // 删除自定义URL
    CustomUrl.bulkDelete({ base_id: baseId }, ncMeta).catch(() => {
      logger.error(`Failed to delete custom urls of baseId: ${baseId}`);
    });

    // 撤销基础权限
    await DataReflection.revokeBase(base.fk_workspace_id, base.id, ncMeta);

    // 清理命令面板缓存
    cleanCommandPaletteCache(context.workspace_id).catch(() => {
      logger.error('Failed to clean command palette cache');
    });

    // 更新项目状态为已删除
    return await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.PROJECT,
      { deleted: true },
      baseId,
    );
  }

  /**
   * 更新项目
   * @param context - 上下文信息
   * @param baseId - 项目ID
   * @param base - 更新数据
   * @param ncMeta - 元数据服务实例
   */
  static async update(
    context: NcContext,
    baseId: string,
    base: Partial<Base>,
    ncMeta = Noco.ncMeta,
  ): Promise<any> {
    // 提取需要更新的属性
    const updateObj = extractProps(base, [
      'title',
      'prefix',
      'status',
      'description',
      'meta',
      'color',
      'deleted',
      'order',
      'sources',
      'uuid',
      'password',
      'roles',
    ]);

    // 处理元数据
    if (updateObj.meta) {
      updateObj.meta = stringifyMetaProp(updateObj);
    }

    // 更新缓存
    const key = `${CacheScope.PROJECT}:${baseId}`;
    let o = await NocoCache.get(key, CacheGetType.TYPE_OBJECT);
    if (o) {
      // 处理UUID变更
      if (o.uuid && updateObj.uuid && o.uuid !== updateObj.uuid) {
        await NocoCache.del(`${CacheScope.PROJECT_ALIAS}:${o.uuid}`);
        await NocoCache.set(
          `${CacheScope.PROJECT_ALIAS}:${updateObj.uuid}`,
          baseId,
        );
      }
      // 处理共享基础禁用
      if (o.uuid && updateObj.uuid === null) {
        await NocoCache.del(`${CacheScope.PROJECT_ALIAS}:${o.uuid}`);
      }
      // 处理标题变更
      if (o.title && updateObj.title && o.title !== updateObj.title) {
        await NocoCache.del(`${CacheScope.PROJECT_ALIAS}:${o.title}`);
        await NocoCache.set(
          `${CacheScope.PROJECT_ALIAS}:${updateObj.title}`,
          baseId,
        );
      }
      o = { ...o, ...updateObj };

      await NocoCache.del(CacheScope.INSTANCE_META);
      await NocoCache.set(key, o);
    }

    // 清理命令面板缓存
    cleanCommandPaletteCache(context.workspace_id).catch(() => {
      logger.error('Failed to clean command palette cache');
    });

    // 处理元数据
    if ('meta' in updateObj) {
      updateObj.meta = stringifyMetaProp(updateObj);
    }

    // 更新项目数据
    return await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.PROJECT,
      updateObj,
      baseId,
    );
  }

  /**
   * 删除项目
   * @param context - 上下文信息
   * @param baseId - 项目ID
   * @param ncMeta - 元数据服务实例
   */
  static async delete(
    context: NcContext,
    baseId,
    ncMeta = Noco.ncMeta,
  ): Promise<any> {
    // 获取项目数据
    const base = await ncMeta.metaGet2(
      context.workspace_id,
      context.base_id,
      MetaTable.PROJECT,
      baseId,
    );

    if (!base) {
      NcError.baseNotFound(baseId);
    }

    // 删除项目用户
    const users = await BaseUser.getUsersList(
      context,
      {
        base_id: baseId,
        include_ws_deleted: true,
      },
      ncMeta,
    );

    for (const user of users) {
      await BaseUser.delete(context, baseId, user.id, ncMeta);
    }

    // 删除数据源
    const sources = await Source.list(
      context,
      { baseId, includeDeleted: true },
      ncMeta,
    );
    for (const source of sources) {
      await source.delete(context, ncMeta);
    }

    // 撤销基础权限
    await DataReflection.revokeBase(base.fk_workspace_id, base.id, ncMeta);

    if (base) {
      // 删除缓存
      await NocoCache.del([
        `${CacheScope.PROJECT_ALIAS}:${base.uuid}`,
        `${CacheScope.PROJECT_ALIAS}:${base.title}`,
        `${CacheScope.PROJECT_ALIAS}:ref:${base.title}`,
        `${CacheScope.PROJECT_ALIAS}:ref:${base.id}`,
      ]);
    }

    // 从缓存中删除
    await NocoCache.deepDel(
      `${CacheScope.PROJECT}:${baseId}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );

    // 删除审计日志
    await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.AUDIT,
      {
        base_id: baseId,
      },
    );

    // 删除自定义URL
    CustomUrl.bulkDelete({ base_id: baseId }, ncMeta).catch(() => {
      logger.error(`Failed to delete custom urls of baseId: ${baseId}`);
    });

    // 清理命令面板缓存
    cleanCommandPaletteCache(context.workspace_id).catch(() => {
      logger.error('Failed to clean command palette cache');
    });

    // 删除项目数据
    return await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.PROJECT,
      baseId,
    );
  }

  /**
   * 通过UUID获取项目
   * @param context - 上下文信息
   * @param uuid - 项目UUID
   * @param ncMeta - 元数据服务实例
   */
  static async getByUuid(context: NcContext, uuid, ncMeta = Noco.ncMeta) {
    // 从缓存获取项目ID
    const baseId =
      uuid &&
      (await NocoCache.get(
        `${CacheScope.PROJECT_ALIAS}:${uuid}`,
        CacheGetType.TYPE_STRING,
      ));
    let baseData = null;

    // 如果缓存中没有数据，从数据库获取
    if (!baseId) {
      baseData = await Noco.ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.PROJECT,
        {
          uuid,
        },
      );
      if (baseData) {
        baseData.meta = parseMetaProp(baseData);
        await NocoCache.set(
          `${CacheScope.PROJECT_ALIAS}:${uuid}`,
          baseData?.id,
        );
      }
    } else {
      return this.get(context, baseId, ncMeta);
    }
    return baseData?.id && this.get(context, baseData?.id, ncMeta);
  }

  /**
   * 通过标题获取项目详细信息
   * @param context - 上下文信息
   * @param title - 项目标题
   * @param ncMeta - 元数据服务实例
   */
  static async getWithInfoByTitle(
    context: NcContext,
    title: string,
    ncMeta = Noco.ncMeta,
  ) {
    const base = await this.getByTitle(context, title, ncMeta);
    if (base) {
      await base.getSources(false, ncMeta);
    }
    return base;
  }

  /**
   * 通过标题获取项目
   * @param context - 上下文信息
   * @param title - 项目标题
   * @param ncMeta - 元数据服务实例
   */
  static async getByTitle(
    context: NcContext,
    title: string,
    ncMeta = Noco.ncMeta,
  ) {
    // 从缓存获取项目ID
    const baseId =
      title &&
      (await NocoCache.get(
        `${CacheScope.PROJECT_ALIAS}:${title}`,
        CacheGetType.TYPE_STRING,
      ));
    let baseData = null;

    // 如果缓存中没有数据，从数据库获取
    if (!baseId) {
      baseData = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.PROJECT,
        {
          title,
          deleted: false,
        },
      );
      if (baseData) {
        baseData.meta = parseMetaProp(baseData);
        await NocoCache.set(
          `${CacheScope.PROJECT_ALIAS}:${title}`,
          baseData?.id,
        );
      }
    } else {
      return this.get(context, baseId, ncMeta);
    }
    return baseData?.id && this.get(context, baseData?.id, ncMeta);
  }

  /**
   * 通过标题或ID获取项目
   * @param context - 上下文信息
   * @param titleOrId - 项目标题或ID
   * @param ncMeta - 元数据服务实例
   */
  static async getByTitleOrId(
    context: NcContext,
    titleOrId: string,
    ncMeta = Noco.ncMeta,
  ) {
    // 从缓存获取项目ID
    const baseId =
      titleOrId &&
      (await NocoCache.get(
        `${CacheScope.PROJECT_ALIAS}:ref:${titleOrId}`,
        CacheGetType.TYPE_STRING,
      ));
    let baseData = null;

    // 如果缓存中没有数据，从数据库获取
    if (!baseId) {
      baseData = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.PROJECT,
        {
          deleted: false,
        },
        null,
        {
          _or: [
            {
              id: {
                eq: titleOrId,
              },
            },
            {
              title: {
                eq: titleOrId,
              },
            },
          ],
        },
      );

      if (baseData) {
        baseData.meta = parseMetaProp(baseData);
        await NocoCache.set(
          `${CacheScope.PROJECT_ALIAS}:ref:${titleOrId}`,
          baseData?.id,
        );
      }
    } else {
      return this.get(context, baseId, ncMeta);
    }
    return baseData?.id && this.get(context, baseData?.id, ncMeta);
  }

  /**
   * 通过标题或ID获取项目详细信息
   * @param context - 上下文信息
   * @param titleOrId - 项目标题或ID
   * @param ncMeta - 元数据服务实例
   */
  static async getWithInfoByTitleOrId(
    context: NcContext,
    titleOrId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const base = await this.getByTitleOrId(context, titleOrId, ncMeta);
    if (base) {
      base.meta = parseMetaProp(base);
      await base.getSources(false, ncMeta);
    }
    return base;
  }

  /**
   * 清理连接池
   * @param context - 上下文信息
   * @param baseId - 项目ID
   * @param ncMeta - 元数据服务实例
   */
  static async clearConnectionPool(
    context: NcContext,
    baseId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const base = await this.get(context, baseId, ncMeta);
    if (base) {
      const sources = await base.getSources(false, ncMeta);
      for (const source of sources) {
        await NcConnectionMgrv2.deleteAwait(source);
      }
    }
  }
}
