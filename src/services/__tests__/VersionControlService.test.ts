/**
 * Version Control Service Tests
 *
 * Comprehensive test suite for the Version Control Service,
 * covering version creation, rollback, comparison, and merge operations.
 *
 * @author Swarm Architecture Team
 * @version 1.0.0
 */

import { VersionControlService, RollbackOptions } from '../VersionControlService';
import { KBEntry } from '../../database/KnowledgeDB';

// ========================
// Mock Database
// ========================

const mockDB = {
  exec: jest.fn(),
  prepare: jest.fn(() => ({
    run: jest.fn(),
    get: jest.fn(),
    all: jest.fn(),
  })),
  transaction: jest.fn(fn => fn),
  pragma: jest.fn(),
};

// ========================
// Test Data
// ========================

const sampleEntry: KBEntry = {
  id: 'test-entry-1',
  title: 'Test Entry',
  problem: 'Test problem description',
  solution: 'Test solution steps',
  category: 'VSAM',
  tags: ['test', 'vsam', 'example'],
  created_at: new Date('2024-01-01'),
  updated_at: new Date('2024-01-01'),
  usage_count: 10,
  success_count: 8,
  failure_count: 2,
};

const updatedEntry: KBEntry = {
  ...sampleEntry,
  title: 'Updated Test Entry',
  problem: 'Updated problem description',
  solution: 'Updated solution with more details',
  tags: ['test', 'vsam', 'updated'],
  updated_at: new Date('2024-01-02'),
};

// ========================
// Test Suite
// ========================

