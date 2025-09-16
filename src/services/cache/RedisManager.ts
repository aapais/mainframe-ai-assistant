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

export class RedisManager extends EventEmitter {
  private client: any;
  private isConnected: boolean = false;
  private config: RedisConfig;
  private metrics: CacheMetrics;
  private compressionThreshold: number = 1024; // bytes

  constructor(config: RedisConfig) {
    super();
    this.config = config;
    this.metrics = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      avgResponseTime: 0,
      memoryUsage: 0,
      operations: { get: 0, set: 0, del: 0 }
    };
    this.initializeClient();
  }

  private async initializeClient(): Promise<void> {
    try {
      // Mock Redis client for testing - replace with actual Redis in production
      this.client = {
        connect: async () => { this.isConnected = true; },
        get: async (key: string) => { 
          this.metrics.operations.get++;
          return this.mockGet(key); 
        },
        set: async (key: string, value: string, ttl?: number) => {
          this.metrics.operations.set++;
          return this.mockSet(key, value, ttl);
        },
        del: async (key: string) => {
          this.metrics.operations.del++;
          return this.mockDel(key);
        },
        keys: async (pattern: string) => [],
        flushdb: async () => true,
        info: async () => 'used_memory:1024'
      };

      await this.client.connect();
      this.emit('connected');
      console.log('Redis manager initialized successfully');
    } catch (error) {
      console.error('Redis connection failed:', error);
      this.emit('error', error);
    }
  }

  private mockStorage = new Map<string, { value: string; expires: number }>();

  private mockGet(key: string): string | null {
    const item = this.mockStorage.get(key);
    if (!item) return null;
    if (Date.now() > item.expires) {
      this.mockStorage.delete(key);
      return null;
    }
    return item.value;
  }

  private mockSet(key: string, value: string, ttl: number = this.config.ttl.default): boolean {
    this.mockStorage.set(key, {
      value,
      expires: Date.now() + (ttl * 1000)
    });
    return true;
  }

  private mockDel(key: string): boolean {
    return this.mockStorage.delete(key);
  }

  async get<T>(key: string): Promise<T | null> {
    const startTime = Date.now();
    try {
      const data = await this.client.get(this.getKey(key));
      const responseTime = Date.now() - startTime;
      this.updateMetrics('hit', responseTime);
      
      if (!data) {
        this.metrics.misses++;
        return null;
      }

      const entry: CacheEntry<T> = JSON.parse(data);
      
      // Check if entry has expired
      if (Date.now() > entry.timestamp + (entry.ttl * 1000)) {
        await this.del(key);
        this.metrics.misses++;
        return null;
      }

      this.metrics.hits++;
      return entry.data;
    } catch (error) {
      console.error('Cache get error:', error);
      this.metrics.misses++;
      return null;
    }
  }

  async set<T>(
    key: string, 
    data: T, 
    ttl: number = this.config.ttl.default,
    tags?: string[]
  ): Promise<boolean> {
    try {
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        ttl,
        tags,
        version: '1.0'
      };

      const serialized = JSON.stringify(entry);
      const compressed = this.shouldCompress(serialized);
      
      if (compressed) {
        entry.compressed = true;
        // In production, use actual compression like gzip
      }

      await this.client.set(this.getKey(key), JSON.stringify(entry), ttl);
      return true;
    } catch (error) {
      console.error('Cache set error:', error);
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    try {
      await this.client.del(this.getKey(key));
      return true;
    } catch (error) {
      console.error('Cache delete error:', error);
      return false;
    }
  }

  async invalidateByTag(tag: string): Promise<number> {
    try {
      const keys = await this.client.keys(`${this.config.keyPrefix || ''}*`);
      let invalidated = 0;

      for (const key of keys) {
        const data = await this.client.get(key);
        if (data) {
          const entry: CacheEntry = JSON.parse(data);
          if (entry.tags && entry.tags.includes(tag)) {
            await this.client.del(key);
            invalidated++;
          }
        }
      }

      return invalidated;
    } catch (error) {
      console.error('Tag invalidation error:', error);
      return 0;
    }
  }

  async flush(): Promise<boolean> {
    try {
      await this.client.flushdb();
      this.resetMetrics();
      return true;
    } catch (error) {
      console.error('Cache flush error:', error);
      return false;
    }
  }

  async warming(keys: { key: string; fetcher: () => Promise<any>; ttl?: number }[]): Promise<void> {
    console.log(`Starting cache warming for ${keys.length} keys`);
    
    const batchSize = 10;
    for (let i = 0; i < keys.length; i += batchSize) {
      const batch = keys.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async ({ key, fetcher, ttl }) => {
          try {
            const data = await fetcher();
            await this.set(key, data, ttl);
          } catch (error) {
            console.error(`Cache warming failed for key ${key}:`, error);
          }
        })
      );
    }
    
    console.log('Cache warming completed');
  }

  getMetrics(): CacheMetrics {
    const total = this.metrics.hits + this.metrics.misses;
    this.metrics.hitRate = total > 0 ? (this.metrics.hits / total) * 100 : 0;
    return { ...this.metrics };
  }

  private getKey(key: string): string {
    return this.config.keyPrefix ? `${this.config.keyPrefix}:${key}` : key;
  }

  private shouldCompress(data: string): boolean {
    return Buffer.byteLength(data, 'utf8') > this.compressionThreshold;
  }

  private updateMetrics(type: 'hit' | 'miss', responseTime: number): void {
    if (type === 'hit') {
      this.metrics.hits++;
    } else {
      this.metrics.misses++;
    }
    
    // Update average response time
    const totalOps = this.metrics.operations.get;
    this.metrics.avgResponseTime = 
      (this.metrics.avgResponseTime * (totalOps - 1) + responseTime) / totalOps;
  }

  private resetMetrics(): void {
    this.metrics = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      avgResponseTime: 0,
      memoryUsage: 0,
      operations: { get: 0, set: 0, del: 0 }
    };
  }

  isReady(): boolean {
    return this.isConnected;
  }

  async disconnect(): Promise<void> {
    if (this.client && this.isConnected) {
      // await this.client.disconnect();
      this.isConnected = false;
      this.emit('disconnected');
    }
  }
}