// 导入 Node.js 的路径处理模块
import path from 'path';
// 导入 URL 解析模块
import Url from 'url';
// 导入流处理模块中的 Readable 类
import { Readable } from 'stream';
// 从 nocodb-sdk 导入应用事件和公共附件作用域枚举
import { AppEvents, PublicAttachmentScope } from 'nocodb-sdk';
// 从 NestJS 导入依赖注入相关装饰器和类
import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
// 导入 nanoid 用于生成唯一标识符
import { nanoid } from 'nanoid';
// 导入 mime 类型识别库的轻量版
import mime from 'mime/lite';
// 导入 slash 用于规范化路径分隔符
import slash from 'slash';
// 导入 p-queue 用于控制并发任务
import PQueue from 'p-queue';
// 导入 axios 用于 HTTP 请求
import axios from 'axios';
// 导入 object-hash 用于对象哈希计算
import hash from 'object-hash';
// 导入 moment 用于日期时间处理
import moment from 'moment';
// 导入类型定义
import type { AttachmentReqType, FileType } from 'nocodb-sdk';
// 导入请求接口类型
import type { NcRequest } from '~/interface/config';
// 导入应用钩子服务
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
// 导入插件管理器
import NcPluginMgrv2 from '~/helpers/NcPluginMgrv2';
// 导入 MIME 类型图标映射
import { mimeIcons } from '~/utils/mimeTypes';
// 导入文件引用和预签名 URL 模型
import { FileReference, PresignedUrl } from '~/models';
// 导入 UTF8 转换辅助函数
import { utf8ify } from '~/helpers/stringHelpers';
// 导入错误处理辅助类
import { NcError } from '~/helpers/catchError';
// 导入作业服务接口
import { IJobsService } from '~/modules/jobs/jobs-service.interface';
// 导入作业类型枚举
import { JobTypes } from '~/interface/Jobs';
// 导入根作用域常量
import { RootScopes } from '~/utils/globals';
// 导入本地路径验证和规范化函数
import { validateAndNormaliseLocalPath } from '~/helpers/attachmentHelpers';
// 导入 Noco 主类
import Noco from '~/Noco';
// 导入工作线程装饰器
import { UseWorker } from '~/decorators/use-worker.decorator';

// 定义附件对象接口
interface AttachmentObject {
  // 附件的 URL
  url?: string;
  // 附件的路径
  path?: string;
  // 附件的标题
  title: string;
  // 附件的 MIME 类型
  mimetype: string;
  // 附件的大小（字节）
  size: number;
  // 附件的图标
  icon?: string;
  // 签名后的路径
  signedPath?: string;
  // 签名后的 URL
  signedUrl?: string;
}

// 定义需要生成缩略图的 MIME 类型前缀
const thumbnailMimes = ['image/'];

