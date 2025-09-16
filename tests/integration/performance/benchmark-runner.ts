import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

export interface PerformanceMetrics {
  timestamp: string;
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  cpuUsage: {
    user: number;
    system: number;
  };
  eventLoopDelay: number;
}

export interface ResourceUsage {
  maxMemoryMB: number;
  avgMemoryMB: number;
  memoryGrowthMB: number;
  avgCpuPercent: number;
  maxCpuPercent: number;
  eventLoopDelayP95: number;
  samplingDurationMs: number;
}

export interface BenchmarkResult {
  testName: string;
  startTime: string;
  endTime: string;
  duration: number;
  metrics: PerformanceMetrics[];
  resourceUsage: ResourceUsage;
  customMetrics: Record<string, any>;
  passed: boolean;
  errors: string[];
}

export interface PerformanceThresholds {
  maxMemoryMB?: number;
  maxAvgResponseTimeMs?: number;
  maxP95ResponseTimeMs?: number;
  minThroughputOpsPerSec?: number;
  maxErrorRate?: number;
  maxEventLoopDelayMs?: number;
}

export class PerformanceMonitor extends EventEmitter {
  private metrics: PerformanceMetrics[] = [];
  private monitoring = false;
  private monitoringInterval?: NodeJS.Timeout;
  private samplingIntervalMs = 100;
  private eventLoopMonitor?: any;

  constructor() {
    super();
    this.setupEventLoopMonitoring();
  }

  private setupEventLoopMonitoring() {
    // Simple event loop delay monitoring
    let start = process.hrtime.bigint();
    this.eventLoopMonitor = setInterval(() => {
      const delta = process.hrtime.bigint() - start;
      const delayMs = Number(delta) / 1000000 - this.samplingIntervalMs;
      
      if (this.monitoring) {
        this.emit('eventLoopDelay', Math.max(0, delayMs));
      }
      
      start = process.hrtime.bigint();
    }, this.samplingIntervalMs);
  }

  startResourceMonitoring(): void {
    if (this.monitoring) return;
    
    this.monitoring = true;
    this.metrics = [];
    
    // Initial CPU usage reading
    let lastCpuUsage = process.cpuUsage();
    
    this.monitoringInterval = setInterval(() => {
      const currentCpuUsage = process.cpuUsage(lastCpuUsage);
      lastCpuUsage = process.cpuUsage();
      
      const metric: PerformanceMetrics = {
        timestamp: new Date().toISOString(),
        memoryUsage: process.memoryUsage(),
        cpuUsage: currentCpuUsage,
        eventLoopDelay: 0 // Will be updated by event loop monitor
      };
      
      this.metrics.push(metric);
      this.emit('metrics', metric);
    }, this.samplingIntervalMs);
  }

  stopResourceMonitoring(): ResourceUsage {
    if (!this.monitoring) {
      throw new Error('Resource monitoring is not active');
    }
    
    this.monitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
    
    return this.analyzeResourceUsage();
  }

  startMemoryMonitoring(): void {
    this.startResourceMonitoring();
  }

  stopMemoryMonitoring(): ResourceUsage {
    return this.stopResourceMonitoring();
  }

