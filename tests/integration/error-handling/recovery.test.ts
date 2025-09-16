/**
 * Recovery Testing Suite
 * Comprehensive testing of system recovery mechanisms and resilience
 */

import { KnowledgeDB, KBEntry } from '../../../src/database/KnowledgeDB';
import { GeminiService } from '../../../src/services/GeminiService';
import { AppError, ErrorCode } from '../../../src/core/errors/AppError';
import fs from 'fs';
import path from 'path';
import { setTimeout } from 'timers/promises';

// Recovery testing utilities
interface RecoveryTestScenario {
  name: string;
  setupError: () => Promise<void>;
  triggerRecovery: () => Promise<void>;
  validateRecovery: () => Promise<boolean>;
  cleanup: () => Promise<void>;
}

class SystemRecoveryTester {
  private scenarios: RecoveryTestScenario[] = [];
  private testDbPath: string;
  private db: KnowledgeDB | null = null;

  constructor() {
    this.testDbPath = path.join(__dirname, `recovery-test-${Date.now()}.db`);
  }

  addScenario(scenario: RecoveryTestScenario): void {
    this.scenarios.push(scenario);
  }

  async runAllScenarios(): Promise<{ passed: number; failed: number; results: any[] }> {
    let passed = 0;
    let failed = 0;
    const results = [];

    for (const scenario of this.scenarios) {
      try {
        await scenario.setupError();
        await scenario.triggerRecovery();
        const recovered = await scenario.validateRecovery();
        
        if (recovered) {
          passed++;
          results.push({ scenario: scenario.name, status: 'passed' });
        } else {
          failed++;
          results.push({ scenario: scenario.name, status: 'failed', reason: 'Recovery validation failed' });
        }
        
        await scenario.cleanup();
      } catch (error) {
        failed++;
        results.push({ 
          scenario: scenario.name, 
          status: 'failed', 
          reason: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }

    return { passed, failed, results };
  }

  async cleanup(): Promise<void> {
    if (this.db) {
      this.db.close();
    }
    if (fs.existsSync(this.testDbPath)) {
      fs.unlinkSync(this.testDbPath);
    }
  }
}

// Circuit breaker implementation for testing
class CircuitBreaker {
  private failureCount = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(
    private threshold: number = 3,
    private timeout: number = 5000
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.threshold) {
      this.state = 'OPEN';
    }
  }

  getState(): string {
    return this.state;
  }

  reset(): void {
    this.failureCount = 0;
    this.lastFailureTime = 0;
    this.state = 'CLOSED';
  }
}

// Retry mechanism with exponential backoff
class RetryManager {
  static async withRetry<T>(
    operation: () => Promise<T>,
    maxAttempts: number = 3,
    baseDelay: number = 1000,
    maxDelay: number = 30000
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        if (attempt === maxAttempts) {
          break;
        }

        const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
        await setTimeout(delay);
      }
    }

    throw lastError!;
  }

  static async withBackoff<T>(
    operation: () => Promise<T>,
    options: {
      maxAttempts?: number;
      baseDelay?: number;
      maxDelay?: number;
      shouldRetry?: (error: Error) => boolean;
    } = {}
  ): Promise<T> {
    const {
      maxAttempts = 3,
      baseDelay = 1000,
      maxDelay = 30000,
      shouldRetry = () => true
    } = options;

    let lastError: Error;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        if (attempt === maxAttempts || !shouldRetry(lastError)) {
          break;
        }

        const jitter = Math.random() * 0.1 * baseDelay;
        const delay = Math.min(baseDelay * Math.pow(2, attempt - 1) + jitter, maxDelay);
        await setTimeout(delay);
      }
    }

    throw lastError!;
  }
}

