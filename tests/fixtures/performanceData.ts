/**
 * Performance Testing Data Generator
 */

import { KBEntry } from '../../src/types';

export interface SearchResult {
  entry: KBEntry;
  score: number;
  matchType: 'exact' | 'fuzzy' | 'ai';
}

// Generate large datasets for performance testing
export const generateLargeSearchResults = (count: number): SearchResult[] => {
  const results: SearchResult[] = [];
  const categories = ['VSAM', 'JCL', 'DB2', 'Batch', 'Functional'];
  const matchTypes: ('exact' | 'fuzzy' | 'ai')[] = ['exact', 'fuzzy', 'ai'];
  
  for (let i = 0; i < count; i++) {
    const entry: KBEntry = {
      id: `perf-result-${i}`,
      title: `Performance Test Entry ${i}`,
      problem: `Performance problem description ${i} with lots of text to simulate real-world entries. This entry contains various keywords and technical terms that might be searched for in a knowledge base system.`,
      solution: `Performance solution ${i} with detailed step-by-step instructions:\n1. Step one involves checking system status\n2. Step two requires configuration changes\n3. Step three validates the solution\n4. Additional steps as needed for comprehensive testing`,
      category: categories[i % categories.length] as any,
      tags: [
        `perf-tag-${i}`,
        `category-${categories[i % categories.length].toLowerCase()}`,
        'performance-test',
        `batch-${Math.floor(i / 100)}`,
      ],
      created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // Random date within last 30 days
      updated_at: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000), // Random date within last 7 days
      usage_count: Math.floor(Math.random() * 200),
      success_count: Math.floor(Math.random() * 150),
      failure_count: Math.floor(Math.random() * 50),
    };
    
    results.push({
      entry,
      score: Math.max(10, 100 - (i * 0.1) + (Math.random() * 10)), // Decreasing scores with some randomness
      matchType: matchTypes[i % matchTypes.length],
    });
  }
  
  return results;
};

// Generate complex navigation history for testing
export interface NavigationHistoryItem {
  route: string;
  timestamp: Date;
  searchQuery?: string;
  entryId?: string;
  metadata?: Record<string, any>;
}

export const generateNavigationHistory = (count: number): NavigationHistoryItem[] => {
  const history: NavigationHistoryItem[] = [];
  const routes = ['/search', '/entry', '/add', '/metrics', '/history', '/settings'];
  const queries = [
    'VSAM error',
    'JCL syntax',
    'DB2 connection',
    'COBOL abend',
    'functional test',
    'performance issue',
    'system error',
    'batch processing',
  ];
  
  for (let i = 0; i < count; i++) {
    const route = routes[Math.floor(Math.random() * routes.length)];
    const isSearch = route === '/search';
    const isEntry = route === '/entry';
    
    const item: NavigationHistoryItem = {
      route: isEntry ? `${route}/entry-${i}` : route,
      timestamp: new Date(Date.now() - (count - i) * 1000 * 60), // Chronological order
      searchQuery: isSearch || Math.random() > 0.7 ? queries[Math.floor(Math.random() * queries.length)] : undefined,
      entryId: isEntry ? `entry-${i}` : undefined,
      metadata: {
        userAgent: 'test-browser',
        sessionId: `session-${Math.floor(i / 10)}`,
        performanceMetrics: {
          loadTime: Math.random() * 1000,
          renderTime: Math.random() * 500,
        },
      },
    };
    
    history.push(item);
  }
  
  return history;
};

// Generate large URL parameter datasets for testing
export const generateComplexURLParams = (complexity: number): string[] => {
  const params: string[] = [];
  const categories = ['VSAM', 'JCL', 'DB2', 'Batch', 'Functional'];
  
  for (let i = 0; i < complexity; i++) {
    const queryParams = new URLSearchParams();
    
    // Add various parameters
    queryParams.set('q', `complex query ${i} with special characters & symbols`);
    queryParams.set('category', categories[i % categories.length]);
    queryParams.set('ai', Math.random() > 0.5 ? 'true' : 'false');
    queryParams.set('page', Math.floor(i / 10).toString());
    queryParams.set('sort', i % 2 === 0 ? 'relevance' : 'date');
    queryParams.set('filter', `filter-${i}`);
    queryParams.set('session', `session-${Math.floor(i / 20)}`);
    
    // Add some encoded special characters
    queryParams.set('special', `encoded%20text%20${i}%26more`);
    
    params.push(queryParams.toString());
  }
  
  return params;
};

// Memory usage simulation data
export interface MemorySnapshot {
  timestamp: Date;
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  operationCount: number;
}

