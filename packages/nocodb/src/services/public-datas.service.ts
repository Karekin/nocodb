// 导入必要的NestJS装饰器和依赖
import { forwardRef, Inject, Injectable } from '@nestjs/common';
// 导入nocodb-sdk中的工具函数和类型
import { ncIsArray, UITypes, ViewTypes } from 'nocodb-sdk';
import type { NcRequest } from 'nocodb-sdk';
// 导入模型类型
import type { LinkToAnotherRecordColumn } from '~/models';
// 导入NcContext类型
import type { NcContext } from '~/interface/config';
// 导入依赖字段类型
import type { DependantFields } from '~/helpers/getAst';
// 导入执行工具
import { nocoExecute } from '~/utils';
// 导入模型类
import { Column, Model, Source, View } from '~/models';
// 导入错误处理工具
import { NcError } from '~/helpers/catchError';
// 导入AST生成工具
import getAst from '~/helpers/getAst';
// 导入分页响应实现
import { PagedResponseImpl } from '~/helpers/PagedResponse';
// 导入列获取辅助函数
import { getColumnByIdOrName } from '~/helpers/dataHelpers';
// 导入连接管理器
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
// 导入动态字段替换工具
import { replaceDynamicFieldWithValue } from '~/db/BaseModelSqlv2';
// 导入过滤器模型
import { Filter } from '~/models';
// 导入作业服务接口
import { IJobsService } from '~/modules/jobs/jobs-service.interface';
// 导入数据服务
import { DatasService } from '~/services/datas.service';
// 导入附件服务
import { AttachmentsService } from '~/services/attachments.service';

// todo: 移动到utils
/**
 * 净化URL路径
 * @param paths 路径数组
 * @returns 处理后的路径数组
 */
