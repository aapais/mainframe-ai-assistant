/**
 * SPARC SPECIFICATION ANALYSIS - Dashboard Search Filter Bug Test
 * Tests the current behavior to identify why items don't reappear when search is cleared
 */

const puppeteer = require('puppeteer');

async function testSearchFilterBug() {
  const browser = await puppeteer.launch({
    headless: false,
    devtools: true,
    args: ['--disable-web-security', '--disable-features=VizDisplayCompositor']
  });

  const page = await browser.newPage();

  try {
    console.log('🔍 SPARC SPECIFICATION: Testing Dashboard Search Filter Bug');

    // Navigate to the application
    console.log('1. Navigating to application...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });

    // Wait for page to load
    await page.waitForTimeout(2000);

    // Navigate to Incidents page (list view)
    console.log('2. Navigating to Incidents page...');

    // Look for incidents link or button
    try {
      // Try multiple possible selectors for incidents navigation
      const incidentsSelectors = [
        'a[href*="incident"]',
        'button:contains("Incident")',
        '[data-testid="incidents-nav"]',
        'nav a:contains("Incident")',
        '.nav-link:contains("Incident")'
      ];

      let incidentsElement = null;
      for (const selector of incidentsSelectors) {
        try {
          incidentsElement = await page.$(selector);
          if (incidentsElement) break;
        } catch (e) {
          // Continue to next selector
        }
      }

      if (incidentsElement) {
        await incidentsElement.click();
        await page.waitForTimeout(1000);
      } else {
        // Try direct URL navigation
        await page.goto('http://localhost:3000/incidents', { waitUntil: 'networkidle0' });
      }
    } catch (e) {
      console.log('Direct navigation to incidents page...');
      await page.goto('http://localhost:3000/incidents', { waitUntil: 'networkidle0' });
    }

    // Switch to List view if not already there
    console.log('3. Switching to List view...');
    try {
      const listTabButton = await page.$('button:contains("Lista de Incidentes")');
      if (listTabButton) {
        await listTabButton.click();
        await page.waitForTimeout(1000);
      }
    } catch (e) {
      console.log('List view already active or not found');
    }

    // Wait for incident queue to load
    await page.waitForTimeout(2000);

    // Find the search input
    console.log('4. Locating search input...');
    const searchInput = await page.$('input[placeholder*="Search"]');
    if (!searchInput) {
      throw new Error('Search input not found!');
    }

    // Count initial items
    console.log('5. Counting initial items...');
    const initialRows = await page.$$('table tbody tr');
    const initialCount = initialRows.length;
    console.log(`Initial incident count: ${initialCount}`);

    if (initialCount === 0) {
      console.log('⚠️ No incidents found - may need to wait for data loading');
      await page.waitForTimeout(3000);
      const retryRows = await page.$$('table tbody tr');
      console.log(`Retry incident count: ${retryRows.length}`);
    }

    // Test search functionality
    console.log('6. Testing search functionality...');

    // Type search term
    const searchTerm = 'JCL';
    console.log(`Typing search term: "${searchTerm}"`);
    await searchInput.type(searchTerm);

    // Wait for filtering
    await page.waitForTimeout(1000);

    // Count filtered items
    const filteredRows = await page.$$('table tbody tr');
    const filteredCount = filteredRows.length;
    console.log(`Filtered incident count: ${filteredCount}`);

    // Clear search
    console.log('7. Clearing search...');
    await searchInput.click({ clickCount: 3 }); // Select all text
    await searchInput.press('Backspace'); // Delete text

    // Wait for filter to update
    await page.waitForTimeout(1000);

    // Count items after clearing search
    const clearedRows = await page.$$('table tbody tr');
    const clearedCount = clearedRows.length;
    console.log(`Items after clearing search: ${clearedCount}`);

    // Analyze the bug
    console.log('\n📊 ANALYSIS RESULTS:');
    console.log(`Initial count: ${initialCount}`);
    console.log(`Filtered count: ${filteredCount}`);
    console.log(`Cleared count: ${clearedCount}`);

    if (clearedCount !== initialCount) {
      console.log('🐛 BUG CONFIRMED: Items do not reappear when search is cleared!');
      console.log('Expected:', initialCount, 'Actual:', clearedCount);

      // Check search input value
      const searchValue = await searchInput.evaluate(el => el.value);
      console.log('Search input value after clearing:', `"${searchValue}"`);

      // Additional debugging
      console.log('\n🔧 DEBUGGING INFORMATION:');

      // Check if there are any console errors
      const logs = await page.evaluate(() => {
        return window.console._logs || [];
      });

      // Try typing space and backspace to trigger onChange
      console.log('Trying space + backspace to trigger onChange...');
      await searchInput.type(' ');
      await searchInput.press('Backspace');
      await page.waitForTimeout(1000);

      const spaceTestRows = await page.$$('table tbody tr');
      console.log(`Items after space test: ${spaceTestRows.length}`);

    } else {
      console.log('✅ Search filter working correctly');
    }

    // Take screenshot for analysis
    await page.screenshot({
      path: '/mnt/c/mainframe-ai-assistant/tests/search-filter-bug-analysis.png',
      fullPage: true
    });

    console.log('📷 Screenshot saved: tests/search-filter-bug-analysis.png');

  } catch (error) {
    console.error('❌ Test failed:', error.message);

    // Take error screenshot
    await page.screenshot({
      path: '/mnt/c/mainframe-ai-assistant/tests/search-filter-error.png',
      fullPage: true
    });
  } finally {
    console.log('\n🏁 Test completed');
    await browser.close();
  }
}

// Run the test
testSearchFilterBug().catch(console.error);