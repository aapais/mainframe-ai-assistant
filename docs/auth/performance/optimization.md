# SSO Performance Optimization Guide

## 🚀 Overview

This comprehensive guide covers performance optimization strategies for the Mainframe AI Assistant SSO system, focusing on latency reduction, throughput improvement, and scalability enhancements.

## ⚡ Performance Metrics and Targets

### Target Performance Metrics

| Metric | Target | Current | Priority |
|--------|--------|---------|----------|
| **Authentication Latency** | < 200ms | 150ms | High |
| **Token Validation** | < 50ms | 35ms | Critical |
| **Provider Callback** | < 300ms | 250ms | High |
| **Session Creation** | < 100ms | 85ms | Medium |
| **Database Queries** | < 10ms | 8ms | High |
| **Cache Hit Rate** | > 95% | 93% | Medium |
| **Throughput** | 10,000 req/s | 8,500 req/s | High |
| **CPU Utilization** | < 70% | 65% | Medium |
| **Memory Usage** | < 512MB | 420MB | Low |

### Performance Monitoring Setup

```javascript
// monitoring/PerformanceMonitor.js
const prometheus = require('prom-client');

class SSOPerformanceMonitor {
  constructor() {
    // Register default metrics
    prometheus.register.setDefaultLabels({ service: 'sso-service' });
    prometheus.collectDefaultMetrics({ timeout: 5000 });

    // Custom metrics
    this.metrics = {
      // Authentication latency histogram
      authLatency: new prometheus.Histogram({
        name: 'sso_auth_duration_seconds',
        help: 'Authentication request duration',
        labelNames: ['provider', 'method', 'status'],
        buckets: [0.01, 0.05, 0.1, 0.2, 0.5, 1.0, 2.0, 5.0]
      }),

      // Token validation histogram
      tokenValidation: new prometheus.Histogram({
        name: 'sso_token_validation_duration_seconds',
        help: 'Token validation duration',
        labelNames: ['token_type', 'status'],
        buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25]
      }),

      // Database query duration
      dbQueryDuration: new prometheus.Histogram({
        name: 'sso_db_query_duration_seconds',
        help: 'Database query execution time',
        labelNames: ['query_type', 'table'],
        buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1]
      }),

      // Cache operations
      cacheOperations: new prometheus.Counter({
        name: 'sso_cache_operations_total',
        help: 'Total cache operations',
        labelNames: ['operation', 'result']
      }),

      // Active sessions gauge
      activeSessions: new prometheus.Gauge({
        name: 'sso_active_sessions',
        help: 'Number of active user sessions'
      }),

      // Provider performance
      providerLatency: new prometheus.Histogram({
        name: 'sso_provider_response_duration_seconds',
        help: 'OAuth provider response time',
        labelNames: ['provider', 'operation'],
        buckets: [0.1, 0.2, 0.5, 1.0, 2.0, 5.0, 10.0]
      })
    };
  }

  // Record authentication timing
  recordAuthenticationTime(provider, method, status, duration) {
    this.metrics.authLatency
      .labels(provider, method, status)
      .observe(duration / 1000); // Convert to seconds
  }

  // Record token validation timing
  recordTokenValidation(tokenType, status, duration) {
    this.metrics.tokenValidation
      .labels(tokenType, status)
      .observe(duration / 1000);
  }

  // Record database query timing
  recordDatabaseQuery(queryType, table, duration) {
    this.metrics.dbQueryDuration
      .labels(queryType, table)
      .observe(duration / 1000);
  }

  // Record cache operations
  recordCacheOperation(operation, result) {
    this.metrics.cacheOperations
      .labels(operation, result)
      .inc();
  }

  // Update active sessions count
  updateActiveSessions(count) {
    this.metrics.activeSessions.set(count);
  }

  // Record provider response time
  recordProviderLatency(provider, operation, duration) {
    this.metrics.providerLatency
      .labels(provider, operation)
      .observe(duration / 1000);
  }

  // Get metrics for Prometheus scraping
  getMetrics() {
    return prometheus.register.metrics();
  }

  // Performance middleware
  createPerformanceMiddleware() {
    return (req, res, next) => {
      const startTime = process.hrtime.bigint();

      // Track response completion
      res.on('finish', () => {
        const duration = Number(process.hrtime.bigint() - startTime) / 1000000; // Convert to milliseconds

        // Record based on endpoint type
        if (req.path.includes('/auth/')) {
          const provider = req.params.provider || 'unknown';
          const method = req.path.includes('/callback') ? 'callback' : 'authorize';
          const status = res.statusCode < 400 ? 'success' : 'error';

          this.recordAuthenticationTime(provider, method, status, duration);
        }

        if (req.path.includes('/token/validate')) {
          const status = res.statusCode < 400 ? 'success' : 'error';
          this.recordTokenValidation('access', status, duration);
        }
      });

      next();
    };
  }
}

module.exports = new SSOPerformanceMonitor();
```

