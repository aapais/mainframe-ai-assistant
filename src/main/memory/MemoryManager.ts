/**
 * Memory Manager for Electron Main Process
 * Handles memory monitoring, optimization, and resource management
 */

import { EventEmitter } from 'events';
import { ipcMain } from 'electron';
import { Service, ServiceContext } from '../services/types';
import { ConnectionPool } from './ConnectionPool';
import { CacheManager } from './CacheManager';

export interface MemoryMetrics {
  rss: number; // Resident Set Size
  heapUsed: number;
  heapTotal: number;
  external: number;
  arrayBuffers: number;
}

export interface MemoryThresholds {
  warning: number;  // Warning level (MB)
  critical: number; // Critical level (MB)
  cleanup: number;  // Cleanup trigger level (MB)
}

export interface MemoryConfig {
  checkInterval: number; // Memory check interval in ms
  thresholds: MemoryThresholds;
  enableAutoCleanup: boolean;
  maxCacheSize: number; // Max cache size in MB
  enableLeakDetection: boolean;
  leakCheckInterval: number;
  reportToRenderer: boolean;
}

export interface MemoryReport {
  timestamp: Date;
  metrics: MemoryMetrics;
  status: 'healthy' | 'warning' | 'critical';
  recommendations: string[];
  leaksDetected?: MemoryLeak[];
}

export interface MemoryLeak {
  type: string;
  location: string;
  size: number;
  detected: Date;
}

const DEFAULT_MEMORY_CONFIG: MemoryConfig = {
  checkInterval: 30000, // 30 seconds
  thresholds: {
    warning: 500,  // 500MB
    critical: 800, // 800MB
    cleanup: 1000  // 1GB
  },
  enableAutoCleanup: true,
  maxCacheSize: 200,
  enableLeakDetection: true,
  leakCheckInterval: 300000, // 5 minutes
  reportToRenderer: true
};

export class MemoryManager extends EventEmitter implements Service {
  public readonly name = 'MemoryManager';
  public readonly version = '1.0.0';
  public readonly priority = 1; // High priority - starts early
  public readonly dependencies: string[] = [];
  public readonly critical = true;

  private config: MemoryConfig;
  private context!: ServiceContext;
  private connectionPool!: ConnectionPool;
  private cacheManager!: CacheManager;
  
  private monitoringInterval?: ReturnType<typeof setTimeout>;
  private leakDetectionInterval?: ReturnType<typeof setTimeout>;
  private memoryHistory: MemoryMetrics[] = [];
  private lastCleanup = Date.now();
  private isMonitoring = false;
  private isShuttingDown = false;

  constructor(config: Partial<MemoryConfig> = {}) {
    super();
    this.config = { ...DEFAULT_MEMORY_CONFIG, ...config };
  }

  async initialize(context: ServiceContext): Promise<void> {
    this.context = context;
    
    // Initialize sub-components
    await this.initializeConnectionPool();
    await this.initializeCacheManager();
    
    // Setup IPC handlers
    this.setupIPCHandlers();
    
    // Start memory monitoring
    await this.startMonitoring();
    
    this.context.logger.info('MemoryManager initialized successfully');
  }

  async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    
    // Stop monitoring
    await this.stopMonitoring();
    
    // Cleanup resources
    await this.performCleanup();
    
    // Shutdown sub-components
    await this.shutdownSubComponents();
    
