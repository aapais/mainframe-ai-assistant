/**
 * Service Layer Entry Point
 * Exports all production-ready services for the Mainframe KB Assistant MVP1
 */

// Core Services
export { default as KnowledgeBaseService } from './KnowledgeBaseService';
export { default as ValidationService } from './ValidationService';
export { default as SearchService } from './SearchService';
export { default as CacheService } from './CacheService';
export { default as MetricsService } from './MetricsService';
export { default as ImportExportService } from './ImportExportService';

// Incident Management Services
export { IncidentService } from './IncidentService';
export { IncidentAIService } from './IncidentAIService';
export { AIResolverService, default as AIResolver } from './aiResolver';

// Enhanced Export/Import Services
export {
  ExportService,
  ImportService,
  FormatConverter,
  DataTransformer,
  ValidationService as EnhancedValidationService,
  BatchProcessor,
  ExportImportServiceFactory
} from './storage/export';

// Service Factory and Management
export { 
  default as ServiceFactory,
  getGlobalServiceFactory,
  setGlobalServiceFactory,
  resetGlobalServiceFactory 
} from './ServiceFactory';

// Re-export all service interfaces and types
export * from '../types/services';

/**
 * Quick Start Service Initialization
 * Provides ready-to-use service configurations for different environments
 */

import ServiceFactory from './ServiceFactory';
import { ServiceConfig } from '../types/services';

/**
 * Initialize services for production use
 */
export async function initializeProductionServices(
  configOverrides?: Partial<ServiceConfig>
): Promise<ServiceFactory> {
  const factory = ServiceFactory.createProductionFactory(configOverrides);
  await factory.initialize();
  return factory;
}

/**
 * Initialize services for development use
 */
export async function initializeDevelopmentServices(
  configOverrides?: Partial<ServiceConfig>
): Promise<ServiceFactory> {
  const factory = ServiceFactory.createDevelopmentFactory(configOverrides);
  await factory.initialize();
  return factory;
}

/**
 * Initialize services for testing
 */
export async function initializeTestServices(
  configOverrides?: Partial<ServiceConfig>
): Promise<ServiceFactory> {
  const factory = ServiceFactory.createTestFactory(configOverrides);
  await factory.initialize();
  return factory;
}

/**
 * Create a minimal KB service for basic operations
 * Useful for simple scripts or lightweight integrations
 */
export async function createMinimalKBService(dbPath?: string) {
  const { KnowledgeBaseService, ValidationService, SearchService } = await import('./');
  
  const config = {
    database: {
      path: dbPath || './minimal-kb.db',
      pragmas: {
        journal_mode: 'WAL',
        synchronous: 'NORMAL',
        cache_size: -8000,
        foreign_keys: 'ON'
      },
      backup: { enabled: false, interval: 0, retention: 0, path: '' },
      performance: { connectionPool: 1, busyTimeout: 5000, cacheSize: 8000 }
    },
    validation: {
      strict: false,
      sanitize: true,
      maxLength: { title: 200, problem: 5000, solution: 10000, tags: 50 },
      minLength: { title: 5, problem: 10, solution: 10 },
      patterns: {
        tag: /^[a-zA-Z0-9-_]+$/,
        category: ['JCL', 'VSAM', 'DB2', 'Batch', 'Functional', 'Other']
      }
    },
    search: {
      fts: { tokenize: 'porter', remove_diacritics: 1, categories: 'simple' },
      ai: { enabled: false, fallback: true, timeout: 5000, retries: 2, batchSize: 10 },
      cache: { enabled: false, ttl: 0, maxSize: 0 }
    },
    cache: { maxSize: 100, ttl: 300000, checkPeriod: 600000, strategy: 'lru' as const, persistent: false },
    metrics: { 
      enabled: false, 
      retention: 0,
      aggregation: { enabled: false, interval: 0, batch: 0 },
      alerts: { enabled: false, thresholds: {} }
    },
    logging: {
      level: 'info' as const,
      file: { enabled: false, path: '', maxSize: 0, maxFiles: 0 },
      console: true,
      structured: false
    }
  };

  const validationService = new ValidationService(config.validation);
  const searchService = new SearchService();
  
  const kbService = new KnowledgeBaseService(
    config,
    validationService,
    searchService
  );
  
  await kbService.initialize();
  
  return {
    kbService,
    validationService,
    searchService,
    async close() {
      await kbService.close();
    }
  };
}

/**
 * Service Health Check Utility
 * Performs comprehensive health checks on all services
 */
export async function performHealthCheck(factory: ServiceFactory): Promise<{
  overall: 'healthy' | 'degraded' | 'unhealthy';
  services: Record<string, {
    status: 'healthy' | 'unhealthy';
    responseTime?: number;
    error?: string;
    details?: any;
  }>;
  summary: {
    healthy: number;
    unhealthy: number;
    total: number;
    timestamp: Date;
  };
}> {
  const startTime = Date.now();
  const result = await factory.healthCheck();
  const endTime = Date.now();
  
  const serviceDetails: Record<string, any> = {};
  let healthyCount = 0;
  let unhealthyCount = 0;
  
  Object.entries(result.services).forEach(([name, health]) => {
    if (health.healthy) {
      healthyCount++;
      serviceDetails[name] = {
        status: 'healthy',
        responseTime: endTime - startTime
      };
    } else {
      unhealthyCount++;
      serviceDetails[name] = {
        status: 'unhealthy',
        error: health.error,
        responseTime: endTime - startTime
      };
    }
  });
  
  let overall: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
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
      timestamp: new Date()
    }
  };
}

