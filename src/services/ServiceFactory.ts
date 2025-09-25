/**
 * ServiceFactory - Dependency injection and service orchestration
 * Production-ready service factory with lifecycle management and configuration
 */

import {
  IKnowledgeBaseService,
  IValidationService,
  ISearchService,
  ICacheService,
  IMetricsService,
  IImportExportService,
  ServiceConfig,
  DEFAULT_SERVICE_CONFIG,
  ServiceError,
} from '../types/services';

import KnowledgeBaseService from './KnowledgeBaseService';
import ValidationService from './ValidationService';
import SearchService from './SearchService';
import CacheService from './CacheService';
import MetricsService from './MetricsService';
import ImportExportService from './ImportExportService';

interface ServiceInstances {
  knowledgeBaseService?: IKnowledgeBaseService;
  validationService?: IValidationService;
  searchService?: ISearchService;
  cacheService?: ICacheService;
  metricsService?: IMetricsService;
  importExportService?: IImportExportService;
}

interface ServiceDependencies {
  knowledgeBaseService: (keyof ServiceInstances)[];
  validationService: (keyof ServiceInstances)[];
  searchService: (keyof ServiceInstances)[];
  cacheService: (keyof ServiceInstances)[];
  metricsService: (keyof ServiceInstances)[];
  importExportService: (keyof ServiceInstances)[];
}

/**
 * Service Factory with Dependency Injection
 * Manages service lifecycle, configuration, and dependencies
 */
export class ServiceFactory {
  private instances: ServiceInstances = {};
  private initialized = false;
  private initializationPromise?: Promise<void>;

  // Define service dependencies (which services depend on others)
  private dependencies: ServiceDependencies = {
    knowledgeBaseService: [], // No dependencies
    validationService: [], // No dependencies
    searchService: [], // No dependencies
    cacheService: [], // No dependencies
    metricsService: [], // No dependencies
    importExportService: ['knowledgeBaseService', 'validationService'], // Depends on KB and Validation
  };

  constructor(private config: ServiceConfig = DEFAULT_SERVICE_CONFIG) {}

  /**
   * Initialize all services in correct dependency order
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.doInitialize();
    return this.initializationPromise;
  }

  /**
   * Get Knowledge Base Service instance
   */
  getKnowledgeBaseService(): IKnowledgeBaseService {
    if (!this.instances.knowledgeBaseService) {
      throw new ServiceError('KnowledgeBaseService not initialized', 'SERVICE_NOT_INITIALIZED');
    }
    return this.instances.knowledgeBaseService;
  }

  /**
   * Get Validation Service instance
   */
  getValidationService(): IValidationService {
    if (!this.instances.validationService) {
      throw new ServiceError('ValidationService not initialized', 'SERVICE_NOT_INITIALIZED');
    }
    return this.instances.validationService;
  }

  /**
   * Get Search Service instance
   */
  getSearchService(): ISearchService {
    if (!this.instances.searchService) {
      throw new ServiceError('SearchService not initialized', 'SERVICE_NOT_INITIALIZED');
    }
    return this.instances.searchService;
  }

  /**
   * Get Cache Service instance
   */
  getCacheService(): ICacheService {
    if (!this.instances.cacheService) {
      throw new ServiceError('CacheService not initialized', 'SERVICE_NOT_INITIALIZED');
    }
    return this.instances.cacheService;
  }

  /**
   * Get Metrics Service instance
   */
  getMetricsService(): IMetricsService {
    if (!this.instances.metricsService) {
      throw new ServiceError('MetricsService not initialized', 'SERVICE_NOT_INITIALIZED');
    }
    return this.instances.metricsService;
  }

  /**
   * Get Import/Export Service instance
   */
  getImportExportService(): IImportExportService {
    if (!this.instances.importExportService) {
      throw new ServiceError('ImportExportService not initialized', 'SERVICE_NOT_INITIALIZED');
    }
    return this.instances.importExportService;
  }

