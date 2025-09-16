/**
 * Consolidated Configuration Types
 *
 * This file consolidates all configuration-related interfaces and types
 * from across the codebase to eliminate duplicates and conflicts.
 */

// Base Configuration Interface
export interface BaseConfig {
  enabled: boolean;
  environment?: 'development' | 'staging' | 'production';
  version?: string;
}

// Database Configuration
export interface DatabaseConfig extends BaseConfig {
  host: string;
  port: number;
  database: string;
  username?: string;
  password?: string;
  ssl?: boolean;
  connectionPool?: {
    min: number;
    max: number;
    acquireTimeoutMillis?: number;
    idleTimeoutMillis?: number;
  };
  migrations?: {
    directory: string;
    tableName: string;
  };
  backups?: {
    enabled: boolean;
    schedule: string;
    retention: number;
  };
}

// Search Configuration
export interface SearchConfig extends BaseConfig {
  provider: 'fts5' | 'elasticsearch' | 'hybrid';
  indexing: {
    batchSize: number;
    refreshInterval: number;
    enableAutoRefresh: boolean;
  };
  cache: {
    enabled: boolean;
    ttl: number;
    maxSize: number;
  };
  performance: {
    timeoutMs: number;
    maxResults: number;
    enablePagination: boolean;
  };
  features: {
    fuzzySearch: boolean;
    autocomplete: boolean;
    highlighting: boolean;
    faceting: boolean;
  };
}

// Cache Configuration
export interface CacheConfig extends BaseConfig {
  provider: 'memory' | 'redis' | 'multi-layer';
  memory: {
    maxSize: number;
    ttl: number;
    algorithm: 'lru' | 'fifo' | 'lfu';
  };
  redis?: {
    host: string;
    port: number;
    password?: string;
    db: number;
    keyPrefix: string;
  };
  layers?: {
    l1: Partial<CacheConfig>;
    l2: Partial<CacheConfig>;
  };
  compression: boolean;
  serialization: 'json' | 'msgpack' | 'binary';
}

// Analytics Configuration
export interface AnalyticsConfig extends BaseConfig {
  provider: 'internal' | 'google' | 'mixpanel' | 'amplitude';
  trackingId?: string;
  sampling: {
    rate: number;
    events: string[];
  };
  privacy: {
    anonymizeIPs: boolean;
    respectDNT: boolean;
    cookieConsent: boolean;
  };
  reporting: {
    enabled: boolean;
    schedule: string;
    recipients: string[];
  };
}

// Logging Configuration
export interface LoggingConfig extends BaseConfig {
  level: 'debug' | 'info' | 'warn' | 'error' | 'silent';
  format: 'json' | 'text' | 'structured';
  outputs: Array<{
    type: 'console' | 'file' | 'syslog' | 'http';
    level?: string;
    config?: Record<string, any>;
  }>;
  rotation: {
    enabled: boolean;
    maxSize: string;
    maxFiles: number;
  };
  structured: {
    includeTimestamp: boolean;
    includeLevel: boolean;
    includeSource: boolean;
  };
}

// Security Configuration
export interface SecurityConfig extends BaseConfig {
  authentication: {
    provider: 'local' | 'oauth' | 'saml' | 'ldap';
    sessionTimeout: number;
    maxFailedAttempts: number;
    lockoutDuration: number;
  };
  authorization: {
    rbac: boolean;
    permissions: string[];
    defaultRole: string;
  };
  encryption: {
    algorithm: string;
    keySize: number;
    saltRounds?: number;
  };
  cors: {
    origin: string | string[];
    credentials: boolean;
    optionsSuccessStatus: number;
  };
  rateLimit: {
    windowMs: number;
    max: number;
    message: string;
  };
}

// Storage Configuration
export interface StorageConfig extends BaseConfig {
  provider: 'local' | 's3' | 'gcs' | 'azure';
  local?: {
    basePath: string;
    tempPath: string;
    maxFileSize: number;
  };
  cloud?: {
    bucket: string;
    region: string;
    credentials: {
      accessKeyId: string;
      secretAccessKey: string;
    };
  };
  backup: {
    enabled: boolean;
    schedule: string;
    retention: number;
    compression: boolean;
  };
}

// Monitoring Configuration
export interface MonitoringConfig extends BaseConfig {
  metrics: {
    enabled: boolean;
    interval: number;
    retention: number;
    exportFormat: 'prometheus' | 'statsd' | 'json';
  };
  alerts: {
    enabled: boolean;
    channels: Array<{
      type: 'email' | 'slack' | 'webhook';
      config: Record<string, any>;
    }>;
    thresholds: Record<string, number>;
  };
  healthChecks: {
    enabled: boolean;
    interval: number;
    timeout: number;
    endpoints: string[];
  };
  tracing: {
    enabled: boolean;
    sampleRate: number;
    exportUrl?: string;
  };
}

// Plugin Configuration
export interface PluginConfig extends BaseConfig {
  name: string;
  version: string;
  description?: string;
  author?: string;
  dependencies?: string[];
  permissions?: string[];
  settings?: Record<string, any>;
  hooks?: {
    [event: string]: string[];
  };
}

// Plugin Manager Configuration
export interface PluginManagerConfig extends BaseConfig {
  pluginsDirectory: string;
  autoLoad: boolean;
  security: SecurityConfig;
  storage: StorageConfig;
  maxPlugins: number;
  sandboxing: boolean;
}

