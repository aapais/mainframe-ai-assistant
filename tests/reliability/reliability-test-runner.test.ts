/**
 * Reliability Test Runner
 * Comprehensive test suite that runs all reliability tests and generates reports
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import { 
  SystemHealthMonitor, 
  UptimeMonitor, 
  PerformanceMonitor, 
  HealthCheckFactory,
  RecoveryAutomation,
  HealthStatus,
  DEFAULT_THRESHOLDS
} from './monitoring';
import { DatabaseManager } from '../../src/database/DatabaseManager';
import { KnowledgeDB } from '../../src/database/KnowledgeDB';

// Reliability test configuration
interface ReliabilityTestConfig {
  testDuration: {
    short: number;    // milliseconds
    medium: number;   // milliseconds
    long: number;     // milliseconds
  };
  thresholds: {
    uptimeTarget: number;        // percentage
    maxResponseTime: number;     // milliseconds
    maxRecoveryTime: number;     // milliseconds
    maxMemoryGrowth: number;     // MB per hour
    maxErrorRate: number;        // percentage
  };
  loadTest: {
    concurrency: number;
    operationsPerSecond: number;
    duration: number;  // milliseconds
  };
}

const TEST_CONFIG: ReliabilityTestConfig = {
  testDuration: {
    short: 5000,      // 5 seconds
    medium: 15000,    // 15 seconds
    long: 30000       // 30 seconds
  },
  thresholds: {
    uptimeTarget: 99.9,       // 99.9%
    maxResponseTime: 1000,    // 1 second
    maxRecoveryTime: 30000,   // 30 seconds
    maxMemoryGrowth: 50,      // 50 MB/hour
    maxErrorRate: 1           // 1%
  },
  loadTest: {
    concurrency: 10,
    operationsPerSecond: 50,
    duration: 10000           // 10 seconds
  }
};

// Test report interface
interface ReliabilityTestReport {
  timestamp: Date;
  testSuite: string;
  results: {
    passed: number;
    failed: number;
    skipped: number;
    total: number;
  };
  metrics: {
    uptime: number;
    averageResponseTime: number;
    maxResponseTime: number;
    errorRate: number;
    memoryUsage: number;
  };
  alerts: Array<{
    severity: string;
    component: string;
    message: string;
    timestamp: Date;
  }>;
  recommendations: string[];
}

describe('Comprehensive Reliability Test Suite', () => {
  let testDbPath: string;
  let tempDir: string;
  let dbManager: DatabaseManager;
  let knowledgeDB: KnowledgeDB;
  let healthMonitor: SystemHealthMonitor;
  let uptimeMonitor: UptimeMonitor;
  let performanceMonitor: PerformanceMonitor;
  let recoveryAutomation: RecoveryAutomation;

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(__dirname, 'temp-reliability-suite-'));
    testDbPath = path.join(tempDir, 'reliability-test.db');
    
    // Initialize monitoring systems
    healthMonitor = new SystemHealthMonitor(DEFAULT_THRESHOLDS);
    uptimeMonitor = new UptimeMonitor();
    performanceMonitor = new PerformanceMonitor();
    recoveryAutomation = new RecoveryAutomation();

    console.log('Reliability Test Suite started');
    console.log(`Test database: ${testDbPath}`);
    console.log(`Test configuration:`, TEST_CONFIG);
  });

  beforeEach(async () => {
    // Clean database for each test
    try {
      await fs.unlink(testDbPath);
    } catch (error) {
      // File might not exist
    }

    // Initialize database
    dbManager = new DatabaseManager(testDbPath);
    await dbManager.initialize();
    knowledgeDB = new KnowledgeDB(testDbPath);

    // Setup health checks
    healthMonitor.registerHealthCheck(
      'database',
      HealthCheckFactory.createDatabaseHealthCheck(dbManager)
    );
    
    healthMonitor.registerHealthCheck(
      'memory',
      HealthCheckFactory.createMemoryHealthCheck()
    );

    healthMonitor.registerHealthCheck(
      'disk',
      HealthCheckFactory.createDiskSpaceHealthCheck(tempDir)
    );

    // Setup recovery actions
    recoveryAutomation.registerRecoveryAction('database', async () => {
      try {
        await dbManager.close();
        dbManager = new DatabaseManager(testDbPath);
        await dbManager.initialize();
        return true;
      } catch (error) {
        return false;
      }
    });

    // Start monitoring
    healthMonitor.start(1000); // Check every second for tests
  });

  afterEach(async () => {
    healthMonitor.stop();
    
    if (knowledgeDB) {
      await knowledgeDB.close();
    }
    if (dbManager) {
      await dbManager.close();
    }
  });

  afterAll(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Cleanup failed:', error);
    }
    console.log('Reliability Test Suite completed');
  });

  describe('System Reliability Validation', () => {
    it('should pass comprehensive reliability validation', async () => {
      const testReport: ReliabilityTestReport = {
        timestamp: new Date(),
        testSuite: 'System Reliability Validation',
        results: { passed: 0, failed: 0, skipped: 0, total: 0 },
        metrics: {
          uptime: 0,
          averageResponseTime: 0,
          maxResponseTime: 0,
          errorRate: 0,
          memoryUsage: 0
        },
        alerts: [],
        recommendations: []
      };

      const testStartTime = Date.now();
      let testsPassed = 0;
      const totalTests = 6; // Number of sub-tests

      try {
        // Test 1: System startup and basic functionality
        console.log('Running Test 1: System Startup and Basic Functionality...');
        const startupTest = await testSystemStartup();
        if (startupTest.passed) testsPassed++;
        testReport.results.total++;

        // Test 2: Load handling and performance
        console.log('Running Test 2: Load Handling and Performance...');
        const loadTest = await testLoadHandling();
        if (loadTest.passed) testsPassed++;
        testReport.results.total++;
        testReport.metrics.averageResponseTime = loadTest.averageResponseTime;
        testReport.metrics.maxResponseTime = loadTest.maxResponseTime;

        // Test 3: Memory stability
        console.log('Running Test 3: Memory Stability...');
        const memoryTest = await testMemoryStability();
        if (memoryTest.passed) testsPassed++;
        testReport.results.total++;
        testReport.metrics.memoryUsage = memoryTest.memoryUsage;

        // Test 4: Error handling and recovery
        console.log('Running Test 4: Error Handling and Recovery...');
        const errorTest = await testErrorHandling();
        if (errorTest.passed) testsPassed++;
        testReport.results.total++;
        testReport.metrics.errorRate = errorTest.errorRate;

        // Test 5: Health monitoring
        console.log('Running Test 5: Health Monitoring...');
        const healthTest = await testHealthMonitoring();
        if (healthTest.passed) testsPassed++;
        testReport.results.total++;

        // Test 6: Uptime validation
        console.log('Running Test 6: Uptime Validation...');
        const uptimeTest = await testUptimeValidation();
        if (uptimeTest.passed) testsPassed++;
        testReport.results.total++;
        testReport.metrics.uptime = uptimeTest.uptime;

        testReport.results.passed = testsPassed;
        testReport.results.failed = totalTests - testsPassed;

        // Collect alerts
        testReport.alerts = healthMonitor.getAlerts().map(alert => ({
          severity: alert.severity,
          component: alert.component,
          message: alert.message,
          timestamp: alert.timestamp
        }));

        // Generate recommendations
        testReport.recommendations = generateRecommendations(testReport);

        // Log final report
        console.log('\n=== RELIABILITY TEST REPORT ===');
        console.log(`Test Suite: ${testReport.testSuite}`);
        console.log(`Timestamp: ${testReport.timestamp.toISOString()}`);
        console.log(`Results: ${testReport.results.passed}/${testReport.results.total} passed`);
        console.log(`Metrics:`);
        console.log(`  - Uptime: ${testReport.metrics.uptime.toFixed(2)}%`);
        console.log(`  - Avg Response Time: ${testReport.metrics.averageResponseTime.toFixed(2)}ms`);
        console.log(`  - Max Response Time: ${testReport.metrics.maxResponseTime.toFixed(2)}ms`);
        console.log(`  - Error Rate: ${testReport.metrics.errorRate.toFixed(2)}%`);
        console.log(`  - Memory Usage: ${testReport.metrics.memoryUsage.toFixed(2)}MB`);
        console.log(`Alerts: ${testReport.alerts.length}`);
        console.log(`Recommendations: ${testReport.recommendations.length}`);

        if (testReport.recommendations.length > 0) {
          console.log('\nRecommendations:');
          testReport.recommendations.forEach((rec, i) => {
            console.log(`  ${i + 1}. ${rec}`);
          });
        }

        // Save report to file
        const reportPath = path.join(tempDir, 'reliability-report.json');
        await fs.writeFile(reportPath, JSON.stringify(testReport, null, 2));

        // Validate overall reliability
        const overallReliabilityMet = 
          testReport.metrics.uptime >= TEST_CONFIG.thresholds.uptimeTarget &&
          testReport.metrics.averageResponseTime <= TEST_CONFIG.thresholds.maxResponseTime &&
          testReport.metrics.errorRate <= TEST_CONFIG.thresholds.maxErrorRate &&
          testReport.results.passed >= totalTests * 0.8; // 80% pass rate minimum

        expect(overallReliabilityMet).toBe(true);
        expect(testReport.results.passed).toBeGreaterThanOrEqual(Math.floor(totalTests * 0.8));
        
      } catch (error) {
        testReport.results.failed = totalTests;
        console.error('Reliability test suite failed:', error);
        throw error;
      }
    }, 60000); // 60 second timeout for comprehensive test
  });

  // Sub-test implementations
  async function testSystemStartup(): Promise<{ passed: boolean; message: string }> {
    try {
      // Test basic operations
      const testEntry = {
        title: 'Startup Test Entry',
        problem: 'System startup validation',
        solution: 'System should start and accept operations',
        category: 'Other' as const,
        tags: ['startup', 'test']
      };

      const entryId = await knowledgeDB.addEntry(testEntry);
      const retrieved = await knowledgeDB.getEntry(entryId);
      const searchResults = await knowledgeDB.search('Startup Test');

      const passed = !!(retrieved && searchResults.length > 0);
      return {
        passed,
        message: passed ? 'System startup successful' : 'System startup failed'
      };
    } catch (error) {
      return {
        passed: false,
        message: `System startup failed: ${(error as Error).message}`
      };
    }
  }

  async function testLoadHandling(): Promise<{ 
    passed: boolean; 
    averageResponseTime: number; 
    maxResponseTime: number;
    message: string;
  }> {
    const responseTimes: number[] = [];
    let operations = 0;
    let errors = 0;

    const startTime = Date.now();
    
    try {
      // Simulate load for configured duration
      while (Date.now() - startTime < TEST_CONFIG.testDuration.medium) {
        const operationStart = performance.now();
        
        try {
          // Mix of operations
          const operation = operations % 3;
          switch (operation) {
            case 0:
              await knowledgeDB.addEntry({
                title: `Load Test Entry ${operations}`,
                problem: `Load test problem ${operations}`,
                solution: `Load test solution ${operations}`,
                category: 'Other',
                tags: [`load-${operations}`]
              });
              break;
            case 1:
              await knowledgeDB.search(`Load Test ${Math.floor(operations / 3)}`);
              break;
            case 2:
              const entries = await knowledgeDB.getAllEntries();
              if (entries.length > 0) {
                await knowledgeDB.getEntry(entries[operations % entries.length].id!);
              }
              break;
          }
          
          const responseTime = performance.now() - operationStart;
          responseTimes.push(responseTime);
          performanceMonitor.recordOperation('load-test', responseTime, true);
          operations++;
          
        } catch (error) {
          const responseTime = performance.now() - operationStart;
          performanceMonitor.recordOperation('load-test', responseTime, false);
          errors++;
        }
        
        // Small delay to prevent overwhelming
        await new Promise(resolve => setTimeout(resolve, 2));
      }

      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const maxResponseTime = Math.max(...responseTimes);
      const errorRate = (errors / Math.max(operations + errors, 1)) * 100;

      const passed = 
        avgResponseTime <= TEST_CONFIG.thresholds.maxResponseTime &&
        maxResponseTime <= TEST_CONFIG.thresholds.maxResponseTime * 3 &&
        errorRate <= TEST_CONFIG.thresholds.maxErrorRate;

      return {
        passed,
        averageResponseTime: avgResponseTime,
        maxResponseTime: maxResponseTime,
        message: passed 
          ? `Load test passed: ${operations} operations, avg ${avgResponseTime.toFixed(2)}ms`
          : `Load test failed: avg ${avgResponseTime.toFixed(2)}ms, max ${maxResponseTime.toFixed(2)}ms, errors ${errorRate.toFixed(2)}%`
      };

    } catch (error) {
      return {
        passed: false,
        averageResponseTime: 0,
        maxResponseTime: 0,
        message: `Load test failed: ${(error as Error).message}`
      };
    }
  }

  async function testMemoryStability(): Promise<{ 
    passed: boolean; 
    memoryUsage: number;
    message: string;
  }> {
    const initialMemory = process.memoryUsage().heapUsed;
    
    try {
      // Create many entries and clean them up
      const entries: string[] = [];
      
      for (let i = 0; i < 100; i++) {
        const entryId = await knowledgeDB.addEntry({
          title: `Memory Test Entry ${i}`,
          problem: `Memory problem ${i} `.repeat(10), // Some bulk
          solution: `Memory solution ${i} `.repeat(10),
          category: 'Other',
          tags: [`memory-${i}`, 'bulk-test']
        });
        entries.push(entryId);
      }

      // Perform searches and retrievals
      for (let i = 0; i < 50; i++) {
        await knowledgeDB.search(`Memory Test ${i}`);
        if (entries[i]) {
          await knowledgeDB.getEntry(entries[i]);
        }
      }

      // Clean up entries
      for (const entryId of entries) {
        await knowledgeDB.deleteEntry(entryId);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (finalMemory - initialMemory) / (1024 * 1024); // MB
      
      // Memory growth should be reasonable
      const passed = memoryIncrease < 50; // Less than 50MB increase

      return {
        passed,
        memoryUsage: memoryIncrease,
        message: passed 
          ? `Memory stability test passed: ${memoryIncrease.toFixed(2)}MB increase`
          : `Memory stability test failed: ${memoryIncrease.toFixed(2)}MB increase`
      };

    } catch (error) {
      return {
        passed: false,
        memoryUsage: 0,
        message: `Memory test failed: ${(error as Error).message}`
      };
    }
  }

  async function testErrorHandling(): Promise<{ 
    passed: boolean; 
    errorRate: number;
    message: string;
  }> {
    let totalOperations = 0;
    let recoveredErrors = 0;

    try {
      // Test various error scenarios and recovery
      const errorScenarios = [
        // Invalid data
        async () => {
          try {
            await knowledgeDB.addEntry({
              title: '',  // Invalid empty title
              problem: 'Test',
              solution: 'Test',
              category: 'INVALID' as any,
              tags: []
            });
          } catch (error) {
            recoveredErrors++;
          }
          totalOperations++;
        },
        
        // Non-existent entry operations
        async () => {
          try {
            await knowledgeDB.getEntry('non-existent-id');
            await knowledgeDB.deleteEntry('non-existent-id');
          } catch (error) {
            recoveredErrors++;
          }
          totalOperations += 2;
        },

        // Concurrent operation conflicts
        async () => {
          try {
            const promises = Array.from({ length: 5 }, () =>
              knowledgeDB.addEntry({
                title: 'Concurrent Test',
                problem: 'Concurrent problem',
                solution: 'Concurrent solution',
                category: 'Other',
                tags: ['concurrent']
              })
            );
            await Promise.all(promises);
            totalOperations += 5;
          } catch (error) {
            recoveredErrors++;
            totalOperations += 5;
          }
        }
      ];

      // Run error scenarios multiple times
      for (let i = 0; i < 3; i++) {
        for (const scenario of errorScenarios) {
          await scenario();
        }
      }

      // Test recovery automation
      const recoverySuccess = await recoveryAutomation.attemptRecovery('database');
      if (recoverySuccess) {
        // Verify system is still operational after recovery
        const testEntry = await knowledgeDB.addEntry({
          title: 'Post-recovery test',
          problem: 'Testing after recovery',
          solution: 'Should work',
          category: 'Other',
          tags: ['recovery-test']
        });
        totalOperations++;
        if (testEntry) recoveredErrors++;
      }

      const errorRate = ((totalOperations - recoveredErrors) / totalOperations) * 100;
      const passed = errorRate <= TEST_CONFIG.thresholds.maxErrorRate * 2; // Allow higher error rate for error testing

      return {
        passed,
        errorRate,
        message: passed
          ? `Error handling test passed: ${errorRate.toFixed(2)}% unrecovered errors`
          : `Error handling test failed: ${errorRate.toFixed(2)}% unrecovered errors`
      };

    } catch (error) {
      return {
        passed: false,
        errorRate: 100,
        message: `Error handling test failed: ${(error as Error).message}`
      };
    }
  }

  async function testHealthMonitoring(): Promise<{ passed: boolean; message: string }> {
    try {
      // Wait for health checks to run
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check that health monitoring is working
      const systemStatus = healthMonitor.getSystemStatus();
      const alerts = healthMonitor.getAlerts();

      // Health monitoring should be operational
      const monitoringWorking = 
        systemStatus.uptime > 0 &&
        systemStatus.status !== HealthStatus.CRITICAL &&
        systemStatus.metrics !== null;

      return {
        passed: monitoringWorking,
        message: monitoringWorking
          ? `Health monitoring operational: ${systemStatus.status}, ${alerts.length} alerts`
          : `Health monitoring failed: status ${systemStatus.status}`
      };

    } catch (error) {
      return {
        passed: false,
        message: `Health monitoring test failed: ${(error as Error).message}`
      };
    }
  }

  async function testUptimeValidation(): Promise<{ 
    passed: boolean; 
    uptime: number;
    message: string;
  }> {
    try {
      // Simulate some downtime and recovery
      uptimeMonitor.recordDowntime();
      await new Promise(resolve => setTimeout(resolve, 100)); // 100ms downtime
      uptimeMonitor.recordUptime();

      // Get uptime statistics
      const stats = uptimeMonitor.getUptimeStats();
      const uptimePercentage = stats.availability;

      // For short test, uptime should still be high
      const passed = uptimePercentage >= 90; // 90% minimum for test

      return {
        passed,
        uptime: uptimePercentage,
        message: passed
          ? `Uptime validation passed: ${uptimePercentage.toFixed(2)}% availability`
          : `Uptime validation failed: ${uptimePercentage.toFixed(2)}% availability`
      };

    } catch (error) {
      return {
        passed: false,
        uptime: 0,
        message: `Uptime validation failed: ${(error as Error).message}`
      };
    }
  }

  function generateRecommendations(report: ReliabilityTestReport): string[] {
    const recommendations: string[] = [];

    // Performance recommendations
    if (report.metrics.averageResponseTime > 500) {
      recommendations.push('Consider optimizing database queries to improve response times');
    }

    if (report.metrics.maxResponseTime > 2000) {
      recommendations.push('Investigate slow operations that cause response time spikes');
    }

    // Memory recommendations
    if (report.metrics.memoryUsage > 100) {
      recommendations.push('Monitor memory usage patterns and consider implementing memory optimization');
    }

    // Error rate recommendations
    if (report.metrics.errorRate > 1) {
      recommendations.push('Review error handling mechanisms and add additional resilience');
    }

    // Uptime recommendations
    if (report.metrics.uptime < 99.5) {
      recommendations.push('Implement additional high availability measures to improve uptime');
    }

    // Alert-based recommendations
    const criticalAlerts = report.alerts.filter(a => a.severity === 'critical');
    if (criticalAlerts.length > 0) {
      recommendations.push('Address critical alerts to prevent system instability');
    }

    const memoryAlerts = report.alerts.filter(a => a.component === 'memory');
    if (memoryAlerts.length > 0) {
      recommendations.push('Implement memory usage monitoring and alerting');
    }

    // General recommendations
    if (report.results.failed > 0) {
      recommendations.push('Review failed tests and implement fixes for identified issues');
    }

    if (recommendations.length === 0) {
      recommendations.push('System is performing well within all reliability thresholds');
    }

    return recommendations;
  }
});