## 🏎️ Database Performance Optimization

### Query Optimization

```sql
-- Optimized queries for common SSO operations

-- 1. User lookup by email (most frequent query)
-- Before: Sequential scan on users table
-- After: Index-optimized lookup
CREATE UNIQUE INDEX CONCURRENTLY idx_users_email_active
ON sso_users(email) WHERE active = true;

-- Optimized user lookup query
SELECT
  id, email, provider, provider_id, profile,
  email_verified, active, created_at, last_login
FROM sso_users
WHERE email = $1 AND active = true;

-- 2. Session validation (second most frequent)
-- Before: Multiple table joins
-- After: Optimized session lookup with user data
CREATE INDEX CONCURRENTLY idx_sessions_token_active
ON user_sessions(session_token) WHERE active = true;

-- Combined session and user lookup
SELECT
  s.id as session_id,
  s.user_id,
  s.created_at as session_created,
  s.last_accessed,
  s.expires_at,
  u.email,
  u.profile,
  u.provider
FROM user_sessions s
JOIN sso_users u ON u.id = s.user_id
WHERE s.session_token = $1
  AND s.active = true
  AND s.expires_at > NOW()
  AND u.active = true;

-- 3. Refresh token validation
-- Before: Full table scan on revoked tokens
-- After: Partial index on active tokens only
CREATE INDEX CONCURRENTLY idx_refresh_tokens_active
ON refresh_tokens(user_id, family_id) WHERE revoked = false;

-- Optimized refresh token lookup
SELECT
  r.id,
  r.user_id,
  r.family_id,
  r.expires_at,
  u.email,
  u.active as user_active
FROM refresh_tokens r
JOIN sso_users u ON u.id = r.user_id
WHERE r.token_hash = $1
  AND r.revoked = false
  AND r.expires_at > NOW()
  AND u.active = true;

-- 4. Audit log insertion (write-heavy)
-- Optimized for bulk inserts with partitioning
CREATE TABLE audit_logs_template (
  id UUID DEFAULT gen_random_uuid(),
  user_id UUID,
  event_type VARCHAR(50),
  event_data JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  correlation_id UUID
) PARTITION BY RANGE (created_at);

-- Create monthly partitions
CREATE TABLE audit_logs_2025_01 PARTITION OF audit_logs_template
FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

-- Indexes for audit log partitions
CREATE INDEX idx_audit_logs_2025_01_user_event
ON audit_logs_2025_01(user_id, event_type, created_at);
```

### Connection Pool Optimization

