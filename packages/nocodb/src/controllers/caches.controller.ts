// 导入所需的 NestJS 装饰器：Controller（控制器）、Delete（删除请求）、Get（获取请求）和 UseGuards（使用守卫）
import { Controller, Delete, Get, UseGuards } from '@nestjs/common';
// 导入组织用户角色枚举
import { OrgUserRoles } from 'nocodb-sdk';
// 导入缓存服务
import { CachesService } from '~/services/caches.service';
// 导入全局守卫
import { GlobalGuard } from '~/guards/global/global.guard';
// 导入访问控制中间件
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
// 导入元数据 API 限制器守卫
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';

// 声明这是一个控制器类
@Controller()
// 使用 MetaApiLimiterGuard 和 GlobalGuard 作为该控制器的守卫
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class CachesController {
  // 构造函数，注入 CachesService 服务
  constructor(private readonly cachesService: CachesService) {}

  // 定义 GET 请求路由，支持 v1 和 v2 两个版本的 API
  @Get(['/api/v1/db/meta/cache', '/api/v2/meta/cache'])
  // 设置访问控制，指定操作名称为 'cacheGet'，作用域为组织级别，
  // 只允许超级管理员访问，并禁止 API 令牌访问
  @Acl('cacheGet', {
    scope: 'org',
    allowedRoles: [OrgUserRoles.SUPER_ADMIN],
    blockApiTokenAccess: true,
  })
  // 获取缓存数据的方法，接收请求和响应对象作为参数
  async cacheGet(_, res) {
    // 调用服务层方法获取缓存数据
    const data = await this.cachesService.cacheGet();
    // 设置响应头，指定内容类型为 JSON，并设置下载文件名
    res.set({
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="cache-export.json"`,
    });
    // 将数据转换为 JSON 字符串并返回
    return JSON.stringify(data);
  }

  // 定义 DELETE 请求路由，支持 v1 和 v2 两个版本的 API
  @Delete(['/api/v1/db/meta/cache', '/api/v2/meta/cache'])
  // 设置访问控制，指定操作名称为 'cacheDelete'，作用域为组织级别，
  // 只允许超级管理员访问，并禁止 API 令牌访问
  @Acl('cacheDelete', {
    scope: 'org',
    allowedRoles: [OrgUserRoles.SUPER_ADMIN],
    blockApiTokenAccess: true,
  })
  // 删除缓存数据的方法
  async cacheDelete() {
    // 调用服务层方法删除缓存并返回结果
    return await this.cachesService.cacheDelete();
  }
}
