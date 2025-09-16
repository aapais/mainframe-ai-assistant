/**
 * Window Service Implementation
 * Manages the main application window lifecycle
 */

import { BrowserWindow, shell } from 'electron';
import { join } from 'path';
import { Service, ServiceContext, ServiceHealth, ServiceStatus } from './ServiceManager';

export class WindowService implements Service {
  public readonly name = 'WindowService';
  public readonly version = '1.0.0';
  public readonly dependencies: string[] = [];
  public readonly priority = 2; // Medium priority - UI service
  public readonly critical = true;

  private mainWindow: BrowserWindow | null = null;
  private status: ServiceStatus = {
    status: 'stopped',
    restartCount: 0,
    uptime: 0
  };
  private startTime?: Date;

  async initialize(context: ServiceContext): Promise<void> {
    context.logger.info('Initializing Window Service...');
    this.startTime = new Date();
    
    try {
      await this.createMainWindow(context);

      this.status = {
        status: 'running',
        startTime: this.startTime,
        restartCount: 0,
        uptime: 0
      };

      context.logger.info('Window Service initialized successfully');
      context.metrics.increment('service.window.initialized');
    } catch (error) {
      this.status = {
        status: 'error',
        lastError: error,
        restartCount: 0,
        uptime: 0
      };
      
      context.logger.error('Window Service initialization failed', error);
      context.metrics.increment('service.window.initialization_failed');
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.close();
      this.mainWindow = null;
    }

    this.status = {
      ...this.status,
      status: 'stopped'
    };
  }

  getStatus(): ServiceStatus {
    if (this.startTime && this.status.status === 'running') {
      this.status.uptime = Date.now() - this.startTime.getTime();
    }
    return { ...this.status };
  }

  async healthCheck(): Promise<ServiceHealth> {
    const startTime = Date.now();
    
    try {
      if (!this.mainWindow || this.mainWindow.isDestroyed()) {
        return {
          healthy: false,
          error: 'Main window not available or destroyed',
          lastCheck: new Date(),
          responseTime: Date.now() - startTime
        };
      }

      // Check if window is responsive
      const isVisible = this.mainWindow.isVisible();
      const isMinimized = this.mainWindow.isMinimized();
      const bounds = this.mainWindow.getBounds();
      
      return {
        healthy: true,
        details: {
          visible: isVisible,
          minimized: isMinimized,
          bounds,
          title: this.mainWindow.getTitle(),
          webContentsId: this.mainWindow.webContents.id
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

  // Public interface
  getMainWindow(): BrowserWindow | null {
    return this.mainWindow;
  }

  show(): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.show();
      this.mainWindow.focus();
    }
  }

  hide(): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.hide();
    }
  }

  minimize(): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.minimize();
    }
  }

  private async createMainWindow(context: ServiceContext): Promise<void> {
    // Create the browser window
    this.mainWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 1200,
      minHeight: 800,
      titleBarStyle: 'default',
      show: false, // Don't show until ready
      icon: this.getAppIcon(),
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false,
        preload: join(__dirname, '../preload.js'),
        webSecurity: true,
        allowRunningInsecureContent: false,
        experimentalFeatures: false
      }
    });

    // Load the app
    if (context.isDevelopment) {
      const rendererPort = process.env.RENDERER_DEV_PORT || 3000;
      await this.mainWindow.loadURL(`http://localhost:${rendererPort}`);
      
      // Open DevTools in development
      this.mainWindow.webContents.openDevTools();
    } else {
      await this.mainWindow.loadFile(join(__dirname, '../../renderer/index.html'));
    }

    // Show window when ready to prevent visual flash
    this.mainWindow.once('ready-to-show', () => {
      if (this.mainWindow) {
        this.mainWindow.show();
        
        // Focus on launch
        if (context.isDevelopment) {
          this.mainWindow.focus();
        }
      }
    });

    // Handle window closed
    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
      this.status.status = 'stopped';
    });

    // Handle external links
    this.mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: 'deny' };
    });

    // Prevent navigation to external URLs
    this.mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
      if (!navigationUrl.startsWith('http://localhost') && !navigationUrl.startsWith('file://')) {
        event.preventDefault();
      }
    });

    // Security: Prevent new window creation
    this.mainWindow.webContents.on('new-window', (event, navigationUrl) => {
      event.preventDefault();
      shell.openExternal(navigationUrl);
    });

    context.logger.info('Main window created successfully');
  }

  private getAppIcon(): string {
    const isWindows = process.platform === 'win32';
    
    if (isWindows) {
      return join(__dirname, '../../assets/icons/icon.ico');
    } else if (process.platform === 'darwin') {
      return join(__dirname, '../../assets/icons/icon.icns');
    } else {
      return join(__dirname, '../../assets/icons/icon.png');
    }
  }
}