```javascript
// config/database-optimized.js
const { Pool } = require('pg');

class OptimizedDatabasePool {
  constructor() {
    this.readPool = new Pool({
      connectionString: process.env.DATABASE_READ_URL,
      max: 20, // Read connections
      min: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      acquireTimeoutMillis: 60000,

      // Optimizations for read queries
      statement_timeout: 10000, // 10 seconds
      query_timeout: 10000,

      // Keep-alive for long-running connections
      keepAlive: true,
      keepAliveInitialDelayMillis: 0
    });

    this.writePool = new Pool({
      connectionString: process.env.DATABASE_WRITE_URL,
      max: 10, // Fewer write connections
      min: 2,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,

      // Longer timeout for write operations
      statement_timeout: 30000,
      query_timeout: 30000
    });

    // Connection pool monitoring
    this.setupMonitoring();
  }

  setupMonitoring() {
    const monitor = require('./PerformanceMonitor');

    // Monitor pool metrics
    setInterval(() => {
      monitor.recordDatabasePoolStats('read', {
        total: this.readPool.totalCount,
        idle: this.readPool.idleCount,
        waiting: this.readPool.waitingCount
      });

      monitor.recordDatabasePoolStats('write', {
        total: this.writePool.totalCount,
        idle: this.writePool.idleCount,
        waiting: this.writePool.waitingCount
      });
    }, 10000);
  }

  // Optimized query method with automatic pool selection
  async query(text, params, options = {}) {
    const { write = false, timeout = 10000 } = options;
    const pool = write ? this.writePool : this.readPool;
    const startTime = Date.now();

    try {
      // Add query timeout
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Query timeout')), timeout)
      );

      const queryPromise = pool.query(text, params);
      const result = await Promise.race([queryPromise, timeoutPromise]);

      const duration = Date.now() - startTime;

      // Record metrics
      const monitor = require('./PerformanceMonitor');
      monitor.recordDatabaseQuery(
        this.classifyQuery(text),
        this.extractTableName(text),
        duration
      );

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`Query failed after ${duration}ms:`, {
        query: text.substring(0, 100),
        error: error.message
      });
      throw error;
    }
  }

  // Transaction with optimized settings
  async transaction(callback, options = {}) {
    const { write = true, isolationLevel = 'READ COMMITTED' } = options;
    const pool = write ? this.writePool : this.readPool;
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      if (isolationLevel !== 'READ COMMITTED') {
        await client.query(`SET TRANSACTION ISOLATION LEVEL ${isolationLevel}`);
      }

      const result = await callback(client);
      await client.query('COMMIT');
      return result;

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Prepared statement cache
  async preparedQuery(name, text, params) {
    const client = await this.readPool.connect();

    try {
      const result = await client.query({
        name,
        text,
        values: params
      });

      return result;
    } finally {
      client.release();
    }
  }

  classifyQuery(query) {
    const normalized = query.toLowerCase().trim();

    if (normalized.startsWith('select')) return 'select';
    if (normalized.startsWith('insert')) return 'insert';
    if (normalized.startsWith('update')) return 'update';
    if (normalized.startsWith('delete')) return 'delete';

    return 'other';
  }

  extractTableName(query) {
    const match = query.match(/(?:from|into|update|join)\s+(\w+)/i);
    return match ? match[1] : 'unknown';
  }
}

module.exports = new OptimizedDatabasePool();
```

## ⚡ Caching Strategy Optimization

### Multi-Layer Caching

