/**
 * Visual Regression Tests - SearchBar Components
 * Comprehensive visual testing for all SearchBar variants
 */

import { test, expect } from '@playwright/test';
import { VisualTestHelpers, ComponentTestFactory, VisualTestMatchers } from '../utils/visual-test-helpers';
import { testViewports } from '../config/visual-test.config';
import mockKBData from '../fixtures/mock-kb-data.json';

test.describe('SearchBar Visual Regression', () => {
  let helpers: VisualTestHelpers;
  let factory: ComponentTestFactory;

  test.beforeEach(async ({ page }) => {
    helpers = new VisualTestHelpers(page);
    factory = new ComponentTestFactory(page);

    // Set up test page with SearchBar components
    await page.setContent(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>SearchBar Visual Tests</title>
        <style>
          body {
            margin: 0;
            padding: 20px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background-color: #f5f5f5;
          }

          .test-container {
            background: white;
            padding: 2rem;
            border-radius: 8px;
            margin-bottom: 2rem;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }

          .search-input {
            width: 100%;
            padding: 0.75rem;
            border: 2px solid #d1d5db;
            border-radius: 8px;
            font-size: 1rem;
            outline: none;
            transition: border-color 0.15s ease-in-out;
          }

          .search-input:focus {
            border-color: #3b82f6;
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
          }

          .search-input:hover {
            border-color: #9ca3af;
          }

          .search-input:disabled {
            background-color: #f3f4f6;
            color: #6b7280;
            cursor: not-allowed;
          }

          .search-input.error {
            border-color: #ef4444;
            background-color: #fef2f2;
          }

          .search-container {
            position: relative;
            width: 100%;
          }

          .search-suggestions {
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background: white;
            border: 1px solid #d1d5db;
            border-radius: 0 0 8px 8px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            max-height: 300px;
            overflow-y: auto;
            z-index: 1000;
          }

          .suggestion-item {
            display: block;
            width: 100%;
            padding: 0.75rem;
            border: none;
            background: transparent;
            text-align: left;
            cursor: pointer;
            font-size: 0.875rem;
          }

          .suggestion-item:hover,
          .suggestion-item.selected {
            background-color: #f3f4f6;
          }

          .search-filters {
            display: flex;
            flex-wrap: wrap;
            gap: 0.5rem;
            margin-top: 0.5rem;
            padding: 0.75rem;
            background-color: #f9fafb;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
          }

          .filter-chip {
            padding: 0.25rem 0.75rem;
            border: 1px solid #d1d5db;
            background: white;
            border-radius: 6px;
            cursor: pointer;
            font-size: 0.875rem;
          }

          .filter-chip.active {
            background: #dbeafe;
            border-color: #3b82f6;
            color: #1d4ed8;
          }

          .loading-spinner {
            display: inline-block;
            width: 1rem;
            height: 1rem;
            border: 2px solid #e5e7eb;
            border-radius: 50%;
            border-top-color: #3b82f6;
            animation: spin 1s ease-in-out infinite;
          }

          @keyframes spin {
            to { transform: rotate(360deg); }
          }

          .error-message {
            color: #dc2626;
            font-size: 0.875rem;
            margin-top: 0.5rem;
            padding: 0.5rem;
            background: #fef2f2;
            border: 1px solid #fecaca;
            border-radius: 4px;
          }

          /* Theme variations */
          .theme-dark {
            background-color: #1f2937;
            color: #f9fafb;
          }

          .theme-dark .test-container {
            background: #374151;
          }

          .theme-dark .search-input {
            background: #4b5563;
            border-color: #6b7280;
            color: #f9fafb;
          }

          .theme-dark .search-input:focus {
            border-color: #60a5fa;
          }

          .theme-dark .search-suggestions {
            background: #374151;
            border-color: #6b7280;
          }

          .theme-dark .suggestion-item:hover {
            background: #4b5563;
          }

          .theme-high-contrast {
            --bg-color: #ffffff;
            --text-color: #000000;
            --border-color: #000000;
            --focus-color: #0000ff;
          }

          .theme-high-contrast * {
            background-color: var(--bg-color) !important;
            color: var(--text-color) !important;
            border-color: var(--border-color) !important;
          }
        </style>
      </head>
      <body>
        <!-- Basic SearchBar -->
        <div class="test-container">
          <h2>Basic SearchBar</h2>
          <div class="search-container">
            <input
              type="text"
              class="search-input"
              id="basic-search"
              placeholder="Search problems, solutions, error codes..."
              value=""
            />
          </div>
        </div>

        <!-- SearchBar with Value -->
        <div class="test-container">
          <h2>SearchBar with Value</h2>
          <div class="search-container">
            <input
              type="text"
              class="search-input"
              id="search-with-value"
              placeholder="Search problems, solutions, error codes..."
              value="VSAM Status 35"
            />
          </div>
        </div>

        <!-- SearchBar with Suggestions -->
        <div class="test-container">
          <h2>SearchBar with Suggestions</h2>
          <div class="search-container">
            <input
              type="text"
              class="search-input"
              id="search-with-suggestions"
              placeholder="Search problems, solutions, error codes..."
              value="VSAM"
            />
            <div class="search-suggestions">
              <button class="suggestion-item selected">VSAM Status 35 - File Not Found</button>
              <button class="suggestion-item">VSAM Status 37 - Space Issues</button>
              <button class="suggestion-item">VSAM Recovery Procedures</button>
              <button class="suggestion-item">VSAM VERIFY Command</button>
            </div>
          </div>
        </div>

        <!-- SearchBar with Filters -->
        <div class="test-container">
          <h2>SearchBar with Filters</h2>
          <div class="search-container">
            <input
              type="text"
              class="search-input"
              id="search-with-filters"
              placeholder="Search problems, solutions, error codes..."
              value="database error"
            />
            <div class="search-filters">
              <label class="filter-chip">
                <input type="checkbox" checked style="margin-right: 0.5rem;">
                🤖 AI Search
              </label>
              <button class="filter-chip">All Categories</button>
              <button class="filter-chip active">DB2</button>
              <button class="filter-chip">VSAM</button>
              <button class="filter-chip">JCL</button>
              <button class="filter-chip">Batch</button>
            </div>
          </div>
        </div>

        <!-- Loading State -->
        <div class="test-container">
          <h2>Loading State</h2>
          <div class="search-container">
            <input
              type="text"
              class="search-input"
              id="search-loading"
              placeholder="Search problems, solutions, error codes..."
              value="searching..."
              readonly
            />
            <div style="position: absolute; right: 0.75rem; top: 50%; transform: translateY(-50%);">
              <span class="loading-spinner"></span>
            </div>
          </div>
        </div>

        <!-- Error State -->
        <div class="test-container">
          <h2>Error State</h2>
          <div class="search-container">
            <input
              type="text"
              class="search-input error"
              id="search-error"
              placeholder="Search problems, solutions, error codes..."
              value="failed search"
            />
            <div class="error-message">
              ⚠️ Search failed. Please check your connection and try again.
            </div>
          </div>
        </div>

        <!-- Disabled State -->
        <div class="test-container">
          <h2>Disabled State</h2>
          <div class="search-container">
            <input
              type="text"
              class="search-input"
              id="search-disabled"
              placeholder="Search problems, solutions, error codes..."
              value="disabled search"
              disabled
            />
          </div>
        </div>
      </body>
      </html>
    `);

    await helpers.preparePage();
  });

  test('Basic SearchBar - Default State', async ({ page }) => {
    const searchBar = page.locator('#basic-search');
    await VisualTestMatchers.compareWithTolerance(searchBar, 'searchbar-basic-default');
  });

  test('SearchBar - Focus State', async ({ page }) => {
    const searchBar = page.locator('#basic-search');
    await searchBar.focus();
    await page.waitForTimeout(100);
    await VisualTestMatchers.compareWithTolerance(searchBar, 'searchbar-basic-focus');
  });

  test('SearchBar - Hover State', async ({ page }) => {
    const searchBar = page.locator('#basic-search');
    await searchBar.hover();
    await page.waitForTimeout(100);
    await VisualTestMatchers.compareWithTolerance(searchBar, 'searchbar-basic-hover');
  });

  test('SearchBar with Value', async ({ page }) => {
    const container = page.locator('#search-with-value').locator('..');
    await VisualTestMatchers.compareWithTolerance(container, 'searchbar-with-value');
  });

  test('SearchBar with Suggestions Dropdown', async ({ page }) => {
    const container = page.locator('#search-with-suggestions').locator('../..');
    await VisualTestMatchers.compareWithTolerance(container, 'searchbar-with-suggestions');
  });

  test('SearchBar with Filters Panel', async ({ page }) => {
    const container = page.locator('#search-with-filters').locator('../..');
    await VisualTestMatchers.compareWithTolerance(container, 'searchbar-with-filters');
  });

  test('SearchBar - Loading State', async ({ page }) => {
    const container = page.locator('#search-loading').locator('../..');
    await VisualTestMatchers.compareWithTolerance(container, 'searchbar-loading');
  });

  test('SearchBar - Error State', async ({ page }) => {
    const container = page.locator('#search-error').locator('../..');
    await VisualTestMatchers.compareWithTolerance(container, 'searchbar-error');
  });

  test('SearchBar - Disabled State', async ({ page }) => {
    const container = page.locator('#search-disabled').locator('../..');
    await VisualTestMatchers.compareWithTolerance(container, 'searchbar-disabled');
  });

  test('SearchBar - Component States Suite', async ({ page }) => {
    const searchBar = page.locator('#basic-search');

    await factory.createComponentSuite('searchbar-basic', searchBar, {
      states: [
        {}, // default
        { hover: true },
        { focus: true },
        { disabled: true },
        { data: { value: 'test query' } }
      ]
    });
  });

  test('SearchBar - Responsive Design', async ({ page }) => {
    const container = page.locator('#basic-search').locator('../..');

    await helpers.testResponsive('searchbar-responsive', container, [
      { viewport: 'mobile' },
      { viewport: 'tablet' },
      { viewport: 'desktop' }
    ]);
  });

  test('SearchBar - Theme Variations', async ({ page }) => {
    const container = page.locator('#basic-search').locator('../..');

    await helpers.testThemes('searchbar-themes', container, [
      'light',
      'dark',
      'high-contrast'
    ]);
  });

  test('SearchBar - Complex Interaction States', async ({ page }) => {
    const searchInput = page.locator('#basic-search');
    const container = searchInput.locator('../..');

    // Test typing animation (with animations disabled)
    await searchInput.fill('VSAM');
    await page.waitForTimeout(100);
    await VisualTestMatchers.compareWithTolerance(container, 'searchbar-typing');

    // Test clearing input
    await searchInput.fill('');
    await page.waitForTimeout(100);
    await VisualTestMatchers.compareWithTolerance(container, 'searchbar-cleared');

    // Test with long query
    await searchInput.fill('This is a very long search query that might overflow the input field');
    await page.waitForTimeout(100);
    await VisualTestMatchers.compareWithTolerance(container, 'searchbar-long-query');
  });

  test('SearchBar - Accessibility Features Visual', async ({ page }) => {
    const searchBar = page.locator('#basic-search');

    // Test focus ring visibility
    await searchBar.focus();
    await page.waitForTimeout(100);
    await VisualTestMatchers.compareWithTolerance(searchBar, 'searchbar-accessibility-focus');

    // Test high contrast mode
    await page.evaluate(() => {
      document.documentElement.className = 'theme-high-contrast';
    });
    await page.waitForTimeout(300);
    await VisualTestMatchers.compareWithTolerance(searchBar, 'searchbar-accessibility-high-contrast');
  });

  test('SearchBar - Cross-browser Visual Consistency', async ({ page, browserName }) => {
    const searchBar = page.locator('#basic-search');
    const container = searchBar.locator('../..');

    // Take screenshots with browser-specific naming
    await VisualTestMatchers.compareWithTolerance(
      container,
      `searchbar-cross-browser-${browserName}`
    );

    // Test focus state cross-browser
    await searchBar.focus();
    await page.waitForTimeout(100);
    await VisualTestMatchers.compareWithTolerance(
      container,
      `searchbar-focus-cross-browser-${browserName}`
    );
  });

  test('SearchBar - Layout Stress Test', async ({ page }) => {
    // Test with various content lengths and container sizes
    await page.setContent(`
      <div style="width: 200px; padding: 10px; border: 1px solid #ccc;">
        <input type="text" class="search-input" placeholder="Narrow container test" />
      </div>
    `);

    const narrowContainer = page.locator('div').first();
    await VisualTestMatchers.compareWithTolerance(narrowContainer, 'searchbar-narrow-container');

    await page.setContent(`
      <div style="width: 1200px; padding: 20px; border: 1px solid #ccc;">
        <input type="text" class="search-input" placeholder="Wide container test" value="Very long search query that spans across a wide container to test responsive behavior and text overflow handling" />
      </div>
    `);

    const wideContainer = page.locator('div').first();
    await VisualTestMatchers.compareWithTolerance(wideContainer, 'searchbar-wide-container');
  });
});

// Cross-browser visual consistency test
test.describe('SearchBar Cross-Browser Visual Tests', () => {
  test('SearchBar renders consistently across browsers', async ({ page, browserName }) => {
    await page.setContent(`
      <div style="padding: 20px; background: white;">
        <input
          type="text"
          style="
            width: 400px;
            padding: 12px;
            border: 2px solid #d1d5db;
            border-radius: 8px;
            font-size: 16px;
          "
          placeholder="Cross-browser test"
          value="Test query"
        />
      </div>
    `);

    const input = page.locator('input');
    await VisualTestMatchers.compareWithTolerance(
      input,
      `cross-browser-searchbar-${browserName}`
    );

    // Test focus state
    await input.focus();
    await page.waitForTimeout(200);
    await VisualTestMatchers.compareWithTolerance(
      input,
      `cross-browser-searchbar-focus-${browserName}`
    );
  });
});