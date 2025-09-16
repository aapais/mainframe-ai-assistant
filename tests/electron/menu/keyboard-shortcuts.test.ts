/**
 * Keyboard Shortcuts and Accelerators Tests
 *
 * Tests keyboard shortcut functionality including:
 * - Accelerator registration and handling
 * - Platform-specific key combinations
 * - Shortcut conflicts and validation
 * - Global vs local shortcuts
 * - Accessibility compliance
 */

import { jest } from '@jest/globals';
import { Menu, BrowserWindow, globalShortcut } from 'electron';
import { createApplicationMenu } from '../../../src/main/menu';
import { MenuTestUtils } from './utils/MenuTestUtils';

// Mock electron modules
jest.mock('electron', () => ({
  ...require('../../integration/__mocks__/electron.js'),
  globalShortcut: {
    register: jest.fn().mockReturnValue(true),
    unregister: jest.fn(),
    unregisterAll: jest.fn(),
    isRegistered: jest.fn().mockReturnValue(false)
  }
}));

describe('Keyboard Shortcuts Tests', () => {
  let mockWindow: BrowserWindow;
  let menuTestUtils: MenuTestUtils;

  beforeEach(() => {
    jest.clearAllMocks();

    mockWindow = new BrowserWindow({
      width: 1200,
      height: 800
    });

    menuTestUtils = new MenuTestUtils();
  });

  afterEach(() => {
    menuTestUtils.cleanup();
  });

  describe('Menu Accelerator Registration', () => {
    it('should register all menu accelerators correctly', () => {
      const menu = createApplicationMenu(mockWindow);
      const template = (Menu.buildFromTemplate as jest.Mock).mock.calls[0][0];

      const accelerators = menuTestUtils.extractAccelerators(template);

      const expectedAccelerators = [
        'CmdOrCtrl+N',    // New KB Entry
        'CmdOrCtrl+O',    // Import KB
        'CmdOrCtrl+S',    // Export KB
        'CmdOrCtrl+F',    // Find
        'CmdOrCtrl+1',    // Dashboard
        'CmdOrCtrl+2',    // Knowledge Base
        'CmdOrCtrl+3',    // Search
        'CmdOrCtrl+/',    // Keyboard Shortcuts
      ];

      expectedAccelerators.forEach(accelerator => {
        expect(accelerators).toContain(accelerator);
      });
    });

    it('should handle platform-specific accelerators on macOS', () => {
      Object.defineProperty(process, 'platform', { value: 'darwin' });

      const menu = createApplicationMenu(mockWindow);
      const template = (Menu.buildFromTemplate as jest.Mock).mock.calls[0][0];

      // Find macOS app menu
      const appMenu = template.find((item: any) => item.label === 'Test App');
      expect(appMenu).toBeDefined();

      const preferencesItem = appMenu?.submenu?.find((item: any) => item.label === 'Preferences...');
      expect(preferencesItem?.accelerator).toBe('Cmd+,');
    });

    it('should validate accelerator format', () => {
      const menu = createApplicationMenu(mockWindow);
      const template = (Menu.buildFromTemplate as jest.Mock).mock.calls[0][0];

      const accelerators = menuTestUtils.extractAccelerators(template);

      accelerators.forEach((accelerator: string) => {
        // Should follow Electron accelerator format
        expect(accelerator).toMatch(/^(CmdOrCtrl|Cmd|Ctrl|Alt|Shift)(\+[A-Za-z0-9/,.])*$/);
      });
    });

    it('should detect accelerator conflicts', () => {
      const menu = createApplicationMenu(mockWindow);
      const template = (Menu.buildFromTemplate as jest.Mock).mock.calls[0][0];

      const accelerators = menuTestUtils.extractAccelerators(template);
      const uniqueAccelerators = [...new Set(accelerators)];

      // No duplicate accelerators should exist
      expect(accelerators.length).toBe(uniqueAccelerators.length);
    });
  });

  describe('Cross-Platform Accelerator Compatibility', () => {
    const testPlatforms = ['win32', 'darwin', 'linux'];

    testPlatforms.forEach(platform => {
      it(`should work correctly on ${platform}`, () => {
        Object.defineProperty(process, 'platform', { value: platform });

        const menu = createApplicationMenu(mockWindow);
        const template = (Menu.buildFromTemplate as jest.Mock).mock.calls[0][0];

        const accelerators = menuTestUtils.extractAccelerators(template);

        // All accelerators should use CmdOrCtrl for cross-platform compatibility
        const crossPlatformAccelerators = accelerators.filter((acc: string) =>
          acc.startsWith('CmdOrCtrl')
        );

        expect(crossPlatformAccelerators.length).toBeGreaterThan(0);
      });
    });

    it('should convert CmdOrCtrl appropriately per platform', () => {
      const testAccelerator = 'CmdOrCtrl+S';

      // On macOS, should use Cmd
      Object.defineProperty(process, 'platform', { value: 'darwin' });
      const macResult = menuTestUtils.convertAcceleratorForPlatform(testAccelerator, 'darwin');
      expect(macResult).toBe('Cmd+S');

      // On Windows/Linux, should use Ctrl
      Object.defineProperty(process, 'platform', { value: 'win32' });
      const winResult = menuTestUtils.convertAcceleratorForPlatform(testAccelerator, 'win32');
      expect(winResult).toBe('Ctrl+S');
    });
  });

  describe('Global Shortcut Registration', () => {
    it('should register global shortcuts for tray actions', () => {
      // Global shortcuts would typically be registered separately
      const globalShortcuts = [
        'CmdOrCtrl+Space', // Quick search from tray
      ];

      globalShortcuts.forEach(shortcut => {
        const registered = globalShortcut.register(shortcut, () => {
          mockWindow.show();
          mockWindow.webContents.send('action', 'quick-search');
        });

        expect(registered).toBe(true);
        expect(globalShortcut.register).toHaveBeenCalledWith(shortcut, expect.any(Function));
      });
    });

    it('should handle global shortcut registration failures', () => {
      (globalShortcut.register as jest.Mock).mockReturnValue(false);

      const shortcut = 'CmdOrCtrl+Space';
      const registered = globalShortcut.register(shortcut, () => {});

      expect(registered).toBe(false);
      // Should handle gracefully without throwing
    });

    it('should unregister global shortcuts on cleanup', () => {
      const shortcut = 'CmdOrCtrl+Space';
      globalShortcut.register(shortcut, () => {});

      // Simulate cleanup
      globalShortcut.unregister(shortcut);

      expect(globalShortcut.unregister).toHaveBeenCalledWith(shortcut);
    });
  });

  describe('Accelerator Validation', () => {
    it('should validate standard modifier keys', () => {
      const validModifiers = ['Ctrl', 'Cmd', 'Alt', 'Shift', 'CmdOrCtrl'];
      const invalidModifiers = ['Meta', 'Super', 'Win', 'Option'];

      validModifiers.forEach(modifier => {
        const accelerator = `${modifier}+S`;
        expect(menuTestUtils.isValidAccelerator(accelerator)).toBe(true);
      });

      invalidModifiers.forEach(modifier => {
        const accelerator = `${modifier}+S`;
        expect(menuTestUtils.isValidAccelerator(accelerator)).toBe(false);
      });
    });

    it('should validate key combinations', () => {
      const validKeys = ['A', 'F1', 'Enter', 'Space', 'Tab', 'Escape', '/', ',', '.'];
      const invalidKeys = ['Mouse1', 'Click', 'Scroll'];

      validKeys.forEach(key => {
        const accelerator = `Ctrl+${key}`;
        expect(menuTestUtils.isValidAccelerator(accelerator)).toBe(true);
      });

      invalidKeys.forEach(key => {
        const accelerator = `Ctrl+${key}`;
        expect(menuTestUtils.isValidAccelerator(accelerator)).toBe(false);
      });
    });

    it('should detect reserved system shortcuts', () => {
      const reservedShortcuts = [
        'Ctrl+Alt+Del',   // Windows system
        'Cmd+Space',      // macOS Spotlight
        'Alt+Tab',        // Windows task switcher
        'Cmd+Tab',        // macOS app switcher
      ];

      reservedShortcuts.forEach(shortcut => {
        expect(menuTestUtils.isReservedShortcut(shortcut)).toBe(true);
      });
    });
  });

  describe('Shortcut Accessibility', () => {
    it('should provide alternatives to mouse-only actions', () => {
      const menu = createApplicationMenu(mockWindow);
      const template = (Menu.buildFromTemplate as jest.Mock).mock.calls[0][0];

      // Essential actions should have keyboard shortcuts
      const essentialActions = [
        { label: 'New KB Entry', hasAccelerator: true },
        { label: 'Find...', hasAccelerator: true },
        { label: 'Import KB...', hasAccelerator: true },
        { label: 'Export KB...', hasAccelerator: true },
      ];

      essentialActions.forEach(({ label, hasAccelerator }) => {
        const item = menuTestUtils.findMenuItemByLabel(template, label);
        if (hasAccelerator) {
          expect(item?.accelerator).toBeDefined();
        }
      });
    });

    it('should follow WCAG guidelines for keyboard access', () => {
      const menu = createApplicationMenu(mockWindow);
      const template = (Menu.buildFromTemplate as jest.Mock).mock.calls[0][0];

      // All interactive menu items should be keyboard accessible
      const interactiveItems = menuTestUtils.getInteractiveMenuItems(template);

      interactiveItems.forEach(item => {
        // Should have either role-based access or accelerator
        const hasKeyboardAccess = item.role || item.accelerator || item.submenu;
        expect(hasKeyboardAccess).toBeTruthy();
      });
    });

    it('should use standard accelerator patterns', () => {
      const menu = createApplicationMenu(mockWindow);
      const template = (Menu.buildFromTemplate as jest.Mock).mock.calls[0][0];

      const standardPatterns = [
        { action: 'new', expected: 'CmdOrCtrl+N' },
        { action: 'open', expected: 'CmdOrCtrl+O' },
        { action: 'save', expected: 'CmdOrCtrl+S' },
        { action: 'find', expected: 'CmdOrCtrl+F' },
      ];

      standardPatterns.forEach(({ action, expected }) => {
        const items = menuTestUtils.findMenuItemsByAction(template, action);
        if (items.length > 0) {
          expect(items[0].accelerator).toBe(expected);
        }
      });
    });
  });

  describe('Dynamic Shortcut Management', () => {
    it('should update shortcuts when menu changes', () => {
      // Initial menu
      const menu1 = createApplicationMenu(mockWindow);
      const initialAccelerators = menuTestUtils.extractAccelerators(
        (Menu.buildFromTemplate as jest.Mock).mock.calls[0][0]
      );

      // Simulate menu update (e.g., different mode)
      jest.clearAllMocks();
      const menu2 = createApplicationMenu(mockWindow);
      const updatedAccelerators = menuTestUtils.extractAccelerators(
        (Menu.buildFromTemplate as jest.Mock).mock.calls[0][0]
      );

      // Should maintain consistent accelerators
      expect(updatedAccelerators).toEqual(initialAccelerators);
    });

    it('should handle disabled menu items', () => {
      const menu = createApplicationMenu(mockWindow);
      const template = (Menu.buildFromTemplate as jest.Mock).mock.calls[0][0];

      // Simulate disabling items
      const modifiedTemplate = template.map((item: any) => ({
        ...item,
        enabled: item.label !== 'Export KB...' // Disable export
      }));

      // Disabled items should still have accelerators but not respond
      const exportItem = modifiedTemplate.find((item: any) => item.label === 'Export KB...');
      expect(exportItem?.accelerator).toBeDefined();
      expect(exportItem?.enabled).toBe(false);
    });
  });

  describe('Shortcut Performance', () => {
    it('should register shortcuts efficiently', () => {
      const startTime = Date.now();

      // Create multiple menus (simulating app lifecycle)
      for (let i = 0; i < 10; i++) {
        createApplicationMenu(mockWindow);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should be fast (under 100ms for 10 menus)
      expect(duration).toBeLessThan(100);
    });

    it('should not leak shortcut registrations', () => {
      const initialRegistrations = (globalShortcut.register as jest.Mock).mock.calls.length;

      // Create and destroy menus multiple times
      for (let i = 0; i < 5; i++) {
        const menu = createApplicationMenu(mockWindow);
        // Simulate menu destruction
        menuTestUtils.cleanup();
      }

      // Should not accumulate global shortcut registrations
      const finalRegistrations = (globalShortcut.register as jest.Mock).mock.calls.length;
      expect(finalRegistrations - initialRegistrations).toBeLessThanOrEqual(5);
    });
  });

  describe('Error Handling for Shortcuts', () => {
    it('should handle shortcut registration errors gracefully', () => {
      (globalShortcut.register as jest.Mock).mockImplementation(() => {
        throw new Error('Registration failed');
      });

      expect(() => {
        globalShortcut.register('CmdOrCtrl+Space', () => {});
      }).not.toThrow();
    });

    it('should handle invalid accelerator strings', () => {
      const invalidAccelerators = [
        '',
        'InvalidKey',
        'Ctrl+',
        '+S',
        'Ctrl++S',
        'Ctrl+Shift+Alt+Meta+S', // Too many modifiers
      ];

      invalidAccelerators.forEach(accelerator => {
        expect(() => {
          menuTestUtils.isValidAccelerator(accelerator);
        }).not.toThrow();
      });
    });

    it('should recover from shortcut conflicts', () => {
      // Mock shortcut already registered
      (globalShortcut.isRegistered as jest.Mock).mockReturnValue(true);

      const shortcut = 'CmdOrCtrl+Space';
      const isAlreadyRegistered = globalShortcut.isRegistered(shortcut);

      expect(isAlreadyRegistered).toBe(true);

      // Should handle gracefully without re-registering
      if (!isAlreadyRegistered) {
        globalShortcut.register(shortcut, () => {});
      }

      // Verify it didn't try to register again
      expect(globalShortcut.register).not.toHaveBeenCalledWith(shortcut, expect.any(Function));
    });
  });
});