```javascript
// cache/OptimizedCacheManager.js
const Redis = require('ioredis');
const LRU = require('lru-cache');

class OptimizedCacheManager {
  constructor() {
    // L1 Cache: In-memory LRU
    this.l1Cache = new LRU({
      max: 5000, // Maximum items
      ttl: 5 * 60 * 1000, // 5 minutes
      updateAgeOnGet: true,
      updateAgeOnHas: true
    });

    // L2 Cache: Redis
    this.l2Cache = new Redis.Cluster([
      { host: 'redis-1', port: 7000 },
      { host: 'redis-2', port: 7000 },
      { host: 'redis-3', port: 7000 }
    ], {
      scaleReads: 'slave',
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,

      // Optimizations
      lazyConnect: true,
      keepAlive: 3000,
      family: 4,

      // Redis-specific optimizations
      enableReadyCheck: true,
      enableOfflineQueue: false
    });

    // Cache statistics
    this.stats = {
      l1: { hits: 0, misses: 0 },
      l2: { hits: 0, misses: 0 },
      writes: 0,
      errors: 0
    };

    this.setupOptimizations();
  }

  setupOptimizations() {
    // Batch Redis operations
    this.redisBatch = [];
    this.batchTimeout = null;

    // Connection pooling for Redis
    this.l2Cache.on('ready', () => {
      console.log('Redis cluster ready - optimizations active');
    });

    // Error handling
    this.l2Cache.on('error', (error) => {
      console.error('Redis error:', error);
      this.stats.errors++;
    });
  }

  // Optimized get with fallthrough
  async get(key, options = {}) {
    const { skipL1 = false, deserialize = true } = options;
    const startTime = Date.now();

    try {
      // Try L1 cache first
      if (!skipL1) {
        const l1Value = this.l1Cache.get(key);
        if (l1Value !== undefined) {
          this.stats.l1.hits++;
          this.recordCacheOperation('get', 'l1_hit', Date.now() - startTime);
          return deserialize ? JSON.parse(l1Value) : l1Value;
        }
        this.stats.l1.misses++;
      }

      // Try L2 cache (Redis)
      const l2Value = await this.l2Cache.get(key);
      if (l2Value !== null) {
        this.stats.l2.hits++;

        // Populate L1 cache
        if (!skipL1) {
          this.l1Cache.set(key, l2Value);
        }

        this.recordCacheOperation('get', 'l2_hit', Date.now() - startTime);
        return deserialize ? JSON.parse(l2Value) : l2Value;
      }

      this.stats.l2.misses++;
      this.recordCacheOperation('get', 'miss', Date.now() - startTime);
      return null;

    } catch (error) {
      this.stats.errors++;
      console.error('Cache get error:', error);
      return null;
    }
  }

  // Optimized set with write-through
  async set(key, value, ttl = 900, options = {}) {
    const {
      skipL1 = false,
      serialize = true,
      batch = false
    } = options;

    const startTime = Date.now();

    try {
      const serializedValue = serialize ? JSON.stringify(value) : value;

      // Set in L1 cache
      if (!skipL1) {
        this.l1Cache.set(key, serializedValue, { ttl: ttl * 1000 });
      }

      // Set in L2 cache
      if (batch) {
        this.addToBatch('setex', key, ttl, serializedValue);
      } else {
        await this.l2Cache.setex(key, ttl, serializedValue);
      }

      this.stats.writes++;
      this.recordCacheOperation('set', 'success', Date.now() - startTime);
      return true;

    } catch (error) {
      this.stats.errors++;
      console.error('Cache set error:', error);
      return false;
    }
  }

  // Batch operations for better performance
  addToBatch(operation, ...args) {
    this.redisBatch.push([operation, ...args]);

    // Process batch after small delay
    if (!this.batchTimeout) {
      this.batchTimeout = setTimeout(() => {
        this.processBatch();
      }, 10); // 10ms batching window
    }
  }

  async processBatch() {
    if (this.redisBatch.length === 0) return;

    const batch = this.redisBatch.splice(0);
    this.batchTimeout = null;

    try {
      const pipeline = this.l2Cache.pipeline();

      batch.forEach(([operation, ...args]) => {
        pipeline[operation](...args);
      });

      await pipeline.exec();
    } catch (error) {
      console.error('Batch processing error:', error);
      this.stats.errors++;
    }
  }

  // Specialized caching methods for SSO operations

  // Token validation caching
  async cacheTokenValidation(tokenHash, user, ttl = 300) {
    const key = `token:${tokenHash}`;

    await this.set(key, {
      userId: user.id,
      email: user.email,
      provider: user.provider,
      validated: true,
      timestamp: Date.now()
    }, ttl, { batch: true });
  }

  async getCachedTokenValidation(tokenHash) {
    const key = `token:${tokenHash}`;
    return await this.get(key);
  }

  // User profile caching
  async cacheUserProfile(userId, profile, ttl = 3600) {
    const key = `user:${userId}`;

    await this.set(key, {
      ...profile,
      cached: true,
      cacheTime: Date.now()
    }, ttl);
  }

  async getCachedUserProfile(userId) {
    const key = `user:${userId}`;
    return await this.get(key);
  }

  // Session caching
  async cacheSession(sessionId, sessionData, ttl = 900) {
    const key = `session:${sessionId}`;

    await this.set(key, sessionData, ttl, { skipL1: true }); // Sessions only in Redis
  }

  async getCachedSession(sessionId) {
    const key = `session:${sessionId}`;
    return await this.get(key, { skipL1: true });
  }

  // Provider metadata caching (long TTL)
  async cacheProviderMetadata(provider, metadata, ttl = 86400) {
    const key = `provider:${provider}`;

    await this.set(key, metadata, ttl);
  }

  // Cache warming strategies
  async warmCache() {
    console.log('Starting cache warming...');

    // Warm frequently accessed user profiles
    await this.warmUserProfiles();

    // Warm provider configurations
    await this.warmProviderConfigs();

    console.log('Cache warming completed');
  }

  async warmUserProfiles() {
    const db = require('../config/database');

    // Get most recently active users
    const result = await db.query(`
      SELECT id, profile, provider, last_login
      FROM sso_users
      WHERE active = true
      AND last_login > NOW() - INTERVAL '7 days'
      ORDER BY last_login DESC
      LIMIT 1000
    `);

    for (const user of result.rows) {
      await this.cacheUserProfile(user.id, {
        profile: user.profile,
        provider: user.provider,
        lastLogin: user.last_login
      });
    }

    console.log(`Warmed ${result.rows.length} user profiles`);
  }

  async warmProviderConfigs() {
    const providers = ['google', 'microsoft', 'saml'];

    for (const provider of providers) {
      const config = require(`../config/${provider}`);

      await this.cacheProviderMetadata(provider, {
        scopes: config.scopes,
        endpoints: config.endpoints,
        options: config.options
      });
    }

    console.log(`Warmed ${providers.length} provider configurations`);
  }

  // Cache invalidation
  async invalidateUser(userId) {
    const keys = [`user:${userId}`];

    // Find related session keys
    const sessionKeys = await this.l2Cache.keys(`session:*`);
    const userSessions = [];

    // This is expensive - consider using a reverse index
    for (const key of sessionKeys) {
      const session = await this.getCachedSession(key.split(':')[1]);
      if (session && session.userId === userId) {
        userSessions.push(key);
      }
    }

    keys.push(...userSessions);

    // Batch delete
    if (keys.length > 0) {
      await this.l2Cache.del(...keys);

      // Remove from L1 cache
      keys.forEach(key => this.l1Cache.delete(key));
    }

    console.log(`Invalidated ${keys.length} cache entries for user ${userId}`);
  }

  // Performance monitoring
  recordCacheOperation(operation, result, duration) {
    const monitor = require('./PerformanceMonitor');
    monitor.recordCacheOperation(operation, result);

    if (duration > 50) { // Log slow cache operations
      console.warn(`Slow cache operation: ${operation} (${result}) took ${duration}ms`);
    }
  }

  // Cache statistics
  getStats() {
    return {
      ...this.stats,
      l1Size: this.l1Cache.size,
      l1Max: this.l1Cache.max,
      hitRate: {
        l1: this.stats.l1.hits / (this.stats.l1.hits + this.stats.l1.misses),
        l2: this.stats.l2.hits / (this.stats.l2.hits + this.stats.l2.misses),
        overall: (this.stats.l1.hits + this.stats.l2.hits) /
                (this.stats.l1.hits + this.stats.l1.misses + this.stats.l2.hits + this.stats.l2.misses)
      }
    };
  }

  // Graceful shutdown
  async close() {
    // Process any remaining batches
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      await this.processBatch();
    }

    await this.l2Cache.quit();
  }
}

module.exports = new OptimizedCacheManager();
```

