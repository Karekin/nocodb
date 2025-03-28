// 导入 Node.js 的 path 模块，用于处理文件路径
import path from 'path';
// 导入 NestJS 相关的装饰器和类型
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
// 导入文件上传拦截器
import { AnyFilesInterceptor } from '@nestjs/platform-express';
// 导入 Express 的 Response 类型
import { Response } from 'express';
// 导入用于设置内容处置的工具
import contentDisposition from 'content-disposition';
// 导入公共附件作用域类型
import { PublicAttachmentScope } from 'nocodb-sdk';
// 导入附件请求类型和文件类型的类型定义
import type { AttachmentReqType, FileType } from 'nocodb-sdk';
// 导入上传允许拦截器
import { UploadAllowedInterceptor } from '~/interceptors/is-upload-allowed/is-upload-allowed.interceptor';
// 导入全局守卫
import { GlobalGuard } from '~/guards/global/global.guard';
// 导入附件服务
import { AttachmentsService } from '~/services/attachments.service';
// 导入预签名 URL 模型
import { PresignedUrl } from '~/models';
// 导入元数据 API 限制器守卫
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
// 导入上下文和请求接口
import { NcContext, NcRequest } from '~/interface/config';
// 导入附件相关的辅助函数
import {
  ATTACHMENT_ROOTS,
  isPreviewAllowed,
  localFileExists,
} from '~/helpers/attachmentHelpers';
// 导入数据表服务
import { DataTableService } from '~/services/data-table.service';
// 导入租户上下文装饰器
import { TenantContext } from '~/decorators/tenant-context.decorator';
// 导入数据 API 限制器守卫
import { DataApiLimiterGuard } from '~/guards/data-api-limiter.guard';
// 导入访问控制中间件
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
// 导入列模型
import { Column } from '~/models';
// 导入错误处理工具
import { NcError } from '~/helpers/catchError';

// 声明这是一个控制器类
@Controller()
export class AttachmentsController {
  // 构造函数，注入所需的服务
  constructor(
    private readonly attachmentsService: AttachmentsService,
    private readonly dataTableService: DataTableService,
  ) {}

  // 文件上传接口
  @UseGuards(MetaApiLimiterGuard, GlobalGuard)
  @Post(['/api/v1/db/storage/upload', '/api/v2/storage/upload'])
  @HttpCode(200)
  @UseInterceptors(UploadAllowedInterceptor, AnyFilesInterceptor())
  async upload(
    @UploadedFiles() files: Array<FileType>,
    @Req() req: NcRequest,
    @Query('scope') scope?: PublicAttachmentScope,
  ) {
    const attachments = await this.attachmentsService.upload({
      files: files,
      path: req.query?.path?.toString(),
      req,
      scope,
    });

    return attachments;
  }

  // 通过 URL 上传文件接口
  @Post(['/api/v1/db/storage/upload-by-url', '/api/v2/storage/upload-by-url'])
  @HttpCode(200)
  @UseInterceptors(UploadAllowedInterceptor)
  @UseGuards(MetaApiLimiterGuard, GlobalGuard)
  async uploadViaURL(
    @Body() body: Array<AttachmentReqType>,
    @Query('path') path: string,
    @Req() req: NcRequest,
    @Query('scope') scope?: PublicAttachmentScope,
  ) {
    const attachments = await this.attachmentsService.uploadViaURL({
      urls: body,
      path,
      req,
      scope,
    });

    return attachments;
  }

  // 文件读取接口
  @Get('/download/:filename(*)')
  async fileRead(
    @Param('filename') filename: string,
    @Res() res: Response,
    @Query('filename') queryFilename?: string,
  ) {
    try {
      // 获取文件信息
      const file = await this.attachmentsService.getFile({
        path: path.join('nc', 'uploads', filename),
      });

      // 检查文件是否存在
      if (!(await localFileExists(file.path))) {
        return res.status(404).send('File not found');
      }

      // 根据文件类型决定是预览还是下载
      if (isPreviewAllowed({ mimetype: file.type, path: file.path })) {
        if (queryFilename) {
          res.setHeader(
            'Content-Disposition',
            contentDisposition(queryFilename, { type: 'attachment' }),
          );
        }
        res.sendFile(file.path);
      } else {
        res.download(file.path, queryFilename);
      }
    } catch (e) {
      res.status(404).send('Not found');
    }
  }

