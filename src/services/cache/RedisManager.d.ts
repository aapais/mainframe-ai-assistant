import { EventEmitter } from 'events';
export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  maxRetries: number;
  retryDelayOnFailover: number;
  enableOfflineQueue: boolean;
  lazyConnect: boolean;
  keyPrefix?: string;
  ttl: {
    default: number;
    short: number;
    medium: number;
    long: number;
  };
}
export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
  tags?: string[];
  version?: string;
  compressed?: boolean;
}
export interface CacheMetrics {
  hits: number;
  misses: number;
  hitRate: number;
  avgResponseTime: number;
  memoryUsage: number;
  operations: {
    get: number;
    set: number;
    del: number;
  };
}
export declare class RedisManager extends EventEmitter {
  private client;
  private isConnected;
  private config;
  private metrics;
  private compressionThreshold;
  constructor(config: RedisConfig);
  private initializeClient;
  private mockStorage;
  private mockGet;
  private mockSet;
  private mockDel;
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, data: T, ttl?: number, tags?: string[]): Promise<boolean>;
  del(key: string): Promise<boolean>;
  invalidateByTag(tag: string): Promise<number>;
  flush(): Promise<boolean>;
  warming(
    keys: {
      key: string;
      fetcher: () => Promise<any>;
      ttl?: number;
    }[]
  ): Promise<void>;
  getMetrics(): CacheMetrics;
  private getKey;
  private shouldCompress;
  private updateMetrics;
  private resetMetrics;
  isReady(): boolean;
  disconnect(): Promise<void>;
}
//# sourceMappingURL=RedisManager.d.ts.map
