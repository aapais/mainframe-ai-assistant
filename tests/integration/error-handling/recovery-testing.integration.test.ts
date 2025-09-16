import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, jest } from '@jest/globals';
import { promises as fs } from 'fs';
import path from 'path';
import { EventEmitter } from 'events';

// Core imports
import { AppError, ErrorCode, ErrorSeverity } from '../../../src/core/errors/AppError';
import { ServiceFactory } from '../../../src/services/ServiceFactory';
import { KnowledgeBaseService } from '../../../src/services/KnowledgeBaseService';
import { CacheService } from '../../../src/services/CacheService';
import { MetricsService } from '../../../src/services/MetricsService';
import { BackupManager } from '../../../src/database/BackupManager';

// Test utilities
import { createTestDB, cleanupTestDB, waitFor, simulateFailure, RecoveryMonitor } from '../test-utils/error-injection-utils';

interface RecoveryScenario {
  name: string;
  failureType: 'service' | 'database' | 'network' | 'resource';
  severity: 'partial' | 'complete';
  setupFailure: () => Promise<void>;
  triggerRecovery: () => Promise<void>;
  validateRecovery: () => Promise<boolean>;
  expectedRecoveryTime: number;
  maxAttempts: number;
}

interface RecoveryMetrics {
  scenario: string;
  startTime: Date;
  endTime?: Date;
  attempts: number;
  successful: boolean;
  recoveryTime?: number;
  errorsDuringRecovery: Error[];
  finalState: 'recovered' | 'partially_recovered' | 'failed';
}

class RecoveryTester extends EventEmitter {
  private serviceFactory: ServiceFactory;
  private recoveryMetrics: RecoveryMetrics[] = [];
  private monitor: RecoveryMonitor;

  constructor(serviceFactory: ServiceFactory) {
    super();
    this.serviceFactory = serviceFactory;
    this.monitor = new RecoveryMonitor();
  }

  async testRecoveryScenario(scenario: RecoveryScenario): Promise<RecoveryMetrics> {
    const metrics: RecoveryMetrics = {
      scenario: scenario.name,
      startTime: new Date(),
      attempts: 0,
      successful: false,
      errorsDuringRecovery: [],
      finalState: 'failed'
    };

    this.emit('scenarioStart', scenario.name);

    try {
      // Setup initial failure
      await scenario.setupFailure();
      
      let recovered = false;
      while (!recovered && metrics.attempts < scenario.maxAttempts) {
        metrics.attempts++;
        
        try {
          await scenario.triggerRecovery();
          recovered = await scenario.validateRecovery();
          
          if (recovered) {
            metrics.successful = true;
            metrics.finalState = 'recovered';
            this.emit('recoverySuccess', scenario.name, metrics.attempts);
          } else {
            // Partial recovery or need more attempts
            await waitFor(Math.min(1000 * metrics.attempts, 5000)); // Exponential backoff
          }
        } catch (error) {
          metrics.errorsDuringRecovery.push(error as Error);
          this.emit('recoveryAttemptFailed', scenario.name, metrics.attempts, error);
          
          // Wait before next attempt
          await waitFor(Math.min(1000 * metrics.attempts, 5000));
        }
      }

      // Final validation
      if (!recovered) {
        const partialRecovery = await this.checkPartialRecovery(scenario);
        if (partialRecovery) {
          metrics.finalState = 'partially_recovered';
        }
      }

    } catch (error) {
      metrics.errorsDuringRecovery.push(error as Error);
      this.emit('scenarioFailed', scenario.name, error);
    } finally {
      metrics.endTime = new Date();
      metrics.recoveryTime = metrics.endTime.getTime() - metrics.startTime.getTime();
      this.recoveryMetrics.push(metrics);
      this.emit('scenarioComplete', scenario.name, metrics);
    }

    return metrics;
  }

  private async checkPartialRecovery(scenario: RecoveryScenario): Promise<boolean> {
    try {
      // Check if core services are at least partially functional
      const health = await this.serviceFactory.healthCheck();
      return Object.values(health.services).some(service => service.healthy);
    } catch (error) {
      return false;
    }
  }

  getRecoveryMetrics(): RecoveryMetrics[] {
    return [...this.recoveryMetrics];
  }

