import type {
  AttachmentResType, // 附件响应类型
  BoolType,          // 布尔类型
  FormType,          // 表单类型
  MetaType,          // 元数据类型
} from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';  // NocoDB上下文类型
import { PresignedUrl } from '~/models';              // 预签名URL模型
import FormViewColumn from '~/models/FormViewColumn'; // 表单视图列模型
import View from '~/models/View';                     // 视图模型
import { extractProps } from '~/helpers/extractProps'; // 属性提取工具
import NocoCache from '~/cache/NocoCache';            // 缓存管理
import Noco from '~/Noco';                            // NocoDB核心类
import { deserializeJSON, serializeJSON } from '~/utils/serialize'; // JSON序列化工具
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals'; // 缓存相关常量
import { prepareForDb, prepareForResponse } from '~/utils/modelUtils'; // 模型工具

// 表单视图类型，继承自FormType并排除banner_image_url和logo_url
type FormViewType = Omit<FormType, 'banner_image_url' | 'logo_url'> & {
  banner_image_url?: AttachmentResType | string; // 横幅图片URL
  logo_url?: AttachmentResType | string;         // Logo URL
};

// 表单视图类，实现FormViewType接口
export default class FormView implements FormViewType {
  show: BoolType;               // 是否显示
  is_default: BoolType;         // 是否为默认
  order: number;                // 排序
  title?: string;               // 标题
  heading?: string;             // 主标题
  subheading?: string;          // 副标题
  success_msg?: string;         // 成功消息
  redirect_url?: string;        // 重定向URL
  redirect_after_secs?: string; // 重定向延迟时间
  email?: string;               // 邮箱
  banner_image_url?: AttachmentResType | string; // 横幅图片URL
  logo_url?: AttachmentResType | string;         // Logo URL
  submit_another_form?: BoolType; // 是否允许提交另一个表单
  show_blank_form?: BoolType;     // 是否显示空白表单

  fk_view_id: string;           // 外键视图ID
  columns?: FormViewColumn[];    // 表单视图列数组
  fk_workspace_id?: string;     // 外键工作区ID
  base_id?: string;             // 基础ID
  source_id?: string;           // 源ID
  meta?: MetaType;              // 元数据

  // 构造函数
  constructor(data: FormView) {
    Object.assign(this, data);
  }

  // 获取表单视图
  public static async get(
    context: NcContext,
    viewId: string,
    ncMeta = Noco.ncMeta,
  ) {
    // 从缓存中获取视图
    let view =
      viewId &&
      (await NocoCache.get(
        `${CacheScope.FORM_VIEW}:${viewId}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!view) {
      // 如果缓存中没有，从数据库中获取
      view = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.FORM_VIEW,
        {
          fk_view_id: viewId,
        },
      );

      if (view) {
        // 反序列化元数据
        view.meta = deserializeJSON(view.meta);
        // 将视图存入缓存
        await NocoCache.set(`${CacheScope.FORM_VIEW}:${viewId}`, view);
      } else {
        return null;
      }
    }

    // 转换附件类型
    const convertedAttachment = await this.convertAttachmentType(
      {
        banner_image_url: view?.banner_image_url,
        logo_url: view?.logo_url,
      },
      ncMeta,
    );

    // 更新视图的附件URL
    view.banner_image_url = convertedAttachment.banner_image_url || null;
    view.logo_url = convertedAttachment.logo_url || null;

    // 返回新的FormView实例
    return view && new FormView(view);
  }

  // 插入新的表单视图
  static async insert(
    context: NcContext,
    view: Partial<FormView>,
    ncMeta = Noco.ncMeta,
  ) {
    // 提取需要插入的属性
    const insertObj = extractProps(view, [
      'fk_view_id',
      'base_id',
      'source_id',
      'heading',
      'subheading',
      'success_msg',
      'redirect_url',
      'redirect_after_secs',
      'email',
      'banner_image_url',
      'logo_url',
      'submit_another_form',
      'show_blank_form',
      'meta',
    ]);
    if (insertObj.meta) {
      // 序列化元数据
      insertObj.meta = serializeJSON(insertObj.meta);
    }

    // 序列化logo_url
    if (insertObj?.logo_url) {
      insertObj.logo_url = this.serializeAttachmentJSON(insertObj.logo_url);
    }

    // 序列化banner_image_url
    if (insertObj?.banner_image_url) {
      insertObj.banner_image_url = this.serializeAttachmentJSON(
        insertObj.banner_image_url,
      );
    }

    // 获取视图引用
    const viewRef = await View.get(context, view.fk_view_id, ncMeta);

    if (!view.source_id) {
      insertObj.source_id = viewRef.source_id;
    }
    // 插入到数据库
    await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.FORM_VIEW,
      insertObj,
      true,
    );

    // 返回新创建的表单视图
    return this.get(context, view.fk_view_id, ncMeta);
  }

  // 更新表单视图
  static async update(
    context: NcContext,
    formId: string,
    body: Partial<FormView>,
    ncMeta = Noco.ncMeta,
  ) {
    // 提取需要更新的属性
    const updateObj = extractProps(body, [
      'heading',
      'subheading',
      'success_msg',
      'redirect_url',
      'redirect_after_secs',
      'email',
      'banner_image_url',
      'logo_url',
      'submit_another_form',
      'show_blank_form',
      'meta',
    ]);

    // 序列化logo_url
    if (updateObj?.logo_url) {
      updateObj.logo_url = this.serializeAttachmentJSON(updateObj.logo_url);
    }

    // 序列化banner_image_url
    if (updateObj?.banner_image_url) {
      updateObj.banner_image_url = this.serializeAttachmentJSON(
        updateObj.banner_image_url,
      );
    }

    // 更新数据库
    const res = await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.FORM_VIEW,
      prepareForDb(updateObj),
      {
        fk_view_id: formId,
      },
    );

    // 更新缓存
    await NocoCache.update(
      `${CacheScope.FORM_VIEW}:${formId}`,
      prepareForResponse(updateObj),
    );

    return res;
  }

  // 获取表单视图的列
  async getColumns(context: NcContext, ncMeta = Noco.ncMeta) {
    return (this.columns = await FormViewColumn.list(
      context,
      this.fk_view_id,
      ncMeta,
    ));
  }

  // 获取包含信息的表单视图
  static async getWithInfo(
    context: NcContext,
    formViewId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const form = await this.get(context, formViewId, ncMeta);
    await form.getColumns(context, ncMeta);
    return form;
  }

  // 序列化附件JSON
  static serializeAttachmentJSON(attachment): string | null {
    if (attachment) {
      return serializeJSON(
        extractProps(deserializeJSON(attachment), [
          'url',
          'path',
          'title',
          'mimetype',
          'size',
          'icon',
        ]),
      );
    }
    return attachment;
  }

  // 转换附件类型
  protected static async convertAttachmentType(
    formAttachments: Record<string, any>,
    ncMeta = Noco.ncMeta,
  ) {
    try {
      if (formAttachments) {
        const promises = [];

        for (const key in formAttachments) {
          if (
            formAttachments[key] &&
            typeof formAttachments[key] === 'string'
          ) {
            formAttachments[key] = deserializeJSON(formAttachments[key]);
          }

          promises.push(
            PresignedUrl.signAttachment(
              {
                attachment: formAttachments[key],
              },
              ncMeta,
            ),
          );
        }
        await Promise.all(promises);
      }
    } catch {}
    return formAttachments;
  }
}
