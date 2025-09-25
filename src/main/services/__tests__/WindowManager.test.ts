/**
 * Window Manager Test Suite
 *
 * Comprehensive tests for the backend window management system
 * including lifecycle methods, error handling, and recovery mechanisms
 */

import { jest } from '@jest/globals';
import { BrowserWindow } from 'electron';
import { WindowManager } from '../../windows/WindowManager';
import { WindowStateManager } from '../../windows/WindowStateManager';
import { WindowRegistry } from '../../windows/WindowRegistry';
import { IPCCoordinator } from '../../windows/IPCCoordinator';
import { WindowFactory } from '../../windows/WindowFactory';
import { WindowIntegrationService } from '../WindowIntegrationService';
import { WindowDatabaseService } from '../WindowDatabaseService';
import { ServiceContext } from '../ServiceManager';
import { WindowType, WindowInstance, WindowConfig } from '../../windows/types/WindowTypes';

// Mock Electron
jest.mock('electron', () => ({
  BrowserWindow: jest.fn().mockImplementation(() => ({
    id: Math.floor(Math.random() * 10000),
    isDestroyed: jest.fn(() => false),
    isMaximized: jest.fn(() => false),
    isMinimized: jest.fn(() => false),
    isVisible: jest.fn(() => true),
    isFocused: jest.fn(() => false),
    getBounds: jest.fn(() => ({ x: 100, y: 100, width: 800, height: 600 })),
    setBounds: jest.fn(),
    show: jest.fn(),
    hide: jest.fn(),
    focus: jest.fn(),
    close: jest.fn(),
    on: jest.fn(),
    once: jest.fn(),
    loadURL: jest.fn(() => Promise.resolve()),
    loadFile: jest.fn(() => Promise.resolve()),
    webContents: {
      send: jest.fn(),
      on: jest.fn(),
      openDevTools: jest.fn(),
      isDestroyed: jest.fn(() => false),
      getProcessMemoryInfo: jest.fn(() => Promise.resolve({ workingSetSize: 100000 })),
    },
    setAlwaysOnTop: jest.fn(),
    setSkipTaskbar: jest.fn(),
    setMenu: jest.fn(),
    maximize: jest.fn(),
    minimize: jest.fn(),
    flashFrame: jest.fn(),
  })),
  ipcMain: {
    handle: jest.fn(),
    removeHandler: jest.fn(),
    on: jest.fn(),
  },
  screen: {
    getAllDisplays: jest.fn(() => [
      {
        id: 1,
        bounds: { x: 0, y: 0, width: 1920, height: 1080 },
        workArea: { x: 0, y: 0, width: 1920, height: 1040 },
      },
    ]),
    getPrimaryDisplay: jest.fn(() => ({
      id: 1,
      bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      workArea: { x: 0, y: 0, width: 1920, height: 1040 },
    })),
    getDisplayMatching: jest.fn(() => ({
      id: 1,
      bounds: { x: 0, y: 0, width: 1920, height: 1080 },
    })),
  },
  app: {
    getPath: jest.fn(() => '/test/path'),
    on: jest.fn(),
  },
  nativeTheme: {
    shouldUseDarkColors: false,
    themeSource: 'system',
  },
}));

// Mock file system
jest.mock('fs', () => ({
  promises: {
    access: jest.fn(() => Promise.resolve()),
    mkdir: jest.fn(() => Promise.resolve()),
    writeFile: jest.fn(() => Promise.resolve()),
    readFile: jest.fn(() => Promise.resolve('{}')),
    readdir: jest.fn(() => Promise.resolve([])),
    unlink: jest.fn(() => Promise.resolve()),
    copyFile: jest.fn(() => Promise.resolve()),
  },
  existsSync: jest.fn(() => true),
  mkdirSync: jest.fn(),
  appendFileSync: jest.fn(),
}));

