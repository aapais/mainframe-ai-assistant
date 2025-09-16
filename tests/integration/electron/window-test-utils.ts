/**
 * Window Testing Utilities and Helpers
 *
 * Comprehensive utilities for testing Electron window management including:
 * - Window creation helpers
 * - Mock factories and builders
 * - Assertion utilities
 * - Performance measurement tools
 * - Cross-platform testing helpers
 * - State verification utilities
 */

import { BrowserWindow, app, screen, Display, Rectangle } from 'electron';
import { EventEmitter } from 'events';
import { WindowInstance, WindowType, WindowConfig, WindowState } from '../../../src/main/windows/types/WindowTypes';

export interface TestWindowOptions {
  type?: WindowType;
  config?: Partial<WindowConfig>;
  autoCleanup?: boolean;
  mockBehavior?: Partial<MockWindowBehavior>;
}

export interface MockWindowBehavior {
  isDestroyed: boolean;
  isVisible: boolean;
  isMinimized: boolean;
  isMaximized: boolean;
  isFullScreen: boolean;
  isFocused: boolean;
  bounds: Rectangle;
  title: string;
}

export interface WindowTestMetrics {
  creationTime: number;
  destructionTime: number;
  stateChangeTime: number;
  memoryUsage: number;
  eventCount: number;
}

export interface PlatformTestConfig {
  platform: NodeJS.Platform;
  displays: Display[];
  scaleFactor: number;
  workAreaOffset: { x: number; y: number };
}

/**
 * Window Test Factory
 * Creates and manages test windows with automatic cleanup
 */
export class WindowTestFactory {
  private static instance: WindowTestFactory;
  private createdWindows: Set<WindowInstance> = new Set();
  private windowMetrics: Map<string, WindowTestMetrics> = new Map();

  static getInstance(): WindowTestFactory {
    if (!WindowTestFactory.instance) {
      WindowTestFactory.instance = new WindowTestFactory();
    }
    return WindowTestFactory.instance;
  }

  /**
   * Create a test window with specified options
   */
  async createTestWindow(options: TestWindowOptions = {}): Promise<WindowInstance> {
    const startTime = performance.now();

    const defaultConfig: WindowConfig = {
      type: options.type || 'main',
      title: `Test Window ${Date.now()}`,
      width: 800,
      height: 600,
      x: 100,
      y: 100,
      resizable: true,
      minimizable: true,
      maximizable: true,
      closable: true,
      alwaysOnTop: false,
      fullscreen: false,
      kiosk: false,
      modal: false,
      show: true,
      autoHideMenuBar: false,
      frame: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false,
        webSecurity: true
      },
      ...options.config
    };

    const windowInstance = await this.createMockWindowInstance(defaultConfig, options.mockBehavior);

    if (options.autoCleanup !== false) {
      this.createdWindows.add(windowInstance);
    }

    const creationTime = performance.now() - startTime;
    this.windowMetrics.set(windowInstance.id, {
      creationTime,
      destructionTime: 0,
      stateChangeTime: 0,
      memoryUsage: process.memoryUsage().heapUsed,
      eventCount: 0
    });

