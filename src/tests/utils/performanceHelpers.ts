/**
 * Performance Testing Utilities
 *
 * Provides tools for benchmarking, memory profiling, and performance validation
 * across the categorization and tagging system components.
 */

import { performance, PerformanceObserver } from 'perf_hooks';

// ===========================
// PERFORMANCE MEASUREMENT
// ===========================

export interface PerformanceMetrics {
  duration: number;
  memory?: {
    used: number;
    peak: number;
    allocated: number;
  };
  operations?: {
    count: number;
    rate: number; // ops/second
  };
  breakdown?: Record<string, number>;
}

export class PerformanceMeasurer {
  private markers: Map<string, number> = new Map();
  private measurements: Map<string, PerformanceMetrics> = new Map();
  private observer?: PerformanceObserver;

  constructor() {
    this.setupPerformanceObserver();
  }

  private setupPerformanceObserver() {
    if (typeof PerformanceObserver !== 'undefined') {
      this.observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.entryType === 'measure') {
            this.measurements.set(entry.name, {
              duration: entry.duration,
              breakdown: { [entry.name]: entry.duration }
            });
          }
        });
      });

      this.observer.observe({ entryTypes: ['measure', 'mark'] });
    }
  }

  startMeasurement(name: string): void {
    const startTime = performance.now();
    this.markers.set(name, startTime);

    if (performance.mark) {
      performance.mark(`${name}-start`);
    }
  }

  endMeasurement(name: string): PerformanceMetrics {
    const endTime = performance.now();
    const startTime = this.markers.get(name);

    if (!startTime) {
      throw new Error(`No start measurement found for '${name}'`);
    }

    const duration = endTime - startTime;

    if (performance.mark && performance.measure) {
      performance.mark(`${name}-end`);
      performance.measure(name, `${name}-start`, `${name}-end`);
    }

    const metrics: PerformanceMetrics = {
      duration,
      memory: this.getMemoryUsage(),
      breakdown: { [name]: duration }
    };

    this.measurements.set(name, metrics);
    this.markers.delete(name);

    return metrics;
  }

  private getMemoryUsage() {
    if (typeof (performance as any).memory !== 'undefined') {
      const memory = (performance as any).memory;
      return {
        used: memory.usedJSHeapSize,
        peak: memory.totalJSHeapSize,
        allocated: memory.totalJSHeapSize
      };
    }
    return undefined;
  }

  getMeasurement(name: string): PerformanceMetrics | undefined {
    return this.measurements.get(name);
  }

  getAllMeasurements(): Map<string, PerformanceMetrics> {
    return new Map(this.measurements);
  }

  clear(): void {
    this.markers.clear();
    this.measurements.clear();

    if (performance.clearMarks) {
      performance.clearMarks();
    }
    if (performance.clearMeasures) {
      performance.clearMeasures();
    }
  }

  cleanup(): void {
    this.clear();
    if (this.observer) {
      this.observer.disconnect();
    }
  }
}

// ===========================
// BENCHMARKING UTILITIES
// ===========================

export interface BenchmarkConfig {
  iterations: number;
  warmupRuns?: number;
  timeout?: number;
  memoryProfiling?: boolean;
}

export interface BenchmarkResult {
  name: string;
  iterations: number;
  totalDuration: number;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  standardDeviation: number;
  operationsPerSecond: number;
  memoryUsage?: {
    initial: number;
    peak: number;
    final: number;
    leaked: number;
  };
}

export class Benchmark {
  private measurer = new PerformanceMeasurer();

