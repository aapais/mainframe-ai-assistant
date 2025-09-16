/**
 * IPC Main Process Setup
 * 
 * Main process IPC initialization with comprehensive handler registration,
 * security integration, performance monitoring, and error handling.
 */

import { ipcMain, app, BrowserWindow } from 'electron';
import { IPCHandlerRegistry } from './IPCHandlerRegistry';
import { IPCSecurityManager } from './security/IPCSecurityManager';
import { KnowledgeBaseHandler } from './handlers/KnowledgeBaseHandler';
import { SearchHandler } from './handlers/SearchHandler';
import { MetricsHandler } from './handlers/MetricsHandler';
import { DatabaseManager } from '../../database/DatabaseManager';
import { MultiLayerCacheManager } from '../../caching/MultiLayerCacheManager';
import { 
  IPCChannel, 
  BaseIPCRequest, 
  BaseIPCResponse, 
  IPCErrorCode,
  IPCEvents,
  IPCEventEmitter
} from '../../types/ipc';
import { AppError } from '../../core/errors/AppError';
import { EventEmitter } from 'events';
import path from 'path';

interface IPCMainProcessConfig {
  databasePath: string;
  enablePerformanceMonitoring: boolean;
  enableSecurityValidation: boolean;
  enableRequestLogging: boolean;
  geminiApiKey?: string;
  maxConcurrentRequests?: number;
  requestTimeoutMs?: number;
}

/**
 * Main IPC Process Manager
 * 
 * Coordinates all IPC operations with full security, monitoring, and error handling.
 */
export class IPCMainProcess extends EventEmitter implements IPCEventEmitter {
  private registry: IPCHandlerRegistry;
  private securityManager: IPCSecurityManager;
  private databaseManager: DatabaseManager;
  private cacheManager: MultiLayerCacheManager;
  private knowledgeBaseHandler: KnowledgeBaseHandler;
  private searchHandler: SearchHandler;
  private metricsHandler: MetricsHandler;
  
  private isInitialized = false;
  private shutdownInProgress = false;
  private activeRequests = new Map<string, { startTime: number; channel: string }>();
  private config: Required<IPCMainProcessConfig>;

  constructor(config: IPCMainProcessConfig) {
    super();
    
    this.config = {
      databasePath: config.databasePath,
      enablePerformanceMonitoring: config.enablePerformanceMonitoring ?? true,
      enableSecurityValidation: config.enableSecurityValidation ?? true,
      enableRequestLogging: config.enableRequestLogging ?? false,
      geminiApiKey: config.geminiApiKey,
      maxConcurrentRequests: config.maxConcurrentRequests ?? 100,
      requestTimeoutMs: config.requestTimeoutMs ?? 30000
    };

    this.setupErrorHandling();
  }

  /**
   * Initialize the IPC main process
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      throw new Error('IPC Main Process already initialized');
    }

    try {
      console.log('🚀 Initializing IPC Main Process...');

      // Initialize core components
      await this.initializeCore();
      
      // Initialize handlers
      await this.initializeHandlers();
      
      // Register IPC channels
      this.registerIPCChannels();
      
      // Start monitoring
      if (this.config.enablePerformanceMonitoring) {
        this.startPerformanceMonitoring();
      }

      // Setup lifecycle handlers
      this.setupLifecycleHandlers();

      this.isInitialized = true;
      this.emit('initialized');

      console.log('✅ IPC Main Process initialized successfully');
      this.logSystemInfo();

    } catch (error) {
      console.error('❌ Failed to initialize IPC Main Process:', error);
      await this.cleanup();
      throw error;
    }
  }

  /**
   * Gracefully shutdown the IPC main process
   */
  async shutdown(): Promise<void> {
    if (this.shutdownInProgress || !this.isInitialized) {
      return;
    }

    this.shutdownInProgress = true;
    console.log('🔄 Shutting down IPC Main Process...');

    try {
      // Wait for active requests to complete (with timeout)
      await this.waitForActiveRequests(5000);

      // Shutdown components in reverse order
      if (this.metricsHandler) {
        await this.metricsHandler.shutdown();
      }

      if (this.registry) {
        await this.registry.shutdown();
      }

      if (this.cacheManager) {
        await this.cacheManager.shutdown();
      }

      if (this.databaseManager) {
        await this.databaseManager.shutdown();
      }

      // Remove all IPC listeners
      ipcMain.removeAllListeners();

      this.isInitialized = false;
      this.emit('shutdown');

      console.log('✅ IPC Main Process shut down successfully');

    } catch (error) {
      console.error('❌ Error during IPC shutdown:', error);
      throw error;
    }
  }

