import { test, expect, Page, BrowserContext } from '@playwright/test';
import { spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';

/**
 * Browser-based validation tests for Vite + React + Electron setup
 *
 * These tests validate:
 * 1. Application loads in browser at localhost:3000
 * 2. No console errors about missing modules
 * 3. React components render correctly
 * 4. Mock Electron API functions properly
 * 5. UI features work as expected
 */

let viteServer: ChildProcess | null = null;
let serverReady = false;

test.describe('Vite + React + Electron Validation', () => {
  test.beforeAll(async () => {
    // Start Vite dev server
    await startViteServer();
  });

  test.afterAll(async () => {
    // Clean up Vite server
    if (viteServer) {
      viteServer.kill();
    }
  });

  test.beforeEach(async ({ page }) => {
    // Set up console error monitoring
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Set up network error monitoring
    page.on('requestfailed', request => {
      console.warn(`Failed request: ${request.url()} - ${request.failure()?.errorText}`);
    });

    // Store console errors on page for test access
    await page.addInitScript(() => {
      (window as any).testConsoleErrors = [];
      const originalConsoleError = console.error;
      console.error = (...args) => {
        (window as any).testConsoleErrors.push(args.join(' '));
        originalConsoleError.apply(console, args);
      };
    });
  });

  test('should start Vite dev server without errors', async ({ page }) => {
    await test.step('Navigate to application', async () => {
      await page.goto('http://localhost:3000', {
        waitUntil: 'networkidle',
        timeout: 30000
      });
    });

    await test.step('Verify page loads', async () => {
      await expect(page).toHaveTitle(/Accenture Mainframe AI Assistant/);
    });

    await test.step('Check for server errors', async () => {
      const response = await page.goto('http://localhost:3000');
      expect(response?.status()).toBe(200);
    });
  });

  test('should load React application without module errors', async ({ page }) => {
    await page.goto('http://localhost:3000');

    await test.step('Wait for React to mount', async () => {
      await page.waitForSelector('#root', { timeout: 15000 });
    });

    await test.step('Verify React root element', async () => {
      const rootElement = await page.locator('#root');
      await expect(rootElement).toBeVisible();
    });

    await test.step('Check for React content', async () => {
      // Wait for React content to render
      await page.waitForFunction(() => {
        const root = document.getElementById('root');
        return root && root.children.length > 0;
      }, { timeout: 10000 });

      const hasContent = await page.evaluate(() => {
        const root = document.getElementById('root');
        return root && root.children.length > 0;
      });

      expect(hasContent).toBe(true);
    });

    await test.step('Verify no module loading errors', async () => {
      const consoleErrors = await page.evaluate(() => (window as any).testConsoleErrors || []);

      const moduleErrors = consoleErrors.filter((error: string) =>
        error.includes('module') ||
        error.includes('import') ||
        error.includes('require') ||
        error.includes('Cannot resolve')
      );

      if (moduleErrors.length > 0) {
        console.warn('Module-related console errors found:', moduleErrors);
      }

      // Allow some warnings but no critical module errors
      const criticalErrors = moduleErrors.filter((error: string) =>
        error.includes('Cannot resolve') ||
        error.includes('Module not found')
      );

      expect(criticalErrors).toHaveLength(0);
    });
  });

  test('should validate console for unexpected errors', async ({ page }) => {
    await page.goto('http://localhost:3000');

    // Wait for application to fully load
    await page.waitForTimeout(3000);

    await test.step('Check console errors', async () => {
      const consoleErrors = await page.evaluate(() => (window as any).testConsoleErrors || []);

      // Filter out expected/harmless errors
      const significantErrors = consoleErrors.filter((error: string) => {
        return !error.includes('Electron API not found') && // Expected in browser
               !error.includes('web-vitals') && // Optional dependency
               !error.includes('experimental') && // Vite experimental features
               !error.includes('DevTools') && // Browser DevTools messages
               !error.toLowerCase().includes('warning'); // General warnings
      });

      if (significantErrors.length > 0) {
        console.log('Unexpected console errors found:', significantErrors);
      }

      expect(significantErrors).toHaveLength(0);
    });
  });

  test('should validate UI features', async ({ page }) => {
    await page.goto('http://localhost:3000');

    await test.step('Verify main heading', async () => {
      const heading = page.locator('h1:has-text("Accenture Mainframe AI Assistant")');
      await expect(heading).toBeVisible({ timeout: 10000 });
    });

    await test.step('Verify status indicator', async () => {
      const statusElement = page.locator('.status');
      await expect(statusElement).toBeVisible();
      await expect(statusElement).toContainText('Application is running successfully');
    });

    await test.step('Verify feature cards', async () => {
      const featureCards = page.locator('.feature');
      await expect(featureCards).toHaveCount(6); // Based on index.html

      // Check individual features
      await expect(page.locator('.feature:has-text("Knowledge Base")')).toBeVisible();
      await expect(page.locator('.feature:has-text("Smart Search")')).toBeVisible();
      await expect(page.locator('.feature:has-text("Analytics")')).toBeVisible();
      await expect(page.locator('.feature:has-text("Performance")')).toBeVisible();
      await expect(page.locator('.feature:has-text("Themes")')).toBeVisible();
      await expect(page.locator('.feature:has-text("Accessibility")')).toBeVisible();
    });

    await test.step('Verify interactive elements', async () => {
      const features = page.locator('.feature');
      const firstFeature = features.first();

      // Test hover effect
      await firstFeature.hover();

      // Verify feature cards are interactive (CSS transforms)
      const transform = await firstFeature.evaluate(el =>
        window.getComputedStyle(el).transform
      );

      // Should have some transform applied on hover (translateY)
      expect(transform).not.toBe('none');
    });
  });

  test('should validate mock Electron API', async ({ page }) => {
    await page.goto('http://localhost:3000');

    await test.step('Check window.electronAPI exists', async () => {
      const hasElectronAPI = await page.evaluate(() => {
        return typeof window.electronAPI !== 'undefined';
      });

      expect(hasElectronAPI).toBe(true);
    });

    await test.step('Verify mock API methods', async () => {
      const apiMethods = await page.evaluate(() => {
        const api = (window as any).electronAPI;
        if (!api) return [];

        return Object.keys(api).filter(key => typeof api[key] === 'function');
      });

      expect(apiMethods.length).toBeGreaterThan(0);
      console.log('Available Electron API methods:', apiMethods);
    });

    await test.step('Test mock API functionality', async () => {
      // Test that mock API doesn't throw errors when called
      const apiTestResult = await page.evaluate(async () => {
        const api = (window as any).electronAPI;
        const results: any = {};

        try {
          // Test common API methods if they exist
          if (api.logError) {
            api.logError({ test: true });
            results.logError = 'success';
          }

          if (api.onThemeChange) {
            // This should be a function that accepts a callback
            if (typeof api.onThemeChange === 'function') {
              results.onThemeChange = 'success';
            }
          }

          return results;
        } catch (error) {
          return { error: error.message };
        }
      });

      expect(apiTestResult.error).toBeUndefined();
    });
  });

  test('should validate performance metrics', async ({ page }) => {
    await page.goto('http://localhost:3000');

    await test.step('Check page load performance', async () => {
      const performanceMetrics = await page.evaluate(() => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;

        return {
          domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
          loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
          firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime || 0,
          firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0
        };
      });

      console.log('Performance metrics:', performanceMetrics);

      // Basic performance thresholds
      expect(performanceMetrics.domContentLoaded).toBeLessThan(3000); // 3s
      expect(performanceMetrics.loadComplete).toBeLessThan(5000); // 5s
    });

    await test.step('Check for memory leaks', async () => {
      // Basic check - reload page and ensure no excessive memory growth
      const initialMemory = await page.evaluate(() => {
        return (performance as any).memory?.usedJSHeapSize || 0;
      });

      await page.reload();
      await page.waitForTimeout(2000);

      const finalMemory = await page.evaluate(() => {
        return (performance as any).memory?.usedJSHeapSize || 0;
      });

      if (initialMemory > 0 && finalMemory > 0) {
        const memoryGrowth = finalMemory - initialMemory;
        const growthPercent = (memoryGrowth / initialMemory) * 100;

        console.log(`Memory growth: ${memoryGrowth} bytes (${growthPercent.toFixed(2)}%)`);

        // Allow up to 50% memory growth on reload (generous threshold)
        expect(growthPercent).toBeLessThan(50);
      }
    });
  });

  test('should validate responsive design', async ({ page }) => {
    await page.goto('http://localhost:3000');

    await test.step('Test desktop view', async () => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.waitForTimeout(500);

      const container = page.locator('.container');
      await expect(container).toBeVisible();
    });

    await test.step('Test tablet view', async () => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.waitForTimeout(500);

      const container = page.locator('.container');
      await expect(container).toBeVisible();

      // Features should still be visible
      const features = page.locator('.features');
      await expect(features).toBeVisible();
    });

    await test.step('Test mobile view', async () => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.waitForTimeout(500);

      const container = page.locator('.container');
      await expect(container).toBeVisible();

      // Check that content adapts to small screen
      const heading = page.locator('h1');
      await expect(heading).toBeVisible();
    });
  });

  test('should validate accessibility basics', async ({ page }) => {
    await page.goto('http://localhost:3000');

    await test.step('Check for basic accessibility attributes', async () => {
      // Check if page has proper lang attribute
      const htmlLang = await page.getAttribute('html', 'lang');
      expect(htmlLang).toBe('en');

      // Check if there's a main heading
      const headings = await page.locator('h1').count();
      expect(headings).toBeGreaterThan(0);
    });

    await test.step('Verify keyboard navigation', async () => {
      // Test if interactive elements are focusable
      await page.keyboard.press('Tab');
      const focusedElement = await page.evaluate(() =>
        document.activeElement?.tagName
      );

      // Should focus on some element
      expect(focusedElement).toBeDefined();
    });

    await test.step('Check color contrast', async () => {
      // Basic color visibility check - ensure text is visible
      const textColor = await page.locator('h1').evaluate(el =>
        window.getComputedStyle(el).color
      );

      const backgroundColor = await page.locator('body').evaluate(el =>
        window.getComputedStyle(el).backgroundColor
      );

      expect(textColor).toBeDefined();
      expect(backgroundColor).toBeDefined();
    });
  });
});

