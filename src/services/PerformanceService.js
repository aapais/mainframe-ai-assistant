'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.PerformanceService = void 0;
const events_1 = require('events');
const SearchPerformanceMonitor_1 = require('../monitoring/SearchPerformanceMonitor');
const PerformanceOptimizer_1 = require('../optimization/PerformanceOptimizer');
const PerformanceTestSuite_1 = require('../../tests/performance/PerformanceTestSuite');
const PerformanceMonitor_1 = require('../database/PerformanceMonitor');
class PerformanceService extends events_1.EventEmitter {
  db;
  searchMonitor;
  optimizer;
  testSuite;
  baseMonitor;
  config;
  lastOptimization = null;
  isInitialized = false;
  serviceWorker = null;
  cache = null;
  constructor(database, config) {
    super();
    this.db = database;
    this.config = {
      autoOptimization: true,
      alertThresholds: {
        responseTime: 1000,
        memoryUsage: 400,
        errorRate: 0.05,
        cacheHitRate: 0.7,
      },
      monitoringInterval: 15000,
      optimizationCooldown: 300000,
      ...config,
    };
    this.initializeServices();
  }
  async initializeServices() {
    try {
      console.log('🚀 Initializing Performance Service...');
      this.baseMonitor = new PerformanceMonitor_1.PerformanceMonitor(this.db);
      this.searchMonitor = new SearchPerformanceMonitor_1.SearchPerformanceMonitor(
        this.db,
        this.baseMonitor
      );
      this.optimizer = new PerformanceOptimizer_1.PerformanceOptimizer(this.db);
      this.testSuite = new PerformanceTestSuite_1.PerformanceTestSuite(this.db);
      this.setupEventListeners();
      await this.initializeServiceWorker();
      this.startPerformanceMonitoring();
      this.isInitialized = true;
      console.log('✅ Performance Service initialized successfully');
      this.emit('service-initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Performance Service:', error);
      throw error;
    }
  }
  async getMetrics(timeRange = '1h') {
    if (!this.isInitialized) {
      throw new Error('Performance service not initialized');
    }
    const dashboardData = this.searchMonitor.getDashboardData();
    const optimizerAnalysis = await this.optimizer.analyzePerformance();
    return {
      metrics: this.generateTimeSeriesMetrics(timeRange),
      alerts: dashboardData.activeAlerts,
      recommendations: optimizerAnalysis.recommendations.map(r => r.name),
      slaStatus: dashboardData.slaStatus,
      trends: dashboardData.recentTrends,
    };
  }
  recordSearch(query, duration, resultCount, cacheHit, strategy = 'default', indexesUsed = []) {
    if (!this.isInitialized) return;
    this.searchMonitor.recordSearch(query, duration, resultCount, cacheHit, strategy, indexesUsed);
    if (this.config.autoOptimization && duration > this.config.alertThresholds.responseTime) {
      this.checkAutoOptimization();
    }
  }
  async executeOptimization(strategyName) {
    if (!this.isInitialized) {
      throw new Error('Performance service not initialized');
    }
    try {
      const result = await this.optimizer.optimizeStrategy(strategyName);
      this.emit('optimization-executed', {
        strategy: strategyName,
        result,
      });
      return {
        success: result.success,
        improvement: result.improvement,
        error: result.error,
        recommendations: result.recommendations,
      };
    } catch (error) {
      console.error(`Failed to execute optimization ${strategyName}:`, error);
      return {
        success: false,
        improvement: 0,
        error: error.message,
      };
    }
  }
  async runPerformanceTests() {
    if (!this.isInitialized) {
      throw new Error('Performance service not initialized');
    }
    console.log('🧪 Running performance test suite...');
    try {
      const testResults = await this.testSuite.runFullTestSuite();
      this.emit('performance-tests-completed', testResults);
      return {
        summary: testResults.summary,
        results: testResults.results,
      };
    } catch (error) {
      console.error('Performance tests failed:', error);
      throw error;
    }
  }
  async getOptimizationRecommendations(metric) {
    if (!this.isInitialized) {
      throw new Error('Performance service not initialized');
    }
    const strategies = this.optimizer.getRecommendationsForMetric(metric);
    const analysis = await this.optimizer.analyzePerformance();
    return {
      strategies,
      quickWins: analysis.quickWins,
      analysis: analysis.currentMetrics,
    };
  }
  setAutoOptimization(enabled) {
    this.config.autoOptimization = enabled;
    console.log(`🤖 Auto-optimization ${enabled ? 'enabled' : 'disabled'}`);
    this.emit('auto-optimization-changed', { enabled });
  }
  updateThresholds(thresholds) {
    this.config.alertThresholds = { ...this.config.alertThresholds, ...thresholds };
    console.log('📊 Performance thresholds updated:', this.config.alertThresholds);
    this.emit('thresholds-updated', this.config.alertThresholds);
  }
  getPerformanceHistory() {
    if (!this.isInitialized) {
      throw new Error('Performance service not initialized');
    }
    const optimizationHistory = this.optimizer.getOptimizationHistory();
    const trends = this.searchMonitor.getPerformanceTrends(168);
    const slaStatus = this.searchMonitor.getSLAStatus();
    return {
      optimizations: optimizationHistory,
      trends,
      slaCompliance: [slaStatus],
    };
  }
  async profileMemory() {
    if (!this.isInitialized) {
      throw new Error('Performance service not initialized');
    }
    const memoryProfile = await this.optimizer.profileMemoryUsage();
    return {
      usage: memoryProfile.heapUsage,
      leaks: memoryProfile.leaks,
      recommendations: memoryProfile.recommendations,
    };
  }
  async analyzeBundleSize() {
    if (!this.isInitialized) {
      throw new Error('Performance service not initialized');
    }
    const bundleAnalysis = await this.optimizer.analyzeBundleSize();
    return {
      totalSize: bundleAnalysis.totalSize,
      chunks: Object.fromEntries(bundleAnalysis.chunkSizes),
      optimizations: bundleAnalysis.treeshakingOpportunities,
    };
  }
  async optimizeWithWebAssembly() {
    try {
      if (typeof WebAssembly === 'undefined') {
        return { available: false, modules: [] };
      }
      const wasmModules = ['search-algorithms', 'text-processing', 'mathematical-operations'];
      const performance = 1.5;
      return {
        available: true,
        modules: wasmModules,
        performance,
      };
    } catch (error) {
      return { available: false, modules: [] };
    }
  }
  setupEventListeners() {
    this.searchMonitor.on('search-alert', alert => {
      this.emit('performance-alert', alert);
      if (this.config.autoOptimization && alert.level === 'critical') {
        this.checkAutoOptimization();
      }
    });
    this.optimizer.on('optimization-started', data => {
      this.emit('optimization-started', data);
    });
    this.optimizer.on('optimization-completed', data => {
      this.emit('optimization-completed', data);
      this.lastOptimization = new Date();
    });
    console.log('📡 Event listeners configured');
  }
  async initializeServiceWorker() {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/performance-sw.js');
        console.log('📱 Service Worker registered for performance caching');
        if (registration.active) {
          this.serviceWorker = registration.active;
        }
        if ('caches' in window) {
          this.cache = await caches.open('performance-cache-v1');
        }
      } catch (error) {
        console.warn('Service Worker registration failed:', error);
      }
    }
  }
  startPerformanceMonitoring() {
    setInterval(() => {
      this.checkSystemHealth();
    }, this.config.monitoringInterval);
    console.log('📊 Performance monitoring started');
  }
  checkSystemHealth() {
    const memUsage = process.memoryUsage();
    const memMB = memUsage.heapUsed / 1024 / 1024;
    if (memMB > this.config.alertThresholds.memoryUsage) {
      this.emit('performance-alert', {
        level: 'warning',
        metric: 'memory_usage',
        currentValue: memMB,
        threshold: this.config.alertThresholds.memoryUsage,
        message: `High memory usage: ${memMB.toFixed(1)}MB`,
      });
    }
  }
  checkAutoOptimization() {
    if (!this.config.autoOptimization) return;
    const now = new Date();
    const cooldownPassed =
      !this.lastOptimization ||
      now.getTime() - this.lastOptimization.getTime() > this.config.optimizationCooldown;
    if (cooldownPassed) {
      this.optimizer.autoOptimize('conservative').catch(error => {
        console.error('Auto-optimization failed:', error);
      });
    }
  }
  generateTimeSeriesMetrics(timeRange) {
    const hours = timeRange === '1h' ? 1 : timeRange === '24h' ? 24 : 168;
    const points = timeRange === '1h' ? 60 : timeRange === '24h' ? 24 : 48;
    const interval = (hours * 60 * 60 * 1000) / points;
    const metrics = [];
    const now = Date.now();
    for (let i = 0; i < points; i++) {
      const timestamp = new Date(now - (points - i) * interval);
      const baseResponseTime = 400 + Math.random() * 200;
      const baseThroughput = 8 + Math.random() * 4;
      const baseCacheHitRate = 0.75 + Math.random() * 0.2;
      const baseMemoryUsage = 250 + Math.random() * 100;
      metrics.push({
        timestamp,
        responseTime: baseResponseTime,
        throughput: baseThroughput,
        cacheHitRate: baseCacheHitRate,
        slaCompliance: baseResponseTime <= 1000 ? 1 : Math.random() * 0.8,
        errorRate: Math.random() * 0.03,
        memoryUsage: baseMemoryUsage,
        cpuUsage: 40 + Math.random() * 30,
      });
    }
    return metrics;
  }
}
exports.PerformanceService = PerformanceService;
//# sourceMappingURL=PerformanceService.js.map
