import { Injectable } from '@nestjs/common';
import {
  AppEvents,
  isAIPromptCol,
  isLinksOrLTAR,
  isVirtualCol,
  ModelTypes,
  RelationTypes,
  UITypes,
} from 'nocodb-sdk';
import { pluralize, singularize } from 'inflection';
import type { UserType } from 'nocodb-sdk';
import type { LinksColumn, LinkToAnotherRecordColumn } from '~/models';
import type { NcContext } from '~/interface/config';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import ModelXcMetaFactory from '~/db/sql-mgr/code/models/xc/ModelXcMetaFactory';
import getColumnUiType from '~/helpers/getColumnUiType';
import getTableNameAlias, { getColumnNameAlias } from '~/helpers/getTableName';
import { getUniqueColumnAliasName } from '~/helpers/getUniqueName';
import mapDefaultDisplayValue from '~/helpers/mapDefaultDisplayValue';
import { NcError } from '~/helpers/catchError';
import NcHelp from '~/utils/NcHelp';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import { Base, Column, Model, Source } from '~/models';

// 待办：移动枚举和类型到单独的文件
export enum MetaDiffType {
  TABLE_NEW = 'TABLE_NEW', // 新表
  TABLE_REMOVE = 'TABLE_REMOVE', // 删除表
  TABLE_COLUMN_ADD = 'TABLE_COLUMN_ADD', // 添加表列
  TABLE_COLUMN_TYPE_CHANGE = 'TABLE_COLUMN_TYPE_CHANGE', // 表列类型变更
  TABLE_COLUMN_PROPS_CHANGED = 'TABLE_COLUMN_PROPS_CHANGED', // 表列属性变更
  TABLE_COLUMN_REMOVE = 'TABLE_COLUMN_REMOVE', // 删除表列
  VIEW_NEW = 'VIEW_NEW', // 新视图
  VIEW_REMOVE = 'VIEW_REMOVE', // 删除视图
  VIEW_COLUMN_ADD = 'VIEW_COLUMN_ADD', // 添加视图列
  VIEW_COLUMN_TYPE_CHANGE = 'VIEW_COLUMN_TYPE_CHANGE', // 视图列类型变更
  VIEW_COLUMN_REMOVE = 'VIEW_COLUMN_REMOVE', // 删除视图列
  TABLE_RELATION_ADD = 'TABLE_RELATION_ADD', // 添加表关系
  TABLE_RELATION_REMOVE = 'TABLE_RELATION_REMOVE', // 删除表关系
  TABLE_VIRTUAL_M2M_REMOVE = 'TABLE_VIRTUAL_M2M_REMOVE', // 删除虚拟多对多关系
}

// 应用更改的优先级顺序，数组中的项会优先处理
const applyChangesPriorityOrder = [
  MetaDiffType.VIEW_COLUMN_REMOVE,
  MetaDiffType.TABLE_RELATION_REMOVE,
];

// 元数据差异类型定义
type MetaDiff = {
  title?: string; // 标题
  table_name: string; // 表名
  source_id: string; // 数据源ID
  type: ModelTypes; // 模型类型
  meta?: any; // 元数据
  detectedChanges: Array<MetaDiffChange>; // 检测到的变更
};

// 元数据差异变更类型定义（使用联合类型区分不同的变更类型）
type MetaDiffChange = {
  msg?: string; // 消息
  // type: MetaDiffType;
} & (
  | {
      type: MetaDiffType.TABLE_NEW | MetaDiffType.VIEW_NEW;
      tn?: string; // 表名
    }
  | {
      type: MetaDiffType.TABLE_REMOVE | MetaDiffType.VIEW_REMOVE;
      tn?: string; // 表名
      model?: Model; // 模型
      id?: string; // ID
    }
  | {
      type: MetaDiffType.TABLE_COLUMN_ADD | MetaDiffType.VIEW_COLUMN_ADD;
      tn?: string; // 表名
      model?: Model; // 模型
      id?: string; // ID
      cn: string; // 列名
    }
  | {
      type:
        | MetaDiffType.TABLE_COLUMN_TYPE_CHANGE
        | MetaDiffType.VIEW_COLUMN_TYPE_CHANGE
        | MetaDiffType.TABLE_COLUMN_REMOVE
        | MetaDiffType.VIEW_COLUMN_REMOVE;
      tn?: string; // 表名
      model?: Model; // 模型
      id?: string; // ID
      cn: string; // 列名
      column: Column; // 列对象
      colId?: string; // 列ID
    }
  | {
      type: MetaDiffType.TABLE_RELATION_REMOVE;
      tn?: string; // 表名
      rtn?: string; // 关联表名
      cn?: string; // 列名
      rcn?: string; // 关联列名
      colId: string; // 列ID
      column: Column; // 列对象
    }
  | {
      type: MetaDiffType.TABLE_VIRTUAL_M2M_REMOVE;
      tn?: string; // 表名
      rtn?: string; // 关联表名
      cn?: string; // 列名
      rcn?: string; // 关联列名
      colId: string; // 列ID
      column: Column; // 列对象
    }
  | {
      type: MetaDiffType.TABLE_RELATION_ADD;
      tn?: string; // 表名
      rtn?: string; // 关联表名
      cn?: string; // 列名
      rcn?: string; // 关联列名
      relationType: RelationTypes; // 关系类型
      cstn?: string; // 约束名
    }
  | {
      type: MetaDiffType.TABLE_COLUMN_PROPS_CHANGED;
      tn?: string; // 表名
      model?: Model; // 模型
      id?: string; // ID
      cn: string; // 列名
      column: Column; // 列对象
      colId?: string; // 列ID
    }
);

