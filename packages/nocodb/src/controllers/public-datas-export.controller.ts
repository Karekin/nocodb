// 导入所需的 NestJS 装饰器和工具
import {
  Controller,
  Get,
  Param,
  Request,
  Response,
  UseGuards,
} from '@nestjs/common';
// 导入 nocodb-sdk 中的工具函数和类型
import { isSystemColumn, ViewTypes } from 'nocodb-sdk';
// 导入 Excel 处理库
import * as XLSX from 'xlsx';
// 导入 CSV 处理库
import papaparse from 'papaparse';
// 导入工具函数
import { fromEntries } from '~/utils';
import { nocoExecute } from '~/utils';
// 导入错误处理助手
import { NcError } from '~/helpers/catchError';
// 导入 AST 生成助手
import getAst from '~/helpers/getAst';
// 导入单元格值序列化助手
import { serializeCellValue } from '~/helpers/dataHelpers';
// 导入公共数据导出服务
import { PublicDatasExportService } from '~/services/public-datas-export.service';
// 导入数据库连接管理器
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
// 导入数据模型
import { Column, Model, Source, View } from '~/models';
// 导入公共 API 限制守卫
import { PublicApiLimiterGuard } from '~/guards/public-api-limiter.guard';
// 导入租户上下文装饰器
import { TenantContext } from '~/decorators/tenant-context.decorator';
// 导入 NcContext 接口
import { NcContext } from '~/interface/config';

// 使用 PublicApiLimiterGuard 守卫来限制 API 请求频率
@UseGuards(PublicApiLimiterGuard)
// 定义控制器
@Controller()
export class PublicDatasExportController {
  // 构造函数，注入公共数据导出服务
  constructor(
    private readonly publicDatasExportService: PublicDatasExportService,
  ) {}

  // 定义 Excel 导出的 GET 路由，支持 v1 和 v2 两个版本的 API
  @Get([
    '/api/v1/db/public/shared-view/:publicDataUuid/rows/export/excel',
    '/api/v2/public/shared-view/:publicDataUuid/rows/export/excel',
  ])
  async exportExcel(
    // 注入租户上下文
    @TenantContext() context: NcContext,
    // 注入请求对象
    @Request() req,
    // 注入响应对象
    @Response() res,
    // 获取路由参数中的公共数据 UUID
    @Param('publicDataUuid') publicDataUuid: string,
  ) {
    // 通过 UUID 获取视图
    const view = await View.getByUUID(context, publicDataUuid);
    // 如果视图不存在，抛出错误
    if (!view) NcError.viewNotFound(publicDataUuid);
    // 检查视图类型是否支持导出
    if (
      view.type !== ViewTypes.GRID &&
      view.type !== ViewTypes.KANBAN &&
      view.type !== ViewTypes.GALLERY &&
      view.type !== ViewTypes.CALENDAR &&
      view.type !== ViewTypes.MAP
    )
      NcError.notFound('Not found');

    // 检查视图密码是否正确
    if (view.password && view.password !== req.headers?.['xc-password']) {
      NcError.invalidSharedViewPassword();
    }

    // 检查是否允许下载，通常被称为 CSV 下载
    if (!view.meta?.allowCSVDownload) {
      NcError.forbidden('Download is not allowed for this view');
    }

    // 获取带有信息的模型
    const model = await view.getModelWithInfo(context);

    // 获取视图的列
    await view.getColumns(context);
    // 创建列 ID 到列对象的映射
    const modelColumnMap = model.columns.reduce((mapObj, cur) => {
      mapObj[cur.id] = cur;
      return mapObj;
    }, {});

    // 获取数据库行数据
    const { offset, dbRows, elapsed } = await this.getDbRows(
      context,
      model,
      view,
      req,
    );

    // 处理字段参数
    let fields = req.query.fields as string[];
    // 获取允许的列
    const allowedColumns = view.columns
      .filter((c) => c.show)
      .map((k) => modelColumnMap[k.fk_column_id])
      .filter((column) => !isSystemColumn(column) || view.show_system_fields)
      .map((k) => k.title);
    // 如果未指定字段或字段为空，使用所有允许的列
    if (!fields || fields.length === 0 || !Array.isArray(fields)) {
      fields = allowedColumns;
    } else {
      // 否则过滤出允许的字段
      fields = fields.filter((field) => allowedColumns.includes(field));
    }

    // 创建 Excel 工作表
    const data = XLSX.utils.json_to_sheet(
      dbRows.map((o: Record<string, any>) =>
        fromEntries(fields.map((f) => [f, o[f]])),
      ),
      { header: fields },
    );

    // 创建新的工作簿
    const wb = XLSX.utils.book_new();

    // 将工作表添加到工作簿
    XLSX.utils.book_append_sheet(wb, data, view.title);
    // 将工作簿写入缓冲区
    const buf = XLSX.write(wb, {
      type: req.query.encoding === 'base64' ? 'base64' : 'buffer',
      bookType: 'xlsx',
    });

    // 设置响应头
    res.set({
      'Access-Control-Expose-Headers': 'nc-export-offset',
      'nc-export-offset': offset,
      'nc-export-elapsed-time': elapsed,
      'Content-Disposition': `attachment; filename="${encodeURI(
        view.title,
      )}-export.xlsx"`,
    });
    // 发送响应
    res.end(buf);
  }

