// 导入Node.js进程模块
import process from 'process';
// 导入NestJS依赖注入和日志模块
import { Injectable, Logger } from '@nestjs/common';
// 导入HTTP请求库
import axios from 'axios';
// 导入版本比较工具
import { compareVersions, validate } from 'compare-versions';
// 导入视图类型枚举
import { ViewTypes } from 'nocodb-sdk';
// 导入NestJS配置服务
import { ConfigService } from '@nestjs/config';
// 导入请求过滤代理
import { useAgent } from 'request-filtering-agent';
// 导入日期处理库
import dayjs from 'dayjs';
// 导入错误报告请求类型
import type { ErrorReportReqType } from 'nocodb-sdk';
// 导入应用配置和请求接口类型
import type { AppConfig, NcRequest } from '~/interface/config';
// 导入常量定义
import {
  NC_APP_SETTINGS,
  NC_ATTACHMENT_FIELD_SIZE,
  NC_MAX_ATTACHMENTS_ALLOWED,
} from '~/constants';
// 导入SQL管理器
import SqlMgrv2 from '~/db/sql-mgr/v2/SqlMgrv2';
// 导入错误处理助手
import { NcError } from '~/helpers/catchError';
// 导入数据模型
import { Base, Store, User } from '~/models';
// 导入Noco主类
import Noco from '~/Noco';
// 导入工具函数
import { isOnPrem, T } from '~/utils';
// 导入连接管理器
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
// 导入实例获取函数
import getInstance from '~/utils/getInstance';
// 导入全局常量和枚举
import { CacheScope, MetaTable, RootScopes } from '~/utils/globals';
// 导入JDBC配置转换助手
import { jdbcToXcConfig } from '~/utils/nc-config/helpers';
// 导入包版本信息
import { packageVersion } from '~/utils/packageVersion';
// 导入分页和限制配置
import {
  defaultGroupByLimitConfig,
  defaultLimitConfig,
} from '~/helpers/extractLimitAndOffset';
// 导入驱动客户端枚举
import { DriverClient } from '~/utils/nc-config';
// 导入缓存模块
import NocoCache from '~/cache/NocoCache';
// 导入循环引用处理函数
import { getCircularReplacer } from '~/utils';

// 版本缓存对象
const versionCache = {
  releaseVersion: null,
  lastFetched: null,
};

// 默认数据库连接配置
const defaultConnectionConfig: any = {
  // https://github.com/knex/knex/issues/97
  // timezone: process.env.NC_TIMEZONE || 'UTC',
  dateStrings: true,
};

// 视图计数接口定义
interface ViewCount {
  formCount: number | null;
  gridCount: number | null;
  galleryCount: number | null;
  kanbanCount: number | null;
  total: number | null;
  sharedFormCount: number | null;
  sharedGridCount: number | null;
  sharedGalleryCount: number | null;
  sharedKanbanCount: number | null;
  sharedTotal: number | null;
  sharedLockedCount: number | null;
}

// 元数据统计接口定义
interface AllMeta {
  baseCount: number;
  bases: (
    | {
        external?: boolean | null;
        tableCount: {
          table: number;
          view: number;
        } | null;
        viewCount: ViewCount;
        webhookCount: number | null;
        filterCount: number | null;
        sortCount: number | null;
        rowCount: ({ totalRecords: number } | null)[] | null;
        userCount: number | null;
      }
    | { error: string }
  )[];
  userCount: number;
  sharedBaseCount: number;
}

// 工具服务类，使用NestJS依赖注入装饰器
@Injectable()
export class UtilsService {
  // 创建日志记录器
  protected logger = new Logger(UtilsService.name);

  // 构造函数，注入配置服务
  constructor(protected readonly configService: ConfigService<AppConfig>) {}

  // 上次同步时间
  lastSyncTime = null;