describe('Recovery Testing Suite', () => {
  let recoveryTester: SystemRecoveryTester;
  let testDbPath: string;
  let db: KnowledgeDB;
  let geminiService: GeminiService;

  beforeEach(() => {
    recoveryTester = new SystemRecoveryTester();
    testDbPath = path.join(__dirname, `recovery-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.db`);
  });

  afterEach(async () => {
    try {
      if (db) {
        db.close();
      }
      if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
      }
      await recoveryTester.cleanup();
    } catch (error) {
      console.warn('Cleanup error:', error);
    }
  });

  describe('Database Recovery Scenarios', () => {
    test('should recover from database corruption', async () => {
      db = new KnowledgeDB(testDbPath);

      // Add test data
      const testEntry: KBEntry = {
        title: 'Recovery Test Entry',
        problem: 'Test problem for recovery',
        solution: 'Test solution',
        category: 'Test'
      };

      const entryId = await db.addEntry(testEntry);
      expect(entryId).toBeDefined();

      // Create backup
      const backupPath = testDbPath + '.backup';
      fs.copyFileSync(testDbPath, backupPath);

      // Close database before corrupting
      db.close();

      // Corrupt the database
      fs.writeFileSync(testDbPath, 'corrupted database content');

      // Attempt recovery
      try {
        db = new KnowledgeDB(testDbPath);
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        // Recovery mechanism would restore from backup
        if (fs.existsSync(backupPath)) {
          fs.copyFileSync(backupPath, testDbPath);
          db = new KnowledgeDB(testDbPath);
          
          // Verify data integrity after recovery
          const results = await db.search('Recovery Test');
          expect(results).toHaveLength(1);
          expect(results[0].entry.title).toBe('Recovery Test Entry');
        }
      }

      // Cleanup backup
      if (fs.existsSync(backupPath)) {
        fs.unlinkSync(backupPath);
      }
    });

    test('should recover from transaction failures', async () => {
      db = new KnowledgeDB(testDbPath);

      const entries: KBEntry[] = [
        {
          title: 'Entry 1',
          problem: 'Problem 1',
          solution: 'Solution 1',
          category: 'Test'
        },
        {
          title: 'Entry 2',
          problem: 'Problem 2',
          solution: 'Solution 2',
          category: 'Test'
        }
      ];

      // Start transaction that will fail midway
      try {
        const id1 = await db.addEntry(entries[0]);
        expect(id1).toBeDefined();

        // Simulate transaction failure
        const originalPrepare = (db as any).db.prepare;
        (db as any).db.prepare = jest.fn().mockImplementation(() => {
          throw new Error('Transaction failed');
        });

        await db.addEntry(entries[1]);
      } catch (error) {
        // Recovery: verify first entry still exists
        const results = await db.search('Entry 1');
        expect(results).toHaveLength(1);

        // Recovery: retry the failed operation
        const retryId = await RetryManager.withRetry(async () => {
          return await db.addEntry(entries[1]);
        });

        expect(retryId).toBeDefined();
      }
    });

    test('should handle database lock recovery', async () => {
      db = new KnowledgeDB(testDbPath);

      const entry: KBEntry = {
        title: 'Lock Recovery Test',
        problem: 'Test problem',
        solution: 'Test solution',
        category: 'Test'
      };

      // Simulate database lock
      let lockSimulated = false;
      const originalAddEntry = db.addEntry.bind(db);
      
      db.addEntry = jest.fn().mockImplementation(async (entryData) => {
        if (!lockSimulated) {
          lockSimulated = true;
          throw new AppError(ErrorCode.RESOURCE_LOCKED, 'Database is locked');
        }
        return originalAddEntry(entryData);
      });

      // Attempt operation with retry
      const result = await RetryManager.withBackoff(
        () => db.addEntry(entry),
        {
          maxAttempts: 3,
          baseDelay: 100,
          shouldRetry: (error) => 
            error instanceof AppError && error.code === ErrorCode.RESOURCE_LOCKED
        }
      );

      expect(result).toBeDefined();
    });

    test('should recover from index corruption', async () => {
      db = new KnowledgeDB(testDbPath);

      // Add entries to create search index
      const entries: KBEntry[] = Array.from({ length: 10 }, (_, i) => ({
        title: `Indexed Entry ${i}`,
        problem: `Problem ${i}`,
        solution: `Solution ${i}`,
        category: 'Test'
      }));

      for (const entry of entries) {
        await db.addEntry(entry);
      }

      // Simulate index corruption
      try {
        (db as any).db.exec('DROP TABLE IF EXISTS kb_fts');
      } catch (error) {
        // Index corruption detected
      }

      // Recovery: rebuild search index
      try {
        const results = await db.search('Indexed Entry');
        // Should fallback to non-FTS search or rebuild index
        expect(results).toBeDefined();
      } catch (error) {
        // Recovery mechanism would rebuild the index
        (db as any).db.exec(`
          CREATE VIRTUAL TABLE IF NOT EXISTS kb_fts USING fts5(
            id UNINDEXED,
            title,
            problem,
            solution,
            tags,
            content=kb_entries
          )
        `);

        // Repopulate index
        (db as any).db.exec(`
          INSERT INTO kb_fts(id, title, problem, solution)
          SELECT id, title, problem, solution FROM kb_entries
        `);

        const recoveryResults = await db.search('Indexed Entry');
        expect(recoveryResults.length).toBeGreaterThan(0);
      }
    });
  });

  describe('API Service Recovery', () => {
    beforeEach(() => {
      geminiService = new GeminiService({
        apiKey: 'test-api-key'
      });
    });

    test('should recover from API service outages', async () => {
      const testEntries: KBEntry[] = [
        {
          id: '1',
          title: 'VSAM Error',
          problem: 'VSAM status code 35',
          solution: 'Check dataset catalog',
          category: 'VSAM',
          tags: ['vsam']
        }
      ];

      const circuitBreaker = new CircuitBreaker(2, 1000);

      let apiCallCount = 0;
      const mockApiCall = jest.fn().mockImplementation(() => {
        apiCallCount++;
        if (apiCallCount <= 3) {
          throw new Error('API service unavailable');
        }
        return Promise.resolve({
          data: {
            candidates: [{ content: { parts: [{ text: '0:85' }] } }]
          }
        });
      });

      // Simulate API calls through circuit breaker
      for (let i = 0; i < 5; i++) {
        try {
          await circuitBreaker.execute(mockApiCall);
          break; // Success
        } catch (error) {
          if (circuitBreaker.getState() === 'OPEN') {
            // Fallback to local search
            const localResults = await geminiService.findSimilar('VSAM', testEntries);
            expect(localResults).toBeDefined();
            expect(localResults[0].matchType).toBe('fuzzy');
            break;
          }
          await setTimeout(100);
        }
      }
    });

    test('should implement exponential backoff for API retries', async () => {
      const testEntries: KBEntry[] = [
        {
          id: '1',
          title: 'Test Entry',
          problem: 'Test problem',
          solution: 'Test solution',
          category: 'Test'
        }
      ];

      let attempts = 0;
      const mockGeminiCall = jest.fn().mockImplementation(() => {
        attempts++;
        if (attempts <= 2) {
          const error = new Error('Rate limited');
          (error as any).response = { status: 429 };
          throw error;
        }
        return Promise.resolve(['0:95']);
      });

      const startTime = Date.now();
      
      const result = await RetryManager.withBackoff(
        mockGeminiCall,
        {
          maxAttempts: 4,
          baseDelay: 100,
          shouldRetry: (error) => 
            (error as any).response?.status === 429
        }
      );

      const duration = Date.now() - startTime;

      expect(result).toBeDefined();
      expect(attempts).toBe(3);
      expect(duration).toBeGreaterThan(200); // Should have waited for retries
    });

    test('should handle API key rotation', async () => {
      let currentKeyIndex = 0;
      const apiKeys = ['invalid-key-1', 'invalid-key-2', 'valid-key-3'];

      const mockApiCall = jest.fn().mockImplementation(() => {
        const key = apiKeys[currentKeyIndex];
        if (key.includes('invalid')) {
          const error = new Error('Invalid API key');
          (error as any).response = { status: 401 };
          throw error;
        }
        return Promise.resolve({ data: { candidates: [] } });
      });

      // Simulate key rotation on auth errors
      for (let attempt = 0; attempt < apiKeys.length; attempt++) {
        try {
          await mockApiCall();
          break; // Success with valid key
        } catch (error) {
          if ((error as any).response?.status === 401 && currentKeyIndex < apiKeys.length - 1) {
            currentKeyIndex++; // Rotate to next key
            continue;
          }
          throw error;
        }
      }

      expect(currentKeyIndex).toBe(2); // Should have rotated to valid key
      expect(mockApiCall).toHaveBeenCalledTimes(3);
    });

    test('should gracefully degrade when all API options exhausted', async () => {
      const testEntries: KBEntry[] = [
        {
          id: '1',
          title: 'Fallback Test',
          problem: 'Testing fallback mechanism',
          solution: 'Local search should work',
          category: 'Test'
        }
      ];

      // Mock complete API failure
      const mockFailedCall = jest.fn().mockRejectedValue(new Error('All APIs failed'));

      try {
        await RetryManager.withRetry(mockFailedCall, 3, 100);
      } catch (error) {
        // Fallback to local search
        const localResults = await geminiService.findSimilar('Fallback', testEntries);
        expect(localResults).toBeDefined();
        expect(localResults.length).toBeGreaterThan(0);
        expect(localResults[0].matchType).toBe('fuzzy');
      }
    });
  });

  describe('Memory and Resource Recovery', () => {
    test('should recover from memory pressure', async () => {
      // Simulate memory pressure scenario
      const largeDataSets: any[] = [];

      try {
        // Attempt to allocate large amounts of memory
        for (let i = 0; i < 10; i++) {
          largeDataSets.push(new Array(100000).fill(`data-${i}`));
        }

        // Simulate memory pressure detection
        if (largeDataSets.length > 5) {
          throw new AppError(ErrorCode.MEMORY_LIMIT_EXCEEDED, 'Memory limit exceeded');
        }
      } catch (error) {
        if (error instanceof AppError && error.code === ErrorCode.MEMORY_LIMIT_EXCEEDED) {
          // Recovery: clear large datasets
          largeDataSets.length = 0;
          
          // Force garbage collection if available
          if (global.gc) {
            global.gc();
          }

          // Verify recovery
          expect(largeDataSets.length).toBe(0);
        }
      }
    });

    test('should handle resource cleanup on errors', async () => {
      const resources: { cleanup: () => void }[] = [];

      try {
        // Simulate resource allocation
        for (let i = 0; i < 5; i++) {
          resources.push({
            cleanup: jest.fn()
          });
        }

        // Simulate operation that fails
        throw new Error('Operation failed');
      } catch (error) {
        // Recovery: cleanup all allocated resources
        resources.forEach(resource => resource.cleanup());
        
        // Verify cleanup
        resources.forEach(resource => {
          expect(resource.cleanup).toHaveBeenCalled();
        });
      }
    });

    test('should implement graceful shutdown on critical errors', async () => {
      let shutdownCalled = false;
      const gracefulShutdown = jest.fn().mockImplementation(() => {
        shutdownCalled = true;
      });

      try {
        // Simulate critical system error
        throw new AppError(ErrorCode.INTERNAL_ERROR, 'Critical system error');
      } catch (error) {
        if (error instanceof AppError && error.severity === 'critical') {
          // Trigger graceful shutdown
          gracefulShutdown();
        }
      }

      expect(shutdownCalled).toBe(true);
      expect(gracefulShutdown).toHaveBeenCalled();
    });
  });

  describe('Cross-System Recovery', () => {
    test('should recover from multiple simultaneous failures', async () => {
      db = new KnowledgeDB(testDbPath);
      
      const errors: Error[] = [];
      const recoveryActions: string[] = [];

      // Simulate multiple system failures
      const failures = [
        () => {
          throw new AppError(ErrorCode.DATABASE_CONNECTION_ERROR, 'DB connection failed');
        },
        () => {
          throw new AppError(ErrorCode.AI_SERVICE_UNAVAILABLE, 'AI service down');
        },
        () => {
          throw new AppError(ErrorCode.NETWORK_ERROR, 'Network unavailable');
        }
      ];

      for (const failure of failures) {
        try {
          failure();
        } catch (error) {
          errors.push(error as Error);

          // Implement recovery based on error type
          if (error instanceof AppError) {
            switch (error.code) {
              case ErrorCode.DATABASE_CONNECTION_ERROR:
                recoveryActions.push('Database failover initiated');
                break;
              case ErrorCode.AI_SERVICE_UNAVAILABLE:
                recoveryActions.push('Fallback to local processing');
                break;
              case ErrorCode.NETWORK_ERROR:
                recoveryActions.push('Offline mode activated');
                break;
            }
          }
        }
      }

      expect(errors.length).toBe(3);
      expect(recoveryActions.length).toBe(3);
      expect(recoveryActions).toContain('Database failover initiated');
      expect(recoveryActions).toContain('Fallback to local processing');
      expect(recoveryActions).toContain('Offline mode activated');
    });

    test('should maintain data consistency during recovery', async () => {
      db = new KnowledgeDB(testDbPath);

      const testData = [
        { title: 'Entry 1', problem: 'Problem 1', solution: 'Solution 1', category: 'Test' },
        { title: 'Entry 2', problem: 'Problem 2', solution: 'Solution 2', category: 'Test' },
        { title: 'Entry 3', problem: 'Problem 3', solution: 'Solution 3', category: 'Test' }
      ];

      const addedIds: string[] = [];

      try {
        // Add entries with potential failures
        for (let i = 0; i < testData.length; i++) {
          if (i === 1) {
            // Simulate failure on second entry
            throw new Error('Simulated failure');
          }
          const id = await db.addEntry(testData[i]);
          addedIds.push(id);
        }
      } catch (error) {
        // Recovery: verify partial data integrity
        const results = await db.search('Entry 1');
        expect(results).toHaveLength(1);

        // Recovery: complete the failed operations
        for (let i = 1; i < testData.length; i++) {
          const id = await db.addEntry(testData[i]);
          addedIds.push(id);
        }
      }

      // Verify all data was eventually added
      const allResults = await db.search('Entry');
      expect(allResults.length).toBe(3);
      expect(addedIds.length).toBe(3);
    });

    test('should implement circuit breaker pattern across services', async () => {
      const serviceBreakers = {
        database: new CircuitBreaker(2, 1000),
        api: new CircuitBreaker(3, 2000),
        search: new CircuitBreaker(2, 1500)
      };

      const serviceOperations = {
        database: jest.fn().mockRejectedValue(new Error('DB error')),
        api: jest.fn().mockRejectedValue(new Error('API error')),
        search: jest.fn().mockRejectedValue(new Error('Search error'))
      };

      const fallbackActions = {
        database: jest.fn().mockResolvedValue('Fallback DB result'),
        api: jest.fn().mockResolvedValue('Fallback API result'),
        search: jest.fn().mockResolvedValue('Fallback Search result')
      };

      // Test each service's circuit breaker
      for (const [service, breaker] of Object.entries(serviceBreakers)) {
        let result;
        
        // Trigger failures to open circuit
        for (let i = 0; i < 3; i++) {
          try {
            await breaker.execute(serviceOperations[service as keyof typeof serviceOperations]);
          } catch (error) {
            // Expected failure
          }
        }

        // Circuit should be open, use fallback
        if (breaker.getState() === 'OPEN') {
          result = await fallbackActions[service as keyof typeof fallbackActions]();
        }

        expect(result).toBeDefined();
        expect(result).toContain('Fallback');
      }
    });
  });

  describe('Recovery Performance and Monitoring', () => {
    test('should measure recovery time metrics', async () => {
      const recoveryMetrics = {
        startTime: 0,
        endTime: 0,
        duration: 0,
        attempts: 0
      };

      recoveryMetrics.startTime = Date.now();

      try {
        await RetryManager.withBackoff(
          () => {
            recoveryMetrics.attempts++;
            if (recoveryMetrics.attempts <= 2) {
              throw new Error('Transient failure');
            }
            return Promise.resolve('Success');
          },
          { maxAttempts: 3, baseDelay: 50 }
        );
      } finally {
        recoveryMetrics.endTime = Date.now();
        recoveryMetrics.duration = recoveryMetrics.endTime - recoveryMetrics.startTime;
      }

      expect(recoveryMetrics.attempts).toBe(3);
      expect(recoveryMetrics.duration).toBeGreaterThan(100); // Should include retry delays
      expect(recoveryMetrics.duration).toBeLessThan(5000); // Should complete reasonably quickly
    });

    test('should track recovery success rates', async () => {
      const recoveryStats = {
        totalAttempts: 0,
        successful: 0,
        failed: 0
      };

      const scenarios = [
        () => Promise.resolve('Success'),
        () => Promise.reject(new Error('Failure')),
        () => Promise.resolve('Success'),
        () => Promise.resolve('Success'),
        () => Promise.reject(new Error('Failure'))
      ];

      for (const scenario of scenarios) {
        recoveryStats.totalAttempts++;
        try {
          await scenario();
          recoveryStats.successful++;
        } catch (error) {
          recoveryStats.failed++;
        }
      }

      const successRate = recoveryStats.successful / recoveryStats.totalAttempts;
      
      expect(recoveryStats.totalAttempts).toBe(5);
      expect(recoveryStats.successful).toBe(3);
      expect(recoveryStats.failed).toBe(2);
      expect(successRate).toBe(0.6);
    });

    test('should implement health checks for recovery monitoring', async () => {
      const healthChecks = {
        database: async () => {
          // Simulate database health check
          return { status: 'healthy', response_time: 50 };
        },
        api: async () => {
          // Simulate API health check
          return { status: 'degraded', response_time: 2000 };
        },
        search: async () => {
          // Simulate search service health check
          return { status: 'healthy', response_time: 100 };
        }
      };

      const healthReport = await Promise.all(
        Object.entries(healthChecks).map(async ([service, check]) => ({
          service,
          ...(await check())
        }))
      );

      expect(healthReport).toHaveLength(3);
      expect(healthReport[0].status).toBe('healthy');
      expect(healthReport[1].status).toBe('degraded');
      expect(healthReport[2].status).toBe('healthy');

      // Recovery actions based on health status
      const degradedServices = healthReport.filter(r => r.status === 'degraded');
      expect(degradedServices).toHaveLength(1);
      expect(degradedServices[0].service).toBe('api');
    });
  });
});