const { chromium } = require('playwright');
const fs = require('fs').promises;

class PlaywrightBrowserTester {
  constructor() {
    this.browser = null;
    this.page = null;
    this.testResults = [];
    this.screenshotDir = '/mnt/c/mainframe-ai-assistant/test-results/screenshots';
    this.performanceMetrics = {};
  }

  async initialize() {
    await fs.mkdir(this.screenshotDir, { recursive: true });

    this.browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox']
    });

    this.page = await this.browser.newPage();
    await this.page.setViewportSize({ width: 1920, height: 1080 });

    console.log('🎭 Playwright browser initialized');
  }

  async captureScreenshot(name, description) {
    const timestamp = Date.now();
    const filename = `${name}_${timestamp}.png`;
    const filepath = `${this.screenshotDir}/${filename}`;

    await this.page.screenshot({
      path: filepath,
      fullPage: true
    });

    console.log(`📸 Screenshot: ${filename} - ${description}`);
    return { filename, filepath, description };
  }

  async testApplicationLoad() {
    console.log('🚀 Testing application load with Playwright...');

    const startTime = Date.now();

    try {
      const response = await this.page.goto('http://localhost:3002', {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      const endTime = Date.now();
      const loadTime = endTime - startTime;

      await this.captureScreenshot('01-app-load', 'Application loaded');

      // Get page title
      const title = await this.page.title();

      // Check for console errors
      const consoleErrors = [];
      this.page.on('console', msg => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });

      // Wait for any dynamic content
      await this.page.waitForTimeout(2000);

      // Check if React has loaded
      const hasReact = await this.page.evaluate(() => {
        return window.React !== undefined || document.querySelector('[data-reactroot]') !== null;
      });

      const testResult = {
        test: 'Application Load (Playwright)',
        status: response.ok() ? 'PASS' : 'FAIL',
        loadTime: `${loadTime}ms`,
        title,
        hasReact,
        consoleErrors: consoleErrors.length,
        screenshot: '01-app-load'
      };

      this.testResults.push(testResult);
      this.performanceMetrics.loadTime = loadTime;

      console.log('✅ Application load test completed');
      return testResult;

    } catch (error) {
      const testResult = {
        test: 'Application Load (Playwright)',
        status: 'FAIL',
        error: error.message,
        screenshot: '01-app-load-failed'
      };

      await this.captureScreenshot('01-app-load-failed', `Load failed: ${error.message}`);
      this.testResults.push(testResult);
      return testResult;
    }
  }

  async testNavigationElements() {
    console.log('🧭 Testing navigation elements...');

    try {
      // Wait for the page to be fully loaded
      await this.page.waitForLoadState('networkidle');

      // Look for navigation elements
      const navElements = await this.page.locator('nav, .nav, [role="navigation"]').count();
      const buttonElements = await this.page.locator('button').count();
      const linkElements = await this.page.locator('a[href]').count();

      // Look for specific navigation items
      const dashboardElements = await this.page.locator('text=Dashboard').count();
      const incidentElements = await this.page.locator('text=/incident/i').count();

      await this.captureScreenshot('02-navigation', 'Navigation elements analysis');

      // Try to find and analyze tabs
      const possibleTabs = await this.page.evaluate(() => {
        const elements = document.querySelectorAll('a, button, .tab, [role="tab"]');
        return Array.from(elements)
          .filter(el => {
            const text = el.textContent?.toLowerCase() || '';
            return text.includes('dashboard') ||
                   text.includes('incident') ||
                   text.includes('incidente') ||
                   text.includes('search') ||
                   text.includes('busca');
          })
          .map(el => ({
            text: el.textContent,
            tag: el.tagName,
            href: el.href || null,
            className: el.className
          }));
      });

      console.log('📑 Found navigation elements:', possibleTabs);

      const testResult = {
        test: 'Navigation Elements',
        status: (dashboardElements > 0 && incidentElements > 0) ? 'PASS' : 'WARN',
        navElements,
        buttonElements,
        linkElements,
        dashboardElements,
        incidentElements,
        possibleTabs,
        screenshot: '02-navigation'
      };

      this.testResults.push(testResult);
      return testResult;

    } catch (error) {
      const testResult = {
        test: 'Navigation Elements',
        status: 'FAIL',
        error: error.message
      };

      this.testResults.push(testResult);
      return testResult;
    }
  }

  async testModalFunctionality() {
    console.log('🔍 Testing modal functionality...');

    try {
      // Look for create/add buttons
      const createButtons = await this.page.locator('button').filter({ hasText: /\+|create|criar|novo|add/i });
      const createButtonCount = await createButtons.count();

      console.log(`➕ Found ${createButtonCount} potential create buttons`);

      if (createButtonCount === 0) {
        // Look for any button that might open a modal
        const allButtons = await this.page.locator('button').all();

        for (let i = 0; i < Math.min(allButtons.length, 5); i++) {
          const button = allButtons[i];
          const buttonText = await button.textContent();
          console.log(`🔘 Button ${i + 1}: "${buttonText}"`);
        }
      }

      await this.captureScreenshot('03-modal-before', 'Before modal test');

      let modalTested = false;
      let modalResults = {
        openSuccess: false,
        closeByButton: false,
        closeByEsc: false,
        closeByBackdrop: false
      };

      if (createButtonCount > 0) {
        try {
          // Click the first create button
          await createButtons.first().click();
          await this.page.waitForTimeout(1000);

          // Check if modal appeared
          const modal = this.page.locator('.modal, [role="dialog"], .modal-container, .dialog-overlay');
          const modalVisible = await modal.count() > 0;

          if (modalVisible) {
            modalResults.openSuccess = true;
            console.log('✅ Modal opened successfully');

            await this.captureScreenshot('03-modal-opened', 'Modal opened');

            // Test close button
            const closeButton = this.page.locator('button').filter({ hasText: /×|✕|close|fechar/i });
            const closeButtonCount = await closeButton.count();

            if (closeButtonCount > 0) {
              await closeButton.first().click();
              await this.page.waitForTimeout(500);

              const modalStillVisible = await modal.count() > 0;
              modalResults.closeByButton = !modalStillVisible;

              if (modalResults.closeByButton) {
                console.log('✅ Close button works');
              } else {
                console.log('❌ Close button failed');
              }

              // Reopen for next test
              await createButtons.first().click();
              await this.page.waitForTimeout(500);
            }

            // Test ESC key
            await this.page.keyboard.press('Escape');
            await this.page.waitForTimeout(500);

            const modalAfterEsc = await modal.count() > 0;
            modalResults.closeByEsc = !modalAfterEsc;

            if (modalResults.closeByEsc) {
              console.log('✅ ESC key works');
            } else {
              console.log('❌ ESC key failed');
              // Reopen for next test
              await createButtons.first().click();
              await this.page.waitForTimeout(500);
            }

            // Test backdrop click
            await this.page.locator('body').click({ position: { x: 50, y: 50 } });
            await this.page.waitForTimeout(500);

            const modalAfterBackdrop = await modal.count() > 0;
            modalResults.closeByBackdrop = !modalAfterBackdrop;

            if (modalResults.closeByBackdrop) {
              console.log('✅ Backdrop click works');
            } else {
              console.log('❌ Backdrop click failed');
            }

            modalTested = true;

          } else {
            console.log('❌ Modal did not appear after button click');
          }

        } catch (error) {
          console.log('⚠️ Modal test error:', error.message);
        }
      }

      await this.captureScreenshot('03-modal-after', 'After modal test');

      const testResult = {
        test: 'Modal Functionality',
        status: modalTested && modalResults.openSuccess ? 'PASS' : 'FAIL',
        createButtonCount,
        modalResults,
        tested: modalTested,
        screenshot: '03-modal'
      };

      this.testResults.push(testResult);
      return testResult;

    } catch (error) {
      const testResult = {
        test: 'Modal Functionality',
        status: 'FAIL',
        error: error.message
      };

      this.testResults.push(testResult);
      return testResult;
    }
  }

  async testRouteNavigation() {
    console.log('🗺️ Testing route navigation...');

    const routes = ['/', '/incidents', '/dashboard'];
    const routeResults = [];

    for (const route of routes) {
      try {
        const startTime = Date.now();
        await this.page.goto(`http://localhost:3002${route}`, { waitUntil: 'networkidle' });
        const endTime = Date.now();

        const title = await this.page.title();
        const url = this.page.url();

        await this.captureScreenshot(`04-route${route.replace('/', '-root')}`, `Route: ${route}`);

        routeResults.push({
          route,
          loadTime: endTime - startTime,
          title,
          url,
          success: true
        });

        console.log(`✅ Route ${route}: ${endTime - startTime}ms`);

      } catch (error) {
        routeResults.push({
          route,
          error: error.message,
          success: false
        });

        console.log(`❌ Route ${route}: ${error.message}`);
      }
    }

    const testResult = {
      test: 'Route Navigation',
      status: routeResults.filter(r => r.success).length >= 2 ? 'PASS' : 'FAIL',
      routeResults,
      screenshot: '04-routes'
    };

    this.testResults.push(testResult);
    return testResult;
  }

  async generateReport() {
    const summary = {
      totalTests: this.testResults.length,
      passed: this.testResults.filter(t => t.status === 'PASS').length,
      failed: this.testResults.filter(t => t.status === 'FAIL').length,
      warnings: this.testResults.filter(t => t.status === 'WARN').length
    };

    const report = {
      timestamp: new Date().toISOString(),
      testSuite: 'Playwright Browser Testing',
      summary,
      performanceMetrics: this.performanceMetrics,
      testResults: this.testResults,
      screenshots: []
    };

    // List all screenshots
    try {
      const files = await fs.readdir(this.screenshotDir);
      report.screenshots = files.filter(f => f.endsWith('.png'));
    } catch (error) {
      console.log('Could not list screenshots:', error.message);
    }

    const reportPath = '/mnt/c/mainframe-ai-assistant/test-results/playwright-test-report.json';
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

    console.log('📊 Playwright report saved to:', reportPath);
    return report;
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  async runFullSuite() {
    try {
      await this.initialize();

      console.log('🎭 Starting Playwright browser testing...\n');

      await this.testApplicationLoad();
      await this.testNavigationElements();
      await this.testModalFunctionality();
      await this.testRouteNavigation();

      const report = await this.generateReport();

      console.log('\n🎯 PLAYWRIGHT TESTING COMPLETE!');
      console.log(`✅ Passed: ${report.summary.passed}`);
      console.log(`❌ Failed: ${report.summary.failed}`);
      console.log(`⚠️ Warnings: ${report.summary.warnings}`);

      return report;

    } catch (error) {
      console.error('❌ Playwright testing failed:', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }
}

// Run the tests
if (require.main === module) {
  const tester = new PlaywrightBrowserTester();
  tester.runFullSuite()
    .then(report => {
      console.log('🎉 Playwright testing completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Testing failed:', error);
      process.exit(1);
    });
}

module.exports = PlaywrightBrowserTester;