  // 获取版本信息
  async versionInfo() {
    // 如果缓存不存在或已过期（1小时）
    if (
      !versionCache.lastFetched ||
      (versionCache.lastFetched &&
        versionCache.lastFetched < Date.now() - 1000 * 60 * 60)
    ) {
      // 从GitHub获取标签信息
      const nonBetaTags = await axios
        .get('https://api.github.com/repos/nocodb/nocodb/tags', {
          timeout: 5000,
        })
        .then((response) => {
          // 过滤并排序标签
          return response.data
            .map((x) => x.name)
            .filter(
              (v) => validate(v) && !v.includes('finn') && !v.includes('beta'),
            )
            .sort((x, y) => compareVersions(y, x));
        })
        .catch(() => null);
      // 如果获取到标签，更新缓存
      if (nonBetaTags && nonBetaTags.length > 0) {
        versionCache.releaseVersion = nonBetaTags[0];
      }
      // 更新最后获取时间
      versionCache.lastFetched = Date.now();
    }

    // 返回版本信息
    const response = {
      currentVersion: packageVersion,
      releaseVersion: versionCache.releaseVersion,
    };

    return response;
  }

  // 应用健康检查
  async appHealth() {
    return {
      message: 'OK',
      timestamp: Date.now(),
      uptime: process.uptime(),
    };
  }

  // 内部Axios请求处理函数
  async _axiosRequestMake(param: {
    body: {
      apiMeta: any;
    };
  }) {
    const { apiMeta } = param.body;

    // 尝试解析请求体JSON
    if (apiMeta?.body) {
      try {
        apiMeta.body = JSON.parse(apiMeta.body);
      } catch (e) {
        console.log(e);
      }
    }

    // 尝试解析认证信息JSON
    if (apiMeta?.auth) {
      try {
        apiMeta.auth = JSON.parse(apiMeta.auth);
      } catch (e) {
        console.log(e);
      }
    }

    // 初始化响应对象
    apiMeta.response = {};
    // 构建请求配置
    const _req = {
      // 处理URL参数
      params: apiMeta.parameters
        ? apiMeta.parameters.reduce((paramsObj, param) => {
            if (param.name && param.enabled) {
              paramsObj[param.name] = param.value;
            }
            return paramsObj;
          }, {})
        : {},
      url: apiMeta.url,
      method: apiMeta.method || 'GET',
      data: apiMeta.body || {},
      // 处理请求头
      headers: apiMeta.headers
        ? apiMeta.headers.reduce((headersObj, header) => {
            if (header.name && header.enabled) {
              headersObj[header.name] = header.value;
            }
            return headersObj;
          }, {})
        : {},
      responseType: apiMeta.responseType || 'json',
      withCredentials: true,
      // 使用安全代理防止端口扫描
      httpAgent: useAgent(apiMeta.url, {
        stopPortScanningByUrlRedirection: true,
      }),
      httpsAgent: useAgent(apiMeta.url, {
        stopPortScanningByUrlRedirection: true,
      }),
    };
    // 发送请求并返回数据
    const data = await axios(_req);
    return data?.data;
  }