## 🔧 Application-Level Optimizations

### JWT Token Optimization

```javascript
// services/OptimizedTokenService.js
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

class OptimizedTokenService {
  constructor() {
    // Pre-load and cache signing keys
    this.signingKeys = new Map();
    this.publicKeys = new Map();

    this.loadSigningKeys();

    // Token validation cache
    this.validationCache = new Map();

    // Cleanup validation cache every 5 minutes
    setInterval(() => this.cleanupValidationCache(), 5 * 60 * 1000);
  }

  async loadSigningKeys() {
    const fs = require('fs').promises;

    try {
      const privateKey = await fs.readFile(process.env.JWT_PRIVATE_KEY_PATH);
      const publicKey = await fs.readFile(process.env.JWT_PUBLIC_KEY_PATH);

      this.signingKeys.set('current', privateKey);
      this.publicKeys.set('current', publicKey);

      console.log('✓ JWT keys loaded and cached');
    } catch (error) {
      console.error('Failed to load JWT keys:', error);
      throw error;
    }
  }

  // Optimized token generation with minimal payload
  generateAccessToken(user, sessionId) {
    const now = Math.floor(Date.now() / 1000);

    // Minimal payload for performance
    const payload = {
      sub: user.id,
      email: user.email,
      sid: sessionId,

      // Standard claims
      iss: process.env.JWT_ISSUER,
      aud: process.env.JWT_AUDIENCE,
      iat: now,
      exp: now + 900, // 15 minutes
      nbf: now - 30   // Allow 30 second clock skew
    };

    const options = {
      algorithm: 'RS256',
      keyid: 'current'
    };

    return jwt.sign(payload, this.signingKeys.get('current'), options);
  }

  // High-performance token validation with caching
  async validateAccessToken(token, options = {}) {
    const { skipCache = false, allowExpired = false } = options;

    // Check validation cache first
    if (!skipCache) {
      const cached = this.validationCache.get(token);
      if (cached) {
        if (cached.error) {
          throw new Error(cached.error);
        }
        return cached.payload;
      }
    }

    const startTime = Date.now();

    try {
      // Fast decode to check basic structure
      const decoded = jwt.decode(token, { complete: true });

      if (!decoded) {
        throw new Error('Invalid token format');
      }

      // Check expiration before expensive verification
      if (!allowExpired && decoded.payload.exp < Math.floor(Date.now() / 1000)) {
        throw new Error('Token expired');
      }

      // Verify signature
      const publicKey = this.publicKeys.get(decoded.header.kid || 'current');

      if (!publicKey) {
        throw new Error('Invalid key ID');
      }

      const payload = jwt.verify(token, publicKey, {
        algorithms: ['RS256'],
        issuer: process.env.JWT_ISSUER,
        audience: process.env.JWT_AUDIENCE,
        clockTolerance: 30 // 30 seconds
      });

      // Cache successful validation (short TTL)
      if (!skipCache) {
        const remainingTTL = (payload.exp * 1000) - Date.now();
        const cacheTTL = Math.min(remainingTTL, 5 * 60 * 1000); // Max 5 minutes

        setTimeout(() => {
          this.validationCache.delete(token);
        }, cacheTTL);

        this.validationCache.set(token, { payload });
      }

      const duration = Date.now() - startTime;

      // Record performance metrics
      const monitor = require('./PerformanceMonitor');
      monitor.recordTokenValidation('access', 'success', duration);

      return payload;

    } catch (error) {
      const duration = Date.now() - startTime;

      // Cache validation failures (short TTL to avoid cache poisoning)
      if (!skipCache && duration > 10) { // Only cache if validation took significant time
        setTimeout(() => {
          this.validationCache.delete(token);
        }, 60000); // 1 minute

        this.validationCache.set(token, { error: error.message });
      }

      // Record performance metrics
      const monitor = require('./PerformanceMonitor');
      monitor.recordTokenValidation('access', 'error', duration);

      throw error;
    }
  }

  // Batch token validation for multiple tokens
  async validateTokensBatch(tokens) {
    const results = new Map();
    const uncachedTokens = [];

    // Check cache first
    tokens.forEach(token => {
      const cached = this.validationCache.get(token);
      if (cached) {
        results.set(token, cached);
      } else {
        uncachedTokens.push(token);
      }
    });

    // Validate uncached tokens in parallel
    if (uncachedTokens.length > 0) {
      const validationPromises = uncachedTokens.map(async token => {
        try {
          const payload = await this.validateAccessToken(token, { skipCache: true });
          return { token, success: true, payload };
        } catch (error) {
          return { token, success: false, error: error.message };
        }
      });

      const validationResults = await Promise.all(validationPromises);

      validationResults.forEach(({ token, success, payload, error }) => {
        const result = success ? { payload } : { error };
        results.set(token, result);

        // Cache result
        this.validationCache.set(token, result);
      });
    }

    return results;
  }

  cleanupValidationCache() {
    // Remove expired entries from validation cache
    const now = Date.now();
    let cleaned = 0;

    for (const [token, cached] of this.validationCache.entries()) {
      if (cached.payload && cached.payload.exp * 1000 < now) {
        this.validationCache.delete(token);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`Cleaned ${cleaned} expired token validations from cache`);
    }
  }

  // Token introspection with caching
  async introspectToken(token) {
    try {
      const payload = await this.validateAccessToken(token);

      return {
        active: true,
        sub: payload.sub,
        email: payload.email,
        exp: payload.exp,
        iat: payload.iat,
        iss: payload.iss,
        aud: payload.aud,
        scope: payload.scope || 'read'
      };
    } catch (error) {
      return {
        active: false,
        error: error.message
      };
    }
  }

  // Get cache statistics
  getStats() {
    return {
      validationCacheSize: this.validationCache.size,
      keysLoaded: this.signingKeys.size,
      publicKeysLoaded: this.publicKeys.size
    };
  }
}

module.exports = new OptimizedTokenService();
```

