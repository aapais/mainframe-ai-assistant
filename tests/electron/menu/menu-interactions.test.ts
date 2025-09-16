/**
 * Comprehensive Menu Interaction Tests for Electron Application
 *
 * Tests all menu functionality including:
 * - Application menu creation and structure
 * - Menu item click handlers and IPC communication
 * - Context menu implementation
 * - Keyboard shortcuts and accelerators
 * - Dynamic menu updates
 * - Platform-specific menu behaviors
 */

import { jest } from '@jest/globals';
import { Menu, MenuItemConstructorOptions, BrowserWindow, app, dialog, shell } from 'electron';
import {
  createApplicationMenu,
  createKBEntryContextMenu,
  createTrayMenu
} from '../../../src/main/menu';
import { MenuTestUtils } from './utils/MenuTestUtils';

// Mock electron modules
jest.mock('electron', () => require('../../integration/__mocks__/electron.js'));
jest.mock('electron-updater', () => ({
  autoUpdater: {
    checkForUpdatesAndNotify: jest.fn().mockResolvedValue({})
  }
}));

describe('Menu Interactions Test Suite', () => {
  let mockWindow: BrowserWindow;
  let menuTestUtils: MenuTestUtils;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock window
    mockWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    // Initialize test utilities
    menuTestUtils = new MenuTestUtils();

    // Mock platform
    Object.defineProperty(process, 'platform', {
      value: 'win32',
      writable: true
    });

    // Mock environment
    process.env.NODE_ENV = 'development';
  });

  afterEach(() => {
    menuTestUtils.cleanup();
    jest.restoreAllMocks();
  });

  describe('Application Menu Creation', () => {
    it('should create application menu with all required sections', () => {
      const menu = createApplicationMenu(mockWindow);

      expect(Menu.buildFromTemplate).toHaveBeenCalled();
      expect(menu).toBeDefined();

      const template = (Menu.buildFromTemplate as jest.Mock).mock.calls[0][0];

      // Verify main menu sections exist
      const menuLabels = template.map((item: MenuItemConstructorOptions) => item.label);
      expect(menuLabels).toContain('File');
      expect(menuLabels).toContain('Edit');
      expect(menuLabels).toContain('View');
      expect(menuLabels).toContain('Tools');
      expect(menuLabels).toContain('Window');
      expect(menuLabels).toContain('Help');
    });

    it('should include macOS-specific app menu on darwin platform', () => {
      Object.defineProperty(process, 'platform', { value: 'darwin' });

      const menu = createApplicationMenu(mockWindow);
      const template = (Menu.buildFromTemplate as jest.Mock).mock.calls[0][0];

      // First item should be app menu on macOS
      expect(template[0].label).toBe(app.getName());
      expect(template[0].submenu).toContainEqual(
        expect.objectContaining({ role: 'about' })
      );
    });

    it('should exclude macOS-specific items on Windows/Linux', () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });

      const menu = createApplicationMenu(mockWindow);
      const template = (Menu.buildFromTemplate as jest.Mock).mock.calls[0][0];

      // Should not start with app menu
      expect(template[0].label).not.toBe(app.getName());
      expect(template[0].label).toBe('File');
    });

    it('should include development tools in development environment', () => {
      process.env.NODE_ENV = 'development';

      const menu = createApplicationMenu(mockWindow);
      const template = (Menu.buildFromTemplate as jest.Mock).mock.calls[0][0];

      const toolsMenu = template.find((item: MenuItemConstructorOptions) => item.label === 'Tools');
      const toolsSubmenu = toolsMenu?.submenu as MenuItemConstructorOptions[];

      // Check for developer tools section
      const hasDevTools = toolsSubmenu.some((item: MenuItemConstructorOptions) =>
        item.label === 'Developer Tools'
      );
      expect(hasDevTools).toBe(true);
    });

    it('should exclude development tools in production environment', () => {
      process.env.NODE_ENV = 'production';

      const menu = createApplicationMenu(mockWindow);
      const template = (Menu.buildFromTemplate as jest.Mock).mock.calls[0][0];

      const toolsMenu = template.find((item: MenuItemConstructorOptions) => item.label === 'Tools');
      const toolsSubmenu = toolsMenu?.submenu as MenuItemConstructorOptions[];

      // Check that developer tools section is not present
      const hasDevTools = toolsSubmenu.some((item: MenuItemConstructorOptions) =>
        item.label === 'Developer Tools'
      );
      expect(hasDevTools).toBe(false);
    });
  });

  describe('File Menu Operations', () => {
    let fileMenuItems: MenuItemConstructorOptions[];

    beforeEach(() => {
      const menu = createApplicationMenu(mockWindow);
      const template = (Menu.buildFromTemplate as jest.Mock).mock.calls[0][0];
      const fileMenu = template.find((item: MenuItemConstructorOptions) => item.label === 'File');
      fileMenuItems = fileMenu?.submenu as MenuItemConstructorOptions[];
    });

    it('should have New KB Entry menu item with correct accelerator', () => {
      const newEntryItem = fileMenuItems.find(item => item.label === 'New KB Entry');

      expect(newEntryItem).toBeDefined();
      expect(newEntryItem?.accelerator).toBe('CmdOrCtrl+N');
    });

    it('should send correct IPC message when New KB Entry is clicked', () => {
      const newEntryItem = fileMenuItems.find(item => item.label === 'New KB Entry');

      // Simulate menu click
      if (newEntryItem?.click) {
        newEntryItem.click({} as any, mockWindow, {} as any);
      }

      expect(mockWindow.webContents.send).toHaveBeenCalledWith('action', 'new-kb-entry');
    });

    it('should handle Import KB dialog correctly', async () => {
      const importItem = fileMenuItems.find(item => item.label === 'Import KB...');

      // Mock successful dialog
      (dialog.showOpenDialog as jest.Mock).mockResolvedValue({
        canceled: false,
        filePaths: ['/test/path/kb-export.json']
      });

      // Simulate menu click
      if (importItem?.click) {
        await importItem.click({} as any, mockWindow, {} as any);
      }

      expect(dialog.showOpenDialog).toHaveBeenCalledWith(mockWindow, {
        properties: ['openFile'],
        filters: [
          { name: 'JSON Files', extensions: ['json'] },
          { name: 'CSV Files', extensions: ['csv'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'import-kb',
        '/test/path/kb-export.json'
      );
    });

    it('should handle Export KB dialog correctly', async () => {
      const exportItem = fileMenuItems.find(item => item.label === 'Export KB...');

      // Mock successful dialog
      (dialog.showSaveDialog as jest.Mock).mockResolvedValue({
        canceled: false,
        filePath: '/test/path/kb-export-2025-09-15.json'
      });

      // Simulate menu click
      if (exportItem?.click) {
        await exportItem.click({} as any, mockWindow, {} as any);
      }

      expect(dialog.showSaveDialog).toHaveBeenCalledWith(mockWindow, expect.objectContaining({
        filters: [
          { name: 'JSON Files', extensions: ['json'] },
          { name: 'CSV Files', extensions: ['csv'] }
        ]
      }));

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'export-kb',
        '/test/path/kb-export-2025-09-15.json'
      );
    });

    it('should not send IPC message when dialog is canceled', async () => {
      const importItem = fileMenuItems.find(item => item.label === 'Import KB...');

      // Mock canceled dialog
      (dialog.showOpenDialog as jest.Mock).mockResolvedValue({
        canceled: true,
        filePaths: []
      });

      // Simulate menu click
      if (importItem?.click) {
        await importItem.click({} as any, mockWindow, {} as any);
      }

      expect(mockWindow.webContents.send).not.toHaveBeenCalledWith(
        expect.stringMatching(/import/),
        expect.anything()
      );
    });

    it('should trigger backup database action', () => {
      const backupItem = fileMenuItems.find(item => item.label === 'Backup Database');

      // Simulate menu click
      if (backupItem?.click) {
        backupItem.click({} as any, mockWindow, {} as any);
      }

      expect(mockWindow.webContents.send).toHaveBeenCalledWith('action', 'backup-database');
    });
  });

  describe('Edit Menu Operations', () => {
    let editMenuItems: MenuItemConstructorOptions[];

    beforeEach(() => {
      const menu = createApplicationMenu(mockWindow);
      const template = (Menu.buildFromTemplate as jest.Mock).mock.calls[0][0];
      const editMenu = template.find((item: MenuItemConstructorOptions) => item.label === 'Edit');
      editMenuItems = editMenu?.submenu as MenuItemConstructorOptions[];
    });

    it('should include standard edit operations', () => {
      const expectedRoles = ['undo', 'redo', 'cut', 'copy', 'paste', 'delete', 'selectAll'];

      expectedRoles.forEach(role => {
        const item = editMenuItems.find(item => item.role === role);
        expect(item).toBeDefined();
      });
    });

    it('should include Find action with correct accelerator', () => {
      const findItem = editMenuItems.find(item => item.label === 'Find...');

      expect(findItem).toBeDefined();
      expect(findItem?.accelerator).toBe('CmdOrCtrl+F');
    });

    it('should send focus-search IPC message when Find is clicked', () => {
      const findItem = editMenuItems.find(item => item.label === 'Find...');

      // Simulate menu click
      if (findItem?.click) {
        findItem.click({} as any, mockWindow, {} as any);
      }

      expect(mockWindow.webContents.send).toHaveBeenCalledWith('action', 'focus-search');
    });

    it('should include macOS-specific edit items on darwin platform', () => {
      Object.defineProperty(process, 'platform', { value: 'darwin' });

      const menu = createApplicationMenu(mockWindow);
      const template = (Menu.buildFromTemplate as jest.Mock).mock.calls[0][0];
      const editMenu = template.find((item: MenuItemConstructorOptions) => item.label === 'Edit');
      const macEditItems = editMenu?.submenu as MenuItemConstructorOptions[];

      const hasMatchStyle = macEditItems.some(item => item.role === 'pasteAndMatchStyle');
      const hasSpeech = macEditItems.some(item => item.label === 'Speech');

      expect(hasMatchStyle).toBe(true);
      expect(hasSpeech).toBe(true);
    });
  });

  describe('View Menu Operations', () => {
    let viewMenuItems: MenuItemConstructorOptions[];

    beforeEach(() => {
      const menu = createApplicationMenu(mockWindow);
      const template = (Menu.buildFromTemplate as jest.Mock).mock.calls[0][0];
      const viewMenu = template.find((item: MenuItemConstructorOptions) => item.label === 'View');
      viewMenuItems = viewMenu?.submenu as MenuItemConstructorOptions[];
    });

    it('should include navigation shortcuts with correct accelerators', () => {
      const navigationItems = [
        { label: 'Dashboard', accelerator: 'CmdOrCtrl+1' },
        { label: 'Knowledge Base', accelerator: 'CmdOrCtrl+2' },
        { label: 'Search', accelerator: 'CmdOrCtrl+3' }
      ];

      navigationItems.forEach(({ label, accelerator }) => {
        const item = viewMenuItems.find(item => item.label === label);
        expect(item).toBeDefined();
        expect(item?.accelerator).toBe(accelerator);
      });
    });

    it('should send navigation IPC messages', () => {
      const dashboardItem = viewMenuItems.find(item => item.label === 'Dashboard');

      // Simulate menu click
      if (dashboardItem?.click) {
        dashboardItem.click({} as any, mockWindow, {} as any);
      }

      expect(mockWindow.webContents.send).toHaveBeenCalledWith('navigate', '/dashboard');
    });

    it('should include theme submenu with radio options', () => {
      const themeItem = viewMenuItems.find(item => item.label === 'Theme');
      const themeSubmenu = themeItem?.submenu as MenuItemConstructorOptions[];

      expect(themeSubmenu).toBeDefined();

      const themes = ['Light', 'Dark', 'System'];
      themes.forEach(theme => {
        const themeOption = themeSubmenu.find(item => item.label === theme);
        expect(themeOption).toBeDefined();
        expect(themeOption?.type).toBe('radio');
      });

      // System should be checked by default
      const systemTheme = themeSubmenu.find(item => item.label === 'System');
      expect(systemTheme?.checked).toBe(true);
    });

    it('should send theme change IPC messages', () => {
      const themeItem = viewMenuItems.find(item => item.label === 'Theme');
      const themeSubmenu = themeItem?.submenu as MenuItemConstructorOptions[];
      const darkTheme = themeSubmenu.find(item => item.label === 'Dark');

      // Simulate theme selection
      if (darkTheme?.click) {
        darkTheme.click({} as any, mockWindow, {} as any);
      }

      expect(mockWindow.webContents.send).toHaveBeenCalledWith('set-theme', 'dark');
    });

    it('should include standard view controls', () => {
      const standardRoles = ['reload', 'forceReload', 'toggleDevTools', 'resetZoom', 'zoomIn', 'zoomOut', 'togglefullscreen'];

      standardRoles.forEach(role => {
        const item = viewMenuItems.find(item => item.role === role);
        expect(item).toBeDefined();
      });
    });
  });

  describe('Tools Menu Operations', () => {
    let toolsMenuItems: MenuItemConstructorOptions[];

    beforeEach(() => {
      const menu = createApplicationMenu(mockWindow);
      const template = (Menu.buildFromTemplate as jest.Mock).mock.calls[0][0];
      const toolsMenu = template.find((item: MenuItemConstructorOptions) => item.label === 'Tools');
      toolsMenuItems = toolsMenu?.submenu as MenuItemConstructorOptions[];
    });

    it('should include maintenance operations', () => {
      const maintenanceItems = [
        'Clear Search History',
        'Reset Usage Metrics',
        'AI Settings',
        'Test AI Connection'
      ];

      maintenanceItems.forEach(label => {
        const item = toolsMenuItems.find(item => item.label === label);
        expect(item).toBeDefined();
      });
    });

    it('should include database maintenance submenu', () => {
      const dbMaintenanceItem = toolsMenuItems.find(item => item.label === 'Database Maintenance');
      const dbSubmenu = dbMaintenanceItem?.submenu as MenuItemConstructorOptions[];

      expect(dbSubmenu).toBeDefined();

      const dbOperations = ['Optimize Database', 'Rebuild Search Index', 'Database Statistics'];
      dbOperations.forEach(operation => {
        const item = dbSubmenu.find(item => item.label === operation);
        expect(item).toBeDefined();
      });
    });

    it('should send correct IPC messages for tool actions', () => {
      const clearHistoryItem = toolsMenuItems.find(item => item.label === 'Clear Search History');

      // Simulate menu click
      if (clearHistoryItem?.click) {
        clearHistoryItem.click({} as any, mockWindow, {} as any);
      }

      expect(mockWindow.webContents.send).toHaveBeenCalledWith('action', 'clear-search-history');
    });

    it('should navigate to settings for AI Settings', () => {
      const aiSettingsItem = toolsMenuItems.find(item => item.label === 'AI Settings');

      // Simulate menu click
      if (aiSettingsItem?.click) {
        aiSettingsItem.click({} as any, mockWindow, {} as any);
      }

      expect(mockWindow.webContents.send).toHaveBeenCalledWith('navigate', '/settings#ai');
    });
  });

  describe('Help Menu Operations', () => {
    let helpMenuItems: MenuItemConstructorOptions[];

    beforeEach(() => {
      const menu = createApplicationMenu(mockWindow);
      const template = (Menu.buildFromTemplate as jest.Mock).mock.calls[0][0];
      const helpMenu = template.find((item: MenuItemConstructorOptions) => item.label === 'Help');
      helpMenuItems = helpMenu?.submenu as MenuItemConstructorOptions[];
    });

    it('should open external links correctly', () => {
      const docItem = helpMenuItems.find(item => item.label === 'Documentation');

      // Simulate menu click
      if (docItem?.click) {
        docItem.click({} as any, mockWindow, {} as any);
      }

      expect(shell.openExternal).toHaveBeenCalledWith(
        'https://github.com/your-org/mainframe-kb-assistant/wiki'
      );
    });

    it('should include keyboard shortcuts with correct accelerator', () => {
      const shortcutsItem = helpMenuItems.find(item => item.label === 'Keyboard Shortcuts');

      expect(shortcutsItem).toBeDefined();
      expect(shortcutsItem?.accelerator).toBe('CmdOrCtrl+/');
    });

    it('should send show-shortcuts IPC message', () => {
      const shortcutsItem = helpMenuItems.find(item => item.label === 'Keyboard Shortcuts');

      // Simulate menu click
      if (shortcutsItem?.click) {
        shortcutsItem.click({} as any, mockWindow, {} as any);
      }

      expect(mockWindow.webContents.send).toHaveBeenCalledWith('action', 'show-shortcuts');
    });

    it('should show About dialog on Windows/Linux', () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });

      const menu = createApplicationMenu(mockWindow);
      const template = (Menu.buildFromTemplate as jest.Mock).mock.calls[0][0];
      const helpMenu = template.find((item: MenuItemConstructorOptions) => item.label === 'Help');
      const winHelpItems = helpMenu?.submenu as MenuItemConstructorOptions[];

      const aboutItem = winHelpItems.find(item => item.label === 'About');

      // Simulate menu click
      if (aboutItem?.click) {
        aboutItem.click({} as any, mockWindow, {} as any);
      }

      expect(dialog.showMessageBox).toHaveBeenCalledWith(mockWindow, expect.objectContaining({
        type: 'info',
        title: 'About Mainframe KB Assistant',
        message: 'Mainframe KB Assistant'
      }));
    });
  });
});