/**
 * Menu Test Utilities
 *
 * Utility class providing helper methods for menu testing including:
 * - Menu structure validation
 * - Accelerator extraction and validation
 * - Menu state simulation
 * - Cross-platform compatibility helpers
 * - Performance testing utilities
 */

import { MenuItemConstructorOptions, BrowserWindow, Menu } from 'electron';

export class MenuTestUtils {
  private createdMenus: Menu[] = [];
  private timeouts: NodeJS.Timeout[] = [];

  constructor() {
    this.createdMenus = [];
    this.timeouts = [];
  }

  /**
   * Clean up test resources
   */
  cleanup(): void {
    this.createdMenus = [];
    this.timeouts.forEach(timeout => clearTimeout(timeout));
    this.timeouts = [];
  }

  /**
   * Extract all accelerators from a menu template
   */
  extractAccelerators(template: MenuItemConstructorOptions[]): string[] {
    const accelerators: string[] = [];

    const extractFromItems = (items: MenuItemConstructorOptions[]) => {
      items.forEach(item => {
        if (item.accelerator) {
          accelerators.push(item.accelerator);
        }
        if (item.submenu && Array.isArray(item.submenu)) {
          extractFromItems(item.submenu);
        }
      });
    };

    extractFromItems(template);
    return accelerators.filter(acc => acc && acc.length > 0);
  }

  /**
   * Convert accelerator for specific platform
   */
  convertAcceleratorForPlatform(accelerator: string, platform: string): string {
    if (platform === 'darwin') {
      return accelerator.replace(/CmdOrCtrl/g, 'Cmd');
    } else {
      return accelerator.replace(/CmdOrCtrl/g, 'Ctrl');
    }
  }

  /**
   * Validate accelerator format
   */
  isValidAccelerator(accelerator: string): boolean {
    if (!accelerator || typeof accelerator !== 'string') {
      return false;
    }

    // Valid modifier keys
    const validModifiers = ['Ctrl', 'Cmd', 'Alt', 'Shift', 'CmdOrCtrl'];
    const validKeys = [
      // Letters
      'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
      'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
      // Numbers
      '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
      // Function keys
      'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12',
      // Special keys
      'Enter', 'Space', 'Tab', 'Escape', 'Backspace', 'Delete',
      'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
      'Home', 'End', 'PageUp', 'PageDown',
      // Symbols
      '/', ',', '.', ';', "'", '[', ']', '\\', '=', '-'
    ];

    // Parse accelerator
    const parts = accelerator.split('+');
    if (parts.length < 2) {
      return false;
    }

    const key = parts[parts.length - 1];
    const modifiers = parts.slice(0, -1);

    // Validate key
    if (!validKeys.includes(key)) {
      return false;
    }

    // Validate modifiers
    return modifiers.every(modifier => validModifiers.includes(modifier));
  }

  /**
   * Check if accelerator is reserved by system
   */
  isReservedShortcut(accelerator: string): boolean {
    const reservedShortcuts = [
      'Ctrl+Alt+Del',
      'Cmd+Space',
      'Alt+Tab',
      'Cmd+Tab',
      'Ctrl+Shift+Esc',
      'Cmd+Option+Esc',
      'Windows+L',
      'Windows+D',
      'Windows+R',
      'F11' // Often reserved for fullscreen
    ];

    return reservedShortcuts.includes(accelerator);
  }

  /**
   * Find menu item by label
   */
  findMenuItemByLabel(template: MenuItemConstructorOptions[] | Menu, label: string): MenuItemConstructorOptions | undefined {
    let items: MenuItemConstructorOptions[];

    if (Array.isArray(template)) {
      items = template;
    } else {
      // In a real implementation, you'd extract items from Menu object
      items = [];
    }

    const findInItems = (items: MenuItemConstructorOptions[]): MenuItemConstructorOptions | undefined => {
      for (const item of items) {
        if (item.label === label) {
          return item;
        }
        if (item.submenu && Array.isArray(item.submenu)) {
          const found = findInItems(item.submenu);
          if (found) return found;
        }
      }
      return undefined;
    };

    return findInItems(items);
  }

  /**
   * Find menu items by action type
   */
  findMenuItemsByAction(template: MenuItemConstructorOptions[], action: string): MenuItemConstructorOptions[] {
    const items: MenuItemConstructorOptions[] = [];

    const searchItems = (items: MenuItemConstructorOptions[]) => {
      items.forEach(item => {
        if (item.label?.toLowerCase().includes(action)) {
          items.push(item);
        }
        if (item.submenu && Array.isArray(item.submenu)) {
          searchItems(item.submenu);
        }
      });
    };

    searchItems(template);
    return items;
  }

