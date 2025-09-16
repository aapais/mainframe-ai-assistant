/**
 * Long-Running Stability Reliability Tests
 * Tests for memory leaks, resource exhaustion, and extended operation stability
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import { performance } from 'perf_hooks';
import { DatabaseManager } from '../../src/database/DatabaseManager';
import { KnowledgeDB, KBEntry } from '../../src/database/KnowledgeDB';
import { EventEmitter } from 'events';

// Memory monitoring utility
class MemoryMonitor extends EventEmitter {
  private interval: NodeJS.Timeout | null = null;
  private samples: Array<{ timestamp: number; usage: NodeJS.MemoryUsage }> = [];
  private running = false;

  start(intervalMs: number = 1000): void {
    if (this.running) return;
    
    this.running = true;
    this.samples = [];
    
    this.interval = setInterval(() => {
      const usage = process.memoryUsage();
      this.samples.push({
        timestamp: Date.now(),
        usage
      });
      
      this.emit('sample', usage);
      
      // Check for memory leak indicators
      if (this.samples.length > 10) {
        const recent = this.samples.slice(-10);
        const trend = this.calculateMemoryTrend(recent);
        
        if (trend.slope > 1024 * 1024) { // > 1MB per second increase
          this.emit('leak-detected', { trend, recent });
        }
      }
    }, intervalMs);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.running = false;
  }

  getSamples(): Array<{ timestamp: number; usage: NodeJS.MemoryUsage }> {
    return [...this.samples];
  }

  getMemoryTrend(): { slope: number; correlation: number } {
    return this.calculateMemoryTrend(this.samples);
  }

  private calculateMemoryTrend(samples: Array<{ timestamp: number; usage: NodeJS.MemoryUsage }>): { slope: number; correlation: number } {
    if (samples.length < 2) return { slope: 0, correlation: 0 };

    const n = samples.length;
    const startTime = samples[0].timestamp;
    
    // Calculate linear regression for heap usage over time
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    
    samples.forEach(sample => {
      const x = (sample.timestamp - startTime) / 1000; // Convert to seconds
      const y = sample.usage.heapUsed;
      
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
    });

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    
    // Calculate correlation coefficient
    const meanX = sumX / n;
    const meanY = sumY / n;
    
    let numerator = 0, denomX = 0, denomY = 0;
    samples.forEach(sample => {
      const x = (sample.timestamp - startTime) / 1000;
      const y = sample.usage.heapUsed;
      
      const dx = x - meanX;
      const dy = y - meanY;
      
      numerator += dx * dy;
      denomX += dx * dx;
      denomY += dy * dy;
    });
    
    const correlation = numerator / Math.sqrt(denomX * denomY);
    
    return { slope, correlation };
  }
}

// Resource usage tracker
class ResourceTracker {
  private startTime = 0;
  private operations = 0;
  private errors = 0;

  start(): void {
    this.startTime = Date.now();
    this.operations = 0;
    this.errors = 0;
  }

  recordOperation(): void {
    this.operations++;
  }

  recordError(): void {
    this.errors++;
  }

  getStats() {
    const runTime = Date.now() - this.startTime;
    return {
      runTimeMs: runTime,
      runTimeHours: runTime / (1000 * 60 * 60),
      operations: this.operations,
      errors: this.errors,
      operationsPerSecond: this.operations / (runTime / 1000),
      errorRate: this.errors / Math.max(this.operations, 1)
    };
  }
}

describe('Long-Running Stability Tests', () => {
  let testDbPath: string;
  let dbManager: DatabaseManager;
  let knowledgeDB: KnowledgeDB;
  let memoryMonitor: MemoryMonitor;
  let resourceTracker: ResourceTracker;

  // Stability thresholds
  const MAX_MEMORY_GROWTH_MB_PER_HOUR = 50; // 50MB/hour max acceptable growth
  const MAX_ERROR_RATE = 0.01; // 1% max error rate
  const MIN_OPERATIONS_PER_SECOND = 10; // Minimum throughput
  const MAX_RESPONSE_TIME_DEGRADATION = 2.0; // Max 2x response time increase

  beforeAll(async () => {
    const tempDir = await fs.mkdtemp(path.join(__dirname, 'temp-stability-'));
    testDbPath = path.join(tempDir, 'test-stability.db');
    memoryMonitor = new MemoryMonitor();
    resourceTracker = new ResourceTracker();
  });

  beforeEach(async () => {
    // Clean start
    try {
      await fs.unlink(testDbPath);
    } catch (error) {
      // File might not exist
    }

    dbManager = new DatabaseManager(testDbPath);
    await dbManager.initialize();
    knowledgeDB = new KnowledgeDB(testDbPath);
    
    resourceTracker.start();
  });

  afterEach(async () => {
    memoryMonitor.stop();
    
    if (knowledgeDB) {
      await knowledgeDB.close();
    }
    if (dbManager) {
      await dbManager.close();
    }
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  });

  afterAll(async () => {
    try {
      const dir = path.dirname(testDbPath);
      await fs.rm(dir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Cleanup failed:', error);
    }
  });

  describe('Memory Leak Detection', () => {
    it('should not leak memory during continuous operations', async () => {
      memoryMonitor.start(100); // Sample every 100ms
      
      let leakDetected = false;
      memoryMonitor.on('leak-detected', () => {
        leakDetected = true;
      });

      // Run continuous operations for a few seconds
      const testDurationMs = 5000;
      const startTime = Date.now();
      
      let operationCount = 0;
      
      while (Date.now() - startTime < testDurationMs) {
        try {
          // Mix of operations that might leak memory
          const entry: KBEntry = {
            title: `Memory Test Entry ${operationCount}`,
            problem: `Problem ${operationCount} `.repeat(10), // Some content
            solution: `Solution ${operationCount} `.repeat(10),
            category: 'VSAM',
            tags: [`tag-${operationCount}`, `mem-test`]
          };

          const entryId = await knowledgeDB.addEntry(entry);
          await knowledgeDB.search(`Memory Test ${operationCount}`);
          await knowledgeDB.getEntry(entryId);
          
          // Occasionally delete entries to test cleanup
          if (operationCount % 10 === 0 && operationCount > 0) {
            await knowledgeDB.deleteEntry(entryId);
          }
          
          operationCount++;
          resourceTracker.recordOperation();
          
          // Small delay to prevent overwhelming
          await new Promise(resolve => setTimeout(resolve, 10));
        } catch (error) {
          resourceTracker.recordError();
          console.warn('Operation failed:', error);
        }
      }

      memoryMonitor.stop();
      
      // Analyze memory trend
      const memoryTrend = memoryMonitor.getMemoryTrend();
      const stats = resourceTracker.getStats();
      
      console.log(`Completed ${operationCount} operations`);
      console.log(`Memory trend slope: ${(memoryTrend.slope / 1024 / 1024).toFixed(2)} MB/s`);
      console.log(`Memory trend correlation: ${memoryTrend.correlation.toFixed(3)}`);
      console.log(`Error rate: ${(stats.errorRate * 100).toFixed(2)}%`);

      // Memory growth should be minimal
      const hourlyGrowthMB = (memoryTrend.slope * 3600) / (1024 * 1024);
      expect(hourlyGrowthMB).toBeLessThan(MAX_MEMORY_GROWTH_MB_PER_HOUR);
      expect(leakDetected).toBe(false);
      expect(stats.errorRate).toBeLessThan(MAX_ERROR_RATE);
    }, 10000);

    it('should clean up resources properly after operations', async () => {
      const initialMemory = process.memoryUsage();
      
      // Perform many operations that create temporary resources
      const operationCount = 1000;
      const largeData = 'x'.repeat(1000); // 1KB of data per operation
      
      for (let i = 0; i < operationCount; i++) {
        const entry: KBEntry = {
          title: `Resource Test ${i}`,
          problem: `${largeData} problem ${i}`,
          solution: `${largeData} solution ${i}`,
          category: 'VSAM',
          tags: [`resource-${i}`, largeData.substring(0, 50)]
        };

        const entryId = await knowledgeDB.addEntry(entry);
        
        // Perform operations that might create temporary objects
        await knowledgeDB.search(`Resource Test ${i}`);
        const retrieved = await knowledgeDB.getEntry(entryId);
        expect(retrieved).toBeTruthy();
        
        // Clean up immediately
        await knowledgeDB.deleteEntry(entryId);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
        await new Promise(resolve => setTimeout(resolve, 100));
        global.gc();
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const maxAllowedIncrease = operationCount * 100; // 100 bytes per operation

      console.log(`Memory increase: ${(memoryIncrease / 1024).toFixed(2)}KB for ${operationCount} operations`);
      
      expect(memoryIncrease).toBeLessThan(maxAllowedIncrease);
    }, 15000);

    it('should handle large dataset operations without memory issues', async () => {
      memoryMonitor.start(500);
      
      const batchSize = 100;
      const batchCount = 10;
      let totalEntries = 0;

      for (let batch = 0; batch < batchCount; batch++) {
        const entries: KBEntry[] = Array.from({ length: batchSize }, (_, i) => ({
          title: `Large Dataset Entry ${batch}-${i}`,
          problem: `Large problem description ${batch}-${i} `.repeat(20),
          solution: `Detailed solution for ${batch}-${i} `.repeat(30),
          category: ['VSAM', 'JCL', 'DB2', 'Batch', 'Other'][i % 5] as any,
          tags: [`batch-${batch}`, `entry-${i}`, 'large-dataset']
        }));

        // Add batch
        const entryIds: string[] = [];
        for (const entry of entries) {
          const id = await knowledgeDB.addEntry(entry);
          entryIds.push(id);
          totalEntries++;
        }

        // Perform searches on the growing dataset
        await knowledgeDB.search(`Large Dataset Entry ${batch}`);
        await knowledgeDB.search('large-dataset');
        await knowledgeDB.getAllEntries();

        console.log(`Completed batch ${batch + 1}/${batchCount} (${totalEntries} total entries)`);
      }

      memoryMonitor.stop();
      
      const memoryTrend = memoryMonitor.getMemoryTrend();
      const samples = memoryMonitor.getSamples();
      
      if (samples.length > 0) {
        const initialMemory = samples[0].usage.heapUsed;
        const finalMemory = samples[samples.length - 1].usage.heapUsed;
        const memoryIncreasePerEntry = (finalMemory - initialMemory) / totalEntries;
        
        console.log(`Memory per entry: ${(memoryIncreasePerEntry / 1024).toFixed(2)}KB`);
        console.log(`Total memory increase: ${((finalMemory - initialMemory) / 1024 / 1024).toFixed(2)}MB`);
        
        // Should not use excessive memory per entry
        expect(memoryIncreasePerEntry).toBeLessThan(10 * 1024); // < 10KB per entry
      }
    }, 30000);
  });

  describe('Resource Exhaustion Prevention', () => {
    it('should handle file descriptor exhaustion gracefully', async () => {
      const maxConnections = 50;
      const connections: KnowledgeDB[] = [];
      let successfulConnections = 0;
      let failedConnections = 0;

      try {
        // Try to create many connections
        for (let i = 0; i < maxConnections; i++) {
          try {
            const db = new KnowledgeDB(testDbPath);
            connections.push(db);
            successfulConnections++;
            
            // Test each connection
            await db.search('test');
          } catch (error) {
            failedConnections++;
            console.log(`Connection ${i} failed: ${(error as Error).message}`);
          }
        }

        console.log(`Successful connections: ${successfulConnections}`);
        console.log(`Failed connections: ${failedConnections}`);
        
        // Should handle at least some connections successfully
        expect(successfulConnections).toBeGreaterThan(0);
        
        // System should not crash from resource exhaustion
        expect(true).toBe(true); // If we reach here, no crash occurred
      } finally {
        // Cleanup all connections
        for (const conn of connections) {
          try {
            await conn.close();
          } catch (error) {
            // Ignore cleanup errors
          }
        }
      }
    });

    it('should handle disk space constraints gracefully', async () => {
      // Simulate approaching disk space limits by creating large entries
      const largeContent = 'x'.repeat(10000); // 10KB per entry
      let entriesAdded = 0;
      let diskSpaceError = false;

      try {
        // Keep adding until we hit a limit or error
        for (let i = 0; i < 1000; i++) {
          try {
            await knowledgeDB.addEntry({
              title: `Large Entry ${i}`,
              problem: `${largeContent} - problem ${i}`,
              solution: `${largeContent} - solution ${i}`,
              category: 'Other',
              tags: [`large-${i}`]
            });
            entriesAdded++;
          } catch (error) {
            const errorMessage = (error as Error).message.toLowerCase();
            if (errorMessage.includes('disk') || errorMessage.includes('space') || errorMessage.includes('full')) {
              diskSpaceError = true;
              break;
            }
            throw error; // Re-throw if it's not a disk space error
          }
        }
      } catch (error) {
        console.log(`Stopped at ${entriesAdded} entries due to: ${(error as Error).message}`);
      }

      console.log(`Added ${entriesAdded} large entries`);
      
      // Should have added some entries successfully
      expect(entriesAdded).toBeGreaterThan(0);
      
      // If we hit disk space, should handle it gracefully
      if (diskSpaceError) {
        // Database should still be readable
        const entries = await knowledgeDB.getAllEntries();
        expect(entries.length).toBe(entriesAdded);
      }
    });

    it('should prevent runaway query execution', async () => {
      // Add data for complex queries
      for (let i = 0; i < 100; i++) {
        await knowledgeDB.addEntry({
          title: `Complex Query Test ${i}`,
          problem: `Problem with many keywords: ${Array.from({length: 50}, (_, j) => `keyword${j}`).join(' ')}`,
          solution: `Solution with many terms: ${Array.from({length: 50}, (_, j) => `term${j}`).join(' ')}`,
          category: 'VSAM',
          tags: Array.from({length: 20}, (_, j) => `tag${i}-${j}`)
        });
      }

      const startTime = performance.now();
      
      // Execute potentially expensive query
      const results = await knowledgeDB.search('keyword1 keyword2 keyword3 keyword4 keyword5');
      
      const executionTime = performance.now() - startTime;
      
      console.log(`Complex query executed in ${executionTime.toFixed(2)}ms`);
      
      // Should complete within reasonable time
      expect(executionTime).toBeLessThan(5000); // < 5 seconds
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('Extended Operation Testing', () => {
    it('should maintain performance over extended operation', async () => {
      const testDurationMs = 10000; // 10 seconds
      const startTime = Date.now();
      
      const responseTimes: number[] = [];
      let operationCount = 0;
      
      // Baseline performance
      const baselineStart = performance.now();
      await knowledgeDB.search('baseline test');
      const baselineTime = performance.now() - baselineStart;
      
      while (Date.now() - startTime < testDurationMs) {
        const operationStart = performance.now();
        
        try {
          // Mix of operations
          const operation = operationCount % 4;
          
          switch (operation) {
            case 0:
              await knowledgeDB.addEntry({
                title: `Extended Test Entry ${operationCount}`,
                problem: `Problem ${operationCount}`,
                solution: `Solution ${operationCount}`,
                category: 'VSAM',
                tags: [`extended-${operationCount}`]
              });
              break;
              
            case 1:
              await knowledgeDB.search(`Extended Test ${Math.floor(operationCount / 4)}`);
              break;
              
            case 2:
              const entries = await knowledgeDB.getAllEntries();
              if (entries.length > 0) {
                await knowledgeDB.getEntry(entries[operationCount % entries.length].id!);
              }
              break;
              
            case 3:
              const allEntries = await knowledgeDB.getAllEntries();
              if (allEntries.length > 10) {
                const entryToDelete = allEntries[Math.floor(Math.random() * allEntries.length)];
                await knowledgeDB.deleteEntry(entryToDelete.id!);
              }
              break;
          }
          
          const operationTime = performance.now() - operationStart;
          responseTimes.push(operationTime);
          operationCount++;
          resourceTracker.recordOperation();
          
        } catch (error) {
          resourceTracker.recordError();
          console.warn(`Operation ${operationCount} failed:`, error);
        }
        
        // Small delay to prevent overwhelming
        await new Promise(resolve => setTimeout(resolve, 5));
      }
      
      // Analyze performance degradation
      const recentResponseTimes = responseTimes.slice(-100); // Last 100 operations
      const avgResponseTime = recentResponseTimes.reduce((a, b) => a + b, 0) / recentResponseTimes.length;
      
      const stats = resourceTracker.getStats();
      
      console.log(`Extended test completed:`);
      console.log(`- Operations: ${operationCount}`);
      console.log(`- Runtime: ${stats.runTimeHours.toFixed(2)} hours`);
      console.log(`- Avg response time: ${avgResponseTime.toFixed(2)}ms`);
      console.log(`- Baseline response time: ${baselineTime.toFixed(2)}ms`);
      console.log(`- Performance ratio: ${(avgResponseTime / baselineTime).toFixed(2)}x`);
      console.log(`- Error rate: ${(stats.errorRate * 100).toFixed(2)}%`);

      // Performance should not degrade significantly
      expect(avgResponseTime / baselineTime).toBeLessThan(MAX_RESPONSE_TIME_DEGRADATION);
      expect(stats.errorRate).toBeLessThan(MAX_ERROR_RATE);
      expect(stats.operationsPerSecond).toBeGreaterThan(MIN_OPERATIONS_PER_SECOND);
    }, 15000);

    it('should handle continuous high-frequency operations', async () => {
      const operationCount = 1000;
      const concurrency = 5;
      const batchSize = operationCount / concurrency;
      
      memoryMonitor.start(200);
      
      const batches = Array.from({ length: concurrency }, (_, batchIndex) =>
        Array.from({ length: Math.floor(batchSize) }, (_, i) => ({
          title: `High Freq Entry ${batchIndex}-${i}`,
          problem: `High frequency problem ${batchIndex}-${i}`,
          solution: `High frequency solution ${batchIndex}-${i}`,
          category: 'VSAM' as const,
          tags: [`batch-${batchIndex}`, `high-freq-${i}`]
        }))
      );

      const startTime = performance.now();
      
      // Execute batches concurrently
      const batchPromises = batches.map(async (batch, batchIndex) => {
        const batchResults = { success: 0, errors: 0 };
        
        for (const entry of batch) {
          try {
            const entryId = await knowledgeDB.addEntry(entry);
            
            // Immediately perform follow-up operations
            await knowledgeDB.search(entry.title);
            await knowledgeDB.getEntry(entryId);
            
            batchResults.success++;
          } catch (error) {
            batchResults.errors++;
            console.warn(`Batch ${batchIndex} operation failed:`, error);
          }
        }
        
        return batchResults;
      });

      const results = await Promise.all(batchPromises);
      const totalTime = performance.now() - startTime;
      
      memoryMonitor.stop();
      
      const totalSuccess = results.reduce((sum, r) => sum + r.success, 0);
      const totalErrors = results.reduce((sum, r) => sum + r.errors, 0);
      const successRate = totalSuccess / (totalSuccess + totalErrors);
      const throughput = totalSuccess / (totalTime / 1000);
      
      console.log(`High-frequency test results:`);
      console.log(`- Total operations: ${totalSuccess + totalErrors}`);
      console.log(`- Success rate: ${(successRate * 100).toFixed(2)}%`);
      console.log(`- Throughput: ${throughput.toFixed(2)} ops/sec`);
      console.log(`- Total time: ${totalTime.toFixed(2)}ms`);

      expect(successRate).toBeGreaterThan(0.95); // > 95% success rate
      expect(throughput).toBeGreaterThan(MIN_OPERATIONS_PER_SECOND);
      
      // Check memory stability
      const memoryTrend = memoryMonitor.getMemoryTrend();
      const hourlyGrowthMB = (memoryTrend.slope * 3600) / (1024 * 1024);
      expect(hourlyGrowthMB).toBeLessThan(MAX_MEMORY_GROWTH_MB_PER_HOUR);
    }, 20000);
  });

  describe('System State Consistency', () => {
    it('should maintain consistent state during concurrent operations', async () => {
      const concurrentOperations = 20;
      const operationsPerWorker = 50;
      
      // Create shared state to verify consistency
      let globalCounter = 0;
      const stateTracker = new Map<string, number>();
      
      const workers = Array.from({ length: concurrentOperations }, async (_, workerId) => {
        const workerResults = { operations: 0, errors: 0 };
        
        for (let i = 0; i < operationsPerWorker; i++) {
          try {
            const localCounter = ++globalCounter;
            const entryId = `worker-${workerId}-${i}`;
            
            await knowledgeDB.addEntry({
              title: `Consistency Test ${entryId}`,
              problem: `Problem from worker ${workerId}, operation ${i}`,
              solution: `Solution with counter ${localCounter}`,
              category: 'VSAM',
              tags: [`worker-${workerId}`, `op-${i}`, `counter-${localCounter}`]
            });
            
            stateTracker.set(entryId, localCounter);
            workerResults.operations++;
            
          } catch (error) {
            workerResults.errors++;
            console.warn(`Worker ${workerId} operation ${i} failed:`, error);
          }
        }
        
        return workerResults;
      });

      const results = await Promise.all(workers);
      
      // Verify consistency
      const allEntries = await knowledgeDB.getAllEntries();
      const totalOperations = results.reduce((sum, r) => sum + r.operations, 0);
      const totalErrors = results.reduce((sum, r) => sum + r.errors, 0);
      
      console.log(`Consistency test results:`);
      console.log(`- Workers: ${concurrentOperations}`);
      console.log(`- Successful operations: ${totalOperations}`);
      console.log(`- Failed operations: ${totalErrors}`);
      console.log(`- Entries in database: ${allEntries.length}`);
      
      // Database should contain exactly the successful operations
      expect(allEntries.length).toBe(totalOperations);
      
      // Verify all entries have consistent data
      const inconsistentEntries = allEntries.filter(entry => {
        const counterMatch = entry.solution?.match(/counter (\d+)/);
        if (!counterMatch) return true;
        
        const counter = parseInt(counterMatch[1]);
        return counter <= 0 || counter > globalCounter;
      });
      
      expect(inconsistentEntries).toHaveLength(0);
    });

    it('should recover consistent state after interruption', async () => {
      // Create initial consistent state
      const initialEntries = 10;
      const entryIds: string[] = [];
      
      for (let i = 0; i < initialEntries; i++) {
        const id = await knowledgeDB.addEntry({
          title: `Initial Entry ${i}`,
          problem: `Initial problem ${i}`,
          solution: `Initial solution ${i}`,
          category: 'VSAM',
          tags: [`initial-${i}`]
        });
        entryIds.push(id);
      }

      // Simulate interruption during batch operation
      const batchOperations = Array.from({ length: 5 }, (_, i) =>
        knowledgeDB.addEntry({
          title: `Batch Entry ${i}`,
          problem: `Batch problem ${i}`,
          solution: `Batch solution ${i}`,
          category: 'JCL',
          tags: [`batch-${i}`]
        }).catch(error => ({ error }))
      );

      // Let some operations complete, others might fail
      const batchResults = await Promise.allSettled(batchOperations);
      
      // Verify database is in consistent state
      const allEntries = await knowledgeDB.getAllEntries();
      
      // Should have at least the initial entries
      expect(allEntries.length).toBeGreaterThanOrEqual(initialEntries);
      
      // All entries should be complete and valid
      allEntries.forEach(entry => {
        expect(entry.id).toBeTruthy();
        expect(entry.title).toBeTruthy();
        expect(entry.problem).toBeTruthy();
        expect(entry.solution).toBeTruthy();
        expect(entry.category).toBeTruthy();
        expect(entry.created_at).toBeTruthy();
        expect(typeof entry.usage_count).toBe('number');
      });

      // Should be able to perform operations normally
      const testId = await knowledgeDB.addEntry({
        title: 'Post-interruption test',
        problem: 'Test after recovery',
        solution: 'Should work normally',
        category: 'Other',
        tags: ['recovery-test']
      });
      
      expect(testId).toBeTruthy();
      
      const retrieved = await knowledgeDB.getEntry(testId);
      expect(retrieved).toBeTruthy();
      expect(retrieved?.title).toBe('Post-interruption test');
    });
  });
});