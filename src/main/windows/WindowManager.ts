/**
 * Window Management Architecture - Knowledge-First MVP Approach
 * 
 * Comprehensive window orchestration system that evolves progressively
 * from single window (MVP1) to multi-window enterprise platform (MVP5)
 */

import { BrowserWindow, ipcMain, screen } from 'electron';
import { EventEmitter } from 'events';
import { Service, ServiceContext, ServiceHealth, ServiceStatus } from '../services/ServiceManager';
import { WindowStateManager } from './WindowStateManager';
import { WindowRegistry } from './WindowRegistry';
import { IPCCoordinator } from './IPCCoordinator';
import { WindowFactory } from './WindowFactory';
import { WindowType, WindowConfig, WindowInstance, WindowWorkspace } from './types/WindowTypes';

/**
 * Central Window Manager - Progressive Enhancement Architecture
 * 
 * Evolution by MVP:
 * MVP1: Single main window with KB interface
 * MVP2: + Pattern dashboard, alert windows
 * MVP3: + Code viewer, debug context windows  
 * MVP4: + Project workspace, template editor
 * MVP5: + Analytics dashboard, AI assistant windows
 */
export class WindowManager extends EventEmitter implements Service {
  public readonly name = 'WindowManager';
  public readonly version = '2.0.0';
  public readonly dependencies = ['DatabaseService', 'ConfigService'];
  public readonly priority = 1; // High priority - Core UI service
  public readonly critical = true;

  private status: ServiceStatus = {
    status: 'stopped',
    restartCount: 0,
    uptime: 0
  };

  // Core components
  private stateManager: WindowStateManager;
  private registry: WindowRegistry;
  private ipcCoordinator: IPCCoordinator;
  private windowFactory: WindowFactory;
  
  // Window management
  private mainWindow: BrowserWindow | null = null;
  private currentWorkspace: WindowWorkspace | null = null;
  private mvpLevel: number = 1; // Current MVP level (1-5)
  
  // Configuration
  private readonly config = {
    maxWindows: 10,
    enableMultiWindow: false, // Enabled in MVP2+
    enableWorkspaces: false,  // Enabled in MVP4+
    persistState: true,
    autoSave: true
  };

  constructor(private context: ServiceContext) {
    super();
    
    this.stateManager = new WindowStateManager(context);
    this.registry = new WindowRegistry();
    this.ipcCoordinator = new IPCCoordinator();
    this.windowFactory = new WindowFactory(context);
    
    this.setupEventHandlers();
  }

