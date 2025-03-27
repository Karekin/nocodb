import { Injectable, Logger } from '@nestjs/common';
import DOMPurify from 'isomorphic-dompurify';
import {
  AppEvents,
  isCreatedOrLastModifiedByCol,
  isCreatedOrLastModifiedTimeCol,
  isLinksOrLTAR,
  isOrderCol,
  isVirtualCol,
  ModelTypes,
  ProjectRoles,
  RelationTypes,
  UITypes,
} from 'nocodb-sdk';
import { NcApiVersion } from 'nocodb-sdk';
import { MetaDiffsService } from './meta-diffs.service';
import { ColumnsService } from './columns.service';
import type {
  ColumnType,
  NormalColumnRequestType,
  TableReqType,
  TableType,
  UserType,
} from 'nocodb-sdk';
import type { MetaService } from '~/meta/meta.service';
import type { LinkToAnotherRecordColumn, User, View } from '~/models';
import type { NcContext, NcRequest } from '~/interface/config';
import { Base, Column, Model, ModelRoleVisibility } from '~/models';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import ProjectMgrv2 from '~/db/sql-mgr/v2/ProjectMgrv2';
import { NcError } from '~/helpers/catchError';
import getColumnPropsFromUIDT from '~/helpers/getColumnPropsFromUIDT';
import getColumnUiType from '~/helpers/getColumnUiType';
import getTableNameAlias, { getColumnNameAlias } from '~/helpers/getTableName';
import mapDefaultDisplayValue from '~/helpers/mapDefaultDisplayValue';
import Noco from '~/Noco';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import { sanitizeColumnName, validatePayload } from '~/helpers';
import {
  getUniqueColumnAliasName,
  getUniqueColumnName,
} from '~/helpers/getUniqueName';
import { MetaTable } from '~/utils/globals';

@Injectable()
export class TablesService {
  protected logger = new Logger(TablesService.name);

  constructor(
    protected readonly metaDiffService: MetaDiffsService,
    protected readonly appHooksService: AppHooksService,
    protected readonly columnsService: ColumnsService,
  ) {}

