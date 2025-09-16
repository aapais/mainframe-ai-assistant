import { test as base, expect, ElectronApplication, Page, BrowserContext } from '@playwright/test';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { promises as fs } from 'fs';
import kill from 'tree-kill';

/**
 * Extended test fixtures for Electron application testing
 * Provides utilities for app lifecycle, database setup, and testing helpers
 */

export interface ElectronTestFixtures {
  electronApp: ElectronApplication;
  appPage: Page;
  appContext: BrowserContext;
  testDatabase: string;
  appProcess: ChildProcess;
  electronHelpers: ElectronHelpers;
}

export interface ElectronHelpers {
  waitForAppReady: () => Promise<void>;
  captureConsoleErrors: () => string[];
  clearAppData: () => Promise<void>;
  importTestData: (dataPath: string) => Promise<void>;
  exportAppData: (outputPath: string) => Promise<void>;
  getAppMetrics: () => Promise<any>;
  simulateOffline: () => Promise<void>;
  simulateOnline: () => Promise<void>;
  getMainWindow: () => Promise<Page>;
  closeAllWindows: () => Promise<void>;
}

/**
 * Electron Application Test Fixture
 * Handles launching and managing the Electron application lifecycle
 */
export const test = base.extend<ElectronTestFixtures>({
  electronApp: async ({ }, use) => {
    const electronPath = process.platform === 'win32'
      ? './node_modules/.bin/electron.cmd'
      : './node_modules/.bin/electron';

    const appPath = './dist/main/index.js';

    // Ensure the app is built
    await ensureAppBuilt();

    // Launch Electron app
    const { _electron } = require('playwright');
    const electronApp = await _electron.launch({
      args: [appPath, '--test-mode'],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        ELECTRON_DISABLE_GPU: '1',
        ELECTRON_DISABLE_SECURITY_WARNINGS: '1'
      }
    });

    // Wait for app to be ready
    await electronApp.evaluate(async ({ app }) => {
      return app.whenReady();
    });

    await use(electronApp);

    // Clean up
    await electronApp.close();
  },

  appPage: async ({ electronApp }, use) => {
    // Get the main window
    const page = await electronApp.firstWindow();

    // Wait for the app to load
    await page.waitForLoadState('domcontentloaded');

    // Set up console error capturing
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Store console errors on the page for later access
    (page as any).consoleErrors = consoleErrors;

    await use(page);
  },

  appContext: async ({ electronApp }, use) => {
    const context = electronApp.context();
    await use(context);
  },

  testDatabase: async ({ }, use) => {
    // Create a temporary test database
    const testDbPath = path.join(__dirname, '../temp', `test-db-${Date.now()}.sqlite`);

    // Ensure temp directory exists
    await fs.mkdir(path.dirname(testDbPath), { recursive: true });

    await use(testDbPath);

    // Cleanup test database
    try {
      await fs.unlink(testDbPath);
    } catch (error) {
      console.warn('Failed to cleanup test database:', error);
    }
  },

  appProcess: async ({ }, use) => {
    let process: ChildProcess | null = null;

    await use(process);

    // Kill process if it exists
    if (process && process.pid) {
      await new Promise<void>((resolve) => {
        kill(process.pid!, 'SIGTERM', (err) => {
          if (err) console.warn('Failed to kill process:', err);
          resolve();
        });
      });
    }
  },

  electronHelpers: async ({ electronApp, appPage }, use) => {
    const helpers: ElectronHelpers = {
      waitForAppReady: async () => {
        await electronApp.evaluate(async ({ app }) => {
          return app.whenReady();
        });

        // Wait for renderer to be ready
        await appPage.waitForFunction(() => {
          return window.document.readyState === 'complete';
        });
      },

      captureConsoleErrors: () => {
        return (appPage as any).consoleErrors || [];
      },

      clearAppData: async () => {
        // Clear localStorage, sessionStorage, and IndexedDB
        await appPage.evaluate(() => {
          localStorage.clear();
          sessionStorage.clear();
          // Clear IndexedDB if used
          if (window.indexedDB) {
            // Implementation would depend on your specific DB usage
          }
        });
      },

      importTestData: async (dataPath: string) => {
        const testData = await fs.readFile(dataPath, 'utf8');
        const data = JSON.parse(testData);

        // Send data to main process via IPC
        await electronApp.evaluate(async ({ ipcMain }, importData) => {
          // Implementation would depend on your IPC handlers
          return new Promise((resolve) => {
            ipcMain.emit('import-test-data', { data: importData });
            resolve(true);
          });
        }, data);
      },

      exportAppData: async (outputPath: string) => {
        const data = await electronApp.evaluate(async ({ ipcMain }) => {
          // Implementation would depend on your IPC handlers
          return new Promise((resolve) => {
            ipcMain.emit('export-app-data', {}, (data: any) => {
              resolve(data);
            });
          });
        });

        await fs.writeFile(outputPath, JSON.stringify(data, null, 2));
      },

      getAppMetrics: async () => {
        return await electronApp.evaluate(async ({ app }) => {
          const metrics = app.getAppMetrics();
          const systemInfo = {
            platform: process.platform,
            arch: process.arch,
            version: process.version,
            electronVersion: process.versions.electron,
            chromeVersion: process.versions.chrome
          };

          return {
            metrics,
            systemInfo
          };
        });
      },

      simulateOffline: async () => {
        await appPage.context().setOffline(true);
        await appPage.evaluate(() => {
          // Dispatch offline event
          window.dispatchEvent(new Event('offline'));
        });
      },

      simulateOnline: async () => {
        await appPage.context().setOffline(false);
        await appPage.evaluate(() => {
          // Dispatch online event
          window.dispatchEvent(new Event('online'));
        });
      },

      getMainWindow: async () => {
        const windows = electronApp.windows();
        return windows[0] || appPage;
      },

      closeAllWindows: async () => {
        const windows = electronApp.windows();
        for (const window of windows) {
          try {
            await window.close();
          } catch (error) {
            console.warn('Failed to close window:', error);
          }
        }
      }
    };

    await use(helpers);
  }
});

