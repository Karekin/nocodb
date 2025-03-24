/**
 * Hook 类 - 用于处理数据库钩子（Webhook）的模型类
 * 实现了 HookType 接口，用于定义和处理数据库操作前后的钩子行为
 */
import type { BoolType, HookReqType, HookType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import Model from '~/models/Model';
import Filter from '~/models/Filter';
import HookFilter from '~/models/HookFilter';
import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
} from '~/utils/globals';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { extractProps } from '~/helpers/extractProps';
import { NcError } from '~/helpers/catchError';

export default class Hook implements HookType {
  // 钩子的基本属性
  id?: string;                    // 钩子ID
  fk_model_id?: string;          // 关联的模型ID
  title?: string;                // 钩子标题
  description?: string;          // 钩子描述
  env?: string;                  // 环境变量
  type?: string;                 // 钩子类型
  event?: HookType['event'];     // 触发事件类型
  operation?: HookType['operation']; // 操作类型
  async?: BoolType;              // 是否异步执行
  payload?: string;              // 请求负载
  url?: string;                  // 目标URL
  headers?: string;              // 请求头
  condition?: BoolType;          // 触发条件
  notification?: string | Record<string, any>; // 通知配置
  retries?: number;              // 重试次数
  retry_interval?: number;       // 重试间隔
  timeout?: number;              // 超时时间
  active?: BoolType;             // 是否激活

  // 工作空间相关属性
  fk_workspace_id?: string;      // 工作空间ID
  base_id?: string;              // 基础ID
  source_id?: string;            // 数据源ID
  version?: 'v1' | 'v2';         // 钩子版本

  /**
   * 构造函数
   * @param hook - 钩子配置对象
   */
  constructor(hook: Partial<Hook | HookReqType>) {
    Object.assign(this, hook);
  }

