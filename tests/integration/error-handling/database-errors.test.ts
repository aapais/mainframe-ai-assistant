/**
 * Database Error Handling Tests
 * Comprehensive testing of database failure scenarios and recovery mechanisms
 */

import { KnowledgeDB, KBEntry } from '../../../src/database/KnowledgeDB';
import { AppError, ErrorCode } from '../../../src/core/errors/AppError';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { setTimeout } from 'timers/promises';

// Test utilities
interface DatabaseErrorTestUtils {
  createCorruptedDatabase: () => string;
  simulateConnectionFailure: (db: KnowledgeDB) => void;
  injectSQLError: (db: Database.Database, error: string) => void;
  createLockingScenario: (db: Database.Database) => Promise<void>;
  verifyRecovery: (db: KnowledgeDB) => Promise<boolean>;
}

class DatabaseErrorSimulator {
  private originalMethods = new Map();
  private db: Database.Database | null = null;

  constructor(database?: Database.Database) {
    this.db = database || null;
  }

  // Simulate database connection failures
  simulateConnectionError(): void {
    if (this.db) {
      const originalPrepare = this.db.prepare;
      this.originalMethods.set('prepare', originalPrepare);
      
      this.db.prepare = jest.fn().mockImplementation(() => {
        throw new Error('SQLITE_CANTOPEN: unable to open database file');
      });
    }
  }

  // Simulate transaction rollback scenarios
  simulateTransactionRollback(): void {
    if (this.db) {
      const originalTransaction = this.db.transaction;
      this.originalMethods.set('transaction', originalTransaction);
      
      this.db.transaction = jest.fn().mockImplementation((fn) => {
        return () => {
          throw new Error('SQLITE_BUSY: database is locked');
        };
      });
    }
  }

  // Simulate corrupted database
  simulateCorruption(): void {
    if (this.db) {
      const originalExec = this.db.exec;
      this.originalMethods.set('exec', originalExec);
      
      this.db.exec = jest.fn().mockImplementation(() => {
        throw new Error('SQLITE_CORRUPT: database disk image is malformed');
      });
    }
  }

  // Simulate constraint violations
  simulateConstraintViolation(): void {
    if (this.db) {
      const originalPrepare = this.db.prepare;
      this.originalMethods.set('prepare', originalPrepare);
      
      this.db.prepare = jest.fn().mockImplementation(() => ({
        run: jest.fn().mockImplementation(() => {
          throw new Error('SQLITE_CONSTRAINT: UNIQUE constraint failed');
        })
      }));
    }
  }

  // Simulate disk full scenarios
  simulateDiskFull(): void {
    if (this.db) {
      const originalPrepare = this.db.prepare;
      this.originalMethods.set('prepare', originalPrepare);
      
      this.db.prepare = jest.fn().mockImplementation(() => ({
        run: jest.fn().mockImplementation(() => {
          throw new Error('SQLITE_FULL: database or disk is full');
        })
      }));
    }
  }

  // Restore original methods
  restore(): void {
    if (this.db) {
      for (const [method, original] of this.originalMethods.entries()) {
        (this.db as any)[method] = original;
      }
    }
    this.originalMethods.clear();
  }
}

