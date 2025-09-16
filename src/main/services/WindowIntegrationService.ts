/**
 * Window Integration Service - Service Coordination for Window Management
 * 
 * Coordinates between WindowManager and other services to provide
 * seamless integration and error recovery mechanisms
 */

import { Service, ServiceContext, ServiceHealth } from './ServiceManager';
import { WindowManager } from '../windows/WindowManager';
import { WindowDatabaseService } from './WindowDatabaseService';
import { EnhancedIPCService } from './EnhancedIPCService';
import { EventEmitter } from 'events';
import { 
  WindowType, 
  WindowInstance, 
  WindowEventData,
  WindowWorkspace 
} from '../windows/types/WindowTypes';

interface WindowIntegrationConfig {
  enableAutoRecovery: boolean;
  maxRecoveryAttempts: number;
  healthCheckInterval: number;
  enableEventLogging: boolean;
  enablePerformanceMetrics: boolean;
}

interface WindowServiceHealth {
  windowManager: boolean;
  database: boolean;
  ipc: boolean;
  integration: boolean;
  lastCheck: Date;
  errors: string[];
}

/**
 * Window Integration Service provides coordination between window management
 * components and other application services with error recovery
 */
export class WindowIntegrationService extends EventEmitter implements Service {
  public readonly name = 'WindowIntegrationService';
  public readonly version = '1.0.0';
  public readonly dependencies = ['WindowManager', 'WindowDatabaseService', 'EnhancedIPCService'];
  public readonly priority = 2; // After core services but before app services
  public readonly critical = true;

  private windowManager?: WindowManager;
  private databaseService?: WindowDatabaseService;
  private ipcService?: EnhancedIPCService;
  
  private config: WindowIntegrationConfig;
  private healthCheckTimer?: NodeJS.Timeout;
  private recoveryAttempts = new Map<string, number>();
  
  private stats = {
    windowsCreated: 0,
    windowsDestroyed: 0,
    workspacesSwitched: 0,
    recoveryAttempts: 0,
    recoverySuccesses: 0,
    healthChecks: 0,
    errors: [] as string[]
  };

  constructor(private context: ServiceContext) {
    super();
    
    this.config = {
      enableAutoRecovery: true,
      maxRecoveryAttempts: 3,
      healthCheckInterval: 30000, // 30 seconds
      enableEventLogging: true,
      enablePerformanceMetrics: true
    };
  }