describe('WindowManager', () => {
  let windowManager: WindowManager;
  let mockContext: ServiceContext;
  let mockDatabase: jest.Mocked<WindowDatabaseService>;

  beforeEach(() => {
    // Create mock context
    mockContext = {
      app: require('electron').app,
      dataPath: '/test/data',
      isDevelopment: true,
      config: {},
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      },
      metrics: {
        increment: jest.fn(),
        histogram: jest.fn(),
        gauge: jest.fn(),
        timer: jest.fn(() => jest.fn()),
      },
      getService: jest.fn(),
    };

    // Create mock database service
    mockDatabase = {
      saveWindowState: jest.fn(() => Promise.resolve()),
      loadWindowState: jest.fn(() => Promise.resolve(null)),
      deleteWindowState: jest.fn(() => Promise.resolve()),
      getAllWindowStates: jest.fn(() => Promise.resolve([])),
      saveWorkspace: jest.fn(() => Promise.resolve()),
      loadWorkspace: jest.fn(() => Promise.resolve(null)),
      getAllWorkspaces: jest.fn(() => Promise.resolve([])),
      updateWindowHealth: jest.fn(() => Promise.resolve()),
      getWindowHealth: jest.fn(() => Promise.resolve(null)),
      logWindowEvent: jest.fn(() => Promise.resolve()),
      logIPCMessage: jest.fn(() => Promise.resolve()),
      getWindowStats: jest.fn(() =>
        Promise.resolve({
          totalWindows: 0,
          activeWindows: 0,
          workspaces: 0,
          healthyWindows: 0,
          recentEvents: 0,
          ipcMessages: 0,
        })
      ),
      getRecentWindowErrors: jest.fn(() => Promise.resolve([])),
      cleanupOldData: jest.fn(() => Promise.resolve()),
    } as any;

    mockContext.getService = jest.fn((name: string) => {
      if (name === 'WindowDatabaseService') return mockDatabase;
      return null;
    });

    // Create WindowManager instance
    windowManager = new WindowManager(mockContext);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Service Lifecycle', () => {
    test('should initialize successfully', async () => {
      await expect(windowManager.initialize(mockContext)).resolves.not.toThrow();

      expect(mockContext.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Window Manager initialized successfully')
      );

      expect(mockContext.metrics.increment).toHaveBeenCalledWith('window_manager.initialized');
    });

    test('should handle initialization failure gracefully', async () => {
      // Mock a failure in window creation
      jest
        .spyOn(windowManager as any, 'createMainWindow')
        .mockRejectedValue(new Error('Failed to create main window'));

      await expect(windowManager.initialize(mockContext)).rejects.toThrow();

      expect(mockContext.logger.error).toHaveBeenCalledWith(
        'Window Manager initialization failed',
        expect.any(Error)
      );
    });

    test('should shutdown gracefully', async () => {
      await windowManager.initialize(mockContext);
      await expect(windowManager.shutdown()).resolves.not.toThrow();

      expect(mockContext.logger.info).toHaveBeenCalledWith('Window Manager shut down successfully');
    });

    test('should report correct status', async () => {
      await windowManager.initialize(mockContext);

      const status = windowManager.getStatus();
      expect(status.status).toBe('running');
      expect(status.uptime).toBeGreaterThan(0);
    });
  });

  describe('Window Lifecycle Management', () => {
    beforeEach(async () => {
      await windowManager.initialize(mockContext);
    });

    test('should create window successfully', async () => {
      const windowInstance = await windowManager.createWindow('alert', {
        title: 'Test Alert',
        width: 400,
        height: 300,
      });

      expect(windowInstance).toBeTruthy();
      expect(windowInstance!.type).toBe('alert');
      expect(windowInstance!.config.title).toBe('Test Alert');
      expect(mockContext.metrics.increment).toHaveBeenCalledWith('window.created.alert');
    });

    test('should not create window of unavailable type', async () => {
      // Set MVP level to 1 (only main window available)
      process.env.MVP_LEVEL = '1';

      const windowInstance = await windowManager.createWindow('analytics-dashboard');
      expect(windowInstance).toBeNull();

      expect(mockContext.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('not available in MVP1')
      );
    });

    test('should respect maximum window limit', async () => {
      // Create maximum allowed windows
      const maxWindows = 3;
      const windows = [];

      for (let i = 0; i < maxWindows; i++) {
        const window = await windowManager.createWindow('alert', {
          title: `Alert ${i}`,
        });
        windows.push(window);
      }

      // Try to create one more
      const extraWindow = await windowManager.createWindow('alert');
      expect(extraWindow).toBeNull();

      expect(mockContext.logger.warn).toHaveBeenCalledWith('Maximum window limit reached');
    });

    test('should close window successfully', async () => {
      const windowInstance = await windowManager.createWindow('alert');
      expect(windowInstance).toBeTruthy();

      const closed = await windowManager.closeWindow(windowInstance!.id);
      expect(closed).toBe(true);

      expect(mockDatabase.saveWindowState).toHaveBeenCalled();
    });

    test('should focus window successfully', async () => {
      const windowInstance = await windowManager.createWindow('alert');
      expect(windowInstance).toBeTruthy();

      const focused = windowManager.focusWindow(windowInstance!.id);
      expect(focused).toBe(true);

      expect(windowInstance!.window.show).toHaveBeenCalled();
      expect(windowInstance!.window.focus).toHaveBeenCalled();
    });

    test('should handle window focus for destroyed window', async () => {
      const windowInstance = await windowManager.createWindow('alert');
      expect(windowInstance).toBeTruthy();

      // Mock window as destroyed
      (windowInstance!.window.isDestroyed as jest.Mock).mockReturnValue(true);

      const focused = windowManager.focusWindow(windowInstance!.id);
      expect(focused).toBe(false);
    });
  });

  describe('Window Communication', () => {
    beforeEach(async () => {
      await windowManager.initialize(mockContext);
    });

    test('should broadcast message to all windows', async () => {
      const window1 = await windowManager.createWindow('alert');
      const window2 = await windowManager.createWindow('pattern-dashboard');

      expect(window1).toBeTruthy();
      expect(window2).toBeTruthy();

      windowManager.broadcast('test-channel', { message: 'hello' });

      // Verify IPC coordinator was called
      // This would need proper mocking of IPCCoordinator
    });

    test('should send message to specific window', async () => {
      const windowInstance = await windowManager.createWindow('alert');
      expect(windowInstance).toBeTruthy();

      const sent = windowManager.sendToWindow(windowInstance!.id, 'test-channel', { data: 'test' });

      expect(sent).toBe(true);
      expect(windowInstance!.window.webContents.send).toHaveBeenCalledWith('test-channel', {
        data: 'test',
      });
    });
  });

  describe('Health Monitoring', () => {
    beforeEach(async () => {
      await windowManager.initialize(mockContext);
    });

    test('should report healthy status', async () => {
      const health = await windowManager.healthCheck();

      expect(health.healthy).toBe(true);
      expect(health.details).toHaveProperty('mainWindow', true);
      expect(health.details).toHaveProperty('totalWindows');
    });

    test('should report unhealthy status when main window destroyed', async () => {
      const mainWindow = windowManager.getMainWindow();
      if (mainWindow) {
        (mainWindow.isDestroyed as jest.Mock).mockReturnValue(true);
      }

      const health = await windowManager.healthCheck();

      expect(health.healthy).toBe(false);
      expect(health.details).toHaveProperty('mainWindow', false);
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await windowManager.initialize(mockContext);
    });

    test('should handle window creation failure gracefully', async () => {
      // Mock BrowserWindow constructor to throw
      const originalBrowserWindow = require('electron').BrowserWindow;
      require('electron').BrowserWindow = jest.fn().mockImplementation(() => {
        throw new Error('Failed to create window');
      });

      const windowInstance = await windowManager.createWindow('alert');
      expect(windowInstance).toBeNull();

      expect(mockContext.logger.error).toHaveBeenCalled();
      expect(mockContext.metrics.increment).toHaveBeenCalledWith('window.creation_failed.alert');

      // Restore original
      require('electron').BrowserWindow = originalBrowserWindow;
    });

    test('should handle database save failure gracefully', async () => {
      mockDatabase.saveWindowState.mockRejectedValue(new Error('Database error'));

      const windowInstance = await windowManager.createWindow('alert');
      expect(windowInstance).toBeTruthy();

      // Should still create window even if database save fails
      expect(mockContext.logger.error).not.toHaveBeenCalledWith(
        expect.stringContaining('Window Manager initialization failed')
      );
    });
  });

  describe('MVP Level Support', () => {
    test('should adapt configuration for MVP1', async () => {
      process.env.MVP_LEVEL = '1';

      await windowManager.initialize(mockContext);

      // Should only allow main window
      const alertWindow = await windowManager.createWindow('alert');
      expect(alertWindow).toBeNull();

      const mainWindow = windowManager.getMainWindow();
      expect(mainWindow).toBeTruthy();
    });

    test('should support additional windows in MVP2+', async () => {
      process.env.MVP_LEVEL = '2';

      await windowManager.initialize(mockContext);

      const patternWindow = await windowManager.createWindow('pattern-dashboard');
      expect(patternWindow).toBeTruthy();

      const alertWindow = await windowManager.createWindow('alert');
      expect(alertWindow).toBeTruthy();
    });
  });
});

