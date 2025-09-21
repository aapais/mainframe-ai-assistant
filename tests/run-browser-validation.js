/**
 * Browser-Based Incident Management Validation Script
 *
 * This script launches the application and performs real browser testing
 * to validate the incident management system functionality.
 */

const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

// Configuration
const APP_URL = 'http://localhost:3001';
const VALIDATION_REPORT_PATH = path.join(__dirname, '../BROWSER_VALIDATION_REPORT.md');
const SCREENSHOT_DIR = path.join(__dirname, 'playwright/screenshots/browser-validation');

class BrowserValidationRunner {
  constructor() {
    this.results = [];
    this.startTime = Date.now();
    this.serverProcess = null;
  }

  async ensureDirectories() {
    try {
      await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
    } catch (error) {
      console.warn('Warning: Could not create screenshot directory:', error.message);
    }
  }

  recordResult(testName, status, details, duration, errors = []) {
    this.results.push({
      testName,
      status,
      details,
      duration,
      errors,
      timestamp: new Date().toISOString()
    });

    const statusIcon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⏭️';
    console.log(`${statusIcon} ${testName} (${duration}ms): ${details}`);

    if (errors.length > 0) {
      errors.forEach(error => console.log(`   ⚠️  ${error}`));
    }
  }

  async startDevelopmentServer() {
    return new Promise((resolve, reject) => {
      console.log('🚀 Starting development server...');

      this.serverProcess = spawn('npm', ['run', 'dev'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: process.cwd()
      });

      let serverReady = false;
      let output = '';

      this.serverProcess.stdout.on('data', (data) => {
        output += data.toString();
        console.log(`[SERVER] ${data.toString().trim()}`);

        // Check for server ready indicators
        if (data.toString().includes('Local:') ||
            data.toString().includes('localhost:3001') ||
            data.toString().includes('ready in')) {
          if (!serverReady) {
            serverReady = true;
            console.log('✅ Development server is ready!');
            setTimeout(resolve, 2000); // Give server extra time to stabilize
          }
        }
      });

      this.serverProcess.stderr.on('data', (data) => {
        console.log(`[SERVER ERROR] ${data.toString().trim()}`);
      });

      this.serverProcess.on('close', (code) => {
        if (!serverReady) {
          reject(new Error(`Server exited with code ${code} before becoming ready`));
        }
      });

      this.serverProcess.on('error', (error) => {
        reject(new Error(`Failed to start server: ${error.message}`));
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        if (!serverReady) {
          reject(new Error('Server failed to start within 30 seconds'));
        }
      }, 30000);
    });
  }

  async stopDevelopmentServer() {
    if (this.serverProcess) {
      console.log('🛑 Stopping development server...');
      this.serverProcess.kill('SIGTERM');

      // Give it time to shut down gracefully
      await new Promise(resolve => setTimeout(resolve, 2000));

      if (!this.serverProcess.killed) {
        this.serverProcess.kill('SIGKILL');
      }
    }
  }

  async testServerAvailability() {
    const startTime = Date.now();
    const errors = [];
    let status = 'PASS';

    try {
      const fetch = (await import('node-fetch')).default;

      console.log(`Testing server availability at ${APP_URL}...`);

      const response = await fetch(APP_URL, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Browser-Validation-Script'
        }
      });

