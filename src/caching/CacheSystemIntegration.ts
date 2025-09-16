/**
 * Complete Cache System Integration
 * 
 * Demonstrates how to integrate all caching components for optimal
 * sub-1s performance across all MVPs of the mainframe KB assistant:
 * 
 * - Multi-layer cache manager with intelligent distribution
 * - Cache warming engine with predictive capabilities  
 * - Smart invalidation with event-driven updates
 * - Comprehensive performance monitoring and optimization
 */

import Database from 'better-sqlite3';
import { MultiLayerCacheManager } from './MultiLayerCacheManager';
import { CacheWarmingEngine } from './CacheWarmingEngine';
import { CacheInvalidationManager } from './CacheInvalidationManager';
import { CachePerformanceMonitor } from './CachePerformanceMonitor';

export interface CacheSystemConfig {
  mvpLevel: 1 | 2 | 3 | 4 | 5;
  enableDistributedCache?: boolean;
  enablePredictiveWarming?: boolean;
  enableSmartInvalidation?: boolean;
  enablePerformanceMonitoring?: boolean;
  performanceTargets?: {
    maxResponseTime: number;
    minHitRate: number;
    maxMemoryUsage: number;
  };
}

export interface CacheSystemStats {
  layers: {
    hot: { size: number; hitRate: number; avgTime: number };
    warm: { size: number; hitRate: number; avgTime: number };
    distributed: { size: number; hitRate: number; avgTime: number };
    persistent: { size: number; hitRate: number; avgTime: number };
  };
  warming: {
    totalWarmed: number;
    accuracy: number;
    effectiveness: number;
  };
  invalidation: {
    totalInvalidated: number;
    cascadeRate: number;
    accuracy: number;
  };
  performance: {
    overallHitRate: number;
    avgResponseTime: number;
    slaCompliance: number;
    grade: string;
  };
}

/**
 * Complete integrated cache system for sub-1s search performance
 */
export class CacheSystemIntegration {
  private database: Database.Database;
  private cacheManager: MultiLayerCacheManager;
  private warmingEngine: CacheWarmingEngine;
  private invalidationManager: CacheInvalidationManager;
  private performanceMonitor: CachePerformanceMonitor;
  
  private config: CacheSystemConfig;
  private initialized: boolean = false;

  constructor(database: Database.Database, config: CacheSystemConfig) {
    this.database = database;
    this.config = {
      enableDistributedCache: true,
      enablePredictiveWarming: true,
      enableSmartInvalidation: true,
      enablePerformanceMonitoring: true,
      ...config
    };
    
    console.log(`🚀 Initializing integrated cache system for MVP${config.mvpLevel}...`);
  }

  /**
   * Initialize the complete cache system
   */
  async initialize(): Promise<void> {
    try {
      // 1. Initialize multi-layer cache manager
      this.cacheManager = new MultiLayerCacheManager(
        this.database,
        this.config.mvpLevel,
        {
          enableDistributedCache: this.config.enableDistributedCache && this.config.mvpLevel >= 5,
          enablePredictiveCaching: this.config.enablePredictiveWarming,
          hotCacheSize: this.getOptimalHotCacheSize(),
          warmCacheSize: this.getOptimalWarmCacheSize(),
          maxMemoryMB: this.getOptimalMemoryLimit()
        }
      );

      // 2. Initialize cache warming engine
      this.warmingEngine = new CacheWarmingEngine(
        this.database,
        this.cacheManager,
        this.config.mvpLevel
      );

      // 3. Initialize invalidation manager
      this.invalidationManager = new CacheInvalidationManager(
        this.database,
        this.cacheManager
      );

      // 4. Initialize performance monitor
      this.performanceMonitor = new CachePerformanceMonitor(
        this.database,
        this.cacheManager,
        this.warmingEngine,
        this.invalidationManager,
        this.config.mvpLevel
      );

      // 5. Setup event listeners for system coordination
      this.setupEventListeners();

      // 6. Pre-warm cache with essential data
      await this.initialCacheWarming();

      this.initialized = true;
      console.log(`✅ Cache system initialized successfully for MVP${this.config.mvpLevel}`);

    } catch (error) {
      console.error('❌ Failed to initialize cache system:', error);
      throw error;
    }
  }

