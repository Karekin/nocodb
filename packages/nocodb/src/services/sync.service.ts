import { Injectable } from '@nestjs/common'; // 导入NestJS的Injectable装饰器，用于依赖注入
import { AppEvents } from 'nocodb-sdk'; // 导入应用事件枚举
import type { NcContext, NcRequest } from '~/interface/config'; // 导入上下文和请求接口类型
import { AppHooksService } from '~/services/app-hooks/app-hooks.service'; // 导入应用钩子服务
import { NcError } from '~/helpers/catchError'; // 导入错误处理工具
import { PagedResponseImpl } from '~/helpers/PagedResponse'; // 导入分页响应实现
import { Base, SyncSource } from '~/models'; // 导入Base和SyncSource模型

@Injectable() // 标记该类为可注入服务
export class SyncService {
  constructor(private readonly appHooksService: AppHooksService) {} // 构造函数，注入AppHooksService

  /**
   * 获取同步源列表
   * @param context - NocoDB上下文
   * @param param - 包含baseId和可选sourceId的参数对象
   * @returns 返回分页的同步源列表
   */
  async syncSourceList(
    context: NcContext,
    param: { baseId: string; sourceId?: string },
  ) {
    return new PagedResponseImpl(
      await SyncSource.list(context, param.baseId, param.sourceId),
    );
  }

  /**
   * 创建新的同步源
   * @param context - NocoDB上下文
   * @param param - 包含创建同步源所需的参数
   * @returns 返回创建的同步源对象
   */
  async syncCreate(
    context: NcContext,
    param: {
      baseId: string; // 基础ID
      sourceId?: string; // 可选的源ID
      userId: string; // 用户ID
      syncPayload: Partial<SyncSource>; // 同步源的部分数据
      req: NcRequest; // 请求对象
    },
  ) {
    // 获取基础信息
    const base = await Base.getWithInfo(context, param.baseId);

    // 插入新的同步源
    const sync = await SyncSource.insert(context, {
      ...param.syncPayload, // 展开同步负载
      fk_user_id: param.userId, // 设置用户外键
      source_id: param.sourceId ? param.sourceId : base.sources[0].id, // 设置源ID，如果未提供则使用基础的第一个源
      base_id: param.baseId, // 设置基础ID
    });

    // 触发同步源创建事件
    this.appHooksService.emit(AppEvents.SYNC_SOURCE_CREATE, {
      syncSource: sync,
      req: param.req,
      context,
    });

    return sync; // 返回创建的同步源
  }

  /**
   * 删除同步源
   * @param context - NocoDB上下文
   * @param param - 包含syncId和请求对象的参数
   * @returns 返回删除操作的结果
   */
  async syncDelete(
    context: NcContext,
    param: { syncId: string; req: NcRequest },
  ) {
    // 获取同步源
    const syncSource = await SyncSource.get(context, param.syncId);

    // 如果同步源不存在，抛出错误
    if (!syncSource) {
      NcError.badRequest('Sync source not found');
    }

    // 删除同步源
    const res = await SyncSource.delete(context, param.syncId);

    // 触发同步源删除事件
    this.appHooksService.emit(AppEvents.SYNC_SOURCE_DELETE, {
      syncSource,
      req: param.req,
      context,
    });
    return res; // 返回删除结果
  }

  /**
   * 更新同步源
   * @param context - NocoDB上下文
   * @param param - 包含syncId、更新数据和请求对象的参数
   * @returns 返回更新后的同步源
   */
  async syncUpdate(
    context: NcContext,
    param: {
      syncId: string; // 同步源ID
      syncPayload: Partial<SyncSource>; // 更新的部分数据
      req: NcRequest; // 请求对象
    },
  ) {
    // 获取同步源
    const syncSource = await SyncSource.get(context, param.syncId);

    // 如果同步源不存在，抛出错误
    if (!syncSource) {
      NcError.badRequest('Sync source not found');
    }

    // 更新同步源
    const res = await SyncSource.update(
      context,
      param.syncId,
      param.syncPayload,
    );

    // 触发同步源更新事件
    this.appHooksService.emit(AppEvents.SYNC_SOURCE_UPDATE, {
      syncSource,
      req: param.req,
      context,
    });

    return res; // 返回更新结果
  }
}
