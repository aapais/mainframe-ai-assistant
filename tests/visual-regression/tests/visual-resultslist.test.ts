/**
 * Visual Regression Tests - ResultsList Component
 * Comprehensive visual testing for search results display
 */

import { test, expect } from '@playwright/test';
import { VisualTestHelpers, ComponentTestFactory, VisualTestMatchers } from '../utils/visual-test-helpers';
import mockKBData from '../fixtures/mock-kb-data.json';

test.describe('ResultsList Visual Regression', () => {
  let helpers: VisualTestHelpers;
  let factory: ComponentTestFactory;

  test.beforeEach(async ({ page }) => {
    helpers = new VisualTestHelpers(page);
    factory = new ComponentTestFactory(page);

    // Set up test page with ResultsList component
    await page.setContent(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>ResultsList Visual Tests</title>
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

          .results-list {
            display: flex;
            flex-direction: column;
            gap: 1rem;
            max-height: 600px;
            overflow-y: auto;
          }

          .result-item {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
            padding: 1rem;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            background: #ffffff;
            cursor: pointer;
            transition: all 0.15s ease;
          }

          .result-item:hover {
            border-color: #3b82f6;
            box-shadow: 0 2px 8px rgba(59, 130, 246, 0.1);
            transform: translateY(-1px);
          }

          .result-item.selected {
            border-color: #3b82f6;
            background-color: #f0f9ff;
            box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
          }

          .result-item.loading {
            opacity: 0.6;
            pointer-events: none;
          }

          .result-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 1rem;
          }

          .result-title {
            font-size: 1.1rem;
            font-weight: 600;
            color: #1f2937;
            margin: 0;
            line-height: 1.4;
          }

          .result-item.selected .result-title {
            color: #1d4ed8;
          }

          .result-metadata {
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            gap: 0.25rem;
            flex-shrink: 0;
          }

          .match-score {
            background: #10b981;
            color: white;
            padding: 0.125rem 0.5rem;
            border-radius: 12px;
            font-size: 0.75rem;
            font-weight: 600;
          }

          .match-score.medium {
            background: #f59e0b;
          }

          .match-score.low {
            background: #6b7280;
          }

          .category-badge {
            background: #e5e7eb;
            color: #374151;
            padding: 0.125rem 0.5rem;
            border-radius: 4px;
            font-size: 0.75rem;
            font-weight: 500;
          }

          .category-badge.vsam {
            background: #dbeafe;
            color: #1d4ed8;
          }

          .category-badge.batch {
            background: #fef3c7;
            color: #d97706;
          }

          .category-badge.jcl {
            background: #dcfce7;
            color: #16a34a;
          }

          .category-badge.db2 {
            background: #fecaca;
            color: #dc2626;
          }

          .result-problem {
            color: #6b7280;
            font-size: 0.9rem;
            line-height: 1.4;
            margin: 0.5rem 0;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
          }

          .result-tags {
            display: flex;
            flex-wrap: wrap;
            gap: 0.25rem;
            margin-top: 0.5rem;
          }

          .tag {
            background: #f3f4f6;
            color: #374151;
            padding: 0.125rem 0.375rem;
            border-radius: 4px;
            font-size: 0.75rem;
            border: 1px solid #e5e7eb;
          }

          .result-stats {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 0.75rem;
            padding-top: 0.75rem;
            border-top: 1px solid #e5e7eb;
            font-size: 0.875rem;
            color: #6b7280;
          }

          .usage-stats {
            display: flex;
            gap: 1rem;
          }

          .success-rate {
            font-weight: 600;
          }

          .success-rate.high {
            color: #16a34a;
          }

          .success-rate.medium {
            color: #d97706;
          }

          .success-rate.low {
            color: #dc2626;
          }

          /* Empty state */
          .empty-state {
            text-align: center;
            padding: 3rem;
            color: #6b7280;
          }

          .empty-icon {
            font-size: 4rem;
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
            line-height: 1.5;
          }

          /* Loading state */
          .loading-skeleton {
            display: flex;
            flex-direction: column;
            gap: 1rem;
          }

          .skeleton-item {
            padding: 1rem;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            background: #f9fafb;
          }

          .skeleton-line {
            height: 1rem;
            background: #e5e7eb;
            border-radius: 4px;
            margin-bottom: 0.5rem;
            animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
          }

          .skeleton-line.short {
            width: 60%;
          }

          .skeleton-line.medium {
            width: 80%;
          }

          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }

          /* Theme variations */
          .theme-dark {
            background-color: #1f2937;
            color: #f9fafb;
          }

          .theme-dark .test-container {
            background: #374151;
          }

          .theme-dark .result-item {
            background: #4b5563;
            border-color: #6b7280;
            color: #f9fafb;
          }

          .theme-dark .result-item:hover {
            border-color: #60a5fa;
            background: #525967;
          }

          .theme-dark .result-item.selected {
            background: #1e3a8a;
            border-color: #3b82f6;
          }

          .theme-dark .result-title {
            color: #f9fafb;
          }

          .theme-dark .result-item.selected .result-title {
            color: #93c5fd;
          }

          /* Responsive styles */
          @media (max-width: 768px) {
            .result-header {
              flex-direction: column;
              gap: 0.5rem;
            }

            .result-metadata {
              flex-direction: row;
              align-items: center;
              align-self: flex-start;
              gap: 0.5rem;
            }

            .result-stats {
              flex-direction: column;
              align-items: flex-start;
              gap: 0.5rem;
            }

            .usage-stats {
              flex-direction: column;
              gap: 0.25rem;
            }
          }
        </style>
      </head>
      <body>
        <!-- Results List with Data -->
        <div class="test-container">
          <h2>Results List - With Results</h2>
          <div class="results-list" id="results-with-data">
            <div class="result-item">
              <div class="result-header">
                <h3 class="result-title">VSAM Status 35 - File Not Found</h3>
                <div class="result-metadata">
                  <span class="match-score">95%</span>
                  <span class="category-badge vsam">VSAM</span>
                </div>
              </div>
              <p class="result-problem">Job abends with VSAM status code 35. The program cannot open the VSAM file.</p>
              <div class="result-tags">
                <span class="tag">vsam</span>
                <span class="tag">status-35</span>
                <span class="tag">file-not-found</span>
              </div>
              <div class="result-stats">
                <div class="usage-stats">
                  <span>Used: 42 times</span>
                  <span>Success: 38/42</span>
                </div>
                <span class="success-rate high">90% success rate</span>
              </div>
            </div>

            <div class="result-item selected">
              <div class="result-header">
                <h3 class="result-title">S0C7 - Data Exception in COBOL</h3>
                <div class="result-metadata">
                  <span class="match-score medium">82%</span>
                  <span class="category-badge batch">Batch</span>
                </div>
              </div>
              <p class="result-problem">Program abends with S0C7 data exception during arithmetic operations.</p>
              <div class="result-tags">
                <span class="tag">s0c7</span>
                <span class="tag">data-exception</span>
                <span class="tag">cobol</span>
              </div>
              <div class="result-stats">
                <div class="usage-stats">
                  <span>Used: 28 times</span>
                  <span>Success: 25/28</span>
                </div>
                <span class="success-rate high">89% success rate</span>
              </div>
            </div>

            <div class="result-item">
              <div class="result-header">
                <h3 class="result-title">JCL Error - Dataset Not Found</h3>
                <div class="result-metadata">
                  <span class="match-score low">67%</span>
                  <span class="category-badge jcl">JCL</span>
                </div>
              </div>
              <p class="result-problem">JCL fails with IEF212I dataset not found error</p>
              <div class="result-tags">
                <span class="tag">jcl</span>
                <span class="tag">dataset</span>
                <span class="tag">not-found</span>
              </div>
              <div class="result-stats">
                <div class="usage-stats">
                  <span>Used: 15 times</span>
                  <span>Success: 14/15</span>
                </div>
                <span class="success-rate high">93% success rate</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty Results -->
        <div class="test-container">
          <h2>Results List - Empty State</h2>
          <div class="empty-state" id="results-empty">
            <div class="empty-icon">🔍</div>
            <div class="empty-title">No results found</div>
            <div class="empty-message">
              Try different keywords or check your spelling.<br>
              You can also browse by category or view recent searches.
            </div>
          </div>
        </div>

        <!-- Loading State -->
        <div class="test-container">
          <h2>Results List - Loading State</h2>
          <div class="loading-skeleton" id="results-loading">
            <div class="skeleton-item">
              <div class="skeleton-line"></div>
              <div class="skeleton-line short"></div>
              <div class="skeleton-line medium"></div>
            </div>
            <div class="skeleton-item">
              <div class="skeleton-line medium"></div>
              <div class="skeleton-line"></div>
              <div class="skeleton-line short"></div>
            </div>
            <div class="skeleton-item">
              <div class="skeleton-line short"></div>
              <div class="skeleton-line"></div>
              <div class="skeleton-line medium"></div>
            </div>
          </div>
        </div>

        <!-- Single Result -->
        <div class="test-container">
          <h2>Single Result Item</h2>
          <div class="results-list">
            <div class="result-item" id="single-result">
              <div class="result-header">
                <h3 class="result-title">DB2 SQLCODE -904 - Resource Unavailable</h3>
                <div class="result-metadata">
                  <span class="match-score">88%</span>
                  <span class="category-badge db2">DB2</span>
                </div>
              </div>
              <p class="result-problem">Program receives SQLCODE -904 indicating resource unavailable. This typically occurs when a tablespace is in COPY pending status or when there are locking issues.</p>
              <div class="result-tags">
                <span class="tag">db2</span>
                <span class="tag">sqlcode</span>
                <span class="tag">-904</span>
                <span class="tag">resource</span>
                <span class="tag">unavailable</span>
              </div>
              <div class="result-stats">
                <div class="usage-stats">
                  <span>Used: 156 times</span>
                  <span>Success: 132/156</span>
                </div>
                <span class="success-rate medium">85% success rate</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Long Results List -->
        <div class="test-container">
          <h2>Long Results List</h2>
          <div class="results-list" id="long-results" style="max-height: 400px;">
            ${Array.from({ length: 8 }, (_, i) => `
              <div class="result-item ${i === 2 ? 'selected' : ''}">
                <div class="result-header">
                  <h3 class="result-title">Result Item ${i + 1} - Sample Problem Title</h3>
                  <div class="result-metadata">
                    <span class="match-score ${i % 3 === 0 ? '' : i % 3 === 1 ? 'medium' : 'low'}">${95 - i * 5}%</span>
                    <span class="category-badge ${['vsam', 'batch', 'jcl', 'db2'][i % 4]}">${['VSAM', 'Batch', 'JCL', 'DB2'][i % 4]}</span>
                  </div>
                </div>
                <p class="result-problem">This is a sample problem description for result item ${i + 1}. It demonstrates how the results list handles multiple entries.</p>
                <div class="result-tags">
                  <span class="tag">tag${i + 1}</span>
                  <span class="tag">sample</span>
                  <span class="tag">test</span>
                </div>
                <div class="result-stats">
                  <div class="usage-stats">
                    <span>Used: ${Math.floor(Math.random() * 100) + 10} times</span>
                    <span>Success: ${Math.floor(Math.random() * 50) + 40}/50</span>
                  </div>
                  <span class="success-rate ${i % 3 === 0 ? 'high' : i % 3 === 1 ? 'medium' : 'low'}">${90 - i * 2}% success rate</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </body>
      </html>
    `);

    await helpers.preparePage({ disableAnimations: false }); // Keep some animations for loading states
  });

  test('ResultsList - With Results', async ({ page }) => {
    const resultsList = page.locator('#results-with-data');
    await VisualTestMatchers.compareWithTolerance(resultsList, 'resultslist-with-data');
  });

  test('ResultsList - Empty State', async ({ page }) => {
    const emptyState = page.locator('#results-empty');
    await VisualTestMatchers.compareWithTolerance(emptyState, 'resultslist-empty');
  });

  test('ResultsList - Loading State', async ({ page }) => {
    const loadingState = page.locator('#results-loading');
    await VisualTestMatchers.compareWithTolerance(loadingState, 'resultslist-loading');
  });

  test('ResultsList - Single Result Item', async ({ page }) => {
    const singleResult = page.locator('#single-result');
    await VisualTestMatchers.compareWithTolerance(singleResult, 'resultslist-single-item');
  });

  test('ResultsList - Long List with Scrolling', async ({ page }) => {
    const longResults = page.locator('#long-results');
    await VisualTestMatchers.compareWithTolerance(longResults, 'resultslist-long-list');

    // Test scrolled state
    await page.evaluate(() => {
      const longResultsEl = document.getElementById('long-results');
      if (longResultsEl) longResultsEl.scrollTop = 200;
    });
    await page.waitForTimeout(100);
    await VisualTestMatchers.compareWithTolerance(longResults, 'resultslist-scrolled');
  });

  test('ResultsList - Item Hover State', async ({ page }) => {
    const firstItem = page.locator('#results-with-data .result-item').first();
    await firstItem.hover();
    await page.waitForTimeout(200);
    await VisualTestMatchers.compareWithTolerance(firstItem, 'resultslist-item-hover');
  });

  test('ResultsList - Item Selected State', async ({ page }) => {
    const selectedItem = page.locator('#results-with-data .result-item.selected');
    await VisualTestMatchers.compareWithTolerance(selectedItem, 'resultslist-item-selected');
  });

  test('ResultsList - Component States Suite', async ({ page }) => {
    const resultsList = page.locator('#results-with-data');

    await factory.createComponentSuite('resultslist', resultsList, {
      states: [
        {}, // default
        { loading: true },
        { error: 'Failed to load results' }
      ]
    });
  });

  test('ResultsList - Responsive Design', async ({ page }) => {
    const resultsList = page.locator('#results-with-data');

    await helpers.testResponsive('resultslist-responsive', resultsList, [
      { viewport: 'mobile' },
      { viewport: 'tablet' },
      { viewport: 'desktop' }
    ]);
  });

  test('ResultsList - Theme Variations', async ({ page }) => {
    const resultsList = page.locator('#results-with-data');

    await helpers.testThemes('resultslist-themes', resultsList, [
      'light',
      'dark'
    ]);
  });

  test('ResultsList - Different Score Ranges', async ({ page }) => {
    // Create results with different match scores
    await page.setContent(`
      <div class="results-list">
        <div class="result-item">
          <div class="result-header">
            <h3 class="result-title">High Match Score</h3>
            <div class="result-metadata">
              <span class="match-score">95%</span>
              <span class="category-badge vsam">VSAM</span>
            </div>
          </div>
        </div>
        <div class="result-item">
          <div class="result-header">
            <h3 class="result-title">Medium Match Score</h3>
            <div class="result-metadata">
              <span class="match-score medium">75%</span>
              <span class="category-badge batch">Batch</span>
            </div>
          </div>
        </div>
        <div class="result-item">
          <div class="result-header">
            <h3 class="result-title">Low Match Score</h3>
            <div class="result-metadata">
              <span class="match-score low">45%</span>
              <span class="category-badge jcl">JCL</span>
            </div>
          </div>
        </div>
      </div>
    `);

    const scoresList = page.locator('.results-list');
    await VisualTestMatchers.compareWithTolerance(scoresList, 'resultslist-score-ranges');
  });

  test('ResultsList - Category Badge Variations', async ({ page }) => {
    // Test all category badge styles
    await page.setContent(`
      <div class="results-list">
        ${['vsam', 'batch', 'jcl', 'db2'].map((category, index) => `
          <div class="result-item">
            <div class="result-header">
              <h3 class="result-title">${category.toUpperCase()} Category Test</h3>
              <div class="result-metadata">
                <span class="category-badge ${category}">${category.toUpperCase()}</span>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `);

    const categoriesList = page.locator('.results-list');
    await VisualTestMatchers.compareWithTolerance(categoriesList, 'resultslist-category-badges');
  });

  test('ResultsList - Text Overflow and Truncation', async ({ page }) => {
    await page.setContent(`
      <div class="results-list" style="width: 400px;">
        <div class="result-item">
          <div class="result-header">
            <h3 class="result-title">Very Long Title That Should Wrap Properly When Container Width Is Limited</h3>
            <div class="result-metadata">
              <span class="match-score">88%</span>
              <span class="category-badge">CATEGORY</span>
            </div>
          </div>
          <p class="result-problem">This is a very long problem description that should demonstrate how text is handled when it exceeds the available space in the container. It should wrap properly and maintain readability while not breaking the layout. The text should be truncated with ellipsis when it exceeds the maximum number of lines allowed.</p>
          <div class="result-tags">
            <span class="tag">very-long-tag-name</span>
            <span class="tag">another-long-tag</span>
            <span class="tag">short</span>
            <span class="tag">medium-length</span>
            <span class="tag">extra-long-tag-that-might-wrap</span>
          </div>
        </div>
      </div>
    `);

    const truncationTest = page.locator('.results-list');
    await VisualTestMatchers.compareWithTolerance(truncationTest, 'resultslist-text-overflow');
  });

  test('ResultsList - Accessibility Visual Features', async ({ page }) => {
    const resultsList = page.locator('#results-with-data');

    // Test focus states
    const firstItem = resultsList.locator('.result-item').first();
    await firstItem.focus();
    await page.waitForTimeout(100);
    await VisualTestMatchers.compareWithTolerance(resultsList, 'resultslist-accessibility-focus');

    // Test high contrast mode
    await page.evaluate(() => {
      document.documentElement.className = 'theme-high-contrast';
    });
    await page.waitForTimeout(300);
    await VisualTestMatchers.compareWithTolerance(resultsList, 'resultslist-accessibility-high-contrast');
  });
});

// Cross-browser visual consistency test
test.describe('ResultsList Cross-Browser Visual Tests', () => {
  test('ResultsList renders consistently across browsers', async ({ page, browserName }) => {
    await page.setContent(`
      <div style="padding: 20px; background: white; width: 600px;">
        <div class="result-item" style="
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          padding: 1rem;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
        ">
          <div style="display: flex; justify-content: space-between;">
            <h3 style="margin: 0; font-size: 1.1rem; font-weight: 600;">Cross-browser Test Result</h3>
            <span style="background: #10b981; color: white; padding: 0.125rem 0.5rem; border-radius: 12px; font-size: 0.75rem;">95%</span>
          </div>
          <p style="color: #6b7280; margin: 0;">Test description for cross-browser compatibility.</p>
        </div>
      </div>
    `);

    const resultItem = page.locator('.result-item');
    await VisualTestMatchers.compareWithTolerance(
      resultItem,
      `cross-browser-resultslist-${browserName}`
    );
  });
});