@Injectable()
export class MetaDiffsService {
  constructor(private appHooksService: AppHooksService) {}

  /**
   * 获取元数据差异
   * 比较数据库实际结构与NocoDB中存储的元数据，找出差异
   * @param context NocoDB上下文
   * @param sqlClient SQL客户端
   * @param base 基础对象
   * @param source 数据源
   * @returns 元数据差异数组
   */
  async getMetaDiff(
    context: NcContext,
    sqlClient,
    base: Base,
    source: Source,
  ): Promise<Array<MetaDiff>> {
    // 如果是元数据库则返回空数组
    if (source.isMeta()) {
      return [];
    }

    const changes: Array<MetaDiff> = [];
    const virtualRelationColumns: Column<LinkToAnotherRecordColumn>[] = [];

    // @ts-ignore
    // 获取表列表
    const tableList: Array<{ tn: string }> = (
      await sqlClient.tableList({ schema: source.getConfig()?.schema })
    )?.data?.list?.filter((t) => {
      if (base?.prefix && source.is_meta) {
        return t.tn?.startsWith(base?.prefix);
      }
      return true;
    });

    const colListRef = {}; // 列引用对象
    const oldMetas = await source.getModels(context); // 获取旧的元数据模型
    // @ts-ignore
    const oldTableMetas: Model[] = []; // 旧的表元数据
    const oldViewMetas: Model[] = []; // 旧的视图元数据

    // 将模型按类型分类
    for (const model of oldMetas) {
      if (model.type === ModelTypes.TABLE) oldTableMetas.push(model);
      else if (model.type === ModelTypes.VIEW) oldViewMetas.push(model);
    }

    // @ts-ignore
    // 获取所有关系列表
    const relationList: Array<{
      tn: string;
      rtn: string;
      cn: string;
      rcn: string;
      found?: any;
      cstn?: string;
    }> = (
      await sqlClient.relationListAll({ schema: source.getConfig()?.schema })
    )?.data?.list;

    // 处理表的差异
    for (const table of tableList) {
      if (table.tn === 'nc_evolutions') continue; // 跳过演化表

      const oldMetaIdx = oldTableMetas.findIndex(
        (m) => m.table_name === table.tn,
      );

      // 新表
      if (oldMetaIdx === -1) {
        changes.push({
          table_name: table.tn,
          source_id: source.id,
          type: ModelTypes.TABLE,
          detectedChanges: [
            {
              type: MetaDiffType.TABLE_NEW,
              msg: `New table`, // 新表
            },
          ],
        });
        continue;
      }

      const oldMeta = oldTableMetas[oldMetaIdx];

      oldTableMetas.splice(oldMetaIdx, 1); // 从旧表列表中移除已处理的表

      // 创建表属性对象
      const tableProp: MetaDiff = {
        title: oldMeta.title,
        meta: oldMeta.meta,
        table_name: table.tn,
        source_id: source.id,
        type: ModelTypes.TABLE,
        detectedChanges: [],
      };
      changes.push(tableProp);

      // 检查列变更
      colListRef[table.tn] = (
        await sqlClient.columnList({
          tn: table.tn,
          schema: source.getConfig()?.schema,
        })
      )?.data?.list;

      await oldMeta.getColumns(context);

      // 检查每一列的变更
      for (const column of colListRef[table.tn]) {
        const oldColIdx = oldMeta.columns.findIndex(
          (c) => c.column_name === column.cn,
        );

        // 新列
        if (oldColIdx === -1) {
          tableProp.detectedChanges.push({
            type: MetaDiffType.TABLE_COLUMN_ADD,
            msg: `New column(${column.cn})`, // 新列
            cn: column.cn,
            id: oldMeta.id,
          });
          continue;
        }

        const [oldCol] = oldMeta.columns.splice(oldColIdx, 1);

        // 检查列类型是否变更
        if (
          oldCol.dt !== column.dt ||
          // 如果是MySQL且数据类型是set或enum，则还需比较dtxp
          (['mysql', 'mysql2'].includes(source.type) &&
            ['set', 'enum'].includes(column.dt) &&
            column.dtxp !== oldCol.dtxp)
        ) {
          tableProp.detectedChanges.push({
            type: MetaDiffType.TABLE_COLUMN_TYPE_CHANGE,
            msg: `Column type changed(${column.cn})`, // 列类型变更
            cn: oldCol.column_name,
            id: oldMeta.id,
            column: oldCol,
          });
        }

        // 检查列属性是否变更
        if (
          !!oldCol.pk !== !!column.pk ||
          !!oldCol.rqd !== !!column.rqd ||
          !!oldCol.un !== !!column.un ||
          !!oldCol.ai !== !!column.ai ||
          !!oldCol.unique !== !!column.unique
        ) {
          tableProp.detectedChanges.push({
            type: MetaDiffType.TABLE_COLUMN_PROPS_CHANGED,
            msg: `Column properties changed (${column.cn})`, // 列属性变更
            cn: oldCol.column_name,
            id: oldMeta.id,
            column: oldCol,
          });
        }
      }

      // 处理已删除的列
      for (const column of oldMeta.columns) {
        // 跳过虚拟列类型
        if (
          [
            UITypes.LinkToAnotherRecord,
            UITypes.Links,
            UITypes.Rollup,
            UITypes.Lookup,
            UITypes.Formula,
            UITypes.QrCode,
            UITypes.Barcode,
            UITypes.Button,
          ].includes(column.uidt) ||
          isAIPromptCol(column)
        ) {
          if (isLinksOrLTAR(column.uidt)) {
            virtualRelationColumns.push(column);
          }

          continue;
        }

        tableProp.detectedChanges.push({
          type: MetaDiffType.TABLE_COLUMN_REMOVE,
          msg: `Column removed(${column.column_name})`, // 列已删除
          cn: column.column_name,
          id: oldMeta.id,
          column: column,
          colId: column.id,
        });
      }
    }

    // 处理已删除的表
    for (const model of oldTableMetas) {
      changes.push({
        table_name: model.table_name,
        meta: model.meta,
        source_id: source.id,
        type: ModelTypes.TABLE,
        detectedChanges: [
          {
            type: MetaDiffType.TABLE_REMOVE,
            msg: `Table removed`, // 表已删除
            tn: model.table_name,
            id: model.id,
            model,
          },
        ],
      });
    }

    // 处理虚拟关系列
    for (const relationCol of virtualRelationColumns) {
      const colOpt = await relationCol.getColOptions<LinkToAnotherRecordColumn>(
        context,
      );
      const parentCol = await colOpt.getParentColumn(context);
      const childCol = await colOpt.getChildColumn(context);
      const parentModel = await parentCol.getModel(context);
      const childModel = await childCol.getModel(context);

      // 多对多关系
      if (colOpt.type === RelationTypes.MANY_TO_MANY) {
        const m2mModel = await colOpt.getMMModel(context);

        const relatedTable = tableList.find(
          (t) => t.tn === parentModel.table_name,
        );
        const m2mTable = tableList.find((t) => t.tn === m2mModel.table_name);

        // 如果关联表不存在
        if (!relatedTable) {
          changes
            .find((t) => t.table_name === childModel.table_name)
            .detectedChanges.push({
              type: MetaDiffType.TABLE_VIRTUAL_M2M_REMOVE,
              msg: `Many to many removed(${parentModel.table_name} removed)`, // 多对多关系已删除(关联表已删除)
              colId: relationCol.id,
              column: relationCol,
            });
          continue;
        }

        // 如果中间表不存在
        if (!m2mTable) {
          changes
            .find((t) => t.table_name === childModel.table_name)
            .detectedChanges.push({
              type: MetaDiffType.TABLE_VIRTUAL_M2M_REMOVE,
              msg: `Many to many removed(${m2mModel.table_name} removed)`, // 多对多关系已删除(中间表已删除)
              colId: relationCol.id,
              column: relationCol,
            });
          continue;
        }

        // 验证列

        // 获取子表列
        const cColumns = (colListRef[childModel.table_name] =
          colListRef[childModel.table_name] ||
          (
            await sqlClient.columnList({
              tn: childModel.table_name,
              schema: source.getConfig()?.schema,
            })
          )?.data?.list);

        // 获取父表列
        const pColumns = (colListRef[parentModel.table_name] =
          colListRef[parentModel.table_name] ||
          (
            await sqlClient.columnList({
              tn: parentModel.table_name,
              schema: source.getConfig()?.schema,
            })
          )?.data?.list);

        // 获取中间表列
        const vColumns = (colListRef[m2mTable.tn] =
          colListRef[m2mTable.tn] ||
          (
            await sqlClient.columnList({
              tn: m2mTable.tn,
              schema: source.getConfig()?.schema,
            })
          )?.data?.list);

        const m2mChildCol = await colOpt.getMMChildColumn(context);
        const m2mParentCol = await colOpt.getMMParentColumn(context);

        // 如果任何关系列不存在
        if (
          pColumns.every((c) => c.cn !== parentCol.column_name) ||
          cColumns.every((c) => c.cn !== childCol.column_name) ||
          vColumns.every((c) => c.cn !== m2mChildCol.column_name) ||
          vColumns.every((c) => c.cn !== m2mParentCol.column_name)
        ) {
          changes
            .find((t) => t.table_name === childModel.table_name)
            .detectedChanges.push({
              type: MetaDiffType.TABLE_VIRTUAL_M2M_REMOVE,
              msg: `Many to many removed(One of the relation column removed)`, // 多对多关系已删除(其中一个关系列已删除)
              colId: relationCol.id,
              column: relationCol,
            });
        }

        continue;
      }

      // 跳过虚拟关系
      if (relationCol.colOptions.virtual) continue;

      // 查找数据库中的关系
      const dbRelation = relationList.find(
        (r) =>
          r.cn === childCol.column_name &&
          r.tn === childModel.table_name &&
          r.rcn === parentCol.column_name &&
          r.rtn === parentModel.table_name,
      );

      if (dbRelation) {
        dbRelation.found = dbRelation.found || {};

        if (dbRelation.found[colOpt.type]) {
          // 待办：处理重复
        } else {
          dbRelation.found[colOpt.type] = true;
        }
      } else {
        // 关系已删除
        changes
          .find(
            (t) =>
              t.table_name ===
              (colOpt.type === RelationTypes.BELONGS_TO ||
              (colOpt.type === RelationTypes.ONE_TO_ONE && relationCol.meta?.bt)
                ? childModel.table_name
                : parentModel.table_name),
          )
          .detectedChanges.push({
            type: MetaDiffType.TABLE_RELATION_REMOVE,
            tn: childModel.table_name,
            rtn: parentModel.table_name,
            cn: childCol.column_name,
            rcn: parentCol.column_name,
            msg: `Relation removed`, // 关系已删除
            colId: relationCol.id,
            column: relationCol,
          });
      }
    }

    // 处理新增的关系
    for (const relation of relationList) {
      // 添加BELONGS_TO关系
      if (
        !relation?.found?.[RelationTypes.BELONGS_TO] &&
        !relation?.found?.[RelationTypes.ONE_TO_ONE]
      ) {
        changes
          .find((t) => t.table_name === relation.tn)
          ?.detectedChanges.push({
            type: MetaDiffType.TABLE_RELATION_ADD,
            tn: relation.tn,
            rtn: relation.rtn,
            cn: relation.cn,
            rcn: relation.rcn,
            msg: `New relation added`, // 新关系已添加
            relationType: RelationTypes.BELONGS_TO,
            cstn: relation.cstn,
          });
      }

      // 添加HAS_MANY关系
      if (
        !relation?.found?.[RelationTypes.HAS_MANY] &&
        !relation?.found?.[RelationTypes.ONE_TO_ONE]
      ) {
        changes
          .find((t) => t.table_name === relation.rtn)
          ?.detectedChanges.push({
            type: MetaDiffType.TABLE_RELATION_ADD,
            tn: relation.tn,
            rtn: relation.rtn,
            cn: relation.cn,
            rcn: relation.rcn,
            msg: `New relation added`, // 新关系已添加
            relationType: RelationTypes.HAS_MANY,
          });
      }
    }

    // 处理视图
    // @ts-ignore
    const viewList: Array<{
      view_name: string;
      tn: string;
      type: 'view';
    }> = (
      await sqlClient.viewList({ schema: source.getConfig()?.schema })
    )?.data?.list
      ?.map((v) => {
        v.type = 'view';
        v.tn = v.view_name;
        return v;
      })
      .filter((t) => {
        if (base?.prefix && source.is_meta) {
          return t.tn?.startsWith(base?.prefix);
        }
        return true;
      }); // @ts-ignore

    // 处理视图的差异
    for (const view of viewList) {
      const oldMetaIdx = oldViewMetas.findIndex(
        (m) => m.table_name === view.tn,
      );

      // 新视图
      if (oldMetaIdx === -1) {
        changes.push({
          table_name: view.tn,
          source_id: source.id,
          type: ModelTypes.VIEW,
          detectedChanges: [
            {
              type: MetaDiffType.VIEW_NEW,
              msg: `New view`, // 新视图
            },
          ],
        });
        continue;
      }

      const oldMeta = oldViewMetas[oldMetaIdx];

      oldViewMetas.splice(oldMetaIdx, 1); // 从旧视图列表中移除已处理的视图

      // 创建视图属性对象
      const tableProp: MetaDiff = {
        title: oldMeta.title,
        meta: oldMeta.meta,
        table_name: view.tn,
        source_id: source.id,
        type: ModelTypes.VIEW,
        detectedChanges: [],
      };
      changes.push(tableProp);

      // 检查列变更
      colListRef[view.tn] = (
        await sqlClient.columnList({
          tn: view.tn,
          schema: source.getConfig()?.schema,
        })
      )?.data?.list;

      await oldMeta.getColumns(context);

      // 检查每一列的变更
      for (const column of colListRef[view.tn]) {
        const oldColIdx = oldMeta.columns.findIndex(
          (c) => c.column_name === column.cn,
        );

        // 新列
        if (oldColIdx === -1) {
          tableProp.detectedChanges.push({
            type: MetaDiffType.VIEW_COLUMN_ADD,
            msg: `New column(${column.cn})`, // 新列
            cn: column.cn,
            id: oldMeta.id,
          });
          continue;
        }

        const [oldCol] = oldMeta.columns.splice(oldColIdx, 1);

        // 检查列类型是否变更
        if (
          oldCol.dt !== column.dt ||
          // 如果是MySQL且数据类型是set或enum，则还需比较dtxp
          (['mysql', 'mysql2'].includes(source.type) &&
            ['set', 'enum'].includes(column.dt) &&
            column.dtxp !== oldCol.dtxp)
        ) {
          tableProp.detectedChanges.push({
            type: MetaDiffType.TABLE_COLUMN_TYPE_CHANGE,
            msg: `Column type changed(${column.cn})`, // 列类型变更
            cn: oldCol.column_name,
            id: oldMeta.id,
            column: oldCol,
          });
        }
      }

      // 处理已删除的列
      for (const column of oldMeta.columns) {
        // 跳过虚拟列类型
        if (
          [
            UITypes.LinkToAnotherRecord,
            UITypes.Rollup,
            UITypes.Lookup,
            UITypes.Formula,
            UITypes.Links,
            UITypes.QrCode,
            UITypes.Barcode,
          ].includes(column.uidt)
        ) {
          continue;
        }

        tableProp.detectedChanges.push({
          type: MetaDiffType.VIEW_COLUMN_REMOVE,
          msg: `Column removed(${column.column_name})`, // 列已删除
          cn: column.column_name,
          id: oldMeta.id,
          column: column,
          colId: column.id,
        });
      }
    }

    // 处理已删除的视图
    for (const model of oldViewMetas) {
      changes.push({
        table_name: model.table_name,
        meta: model.meta,
        source_id: source.id,
        type: ModelTypes.TABLE,
        detectedChanges: [
          {
            type: MetaDiffType.VIEW_REMOVE,
            msg: `Table removed`, // 表已删除
            tn: model.table_name,
            id: model.id,
            model,
          },
        ],
      });
    }

    return changes;
  }