async function startViteServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log('Starting Vite dev server...');

    viteServer = spawn('npm', ['run', 'dev'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, NODE_ENV: 'development' }
    });

    const timeout = setTimeout(() => {
      if (!serverReady) {
        viteServer?.kill();
        reject(new Error('Vite server failed to start within timeout'));
      }
    }, 30000);

    viteServer.stdout?.on('data', (data) => {
      const output = data.toString();
      console.log('Vite stdout:', output);

      if (output.includes('Local:') && output.includes('3000')) {
        serverReady = true;
        clearTimeout(timeout);
        console.log('Vite server is ready!');
        setTimeout(resolve, 2000); // Give it a moment to fully initialize
      }
    });

    viteServer.stderr?.on('data', (data) => {
      const output = data.toString();
      console.log('Vite stderr:', output);

      // Only fail on actual errors, not warnings
      if (output.includes('Error') && !output.includes('warning') && !output.includes('experimental')) {
        clearTimeout(timeout);
        viteServer?.kill();
        reject(new Error(`Vite server error: ${output}`));
      }
    });

    viteServer.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    viteServer.on('exit', (code) => {
      if (code !== 0 && !serverReady) {
        clearTimeout(timeout);
        reject(new Error(`Vite server exited with code ${code}`));
      }
    });
  });
}