// 导入所需的 NestJS 装饰器和类型
import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
// 导入 Express 的 Response 类型
import { Response } from 'express';
// 导入 XLSX 库用于处理 Excel 文件
import * as XLSX from 'xlsx';
// 导入应用事件枚举
import { AppEvents } from 'nocodb-sdk';
// 导入全局守卫
import { GlobalGuard } from '~/guards/global/global.guard';
// 导入数据服务
import { DatasService } from '~/services/datas.service';
// 导入数据提取辅助函数
import { extractCsvData, extractXlsxData } from '~/helpers/dataHelpers';
// 导入视图模型
import { View } from '~/models';
// 导入访问控制中间件
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
// 导入数据 API 限制守卫
import { DataApiLimiterGuard } from '~/guards/data-api-limiter.guard';
// 导入租户上下文装饰器
import { TenantContext } from '~/decorators/tenant-context.decorator';
// 导入上下文和请求接口类型
import { NcContext, NcRequest } from '~/interface/config';
// 导入应用钩子服务
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';

// 声明该类为控制器
@Controller()
// 使用数据 API 限制守卫和全局守卫
@UseGuards(DataApiLimiterGuard, GlobalGuard)
export class DataAliasExportController {
  // 构造函数，注入所需的服务
  constructor(
    private datasService: DatasService,
    private readonly appHooksService: AppHooksService,
  ) {}

  // 定义 Excel 导出路由，支持带视图和不带视图两种路径
  @Get([
    '/api/v1/db/data/:orgs/:baseName/:tableName/export/excel',
    '/api/v1/db/data/:orgs/:baseName/:tableName/views/:viewName/export/excel',
  ])
  // 使用访问控制装饰器，限制 Excel 导出权限
  @Acl('exportExcel')
  async excelDataExport(
    // 注入租户上下文
    @TenantContext() context: NcContext,
    // 注入请求对象
    @Req() req: NcRequest,
    // 注入响应对象
    @Res() res: Response,
  ) {
    // 从请求中获取模型和视图信息
    const { model, view } =
      await this.datasService.getViewAndModelFromRequestByAliasOrId(
        context,
        req,
      );
    // 设置目标视图
    let targetView = view;
    // 如果没有指定视图，则获取默认视图
    if (!targetView) {
      targetView = await View.getDefaultView(context, model.id);
    }
    // 提取 Excel 数据，包括偏移量、耗时和实际数据
    const { offset, elapsed, data } = await extractXlsxData(
      context,
      targetView,
      req,
    );
    // 创建新的工作簿
    const wb = XLSX.utils.book_new();
    // 将数据添加到工作表中
    XLSX.utils.book_append_sheet(wb, data, targetView.title);
    // 将工作簿写入缓冲区，支持 base64 或 buffer 格式
    const buf = XLSX.write(wb, {
      type: req.query.encoding === 'base64' ? 'base64' : 'buffer',
      bookType: 'xlsx',
    });

    // 触发数据导出事件
    this.appHooksService.emit(AppEvents.DATA_EXPORT, {
      context,
      req,
      table: model,
      view: targetView,
      type: 'excel',
    });

    // 设置响应头
    res.set({
      'Access-Control-Expose-Headers': 'nc-export-offset',
      'nc-export-offset': offset,
      'nc-export-elapsed-time': elapsed,
      'Content-Disposition': `attachment; filename="${encodeURI(
        targetView.title,
      )}-export.xlsx"`,
    });
    // 发送响应
    res.end(buf);
  }

  // 定义 CSV 导出路由，支持带视图和不带视图两种路径
  @Get([
    '/api/v1/db/data/:orgs/:baseName/:tableName/views/:viewName/export/csv',
    '/api/v1/db/data/:orgs/:baseName/:tableName/export/csv',
  ])
  // 使用访问控制装饰器，限制 CSV 导出权限
  @Acl('exportCsv')
  async csvDataExport(
    // 注入租户上下文
    @TenantContext() context: NcContext,
    // 注入请求对象
    @Req() req: NcRequest,
    // 注入响应对象
    @Res() res: Response,
  ) {
    // 从请求中获取模型和视图信息
    const { model, view } =
      await this.datasService.getViewAndModelFromRequestByAliasOrId(
        context,
        req,
      );
    // 设置目标视图
    let targetView = view;
    // 如果没有指定视图，则获取默认视图
    if (!targetView) {
      targetView = await View.getDefaultView(context, model.id);
    }
    // 提取 CSV 数据，包括偏移量、耗时和实际数据
    const { offset, elapsed, data } = await extractCsvData(
      context,
      targetView,
      req,
    );

    // 触发数据导出事件
    this.appHooksService.emit(AppEvents.DATA_EXPORT, {
      context,
      req,
      table: model,
      view: targetView,
      type: 'csv',
    });

    // 设置响应头
    res.set({
      'Access-Control-Expose-Headers': 'nc-export-offset',
      'nc-export-offset': offset,
      'nc-export-elapsed-time': elapsed,
      'Content-Disposition': `attachment; filename="${encodeURI(
        targetView.title,
      )}-export.csv"`,
    });
    // 发送响应
    res.send(data);
  }
}
