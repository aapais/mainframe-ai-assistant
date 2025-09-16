/**
 * Disaster Recovery Reliability Tests
 * Tests backup, restore, failover, and disaster recovery scenarios
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import { DatabaseManager } from '../../src/database/DatabaseManager';
import { KnowledgeDB, KBEntry } from '../../src/database/KnowledgeDB';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

// Disaster Recovery Manager - simulates DR scenarios
class DisasterRecoveryManager {
  private backupPaths: string[] = [];
  private primaryDbPath: string;
  private secondaryDbPath: string;

  constructor(primaryPath: string, secondaryPath: string) {
    this.primaryDbPath = primaryPath;
    this.secondaryDbPath = secondaryPath;
  }

  async createBackup(sourcePath: string, backupPath: string): Promise<void> {
    await fs.copyFile(sourcePath, backupPath);
    this.backupPaths.push(backupPath);
  }

  async simulateDataCorruption(dbPath: string): Promise<void> {
    // Simulate data corruption by truncating file
    const handle = await fs.open(dbPath, 'r+');
    await handle.truncate(100); // Corrupt by keeping only first 100 bytes
    await handle.close();
  }

  async simulateNetworkPartition(): Promise<void> {
    // Simulate network partition (in real scenario, this would affect connections)
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  async simulateHardwareFailure(dbPath: string): Promise<void> {
    // Simulate hardware failure by making file inaccessible
    try {
      await fs.chmod(dbPath, 0o000); // Remove all permissions
    } catch (error) {
      // On some systems, we might not be able to change permissions
      // In that case, just delete the file
      await fs.unlink(dbPath);
    }
  }

  async restoreFromBackup(backupPath: string, targetPath: string): Promise<void> {
    await fs.copyFile(backupPath, targetPath);
  }

  async setupReplication(primaryPath: string, secondaryPath: string): Promise<void> {
    // Simple file-based replication simulation
    await fs.copyFile(primaryPath, secondaryPath);
  }

  async cleanup(): Promise<void> {
    for (const backupPath of this.backupPaths) {
      try {
        await fs.unlink(backupPath);
      } catch (error) {
        // Ignore errors during cleanup
      }
    }
    this.backupPaths = [];
  }

  getBackupPaths(): string[] {
    return [...this.backupPaths];
  }
}

describe('Disaster Recovery Tests', () => {
  let testDbPath: string;
  let backupDbPath: string;
  let secondaryDbPath: string;
  let tempDir: string;
  let dbManager: DatabaseManager;
  let knowledgeDB: KnowledgeDB;
  let drManager: DisasterRecoveryManager;

  // Recovery time objectives
  const MAX_BACKUP_TIME_SECONDS = 30;
  const MAX_RESTORE_TIME_SECONDS = 60;
  const MAX_FAILOVER_TIME_SECONDS = 10;
  const BACKUP_RETENTION_DAYS = 7;

  const SAMPLE_ENTRIES: KBEntry[] = [
    {
      title: 'DR Test Entry 1',
      problem: 'Disaster recovery test problem 1',
      solution: 'DR test solution 1 with detailed steps',
      category: 'VSAM',
      tags: ['dr-test', 'backup', 'critical']
    },
    {
      title: 'DR Test Entry 2',
      problem: 'Disaster recovery test problem 2',
      solution: 'DR test solution 2 with recovery procedures',
      category: 'JCL',
      tags: ['dr-test', 'recovery', 'important']
    },
    {
      title: 'DR Test Entry 3',
      problem: 'Disaster recovery test problem 3',
      solution: 'DR test solution 3 with failover steps',
      category: 'DB2',
      tags: ['dr-test', 'failover', 'business-critical']
    }
  ];

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(__dirname, 'temp-dr-'));
    testDbPath = path.join(tempDir, 'primary.db');
    backupDbPath = path.join(tempDir, 'backup.db');
    secondaryDbPath = path.join(tempDir, 'secondary.db');
  });

  beforeEach(async () => {
    // Clean start
    await Promise.all([
      fs.unlink(testDbPath).catch(() => {}),
      fs.unlink(backupDbPath).catch(() => {}),
      fs.unlink(secondaryDbPath).catch(() => {})
    ]);

    dbManager = new DatabaseManager(testDbPath);
    await dbManager.initialize();
    knowledgeDB = new KnowledgeDB(testDbPath);
    drManager = new DisasterRecoveryManager(testDbPath, secondaryDbPath);

    // Add sample data
    for (const entry of SAMPLE_ENTRIES) {
      await knowledgeDB.addEntry(entry);
    }
  });

  afterEach(async () => {
    if (knowledgeDB) {
      await knowledgeDB.close();
    }
    if (dbManager) {
      await dbManager.close();
    }
    if (drManager) {
      await drManager.cleanup();
    }
  });

  afterAll(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Cleanup failed:', error);
    }
  });

  describe('Backup and Restore', () => {
    it('should create consistent point-in-time backups', async () => {
      const backupStartTime = Date.now();
      
      // Create backup while system is active
      const backupPromise = drManager.createBackup(testDbPath, backupDbPath);
      
      // Continue operations during backup
      const operationsPromise = (async () => {
        for (let i = 0; i < 10; i++) {
          await knowledgeDB.addEntry({
            title: `Backup Test Entry ${i}`,
            problem: `Problem during backup ${i}`,
            solution: `Solution during backup ${i}`,
            category: 'Other',
            tags: [`backup-test-${i}`]
          });
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      })();

      await Promise.all([backupPromise, operationsPromise]);
      
      const backupTime = (Date.now() - backupStartTime) / 1000;
      console.log(`Backup completed in ${backupTime.toFixed(2)} seconds`);
      
      expect(backupTime).toBeLessThan(MAX_BACKUP_TIME_SECONDS);

      // Verify backup file exists and is readable
      const backupStats = await fs.stat(backupDbPath);
      expect(backupStats.size).toBeGreaterThan(0);

      // Verify backup integrity
      const backupDb = new KnowledgeDB(backupDbPath);
      try {
        const backupEntries = await backupDb.getAllEntries();
        
        // Should have at least the original sample entries
        expect(backupEntries.length).toBeGreaterThanOrEqual(SAMPLE_ENTRIES.length);
        
        // Verify original entries are present
        const originalTitles = SAMPLE_ENTRIES.map(e => e.title);
        const backupTitles = backupEntries.map(e => e.title);
        originalTitles.forEach(title => {
          expect(backupTitles).toContain(title);
        });
      } finally {
        await backupDb.close();
      }
    });

    it('should restore database from backup successfully', async () => {
      // Create backup
      await drManager.createBackup(testDbPath, backupDbPath);
      
      // Make changes after backup
      await knowledgeDB.addEntry({
        title: 'Post-backup Entry',
        problem: 'This should not appear after restore',
        solution: 'This will be lost',
        category: 'Other',
        tags: ['post-backup']
      });

      // Verify post-backup data exists
      let currentEntries = await knowledgeDB.getAllEntries();
      expect(currentEntries.some(e => e.title === 'Post-backup Entry')).toBe(true);

      // Close current database
      await knowledgeDB.close();
      await dbManager.close();

      // Simulate disaster and restore
      const restoreStartTime = Date.now();
      await drManager.restoreFromBackup(backupDbPath, testDbPath);
      const restoreTime = (Date.now() - restoreStartTime) / 1000;

      console.log(`Restore completed in ${restoreTime.toFixed(2)} seconds`);
      expect(restoreTime).toBeLessThan(MAX_RESTORE_TIME_SECONDS);

      // Verify restored database
      dbManager = new DatabaseManager(testDbPath);
      await dbManager.initialize();
      knowledgeDB = new KnowledgeDB(testDbPath);

      const restoredEntries = await knowledgeDB.getAllEntries();
      
      // Should have original entries
      expect(restoredEntries.length).toBe(SAMPLE_ENTRIES.length);
      
      // Should NOT have post-backup entry
      expect(restoredEntries.some(e => e.title === 'Post-backup Entry')).toBe(false);
      
      // Verify data integrity of restored entries
      const restoredTitles = restoredEntries.map(e => e.title).sort();
      const originalTitles = SAMPLE_ENTRIES.map(e => e.title).sort();
      expect(restoredTitles).toEqual(originalTitles);
    });

    it('should handle incremental backup and restore', async () => {
      // Create initial full backup
      const fullBackupPath = path.join(tempDir, 'full-backup.db');
      await drManager.createBackup(testDbPath, fullBackupPath);

      // Add more data (simulate incremental changes)
      const incrementalEntries: KBEntry[] = [
        {
          title: 'Incremental Entry 1',
          problem: 'Added after full backup',
          solution: 'Should be in incremental backup',
          category: 'VSAM',
          tags: ['incremental']
        },
        {
          title: 'Incremental Entry 2',
          problem: 'Another incremental change',
          solution: 'Should also be backed up',
          category: 'JCL',
          tags: ['incremental']
        }
      ];

      for (const entry of incrementalEntries) {
        await knowledgeDB.addEntry(entry);
      }

      // Create incremental backup (in this case, full backup with all data)
      const incrementalBackupPath = path.join(tempDir, 'incremental-backup.db');
      await drManager.createBackup(testDbPath, incrementalBackupPath);

      // Verify incremental backup has all data
      const incrementalDb = new KnowledgeDB(incrementalBackupPath);
      try {
        const allBackedUpEntries = await incrementalDb.getAllEntries();
        expect(allBackedUpEntries.length).toBe(SAMPLE_ENTRIES.length + incrementalEntries.length);
        
        // Verify incremental entries are present
        const incrementalTitles = incrementalEntries.map(e => e.title);
        const backedUpTitles = allBackedUpEntries.map(e => e.title);
        incrementalTitles.forEach(title => {
          expect(backedUpTitles).toContain(title);
        });
      } finally {
        await incrementalDb.close();
      }

      // Test restore from incremental backup
      await knowledgeDB.close();
      await dbManager.close();

      await drManager.restoreFromBackup(incrementalBackupPath, testDbPath);

      dbManager = new DatabaseManager(testDbPath);
      await dbManager.initialize();
      knowledgeDB = new KnowledgeDB(testDbPath);

      const restoredEntries = await knowledgeDB.getAllEntries();
      expect(restoredEntries.length).toBe(SAMPLE_ENTRIES.length + incrementalEntries.length);
    });

    it('should validate backup integrity', async () => {
      // Create backup
      await drManager.createBackup(testDbPath, backupDbPath);

      // Verify backup can be opened and read
      const backupDb = new KnowledgeDB(backupDbPath);
      let backupValid = false;
      
      try {
        // Test various operations on backup
        const entries = await backupDb.getAllEntries();
        expect(entries.length).toBeGreaterThan(0);
        
        const searchResults = await backupDb.search('DR Test');
        expect(searchResults.length).toBeGreaterThan(0);
        
        // Verify specific entry integrity
        const firstEntry = entries[0];
        const retrievedEntry = await backupDb.getEntry(firstEntry.id!);
        expect(retrievedEntry).toBeTruthy();
        expect(retrievedEntry?.title).toBe(firstEntry.title);
        
        backupValid = true;
      } finally {
        await backupDb.close();
      }
      
      expect(backupValid).toBe(true);
    });

    it('should handle backup rotation and retention', async () => {
      const backupPaths: string[] = [];
      
      // Simulate multiple days of backups
      for (let day = 1; day <= 10; day++) {
        const dailyBackupPath = path.join(tempDir, `backup-day-${day}.db`);
        await drManager.createBackup(testDbPath, dailyBackupPath);
        backupPaths.push(dailyBackupPath);
        
        // Add some data for next day
        await knowledgeDB.addEntry({
          title: `Daily Entry ${day}`,
          problem: `Problem for day ${day}`,
          solution: `Solution for day ${day}`,
          category: 'Other',
          tags: [`day-${day}`]
        });
      }

      // Verify all backups exist
      for (const backupPath of backupPaths) {
        const stats = await fs.stat(backupPath);
        expect(stats.size).toBeGreaterThan(0);
      }

      // Simulate backup retention policy (keep only last 7 days)
      const cutoffDate = Date.now() - (BACKUP_RETENTION_DAYS * 24 * 60 * 60 * 1000);
      const backupsToDelete = backupPaths.slice(0, 3); // First 3 are "old"
      
      for (const oldBackup of backupsToDelete) {
        await fs.unlink(oldBackup);
      }

      // Verify old backups are deleted
      for (const deletedBackup of backupsToDelete) {
        await expect(fs.stat(deletedBackup)).rejects.toThrow();
      }

      // Verify recent backups still exist
      const recentBackups = backupPaths.slice(3);
      for (const recentBackup of recentBackups) {
        const stats = await fs.stat(recentBackup);
        expect(stats.size).toBeGreaterThan(0);
      }
    });
  });

  describe('Data Corruption Recovery', () => {
    it('should detect and recover from data corruption', async () => {
      // Create backup before corruption
      await drManager.createBackup(testDbPath, backupDbPath);
      
      // Close database connections
      await knowledgeDB.close();
      await dbManager.close();

      // Simulate data corruption
      await drManager.simulateDataCorruption(testDbPath);

      // Try to open corrupted database
      let corruptionDetected = false;
      try {
        const corruptedDbManager = new DatabaseManager(testDbPath);
        await corruptedDbManager.initialize();
        const corruptedKnowledgeDB = new KnowledgeDB(testDbPath);
        
        // This should fail or return incomplete data
        await corruptedKnowledgeDB.getAllEntries();
        await corruptedKnowledgeDB.close();
        await corruptedDbManager.close();
      } catch (error) {
        corruptionDetected = true;
        console.log('Data corruption detected:', (error as Error).message);
      }

      expect(corruptionDetected).toBe(true);

      // Recover from backup
      await drManager.restoreFromBackup(backupDbPath, testDbPath);

      // Verify recovery
      dbManager = new DatabaseManager(testDbPath);
      await dbManager.initialize();
      knowledgeDB = new KnowledgeDB(testDbPath);

      const recoveredEntries = await knowledgeDB.getAllEntries();
      expect(recoveredEntries.length).toBe(SAMPLE_ENTRIES.length);
      
      // Verify data integrity
      const recoveredTitles = recoveredEntries.map(e => e.title).sort();
      const originalTitles = SAMPLE_ENTRIES.map(e => e.title).sort();
      expect(recoveredTitles).toEqual(originalTitles);
    });

    it('should handle partial data corruption', async () => {
      // Create backup
      await drManager.createBackup(testDbPath, backupDbPath);

      // Add more data
      const additionalEntries: string[] = [];
      for (let i = 0; i < 10; i++) {
        const id = await knowledgeDB.addEntry({
          title: `Additional Entry ${i}`,
          problem: `Additional problem ${i}`,
          solution: `Additional solution ${i}`,
          category: 'Other',
          tags: [`additional-${i}`]
        });
        additionalEntries.push(id);
      }

      // Simulate partial corruption (e.g., corruption of recent data)
      // In a real scenario, this might affect only certain pages or records
      // For simulation, we'll delete some recent entries
      for (let i = 0; i < 5; i++) {
        try {
          await knowledgeDB.deleteEntry(additionalEntries[i]);
        } catch (error) {
          // Simulate corruption by creating inconsistent state
        }
      }

      // System should still be able to function with remaining data
      const remainingEntries = await knowledgeDB.getAllEntries();
      expect(remainingEntries.length).toBeGreaterThan(0);

      // Should be able to perform basic operations
      const searchResults = await knowledgeDB.search('DR Test');
      expect(searchResults.length).toBeGreaterThan(0);

      // Can add new data
      const recoveryEntryId = await knowledgeDB.addEntry({
        title: 'Recovery Test Entry',
        problem: 'Added after partial corruption',
        solution: 'Should work normally',
        category: 'Other',
        tags: ['recovery']
      });
      expect(recoveryEntryId).toBeTruthy();
    });

    it('should recover from index corruption', async () => {
      // Create backup
      await drManager.createBackup(testDbPath, backupDbPath);

      // Simulate index corruption (drop search index)
      try {
        await dbManager.executeQuery('DROP TABLE IF EXISTS kb_fts');
      } catch (error) {
        console.log('Index corruption simulated');
      }

      // Search should still work with fallback
      let searchWorked = false;
      try {
        const results = await knowledgeDB.search('DR Test');
        if (results.length > 0) {
          searchWorked = true;
        }
      } catch (error) {
        // Search might fail due to missing index
        console.log('Search failed due to index corruption:', (error as Error).message);
      }

      // Basic operations should still work
      const entries = await knowledgeDB.getAllEntries();
      expect(entries.length).toBeGreaterThan(0);

      // Should be able to rebuild indexes
      await knowledgeDB.close();
      await dbManager.close();

      // Restart should rebuild missing indexes
      dbManager = new DatabaseManager(testDbPath);
      await dbManager.initialize();
      knowledgeDB = new KnowledgeDB(testDbPath);

      // Search should work again
      const searchResults = await knowledgeDB.search('DR Test');
      expect(searchResults.length).toBeGreaterThan(0);
    });
  });

  describe('Hardware Failure Simulation', () => {
    it('should handle primary storage failure', async () => {
      // Create backup
      await drManager.createBackup(testDbPath, backupDbPath);

      // Close connections before simulating hardware failure
      await knowledgeDB.close();
      await dbManager.close();

      // Simulate hardware failure
      await drManager.simulateHardwareFailure(testDbPath);

      // Verify primary is inaccessible
      let primaryFailed = false;
      try {
        const failedDbManager = new DatabaseManager(testDbPath);
        await failedDbManager.initialize();
        await failedDbManager.close();
      } catch (error) {
        primaryFailed = true;
        console.log('Primary storage failure confirmed:', (error as Error).message);
      }

      expect(primaryFailed).toBe(true);

      // Restore from backup to new location
      const recoveredDbPath = path.join(tempDir, 'recovered.db');
      await drManager.restoreFromBackup(backupDbPath, recoveredDbPath);

      // Verify recovery
      const recoveredDbManager = new DatabaseManager(recoveredDbPath);
      await recoveredDbManager.initialize();
      const recoveredKnowledgeDB = new KnowledgeDB(recoveredDbPath);

      try {
        const recoveredEntries = await recoveredKnowledgeDB.getAllEntries();
        expect(recoveredEntries.length).toBe(SAMPLE_ENTRIES.length);

        // Should be able to perform normal operations
        const newEntryId = await recoveredKnowledgeDB.addEntry({
          title: 'Post-recovery Entry',
          problem: 'Added after hardware failure recovery',
          solution: 'System is operational again',
          category: 'Other',
          tags: ['post-recovery']
        });
        expect(newEntryId).toBeTruthy();
      } finally {
        await recoveredKnowledgeDB.close();
        await recoveredDbManager.close();
      }
    });

    it('should failover to secondary system', async () => {
      // Setup replication to secondary
      await drManager.setupReplication(testDbPath, secondaryDbPath);

      // Verify secondary has data
      const secondaryDb = new KnowledgeDB(secondaryDbPath);
      let secondaryEntries: KBEntry[];
      try {
        secondaryEntries = await secondaryDb.getAllEntries();
        expect(secondaryEntries.length).toBe(SAMPLE_ENTRIES.length);
      } finally {
        await secondaryDb.close();
      }

      // Simulate primary failure
      await knowledgeDB.close();
      await dbManager.close();
      await drManager.simulateHardwareFailure(testDbPath);

      // Failover to secondary
      const failoverStartTime = Date.now();
      
      const secondaryDbManager = new DatabaseManager(secondaryDbPath);
      await secondaryDbManager.initialize();
      const secondaryKnowledgeDB = new KnowledgeDB(secondaryDbPath);
      
      const failoverTime = (Date.now() - failoverStartTime) / 1000;
      console.log(`Failover completed in ${failoverTime.toFixed(2)} seconds`);
      
      expect(failoverTime).toBeLessThan(MAX_FAILOVER_TIME_SECONDS);

      try {
        // Verify secondary is operational
        const entries = await secondaryKnowledgeDB.getAllEntries();
        expect(entries.length).toBe(SAMPLE_ENTRIES.length);

        // Should be able to continue operations
        const failoverEntryId = await secondaryKnowledgeDB.addEntry({
          title: 'Failover Entry',
          problem: 'Added after failover to secondary',
          solution: 'Secondary system is now primary',
          category: 'Other',
          tags: ['failover']
        });
        expect(failoverEntryId).toBeTruthy();

        // Verify operations work normally
        const searchResults = await secondaryKnowledgeDB.search('DR Test');
        expect(searchResults.length).toBeGreaterThan(0);
      } finally {
        await secondaryKnowledgeDB.close();
        await secondaryDbManager.close();
      }
    });

    it('should handle network partition scenarios', async () => {
      // Setup secondary system
      await drManager.setupReplication(testDbPath, secondaryDbPath);

      // Add some data
      const prePartitionId = await knowledgeDB.addEntry({
        title: 'Pre-partition Entry',
        problem: 'Added before network partition',
        solution: 'Should be on both systems',
        category: 'Other',
        tags: ['pre-partition']
      });

      // Simulate network partition
      await drManager.simulateNetworkPartition();

      // During partition, both systems might continue operating
      // Primary continues
      const primaryPartitionId = await knowledgeDB.addEntry({
        title: 'Primary Partition Entry',
        problem: 'Added during partition on primary',
        solution: 'Only on primary initially',
        category: 'Other',
        tags: ['primary-partition']
      });

      // Secondary operates independently
      const secondaryDbManager = new DatabaseManager(secondaryDbPath);
      await secondaryDbManager.initialize();
      const secondaryKnowledgeDB = new KnowledgeDB(secondaryDbPath);

      try {
        const secondaryPartitionId = await secondaryKnowledgeDB.addEntry({
          title: 'Secondary Partition Entry',
          problem: 'Added during partition on secondary',
          solution: 'Only on secondary initially',
          category: 'Other',
          tags: ['secondary-partition']
        });

        // Verify both systems are operational
        const primaryEntries = await knowledgeDB.getAllEntries();
        const secondaryEntries = await secondaryKnowledgeDB.getAllEntries();

        expect(primaryEntries.length).toBeGreaterThan(SAMPLE_ENTRIES.length);
        expect(secondaryEntries.length).toBeGreaterThan(SAMPLE_ENTRIES.length);

        // Both should have pre-partition data
        expect(primaryEntries.some(e => e.id === prePartitionId)).toBe(true);
        expect(secondaryEntries.some(e => e.title === 'Pre-partition Entry')).toBe(true);

        // Each should have its partition-specific data
        expect(primaryEntries.some(e => e.id === primaryPartitionId)).toBe(true);
        expect(secondaryEntries.some(e => e.id === secondaryPartitionId)).toBe(true);
      } finally {
        await secondaryKnowledgeDB.close();
        await secondaryDbManager.close();
      }
    });
  });

  describe('Multi-Site Disaster Recovery', () => {
    it('should replicate data across multiple sites', async () => {
      const site1DbPath = path.join(tempDir, 'site1.db');
      const site2DbPath = path.join(tempDir, 'site2.db');
      const site3DbPath = path.join(tempDir, 'site3.db');

      // Setup multi-site replication
      await drManager.setupReplication(testDbPath, site1DbPath);
      await drManager.setupReplication(testDbPath, site2DbPath);
      await drManager.setupReplication(testDbPath, site3DbPath);

      // Verify all sites have data
      const sites = [site1DbPath, site2DbPath, site3DbPath];
      const siteConnections: KnowledgeDB[] = [];

      try {
        for (const sitePath of sites) {
          const siteDb = new KnowledgeDB(sitePath);
          siteConnections.push(siteDb);
          
          const entries = await siteDb.getAllEntries();
          expect(entries.length).toBe(SAMPLE_ENTRIES.length);
          
          // Verify data integrity
          const titles = entries.map(e => e.title).sort();
          const expectedTitles = SAMPLE_ENTRIES.map(e => e.title).sort();
          expect(titles).toEqual(expectedTitles);
        }

        // Test cross-site consistency
        const site1Entries = await siteConnections[0].getAllEntries();
        const site2Entries = await siteConnections[1].getAllEntries();
        const site3Entries = await siteConnections[2].getAllEntries();

        // All sites should have identical data
        expect(site1Entries.length).toBe(site2Entries.length);
        expect(site2Entries.length).toBe(site3Entries.length);

      } finally {
        for (const siteDb of siteConnections) {
          await siteDb.close();
        }
      }
    });

    it('should handle cascading failures', async () => {
      // Setup multiple backup levels
      const level1BackupPath = path.join(tempDir, 'level1-backup.db');
      const level2BackupPath = path.join(tempDir, 'level2-backup.db');
      const offSiteBackupPath = path.join(tempDir, 'offsite-backup.db');

      // Create hierarchical backups
      await drManager.createBackup(testDbPath, level1BackupPath);
      await drManager.createBackup(level1BackupPath, level2BackupPath);
      await drManager.createBackup(level2BackupPath, offSiteBackupPath);

      // Simulate cascading failures
      // Primary fails
      await knowledgeDB.close();
      await dbManager.close();
      await drManager.simulateHardwareFailure(testDbPath);

      // Level 1 backup also fails
      await drManager.simulateHardwareFailure(level1BackupPath);

      // Should still be able to recover from Level 2
      let level2Works = false;
      const level2Db = new KnowledgeDB(level2BackupPath);
      try {
        const entries = await level2Db.getAllEntries();
        expect(entries.length).toBe(SAMPLE_ENTRIES.length);
        level2Works = true;
      } catch (error) {
        console.log('Level 2 backup failed:', (error as Error).message);
      } finally {
        await level2Db.close();
      }

      if (!level2Works) {
        // Fall back to off-site backup
        const offSiteDb = new KnowledgeDB(offSiteBackupPath);
        try {
          const entries = await offSiteDb.getAllEntries();
          expect(entries.length).toBe(SAMPLE_ENTRIES.length);
          
          // Should be able to restore operations
          const recoveryPath = path.join(tempDir, 'final-recovery.db');
          await drManager.restoreFromBackup(offSiteBackupPath, recoveryPath);
          
          const recoveredDbManager = new DatabaseManager(recoveryPath);
          await recoveredDbManager.initialize();
          const recoveredDb = new KnowledgeDB(recoveryPath);
          
          try {
            const recoveredEntries = await recoveredDb.getAllEntries();
            expect(recoveredEntries.length).toBe(SAMPLE_ENTRIES.length);
          } finally {
            await recoveredDb.close();
            await recoveredDbManager.close();
          }
        } finally {
          await offSiteDb.close();
        }
      }
    });
  });

  describe('Recovery Time and RPO Testing', () => {
    it('should meet Recovery Time Objective (RTO)', async () => {
      // Create backup
      await drManager.createBackup(testDbPath, backupDbPath);
      
      // Simulate disaster
      await knowledgeDB.close();
      await dbManager.close();
      await drManager.simulateHardwareFailure(testDbPath);

      // Measure recovery time
      const recoveryStartTime = Date.now();
      
      // Recovery process
      await drManager.restoreFromBackup(backupDbPath, testDbPath);
      
      dbManager = new DatabaseManager(testDbPath);
      await dbManager.initialize();
      knowledgeDB = new KnowledgeDB(testDbPath);
      
      // Verify system is operational
      const entries = await knowledgeDB.getAllEntries();
      expect(entries.length).toBeGreaterThan(0);
      
      const totalRecoveryTime = (Date.now() - recoveryStartTime) / 1000;
      
      console.log(`Total recovery time: ${totalRecoveryTime.toFixed(2)} seconds`);
      console.log(`RTO target: ${MAX_RESTORE_TIME_SECONDS} seconds`);
      
      expect(totalRecoveryTime).toBeLessThan(MAX_RESTORE_TIME_SECONDS);
    });

    it('should meet Recovery Point Objective (RPO)', async () => {
      const rpoMinutes = 15; // 15-minute RPO target
      
      // Track transactions over time
      const transactions: Array<{id: string; timestamp: number}> = [];
      
      // Add initial data
      for (let i = 0; i < 10; i++) {
        const id = await knowledgeDB.addEntry({
          title: `RPO Test Entry ${i}`,
          problem: `RPO problem ${i}`,
          solution: `RPO solution ${i}`,
          category: 'Other',
          tags: [`rpo-${i}`]
        });
        transactions.push({ id, timestamp: Date.now() });
        
        // Small delay between transactions
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Create backup (simulating scheduled backup)
      const backupTime = Date.now();
      await drManager.createBackup(testDbPath, backupDbPath);
      
      // Continue adding data after backup
      const postBackupTransactions: Array<{id: string; timestamp: number}> = [];
      for (let i = 10; i < 15; i++) {
        const id = await knowledgeDB.addEntry({
          title: `Post-backup Entry ${i}`,
          problem: `Post-backup problem ${i}`,
          solution: `Post-backup solution ${i}`,
          category: 'Other',
          tags: [`post-backup-${i}`]
        });
        postBackupTransactions.push({ id, timestamp: Date.now() });
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Simulate disaster and recovery
      await knowledgeDB.close();
      await dbManager.close();
      await drManager.restoreFromBackup(backupDbPath, testDbPath);
      
      dbManager = new DatabaseManager(testDbPath);
      await dbManager.initialize();
      knowledgeDB = new KnowledgeDB(testDbPath);

      // Check data loss
      const recoveredEntries = await knowledgeDB.getAllEntries();
      const recoveredTitles = recoveredEntries.map(e => e.title);
      
      // Calculate actual data loss
      const lostTransactions = postBackupTransactions.filter(tx => {
        const expectedTitle = `Post-backup Entry ${tx.id}`;
        return !recoveredTitles.some(title => title.includes(expectedTitle.split(' ')[2]));
      });

      const maxDataLossTime = Math.max(...postBackupTransactions.map(tx => tx.timestamp)) - backupTime;
      const dataLossMinutes = maxDataLossTime / (1000 * 60);
      
      console.log(`Backup time: ${new Date(backupTime).toISOString()}`);
      console.log(`Data loss window: ${dataLossMinutes.toFixed(2)} minutes`);
      console.log(`RPO target: ${rpoMinutes} minutes`);
      console.log(`Lost transactions: ${lostTransactions.length}`);

      // In this test, we expect to lose post-backup data, which is acceptable within RPO
      expect(dataLossMinutes).toBeLessThan(rpoMinutes);
    });
  });
});