  /**
   * 获取基础元数据差异
   * @param context NocoDB上下文
   * @param param 参数对象，包含baseId
   * @returns 元数据差异数组
   */
  async metaDiff(context: NcContext, param: { baseId: string }) {
    const base = await Base.getWithInfo(context, param.baseId);
    let changes = [];
    for (const source of base.sources) {
      try {
        // 跳过元数据库
        if (source.isMeta()) continue;

        // @ts-ignore
        const sqlClient = await NcConnectionMgrv2.getSqlClient(source);
        changes = changes.concat(
          await this.getMetaDiff(context, sqlClient, base, source),
        );
      } catch (e) {
        console.log(e);
      }
    }

    return changes;
  }

  /**
   * 获取特定数据源的元数据差异
   * @param context NocoDB上下文
   * @param param 参数对象，包含baseId、sourceId和user
   * @returns 元数据差异数组
   */
  async baseMetaDiff(
    context: NcContext,
    param: { baseId: string; sourceId: string; user: UserType },
  ) {
    const base = await Base.getWithInfo(context, param.baseId);
    const source = await Source.get(context, param.sourceId);

    let changes = [];

    const sqlClient = await NcConnectionMgrv2.getSqlClient(source);
    changes = await this.getMetaDiff(context, sqlClient, base, source);

    return changes;
  }

