import { Page, ElectronApplication, expect } from '@playwright/test';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Comprehensive helper utilities for Electron testing
 * Provides specialized functions for testing Electron applications
 */

export class ElectronTestHelpers {
  constructor(
    private electronApp: ElectronApplication,
    private page: Page
  ) {}

  /**
   * Window Management Helpers
   */
  async openNewWindow(): Promise<Page> {
    const [newPage] = await Promise.all([
      this.electronApp.waitForEvent('window'),
      this.page.evaluate(() => {
        // Trigger new window via IPC or menu action
        window.electronAPI?.openNewWindow();
      })
    ]);

    await newPage.waitForLoadState('domcontentloaded');
    return newPage;
  }

  async closeWindow(page: Page): Promise<void> {
    if (!page.isClosed()) {
      await page.close();
    }
  }

  async getAllWindows(): Promise<Page[]> {
    return this.electronApp.windows();
  }

  async getMainWindow(): Promise<Page> {
    const windows = await this.getAllWindows();
    return windows.find(w => w.url().includes('index.html')) || windows[0];
  }

  /**
   * Menu and IPC Helpers
   */
  async triggerMenuAction(menuPath: string[]): Promise<void> {
    await this.electronApp.evaluate(({ Menu }, path) => {
      const menu = Menu.getApplicationMenu();
      if (menu) {
        // Navigate through menu path and trigger click
        let currentItem = menu;
        for (const pathItem of path) {
          currentItem = currentItem.items.find((item: any) =>
            item.label === pathItem || item.id === pathItem
          );
          if (!currentItem) {
            throw new Error(`Menu item not found: ${pathItem}`);
          }
        }
        if (currentItem.click) {
          currentItem.click();
        }
      }
    }, menuPath);
  }

  async sendIpcMessage(channel: string, ...args: any[]): Promise<any> {
    return await this.page.evaluate(
      ({ channel, args }) => {
        return window.electronAPI?.invoke(channel, ...args);
      },
      { channel, args }
    );
  }

