/**
 * Window Positioning and Display Management Tests
 *
 * Tests comprehensive window positioning and display handling including:
 * - Window positioning across multiple displays
 * - Display detection and management
 * - Window bounds validation and adjustment
 * - DPI scaling and high-resolution display support
 * - Display configuration changes
 * - Window persistence across display changes
 */

import { BrowserWindow, app, screen, Display } from 'electron';
import { WindowManager } from '../../../src/main/windows/WindowManager';
import { WindowFactory } from '../../../src/main/windows/WindowFactory';
import { WindowStateManager } from '../../../src/main/windows/WindowStateManager';
import { WindowInstance, WindowState } from '../../../src/main/windows/types/WindowTypes';

// Mock setup
jest.mock('electron', () => require('../../__mocks__/electron'));

describe('Window Positioning and Display Management', () => {
  let windowManager: WindowManager;
  let windowFactory: WindowFactory;
  let windowStateManager: WindowStateManager;
  let mockContext: any;
  let testWindows: WindowInstance[] = [];

  // Mock display configurations
  const mockDisplays: Display[] = [
    {
      id: 1,
      bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      workAreaSize: { width: 1920, height: 1040 },
      scaleFactor: 1.0,
      internal: true,
      accelerometerSupport: 'unknown',
      colorDepth: 24,
      colorSpace: 'srgb',
      depthPerComponent: 8,
      displayFrequency: 60,
      maximumCursorSize: { width: 32, height: 32 },
      monochrome: false,
      nativeOrigin: { x: 0, y: 0 },
      rotation: 0,
      size: { width: 1920, height: 1080 },
      touchSupport: 'unknown',
      workArea: { x: 0, y: 40, width: 1920, height: 1040 }
    },
    {
      id: 2,
      bounds: { x: 1920, y: 0, width: 2560, height: 1440 },
      workAreaSize: { width: 2560, height: 1400 },
      scaleFactor: 1.25,
      internal: false,
      accelerometerSupport: 'unknown',
      colorDepth: 24,
      colorSpace: 'srgb',
      depthPerComponent: 8,
      displayFrequency: 144,
      maximumCursorSize: { width: 40, height: 40 },
      monochrome: false,
      nativeOrigin: { x: 1920, y: 0 },
      rotation: 0,
      size: { width: 2048, height: 1152 },
      touchSupport: 'unknown',
      workArea: { x: 1920, y: 40, width: 2560, height: 1400 }
    },
    {
      id: 3,
      bounds: { x: 0, y: 1080, width: 1920, height: 1080 },
      workAreaSize: { width: 1920, height: 1040 },
      scaleFactor: 2.0,
      internal: false,
      accelerometerSupport: 'unknown',
      colorDepth: 24,
      colorSpace: 'srgb',
      depthPerComponent: 8,
      displayFrequency: 60,
      maximumCursorSize: { width: 64, height: 64 },
      monochrome: false,
      nativeOrigin: { x: 0, y: 1080 },
      rotation: 0,
      size: { width: 960, height: 540 },
      touchSupport: 'unknown',
      workArea: { x: 0, y: 1120, width: 1920, height: 1040 }
    }
  ];

  beforeAll(async () => {
    await app.whenReady();
  });

  beforeEach(async () => {
    // Setup mock context
    mockContext = {
      config: {
        get: jest.fn((key: string) => {
          switch (key) {
            case 'window.positioning.smart': return true;
            case 'window.positioning.cascade': return true;
            case 'window.positioning.centerOnDisplay': return true;
            case 'window.bounds.validation': return true;
            case 'window.dpi.aware': return true;
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

    // Mock screen API
    jest.spyOn(screen, 'getAllDisplays').mockReturnValue(mockDisplays);
    jest.spyOn(screen, 'getPrimaryDisplay').mockReturnValue(mockDisplays[0]);

    testWindows = [];
    jest.clearAllMocks();
  });

  afterEach(async () => {
    // Cleanup
    for (const windowInstance of testWindows) {
      if (windowInstance?.window && !windowInstance.window.isDestroyed()) {
        windowInstance.window.destroy();
      }
    }
    testWindows = [];

    if (windowManager) {
      await windowManager.stop();
    }
  });

  describe('Single Display Positioning', () => {
    beforeEach(() => {
      // Use only primary display
      jest.spyOn(screen, 'getAllDisplays').mockReturnValue([mockDisplays[0]]);
    });

    it('should position window in center of display by default', async () => {
      const window = await windowFactory.createWindow('main', {
        width: 800,
        height: 600
      });

      testWindows.push(window);

      const display = mockDisplays[0];
      const expectedX = display.workArea.x + (display.workArea.width - 800) / 2;
      const expectedY = display.workArea.y + (display.workArea.height - 600) / 2;

      // Should be positioned in center of work area
      expect(window.config.x).toBeCloseTo(expectedX, 0);
      expect(window.config.y).toBeCloseTo(expectedY, 0);
    });

    it('should validate window bounds against display boundaries', async () => {
      const display = mockDisplays[0];

      // Try to create window outside display bounds
      const window = await windowFactory.createWindow('main', {
        x: display.bounds.width + 100,
        y: display.bounds.height + 100,
        width: 800,
        height: 600
      });

      testWindows.push(window);

      // Should be adjusted to fit within display
      expect(window.config.x).toBeLessThan(display.workArea.width);
      expect(window.config.y).toBeLessThan(display.workArea.height);
    });

    it('should handle window larger than display', async () => {
      const display = mockDisplays[0];

      const window = await windowFactory.createWindow('main', {
        width: display.workArea.width + 200,
        height: display.workArea.height + 200
      });

      testWindows.push(window);

      // Should be constrained to display size
      expect(window.config.width).toBeLessThanOrEqual(display.workArea.width);
      expect(window.config.height).toBeLessThanOrEqual(display.workArea.height);
    });

    it('should cascade multiple windows correctly', async () => {
      const windows = await Promise.all([
        windowFactory.createWindow('main', { width: 600, height: 400 }),
        windowFactory.createWindow('main', { width: 600, height: 400 }),
        windowFactory.createWindow('main', { width: 600, height: 400 })
      ]);

      testWindows.push(...windows);

      // Each window should be offset from the previous
      const cascadeOffset = 30;
      expect(windows[1].config.x).toBe(windows[0].config.x! + cascadeOffset);
      expect(windows[1].config.y).toBe(windows[0].config.y! + cascadeOffset);
      expect(windows[2].config.x).toBe(windows[1].config.x! + cascadeOffset);
      expect(windows[2].config.y).toBe(windows[1].config.y! + cascadeOffset);
    });

    it('should respect minimum window size constraints', async () => {
      const window = await windowFactory.createWindow('main', {
        width: 100, // Very small
        height: 50,  // Very small
        minWidth: 400,
        minHeight: 300
      });

      testWindows.push(window);

      expect(window.config.width).toBe(400);
      expect(window.config.height).toBe(300);
    });

    it('should handle negative coordinates gracefully', async () => {
      const window = await windowFactory.createWindow('main', {
        x: -100,
        y: -50,
        width: 800,
        height: 600
      });

      testWindows.push(window);

      // Should be adjusted to positive coordinates
      expect(window.config.x).toBeGreaterThanOrEqual(0);
      expect(window.config.y).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Multi-Display Positioning', () => {
    beforeEach(() => {
      // Use all mock displays
      jest.spyOn(screen, 'getAllDisplays').mockReturnValue(mockDisplays);
    });

    it('should detect multiple displays correctly', async () => {
      const displays = screen.getAllDisplays();
      expect(displays).toHaveLength(3);
      expect(displays.map(d => d.id)).toEqual([1, 2, 3]);
    });

    it('should position windows on specific displays', async () => {
      const secondaryDisplay = mockDisplays[1];

      const window = await windowFactory.createWindow('main', {
        x: secondaryDisplay.bounds.x + 100,
        y: secondaryDisplay.bounds.y + 100,
        width: 800,
        height: 600
      });

      testWindows.push(window);

      // Should be positioned on secondary display
      expect(window.config.x).toBeGreaterThanOrEqual(secondaryDisplay.bounds.x);
      expect(window.config.x).toBeLessThan(secondaryDisplay.bounds.x + secondaryDisplay.bounds.width);
    });

    it('should handle display-specific DPI scaling', async () => {
      const highDPIDisplay = mockDisplays[2]; // Scale factor 2.0

      const window = await windowFactory.createWindow('main', {
        x: highDPIDisplay.bounds.x + 100,
        y: highDPIDisplay.bounds.y + 100,
        width: 800,
        height: 600
      });

      testWindows.push(window);

      // Window should account for DPI scaling
      const scaleFactor = highDPIDisplay.scaleFactor;
      expect(window.config.width).toBe(800);
      expect(window.config.height).toBe(600);
    });

    it('should distribute windows across displays intelligently', async () => {
      const windows = await Promise.all([
        windowFactory.createWindow('main', { width: 600, height: 400 }),
        windowFactory.createWindow('main', { width: 600, height: 400 }),
        windowFactory.createWindow('main', { width: 600, height: 400 }),
        windowFactory.createWindow('main', { width: 600, height: 400 }),
        windowFactory.createWindow('main', { width: 600, height: 400 })
      ]);

      testWindows.push(...windows);

      // Windows should be distributed across available displays
      const displayAssignments = windows.map(window => {
        return mockDisplays.findIndex(display =>
          window.config.x! >= display.bounds.x &&
          window.config.x! < display.bounds.x + display.bounds.width
        );
      });

      // Should use multiple displays
      const uniqueDisplays = new Set(displayAssignments);
      expect(uniqueDisplays.size).toBeGreaterThan(1);
    });

    it('should handle windows spanning multiple displays', async () => {
      const display1 = mockDisplays[0];
      const display2 = mockDisplays[1];

      // Create window that spans across display boundary
      const window = await windowFactory.createWindow('main', {
        x: display1.bounds.width - 200,
        y: 100,
        width: 400, // Spans across displays
        height: 300
      });

      testWindows.push(window);

      // Window should be repositioned to fit within one display
      expect(window.config.x! + window.config.width).toBeLessThanOrEqual(
        Math.max(display1.bounds.width, display2.bounds.x + display2.bounds.width)
      );
    });

    it('should find best display for window size', async () => {
      // Large window that fits best on the largest display
      const window = await windowFactory.createWindow('main', {
        width: 2000,
        height: 1200
      });

      testWindows.push(window);

      const largestDisplay = mockDisplays.reduce((largest, current) =>
        (current.bounds.width * current.bounds.height) >
        (largest.bounds.width * largest.bounds.height) ? current : largest
      );

      // Should be positioned on the largest display
      expect(window.config.x).toBeGreaterThanOrEqual(largestDisplay.bounds.x);
      expect(window.config.x).toBeLessThan(largestDisplay.bounds.x + largestDisplay.bounds.width);
    });
  });

  describe('Display Configuration Changes', () => {
    it('should handle display addition', async () => {
      // Start with single display
      jest.spyOn(screen, 'getAllDisplays').mockReturnValue([mockDisplays[0]]);

      const window = await windowFactory.createWindow('main', {
        width: 800,
        height: 600
      });

      testWindows.push(window);

      const initialBounds = window.window.getBounds();

      // Add second display
      jest.spyOn(screen, 'getAllDisplays').mockReturnValue([mockDisplays[0], mockDisplays[1]]);

      // Simulate display-added event
      screen.emit('display-added', mockDisplays[1]);

      // Window should remain on original display
      expect(window.window.getBounds()).toEqual(initialBounds);
    });

    it('should handle display removal', async () => {
      // Start with multiple displays
      jest.spyOn(screen, 'getAllDisplays').mockReturnValue(mockDisplays);

      // Create window on secondary display
      const secondaryDisplay = mockDisplays[1];
      const window = await windowFactory.createWindow('main', {
        x: secondaryDisplay.bounds.x + 100,
        y: secondaryDisplay.bounds.y + 100,
        width: 800,
        height: 600
      });

      testWindows.push(window);

      // Remove secondary display
      jest.spyOn(screen, 'getAllDisplays').mockReturnValue([mockDisplays[0], mockDisplays[2]]);

      // Simulate display-removed event
      screen.emit('display-removed', secondaryDisplay);

      // Window should be moved to primary display
      const newBounds = window.window.getBounds();
      const primaryDisplay = mockDisplays[0];

      expect(newBounds.x).toBeGreaterThanOrEqual(primaryDisplay.bounds.x);
      expect(newBounds.x).toBeLessThan(primaryDisplay.bounds.x + primaryDisplay.bounds.width);
    });

    it('should handle display metrics changes', async () => {
      const window = await windowFactory.createWindow('main', {
        width: 800,
        height: 600
      });

      testWindows.push(window);

      const originalDisplay = mockDisplays[0];
      const modifiedDisplay = {
        ...originalDisplay,
        bounds: { x: 0, y: 0, width: 2560, height: 1440 },
        scaleFactor: 1.5
      };

      // Update display configuration
      jest.spyOn(screen, 'getAllDisplays').mockReturnValue([modifiedDisplay]);
      jest.spyOn(screen, 'getPrimaryDisplay').mockReturnValue(modifiedDisplay);

      // Simulate display-metrics-changed event
      screen.emit('display-metrics-changed', modifiedDisplay, ['bounds', 'scaleFactor']);

      // Window should adapt to new display metrics
      const bounds = window.window.getBounds();
      expect(bounds.x).toBeLessThan(modifiedDisplay.bounds.width);
      expect(bounds.y).toBeLessThan(modifiedDisplay.bounds.height);
    });

    it('should persist window positions through display changes', async () => {
      const window = await windowFactory.createWindow('main', {
        x: 100,
        y: 100,
        width: 800,
        height: 600
      });

      testWindows.push(window);

      // Save state before display change
      const originalState = await windowStateManager.saveWindowState(window.id, window.window);

      // Simulate display configuration change
      const newDisplayConfig = [
        { ...mockDisplays[0], bounds: { x: 0, y: 0, width: 2560, height: 1440 } }
      ];
      jest.spyOn(screen, 'getAllDisplays').mockReturnValue(newDisplayConfig);

      // Restore window state
      await windowStateManager.restoreWindowState(window.id, window.window, originalState);

      // Position should be adjusted but proportionally maintained
      const restoredBounds = window.window.getBounds();
      expect(restoredBounds.width).toBe(originalState.width);
      expect(restoredBounds.height).toBe(originalState.height);
    });

    it('should handle DPI changes correctly', async () => {
      const window = await windowFactory.createWindow('main', {
        width: 800,
        height: 600
      });

      testWindows.push(window);

      const originalDisplay = mockDisplays[0];
      const highDPIDisplay = {
        ...originalDisplay,
        scaleFactor: 2.0,
        size: { width: 960, height: 540 } // Logical size at 2x scale
      };

      // Update to high DPI
      jest.spyOn(screen, 'getPrimaryDisplay').mockReturnValue(highDPIDisplay);

      // Simulate DPI change
      screen.emit('display-metrics-changed', highDPIDisplay, ['scaleFactor']);

      // Window size should remain the same in logical pixels
      const bounds = window.window.getBounds();
      expect(bounds.width).toBe(800);
      expect(bounds.height).toBe(600);
    });
  });

  describe('Window Bounds Validation and Adjustment', () => {
    it('should validate and adjust invalid bounds', async () => {
      const testCases = [
        // Invalid width/height
        { x: 100, y: 100, width: -100, height: -50 },
        // Extreme coordinates
        { x: 99999, y: 99999, width: 800, height: 600 },
        // Zero dimensions
        { x: 100, y: 100, width: 0, height: 0 },
        // NaN values
        { x: NaN, y: NaN, width: 800, height: 600 }
      ];

      for (const invalidBounds of testCases) {
        const window = await windowFactory.createWindow('main', invalidBounds);
        testWindows.push(window);

        // Should have valid bounds
        expect(window.config.width).toBeGreaterThan(0);
        expect(window.config.height).toBeGreaterThan(0);
        expect(window.config.x).toBeGreaterThanOrEqual(0);
        expect(window.config.y).toBeGreaterThanOrEqual(0);

        // Should fit within display
        const display = screen.getPrimaryDisplay();
        expect(window.config.x! + window.config.width).toBeLessThanOrEqual(display.bounds.width);
        expect(window.config.y! + window.config.height).toBeLessThanOrEqual(display.bounds.height);
      }
    });

    it('should adjust windows that exceed display boundaries', async () => {
      const display = mockDisplays[0];

      const window = await windowFactory.createWindow('main', {
        x: display.bounds.width - 100, // Partially off-screen
        y: display.bounds.height - 100,
        width: 400,
        height: 300
      });

      testWindows.push(window);

      // Should be adjusted to fit completely on screen
      expect(window.config.x! + window.config.width).toBeLessThanOrEqual(display.bounds.width);
      expect(window.config.y! + window.config.height).toBeLessThanOrEqual(display.bounds.height);
    });

    it('should maintain aspect ratio when constraining size', async () => {
      const display = mockDisplays[0];

      const window = await windowFactory.createWindow('main', {
        width: display.bounds.width + 400, // Too wide
        height: (display.bounds.width + 400) * 0.6, // Maintain 16:10 ratio
        preserveAspectRatio: true
      });

      testWindows.push(window);

      // Should maintain aspect ratio while fitting in display
      const aspectRatio = window.config.width / window.config.height;
      expect(aspectRatio).toBeCloseTo(1.67, 1); // 16:10 ≈ 1.67
      expect(window.config.width).toBeLessThanOrEqual(display.bounds.width);
      expect(window.config.height).toBeLessThanOrEqual(display.bounds.height);
    });

    it('should snap windows to display edges when close', async () => {
      const display = mockDisplays[0];
      const snapThreshold = 20;

      const window = await windowFactory.createWindow('main', {
        x: 15, // Close to left edge
        y: display.bounds.height - 615, // Close to bottom edge
        width: 800,
        height: 600
      });

      testWindows.push(window);

      // Should snap to edges
      expect(window.config.x).toBe(0); // Snapped to left edge
      expect(window.config.y! + window.config.height).toBe(display.bounds.height); // Snapped to bottom
    });

    it('should handle overlapping window detection', async () => {
      const window1 = await windowFactory.createWindow('main', {
        x: 100,
        y: 100,
        width: 400,
        height: 300
      });

      const window2 = await windowFactory.createWindow('main', {
        x: 150, // Overlapping with window1
        y: 150,
        width: 400,
        height: 300
      });

      testWindows.push(window1, window2);

      // Second window should be repositioned to avoid overlap
      const bounds1 = { x: window1.config.x!, y: window1.config.y!, width: window1.config.width, height: window1.config.height };
      const bounds2 = { x: window2.config.x!, y: window2.config.y!, width: window2.config.width, height: window2.config.height };

      const overlapping = !(
        bounds1.x + bounds1.width <= bounds2.x ||
        bounds2.x + bounds2.width <= bounds1.x ||
        bounds1.y + bounds1.height <= bounds2.y ||
        bounds2.y + bounds2.height <= bounds1.y
      );

      expect(overlapping).toBe(false);
    });
  });

  describe('Performance and Memory', () => {
    it('should efficiently handle many windows across displays', async () => {
      const startTime = Date.now();

      // Create many windows
      const windows = await Promise.all(
        Array.from({ length: 50 }, (_, i) =>
          windowFactory.createWindow('main', {
            title: `Performance Test Window ${i}`,
            width: 400,
            height: 300
          })
        )
      );

      testWindows.push(...windows);

      const creationTime = Date.now() - startTime;
      expect(creationTime).toBeLessThan(5000); // Should create 50 windows in under 5 seconds

      // All windows should have valid positions
      windows.forEach(window => {
        expect(window.config.x).toBeGreaterThanOrEqual(0);
        expect(window.config.y).toBeGreaterThanOrEqual(0);
        expect(window.config.width).toBeGreaterThan(0);
        expect(window.config.height).toBeGreaterThan(0);
      });
    });

    it('should handle rapid display configuration changes', async () => {
      const window = await windowFactory.createWindow('main', {
        width: 800,
        height: 600
      });

      testWindows.push(window);

      // Rapid display changes
      for (let i = 0; i < 100; i++) {
        const modifiedDisplay = {
          ...mockDisplays[0],
          bounds: { x: 0, y: 0, width: 1920 + i, height: 1080 + i }
        };

        jest.spyOn(screen, 'getPrimaryDisplay').mockReturnValue(modifiedDisplay);
        screen.emit('display-metrics-changed', modifiedDisplay, ['bounds']);
      }

      // Window should remain stable
      expect(window.window.isDestroyed()).toBe(false);
      expect(window.config.width).toBe(800);
      expect(window.config.height).toBe(600);
    });

    it('should optimize memory usage for display tracking', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Create many display change events
      for (let i = 0; i < 1000; i++) {
        screen.emit('display-metrics-changed', mockDisplays[0], ['bounds']);
      }

      // Force garbage collection
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Should not leak significant memory
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // Less than 10MB
    });
  });
});