/**
 * Storage Factory
 * Creates storage adapters and plugins using the Factory pattern
 * 
 * This factory provides a centralized way to create storage components,
 * ensuring proper configuration and dependency injection.
 */

import { IStorageAdapter, AdapterType, AdapterConfig } from './adapters/IStorageAdapter';
import { SQLiteAdapter } from './adapters/SQLiteAdapter';
import { PostgreSQLAdapter } from './adapters/PostgreSQLAdapter';
import { MemoryAdapter } from './adapters/MemoryAdapter';
import { IStoragePlugin } from './IStorageService';
import { PatternDetectionPlugin } from './plugins/PatternDetectionPlugin';
import { CodeAnalysisPlugin } from './plugins/CodeAnalysisPlugin';
import { TemplateEnginePlugin } from './plugins/TemplateEnginePlugin';
import { AnalyticsPlugin } from './plugins/AnalyticsPlugin';

export class StorageFactory {
  private static readonly SUPPORTED_ADAPTERS: Record<AdapterType, typeof IStorageAdapter> = {
    sqlite: SQLiteAdapter as any,
    postgresql: PostgreSQLAdapter as any,
    mysql: null as any, // Not implemented yet
    memory: MemoryAdapter as any
  };

  private static readonly SUPPORTED_PLUGINS: Record<string, typeof IStoragePlugin> = {
    'pattern-detection': PatternDetectionPlugin as any,
    'code-analysis': CodeAnalysisPlugin as any,
    'template-engine': TemplateEnginePlugin as any,
    'analytics': AnalyticsPlugin as any
  };

  // ========================
  // Adapter Factory Methods
  // ========================

  /**
   * Create a storage adapter instance
   */
  static createAdapter(type: AdapterType, config: any): IStorageAdapter {
    const AdapterClass = this.SUPPORTED_ADAPTERS[type];
    
    if (!AdapterClass) {
      throw new Error(`Unsupported adapter type: ${type}`);
    }

    const adapterConfig = this.createAdapterConfig(type, config);
    return new AdapterClass(adapterConfig) as IStorageAdapter;
  }

  /**
   * Get supported adapter types
   */
  static getSupportedAdapterTypes(): AdapterType[] {
    return Object.keys(this.SUPPORTED_ADAPTERS).filter(
      type => this.SUPPORTED_ADAPTERS[type as AdapterType] !== null
    ) as AdapterType[];
  }

  /**
   * Check if adapter type is supported
   */
  static isAdapterSupported(type: AdapterType): boolean {
    return type in this.SUPPORTED_ADAPTERS && this.SUPPORTED_ADAPTERS[type] !== null;
  }

