// 导入必要的类型和依赖
import type { NcContext } from '~/interface/config';
import User from '~/models/User';
import { NcError } from '~/helpers/catchError';
import Noco from '~/Noco';
import { extractProps } from '~/helpers/extractProps';
import { MetaTable } from '~/utils/globals';

// 同步源类，用于管理数据同步相关的配置和操作
export default class SyncSource {
  // 同步源唯一标识符
  id?: string;
  // 同步源标题
  title?: string;
  // 同步源类型
  type?: string;
  // 同步源详细配置信息
  details?: any;
  // 是否已删除标记
  deleted?: boolean;
  // 排序顺序
  order?: number;
  // 关联的工作区ID
  fk_workspace_id?: string;
  // 关联的基础ID
  base_id?: string;
  // 源ID
  source_id?: string;
  // 关联的用户ID
  fk_user_id?: string;

  // 构造函数，接收部分SyncSource对象进行初始化
  constructor(syncSource: Partial<SyncSource>) {
    Object.assign(this, syncSource);
  }

  // 获取关联用户信息的方法
  public getUser(ncMeta = Noco.ncMeta) {
    return User.get(this.fk_user_id, ncMeta);
  }

  // 根据ID获取同步源信息的静态方法
  public static async get(
    context: NcContext,
    syncSourceId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const syncSource = await ncMeta.metaGet2(
      context.workspace_id,
      context.base_id,
      MetaTable.SYNC_SOURCE,
      syncSourceId,
    );
    // 如果details是字符串，尝试解析为JSON对象
    if (syncSource.details && typeof syncSource.details === 'string') {
      try {
        syncSource.details = JSON.parse(syncSource.details);
      } catch {}
    }
    return syncSource && new SyncSource(syncSource);
  }

  // 获取同步源列表的静态方法
  static async list(
    context: NcContext,
    baseId: string,
    sourceId?: string,
    ncMeta = Noco.ncMeta,
  ) {
    // 构建查询条件
    const condition = sourceId
      ? { base_id: baseId, source_id: sourceId }
      : { base_id: baseId };
    const syncSources = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.SYNC_SOURCE,
      {
        condition,
        orderBy: {
          created_at: 'asc',
        },
      },
    );

    // 处理每个同步源的details字段
    for (const syncSource of syncSources) {
      if (syncSource.details && typeof syncSource.details === 'string') {
        try {
          syncSource.details = JSON.parse(syncSource.details);
        } catch {}
      }
    }
    return syncSources?.map((h) => new SyncSource(h));
  }

  // 插入新的同步源记录的静态方法
  public static async insert(
    context: NcContext,
    syncSource: Partial<SyncSource>,
    ncMeta = Noco.ncMeta,
  ) {
    // 提取需要插入的属性
    const insertObj = extractProps(syncSource, [
      'id',
      'title',
      'type',
      'details',
      'base_id',
      'source_id',
      'fk_user_id',
    ]);

    // 将details对象转换为字符串
    if (insertObj.details && typeof insertObj.details === 'object') {
      insertObj.details = JSON.stringify(insertObj.details);
    }

    // 执行插入操作
    const { id } = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.SYNC_SOURCE,
      insertObj,
    );

    return this.get(context, id, ncMeta);
  }

  // 更新同步源记录的静态方法
  public static async update(
    context: NcContext,
    syncSourceId: string,
    syncSource: Partial<SyncSource>,
    ncMeta = Noco.ncMeta,
  ) {
    // 提取需要更新的属性
    const updateObj = extractProps(syncSource, [
      'id',
      'title',
      'type',
      'details',
      'deleted',
      'order',
      'base_id',
      'source_id',
    ]);

    // 将details对象转换为字符串
    if (updateObj.details && typeof updateObj.details === 'object') {
      updateObj.details = JSON.stringify(updateObj.details);
    }

    // 执行更新操作
    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.SYNC_SOURCE,
      updateObj,
      syncSourceId,
    );

    return this.get(context, syncSourceId, ncMeta);
  }

  // 删除指定同步源记录的静态方法
  static async delete(
    context: NcContext,
    syncSourceId: any,
    ncMeta = Noco.ncMeta,
  ) {
    return await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.SYNC_SOURCE,
      syncSourceId,
    );
  }

  // 根据用户ID删除相关同步源记录的静态方法
  static async deleteByUserId(userId: string, ncMeta = Noco.ncMeta) {
    // 验证用户ID是否存在
    if (!userId) NcError.badRequest('User Id is required');

    // 执行删除操作
    return await ncMeta
      .knex(MetaTable.SYNC_SOURCE)
      .where({
        fk_user_id: userId,
      })
      .del();
  }
}