  /**
   * Get interactive menu items (excluding separators)
   */
  getInteractiveMenuItems(template: MenuItemConstructorOptions[]): MenuItemConstructorOptions[] {
    const interactiveItems: MenuItemConstructorOptions[] = [];

    const collectItems = (items: MenuItemConstructorOptions[]) => {
      items.forEach(item => {
        if (item.type !== 'separator' && (item.click || item.role || item.submenu)) {
          interactiveItems.push(item);
        }
        if (item.submenu && Array.isArray(item.submenu)) {
          collectItems(item.submenu);
        }
      });
    };

    collectItems(template);
    return interactiveItems;
  }

  /**
   * Create menu with specific application state
   */
  createMenuWithState(window: BrowserWindow, state: any): Menu {
    // Mock menu creation with state
    const template: MenuItemConstructorOptions[] = [
      {
        label: 'File',
        submenu: [
          {
            label: 'Export KB...',
            enabled: state?.hasKBEntries !== false
          }
        ]
      },
      {
        label: 'Tools',
        submenu: [
          {
            label: 'Test AI Connection',
            enabled: state?.isConnected !== false
          }
        ]
      }
    ];

    return Menu.buildFromTemplate(template);
  }

  /**
   * Create menu with specific operation state
   */
  createMenuWithOperation(window: BrowserWindow, operation: string): Menu {
    const operationLabels: { [key: string]: string } = {
      'searching': 'Stop Search',
      'importing': 'Cancel Import',
      'exporting': 'Cancel Export',
      'idle': 'Find...'
    };

    const template: MenuItemConstructorOptions[] = [
      {
        label: 'Edit',
        submenu: [
          {
            label: operationLabels[operation] || 'Find...',
            accelerator: 'CmdOrCtrl+F'
          }
        ]
      }
    ];

    return Menu.buildFromTemplate(template);
  }

  /**
   * Create menu with feature flags
   */
  createMenuWithFeatures(window: BrowserWindow, features: any): Menu {
    const template: MenuItemConstructorOptions[] = [
      {
        label: 'Tools',
        submenu: [
          ...(features.aiEnabled ? [{
            label: 'AI Settings',
            click: () => {}
          }] : []),
          ...(features.backupEnabled ? [{
            label: 'Backup Database',
            click: () => {}
          }] : []),
          ...(features.developerMode ? [{
            label: 'Developer Tools',
            submenu: [
              { label: 'Load Sample Data', click: () => {} }
            ]
          }] : [])
        ]
      }
    ];

    return Menu.buildFromTemplate(template);
  }

  /**
   * Check if menu has specific item
   */
  hasMenuItem(menu: Menu | MenuItemConstructorOptions[], label: string): boolean {
    // In a real implementation, you'd check the actual menu structure
    return this.findMenuItemByLabel(menu as any, label) !== undefined;
  }

  /**
   * Check if menu item is enabled
   */
  isMenuItemEnabled(menu: Menu | MenuItemConstructorOptions[], label: string): boolean {
    const item = this.findMenuItemByLabel(menu as any, label);
    return item?.enabled !== false;
  }

  /**
   * Broadcast state change to multiple windows
   */
  broadcastStateChange(windows: BrowserWindow[], state: any): void {
    windows.forEach(window => {
      if (window && !window.isDestroyed()) {
        window.webContents.send('menu-state-change', state);
      }
    });
  }

  /**
   * Update menu from state
   */
  updateMenuFromState(window: BrowserWindow, state: any): Menu {
    // Simulate menu update based on state
    return this.createMenuWithState(window, state);
  }