/**
 * Service Benchmarking Utility
 * Performance testing for service operations
 */
export async function benchmarkServices(factory: ServiceFactory, options: {
  iterations?: number;
  includeSearch?: boolean;
  includeCRUD?: boolean;
  sampleSize?: number;
} = {}): Promise<{
  results: Record<string, {
    operation: string;
    averageTime: number;
    minTime: number;
    maxTime: number;
    iterations: number;
    throughput: number; // ops/second
  }>;
  summary: {
    totalTime: number;
    totalOperations: number;
    overallThroughput: number;
  };
}> {
  const {
    iterations = 100,
    includeSearch = true,
    includeCRUD = true,
    sampleSize = 10
  } = options;
  
  const results: Record<string, any> = {};
  const kbService = factory.getKnowledgeBaseService();
  const cacheService = factory.getCacheService();
  
  let totalOperations = 0;
  let totalTime = 0;
  
  // Benchmark KB operations
  if (includeCRUD) {
    // Create operation
    const createTimes = [];
    for (let i = 0; i < sampleSize; i++) {
      const start = Date.now();
      await kbService.create({
        title: `Benchmark Entry ${i}`,
        problem: `Test problem ${i} for benchmarking performance`,
        solution: `Test solution ${i} for benchmarking performance measurement`,
        category: 'Other',
        tags: [`benchmark-${i}`, 'performance-test']
      });
      createTimes.push(Date.now() - start);
    }
    
    results['kb_create'] = {
      operation: 'Knowledge Base Create',
      averageTime: createTimes.reduce((a, b) => a + b, 0) / createTimes.length,
      minTime: Math.min(...createTimes),
      maxTime: Math.max(...createTimes),
      iterations: sampleSize,
      throughput: 1000 / (createTimes.reduce((a, b) => a + b, 0) / createTimes.length)
    };
    
    totalOperations += sampleSize;
    totalTime += createTimes.reduce((a, b) => a + b, 0);
  }
  
  if (includeSearch) {
    // Search operation
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
      throughput: 1000 / (searchTimes.reduce((a, b) => a + b, 0) / searchTimes.length)
    };
    
    totalOperations += iterations;
    totalTime += searchTimes.reduce((a, b) => a + b, 0);
  }
  
  // Cache operations
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
    throughput: 1000 / (cacheTimes.reduce((a, b) => a + b, 0) / cacheTimes.length)
  };
  
  totalOperations += iterations;
  totalTime += cacheTimes.reduce((a, b) => a + b, 0);
  
  return {
    results,
    summary: {
      totalTime,
      totalOperations,
      overallThroughput: totalOperations / (totalTime / 1000)
    }
  };
}

/**
 * Export utility functions for common service operations
 */
export const ServiceUtils = {
  /**
   * Create a standard KB entry from user input
   */
  createStandardEntry: (input: {
    title: string;
    problem: string;
    solution: string;
    category: string;
    tags?: string[];
  }) => ({
    title: input.title.trim(),
    problem: input.problem.trim(),
    solution: input.solution.trim(),
    category: input.category as any,
    tags: (input.tags || []).map(tag => tag.trim().toLowerCase()),
    created_by: 'user'
  }),

  /**
   * Parse search query for special operators
   */
  parseSearchQuery: (query: string) => {
    const operators: Record<string, string> = {};
    let cleanQuery = query;

    // Extract category: operator
    const categoryMatch = query.match(/category:(\w+)/i);
    if (categoryMatch) {
      operators.category = categoryMatch[1];
      cleanQuery = cleanQuery.replace(/category:\w+/i, '').trim();
    }

    // Extract tag: operator
    const tagMatches = query.match(/tag:(\w+)/gi);
    if (tagMatches) {
      operators.tags = tagMatches.map(match => match.replace(/tag:/i, ''));
      cleanQuery = cleanQuery.replace(/tag:\w+/gi, '').trim();
    }

    return {
      query: cleanQuery,
      operators
    };
  },

  /**
   * Format KB entry for display
   */
  formatEntryForDisplay: (entry: any) => ({
    id: entry.id,
    title: entry.title,
    category: entry.category,
    tags: entry.tags,
    summary: `${entry.problem.substring(0, 100)}...`,
    usage: entry.usage_count || 0,
    successRate: entry.success_count + entry.failure_count > 0 
      ? Math.round((entry.success_count / (entry.success_count + entry.failure_count)) * 100)
      : 0,
    lastUpdated: entry.updated_at
  }),

  /**
   * Calculate KB statistics
   */
  calculateKBStats: (entries: any[]) => {
    const categoryCount: Record<string, number> = {};
    const tagCount: Record<string, number> = {};
    let totalUsage = 0;
    let totalSuccess = 0;
    let totalFailure = 0;

    entries.forEach(entry => {
      categoryCount[entry.category] = (categoryCount[entry.category] || 0) + 1;
      
      entry.tags?.forEach((tag: string) => {
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
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10),
      usage: {
        total: totalUsage,
        average: totalUsage / entries.length,
        successRate: totalSuccess + totalFailure > 0 
          ? totalSuccess / (totalSuccess + totalFailure) 
          : 0
      }
    };
  }
};