  private analyzeResourceUsage(): ResourceUsage {
    if (this.metrics.length === 0) {
      throw new Error('No metrics collected');
    }
    
    const memoryUsageMB = this.metrics.map(m => m.memoryUsage.heapUsed / 1024 / 1024);
    const cpuUsages = this.metrics.map(m => 
      (m.cpuUsage.user + m.cpuUsage.system) / 1000 // Convert to ms
    );
    
    const eventLoopDelays: number[] = [];
    this.on('eventLoopDelay', (delay: number) => {
      eventLoopDelays.push(delay);
    });
    
    const maxMemoryMB = Math.max(...memoryUsageMB);
    const avgMemoryMB = memoryUsageMB.reduce((sum, mem) => sum + mem, 0) / memoryUsageMB.length;
    const memoryGrowthMB = memoryUsageMB[memoryUsageMB.length - 1] - memoryUsageMB[0];
    
    const avgCpuPercent = cpuUsages.reduce((sum, cpu) => sum + cpu, 0) / cpuUsages.length;
    const maxCpuPercent = Math.max(...cpuUsages);
    
    eventLoopDelays.sort((a, b) => a - b);
    const eventLoopDelayP95 = eventLoopDelays[Math.floor(eventLoopDelays.length * 0.95)] || 0;
    
    return {
      maxMemoryMB,
      avgMemoryMB,
      memoryGrowthMB,
      avgCpuPercent,
      maxCpuPercent,
      eventLoopDelayP95,
      samplingDurationMs: this.metrics.length * this.samplingIntervalMs
    };
  }

  cleanup(): void {
    this.monitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    
    if (this.eventLoopMonitor) {
      clearInterval(this.eventLoopMonitor);
    }
  }
}

export class BenchmarkRunner {
  private results: BenchmarkResult[] = [];
  private monitor: PerformanceMonitor;

  constructor() {
    this.monitor = new PerformanceMonitor();
  }

  async runBenchmark<T>(
    testName: string,
    benchmarkFn: () => Promise<T>,
    thresholds?: PerformanceThresholds
  ): Promise<{ result: T; benchmark: BenchmarkResult }> {
    const startTime = new Date();
    const errors: string[] = [];
    let result: T;
    let customMetrics: Record<string, any> = {};

    console.log(`🏃 Starting benchmark: ${testName}`);
    
    this.monitor.startResourceMonitoring();
    
    try {
      result = await benchmarkFn();
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
      throw error;
    } finally {
      const resourceUsage = this.monitor.stopResourceMonitoring();
      const endTime = new Date();
      
      const benchmarkResult: BenchmarkResult = {
        testName,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        duration: endTime.getTime() - startTime.getTime(),
        metrics: [],
        resourceUsage,
        customMetrics,
        passed: this.evaluateThresholds(resourceUsage, thresholds, errors),
        errors
      };
      
      this.results.push(benchmarkResult);
      
      console.log(`✅ Benchmark completed: ${testName}`);
      console.log(`   Duration: ${benchmarkResult.duration}ms`);
      console.log(`   Max Memory: ${resourceUsage.maxMemoryMB.toFixed(2)}MB`);
      console.log(`   Avg CPU: ${resourceUsage.avgCpuPercent.toFixed(2)}%`);
      console.log(`   Passed: ${benchmarkResult.passed ? '✓' : '✗'}`);
      
      if (!benchmarkResult.passed) {
        console.log(`   Errors: ${errors.join(', ')}`);
      }
    }
    
    return { result: result!, benchmark: this.results[this.results.length - 1] };
  }

  private evaluateThresholds(
    resourceUsage: ResourceUsage,
    thresholds?: PerformanceThresholds,
    errors: string[] = []
  ): boolean {
    if (!thresholds) return errors.length === 0;
    
    let passed = errors.length === 0;
    
    if (thresholds.maxMemoryMB && resourceUsage.maxMemoryMB > thresholds.maxMemoryMB) {
      errors.push(`Memory usage ${resourceUsage.maxMemoryMB.toFixed(2)}MB exceeds threshold ${thresholds.maxMemoryMB}MB`);
      passed = false;
    }
    
    if (thresholds.maxEventLoopDelayMs && resourceUsage.eventLoopDelayP95 > thresholds.maxEventLoopDelayMs) {
      errors.push(`Event loop delay ${resourceUsage.eventLoopDelayP95.toFixed(2)}ms exceeds threshold ${thresholds.maxEventLoopDelayMs}ms`);
      passed = false;
    }
    
    return passed;
  }