  /**
   * Primary cache interface - handles all caching logic automatically
   */
  async get<T>(
    key: string,
    computeFn: () => Promise<T> | T,
    options?: {
      ttl?: number;
      priority?: 'low' | 'normal' | 'high' | 'critical';
      tags?: string[];
      userContext?: string;
      category?: string;
    }
  ): Promise<T> {
    this.ensureInitialized();
    
    const startTime = performance.now();
    const operationId = this.generateOperationId();
    
    try {
      // Record user interaction for learning
      if (options?.userContext) {
        await this.warmingEngine.learnFromInteraction(
          options.userContext,
          key,
          options.category || 'general',
          0, // Will be updated after operation
          new Date()
        );
      }

      // Execute cache lookup through multi-layer system
      const result = await this.cacheManager.get(key, computeFn, {
        ttl: options?.ttl,
        priority: options?.priority,
        tags: options?.tags,
        userContext: options?.userContext
      });

      // Record operation metrics
      const duration = performance.now() - startTime;
      this.performanceMonitor.recordOperation(
        'cache-get',
        duration,
        duration < 10 // Assume cache hit if very fast
      );

      // Update learning with actual response time
      if (options?.userContext) {
        await this.warmingEngine.learnFromInteraction(
          options.userContext,
          key,
          options.category || 'general',
          duration,
          new Date()
        );
      }

      return result;

    } catch (error) {
      const duration = performance.now() - startTime;
      this.performanceMonitor.recordOperation('cache-get-error', duration, false);
      throw error;
    }
  }

  /**
   * Optimized search interface for KB entries
   */
  async searchKB(
    query: string,
    options?: {
      limit?: number;
      category?: string;
      userContext?: string;
      useAI?: boolean;
    }
  ): Promise<any[]> {
    const cacheKey = this.generateSearchCacheKey(query, options);
    
    return this.get(
      cacheKey,
      () => this.executeKBSearch(query, options),
      {
        ttl: this.getSearchTTL(query),
        priority: 'high', // Search results are high priority
        tags: ['search', 'kb-entries', options?.category || 'all'].filter(Boolean),
        userContext: options?.userContext,
        category: 'search'
      }
    );
  }

  /**
   * Optimized pattern analysis for MVP2+
   */
  async analyzePatterns(
    timeWindow: string = '24h',
    options?: {
      userContext?: string;
      components?: string[];
    }
  ): Promise<any[]> {
    if (this.config.mvpLevel < 2) {
      throw new Error('Pattern analysis requires MVP2 or higher');
    }

    const cacheKey = `patterns:${timeWindow}:${(options?.components || []).join(',')}`;
    
    return this.get(
      cacheKey,
      () => this.executePatternAnalysis(timeWindow, options),
      {
        ttl: 15 * 60 * 1000, // 15 minutes - patterns change frequently
        priority: 'normal',
        tags: ['patterns', 'analysis', timeWindow],
        userContext: options?.userContext,
        category: 'patterns'
      }
    );
  }

  /**
   * Optimized code analysis for MVP3+
   */
  async analyzeCode(
    filePath: string,
    options?: {
      userContext?: string;
      analysisType?: 'syntax' | 'quality' | 'links';
    }
  ): Promise<any> {
    if (this.config.mvpLevel < 3) {
      throw new Error('Code analysis requires MVP3 or higher');
    }

    const cacheKey = `code:${filePath}:${options?.analysisType || 'full'}`;
    
    return this.get(
      cacheKey,
      () => this.executeCodeAnalysis(filePath, options),
      {
        ttl: 60 * 60 * 1000, // 1 hour - code changes less frequently
        priority: 'normal',
        tags: ['code', 'analysis', options?.analysisType || 'full'],
        userContext: options?.userContext,
        category: 'code'
      }
    );
  }