describe('VersionControlService', () => {
  let service: VersionControlService;
  let mockPreparedStatement: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockPreparedStatement = {
      run: jest.fn().mockReturnValue({ changes: 1 }),
      get: jest.fn(),
      all: jest.fn(),
    };

    mockDB.prepare.mockReturnValue(mockPreparedStatement);
    mockDB.transaction.mockImplementation(fn => fn);

    service = new VersionControlService(mockDB);
  });

  // ========================
  // Initialization Tests
  // ========================

  describe('Initialization', () => {
    it('should initialize database schema', () => {
      expect(mockDB.exec).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS entry_versions')
      );
      expect(mockDB.exec).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS change_records')
      );
      expect(mockDB.exec).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS version_branches')
      );
    });

    it('should create necessary indexes', () => {
      expect(mockDB.exec).toHaveBeenCalledWith(
        expect.stringContaining('CREATE INDEX IF NOT EXISTS idx_entry_versions')
      );
    });

    it('should enable foreign keys', () => {
      expect(mockDB.pragma).toHaveBeenCalledWith('foreign_keys = ON');
    });
  });

  // ========================
  // Version Creation Tests
  // ========================

  describe('Version Creation', () => {
    it('should create first version of entry', async () => {
      mockPreparedStatement.get.mockReturnValue({ max_version: null });

      await service.createVersion(sampleEntry, 'user-1', 'Test User', 'Initial version');

      expect(mockPreparedStatement.run).toHaveBeenCalledWith(
        expect.stringContaining('test-entry-1-v1'),
        'test-entry-1',
        1,
        'Test Entry',
        'Test problem description',
        'Test solution steps',
        'VSAM',
        JSON.stringify(['test', 'vsam', 'example']),
        'user-1',
        'Test User',
        'Initial version',
        JSON.stringify([]),
        null,
        1, // is_current
        expect.any(String) // data_hash
      );
    });

    it('should create subsequent versions', async () => {
      mockPreparedStatement.get.mockReturnValue({ max_version: 1 });

      await service.createVersion(updatedEntry, 'user-1', 'Test User', 'Updated content');

      expect(mockPreparedStatement.run).toHaveBeenCalledWith(
        expect.stringContaining('test-entry-1-v2'),
        'test-entry-1',
        2,
        'Updated Test Entry',
        expect.any(String),
        expect.any(String),
        'VSAM',
        expect.any(String),
        'user-1',
        'Test User',
        'Updated content',
        expect.any(String),
        1, // parent_version
        1, // is_current
        expect.any(String) // data_hash
      );
    });

    it('should detect changed fields automatically', async () => {
      mockPreparedStatement.get.mockReturnValue({ max_version: 1 });

      // Mock getting previous version
      service.getVersionSync = jest.fn().mockReturnValue(sampleEntry);
      service.detectChangedFields = jest
        .fn()
        .mockReturnValue(['title', 'problem', 'solution', 'tags']);

      await service.createVersion(updatedEntry, 'user-1', 'Test User');

      expect(mockPreparedStatement.run).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(Number),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        JSON.stringify(['title', 'problem', 'solution', 'tags']),
        expect.any(Number),
        expect.any(Number),
        expect.any(String)
      );
    });

    it('should create change record', async () => {
      mockPreparedStatement.get.mockReturnValue({ max_version: 1 });

      await service.createVersion(updatedEntry, 'user-1', 'Test User', 'Updated content');

      // Should insert into change_records table
      expect(mockPreparedStatement.run).toHaveBeenCalledWith(
        expect.stringMatching(/^change-test-entry-1-2-\d+$/),
        'test-entry-1',
        2,
        'user-1',
        'Test User',
        'update',
        'Updated content',
        expect.any(String), // changed_fields JSON
        expect.any(String), // new_data JSON
        null // diff_data (since no previous data mocked)
      );
    });
  });

  // ========================
  // Version Retrieval Tests
  // ========================

  describe('Version Retrieval', () => {
    it('should get specific version', async () => {
      const mockVersionData = {
        id: 'test-entry-1',
        entry_id: 'test-entry-1',
        version: 2,
        title: 'Updated Test Entry',
        problem: 'Updated problem',
        solution: 'Updated solution',
        category: 'VSAM',
        tags: JSON.stringify(['test', 'vsam', 'updated']),
        created_at: new Date().toISOString(),
        editor_id: 'user-1',
        editor_name: 'Test User',
        change_summary: 'Updated content',
        changed_fields: JSON.stringify(['title']),
      };

      mockPreparedStatement.get.mockReturnValue(mockVersionData);

      const result = await service.getVersion('test-entry-1', 2);

      expect(result).toEqual({
        id: 'test-entry-1',
        title: 'Updated Test Entry',
        problem: 'Updated problem',
        solution: 'Updated solution',
        category: 'VSAM',
        tags: ['test', 'vsam', 'updated'],
        created_at: expect.any(Date),
        version: 2,
        change_summary: 'Updated content',
        changed_fields: ['title'],
        editor_id: 'user-1',
        editor_name: 'Test User',
      });
    });

    it('should return null for non-existent version', async () => {
      mockPreparedStatement.get.mockReturnValue(null);

      const result = await service.getVersion('test-entry-1', 999);

      expect(result).toBeNull();
    });

    it('should get current version number', async () => {
      mockPreparedStatement.get.mockReturnValue({ max_version: 5 });

      const result = await service.getCurrentVersion('test-entry-1');

      expect(result).toBe(5);
    });

    it('should return 0 for entry with no versions', async () => {
      mockPreparedStatement.get.mockReturnValue({ max_version: null });

      const result = await service.getCurrentVersion('test-entry-1');

      expect(result).toBe(0);
    });
  });

  // ========================
  // Version History Tests
  // ========================

  describe('Version History', () => {
    it('should get complete version history', async () => {
      const mockVersions = [
        { version: 2, title: 'Version 2' },
        { version: 1, title: 'Version 1' },
      ];
      const mockChanges = [
        { version: 2, change_type: 'update' },
        { version: 1, change_type: 'create' },
      ];

      mockPreparedStatement.all
        .mockReturnValueOnce(mockVersions)
        .mockReturnValueOnce(mockChanges)
        .mockReturnValueOnce([]); // branches

      service.parseVersionedEntry = jest.fn().mockReturnValue({ version: 1 });
      service.parseChangeRecord = jest.fn().mockReturnValue({ version: 1 });

      const result = await service.getVersionHistory('test-entry-1');

      expect(result).toEqual({
        entry_id: 'test-entry-1',
        current_version: 2,
        versions: expect.any(Array),
        changes: expect.any(Array),
        branches: undefined,
      });
    });

    it('should use cache for repeated requests', async () => {
      const mockVersions = [{ version: 1 }];
      mockPreparedStatement.all.mockReturnValue(mockVersions);
      service.parseVersionedEntry = jest.fn().mockReturnValue({ version: 1 });
      service.parseChangeRecord = jest.fn().mockReturnValue({ version: 1 });

      // First call
      await service.getVersionHistory('test-entry-1');

      // Second call
      await service.getVersionHistory('test-entry-1');

      // Should only query database once
      expect(mockPreparedStatement.all).toHaveBeenCalledTimes(3); // versions, changes, branches
    });
  });

  // ========================
  // Version Comparison Tests
  // ========================

  describe('Version Comparison', () => {
    beforeEach(() => {
      service.getVersion = jest
        .fn()
        .mockResolvedValueOnce(sampleEntry)
        .mockResolvedValueOnce(updatedEntry);
    });

    it('should compare two versions', async () => {
      const result = await service.compareVersions('test-entry-1', 1, 2);

      expect(result).toEqual({
        differences: expect.any(Array),
        similarity_score: expect.any(Number),
        change_summary: expect.any(String),
        impact_assessment: expect.oneOf(['low', 'medium', 'high']),
      });
    });

    it('should detect field differences', async () => {
      const result = await service.compareVersions('test-entry-1', 1, 2);

      expect(result.differences).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'title',
            operation: 'changed',
            old_value: 'Test Entry',
            new_value: 'Updated Test Entry',
          }),
        ])
      );
    });

    it('should calculate similarity score', async () => {
      const result = await service.compareVersions('test-entry-1', 1, 2);

      expect(result.similarity_score).toBeGreaterThanOrEqual(0);
      expect(result.similarity_score).toBeLessThanOrEqual(1);
    });

    it('should assess change impact', async () => {
      const result = await service.compareVersions('test-entry-1', 1, 2);

      expect(['low', 'medium', 'high']).toContain(result.impact_assessment);
    });
  });

  // ========================
  // Rollback Tests
  // ========================

  describe('Version Rollback', () => {
    const rollbackOptions: RollbackOptions = {
      target_version: 1,
      create_backup: true,
      merge_strategy: 'overwrite',
      change_summary: 'Rollback to version 1',
    };

    beforeEach(() => {
      service.getVersion = jest.fn().mockResolvedValue(sampleEntry);
      service.getCurrentVersion = jest.fn().mockResolvedValue(2);
      service.createVersion = jest.fn().mockResolvedValue({
        ...sampleEntry,
        version: 3,
      });
    });

    it('should rollback to target version', async () => {
      const result = await service.rollbackToVersion(
        'test-entry-1',
        1,
        'user-1',
        'Test User',
        rollbackOptions
      );

      expect(service.getVersion).toHaveBeenCalledWith('test-entry-1', 1);
      expect(service.createVersion).toHaveBeenCalledWith(
        expect.objectContaining(sampleEntry),
        'user-1',
        'Test User',
        'Rollback to version 1',
        expect.any(Array)
      );
    });

    it('should handle overwrite merge strategy', async () => {
      await service.rollbackToVersion('test-entry-1', 1, 'user-1', 'Test User', {
        ...rollbackOptions,
        merge_strategy: 'overwrite',
      });

      expect(service.createVersion).toHaveBeenCalledWith(
        expect.objectContaining({
          title: sampleEntry.title,
          problem: sampleEntry.problem,
          solution: sampleEntry.solution,
        }),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(Array)
      );
    });

    it('should record rollback in change history', async () => {
      await service.rollbackToVersion('test-entry-1', 1, 'user-1', 'Test User', rollbackOptions);

      // Should insert rollback record
      expect(mockPreparedStatement.run).toHaveBeenCalledWith(
        expect.stringMatching(/^rollback-test-entry-1-3-\d+$/),
        'test-entry-1',
        3,
        'user-1',
        'Test User',
        'restore',
        'Rolled back to version 1',
        JSON.stringify(['rollback_operation']),
        JSON.stringify(rollbackOptions)
      );
    });

    it('should throw error for non-existent target version', async () => {
      service.getVersion = jest.fn().mockResolvedValue(null);

      await expect(
        service.rollbackToVersion('test-entry-1', 999, 'user-1', 'Test User', rollbackOptions)
      ).rejects.toThrow('Version 999 not found');
    });
  });

  // ========================
  // Merge Tests
  // ========================

  describe('Version Merging', () => {
    const baseEntry = sampleEntry;
    const versionA = { ...sampleEntry, title: 'Version A Title' };
    const versionB = { ...sampleEntry, problem: 'Version B Problem' };

    it('should merge non-conflicting changes', async () => {
      const result = await service.mergeVersions(baseEntry, versionA, versionB);

      expect(result.success).toBe(true);
      expect(result.merged_entry).toEqual({
        ...baseEntry,
        title: 'Version A Title',
        problem: 'Version B Problem',
      });
    });

    it('should detect conflicts', async () => {
      const conflictingVersionA = { ...sampleEntry, title: 'Title A' };
      const conflictingVersionB = { ...sampleEntry, title: 'Title B' };

      const result = await service.mergeVersions(
        baseEntry,
        conflictingVersionA,
        conflictingVersionB
      );

      expect(result.success).toBe(false);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts![0]).toEqual({
        field: 'title',
        base_value: baseEntry.title,
        version_a: 'Title A',
        version_b: 'Title B',
        resolution_required: true,
        suggested_resolution: expect.any(String),
      });
    });

    it('should merge tags arrays', async () => {
      const versionA = { ...sampleEntry, tags: ['test', 'vsam', 'new-tag'] };
      const versionB = { ...sampleEntry, tags: ['test', 'vsam', 'another-tag'] };

      const result = await service.mergeVersions(baseEntry, versionA, versionB);

      expect(result.success).toBe(true);
      expect(result.merged_entry?.tags).toEqual(
        expect.arrayContaining(['test', 'vsam', 'new-tag', 'another-tag'])
      );
    });
  });

  // ========================
  // Utility Tests
  // ========================

  describe('Utility Methods', () => {
    it('should detect changed fields', () => {
      const changedFields = service.detectChangedFields(sampleEntry, updatedEntry);

      expect(changedFields).toContain('title');
      expect(changedFields).toContain('problem');
      expect(changedFields).toContain('solution');
      expect(changedFields).toContain('tags');
    });

    it('should generate consistent data hash', () => {
      const hash1 = service.generateDataHash(sampleEntry);
      const hash2 = service.generateDataHash(sampleEntry);
      const hash3 = service.generateDataHash(updatedEntry);

      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe(hash3);
    });

    it('should get recent changes', async () => {
      const mockChanges = [
        { id: 'change-1', timestamp: new Date().toISOString() },
        { id: 'change-2', timestamp: new Date().toISOString() },
      ];

      mockPreparedStatement.all.mockReturnValue(mockChanges);
      service.parseChangeRecord = jest.fn().mockReturnValue({ id: 'change-1' });

      const result = await service.getRecentChanges(10);

      expect(result).toHaveLength(2);
      expect(mockPreparedStatement.all).toHaveBeenCalledWith(10);
    });
  });

  // ========================
  // Error Handling Tests
  // ========================

  describe('Error Handling', () => {
    it('should handle database errors during version creation', async () => {
      mockPreparedStatement.run.mockImplementation(() => {
        throw new Error('Database error');
      });

      await expect(service.createVersion(sampleEntry, 'user-1', 'Test User')).rejects.toThrow(
        'Database error'
      );
    });

    it('should handle transaction rollback', async () => {
      mockDB.transaction.mockImplementation(fn => {
        throw new Error('Transaction failed');
      });

      await expect(service.createVersion(sampleEntry, 'user-1', 'Test User')).rejects.toThrow(
        'Transaction failed'
      );
    });

    it('should handle corrupted version data', async () => {
      mockPreparedStatement.get.mockReturnValue({
        tags: 'invalid-json',
        changed_fields: 'invalid-json',
      });

      const result = await service.getVersion('test-entry-1', 1);

      // Should handle invalid JSON gracefully
      expect(result?.tags).toEqual([]);
      expect(result?.changed_fields).toEqual([]);
    });
  });

  // ========================
  // Cleanup Tests
  // ========================

  describe('Cleanup', () => {
    it('should cleanup old versions', async () => {
      mockPreparedStatement.get.mockReturnValue({ count: 100 });

      await service.cleanupOldVersions('test-entry-1');

      expect(mockPreparedStatement.run).toHaveBeenCalledWith(
        'test-entry-1',
        'test-entry-1',
        50 // should delete 50 versions (100 - 50 max)
      );
    });

    it('should cleanup old change records', async () => {
      mockPreparedStatement.run.mockReturnValue({ changes: 25 });

      await service.cleanup();

      expect(mockPreparedStatement.run).toHaveBeenCalledWith(
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}/) // ISO date string
      );
    });

    it('should dispose resources properly', () => {
      const clearSpy = jest.spyOn(service.cache, 'clear');
      const removeListenersSpy = jest.spyOn(service, 'removeAllListeners');

      service.dispose();

      expect(clearSpy).toHaveBeenCalled();
      expect(removeListenersSpy).toHaveBeenCalled();
    });
  });
});
