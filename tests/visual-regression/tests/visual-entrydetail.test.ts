/**
 * Visual Regression Tests - EntryDetail Component
 * Comprehensive visual testing for knowledge base entry detail view
 */

import { test, expect } from '@playwright/test';
import { VisualTestHelpers, ComponentTestFactory, VisualTestMatchers } from '../utils/visual-test-helpers';
import mockKBData from '../fixtures/mock-kb-data.json';

test.describe('EntryDetail Visual Regression', () => {
  let helpers: VisualTestHelpers;
  let factory: ComponentTestFactory;

  test.beforeEach(async ({ page }) => {
    helpers = new VisualTestHelpers(page);
    factory = new ComponentTestFactory(page);

    // Set up test page with EntryDetail component
    await page.setContent(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>EntryDetail Visual Tests</title>
        <style>
          body {
            margin: 0;
            padding: 20px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background-color: #f5f5f5;
            line-height: 1.6;
          }

          .test-container {
            background: white;
            padding: 2rem;
            border-radius: 8px;
            margin-bottom: 2rem;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }

          .entry-detail {
            max-width: 800px;
            margin: 0 auto;
          }

          .entry-header {
            border-bottom: 2px solid #e5e7eb;
            padding-bottom: 1.5rem;
            margin-bottom: 2rem;
          }

          .entry-title {
            font-size: 1.75rem;
            font-weight: 700;
            color: #1f2937;
            margin: 0 0 1rem 0;
            line-height: 1.3;
          }

          .entry-metadata {
            display: flex;
            flex-wrap: wrap;
            gap: 1rem;
            align-items: center;
            margin-bottom: 1rem;
          }

          .category-badge {
            background: #e5e7eb;
            color: #374151;
            padding: 0.25rem 0.75rem;
            border-radius: 6px;
            font-size: 0.875rem;
            font-weight: 600;
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

          .entry-stats {
            display: flex;
            gap: 2rem;
            font-size: 0.875rem;
            color: #6b7280;
          }

          .stat-item {
            display: flex;
            align-items: center;
            gap: 0.5rem;
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

          .entry-tags {
            display: flex;
            flex-wrap: wrap;
            gap: 0.5rem;
            margin-top: 1rem;
          }

          .tag {
            background: #f3f4f6;
            color: #374151;
            padding: 0.25rem 0.5rem;
            border-radius: 6px;
            font-size: 0.75rem;
            font-weight: 500;
            border: 1px solid #e5e7eb;
          }

          .entry-content {
            display: grid;
            gap: 2rem;
          }

          .content-section {
            background: #f9fafb;
            padding: 1.5rem;
            border-radius: 8px;
            border-left: 4px solid #3b82f6;
          }

          .content-section.problem {
            border-left-color: #ef4444;
          }

          .content-section.solution {
            border-left-color: #10b981;
          }

          .section-title {
            font-size: 1.125rem;
            font-weight: 600;
            color: #1f2937;
            margin: 0 0 1rem 0;
            display: flex;
            align-items: center;
            gap: 0.5rem;
          }

          .section-content {
            color: #374151;
            line-height: 1.7;
            margin: 0;
          }

          .section-content pre {
            background: #f3f4f6;
            padding: 1rem;
            border-radius: 6px;
            overflow-x: auto;
            font-family: 'Courier New', monospace;
            font-size: 0.875rem;
            border: 1px solid #e5e7eb;
            margin: 1rem 0;
          }

          .section-content code {
            background: #f3f4f6;
            padding: 0.125rem 0.25rem;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
            font-size: 0.875rem;
            color: #1f2937;
          }

          .section-content ol, .section-content ul {
            padding-left: 1.5rem;
            margin: 1rem 0;
          }

          .section-content li {
            margin-bottom: 0.5rem;
          }

          .entry-actions {
            display: flex;
            gap: 1rem;
            margin-top: 2rem;
            padding-top: 2rem;
            border-top: 1px solid #e5e7eb;
            flex-wrap: wrap;
          }

          .action-button {
            padding: 0.75rem 1.5rem;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            background: white;
            color: #374151;
            font-size: 0.875rem;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.15s ease;
            display: flex;
            align-items: center;
            gap: 0.5rem;
          }

          .action-button:hover {
            background: #f9fafb;
            border-color: #9ca3af;
          }

          .action-button.primary {
            background: #3b82f6;
            border-color: #3b82f6;
            color: white;
          }

          .action-button.primary:hover {
            background: #2563eb;
            border-color: #2563eb;
          }

          .action-button.success {
            background: #10b981;
            border-color: #10b981;
            color: white;
          }

          .action-button.danger {
            background: #ef4444;
            border-color: #ef4444;
            color: white;
          }

          .feedback-section {
            background: #f0f9ff;
            border: 1px solid #bae6fd;
            border-radius: 8px;
            padding: 1.5rem;
            margin-top: 2rem;
          }

          .feedback-title {
            font-size: 1rem;
            font-weight: 600;
            color: #0369a1;
            margin: 0 0 1rem 0;
          }

          .feedback-buttons {
            display: flex;
            gap: 1rem;
          }

          .feedback-button {
            padding: 0.5rem 1rem;
            border: 1px solid #0369a1;
            border-radius: 6px;
            background: white;
            color: #0369a1;
            font-size: 0.875rem;
            cursor: pointer;
            transition: all 0.15s ease;
          }

          .feedback-button.selected {
            background: #0369a1;
            color: white;
          }

          .feedback-button:hover:not(.selected) {
            background: #f0f9ff;
          }

          .additional-info {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 1rem;
            margin-top: 2rem;
          }

          .info-card {
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 1rem;
          }

          .info-card-title {
            font-size: 0.875rem;
            font-weight: 600;
            color: #6b7280;
            margin: 0 0 0.5rem 0;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }

          .info-card-content {
            font-size: 0.875rem;
            color: #374151;
            margin: 0;
          }

          /* Loading state */
          .entry-loading {
            padding: 3rem;
            text-align: center;
          }

          .loading-spinner {
            display: inline-block;
            width: 2rem;
            height: 2rem;
            border: 3px solid #e5e7eb;
            border-radius: 50%;
            border-top-color: #3b82f6;
            animation: spin 1s ease-in-out infinite;
            margin-bottom: 1rem;
          }

          @keyframes spin {
            to { transform: rotate(360deg); }
          }

          /* Error state */
          .entry-error {
            background: #fef2f2;
            border: 1px solid #fecaca;
            border-radius: 8px;
            padding: 2rem;
            text-align: center;
            color: #dc2626;
          }

          .error-icon {
            font-size: 3rem;
            margin-bottom: 1rem;
          }

          .error-title {
            font-size: 1.25rem;
            font-weight: 600;
            margin: 0 0 0.5rem 0;
          }

          .error-message {
            font-size: 0.875rem;
            margin: 0;
          }

          /* Theme variations */
          .theme-dark {
            background-color: #1f2937;
            color: #f9fafb;
          }

          .theme-dark .test-container {
            background: #374151;
          }

          .theme-dark .entry-title {
            color: #f9fafb;
          }

          .theme-dark .content-section {
            background: #4b5563;
            color: #f9fafb;
          }

          .theme-dark .section-content pre,
          .theme-dark .section-content code {
            background: #6b7280;
            color: #f9fafb;
          }

          .theme-dark .action-button {
            background: #4b5563;
            border-color: #6b7280;
            color: #f9fafb;
          }

          .theme-dark .action-button:hover {
            background: #6b7280;
          }

          /* Responsive styles */
          @media (max-width: 768px) {
            .entry-metadata {
              flex-direction: column;
              align-items: flex-start;
              gap: 0.5rem;
            }

            .entry-stats {
              flex-direction: column;
              gap: 0.5rem;
            }

            .entry-actions {
              flex-direction: column;
            }

            .action-button {
              justify-content: center;
            }

            .additional-info {
              grid-template-columns: 1fr;
            }
          }
        </style>
      </head>
      <body>
        <!-- Complete Entry Detail -->
        <div class="test-container">
          <h2>Entry Detail - Complete View</h2>
          <div class="entry-detail" id="entry-complete">
            <div class="entry-header">
              <h1 class="entry-title">VSAM Status 35 - File Not Found</h1>
              <div class="entry-metadata">
                <span class="category-badge vsam">VSAM</span>
                <div class="entry-stats">
                  <div class="stat-item">
                    <span>📊</span>
                    <span>Used: 42 times</span>
                  </div>
                  <div class="stat-item">
                    <span>✅</span>
                    <span class="success-rate high">90% success rate</span>
                  </div>
                  <div class="stat-item">
                    <span>📅</span>
                    <span>Updated: 2 days ago</span>
                  </div>
                </div>
              </div>
              <div class="entry-tags">
                <span class="tag">vsam</span>
                <span class="tag">status-35</span>
                <span class="tag">file-not-found</span>
                <span class="tag">catalog</span>
                <span class="tag">open-error</span>
              </div>
            </div>

            <div class="entry-content">
              <div class="content-section problem">
                <h2 class="section-title">
                  <span>❌</span>
                  Problem Description
                </h2>
                <div class="section-content">
                  <p>Job abends with VSAM status code 35. The program cannot open the VSAM file.</p>
                  <p>This error typically occurs when:</p>
                  <ul>
                    <li>The dataset does not exist in the catalog</li>
                    <li>The DD statement points to an incorrect dataset name</li>
                    <li>RACF permissions are insufficient</li>
                    <li>The file was deleted or renamed</li>
                  </ul>
                  <p>Error message example:</p>
                  <pre>IGZ0037W  THE VSAM OPEN FOR DDNAME "INPUTDD" ENDED
  WITH A RETURN CODE OF 08 AND ERROR CODE OF 35</pre>
                </div>
              </div>

              <div class="content-section solution">
                <h2 class="section-title">
                  <span>✅</span>
                  Solution Steps
                </h2>
                <div class="section-content">
                  <ol>
                    <li><strong>Verify the dataset exists:</strong>
                      <pre>LISTCAT ENTRIES('dataset.name') ALL</pre>
                      Or use ISPF option 3.4 to browse datasets.
                    </li>
                    <li><strong>Check the DD statement in JCL:</strong>
                      <code>//INPUTDD  DD DSN=correct.dataset.name,DISP=SHR</code>
                    </li>
                    <li><strong>Ensure file is cataloged properly:</strong>
                      If uncataloged, add <code>UNIT=</code> and <code>VOL=SER=</code> parameters.
                    </li>
                    <li><strong>Verify RACF permissions:</strong>
                      <pre>LISTDSD DATASET('dataset.name')</pre>
                      Contact security team if access is denied.
                    </li>
                    <li><strong>Check if file was deleted:</strong>
                      Look in recent batch job logs for deletion activities.
                    </li>
                  </ol>
                  <p><strong>Prevention:</strong> Use proper naming conventions and implement dataset retention policies.</p>
                </div>
              </div>
            </div>

            <div class="additional-info">
              <div class="info-card">
                <div class="info-card-title">Related Errors</div>
                <div class="info-card-content">
                  VSAM Status 37, IEF212I, IGZ0037W
                </div>
              </div>
              <div class="info-card">
                <div class="info-card-title">Component</div>
                <div class="info-card-content">
                  VSAM Access Method
                </div>
              </div>
              <div class="info-card-title">Severity</div>
                <div class="info-card-content">
                  High - Job Failure
                </div>
              </div>
              <div class="info-card">
                <div class="info-card-title">Resolution Time</div>
                <div class="info-card-content">
                  Usually < 15 minutes
                </div>
              </div>
            </div>

            <div class="entry-actions">
              <button class="action-button primary">
                <span>📋</span>
                Copy Solution
              </button>
              <button class="action-button">
                <span>🔗</span>
                Share Link
              </button>
              <button class="action-button">
                <span>✏️</span>
                Edit Entry
              </button>
              <button class="action-button">
                <span>📄</span>
                Print
              </button>
            </div>

            <div class="feedback-section">
              <div class="feedback-title">Was this solution helpful?</div>
              <div class="feedback-buttons">
                <button class="feedback-button">👍 Yes, it worked</button>
                <button class="feedback-button">👎 No, didn't help</button>
                <button class="feedback-button">💬 Add comment</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Loading State -->
        <div class="test-container">
          <h2>Entry Detail - Loading State</h2>
          <div class="entry-loading" id="entry-loading">
            <div class="loading-spinner"></div>
            <div>Loading entry details...</div>
          </div>
        </div>

        <!-- Error State -->
        <div class="test-container">
          <h2>Entry Detail - Error State</h2>
          <div class="entry-error" id="entry-error">
            <div class="error-icon">⚠️</div>
            <div class="error-title">Failed to Load Entry</div>
            <div class="error-message">
              The requested knowledge base entry could not be found or an error occurred while loading it.
            </div>
          </div>
        </div>

        <!-- Minimal Entry -->
        <div class="test-container">
          <h2>Entry Detail - Minimal Content</h2>
          <div class="entry-detail" id="entry-minimal">
            <div class="entry-header">
              <h1 class="entry-title">Quick Fix Entry</h1>
              <div class="entry-metadata">
                <span class="category-badge">Other</span>
                <div class="entry-stats">
                  <div class="stat-item">
                    <span>📊</span>
                    <span>Used: 3 times</span>
                  </div>
                  <div class="stat-item">
                    <span>✅</span>
                    <span class="success-rate medium">67% success rate</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="entry-content">
              <div class="content-section problem">
                <h2 class="section-title">
                  <span>❌</span>
                  Problem Description
                </h2>
                <div class="section-content">
                  <p>Simple problem with a quick fix.</p>
                </div>
              </div>

              <div class="content-section solution">
                <h2 class="section-title">
                  <span>✅</span>
                  Solution Steps
                </h2>
                <div class="section-content">
                  <p>Apply the fix and restart.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `);

    await helpers.preparePage({ disableAnimations: false }); // Keep animations for loading states
  });

  test('EntryDetail - Complete View', async ({ page }) => {
    const entryDetail = page.locator('#entry-complete');
    await VisualTestMatchers.compareWithTolerance(entryDetail, 'entrydetail-complete');
  });

  test('EntryDetail - Loading State', async ({ page }) => {
    const loadingState = page.locator('#entry-loading');
    await VisualTestMatchers.compareWithTolerance(loadingState, 'entrydetail-loading');
  });

  test('EntryDetail - Error State', async ({ page }) => {
    const errorState = page.locator('#entry-error');
    await VisualTestMatchers.compareWithTolerance(errorState, 'entrydetail-error');
  });

  test('EntryDetail - Minimal Content', async ({ page }) => {
    const minimalEntry = page.locator('#entry-minimal');
    await VisualTestMatchers.compareWithTolerance(minimalEntry, 'entrydetail-minimal');
  });

  test('EntryDetail - Action Button States', async ({ page }) => {
    const actionsSection = page.locator('#entry-complete .entry-actions');

    // Default state
    await VisualTestMatchers.compareWithTolerance(actionsSection, 'entrydetail-actions-default');

    // Hover state
    const primaryButton = actionsSection.locator('.action-button.primary');
    await primaryButton.hover();
    await page.waitForTimeout(200);
    await VisualTestMatchers.compareWithTolerance(actionsSection, 'entrydetail-actions-hover');

    // Focus state
    await primaryButton.focus();
    await page.waitForTimeout(100);
    await VisualTestMatchers.compareWithTolerance(actionsSection, 'entrydetail-actions-focus');
  });

  test('EntryDetail - Feedback Section Interaction', async ({ page }) => {
    const feedbackSection = page.locator('#entry-complete .feedback-section');

    // Default state
    await VisualTestMatchers.compareWithTolerance(feedbackSection, 'entrydetail-feedback-default');

    // Selected positive feedback
    const positiveButton = feedbackSection.locator('.feedback-button').first();
    await positiveButton.click();
    await page.evaluate(() => {
      const button = document.querySelector('.feedback-button');
      if (button) button.classList.add('selected');
    });
    await page.waitForTimeout(100);
    await VisualTestMatchers.compareWithTolerance(feedbackSection, 'entrydetail-feedback-positive');
  });

  test('EntryDetail - Component States Suite', async ({ page }) => {
    const entryDetail = page.locator('#entry-complete');

    await factory.createComponentSuite('entrydetail', entryDetail, {
      states: [
        {}, // default
        { loading: true },
        { error: 'Failed to load entry details' }
      ]
    });
  });

  test('EntryDetail - Responsive Design', async ({ page }) => {
    const entryDetail = page.locator('#entry-complete');

    await helpers.testResponsive('entrydetail-responsive', entryDetail, [
      { viewport: 'mobile' },
      { viewport: 'tablet' },
      { viewport: 'desktop' }
    ]);
  });

  test('EntryDetail - Theme Variations', async ({ page }) => {
    const entryDetail = page.locator('#entry-complete');

    await helpers.testThemes('entrydetail-themes', entryDetail, [
      'light',
      'dark'
    ]);
  });

  test('EntryDetail - Content Sections Focus', async ({ page }) => {
    const problemSection = page.locator('#entry-complete .content-section.problem');
    const solutionSection = page.locator('#entry-complete .content-section.solution');

    // Test individual sections
    await VisualTestMatchers.compareWithTolerance(problemSection, 'entrydetail-problem-section');
    await VisualTestMatchers.compareWithTolerance(solutionSection, 'entrydetail-solution-section');
  });

  test('EntryDetail - Code Block Rendering', async ({ page }) => {
    // Focus on code block rendering
    const codeBlocks = page.locator('#entry-complete pre, #entry-complete code');

    // Test first code block
    const firstCodeBlock = page.locator('#entry-complete pre').first();
    await VisualTestMatchers.compareWithTolerance(firstCodeBlock, 'entrydetail-code-block');
  });

  test('EntryDetail - Tags and Metadata', async ({ page }) => {
    const metadataSection = page.locator('#entry-complete .entry-metadata');
    const tagsSection = page.locator('#entry-complete .entry-tags');

    await VisualTestMatchers.compareWithTolerance(metadataSection, 'entrydetail-metadata');
    await VisualTestMatchers.compareWithTolerance(tagsSection, 'entrydetail-tags');
  });

  test('EntryDetail - Additional Info Cards', async ({ page }) => {
    const infoCards = page.locator('#entry-complete .additional-info');
    await VisualTestMatchers.compareWithTolerance(infoCards, 'entrydetail-info-cards');
  });

  test('EntryDetail - Long Content Scrolling', async ({ page }) => {
    // Create entry with very long content to test scrolling
    await page.setContent(`
      <div class="entry-detail" style="max-height: 600px; overflow-y: auto;">
        <div class="entry-header">
          <h1 class="entry-title">Long Content Entry</h1>
        </div>
        <div class="entry-content">
          <div class="content-section solution">
            <h2 class="section-title">Very Long Solution</h2>
            <div class="section-content">
              ${Array.from({ length: 20 }, (_, i) => `
                <p>Step ${i + 1}: This is a very detailed step that explains how to resolve the issue. It contains a lot of text to demonstrate how the component handles long content and scrolling behavior.</p>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    `);

    const longContent = page.locator('.entry-detail');
    await VisualTestMatchers.compareWithTolerance(longContent, 'entrydetail-long-content');

    // Test scrolled state
    await page.evaluate(() => {
      const entryDetail = document.querySelector('.entry-detail');
      if (entryDetail) entryDetail.scrollTop = 300;
    });
    await page.waitForTimeout(100);
    await VisualTestMatchers.compareWithTolerance(longContent, 'entrydetail-scrolled');
  });

  test('EntryDetail - Different Category Badges', async ({ page }) => {
    // Test all category badge variations
    const categories = ['vsam', 'batch', 'jcl', 'db2'];

    for (const category of categories) {
      await page.setContent(`
        <div class="entry-header">
          <h1 class="entry-title">${category.toUpperCase()} Test Entry</h1>
          <div class="entry-metadata">
            <span class="category-badge ${category}">${category.toUpperCase()}</span>
          </div>
        </div>
      `);

      const header = page.locator('.entry-header');
      await VisualTestMatchers.compareWithTolerance(header, `entrydetail-category-${category}`);
    }
  });

  test('EntryDetail - Success Rate Variations', async ({ page }) => {
    const successRates = [
      { rate: 95, class: 'high', text: '95% success rate' },
      { rate: 75, class: 'medium', text: '75% success rate' },
      { rate: 45, class: 'low', text: '45% success rate' }
    ];

    for (const { rate, class: rateClass, text } of successRates) {
      await page.setContent(`
        <div class="entry-stats">
          <div class="stat-item">
            <span>✅</span>
            <span class="success-rate ${rateClass}">${text}</span>
          </div>
        </div>
      `);

      const stats = page.locator('.entry-stats');
      await VisualTestMatchers.compareWithTolerance(stats, `entrydetail-success-rate-${rateClass}`);
    }
  });

  test('EntryDetail - Accessibility Visual Features', async ({ page }) => {
    const entryDetail = page.locator('#entry-complete');

    // Test focus on action buttons
    const firstActionButton = page.locator('#entry-complete .action-button').first();
    await firstActionButton.focus();
    await page.waitForTimeout(100);
    await VisualTestMatchers.compareWithTolerance(entryDetail, 'entrydetail-accessibility-focus');

    // Test high contrast mode
    await page.evaluate(() => {
      document.documentElement.className = 'theme-high-contrast';
    });
    await page.waitForTimeout(300);
    await VisualTestMatchers.compareWithTolerance(entryDetail, 'entrydetail-accessibility-high-contrast');
  });
});

// Cross-browser visual consistency test
test.describe('EntryDetail Cross-Browser Visual Tests', () => {
  test('EntryDetail renders consistently across browsers', async ({ page, browserName }) => {
    await page.setContent(`
      <div style="padding: 20px; background: white; max-width: 600px;">
        <div style="border-bottom: 2px solid #e5e7eb; padding-bottom: 1rem; margin-bottom: 1rem;">
          <h1 style="margin: 0 0 1rem 0; font-size: 1.5rem; font-weight: 700;">Cross-browser Test Entry</h1>
          <span style="background: #dbeafe; color: #1d4ed8; padding: 0.25rem 0.75rem; border-radius: 6px; font-size: 0.875rem;">VSAM</span>
        </div>
        <div style="background: #f9fafb; padding: 1.5rem; border-radius: 8px; border-left: 4px solid #10b981;">
          <h2 style="margin: 0 0 1rem 0; font-size: 1.125rem;">Solution</h2>
          <p style="margin: 0; line-height: 1.6;">Test solution content for cross-browser compatibility testing.</p>
        </div>
      </div>
    `);

    const entryDetail = page.locator('div').first();
    await VisualTestMatchers.compareWithTolerance(
      entryDetail,
      `cross-browser-entrydetail-${browserName}`
    );
  });
});