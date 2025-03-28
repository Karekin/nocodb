// 导入所需的 NestJS 装饰器和类型
import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
// 导入全局守卫
import { GlobalGuard } from '~/guards/global/global.guard';
// 导入分页响应实现类
import { PagedResponseImpl } from '~/helpers/PagedResponse';
// 导入审计服务
import { AuditsService } from '~/services/audits.service';
// 导入访问控制装饰器
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
// 导入元数据 API 限制守卫
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
// 导入请求接口类型
import { NcRequest } from '~/interface/config';

// 声明这是一个控制器类
@Controller()
// 使用元数据 API 限制守卫和全局守卫
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class AuditsController {
  // 构造函数，注入审计服务
  constructor(protected readonly auditsService: AuditsService) {}

  // 定义获取单行审计记录的 GET 路由（支持 v1 和 v2 API）
  @Get(['/api/v1/db/meta/audits/', '/api/v2/meta/audits/'])
  // 添加访问控制，需要 auditListRow 权限
  @Acl('auditListRow')
  async auditListRow(
    // 注入请求对象
    @Req() req: NcRequest,
    // 获取行 ID 查询参数
    @Query('row_id') rowId: string,
    // 获取外键模型 ID 查询参数
    @Query('fk_model_id') fkModelId: string,
    // 获取可选的分页限制参数
    @Query('limit') limit?: number,
    // 获取可选的分页偏移参数
    @Query('offset') offset?: number,
  ) {
    // 返回分页响应
    return new PagedResponseImpl(
      // 获取审计记录列表
      await this.auditsService.auditOnlyList({
        query: {
          row_id: rowId,
          fk_model_id: fkModelId,
          limit,
          offset,
        },
      }),
      {
        // 获取审计记录总数
        count: await this.auditsService.auditOnlyCount({
          query: {
            row_id: rowId,
            fk_model_id: fkModelId,
          },
        }),
        // 展开原始查询参数
        ...req.query,
      },
    );
  }

  // 定义获取基础审计列表的 GET 路由（支持 v1 和 v2 API）
  @Get([
    '/api/v1/db/meta/projects/:baseId/audits/',
    '/api/v2/meta/bases/:baseId/audits/',
  ])
  // 添加访问控制，需要 baseAuditList 权限
  @Acl('baseAuditList')
  async auditList(@Req() req: NcRequest, @Param('baseId') baseId: string) {
    // 返回分页响应
    return new PagedResponseImpl(
      // 获取审计列表
      await this.auditsService.auditList({
        query: req.query,
        baseId,
      }),
      {
        // 获取审计记录总数
        count: await this.auditsService.auditCount({
          query: req.query,
          baseId,
        }),
        // 展开原始查询参数
        ...req.query,
      },
    );
  }

  // 定义获取项目审计列表的 GET 路由（支持 v1 和 v2 API）
  @Get(['/api/v1/db/meta/projects/audits/', '/api/v2/meta/projects/audits/'])
  // 添加访问控制，需要 projectAuditList 权限
  @Acl('projectAuditList')
  async projectAuditList(@Req() req: NcRequest) {
    // 返回分页响应
    return new PagedResponseImpl(
      // 获取项目审计列表
      await this.auditsService.projectAuditList({
        query: req.query,
      }),
      {
        // 获取项目审计记录总数
        count: await this.auditsService.projectAuditCount(),
        // 展开原始查询参数
        ...req.query,
      },
    );
  }
}
