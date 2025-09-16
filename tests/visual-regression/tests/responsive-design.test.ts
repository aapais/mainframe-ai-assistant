/**
 * Visual Regression Tests - Responsive Design
 * Comprehensive testing across mobile, tablet, and desktop viewports
 */

import { test, expect } from '@playwright/test';
import { VisualTestHelpers, VisualTestMatchers } from '../utils/visual-test-helpers';
import { testViewports } from '../config/visual-test.config';

test.describe('Responsive Design Visual Tests', () => {
  let helpers: VisualTestHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new VisualTestHelpers(page);

    // Set up responsive test page
    await page.setContent(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Responsive Design Tests</title>
        <style>
          * {
            box-sizing: border-box;
          }

          body {
            margin: 0;
            padding: 1rem;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background-color: #f5f5f5;
            line-height: 1.6;
          }

          .container {
            max-width: 1200px;
            margin: 0 auto;
          }

          /* Header Component */
          .app-header {
            background: white;
            padding: 1rem;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            margin-bottom: 1rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 1rem;
          }

          .header-title {
            font-size: 1.5rem;
            font-weight: 700;
            color: #1f2937;
            margin: 0;
          }

          .header-actions {
            display: flex;
            gap: 0.5rem;
          }

          .header-button {
            padding: 0.5rem 1rem;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            background: white;
            color: #374151;
            font-size: 0.875rem;
            cursor: pointer;
            white-space: nowrap;
          }

          /* Search Section */
          .search-section {
            background: white;
            padding: 1.5rem;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            margin-bottom: 1rem;
          }

          .search-input-container {
            position: relative;
            margin-bottom: 1rem;
          }

          .search-input {
            width: 100%;
            padding: 0.75rem;
            border: 2px solid #e5e7eb;
            border-radius: 8px;
            font-size: 1rem;
            outline: none;
          }

          .search-input:focus {
            border-color: #3b82f6;
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
          }

          .search-filters {
            display: flex;
            flex-wrap: wrap;
            gap: 0.5rem;
          }

          .filter-chip {
            padding: 0.25rem 0.75rem;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            background: white;
            font-size: 0.875rem;
            cursor: pointer;
            white-space: nowrap;
          }

          .filter-chip.active {
            background: #dbeafe;
            border-color: #3b82f6;
            color: #1d4ed8;
          }

          /* Main Content Layout */
          .main-content {
            display: grid;
            gap: 1rem;
            grid-template-columns: 1fr 1fr;
          }

          .results-panel {
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            overflow: hidden;
          }

          .panel-header {
            padding: 1rem;
            background: #f9fafb;
            border-bottom: 1px solid #e5e7eb;
            font-weight: 600;
          }

          .panel-content {
            padding: 1rem;
          }

          /* Results List */
          .results-list {
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
          }

          .result-item {
            padding: 1rem;
            border: 1px solid #e5e7eb;
            border-radius: 6px;
            cursor: pointer;
            transition: border-color 0.15s ease;
          }

          .result-item:hover {
            border-color: #3b82f6;
          }

          .result-item.selected {
            border-color: #3b82f6;
            background: #f0f9ff;
          }

          .result-title {
            font-weight: 600;
            margin: 0 0 0.5rem 0;
            font-size: 1rem;
          }

          .result-description {
            color: #6b7280;
            font-size: 0.875rem;
            margin: 0;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
          }

          .result-metadata {
            display: flex;
            gap: 1rem;
            margin-top: 0.5rem;
            font-size: 0.75rem;
            color: #6b7280;
          }

          /* Detail Panel */
          .detail-panel {
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          }

          .detail-content {
            padding: 1.5rem;
          }

          .detail-title {
            font-size: 1.5rem;
            font-weight: 700;
            margin: 0 0 1rem 0;
            color: #1f2937;
          }

          .detail-section {
            margin-bottom: 1.5rem;
          }

          .section-title {
            font-size: 1.125rem;
            font-weight: 600;
            margin: 0 0 0.75rem 0;
            color: #374151;
          }

          .section-content {
            color: #6b7280;
            line-height: 1.6;
          }

          .detail-actions {
            display: flex;
            gap: 0.75rem;
            flex-wrap: wrap;
            padding-top: 1rem;
            border-top: 1px solid #e5e7eb;
          }

          .action-button {
            padding: 0.5rem 1rem;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            background: white;
            color: #374151;
            font-size: 0.875rem;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 0.5rem;
          }

          .action-button.primary {
            background: #3b82f6;
            border-color: #3b82f6;
            color: white;
          }

          /* Empty State */
          .empty-state {
            text-align: center;
            padding: 3rem 1rem;
            color: #6b7280;
          }

          .empty-icon {
            font-size: 3rem;
            margin-bottom: 1rem;
          }

          .empty-title {
            font-size: 1.25rem;
            font-weight: 600;
            color: #374151;
            margin-bottom: 0.5rem;
          }

          .empty-message {
            font-size: 0.9rem;
          }

          /* Responsive Breakpoints */

          /* Tablet Styles */
          @media (max-width: 1024px) {
            .main-content {
              grid-template-columns: 1fr;
              gap: 1rem;
            }

            .app-header {
              flex-direction: column;
              align-items: stretch;
              text-align: center;
            }

            .header-actions {
              justify-content: center;
            }

            .detail-actions {
              flex-direction: column;
            }

            .action-button {
              justify-content: center;
            }
          }

          /* Mobile Styles */
          @media (max-width: 768px) {
            body {
              padding: 0.5rem;
            }

            .container {
              padding: 0;
            }

            .header-title {
              font-size: 1.25rem;
            }

            .search-section {
              padding: 1rem;
            }

            .search-filters {
              justify-content: center;
            }

            .filter-chip {
              flex: 1;
              text-align: center;
              min-width: 0;
            }

            .results-list {
              gap: 0.5rem;
            }

            .result-item {
              padding: 0.75rem;
            }

            .result-title {
              font-size: 0.9rem;
            }

            .result-description {
              font-size: 0.8rem;
              -webkit-line-clamp: 3;
            }

            .result-metadata {
              flex-direction: column;
              gap: 0.25rem;
            }

            .detail-content {
              padding: 1rem;
            }

            .detail-title {
              font-size: 1.25rem;
            }

            .section-title {
              font-size: 1rem;
            }

            .panel-content {
              padding: 0.75rem;
            }

            .detail-actions {
              flex-direction: column;
              gap: 0.5rem;
            }
          }

          /* Small Mobile Styles */
          @media (max-width: 480px) {
            .search-filters {
              flex-direction: column;
            }

            .filter-chip {
              text-align: center;
            }

            .result-metadata {
              font-size: 0.7rem;
            }

            .detail-title {
              font-size: 1.125rem;
              line-height: 1.3;
            }

            .section-content {
              font-size: 0.875rem;
            }
          }

          /* Landscape Mobile */
          @media (max-width: 768px) and (orientation: landscape) {
            .main-content {
              grid-template-columns: 1fr 1fr;
            }

            .app-header {
              flex-direction: row;
              text-align: left;
            }

            .header-actions {
              justify-content: flex-end;
            }
          }

          /* Large Desktop */
          @media (min-width: 1440px) {
            .container {
              max-width: 1400px;
            }

            .main-content {
              grid-template-columns: 1fr 1.5fr;
            }

            .detail-content {
              padding: 2rem;
            }
          }
        </style>
      </head>
      <body>
        <div class="container" id="responsive-test-app">
          <!-- App Header -->
          <header class="app-header">
            <h1 class="header-title">🧠 Mainframe KB Assistant</h1>
            <div class="header-actions">
              <button class="header-button">📊 Metrics</button>
              <button class="header-button">+ Add Knowledge</button>
            </div>
          </header>

          <!-- Search Section -->
          <section class="search-section">
            <div class="search-input-container">
              <input
                type="text"
                class="search-input"
                placeholder="Search problems, solutions, error codes..."
                value="VSAM Status 35"
              />
            </div>
            <div class="search-filters">
              <button class="filter-chip">🤖 AI Search</button>
              <button class="filter-chip">All Categories</button>
              <button class="filter-chip active">VSAM</button>
              <button class="filter-chip">JCL</button>
              <button class="filter-chip">Batch</button>
              <button class="filter-chip">DB2</button>
            </div>
          </section>

          <!-- Main Content -->
          <main class="main-content">
            <!-- Results Panel -->
            <section class="results-panel">
              <div class="panel-header">
                Search Results (3 found)
              </div>
              <div class="panel-content">
                <div class="results-list">
                  <article class="result-item selected">
                    <h3 class="result-title">VSAM Status 35 - File Not Found</h3>
                    <p class="result-description">
                      Job abends with VSAM status code 35. The program cannot open the VSAM file.
                    </p>
                    <div class="result-metadata">
                      <span>Success: 90%</span>
                      <span>Used: 42x</span>
                      <span>Category: VSAM</span>
                    </div>
                  </article>

                  <article class="result-item">
                    <h3 class="result-title">VSAM Status 37 - Space Issues</h3>
                    <p class="result-description">
                      VSAM dataset has run out of space or extents. New records cannot be added.
                    </p>
                    <div class="result-metadata">
                      <span>Success: 85%</span>
                      <span>Used: 28x</span>
                      <span>Category: VSAM</span>
                    </div>
                  </article>

                  <article class="result-item">
                    <h3 class="result-title">VSAM VERIFY Command</h3>
                    <p class="result-description">
                      How to use the VERIFY command to resolve VSAM file integrity issues.
                    </p>
                    <div class="result-metadata">
                      <span>Success: 92%</span>
                      <span>Used: 15x</span>
                      <span>Category: VSAM</span>
                    </div>
                  </article>
                </div>
              </div>
            </section>

            <!-- Detail Panel -->
            <section class="detail-panel">
              <div class="panel-header">
                Entry Details
              </div>
              <div class="detail-content">
                <h2 class="detail-title">VSAM Status 35 - File Not Found</h2>

                <div class="detail-section">
                  <h3 class="section-title">❌ Problem Description</h3>
                  <div class="section-content">
                    <p>Job abends with VSAM status code 35. The program cannot open the VSAM file. This error typically occurs when the dataset does not exist in the catalog or the DD statement points to an incorrect dataset name.</p>
                  </div>
                </div>

                <div class="detail-section">
                  <h3 class="section-title">✅ Solution Steps</h3>
                  <div class="section-content">
                    <ol>
                      <li>Verify the dataset exists using ISPF 3.4</li>
                      <li>Check the DD statement in JCL has correct DSN</li>
                      <li>Ensure file is cataloged properly</li>
                      <li>Verify RACF permissions</li>
                    </ol>
                  </div>
                </div>

                <div class="detail-actions">
                  <button class="action-button primary">
                    <span>📋</span>
                    Copy Solution
                  </button>
                  <button class="action-button">
                    <span>🔗</span>
                    Share
                  </button>
                  <button class="action-button">
                    <span>✏️</span>
                    Edit
                  </button>
                </div>
              </div>
            </section>
          </main>
        </div>

        <!-- Empty State (hidden by default) -->
        <div class="empty-state" id="empty-state" style="display: none;">
          <div class="empty-icon">🔍</div>
          <div class="empty-title">No results found</div>
          <div class="empty-message">
            Try different keywords or check your spelling.
            <br>You can also browse by category.
          </div>
        </div>
      </body>
      </html>
    `);

    await helpers.preparePage();
  });

  test('Desktop Layout - Full Application View', async ({ page }) => {
    await page.setViewportSize(testViewports.desktop);
    await page.waitForTimeout(300);

    const app = page.locator('#responsive-test-app');
    await VisualTestMatchers.compareWithTolerance(app, 'responsive-desktop-full', 'layout');
  });

  test('Tablet Layout - Stacked Components', async ({ page }) => {
    await page.setViewportSize(testViewports.tablet);
    await page.waitForTimeout(300);

    const app = page.locator('#responsive-test-app');
    await VisualTestMatchers.compareWithTolerance(app, 'responsive-tablet-stacked', 'layout');
  });

  test('Mobile Layout - Single Column', async ({ page }) => {
    await page.setViewportSize(testViewports.mobile);
    await page.waitForTimeout(300);

    const app = page.locator('#responsive-test-app');
    await VisualTestMatchers.compareWithTolerance(app, 'responsive-mobile-single', 'layout');
  });

  test('Mobile Landscape Layout', async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 }); // iPhone landscape
    await page.waitForTimeout(300);

    const app = page.locator('#responsive-test-app');
    await VisualTestMatchers.compareWithTolerance(app, 'responsive-mobile-landscape', 'layout');
  });

  test('Ultra-wide Desktop Layout', async ({ page }) => {
    await page.setViewportSize({ width: 2560, height: 1440 });
    await page.waitForTimeout(300);

    const app = page.locator('#responsive-test-app');
    await VisualTestMatchers.compareWithTolerance(app, 'responsive-ultrawide', 'layout');
  });

  test('Component-Specific Responsive Behavior', async ({ page }) => {
    const viewports = [
      { name: 'desktop', size: testViewports.desktop },
      { name: 'tablet', size: testViewports.tablet },
      { name: 'mobile', size: testViewports.mobile }
    ];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport.size);
      await page.waitForTimeout(300);

      // Test Header responsiveness
      const header = page.locator('.app-header');
      await VisualTestMatchers.compareWithTolerance(
        header,
        `responsive-header-${viewport.name}`,
        'component'
      );

      // Test Search section responsiveness
      const searchSection = page.locator('.search-section');
      await VisualTestMatchers.compareWithTolerance(
        searchSection,
        `responsive-search-${viewport.name}`,
        'component'
      );

      // Test Results list responsiveness
      const resultsList = page.locator('.results-list');
      await VisualTestMatchers.compareWithTolerance(
        resultsList,
        `responsive-results-${viewport.name}`,
        'component'
      );

      // Test Detail panel responsiveness
      const detailPanel = page.locator('.detail-panel');
      await VisualTestMatchers.compareWithTolerance(
        detailPanel,
        `responsive-detail-${viewport.name}`,
        'component'
      );
    }
  });

  test('Filter Chips Responsive Behavior', async ({ page }) => {
    const viewports = [
      { name: 'desktop', size: { width: 1920, height: 1080 } },
      { name: 'tablet', size: { width: 768, height: 1024 } },
      { name: 'mobile', size: { width: 375, height: 667 } },
      { name: 'small-mobile', size: { width: 320, height: 568 } }
    ];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport.size);
      await page.waitForTimeout(300);

      const searchFilters = page.locator('.search-filters');
      await VisualTestMatchers.compareWithTolerance(
        searchFilters,
        `responsive-filters-${viewport.name}`,
        'component'
      );
    }
  });

  test('Text Scaling and Readability', async ({ page }) => {
    const textScales = [
      { name: 'normal', scale: 1.0 },
      { name: 'large', scale: 1.25 },
      { name: 'xlarge', scale: 1.5 }
    ];

    for (const textScale of textScales) {
      // Apply text scaling
      await page.evaluate((scale) => {
        document.documentElement.style.fontSize = `${16 * scale}px`;
      }, textScale.scale);

      await page.setViewportSize(testViewports.mobile);
      await page.waitForTimeout(300);

      const app = page.locator('#responsive-test-app');
      await VisualTestMatchers.compareWithTolerance(
        app,
        `responsive-text-scale-${textScale.name}`,
        'layout'
      );
    }
  });

  test('Empty State Responsive Behavior', async ({ page }) => {
    // Show empty state
    await page.evaluate(() => {
      document.querySelector('.main-content')?.style.setProperty('display', 'none');
      document.querySelector('#empty-state')?.style.setProperty('display', 'block');
    });

    const viewports = [
      { name: 'desktop', size: testViewports.desktop },
      { name: 'tablet', size: testViewports.tablet },
      { name: 'mobile', size: testViewports.mobile }
    ];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport.size);
      await page.waitForTimeout(300);

      const emptyState = page.locator('#empty-state');
      await VisualTestMatchers.compareWithTolerance(
        emptyState,
        `responsive-empty-state-${viewport.name}`,
        'component'
      );
    }
  });

  test('Interaction Elements Touch Targets', async ({ page }) => {
    // Test touch target sizes on mobile
    await page.setViewportSize(testViewports.mobile);
    await page.waitForTimeout(300);

    // Test button touch targets
    const actionButtons = page.locator('.action-button');
    for (let i = 0; i < await actionButtons.count(); i++) {
      const button = actionButtons.nth(i);
      await VisualTestMatchers.compareWithTolerance(
        button,
        `responsive-touch-target-button-${i}`,
        'component'
      );
    }

    // Test filter chip touch targets
    const filterChips = page.locator('.filter-chip');
    const firstChip = filterChips.first();
    await VisualTestMatchers.compareWithTolerance(
      firstChip,
      'responsive-touch-target-chip',
      'component'
    );

    // Test result item touch targets
    const resultItems = page.locator('.result-item');
    const firstResult = resultItems.first();
    await VisualTestMatchers.compareWithTolerance(
      firstResult,
      'responsive-touch-target-result',
      'component'
    );
  });

  test('Cross-Orientation Consistency', async ({ page }) => {
    const device = { width: 390, height: 844 }; // iPhone 12 dimensions

    // Portrait mode
    await page.setViewportSize(device);
    await page.waitForTimeout(300);
    const portraitApp = page.locator('#responsive-test-app');
    await VisualTestMatchers.compareWithTolerance(
      portraitApp,
      'responsive-portrait',
      'layout'
    );

    // Landscape mode
    await page.setViewportSize({ width: device.height, height: device.width });
    await page.waitForTimeout(300);
    const landscapeApp = page.locator('#responsive-test-app');
    await VisualTestMatchers.compareWithTolerance(
      landscapeApp,
      'responsive-landscape',
      'layout'
    );
  });

  test('Content Reflow and Line Breaks', async ({ page }) => {
    // Test how content reflows at different widths
    const testWidths = [1200, 800, 600, 400, 320];

    for (const width of testWidths) {
      await page.setViewportSize({ width, height: 800 });
      await page.waitForTimeout(300);

      // Focus on text-heavy components
      const detailContent = page.locator('.detail-content');
      await VisualTestMatchers.compareWithTolerance(
        detailContent,
        `responsive-reflow-${width}w`,
        'text'
      );
    }
  });

  test('Responsive Grid Behavior', async ({ page }) => {
    // Test main content grid at various sizes
    const breakpoints = [
      { name: 'wide', width: 1400 },
      { name: 'desktop', width: 1200 },
      { name: 'laptop', width: 1024 },
      { name: 'tablet', width: 768 },
      { name: 'mobile', width: 480 },
      { name: 'small', width: 320 }
    ];

    for (const breakpoint of breakpoints) {
      await page.setViewportSize({ width: breakpoint.width, height: 800 });
      await page.waitForTimeout(300);

      const mainContent = page.locator('.main-content');
      await VisualTestMatchers.compareWithTolerance(
        mainContent,
        `responsive-grid-${breakpoint.name}`,
        'layout'
      );
    }
  });
});

// Device-specific responsive tests
test.describe('Device-Specific Responsive Tests', () => {
  const commonDevices = [
    { name: 'iPhone-SE', width: 375, height: 667 },
    { name: 'iPhone-12', width: 390, height: 844 },
    { name: 'iPhone-12-Pro-Max', width: 428, height: 926 },
    { name: 'Galaxy-S21', width: 384, height: 854 },
    { name: 'iPad-Mini', width: 744, height: 1133 },
    { name: 'iPad-Pro', width: 1024, height: 1366 },
    { name: 'Surface-Pro', width: 912, height: 1368 }
  ];

  for (const device of commonDevices) {
    test(`${device.name} Device Layout`, async ({ page }) => {
      await page.setContent(`
        <div style="padding: 10px; font-family: system-ui;">
          <h1>KB Assistant - ${device.name}</h1>
          <input style="width: 100%; padding: 12px; margin: 10px 0; border: 1px solid #ccc; border-radius: 6px;" placeholder="Search..." />
          <div style="display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));">
            <div style="background: white; padding: 15px; border-radius: 8px; border: 1px solid #eee;">Result 1</div>
            <div style="background: white; padding: 15px; border-radius: 8px; border: 1px solid #eee;">Result 2</div>
            <div style="background: white; padding: 15px; border-radius: 8px; border: 1px solid #eee;">Result 3</div>
          </div>
        </div>
      `);

      await page.setViewportSize({ width: device.width, height: device.height });
      await page.waitForTimeout(200);

      await VisualTestMatchers.compareWithTolerance(
        page.locator('body'),
        `device-${device.name.toLowerCase()}`,
        'layout'
      );
    });
  }
});