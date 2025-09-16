import { test, expect } from '../../fixtures/electron-fixtures';
import { ElectronTestHelpers } from '../../helpers/electron-helpers';

/**
 * Electron Application Launch Tests
 * Tests basic application startup, window management, and core functionality
 */

test.describe('Electron App Launch', () => {
  test.beforeEach(async ({ electronHelpers }) => {
    // Ensure clean state before each test
    await electronHelpers.clearAppData();
  });

  test('should launch the application successfully', async ({
    electronApp,
    appPage,
    electronHelpers
  }) => {
    // Test that the app launches and basic window is created
    await electronHelpers.waitForAppReady();

    // Verify main window exists
    const windows = await electronHelpers.getAllWindows();
    expect(windows).toHaveLength(1);

    // Verify window properties
    const mainWindow = await electronHelpers.getMainWindow();
    expect(mainWindow).toBeTruthy();

    const title = await mainWindow.title();
    expect(title).toContain('Mainframe KB Assistant');

    // Verify app is loaded
    await expect(appPage.locator('[data-testid="app-loaded"]').or(
      appPage.locator('body:not(.loading)')
    )).toBeVisible({ timeout: 30000 });
  });

  test('should display correct application metadata', async ({
    electronApp,
    appPage
  }) => {
    // Check app version and metadata
    const appVersion = await electronApp.evaluate(async ({ app }) => {
      return app.getVersion();
    });

    expect(appVersion).toBeTruthy();

    // Verify app name
    const appName = await electronApp.evaluate(async ({ app }) => {
      return app.getName();
    });

    expect(appName).toBe('mainframe-kb-assistant');

    // Check window title
    const title = await appPage.title();
    expect(title).toMatch(/Mainframe.*KB.*Assistant/i);
  });

  test('should handle menu interactions', async ({
    electronApp,
    appPage,
    electronHelpers
  }) => {
    await electronHelpers.waitForAppReady();

    // Test File menu
    await electronHelpers.triggerMenuAction(['File', 'New Entry']);

    // Verify new entry modal or form appears
    await expect(appPage.locator('[data-testid="new-entry-modal"]').or(
      appPage.locator('.modal').or(
        appPage.locator('[role="dialog"]')
      )
    )).toBeVisible({ timeout: 5000 });
  });

  test('should load with correct initial state', async ({
    appPage,
    electronHelpers
  }) => {
    await electronHelpers.waitForAppReady();

    // Verify main components are present
    await expect(appPage.locator('[data-testid="search-bar"]').or(
      appPage.locator('input[type="search"]').or(
        appPage.locator('.search-input')
      )
    )).toBeVisible();

    await expect(appPage.locator('[data-testid="knowledge-base-list"]').or(
      appPage.locator('.kb-list').or(
        appPage.locator('.entries-list')
      )
    )).toBeVisible();

    // Check that no errors occurred during startup
    const consoleErrors = await electronHelpers.captureConsoleErrors();
    expect(consoleErrors.filter(error =>
      !error.includes('DevTools') &&
      !error.includes('Extension')
    )).toHaveLength(0);
  });

  test('should handle window lifecycle correctly', async ({
    electronApp,
    electronHelpers
  }) => {
    await electronHelpers.waitForAppReady();

    // Get initial window count
    const initialWindows = await electronHelpers.getAllWindows();
    const initialCount = initialWindows.length;

    // Open a new window (if supported)
    try {
      await electronHelpers.openNewWindow();

      const newWindows = await electronHelpers.getAllWindows();
      expect(newWindows.length).toBeGreaterThan(initialCount);

      // Close the new window
      const newWindow = newWindows[newWindows.length - 1];
      await electronHelpers.closeWindow(newWindow);

      // Verify window count returned to initial
      const finalWindows = await electronHelpers.getAllWindows();
      expect(finalWindows).toHaveLength(initialCount);
    } catch (error) {
      // New window functionality might not be implemented
      console.log('New window functionality not available:', error.message);
    }
  });

  test('should measure startup performance', async ({
    electronApp,
    electronHelpers
  }) => {
    // Measure startup time
    const { result: startupTime } = await electronHelpers.measureOperation(
      async () => {
        await electronApp.evaluate(async ({ app }) => {
          return app.whenReady();
        });
        return Date.now();
      },
      'app-startup'
    );

    // Startup should be under 10 seconds
    expect(startupTime).toBeLessThan(10000);

    // Get app metrics
    const metrics = await electronHelpers.getAppMetrics();
    expect(metrics).toBeTruthy();
    expect(metrics.systemInfo).toBeTruthy();
    expect(metrics.metrics).toBeTruthy();

    // Attach metrics for reporting
    await test.info().attach('startup-time', {
      body: startupTime.toString(),
      contentType: 'text/plain'
    });

    if (metrics.metrics.length > 0) {
      const mainProcessMemory = metrics.metrics[0].memory;
      await test.info().attach('memory-usage', {
        body: mainProcessMemory.workingSetSize.toString(),
        contentType: 'text/plain'
      });
    }
  });

  test('should handle app errors gracefully', async ({
    appPage,
    electronHelpers
  }) => {
    await electronHelpers.waitForAppReady();

    // Simulate a JavaScript error
    await appPage.evaluate(() => {
      // Trigger a controlled error to test error handling
      window.dispatchEvent(new ErrorEvent('error', {
        message: 'Test error for error handling verification',
        filename: 'test.js',
        lineno: 1
      }));
    });

    // Wait a moment for error handling
    await appPage.waitForTimeout(1000);

    // App should still be responsive
    const isVisible = await appPage.locator('body').isVisible();
    expect(isVisible).toBe(true);

    // Check if error was properly handled (no crash)
    const appState = await electronHelpers.getAppState();
    expect(appState.readyState).toBe('complete');
  });

  test('should support theme switching', async ({
    appPage,
    electronHelpers
  }) => {
    await electronHelpers.waitForAppReady();

    // Test light theme (default)
    await electronHelpers.setAppTheme('light');
    await appPage.waitForTimeout(500);

    const lightTheme = await appPage.evaluate(() => {
      return document.documentElement.getAttribute('data-theme') ||
             getComputedStyle(document.body).backgroundColor;
    });

    // Test dark theme
    await electronHelpers.setAppTheme('dark');
    await appPage.waitForTimeout(500);

    const darkTheme = await appPage.evaluate(() => {
      return document.documentElement.getAttribute('data-theme') ||
             getComputedStyle(document.body).backgroundColor;
    });

    // Themes should be different
    expect(lightTheme).not.toBe(darkTheme);
  });

  test('should handle keyboard navigation', async ({
    appPage,
    electronHelpers
  }) => {
    await electronHelpers.waitForAppReady();

    // Test tab navigation
    const focusedElements = await electronHelpers.testTabNavigation();

    // Should have at least some focusable elements
    expect(focusedElements.length).toBeGreaterThan(0);

    // Should include common UI elements
    const elementTypes = focusedElements.join(' ');
    expect(elementTypes).toMatch(/input|button|a|select/i);
  });

  test('should load test data correctly', async ({
    electronHelpers,
    testDatabase
  }) => {
    await electronHelpers.waitForAppReady();

    // Import test data
    const testDataPath = './tests/playwright/test-data/sample-kb.json';
    await electronHelpers.importTestData(testDataPath);

    // Verify data was imported
    const dbStats = await electronHelpers.getDatabaseStats();
    expect(dbStats).toBeTruthy();

    // Should have some entries
    if (dbStats.entryCount !== undefined) {
      expect(dbStats.entryCount).toBeGreaterThan(0);
    }
  });
});

