// 导入 NestJS 的 Injectable 装饰器，用于声明该服务可被依赖注入
import { Injectable } from '@nestjs/common';
// 导入应用事件枚举和扩展请求类型接口
import { AppEvents, type ExtensionReqType } from 'nocodb-sdk';
// 导入 NocoDB 上下文和请求接口类型
import type { NcContext, NcRequest } from '~/interface/config';
// 导入应用钩子服务，用于事件触发
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
// 导入验证负载的辅助函数
import { validatePayload } from '~/helpers';
// 导入扩展模型
import { Extension } from '~/models';

// 使用 Injectable 装饰器标记该类为可注入服务
@Injectable()
// 定义扩展服务类
export class ExtensionsService {
  // 构造函数，注入 AppHooksService 服务
  constructor(private readonly appHooksService: AppHooksService) {}

  // 获取扩展列表的方法
  // 参数：上下文和包含 baseId 的参数对象
  async extensionList(context: NcContext, param: { baseId: string }) {
    // 调用 Extension 模型的 list 方法并返回结果
    return await Extension.list(context, param.baseId);
  }

  // 读取单个扩展详情的方法
  // 参数：上下文和包含 extensionId 的参数对象
  async extensionRead(context: NcContext, param: { extensionId: string }) {
    // 调用 Extension 模型的 get 方法并返回结果
    return await Extension.get(context, param.extensionId);
  }

  // 创建新扩展的方法
  // 参数：上下文和包含扩展数据与请求对象的参数
  async extensionCreate(
    context: NcContext,
    param: {
      extension: ExtensionReqType;
      req: NcRequest;
    },
  ) {
    // 验证扩展数据是否符合 Swagger 定义的模式
    validatePayload(
      'swagger.json#/components/schemas/ExtensionReq',
      param.extension,
    );

    // 调用 Extension 模型的 insert 方法创建扩展
    // 并添加当前用户 ID 作为外键
    const res = await Extension.insert(context, {
      ...param.extension,
      fk_user_id: param.req.user.id,
    });

    // 触发扩展创建事件
    this.appHooksService.emit(AppEvents.EXTENSION_CREATE, {
      extensionId: res.id,
      extension: param.extension,
      req: param.req,
    });

    // 返回创建结果
    return res;
  }

  // 更新现有扩展的方法
  // 参数：上下文和包含扩展ID、扩展数据与请求对象的参数
  async extensionUpdate(
    context: NcContext,
    param: {
      extensionId: string;
      extension: ExtensionReqType;
      req: NcRequest;
    },
  ) {
    // 验证扩展数据是否符合 Swagger 定义的模式
    validatePayload(
      'swagger.json#/components/schemas/ExtensionReq',
      param.extension,
    );

    // 调用 Extension 模型的 update 方法更新扩展
    const res = await Extension.update(
      context,
      param.extensionId,
      param.extension,
    );

    // 触发扩展更新事件
    this.appHooksService.emit(AppEvents.EXTENSION_UPDATE, {
      extensionId: param.extensionId,
      extension: param.extension,
      req: param.req,
    });

    // 返回更新结果
    return res;
  }

  // 删除扩展的方法
  // 参数：上下文和包含扩展ID与请求对象的参数
  async extensionDelete(
    context: NcContext,
    param: { extensionId: string; req: NcRequest },
  ) {
    // 调用 Extension 模型的 delete 方法删除扩展
    const res = await Extension.delete(context, param.extensionId);

    // 触发扩展删除事件
    this.appHooksService.emit(AppEvents.EXTENSION_DELETE, {
      extensionId: param.extensionId,
      req: param.req,
    });

    // 返回删除结果
    return res;
  }
}