  async initialize(context: ServiceContext): Promise<void> {
    try {
      context.logger.info('Initializing Window Integration Service...');

      // Get dependent services
      this.windowManager = context.getService<WindowManager>('WindowManager');
      this.databaseService = context.getService<WindowDatabaseService>('WindowDatabaseService');
      this.ipcService = context.getService<EnhancedIPCService>('EnhancedIPCService');

      if (!this.windowManager) {
        throw new Error('WindowManager service not available');
      }

      if (!this.databaseService) {
        throw new Error('WindowDatabaseService not available');
      }

      // Setup event handlers
      this.setupEventHandlers();

      // Setup IPC integration if available
      if (this.ipcService) {
        this.setupIPCIntegration();
      }

      // Start health monitoring
      this.startHealthMonitoring();

      // Register integration IPC handlers
      this.registerIntegrationHandlers();

      context.logger.info('Window Integration Service initialized successfully');
      
      this.emit('initialized');
    } catch (error) {
      context.logger.error('Failed to initialize Window Integration Service', error);
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    try {
      this.context.logger.info('Shutting down Window Integration Service...');

      // Stop health monitoring
      if (this.healthCheckTimer) {
        clearInterval(this.healthCheckTimer);
        this.healthCheckTimer = undefined;
      }

      // Cleanup event handlers
      this.removeAllListeners();

      this.context.logger.info('Window Integration Service shut down successfully');
      
      this.emit('shutdown');
    } catch (error) {
      this.context.logger.error('Error during Window Integration Service shutdown', error);
      throw error;
    }
  }

  async healthCheck(): Promise<ServiceHealth> {
    const startTime = Date.now();
    
    try {
      const componentHealth = await this.checkComponentHealth();
      
      this.stats.healthChecks++;
      
      const healthy = Object.values(componentHealth).every(h => h === true);
      
      return {
        healthy,
        details: {
          components: componentHealth,
          stats: this.stats,
          recoveryAttempts: Array.from(this.recoveryAttempts.entries())
        },
        lastCheck: new Date(),
        responseTime: Date.now() - startTime
      };
    } catch (error) {
      this.stats.errors.push(`Health check failed: ${error.message}`);
      
      return {
        healthy: false,
        error: error.message,
        lastCheck: new Date(),
        responseTime: Date.now() - startTime
      };
    }
  }

  // ===== PUBLIC API =====

  /**
   * Create a window with integrated database persistence and event logging
   */
  async createWindow(type: WindowType, config?: any): Promise<WindowInstance | null> {
    const startTime = Date.now();
    
    try {
      if (!this.windowManager) {
        throw new Error('WindowManager not available');
      }

      // Create the window
      const windowInstance = await this.windowManager.createWindow(type, config);
      
      if (!windowInstance) {
        this.context.logger.warn(`Failed to create window of type: ${type}`);
        return null;
      }

      // Persist window state
      if (this.databaseService) {
        const windowState = this.windowInstanceToState(windowInstance);
        await this.databaseService.saveWindowState(windowState);
      }

      // Log event
      if (this.config.enableEventLogging) {
        await this.logWindowEvent({
          windowId: windowInstance.id,
          windowType: type,
          event: 'created',
          timestamp: new Date(),
          data: { config }
        });
      }

      // Update stats
      this.stats.windowsCreated++;
      
      // Performance metrics
      if (this.config.enablePerformanceMetrics) {
        this.context.metrics.histogram('window.integration.create_time', Date.now() - startTime);
        this.context.metrics.increment('window.integration.windows_created');
      }

      this.context.logger.info(`Successfully created window: ${type} (${windowInstance.id})`);
      this.emit('windowCreated', windowInstance);
      
      return windowInstance;
    } catch (error) {
      this.stats.errors.push(`Window creation failed: ${error.message}`);
      this.context.logger.error(`Failed to create window: ${type}`, error);
      
      // Attempt recovery if enabled
      if (this.config.enableAutoRecovery) {
        return await this.attemptWindowRecovery(type, config, 'create');
      }
      
      throw error;
    }
  }

  /**
   * Close a window with integrated cleanup
   */
  async closeWindow(windowId: string): Promise<boolean> {
    try {
      if (!this.windowManager) {
        throw new Error('WindowManager not available');
      }

      // Get window info before closing
      const windowInstance = this.windowManager.getWindow(windowId);
      
      // Close the window
      const closed = await this.windowManager.closeWindow(windowId);
      
      if (closed && windowInstance) {
        // Clean up database
        if (this.databaseService) {
          await this.databaseService.deleteWindowState(windowId);
        }

        // Log event
        if (this.config.enableEventLogging) {
          await this.logWindowEvent({
            windowId,
            windowType: windowInstance.type,
            event: 'destroyed',
            timestamp: new Date()
          });
        }

        // Update stats
        this.stats.windowsDestroyed++;
        
        this.context.logger.info(`Successfully closed window: ${windowId}`);
        this.emit('windowClosed', windowInstance);
      }

      return closed;
    } catch (error) {
      this.stats.errors.push(`Window close failed: ${error.message}`);
      this.context.logger.error(`Failed to close window: ${windowId}`, error);
      
      // Don't throw on close errors to prevent cascading failures
      return false;
    }
  }

  /**
   * Switch workspace with integrated state management
   */
  async switchWorkspace(workspaceName: string): Promise<boolean> {
    try {
      if (!this.windowManager || !this.databaseService) {
        throw new Error('Required services not available');
      }

      // Save current window states
      const currentWindows = this.windowManager.getAllWindows?.() || [];
      for (const window of currentWindows) {
        const state = this.windowInstanceToState(window);
        await this.databaseService.saveWindowState(state);
      }

      // Switch workspace
      const success = await this.windowManager.switchWorkspace(workspaceName);
      
      if (success) {
        // Log workspace switch
        if (this.config.enableEventLogging) {
          await this.logWorkspaceEvent(workspaceName, 'switched');
        }

        // Update stats
        this.stats.workspacesSwitched++;
        
        this.context.logger.info(`Successfully switched to workspace: ${workspaceName}`);
        this.emit('workspaceSwitched', workspaceName);
      }

      return success;
    } catch (error) {
      this.stats.errors.push(`Workspace switch failed: ${error.message}`);
      this.context.logger.error(`Failed to switch workspace: ${workspaceName}`, error);
      
      // Attempt recovery
      if (this.config.enableAutoRecovery) {
        return await this.attemptWorkspaceRecovery(workspaceName);
      }
      
      return false;
    }
  }

  /**
   * Get comprehensive window and workspace statistics
   */
  getIntegrationStats() {
    return {
      ...this.stats,
      recoveryAttempts: Array.from(this.recoveryAttempts.entries()),
      config: this.config
    };
  }

  // ===== PRIVATE IMPLEMENTATION =====

  private setupEventHandlers(): void {
    if (!this.windowManager) return;

    // Window lifecycle events
    this.windowManager.on('windowCreated', this.handleWindowCreated.bind(this));
    this.windowManager.on('windowClosed', this.handleWindowClosed.bind(this));
    this.windowManager.on('workspaceSwitched', this.handleWorkspaceSwitched.bind(this));

    // Error handling
    this.windowManager.on('error', this.handleWindowManagerError.bind(this));
  }

  private setupIPCIntegration(): void {
    if (!this.ipcService) return;

    // Setup IPC message logging
    this.ipcService.on('messageLogged', async (message: any) => {
      if (this.databaseService) {
        await this.databaseService.logIPCMessage(message);
      }
    });
  }

  private registerIntegrationHandlers(): void {
    // Register IPC handlers for integration functions
    const { ipcMain } = require('electron');

    ipcMain.handle('window-integration:create-window', async (event, type: WindowType, config?: any) => {
      return await this.createWindow(type, config);
    });

    ipcMain.handle('window-integration:close-window', async (event, windowId: string) => {
      return await this.closeWindow(windowId);
    });

    ipcMain.handle('window-integration:switch-workspace', async (event, workspaceName: string) => {
      return await this.switchWorkspace(workspaceName);
    });

    ipcMain.handle('window-integration:get-stats', () => {
      return this.getIntegrationStats();
    });
  }

  private startHealthMonitoring(): void {
    this.healthCheckTimer = setInterval(async () => {
      try {
        const health = await this.healthCheck();
        
        if (!health.healthy && this.config.enableAutoRecovery) {
          await this.attemptSystemRecovery();
        }
      } catch (error) {
        this.context.logger.error('Health check failed', error);
      }
    }, this.config.healthCheckInterval);
  }

  private async checkComponentHealth(): Promise<WindowServiceHealth> {
    const startTime = Date.now();
    const errors: string[] = [];
    
    let windowManager = false;
    let database = false;
    let ipc = false;
    let integration = true;

    try {
      // Check WindowManager
      if (this.windowManager) {
        const wmHealth = await this.windowManager.healthCheck();
        windowManager = wmHealth.healthy;
        if (!wmHealth.healthy) {
          errors.push(`WindowManager: ${wmHealth.error || 'Unhealthy'}`);
        }
      }

      // Check Database Service
      if (this.databaseService) {
        const dbHealth = await this.databaseService.healthCheck();
        database = dbHealth.healthy;
        if (!dbHealth.healthy) {
          errors.push(`Database: ${dbHealth.error || 'Unhealthy'}`);
        }
      }

      // Check IPC Service
      if (this.ipcService) {
        const ipcHealth = await this.ipcService.healthCheck();
        ipc = ipcHealth.healthy;
        if (!ipcHealth.healthy) {
          errors.push(`IPC: ${ipcHealth.error || 'Unhealthy'}`);
        }
      } else {
        ipc = true; // IPC is optional
      }

      return {
        windowManager,
        database,
        ipc,
        integration,
        lastCheck: new Date(),
        errors
      };
    } catch (error) {
      errors.push(`Health check error: ${error.message}`);
      return {
        windowManager: false,
        database: false,
        ipc: false,
        integration: false,
        lastCheck: new Date(),
        errors
      };
    }
  }

  private async attemptWindowRecovery(type: WindowType, config: any, operation: string): Promise<WindowInstance | null> {
    const recoveryKey = `${operation}-${type}`;
    const attempts = this.recoveryAttempts.get(recoveryKey) || 0;
    
    if (attempts >= this.config.maxRecoveryAttempts) {
      this.context.logger.error(`Max recovery attempts reached for ${recoveryKey}`);
      return null;
    }

    this.recoveryAttempts.set(recoveryKey, attempts + 1);
    this.stats.recoveryAttempts++;

    try {
      this.context.logger.info(`Attempting window recovery: ${recoveryKey} (attempt ${attempts + 1})`);
      
      // Wait a bit before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempts + 1)));
      
      // Retry the operation
      const result = await this.createWindow(type, config);
      
      if (result) {
        this.stats.recoverySuccesses++;
        this.recoveryAttempts.delete(recoveryKey); // Clear attempts on success
        this.context.logger.info(`Window recovery successful: ${recoveryKey}`);
      }
      
      return result;
    } catch (error) {
      this.context.logger.error(`Window recovery failed: ${recoveryKey}`, error);
      return null;
    }
  }

  private async attemptWorkspaceRecovery(workspaceName: string): Promise<boolean> {
    const recoveryKey = `workspace-${workspaceName}`;
    const attempts = this.recoveryAttempts.get(recoveryKey) || 0;
    
    if (attempts >= this.config.maxRecoveryAttempts) {
      return false;
    }

    this.recoveryAttempts.set(recoveryKey, attempts + 1);
    this.stats.recoveryAttempts++;

    try {
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 2000 * (attempts + 1)));
      
      // Try to recover workspace from database
      if (this.databaseService) {
        const workspace = await this.databaseService.loadWorkspace(workspaceName);
        if (workspace && this.windowManager) {
          const success = await this.windowManager.switchWorkspace(workspaceName);
          if (success) {
            this.stats.recoverySuccesses++;
            this.recoveryAttempts.delete(recoveryKey);
            return true;
          }
        }
      }
      
      return false;
    } catch (error) {
      this.context.logger.error(`Workspace recovery failed: ${recoveryKey}`, error);
      return false;
    }
  }

  private async attemptSystemRecovery(): Promise<void> {
    try {
      this.context.logger.warn('Attempting system-wide window management recovery');
      
      // Reset recovery attempts for critical failures
      this.recoveryAttempts.clear();
      
      // Try to reinitialize critical components
      if (this.windowManager) {
        const mainWindow = this.windowManager.getMainWindow();
        if (!mainWindow || mainWindow.isDestroyed()) {
          this.context.logger.error('Main window lost, attempting recreation');
          // This would need to be implemented in WindowManager
        }
      }
      
      this.context.logger.info('System recovery attempt completed');
    } catch (error) {
      this.context.logger.error('System recovery failed', error);
    }
  }

  // Event Handlers
  private async handleWindowCreated(windowInstance: WindowInstance): void {
    try {
      if (this.config.enableEventLogging && this.databaseService) {
        await this.logWindowEvent({
          windowId: windowInstance.id,
          windowType: windowInstance.type,
          event: 'created',
          timestamp: new Date()
        });
      }
      
      // Initialize window health tracking
      if (this.databaseService) {
        await this.databaseService.updateWindowHealth(windowInstance.id, {
          responsive: true,
          lastHealthCheck: new Date(),
          errors: [],
          warnings: []
        });
      }
    } catch (error) {
      this.context.logger.error(`Failed to handle window created event: ${windowInstance.id}`, error);
    }
  }

  private async handleWindowClosed(windowInstance: WindowInstance): void {
    try {
      if (this.config.enableEventLogging && this.databaseService) {
        await this.logWindowEvent({
          windowId: windowInstance.id,
          windowType: windowInstance.type,
          event: 'destroyed',
          timestamp: new Date()
        });
      }
    } catch (error) {
      this.context.logger.error(`Failed to handle window closed event: ${windowInstance.id}`, error);
    }
  }

  private async handleWorkspaceSwitched(workspace: WindowWorkspace): void {
    try {
      if (this.config.enableEventLogging) {
        await this.logWorkspaceEvent(workspace.name, 'switched');
      }
    } catch (error) {
      this.context.logger.error(`Failed to handle workspace switched event: ${workspace.name}`, error);
    }
  }

  private handleWindowManagerError(error: Error): void {
    this.stats.errors.push(`WindowManager error: ${error.message}`);
    this.context.logger.error('WindowManager error received', error);
    
    this.emit('componentError', 'WindowManager', error);
  }

  // Utility Methods
  private windowInstanceToState(instance: WindowInstance): any {
    return {
      id: instance.id,
      type: instance.type,
      bounds: instance.window.getBounds(),
      maximized: instance.window.isMaximized(),
      minimized: instance.window.isMinimized(),
      visible: instance.window.isVisible(),
      focused: instance.focused,
      workspace: instance.config.workspace,
      customData: instance.metadata,
      lastSaved: new Date()
    };
  }

  private async logWindowEvent(eventData: WindowEventData): Promise<void> {
    if (this.databaseService) {
      await this.databaseService.logWindowEvent(eventData);
    }
  }

  private async logWorkspaceEvent(workspaceName: string, event: string): Promise<void> {
    if (this.databaseService) {
      await this.databaseService.logWindowEvent({
        windowId: 'system',
        windowType: 'main',
        event: 'workspace_changed',
        timestamp: new Date(),
        data: { workspaceName, event }
      });
    }
  }
}