  /**
   * Trigger manual cache warming for specific scenarios
   */
  async warmCache(
    strategy?: 'popular' | 'user-specific' | 'time-based' | 'predictive',
    userContext?: string
  ): Promise<number> {
    this.ensureInitialized();
    
    console.log(`🔥 Warming cache with strategy: ${strategy || 'all'}`);
    
    let totalWarmed = 0;
    
    if (!strategy || strategy === 'popular') {
      totalWarmed += await this.warmingEngine.warmCache('popular-entries');
    }
    
    if (!strategy || strategy === 'time-based') {
      totalWarmed += await this.warmingEngine.warmCache('recent-activity');
    }
    
    if (!strategy || strategy === 'predictive') {
      totalWarmed += await this.warmingEngine.predictiveCache(userContext);
    }
    
    console.log(`✅ Cache warming completed: ${totalWarmed} entries warmed`);
    return totalWarmed;
  }

  /**
   * Invalidate cache entries with smart cascade
   */
  async invalidateCache(
    pattern?: string,
    tags?: string[],
    reason?: string
  ): Promise<number> {
    this.ensureInitialized();
    
    const event = await this.invalidationManager.invalidate(pattern, tags, true, reason);
    
    // Trigger predictive warming to refill invalidated entries
    if (event.success && event.affectedKeys.length > 10) {
      setTimeout(() => {
        this.warmingEngine.predictiveCache().catch(error => {
          console.error('Post-invalidation warming failed:', error);
        });
      }, 1000); // Small delay to avoid immediate cache thrashing
    }
    
    return event.affectedKeys.length;
  }

  /**
   * Get comprehensive system statistics
   */
  getSystemStats(): CacheSystemStats {
    this.ensureInitialized();
    
    const cacheMetrics = this.cacheManager.getMetrics();
    const warmingStats = this.warmingEngine.getStats();
    const invalidationStats = this.invalidationManager.getStats();
    const performanceMetrics = this.performanceMonitor.getCurrentMetrics();
    
    return {
      layers: {
        hot: this.extractLayerStats(cacheMetrics, 'Hot Cache (L1)'),
        warm: this.extractLayerStats(cacheMetrics, 'Warm Cache (L2)'),
        distributed: this.extractLayerStats(cacheMetrics, 'Distributed Cache (L3)'),
        persistent: this.extractLayerStats(cacheMetrics, 'Persistent Cache (L4)')
      },
      warming: {
        totalWarmed: warmingStats.totalWarmed,
        accuracy: warmingStats.accuracy,
        effectiveness: warmingStats.avgTimeSaved > 0 ? 1 : 0
      },
      invalidation: {
        totalInvalidated: invalidationStats.totalInvalidations,
        cascadeRate: invalidationStats.cascadeInvalidations / Math.max(invalidationStats.totalInvalidations, 1),
        accuracy: invalidationStats.effectiveness
      },
      performance: {
        overallHitRate: performanceMetrics.overallHitRate,
        avgResponseTime: performanceMetrics.avgResponseTime,
        slaCompliance: performanceMetrics.slaCompliance,
        grade: performanceMetrics.performanceGrade
      }
    };
  }

  /**
   * Get optimization recommendations for the system
   */
  getOptimizationRecommendations(): {
    cache: string[];
    warming: string[];
    invalidation: string[];
    performance: string[];
  } {
    this.ensureInitialized();
    
    return {
      cache: this.cacheManager.getOptimizationSuggestions(),
      warming: this.warmingEngine.getRecommendations(),
      invalidation: this.invalidationManager.getRecommendations(),
      performance: this.performanceMonitor.getOptimizationSuggestions()
    };
  }

