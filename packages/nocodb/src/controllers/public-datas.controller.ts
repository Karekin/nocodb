// 导入所需的 NestJS 装饰器和工具
import {
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
// 导入文件拦截器，用于处理文件上传
import { AnyFilesInterceptor } from '@nestjs/platform-express';
// 导入公共数据服务
import { PublicDatasService } from '~/services/public-datas.service';
// 导入公共 API 限制守卫
import { PublicApiLimiterGuard } from '~/guards/public-api-limiter.guard';
// 导入租户上下文装饰器
import { TenantContext } from '~/decorators/tenant-context.decorator';
// 导入上下文和请求接口
import { NcContext, NcRequest } from '~/interface/config';
// 导入列模型
import { Column } from '~/models';
// 导入附件服务
import { AttachmentsService } from '~/services/attachments.service';
// 导入错误处理工具
import { NcError } from '~/helpers/catchError';

// 使用公共 API 限制守卫保护所有路由
@UseGuards(PublicApiLimiterGuard)
// 定义控制器
@Controller()
export class PublicDatasController {
  // 构造函数，注入所需的服务
  constructor(
    // 注入公共数据服务
    protected readonly publicDatasService: PublicDatasService,
    // 注入附件服务
    protected readonly attachmentsService: AttachmentsService,
  ) {}

  // 定义 GET 路由，用于获取共享视图的数据列表
  @Get([
    '/api/v1/db/public/shared-view/:sharedViewUuid/rows',
    '/api/v2/public/shared-view/:sharedViewUuid/rows',
  ])
  // 数据列表方法
  async dataList(
    // 获取租户上下文
    @TenantContext() context: NcContext,
    // 获取请求对象
    @Req() req: NcRequest,
    // 获取共享视图 UUID 参数
    @Param('sharedViewUuid') sharedViewUuid: string,
  ) {
    // 调用服务方法获取分页响应
    const pagedResponse = await this.publicDatasService.dataList(context, {
      // 传递查询参数
      query: req.query,
      // 传递密码（如果存在）
      password: req.headers?.['xc-password'] as string,
      // 传递共享视图 UUID
      sharedViewUuid,
    });
    // 返回分页响应
    return pagedResponse;
  }

  // 定义 GET 路由，用于获取共享视图的数据计数
  @Get(['/api/v2/public/shared-view/:sharedViewUuid/count'])
  // 数据计数方法
  async dataCount(
    // 获取租户上下文
    @TenantContext() context: NcContext,
    // 获取请求对象
    @Req() req: NcRequest,
    // 获取共享视图 UUID 参数
    @Param('sharedViewUuid') sharedViewUuid: string,
  ) {
    // 调用服务方法获取计数响应
    const pagedResponse = await this.publicDatasService.dataCount(context, {
      // 传递查询参数
      query: req.query,
      // 传递密码（如果存在）
      password: req.headers?.['xc-password'] as string,
      // 传递共享视图 UUID
      sharedViewUuid,
    });
    // 返回计数响应
    return pagedResponse;
  }

  // 定义 GET 路由，用于获取共享视图的聚合数据
  @Get([
    '/api/v1/db/public/shared-view/:sharedViewUuid/aggregate',
    '/api/v2/public/shared-view/:sharedViewUuid/aggregate',
  ])
  // 数据聚合方法
  async dataAggregate(
    // 获取租户上下文
    @TenantContext() context: NcContext,
    // 获取请求对象
    @Req() req: NcRequest,
    // 获取共享视图 UUID 参数
    @Param('sharedViewUuid') sharedViewUuid: string,
  ) {
    // 调用服务方法获取聚合响应
    const response = await this.publicDatasService.dataAggregate(context, {
      // 传递查询参数
      query: req.query,
      // 传递密码（如果存在）
      password: req.headers?.['xc-password'] as string,
      // 传递共享视图 UUID
      sharedViewUuid,
    });

    // 返回聚合响应
    return response;
  }

  // 定义 GET 路由，用于获取共享视图的分组数据
  @Get([
    '/api/v1/db/public/shared-view/:sharedViewUuid/groupby',
    '/api/v2/public/shared-view/:sharedViewUuid/groupby',
  ])
  // 数据分组方法
  async dataGroupBy(
    // 获取租户上下文
    @TenantContext() context: NcContext,
    // 获取请求对象
    @Req() req: NcRequest,
    // 获取共享视图 UUID 参数
    @Param('sharedViewUuid') sharedViewUuid: string,
  ) {
    // 调用服务方法获取分组响应并直接返回
    return await this.publicDatasService.dataGroupBy(context, {
      // 传递查询参数
      query: req.query,
      // 传递密码（如果存在）
      password: req.headers?.['xc-password'] as string,
      // 传递共享视图 UUID
      sharedViewUuid: sharedViewUuid,
    });
  }

  // 定义 GET 路由，用于获取按列分组的数据列表
  @Get([
    '/api/v1/db/public/shared-view/:sharedViewUuid/group/:columnId',
    '/api/v2/public/shared-view/:sharedViewUuid/group/:columnId',
  ])
  // 分组数据列表方法
  async groupedDataList(
    // 获取租户上下文
    @TenantContext() context: NcContext,
    // 获取请求对象
    @Req() req: NcRequest,
    // 获取共享视图 UUID 参数
    @Param('sharedViewUuid') sharedViewUuid: string,
    // 获取列 ID 参数
    @Param('columnId') columnId: string,
  ) {
    // 调用服务方法获取分组数据
    const groupedData = await this.publicDatasService.groupedDataList(context, {
      // 传递查询参数
      query: req.query,
      // 传递密码（如果存在）
      password: req.headers?.['xc-password'] as string,
      // 传递共享视图 UUID
      sharedViewUuid: sharedViewUuid,
      // 传递分组列 ID
      groupColumnId: columnId,
    });
    // 返回分组数据
    return groupedData;
  }

  // 定义 POST 路由，用于插入数据
  @Post([
    '/api/v1/db/public/shared-view/:sharedViewUuid/rows',
    '/api/v2/public/shared-view/:sharedViewUuid/rows',
  ])
  // 设置 HTTP 状态码为 200
  @HttpCode(200)
  // 使用文件拦截器处理文件上传
  @UseInterceptors(AnyFilesInterceptor())
  // 数据插入方法
  async dataInsert(
    // 获取租户上下文
    @TenantContext() context: NcContext,
    // 获取请求对象
    @Req() req: NcRequest,
    // 获取共享视图 UUID 参数
    @Param('sharedViewUuid') sharedViewUuid: string,
  ) {
    // 调用服务方法插入数据
    const insertResult = await this.publicDatasService.dataInsert(context, {
      // 传递共享视图 UUID
      sharedViewUuid: sharedViewUuid,
      // 传递密码（如果存在）
      password: req.headers?.['xc-password'] as string,
      // 传递请求体中的数据
      body: req.body?.data,
      // 传递站点 URL
      siteUrl: (req as any).ncSiteUrl,
      // 传递上传的文件
      files: req.files as any[],
      // 传递完整请求对象
      req,
    });

    // 返回插入结果
    return insertResult;
  }

  // 定义 GET 路由，用于获取嵌套关系数据
  @Get([
    '/api/v1/db/public/shared-view/:sharedViewUuid/nested/:columnId',
    '/api/v2/public/shared-view/:sharedViewUuid/nested/:columnId',
  ])
  // 关系数据列表方法
  async relDataList(
    // 获取租户上下文
    @TenantContext() context: NcContext,
    // 获取请求对象
    @Req() req: NcRequest,
    // 获取共享视图 UUID 参数
    @Param('sharedViewUuid') sharedViewUuid: string,
    // 获取列 ID 参数
    @Param('columnId') columnId: string,
  ) {
    // 初始化行数据变量
    let rowData: any;

    // 如果请求查询中包含 rowData 参数
    if (req.query.rowData) {
      try {
        // 尝试解析 JSON 字符串
        rowData = JSON.parse(req.query.rowData as string);
      } catch {
        // 解析失败时使用空对象
        rowData = {};
      }
    }

    // 调用服务方法获取关系数据
    const pagedResponse = await this.publicDatasService.relDataList(context, {
      // 传递查询参数
      query: req.query,
      // 传递密码（如果存在）
      password: req.headers?.['xc-password'] as string,
      // 传递共享视图 UUID
      sharedViewUuid: sharedViewUuid,
      // 传递列 ID
      columnId: columnId,
      // 传递行数据
      rowData,
    });

    // 返回分页响应
    return pagedResponse;
  }

  // 定义 GET 路由，用于获取多对多关系数据
  @Get([
    '/api/v1/db/public/shared-view/:sharedViewUuid/rows/:rowId/mm/:columnId',
    '/api/v2/public/shared-view/:sharedViewUuid/rows/:rowId/mm/:columnId',
  ])
  // 公共多对多列表方法
  async publicMmList(
    // 获取租户上下文
    @TenantContext() context: NcContext,
    // 获取请求对象
    @Req() req: NcRequest,
    // 获取共享视图 UUID 参数
    @Param('sharedViewUuid') sharedViewUuid: string,
    // 获取行 ID 参数
    @Param('rowId') rowId: string,
    // 获取列 ID 参数
    @Param('columnId') columnId: string,
  ) {
    // 调用服务方法获取多对多关系数据
    const paginatedResponse = await this.publicDatasService.publicMmList(
      context,
      {
        // 传递查询参数
        query: req.query,
        // 传递密码（如果存在）
        password: req.headers?.['xc-password'] as string,
        // 传递共享视图 UUID
        sharedViewUuid: sharedViewUuid,
        // 传递列 ID
        columnId: columnId,
        // 传递行 ID
        rowId: rowId,
      },
    );
    // 返回分页响应
    return paginatedResponse;
  }

  // 定义 GET 路由，用于获取一对多关系数据
  @Get([
    '/api/v1/db/public/shared-view/:sharedViewUuid/rows/:rowId/hm/:columnId',
    '/api/v2/public/shared-view/:sharedViewUuid/rows/:rowId/hm/:columnId',
  ])
  // 公共一对多列表方法
  async publicHmList(
    // 获取租户上下文
    @TenantContext() context: NcContext,
    // 获取请求对象
    @Req() req: NcRequest,
    // 获取共享视图 UUID 参数
    @Param('sharedViewUuid') sharedViewUuid: string,
    // 获取行 ID 参数
    @Param('rowId') rowId: string,
    // 获取列 ID 参数
    @Param('columnId') columnId: string,
  ) {
    // 调用服务方法获取一对多关系数据
    const paginatedResponse = await this.publicDatasService.publicHmList(
      context,
      {
        // 传递查询参数
        query: req.query,
        // 传递密码（如果存在）
        password: req.headers?.['xc-password'] as string,
        // 传递共享视图 UUID
        sharedViewUuid: sharedViewUuid,
        // 传递列 ID
        columnId: columnId,
        // 传递行 ID
        rowId: rowId,
      },
    );
    // 返回分页响应
    return paginatedResponse;
  }

  // 定义 GET 路由，用于下载公共附件
  @Get(
    '/api/v2/public/shared-view/:sharedViewUuid/downloadAttachment/:columnId/:rowId',
  )
  // 下载公共附件方法
  async downloadPublicAttachment(
    // 获取租户上下文
    @TenantContext() context: NcContext,
    // 获取请求对象
    @Req() req: NcRequest,
    // 获取共享视图 UUID 参数
    @Param('sharedViewUuid') sharedViewUuid: string,
    // 获取列 ID 参数
    @Param('columnId') columnId: string,
    // 获取行 ID 参数
    @Param('rowId') rowId: string,
    // 获取 URL 或路径查询参数
    @Query('urlOrPath') urlOrPath: string,
  ) {
    // 获取列信息
    const column = await Column.get(context, {
      colId: columnId,
    });

    // 如果列不存在，抛出字段未找到错误
    if (!column) {
      NcError.fieldNotFound(columnId);
    }

    // 读取记录数据
    const record = await this.publicDatasService.dataRead(context, {
      sharedViewUuid,
      query: {
        fields: column.title,
      },
      rowId,
      password: req.headers?.['xc-password'] as string,
    });

    // 如果记录不存在，抛出记录未找到错误
    if (!record) {
      NcError.recordNotFound(rowId);
    }

    // 从记录中获取附件并返回
    return this.attachmentsService.getAttachmentFromRecord({
      record,
      column,
      urlOrPath,
    });
  }

  // 定义 POST 路由，用于批量获取数据列表
  @Post(['/api/v2/public/shared-view/:sharedViewUuid/bulk/dataList'])
  // 批量数据列表方法
  async bulkDataList(
    // 获取租户上下文
    @TenantContext() context: NcContext,
    // 获取请求对象
    @Req() req: NcRequest,
    // 获取共享视图 UUID 参数
    @Param('sharedViewUuid') sharedViewUuid: string,
  ) {
    // 调用服务方法获取批量数据
    const response = await this.publicDatasService.bulkDataList(context, {
      // 传递查询参数
      query: req.query,
      // 传递密码（如果存在）
      password: req.headers?.['xc-password'] as string,
      // 传递共享视图 UUID
      sharedViewUuid,
      // 传递请求体
      body: req.body,
    });

    // 返回响应
    return response;
  }

  // 定义 POST 路由，用于批量分组数据
  @Post(['/api/v2/public/shared-view/:sharedViewUuid/bulk/group'])
  // 批量分组方法
  async bulkGroupBy(
    // 获取租户上下文
    @TenantContext() context: NcContext,
    // 获取请求对象
    @Req() req: NcRequest,
    // 获取共享视图 UUID 参数
    @Param('sharedViewUuid') sharedViewUuid: string,
  ) {
    // 调用服务方法获取批量分组数据
    const response = await this.publicDatasService.bulkGroupBy(context, {
      // 传递查询参数
      query: req.query,
      // 传递密码（如果存在）
      password: req.headers?.['xc-password'] as string,
      // 传递共享视图 UUID
      sharedViewUuid,
      // 传递请求体
      body: req.body,
    });

    // 返回响应
    return response;
  }
}