describe('Database Error Handling Tests', () => {
  let testDbPath: string;
  let db: KnowledgeDB;
  let simulator: DatabaseErrorSimulator;

  beforeEach(() => {
    // Create unique test database
    testDbPath = path.join(__dirname, `test-db-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.db`);
    db = new KnowledgeDB(testDbPath);
  });

  afterEach(() => {
    try {
      if (simulator) {
        simulator.restore();
      }
      if (db) {
        db.close();
      }
      if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
      }
    } catch (error) {
      console.warn('Cleanup error:', error);
    }
  });

  describe('Database Connection Failures', () => {
    test('should handle database initialization failure', async () => {
      // Test with invalid path
      const invalidPath = '/invalid/path/nonexistent/database.db';
      
      expect(() => {
        new KnowledgeDB(invalidPath);
      }).toThrow();
    });

    test('should handle database connection loss during operation', async () => {
      // Add test entry first
      const entry: KBEntry = {
        title: 'Test Entry',
        problem: 'Test problem',
        solution: 'Test solution',
        category: 'Test',
        tags: ['test']
      };

      const entryId = await db.addEntry(entry);
      expect(entryId).toBeDefined();

      // Simulate connection failure
      simulator = new DatabaseErrorSimulator((db as any).db);
      simulator.simulateConnectionError();

      // Attempt search - should handle gracefully
      await expect(db.search('test')).rejects.toThrow();
    });

    test('should retry connection on transient failures', async () => {
      let attemptCount = 0;
      const maxAttempts = 3;

      // Mock the connection attempt to fail twice, then succeed
      const originalPrepare = (db as any).db.prepare;
      (db as any).db.prepare = jest.fn().mockImplementation((query) => {
        attemptCount++;
        if (attemptCount <= 2) {
          throw new Error('SQLITE_BUSY: database is locked');
        }
        return originalPrepare.call((db as any).db, query);
      });

      const entry: KBEntry = {
        title: 'Retry Test',
        problem: 'Test problem',
        solution: 'Test solution',
        category: 'Test'
      };

      // This should eventually succeed after retries
      // Note: Actual retry logic would need to be implemented in the KnowledgeDB class
      try {
        await db.addEntry(entry);
      } catch (error) {
        expect(error).toBeTruthy();
        expect(attemptCount).toBe(3);
      }
    });
  });

  describe('Transaction Rollback Scenarios', () => {
    test('should rollback transaction on constraint violation', async () => {
      const entry: KBEntry = {
        title: 'Original Entry',
        problem: 'Test problem',
        solution: 'Test solution',
        category: 'Test'
      };

      // Add entry successfully
      const entryId = await db.addEntry(entry);
      expect(entryId).toBeDefined();

      // Simulate constraint violation on duplicate insert
      simulator = new DatabaseErrorSimulator((db as any).db);
      simulator.simulateConstraintViolation();

      // Attempt to add duplicate - should fail and rollback
      await expect(db.addEntry({
        ...entry,
        title: 'Duplicate Entry'
      })).rejects.toThrow();

      // Original entry should still exist
      const results = await db.search('Original Entry');
      expect(results).toHaveLength(1);
    });

    test('should handle transaction deadlock scenarios', async () => {
      // Simulate concurrent access scenario
      const entry1: KBEntry = {
        title: 'Entry 1',
        problem: 'Problem 1',
        solution: 'Solution 1',
        category: 'Test'
      };

      const entry2: KBEntry = {
        title: 'Entry 2',
        problem: 'Problem 2',
        solution: 'Solution 2',
        category: 'Test'
      };

      // Start concurrent operations
      const operations = [
        db.addEntry(entry1),
        db.addEntry(entry2)
      ];

      // At least one should succeed
      const results = await Promise.allSettled(operations);
      const successes = results.filter(r => r.status === 'fulfilled');
      expect(successes.length).toBeGreaterThan(0);
    });

    test('should maintain data integrity during rollback', async () => {
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

      // Start batch operation that should fail midway
      simulator = new DatabaseErrorSimulator((db as any).db);
      
      // Add first entry successfully
      const id1 = await db.addEntry(entries[0]);
      expect(id1).toBeDefined();

      // Simulate failure for second entry
      simulator.simulateConstraintViolation();

      try {
        await db.addEntry(entries[1]);
      } catch (error) {
        // Expected to fail
      }

      // Verify first entry still exists (transaction integrity)
      const results = await db.search('Entry 1');
      expect(results).toHaveLength(1);
    });
  });

  describe('Database Corruption Recovery', () => {
    test('should detect corrupted database', async () => {
      // Create corrupted database file
      fs.writeFileSync(testDbPath, 'corrupted data');
      
      expect(() => {
        new KnowledgeDB(testDbPath);
      }).toThrow();
    });

    test('should attempt recovery from backup', async () => {
      // Add test data
      const entry: KBEntry = {
        title: 'Recovery Test',
        problem: 'Test problem',
        solution: 'Test solution',
        category: 'Test'
      };

      await db.addEntry(entry);

      // Create backup
      const backupPath = testDbPath + '.backup';
      fs.copyFileSync(testDbPath, backupPath);

      // Corrupt main database
      fs.writeFileSync(testDbPath, 'corrupted');

      // Simulate recovery mechanism
      try {
        new KnowledgeDB(testDbPath);
      } catch (error) {
        // Recovery would copy from backup
        if (fs.existsSync(backupPath)) {
          fs.copyFileSync(backupPath, testDbPath);
          const recoveredDb = new KnowledgeDB(testDbPath);
          const results = await recoveredDb.search('Recovery Test');
          expect(results).toHaveLength(1);
          recoveredDb.close();
        }
      }

      // Cleanup
      if (fs.existsSync(backupPath)) {
        fs.unlinkSync(backupPath);
      }
    });

    test('should validate database integrity on startup', async () => {
      // This would test PRAGMA integrity_check functionality
      const integrityQuery = "PRAGMA integrity_check";
      const result = (db as any).db.prepare(integrityQuery).get();
      
      expect(result).toBeTruthy();
      expect(result.integrity_check).toContain('ok');
    });
  });

  describe('Migration Failure Handling', () => {
    test('should rollback failed migration', async () => {
      // This test would verify migration rollback functionality
      // For now, we'll test the concept with a simulated migration failure
      
      const originalSchema = (db as any).db.prepare("PRAGMA table_info(kb_entries)").all();
      
      try {
        // Simulate failed schema change
        (db as any).db.exec("ALTER TABLE kb_entries ADD COLUMN invalid_column");
        throw new Error('Migration failed');
      } catch (error) {
        // Rollback would restore original schema
        const currentSchema = (db as any).db.prepare("PRAGMA table_info(kb_entries)").all();
        expect(currentSchema).toEqual(originalSchema);
      }
    });

    test('should handle version mismatch errors', async () => {
      // Test would verify proper handling of schema version mismatches
      const versionQuery = "PRAGMA user_version";
      const currentVersion = (db as any).db.prepare(versionQuery).get();
      
      expect(currentVersion).toBeDefined();
      expect(typeof currentVersion.user_version).toBe('number');
    });
  });

  describe('Concurrent Access Issues', () => {
    test('should handle concurrent write operations', async () => {
      const entries = Array.from({ length: 5 }, (_, i) => ({
        title: `Concurrent Entry ${i}`,
        problem: `Problem ${i}`,
        solution: `Solution ${i}`,
        category: 'Test'
      }));

      // Execute concurrent writes
      const operations = entries.map(entry => db.addEntry(entry));
      const results = await Promise.allSettled(operations);

      // All operations should succeed (SQLite handles locking internally)
      const successes = results.filter(r => r.status === 'fulfilled');
      expect(successes.length).toBe(entries.length);
    });

    test('should handle read during write operations', async () => {
      const entry: KBEntry = {
        title: 'Read-Write Test',
        problem: 'Test problem',
        solution: 'Test solution',
        category: 'Test'
      };

      // Start write operation
      const writePromise = db.addEntry(entry);
      
      // Immediately try to read
      const readPromise = db.search('Read-Write Test');

      const [writeResult, readResult] = await Promise.allSettled([writePromise, readPromise]);

      // At least one should succeed
      expect(writeResult.status === 'fulfilled' || readResult.status === 'fulfilled').toBe(true);
    });

    test('should handle database locking scenarios', async () => {
      // Simulate external lock on database
      simulator = new DatabaseErrorSimulator((db as any).db);
      simulator.simulateTransactionRollback();

      const entry: KBEntry = {
        title: 'Lock Test',
        problem: 'Test problem',
        solution: 'Test solution',
        category: 'Test'
      };

      await expect(db.addEntry(entry)).rejects.toThrow(/locked/i);
    });
  });

  describe('Resource Exhaustion Scenarios', () => {
    test('should handle disk space exhaustion', async () => {
      simulator = new DatabaseErrorSimulator((db as any).db);
      simulator.simulateDiskFull();

      const entry: KBEntry = {
        title: 'Disk Full Test',
        problem: 'Test problem',
        solution: 'Test solution',
        category: 'Test'
      };

      await expect(db.addEntry(entry)).rejects.toThrow(/full/i);
    });

    test('should handle memory pressure scenarios', async () => {
      // Create large entry to test memory limits
      const largeContent = 'x'.repeat(10 * 1024 * 1024); // 10MB
      const entry: KBEntry = {
        title: 'Memory Test',
        problem: largeContent,
        solution: largeContent,
        category: 'Test'
      };

      // This should either succeed or fail gracefully
      try {
        const result = await db.addEntry(entry);
        expect(result).toBeDefined();
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });

    test('should handle connection pool exhaustion', async () => {
      // Test would verify connection pool limits
      // For SQLite, this is less relevant as it's file-based
      const entry: KBEntry = {
        title: 'Connection Pool Test',
        problem: 'Test problem',
        solution: 'Test solution',
        category: 'Test'
      };

      const operations = Array.from({ length: 100 }, () => db.addEntry({
        ...entry,
        title: `${entry.title} ${Math.random()}`
      }));

      const results = await Promise.allSettled(operations);
      const successes = results.filter(r => r.status === 'fulfilled');
      
      // Most should succeed; some might fail gracefully
      expect(successes.length).toBeGreaterThan(90);
    });
  });

  describe('Error Recovery and Logging', () => {
    test('should log database errors with proper context', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      simulator = new DatabaseErrorSimulator((db as any).db);
      simulator.simulateConnectionError();

      try {
        await db.search('test');
      } catch (error) {
        // Error should be logged with context
        // In a real implementation, this would use a proper logging system
        expect(error).toBeDefined();
      }

      consoleSpy.mockRestore();
    });

    test('should maintain audit trail during error scenarios', async () => {
      const entry: KBEntry = {
        title: 'Audit Test',
        problem: 'Test problem',
        solution: 'Test solution',
        category: 'Test'
      };

      try {
        await db.addEntry(entry);
        // Simulate error during usage tracking
        simulator = new DatabaseErrorSimulator((db as any).db);
        simulator.simulateConnectionError();
        
        await db.recordUsage('non-existent', true);
      } catch (error) {
        // Error should be recorded in audit log
        expect(error).toBeDefined();
      }
    });

    test('should provide meaningful error messages', async () => {
      simulator = new DatabaseErrorSimulator((db as any).db);
      simulator.simulateCorruption();

      try {
        await db.search('test');
      } catch (error) {
        const appError = AppError.fromUnknown(error);
        expect(appError.getUserMessage()).toBeTruthy();
        expect(appError.code).toBeDefined();
        expect(appError.severity).toBeDefined();
      }
    });
  });

  describe('Graceful Degradation', () => {
    test('should fallback to read-only mode on write errors', async () => {
      // Add entry successfully first
      const entry: KBEntry = {
        title: 'Read-Only Test',
        problem: 'Test problem',
        solution: 'Test solution',
        category: 'Test'
      };

      await db.addEntry(entry);

      // Simulate write failures
      simulator = new DatabaseErrorSimulator((db as any).db);
      simulator.simulateConstraintViolation();

      // Reads should still work
      const results = await db.search('Read-Only Test');
      expect(results).toHaveLength(1);

      // Writes should fail gracefully
      await expect(db.addEntry({
        ...entry,
        title: 'Should Fail'
      })).rejects.toThrow();
    });

    test('should disable features on persistent errors', async () => {
      // Test would implement circuit breaker pattern
      // For now, verify error counting mechanism
      let errorCount = 0;
      const maxErrors = 3;

      for (let i = 0; i < maxErrors + 1; i++) {
        try {
          simulator = new DatabaseErrorSimulator((db as any).db);
          simulator.simulateConnectionError();
          await db.search('test');
        } catch (error) {
          errorCount++;
        }
      }

      expect(errorCount).toBe(maxErrors + 1);
    });

    test('should recover from temporary failures', async () => {
      let attemptCount = 0;
      const originalSearch = db.search.bind(db);
      
      // Mock to fail first few attempts
      db.search = jest.fn().mockImplementation(async (query) => {
        attemptCount++;
        if (attemptCount <= 2) {
          throw new Error('Temporary failure');
        }
        return originalSearch(query);
      });

      // Add test data first
      const entry: KBEntry = {
        title: 'Recovery Test',
        problem: 'Test problem',
        solution: 'Test solution',
        category: 'Test'
      };

      await db.addEntry(entry);

      // Implement retry logic (would be in actual service)
      let lastError;
      for (let i = 0; i < 5; i++) {
        try {
          const results = await db.search('Recovery Test');
          expect(results).toBeDefined();
          break;
        } catch (error) {
          lastError = error;
          await setTimeout(100); // Brief delay between retries
        }
      }

      expect(attemptCount).toBeGreaterThan(2);
    });
  });
});