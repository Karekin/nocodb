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
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
// 导入全局守卫
import { GlobalGuard } from '~/guards/global/global.guard';
// 导入分页响应实现类
import { PagedResponseImpl } from '~/helpers/PagedResponse';
// 导入评论服务
import { CommentsService } from '~/services/comments.service';
// 导入访问控制中间件
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
// 导入元数据 API 限制守卫
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
// 导入租户上下文装饰器
import { TenantContext } from '~/decorators/tenant-context.decorator';
// 导入上下文和请求接口类型
import { NcContext, NcRequest } from '~/interface/config';

// 声明这是一个控制器类
@Controller()
// 使用元数据 API 限制守卫和全局守卫
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class CommentsController {
  // 构造函数，注入评论服务
  constructor(protected readonly commentsService: CommentsService) {}

  // 获取评论列表的路由（支持 v1 和 v2 版本）
  @Get(['/api/v1/db/meta/comments', '/api/v2/meta/comments'])
  // 访问控制装饰器，限制评论列表访问权限
  @Acl('commentList')
  async commentList(@TenantContext() context: NcContext, @Req() req: any) {
    // 返回分页后的评论列表数据
    return new PagedResponseImpl(
      await this.commentsService.commentList(context, { query: req.query }),
    );
  }

  // 创建新评论的路由
  @Post(['/api/v1/db/meta/comments', '/api/v2/meta/comments'])
  // 设置 HTTP 响应状态码为 200
  @HttpCode(200)
  // 访问控制装饰器，限制评论创建权限
  @Acl('commentRow')
  async commentRow(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Body() body: any,
  ) {
    // 调用服务创建新评论
    return await this.commentsService.commentRow(context, {
      user: req.user,
      body: body,
      req,
    });
  }

  // 删除评论的路由
  @Delete([
    '/api/v1/db/meta/comment/:commentId',
    '/api/v2/meta/comment/:commentId',
  ])
  // 访问控制装饰器，限制评论删除权限
  @Acl('commentDelete')
  async commentDelete(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('commentId') commentId: string,
  ) {
    // 调用服务删除指定评论
    return await this.commentsService.commentDelete(context, {
      commentId,
      user: req.user,
      req,
    });
  }

  // 更新评论的路由
  @Patch([
    '/api/v1/db/meta/comment/:commentId',
    '/api/v2/meta/comment/:commentId',
  ])
  // 访问控制装饰器，限制评论更新权限
  @Acl('commentUpdate')
  async commentUpdate(
    @TenantContext() context: NcContext,
    @Param('commentId') commentId: string,
    @Req() req: any,
    @Body() body: any,
  ) {
    // 调用服务更新指定评论
    return await this.commentsService.commentUpdate(context, {
      commentId: commentId,
      user: req.user,
      body: body,
      req,
    });
  }

  // 获取评论计数的路由
  @Get(['/api/v1/db/meta/comments/count', '/api/v2/meta/comments/count'])
  // 访问控制装饰器，限制评论计数访问权限
  @Acl('commentsCount')
  async commentsCount(
    @TenantContext() context: NcContext,
    @Query('fk_model_id') fk_model_id: string,
    @Query('ids') ids: string[],
  ) {
    // 调用服务获取指定模型和ID的评论计数
    return await this.commentsService.commentsCount(context, {
      fk_model_id,
      ids,
    });
  }
}
