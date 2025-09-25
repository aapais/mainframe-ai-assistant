/**
 * Window Factory - Progressive Window Creation System
 *
 * Creates and configures windows based on type and MVP level
 * with proper security, theming, and progressive enhancement
 */

import { BrowserWindow, nativeTheme } from 'electron';
import { join } from 'path';
import { ServiceContext } from '../services/ServiceManager';
import {
  WindowType,
  WindowConfig,
  WindowInstance,
  WindowFactoryConfig,
  DEFAULT_WINDOW_CONFIGS,
  MVP_WINDOW_CAPABILITIES,
} from './types/WindowTypes';
import { v4 as uuidv4 } from 'uuid';

/**
 * Window Factory manages:
 * - Type-specific window creation
 * - Security configuration per window type
 * - Theme application
 * - Preload script assignment
 * - Progressive feature enablement
 */
export class WindowFactory {
  private factoryConfig: WindowFactoryConfig;
  private mvpLevel: number;

  constructor(private context: ServiceContext) {
    this.mvpLevel = this.detectMVPLevel();
    this.factoryConfig = this.createFactoryConfig();
  }

  // Window Creation

  async createWindow(
    type: WindowType,
    userConfig?: Partial<WindowConfig>
  ): Promise<WindowInstance> {
    // Validate window type is available for current MVP level
    if (!this.isWindowTypeAvailable(type)) {
      throw new Error(`Window type '${type}' not available in MVP ${this.mvpLevel}`);
    }

    // Get base configuration for window type
    const baseConfig = DEFAULT_WINDOW_CONFIGS[type];
    if (!baseConfig) {
      throw new Error(`No configuration found for window type: ${type}`);
    }

    // Merge configurations
    const finalConfig = this.mergeConfigurations(baseConfig, userConfig);

    // Create the browser window
    const browserWindow = await this.createBrowserWindow(finalConfig);

    // Create window instance
    const windowInstance: WindowInstance = {
      id: userConfig?.workspace ? `${type}-${userConfig.workspace}` : uuidv4(),
      type,
      window: browserWindow,
      config: finalConfig,
      created: new Date(),
      focused: false,
      metadata: {},
    };

    // Load content
    await this.loadWindowContent(windowInstance);

    // Apply theme
    this.applyTheme(windowInstance);

    // Setup type-specific features
    await this.setupTypeSpecificFeatures(windowInstance);

    this.context.logger.info(`Created ${type} window: ${windowInstance.id}`);

    return windowInstance;
  }

  async createBrowserWindow(config: WindowConfig): Promise<BrowserWindow> {
    // Base security configuration
    const secureWebPreferences = {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      ...config.webPreferences,
    };

    // Add preload script if available
    const preloadPath = this.getPreloadPath(config.type);
    if (preloadPath) {
      secureWebPreferences.preload = preloadPath;
    }

    // Create window with security hardening
    const browserWindow = new BrowserWindow({
      width: config.width,
      height: config.height,
      x: config.x,
      y: config.y,
      minWidth: config.minWidth,
      minHeight: config.minHeight,
      maxWidth: config.maxWidth,
      maxHeight: config.maxHeight,
      resizable: config.resizable !== false,
      minimizable: config.minimizable !== false,
      maximizable: config.maximizable !== false,
      closable: config.closable !== false,
      show: config.show || false,
      modal: config.modal || false,
      parent: config.parent ? this.findParentWindow(config.parent) : undefined,
      alwaysOnTop: config.alwaysOnTop || false,
      skipTaskbar: config.skipTaskbar || false,
      title: config.title,
      icon: this.getWindowIcon(),
      titleBarStyle: this.getTitleBarStyle(),
      webPreferences: secureWebPreferences,

      // Additional security
      frame: true, // Always use frame for security
      transparent: false, // Avoid transparency for security

      // macOS specific
      vibrancy: process.platform === 'darwin' ? 'under-window' : undefined,

      // Windows specific
      thickFrame: process.platform === 'win32',
    });

    // Security event handlers
    this.setupSecurityHandlers(browserWindow);

    return browserWindow;
  }