  async generateReport(outputPath?: string): Promise<string> {
    const report = {
      generatedAt: new Date().toISOString(),
      systemInfo: {
        platform: os.platform(),
        arch: os.arch(),
        cpus: os.cpus().length,
        totalMemoryGB: (os.totalmem() / 1024 / 1024 / 1024).toFixed(2),
        nodeVersion: process.version
      },
      summary: {
        totalBenchmarks: this.results.length,
        passed: this.results.filter(r => r.passed).length,
        failed: this.results.filter(r => !r.passed).length,
        totalDurationMs: this.results.reduce((sum, r) => sum + r.duration, 0),
        avgMemoryUsageMB: this.results.reduce((sum, r) => sum + r.resourceUsage.avgMemoryMB, 0) / this.results.length,
        maxMemoryUsageMB: Math.max(...this.results.map(r => r.resourceUsage.maxMemoryMB))
      },
      benchmarks: this.results,
      recommendations: this.generateRecommendations()
    };
    
    const reportJson = JSON.stringify(report, null, 2);
    
    if (outputPath) {
      await fs.writeFile(outputPath, reportJson);
      console.log(`📊 Performance report saved to: ${outputPath}`);
    }
    
    return reportJson;
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    
    const failedBenchmarks = this.results.filter(r => !r.passed);
    if (failedBenchmarks.length > 0) {
      recommendations.push('Some benchmarks failed - review error messages and optimize accordingly');
    }
    
    const highMemoryUsage = this.results.filter(r => r.resourceUsage.maxMemoryMB > 512);
    if (highMemoryUsage.length > 0) {
      recommendations.push('High memory usage detected - consider implementing memory optimization strategies');
    }
    
    const highEventLoopDelay = this.results.filter(r => r.resourceUsage.eventLoopDelayP95 > 10);
    if (highEventLoopDelay.length > 0) {
      recommendations.push('High event loop delay detected - consider optimizing synchronous operations');
    }
    
    const avgMemory = this.results.reduce((sum, r) => sum + r.resourceUsage.avgMemoryMB, 0) / this.results.length;
    if (avgMemory > 256) {
      recommendations.push('Consider implementing memory pooling or garbage collection optimization');
    }
    
    return recommendations;
  }

  getResults(): BenchmarkResult[] {
    return [...this.results];
  }

  reset(): void {
    this.results = [];
  }

  cleanup(): void {
    this.monitor.cleanup();
  }
}

export class PerformanceValidator {
  static validateSearchPerformance(
    responseTimes: number[],
    thresholds: {
      maxAvgMs: number;
      maxP95Ms: number;
      maxP99Ms: number;
    }
  ): { passed: boolean; errors: string[]; metrics: any } {
    const errors: string[] = [];
    
    if (responseTimes.length === 0) {
      errors.push('No response times to validate');
      return { passed: false, errors, metrics: null };
    }
    
    const sorted = [...responseTimes].sort((a, b) => a - b);
    const avgTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
    const p95Time = sorted[Math.floor(sorted.length * 0.95)];
    const p99Time = sorted[Math.floor(sorted.length * 0.99)];
    
    const metrics = {
      avgTime,
      p95Time,
      p99Time,
      minTime: sorted[0],
      maxTime: sorted[sorted.length - 1],
      samples: responseTimes.length
    };
    
    if (avgTime > thresholds.maxAvgMs) {
      errors.push(`Average response time ${avgTime.toFixed(2)}ms exceeds threshold ${thresholds.maxAvgMs}ms`);
    }
    
    if (p95Time > thresholds.maxP95Ms) {
      errors.push(`P95 response time ${p95Time.toFixed(2)}ms exceeds threshold ${thresholds.maxP95Ms}ms`);
    }
    
    if (p99Time > thresholds.maxP99Ms) {
      errors.push(`P99 response time ${p99Time.toFixed(2)}ms exceeds threshold ${thresholds.maxP99Ms}ms`);
    }
    
    return {
      passed: errors.length === 0,
      errors,
      metrics
    };
  }

