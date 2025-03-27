// 导入 NestJS 的 Injectable 装饰器，用于声明该类可以被依赖注入系统管理
import { Injectable } from '@nestjs/common';
// 导入许可证密钥常量
import { NC_LICENSE_KEY } from '../constants';
// 导入验证负载的辅助函数
import { validatePayload } from '~/helpers';
// 导入 Noco 主类，用于加载企业版状态
import Noco from '~/Noco';
// 导入 Store 模型，用于存储和检索数据
import { Store } from '~/models';

// 使用 Injectable 装饰器标记该服务，使其可以被 NestJS 依赖注入系统管理
@Injectable()
export class OrgLcenseService {
  /**
   * 获取许可证信息
   * @returns 包含许可证密钥的对象
   */
  async licenseGet() {
    // 从存储中获取许可证信息
    const license = await Store.get(NC_LICENSE_KEY);

    // 返回许可证密钥
    return { key: license?.value };
  }

  /**
   * 设置许可证信息
   * @param param 包含许可证密钥的对象
   * @returns 操作成功返回 true
   */
  async licenseSet(param: { key: string }) {
    // 验证请求参数是否符合 swagger 定义的 LicenseReq 模式
    validatePayload('swagger.json#/components/schemas/LicenseReq', param);

    // 保存或更新许可证信息到存储中
    await Store.saveOrUpdate({ value: param.key, key: NC_LICENSE_KEY });
    // 重新加载企业版状态，以应用新的许可证
    await Noco.loadEEState();
    // 操作成功返回 true
    return true;
  }
}