  /**
   * 同步基础元数据
   * 将数据库实际结构与NocoDB中的元数据同步
   * @param context NocoDB上下文
   * @param options 选项对象
   * @returns void
   */
  async syncBaseMeta(
    context: NcContext,
    {
      base,
      source,
      throwOnFail = false,
      logger,
      user,
    }: {
      base: Base; // 基础对象，包含项目信息
      source: Source; // 数据源对象
      throwOnFail?: boolean; // 失败时是否抛出异常
      logger?: (message: string) => void; // 日志记录函数
      user: UserType; // 用户信息
    },
  ) {
    // 检查是否为元数据源，如果是则不能同步
    if (source.isMeta()) {
      // 如果设置了throwOnFail，则抛出错误
      if (throwOnFail) NcError.badRequest('Cannot sync meta source');
      return;
    }

    // 创建虚拟列插入操作的数组，用于后续批量处理
    const virtualColumnInsert: Array<() => Promise<void>> = [];

    // 记录日志：开始获取元数据差异
    logger?.(`Getting meta diff for ${source.alias}`);

    // 获取SQL客户端连接
    // @ts-ignore
    const sqlClient = await NcConnectionMgrv2.getSqlClient(source);
    // 获取元数据差异
    const changes = await this.getMetaDiff(context, sqlClient, base, source);

    /* 获取所有关系 - 已注释掉的代码 */
    // const relations = (await sqlClient.relationListAll())?.data?.list;

    // 遍历每个表的变更
    for (const { table_name, detectedChanges } of changes) {
      // 重新排序变更，优先应用关系删除变更和列删除变更
      // 这样可以避免外键约束错误（先删除依赖关系，再删除被依赖的对象）
      detectedChanges.sort((a, b) => {
        return (
          applyChangesPriorityOrder.indexOf(b.type) -
          applyChangesPriorityOrder.indexOf(a.type)
        );
      });

      // 如果没有检测到变更，则跳过当前表
      if (detectedChanges.length === 0) {
        logger?.(`No changes detected for ${table_name}`);
        continue;
      }

      // 记录日志：开始应用表的变更
      logger?.(`Applying changes for ${table_name}`);

      // 遍历每个变更并应用
      for (const change of detectedChanges) {
        // 记录日志：应用具体的变更
        logger?.(`Applying change: ${change.msg}`);

        // 根据变更类型执行不同的操作
        switch (change.type) {
          case MetaDiffType.TABLE_NEW:
            {
              // 处理新表：获取表的所有列信息
              const columns = (
                await sqlClient.columnList({
                  tn: table_name,
                  schema: source.getConfig()?.schema,
                })
              )?.data?.list?.map((c) => ({ ...c, column_name: c.cn }));

              // 映射默认显示值
              mapDefaultDisplayValue(columns);

              // 在NocoDB中插入新模型记录
              const model = await Model.insert(context, base.id, source.id, {
                table_name: table_name,
                title: getTableNameAlias(
                  table_name,
                  source.is_meta ? base.prefix : '',
                  source,
                ),
                type: ModelTypes.TABLE,
                user_id: user.id,
              });

              // 为每一列创建列记录
              for (const column of columns) {
                await Column.insert(context, {
                  uidt: getColumnUiType(source, column), // 获取UI数据类型
                  fk_model_id: model.id, // 关联到模型
                  ...column, // 包含列的所有属性
                  title: getColumnNameAlias(column.column_name, source), // 获取列的别名
                });
              }
            }
            break;
          case MetaDiffType.VIEW_NEW:
            {
              // 处理新视图：获取视图的所有列信息
              const columns = (
                await sqlClient.columnList({
                  tn: table_name,
                  schema: source.getConfig()?.schema,
                })
              )?.data?.list?.map((c) => ({ ...c, column_name: c.cn }));

              // 映射默认显示值
              mapDefaultDisplayValue(columns);

              // 在NocoDB中插入新视图模型记录
              const model = await Model.insert(context, base.id, source.id, {
                table_name: table_name,
                title: getTableNameAlias(table_name, base.prefix, source),
                type: ModelTypes.VIEW,
                user_id: user.id,
              });

              // 为每一列创建列记录
              for (const column of columns) {
                await Column.insert(context, {
                  uidt: getColumnUiType(source, column), // 获取UI数据类型
                  fk_model_id: model.id, // 关联到模型
                  ...column, // 包含列的所有属性
                  title: getColumnNameAlias(column.column_name, source), // 获取列的别名
                });
              }
            }
            break;
          case MetaDiffType.TABLE_REMOVE:
          case MetaDiffType.VIEW_REMOVE:
            {
              // 处理表或视图删除：直接删除模型及其关联数据
              await change.model.delete(context);
            }
            break;
          case MetaDiffType.TABLE_COLUMN_ADD:
          case MetaDiffType.VIEW_COLUMN_ADD:
            {
              // 处理新增列：获取表的所有列信息
              const columns = (
                await sqlClient.columnList({
                  tn: table_name,
                  schema: source.getConfig()?.schema,
                })
              )?.data?.list?.map((c) => ({ ...c, column_name: c.cn }));

              // 找到新增的列
              const column = columns.find((c) => c.cn === change.cn);
              // 设置UI数据类型
              column.uidt = getColumnUiType(source, column);
              //todo: inflection - 待处理：词形变化
              // 设置列标题
              column.title = getColumnNameAlias(column.cn, source);
              // 插入新列记录
              await Column.insert(context, {
                fk_model_id: change.id, // 关联到模型
                ...column, // 包含列的所有属性
              });
            }
            // 更新旧数据 - 已注释掉的代码
            // populateParams.tableNames.push({ tn });
            // populateParams.oldMetas[tn] = oldMetas.find(m => m.tn === tn);

            break;
          case MetaDiffType.TABLE_COLUMN_TYPE_CHANGE:
          case MetaDiffType.VIEW_COLUMN_TYPE_CHANGE:
            {
              // 处理列类型变更：获取表的所有列信息
              const columns = (
                await sqlClient.columnList({
                  tn: table_name,
                  schema: source.getConfig()?.schema,
                })
              )?.data?.list?.map((c) => ({ ...c, column_name: c.cn }));

              // 找到类型变更的列
              const column = columns.find((c) => c.cn === change.cn);
              // 创建元数据工厂实例
              const metaFact = ModelXcMetaFactory.create(
                { client: source.type },
                {},
              );
              // 获取新的UI数据类型
              column.uidt = metaFact.getUIDataType(column);
              // 保留原列标题
              column.title = change.column.title;
              // 更新列记录
              await Column.update(context, change.column.id, column);
            }
            break;
          case MetaDiffType.TABLE_COLUMN_PROPS_CHANGED:
            {
              // 处理列属性变更：获取表的所有列信息
              const columns = (
                await sqlClient.columnList({ tn: table_name })
              )?.data?.list?.map((c) => ({ ...c, column_name: c.cn }));

              // 找到属性变更的列
              const colMeta = columns.find((c) => c.cn === change.cn);
              if (!colMeta) break; // 如果找不到列，则跳过

              // 提取需要更新的属性：主键、自增、必填、唯一、唯一约束
              const { pk, ai, rqd, un, unique } = colMeta;
              // 更新列记录
              await Column.update(context, change.column.id, {
                pk,
                ai,
                rqd,
                un,
                unique,
              });
            }
            break;
          case MetaDiffType.TABLE_COLUMN_REMOVE:
          case MetaDiffType.VIEW_COLUMN_REMOVE:
            // 处理列删除：直接删除列记录
            await change.column.delete(context);
            break;
          case MetaDiffType.TABLE_RELATION_REMOVE:
          case MetaDiffType.TABLE_VIRTUAL_M2M_REMOVE:
            // 处理关系删除或虚拟多对多关系删除：直接删除列记录
            await change.column.delete(context);
            break;
          case MetaDiffType.TABLE_RELATION_ADD:
            {
              // 处理新增关系：将操作添加到虚拟列插入队列中
              virtualColumnInsert.push(async () => {
                // 获取父模型（被引用的表）
                const parentModel = await Model.getByIdOrName(context, {
                  base_id: source.base_id,
                  source_id: source.id,
                  table_name: change.rtn,
                });
                // 获取子模型（引用其他表的表）
                const childModel = await Model.getByIdOrName(context, {
                  base_id: source.base_id,
                  source_id: source.id,
                  table_name: change.tn,
                });

                // 获取父表中的关联列
                const parentCol = await parentModel
                  .getColumns(context)
                  .then((cols) =>
                    cols.find((c) => c.column_name === change.rcn),
                  );
                // 获取子表中的关联列
                const childCol = await childModel
                  .getColumns(context)
                  .then((cols) =>
                    cols.find((c) => c.column_name === change.cn),
                  );

                // 更新子表中的关联列，将其标记为外键
                await Column.update(context, childCol.id, {
                  ...childCol,
                  uidt: UITypes.ForeignKey, // 设置为外键类型
                  system: true, // 标记为系统列
                });

                // 根据关系类型创建不同的关系列
                if (change.relationType === RelationTypes.BELONGS_TO) {
                  // 处理"属于"关系：在子表中创建指向父表的链接
                  // 生成唯一的列别名
                  const title = getUniqueColumnAliasName(
                    childModel.columns,
                    `${parentModel.title || parentModel.table_name}`,
                  );
                  // 插入链接到另一条记录的列
                  await Column.insert<LinkToAnotherRecordColumn>(context, {
                    uidt: UITypes.LinkToAnotherRecord, // 设置为链接类型
                    title, // 列标题
                    fk_model_id: childModel.id, // 所属模型ID
                    fk_related_model_id: parentModel.id, // 关联模型ID
                    type: RelationTypes.BELONGS_TO, // 关系类型：属于
                    fk_parent_column_id: parentCol.id, // 父列ID
                    fk_child_column_id: childCol.id, // 子列ID
                    virtual: false, // 非虚拟列
                    fk_index_name: change.cstn, // 外键索引名称
                  });
                } else if (change.relationType === RelationTypes.HAS_MANY) {
                  // 处理"拥有多个"关系：在父表中创建指向子表的链接
                  // 生成唯一的列别名，使用子表名称的复数形式
                  const title = getUniqueColumnAliasName(
                    childModel.columns,
                    pluralize(childModel.title || childModel.table_name),
                  );
                  // 插入链接列
                  await Column.insert<LinkToAnotherRecordColumn>(context, {
                    uidt: UITypes.Links, // 设置为链接类型
                    title, // 列标题
                    fk_model_id: parentModel.id, // 所属模型ID
                    fk_related_model_id: childModel.id, // 关联模型ID
                    type: RelationTypes.HAS_MANY, // 关系类型：拥有多个
                    fk_parent_column_id: parentCol.id, // 父列ID
                    fk_child_column_id: childCol.id, // 子列ID
                    virtual: false, // 非虚拟列
                    fk_index_name: change.cstn, // 外键索引名称
                    meta: {
                      // 元数据：包含复数和单数形式
                      plural: pluralize(childModel.title),
                      singular: singularize(childModel.title),
                    },
                  });
                }
              });
            }
            break;
        }
      }
      // 记录日志：表的变更已应用完成
      logger?.(`Changes applied for ${table_name}`);
    }

    // 记录日志：开始处理虚拟列变更
    logger?.(`Processing virtual column changes`);

    // 执行所有虚拟列插入操作
    await NcHelp.executeOperations(virtualColumnInsert, source.type);

    // 记录日志：虚拟列变更已应用
    logger?.(`Virtual column changes applied`);

    // 记录日志：开始处理多对多关系变更
    logger?.(`Processing many to many relation changes`);

    // 提取并生成多对多关系
    await this.extractAndGenerateManyToManyRelations(
      context,
      await source.getModels(context),
    );

    // 记录日志：多对多关系变更已应用
    logger?.(`Many to many relation changes applied`);
  }

