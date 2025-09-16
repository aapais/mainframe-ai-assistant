/**
 * IPC Handler Usage Example
 * 
 * Demonstrates how to initialize and use the production-ready IPC handlers
 * in the main process of the Electron application.
 */

import { createIPCMainProcess } from './IPCMainProcess';
import path from 'path';

/**
 * Example: Initialize IPC Main Process
 * 
 * This is how you would initialize the IPC system in your main.ts file
 */
export async function initializeIPCExample(): Promise<void> {
  try {
    console.log('🚀 Initializing IPC Main Process Example...');

    // Configure IPC main process
    const ipcProcess = await createIPCMainProcess({
      databasePath: path.join(process.cwd(), 'data', 'knowledge.db'),
      enablePerformanceMonitoring: true,
      enableSecurityValidation: true,
      enableRequestLogging: process.env.NODE_ENV === 'development',
      geminiApiKey: process.env.GEMINI_API_KEY,
      maxConcurrentRequests: 50,
      requestTimeoutMs: 30000
    });

    // Listen to IPC events
    ipcProcess.on('initialized', () => {
      console.log('✅ IPC Process initialized successfully');
    });

    ipcProcess.on('error', (errorData) => {
      console.error('❌ IPC Error:', errorData);
      
      // Handle critical errors
      if (errorData.error.severity === 'critical') {
        console.error('🚨 Critical error - may need to restart');
        // You could implement automatic recovery here
      }
    });

    ipcProcess.on('performance-update', (performanceData) => {
      console.log('📊 Performance Update:', performanceData);
      
      // Monitor for performance issues
      if (performanceData.systemMetrics.errorRate > 0.1) {
        console.warn('⚠️ High error rate detected');
      }
    });

    // Get system status
    const status = await ipcProcess.getSystemStatus();
    console.log('📋 System Status:', {
      initialized: status.initialized,
      activeRequests: status.activeRequests,
      totalHandlers: status.totalHandlers,
      uptime: Math.round(status.uptime),
      avgResponseTime: status.performance?.averageResponseTime || 0
    });

    // Graceful shutdown on process termination
    process.on('SIGTERM', async () => {
      console.log('🔄 Received SIGTERM, shutting down gracefully...');
      await ipcProcess.shutdown();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      console.log('🔄 Received SIGINT, shutting down gracefully...');
      await ipcProcess.shutdown();
      process.exit(0);
    });

    return ipcProcess;

  } catch (error) {
    console.error('❌ Failed to initialize IPC Main Process:', error);
    throw error;
  }
}

/**
 * Example: Advanced IPC Configuration
 * 
 * Shows how to configure IPC with custom settings for different environments
 */
export function getIPCConfigForEnvironment(): any {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isProduction = process.env.NODE_ENV === 'production';
  const isTesting = process.env.NODE_ENV === 'test';

  const baseConfig = {
    databasePath: path.join(process.cwd(), 'data', 'knowledge.db'),
    geminiApiKey: process.env.GEMINI_API_KEY
  };

  if (isDevelopment) {
    return {
      ...baseConfig,
      enablePerformanceMonitoring: true,
      enableSecurityValidation: true,
      enableRequestLogging: true,
      maxConcurrentRequests: 20,
      requestTimeoutMs: 10000
    };
  }

  if (isProduction) {
    return {
      ...baseConfig,
      enablePerformanceMonitoring: true,
      enableSecurityValidation: true,
      enableRequestLogging: false,
      maxConcurrentRequests: 100,
      requestTimeoutMs: 30000
    };
  }

  if (isTesting) {
    return {
      ...baseConfig,
      databasePath: ':memory:', // In-memory database for tests
      enablePerformanceMonitoring: false,
      enableSecurityValidation: false,
      enableRequestLogging: false,
      maxConcurrentRequests: 10,
      requestTimeoutMs: 5000
    };
  }

  return baseConfig;
}

/**
 * Example: Custom Error Handling
 * 
 * Shows how to implement custom error handling for different error types
 */
export function setupCustomErrorHandling(ipcProcess: any): void {
  ipcProcess.on('error', (errorData: any) => {
    const { error, channel, requestId } = errorData;

    switch (error.code) {
      case 'IPC_DATABASE_ERROR':
        console.error('🗄️ Database error on channel:', channel);
        // Could trigger database recovery
        break;

      case 'IPC_RATE_LIMIT_EXCEEDED':
        console.warn('🚦 Rate limit exceeded on channel:', channel);
        // Could implement dynamic rate limiting
        break;

      case 'IPC_VALIDATION_FAILED':
        console.warn('🛡️ Input validation failed:', error.details);
        // Could log security incidents
        break;

      case 'IPC_EXTERNAL_SERVICE_ERROR':
        console.warn('🌐 External service error (likely Gemini API)');
        // Could implement service health checking
        break;

      default:
        console.error('❓ Unknown IPC error:', error);
    }

    // Log error for monitoring
    if (error.severity === 'critical') {
      // In production, you might send this to a monitoring service
      console.error('🚨 CRITICAL ERROR:', {
        timestamp: new Date().toISOString(),
        channel,
        requestId,
        error: error.message,
        details: error.details
      });
    }
  });
}

