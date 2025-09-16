import { CacheOrchestratorConfig } from '../../services/cache/CacheOrchestrator';

export const createCacheConfig = (): CacheOrchestratorConfig => {
  const isProduction = process.env.NODE_ENV === 'production';
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  return {
    layers: [
      {
        name: 'memory',
        priority: 1,
        enabled: true
      },
      {
        name: 'redis',
        priority: 2,
        enabled: isProduction || process.env.REDIS_ENABLED === 'true'
      }
    ],
    strategy: {
      readThrough: true,
      writeThrough: true,
      writeBehind: false,
      failover: true
    },
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
      maxRetries: 3,
      retryDelayOnFailover: 100,
      enableOfflineQueue: false,
      lazyConnect: true,
      keyPrefix: process.env.REDIS_KEY_PREFIX || 'mainframe:',
      ttl: {
        default: 300,    // 5 minutes
        short: 60,       // 1 minute
        medium: 900,     // 15 minutes
        long: 3600       // 1 hour
      }
    },
    memory: {
      maxSize: isDevelopment ? 1000 : 5000,
      defaultTTL: 300, // 5 minutes
      cleanupInterval: 60000, // 1 minute
      enableLRU: true,
      maxMemoryUsage: isDevelopment ? 50 * 1024 * 1024 : 200 * 1024 * 1024 // 50MB dev, 200MB prod
    },
    queryCache: {
      enabled: true,
      defaultTTL: 600, // 10 minutes
      maxQueries: 1000
    }
  };
};

export const CDN_CONFIG = {
  enabled: process.env.CDN_ENABLED === 'true',
  baseUrl: process.env.CDN_BASE_URL || '',
  staticAssets: {
    css: {
      maxAge: 86400, // 24 hours
      public: true,
      immutable: true
    },
    js: {
      maxAge: 86400, // 24 hours
      public: true,
      immutable: true
    },
    images: {
      maxAge: 604800, // 7 days
      public: true,
      immutable: false
    },
    fonts: {
      maxAge: 2592000, // 30 days
      public: true,
      immutable: true
    }
  },
  api: {
    maxAge: 300, // 5 minutes
    public: false,
    staleWhileRevalidate: 60
  }
};

export const BROWSER_CACHE_CONFIG = {
  // Static assets - long cache
  static: {
    maxAge: 31536000, // 1 year
    public: true,
    immutable: true
  },
  // API responses - short cache
  api: {
    maxAge: 300, // 5 minutes
    public: false,
    mustRevalidate: true
  },
  // HTML pages - minimal cache
  html: {
    maxAge: 0,
    public: false,
    noCache: true
  },
  // Search results - medium cache
  search: {
    maxAge: 900, // 15 minutes
    public: false,
    staleWhileRevalidate: 300
  }
};

export const CACHE_WARMING_CONFIG = {
  enabled: process.env.CACHE_WARMING === 'true',
  strategies: {
    startup: {
      enabled: true,
      delay: 5000, // 5 seconds after startup
      entries: [
        {
          pattern: 'search:popular:*',
          priority: 10,
          ttl: 3600
        },
        {
          pattern: 'kb:categories:*',
          priority: 8,
          ttl: 7200
        },
        {
          pattern: 'user:preferences:*',
          priority: 5,
          ttl: 1800
        }
      ]
    },
    scheduled: {
      enabled: true,
      interval: 3600000, // 1 hour
      entries: [
        {
          pattern: 'analytics:*',
          priority: 3,
          ttl: 900
        }
      ]
    }
  }
};

export const CACHE_INVALIDATION_CONFIG = {
  strategies: {
    // Time-based invalidation
    ttl: {
      enabled: true,
      checkInterval: 60000 // 1 minute
    },
    // Tag-based invalidation
    tags: {
      enabled: true,
      patterns: {
        'search': ['search:*', 'query:search:*'],
        'kb': ['kb:*', 'knowledge:*'],
        'user': ['user:*', 'auth:*'],
        'database': ['db:*', 'query:db:*']
      }
    },
    // Event-based invalidation
    events: {
      enabled: true,
      triggers: {
        'kb:entry:updated': ['kb:*', 'search:*'],
        'user:login': ['user:*'],
        'database:schema:changed': ['db:*']
      }
    }
  }
};

export const PERFORMANCE_TARGETS = {
  hitRate: {
    memory: 85, // 85% hit rate for memory cache
    redis: 70,  // 70% hit rate for Redis cache
    overall: 90 // 90% overall hit rate
  },
  responseTime: {
    memory: 5,    // 5ms for memory cache
    redis: 50,    // 50ms for Redis cache
    overall: 1000 // 1 second overall target
  },
  memoryUsage: {
    maxPercent: 80, // Max 80% of allocated memory
    alertThreshold: 70 // Alert at 70%
  }
};