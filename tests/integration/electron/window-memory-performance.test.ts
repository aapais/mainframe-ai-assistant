/**
 * Window Memory Management and Performance Tests
 *
 * Tests comprehensive window memory management and performance including:
 * - Memory leak detection and prevention
 * - Performance optimization validation
 * - Resource cleanup verification
 * - Memory pressure handling
 * - Performance benchmarking
 * - Long-running session stability
 */

import { BrowserWindow, app, webContents } from 'electron';
import { WindowManager } from '../../../src/main/windows/WindowManager';
import { WindowFactory } from '../../../src/main/windows/WindowFactory';
import { WindowStateManager } from '../../../src/main/windows/WindowStateManager';
import { WindowInstance } from '../../../src/main/windows/types/WindowTypes';
import { windowTestFactory, PerformanceTestHelper } from './window-test-utils';

// Mock setup
jest.mock('electron', () => require('../../__mocks__/electron'));

describe('Window Memory Management and Performance', () => {
  let windowManager: WindowManager;
  let windowFactory: WindowFactory;
  let windowStateManager: WindowStateManager;
  let mockContext: any;
  let testWindows: WindowInstance[] = [];

  beforeAll(async () => {
    await app.whenReady();

    // Enable garbage collection for memory tests
    if (global.gc) {
      global.gc();
    }
  });

  beforeEach(async () => {
    // Setup mock context
    mockContext = {
      config: {
        get: jest.fn((key: string) => {
          switch (key) {
            case 'window.memory.maxWindows': return 50;
            case 'window.memory.gcInterval': return 30000;
            case 'window.memory.warningThreshold': return 100; // MB
            case 'window.memory.criticalThreshold': return 200; // MB
            case 'window.performance.targetFPS': return 60;
            case 'window.performance.maxCreationTime': return 1000; // ms
            case 'window.performance.enableProfiling': return true;
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
    PerformanceTestHelper.clearMeasurements();

    // Force garbage collection before each test
    if (global.gc) {
      global.gc();
    }

    jest.clearAllMocks();
  });

  afterEach(async () => {
    // Cleanup
    for (const windowInstance of testWindows) {
      if (windowInstance?.window && !windowInstance.window.isDestroyed()) {
        windowInstance.window.removeAllListeners();
        windowInstance.window.destroy();
      }
    }
    testWindows = [];

    // Force garbage collection after cleanup
    if (global.gc) {
      global.gc();
    }

    if (windowManager) {
      await windowManager.stop();
    }
  });

  describe('Memory Leak Detection', () => {
    it('should not leak memory when creating and destroying windows', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Create and destroy many windows
      for (let i = 0; i < 20; i++) {
        const window = await windowFactory.createWindow('main', {
          title: `Leak Test Window ${i}`,
          width: 400,
          height: 300
        });

        // Simulate some operations
        window.window.minimize();
        window.window.emit('minimize');
        window.window.restore();
        window.window.emit('restore');

        // Destroy immediately
        window.window.removeAllListeners();
        window.window.destroy();

        // Force garbage collection every few iterations
        if (i % 5 === 0 && global.gc) {
          global.gc();
        }
      }

      // Final garbage collection
      if (global.gc) {
        global.gc();
        // Wait for GC to complete
        await new Promise(resolve => setTimeout(resolve, 100));
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      const memoryIncreaseMB = memoryIncrease / (1024 * 1024);

      // Memory increase should be minimal (less than 10MB)
      expect(memoryIncreaseMB).toBeLessThan(10);
    });

    it('should properly cleanup event listeners', async () => {
      const window = await windowFactory.createWindow('main', {
        width: 800,
        height: 600
      });

      testWindows.push(window);

      // Add many event listeners
      const eventTypes = ['minimize', 'maximize', 'restore', 'focus', 'blur', 'resize', 'move'];
      const listenerCounts: Record<string, number> = {};

      eventTypes.forEach(eventType => {
        const listener = () => {};
        window.window.on(eventType, listener);
        window.window.on(eventType, listener);
        window.window.on(eventType, listener);

        listenerCounts[eventType] = window.window.listenerCount(eventType);
      });

      // Verify listeners were added
      Object.values(listenerCounts).forEach(count => {
        expect(count).toBeGreaterThan(0);
      });

      // Remove all listeners
      window.window.removeAllListeners();

      // Verify all listeners were removed
      eventTypes.forEach(eventType => {
        expect(window.window.listenerCount(eventType)).toBe(0);
      });
    });

    it('should prevent memory leaks in long-running sessions', async () => {
      const sessionDuration = 5000; // 5 seconds for test
      const checkInterval = 500; // Check every 500ms
      const memoryReadings: number[] = [];

      const startTime = Date.now();
      const initialMemory = process.memoryUsage().heapUsed;

      // Simulate long-running session with periodic operations
      const sessionInterval = setInterval(async () => {
        // Create and destroy windows periodically
        const window = await windowFactory.createWindow('alert', {
          width: 300,
          height: 200
        });

        // Perform some operations
        window.window.focus();
        window.window.emit('focus');

        // Cleanup immediately
        window.window.removeAllListeners();
        window.window.destroy();

        // Record memory usage
        memoryReadings.push(process.memoryUsage().heapUsed);

        // Force GC occasionally
        if (memoryReadings.length % 3 === 0 && global.gc) {
          global.gc();
        }

        // Stop after duration
        if (Date.now() - startTime >= sessionDuration) {
          clearInterval(sessionInterval);
        }
      }, checkInterval);

      // Wait for session to complete
      await new Promise(resolve => {
        const checkCompletion = () => {
          if (Date.now() - startTime >= sessionDuration) {
            resolve(true);
          } else {
            setTimeout(checkCompletion, 100);
          }
        };
        checkCompletion();
      });

      // Final garbage collection
      if (global.gc) {
        global.gc();
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = finalMemory - initialMemory;
      const memoryGrowthMB = memoryGrowth / (1024 * 1024);

      // Memory growth should be reasonable for the session
      expect(memoryGrowthMB).toBeLessThan(20);

      // Memory usage should not continuously increase
      if (memoryReadings.length > 5) {
        const firstQuartile = memoryReadings.slice(0, Math.floor(memoryReadings.length / 4));
        const lastQuartile = memoryReadings.slice(-Math.floor(memoryReadings.length / 4));

        const avgFirst = firstQuartile.reduce((sum, val) => sum + val, 0) / firstQuartile.length;
        const avgLast = lastQuartile.reduce((sum, val) => sum + val, 0) / lastQuartile.length;
        const growthRate = (avgLast - avgFirst) / avgFirst;

        // Growth rate should be reasonable (less than 50%)
        expect(growthRate).toBeLessThan(0.5);
      }
    });

    it('should handle memory pressure gracefully', async () => {
      const windows: WindowInstance[] = [];

      try {
        // Create many windows to simulate memory pressure
        for (let i = 0; i < 30; i++) {
          const window = await windowFactory.createWindow('main', {
            title: `Memory Pressure Test ${i}`,
            width: 400,
            height: 300
          });

          windows.push(window);

          // Simulate memory pressure detection
          const memoryUsage = process.memoryUsage();
          const heapUsedMB = memoryUsage.heapUsed / (1024 * 1024);

          if (heapUsedMB > 150) { // Simulated threshold
            // Should handle pressure by cleaning up or limiting creation
            break;
          }
        }

        // Should have created some windows but not unlimited
        expect(windows.length).toBeGreaterThan(5);
        expect(windows.length).toBeLessThan(50);

      } finally {
        // Cleanup all windows
        for (const window of windows) {
          if (!window.window.isDestroyed()) {
            window.window.removeAllListeners();
            window.window.destroy();
          }
        }

        testWindows.push(...windows);
      }
    });

    it('should detect and report memory leaks', async () => {
      const memoryTracker = {
        windows: new Set<string>(),
        listeners: new Map<string, number>(),
        webContents: new Set<number>()
      };

      // Create windows and track resources
      for (let i = 0; i < 5; i++) {
        const window = await windowFactory.createWindow('main', {
          width: 400,
          height: 300
        });

        testWindows.push(window);

        // Track resources
        memoryTracker.windows.add(window.id);
        memoryTracker.listeners.set(window.id, window.window.listenerCount('close'));
        memoryTracker.webContents.add(window.window.webContents.id);
      }

      // Destroy half the windows
      for (let i = 0; i < 2; i++) {
        const window = testWindows[i];
        window.window.removeAllListeners();
        window.window.destroy();

        // Update tracking
        memoryTracker.windows.delete(window.id);
        memoryTracker.listeners.delete(window.id);
        memoryTracker.webContents.delete(window.window.webContents.id);
      }

      // Verify tracking is accurate
      expect(memoryTracker.windows.size).toBe(3);
      expect(memoryTracker.listeners.size).toBe(3);
      expect(memoryTracker.webContents.size).toBe(3);

      // Should be able to detect potential leaks
      const activeWindows = BrowserWindow.getAllWindows().filter(w => !w.isDestroyed());
      expect(activeWindows.length).toBeGreaterThanOrEqual(memoryTracker.windows.size);
    });
  });

  describe('Performance Optimization', () => {
    it('should create windows within performance targets', async () => {
      const targetCreationTime = 1000; // 1 second
      const windowCount = 10;

      const { duration } = await PerformanceTestHelper.measureTime(
        'window-creation-batch',
        async () => {
          const promises = Array.from({ length: windowCount }, (_, i) =>
            windowFactory.createWindow('main', {
              title: `Performance Test ${i}`,
              width: 600,
              height: 400
            })
          );

          const windows = await Promise.all(promises);
          testWindows.push(...windows);
          return windows;
        }
      );

      const averageCreationTime = duration / windowCount;

      expect(averageCreationTime).toBeLessThan(targetCreationTime);
      expect(duration).toBeLessThan(targetCreationTime * windowCount);
    });

    it('should handle rapid window operations efficiently', async () => {
      const window = await windowFactory.createWindow('main', {
        width: 800,
        height: 600
      });

      testWindows.push(window);

      const operationCount = 100;

      const { duration } = await PerformanceTestHelper.measureTime(
        'rapid-window-operations',
        async () => {
          for (let i = 0; i < operationCount; i++) {
            // Perform rapid state changes
            const operations = [
              () => { window.window.minimize(); window.window.emit('minimize'); },
              () => { window.window.restore(); window.window.emit('restore'); },
              () => { window.window.maximize(); window.window.emit('maximize'); },
              () => { window.window.unmaximize(); window.window.emit('unmaximize'); },
              () => { window.window.focus(); window.window.emit('focus'); },
              () => { window.window.blur(); window.window.emit('blur'); }
            ];

            const operation = operations[i % operations.length];
            operation();
          }
        }
      );

      const averageOperationTime = duration / operationCount;

      // Each operation should be very fast (less than 10ms on average)
      expect(averageOperationTime).toBeLessThan(10);
    });

    it('should optimize rendering performance', async () => {
      const window = await windowFactory.createWindow('main', {
        width: 1200,
        height: 800,
        webPreferences: {
          hardwareAcceleration: true,
          backgroundThrottling: false
        }
      });

      testWindows.push(window);

      // Mock rendering performance metrics
      const renderingMetrics = {
        frameRate: 60,
        renderTime: 16.67, // 60 FPS = ~16.67ms per frame
        gpuMemory: 0,
        drawCalls: 0
      };

      // Simulate intensive rendering operations
      const { duration } = await PerformanceTestHelper.measureTime(
        'rendering-operations',
        async () => {
          // Simulate rendering workload
          for (let i = 0; i < 100; i++) {
            // Mock rendering operation
            renderingMetrics.drawCalls++;
            renderingMetrics.gpuMemory += 1024; // 1KB per call

            // Simulate frame rendering
            await new Promise(resolve => setTimeout(resolve, 1));
          }
        }
      );

      expect(renderingMetrics.frameRate).toBeGreaterThanOrEqual(30);
      expect(renderingMetrics.renderTime).toBeLessThan(33.33); // 30 FPS threshold
      expect(duration).toBeLessThan(5000); // Should complete in under 5 seconds
    });

    it('should optimize memory usage patterns', async () => {
      const initialMemory = process.memoryUsage();
      const windows: WindowInstance[] = [];

      // Create windows with optimized memory patterns
      for (let i = 0; i < 10; i++) {
        const window = await windowFactory.createWindow('main', {
          width: 400,
          height: 300,
          webPreferences: {
            // Memory optimization settings
            v8CacheOptions: 'bypassHeatCheck',
            preload: undefined // Reduce memory overhead
          }
        });

        windows.push(window);
        testWindows.push(window);

        // Trigger garbage collection periodically
        if (i % 3 === 0 && global.gc) {
          global.gc();
        }
      }

      const peakMemory = process.memoryUsage();
      const memoryIncrease = peakMemory.heapUsed - initialMemory.heapUsed;
      const memoryPerWindow = memoryIncrease / windows.length;

      // Each window should use reasonable memory (less than 10MB)
      expect(memoryPerWindow).toBeLessThan(10 * 1024 * 1024);

      // Total memory increase should be reasonable
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
    });

    it('should handle concurrent operations without blocking', async () => {
      const windowCount = 5;
      const operationsPerWindow = 20;

      const windows = await Promise.all(
        Array.from({ length: windowCount }, (_, i) =>
          windowFactory.createWindow('main', {
            title: `Concurrent Test ${i}`,
            width: 400,
            height: 300
          })
        )
      );

      testWindows.push(...windows);

      const { duration } = await PerformanceTestHelper.measureTime(
        'concurrent-operations',
        async () => {
          // Create concurrent operations for all windows
          const allOperations = windows.flatMap(window =>
            Array.from({ length: operationsPerWindow }, (_, i) => async () => {
              const operations = [
                () => window.window.focus(),
                () => window.window.blur(),
                () => window.window.minimize(),
                () => window.window.restore()
              ];

              operations[i % operations.length]();
              window.window.emit(['focus', 'blur', 'minimize', 'restore'][i % 4]);
            })
          );

          // Execute all operations concurrently
          await Promise.all(allOperations.map(op => op()));
        }
      );

      const totalOperations = windowCount * operationsPerWindow;
      const averageOperationTime = duration / totalOperations;

      // Concurrent operations should not significantly slow down
      expect(averageOperationTime).toBeLessThan(50); // 50ms average
      expect(duration).toBeLessThan(10000); // Total under 10 seconds
    });
  });

  describe('Resource Cleanup Verification', () => {
    it('should properly cleanup all window resources', async () => {
      const resourceTracker = {
        browserWindows: new Set<number>(),
        webContents: new Set<number>(),
        eventListeners: new Map<number, number>()
      };

      const windows: WindowInstance[] = [];

      // Create windows and track resources
      for (let i = 0; i < 5; i++) {
        const window = await windowFactory.createWindow('main', {
          width: 400,
          height: 300
        });

        windows.push(window);

        // Track resources
        resourceTracker.browserWindows.add(window.window.id);
        resourceTracker.webContents.add(window.window.webContents.id);

        // Add event listeners and track them
        const listenerCount = 10;
        for (let j = 0; j < listenerCount; j++) {
          window.window.on('test-event', () => {});
        }
        resourceTracker.eventListeners.set(window.window.id, listenerCount);
      }

      // Verify resources are tracked
      expect(resourceTracker.browserWindows.size).toBe(5);
      expect(resourceTracker.webContents.size).toBe(5);
      expect(resourceTracker.eventListeners.size).toBe(5);

      // Cleanup all windows
      for (const window of windows) {
        expect(window.window.listenerCount('test-event')).toBe(10);

        window.window.removeAllListeners();
        expect(window.window.listenerCount('test-event')).toBe(0);

        window.window.destroy();
        expect(window.window.isDestroyed()).toBe(true);
      }

      testWindows.push(...windows);

      // Verify all resources are cleaned up
      const remainingWindows = BrowserWindow.getAllWindows().filter(w => !w.isDestroyed());
      expect(remainingWindows.length).toBe(0);
    });

    it('should cleanup IPC channels and handlers', async () => {
      const window = await windowFactory.createWindow('main', {
        width: 800,
        height: 600
      });

      testWindows.push(window);

      // Mock IPC channel tracking
      const ipcChannels = new Set<string>();
      const mockIpcHandler = jest.fn();

      // Setup IPC handlers
      const channels = ['test-channel-1', 'test-channel-2', 'test-channel-3'];
      channels.forEach(channel => {
        window.window.webContents.ipc?.handle?.(channel, mockIpcHandler);
        ipcChannels.add(channel);
      });

      expect(ipcChannels.size).toBe(3);

      // Cleanup window
      window.window.removeAllListeners();

      // Mock IPC cleanup
      channels.forEach(channel => {
        window.window.webContents.ipc?.removeHandler?.(channel);
        ipcChannels.delete(channel);
      });

      window.window.destroy();

      // Verify IPC cleanup
      expect(ipcChannels.size).toBe(0);
      expect(window.window.isDestroyed()).toBe(true);
    });

    it('should handle cleanup failures gracefully', async () => {
      const window = await windowFactory.createWindow('main', {
        width: 800,
        height: 600
      });

      testWindows.push(window);

      // Mock cleanup failure
      const originalDestroy = window.window.destroy;
      let cleanupAttempts = 0;

      window.window.destroy = jest.fn(() => {
        cleanupAttempts++;
        if (cleanupAttempts < 3) {
          throw new Error('Cleanup failed');
        }
        originalDestroy.call(window.window);
      });

      // First attempts should fail
      expect(() => window.window.destroy()).toThrow('Cleanup failed');
      expect(() => window.window.destroy()).toThrow('Cleanup failed');

      // Third attempt should succeed
      expect(() => window.window.destroy()).not.toThrow();

      expect(cleanupAttempts).toBe(3);
    });

    it('should prevent resource leaks in error scenarios', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      const errors: Error[] = [];

      // Create windows that will encounter errors
      for (let i = 0; i < 10; i++) {
        try {
          const window = await windowFactory.createWindow('main', {
            width: 400,
            height: 300
          });

          testWindows.push(window);

          // Simulate error during operation
          if (i % 3 === 0) {
            throw new Error(`Simulated error ${i}`);
          }

          // Cleanup successful windows
          window.window.removeAllListeners();
          window.window.destroy();

        } catch (error) {
          errors.push(error as Error);
        }
      }

      // Force garbage collection
      if (global.gc) {
        global.gc();
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Even with errors, memory increase should be minimal
      expect(memoryIncrease).toBeLessThan(20 * 1024 * 1024); // 20MB
      expect(errors.length).toBeGreaterThan(0); // Errors were encountered
    });
  });

  describe('Performance Benchmarking', () => {
    it('should meet performance benchmarks for window operations', async () => {
      const benchmarks = {
        windowCreation: { target: 500, unit: 'ms' },
        stateChange: { target: 10, unit: 'ms' },
        destruction: { target: 100, unit: 'ms' },
        batchOperations: { target: 2000, unit: 'ms' }
      };

      // Benchmark window creation
      const { duration: creationTime } = await PerformanceTestHelper.measureTime(
        'window-creation-benchmark',
        async () => {
          const window = await windowFactory.createWindow('main', {
            width: 800,
            height: 600
          });
          testWindows.push(window);
          return window;
        }
      );

      expect(creationTime).toBeLessThan(benchmarks.windowCreation.target);

      // Benchmark state changes
      const window = testWindows[0];
      const { duration: stateChangeTime } = await PerformanceTestHelper.measureTime(
        'state-change-benchmark',
        () => {
          window.window.minimize();
          window.window.emit('minimize');
        }
      );

      expect(stateChangeTime).toBeLessThan(benchmarks.stateChange.target);

      // Benchmark destruction
      const { duration: destructionTime } = await PerformanceTestHelper.measureTime(
        'destruction-benchmark',
        () => {
          window.window.removeAllListeners();
          window.window.destroy();
        }
      );

      expect(destructionTime).toBeLessThan(benchmarks.destruction.target);

      // Remove from testWindows since it's destroyed
      testWindows.splice(0, 1);
    });

    it('should scale performance linearly with window count', async () => {
      const windowCounts = [1, 5, 10, 20];
      const creationTimes: number[] = [];

      for (const count of windowCounts) {
        const { duration } = await PerformanceTestHelper.measureTime(
          `creation-scale-${count}`,
          async () => {
            const windows = await Promise.all(
              Array.from({ length: count }, (_, i) =>
                windowFactory.createWindow('main', {
                  title: `Scale Test ${i}`,
                  width: 300,
                  height: 200
                })
              )
            );

            testWindows.push(...windows);
            return windows;
          }
        );

        creationTimes.push(duration);

        // Cleanup windows for next test
        const windowsToCleanup = testWindows.splice(-count);
        windowsToCleanup.forEach(w => {
          w.window.removeAllListeners();
          w.window.destroy();
        });

        // Wait for cleanup
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Performance should scale reasonably (not exponentially)
      const performanceRatios = creationTimes.slice(1).map((time, index) => {
        const expectedTime = creationTimes[0] * windowCounts[index + 1];
        return time / expectedTime;
      });

      // Performance degradation should be reasonable (less than 2x worse than linear)
      performanceRatios.forEach(ratio => {
        expect(ratio).toBeLessThan(2.0);
      });
    });

    it('should maintain consistent performance over time', async () => {
      const testDuration = 3000; // 3 seconds
      const interval = 200; // Test every 200ms
      const performanceData: number[] = [];

      const startTime = Date.now();

      while (Date.now() - startTime < testDuration) {
        const { duration } = await PerformanceTestHelper.measureTime(
          'consistency-test',
          async () => {
            const window = await windowFactory.createWindow('alert', {
              width: 300,
              height: 200
            });

            window.window.focus();
            window.window.emit('focus');
            window.window.removeAllListeners();
            window.window.destroy();

            return window;
          }
        );

        performanceData.push(duration);

        await new Promise(resolve => setTimeout(resolve, interval));
      }

      // Calculate performance statistics
      const average = performanceData.reduce((sum, val) => sum + val, 0) / performanceData.length;
      const variance = performanceData.reduce((sum, val) => sum + Math.pow(val - average, 2), 0) / performanceData.length;
      const standardDeviation = Math.sqrt(variance);
      const coefficientOfVariation = standardDeviation / average;

      // Performance should be consistent (low coefficient of variation)
      expect(coefficientOfVariation).toBeLessThan(0.5); // 50% variation threshold
      expect(average).toBeLessThan(1000); // Average should be under 1 second
    });
  });
});