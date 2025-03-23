import path from 'path';
import { NestFactory } from '@nestjs/core';
import clear from 'clear';
import * as express from 'express';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import { IoAdapter } from '@nestjs/platform-socket.io';
import requestIp from 'request-ip';
import cookieParser from 'cookie-parser';
import { NcDebug } from '~/utils/debug';
import type { INestApplication } from '@nestjs/common';
import type { MetaService } from '~/meta/meta.service';
import type { IEventEmitter } from '~/modules/event-emitter/event-emitter.interface';
import type { Express } from 'express';
import type http from 'http';
import type Sharp from 'sharp';
import type { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { MetaTable, RootScopes } from '~/utils/globals';
import { AppModule } from '~/app.module';
import { isEE, T } from '~/utils';
import { getAppUrl } from '~/utils/appUrl';
import { DataReflection, Integration } from '~/models';
import { getRedisURL } from '~/helpers/redisHelpers';

dotenv.config();
declare const module: any;

/**
 * Noco 主类 - 负责初始化和配置 NocoDB 应用
 */
export default class Noco {
  // 静态属性定义
  protected static _this: Noco;
  protected static ee: boolean; // 企业版标志
  public static readonly env: string = '_noco';
  protected static _httpServer: http.Server;
  protected static _server: Express;

  // 获取仪表板URL的getter方法
  public static get dashboardUrl(): string {
    return getAppUrl();
  }

  // 公共静态属性
  public static config: any;
  public static eventEmitter: IEventEmitter;
  public readonly router: express.Router;
  public readonly baseRouter: express.Router;
  public static _ncMeta: any;
  public static appHooksService: AppHooksService;
  public readonly metaMgr: any;
  public readonly metaMgrv2: any;
  public env: string;

  // 受保护的属性
  protected config: any;
  protected requestContext: any;

  public static sharp: typeof Sharp;

  /**
   * 构造函数 - 初始化基本配置和路由
   */
  constructor() {
    // 设置默认端口
    process.env.PORT = process.env.PORT || '8080';
    
    // 如果设置了最小数据库模式，禁用外部数据库连接
    if (process.env.NC_MINIMAL_DBS === 'true') {
      process.env.NC_CONNECT_TO_EXTERNAL_DB_DISABLED = 'true';
    }

    // 初始化路由
    this.router = express.Router();
    this.baseRouter = express.Router();

    clear();
  }

  // 获取配置的方法
  public getConfig(): any {
    return this.config;
  }

  // 获取工具目录的方法
  public getToolDir(): string {
    return this.getConfig()?.toolDir;
  }

  // 添加上下文信息的方法
  public addToContext(context: any) {
    this.requestContext = context;
  }

  // 获取元数据服务的静态getter
  public static get ncMeta(): MetaService {
    return this._ncMeta;
  }

  // 获取元数据服务的实例getter
  public get ncMeta(): any {
    return Noco._ncMeta;
  }

  // 获取配置的静态方法
  public static getConfig(): any {
    return this.config;
  }

  // 检查是否为企业版
  public static isEE(): boolean {
    return this.ee || process.env.NC_CLOUD === 'true';
  }

  // 加载企业版状态
  public static async loadEEState(): Promise<boolean> {
    try {
      return (this.ee = isEE);
    } catch {}
    return (this.ee = false);
  }

  /**
   * 初始化方法 - 设置NestJS应用和必要的中间件
   */
  static async init(param: any, httpServer: http.Server, server: Express) {
    // 创建NestJS应用实例
    const nestApp = await NestFactory.create(AppModule, {
      bufferLogs: true,
    });
    
    // 初始化自定义日志记录器
    this.initCustomLogger(nestApp);
    NcDebug.log('Custom logger initialized');
    nestApp.flushLogs();

    // 处理热重载
    if ((module as any)?.hot) {
      (module as any).hot?.accept?.();
      (module as any).hot?.dispose?.(() => nestApp.close());
    }

    // 初始化Sharp图像处理库
    try {
      this.sharp = (await import('sharp')).default;
    } catch {
      console.error(
        'Sharp is not available for your platform, thumbnail generation will be skipped',
      );
    }

    // 检查工作容器配置
    if (process.env.NC_WORKER_CONTAINER === 'true') {
      if (!getRedisURL()) {
        throw new Error('NC_REDIS_URL is required');
      }
      process.env.NC_DISABLE_TELE = 'true';
    }

    // 配置WebSocket适配器
    nestApp.useWebSocketAdapter(new IoAdapter(httpServer));
    NcDebug.log('Websocket adapter initialized');

    // 设置HTTP服务器和Express服务器
    this._httpServer = nestApp.getHttpAdapter().getInstance();
    this._server = server;

    // 配置中间件
    nestApp.use(requestIp.mw());
    nestApp.use(cookieParser());
    nestApp.use(
      express.json({ limit: process.env.NC_REQUEST_BODY_SIZE || '50mb' }),
    );

    // 初始化应用
    await nestApp.init();
    NcDebug.log('Nest app initialized');

    // 启用关闭钩子
    await nestApp.enableShutdownHooks();
    NcDebug.log('Shutdown hooks enabled');

    // 配置静态文件服务和路由重定向
    const dashboardPath = process.env.NC_DASHBOARD_URL ?? '/dashboard';
    server.use(express.static(path.join(__dirname, 'public')));

    if (dashboardPath !== '/' && dashboardPath !== '') {
      server.get('/', (_req, res) => res.redirect(dashboardPath));
    }

    // 初始化集成和数据反射
    await Integration.init();
    NcDebug.log('Integration initialized');

    if (process.env.NC_WORKER_CONTAINER !== 'true') {
      await DataReflection.init();
    }

    return nestApp.getHttpAdapter().getInstance();
  }

  // 获取HTTP服务器的getter
  public static get httpServer(): http.Server {
    return this._httpServer;
  }

  // 获取Express服务器的getter
  public static get server(): Express {
    return this._server;
  }

  /**
   * 初始化JWT配置
   */
  public static async initJwt(): Promise<any> {
    // 配置JWT密钥
    if (this.config?.auth?.jwt) {
      if (!this.config.auth.jwt.secret) {
        let secret = (
          await this._ncMeta.metaGet(
            RootScopes.ROOT,
            RootScopes.ROOT,
            MetaTable.STORE,
            {
              key: 'nc_auth_jwt_secret',
            },
          )
        )?.value;
        if (!secret) {
          await this._ncMeta.metaInsert2(
            RootScopes.ROOT,
            RootScopes.ROOT,
            MetaTable.STORE,
            {
              key: 'nc_auth_jwt_secret',
              value: (secret = uuidv4()),
            },
            true,
          );
        }
        this.config.auth.jwt.secret = secret;
      }

      // 配置JWT选项
      this.config.auth.jwt.options = this.config.auth.jwt.options || {};
      if (!this.config.auth.jwt.options?.expiresIn) {
        this.config.auth.jwt.options.expiresIn =
          process.env.NC_JWT_EXPIRES_IN ?? '10h';
      }
    }

    // 配置服务器ID
    let serverId = (
      await this._ncMeta.metaGet(
        RootScopes.ROOT,
        RootScopes.ROOT,
        MetaTable.STORE,
        {
          key: 'nc_server_id',
        },
      )
    )?.value;
    if (!serverId) {
      await this._ncMeta.metaInsert2(
        RootScopes.ROOT,
        RootScopes.ROOT,
        MetaTable.STORE,
        {
          key: 'nc_server_id',
          value: (serverId = T.id),
        },
        true,
      );
    }
    process.env.NC_SERVER_UUID = serverId;
  }

  /**
   * 初始化自定义日志记录器
   */
  protected static initCustomLogger(_nestApp: INestApplication<any>) {
    // 如果需要，为nestjs设置自定义日志记录器
  }
}