  /**
   * Debounce menu updates
   */
  debounceMenuUpdate(updateFn: Function, delay: number): Function {
    let timeoutId: NodeJS.Timeout;

    return (...args: any[]) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        updateFn(...args);
      }, delay);
      this.timeouts.push(timeoutId);
    };
  }

  /**
   * Create menu for specific view
   */
  createMenuForView(window: BrowserWindow, currentView: string): Menu {
    const template: MenuItemConstructorOptions[] = [
      {
        label: 'View',
        submenu: [
          {
            label: 'Dashboard',
            checked: currentView === 'dashboard',
            type: 'radio'
          },
          {
            label: 'Knowledge Base',
            checked: currentView === 'knowledge-base',
            type: 'radio'
          },
          {
            label: 'Search',
            checked: currentView === 'search',
            type: 'radio'
          }
        ]
      }
    ];

    return Menu.buildFromTemplate(template);
  }

  /**
   * Find navigation item
   */
  findNavigationItem(menu: Menu, view: string): MenuItemConstructorOptions | undefined {
    // Map view names to menu labels
    const viewLabels: { [key: string]: string } = {
      'dashboard': 'Dashboard',
      'knowledge-base': 'Knowledge Base',
      'search': 'Search'
    };

    return this.findMenuItemByLabel(menu as any, viewLabels[view]);
  }

  /**
   * Create menu for specific user role
   */
  createMenuForRole(window: BrowserWindow, role: string): Menu {
    const permissions = this.getRolePermissions(role);

    const template: MenuItemConstructorOptions[] = [
      {
        label: 'File',
        submenu: [
          {
            label: 'New KB Entry',
            enabled: permissions.includes('create')
          },
          {
            label: 'Export KB...',
            enabled: permissions.includes('export')
          },
          {
            label: 'Backup Database',
            enabled: permissions.includes('backup')
          }
        ]
      },
      {
        label: 'Edit',
        submenu: [
          {
            label: 'Delete Entry',
            enabled: permissions.includes('delete')
          }
        ]
      }
    ];

    return Menu.buildFromTemplate(template);
  }

  /**
   * Get permissions for role
   */
  private getRolePermissions(role: string): string[] {
    const rolePermissions: { [key: string]: string[] } = {
      'admin': ['create', 'edit', 'delete', 'export', 'backup'],
      'editor': ['create', 'edit', 'export'],
      'viewer': ['export']
    };

    return rolePermissions[role] || [];
  }

  /**
   * Create menu with selection state
   */
  createMenuWithSelection(window: BrowserWindow, selection: { hasSelection: boolean; selectedCount: number }): Menu {
    const template: MenuItemConstructorOptions[] = [
      {
        label: 'Edit',
        submenu: [
          {
            label: 'Cut',
            role: 'cut',
            enabled: selection.hasSelection
          },
          {
            label: 'Copy',
            role: 'copy',
            enabled: selection.hasSelection
          },
          {
            label: 'Delete',
            enabled: selection.hasSelection && selection.selectedCount > 0
          }
        ]
      }
    ];

    return Menu.buildFromTemplate(template);
  }

  /**
   * Create menu with persisted state
   */
  createMenuWithPersistedState(window: BrowserWindow, persistedState: any): Menu {
    try {
      const state = typeof persistedState === 'string'
        ? JSON.parse(persistedState)
        : persistedState;

      return this.createMenuWithState(window, state || {});
    } catch (error) {
      // Return default menu on error
      return this.createMenuWithState(window, {});
    }
  }

  /**
   * Get theme state from menu
   */
  getThemeState(menu: Menu): { current: string } {
    // In a real implementation, you'd extract the current theme from the menu
    return { current: 'system' };
  }

  /**
   * Simulate menu performance test
   */
  measureMenuCreationTime(createMenuFn: () => Menu, iterations: number = 100): number {
    const startTime = Date.now();

    for (let i = 0; i < iterations; i++) {
      createMenuFn();
    }

    return Date.now() - startTime;
  }

  /**
   * Test menu memory usage
   */
  measureMenuMemoryUsage(createMenuFn: () => Menu, iterations: number = 1000): number {
    const initialMemory = process.memoryUsage().heapUsed;

    for (let i = 0; i < iterations; i++) {
      createMenuFn();
    }

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    return process.memoryUsage().heapUsed - initialMemory;
  }

  /**
   * Validate menu structure
   */
  validateMenuStructure(template: MenuItemConstructorOptions[]): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    const validateItems = (items: MenuItemConstructorOptions[], path: string = '') => {
      items.forEach((item, index) => {
        const itemPath = `${path}[${index}]`;

        // Validate required properties
        if (item.type !== 'separator' && !item.label) {
          errors.push(`${itemPath}: Missing label`);
        }

        // Validate accelerator format
        if (item.accelerator && !this.isValidAccelerator(item.accelerator)) {
          errors.push(`${itemPath}: Invalid accelerator format: ${item.accelerator}`);
        }

        // Validate submenu
        if (item.submenu && Array.isArray(item.submenu)) {
          validateItems(item.submenu, `${itemPath}.submenu`);
        }

        // Validate radio groups
        if (item.type === 'radio' && item.checked) {
          const siblingRadios = items.filter(i => i.type === 'radio');
          const checkedRadios = siblingRadios.filter(i => i.checked);
          if (checkedRadios.length > 1) {
            errors.push(`${itemPath}: Multiple radio items checked in same group`);
          }
        }
      });
    };

    validateItems(template);

    return {
      valid: errors.length === 0,
      errors
    };
  }
}