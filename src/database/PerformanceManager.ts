import { KnowledgeDB } from './KnowledgeDB';
import { ConnectionPool } from './ConnectionPool';
import { QueryCache } from './QueryCache';
import { AdvancedIndexStrategy } from './AdvancedIndexStrategy';
import { SearchOptimizationEngine, OptimizationStrategy } from './SearchOptimizationEngine';
import { SearchPerformanceBenchmark } from './SearchPerformanceBenchmark';
import { EventEmitter } from 'events';

export interface PerformanceMetrics {
  avgQueryTime: number;
  cacheHitRate: number;
  indexUtilization: number;
  connectionPoolUtilization: number;
  totalQueries: number;
  slowQueries: number;
  optimizationsApplied: number;
  lastBenchmarkScore: number;
}

export interface PerformanceThresholds {
  maxQueryTime: number;
  minCacheHitRate: number;
  maxSlowQueryPercent: number;
  benchmarkIntervalHours: number;
}

export interface PerformanceAlert {
  type: 'slow_query' | 'low_cache_hit' | 'high_load' | 'optimization_needed';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  recommendation: string;
  timestamp: Date;
  metrics?: Partial<PerformanceMetrics>;
}

/**
 * Centralized Performance Management System
 * 
 * Integrates all performance optimization components:
 * - Connection pooling management
 * - Query caching coordination
 * - Index optimization
 * - Search optimization engine
 * - Performance monitoring and alerting
 * - Automated benchmarking
 */
export class PerformanceManager extends EventEmitter {
  private knowledgeDB: KnowledgeDB;
  private connectionPool: ConnectionPool;
  private queryCache: QueryCache;
  private indexStrategy: AdvancedIndexStrategy;
  private optimizationEngine: SearchOptimizationEngine;
  private benchmark: SearchPerformanceBenchmark;
  
  private metrics: PerformanceMetrics = {
    avgQueryTime: 0,
    cacheHitRate: 0,
    indexUtilization: 0,
    connectionPoolUtilization: 0,
    totalQueries: 0,
    slowQueries: 0,
    optimizationsApplied: 0,
    lastBenchmarkScore: 0
  };

  private thresholds: PerformanceThresholds = {
    maxQueryTime: 1000, // 1 second
    minCacheHitRate: 0.8, // 80%
    maxSlowQueryPercent: 0.05, // 5%
    benchmarkIntervalHours: 24
  };

  private monitoringInterval?: NodeJS.Timeout;
  private benchmarkInterval?: NodeJS.Timeout;
  private queryTimes: number[] = [];
  private lastBenchmark: Date = new Date();

  constructor(
    knowledgeDB: KnowledgeDB,
    connectionPool: ConnectionPool,
    queryCache: QueryCache
  ) {
    super();
    
    this.knowledgeDB = knowledgeDB;
    this.connectionPool = connectionPool;
    this.queryCache = queryCache;
    this.indexStrategy = new AdvancedIndexStrategy();
    this.optimizationEngine = new SearchOptimizationEngine();
    this.benchmark = new SearchPerformanceBenchmark();
    
    this.setupEventListeners();
  }