    this.context.logger.info('MemoryManager shutdown completed');
  }

  async healthCheck() {
    const metrics = process.memoryUsage();
    const heapMB = metrics.heapUsed / 1024 / 1024;
    
    let healthy = true;
    let status = 'healthy';
    const issues: string[] = [];
    
    if (heapMB > this.config.thresholds.critical) {
      healthy = false;
      status = 'critical';
      issues.push(`Critical memory usage: ${heapMB.toFixed(0)}MB`);
    } else if (heapMB > this.config.thresholds.warning) {
      status = 'warning';
      issues.push(`High memory usage: ${heapMB.toFixed(0)}MB`);
    }
    
    // Check connection pool health
    const poolHealth = this.connectionPool?.getHealth();
    if (poolHealth && !poolHealth.healthy) {
      healthy = false;
      issues.push('Connection pool unhealthy');
    }
    
    // Check cache health
    const cacheHealth = await this.cacheManager?.getHealth();
    if (cacheHealth && !cacheHealth.healthy) {
      healthy = false;
      issues.push('Cache manager unhealthy');
    }
    
    return {
      healthy,
      status,
      lastCheck: new Date(),
      details: {
        memoryUsage: `${heapMB.toFixed(0)}MB`,
        connectionPool: poolHealth,
        cache: cacheHealth,
        issues: issues.length > 0 ? issues : undefined
      }
    };
  }

  // ========================
  // Memory Monitoring
  // ========================

  private async startMonitoring(): Promise<void> {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    
    // Start memory monitoring
    this.monitoringInterval = setInterval(() => {
      this.checkMemoryUsage();
    }, this.config.checkInterval);
    
    // Start leak detection
    if (this.config.enableLeakDetection) {
      this.leakDetectionInterval = setInterval(() => {
        this.detectMemoryLeaks();
      }, this.config.leakCheckInterval);
    }
    
    // Initial memory check
    await this.checkMemoryUsage();
    
    this.context.logger.info(`Memory monitoring started with interval: ${this.config.checkInterval}ms`);
  }

  private async stopMonitoring(): Promise<void> {
    this.isMonitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
    
    if (this.leakDetectionInterval) {
      clearInterval(this.leakDetectionInterval);
      this.leakDetectionInterval = undefined;
    }
    
    this.context.logger.info('Memory monitoring stopped');
  }

  private async checkMemoryUsage(): Promise<MemoryReport> {
    if (this.isShuttingDown) {
      return this.createEmptyReport();
    }

    const metrics = this.getMemoryMetrics();
    const report = this.generateMemoryReport(metrics);
    
    // Store in history
    this.memoryHistory.push(metrics);
    
    // Keep only last 100 measurements
    if (this.memoryHistory.length > 100) {
      this.memoryHistory = this.memoryHistory.slice(-100);
    }
    
    // Handle memory status
    await this.handleMemoryStatus(report);
    
    // Report to renderer if enabled
    if (this.config.reportToRenderer) {
      this.reportToRenderer(report);
    }
    
    // Emit events
    this.emit('memory:check', report);
    
    return report;
  }

  private getMemoryMetrics(): MemoryMetrics {
    const usage = process.memoryUsage();
    
    return {
      rss: usage.rss,
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      external: usage.external,
      arrayBuffers: usage.arrayBuffers
    };
  }

  private generateMemoryReport(metrics: MemoryMetrics): MemoryReport {
    const heapMB = metrics.heapUsed / 1024 / 1024;
    const rssMB = metrics.rss / 1024 / 1024;
    
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    const recommendations: string[] = [];
    
    // Determine status
    if (heapMB > this.config.thresholds.critical) {
      status = 'critical';
      recommendations.push('Immediate memory cleanup required');
      recommendations.push('Consider restarting heavy services');
    } else if (heapMB > this.config.thresholds.warning) {
      status = 'warning';
      recommendations.push('Monitor memory usage closely');
      recommendations.push('Consider clearing caches');
    }
    
    // Heap utilization check
    const heapUtilization = metrics.heapUsed / metrics.heapTotal;
    if (heapUtilization > 0.9) {
      recommendations.push('High heap utilization - consider increasing heap size');
    }
    
    // Memory growth trend
    if (this.memoryHistory.length >= 10) {
      const recent = this.memoryHistory.slice(-10);
      const trend = this.calculateMemoryTrend(recent);
      
      if (trend > 5) { // Growing > 5MB per check
        recommendations.push(`Memory usage trending upward (+${trend.toFixed(1)}MB/check)`);
      }
    }
    
    return {
      timestamp: new Date(),
      metrics,
      status,
      recommendations
    };
  }

  private calculateMemoryTrend(history: MemoryMetrics[]): number {
    if (history.length < 2) return 0;
    
    const first = history[0].heapUsed / 1024 / 1024;
    const last = history[history.length - 1].heapUsed / 1024 / 1024;
    
    return (last - first) / (history.length - 1);
  }

  private async handleMemoryStatus(report: MemoryReport): Promise<void> {
    switch (report.status) {
      case 'critical':
        this.context.logger.error(`Critical memory usage detected: ${(report.metrics.heapUsed / 1024 / 1024).toFixed(0)}MB`);
        this.emit('memory:critical', report);
        
        if (this.config.enableAutoCleanup) {
          await this.performEmergencyCleanup();
        }
        break;
        
      case 'warning':
        this.context.logger.warn(`High memory usage detected: ${(report.metrics.heapUsed / 1024 / 1024).toFixed(0)}MB`);
        this.emit('memory:warning', report);
        
        if (this.config.enableAutoCleanup && this.shouldPerformCleanup()) {
          await this.performCleanup();
        }
        break;
        
      case 'healthy':
        this.emit('memory:healthy', report);
        break;
    }
  }

  private shouldPerformCleanup(): boolean {
    const timeSinceLastCleanup = Date.now() - this.lastCleanup;
    return timeSinceLastCleanup > 60000; // At least 1 minute between cleanups
  }

  // ========================
  // Memory Cleanup
  // ========================

  async performCleanup(): Promise<void> {
    if (this.isShuttingDown) return;

    const startTime = Date.now();
    const beforeMetrics = this.getMemoryMetrics();
    
    this.context.logger.info('Starting memory cleanup...');
    
    try {
      // Clear caches
      await this.cacheManager.cleanup();
      
      // Close idle database connections
      this.connectionPool.closeIdleConnections();
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      // Clear memory history if it's getting too large
      if (this.memoryHistory.length > 50) {
        this.memoryHistory = this.memoryHistory.slice(-25);
      }
      
      this.lastCleanup = Date.now();
      
      const afterMetrics = this.getMemoryMetrics();
      const freed = (beforeMetrics.heapUsed - afterMetrics.heapUsed) / 1024 / 1024;
      const duration = Date.now() - startTime;
      
      this.context.logger.info(`Memory cleanup completed in ${duration}ms, freed ${freed.toFixed(1)}MB`);
      this.emit('memory:cleanup', { freed, duration });
      
    } catch (error) {
      this.context.logger.error('Memory cleanup failed', error);
      this.emit('memory:cleanup-error', error);
    }
  }

  async performEmergencyCleanup(): Promise<void> {
    this.context.logger.warn('Performing emergency memory cleanup...');
    
    try {
      // Aggressive cache clearing
      await this.cacheManager.clear();
      
      // Close all idle connections immediately
      this.connectionPool.closeAllIdleConnections();
      
      // Clear all non-essential data
      this.memoryHistory = this.memoryHistory.slice(-10);
      
      // Force multiple GC cycles
      if (global.gc) {
        for (let i = 0; i < 3; i++) {
          global.gc();
          await this.sleep(100);
        }
      }
      
      this.lastCleanup = Date.now();
      
      this.context.logger.warn('Emergency memory cleanup completed');
      
    } catch (error) {
      this.context.logger.error('Emergency memory cleanup failed', error);
    }
  }

  // ========================
  // Memory Leak Detection
  // ========================

  private async detectMemoryLeaks(): Promise<void> {
    if (this.isShuttingDown || this.memoryHistory.length < 20) return;

    try {
      const leaks = this.analyzeMemoryLeaks();
      
      if (leaks.length > 0) {
        this.context.logger.warn(`Detected ${leaks.length} potential memory leaks`);
        this.emit('memory:leaks-detected', leaks);
        
        // Report to renderer
        if (this.config.reportToRenderer) {
          this.reportLeaksToRenderer(leaks);
        }
      }
      
    } catch (error) {
      this.context.logger.error('Memory leak detection failed', error);
    }
  }

  private analyzeMemoryLeaks(): MemoryLeak[] {
    const leaks: MemoryLeak[] = [];
    const recentHistory = this.memoryHistory.slice(-20);
    
    if (recentHistory.length < 20) return leaks;
    
    // Check for consistent memory growth
    const growthRate = this.calculateMemoryTrend(recentHistory);
    
    if (growthRate > 2) { // Growing > 2MB per check consistently
      leaks.push({
        type: 'heap_growth',
        location: 'general',
        size: growthRate * recentHistory.length,
        detected: new Date()
      });
    }
    
    // Check for heap fragmentation
    const latest = recentHistory[recentHistory.length - 1];
    const heapUtilization = latest.heapUsed / latest.heapTotal;
    
    if (heapUtilization < 0.5 && latest.heapTotal > 200 * 1024 * 1024) { // > 200MB total but < 50% used
      leaks.push({
        type: 'heap_fragmentation',
        location: 'heap',
        size: latest.heapTotal - latest.heapUsed,
        detected: new Date()
      });
    }
    
    return leaks;
  }

  // ========================
  // Sub-component Management
  // ========================

  private async initializeConnectionPool(): Promise<void> {
    this.connectionPool = new ConnectionPool({
      maxConnections: 10,
      idleTimeout: 300000, // 5 minutes
      checkInterval: 60000, // 1 minute
      enableMetrics: true
    });
    
    await this.connectionPool.initialize();
    this.context.logger.info('Connection pool initialized');
  }

  private async initializeCacheManager(): Promise<void> {
    this.cacheManager = new CacheManager({
      maxMemorySize: this.config.maxCacheSize * 1024 * 1024,
      defaultTTL: 300000, // 5 minutes
      enableDiskCache: true,
      diskCachePath: `${this.context.dataPath}/cache`,
      enableMetrics: true
    });
    
    await this.cacheManager.initialize();
    this.context.logger.info('Cache manager initialized');
  }

  private async shutdownSubComponents(): Promise<void> {
    // Shutdown connection pool
    if (this.connectionPool) {
      await this.connectionPool.shutdown();
    }
    
    // Shutdown cache manager
    if (this.cacheManager) {
      await this.cacheManager.shutdown();
    }
  }

  // ========================
  // Public API
  // ========================

  getConnectionPool(): ConnectionPool {
    return this.connectionPool;
  }

  getCacheManager(): CacheManager {
    return this.cacheManager;
  }

  async getMemoryReport(): Promise<MemoryReport> {
    return this.generateMemoryReport(this.getMemoryMetrics());
  }

  getMemoryHistory(): MemoryMetrics[] {
    return [...this.memoryHistory];
  }

  async forceGarbageCollection(): Promise<boolean> {
    if (global.gc) {
      global.gc();
      return true;
    }
    return false;
  }

  // ========================
  // IPC Communication
  // ========================

  private setupIPCHandlers(): void {
    ipcMain.handle('memory:get-report', async () => {
      return this.getMemoryReport();
    });
    
    ipcMain.handle('memory:get-history', async () => {
      return this.getMemoryHistory();
    });
    
    ipcMain.handle('memory:force-cleanup', async () => {
      await this.performCleanup();
      return this.getMemoryReport();
    });
    
    ipcMain.handle('memory:force-gc', async () => {
      return this.forceGarbageCollection();
    });
  }

  private reportToRenderer(report: MemoryReport): void {
    // Send to all renderer processes
    const windows = require('electron').BrowserWindow.getAllWindows();
    windows.forEach(window => {
      if (!window.isDestroyed()) {
        window.webContents.send('memory:report', report);
      }
    });
  }

  private reportLeaksToRenderer(leaks: MemoryLeak[]): void {
    const windows = require('electron').BrowserWindow.getAllWindows();
    windows.forEach(window => {
      if (!window.isDestroyed()) {
        window.webContents.send('memory:leaks', leaks);
      }
    });
  }

  // ========================
  // Utility Methods
  // ========================

  private createEmptyReport(): MemoryReport {
    return {
      timestamp: new Date(),
      metrics: {
        rss: 0,
        heapUsed: 0,
        heapTotal: 0,
        external: 0,
        arrayBuffers: 0
      },
      status: 'healthy',
      recommendations: []
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default MemoryManager;