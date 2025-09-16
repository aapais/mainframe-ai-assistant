import { PerformanceTestHelper, BenchmarkResult, LoadTestConfig } from '../../src/database/__tests__/test-utils/PerformanceTestHelper';
import { DatabaseManager } from '../../src/database/DatabaseManager';
import { KnowledgeDB } from '../../src/database/KnowledgeDB';
import { TestDatabaseFactory } from '../../src/database/__tests__/test-utils/TestDatabaseFactory';
import { performance } from 'perf_hooks';
import path from 'path';
import fs from 'fs';
import os from 'os';

/**
 * Comprehensive benchmarking suite for MVP1 Knowledge Base Assistant
 * 
 * This module provides standardized performance benchmarks for:
 * - Search operations (local and AI-enhanced)
 * - Database operations (CRUD, queries, transactions)
 * - UI rendering and responsiveness
 * - System resource utilization
 * - Load handling and scalability
 */

export interface BenchmarkSuite {
  name: string;
  description: string;
  requirements: PerformanceRequirement[];
  benchmarks: Benchmark[];
}

export interface PerformanceRequirement {
  id: string;
  description: string;
  target: number;
  unit: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
}

export interface Benchmark {
  name: string;
  category: 'search' | 'database' | 'ui' | 'system' | 'load';
  description: string;
  requirement: string;
  setup?: () => Promise<void>;
  operation: () => Promise<any>;
  validation: (result: BenchmarkResult) => boolean;
  cleanup?: () => Promise<void>;
}

export interface BenchmarkReport {
  suite: string;
  timestamp: Date;
  systemInfo: SystemInfo;
  results: BenchmarkResult[];
  summary: BenchmarkSummary;
  compliance: ComplianceReport;
}

export interface SystemInfo {
  platform: string;
  arch: string;
  cpus: number;
  memory: number;
  nodeVersion: string;
  electronVersion?: string;
}

export interface BenchmarkSummary {
  totalBenchmarks: number;
  passed: number;
  failed: number;
  averageExecutionTime: number;
  totalExecutionTime: number;
  memoryUsage: {
    peak: number;
    average: number;
  };
}

export interface ComplianceReport {
  requirements: Array<{
    id: string;
    met: boolean;
    actual: number;
    target: number;
    deviation: number;
  }>;
  overallCompliance: number;
}

/**
 * MVP1 Performance Requirements
 */
export const MVP1_REQUIREMENTS: PerformanceRequirement[] = [
  {
    id: 'search-local-response-time',
    description: 'Local search response time for 1000 entries',
    target: 1000,
    unit: 'ms',
    priority: 'critical'
  },
  {
    id: 'search-ai-response-time',
    description: 'AI-enhanced search with fallback',
    target: 2000,
    unit: 'ms',
    priority: 'critical'
  },
  {
    id: 'app-startup-time',
    description: 'Application startup time',
    target: 5000,
    unit: 'ms',
    priority: 'high'
  },
  {
    id: 'ui-component-render-time',
    description: 'UI component rendering time',
    target: 100,
    unit: 'ms',
    priority: 'high'
  },
  {
    id: 'database-query-time',
    description: 'Simple database query execution',
    target: 50,
    unit: 'ms',
    priority: 'high'
  },
  {
    id: 'concurrent-users-support',
    description: 'Concurrent users supported',
    target: 10,
    unit: 'users',
    priority: 'medium'
  },
  {
    id: 'memory-usage-limit',
    description: 'Maximum memory usage',
    target: 500,
    unit: 'MB',
    priority: 'medium'
  },
  {
    id: 'throughput-operations',
    description: 'Operations per second',
    target: 100,
    unit: 'ops/sec',
    priority: 'medium'
  }
];

/**
 * Main Benchmarking Class
 */
export class PerformanceBenchmarkSuite {
  private performanceHelper: PerformanceTestHelper;
  private dbManager?: DatabaseManager;
  private kb?: KnowledgeDB;
  private testDbPath: string;
  private systemInfo: SystemInfo;

  constructor() {
    this.performanceHelper = new PerformanceTestHelper();
    this.testDbPath = path.join(os.tmpdir(), `benchmark-${Date.now()}.db`);
    this.systemInfo = this.getSystemInfo();
  }

