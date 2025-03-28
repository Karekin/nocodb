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
// 导入公共附件作用域类型
import { PublicAttachmentScope } from 'nocodb-sdk';
// 导入附件请求类型和文件类型
import type { AttachmentReqType, FileType } from 'nocodb-sdk';
// 导入自定义请求接口
import type { NcRequest } from '~/interface/config';
// 导入上下文接口
import { NcContext } from '~/interface/config';
// 导入全局守卫
import { GlobalGuard } from '~/guards/global/global.guard';
// 导入附件服务
import { AttachmentsService } from '~/services/attachments.service';
// 导入数据模型
import { Column, PresignedUrl } from '~/models';
// 导入上传允许拦截器
import { UploadAllowedInterceptor } from '~/interceptors/is-upload-allowed/is-upload-allowed.interceptor';
// 导入元数据 API 限制守卫
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
// 导入数据表服务
import { DataTableService } from '~/services/data-table.service';
// 导入数据 API 限制守卫
import { DataApiLimiterGuard } from '~/guards/data-api-limiter.guard';
// 导入租户上下文装饰器
import { TenantContext } from '~/decorators/tenant-context.decorator';
// 导入访问控制中间件
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
// 导入错误处理工具
import { NcError } from '~/helpers/catchError';
// 导入附件相关的辅助函数
import { ATTACHMENT_ROOTS, localFileExists } from '~/helpers/attachmentHelpers';

// 声明附件安全控制器
@Controller()
export class AttachmentsSecureController {
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
    // 接收上传的文件数组
    @UploadedFiles() files: Array<FileType>,
    // 接收请求对象，包含用户信息
    @Req() req: NcRequest & { user: { id: string } },
    // 接收可选的作用域参数
    @Query('scope') scope?: PublicAttachmentScope,
  ) {
    // 调用附件服务进行上传处理
    const attachments = await this.attachmentsService.upload({
      files: files,
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
    // 接收 URL 数组
    @Body() body: Array<AttachmentReqType>,
    // 接收请求对象，包含用户信息
    @Req() req: NcRequest & { user: { id: string } },
    // 接收可选的作用域参数
    @Query('scope') scope?: PublicAttachmentScope,
  ) {
    // 调用附件服务进行 URL 上传处理
    const attachments = await this.attachmentsService.uploadViaURL({
      urls: body,
      req,
      scope,
    });

    return attachments;
  }

  // 文件读取接口 v3 版本
  @Get('/dltemp/:param(*)')
  async fileReadv3(@Param('param') param: string, @Res() res: Response) {
    try {
      // 获取完整的预签名 URL 路径
      const fullPath = await PresignedUrl.getPath(`dltemp/${param}`);

      // 分割查询字符串
      const queryHelper = fullPath.split('?');

      // 获取文件路径
      const fpath = queryHelper[0];

      // 初始化响应头参数
      let queryResponseContentType = null;
      let queryResponseContentDisposition = null;

      // 处理查询参数
      if (queryHelper.length > 1) {
        const query = new URLSearchParams(queryHelper[1]);
        queryResponseContentType = query.get('response-content-type');
        queryResponseContentDisposition = query.get(
          'response-content-disposition',
        );
      }

      // 获取目标参数
      const targetParam = param.split('/')[2];

      // 根据附件根目录确定文件路径
      const filePath = ATTACHMENT_ROOTS.includes(targetParam) ? '' : 'uploads';

      // 获取文件信息
      const file = await this.attachmentsService.getFile({
        path: path.join('nc', filePath, fpath),
      });

      // 检查文件是否存在
      if (!(await localFileExists(file.path))) {
        return res.status(404).send('File not found');
      }

      // 设置响应头的内容类型
      if (queryResponseContentType) {
        res.setHeader('Content-Type', queryResponseContentType);
      }

      // 设置响应头的内容处置方式
      if (queryResponseContentDisposition) {
        res.setHeader('Content-Disposition', queryResponseContentDisposition);
      }

      // 发送文件
      res.sendFile(file.path);
    } catch (e) {
      // 错误处理
      res.status(404).send('Not found');
    }
  }

  // 下载附件接口
  @UseGuards(DataApiLimiterGuard, GlobalGuard)
  @Get('/api/v2/downloadAttachment/:modelId/:columnId/:rowId')
  @Acl('dataRead')
  async downloadAttachment(
    // 接收租户上下文
    @TenantContext() context: NcContext,
    // 接收模型 ID
    @Param('modelId') modelId: string,
    // 接收列 ID
    @Param('columnId') columnId: string,
    // 接收行 ID
    @Param('rowId') rowId: string,
    // 接收 URL 或路径参数
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
