// 导入NestJS的Injectable装饰器，用于依赖注入
import { Injectable } from '@nestjs/common';
// 导入nocodb-sdk中的工具函数和类型定义
import {
  isCreatedOrLastModifiedByCol, // 检查列是否为创建者或最后修改者列
  isLinksOrLTAR, // 检查列是否为链接或LTAR(Link To Another Record)类型
  ncIsObject, // 检查值是否为对象
  RelationTypes, // 关系类型枚举
  UITypes, // UI类型枚举
  ViewTypes, // 视图类型枚举
} from 'nocodb-sdk';
// 导入模型类型定义
import type {
  CalendarView, // 日历视图类型
  LinkToAnotherRecordColumn, // 链接到其他记录的列类型
  LookupColumn, // 查找列类型
} from '~/models';
// 导入NcContext类型定义
import type { NcContext } from '~/interface/config';
// 导入模型类
import {
  Base, // 基础模型
  BaseUser, // 基础用户模型
  Column, // 列模型
  GridViewColumn, // 网格视图列模型
  Model, // 数据模型
  PresignedUrl, // 预签名URL模型
  Source, // 数据源模型
  View, // 视图模型
} from '~/models';
// 导入错误处理工具
import { NcError } from '~/helpers/catchError';
// 导入属性提取工具
import { extractProps } from '~/helpers/extractProps';

// 使用Injectable装饰器标记该服务可被依赖注入
@Injectable()
export class PublicMetasService {
  /**
   * 获取视图元数据
   * @param context - NcContext上下文对象
   * @param param - 包含共享视图UUID和密码的参数对象
   * @returns 返回处理后的视图对象
   */
  async viewMetaGet(
    context: NcContext,
    param: { sharedViewUuid: string; password: string },
  ) {
    // 通过UUID获取视图，并扩展类型以包含额外属性
    const view: View & {
      relatedMetas?: { [ket: string]: Model }; // 相关元数据
      users?: { id: string; display_name: string; email: string }[]; // 用户列表
      client?: string; // 客户端类型
    } = await View.getByUUID(context, param.sharedViewUuid);

    // 如果视图不存在，抛出错误
    if (!view) NcError.viewNotFound(param.sharedViewUuid);

    // 验证视图密码
    if (view.password && view.password !== param.password) {
      NcError.invalidSharedViewPassword();
    }

    // 获取视图的过滤器
    await view.getFilters(context);
    // 获取视图的排序
    await view.getSorts(context);

    // 获取视图的详细信息
    await view.getViewWithInfo(context);
    // 获取视图的列
    await view.getColumns(context);
    // 获取视图关联的模型信息
    await view.getModelWithInfo(context);
    // 获取模型的列
    await view.model.getColumns(context);

    // 获取数据源
    const source = await Source.get(context, view.model.source_id);
    // 设置客户端类型为数据源类型
    view.client = source.type;

    // 移除密码，不返回给客户端
    // todo: return only required props
    view.password = undefined;

    // 日历视图所需的范围列
    const rangeColumns = [];

    // 如果是日历视图，处理日历范围列
    if (view.type === ViewTypes.CALENDAR) {
      for (const c of (view.view as CalendarView).calendar_range) {
        if (c.fk_from_column_id) {
          rangeColumns.push(c.fk_from_column_id);
        } else if ((c as any).fk_to_column_id) {
          rangeColumns.push((c as any).fk_to_column_id);
        }
      }
    }

    // 过滤和映射视图的列
    view.model.columns = view.columns
      .filter((c) => {
        const column = view.model.columnsById[c.fk_column_id];

        // 如果列在日历范围列中，保留
        if (rangeColumns.includes(c.fk_column_id)) {
          return true;
        }
        // 检查列是否存在，防止处理不存在的列
        if (!column) return false;

        // 根据多种条件决定是否保留列
        return (
          (c instanceof GridViewColumn && c.group_by) || // 如果是分组列
          c.show || // 如果列设置为显示
          (column.rqd && !column.cdf && !column.ai) || // 如果列是必需的且没有默认值和自增
          column.pk || // 如果列是主键
          view.model.columns.some(
            (c1) =>
              isLinksOrLTAR(c1.uidt) && // 如果列是链接或LTAR类型
              (<LinkToAnotherRecordColumn>c1.colOptions).type ===
                RelationTypes.BELONGS_TO && // 且关系类型是BELONGS_TO
              view.columns.some((vc) => vc.fk_column_id === c1.id && vc.show) && // 且相关列显示
              (<LinkToAnotherRecordColumn>c1.colOptions).fk_child_column_id ===
                c.fk_column_id, // 且外键子列ID匹配
          )
        );
      })
      .map(
        // 将过滤后的列映射为Column实例
        (c) =>
          new Column({
            ...c,
            ...view.model.columnsById[c.fk_column_id],
          } as any),
      ) as any;

    // 初始化相关元数据对象
    const relatedMetas = {};

    // 加载相关表的元数据
    for (const col of view.model.columns) {
      await this.extractRelatedMetas(context, { col, relatedMetas });
    }

    // 设置视图的相关元数据
    view.relatedMetas = relatedMetas;

    // 如果模型的列中有用户类型或创建者/修改者列，获取用户列表
    if (
      view.model.columns.some(
        (c) => c.uidt === UITypes.User || isCreatedOrLastModifiedByCol(c),
      )
    ) {
      // 获取基础用户列表
      const baseUsers = await BaseUser.getUsersList(context, {
        base_id: view.model.base_id,
      });

      // 为用户图标签名
      await PresignedUrl.signMetaIconImage(baseUsers);

      // 映射用户信息，只保留必要字段
      view.users = baseUsers.map((u) => ({
        id: u.id,
        display_name: u.display_name,
        email: u.email,
        meta: ncIsObject(u.meta)
          ? extractProps(u.meta, ['icon', 'iconType'])
          : null,
      }));
    }

    // 返回处理后的视图
    return view;
  }

