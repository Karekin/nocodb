// 导入必要的依赖
import { Injectable } from '@nestjs/common'; // 导入NestJS的Injectable装饰器，用于依赖注入
import { ModelTypes } from 'nocodb-sdk'; // 导入模型类型定义
import DOMPurify from 'isomorphic-dompurify'; // 导入DOMPurify用于防止XSS攻击
import type { UserType } from 'nocodb-sdk'; // 导入用户类型定义
import type { NcContext } from '~/interface/config'; // 导入NocoDB上下文接口
import { NcError } from '~/helpers/catchError'; // 导入错误处理工具
import getTableNameAlias, { getColumnNameAlias } from '~/helpers/getTableName'; // 导入表名和列名别名获取工具
import ProjectMgrv2 from '~/db/sql-mgr/v2/ProjectMgrv2'; // 导入项目管理器
import mapDefaultDisplayValue from '~/helpers/mapDefaultDisplayValue'; // 导入默认显示值映射工具
import getColumnUiType from '~/helpers/getColumnUiType'; // 导入列UI类型获取工具
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2'; // 导入数据库连接管理器
import { Base, Column, Model } from '~/models'; // 导入基础模型

@Injectable() // 标记为可注入的服务
export class SqlViewsService {
  /**
   * 创建SQL视图的方法
   * @param context - NocoDB上下文
   * @param param - 包含创建视图所需参数的对象
   * @returns 创建的模型对象
   */
  async sqlViewCreate(
    context: NcContext,
    param: {
      clientIp: string; // 客户端IP地址
      baseId: string; // 基础ID
      sourceId: string; // 数据源ID
      body: {
        view_name: string; // 视图名称
        title: string; // 视图标题
        view_definition?: string; // 视图定义SQL
      };
      user: UserType; // 用户信息
    },
  ) {
    NcError.notImplemented(); // 抛出未实现错误
    return; // 提前返回，以下代码暂未启用
    const body = { ...param.body }; // 复制请求体参数

    // 获取基础信息及其相关数据
    const base = await Base.getWithInfo(context, param.baseId);
    let source = base.sources[0]; // 默认使用第一个数据源

    // 如果提供了特定的数据源ID，则使用该数据源
    if (param.sourceId) {
      source = base.sources.find((b) => b.id === param.sourceId);
    }

    // 验证视图名称是否存在，或是否与基础前缀冲突
    if (!body.view_name || (base.prefix && base.prefix === body.view_name)) {
      NcError.badRequest(
        'Missing table name `view_name` property in request body',
      );
    }

    // 如果是元数据源且有前缀，确保视图名称包含前缀
    if (source.is_meta && base.prefix) {
      if (!body.view_name.startsWith(base.prefix)) {
        body.view_name = `${base.prefix}_${body.view_name}`;
      }
    }

    // 对视图名称进行XSS防护处理
    body.view_name = DOMPurify.sanitize(body.view_name);

    // 验证表名是否包含前导或尾随空格
    if (/^\s+|\s+$/.test(body.view_name)) {
      NcError.badRequest(
        'Leading or trailing whitespace not allowed in table names',
      );
    }

    // 检查表名是否可用（不重复）
    if (
      !(await Model.checkTitleAvailable(context, {
        table_name: body.view_name,
        base_id: base.id,
        source_id: source.id,
      }))
    ) {
      NcError.badRequest('Duplicate table name');
    }

    // 如果未提供标题，则根据视图名称生成标题
    if (!body.title) {
      body.title = getTableNameAlias(body.view_name, base.prefix, source);
    }

    // 检查别名是否可用（不重复）
    if (
      !(await Model.checkAliasAvailable(context, {
        title: body.title,
        base_id: base.id,
        source_id: source.id,
      }))
    ) {
      NcError.badRequest('Duplicate table alias');
    }

    // 获取SQL管理器和SQL客户端
    const sqlMgr = await ProjectMgrv2.getSqlMgr(context, base);
    const sqlClient = await NcConnectionMgrv2.getSqlClient(source);

    // 根据不同数据库类型设置表名长度限制
    let tableNameLengthLimit = 255; // 默认长度限制
    const sqlClientType = sqlClient.knex.clientType();
    if (sqlClientType === 'mysql2' || sqlClientType === 'mysql') {
      tableNameLengthLimit = 64; // MySQL限制
    } else if (sqlClientType === 'pg') {
      tableNameLengthLimit = 63; // PostgreSQL限制
    } else if (sqlClientType === 'mssql') {
      tableNameLengthLimit = 128; // MSSQL限制
    }

    // 检查表名长度是否超出限制
    if (body.view_name.length > tableNameLengthLimit) {
      NcError.badRequest(
        `Table name exceeds ${tableNameLengthLimit} characters`,
      );
    }

    // 执行视图创建操作
    // TODO - 重新实现此功能
    await sqlMgr.sqlOpPlus(source, 'viewCreate', {
      view_name: body.view_name,
      view_definition: body.view_definition,
    });

    // 获取新创建视图的列信息
    const columns: Array<
      Omit<Column, 'column_name' | 'title'> & {
        cn: string; // 列名
        system?: boolean; // 是否为系统列
      }
    > = (
      await sqlClient.columnList({
        tn: body.view_name, // 表名
        schema: source.getConfig()?.schema, // 模式名
      })
    )?.data?.list;

    // 获取当前所有表，用于确定新视图的顺序
    const tables = await Model.list(context, {
      base_id: base.id,
      source_id: source.id,
    });

    // 映射默认显示值
    mapDefaultDisplayValue(columns);

    // 在模型表中插入新视图记录
    const model = await Model.insert(context, base.id, source.id, {
      table_name: body.view_name,
      title: getTableNameAlias(body.view_name, base.prefix, source),
      type: ModelTypes.VIEW, // 类型为视图
      order: +(tables?.pop()?.order ?? 0) + 1, // 设置顺序为最后一个表的顺序+1
      user_id: param.user.id, // 创建者ID
    });

    // 初始化列顺序
    let colOrder = 1;

    // 为每个列创建记录
    for (const column of columns) {
      await Column.insert(context, {
        fk_model_id: model.id, // 关联到新创建的模型
        ...column, // 包含列的所有属性
        title: getColumnNameAlias(column.cn, source), // 设置列标题
        order: colOrder++, // 设置列顺序并递增
        uidt: getColumnUiType(source, column), // 设置UI类型
      });
    }

    // 返回创建的模型信息
    return await Model.get(context, model.id);
  }
}