  /**
   * Get system status and metrics
   */
  async getSystemStatus(): Promise<{
    initialized: boolean;
    activeRequests: number;
    totalHandlers: number;
    uptime: number;
    performance: any;
    health: any;
  }> {
    if (!this.isInitialized) {
      return {
        initialized: false,
        activeRequests: 0,
        totalHandlers: 0,
        uptime: 0,
        performance: null,
        health: null
      };
    }

    const realTimeMetrics = this.registry.getRealTimeMetrics();
    const performanceReport = await this.metricsHandler.getPerformanceReport();

    return {
      initialized: this.isInitialized,
      activeRequests: this.activeRequests.size,
      totalHandlers: realTimeMetrics.totalHandlers,
      uptime: process.uptime(),
      performance: realTimeMetrics,
      health: performanceReport
    };
  }

  // Private methods

  private async initializeCore(): Promise<void> {
    // Initialize database manager
    this.databaseManager = new DatabaseManager({
      path: this.config.databasePath,
      enableWAL: true,
      enableForeignKeys: true,
      maxConnections: 10,
      enableMonitoring: this.config.enablePerformanceMonitoring,
      backup: {
        enabled: true,
        intervalHours: 6,
        retentionDays: 30
      },
      queryCache: {
        enabled: true,
        maxSize: 1000,
        ttlMs: 300000
      }
    });

    await this.databaseManager.initialize();

    // Initialize cache manager
    this.cacheManager = new MultiLayerCacheManager({
      memory: {
        maxSize: 100 * 1024 * 1024, // 100MB
        maxAge: 30 * 60 * 1000 // 30 minutes
      },
      persistent: {
        enabled: true,
        path: path.join(path.dirname(this.config.databasePath), 'cache'),
        maxSize: 500 * 1024 * 1024, // 500MB
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      }
    });

    await this.cacheManager.initialize();

    // Initialize security manager
    this.securityManager = new IPCSecurityManager({
      enableChannelWhitelist: this.config.enableSecurityValidation,
      enableRateLimiting: this.config.enableSecurityValidation,
      enableInputSanitization: this.config.enableSecurityValidation,
      enableSchemaValidation: this.config.enableSecurityValidation,
      logSecurityEvents: this.config.enableRequestLogging,
      maxRequestSize: 10 * 1024 * 1024, // 10MB
      requestTimeoutMs: this.config.requestTimeoutMs
    });

    // Initialize handler registry
    this.registry = new IPCHandlerRegistry(this.securityManager);
    
    // Connect registry events
    this.setupRegistryEvents();
  }

  private async initializeHandlers(): Promise<void> {
    // Initialize Knowledge Base handler
    this.knowledgeBaseHandler = new KnowledgeBaseHandler(
      this.databaseManager,
      this.cacheManager
    );

    // Initialize Search handler
    this.searchHandler = new SearchHandler(
      this.databaseManager,
      this.cacheManager,
      this.config.geminiApiKey
    );

    // Initialize Metrics handler
    this.metricsHandler = new MetricsHandler(
      this.databaseManager,
      this.cacheManager,
      this.securityManager,
      () => this.registry.getAllMetrics()
    );

    console.log('✅ IPC Handlers initialized');
  }

  private registerIPCChannels(): void {
    console.log('📡 Registering IPC channels...');

    // Knowledge Base channels
    this.registry.register(
      'kb:search:local',
      this.knowledgeBaseHandler.handleLocalSearch,
      {
        cacheable: true,
        cacheTTL: 300000, // 5 minutes
        rateLimitConfig: { requests: 100, windowMs: 60000 },
        trackMetrics: true,
        logRequests: this.config.enableRequestLogging
      }
    );

    this.registry.register(
      'kb:entry:create',
      this.knowledgeBaseHandler.handleEntryCreate,
      {
        validateInput: true,
        sanitizeInput: true,
        rateLimitConfig: { requests: 10, windowMs: 60000 },
        trackMetrics: true,
        alertOnErrors: true
      }
    );

    this.registry.register(
      'kb:entry:get',
      this.knowledgeBaseHandler.handleEntryGet,
      {
        cacheable: true,
        cacheTTL: 600000, // 10 minutes
        rateLimitConfig: { requests: 200, windowMs: 60000 },
        trackMetrics: true
      }
    );

    this.registry.register(
      'kb:entry:update',
      this.knowledgeBaseHandler.handleEntryUpdate,
      {
        validateInput: true,
        sanitizeInput: true,
        rateLimitConfig: { requests: 20, windowMs: 60000 },
        trackMetrics: true,
        alertOnErrors: true
      }
    );

    this.registry.register(
      'kb:entry:delete',
      this.knowledgeBaseHandler.handleEntryDelete,
      {
        requireAuth: true,
        rateLimitConfig: { requests: 5, windowMs: 60000 },
        trackMetrics: true,
        alertOnErrors: true
      }
    );

    this.registry.register(
      'kb:feedback:rate',
      this.knowledgeBaseHandler.handleFeedback,
      {
        rateLimitConfig: { requests: 50, windowMs: 60000 },
        trackMetrics: true
      }
    );

    // Search channels
    this.registry.register(
      'kb:search:ai',
      this.searchHandler.handleAISearch,
      {
        cacheable: true,
        cacheTTL: 600000, // 10 minutes
        rateLimitConfig: { requests: 30, windowMs: 60000 },
        trackMetrics: true,
        logRequests: this.config.enableRequestLogging,
        alertOnErrors: true
      }
    );

    // System channels
    this.registry.register(
      'system:metrics:get',
      this.metricsHandler.handleSystemMetrics,
      {
        cacheable: true,
        cacheTTL: 30000, // 30 seconds
        rateLimitConfig: { requests: 60, windowMs: 60000 },
        trackMetrics: true
      }
    );

    this.registry.register(
      'system:database:status',
      this.metricsHandler.handleDatabaseStatus,
      {
        cacheable: true,
        cacheTTL: 60000, // 1 minute
        rateLimitConfig: { requests: 30, windowMs: 60000 },
        trackMetrics: true
      }
    );

    this.registry.register(
      'system:health:check',
      this.metricsHandler.handleHealthCheck,
      {
        cacheable: true,
        cacheTTL: 30000, // 30 seconds
        rateLimitConfig: { requests: 30, windowMs: 60000 },
        trackMetrics: true
      }
    );

    // Register the actual IPC handlers
    this.setupIPCListeners();

    console.log('✅ IPC channels registered');
  }

