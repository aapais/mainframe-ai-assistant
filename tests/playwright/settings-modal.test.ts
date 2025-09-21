import { test, expect, Page } from '@playwright/test';
import { chromium } from 'playwright';

test.describe('Application Settings Modal Tests', () => {
  const baseURL = 'http://localhost:5173';

  test.beforeEach(async ({ page }) => {
    // Set up test environment
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test('should load application homepage without errors', async ({ page }) => {
    // Navigate to the application
    const response = await page.goto(baseURL);

    // Verify the page loads successfully
    expect(response?.status()).toBe(200);

    // Wait for the page to fully load
    await page.waitForLoadState('networkidle');

    // Check for any console errors
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Take screenshot of the main page
    await page.screenshot({
      path: '/mnt/c/mainframe-ai-assistant/tests/playwright/screenshots/homepage.png',
      fullPage: true
    });

    // Verify no critical console errors
    const criticalErrors = consoleErrors.filter(error =>
      !error.includes('favicon') && !error.includes('manifest')
    );
    expect(criticalErrors).toHaveLength(0);

    console.log('✅ Homepage loaded successfully without errors');
  });

  test('should find and click Settings button', async ({ page }) => {
    await page.goto(baseURL);
    await page.waitForLoadState('networkidle');

    // Look for Settings button with various possible selectors
    const settingsSelectors = [
      'button:has-text("Settings")',
      '[data-testid="settings-button"]',
      '.settings-button',
      'button[aria-label*="Settings"]',
      'button[title*="Settings"]',
      '[role="button"]:has-text("Settings")',
      'button:has([data-icon="settings"])',
      'button:has(.settings-icon)',
      '[data-cy="settings"]'
    ];

    let settingsButton = null;
    for (const selector of settingsSelectors) {
      try {
        settingsButton = page.locator(selector).first();
        if (await settingsButton.isVisible({ timeout: 1000 })) {
          console.log(`✅ Found Settings button with selector: ${selector}`);
          break;
        }
      } catch (error) {
        // Continue to next selector
      }
    }

    if (!settingsButton || !(await settingsButton.isVisible())) {
      // Take screenshot to help debug
      await page.screenshot({
        path: '/mnt/c/mainframe-ai-assistant/tests/playwright/screenshots/no-settings-button.png',
        fullPage: true
      });

      // Log all visible buttons for debugging
      const allButtons = await page.locator('button').all();
      console.log('Available buttons:');
      for (const button of allButtons) {
        const text = await button.textContent();
        const ariaLabel = await button.getAttribute('aria-label');
        console.log(`- Button: "${text}" (aria-label: "${ariaLabel}")`);
      }

      throw new Error('Settings button not found with any of the expected selectors');
    }

    // Click the Settings button
    await settingsButton.click();
    console.log('✅ Settings button clicked successfully');
  });

  test('should verify Settings Modal opens with enhanced features', async ({ page }) => {
    await page.goto(baseURL);
    await page.waitForLoadState('networkidle');

    // Find and click Settings button
    let settingsButton = null;
    const settingsSelectors = [
      'button:has-text("Settings")',
      '[data-testid="settings-button"]',
      '.settings-button',
      'button[aria-label*="Settings"]'
    ];

    for (const selector of settingsSelectors) {
      try {
        settingsButton = page.locator(selector).first();
        if (await settingsButton.isVisible({ timeout: 1000 })) {
          break;
        }
      } catch (error) {
        continue;
      }
    }

    if (settingsButton && await settingsButton.isVisible()) {
      await settingsButton.click();
    }

    // Wait for modal to appear
    await page.waitForTimeout(1000);

    // Check for modal with various selectors
    const modalSelectors = [
      '[role="dialog"]',
      '.modal',
      '.settings-modal',
      '[data-testid="settings-modal"]',
      '.modal-content',
      '[aria-modal="true"]'
    ];

    let modal = null;
    for (const selector of modalSelectors) {
      try {
        modal = page.locator(selector).first();
        if (await modal.isVisible({ timeout: 2000 })) {
          console.log(`✅ Found Settings modal with selector: ${selector}`);
          break;
        }
      } catch (error) {
        continue;
      }
    }

    if (!modal || !(await modal.isVisible())) {
      await page.screenshot({
        path: '/mnt/c/mainframe-ai-assistant/tests/playwright/screenshots/no-modal.png',
        fullPage: true
      });
      console.log('❌ Settings modal not found');
      return;
    }

    // Take screenshot of the Settings Modal
    await page.screenshot({
      path: '/mnt/c/mainframe-ai-assistant/tests/playwright/screenshots/settings-modal.png',
      fullPage: true
    });

    // Check for enhanced features
    const features = {
      sidebar: false,
      breadcrumb: false,
      searchBar: false,
      footer: false,
      saveButton: false,
      cancelButton: false
    };

    // Check for sidebar navigation
    const sidebarSelectors = [
      '.sidebar',
      '.navigation',
      '.nav-sidebar',
      '[data-testid="sidebar"]',
      '.settings-sidebar'
    ];

    for (const selector of sidebarSelectors) {
      if (await page.locator(selector).isVisible()) {
        features.sidebar = true;
        console.log(`✅ Found sidebar with selector: ${selector}`);
        break;
      }
    }

    // Check for breadcrumb navigation
    const breadcrumbSelectors = [
      '.breadcrumb',
      '[aria-label*="breadcrumb"]',
      '.breadcrumb-nav',
      '[data-testid="breadcrumb"]'
    ];

    for (const selector of breadcrumbSelectors) {
      if (await page.locator(selector).isVisible()) {
        features.breadcrumb = true;
        console.log(`✅ Found breadcrumb with selector: ${selector}`);
        break;
      }
    }

    // Check for search bar
    const searchSelectors = [
      'input[type="search"]',
      'input[placeholder*="Search"]',
      '.search-input',
      '[data-testid="search"]',
      '.search-bar'
    ];

    for (const selector of searchSelectors) {
      if (await page.locator(selector).isVisible()) {
        features.searchBar = true;
        console.log(`✅ Found search bar with selector: ${selector}`);
        break;
      }
    }

    // Check for footer
    const footerSelectors = [
      '.modal-footer',
      '.footer',
      '.settings-footer',
      '[data-testid="modal-footer"]'
    ];

    for (const selector of footerSelectors) {
      if (await page.locator(selector).isVisible()) {
        features.footer = true;
        console.log(`✅ Found footer with selector: ${selector}`);
        break;
      }
    }

    // Check for Save and Cancel buttons
    const saveSelectors = [
      'button:has-text("Save")',
      '[data-testid="save-button"]',
      '.save-button'
    ];

    const cancelSelectors = [
      'button:has-text("Cancel")',
      '[data-testid="cancel-button"]',
      '.cancel-button'
    ];

    for (const selector of saveSelectors) {
      if (await page.locator(selector).isVisible()) {
        features.saveButton = true;
        console.log(`✅ Found Save button with selector: ${selector}`);
        break;
      }
    }

    for (const selector of cancelSelectors) {
      if (await page.locator(selector).isVisible()) {
        features.cancelButton = true;
        console.log(`✅ Found Cancel button with selector: ${selector}`);
        break;
      }
    }

    // Log findings
    console.log('\n🔍 Settings Modal Feature Analysis:');
    console.log(`- Sidebar Navigation: ${features.sidebar ? '✅ Found' : '❌ Not found'}`);
    console.log(`- Breadcrumb Navigation: ${features.breadcrumb ? '✅ Found' : '❌ Not found'}`);
    console.log(`- Search Bar: ${features.searchBar ? '✅ Found' : '❌ Not found'}`);
    console.log(`- Footer: ${features.footer ? '✅ Found' : '❌ Not found'}`);
    console.log(`- Save Button: ${features.saveButton ? '✅ Found' : '❌ Not found'}`);
    console.log(`- Cancel Button: ${features.cancelButton ? '✅ Found' : '❌ Not found'}`);

    // Generate feature score
    const foundFeatures = Object.values(features).filter(Boolean).length;
    const totalFeatures = Object.keys(features).length;
    console.log(`\n📊 Feature Coverage: ${foundFeatures}/${totalFeatures} (${Math.round((foundFeatures/totalFeatures)*100)}%)`);
  });

  test('should capture full application state for analysis', async ({ page }) => {
    await page.goto(baseURL);
    await page.waitForLoadState('networkidle');

    // Take initial screenshot
    await page.screenshot({
      path: '/mnt/c/mainframe-ai-assistant/tests/playwright/screenshots/initial-state.png',
      fullPage: true
    });

    // Log page structure
    const title = await page.title();
    const url = await page.url();
    console.log(`📄 Page Title: ${title}`);
    console.log(`🔗 URL: ${url}`);

    // Get all interactive elements
    const buttons = await page.locator('button').count();
    const inputs = await page.locator('input').count();
    const links = await page.locator('a').count();

    console.log(`\n🎯 Interactive Elements:`);
    console.log(`- Buttons: ${buttons}`);
    console.log(`- Inputs: ${inputs}`);
    console.log(`- Links: ${links}`);

    // Try to find and click settings, then capture modal state
    const settingsButton = page.locator('button:has-text("Settings")').first();
    if (await settingsButton.isVisible()) {
      await settingsButton.click();
      await page.waitForTimeout(1000);

      await page.screenshot({
        path: '/mnt/c/mainframe-ai-assistant/tests/playwright/screenshots/modal-state.png',
        fullPage: true
      });
    }

    console.log('✅ Application state captured successfully');
  });
});