  /**
   * 元数据差异同步
   * 同步所有数据源的元数据
   * @param context NocoDB上下文
   * @param param 参数对象，包含baseId、logger和req
   * @returns 布尔值，表示同步是否成功
   */
  async metaDiffSync(
    context: NcContext,
    param: { baseId: string; logger?: (message: string) => void; req: any },
  ) {
    const base = await Base.getWithInfo(context, param.baseId);
    // 同步每个数据源的元数据
    for (const source of base.sources) {
      await this.syncBaseMeta(context, {
        base,
        source,
        logger: param.logger,
        user: param.req.user,
      });
    }

    // 触发元数据差异同步事件
    this.appHooksService.emit(AppEvents.META_DIFF_SYNC, {
      base,
      req: param.req,
      context,
    });

    return true;
  }

  /**
   * 基础元数据差异同步
   * 同步特定数据源的元数据
   * @param context NocoDB上下文
   * @param param 参数对象，包含baseId、sourceId、logger和req
   * @returns 布尔值，表示同步是否成功
   */
  async baseMetaDiffSync(
    context: NcContext,
    param: {
      baseId: string;
      sourceId: string;
      logger?: (message: string) => void;
      req: any;
    },
  ) {
    const base = await Base.getWithInfo(context, param.baseId);
    const source = await Source.get(context, param.sourceId);

    // 同步数据源元数据
    await this.syncBaseMeta(context, {
      base,
      source,
      throwOnFail: true,
      logger: param.logger,
      user: param.req.user,
    });

    // 触发元数据差异同步事件
    this.appHooksService.emit(AppEvents.META_DIFF_SYNC, {
      base,
      source,
      req: param.req,
      context,
    });

    return true;
  }