    return windowInstance;
  }

  /**
   * Create multiple test windows concurrently
   */
  async createMultipleWindows(count: number, options: TestWindowOptions = {}): Promise<WindowInstance[]> {
    const promises = Array.from({ length: count }, (_, i) =>
      this.createTestWindow({
        ...options,
        config: {
          title: `Test Window ${i + 1}`,
          ...options.config
        }
      })
    );

    return Promise.all(promises);
  }

  /**
   * Create a mock window instance with specified behavior
   */
  private async createMockWindowInstance(
    config: WindowConfig,
    mockBehavior?: Partial<MockWindowBehavior>
  ): Promise<WindowInstance> {
    const id = `test-window-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const defaultBehavior: MockWindowBehavior = {
      isDestroyed: false,
      isVisible: true,
      isMinimized: false,
      isMaximized: false,
      isFullScreen: false,
      isFocused: false,
      bounds: { x: config.x || 0, y: config.y || 0, width: config.width, height: config.height },
      title: config.title
    };

    const behavior = { ...defaultBehavior, ...mockBehavior };

    const mockWindow = this.createMockBrowserWindow(behavior);

    return {
      id,
      type: config.type,
      window: mockWindow,
      config,
      metadata: {
        createdAt: new Date(),
        platform: process.platform,
        version: '1.0.0'
      }
    };
  }

  /**
   * Create a mock BrowserWindow with realistic behavior
   */
  private createMockBrowserWindow(behavior: MockWindowBehavior): jest.Mocked<BrowserWindow> {
    const mockWindow = new BrowserWindow() as jest.Mocked<BrowserWindow>;
    let currentBehavior = { ...behavior };

    // Mock methods with state tracking
    mockWindow.isDestroyed = jest.fn(() => currentBehavior.isDestroyed);
    mockWindow.isVisible = jest.fn(() => currentBehavior.isVisible);
    mockWindow.isMinimized = jest.fn(() => currentBehavior.isMinimized);
    mockWindow.isMaximized = jest.fn(() => currentBehavior.isMaximized);
    mockWindow.isFullScreen = jest.fn(() => currentBehavior.isFullScreen);
    mockWindow.isFocused = jest.fn(() => currentBehavior.isFocused);

    mockWindow.getBounds = jest.fn(() => currentBehavior.bounds);
    mockWindow.getTitle = jest.fn(() => currentBehavior.title);

    // State changing methods
    mockWindow.minimize = jest.fn(() => {
      currentBehavior.isMinimized = true;
      currentBehavior.isMaximized = false;
      mockWindow.emit('minimize');
    });

    mockWindow.maximize = jest.fn(() => {
      currentBehavior.isMaximized = true;
      currentBehavior.isMinimized = false;
      const display = screen.getPrimaryDisplay();
      currentBehavior.bounds = {
        x: 0,
        y: 0,
        width: display.workAreaSize.width,
        height: display.workAreaSize.height
      };
      mockWindow.emit('maximize');
    });

    mockWindow.restore = jest.fn(() => {
      currentBehavior.isMinimized = false;
      currentBehavior.isMaximized = false;
      mockWindow.emit('restore');
    });

    mockWindow.unmaximize = jest.fn(() => {
      currentBehavior.isMaximized = false;
      mockWindow.emit('unmaximize');
    });

    mockWindow.show = jest.fn(() => {
      currentBehavior.isVisible = true;
      mockWindow.emit('show');
    });

    mockWindow.hide = jest.fn(() => {
      currentBehavior.isVisible = false;
      mockWindow.emit('hide');
    });

    mockWindow.focus = jest.fn(() => {
      currentBehavior.isFocused = true;
      mockWindow.emit('focus');
    });

    mockWindow.blur = jest.fn(() => {
      currentBehavior.isFocused = false;
      mockWindow.emit('blur');
    });

    mockWindow.close = jest.fn(() => {
      mockWindow.emit('close', { preventDefault: jest.fn() });
    });

    mockWindow.destroy = jest.fn(() => {
      currentBehavior.isDestroyed = true;
      mockWindow.emit('closed');
    });

    mockWindow.setFullScreen = jest.fn((fullscreen: boolean) => {
      currentBehavior.isFullScreen = fullscreen;
      if (fullscreen) {
        mockWindow.emit('enter-full-screen');
      } else {
        mockWindow.emit('leave-full-screen');
      }
    });

    mockWindow.setBounds = jest.fn((bounds: Partial<Rectangle>) => {
      currentBehavior.bounds = { ...currentBehavior.bounds, ...bounds };
      mockWindow.emit('resize');
      mockWindow.emit('move');
    });

    mockWindow.setTitle = jest.fn((title: string) => {
      currentBehavior.title = title;
    });

    // Additional mock methods
    mockWindow.loadFile = jest.fn().mockResolvedValue();
    mockWindow.loadURL = jest.fn().mockResolvedValue();
    mockWindow.reload = jest.fn();
    mockWindow.setMenuBarVisibility = jest.fn();
    mockWindow.setAlwaysOnTop = jest.fn();

    return mockWindow;
  }

  /**
   * Cleanup all created test windows
   */
  async cleanup(): Promise<void> {
    const cleanupPromises = Array.from(this.createdWindows).map(async (windowInstance) => {
      const startTime = performance.now();

      if (!windowInstance.window.isDestroyed()) {
        windowInstance.window.removeAllListeners();
        windowInstance.window.destroy();
      }

      const destructionTime = performance.now() - startTime;
      const metrics = this.windowMetrics.get(windowInstance.id);
      if (metrics) {
        metrics.destructionTime = destructionTime;
      }
    });

    await Promise.all(cleanupPromises);
    this.createdWindows.clear();
  }

  /**
   * Get performance metrics for a window
   */
  getMetrics(windowId: string): WindowTestMetrics | undefined {
    return this.windowMetrics.get(windowId);
  }

  /**
   * Get all collected metrics
   */
  getAllMetrics(): Map<string, WindowTestMetrics> {
    return new Map(this.windowMetrics);
  }

  /**
   * Reset all metrics
   */
  resetMetrics(): void {
    this.windowMetrics.clear();
  }
}

/**
 * Platform Test Helper
 * Provides utilities for testing across different platforms
 */
export class PlatformTestHelper {
  private static originalPlatform: NodeJS.Platform;

  /**
   * Mock a specific platform for testing
   */
  static mockPlatform(platform: NodeJS.Platform): void {
    if (!PlatformTestHelper.originalPlatform) {
      PlatformTestHelper.originalPlatform = process.platform;
    }

    Object.defineProperty(process, 'platform', {
      value: platform,
      configurable: true
    });
  }

  /**
   * Restore original platform
   */
  static restorePlatform(): void {
    if (PlatformTestHelper.originalPlatform) {
      Object.defineProperty(process, 'platform', {
        value: PlatformTestHelper.originalPlatform,
        configurable: true
      });
    }
  }

  /**
   * Get platform-specific test configuration
   */
  static getPlatformConfig(platform: NodeJS.Platform): PlatformTestConfig {
    const configs: Record<NodeJS.Platform, PlatformTestConfig> = {
      win32: {
        platform: 'win32',
        displays: [
          {
            id: 1,
            bounds: { x: 0, y: 0, width: 1920, height: 1080 },
            workAreaSize: { width: 1920, height: 1040 },
            scaleFactor: 1.0
          } as Display
        ],
        scaleFactor: 1.0,
        workAreaOffset: { x: 0, y: 40 }
      },
      darwin: {
        platform: 'darwin',
        displays: [
          {
            id: 1,
            bounds: { x: 0, y: 0, width: 2560, height: 1600 },
            workAreaSize: { width: 2560, height: 1577 },
            scaleFactor: 2.0
          } as Display
        ],
        scaleFactor: 2.0,
        workAreaOffset: { x: 0, y: 23 }
      },
      linux: {
        platform: 'linux',
        displays: [
          {
            id: 1,
            bounds: { x: 0, y: 0, width: 1920, height: 1080 },
            workAreaSize: { width: 1920, height: 1056 },
            scaleFactor: 1.0
          } as Display
        ],
        scaleFactor: 1.0,
        workAreaOffset: { x: 0, y: 24 }
      },
      // Add other platforms as needed
      aix: { platform: 'aix', displays: [], scaleFactor: 1.0, workAreaOffset: { x: 0, y: 0 } },
      android: { platform: 'android', displays: [], scaleFactor: 1.0, workAreaOffset: { x: 0, y: 0 } },
      freebsd: { platform: 'freebsd', displays: [], scaleFactor: 1.0, workAreaOffset: { x: 0, y: 0 } },
      haiku: { platform: 'haiku', displays: [], scaleFactor: 1.0, workAreaOffset: { x: 0, y: 0 } },
      openbsd: { platform: 'openbsd', displays: [], scaleFactor: 1.0, workAreaOffset: { x: 0, y: 0 } },
      sunos: { platform: 'sunos', displays: [], scaleFactor: 1.0, workAreaOffset: { x: 0, y: 0 } },
      cygwin: { platform: 'cygwin', displays: [], scaleFactor: 1.0, workAreaOffset: { x: 0, y: 0 } },
      netbsd: { platform: 'netbsd', displays: [], scaleFactor: 1.0, workAreaOffset: { x: 0, y: 0 } }
    };

    return configs[platform];
  }

  /**
   * Test across all supported platforms
   */
  static async testAcrossPlatforms<T>(
    testFn: (platform: NodeJS.Platform) => Promise<T>
  ): Promise<Record<string, T>> {
    const platforms: NodeJS.Platform[] = ['win32', 'darwin', 'linux'];
    const results: Record<string, T> = {};

    for (const platform of platforms) {
      PlatformTestHelper.mockPlatform(platform);
      try {
        results[platform] = await testFn(platform);
      } finally {
        PlatformTestHelper.restorePlatform();
      }
    }

    return results;
  }
}

/**
 * Window State Assertion Utilities
 */
export class WindowStateAssertions {
  /**
   * Assert window is in expected state
   */
  static assertWindowState(window: BrowserWindow, expectedState: Partial<MockWindowBehavior>): void {
    if (expectedState.isDestroyed !== undefined) {
      expect(window.isDestroyed()).toBe(expectedState.isDestroyed);
    }
    if (expectedState.isVisible !== undefined) {
      expect(window.isVisible()).toBe(expectedState.isVisible);
    }
    if (expectedState.isMinimized !== undefined) {
      expect(window.isMinimized()).toBe(expectedState.isMinimized);
    }
    if (expectedState.isMaximized !== undefined) {
      expect(window.isMaximized()).toBe(expectedState.isMaximized);
    }
    if (expectedState.isFullScreen !== undefined) {
      expect(window.isFullScreen()).toBe(expectedState.isFullScreen);
    }
    if (expectedState.isFocused !== undefined) {
      expect(window.isFocused()).toBe(expectedState.isFocused);
    }
    if (expectedState.bounds !== undefined) {
      expect(window.getBounds()).toEqual(expectedState.bounds);
    }
    if (expectedState.title !== undefined) {
      expect(window.getTitle()).toBe(expectedState.title);
    }
  }

  /**
   * Assert window bounds are within display bounds
   */
  static assertWindowWithinDisplay(window: BrowserWindow, display?: Display): void {
    const bounds = window.getBounds();
    const targetDisplay = display || screen.getPrimaryDisplay();

    expect(bounds.x).toBeGreaterThanOrEqual(targetDisplay.bounds.x);
    expect(bounds.y).toBeGreaterThanOrEqual(targetDisplay.bounds.y);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(
      targetDisplay.bounds.x + targetDisplay.bounds.width
    );
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(
      targetDisplay.bounds.y + targetDisplay.bounds.height
    );
  }

  /**
   * Assert window state persistence
   */
  static assertStatePersistence(
    originalState: WindowState,
    restoredWindow: BrowserWindow
  ): void {
    const bounds = restoredWindow.getBounds();

    expect(bounds.x).toBe(originalState.x);
    expect(bounds.y).toBe(originalState.y);
    expect(bounds.width).toBe(originalState.width);
    expect(bounds.height).toBe(originalState.height);
    expect(restoredWindow.isMaximized()).toBe(originalState.isMaximized);
    expect(restoredWindow.isMinimized()).toBe(originalState.isMinimized);
    expect(restoredWindow.isFullScreen()).toBe(originalState.isFullScreen);
  }

  /**
   * Assert windows don't overlap
   */
  static assertNoOverlap(window1: BrowserWindow, window2: BrowserWindow): void {
    const bounds1 = window1.getBounds();
    const bounds2 = window2.getBounds();

    const noOverlap = (
      bounds1.x + bounds1.width <= bounds2.x ||
      bounds2.x + bounds2.width <= bounds1.x ||
      bounds1.y + bounds1.height <= bounds2.y ||
      bounds2.y + bounds2.height <= bounds1.y
    );

    expect(noOverlap).toBe(true);
  }
}

/**
 * Performance Test Utilities
 */
export class PerformanceTestHelper {
  private static measurements: Map<string, number[]> = new Map();

  /**
   * Measure execution time of a function
   */
  static async measureTime<T>(
    name: string,
    fn: () => Promise<T> | T
  ): Promise<{ result: T; duration: number }> {
    const startTime = performance.now();
    const result = await fn();
    const duration = performance.now() - startTime;

    if (!PerformanceTestHelper.measurements.has(name)) {
      PerformanceTestHelper.measurements.set(name, []);
    }
    PerformanceTestHelper.measurements.get(name)!.push(duration);

    return { result, duration };
  }

  /**
   * Get performance statistics for a measurement
   */
  static getStats(name: string): {
    count: number;
    total: number;
    average: number;
    min: number;
    max: number;
    p95: number;
  } | null {
    const measurements = PerformanceTestHelper.measurements.get(name);
    if (!measurements || measurements.length === 0) {
      return null;
    }

    const sorted = [...measurements].sort((a, b) => a - b);
    const total = measurements.reduce((sum, val) => sum + val, 0);

    return {
      count: measurements.length,
      total,
      average: total / measurements.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p95: sorted[Math.floor(sorted.length * 0.95)]
    };
  }

  /**
   * Assert performance meets expectations
   */
  static assertPerformance(
    name: string,
    expectations: {
      maxAverage?: number;
      maxP95?: number;
      maxSingle?: number;
    }
  ): void {
    const stats = PerformanceTestHelper.getStats(name);
    expect(stats).not.toBeNull();

    if (expectations.maxAverage !== undefined) {
      expect(stats!.average).toBeLessThan(expectations.maxAverage);
    }
    if (expectations.maxP95 !== undefined) {
      expect(stats!.p95).toBeLessThan(expectations.maxP95);
    }
    if (expectations.maxSingle !== undefined) {
      expect(stats!.max).toBeLessThan(expectations.maxSingle);
    }
  }

  /**
   * Clear all measurements
   */
  static clearMeasurements(): void {
    PerformanceTestHelper.measurements.clear();
  }
}

/**
 * Event Testing Utilities
 */
export class EventTestHelper {
  /**
   * Wait for a specific event to be emitted
   */
  static waitForEvent<T = any>(
    emitter: EventEmitter,
    eventName: string,
    timeout = 5000
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Event '${eventName}' not emitted within ${timeout}ms`));
      }, timeout);

      emitter.once(eventName, (data: T) => {
        clearTimeout(timeoutId);
        resolve(data);
      });
    });
  }

  /**
   * Collect multiple events
   */
  static collectEvents<T = any>(
    emitter: EventEmitter,
    eventName: string,
    count: number,
    timeout = 5000
  ): Promise<T[]> {
    return new Promise((resolve, reject) => {
      const events: T[] = [];
      const timeoutId = setTimeout(() => {
        reject(new Error(`Only ${events.length}/${count} events collected within ${timeout}ms`));
      }, timeout);

      const handler = (data: T) => {
        events.push(data);
        if (events.length >= count) {
          clearTimeout(timeoutId);
          emitter.removeListener(eventName, handler);
          resolve(events);
        }
      };

      emitter.on(eventName, handler);
    });
  }

  /**
   * Assert event sequence
   */
  static async assertEventSequence(
    emitter: EventEmitter,
    expectedSequence: string[],
    timeout = 5000
  ): Promise<void> {
    const actualSequence: string[] = [];
    const handlers: Record<string, Function> = {};

    // Set up listeners for all expected events
    expectedSequence.forEach(eventName => {
      if (!handlers[eventName]) {
        handlers[eventName] = () => actualSequence.push(eventName);
        emitter.on(eventName, handlers[eventName]);
      }
    });

    // Wait for sequence completion or timeout
    const startTime = Date.now();
    while (actualSequence.length < expectedSequence.length) {
      if (Date.now() - startTime > timeout) {
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    // Cleanup listeners
    Object.entries(handlers).forEach(([eventName, handler]) => {
      emitter.removeListener(eventName, handler);
    });

    expect(actualSequence).toEqual(expectedSequence);
  }
}

// Export singleton instance
export const windowTestFactory = WindowTestFactory.getInstance();