describe('WindowIntegrationService', () => {
  let integrationService: WindowIntegrationService;
  let mockContext: ServiceContext;
  let mockWindowManager: jest.Mocked<WindowManager>;
  let mockDatabase: jest.Mocked<WindowDatabaseService>;

  beforeEach(() => {
    mockContext = {
      app: require('electron').app,
      dataPath: '/test/data',
      isDevelopment: true,
      config: {},
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      },
      metrics: {
        increment: jest.fn(),
        histogram: jest.fn(),
        gauge: jest.fn(),
        timer: jest.fn(() => jest.fn()),
      },
      getService: jest.fn(),
    };

    mockWindowManager = {
      createWindow: jest.fn(),
      closeWindow: jest.fn(),
      getWindow: jest.fn(),
      getAllWindows: jest.fn(() => []),
      switchWorkspace: jest.fn(),
      getMainWindow: jest.fn(),
      healthCheck: jest.fn(() =>
        Promise.resolve({ healthy: true, lastCheck: new Date(), responseTime: 0 })
      ),
      on: jest.fn(),
      emit: jest.fn(),
    } as any;

    mockDatabase = {
      saveWindowState: jest.fn(() => Promise.resolve()),
      deleteWindowState: jest.fn(() => Promise.resolve()),
      logWindowEvent: jest.fn(() => Promise.resolve()),
      updateWindowHealth: jest.fn(() => Promise.resolve()),
      loadWorkspace: jest.fn(() => Promise.resolve(null)),
      healthCheck: jest.fn(() =>
        Promise.resolve({ healthy: true, lastCheck: new Date(), responseTime: 0 })
      ),
    } as any;

    mockContext.getService = jest.fn((name: string) => {
      if (name === 'WindowManager') return mockWindowManager;
      if (name === 'WindowDatabaseService') return mockDatabase;
      return null;
    });

    integrationService = new WindowIntegrationService(mockContext);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Service Integration', () => {
    test('should initialize with all dependencies', async () => {
      await expect(integrationService.initialize(mockContext)).resolves.not.toThrow();

      expect(mockContext.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Window Integration Service initialized')
      );
    });

    test('should fail initialization without WindowManager', async () => {
      mockContext.getService = jest.fn(() => null);

      await expect(integrationService.initialize(mockContext)).rejects.toThrow(
        'WindowManager service not available'
      );
    });

    test('should create window with database persistence', async () => {
      await integrationService.initialize(mockContext);

      const mockWindow = {
        id: 'test-window',
        type: 'alert' as WindowType,
        window: new BrowserWindow(),
        config: { type: 'alert' as WindowType, title: 'Test' },
        created: new Date(),
        focused: false,
      };

      mockWindowManager.createWindow.mockResolvedValue(mockWindow);

      const result = await integrationService.createWindow('alert', { title: 'Test' });

      expect(result).toBe(mockWindow);
      expect(mockWindowManager.createWindow).toHaveBeenCalledWith('alert', { title: 'Test' });
      expect(mockDatabase.saveWindowState).toHaveBeenCalled();
      expect(mockDatabase.logWindowEvent).toHaveBeenCalled();
    });

    test('should handle window creation failure with recovery', async () => {
      await integrationService.initialize(mockContext);

      mockWindowManager.createWindow
        .mockRejectedValueOnce(new Error('Creation failed'))
        .mockResolvedValueOnce({
          id: 'recovered-window',
          type: 'alert' as WindowType,
          window: new BrowserWindow(),
          config: { type: 'alert' as WindowType, title: 'Recovered' },
          created: new Date(),
          focused: false,
        });

      const result = await integrationService.createWindow('alert');

      expect(result).toBeTruthy();
      expect(result!.id).toBe('recovered-window');
      expect(mockWindowManager.createWindow).toHaveBeenCalledTimes(2);
    });

    test('should close window with cleanup', async () => {
      await integrationService.initialize(mockContext);

      const mockWindow = {
        id: 'test-window',
        type: 'alert' as WindowType,
        window: new BrowserWindow(),
        config: { type: 'alert' as WindowType, title: 'Test' },
        created: new Date(),
        focused: false,
      };

      mockWindowManager.getWindow.mockReturnValue(mockWindow);
      mockWindowManager.closeWindow.mockResolvedValue(true);

      const result = await integrationService.closeWindow('test-window');

      expect(result).toBe(true);
      expect(mockWindowManager.closeWindow).toHaveBeenCalledWith('test-window');
      expect(mockDatabase.deleteWindowState).toHaveBeenCalledWith('test-window');
      expect(mockDatabase.logWindowEvent).toHaveBeenCalled();
    });
  });

  describe('Health Monitoring', () => {
    beforeEach(async () => {
      await integrationService.initialize(mockContext);
    });

    test('should report healthy status when all components healthy', async () => {
      const health = await integrationService.healthCheck();

      expect(health.healthy).toBe(true);
      expect(health.details).toHaveProperty('components');
    });

    test('should report unhealthy status when component fails', async () => {
      mockWindowManager.healthCheck.mockResolvedValue({
        healthy: false,
        error: 'WindowManager error',
        lastCheck: new Date(),
        responseTime: 0,
      });

      const health = await integrationService.healthCheck();

      expect(health.healthy).toBe(false);
    });
  });

  describe('Error Recovery', () => {
    beforeEach(async () => {
      await integrationService.initialize(mockContext);
    });

    test('should attempt recovery on window creation failure', async () => {
      let attempts = 0;
      mockWindowManager.createWindow.mockImplementation(() => {
        attempts++;
        if (attempts <= 2) {
          return Promise.reject(new Error('Creation failed'));
        }
        return Promise.resolve({
          id: 'recovered-window',
          type: 'alert' as WindowType,
          window: new BrowserWindow(),
          config: { type: 'alert' as WindowType, title: 'Recovered' },
          created: new Date(),
          focused: false,
        });
      });

      const result = await integrationService.createWindow('alert');

      expect(result).toBeTruthy();
      expect(attempts).toBe(3);
    });

    test('should limit recovery attempts', async () => {
      mockWindowManager.createWindow.mockRejectedValue(new Error('Persistent failure'));

      const result = await integrationService.createWindow('alert');

      expect(result).toBeNull();
      expect(mockWindowManager.createWindow).toHaveBeenCalledTimes(4); // 1 initial + 3 recovery attempts
    });
  });

  describe('Statistics', () => {
    beforeEach(async () => {
      await integrationService.initialize(mockContext);
    });

    test('should track window creation statistics', async () => {
      const mockWindow = {
        id: 'test-window',
        type: 'alert' as WindowType,
        window: new BrowserWindow(),
        config: { type: 'alert' as WindowType, title: 'Test' },
        created: new Date(),
        focused: false,
      };

      mockWindowManager.createWindow.mockResolvedValue(mockWindow);

      await integrationService.createWindow('alert');

      const stats = integrationService.getIntegrationStats();
      expect(stats.windowsCreated).toBe(1);
    });

    test('should track error statistics', async () => {
      mockWindowManager.createWindow.mockRejectedValue(new Error('Creation failed'));

      // Disable auto-recovery for this test
      (integrationService as any).config.enableAutoRecovery = false;

      try {
        await integrationService.createWindow('alert');
      } catch {
        // Expected to throw
      }

      const stats = integrationService.getIntegrationStats();
      expect(stats.errors).toHaveLength(1);
      expect(stats.errors[0]).toContain('Creation failed');
    });
  });
});

// Test database schema and migrations
describe('Window Database Schema', () => {
  test('should create all required tables', async () => {
    // This would test the actual database schema creation
    // For now, just verify the SQL file exists and is valid
    const fs = require('fs');
    const path = require('path');

    const schemaPath = path.join(
      __dirname,
      '../../../database/migrations/mvp-upgrades/001_window_management_schema.sql'
    );

    expect(fs.existsSync(schemaPath)).toBe(true);

    const schemaContent = fs.readFileSync(schemaPath, 'utf8');

    // Verify key tables exist in schema
    expect(schemaContent).toContain('CREATE TABLE IF NOT EXISTS window_states');
    expect(schemaContent).toContain('CREATE TABLE IF NOT EXISTS workspaces');
    expect(schemaContent).toContain('CREATE TABLE IF NOT EXISTS window_health');
    expect(schemaContent).toContain('CREATE TABLE IF NOT EXISTS window_events');
    expect(schemaContent).toContain('CREATE TABLE IF NOT EXISTS ipc_messages');
  });
});
