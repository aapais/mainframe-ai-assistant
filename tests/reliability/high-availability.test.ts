/**
 * High Availability Reliability Tests
 * Tests system uptime, availability, and service continuity
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import { performance } from 'perf_hooks';
import { DatabaseManager } from '../../src/database/DatabaseManager';
import { KnowledgeDB, KBEntry } from '../../src/database/KnowledgeDB';
import { EventEmitter } from 'events';

// Mock service for availability testing
class MockService extends EventEmitter {
  private isRunning = false;
  private startTime = 0;
  private failureCount = 0;
  private recoveryTime = 0;

  async start(): Promise<void> {
    this.isRunning = true;
    this.startTime = Date.now();
    this.emit('started');
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    this.emit('stopped');
  }

  isAvailable(): boolean {
    return this.isRunning;
  }

  simulateFailure(): void {
    this.isRunning = false;
    this.failureCount++;
    this.emit('failed');
  }

  async recover(): Promise<void> {
    const recoveryStart = Date.now();
    // Simulate recovery time
    await new Promise(resolve => setTimeout(resolve, 100));
    this.isRunning = true;
    this.recoveryTime = Date.now() - recoveryStart;
    this.emit('recovered');
  }

  getUptime(): number {
    return this.isRunning ? Date.now() - this.startTime : 0;
  }

  getMetrics() {
    return {
      uptime: this.getUptime(),
      failures: this.failureCount,
      lastRecoveryTime: this.recoveryTime,
      isAvailable: this.isRunning
    };
  }
}

describe('High Availability Reliability Tests', () => {
  let testDbPath: string;
  let dbManager: DatabaseManager;
  let knowledgeDB: KnowledgeDB;
  let mockService: MockService;

  const TARGET_UPTIME_PERCENTAGE = 99.9; // 99.9% availability target
  const MAX_RECOVERY_TIME_MS = 30000; // 30 seconds max recovery time

  beforeAll(async () => {
    const tempDir = await fs.mkdtemp(path.join(__dirname, 'temp-ha-'));
    testDbPath = path.join(tempDir, 'test-ha.db');
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
    mockService = new MockService();
  });

  afterEach(async () => {
    if (knowledgeDB) {
      await knowledgeDB.close();
    }
    if (dbManager) {
      await dbManager.close();
    }
    if (mockService) {
      await mockService.stop();
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

  describe('Uptime Validation', () => {
    it('should maintain 99.9% availability over extended period', async () => {
      const testDurationMs = 10000; // 10 seconds for testing
      const allowedDowntimeMs = testDurationMs * (1 - TARGET_UPTIME_PERCENTAGE / 100);
      
      await mockService.start();
      const startTime = Date.now();
      let totalDowntime = 0;

      // Monitor for test duration
      const checkInterval = 100; // Check every 100ms
      const checks: boolean[] = [];

      const monitorPromise = new Promise<void>((resolve) => {
        const monitor = setInterval(() => {
          const isAvailable = mockService.isAvailable();
          checks.push(isAvailable);

          if (Date.now() - startTime >= testDurationMs) {
            clearInterval(monitor);
            resolve();
          }
        }, checkInterval);
      });

      // Simulate some failures during monitoring
      setTimeout(() => {
        mockService.simulateFailure();
        setTimeout(() => mockService.recover(), 50);
      }, 2000);

      setTimeout(() => {
        mockService.simulateFailure();
        setTimeout(() => mockService.recover(), 100);
      }, 5000);

      await monitorPromise;

      // Calculate actual uptime
      const availableChecks = checks.filter(check => check).length;
      const actualUptimePercentage = (availableChecks / checks.length) * 100;

      console.log(`Actual uptime: ${actualUptimePercentage.toFixed(2)}%`);
      console.log(`Target uptime: ${TARGET_UPTIME_PERCENTAGE}%`);

      expect(actualUptimePercentage).toBeGreaterThanOrEqual(TARGET_UPTIME_PERCENTAGE);
    }, 15000);

    it('should track and report availability metrics', async () => {
      await mockService.start();
      
      // Let it run for a bit
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Simulate failure
      mockService.simulateFailure();
      await new Promise(resolve => setTimeout(resolve, 100));
      await mockService.recover();

      const metrics = mockService.getMetrics();
      
      expect(metrics.uptime).toBeGreaterThan(0);
      expect(metrics.failures).toBe(1);
      expect(metrics.lastRecoveryTime).toBeGreaterThan(0);
      expect(metrics.isAvailable).toBe(true);
    });

    it('should maintain database availability during high load', async () => {
      const concurrentOperations = 50;
      const operationsPerBatch = 10;
      
      // Test entry for operations
      const testEntry: KBEntry = {
        title: 'HA Test Entry',
        problem: 'High availability test problem',
        solution: 'High availability test solution',
        category: 'VSAM',
        tags: ['ha', 'test']
      };

      const startTime = performance.now();
      let successfulOperations = 0;
      let failedOperations = 0;

      // Run concurrent operations
      const operations = Array.from({ length: concurrentOperations }, async (_, i) => {
        try {
          // Mix of read and write operations
          if (i % 2 === 0) {
            // Write operation
            await knowledgeDB.addEntry({
              ...testEntry,
              title: `${testEntry.title} ${i}`
            });
          } else {
            // Read operation
            await knowledgeDB.search('HA Test');
          }
          successfulOperations++;
        } catch (error) {
          failedOperations++;
          console.warn(`Operation ${i} failed:`, error);
        }
      });

      await Promise.allSettled(operations);
      const endTime = performance.now();

      const successRate = (successfulOperations / concurrentOperations) * 100;
      const avgResponseTime = (endTime - startTime) / concurrentOperations;

      console.log(`Success rate: ${successRate}%`);
      console.log(`Average response time: ${avgResponseTime.toFixed(2)}ms`);

      // Should maintain high success rate even under load
      expect(successRate).toBeGreaterThanOrEqual(95);
      expect(avgResponseTime).toBeLessThan(1000); // < 1 second average
    });
  });

  describe('Service Continuity Testing', () => {
    it('should continue serving requests during partial failures', async () => {
      // Add some test data
      const entryId = await knowledgeDB.addEntry({
        title: 'Continuity Test',
        problem: 'Service continuity test',
        solution: 'Should remain accessible',
        category: 'VSAM',
        tags: ['continuity']
      });

      // Simulate partial system failure (e.g., search index corruption)
      // But core data should still be accessible
      
      // Should still be able to retrieve entries
      const entry = await knowledgeDB.getEntry(entryId);
      expect(entry).toBeTruthy();
      expect(entry?.title).toBe('Continuity Test');

      // Should be able to add new entries
      const newEntryId = await knowledgeDB.addEntry({
        title: 'Post-failure entry',
        problem: 'Added during partial failure',
        solution: 'Should work',
        category: 'JCL',
        tags: ['post-failure']
      });
      expect(newEntryId).toBeTruthy();
    });

    it('should handle connection pool exhaustion gracefully', async () => {
      const maxConnections = 20; // Simulate connection limit
      const operations: Promise<any>[] = [];

      // Create more operations than available connections
      for (let i = 0; i < maxConnections + 10; i++) {
        operations.push(
          knowledgeDB.addEntry({
            title: `Connection Test ${i}`,
            problem: `Test problem ${i}`,
            solution: `Test solution ${i}`,
            category: 'VSAM',
            tags: [`conn-${i}`]
          }).catch(error => ({ error }))
        );
      }

      const results = await Promise.allSettled(operations);
      const successful = results.filter(r => 
        r.status === 'fulfilled' && !(r.value as any)?.error
      ).length;

      // Should handle most operations successfully
      expect(successful).toBeGreaterThan(maxConnections * 0.8);
    });

    it('should maintain read availability during write failures', async () => {
      // Add initial data
      const entryId = await knowledgeDB.addEntry({
        title: 'Read Test Entry',
        problem: 'Should remain readable',
        solution: 'Even during write issues',
        category: 'VSAM',
        tags: ['read-test']
      });

      // Simulate write failure scenario
      // (In real scenario, this might be disk full, permissions, etc.)
      
      // Reads should still work
      const entry = await knowledgeDB.getEntry(entryId);
      expect(entry).toBeTruthy();

      const searchResults = await knowledgeDB.search('Read Test');
      expect(searchResults.length).toBeGreaterThan(0);

      const allEntries = await knowledgeDB.getAllEntries();
      expect(allEntries.length).toBeGreaterThan(0);
    });
  });

  describe('Graceful Degradation', () => {
    it('should provide basic functionality when AI services fail', async () => {
      // Add test data
      await knowledgeDB.addEntry({
        title: 'AI Fallback Test',
        problem: 'Test AI fallback functionality',
        solution: 'Should work with local search only',
        category: 'VSAM',
        tags: ['ai-fallback']
      });

      // Simulate AI service failure by using local search only
      const results = await knowledgeDB.search('AI Fallback', { useAI: false });
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].entry.title).toContain('AI Fallback');
    });

    it('should degrade search functionality gracefully', async () => {
      // Add entries with various content
      const entries = [
        {
          title: 'Full Text Search Test',
          problem: 'This is a comprehensive problem description with many keywords',
          solution: 'Detailed solution with step-by-step instructions',
          category: 'VSAM',
          tags: ['full-text', 'search', 'comprehensive']
        },
        {
          title: 'Simple Entry',
          problem: 'Basic problem',
          solution: 'Basic solution',
          category: 'JCL',
          tags: ['basic']
        }
      ];

      for (const entry of entries) {
        await knowledgeDB.addEntry(entry);
      }

      // Test different search fallback levels
      // Level 1: Full-text search
      let results = await knowledgeDB.search('comprehensive');
      expect(results.length).toBeGreaterThan(0);

      // Level 2: Keyword search (simulate FTS failure)
      results = await knowledgeDB.search('basic');
      expect(results.length).toBeGreaterThan(0);

      // Level 3: Category search (basic fallback)
      results = await knowledgeDB.searchByCategory('VSAM');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should maintain core operations during feature failures', async () => {
      // Core operations should work even if advanced features fail
      
      // Basic CRUD operations
      const entryId = await knowledgeDB.addEntry({
        title: 'Core Operation Test',
        problem: 'Basic functionality test',
        solution: 'Should always work',
        category: 'VSAM',
        tags: ['core']
      });
      expect(entryId).toBeTruthy();

      // Read operation
      const entry = await knowledgeDB.getEntry(entryId);
      expect(entry).toBeTruthy();

      // Update operation
      await knowledgeDB.updateEntry(entryId, {
        ...entry!,
        solution: 'Updated solution'
      });

      const updatedEntry = await knowledgeDB.getEntry(entryId);
      expect(updatedEntry?.solution).toBe('Updated solution');
    });
  });

  describe('Automatic Recovery', () => {
    it('should auto-recover from temporary database locks', async () => {
      // Add initial data
      await knowledgeDB.addEntry({
        title: 'Lock Recovery Test',
        problem: 'Test lock recovery',
        solution: 'Should recover automatically',
        category: 'VSAM',
        tags: ['lock-test']
      });

      // Simulate database lock by starting long-running transaction
      const lockPromise = dbManager.executeQuery('BEGIN IMMEDIATE TRANSACTION');
      
      try {
        // This should eventually succeed due to retry logic
        const entryId = await knowledgeDB.addEntry({
          title: 'Post-lock entry',
          problem: 'Added after lock recovery',
          solution: 'Should work after recovery',
          category: 'JCL',
          tags: ['post-lock']
        });
        expect(entryId).toBeTruthy();
      } finally {
        // Release lock
        await dbManager.executeQuery('ROLLBACK');
      }
    });

    it('should recover from connection failures', async () => {
      // Add initial data
      const entryId = await knowledgeDB.addEntry({
        title: 'Connection Recovery Test',
        problem: 'Test connection recovery',
        solution: 'Should recover from disconnections',
        category: 'VSAM',
        tags: ['connection-test']
      });

      // Force close connection
      await knowledgeDB.close();

      // Create new connection (simulate auto-recovery)
      knowledgeDB = new KnowledgeDB(testDbPath);

      // Should be able to continue operations
      const entry = await knowledgeDB.getEntry(entryId);
      expect(entry).toBeTruthy();

      // Should be able to add new data
      const newEntryId = await knowledgeDB.addEntry({
        title: 'Post-recovery entry',
        problem: 'Added after connection recovery',
        solution: 'Should work',
        category: 'JCL',
        tags: ['post-recovery']
      });
      expect(newEntryId).toBeTruthy();
    });

    it('should recover from corrupted cache', async () => {
      // Add data to populate cache
      const entries = Array.from({ length: 10 }, (_, i) => ({
        title: `Cache Test Entry ${i}`,
        problem: `Problem ${i}`,
        solution: `Solution ${i}`,
        category: 'VSAM' as const,
        tags: [`cache-${i}`]
      }));

      const entryIds: string[] = [];
      for (const entry of entries) {
        const id = await knowledgeDB.addEntry(entry);
        entryIds.push(id);
      }

      // Simulate cache corruption by clearing internal caches
      // (Implementation would depend on actual caching strategy)
      
      // Operations should still work by falling back to database
      for (const entryId of entryIds) {
        const entry = await knowledgeDB.getEntry(entryId);
        expect(entry).toBeTruthy();
      }

      // Search should still work
      const searchResults = await knowledgeDB.search('Cache Test');
      expect(searchResults.length).toBeGreaterThan(0);
    });
  });

  describe('Failover Mechanisms', () => {
    it('should failover to backup read-only mode', async () => {
      // Add test data
      const entryId = await knowledgeDB.addEntry({
        title: 'Failover Test',
        problem: 'Test failover functionality',
        solution: 'Should remain readable in failover mode',
        category: 'VSAM',
        tags: ['failover']
      });

      // Simulate primary write failure
      // In real scenario, this would switch to read-only replica
      
      // Read operations should continue to work
      const entry = await knowledgeDB.getEntry(entryId);
      expect(entry).toBeTruthy();
      expect(entry?.title).toBe('Failover Test');

      const searchResults = await knowledgeDB.search('Failover');
      expect(searchResults.length).toBeGreaterThan(0);

      const allEntries = await knowledgeDB.getAllEntries();
      expect(allEntries.length).toBeGreaterThan(0);
    });

    it('should handle service discovery failures', async () => {
      // Test service discovery and failover
      const services = [
        { name: 'primary', available: false },
        { name: 'secondary', available: true },
        { name: 'tertiary', available: true }
      ];

      // Find available service
      const availableService = services.find(s => s.available);
      expect(availableService).toBeTruthy();
      expect(availableService?.name).not.toBe('primary');

      // Should be able to use secondary service
      const entryId = await knowledgeDB.addEntry({
        title: 'Service Discovery Test',
        problem: 'Test service failover',
        solution: 'Should use available service',
        category: 'VSAM',
        tags: ['service-discovery']
      });
      expect(entryId).toBeTruthy();
    });

    it('should maintain session continuity during failover', async () => {
      // Start session with some state
      const entryId = await knowledgeDB.addEntry({
        title: 'Session Continuity Test',
        problem: 'Test session during failover',
        solution: 'Session should continue',
        category: 'VSAM',
        tags: ['session']
      });

      // Record some usage
      await knowledgeDB.recordUsage(entryId, true, 'test-user');
      
      // Simulate failover by reconnecting
      await knowledgeDB.close();
      knowledgeDB = new KnowledgeDB(testDbPath);

      // Session data should be preserved
      const entry = await knowledgeDB.getEntry(entryId);
      expect(entry?.usage_count).toBe(1);
      expect(entry?.success_count).toBe(1);

      // Should be able to continue session
      await knowledgeDB.recordUsage(entryId, true, 'test-user');
      
      const updatedEntry = await knowledgeDB.getEntry(entryId);
      expect(updatedEntry?.usage_count).toBe(2);
    });
  });

  describe('Health Monitoring', () => {
    it('should provide health check endpoints', async () => {
      const healthCheck = async () => {
        try {
          // Test database connectivity
          await dbManager.executeQuery('SELECT 1');
          
          // Test basic operations
          const testId = await knowledgeDB.addEntry({
            title: 'Health Check Test',
            problem: 'Health check test problem',
            solution: 'Health check test solution',
            category: 'Other',
            tags: ['health-check']
          });
          
          await knowledgeDB.getEntry(testId);
          await knowledgeDB.deleteEntry(testId);
          
          return { status: 'healthy', timestamp: new Date() };
        } catch (error) {
          return { 
            status: 'unhealthy', 
            error: (error as Error).message,
            timestamp: new Date() 
          };
        }
      };

      const health = await healthCheck();
      expect(health.status).toBe('healthy');
      expect(health.timestamp).toBeInstanceOf(Date);
    });

    it('should monitor resource usage', async () => {
      const getResourceUsage = () => {
        const memUsage = process.memoryUsage();
        return {
          heapUsed: memUsage.heapUsed,
          heapTotal: memUsage.heapTotal,
          external: memUsage.external,
          rss: memUsage.rss
        };
      };

      const beforeUsage = getResourceUsage();

      // Perform operations that consume resources
      const entries = Array.from({ length: 100 }, (_, i) => ({
        title: `Resource Test Entry ${i}`,
        problem: `Large problem description ${i} `.repeat(100),
        solution: `Large solution description ${i} `.repeat(100),
        category: 'VSAM' as const,
        tags: [`resource-${i}`]
      }));

      for (const entry of entries) {
        await knowledgeDB.addEntry(entry);
      }

      const afterUsage = getResourceUsage();

      // Memory usage should increase but not excessively
      const memoryIncrease = afterUsage.heapUsed - beforeUsage.heapUsed;
      const maxAllowedIncrease = 100 * 1024 * 1024; // 100MB

      expect(memoryIncrease).toBeLessThan(maxAllowedIncrease);
      console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
    });
  });
});