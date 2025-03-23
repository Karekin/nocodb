import RedisCacheMgr from './RedisCacheMgr';
import RedisMockCacheMgr from './RedisMockCacheMgr';
import type CacheMgr from './CacheMgr';
import { CACHE_PREFIX, CacheGetType } from '~/utils/globals';
import { getRedisURL } from '~/helpers/redisHelpers';

/**
 * NocoCache 类 - 实现系统的缓存管理功能
 * 支持 Redis 和内存缓存两种方式
 */
export default class NocoCache {
  // 缓存客户端实例
  private static client: CacheMgr;
  // 缓存是否禁用标志
  private static cacheDisabled: boolean;
  // 缓存键前缀
  private static prefix: string;

  /**
   * 初始化缓存系统
   * 根据环境配置选择使用 Redis 或内存缓存
   */
  public static init() {
    // 检查是否禁用缓存
    this.cacheDisabled = (process.env.NC_DISABLE_CACHE || false) === 'true';
    if (this.cacheDisabled) {
      return;
    }

    // 根据 Redis URL 选择缓存实现
    if (getRedisURL()) {
      this.client = new RedisCacheMgr(getRedisURL());
    } else {
      this.client = new RedisMockCacheMgr();
    }

    // 设置缓存键前缀
    const orgs = 'noco';
    this.prefix = `${CACHE_PREFIX}:${orgs}`;
  }

  /**
   * 禁用缓存
   */
  public static disableCache() {
    this.cacheDisabled = true;
  }

  /**
   * 启用缓存
   * 恢复到环境配置的默认状态
   */
  public static enableCache() {
    this.cacheDisabled = (process.env.NC_DISABLE_CACHE || false) === 'true';
  }

  /**
   * 设置缓存
   * @param key - 缓存键
   * @param value - 缓存值
   */
  public static async set(key, value): Promise<boolean> {
    if (this.cacheDisabled) return Promise.resolve(true);
    return this.client.set(`${this.prefix}:${key}`, value);
  }

  /**
   * 设置带过期时间的缓存
   * @param key - 缓存键
   * @param value - 缓存值
   * @param expireSeconds - 过期时间（秒）
   */
  public static async setExpiring(key, value, expireSeconds): Promise<boolean> {
    if (this.cacheDisabled) return Promise.resolve(true);
    return this.client.setExpiring(
      `${this.prefix}:${key}`,
      value,
      expireSeconds,
    );
  }

  /**
   * 增加缓存值
   * @param key - 缓存键
   * @param value - 增加值
   */
  public static async incrby(key, value): Promise<boolean> {
    if (this.cacheDisabled) return Promise.resolve(true);
    return this.client.incrby(`${this.prefix}:${key}`, value);
  }

  /**
   * 获取缓存
   * @param key - 缓存键
   * @param type - 返回值类型
   */
  public static async get(key, type): Promise<any> {
    if (this.cacheDisabled) {
      if (type === CacheGetType.TYPE_ARRAY) return Promise.resolve([]);
      else if (type === CacheGetType.TYPE_OBJECT) return Promise.resolve(null);
      return Promise.resolve(null);
    }
    return this.client.get(`${this.prefix}:${key}`, type);
  }

  /**
   * 删除缓存
   * @param key - 缓存键或键数组
   */
  public static async del(key): Promise<boolean> {
    if (this.cacheDisabled) return Promise.resolve(true);
    if (Array.isArray(key))
      return this.client.del(key.map((k) => `${this.prefix}:${k}`));
    return this.client.del(`${this.prefix}:${key}`);
  }

  /**
   * 获取缓存列表
   * @param scope - 作用域
   * @param subKeys - 子键列表
   * @param orderBy - 排序配置
   */
  public static async getList(
    scope: string,
    subKeys: string[],
    orderBy?: {
      key: string;
      dir?: 'asc' | 'desc';
      isString?: boolean;
    },
  ): Promise<{
    list: any[];
    isNoneList: boolean;
  }> {
    if (this.cacheDisabled)
      return Promise.resolve({
        list: [],
        isNoneList: false,
      });
    return this.client.getList(scope, subKeys, orderBy);
  }

  /**
   * 设置缓存列表
   * @param scope - 作用域
   * @param subListKeys - 子列表键
   * @param list - 列表数据
   * @param props - 属性列表
   */
  public static async setList(
    scope: string,
    subListKeys: string[],
    list: any[],
    props: string[] = [],
  ): Promise<boolean> {
    if (this.cacheDisabled) return Promise.resolve(true);
    return this.client.setList(scope, subListKeys, list, props);
  }

  /**
   * 深度删除缓存
   * @param key - 缓存键
   * @param direction - 删除方向
   */
  public static async deepDel(
    key: string,
    direction: string,
  ): Promise<boolean> {
    if (this.cacheDisabled) return Promise.resolve(true);
    return this.client.deepDel(`${this.prefix}:${key}`, direction);
  }

  /**
   * 追加到缓存列表
   * @param scope - 作用域
   * @param subListKeys - 子列表键
   * @param key - 缓存键
   */
  public static async appendToList(
    scope: string,
    subListKeys: string[],
    key: string,
  ): Promise<boolean> {
    if (this.cacheDisabled) return Promise.resolve(true);
    return this.client.appendToList(
      scope,
      subListKeys,
      `${this.prefix}:${key}`,
    );
  }

  /**
   * 更新缓存
   * @param key - 缓存键
   * @param updateObj - 更新对象
   */
  public static async update(
    key: string,
    updateObj: Record<string, any>,
  ): Promise<boolean> {
    if (this.cacheDisabled) return Promise.resolve(true);
    return this.client.update(`${this.prefix}:${key}`, updateObj);
  }

  /**
   * 销毁缓存
   */
  public static async destroy(): Promise<boolean> {
    if (this.cacheDisabled) return Promise.resolve(true);
    return this.client.destroy();
  }

  /**
   * 导出缓存数据
   */
  public static async export(): Promise<any> {
    if (this.cacheDisabled) return Promise.resolve({});
    return this.client.export();
  }
}