  /**
   * 更新表
   * @param context 上下文
   * @param param 参数对象，包含tableId、table、baseId、user和req
   * @returns 成功返回true
   */
  async tableUpdate(
    context: NcContext,
    param: {
      tableId: any;
      table: Partial<TableReqType> & { base_id?: string };
      baseId?: string;
      user: UserType;
      req: NcRequest;
    },
  ) {
    // 获取模型
    const model = await Model.get(context, param.tableId);

    // 获取基础信息
    const base = await Base.getWithInfo(
      context,
      param.table.base_id || param.baseId,
    );
    // 查找对应的数据源
    const source = base.sources.find((b) => b.id === model.source_id);

    // 检查模型是否属于基础
    if (model.base_id !== base.id) {
      NcError.badRequest('Model does not belong to base');
    }

    // 如果只更新meta或description，则直接更新并返回
    if ('meta' in param.table || 'description' in param.table) {
      await Model.updateMeta(context, param.tableId, param.table);

      // 触发表更新事件
      this.appHooksService.emit(AppEvents.TABLE_UPDATE, {
        table: param.table,
        prevTable: model,
        req: param.req,
        context,
      });

      return true;
    }

    // 如果数据源是只读的，则不允许修改
    if (source?.is_schema_readonly) {
      NcError.sourceMetaReadOnly(source.alias);
    }

    // 检查表名是否存在
    if (!param.table.table_name) {
      NcError.badRequest(
        'Missing table name `table_name` property in request body',
      );
    }

    // 对于databricks类型的数据源，处理表名
    if (source.type === 'databricks') {
      param.table.table_name = param.table.table_name
        .replace(/\s/g, '_')
        .toLowerCase();
    }

    // 处理元数据表的前缀
    if (source.isMeta(true) && base.prefix && !source.isMeta(true, 1)) {
      if (!param.table.table_name.startsWith(base.prefix)) {
        param.table.table_name = `${base.prefix}${param.table.table_name}`;
      }
    }

    // 清理表名
    param.table.table_name = DOMPurify.sanitize(param.table.table_name);

    // 验证表名，不允许前导或尾随空格
    if (/^\s+|\s+$/.test(param.table.table_name)) {
      NcError.badRequest(
        'Leading or trailing whitespace not allowed in table names',
      );
    }
    // 检查特殊字符
    const specialCharRegex = /[./\\]/g;
    if (specialCharRegex.test(param.table.table_name)) {
      const match = param.table.table_name.match(specialCharRegex);
      NcError.badRequest(
        'Following characters are not allowed ' +
          match.map((m) => JSON.stringify(m)).join(', '),
      );
    }

    // 替换特定字符
    const replaceCharRegex = /[$?]/g;
    if (replaceCharRegex.test(param.table.table_name)) {
      param.table.table_name = param.table.table_name.replace(
        replaceCharRegex,
        '_',
      );
    }

    // 检查表名是否可用
    if (
      !(await Model.checkTitleAvailable(context, {
        table_name: param.table.table_name,
        base_id: base.id,
        source_id: source.id,
      }))
    ) {
      NcError.badRequest('Duplicate table name');
    }

    // 如果没有提供标题，则使用表名别名
    if (!param.table.title) {
      param.table.title = getTableNameAlias(
        param.table.table_name,
        base.prefix,
        source,
      );
    }

    // 检查别名是否可用
    if (
      !(await Model.checkAliasAvailable(context, {
        title: param.table.title,
        base_id: base.id,
        source_id: source.id,
      }))
    ) {
      NcError.badRequest('Duplicate table alias');
    }

    // 获取SQL管理器和SQL客户端
    const sqlMgr = await ProjectMgrv2.getSqlMgr(context, base);
    const sqlClient = await NcConnectionMgrv2.getSqlClient(source);

    // 根据数据库类型设置表名长度限制
    let tableNameLengthLimit = 255;
    const sqlClientType = sqlClient.knex.clientType();
    if (sqlClientType === 'mysql2' || sqlClientType === 'mysql') {
      tableNameLengthLimit = 64;
    } else if (sqlClientType === 'pg') {
      tableNameLengthLimit = 63;
    } else if (sqlClientType === 'mssql') {
      tableNameLengthLimit = 128;
    }

    // 检查表名长度
    if (param.table.table_name.length > tableNameLengthLimit) {
      NcError.badRequest(
        `Table name exceeds ${tableNameLengthLimit} characters`,
      );
    }

    // 执行表重命名操作
    await sqlMgr.sqlOpPlus(source, 'tableRename', {
      ...param.table,
      tn: param.table.table_name,
      tn_old: model.table_name,
      schema: source.getConfig()?.schema,
    });

    // 更新别名和表名
    await Model.updateAliasAndTableName(
      context,
      param.tableId,
      param.table.title,
      param.table.table_name,
    );

    // 触发表更新事件
    this.appHooksService.emit(AppEvents.TABLE_UPDATE, {
      table: param.table,
      prevTable: model,
      req: param.req,
      context,
    });

    return true;
  }

  /**
   * 重新排序表
   * @param context 上下文
   * @param param 参数对象，包含tableId、order和req
   * @returns 更新结果
   */
  async reorderTable(
    context: NcContext,
    param: { tableId: string; order: any; req: NcRequest },
  ) {
    // 获取模型
    const model = await Model.get(context, param.tableId);

    // 更新排序
    const res = await Model.updateOrder(context, param.tableId, param.order);

    // 触发表更新事件
    this.appHooksService.emit(AppEvents.TABLE_UPDATE, {
      prevTable: model as TableType,
      table: {
        ...model,
        order: param.order,
      } as TableType,
      req: param.req,
      context,
    } as any);

    return res;
  }

