'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.ServiceUtils =
  exports.resetGlobalServiceFactory =
  exports.setGlobalServiceFactory =
  exports.getGlobalServiceFactory =
  exports.ServiceFactory =
  exports.ExportImportServiceFactory =
  exports.EnhancedValidationService =
  exports.DataTransformer =
  exports.FormatConverter =
  exports.ImportService =
  exports.ExportService =
  exports.ImportExportService =
  exports.MetricsService =
  exports.CacheService =
  exports.SearchService =
  exports.ValidationService =
  exports.KnowledgeBaseService =
    void 0;
exports.initializeProductionServices = initializeProductionServices;
exports.initializeDevelopmentServices = initializeDevelopmentServices;
exports.initializeTestServices = initializeTestServices;
exports.createMinimalKBService = createMinimalKBService;
exports.performHealthCheck = performHealthCheck;
exports.benchmarkServices = benchmarkServices;
const tslib_1 = require('tslib');
const KnowledgeBaseService_1 = require('./KnowledgeBaseService');
Object.defineProperty(exports, 'KnowledgeBaseService', {
  enumerable: true,
  get() {
    return tslib_1.__importDefault(KnowledgeBaseService_1).default;
  },
});
const ValidationService_1 = require('./ValidationService');
Object.defineProperty(exports, 'ValidationService', {
  enumerable: true,
  get() {
    return tslib_1.__importDefault(ValidationService_1).default;
  },
});
const SearchService_1 = require('./SearchService');
Object.defineProperty(exports, 'SearchService', {
  enumerable: true,
  get() {
    return tslib_1.__importDefault(SearchService_1).default;
  },
});
const CacheService_1 = require('./CacheService');
Object.defineProperty(exports, 'CacheService', {
  enumerable: true,
  get() {
    return tslib_1.__importDefault(CacheService_1).default;
  },
});
const MetricsService_1 = require('./MetricsService');
Object.defineProperty(exports, 'MetricsService', {
  enumerable: true,
  get() {
    return tslib_1.__importDefault(MetricsService_1).default;
  },
});
const ImportExportService_1 = require('./ImportExportService');
Object.defineProperty(exports, 'ImportExportService', {
  enumerable: true,
  get() {
    return tslib_1.__importDefault(ImportExportService_1).default;
  },
});
const export_1 = require('./storage/export');
Object.defineProperty(exports, 'ExportService', {
  enumerable: true,
  get() {
    return export_1.ExportService;
  },
});
Object.defineProperty(exports, 'ImportService', {
  enumerable: true,
  get() {
    return export_1.ImportService;
  },
});
Object.defineProperty(exports, 'FormatConverter', {
  enumerable: true,
  get() {
    return export_1.FormatConverter;
  },
});
Object.defineProperty(exports, 'DataTransformer', {
  enumerable: true,
  get() {
    return export_1.DataTransformer;
  },
});
Object.defineProperty(exports, 'EnhancedValidationService', {
  enumerable: true,
  get() {
    return export_1.ValidationService;
  },
});
Object.defineProperty(exports, 'ExportImportServiceFactory', {
  enumerable: true,
  get() {
    return export_1.ExportImportServiceFactory;
  },
});
const ServiceFactory_1 = require('./ServiceFactory');
Object.defineProperty(exports, 'ServiceFactory', {
  enumerable: true,
  get() {
    return tslib_1.__importDefault(ServiceFactory_1).default;
  },
});
Object.defineProperty(exports, 'getGlobalServiceFactory', {
  enumerable: true,
  get() {
    return ServiceFactory_1.getGlobalServiceFactory;
  },
});
Object.defineProperty(exports, 'setGlobalServiceFactory', {
  enumerable: true,
  get() {
    return ServiceFactory_1.setGlobalServiceFactory;
  },
});
Object.defineProperty(exports, 'resetGlobalServiceFactory', {
  enumerable: true,
  get() {
    return ServiceFactory_1.resetGlobalServiceFactory;
  },
});
tslib_1.__exportStar(require('../types/services'), exports);
const ServiceFactory_2 = tslib_1.__importDefault(require('./ServiceFactory'));
async function initializeProductionServices(configOverrides) {
  const factory = ServiceFactory_2.default.createProductionFactory(configOverrides);
  await factory.initialize();
  return factory;
}
async function initializeDevelopmentServices(configOverrides) {
  const factory = ServiceFactory_2.default.createDevelopmentFactory(configOverrides);
  await factory.initialize();
  return factory;
}
async function initializeTestServices(configOverrides) {
  const factory = ServiceFactory_2.default.createTestFactory(configOverrides);
  await factory.initialize();
  return factory;
}
async function createMinimalKBService(dbPath) {
  const { KnowledgeBaseService, ValidationService, SearchService } = await Promise.resolve().then(
    () => tslib_1.__importStar(require('./'))
  );
  const config = {
    database: {
      path: dbPath || './minimal-kb.db',
      pragmas: {
        journal_mode: 'WAL',
        synchronous: 'NORMAL',
        cache_size: -8000,
        foreign_keys: 'ON',
      },
      backup: { enabled: false, interval: 0, retention: 0, path: '' },
      performance: { connectionPool: 1, busyTimeout: 5000, cacheSize: 8000 },
    },
    validation: {
      strict: false,
      sanitize: true,
      maxLength: { title: 200, problem: 5000, solution: 10000, tags: 50 },
      minLength: { title: 5, problem: 10, solution: 10 },
      patterns: {
        tag: /^[a-zA-Z0-9-_]+$/,
        category: ['JCL', 'VSAM', 'DB2', 'Batch', 'Functional', 'Other'],
      },
    },
    search: {
      fts: { tokenize: 'porter', remove_diacritics: 1, categories: 'simple' },
      ai: { enabled: false, fallback: true, timeout: 5000, retries: 2, batchSize: 10 },
      cache: { enabled: false, ttl: 0, maxSize: 0 },
    },
    cache: { maxSize: 100, ttl: 300000, checkPeriod: 600000, strategy: 'lru', persistent: false },
    metrics: {
      enabled: false,
      retention: 0,
      aggregation: { enabled: false, interval: 0, batch: 0 },
      alerts: { enabled: false, thresholds: {} },
    },
    logging: {
      level: 'info',
      file: { enabled: false, path: '', maxSize: 0, maxFiles: 0 },
      console: true,
      structured: false,
    },
  };
  const validationService = new ValidationService(config.validation);
  const searchService = new SearchService();
  const kbService = new KnowledgeBaseService(config, validationService, searchService);
  await kbService.initialize();
  return {
    kbService,
    validationService,
    searchService,
    async close() {
      await kbService.close();
    },
  };
}
async function performHealthCheck(factory) {
  const startTime = Date.now();
  const result = await factory.healthCheck();
  const endTime = Date.now();
  const serviceDetails = {};
  let healthyCount = 0;
  let unhealthyCount = 0;
  Object.entries(result.services).forEach(([name, health]) => {
    if (health.healthy) {
      healthyCount++;
      serviceDetails[name] = {
        status: 'healthy',
        responseTime: endTime - startTime,
      };
    } else {
      unhealthyCount++;
      serviceDetails[name] = {
        status: 'unhealthy',
        error: health.error,
        responseTime: endTime - startTime,
      };
    }
  });
  let overall = 'healthy';
  if (unhealthyCount > 0) {
    overall = unhealthyCount >= healthyCount ? 'unhealthy' : 'degraded';
  }
  return {
    overall,
    services: serviceDetails,
    summary: {
      healthy: healthyCount,
      unhealthy: unhealthyCount,
      total: healthyCount + unhealthyCount,
      timestamp: new Date(),
    },
  };
}
async function benchmarkServices(factory, options = {}) {
  const { iterations = 100, includeSearch = true, includeCRUD = true, sampleSize = 10 } = options;
  const results = {};
  const kbService = factory.getKnowledgeBaseService();
  const cacheService = factory.getCacheService();
  let totalOperations = 0;
  let totalTime = 0;
  if (includeCRUD) {
    const createTimes = [];
    for (let i = 0; i < sampleSize; i++) {
      const start = Date.now();
      await kbService.create({
        title: `Benchmark Entry ${i}`,
        problem: `Test problem ${i} for benchmarking performance`,
        solution: `Test solution ${i} for benchmarking performance measurement`,
        category: 'Other',
        tags: [`benchmark-${i}`, 'performance-test'],
      });
      createTimes.push(Date.now() - start);
    }
    results['kb_create'] = {
      operation: 'Knowledge Base Create',
      averageTime: createTimes.reduce((a, b) => a + b, 0) / createTimes.length,
      minTime: Math.min(...createTimes),
      maxTime: Math.max(...createTimes),
      iterations: sampleSize,
      throughput: 1000 / (createTimes.reduce((a, b) => a + b, 0) / createTimes.length),
    };
    totalOperations += sampleSize;
    totalTime += createTimes.reduce((a, b) => a + b, 0);
  }
  if (includeSearch) {
    const searchTimes = [];
    const searchQueries = ['test', 'error', 'problem', 'solution', 'benchmark'];
    for (let i = 0; i < iterations; i++) {
      const query = searchQueries[i % searchQueries.length];
      const start = Date.now();
      await kbService.search(query, { limit: 10 });
      searchTimes.push(Date.now() - start);
    }
    results['kb_search'] = {
      operation: 'Knowledge Base Search',
      averageTime: searchTimes.reduce((a, b) => a + b, 0) / searchTimes.length,
      minTime: Math.min(...searchTimes),
      maxTime: Math.max(...searchTimes),
      iterations,
      throughput: 1000 / (searchTimes.reduce((a, b) => a + b, 0) / searchTimes.length),
    };
    totalOperations += iterations;
    totalTime += searchTimes.reduce((a, b) => a + b, 0);
  }
  const cacheTimes = [];
  for (let i = 0; i < iterations; i++) {
    const key = `benchmark-key-${i}`;
    const value = `benchmark-value-${i}`;
    const start = Date.now();
    await cacheService.set(key, value);
    await cacheService.get(key);
    cacheTimes.push(Date.now() - start);
  }
  results['cache_set_get'] = {
    operation: 'Cache Set+Get',
    averageTime: cacheTimes.reduce((a, b) => a + b, 0) / cacheTimes.length,
    minTime: Math.min(...cacheTimes),
    maxTime: Math.max(...cacheTimes),
    iterations,
    throughput: 1000 / (cacheTimes.reduce((a, b) => a + b, 0) / cacheTimes.length),
  };
  totalOperations += iterations;
  totalTime += cacheTimes.reduce((a, b) => a + b, 0);
  return {
    results,
    summary: {
      totalTime,
      totalOperations,
      overallThroughput: totalOperations / (totalTime / 1000),
    },
  };
}
exports.ServiceUtils = {
  createStandardEntry: input => ({
    title: input.title.trim(),
    problem: input.problem.trim(),
    solution: input.solution.trim(),
    category: input.category,
    tags: (input.tags || []).map(tag => tag.trim().toLowerCase()),
    created_by: 'user',
  }),
  parseSearchQuery: query => {
    const operators = {};
    let cleanQuery = query;
    const categoryMatch = query.match(/category:(\w+)/i);
    if (categoryMatch) {
      operators.category = categoryMatch[1];
      cleanQuery = cleanQuery.replace(/category:\w+/i, '').trim();
    }
    const tagMatches = query.match(/tag:(\w+)/gi);
    if (tagMatches) {
      operators.tags = tagMatches.map(match => match.replace(/tag:/i, ''));
      cleanQuery = cleanQuery.replace(/tag:\w+/gi, '').trim();
    }
    return {
      query: cleanQuery,
      operators,
    };
  },
  formatEntryForDisplay: entry => ({
    id: entry.id,
    title: entry.title,
    category: entry.category,
    tags: entry.tags,
    summary: `${entry.problem.substring(0, 100)}...`,
    usage: entry.usage_count || 0,
    successRate:
      entry.success_count + entry.failure_count > 0
        ? Math.round((entry.success_count / (entry.success_count + entry.failure_count)) * 100)
        : 0,
    lastUpdated: entry.updated_at,
  }),
  calculateKBStats: entries => {
    const categoryCount = {};
    const tagCount = {};
    let totalUsage = 0;
    let totalSuccess = 0;
    let totalFailure = 0;
    entries.forEach(entry => {
      categoryCount[entry.category] = (categoryCount[entry.category] || 0) + 1;
      entry.tags?.forEach(tag => {
        tagCount[tag] = (tagCount[tag] || 0) + 1;
      });
      totalUsage += entry.usage_count || 0;
      totalSuccess += entry.success_count || 0;
      totalFailure += entry.failure_count || 0;
    });
    return {
      totalEntries: entries.length,
      categories: categoryCount,
      topTags: Object.entries(tagCount)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10),
      usage: {
        total: totalUsage,
        average: totalUsage / entries.length,
        successRate:
          totalSuccess + totalFailure > 0 ? totalSuccess / (totalSuccess + totalFailure) : 0,
      },
    };
  },
};
//# sourceMappingURL=index.js.map
