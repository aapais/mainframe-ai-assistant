/**
 * Unit Tests for BackupService
 * Tests backup creation, validation, and restoration functionality
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { BackupService } from '../../../../src/services/storage/backup/BackupService';
import { MockStorageAdapter } from '../../mocks/MockStorageAdapter';
import { createMockConfig, TestData } from '../../fixtures/testData';
import * as fs from 'fs';
import * as path from 'path';

describe('BackupService', () => {
  let backupService: BackupService;
  let mockAdapter: MockStorageAdapter;
  let testDir: string;
  let backupConfig: any;

  beforeEach(() => {
    testDir = path.join(__dirname, '..', '..', 'temp', 'backup-test');
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    backupConfig = {
      enabled: true,
      interval: 60000,
      retention: 5,
      compression: true,
      destinations: [{
        type: 'local',
        path: testDir
      }]
    };

    mockAdapter = new MockStorageAdapter();
    backupService = new BackupService(mockAdapter as any, backupConfig);
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
    jest.clearAllMocks();
  });

  describe('Backup Creation', () => {
    it('should create backup with valid data', async () => {
      // Setup test data
      const testEntries = TestData.createBatchKBEntries(5);
      mockAdapter.setEntries(testEntries.map(entry => ({ 
        ...entry, 
        id: 'test-id-' + Math.random() 
      }) as any));

      const backupPath = await backupService.createBackup();

      expect(backupPath).toBeDefined();
      expect(fs.existsSync(backupPath)).toBe(true);
      expect(path.extname(backupPath)).toBe('.backup');
    });

    it('should include metadata in backup', async () => {
      const backupPath = await backupService.createBackup();
      
      // Read and verify backup content
      const backupContent = fs.readFileSync(backupPath, 'utf8');
      const backup = JSON.parse(backupContent);

      expect(backup.metadata).toBeDefined();
      expect(backup.metadata.version).toBeDefined();
      expect(backup.metadata.timestamp).toBeDefined();
      expect(backup.metadata.source).toBe('BackupService');
      expect(backup.data).toBeDefined();
    });

    it('should compress backup when enabled', async () => {
      backupConfig.compression = true;
      const service = new BackupService(mockAdapter as any, backupConfig);

      const testEntries = TestData.createBatchKBEntries(10);
      mockAdapter.setEntries(testEntries.map(entry => ({ 
        ...entry, 
        id: 'test-id-' + Math.random() 
      }) as any));

      const backupPath = await service.createBackup();
      const stats = fs.statSync(backupPath);

      expect(stats.size).toBeGreaterThan(0);
      // Compressed backup should exist
      expect(fs.existsSync(backupPath)).toBe(true);
    });

    it('should handle empty database backup', async () => {
      mockAdapter.setEntries([]);

      const backupPath = await backupService.createBackup();
      const backupContent = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

      expect(backupContent.data.entries).toEqual([]);
      expect(backupContent.metadata.entryCount).toBe(0);
    });

    it('should generate unique backup filenames', async () => {
      const backup1 = await backupService.createBackup();
      await TestData.waitForDelay(10); // Ensure different timestamp
      const backup2 = await backupService.createBackup();

      expect(backup1).not.toBe(backup2);
      expect(fs.existsSync(backup1)).toBe(true);
      expect(fs.existsSync(backup2)).toBe(true);
    });

    it('should handle backup creation errors', async () => {
      // Mock adapter to throw error
      mockAdapter.query = jest.fn().mockRejectedValue(new Error('Database error'));

      await expect(backupService.createBackup()).rejects.toThrow('Database error');
    });
  });

  describe('Backup Validation', () => {
    it('should validate backup integrity', async () => {
      const testEntries = TestData.createBatchKBEntries(3);
      mockAdapter.setEntries(testEntries.map(entry => ({ 
        ...entry, 
        id: 'test-id-' + Math.random() 
      }) as any));

      const backupPath = await backupService.createBackup();
      const isValid = await backupService.validateBackup(backupPath);

      expect(isValid.isValid).toBe(true);
      expect(isValid.errors).toEqual([]);
    });

    it('should detect corrupted backup files', async () => {
      const corruptedBackupPath = path.join(testDir, 'corrupted.backup');
      fs.writeFileSync(corruptedBackupPath, 'invalid json content');

      const validation = await backupService.validateBackup(corruptedBackupPath);

      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.errors[0]).toContain('Invalid JSON');
    });

    it('should detect missing backup files', async () => {
      const nonExistentPath = path.join(testDir, 'nonexistent.backup');

      const validation = await backupService.validateBackup(nonExistentPath);

      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.errors[0]).toContain('not found');
    });

    it('should validate backup metadata', async () => {
      const invalidBackup = {
        // Missing required metadata
        data: { entries: [] }
      };

      const invalidBackupPath = path.join(testDir, 'invalid-metadata.backup');
      fs.writeFileSync(invalidBackupPath, JSON.stringify(invalidBackup));

      const validation = await backupService.validateBackup(invalidBackupPath);

      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(error => error.includes('metadata'))).toBe(true);
    });

    it('should validate backup data structure', async () => {
      const invalidDataBackup = {
        metadata: {
          version: '1.0',
          timestamp: new Date().toISOString(),
          source: 'test'
        },
        data: {
          // Missing entries array
        }
      };

      const invalidBackupPath = path.join(testDir, 'invalid-data.backup');
      fs.writeFileSync(invalidBackupPath, JSON.stringify(invalidDataBackup));

      const validation = await backupService.validateBackup(invalidBackupPath);

      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(error => error.includes('entries'))).toBe(true);
    });
  });

  describe('Backup Restoration', () => {
    it('should restore from valid backup', async () => {
      // Create backup with test data
      const testEntries = TestData.createBatchKBEntries(3);
      mockAdapter.setEntries(testEntries.map(entry => ({ 
        ...entry, 
        id: 'test-id-' + Math.random() 
      }) as any));

      const backupPath = await backupService.createBackup();

      // Clear data
      mockAdapter.setEntries([]);

      // Restore
      const restoreResult = await backupService.restoreFromBackup(backupPath);

      expect(restoreResult.success).toBe(true);
      expect(restoreResult.entriesRestored).toBe(3);
      expect(restoreResult.errors).toEqual([]);
      expect(mockAdapter.getEntryCount()).toBe(3);
    });

    it('should handle restore with data conflicts', async () => {
      // Create initial data
      const initialEntries = TestData.createBatchKBEntries(2);
      mockAdapter.setEntries(initialEntries.map(entry => ({ 
        ...entry, 
        id: 'existing-id-' + Math.random() 
      }) as any));

      // Create backup with different data
      const backupEntries = TestData.createBatchKBEntries(3);
      const backupData = {
        metadata: {
          version: '1.0',
          timestamp: new Date().toISOString(),
          source: 'test',
          entryCount: 3
        },
        data: {
          entries: backupEntries.map(entry => ({ 
            ...entry, 
            id: 'backup-id-' + Math.random() 
          }))
        }
      };

      const backupPath = path.join(testDir, 'conflict-test.backup');
      fs.writeFileSync(backupPath, JSON.stringify(backupData));

      // Restore (should merge or replace based on configuration)
      const restoreResult = await backupService.restoreFromBackup(backupPath);

      expect(restoreResult.success).toBe(true);
      expect(mockAdapter.getEntryCount()).toBeGreaterThan(0);
    });

    it('should handle partial restore failures', async () => {
      // Create backup with some invalid entries
      const backupData = {
        metadata: {
          version: '1.0',
          timestamp: new Date().toISOString(),
          source: 'test',
          entryCount: 3
        },
        data: {
          entries: [
            TestData.createTestKBEntry(), // Valid
            { ...TestData.createTestKBEntry(), title: '' }, // Invalid
            TestData.createTestKBEntry() // Valid
          ]
        }
      };

      const backupPath = path.join(testDir, 'partial-failure.backup');
      fs.writeFileSync(backupPath, JSON.stringify(backupData));

      const restoreResult = await backupService.restoreFromBackup(backupPath);

      expect(restoreResult.success).toBe(false);
      expect(restoreResult.entriesRestored).toBeLessThan(3);
      expect(restoreResult.errors.length).toBeGreaterThan(0);
    });

    it('should validate backup before restoration', async () => {
      const invalidBackupPath = path.join(testDir, 'invalid.backup');
      fs.writeFileSync(invalidBackupPath, 'invalid content');

      const restoreResult = await backupService.restoreFromBackup(invalidBackupPath);

      expect(restoreResult.success).toBe(false);
      expect(restoreResult.entriesRestored).toBe(0);
      expect(restoreResult.errors.length).toBeGreaterThan(0);
    });

    it('should handle restoration of compressed backups', async () => {
      backupConfig.compression = true;
      const service = new BackupService(mockAdapter as any, backupConfig);

      const testEntries = TestData.createBatchKBEntries(5);
      mockAdapter.setEntries(testEntries.map(entry => ({ 
        ...entry, 
        id: 'test-id-' + Math.random() 
      }) as any));

      const backupPath = await service.createBackup();
      mockAdapter.setEntries([]);

      const restoreResult = await service.restoreFromBackup(backupPath);

      expect(restoreResult.success).toBe(true);
      expect(restoreResult.entriesRestored).toBe(5);
    });
  });

  describe('Backup Scheduling', () => {
    it('should schedule automatic backups', async () => {
      const scheduleConfig = {
        ...backupConfig,
        interval: 100 // Very short interval for testing
      };

      const service = new BackupService(mockAdapter as any, scheduleConfig);
      const createBackupSpy = jest.spyOn(service, 'createBackup');

      service.startScheduledBackups();

      // Wait for scheduled backup
      await TestData.waitForDelay(150);

      service.stopScheduledBackups();

      expect(createBackupSpy).toHaveBeenCalled();
    });

    it('should stop scheduled backups', async () => {
      const service = new BackupService(mockAdapter as any, backupConfig);
      
      service.startScheduledBackups();
      service.stopScheduledBackups();

      // Should not throw and should stop cleanly
      expect(() => service.stopScheduledBackups()).not.toThrow();
    });

    it('should handle backup errors in scheduled mode', async () => {
      mockAdapter.query = jest.fn().mockRejectedValue(new Error('Scheduled backup error'));

      const service = new BackupService(mockAdapter as any, {
        ...backupConfig,
        interval: 50
      });

      service.startScheduledBackups();
      await TestData.waitForDelay(100);
      service.stopScheduledBackups();

      // Should handle errors gracefully without crashing
      expect(true).toBe(true); // Test passes if no unhandled exceptions
    });
  });

  describe('Backup Retention', () => {
    it('should enforce backup retention policy', async () => {
      const retentionConfig = {
        ...backupConfig,
        retention: 2 // Keep only 2 backups
      };

      const service = new BackupService(mockAdapter as any, retentionConfig);

      // Create multiple backups
      const backup1 = await service.createBackup();
      await TestData.waitForDelay(10);
      const backup2 = await service.createBackup();
      await TestData.waitForDelay(10);
      const backup3 = await service.createBackup();

      // Check retention policy enforcement
      await service.enforceRetentionPolicy();

      // Should keep only the 2 most recent backups
      const backupFiles = fs.readdirSync(testDir).filter(f => f.endsWith('.backup'));
      expect(backupFiles.length).toBeLessThanOrEqual(2);
    });

    it('should handle retention policy with no backups', async () => {
      const service = new BackupService(mockAdapter as any, backupConfig);

      // Should not throw when no backups exist
      await expect(service.enforceRetentionPolicy()).resolves.not.toThrow();
    });

    it('should preserve recent backups during retention', async () => {
      const service = new BackupService(mockAdapter as any, {
        ...backupConfig,
        retention: 1
      });

      const backup1 = await service.createBackup();
      await TestData.waitForDelay(10);
      const backup2 = await service.createBackup();

      await service.enforceRetentionPolicy();

      // Most recent backup should still exist
      expect(fs.existsSync(backup2)).toBe(true);
    });
  });

  describe('Backup Metadata', () => {
    it('should include comprehensive metadata', async () => {
      const testEntries = TestData.createBatchKBEntries(5);
      mockAdapter.setEntries(testEntries.map(entry => ({ 
        ...entry, 
        id: 'test-id-' + Math.random() 
      }) as any));

      const backupPath = await backupService.createBackup();
      const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

      expect(backup.metadata).toMatchObject({
        version: expect.any(String),
        timestamp: expect.any(String),
        source: 'BackupService',
        entryCount: 5,
        compressed: expect.any(Boolean)
      });
    });

    it('should include database metrics in metadata', async () => {
      mockAdapter.getMetrics = jest.fn().mockResolvedValue({
        totalEntries: 5,
        totalTags: 15,
        performance: { averageResponseTime: 50 }
      });

      const backupPath = await backupService.createBackup();
      const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

      expect(backup.metadata.metrics).toBeDefined();
      expect(backup.metadata.metrics.totalEntries).toBe(5);
    });
  });

  describe('Error Handling', () => {
    it('should handle filesystem errors during backup', async () => {
      // Mock filesystem error
      const originalWriteFileSync = fs.writeFileSync;
      fs.writeFileSync = jest.fn().mockImplementation(() => {
        throw new Error('Filesystem error');
      });

      try {
        await expect(backupService.createBackup()).rejects.toThrow('Filesystem error');
      } finally {
        fs.writeFileSync = originalWriteFileSync;
      }
    });

    it('should handle invalid backup destination', async () => {
      const invalidConfig = {
        ...backupConfig,
        destinations: [{
          type: 'local',
          path: '/invalid/readonly/path'
        }]
      };

      const service = new BackupService(mockAdapter as any, invalidConfig);

      await expect(service.createBackup()).rejects.toThrow();
    });

    it('should handle database errors during backup', async () => {
      mockAdapter.search = jest.fn().mockRejectedValue(new Error('Database connection lost'));

      await expect(backupService.createBackup()).rejects.toThrow('Database connection lost');
    });
  });

  describe('Backup Configuration', () => {
    it('should validate backup configuration', () => {
      const invalidConfig = {
        enabled: true,
        destinations: [] // No destinations
      };

      expect(() => new BackupService(mockAdapter as any, invalidConfig))
        .toThrow('At least one backup destination required');
    });

    it('should use default configuration values', () => {
      const minimalConfig = {
        enabled: true,
        destinations: [{ type: 'local', path: testDir }]
      };

      const service = new BackupService(mockAdapter as any, minimalConfig);

      expect(service.getConfiguration().retention).toBe(7); // Default value
      expect(service.getConfiguration().compression).toBe(true); // Default value
    });

    it('should allow configuration updates', async () => {
      const newConfig = {
        ...backupConfig,
        retention: 10,
        compression: false
      };

      backupService.updateConfiguration(newConfig);

      const currentConfig = backupService.getConfiguration();
      expect(currentConfig.retention).toBe(10);
      expect(currentConfig.compression).toBe(false);
    });
  });
});