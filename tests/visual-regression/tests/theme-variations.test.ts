/**
 * Visual Regression Tests - Theme Variations
 * Comprehensive testing for light, dark, and high-contrast themes
 */

import { test, expect } from '@playwright/test';
import { VisualTestHelpers, VisualTestMatchers } from '../utils/visual-test-helpers';

test.describe('Theme Variations Visual Tests', () => {
  let helpers: VisualTestHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new VisualTestHelpers(page);

    // Set up a comprehensive UI with multiple components
    await page.setContent(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Theme Variations Test</title>
        <style>
          :root {
            /* Light theme variables */
            --bg-primary: #ffffff;
            --bg-secondary: #f9fafb;
            --bg-tertiary: #f3f4f6;
            --text-primary: #1f2937;
            --text-secondary: #6b7280;
            --border-primary: #e5e7eb;
            --border-secondary: #d1d5db;
            --accent-primary: #3b82f6;
            --accent-secondary: #10b981;
            --accent-danger: #ef4444;
            --accent-warning: #f59e0b;
          }

          [data-theme="dark"] {
            /* Dark theme variables */
            --bg-primary: #1f2937;
            --bg-secondary: #374151;
            --bg-tertiary: #4b5563;
            --text-primary: #f9fafb;
            --text-secondary: #d1d5db;
            --border-primary: #6b7280;
            --border-secondary: #9ca3af;
            --accent-primary: #60a5fa;
            --accent-secondary: #34d399;
            --accent-danger: #f87171;
            --accent-warning: #fbbf24;
          }

          [data-theme="high-contrast"] {
            /* High contrast theme */
            --bg-primary: #ffffff;
            --bg-secondary: #ffffff;
            --bg-tertiary: #ffffff;
            --text-primary: #000000;
            --text-secondary: #000000;
            --border-primary: #000000;
            --border-secondary: #000000;
            --accent-primary: #0000ff;
            --accent-secondary: #008000;
            --accent-danger: #ff0000;
            --accent-warning: #ff8c00;
          }

          * {
            box-sizing: border-box;
          }

          body {
            margin: 0;
            padding: 20px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background-color: var(--bg-secondary);
            color: var(--text-primary);
            line-height: 1.6;
            transition: background-color 0.2s ease, color 0.2s ease;
          }

          .theme-test-container {
            max-width: 1200px;
            margin: 0 auto;
            display: grid;
            gap: 2rem;
          }

          .component-section {
            background: var(--bg-primary);
            padding: 2rem;
            border-radius: 8px;
            border: 1px solid var(--border-primary);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          }

          .section-title {
            font-size: 1.5rem;
            font-weight: 700;
            color: var(--text-primary);
            margin: 0 0 1.5rem 0;
            border-bottom: 2px solid var(--accent-primary);
            padding-bottom: 0.5rem;
          }

          /* Search Bar Component */
          .search-container {
            position: relative;
            margin-bottom: 1rem;
          }

          .search-input {
            width: 100%;
            padding: 0.75rem;
            border: 2px solid var(--border-primary);
            border-radius: 8px;
            background: var(--bg-primary);
            color: var(--text-primary);
            font-size: 1rem;
            outline: none;
            transition: border-color 0.15s ease;
          }

          .search-input:focus {
            border-color: var(--accent-primary);
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
          }

          .search-suggestions {
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background: var(--bg-primary);
            border: 1px solid var(--border-primary);
            border-radius: 0 0 8px 8px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            max-height: 200px;
            overflow-y: auto;
          }

          .suggestion-item {
            padding: 0.75rem;
            border-bottom: 1px solid var(--border-secondary);
            cursor: pointer;
            transition: background-color 0.15s ease;
          }

          .suggestion-item:hover {
            background: var(--bg-secondary);
          }

          .suggestion-item:last-child {
            border-bottom: none;
          }

          /* Results List Component */
          .results-list {
            display: flex;
            flex-direction: column;
            gap: 1rem;
          }

          .result-item {
            background: var(--bg-primary);
            border: 1px solid var(--border-primary);
            border-radius: 8px;
            padding: 1rem;
            cursor: pointer;
            transition: all 0.15s ease;
          }

          .result-item:hover {
            border-color: var(--accent-primary);
            box-shadow: 0 2px 8px rgba(59, 130, 246, 0.15);
          }

          .result-item.selected {
            border-color: var(--accent-primary);
            background: rgba(59, 130, 246, 0.05);
          }

          .result-title {
            font-size: 1.125rem;
            font-weight: 600;
            color: var(--text-primary);
            margin: 0 0 0.5rem 0;
          }

          .result-description {
            color: var(--text-secondary);
            font-size: 0.875rem;
            margin: 0 0 0.75rem 0;
          }

          .result-metadata {
            display: flex;
            gap: 1rem;
            font-size: 0.75rem;
            color: var(--text-secondary);
          }

          /* Entry Detail Component */
          .entry-detail {
            background: var(--bg-primary);
            border-radius: 8px;
            overflow: hidden;
          }

          .entry-header {
            background: var(--bg-secondary);
            padding: 1.5rem;
            border-bottom: 1px solid var(--border-primary);
          }

          .entry-title {
            font-size: 1.75rem;
            font-weight: 700;
            color: var(--text-primary);
            margin: 0 0 1rem 0;
          }

          .entry-content {
            padding: 1.5rem;
          }

          .content-section {
            background: var(--bg-tertiary);
            padding: 1rem;
            border-radius: 6px;
            border-left: 4px solid var(--accent-secondary);
            margin-bottom: 1rem;
          }

          .content-section.problem {
            border-left-color: var(--accent-danger);
          }

          /* UI Controls */
          .controls-section {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
            margin-bottom: 2rem;
          }

          .button {
            padding: 0.75rem 1.5rem;
            border: 1px solid var(--border-primary);
            border-radius: 6px;
            background: var(--bg-primary);
            color: var(--text-primary);
            font-size: 0.875rem;
            cursor: pointer;
            transition: all 0.15s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
          }

          .button:hover {
            background: var(--bg-secondary);
            border-color: var(--border-secondary);
          }

          .button.primary {
            background: var(--accent-primary);
            border-color: var(--accent-primary);
            color: white;
          }

          .button.success {
            background: var(--accent-secondary);
            border-color: var(--accent-secondary);
            color: white;
          }

          .button.danger {
            background: var(--accent-danger);
            border-color: var(--accent-danger);
            color: white;
          }

          .button.warning {
            background: var(--accent-warning);
            border-color: var(--accent-warning);
            color: white;
          }

          /* Form Elements */
          .form-group {
            margin-bottom: 1rem;
          }

          .form-label {
            display: block;
            font-weight: 500;
            color: var(--text-primary);
            margin-bottom: 0.5rem;
          }

          .form-input {
            width: 100%;
            padding: 0.5rem;
            border: 1px solid var(--border-primary);
            border-radius: 4px;
            background: var(--bg-primary);
            color: var(--text-primary);
          }

          .form-input:focus {
            outline: none;
            border-color: var(--accent-primary);
            box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
          }

          .checkbox {
            appearance: none;
            width: 1rem;
            height: 1rem;
            border: 1px solid var(--border-primary);
            border-radius: 2px;
            background: var(--bg-primary);
            position: relative;
            cursor: pointer;
          }

          .checkbox:checked {
            background: var(--accent-primary);
            border-color: var(--accent-primary);
          }

          .checkbox:checked::after {
            content: '✓';
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: white;
            font-size: 0.75rem;
          }

          /* Status Indicators */
          .status-indicators {
            display: flex;
            gap: 1rem;
            margin-bottom: 1rem;
          }

          .status-badge {
            padding: 0.25rem 0.75rem;
            border-radius: 12px;
            font-size: 0.75rem;
            font-weight: 600;
          }

          .status-badge.success {
            background: var(--accent-secondary);
            color: white;
          }

          .status-badge.warning {
            background: var(--accent-warning);
            color: white;
          }

          .status-badge.danger {
            background: var(--accent-danger);
            color: white;
          }

          .status-badge.info {
            background: var(--accent-primary);
            color: white;
          }

          /* Cards and Panels */
          .cards-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 1rem;
          }

          .card {
            background: var(--bg-primary);
            border: 1px solid var(--border-primary);
            border-radius: 8px;
            padding: 1rem;
            transition: box-shadow 0.15s ease;
          }

          .card:hover {
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          }

          .card-title {
            font-weight: 600;
            color: var(--text-primary);
            margin: 0 0 0.5rem 0;
          }

          .card-content {
            color: var(--text-secondary);
            font-size: 0.875rem;
          }

          /* Theme-specific adjustments */
          [data-theme="high-contrast"] .button:focus,
          [data-theme="high-contrast"] .form-input:focus,
          [data-theme="high-contrast"] .search-input:focus {
            box-shadow: 0 0 0 3px var(--accent-primary);
            outline: 2px solid var(--accent-primary);
          }
        </style>
      </head>
      <body>
        <div class="theme-test-container" id="theme-test-suite">
          <!-- Search Component -->
          <div class="component-section">
            <h2 class="section-title">Search Component</h2>
            <div class="search-container">
              <input
                type="text"
                class="search-input"
                placeholder="Search problems, solutions, error codes..."
                value="VSAM Status 35"
              />
              <div class="search-suggestions">
                <div class="suggestion-item">VSAM Status 35 - File Not Found</div>
                <div class="suggestion-item">VSAM Status 37 - Space Issues</div>
                <div class="suggestion-item">VSAM Recovery Procedures</div>
              </div>
            </div>
          </div>

          <!-- Results List -->
          <div class="component-section">
            <h2 class="section-title">Results List</h2>
            <div class="results-list">
              <div class="result-item selected">
                <div class="result-title">VSAM Status 35 - File Not Found</div>
                <div class="result-description">Job abends with VSAM status code 35. The program cannot open the VSAM file.</div>
                <div class="result-metadata">
                  <span>Category: VSAM</span>
                  <span>Success Rate: 90%</span>
                  <span>Used: 42 times</span>
                </div>
              </div>
              <div class="result-item">
                <div class="result-title">S0C7 - Data Exception in COBOL</div>
                <div class="result-description">Program abends with S0C7 data exception during arithmetic operations.</div>
                <div class="result-metadata">
                  <span>Category: Batch</span>
                  <span>Success Rate: 89%</span>
                  <span>Used: 28 times</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Entry Detail -->
          <div class="component-section">
            <h2 class="section-title">Entry Detail</h2>
            <div class="entry-detail">
              <div class="entry-header">
                <h1 class="entry-title">DB2 SQLCODE -904 - Resource Unavailable</h1>
                <div class="status-indicators">
                  <span class="status-badge info">DB2</span>
                  <span class="status-badge success">High Success Rate</span>
                </div>
              </div>
              <div class="entry-content">
                <div class="content-section problem">
                  <h3>Problem Description</h3>
                  <p>Program receives SQLCODE -904 indicating resource unavailable.</p>
                </div>
                <div class="content-section">
                  <h3>Solution Steps</h3>
                  <p>Check database status and resolve any pending operations.</p>
                </div>
              </div>
            </div>
          </div>

          <!-- UI Controls -->
          <div class="component-section">
            <h2 class="section-title">UI Controls</h2>
            <div class="controls-section">
              <button class="button">Default Button</button>
              <button class="button primary">Primary Button</button>
              <button class="button success">Success Button</button>
              <button class="button warning">Warning Button</button>
              <button class="button danger">Danger Button</button>
            </div>

            <div class="status-indicators">
              <span class="status-badge info">Info Status</span>
              <span class="status-badge success">Success Status</span>
              <span class="status-badge warning">Warning Status</span>
              <span class="status-badge danger">Error Status</span>
            </div>
          </div>

          <!-- Form Elements -->
          <div class="component-section">
            <h2 class="section-title">Form Elements</h2>
            <div class="form-group">
              <label class="form-label">Search Query</label>
              <input type="text" class="form-input" value="Sample search query" />
            </div>
            <div class="form-group">
              <label class="form-label">
                <input type="checkbox" class="checkbox" checked /> Enable AI Search
              </label>
            </div>
            <div class="form-group">
              <label class="form-label">
                <input type="checkbox" class="checkbox" /> Include archived entries
              </label>
            </div>
          </div>

          <!-- Cards Grid -->
          <div class="component-section">
            <h2 class="section-title">Information Cards</h2>
            <div class="cards-grid">
              <div class="card">
                <div class="card-title">Total Entries</div>
                <div class="card-content">156 knowledge base entries</div>
              </div>
              <div class="card">
                <div class="card-title">Success Rate</div>
                <div class="card-content">87% average resolution success</div>
              </div>
              <div class="card">
                <div class="card-title">Most Used</div>
                <div class="card-content">VSAM related issues</div>
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `);

    await helpers.preparePage();
  });

  test('Light Theme - Complete UI Suite', async ({ page }) => {
    // Ensure light theme is active
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'light');
    });
    await page.waitForTimeout(300);

    const testSuite = page.locator('#theme-test-suite');
    await VisualTestMatchers.compareWithTolerance(testSuite, 'theme-light-complete', 'layout');
  });

  test('Dark Theme - Complete UI Suite', async ({ page }) => {
    // Apply dark theme
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
    });
    await page.waitForTimeout(300);

    const testSuite = page.locator('#theme-test-suite');
    await VisualTestMatchers.compareWithTolerance(testSuite, 'theme-dark-complete', 'layout');
  });

  test('High Contrast Theme - Complete UI Suite', async ({ page }) => {
    // Apply high contrast theme
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'high-contrast');
    });
    await page.waitForTimeout(300);

    const testSuite = page.locator('#theme-test-suite');
    await VisualTestMatchers.compareWithTolerance(testSuite, 'theme-high-contrast-complete', 'layout');
  });

  test('Theme Transition - Component Focus', async ({ page }) => {
    const themes = ['light', 'dark', 'high-contrast'];

    for (const theme of themes) {
      // Apply theme
      await page.evaluate((themeName) => {
        document.documentElement.setAttribute('data-theme', themeName);
      }, theme);
      await page.waitForTimeout(300);

      // Test individual components in this theme
      const searchComponent = page.locator('.component-section').first();
      await VisualTestMatchers.compareWithTolerance(
        searchComponent,
        `theme-${theme}-search-component`,
        'component'
      );

      const resultsComponent = page.locator('.component-section').nth(1);
      await VisualTestMatchers.compareWithTolerance(
        resultsComponent,
        `theme-${theme}-results-component`,
        'component'
      );

      const controlsComponent = page.locator('.component-section').nth(3);
      await VisualTestMatchers.compareWithTolerance(
        controlsComponent,
        `theme-${theme}-controls-component`,
        'component'
      );
    }
  });

  test('Theme-Specific Interactive States', async ({ page }) => {
    const themes = ['light', 'dark', 'high-contrast'];

    for (const theme of themes) {
      // Apply theme
      await page.evaluate((themeName) => {
        document.documentElement.setAttribute('data-theme', themeName);
      }, theme);
      await page.waitForTimeout(300);

      // Test button hover states
      const primaryButton = page.locator('.button.primary').first();
      await primaryButton.hover();
      await page.waitForTimeout(200);
      await VisualTestMatchers.compareWithTolerance(
        primaryButton,
        `theme-${theme}-button-hover`,
        'component'
      );

      // Test input focus states
      const searchInput = page.locator('.search-input');
      await searchInput.focus();
      await page.waitForTimeout(100);
      await VisualTestMatchers.compareWithTolerance(
        searchInput,
        `theme-${theme}-input-focus`,
        'component'
      );

      // Test result item hover
      const resultItem = page.locator('.result-item').first();
      await resultItem.hover();
      await page.waitForTimeout(200);
      await VisualTestMatchers.compareWithTolerance(
        resultItem,
        `theme-${theme}-result-hover`,
        'component'
      );
    }
  });

  test('Color Contrast Validation', async ({ page }) => {
    const themes = ['light', 'dark', 'high-contrast'];

    for (const theme of themes) {
      await page.evaluate((themeName) => {
        document.documentElement.setAttribute('data-theme', themeName);
      }, theme);
      await page.waitForTimeout(300);

      // Test text contrast on different backgrounds
      const textElements = page.locator('.section-title, .result-title, .card-title, .form-label');

      for (let i = 0; i < await textElements.count(); i++) {
        const element = textElements.nth(i);
        await VisualTestMatchers.compareWithTolerance(
          element,
          `theme-${theme}-text-contrast-${i}`,
          'text'
        );
      }
    }
  });

  test('Theme Consistency Across Components', async ({ page }) => {
    // Test that all components maintain theme consistency
    const themes = ['light', 'dark'];

    for (const theme of themes) {
      await page.evaluate((themeName) => {
        document.documentElement.setAttribute('data-theme', themeName);
      }, theme);
      await page.waitForTimeout(300);

      // Test that borders, backgrounds, and text colors are consistent
      const componentSections = page.locator('.component-section');

      for (let i = 0; i < await componentSections.count(); i++) {
        const section = componentSections.nth(i);
        await VisualTestMatchers.compareWithTolerance(
          section,
          `theme-${theme}-consistency-section-${i}`,
          'component'
        );
      }
    }
  });

  test('System Color Scheme Detection', async ({ page }) => {
    // Test system preference detection (simulated)

    // Simulate dark mode preference
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.evaluate(() => {
      // Apply theme based on system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    });
    await page.waitForTimeout(300);

    const darkSystemTheme = page.locator('#theme-test-suite');
    await VisualTestMatchers.compareWithTolerance(
      darkSystemTheme,
      'theme-system-dark-preference',
      'layout'
    );

    // Simulate light mode preference
    await page.emulateMedia({ colorScheme: 'light' });
    await page.evaluate(() => {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    });
    await page.waitForTimeout(300);

    const lightSystemTheme = page.locator('#theme-test-suite');
    await VisualTestMatchers.compareWithTolerance(
      lightSystemTheme,
      'theme-system-light-preference',
      'layout'
    );
  });
});

// Theme-specific color scheme tests
test.describe('Theme Color Scheme Validation', () => {
  test('Validate theme color accessibility', async ({ page }) => {
    await page.setContent(`
      <div style="padding: 20px;">
        <div id="color-test-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem;">
          <!-- Light theme samples -->
          <div data-theme="light" style="padding: 1rem; background: #ffffff; color: #1f2937; border: 1px solid #e5e7eb;">
            <h3 style="color: #1f2937;">Light Theme</h3>
            <p style="color: #6b7280;">Secondary text</p>
            <button style="background: #3b82f6; color: white; border: none; padding: 0.5rem 1rem;">Primary Button</button>
          </div>

          <!-- Dark theme samples -->
          <div data-theme="dark" style="padding: 1rem; background: #1f2937; color: #f9fafb; border: 1px solid #6b7280;">
            <h3 style="color: #f9fafb;">Dark Theme</h3>
            <p style="color: #d1d5db;">Secondary text</p>
            <button style="background: #60a5fa; color: white; border: none; padding: 0.5rem 1rem;">Primary Button</button>
          </div>

          <!-- High contrast samples -->
          <div data-theme="high-contrast" style="padding: 1rem; background: #ffffff; color: #000000; border: 2px solid #000000;">
            <h3 style="color: #000000;">High Contrast</h3>
            <p style="color: #000000;">Secondary text</p>
            <button style="background: #0000ff; color: white; border: 2px solid #000000; padding: 0.5rem 1rem;">Primary Button</button>
          </div>
        </div>
      </div>
    `);

    const colorGrid = page.locator('#color-test-grid');
    await VisualTestMatchers.compareWithTolerance(colorGrid, 'theme-color-accessibility', 'component');
  });
});