'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.getSupportedPlugins =
  exports.getSupportedAdapters =
  exports.createStoragePlugin =
  exports.createStorageAdapter =
  exports.StorageFactory =
    void 0;
const SQLiteAdapter_1 = require('./adapters/SQLiteAdapter');
const PostgreSQLAdapter_1 = require('./adapters/PostgreSQLAdapter');
const MemoryAdapter_1 = require('./adapters/MemoryAdapter');
const PatternDetectionPlugin_1 = require('./plugins/PatternDetectionPlugin');
const CodeAnalysisPlugin_1 = require('./plugins/CodeAnalysisPlugin');
const TemplateEnginePlugin_1 = require('./plugins/TemplateEnginePlugin');
const AnalyticsPlugin_1 = require('./plugins/AnalyticsPlugin');
class StorageFactory {
  static SUPPORTED_ADAPTERS = {
    sqlite: SQLiteAdapter_1.SQLiteAdapter,
    postgresql: PostgreSQLAdapter_1.PostgreSQLAdapter,
    mysql: null,
    memory: MemoryAdapter_1.MemoryAdapter,
  };
  static SUPPORTED_PLUGINS = {
    'pattern-detection': PatternDetectionPlugin_1.PatternDetectionPlugin,
    'code-analysis': CodeAnalysisPlugin_1.CodeAnalysisPlugin,
    'template-engine': TemplateEnginePlugin_1.TemplateEnginePlugin,
    analytics: AnalyticsPlugin_1.AnalyticsPlugin,
  };
  static createAdapter(type, config) {
    const AdapterClass = this.SUPPORTED_ADAPTERS[type];
    if (!AdapterClass) {
      throw new Error(`Unsupported adapter type: ${type}`);
    }
    const adapterConfig = this.createAdapterConfig(type, config);
    return new AdapterClass(adapterConfig);
  }
  static getSupportedAdapterTypes() {
    return Object.keys(this.SUPPORTED_ADAPTERS).filter(
      type => this.SUPPORTED_ADAPTERS[type] !== null
    );
  }
  static isAdapterSupported(type) {
    return type in this.SUPPORTED_ADAPTERS && this.SUPPORTED_ADAPTERS[type] !== null;
  }
  static getDefaultAdapterConfig(type) {
    switch (type) {
      case 'sqlite':
        return {
          maxConnections: 1,
          connectionTimeout: 30000,
          queryTimeout: 10000,
          retryAttempts: 3,
          enableWAL: true,
          enableForeignKeys: true,
          pragma: {
            journal_mode: 'WAL',
            synchronous: 'NORMAL',
            cache_size: -64000,
            foreign_keys: 'ON',
            temp_store: 'MEMORY',
            mmap_size: 268435456,
          },
          performanceTuning: {
            enableQueryPlan: true,
            enableStatistics: true,
            autoVacuum: true,
            analysisInterval: 3600000,
          },
          security: {
            enableEncryption: false,
            enableAudit: false,
            auditLevel: 'minimal',
          },
          backup: {
            enableWALCheckpoint: true,
            checkpointInterval: 300000,
            backupOnClose: true,
          },
        };
      case 'postgresql':
        return {
          maxConnections: 10,
          connectionTimeout: 30000,
          queryTimeout: 30000,
          retryAttempts: 3,
          enableWAL: false,
          enableForeignKeys: true,
          pragma: {
            shared_preload_libraries: 'pg_stat_statements',
            max_connections: '100',
            shared_buffers: '256MB',
            effective_cache_size: '1GB',
            maintenance_work_mem: '64MB',
            checkpoint_completion_target: '0.9',
            wal_buffers: '16MB',
            default_statistics_target: '100',
          },
          performanceTuning: {
            enableQueryPlan: true,
            enableStatistics: true,
            autoVacuum: true,
            analysisInterval: 3600000,
          },
          security: {
            enableEncryption: true,
            enableAudit: true,
            auditLevel: 'standard',
          },
          backup: {
            enableWALCheckpoint: false,
            checkpointInterval: 0,
            backupOnClose: false,
          },
        };
      case 'memory':
        return {
          maxConnections: 1,
          connectionTimeout: 1000,
          queryTimeout: 5000,
          retryAttempts: 1,
          enableWAL: false,
          enableForeignKeys: false,
          pragma: {},
          performanceTuning: {
            enableQueryPlan: false,
            enableStatistics: false,
            autoVacuum: false,
            analysisInterval: 0,
          },
          security: {
            enableEncryption: false,
            enableAudit: false,
            auditLevel: 'minimal',
          },
          backup: {
            enableWALCheckpoint: false,
            checkpointInterval: 0,
            backupOnClose: false,
          },
        };
      default:
        return {};
    }
  }
  static createPlugin(name, config) {
    const PluginClass = this.SUPPORTED_PLUGINS[name];
    if (!PluginClass) {
      throw new Error(`Unsupported plugin: ${name}`);
    }
    return new PluginClass(config);
  }
  static getSupportedPlugins() {
    return Object.keys(this.SUPPORTED_PLUGINS);
  }
  static isPluginSupported(name) {
    return name in this.SUPPORTED_PLUGINS;
  }
  static getPluginsForMVP(mvpVersion) {
    const plugins = [];
    if (mvpVersion >= 2) {
      plugins.push('pattern-detection');
    }
    if (mvpVersion >= 3) {
      plugins.push('code-analysis');
    }
    if (mvpVersion >= 4) {
      plugins.push('template-engine');
    }
    if (mvpVersion >= 5) {
      plugins.push('analytics');
    }
    return plugins;
  }
  static createMVPPlugins(mvpVersion, config) {
    const pluginNames = this.getPluginsForMVP(mvpVersion);
    return pluginNames.map(name => this.createPlugin(name, config));
  }
  static createAdapterConfig(type, config) {
    const defaultConfig = this.getDefaultAdapterConfig(type);
    const mergedConfig = this.mergeConfigs(defaultConfig, config);
    return {
      connectionString: this.buildConnectionString(type, config),
      maxConnections: mergedConfig.maxConnections || 1,
      connectionTimeout: mergedConfig.connectionTimeout || 30000,
      queryTimeout: mergedConfig.queryTimeout || 10000,
      retryAttempts: mergedConfig.retryAttempts || 3,
      enableWAL: mergedConfig.enableWAL || false,
      enableForeignKeys: mergedConfig.enableForeignKeys || true,
      pragma: mergedConfig.pragma || {},
      performanceTuning: {
        enableQueryPlan: mergedConfig.performanceTuning?.enableQueryPlan || false,
        enableStatistics: mergedConfig.performanceTuning?.enableStatistics || false,
        autoVacuum: mergedConfig.performanceTuning?.autoVacuum || true,
        analysisInterval: mergedConfig.performanceTuning?.analysisInterval || 3600000,
      },
      security: {
        enableEncryption: mergedConfig.security?.enableEncryption || false,
        encryptionKey: mergedConfig.security?.encryptionKey,
        enableAudit: mergedConfig.security?.enableAudit || false,
        auditLevel: mergedConfig.security?.auditLevel || 'minimal',
      },
      backup: {
        enableWALCheckpoint: mergedConfig.backup?.enableWALCheckpoint || false,
        checkpointInterval: mergedConfig.backup?.checkpointInterval || 0,
        backupOnClose: mergedConfig.backup?.backupOnClose || false,
      },
    };
  }
  static buildConnectionString(type, config) {
    switch (type) {
      case 'sqlite':
        return config.path || './knowledge.db';
      case 'postgresql':
        const pg = config;
        return `postgresql://${pg.credentials?.username || 'postgres'}:${pg.credentials?.password || ''}@${pg.host || 'localhost'}:${pg.port || 5432}/${pg.database || 'knowledge'}${pg.credentials?.ssl ? '?sslmode=require' : ''}`;
      case 'mysql':
        const mysql = config;
        return `mysql://${mysql.credentials?.username || 'root'}:${mysql.credentials?.password || ''}@${mysql.host || 'localhost'}:${mysql.port || 3306}/${mysql.database || 'knowledge'}`;
      case 'memory':
        return ':memory:';
      default:
        throw new Error(`Cannot build connection string for adapter type: ${type}`);
    }
  }
  static mergeConfigs(defaultConfig, userConfig) {
    if (!userConfig) return defaultConfig;
    const result = { ...defaultConfig };
    for (const key in userConfig) {
      if (
        userConfig[key] &&
        typeof userConfig[key] === 'object' &&
        !Array.isArray(userConfig[key])
      ) {
        result[key] = this.mergeConfigs(result[key] || {}, userConfig[key]);
      } else {
        result[key] = userConfig[key];
      }
    }
    return result;
  }
  static validateAdapterConfig(type, config) {
    const errors = [];
    switch (type) {
      case 'sqlite':
        if (!config.path && config.path !== ':memory:') {
          errors.push('SQLite adapter requires a path configuration');
        }
        break;
      case 'postgresql':
        if (!config.host) {
          errors.push('PostgreSQL adapter requires host configuration');
        }
        if (!config.credentials?.username) {
          errors.push('PostgreSQL adapter requires username in credentials');
        }
        if (!config.credentials?.password) {
          errors.push('PostgreSQL adapter requires password in credentials');
        }
        if (!config.database) {
          errors.push('PostgreSQL adapter requires database name');
        }
        break;
      case 'mysql':
        if (!config.host) {
          errors.push('MySQL adapter requires host configuration');
        }
        if (!config.credentials?.username) {
          errors.push('MySQL adapter requires username in credentials');
        }
        if (!config.database) {
          errors.push('MySQL adapter requires database name');
        }
        break;
      case 'memory':
        break;
      default:
        errors.push(`Unsupported adapter type: ${type}`);
    }
    return {
      valid: errors.length === 0,
      errors,
    };
  }
  static getRecommendedAdapter(environment) {
    switch (environment) {
      case 'development':
        return 'sqlite';
      case 'testing':
        return 'memory';
      case 'production':
        return 'postgresql';
      case 'memory':
        return 'memory';
      default:
        return 'sqlite';
    }
  }
  static detectBestAdapter() {
    if (process.env.DATABASE_URL || process.env.POSTGRES_URL) {
      return 'postgresql';
    }
    if (process.env.MYSQL_URL || process.env.MYSQL_HOST) {
      return 'mysql';
    }
    if (process.env.NODE_ENV === 'test') {
      return 'memory';
    }
    return 'sqlite';
  }
  static createAdapterFromEnvironment() {
    const type = this.detectBestAdapter();
    let config;
    switch (type) {
      case 'postgresql':
        config = {
          host: process.env.POSTGRES_HOST || process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.POSTGRES_PORT || process.env.DB_PORT || '5432'),
          database: process.env.POSTGRES_DB || process.env.DB_NAME || 'knowledge',
          credentials: {
            username: process.env.POSTGRES_USER || process.env.DB_USER || 'postgres',
            password: process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD || '',
            ssl: process.env.POSTGRES_SSL === 'true' || process.env.DB_SSL === 'true',
          },
        };
        break;
      case 'mysql':
        config = {
          host: process.env.MYSQL_HOST || process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.MYSQL_PORT || process.env.DB_PORT || '3306'),
          database: process.env.MYSQL_DATABASE || process.env.DB_NAME || 'knowledge',
          credentials: {
            username: process.env.MYSQL_USER || process.env.DB_USER || 'root',
            password: process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD || '',
          },
        };
        break;
      case 'sqlite':
        config = {
          path: process.env.SQLITE_PATH || process.env.DB_PATH || './knowledge.db',
        };
        break;
      case 'memory':
      default:
        config = {};
        break;
    }
    return this.createAdapter(type, config);
  }
}
exports.StorageFactory = StorageFactory;
exports.createStorageAdapter = StorageFactory.createAdapter.bind(StorageFactory);
exports.createStoragePlugin = StorageFactory.createPlugin.bind(StorageFactory);
exports.getSupportedAdapters = StorageFactory.getSupportedAdapterTypes.bind(StorageFactory);
exports.getSupportedPlugins = StorageFactory.getSupportedPlugins.bind(StorageFactory);
//# sourceMappingURL=StorageFactory.js.map
