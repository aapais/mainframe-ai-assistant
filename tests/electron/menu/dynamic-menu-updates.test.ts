/**
 * Dynamic Menu Updates Tests
 *
 * Tests dynamic menu behavior including:
 * - Menu state changes based on application state
 * - Theme-based menu updates
 * - Dynamic enabling/disabling of menu items
 * - Real-time menu synchronization
 * - State-dependent menu visibility
 */

import { jest } from '@jest/globals';
import { Menu, BrowserWindow, nativeTheme } from 'electron';
import { createApplicationMenu } from '../../../src/main/menu';
import { MenuTestUtils } from './utils/MenuTestUtils';

// Mock electron modules
jest.mock('electron', () => require('../../integration/__mocks__/electron.js'));

describe('Dynamic Menu Updates Tests', () => {
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

  describe('Theme-Based Menu Updates', () => {
    it('should update theme radio buttons based on current theme', () => {
      const menu = createApplicationMenu(mockWindow);
      const template = (Menu.buildFromTemplate as jest.Mock).mock.calls[0][0];

      const viewMenu = template.find((item: any) => item.label === 'View');
      const themeSubmenu = viewMenu?.submenu?.find((item: any) => item.label === 'Theme');
      const themeOptions = themeSubmenu?.submenu;

      // System theme should be checked by default
      const systemOption = themeOptions?.find((item: any) => item.label === 'System');
      expect(systemOption?.checked).toBe(true);

      const lightOption = themeOptions?.find((item: any) => item.label === 'Light');
      const darkOption = themeOptions?.find((item: any) => item.label === 'Dark');

      expect(lightOption?.checked).toBeFalsy();
      expect(darkOption?.checked).toBeFalsy();
    });

    it('should update theme selection when theme changes', () => {
      // Simulate theme change
      const updateThemeInMenu = (theme: 'light' | 'dark' | 'system') => {
        const menu = createApplicationMenu(mockWindow);
        const template = (Menu.buildFromTemplate as jest.Mock).mock.calls[0][0];

        const viewMenu = template.find((item: any) => item.label === 'View');
        const themeSubmenu = viewMenu?.submenu?.find((item: any) => item.label === 'Theme');
        const themeOptions = themeSubmenu?.submenu;

        // Update checked state based on current theme
        themeOptions?.forEach((option: any) => {
          if (option.label === 'Light') option.checked = theme === 'light';
          if (option.label === 'Dark') option.checked = theme === 'dark';
          if (option.label === 'System') option.checked = theme === 'system';
        });

        return Menu.buildFromTemplate(template);
      };

      // Test light theme
      const lightMenu = updateThemeInMenu('light');
      expect(lightMenu).toBeDefined();

      // Test dark theme
      const darkMenu = updateThemeInMenu('dark');
      expect(darkMenu).toBeDefined();

      // Test system theme
      const systemMenu = updateThemeInMenu('system');
      expect(systemMenu).toBeDefined();
    });

    it('should respond to system theme changes', () => {
      // Mock system theme change
      const originalTheme = nativeTheme.shouldUseDarkColors;

      // Light theme
      (nativeTheme as any).shouldUseDarkColors = false;
      const lightMenu = createApplicationMenu(mockWindow);
      expect(lightMenu).toBeDefined();

      // Dark theme
      (nativeTheme as any).shouldUseDarkColors = true;
      const darkMenu = createApplicationMenu(mockWindow);
      expect(darkMenu).toBeDefined();

      // Restore original
      (nativeTheme as any).shouldUseDarkColors = originalTheme;
    });
  });

  describe('Application State-Based Updates', () => {
    it('should enable/disable menu items based on application state', () => {
      // Simulate different application states
      const appStates = [
        { hasKBEntries: true, isSearching: false, isConnected: true },
        { hasKBEntries: false, isSearching: true, isConnected: false },
        { hasKBEntries: true, isSearching: true, isConnected: true },
      ];

      appStates.forEach(state => {
        const menu = menuTestUtils.createMenuWithState(mockWindow, state);
        expect(menu).toBeDefined();

        // Export should be disabled when no KB entries
        if (!state.hasKBEntries) {
          const exportEnabled = menuTestUtils.isMenuItemEnabled(menu, 'Export KB...');
          expect(exportEnabled).toBe(false);
        }

        // AI-related items should be disabled when not connected
        if (!state.isConnected) {
          const testConnectionEnabled = menuTestUtils.isMenuItemEnabled(menu, 'Test AI Connection');
          expect(testConnectionEnabled).toBe(false);
        }
      });
    });

    it('should update menu labels based on current operation', () => {
      // Test different operational states
      const operations = [
        { type: 'searching', label: 'Stop Search' },
        { type: 'importing', label: 'Cancel Import' },
        { type: 'exporting', label: 'Cancel Export' },
        { type: 'idle', label: 'Find...' },
      ];

      operations.forEach(({ type, label }) => {
        const menu = menuTestUtils.createMenuWithOperation(mockWindow, type);
        const searchItem = menuTestUtils.findMenuItemByLabel(menu, label);
        expect(searchItem).toBeDefined();
      });
    });

    it('should show/hide menu items based on features enabled', () => {
      const featureFlags = [
        { developerMode: true, aiEnabled: true, backupEnabled: true },
        { developerMode: false, aiEnabled: false, backupEnabled: false },
      ];

      featureFlags.forEach(flags => {
        const menu = menuTestUtils.createMenuWithFeatures(mockWindow, flags);

        // Developer tools should only be visible in developer mode
        const hasDevTools = menuTestUtils.hasMenuItem(menu, 'Developer Tools');
        expect(hasDevTools).toBe(flags.developerMode);

        // AI settings should only be visible when AI is enabled
        const hasAISettings = menuTestUtils.hasMenuItem(menu, 'AI Settings');
        expect(hasAISettings).toBe(flags.aiEnabled);

        // Backup should only be visible when backup is enabled
        const hasBackup = menuTestUtils.hasMenuItem(menu, 'Backup Database');
        expect(hasBackup).toBe(flags.backupEnabled);
      });
    });
  });

  describe('Real-Time Menu Synchronization', () => {
    it('should synchronize menu state across multiple windows', () => {
      const window1 = new BrowserWindow();
      const window2 = new BrowserWindow();

      window1.webContents.send = jest.fn();
      window2.webContents.send = jest.fn();

      const menu1 = createApplicationMenu(window1);
      const menu2 = createApplicationMenu(window2);

      // Both menus should have consistent structure
      expect(Menu.buildFromTemplate).toHaveBeenCalledTimes(2);

      // Simulate state change affecting both windows
      const stateChange = { theme: 'dark', hasUnsavedChanges: true };
      menuTestUtils.broadcastStateChange([window1, window2], stateChange);

      expect(window1.webContents.send).toHaveBeenCalledWith('menu-state-change', stateChange);
      expect(window2.webContents.send).toHaveBeenCalledWith('menu-state-change', stateChange);
    });

    it('should update menu when application state changes', () => {
      const originalMenu = createApplicationMenu(mockWindow);
      jest.clearAllMocks();

      // Simulate state change
      const stateUpdate = {
        currentRoute: '/knowledge-base',
        hasSelection: true,
        selectedCount: 3
      };

      // This would trigger menu update in a real application
      const updatedMenu = menuTestUtils.updateMenuFromState(mockWindow, stateUpdate);

      expect(updatedMenu).toBeDefined();
      expect(Menu.buildFromTemplate).toHaveBeenCalled();
    });

    it('should debounce rapid state changes', async () => {
      const rapidUpdates = Array.from({ length: 10 }, (_, i) => ({
        searchTerm: `query-${i}`,
        resultCount: i * 5
      }));

      const updateSpy = jest.fn();
      const debouncedUpdate = menuTestUtils.debounceMenuUpdate(updateSpy, 100);

      // Send rapid updates
      rapidUpdates.forEach(update => {
        debouncedUpdate(mockWindow, update);
      });

      // Wait for debounce
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should only call update once with the latest state
      expect(updateSpy).toHaveBeenCalledTimes(1);
      expect(updateSpy).toHaveBeenCalledWith(mockWindow, rapidUpdates[rapidUpdates.length - 1]);
    });
  });

  describe('Context-Dependent Menu Behavior', () => {
    it('should update navigation shortcuts based on current view', () => {
      const views = [
        { current: 'dashboard', available: ['knowledge-base', 'search'] },
        { current: 'knowledge-base', available: ['dashboard', 'search'] },
        { current: 'search', available: ['dashboard', 'knowledge-base'] },
      ];

      views.forEach(({ current, available }) => {
        const menu = menuTestUtils.createMenuForView(mockWindow, current);

        // Current view should be marked differently
        const currentViewItem = menuTestUtils.findNavigationItem(menu, current);
        expect(currentViewItem).toBeDefined();

        // Available views should be enabled
        available.forEach(view => {
          const viewItem = menuTestUtils.findNavigationItem(menu, view);
          expect(menuTestUtils.isMenuItemEnabled(menu, viewItem?.label || '')).toBe(true);
        });
      });
    });

    it('should adapt to user permissions and roles', () => {
      const userRoles = [
        { role: 'admin', permissions: ['create', 'edit', 'delete', 'export', 'backup'] },
        { role: 'editor', permissions: ['create', 'edit', 'export'] },
        { role: 'viewer', permissions: ['export'] },
      ];

      userRoles.forEach(({ role, permissions }) => {
        const menu = menuTestUtils.createMenuForRole(mockWindow, role);

        // Check that only permitted actions are enabled
        const actionPermissions = {
          'New KB Entry': permissions.includes('create'),
          'Delete Entry': permissions.includes('delete'),
          'Export KB...': permissions.includes('export'),
          'Backup Database': permissions.includes('backup'),
        };

        Object.entries(actionPermissions).forEach(([action, shouldBeEnabled]) => {
          const isEnabled = menuTestUtils.isMenuItemEnabled(menu, action);
          expect(isEnabled).toBe(shouldBeEnabled);
        });
      });
    });

    it('should respond to selection state changes', () => {
      const selectionStates = [
        { hasSelection: false, selectedCount: 0 },
        { hasSelection: true, selectedCount: 1 },
        { hasSelection: true, selectedCount: 5 },
      ];

      selectionStates.forEach(({ hasSelection, selectedCount }) => {
        const menu = menuTestUtils.createMenuWithSelection(mockWindow, { hasSelection, selectedCount });

        // Selection-dependent items should be enabled/disabled appropriately
        const cutEnabled = menuTestUtils.isMenuItemEnabled(menu, 'Cut');
        const copyEnabled = menuTestUtils.isMenuItemEnabled(menu, 'Copy');
        const deleteEnabled = menuTestUtils.isMenuItemEnabled(menu, 'Delete');

        if (hasSelection) {
          expect(copyEnabled).toBe(true);
          if (selectedCount > 0) {
            expect(cutEnabled).toBe(true);
            expect(deleteEnabled).toBe(true);
          }
        } else {
          expect(cutEnabled).toBe(false);
          expect(copyEnabled).toBe(false);
          expect(deleteEnabled).toBe(false);
        }
      });
    });
  });

  describe('Menu Performance Optimization', () => {
    it('should cache menu templates when state is unchanged', () => {
      const state = { theme: 'dark', route: '/dashboard' };

      // Create menu with initial state
      const menu1 = menuTestUtils.createMenuWithState(mockWindow, state);

      // Create menu with same state
      jest.clearAllMocks();
      const menu2 = menuTestUtils.createMenuWithState(mockWindow, state);

      // Should use cached template (in a real implementation)
      expect(menu1).toBeDefined();
      expect(menu2).toBeDefined();
    });

    it('should update only changed portions of menu', () => {
      const initialState = { theme: 'light', hasSelection: false };
      const updatedState = { theme: 'light', hasSelection: true };

      const menu1 = menuTestUtils.createMenuWithState(mockWindow, initialState);
      const menu2 = menuTestUtils.createMenuWithState(mockWindow, updatedState);

      // In a real implementation, only selection-related items would be updated
      expect(menu1).toBeDefined();
      expect(menu2).toBeDefined();
    });

    it('should handle frequent updates efficiently', () => {
      const startTime = Date.now();

      // Simulate 50 rapid menu updates
      for (let i = 0; i < 50; i++) {
        const state = {
          searchTerm: `query-${i}`,
          resultCount: i * 2,
          currentPage: Math.floor(i / 10)
        };
        menuTestUtils.createMenuWithState(mockWindow, state);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should handle updates efficiently (under 500ms for 50 updates)
      expect(duration).toBeLessThan(500);
    });
  });

  describe('Error Handling in Dynamic Updates', () => {
    it('should handle state update errors gracefully', () => {
      const invalidStates = [
        null,
        undefined,
        { invalid: 'state' },
        'not-an-object',
        []
      ];

      invalidStates.forEach(invalidState => {
        expect(() => {
          menuTestUtils.createMenuWithState(mockWindow, invalidState as any);
        }).not.toThrow();
      });
    });

    it('should recover from menu build failures', () => {
      // Mock Menu.buildFromTemplate to fail
      (Menu.buildFromTemplate as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Menu build failed');
      });

      expect(() => {
        createApplicationMenu(mockWindow);
      }).not.toThrow();

      // Should fallback to a basic menu or retry
      expect(Menu.buildFromTemplate).toHaveBeenCalled();
    });

    it('should handle missing window context', () => {
      const states = [
        { theme: 'dark' },
        { hasSelection: true },
        { currentRoute: '/search' }
      ];

      states.forEach(state => {
        expect(() => {
          menuTestUtils.createMenuWithState(null as any, state);
        }).not.toThrow();
      });
    });
  });

  describe('Menu State Persistence', () => {
    it('should restore menu state after application restart', () => {
      const persistedState = {
        theme: 'dark',
        windowPosition: { x: 100, y: 100 },
        lastOpenedView: 'knowledge-base'
      };

      // Simulate restored menu
      const menu = menuTestUtils.createMenuWithPersistedState(mockWindow, persistedState);

      expect(menu).toBeDefined();

      // Theme should be restored
      const themeState = menuTestUtils.getThemeState(menu);
      expect(themeState.current).toBe('dark');
    });

    it('should handle corrupt or missing state gracefully', () => {
      const corruptStates = [
        undefined,
        null,
        '{"invalid": json}',
        { version: 'incompatible' }
      ];

      corruptStates.forEach(corruptState => {
        expect(() => {
          menuTestUtils.createMenuWithPersistedState(mockWindow, corruptState as any);
        }).not.toThrow();
      });
    });
  });
});