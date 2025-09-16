/**
 * Unit Tests for SQLiteAdapter
 * Tests SQLite-specific functionality and SQL operations
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import { SQLiteAdapter } from '../../../../src/services/storage/adapters/SQLiteAdapter';
import { DatabaseConfig } from '../../../../src/services/storage/IStorageService';
import { createTestKBEntry } from '../../fixtures/testData';
import * as fs from 'fs';
import * as path from 'path';

describe('SQLiteAdapter', () => {
  let adapter: SQLiteAdapter;
  let testDbPath: string;
  let config: DatabaseConfig;

  beforeAll(() => {
    // Create test database path
    testDbPath = path.join(__dirname, '..', '..', 'temp', 'test.db');
    const tempDir = path.dirname(testDbPath);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
  });

  beforeEach(async () => {
    // Remove existing test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    config = {
      type: 'sqlite',
      path: testDbPath,
      pragmas: {
        journal_mode: 'WAL',
        synchronous: 'NORMAL',
        foreign_keys: 'ON'
      }
    };

    adapter = new SQLiteAdapter();
    await adapter.initialize(config);
  });

  afterEach(async () => {
    await adapter.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  afterAll(() => {
    // Cleanup temp directory
    const tempDir = path.dirname(testDbPath);
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  describe('Initialization', () => {
    it('should create database file', () => {
      expect(fs.existsSync(testDbPath)).toBe(true);
    });

    it('should create required tables', async () => {
      const tables = await adapter.query(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
      `);

      const tableNames = tables.map((row: any) => row.name);
      expect(tableNames).toContain('kb_entries');
      expect(tableNames).toContain('kb_tags');
      expect(tableNames).toContain('usage_metrics');
      expect(tableNames).toContain('search_history');
    });

    it('should apply pragmas correctly', async () => {
      const pragmas = await adapter.query('PRAGMA journal_mode');
      expect(pragmas[0].journal_mode).toBe('wal');

      const foreignKeys = await adapter.query('PRAGMA foreign_keys');
      expect(foreignKeys[0].foreign_keys).toBe(1);
    });

    it('should create indexes for performance', async () => {
      const indexes = await adapter.query(`
        SELECT name FROM sqlite_master 
        WHERE type='index' AND name NOT LIKE 'sqlite_%'
      `);

      const indexNames = indexes.map((row: any) => row.name);
      expect(indexNames.length).toBeGreaterThan(0);
      expect(indexNames.some(name => name.includes('category'))).toBe(true);
      expect(indexNames.some(name => name.includes('created_at'))).toBe(true);
    });

    it('should handle initialization errors', async () => {
      const invalidConfig = {
        type: 'sqlite' as const,
        path: '/invalid/path/test.db'
      };

      const newAdapter = new SQLiteAdapter();
      await expect(newAdapter.initialize(invalidConfig)).rejects.toThrow();
    });
  });

  describe('CRUD Operations', () => {
    describe('addEntry', () => {
      it('should insert entry with all fields', async () => {
        const entryInput = createTestKBEntry();
        const result = await adapter.addEntry(entryInput);

        expect(result).toBeDefined();
        expect(result.id).toBeTruthy();
        expect(result.title).toBe(entryInput.title);
        expect(result.problem).toBe(entryInput.problem);
        expect(result.solution).toBe(entryInput.solution);
        expect(result.category).toBe(entryInput.category);
      });

      it('should handle tags correctly', async () => {
        const entryInput = createTestKBEntry();
        entryInput.tags = ['test', 'sqlite', 'adapter'];
        
        const result = await adapter.addEntry(entryInput);
        expect(result.tags).toEqual(entryInput.tags);

        // Verify tags in database
        const tags = await adapter.query(
          'SELECT tag FROM kb_tags WHERE entry_id = ?',
          [result.id]
        );
        const tagNames = tags.map((row: any) => row.tag);
        expect(tagNames).toEqual(expect.arrayContaining(entryInput.tags));
      });

      it('should generate unique IDs', async () => {
        const entry1 = await adapter.addEntry(createTestKBEntry());
        const entry2 = await adapter.addEntry(createTestKBEntry());

        expect(entry1.id).not.toBe(entry2.id);
        expect(entry1.id).toMatch(/^[a-f0-9-]+$/);
        expect(entry2.id).toMatch(/^[a-f0-9-]+$/);
      });

      it('should set timestamps correctly', async () => {
        const beforeInsert = new Date();
        const result = await adapter.addEntry(createTestKBEntry());
        const afterInsert = new Date();

        expect(result.created_at).toBeInstanceOf(Date);
        expect(result.updated_at).toBeInstanceOf(Date);
        expect(result.created_at.getTime()).toBeGreaterThanOrEqual(beforeInsert.getTime());
        expect(result.created_at.getTime()).toBeLessThanOrEqual(afterInsert.getTime());
      });

      it('should handle SQL injection attempts', async () => {
        const maliciousEntry = createTestKBEntry();
        maliciousEntry.title = "'; DROP TABLE kb_entries; --";
        maliciousEntry.problem = "SQL injection test";

        const result = await adapter.addEntry(maliciousEntry);
        expect(result).toBeDefined();

        // Verify table still exists
        const count = await adapter.query('SELECT COUNT(*) as count FROM kb_entries');
        expect(count[0].count).toBe(1);
      });
    });

    describe('getEntry', () => {
      it('should retrieve existing entry with tags', async () => {
        const entryInput = createTestKBEntry();
        entryInput.tags = ['test', 'get'];
        const inserted = await adapter.addEntry(entryInput);

        const retrieved = await adapter.getEntry(inserted.id);

        expect(retrieved).toBeDefined();
        expect(retrieved!.id).toBe(inserted.id);
        expect(retrieved!.title).toBe(inserted.title);
        expect(retrieved!.tags).toEqual(expect.arrayContaining(entryInput.tags!));
      });

      it('should return null for non-existent entry', async () => {
        const result = await adapter.getEntry('non-existent-id');
        expect(result).toBeNull();
      });

      it('should handle malformed IDs', async () => {
        const result = await adapter.getEntry('');
        expect(result).toBeNull();
      });
    });

    describe('updateEntry', () => {
      it('should update existing entry', async () => {
        const entryInput = createTestKBEntry();
        const inserted = await adapter.addEntry(entryInput);

        const updateData = {
          title: 'Updated Title',
          problem: 'Updated Problem',
          tags: ['updated', 'test']
        };

        const updated = await adapter.updateEntry(inserted.id, updateData);

        expect(updated).toBeDefined();
        expect(updated!.title).toBe(updateData.title);
        expect(updated!.problem).toBe(updateData.problem);
        expect(updated!.tags).toEqual(expect.arrayContaining(updateData.tags));
        expect(updated!.updated_at.getTime()).toBeGreaterThan(inserted.updated_at.getTime());
      });

      it('should handle partial updates', async () => {
        const entryInput = createTestKBEntry();
        const inserted = await adapter.addEntry(entryInput);

        const updateData = { title: 'Only Title Updated' };
        const updated = await adapter.updateEntry(inserted.id, updateData);

        expect(updated!.title).toBe(updateData.title);
        expect(updated!.problem).toBe(inserted.problem); // Should remain unchanged
        expect(updated!.solution).toBe(inserted.solution);
      });

      it('should update tags correctly', async () => {
        const entryInput = createTestKBEntry();
        entryInput.tags = ['original', 'tags'];
        const inserted = await adapter.addEntry(entryInput);

        const updateData = { tags: ['new', 'updated', 'tags'] };
        const updated = await adapter.updateEntry(inserted.id, updateData);

        expect(updated!.tags).toEqual(expect.arrayContaining(updateData.tags));
        expect(updated!.tags).not.toContain('original');
      });

      it('should return null for non-existent entry', async () => {
        const result = await adapter.updateEntry('non-existent', { title: 'Test' });
        expect(result).toBeNull();
      });
    });

    describe('deleteEntry', () => {
      it('should delete existing entry and related data', async () => {
        const entryInput = createTestKBEntry();
        entryInput.tags = ['to', 'be', 'deleted'];
        const inserted = await adapter.addEntry(entryInput);

        await adapter.deleteEntry(inserted.id);

        // Verify entry is deleted
        const retrieved = await adapter.getEntry(inserted.id);
        expect(retrieved).toBeNull();

        // Verify tags are deleted (foreign key cascade)
        const tags = await adapter.query(
          'SELECT COUNT(*) as count FROM kb_tags WHERE entry_id = ?',
          [inserted.id]
        );
        expect(tags[0].count).toBe(0);
      });

      it('should handle deletion of non-existent entry', async () => {
        // Should not throw error
        await expect(adapter.deleteEntry('non-existent')).resolves.not.toThrow();
      });
    });
  });

  describe('Search Operations', () => {
    beforeEach(async () => {
      // Insert test data
      const entries = [
        {
          ...createTestKBEntry(),
          title: 'VSAM Status 35 Error',
          problem: 'File not found in VSAM',
          solution: 'Check catalog',
          category: 'VSAM',
          tags: ['vsam', 'error', 'file']
        },
        {
          ...createTestKBEntry(),
          title: 'JCL Syntax Error',
          problem: 'Invalid JCL syntax',
          solution: 'Fix syntax',
          category: 'JCL',
          tags: ['jcl', 'syntax', 'error']
        },
        {
          ...createTestKBEntry(),
          title: 'DB2 Connection Issue',
          problem: 'Cannot connect to DB2',
          solution: 'Check connection string',
          category: 'DB2',
          tags: ['db2', 'connection']
        }
      ];

      for (const entry of entries) {
        await adapter.addEntry(entry);
      }
    });

    describe('search', () => {
      it('should perform full-text search', async () => {
        const results = await adapter.search('VSAM');
        
        expect(results.length).toBeGreaterThan(0);
        expect(results[0].entry.title).toContain('VSAM');
        expect(results[0].score).toBeGreaterThan(0);
      });

      it('should search across multiple fields', async () => {
        const results = await adapter.search('syntax');
        
        expect(results.length).toBeGreaterThan(0);
        expect(results.some(r => 
          r.entry.title.includes('Syntax') || 
          r.entry.problem.includes('syntax') ||
          r.entry.solution.includes('syntax')
        )).toBe(true);
      });

      it('should apply category filter', async () => {
        const results = await adapter.search('error', {
          filters: { category: 'VSAM' }
        });

        expect(results.length).toBeGreaterThan(0);
        expect(results.every(r => r.entry.category === 'VSAM')).toBe(true);
      });

      it('should apply tag filter', async () => {
        const results = await adapter.search('', {
          filters: { tags: ['connection'] }
        });

        expect(results.length).toBeGreaterThan(0);
        expect(results.every(r => r.entry.tags?.includes('connection'))).toBe(true);
      });

      it('should limit results correctly', async () => {
        const results = await adapter.search('error', { limit: 1 });
        expect(results.length).toBeLessThanOrEqual(1);
      });

      it('should handle offset for pagination', async () => {
        const firstPage = await adapter.search('error', { limit: 1, offset: 0 });
        const secondPage = await adapter.search('error', { limit: 1, offset: 1 });

        expect(firstPage.length).toBeLessThanOrEqual(1);
        expect(secondPage.length).toBeLessThanOrEqual(1);

        if (firstPage.length > 0 && secondPage.length > 0) {
          expect(firstPage[0].entry.id).not.toBe(secondPage[0].entry.id);
        }
      });

      it('should sort results by relevance by default', async () => {
        const results = await adapter.search('error', { limit: 10 });
        
        expect(results.length).toBeGreaterThan(1);
        for (let i = 1; i < results.length; i++) {
          expect(results[i].score).toBeLessThanOrEqual(results[i-1].score);
        }
      });

      it('should handle empty search gracefully', async () => {
        const results = await adapter.search('nonexistent');
        expect(results).toEqual([]);
      });

      it('should handle special characters in search', async () => {
        const results = await adapter.search('error&syntax');
        expect(results).toBeDefined();
        expect(Array.isArray(results)).toBe(true);
      });
    });

    describe('searchSimilar', () => {
      it('should find similar entries', async () => {
        const entries = await adapter.search('VSAM');
        const targetEntry = entries[0];
        
        const similar = await adapter.searchSimilar(targetEntry.entry.id!, {
          limit: 5,
          threshold: 0.1
        });

        expect(similar.length).toBeGreaterThanOrEqual(0);
        expect(similar.every(r => r.entry.id !== targetEntry.entry.id)).toBe(true);
      });

      it('should handle non-existent entry ID', async () => {
        const similar = await adapter.searchSimilar('non-existent');
        expect(similar).toEqual([]);
      });
    });
  });

  describe('Batch Operations', () => {
    it('should perform batch insert', async () => {
      const entries = [
        createTestKBEntry(),
        createTestKBEntry(),
        createTestKBEntry()
      ];

      const results = await adapter.batchInsert(entries);

      expect(results.length).toBe(3);
      expect(results.every(r => r.id)).toBe(true);
      expect(results.every(r => r.created_at)).toBe(true);
    });

    it('should handle batch insert with tags', async () => {
      const entries = [
        { ...createTestKBEntry(), tags: ['batch', 'test1'] },
        { ...createTestKBEntry(), tags: ['batch', 'test2'] },
        { ...createTestKBEntry(), tags: ['batch', 'test3'] }
      ];

      const results = await adapter.batchInsert(entries);

      expect(results.length).toBe(3);
      expect(results.every(r => r.tags?.includes('batch'))).toBe(true);
    });

    it('should rollback on batch insert failure', async () => {
      const validEntry = createTestKBEntry();
      const invalidEntry = { ...createTestKBEntry(), category: null as any };

      await expect(adapter.batchInsert([validEntry, invalidEntry])).rejects.toThrow();

      // Verify no entries were inserted
      const count = await adapter.query('SELECT COUNT(*) as count FROM kb_entries');
      expect(count[0].count).toBe(0);
    });

    it('should perform batch update', async () => {
      // Insert test entries first
      const entries = [
        createTestKBEntry(),
        createTestKBEntry(),
        createTestKBEntry()
      ];

      const inserted = await adapter.batchInsert(entries);
      
      // Prepare updates
      const updates = inserted.map(entry => ({
        id: entry.id!,
        data: { title: `Updated ${entry.title}` }
      }));

      const results = await adapter.batchUpdate(updates);

      expect(results.length).toBe(3);
      expect(results.every(r => r.title.startsWith('Updated'))).toBe(true);
    });

    it('should perform batch delete', async () => {
      // Insert test entries first
      const entries = [
        createTestKBEntry(),
        createTestKBEntry(),
        createTestKBEntry()
      ];

      const inserted = await adapter.batchInsert(entries);
      const ids = inserted.map(e => e.id!);

      await adapter.batchDelete(ids);

      // Verify all entries are deleted
      for (const id of ids) {
        const entry = await adapter.getEntry(id);
        expect(entry).toBeNull();
      }
    });
  });

  describe('Database Operations', () => {
    it('should execute raw queries', async () => {
      const result = await adapter.query('SELECT COUNT(*) as count FROM kb_entries');
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toHaveProperty('count');
    });

    it('should execute queries with parameters', async () => {
      await adapter.addEntry(createTestKBEntry());
      
      const result = await adapter.query(
        'SELECT * FROM kb_entries WHERE category = ?',
        ['JCL']
      );

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle invalid SQL gracefully', async () => {
      await expect(adapter.query('INVALID SQL')).rejects.toThrow();
    });
  });

  describe('Performance Optimization', () => {
    it('should vacuum database', async () => {
      // Insert and delete some data to create fragmentation
      const entry = await adapter.addEntry(createTestKBEntry());
      await adapter.deleteEntry(entry.id!);

      await expect(adapter.vacuum()).resolves.not.toThrow();
    });

    it('should analyze query performance', async () => {
      await adapter.addEntry(createTestKBEntry());
      
      const analysis = await adapter.analyze();
      
      expect(analysis).toBeDefined();
      expect(analysis.performance).toBeDefined();
      expect(analysis.storage).toBeDefined();
    });

    it('should rebuild indexes', async () => {
      await expect(adapter.rebuildIndexes()).resolves.not.toThrow();
    });
  });

  describe('Transaction Management', () => {
    it('should support transactions', async () => {
      const entry1 = createTestKBEntry();
      const entry2 = createTestKBEntry();

      await adapter.transaction(async (tx) => {
        await tx.addEntry(entry1);
        await tx.addEntry(entry2);
      });

      const count = await adapter.query('SELECT COUNT(*) as count FROM kb_entries');
      expect(count[0].count).toBe(2);
    });

    it('should rollback failed transactions', async () => {
      const entry1 = createTestKBEntry();
      const invalidEntry = { ...createTestKBEntry(), category: null as any };

      await expect(adapter.transaction(async (tx) => {
        await tx.addEntry(entry1);
        await tx.addEntry(invalidEntry); // This should fail
      })).rejects.toThrow();

      const count = await adapter.query('SELECT COUNT(*) as count FROM kb_entries');
      expect(count[0].count).toBe(0);
    });
  });

  describe('Memory Management', () => {
    it('should clear internal caches', async () => {
      await adapter.clearCache();
      // Should not throw - specific cache clearing logic depends on implementation
    });

    it('should handle memory pressure', async () => {
      // Simulate memory pressure by inserting many entries
      const entries = Array.from({ length: 100 }, () => createTestKBEntry());
      await adapter.batchInsert(entries);

      // Should handle gracefully
      const metrics = await adapter.getMetrics();
      expect(metrics.storage.size).toBeGreaterThan(0);
    });
  });

  describe('Database Integrity', () => {
    it('should enforce foreign key constraints', async () => {
      // Manually insert invalid tag reference (should fail due to foreign key)
      await expect(adapter.query(
        'INSERT INTO kb_tags (entry_id, tag) VALUES (?, ?)',
        ['invalid-id', 'test']
      )).rejects.toThrow();
    });

    it('should maintain referential integrity on delete', async () => {
      const entry = await adapter.addEntry({
        ...createTestKBEntry(),
        tags: ['test', 'integrity']
      });

      await adapter.deleteEntry(entry.id!);

      // Tags should be automatically deleted
      const tags = await adapter.query(
        'SELECT COUNT(*) as count FROM kb_tags WHERE entry_id = ?',
        [entry.id]
      );
      expect(tags[0].count).toBe(0);
    });
  });
});