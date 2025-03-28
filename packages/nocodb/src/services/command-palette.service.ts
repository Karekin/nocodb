// 导入 NestJS 的依赖注入和日志模块
import { Injectable, Logger } from '@nestjs/common';
// 导入 nocodb-sdk 中的用户类型和视图类型别名
import { type UserType, viewTypeAlias } from 'nocodb-sdk';
// 导入获取用户工作区命令面板数据的辅助函数
import { getCommandPaletteForUserWorkspace } from 'src/helpers/commandPaletteHelpers';
// 导入 JSON 反序列化工具函数
import { deserializeJSON } from '~/utils/serialize';
// This service is overwritten entirely in the cloud and does not extend there.
// As a result, it refers to services from OSS to avoid type mismatches.

// 使用 Injectable 装饰器标记该服务可被依赖注入系统使用
@Injectable()
// 定义命令面板服务类
export class CommandPaletteService {
  // 创建一个命令面板服务的日志记录器实例
  logger = new Logger('CommandPaletteService');

  // 定义命令面板方法，接收包含请求体和用户信息的参数
  async commandPalette(param: { body: any; user: UserType }) {
    // 初始化命令数据数组
    const cmdData = [];
    try {
      // 定义从数据库获取的列表数据类型，并调用辅助函数获取用户工作区的命令面板数据
      const list: {
        base_id: string;
        base_title: string;
        base_meta: string;
        base_role: string;
        table_id: string;
        table_title: string;
        table_type: string;
        table_meta: string;
        view_id: string;
        view_title: string;
        view_is_default: boolean;
        view_type: string;
        view_meta: string;
      }[] = await getCommandPaletteForUserWorkspace(param.user?.id);

      // 创建基础（项目）数据的 Map 集合
      const bases = new Map<
        string,
        {
          id: string;
          title: string;
          meta: any;
        }
      >();
      // 创建表数据的 Map 集合
      const tables = new Map<
        string,
        {
          id: string;
          title: string;
          base_id: string;
          type: string;
          meta: any;
        }
      >();
      // 创建视图数据的 Map 集合
      const views = new Map<
        string,
        {
          id: string;
          title: string;
          base_id: string;
          table_id: string;
          is_default: boolean;
          type: string;
          meta: any;
        }
      >();

      // 遍历获取的列表数据
      for (const item of list) {
        // 如果基础数据 Map 中不存在当前项目，则添加到 Map 中
        if (!bases.has(item.base_id)) {
          bases.set(item.base_id, {
            id: item.base_id,
            title: item.base_title,
            meta: deserializeJSON(item.base_meta),
          });
        }

        // 如果表数据 Map 中不存在当前表，则添加到 Map 中
        if (!tables.has(item.table_id)) {
          tables.set(item.table_id, {
            id: item.table_id,
            title: item.table_title,
            meta: deserializeJSON(item.table_meta),
            base_id: item.base_id,
            type: item.table_type,
          });
        }

        // 如果视图数据 Map 中不存在当前视图，则添加到 Map 中
        if (!views.has(item.view_id)) {
          views.set(item.view_id, {
            id: item.view_id,
            title: item.view_title,
            meta: deserializeJSON(item.view_meta),
            base_id: item.base_id,
            table_id: item.table_id,
            is_default: item.view_is_default,
            type: item.view_type,
          });
        }
      }

      // 遍历基础数据 Map，将每个基础（项目）添加到命令数据数组中
      for (const [id, base] of bases) {
        cmdData.push({
          id: `p-${id}`,
          title: base.title,
          icon: 'project',
          iconColor: deserializeJSON(base.meta)?.iconColor,
          section: 'Bases',
        });
      }

      // 遍历表数据 Map，将每个表添加到命令数据数组中
      for (const [id, table] of tables) {
        cmdData.push({
          id: `tbl-${id}`,
          title: table.title,
          parent: `p-${table.base_id}`,
          icon: table?.meta?.icon || table.type,
          projectName: bases.get(table.base_id)?.title,
          section: 'Tables',
        });
      }

      // 遍历视图数据 Map，将每个视图添加到命令数据数组中
      for (const [id, view] of views) {
        cmdData.push({
          id: `vw-${id}`,
          title: `${view.title}`,
          parent: `tbl-${view.table_id}`,
          icon: view?.meta?.icon || viewTypeAlias[view.type] || 'table',
          projectName: bases.get(view.base_id)?.title,
          section: 'Views',
          is_default: view.is_default,
          handler: {
            type: 'navigate',
            payload: `/nc/${view.base_id}/${view.table_id}/${encodeURIComponent(
              id,
            )}`,
          },
        });
      }
    } catch (e) {
      // 捕获并记录任何错误
      this.logger.warn(e);
      // 发生错误时返回空数组
      return [];
    }
    // 返回构建好的命令数据数组
    return cmdData;
  }
}
