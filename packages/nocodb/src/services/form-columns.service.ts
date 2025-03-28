// 导入 Injectable 装饰器，用于依赖注入
import { Injectable } from '@nestjs/common';
// 导入应用事件枚举
import { AppEvents } from 'nocodb-sdk';
// 导入 NcContext 和 NcRequest 类型定义
import type { NcContext, NcRequest } from '~/interface/config';
// 导入应用钩子服务
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
// 导入验证负载的辅助函数
import { validatePayload } from '~/helpers';
// 导入数据模型：Column, FormViewColumn, View
import { Column, FormViewColumn, View } from '~/models';
// 导入提取属性的辅助函数
import { extractProps } from '~/helpers/extractProps';

// 使用 Injectable 装饰器标记该服务可被依赖注入系统使用
@Injectable()
// 定义表单列服务类
export class FormColumnsService {
  // 构造函数，注入 AppHooksService 依赖
  constructor(private readonly appHooksService: AppHooksService) {}

  // 列更新方法，用于更新表单视图列
  async columnUpdate(
    // 上下文参数
    context: NcContext,
    // 方法参数对象
    param: {
      // 表单视图列 ID
      formViewColumnId: string;
      // todo: 替换为 FormColumnReq
      // 表单视图列对象
      formViewColumn: FormViewColumn;
      // 请求对象
      req: NcRequest;
    },
  ) {
    // 验证请求负载是否符合 FormColumnReq 的 schema 定义
    validatePayload(
      'swagger.json#/components/schemas/FormColumnReq',
      param.formViewColumn,
    );
    // 获取旧的表单视图列数据
    const oldFormViewColumn = await FormViewColumn.get(
      context,
      param.formViewColumnId,
    );

    // 获取关联的视图数据
    const view = await View.get(context, oldFormViewColumn.fk_view_id);

    // 获取关联的列数据
    const column = await Column.get(context, {
      colId: oldFormViewColumn.fk_column_id,
    });

    // 更新表单视图列数据
    const res = await FormViewColumn.update(
      context,
      param.formViewColumnId,
      param.formViewColumn,
    );

    // 触发视图列更新事件
    this.appHooksService.emit(AppEvents.VIEW_COLUMN_UPDATE, {
      // 旧的视图列数据
      oldViewColumn: oldFormViewColumn,
      // 从请求中提取的视图列属性
      viewColumn: extractProps(param.formViewColumn, [
        'label',
        'help',
        'description',
        'required',
        'show',
        'order',
        'meta',
        'enable_scanner',
      ]),
      // 视图数据
      view,
      // 列数据
      column,
      // 请求对象
      req: param.req,
      // 上下文
      context,
    });

    // 返回更新结果
    return res;
  }
}