  // Content Loading

  private async loadWindowContent(windowInstance: WindowInstance): Promise<void> {
    const { window, type } = windowInstance;

    if (this.context.isDevelopment) {
      // Development mode - use dev server
      const port = this.getDevServerPort(type);
      const url = `http://localhost:${port}`;

      try {
        await window.loadURL(url);

        // Open DevTools for specific window types in development
        if (this.shouldOpenDevTools(type)) {
          window.webContents.openDevTools();
        }
      } catch (error) {
        this.context.logger.error(`Failed to load dev URL for ${type}:`, error);
        throw error;
      }
    } else {
      // Production mode - use bundled files
      const rendererPath = this.getRendererPath(type);

      try {
        await window.loadFile(rendererPath);
      } catch (error) {
        this.context.logger.error(`Failed to load renderer file for ${type}:`, error);
        throw error;
      }
    }
  }

  // Configuration Management

  private mergeConfigurations(base: WindowConfig, user?: Partial<WindowConfig>): WindowConfig {
    const merged = { ...base };

    if (user) {
      // Deep merge, being careful with nested objects
      Object.keys(user).forEach(key => {
        if (key === 'webPreferences' && user.webPreferences) {
          merged.webPreferences = {
            ...merged.webPreferences,
            ...user.webPreferences,
          };
        } else {
          (merged as any)[key] = (user as any)[key];
        }
      });
    }

    // Apply MVP-level restrictions
    this.applyMVPRestrictions(merged);

    return merged;
  }

  private applyMVPRestrictions(config: WindowConfig): void {
    const capabilities = MVP_WINDOW_CAPABILITIES[this.mvpLevel];

    if (!capabilities) {
      return;
    }

    // Restrict features based on MVP level
    if (this.mvpLevel < 4 && config.workspace) {
      delete config.workspace; // Workspaces only in MVP4+
    }

    if (this.mvpLevel < 2 && config.type !== 'main') {
      // Force single window mode in MVP1
      this.context.logger.warn(
        `Multi-window not available in MVP${this.mvpLevel}, creating main window instead`
      );
    }
  }

  // Type-Specific Features

  private async setupTypeSpecificFeatures(windowInstance: WindowInstance): Promise<void> {
    const { type, window } = windowInstance;

    switch (type) {
      case 'main':
        await this.setupMainWindowFeatures(windowInstance);
        break;

      case 'pattern-dashboard':
        await this.setupPatternDashboardFeatures(windowInstance);
        break;

      case 'code-viewer':
        await this.setupCodeViewerFeatures(windowInstance);
        break;

      case 'alert':
        await this.setupAlertWindowFeatures(windowInstance);
        break;

      case 'ai-assistant':
        await this.setupAIAssistantFeatures(windowInstance);
        break;

      default:
        // Apply default features
        await this.setupDefaultFeatures(windowInstance);
    }
  }

  private async setupMainWindowFeatures(windowInstance: WindowInstance): Promise<void> {
    const { window } = windowInstance;

    // Main window specific setup
    window.on('close', event => {
      if (this.shouldMinimizeToTray()) {
        event.preventDefault();
        window.hide();
      }
    });

    // Handle external links
    window.webContents.setWindowOpenHandler(({ url }) => {
      require('electron').shell.openExternal(url);
      return { action: 'deny' };
    });

    // Menu setup
    if (process.platform === 'darwin') {
      // macOS specific menu handling
      window.on('focus', () => {
        // Set application menu when main window is focused
      });
    }
  }

  private async setupPatternDashboardFeatures(windowInstance: WindowInstance): Promise<void> {
    const { window } = windowInstance;

    // Pattern dashboard specific features
    window.setMenu(null); // Remove menu for dashboard windows

    // Auto-refresh capability
    window.webContents.on('did-finish-load', () => {
      // Setup auto-refresh for pattern data
      window.webContents.send('setup-auto-refresh', { interval: 30000 });
    });
  }