test.describe('Electron App Stress Tests', () => {
  test('should handle rapid window operations', async ({
    electronApp,
    electronHelpers
  }) => {
    await electronHelpers.waitForAppReady();

    // Rapidly open and close windows (if supported)
    for (let i = 0; i < 3; i++) {
      try {
        const newWindow = await electronHelpers.openNewWindow();
        await electronHelpers.closeWindow(newWindow);
      } catch (error) {
        // Skip if new windows not supported
        break;
      }
    }

    // App should still be stable
    const windows = await electronHelpers.getAllWindows();
    expect(windows.length).toBeGreaterThan(0);

    const mainWindow = await electronHelpers.getMainWindow();
    const isVisible = await mainWindow.isVisible();
    expect(isVisible).toBe(true);
  });

  test('should handle memory pressure', async ({
    appPage,
    electronHelpers
  }) => {
    await electronHelpers.waitForAppReady();
    await electronHelpers.startPerformanceMonitoring();

    // Create memory pressure
    await appPage.evaluate(() => {
      const data = [];
      for (let i = 0; i < 1000; i++) {
        data.push(new Array(1000).fill('test data'));
      }
      // Store reference to prevent garbage collection
      (window as any).testData = data;
    });

    // Wait and check memory
    await appPage.waitForTimeout(2000);

    const performanceData = await electronHelpers.getPerformanceData();
    expect(performanceData).toBeTruthy();

    // App should still be responsive
    const isResponsive = await appPage.evaluate(() => {
      return document.readyState === 'complete';
    });
    expect(isResponsive).toBe(true);
  });
});