  /**
   * 检查多对多关系是否存在
   * @param context NocoDB上下文
   * @param model 模型
   * @param assocModel 关联模型
   * @param belongsToCol 属于关系列
   * @returns 布尔值，表示关系是否存在
   */
  async isMMRelationExist(
    context: NcContext,
    model: Model,
    assocModel: Model,
    belongsToCol: Column<LinkToAnotherRecordColumn>,
  ) {
    let isExist = false;
    const colChildOpt =
      await belongsToCol.getColOptions<LinkToAnotherRecordColumn>(context);
    // 遍历模型的所有列，查找是否已存在多对多关系
    for (const col of await model.getColumns(context)) {
      if (isLinksOrLTAR(col.uidt)) {
        const colOpt = await col.getColOptions<LinkToAnotherRecordColumn>(
          context,
        );
        // 检查是否是相同的多对多关系
        if (
          colOpt &&
          colOpt.type === RelationTypes.MANY_TO_MANY &&
          colOpt.fk_mm_model_id === assocModel.id &&
          colOpt.fk_child_column_id === colChildOpt.fk_parent_column_id &&
          colOpt.fk_mm_child_column_id === colChildOpt.fk_child_column_id
        ) {
          isExist = true;
          break;
        }
      }
    }
    return isExist;
  }

