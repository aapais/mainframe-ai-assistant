/**
 * Platform-Specific Menu Behavior Tests
 *
 * Tests platform-specific menu behaviors including:
 * - macOS vs Windows/Linux menu differences
 * - Platform-specific accelerators
 * - Native menu integration
 * - System menu conventions
 * - Platform UI guidelines compliance
 */

import { jest } from '@jest/globals';
import { Menu, BrowserWindow, app } from 'electron';
import { createApplicationMenu } from '../../../src/main/menu';
import { MenuTestUtils } from './utils/MenuTestUtils';

// Mock electron modules
jest.mock('electron', () => require('../../integration/__mocks__/electron.js'));

describe('Platform-Specific Menu Tests', () => {
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

  describe('macOS Platform Behavior', () => {
    beforeEach(() => {
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
        configurable: true
      });
    });

    it('should include application menu as first item on macOS', () => {
      const menu = createApplicationMenu(mockWindow);
      const template = (Menu.buildFromTemplate as jest.Mock).mock.calls[0][0];

      // First menu should be the app menu
      expect(template[0].label).toBe(app.getName());
      expect(template[0].submenu).toBeDefined();
    });

    it('should include macOS-specific app menu items', () => {
      const menu = createApplicationMenu(mockWindow);
      const template = (Menu.buildFromTemplate as jest.Mock).mock.calls[0][0];

      const appMenu = template[0];
      const appSubmenu = appMenu.submenu as any[];

      const expectedMacItems = [
        { role: 'about' },
        { role: 'services' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { role: 'quit' }
      ];

      expectedMacItems.forEach(expectedItem => {
        const found = appSubmenu.some(item => item.role === expectedItem.role);
        expect(found).toBe(true);
      });
    });

    it('should use Cmd+, for Preferences on macOS', () => {
      const menu = createApplicationMenu(mockWindow);
      const template = (Menu.buildFromTemplate as jest.Mock).mock.calls[0][0];

      const appMenu = template[0];
      const appSubmenu = appMenu.submenu as any[];

      const preferencesItem = appSubmenu.find(item => item.label === 'Preferences...');
      expect(preferencesItem).toBeDefined();
      expect(preferencesItem.accelerator).toBe('Cmd+,');
    });

    it('should include macOS-specific Edit menu items', () => {
      const menu = createApplicationMenu(mockWindow);
      const template = (Menu.buildFromTemplate as jest.Mock).mock.calls[0][0];

      const editMenu = template.find((item: any) => item.label === 'Edit');
      const editSubmenu = editMenu?.submenu as any[];

      // Should include macOS-specific items
      const pasteAndMatchStyle = editSubmenu.find(item => item.role === 'pasteAndMatchStyle');
      const speechMenu = editSubmenu.find(item => item.label === 'Speech');

      expect(pasteAndMatchStyle).toBeDefined();
      expect(speechMenu).toBeDefined();
      expect(speechMenu.submenu).toBeDefined();

      const speechSubmenu = speechMenu.submenu as any[];
      expect(speechSubmenu.some(item => item.role === 'startSpeaking')).toBe(true);
      expect(speechSubmenu.some(item => item.role === 'stopSpeaking')).toBe(true);
    });

    it('should include macOS-specific Window menu items', () => {
      const menu = createApplicationMenu(mockWindow);
      const template = (Menu.buildFromTemplate as jest.Mock).mock.calls[0][0];

      const windowMenu = template.find((item: any) => item.label === 'Window');
      const windowSubmenu = windowMenu?.submenu as any[];

      const macWindowItems = [
        { role: 'front' },
        { role: 'window' }
      ];

      macWindowItems.forEach(expectedItem => {
        const found = windowSubmenu.some(item => item.role === expectedItem.role);
        expect(found).toBe(true);
      });
    });

    it('should not include About in Help menu on macOS', () => {
      const menu = createApplicationMenu(mockWindow);
      const template = (Menu.buildFromTemplate as jest.Mock).mock.calls[0][0];

      const helpMenu = template.find((item: any) => item.label === 'Help');
      const helpSubmenu = helpMenu?.submenu as any[];

      // About should be in app menu, not help menu on macOS
      const aboutInHelp = helpSubmenu.find(item => item.label === 'About');
      expect(aboutInHelp).toBeUndefined();
    });

    it('should handle macOS menu validation', () => {
      const menu = createApplicationMenu(mockWindow);
      const template = (Menu.buildFromTemplate as jest.Mock).mock.calls[0][0];

      const validation = menuTestUtils.validateMenuStructure(template);
      expect(validation.valid).toBe(true);

      // Check for macOS-specific patterns
      expect(template.length).toBeGreaterThan(5); // Should have app menu + standard menus
    });
  });

  describe('Windows Platform Behavior', () => {
    beforeEach(() => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        configurable: true
      });
    });

    it('should not include application menu on Windows', () => {
      const menu = createApplicationMenu(mockWindow);
      const template = (Menu.buildFromTemplate as jest.Mock).mock.calls[0][0];

      // First menu should be File, not app menu
      expect(template[0].label).toBe('File');
      expect(template[0].label).not.toBe(app.getName());
    });

    it('should include Quit in File menu on Windows', () => {
      const menu = createApplicationMenu(mockWindow);
      const template = (Menu.buildFromTemplate as jest.Mock).mock.calls[0][0];

      const fileMenu = template.find((item: any) => item.label === 'File');
      const fileSubmenu = fileMenu?.submenu as any[];

      const quitItem = fileSubmenu.find(item => item.role === 'quit');
      expect(quitItem).toBeDefined();
    });

    it('should include About in Help menu on Windows', () => {
      const menu = createApplicationMenu(mockWindow);
      const template = (Menu.buildFromTemplate as jest.Mock).mock.calls[0][0];

      const helpMenu = template.find((item: any) => item.label === 'Help');
      const helpSubmenu = helpMenu?.submenu as any[];

      const aboutItem = helpSubmenu.find(item => item.label === 'About');
      expect(aboutItem).toBeDefined();
      expect(typeof aboutItem.click).toBe('function');
    });

    it('should not include macOS-specific Edit menu items', () => {
      const menu = createApplicationMenu(mockWindow);
      const template = (Menu.buildFromTemplate as jest.Mock).mock.calls[0][0];

      const editMenu = template.find((item: any) => item.label === 'Edit');
      const editSubmenu = editMenu?.submenu as any[];

      // Should not include macOS-specific items
      const pasteAndMatchStyle = editSubmenu.find(item => item.role === 'pasteAndMatchStyle');
      const speechMenu = editSubmenu.find(item => item.label === 'Speech');

      expect(pasteAndMatchStyle).toBeUndefined();
      expect(speechMenu).toBeUndefined();
    });

    it('should not include macOS-specific Window menu items', () => {
      const menu = createApplicationMenu(mockWindow);
      const template = (Menu.buildFromTemplate as jest.Mock).mock.calls[0][0];

      const windowMenu = template.find((item: any) => item.label === 'Window');
      const windowSubmenu = windowMenu?.submenu as any[];

      // Should not include macOS-specific items
      const frontItem = windowSubmenu.find(item => item.role === 'front');
      const windowItem = windowSubmenu.find(item => item.role === 'window');

      expect(frontItem).toBeUndefined();
      expect(windowItem).toBeUndefined();
    });

    it('should use standard Windows menu layout', () => {
      const menu = createApplicationMenu(mockWindow);
      const template = (Menu.buildFromTemplate as jest.Mock).mock.calls[0][0];

      const expectedOrder = ['File', 'Edit', 'View', 'Tools', 'Window', 'Help'];
      const actualOrder = template.map((item: any) => item.label);

      expect(actualOrder).toEqual(expectedOrder);
    });
  });

  describe('Linux Platform Behavior', () => {
    beforeEach(() => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        configurable: true
      });
    });

    it('should behave similar to Windows on Linux', () => {
      const menu = createApplicationMenu(mockWindow);
      const template = (Menu.buildFromTemplate as jest.Mock).mock.calls[0][0];

      // Should follow Windows-like pattern
      expect(template[0].label).toBe('File');

      const fileMenu = template.find((item: any) => item.label === 'File');
      const fileSubmenu = fileMenu?.submenu as any[];

      // Should include quit in File menu
      const quitItem = fileSubmenu.find(item => item.role === 'quit');
      expect(quitItem).toBeDefined();
    });

    it('should include About in Help menu on Linux', () => {
      const menu = createApplicationMenu(mockWindow);
      const template = (Menu.buildFromTemplate as jest.Mock).mock.calls[0][0];

      const helpMenu = template.find((item: any) => item.label === 'Help');
      const helpSubmenu = helpMenu?.submenu as any[];

      const aboutItem = helpSubmenu.find(item => item.label === 'About');
      expect(aboutItem).toBeDefined();
    });
  });

  describe('Cross-Platform Accelerator Handling', () => {
    const platforms = ['darwin', 'win32', 'linux'];

    platforms.forEach(platform => {
      it(`should use appropriate accelerators on ${platform}`, () => {
        Object.defineProperty(process, 'platform', {
          value: platform,
          configurable: true
        });

        const menu = createApplicationMenu(mockWindow);
        const template = (Menu.buildFromTemplate as jest.Mock).mock.calls[0][0];

        const accelerators = menuTestUtils.extractAccelerators(template);

        // All accelerators should use CmdOrCtrl for cross-platform compatibility
        const crossPlatformAccelerators = accelerators.filter(acc =>
          acc.startsWith('CmdOrCtrl') || acc.startsWith('Cmd+') || acc.startsWith('Ctrl+')
        );

        expect(crossPlatformAccelerators.length).toBeGreaterThan(0);

        // Platform-specific accelerators should be appropriate
        if (platform === 'darwin') {
          const macSpecific = accelerators.filter(acc => acc.startsWith('Cmd+'));
          // macOS-specific shortcuts should exist (like Cmd+,)
          expect(macSpecific.length).toBeGreaterThan(0);
        }
      });
    });

    it('should convert CmdOrCtrl correctly per platform', () => {
      const testAccelerator = 'CmdOrCtrl+S';

      // Test macOS conversion
      const macAccelerator = menuTestUtils.convertAcceleratorForPlatform(testAccelerator, 'darwin');
      expect(macAccelerator).toBe('Cmd+S');

      // Test Windows conversion
      const winAccelerator = menuTestUtils.convertAcceleratorForPlatform(testAccelerator, 'win32');
      expect(winAccelerator).toBe('Ctrl+S');

      // Test Linux conversion
      const linuxAccelerator = menuTestUtils.convertAcceleratorForPlatform(testAccelerator, 'linux');
      expect(linuxAccelerator).toBe('Ctrl+S');
    });
  });

  describe('Platform Menu Conventions', () => {
    it('should follow platform conventions for menu organization', () => {
      const platforms = [
        { name: 'darwin', hasAppMenu: true, quitLocation: 'app' },
        { name: 'win32', hasAppMenu: false, quitLocation: 'file' },
        { name: 'linux', hasAppMenu: false, quitLocation: 'file' }
      ];

      platforms.forEach(({ name, hasAppMenu, quitLocation }) => {
        Object.defineProperty(process, 'platform', {
          value: name,
          configurable: true
        });

        const menu = createApplicationMenu(mockWindow);
        const template = (Menu.buildFromTemplate as jest.Mock).mock.calls[0][0];

        // Check app menu presence
        const firstMenuIsApp = template[0].label === app.getName();
        expect(firstMenuIsApp).toBe(hasAppMenu);

        // Check quit location
        if (quitLocation === 'app') {
          const appMenu = template[0];
          const appSubmenu = appMenu.submenu as any[];
          const quitInApp = appSubmenu.some(item => item.role === 'quit');
          expect(quitInApp).toBe(true);
        } else {
          const fileMenu = template.find((item: any) => item.label === 'File');
          const fileSubmenu = fileMenu?.submenu as any[];
          const quitInFile = fileSubmenu?.some(item => item.role === 'quit');
          expect(quitInFile).toBe(true);
        }
      });
    });

    it('should handle platform-specific separators correctly', () => {
      const platforms = ['darwin', 'win32', 'linux'];

      platforms.forEach(platform => {
        Object.defineProperty(process, 'platform', {
          value: platform,
          configurable: true
        });

        const menu = createApplicationMenu(mockWindow);
        const template = (Menu.buildFromTemplate as jest.Mock).mock.calls[0][0];

        // Count separators in each menu
        template.forEach((menuItem: any) => {
          if (menuItem.submenu && Array.isArray(menuItem.submenu)) {
            const separators = menuItem.submenu.filter(item => item.type === 'separator');
            const nonSeparators = menuItem.submenu.filter(item => item.type !== 'separator');

            // Should not have excessive separators
            expect(separators.length).toBeLessThan(nonSeparators.length);

            // Should not have consecutive separators
            for (let i = 0; i < menuItem.submenu.length - 1; i++) {
              if (menuItem.submenu[i].type === 'separator') {
                expect(menuItem.submenu[i + 1].type).not.toBe('separator');
              }
            }
          }
        });
      });
    });
  });

  describe('Platform-Specific Dialog Integration', () => {
    it('should use platform-appropriate dialog styles', () => {
      const platforms = ['darwin', 'win32', 'linux'];

      platforms.forEach(platform => {
        Object.defineProperty(process, 'platform', {
          value: platform,
          configurable: true
        });

        // Mock specific platform behavior would go here
        expect(() => {
          createApplicationMenu(mockWindow);
        }).not.toThrow();
      });
    });
  });

  describe('Platform Menu Accessibility', () => {
    it('should follow platform accessibility guidelines', () => {
      const platforms = ['darwin', 'win32', 'linux'];

      platforms.forEach(platform => {
        Object.defineProperty(process, 'platform', {
          value: platform,
          configurable: true
        });

        const menu = createApplicationMenu(mockWindow);
        const template = (Menu.buildFromTemplate as jest.Mock).mock.calls[0][0];

        // All interactive items should be keyboard accessible
        const validation = menuTestUtils.validateMenuStructure(template);
        expect(validation.valid).toBe(true);

        // Platform-specific accessibility checks
        if (platform === 'darwin') {
          // macOS should have proper role-based items
          const appMenu = template[0];
          expect(appMenu.submenu).toBeDefined();
        }
      });
    });

    it('should provide consistent keyboard navigation across platforms', () => {
      const platforms = ['darwin', 'win32', 'linux'];

      platforms.forEach(platform => {
        Object.defineProperty(process, 'platform', {
          value: platform,
          configurable: true
        });

        const menu = createApplicationMenu(mockWindow);
        const template = (Menu.buildFromTemplate as jest.Mock).mock.calls[0][0];

        // Essential actions should have accelerators on all platforms
        const essentialActions = ['New KB Entry', 'Find...', 'Import KB...', 'Export KB...'];

        essentialActions.forEach(action => {
          const item = menuTestUtils.findMenuItemByLabel(template, action);
          expect(item?.accelerator).toBeDefined();
        });
      });
    });
  });

  describe('Platform Performance Considerations', () => {
    it('should create menus efficiently on all platforms', () => {
      const platforms = ['darwin', 'win32', 'linux'];

      platforms.forEach(platform => {
        Object.defineProperty(process, 'platform', {
          value: platform,
          configurable: true
        });

        const createTime = menuTestUtils.measureMenuCreationTime(() => {
          return createApplicationMenu(mockWindow);
        }, 10);

        // Should be fast on all platforms (under 50ms for 10 menus)
        expect(createTime).toBeLessThan(50);
      });
    });

    it('should have consistent memory usage across platforms', () => {
      const platforms = ['darwin', 'win32', 'linux'];

      platforms.forEach(platform => {
        Object.defineProperty(process, 'platform', {
          value: platform,
          configurable: true
        });

        const memoryUsage = menuTestUtils.measureMenuMemoryUsage(() => {
          return createApplicationMenu(mockWindow);
        }, 100);

        // Memory usage should be reasonable (under 5MB for 100 menus)
        expect(memoryUsage).toBeLessThan(5 * 1024 * 1024);
      });
    });
  });

  describe('Platform Error Handling', () => {
    it('should handle platform detection errors gracefully', () => {
      // Mock invalid platform
      Object.defineProperty(process, 'platform', {
        value: 'unknown-platform',
        configurable: true
      });

      expect(() => {
        createApplicationMenu(mockWindow);
      }).not.toThrow();
    });

    it('should provide fallback behavior for unsupported platforms', () => {
      const unsupportedPlatforms = ['freebsd', 'openbsd', 'sunos', 'aix'];

      unsupportedPlatforms.forEach(platform => {
        Object.defineProperty(process, 'platform', {
          value: platform,
          configurable: true
        });

        const menu = createApplicationMenu(mockWindow);
        expect(menu).toBeDefined();

        // Should fallback to Windows-like behavior
        const template = (Menu.buildFromTemplate as jest.Mock).mock.calls[0][0];
        expect(template[0].label).toBe('File');
      });
    });
  });
});