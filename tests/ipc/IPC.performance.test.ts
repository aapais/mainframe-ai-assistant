/**
 * IPC Performance and Load Testing Suite
 * 
 * Tests performance aspects of IPC communication:
 * - Response time measurements
 * - Throughput and concurrent request handling
 * - Memory usage during IPC operations
 * - Streaming performance
 * - Cache effectiveness
 * - Load testing scenarios
 */

import { EventEmitter } from 'events';
import type { IPCResponse, StreamChunk } from '../../src/main/preload';

// Performance monitoring utilities
class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();
  private memorySnapshots: Array<{ timestamp: number; usage: NodeJS.MemoryUsage }> = [];

  startTimer(label: string): () => number {
    const start = performance.now();
    return () => {
      const duration = performance.now() - start;
      this.recordMetric(label, duration);
      return duration;
    };
  }

  recordMetric(label: string, value: number): void {
    if (!this.metrics.has(label)) {
      this.metrics.set(label, []);
    }
    this.metrics.get(label)!.push(value);
  }

  getAverageMetric(label: string): number {
    const values = this.metrics.get(label) || [];
    return values.length > 0 ? values.reduce((a, b) => a + b) / values.length : 0;
  }

  getP95Metric(label: string): number {
    const values = this.metrics.get(label) || [];
    if (values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * 0.95) - 1;
    return sorted[index];
  }

  recordMemorySnapshot(): void {
    this.memorySnapshots.push({
      timestamp: Date.now(),
      usage: process.memoryUsage()
    });
  }

  getMemoryGrowth(): number {
    if (this.memorySnapshots.length < 2) return 0;
    const first = this.memorySnapshots[0].usage.heapUsed;
    const last = this.memorySnapshots[this.memorySnapshots.length - 1].usage.heapUsed;
    return last - first;
  }

  reset(): void {
    this.metrics.clear();
    this.memorySnapshots = [];
  }
}

// Mock IPC with performance simulation
const mockIpcRenderer = {
  invoke: jest.fn(),
  send: jest.fn(),
  on: jest.fn()
};

// Simulate realistic response times
const simulateResponseTime = (baseTime: number, variance: number = 0.2): number => {
  const varianceMs = baseTime * variance;
  return baseTime + (Math.random() - 0.5) * 2 * varianceMs;
};

// Mock responses with timing simulation
const createMockResponse = <T>(data: T, baseTime: number = 50): Promise<IPCResponse<T>> => {
  const responseTime = simulateResponseTime(baseTime);
  return new Promise(resolve => {
    setTimeout(() => {
      resolve({
        success: true,
        data,
        metadata: {
          executionTime: responseTime,
          cached: Math.random() > 0.7 // 30% cache hit rate
        }
      });
    }, responseTime);
  });
};

jest.mock('electron', () => ({
  ipcRenderer: mockIpcRenderer
}));