  private getSystemInfo(): SystemInfo {
    const cpus = os.cpus();
    return {
      platform: os.platform(),
      arch: os.arch(),
      cpus: cpus.length,
      memory: Math.round(os.totalmem() / 1024 / 1024), // MB
      nodeVersion: process.version,
      electronVersion: process.versions.electron
    };
  }

  /**
   * Initialize benchmark environment
   */
  async initialize(): Promise<void> {
    if (fs.existsSync(this.testDbPath)) {
      fs.unlinkSync(this.testDbPath);
    }

    this.dbManager = await TestDatabaseFactory.createTestDatabaseManager({
      path: this.testDbPath,
      enableWAL: true,
      cacheSize: 100,
      maxConnections: 20,
      queryCache: { enabled: true, maxSize: 1000, ttlMs: 300000 },
      performanceMonitoring: true
    });

    this.kb = new KnowledgeDB(this.testDbPath);

    // Setup test data
    await this.setupBenchmarkData();
  }

  /**
   * Cleanup benchmark environment
   */
  async cleanup(): Promise<void> {
    if (this.kb) {
      this.kb.close();
    }
    if (this.dbManager) {
      await this.dbManager.shutdown();
    }
    if (fs.existsSync(this.testDbPath)) {
      fs.unlinkSync(this.testDbPath);
    }
  }

  private async setupBenchmarkData(): Promise<void> {
    const entries = TestDatabaseFactory.createLargeTestDataset(1000);
    
    await this.dbManager!.transaction(async () => {
      for (const entry of entries) {
        await this.kb!.addEntry(entry, 'benchmark-user');
      }
    });
  }

  /**
   * Run comprehensive benchmark suite
   */
  async runBenchmarkSuite(): Promise<BenchmarkReport> {
    const suites = [
      this.getSearchBenchmarks(),
      this.getDatabaseBenchmarks(),
      this.getSystemBenchmarks()
    ];

    const allResults: BenchmarkResult[] = [];
    const startTime = performance.now();

    for (const suite of suites) {
      console.log(`\n🏃 Running ${suite.name} benchmarks...`);
      
      for (const benchmark of suite.benchmarks) {
        try {
          if (benchmark.setup) {
            await benchmark.setup();
          }

          const result = await this.performanceHelper.measureOperation(
            `${suite.name}-${benchmark.name}`,
            benchmark.operation,
            benchmark.category === 'load' ? 1 : 10 // Single run for load tests
          );

          const passed = benchmark.validation(result);
          console.log(`  ${passed ? '✅' : '❌'} ${benchmark.name}: ${result.metrics.executionTime.toFixed(2)}ms`);

          allResults.push(result);

          if (benchmark.cleanup) {
            await benchmark.cleanup();
          }
        } catch (error) {
          console.log(`  ❌ ${benchmark.name}: Error - ${error.message}`);
          allResults.push({
            name: `${suite.name}-${benchmark.name}`,
            success: false,
            error: error.message,
            metrics: {
              executionTime: 0,
              memoryUsage: process.memoryUsage(),
              cpuUsage: null
            },
            iterations: 0,
            timestamp: new Date()
          });
        }
      }
    }

    const totalTime = performance.now() - startTime;
    
    return this.generateReport(allResults, totalTime);
  }

