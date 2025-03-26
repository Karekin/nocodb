/**
 * View 类 - 实现视图的核心功能
 * 包括视图的创建、更新、删除、查询等操作
 * 支持多种视图类型:网格视图、表单视图、看板视图、图库视图、地图视图、日历视图等
 */

import {
  AppEvents,
  CommonAggregations,
  ExpandedFormMode,
  isSystemColumn,
  parseProp,
  UITypes,
  ViewTypes,
} from 'nocodb-sdk';
import { Logger } from '@nestjs/common';
import type {
  BoolType,
  ColumnReqType,
  ExpandedFormModeType,
  FilterType,
  NcRequest,
  ViewType,
} from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import Model from '~/models/Model';
import FormView from '~/models/FormView';
import GridView from '~/models/GridView';
import KanbanView from '~/models/KanbanView';
import GalleryView from '~/models/GalleryView';
import CalendarView from '~/models/CalendarView';
import GridViewColumn from '~/models/GridViewColumn';
import CalendarViewColumn from '~/models/CalendarViewColumn';
import CalendarRange from '~/models/CalendarRange';
import Sort from '~/models/Sort';
import Filter from '~/models/Filter';
import GalleryViewColumn from '~/models/GalleryViewColumn';
import FormViewColumn from '~/models/FormViewColumn';
import KanbanViewColumn from '~/models/KanbanViewColumn';
import Column from '~/models/Column';
import MapView from '~/models/MapView';
import MapViewColumn from '~/models/MapViewColumn';
import { extractProps } from '~/helpers/extractProps';
import NocoCache from '~/cache/NocoCache';
import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
} from '~/utils/globals';
import Noco from '~/Noco';
import {
  parseMetaProp,
  prepareForDb,
  prepareForResponse,
  stringifyMetaProp,
} from '~/utils/modelUtils';
import { CustomUrl, LinkToAnotherRecordColumn } from '~/models';
import { cleanCommandPaletteCache } from '~/helpers/commandPaletteHelpers';
import { isEE } from '~/utils';

const { v4: uuidv4 } = require('uuid');

const logger = new Logger('View');

/*
 * 视图列的类型定义
 * 可以是以下任意一种视图的列类型：
 * - GridViewColumn: 网格视图列
 * - FormViewColumn: 表单视图列
 * - GalleryViewColumn: 图库视图列
 * - KanbanViewColumn: 看板视图列
 * - CalendarViewColumn: 日历视图列
 * - MapViewColumn: 地图视图列
 */

export default class View implements ViewType {
  // 视图的唯一标识符
  id?: string;
  // 视图的标题
  title: string;
  // 视图的描述信息
  description?: string;
  // 视图的UUID
  uuid?: string;
  // 视图的访问密码
  password?: string;
  // 视图是否显示
  show: boolean;
  // 是否为默认视图
  is_default: boolean;
  // 视图的排序顺序
  order: number;
  // 视图类型（网格、表单、看板等）
  type: ViewTypes;
  // 视图的锁定类型
  lock_type?: ViewType['lock_type'];
  // 创建者的ID
  created_by?: string;
  // 所有者的ID
  owned_by?: string;

  // 关联的数据模型ID
  fk_model_id: string;
  // 关联的数据模型对象
  model?: Model;
  // 视图的具体配置，可以是以下任意一种视图类型
  view?:
    | FormView
    | GridView
    | KanbanView
    | GalleryView
    | MapView
    | CalendarView;
  // 视图的列配置数组
  columns?: Array<
    | FormViewColumn
    | GridViewColumn
    | GalleryViewColumn
    | KanbanViewColumn
    | MapViewColumn
    | CalendarViewColumn
  >;

  // 视图的排序规则数组
  sorts: Sort[];
  // 视图的过滤条件
  filter: Filter;
  // 工作空间ID
  fk_workspace_id?: string;
  // 基础ID
  base_id?: string;
  // 源ID
  source_id?: string;
  // 是否显示系统字段
  show_system_fields?: boolean;
  // 视图的元数据
  meta?: any;
  // 自定义URL的ID
  fk_custom_url_id?: string;

  constructor(data: View) {
    Object.assign(this, data);
  }

  /**
   * 获取视图信息
   * @param context - 上下文信息
   * @param viewId - 视图ID
   * @param ncMeta - 元数据服务实例
   */
  public static async get(
    context: NcContext,
    viewId: string,
    ncMeta = Noco.ncMeta,
  ) {
    // 从缓存获取视图
    let view =
      viewId &&
      (await NocoCache.get(
        `${CacheScope.VIEW}:${viewId}`,
        CacheGetType.TYPE_OBJECT,
      ));
    
    // 如果缓存中没有,从数据库获取
    if (!view) {
      view = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.VIEWS,
        viewId,
      );
      if (view) {
        view.meta = parseMetaProp(view);
        await NocoCache.set(`${CacheScope.VIEW}:${view.id}`, view);
      }
    }