  async run(
    name: string,
    operation: () => Promise<any> | any,
    config: BenchmarkConfig
  ): Promise<BenchmarkResult> {
    const {
      iterations,
      warmupRuns = Math.min(5, Math.floor(iterations * 0.1)),
      timeout = 30000,
      memoryProfiling = false
    } = config;

    // Warmup runs
    for (let i = 0; i < warmupRuns; i++) {
      await this.executeOperation(operation, timeout);
    }

    // Force garbage collection before starting
    if (global.gc && memoryProfiling) {
      global.gc();
    }

    const initialMemory = memoryProfiling ? this.getCurrentMemoryUsage() : 0;
    let peakMemory = initialMemory;
    const durations: number[] = [];

    // Main benchmark runs
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await this.executeOperation(operation, timeout);
      const end = performance.now();

      durations.push(end - start);

      // Track peak memory usage
      if (memoryProfiling) {
        const currentMemory = this.getCurrentMemoryUsage();
        peakMemory = Math.max(peakMemory, currentMemory);
      }
    }

    // Final memory measurement
    let finalMemory = initialMemory;
    let leakedMemory = 0;

    if (memoryProfiling) {
      if (global.gc) {
        global.gc();
      }
      finalMemory = this.getCurrentMemoryUsage();
      leakedMemory = Math.max(0, finalMemory - initialMemory);
    }

    // Calculate statistics
    const totalDuration = durations.reduce((sum, d) => sum + d, 0);
    const averageDuration = totalDuration / iterations;
    const minDuration = Math.min(...durations);
    const maxDuration = Math.max(...durations);

    const variance = durations.reduce((sum, d) => {
      return sum + Math.pow(d - averageDuration, 2);
    }, 0) / iterations;

    const standardDeviation = Math.sqrt(variance);
    const operationsPerSecond = 1000 / averageDuration;

    return {
      name,
      iterations,
      totalDuration,
      averageDuration,
      minDuration,
      maxDuration,
      standardDeviation,
      operationsPerSecond,
      memoryUsage: memoryProfiling ? {
        initial: initialMemory,
        peak: peakMemory,
        final: finalMemory,
        leaked: leakedMemory
      } : undefined
    };
  }

  private async executeOperation(
    operation: () => Promise<any> | any,
    timeout: number
  ): Promise<any> {
    return Promise.race([
      Promise.resolve(operation()),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Operation timeout')), timeout)
      )
    ]);
  }

  private getCurrentMemoryUsage(): number {
    if (typeof (performance as any).memory !== 'undefined') {
      return (performance as any).memory.usedJSHeapSize;
    }
    return 0;
  }

  cleanup(): void {
    this.measurer.cleanup();
  }
}

// ===========================
// LARGE DATASET GENERATORS
// ===========================

export interface LargeDatasetConfig {
  entryCount: number;
  tagCount: number;
  categoryCount: number;
  maxTagsPerEntry: number;
  complexity?: 'simple' | 'medium' | 'complex';
}

