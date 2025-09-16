/**
 * End-to-End Tests for Complete Storage Workflows
 * Tests realistic user scenarios from start to finish
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import { StorageService } from '../../../src/services/storage/StorageService';
import { BackupService } from '../../../src/services/storage/backup/BackupService';
import { ExportService } from '../../../src/services/storage/export/ExportService';
import { ImportService } from '../../../src/services/storage/export/ImportService';
import { MigrationService } from '../../../src/services/storage/migration/MigrationService';
import { AnalyticsPlugin } from '../../../src/services/storage/plugins/AnalyticsPlugin';
import { CodeAnalysisPlugin } from '../../../src/services/storage/plugins/CodeAnalysisPlugin';
import { PatternDetectionPlugin } from '../../../src/services/storage/plugins/PatternDetectionPlugin';
import { createMockConfig, TestData, SAMPLE_KB_ENTRIES } from '../fixtures/testData';
import { StorageConfig } from '../../../src/services/storage/IStorageService';
import * as fs from 'fs';
import * as path from 'path';

describe('Complete Storage Workflow E2E Tests', () => {
  let storageService: StorageService;
  let backupService: BackupService;
  let exportService: ExportService;
  let importService: ImportService;
  let migrationService: MigrationService;
  let config: StorageConfig;
  let testDir: string;
  let dbPath: string;

  beforeAll(() => {
    testDir = path.join(__dirname, '..', 'temp', 'e2e');
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  beforeEach(async () => {
    dbPath = path.join(testDir, `e2e-test-${Date.now()}.db`);
    
    config = createMockConfig({
      database: {
        type: 'sqlite',
        path: dbPath,
        pragmas: {
          journal_mode: 'WAL',
          synchronous: 'NORMAL',
          foreign_keys: 'ON'
        }
      },
      backup: {
        enabled: true,
        interval: 60000,
        retention: 5,
        compression: true,
        destinations: [{
          type: 'local',
          path: path.join(testDir, 'backups')
        }]
      },
      mvp: {
        version: '3', // Enable advanced features
        features: {
          plugins: true,
          backup: true,
          analytics: true,
          codeAnalysis: true,
          templates: false
        }
      }
    });

    storageService = new StorageService(config);
    await storageService.initialize();

    backupService = new BackupService(storageService, config.backup);
    exportService = new ExportService(storageService);
    importService = new ImportService(storageService);
    migrationService = new MigrationService(storageService);
  });

  afterEach(async () => {
    await storageService.close();
    
    // Cleanup test files
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
  });

  afterAll(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  });

  describe('Complete Knowledge Base Lifecycle', () => {
    it('should handle complete KB creation, usage, and maintenance workflow', async () => {
      // Phase 1: Initial Setup and Data Import
      console.log('Phase 1: Initial Setup and Data Import');
      
      // Import initial knowledge base
      const initialData = {
        version: '1.0',
        metadata: {
          created: new Date().toISOString(),
          source: 'e2e-test'
        },
        entries: SAMPLE_KB_ENTRIES
      };

      const importPath = path.join(testDir, 'initial-import.json');
      fs.writeFileSync(importPath, JSON.stringify(initialData, null, 2));

      const importResult = await importService.importFromFile(importPath, 'json');
      expect(importResult.success).toBe(true);
      expect(importResult.entriesImported).toBe(SAMPLE_KB_ENTRIES.length);

      // Verify initial data
      const totalCount = await storageService.getTotalCount();
      expect(totalCount).toBe(SAMPLE_KB_ENTRIES.length);

      // Phase 2: Daily Usage Simulation
      console.log('Phase 2: Daily Usage Simulation');
      
      // Simulate daily knowledge base usage
      const dailyOperations = [
        // Morning: Search for common issues
        () => storageService.search('VSAM'),
        () => storageService.search('S0C7'),
        () => storageService.search('JCL syntax'),
        
        // Add new knowledge entries
        () => storageService.addEntry(TestData.createTestKBEntry({
          title: 'New Morning Issue',
          problem: 'Morning batch job failure',
          solution: 'Check overnight maintenance'
        })),
        
        // Update existing entries with better solutions
        async () => {
          const results = await storageService.search('VSAM Status 35');
          if (results.length > 0) {
            await storageService.updateEntry(results[0].entry.id!, {
              solution: results[0].entry.solution + '\n5. Additional troubleshooting step'
            });
          }
        },
        
        // Search for solutions during incident response
        () => storageService.search('database connection'),
        () => storageService.search('timeout'),
        () => storageService.search('resource unavailable'),
        
        // Add incident-specific knowledge
        () => storageService.addEntry(TestData.createTestKBEntry({
          title: 'Afternoon Performance Issue',
          problem: 'System slowdown during peak hours',
          solution: 'Scale resources and check bottlenecks',
          category: 'Functional',
          tags: ['performance', 'scaling', 'peak-hours']
        }))
      ];

      // Execute daily operations
      for (const operation of dailyOperations) {
        await operation();
        // Small delay to simulate real usage
        await TestData.waitForDelay(10);
      }

      // Verify operations completed successfully
      const afterDailyCount = await storageService.getTotalCount();
      expect(afterDailyCount).toBeGreaterThan(totalCount);

      // Phase 3: Plugin Integration and Analytics
      console.log('Phase 3: Plugin Integration and Analytics');
      
      // Register and initialize plugins
      const analyticsPlugin = new AnalyticsPlugin();
      const patternPlugin = new PatternDetectionPlugin();
      
      storageService.registerPlugin(analyticsPlugin);
      storageService.registerPlugin(patternPlugin);
      
      await analyticsPlugin.initialize();
      await patternPlugin.initialize();

      // Perform operations to generate analytics
      const searchQueries = ['error', 'timeout', 'failure', 'connection', 'status'];
      for (const query of searchQueries) {
        await storageService.search(query);
        await TestData.waitForDelay(5);
      }

      // Check analytics data
      const analytics = await analyticsPlugin.getAnalytics();
      expect(analytics.totalOperations).toBeGreaterThan(0);
      expect(analytics.searchPatterns).toBeDefined();

      // Phase 4: Backup and Recovery
      console.log('Phase 4: Backup and Recovery');
      
      // Create backup before major changes
      const backupPath = await backupService.createBackup();
      expect(fs.existsSync(backupPath)).toBe(true);

      // Simulate data loss scenario
      const beforeLossCount = await storageService.getTotalCount();
      
      // Delete some entries to simulate data loss
      const entriesToDelete = await storageService.search('', { limit: 3 });
      for (const result of entriesToDelete) {
        await storageService.deleteEntry(result.entry.id!);
      }

      const afterLossCount = await storageService.getTotalCount();
      expect(afterLossCount).toBe(beforeLossCount - 3);

      // Restore from backup
      await backupService.restoreFromBackup(backupPath);
      
      const afterRestoreCount = await storageService.getTotalCount();
      expect(afterRestoreCount).toBe(beforeLossCount);

      // Phase 5: Export and Migration
      console.log('Phase 5: Export and Migration');
      
      // Export current state for migration
      const exportPath = path.join(testDir, 'migration-export.json');
      await exportService.exportToFile(exportPath, 'json');
      
      expect(fs.existsSync(exportPath)).toBe(true);

      // Verify export content
      const exportedData = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
      expect(exportedData.entries).toBeDefined();
      expect(exportedData.entries.length).toBe(afterRestoreCount);
      expect(exportedData.metadata).toBeDefined();

      // Simulate migration to new system
      const newDbPath = path.join(testDir, `migrated-${Date.now()}.db`);
      const newConfig = { ...config, database: { ...config.database, path: newDbPath } };
      
      const newStorageService = new StorageService(newConfig);
      await newStorageService.initialize();

      const newImportService = new ImportService(newStorageService);
      const migrationResult = await newImportService.importFromFile(exportPath, 'json');
      
      expect(migrationResult.success).toBe(true);
      expect(migrationResult.entriesImported).toBe(afterRestoreCount);

      // Verify migrated data
      const migratedCount = await newStorageService.getTotalCount();
      expect(migratedCount).toBe(afterRestoreCount);

      // Test key functionality in migrated system
      const migratedSearchResults = await newStorageService.search('VSAM Status 35');
      expect(migratedSearchResults.length).toBe(1);

      await newStorageService.close();
      
      // Phase 6: Performance Validation
      console.log('Phase 6: Performance Validation');
      
      // Validate that system performs well after all operations
      const performanceStart = Date.now();
      const performanceResults = await storageService.search('performance test');
      const searchTime = Date.now() - performanceStart;
      
      expect(searchTime).toBeLessThan(1000); // Should still be fast

      // Get system metrics
      const metrics = await storageService.getMetrics();
      expect(metrics.totalEntries).toBeGreaterThan(0);
      expect(metrics.performance.averageResponseTime).toBeLessThan(500);

      console.log(`E2E Test Completed Successfully:
        - Initial entries: ${SAMPLE_KB_ENTRIES.length}
        - Final entries: ${afterRestoreCount}
        - Operations performed: ${analytics.totalOperations}
        - Search performance: ${searchTime}ms
        - Average response time: ${metrics.performance.averageResponseTime}ms`);

      await analyticsPlugin.cleanup();
      await patternPlugin.cleanup();
    }, 60000); // 60 second timeout for complete workflow
  });

  describe('Multi-User Collaboration Workflow', () => {
    it('should handle multiple users working simultaneously', async () => {
      // Simulate multiple users by creating separate operation streams
      
      // User 1: Support Engineer - focuses on searching and adding solutions
      const supportEngineerTasks = async () => {
        const tasks = [];
        
        // Search for existing solutions
        tasks.push(storageService.search('database'));
        tasks.push(storageService.search('connection'));
        
        // Add new solutions found during incident response
        tasks.push(storageService.addEntry(TestData.createTestKBEntry({
          title: 'Support: Database Lock Issue',
          problem: 'Database lock preventing application access',
          solution: 'Identify blocking sessions and resolve',
          category: 'DB2',
          tags: ['database', 'lock', 'support'],
          created_by: 'support-engineer'
        })));
        
        // Update existing entries with field experience
        const existingResults = await storageService.search('VSAM');
        if (existingResults.length > 0) {
          tasks.push(storageService.updateEntry(existingResults[0].entry.id!, {
            solution: existingResults[0].entry.solution + '\nField note: Also check DFHSM migration status'
          }));
        }
        
        return Promise.all(tasks);
      };

      // User 2: System Administrator - focuses on system maintenance entries
      const systemAdminTasks = async () => {
        const tasks = [];
        
        // Search for system maintenance procedures
        tasks.push(storageService.search('maintenance'));
        tasks.push(storageService.search('backup'));
        
        // Add system administration knowledge
        tasks.push(storageService.addEntry(TestData.createTestKBEntry({
          title: 'SysAdmin: Scheduled Maintenance Checklist',
          problem: 'Need systematic approach for monthly maintenance',
          solution: 'Follow documented checklist for all systems',
          category: 'Functional',
          tags: ['maintenance', 'checklist', 'sysadmin'],
          created_by: 'system-admin'
        })));
        
        tasks.push(storageService.addEntry(TestData.createTestKBEntry({
          title: 'SysAdmin: Backup Verification Process',
          problem: 'Ensure backup integrity before maintenance',
          solution: 'Run backup verification and test restore',
          category: 'Functional',
          tags: ['backup', 'verification', 'sysadmin'],
          created_by: 'system-admin'
        })));
        
        return Promise.all(tasks);
      };

      // User 3: Developer - focuses on code-related issues
      const developerTasks = async () => {
        const tasks = [];
        
        // Search for development-related issues
        tasks.push(storageService.search('COBOL'));
        tasks.push(storageService.search('compile'));
        
        // Add development knowledge
        tasks.push(storageService.addEntry(TestData.createTestKBEntry({
          title: 'Dev: COBOL Compilation Best Practices',
          problem: 'Inconsistent compilation results across environments',
          solution: 'Standardize compiler options and procedures',
          category: 'Batch',
          tags: ['cobol', 'compilation', 'development'],
          created_by: 'developer'
        })));
        
        // Search for patterns to help with debugging
        tasks.push(storageService.search('exception'));
        
        return Promise.all(tasks);
      };

      // Execute all user tasks concurrently
      const startTime = Date.now();
      const [supportResults, adminResults, devResults] = await Promise.all([
        supportEngineerTasks(),
        systemAdminTasks(),
        developerTasks()
      ]);
      const totalTime = Date.now() - startTime;

      // Verify all operations completed successfully
      expect(supportResults.length).toBeGreaterThan(0);
      expect(adminResults.length).toBeGreaterThan(0);
      expect(devResults.length).toBeGreaterThan(0);

      // Verify data integrity - each user's contributions should be present
      const supportEntries = await storageService.search('Support:');
      const adminEntries = await storageService.search('SysAdmin:');
      const devEntries = await storageService.search('Dev:');

      expect(supportEntries.length).toBeGreaterThan(0);
      expect(adminEntries.length).toBeGreaterThan(0);
      expect(devEntries.length).toBeGreaterThan(0);

      // Verify cross-user collaboration
      const allEntries = await storageService.search('', { limit: 100 });
      const userContributions = new Set(
        allEntries.map(r => r.entry.created_by).filter(Boolean)
      );
      
      expect(userContributions.has('support-engineer')).toBe(true);
      expect(userContributions.has('system-admin')).toBe(true);
      expect(userContributions.has('developer')).toBe(true);

      console.log(`Multi-User Collaboration Test:
        - Total time: ${totalTime}ms
        - Support entries: ${supportEntries.length}
        - Admin entries: ${adminEntries.length}
        - Dev entries: ${devEntries.length}
        - Unique contributors: ${userContributions.size}`);
    });
  });

  describe('Disaster Recovery Workflow', () => {
    it('should handle complete disaster recovery scenario', async () => {
      // Phase 1: Normal Operations with Regular Backups
      console.log('Phase 1: Normal Operations Setup');
      
      // Populate system with critical knowledge
      const criticalKnowledge = [
        ...SAMPLE_KB_ENTRIES,
        ...TestData.createBatchKBEntries(20)
      ];

      for (const entry of criticalKnowledge) {
        await storageService.addEntry(entry);
      }

      // Create multiple backup points
      const backup1 = await backupService.createBackup();
      await TestData.waitForDelay(100);

      // Add more data
      await storageService.addEntry(TestData.createTestKBEntry({
        title: 'Critical Production Fix',
        problem: 'Production system down',
        solution: 'Emergency recovery procedure',
        category: 'Functional',
        tags: ['critical', 'production', 'emergency']
      }));

      const backup2 = await backupService.createBackup();
      const preDisasterCount = await storageService.getTotalCount();

      // Phase 2: Disaster Simulation
      console.log('Phase 2: Disaster Simulation');
      
      // Simulate complete system failure
      await storageService.close();
      
      // Remove database file (simulate corruption/loss)
      if (fs.existsSync(dbPath)) {
        fs.unlinkSync(dbPath);
      }

      // Phase 3: Recovery Process
      console.log('Phase 3: Recovery Process');
      
      // Initialize new system
      const recoveryService = new StorageService(config);
      await recoveryService.initialize();

      const recoveryBackupService = new BackupService(recoveryService, config.backup);

      // Attempt to restore from most recent backup
      try {
        await recoveryBackupService.restoreFromBackup(backup2);
        console.log('Successfully restored from most recent backup');
      } catch (error) {
        console.log('Recent backup failed, trying earlier backup');
        await recoveryBackupService.restoreFromBackup(backup1);
      }

      // Verify recovery
      const recoveredCount = await recoveryService.getTotalCount();
      expect(recoveredCount).toBeGreaterThan(0);
      expect(recoveredCount).toBeLessThanOrEqual(preDisasterCount);

      // Test critical functionality
      const criticalSearch = await recoveryService.search('Critical Production Fix');
      const vsamSearch = await recoveryService.search('VSAM Status 35');

      expect(vsamSearch.length).toBeGreaterThan(0); // Should be in all backups
      
      if (criticalSearch.length === 0) {
        // If critical entry is missing, it was added after backup1
        console.log('Critical entry lost, re-adding from incident logs');
        await recoveryService.addEntry(TestData.createTestKBEntry({
          title: 'Critical Production Fix (Recovered)',
          problem: 'Production system down - recovered from incident logs',
          solution: 'Emergency recovery procedure - reconstructed',
          category: 'Functional',
          tags: ['critical', 'production', 'emergency', 'recovered']
        }));
      }

      // Phase 4: Validation and Re-establishment
      console.log('Phase 4: Validation and Re-establishment');
      
      // Verify system is fully operational
      const validationTests = [
        () => recoveryService.search('VSAM'),
        () => recoveryService.search('S0C7'),
        () => recoveryService.addEntry(TestData.createTestKBEntry({
          title: 'Post-Recovery Test Entry',
          problem: 'Testing system after recovery',
          solution: 'System is operational'
        })),
        () => recoveryService.search('Post-Recovery')
      ];

      for (const test of validationTests) {
        const result = await test();
        expect(result).toBeDefined();
      }

      // Create new backup to establish new backup baseline
      const postRecoveryBackup = await recoveryBackupService.createBackup();
      expect(fs.existsSync(postRecoveryBackup)).toBe(true);

      // Get final metrics
      const finalCount = await recoveryService.getTotalCount();
      const finalMetrics = await recoveryService.getMetrics();

      console.log(`Disaster Recovery Complete:
        - Pre-disaster entries: ${preDisasterCount}
        - Post-recovery entries: ${finalCount}
        - Data recovery rate: ${((finalCount / preDisasterCount) * 100).toFixed(1)}%
        - System performance: ${finalMetrics.performance.averageResponseTime}ms avg`);

      expect(finalCount).toBeGreaterThan(preDisasterCount * 0.9); // At least 90% recovery
      expect(finalMetrics.performance.averageResponseTime).toBeLessThan(1000);

      await recoveryService.close();
    });
  });

  describe('Integration with External Systems', () => {
    it('should handle integration with ticketing system workflow', async () => {
      // Simulate integration with external ticketing system
      
      // Phase 1: Initial ticket import
      const externalTickets = [
        {
          ticketId: 'INC-001',
          title: 'Database Connection Timeout',
          description: 'Users unable to connect to mainframe database',
          severity: 'high',
          category: 'DB2',
          resolution: 'Increased connection pool size',
          resolvedBy: 'dba-team',
          tags: ['database', 'timeout', 'connection']
        },
        {
          ticketId: 'INC-002',
          title: 'JCL Job Failure',
          description: 'Nightly batch job failing with syntax error',
          severity: 'medium',
          category: 'JCL',
          resolution: 'Fixed DD statement syntax',
          resolvedBy: 'operations-team',
          tags: ['jcl', 'batch', 'syntax']
        },
        {
          ticketId: 'INC-003',
          title: 'VSAM File Corruption',
          description: 'VSAM file appears corrupted after power outage',
          severity: 'critical',
          category: 'VSAM',
          resolution: 'Restored from backup and rebuilt indexes',
          resolvedBy: 'storage-team',
          tags: ['vsam', 'corruption', 'recovery']
        }
      ];

      // Convert tickets to KB entries
      for (const ticket of externalTickets) {
        await storageService.addEntry({
          title: `${ticket.ticketId}: ${ticket.title}`,
          problem: ticket.description,
          solution: ticket.resolution || 'Resolution pending',
          category: ticket.category as any,
          tags: [...(ticket.tags || []), 'from-ticket', ticket.ticketId.toLowerCase()],
          created_by: ticket.resolvedBy
        });
      }

      // Phase 2: Knowledge lookup during new incident
      const newIncident = {
        description: 'Database connection issues reported by multiple users',
        urgency: 'high'
      };

      // Search for similar past incidents
      const similarIncidents = await storageService.search('database connection');
      expect(similarIncidents.length).toBeGreaterThan(0);

      const relevantSolution = similarIncidents.find(r => 
        r.entry.tags?.includes('database') && r.entry.tags?.includes('connection')
      );

      expect(relevantSolution).toBeDefined();

      // Phase 3: Create new KB entry from incident resolution
      const newResolution = await storageService.addEntry({
        title: 'INC-004: Database Connection Pool Exhaustion',
        problem: 'Connection pool exhausted during peak hours causing user timeouts',
        solution: 'Implemented connection pooling optimization and monitoring',
        category: 'DB2',
        tags: ['database', 'connection', 'pool', 'optimization', 'from-ticket', 'inc-004'],
        created_by: 'incident-team'
      });

      // Phase 4: Pattern detection across incidents
      const patternPlugin = new PatternDetectionPlugin();
      storageService.registerPlugin(patternPlugin);
      await patternPlugin.initialize();

      // Search for patterns
      const databaseIncidents = await storageService.search('', {
        filters: { tags: ['database'] }
      });

      expect(databaseIncidents.length).toBeGreaterThan(2);

      // Verify pattern detection would identify database as problematic area
      const patterns = await patternPlugin.detectPatterns({
        timeframe: '30d',
        minimumOccurrences: 2
      });

      expect(patterns.some(p => p.category === 'DB2')).toBe(true);

      await patternPlugin.cleanup();

      console.log(`Ticketing Integration Test:
        - Imported tickets: ${externalTickets.length}
        - Similar incidents found: ${similarIncidents.length}
        - Database-related incidents: ${databaseIncidents.length}
        - Patterns detected: ${patterns.length}`);
    });
  });

  describe('Scalability and Growth Workflow', () => {
    it('should handle system growth over time', async () => {
      // Simulate knowledge base growth over months
      
      const monthlyGrowthSizes = [50, 100, 200, 400, 600]; // Entries per month
      const monthlyMetrics = [];

      for (let month = 0; month < monthlyGrowthSizes.length; month++) {
        console.log(`Simulating Month ${month + 1}`);
        
        // Add entries for this month
        const monthlyEntries = TestData.createPerformanceTestData(monthlyGrowthSizes[month]);
        
        // Add entries in batches to simulate real growth
        const batchSize = 25;
        for (let i = 0; i < monthlyEntries.length; i += batchSize) {
          const batch = monthlyEntries.slice(i, i + batchSize);
          await storageService.batchInsert(batch);
          await TestData.waitForDelay(5); // Small delay to simulate real timing
        }

        // Simulate monthly usage
        const searchQueries = [
          'system error', 'database', 'connection', 'timeout', 'performance',
          'batch job', 'file error', 'memory', 'cpu', 'disk space'
        ];

        const searchStartTime = Date.now();
        for (const query of searchQueries) {
          await storageService.search(query, { limit: 10 });
        }
        const searchTotalTime = Date.now() - searchStartTime;

        // Collect metrics
        const totalEntries = await storageService.getTotalCount();
        const systemMetrics = await storageService.getMetrics();
        
        monthlyMetrics.push({
          month: month + 1,
          totalEntries,
          averageSearchTime: searchTotalTime / searchQueries.length,
          systemPerformance: systemMetrics.performance.averageResponseTime,
          memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024 // MB
        });

        // Perform monthly maintenance
        if (month % 2 === 1) { // Every other month
          await storageService.vacuum();
          await storageService.analyze();
        }
      }

      // Analyze growth patterns
      console.log('\nGrowth Analysis:');
      monthlyMetrics.forEach(metric => {
        console.log(`Month ${metric.month}: ${metric.totalEntries} entries, ` +
                   `${metric.averageSearchTime.toFixed(2)}ms avg search, ` +
                   `${metric.memoryUsage.toFixed(2)}MB memory`);
      });

      // Verify scalability
      const firstMonth = monthlyMetrics[0];
      const lastMonth = monthlyMetrics[monthlyMetrics.length - 1];
      
      // Performance shouldn't degrade linearly with data growth
      const performanceDegradation = lastMonth.averageSearchTime / firstMonth.averageSearchTime;
      expect(performanceDegradation).toBeLessThan(3); // Less than 3x slower

      // Memory usage should be reasonable
      expect(lastMonth.memoryUsage).toBeLessThan(500); // Less than 500MB

      // System should still be responsive
      expect(lastMonth.averageSearchTime).toBeLessThan(1000); // Less than 1 second

      // Final stress test
      console.log('\nFinal Stress Test');
      const stressTestQueries = Array.from({ length: 50 }, (_, i) => 
        `stress test query ${i}`
      );

      const stressStartTime = Date.now();
      const stressResults = await Promise.all(
        stressTestQueries.map(query => storageService.search(query))
      );
      const stressEndTime = Date.now();

      const stressTotalTime = stressEndTime - stressStartTime;
      const stressAverageTime = stressTotalTime / stressTestQueries.length;

      expect(stressAverageTime).toBeLessThan(200); // Should handle concurrent load
      expect(stressResults.every(r => Array.isArray(r))).toBe(true);

      console.log(`Stress Test: ${stressTestQueries.length} concurrent searches in ${stressTotalTime}ms`);
      console.log(`Average: ${stressAverageTime.toFixed(2)}ms per search`);
    });
  });
});