/**
 * Example: Performance Monitoring Setup
 * 
 * Shows how to monitor IPC performance and set up alerts
 */
export function setupPerformanceMonitoring(ipcProcess: any): void {
  let performanceHistory: any[] = [];

  ipcProcess.on('performance-update', (data: any) => {
    // Store performance data
    performanceHistory.push({
      timestamp: data.timestamp,
      ...data.systemMetrics
    });

    // Keep only last 100 entries
    if (performanceHistory.length > 100) {
      performanceHistory = performanceHistory.slice(-100);
    }

    // Check for performance degradation
    const recent = performanceHistory.slice(-10);
    if (recent.length >= 10) {
      const avgResponseTime = recent.reduce((sum, entry) => sum + entry.averageResponseTime, 0) / recent.length;
      const avgErrorRate = recent.reduce((sum, entry) => sum + entry.errorRate, 0) / recent.length;

      // Alert on performance issues
      if (avgResponseTime > 2000) { // 2 seconds
        console.warn('⏱️ PERFORMANCE ALERT: High average response time:', avgResponseTime);
      }

      if (avgErrorRate > 0.05) { // 5% error rate
        console.warn('💥 PERFORMANCE ALERT: High error rate:', avgErrorRate);
      }
    }
  });

  // Periodic performance report
  setInterval(() => {
    if (performanceHistory.length > 0) {
      const latest = performanceHistory[performanceHistory.length - 1];
      console.log('📊 Performance Report:', {
        timestamp: new Date(latest.timestamp).toLocaleTimeString(),
        activeRequests: latest.activeRequests,
        avgResponseTime: Math.round(latest.averageResponseTime),
        errorRate: (latest.errorRate * 100).toFixed(2) + '%',
        throughput: Math.round(latest.throughputPerSecond) + ' req/s'
      });
    }
  }, 5 * 60 * 1000); // Every 5 minutes
}

/**
 * Example: Health Check Integration
 * 
 * Shows how to integrate with external health monitoring systems
 */
export async function performHealthCheck(ipcProcess: any): Promise<{
  healthy: boolean;
  details: any;
}> {
  try {
    const status = await ipcProcess.getSystemStatus();
    
    const healthChecks = {
      initialized: status.initialized,
      responsiveness: status.performance.averageResponseTime < 1000,
      errorRate: status.performance.errorRate < 0.05,
      resourceUsage: status.activeRequests < 50
    };

    const healthy = Object.values(healthChecks).every(check => check === true);

    return {
      healthy,
      details: {
        checks: healthChecks,
        metrics: {
          uptime: Math.round(status.uptime),
          activeRequests: status.activeRequests,
          avgResponseTime: Math.round(status.performance.averageResponseTime),
          errorRate: (status.performance.errorRate * 100).toFixed(2) + '%'
        },
        timestamp: new Date().toISOString()
      }
    };

  } catch (error) {
    return {
      healthy: false,
      details: {
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      }
    };
  }
}

/**
 * Example: Integration with Electron Main Process
 * 
 * Shows how to integrate the IPC system with the main Electron process
 */
export async function integrateWithElectronMain(): Promise<void> {
  const { app, BrowserWindow } = require('electron');

  // Initialize IPC when Electron is ready
  app.whenReady().then(async () => {
    try {
      // Initialize IPC with environment-specific config
      const config = getIPCConfigForEnvironment();
      const ipcProcess = await createIPCMainProcess(config);

      // Setup monitoring
      setupCustomErrorHandling(ipcProcess);
      setupPerformanceMonitoring(ipcProcess);

      // Create main window after IPC is ready
      const mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          preload: path.join(__dirname, 'preload.js')
        }
      });

      // Load the application
      await mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

      console.log('✅ Electron app with IPC ready');

      // Periodic health checks
      setInterval(async () => {
        const health = await performHealthCheck(ipcProcess);
        if (!health.healthy) {
          console.warn('⚠️ Health check failed:', health.details);
        }
      }, 60000); // Every minute

    } catch (error) {
      console.error('❌ Failed to initialize Electron with IPC:', error);
      app.quit();
    }
  });

  // Graceful shutdown
  app.on('before-quit', async () => {
    console.log('🔄 Shutting down application...');
    // The IPC process will handle its own shutdown through app lifecycle events
  });
}

// Export the main initialization function
export { initializeIPCExample as initializeIPC };