  /**
   * Generate comprehensive performance report
   */
  generatePerformanceReport(timeframe: 'hourly' | 'daily' | 'weekly' = 'hourly'): any {
    this.ensureInitialized();
    
    const report = this.performanceMonitor.generateReport(timeframe);
    const systemStats = this.getSystemStats();
    const recommendations = this.getOptimizationRecommendations();
    
    return {
      ...report,
      systemStats,
      recommendations,
      mvpLevel: this.config.mvpLevel,
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Shutdown the cache system gracefully
   */
  async shutdown(): Promise<void> {
    if (!this.initialized) return;
    
    console.log('🔄 Shutting down cache system...');
    
    try {
      // Final cache warming for critical data
      await this.warmCache('popular');
      
      // Flush any pending operations
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      this.initialized = false;
      console.log('✅ Cache system shutdown completed');
      
    } catch (error) {
      console.error('❌ Error during cache system shutdown:', error);
    }
  }

  // Private implementation methods

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('Cache system not initialized. Call initialize() first.');
    }
  }

  private setupEventListeners(): void {
    // Cache warming events
    this.warmingEngine.on('warming-completed', (event) => {
      console.log(`🔥 Cache warming: ${event.warmed}/${event.total} entries, ${event.timeSaved}ms saved`);
    });

    // Invalidation events
    this.invalidationManager.on('invalidation-completed', (event) => {
      console.log(`🗑️ Cache invalidated: ${event.affectedKeys.length} keys, cascade level ${event.cascadeLevel}`);
    });

    // Performance alerts
    this.performanceMonitor.on('performance-alert', (alert) => {
      console.log(`🚨 Performance alert: ${alert.level} - ${alert.message}`);
      
      // Auto-respond to critical alerts
      if (alert.level === 'critical') {
        this.handleCriticalAlert(alert).catch(error => {
          console.error('Failed to handle critical alert:', error);
        });
      }
    });

    // Metrics updates
    this.performanceMonitor.on('metrics-updated', (metrics) => {
      // Trigger warming if hit rate is low
      if (metrics.overallHitRate < 0.7) {
        this.warmCache('predictive').catch(error => {
          console.error('Auto-warming failed:', error);
        });
      }
    });
  }

  private async initialCacheWarming(): Promise<void> {
    console.log('🔥 Performing initial cache warming...');
    
    // Warm essential data based on MVP level
    const strategies = ['popular-entries'];
    
    if (this.config.mvpLevel >= 2) {
      strategies.push('category-overview');
    }
    
    if (this.config.mvpLevel >= 3) {
      strategies.push('recent-activity');
    }
    
    let totalWarmed = 0;
    for (const strategy of strategies) {
      try {
        const warmed = await this.warmingEngine.warmCache(strategy);
        totalWarmed += warmed;
      } catch (error) {
        console.warn(`Warning: Initial warming strategy '${strategy}' failed:`, error);
      }
    }
    
    console.log(`✅ Initial warming completed: ${totalWarmed} entries`);
  }

  private async handleCriticalAlert(alert: any): Promise<void> {
    console.log('🚨 Handling critical performance alert:', alert.metric);
    
    switch (alert.metric) {
      case 'avgResponseTime':
        // Aggressive cache warming
        await this.warmCache('popular');
        break;
        
      case 'overallHitRate':
        // Increase TTLs and warm more aggressively
        await this.warmCache('predictive');
        break;
        
      case 'memoryUsage':
        // Trigger cache cleanup
        await this.invalidateCache('*:old*', ['stale']);
        break;
    }
  }

  private getOptimalHotCacheSize(): number {
    const baseSizes = { 1: 50, 2: 75, 3: 100, 4: 150, 5: 200 };
    return baseSizes[this.config.mvpLevel] || 100;
  }

  private getOptimalWarmCacheSize(): number {
    const baseSizes = { 1: 500, 2: 750, 3: 1000, 4: 1500, 5: 2000 };
    return baseSizes[this.config.mvpLevel] || 1000;
  }