    return view && new View(view);
  }

  /**
   * 根据标题或ID获取视图
   * @param context - 上下文信息
   * @param param - 查询参数
   * @param ncMeta - 元数据服务实例
   */
  public static async getByTitleOrId(
    context: NcContext,
    { fk_model_id, titleOrId }: { titleOrId: string; fk_model_id: string },
    ncMeta = Noco.ncMeta,
  ) {
    // 从缓存获取视图ID
    const viewId =
      titleOrId &&
      (await NocoCache.get(
        `${CacheScope.VIEW_ALIAS}:${fk_model_id}:${titleOrId}`,
        CacheGetType.TYPE_STRING,
      ));

    // 如果缓存中没有,从数据库获取
    if (!viewId) {
      const view = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.VIEWS,
        { fk_model_id },
        null,
        {
          _or: [
            {
              id: {
                eq: titleOrId,
              },
            },
            {
              title: {
                eq: titleOrId,
              },
            },
          ],
        },
      );

      if (view) {
        // 更新缓存
        await NocoCache.set(
          `${CacheScope.VIEW}:${fk_model_id}:${view.id}`,
          view,
        );
        view.meta = parseMetaProp(view);
        await NocoCache.set(
          `${CacheScope.VIEW_ALIAS}:${fk_model_id}:${titleOrId}`,
          view.id,
        );
      }
      return view && new View(view);
    }
    return viewId && this.get(context, viewId?.id || viewId);
  }

  /**
   * 获取默认视图
   * @param context - 上下文信息
   * @param fk_model_id - 模型ID
   * @param ncMeta - 元数据服务实例
   */
  public static async getDefaultView(
    context: NcContext,
    fk_model_id: string,
    ncMeta = Noco.ncMeta,
  ) {
    // 从缓存获取默认视图
    let view =
      fk_model_id &&
      (await NocoCache.get(
        `${CacheScope.VIEW}:${fk_model_id}:default`,
        CacheGetType.TYPE_OBJECT,
      ));

    // 如果缓存中没有,从数据库获取
    if (!view) {
      view = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.VIEWS,
        {
          fk_model_id,
          is_default: 1,
        },
        null,
      );
      if (view) {
        view.meta = parseMetaProp(view);
        await NocoCache.set(`${CacheScope.VIEW}:${fk_model_id}:default`, view);
      }
    }
    return view && new View(view);
  }

  /**
   * 获取视图列表
   * @param context - 上下文信息
   * @param modelId - 模型ID
   * @param ncMeta - 元数据服务实例
   */
  public static async list(
    context: NcContext,
    modelId: string,
    ncMeta = Noco.ncMeta,
  ) {
    // 从缓存获取视图列表
    const cachedList = await NocoCache.getList(CacheScope.VIEW, [modelId]);
    let { list: viewsList } = cachedList;
    const { isNoneList } = cachedList;

    // 如果缓存中没有,从数据库获取
    if (!isNoneList && !viewsList.length) {
      viewsList = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.VIEWS,
        {
          condition: {
            fk_model_id: modelId,
          },
          orderBy: {
            order: 'asc',
          },
        },
      );
      for (const view of viewsList) {
        view.meta = parseMetaProp(view);
      }
      await NocoCache.setList(CacheScope.VIEW, [modelId], viewsList);
    }

    // 按顺序排序
    viewsList.sort(
      (a, b) =>
        (a.order != null ? a.order : Infinity) -
        (b.order != null ? b.order : Infinity),
    );
    return viewsList?.map((v) => new View(v));
  }

  /**
   * 插入新视图
   * @param context - 上下文信息
   * @param param - 视图参数
   * @param ncMeta - 元数据服务实例
   */
  static async insert(
    context: NcContext,
    {
      view,
      req,
    }: {
      view: Partial<View> &
        Partial<
          | FormView
          | GridView
          | GalleryView
          | KanbanView
          | MapView
          | CalendarView
        > & {
          copy_from_id?: string;
          fk_grp_col_id?: string;
          calendar_range?: Partial<CalendarRange>[];
        };
      req: NcRequest;
    },
    ncMeta = Noco.ncMeta,
  ) {
    let copyFromView: View;
    try {
      // 提取需要插入的属性
      const insertObj = extractProps(view, [
        'id',
        'title',
        'is_default',
        'description',
        'type',
        'fk_model_id',
        'base_id',
        'source_id',
        'meta',
      ]);

      // 获取排序顺序
      insertObj.order = await ncMeta.metaGetNextOrder(MetaTable.VIEWS, {
        fk_model_id: view.fk_model_id,
      });

      insertObj.show = true;

      // 处理元数据
      if (!insertObj.meta) {
        insertObj.meta = {};
      }

      insertObj.meta = stringifyMetaProp(insertObj);

      // 获取关联的模型
      const model = await Model.getByIdOrName(
        context,
        { id: view.fk_model_id },
        ncMeta,
      );

      // 获取数据源ID
      if (!view.source_id) {
        insertObj.source_id = model.source_id;
      }

      // 获取复制的源视图
      copyFromView =
        view.copy_from_id &&
        (await View.get(context, view.copy_from_id, ncMeta));
      await copyFromView?.getView(context);

      // 插入视图数据
      const { id: view_id } = await ncMeta.metaInsert2(
        context.workspace_id,
        context.base_id,
        MetaTable.VIEWS,
        insertObj,
      );

      // 获取模型列
      let columns: any[] = await (
        await Model.getByIdOrName(context, { id: view.fk_model_id }, ncMeta)
      ).getColumns(context, ncMeta);

      // 根据视图类型插入视图元数据
      switch (view.type) {
        case ViewTypes.GRID:
          await GridView.insert(
            context,
            {
              ...((copyFromView?.view as GridView) || {}),
              ...(view as GridView),
              fk_view_id: view_id,
            },
            ncMeta,
          );
          break;
        case ViewTypes.MAP:
          await MapView.insert(
            context,
            {
              ...(view as MapView),
              fk_view_id: view_id,
            },
            ncMeta,
          );
          break;
        case ViewTypes.GALLERY:
          await GalleryView.insert(
            context,
            {
              ...(copyFromView?.view || {}),
              ...view,
              fk_view_id: view_id,
            },
            ncMeta,
          );
          break;
        case ViewTypes.FORM:
          await FormView.insert(
            context,
            {
              heading: view.title,
              ...(copyFromView?.view || {}),
              ...view,
              fk_view_id: view_id,
            },
            ncMeta,
          );
          break;
        case ViewTypes.KANBAN:
          // 设置分组字段
          (view as KanbanView).fk_grp_col_id = view.fk_grp_col_id;

          await KanbanView.insert(
            context,
            {
              ...(copyFromView?.view || {}),
              ...view,
              fk_view_id: view_id,
            },
            ncMeta,
          );
          break;
        case ViewTypes.CALENDAR: {
          const obj = extractProps(view, ['calendar_range']);
          if (!obj.calendar_range) break;
          const calendarRange = obj.calendar_range as Partial<CalendarRange>[];
          calendarRange.forEach((range) => {
            range.fk_view_id = view_id;
          });

          await CalendarView.insert(
            context,
            {
              ...(copyFromView?.view || {}),
              ...view,
              fk_view_id: view_id,
            },
            ncMeta,
          );

          await CalendarRange.bulkInsert(context, calendarRange, ncMeta);
        }
      }

      // 处理视图复制
      if (copyFromView) {
        // 生成父级审计ID并添加到请求对象
        const eventId = await ncMeta.genNanoid(MetaTable.AUDIT);
        req.ncParentAuditId = eventId;
        Noco.appHooksService.emit(AppEvents.VIEW_DUPLICATE_START, {
          sourceView: copyFromView,
          destView: view as ViewType,
          req,
          context,
          id: eventId,
        });

        // 复制排序和过滤配置
        const sorts = await copyFromView.getSorts(context, ncMeta);
        const filters = await copyFromView.getFilters(context, ncMeta);
        columns = await copyFromView.getColumns(context, ncMeta);

        // 复制排序配置
        for (const sort of sorts) {
          await Sort.insert(
            context,
            {
              ...extractProps(sort, [
                'fk_column_id',
                'direction',
                'base_id',
                'source_id',
                'order',
              ]),
              fk_view_id: view_id,
              id: null,
            },
            ncMeta,
          );
          Noco.appHooksService.emit(AppEvents.SORT_CREATE, {
            sort,
            view: view as ViewType,
            column: await Column.get(context, {
              colId: sort.fk_column_id,
            }),
            req,
            context,
          });
        }

        // 复制过滤配置
        for (const filter of filters.children) {
          const createdFilter = await Filter.insert(
            context,
            {
              ...extractProps(filter, [
                'id',
                'fk_parent_column_id',
                'fk_column_id',
                'comparison_op',
                'comparison_sub_op',
                'value',
                'fk_parent_id',
                'is_group',
                'logical_op',
                'base_id',
                'source_id',
                'order',
              ]),
              fk_view_id: view_id,
              id: null,
            },
            ncMeta,
          );

          Noco.appHooksService.emit(AppEvents.FILTER_CREATE, {
            filter: createdFilter as FilterType,
            column: await Column.get(context, {
              colId: filter.fk_column_id,
            }),
            view: view as ViewType,
            req,
            context,
          });
        }
      }

      // 处理视图列
      {
        let order = 1;
        let galleryShowLimit = 0;
        let kanbanShowLimit = 0;
        let calendarRanges: Array<string> | null = null;

        // 获取日历范围列
        if (view.type === ViewTypes.CALENDAR) {
          calendarRanges = await View.getRangeColumnsAsArray(
            context,
            view_id,
            ncMeta,
          );
        }

        // 处理看板视图列排序
        if (view.type === ViewTypes.KANBAN && !copyFromView) {
          columns.sort((a, b) => {
            const displayValueOrder = b.pv - a.pv;
            const attachmentOrder =
              +(b.uidt === UITypes.Attachment) -
              +(a.uidt === UITypes.Attachment);
            const singleLineTextOrder =
              +(b.uidt === UITypes.SingleLineText) -
              +(a.uidt === UITypes.SingleLineText);
            const numberOrder =
              +(b.uidt === UITypes.Number) - +(a.uidt === UITypes.Number);
            const defaultOrder = b.order - a.order;
            return (
              displayValueOrder ||
              attachmentOrder ||
              singleLineTextOrder ||
              numberOrder ||
              defaultOrder
            );
          });
        }

        // 处理视图列
        for (const vCol of columns) {
          let show = 'show' in vCol ? vCol.show : true;
          const underline = false;
          const bold = false;
          const italic = false;

          // 根据视图类型处理列的显示
          if (view.type === ViewTypes.GALLERY) {
            const galleryView = await GalleryView.get(context, view_id, ncMeta);
            if (
              vCol.id === galleryView.fk_cover_image_col_id ||
              vCol.pv ||
              galleryShowLimit < 3
            ) {
              show = true;
              galleryShowLimit++;
            } else {
              show = false;
            }
          } else if (view.type === ViewTypes.KANBAN && !copyFromView) {
            const kanbanView = await KanbanView.get(context, view_id, ncMeta);
            if (vCol.id === kanbanView?.fk_grp_col_id) {
              show = true;
            } else if (
              vCol.id === kanbanView.fk_cover_image_col_id ||
              vCol.pv
            ) {
              show = true;
              kanbanShowLimit++;
            } else if (kanbanShowLimit < 3 && !isSystemColumn(vCol)) {
              show = true;
              kanbanShowLimit++;
            } else {
              show = false;
            }
          } else if (view.type === ViewTypes.CALENDAR && !copyFromView) {
            const calendarView = await CalendarView.get(
              context,
              view_id,
              ncMeta,
            );
            if (calendarRanges && calendarRanges.includes(vCol.id)) {
              show = true;
            } else
              show = vCol.id === calendarView?.fk_cover_image_col_id || vCol.pv;
          } else if (view.type === ViewTypes.MAP && !copyFromView) {
            const mapView = await MapView.get(context, view_id, ncMeta);
            if (vCol.id === mapView?.fk_geo_data_col_id) {
              show = true;
            }
          }

          // 获取父列
          const col = vCol.fk_column_id
            ? await Column.get(context, { colId: vCol.fk_column_id }, ncMeta)
            : vCol;

          if (isSystemColumn(col)) show = false;

          // 插入视图列
          await View.insertColumn(
            context,
            {
              order: order++,
              ...col,
              ...vCol,
              view_id,
              fk_column_id: vCol.fk_column_id || vCol.id,
              show,
              underline,
              bold,
              italic,
              id: null,
            },
            ncMeta,
          );
        }
      }

      // 更新非默认视图计数
      await Model.getNonDefaultViewsCountAndReset(
        context,
        { modelId: view.fk_model_id },
        ncMeta,
      );

      // 清理命令面板缓存
      cleanCommandPaletteCache(context.workspace_id).catch(() => {
        logger.error('Failed to clean command palette cache');
      });

      // 触发视图复制完成事件
      if (copyFromView) {
        Noco.appHooksService.emit(AppEvents.VIEW_DUPLICATE_COMPLETE, {
          sourceView: copyFromView,
          destView: view as ViewType,
          req,
          context,
        });
      }

      // 返回创建的视图
      return View.get(context, view_id, ncMeta).then(async (v) => {
        await NocoCache.appendToList(
          CacheScope.VIEW,
          [view.fk_model_id],
          `${CacheScope.VIEW}:${view_id}`,
        );
        return v;
      });
    } catch (e) {
      // 触发视图复制失败事件
      if (copyFromView) {
        Noco.appHooksService.emit(AppEvents.VIEW_DUPLICATE_FAIL, {
          sourceView: copyFromView,
          destView: view as ViewType,
          error: e,
          req,
          context,
        });
      }
      throw e;
    }
  }

  /**
   * 获取日历视图的范围列ID数组
   * @param context - 上下文对象
   * @param viewId - 视图ID
   * @param ncMeta - 元数据对象
   * @returns 返回日历范围列的ID数组
   */
  static async getRangeColumnsAsArray(
    context: NcContext,
    viewId: string,
    ncMeta,
  ) {
    // 读取日历范围配置
    const calRange = await CalendarRange.read(context, viewId, ncMeta);
    if (calRange) {
      // 使用Set去重存储列ID
      const calIds: Set<string> = new Set();
      // 遍历所有范围配置，收集列ID
      calRange.ranges.forEach((range) => {
        calIds.add(range.fk_from_column_id);
      });
      // 将Set转换为数组返回
      return Array.from(calIds) as Array<string>;
    }
    return [];
  }

  /**
   * 向所有视图插入新列
   * @param context - 上下文对象
   * @param param - 列参数对象，包含列ID、模型ID、显示顺序等信息
   * @param ncMeta - 元数据对象
   */
  static async insertColumnToAllViews(
    context: NcContext,
    param: {
      fk_column_id: any;          // 列ID
      fk_model_id: any;           // 模型ID
      order?: number;             // 显示顺序
      column_show: {              // 列显示配置
        show: boolean;            // 是否显示
        view_id?: any;            // 视图ID
      };
    } & Pick<ColumnReqType, 'column_order'>,
    ncMeta = Noco.ncMeta,
  ) {
    // 构建插入对象
    const insertObj = {
      fk_column_id: param.fk_column_id,
      fk_model_id: param.fk_model_id,
      order: param.order,
      show: param.column_show.show,
    };
    // 获取模型下的所有视图
    const views = await this.list(context, param.fk_model_id, ncMeta);

    // 获取模型的所有列
    const tableColumns = await Column.list(
      context,
      { fk_model_id: param.fk_model_id },
      ncMeta,
    );
    // 创建列ID到列对象的映射，方便快速访问
    const colIdMap = new Map(tableColumns.map((c) => [c.id, c]));

    // 遍历所有视图，为每个视图添加新列
    for (const view of views) {
      // 构建视图特定的插入对象
      const modifiedInsertObj = {
        ...insertObj,
        fk_view_id: view.id,
        source_id: view.source_id,
      };

      // 根据不同的视图类型和条件设置列的显示状态
      if (colIdMap.get(param.fk_column_id)?.uidt === UITypes.Order) {
        // 如果是排序列，默认不显示
        modifiedInsertObj.show = false;
      } else if (param.column_show?.view_id === view.id) {
        // 如果指定了特定视图的显示状态，使用指定状态
        modifiedInsertObj.show = true;
      } else if (view.uuid) {
        // 如果是共享视图，保持原有显示状态
      }
      // 对于图库视图，最多显示3个非系统列
      else if (view.type === ViewTypes.GALLERY) {
        const visibleColumnsCount = (
          await GalleryViewColumn.list(context, view.id, ncMeta)
        )?.filter(
          (c) => c.show && !isSystemColumn(colIdMap.get(c.fk_column_id)),
        ).length;
        modifiedInsertObj.show = visibleColumnsCount < 3;
      } 
      // 对于看板视图，最多显示3个非系统列
      else if (view.type === ViewTypes.KANBAN) {
        const visibleColumnsCount = (
          await KanbanViewColumn.list(context, view.id, ncMeta)
        )?.filter(
          (c) => c.show && !isSystemColumn(colIdMap.get(c.fk_column_id)),
        ).length;
        modifiedInsertObj.show = visibleColumnsCount < 3;
      } 
      // 对于非表单视图，默认显示
      else if (view.type !== ViewTypes.FORM) {
        modifiedInsertObj.show = true;
      }

      // 如果指定了特定视图的列顺序，使用指定顺序
      if (param.column_order?.view_id === view.id) {
        modifiedInsertObj.order = param.column_order?.order;
      }

      // 根据视图类型，调用相应的列插入方法
      switch (view.type) {
        case ViewTypes.GRID:
          await GridViewColumn.insert(context, modifiedInsertObj, ncMeta);
          break;
        case ViewTypes.GALLERY:
          await GalleryViewColumn.insert(context, modifiedInsertObj, ncMeta);
          break;
        case ViewTypes.MAP:
          await MapViewColumn.insert(
            context,
            {
              ...insertObj,
              fk_view_id: view.id,
            },
            ncMeta,
          );
          break;
        case ViewTypes.KANBAN:
          await KanbanViewColumn.insert(context, modifiedInsertObj, ncMeta);
          break;
        case ViewTypes.CALENDAR:
          await CalendarViewColumn.insert(
            context,
            {
              ...insertObj,
              fk_view_id: view.id,
            },
            ncMeta,
          );
          break;
        case ViewTypes.FORM:
          await FormViewColumn.insert(context, modifiedInsertObj, ncMeta);
          break;
      }
    }
  }

  /**
   * 向视图中插入新列
   * @param context - 上下文信息
   * @param param - 列参数对象，包含以下属性：
   *   - view_id: 视图ID
   *   - order: 列的顺序
   *   - show: 是否显示列
   *   - underline: 是否下划线
   *   - bold: 是否加粗
   *   - italic: 是否斜体
   *   - fk_column_id: 关联的列ID
   *   - id: 列ID（可选）
   * @param ncMeta - 元数据服务实例
   * @returns 返回插入的列对象
   */
  static async insertColumn(
    context: NcContext,
    param: {
      view_id: any;
      order;
      show;
      underline?;
      bold?;
      italic?;
      fk_column_id;
      id?: string;
    } & Partial<FormViewColumn> &
      Partial<CalendarViewColumn>,
    ncMeta = Noco.ncMeta,
  ) {
    // 获取视图对象
    const view = await this.get(context, param.view_id, ncMeta);

    let col;
    // 根据视图类型调用相应的列插入方法
    switch (view.type) {
      case ViewTypes.GRID:
        {
          // 网格视图列插入
          col = await GridViewColumn.insert(
            context,
            {
              ...param,
              fk_view_id: view.id,
            },
            ncMeta,
          );
        }
        break;
      case ViewTypes.GALLERY:
        {
          // 图库视图列插入
          col = await GalleryViewColumn.insert(
            context,
            {
              ...param,
              fk_view_id: view.id,
            },
            ncMeta,
          );
        }
        break;
      case ViewTypes.MAP:
        {
          // 地图视图列插入
          col = await MapViewColumn.insert(
            context,
            {
              ...param,
              fk_view_id: view.id,
            },
            ncMeta,
          );
        }
        break;
      case ViewTypes.FORM:
        {
          // 表单视图列插入
          col = await FormViewColumn.insert(
            context,
            {
              ...param,
              fk_view_id: view.id,
            },
            ncMeta,
          );
        }
        break;
      case ViewTypes.KANBAN:
        {
          // 看板视图列插入
          col = await KanbanViewColumn.insert(
            context,
            {
              ...param,
              fk_view_id: view.id,
            },
            ncMeta,
          );
        }
        break;
      case ViewTypes.CALENDAR:
        {
          // 日历视图列插入
          col = await CalendarViewColumn.insert(
            context,
            {
              ...param,
              fk_view_id: view.id,
            },
            ncMeta,
          );
        }
        break;
    }

    return col;
  }

  /**
   * 获取带详细信息的视图列表
   * @param context - 上下文信息
   * @param id - 视图ID
   * @param ncMeta - 元数据服务实例
   * @returns 返回包含详细信息的视图列表
   */
  static async listWithInfo(
    context: NcContext,
    id: string,
    ncMeta = Noco.ncMeta,
  ) {
    // 获取视图列表
    const list = await this.list(context, id, ncMeta);
    // 遍历列表，为每个视图获取详细信息
    for (const item of list) {
      await item.getViewWithInfo(context, ncMeta);
    }
    return list;
  }

  /**
   * 获取视图列
   * @param context - 上下文信息
   * @param viewId - 视图ID
   * @param ncMeta - 元数据服务实例
   */
  static async getColumns(
    context: NcContext,
    viewId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<
    Array<
      | GridViewColumn
      | FormViewColumn
      | GalleryViewColumn
      | KanbanViewColumn
      | MapViewColumn
      | CalendarViewColumn
    >
  > {
    let columns: Array<GridViewColumn | any> = [];
    const view = await this.get(context, viewId, ncMeta);

    // 根据视图类型获取列
    switch (view.type) {
      case ViewTypes.GRID:
        columns = await GridViewColumn.list(context, viewId, ncMeta);
        break;
      case ViewTypes.GALLERY:
        columns = await GalleryViewColumn.list(context, viewId, ncMeta);
        break;
      case ViewTypes.MAP:
        columns = await MapViewColumn.list(context, viewId, ncMeta);
        break;
      case ViewTypes.FORM:
        columns = await FormViewColumn.list(context, viewId, ncMeta);
        break;
      case ViewTypes.KANBAN:
        columns = await KanbanViewColumn.list(context, viewId, ncMeta);
        break;
      case ViewTypes.CALENDAR:
        columns = await CalendarViewColumn.list(context, viewId, ncMeta);
        break;
    }

    return columns;
  }

  /**
   * 获取视图列ID
   * @param context - 上下文信息
   * @param param - 查询参数
   * @param ncMeta - 元数据服务实例
   */
  static async getViewColumnId(
    context: NcContext,
    {
      viewId,
      colId,
    }: {
      viewId: string;
      colId: string;
    },
    ncMeta = Noco.ncMeta,
  ) {
    const view = await this.get(context, viewId);
    if (!view) return undefined;

    // 根据视图类型获取表名和缓存范围
    let tableName;
    let cacheScope;
    switch (view.type) {
      case ViewTypes.GRID:
        tableName = MetaTable.GRID_VIEW_COLUMNS;
        cacheScope = CacheScope.GRID_VIEW_COLUMN;
        break;
      case ViewTypes.GALLERY:
        tableName = MetaTable.GALLERY_VIEW_COLUMNS;
        cacheScope = CacheScope.GALLERY_VIEW_COLUMN;
        break;
      case ViewTypes.MAP:
        tableName = MetaTable.MAP_VIEW_COLUMNS;
        cacheScope = CacheScope.MAP_VIEW_COLUMN;
        break;
      case ViewTypes.FORM:
        tableName = MetaTable.FORM_VIEW_COLUMNS;
        cacheScope = CacheScope.FORM_VIEW_COLUMN;
        break;
      case ViewTypes.KANBAN:
        tableName = MetaTable.KANBAN_VIEW_COLUMNS;
        cacheScope = CacheScope.KANBAN_VIEW_COLUMN;
        break;
      case ViewTypes.CALENDAR:
        tableName = MetaTable.CALENDAR_VIEW_COLUMNS;
        cacheScope = CacheScope.CALENDAR_VIEW_COLUMN;
        break;
    }

    // 从缓存获取列ID
    const key = `${cacheScope}:viewColumnId:${colId}`;
    const o = await NocoCache.get(key, CacheGetType.TYPE_STRING);
    if (o) return o;

    // 从数据库获取列
    const viewColumn = await ncMeta.metaGet2(
      context.workspace_id,
      context.base_id,
      tableName,
      {
        fk_view_id: viewId,
        fk_column_id: colId,
      },
    );
    if (!viewColumn) return undefined;

    // 更新缓存
    await NocoCache.set(key, viewColumn.id);

    return viewColumn.id;
  }

  /**
   * 更新视图列
   * @param context - 上下文信息
   * @param viewId - 视图ID
   * @param colId - 列ID
   * @param colData - 列数据
   * @param ncMeta - 元数据服务实例
   */
  static async updateColumn(
    context: NcContext,
    viewId: string,
    colId: string,
    colData: {
      order?: number;
      show?: BoolType;
      underline?: BoolType;
      bold?: BoolType;
      italic?: BoolType;
    },
    ncMeta = Noco.ncMeta,
  ) {
    const view = await this.get(context, viewId, ncMeta);
    let table;
    let cacheScope;

    // 根据视图类型获取表名和缓存范围
    switch (view.type) {
      case ViewTypes.GRID:
        table = MetaTable.GRID_VIEW_COLUMNS;
        cacheScope = CacheScope.GRID_VIEW_COLUMN;
        break;
      case ViewTypes.MAP:
        table = MetaTable.MAP_VIEW_COLUMNS;
        cacheScope = CacheScope.MAP_VIEW_COLUMN;
        break;
      case ViewTypes.GALLERY:
        table = MetaTable.GALLERY_VIEW_COLUMNS;
        cacheScope = CacheScope.GALLERY_VIEW_COLUMN;
        break;
      case ViewTypes.KANBAN:
        table = MetaTable.KANBAN_VIEW_COLUMNS;
        cacheScope = CacheScope.KANBAN_VIEW_COLUMN;
        break;
      case ViewTypes.FORM:
        table = MetaTable.FORM_VIEW_COLUMNS;
        cacheScope = CacheScope.FORM_VIEW_COLUMN;
        break;
      case ViewTypes.CALENDAR:
        table = MetaTable.CALENDAR_VIEW_COLUMNS;
        cacheScope = CacheScope.CALENDAR_VIEW_COLUMN;
    }

    // 提取需要更新的属性
    let updateObj = extractProps(colData, ['order', 'show']);

    // 处理网格视图的主值列
    if (view.type === ViewTypes.GRID) {
      const primary_value_column_meta = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.COLUMNS,
        {
          fk_model_id: view.fk_model_id,
          pv: true,
        },
      );

      const primary_value_column = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.GRID_VIEW_COLUMNS,
        {
          fk_view_id: view.id,
          fk_column_id: primary_value_column_meta.id,
        },
      );

      if (primary_value_column && primary_value_column.id === colId) {
        updateObj.order = 1;
        updateObj.show = true;
      }
    }

    // 处理日历视图的样式属性
    if (view.type === ViewTypes.CALENDAR) {
      updateObj = {
        ...updateObj,
        ...extractProps(colData, ['underline', 'bold', 'italic']),
      };
    }

    // 更新列数据
    const res = await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      table,
      updateObj,
      colId,
    );

    // 更新缓存
    await NocoCache.update(`${cacheScope}:${colId}`, updateObj);

    // 清理单查询缓存
    await View.clearSingleQueryCache(context, view.fk_model_id, [view], ncMeta);

    return res;
  }

  /**
   * 获取视图列
   * @param context - 上下文信息
   * @param viewId - 视图ID
   * @param colId - 列ID
   * @param ncMeta - 元数据服务实例
   */
  static async getColumn(
    context: NcContext,
    viewId: string,
    colId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const view = await this.get(context, viewId, ncMeta);
    switch (view.type) {
      case ViewTypes.GRID:
        return GridViewColumn.get(context, colId, ncMeta);
      case ViewTypes.MAP:
        return MapViewColumn.get(context, colId, ncMeta);
      case ViewTypes.GALLERY:
        return GalleryViewColumn.get(context, colId, ncMeta);
      case ViewTypes.KANBAN:
        return KanbanViewColumn.get(context, colId, ncMeta);
      case ViewTypes.FORM:
        return FormViewColumn.get(context, colId, ncMeta);
      case ViewTypes.CALENDAR:
        return CalendarViewColumn.get(context, colId, ncMeta);
    }
    return null;
  }

  /**
   * 插入或更新视图列
   * @param context - 上下文信息
   * @param viewId - 视图ID
   * @param fkColId - 列ID
   * @param colData - 列数据
   * @param ncMeta - 元数据服务实例
   */
  static async insertOrUpdateColumn(
    context: NcContext,
    viewId: string,
    fkColId: string,
    colData: {
      order?: number;
      show?: BoolType;
    },
    ncMeta = Noco.ncMeta,
  ): Promise<
    | GridViewColumn
    | FormViewColumn
    | GalleryViewColumn
    | KanbanViewColumn
    | MapViewColumn
    | any
  > {
    const view = await this.get(context, viewId, ncMeta);
    const table = this.extractViewColumnsTableName(view);

    // 检查列是否已存在
    const existingCol = await ncMeta.metaGet2(
      context.workspace_id,
      context.base_id,
      table,
      {
        fk_view_id: viewId,
        fk_column_id: fkColId,
      },
    );

    if (existingCol) {
      // 更新现有列
      await ncMeta.metaUpdate(
        context.workspace_id,
        context.base_id,
        table,
        {
          order: colData.order,
          show: colData.show,
        },
        existingCol.id,
      );

      // 清理单查询缓存
      await View.clearSingleQueryCache(
        context,
        view.fk_model_id,
        [view],
        ncMeta,
      );

      return { ...existingCol, ...colData };
    } else {
      // 根据视图类型插入新列
      switch (view.type) {
        case ViewTypes.GRID:
          return await GridViewColumn.insert(
            context,
            {
              fk_view_id: viewId,
              fk_column_id: fkColId,
              order: colData.order,
              show: colData.show,
            },
            ncMeta,
          );
        case ViewTypes.GALLERY:
          return await GalleryViewColumn.insert(
            context,
            {
              fk_view_id: viewId,
              fk_column_id: fkColId,
              order: colData.order,
              show: colData.show,
            },
            ncMeta,
          );
        case ViewTypes.KANBAN:
          return await KanbanViewColumn.insert(
            context,
            {
              fk_view_id: viewId,
              fk_column_id: fkColId,
              order: colData.order,
              show: colData.show,
            },
            ncMeta,
          );
        case ViewTypes.MAP:
          return await MapViewColumn.insert(
            context,
            {
              fk_view_id: viewId,
              fk_column_id: fkColId,
              order: colData.order,
              show: colData.show,
            },
            ncMeta,
          );
        case ViewTypes.FORM:
          return await FormViewColumn.insert(
            context,
            {
              fk_view_id: viewId,
              fk_column_id: fkColId,
              order: colData.order,
              show: colData.show,
            },
            ncMeta,
          );
        case ViewTypes.CALENDAR:
          return await CalendarViewColumn.insert(
            context,
            {
              fk_view_id: viewId,
              fk_column_id: fkColId,
              order: colData.order,
              show: colData.show,
            },
            ncMeta,
          );
      }
      return await ncMeta.metaInsert2(
        context.workspace_id,
        context.base_id,
        table,
        {
          source_id: view.source_id,
          fk_view_id: viewId,
          fk_column_id: fkColId,
          order: colData.order,
          show: colData.show,
        },
      );
    }
  }

  // todo: cache
  /**
   * 根据UUID获取视图
   * @param context - 上下文信息
   * @param uuid - 视图的UUID
   * @param ncMeta - 元数据服务实例
   * @returns 返回视图对象
   */
  static async getByUUID(
    context: NcContext,
    uuid: string,
    ncMeta = Noco.ncMeta,
  ) {
    // 从元数据中获取视图
    const view = await ncMeta.metaGet2(
      context.workspace_id,
      context.base_id,
      MetaTable.VIEWS,
      {
        uuid,
      },
    );

    // 如果视图存在，解析其元数据
    if (view) {
      view.meta = parseMetaProp(view);
    }

    // 返回视图对象
    return view && new View(view);
  }

  /**
   * 分享视图
   * @param context - 上下文信息
   * @param viewId - 视图ID
   * @param ncMeta - 元数据服务实例
   * @returns 返回更新后的视图对象
   */
  static async share(context: NcContext, viewId, ncMeta = Noco.ncMeta) {
    // 获取视图对象
    const view = await this.get(context, viewId);
    // 如果视图没有UUID，生成一个新的UUID
    if (!view.uuid) {
      const uuid = uuidv4();
      view.uuid = uuid;

      // 更新视图的元数据
      await ncMeta.metaUpdate(
        context.workspace_id,
        context.base_id,
        MetaTable.VIEWS,
        {
          uuid: view.uuid,
        },
        viewId,
      );

      // 更新缓存
      await NocoCache.update(`${CacheScope.VIEW}:${view.id}`, {
        uuid: view.uuid,
      });
    }
    // 如果视图的元数据中没有允许CSV下载的属性，设置默认值
    if (!view.meta || !('allowCSVDownload' in view.meta)) {
      const defaultMeta = {
        ...(view.meta ?? {}),
        allowCSVDownload: true,
      };
      view.meta = defaultMeta;

      // 更新视图的元数据
      await ncMeta.metaUpdate(
        context.workspace_id,
        context.base_id,
        MetaTable.VIEWS,
        prepareForDb({
          meta: defaultMeta,
        }),
        viewId,
      );

      // 更新缓存
      await NocoCache.update(
        `${CacheScope.VIEW}:${view.id}`,
        prepareForResponse({
          meta: defaultMeta,
        }),
      );
    }
    // 返回更新后的视图对象
    return view;
  }

  /**
   * 更新视图的密码
   * @param context - 上下文信息
   * @param viewId - 视图ID
   * @param password - 新密码
   * @param ncMeta - 元数据服务实例
   */
  static async passwordUpdate(
    context: NcContext,
    viewId: string,
    { password }: { password: string },
    ncMeta = Noco.ncMeta,
  ) {
    // 更新视图的元数据
    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.VIEWS,
      {
        password,
      },
      viewId,
    );

    // 更新缓存
    await NocoCache.update(`${CacheScope.VIEW}:${viewId}`, {
      password,
    });
  }

  /**
   * 删除共享视图
   * @param context - 上下文信息
   * @param viewId - 视图ID
   * @param ncMeta - 元数据服务实例
   */
  static async sharedViewDelete(
    context: NcContext,
    viewId,
    ncMeta = Noco.ncMeta,
  ) {
    // 更新视图的元数据，清除UUID
    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.VIEWS,
      {
        uuid: null,
        ...(isEE ? { fk_custom_url_id: null } : {}),
      },
      viewId,
    );

    // 删除自定义URL
    await CustomUrl.delete({ view_id: viewId });

    // 更新缓存，清除UUID
    await NocoCache.update(`${CacheScope.VIEW}:${viewId}`, {
      uuid: null,
      ...(isEE ? { fk_custom_url_id: null } : {}),
    });
  }

  /**
   * 更新视图
   * @param context - 上下文信息
   * @param viewId - 视图ID
   * @param body - 更新数据
   * @param includeCreatedByAndUpdateBy - 是否包含创建者和更新者
   * @param ncMeta - 元数据服务实例
   */
  static async update(
    context: NcContext,
    viewId: string,
    body: {
      title?: string;
      order?: number;
      show_system_fields?: BoolType;
      lock_type?: string;
      password?: string;
      uuid?: string;
      meta?: any;
      owned_by?: string;
      created_by?: string;
      expanded_record_mode?: ExpandedFormModeType;
      attachment_mode_column_id?: string;
      fk_custom_url_id?: string;
    },
    includeCreatedByAndUpdateBy = false,
    ncMeta = Noco.ncMeta,
  ) {
    // 提取需要更新的属性
    const updateObj = extractProps(body, [
      'title',
      'order',
      'description',
      'show_system_fields',
      'lock_type',
      'password',
      'meta',
      'uuid',
      ...(isEE ? ['fk_custom_url_id'] : []),
      ...(includeCreatedByAndUpdateBy ? ['owned_by', 'created_by'] : []),
      ...(isEE ? ['expanded_record_mode', 'attachment_mode_column_id'] : []),
    ]);

    // 处理展开记录模式
    if (isEE) {
      if (!updateObj?.attachment_mode_column_id) {
        updateObj.expanded_record_mode = ExpandedFormMode.FIELD;
      } else {
        updateObj.expanded_record_mode = ExpandedFormMode.ATTACHMENT;
      }
    }

    // 获取原有视图
    const oldView = await this.get(context, viewId, ncMeta);

    // 更新视图数据
    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.VIEWS,
      prepareForDb(updateObj),
      viewId,
    );

    // 重置别名缓存
    await NocoCache.del(
      `${CacheScope.VIEW}:${oldView.fk_model_id}:${oldView.title}`,
    );

    // 更新缓存
    await NocoCache.update(
      `${CacheScope.VIEW}:${viewId}`,
      prepareForResponse(updateObj),
    );

    // 更新默认视图缓存
    if (oldView.is_default) {
      await NocoCache.update(
        `${CacheScope.VIEW}:${oldView.fk_model_id}:default`,
        prepareForResponse(updateObj),
      );
    }

    // 获取更新后的视图
    const view = await this.get(context, viewId, ncMeta);

    // 处理网格视图的系统字段显示
    if (view.type === ViewTypes.GRID) {
      if ('show_system_fields' in updateObj) {
        await View.fixPVColumnForView(context, viewId, ncMeta);
      }
    }

    // 清理单查询缓存
    await View.clearSingleQueryCache(context, view.fk_model_id, [view], ncMeta);

    // 清理命令面板缓存
    cleanCommandPaletteCache(context.workspace_id).catch(() => {
      logger.error('Failed to clean command palette cache');
    });

    return view;
  }

  /**
   * 删除视图
   * @param context - 上下文信息
   * @param viewId - 视图ID
   * @param ncMeta - 元数据服务实例
   */
  static async delete(context: NcContext, viewId, ncMeta = Noco.ncMeta) {
    // 获取视图信息
    const view = await this.get(context, viewId, ncMeta);

    // 删除排序配置
    await Sort.deleteAll(context, viewId, ncMeta);

    // 删除过滤配置
    await Filter.deleteAll(context, viewId, ncMeta);

    // 获取视图相关表名
    const table = this.extractViewTableName(view);
    const tableScope = this.extractViewTableNameScope(view);
    const columnTable = this.extractViewColumnsTableName(view);
    const columnTableScope = this.extractViewColumnsTableNameScope(view);

    // 删除视图列
    await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      columnTable,
      {
        fk_view_id: viewId,
      },
    );

    // 删除视图元数据
    await ncMeta.metaDelete(context.workspace_id, context.base_id, table, {
      fk_view_id: viewId,
    });

    // 删除视图
    await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.VIEWS,
      viewId,
    );

    // 清理缓存
    await NocoCache.deepDel(
      `${tableScope}:${viewId}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );

    // 处理日历视图范围
    if (view.type === ViewTypes.CALENDAR) {
      await ncMeta.metaDelete(
        context.workspace_id,
        context.base_id,
        MetaTable.CALENDAR_VIEW_RANGE,
        {
          fk_view_id: viewId,
        },
      );
      await NocoCache.deepDel(
        `${CacheScope.CALENDAR_VIEW_RANGE}:${viewId}`,
        CacheDelDirection.CHILD_TO_PARENT,
      );
    }

    // 清理列缓存
    await NocoCache.deepDel(
      `${columnTableScope}:${viewId}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );

    // 清理视图缓存
    await NocoCache.deepDel(
      `${CacheScope.VIEW}:${viewId}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );

    // 清理视图别名缓存
    await NocoCache.del([
      `${CacheScope.VIEW_ALIAS}:${view.fk_model_id}:${view.title}`,
      `${CacheScope.VIEW_ALIAS}:${view.fk_model_id}:${view.id}`,
    ]);

    // 处理关联链接
    if (view?.id) {
      const links = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.COL_RELATIONS,
        {
          condition: {
            fk_target_view_id: view.id,
          },
        },
      );

      for (const link of links) {
        await LinkToAnotherRecordColumn.update(context, link.fk_column_id, {
          fk_target_view_id: null,
        });
      }
    }

    // 清理单查询缓存
    await View.clearSingleQueryCache(context, view.fk_model_id, [view], ncMeta);

    // 处理自定义URL
    if (isEE && view.fk_custom_url_id) {
      CustomUrl.delete({ id: view.fk_custom_url_id as string }).catch(() => {
        logger.error(`Failed to delete custom urls of viewId: ${view.id}`);
      });
    }

    // 清理命令面板缓存
    cleanCommandPaletteCache(context.workspace_id).catch(() => {
      logger.error('Failed to clean command palette cache');
    });

    // 更新非默认视图计数
    await Model.getNonDefaultViewsCountAndReset(
      context,
      { modelId: view.fk_model_id },
      ncMeta,
    );
  }

  /**
   * 显示所有列
   * @param context - 上下文信息
   * @param viewId - 视图ID
   * @param ignoreColdIds - 忽略的列ID数组
   * @param ncMeta - 元数据服务实例
   */
  static async showAllColumns(
    context: NcContext,
    viewId,
    ignoreColdIds = [],
    ncMeta = Noco.ncMeta,
  ) {
    // 获取视图对象
    const view = await this.get(context, viewId);
    // 提取视图列的表名和缓存范围
    const table = this.extractViewColumnsTableName(view);
    const scope = this.extractViewColumnsTableNameScope(view);

    // 获取模型的所有列
    const columns = await view
      .getModel(context, ncMeta)
      .then((meta) => meta.getColumns(context, ncMeta));
    // 获取视图的列
    const viewColumns = await this.getColumns(context, viewId, ncMeta);
    // 提取视图中可用的列ID
    const availableColumnsInView = viewColumns.map(
      (column) => column.fk_column_id,
    );

    // 获取现有缓存
    const cachedList = await NocoCache.getList(scope, [viewId]);
    const { list: dataList } = cachedList;
    const { isNoneList } = cachedList;
    // 如果缓存中有数据，更新列的显示状态
    if (!isNoneList && dataList?.length) {
      for (const o of dataList) {
        if (!ignoreColdIds?.length || !ignoreColdIds.includes(o.fk_column_id)) {
          // 设置列为可见
          o.show = true;
          // 更新缓存
          await NocoCache.set(`${scope}:${o.id}`, o);
        }
      }
    }

    // 插入或更新视图列
    for (const col of columns) {
      if (ignoreColdIds?.includes(col.id)) continue;

      const colIndex = availableColumnsInView.indexOf(col.id);
      if (colIndex > -1) {
        // 如果列已存在，更新其显示状态
        await this.updateColumn(
          context,
          viewId,
          viewColumns[colIndex].id,
          { show: true },
          ncMeta,
        );
      } else {
        // 如果列不存在，插入新列
        await this.insertColumn(
          context,
          {
            view_id: viewId,
            order: await ncMeta.metaGetNextOrder(table, {
              fk_view_id: viewId,
            }),
            show: true,
            fk_column_id: col.id,
          },
          ncMeta,
        );
      }
    }
  }

  /**
   * 隐藏所有列
   * @param context - 上下文信息
   * @param viewId - 视图ID
   * @param ignoreColdIds - 忽略的列ID数组
   * @param ncMeta - 元数据服务实例
   */
  static async hideAllColumns(
    context: NcContext,
    viewId,
    ignoreColdIds = [],
    ncMeta = Noco.ncMeta,
  ) {
    // 获取视图对象
    const view = await this.get(context, viewId, ncMeta);
    // 提取视图列的表名和缓存范围
    const table = this.extractViewColumnsTableName(view);
    const scope = this.extractViewColumnsTableNameScope(view);

    // 如果视图类型为网格，获取主值列
    if (view.type === ViewTypes.GRID) {
      const primary_value_column = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.COLUMNS,
        {
          fk_model_id: view.fk_model_id,
          pv: true,
        },
      );

      // 保持主值列始终可见
      if (primary_value_column) {
        ignoreColdIds.push(primary_value_column.id);
      }
    }

    // 获取现有缓存
    const cachedList = await NocoCache.getList(scope, [viewId]);
    const { list: dataList } = cachedList;
    const { isNoneList } = cachedList;

    // 获取视图中必需的列
    const colsEssentialForView =
      view.type === ViewTypes.MAP
        ? [(await MapView.get(context, viewId, ncMeta)).fk_geo_data_col_id]
        : [];

    const mergedIgnoreColdIds = [...ignoreColdIds, ...colsEssentialForView];

    // 如果缓存中有数据，更新列的显示状态
    if (!isNoneList && dataList?.length) {
      for (const o of dataList) {
        if (
          !mergedIgnoreColdIds?.length ||
          !mergedIgnoreColdIds.includes(o.fk_column_id)
        ) {
          // 设置列为不可见
          o.show = false;
          // 更新缓存
          await NocoCache.set(`${scope}:${o.id}`, o);
        }
      }
    }
    // 更新元数据
    return await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      table,
      { show: false },
      {
        fk_view_id: viewId,
      },
      mergedIgnoreColdIds?.length
        ? {
            _not: {
              fk_column_id: {
                in: ignoreColdIds,
              },
            },
          }
        : null,
    );
  }

  /**
   * 获取共享视图的路径
   * @param context - 上下文信息
   * @param viewId - 视图ID
   * @param ncMeta - 元数据服务实例
   * @returns 返回共享视图的路径
   */
  static async getSharedViewPath(
    context: NcContext,
    viewId,
    ncMeta = Noco.ncMeta,
  ) {
    // 获取视图对象
    const view = await this.get(context, viewId, ncMeta);
    // 如果视图没有UUID，返回null
    if (!view.uuid) return null;

    let viewType;
    // 根据视图类型设置视图类型字符串
    switch (view.type) {
      case ViewTypes.FORM:
        viewType = 'form';
        break;
      case ViewTypes.KANBAN:
        viewType = 'kanban';
        break;
      case ViewTypes.GALLERY:
        viewType = 'gallery';
        break;
      case ViewTypes.MAP:
        viewType = 'map';
        break;
      case ViewTypes.CALENDAR:
        viewType = 'calendar';
        break;
      default:
        viewType = 'view';
    }

    // 返回编码后的共享视图路径
    return `${encodeURI(
      `/nc/${viewType}/${view.uuid}${
        parseProp(view.meta)?.surveyMode ? '/survey' : ''
      }`,
    )}`;
  }

  /**
   * 获取共享视图列表
   * @param context - 上下文信息
   * @param tableId - 表ID
   * @param ncMeta - 元数据服务实例
   * @returns 返回共享视图列表
   */
  static async shareViewList(
    context: NcContext,
    tableId,
    ncMeta = Noco.ncMeta,
  ) {
    // 从缓存获取共享视图列表
    const cachedList = await NocoCache.getList(CacheScope.VIEW, [tableId]);
    let { list: sharedViews } = cachedList;
    const { isNoneList } = cachedList;
    // 如果缓存中没有共享视图，查询数据库
    if (!isNoneList && !sharedViews.length) {
      sharedViews = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.VIEWS,
        {
          xcCondition: {
            fk_model_id: {
              eq: tableId,
            },
            _not: {
              uuid: {
                eq: null,
              },
            },
          },
        },
      );
      // 更新缓存
      await NocoCache.setList(CacheScope.VIEW, [tableId], sharedViews);
    }
    // 过滤掉没有UUID的视图
    sharedViews = sharedViews.filter((v) => v.uuid !== null);
    // 返回共享视图对象列表
    return sharedViews?.map((v) => new View(v));
  }

  static async fixPVColumnForView(
    context: NcContext,
    viewId,
    ncMeta = Noco.ncMeta,
  ) {
    // get a list of view columns sorted by order
    const view_columns = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.GRID_VIEW_COLUMNS,
      {
        condition: {
          fk_view_id: viewId,
        },
        orderBy: {
          order: 'asc',
        },
      },
    );
    const view_columns_meta = [];

    // get column meta for each view column
    for (const col of view_columns) {
      const col_meta = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.COLUMNS,
        col.fk_column_id,
      );
      if (col_meta) view_columns_meta.push(col_meta);
    }

    const primary_value_column_meta = view_columns_meta.find((col) => col.pv);

    if (primary_value_column_meta) {
      const primary_value_column = view_columns.find(
        (col) => col.fk_column_id === primary_value_column_meta.id,
      );
      const primary_value_column_index = view_columns.findIndex(
        (col) => col.fk_column_id === primary_value_column_meta.id,
      );
      const view_orders = view_columns.map((col) => col.order);
      const view_min_order = Math.min(...view_orders);

      // if primary_value_column is not visible, make it visible
      if (!primary_value_column.show) {
        await ncMeta.metaUpdate(
          context.workspace_id,
          context.base_id,
          MetaTable.GRID_VIEW_COLUMNS,
          { show: true },
          primary_value_column.id,
        );
        await NocoCache.set(
          `${CacheScope.GRID_VIEW_COLUMN}:${primary_value_column.id}`,
          primary_value_column,
        );
      }

      if (
        primary_value_column.order === view_min_order &&
        view_orders.filter((o) => o === view_min_order).length === 1
      ) {
        // if primary_value_column is in first order do nothing
        return;
      } else {
        // if primary_value_column not in first order, move it to the start of array
        if (primary_value_column_index !== 0) {
          const temp_pv = view_columns.splice(primary_value_column_index, 1);
          view_columns.unshift(...temp_pv);
        }

        // update order of all columns in view to match the order in array
        for (let i = 0; i < view_columns.length; i++) {
          await ncMeta.metaUpdate(
            context.workspace_id,
            context.base_id,
            MetaTable.GRID_VIEW_COLUMNS,
            { order: i + 1 },
            view_columns[i].id,
          );
          await NocoCache.set(
            `${CacheScope.GRID_VIEW_COLUMN}:${view_columns[i].id}`,
            view_columns[i],
          );
        }
      }
    }

    const views = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.GRID_VIEW_COLUMNS,
      {
        condition: {
          fk_view_id: viewId,
        },
        orderBy: {
          order: 'asc',
        },
      },
    );
    await NocoCache.setList(CacheScope.GRID_VIEW_COLUMN, [viewId], views);
  }

  public static async clearSingleQueryCache(
    context: NcContext,
    modelId: string,
    views?: { id?: string }[],
    ncMeta = Noco.ncMeta,
  ) {
    if (!Noco.isEE()) return;

    // get all views of the model
    let viewsList =
      views || (await NocoCache.getList(CacheScope.VIEW, [modelId])).list;

    if (!views && !viewsList?.length) {
      viewsList = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.VIEWS,
        {
          condition: {
            fk_model_id: modelId,
          },
        },
      );
    }

    const deleteKeys = [];

    for (const view of viewsList) {
      deleteKeys.push(
        `${CacheScope.SINGLE_QUERY}:${modelId}:${view.id}:queries`,
        `${CacheScope.SINGLE_QUERY}:${modelId}:${view.id}:count`,
        `${CacheScope.SINGLE_QUERY}:${modelId}:${view.id}:read`,
      );
    }

    deleteKeys.push(
      `${CacheScope.SINGLE_QUERY}:${modelId}:default:queries`,
      `${CacheScope.SINGLE_QUERY}:${modelId}:default:count`,
      `${CacheScope.SINGLE_QUERY}:${modelId}:default:read`,
    );

    await NocoCache.del(deleteKeys);
  }

  static async bulkColumnInsertToViews(
    context: NcContext,
    {
      columns,
      viewColumns,
      copyFromView,
    }: {
      copyFromView?: View;
      columns?: ({
        order?: number;
        show?;
      } & Column)[];
      viewColumns?: (
        | GridViewColumn
        | GalleryViewColumn
        | FormViewColumn
        | KanbanViewColumn
        | MapViewColumn
        | CalendarViewColumn
      )[];
    },
    view: View,
    ncMeta = Noco.ncMeta,
  ) {
    const insertObjs = [];

    if (viewColumns) {
      for (let i = 0; i < viewColumns.length; i++) {
        const column =
          view.type === ViewTypes.FORM
            ? prepareForDb(viewColumns[i])
            : viewColumns[i];

        insertObjs.push({
          ...extractProps(column, [
            'fk_view_id',
            'fk_column_id',
            'show',
            'base_id',
            'source_id',
            'order',
            ...(view.type === ViewTypes.CALENDAR
              ? ['bold', 'italic', 'underline']
              : []),
            ...(view.type === ViewTypes.FORM
              ? [
                  'label',
                  'help',
                  'description',
                  'required',
                  'enable_scanner',
                  'meta',
                ]
              : [
                  'width',
                  'group_by',
                  'group_by_order',
                  'group_by_sort',
                  'aggregation',
                ]),
          ]),
          fk_view_id: view.id,
          base_id: view.base_id,
          source_id: view.source_id,
        });
      }
    } else {
      if (!columns) {
        columns = await Column.list(context, { fk_model_id: view.fk_model_id });
      }

      if (!copyFromView) {
        // sort by display value first, then other columns
        // so that later we can handle control `show` easily
        columns.sort((a, b) => {
          return +b.pv - +a.pv;
        });
      }

      let order = 1;
      let galleryShowLimit = 0;
      let kanbanShowLimit = 0;

      let calendarRangeColumns;

      if (view.type == ViewTypes.CALENDAR) {
        const calendarRange = await CalendarRange.read(
          context,
          view.id,
          ncMeta,
        );
        if (calendarRange) {
          calendarRangeColumns = calendarRange.ranges
            .map((range) => [
              range.fk_from_column_id,
              (range as any).fk_to_column_id,
            ])
            .flat();
        }
      }

      for (let i = 0; i < columns.length; i++) {
        const column = columns[i];

        let show = 'show' in column ? column.show : true;

        const aggregation = CommonAggregations.None;

        if (view.type === ViewTypes.GALLERY) {
          const galleryView = await GalleryView.get(context, view.id, ncMeta);
          // define the limit of columns to show in gallery view, excluding the cover image column and primary value column
          const showLimit = galleryView.fk_cover_image_col_id ? 2 : 3;

          if (
            (column.id === galleryView.fk_cover_image_col_id && column.pv) ||
            (column.id !== galleryView.fk_cover_image_col_id &&
              (column.pv || galleryShowLimit < showLimit) &&
              // exclude system columns
              !column.system)
          ) {
            show = true;
            // increment the count of columns shown in gallery view if it is not a primary value or cover image column
            if (!column.pk && column.id !== galleryView.fk_cover_image_col_id) {
              galleryShowLimit++;
            }
          } else {
            show = false;
          }
        } else if (view.type === ViewTypes.KANBAN && !copyFromView) {
          const kanbanView = await KanbanView.get(context, view.id, ncMeta);
          if (column.id === kanbanView?.fk_grp_col_id && column.pv) {
            // include grouping field if it exists
            show = true;
          } else if (
            (column.id === kanbanView.fk_cover_image_col_id && column.pv) ||
            (column.id !== kanbanView.fk_cover_image_col_id && column.pv)
          ) {
            // Show primary key and cover image if it is a primary value; otherwise, it will be redundant.
            show = true;
            kanbanShowLimit++;
          } else if (
            column.id !== kanbanView.fk_cover_image_col_id &&
            kanbanShowLimit < 3 &&
            !isSystemColumn(column)
          ) {
            // show at most 3 non-system columns
            show = true;
            kanbanShowLimit++;
          } else {
            // other columns will be hidden
            show = false;
          }
        } else if (view.type === ViewTypes.MAP && !copyFromView) {
          const mapView = await MapView.get(context, view.id, ncMeta);
          if (column.id === mapView?.fk_geo_data_col_id) {
            show = true;
          }
        } else if (view.type === ViewTypes.FORM && isSystemColumn(column)) {
          show = false;
        } else if (view.type === ViewTypes.CALENDAR) {
          if (!calendarRangeColumns) break;
          if (calendarRangeColumns.includes(column.id)) {
            show = true;
          }
        }

        insertObjs.push({
          fk_column_id: column.id,
          order: order++,
          show,
          fk_view_id: view.id,
          base_id: view.base_id,
          source_id: view.source_id,
          ...(view.type === ViewTypes.GRID
            ? {
                aggregation,
              }
            : {}),
        });
      }
    }

    switch (view.type) {
      case ViewTypes.GRID:
        await ncMeta.bulkMetaInsert(
          context.workspace_id,
          context.base_id,
          MetaTable.GRID_VIEW_COLUMNS,
          insertObjs,
        );
        break;
      case ViewTypes.GALLERY:
        await ncMeta.bulkMetaInsert(
          context.workspace_id,
          context.base_id,
          MetaTable.GALLERY_VIEW_COLUMNS,
          insertObjs,
        );
        break;
      case ViewTypes.MAP:
        await ncMeta.bulkMetaInsert(
          context.workspace_id,
          context.base_id,
          MetaTable.MAP_VIEW_COLUMNS,
          insertObjs,
        );
        break;
      case ViewTypes.KANBAN:
        await ncMeta.bulkMetaInsert(
          context.workspace_id,
          context.base_id,
          MetaTable.KANBAN_VIEW_COLUMNS,
          insertObjs,
        );
        break;
      case ViewTypes.FORM:
        await ncMeta.bulkMetaInsert(
          context.workspace_id,
          context.base_id,
          MetaTable.FORM_VIEW_COLUMNS,
          insertObjs,
        );
        break;
      case ViewTypes.CALENDAR:
        await ncMeta.bulkMetaInsert(
          context.workspace_id,
          context.base_id,
          MetaTable.CALENDAR_VIEW_COLUMNS,
          insertObjs,
        );
    }
  }

  static async insertMetaOnly(
    context: NcContext,
    {
      view,
      model,
      req,
    }: {
      view: Partial<View> &
        Partial<
          | FormView
          | GridView
          | GalleryView
          | KanbanView
          | MapView
          | CalendarView
        > & {
          copy_from_id?: string;
          fk_grp_col_id?: string;
          calendar_range?: Partial<CalendarRange>[];
          created_by: string;
          owned_by: string;
          expanded_record_mode?: ExpandedFormModeType;
          attachment_mode_column_id?: string;
        };
      model: {
        getColumns: (context: NcContext, ncMeta?) => Promise<Column[]>;
      };
      req: NcRequest;
    },
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = extractProps(view, [
      'id',
      'title',
      'is_default',
      'description',
      'type',
      'fk_model_id',
      'base_id',
      'source_id',
      'meta',
      'created_by',
      'owned_by',
      'lock_type',
      ...(isEE ? ['expanded_record_mode', 'attachment_mode_column_id'] : []),
    ]);

    if (isEE) {
      if (!insertObj?.attachment_mode_column_id) {
        insertObj.expanded_record_mode = ExpandedFormMode.FIELD;
      } else {
        insertObj.expanded_record_mode = ExpandedFormMode.ATTACHMENT;
      }
    }

    if (!insertObj.order) {
      // get order value
      insertObj.order = await ncMeta.metaGetNextOrder(MetaTable.VIEWS, {
        fk_model_id: view.fk_model_id,
      });
    }

    insertObj.show = true;

    if (!insertObj.meta) {
      insertObj.meta = {};
    }

    insertObj.meta = stringifyMetaProp(insertObj);

    const copyFromView =
      view.copy_from_id && (await View.get(context, view.copy_from_id, ncMeta));
    await copyFromView?.getView(context);

    const table = await Model.getByIdOrName(
      context,
      { id: view.fk_model_id },
      ncMeta,
    );

    // get base and base id if missing
    if (!view.source_id) {
      insertObj.source_id = table.source_id;
    }

    const insertedView = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.VIEWS,
      insertObj,
    );

    const { id: view_id } = insertedView;

    // insert view metadata based on view type
    switch (view.type) {
      case ViewTypes.GRID:
        await GridView.insert(
          context,
          {
            ...((copyFromView?.view as GridView) || {}),
            ...(view as GridView),
            fk_view_id: view_id,
          },
          ncMeta,
        );
        break;
      case ViewTypes.MAP:
        await MapView.insert(
          context,
          {
            ...(view as MapView),
            fk_view_id: view_id,
          },
          ncMeta,
        );
        break;
      case ViewTypes.GALLERY:
        await GalleryView.insert(
          context,
          {
            ...(copyFromView?.view || {}),
            ...view,
            fk_view_id: view_id,
          },
          ncMeta,
        );
        break;
      case ViewTypes.FORM:
        await FormView.insert(
          context,
          {
            heading: view.title,
            ...(copyFromView?.view || {}),
            ...view,
            fk_view_id: view_id,
          },
          ncMeta,
        );
        break;
      case ViewTypes.KANBAN:
        // set grouping field
        (view as KanbanView).fk_grp_col_id = view.fk_grp_col_id;

        await KanbanView.insert(
          context,
          {
            ...(copyFromView?.view || {}),
            ...view,
            fk_view_id: view_id,
          },
          ncMeta,
        );
        break;
      case ViewTypes.CALENDAR: {
        const obj = extractProps(view, ['calendar_range']);
        if (!obj.calendar_range) break;
        const calendarRange = obj.calendar_range as Partial<CalendarRange>[];
        calendarRange.forEach((range) => {
          range.fk_view_id = view_id;
        });

        await CalendarRange.bulkInsert(context, calendarRange, ncMeta);
        await CalendarView.insert(
          context,
          {
            ...(copyFromView?.view || {}),
            ...view,
            fk_view_id: view_id,
          },
          ncMeta,
        );

        break;
      }
    }
    try {
      // copy from view
      if (copyFromView) {
        // generate parent audit id and add it to req object
        const eventId = await ncMeta.genNanoid(MetaTable.AUDIT);
        req.ncParentAuditId = eventId;
        Noco.appHooksService.emit(AppEvents.VIEW_DUPLICATE_START, {
          sourceView: copyFromView,
          destView: view as ViewType,
          req,
          context,
          id: eventId,
        });

        const sorts = await copyFromView.getSorts(context, ncMeta);
        const filters = await Filter.rootFilterList(
          context,
          { viewId: copyFromView.id },
          ncMeta,
        );
        const viewColumns = await copyFromView.getColumns(context, ncMeta);

        const sortInsertObjs = [];
        const filterInsertObjs = [];

        for (const sort of sorts) {
          sortInsertObjs.push({
            ...extractProps(sort, [
              'fk_column_id',
              'direction',
              'base_id',
              'source_id',
            ]),
            fk_view_id: view_id,
            id: undefined,
          });

          Noco.appHooksService.emit(AppEvents.SORT_CREATE, {
            sort: {
              ...sort,
              id: undefined,
            },
            view: view as ViewType,
            column: await Column.get(context, {
              colId: sort.fk_column_id,
            }),
            req,
            context,
          });
        }

        for (const filter of filters) {
          const fn = async (filter, parentId: string = null) => {
            const generatedId = await ncMeta.genNanoid(MetaTable.FILTER_EXP);

            filterInsertObjs.push({
              ...extractProps(filter, [
                'fk_parent_column_id',
                'fk_column_id',
                'comparison_op',
                'comparison_sub_op',
                'value',
                'fk_parent_id',
                'is_group',
                'logical_op',
                'base_id',
                'source_id',
                'order',
              ]),
              fk_view_id: view_id,
              id: generatedId,
              fk_parent_id: parentId,
            });
            if (filter.is_group)
              await Promise.all(
                ((await filter.getChildren(context)) || []).map(
                  async (child) => {
                    await fn(child, generatedId);
                  },
                ),
              );

            Noco.appHooksService.emit(AppEvents.FILTER_CREATE, {
              filter: { ...filter, id: undefined } as FilterType,
              column: await Column.get(context, {
                colId: filter.fk_column_id,
              }),
              view: view as ViewType,
              req,
              context,
            });
          };

          await fn(filter);
        }

        await ncMeta.bulkMetaInsert(
          context.workspace_id,
          context.base_id,
          MetaTable.SORT,
          sortInsertObjs,
        );

        await ncMeta.bulkMetaInsert(
          context.workspace_id,
          context.base_id,
          MetaTable.FILTER_EXP,
          filterInsertObjs,
          true,
        );

        // populate view columns
        await View.bulkColumnInsertToViews(
          context,
          { viewColumns, copyFromView },
          insertedView,
        );
      } else {
        // populate view columns
        await View.bulkColumnInsertToViews(
          context,
          { columns: (await model.getColumns(context, ncMeta)) as any[] },
          insertedView,
        );
      }

      await Model.getNonDefaultViewsCountAndReset(
        context,
        { modelId: view.fk_model_id },
        ncMeta,
      );

      if (copyFromView) {
        Noco.appHooksService.emit(AppEvents.VIEW_DUPLICATE_COMPLETE, {
          sourceView: copyFromView,
          destView: view as ViewType,
          req,
          context,
        });
      }
      return insertedView;
    } catch (e) {
      if (copyFromView) {
        Noco.appHooksService.emit(AppEvents.VIEW_DUPLICATE_FAIL, {
          sourceView: copyFromView,
          destView: view as ViewType,
          error: e,
          req,
          context,
        });
      }

      throw e;
    }
  }

  /**
   * 提取视图列表名
   * 根据视图类型返回对应的表名
   * @param view - 视图对象
   */
  public static extractViewColumnsTableName(view: View) {
    let table;
    switch (view.type) {
      case ViewTypes.GRID:
        table = MetaTable.GRID_VIEW_COLUMNS;
        break;
      case ViewTypes.GALLERY:
        table = MetaTable.GALLERY_VIEW_COLUMNS;
        break;
      case ViewTypes.KANBAN:
        table = MetaTable.KANBAN_VIEW_COLUMNS;
        break;
      case ViewTypes.FORM:
        table = MetaTable.FORM_VIEW_COLUMNS;
        break;
      case ViewTypes.MAP:
        table = MetaTable.MAP_VIEW_COLUMNS;
        break;
      case ViewTypes.CALENDAR:
        table = MetaTable.CALENDAR_VIEW_COLUMNS;
        break;
    }
    return table;
  }

  /**
   * 提取视图表名
   * 根据视图类型返回对应的表名
   * @param view - 视图对象
   */
  protected static extractViewTableName(view: View) {
    let table;
    switch (view.type) {
      case ViewTypes.GRID:
        table = MetaTable.GRID_VIEW;
        break;
      case ViewTypes.GALLERY:
        table = MetaTable.GALLERY_VIEW;
        break;
      case ViewTypes.KANBAN:
        table = MetaTable.KANBAN_VIEW;
        break;
      case ViewTypes.FORM:
        table = MetaTable.FORM_VIEW;
        break;
      case ViewTypes.MAP:
        table = MetaTable.MAP_VIEW;
        break;
      case ViewTypes.CALENDAR:
        table = MetaTable.CALENDAR_VIEW;
        break;
    }
    return table;
  }

  /**
   * 提取视图列缓存范围
   * 根据视图类型返回对应的缓存范围
   * @param view - 视图对象
   */
  protected static extractViewColumnsTableNameScope(view: View) {
    let scope;
    switch (view.type) {
      case ViewTypes.GRID:
        scope = CacheScope.GRID_VIEW_COLUMN;
        break;
      case ViewTypes.GALLERY:
        scope = CacheScope.GALLERY_VIEW_COLUMN;
        break;
      case ViewTypes.MAP:
        scope = CacheScope.MAP_VIEW_COLUMN;
        break;
      case ViewTypes.KANBAN:
        scope = CacheScope.KANBAN_VIEW_COLUMN;
        break;
      case ViewTypes.FORM:
        scope = CacheScope.FORM_VIEW_COLUMN;
        break;
      case ViewTypes.CALENDAR:
        scope = CacheScope.CALENDAR_VIEW_COLUMN;
        break;
    }
    return scope;
  }

  /**
   * 提取视图表缓存范围
   * 根据视图类型返回对应的缓存范围
   * @param view - 视图对象
   */
  private static extractViewTableNameScope(view: View) {
    let scope;
    switch (view.type) {
      case ViewTypes.GRID:
        scope = CacheScope.GRID_VIEW;
        break;
      case ViewTypes.GALLERY:
        scope = CacheScope.GALLERY_VIEW;
        break;
      case ViewTypes.MAP:
        scope = CacheScope.MAP_VIEW;
        break;
      case ViewTypes.KANBAN:
        scope = CacheScope.KANBAN_VIEW;
        break;
      case ViewTypes.FORM:
        scope = CacheScope.FORM_VIEW;
        break;
      case ViewTypes.CALENDAR:
        scope = CacheScope.CALENDAR_VIEW;
        break;
    }
    return scope;
  }

  /**
   * 获取关联的模型
   * @param context - 上下文信息
   * @param ncMeta - 元数据服务实例
   */
  async getModel(context: NcContext, ncMeta = Noco.ncMeta): Promise<Model> {
    return (this.model = await Model.getByIdOrName(
      context,
      { id: this.fk_model_id },
      ncMeta,
    ));
  }

  /**
   * 获取带详细信息的模型
   * @param context - 上下文信息
   * @param ncMeta - 元数据服务实例
   */
  async getModelWithInfo(
    context: NcContext,
    ncMeta = Noco.ncMeta,
  ): Promise<Model> {
    return (this.model = await Model.getWithInfo(
      context,
      { id: this.fk_model_id },
      ncMeta,
    ));
  }

  /**
   * 获取视图对象
   * @param context - 上下文信息
   * @param ncMeta - 元数据服务实例
   */
  async getView<T>(context: NcContext, ncMeta = Noco.ncMeta): Promise<T> {
    switch (this.type) {
      case ViewTypes.GRID:
        this.view = await GridView.get(context, this.id, ncMeta);
        break;
      case ViewTypes.KANBAN:
        this.view = await KanbanView.get(context, this.id, ncMeta);
        break;
      case ViewTypes.GALLERY:
        this.view = await GalleryView.get(context, this.id, ncMeta);
        break;
      case ViewTypes.MAP:
        this.view = await MapView.get(context, this.id, ncMeta);
        break;
      case ViewTypes.FORM:
        this.view = await FormView.get(context, this.id, ncMeta);
        break;
      case ViewTypes.CALENDAR:
        this.view = await CalendarView.get(context, this.id, ncMeta);
        break;
    }
    return <T>this.view;
  }

  /**
   * 获取带详细信息的视图对象
   * @param context - 上下文信息
   * @param ncMeta - 元数据服务实例
   */
  async getViewWithInfo(
    context: NcContext,
    ncMeta = Noco.ncMeta,
  ): Promise<FormView | GridView | KanbanView | GalleryView> {
    switch (this.type) {
      case ViewTypes.GRID:
        this.view = await GridView.getWithInfo(context, this.id, ncMeta);
        break;
      case ViewTypes.KANBAN:
        this.view = await KanbanView.get(context, this.id, ncMeta);
        break;
      case ViewTypes.GALLERY:
        this.view = await GalleryView.get(context, this.id, ncMeta);
        break;
      case ViewTypes.MAP:
        this.view = await MapView.get(context, this.id, ncMeta);
        break;
      case ViewTypes.FORM:
        this.view = await FormView.get(context, this.id, ncMeta);
        break;
      case ViewTypes.CALENDAR:
        this.view = await CalendarView.get(context, this.id, ncMeta);
        break;
    }
    return this.view;
  }

  /**
   * 获取过滤器对象
   * @param context - 上下文信息
   * @param ncMeta - 元数据服务实例
   */
  public async getFilters(context: NcContext, ncMeta = Noco.ncMeta) {
    return (this.filter = (await Filter.getFilterObject(
      context,
      {
        viewId: this.id,
      },
      ncMeta,
    )) as any);
  }

  /**
   * 获取排序配置
   * @param context - 上下文信息
   * @param ncMeta - 元数据服务实例
   */
  public async getSorts(context: NcContext, ncMeta = Noco.ncMeta) {
    return (this.sorts = await Sort.list(context, { viewId: this.id }, ncMeta));
  }

  /**
   * 获取视图列
   * @param context - 上下文信息
   * @param ncMeta - 元数据服务实例
   */
  async getColumns(context: NcContext, ncMeta = Noco.ncMeta) {
    return (this.columns = await View.getColumns(context, this.id, ncMeta));
  }

  /**
   * 删除视图
   * @param context - 上下文信息
   * @param ncMeta - 元数据服务实例
   */
  async delete(context: NcContext, ncMeta = Noco.ncMeta) {
    await View.delete(context, this.id, ncMeta);
  }

  static async updateIfColumnUsedAsExpandedMode(
    _context: NcContext,
    _columnId: string,
    _modelId: string,
    _ncMeta = Noco.ncMeta,
  ) {
    return;
  }
}
