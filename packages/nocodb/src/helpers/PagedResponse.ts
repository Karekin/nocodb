// 导入从当前目录的索引文件中提取限制和偏移量的函数
import { extractLimitAndOffset } from '.';
// 导入分页类型定义
import type { PaginatedType, PaginatedV3Type } from 'nocodb-sdk';
// 导入错误处理类
import { NcError } from '~/helpers/catchError';

// 一个工具函数，接受baseUrl、路径和查询参数，并构造一个URL
export function constructUrl({
  baseUrl,
  path,
  query,
}: {
  baseUrl: string; // 基础URL
  path: string; // 路径
  query?: Record<string, any>; // 可选的查询参数
}) {
  // 组合基础URL和路径
  let url = `${baseUrl}${path}`;
  // 如果存在查询参数，则将其转换为URL查询字符串并附加到URL后面
  if (query) {
    const queryStr = new URLSearchParams(query).toString();
    url = `${url}?${queryStr}`;
  }
  return url;
}

// 分页响应实现类，泛型T表示列表项的类型
export class PagedResponseImpl<T> {
  constructor(
    list: T[], // 数据列表
    args: {
      limit?: number; // 每页限制数量
      offset?: number; // 偏移量
      count?: number | string; // 总记录数
      l?: number; // limit的简写
      o?: number; // offset的简写
      limitOverride?: number; // 限制覆盖
      page?: number; // 页码
    } = {},
    additionalProps?: Record<string, any>, // 额外属性
  ) {
    // 从参数中提取偏移量和限制
    const { offset, limit } = extractLimitAndOffset(args);

    // 获取总记录数，如果未提供则为null
    let count = args.count ?? null;

    // 如果count不为null，则将其转换为数字
    if (count !== null) count = +count;

    // 设置数据列表
    this.list = list;

    // 如果提供了总记录数，则计算分页信息
    if (count !== null && count !== undefined) {
      // 初始化分页信息对象，设置总行数
      this.pageInfo = { totalRows: +count };
      // 计算当前页码：如果有偏移量，则为偏移量/限制+1，否则为第1页
      this.pageInfo.page = offset ? offset / limit + 1 : 1;
      // 设置每页大小
      this.pageInfo.pageSize = limit;
      // 判断是否为第一页：如果已设置isFirstPage则使用已有值，否则检查页码是否为1
      this.pageInfo.isFirstPage =
        this.pageInfo.isFirstPage ?? this.pageInfo.page === 1;
      // 判断是否为最后一页：当前页码是否大于等于总页数
      this.pageInfo.isLastPage =
        this.pageInfo.page >=
        (Math.ceil(this.pageInfo.totalRows / this.pageInfo.pageSize) || 1);

      // 如果页码不是整数，则使用偏移量代替页码
      if (this.pageInfo.page % 1 !== 0) {
        this.pageInfo.offset = offset;
        delete this.pageInfo.page;
      }

      // 如果偏移量大于等于总记录数，则抛出无效偏移量错误
      if (offset && offset >= +count) {
        NcError.invalidOffsetValue(offset);
      }
    }

    // 如果提供了额外属性，则将其合并到当前对象中
    if (additionalProps) Object.assign(this, additionalProps);
  }

  list: Array<T>; // 数据列表
  pageInfo: PaginatedType; // 分页信息
  errors?: any[]; // 可能的错误信息
}

// V3版本的分页响应实现类
export class PagedResponseV3Impl<T> {
  next?: string; // 下一页URL
  prev?: string; // 上一页URL
  nestedNext?: string; // 嵌套下一页URL
  nestedPrev?: string; // 嵌套上一页URL

  constructor(
    pagedResponse: PagedResponseImpl<T>, // 基础分页响应对象
    {
      baseUrl = '', // 基础URL，默认为空字符串
      tableId, // 表ID
      nestedNextPageAvail, // 是否有嵌套下一页
      nestedPrevPageAvail, // 是否有嵌套上一页
      queryParams = {}, // 查询参数
    }: {
      baseUrl?: string;
      tableId: string;
      nestedNextPageAvail?: boolean;
      nestedPrevPageAvail?: boolean;
      queryParams?: Record<string, any>;
    },
  ) {
    // 设置数据列表
    this.list = pagedResponse.list;
    // 初始化V3版本的分页信息对象
    const pageInfo: PaginatedV3Type = {};

    // 设置公共属性，包括基础URL和API路径
    const commonProps = {
      baseUrl,
      path: `/api/v3/tables/${tableId}/records`,
    };

    // 设置公共查询参数
    const commonQueryParams = {};

    // 如果不是第一页且页码存在，则构造上一页URL
    if (!pagedResponse.pageInfo.isFirstPage && pagedResponse.pageInfo.page) {
      pageInfo.prev = constructUrl({
        ...commonProps,
        query: { ...commonQueryParams, page: pagedResponse.pageInfo.page - 1 },
      });
    }

    // 如果不是最后一页且页码存在，则构造下一页URL
    if (!pagedResponse.pageInfo.isLastPage && pagedResponse.pageInfo.page) {
      pageInfo.next = constructUrl({
        ...commonProps,
        query: { ...commonQueryParams, page: pagedResponse.pageInfo.page + 1 },
      });
    }

    // 计算嵌套页码，确保至少为1
    const nestedPage = Math.max(+queryParams?.nestedPage, 1);

    // 如果有嵌套下一页，则构造嵌套下一页URL
    if (nestedNextPageAvail) {
      pageInfo.nestedNext = constructUrl({
        ...commonProps,
        query: {
          ...commonQueryParams,
          page: pagedResponse.pageInfo.page,
          nestedPage: nestedPage + 1,
        },
      });
    }

    // 如果有嵌套上一页，则构造嵌套上一页URL
    if (nestedPrevPageAvail) {
      pageInfo.nestedPrev = constructUrl({
        ...commonProps,
        query: {
          ...commonQueryParams,
          page: pagedResponse.pageInfo.page,
          nestedPage: nestedPage - 1,
        },
      });
    }

    // 设置分页信息
    this.pageInfo = pageInfo;
  }

  list: Array<T>; // 数据列表
  pageInfo: PaginatedV3Type; // V3版本的分页信息
}
