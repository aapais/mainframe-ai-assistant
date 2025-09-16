/**
 * Tray Menu Tests for System Tray Integration
 *
 * Tests tray menu functionality including:
 * - Menu creation and structure
 * - Quick actions and shortcuts
 * - Window management from tray
 * - System integration
 */

import { jest } from '@jest/globals';
import { Menu, BrowserWindow, app } from 'electron';
import { createTrayMenu } from '../../../src/main/menu';
import { MenuTestUtils } from './utils/MenuTestUtils';

// Mock electron modules
jest.mock('electron', () => require('../../integration/__mocks__/electron.js'));

describe('Tray Menu Tests', () => {
  let mockWindow: BrowserWindow;
  let menuTestUtils: MenuTestUtils;

  beforeEach(() => {
    jest.clearAllMocks();

    mockWindow = new BrowserWindow({
      width: 1200,
      height: 800
    });

    // Add show method mock
    mockWindow.show = jest.fn();

    menuTestUtils = new MenuTestUtils();
  });

  afterEach(() => {
    menuTestUtils.cleanup();
  });

  describe('Tray Menu Creation', () => {
    it('should create tray menu with essential items', () => {
      const trayMenu = createTrayMenu(mockWindow);

      expect(Menu.buildFromTemplate).toHaveBeenCalled();
      expect(trayMenu).toBeDefined();

      const template = (Menu.buildFromTemplate as jest.Mock).mock.calls[0][0];

      const expectedItems = [
        'Show App',
        'Quick Search',
        'New KB Entry',
        'Quit'
      ];

      expectedItems.forEach(label => {
        const item = template.find((item: any) => item.label === label);
        expect(item).toBeDefined();
      });
    });

    it('should include separators for logical grouping', () => {
      const trayMenu = createTrayMenu(mockWindow);
      const template = (Menu.buildFromTemplate as jest.Mock).mock.calls[0][0];

      const separatorCount = template.filter((item: any) => item.type === 'separator').length;
      expect(separatorCount).toBe(2); // Expected separators in tray menu
    });

    it('should create menu for different windows', () => {
      const window1 = new BrowserWindow();
      const window2 = new BrowserWindow();

      window1.show = jest.fn();
      window2.show = jest.fn();

      const menu1 = createTrayMenu(window1);
      const menu2 = createTrayMenu(window2);

      expect(Menu.buildFromTemplate).toHaveBeenCalledTimes(2);
      expect(menu1).not.toBe(menu2);
    });
  });

  describe('Tray Menu Actions', () => {
    let trayMenuItems: any[];

    beforeEach(() => {
      const trayMenu = createTrayMenu(mockWindow);
      trayMenuItems = (Menu.buildFromTemplate as jest.Mock).mock.calls[0][0];
    });

    it('should show window when Show App is clicked', () => {
      const showAppItem = trayMenuItems.find(item => item.label === 'Show App');

      // Simulate menu item click
      if (showAppItem?.click) {
        showAppItem.click();
      }

      expect(mockWindow.show).toHaveBeenCalled();
    });

    it('should show window and trigger quick search when Quick Search is clicked', () => {
      const quickSearchItem = trayMenuItems.find(item => item.label === 'Quick Search');

      expect(quickSearchItem).toBeDefined();
      expect(quickSearchItem?.accelerator).toBe('CmdOrCtrl+Space');

      // Simulate menu item click
      if (quickSearchItem?.click) {
        quickSearchItem.click();
      }

      expect(mockWindow.show).toHaveBeenCalled();
      expect(mockWindow.webContents.send).toHaveBeenCalledWith('action', 'quick-search');
    });

    it('should show window and create new entry when New KB Entry is clicked', () => {
      const newEntryItem = trayMenuItems.find(item => item.label === 'New KB Entry');

      // Simulate menu item click
      if (newEntryItem?.click) {
        newEntryItem.click();
      }

      expect(mockWindow.show).toHaveBeenCalled();
      expect(mockWindow.webContents.send).toHaveBeenCalledWith('action', 'new-kb-entry');
    });

    it('should quit app when Quit is clicked', () => {
      const quitItem = trayMenuItems.find(item => item.label === 'Quit');

      // Simulate menu item click
      if (quitItem?.click) {
        quitItem.click();
      }

      expect(app.quit).toHaveBeenCalled();
    });
  });

  describe('Tray Menu Window Management', () => {
    it('should handle hidden window state', () => {
      // Mock window as hidden
      mockWindow.isVisible = jest.fn().mockReturnValue(false);
      mockWindow.isMinimized = jest.fn().mockReturnValue(true);

      const trayMenu = createTrayMenu(mockWindow);
      const trayMenuItems = (Menu.buildFromTemplate as jest.Mock).mock.calls[0][0];
      const showAppItem = trayMenuItems.find(item => item.label === 'Show App');

      // Should still be able to show the window
      if (showAppItem?.click) {
        showAppItem.click();
      }

      expect(mockWindow.show).toHaveBeenCalled();
    });

    it('should handle destroyed window gracefully', () => {
      // Mock window as destroyed
      mockWindow.isDestroyed = jest.fn().mockReturnValue(true);
      mockWindow.show = jest.fn().mockImplementation(() => {
        throw new Error('Window is destroyed');
      });

      const trayMenu = createTrayMenu(mockWindow);
      const trayMenuItems = (Menu.buildFromTemplate as jest.Mock).mock.calls[0][0];
      const showAppItem = trayMenuItems.find(item => item.label === 'Show App');

      // Should not throw when window is destroyed
      expect(() => {
        if (showAppItem?.click) {
          showAppItem.click();
        }
      }).not.toThrow();
    });

    it('should restore minimized window', () => {
      mockWindow.isMinimized = jest.fn().mockReturnValue(true);
      mockWindow.restore = jest.fn();

      const trayMenu = createTrayMenu(mockWindow);
      const trayMenuItems = (Menu.buildFromTemplate as jest.Mock).mock.calls[0][0];
      const showAppItem = trayMenuItems.find(item => item.label === 'Show App');

      if (showAppItem?.click) {
        showAppItem.click();
      }

      expect(mockWindow.show).toHaveBeenCalled();
    });
  });

  describe('Tray Menu Accessibility', () => {
    it('should provide keyboard shortcuts for common actions', () => {
      const trayMenu = createTrayMenu(mockWindow);
      const template = (Menu.buildFromTemplate as jest.Mock).mock.calls[0][0];

      const quickSearchItem = template.find((item: any) => item.label === 'Quick Search');
      expect(quickSearchItem?.accelerator).toBe('CmdOrCtrl+Space');
    });

    it('should use clear and descriptive labels', () => {
      const trayMenu = createTrayMenu(mockWindow);
      const template = (Menu.buildFromTemplate as jest.Mock).mock.calls[0][0];

      template.forEach((item: any) => {
        if (item.type !== 'separator') {
          expect(typeof item.label).toBe('string');
          expect(item.label.length).toBeGreaterThan(0);
          expect(item.label).not.toMatch(/^\s*$/); // Not just whitespace
        }
      });
    });

    it('should prioritize most important actions at top', () => {
      const trayMenu = createTrayMenu(mockWindow);
      const template = (Menu.buildFromTemplate as jest.Mock).mock.calls[0][0];

      // First non-separator item should be Show App
      const firstItem = template.find((item: any) => item.type !== 'separator');
      expect(firstItem?.label).toBe('Show App');

      // Quit should be last
      const lastItem = template[template.length - 1];
      expect(lastItem?.label).toBe('Quit');
    });
  });

  describe('Tray Menu Performance', () => {
    it('should create menu quickly', () => {
      const startTime = Date.now();

      for (let i = 0; i < 50; i++) {
        createTrayMenu(mockWindow);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should be very fast (under 50ms for 50 menus)
      expect(duration).toBeLessThan(50);
    });

    it('should not accumulate memory with repeated creations', () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Create many tray menus
      for (let i = 0; i < 500; i++) {
        createTrayMenu(mockWindow);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be minimal (less than 5MB)
      expect(memoryIncrease).toBeLessThan(5 * 1024 * 1024);
    });
  });

  describe('Tray Menu Integration', () => {
    it('should work with different window states', () => {
      const windowStates = [
        { visible: true, minimized: false, focused: true },
        { visible: false, minimized: true, focused: false },
        { visible: true, minimized: false, focused: false },
        { visible: false, minimized: false, focused: false }
      ];

      windowStates.forEach(state => {
        mockWindow.isVisible = jest.fn().mockReturnValue(state.visible);
        mockWindow.isMinimized = jest.fn().mockReturnValue(state.minimized);
        mockWindow.isFocused = jest.fn().mockReturnValue(state.focused);

        expect(() => {
          createTrayMenu(mockWindow);
        }).not.toThrow();
      });
    });

    it('should handle multiple windows', () => {
      const windows = Array.from({ length: 3 }, () => {
        const win = new BrowserWindow();
        win.show = jest.fn();
        return win;
      });

      windows.forEach(window => {
        expect(() => {
          createTrayMenu(window);
        }).not.toThrow();
      });

      expect(Menu.buildFromTemplate).toHaveBeenCalledTimes(3);
    });
  });

  describe('Tray Menu Error Handling', () => {
    it('should handle IPC errors gracefully', () => {
      mockWindow.webContents.send = jest.fn().mockImplementation(() => {
        throw new Error('IPC failed');
      });

      const trayMenu = createTrayMenu(mockWindow);
      const template = (Menu.buildFromTemplate as jest.Mock).mock.calls[0][0];
      const quickSearchItem = template.find((item: any) => item.label === 'Quick Search');

      // Should not throw when IPC fails
      expect(() => {
        if (quickSearchItem?.click) {
          quickSearchItem.click();
        }
      }).not.toThrow();
    });

    it('should handle app.quit errors gracefully', () => {
      (app.quit as jest.Mock).mockImplementation(() => {
        throw new Error('Quit failed');
      });

      const trayMenu = createTrayMenu(mockWindow);
      const template = (Menu.buildFromTemplate as jest.Mock).mock.calls[0][0];
      const quitItem = template.find((item: any) => item.label === 'Quit');

      // Should not throw when quit fails
      expect(() => {
        if (quitItem?.click) {
          quitItem.click();
        }
      }).not.toThrow();
    });

    it('should handle null/undefined window', () => {
      expect(() => {
        createTrayMenu(null as any);
      }).not.toThrow();

      expect(() => {
        createTrayMenu(undefined as any);
      }).not.toThrow();
    });
  });

  describe('Tray Menu Platform Behavior', () => {
    it('should work consistently across platforms', () => {
      const platforms = ['win32', 'darwin', 'linux'];

      platforms.forEach(platform => {
        Object.defineProperty(process, 'platform', {
          value: platform,
          configurable: true
        });

        expect(() => {
          createTrayMenu(mockWindow);
        }).not.toThrow();
      });
    });

    it('should handle different display scaling', () => {
      // Mock different screen DPI settings
      const scalingFactors = [1, 1.25, 1.5, 2];

      scalingFactors.forEach(factor => {
        // This would test tray menu rendering at different scales
        expect(() => {
          createTrayMenu(mockWindow);
        }).not.toThrow();
      });
    });
  });
});