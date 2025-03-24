/**
 * 模型角色可见性类
 * 用于管理不同角色对模型视图的访问权限
 */
import type { ModelRoleVisibilityType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import View from '~/models/View';
import Noco from '~/Noco';
import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
} from '~/utils/globals';
import NocoCache from '~/cache/NocoCache';
import { extractProps } from '~/helpers/extractProps';

export default class ModelRoleVisibility implements ModelRoleVisibilityType {
  // 模型角色可见性的属性定义
  id?: string;                    // 唯一标识符
  fk_workspace_id?: string;      // 工作空间ID
  base_id?: string;              // 基础数据库ID
  source_id?: string;            // 数据源ID
  fk_view_id?: string;           // 视图ID
  role?: string;                 // 角色名称
  disabled?: boolean;            // 是否禁用

  constructor(body: Partial<ModelRoleVisibilityType>) {
    Object.assign(this, body);
  }

  /**
   * 获取指定基础数据库的所有模型角色可见性配置
   * @param context - 上下文对象
   * @param baseId - 基础数据库ID
   * @returns 模型角色可见性配置列表
   */
  static async list(
    context: NcContext,
    baseId,
  ): Promise<ModelRoleVisibility[]> {
    // 尝试从缓存获取数据
    const cachedList = await NocoCache.getList(
      CacheScope.MODEL_ROLE_VISIBILITY,
      [baseId],
    );
    let { list: data } = cachedList;
    const { isNoneList } = cachedList;
    
    // 如果缓存中没有数据，则从数据库获取
    if (!isNoneList && !data.length) {
      data = await Noco.ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.MODEL_ROLE_VISIBILITY,
      );
      // 将数据存入缓存
      await NocoCache.setList(
        CacheScope.MODEL_ROLE_VISIBILITY,
        [baseId],
        data,
        ['fk_view_id', 'role'],
      );
    }
    return data?.map((baseData) => new ModelRoleVisibility(baseData));
  }

  /**
   * 获取特定视图和角色的可见性配置
   * @param context - 上下文对象
   * @param args - 包含角色和视图ID的参数对象
   * @param ncMeta - 元数据操作对象
   * @returns 模型角色可见性配置
   */
  static async get(
    context: NcContext,
    args: { role: string; fk_view_id: any },
    ncMeta = Noco.ncMeta,
  ) {
    // 尝试从缓存获取数据
    let data =
      args.fk_view_id &&
      args.role &&
      (await NocoCache.get(
        `${CacheScope.MODEL_ROLE_VISIBILITY}:${args.fk_view_id}:${args.role}`,
        CacheGetType.TYPE_OBJECT,
      ));
    
    // 如果缓存中没有数据，则从数据库获取
    if (!data) {
      data = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.MODEL_ROLE_VISIBILITY,
        {
          fk_view_id: args.fk_view_id,
          role: args.role,
        },
      );
      // 将数据存入缓存
      await NocoCache.set(
        `${CacheScope.MODEL_ROLE_VISIBILITY}:${args.fk_view_id}:${args.role}`,
        data,
      );
    }
    return data && new ModelRoleVisibility(data);
  }

  /**
   * 更新特定视图和角色的可见性配置
   * @param context - 上下文对象
   * @param fk_view_id - 视图ID
   * @param role - 角色名称
   * @param body - 更新内容
   * @param ncMeta - 元数据操作对象
   * @returns 更新结果
   */
  static async update(
    context: NcContext,
    fk_view_id: string,
    role: string,
    body: { disabled: any },
    ncMeta = Noco.ncMeta,
  ) {
    // 更新数据库中的配置
    const res = await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.MODEL_ROLE_VISIBILITY,
      {
        disabled: body.disabled,
      },
      {
        fk_view_id,
        role,
      },
    );

    // 更新缓存中的配置
    await NocoCache.update(
      `${CacheScope.MODEL_ROLE_VISIBILITY}:${fk_view_id}:${role}`,
      {
        disabled: body.disabled,
      },
    );

    return res;
  }

  /**
   * 删除当前实例的可见性配置
   * @param context - 上下文对象
   * @param ncMeta - 元数据操作对象
   * @returns 删除结果
   */
  async delete(context: NcContext, ncMeta = Noco.ncMeta) {
    return await ModelRoleVisibility.delete(
      context,
      this.fk_view_id,
      this.role,
      ncMeta,
    );
  }

  /**
   * 删除特定视图和角色的可见性配置
   * @param context - 上下文对象
   * @param fk_view_id - 视图ID
   * @param role - 角色名称
   * @param ncMeta - 元数据操作对象
   * @returns 删除结果
   */
  static async delete(
    context: NcContext,
    fk_view_id: string,
    role: string,
    ncMeta = Noco.ncMeta,
  ) {
    // 从数据库中删除配置
    const res = await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.MODEL_ROLE_VISIBILITY,
      {
        fk_view_id,
        role,
      },
    );
    // 从缓存中删除配置
    await NocoCache.deepDel(
      `${CacheScope.MODEL_ROLE_VISIBILITY}:${fk_view_id}:${role}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );
    return res;
  }

  /**
   * 插入新的模型角色可见性配置
   * @param context - 上下文对象
   * @param body - 配置数据
   * @param ncMeta - 元数据操作对象
   * @returns 新创建的配置对象
   */
  static async insert(
    context: NcContext,
    body: Partial<ModelRoleVisibilityType>,
    ncMeta = Noco.ncMeta,
  ) {
    // 提取需要插入的属性
    const insertObj = extractProps(body, [
      'role',
      'disabled',
      'fk_view_id',
      'base_id',
      'source_id',
    ]);

    // 获取关联的视图信息
    const view = await View.get(context, body.fk_view_id, ncMeta);

    // 如果没有提供source_id，则使用视图的source_id
    if (!insertObj.source_id) {
      insertObj.source_id = view.source_id;
    }

    // 插入数据到数据库
    const result = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.MODEL_ROLE_VISIBILITY,
      insertObj,
    );

    insertObj.id = result.id;

    // 获取新创建的配置并更新缓存
    return this.get(
      context,
      {
        fk_view_id: body.fk_view_id,
        role: body.role,
      },
      ncMeta,
    ).then(async (modelRoleVisibility) => {
      const key = `${CacheScope.MODEL_ROLE_VISIBILITY}:${body.fk_view_id}:${body.role}`;
      await NocoCache.appendToList(
        CacheScope.MODEL_ROLE_VISIBILITY,
        [context.base_id],
        key,
      );
      return modelRoleVisibility;
    });
  }
}