  private setupIPCListeners(): void {
    // Main IPC message handler
    ipcMain.handle('ipc-request', async (event, channel: IPCChannel, request: BaseIPCRequest) => {
      return await this.handleIPCRequest(channel, request, {
        webContentsId: event.sender.id
      });
    });

    // Batch request handler
    ipcMain.handle('ipc-batch-request', async (event, requests: Array<{ channel: IPCChannel; request: BaseIPCRequest }>) => {
      const results = await Promise.allSettled(
        requests.map(({ channel, request }) => 
          this.handleIPCRequest(channel, request, { webContentsId: event.sender.id })
        )
      );
      
      return results.map((result, index) => ({
        requestId: requests[index].request.requestId,
        success: result.status === 'fulfilled',
        data: result.status === 'fulfilled' ? result.value : undefined,
        error: result.status === 'rejected' ? { 
          code: IPCErrorCode.HANDLER_ERROR,
          message: String(result.reason),
          severity: 'medium'
        } : undefined
      }));
    });

    // Stream request handler
    ipcMain.handle('ipc-stream-request', async (event, channel: IPCChannel, request: any) => {
      // TODO: Implement streaming support
      console.warn('Streaming not yet implemented, falling back to regular request');
      return await this.handleIPCRequest(channel, request, { webContentsId: event.sender.id });
    });
  }

  private async handleIPCRequest(
    channel: IPCChannel, 
    request: BaseIPCRequest,
    context?: { webContentsId?: number; userId?: string }
  ): Promise<BaseIPCResponse> {
    const requestId = request.requestId || this.generateRequestId();
    const startTime = Date.now();

    // Track active request
    this.activeRequests.set(requestId, { startTime, channel });

    try {
      // Check if we're at max concurrent requests
      if (this.activeRequests.size > this.config.maxConcurrentRequests) {
        return this.createErrorResponse(
          requestId,
          startTime,
          IPCErrorCode.RATE_LIMIT_EXCEEDED,
          'Maximum concurrent requests exceeded'
        );
      }

      // Execute request through registry
      const response = await this.registry.execute(channel, request, {
        userId: context?.userId,
        sessionId: `session_${context?.webContentsId || 'unknown'}`,
        clientInfo: { webContentsId: context?.webContentsId }
      });

      // Log successful request
      if (this.config.enableRequestLogging) {
        console.log(`📥 IPC Request completed [${channel}]:`, {
          requestId,
          duration: Date.now() - startTime,
          success: response.success
        });
      }

      return response;

    } catch (error) {
      console.error(`❌ IPC Request failed [${channel}]:`, error);
      
      return this.createErrorResponse(
        requestId,
        startTime,
        IPCErrorCode.HANDLER_ERROR,
        `Request failed: ${error instanceof Error ? error.message : String(error)}`,
        { originalError: error }
      );

    } finally {
      this.activeRequests.delete(requestId);
    }
  }