// 文件名规范化函数，参考 AWS S3 对象键命名规则，并扩展了一些字符
// 将特殊字符替换为下划线
const normalizeFilename = (filename: string) => {
  return filename.replace(/[\\/:*?"<>'`#|%~{}[\]^]/g, '_');
};

// 使用 NestJS 的 Injectable 装饰器标记该服务可被注入
@Injectable()
export class AttachmentsService {
  // 创建日志记录器实例
  protected logger = new Logger(AttachmentsService.name);

  // 构造函数，注入依赖服务
  constructor(
    // 注入应用钩子服务
    private readonly appHooksService: AppHooksService,
    // 使用 forwardRef 解决循环依赖问题，注入作业服务
    @Inject(forwardRef(() => 'JobsService'))
    private readonly jobsService: IJobsService,
  ) {}

  // 上传文件方法
  async upload(param: {
    // 文件数组
    files: FileType[];
    // 请求对象
    req: NcRequest;
    // 可选的路径
    path?: string;
    // 可选的作用域
    scope?: PublicAttachmentScope;
  }) {
    // 验证作用域是否有效
    if (
      param.scope &&
      !Object.values(PublicAttachmentScope).includes(param.scope)
    ) {
      NcError.invalidAttachmentUploadScope();
    }

    // 获取用户 ID，如果不存在则使用 'anonymous'
    const userId = param.req?.user?.id || 'anonymous';

    // 设置路径：如果有作用域则使用用户 ID 的哈希值，否则使用提供的路径或基于日期和用户 ID 的默认路径
    param.path = param.scope
      ? `${hash(userId)}`
      : param.path || `${moment().format('YYYY/MM/DD')}/${hash(userId)}`;

    // TODO: 添加 getAjvValidatorMw
    // 规范化文件路径
    const _filePath = this.sanitizeUrlPath(
      param.path?.toString()?.split('/') || [''],
    );
    // 构建目标路径
    const _destPath = path.join(
      'nc',
      param.scope ? param.scope : 'uploads',
      ..._filePath,
    );

    // 获取存储适配器
    const storageAdapter = await NcPluginMgrv2.storageAdapter();

    // 创建队列，控制并发任务数量（将来可能增加并发数）
    const queue = new PQueue({ concurrency: 1 });

    // 存储附件数组
    const attachments = [];
    // 存储错误数组
    const errors = [];

    // 检查是否提供了文件
    if (!param.files?.length) {
      NcError.badRequest('No attachment provided!');
    }

    // 将文件处理任务添加到队列
    queue.addAll(
      param.files?.map((file) => async () => {
        try {
          // 生成唯一标识符
          const nanoId = nanoid(5);

          // 构建文件路径
          const filePath = this.sanitizeUrlPath([
            ...(param?.path?.toString()?.split('/') || ['']),
            ...(param.scope ? [nanoId] : []),
          ]);

          // 确定目标路径
          const destPath = param.scope
            ? path.join(_destPath, `${nanoId}`)
            : _destPath;

          // 获取原始文件名并进行 UTF-8 转换
          const originalName = utf8ify(file.originalname);
          // 构建最终文件名
          const fileName = param.scope
            ? `${normalizeFilename(
                path.parse(originalName).name,
              )}${path.extname(originalName)}`
            : `${normalizeFilename(path.parse(originalName).name)}_${nanoid(
                5,
              )}${path.extname(originalName)}`;

          // 临时元数据对象，用于存储图片尺寸信息
          const tempMetadata: {
            width?: number;
            height?: number;
          } = {};

          // 如果是图片文件，尝试获取其尺寸信息
          if (file.mimetype.includes('image')) {
            const sharp = Noco.sharp;

            if (sharp) {
              try {
                // 使用 sharp 获取图片元数据
                const metadata = await sharp(file.path, {
                  limitInputPixels: false,
                }).metadata();

                // 如果获取到宽高信息，则保存到临时元数据中
                if (metadata.width && metadata.height) {
                  tempMetadata.width = metadata.width;
                  tempMetadata.height = metadata.height;
                }
              } catch (e) {
                // 记录错误日志
                this.logger.error(`${file.path} is not an image file`);
              }
            }
          }

          // 使用存储适配器创建文件
          const url = await storageAdapter.fileCreate(
            slash(path.join(destPath, fileName)),
            file,
          );

          // 在数据库中插入文件引用记录
          await FileReference.insert(
            {
              workspace_id: RootScopes.ROOT,
              base_id: RootScopes.ROOT,
            },
            {
              storage: storageAdapter.name,
              file_url:
                url ?? path.join('download', filePath.join('/'), fileName),
              file_size: file.size,
              fk_user_id: userId,
              deleted: true, // 根文件引用始终标记为已删除，因为它们不与任何记录关联
            },
          );

          // 创建附件对象
          const attachment: AttachmentObject = {
            ...(url
              ? { url }
              : {
                  path: path.join('download', filePath.join('/'), fileName),
                }),
            title: originalName,
            mimetype: file.mimetype,
            size: file.size,
            icon: mimeIcons[path.extname(originalName).slice(1)] || undefined,
            ...tempMetadata,
          };

          // 为附件生成预签名 URL
          await PresignedUrl.signAttachment({ attachment });

          // 将附件添加到结果数组
          attachments.push(attachment);
        } catch (e) {
          // 捕获错误并添加到错误数组
          errors.push(e);
        }
      }),
    );

    // 等待队列中的所有任务完成
    await queue.onIdle();

    // 如果有错误，记录并抛出第一个错误
    if (errors.length) {
      for (const error of errors) {
        this.logger.error(error);
      }
      throw errors[0];
    }

    // 筛选需要生成缩略图的附件（图片类型）
    const generateThumbnail = attachments.filter((attachment) =>
      thumbnailMimes.some((type) => attachment.mimetype.startsWith(type)),
    );

    // 如果有需要生成缩略图的附件，添加缩略图生成任务
    if (generateThumbnail.length) {
      await this.jobsService.add(JobTypes.ThumbnailGenerator, {
        context: {
          base_id: RootScopes.ROOT,
          workspace_id: RootScopes.ROOT,
        },
        attachments: generateThumbnail,
        scope: param.scope,
      });
    }

    // 触发附件上传事件
    this.appHooksService.emit(AppEvents.ATTACHMENT_UPLOAD, {
      type: 'file',
      req: param.req,
    });

    // 返回上传的附件数组
    return attachments;
  }

  // 通过 URL 上传文件方法，使用工作线程处理
  @UseWorker()
  async uploadViaURL(param: {
    // URL 数组
    urls: AttachmentReqType[];
    // 请求对象
    req: NcRequest;
    // 可选的路径
    path?: string;
    // 可选的作用域
    scope?: PublicAttachmentScope;
  }) {
    // 验证作用域是否有效
    if (
      param.scope &&
      !Object.values(PublicAttachmentScope).includes(param.scope)
    ) {
      NcError.invalidAttachmentUploadScope();
    }

    // 获取用户 ID，如果不存在则使用 'anonymous'
    const userId = param.req?.user?.id || 'anonymous';

    // 设置路径：如果有作用域则使用用户 ID 的哈希值，否则使用提供的路径或基于日期和用户 ID 的默认路径
    param.path = param.scope
      ? `${hash(userId)}`
      : param.path || `${moment().format('YYYY/MM/DD')}/${hash(userId)}`;

    // 规范化文件路径
    const filePath = this.sanitizeUrlPath(
      param?.path?.toString()?.split('/') || [''],
    );

    // 构建目标路径
    const destPath = path.join(
      'nc',
      param.scope ? param.scope : 'uploads',
      ...filePath,
    );

    // 获取存储适配器
    const storageAdapter = await NcPluginMgrv2.storageAdapter();

    // 创建队列，控制并发任务数量（将来可能增加并发数）
    const queue = new PQueue({ concurrency: 1 });

    // 存储附件数组
    const attachments = [];
    // 存储错误数组
    const errors = [];

    // 检查是否提供了 URL
    if (!param.urls?.length) {
      NcError.badRequest('No attachment provided!');
    }

    // 将 URL 处理任务添加到队列
    queue.addAll(
      param.urls?.map?.((urlMeta) => async () => {
        try {
          // 从 URL 元数据中获取 URL 和文件名
          const { url, fileName: _fileName } = urlMeta;

          // 生成唯一标识符
          const nanoId = nanoid(5);

          // 构建文件路径
          const filePath = this.sanitizeUrlPath([
            ...(param.scope ? [param.scope] : []),
            ...(param?.path?.toString()?.split('/') || ['']),
            ...(param.scope ? [nanoId] : []),
          ]);

          // 确定文件目标路径
          const fileDestPath = param.scope
            ? path.join(destPath, `${nanoId}`)
            : destPath;

          // 声明变量用于存储 MIME 类型、响应、大小和最终 URL
          let mimeType,
            response,
            size,
            finalUrl = url;

          // 声明变量用于处理 base64 数据
          let base64TempStream: Readable;
          let base64Buffer: Buffer;

          // 处理不同类型的 URL
          if (!url.startsWith('data:')) {
            // 如果不是 data URL，发送 HEAD 请求获取元数据
            response = await axios.head(url, { maxRedirects: 5 });
            mimeType = response.headers['content-type']?.split(';')[0];
            size = response.headers['content-length'];
            finalUrl = response.request.res.responseUrl;
          } else {
            // 如果是 data URL，解析其内容
            if (!url.startsWith('data')) {
              NcError.badRequest('Invalid data URL format');
            }

            // 分割 data URL 的元数据和数据部分
            const [metadata, base64Data] = url.split(',');

            // 解析元数据
            const metadataHelper = metadata.split(':');

            // 验证元数据格式
            if (metadataHelper.length < 2) {
              NcError.badRequest('Invalid data URL format');
            }

            // 获取 MIME 类型
            const mimetypeHelper = metadataHelper[1].split(';');

            // 设置 MIME 类型、大小，并创建 base64 缓冲区和流
            mimeType = mimetypeHelper[0];
            size = Buffer.byteLength(base64Data, 'base64');
            base64Buffer = Buffer.from(base64Data, 'base64');
            base64TempStream = Readable.from(base64Buffer);
          }

          // 解析 URL 并获取文件名
          const parsedUrl = Url.parse(finalUrl, true);
          const decodedPath = decodeURIComponent(parsedUrl.pathname);
          const fileNameWithExt = _fileName || path.basename(decodedPath);

          // 构建最终文件名
          const fileName = param.scope
            ? `${normalizeFilename(
                path.parse(fileNameWithExt).name,
              )}${path.extname(fileNameWithExt)}`
            : `${normalizeFilename(path.parse(fileNameWithExt).name)}_${nanoid(
                5,
              )}${path.extname(fileNameWithExt)}`;

          // 如果没有 MIME 类型，根据文件扩展名推断
          if (!mimeType) {
            mimeType = mime.getType(path.extname(fileNameWithExt).slice(1));
          }

          // 声明变量用于存储附件 URL 和文件数据
          let attachmentUrl, file;

          // 根据不同情况创建文件
          if (!base64TempStream) {
            // 如果不是 base64 数据，通过 URL 创建文件
            const { url: _attachmentUrl, data: _file } =
              await storageAdapter.fileCreateByUrl(
                slash(path.join(fileDestPath, fileName)),
                finalUrl,
                {
                  fetchOptions: {
                    // sharp 需要图像作为缓冲区传递
                    buffer: mimeType.includes('image'),
                  },
                },
              );

            attachmentUrl = _attachmentUrl;
            file = _file;
          } else {
            // 如果是 base64 数据，通过流创建文件
            attachmentUrl = await storageAdapter.fileCreateByStream(
              slash(path.join(fileDestPath, fileName)),
              base64TempStream,
            );

            file = base64Buffer;
          }

          // 临时元数据对象，用于存储图片尺寸信息
          const tempMetadata: {
            width?: number;
            height?: number;
          } = {};

          // 如果是图片文件，尝试获取其尺寸信息
          if (mimeType.includes('image')) {
            const sharp = Noco.sharp;

            if (sharp) {
              try {
                // 使用 sharp 获取图片元数据
                const metadata = await sharp(file, {
                  limitInputPixels: true,
                }).metadata();

                // 如果获取到宽高信息，则保存到临时元数据中
                if (metadata.width && metadata.height) {
                  tempMetadata.width = metadata.width;
                  tempMetadata.height = metadata.height;
                }
              } catch (e) {
                // 记录错误日志
                this.logger.error(`${file.path} is not an image file`);
              }
            }
          }

          // 在数据库中插入文件引用记录
          await FileReference.insert(
            {
              workspace_id: RootScopes.ROOT,
              base_id: RootScopes.ROOT,
            },
            {
              storage: storageAdapter.name,
              file_url:
                attachmentUrl ??
                path.join('download', filePath.join('/'), fileName),
              file_size: size ? parseInt(size) : urlMeta.size,
              fk_user_id: userId,
              deleted: true, // 根文件引用始终标记为已删除，因为它们不与任何记录关联
            },
          );

          // 创建附件对象
          const attachment: AttachmentObject = {
            ...(attachmentUrl
              ? { url: attachmentUrl }
              : {
                  path: path.join('download', filePath.join('/'), fileName),
                }),
            title: fileNameWithExt,
            mimetype: mimeType || urlMeta.mimetype,
            size: size ? parseInt(size) : urlMeta.size,
            icon:
              mimeIcons[path.extname(fileNameWithExt).slice(1)] || undefined,
            ...tempMetadata,
          };

          // 为附件生成预签名 URL
          await PresignedUrl.signAttachment({ attachment });

          // 将附件添加到结果数组
          attachments.push(attachment);
        } catch (e) {
          // 捕获错误并添加到错误数组
          errors.push(e);
        }
      }),
    );

    // 等待队列中的所有任务完成
    await queue.onIdle();

    // 如果有错误，记录并抛出第一个错误
    if (errors.length) {
      errors.forEach((error) => this.logger.error(error));
      throw errors[0];
    }

    // 筛选需要生成缩略图的附件（图片类型）
    const generateThumbnail = attachments.filter((attachment) =>
      thumbnailMimes.some((type) => attachment.mimetype.startsWith(type)),
    );

    // 如果有需要生成缩略图的附件，添加缩略图生成任务
    if (generateThumbnail.length) {
      await this.jobsService.add(JobTypes.ThumbnailGenerator, {
        context: {
          base_id: RootScopes.ROOT,
          workspace_id: RootScopes.ROOT,
        },
        attachments: generateThumbnail,
        scope: param.scope,
      });
    }

    // 触发附件上传事件
    this.appHooksService.emit(AppEvents.ATTACHMENT_UPLOAD, {
      type: 'url',
      req: param.req,
    });

    // 返回上传的附件数组
    return attachments;
  }

  // 获取文件方法
  async getFile(param: { path: string }): Promise<{
    path: string;
    type: string;
  }> {
    // 根据文件扩展名确定 MIME 类型，如果无法确定则默认为纯文本
    const type =
      mime.getType(path.extname(param.path).split('/').pop().slice(1)) ||
      'text/plain';

    // 验证并规范化本地路径
    const filePath = validateAndNormaliseLocalPath(param.path, true);
    return { path: filePath, type };
  }

  // 从记录中获取附件方法
  async getAttachmentFromRecord(param: {
    // 记录对象
    record: any;
    // 列定义
    column: { title: string };
    // URL 或路径
    urlOrPath: string;
  }) {
    // 解构参数
    const { record, column, urlOrPath } = param;

    // 获取附件数组
    const attachment = record[column.title];

    // 如果附件不存在或为空数组，抛出错误
    if (!attachment || !attachment.length) {
      NcError.genericNotFound('Attachment', urlOrPath);
    }

    // 查找匹配的文件对象
    const fileObject = attachment.find(
      (a) => a.url === urlOrPath || a.path === urlOrPath,
    );

    // 如果找不到匹配的文件对象，抛出错误
    if (!fileObject) {
      NcError.genericNotFound('Attachment', urlOrPath);
    }

    // 为附件生成预签名 URL
    await PresignedUrl.signAttachment({
      attachment: fileObject,
      preview: false,
      filename: fileObject.title,
      expireSeconds: 5 * 60,
    });

    // 返回附件的路径或 URL
    return {
      ...(fileObject?.path
        ? { path: fileObject.signedPath }
        : {
            url: fileObject.signedUrl,
          }),
    };
  }

  // URL 路径规范化方法
  sanitizeUrlPath(paths) {
    // 将路径中的特殊字符替换为下划线
    return paths.map((url) => url.replace(/[/.?#]+/g, '_'));
  }
}
