// 从 @nestjs/common 导入所需的装饰器和类型
import { Controller, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
// 从 nocodb-sdk 导入用户类型定义
import type { UserType } from 'nocodb-sdk';
// 导入全局守卫
import { GlobalGuard } from '~/guards/global/global.guard';
// 导入命令面板服务
import { CommandPaletteService } from '~/services/command-palette.service';
// 导入访问控制中间件
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
// 导入 API 限流守卫
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
// 导入请求接口定义
import { NcRequest } from '~/interface/config';

// 声明这是一个控制器类
@Controller()
// 使用 API 限流守卫和全局守卫
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class CommandPaletteController {
  // 通过依赖注入注入命令面板服务
  constructor(private commandPaletteService: CommandPaletteService) {}

  // 定义 POST 请求路由
  @Post('/api/v1/command_palette')
  // 设置访问控制，作用域为组织级别
  @Acl('commandPalette', {
    scope: 'org',
  })
  // 设置响应状态码为 200
  @HttpCode(200)
  // 处理命令面板请求的异步方法
  async commandPalette(@Req() req: NcRequest) {
    // 调用服务层方法处理命令面板请求
    const data = this.commandPaletteService.commandPalette({
      user: req?.user as UserType,
      body: req.body,
    });

    // 返回处理结果
    return data;
  }
}