  /**
   * 删除表
   * @param context 上下文
   * @param param 参数对象，包含tableId、user、forceDeleteRelations和req
   * @returns 删除结果
   */
  async tableDelete(
    context: NcContext,
    param: {
      tableId: string;
      user: User;
      forceDeleteRelations?: boolean;
      req?: any;
    },
  ) {
    // 获取表和列
    const table = await Model.getByIdOrName(context, { id: param.tableId });
    await table.getColumns(context);

    // 如果是多对多关系表，则不允许删除
    if (table.mm) {
      const columns = await table.getColumns(context);

      // 获取使用当前表作为连接表的关系的表名
      const tables = await Promise.all(
        columns
          .filter((c) => isLinksOrLTAR(c))
          .map((c) => c.colOptions.getRelatedTable()),
      );

      // 获取关系列名
      const relColumns = await Promise.all(
        tables.map((t) => {
          return t.getColumns(context).then((cols) => {
            return cols.find((c) => {
              return (
                isLinksOrLTAR(c) &&
                (c.colOptions as LinkToAnotherRecordColumn).type ===
                  RelationTypes.MANY_TO_MANY &&
                (c.colOptions as LinkToAnotherRecordColumn).fk_mm_model_id ===
                  table.id
              );
            });
          });
        }),
      );

      // 抛出错误，提示这是多对多表
      NcError.badRequest(
        `This is a many to many table for ${tables[0]?.title} (${relColumns[0]?.title}) & ${tables[1]?.title} (${relColumns[1]?.title}). You can disable "Show M2M tables" in base settings to avoid seeing this.`,
      );
    } else {
      // 检查表是否在自定义关系中用作连接表
      const relations = await Noco.ncMeta.metaList2(
        table.fk_workspace_id,
        table.base_id,
        MetaTable.COL_RELATIONS,
        {
          condition: {
            fk_mm_model_id: table.id,
          },
        },
      );

      // 如果有关系，则不允许删除
      if (relations.length) {
        const relCol = await Column.get(context, {
          colId: relations[0].fk_column_id,
        });
        const relTable = await Model.get(context, relCol.fk_model_id);
        NcError.tableAssociatedWithLink(table.id, {
          customMessage: `This is a many to many table for '${relTable?.title}' (${relTable?.title}), please delete the column before deleting the table.`,
        });
      }
    }

    // 获取基础和数据源
    const base = await Base.getWithInfo(context, table.base_id);
    const source = base.sources.find((b) => b.id === table.source_id);

    // 获取关系列
    const relationColumns = table.columns.filter((c) => isLinksOrLTAR(c));

    // 确定是否删除关系
    const deleteRelations = source.isMeta() || param.forceDeleteRelations;

    // 如果有关系列且不允许删除关系，则抛出错误
    if (relationColumns?.length && !deleteRelations) {
      const referredTables = await Promise.all(
        relationColumns.map(async (c) =>
          c
            .getColOptions<LinkToAnotherRecordColumn>(context)
            .then((opt) => opt.getRelatedTable(context))
            .then(),
        ),
      );
      NcError.badRequest(
        `Table can't be deleted since Table is being referred in following tables : ${referredTables.join(
          ', ',
        )}. Delete LinkToAnotherRecord columns and try again.`,
      );
    }

    // 开始事务
    const ncMeta = await (Noco.ncMeta as MetaService).startTransaction();
    let result;
    try {
      // 删除所有关系
      for (const c of relationColumns) {
        // 如果列是对多对多表的hasmany关系，则跳过
        if (c.system && !table.mm) {
          continue;
        }

        // 验证列是否存在，并基于此删除列
        if (!(await Column.get(context, { colId: c.id }, ncMeta))) {
          continue;
        }

        // 删除列
        await this.columnsService.columnDelete(
          context,
          {
            req: param.req,
            columnId: c.id,
            user: param.user,
            forceDeleteSystem: true,
          },
          ncMeta,
        );
      }

      // 获取SQL管理器
      const sqlMgr = await ProjectMgrv2.getSqlMgr(context, base, ncMeta);
      (table as any).tn = table.table_name;
      // 过滤掉虚拟列
      table.columns = table.columns.filter((c) => !isVirtualCol(c));
      table.columns.forEach((c) => {
        (c as any).cn = c.column_name;
      });

      // 根据表类型执行不同的删除操作
      if (table.type === ModelTypes.TABLE) {
        await sqlMgr.sqlOpPlus(source, 'tableDelete', table);
      } else if (table.type === ModelTypes.VIEW) {
        await sqlMgr.sqlOpPlus(source, 'viewDelete', {
          ...table,
          view_name: table.table_name,
        });
      }

      // 触发表删除事件
      this.appHooksService.emit(AppEvents.TABLE_DELETE, {
        table,
        user: param.user,
        req: param.req,
        context,
      });

      // 删除表
      result = await table.delete(context, ncMeta);
      // 提交事务
      await ncMeta.commit();
    } catch (e) {
      // 回滚事务
      await ncMeta.rollback();
      throw e;
    }
    return result;
  }