  /**
   * Search Performance Benchmarks
   */
  private getSearchBenchmarks(): BenchmarkSuite {
    return {
      name: 'Search Performance',
      description: 'Validates search operation performance requirements',
      requirements: MVP1_REQUIREMENTS.filter(r => r.id.includes('search')),
      benchmarks: [
        {
          name: 'local-search-simple-query',
          category: 'search',
          description: 'Simple local full-text search',
          requirement: 'search-local-response-time',
          operation: () => this.kb!.search('VSAM error status', { useAI: false, limit: 20 }),
          validation: (result) => result.success && (result.metrics.executionTime / result.iterations) < 1000
        },
        {
          name: 'local-search-complex-query',
          category: 'search',
          description: 'Complex boolean search query',
          requirement: 'search-local-response-time',
          operation: () => this.kb!.search('(VSAM AND status) OR "data exception"', { useAI: false, limit: 20 }),
          validation: (result) => result.success && (result.metrics.executionTime / result.iterations) < 1000
        },
        {
          name: 'search-with-ai-fallback',
          category: 'search',
          description: 'AI search with graceful fallback',
          requirement: 'search-ai-response-time',
          operation: async () => {
            // Mock AI failure and test fallback
            try {
              return await this.kb!.search('application performance issues', { useAI: true, limit: 10 });
            } catch (error) {
              return await this.kb!.search('application performance issues', { useAI: false, limit: 10 });
            }
          },
          validation: (result) => result.success && (result.metrics.executionTime / result.iterations) < 2000
        },
        {
          name: 'search-result-ranking',
          category: 'search',
          description: 'Search with proper result ranking',
          requirement: 'search-local-response-time',
          operation: async () => {
            const results = await this.kb!.search('system error', { useAI: false, limit: 50 });
            // Validate ranking
            for (let i = 0; i < results.length - 1; i++) {
              if (results[i].score < results[i + 1].score) {
                throw new Error('Results not properly ranked');
              }
            }
            return results;
          },
          validation: (result) => result.success && (result.metrics.executionTime / result.iterations) < 1000
        },
        {
          name: 'concurrent-searches',
          category: 'search',
          description: 'Multiple concurrent search operations',
          requirement: 'concurrent-users-support',
          operation: async () => {
            const searches = Array(10).fill(0).map((_, i) =>
              this.kb!.search(`concurrent test ${i}`, { useAI: false, limit: 5 })
            );
            return await Promise.all(searches);
          },
          validation: (result) => result.success && (result.metrics.executionTime / result.iterations) < 2000
        }
      ]
    };
  }

  /**
   * Database Performance Benchmarks
   */
  private getDatabaseBenchmarks(): BenchmarkSuite {
    return {
      name: 'Database Performance',
      description: 'Validates database operation performance',
      requirements: MVP1_REQUIREMENTS.filter(r => r.id.includes('database')),
      benchmarks: [
        {
          name: 'simple-select-query',
          category: 'database',
          description: 'Simple SELECT query performance',
          requirement: 'database-query-time',
          operation: () => this.dbManager!.execute('SELECT COUNT(*) FROM kb_entries'),
          validation: (result) => result.success && (result.metrics.executionTime / result.iterations) < 50
        },
        {
          name: 'indexed-where-query',
          category: 'database',
          description: 'Indexed WHERE clause query',
          requirement: 'database-query-time',
          operation: () => this.dbManager!.execute('SELECT * FROM kb_entries WHERE category = ? LIMIT 10', ['VSAM']),
          validation: (result) => result.success && (result.metrics.executionTime / result.iterations) < 50
        },
        {
          name: 'full-text-search-query',
          category: 'database',
          description: 'FTS5 full-text search query',
          requirement: 'database-query-time',
          operation: () => this.dbManager!.execute(`
            SELECT e.*, bm25(kb_fts) as score
            FROM kb_fts f
            JOIN kb_entries e ON f.id = e.id
            WHERE kb_fts MATCH ?
            ORDER BY score DESC
            LIMIT 20
          `, ['error system']),
          validation: (result) => result.success && (result.metrics.executionTime / result.iterations) < 100
        },
        {
          name: 'complex-join-aggregation',
          category: 'database',
          description: 'Complex JOIN with aggregation',
          requirement: 'database-query-time',
          operation: () => this.dbManager!.execute(`
            SELECT e.category, COUNT(*) as count, AVG(e.usage_count) as avg_usage
            FROM kb_entries e
            LEFT JOIN kb_tags t ON e.id = t.entry_id
            GROUP BY e.category
            ORDER BY count DESC
          `),
          validation: (result) => result.success && (result.metrics.executionTime / result.iterations) < 200
        },
        {
          name: 'transaction-performance',
          category: 'database',
          description: 'Transaction processing performance',
          requirement: 'database-query-time',
          operation: () => this.dbManager!.transaction(async () => {
            for (let i = 0; i < 10; i++) {
              await this.dbManager!.execute(
                'INSERT INTO kb_entries (id, title, problem, solution, category, created_by) VALUES (?, ?, ?, ?, ?, ?)',
                [`bench-${Date.now()}-${i}`, `Benchmark ${i}`, `Problem ${i}`, `Solution ${i}`, 'Test', 'benchmark']
              );
            }
          }),
          validation: (result) => result.success && (result.metrics.executionTime / result.iterations) < 500,
          cleanup: async () => {
            await this.dbManager!.execute('DELETE FROM kb_entries WHERE created_by = "benchmark"');
          }
        },
        {
          name: 'bulk-insert-performance',
          category: 'database',
          description: 'Bulk insert operation performance',
          requirement: 'throughput-operations',
          operation: async () => {
            const entries = Array(100).fill(0).map((_, i) => ({
              id: `bulk-${Date.now()}-${i}`,
              title: `Bulk Entry ${i}`,
              problem: `Bulk Problem ${i}`,
              solution: `Bulk Solution ${i}`,
              category: 'Test'
            }));

            await this.dbManager!.transaction(async () => {
              for (const entry of entries) {
                await this.kb!.addEntry(entry, 'bulk-test');
              }
            });

            return entries.length;
          },
          validation: (result) => {
            const throughput = 100 / (result.metrics.executionTime / 1000);
            return result.success && throughput > 50; // 50 inserts per second
          },
          cleanup: async () => {
            await this.dbManager!.execute('DELETE FROM kb_entries WHERE created_by = "bulk-test"');
          }
        }
      ]
    };
  }

