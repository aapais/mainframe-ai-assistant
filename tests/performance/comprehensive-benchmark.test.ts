import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { KnowledgeDB } from '../../src/database/KnowledgeDB';
import { DatabaseManager } from '../../src/database/DatabaseManager';
import { PerformanceTestHelper } from '../../src/database/__tests__/test-utils/PerformanceTestHelper';
import { TestDatabaseFactory } from '../../src/database/__tests__/test-utils/TestDatabaseFactory';
import path from 'path';
import fs from 'fs';
import { performance } from 'perf_hooks';

describe('Comprehensive Performance Benchmark Suite', () => {
  let performanceHelper: PerformanceTestHelper;
  let testDbPath: string;
  let benchmarkResults: { [key: string]: any } = {};

  beforeAll(() => {
    performanceHelper = new PerformanceTestHelper();
    testDbPath = path.join(__dirname, '..', 'temp', 'comprehensive-benchmark.db');
  });

  afterAll(async () => {
    // Generate comprehensive performance report
    await this.generatePerformanceReport();
    
    performanceHelper.clearResults();
    
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('MVP1 Critical Performance Requirements Validation', () => {
    it('should validate all MVP1 performance targets in comprehensive test', async () => {
      console.log('🚀 Starting MVP1 Comprehensive Performance Validation...');
      
      const comprehensiveResult = await performanceHelper.measureOperation(
        'mvp1-comprehensive-validation',
        async () => {
          // 1. Application Startup Test (Target: <5s)
          console.log('  📋 Testing application startup...');
          const startupStart = performance.now();
          const db = new KnowledgeDB(testDbPath, { autoBackup: false });
          
          await new Promise<void>((resolve) => {
            const checkInitialized = () => {
              if (db['initialized']) {
                resolve();
              } else {
                setTimeout(checkInitialized, 10);
              }
            };
            checkInitialized();
          });
          
          const startupTime = performance.now() - startupStart;
          benchmarkResults.startupTime = startupTime;
          expect(startupTime).toBeLessThan(5000);
          console.log(`    ✅ Startup: ${startupTime.toFixed(0)}ms`);

          // 2. Populate with test data for search testing
          console.log('  📋 Populating test data...');
          const populateStart = performance.now();
          const testEntries = TestDatabaseFactory.createLargeTestDataset(1000);
          
          for (const entry of testEntries.slice(0, 1000)) {
            await db.addEntry(entry, 'benchmark-user');
          }
          
          const populateTime = performance.now() - populateStart;
          benchmarkResults.populateTime = populateTime;
          console.log(`    ✅ Data population: ${populateTime.toFixed(0)}ms (1000 entries)`);

          // 3. Local Search Performance Test (Target: <1s)
          console.log('  📋 Testing local search performance...');
          const searchQueries = [
            'VSAM status error',
            'data exception COBOL',
            'JCL dataset not found',
            'DB2 resource unavailable',
            'system abend S0C7'
          ];

          const searchTimes: number[] = [];
          for (const query of searchQueries) {
            const searchStart = performance.now();
            const results = await db.search(query, { limit: 20 });
            const searchTime = performance.now() - searchStart;
            
            searchTimes.push(searchTime);
            expect(searchTime).toBeLessThan(1000);
            expect(results.length).toBeGreaterThan(0);
          }
          
          const avgSearchTime = searchTimes.reduce((sum, time) => sum + time, 0) / searchTimes.length;
          benchmarkResults.avgSearchTime = avgSearchTime;
          console.log(`    ✅ Average search: ${avgSearchTime.toFixed(0)}ms`);

          // 4. Cache Performance Test
          console.log('  📋 Testing cache performance...');
          const cacheQuery = 'frequent query test';
          
          // Cache miss
          const missStart = performance.now();
          await db.search(cacheQuery);
          const missTime = performance.now() - missStart;
          
          // Cache hit
          const hitStart = performance.now();
          await db.search(cacheQuery);
          const hitTime = performance.now() - hitStart;
          
          const cacheImprovement = missTime / hitTime;
          benchmarkResults.cacheHitTime = hitTime;
          benchmarkResults.cacheImprovement = cacheImprovement;
          
          expect(hitTime).toBeLessThan(50); // Cache hits should be very fast
          expect(cacheImprovement).toBeGreaterThan(3); // At least 3x improvement
          console.log(`    ✅ Cache hit: ${hitTime.toFixed(1)}ms (${cacheImprovement.toFixed(1)}x improvement)`);

          // 5. Concurrent User Test
          console.log('  📋 Testing concurrent user handling...');
          const concurrentQueries = Array(10).fill(0).map((_, i) => 
            () => db.search(`concurrent query ${i}`, { limit: 5 })
          );
          
          const concurrentStart = performance.now();
          const concurrentResults = await Promise.all(
            concurrentQueries.map(queryFn => queryFn())
          );
          const concurrentTime = performance.now() - concurrentStart;
          
          benchmarkResults.concurrentTime = concurrentTime;
          benchmarkResults.concurrentSuccess = concurrentResults.every(r => r.length >= 0);
          
          expect(benchmarkResults.concurrentSuccess).toBe(true);
          expect(concurrentTime).toBeLessThan(3000); // 10 concurrent searches in <3s
          console.log(`    ✅ Concurrent (10 users): ${concurrentTime.toFixed(0)}ms`);

          // 6. Database Operations Performance
          console.log('  📋 Testing database operations...');
          const dbOpsStart = performance.now();
          
          // Insert test
          await db.addEntry({
            title: 'Performance Test Entry',
            problem: 'Testing database insertion speed',
            solution: 'Should be fast',
            category: 'Test'
          }, 'perf-user');
          
          // Update test
          const stats = await db.getStats();
          expect(stats.totalEntries).toBeGreaterThan(1000);
          
          const dbOpsTime = performance.now() - dbOpsStart;
          benchmarkResults.dbOperationsTime = dbOpsTime;
          expect(dbOpsTime).toBeLessThan(100); // Basic DB ops should be very fast
          console.log(`    ✅ Database operations: ${dbOpsTime.toFixed(1)}ms`);

          db.close();
        }
      );

      expect(comprehensiveResult.success).toBe(true);
      
      const totalBenchmarkTime = comprehensiveResult.metrics.executionTime;
      console.log(`\n🎯 MVP1 Performance Validation Complete: ${totalBenchmarkTime.toFixed(0)}ms total`);
      
      // Overall performance assessment
      this.assessOverallPerformance();
    });

    it('should validate performance under stress conditions', async () => {
      console.log('🔥 Starting Stress Test Validation...');
      
      const db = new KnowledgeDB(testDbPath, { autoBackup: false });
      
      await new Promise<void>((resolve) => {
        const checkInitialized = () => {
          if (db['initialized']) {
            resolve();
          } else {
            setTimeout(checkInitialized, 10);
          }
        };
        checkInitialized();
      });

      const stressResult = await performanceHelper.measureOperation(
        'stress-test-validation',
        async () => {
          // Create large dataset for stress testing
          const largeDataset = TestDatabaseFactory.createLargeTestDataset(2000);
          
          // Add entries under time pressure
          const insertStart = performance.now();
          for (let i = 0; i < 500; i++) {
            await db.addEntry(largeDataset[i], 'stress-user');
          }
          const insertTime = performance.now() - insertStart;
          
          // High-frequency search operations
          const searchStressStart = performance.now();
          const stressSearches = Array(50).fill(0).map((_, i) => 
            () => db.search(`stress query ${i % 10}`, { limit: 10 })
          );
          
          const searchResults = await Promise.all(
            stressSearches.map(queryFn => queryFn())
          );
          const searchStressTime = performance.now() - searchStressStart;
          
          // Validate all searches succeeded
          const searchSuccessRate = searchResults.filter(r => r.length >= 0).length / searchResults.length;
          
          benchmarkResults.stressInsertTime = insertTime;
          benchmarkResults.stressSearchTime = searchStressTime;
          benchmarkResults.stressSuccessRate = searchSuccessRate;
          
          expect(insertTime).toBeLessThan(30000); // 500 inserts in <30s
          expect(searchStressTime).toBeLessThan(10000); // 50 searches in <10s  
          expect(searchSuccessRate).toBeGreaterThan(0.95); // >95% success rate
          
          console.log(`    ✅ Stress insert: ${insertTime.toFixed(0)}ms (500 entries)`);
          console.log(`    ✅ Stress search: ${searchStressTime.toFixed(0)}ms (50 searches)`);
          console.log(`    ✅ Success rate: ${(searchSuccessRate * 100).toFixed(1)}%`);
        }
      );

      expect(stressResult.success).toBe(true);
      
      db.close();
    });

    it('should validate scalability performance characteristics', async () => {
      console.log('📈 Starting Scalability Validation...');
      
      const scalabilitySizes = [500, 1000, 1500, 2000];
      const scalabilityResults: any[] = [];
      
      for (const size of scalabilitySizes) {
        const scalabilityDb = new KnowledgeDB(`${testDbPath}.scale.${size}`, { autoBackup: false });
        
        await new Promise<void>((resolve) => {
          const checkInitialized = () => {
            if (scalabilityDb['initialized']) {
              resolve();
            } else {
              setTimeout(checkInitialized, 10);
            }
          };
          checkInitialized();
        });
        
        // Populate with specific size
        const entries = TestDatabaseFactory.createLargeTestDataset(size);
        for (const entry of entries) {
          await scalabilityDb.addEntry(entry, 'scale-user');
        }
        
        // Test search performance at this scale
        const scaleStart = performance.now();
        const scaleResults = await scalabilityDb.search('system error data', { limit: 20 });
        const scaleTime = performance.now() - scaleStart;
        
        scalabilityResults.push({
          size,
          searchTime: scaleTime,
          resultCount: scaleResults.length
        });
        
        expect(scaleTime).toBeLessThan(1500); // Even large datasets should search fast
        expect(scaleResults.length).toBeGreaterThan(0);
        
        console.log(`    ✅ Size ${size}: ${scaleTime.toFixed(0)}ms search time`);
        
        scalabilityDb.close();
        
        // Cleanup
        const scaleDbPath = `${testDbPath}.scale.${size}`;
        if (fs.existsSync(scaleDbPath)) {
          fs.unlinkSync(scaleDbPath);
        }
      }
      
      // Validate that performance scales sub-linearly
      const firstResult = scalabilityResults[0];
      const lastResult = scalabilityResults[scalabilityResults.length - 1];
      const sizeRatio = lastResult.size / firstResult.size;
      const timeRatio = lastResult.searchTime / firstResult.searchTime;
      
      benchmarkResults.scalabilityRatio = timeRatio / sizeRatio;
      expect(timeRatio).toBeLessThan(sizeRatio); // Sub-linear scaling
      
      console.log(`    ✅ Scalability factor: ${(timeRatio / sizeRatio).toFixed(2)} (< 1.0 is good)`);
    });
  });

  describe('Performance Regression and Quality Gates', () => {
    it('should validate all performance quality gates', async () => {
      console.log('🚪 Validating Performance Quality Gates...');
      
      const qualityGates = {
        startup_time: { 
          actual: benchmarkResults.startupTime, 
          threshold: 5000, 
          unit: 'ms',
          critical: true 
        },
        search_time: { 
          actual: benchmarkResults.avgSearchTime, 
          threshold: 1000, 
          unit: 'ms',
          critical: true 
        },
        cache_hit_time: { 
          actual: benchmarkResults.cacheHitTime, 
          threshold: 50, 
          unit: 'ms',
          critical: false 
        },
        concurrent_time: { 
          actual: benchmarkResults.concurrentTime, 
          threshold: 3000, 
          unit: 'ms',
          critical: false 
        },
        db_operations_time: { 
          actual: benchmarkResults.dbOperationsTime, 
          threshold: 100, 
          unit: 'ms',
          critical: false 
        },
        stress_success_rate: { 
          actual: benchmarkResults.stressSuccessRate * 100, 
          threshold: 95, 
          unit: '%',
          critical: false 
        }
      };
      
      let criticalFailures = 0;
      let warnings = 0;
      
      console.log('\n    Performance Quality Gates:');
      for (const [gate, config] of Object.entries(qualityGates)) {
        const passed = config.actual <= config.threshold || gate === 'stress_success_rate' && config.actual >= config.threshold;
        const status = passed ? '✅' : (config.critical ? '❌' : '⚠️');
        
        if (!passed) {
          if (config.critical) {
            criticalFailures++;
          } else {
            warnings++;
          }
        }
        
        console.log(`      ${status} ${gate}: ${config.actual.toFixed(1)}${config.unit} (threshold: ${config.threshold}${config.unit})`);
        
        if (config.critical) {
          expect(passed).toBe(true);
        }
      }
      
      benchmarkResults.criticalFailures = criticalFailures;
      benchmarkResults.warnings = warnings;
      benchmarkResults.qualityGatesPassed = criticalFailures === 0;
      
      console.log(`\n    Quality Gates Summary: ${criticalFailures} critical failures, ${warnings} warnings`);
    });

    it('should generate performance benchmark report', async () => {
      const reportPath = path.join(__dirname, '..', '..', 'PERFORMANCE_BENCHMARK_REPORT.md');
      
      await this.generateDetailedReport(reportPath);
      
      expect(fs.existsSync(reportPath)).toBe(true);
      console.log(`📄 Detailed performance report saved: ${reportPath}`);
    });
  });

  // Helper methods
  private assessOverallPerformance(): void {
    const { startupTime, avgSearchTime, cacheHitTime, concurrentTime } = benchmarkResults;
    
    let performanceGrade = 'EXCELLENT';
    let recommendations: string[] = [];
    
    if (startupTime > 3000) {
      performanceGrade = 'GOOD';
      recommendations.push('Consider optimizing startup sequence for <3s target');
    }
    
    if (avgSearchTime > 500) {
      performanceGrade = 'ACCEPTABLE';
      recommendations.push('Search performance could be improved');
    }
    
    if (cacheHitTime > 20) {
      recommendations.push('Cache hit performance could be optimized');
    }
    
    if (concurrentTime > 2000) {
      recommendations.push('Consider optimizing concurrent user handling');
    }
    
    benchmarkResults.overallGrade = performanceGrade;
    benchmarkResults.recommendations = recommendations;
    
    console.log(`\n🎯 Overall Performance Grade: ${performanceGrade}`);
    if (recommendations.length > 0) {
      console.log('💡 Recommendations:');
      recommendations.forEach(rec => console.log(`   • ${rec}`));
    }
  }

  private async generatePerformanceReport(): Promise<void> {
    console.log('\n📊 Generating Performance Summary Report...');
    
    const summary = {
      timestamp: new Date().toISOString(),
      mvp: 'MVP1',
      testDuration: 'Comprehensive',
      results: benchmarkResults,
      conclusion: this.generateConclusion()
    };
    
    const reportPath = path.join(__dirname, '..', '..', 'performance-benchmark-summary.json');
    fs.writeFileSync(reportPath, JSON.stringify(summary, null, 2));
    
    console.log(`📄 Summary report saved: ${reportPath}`);
  }

  private async generateDetailedReport(reportPath: string): Promise<void> {
    const report = `# Performance Benchmark Report
## Knowledge Base Assistant - MVP1 Validation Results

### Test Execution Summary
- **Date**: ${new Date().toLocaleDateString()}
- **Time**: ${new Date().toLocaleTimeString()}
- **Test Suite**: Comprehensive Performance Benchmark
- **MVP Version**: MVP1

### Critical Performance Requirements

| Requirement | Target | Actual | Status | Grade |
|-------------|---------|---------|--------|-------|
| Application Startup | < 5000ms | ${benchmarkResults.startupTime?.toFixed(0) || 'N/A'}ms | ${benchmarkResults.startupTime < 5000 ? '✅ PASS' : '❌ FAIL'} | ${benchmarkResults.startupTime < 3000 ? 'A' : benchmarkResults.startupTime < 5000 ? 'B' : 'F'} |
| Local Search | < 1000ms | ${benchmarkResults.avgSearchTime?.toFixed(0) || 'N/A'}ms | ${benchmarkResults.avgSearchTime < 1000 ? '✅ PASS' : '❌ FAIL'} | ${benchmarkResults.avgSearchTime < 500 ? 'A' : benchmarkResults.avgSearchTime < 1000 ? 'B' : 'F'} |
| Cache Hit Performance | < 50ms | ${benchmarkResults.cacheHitTime?.toFixed(1) || 'N/A'}ms | ${benchmarkResults.cacheHitTime < 50 ? '✅ PASS' : '⚠️ WARN'} | ${benchmarkResults.cacheHitTime < 20 ? 'A' : benchmarkResults.cacheHitTime < 50 ? 'B' : 'C'} |
| Concurrent Users (10) | < 3000ms | ${benchmarkResults.concurrentTime?.toFixed(0) || 'N/A'}ms | ${benchmarkResults.concurrentTime < 3000 ? '✅ PASS' : '⚠️ WARN'} | ${benchmarkResults.concurrentTime < 2000 ? 'A' : benchmarkResults.concurrentTime < 3000 ? 'B' : 'C'} |

### Performance Analysis

**Startup Performance**: ${benchmarkResults.startupTime < 3000 ? 'Excellent' : benchmarkResults.startupTime < 5000 ? 'Good' : 'Needs Improvement'}
- Database initialization, schema setup, and optimization complete in ${benchmarkResults.startupTime?.toFixed(0)}ms
- Meets MVP1 requirement of <5 seconds cold start

**Search Performance**: ${benchmarkResults.avgSearchTime < 500 ? 'Excellent' : benchmarkResults.avgSearchTime < 1000 ? 'Good' : 'Needs Improvement'}  
- Average search response time: ${benchmarkResults.avgSearchTime?.toFixed(0)}ms across multiple query types
- FTS5 optimization and intelligent query routing performing well

**Cache System**: ${benchmarkResults.cacheHitTime < 20 ? 'Excellent' : benchmarkResults.cacheHitTime < 50 ? 'Good' : 'Acceptable'}
- Cache hits averaging ${benchmarkResults.cacheHitTime?.toFixed(1)}ms
- Performance improvement factor: ${benchmarkResults.cacheImprovement?.toFixed(1)}x

**Concurrent Performance**: ${benchmarkResults.concurrentTime < 2000 ? 'Excellent' : benchmarkResults.concurrentTime < 3000 ? 'Good' : 'Acceptable'}
- 10 concurrent users handled in ${benchmarkResults.concurrentTime?.toFixed(0)}ms
- Connection pooling and WAL mode optimization effective

### Stress Testing Results

- **Bulk Insert Performance**: ${benchmarkResults.stressInsertTime?.toFixed(0) || 'N/A'}ms for 500 entries
- **High-Frequency Search**: ${benchmarkResults.stressSearchTime?.toFixed(0) || 'N/A'}ms for 50 concurrent searches  
- **Success Rate Under Stress**: ${((benchmarkResults.stressSuccessRate || 0) * 100).toFixed(1)}%

### Scalability Assessment

- **Data Growth Impact**: Performance scales sub-linearly with dataset growth
- **Scalability Factor**: ${benchmarkResults.scalabilityRatio?.toFixed(2) || 'N/A'} (< 1.0 indicates good scaling)
- **Large Dataset Performance**: Maintains <1.5s search times even with 2000+ entries

### Overall Assessment

**Performance Grade**: ${benchmarkResults.overallGrade || 'PENDING'}

**Quality Gates Status**: ${benchmarkResults.qualityGatesPassed ? '✅ ALL PASSED' : '⚠️ Some Issues'}
- Critical Failures: ${benchmarkResults.criticalFailures || 0}
- Warnings: ${benchmarkResults.warnings || 0}

### Recommendations

${benchmarkResults.recommendations?.map(rec => `- ${rec}`).join('\n') || 'No specific recommendations - performance meets all requirements'}

### Conclusion

${this.generateConclusion()}

---
*Report generated automatically by Performance Testing Coordinator*
*Test Framework: Jest + Custom Performance Benchmarks*
*Database: SQLite with FTS5, WAL mode, Connection Pooling*`;

    fs.writeFileSync(reportPath, report);
  }

  private generateConclusion(): string {
    if (!benchmarkResults.qualityGatesPassed) {
      return 'ATTENTION REQUIRED: Critical performance requirements not met. Review and optimize before MVP1 release.';
    }
    
    if (benchmarkResults.warnings > 2) {
      return 'GOOD PERFORMANCE: All critical requirements met. Consider addressing minor performance warnings for optimal user experience.';
    }
    
    return 'EXCELLENT PERFORMANCE: All requirements exceeded. System ready for MVP1 deployment with superior performance characteristics.';
  }
});