  /**
   * 根据ID获取钩子
   * @param context - 上下文对象
   * @param hookId - 钩子ID
   * @param ncMeta - 元数据对象
   * @returns 钩子实例
   */
  public static async get(
    context: NcContext,
    hookId: string,
    ncMeta = Noco.ncMeta,
  ) {
    // 尝试从缓存获取钩子
    let hook =
      hookId &&
      (await NocoCache.get(
        `${CacheScope.HOOK}:${hookId}`,
        CacheGetType.TYPE_OBJECT,
      ));
    // 如果缓存中没有，则从数据库获取
    if (!hook) {
      hook = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.HOOKS,
        hookId,
      );
      await NocoCache.set(`${CacheScope.HOOK}:${hookId}`, hook);
    }
    return hook && new Hook(hook);
  }

  /**
   * 获取钩子关联的过滤器列表
   * @param context - 上下文对象
   * @param ncMeta - 元数据对象
   * @returns 过滤器列表
   */
  public async getFilters(context: NcContext, ncMeta = Noco.ncMeta) {
    return await Filter.rootFilterListByHook(
      context,
      { hookId: this.id },
      ncMeta,
    );
  }

  /**
   * 获取模型下的钩子列表
   * @param context - 上下文对象
   * @param param - 查询参数
   * @param ncMeta - 元数据对象
   * @returns 钩子列表
   */
  static async list(
    context: NcContext,
    param: {
      fk_model_id: string;
      event?: HookType['event'];
      operation?: HookType['operation'];
    },
    ncMeta = Noco.ncMeta,
  ) {
    // 从缓存获取钩子列表
    const cachedList = await NocoCache.getList(CacheScope.HOOK, [
      param.fk_model_id,
    ]);
    let { list: hooks } = cachedList;
    const { isNoneList } = cachedList;
    // 如果缓存中没有，则从数据库获取
    if (!isNoneList && !hooks.length) {
      hooks = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.HOOKS,
        {
          condition: {
            fk_model_id: param.fk_model_id,
          },
          orderBy: {
            created_at: 'asc',
          },
        },
      );
      await NocoCache.setList(CacheScope.HOOK, [param.fk_model_id], hooks);
    }
    // 根据事件和操作类型过滤钩子
    if (param.event) {
      hooks = hooks.filter(
        (h) => h.event?.toLowerCase() === param.event?.toLowerCase(),
      );
    }
    if (param.operation) {
      hooks = hooks.filter(
        (h) => h.operation?.toLowerCase() === param.operation?.toLowerCase(),
      );
    }
    return hooks?.map((h) => new Hook(h));
  }

  /**
   * 创建新的钩子
   * @param context - 上下文对象
   * @param hook - 钩子配置
   * @param ncMeta - 元数据对象
   * @returns 新创建的钩子实例
   */
  public static async insert(
    context: NcContext,
    hook: Partial<Hook>,
    ncMeta = Noco.ncMeta,
  ) {
    // 提取需要插入的属性
    const insertObj = extractProps(hook, [
      'fk_model_id',
      'title',
      'description',
      'env',
      'type',
      'event',
      'operation',
      'async',
      'url',
      'headers',
      'condition',
      'notification',
      'retries',
      'retry_interval',
      'timeout',
      'active',
      'base_id',
      'source_id',
    ]);

    // 处理通知配置的序列化
    if (insertObj.notification && typeof insertObj.notification === 'object') {
      insertObj.notification = JSON.stringify(insertObj.notification);
    }

    // 获取关联的模型
    const model = await Model.getByIdOrName(
      context,
      { id: hook.fk_model_id },
      ncMeta,
    );

    // 设置数据源ID
    if (!insertObj.source_id) {
      insertObj.source_id = model.source_id;
    }

    // 设置钩子版本为v2
    insertObj.version = 'v2';

    // 插入新钩子到数据库
    const { id } = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.HOOKS,
      insertObj,
    );

    // 获取新创建的钩子并更新缓存
    return this.get(context, id, ncMeta).then(async (hook) => {
      await NocoCache.appendToList(
        CacheScope.HOOK,
        [hook.fk_model_id],
        `${CacheScope.HOOK}:${id}`,
      );
      return hook;
    });
  }

  /**
   * 更新钩子配置
   * @param context - 上下文对象
   * @param hookId - 钩子ID
   * @param hook - 更新的钩子配置
   * @param ncMeta - 元数据对象
   * @returns 更新后的钩子实例
   */
  public static async update(
    context: NcContext,
    hookId: string,
    hook: Partial<Hook>,
    ncMeta = Noco.ncMeta,
  ) {
    // 提取需要更新的属性
    const updateObj = extractProps(hook, [
      'title',
      'description',
      'env',
      'type',
      'event',
      'operation',
      'async',
      'payload',
      'url',
      'headers',
      'condition',
      'notification',
      'retries',
      'retry_interval',
      'timeout',
      'active',
      'version',
    ]);

    // 检查v1版本钩子不支持的操作
    if (
      updateObj.version &&
      updateObj.operation &&
      updateObj.version === 'v1' &&
      ['bulkInsert', 'bulkUpdate', 'bulkDelete'].includes(updateObj.operation)
    ) {
      NcError.badRequest(`${updateObj.operation} not supported in v1 hook`);
    }

    // 处理通知配置的序列化
    if (updateObj.notification && typeof updateObj.notification === 'object') {
      updateObj.notification = JSON.stringify(updateObj.notification);
    }

    // 更新数据库中的钩子
    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.HOOKS,
      updateObj,
      hookId,
    );

    // 更新缓存
    await NocoCache.update(`${CacheScope.HOOK}:${hookId}`, updateObj);

    return this.get(context, hookId, ncMeta);
  }

  /**
   * 删除钩子及其关联的过滤器
   * @param context - 上下文对象
   * @param hookId - 钩子ID
   * @param ncMeta - 元数据对象
   */
  static async delete(context: NcContext, hookId: any, ncMeta = Noco.ncMeta) {
    // 删除钩子关联的过滤器
    const filterList = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.FILTER_EXP,
      {
        condition: { fk_hook_id: hookId },
      },
    );
    for (const filter of filterList) {
      await NocoCache.deepDel(
        `${CacheScope.FILTER_EXP}:${filter.id}`,
        CacheDelDirection.CHILD_TO_PARENT,
      );
      await HookFilter.delete(context, filter.id, ncMeta);
    }
    // 删除钩子
    await NocoCache.deepDel(
      `${CacheScope.HOOK}:${hookId}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );
    return await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.HOOKS,
      hookId,
    );
  }

  /**
   * 获取钩子的使用情况
   * @param context - 上下文对象
   * @param hookId - 钩子ID
   * @param ncMeta - 元数据对象
   * @returns 使用该钩子的按钮列表
   */
  static async hookUsages(
    context: NcContext,
    hookId: string,
    ncMeta = Noco.ncMeta,
  ) {
    return await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.COL_BUTTON,
      {
        condition: { fk_webhook_id: hookId },
      },
    );
  }
}