export const createLargeDataset = (config: LargeDatasetConfig) => {
  const {
    entryCount,
    tagCount,
    categoryCount,
    maxTagsPerEntry,
    complexity = 'medium'
  } = config;

  // Generate realistic categories
  const categories = Array.from({ length: categoryCount }, (_, i) => ({
    id: `cat-${i.toString().padStart(4, '0')}`,
    name: `Category ${i}`,
    description: `Generated category ${i} for testing`,
    icon: ['📁', '🗂️', '📋', '📊', '⚙️'][i % 5],
    is_system: i < categoryCount * 0.3,
    entry_count: Math.floor(Math.random() * 50) + 1,
    parent_id: complexity === 'complex' && Math.random() > 0.7 && i > 10
      ? `cat-${Math.floor(Math.random() * Math.min(i, 10)).toString().padStart(4, '0')}`
      : null,
    trending_score: Math.random() * 100
  }));

  // Generate realistic tags
  const tagPrefixes = [
    'error', 'fix', 'issue', 'problem', 'solution', 'handle', 'process',
    'data', 'file', 'system', 'config', 'setup', 'install', 'update',
    'performance', 'memory', 'cpu', 'disk', 'network', 'security'
  ];

  const tagSuffixes = [
    'handling', 'management', 'processing', 'validation', 'optimization',
    'monitoring', 'analysis', 'recovery', 'backup', 'maintenance',
    'debugging', 'testing', 'deployment', 'configuration', 'integration'
  ];

  const tags = Array.from({ length: tagCount }, (_, i) => {
    const prefix = tagPrefixes[Math.floor(Math.random() * tagPrefixes.length)];
    const suffix = tagSuffixes[Math.floor(Math.random() * tagSuffixes.length)];
    const name = complexity === 'simple'
      ? `tag-${i}`
      : `${prefix}-${suffix}-${i}`.toLowerCase();

    return {
      id: `tag-${i.toString().padStart(4, '0')}`,
      name,
      description: `Generated tag for ${name}`,
      usage_count: Math.floor(Math.random() * 1000),
      category: Math.random() > 0.6 ? categories[Math.floor(Math.random() * categories.length)].name : null,
      is_system: Math.random() > 0.8,
      auto_suggest: Math.random() > 0.3,
      related_tags: complexity === 'complex'
        ? Array.from({ length: Math.floor(Math.random() * 3) }, () =>
            tags[Math.floor(Math.random() * Math.min(i, tagCount - 1))]?.name
          ).filter(Boolean)
        : []
    };
  });

  // Generate realistic entries
  const problemTemplates = [
    'System fails to process {operation} for {component}',
    'Unable to {action} {resource} due to {error}',
    'Performance degradation in {component} affecting {process}',
    'Configuration error in {system} causing {issue}',
    'Data validation failed for {dataset} with {error_code}',
    '{Service} timeout when processing {operation}',
    'Memory allocation error in {module} during {process}',
    'Network connectivity issue between {source} and {target}',
    'Permission denied when accessing {resource} from {location}',
    'Database query performance issue with {table} and {condition}'
  ];

  const solutionTemplates = [
    '1. Check {component} configuration\n2. Verify {resource} availability\n3. Restart {service} if needed',
    '1. Validate {input} parameters\n2. Update {config} settings\n3. Test {functionality}',
    '1. Monitor {system} performance\n2. Optimize {process} settings\n3. Scale {resource} if needed',
    '1. Review {log} files for errors\n2. Check {dependency} status\n3. Apply {fix} as needed',
    '1. Backup {data} before changes\n2. Apply {update} to {component}\n3. Verify {functionality} works'
  ];

  const entries = Array.from({ length: entryCount }, (_, i) => {
    const category = categories[Math.floor(Math.random() * categories.length)];
    const numTags = Math.floor(Math.random() * maxTagsPerEntry) + 1;
    const entryTags = Array.from({ length: numTags }, () =>
      tags[Math.floor(Math.random() * tags.length)].name
    ).filter((tag, index, array) => array.indexOf(tag) === index);

    const problemTemplate = problemTemplates[Math.floor(Math.random() * problemTemplates.length)];
    const solutionTemplate = solutionTemplates[Math.floor(Math.random() * solutionTemplates.length)];

    // Replace placeholders with realistic values
    const replacements = {
      operation: ['backup', 'restore', 'update', 'synchronization', 'validation'][Math.floor(Math.random() * 5)],
      component: ['database', 'file system', 'network', 'application', 'service'][Math.floor(Math.random() * 5)],
      action: ['connect', 'read', 'write', 'delete', 'update'][Math.floor(Math.random() * 5)],
      resource: ['file', 'database', 'service', 'endpoint', 'configuration'][Math.floor(Math.random() * 5)],
      error: ['timeout', 'permission denied', 'not found', 'invalid format', 'connection failed'][Math.floor(Math.random() * 5)],
      process: ['synchronization', 'validation', 'processing', 'analysis', 'computation'][Math.floor(Math.random() * 5)],
      system: ['authentication', 'authorization', 'logging', 'monitoring', 'backup'][Math.floor(Math.random() * 5)],
      issue: ['slowdown', 'failure', 'error', 'inconsistency', 'corruption'][Math.floor(Math.random() * 5)],
      error_code: ['E001', 'E002', 'E003', 'E004', 'E005'][Math.floor(Math.random() * 5)]
    };

    let problem = problemTemplate;
    let solution = solutionTemplate;

    Object.entries(replacements).forEach(([key, value]) => {
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      problem = problem.replace(regex, value);
      solution = solution.replace(regex, value);
    });

    return {
      id: `entry-${i.toString().padStart(6, '0')}`,
      title: problem.split(' ').slice(0, 6).join(' '),
      problem,
      solution,
      category: category.name,
      tags: entryTags,
      created_at: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
      usage_count: Math.floor(Math.random() * 100),
      success_count: Math.floor(Math.random() * 80),
      failure_count: Math.floor(Math.random() * 20),
      success_rate: Math.random(),
      trending_score: Math.random() * 100
    };
  });

  return { categories, tags, entries };
};

