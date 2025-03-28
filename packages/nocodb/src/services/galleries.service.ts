// 导入 NestJS 的 Injectable 装饰器，用于声明该类可以被依赖注入
import { Injectable } from '@nestjs/common';
// 导入应用事件和视图类型的枚举
import { AppEvents, ViewTypes } from 'nocodb-sdk';
// 导入类型定义：画廊更新请求类型、用户类型和视图创建请求类型
import type {
  GalleryUpdateReqType,
  UserType,
  ViewCreateReqType,
} from 'nocodb-sdk';
// 导入应用上下文和请求接口类型
import type { NcContext, NcRequest } from '~/interface/config';
// 导入应用钩子服务
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
// 导入负载验证工具函数
import { validatePayload } from '~/helpers';
// 导入错误处理工具
import { NcError } from '~/helpers/catchError';
// 导入相关模型类
import { GalleryView, Model, User, View } from '~/models';
// 导入缓存工具
import NocoCache from '~/cache/NocoCache';
// 导入缓存作用域常量
import { CacheScope } from '~/utils/globals';

// 使用 Injectable 装饰器标记该服务类可被依赖注入
@Injectable()
export class GalleriesService {
  // 构造函数，注入 AppHooksService 服务
  constructor(private readonly appHooksService: AppHooksService) {}

  // 获取画廊视图的方法
  async galleryViewGet(context: NcContext, param: { galleryViewId: string }) {
    return await GalleryView.get(context, param.galleryViewId);
  }

  // 创建画廊视图的方法
  async galleryViewCreate(
    context: NcContext,
    param: {
      tableId: string;
      gallery: ViewCreateReqType;
      user: UserType;
      ownedBy?: string;
      req: NcRequest;
    },
  ) {
    // 验证请求负载是否符合 swagger 定义的格式
    validatePayload(
      'swagger.json#/components/schemas/ViewCreateReq',
      param.gallery,
    );

    // 获取对应的数据模型
    const model = await Model.get(context, param.tableId);

    // 插入视图元数据
    const { id } = await View.insertMetaOnly(context, {
      view: {
        ...param.gallery,
        // todo: sanitize
        fk_model_id: param.tableId,
        type: ViewTypes.GALLERY,
        base_id: model.base_id,
        source_id: model.source_id,
        created_by: param.user?.id,
        owned_by: param.ownedBy || param.user?.id,
      },
      model,
      req: param.req,
    });

    // 获取新创建的视图并更新缓存
    const view = await View.get(context, id);
    await NocoCache.appendToList(
      CacheScope.VIEW,
      [view.fk_model_id],
      `${CacheScope.VIEW}:${id}`,
    );

    // 设置视图所有者
    let owner = param.req.user;

    // 如果指定了所有者，则获取所有者信息
    if (param.ownedBy) {
      owner = await User.get(param.ownedBy);
    }

    // 触发画廊创建事件
    this.appHooksService.emit(AppEvents.GALLERY_CREATE, {
      view: {
        ...param.gallery,
        ...view,
      },
      req: param.req,
      owner,
      context,
    });
    return view;
  }

  // 更新画廊视图的方法
  async galleryViewUpdate(
    context: NcContext,
    param: {
      galleryViewId: string;
      gallery: GalleryUpdateReqType;
      req: NcRequest;
    },
  ) {
    // 验证更新请求的负载
    validatePayload(
      'swagger.json#/components/schemas/GalleryUpdateReq',
      param.gallery,
    );

    // 获取要更新的视图
    const view = await View.get(context, param.galleryViewId);

    // 如果视图不存在，抛出错误
    if (!view) {
      NcError.viewNotFound(param.galleryViewId);
    }

    // 获取旧的画廊视图数据
    const oldGalleryView = await GalleryView.get(context, param.galleryViewId);

    // 执行更新操作
    const res = await GalleryView.update(
      context,
      param.galleryViewId,
      param.gallery,
    );

    // 设置视图所有者
    let owner = param.req.user;

    // 如果视图属于其他用户，获取实际所有者信息
    if (view.owned_by && view.owned_by !== param.req.user?.id) {
      owner = await User.get(view.owned_by);
    }

    // 触发画廊更新事件
    this.appHooksService.emit(AppEvents.GALLERY_UPDATE, {
      view,
      galleryView: param.gallery,
      oldGalleryView,
      oldView: view,
      req: param.req,
      context,
      owner,
    });

    return res;
  }
}