  getSuccessRate(): number {
    if (this.recoveryMetrics.length === 0) return 0;
    const successful = this.recoveryMetrics.filter(m => m.successful).length;
    return successful / this.recoveryMetrics.length;
  }

  getAverageRecoveryTime(): number {
    const successfulMetrics = this.recoveryMetrics.filter(m => m.successful && m.recoveryTime);
    if (successfulMetrics.length === 0) return 0;
    
    const total = successfulMetrics.reduce((sum, m) => sum + (m.recoveryTime || 0), 0);
    return total / successfulMetrics.length;
  }
}

describe('Recovery Testing Integration Tests', () => {
  let serviceFactory: ServiceFactory;
  let kbService: KnowledgeBaseService;
  let cacheService: CacheService;
  let metricsService: MetricsService;
  let backupManager: BackupManager;
  let recoveryTester: RecoveryTester;
  let testDbPath: string;
  let backupPath: string;

  beforeAll(async () => {
    testDbPath = await createTestDB();
    backupPath = path.join(path.dirname(testDbPath), 'backups');
    
    await fs.mkdir(backupPath, { recursive: true });

    serviceFactory = new ServiceFactory({
      database: {
        path: testDbPath,
        pragmas: {
          journal_mode: 'WAL',
          synchronous: 'NORMAL',
          cache_size: -2000,
          foreign_keys: 'ON'
        },
        backup: { enabled: true, interval: 60000, retention: 3, path: backupPath },
        performance: { connectionPool: 3, busyTimeout: 2000, cacheSize: 2000 }
      },
      validation: {
        strict: true,
        sanitize: true,
        maxLength: { title: 200, problem: 2000, solution: 2000, tags: 50 },
        minLength: { title: 5, problem: 10, solution: 10 },
        patterns: {
          tag: /^[a-zA-Z0-9-_]+$/,
          category: ['JCL', 'VSAM', 'DB2', 'Batch', 'Functional', 'Other']
        }
      },
      cache: { maxSize: 50, ttl: 5000, checkPeriod: 1000, strategy: 'lru', persistent: false },
      metrics: { 
        enabled: true, 
        retention: 60000,
        aggregation: { enabled: true, interval: 5000, batch: 50 },
        alerts: { enabled: true, thresholds: { errorRate: 0.2, responseTime: 2000 } }
      },
      logging: {
        level: 'info',
        file: { enabled: false, path: '', maxSize: 0, maxFiles: 0 },
        console: true,
        structured: true
      }
    });

    await serviceFactory.initialize();
    
    kbService = serviceFactory.getKnowledgeBaseService();
    cacheService = serviceFactory.getCacheService();
    metricsService = serviceFactory.getMetricsService();
    
    backupManager = new BackupManager(testDbPath, {
      backupDir: backupPath,
      retentionDays: 7,
      compressionLevel: 6
    });

    recoveryTester = new RecoveryTester(serviceFactory);

    // Setup event listeners for monitoring
    recoveryTester.on('scenarioStart', (scenario) => {
      console.log(`🔄 Starting recovery scenario: ${scenario}`);
    });

    recoveryTester.on('recoverySuccess', (scenario, attempts) => {
      console.log(`✅ Recovery successful for ${scenario} after ${attempts} attempts`);
    });

    recoveryTester.on('recoveryAttemptFailed', (scenario, attempt, error) => {
      console.log(`❌ Recovery attempt ${attempt} failed for ${scenario}: ${error.message}`);
    });

    recoveryTester.on('scenarioComplete', (scenario, metrics) => {
      console.log(`📊 Scenario ${scenario} completed: ${metrics.finalState} in ${metrics.recoveryTime}ms`);
    });
  });

  afterAll(async () => {
    if (serviceFactory) {
      await serviceFactory.shutdown();
    }
    
    await cleanupTestDB(testDbPath);
    
    try {
      await fs.rmdir(backupPath, { recursive: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  beforeEach(async () => {
    // Ensure clean state
    try {
      const entries = await kbService.search('recovery-test-', { limit: 1000 });
      for (const result of entries.results) {
        await kbService.delete(result.entry.id!);
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Service Recovery Scenarios', () => {
    const serviceRecoveryScenarios: RecoveryScenario[] = [
      {
        name: 'Knowledge Base Service Crash Recovery',
        failureType: 'service',
        severity: 'complete',
        setupFailure: async () => {
          // Simulate service crash by forcing shutdown
          await serviceFactory.shutdown();
        },
        triggerRecovery: async () => {
          // Reinitialize services
          await serviceFactory.initialize();
          kbService = serviceFactory.getKnowledgeBaseService();
        },
        validateRecovery: async () => {
          try {
            const entry = await kbService.create({
              title: 'recovery-test-service-crash',
              problem: 'Test after service crash',
              solution: 'Should work after recovery',
              category: 'Other',
              tags: ['recovery-test']
            });
            return entry.id !== undefined;
          } catch (error) {
            return false;
          }
        },
        expectedRecoveryTime: 5000,
        maxAttempts: 3
      },
      {
        name: 'Cache Service Recovery',
        failureType: 'service',
        severity: 'partial',
        setupFailure: async () => {
          // Corrupt cache by filling with invalid data
          for (let i = 0; i < 100; i++) {
            try {
              await cacheService.set(`corrupt-${i}`, null as any);
            } catch (error) {
              // Expected to fail
            }
          }
        },
        triggerRecovery: async () => {
          // Clear cache and reinitialize
          await cacheService.clear();
        },
        validateRecovery: async () => {
          try {
            await cacheService.set('test-key', 'test-value');
            const value = await cacheService.get('test-key');
            return value === 'test-value';
          } catch (error) {
            return false;
          }
        },
        expectedRecoveryTime: 1000,
        maxAttempts: 2
      },
      {
        name: 'Metrics Service Recovery',
        failureType: 'service',
        severity: 'partial',
        setupFailure: async () => {
          // Overload metrics service
          const promises = Array(1000).fill(0).map(async (_, i) => {
            try {
              await metricsService.recordUsage(`fake-id-${i}`, 'view', 'test-user');
            } catch (error) {
              // Expected to fail for non-existent IDs
            }
          });
          await Promise.allSettled(promises);
        },
        triggerRecovery: async () => {
          // Wait for metrics to settle and clear buffers
          await waitFor(2000);
        },
        validateRecovery: async () => {
          try {
            const metrics = await metricsService.getSystemMetrics();
            return metrics !== null;
          } catch (error) {
            return false;
          }
        },
        expectedRecoveryTime: 3000,
        maxAttempts: 2
      }
    ];

    serviceRecoveryScenarios.forEach(scenario => {
      it(`should recover from ${scenario.name}`, async () => {
        const metrics = await recoveryTester.testRecoveryScenario(scenario);
        
        expect(metrics.successful).toBe(true);
        expect(metrics.finalState).toBe('recovered');
        expect(metrics.recoveryTime).toBeLessThan(scenario.expectedRecoveryTime * 2);
        expect(metrics.attempts).toBeLessThanOrEqual(scenario.maxAttempts);
      }, 30000);
    });
  });

  describe('Database Recovery Scenarios', () => {
    it('should recover from database corruption using backup', async () => {
      // Create test data
      const testEntries = Array(5).fill(0).map((_, i) => ({
        title: `recovery-test-backup-${i}`,
        problem: `Test problem ${i} for backup recovery`,
        solution: `Test solution ${i} for backup recovery`,
        category: 'Other' as const,
        tags: [`backup-${i}`, 'recovery-test']
      }));

      for (const entry of testEntries) {
        await kbService.create(entry);
      }

      // Create backup
      const backupFilePath = await backupManager.createBackup();
      expect(await fs.access(backupFilePath).then(() => true).catch(() => false)).toBe(true);

      // Simulate database corruption
      await serviceFactory.shutdown();
      await simulateFailure(testDbPath, 'corruption');

      // Test recovery scenario
      const recoveryScenario: RecoveryScenario = {
        name: 'Database Corruption Recovery',
        failureType: 'database',
        severity: 'complete',
        setupFailure: async () => {
          // Already corrupted above
        },
        triggerRecovery: async () => {
          // Restore from backup
          await backupManager.restoreBackup(backupFilePath);
          await serviceFactory.initialize();
          kbService = serviceFactory.getKnowledgeBaseService();
        },
        validateRecovery: async () => {
          try {
            const count = await kbService.getEntryCount();
            return count >= testEntries.length;
          } catch (error) {
            return false;
          }
        },
        expectedRecoveryTime: 10000,
        maxAttempts: 2
      };

      const metrics = await recoveryTester.testRecoveryScenario(recoveryScenario);
      
      expect(metrics.successful).toBe(true);
      expect(metrics.finalState).toBe('recovered');

      // Verify data integrity after recovery
      const searchResults = await kbService.search('backup-');
      expect(searchResults.results.length).toBeGreaterThanOrEqual(testEntries.length);
    }, 45000);

    it('should handle transaction recovery after system crash', async () => {
      const initialCount = await kbService.getEntryCount();

      const recoveryScenario: RecoveryScenario = {
        name: 'Transaction Recovery After Crash',
        failureType: 'database',
        severity: 'partial',
        setupFailure: async () => {
          // Start transactions that will be interrupted
          const promises = Array(5).fill(0).map(async (_, i) => {
            try {
              return await kbService.create({
                title: `recovery-test-transaction-${i}`,
                problem: `Transaction test ${i}`,
                solution: `Transaction solution ${i}`,
                category: 'Other',
                tags: [`transaction-${i}`]
              });
            } catch (error) {
              return null;
            }
          });

          // Let some transactions start, then force shutdown
          await waitFor(100);
          await serviceFactory.shutdown();
          
          // Wait for any in-flight transactions to timeout
          await waitFor(1000);
        },
        triggerRecovery: async () => {
          await serviceFactory.initialize();
          kbService = serviceFactory.getKnowledgeBaseService();
        },
        validateRecovery: async () => {
          try {
            // Check database is consistent
            const currentCount = await kbService.getEntryCount();
            
            // Should be able to add new entries
            const testEntry = await kbService.create({
              title: 'recovery-test-post-transaction',
              problem: 'Test after transaction recovery',
              solution: 'Should work',
              category: 'Other',
              tags: ['post-transaction']
            });
            
            return testEntry.id !== undefined;
          } catch (error) {
            return false;
          }
        },
        expectedRecoveryTime: 5000,
        maxAttempts: 3
      };

      const metrics = await recoveryTester.testRecoveryScenario(recoveryScenario);
      
      expect(metrics.successful).toBe(true);
      expect(metrics.finalState).toBe('recovered');
    }, 30000);
  });

  describe('Network Recovery Scenarios', () => {
    it('should recover from network partition', async () => {
      const recoveryScenario: RecoveryScenario = {
        name: 'Network Partition Recovery',
        failureType: 'network',
        severity: 'partial',
        setupFailure: async () => {
          // Simulate network issues by breaking external connections
          // This affects AI services but not local database operations
          await simulateFailure('network', 'partition');
        },
        triggerRecovery: async () => {
          // Wait for network recovery simulation
          await waitFor(2000);
        },
        validateRecovery: async () => {
          try {
            // Test local operations work (should be unaffected)
            const entry = await kbService.create({
              title: 'recovery-test-network',
              problem: 'Test during network issues',
              solution: 'Should work locally',
              category: 'Other',
              tags: ['network-test']
            });

            // Test search works with fallback
            const results = await kbService.search('network-test');
            return entry.id !== undefined && results.results.length > 0;
          } catch (error) {
            return false;
          }
        },
        expectedRecoveryTime: 3000,
        maxAttempts: 2
      };

      const metrics = await recoveryTester.testRecoveryScenario(recoveryScenario);
      
      expect(metrics.successful).toBe(true);
      expect(metrics.finalState).toBe('recovered');
    }, 20000);
  });

  describe('Resource Recovery Scenarios', () => {
    it('should recover from memory exhaustion', async () => {
      const recoveryScenario: RecoveryScenario = {
        name: 'Memory Exhaustion Recovery',
        failureType: 'resource',
        severity: 'partial',
        setupFailure: async () => {
          // Create memory pressure
          const largeData = Array(100).fill(0).map((_, i) => ({
            key: `memory-test-${i}`,
            value: 'x'.repeat(10000) // 10KB per entry
          }));

          for (const item of largeData) {
            try {
              await cacheService.set(item.key, item.value);
            } catch (error) {
              // Expected to fail under memory pressure
            }
          }
        },
        triggerRecovery: async () => {
          // Clear cache to relieve memory pressure
          await cacheService.clear();
          
          // Force garbage collection if available
          if (global.gc) {
            global.gc();
          }
          
          await waitFor(1000);
        },
        validateRecovery: async () => {
          try {
            // Test normal operations work
            const entry = await kbService.create({
              title: 'recovery-test-memory',
              problem: 'Test after memory recovery',
              solution: 'Should work normally',
              category: 'Other',
              tags: ['memory-recovery']
            });

            // Test cache works normally
            await cacheService.set('test-key', 'test-value');
            const value = await cacheService.get('test-key');
            
            return entry.id !== undefined && value === 'test-value';
          } catch (error) {
            return false;
          }
        },
        expectedRecoveryTime: 2000,
        maxAttempts: 2
      };

      const metrics = await recoveryTester.testRecoveryScenario(recoveryScenario);
      
      expect(metrics.successful).toBe(true);
      expect(metrics.finalState).toBe('recovered');
    }, 25000);
  });

  describe('Recovery Performance Analysis', () => {
    it('should provide comprehensive recovery analytics', async () => {
      const allMetrics = recoveryTester.getRecoveryMetrics();
      
      expect(allMetrics.length).toBeGreaterThan(0);
      
      const successRate = recoveryTester.getSuccessRate();
      const avgRecoveryTime = recoveryTester.getAverageRecoveryTime();
      
      console.log('📈 Recovery Performance Summary:');
      console.log(`  Success Rate: ${(successRate * 100).toFixed(1)}%`);
      console.log(`  Average Recovery Time: ${avgRecoveryTime.toFixed(0)}ms`);
      console.log(`  Total Scenarios Tested: ${allMetrics.length}`);
      
      // Recovery success rate should be high
      expect(successRate).toBeGreaterThan(0.8); // At least 80% success rate
      
      // Average recovery time should be reasonable
      expect(avgRecoveryTime).toBeLessThan(15000); // Under 15 seconds average
      
      // Categorize recovery performance
      const performanceCategories = allMetrics.reduce((acc, metric) => {
        const time = metric.recoveryTime || 0;
        if (time < 1000) acc.fast++;
        else if (time < 5000) acc.medium++;
        else acc.slow++;
        return acc;
      }, { fast: 0, medium: 0, slow: 0 });
      
      console.log('  Recovery Speed Distribution:');
      console.log(`    Fast (<1s): ${performanceCategories.fast}`);
      console.log(`    Medium (1-5s): ${performanceCategories.medium}`);
      console.log(`    Slow (>5s): ${performanceCategories.slow}`);
      
      // Most recoveries should be reasonably fast
      expect(performanceCategories.fast + performanceCategories.medium)
        .toBeGreaterThan(performanceCategories.slow);
    });

    it('should validate system resilience after multiple recovery cycles', async () => {
      // Run multiple recovery cycles to test system stability
      const cycleResults = [];
      
      for (let cycle = 0; cycle < 3; cycle++) {
        console.log(`🔄 Running resilience cycle ${cycle + 1}/3`);
        
        try {
          // Create test data
          const entry = await kbService.create({
            title: `resilience-test-cycle-${cycle}`,
            problem: `Resilience test cycle ${cycle}`,
            solution: `Test solution for cycle ${cycle}`,
            category: 'Other',
            tags: [`cycle-${cycle}`, 'resilience-test']
          });

          // Simulate failure and recovery
          await serviceFactory.shutdown();
          await waitFor(1000);
          await serviceFactory.initialize();
          kbService = serviceFactory.getKnowledgeBaseService();

          // Verify system is functional
          const retrieved = await kbService.getById(entry.id!);
          const searchResults = await kbService.search(`cycle-${cycle}`);

          cycleResults.push({
            cycle,
            dataIntact: retrieved !== null,
            searchWorking: searchResults.results.length > 0,
            success: retrieved !== null && searchResults.results.length > 0
          });

        } catch (error) {
          cycleResults.push({
            cycle,
            dataIntact: false,
            searchWorking: false,
            success: false,
            error: error.message
          });
        }
      }

      console.log('🎯 Resilience Test Results:', cycleResults);

      // All cycles should succeed
      const successfulCycles = cycleResults.filter(r => r.success).length;
      expect(successfulCycles).toBe(cycleResults.length);

      // Final health check
      const finalHealth = await serviceFactory.healthCheck();
      expect(finalHealth.overall).toMatch(/healthy|degraded/);

      console.log('✅ System maintained resilience through multiple recovery cycles');
    }, 60000);
  });
});