  private getOptimalMemoryLimit(): number {
    const baseLimits = { 1: 128, 2: 192, 3: 256, 4: 384, 5: 512 };
    return baseLimits[this.config.mvpLevel] || 256;
  }

  private generateSearchCacheKey(query: string, options?: any): string {
    const parts = ['search', query];
    
    if (options?.category) parts.push(`cat:${options.category}`);
    if (options?.limit) parts.push(`limit:${options.limit}`);
    if (options?.useAI) parts.push('ai');
    
    return parts.join(':');
  }

  private getSearchTTL(query: string): number {
    // Popular searches get longer TTL
    const baseWords = query.toLowerCase().split(/\s+/);
    const popularWords = ['error', 'vsam', 'jcl', 'batch', 'status'];
    
    const isPopular = popularWords.some(word => baseWords.includes(word));
    return isPopular ? 30 * 60 * 1000 : 10 * 60 * 1000; // 30min vs 10min
  }

  private async executeKBSearch(query: string, options?: any): Promise<any[]> {
    // Placeholder for actual KB search implementation
    // In real implementation, this would call the KnowledgeDB
    console.log(`Executing KB search: ${query}`);
    return [];
  }

  private async executePatternAnalysis(timeWindow: string, options?: any): Promise<any[]> {
    // Placeholder for pattern analysis implementation
    console.log(`Executing pattern analysis: ${timeWindow}`);
    return [];
  }

  private async executeCodeAnalysis(filePath: string, options?: any): Promise<any> {
    // Placeholder for code analysis implementation
    console.log(`Executing code analysis: ${filePath}`);
    return {};
  }

  private extractLayerStats(metrics: any, layerName: string): { size: number; hitRate: number; avgTime: number } {
    const layer = metrics.layers.find((l: any) => l.name === layerName);
    return layer ? {
      size: layer.size,
      hitRate: layer.hitRate,
      avgTime: layer.avgResponseTime
    } : { size: 0, hitRate: 0, avgTime: 0 };
  }

  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }
}

// Factory function for easy initialization
export async function createCacheSystem(
  database: Database.Database,
  config: CacheSystemConfig
): Promise<CacheSystemIntegration> {
  const cacheSystem = new CacheSystemIntegration(database, config);
  await cacheSystem.initialize();
  return cacheSystem;
}

// Usage example with different MVP configurations
export const MVPConfigurations = {
  MVP1: {
    mvpLevel: 1 as const,
    enableDistributedCache: false,
    enablePredictiveWarming: true,
    performanceTargets: {
      maxResponseTime: 1000,
      minHitRate: 0.8,
      maxMemoryUsage: 100 * 1024 * 1024
    }
  },
  
  MVP2: {
    mvpLevel: 2 as const,
    enableDistributedCache: false,
    enablePredictiveWarming: true,
    performanceTargets: {
      maxResponseTime: 800,
      minHitRate: 0.82,
      maxMemoryUsage: 150 * 1024 * 1024
    }
  },
  
  MVP3: {
    mvpLevel: 3 as const,
    enableDistributedCache: false,
    enablePredictiveWarming: true,
    performanceTargets: {
      maxResponseTime: 500,
      minHitRate: 0.85,
      maxMemoryUsage: 200 * 1024 * 1024
    }
  },
  
  MVP4: {
    mvpLevel: 4 as const,
    enableDistributedCache: false,
    enablePredictiveWarming: true,
    performanceTargets: {
      maxResponseTime: 300,
      minHitRate: 0.88,
      maxMemoryUsage: 250 * 1024 * 1024
    }
  },
  
  MVP5: {
    mvpLevel: 5 as const,
    enableDistributedCache: true,
    enablePredictiveWarming: true,
    performanceTargets: {
      maxResponseTime: 200,
      minHitRate: 0.9,
      maxMemoryUsage: 512 * 1024 * 1024
    }
  }
};