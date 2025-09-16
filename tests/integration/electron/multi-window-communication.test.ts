/**
 * Multi-Window Communication Integration Tests
 *
 * Tests comprehensive multi-window scenarios including:
 * - Multi-window creation and management
 * - Inter-window communication via IPC
 * - Window coordination and synchronization
 * - Parent-child window relationships
 * - Window focus management
 * - Modal and dialog window handling
 */

import { BrowserWindow, app, ipcMain, ipcRenderer } from 'electron';
import { EventEmitter } from 'events';
import { WindowManager } from '../../../src/main/windows/WindowManager';
import { WindowFactory } from '../../../src/main/windows/WindowFactory';
import { IPCCoordinator } from '../../../src/main/windows/IPCCoordinator';
import { WindowRegistry } from '../../../src/main/windows/WindowRegistry';
import { WindowInstance, WindowType } from '../../../src/main/windows/types/WindowTypes';

// Mock setup
jest.mock('electron', () => require('../../__mocks__/electron'));

describe('Multi-Window Communication', () => {
  let windowManager: WindowManager;
  let windowFactory: WindowFactory;
  let ipcCoordinator: IPCCoordinator;
  let windowRegistry: WindowRegistry;
  let mockContext: any;
  let mainWindow: WindowInstance;
  let secondaryWindows: WindowInstance[] = [];

  beforeAll(async () => {
    await app.whenReady();
  });

  beforeEach(async () => {
    // Setup mock context
    mockContext = {
      config: {
        get: jest.fn((key: string) => {
          switch (key) {
            case 'window.ipc.enabled': return true;
            case 'window.ipc.timeout': return 5000;
            case 'window.maxWindows': return 10;
            case 'window.coordinator.enabled': return true;
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
    ipcCoordinator = new IPCCoordinator(mockContext);
    windowRegistry = new WindowRegistry();

    // Create main window
    mainWindow = await windowFactory.createWindow('main', {
      title: 'Main Window',
      width: 1200,
      height: 800
    });

    secondaryWindows = [];
    jest.clearAllMocks();
  });

  afterEach(async () => {
    // Cleanup all windows
    const allWindows = [mainWindow, ...secondaryWindows].filter(Boolean);
    for (const windowInstance of allWindows) {
      if (windowInstance?.window && !windowInstance.window.isDestroyed()) {
        windowInstance.window.destroy();
      }
    }

    secondaryWindows = [];

    if (windowManager) {
      await windowManager.stop();
    }

    // Clear IPC handlers
    ipcMain.removeAllListeners();
  });

  describe('Multi-Window Creation and Management', () => {
    it('should create multiple windows of different types', async () => {
      const windows = await Promise.all([
        windowFactory.createWindow('alert', { title: 'Alert Window' }),
        windowFactory.createWindow('pattern-viewer', { title: 'Pattern Viewer' }),
        windowFactory.createWindow('main', { title: 'Second Main Window' })
      ]);

      secondaryWindows.push(...windows);

      expect(windows).toHaveLength(3);
      expect(windows[0].type).toBe('alert');
      expect(windows[1].type).toBe('pattern-viewer');
      expect(windows[2].type).toBe('main');

      // All windows should have unique IDs
      const ids = windows.map(w => w.id);
      expect(new Set(ids).size).toBe(3);
    });

    it('should manage window registry correctly', async () => {
      const window1 = await windowFactory.createWindow('alert');
      const window2 = await windowFactory.createWindow('pattern-viewer');

      secondaryWindows.push(window1, window2);

      windowRegistry.register(window1);
      windowRegistry.register(window2);

      expect(windowRegistry.getWindow(window1.id)).toBe(window1);
      expect(windowRegistry.getWindow(window2.id)).toBe(window2);
      expect(windowRegistry.getAllWindows()).toHaveLength(2);
      expect(windowRegistry.getWindowsByType('alert')).toHaveLength(1);
    });

    it('should handle window limits correctly', async () => {
      // Set low limit for testing
      mockContext.config.get.mockImplementation((key: string) => {
        if (key === 'window.maxWindows') return 3;
        return null;
      });

      const factory = new WindowFactory(mockContext);

      // Create up to limit
      const windows = await Promise.all([
        factory.createWindow('main'),
        factory.createWindow('alert'),
        factory.createWindow('pattern-viewer')
      ]);

      secondaryWindows.push(...windows);

      // Should succeed
      expect(windows).toHaveLength(3);

      // Exceeding limit should fail
      await expect(factory.createWindow('main'))
        .rejects.toThrow('Maximum window limit reached');
    });

    it('should handle parent-child window relationships', async () => {
      const parentWindow = await windowFactory.createWindow('main');
      const childWindow = await windowFactory.createWindow('alert', {
        parent: parentWindow.window,
        modal: true
      });

      secondaryWindows.push(parentWindow, childWindow);

      expect(childWindow.config.parent).toBe(parentWindow.window);
      expect(childWindow.config.modal).toBe(true);

      // Child window should be destroyed when parent is destroyed
      parentWindow.window.destroy();
      parentWindow.window.emit('closed');

      expect(childWindow.window.isDestroyed()).toBe(true);
    });

    it('should manage window focus correctly', async () => {
      const window1 = await windowFactory.createWindow('main');
      const window2 = await windowFactory.createWindow('alert');

      secondaryWindows.push(window1, window2);

      // Focus window1
      window1.window.focus();
      window1.window.emit('focus');

      expect(window1.window.isFocused()).toBe(true);
      expect(window2.window.isFocused()).toBe(false);

      // Focus window2
      window2.window.focus();
      window2.window.emit('focus');
      window1.window.emit('blur');

      expect(window1.window.isFocused()).toBe(false);
      expect(window2.window.isFocused()).toBe(true);
    });
  });

  describe('Inter-Window Communication via IPC', () => {
    let alertWindow: WindowInstance;

    beforeEach(async () => {
      alertWindow = await windowFactory.createWindow('alert', {
        title: 'Alert Window'
      });
      secondaryWindows.push(alertWindow);
    });

    it('should send messages between windows', async () => {
      const messageData = { type: 'test', content: 'Hello from main window' };
      let receivedMessage: any = null;

      // Setup IPC handler in alert window
      alertWindow.window.webContents.on('ipc-message', (event, channel, data) => {
        if (channel === 'window-message') {
          receivedMessage = data;
        }
      });

      // Send message from main window to alert window
      await ipcCoordinator.sendToWindow(alertWindow.id, 'window-message', messageData);

      // Simulate message reception
      alertWindow.window.webContents.emit('ipc-message', null, 'window-message', messageData);

      expect(receivedMessage).toEqual(messageData);
    });

    it('should broadcast messages to all windows', async () => {
      const window2 = await windowFactory.createWindow('pattern-viewer');
      const window3 = await windowFactory.createWindow('main');

      secondaryWindows.push(window2, window3);

      const receivedMessages: any[] = [];

      // Setup listeners on all windows
      [alertWindow, window2, window3].forEach((window, index) => {
        window.window.webContents.on('ipc-message', (event, channel, data) => {
          if (channel === 'broadcast-message') {
            receivedMessages[index] = data;
          }
        });
      });

      const broadcastData = { type: 'broadcast', message: 'Global update' };

      // Broadcast to all windows
      await ipcCoordinator.broadcastToAllWindows('broadcast-message', broadcastData);

      // Simulate reception on all windows
      [alertWindow, window2, window3].forEach(window => {
        window.window.webContents.emit('ipc-message', null, 'broadcast-message', broadcastData);
      });

      expect(receivedMessages).toHaveLength(3);
      receivedMessages.forEach(msg => {
        expect(msg).toEqual(broadcastData);
      });
    });

    it('should handle IPC communication timeouts', async () => {
      jest.useFakeTimers();

      // Mock unresponsive window
      jest.spyOn(alertWindow.window.webContents, 'send').mockImplementation(() => {
        // Never respond
      });

      const messagePromise = ipcCoordinator.sendToWindowWithResponse(
        alertWindow.id,
        'request-message',
        { data: 'test' }
      );

      // Advance time past timeout
      jest.advanceTimersByTime(6000);

      await expect(messagePromise).rejects.toThrow('IPC timeout');

      jest.useRealTimers();
    });

    it('should handle window-to-window data synchronization', async () => {
      const sharedData = { version: 1, content: 'Initial data' };
      const dataStore = new Map<string, any>();

      // Setup data synchronization handlers
      ipcMain.handle('sync-data-get', (event, key) => {
        return dataStore.get(key);
      });

      ipcMain.handle('sync-data-set', (event, key, value) => {
        dataStore.set(key, value);

        // Broadcast update to all other windows
        BrowserWindow.getAllWindows().forEach(window => {
          if (window.webContents.id !== event.sender.id) {
            window.webContents.send('sync-data-updated', key, value);
          }
        });

        return true;
      });

      // Main window updates data
      const updateData = { version: 2, content: 'Updated data' };

      // Simulate data update from main window
      const updateResult = await ipcMain.emit('sync-data-set',
        { sender: mainWindow.window.webContents },
        'shared-data',
        updateData
      );

      expect(dataStore.get('shared-data')).toEqual(updateData);

      // Alert window should receive update notification
      let notificationReceived = false;
      alertWindow.window.webContents.on('sync-data-updated', (key, value) => {
        if (key === 'shared-data') {
          notificationReceived = true;
          expect(value).toEqual(updateData);
        }
      });

      alertWindow.window.webContents.emit('sync-data-updated', 'shared-data', updateData);
      expect(notificationReceived).toBe(true);
    });

    it('should handle request-response IPC patterns', async () => {
      // Setup response handler in alert window
      ipcMain.handle('window-request', async (event, requestData) => {
        return {
          success: true,
          result: `Processed: ${requestData.input}`,
          timestamp: Date.now()
        };
      });

      // Main window sends request
      const requestData = { input: 'test data', requestId: 'req-123' };

      const response = await new Promise((resolve) => {
        ipcMain.emit('window-request', null, requestData).then(resolve);
      });

      expect(response).toEqual({
        success: true,
        result: 'Processed: test data',
        timestamp: expect.any(Number)
      });
    });
  });

  describe('Window Coordination and Synchronization', () => {
    let windows: WindowInstance[];

    beforeEach(async () => {
      windows = await Promise.all([
        windowFactory.createWindow('main', { title: 'Main 1' }),
        windowFactory.createWindow('main', { title: 'Main 2' }),
        windowFactory.createWindow('alert', { title: 'Alert' }),
        windowFactory.createWindow('pattern-viewer', { title: 'Pattern Viewer' })
      ]);

      secondaryWindows.push(...windows);

      // Register all windows
      windows.forEach(window => windowRegistry.register(window));
    });

    it('should coordinate window states across multiple windows', async () => {
      const stateChangeEvents: any[] = [];

      // Setup state change listeners
      windows.forEach((window, index) => {
        window.window.on('minimize', () => {
          stateChangeEvents.push({ window: index, event: 'minimize' });
        });
        window.window.on('maximize', () => {
          stateChangeEvents.push({ window: index, event: 'maximize' });
        });
      });

      // Perform coordinated state changes
      windows[0].window.minimize();
      windows[0].window.emit('minimize');

      windows[1].window.maximize();
      windows[1].window.emit('maximize');

      expect(stateChangeEvents).toEqual([
        { window: 0, event: 'minimize' },
        { window: 1, event: 'maximize' }
      ]);
    });

    it('should manage modal window stack correctly', async () => {
      const modalStack: WindowInstance[] = [];

      // Create modal hierarchy
      const modal1 = await windowFactory.createWindow('alert', {
        parent: windows[0].window,
        modal: true,
        title: 'Modal 1'
      });

      const modal2 = await windowFactory.createWindow('alert', {
        parent: modal1.window,
        modal: true,
        title: 'Modal 2'
      });

      secondaryWindows.push(modal1, modal2);
      modalStack.push(modal1, modal2);

      // Only top modal should be accessible
      expect(modal2.window.isFocused()).toBe(true);
      expect(modal1.window.isFocused()).toBe(false);

      // Closing top modal should focus previous modal
      modal2.window.close();
      modal2.window.emit('closed');
      modal1.window.emit('focus');

      expect(modal1.window.isFocused()).toBe(true);
    });

    it('should handle window activation chains', async () => {
      const activationChain: string[] = [];

      windows.forEach(window => {
        window.window.on('focus', () => {
          activationChain.push(window.id);
        });
      });

      // Activate windows in sequence
      windows[0].window.focus();
      windows[0].window.emit('focus');

      windows[2].window.focus();
      windows[2].window.emit('focus');

      windows[1].window.focus();
      windows[1].window.emit('focus');

      expect(activationChain).toEqual([windows[0].id, windows[2].id, windows[1].id]);
    });

    it('should synchronize theme changes across windows', async () => {
      const themeChangeEvents: any[] = [];

      // Setup theme change listeners
      windows.forEach((window, index) => {
        window.window.webContents.on('theme-changed', (theme) => {
          themeChangeEvents.push({ window: index, theme });
        });
      });

      // Broadcast theme change
      const newTheme = 'dark';
      windows.forEach(window => {
        window.window.webContents.emit('theme-changed', newTheme);
      });

      expect(themeChangeEvents).toHaveLength(4);
      themeChangeEvents.forEach(event => {
        expect(event.theme).toBe('dark');
      });
    });

    it('should handle window close cascade correctly', async () => {
      const closeEvents: string[] = [];

      windows.forEach(window => {
        window.window.on('closed', () => {
          closeEvents.push(window.id);
        });
      });

      // Close main window should not affect others
      windows[0].window.close();
      windows[0].window.emit('closed');

      expect(closeEvents).toEqual([windows[0].id]);

      // Independent windows should remain open
      expect(windows[1].window.isDestroyed()).toBe(false);
      expect(windows[2].window.isDestroyed()).toBe(false);
      expect(windows[3].window.isDestroyed()).toBe(false);
    });
  });

  describe('Window Communication Performance', () => {
    let performanceWindows: WindowInstance[];

    beforeEach(async () => {
      performanceWindows = await Promise.all(
        Array.from({ length: 5 }, (_, i) =>
          windowFactory.createWindow('main', { title: `Performance Window ${i}` })
        )
      );

      secondaryWindows.push(...performanceWindows);
    });

    it('should handle high-frequency IPC messages efficiently', async () => {
      const startTime = Date.now();
      const messageCount = 1000;

      // Send many messages rapidly
      const promises = Array.from({ length: messageCount }, (_, i) =>
        ipcCoordinator.sendToWindow(
          performanceWindows[0].id,
          'performance-test',
          { messageIndex: i }
        )
      );

      await Promise.all(promises);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5000); // Should complete in under 5 seconds

      // Calculate throughput
      const throughput = messageCount / (duration / 1000);
      expect(throughput).toBeGreaterThan(100); // At least 100 messages/second
    });

    it('should handle concurrent window operations efficiently', async () => {
      const startTime = Date.now();

      // Perform concurrent operations on all windows
      const operations = performanceWindows.map(async (window, index) => {
        return Promise.all([
          // State changes
          new Promise(resolve => {
            if (index % 2 === 0) {
              window.window.minimize();
              window.window.emit('minimize');
            } else {
              window.window.maximize();
              window.window.emit('maximize');
            }
            resolve(true);
          }),
          // IPC messages
          ipcCoordinator.sendToWindow(window.id, 'concurrent-test', { index }),
          // Focus changes
          new Promise(resolve => {
            window.window.focus();
            window.window.emit('focus');
            resolve(true);
          })
        ]);
      });

      await Promise.all(operations);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(2000); // Should complete in under 2 seconds
    });

    it('should maintain memory efficiency with many windows', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Create additional windows for memory testing
      const memoryTestWindows = await Promise.all(
        Array.from({ length: 20 }, (_, i) =>
          windowFactory.createWindow('alert', { title: `Memory Test ${i}` })
        )
      );

      secondaryWindows.push(...memoryTestWindows);

      // Perform operations on all windows
      for (const window of memoryTestWindows) {
        await ipcCoordinator.sendToWindow(window.id, 'memory-test', { data: 'test'.repeat(1000) });
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 100MB for 20 windows)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);

      // Cleanup
      memoryTestWindows.forEach(window => {
        if (!window.window.isDestroyed()) {
          window.window.destroy();
        }
      });
    });

    it('should handle message queue backpressure correctly', async () => {
      const messageQueue: any[] = [];
      let processingCount = 0;

      // Setup slow message processor
      ipcMain.handle('slow-process', async (event, data) => {
        processingCount++;
        await new Promise(resolve => setTimeout(resolve, 100)); // Simulate slow processing
        messageQueue.push(data);
        processingCount--;
        return { processed: true, data };
      });

      // Send many messages quickly
      const messages = Array.from({ length: 50 }, (_, i) => ({ id: i, data: `message-${i}` }));

      const startTime = Date.now();
      const promises = messages.map(msg =>
        new Promise(resolve => {
          ipcMain.emit('slow-process', null, msg).then(resolve);
        })
      );

      await Promise.all(promises);

      const duration = Date.now() - startTime;

      // Should handle backpressure without timeout errors
      expect(messageQueue).toHaveLength(50);
      expect(processingCount).toBe(0); // All processing should be complete
      expect(duration).toBeLessThan(10000); // Reasonable completion time
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle window communication failures gracefully', async () => {
      const errorWindow = await windowFactory.createWindow('alert');
      secondaryWindows.push(errorWindow);

      // Mock communication failure
      jest.spyOn(errorWindow.window.webContents, 'send').mockImplementation(() => {
        throw new Error('Communication failed');
      });

      // Should not crash when communication fails
      await expect(
        ipcCoordinator.sendToWindow(errorWindow.id, 'test-message', { data: 'test' })
      ).rejects.toThrow('Communication failed');

      // Other windows should still work
      const workingWindow = await windowFactory.createWindow('main');
      secondaryWindows.push(workingWindow);

      await expect(
        ipcCoordinator.sendToWindow(workingWindow.id, 'test-message', { data: 'test' })
      ).resolves.toBeDefined();
    });

    it('should recover from window registry corruption', async () => {
      const window1 = await windowFactory.createWindow('main');
      const window2 = await windowFactory.createWindow('alert');

      secondaryWindows.push(window1, window2);

      windowRegistry.register(window1);
      windowRegistry.register(window2);

      // Simulate registry corruption
      (windowRegistry as any).windows.clear();

      // Should handle missing window gracefully
      expect(windowRegistry.getWindow(window1.id)).toBeUndefined();

      // Should be able to re-register
      windowRegistry.register(window1);
      windowRegistry.register(window2);

      expect(windowRegistry.getWindow(window1.id)).toBe(window1);
      expect(windowRegistry.getWindow(window2.id)).toBe(window2);
    });

    it('should handle orphaned windows correctly', async () => {
      const parentWindow = await windowFactory.createWindow('main');
      const childWindow = await windowFactory.createWindow('alert', {
        parent: parentWindow.window
      });

      secondaryWindows.push(parentWindow, childWindow);

      // Simulate parent window crash
      parentWindow.window.emit('crashed');
      parentWindow.window.destroy();

      // Child window should be cleaned up or become independent
      expect(childWindow.window.isDestroyed()).toBe(true);
    });
  });
});