export const generateMemorySnapshots = (operations: number): MemorySnapshot[] => {
  const snapshots: MemorySnapshot[] = [];
  let baseHeapUsed = 20 * 1024 * 1024; // Start with 20MB
  let operationCount = 0;
  
  for (let i = 0; i < operations; i++) {
    operationCount++;
    
    // Simulate memory growth with occasional garbage collection
    if (i > 0 && i % 50 === 0) {
      // Garbage collection event
      baseHeapUsed = Math.max(baseHeapUsed * 0.7, 15 * 1024 * 1024);
    } else {
      // Normal memory growth
      baseHeapUsed += Math.random() * 100 * 1024; // Random growth up to 100KB
    }
    
    snapshots.push({
      timestamp: new Date(Date.now() + i * 100), // 100ms intervals
      heapUsed: Math.floor(baseHeapUsed),
      heapTotal: Math.floor(baseHeapUsed * 1.3),
      external: Math.floor(Math.random() * 5 * 1024 * 1024),
      rss: Math.floor(baseHeapUsed * 1.5),
      operationCount,
    });
  }
  
  return snapshots;
};

// CPU usage simulation for performance testing
export interface CPUSnapshot {
  timestamp: Date;
  cpuUsage: number; // Percentage
  operationType: string;
  duration: number; // ms
}

export const generateCPUSnapshots = (operations: number): CPUSnapshot[] => {
  const snapshots: CPUSnapshot[] = [];
  const operationTypes = [
    'navigation',
    'search',
    'render',
    'state-update',
    'url-parse',
    'context-switch',
  ];
  
  for (let i = 0; i < operations; i++) {
    const operationType = operationTypes[Math.floor(Math.random() * operationTypes.length)];
    
    // Different operations have different CPU characteristics
    let baseCPU = 5; // Base 5% CPU usage
    let duration = 10; // Base 10ms duration
    
    switch (operationType) {
      case 'navigation':
        baseCPU = 8;
        duration = 15;
        break;
      case 'search':
        baseCPU = 25;
        duration = 100;
        break;
      case 'render':
        baseCPU = 15;
        duration = 50;
        break;
      case 'state-update':
        baseCPU = 3;
        duration = 5;
        break;
      case 'url-parse':
        baseCPU = 2;
        duration = 3;
        break;
      case 'context-switch':
        baseCPU = 10;
        duration = 20;
        break;
    }
    
    snapshots.push({
      timestamp: new Date(Date.now() + i * 50), // 50ms intervals
      cpuUsage: Math.max(0, Math.min(100, baseCPU + (Math.random() - 0.5) * 10)),
      operationType,
      duration: Math.max(1, duration + (Math.random() - 0.5) * duration * 0.5),
    });
  }
  
  return snapshots;
};

// Network latency simulation for testing
export interface NetworkLatencySnapshot {
  timestamp: Date;
  operation: string;
  latency: number; // ms
  success: boolean;
  retries: number;
}

export const generateNetworkLatencySnapshots = (requests: number): NetworkLatencySnapshot[] => {
  const snapshots: NetworkLatencySnapshot[] = [];
  const operations = [
    'search-api',
    'gemini-api',
    'save-entry',
    'load-metrics',
    'fetch-history',
  ];
  
  for (let i = 0; i < requests; i++) {
    const operation = operations[Math.floor(Math.random() * operations.length)];
    
    // Different operations have different latency characteristics
    let baseLatency = 100; // Base 100ms
    let successRate = 0.95; // 95% success rate
    
    switch (operation) {
      case 'search-api':
        baseLatency = 50;
        successRate = 0.98;
        break;
      case 'gemini-api':
        baseLatency = 1500;
        successRate = 0.90;
        break;
      case 'save-entry':
        baseLatency = 200;
        successRate = 0.99;
        break;
      case 'load-metrics':
        baseLatency = 300;
        successRate = 0.97;
        break;
      case 'fetch-history':
        baseLatency = 150;
        successRate = 0.99;
        break;
    }
    
    const success = Math.random() < successRate;
    const latency = success 
      ? baseLatency + (Math.random() - 0.5) * baseLatency * 0.5
      : baseLatency * 3; // Failed requests take longer
      
    const retries = success ? 0 : Math.floor(Math.random() * 3);
    
    snapshots.push({
      timestamp: new Date(Date.now() + i * 200), // 200ms intervals
      operation,
      latency: Math.max(10, latency),
      success,
      retries,
    });
  }
  
  return snapshots;
};

// Export performance testing utilities
export const PerformanceTestData = {
  generateLargeSearchResults,
  generateNavigationHistory,
  generateComplexURLParams,
  generateMemorySnapshots,
  generateCPUSnapshots,
  generateNetworkLatencySnapshots,
};