  /**
   * Initialize performance management system
   * Sets up monitoring, applies initial optimizations, and runs baseline benchmark
   */
  async initialize(): Promise<void> {
    console.log('🚀 Initializing Performance Management System...');
    
    try {
      // Apply index optimizations
      console.log('📊 Applying index optimizations...');
      await this.indexStrategy.createOptimizedIndexes(this.connectionPool.getWriterConnection());
      
      // Initialize optimization engine
      console.log('🔧 Setting up optimization engine...');
      await this.optimizationEngine.initialize(this.knowledgeDB);
      
      // Run baseline benchmark
      console.log('⏱️ Running baseline performance benchmark...');
      await this.runBenchmark(true);
      
      // Start monitoring
      console.log('📈 Starting performance monitoring...');
      this.startMonitoring();
      
      // Schedule periodic benchmarks
      this.scheduleBenchmarks();
      
      console.log('✅ Performance Management System initialized successfully');
      this.emit('initialized', { metrics: this.metrics });
      
    } catch (error) {
      console.error('❌ Failed to initialize Performance Manager:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Record query performance metrics
   */
  recordQuery(queryTime: number, cacheHit: boolean): void {
    this.queryTimes.push(queryTime);
    this.metrics.totalQueries++;
    
    // Track slow queries
    if (queryTime > this.thresholds.maxQueryTime) {
      this.metrics.slowQueries++;
      this.emit('slow_query', { queryTime, threshold: this.thresholds.maxQueryTime });
    }
    
    // Update cache hit rate
    if (cacheHit) {
      this.metrics.cacheHitRate = (this.metrics.cacheHitRate * (this.metrics.totalQueries - 1) + 1) / this.metrics.totalQueries;
    } else {
      this.metrics.cacheHitRate = (this.metrics.cacheHitRate * (this.metrics.totalQueries - 1)) / this.metrics.totalQueries;
    }
    
    // Update average query time (rolling window of last 1000 queries)
    if (this.queryTimes.length > 1000) {
      this.queryTimes.shift();
    }
    this.metrics.avgQueryTime = this.queryTimes.reduce((sum, time) => sum + time, 0) / this.queryTimes.length;
    
    this.checkThresholds();
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Update performance thresholds
   */
  updateThresholds(thresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
    console.log('📊 Updated performance thresholds:', this.thresholds);
    this.emit('thresholds_updated', this.thresholds);
  }

  /**
   * Run comprehensive performance benchmark
   */
  async runBenchmark(isBaseline: boolean = false): Promise<void> {
    try {
      console.log(`🔬 Running ${isBaseline ? 'baseline' : 'scheduled'} performance benchmark...`);
      
      const results = await this.benchmark.runSearchBenchmark({
        datasetSize: 1000,
        iterations: 100,
        includeStressTest: true,
        enableOptimizations: true
      });
      
      this.metrics.lastBenchmarkScore = this.calculateBenchmarkScore(results);
      this.lastBenchmark = new Date();
      
      console.log(`📈 Benchmark completed. Score: ${this.metrics.lastBenchmarkScore.toFixed(2)}`);
      
      // Check if optimization is needed
      if (this.metrics.lastBenchmarkScore < 80 && !isBaseline) {
        await this.applyAutomaticOptimizations(results);
      }
      
      this.emit('benchmark_completed', { 
        score: this.metrics.lastBenchmarkScore, 
        results,
        isBaseline 
      });
      
    } catch (error) {
      console.error('❌ Benchmark failed:', error);
      this.emit('benchmark_error', error);
    }
  }

  /**
   * Apply automatic performance optimizations based on current metrics
   */
  async applyAutomaticOptimizations(benchmarkResults?: any): Promise<void> {
    console.log('🔧 Applying automatic optimizations...');
    
    const strategies: OptimizationStrategy[] = [];
    
    // Determine optimization strategies based on metrics
    if (this.metrics.avgQueryTime > this.thresholds.maxQueryTime) {
      strategies.push({
        name: 'query_optimization',
        description: 'Optimize slow queries with better indexing',
        priority: 'high',
        estimatedImpact: 25
      });
    }
    
    if (this.metrics.cacheHitRate < this.thresholds.minCacheHitRate) {
      strategies.push({
        name: 'cache_optimization',
        description: 'Improve cache hit rate with better pre-warming',
        priority: 'medium',
        estimatedImpact: 15
      });
    }
    
    const slowQueryPercent = this.metrics.slowQueries / this.metrics.totalQueries;
    if (slowQueryPercent > this.thresholds.maxSlowQueryPercent) {
      strategies.push({
        name: 'index_optimization',
        description: 'Add specialized indexes for frequent query patterns',
        priority: 'high',
        estimatedImpact: 30
      });
    }
    
    // Apply optimizations
    for (const strategy of strategies) {
      try {
        const result = await this.optimizationEngine.applyOptimization(strategy);
        
        if (result.success) {
          this.metrics.optimizationsApplied++;
          console.log(`✅ Applied optimization: ${strategy.name} (${result.improvement}% improvement)`);
          this.emit('optimization_applied', { strategy, result });
        } else {
          console.warn(`⚠️ Optimization failed: ${strategy.name} - ${result.error}`);
          this.emit('optimization_failed', { strategy, error: result.error });
        }
      } catch (error) {
        console.error(`❌ Error applying optimization ${strategy.name}:`, error);
      }
    }
  }

  /**
   * Generate performance report
   */
  generateReport(): {
    summary: PerformanceMetrics;
    analysis: string[];
    recommendations: string[];
    alerts: PerformanceAlert[];
  } {
    const analysis: string[] = [];
    const recommendations: string[] = [];
    const alerts: PerformanceAlert[] = [];
    
    // Analyze current metrics
    if (this.metrics.avgQueryTime > this.thresholds.maxQueryTime) {
      analysis.push(`Average query time (${this.metrics.avgQueryTime.toFixed(2)}ms) exceeds threshold`);
      recommendations.push('Consider additional indexing or query optimization');
      alerts.push({
        type: 'slow_query',
        severity: 'high',
        message: 'Query performance is below target',
        recommendation: 'Run optimization engine or review query patterns',
        timestamp: new Date(),
        metrics: { avgQueryTime: this.metrics.avgQueryTime }
      });
    }
    
    if (this.metrics.cacheHitRate < this.thresholds.minCacheHitRate) {
      analysis.push(`Cache hit rate (${(this.metrics.cacheHitRate * 100).toFixed(1)}%) is below target`);
      recommendations.push('Improve cache pre-warming strategy or increase cache size');
      alerts.push({
        type: 'low_cache_hit',
        severity: 'medium',
        message: 'Cache effectiveness is suboptimal',
        recommendation: 'Review cache configuration and pre-warming patterns',
        timestamp: new Date(),
        metrics: { cacheHitRate: this.metrics.cacheHitRate }
      });
    }
    
    const slowQueryPercent = this.metrics.totalQueries > 0 ? 
      (this.metrics.slowQueries / this.metrics.totalQueries) * 100 : 0;
    
    if (slowQueryPercent > this.thresholds.maxSlowQueryPercent * 100) {
      analysis.push(`Slow query percentage (${slowQueryPercent.toFixed(2)}%) exceeds threshold`);
      recommendations.push('Investigate and optimize the slowest query patterns');
      alerts.push({
        type: 'high_load',
        severity: 'high',
        message: 'Too many slow queries detected',
        recommendation: 'Run detailed query analysis and apply targeted optimizations',
        timestamp: new Date(),
        metrics: { slowQueries: this.metrics.slowQueries, totalQueries: this.metrics.totalQueries }
      });
    }
    
    return {
      summary: this.metrics,
      analysis,
      recommendations,
      alerts
    };
  }

  /**
   * Start performance monitoring
   */
  private startMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.updateMetrics();
      this.checkThresholds();
    }, 30000); // Monitor every 30 seconds
  }

  /**
   * Schedule periodic benchmarks
   */
  private scheduleBenchmarks(): void {
    const intervalMs = this.thresholds.benchmarkIntervalHours * 60 * 60 * 1000;
    
    this.benchmarkInterval = setInterval(() => {
      this.runBenchmark(false);
    }, intervalMs);
  }

  /**
   * Update system metrics
   */
  private updateMetrics(): void {
    // Update connection pool utilization
    this.metrics.connectionPoolUtilization = this.connectionPool.getUtilization();
    
    // Update index utilization (placeholder - would need database-specific implementation)
    this.metrics.indexUtilization = 0.85; // Mock value
    
    this.emit('metrics_updated', this.metrics);
  }

  /**
   * Check performance thresholds and emit alerts
   */
  private checkThresholds(): void {
    const alerts: PerformanceAlert[] = [];
    
    if (this.metrics.avgQueryTime > this.thresholds.maxQueryTime) {
      alerts.push({
        type: 'slow_query',
        severity: this.metrics.avgQueryTime > this.thresholds.maxQueryTime * 2 ? 'critical' : 'high',
        message: `Average query time ${this.metrics.avgQueryTime.toFixed(2)}ms exceeds threshold`,
        recommendation: 'Apply query optimizations or increase resources',
        timestamp: new Date()
      });
    }
    
    if (this.metrics.cacheHitRate < this.thresholds.minCacheHitRate) {
      alerts.push({
        type: 'low_cache_hit',
        severity: this.metrics.cacheHitRate < 0.5 ? 'high' : 'medium',
        message: `Cache hit rate ${(this.metrics.cacheHitRate * 100).toFixed(1)}% is below target`,
        recommendation: 'Review cache configuration and pre-warming strategy',
        timestamp: new Date()
      });
    }
    
    alerts.forEach(alert => this.emit('alert', alert));
  }

  /**
   * Calculate benchmark score (0-100)
   */
  private calculateBenchmarkScore(results: any): number {
    if (!results || !results.scenarios) return 0;
    
    let totalScore = 0;
    let scenarioCount = 0;
    
    for (const scenario of results.scenarios) {
      if (scenario.metrics && scenario.metrics.p50) {
        // Score based on p50 latency (lower is better)
        const score = Math.max(0, 100 - (scenario.metrics.p50 / 10)); // 1000ms = 0 points
        totalScore += score;
        scenarioCount++;
      }
    }
    
    return scenarioCount > 0 ? totalScore / scenarioCount : 0;
  }

  /**
   * Setup event listeners for component integration
   */
  private setupEventListeners(): void {
    // Listen for cache events
    this.queryCache.on('hit', () => this.recordQuery(0, true));
    this.queryCache.on('miss', (queryTime: number) => this.recordQuery(queryTime, false));
    
    // Listen for optimization engine events
    this.optimizationEngine.on('optimization_applied', (result) => {
      this.metrics.optimizationsApplied++;
      this.emit('optimization_completed', result);
    });
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up Performance Manager...');
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    
    if (this.benchmarkInterval) {
      clearInterval(this.benchmarkInterval);
    }
    
    this.removeAllListeners();
    console.log('✅ Performance Manager cleanup completed');
  }

  /**
   * Export performance data for analysis
   */
  exportPerformanceData(): {
    metrics: PerformanceMetrics;
    thresholds: PerformanceThresholds;
    queryTimes: number[];
    lastBenchmark: Date;
  } {
    return {
      metrics: { ...this.metrics },
      thresholds: { ...this.thresholds },
      queryTimes: [...this.queryTimes],
      lastBenchmark: new Date(this.lastBenchmark)
    };
  }
}

/**
 * Performance Manager Factory
 * Creates and configures a PerformanceManager instance with optimal settings
 */
export class PerformanceManagerFactory {
  static async create(
    knowledgeDB: KnowledgeDB,
    connectionPool: ConnectionPool,
    queryCache: QueryCache,
    options?: {
      thresholds?: Partial<PerformanceThresholds>;
      autoInitialize?: boolean;
    }
  ): Promise<PerformanceManager> {
    const manager = new PerformanceManager(knowledgeDB, connectionPool, queryCache);
    
    if (options?.thresholds) {
      manager.updateThresholds(options.thresholds);
    }
    
    if (options?.autoInitialize !== false) {
      await manager.initialize();
    }
    
    return manager;
  }
}