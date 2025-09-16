/**
 * Window State Management Integration Tests
 *
 * Tests comprehensive window state management including:
 * - Minimize, maximize, restore operations
 * - Window state persistence
 * - State transitions and validation
 * - Cross-platform state handling
 * - State recovery after crashes
 */

import { BrowserWindow, app, screen } from 'electron';
import { WindowStateManager } from '../../../src/main/windows/WindowStateManager';
import { WindowManager } from '../../../src/main/windows/WindowManager';
import { WindowFactory } from '../../../src/main/windows/WindowFactory';
import { WindowInstance, WindowState } from '../../../src/main/windows/types/WindowTypes';

// Mock setup
jest.mock('electron', () => require('../../__mocks__/electron'));

describe('Window State Management', () => {
  let windowStateManager: WindowStateManager;
  let windowManager: WindowManager;
  let windowFactory: WindowFactory;
  let mockContext: any;
  let testWindow: WindowInstance;

  beforeAll(async () => {
    await app.whenReady();
  });

  beforeEach(async () => {
    // Setup mock context
    mockContext = {
      config: {
        get: jest.fn((key: string) => {
          switch (key) {
            case 'window.persistState': return true;
            case 'window.statePath': return '/tmp/test-window-state.json';
            case 'window.restoreTimeout': return 5000;
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
    windowStateManager = new WindowStateManager(mockContext);
    windowManager = new WindowManager();
    windowFactory = new WindowFactory(mockContext);

    // Create test window
    testWindow = await windowFactory.createWindow('main', {
      title: 'Test Window',
      width: 1000,
      height: 700,
      x: 100,
      y: 100
    });

    jest.clearAllMocks();
  });

  afterEach(async () => {
    // Cleanup
    const windows = BrowserWindow.getAllWindows();
    for (const window of windows) {
      if (!window.isDestroyed()) {
        window.destroy();
      }
    }

    if (windowManager) {
      await windowManager.stop();
    }
  });

  describe('Window State Transitions', () => {
    it('should minimize window correctly', async () => {
      const window = testWindow.window;
      const minimizeSpy = jest.spyOn(window, 'minimize');

      window.minimize();
      window.emit('minimize');

      expect(minimizeSpy).toHaveBeenCalled();
      expect(window.isMinimized()).toBe(true);
    });

    it('should maximize window correctly', async () => {
      const window = testWindow.window;
      const maximizeSpy = jest.spyOn(window, 'maximize');

      window.maximize();
      window.emit('maximize');

      expect(maximizeSpy).toHaveBeenCalled();
      expect(window.isMaximized()).toBe(true);
    });

    it('should restore window from minimized state', async () => {
      const window = testWindow.window;

      // First minimize
      window.minimize();
      window.emit('minimize');
      expect(window.isMinimized()).toBe(true);

      // Then restore
      const restoreSpy = jest.spyOn(window, 'restore');
      window.restore();
      window.emit('restore');

      expect(restoreSpy).toHaveBeenCalled();
      expect(window.isMinimized()).toBe(false);
    });

    it('should restore window from maximized state', async () => {
      const window = testWindow.window;

      // First maximize
      window.maximize();
      window.emit('maximize');
      expect(window.isMaximized()).toBe(true);

      // Then unmaximize (restore)
      const unmaximizeSpy = jest.spyOn(window, 'unmaximize');
      window.unmaximize();
      window.emit('unmaximize');

      expect(unmaximizeSpy).toHaveBeenCalled();
      expect(window.isMaximized()).toBe(false);
    });

    it('should handle show/hide operations', async () => {
      const window = testWindow.window;

      // Hide window
      const hideSpy = jest.spyOn(window, 'hide');
      window.hide();
      window.emit('hide');

      expect(hideSpy).toHaveBeenCalled();
      expect(window.isVisible()).toBe(false);

      // Show window
      const showSpy = jest.spyOn(window, 'show');
      window.show();
      window.emit('show');

      expect(showSpy).toHaveBeenCalled();
      expect(window.isVisible()).toBe(true);
    });

    it('should track state changes correctly', async () => {
      const window = testWindow.window;
      const states: string[] = [];

      window.on('minimize', () => states.push('minimize'));
      window.on('maximize', () => states.push('maximize'));
      window.on('restore', () => states.push('restore'));
      window.on('unmaximize', () => states.push('unmaximize'));

      // Perform state changes
      window.minimize();
      window.emit('minimize');

      window.restore();
      window.emit('restore');

      window.maximize();
      window.emit('maximize');

      window.unmaximize();
      window.emit('unmaximize');

      expect(states).toEqual(['minimize', 'restore', 'maximize', 'unmaximize']);
    });
  });

  describe('Window State Persistence', () => {
    it('should save window state correctly', async () => {
      const window = testWindow.window;

      // Mock window bounds and state
      jest.spyOn(window, 'getBounds').mockReturnValue({
        x: 150,
        y: 200,
        width: 1200,
        height: 800
      });

      jest.spyOn(window, 'isMaximized').mockReturnValue(false);
      jest.spyOn(window, 'isMinimized').mockReturnValue(false);
      jest.spyOn(window, 'isFullScreen').mockReturnValue(false);

      const savedState = await windowStateManager.saveWindowState(testWindow.id, window);

      expect(savedState).toEqual({
        x: 150,
        y: 200,
        width: 1200,
        height: 800,
        isMaximized: false,
        isMinimized: false,
        isFullScreen: false,
        isVisible: true
      });
    });

    it('should restore window state correctly', async () => {
      const window = testWindow.window;

      const savedState: WindowState = {
        x: 300,
        y: 250,
        width: 1400,
        height: 900,
        isMaximized: true,
        isMinimized: false,
        isFullScreen: false,
        isVisible: true
      };

      const setBoundsSpy = jest.spyOn(window, 'setBounds');
      const maximizeSpy = jest.spyOn(window, 'maximize');

      await windowStateManager.restoreWindowState(testWindow.id, window, savedState);

      expect(setBoundsSpy).toHaveBeenCalledWith({
        x: 300,
        y: 250,
        width: 1400,
        height: 900
      });
      expect(maximizeSpy).toHaveBeenCalled();
    });

    it('should persist state across app restarts', async () => {
      const window = testWindow.window;

      // Save state
      jest.spyOn(window, 'getBounds').mockReturnValue({
        x: 400,
        y: 300,
        width: 1100,
        height: 750
      });

      const savedState = await windowStateManager.saveWindowState(testWindow.id, window);

      // Simulate app restart by creating new state manager
      const newStateManager = new WindowStateManager(mockContext);

      // The state should be retrievable
      const restoredState = await newStateManager.getWindowState(testWindow.id);
      expect(restoredState).toEqual(savedState);
    });

    it('should handle corrupted state files gracefully', async () => {
      // Mock corrupted state file
      jest.spyOn(require('fs'), 'readFileSync').mockImplementation(() => {
        throw new Error('Corrupted file');
      });

      const window = testWindow.window;
      const defaultState = await windowStateManager.restoreWindowState(testWindow.id, window);

      // Should use default state when file is corrupted
      expect(defaultState).toBeDefined();
      expect(mockContext.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to restore window state')
      );
    });

    it('should validate state bounds against screen dimensions', async () => {
      const window = testWindow.window;
      const display = screen.getPrimaryDisplay();

      // State that exceeds screen bounds
      const invalidState: WindowState = {
        x: display.bounds.width + 100,
        y: display.bounds.height + 100,
        width: 1200,
        height: 800,
        isMaximized: false,
        isMinimized: false,
        isFullScreen: false,
        isVisible: true
      };

      const setBoundsSpy = jest.spyOn(window, 'setBounds');

      await windowStateManager.restoreWindowState(testWindow.id, window, invalidState);

      // Should adjust bounds to fit screen
      const callArgs = setBoundsSpy.mock.calls[0][0];
      expect(callArgs.x).toBeLessThan(display.bounds.width);
      expect(callArgs.y).toBeLessThan(display.bounds.height);
    });
  });

  describe('Multi-Window State Management', () => {
    let secondWindow: WindowInstance;

    beforeEach(async () => {
      secondWindow = await windowFactory.createWindow('alert', {
        title: 'Second Window',
        width: 600,
        height: 400
      });
    });

    it('should manage multiple window states independently', async () => {
      const window1 = testWindow.window;
      const window2 = secondWindow.window;

      // Set different states
      window1.minimize();
      window1.emit('minimize');

      window2.maximize();
      window2.emit('maximize');

      expect(window1.isMinimized()).toBe(true);
      expect(window2.isMaximized()).toBe(true);
      expect(window1.isMaximized()).toBe(false);
      expect(window2.isMinimized()).toBe(false);
    });

    it('should save and restore multiple window states', async () => {
      const window1 = testWindow.window;
      const window2 = secondWindow.window;

      // Mock different bounds for each window
      jest.spyOn(window1, 'getBounds').mockReturnValue({
        x: 100, y: 100, width: 1000, height: 700
      });
      jest.spyOn(window2, 'getBounds').mockReturnValue({
        x: 200, y: 200, width: 600, height: 400
      });

      // Save states
      const state1 = await windowStateManager.saveWindowState(testWindow.id, window1);
      const state2 = await windowStateManager.saveWindowState(secondWindow.id, window2);

      expect(state1.x).toBe(100);
      expect(state2.x).toBe(200);
      expect(state1.width).toBe(1000);
      expect(state2.width).toBe(600);
    });

    it('should handle state conflicts between windows', async () => {
      const window1 = testWindow.window;
      const window2 = secondWindow.window;

      // Try to set overlapping bounds
      const bounds1 = { x: 100, y: 100, width: 800, height: 600 };
      const bounds2 = { x: 150, y: 150, width: 800, height: 600 };

      window1.setBounds(bounds1);
      window2.setBounds(bounds2);

      // Both should maintain their individual states
      expect(window1.getBounds()).toEqual(bounds1);
      expect(window2.getBounds()).toEqual(bounds2);
    });
  });

  describe('Cross-Platform State Handling', () => {
    const platforms = ['win32', 'darwin', 'linux'];

    platforms.forEach(platform => {
      it(`should handle state correctly on ${platform}`, async () => {
        // Mock platform
        Object.defineProperty(process, 'platform', {
          value: platform,
          configurable: true
        });

        const window = testWindow.window;

        // Platform-specific behavior
        if (platform === 'darwin') {
          // macOS specific: minimize to dock
          window.minimize();
          expect(window.isMinimized()).toBe(true);
        } else if (platform === 'win32') {
          // Windows specific: minimize to taskbar
          window.minimize();
          expect(window.isMinimized()).toBe(true);
        } else {
          // Linux specific behavior
          window.minimize();
          expect(window.isMinimized()).toBe(true);
        }
      });
    });

    it('should handle platform-specific maximization behavior', async () => {
      const window = testWindow.window;

      if (process.platform === 'darwin') {
        // macOS: maximize should not cover dock/menu bar
        window.maximize();
        const bounds = window.getBounds();
        // Should account for menu bar and dock
        expect(bounds.y).toBeGreaterThan(0);
      } else {
        // Windows/Linux: can maximize to full screen
        window.maximize();
        expect(window.isMaximized()).toBe(true);
      }
    });

    it('should adapt to different screen DPI settings', async () => {
      const window = testWindow.window;

      // Mock high DPI display
      jest.spyOn(screen, 'getPrimaryDisplay').mockReturnValue({
        id: 1,
        bounds: { x: 0, y: 0, width: 3840, height: 2160 },
        workAreaSize: { width: 3840, height: 2160 },
        scaleFactor: 2.0,
        internal: false,
        accelerometerSupport: 'unknown',
        colorDepth: 24,
        colorSpace: 'srgb',
        depthPerComponent: 8,
        displayFrequency: 60,
        maximumCursorSize: { width: 64, height: 64 },
        monochrome: false,
        nativeOrigin: { x: 0, y: 0 },
        rotation: 0,
        size: { width: 1920, height: 1080 },
        touchSupport: 'unknown',
        workArea: { x: 0, y: 0, width: 3840, height: 2160 }
      });

      const state: WindowState = {
        x: 100,
        y: 100,
        width: 1200,
        height: 800,
        isMaximized: false,
        isMinimized: false,
        isFullScreen: false,
        isVisible: true
      };

      await windowStateManager.restoreWindowState(testWindow.id, window, state);

      // State should be applied correctly considering DPI scaling
      expect(window.getBounds().width).toBe(1200);
      expect(window.getBounds().height).toBe(800);
    });
  });

  describe('State Recovery and Error Handling', () => {
    it('should recover from invalid state transitions', async () => {
      const window = testWindow.window;

      // Try invalid transition (minimize already minimized window)
      window.minimize();
      window.emit('minimize');
      expect(window.isMinimized()).toBe(true);

      // Try to minimize again
      window.minimize(); // Should not cause error
      expect(window.isMinimized()).toBe(true);
    });

    it('should handle window state corruption', async () => {
      const window = testWindow.window;

      // Simulate corrupted state
      const corruptedState: any = {
        x: 'invalid',
        y: null,
        width: -100,
        height: 'not-a-number',
        isMaximized: 'maybe',
        isMinimized: null
      };

      // Should handle gracefully and use defaults
      await expect(
        windowStateManager.restoreWindowState(testWindow.id, window, corruptedState)
      ).resolves.toBeDefined();

      expect(mockContext.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid window state')
      );
    });

    it('should recover after window crashes', async () => {
      const window = testWindow.window;

      // Save state before crash
      const savedState = await windowStateManager.saveWindowState(testWindow.id, window);

      // Simulate crash
      window.webContents.emit('crashed');

      // Create new window with same ID
      const newWindow = await windowFactory.createWindow('main');

      // Should be able to restore previous state
      await windowStateManager.restoreWindowState(newWindow.id, newWindow.window, savedState);

      expect(newWindow.window.getBounds()).toEqual(savedState);
    });

    it('should handle display configuration changes', async () => {
      const window = testWindow.window;

      // Save state on primary display
      const initialState = await windowStateManager.saveWindowState(testWindow.id, window);

      // Simulate display removal
      screen.emit('display-removed', { id: 1 });

      // Window should be moved to available display
      const newBounds = window.getBounds();
      expect(newBounds.x).toBeGreaterThanOrEqual(0);
      expect(newBounds.y).toBeGreaterThanOrEqual(0);
    });

    it('should timeout on unresponsive state operations', async () => {
      jest.useFakeTimers();

      const window = testWindow.window;

      // Mock slow state operation
      jest.spyOn(window, 'setBounds').mockImplementation(() => {
        // Simulate hang
        return new Promise(() => {});
      });

      const restorePromise = windowStateManager.restoreWindowState(
        testWindow.id,
        window,
        {
          x: 100, y: 100, width: 800, height: 600,
          isMaximized: false, isMinimized: false, isFullScreen: false, isVisible: true
        }
      );

      // Advance time past timeout
      jest.advanceTimersByTime(6000);

      await expect(restorePromise).resolves.toBeDefined();

      jest.useRealTimers();
    });
  });

  describe('State Performance', () => {
    it('should handle rapid state changes efficiently', async () => {
      const window = testWindow.window;
      const startTime = Date.now();

      // Perform rapid state changes
      for (let i = 0; i < 100; i++) {
        if (i % 2 === 0) {
          window.minimize();
          window.emit('minimize');
        } else {
          window.restore();
          window.emit('restore');
        }
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000); // Should complete in under 1 second
    });

    it('should batch state save operations', async () => {
      const window = testWindow.window;
      const saveSpy = jest.spyOn(windowStateManager, 'saveWindowState');

      // Trigger multiple rapid state changes
      window.emit('resize');
      window.emit('move');
      window.emit('resize');
      window.emit('move');

      // Should batch operations to avoid excessive I/O
      expect(saveSpy.mock.calls.length).toBeLessThanOrEqual(2);
    });

    it('should limit state history size', async () => {
      const window = testWindow.window;

      // Generate many state changes
      for (let i = 0; i < 1000; i++) {
        await windowStateManager.saveWindowState(testWindow.id, window);
      }

      // History should be limited to prevent memory issues
      const stateHistory = await windowStateManager.getStateHistory(testWindow.id);
      expect(stateHistory.length).toBeLessThanOrEqual(100);
    });
  });
});