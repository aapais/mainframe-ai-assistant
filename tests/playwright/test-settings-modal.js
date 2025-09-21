const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function testApplication() {
  console.log('🚀 Starting Playwright test for Settings Modal...\n');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 1000 // Slow down for better visibility
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });

  const page = await context.newPage();

  // Capture console errors
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
      console.log('❌ Console Error:', msg.text());
    }
  });

  // Capture network failures
  const networkErrors = [];
  page.on('response', response => {
    if (response.status() >= 400) {
      networkErrors.push(`${response.status()} - ${response.url()}`);
    }
  });

  try {
    console.log('📍 Step 1: Navigating to http://localhost:5173');

    // Navigate to the application
    const response = await page.goto('http://localhost:5173', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    if (!response) {
      throw new Error('Failed to get response from the application');
    }

    console.log(`✅ Page loaded with status: ${response.status()}`);

    // Take screenshot of the main page
    await page.screenshot({
      path: '/mnt/c/mainframe-ai-assistant/tests/playwright/screenshots/homepage.png',
      fullPage: true
    });
    console.log('📸 Homepage screenshot saved');

    console.log('\n📍 Step 2: Analyzing page structure');

    // Get page title and basic info
    const title = await page.title();
    const url = page.url();
    console.log(`📄 Page Title: "${title}"`);
    console.log(`🔗 Current URL: ${url}`);

    // Count interactive elements
    const buttonCount = await page.locator('button').count();
    const inputCount = await page.locator('input').count();
    const linkCount = await page.locator('a').count();

    console.log(`\n🎯 Interactive Elements Found:`);
    console.log(`- Buttons: ${buttonCount}`);
    console.log(`- Input fields: ${inputCount}`);
    console.log(`- Links: ${linkCount}`);

    console.log('\n📍 Step 3: Searching for Settings button');

    // List all buttons with their text for debugging
    const allButtons = await page.locator('button').all();
    console.log(`\n🔍 Found ${allButtons.length} buttons:`);

    for (let i = 0; i < allButtons.length; i++) {
      const button = allButtons[i];
      const text = await button.textContent() || '';
      const ariaLabel = await button.getAttribute('aria-label') || '';
      const className = await button.getAttribute('class') || '';
      const isVisible = await button.isVisible();

      console.log(`  ${i + 1}. "${text.trim()}" (aria-label: "${ariaLabel}", visible: ${isVisible})`);

      if (className) {
        console.log(`     classes: ${className}`);
      }
    }

    // Try multiple strategies to find Settings button
    const settingsSelectors = [
      'button:has-text("Settings")',
      'button:has-text("settings")', // case insensitive
      '[data-testid="settings-button"]',
      '.settings-button',
      'button[aria-label*="Settings"]',
      'button[aria-label*="settings"]',
      'button[title*="Settings"]',
      'button[title*="settings"]',
      '[role="button"]:has-text("Settings")',
      'button:has([data-icon="settings"])',
      'button:has(.settings-icon)',
      '[data-cy="settings"]',
      'button:has(svg)', // In case it's an icon button
    ];

    let settingsButton = null;
    let usedSelector = '';

    for (const selector of settingsSelectors) {
      try {
        const button = page.locator(selector).first();
        if (await button.isVisible({ timeout: 1000 })) {
          settingsButton = button;
          usedSelector = selector;
          console.log(`✅ Found Settings button with selector: "${selector}"`);
          break;
        }
      } catch (error) {
        // Continue to next selector
      }
    }

    if (!settingsButton) {
      console.log('❌ Settings button not found with standard selectors');
      console.log('🔍 Trying to find buttons with gear/cog icons or similar...');

      // Look for common icon patterns
      const iconSelectors = [
        'button:has([class*="gear"])',
        'button:has([class*="cog"])',
        'button:has([class*="setting"])',
        'button:has(svg[class*="gear"])',
        'button:has(svg[class*="cog"])',
        'button:has(svg[class*="setting"])'
      ];

      for (const selector of iconSelectors) {
        try {
          const button = page.locator(selector).first();
          if (await button.isVisible({ timeout: 1000 })) {
            settingsButton = button;
            usedSelector = selector;
            console.log(`✅ Found potential Settings button (icon) with selector: "${selector}"`);
            break;
          }
        } catch (error) {
          // Continue
        }
      }
    }

    if (settingsButton && await settingsButton.isVisible()) {
      console.log('\n📍 Step 4: Clicking Settings button');

      // Highlight the button before clicking (for visibility in headed mode)
      await settingsButton.highlight();
      await page.waitForTimeout(1000);

      await settingsButton.click();
      console.log('✅ Settings button clicked successfully');

      // Wait for potential modal to appear
      await page.waitForTimeout(2000);

      console.log('\n📍 Step 5: Checking for Settings Modal');

      // Look for modal with various selectors
      const modalSelectors = [
        '[role="dialog"]',
        '.modal',
        '.settings-modal',
        '[data-testid="settings-modal"]',
        '.modal-content',
        '[aria-modal="true"]',
        '.overlay',
        '.popup',
        '.dialog'
      ];

      let modal = null;
      let modalSelector = '';

      for (const selector of modalSelectors) {
        try {
          const modalElement = page.locator(selector).first();
          if (await modalElement.isVisible({ timeout: 2000 })) {
            modal = modalElement;
            modalSelector = selector;
            console.log(`✅ Found Settings modal with selector: "${selector}"`);
            break;
          }
        } catch (error) {
          // Continue
        }
      }

      if (modal && await modal.isVisible()) {
        // Take screenshot of the Settings Modal
        await page.screenshot({
          path: '/mnt/c/mainframe-ai-assistant/tests/playwright/screenshots/settings-modal.png',
          fullPage: true
        });
        console.log('📸 Settings Modal screenshot saved');

        console.log('\n📍 Step 6: Analyzing Modal Features');

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
          '.settings-sidebar',
          '.nav-menu',
          '.side-nav'
        ];

        for (const selector of sidebarSelectors) {
          if (await page.locator(selector).isVisible()) {
            features.sidebar = true;
            console.log(`✅ Found sidebar with selector: "${selector}"`);
            break;
          }
        }

        // Check for breadcrumb navigation
        const breadcrumbSelectors = [
          '.breadcrumb',
          '[aria-label*="breadcrumb"]',
          '.breadcrumb-nav',
          '[data-testid="breadcrumb"]',
          '.breadcrumbs'
        ];

        for (const selector of breadcrumbSelectors) {
          if (await page.locator(selector).isVisible()) {
            features.breadcrumb = true;
            console.log(`✅ Found breadcrumb with selector: "${selector}"`);
            break;
          }
        }

        // Check for search bar
        const searchSelectors = [
          'input[type="search"]',
          'input[placeholder*="Search"]',
          'input[placeholder*="search"]',
          '.search-input',
          '[data-testid="search"]',
          '.search-bar'
        ];

        for (const selector of searchSelectors) {
          if (await page.locator(selector).isVisible()) {
            features.searchBar = true;
            console.log(`✅ Found search bar with selector: "${selector}"`);
            break;
          }
        }

        // Check for footer
        const footerSelectors = [
          '.modal-footer',
          '.footer',
          '.settings-footer',
          '[data-testid="modal-footer"]',
          '.dialog-footer'
        ];

        for (const selector of footerSelectors) {
          if (await page.locator(selector).isVisible()) {
            features.footer = true;
            console.log(`✅ Found footer with selector: "${selector}"`);
            break;
          }
        }

        // Check for Save and Cancel buttons
        const saveSelectors = [
          'button:has-text("Save")',
          'button:has-text("save")',
          '[data-testid="save-button"]',
          '.save-button'
        ];

        const cancelSelectors = [
          'button:has-text("Cancel")',
          'button:has-text("cancel")',
          'button:has-text("Close")',
          'button:has-text("close")',
          '[data-testid="cancel-button"]',
          '.cancel-button'
        ];

        for (const selector of saveSelectors) {
          if (await page.locator(selector).isVisible()) {
            features.saveButton = true;
            console.log(`✅ Found Save button with selector: "${selector}"`);
            break;
          }
        }

        for (const selector of cancelSelectors) {
          if (await page.locator(selector).isVisible()) {
            features.cancelButton = true;
            console.log(`✅ Found Cancel button with selector: "${selector}"`);
            break;
          }
        }

        // Generate detailed report
        console.log('\n🔍 SETTINGS MODAL FEATURE ANALYSIS:');
        console.log('=' .repeat(50));
        console.log(`✅ Modal Found: YES (selector: ${modalSelector})`);
        console.log(`📊 Sidebar Navigation: ${features.sidebar ? '✅ FOUND' : '❌ NOT FOUND'}`);
        console.log(`📊 Breadcrumb Navigation: ${features.breadcrumb ? '✅ FOUND' : '❌ NOT FOUND'}`);
        console.log(`📊 Search Bar: ${features.searchBar ? '✅ FOUND' : '❌ NOT FOUND'}`);
        console.log(`📊 Footer: ${features.footer ? '✅ FOUND' : '❌ NOT FOUND'}`);
        console.log(`📊 Save Button: ${features.saveButton ? '✅ FOUND' : '❌ NOT FOUND'}`);
        console.log(`📊 Cancel Button: ${features.cancelButton ? '✅ FOUND' : '❌ NOT FOUND'}`);

        const foundFeatures = Object.values(features).filter(Boolean).length;
        const totalFeatures = Object.keys(features).length;
        const featurePercentage = Math.round((foundFeatures / totalFeatures) * 100);

        console.log('\n📈 FEATURE COVERAGE SUMMARY:');
        console.log(`🎯 Features Found: ${foundFeatures}/${totalFeatures}`);
        console.log(`📊 Coverage Percentage: ${featurePercentage}%`);

        if (featurePercentage >= 80) {
          console.log('🎉 EXCELLENT: Settings Modal has comprehensive enhanced features!');
        } else if (featurePercentage >= 60) {
          console.log('👍 GOOD: Settings Modal has most enhanced features.');
        } else if (featurePercentage >= 40) {
          console.log('⚠️  PARTIAL: Settings Modal has some enhanced features.');
        } else {
          console.log('❌ LIMITED: Settings Modal has few enhanced features.');
        }

      } else {
        console.log('❌ Settings modal did not appear after clicking button');

        // Take screenshot for debugging
        await page.screenshot({
          path: '/mnt/c/mainframe-ai-assistant/tests/playwright/screenshots/no-modal-debug.png',
          fullPage: true
        });
        console.log('📸 Debug screenshot saved (no modal found)');
      }

    } else {
      console.log('❌ Settings button not found on the page');

      // Take screenshot for debugging
      await page.screenshot({
        path: '/mnt/c/mainframe-ai-assistant/tests/playwright/screenshots/no-settings-button-debug.png',
        fullPage: true
      });
      console.log('📸 Debug screenshot saved (no Settings button found)');
    }

    // Final summary
    console.log('\n' + '=' .repeat(60));
    console.log('📋 TEST EXECUTION SUMMARY');
    console.log('=' .repeat(60));
    console.log(`✅ Page Load: SUCCESS (Status: ${response.status()})`);
    console.log(`📊 Console Errors: ${consoleErrors.length}`);
    console.log(`📊 Network Errors: ${networkErrors.length}`);
    console.log(`🔍 Settings Button: ${settingsButton ? 'FOUND' : 'NOT FOUND'}`);

    if (consoleErrors.length > 0) {
      console.log('\n⚠️  Console Errors Found:');
      consoleErrors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    }

    if (networkErrors.length > 0) {
      console.log('\n⚠️  Network Errors Found:');
      networkErrors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    }

  } catch (error) {
    console.error('\n❌ Test execution failed:', error.message);

    // Take error screenshot
    await page.screenshot({
      path: '/mnt/c/mainframe-ai-assistant/tests/playwright/screenshots/error-state.png',
      fullPage: true
    });
    console.log('📸 Error state screenshot saved');
  } finally {
    await browser.close();
    console.log('\n🏁 Test execution completed');
  }
}

// Run the test
testApplication().catch(console.error);