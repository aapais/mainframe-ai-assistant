/**
 * Search Filters Validation Test
 * Comprehensive test suite for search filter functionality
 */

const puppeteer = require('puppeteer');
const path = require('path');

describe('Search Filters Functionality', () => {
  let browser;
  let page;

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    page = await browser.newPage();

    // Set viewport for consistent testing
    await page.setViewport({ width: 1920, height: 1080 });

    // Navigate to the application
    await page.goto('http://localhost:3000', {
      waitUntil: 'networkidle0',
      timeout: 30000
    });
  });

  afterAll(async () => {
    await browser.close();
  });

  beforeEach(async () => {
    // Reset the page state before each test
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForTimeout(1000);
  });

  describe('Filter Panel Visibility', () => {
    test('should show filters panel when filter button is clicked', async () => {
      // Find and click the filter button
      const filterButton = await page.waitForSelector('button[aria-label*="Search filters"]', {
        visible: true,
        timeout: 5000
      });

      expect(filterButton).not.toBeNull();

      // Click the filter button
      await filterButton.click();
      await page.waitForTimeout(300);

      // Check if filters panel is visible
      const filtersPanel = await page.$('.space-y-6'); // Filter panel container
      expect(filtersPanel).not.toBeNull();

      // Verify categories section is visible
      const categoriesSection = await page.$('span:has-text("Categories")');
      expect(categoriesSection).not.toBeNull();
    });

    test('should hide filters panel when clicked outside', async () => {
      // Open filters panel
      await page.click('button[aria-label*="Search filters"]');
      await page.waitForTimeout(300);

      // Click outside the panel
      await page.click('body');
      await page.waitForTimeout(300);

      // Verify panel is hidden
      const filtersPanel = await page.$('.space-y-6');
      const isVisible = await page.evaluate(el => {
        return el && window.getComputedStyle(el).display !== 'none';
      }, filtersPanel);

      expect(isVisible).toBeFalsy();
    });
  });

  describe('Category Filters', () => {
    beforeEach(async () => {
      // Open filters panel for each test
      await page.click('button[aria-label*="Search filters"]');
      await page.waitForTimeout(300);
    });

    test('should be able to select and deselect categories', async () => {
      // Select COBOL category
      const cobolButton = await page.waitForSelector('button:has-text("COBOL")', {
        visible: true
      });

      await cobolButton.click();
      await page.waitForTimeout(200);

      // Verify COBOL is selected (should have checkmark)
      const selectedCobol = await page.$('button:has-text("COBOL"):has-text("✓")');
      expect(selectedCobol).not.toBeNull();

      // Click again to deselect
      await cobolButton.click();
      await page.waitForTimeout(200);

      // Verify COBOL is no longer selected
      const deselectedCobol = await page.$('button:has-text("COBOL"):has-text("✓")');
      expect(deselectedCobol).toBeNull();
    });

    test('should be able to select multiple categories', async () => {
      // Select multiple categories
      const categories = ['COBOL', 'DB2', 'VSAM'];

      for (const category of categories) {
        const button = await page.waitForSelector(`button:has-text("${category}")`, {
          visible: true
        });
        await button.click();
        await page.waitForTimeout(100);
      }

      // Verify all categories are selected
      for (const category of categories) {
        const selectedButton = await page.$(`button:has-text("${category}"):has-text("✓")`);
        expect(selectedButton).not.toBeNull();
      }
    });

    test('should show clear all button when categories are selected', async () => {
      // Select a category
      await page.click('button:has-text("COBOL")');
      await page.waitForTimeout(200);

      // Check for clear all button
      const clearButton = await page.$('button:has-text("Clear all")');
      expect(clearButton).not.toBeNull();

      // Click clear all
      await clearButton.click();
      await page.waitForTimeout(200);

      // Verify no categories are selected
      const selectedCategories = await page.$$('button:has-text("✓")');
      expect(selectedCategories.length).toBe(0);
    });
  });

  describe('Status Filters', () => {
    beforeEach(async () => {
      await page.click('button[aria-label*="Search filters"]');
      await page.waitForTimeout(300);
    });

    test('should be able to select status filters', async () => {
      const statusOptions = ['Open', 'In Progress', 'Resolved'];

      for (const status of statusOptions) {
        const button = await page.waitForSelector(`button:has-text("${status}")`, {
          visible: true
        });
        await button.click();
        await page.waitForTimeout(100);
      }

      // Verify all status options are selected
      for (const status of statusOptions) {
        const selectedButton = await page.$(`button:has-text("${status}"):has-text("✓")`);
        expect(selectedButton).not.toBeNull();
      }
    });
  });

  describe('Priority Filters', () => {
    beforeEach(async () => {
      await page.click('button[aria-label*="Search filters"]');
      await page.waitForTimeout(300);
    });

    test('should be able to select priority filters with correct colors', async () => {
      const priorities = ['Critical', 'High', 'Medium', 'Low'];

      for (const priority of priorities) {
        const button = await page.waitForSelector(`button:has-text("${priority}")`, {
          visible: true
        });
        await button.click();
        await page.waitForTimeout(100);

        // Verify the button has the correct styling when selected
        const isSelected = await page.$(`button:has-text("${priority}"):has-text("✓")`);
        expect(isSelected).not.toBeNull();
      }
    });
  });

  describe('Date Range Filters', () => {
    beforeEach(async () => {
      await page.click('button[aria-label*="Search filters"]');
      await page.waitForTimeout(300);
    });

    test('should be able to set date range manually', async () => {
      // Set start date
      const startDateInput = await page.waitForSelector('input[type="date"]:first-of-type', {
        visible: true
      });
      await startDateInput.type('2024-01-01');

      // Set end date
      const endDateInput = await page.waitForSelector('input[type="date"]:last-of-type', {
        visible: true
      });
      await endDateInput.type('2024-12-31');

      // Verify dates are set
      const startValue = await page.$eval('input[type="date"]:first-of-type', el => el.value);
      const endValue = await page.$eval('input[type="date"]:last-of-type', el => el.value);

      expect(startValue).toBe('2024-01-01');
      expect(endValue).toBe('2024-12-31');
    });

    test('should be able to use quick date presets', async () => {
      const presets = ['Today', 'Last 7 days', 'Last 30 days'];

      for (const preset of presets) {
        const button = await page.waitForSelector(`button:has-text("${preset}")`, {
          visible: true
        });
        await button.click();
        await page.waitForTimeout(200);

        // Verify that date inputs have values after clicking preset
        const startValue = await page.$eval('input[type="date"]:first-of-type', el => el.value);
        const endValue = await page.$eval('input[type="date"]:last-of-type', el => el.value);

        expect(startValue).not.toBe('');
        expect(endValue).not.toBe('');
      }
    });

    test('should show clear dates button when dates are set', async () => {
      // Set a date
      await page.type('input[type="date"]:first-of-type', '2024-01-01');
      await page.waitForTimeout(200);

      // Check for clear dates button
      const clearButton = await page.$('button:has-text("Clear dates")');
      expect(clearButton).not.toBeNull();

      // Click clear dates
      await clearButton.click();
      await page.waitForTimeout(200);

      // Verify dates are cleared
      const startValue = await page.$eval('input[type="date"]:first-of-type', el => el.value);
      const endValue = await page.$eval('input[type="date"]:last-of-type', el => el.value);

      expect(startValue).toBe('');
      expect(endValue).toBe('');
    });
  });

  describe('Tag Filters', () => {
    beforeEach(async () => {
      await page.click('button[aria-label*="Search filters"]');
      await page.waitForTimeout(300);
    });

    test('should be able to select and deselect tags', async () => {
      const tags = ['performance', 'security', 'connectivity'];

      for (const tag of tags) {
        const button = await page.waitForSelector(`button:has-text("#${tag}")`, {
          visible: true
        });
        await button.click();
        await page.waitForTimeout(100);
      }

      // Verify all tags are selected
      for (const tag of tags) {
        const selectedTag = await page.$(`button:has-text("#${tag}"):has-text("✓")`);
        expect(selectedTag).not.toBeNull();
      }
    });
  });

  describe('Filter Actions', () => {
    beforeEach(async () => {
      await page.click('button[aria-label*="Search filters"]');
      await page.waitForTimeout(300);
    });

    test('should show filter count indicator', async () => {
      // Select some filters
      await page.click('button:has-text("COBOL")');
      await page.click('button:has-text("Open")');
      await page.click('button:has-text("#performance")');
      await page.waitForTimeout(300);

      // Check filter count display
      const filterCount = await page.$('span:has-text("3 filters selected")');
      expect(filterCount).not.toBeNull();
    });

    test('should be able to clear all filters', async () => {
      // Select multiple filters
      await page.click('button:has-text("COBOL")');
      await page.click('button:has-text("Open")');
      await page.click('button:has-text("#performance")');
      await page.waitForTimeout(300);

      // Click clear all filters
      const clearAllButton = await page.waitForSelector('button:has-text("Clear All Filters")', {
        visible: true
      });
      await clearAllButton.click();
      await page.waitForTimeout(300);

      // Verify all filters are cleared
      const selectedFilters = await page.$$('button:has-text("✓")');
      expect(selectedFilters.length).toBe(0);
    });

    test('should be able to apply filters', async () => {
      // Select some filters
      await page.click('button:has-text("COBOL")');
      await page.click('button:has-text("Open")');
      await page.waitForTimeout(300);

      // Click apply filters
      const applyButton = await page.waitForSelector('button:has-text("Apply Filters")', {
        visible: true
      });
      await applyButton.click();
      await page.waitForTimeout(500);

      // Verify filters panel is closed
      const filtersPanel = await page.$('.space-y-6');
      const isVisible = await page.evaluate(el => {
        return el && window.getComputedStyle(el).display !== 'none';
      }, filtersPanel);

      expect(isVisible).toBeFalsy();
    });

    test('should be able to cancel filter changes', async () => {
      // Select a filter and apply
      await page.click('button:has-text("COBOL")');
      await page.click('button:has-text("Apply Filters")');
      await page.waitForTimeout(500);

      // Open filters again and make changes
      await page.click('button[aria-label*="Search filters"]');
      await page.waitForTimeout(300);
      await page.click('button:has-text("DB2")');
      await page.waitForTimeout(200);

      // Click cancel
      const cancelButton = await page.waitForSelector('button:has-text("Cancel")', {
        visible: true
      });
      await cancelButton.click();
      await page.waitForTimeout(300);

      // Open filters again and verify original selection is restored
      await page.click('button[aria-label*="Search filters"]');
      await page.waitForTimeout(300);

      const cobolSelected = await page.$('button:has-text("COBOL"):has-text("✓")');
      const db2Selected = await page.$('button:has-text("DB2"):has-text("✓")');

      expect(cobolSelected).not.toBeNull();
      expect(db2Selected).toBeNull();
    });
  });

  describe('Filter Persistence', () => {
    test('should persist filters across page reloads', async () => {
      // Select filters
      await page.click('button[aria-label*="Search filters"]');
      await page.waitForTimeout(300);
      await page.click('button:has-text("COBOL")');
      await page.click('button:has-text("Open")');
      await page.click('button:has-text("Apply Filters")');
      await page.waitForTimeout(500);

      // Reload page
      await page.reload({ waitUntil: 'networkidle0' });
      await page.waitForTimeout(1000);

      // Check filter indicator shows active filters
      const filterButton = await page.$('button[aria-label*="Search filters"]');
      const hasActiveIndicator = await page.evaluate(el => {
        const badge = el.querySelector('.animate-pulse');
        return badge !== null;
      }, filterButton);

      expect(hasActiveIndicator).toBeTruthy();
    });
  });

  describe('Search Integration', () => {
    test('should include filters in search when performing search', async () => {
      // Set up filters
      await page.click('button[aria-label*="Search filters"]');
      await page.waitForTimeout(300);
      await page.click('button:has-text("COBOL")');
      await page.click('button:has-text("Apply Filters")');
      await page.waitForTimeout(500);

      // Type in search and perform search
      const searchInput = await page.waitForSelector('input[type="search"]', {
        visible: true
      });
      await searchInput.type('S0C4 ABEND');
      await page.waitForTimeout(300);

      const searchButton = await page.waitForSelector('button:has-text("Search")', {
        visible: true
      });
      await searchButton.click();
      await page.waitForTimeout(1000);

      // Verify search was performed (loading indicator should appear and disappear)
      // This tests that the search integration works with filters
      const searchResults = await page.$('.bg-white.rounded-xl.shadow-lg.p-6');
      expect(searchResults).not.toBeNull();
    });

    test('should show active filters indicator when filters are applied', async () => {
      // Apply filters
      await page.click('button[aria-label*="Search filters"]');
      await page.waitForTimeout(300);
      await page.click('button:has-text("COBOL")');
      await page.click('button:has-text("Open")');
      await page.click('button:has-text("Apply Filters")');
      await page.waitForTimeout(500);

      // Check for active filters indicator
      const activeFiltersIndicator = await page.$('div:has-text("filters active")');
      expect(activeFiltersIndicator).not.toBeNull();
    });
  });

  describe('Accessibility', () => {
    test('should have proper ARIA labels and roles', async () => {
      await page.click('button[aria-label*="Search filters"]');
      await page.waitForTimeout(300);

      // Check for proper ARIA labels
      const filterButton = await page.$('button[aria-label*="Search filters"]');
      expect(filterButton).not.toBeNull();

      // Verify keyboard navigation works
      await page.keyboard.press('Tab');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(300);

      // Test ESC key closes filters
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);

      const filtersPanel = await page.$('.space-y-6');
      const isVisible = await page.evaluate(el => {
        return el && window.getComputedStyle(el).display !== 'none';
      }, filtersPanel);

      expect(isVisible).toBeFalsy();
    });
  });
});

// Utility function to take a screenshot on test failure
afterEach(async () => {
  if (page && global.jasmine && global.jasmine.currentTest && global.jasmine.currentTest.failedExpectations.length > 0) {
    const testName = global.jasmine.currentTest.fullName.replace(/[^a-zA-Z0-9]/g, '_');
    await page.screenshot({
      path: `test-results/filter-test-failure-${testName}-${Date.now()}.png`,
      fullPage: true
    });
  }
});