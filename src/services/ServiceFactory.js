'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.ServiceFactory = void 0;
exports.getGlobalServiceFactory = getGlobalServiceFactory;
exports.setGlobalServiceFactory = setGlobalServiceFactory;
exports.resetGlobalServiceFactory = resetGlobalServiceFactory;
const tslib_1 = require('tslib');
const services_1 = require('../types/services');
const KnowledgeBaseService_1 = tslib_1.__importDefault(require('./KnowledgeBaseService'));
const ValidationService_1 = tslib_1.__importDefault(require('./ValidationService'));
const SearchService_1 = tslib_1.__importDefault(require('./SearchService'));
const CacheService_1 = tslib_1.__importDefault(require('./CacheService'));
const MetricsService_1 = tslib_1.__importDefault(require('./MetricsService'));
const ImportExportService_1 = tslib_1.__importDefault(require('./ImportExportService'));
class ServiceFactory {
  config;
  instances = {};
  initialized = false;
  initializationPromise;
  dependencies = {
    knowledgeBaseService: [],
    validationService: [],
    searchService: [],
    cacheService: [],
    metricsService: [],
    importExportService: ['knowledgeBaseService', 'validationService'],
  };
  constructor(config = services_1.DEFAULT_SERVICE_CONFIG) {
    this.config = config;
  }
  async initialize() {
    if (this.initialized) {
      return;
    }
    if (this.initializationPromise) {
      return this.initializationPromise;
    }
    this.initializationPromise = this.doInitialize();
    return this.initializationPromise;
  }
  getKnowledgeBaseService() {
    if (!this.instances.knowledgeBaseService) {
      throw new services_1.ServiceError(
        'KnowledgeBaseService not initialized',
        'SERVICE_NOT_INITIALIZED'
      );
    }
    return this.instances.knowledgeBaseService;
  }
  getValidationService() {
    if (!this.instances.validationService) {
      throw new services_1.ServiceError(
        'ValidationService not initialized',
        'SERVICE_NOT_INITIALIZED'
      );
    }
    return this.instances.validationService;
  }
  getSearchService() {
    if (!this.instances.searchService) {
      throw new services_1.ServiceError('SearchService not initialized', 'SERVICE_NOT_INITIALIZED');
    }
    return this.instances.searchService;
  }
  getCacheService() {
    if (!this.instances.cacheService) {
      throw new services_1.ServiceError('CacheService not initialized', 'SERVICE_NOT_INITIALIZED');
    }
    return this.instances.cacheService;
  }
  getMetricsService() {
    if (!this.instances.metricsService) {
      throw new services_1.ServiceError(
        'MetricsService not initialized',
        'SERVICE_NOT_INITIALIZED'
      );
    }
    return this.instances.metricsService;
  }
  getImportExportService() {
    if (!this.instances.importExportService) {
      throw new services_1.ServiceError(
        'ImportExportService not initialized',
        'SERVICE_NOT_INITIALIZED'
      );
    }
    return this.instances.importExportService;
  }
  getAllServices() {
    return { ...this.instances };
  }
  async healthCheck() {
    const serviceHealth = {};
    let overallHealthy = true;
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
        switch (serviceName) {
          case 'knowledgeBaseService':
            await service.getMetrics();
            break;
          case 'validationService':
            service.validateEntry({
              title: 'test',
              problem: 'test',
              solution: 'test',
              category: 'Other',
            });
            break;
          case 'searchService':
            await service.suggest('test', 1);
            break;
          case 'cacheService':
            service.stats();
            break;
          case 'metricsService':
            await service.getMetrics();
            break;
          case 'importExportService':
            service.getFormats();
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
  async close() {
    const closePromises = [];
    const closeOrder = [
      'importExportService',
      'metricsService',
      'cacheService',
      'searchService',
      'validationService',
      'knowledgeBaseService',
    ];
    for (const serviceName of closeOrder) {
      const service = this.instances[serviceName];
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
  async restartService(serviceName) {
    const service = this.instances[serviceName];
    if (service && 'close' in service && typeof service.close === 'function') {
      await service.close();
    }
    this.instances[serviceName] = undefined;
    await this.initializeService(serviceName);
    console.info(`Service ${serviceName} restarted successfully`);
  }
  updateConfiguration(newConfig) {
    this.config = {
      ...this.config,
      ...newConfig,
      database: { ...this.config.database, ...newConfig.database },
      search: { ...this.config.search, ...newConfig.search },
      cache: { ...this.config.cache, ...newConfig.cache },
      metrics: { ...this.config.metrics, ...newConfig.metrics },
      validation: { ...this.config.validation, ...newConfig.validation },
      logging: { ...this.config.logging, ...newConfig.logging },
    };
    console.info('Service configuration updated');
  }
  getConfiguration() {
    return { ...this.config };
  }
  registerCustomService(serviceName, serviceInstance) {
    if (this.initialized) {
      throw new services_1.ServiceError(
        'Cannot register services after initialization',
        'ALREADY_INITIALIZED'
      );
    }
    this.instances[serviceName] = serviceInstance;
    console.info(`Custom ${serviceName} registered`);
  }
  async doInitialize() {
    try {
      console.info('Initializing services...');
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
      await this.close();
      throw new services_1.ServiceError(
        `Service initialization failed: ${error.message}`,
        'INITIALIZATION_FAILED',
        500,
        { originalError: error }
      );
    }
  }
  async initializeService(serviceName) {
    if (this.instances[serviceName]) {
      return;
    }
    const deps = this.dependencies[serviceName];
    for (const dep of deps) {
      await this.initializeService(dep);
    }
    switch (serviceName) {
      case 'knowledgeBaseService':
        this.instances.knowledgeBaseService = new KnowledgeBaseService_1.default(
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
        this.instances.validationService = new ValidationService_1.default(this.config.validation);
        break;
      case 'searchService':
        this.instances.searchService = new SearchService_1.default(this.config.gemini);
        break;
      case 'cacheService':
        this.instances.cacheService = new CacheService_1.default(this.config.cache);
        break;
      case 'metricsService':
        this.instances.metricsService = new MetricsService_1.default(
          this.config.metrics,
          this.config.database.path.replace('.db', '-metrics.db')
        );
        break;
      case 'importExportService':
        if (!this.instances.knowledgeBaseService) {
          throw new services_1.ServiceError(
            'KnowledgeBaseService required for ImportExportService',
            'DEPENDENCY_MISSING'
          );
        }
        this.instances.importExportService = new ImportExportService_1.default(
          this.instances.knowledgeBaseService,
          this.instances.validationService
        );
        break;
      default:
        throw new services_1.ServiceError(`Unknown service: ${serviceName}`, 'UNKNOWN_SERVICE');
    }
    console.info(`${serviceName} initialized`);
  }
  static createProductionFactory(overrides = {}) {
    const productionConfig = {
      ...services_1.DEFAULT_SERVICE_CONFIG,
      database: {
        ...services_1.DEFAULT_SERVICE_CONFIG.database,
        pragmas: {
          ...services_1.DEFAULT_SERVICE_CONFIG.database.pragmas,
          cache_size: -128000,
          mmap_size: 536870912,
          temp_store: 'MEMORY',
          optimize: 1,
        },
        backup: {
          enabled: true,
          interval: 1800000,
          retention: 24,
          path: './backups/production',
        },
        performance: {
          connectionPool: 10,
          busyTimeout: 30000,
          cacheSize: 128000,
        },
      },
      cache: {
        maxSize: 50000,
        ttl: 600000,
        checkPeriod: 300000,
        strategy: 'lru',
        persistent: true,
      },
      metrics: {
        enabled: true,
        retention: 7776000000,
        aggregation: {
          enabled: true,
          interval: 1800000,
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
          maxSize: 52428800,
          maxFiles: 10,
        },
        console: false,
        structured: true,
      },
      ...overrides,
    };
    return new ServiceFactory(productionConfig);
  }
  static createDevelopmentFactory(overrides = {}) {
    const developmentConfig = {
      ...services_1.DEFAULT_SERVICE_CONFIG,
      database: {
        ...services_1.DEFAULT_SERVICE_CONFIG.database,
        path: './dev-knowledge.db',
        backup: {
          enabled: true,
          interval: 3600000,
          retention: 5,
          path: './backups/dev',
        },
      },
      cache: {
        maxSize: 1000,
        ttl: 300000,
        checkPeriod: 600000,
        strategy: 'lru',
        persistent: false,
      },
      metrics: {
        enabled: true,
        retention: 604800000,
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
        maxLength: services_1.DEFAULT_SERVICE_CONFIG.validation.maxLength,
        minLength: services_1.DEFAULT_SERVICE_CONFIG.validation.minLength,
        patterns: services_1.DEFAULT_SERVICE_CONFIG.validation.patterns,
      },
      logging: {
        level: 'debug',
        file: {
          enabled: true,
          path: './logs/dev',
          maxSize: 10485760,
          maxFiles: 3,
        },
        console: true,
        structured: false,
      },
      ...overrides,
    };
    return new ServiceFactory(developmentConfig);
  }
  static createTestFactory(overrides = {}) {
    const testConfig = {
      ...services_1.DEFAULT_SERVICE_CONFIG,
      database: {
        ...services_1.DEFAULT_SERVICE_CONFIG.database,
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
        ttl: 60000,
        checkPeriod: 10000,
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
exports.ServiceFactory = ServiceFactory;
exports.default = ServiceFactory;
let globalServiceFactory;
function getGlobalServiceFactory() {
  if (!globalServiceFactory) {
    globalServiceFactory = ServiceFactory.createProductionFactory();
  }
  return globalServiceFactory;
}
function setGlobalServiceFactory(factory) {
  globalServiceFactory = factory;
}
function resetGlobalServiceFactory() {
  globalServiceFactory = undefined;
}
//# sourceMappingURL=ServiceFactory.js.map