  /**
   * 提取并生成多对多关系
   * 分析模型之间的关系，自动识别并创建多对多关系
   * @param context NocoDB上下文
   * @param modelsArr 模型数组
   */
  // @ts-ignore
  async extractAndGenerateManyToManyRelations(
    context: NcContext,
    modelsArr: Array<Model>,
  ) {
    for (const assocModel of modelsArr) {
      await assocModel.getColumns(context);
      // 通过检查外键数量和列数来判断表是否为桥接表（或关联表）

      // 获取普通列（非虚拟列）
      const normalColumns = assocModel.columns.filter((c) => !isVirtualCol(c));
      const belongsToCols: Column<LinkToAnotherRecordColumn>[] = [];

      // 查找所有"属于"类型的关系列
      for (const col of assocModel.columns) {
        if (col.uidt == UITypes.LinkToAnotherRecord) {
          const colOpt = await col.getColOptions<LinkToAnotherRecordColumn>(
            context,
          );
          if (colOpt?.type === RelationTypes.BELONGS_TO)
            belongsToCols.push(col);
        }
      }

      // 识别多对多关系的条件：
      // 1. 有两个"属于"类型的关系列
      // 2. 普通列数量少于5
      // 3. 有两个主键
      if (
        belongsToCols?.length === 2 &&
        normalColumns.length < 5 &&
        assocModel.primaryKeys.length === 2
      ) {
        // 获取关联的两个模型
        const modelA = await belongsToCols[0].colOptions.getRelatedTable(
          context,
        );
        const modelB = await belongsToCols[1].colOptions.getRelatedTable(
          context,
        );

        await modelA.getColumns(context);
        await modelB.getColumns(context);

        // 检查模型A和模型B是否已经有了这个关系
        const isRelationAvailInA = await this.isMMRelationExist(
          context,
          modelA,
          assocModel,
          belongsToCols[0],
        );
        const isRelationAvailInB = await this.isMMRelationExist(
          context,
          modelB,
          assocModel,
          belongsToCols[1],
        );

        // 如果模型A没有这个关系，则创建
        if (!isRelationAvailInA) {
          await Column.insert<LinksColumn>(context, {
            title: getUniqueColumnAliasName(
              modelA.columns,
              pluralize(modelB.title),
            ),
            fk_model_id: modelA.id,
            fk_related_model_id: modelB.id,
            fk_mm_model_id: assocModel.id,
            fk_child_column_id: belongsToCols[0].colOptions.fk_parent_column_id,
            fk_parent_column_id:
              belongsToCols[1].colOptions.fk_parent_column_id,
            fk_mm_child_column_id:
              belongsToCols[0].colOptions.fk_child_column_id,
            fk_mm_parent_column_id:
              belongsToCols[1].colOptions.fk_child_column_id,
            type: RelationTypes.MANY_TO_MANY,
            uidt: UITypes.Links,
            meta: {
              plural: pluralize(modelB.title),
              singular: singularize(modelB.title),
            },
          });
        }

        // 如果模型B没有这个关系，则创建
        if (!isRelationAvailInB) {
          await Column.insert<LinksColumn>(context, {
            title: getUniqueColumnAliasName(
              modelB.columns,
              pluralize(modelA.title),
            ),
            fk_model_id: modelB.id,
            fk_related_model_id: modelA.id,
            fk_mm_model_id: assocModel.id,
            fk_child_column_id: belongsToCols[1].colOptions.fk_parent_column_id,
            fk_parent_column_id:
              belongsToCols[0].colOptions.fk_parent_column_id,
            fk_mm_child_column_id:
              belongsToCols[1].colOptions.fk_child_column_id,
            fk_mm_parent_column_id:
              belongsToCols[0].colOptions.fk_child_column_id,
            type: RelationTypes.MANY_TO_MANY,
            uidt: UITypes.Links,
            meta: {
              plural: pluralize(modelA.title),
              singular: singularize(modelA.title),
            },
          });
        }

        // 将关联模型标记为多对多表
        await Model.markAsMmTable(context, assocModel.id, true);

        // 将与多对多关联的"拥有多个"关系在两个表中标记为系统字段
        for (const btCol of [belongsToCols[0], belongsToCols[1]]) {
          const colOpt = await btCol.colOptions;
          const model = await colOpt.getRelatedTable(context);

          for (const col of await model.getColumns(context)) {
            if (!isLinksOrLTAR(col.uidt)) continue;

            const colOpt1 = await col.getColOptions<LinkToAnotherRecordColumn>(
              context,
            );
            if (!colOpt1 || colOpt1.type !== RelationTypes.HAS_MANY) continue;

            // 检查是否是相同的关系
            if (
              colOpt1.fk_child_column_id !== colOpt.fk_child_column_id ||
              colOpt1.fk_parent_column_id !== colOpt.fk_parent_column_id
            )
              continue;

            // 标记为系统字段
            await Column.markAsSystemField(context, col.id);
            break;
          }
        }
      } else {
        // 如果不满足多对多关系条件，但之前被标记为多对多表，则取消标记
        if (assocModel.mm)
          await Model.markAsMmTable(context, assocModel.id, false);
      }
    }
  }
}