  // 公开的Axios请求处理函数
  async axiosRequestMake(param: {
    body: {
      apiMeta: any;
    };
  }) {
    const {
      apiMeta: { url },
    } = param.body;
    // 定义Excel导入正则表达式
    const isExcelImport = /.*\.(xls|xlsx|xlsm|ods|ots)/;
    // 定义CSV导入正则表达式
    const isCSVImport = /.*\.(csv)/;
    // 定义IP地址黑名单正则表达式
    const ipBlockList =
      /(10)(\.([2]([0-5][0-5]|[01234][6-9])|[1][0-9][0-9]|[1-9][0-9]|[0-9])){3}|(172)\.(1[6-9]|2[0-9]|3[0-1])(\.(2[0-4][0-9]|25[0-5]|[1][0-9][0-9]|[1-9][0-9]|[0-9])){2}|(192)\.(168)(\.(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])){2}|(0.0.0.0)|localhost?/g;
    // 如果URL在黑名单中或不是CSV/Excel导入，返回空对象
    if (
      ipBlockList.test(url) ||
      (!isCSVImport.test(url) && !isExcelImport.test(url))
    ) {
      return {};
    }
    // 如果是CSV或Excel导入，设置响应类型为二进制数组
    if (isCSVImport || isExcelImport) {
      param.body.apiMeta.responseType = 'arraybuffer';
    }
    // 调用内部请求函数
    return await this._axiosRequestMake({
      body: param.body,
    });
  }

  // 将JDBC URL转换为数据库配置
  async urlToDbConfig(param: {
    body: {
      url: string;
    };
  }) {
    const { url } = param.body;
    try {
      // 转换JDBC URL为配置对象
      const connectionConfig = jdbcToXcConfig(url);
      return connectionConfig;
    } catch (error) {
      // 返回错误信息
      return NcError.internalServerError(
        'Please check server log for more details',
      );
    }
  }

  // 聚合元数据信息
  async aggregatedMetaInfo() {
    // TODO: fix or deprecate for EE
    // 并行获取基础和用户数量
    const [bases, userCount] = await Promise.all([
      Base.list(),
      Noco.ncMeta.metaCount(RootScopes.ROOT, RootScopes.ROOT, MetaTable.USERS),
    ]);

    // 初始化结果对象
    const result: AllMeta = {
      baseCount: bases.length,
      bases: [],
      userCount,
      sharedBaseCount: 0,
    };

    // 添加基础信息到结果
    result.bases.push(
      ...this.extractResultOrNull(
        await Promise.allSettled(
          bases.map(async (base) => {
            // 如果基础有UUID，增加共享计数
            if (base.uuid) result.sharedBaseCount++;
            // 并行获取各种计数信息
            const [
              tableCount,
              dbViewCount,
              viewCount,
              webhookCount,
              filterCount,
              sortCount,
              rowCount,
              userCount,
            ] = this.extractResultOrNull(
              await Promise.allSettled([
                // 数据库表计数
                Noco.ncMeta.metaCount(
                  base.fk_workspace_id,
                  base.id,
                  MetaTable.MODELS,
                  {
                    condition: {
                      type: 'table',
                    },
                  },
                ),
                // 数据库视图计数
                Noco.ncMeta.metaCount(
                  base.fk_workspace_id,
                  base.id,
                  MetaTable.MODELS,
                  {
                    condition: {
                      type: 'view',
                    },
                  },
                ),
                // 视图计数
                (async () => {
                  // 获取所有视图
                  const views = await Noco.ncMeta.metaList2(
                    base.fk_workspace_id,
                    base.id,
                    MetaTable.VIEWS,
                  );
                  // 计算网格、表单、画廊、看板和共享计数
                  return (views as any[]).reduce<ViewCount>(
                    (out, view) => {
                      out.total++;

                      // 根据视图类型增加相应计数
                      switch (view.type) {
                        case ViewTypes.GRID:
                          out.gridCount++;
                          if (view.uuid) out.sharedGridCount++;
                          break;
                        case ViewTypes.FORM:
                          out.formCount++;
                          if (view.uuid) out.sharedFormCount++;
                          break;
                        case ViewTypes.GALLERY:
                          out.galleryCount++;
                          if (view.uuid) out.sharedGalleryCount++;
                          break;
                        case ViewTypes.KANBAN:
                          out.kanbanCount++;
                          if (view.uuid) out.sharedKanbanCount++;
                      }

                      // 如果视图有UUID，增加共享计数
                      if (view.uuid) {
                        if (view.password) out.sharedLockedCount++;
                        out.sharedTotal++;
                      }

                      return out;
                    },
                    {
                      formCount: 0,
                      gridCount: 0,
                      galleryCount: 0,
                      kanbanCount: 0,
                      total: 0,
                      sharedFormCount: 0,
                      sharedGridCount: 0,
                      sharedGalleryCount: 0,
                      sharedKanbanCount: 0,
                      sharedTotal: 0,
                      sharedLockedCount: 0,
                    },
                  );
                })(),
                // Webhook计数
                Noco.ncMeta.metaCount(
                  base.fk_workspace_id,
                  base.id,
                  MetaTable.HOOKS,
                ),
                // 过滤器计数
                Noco.ncMeta.metaCount(
                  base.fk_workspace_id,
                  base.id,
                  MetaTable.FILTER_EXP,
                ),
                // 排序计数
                Noco.ncMeta.metaCount(
                  base.fk_workspace_id,
                  base.id,
                  MetaTable.SORT,
                ),
                // 每个基础的行计数
                base.getSources().then(async (sources) => {
                  return this.extractResultOrNull(
                    await Promise.allSettled(
                      sources.map(async (source) =>
                        (await NcConnectionMgrv2.getSqlClient(source))
                          .totalRecords?.()
                          ?.then((result) => result?.data),
                      ),
                    ),
                  );
                }),
                // 基础用户计数
                Noco.ncMeta.metaCount(
                  base.fk_workspace_id,
                  base.id,
                  MetaTable.PROJECT_USERS,
                  {
                    condition: {
                      base_id: base.id,
                    },
                    aggField: '*',
                  },
                ),
              ]),
            );

            // 返回基础的统计信息
            return {
              tableCount: { table: tableCount, view: dbViewCount },
              external: !base.is_meta,
              viewCount,
              webhookCount,
              filterCount,
              sortCount,
              rowCount,
              userCount,
            };
          }),
        ),
      ),
    );

    return result;
  }

  // 从Promise结果中提取值或返回null
  extractResultOrNull = (results: PromiseSettledResult<any>[]) => {
    return results.map((result) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }
      return null;
    });
  };

  // 测试数据库连接
  async testConnection(param: { body: any }) {
    return await SqlMgrv2.testConnection(param.body);
  }

  // 获取应用信息
  async appInfo(param: { req: { ncSiteUrl: string } }) {
    // 检查是否有管理员用户
    const baseHasAdmin = !(await User.isFirst());
    // 获取实例信息
    const instance = await getInstance();

    // 获取应用设置
    let settings: { invite_only_signup?: boolean } = {};
    try {
      settings = JSON.parse((await Store.get(NC_APP_SETTINGS, true))?.value);
    } catch {}

    // 检查OpenID Connect认证是否启用
    const oidcAuthEnabled = ['openid', 'oidc'].includes(
      process.env.NC_SSO?.toLowerCase(),
    );
    // 获取OIDC提供商名称
    const oidcProviderName = oidcAuthEnabled
      ? process.env.NC_OIDC_PROVIDER_NAME ?? 'OpenID Connect'
      : null;

    // 礼品URL
    let giftUrl: string;

    // 如果影响用户数大于等于5，生成礼品URL
    if (instance.impacted >= 5) {
      giftUrl = `https://w21dqb1x.nocodb.com/#/nc/form/4d2e0e4b-df97-4c5e-ad8e-f8b8cca90330?Users=${
        instance.impacted
      }&Bases=${instance.projectsExt + instance.projectsMeta}`;
    }

    // 检查SAML认证是否启用
    const samlAuthEnabled = process.env.NC_SSO?.toLowerCase() === 'saml';
    // 获取SAML提供商名称
    const samlProviderName = samlAuthEnabled
      ? process.env.NC_SSO_SAML_PROVIDER_NAME ?? 'SAML'
      : null;

    // 构建结果对象
    const result = {
      authType: 'jwt',
      baseHasAdmin,
      firstUser: !baseHasAdmin,
      type: 'rest',
      env: process.env.NODE_ENV,
      // 检查Google认证是否启用
      googleAuthEnabled: !!(
        process.env.NC_GOOGLE_CLIENT_ID && process.env.NC_GOOGLE_CLIENT_SECRET
      ),
      // 检查GitHub认证是否启用
      githubAuthEnabled: !!(
        process.env.NC_GITHUB_CLIENT_ID && process.env.NC_GITHUB_CLIENT_SECRET
      ),
      oidcAuthEnabled,
      oidcProviderName,
      // 检查一键部署是否启用
      oneClick: !!process.env.NC_ONE_CLICK,
      // 检查是否允许连接外部数据库
      connectToExternalDB: !process.env.NC_CONNECT_TO_EXTERNAL_DB_DISABLED,
      version: packageVersion,
      // 计算默认限制
      defaultLimit: Math.max(
        Math.min(defaultLimitConfig.limitDefault, defaultLimitConfig.limitMax),
        defaultLimitConfig.limitMin,
      ),
      defaultGroupByLimit: defaultGroupByLimitConfig,
      timezone: defaultConnectionConfig.timezone,
      // 检查是否为最小化版本
      ncMin: !!process.env.NC_MIN,
      // 检查遥测是否启用
      teleEnabled: process.env.NC_DISABLE_TELE !== 'true',
      // 检查错误报告是否启用
      errorReportingEnabled: process.env.NC_DISABLE_ERR_REPORTS !== 'true',
      // 获取Sentry DSN
      sentryDSN:
        process.env.NC_DISABLE_ERR_REPORTS !== 'true'
          ? process.env.NC_SENTRY_DSN
          : null,
      // 检查审计是否启用
      auditEnabled: process.env.NC_DISABLE_AUDIT !== 'true',
      ncSiteUrl: (param.req as any).ncSiteUrl,
      // 检查是否为企业版
      ee: Noco.isEE(),
      ncAttachmentFieldSize: NC_ATTACHMENT_FIELD_SIZE,
      ncMaxAttachmentsAllowed: NC_MAX_ATTACHMENTS_ALLOWED,
      // 检查是否为云版本
      isCloud: process.env.NC_CLOUD === 'true',
      // 获取自动化日志级别
      automationLogLevel: process.env.NC_AUTOMATION_LOG_LEVEL || 'OFF',
      baseHostName: process.env.NC_BASE_HOST_NAME,
      // 检查是否禁用邮箱认证
      disableEmailAuth: this.configService.get('auth.disableEmailAuth', {
        infer: true,
      }),
      // 检查产品Feed是否启用
      feedEnabled: process.env.NC_DISABLE_PRODUCT_FEED !== 'true',
      // 获取主子域名
      mainSubDomain: this.configService.get('mainSubDomain', { infer: true }),
      // 获取仪表盘路径
      dashboardPath: this.configService.get('dashboardPath', { infer: true }),
      // 检查是否仅邀请注册
      inviteOnlySignup: settings.invite_only_signup,
      samlProviderName,
      samlAuthEnabled,
      giftUrl,
      // 检查是否生产就绪
      prodReady: Noco.getConfig()?.meta?.db?.client !== DriverClient.SQLITE,
      isOnPrem,
    };

    return result;
  }

  // 报告错误
  async reportErrors(param: { body: ErrorReportReqType; req: NcRequest }) {
    // 遍历错误并发送事件
    for (const error of param.body?.errors ?? []) {
      T.emit('evt', {
        evt_type: 'gui:error',
        properties: {
          message: error.message,
          // 获取堆栈前两行
          stack: error.stack?.split('\n').slice(0, 2).join('\n'),
          ...(param.body.extra || {}),
        },
      });
    }
  }

  // 获取产品Feed
  async feed(req: NcRequest) {
    // 从请求中获取参数
    const {
      type = 'all',
      page = '1',
      per_page = '10',
    } = req.query as {
      type: 'github' | 'youtube' | 'all' | 'twitter' | 'cloud';
      page: string;
      per_page: string;
    };

    // 处理分页参数
    const perPage = Math.min(Math.max(parseInt(per_page, 10) || 10, 1), 100);
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);

    // 构建缓存键
    const cacheKey = `${CacheScope.PRODUCT_FEED}:${type}:${pageNum}:${perPage}`;

    // 尝试从缓存获取数据
    const cachedData = await NocoCache.get(cacheKey, 'json');

    // 如果缓存存在，返回缓存数据
    if (cachedData) {
      try {
        return JSON.parse(cachedData);
      } catch (e) {
        // 如果解析失败，记录错误并删除缓存
        this.logger.error(e?.message, e);
        await NocoCache.del(cacheKey);
      }
    }

    // 获取负载数据
    let payload = null;
    // 如果上次同步时间为空或超过3小时，重新获取负载
    if (
      !this.lastSyncTime ||
      dayjs().isAfter(this.lastSyncTime.add(3, 'hours'))
    ) {
      payload = await T.payload();
      this.lastSyncTime = dayjs();
    }

    let response;

    // 尝试获取Feed数据
    try {
      response = await axios.post(
        'https://product-feed.nocodb.com/api/v1/social/feed',
        payload,
        {
          params: {
            per_page: perPage,
            page: pageNum,
            type,
          },
        },
      );
    } catch (e) {
      // 如果请求失败，记录错误并返回空数组
      this.logger.error(e?.message, e);
      return [];
    }

    // Feed包含附件，附件有预签名URL
    // 所以缓存应该匹配预签名URL缓存
    await NocoCache.setExpiring(
      cacheKey,
      JSON.stringify(response.data, getCircularReplacer),
      Number.isNaN(parseInt(process.env.NC_ATTACHMENT_EXPIRE_SECONDS))
        ? 2 * 60 * 60
        : parseInt(process.env.NC_ATTACHMENT_EXPIRE_SECONDS),
    );

    // 返回Feed数据
    return response.data;
  }
}