// ===========================
// PERFORMANCE VALIDATORS
// ===========================

export interface PerformanceThresholds {
  maxDuration?: number;
  maxMemoryUsage?: number;
  minOperationsPerSecond?: number;
  maxMemoryLeak?: number;
}

export class PerformanceValidator {
  validateBenchmark(
    result: BenchmarkResult,
    thresholds: PerformanceThresholds
  ): {
    passed: boolean;
    failures: string[];
  } {
    const failures: string[] = [];

    if (thresholds.maxDuration && result.averageDuration > thresholds.maxDuration) {
      failures.push(`Average duration ${result.averageDuration.toFixed(2)}ms exceeds threshold ${thresholds.maxDuration}ms`);
    }

    if (thresholds.minOperationsPerSecond && result.operationsPerSecond < thresholds.minOperationsPerSecond) {
      failures.push(`Operations per second ${result.operationsPerSecond.toFixed(2)} below threshold ${thresholds.minOperationsPerSecond}`);
    }

    if (thresholds.maxMemoryUsage && result.memoryUsage) {
      if (result.memoryUsage.peak > thresholds.maxMemoryUsage) {
        failures.push(`Peak memory usage ${(result.memoryUsage.peak / 1024 / 1024).toFixed(2)}MB exceeds threshold ${(thresholds.maxMemoryUsage / 1024 / 1024).toFixed(2)}MB`);
      }
    }

    if (thresholds.maxMemoryLeak && result.memoryUsage) {
      if (result.memoryUsage.leaked > thresholds.maxMemoryLeak) {
        failures.push(`Memory leak ${(result.memoryUsage.leaked / 1024 / 1024).toFixed(2)}MB exceeds threshold ${(thresholds.maxMemoryLeak / 1024 / 1024).toFixed(2)}MB`);
      }
    }

    return {
      passed: failures.length === 0,
      failures
    };
  }

  validateMetrics(
    metrics: PerformanceMetrics,
    thresholds: PerformanceThresholds
  ): {
    passed: boolean;
    failures: string[];
  } {
    const failures: string[] = [];

    if (thresholds.maxDuration && metrics.duration > thresholds.maxDuration) {
      failures.push(`Duration ${metrics.duration.toFixed(2)}ms exceeds threshold ${thresholds.maxDuration}ms`);
    }

    if (thresholds.maxMemoryUsage && metrics.memory) {
      if (metrics.memory.peak > thresholds.maxMemoryUsage) {
        failures.push(`Memory usage ${(metrics.memory.peak / 1024 / 1024).toFixed(2)}MB exceeds threshold ${(thresholds.maxMemoryUsage / 1024 / 1024).toFixed(2)}MB`);
      }
    }

    if (thresholds.minOperationsPerSecond && metrics.operations) {
      if (metrics.operations.rate < thresholds.minOperationsPerSecond) {
        failures.push(`Operations per second ${metrics.operations.rate.toFixed(2)} below threshold ${thresholds.minOperationsPerSecond}`);
      }
    }

    return {
      passed: failures.length === 0,
      failures
    };
  }
}

