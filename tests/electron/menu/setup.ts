/**
 * Menu Test Setup
 *
 * Global setup and configuration for menu tests including:
 * - Electron mocking
 * - Test environment configuration
 * - Global utilities and helpers
 * - Performance monitoring setup
 */

import { jest } from '@jest/globals';

// Mock Electron before any imports
jest.mock('electron', () => require('../../integration/__mocks__/electron.js'));
jest.mock('electron-updater', () => ({
  autoUpdater: {
    checkForUpdatesAndNotify: jest.fn().mockResolvedValue({})
  }
}));

// Global test configuration
beforeAll(() => {
  // Set test environment
  process.env.NODE_ENV = 'test';
  process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';

  // Mock app metadata
  const { app } = require('electron');
  (app.getName as jest.Mock).mockReturnValue('Test App');
  (app.getVersion as jest.Mock).mockReturnValue('1.0.0-test');

  // Suppress console warnings during tests
  const originalConsoleWarn = console.warn;
  console.warn = (...args: any[]) => {
    // Only show warnings that aren't Electron-related test warnings
    const message = args[0]?.toString() || '';
    if (!message.includes('Electron') && !message.includes('deprecated')) {
      originalConsoleWarn(...args);
    }
  };

  // Performance monitoring setup
  if (typeof global !== 'undefined') {
    (global as any).menuTestStartTime = Date.now();
  }
});

beforeEach(() => {
  // Clear all mocks before each test
  jest.clearAllMocks();

  // Reset platform to default
  Object.defineProperty(process, 'platform', {
    value: 'win32',
    writable: true,
    configurable: true
  });

  // Reset environment
  process.env.NODE_ENV = 'test';
});

afterEach(() => {
  // Clean up any global state
  jest.restoreAllMocks();
});

afterAll(() => {
  // Performance reporting
  if (typeof global !== 'undefined' && (global as any).menuTestStartTime) {
    const duration = Date.now() - (global as any).menuTestStartTime;
    console.log(`\n⏱️  Total menu test duration: ${duration}ms`);
  }
});

// Global test utilities
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidMenuTemplate(): R;
      toHaveAccelerator(accelerator: string): R;
      toBeEnabledOnPlatform(platform: string): R;
    }
  }
}

// Custom Jest matchers for menu testing
expect.extend({
  toBeValidMenuTemplate(received: any[]) {
    if (!Array.isArray(received)) {
      return {
        message: () => `Expected menu template to be an array, received ${typeof received}`,
        pass: false
      };
    }

    const errors: string[] = [];

    // Validate menu structure
    received.forEach((item, index) => {
      if (item.type !== 'separator' && !item.label) {
        errors.push(`Menu item at index ${index} missing label`);
      }

      if (item.accelerator && typeof item.accelerator !== 'string') {
        errors.push(`Menu item at index ${index} has invalid accelerator type`);
      }

      if (item.submenu && !Array.isArray(item.submenu)) {
        errors.push(`Menu item at index ${index} has invalid submenu type`);
      }
    });

    return {
      message: () => errors.length > 0
        ? `Menu template validation failed:\n${errors.join('\n')}`
        : 'Menu template is valid',
      pass: errors.length === 0
    };
  },

  toHaveAccelerator(received: any, accelerator: string) {
    const hasAccelerator = received?.accelerator === accelerator;

    return {
      message: () => hasAccelerator
        ? `Expected menu item not to have accelerator "${accelerator}"`
        : `Expected menu item to have accelerator "${accelerator}", received "${received?.accelerator || 'none'}"`,
      pass: hasAccelerator
    };
  },

  toBeEnabledOnPlatform(received: any, platform: string) {
    // Mock platform-specific enabling logic
    const shouldBeEnabled = platform === 'darwin' ? received?.macEnabled !== false : received?.enabled !== false;

    return {
      message: () => shouldBeEnabled
        ? `Expected menu item to be disabled on ${platform}`
        : `Expected menu item to be enabled on ${platform}`,
      pass: shouldBeEnabled
    };
  }
});

// Global error handling for tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

// Export test utilities
export const testUtils = {
  /**
   * Wait for async operations to complete
   */
  async waitForAsync(ms: number = 0): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  /**
   * Create mock BrowserWindow with common methods
   */
  createMockWindow(): any {
    return {
      id: Math.random(),
      webContents: {
        send: jest.fn(),
        on: jest.fn(),
        once: jest.fn(),
        executeJavaScript: jest.fn().mockResolvedValue(),
        session: {
          clearCache: jest.fn().mockResolvedValue(),
          clearStorageData: jest.fn().mockResolvedValue()
        }
      },
      show: jest.fn(),
      hide: jest.fn(),
      close: jest.fn(),
      focus: jest.fn(),
      isDestroyed: jest.fn().mockReturnValue(false),
      isVisible: jest.fn().mockReturnValue(true),
      isMinimized: jest.fn().mockReturnValue(false),
      isFocused: jest.fn().mockReturnValue(true)
    };
  },

  /**
   * Mock platform for testing
   */
  mockPlatform(platform: NodeJS.Platform): void {
    Object.defineProperty(process, 'platform', {
      value: platform,
      writable: true,
      configurable: true
    });
  },

  /**
   * Measure function execution time
   */
  measureTime<T>(fn: () => T): { result: T; duration: number } {
    const start = Date.now();
    const result = fn();
    const duration = Date.now() - start;
    return { result, duration };
  },

  /**
   * Measure async function execution time
   */
  async measureTimeAsync<T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
    const start = Date.now();
    const result = await fn();
    const duration = Date.now() - start;
    return { result, duration };
  },

  /**
   * Generate test data for menu items
   */
  generateTestMenuData(count: number = 10): any[] {
    return Array.from({ length: count }, (_, i) => ({
      label: `Test Item ${i + 1}`,
      accelerator: i % 2 === 0 ? `CmdOrCtrl+${i + 1}` : undefined,
      click: jest.fn(),
      enabled: true
    }));
  },

  /**
   * Validate menu structure recursively
   */
  validateMenuStructure(template: any[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    const validate = (items: any[], path: string = '') => {
      items.forEach((item, index) => {
        const itemPath = `${path}[${index}]`;

        if (item.type !== 'separator') {
          if (!item.label) {
            errors.push(`${itemPath}: Missing label`);
          }

          if (item.accelerator && !this.isValidAccelerator(item.accelerator)) {
            errors.push(`${itemPath}: Invalid accelerator format`);
          }
        }

        if (item.submenu && Array.isArray(item.submenu)) {
          validate(item.submenu, `${itemPath}.submenu`);
        }
      });
    };

    validate(template);

    return {
      valid: errors.length === 0,
      errors
    };
  },

  /**
   * Check if accelerator format is valid
   */
  isValidAccelerator(accelerator: string): boolean {
    if (!accelerator || typeof accelerator !== 'string') {
      return false;
    }

    const validModifiers = ['Ctrl', 'Cmd', 'Alt', 'Shift', 'CmdOrCtrl'];
    const parts = accelerator.split('+');

    if (parts.length < 2) {
      return false;
    }

    const modifiers = parts.slice(0, -1);
    const key = parts[parts.length - 1];

    return modifiers.every(mod => validModifiers.includes(mod)) && key.length > 0;
  }
};