  /**
   * Get default configuration for adapter type
   */
  static getDefaultAdapterConfig(type: AdapterType): Partial<AdapterConfig> {
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
            cache_size: -64000, // 64MB
            foreign_keys: 'ON',
            temp_store: 'MEMORY',
            mmap_size: 268435456 // 256MB
          },
          performanceTuning: {
            enableQueryPlan: true,
            enableStatistics: true,
            autoVacuum: true,
            analysisInterval: 3600000 // 1 hour
          },
          security: {
            enableEncryption: false,
            enableAudit: false,
            auditLevel: 'minimal'
          },
          backup: {
            enableWALCheckpoint: true,
            checkpointInterval: 300000, // 5 minutes
            backupOnClose: true
          }
        };

      case 'postgresql':
        return {
          maxConnections: 10,
          connectionTimeout: 30000,
          queryTimeout: 30000,
          retryAttempts: 3,
          enableWAL: false, // PostgreSQL handles this internally
          enableForeignKeys: true,
          pragma: {
            // PostgreSQL-specific settings
            shared_preload_libraries: 'pg_stat_statements',
            max_connections: '100',
            shared_buffers: '256MB',
            effective_cache_size: '1GB',
            maintenance_work_mem: '64MB',
            checkpoint_completion_target: '0.9',
            wal_buffers: '16MB',
            default_statistics_target: '100'
          },
          performanceTuning: {
            enableQueryPlan: true,
            enableStatistics: true,
            autoVacuum: true,
            analysisInterval: 3600000 // 1 hour
          },
          security: {
            enableEncryption: true,
            enableAudit: true,
            auditLevel: 'standard'
          },
          backup: {
            enableWALCheckpoint: false,
            checkpointInterval: 0,
            backupOnClose: false
          }
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
            analysisInterval: 0
          },
          security: {
            enableEncryption: false,
            enableAudit: false,
            auditLevel: 'minimal'
          },
          backup: {
            enableWALCheckpoint: false,
            checkpointInterval: 0,
            backupOnClose: false
          }
        };

      default:
        return {};
    }
  }

  // ========================
  // Plugin Factory Methods
  // ========================

  /**
   * Create a storage plugin instance
   */
  static createPlugin(name: string, config?: any): IStoragePlugin {
    const PluginClass = this.SUPPORTED_PLUGINS[name];
    
    if (!PluginClass) {
      throw new Error(`Unsupported plugin: ${name}`);
    }

    return new PluginClass(config) as IStoragePlugin;
  }

  /**
   * Get supported plugin names
   */
  static getSupportedPlugins(): string[] {
    return Object.keys(this.SUPPORTED_PLUGINS);
  }

  /**
   * Check if plugin is supported
   */
  static isPluginSupported(name: string): boolean {
    return name in this.SUPPORTED_PLUGINS;
  }

  /**
   * Get plugins for MVP version
   */
  static getPluginsForMVP(mvpVersion: number): string[] {
    const plugins: string[] = [];
    
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

  /**
   * Create all plugins for MVP version
   */
  static createMVPPlugins(mvpVersion: number, config?: any): IStoragePlugin[] {
    const pluginNames = this.getPluginsForMVP(mvpVersion);
    return pluginNames.map(name => this.createPlugin(name, config));
  }

  // ========================
  // Configuration Helpers
  // ========================

  /**
   * Create adapter configuration from provided config
   */
  private static createAdapterConfig(type: AdapterType, config: any): AdapterConfig {
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
        analysisInterval: mergedConfig.performanceTuning?.analysisInterval || 3600000
      },
      security: {
        enableEncryption: mergedConfig.security?.enableEncryption || false,
        encryptionKey: mergedConfig.security?.encryptionKey,
        enableAudit: mergedConfig.security?.enableAudit || false,
        auditLevel: mergedConfig.security?.auditLevel || 'minimal'
      },
      backup: {
        enableWALCheckpoint: mergedConfig.backup?.enableWALCheckpoint || false,
        checkpointInterval: mergedConfig.backup?.checkpointInterval || 0,
        backupOnClose: mergedConfig.backup?.backupOnClose || false
      }
    };
  }

  /**
   * Build connection string for adapter type
   */
  private static buildConnectionString(type: AdapterType, config: any): string {
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

  /**
   * Deep merge configuration objects
   */
  private static mergeConfigs(defaultConfig: any, userConfig: any): any {
    if (!userConfig) return defaultConfig;
    
    const result = { ...defaultConfig };
    
    for (const key in userConfig) {
      if (userConfig[key] && typeof userConfig[key] === 'object' && !Array.isArray(userConfig[key])) {
        result[key] = this.mergeConfigs(result[key] || {}, userConfig[key]);
      } else {
        result[key] = userConfig[key];
      }
    }
    
    return result;
  }

  // ========================
  // Validation Methods
  // ========================

  /**
   * Validate adapter configuration
   */
  static validateAdapterConfig(type: AdapterType, config: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
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
        // Memory adapter has no specific requirements
        break;
      
      default:
        errors.push(`Unsupported adapter type: ${type}`);
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get recommended adapter for environment
   */
  static getRecommendedAdapter(environment: 'development' | 'testing' | 'production' | 'memory'): AdapterType {
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

  // ========================
  // Adapter Detection
  // ========================

  /**
   * Detect best adapter based on environment
   */
  static detectBestAdapter(): AdapterType {
    // Check for PostgreSQL
    if (process.env.DATABASE_URL || process.env.POSTGRES_URL) {
      return 'postgresql';
    }
    
    // Check for MySQL
    if (process.env.MYSQL_URL || process.env.MYSQL_HOST) {
      return 'mysql';
    }
    
    // Check if running in test environment
    if (process.env.NODE_ENV === 'test') {
      return 'memory';
    }
    
    // Default to SQLite
    return 'sqlite';
  }

  /**
   * Create adapter from environment variables
   */
  static createAdapterFromEnvironment(): IStorageAdapter {
    const type = this.detectBestAdapter();
    let config: any;
    
    switch (type) {
      case 'postgresql':
        config = {
          host: process.env.POSTGRES_HOST || process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.POSTGRES_PORT || process.env.DB_PORT || '5432'),
          database: process.env.POSTGRES_DB || process.env.DB_NAME || 'knowledge',
          credentials: {
            username: process.env.POSTGRES_USER || process.env.DB_USER || 'postgres',
            password: process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD || '',
            ssl: process.env.POSTGRES_SSL === 'true' || process.env.DB_SSL === 'true'
          }
        };
        break;
      
      case 'mysql':
        config = {
          host: process.env.MYSQL_HOST || process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.MYSQL_PORT || process.env.DB_PORT || '3306'),
          database: process.env.MYSQL_DATABASE || process.env.DB_NAME || 'knowledge',
          credentials: {
            username: process.env.MYSQL_USER || process.env.DB_USER || 'root',
            password: process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD || ''
          }
        };
        break;
      
      case 'sqlite':
        config = {
          path: process.env.SQLITE_PATH || process.env.DB_PATH || './knowledge.db'
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

// Export convenience functions
export const createStorageAdapter = StorageFactory.createAdapter.bind(StorageFactory);
export const createStoragePlugin = StorageFactory.createPlugin.bind(StorageFactory);
export const getSupportedAdapters = StorageFactory.getSupportedAdapterTypes.bind(StorageFactory);
export const getSupportedPlugins = StorageFactory.getSupportedPlugins.bind(StorageFactory);