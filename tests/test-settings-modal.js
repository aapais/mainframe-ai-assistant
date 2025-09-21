const { chromium } = require('playwright');

(async () => {
  console.log('Starting Playwright browser test...');

  // Launch browser in non-headless mode (visible)
  const browser = await chromium.launch({
    headless: false,  // Show the browser
    slowMo: 500,      // Slow down actions by 500ms
  });

  const page = await browser.newPage();

  try {
    console.log('Navigating to http://localhost:5173...');
    await page.goto('http://localhost:5173', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    console.log('Page loaded. Taking initial screenshot...');
    await page.screenshot({ path: 'tests/screenshot-initial.png' });

    // Try to find and click Settings button
    console.log('Looking for Settings button...');
    const settingsButton = await page.locator('button:has-text("Settings")').first();
    if (await settingsButton.isVisible()) {
      console.log('Settings button found. Clicking...');
      await settingsButton.click();

      // Wait for modal to appear
      await page.waitForTimeout(1000);

      console.log('Taking Settings Modal screenshot...');
      await page.screenshot({ path: 'tests/screenshot-settings-modal.png', fullPage: true });

      // Check for new UI elements
      console.log('Checking for UI improvements...');

      const checks = [
        { selector: '[class*="sidebar"]', name: 'Sidebar' },
        { selector: '[class*="breadcrumb"]', name: 'Breadcrumbs' },
        { selector: 'input[type="search"]', name: 'Search input' },
        { selector: '[class*="footer"]', name: 'Footer' },
      ];

      for (const check of checks) {
        const element = page.locator(check.selector).first();
        const isVisible = await element.isVisible().catch(() => false);
        console.log(`  ${check.name}: ${isVisible ? '✓ Found' : '✗ Not found'}`);
      }

      // Try to navigate through sections
      const sections = ['General', 'API', 'Security', 'Advanced'];
      for (const section of sections) {
        const sectionButton = page.locator(`button:has-text("${section}")`).first();
        if (await sectionButton.isVisible()) {
          console.log(`Clicking ${section} section...`);
          await sectionButton.click();
          await page.waitForTimeout(500);
        }
      }

    } else {
      console.log('Settings button not found. The page might have errors.');
    }

    console.log('Test completed. Check the screenshots in the tests folder.');

  } catch (error) {
    console.error('Error during test:', error.message);
    await page.screenshot({ path: 'tests/screenshot-error.png' });
  }

  // Keep browser open for 10 seconds to see the result
  console.log('Keeping browser open for 10 seconds...');
  await page.waitForTimeout(10000);

  await browser.close();
  console.log('Browser closed.');
})();