  /**
   * Get all initialized services
   */
  getAllServices(): ServiceInstances {
    return { ...this.instances };
  }

  /**
   * Check if all services are healthy
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    services: Record<string, { healthy: boolean; error?: string }>;
  }> {
    const serviceHealth: Record<string, { healthy: boolean; error?: string }> = {};
    let overallHealthy = true;

    // Check each service
    for (const [serviceName, service] of Object.entries(this.instances)) {
      if (!service) {
        serviceHealth[serviceName] = {
          healthy: false,
          error: 'Service not initialized',
        };
        overallHealthy = false;
        continue;
      }

      try {
        // Basic health check - try to call a simple method
        switch (serviceName) {
          case 'knowledgeBaseService':
            await (service as IKnowledgeBaseService).getMetrics();
            break;
          case 'validationService':
            (service as IValidationService).validateEntry({
              title: 'test',
              problem: 'test',
              solution: 'test',
              category: 'Other',
            });
            break;
          case 'searchService':
            await (service as ISearchService).suggest('test', 1);
            break;
          case 'cacheService':
            (service as ICacheService).stats();
            break;
          case 'metricsService':
            await (service as IMetricsService).getMetrics();
            break;
          case 'importExportService':
            (service as IImportExportService).getFormats();
            break;
        }

        serviceHealth[serviceName] = { healthy: true };
      } catch (error) {
        serviceHealth[serviceName] = {
          healthy: false,
          error: error.message,
        };
        overallHealthy = false;
      }
    }

    return {
      healthy: overallHealthy,
      services: serviceHealth,
    };
  }

  /**
   * Close all services and cleanup resources
   */
  async close(): Promise<void> {
    const closePromises: Promise<void>[] = [];

    // Close services in reverse dependency order
    const closeOrder = [
      'importExportService',
      'metricsService',
      'cacheService',
      'searchService',
      'validationService',
      'knowledgeBaseService',
    ];

    for (const serviceName of closeOrder) {
      const service = this.instances[serviceName as keyof ServiceInstances];
      if (service && 'close' in service && typeof service.close === 'function') {
        closePromises.push(service.close());
      }
    }

    await Promise.all(closePromises);

    this.instances = {};
    this.initialized = false;
    this.initializationPromise = undefined;

    console.info('All services closed successfully');
  }

  /**
   * Restart a specific service
   */
  async restartService(serviceName: keyof ServiceInstances): Promise<void> {
    const service = this.instances[serviceName];
    if (service && 'close' in service && typeof service.close === 'function') {
      await service.close();
    }

    // Remove the service instance
    this.instances[serviceName] = undefined;

    // Reinitialize the service and its dependents
    await this.initializeService(serviceName);

    console.info(`Service ${serviceName} restarted successfully`);
  }

  /**
   * Update service configuration
   */
  updateConfiguration(newConfig: Partial<ServiceConfig>): void {
    this.config = {
      ...this.config,
      ...newConfig,
      // Deep merge for nested objects
      database: { ...this.config.database, ...newConfig.database },
      search: { ...this.config.search, ...newConfig.search },
      cache: { ...this.config.cache, ...newConfig.cache },
      metrics: { ...this.config.metrics, ...newConfig.metrics },
      validation: { ...this.config.validation, ...newConfig.validation },
      logging: { ...this.config.logging, ...newConfig.logging },
    };

    console.info('Service configuration updated');
  }

  /**
   * Get current configuration
   */
  getConfiguration(): ServiceConfig {
    return { ...this.config };
  }

  /**
   * Register custom service implementations (for testing or customization)
   */
  registerCustomService<T extends keyof ServiceInstances>(
    serviceName: T,
    serviceInstance: ServiceInstances[T]
  ): void {
    if (this.initialized) {
      throw new ServiceError(
        'Cannot register services after initialization',
        'ALREADY_INITIALIZED'
      );
    }

    this.instances[serviceName] = serviceInstance;
    console.info(`Custom ${serviceName} registered`);
  }

  // =========================
  // Private Methods
  // =========================

