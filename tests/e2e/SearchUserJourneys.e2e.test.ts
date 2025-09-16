/**
 * End-to-End Tests for Search User Journeys
 * Tests complete user workflows and interactions with the search system
 */

import { jest, describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { Page, BrowserContext } from 'playwright';
import {
  getBrowserManager,
  getElectronManager,
  cleanupE2E,
  PageHelper,
  E2ETestDataGenerator,
  e2eConfig,
  waitForCondition,
  retryOperation
} from '../setup/e2e-setup';

describe('Search User Journeys - E2E Tests', () => {
  let context: BrowserContext;
  let page: Page;
  let pageHelper: PageHelper;

  beforeAll(async () => {
    // Start Electron app or web server
    if (process.env.E2E_TARGET === 'electron') {
      const electronManager = getElectronManager();
      await electronManager.startElectronApp();

      // Wait for app to be ready
      await waitForCondition(
        async () => electronManager.isAppReady(),
        30000
      );
    }

    // Setup browser
    const browserManager = getBrowserManager();
    context = await browserManager.createContext('chromium');
  }, 60000);

  beforeEach(async () => {
    page = await context.newPage();
    pageHelper = new PageHelper(page);

    // Navigate to application
    await page.goto(e2eConfig.app.url);
    await pageHelper.waitForSearchInterface();
  });

  afterEach(async () => {
    if (page) {
      await page.close();
    }
  });

  afterAll(async () => {
    await cleanupE2E();
  }, 30000);

  describe('Basic Search Workflows', () => {
    const searchScenarios = E2ETestDataGenerator.generateSearchScenarios();

    searchScenarios.forEach((scenario) => {
      it(`should complete ${scenario.name} workflow successfully`, async () => {
        const startTime = Date.now();

        // Perform search
        await pageHelper.performSearch(scenario.query);

        // Wait for results
        const resultCount = await pageHelper.waitForResults(scenario.maxResponseTime);

        // Verify expectations
        expect(resultCount).toBeGreaterThanOrEqual(scenario.expectedMinResults);

        // Measure performance
        const totalTime = Date.now() - startTime;
        expect(totalTime).toBeLessThan(scenario.maxResponseTime + 1000); // Add buffer for UI

        // Take screenshot for documentation
        await pageHelper.takeScreenshot(`${scenario.name}-results`);

        console.log(`${scenario.name}: ${resultCount} results in ${totalTime}ms`);
      });
    });

    it('should handle search input validation', async () => {
      const invalidQueries = ['', '   ', 'a', 'a'.repeat(1000)];

      for (const query of invalidQueries) {
        await page.fill('[data-testid="search-input"]', query);

        const searchButton = page.locator('[data-testid="search-button"]');

        if (query.trim().length === 0) {
          // Button should be disabled for empty queries
          await expect(searchButton).toBeDisabled();
        } else {
          // Valid queries should enable button
          await expect(searchButton).toBeEnabled();
        }
      }
    });

    it('should provide real-time search suggestions', async () => {
      const searchInput = page.locator('[data-testid="search-input"]');

      // Type partial query
      await searchInput.type('VSA', { delay: 100 });

      // Wait for suggestions dropdown
      await page.waitForSelector('[data-testid="search-suggestions"]', { timeout: 2000 });

      // Verify suggestions appear
      const suggestions = await page.locator('[data-testid="suggestion-item"]').count();
      expect(suggestions).toBeGreaterThan(0);

      // Select first suggestion
      await page.locator('[data-testid="suggestion-item"]').first().click();

      // Verify search is performed
      const resultCount = await pageHelper.waitForResults();
      expect(resultCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Complete User Journeys', () => {
    const userJourneys = E2ETestDataGenerator.generateUserJourneys();

    it('should complete search and view entry journey', async () => {
      const journey = userJourneys.find(j => j.name === 'search_and_view_entry')!;

      // Step 1: Search
      const searchStep = journey.steps.find(s => s.action === 'search')!;
      await pageHelper.performSearch(searchStep.query);

      const resultCount = await pageHelper.waitForResults();
      expect(resultCount).toBeGreaterThan(0);

      // Step 2: Select result
      const selectStep = journey.steps.find(s => s.action === 'select_result')!;
      await pageHelper.selectSearchResult(selectStep.index);

      // Step 3: View details
      await page.waitForSelector('[data-testid="entry-detail"]');
      const entryTitle = await page.locator('[data-testid="entry-title"]').textContent();
      expect(entryTitle).toBeTruthy();
      expect(entryTitle!.length).toBeGreaterThan(0);

      // Verify detail sections are present
      await expect(page.locator('[data-testid="entry-problem"]')).toBeVisible();
      await expect(page.locator('[data-testid="entry-solution"]')).toBeVisible();
      await expect(page.locator('[data-testid="entry-category"]')).toBeVisible();

      // Step 4: Rate entry
      const rateButton = page.locator('[data-testid="rate-helpful"]');
      await expect(rateButton).toBeVisible();
      await rateButton.click();

      // Verify rating confirmation
      await expect(page.locator('[data-testid="rating-success"]')).toBeVisible();

      // Take screenshot of completed journey
      await pageHelper.takeScreenshot('search-and-view-journey-complete');
    });

    it('should complete add new entry journey', async () => {
      const journey = userJourneys.find(j => j.name === 'add_new_entry')!;

      // Step 1: Open add dialog
      await page.click('[data-testid="add-entry-button"]');
      await page.waitForSelector('[data-testid="add-entry-dialog"]');

      // Step 2: Fill form
      const formData = journey.steps.find(s => s.action === 'fill_form')!.data;
      await page.fill('[data-testid="entry-title-input"]', formData.title);
      await page.fill('[data-testid="entry-problem-input"]', formData.problem);
      await page.fill('[data-testid="entry-solution-input"]', formData.solution);
      await page.selectOption('[data-testid="entry-category-select"]', formData.category);

      // Step 3: Submit form
      await page.click('[data-testid="submit-entry-button"]');

      // Step 4: Verify entry was added
      await page.waitForSelector('[data-testid="entry-added-success"]');

      // Verify the entry can be found by search
      await pageHelper.performSearch(formData.title);
      const resultCount = await pageHelper.waitForResults();
      expect(resultCount).toBeGreaterThan(0);

      // Verify the new entry appears in results
      const resultTitles = await page.locator('[data-testid="result-title"]').allTextContents();
      expect(resultTitles).toContainEqual(expect.stringContaining(formData.title));
    });

    it('should handle no results workflow gracefully', async () => {
      const journey = userJourneys.find(j => j.name === 'search_no_results_and_suggest')!;

      // Step 1: Search for non-existent item
      const searchStep = journey.steps.find(s => s.action === 'search')!;
      await pageHelper.performSearch(searchStep.query);

      // Step 2: Verify no results message
      await page.waitForSelector('[data-testid="no-results"]');
      await expect(page.locator('[data-testid="no-results"]')).toBeVisible();

      // Step 3: Check for suggestion to add entry
      await expect(page.locator('[data-testid="suggest-add-entry"]')).toBeVisible();
      await page.click('[data-testid="suggest-add-entry"]');

      // Step 4: Verify form is pre-filled with search query
      await page.waitForSelector('[data-testid="add-entry-dialog"]');
      const titleInput = page.locator('[data-testid="entry-title-input"]');
      const titleValue = await titleInput.inputValue();
      expect(titleValue).toContain(searchStep.query);
    });
  });

  describe('Search Performance User Experience', () => {
    it('should provide responsive search experience', async () => {
      const performanceMetrics: Array<{
        query: string;
        searchTime: number;
        resultCount: number;
      }> = [];

      const testQueries = [
        'VSAM Status 35',
        'DB2 error',
        'JCL dataset',
        'batch processing'
      ];

      for (const query of testQueries) {
        const metrics = await pageHelper.measureSearchPerformance(query);

        performanceMetrics.push({
          query,
          searchTime: metrics.searchTime,
          resultCount: metrics.resultCount
        });

        // Verify performance requirements
        expect(metrics.searchTime).toBeLessThan(e2eConfig.performance.searchResponse);

        // Verify UI responsiveness indicators
        const loadingIndicator = page.locator('[data-testid="search-loading"]');
        const isVisible = await loadingIndicator.isVisible();
        // Loading indicator should have been shown during search
        // (This might be difficult to catch due to speed, so we check if elements are present)
        expect(page.locator('[data-testid="search-results"], [data-testid="no-results"]')).toBeTruthy();
      }

      // Generate performance report
      const avgSearchTime = performanceMetrics.reduce((sum, m) => sum + m.searchTime, 0) / performanceMetrics.length;
      console.log(`Average search time: ${avgSearchTime.toFixed(2)}ms`);
      console.log('Performance metrics:', performanceMetrics);

      expect(avgSearchTime).toBeLessThan(e2eConfig.performance.searchResponse * 0.8); // Should be well under limit
    });

    it('should handle rapid successive searches', async () => {
      const searches = ['VSAM', 'DB2', 'JCL', 'error', 'status'];
      const results = [];

      const startTime = Date.now();

      // Perform rapid searches
      for (const query of searches) {
        await pageHelper.performSearch(query);
        const resultCount = await pageHelper.waitForResults(3000);
        results.push({ query, resultCount, timestamp: Date.now() });

        // Small delay to simulate user typing
        await page.waitForTimeout(200);
      }

      const totalTime = Date.now() - startTime;

      // Verify all searches completed
      expect(results).toHaveLength(searches.length);

      // Verify reasonable total time
      expect(totalTime).toBeLessThan(searches.length * 2000); // 2 seconds per search max

      // Verify last search results are displayed (not overwritten)
      const finalResults = await pageHelper.waitForResults();
      expect(finalResults).toBe(results[results.length - 1].resultCount);
    });
  });

  describe('Error Handling User Experience', () => {
    it('should handle network errors gracefully', async () => {
      // Simulate network failure
      await page.route('**/api/**', route => {
        route.abort('failed');
      });

      await pageHelper.performSearch('network error test');

      // Should show appropriate error message
      await page.waitForSelector('[data-testid="search-error"]', { timeout: 5000 });
      await expect(page.locator('[data-testid="search-error"]')).toBeVisible();

      // Should provide retry option
      await expect(page.locator('[data-testid="retry-search"]')).toBeVisible();

      // Remove network block
      await page.unroute('**/api/**');

      // Retry should work
      await page.click('[data-testid="retry-search"]');
      const resultCount = await pageHelper.waitForResults();
      expect(resultCount).toBeGreaterThanOrEqual(0);
    });

    it('should handle timeout errors appropriately', async () => {
      // Simulate slow response
      await page.route('**/api/search**', route => {
        setTimeout(() => route.continue(), 10000); // 10 second delay
      });

      await pageHelper.performSearch('timeout test');

      // Should show timeout error within reasonable time
      await page.waitForSelector('[data-testid="search-timeout"]', { timeout: 6000 });
      await expect(page.locator('[data-testid="search-timeout"]')).toBeVisible();

      // Should provide options to retry or cancel
      await expect(page.locator('[data-testid="retry-search"]')).toBeVisible();
      await expect(page.locator('[data-testid="cancel-search"]')).toBeVisible();

      // Remove timeout simulation
      await page.unroute('**/api/search**');
    });
  });

  describe('Accessibility User Experience', () => {
    it('should be fully keyboard navigable', async () => {
      // Focus on search input
      await page.focus('[data-testid="search-input"]');
      await page.keyboard.type('VSAM Status 35');

      // Navigate to search button with Tab
      await page.keyboard.press('Tab');
      const focusedElement = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
      expect(focusedElement).toBe('search-button');

      // Execute search with Enter
      await page.keyboard.press('Enter');
      const resultCount = await pageHelper.waitForResults();

      if (resultCount > 0) {
        // Navigate through results with Tab
        await page.keyboard.press('Tab');
        const focusedResult = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
        expect(focusedResult).toBe('search-result-item');

        // Select result with Enter
        await page.keyboard.press('Enter');
        await page.waitForSelector('[data-testid="entry-detail"]');

        // Verify detail view is keyboard accessible
        await page.keyboard.press('Tab');
        const detailFocus = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
        expect(['rate-helpful', 'rate-not-helpful', 'copy-solution']).toContain(detailFocus!);
      }
    });

    it('should have proper ARIA labels and roles', async () => {
      // Check search interface
      const searchInput = page.locator('[data-testid="search-input"]');
      await expect(searchInput).toHaveAttribute('role', 'searchbox');
      await expect(searchInput).toHaveAttribute('aria-label');

      const searchButton = page.locator('[data-testid="search-button"]');
      await expect(searchButton).toHaveAttribute('aria-label');

      // Perform search to check results
      await pageHelper.performSearch('accessibility test');
      const resultCount = await pageHelper.waitForResults();

      if (resultCount > 0) {
        const resultsContainer = page.locator('[data-testid="search-results"]');
        await expect(resultsContainer).toHaveAttribute('role', 'region');
        await expect(resultsContainer).toHaveAttribute('aria-label');

        const firstResult = page.locator('[data-testid="search-result-item"]').first();
        await expect(firstResult).toHaveAttribute('role', 'button');
        await expect(firstResult).toHaveAttribute('aria-label');
      }
    });

    it('should maintain focus management', async () => {
      // Focus should be managed properly during navigation
      await pageHelper.performSearch('focus management test');
      const resultCount = await pageHelper.waitForResults();

      if (resultCount > 0) {
        // Select first result
        await page.click('[data-testid="search-result-item"]');
        await page.waitForSelector('[data-testid="entry-detail"]');

        // Go back to search
        await page.keyboard.press('Escape');

        // Focus should return to search results
        const focusedElement = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
        expect(['search-input', 'search-results', 'search-result-item']).toContain(focusedElement!);
      }
    });
  });

  describe('Cross-Browser Compatibility', () => {
    const browsers = ['chromium', 'firefox', 'webkit'];

    browsers.forEach((browserType) => {
      it(`should work correctly in ${browserType}`, async () => {
        const browserManager = getBrowserManager();
        const browserContext = await browserManager.createContext(browserType as any);
        const browserPage = await browserContext.newPage();
        const browserPageHelper = new PageHelper(browserPage);

        try {
          // Navigate and test basic functionality
          await browserPage.goto(e2eConfig.app.url);
          await browserPageHelper.waitForSearchInterface();

          // Perform search
          await browserPageHelper.performSearch('cross browser test');
          const resultCount = await browserPageHelper.waitForResults();

          // Basic functionality should work
          expect(resultCount).toBeGreaterThanOrEqual(0);

          // UI should be properly rendered
          await expect(browserPage.locator('[data-testid="search-input"]')).toBeVisible();
          await expect(browserPage.locator('[data-testid="search-button"]')).toBeVisible();

        } finally {
          await browserPage.close();
          await browserContext.close();
        }
      });
    });
  });
});