  /**
   * 提取相关元数据
   * @param context - NcContext上下文对象
   * @param col - 列对象
   * @param relatedMetas - 相关元数据对象
   * @private
   */
  private async extractRelatedMetas(
    context: NcContext,
    {
      col,
      relatedMetas = {},
    }: {
      col: Column<any>;
      relatedMetas: Record<string, Model>;
    },
  ) {
    // 如果列是链接或LTAR类型
    if (isLinksOrLTAR(col.uidt)) {
      // 提取LTAR相关元数据
      await this.extractLTARRelatedMetas(context, {
        ltarColOption: await col.getColOptions<LinkToAnotherRecordColumn>(
          context,
        ),
        relatedMetas,
      });
    } else if (UITypes.Lookup === col.uidt) {
      // 如果列是查找类型，提取查找相关元数据
      await this.extractLookupRelatedMetas(context, {
        lookupColOption: await col.getColOptions<LookupColumn>(context),
        relatedMetas,
      });
    }
  }

  /**
   * 提取LTAR(Link To Another Record)相关元数据
   * @param context - NcContext上下文对象
   * @param ltarColOption - LTAR列选项
   * @param relatedMetas - 相关元数据对象
   * @private
   */
  private async extractLTARRelatedMetas(
    context: NcContext,
    {
      ltarColOption,
      relatedMetas = {},
    }: {
      ltarColOption: LinkToAnotherRecordColumn;
      relatedMetas: { [key: string]: Model };
    },
  ) {
    // 获取相关模型的信息并存储到relatedMetas中
    relatedMetas[ltarColOption.fk_related_model_id] = await Model.getWithInfo(
      context,
      {
        id: ltarColOption.fk_related_model_id,
      },
    );
    // 如果是多对多关系，还需要获取中间表模型信息
    if (ltarColOption.type === 'mm') {
      relatedMetas[ltarColOption.fk_mm_model_id] = await Model.getWithInfo(
        context,
        {
          id: ltarColOption.fk_mm_model_id,
        },
      );
    }
  }

  /**
   * 提取查找相关元数据
   * @param context - NcContext上下文对象
   * @param lookupColOption - 查找列选项
   * @param relatedMetas - 相关元数据对象
   * @private
   */
  private async extractLookupRelatedMetas(
    context: NcContext,
    {
      lookupColOption,
      relatedMetas = {},
    }: {
      lookupColOption: LookupColumn;
      relatedMetas: { [key: string]: Model };
    },
  ) {
    // 获取关系列
    const relationCol = await Column.get(context, {
      colId: lookupColOption.fk_relation_column_id,
    });
    // 获取被查找的列
    const lookedUpCol = await Column.get(context, {
      colId: lookupColOption.fk_lookup_column_id,
    });

    // 提取关系列所属表的元数据（如果尚未提取）
    if (!relatedMetas[relationCol.fk_model_id]) {
      relatedMetas[relationCol.fk_model_id] = await Model.getWithInfo(context, {
        id: relationCol.fk_model_id,
      });
    }

    // 提取被查找列所属表的元数据（如果尚未提取）
    if (!relatedMetas[lookedUpCol.fk_model_id]) {
      relatedMetas[lookedUpCol.fk_model_id] = await Model.getWithInfo(context, {
        id: lookedUpCol.fk_model_id,
      });
    }

    // 递归提取被查找列相关的元数据
    await this.extractRelatedMetas(context, {
      col: lookedUpCol,
      relatedMetas,
    });
  }

  /**
   * 获取公共共享基础信息
   * @param context - NcContext上下文对象
   * @param param - 包含共享基础UUID的参数对象
   * @returns 返回基础ID
   */
  async publicSharedBaseGet(
    context: NcContext,
    param: { sharedBaseUuid: string },
  ): Promise<any> {
    // 通过UUID获取基础
    const base = await Base.getByUuid(context, param.sharedBaseUuid);

    // 如果基础不存在，抛出错误
    if (!base) {
      NcError.baseNotFound(param.sharedBaseUuid);
    }

    // 返回基础ID
    return { base_id: base.id };
  }
}