// ===========================
// STRESS TESTING
// ===========================

export interface StressTestConfig {
  maxConcurrency: number;
  duration: number; // milliseconds
  rampUpTime?: number; // milliseconds
  operations: Array<{
    name: string;
    weight: number; // 0-1, probability of selection
    operation: () => Promise<any>;
  }>;
}

export interface StressTestResult {
  duration: number;
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  averageResponseTime: number;
  operationsPerSecond: number;
  concurrencyLevels: number[];
  errors: Array<{
    operation: string;
    error: string;
    timestamp: number;
  }>;
}

export class StressTest {
  async run(config: StressTestConfig): Promise<StressTestResult> {
    const {
      maxConcurrency,
      duration,
      rampUpTime = duration * 0.1,
      operations
    } = config;

    const startTime = performance.now();
    const endTime = startTime + duration;
    let activePromises = 0;
    let totalOperations = 0;
    let successfulOperations = 0;
    let failedOperations = 0;
    let totalResponseTime = 0;
    const concurrencyLevels: number[] = [];
    const errors: StressTestResult['errors'] = [];

    const getTargetConcurrency = (elapsed: number): number => {
      if (elapsed < rampUpTime) {
        return Math.ceil((elapsed / rampUpTime) * maxConcurrency);
      }
      return maxConcurrency;
    };

    const selectOperation = () => {
      const random = Math.random();
      let cumulative = 0;

      for (const op of operations) {
        cumulative += op.weight;
        if (random <= cumulative) {
          return op;
        }
      }

      return operations[operations.length - 1];
    };

    const executeOperation = async (operation: StressTestConfig['operations'][0]) => {
      activePromises++;
      totalOperations++;

      const opStart = performance.now();

      try {
        await operation.operation();
        successfulOperations++;
      } catch (error) {
        failedOperations++;
        errors.push({
          operation: operation.name,
          error: error instanceof Error ? error.message : String(error),
          timestamp: Date.now()
        });
      }

      const opEnd = performance.now();
      totalResponseTime += (opEnd - opStart);
      activePromises--;
    };

    // Main stress test loop
    const promises: Promise<void>[] = [];

    while (performance.now() < endTime) {
      const elapsed = performance.now() - startTime;
      const targetConcurrency = getTargetConcurrency(elapsed);

      concurrencyLevels.push(activePromises);

      if (activePromises < targetConcurrency) {
        const operation = selectOperation();
        const promise = executeOperation(operation);
        promises.push(promise);

        // Don't wait for the promise, let it run concurrently
        promise.catch(() => {}); // Prevent unhandled rejection
      }

      // Small delay to prevent busy waiting
      await new Promise(resolve => setTimeout(resolve, 1));
    }

    // Wait for all remaining operations to complete
    await Promise.allSettled(promises);

    const totalDuration = performance.now() - startTime;
    const averageResponseTime = totalOperations > 0 ? totalResponseTime / totalOperations : 0;
    const operationsPerSecond = totalOperations / (totalDuration / 1000);

    return {
      duration: totalDuration,
      totalOperations,
      successfulOperations,
      failedOperations,
      averageResponseTime,
      operationsPerSecond,
      concurrencyLevels,
      errors
    };
  }
}

// ===========================
// UTILITY FUNCTIONS
// ===========================

export const formatBytes = (bytes: number): string => {
  const sizes = ['B', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 B';

  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, i);

  return `${size.toFixed(2)} ${sizes[i]}`;
};

export const formatDuration = (ms: number): string => {
  if (ms < 1) return `${(ms * 1000).toFixed(2)}μs`;
  if (ms < 1000) return `${ms.toFixed(2)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${(ms / 60000).toFixed(2)}m`;
};

export const calculatePercentile = (values: number[], percentile: number): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const index = (percentile / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index % 1;

  if (upper >= sorted.length) return sorted[sorted.length - 1];
  if (weight === 0) return sorted[lower];

  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
};