export function sanitizeUrlPath(paths) {
  return paths.map((url) => url.replace(/[/.?#]+/g, '_'));
}

/**
 * 公共数据服务
 * 处理共享视图的数据操作
 */
@Injectable()
export class PublicDatasService {
  /**
   * 构造函数
   * @param datasService 数据服务
   * @param jobsService 作业服务
   * @param attachmentsService 附件服务
   */
  constructor(
    protected datasService: DatasService,
    @Inject(forwardRef(() => 'JobsService'))
    protected readonly jobsService: IJobsService,
    protected readonly attachmentsService: AttachmentsService,
  ) {}

  /**
   * 获取数据列表
   * @param context 上下文
   * @param param 参数对象
   * @returns 分页数据响应
   */
  async dataList(
    context: NcContext,
    param: {
      sharedViewUuid: string;
      password?: string;
      query: any;
    },
  ) {
    const { sharedViewUuid, password, query = {} } = param;
    // 通过UUID获取视图
    const view = await View.getByUUID(context, sharedViewUuid);

    // 检查视图是否存在
    if (!view) NcError.viewNotFound(sharedViewUuid);
    // 检查视图类型是否支持
    if (
      view.type !== ViewTypes.GRID &&
      view.type !== ViewTypes.KANBAN &&
      view.type !== ViewTypes.GALLERY &&
      view.type !== ViewTypes.MAP &&
      view.type !== ViewTypes.CALENDAR
    ) {
      NcError.notFound('Not found');
    }

    // 检查密码是否正确
    if (view.password && view.password !== password) {
      return NcError.invalidSharedViewPassword();
    }

    // 获取模型
    const model = await Model.getByIdOrName(context, {
      id: view?.fk_model_id,
    });

    // 获取数据源
    const source = await Source.get(context, model.source_id);

    // 获取基础模型SQL
    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    // 获取AST和依赖字段
    const { ast, dependencyFields } = await getAst(context, {
      model,
      query: {},
      view,
    });

    // 准备列表参数
    const listArgs: any = { ...query, ...dependencyFields };
    try {
      listArgs.filterArr = JSON.parse(listArgs.filterArrJson);
    } catch (e) {}
    try {
      listArgs.sortArr = JSON.parse(listArgs.sortArrJson);
    } catch (e) {}
    let data = [];
    let count = 0;

    try {
      // 执行查询获取数据
      data = await nocoExecute(
        ast,
        await baseModel.list(listArgs),
        {},
        listArgs,
      );
      // 获取总数
      count = await baseModel.count(listArgs);
    } catch (e) {
      console.log(e);
      NcError.internalServerError('Please check server log for more details');
    }

    // 返回分页响应
    return new PagedResponseImpl(data, { ...param.query, count });
  }

  /**
   * 获取数据总数
   * @param context 上下文
   * @param param 参数对象
   * @returns 数据总数
   */
  async dataCount(
    context: NcContext,
    param: {
      sharedViewUuid: string;
      password?: string;
      query: any;
    },
  ) {
    const { sharedViewUuid, password } = param;
    // 通过UUID获取视图
    const view = await View.getByUUID(context, sharedViewUuid);

    // 检查视图是否存在
    if (!view) NcError.viewNotFound(sharedViewUuid);
    // 检查视图类型是否支持
    if (
      view.type !== ViewTypes.GRID &&
      view.type !== ViewTypes.KANBAN &&
      view.type !== ViewTypes.GALLERY &&
      view.type !== ViewTypes.MAP &&
      view.type !== ViewTypes.CALENDAR
    ) {
      NcError.notFound('Not found');
    }

    // 检查密码是否正确
    if (view.password && view.password !== password) {
      return NcError.invalidSharedViewPassword();
    }

    // 获取模型
    const model = await Model.getByIdOrName(context, {
      id: view?.fk_model_id,
    });

    // 获取数据源
    const source = await Source.get(context, model.source_id);

    // 获取基础模型SQL
    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    // 准备计数参数
    const countArgs: any = { ...param.query, throwErrorIfInvalidParams: true };
    try {
      countArgs.filterArr = JSON.parse(countArgs.filterArrJson);
    } catch (e) {}

    // 获取总数
    const count: number = await baseModel.count(countArgs);

    return { count };
  }

  /**
   * 数据聚合
   * @param context 上下文
   * @param param 参数对象
   * @returns 聚合结果
   */
  async dataAggregate(
    context: NcContext,
    param: {
      sharedViewUuid: string;
      password?: string;
      query: any;
    },
  ) {
    // 通过UUID获取视图
    const view = await View.getByUUID(context, param.sharedViewUuid);

    // 检查视图是否存在
    if (!view) NcError.viewNotFound(param.sharedViewUuid);

    // 检查视图类型是否为GRID
    if (view.type !== ViewTypes.GRID) {
      NcError.notFound('Not found');
    }

    // 检查密码是否正确
    if (view.password && view.password !== param.password) {
      return NcError.invalidSharedViewPassword();
    }

    // 获取模型
    const model = await Model.getByIdOrName(context, {
      id: view?.fk_model_id,
    });

    // 获取数据源
    const source = await Source.get(context, model.source_id);

    // 获取基础模型SQL
    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    // 准备列表参数
    const listArgs: any = { ...param.query };

    try {
      listArgs.filterArr = JSON.parse(listArgs.filterArrJson);
    } catch (e) {}

    try {
      listArgs.aggregation = JSON.parse(listArgs.aggregation);
    } catch (e) {}

    // 执行聚合操作
    return await baseModel.aggregate(listArgs, view);
  }

  // todo: 处理视图不属于模型的错误情况
  /**
   * 获取分组数据列表
   * @param context 上下文
   * @param param 参数对象
   * @returns 分组数据
   */
  async groupedDataList(
    context: NcContext,
    param: {
      sharedViewUuid: string;
      password?: string;
      query: any;
      groupColumnId: string;
    },
  ) {
    // 通过UUID获取视图
    const view = await View.getByUUID(context, param.sharedViewUuid);

    // 检查视图是否存在
    if (!view) NcError.viewNotFound(param.sharedViewUuid);

    // 检查视图类型是否支持
    if (
      view.type !== ViewTypes.GRID &&
      view.type !== ViewTypes.KANBAN &&
      view.type !== ViewTypes.GALLERY
    ) {
      NcError.notFound('Not found');
    }

    // 检查密码是否正确
    if (view.password && view.password !== param.password) {
      return NcError.invalidSharedViewPassword();
    }

    // 获取模型
    const model = await Model.getByIdOrName(context, {
      id: view?.fk_model_id,
    });

    // 调用内部方法获取分组数据
    return await this.getGroupedDataList(context, {
      model,
      view,
      query: param.query,
      groupColumnId: param.groupColumnId,
    });
  }

  /**
   * 获取分组数据列表的内部实现
   * @param context 上下文
   * @param param 参数对象
   * @returns 分组数据
   */
  async getGroupedDataList(
    context: NcContext,
    param: {
      model: Model;
      view: View;
      query: any;
      groupColumnId: string;
    },
  ) {
    const { model, view, query = {}, groupColumnId } = param;
    // 获取数据源
    const source = await Source.get(context, param.model.source_id);

    // 获取基础模型SQL
    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    // 获取AST
    const { ast } = await getAst(context, { model, query: param.query, view });

    // 准备列表参数
    const listArgs: any = { ...query };
    try {
      listArgs.filterArr = JSON.parse(listArgs.filterArrJson);
    } catch (e) {}
    try {
      listArgs.sortArr = JSON.parse(listArgs.sortArrJson);
    } catch (e) {}
    try {
      listArgs.options = JSON.parse(listArgs.optionsArrJson);
    } catch (e) {}

    let data = [];

    try {
      // 获取分组数据
      const groupedData = await baseModel.groupedList({
        ...listArgs,
        groupColumnId,
      });
      // 执行查询
      data = await nocoExecute(
        { key: 1, value: ast },
        groupedData,
        {},
        listArgs,
      );
      // 获取分组计数
      const countArr = await baseModel.groupedListCount({
        ...listArgs,
        groupColumnId,
      });
      // 处理数据，添加计数信息
      data = data.map((item) => {
        // todo: 使用map避免循环
        const count =
          countArr.find((countItem: any) => countItem.key === item.key)
            ?.count ?? 0;

        item.value = new PagedResponseImpl(item.value, {
          ...query,
          count: count,
        });
        return item;
      });
    } catch (e) {
      console.log(e);
      NcError.internalServerError('Please check server log for more details');
    }
    return data;
  }

  /**
   * 数据分组
   * @param context 上下文
   * @param param 参数对象
   * @returns 分组结果
   */
  async dataGroupBy(
    context: NcContext,
    param: {
      sharedViewUuid: string;
      password?: string;
      query: any;
    },
  ) {
    // 通过UUID获取视图
    const view = await View.getByUUID(context, param.sharedViewUuid);

    // 检查视图是否存在
    if (!view) NcError.viewNotFound(param.sharedViewUuid);

    // 检查视图类型是否为GRID
    if (view.type !== ViewTypes.GRID) {
      NcError.notFound('Not found');
    }

    // 检查密码是否正确
    if (view.password && view.password !== param.password) {
      return NcError.invalidSharedViewPassword();
    }

    // 获取模型
    const model = await Model.getByIdOrName(context, {
      id: view?.fk_model_id,
    });

    // 调用内部方法获取分组数据
    return await this.getDataGroupBy(context, {
      model,
      view,
      query: param.query,
    });
  }

  /**
   * 获取数据分组的内部实现
   * @param context 上下文
   * @param param 参数对象
   * @returns 分组数据
   */
  async getDataGroupBy(
    context: NcContext,
    param: { model: Model; view: View; query?: any },
  ) {
    try {
      const { model, view, query = {} } = param;

      // 获取数据源
      const source = await Source.get(context, model.source_id);

      // 获取基础模型SQL
      const baseModel = await Model.getBaseModelSQL(context, {
        id: model.id,
        viewId: view?.id,
        dbDriver: await NcConnectionMgrv2.get(source),
        source,
      });

      // 准备列表参数
      const listArgs: any = { ...query };

      try {
        listArgs.filterArr = JSON.parse(listArgs.filterArrJson);
      } catch (e) {}
      try {
        listArgs.sortArr = JSON.parse(listArgs.sortArrJson);
      } catch (e) {}

      // 执行分组查询
      const data = await baseModel.groupBy(listArgs);
      // 获取分组计数
      const count = await baseModel.groupByCount(listArgs);

      // 返回分页响应
      return new PagedResponseImpl(data, {
        ...query,
        count,
      });
    } catch (e) {
      console.log(e);
      NcError.internalServerError('Please check server log for more details');
    }
  }

  /**
   * 插入数据
   * @param context 上下文
   * @param param 参数对象
   * @returns 插入结果
   */
  async dataInsert(
    context: NcContext,
    param: {
      sharedViewUuid: string;
      password?: string;
      body: any;
      files: any[];
      siteUrl: string;
      req: NcRequest;
    },
  ) {
    // 通过UUID获取视图
    const view = await View.getByUUID(context, param.sharedViewUuid);

    // 检查视图是否存在
    if (!view) NcError.viewNotFound(param.sharedViewUuid);
    // 检查视图类型是否为FORM
    if (view.type !== ViewTypes.FORM) NcError.notFound();

    // 检查密码是否正确
    if (view.password && view.password !== param.password) {
      return NcError.invalidSharedViewPassword();
    }

    // 获取模型
    const model = await Model.getByIdOrName(context, {
      id: view?.fk_model_id,
    });

    // 获取数据源
    const source = await Source.get(context, model.source_id);

    // 检查数据源是否只读
    if (source?.is_data_readonly) {
      NcError.sourceDataReadOnly(source.alias);
    }

    // 获取基础模型SQL
    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    // 获取视图信息
    await view.getViewWithInfo(context);
    await view.getColumns(context);
    await view.getModelWithInfo(context);
    await view.model.getColumns(context);

    // 获取字段信息
    const fields = (view.model.columns = view.columns
      .filter((c) => c.show)
      .reduce((o, c) => {
        o[view.model.columnsById[c.fk_column_id].title] = new Column({
          ...c,
          ...view.model.columnsById[c.fk_column_id],
        } as any);
        return o;
      }, {}) as any);

    let body = param?.body;

    // 如果body是字符串，则解析为JSON
    if (typeof body === 'string') body = JSON.parse(body);

    // 过滤出有效的插入字段
    const insertObject = Object.entries(body).reduce((obj, [key, val]) => {
      if (key in fields) {
        obj[key] = val;
      }
      return obj;
    }, {});

    // 处理附件
    const attachments = {};

    // 处理上传的文件
    for (const file of param.files || []) {
      // 移除 `_` 前缀和 `[]` 后缀
      const fieldName = Buffer.from(file?.fieldname || '', 'binary')
        .toString('utf-8')
        .replace(/^_|\[\d*]$/g, '');

      // 检查字段是否为附件类型
      if (
        fieldName in fields &&
        fields[fieldName].uidt === UITypes.Attachment
      ) {
        attachments[fieldName] = attachments[fieldName] || [];

        // 上传文件
        attachments[fieldName].push(
          ...(await this.attachmentsService.upload({
            files: [file],
            req: param.req,
          })),
        );
      }
    }

    // 过滤通过URL上传的附件
    const uploadByUrlAttachments = [];
    for (const [column, data] of Object.entries(insertObject)) {
      if (fields[column].uidt === UITypes.Attachment && Array.isArray(data)) {
        data.forEach((file, uploadIndex) => {
          if (file?.url && !file?.file) {
            uploadByUrlAttachments.push({
              ...file,
              fieldName: column,
              uploadIndex,
            });
          }
        });
      }
    }

    // 处理通过URL上传的附件
    for (const file of uploadByUrlAttachments) {
      attachments[file.fieldName] = attachments[file.fieldName] || [];

      // 通过URL上传文件
      attachments[file.fieldName].unshift(
        ...(await this.attachmentsService.uploadViaURL({
          urls: [file.url],
          req: param.req,
        })),
      );
    }

    // 将附件数据转换为JSON字符串
    for (const [column, data] of Object.entries(attachments)) {
      insertObject[column] = JSON.stringify(data);
    }

    // 执行嵌套插入
    return await baseModel.nestedInsert(insertObject, param.req, null);
  }

  /**
   * 获取关联数据列表
   * @param context 上下文
   * @param param 参数对象
   * @returns 关联数据
   */
  async relDataList(
    context: NcContext,
    param: {
      query: any;
      sharedViewUuid: string;
      password?: string;
      columnId: string;
      rowData: Record<string, any>;
    },
  ) {
    // 通过UUID获取视图
    const view = await View.getByUUID(context, param.sharedViewUuid);

    // 检查视图是否存在
    if (!view) NcError.viewNotFound(param.sharedViewUuid);

    // 检查视图类型是否支持
    if (view.type !== ViewTypes.FORM && view.type !== ViewTypes.GALLERY) {
      NcError.notFound('Not found');
    }

    // 检查密码是否正确
    if (view.password && view.password !== param.password) {
      NcError.invalidSharedViewPassword();
    }

    // 获取列
    const column = await Column.get(context, { colId: param.columnId });
    // 获取当前模型
    const currentModel = await view.getModel(context);
    await currentModel.getColumns(context);
    // 获取列选项
    const colOptions = await column.getColOptions<LinkToAnotherRecordColumn>(
      context,
    );

    // 获取关联表
    const model = await colOptions.getRelatedTable(context);

    // 获取数据源
    const source = await Source.get(context, model.source_id);

    // 获取基础模型SQL
    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: colOptions.fk_target_view_id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    // 获取AST和依赖字段
    const { ast, dependencyFields } = await getAst(context, {
      query: param.query,
      model,
      extractOnlyPrimaries: true,
    });

    // 准备列表参数
    const listArgs: DependantFields & {
      filterArr?: Filter[];
      filterArrJson?: string;
    } = dependencyFields;

    try {
      if (listArgs.filterArrJson)
        listArgs.filterArr = JSON.parse(listArgs.filterArrJson) as Filter[];
    } catch (e) {}

    // 处理FORM视图的字段
    if (view.type === ViewTypes.FORM && ncIsArray(param.query?.fields)) {
      param.query.fields.forEach(listArgs.fieldsSet.add, listArgs.fieldsSet);

      param.query.fields.forEach((f) => {
        if (ast[f] === undefined) {
          ast[f] = 1;
        }
      });
    }

    let data = [];

    let count = 0;

    try {
      // 替换动态字段值
      const customConditions = await replaceDynamicFieldWithValue(
        param.rowData || {},
        null,
        currentModel.columns,
        baseModel.readByPk,
      )(
        (column.meta?.enableConditions
          ? await Filter.rootFilterListByLink(context, {
              columnId: param.columnId,
            })
          : []) || [],
      );

      // 执行查询
      data = data = await nocoExecute(
        ast,
        await baseModel.list({
          ...listArgs,
          customConditions,
        }),
        {},
        listArgs,
      );
      // 获取总数
      count = await baseModel.count({
        ...listArgs,
        customConditions,
      } as any);
    } catch (e) {
      console.log(e);
      NcError.internalServerError('Please check server log for more details');
    }

    // 返回分页响应
    return new PagedResponseImpl(data, { ...param.query, count });
  }

  /**
   * 获取多对多关系数据列表
   * @param context 上下文
   * @param param 参数对象
   * @returns 多对多关系数据
   */
  async publicMmList(
    context: NcContext,
    param: {
      query: any;
      sharedViewUuid: string;
      password?: string;
      columnId: string;
      rowId: string;
    },
  ) {
    // 通过UUID获取视图
    const view = await View.getByUUID(context, param.sharedViewUuid);

    // 检查视图是否存在
    if (!view) NcError.viewNotFound(param.sharedViewUuid);
    // 检查视图类型是否支持
    if (
      view.type !== ViewTypes.GRID &&
      view.type !== ViewTypes.KANBAN &&
      view.type !== ViewTypes.GALLERY &&
      view.type !== ViewTypes.CALENDAR
    ) {
      NcError.notFound('Not found');
    }

    // 检查密码是否正确
    if (view.password && view.password !== param.password) {
      NcError.invalidSharedViewPassword();
    }

    // 通过ID或名称获取列
    const column = await getColumnByIdOrName(
      context,
      param.columnId,
      await view.getModel(context),
    );

    // 检查列是否属于模型
    if (column.fk_model_id !== view.fk_model_id)
      NcError.badRequest("Column doesn't belongs to the model");

    // 获取数据源
    const source = await Source.get(context, view.source_id);

    // 获取基础模型SQL
    const baseModel = await Model.getBaseModelSQL(context, {
      id: view.fk_model_id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    // 准备请求对象
    const key = `List`;
    const requestObj: any = {
      [key]: 1,
    };

    // 执行查询
    const data = (
      await nocoExecute(
        requestObj,
        {
          [key]: async (args) => {
            return await baseModel.mmList(
              {
                colId: param.columnId,
                parentId: param.rowId,
              },
              args,
            );
          },
        },
        {},

        { nested: { [key]: param.query } },
      )
    )?.[key];

    // 获取总数
    const count: any = await baseModel.mmListCount(
      {
        colId: param.columnId,
        parentId: param.rowId,
      },
      param.query,
    );

    // 返回分页响应
    return new PagedResponseImpl(data, { ...param.query, count });
  }

  /**
   * 获取一对多关系数据列表
   * @param context 上下文
   * @param param 参数对象
   * @returns 一对多关系数据
   */
  async publicHmList(
    context: NcContext,
    param: {
      query: any;
      rowId: string;
      sharedViewUuid: string;
      password?: string;
      columnId: string;
    },
  ) {
    // 通过UUID获取视图
    const view = await View.getByUUID(context, param.sharedViewUuid);

    // 检查视图是否存在
    if (!view) NcError.viewNotFound(param.sharedViewUuid);
    // 检查视图类型是否支持
    if (
      view.type !== ViewTypes.GRID &&
      view.type !== ViewTypes.KANBAN &&
      view.type !== ViewTypes.GALLERY &&
      view.type !== ViewTypes.CALENDAR
    ) {
      NcError.notFound('Not found');
    }

    // 检查密码是否正确
    if (view.password && view.password !== param.password) {
      NcError.invalidSharedViewPassword();
    }

    // 通过ID或名称获取列
    const column = await getColumnByIdOrName(
      context,
      param.columnId,
      await view.getModel(context),
    );

    // 检查列是否属于模型
    if (column.fk_model_id !== view.fk_model_id)
      NcError.badRequest("Column doesn't belongs to the model");

    // 获取数据源
    const source = await Source.get(context, view.source_id);

    // 获取基础模型SQL
    const baseModel = await Model.getBaseModelSQL(context, {
      id: view.fk_model_id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    // 准备请求对象
    const key = `List`;
    const requestObj: any = {
      [key]: 1,
    };

    // 执行查询获取一对多关系数据
    const data = (
      await nocoExecute(
        requestObj,
        {
          [key]: async (args) => {
            return await baseModel.hmList(
              {
                colId: param.columnId,
                id: param.rowId,
              },
              args,
            );
          },
        },
        {},
        { nested: { [key]: param.query } },
      )
    )?.[key];

    // 获取数据总数
    const count = await baseModel.hmListCount(
      {
        colId: param.columnId,
        id: param.rowId,
      },
      param.query,
    );

    // 返回分页响应
    return new PagedResponseImpl(data, { ...param.query, count });
  }

  /**
   * 读取单条数据
   * @param context 上下文
   * @param param 参数对象
   * @returns 单条数据记录
   */
  async dataRead(
    context: NcContext,
    param: {
      sharedViewUuid: string;
      rowId: string;
      password?: string;
      query: any;
    },
  ) {
    const { sharedViewUuid, rowId, password, query = {} } = param;
    // 通过UUID获取视图
    const view = await View.getByUUID(context, sharedViewUuid);

    // 检查视图是否存在
    if (!view) NcError.viewNotFound(sharedViewUuid);
    // 检查视图类型是否支持
    if (
      view.type !== ViewTypes.GRID &&
      view.type !== ViewTypes.KANBAN &&
      view.type !== ViewTypes.GALLERY &&
      view.type !== ViewTypes.MAP &&
      view.type !== ViewTypes.CALENDAR
    ) {
      NcError.notFound('Not found');
    }

    // 检查密码是否正确
    if (view.password && view.password !== password) {
      return NcError.invalidSharedViewPassword();
    }

    // 获取模型
    const model = await Model.getByIdOrName(context, {
      id: view?.fk_model_id,
    });

    // 获取数据源
    const source = await Source.get(context, model.source_id);

    // 获取基础模型SQL
    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    // 通过主键读取记录
    const row = await baseModel.readByPk(rowId, false, query);

    // 检查记录是否存在
    if (!row) {
      NcError.recordNotFound(param.rowId);
    }

    return row;
  }

  /**
   * 批量获取数据列表
   * @param context 上下文
   * @param param 参数对象
   * @returns 批量数据结果
   */
  async bulkDataList(
    context: NcContext,
    param: {
      sharedViewUuid: string;
      password?: string;
      query: any;
      body?: any;
    },
  ) {
    // 通过UUID获取视图
    const view = await View.getByUUID(context, param.sharedViewUuid);

    // 检查视图是否存在
    if (!view) NcError.viewNotFound(param.sharedViewUuid);

    // 检查视图类型是否为GRID
    if (view.type !== ViewTypes.GRID) {
      NcError.notFound('Not found');
    }

    // 检查密码是否正确
    if (view.password && view.password !== param.password) {
      return NcError.invalidSharedViewPassword();
    }

    // 获取模型
    const model = await Model.getByIdOrName(context, {
      id: view?.fk_model_id,
    });

    // 准备列表参数
    const listArgs: any = { ...param.query };

    // 获取批量过滤列表
    let bulkFilterList = param.body;

    // 尝试解析JSON
    try {
      bulkFilterList = JSON.parse(bulkFilterList);
    } catch (e) {}

    try {
      listArgs.sortArr = JSON.parse(listArgs.sortArrJson);
    } catch (e) {}

    try {
      listArgs.filterArr = JSON.parse(listArgs.filterArrJson);
    } catch (e) {}

    // 检查批量过滤列表是否有效
    if (!bulkFilterList?.length) {
      NcError.badRequest('Invalid bulkFilterList');
    }

    // 使用reduce处理每个过滤条件，并聚合结果
    const dataListResults = await bulkFilterList.reduce(
      async (accPromise, dF: any) => {
        const acc = await accPromise;
        // 调用数据服务获取列表数据
        const result = await this.datasService.dataList(context, {
          query: {
            ...dF,
          },
          model,
          view,
        });
        // 使用别名作为键存储结果
        acc[dF.alias] = result;
        return acc;
      },
      Promise.resolve({}),
    );

    return dataListResults;
  }

  /**
   * 批量分组查询
   * @param context 上下文
   * @param param 参数对象
   * @returns 批量分组结果
   */
  async bulkGroupBy(
    context: NcContext,
    param: {
      sharedViewUuid: string;
      password?: string;
      query: any;
      body: any;
    },
  ) {
    // 通过UUID获取视图
    const view = await View.getByUUID(context, param.sharedViewUuid);

    // 检查视图是否存在
    if (!view) NcError.viewNotFound(param.sharedViewUuid);

    // 检查密码是否正确
    if (view.password && view.password !== param.password) {
      return NcError.invalidSharedViewPassword();
    }

    // 获取模型
    const model = await Model.getByIdOrName(context, {
      id: view?.fk_model_id,
    });

    // 获取数据源
    const source = await Source.get(context, model.source_id);

    // 获取基础模型SQL
    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    // 准备列表参数
    const listArgs: any = { ...param.query };

    // 获取批量过滤列表
    let bulkFilterList = param.body;

    // 尝试解析JSON
    try {
      bulkFilterList = JSON.parse(bulkFilterList);
    } catch (e) {}

    try {
      listArgs.filterArr = JSON.parse(listArgs.filterArrJson);
    } catch (e) {}

    // 检查批量过滤列表是否有效
    if (!bulkFilterList?.length) {
      NcError.badRequest('Invalid bulkFilterList');
    }

    // 并行执行批量分组查询和计数
    const [data, count] = await Promise.all([
      baseModel.bulkGroupBy(listArgs, bulkFilterList, view),
      baseModel.bulkGroupByCount(listArgs, bulkFilterList, view),
    ]);

    // 处理每个过滤条件的结果
    bulkFilterList.forEach((dF: any) => {
      // sqlite3返回数据为字符串，需要转换为JSON对象
      let parsedData = data[dF.alias];

      if (typeof parsedData === 'string') {
        parsedData = JSON.parse(parsedData);
      }

      let parsedCount = count[dF.alias];

      if (typeof parsedCount === 'string') {
        parsedCount = JSON.parse(parsedCount);
      }

      // 创建分页响应
      data[dF.alias] = new PagedResponseImpl(parsedData, {
        ...dF,
        count: parsedCount?.count,
      });
    });

    return data;
  }
}