  /**
   * 获取表及其可访问的视图
   * @param context 上下文
   * @param param 参数对象，包含tableId和user
   * @returns 表及其视图
   */
  async getTableWithAccessibleViews(
    context: NcContext,
    param: {
      tableId: string;
      user: User | UserType;
    },
  ) {
    // 获取表信息
    const table = await Model.getWithInfo(context, {
      id: param.tableId,
    });

    // 如果表不存在，则抛出错误
    if (!table) {
      NcError.tableNotFound(param.tableId);
    }

    // 获取视图列表
    const viewList = <View[]>(
      await this.xcVisibilityMetaGet(context, table.base_id, [table])
    );

    // 过滤出用户可访问的视图
    table.views = viewList.filter((view: any) => {
      return Object.keys(param.user?.roles).some(
        (role) => param.user?.roles[role] && !view.disabled[role],
      );
    });

    return table;
  }

  /**
   * 获取可见性元数据
   * @param context 上下文
   * @param baseId 基础ID
   * @param _models 模型数组
   * @param includeM2M 是否包含多对多表
   * @returns 可见性元数据
   */
  async xcVisibilityMetaGet(
    context: NcContext,
    baseId,
    _models: Model[] = null,
    includeM2M = true,
    // type: 'table' | 'tableAndViews' | 'views' = 'table'
  ) {
    // 角色列表
    const roles = [
      'owner',
      'creator',
      'viewer',
      'editor',
      'commenter',
      'guest',
    ];

    // 默认禁用状态
    const defaultDisabled = roles.reduce((o, r) => ({ ...o, [r]: false }), {});

    // 获取模型列表
    let models =
      _models ||
      (await Model.list(context, {
        base_id: baseId,
        source_id: undefined,
      }));

    // 根据includeM2M参数过滤模型
    models = includeM2M ? models : (models.filter((t) => !t.mm) as Model[]);

    // 构建结果对象
    const result = await models.reduce(async (_obj, model) => {
      const obj = await _obj;

      // 获取模型的视图
      const views = await model.getViews(context);
      for (const view of views) {
        obj[view.id] = {
          ptn: model.table_name,
          _ptn: model.title,
          ptype: model.type,
          tn: view.title,
          _tn: view.title,
          table_meta: model.meta,
          ...view,
          disabled: { ...defaultDisabled },
        };
      }

      return obj;
    }, Promise.resolve({}));

    // 获取禁用列表
    const disabledList = await ModelRoleVisibility.list(context, baseId);

    // 更新禁用状态
    for (const d of disabledList) {
      if (result[d.fk_view_id])
        result[d.fk_view_id].disabled[d.role] = !!d.disabled;
    }

    return Object.values(result);
  }