// Validation Configuration
export interface ValidationConfig extends BaseConfig {
  strict: boolean;
  locale: string;
  customValidators: Record<string, Function>;
  errorMessages: Record<string, string>;
  realTime: {
    enabled: boolean;
    debounceMs: number;
    triggers: string[];
  };
  schemas: {
    enabled: boolean;
    directory: string;
    autoValidate: boolean;
  };
}

// API Configuration
export interface APIConfig extends BaseConfig {
  host: string;
  port: number;
  basePath: string;
  version: string;
  documentation: {
    enabled: boolean;
    path: string;
    title: string;
  };
  middleware: {
    cors: boolean;
    compression: boolean;
    logging: boolean;
    rateLimit: boolean;
  };
  timeout: number;
  maxRequestSize: string;
}

// Service Configuration
export interface ServiceConfig extends BaseConfig {
  name: string;
  description?: string;
  dependencies: string[];
  healthCheck: {
    enabled: boolean;
    path: string;
    interval: number;
  };
  gracefulShutdown: {
    enabled: boolean;
    timeout: number;
  };
  resources: {
    memory: string;
    cpu: string;
  };
}

// Bot/AI Configuration
export interface GeminiConfig extends BaseConfig {
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  topK: number;
  safetySettings: Array<{
    category: string;
    threshold: string;
  }>;
  generationConfig: {
    stopSequences: string[];
    candidateCount: number;
  };
}

// Real-time Configuration
export interface RealTimeConfig extends BaseConfig {
  websocket: {
    port: number;
    path: string;
    compression: boolean;
    maxConnections: number;
  };
  subscriptions: {
    maxPerClient: number;
    timeout: number;
  };
  broadcasting: {
    enabled: boolean;
    channels: string[];
  };
}

// Differential State Configuration
export interface DifferentialConfig extends BaseConfig {
  maxHistory: number;
  compressionThreshold: number;
  enableBinaryDiff: boolean;
  debounceMs: number;
  persistChanges: boolean;
  changeDetection: {
    deep: boolean;
    arrays: boolean;
    functions: boolean;
  };
}

// Profiling Configuration
export interface ProfilingConfig extends BaseConfig {
  sampling: {
    enabled: boolean;
    rate: number;
    maxSamples: number;
  };
  memory: {
    trackAllocations: boolean;
    heapSnapshots: boolean;
    gcMetrics: boolean;
  };
  cpu: {
    enabled: boolean;
    sampleInterval: number;
    maxDuration: number;
  };
  output: {
    format: 'json' | 'v8' | 'flamegraph';
    destination: string;
  };
}

// Tag Cloud Configuration
export interface TagCloudConfig extends BaseConfig {
  minFontSize: number;
  maxFontSize: number;
  minWeight: number;
  maxWeight: number;
  colors: string[];
  animation: {
    enabled: boolean;
    duration: number;
    easing: string;
  };
  layout: {
    spiral: boolean;
    padding: number;
    rotation: {
      enabled: boolean;
      angles: number[];
    };
  };
}

// Bottleneck Analysis Configuration
export interface BottleneckAnalysisConfig extends BaseConfig {
  thresholds: {
    responseTime: number;
    memoryUsage: number;
    cpuUsage: number;
    errorRate: number;
  };
  analysis: {
    windowSize: number;
    minSamples: number;
    confidenceLevel: number;
  };
  reporting: {
    autoGenerate: boolean;
    includeRecommendations: boolean;
    exportFormat: 'json' | 'pdf' | 'html';
  };
}

// Combined Application Configuration
export interface AppConfig {
  app: {
    name: string;
    version: string;
    environment: string;
  };
  database: DatabaseConfig;
  search: SearchConfig;
  cache: CacheConfig;
  security: SecurityConfig;
  monitoring: MonitoringConfig;
  logging: LoggingConfig;
  api: APIConfig;
  performance: import('./performance').PerformanceConfig;
  plugins?: PluginManagerConfig;
  analytics?: AnalyticsConfig;
  realtime?: RealTimeConfig;
}

// Type Guards
export function isDatabaseConfig(config: any): config is DatabaseConfig {
  return config && typeof config.host === 'string' && typeof config.port === 'number';
}

export function isSearchConfig(config: any): config is SearchConfig {
  return config && typeof config.provider === 'string' && config.indexing;
}

export function isCacheConfig(config: any): config is CacheConfig {
  return config && typeof config.provider === 'string' && config.memory;
}

// Default configurations
export const DEFAULT_DATABASE_CONFIG: Partial<DatabaseConfig> = {
  enabled: true,
  port: 5432,
  ssl: false,
  connectionPool: {
    min: 2,
    max: 10,
    acquireTimeoutMillis: 30000,
    idleTimeoutMillis: 30000,
  },
};

export const DEFAULT_SEARCH_CONFIG: Partial<SearchConfig> = {
  enabled: true,
  provider: 'fts5',
  indexing: {
    batchSize: 1000,
    refreshInterval: 5000,
    enableAutoRefresh: true,
  },
  cache: {
    enabled: true,
    ttl: 300000,
    maxSize: 10000,
  },
  performance: {
    timeoutMs: 5000,
    maxResults: 1000,
    enablePagination: true,
  },
  features: {
    fuzzySearch: true,
    autocomplete: true,
    highlighting: true,
    faceting: false,
  },
};

export const DEFAULT_CACHE_CONFIG: Partial<CacheConfig> = {
  enabled: true,
  provider: 'memory',
  memory: {
    maxSize: 100 * 1024 * 1024, // 100MB
    ttl: 300000, // 5 minutes
    algorithm: 'lru',
  },
  compression: false,
  serialization: 'json',
};