  private async doInitialize(): Promise<void> {
    try {
      console.info('Initializing services...');

      // Initialize services in dependency order
      await this.initializeService('validationService');
      await this.initializeService('cacheService');
      await this.initializeService('searchService');
      await this.initializeService('metricsService');
      await this.initializeService('knowledgeBaseService');
      await this.initializeService('importExportService');

      this.initialized = true;
      console.info('All services initialized successfully');
    } catch (error) {
      console.error('Service initialization failed:', error);

      // Cleanup any partially initialized services
      await this.close();

      throw new ServiceError(
        `Service initialization failed: ${error.message}`,
        'INITIALIZATION_FAILED',
        500,
        { originalError: error }
      );
    }
  }

  private async initializeService(serviceName: keyof ServiceInstances): Promise<void> {
    if (this.instances[serviceName]) {
      return; // Already initialized
    }

    // Initialize dependencies first
    const deps = this.dependencies[serviceName];
    for (const dep of deps) {
      await this.initializeService(dep);
    }

    // Create and initialize the service
    switch (serviceName) {
      case 'knowledgeBaseService':
        this.instances.knowledgeBaseService = new KnowledgeBaseService(
          this.config,
          this.instances.validationService,
          this.instances.searchService,
          this.instances.cacheService,
          this.instances.metricsService,
          this.instances.importExportService
        );
        await this.instances.knowledgeBaseService.initialize();
        break;

      case 'validationService':
        this.instances.validationService = new ValidationService(this.config.validation);
        break;

      case 'searchService':
        this.instances.searchService = new SearchService(this.config.gemini);
        break;

      case 'cacheService':
        this.instances.cacheService = new CacheService(this.config.cache);
        break;

      case 'metricsService':
        this.instances.metricsService = new MetricsService(
          this.config.metrics,
          this.config.database.path.replace('.db', '-metrics.db')
        );
        break;

      case 'importExportService':
        if (!this.instances.knowledgeBaseService) {
          throw new ServiceError(
            'KnowledgeBaseService required for ImportExportService',
            'DEPENDENCY_MISSING'
          );
        }
        this.instances.importExportService = new ImportExportService(
          this.instances.knowledgeBaseService,
          this.instances.validationService
        );
        break;

      default:
        throw new ServiceError(`Unknown service: ${serviceName}`, 'UNKNOWN_SERVICE');
    }

    console.info(`${serviceName} initialized`);
  }

  /**
   * Create a production-ready service factory with optimized configuration
   */
  static createProductionFactory(overrides: Partial<ServiceConfig> = {}): ServiceFactory {
    const productionConfig: ServiceConfig = {
      ...DEFAULT_SERVICE_CONFIG,
      database: {
        ...DEFAULT_SERVICE_CONFIG.database,
        pragmas: {
          ...DEFAULT_SERVICE_CONFIG.database.pragmas,
          cache_size: -128000, // 128MB cache
          mmap_size: 536870912, // 512MB memory mapping
          temp_store: 'MEMORY',
          optimize: 1,
        },
        backup: {
          enabled: true,
          interval: 1800000, // 30 minutes
          retention: 24, // 24 backups
          path: './backups/production',
        },
        performance: {
          connectionPool: 10,
          busyTimeout: 30000,
          cacheSize: 128000,
        },
      },
      cache: {
        maxSize: 50000, // 50k entries
        ttl: 600000, // 10 minutes
        checkPeriod: 300000, // 5 minutes
        strategy: 'lru',
        persistent: true,
      },
      metrics: {
        enabled: true,
        retention: 7776000000, // 90 days
        aggregation: {
          enabled: true,
          interval: 1800000, // 30 minutes
          batch: 5000,
        },
        alerts: {
          enabled: true,
          thresholds: {
            searchTime: 2000,
            errorRate: 0.02,
            cacheHitRate: 0.85,
            dbTime: 500,
          },
        },
      },
      validation: {
        strict: false,
        sanitize: true,
        maxLength: {
          title: 300,
          problem: 10000,
          solution: 20000,
          tags: 100,
        },
        minLength: {
          title: 10,
          problem: 20,
          solution: 20,
        },
        patterns: {
          tag: /^[a-zA-Z0-9\-_\s]+$/,
          category: ['JCL', 'VSAM', 'DB2', 'Batch', 'Functional', 'IMS', 'CICS', 'System', 'Other'],
        },
      },
      logging: {
        level: 'info',
        file: {
          enabled: true,
          path: './logs/production',
          maxSize: 52428800, // 50MB
          maxFiles: 10,
        },
        console: false,
        structured: true,
      },
      ...overrides,
    };

    return new ServiceFactory(productionConfig);
  }

