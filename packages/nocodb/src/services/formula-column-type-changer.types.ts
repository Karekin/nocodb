// 导入基础数据库模型类型
import type { BaseModelSqlv2 } from 'src/db/BaseModelSqlv2';
// 导入列请求类型、上下文、请求对象和用户类型
import type { ColumnReqType, NcContext, NcRequest, UserType } from 'nocodb-sdk';
// 导入列模型类型
import type { Column } from '~/models';
// 导入可重用参数类型
import type { ReusableParams } from '~/services/columns.service.type';

// 定义公式列类型转换器接口
export interface IFormulaColumnTypeChanger {
  // 开始更改公式列类型的方法
  startChangeFormulaColumnType(
    // 上下文参数
    context: NcContext,
    // 方法所需参数对象
    params: {
      // 请求对象
      req: NcRequest;
      // 要修改的公式列
      formulaColumn: Column;
      // 执行操作的用户
      user: UserType;
      // 可选的可重用参数
      reuse?: ReusableParams;
      // 新列的请求配置，包含可选的列选项
      newColumnRequest: ColumnReqType & { colOptions?: any };
    },
  ): Promise<void>;

  // 开始迁移数据的方法
  startMigrateData(
    // 上下文参数
    context: NcContext,
    // 方法所需参数对象
    {
      // 源公式列
      formulaColumn,
      // 目标列
      destinationColumn,
      // 可选的基础数据模型
      baseModel,
    }: {
      formulaColumn: Column;
      destinationColumn: Column;
      baseModel?: BaseModelSqlv2;
    },
  ): Promise<void>;
}
