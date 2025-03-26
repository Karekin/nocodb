import type { CalendarRangeType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { extractProps } from '~/helpers/extractProps';
import { CacheDelDirection, CacheScope, MetaTable } from '~/utils/globals';

/**
 * 日历视图范围类，用于管理日历视图中的日期范围
 */
export default class CalendarRange implements CalendarRangeType {
  id?: string; // 范围ID
  fk_from_column_id?: string; // 关联的起始列ID
  fk_workspace_id?: string; // 关联的工作区ID
  base_id?: string; // 关联的数据库ID
  fk_view_id?: string; // 关联的视图ID

  /**
   * 构造函数
   * @param data 部分日历范围数据
   */
  constructor(data: Partial<CalendarRange>) {
    Object.assign(this, data);
  }

  /**
   * 批量插入日历范围
   * @param context 上下文对象
   * @param data 要插入的日历范围数据数组
   * @param ncMeta NocoDB元数据实例
   * @returns 插入是否成功
   */
  public static async bulkInsert(
    context: NcContext,
    data: Partial<CalendarRange>[],
    ncMeta = Noco.ncMeta,
  ) {
    const calRanges: {
      fk_from_column_id?: string;
      fk_view_id?: string;
    }[] = [];

    // 提取每个数据对象的必要属性
    for (const d of data) {
      const tempObj = extractProps(d, ['fk_from_column_id', 'fk_view_id']);
      calRanges.push(tempObj);
    }

    if (!calRanges.length) return false;

    const insertObj = calRanges[0];

    // 插入数据到数据库
    const insertData = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.CALENDAR_VIEW_RANGE,
      insertObj,
    );

    // 更新缓存
    await NocoCache.deepDel(
      `${CacheScope.CALENDAR_VIEW_RANGE}:${insertData.fk_view_id}:list`,
      CacheDelDirection.PARENT_TO_CHILD,
    );

    await NocoCache.set(
      `${CacheScope.CALENDAR_VIEW_RANGE}:${insertData.id}`,
      insertData,
    );

    await NocoCache.appendToList(
      CacheScope.CALENDAR_VIEW_RANGE,
      [insertData.fk_view_id],
      `${CacheScope.CALENDAR_VIEW_RANGE}:${insertData.id}`,
    );

    return true;
  }

  /**
   * 读取指定视图的日历范围
   * @param context 上下文对象
   * @param fk_view_id 视图ID
   * @param ncMeta NocoDB元数据实例
   * @returns 日历范围数据或null
   */
  public static async read(
    context: NcContext,
    fk_view_id: string,
    ncMeta = Noco.ncMeta,
  ) {
    // 尝试从缓存获取数据
    const cachedList = await NocoCache.getList(CacheScope.CALENDAR_VIEW_RANGE, [
      fk_view_id,
    ]);
    let { list: ranges } = cachedList;
    const { isNoneList } = cachedList;

    // 如果缓存中没有数据，从数据库获取
    if (!isNoneList && !ranges.length) {
      ranges = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.CALENDAR_VIEW_RANGE,
        { condition: { fk_view_id } },
      );
      // 将数据存入缓存
      await NocoCache.setList(
        CacheScope.CALENDAR_VIEW_RANGE,
        [fk_view_id],
        ranges.map(({ created_at, updated_at, ...others }) => others),
      );
    }

    return ranges?.length
      ? {
          ranges: ranges.map(
            ({ created_at, updated_at, ...c }) => new CalendarRange(c),
          ),
        }
      : null;
  }

  /**
   * 删除指定范围的日历范围
   * @param rangeId 范围ID
   * @param context 上下文对象
   * @param ncMeta NocoDB元数据实例
   * @returns 删除是否成功
   */
  public static async delete(
    rangeId: string,
    context: NcContext,
    ncMeta = Noco.ncMeta,
  ) {
    // 获取要删除的范围
    const range = await ncMeta.metaGet2(
      context.workspace_id,
      context.base_id,
      MetaTable.CALENDAR_VIEW_RANGE,
      {
        id: rangeId,
      },
    );

    if (!range) return false;

    // 从数据库删除
    await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.CALENDAR_VIEW_RANGE,
      rangeId,
    );

    // 更新缓存
    await NocoCache.deepDel(
      `${CacheScope.CALENDAR_VIEW_RANGE}:${range.fk_view_id}:list`,
      CacheDelDirection.PARENT_TO_CHILD,
    );

    await NocoCache.del(`${CacheScope.CALENDAR_VIEW_RANGE}:${rangeId}`);

    return true;
  }

  /**
   * 查找指定视图的日历范围
   * @param context 上下文对象
   * @param fk_view_id 视图ID
   * @param ncMeta NocoDB元数据实例
   * @returns 找到的日历范围实例
   */
  public static async find(
    context: NcContext,
    fk_view_id: string,
    ncMeta = Noco.ncMeta,
  ): Promise<CalendarRange> {
    const data = await ncMeta.metaGet2(
      context.workspace_id,
      context.base_id,
      MetaTable.CALENDAR_VIEW_RANGE,
      {
        fk_view_id,
      },
    );

    return data && new CalendarRange(data);
  }

  /**
   * 检查列是否被用作日历范围
   * @param context 上下文对象
   * @param columnId 列ID
   * @param ncMeta NocoDB元数据实例
   * @returns 查询结果
   */
  public static async IsColumnBeingUsedAsRange(
    context: NcContext,
    columnId: string,
    ncMeta = Noco.ncMeta,
  ) {
    return await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.CALENDAR_VIEW_RANGE,
      {
        xcCondition: {
          _or: [
            {
              fk_from_column_id: {
                eq: columnId,
              },
            },
          ],
        },
      },
    );
  }
}