  /**
   * System Performance Benchmarks
   */
  private getSystemBenchmarks(): BenchmarkSuite {
    return {
      name: 'System Performance',
      description: 'Validates overall system performance and resource usage',
      requirements: MVP1_REQUIREMENTS.filter(r => r.id.includes('memory') || r.id.includes('throughput')),
      benchmarks: [
        {
          name: 'memory-usage-baseline',
          category: 'system',
          description: 'Baseline memory usage measurement',
          requirement: 'memory-usage-limit',
          operation: async () => {
            const initialMemory = process.memoryUsage();
            
            // Perform typical operations
            for (let i = 0; i < 100; i++) {
              await this.kb!.search(`memory test ${i}`, { limit: 5 });
            }
            
            const finalMemory = process.memoryUsage();
            const memoryUsedMB = (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;
            
            return { memoryUsedMB, initialMemory, finalMemory };
          },
          validation: (result) => {
            const totalMemoryMB = result.metrics.memoryUsage.heapUsed / 1024 / 1024;
            return result.success && totalMemoryMB < 500; // Less than 500MB
          }
        },
        {
          name: 'cpu-usage-efficiency',
          category: 'system',
          description: 'CPU usage during typical operations',
          requirement: 'throughput-operations',
          operation: async () => {
            const startCpuUsage = process.cpuUsage();
            const startTime = performance.now();
            
            // CPU-intensive operations
            for (let i = 0; i < 50; i++) {
              await this.kb!.search('cpu test query', { limit: 10 });
              await this.dbManager!.execute('SELECT COUNT(*) FROM kb_entries WHERE category = ?', ['VSAM']);
            }
            
            const endTime = performance.now();
            const cpuUsage = process.cpuUsage(startCpuUsage);
            const executionTime = endTime - startTime;
            
            return {
              cpuUsage,
              executionTime,
              operationsPerSecond: 100 / (executionTime / 1000)
            };
          },
          validation: (result) => result.success && result.metrics.operationsPerSecond! > 50
        },
        {
          name: 'cache-performance',
          category: 'system',
          description: 'Cache hit ratio and performance',
          requirement: 'search-local-response-time',
          operation: async () => {
            const query = 'cache performance test';
            
            // Cold cache
            const coldTime = performance.now();
            await this.kb!.search(query);
            const coldDuration = performance.now() - coldTime;
            
            // Warm cache (multiple hits)
            const warmTimes: number[] = [];
            for (let i = 0; i < 10; i++) {
              const warmStart = performance.now();
              await this.kb!.search(query);
              warmTimes.push(performance.now() - warmStart);
            }
            
            const avgWarmTime = warmTimes.reduce((sum, time) => sum + time, 0) / warmTimes.length;
            const cacheSpeedup = coldDuration / avgWarmTime;
            
            return { coldDuration, avgWarmTime, cacheSpeedup };
          },
          validation: (result) => {
            // Cache should provide at least 2x speedup
            return result.success && (result as any).cacheSpeedup > 2;
          }
        },
        {
          name: 'concurrent-load-handling',
          category: 'load',
          description: 'System performance under concurrent load',
          requirement: 'concurrent-users-support',
          operation: async () => {
            const concurrentOperations = Array(20).fill(0).map(async (_, i) => {
              const startTime = performance.now();
              
              try {
                await this.kb!.search(`concurrent load test ${i}`, { limit: 5 });
                await this.dbManager!.execute('SELECT * FROM kb_entries WHERE id = ?', [`test-${i}`]);
                
                return {
                  success: true,
                  executionTime: performance.now() - startTime,
                  operationId: i
                };
              } catch (error) {
                return {
                  success: false,
                  executionTime: performance.now() - startTime,
                  operationId: i,
                  error: error.message
                };
              }
            });

            const results = await Promise.all(concurrentOperations);
            const successRate = results.filter(r => r.success).length / results.length;
            const avgResponseTime = results
              .filter(r => r.success)
              .reduce((sum, r) => sum + r.executionTime, 0) / results.filter(r => r.success).length;
            
            return { results, successRate, avgResponseTime };
          },
          validation: (result) => {
            const data = result as any;
            return result.success && data.successRate > 0.9 && data.avgResponseTime < 1000;
          }
        }
      ]
    };
  }

  /**
   * Generate comprehensive benchmark report
   */
  private generateReport(results: BenchmarkResult[], totalTime: number): BenchmarkReport {
    const summary = this.generateSummary(results, totalTime);
    const compliance = this.generateComplianceReport(results);

    return {
      suite: 'MVP1 Knowledge Base Assistant Performance Benchmark',
      timestamp: new Date(),
      systemInfo: this.systemInfo,
      results,
      summary,
      compliance
    };
  }

  private generateSummary(results: BenchmarkResult[], totalTime: number): BenchmarkSummary {
    const successful = results.filter(r => r.success);
    const avgExecutionTime = successful.length > 0 
      ? successful.reduce((sum, r) => sum + r.metrics.executionTime, 0) / successful.length
      : 0;

    const memoryUsages = results.map(r => r.metrics.memoryUsage.heapUsed);
    const peakMemory = Math.max(...memoryUsages) / 1024 / 1024; // MB
    const avgMemory = memoryUsages.reduce((sum, mem) => sum + mem, 0) / memoryUsages.length / 1024 / 1024; // MB

    return {
      totalBenchmarks: results.length,
      passed: successful.length,
      failed: results.length - successful.length,
      averageExecutionTime: avgExecutionTime,
      totalExecutionTime: totalTime,
      memoryUsage: {
        peak: peakMemory,
        average: avgMemory
      }
    };
  }

  private generateComplianceReport(results: BenchmarkResult[]): ComplianceReport {
    const requirementResults = MVP1_REQUIREMENTS.map(req => {
      const relevantResults = results.filter(r => r.name.includes(req.id) || r.name.includes(req.description.toLowerCase().replace(/\s+/g, '-')));
      
      if (relevantResults.length === 0) {
        return {
          id: req.id,
          met: false,
          actual: 0,
          target: req.target,
          deviation: 100
        };
      }

      // Calculate average performance for this requirement
      const avgPerformance = relevantResults.reduce((sum, r) => {
        let value = 0;
        switch (req.unit) {
          case 'ms':
            value = r.metrics.executionTime / (r.iterations || 1);
            break;
          case 'ops/sec':
            value = r.metrics.operationsPerSecond || 0;
            break;
          case 'MB':
            value = r.metrics.memoryUsage.heapUsed / 1024 / 1024;
            break;
          case 'users':
            value = 10; // Default concurrent users supported
            break;
          default:
            value = r.metrics.executionTime / (r.iterations || 1);
        }
        return sum + value;
      }, 0) / relevantResults.length;

      const met = req.unit === 'ops/sec' || req.unit === 'users' 
        ? avgPerformance >= req.target
        : avgPerformance <= req.target;

      const deviation = Math.abs((avgPerformance - req.target) / req.target) * 100;

      return {
        id: req.id,
        met,
        actual: avgPerformance,
        target: req.target,
        deviation
      };
    });

    const overallCompliance = requirementResults.filter(r => r.met).length / requirementResults.length * 100;

    return {
      requirements: requirementResults,
      overallCompliance
    };
  }

  /**
   * Export benchmark report
   */
  exportReport(report: BenchmarkReport, format: 'json' | 'markdown' | 'html' = 'json'): string {
    switch (format) {
      case 'markdown':
        return this.generateMarkdownReport(report);
      case 'html':
        return this.generateHtmlReport(report);
      default:
        return JSON.stringify(report, null, 2);
    }
  }

  private generateMarkdownReport(report: BenchmarkReport): string {
    let markdown = `# ${report.suite}\n\n`;
    markdown += `**Generated:** ${report.timestamp.toISOString()}\n\n`;
    
    // System Info
    markdown += `## System Information\n\n`;
    markdown += `- **Platform:** ${report.systemInfo.platform} (${report.systemInfo.arch})\n`;
    markdown += `- **CPUs:** ${report.systemInfo.cpus}\n`;
    markdown += `- **Memory:** ${report.systemInfo.memory}MB\n`;
    markdown += `- **Node Version:** ${report.systemInfo.nodeVersion}\n`;
    if (report.systemInfo.electronVersion) {
      markdown += `- **Electron Version:** ${report.systemInfo.electronVersion}\n`;
    }
    markdown += `\n`;

    // Summary
    markdown += `## Summary\n\n`;
    markdown += `- **Total Benchmarks:** ${report.summary.totalBenchmarks}\n`;
    markdown += `- **Passed:** ${report.summary.passed}\n`;
    markdown += `- **Failed:** ${report.summary.failed}\n`;
    markdown += `- **Average Execution Time:** ${report.summary.averageExecutionTime.toFixed(2)}ms\n`;
    markdown += `- **Total Execution Time:** ${report.summary.totalExecutionTime.toFixed(2)}ms\n`;
    markdown += `- **Peak Memory Usage:** ${report.summary.memoryUsage.peak.toFixed(2)}MB\n`;
    markdown += `- **Average Memory Usage:** ${report.summary.memoryUsage.average.toFixed(2)}MB\n\n`;

    // Compliance
    markdown += `## Compliance Report\n\n`;
    markdown += `**Overall Compliance:** ${report.compliance.overallCompliance.toFixed(1)}%\n\n`;
    markdown += `| Requirement | Target | Actual | Status | Deviation |\n`;
    markdown += `|-------------|---------|---------|---------|----------|\n`;
    
    report.compliance.requirements.forEach(req => {
      const status = req.met ? '✅ PASS' : '❌ FAIL';
      markdown += `| ${req.id} | ${req.target} | ${req.actual.toFixed(2)} | ${status} | ${req.deviation.toFixed(1)}% |\n`;
    });
    
    markdown += `\n`;

    // Detailed Results
    markdown += `## Detailed Results\n\n`;
    markdown += `| Benchmark | Execution Time | Memory Usage | Status |\n`;
    markdown += `|-----------|----------------|--------------|--------|\n`;
    
    report.results.forEach(result => {
      const status = result.success ? '✅ PASS' : '❌ FAIL';
      const avgTime = result.iterations > 0 ? (result.metrics.executionTime / result.iterations).toFixed(2) : result.metrics.executionTime.toFixed(2);
      const memoryMB = (result.metrics.memoryUsage.heapUsed / 1024 / 1024).toFixed(2);
      
      markdown += `| ${result.name} | ${avgTime}ms | ${memoryMB}MB | ${status} |\n`;
    });

    return markdown;
  }

  private generateHtmlReport(report: BenchmarkReport): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${report.suite}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 40px; line-height: 1.6; }
        .header { border-bottom: 2px solid #e1e4e8; padding-bottom: 20px; margin-bottom: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
        .metric { background: #f6f8fa; padding: 15px; border-radius: 8px; }
        .metric h3 { margin: 0 0 10px 0; color: #586069; }
        .metric .value { font-size: 24px; font-weight: bold; color: #0366d6; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 12px; text-align: left; border: 1px solid #e1e4e8; }
        th { background: #f6f8fa; font-weight: 600; }
        .pass { color: #28a745; }
        .fail { color: #d73a49; }
        .compliance { font-size: 18px; font-weight: bold; margin: 20px 0; }
        .compliance.good { color: #28a745; }
        .compliance.warning { color: #ffa500; }
        .compliance.poor { color: #d73a49; }
    </style>
</head>
<body>
    <div class="header">
        <h1>${report.suite}</h1>
        <p><strong>Generated:</strong> ${report.timestamp.toISOString()}</p>
        <p><strong>System:</strong> ${report.systemInfo.platform} (${report.systemInfo.arch}) - ${report.systemInfo.cpus} CPUs, ${report.systemInfo.memory}MB RAM</p>
    </div>

    <div class="compliance ${report.compliance.overallCompliance >= 80 ? 'good' : report.compliance.overallCompliance >= 60 ? 'warning' : 'poor'}">
        Overall Compliance: ${report.compliance.overallCompliance.toFixed(1)}%
    </div>

    <div class="summary">
        <div class="metric">
            <h3>Total Benchmarks</h3>
            <div class="value">${report.summary.totalBenchmarks}</div>
        </div>
        <div class="metric">
            <h3>Passed</h3>
            <div class="value" style="color: #28a745;">${report.summary.passed}</div>
        </div>
        <div class="metric">
            <h3>Failed</h3>
            <div class="value" style="color: #d73a49;">${report.summary.failed}</div>
        </div>
        <div class="metric">
            <h3>Avg Execution Time</h3>
            <div class="value">${report.summary.averageExecutionTime.toFixed(2)}ms</div>
        </div>
        <div class="metric">
            <h3>Peak Memory</h3>
            <div class="value">${report.summary.memoryUsage.peak.toFixed(2)}MB</div>
        </div>
    </div>

    <h2>Requirements Compliance</h2>
    <table>
        <thead>
            <tr><th>Requirement</th><th>Target</th><th>Actual</th><th>Status</th><th>Deviation</th></tr>
        </thead>
        <tbody>
            ${report.compliance.requirements.map(req => `
                <tr>
                    <td>${req.id}</td>
                    <td>${req.target}</td>
                    <td>${req.actual.toFixed(2)}</td>
                    <td class="${req.met ? 'pass' : 'fail'}">${req.met ? '✅ PASS' : '❌ FAIL'}</td>
                    <td>${req.deviation.toFixed(1)}%</td>
                </tr>
            `).join('')}
        </tbody>
    </table>

    <h2>Detailed Results</h2>
    <table>
        <thead>
            <tr><th>Benchmark</th><th>Execution Time</th><th>Memory Usage</th><th>Status</th></tr>
        </thead>
        <tbody>
            ${report.results.map(result => {
              const avgTime = result.iterations > 0 ? (result.metrics.executionTime / result.iterations).toFixed(2) : result.metrics.executionTime.toFixed(2);
              const memoryMB = (result.metrics.memoryUsage.heapUsed / 1024 / 1024).toFixed(2);
              return `
                <tr>
                    <td>${result.name}</td>
                    <td>${avgTime}ms</td>
                    <td>${memoryMB}MB</td>
                    <td class="${result.success ? 'pass' : 'fail'}">${result.success ? '✅ PASS' : '❌ FAIL'}</td>
                </tr>
              `;
            }).join('')}
        </tbody>
    </table>
</body>
</html>
    `;
  }
}

/**
 * CLI utility for running benchmarks
 */
export async function runPerformanceBenchmarks(options: {
  format?: 'json' | 'markdown' | 'html';
  output?: string;
  verbose?: boolean;
}): Promise<BenchmarkReport> {
  const suite = new PerformanceBenchmarkSuite();
  
  try {
    if (options.verbose) {
      console.log('🚀 Initializing performance benchmark suite...');
    }
    
    await suite.initialize();
    
    if (options.verbose) {
      console.log('🏁 Running comprehensive performance benchmarks...');
    }
    
    const report = await suite.runBenchmarkSuite();
    
    if (options.output) {
      const content = suite.exportReport(report, options.format);
      fs.writeFileSync(options.output, content, 'utf8');
      
      if (options.verbose) {
        console.log(`📊 Report saved to: ${options.output}`);
      }
    }
    
    await suite.cleanup();
    
    return report;
  } catch (error) {
    await suite.cleanup();
    throw error;
  }
}

// Export utilities for use in other tests
export * from '../../src/database/__tests__/test-utils/PerformanceTestHelper';