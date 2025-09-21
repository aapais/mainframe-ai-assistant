# Cache System API Reference

## Overview

This document provides comprehensive API reference for the Mainframe AI Assistant intelligent search caching system. The cache system exposes both programmatic APIs for integration and HTTP endpoints for monitoring and management.

## Table of Contents

1. [Core Classes](#core-classes)
2. [Cache Manager API](#cache-manager-api)
3. [Redis Service API](#redis-service-api)
4. [In-Memory Cache API](#in-memory-cache-api)
5. [Metrics API](#metrics-api)
6. [HTTP Endpoints](#http-endpoints)
7. [Configuration Types](#configuration-types)
8. [Error Handling](#error-handling)
9. [Usage Examples](#usage-examples)

## Core Classes

### SearchCacheSystem

The main entry point for the cache system integration.

```typescript
import { SearchCacheSystem, createCacheSystem } from './src/index.cache';

// Create and initialize cache system
const cacheSystem = await createCacheSystem({
  redis: {
    host: 'localhost',
    port: 6379,
    password: 'your-password'
  },
  memory: {
    maxSize: 100,
    ttl: 300000
  }
});
```

#### Constructor

```typescript
constructor(options: CacheSystemOptions, searchService?: SearchService)
```

**Parameters:**
- `options`: Configuration object for the cache system
- `searchService`: Optional search service instance to integrate with

#### Methods

##### initialize()

Initialize the cache system with all components.

```typescript
async initialize(): Promise<void>
```

**Returns:** Promise that resolves when initialization is complete

**Throws:** Error if initialization fails

**Example:**
```typescript
const cacheSystem = new SearchCacheSystem(options);
await cacheSystem.initialize();
```

##### createCachedSearch()

Create a cached version of a search function.

```typescript
createCachedSearch<T = any>(
  searchFunction: (query: string, options?: any) => Promise<T>,
  cacheOptions?: {
    ttl?: number;
    keyGenerator?: (query: string, options?: any) => string;
    shouldCache?: (query: string, options?: any, result?: T) => boolean;
  }
): (query: string, options?: any) => Promise<T>
```

**Parameters:**
- `searchFunction`: The original search function to wrap
- `cacheOptions`: Optional caching configuration
  - `ttl`: Time-to-live in milliseconds (default: 300000)
  - `keyGenerator`: Custom key generation function
  - `shouldCache`: Function to determine if result should be cached

**Returns:** Cached version of the search function

**Example:**
```typescript
const cachedSearch = cacheSystem.createCachedSearch(
  async (query: string) => {
    return await originalSearchFunction(query);
  },
  {
    ttl: 600000, // 10 minutes
    shouldCache: (query, options, result) => result.length > 0
  }
);

const results = await cachedSearch('my search query');
```

##### invalidatePattern()

Invalidate cache entries matching a pattern.

```typescript
async invalidatePattern(pattern: string): Promise<number>
```

**Parameters:**
- `pattern`: Glob pattern to match cache keys

**Returns:** Number of keys invalidated

**Example:**
```typescript
// Invalidate all search caches for a user
const invalidated = await cacheSystem.invalidatePattern('search:user:123:*');
console.log(`Invalidated ${invalidated} cache entries`);
```

##### invalidate()

Invalidate a specific cache entry.

```typescript
async invalidate(key: string): Promise<boolean>
```

**Parameters:**
- `key`: Cache key to invalidate

**Returns:** True if key was invalidated, false if not found

##### getStats()

Get comprehensive cache statistics.

```typescript
async getStats(): Promise<CacheStats>
```

**Returns:** Object containing cache statistics

```typescript
interface CacheStats {
  hits: number;
  misses: number;
  hitRatio: number;
  totalRequests: number;
  memoryUsage: {
    used: number;
    max: number;
    percentage: number;
  };
  redis?: {
    connected: boolean;
    memoryUsage: number;
    connectedClients: number;
    operations: number;
  };
  uptime: number;
}
```

##### warmup()

Pre-populate cache with common searches.

```typescript
async warmup(searches: Array<{ query: string; options?: any }>): Promise<void>
```

**Parameters:**
- `searches`: Array of search queries and options to pre-cache

**Example:**
```typescript
await cacheSystem.warmup([
  { query: 'common search term' },
  { query: 'popular query', options: { limit: 10 } },
  { query: 'frequent lookup' }
]);
```

##### healthCheck()

Perform comprehensive health check of all cache components.

```typescript
async healthCheck(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  components: Record<string, boolean>;
  metrics: any;
}>
```

**Returns:** Health status object

##### shutdown()

Gracefully shut down the cache system.

```typescript
async shutdown(): Promise<void>
```

## Cache Manager API

### CacheManager

Coordinates between multiple cache layers and provides unified interface.

```typescript
import { CacheManager } from './src/cache/CacheManager';
```

#### Methods

##### get()

Retrieve value from cache.

```typescript
async get(key: string): Promise<any | null>
```

**Parameters:**
- `key`: Cache key to retrieve

**Returns:** Cached value or null if not found

##### set()

Store value in cache.

```typescript
async set(key: string, value: any, ttl?: number): Promise<boolean>
```

**Parameters:**
- `key`: Cache key
- `value`: Value to store
- `ttl`: Time-to-live in milliseconds (optional)

**Returns:** True if successfully stored

##### delete()

Remove value from cache.

```typescript
async delete(key: string): Promise<boolean>
```

**Parameters:**
- `key`: Cache key to remove

**Returns:** True if key was removed

##### has()

Check if key exists in cache.

```typescript
async has(key: string): Promise<boolean>
```

**Parameters:**
- `key`: Cache key to check

**Returns:** True if key exists

##### clear()

Clear all cache entries.

```typescript
async clear(): Promise<void>
```

##### getMany()

Retrieve multiple values at once.

```typescript
async getMany(keys: string[]): Promise<Record<string, any>>
```

**Parameters:**
- `keys`: Array of cache keys

**Returns:** Object mapping keys to values

##### setMany()

Store multiple values at once.

```typescript
async setMany(entries: Record<string, any>, ttl?: number): Promise<boolean>
```

**Parameters:**
- `entries`: Object mapping keys to values
- `ttl`: Time-to-live in milliseconds (optional)

**Returns:** True if all entries were stored

## Redis Service API

### RedisService

Provides Redis-specific caching operations.

```typescript
import { RedisService } from './src/cache/RedisService';
```

#### Constructor

```typescript
constructor(config: RedisConfig)
```

#### Methods

##### connect()

Establish connection to Redis server.

```typescript
async connect(): Promise<void>
```

##### disconnect()

Close connection to Redis server.

```typescript
async disconnect(): Promise<void>
```

##### ping()

Test Redis connectivity.

```typescript
async ping(): Promise<string>
```

**Returns:** 'PONG' if connected

##### flushdb()

Clear all keys in current database.

```typescript
async flushdb(): Promise<void>
```

##### info()

Get Redis server information.

```typescript
async info(section?: string): Promise<string>
```

**Parameters:**
- `section`: Specific info section (optional)

**Returns:** Redis info string

##### scan()

Scan for keys matching pattern.

```typescript
async scan(pattern: string, count?: number): Promise<string[]>
```

**Parameters:**
- `pattern`: Key pattern to match
- `count`: Number of keys to return per iteration

**Returns:** Array of matching keys

## In-Memory Cache API

### InMemoryCache

Provides fast in-memory caching with LRU eviction.

```typescript
import { InMemoryCache } from './src/cache/InMemoryCache';
```

#### Constructor

```typescript
constructor(config: MemoryCacheConfig)
```

#### Methods

##### size()

Get current cache size.

```typescript
size(): number
```

**Returns:** Number of entries in cache

##### keys()

Get all cache keys.

```typescript
keys(): string[]
```

**Returns:** Array of cache keys

##### values()

Get all cache values.

```typescript
values(): any[]
```

**Returns:** Array of cache values

##### entries()

Get all cache entries.

```typescript
entries(): Array<[string, any]>
```

**Returns:** Array of [key, value] tuples

## Metrics API

### CacheMetrics

Provides comprehensive metrics collection and reporting.

```typescript
import { CacheMetrics } from './src/cache/CacheMetrics';
```

#### Methods

##### recordHit()

Record a cache hit.

```typescript
recordHit(key: string, source: 'redis' | 'memory'): void
```

##### recordMiss()

Record a cache miss.

```typescript
recordMiss(key: string): void
```

##### recordOperation()

Record a cache operation with timing.

```typescript
recordOperation(operation: string, duration: number): void
```

##### getMetrics()

Get current metrics snapshot.

```typescript
getMetrics(): MetricsSnapshot
```

##### exportPrometheus()

Export metrics in Prometheus format.

```typescript
exportPrometheus(): string
```

**Returns:** Prometheus-formatted metrics string

## HTTP Endpoints

The cache system exposes HTTP endpoints for monitoring and management.

### Health Check

```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2023-01-01T00:00:00.000Z",
  "uptime": 3600,
  "components": {
    "memoryCache": true,
    "redisCache": true,
    "metrics": true,
    "cacheManager": true
  }
}
```

### Statistics

```http
GET /stats
```

**Response:**
```json
{
  "hits": 1500,
  "misses": 300,
  "hitRatio": 0.83,
  "totalRequests": 1800,
  "memoryUsage": {
    "used": 50,
    "max": 100,
    "percentage": 50
  },
  "redis": {
    "connected": true,
    "memoryUsage": 1048576,
    "connectedClients": 5,
    "operations": 2500
  },
  "uptime": 3600
}
```

### Metrics (Prometheus)

```http
GET /metrics
```

**Response:** Prometheus-formatted metrics

### Cache Operations

#### Get Cache Entry

```http
GET /cache/:key
```

**Parameters:**
- `key`: Cache key to retrieve

**Response:**
```json
{
  "key": "search:example",
  "value": { "results": [...] },
  "ttl": 300,
  "source": "redis"
}
```

#### Set Cache Entry

```http
POST /cache/:key
```

**Parameters:**
- `key`: Cache key to set

**Body:**
```json
{
  "value": { "data": "example" },
  "ttl": 300
}
```

#### Delete Cache Entry

```http
DELETE /cache/:key
```

**Parameters:**
- `key`: Cache key to delete

#### Invalidate Pattern

```http
POST /cache/invalidate
```

**Body:**
```json
{
  "pattern": "search:user:123:*"
}
```

**Response:**
```json
{
  "invalidated": 5
}
```

### Admin Operations

#### Clear Cache

```http
DELETE /cache
```

**Query Parameters:**
- `confirm=true`: Required confirmation

#### Warmup Cache

```http
POST /cache/warmup
```

**Body:**
```json
{
  "searches": [
    { "query": "common term" },
    { "query": "popular query", "options": { "limit": 10 } }
  ]
}
```

## Configuration Types

### CacheSystemOptions

```typescript
interface CacheSystemOptions {
  redis?: RedisConfig;
  memory?: MemoryCacheConfig;
  metrics?: MetricsConfig;
  fallback?: FallbackConfig;
}
```

### RedisConfig

```typescript
interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  maxRetries?: number;
  retryDelayOnFailover?: number;
}
```

### MemoryCacheConfig

```typescript
interface MemoryCacheConfig {
  maxSize: number;
  ttl: number;
  checkPeriod?: number;
}
```

### MetricsConfig

```typescript
interface MetricsConfig {
  enabled: boolean;
  flushInterval?: number;
  retentionDays?: number;
}
```

### FallbackConfig

```typescript
interface FallbackConfig {
  enableMemoryFallback: boolean;
  memoryFallbackSize?: number;
}
```

## Error Handling

### Error Types

#### CacheError

Base error class for cache-related errors.

```typescript
class CacheError extends Error {
  code: string;
  cause?: Error;
}
```

#### RedisConnectionError

Error when Redis connection fails.

```typescript
class RedisConnectionError extends CacheError {
  code: 'REDIS_CONNECTION_FAILED';
}
```

#### CacheTimeoutError

Error when cache operation times out.

```typescript
class CacheTimeoutError extends CacheError {
  code: 'CACHE_TIMEOUT';
}
```

#### InvalidationError

Error during cache invalidation.

```typescript
class InvalidationError extends CacheError {
  code: 'INVALIDATION_FAILED';
}
```

### Error Handling Best Practices

```typescript
try {
  const result = await cacheSystem.get('key');
  return result;
} catch (error) {
  if (error instanceof RedisConnectionError) {
    // Fall back to memory cache or original data source
    return await fallbackOperation();
  } else if (error instanceof CacheTimeoutError) {
    // Log timeout and return default
    logger.warn('Cache timeout, using default');
    return defaultValue;
  } else {
    // Log unexpected error
    logger.error('Unexpected cache error:', error);
    throw error;
  }
}
```

## Usage Examples

### Basic Integration

```typescript
import { createCacheSystem } from './src/index.cache';

// Initialize cache system
const cacheSystem = await createCacheSystem({
  redis: {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT),
    password: process.env.REDIS_PASSWORD
  },
  memory: {
    maxSize: 100,
    ttl: 300000
  }
});

// Create cached search function
const searchService = new SearchService();
const cachedSearch = cacheSystem.createCachedSearch(
  (query, options) => searchService.search(query, options),
  { ttl: 600000 }
);

// Use cached search
const results = await cachedSearch('machine learning');
```

### Advanced Configuration

```typescript
import { SearchCacheSystem, createDefaultCacheConfig } from './src/index.cache';

// Start with default config and customize
const config = createDefaultCacheConfig();
config.redis.maxRetries = 5;
config.memory.maxSize = 200;
config.metrics.enabled = true;

// Initialize with custom config
const cacheSystem = new SearchCacheSystem(config);
await cacheSystem.initialize();

// Set up event handlers
cacheSystem.on('cacheHit', (data) => {
  console.log(`Cache hit for query: ${data.query}`);
});

cacheSystem.on('cacheMiss', (data) => {
  console.log(`Cache miss for query: ${data.query}`);
});
```

### Custom Key Generation

```typescript
const cachedSearch = cacheSystem.createCachedSearch(
  searchFunction,
  {
    keyGenerator: (query, options) => {
      const userId = options?.userId || 'anonymous';
      const normalized = query.toLowerCase().trim();
      return `search:${userId}:${Buffer.from(normalized).toString('base64')}`;
    },
    shouldCache: (query, options, result) => {
      // Only cache non-empty results for non-sensitive queries
      return result.length > 0 && !query.includes('password');
    }
  }
);
```

### Monitoring and Metrics

```typescript
// Get real-time statistics
const stats = await cacheSystem.getStats();
console.log(`Hit ratio: ${(stats.hitRatio * 100).toFixed(2)}%`);
console.log(`Memory usage: ${stats.memoryUsage.percentage}%`);

// Export metrics for Prometheus
const metrics = cacheSystem.getMetrics();
const prometheusData = metrics.exportPrometheus();

// Health check
const health = await cacheSystem.healthCheck();
if (health.status !== 'healthy') {
  console.warn('Cache system health issues:', health.components);
}
```

### Error Handling and Fallbacks

```typescript
const robustCachedSearch = async (query: string, options?: any) => {
  try {
    return await cachedSearch(query, options);
  } catch (error) {
    logger.warn('Cache error, falling back to direct search:', error);

    // Fallback to direct search
    return await originalSearchFunction(query, options);
  }
};
```

### Cache Warmup

```typescript
// Warmup with common searches
await cacheSystem.warmup([
  { query: 'artificial intelligence' },
  { query: 'machine learning' },
  { query: 'data science' },
  { query: 'neural networks' }
]);

// Warmup based on analytics
const popularQueries = await getPopularQueries();
await cacheSystem.warmup(
  popularQueries.map(query => ({ query }))
);
```

### Maintenance Operations

```typescript
// Periodic maintenance
setInterval(async () => {
  try {
    await cacheSystem.maintenance();
    console.log('Cache maintenance completed');
  } catch (error) {
    console.error('Cache maintenance failed:', error);
  }
}, 3600000); // Every hour

// Invalidation strategies
await cacheSystem.invalidatePattern('search:user:123:*'); // User-specific
await cacheSystem.invalidatePattern('search:*:category:news'); // Category-specific
await cacheSystem.invalidate('search:specific:key'); // Specific key
```

---

For additional examples and advanced usage patterns, please refer to the [Deployment Guide](./CACHE_DEPLOYMENT_GUIDE.md) and [Troubleshooting Guide](./CACHE_TROUBLESHOOTING.md).