  // 定义 CSV 导出的 GET 路由，支持 v1 和 v2 两个版本的 API
  @Get([
    '/api/v1/db/public/shared-view/:publicDataUuid/rows/export/csv',
    '/api/v2/public/shared-view/:publicDataUuid/rows/export/csv',
  ])
  async exportCsv(
    // 注入租户上下文
    @TenantContext() context: NcContext,
    // 注入请求对象
    @Request() req,
    // 注入响应对象
    @Response() res,
  ) {
    // 通过 UUID 获取视图
    const view = await View.getByUUID(context, req.params.publicDataUuid);
    // 获取字段参数
    const fields = req.query.fields;

    // 如果视图不存在，抛出错误
    if (!view) NcError.viewNotFound(req.params.publicDataUuid);
    // 检查视图类型是否支持导出
    if (
      view.type !== ViewTypes.GRID &&
      view.type !== ViewTypes.KANBAN &&
      view.type !== ViewTypes.GALLERY &&
      view.type !== ViewTypes.CALENDAR &&
      view.type !== ViewTypes.MAP
    )
      NcError.notFound('Not found');

    // 检查视图密码是否正确
    if (view.password && view.password !== req.headers?.['xc-password']) {
      NcError.invalidSharedViewPassword();
    }

    // 检查是否允许下载
    if (!view.meta?.allowCSVDownload) {
      NcError.forbidden('Download is not allowed for this view');
    }

    // 获取带有信息的模型
    const model = await view.getModelWithInfo(context);
    // 获取视图的列
    await view.getColumns(context);

    // 获取数据库行数据
    const { offset, dbRows, elapsed } = await this.getDbRows(
      context,
      model,
      view,
      req,
    );

    // 使用 papaparse 将数据转换为 CSV 格式
    const data = papaparse.unparse(
      {
        // 处理字段，根据请求中的字段参数排序和过滤
        fields: model.columns
          .sort((c1, c2) =>
            Array.isArray(fields)
              ? fields.indexOf(c1.title as any) -
                fields.indexOf(c2.title as any)
              : 0,
          )
          .filter(
            (c) =>
              !fields ||
              !Array.isArray(fields) ||
              fields.includes(c.title as any),
          )
          .map((c) => c.title),
        // 设置数据
        data: dbRows,
      },
      {
        // 转义公式以防止 CSV 注入攻击
        escapeFormulae: true,
      },
    );

    // 设置响应头
    res.set({
      'Access-Control-Expose-Headers': 'nc-export-offset',
      'nc-export-offset': offset,
      'nc-export-elapsed-time': elapsed,
      'Content-Disposition': `attachment; filename="${encodeURI(
        view.title,
      )}-export.csv"`,
    });
    // 发送响应
    res.send(data);
  }

  // 获取数据库行数据的辅助方法
  async getDbRows(@TenantContext() context: NcContext, model, view: View, req) {
    // 处理视图模型的列，过滤显示的列并映射为 Column 对象
    view.model.columns = view.columns
      .filter((c) => c.show)
      .map(
        (c) =>
          new Column({
            ...c,
            ...view.model.columnsById[c.fk_column_id],
          } as any),
      )
      .filter((column) => !isSystemColumn(column) || view.show_system_fields);

    // 如果模型不存在，抛出错误
    if (!model) NcError.notFound('Table not found');

    // 处理列表参数
    const listArgs: any = { ...req.query };
    // 尝试解析过滤数组
    try {
      listArgs.filterArr = JSON.parse(listArgs.filterArrJson);
    } catch (e) {}
    // 尝试解析排序数组
    try {
      listArgs.sortArr = JSON.parse(listArgs.sortArrJson);
    } catch (e) {}

    // 获取数据源
    const source = await Source.get(context, model.source_id);
    // 获取基础模型 SQL
    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
    });

    // 获取 AST
    const { ast } = await getAst(context, {
      query: req.query,
      model,
      view,
      includePkByDefault: false,
    });

    // 设置偏移量
    let offset = +req.query.offset || 0;
    // 设置限制
    const limit = 100;
    // 注释掉的大小限制
    // const size = +process.env.NC_EXPORT_MAX_SIZE || 1024;
    // 设置超时时间
    const timeout = +process.env.NC_EXPORT_MAX_TIMEOUT || 5000;
    // 初始化数据库行数组
    const dbRows = [];
    // 记录开始时间
    const startTime = process.hrtime();
    // 声明经过的时间和临时变量
    let elapsed, temp;

    // 循环获取数据，直到超时或没有更多数据
    for (
      elapsed = 0;
      elapsed < timeout;
      offset += limit,
        temp = process.hrtime(startTime),
        elapsed = temp[0] * 1000 + temp[1] / 1000000
    ) {
      // 执行查询获取行数据
      const rows = await nocoExecute(
        ast,
        await baseModel.list({ ...listArgs, offset, limit }),
        {},
        listArgs,
      );

      // 如果没有更多行，设置偏移量为 -1 并退出循环
      if (!rows?.length) {
        offset = -1;
        break;
      }

      // 处理每一行数据
      for (const row of rows) {
        // 创建数据库行对象
        const dbRow = { ...row };

        // 处理每一列的值
        for (const column of view.model.columns) {
          // 序列化单元格值
          dbRow[column.title] = await serializeCellValue(context, {
            value: row[column.title],
            column,
            siteUrl: req.ncSiteUrl,
          });
        }
        // 将处理后的行添加到数据库行数组
        dbRows.push(dbRow);
      }
    }
    // 返回偏移量、数据库行和经过的时间
    return { offset, dbRows, elapsed };
  }
}