  private setupRegistryEvents(): void {
    // Forward registry events
    this.registry.on('request:start', (data) => this.emit('request:start', data));
    this.registry.on('request:complete', (data) => this.emit('request:complete', data));
    this.registry.on('error', (data) => this.emit('error', data));
    this.registry.on('cache:hit', (data) => this.emit('cache:hit', data));
    this.registry.on('cache:miss', (data) => this.emit('cache:miss', data));
    this.registry.on('metrics:updated', (data) => this.emit('metrics:updated', data));

    // Handle registry errors
    this.registry.on('error', (errorData) => {
      console.error('Registry error:', errorData);
      
      // Emit to main application for handling
      this.emit('ipc-error', {
        timestamp: Date.now(),
        channel: errorData.channel,
        error: errorData.error
      });
    });
  }

  private setupLifecycleHandlers(): void {
    // Handle app quit
    app.on('before-quit', async (event) => {
      if (!this.shutdownInProgress && this.isInitialized) {
        event.preventDefault();
        
        try {
          await this.shutdown();
          app.quit();
        } catch (error) {
          console.error('Error during shutdown:', error);
          app.quit();
        }
      }
    });

    // Handle all windows closed
    app.on('window-all-closed', () => {
      // On macOS, keep the app running
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    // Handle application errors
    process.on('uncaughtException', (error) => {
      console.error('Uncaught exception in IPC main process:', error);
      this.emit('error', {
        error: {
          code: IPCErrorCode.UNHANDLED_REJECTION,
          message: error.message,
          details: { stack: error.stack },
          severity: 'critical'
        },
        channel: 'system',
        requestId: 'uncaught-exception'
      });
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled promise rejection in IPC main process:', reason);
      this.emit('error', {
        error: {
          code: IPCErrorCode.UNHANDLED_REJECTION,
          message: String(reason),
          details: { promise },
          severity: 'critical'
        },
        channel: 'system',
        requestId: 'unhandled-rejection'
      });
    });
  }

  private setupErrorHandling(): void {
    this.on('error', (errorData) => {
      // Log critical errors
      if (errorData.error.severity === 'critical') {
        console.error('🚨 Critical IPC Error:', errorData);
      }
    });
  }

  private startPerformanceMonitoring(): void {
    // Monitor system performance every 60 seconds
    setInterval(() => {
      if (!this.isInitialized) return;
      
      const metrics = this.registry.getRealTimeMetrics();
      
      // Emit performance metrics
      this.emit('performance-update', {
        timestamp: Date.now(),
        activeRequests: this.activeRequests.size,
        systemMetrics: metrics
      });
      
      // Check for performance issues
      if (metrics.errorRate > 0.1) {
        console.warn(`⚠️ High IPC error rate: ${(metrics.errorRate * 100).toFixed(1)}%`);
      }
      
      if (metrics.averageResponseTime > 5000) {
        console.warn(`⚠️ Slow IPC response time: ${metrics.averageResponseTime}ms`);
      }
      
    }, 60000);
  }

  private async waitForActiveRequests(timeoutMs: number): Promise<void> {
    const startTime = Date.now();
    
    while (this.activeRequests.size > 0 && (Date.now() - startTime) < timeoutMs) {
      console.log(`⏳ Waiting for ${this.activeRequests.size} active requests...`);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (this.activeRequests.size > 0) {
      console.warn(`⚠️ Forcing shutdown with ${this.activeRequests.size} active requests`);
    }
  }

  private async cleanup(): Promise<void> {
    try {
      // Clear active requests
      this.activeRequests.clear();
      
      // Remove all listeners
      this.removeAllListeners();
      
      // Remove IPC listeners
      ipcMain.removeAllListeners();
      
    } catch (error) {
      console.error('Error during IPC cleanup:', error);
    }
  }

  private logSystemInfo(): void {
    console.log('📊 IPC System Information:');
    console.log(`   • Database: ${this.config.databasePath}`);
    console.log(`   • Security: ${this.config.enableSecurityValidation ? 'Enabled' : 'Disabled'}`);
    console.log(`   • Monitoring: ${this.config.enablePerformanceMonitoring ? 'Enabled' : 'Disabled'}`);
    console.log(`   • Max Concurrent: ${this.config.maxConcurrentRequests}`);
    console.log(`   • Request Timeout: ${this.config.requestTimeoutMs}ms`);
    console.log(`   • AI Integration: ${this.config.geminiApiKey ? 'Available' : 'Not configured'}`);
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private createErrorResponse(
    requestId: string,
    startTime: number,
    code: IPCErrorCode,
    message: string,
    details?: any
  ): BaseIPCResponse {
    return {
      success: false,
      requestId,
      timestamp: Date.now(),
      executionTime: Date.now() - startTime,
      error: {
        code,
        message,
        details,
        severity: 'medium',
        retryable: false
      }
    };
  }
}

// Export a factory function for easy initialization
export async function createIPCMainProcess(config: IPCMainProcessConfig): Promise<IPCMainProcess> {
  const ipcProcess = new IPCMainProcess(config);
  await ipcProcess.initialize();
  return ipcProcess;
}