  // 文件读取接口 v2 版本
  @Get('/dl/:param1([a-zA-Z0-9_-]+)/:param2([a-zA-Z0-9_-]+)/:filename(*)')
  async fileReadv2(
    @Param('param1') param1: string,
    @Param('param2') param2: string,
    @Param('filename') filename: string,
    @Res() res: Response,
    @Query('filename') queryFilename?: string,
  ) {
    try {
      // 获取文件信息
      const file = await this.attachmentsService.getFile({
        path: path.join(
          'nc',
          param1,
          param2,
          'uploads',
          ...filename.split('/'),
        ),
      });

      // 检查文件是否存在
      if (!(await localFileExists(file.path))) {
        return res.status(404).send('File not found');
      }

      // 根据文件类型决定是预览还是下载
      if (isPreviewAllowed({ mimetype: file.type, path: file.path })) {
        if (queryFilename) {
          res.setHeader(
            'Content-Disposition',
            contentDisposition(queryFilename, { type: 'attachment' }),
          );
        }
        res.sendFile(file.path);
      } else {
        res.download(file.path, queryFilename);
      }
    } catch (e) {
      res.status(404).send('Not found');
    }
  }

  // 临时文件读取接口 v3 版本
  @Get('/dltemp/:param(*)')
  async fileReadv3(@Param('param') param: string, @Res() res: Response) {
    try {
      // 获取完整路径
      const fullPath = await PresignedUrl.getPath(`dltemp/${param}`);

      // 分割查询参数
      const queryHelper = fullPath.split('?');

      // 获取文件路径
      const fpath = queryHelper[0];

      // 初始化响应头参数
      let queryResponseContentType = null;
      let queryResponseContentDisposition = null;
      let queryResponseContentEncoding = null;

      // 解析查询参数
      if (queryHelper.length > 1) {
        const query = new URLSearchParams(queryHelper[1]);
        queryResponseContentType = query.get('ResponseContentType');
        queryResponseContentDisposition = query.get(
          'ResponseContentDisposition',
        );
        queryResponseContentEncoding = query.get('ResponseContentEncoding');
      }

      // 获取目标参数
      const targetParam = param.split('/')[2];

      // 确定文件路径
      const filePath = ATTACHMENT_ROOTS.includes(targetParam) ? '' : 'uploads';

      // 获取文件信息
      const file = await this.attachmentsService.getFile({
        path: path.join('nc', filePath, fpath),
      });

      // 检查文件是否存在
      if (!(await localFileExists(file.path))) {
        return res.status(404).send('File not found');
      }

      // 设置响应头
      if (queryResponseContentType) {
        res.setHeader('Content-Type', queryResponseContentType);

        if (queryResponseContentEncoding) {
          res.setHeader(
            'Content-Type',
            `${queryResponseContentType}; charset=${queryResponseContentEncoding}`,
          );
        }
      }

      if (queryResponseContentDisposition) {
        res.setHeader('Content-Disposition', queryResponseContentDisposition);
      }

      if (queryResponseContentEncoding) {
        res.setHeader('Content-Encoding', queryResponseContentEncoding);
      }

      // 发送文件
      res.sendFile(file.path);
    } catch (e) {
      res.status(404).send('Not found');
    }
  }

  // 下载附件接口
  @UseGuards(DataApiLimiterGuard, GlobalGuard)
  @Get('/api/v2/downloadAttachment/:modelId/:columnId/:rowId')
  @Acl('dataRead')
  async downloadAttachment(
    @TenantContext() context: NcContext,
    @Param('modelId') modelId: string,
    @Param('columnId') columnId: string,
    @Param('rowId') rowId: string,
    @Query('urlOrPath') urlOrPath: string,
  ) {
    // 获取列信息
    const column = await Column.get(context, {
      colId: columnId,
    });

    // 检查列是否存在
    if (!column) {
      NcError.fieldNotFound(columnId);
    }

    // 读取记录数据
    const record = await this.dataTableService.dataRead(context, {
      baseId: context.base_id,
      modelId,
      rowId,
      query: {
        fields: column.title,
      },
    });

    // 检查记录是否存在
    if (!record) {
      NcError.recordNotFound(rowId);
    }

    // 从记录中获取附件
    return this.attachmentsService.getAttachmentFromRecord({
      record,
      column,
      urlOrPath,
    });
  }
}