### Request Processing Optimization

```javascript
// middleware/OptimizedMiddleware.js
const compression = require('compression');
const responseTime = require('response-time');

class OptimizedMiddleware {
  constructor() {
    this.requestQueue = [];
    this.processing = false;

    // Request deduplication cache
    this.requestCache = new Map();

    // Response caching for idempotent requests
    this.responseCache = new Map();
  }

  // Compression middleware with optimized settings
  getCompressionMiddleware() {
    return compression({
      threshold: 1024, // Only compress responses larger than 1KB
      level: 6,        // Balanced compression level
      filter: (req, res) => {
        // Don't compress if already cached
        if (res.get('X-From-Cache')) {
          return false;
        }

        // Custom compression logic
        const contentType = res.get('Content-Type');

        return contentType && (
          contentType.includes('application/json') ||
          contentType.includes('text/plain') ||
          contentType.includes('text/html')
        );
      }
    });
  }

  // Response time tracking
  getResponseTimeMiddleware() {
    return responseTime((req, res, time) => {
      // Record performance metrics
      const monitor = require('./PerformanceMonitor');
      monitor.recordRequestTime(req.method, req.path, res.statusCode, time);

      // Log slow requests
      if (time > 1000) {
        console.warn(`Slow request: ${req.method} ${req.path} took ${time}ms`);
      }
    });
  }

  // Request deduplication middleware
  getDeduplicationMiddleware() {
    return (req, res, next) => {
      // Only deduplicate safe methods
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        return next();
      }

      const cacheKey = this.generateRequestKey(req);
      const cached = this.requestCache.get(cacheKey);

      if (cached) {
        // Return cached response
        res.set(cached.headers);
        res.set('X-From-Cache', 'true');
        res.status(cached.status).json(cached.body);
        return;
      }

      // Override res.json to cache response
      const originalJson = res.json.bind(res);

      res.json = (body) => {
        // Cache successful responses
        if (res.statusCode < 400) {
          const cacheEntry = {
            status: res.statusCode,
            headers: Object.fromEntries(
              Object.entries(res.getHeaders()).filter(([key]) =>
                ['content-type', 'cache-control'].includes(key.toLowerCase())
              )
            ),
            body,
            timestamp: Date.now()
          };

          // Cache for 30 seconds
          this.requestCache.set(cacheKey, cacheEntry);
          setTimeout(() => {
            this.requestCache.delete(cacheKey);
          }, 30000);
        }

        return originalJson(body);
      };

      next();
    };
  }

  // Request queue for rate limiting
  queueRequest(req, res, next) {
    const priority = this.calculatePriority(req);

    this.requestQueue.push({
      req,
      res,
      next,
      priority,
      timestamp: Date.now()
    });

    this.requestQueue.sort((a, b) => b.priority - a.priority);

    if (!this.processing) {
      this.processQueue();
    }
  }

  async processQueue() {
    this.processing = true;

    while (this.requestQueue.length > 0) {
      const { req, res, next } = this.requestQueue.shift();

      try {
        await new Promise(resolve => {
          res.on('finish', resolve);
          next();
        });
      } catch (error) {
        console.error('Request processing error:', error);
      }

      // Small delay to prevent overwhelming
      await this.sleep(1);
    }

    this.processing = false;
  }

  calculatePriority(req) {
    // Higher priority for authentication requests
    if (req.path.includes('/auth/')) return 100;
    if (req.path.includes('/token/validate')) return 90;
    if (req.path.includes('/user')) return 80;

    return 50; // Default priority
  }

  generateRequestKey(req) {
    const key = `${req.method}:${req.path}:${JSON.stringify(req.query)}`;
    return crypto.createHash('md5').update(key).digest('hex');
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Memory optimization middleware
  getMemoryOptimizationMiddleware() {
    return (req, res, next) => {
      // Limit request size
      req.on('data', (chunk) => {
        req.body = (req.body || '') + chunk;

        if (req.body.length > 10 * 1024 * 1024) { // 10MB limit
          res.status(413).json({
            error: 'payload_too_large',
            message: 'Request payload exceeds size limit'
          });
          return;
        }
      });

      // Cleanup after response
      res.on('finish', () => {
        req.body = null;
        req.user = null;

        // Force garbage collection for large responses
        if (process.memoryUsage().heapUsed > 200 * 1024 * 1024) { // 200MB
          setImmediate(() => {
            if (global.gc) {
              global.gc();
            }
          });
        }
      });

      next();
    };
  }

  // Error handling optimization
  getErrorHandlingMiddleware() {
    return (error, req, res, next) => {
      // Log error with performance context
      const errorId = crypto.randomUUID();

      console.error('Request error:', {
        errorId,
        path: req.path,
        method: req.method,
        userAgent: req.get('User-Agent'),
        error: error.message,
        stack: error.stack
      });

      // Don't expose internal errors
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        res.status(503).json({
          error: 'service_unavailable',
          message: 'Service temporarily unavailable',
          errorId
        });
      } else {
        res.status(500).json({
          error: 'internal_error',
          message: 'An unexpected error occurred',
          errorId
        });
      }
    };
  }

  // Get all optimized middleware
  getAll() {
    return [
      this.getCompressionMiddleware(),
      this.getResponseTimeMiddleware(),
      this.getDeduplicationMiddleware(),
      this.getMemoryOptimizationMiddleware()
    ];
  }
}

module.exports = new OptimizedMiddleware();
```