  private async setupCodeViewerFeatures(windowInstance: WindowInstance): Promise<void> {
    const { window } = windowInstance;

    // Code viewer specific features
    window.setMenu(null);

    // Setup zoom controls for code readability
    window.webContents.on('did-finish-load', () => {
      window.webContents.send('setup-zoom-controls');
    });

    // Handle large file loading
    window.webContents.on('did-start-loading', () => {
      // Show loading indicator for large COBOL files
    });
  }

  private async setupAlertWindowFeatures(windowInstance: WindowInstance): Promise<void> {
    const { window } = windowInstance;

    // Alert window specific features
    window.setAlwaysOnTop(true);
    window.setSkipTaskbar(true);

    // Auto-close after timeout if configured
    if (windowInstance.metadata?.autoCloseTimeout) {
      setTimeout(() => {
        if (!window.isDestroyed()) {
          window.close();
        }
      }, windowInstance.metadata.autoCloseTimeout);
    }

    // Flash window on Windows for attention
    if (process.platform === 'win32') {
      window.flashFrame(true);
    }
  }

  private async setupAIAssistantFeatures(windowInstance: WindowInstance): Promise<void> {
    const { window } = windowInstance;

    // AI Assistant specific features
    window.setMenu(null);

    // Always on top but not modal
    window.setAlwaysOnTop(false);

    // Setup AI communication channels
    window.webContents.on('did-finish-load', () => {
      window.webContents.send('setup-ai-communication');
    });
  }

  private async setupDefaultFeatures(windowInstance: WindowInstance): Promise<void> {
    const { window } = windowInstance;

    // Default features for all windows
    window.setMenu(null); // Most windows don't need menus

    // Standard security handlers
    this.setupSecurityHandlers(window);
  }

  // Security and Theming