  async waitForIpcMessage(channel: string, timeout = 5000): Promise<any> {
    return await this.page.evaluate(
      ({ channel, timeout }) => {
        return new Promise((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            reject(new Error(`IPC message timeout: ${channel}`));
          }, timeout);

          window.electronAPI?.on(channel, (data: any) => {
            clearTimeout(timeoutId);
            resolve(data);
          });
        });
      },
      { channel, timeout }
    );
  }

  /**
   * File System Operations
   */
  async selectFile(filePath: string): Promise<void> {
    // Mock file dialog selection
    await this.electronApp.evaluate(({ dialog }, mockPath) => {
      // Mock the dialog.showOpenDialog to return our test file
      const originalShowOpenDialog = dialog.showOpenDialog;
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [mockPath]
      });

      // Restore after a delay
      setTimeout(() => {
        dialog.showOpenDialog = originalShowOpenDialog;
      }, 100);
    }, filePath);
  }

  async saveFile(filePath: string): Promise<void> {
    // Mock file dialog save
    await this.electronApp.evaluate(({ dialog }, mockPath) => {
      const originalShowSaveDialog = dialog.showSaveDialog;
      dialog.showSaveDialog = async () => ({
        canceled: false,
        filePath: mockPath
      });

      setTimeout(() => {
        dialog.showSaveDialog = originalShowSaveDialog;
      }, 100);
    }, filePath);
  }

  async waitForFileToExist(filePath: string, timeout = 10000): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        await fs.access(filePath);
        return;
      } catch {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    throw new Error(`File not found within timeout: ${filePath}`);
  }

  /**
   * Database Testing Helpers
   */
  async clearDatabase(): Promise<void> {
    await this.sendIpcMessage('db:clear');
  }

  async seedDatabase(data: any[]): Promise<void> {
    await this.sendIpcMessage('db:seed', data);
  }

  async getDatabaseStats(): Promise<any> {
    return await this.sendIpcMessage('db:stats');
  }

  async exportDatabase(outputPath: string): Promise<void> {
    const data = await this.sendIpcMessage('db:export');
    await fs.writeFile(outputPath, JSON.stringify(data, null, 2));
  }

  /**
   * Performance Monitoring
   */
  async startPerformanceMonitoring(): Promise<void> {
    await this.page.evaluate(() => {
      (window as any).performanceData = {
        marks: [],
        measures: [],
        memory: []
      };

      // Monitor performance marks
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          (window as any).performanceData.marks.push({
            name: entry.name,
            startTime: entry.startTime,
            duration: entry.duration
          });
        }
      });

      observer.observe({ entryTypes: ['mark', 'measure'] });

      // Monitor memory usage
      if ('memory' in performance) {
        setInterval(() => {
          (window as any).performanceData.memory.push({
            timestamp: Date.now(),
            usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
            totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
            jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit
          });
        }, 1000);
      }
    });
  }

  async getPerformanceData(): Promise<any> {
    return await this.page.evaluate(() => {
      return (window as any).performanceData || {};
    });
  }

  async measureOperation<T>(operation: () => Promise<T>, name: string): Promise<{ result: T; duration: number }> {
    const startTime = Date.now();
    const result = await operation();
    const duration = Date.now() - startTime;

    await this.page.evaluate((operationName, operationDuration) => {
      if (!window.performance) return;
      window.performance.mark(`${operationName}-start`);
      window.performance.mark(`${operationName}-end`);
      window.performance.measure(operationName, `${operationName}-start`, `${operationName}-end`);
    }, name, duration);

    return { result, duration };
  }

  /**
   * Application State Helpers
   */
  async waitForAppToLoad(): Promise<void> {
    // Wait for the main window to be ready
    await this.page.waitForLoadState('domcontentloaded');

    // Wait for app-specific loading indicators
    await this.page.waitForFunction(() => {
      return document.querySelector('[data-testid="app-loaded"]') !== null ||
             document.querySelector('.loading') === null ||
             document.readyState === 'complete';
    });
  }

  async getAppState(): Promise<any> {
    return await this.page.evaluate(() => {
      // Return application state - this would depend on your state management
      return {
        url: window.location.href,
        title: document.title,
        readyState: document.readyState,
        // Add other app-specific state
      };
    });
  }

  async setAppTheme(theme: 'light' | 'dark'): Promise<void> {
    await this.page.evaluate((selectedTheme) => {
      // Set theme - implementation depends on your theming system
      document.documentElement.setAttribute('data-theme', selectedTheme);
      localStorage.setItem('theme', selectedTheme);
    }, theme);
  }

  /**
   * Error Handling and Debugging
   */
  async captureConsoleErrors(): Promise<string[]> {
    return await this.page.evaluate(() => {
      return (window as any).consoleErrors || [];
    });
  }

  async captureUnhandledErrors(): Promise<any[]> {
    const errors: any[] = [];

    this.page.on('pageerror', (error) => {
      errors.push({
        type: 'page-error',
        message: error.message,
        stack: error.stack,
        timestamp: Date.now()
      });
    });

    this.page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push({
          type: 'console-error',
          message: msg.text(),
          timestamp: Date.now()
        });
      }
    });

    return errors;
  }

  async takeDebugScreenshot(name: string): Promise<string> {
    const screenshotPath = path.join(__dirname, '../screenshots', `${name}-${Date.now()}.png`);
    await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
    await this.page.screenshot({ path: screenshotPath, fullPage: true });
    return screenshotPath;
  }

  /**
   * Accessibility Testing Helpers
   */
  async checkAccessibility(): Promise<any> {
    // Use axe-core for accessibility testing
    return await this.page.evaluate(() => {
      // This would require axe-core to be injected
      if (typeof (window as any).axe !== 'undefined') {
        return (window as any).axe.run();
      }
      return null;
    });
  }

  async injectAxeCore(): Promise<void> {
    await this.page.addScriptTag({
      url: 'https://unpkg.com/axe-core@latest/axe.min.js'
    });
  }

  /**
   * Keyboard Navigation Testing
   */
  async testTabNavigation(): Promise<string[]> {
    const focusedElements: string[] = [];

    // Start from the beginning
    await this.page.keyboard.press('Tab');

    let previousElement = '';
    let attempts = 0;
    const maxAttempts = 50; // Prevent infinite loops

    while (attempts < maxAttempts) {
      const currentElement = await this.page.evaluate(() => {
        const element = document.activeElement;
        return element ?
          `${element.tagName.toLowerCase()}${element.id ? '#' + element.id : ''}${element.className ? '.' + element.className.split(' ').join('.') : ''}` :
          'none';
      });

      if (currentElement === previousElement) {
        break; // We've reached the end of tab navigation
      }

      focusedElements.push(currentElement);
      previousElement = currentElement;

      await this.page.keyboard.press('Tab');
      attempts++;
    }

    return focusedElements;
  }

  /**
   * Network and Connectivity Testing
   */
  async simulateSlowNetwork(): Promise<void> {
    await this.page.context().route('**/*', route => {
      setTimeout(() => {
        route.continue();
      }, 1000); // 1 second delay
    });
  }

  async simulateNetworkFailure(): Promise<void> {
    await this.page.context().route('**/*', route => {
      route.abort('failed');
    });
  }

  async clearNetworkMocks(): Promise<void> {
    await this.page.context().unroute('**/*');
  }
}

/**
 * Assertion helpers for Electron-specific testing
 */
export class ElectronAssertions {
  constructor(private helpers: ElectronTestHelpers) {}

  async toHaveWindow(count: number): Promise<void> {
    const windows = await this.helpers.getAllWindows();
    expect(windows).toHaveLength(count);
  }

  async toHaveMainWindowTitle(expectedTitle: string): Promise<void> {
    const mainWindow = await this.helpers.getMainWindow();
    const title = await mainWindow.title();
    expect(title).toBe(expectedTitle);
  }

  async toHaveNoConsoleErrors(): Promise<void> {
    const errors = await this.helpers.captureConsoleErrors();
    expect(errors).toHaveLength(0);
  }

  async toBeAccessible(): Promise<void> {
    await this.helpers.injectAxeCore();
    const results = await this.helpers.checkAccessibility();

    if (results && results.violations) {
      expect(results.violations).toHaveLength(0);
    }
  }
}