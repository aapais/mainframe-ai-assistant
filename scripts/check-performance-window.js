const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  try {
    // Navigate to the application
    await page.goto('http://localhost:3002', { waitUntil: 'networkidle2' });

    // Wait for the page to load
    await page.waitForTimeout(3000);

    // Take a screenshot
    await page.screenshot({ path: '/mnt/c/mainframe-ai-assistant/dashboard-screenshot.png', fullPage: true });

    // Look for performance-related elements
    const performanceElements = await page.evaluate(() => {
      const elements = [];

      // Look for performance testing windows, modals, or widgets
      const selectors = [
        '[data-testid*="performance"]',
        '[class*="performance"]',
        '[id*="performance"]',
        '[data-test*="performance"]',
        'div[style*="position: fixed"]',
        'div[style*="z-index"]',
        '.modal',
        '[role="dialog"]',
        '.widget',
        '.dashboard-widget',
        '.performance-monitor',
        '.test-window',
        '.floating-widget'
      ];

      selectors.forEach(selector => {
        try {
          const found = document.querySelectorAll(selector);
          found.forEach(el => {
            if (el.textContent.toLowerCase().includes('performance') ||
                el.textContent.toLowerCase().includes('test') ||
                el.className.toLowerCase().includes('performance') ||
                el.id.toLowerCase().includes('performance')) {
              elements.push({
                selector,
                tagName: el.tagName,
                className: el.className,
                id: el.id,
                textContent: el.textContent.substring(0, 100),
                style: el.getAttribute('style'),
                position: {
                  x: el.offsetLeft,
                  y: el.offsetTop,
                  width: el.offsetWidth,
                  height: el.offsetHeight
                }
              });
            }
          });
        } catch (e) {
          console.log('Error with selector:', selector);
        }
      });

      return elements;
    });

    console.log('🔍 Performance-related elements found:');
    console.log('=====================================');

    if (performanceElements.length === 0) {
      console.log('❌ No performance testing elements found on the page');
    } else {
      performanceElements.forEach((element, index) => {
        console.log(`\n📊 Element ${index + 1}:`);
        console.log(`  Tag: ${element.tagName}`);
        console.log(`  Class: ${element.className || 'none'}`);
        console.log(`  ID: ${element.id || 'none'}`);
        console.log(`  Text: ${element.textContent || 'no text'}`);
        console.log(`  Style: ${element.style || 'none'}`);
        console.log(`  Position: ${element.position.x}x${element.position.y} (${element.position.width}x${element.position.height})`);
      });
    }

    // Get console errors
    const logs = await page.evaluate(() => {
      return window.console.logs || [];
    });

    console.log('\n🚨 Console errors/warnings:');
    console.log('=============================');

    // Listen for console events
    page.on('console', msg => {
      if (msg.type() === 'error' || msg.type() === 'warning') {
        console.log(`${msg.type().toUpperCase()}: ${msg.text()}`);
      }
    });

    // Check for floating widgets or overlays
    const overlays = await page.evaluate(() => {
      const overlayElements = [];
      const elements = document.querySelectorAll('*');

      elements.forEach(el => {
        const style = window.getComputedStyle(el);
        if (style.position === 'fixed' || style.position === 'absolute') {
          if (parseInt(style.zIndex) > 1000) {
            overlayElements.push({
              tagName: el.tagName,
              className: el.className,
              id: el.id,
              zIndex: style.zIndex,
              position: style.position,
              display: style.display,
              visibility: style.visibility,
              textContent: el.textContent.substring(0, 50)
            });
          }
        }
      });

      return overlayElements;
    });

    console.log('\n🔲 High z-index overlays found:');
    console.log('===============================');

    if (overlays.length === 0) {
      console.log('❌ No high z-index overlays found');
    } else {
      overlays.forEach((overlay, index) => {
        console.log(`\nOverlay ${index + 1}:`);
        console.log(`  Tag: ${overlay.tagName}`);
        console.log(`  Class: ${overlay.className || 'none'}`);
        console.log(`  ID: ${overlay.id || 'none'}`);
        console.log(`  Z-Index: ${overlay.zIndex}`);
        console.log(`  Position: ${overlay.position}`);
        console.log(`  Display: ${overlay.display}`);
        console.log(`  Visibility: ${overlay.visibility}`);
        console.log(`  Text: ${overlay.textContent || 'no text'}`);
      });
    }

    console.log('\n📸 Screenshot saved to: dashboard-screenshot.png');
    console.log('\n✅ Analysis complete. Please check the screenshot and console output above.');

  } catch (error) {
    console.error('❌ Error during analysis:', error);
  } finally {
    await browser.close();
  }
})();