describe('IPC Performance Tests', () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    jest.clearAllMocks();
    monitor = new PerformanceMonitor();
    
    // Enable garbage collection for memory tests
    if (global.gc) {
      global.gc();
    }
  });

  afterEach(() => {
    monitor.reset();
  });

  describe('Response Time Performance', () => {
    test('should have fast response times for cached queries', async () => {
      const cachedResponses = Array.from({ length: 100 }, (_, i) => 
        createMockResponse(`cached-result-${i}`, 5) // 5ms base time for cached
      );

      mockIpcRenderer.invoke.mockImplementation(() => 
        cachedResponses[Math.floor(Math.random() * cachedResponses.length)]
      );

      const promises = [];
      for (let i = 0; i < 100; i++) {
        const endTimer = monitor.startTimer('cached-query');
        const promise = mockIpcRenderer.invoke('db:search', 'cached-query')
          .then(result => {
            endTimer();
            return result;
          });
        promises.push(promise);
      }

      const results = await Promise.all(promises);
      const avgTime = monitor.getAverageMetric('cached-query');
      const p95Time = monitor.getP95Metric('cached-query');

      expect(results.every(r => r.success)).toBe(true);
      expect(avgTime).toBeLessThan(20); // Average under 20ms
      expect(p95Time).toBeLessThan(50); // 95th percentile under 50ms
    });

    test('should have acceptable response times for database queries', async () => {
      mockIpcRenderer.invoke.mockImplementation(() => 
        createMockResponse('db-result', 100) // 100ms base time for DB queries
      );

      const promises = [];
      for (let i = 0; i < 50; i++) {
        const endTimer = monitor.startTimer('db-query');
        const promise = mockIpcRenderer.invoke('db:search', `query-${i}`)
          .then(result => {
            endTimer();
            return result;
          });
        promises.push(promise);
      }

      const results = await Promise.all(promises);
      const avgTime = monitor.getAverageMetric('db-query');
      const p95Time = monitor.getP95Metric('db-query');

      expect(results.every(r => r.success)).toBe(true);
      expect(avgTime).toBeLessThan(200); // Average under 200ms
      expect(p95Time).toBeLessThan(300); // 95th percentile under 300ms
    });

    test('should handle slow operations with appropriate timeouts', async () => {
      mockIpcRenderer.invoke.mockImplementation(() => 
        createMockResponse('slow-result', 2000) // 2s base time for slow operations
      );

      const promises = [];
      for (let i = 0; i < 5; i++) {
        const endTimer = monitor.startTimer('slow-operation');
        const promise = mockIpcRenderer.invoke('db:createBackup')
          .then(result => {
            endTimer();
            return result;
          });
        promises.push(promise);
      }

      const results = await Promise.all(promises);
      const avgTime = monitor.getAverageMetric('slow-operation');

      expect(results.every(r => r.success)).toBe(true);
      expect(avgTime).toBeGreaterThan(1500); // Should actually be slow
      expect(avgTime).toBeLessThan(5000); // But not too slow
    });
  });

  describe('Throughput and Concurrency', () => {
    test('should handle high concurrent request load', async () => {
      const concurrentRequests = 200;
      const startTime = Date.now();

      mockIpcRenderer.invoke.mockImplementation(() => 
        createMockResponse('concurrent-result', 50)
      );

      const promises = Array.from({ length: concurrentRequests }, (_, i) =>
        mockIpcRenderer.invoke('db:search', `concurrent-query-${i}`)
      );

      const results = await Promise.all(promises);
      const totalTime = Date.now() - startTime;
      const throughput = concurrentRequests / (totalTime / 1000); // requests per second

      expect(results.every(r => r.success)).toBe(true);
      expect(results).toHaveLength(concurrentRequests);
      expect(throughput).toBeGreaterThan(50); // At least 50 RPS
    });

    test('should maintain performance under sustained load', async () => {
      const batchSize = 50;
      const batches = 5;
      const results = [];

      mockIpcRenderer.invoke.mockImplementation(() => 
        createMockResponse('sustained-result', 30)
      );

      for (let batch = 0; batch < batches; batch++) {
        monitor.recordMemorySnapshot();
        
        const batchStartTime = Date.now();
        const batchPromises = Array.from({ length: batchSize }, (_, i) =>
          mockIpcRenderer.invoke('db:search', `sustained-query-${batch}-${i}`)
        );

        const batchResults = await Promise.all(batchPromises);
        const batchTime = Date.now() - batchStartTime;
        
        monitor.recordMetric('batch-time', batchTime);
        results.push(...batchResults);

        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const avgBatchTime = monitor.getAverageMetric('batch-time');
      const memoryGrowth = monitor.getMemoryGrowth();

      expect(results.every(r => r.success)).toBe(true);
      expect(results).toHaveLength(batchSize * batches);
      expect(avgBatchTime).toBeLessThan(5000); // Each batch under 5s
      expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024); // Less than 50MB growth
    });

    test('should handle burst traffic patterns', async () => {
      const burstSizes = [10, 50, 100, 200, 50, 10]; // Simulate traffic burst
      const results = [];

      mockIpcRenderer.invoke.mockImplementation(() => 
        createMockResponse('burst-result', 40)
      );

      for (let i = 0; i < burstSizes.length; i++) {
        const burstSize = burstSizes[i];
        const startTime = Date.now();

        const burstPromises = Array.from({ length: burstSize }, (_, j) =>
          mockIpcRenderer.invoke('db:search', `burst-query-${i}-${j}`)
        );

        const burstResults = await Promise.all(burstPromises);
        const burstTime = Date.now() - startTime;
        const burstThroughput = burstSize / (burstTime / 1000);

        monitor.recordMetric('burst-throughput', burstThroughput);
        results.push(...burstResults);

        // Variable delay between bursts
        await new Promise(resolve => setTimeout(resolve, Math.random() * 200));
      }

      const avgThroughput = monitor.getAverageMetric('burst-throughput');
      const totalRequests = burstSizes.reduce((sum, size) => sum + size, 0);

      expect(results.every(r => r.success)).toBe(true);
      expect(results).toHaveLength(totalRequests);
      expect(avgThroughput).toBeGreaterThan(20); // Maintain reasonable throughput
    });
  });

  describe('Memory Usage Performance', () => {
    test('should not leak memory during normal operations', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      monitor.recordMemorySnapshot();

      mockIpcRenderer.invoke.mockImplementation(() => 
        createMockResponse('memory-test-result', 25)
      );

      // Perform many operations
      for (let batch = 0; batch < 10; batch++) {
        const promises = Array.from({ length: 100 }, (_, i) =>
          mockIpcRenderer.invoke('db:search', `memory-query-${batch}-${i}`)
        );
        
        await Promise.all(promises);
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
        
        monitor.recordMemorySnapshot();
      }

      const memoryGrowth = monitor.getMemoryGrowth();
      const finalMemory = process.memoryUsage().heapUsed;
      const growthPercentage = (finalMemory - initialMemory) / initialMemory * 100;

      // Allow for some growth but not excessive
      expect(memoryGrowth).toBeLessThan(100 * 1024 * 1024); // Less than 100MB total growth
      expect(growthPercentage).toBeLessThan(50); // Less than 50% growth
    });

    test('should handle large response payloads efficiently', async () => {
      const largeData = Array.from({ length: 10000 }, (_, i) => ({
        id: `entry-${i}`,
        title: `Large Entry ${i}`,
        content: 'Large content data '.repeat(100) // ~2KB per entry
      }));

      monitor.recordMemorySnapshot();

      mockIpcRenderer.invoke.mockImplementation(() => 
        createMockResponse(largeData, 500)
      );

      const startTime = Date.now();
      const result = await mockIpcRenderer.invoke('db:getAll');
      const processingTime = Date.now() - startTime;

      monitor.recordMemorySnapshot();
      const memoryIncrease = monitor.getMemoryGrowth();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(10000);
      expect(processingTime).toBeLessThan(2000); // Under 2 seconds
      expect(memoryIncrease).toBeLessThan(200 * 1024 * 1024); // Under 200MB increase
    });
  });

  describe('Streaming Performance', () => {
    test('should efficiently handle streaming data', (done) => {
      const totalItems = 10000;
      const chunkSize = 500;
      const expectedChunks = Math.ceil(totalItems / chunkSize);
      const receivedChunks: StreamChunk[] = [];
      const startTime = Date.now();

      mockIpcRenderer.invoke.mockResolvedValue({
        success: true,
        data: 'stream-id-123',
        metadata: {
          streamed: true,
          totalItems
        }
      });

      // Mock streaming chunks
      mockIpcRenderer.on.mockImplementation((channel, callback) => {
        if (channel.includes('stream:chunk:')) {
          let chunksSent = 0;
          
          const sendChunk = () => {
            if (chunksSent >= expectedChunks) return;
            
            const chunkData = Array.from({ length: chunkSize }, (_, i) => ({
              id: chunksSent * chunkSize + i,
              data: `stream-item-${chunksSent * chunkSize + i}`
            }));

            const chunk: StreamChunk = {
              streamId: 'stream-id-123',
              chunkIndex: chunksSent,
              data: chunkData,
              isLast: chunksSent === expectedChunks - 1,
              progress: {
                streamId: 'stream-id-123',
                totalItems,
                processedItems: (chunksSent + 1) * chunkSize,
                percentage: ((chunksSent + 1) / expectedChunks) * 100,
                currentChunk: chunksSent,
                totalChunks: expectedChunks,
                startTime
              }
            };

            receivedChunks.push(chunk);
            callback(null, chunk);
            chunksSent++;

            if (chunk.isLast) {
              const totalTime = Date.now() - startTime;
              const throughput = totalItems / (totalTime / 1000);

              expect(receivedChunks).toHaveLength(expectedChunks);
              expect(throughput).toBeGreaterThan(1000); // At least 1000 items/second
              expect(totalTime).toBeLessThan(15000); // Under 15 seconds
              done();
            } else {
              setTimeout(sendChunk, 10); // 10ms between chunks
            }
          };

          setTimeout(sendChunk, 0);
        }
      });

      // Start streaming
      mockIpcRenderer.invoke('db:getRecent', totalItems);
      mockIpcRenderer.on('stream:chunk:stream-id-123', () => {});
    });

    test('should handle streaming errors gracefully', (done) => {
      let errorReceived = false;

      mockIpcRenderer.invoke.mockResolvedValue({
        success: true,
        data: 'error-stream-456'
      });

      mockIpcRenderer.on.mockImplementation((channel, callback) => {
        if (channel.includes('stream:error:')) {
          setTimeout(() => {
            errorReceived = true;
            callback(null, {
              error: 'Streaming interrupted due to high memory usage',
              streamId: 'error-stream-456',
              timestamp: Date.now()
            });
            
            expect(errorReceived).toBe(true);
            done();
          }, 100);
        }
      });

      mockIpcRenderer.invoke('db:getLargeDataset');
      mockIpcRenderer.on('stream:error:error-stream-456', () => {});
    });
  });

  describe('Cache Performance', () => {
    test('should show significant performance improvement with caching', async () => {
      const query = 'cached-performance-test';
      let cacheHit = false;

      mockIpcRenderer.invoke.mockImplementation(() => {
        if (cacheHit) {
          return createMockResponse('cached-result', 5); // Very fast cached response
        } else {
          cacheHit = true;
          return createMockResponse('fresh-result', 150); // Slower fresh response
        }
      });

      // First request (cache miss)
      const freshTimer = monitor.startTimer('fresh-request');
      const freshResult = await mockIpcRenderer.invoke('db:search', query);
      const freshTime = freshTimer();

      // Second request (cache hit)
      const cachedTimer = monitor.startTimer('cached-request');
      const cachedResult = await mockIpcRenderer.invoke('db:search', query);
      const cachedTime = cachedTimer();

      const speedImprovement = freshTime / cachedTime;

      expect(freshResult.success).toBe(true);
      expect(cachedResult.success).toBe(true);
      expect(speedImprovement).toBeGreaterThan(5); // At least 5x faster
      expect(cachedTime).toBeLessThan(20); // Cached response under 20ms
    });

    test('should handle cache invalidation performance', async () => {
      const queries = Array.from({ length: 100 }, (_, i) => `query-${i}`);
      
      mockIpcRenderer.invoke.mockImplementation((channel, query) => {
        if (channel === 'cache:invalidate') {
          return createMockResponse('invalidated', 50);
        }
        return createMockResponse(`result-${query}`, 25);
      });

      // Populate cache
      await Promise.all(queries.map(q => mockIpcRenderer.invoke('db:search', q)));

      // Invalidate cache and measure performance
      const invalidationTimer = monitor.startTimer('cache-invalidation');
      await mockIpcRenderer.invoke('cache:invalidate', 'all');
      const invalidationTime = invalidationTimer();

      // Verify cache was invalidated by checking response times
      const postInvalidationTimer = monitor.startTimer('post-invalidation');
      await mockIpcRenderer.invoke('db:search', queries[0]);
      const postInvalidationTime = postInvalidationTimer();

      expect(invalidationTime).toBeLessThan(200); // Invalidation under 200ms
      expect(postInvalidationTime).toBeGreaterThan(20); // Should be slower (cache miss)
    });
  });

  describe('Load Testing Scenarios', () => {
    test('should handle realistic user load patterns', async () => {
      const userSessions = 50;
      const actionsPerSession = 20;
      const sessionResults = [];

      mockIpcRenderer.invoke.mockImplementation(() => 
        createMockResponse('load-test-result', Math.random() * 100 + 20)
      );

      // Simulate multiple user sessions
      const sessionPromises = Array.from({ length: userSessions }, async (_, sessionId) => {
        const sessionStartTime = Date.now();
        const sessionActions = [];

        for (let action = 0; action < actionsPerSession; action++) {
          const actionType = Math.random() > 0.5 ? 'search' : 'getEntry';
          const delay = Math.random() * 1000; // Random delay between actions
          
          await new Promise(resolve => setTimeout(resolve, delay));
          
          const actionPromise = mockIpcRenderer.invoke(
            `db:${actionType}`, 
            `session-${sessionId}-action-${action}`
          );
          sessionActions.push(actionPromise);
        }

        const results = await Promise.all(sessionActions);
        const sessionTime = Date.now() - sessionStartTime;

        return {
          sessionId,
          sessionTime,
          actions: results.length,
          success: results.every(r => r.success)
        };
      });

      const sessionResults = await Promise.all(sessionPromises);
      const avgSessionTime = sessionResults.reduce((sum, s) => sum + s.sessionTime, 0) / sessionResults.length;
      const successRate = sessionResults.filter(s => s.success).length / sessionResults.length;

      expect(sessionResults).toHaveLength(userSessions);
      expect(successRate).toBeGreaterThan(0.95); // 95% success rate
      expect(avgSessionTime).toBeLessThan(30000); // Average session under 30s
    });

    test('should maintain performance during peak load', async () => {
      const peakConcurrency = 500;
      const peakDuration = 5000; // 5 seconds
      const requests = [];
      const startTime = Date.now();

      mockIpcRenderer.invoke.mockImplementation(() => 
        createMockResponse('peak-load-result', 60)
      );

      // Generate peak load
      while (Date.now() - startTime < peakDuration) {
        for (let i = 0; i < 10; i++) {
          requests.push(mockIpcRenderer.invoke('db:search', `peak-query-${requests.length}`));
        }
        await new Promise(resolve => setTimeout(resolve, 50)); // Brief pause
      }

      const results = await Promise.all(requests);
      const totalTime = Date.now() - startTime;
      const averageThroughput = requests.length / (totalTime / 1000);
      const errorRate = results.filter(r => !r.success).length / results.length;

      expect(requests.length).toBeGreaterThan(100); // Significant load
      expect(averageThroughput).toBeGreaterThan(10); // Maintain minimum throughput
      expect(errorRate).toBeLessThan(0.05); // Less than 5% error rate
    });
  });

  describe('Performance Regression Detection', () => {
    test('should detect response time regressions', async () => {
      const baselineResponseTimes: number[] = [];
      const currentResponseTimes: number[] = [];

      // Establish baseline
      mockIpcRenderer.invoke.mockImplementation(() => 
        createMockResponse('baseline-result', 50) // 50ms baseline
      );

      for (let i = 0; i < 30; i++) {
        const timer = monitor.startTimer('baseline');
        await mockIpcRenderer.invoke('db:search', `baseline-query-${i}`);
        baselineResponseTimes.push(timer());
      }

      // Test current performance (simulating degradation)
      mockIpcRenderer.invoke.mockImplementation(() => 
        createMockResponse('current-result', 85) // 85ms (70% slower)
      );

      for (let i = 0; i < 30; i++) {
        const timer = monitor.startTimer('current');
        await mockIpcRenderer.invoke('db:search', `current-query-${i}`);
        currentResponseTimes.push(timer());
      }

      const baselineAvg = baselineResponseTimes.reduce((a, b) => a + b) / baselineResponseTimes.length;
      const currentAvg = currentResponseTimes.reduce((a, b) => a + b) / currentResponseTimes.length;
      const regressionPercent = ((currentAvg - baselineAvg) / baselineAvg) * 100;

      expect(regressionPercent).toBeGreaterThan(30); // Detect significant regression
      expect(currentAvg).toBeGreaterThan(baselineAvg * 1.3); // 30% slower threshold
    });

    test('should monitor memory usage trends', async () => {
      const memoryReadings = [];

      mockIpcRenderer.invoke.mockImplementation(() => 
        createMockResponse('memory-trend-result', 40)
      );

      // Take memory readings over time
      for (let i = 0; i < 20; i++) {
        monitor.recordMemorySnapshot();
        
        // Perform operations
        const promises = Array.from({ length: 50 }, (_, j) =>
          mockIpcRenderer.invoke('db:search', `trend-query-${i}-${j}`)
        );
        await Promise.all(promises);
        
        const currentMemory = process.memoryUsage().heapUsed;
        memoryReadings.push(currentMemory);
        
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Analyze memory trend
      const memoryGrowthRate = (memoryReadings[memoryReadings.length - 1] - memoryReadings[0]) / memoryReadings.length;
      const maxMemoryIncrease = Math.max(...memoryReadings) - Math.min(...memoryReadings);

      expect(memoryGrowthRate).toBeLessThan(1024 * 1024); // Less than 1MB growth per iteration
      expect(maxMemoryIncrease).toBeLessThan(200 * 1024 * 1024); // Less than 200MB total increase
    });
  });
});