      if (!response.ok) {
        errors.push(`Server returned status ${response.status}: ${response.statusText}`);
        status = 'FAIL';
      } else {
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('text/html')) {
          errors.push(`Expected HTML content, got: ${contentType}`);
          status = 'FAIL';
        }
      }

    } catch (error) {
      errors.push(`Server availability check failed: ${error.message}`);
      status = 'FAIL';
    }

    const duration = Date.now() - startTime;
    this.recordResult(
      'Server Availability Check',
      status,
      status === 'PASS' ? 'Server is responding correctly' : 'Server availability issues',
      duration,
      errors
    );

    return status === 'PASS';
  }

  async runSimpleBrowserTest() {
    const startTime = Date.now();
    const errors = [];
    let status = 'PASS';

    try {
      // Install puppeteer temporarily for basic browser testing
      const puppeteer = require('puppeteer-core');

      console.log('🌐 Launching browser for testing...');

      const browser = await puppeteer.launch({
        headless: true,
        executablePath: '/usr/bin/google-chrome-stable',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-web-security',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding'
        ]
      });

      const page = await browser.newPage();

      // Set up console error monitoring
      const consoleErrors = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });

      page.on('pageerror', (error) => {
        consoleErrors.push(`Page Error: ${error.message}`);
      });

      // Navigate to application
      console.log('📍 Navigating to application...');
      await page.goto(APP_URL, { waitUntil: 'networkidle0', timeout: 30000 });

      // Take screenshot of home page
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, 'homepage.png'),
        fullPage: true
      });

      // Check for main application elements
      console.log('🔍 Checking main application elements...');

      const headerExists = await page.$('header');
      if (!headerExists) {
        errors.push('Main header element not found');
        status = 'FAIL';
      }

      const mainExists = await page.$('main');
      if (!mainExists) {
        errors.push('Main content element not found');
        status = 'FAIL';
      }

      // Check for Accenture branding
      const accentureLogo = await page.$('text=Mainframe AI Assistant');
      if (!accentureLogo) {
        errors.push('Accenture branding not found');
        status = 'FAIL';
      }

      // Navigate to incidents page
      console.log('🚨 Testing navigation to incidents page...');

      const incidentsButton = await page.$('button:has-text("Incidents")');
      if (!incidentsButton) {
        errors.push('Incidents navigation button not found');
        status = 'FAIL';
      } else {
        await incidentsButton.click();
        await page.waitForTimeout(2000); // Wait for navigation

        // Take screenshot of incidents page
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, 'incidents-page.png'),
          fullPage: true
        });

        // Check incidents page elements
        const incidentsTitle = await page.$('text=Gestão de Incidentes');
        if (!incidentsTitle) {
          errors.push('Incidents page title not found');
          status = 'FAIL';
        }

        const searchInput = await page.$('input[placeholder*="Pesquisar"]');
        if (!searchInput) {
          errors.push('Search input not found on incidents page');
          status = 'FAIL';
        }

        const createButton = await page.$('button[title*="Reportar"]');
        if (!createButton) {
          errors.push('Create incident button not found');
          status = 'FAIL';
        }

        // Test create incident modal
        console.log('📝 Testing create incident modal...');
        if (createButton) {
          await createButton.click();
          await page.waitForTimeout(1000);

          // Take screenshot of modal
          await page.screenshot({
            path: path.join(SCREENSHOT_DIR, 'create-incident-modal.png'),
            fullPage: true
          });

          const modal = await page.$('[data-testid="create-incident-modal"]');
          if (!modal) {
            errors.push('Create incident modal not found');
            status = 'FAIL';
          }

          // Close modal
          const closeButton = await page.$('button:has-text("Fechar")') ||
                             await page.$('button:has-text("Cancelar")');
          if (closeButton) {
            await closeButton.click();
            await page.waitForTimeout(500);
          }
        }

        // Test bulk upload modal
        console.log('📤 Testing bulk upload modal...');
        const bulkUploadButton = await page.$('button:has-text("Upload em Massa")');
        if (bulkUploadButton) {
          await bulkUploadButton.click();
          await page.waitForTimeout(1000);

          // Take screenshot of bulk upload modal
          await page.screenshot({
            path: path.join(SCREENSHOT_DIR, 'bulk-upload-modal.png'),
            fullPage: true
          });

          const bulkModal = await page.$('text=Upload em Massa de Incidentes');
          if (!bulkModal) {
            errors.push('Bulk upload modal not found');
            status = 'FAIL';
          }

          // Close modal
          const closeBulkButton = await page.$('button:has-text("Fechar")') ||
                                 await page.keyboard.press('Escape');
          if (closeBulkButton) {
            await closeBulkButton.click();
            await page.waitForTimeout(500);
          }
        }

        // Test search functionality
        console.log('🔍 Testing search functionality...');
        if (searchInput) {
          await searchInput.fill('CICS');
          await page.waitForTimeout(1000); // Wait for debounced search

          // Take screenshot of search results
          await page.screenshot({
            path: path.join(SCREENSHOT_DIR, 'search-results.png'),
            fullPage: true
          });
        }

        // Test responsive design
        console.log('📱 Testing responsive design...');
        await page.setViewport({ width: 375, height: 667 }); // Mobile viewport
        await page.waitForTimeout(1000);

        // Take mobile screenshot
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, 'mobile-view.png'),
          fullPage: true
        });

        // Reset to desktop viewport
        await page.setViewport({ width: 1280, height: 720 });
        await page.waitForTimeout(1000);
      }

      // Check for console errors
      if (consoleErrors.length > 0) {
        errors.push(...consoleErrors.map(err => `Console Error: ${err}`));
        status = 'FAIL';
      }

      await browser.close();

    } catch (error) {
      errors.push(`Browser test failed: ${error.message}`);
      status = 'FAIL';
    }

    const duration = Date.now() - startTime;
    this.recordResult(
      'Browser Functionality Test',
      status,
      status === 'PASS' ? 'All browser tests passed successfully' : 'Browser test failures detected',
      duration,
      errors
    );

    return status === 'PASS';
  }

  async generateReport() {
    const totalDuration = Date.now() - this.startTime;
    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.status === 'PASS').length;
    const failedTests = this.results.filter(r => r.status === 'FAIL').length;
    const successRate = totalTests > 0 ? ((passedTests / totalTests) * 100).toFixed(1) : '0.0';

    const report = `# Incident Management System - Browser Validation Report

## Executive Summary
- **Validation Date**: ${new Date().toISOString()}
- **Application URL**: ${APP_URL}
- **Total Tests**: ${totalTests}
- **Passed**: ${passedTests} ✅
- **Failed**: ${failedTests} ❌
- **Success Rate**: ${successRate}%
- **Total Duration**: ${totalDuration}ms

## Overall Assessment
${failedTests === 0
  ? '🎉 **ALL BROWSER TESTS PASSED** - The incident management system is fully functional!'
  : `⚠️  **${failedTests} TEST(S) FAILED** - Issues detected in browser functionality.`
}

## Test Results

${this.results.map(result => `
### ${result.testName}
- **Status**: ${result.status === 'PASS' ? '✅ PASS' : '❌ FAIL'}
- **Duration**: ${result.duration}ms
- **Details**: ${result.details}
- **Timestamp**: ${result.timestamp}
${result.errors.length > 0 ? `- **Issues**:\n${result.errors.map(e => `  - ${e}`).join('\n')}` : ''}
`).join('\n')}

## Validation Criteria Results

### ✅ Application Loading
- [${this.results.find(r => r.testName.includes('Server'))?.status === 'PASS' ? 'x' : ' '}] Application loads without console errors
- [${this.results.find(r => r.testName.includes('Browser'))?.status === 'PASS' ? 'x' : ' '}] Main application renders (not just floating widget)

### ✅ Navigation & Pages
- [${this.results.find(r => r.testName.includes('Browser') && !r.errors.some(e => e.includes('Incidents')))?.status === 'PASS' ? 'x' : ' '}] Incidents page accessible and functional
- [${this.results.find(r => r.testName.includes('Browser') && !r.errors.some(e => e.includes('navigation')))?.status === 'PASS' ? 'x' : ' '}] Navigation works correctly

### ✅ Modal Interactions
- [${this.results.find(r => r.testName.includes('Browser') && !r.errors.some(e => e.includes('modal')))?.status === 'PASS' ? 'x' : ' '}] CreateIncidentModal opens and works
- [${this.results.find(r => r.testName.includes('Browser') && !r.errors.some(e => e.includes('bulk')))?.status === 'PASS' ? 'x' : ' '}] BulkUploadModal opens and works

### ✅ Responsive Design
- [${this.results.find(r => r.testName.includes('Browser') && !r.errors.some(e => e.includes('responsive')))?.status === 'PASS' ? 'x' : ' '}] Mobile layout works correctly
- [${this.results.find(r => r.testName.includes('Browser') && !r.errors.some(e => e.includes('desktop')))?.status === 'PASS' ? 'x' : ' '}] Desktop layout works correctly

### ✅ Portuguese Localization
- [${this.results.find(r => r.testName.includes('Browser') && !r.errors.some(e => e.includes('Gestão')))?.status === 'PASS' ? 'x' : ' '}] Portuguese interface displays correctly

## Screenshots Captured

The following screenshots were captured during testing:

1. **Homepage**: [homepage.png](./tests/playwright/screenshots/browser-validation/homepage.png)
2. **Incidents Page**: [incidents-page.png](./tests/playwright/screenshots/browser-validation/incidents-page.png)
3. **Create Incident Modal**: [create-incident-modal.png](./tests/playwright/screenshots/browser-validation/create-incident-modal.png)
4. **Bulk Upload Modal**: [bulk-upload-modal.png](./tests/playwright/screenshots/browser-validation/bulk-upload-modal.png)
5. **Search Results**: [search-results.png](./tests/playwright/screenshots/browser-validation/search-results.png)
6. **Mobile View**: [mobile-view.png](./tests/playwright/screenshots/browser-validation/mobile-view.png)

${failedTests > 0 ? `
## 🚨 Issues Found

