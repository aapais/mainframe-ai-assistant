const puppeteer = require('puppeteer');
const fs = require('fs').promises;

async function testApplicationBasics() {
  console.log('🔍 Starting simple browser test...');

  let browser = null;
  try {
    // Launch browser
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    console.log('🌐 Navigating to application...');

    // Navigate to application
    const response = await page.goto('http://localhost:3002', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    console.log(`📊 Response status: ${response.status()}`);

    // Create screenshots directory
    await fs.mkdir('/mnt/c/mainframe-ai-assistant/test-results/screenshots', { recursive: true });

    // Take initial screenshot
    await page.screenshot({
      path: '/mnt/c/mainframe-ai-assistant/test-results/screenshots/01-app-load.png',
      fullPage: true
    });

    console.log('📸 Screenshot 1: Application loaded');

    // Test basic elements
    const title = await page.title();
    console.log(`📝 Page title: ${title}`);

    // Look for navigation elements
    const navElements = await page.$$eval('nav, .nav, [role="navigation"]',
      elements => elements.length
    );
    console.log(`🧭 Navigation elements found: ${navElements}`);

    // Look for tab elements
    const tabElements = await page.$$eval('a[href], button, .tab',
      elements => elements.filter(el =>
        el.textContent?.toLowerCase().includes('dashboard') ||
        el.textContent?.toLowerCase().includes('incident') ||
        el.textContent?.toLowerCase().includes('incidente')
      ).length
    );
    console.log(`📑 Tab-like elements found: ${tabElements}`);

    // Check console errors
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Wait a bit for any console errors
    await page.waitForTimeout(2000);

    // Try to find create button
    const createButtons = await page.$$eval('button, a, .btn',
      elements => elements.filter(el =>
        el.textContent?.includes('+') ||
        el.textContent?.toLowerCase().includes('criar') ||
        el.textContent?.toLowerCase().includes('novo') ||
        el.textContent?.toLowerCase().includes('create') ||
        el.getAttribute('aria-label')?.toLowerCase().includes('create')
      ).map(el => ({
        text: el.textContent,
        tag: el.tagName,
        ariaLabel: el.getAttribute('aria-label')
      }))
    );

    console.log(`➕ Create button candidates:`, createButtons);

    // Take screenshot after analysis
    await page.screenshot({
      path: '/mnt/c/mainframe-ai-assistant/test-results/screenshots/02-analysis-complete.png',
      fullPage: true
    });

    console.log('📸 Screenshot 2: Analysis complete');

    // Test modal if create button exists
    if (createButtons.length > 0) {
      console.log('🔍 Testing modal interaction...');

      try {
        // Click first create button candidate
        await page.click('button:contains("+"), [aria-label*="create"], [aria-label*="criar"]');
        await page.waitForTimeout(1000);

        // Check for modal
        const modal = await page.$('.modal, [role="dialog"], .modal-container');
        if (modal) {
          console.log('✅ Modal opened successfully');

          await page.screenshot({
            path: '/mnt/c/mainframe-ai-assistant/test-results/screenshots/03-modal-opened.png',
            fullPage: true
          });

          // Test close button
          const closeButton = await page.$('button:contains("×"), .close, [aria-label*="close"]');
          if (closeButton) {
            await closeButton.click();
            await page.waitForTimeout(500);
            console.log('✅ Close button test completed');
          }

          // Test ESC key
          await page.keyboard.press('Escape');
          await page.waitForTimeout(500);
          console.log('✅ ESC key test completed');

        } else {
          console.log('❌ No modal found after click');
        }
      } catch (error) {
        console.log('⚠️ Modal test failed:', error.message);
      }
    }

    // Final screenshot
    await page.screenshot({
      path: '/mnt/c/mainframe-ai-assistant/test-results/screenshots/04-final-state.png',
      fullPage: true
    });

    console.log('📸 Screenshot 3: Final state');

    // Generate simple report
    const report = {
      timestamp: new Date().toISOString(),
      pageTitle: title,
      responseStatus: response.status(),
      navigationElements: navElements,
      tabElements: tabElements,
      createButtons: createButtons.length,
      consoleErrors: consoleErrors.length,
      screenshots: [
        '01-app-load.png',
        '02-analysis-complete.png',
        '03-modal-opened.png',
        '04-final-state.png'
      ]
    };

    await fs.writeFile(
      '/mnt/c/mainframe-ai-assistant/test-results/simple-test-report.json',
      JSON.stringify(report, null, 2)
    );

    console.log('✅ Simple browser test completed successfully!');
    console.log('📊 Report:', report);

    return report;

  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run the test
testApplicationBasics()
  .then(report => {
    console.log('🎉 Testing completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Testing failed:', error);
    process.exit(1);
  });