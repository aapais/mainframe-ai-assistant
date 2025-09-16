import { KnowledgeDB } from '../../../src/services/database/KnowledgeDB';
import { SearchService } from '../../../src/services/SearchService';
import { PatternDetectionService } from '../../../src/services/PatternDetectionService';
import { PerformanceMonitor } from './benchmark-runner';
import { promises as fs } from 'fs';
import path from 'path';

interface LoadTestResult {
  scenario: string;
  concurrentUsers: number;
  duration: number;
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  avgResponseTime: number;
  p95ResponseTime: number;
  throughput: number;
  errorRate: number;
  maxMemoryMB: number;
  cpuUsagePercent: number;
}

describe('Load Testing Scenarios', () => {
  let db: KnowledgeDB;
  let searchService: SearchService;
  let patternService: PatternDetectionService;
  let perfMonitor: PerformanceMonitor;
  let testDataPath: string;

  beforeAll(async () => {
    testDataPath = path.join(__dirname, '../../fixtures/load-test-kb.db');
    
    // Clean slate
    try {
      await fs.unlink(testDataPath);
    } catch {}
    
    db = new KnowledgeDB(testDataPath);
    searchService = new SearchService(db);
    patternService = new PatternDetectionService(db);
    perfMonitor = new PerformanceMonitor();
    
    // Seed with comprehensive test data
    await seedLoadTestData();
  });

  afterAll(async () => {
    db.close();
  });

  describe('Concurrent User Load Tests', () => {
    test('should handle 10 concurrent search users', async () => {
      const concurrentUsers = 10;
      const testDuration = 30000; // 30 seconds
      const result = await runConcurrentSearchLoad(concurrentUsers, testDuration);
      
      expect(result.errorRate).toBeLessThan(0.01); // <1% error rate
      expect(result.avgResponseTime).toBeLessThan(1000); // <1s average
      expect(result.p95ResponseTime).toBeLessThan(2000); // <2s P95
      expect(result.throughput).toBeGreaterThan(5); // >5 ops/sec per user
      expect(result.maxMemoryMB).toBeLessThan(512); // Memory constraint
      
      await logLoadTestResult(result);
    });

    test('should handle 25 concurrent search users with degraded performance', async () => {
      const concurrentUsers = 25;
      const testDuration = 30000;
      const result = await runConcurrentSearchLoad(concurrentUsers, testDuration);
      
      expect(result.errorRate).toBeLessThan(0.05); // <5% error rate acceptable
      expect(result.avgResponseTime).toBeLessThan(2000); // <2s average (degraded)
      expect(result.p95ResponseTime).toBeLessThan(5000); // <5s P95 (degraded)
      expect(result.maxMemoryMB).toBeLessThan(1024); // Higher memory limit
      
      await logLoadTestResult(result);
    });

    test('should handle mixed read/write operations', async () => {
      const concurrentUsers = 15;
      const testDuration = 45000; // 45 seconds
      const result = await runMixedWorkload(concurrentUsers, testDuration);
      
      expect(result.errorRate).toBeLessThan(0.02); // <2% error rate
      expect(result.avgResponseTime).toBeLessThan(1500); // Slightly higher for writes
      expect(result.throughput).toBeGreaterThan(3); // Lower throughput for mixed ops
      
      await logLoadTestResult(result);
    });
  });

  describe('Database Performance Under Load', () => {
    test('should maintain database performance with concurrent writes', async () => {
      const concurrentWriters = 5;
      const entriesPerWriter = 50;
      const results: number[] = [];
      
      perfMonitor.startResourceMonitoring();
      
      const writeOperations = Array.from({ length: concurrentWriters }, async (_, writerId) => {
        for (let i = 0; i < entriesPerWriter; i++) {
          const startTime = performance.now();
          
          await db.addEntry({
            title: `Concurrent Entry Writer${writerId}-${i}`,
            problem: `Problem from writer ${writerId}, entry ${i}`,
            solution: `Solution for concurrent testing`,
            category: 'Batch',
            tags: [`writer-${writerId}`, `entry-${i}`, 'concurrent-test']
          });
          
          results.push(performance.now() - startTime);
        }
      });
      
      await Promise.all(writeOperations);
      
      const resourceUsage = perfMonitor.stopResourceMonitoring();
      
      // Analyze write performance
      const avgWriteTime = results.reduce((sum, time) => sum + time, 0) / results.length;
      const sortedTimes = results.sort((a, b) => a - b);
      const p95WriteTime = sortedTimes[Math.floor(sortedTimes.length * 0.95)];
      
      expect(avgWriteTime).toBeLessThan(500); // <500ms average write
      expect(p95WriteTime).toBeLessThan(1000); // <1s P95 write
      expect(resourceUsage.maxMemoryMB).toBeLessThan(768);
      
      await logLoadTestResult({
        scenario: 'concurrent_writes',
        concurrentUsers: concurrentWriters,
        duration: Math.max(...results),
        totalOperations: results.length,
        successfulOperations: results.length,
        failedOperations: 0,
        avgResponseTime: avgWriteTime,
        p95ResponseTime: p95WriteTime,
        throughput: results.length / (Math.max(...results) / 1000),
        errorRate: 0,
        maxMemoryMB: resourceUsage.maxMemoryMB,
        cpuUsagePercent: resourceUsage.avgCpuPercent
      });
    });

    test('should handle database locks gracefully', async () => {
      const concurrentOperations = 20;
      const lockTestResults: Array<{ success: boolean; time: number }> = [];
      
      // Simulate high contention scenario
      const operations = Array.from({ length: concurrentOperations }, async (_, i) => {
        try {
          const startTime = performance.now();
          
          // Mix of reads and writes to same data
          if (i % 2 === 0) {
            await db.addEntry({
              title: `Lock Test Entry ${i}`,
              problem: 'Testing database locks',
              solution: 'Lock test solution',
              category: 'JCL',
              tags: ['lock-test']
            });
          } else {
            await searchService.searchLocal('Lock Test');
          }
          
          lockTestResults.push({
            success: true,
            time: performance.now() - startTime
          });
        } catch (error) {
          lockTestResults.push({
            success: false,
            time: 0
          });
        }
      });
      
      await Promise.all(operations);
      
      const successRate = lockTestResults.filter(r => r.success).length / lockTestResults.length;
      const avgTime = lockTestResults
        .filter(r => r.success)
        .reduce((sum, r) => sum + r.time, 0) / lockTestResults.filter(r => r.success).length;
      
      expect(successRate).toBeGreaterThan(0.95); // >95% success rate
      expect(avgTime).toBeLessThan(2000); // <2s average (allowing for lock waits)
    });
  });

  describe('Pattern Detection Load', () => {
    test('should handle pattern detection with large incident volumes', async () => {
      const batchSize = 100;
      const batches = 10;
      const results: number[] = [];
      
      perfMonitor.startResourceMonitoring();
      
      for (let batch = 0; batch < batches; batch++) {
        const incidents = generateIncidentBatch(batchSize, batch);
        
        const startTime = performance.now();
        await patternService.processIncidentBatch(incidents);
        results.push(performance.now() - startTime);
      }
      
      const resourceUsage = perfMonitor.stopResourceMonitoring();
      
      const avgBatchTime = results.reduce((sum, time) => sum + time, 0) / results.length;
      const throughput = (batchSize * batches) / (results.reduce((sum, time) => sum + time, 0) / 1000);
      
      expect(avgBatchTime).toBeLessThan(5000); // <5s per 100 incidents
      expect(throughput).toBeGreaterThan(50); // >50 incidents/second
      expect(resourceUsage.maxMemoryMB).toBeLessThan(1024);
      
      await logLoadTestResult({
        scenario: 'pattern_detection_load',
        concurrentUsers: 1,
        duration: results.reduce((sum, time) => sum + time, 0),
        totalOperations: batchSize * batches,
        successfulOperations: batchSize * batches,
        failedOperations: 0,
        avgResponseTime: avgBatchTime,
        p95ResponseTime: Math.max(...results),
        throughput,
        errorRate: 0,
        maxMemoryMB: resourceUsage.maxMemoryMB,
        cpuUsagePercent: resourceUsage.avgCpuPercent
      });
    });
  });

  describe('Stress Testing', () => {
    test('should survive extreme load conditions', async () => {
      const extremeUsers = 50;
      const testDuration = 60000; // 1 minute
      
      // This test is expected to show degraded performance but not crash
      const result = await runConcurrentSearchLoad(extremeUsers, testDuration);
      
      expect(result.errorRate).toBeLessThan(0.1); // <10% error rate under extreme load
      expect(result.maxMemoryMB).toBeLessThan(2048); // Should not exceed 2GB
      expect(result.successfulOperations).toBeGreaterThan(0); // System should remain functional
      
      await logLoadTestResult(result);
    });

    test('should recover gracefully after load spikes', async () => {
      // Normal load baseline
      const baselineResult = await runConcurrentSearchLoad(5, 10000);
      
      // Spike load
      await runConcurrentSearchLoad(30, 15000);
      
      // Recovery measurement
      const recoveryResult = await runConcurrentSearchLoad(5, 10000);
      
      // Performance should return to baseline levels (within 20%)
      expect(recoveryResult.avgResponseTime).toBeLessThan(baselineResult.avgResponseTime * 1.2);
      expect(recoveryResult.throughput).toBeGreaterThan(baselineResult.throughput * 0.8);
    });
  });

  // Helper functions
  async function runConcurrentSearchLoad(concurrentUsers: number, duration: number): Promise<LoadTestResult> {
    const startTime = Date.now();
    const results: Array<{ success: boolean; responseTime: number }> = [];
    const searchQueries = [
      'VSAM error',
      'S0C7 abend',
      'JCL dataset',
      'DB2 SQL error',
      'CICS transaction',
      'batch job failure',
      'file not found',
      'data exception'
    ];
    
    perfMonitor.startResourceMonitoring();
    
    const userOperations = Array.from({ length: concurrentUsers }, async (_, userId) => {
      const userResults: Array<{ success: boolean; responseTime: number }> = [];
      
      while (Date.now() - startTime < duration) {
        try {
          const query = searchQueries[Math.floor(Math.random() * searchQueries.length)];
          const opStartTime = performance.now();
          
          await searchService.searchLocal(query);
          
          userResults.push({
            success: true,
            responseTime: performance.now() - opStartTime
          });
          
          // Small delay between operations
          await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
        } catch (error) {
          userResults.push({
            success: false,
            responseTime: 0
          });
        }
      }
      
      return userResults;
    });
    
    const allUserResults = await Promise.all(userOperations);
    const flatResults = allUserResults.flat();
    results.push(...flatResults);
    
    const resourceUsage = perfMonitor.stopResourceMonitoring();
    
    const successfulOps = results.filter(r => r.success);
    const responseTimes = successfulOps.map(r => r.responseTime);
    responseTimes.sort((a, b) => a - b);
    
    const totalOperations = results.length;
    const successfulOperations = successfulOps.length;
    const failedOperations = totalOperations - successfulOperations;
    
    return {
      scenario: `concurrent_search_${concurrentUsers}_users`,
      concurrentUsers,
      duration,
      totalOperations,
      successfulOperations,
      failedOperations,
      avgResponseTime: responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length || 0,
      p95ResponseTime: responseTimes[Math.floor(responseTimes.length * 0.95)] || 0,
      throughput: successfulOperations / (duration / 1000),
      errorRate: failedOperations / totalOperations,
      maxMemoryMB: resourceUsage.maxMemoryMB,
      cpuUsagePercent: resourceUsage.avgCpuPercent
    };
  }

  async function runMixedWorkload(concurrentUsers: number, duration: number): Promise<LoadTestResult> {
    const startTime = Date.now();
    const results: Array<{ success: boolean; responseTime: number; operation: string }> = [];
    
    perfMonitor.startResourceMonitoring();
    
    const userOperations = Array.from({ length: concurrentUsers }, async (_, userId) => {
      const userResults: Array<{ success: boolean; responseTime: number; operation: string }> = [];
      
      while (Date.now() - startTime < duration) {
        try {
          const opStartTime = performance.now();
          
          // 70% reads, 30% writes
          if (Math.random() < 0.7) {
            // Read operation
            await searchService.searchLocal('mixed workload test');
            userResults.push({
              success: true,
              responseTime: performance.now() - opStartTime,
              operation: 'read'
            });
          } else {
            // Write operation
            await db.addEntry({
              title: `Mixed Workload Entry ${userId}-${Date.now()}`,
              problem: 'Mixed workload test problem',
              solution: 'Mixed workload test solution',
              category: 'Batch',
              tags: ['mixed-workload', `user-${userId}`]
            });
            userResults.push({
              success: true,
              responseTime: performance.now() - opStartTime,
              operation: 'write'
            });
          }
          
          // Variable delay
          await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 150));
        } catch (error) {
          userResults.push({
            success: false,
            responseTime: 0,
            operation: 'error'
          });
        }
      }
      
      return userResults;
    });
    
    const allUserResults = await Promise.all(userOperations);
    const flatResults = allUserResults.flat();
    results.push(...flatResults);
    
    const resourceUsage = perfMonitor.stopResourceMonitoring();
    
    const successfulOps = results.filter(r => r.success);
    const responseTimes = successfulOps.map(r => r.responseTime);
    responseTimes.sort((a, b) => a - b);
    
    return {
      scenario: `mixed_workload_${concurrentUsers}_users`,
      concurrentUsers,
      duration,
      totalOperations: results.length,
      successfulOperations: successfulOps.length,
      failedOperations: results.length - successfulOps.length,
      avgResponseTime: responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length || 0,
      p95ResponseTime: responseTimes[Math.floor(responseTimes.length * 0.95)] || 0,
      throughput: successfulOps.length / (duration / 1000),
      errorRate: (results.length - successfulOps.length) / results.length,
      maxMemoryMB: resourceUsage.maxMemoryMB,
      cpuUsagePercent: resourceUsage.avgCpuPercent
    };
  }

  function generateIncidentBatch(size: number, batchId: number): any[] {
    const errorCodes = ['S0C7', 'S0C4', 'U4038', 'U0778', 'IEF212I'];
    const components = ['PAYROLL', 'BILLING', 'REPORTS', 'BATCH', 'ONLINE'];
    
    return Array.from({ length: size }, (_, i) => ({
      id: `batch${batchId}-incident${i}`,
      timestamp: new Date(Date.now() - Math.random() * 86400000), // Within last 24h
      title: `${errorCodes[i % errorCodes.length]} error in ${components[i % components.length]}`,
      description: `Batch ${batchId} incident ${i} for load testing`,
      component: components[i % components.length],
      severity: ['low', 'medium', 'high', 'critical'][i % 4]
    }));
  }

  async function seedLoadTestData(): Promise<void> {
    const categories = ['JCL', 'VSAM', 'DB2', 'Batch', 'Functional'];
    const baseEntries = [
      {
        title: 'VSAM Status Error',
        problem: 'VSAM file access error',
        solution: 'Check file catalog and permissions'
      },
      {
        title: 'JCL Dataset Issue',
        problem: 'Dataset allocation failure',
        solution: 'Verify dataset parameters'
      },
      {
        title: 'S0C7 Data Exception',
        problem: 'Numeric data error in program',
        solution: 'Check data definitions and initialization'
      }
    ];

    // Create 2000+ entries for load testing
    for (let i = 0; i < 2000; i++) {
      const baseEntry = baseEntries[i % baseEntries.length];
      await db.addEntry({
        title: `${baseEntry.title} - Load Test ${i}`,
        problem: `${baseEntry.problem} Entry ${i} for load testing`,
        solution: `${baseEntry.solution} - Solution ${i}`,
        category: categories[i % categories.length],
        tags: ['load-test', `entry-${i}`, categories[i % categories.length].toLowerCase()]
      });
    }
  }

  async function logLoadTestResult(result: LoadTestResult): Promise<void> {
    const logPath = path.join(__dirname, '../../../load-test-results.json');
    let existingResults: LoadTestResult[] = [];
    
    try {
      const data = await fs.readFile(logPath, 'utf8');
      existingResults = JSON.parse(data);
    } catch {
      // File doesn't exist yet
    }
    
    existingResults.push({
      ...result,
      timestamp: new Date().toISOString()
    } as any);
    
    await fs.writeFile(logPath, JSON.stringify(existingResults, null, 2));
    
    // Also log to console for immediate feedback
    console.log(`Load Test Result: ${result.scenario}`);
    console.log(`  Concurrent Users: ${result.concurrentUsers}`);
    console.log(`  Total Operations: ${result.totalOperations}`);
    console.log(`  Success Rate: ${((1 - result.errorRate) * 100).toFixed(2)}%`);
    console.log(`  Average Response Time: ${result.avgResponseTime.toFixed(2)}ms`);
    console.log(`  P95 Response Time: ${result.p95ResponseTime.toFixed(2)}ms`);
    console.log(`  Throughput: ${result.throughput.toFixed(2)} ops/sec`);
    console.log(`  Max Memory: ${result.maxMemoryMB.toFixed(2)}MB`);
  }
});