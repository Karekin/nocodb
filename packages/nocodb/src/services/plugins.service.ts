// 导入必要的依赖
import { Injectable } from '@nestjs/common'; // 导入 NestJS 的 Injectable 装饰器，用于依赖注入
import { AppEvents } from 'nocodb-sdk'; // 导入应用事件枚举
import type { PluginTestReqType, PluginType } from 'nocodb-sdk'; // 导入插件相关的类型定义
import type { NcRequest } from '~/interface/config'; // 导入请求接口类型
import { AppHooksService } from '~/services/app-hooks/app-hooks.service'; // 导入应用钩子服务
import { validatePayload } from '~/helpers'; // 导入负载验证辅助函数
import NcPluginMgrv2 from '~/helpers/NcPluginMgrv2'; // 导入插件管理器
import { Plugin } from '~/models'; // 导入插件模型

@Injectable() // 标记该类为可注入服务
export class PluginsService {
  // 构造函数，注入 AppHooksService 依赖
  constructor(private readonly appHooksService: AppHooksService) {}

  /**
   * 获取所有插件列表
   * @returns 返回所有插件的列表
   */
  async pluginList() {
    return await Plugin.list();
  }

  /**
   * 测试插件功能
   * @param param 包含请求体和请求对象的参数
   * @returns 返回测试结果
   */
  async pluginTest(param: { body: PluginTestReqType; req: NcRequest }) {
    // 验证请求体是否符合 Swagger 定义的 PluginTestReq 模式
    validatePayload(
      'swagger.json#/components/schemas/PluginTestReq',
      param.body,
    );

    // 触发插件测试事件
    this.appHooksService.emit(AppEvents.PLUGIN_TEST, {
      testBody: param.body,
      req: param.req,
    });
    // 调用插件管理器的测试方法
    return await NcPluginMgrv2.test(param.body);
  }

  /**
   * 读取特定插件信息
   * @param param 包含插件ID的参数
   * @returns 返回指定插件的详细信息
   */
  async pluginRead(param: { pluginId: string }) {
    return await Plugin.get(param.pluginId);
  }

  /**
   * 更新插件信息
   * @param param 包含插件ID、插件数据和请求对象的参数
   * @returns 返回更新后的插件信息
   */
  async pluginUpdate(param: {
    pluginId: string;
    plugin: PluginType;
    req: NcRequest;
  }) {
    // 验证插件数据是否符合 Swagger 定义的 PluginReq 模式
    validatePayload('swagger.json#/components/schemas/PluginReq', param.plugin);

    // 更新插件信息
    const plugin = await Plugin.update(param.pluginId, param.plugin);

    // 根据插件是否激活触发相应的事件（安装或卸载）
    this.appHooksService.emit(
      plugin.active ? AppEvents.PLUGIN_INSTALL : AppEvents.PLUGIN_UNINSTALL,
      {
        plugin,
        req: param.req,
      },
    );

    return plugin;
  }

  /**
   * 检查插件是否处于激活状态
   * @param param 包含插件ID的参数
   * @returns 返回插件的激活状态
   */
  async isPluginActive(param: { pluginId: string }) {
    return await Plugin.isPluginActive(param.pluginId);
  }

  /**
   * 获取所有 Webhook 类型的插件列表
   * 目前包括 Slack、Microsoft Teams、Discord 和 Mattermost
   * @returns 返回所有 Webhook 类型插件的列表
   */
  async webhookPluginList() {
    // 获取所有插件
    const plugins = await Plugin.list();

    // 过滤出特定的 Webhook 插件
    return plugins.filter((p) =>
      ['Slack', 'Microsoft Teams', 'Discord', 'Mattermost'].includes(p.title),
    );
  }
}
