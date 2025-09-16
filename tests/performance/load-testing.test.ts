import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import { PerformanceTestHelper } from '../../src/database/__tests__/test-utils/PerformanceTestHelper';
import { DatabaseManager } from '../../src/database/DatabaseManager';
import { KnowledgeDB } from '../../src/database/KnowledgeDB';
import { SearchService } from '../../src/services/SearchService';
import { TestDatabaseFactory } from '../../src/database/__tests__/test-utils/TestDatabaseFactory';
import path from 'path';
import fs from 'fs';
import { performance } from 'perf_hooks';

describe('Load Testing and Stress Testing', () => {
  let performanceHelper: PerformanceTestHelper;
  let dbManager: DatabaseManager;
  let kb: KnowledgeDB;
  let searchService: SearchService;
  let testDbPath: string;

  beforeAll(async () => {
    performanceHelper = new PerformanceTestHelper();
    testDbPath = path.join(__dirname, '..', 'temp', 'load-test.db');
  });

  beforeEach(async () => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    dbManager = await TestDatabaseFactory.createTestDatabaseManager({
      path: testDbPath,
      enableWAL: true,
      cacheSize: 200, // Larger cache for load testing
      maxConnections: 20, // More connections for load testing
      queryCache: {
        enabled: true,
        maxSize: 2000,
        ttlMs: 600000 // 10 minutes
      },
      performanceMonitoring: true
    });

    kb = new KnowledgeDB(testDbPath);
    
    // Mock search service
    searchService = {
      search: jest.fn().mockImplementation((query, options) => kb.search(query, options)),
      searchWithAI: jest.fn().mockImplementation((query, options) => kb.search(query, options))
    } as any;

    // Setup initial test data
    await this.setupLoadTestData();
  });

  afterEach(async () => {
    if (kb) {
      kb.close();
    }
    if (dbManager) {
      await dbManager.shutdown();
    }
  });

  afterAll(() => {
    performanceHelper.clearResults();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  async setupLoadTestData(): Promise<void> {
    const entries = TestDatabaseFactory.createLargeTestDataset(2000);
    
    await dbManager.transaction(async () => {
      for (const entry of entries) {
        await kb.addEntry(entry, 'load-test-user');
      }
    });
  }

  describe('MVP1 Load Requirements: Concurrent User Support', () => {
    it('should handle 10 concurrent users performing typical operations', async () => {
      const typicalOperations = [
        // Search operations (most common)
        async () => {
          const queries = ['error', 'VSAM', 'data exception', 'JCL dataset', 'system failure'];
          const query = queries[Math.floor(Math.random() * queries.length)];
          return await kb.search(query, { limit: 10 });
        },
        // View entry details
        async () => {
          const entries = await kb.search('', { limit: 100 });
          if (entries.length > 0) {
            const randomEntry = entries[Math.floor(Math.random() * entries.length)];
            await kb.recordUsage(randomEntry.id, true);
          }
        },
        // Add new entries (less frequent)
        async () => {
          if (Math.random() < 0.1) { // 10% chance
            await kb.addEntry({
              title: `Load Test Entry ${Date.now()}`,
              problem: 'Load test problem description',
              solution: 'Load test solution steps',
              category: ['VSAM', 'JCL', 'DB2'][Math.floor(Math.random() * 3)]
            }, 'concurrent-user');
          }
        }
      ];

      const loadTestResult = await performanceHelper.runLoadTest({
        concurrentUsers: 10,
        duration: 30, // 30 seconds
        rampUpTime: 5,  // 5 seconds ramp-up
        operations: typicalOperations
      });

      const successRate = loadTestResult.filter(r => r.success).length / loadTestResult.length;
      expect(successRate).toBeGreaterThan(0.95); // 95% success rate

      // Calculate average response times
      const successfulResults = loadTestResult.filter(r => r.success);
      const avgResponseTime = successfulResults.reduce((sum, r) => sum + r.metrics.executionTime, 0) / successfulResults.length;
      
      expect(avgResponseTime).toBeLessThan(1000); // Average response < 1s
      
      // No request should take more than 5 seconds
      const maxResponseTime = Math.max(...successfulResults.map(r => r.metrics.executionTime));
      expect(maxResponseTime).toBeLessThan(5000);
    });

    it('should scale to 20 concurrent users without significant degradation', async () => {
      const scalabilityOperations = [
        async () => await kb.search('system error', { limit: 15 }),
        async () => await kb.search('database connection', { limit: 10 }),
        async () => await kb.searchByCategory('VSAM'),
        async () => {
          const metrics = await kb.getMetrics();
          expect(metrics).toBeDefined();
        }
      ];

      const scalabilityResult = await performanceHelper.runLoadTest({
        concurrentUsers: 20,
        duration: 45, // 45 seconds
        rampUpTime: 10, // 10 seconds ramp-up
        operations: scalabilityOperations
      });

      const successRate = scalabilityResult.filter(r => r.success).length / scalabilityResult.length;
      expect(successRate).toBeGreaterThan(0.90); // 90% success rate at higher concurrency

      // Check for performance consistency
      const successfulResults = scalabilityResult.filter(r => r.success);
      const responseTimes = successfulResults.map(r => r.metrics.executionTime);
      
      // Calculate percentiles
      const sortedTimes = responseTimes.sort((a, b) => a - b);
      const p50 = sortedTimes[Math.floor(sortedTimes.length * 0.5)];
      const p95 = sortedTimes[Math.floor(sortedTimes.length * 0.95)];
      const p99 = sortedTimes[Math.floor(sortedTimes.length * 0.99)];

      expect(p50).toBeLessThan(500);  // 50th percentile < 500ms
      expect(p95).toBeLessThan(2000); // 95th percentile < 2s
      expect(p99).toBeLessThan(5000); // 99th percentile < 5s
    });

    it('should handle burst traffic patterns', async () => {
      const burstOperations = [
        async () => await kb.search('urgent system error', { limit: 20 }),
        async () => await kb.search('critical failure', { limit: 20 }),
        async () => await kb.search('production issue', { limit: 20 })
      ];

      // Simulate traffic burst: high concurrency for short period
      const burstResult = await performanceHelper.runLoadTest({
        concurrentUsers: 30, // High concurrency
        duration: 15, // Short duration
        rampUpTime: 1, // Very fast ramp-up (burst)
        operations: burstOperations
      });

      const successRate = burstResult.filter(r => r.success).length / burstResult.length;
      expect(successRate).toBeGreaterThan(0.80); // 80% success during burst

      // System should recover quickly after burst
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const postBurstHealth = await dbManager.getHealth();
      expect(postBurstHealth.status).toMatch(/healthy|degraded/);
    });
  });

  describe('Stress Testing: System Limits', () => {
    it('should handle high-volume search workload', async () => {
      const highVolumeQueries = [
        'error', 'system', 'data', 'file', 'connection',
        'timeout', 'failure', 'exception', 'abend', 'status',
        'batch', 'online', 'process', 'memory', 'disk',
        'network', 'database', 'application', 'service', 'job'
      ];

      const highVolumeOperations = highVolumeQueries.map(query => 
        async () => await kb.search(query, { limit: 30 })
      );

      const stressResult = await performanceHelper.runLoadTest({
        concurrentUsers: 25,
        duration: 60, // 1 minute stress test
        rampUpTime: 10,
        operations: highVolumeOperations
      });

      const successRate = stressResult.filter(r => r.success).length / stressResult.length;
      expect(successRate).toBeGreaterThan(0.85); // 85% success under stress

      // Check system resource usage
      const memoryMetrics = await performanceHelper.testMemoryUsage(
        async () => {
          for (let i = 0; i < 10; i++) {
            await kb.search(`stress test ${i}`, { limit: 10 });
          }
        },
        10000, // 10 seconds
        1000   // 1 second intervals
      );

      // Memory usage should remain stable
      const startMemory = memoryMetrics[0].memoryUsage.heapUsed;
      const endMemory = memoryMetrics[memoryMetrics.length - 1].memoryUsage.heapUsed;
      const memoryGrowthRatio = endMemory / startMemory;

      expect(memoryGrowthRatio).toBeLessThan(2.0); // Memory shouldn't double
    });

    it('should handle database saturation gracefully', async () => {
      const dbSaturationOperations = [
        // Heavy read operations
        async () => {
          await dbManager.execute(`
            SELECT e.*, COUNT(t.tag) as tag_count
            FROM kb_entries e
            LEFT JOIN kb_tags t ON e.id = t.entry_id
            GROUP BY e.id
            ORDER BY e.usage_count DESC
            LIMIT 50
          `);
        },
        // Complex aggregations
        async () => {
          await dbManager.execute(`
            SELECT category, 
                   COUNT(*) as total,
                   AVG(usage_count) as avg_usage,
                   SUM(success_count) as total_success,
                   MAX(created_at) as latest
            FROM kb_entries 
            WHERE created_at > datetime('now', '-30 days')
            GROUP BY category
            HAVING total > 5
          `);
        },
        // Full-text searches
        async () => {
          const queries = ['complex system error', 'database connection timeout', 'file processing failure'];
          const query = queries[Math.floor(Math.random() * queries.length)];
          await dbManager.execute(`
            SELECT e.*, bm25(kb_fts) as score
            FROM kb_fts f
            JOIN kb_entries e ON f.id = e.id
            WHERE kb_fts MATCH ?
            ORDER BY score DESC
            LIMIT 25
          `, [query]);
        }
      ];

      const saturationResult = await performanceHelper.runLoadTest({
        concurrentUsers: 15,
        duration: 90, // 1.5 minutes
        rampUpTime: 15,
        operations: dbSaturationOperations
      });

      const successRate = saturationResult.filter(r => r.success).length / saturationResult.length;
      expect(successRate).toBeGreaterThan(0.75); // 75% success under saturation

      // Database should remain responsive for simple queries
      const simpleQueryTime = await performanceHelper.measureOperation(
        'simple-query-under-saturation',
        () => dbManager.execute('SELECT COUNT(*) FROM kb_entries'),
        10
      );

      expect(simpleQueryTime.success).toBe(true);
      expect(simpleQueryTime.metrics.executionTime / simpleQueryTime.iterations).toBeLessThan(1000);
    });

    it('should recover from resource exhaustion', async () => {
      // Create resource exhaustion scenario
      const exhaustionOperations = Array(50).fill(0).map(() => 
        async () => {
          // Create many concurrent long-running operations
          const operations = Array(10).fill(0).map(async () => {
            await new Promise(resolve => setTimeout(resolve, Math.random() * 3000));
            return await kb.search('resource exhaustion test', { limit: 100 });
          });
          
          await Promise.all(operations);
        }
      );

      // Run operations that should exhaust resources
      const exhaustionPromises = exhaustionOperations.map(op => op());
      
      // Don't wait for all to complete - some should fail/timeout
      await Promise.race([
        Promise.all(exhaustionPromises),
        new Promise(resolve => setTimeout(resolve, 15000)) // 15 second timeout
      ]);

      // Wait for system to recover
      await new Promise(resolve => setTimeout(resolve, 10000));

      // Test system recovery
      const recoveryTest = await performanceHelper.measureOperation(
        'system-recovery-test',
        async () => {
          const results = await Promise.all([
            kb.search('recovery test 1'),
            kb.search('recovery test 2'),
            kb.search('recovery test 3'),
            dbManager.getHealth()
          ]);
          
          results.slice(0, 3).forEach(result => {
            expect(Array.isArray(result)).toBe(true);
          });
          
          const health = results[3];
          expect(health.status).toMatch(/healthy|degraded/);
        },
        5
      );

      expect(recoveryTest.success).toBe(true);
    });
  });

  describe('Endurance Testing: Sustained Load', () => {
    it('should maintain performance during extended operation', async () => {
      const enduranceOperations = [
        async () => {
          const queries = ['maintenance error', 'scheduled job', 'system update', 'daily process'];
          return await kb.search(queries[Math.floor(Math.random() * queries.length)], { limit: 10 });
        },
        async () => {
          // Simulate periodic maintenance operations
          if (Math.random() < 0.05) { // 5% chance
            await dbManager.execute('ANALYZE kb_entries');
          }
        },
        async () => {
          // Simulate usage tracking
          const entries = await kb.search('random', { limit: 5 });
          if (entries.length > 0) {
            const entry = entries[Math.floor(Math.random() * entries.length)];
            await kb.recordUsage(entry.id, Math.random() > 0.2); // 80% success rate
          }
        }
      ];

      const enduranceResult = await performanceHelper.runLoadTest({
        concurrentUsers: 8, // Moderate sustained load
        duration: 300, // 5 minutes
        rampUpTime: 30, // 30 seconds ramp-up
        operations: enduranceOperations
      });

      const successRate = enduranceResult.filter(r => r.success).length / enduranceResult.length;
      expect(successRate).toBeGreaterThan(0.95); // High success rate over time

      // Check performance consistency over time
      const timeIntervals = [
        enduranceResult.filter(r => r.timestamp.getTime() < Date.now() - 240000), // First minute
        enduranceResult.filter(r => r.timestamp.getTime() >= Date.now() - 60000)   // Last minute
      ];

      timeIntervals.forEach(interval => {
        const avgTime = interval
          .filter(r => r.success)
          .reduce((sum, r) => sum + r.metrics.executionTime, 0) / interval.filter(r => r.success).length;
        
        expect(avgTime).toBeLessThan(2000); // Consistent performance
      });
    });

    it('should handle memory leaks and resource cleanup', async () => {
      const initialMemory = process.memoryUsage();
      
      // Run sustained operations that could cause leaks
      for (let cycle = 0; cycle < 10; cycle++) {
        const cycleOperations = Array(100).fill(0).map(async (_, i) => {
          // Create and cleanup operations
          const query = `memory test cycle ${cycle} operation ${i}`;
          const results = await kb.search(query);
          
          // Force some garbage by creating temporary objects
          const temp = {
            data: new Array(1000).fill(query),
            results: results.map(r => ({ ...r, temp: Math.random() }))
          };
          
          // Clear reference
          (temp as any) = null;
          
          return results.length;
        });

        await Promise.all(cycleOperations);
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
        
        // Check memory growth
        const currentMemory = process.memoryUsage();
        const memoryGrowth = (currentMemory.heapUsed - initialMemory.heapUsed) / initialMemory.heapUsed;
        
        // Memory growth should be reasonable (less than 100% increase)
        expect(memoryGrowth).toBeLessThan(1.0);
      }

      // Final memory check
      const finalMemory = process.memoryUsage();
      const totalGrowth = (finalMemory.heapUsed - initialMemory.heapUsed) / initialMemory.heapUsed;
      
      expect(totalGrowth).toBeLessThan(0.5); // Less than 50% growth over sustained operation
    });

    it('should maintain database consistency during extended load', async () => {
      const consistencyOperations = [
        async () => {
          // Add entries
          await kb.addEntry({
            title: `Consistency Test ${Date.now()}`,
            problem: 'Testing database consistency',
            solution: 'Maintain ACID properties',
            category: 'Test'
          }, 'consistency-user');
        },
        async () => {
          // Update entries
          const entries = await kb.search('Consistency Test', { limit: 5 });
          if (entries.length > 0) {
            const entry = entries[Math.floor(Math.random() * entries.length)];
            await kb.recordUsage(entry.id, true);
          }
        },
        async () => {
          // Read operations
          await kb.search('consistency', { limit: 20 });
        },
        async () => {
          // Aggregate operations
          await kb.getMetrics();
        }
      ];

      const consistencyResult = await performanceHelper.runLoadTest({
        concurrentUsers: 12,
        duration: 180, // 3 minutes
        rampUpTime: 20,
        operations: consistencyOperations
      });

      // Verify database consistency after load
      const consistencyChecks = [
        // Check referential integrity
        async () => {
          const orphanTags = await dbManager.execute(`
            SELECT COUNT(*) as count 
            FROM kb_tags t 
            LEFT JOIN kb_entries e ON t.entry_id = e.id 
            WHERE e.id IS NULL
          `);
          expect((orphanTags[0] as any).count).toBe(0);
        },
        
        // Check FTS index consistency
        async () => {
          const ftsCount = await dbManager.execute('SELECT COUNT(*) as count FROM kb_fts');
          const entriesCount = await dbManager.execute('SELECT COUNT(*) as count FROM kb_entries');
          expect((ftsCount[0] as any).count).toBe((entriesCount[0] as any).count);
        },
        
        // Check data integrity
        async () => {
          const invalidEntries = await dbManager.execute(`
            SELECT COUNT(*) as count 
            FROM kb_entries 
            WHERE title IS NULL OR title = '' 
               OR problem IS NULL OR problem = ''
               OR solution IS NULL OR solution = ''
          `);
          expect((invalidEntries[0] as any).count).toBe(0);
        }
      ];

      for (const check of consistencyChecks) {
        await check();
      }

      const successRate = consistencyResult.filter(r => r.success).length / consistencyResult.length;
      expect(successRate).toBeGreaterThan(0.90); // Maintain high success rate
    });
  });

  describe('Performance Regression Testing', () => {
    it('should detect performance degradation under load', async () => {
      // Establish baseline performance
      const baselineOperations = [
        { name: 'search-baseline', fn: () => kb.search('baseline test', { limit: 10 }) },
        { name: 'metrics-baseline', fn: () => kb.getMetrics() },
        { name: 'category-search-baseline', fn: () => kb.searchByCategory('VSAM') }
      ];

      const baselineResults = await performanceHelper.compareImplementations(baselineOperations, 20);

      // Run same operations under concurrent load
      const loadPromise = performanceHelper.runLoadTest({
        concurrentUsers: 15,
        duration: 30,
        rampUpTime: 5,
        operations: [
          async () => await kb.search('background load', { limit: 5 }),
          async () => await dbManager.execute('SELECT COUNT(*) FROM kb_entries')
        ]
      });

      // Wait a bit for load to ramp up
      await new Promise(resolve => setTimeout(resolve, 10000));

      // Run baseline operations under load
      const loadResults = await performanceHelper.compareImplementations(baselineOperations, 20);

      // Wait for load test to complete
      await loadPromise;

      // Analyze regression
      const regressionAnalysis = performanceHelper.analyzeRegression(
        Object.values(baselineResults),
        Object.values(loadResults),
        0.5 // 50% degradation threshold
      );

      // Document any significant regressions
      const regressions = regressionAnalysis.filter(r => r.isRegression);
      if (regressions.length > 0) {
        console.log('Performance regressions detected:', regressions);
      }

      // Most operations should not show severe degradation under moderate load
      expect(regressions.length).toBeLessThan(baselineOperations.length * 0.7); // Less than 70% severe regression
    });

    it('should maintain SLA compliance under various load conditions', async () => {
      const slaRequirements = {
        searchResponseTime: 1000,      // < 1s for search
        availabilityPercent: 99.0,     // 99% availability
        concurrentUsers: 20,           // Support 20 concurrent users
        throughputPerSecond: 50        // 50 operations per second
      };

      const slaOperations = [
        async () => {
          const start = performance.now();
          const results = await kb.search('SLA test query', { limit: 10 });
          const responseTime = performance.now() - start;
          
          return {
            responseTime,
            success: responseTime < slaRequirements.searchResponseTime,
            resultCount: results.length
          };
        }
      ];

      const slaResult = await performanceHelper.runLoadTest({
        concurrentUsers: slaRequirements.concurrentUsers,
        duration: 60, // 1 minute
        rampUpTime: 10,
        operations: slaOperations
      });

      // Check SLA compliance
      const successRate = slaResult.filter(r => r.success).length / slaResult.length;
      expect(successRate).toBeGreaterThan(slaRequirements.availabilityPercent / 100);

      const actualThroughput = slaResult.length / 60; // operations per second
      expect(actualThroughput).toBeGreaterThan(slaRequirements.throughputPerSecond);

      // Response time compliance
      const responseTimes = slaResult.map(r => r.metrics.executionTime);
      const avgResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
      
      expect(avgResponseTime).toBeLessThan(slaRequirements.searchResponseTime);
    });
  });
});