  /**
   * 获取可访问的表
   * @param context 上下文
   * @param param 参数对象，包含baseId、sourceId、includeM2M和roles
   * @returns 可访问的表列表
   */
  async getAccessibleTables(
    context: NcContext,
    param: {
      baseId: string;
      sourceId: string;
      includeM2M?: boolean;
      roles: Record<string, boolean>;
    },
  ) {
    // 获取视图列表
    const viewList = await this.xcVisibilityMetaGet(context, param.baseId);

    // 构建表视图映射
    const tableViewMapping = viewList.reduce((o, view: any) => {
      o[view.fk_model_id] = o[view.fk_model_id] || 0;
      if (
        Object.values(ProjectRoles).some(
          (role) => param.roles[role] && !view.disabled[role],
        )
      ) {
        o[view.fk_model_id]++;
      }
      return o;
    }, {});

    // 获取表列表并过滤
    const tableList = (
      await Model.list(context, {
        base_id: param.baseId,
        source_id: param.sourceId,
      })
    ).filter((t) => tableViewMapping[t.id]);

    // 根据includeM2M参数返回结果
    return param.includeM2M
      ? tableList
      : (tableList.filter((t) => !t.mm) as Model[]);
  }

  /**
   * 创建表
   * @param context 上下文
   * @param param 参数对象，包含baseId、sourceId、table、user、req、synced和apiVersion
   * @returns 创建的表
   */
  async tableCreate(
    context: NcContext,
    param: {
      baseId: string;
      sourceId?: string;
      table: TableReqType;
      user: User | UserType;
      req: NcRequest;
      synced?: boolean;
      apiVersion?: NcApiVersion;
    },
  ) {
    // 在验证前为列添加标题（如果只有列名）
    if (param.table.columns) {
      param.table.columns.forEach((c) => {
        if (!c.title && c.column_name) {
          c.title = c.column_name;
        }
      });
    }

    // 在验证前为表添加标题（如果只有表名）
    if (!param.table.title && param.table.table_name) {
      param.table.title = param.table.table_name;
    }

    // 验证负载
    validatePayload('swagger.json#/components/schemas/TableReq', param.table);

    // 构建表创建负载
    const tableCreatePayLoad: Omit<TableReqType, 'columns'> & {
      columns: (ColumnType & { cn?: string })[];
    } = {
      ...param.table,
      ...(param.synced ? { synced: true } : {}),
    };

    // 获取基础和数据源
    const base = await Base.getWithInfo(context, param.baseId);
    let source = base.sources[0];

    // 如果指定了sourceId，则使用对应的数据源
    if (param.sourceId) {
      source = base.sources.find((b) => b.id === param.sourceId);
    }

    // 添加系统列（如果请求负载中缺少）
    {
      for (const uidt of [
        ...(param.apiVersion === NcApiVersion.V3 ? [UITypes.ID] : []),
        UITypes.CreatedTime,
        UITypes.LastModifiedTime,
        UITypes.CreatedBy,
        UITypes.LastModifiedBy,
        UITypes.Order,
      ]) {
        const col = tableCreatePayLoad.columns.find(
          (c) => c.uidt === uidt,
        ) as ColumnType;

        let columnName, columnTitle;

        // 根据UI类型设置列名和标题
        switch (uidt) {
          case UITypes.CreatedTime:
            columnName = 'created_at';
            columnTitle = 'CreatedAt';
            break;
          case UITypes.LastModifiedTime:
            columnName = 'updated_at';
            columnTitle = 'UpdatedAt';
            break;
          case UITypes.CreatedBy:
            columnName = 'created_by';
            columnTitle = 'nc_created_by';
            break;
          case UITypes.LastModifiedBy:
            columnName = 'updated_by';
            columnTitle = 'nc_updated_by';
            break;
          case UITypes.Order:
            columnTitle = 'nc_order';
            columnName = 'nc_order';
            break;
          case UITypes.ID:
            columnTitle = 'Id';
            columnName = 'id';
            break;
        }

        // 获取唯一列名和别名
        const colName = getUniqueColumnName(
          tableCreatePayLoad.columns as any[],
          columnName,
        );

        const colAlias = getUniqueColumnAliasName(
          tableCreatePayLoad.columns as any[],
          columnTitle,
        );

        // 如果列不存在或不是系统列，则添加
        if (!col || (!col.system && col.uidt !== UITypes.ID)) {
          tableCreatePayLoad.columns.push({
            ...(await getColumnPropsFromUIDT({ uidt } as any, source)),
            column_name: colName,
            cn: colName,
            title: colAlias,
            system: uidt !== UITypes.ID,
          });
        } else {
          // 临时修复：更新用户传递的具有重复名称的系统列
          if (
            tableCreatePayLoad.columns.some(
              (c: ColumnType) =>
                c.uidt !== uidt && c.column_name === col.column_name,
            )
          ) {
            Object.assign(col, {
              column_name: colName,
              cn: colName,
            });
          }
          if (
            tableCreatePayLoad.columns.some(
              (c: ColumnType) => c.uidt !== uidt && c.title === col.title,
            )
          ) {
            Object.assign(col, {
              title: colAlias,
            });
          }
        }
      }
    }

    {
      // 设置系统列在列表中的顺序
      const orderOfSystemColumns = [
        UITypes.ID,
        UITypes.CreatedTime,
        UITypes.LastModifiedTime,
        UITypes.CreatedBy,
        UITypes.LastModifiedBy,
        UITypes.Order,
      ];

      // 对列进行排序
      tableCreatePayLoad.columns = tableCreatePayLoad.columns.sort((a, b) => {
        const aIndex =
          a.system || a.uidt === UITypes.ID
            ? orderOfSystemColumns.indexOf(a.uidt as UITypes)
            : -1;
        const bIndex =
          b.system || b.uidt === UITypes.ID
            ? orderOfSystemColumns.indexOf(b.uidt as UITypes)
            : -1;

        if (aIndex === -1 && bIndex === -1) {
          return 0;
        }

        if (aIndex === -1) {
          return 1;
        }

        if (bIndex === -1) {
          return -1;
        }

        return aIndex - bIndex;
      });
    }

    // 检查标题是否存在
    if (!tableCreatePayLoad.title) {
      NcError.badRequest('Missing table `title` property in request body');
    }

    // 如果没有表名，则使用标题作为表名
    if (!tableCreatePayLoad.table_name) {
      tableCreatePayLoad.table_name = tableCreatePayLoad.title;
    }

    // 检查别名是否可用
    if (
      !(await Model.checkAliasAvailable(context, {
        title: tableCreatePayLoad.title,
        base_id: base.id,
        source_id: source.id,
      }))
    ) {
      NcError.badRequest('Duplicate table alias');
    }

    // 对于databricks类型的数据源，处理表名
    if (source.type === 'databricks') {
      tableCreatePayLoad.table_name = tableCreatePayLoad.table_name
        .replace(/\s/g, '_')
        .toLowerCase();
    }

    // 处理元数据表的前缀
    if (source.is_meta && base.prefix) {
      if (!tableCreatePayLoad.table_name.startsWith(base.prefix)) {
        tableCreatePayLoad.table_name = `${base.prefix}_${tableCreatePayLoad.table_name}`;
      }
    }

    // 清理表名
    tableCreatePayLoad.table_name = DOMPurify.sanitize(
      tableCreatePayLoad.table_name,
    );

    // 验证表名
    if (/^\s+|\s+$/.test(tableCreatePayLoad.table_name)) {
      NcError.badRequest(
        'Leading or trailing whitespace not allowed in table names',
      );
    }
    // 检查特殊字符
    const specialCharRegex = /[./\\]/g;
    if (specialCharRegex.test(param.table.table_name)) {
      const match = param.table.table_name.match(specialCharRegex);
      NcError.badRequest(
        'Following characters are not allowed ' +
          match.map((m) => JSON.stringify(m)).join(', '),
      );
    }

    // 替换特定字符
    const replaceCharRegex = /[$?]/g;
    if (replaceCharRegex.test(param.table.table_name)) {
      tableCreatePayLoad.table_name = param.table.table_name.replace(
        replaceCharRegex,
        '_',
      );
    }

    // 检查表名是否可用
    if (
      !(await Model.checkTitleAvailable(context, {
        table_name: tableCreatePayLoad.table_name,
        base_id: base.id,
        source_id: source.id,
      }))
    ) {
      NcError.badRequest('Duplicate table name');
    }

    // 如果没有提供标题，则使用表名别名
    if (!tableCreatePayLoad.title) {
      tableCreatePayLoad.title = getTableNameAlias(
        tableCreatePayLoad.table_name,
        base.prefix,
        source,
      );
    }

    // 获取SQL管理器和SQL客户端
    const sqlMgr = await ProjectMgrv2.getSqlMgr(context, base);
    const sqlClient = await NcConnectionMgrv2.getSqlClient(source);

    // 根据数据库类型设置表名长度限制
    let tableNameLengthLimit = 255;
    const sqlClientType = sqlClient.knex.clientType();
    if (sqlClientType === 'mysql2' || sqlClientType === 'mysql') {
      tableNameLengthLimit = 64;
    } else if (sqlClientType === 'pg') {
      tableNameLengthLimit = 63;
    } else if (sqlClientType === 'mssql') {
      tableNameLengthLimit = 128;
    }

    // 检查表名长度
    if (tableCreatePayLoad.table_name.length > tableNameLengthLimit) {
      NcError.badRequest(
        `Table name exceeds ${tableNameLengthLimit} characters`,
      );
    }

    // 获取列名最大长度
    const mxColumnLength = Column.getMaxColumnNameLength(sqlClientType);

    // 用于跟踪唯一列名的计数器
    const uniqueColumnNameCount = {};

    // 映射默认显示值
    mapDefaultDisplayValue(param.table.columns);

    // 存储虚拟列
    const virtualColumns = [];

    // 处理每个列
    for (const column of param.table.columns) {
      // 如果不是虚拟列或是系统时间/用户列
      if (
        !isVirtualCol(column) ||
        (isCreatedOrLastModifiedTimeCol(column) && (column as any).system) ||
        (isCreatedOrLastModifiedByCol(column) && (column as any).system)
      ) {
        // 如果没有列名但有标题，则使用标题作为列名
        if (!column.column_name && column.title) {
          column.column_name = column.title;
        }

        // 清理列名并限制长度（-5是为后缀预留空间）
        column.column_name = sanitizeColumnName(
          column.column_name.slice(0, mxColumnLength - 5),
          source.type,
        );

        // 确保列名唯一
        if (uniqueColumnNameCount[column.column_name]) {
          let suffix = 1;
          let targetColumnName = `${column.column_name}_${suffix++}`;
          while (uniqueColumnNameCount[targetColumnName]) {
            targetColumnName = `${column.column_name}_${suffix++}`;
          }
          column.column_name = targetColumnName;
        }
        uniqueColumnNameCount[column.column_name] = 1;

        // 确保列名不超过最大长度
        if (column.column_name.length > mxColumnLength) {
          column.column_name = column.column_name.slice(0, mxColumnLength);
        }
      }

      // 检查列标题长度
      if (column.title && column.title.length > 255) {
        NcError.badRequest(
          `Column title ${column.title} exceeds 255 characters`,
        );
      }
    }

    // 处理表创建负载的列
    tableCreatePayLoad.columns = await Promise.all(
      param.table.columns
        // 从列列表中排除别名列
        ?.filter((c) => {
          const allowed =
            (!isCreatedOrLastModifiedTimeCol(c) &&
              !isCreatedOrLastModifiedByCol(c)) ||
            (c as any).system ||
            isOrderCol(c);

          // 如果不允许，则添加到虚拟列
          if (!allowed) {
            virtualColumns.push(c);
          }

          return allowed;
        })
        .map(async (c) => ({
          ...(await getColumnPropsFromUIDT(c as any, source)),
          cn: c.column_name,
          column_name: c.column_name,
        })),
    );

    // 执行表创建操作
    await sqlMgr.sqlOpPlus(source, 'tableCreate', {
      ...tableCreatePayLoad,
      tn: tableCreatePayLoad.table_name,
    });

    // 定义列类型
    let columns: Array<
      Omit<Column, 'column_name' | 'title'> & {
        cn: string;
        system?: boolean;
      }
    >;

    // 如果不是元数据源，则获取列列表
    if (!source.isMeta()) {
      columns = (
        await sqlMgr.sqlOpPlus(source, 'columnList', {
          tn: tableCreatePayLoad.table_name,
          schema: source.getConfig()?.schema,
        })
      )?.data?.list;
    }

    // 获取表列表
    const tables = await Model.list(context, {
      base_id: base.id,
      source_id: source.id,
    });

    // 插入模型
    const result = await Model.insert(context, base.id, source.id, {
      ...tableCreatePayLoad,
      columns: [
        // 映射表创建负载的列
        ...tableCreatePayLoad.columns.map((c, i) => {
          const colMetaFromDb = columns?.find((c1) => c.cn === c1.cn);
          return {
            ...c,
            uidt: c.uidt || getColumnUiType(source, colMetaFromDb || c),
            ...(colMetaFromDb || {}),
            title: c.title || getColumnNameAlias(c.cn, source),
            column_name: colMetaFromDb?.cn || c.cn || c.column_name,
            order: i + 1,
            readonly: c.readonly || false,
          } as NormalColumnRequestType;
        }),
        // 映射虚拟列
        ...virtualColumns.map((c, i) => ({
          ...c,
          uidt: c.uidt || getColumnUiType(source, c),
          title: c.title || getColumnNameAlias(c.cn, source),
          order: tableCreatePayLoad.columns.length + i + 1,
        })),
      ],
      // 设置顺序
      order: +(tables?.pop()?.order ?? 0) + 1,
    } as any);

    try {
      // 创建nc_order索引列
      const metaOrderColumn = tableCreatePayLoad.columns.find(
        (c) => c.uidt === UITypes.Order,
      );

      if (!source.isMeta()) {
        const orderColumn = columns.find(
          (c) => c.cn === metaOrderColumn.column_name,
        );

        if (!orderColumn) {
          throw new Error(
            `Column ${metaOrderColumn.column_name} not found in database`,
          );
        }
      }

      // 获取数据库驱动
      const dbDriver = await NcConnectionMgrv2.get(source);

      // 获取基础模型SQL
      const baseModel = await Model.getBaseModelSQL(context, {
        model: result,
        source,
        dbDriver,
      });

      // 创建索引
      await sqlClient.raw(`CREATE INDEX ?? ON ?? (??)`, [
        `${tableCreatePayLoad.table_name}_order_idx`,
        baseModel.getTnPath(tableCreatePayLoad.table_name),
        metaOrderColumn.column_name,
      ]);
    } catch (e) {
      // 记录创建索引错误
      this.logger.log(`Something went wrong while creating index for nc_order`);
      this.logger.error(e);
    }

    // 触发表创建事件
    this.appHooksService.emit(AppEvents.TABLE_CREATE, {
      table: {
        ...param.table,
        id: result.id,
      },
      source,
      user: param.user,
      req: param.req,
      context,
    });

    return result;
  }
}
