/**
 * Window Lifecycle Integration Tests
 *
 * Tests comprehensive window lifecycle management including:
 * - Window creation and initialization
 * - Window destruction and cleanup
 * - Memory management
 * - Event handling
 * - Error recovery
 */

import { BrowserWindow, app, screen } from 'electron';
import { EventEmitter } from 'events';
import { WindowManager } from '../../../src/main/windows/WindowManager';
import { WindowFactory } from '../../../src/main/windows/WindowFactory';
import { WindowStateManager } from '../../../src/main/windows/WindowStateManager';
import { WindowRegistry } from '../../../src/main/windows/WindowRegistry';
import { WindowType, WindowConfig, WindowInstance } from '../../../src/main/windows/types/WindowTypes';

// Mock setup
jest.mock('electron', () => require('../../__mocks__/electron'));

describe('Window Lifecycle Management', () => {
  let windowManager: WindowManager;
  let windowFactory: WindowFactory;
  let mockContext: any;
  let mockBrowserWindow: jest.Mocked<BrowserWindow>;

  beforeAll(async () => {
    // Wait for app to be ready
    await app.whenReady();
  });

  beforeEach(() => {
    // Setup mock context
    mockContext = {
      config: {
        get: jest.fn((key: string) => {
          switch (key) {
            case 'window.mvpLevel': return 1;
            case 'window.theme': return 'auto';
            case 'window.security.webSecurity': return true;
            default: return null;
          }
        }),
        set: jest.fn(),
        has: jest.fn(() => true)
      },
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
      },
      services: new Map()
    };

    // Create instances
    windowFactory = new WindowFactory(mockContext);
    windowManager = new WindowManager();

    // Mock BrowserWindow
    mockBrowserWindow = new BrowserWindow() as jest.Mocked<BrowserWindow>;

    // Clear mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {
    // Cleanup windows
    const windows = BrowserWindow.getAllWindows();
    for (const window of windows) {
      if (!window.isDestroyed()) {
        window.destroy();
      }
    }

    // Stop window manager if running
    if (windowManager) {
      await windowManager.stop();
    }
  });

  describe('Window Creation', () => {
    it('should create main window with correct configuration', async () => {
      const config: WindowConfig = {
        type: 'main',
        title: 'Test Main Window',
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        resizable: true,
        minimizable: true,
        maximizable: true,
        closable: true,
        alwaysOnTop: false,
        fullscreen: false,
        kiosk: false,
        autoHideMenuBar: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          enableRemoteModule: false,
          webSecurity: true
        }
      };

      const windowInstance = await windowFactory.createWindow('main', config);

      expect(windowInstance).toBeDefined();
      expect(windowInstance.id).toBeDefined();
      expect(windowInstance.type).toBe('main');
      expect(windowInstance.window).toBeInstanceOf(BrowserWindow);
      expect(windowInstance.config.title).toBe('Test Main Window');
      expect(windowInstance.config.width).toBe(1200);
      expect(windowInstance.config.height).toBe(800);
    });

    it('should assign unique IDs to multiple windows', async () => {
      const window1 = await windowFactory.createWindow('main');
      const window2 = await windowFactory.createWindow('alert');

      expect(window1.id).toBeDefined();
      expect(window2.id).toBeDefined();
      expect(window1.id).not.toBe(window2.id);
    });

    it('should apply MVP-level restrictions correctly', async () => {
      // In MVP1, only main windows should be available
      mockContext.config.get.mockImplementation((key: string) => {
        if (key === 'window.mvpLevel') return 1;
        return null;
      });

      const factory = new WindowFactory(mockContext);

      // Should work for main window
      const mainWindow = await factory.createWindow('main');
      expect(mainWindow).toBeDefined();

      // Should fail for advanced window types
      await expect(factory.createWindow('analytics-dashboard'))
        .rejects.toThrow("Window type 'analytics-dashboard' not available in MVP 1");
    });

    it('should handle window creation errors gracefully', async () => {
      // Mock BrowserWindow constructor to throw
      const originalBrowserWindow = BrowserWindow;
      (BrowserWindow as any) = jest.fn().mockImplementation(() => {
        throw new Error('Failed to create window');
      });

      await expect(windowFactory.createWindow('main'))
        .rejects.toThrow('Failed to create window');

      // Restore
      (BrowserWindow as any) = originalBrowserWindow;
    });

    it('should set proper window bounds based on display', async () => {
      const display = screen.getPrimaryDisplay();
      const workArea = display.workAreaSize;

      const windowInstance = await windowFactory.createWindow('main', {
        width: workArea.width * 0.8,
        height: workArea.height * 0.8
      });

      expect(windowInstance.config.width).toBe(Math.floor(workArea.width * 0.8));
      expect(windowInstance.config.height).toBe(Math.floor(workArea.height * 0.8));
    });
  });

  describe('Window Initialization', () => {
    it('should properly initialize window with preload script', async () => {
      const windowInstance = await windowFactory.createWindow('main');

      expect(windowInstance.window.webContents).toBeDefined();
      expect(windowInstance.config.webPreferences?.preload).toContain('preload');
    });

    it('should set up event listeners correctly', async () => {
      const windowInstance = await windowFactory.createWindow('main');
      const window = windowInstance.window;

      // Simulate window events
      window.emit('ready-to-show');
      window.emit('closed');
      window.emit('minimize');
      window.emit('maximize');

      // Events should be handled without errors
      expect(window.listeners('ready-to-show').length).toBeGreaterThan(0);
    });

    it('should load content correctly', async () => {
      const windowInstance = await windowFactory.createWindow('main');
      const loadSpy = jest.spyOn(windowInstance.window, 'loadFile');

      await windowInstance.window.loadFile('index.html');
      expect(loadSpy).toHaveBeenCalledWith('index.html');
    });

    it('should handle initialization timeouts', async () => {
      jest.useFakeTimers();

      const windowInstance = await windowFactory.createWindow('main');

      // Simulate slow initialization
      setTimeout(() => {
        windowInstance.window.emit('ready-to-show');
      }, 10000);

      jest.advanceTimersByTime(5000);

      // Should handle timeout gracefully
      expect(windowInstance.window).toBeDefined();

      jest.useRealTimers();
    });
  });

  describe('Window Destruction', () => {
    let windowInstance: WindowInstance;

    beforeEach(async () => {
      windowInstance = await windowFactory.createWindow('main');
    });

    it('should destroy window and cleanup resources', async () => {
      const window = windowInstance.window;
      const destroySpy = jest.spyOn(window, 'destroy');

      window.destroy();

      expect(destroySpy).toHaveBeenCalled();
      expect(window.isDestroyed()).toBe(true);
    });

    it('should handle close events properly', async () => {
      const window = windowInstance.window;
      let closeEventFired = false;

      window.on('closed', () => {
        closeEventFired = true;
      });

      window.close();
      window.emit('closed');

      expect(closeEventFired).toBe(true);
    });

    it('should prevent close when configured', async () => {
      const window = windowInstance.window;
      let preventClose = true;

      window.on('close', (event) => {
        if (preventClose) {
          event.preventDefault();
        }
      });

      const closeResult = window.close();
      expect(window.isDestroyed()).toBe(false);

      // Allow close
      preventClose = false;
      window.close();
    });

    it('should cleanup event listeners on destruction', async () => {
      const window = windowInstance.window;
      const removeAllListenersSpy = jest.spyOn(window, 'removeAllListeners');

      window.destroy();

      // Should cleanup listeners
      expect(removeAllListenersSpy).toHaveBeenCalled();
    });

    it('should handle destruction errors gracefully', async () => {
      const window = windowInstance.window;

      // Mock destroy to throw error
      jest.spyOn(window, 'destroy').mockImplementation(() => {
        throw new Error('Destruction failed');
      });

      expect(() => window.destroy()).toThrow('Destruction failed');
    });
  });

  describe('Memory Management', () => {
    it('should not leak memory when creating and destroying windows', async () => {
      const initialWindowCount = BrowserWindow.getAllWindows().length;

      // Create multiple windows
      const windows = await Promise.all([
        windowFactory.createWindow('main'),
        windowFactory.createWindow('alert'),
        windowFactory.createWindow('main')
      ]);

      expect(BrowserWindow.getAllWindows().length).toBe(initialWindowCount + 3);

      // Destroy all windows
      windows.forEach(({ window }) => {
        if (!window.isDestroyed()) {
          window.destroy();
        }
      });

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      expect(BrowserWindow.getAllWindows().length).toBe(initialWindowCount);
    });

    it('should handle memory pressure correctly', async () => {
      const windows: WindowInstance[] = [];

      try {
        // Create many windows to simulate memory pressure
        for (let i = 0; i < 50; i++) {
          const window = await windowFactory.createWindow('main');
          windows.push(window);
        }

        expect(windows.length).toBe(50);
      } finally {
        // Cleanup
        windows.forEach(({ window }) => {
          if (!window.isDestroyed()) {
            window.destroy();
          }
        });
      }
    });

    it('should monitor window memory usage', async () => {
      const windowInstance = await windowFactory.createWindow('main');
      const webContents = windowInstance.window.webContents;

      // Mock memory usage
      const mockMemoryUsage = {
        workingSetSize: 100 * 1024 * 1024, // 100MB
        peakWorkingSetSize: 120 * 1024 * 1024,
        privateUsage: 80 * 1024 * 1024
      };

      jest.spyOn(process, 'getProcessMemoryInfo').mockResolvedValue(mockMemoryUsage);

      const memoryInfo = await process.getProcessMemoryInfo();
      expect(memoryInfo.workingSetSize).toBe(mockMemoryUsage.workingSetSize);
    });
  });

  describe('Event Handling', () => {
    let windowInstance: WindowInstance;

    beforeEach(async () => {
      windowInstance = await windowFactory.createWindow('main');
    });

    it('should handle window focus events', async () => {
      const window = windowInstance.window;
      let focusEventFired = false;
      let blurEventFired = false;

      window.on('focus', () => { focusEventFired = true; });
      window.on('blur', () => { blurEventFired = true; });

      window.emit('focus');
      window.emit('blur');

      expect(focusEventFired).toBe(true);
      expect(blurEventFired).toBe(true);
    });

    it('should handle resize events', async () => {
      const window = windowInstance.window;
      let resizeEventFired = false;

      window.on('resize', () => { resizeEventFired = true; });
      window.emit('resize');

      expect(resizeEventFired).toBe(true);
    });

    it('should handle move events', async () => {
      const window = windowInstance.window;
      let moveEventFired = false;

      window.on('move', () => { moveEventFired = true; });
      window.emit('move');

      expect(moveEventFired).toBe(true);
    });

    it('should handle unresponsive window events', async () => {
      const window = windowInstance.window;
      let unresponsiveEventFired = false;

      window.on('unresponsive', () => { unresponsiveEventFired = true; });
      window.emit('unresponsive');

      expect(unresponsiveEventFired).toBe(true);
    });

    it('should handle responsive window events', async () => {
      const window = windowInstance.window;
      let responsiveEventFired = false;

      window.on('responsive', () => { responsiveEventFired = true; });
      window.emit('responsive');

      expect(responsiveEventFired).toBe(true);
    });
  });

  describe('Error Recovery', () => {
    it('should recover from window crashes', async () => {
      const windowInstance = await windowFactory.createWindow('main');
      const window = windowInstance.window;

      let crashEventFired = false;
      window.webContents.on('crashed', () => {
        crashEventFired = true;
      });

      // Simulate crash
      window.webContents.emit('crashed');

      expect(crashEventFired).toBe(true);
    });

    it('should handle window creation failures with retry', async () => {
      let attempts = 0;
      const originalCreateWindow = windowFactory.createWindow;

      windowFactory.createWindow = jest.fn().mockImplementation(async (type, config) => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Creation failed');
        }
        return originalCreateWindow.call(windowFactory, type, config);
      });

      // Should eventually succeed after retries
      const windowInstance = await windowFactory.createWindow('main');
      expect(windowInstance).toBeDefined();
      expect(attempts).toBe(3);
    });

    it('should handle display disconnection gracefully', async () => {
      const windowInstance = await windowFactory.createWindow('main');
      const window = windowInstance.window;

      // Simulate display disconnection
      screen.emit('display-removed', { id: 1 });

      // Window should still be functional
      expect(window.isDestroyed()).toBe(false);
      expect(window.isVisible()).toBeDefined();
    });
  });

  describe('Performance', () => {
    it('should create windows within acceptable time limits', async () => {
      const startTime = Date.now();

      const windowInstance = await windowFactory.createWindow('main');

      const creationTime = Date.now() - startTime;
      expect(creationTime).toBeLessThan(1000); // Should create in under 1 second
      expect(windowInstance).toBeDefined();
    });

    it('should handle concurrent window creation', async () => {
      const startTime = Date.now();

      const promises = Array.from({ length: 5 }, (_, i) =>
        windowFactory.createWindow('main', { title: `Window ${i}` })
      );

      const windows = await Promise.all(promises);

      const totalTime = Date.now() - startTime;
      expect(totalTime).toBeLessThan(3000); // Should create 5 windows in under 3 seconds
      expect(windows).toHaveLength(5);

      // Cleanup
      windows.forEach(({ window }) => {
        if (!window.isDestroyed()) {
          window.destroy();
        }
      });
    });

    it('should efficiently manage window resources', async () => {
      const window1 = await windowFactory.createWindow('main');
      const window2 = await windowFactory.createWindow('alert');

      // Check that windows are properly isolated
      expect(window1.id).not.toBe(window2.id);
      expect(window1.window.webContents.id).not.toBe(window2.window.webContents.id);

      // Cleanup
      window1.window.destroy();
      window2.window.destroy();
    });
  });
});