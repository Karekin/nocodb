// 导入所需的 NestJS 装饰器和类型
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
// 导入 nanoid 的 customAlphabet 函数，用于生成唯一标识符
import { customAlphabet } from 'nanoid';
// 导入 OnModuleDestroy 接口类型，用于实现模块销毁时的清理逻辑
import type { OnModuleDestroy } from '@nestjs/common';
// 导入 Express 的 Response 类型
import type { Response } from 'express';
// 导入通知服务
import { NotificationsService } from '~/services/notifications/notifications.service';
// 导入全局守卫
import { GlobalGuard } from '~/guards/global/global.guard';
// 导入属性提取辅助函数
import { extractProps } from '~/helpers/extractProps';
// 导入 API 限流守卫
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
// 导入自定义请求接口
import { NcRequest } from '~/interface/config';
// 导入 Redis 发布订阅服务
import { PubSubRedis } from '~/redis/pubsub-redis';
// 导入访问控制中间件
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';

// 创建一个自定义的 nanoid 生成器，使用指定字符集和长度为14
const nanoidv2 = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyz', 14);
// 定义轮询间隔时间为30秒
const POLL_INTERVAL = 30000;

// 定义控制器
@Controller()
// 应用 API 限流守卫和全局守卫
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
// 导出通知控制器类，并实现 OnModuleDestroy 接口
export class NotificationsController implements OnModuleDestroy {
  // 构造函数，注入通知服务
  constructor(private readonly notificationsService: NotificationsService) {}

  // 当模块被销毁时执行的方法
  onModuleDestroy() {
    // 遍历所有连接
    for (const [_, res] of this.notificationsService.connections) {
      // 对每个响应对象发送刷新状态
      res.forEach((r) => {
        // 检查头部是否已发送
        if (!r.headersSent) {
          // 发送刷新状态
          r.send({
            status: 'refresh',
          });
        }
      });
    }
  }

  // 定义通知轮询接口
  @Get('/api/v1/notifications/poll')
  // 应用访问控制，范围为组织级别
  @Acl('notification', {
    scope: 'org',
  })
  // 通知轮询方法
  async notificationPoll(
    // 注入请求对象
    @Req() req: NcRequest,
    // 注入响应对象，并扩展类型包含 resId 属性
    @Res()
    res: Response & {
      resId: string;
    },
  ) {
    // 设置缓存控制头，禁止缓存并要求重新验证
    res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    // 为响应对象分配唯一标识符
    res.resId = nanoidv2();

    // 将用户连接添加到通知服务
    this.notificationsService.addConnection(req.user.id, res);

    // 声明取消订阅回调函数
    let unsubscribeCallback: (keepRedisChannel?: boolean) => Promise<void> =
      null;

    // 检查 Redis 发布订阅服务是否可用
    if (PubSubRedis.available) {
      // 订阅用户的通知频道
      unsubscribeCallback = await PubSubRedis.subscribe(
        `notification:${req.user.id}`,
        async (data) => {
          // 收到数据时发送给用户的所有连接
          this.notificationsService.sendToConnections(req.user.id, data);
        },
      );
    }

    // 监听连接关闭事件
    res.on('close', async () => {
      // 移除用户连接并执行取消订阅回调
      await this.notificationsService.removeConnection(
        req.user.id,
        res,
        unsubscribeCallback,
      );
    });

    // 设置超时，在指定时间后发送刷新状态
    setTimeout(() => {
      // 检查头部是否已发送
      if (!res.headersSent) {
        // 发送刷新状态
        res.send({
          status: 'refresh',
        });
      }
    }, POLL_INTERVAL).unref();
  }

  // 定义获取通知列表接口
  @Get('/api/v1/notifications')
  // 应用访问控制，范围为组织级别
  @Acl('notification', {
    scope: 'org',
  })
  // 获取通知列表方法
  async notificationList(@Req() req: NcRequest) {
    // 调用通知服务的列表方法，传入用户信息和查询参数
    return this.notificationsService.notificationList({
      user: req.user,
      is_deleted: false,
      ...req.query,
      is_read: req.query.is_read === 'true',
    });
  }

  // 定义更新通知接口
  @Patch('/api/v1/notifications/:notificationId')
  // 应用访问控制，范围为组织级别
  @Acl('notification', {
    scope: 'org',
  })
  // 更新通知方法
  async notificationUpdate(
    // 注入通知ID参数
    @Param('notificationId') notificationId,
    // 注入请求体
    @Body() body,
    // 注入请求对象
    @Req() req: NcRequest,
  ) {
    // 调用通知服务的更新方法
    return this.notificationsService.notificationUpdate({
      notificationId,
      // 提取请求体中的 is_read 属性
      body: extractProps(body, ['is_read']),
      user: req.user,
    });
  }

  // 定义删除通知接口
  @Delete('/api/v1/notifications/:notificationId')
  // 应用访问控制，范围为组织级别
  @Acl('notification', {
    scope: 'org',
  })
  // 删除通知方法
  async notificationDelete(
    // 注入通知ID参数
    @Param('notificationId') notificationId,
    // 注入请求对象
    @Req() req: NcRequest,
  ) {
    // 调用通知服务的删除方法
    return this.notificationsService.notificationDelete({
      notificationId,
      user: req.user,
    });
  }

  // 定义标记所有通知为已读接口
  @Post('/api/v1/notifications/mark-all-read')
  // 应用访问控制，范围为组织级别
  @Acl('notification', {
    scope: 'org',
  })
  // 设置HTTP状态码为200
  @HttpCode(200)
  // 标记所有通知为已读方法
  async markAllRead(@Req() req: NcRequest) {
    // 调用通知服务的标记所有已读方法
    return this.notificationsService.markAllRead({
      user: req.user,
    });
  }
}