  static validateThroughput(
    operationsCompleted: number,
    durationMs: number,
    minOpsPerSec: number
  ): { passed: boolean; actualThroughput: number; error?: string } {
    const actualThroughput = operationsCompleted / (durationMs / 1000);
    
    if (actualThroughput < minOpsPerSec) {
      return {
        passed: false,
        actualThroughput,
        error: `Throughput ${actualThroughput.toFixed(2)} ops/sec below threshold ${minOpsPerSec} ops/sec`
      };
    }
    
    return { passed: true, actualThroughput };
  }

  static validateErrorRate(
    totalOperations: number,
    failedOperations: number,
    maxErrorRate: number
  ): { passed: boolean; actualErrorRate: number; error?: string } {
    const actualErrorRate = failedOperations / totalOperations;
    
    if (actualErrorRate > maxErrorRate) {
      return {
        passed: false,
        actualErrorRate,
        error: `Error rate ${(actualErrorRate * 100).toFixed(2)}% exceeds threshold ${(maxErrorRate * 100).toFixed(2)}%`
      };
    }
    
    return { passed: true, actualErrorRate };
  }
}

export class PerformanceProfiler {
  private static profiles: Map<string, any> = new Map();
  
  static async profile<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const startTime = process.hrtime.bigint();
    const startMemory = process.memoryUsage();
    
    try {
      const result = await fn();
      
      const endTime = process.hrtime.bigint();
      const endMemory = process.memoryUsage();
      
      const profile = {
        name,
        duration: Number(endTime - startTime) / 1000000, // Convert to ms
        memoryDelta: {
          heapUsed: endMemory.heapUsed - startMemory.heapUsed,
          heapTotal: endMemory.heapTotal - startMemory.heapTotal,
          external: endMemory.external - startMemory.external,
          rss: endMemory.rss - startMemory.rss
        },
        timestamp: new Date().toISOString()
      };
      
      this.profiles.set(name, profile);
      
      return result;
    } catch (error) {
      const endTime = process.hrtime.bigint();
      
      const profile = {
        name,
        duration: Number(endTime - startTime) / 1000000,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      };
      
      this.profiles.set(name, profile);
      throw error;
    }
  }
  
  static getProfile(name: string): any {
    return this.profiles.get(name);
  }
  
  static getAllProfiles(): Record<string, any> {
    return Object.fromEntries(this.profiles);
  }
  
  static clearProfiles(): void {
    this.profiles.clear();
  }
}

// Utility functions for CI/CD integration
export async function runPerformanceTests(): Promise<void> {
  const runner = new BenchmarkRunner();
  
  try {
    // This would be called by CI/CD to run all performance tests
    console.log('🚀 Running performance test suite...');
    
    // Generate performance report
    const reportPath = path.join(__dirname, '../../../performance-report.json');
    await runner.generateReport(reportPath);
    
    // Check if any critical tests failed
    const results = runner.getResults();
    const criticalFailures = results.filter(r => !r.passed && r.testName.includes('critical'));
    
    if (criticalFailures.length > 0) {
      console.error('❌ Critical performance tests failed');
      process.exit(1);
    }
    
    console.log('✅ All performance tests passed');
  } finally {
    runner.cleanup();
  }
}

// Export for jest global setup/teardown
export async function globalPerformanceSetup(): Promise<void> {
  console.log('🔧 Setting up performance testing environment...');
  
  // Optimize Node.js for performance testing
  if (process.env.NODE_ENV !== 'production') {
    process.env.NODE_ENV = 'test';
  }
  
  // Set reasonable memory limits for testing
  if (!process.env.NODE_OPTIONS) {
    process.env.NODE_OPTIONS = '--max-old-space-size=2048';
  }
}

export async function globalPerformanceTeardown(): Promise<void> {
  console.log('🧹 Cleaning up performance testing environment...');
  
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
}