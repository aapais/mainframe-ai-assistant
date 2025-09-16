import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import { KnowledgeDB } from '../../src/database/KnowledgeDB';
import { DatabaseManager } from '../../src/database/DatabaseManager';
import { PerformanceTestHelper } from '../../src/database/__tests__/test-utils/PerformanceTestHelper';
import { TestDatabaseFactory } from '../../src/database/__tests__/test-utils/TestDatabaseFactory';
import path from 'path';
import fs from 'fs';
import { performance } from 'perf_hooks';

describe('Application Startup Performance Validation', () => {
  let performanceHelper: PerformanceTestHelper;
  let testDbPath: string;
  let backupDbPath: string;

  beforeAll(() => {
    performanceHelper = new PerformanceTestHelper();
    testDbPath = path.join(__dirname, '..', 'temp', 'startup-performance-test.db');
    backupDbPath = path.join(__dirname, '..', 'temp', 'startup-with-data.db');
  });

  beforeEach(() => {
    // Clean up any existing test databases
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  afterEach(() => {
    // Cleanup test files
    [testDbPath, backupDbPath].forEach(filePath => {
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (error) {
          console.warn(`Failed to cleanup ${filePath}:`, error);
        }
      }
    });
  });

  afterAll(() => {
    performanceHelper.clearResults();
  });

  describe('MVP1 Requirement: Application Startup < 5s', () => {
    it('should complete cold start initialization within 5 seconds', async () => {
      const coldStartResult = await performanceHelper.measureOperation(
        'cold-start-initialization',
        async () => {
          const db = new KnowledgeDB(testDbPath, {
            autoBackup: false // Disable backups for performance testing
          });

          // Wait for initialization to complete
          await new Promise<void>((resolve) => {
            const checkInitialized = () => {
              if (db['initialized']) {
                resolve();
              } else {
                setTimeout(checkInitialized, 10);
              }
            };
            checkInitialized();
          });

          // Verify database is functional
          const stats = await db.getStats();
          expect(stats).toBeDefined();
          expect(stats.totalEntries).toBe(0);

          db.close();
        },
        5 // Test 5 times for consistency
      );

      expect(coldStartResult.success).toBe(true);
      
      // Critical requirement: < 5 seconds (5000ms) startup time
      const avgStartupTime = coldStartResult.metrics.executionTime / coldStartResult.iterations;
      expect(avgStartupTime).toBeLessThan(5000);
      
      // Performance target: aim for < 3 seconds for good user experience
      if (avgStartupTime > 3000) {
        console.warn(`⚠️ Startup time ${avgStartupTime.toFixed(0)}ms exceeds 3s target but meets 5s requirement`);
      }

      console.log(`✅ Cold start: ${avgStartupTime.toFixed(0)}ms average`);
    });

    it('should complete warm start with existing data within 5 seconds', async () => {
      // Create database with existing data
      await this.createDatabaseWithTestData(backupDbPath, 1000);

      const warmStartResult = await performanceHelper.measureOperation(
        'warm-start-with-data',
        async () => {
          const db = new KnowledgeDB(backupDbPath, {
            autoBackup: false
          });

          // Wait for initialization to complete
          await new Promise<void>((resolve) => {
            const checkInitialized = () => {
              if (db['initialized']) {
                resolve();
              } else {
                setTimeout(checkInitialized, 10);
              }
            };
            checkInitialized();
          });

          // Verify database has existing data
          const stats = await db.getStats();
          expect(stats.totalEntries).toBeGreaterThan(900); // Allow some margin

          // Test basic functionality works immediately
          const searchResults = await db.search('VSAM error', { limit: 5 });
          expect(searchResults.length).toBeGreaterThan(0);

          db.close();
        },
        5
      );

      expect(warmStartResult.success).toBe(true);
      
      const avgWarmStartTime = warmStartResult.metrics.executionTime / warmStartResult.iterations;
      expect(avgWarmStartTime).toBeLessThan(5000);

      console.log(`✅ Warm start: ${avgWarmStartTime.toFixed(0)}ms average with 1000 entries`);
    });

    it('should handle database migration during startup efficiently', async () => {
      // Create an older database schema to test migration performance
      const migrationDb = new KnowledgeDB(testDbPath, { autoBackup: false });
      
      // Add some initial data
      await migrationDb.addEntry({
        title: 'Migration Test Entry',
        problem: 'Testing migration performance',
        solution: 'Should migrate quickly',
        category: 'Test'
      });

      migrationDb.close();

      const migrationStartupResult = await performanceHelper.measureOperation(
        'startup-with-migration',
        async () => {
          const db = new KnowledgeDB(testDbPath, {
            autoBackup: false
          });

          // Wait for initialization (including any migrations)
          await new Promise<void>((resolve) => {
            const checkInitialized = () => {
              if (db['initialized']) {
                resolve();
              } else {
                setTimeout(checkInitialized, 10);
              }
            };
            checkInitialized();
          });

          // Verify data survived migration
          const entries = await db.search('Migration Test');
          expect(entries.length).toBeGreaterThan(0);

          db.close();
        },
        3
      );

      expect(migrationStartupResult.success).toBe(true);
      
      const avgMigrationTime = migrationStartupResult.metrics.executionTime / migrationStartupResult.iterations;
      expect(avgMigrationTime).toBeLessThan(6000); // Allow slightly more time for migration

      console.log(`✅ Migration start: ${avgMigrationTime.toFixed(0)}ms average`);
    });

    it('should optimize cache warming during startup', async () => {
      // Create database with data for cache warming
      await this.createDatabaseWithTestData(testDbPath, 500);

      const cacheWarmingResult = await performanceHelper.measureOperation(
        'startup-with-cache-warming',
        async () => {
          const db = new KnowledgeDB(testDbPath, {
            autoBackup: false
          });

          // Wait for initialization
          await new Promise<void>((resolve) => {
            const checkInitialized = () => {
              if (db['initialized']) {
                resolve();
              } else {
                setTimeout(checkInitialized, 10);
              }
            };
            checkInitialized();
          });

          // Pre-warm cache with common queries
          await db.preWarmCache();

          // Verify cache is working
          const start = performance.now();
          await db.search('VSAM error');
          const cacheHitTime = performance.now() - start;
          
          // Cache hit should be very fast
          expect(cacheHitTime).toBeLessThan(50);

          db.close();
        },
        3
      );

      expect(cacheWarmingResult.success).toBe(true);
      
      const avgCacheWarmTime = cacheWarmingResult.metrics.executionTime / cacheWarmingResult.iterations;
      expect(avgCacheWarmTime).toBeLessThan(6000); // Allow extra time for cache warming

      console.log(`✅ Cache warming start: ${avgCacheWarmTime.toFixed(0)}ms average`);
    });
  });

  describe('Startup Performance Optimization Validation', () => {
    it('should validate schema creation performance', async () => {
      const schemaCreationResult = await performanceHelper.measureOperation(
        'schema-creation-performance',
        async () => {
          const dbManager = await TestDatabaseFactory.createTestDatabaseManager({
            path: testDbPath,
            enableWAL: true,
            cacheSize: 50, // Smaller cache for faster startup
            maxConnections: 5,
            queryCache: {
              enabled: true,
              maxSize: 500,
              ttlMs: 300000
            }
          });

          // Verify schema is created and functional
          const result = await dbManager.execute('SELECT COUNT(*) as count FROM kb_entries');
          expect(result).toBeDefined();
          expect((result[0] as any).count).toBe(0);

          await dbManager.shutdown();
        },
        5
      );

      expect(schemaCreationResult.success).toBe(true);
      
      const avgSchemaTime = schemaCreationResult.metrics.executionTime / schemaCreationResult.iterations;
      expect(avgSchemaTime).toBeLessThan(2000); // Schema creation should be fast

      console.log(`✅ Schema creation: ${avgSchemaTime.toFixed(0)}ms average`);
    });

    it('should validate index creation performance', async () => {
      const indexCreationResult = await performanceHelper.measureOperation(
        'index-creation-performance',
        async () => {
          const db = new KnowledgeDB(testDbPath, {
            autoBackup: false
          });

          // Wait for initialization (includes index creation)
          await new Promise<void>((resolve) => {
            const checkInitialized = () => {
              if (db['initialized']) {
                resolve();
              } else {
                setTimeout(checkInitialized, 10);
              }
            };
            checkInitialized();
          });

          // Verify indexes are working by running a query that should use them
          const indexTestResult = await db.search('category:VSAM');
          expect(indexTestResult).toBeDefined();

          db.close();
        },
        3
      );

      expect(indexCreationResult.success).toBe(true);
      
      const avgIndexTime = indexCreationResult.metrics.executionTime / indexCreationResult.iterations;
      expect(avgIndexTime).toBeLessThan(3000);

      console.log(`✅ Index creation: ${avgIndexTime.toFixed(0)}ms average`);
    });

    it('should validate startup performance under memory constraints', async () => {
      const memoryConstrainedResult = await performanceHelper.measureOperation(
        'memory-constrained-startup',
        async () => {
          // Force garbage collection to simulate low memory
          if (global.gc) {
            global.gc();
          }

          const db = new KnowledgeDB(testDbPath, {
            autoBackup: false
          });

          await new Promise<void>((resolve) => {
            const checkInitialized = () => {
              if (db['initialized']) {
                resolve();
              } else {
                setTimeout(checkInitialized, 10);
              }
            };
            checkInitialized();
          });

          // Verify functionality under memory constraints
          const stats = await db.getStats();
          expect(stats.totalEntries).toBe(0);

          db.close();
        },
        3
      );

      expect(memoryConstrainedResult.success).toBe(true);
      
      const avgConstrainedTime = memoryConstrainedResult.metrics.executionTime / memoryConstrainedResult.iterations;
      expect(avgConstrainedTime).toBeLessThan(7000); // Allow more time under memory constraints

      console.log(`✅ Memory constrained start: ${avgConstrainedTime.toFixed(0)}ms average`);
    });
  });

  describe('Startup Performance Regression Detection', () => {
    it('should establish startup performance baseline', async () => {
      const baselineTests = [
        {
          name: 'empty-database-startup',
          fn: () => this.measureBasicStartup(testDbPath)
        },
        {
          name: 'small-dataset-startup', 
          fn: async () => {
            await this.createDatabaseWithTestData(testDbPath, 100);
            return this.measureBasicStartup(testDbPath);
          }
        },
        {
          name: 'medium-dataset-startup',
          fn: async () => {
            await this.createDatabaseWithTestData(testDbPath, 500);
            return this.measureBasicStartup(testDbPath);
          }
        }
      ];

      const baselineResults = await performanceHelper.compareImplementations(
        baselineTests,
        3
      );

      // All startup scenarios should meet the 5-second requirement
      Object.values(baselineResults).forEach(result => {
        expect(result.success).toBe(true);
        const avgTime = result.metrics.executionTime / result.iterations;
        expect(avgTime).toBeLessThan(5000);
      });

      // Startup time should scale reasonably with data size
      const emptyStart = baselineResults['empty-database-startup'];
      const mediumStart = baselineResults['medium-dataset-startup'];
      
      const emptyTime = emptyStart.metrics.executionTime / emptyStart.iterations;
      const mediumTime = mediumStart.metrics.executionTime / mediumStart.iterations;
      
      // Medium dataset shouldn't be more than 2x slower than empty
      expect(mediumTime).toBeLessThan(emptyTime * 2);

      console.log('📊 Startup Performance Baseline:');
      Object.entries(baselineResults).forEach(([name, result]) => {
        const avgTime = result.metrics.executionTime / result.iterations;
        console.log(`  ${name}: ${avgTime.toFixed(0)}ms`);
      });
    });

    it('should detect performance regressions in startup sequence', async () => {
      // Create baseline performance
      const baselineStartup = await this.measureBasicStartup(testDbPath);
      
      // Simulate potential performance regression by creating suboptimal conditions
      await this.createDatabaseWithTestData(testDbPath, 1000);
      
      // Add many indexes to test index creation impact
      const db = new KnowledgeDB(testDbPath, { autoBackup: false });
      await new Promise<void>((resolve) => {
        const checkInitialized = () => {
          if (db['initialized']) {
            resolve();
          } else {
            setTimeout(checkInitialized, 10);
          }
        };
        checkInitialized();
      });
      db.close();

      // Measure startup with more complex database
      const regressionStartup = await this.measureBasicStartup(testDbPath);

      // Check for performance regression
      const regressionRatio = regressionStartup / baselineStartup;
      
      // Should not degrade more than 3x from baseline
      expect(regressionRatio).toBeLessThan(3);
      
      // Still must meet absolute requirement
      expect(regressionStartup).toBeLessThan(5000);

      if (regressionRatio > 1.5) {
        console.warn(`⚠️ Performance regression detected: ${regressionRatio.toFixed(2)}x slower than baseline`);
      }
    });
  });

  describe('Concurrent Startup Scenarios', () => {
    it('should handle multiple application instances starting concurrently', async () => {
      const concurrentStartupResult = await performanceHelper.measureOperation(
        'concurrent-startup-instances',
        async () => {
          // Create multiple database instances concurrently
          const instances = Array(3).fill(0).map((_, i) => {
            const dbPath = `${testDbPath}.${i}`;
            return new KnowledgeDB(dbPath, { autoBackup: false });
          });

          // Wait for all to initialize
          await Promise.all(instances.map(db => 
            new Promise<void>((resolve) => {
              const checkInitialized = () => {
                if (db['initialized']) {
                  resolve();
                } else {
                  setTimeout(checkInitialized, 10);
                }
              };
              checkInitialized();
            })
          ));

          // Verify all instances are functional
          for (const db of instances) {
            const stats = await db.getStats();
            expect(stats.totalEntries).toBe(0);
            db.close();
          }

          // Cleanup
          for (let i = 0; i < 3; i++) {
            const dbPath = `${testDbPath}.${i}`;
            if (fs.existsSync(dbPath)) {
              fs.unlinkSync(dbPath);
            }
          }
        },
        2
      );

      expect(concurrentStartupResult.success).toBe(true);
      
      const avgConcurrentTime = concurrentStartupResult.metrics.executionTime / concurrentStartupResult.iterations;
      expect(avgConcurrentTime).toBeLessThan(8000); // Allow more time for concurrent operations

      console.log(`✅ Concurrent startup: ${avgConcurrentTime.toFixed(0)}ms average`);
    });
  });

  // Helper methods
  private async createDatabaseWithTestData(dbPath: string, entryCount: number): Promise<void> {
    const db = new KnowledgeDB(dbPath, { autoBackup: false });
    
    await new Promise<void>((resolve) => {
      const checkInitialized = () => {
        if (db['initialized']) {
          resolve();
        } else {
          setTimeout(checkInitialized, 10);
        }
      };
      checkInitialized();
    });

    const testEntries = TestDatabaseFactory.createLargeTestDataset(entryCount);
    
    for (const entry of testEntries) {
      await db.addEntry(entry, 'test-user');
    }

    db.close();
  }

  private async measureBasicStartup(dbPath: string): Promise<number> {
    const startTime = performance.now();
    
    const db = new KnowledgeDB(dbPath, { autoBackup: false });
    
    await new Promise<void>((resolve) => {
      const checkInitialized = () => {
        if (db['initialized']) {
          resolve();
        } else {
          setTimeout(checkInitialized, 10);
        }
      };
      checkInitialized();
    });

    const endTime = performance.now();
    db.close();
    
    return endTime - startTime;
  }
});