  private setupSecurityHandlers(window: BrowserWindow): void {
    // Prevent navigation to external URLs
    window.webContents.on('will-navigate', (event, navigationUrl) => {
      const url = new URL(navigationUrl);

      if (this.context.isDevelopment) {
        // In development, allow localhost
        if (!url.hostname.includes('localhost') && !url.protocol.includes('file:')) {
          event.preventDefault();
          this.context.logger.warn(`Blocked navigation to: ${navigationUrl}`);
        }
      } else {
        // In production, only allow file:// protocol
        if (!url.protocol.includes('file:')) {
          event.preventDefault();
          this.context.logger.warn(`Blocked navigation to: ${navigationUrl}`);
        }
      }
    });

    // Prevent new window creation
    window.webContents.on('new-window', (event, navigationUrl) => {
      event.preventDefault();
      require('electron').shell.openExternal(navigationUrl);
    });

    // Handle permission requests securely
    window.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
      // Deny all permission requests by default
      callback(false);
      this.context.logger.warn(`Permission request denied: ${permission}`);
    });
  }

  private applyTheme(windowInstance: WindowInstance): void {
    const { window, config } = windowInstance;

    const theme = config.theme || 'auto';

    // Apply theme based on configuration
    switch (theme) {
      case 'dark':
        nativeTheme.themeSource = 'dark';
        break;
      case 'light':
        nativeTheme.themeSource = 'light';
        break;
      default:
        nativeTheme.themeSource = 'system';
    }

    // Send theme information to renderer
    window.webContents.on('did-finish-load', () => {
      window.webContents.send('theme-changed', {
        theme: nativeTheme.shouldUseDarkColors ? 'dark' : 'light',
        systemTheme: nativeTheme.themeSource,
      });
    });
  }

  // Helper Methods

  getPreloadPath(type: WindowType): string {
    return this.factoryConfig.preloadPaths[type] || join(__dirname, `../preload-${type}.js`);
  }

  getRendererPath(type: WindowType): string {
    return (
      this.factoryConfig.rendererPaths[type] || join(__dirname, `../../renderer/${type}/index.html`)
    );
  }

  private createFactoryConfig(): WindowFactoryConfig {
    return {
      mvpLevel: this.mvpLevel,
      defaultTheme: 'auto',
      preloadPaths: {
        main: join(__dirname, '../preload.js'),
        'pattern-dashboard': join(__dirname, '../preload-pattern.js'),
        'code-viewer': join(__dirname, '../preload-code.js'),
        alert: join(__dirname, '../preload-alert.js'),
        'ai-assistant': join(__dirname, '../preload-ai.js'),
        'analytics-dashboard': join(__dirname, '../preload-analytics.js'),
        'debug-context': join(__dirname, '../preload-debug.js'),
        'template-editor': join(__dirname, '../preload-template.js'),
        'project-workspace': join(__dirname, '../preload-workspace.js'),
        'pattern-viewer': join(__dirname, '../preload-pattern.js'),
        'code-search': join(__dirname, '../preload-code.js'),
        'export-manager': join(__dirname, '../preload-export.js'),
        'import-wizard': join(__dirname, '../preload-import.js'),
        'auto-resolution-monitor': join(__dirname, '../preload-monitor.js'),
        'predictive-dashboard': join(__dirname, '../preload-predictive.js'),
      },
      rendererPaths: {
        main: join(__dirname, '../../renderer/main/index.html'),
        'pattern-dashboard': join(__dirname, '../../renderer/pattern-dashboard/index.html'),
        'code-viewer': join(__dirname, '../../renderer/code-viewer/index.html'),
        alert: join(__dirname, '../../renderer/alert/index.html'),
        'ai-assistant': join(__dirname, '../../renderer/ai-assistant/index.html'),
        'analytics-dashboard': join(__dirname, '../../renderer/analytics/index.html'),
        'debug-context': join(__dirname, '../../renderer/debug/index.html'),
        'template-editor': join(__dirname, '../../renderer/template-editor/index.html'),
        'project-workspace': join(__dirname, '../../renderer/workspace/index.html'),
        'pattern-viewer': join(__dirname, '../../renderer/pattern-viewer/index.html'),
        'code-search': join(__dirname, '../../renderer/code-search/index.html'),
        'export-manager': join(__dirname, '../../renderer/export/index.html'),
        'import-wizard': join(__dirname, '../../renderer/import/index.html'),
        'auto-resolution-monitor': join(__dirname, '../../renderer/monitor/index.html'),
        'predictive-dashboard': join(__dirname, '../../renderer/predictive/index.html'),
      },
      iconPaths: {
        win32: join(__dirname, '../../assets/icons/icon.ico'),
        darwin: join(__dirname, '../../assets/icons/icon.icns'),
        linux: join(__dirname, '../../assets/icons/icon.png'),
      },
      defaultConfigs: DEFAULT_WINDOW_CONFIGS,
    };
  }

  private detectMVPLevel(): number {
    // Detect from environment or configuration
    const envLevel = process.env.MVP_LEVEL;
    if (envLevel) {
      return Math.min(Math.max(parseInt(envLevel), 1), 5);
    }

    // Default to MVP1
    return 1;
  }

  private isWindowTypeAvailable(type: WindowType): boolean {
    const capabilities = MVP_WINDOW_CAPABILITIES[this.mvpLevel];
    return capabilities?.availableTypes.includes(type) || false;
  }

  private getDevServerPort(type: WindowType): number {
    const ports: Record<string, number> = {
      main: 3000,
      'pattern-dashboard': 3001,
      'code-viewer': 3002,
      alert: 3003,
      'ai-assistant': 3004,
    };

    return ports[type] || 3000;
  }

  private shouldOpenDevTools(type: WindowType): boolean {
    // Only open dev tools for main window in development
    return type === 'main';
  }

  private getWindowIcon(): string {
    const platform = process.platform;
    return this.factoryConfig.iconPaths[platform] || this.factoryConfig.iconPaths['linux'];
  }

  private getTitleBarStyle(): 'default' | 'hidden' | 'hiddenInset' | 'customButtonsOnHover' {
    if (process.platform === 'darwin') {
      return 'default';
    }
    return 'default';
  }

  private findParentWindow(parentId: string): BrowserWindow | undefined {
    // This would need to be implemented with access to window registry
    // For now, return undefined
    return undefined;
  }

  private shouldMinimizeToTray(): boolean {
    // Check if system tray is available and configured
    return process.platform !== 'darwin'; // Don't minimize to tray on macOS
  }
}