  // Service Interface Implementation
  async initialize(context: ServiceContext): Promise<void> {
    const startTime = new Date();
    context.logger.info('Initializing Window Manager...');

    try {
      // Initialize core components
      await this.stateManager.initialize();
      await this.ipcCoordinator.initialize();
      
      // Detect MVP level from configuration
      this.mvpLevel = await this.detectMVPLevel();
      this.updateConfigForMVP();
      
      // Create main window
      await this.createMainWindow();
      
      // Restore previous session state if enabled
      if (this.config.persistState) {
        await this.restoreWindowState();
      }
      
      this.status = {
        status: 'running',
        startTime,
        restartCount: 0,
        uptime: 0
      };

      context.logger.info(`Window Manager initialized successfully (MVP${this.mvpLevel})`);
      context.metrics.increment('window_manager.initialized');
      
      this.emit('initialized', { mvpLevel: this.mvpLevel });
    } catch (error) {
      this.status = {
        status: 'error',
        lastError: error,
        restartCount: 0,
        uptime: 0
      };
      
      context.logger.error('Window Manager initialization failed', error);
      context.metrics.increment('window_manager.initialization_failed');
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    this.context.logger.info('Shutting down Window Manager...');
    
    try {
      // Save current window state
      if (this.config.persistState) {
        await this.saveWindowState();
      }
      
      // Close all windows gracefully
      await this.closeAllWindows();
      
      // Cleanup components
      await this.stateManager.shutdown();
      await this.ipcCoordinator.shutdown();
      
      this.status = { ...this.status, status: 'stopped' };
      this.context.logger.info('Window Manager shut down successfully');
    } catch (error) {
      this.context.logger.error('Error during Window Manager shutdown', error);
      throw error;
    }
  }

  getStatus(): ServiceStatus {
    if (this.status.startTime && this.status.status === 'running') {
      this.status.uptime = Date.now() - this.status.startTime.getTime();
    }
    return { ...this.status };
  }

  async healthCheck(): Promise<ServiceHealth> {
    const startTime = Date.now();
    
    try {
      // Check main window health
      const mainWindowHealthy = this.mainWindow && !this.mainWindow.isDestroyed();
      
      // Check all registered windows
      const allWindows = this.registry.getAllWindows();
      const healthyWindows = allWindows.filter(w => !w.window.isDestroyed()).length;
      
      // Check state persistence
      const stateManagerHealthy = await this.stateManager.healthCheck();
      
      // Check IPC communication
      const ipcHealthy = await this.ipcCoordinator.healthCheck();
      
      const healthy = mainWindowHealthy && stateManagerHealthy && ipcHealthy;
      
      return {
        healthy,
        details: {
          mainWindow: mainWindowHealthy,
          totalWindows: allWindows.length,
          healthyWindows,
          mvpLevel: this.mvpLevel,
          workspace: this.currentWorkspace?.name || null,
          stateManager: stateManagerHealthy,
          ipc: ipcHealthy
        },
        lastCheck: new Date(),
        responseTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        lastCheck: new Date(),
        responseTime: Date.now() - startTime
      };
    }
  }

  // Public Window Management Interface
  
  /**
   * Create a new window of specified type
   * Available windows depend on current MVP level
   */
  async createWindow(type: WindowType, config?: Partial<WindowConfig>): Promise<WindowInstance | null> {
    if (!this.isWindowTypeAvailable(type)) {
      this.context.logger.warn(`Window type ${type} not available in MVP${this.mvpLevel}`);
      return null;
    }

    if (this.registry.getWindowCount() >= this.config.maxWindows) {
      this.context.logger.warn('Maximum window limit reached');
      return null;
    }

    try {
      const windowInstance = await this.windowFactory.createWindow(type, config);
      this.registry.register(windowInstance);
      
      this.context.logger.info(`Created window: ${type}`);
      this.context.metrics.increment(`window.created.${type}`);
      
      this.emit('windowCreated', windowInstance);
      return windowInstance;
    } catch (error) {
      this.context.logger.error(`Failed to create window: ${type}`, error);
      this.context.metrics.increment(`window.creation_failed.${type}`);
      return null;
    }
  }

  /**
   * Get main application window
   */
  getMainWindow(): BrowserWindow | null {
    return this.mainWindow;
  }

  /**
   * Get window by ID or type
   */
  getWindow(idOrType: string | WindowType): WindowInstance | null {
    return this.registry.getWindow(idOrType);
  }

  /**
   * Close window by ID or type
   */
  async closeWindow(idOrType: string | WindowType): Promise<boolean> {
    const windowInstance = this.registry.getWindow(idOrType);
    if (!windowInstance) return false;

    try {
      // Save window state before closing
      await this.stateManager.saveWindowState(windowInstance);
      
      // Close the window
      if (!windowInstance.window.isDestroyed()) {
        windowInstance.window.close();
      }
      
      // Unregister
      this.registry.unregister(windowInstance.id);
      
      this.context.logger.info(`Closed window: ${windowInstance.type}`);
      this.emit('windowClosed', windowInstance);
      
      return true;
    } catch (error) {
      this.context.logger.error(`Failed to close window: ${idOrType}`, error);
      return false;
    }
  }

  /**
   * Focus window by ID or type
   */
  focusWindow(idOrType: string | WindowType): boolean {
    const windowInstance = this.registry.getWindow(idOrType);
    if (!windowInstance || windowInstance.window.isDestroyed()) {
      return false;
    }

    windowInstance.window.show();
    windowInstance.window.focus();
    return true;
  }

  /**
   * Broadcast message to all windows of specified type(s)
   */
  broadcast(channel: string, data: any, targetTypes?: WindowType[]): void {
    this.ipcCoordinator.broadcast(channel, data, targetTypes);
  }

  /**
   * Send message to specific window
   */
  sendToWindow(windowId: string, channel: string, data: any): boolean {
    const windowInstance = this.registry.getWindow(windowId);
    if (!windowInstance || windowInstance.window.isDestroyed()) {
      return false;
    }

    windowInstance.window.webContents.send(channel, data);
    return true;
  }

  // Workspace Management (MVP4+)
  
  async createWorkspace(name: string, config: Partial<WindowWorkspace>): Promise<boolean> {
    if (this.mvpLevel < 4) {
      this.context.logger.warn('Workspace management not available in current MVP level');
      return false;
    }

    try {
      const workspace = await this.stateManager.createWorkspace(name, config);
      this.currentWorkspace = workspace;
      
      this.emit('workspaceCreated', workspace);
      return true;
    } catch (error) {
      this.context.logger.error(`Failed to create workspace: ${name}`, error);
      return false;
    }
  }

  async switchWorkspace(name: string): Promise<boolean> {
    if (this.mvpLevel < 4) return false;

    try {
      // Save current workspace state
      if (this.currentWorkspace) {
        await this.stateManager.saveWorkspace(this.currentWorkspace);
      }

      // Load new workspace
      const workspace = await this.stateManager.loadWorkspace(name);
      if (!workspace) return false;

      this.currentWorkspace = workspace;
      await this.applyWorkspaceLayout(workspace);
      
      this.emit('workspaceSwitched', workspace);
      return true;
    } catch (error) {
      this.context.logger.error(`Failed to switch workspace: ${name}`, error);
      return false;
    }
  }

  // Private Implementation
  
  private async createMainWindow(): Promise<void> {
    const savedState = await this.stateManager.getMainWindowState();
    
    const config: WindowConfig = {
      type: 'main',
      title: 'Mainframe Knowledge Assistant',
      width: savedState?.width || 1400,
      height: savedState?.height || 900,
      x: savedState?.x,
      y: savedState?.y,
      minWidth: 1200,
      minHeight: 800,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: this.windowFactory.getPreloadPath('main')
      }
    };

    this.mainWindow = await this.windowFactory.createBrowserWindow(config);
    
    // Load the main application
    if (this.context.isDevelopment) {
      const port = process.env.RENDERER_DEV_PORT || 3000;
      await this.mainWindow.loadURL(`http://localhost:${port}`);
      this.mainWindow.webContents.openDevTools();
    } else {
      await this.mainWindow.loadFile(this.windowFactory.getRendererPath('main'));
    }

    // Register main window
    const mainWindowInstance: WindowInstance = {
      id: 'main',
      type: 'main',
      window: this.mainWindow,
      config,
      created: new Date(),
      focused: false
    };

    this.registry.register(mainWindowInstance);

    // Setup main window event handlers
    this.mainWindow.once('ready-to-show', () => {
      if (this.mainWindow) {
        this.mainWindow.show();
        if (this.context.isDevelopment) {
          this.mainWindow.focus();
        }
      }
    });

    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
      this.registry.unregister('main');
    });
  }

  private setupEventHandlers(): void {
    // Handle app activation (macOS)
    ipcMain.handle('window-manager:get-main-window', () => {
      return this.mainWindow?.id || null;
    });

    // Handle window state requests
    ipcMain.handle('window-manager:create-window', async (event, type: WindowType, config?: Partial<WindowConfig>) => {
      const windowInstance = await this.createWindow(type, config);
      return windowInstance?.id || null;
    });

    ipcMain.handle('window-manager:close-window', async (event, idOrType: string) => {
      return await this.closeWindow(idOrType);
    });

    ipcMain.handle('window-manager:focus-window', (event, idOrType: string) => {
      return this.focusWindow(idOrType);
    });

    // Handle workspace operations (MVP4+)
    ipcMain.handle('window-manager:create-workspace', async (event, name: string, config: any) => {
      return await this.createWorkspace(name, config);
    });

    ipcMain.handle('window-manager:switch-workspace', async (event, name: string) => {
      return await this.switchWorkspace(name);
    });
  }

  private async detectMVPLevel(): Promise<number> {
    // Detect MVP level based on available features/services
    const config = await this.context.config?.get('mvp.level') || 1;
    return Math.min(Math.max(config, 1), 5);
  }

  private updateConfigForMVP(): void {
    switch (this.mvpLevel) {
      case 1:
        this.config.enableMultiWindow = false;
        this.config.enableWorkspaces = false;
        this.config.maxWindows = 1;
        break;
      case 2:
        this.config.enableMultiWindow = true;
        this.config.maxWindows = 3; // Main + Pattern Dashboard + Alerts
        break;
      case 3:
        this.config.maxWindows = 5; // + Code Viewer + Debug
        break;
      case 4:
        this.config.enableWorkspaces = true;
        this.config.maxWindows = 8; // + Project + Templates
        break;
      case 5:
        this.config.maxWindows = 10; // + Analytics + AI Assistant
        break;
    }
  }

  private isWindowTypeAvailable(type: WindowType): boolean {
    const availableByMVP: Record<number, WindowType[]> = {
      1: ['main'],
      2: ['main', 'pattern-dashboard', 'alert'],
      3: ['main', 'pattern-dashboard', 'alert', 'code-viewer', 'debug-context'],
      4: ['main', 'pattern-dashboard', 'alert', 'code-viewer', 'debug-context', 'project-workspace', 'template-editor'],
      5: ['main', 'pattern-dashboard', 'alert', 'code-viewer', 'debug-context', 'project-workspace', 'template-editor', 'analytics-dashboard', 'ai-assistant']
    };

    const available = availableByMVP[this.mvpLevel] || [];
    return available.includes(type);
  }

  private async restoreWindowState(): Promise<void> {
    // Implementation depends on WindowStateManager
    await this.stateManager.restoreSession();
  }

  private async saveWindowState(): Promise<void> {
    const allWindows = this.registry.getAllWindows();
    for (const windowInstance of allWindows) {
      await this.stateManager.saveWindowState(windowInstance);
    }
  }

  private async closeAllWindows(): Promise<void> {
    const allWindows = this.registry.getAllWindows();
    
    for (const windowInstance of allWindows) {
      if (!windowInstance.window.isDestroyed()) {
        windowInstance.window.close();
      }
    }
    
    this.registry.clear();
  }

  private async applyWorkspaceLayout(workspace: WindowWorkspace): Promise<void> {
    // Close current windows (except main)
    const currentWindows = this.registry.getAllWindows().filter(w => w.type !== 'main');
    for (const windowInstance of currentWindows) {
      await this.closeWindow(windowInstance.id);
    }

    // Create workspace windows
    for (const windowConfig of workspace.windows) {
      await this.createWindow(windowConfig.type, windowConfig);
    }
  }
}