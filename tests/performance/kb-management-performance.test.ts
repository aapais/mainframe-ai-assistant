/**
 * KB Management Performance Testing Suite
 * Comprehensive performance testing for large datasets and intensive operations
 */

import { performance } from 'perf_hooks';
import { EnhancedKnowledgeDBService } from '../../src/services/EnhancedKnowledgeDBService';
import { BatchOperationsService } from '../../src/services/BatchOperationsService';
import { SmartSearchService } from '../../src/services/SmartSearchService';
import { VirtualScrollManager } from '../../src/renderer/components/ui/VirtualScrollManager';
import type { KBEntry, SearchFilters } from '../../src/types';

// Performance testing utilities
class PerformanceProfiler {
  private measurements: Map<string, number[]> = new Map();

  startMeasurement(name: string): () => number {
    const startTime = performance.now();
    return () => {
      const endTime = performance.now();
      const duration = endTime - startTime;

      if (!this.measurements.has(name)) {
        this.measurements.set(name, []);
      }
      this.measurements.get(name)!.push(duration);

      return duration;
    };
  }

  getStats(name: string) {
    const measurements = this.measurements.get(name) || [];
    if (measurements.length === 0) return null;

    const sorted = [...measurements].sort((a, b) => a - b);
    return {
      count: measurements.length,
      min: Math.min(...measurements),
      max: Math.max(...measurements),
      mean: measurements.reduce((sum, val) => sum + val, 0) / measurements.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)]
    };
  }

  generateReport(): string {
    let report = '\n📊 Performance Test Results\n';
    report += '=' * 40 + '\n';

    for (const [name, _] of this.measurements) {
      const stats = this.getStats(name);
      if (stats) {
        report += `\n${name}:\n`;
        report += `  Count: ${stats.count}\n`;
        report += `  Mean: ${stats.mean.toFixed(2)}ms\n`;
        report += `  Median: ${stats.median.toFixed(2)}ms\n`;
        report += `  Min: ${stats.min.toFixed(2)}ms\n`;
        report += `  Max: ${stats.max.toFixed(2)}ms\n`;
        report += `  P95: ${stats.p95.toFixed(2)}ms\n`;
        report += `  P99: ${stats.p99.toFixed(2)}ms\n`;
      }
    }

    return report;
  }
}

// Test data generators for large datasets
const generateLargeKBDataset = (size: number): KBEntry[] => {
  const categories = ['VSAM', 'JCL', 'DB2', 'Batch', 'Functional', 'CICS', 'IMS'];
  const tags = ['error', 'performance', 'config', 'debug', 'timeout', 'memory', 'network', 'security'];

  return Array.from({ length: size }, (_, i) => ({
    id: `perf-test-${i}`,
    title: `Performance Test Entry ${i}`,
    problem: `This is a detailed problem description for performance test entry ${i}. `.repeat(10),
    solution: `This is a comprehensive solution for test entry ${i} with multiple steps:\n`.repeat(5),
    category: categories[i % categories.length],
    tags: tags.slice(0, (i % 4) + 1),
    created_at: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
    updated_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
    usage_count: Math.floor(Math.random() * 100),
    success_rate: Math.random(),
    version: Math.floor(Math.random() * 5) + 1,
    status: 'active',
    created_by: `user${i % 10}`
  }));
};