## 📈 Load Balancing and Scaling

### Load Balancer Configuration

```nginx
# nginx/sso-optimized.conf
upstream sso_backend {
    # Least connections algorithm for better distribution
    least_conn;

    # Backend servers with health checks
    server sso-service-1:3000 max_fails=3 fail_timeout=30s weight=1;
    server sso-service-2:3000 max_fails=3 fail_timeout=30s weight=1;
    server sso-service-3:3000 max_fails=3 fail_timeout=30s weight=1;

    # Keep alive connections
    keepalive 32;
    keepalive_requests 100;
    keepalive_timeout 60s;
}

# Rate limiting zones
limit_req_zone $binary_remote_addr zone=auth_limit:10m rate=10r/m;
limit_req_zone $binary_remote_addr zone=token_limit:10m rate=60r/m;
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=100r/m;

# Connection limiting
limit_conn_zone $binary_remote_addr zone=conn_limit:10m;

server {
    listen 443 ssl http2;
    server_name auth.yourapp.com;

    # SSL optimization
    ssl_certificate /etc/ssl/certs/auth.crt;
    ssl_certificate_key /etc/ssl/private/auth.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security headers
    add_header Strict-Transport-Security "max-age=63072000" always;
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;

    # Connection limiting
    limit_conn conn_limit 20;

    # Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types application/json text/plain text/css application/javascript;

    # Authentication endpoints with strict rate limiting
    location ~ ^/api/v2/auth/(google|microsoft|saml)/(authorize|callback) {
        limit_req zone=auth_limit burst=5 nodelay;

        proxy_pass http://sso_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts
        proxy_connect_timeout 5s;
        proxy_send_timeout 10s;
        proxy_read_timeout 10s;

        # Keep alive
        proxy_http_version 1.1;
        proxy_set_header Connection "";
    }

    # Token validation with moderate rate limiting
    location /api/v2/token/ {
        limit_req zone=token_limit burst=20 nodelay;

        proxy_pass http://sso_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

        # Caching for successful token validations
        proxy_cache_valid 200 30s;
        proxy_cache_key "$request_uri|$http_authorization";

        # Shorter timeouts for token operations
        proxy_connect_timeout 2s;
        proxy_send_timeout 5s;
        proxy_read_timeout 5s;
    }

    # General API endpoints
    location /api/v2/ {
        limit_req zone=api_limit burst=50 nodelay;

        proxy_pass http://sso_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

        # Standard timeouts
        proxy_connect_timeout 5s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }

    # Health check endpoint (no rate limiting)
    location /health {
        proxy_pass http://sso_backend;
        proxy_connect_timeout 2s;
        proxy_send_timeout 2s;
        proxy_read_timeout 2s;
    }
}
```

### Auto-scaling Configuration

```yaml
# k8s/hpa.yml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: sso-service-hpa
  namespace: auth
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: sso-service

  minReplicas: 3
  maxReplicas: 20

  metrics:
  # CPU utilization target
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70

  # Memory utilization target
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80

  # Custom metrics: requests per second
  - type: Pods
    pods:
      metric:
        name: requests_per_second
      target:
        type: AverageValue
        averageValue: "100"

  # Scale-up/down behavior
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 10
        periodSeconds: 60
```

---

This performance optimization guide provides comprehensive strategies for maximizing SSO system performance across all layers. The optimizations focus on reducing latency, improving throughput, and ensuring scalability while maintaining security standards.

**Next**: Review [Compliance Documentation](../compliance/) for regulatory requirements or [API Documentation](../api/) for detailed endpoint specifications.