  /**
   * Create a development-friendly service factory
   */
  static createDevelopmentFactory(overrides: Partial<ServiceConfig> = {}): ServiceFactory {
    const developmentConfig: ServiceConfig = {
      ...DEFAULT_SERVICE_CONFIG,
      database: {
        ...DEFAULT_SERVICE_CONFIG.database,
        path: './dev-knowledge.db',
        backup: {
          enabled: true,
          interval: 3600000, // 1 hour
          retention: 5,
          path: './backups/dev',
        },
      },
      cache: {
        maxSize: 1000,
        ttl: 300000, // 5 minutes
        checkPeriod: 600000, // 10 minutes
        strategy: 'lru',
        persistent: false,
      },
      metrics: {
        enabled: true,
        retention: 604800000, // 7 days
        aggregation: {
          enabled: false,
          interval: 3600000,
          batch: 100,
        },
        alerts: {
          enabled: false,
          thresholds: {},
        },
      },
      validation: {
        strict: false,
        sanitize: true,
        maxLength: DEFAULT_SERVICE_CONFIG.validation.maxLength,
        minLength: DEFAULT_SERVICE_CONFIG.validation.minLength,
        patterns: DEFAULT_SERVICE_CONFIG.validation.patterns,
      },
      logging: {
        level: 'debug',
        file: {
          enabled: true,
          path: './logs/dev',
          maxSize: 10485760, // 10MB
          maxFiles: 3,
        },
        console: true,
        structured: false,
      },
      ...overrides,
    };

    return new ServiceFactory(developmentConfig);
  }

  /**
   * Create a test-friendly service factory with in-memory databases
   */
  static createTestFactory(overrides: Partial<ServiceConfig> = {}): ServiceFactory {
    const testConfig: ServiceConfig = {
      ...DEFAULT_SERVICE_CONFIG,
      database: {
        ...DEFAULT_SERVICE_CONFIG.database,
        path: ':memory:',
        backup: {
          enabled: false,
          interval: 0,
          retention: 0,
          path: '',
        },
      },
      cache: {
        maxSize: 100,
        ttl: 60000, // 1 minute
        checkPeriod: 10000, // 10 seconds
        strategy: 'lru',
        persistent: false,
      },
      metrics: {
        enabled: false,
        retention: 0,
        aggregation: {
          enabled: false,
          interval: 0,
          batch: 0,
        },
        alerts: {
          enabled: false,
          thresholds: {},
        },
      },
      logging: {
        level: 'error',
        file: {
          enabled: false,
          path: '',
          maxSize: 0,
          maxFiles: 0,
        },
        console: false,
        structured: false,
      },
      ...overrides,
    };

    return new ServiceFactory(testConfig);
  }
}

export default ServiceFactory;

/**
 * Convenience function to create a singleton service factory
 */
let globalServiceFactory: ServiceFactory | undefined;

export function getGlobalServiceFactory(): ServiceFactory {
  if (!globalServiceFactory) {
    globalServiceFactory = ServiceFactory.createProductionFactory();
  }
  return globalServiceFactory;
}

export function setGlobalServiceFactory(factory: ServiceFactory): void {
  globalServiceFactory = factory;
}

export function resetGlobalServiceFactory(): void {
  globalServiceFactory = undefined;
}
