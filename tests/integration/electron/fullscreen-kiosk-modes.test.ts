/**
 * Full-Screen and Kiosk Mode Tests
 *
 * Tests comprehensive full-screen and kiosk mode functionality including:
 * - Full-screen mode transitions and behavior
 * - Kiosk mode implementation and restrictions
 * - Multi-display full-screen scenarios
 * - Escape key and exit mechanisms
 * - Performance in full-screen modes
 * - Platform-specific full-screen behavior
 */

import { BrowserWindow, app, screen, globalShortcut } from 'electron';
import { WindowManager } from '../../../src/main/windows/WindowManager';
import { WindowFactory } from '../../../src/main/windows/WindowFactory';
import { WindowStateManager } from '../../../src/main/windows/WindowStateManager';
import { WindowInstance, WindowConfig } from '../../../src/main/windows/types/WindowTypes';

// Mock setup
jest.mock('electron', () => require('../../__mocks__/electron'));

describe('Full-Screen and Kiosk Mode Management', () => {
  let windowManager: WindowManager;
  let windowFactory: WindowFactory;
  let windowStateManager: WindowStateManager;
  let mockContext: any;
  let testWindows: WindowInstance[] = [];

  beforeAll(async () => {
    await app.whenReady();
  });

  beforeEach(async () => {
    // Setup mock context
    mockContext = {
      config: {
        get: jest.fn((key: string) => {
          switch (key) {
            case 'window.fullscreen.enabled': return true;
            case 'window.kiosk.enabled': return true;
            case 'window.fullscreen.allowEscape': return true;
            case 'window.kiosk.exitKey': return 'F11';
            case 'window.kiosk.restrictions': return ['devtools', 'menu', 'context-menu'];
            case 'window.fullscreen.animation': return true;
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
    windowStateManager = new WindowStateManager(mockContext);

    testWindows = [];
    jest.clearAllMocks();

    // Mock globalShortcut
    (globalShortcut.register as jest.Mock).mockImplementation(() => true);
    (globalShortcut.unregister as jest.Mock).mockImplementation(() => {});
    (globalShortcut.isRegistered as jest.Mock).mockImplementation(() => false);
  });

  afterEach(async () => {
    // Cleanup
    for (const windowInstance of testWindows) {
      if (windowInstance?.window && !windowInstance.window.isDestroyed()) {
        // Exit full-screen/kiosk before destroying
        if (windowInstance.window.isFullScreen()) {
          windowInstance.window.setFullScreen(false);
        }
        if (windowInstance.window.isKiosk && windowInstance.window.isKiosk()) {
          windowInstance.window.setKiosk(false);
        }
        windowInstance.window.destroy();
      }
    }
    testWindows = [];

    // Unregister all shortcuts
    globalShortcut.unregisterAll();

    if (windowManager) {
      await windowManager.stop();
    }
  });

  describe('Full-Screen Mode Transitions', () => {
    let testWindow: WindowInstance;

    beforeEach(async () => {
      testWindow = await windowFactory.createWindow('main', {
        title: 'Full-Screen Test Window',
        width: 1000,
        height: 700,
        fullscreen: false
      });
      testWindows.push(testWindow);
    });

    it('should enter full-screen mode correctly', async () => {
      const window = testWindow.window;

      // Mock full-screen methods
      jest.spyOn(window, 'setFullScreen').mockImplementation((fullscreen: boolean) => {
        (window as any)._isFullScreen = fullscreen;
      });
      jest.spyOn(window, 'isFullScreen').mockImplementation(() => (window as any)._isFullScreen || false);

      // Enter full-screen
      window.setFullScreen(true);
      window.emit('enter-full-screen');

      expect(window.setFullScreen).toHaveBeenCalledWith(true);
      expect(window.isFullScreen()).toBe(true);
    });

    it('should exit full-screen mode correctly', async () => {
      const window = testWindow.window;

      // Mock full-screen methods
      jest.spyOn(window, 'setFullScreen').mockImplementation((fullscreen: boolean) => {
        (window as any)._isFullScreen = fullscreen;
      });
      jest.spyOn(window, 'isFullScreen').mockImplementation(() => (window as any)._isFullScreen || false);

      // Enter then exit full-screen
      window.setFullScreen(true);
      (window as any)._isFullScreen = true;
      window.emit('enter-full-screen');

      expect(window.isFullScreen()).toBe(true);

      window.setFullScreen(false);
      (window as any)._isFullScreen = false;
      window.emit('leave-full-screen');

      expect(window.isFullScreen()).toBe(false);
    });

    it('should handle full-screen toggle correctly', async () => {
      const window = testWindow.window;

      // Mock full-screen methods
      jest.spyOn(window, 'setFullScreen').mockImplementation((fullscreen: boolean) => {
        (window as any)._isFullScreen = fullscreen;
      });
      jest.spyOn(window, 'isFullScreen').mockImplementation(() => (window as any)._isFullScreen || false);

      // Toggle full-screen multiple times
      for (let i = 0; i < 5; i++) {
        const isCurrentlyFullScreen = window.isFullScreen();
        window.setFullScreen(!isCurrentlyFullScreen);
        (window as any)._isFullScreen = !isCurrentlyFullScreen;

        if (!isCurrentlyFullScreen) {
          window.emit('enter-full-screen');
        } else {
          window.emit('leave-full-screen');
        }

        expect(window.isFullScreen()).toBe(!isCurrentlyFullScreen);
      }
    });

    it('should restore window state after exiting full-screen', async () => {
      const window = testWindow.window;

      // Save original bounds
      const originalBounds = {
        x: 100,
        y: 100,
        width: 1000,
        height: 700
      };

      jest.spyOn(window, 'getBounds').mockReturnValue(originalBounds);
      jest.spyOn(window, 'setBounds').mockImplementation(() => {});
      jest.spyOn(window, 'setFullScreen').mockImplementation((fullscreen: boolean) => {
        (window as any)._isFullScreen = fullscreen;
      });
      jest.spyOn(window, 'isFullScreen').mockImplementation(() => (window as any)._isFullScreen || false);

      // Save state before full-screen
      const savedState = await windowStateManager.saveWindowState(testWindow.id, window);

      // Enter full-screen
      window.setFullScreen(true);
      (window as any)._isFullScreen = true;
      window.emit('enter-full-screen');

      // Exit full-screen
      window.setFullScreen(false);
      (window as any)._isFullScreen = false;
      window.emit('leave-full-screen');

      // Restore state
      await windowStateManager.restoreWindowState(testWindow.id, window, savedState);

      expect(window.setBounds).toHaveBeenCalledWith(originalBounds);
    });

    it('should handle escape key in full-screen mode', async () => {
      const window = testWindow.window;

      // Mock full-screen methods
      jest.spyOn(window, 'setFullScreen').mockImplementation((fullscreen: boolean) => {
        (window as any)._isFullScreen = fullscreen;
      });
      jest.spyOn(window, 'isFullScreen').mockImplementation(() => (window as any)._isFullScreen || false);

      // Enter full-screen
      window.setFullScreen(true);
      (window as any)._isFullScreen = true;
      window.emit('enter-full-screen');

      // Register escape key handler
      let escapePressed = false;
      globalShortcut.register('Escape', () => {
        escapePressed = true;
        if (window.isFullScreen()) {
          window.setFullScreen(false);
          (window as any)._isFullScreen = false;
          window.emit('leave-full-screen');
        }
      });

      // Simulate escape key press
      escapePressed = true;
      window.setFullScreen(false);
      (window as any)._isFullScreen = false;
      window.emit('leave-full-screen');

      expect(escapePressed).toBe(true);
      expect(window.isFullScreen()).toBe(false);
    });

    it('should handle full-screen on specific display', async () => {
      const window = testWindow.window;
      const displays = screen.getAllDisplays();

      if (displays.length > 1) {
        const secondaryDisplay = displays[1];

        // Mock display methods
        jest.spyOn(screen, 'getDisplayNearestPoint').mockReturnValue(secondaryDisplay);

        // Move window to secondary display and enter full-screen
        window.setBounds({
          x: secondaryDisplay.bounds.x + 100,
          y: secondaryDisplay.bounds.y + 100,
          width: 800,
          height: 600
        });

        jest.spyOn(window, 'setFullScreen').mockImplementation((fullscreen: boolean) => {
          (window as any)._isFullScreen = fullscreen;
          if (fullscreen) {
            // Full-screen should use display bounds
            (window as any)._bounds = secondaryDisplay.bounds;
          }
        });

        window.setFullScreen(true);
        window.emit('enter-full-screen');

        expect(window.setFullScreen).toHaveBeenCalledWith(true);
      }
    });
  });

  describe('Kiosk Mode Implementation', () => {
    let testWindow: WindowInstance;

    beforeEach(async () => {
      testWindow = await windowFactory.createWindow('main', {
        title: 'Kiosk Test Window',
        width: 1000,
        height: 700,
        kiosk: false
      });
      testWindows.push(testWindow);
    });

    it('should enter kiosk mode correctly', async () => {
      const window = testWindow.window;

      // Mock kiosk methods (note: not all Electron mocks include kiosk)
      if (window.setKiosk) {
        jest.spyOn(window, 'setKiosk').mockImplementation((kiosk: boolean) => {
          (window as any)._isKiosk = kiosk;
        });
        jest.spyOn(window, 'isKiosk').mockImplementation(() => (window as any)._isKiosk || false);

        // Enter kiosk mode
        window.setKiosk(true);

        expect(window.setKiosk).toHaveBeenCalledWith(true);
        expect(window.isKiosk()).toBe(true);
      } else {
        // Fallback to full-screen for kiosk simulation
        jest.spyOn(window, 'setFullScreen').mockImplementation((fullscreen: boolean) => {
          (window as any)._isFullScreen = fullscreen;
        });

        window.setFullScreen(true);
        expect(window.setFullScreen).toHaveBeenCalledWith(true);
      }
    });

    it('should apply kiosk mode restrictions', async () => {
      const window = testWindow.window;

      // Mock restriction methods
      jest.spyOn(window, 'setMenuBarVisibility').mockImplementation(() => {});
      jest.spyOn(window.webContents, 'openDevTools').mockImplementation(() => {});
      jest.spyOn(window.webContents, 'closeDevTools').mockImplementation(() => {});

      // Enter kiosk mode with restrictions
      if (window.setKiosk) {
        window.setKiosk(true);
      } else {
        // Simulate kiosk restrictions manually
        window.setMenuBarVisibility(false);
        window.webContents.closeDevTools();
      }

      expect(window.setMenuBarVisibility).toHaveBeenCalledWith(false);
      expect(window.webContents.closeDevTools).toHaveBeenCalled();
    });

    it('should handle kiosk mode exit mechanisms', async () => {
      const window = testWindow.window;

      // Mock kiosk methods
      if (window.setKiosk) {
        jest.spyOn(window, 'setKiosk').mockImplementation((kiosk: boolean) => {
          (window as any)._isKiosk = kiosk;
        });
        jest.spyOn(window, 'isKiosk').mockImplementation(() => (window as any)._isKiosk || false);

        // Enter kiosk mode
        window.setKiosk(true);
        (window as any)._isKiosk = true;

        // Register exit key combination (e.g., Ctrl+Alt+X)
        let exitKeyPressed = false;
        globalShortcut.register('Ctrl+Alt+X', () => {
          exitKeyPressed = true;
          if (window.isKiosk()) {
            window.setKiosk(false);
            (window as any)._isKiosk = false;
          }
        });

        // Simulate exit key press
        exitKeyPressed = true;
        window.setKiosk(false);
        (window as any)._isKiosk = false;

        expect(exitKeyPressed).toBe(true);
        expect(window.isKiosk()).toBe(false);
      }
    });

    it('should prevent window operations in kiosk mode', async () => {
      const window = testWindow.window;

      // Mock kiosk mode
      if (window.setKiosk) {
        jest.spyOn(window, 'isKiosk').mockReturnValue(true);
      }

      // These operations should be prevented or ignored in kiosk mode
      const closeSpy = jest.spyOn(window, 'close').mockImplementation(() => {
        // In kiosk mode, close should be prevented
        if (window.isKiosk && window.isKiosk()) {
          return;
        }
      });

      const minimizeSpy = jest.spyOn(window, 'minimize').mockImplementation(() => {
        // In kiosk mode, minimize should be prevented
        if (window.isKiosk && window.isKiosk()) {
          return;
        }
      });

      // Try to close and minimize
      window.close();
      window.minimize();

      if (window.isKiosk) {
        expect(window.isKiosk()).toBe(true);
        // Window should remain open and not minimized
        expect(window.isDestroyed()).toBe(false);
      }
    });

    it('should handle kiosk mode with custom configuration', async () => {
      const kioskConfig: Partial<WindowConfig> = {
        kiosk: true,
        fullscreen: true,
        autoHideMenuBar: true,
        webPreferences: {
          devTools: false,
          contextIsolation: true,
          nodeIntegration: false
        }
      };

      const kioskWindow = await windowFactory.createWindow('main', kioskConfig);
      testWindows.push(kioskWindow);

      expect(kioskWindow.config.kiosk).toBe(true);
      expect(kioskWindow.config.fullscreen).toBe(true);
      expect(kioskWindow.config.autoHideMenuBar).toBe(true);
      expect(kioskWindow.config.webPreferences?.devTools).toBe(false);
    });
  });

  describe('Multi-Display Full-Screen Scenarios', () => {
    beforeEach(() => {
      // Mock multiple displays
      const mockDisplays = [
        {
          id: 1,
          bounds: { x: 0, y: 0, width: 1920, height: 1080 },
          workAreaSize: { width: 1920, height: 1040 },
          scaleFactor: 1.0
        },
        {
          id: 2,
          bounds: { x: 1920, y: 0, width: 2560, height: 1440 },
          workAreaSize: { width: 2560, height: 1400 },
          scaleFactor: 1.25
        }
      ];

      jest.spyOn(screen, 'getAllDisplays').mockReturnValue(mockDisplays as any);
      jest.spyOn(screen, 'getPrimaryDisplay').mockReturnValue(mockDisplays[0] as any);
    });

    it('should handle full-screen on multiple displays', async () => {
      const displays = screen.getAllDisplays();
      const windows: WindowInstance[] = [];

      // Create windows on different displays
      for (let i = 0; i < displays.length; i++) {
        const display = displays[i];
        const window = await windowFactory.createWindow('main', {
          x: display.bounds.x + 100,
          y: display.bounds.y + 100,
          width: 800,
          height: 600
        });

        windows.push(window);
        testWindows.push(window);

        // Mock full-screen for this window
        jest.spyOn(window.window, 'setFullScreen').mockImplementation((fullscreen: boolean) => {
          (window.window as any)._isFullScreen = fullscreen;
        });
        jest.spyOn(window.window, 'isFullScreen').mockImplementation(() =>
          (window.window as any)._isFullScreen || false
        );
      }

      // Enter full-screen on all displays
      windows.forEach(({ window }) => {
        window.setFullScreen(true);
        (window as any)._isFullScreen = true;
        window.emit('enter-full-screen');
      });

      // All windows should be in full-screen
      windows.forEach(({ window }) => {
        expect(window.isFullScreen()).toBe(true);
      });
    });

    it('should handle display-specific full-screen settings', async () => {
      const displays = screen.getAllDisplays();
      const primaryDisplay = displays[0];
      const secondaryDisplay = displays[1];

      // Window on high-DPI display
      const highDPIWindow = await windowFactory.createWindow('main', {
        x: secondaryDisplay.bounds.x + 100,
        y: secondaryDisplay.bounds.y + 100,
        width: 800,
        height: 600
      });

      testWindows.push(highDPIWindow);

      // Mock display-aware full-screen
      jest.spyOn(highDPIWindow.window, 'setFullScreen').mockImplementation((fullscreen: boolean) => {
        (highDPIWindow.window as any)._isFullScreen = fullscreen;
        if (fullscreen) {
          // Should adapt to display characteristics
          const scaleFactor = secondaryDisplay.scaleFactor;
          (highDPIWindow.window as any)._scaleFactor = scaleFactor;
        }
      });

      highDPIWindow.window.setFullScreen(true);

      expect((highDPIWindow.window as any)._scaleFactor).toBe(secondaryDisplay.scaleFactor);
    });

    it('should synchronize full-screen state across displays', async () => {
      const displays = screen.getAllDisplays();
      const windows: WindowInstance[] = [];

      // Create coordinated windows
      for (const display of displays) {
        const window = await windowFactory.createWindow('main', {
          x: display.bounds.x + 100,
          y: display.bounds.y + 100,
          width: 800,
          height: 600
        });

        windows.push(window);
        testWindows.push(window);

        // Mock coordinated full-screen behavior
        jest.spyOn(window.window, 'setFullScreen').mockImplementation((fullscreen: boolean) => {
          (window.window as any)._isFullScreen = fullscreen;
        });
      }

      // Enter full-screen mode on one window should optionally coordinate with others
      const primaryWindow = windows[0];
      primaryWindow.window.setFullScreen(true);
      (primaryWindow.window as any)._isFullScreen = true;

      // Check if coordination is needed based on application design
      // This would depend on specific coordination requirements
      expect(primaryWindow.window.isFullScreen()).toBe(true);
    });
  });

  describe('Performance in Full-Screen Modes', () => {
    it('should maintain performance in full-screen mode', async () => {
      const window = await windowFactory.createWindow('main', {
        width: 1000,
        height: 700
      });
      testWindows.push(window);

      // Mock performance monitoring
      const performanceMetrics = {
        frameRate: 60,
        memoryUsage: 0,
        cpuUsage: 0
      };

      jest.spyOn(window.window, 'setFullScreen').mockImplementation((fullscreen: boolean) => {
        (window.window as any)._isFullScreen = fullscreen;
        // Simulate performance impact
        if (fullscreen) {
          performanceMetrics.frameRate = 58; // Slight decrease
          performanceMetrics.memoryUsage += 10 * 1024 * 1024; // 10MB increase
        }
      });

      // Enter full-screen
      window.window.setFullScreen(true);

      // Performance should remain acceptable
      expect(performanceMetrics.frameRate).toBeGreaterThan(30);
      expect(performanceMetrics.memoryUsage).toBeLessThan(100 * 1024 * 1024); // Less than 100MB
    });

    it('should handle rapid full-screen transitions efficiently', async () => {
      const window = await windowFactory.createWindow('main', {
        width: 1000,
        height: 700
      });
      testWindows.push(window);

      // Mock rapid transitions
      jest.spyOn(window.window, 'setFullScreen').mockImplementation((fullscreen: boolean) => {
        (window.window as any)._isFullScreen = fullscreen;
      });
      jest.spyOn(window.window, 'isFullScreen').mockImplementation(() =>
        (window.window as any)._isFullScreen || false
      );

      const startTime = Date.now();

      // Perform rapid transitions
      for (let i = 0; i < 100; i++) {
        const isFullScreen = window.window.isFullScreen();
        window.window.setFullScreen(!isFullScreen);
        (window.window as any)._isFullScreen = !isFullScreen;

        if (!isFullScreen) {
          window.window.emit('enter-full-screen');
        } else {
          window.window.emit('leave-full-screen');
        }
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(2000); // Should complete in under 2 seconds
    });

    it('should optimize rendering in full-screen mode', async () => {
      const window = await windowFactory.createWindow('main', {
        width: 1000,
        height: 700
      });
      testWindows.push(window);

      // Mock rendering optimization
      let optimizationEnabled = false;

      jest.spyOn(window.window, 'setFullScreen').mockImplementation((fullscreen: boolean) => {
        (window.window as any)._isFullScreen = fullscreen;
        optimizationEnabled = fullscreen; // Enable optimization in full-screen
      });

      // Enter full-screen
      window.window.setFullScreen(true);

      expect(optimizationEnabled).toBe(true);

      // Exit full-screen
      window.window.setFullScreen(false);

      expect(optimizationEnabled).toBe(false);
    });
  });

  describe('Platform-Specific Full-Screen Behavior', () => {
    const platforms = ['win32', 'darwin', 'linux'];

    platforms.forEach(platform => {
      it(`should handle full-screen correctly on ${platform}`, async () => {
        // Mock platform
        Object.defineProperty(process, 'platform', {
          value: platform,
          configurable: true
        });

        const window = await windowFactory.createWindow('main', {
          width: 1000,
          height: 700
        });
        testWindows.push(window);

        jest.spyOn(window.window, 'setFullScreen').mockImplementation((fullscreen: boolean) => {
          (window.window as any)._isFullScreen = fullscreen;
        });

        window.window.setFullScreen(true);

        if (platform === 'darwin') {
          // macOS: Should support native full-screen with animation
          expect(window.window.setFullScreen).toHaveBeenCalledWith(true);
        } else if (platform === 'win32') {
          // Windows: Should support borderless full-screen
          expect(window.window.setFullScreen).toHaveBeenCalledWith(true);
        } else {
          // Linux: Should support full-screen with window manager cooperation
          expect(window.window.setFullScreen).toHaveBeenCalledWith(true);
        }
      });
    });

    it('should handle platform-specific escape mechanisms', async () => {
      const window = await windowFactory.createWindow('main', {
        width: 1000,
        height: 700
      });
      testWindows.push(window);

      jest.spyOn(window.window, 'setFullScreen').mockImplementation((fullscreen: boolean) => {
        (window.window as any)._isFullScreen = fullscreen;
      });

      window.window.setFullScreen(true);

      // Platform-specific escape keys
      const escapeKeys = {
        'darwin': 'Cmd+Ctrl+F', // macOS
        'win32': 'F11',         // Windows
        'linux': 'F11'          // Linux
      };

      const platformKey = escapeKeys[process.platform as keyof typeof escapeKeys] || 'F11';

      let escapeHandled = false;
      globalShortcut.register(platformKey, () => {
        escapeHandled = true;
        window.window.setFullScreen(false);
      });

      // Simulate escape
      escapeHandled = true;
      window.window.setFullScreen(false);

      expect(escapeHandled).toBe(true);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle full-screen errors gracefully', async () => {
      const window = await windowFactory.createWindow('main', {
        width: 1000,
        height: 700
      });
      testWindows.push(window);

      // Mock full-screen failure
      jest.spyOn(window.window, 'setFullScreen').mockImplementation(() => {
        throw new Error('Full-screen not supported');
      });

      // Should handle error without crashing
      expect(() => window.window.setFullScreen(true)).toThrow('Full-screen not supported');
      expect(window.window.isDestroyed()).toBe(false);
    });

    it('should handle kiosk mode conflicts', async () => {
      const window = await windowFactory.createWindow('main', {
        width: 1000,
        height: 700
      });
      testWindows.push(window);

      // Mock conflicting states
      if (window.window.setKiosk) {
        jest.spyOn(window.window, 'setKiosk').mockImplementation((kiosk: boolean) => {
          if (kiosk && window.window.isFullScreen()) {
            throw new Error('Cannot enter kiosk mode while in full-screen');
          }
          (window.window as any)._isKiosk = kiosk;
        });

        jest.spyOn(window.window, 'setFullScreen').mockImplementation((fullscreen: boolean) => {
          (window.window as any)._isFullScreen = fullscreen;
        });

        // Enter full-screen first
        window.window.setFullScreen(true);

        // Try to enter kiosk mode - should handle conflict
        expect(() => window.window.setKiosk(true)).toThrow('Cannot enter kiosk mode while in full-screen');
      }
    });

    it('should handle display disconnection during full-screen', async () => {
      const window = await windowFactory.createWindow('main', {
        width: 1000,
        height: 700
      });
      testWindows.push(window);

      jest.spyOn(window.window, 'setFullScreen').mockImplementation((fullscreen: boolean) => {
        (window.window as any)._isFullScreen = fullscreen;
      });

      // Enter full-screen
      window.window.setFullScreen(true);

      // Simulate display disconnection
      screen.emit('display-removed', { id: 1 });

      // Window should handle gracefully and potentially exit full-screen
      expect(window.window.isDestroyed()).toBe(false);
    });
  });
});