/**
 * Enhanced expect with Electron-specific assertions
 */
export { expect } from '@playwright/test';

/**
 * Utility functions
 */

async function ensureAppBuilt(): Promise<void> {
  const mainPath = './dist/main/index.js';

  try {
    await fs.access(mainPath);
  } catch (error) {
    throw new Error(
      'Electron app not built. Please run "npm run build:main" before running tests.'
    );
  }
}

/**
 * Custom test data helpers
 */
export class TestDataManager {
  static async createTestKnowledgeBase(entries: any[]): Promise<string> {
    const testData = {
      metadata: {
        created: new Date().toISOString(),
        version: '1.0.0',
        type: 'test-kb'
      },
      entries
    };

    const tempPath = path.join(__dirname, '../temp', `test-kb-${Date.now()}.json`);
    await fs.mkdir(path.dirname(tempPath), { recursive: true });
    await fs.writeFile(tempPath, JSON.stringify(testData, null, 2));

    return tempPath;
  }

  static async cleanupTestFiles(pattern: string): Promise<void> {
    const tempDir = path.join(__dirname, '../temp');

    try {
      const files = await fs.readdir(tempDir);
      const matchingFiles = files.filter(file => file.includes(pattern));

      for (const file of matchingFiles) {
        await fs.unlink(path.join(tempDir, file));
      }
    } catch (error) {
      console.warn('Failed to cleanup test files:', error);
    }
  }
}

/**
 * Performance testing utilities
 */
export class PerformanceTestHelpers {
  static async measureStartupTime(electronApp: ElectronApplication): Promise<number> {
    const startTime = Date.now();

    await electronApp.evaluate(async ({ app }) => {
      return app.whenReady();
    });

    return Date.now() - startTime;
  }

  static async measureMemoryUsage(electronApp: ElectronApplication): Promise<any> {
    return await electronApp.evaluate(async ({ app }) => {
      const metrics = app.getAppMetrics();
      return metrics.map(metric => ({
        pid: metric.pid,
        type: metric.type,
        cpu: metric.cpu,
        memory: metric.memory
      }));
    });
  }

  static async measureRenderTime(page: Page, selector: string): Promise<number> {
    const startTime = Date.now();
    await page.waitForSelector(selector, { state: 'visible' });
    return Date.now() - startTime;
  }
}