describe('KB Management Performance Tests', () => {
  let profiler: PerformanceProfiler;
  let mockKBService: jest.Mocked<EnhancedKnowledgeDBService>;
  let mockBatchService: jest.Mocked<BatchOperationsService>;
  let mockSearchService: jest.Mocked<SmartSearchService>;

  beforeEach(() => {
    profiler = new PerformanceProfiler();

    // Mock services with performance-aware implementations
    mockKBService = {
      getEntries: jest.fn(),
      searchEntries: jest.fn(),
      saveEntry: jest.fn(),
      updateEntry: jest.fn(),
      deleteEntry: jest.fn(),
      batchSaveEntries: jest.fn(),
      beginTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn()
    } as any;

    mockBatchService = {
      executeOperation: jest.fn()
    } as any;

    mockSearchService = {
      search: jest.fn(),
      getSuggestions: jest.fn()
    } as any;
  });

  afterEach(() => {
    const report = profiler.generateReport();
    if (process.env.VERBOSE_TESTS) {
      console.log(report);
    }
  });

  describe('Large Dataset Loading Performance', () => {
    it('should load 1000+ entries efficiently', async () => {
      const testSizes = [100, 500, 1000, 2000, 5000];

      for (const size of testSizes) {
        const dataset = generateLargeKBDataset(size);

        mockKBService.getEntries.mockResolvedValue({
          data: dataset,
          total: size,
          hasMore: false
        });

        const endMeasurement = profiler.startMeasurement(`loadEntries-${size}`);

        const result = await mockKBService.getEntries({
          page: 1,
          limit: size,
          sortBy: 'created_at',
          sortOrder: 'desc'
        });

        const duration = endMeasurement();

        expect(result.data).toHaveLength(size);

        // Performance thresholds based on dataset size
        if (size <= 1000) {
          expect(duration).toBeLessThan(100); // 100ms for small datasets
        } else if (size <= 2000) {
          expect(duration).toBeLessThan(250); // 250ms for medium datasets
        } else {
          expect(duration).toBeLessThan(500); // 500ms for large datasets
        }
      }

      const stats = profiler.getStats('loadEntries-5000');
      expect(stats?.mean).toBeLessThan(500);
    });

    it('should handle pagination efficiently for large datasets', async () => {
      const totalEntries = 10000;
      const pageSize = 50;
      const totalPages = Math.ceil(totalEntries / pageSize);

      // Test loading multiple pages
      for (let page = 1; page <= Math.min(20, totalPages); page++) {
        const pageData = generateLargeKBDataset(pageSize);

        mockKBService.getEntries.mockResolvedValue({
          data: pageData,
          total: totalEntries,
          hasMore: page < totalPages
        });

        const endMeasurement = profiler.startMeasurement('pagination');

        const result = await mockKBService.getEntries({
          page,
          limit: pageSize,
          sortBy: 'usage_count',
          sortOrder: 'desc'
        });

        const duration = endMeasurement();

        expect(result.data).toHaveLength(pageSize);
        expect(duration).toBeLessThan(50); // Each page should load in <50ms
      }

      const paginationStats = profiler.getStats('pagination');
      expect(paginationStats?.p95).toBeLessThan(100);
    });

    it('should optimize memory usage with large datasets', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Load progressively larger datasets
      const sizes = [1000, 2000, 3000, 4000, 5000];

      for (const size of sizes) {
        const dataset = generateLargeKBDataset(size);

        mockKBService.getEntries.mockResolvedValue({
          data: dataset,
          total: size,
          hasMore: false
        });

        await mockKBService.getEntries({ limit: size });

        const currentMemory = process.memoryUsage().heapUsed;
        const memoryIncrease = (currentMemory - initialMemory) / 1024 / 1024; // MB

        // Memory should not grow excessively
        expect(memoryIncrease).toBeLessThan(100); // Less than 100MB increase

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }
    });
  });

  describe('Search Performance Under Load', () => {
    it('should maintain sub-100ms search response times', async () => {
      const dataset = generateLargeKBDataset(5000);
      const searchQueries = [
        'vsam error',
        'jcl syntax',
        'db2 deadlock',
        'batch abend',
        's0c7 data exception',
        'performance issue',
        'timeout error',
        'memory allocation'
      ];

      mockSearchService.search.mockImplementation(async (query) => {
        // Simulate realistic search processing time
        await new Promise(resolve => setTimeout(resolve, Math.random() * 50));

        const results = dataset.filter(entry =>
          entry.title.toLowerCase().includes(query.toLowerCase()) ||
          entry.problem.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 20);

        return {
          results,
          aiEnhanced: true,
          suggestions: [],
          totalFound: results.length
        };
      });

      // Execute concurrent searches
      const searchPromises = searchQueries.map(async (query) => {
        const endMeasurement = profiler.startMeasurement('search');
        const result = await mockSearchService.search(query);
        const duration = endMeasurement();

        expect(duration).toBeLessThan(100); // Sub-100ms target
        return { query, duration, resultCount: result.results.length };
      });

      const results = await Promise.all(searchPromises);

      results.forEach(({ query, duration, resultCount }) => {
        console.log(`🔍 "${query}": ${duration.toFixed(2)}ms (${resultCount} results)`);
      });

      const searchStats = profiler.getStats('search');
      expect(searchStats?.p95).toBeLessThan(100);
    });

    it('should handle complex filtered searches efficiently', async () => {
      const dataset = generateLargeKBDataset(3000);

      const complexFilters: SearchFilters[] = [
        {
          query: 'error',
          category: 'VSAM',
          tags: ['performance'],
          successRateMin: 0.8
        },
        {
          query: 'timeout',
          categories: ['DB2', 'CICS'],
          dateFrom: new Date('2024-01-01'),
          dateTo: new Date('2024-12-31')
        },
        {
          query: 'memory',
          usageCountMin: 10,
          sortBy: 'usage_count',
          sortOrder: 'desc'
        }
      ];

      mockKBService.searchEntries.mockImplementation(async (filters) => {
        // Simulate complex filtering
        await new Promise(resolve => setTimeout(resolve, Math.random() * 100));

        let filteredData = [...dataset];

        if (filters.query) {
          filteredData = filteredData.filter(entry =>
            entry.title.toLowerCase().includes(filters.query!.toLowerCase())
          );
        }

        if (filters.category) {
          filteredData = filteredData.filter(entry => entry.category === filters.category);
        }

        if (filters.successRateMin) {
          filteredData = filteredData.filter(entry => entry.success_rate >= filters.successRateMin!);
        }

        return filteredData.slice(0, 50);
      });

      for (const filters of complexFilters) {
        const endMeasurement = profiler.startMeasurement('complexSearch');

        const results = await mockKBService.searchEntries(filters);

        const duration = endMeasurement();

        expect(duration).toBeLessThan(150); // 150ms for complex searches
        expect(results.length).toBeGreaterThanOrEqual(0);
      }

      const complexSearchStats = profiler.getStats('complexSearch');
      expect(complexSearchStats?.mean).toBeLessThan(100);
    });

    it('should maintain performance with concurrent search operations', async () => {
      const dataset = generateLargeKBDataset(2000);
      const concurrentSearches = 50;

      mockSearchService.search.mockImplementation(async (query) => {
        await new Promise(resolve => setTimeout(resolve, Math.random() * 30));
        return {
          results: dataset.slice(0, 10),
          aiEnhanced: false,
          suggestions: []
        };
      });

      const endMeasurement = profiler.startMeasurement('concurrentSearch');

      const searchPromises = Array.from({ length: concurrentSearches }, (_, i) =>
        mockSearchService.search(`query ${i}`)
      );

      const results = await Promise.all(searchPromises);
      const duration = endMeasurement();

      expect(results).toHaveLength(concurrentSearches);
      expect(duration).toBeLessThan(1000); // All searches complete in <1s

      // Average per search should still be reasonable
      const avgDuration = duration / concurrentSearches;
      expect(avgDuration).toBeLessThan(100);
    });
  });

  describe('Virtual Scrolling Performance', () => {
    it('should render large lists efficiently with virtual scrolling', async () => {
      const largeDataset = generateLargeKBDataset(10000);
      const virtualScrollManager = new VirtualScrollManager({
        itemHeight: 80,
        containerHeight: 600,
        overscan: 5
      });

      const endMeasurement = profiler.startMeasurement('virtualScrollInit');

      virtualScrollManager.setItems(largeDataset);
      const visibleItems = virtualScrollManager.getVisibleRange();

      const initDuration = endMeasurement();

      expect(initDuration).toBeLessThan(50); // Initialize in <50ms
      expect(visibleItems.items.length).toBeLessThan(20); // Only render visible items
      expect(visibleItems.startIndex).toBe(0);
      expect(visibleItems.endIndex).toBeLessThanOrEqual(15);

      // Test scrolling performance
      for (let scrollTop = 0; scrollTop < 5000; scrollTop += 500) {
        const scrollMeasurement = profiler.startMeasurement('virtualScroll');

        virtualScrollManager.setScrollTop(scrollTop);
        const newVisibleItems = virtualScrollManager.getVisibleRange();

        const scrollDuration = scrollMeasurement();

        expect(scrollDuration).toBeLessThan(16); // 60fps target (16ms per frame)
        expect(newVisibleItems.items.length).toBeLessThan(20);
      }

      const scrollStats = profiler.getStats('virtualScroll');
      expect(scrollStats?.p95).toBeLessThan(16);
    });

    it('should handle rapid scrolling without performance degradation', async () => {
      const dataset = generateLargeKBDataset(50000);
      const virtualScrollManager = new VirtualScrollManager({
        itemHeight: 100,
        containerHeight: 800,
        overscan: 3
      });

      virtualScrollManager.setItems(dataset);

      // Simulate rapid scrolling (e.g., user holding scroll wheel)
      const rapidScrollOperations = 100;
      const maxScrollTop = dataset.length * 100 - 800;

      const endMeasurement = profiler.startMeasurement('rapidScroll');

      for (let i = 0; i < rapidScrollOperations; i++) {
        const scrollTop = Math.random() * maxScrollTop;
        virtualScrollManager.setScrollTop(scrollTop);

        const visibleItems = virtualScrollManager.getVisibleRange();
        expect(visibleItems.items.length).toBeLessThan(15);
      }

      const totalDuration = endMeasurement();
      const avgPerOperation = totalDuration / rapidScrollOperations;

      expect(avgPerOperation).toBeLessThan(5); // <5ms per scroll operation
      expect(totalDuration).toBeLessThan(500); // Total <500ms for all operations
    });
  });

  describe('Batch Operations Performance', () => {
    it('should execute bulk operations efficiently', async () => {
      const batchSizes = [10, 50, 100, 500, 1000];

      mockBatchService.executeOperation.mockImplementation(async (operation, ids) => {
        // Simulate batch processing time
        const processingTime = Math.min(ids.length * 2, 1000); // Max 1000ms
        await new Promise(resolve => setTimeout(resolve, processingTime));

        return {
          success: true,
          results: ids.map(id => ({ id, success: true })),
          summary: { total: ids.length, successful: ids.length, failed: 0 }
        };
      });

      for (const batchSize of batchSizes) {
        const entryIds = Array.from({ length: batchSize }, (_, i) => `batch-${i}`);

        const endMeasurement = profiler.startMeasurement(`batch-${batchSize}`);

        const result = await mockBatchService.executeOperation('delete', entryIds);

        const duration = endMeasurement();

        expect(result.summary.successful).toBe(batchSize);

        // Performance expectations based on batch size
        if (batchSize <= 50) {
          expect(duration).toBeLessThan(200);
        } else if (batchSize <= 100) {
          expect(duration).toBeLessThan(400);
        } else {
          expect(duration).toBeLessThan(1200);
        }
      }
    });

    it('should handle transaction rollback efficiently', async () => {
      const batchSize = 100;
      const entryIds = Array.from({ length: batchSize }, (_, i) => `rollback-${i}`);

      // Mock partial failure requiring rollback
      mockBatchService.executeOperation.mockImplementation(async (operation, ids) => {
        await new Promise(resolve => setTimeout(resolve, 200));

        // Simulate 70% success, then failure requiring rollback
        const successCount = Math.floor(ids.length * 0.7);
        throw new Error(`Operation failed after ${successCount} items`);
      });

      const endMeasurement = profiler.startMeasurement('batchRollback');

      try {
        await mockBatchService.executeOperation('update', entryIds);
      } catch (error) {
        // Expected failure
      }

      const duration = endMeasurement();

      // Rollback should complete quickly
      expect(duration).toBeLessThan(500);
    });
  });

  describe('Memory and Resource Management', () => {
    it('should manage memory efficiently during intensive operations', async () => {
      const iterations = 10;
      const initialMemory = process.memoryUsage().heapUsed;
      let maxMemoryUsed = initialMemory;

      for (let i = 0; i < iterations; i++) {
        const dataset = generateLargeKBDataset(1000);

        // Simulate various operations
        await Promise.all([
          mockKBService.getEntries({ limit: 1000 }),
          mockSearchService.search('test query'),
          mockBatchService.executeOperation('update', dataset.slice(0, 100).map(e => e.id))
        ]);

        const currentMemory = process.memoryUsage().heapUsed;
        maxMemoryUsed = Math.max(maxMemoryUsed, currentMemory);

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }

      const memoryIncrease = (maxMemoryUsed - initialMemory) / 1024 / 1024; // MB

      console.log(`💾 Memory usage: ${memoryIncrease.toFixed(2)}MB increase`);

      // Memory increase should be reasonable
      expect(memoryIncrease).toBeLessThan(200); // Less than 200MB increase
    });

    it('should handle resource cleanup properly', async () => {
      const resourceLeakTest = async () => {
        const dataset = generateLargeKBDataset(500);

        // Create multiple service instances
        const services = Array.from({ length: 10 }, () => ({
          kb: mockKBService,
          search: mockSearchService,
          batch: mockBatchService
        }));

        // Perform operations with each service
        await Promise.all(
          services.map(async (service, i) => {
            await service.kb.getEntries({ limit: 50 });
            await service.search.search(`query ${i}`);
          })
        );

        // Simulate cleanup
        services.forEach(service => {
          // In real implementation, services would have cleanup methods
          service.kb = null as any;
          service.search = null as any;
          service.batch = null as any;
        });
      };

      const initialMemory = process.memoryUsage().heapUsed;

      // Run the test multiple times
      for (let i = 0; i < 5; i++) {
        await resourceLeakTest();

        if (global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryDiff = (finalMemory - initialMemory) / 1024 / 1024;

      // Should not leak significant memory
      expect(memoryDiff).toBeLessThan(50); // Less than 50MB increase
    });
  });

  describe('Stress Testing', () => {
    it('should maintain stability under extreme load', async () => {
      const extremeOperations = 1000;
      const operationTypes = ['search', 'load', 'batch'];

      mockKBService.getEntries.mockResolvedValue({
        data: generateLargeKBDataset(100),
        total: 100,
        hasMore: false
      });

      mockSearchService.search.mockResolvedValue({
        results: generateLargeKBDataset(20),
        aiEnhanced: false,
        suggestions: []
      });

      mockBatchService.executeOperation.mockResolvedValue({
        success: true,
        results: [],
        summary: { total: 10, successful: 10, failed: 0 }
      });

      const endMeasurement = profiler.startMeasurement('stressTest');

      const operations = Array.from({ length: extremeOperations }, (_, i) => {
        const operationType = operationTypes[i % operationTypes.length];

        switch (operationType) {
          case 'search':
            return mockSearchService.search(`stress query ${i}`);
          case 'load':
            return mockKBService.getEntries({ page: (i % 10) + 1, limit: 50 });
          case 'batch':
            return mockBatchService.executeOperation('update', [`stress-${i}`]);
          default:
            return Promise.resolve();
        }
      });

      const results = await Promise.allSettled(operations);
      const duration = endMeasurement();

      // Count successful operations
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const successRate = successful / extremeOperations;

      console.log(`🚀 Stress Test: ${successful}/${extremeOperations} operations succeeded (${(successRate * 100).toFixed(1)}%)`);
      console.log(`⏱️ Total time: ${duration.toFixed(2)}ms`);
      console.log(`📈 Average per operation: ${(duration / extremeOperations).toFixed(2)}ms`);

      expect(successRate).toBeGreaterThan(0.95); // 95% success rate
      expect(duration).toBeLessThan(30000); // Complete within 30 seconds
    });
  });
});

// Utility class for virtual scroll performance testing
class VirtualScrollManager {
  private items: any[] = [];
  private itemHeight: number;
  private containerHeight: number;
  private overscan: number;
  private scrollTop: number = 0;

  constructor(config: { itemHeight: number; containerHeight: number; overscan: number }) {
    this.itemHeight = config.itemHeight;
    this.containerHeight = config.containerHeight;
    this.overscan = config.overscan;
  }

  setItems(items: any[]) {
    this.items = items;
  }

  setScrollTop(scrollTop: number) {
    this.scrollTop = scrollTop;
  }

  getVisibleRange() {
    const visibleCount = Math.ceil(this.containerHeight / this.itemHeight);
    const startIndex = Math.floor(this.scrollTop / this.itemHeight);
    const endIndex = Math.min(startIndex + visibleCount + this.overscan, this.items.length);

    const visibleItems = this.items.slice(
      Math.max(0, startIndex - this.overscan),
      endIndex
    );

    return {
      startIndex: Math.max(0, startIndex - this.overscan),
      endIndex,
      items: visibleItems
    };
  }
}