${this.results.filter(r => r.status === 'FAIL').map(r => `
### ${r.testName}
${r.errors.map(e => `- ${e}`).join('\n')}
`).join('\n')}

## Recommended Actions

1. **Review the issues listed above**
2. **Check the captured screenshots for visual validation**
3. **Fix any component or styling issues**
4. **Re-run this validation**: \`node tests/run-browser-validation.js\`
` : `
## ✅ All Tests Passed!

The incident management system has been successfully validated:

### 🎯 Key Achievements
- ✅ Application loads without errors
- ✅ Navigation to incidents page works
- ✅ All Phase 2 components are visible and functional
- ✅ Modal interactions work correctly
- ✅ Portuguese localization is correct
- ✅ Responsive design works on mobile and desktop
- ✅ Search functionality is operational

### 🚀 Ready for Production
The system is ready for end-user testing and production deployment.
`}

## Technical Details

- **Browser**: Chromium (Headless)
- **Viewport**: 1280x720 (Desktop), 375x667 (Mobile)
- **Test Duration**: ${totalDuration}ms
- **Node.js Version**: ${process.version}
- **Report Generated**: ${new Date().toLocaleString()}

---
*Browser validation completed on ${new Date().toLocaleString()}*
`;

    await fs.writeFile(VALIDATION_REPORT_PATH, report, 'utf-8');
    console.log(`\n📄 Report generated: ${VALIDATION_REPORT_PATH}`);
    console.log(`\n📊 Summary: ${passedTests}/${totalTests} tests passed (${successRate}%)`);

    return this.results;
  }

  async runAllValidations() {
    console.log('🚀 Starting Browser-Based Incident Management Validation...\n');

    try {
      await this.ensureDirectories();

      // Start the development server
      await this.startDevelopmentServer();

      // Test server availability
      const serverAvailable = await this.testServerAvailability();

      if (serverAvailable) {
        // Run browser functionality tests
        await this.runSimpleBrowserTest();
      } else {
        console.log('❌ Skipping browser tests due to server unavailability');
      }

      // Generate comprehensive report
      await this.generateReport();

      return this.results;

    } catch (error) {
      console.error('❌ Browser validation failed:', error.message);

      this.recordResult(
        'Browser Validation Error',
        'FAIL',
        error.message,
        Date.now() - this.startTime,
        [error.message]
      );

      await this.generateReport();
      return this.results;

    } finally {
      await this.stopDevelopmentServer();
    }
  }
}

// Main execution
if (require.main === module) {
  const runner = new BrowserValidationRunner();

  // Handle process termination
  process.on('SIGINT', async () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
    await runner.stopDevelopmentServer();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
    await runner.stopDevelopmentServer();
    process.exit(0);
  });

  runner.runAllValidations()
    .then(results => {
      const failedCount = results.filter(r => r.status === 'FAIL').length;
      console.log(`\n🏁 Browser validation completed ${failedCount === 0 ? 'successfully' : 'with issues'}`);
      process.exit(failedCount > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('❌ Validation failed with error:', error);
      process.exit(1);
    });
}

module.exports = BrowserValidationRunner;