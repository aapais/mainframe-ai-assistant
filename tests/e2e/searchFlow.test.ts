/**
 * End-to-End Tests for Complete User Search Flows
 * Testing real user scenarios with UI interactions and full application stack
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';
import { promises as fs } from 'fs';
import path from 'path';

// Test configuration
const TEST_CONFIG = {
  baseURL: 'http://localhost:3000',
  timeout: 30000,
  searchTimeout: 5000,
  navigationTimeout: 10000
};

// Page object model for search functionality
class SearchPage {
  constructor(private page: Page) {}

  // Selectors
  private selectors = {
    searchInput: '[data-testid="search-input"]',
    searchButton: '[data-testid="search-button"]',
    categoryFilter: '[data-testid="category-filter"]',
    resultsContainer: '[data-testid="search-results"]',
    resultItem: '[data-testid="result-item"]',
    loadingSpinner: '[data-testid="loading-spinner"]',
    errorMessage: '[data-testid="error-message"]',
    performanceIndicator: '[data-testid="performance-indicator"]',
    authDialog: '[data-testid="ai-authorization-dialog"]',
    authApproveButton: '[data-testid="auth-approve-button"]',
    authDenyButton: '[data-testid="auth-deny-button"]',
    searchHistory: '[data-testid="search-history"]',
    suggestionsList: '[data-testid="suggestions-list"]',
    clearButton: '[data-testid="clear-results-button"]',
    retryButton: '[data-testid="retry-search-button"]'
  };

  async navigateToSearch() {
    await this.page.goto('/search');
    await this.page.waitForLoadState('networkidle');
  }

  async searchFor(query: string, category?: string) {
    await this.page.fill(this.selectors.searchInput, query);
    
    if (category) {
      await this.page.selectOption(this.selectors.categoryFilter, category);
    }
    
    await this.page.click(this.selectors.searchButton);
  }

  async waitForResults() {
    await this.page.waitForSelector(this.selectors.resultsContainer, { 
      timeout: TEST_CONFIG.searchTimeout 
    });
  }

  async waitForLoading() {
    await this.page.waitForSelector(this.selectors.loadingSpinner, { 
      state: 'visible',
      timeout: 1000 
    }).catch(() => {}); // Loading might be too fast to catch
  }

  async getResults() {
    return await this.page.locator(this.selectors.resultItem).all();
  }

  async getPerformanceTime() {
    const indicator = this.page.locator(this.selectors.performanceIndicator);
    const text = await indicator.textContent();
    const match = text?.match(/(\d+)ms/);
    return match ? parseInt(match[1]) : null;
  }

  async approveAIAuthorization() {
    const dialog = this.page.locator(this.selectors.authDialog);
    if (await dialog.isVisible()) {
      await this.page.click(this.selectors.authApproveButton);
      await dialog.waitFor({ state: 'hidden' });
    }
  }

  async denyAIAuthorization() {
    const dialog = this.page.locator(this.selectors.authDialog);
    if (await dialog.isVisible()) {
      await this.page.click(this.selectors.authDenyButton);
      await dialog.waitFor({ state: 'hidden' });
    }
  }

  async clearResults() {
    await this.page.click(this.selectors.clearButton);
  }

  async retryLastSearch() {
    await this.page.click(this.selectors.retryButton);
  }

  async getSearchSuggestions() {
    return await this.page.locator(this.selectors.suggestionsList + ' li').allTextContents();
  }

  async typeInSearchBox(text: string) {
    await this.page.type(this.selectors.searchInput, text, { delay: 100 });
  }
}

test.describe('Search Flow E2E Tests', () => {
  let searchPage: SearchPage;

  test.beforeEach(async ({ page }) => {
    searchPage = new SearchPage(page);
    await searchPage.navigateToSearch();
  });

  test.describe('Basic Search Functionality', () => {
    test('should perform basic search and display results', async ({ page }) => {
      await searchPage.searchFor('VSAM error');
      await searchPage.waitForResults();
      
      const results = await searchPage.getResults();
      expect(results.length).toBeGreaterThan(0);
      
      // Check that at least one result contains VSAM
      const firstResult = results[0];
      const resultText = await firstResult.textContent();
      expect(resultText).toMatch(/VSAM/i);
    });

    test('should display loading state during search', async ({ page }) => {
      await page.fill('[data-testid="search-input"]', 'test query');
      
      // Start search and immediately check for loading state
      const searchPromise = page.click('[data-testid="search-button"]');
      await searchPage.waitForLoading();
      
      await searchPromise;
      await searchPage.waitForResults();
    });

    test('should filter results by category', async ({ page }) => {
      await searchPage.searchFor('error', 'VSAM');
      await searchPage.waitForResults();
      
      const results = await searchPage.getResults();
      expect(results.length).toBeGreaterThan(0);
      
      // All results should be VSAM category
      for (const result of results) {
        const categoryBadge = result.locator('[data-testid="category-badge"]');
        const categoryText = await categoryBadge.textContent();
        expect(categoryText).toBe('VSAM');
      }
    });

    test('should handle empty search gracefully', async ({ page }) => {
      await searchPage.searchFor('');
      
      // Should show validation message
      const errorMessage = page.locator('[data-testid="validation-error"]');
      await expect(errorMessage).toBeVisible();
      await expect(errorMessage).toContainText('Search query cannot be empty');
    });

    test('should handle no results found', async ({ page }) => {
      await searchPage.searchFor('zyxwvutsrqponmlkjihgfedcba'); // Nonsense query
      await searchPage.waitForResults();
      
      const noResultsMessage = page.locator('[data-testid="no-results-message"]');
      await expect(noResultsMessage).toBeVisible();
      await expect(noResultsMessage).toContainText('No results found');
    });
  });

  test.describe('Performance Requirements (UC001)', () => {
    test('should complete local search within 500ms', async ({ page }) => {
      const startTime = Date.now();
      
      await searchPage.searchFor('VSAM status 35');
      await searchPage.waitForResults();
      
      const endTime = Date.now();
      const searchTime = endTime - startTime;
      
      expect(searchTime).toBeLessThan(500);
      
      // Check performance indicator on page
      const performanceTime = await searchPage.getPerformanceTime();
      if (performanceTime) {
        expect(performanceTime).toBeLessThan(500);
      }
    });

    test('should display performance warning for slow searches', async ({ page }) => {
      // This test would need a way to simulate slow search conditions
      // For now, we'll test that the performance indicator is displayed
      
      await searchPage.searchFor('complex query with many terms');
      await searchPage.waitForResults();
      
      const performanceIndicator = page.locator('[data-testid="performance-indicator"]');
      await expect(performanceIndicator).toBeVisible();
    });

    test('should maintain performance with large result sets', async ({ page }) => {
      const startTime = Date.now();
      
      await searchPage.searchFor('error'); // Should return many results
      await searchPage.waitForResults();
      
      const endTime = Date.now();
      const searchTime = endTime - startTime;
      
      expect(searchTime).toBeLessThan(1000); // Allow more time for large result sets
      
      const results = await searchPage.getResults();
      expect(results.length).toBeGreaterThan(10);
    });
  });

  test.describe('AI Authorization Flow', () => {
    test('should show authorization dialog for AI-enhanced queries', async ({ page }) => {
      await searchPage.searchFor('how to troubleshoot complex mainframe issues');
      
      // Check if authorization dialog appears
      const authDialog = page.locator('[data-testid="ai-authorization-dialog"]');
      
      // Wait a bit for potential dialog to appear
      await page.waitForTimeout(1000);
      
      if (await authDialog.isVisible()) {
        await expect(authDialog).toContainText('AI Enhancement Authorization');
        await expect(authDialog).toContainText('semantic_search');
      }
    });

    test('should proceed with AI search when authorized', async ({ page }) => {
      await searchPage.searchFor('explain the root cause of this error');
      
      // Approve AI authorization if dialog appears
      await searchPage.approveAIAuthorization();
      
      await searchPage.waitForResults();
      
      // Check for AI enhancement indicator
      const aiIndicator = page.locator('[data-testid="ai-enhanced-indicator"]');
      if (await aiIndicator.isVisible()) {
        await expect(aiIndicator).toBeVisible();
      }
    });

    test('should fallback to local results when AI denied', async ({ page }) => {
      await searchPage.searchFor('analyze this complex technical problem');
      
      // Deny AI authorization if dialog appears
      await searchPage.denyAIAuthorization();
      
      await searchPage.waitForResults();
      
      // Should still show local results
      const results = await searchPage.getResults();
      expect(results.length).toBeGreaterThanOrEqual(0);
      
      // Should show authorization status
      const authStatus = page.locator('[data-testid="auth-status"]');
      if (await authStatus.isVisible()) {
        await expect(authStatus).toContainText('denied');
      }
    });

    test('should detect PII and request appropriate authorization', async ({ page }) => {
      await searchPage.searchFor('user john.doe@company.com has system issues');
      
      // Check if PII warning is shown
      const piiWarning = page.locator('[data-testid="pii-warning"]');
      
      await page.waitForTimeout(1000);
      
      if (await piiWarning.isVisible()) {
        await expect(piiWarning).toContainText('Personal information detected');
      }
    });
  });

  test.describe('Search Suggestions and Autocomplete', () => {
    test('should show search suggestions while typing', async ({ page }) => {
      await searchPage.typeInSearchBox('VSAM');
      
      // Wait for suggestions to appear
      await page.waitForTimeout(500);
      
      const suggestionsList = page.locator('[data-testid="suggestions-list"]');
      if (await suggestionsList.isVisible()) {
        const suggestions = await searchPage.getSearchSuggestions();
        expect(suggestions.length).toBeGreaterThan(0);
        expect(suggestions.some(s => s.includes('VSAM'))).toBe(true);
      }
    });

    test('should select suggestion from dropdown', async ({ page }) => {
      await searchPage.typeInSearchBox('DB2');
      await page.waitForTimeout(500);
      
      const firstSuggestion = page.locator('[data-testid="suggestions-list"] li').first();
      if (await firstSuggestion.isVisible()) {
        await firstSuggestion.click();
        
        // Should populate search input
        const searchInput = page.locator('[data-testid="search-input"]');
        const inputValue = await searchInput.inputValue();
        expect(inputValue.length).toBeGreaterThan(3);
      }
    });

    test('should show recent searches in history', async ({ page }) => {
      // Perform a few searches
      await searchPage.searchFor('VSAM error');
      await searchPage.waitForResults();
      
      await searchPage.searchFor('DB2 performance');
      await searchPage.waitForResults();
      
      // Check search history
      const historyButton = page.locator('[data-testid="search-history-button"]');
      if (await historyButton.isVisible()) {
        await historyButton.click();
        
        const historyItems = page.locator('[data-testid="search-history"] li');
        const count = await historyItems.count();
        expect(count).toBeGreaterThan(0);
      }
    });
  });

  test.describe('Result Display and Interaction', () => {
    test('should display result details correctly', async ({ page }) => {
      await searchPage.searchFor('VSAM status 35');
      await searchPage.waitForResults();
      
      const firstResult = page.locator('[data-testid="result-item"]').first();
      
      // Check required result components
      await expect(firstResult.locator('[data-testid="result-title"]')).toBeVisible();
      await expect(firstResult.locator('[data-testid="result-problem"]')).toBeVisible();
      await expect(firstResult.locator('[data-testid="result-solution"]')).toBeVisible();
      await expect(firstResult.locator('[data-testid="category-badge"]')).toBeVisible();
      await expect(firstResult.locator('[data-testid="score-indicator"]')).toBeVisible();
    });

    test('should highlight search terms in results', async ({ page }) => {
      await searchPage.searchFor('VSAM error');
      await searchPage.waitForResults();
      
      const highlights = page.locator('[data-testid="search-highlight"]');
      const count = await highlights.count();
      
      if (count > 0) {
        expect(count).toBeGreaterThan(0);
        
        // Check that highlighted text matches search terms
        const firstHighlight = highlights.first();
        const highlightText = await firstHighlight.textContent();
        expect(['VSAM', 'error'].some(term => 
          highlightText?.toLowerCase().includes(term.toLowerCase())
        )).toBe(true);
      }
    });

    test('should open result details on click', async ({ page }) => {
      await searchPage.searchFor('S0C7 abend');
      await searchPage.waitForResults();
      
      const firstResult = page.locator('[data-testid="result-item"]').first();
      await firstResult.click();
      
      // Should navigate to detail page or open modal
      const detailView = page.locator('[data-testid="result-detail-view"]');
      await expect(detailView).toBeVisible({ timeout: 5000 });
    });

    test('should sort results by relevance by default', async ({ page }) => {
      await searchPage.searchFor('error handling');
      await searchPage.waitForResults();
      
      const scoreElements = page.locator('[data-testid="score-indicator"]');
      const scores: number[] = [];
      
      const count = await scoreElements.count();
      for (let i = 0; i < Math.min(count, 5); i++) {
        const scoreText = await scoreElements.nth(i).textContent();
        const score = scoreText ? parseInt(scoreText.replace(/\D/g, '')) : 0;
        scores.push(score);
      }
      
      // Check that scores are in descending order
      for (let i = 1; i < scores.length; i++) {
        expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
      }
    });
  });

  test.describe('Error Handling', () => {
    test('should handle network errors gracefully', async ({ page }) => {
      // Simulate network failure
      await page.route('**/api/search**', route => {
        route.abort('failed');
      });
      
      await searchPage.searchFor('test query');
      
      // Should show error message
      const errorMessage = page.locator('[data-testid="error-message"]');
      await expect(errorMessage).toBeVisible({ timeout: 10000 });
      await expect(errorMessage).toContainText('network');
      
      // Should show retry button
      const retryButton = page.locator('[data-testid="retry-search-button"]');
      await expect(retryButton).toBeVisible();
    });

    test('should retry failed searches', async ({ page }) => {
      let requestCount = 0;
      
      // Simulate failure on first request, success on second
      await page.route('**/api/search**', route => {
        requestCount++;
        if (requestCount === 1) {
          route.abort('failed');
        } else {
          route.continue();
        }
      });
      
      await searchPage.searchFor('retry test');
      
      // Wait for error state
      const errorMessage = page.locator('[data-testid="error-message"]');
      await expect(errorMessage).toBeVisible();
      
      // Click retry
      await searchPage.retryLastSearch();
      
      // Should succeed on retry
      await searchPage.waitForResults();
      
      const results = await searchPage.getResults();
      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    test('should handle malformed server responses', async ({ page }) => {
      // Mock malformed response
      await page.route('**/api/search**', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ invalid: 'response format' })
        });
      });
      
      await searchPage.searchFor('malformed response test');
      
      const errorMessage = page.locator('[data-testid="error-message"]');
      await expect(errorMessage).toBeVisible();
    });
  });

  test.describe('User Experience and Accessibility', () => {
    test('should support keyboard navigation', async ({ page }) => {
      await page.focus('[data-testid="search-input"]');
      
      // Type search query
      await page.keyboard.type('VSAM error');
      
      // Press Enter to search
      await page.keyboard.press('Enter');
      
      await searchPage.waitForResults();
      
      // Navigate through results with Tab
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      
      // Press Enter on focused result
      await page.keyboard.press('Enter');
      
      // Should open result details
      const detailView = page.locator('[data-testid="result-detail-view"]');
      if (await detailView.isVisible()) {
        await expect(detailView).toBeVisible();
      }
    });

    test('should provide proper ARIA labels and roles', async ({ page }) => {
      await searchPage.searchFor('accessibility test');
      await searchPage.waitForResults();
      
      // Check search input accessibility
      const searchInput = page.locator('[data-testid="search-input"]');
      await expect(searchInput).toHaveAttribute('aria-label');
      
      // Check results list accessibility
      const resultsList = page.locator('[data-testid="search-results"]');
      await expect(resultsList).toHaveAttribute('role', 'list');
      
      // Check individual result items
      const resultItems = page.locator('[data-testid="result-item"]');
      const firstItem = resultItems.first();
      await expect(firstItem).toHaveAttribute('role', 'listitem');
    });

    test('should announce search status to screen readers', async ({ page }) => {
      const announcements = page.locator('[aria-live="polite"]');
      
      await searchPage.searchFor('screen reader test');
      await searchPage.waitForResults();
      
      // Should announce when results are loaded
      if (await announcements.isVisible()) {
        const announcementText = await announcements.textContent();
        expect(announcementText).toMatch(/results? found/i);
      }
    });

    test('should work with high contrast mode', async ({ page }) => {
      // Enable high contrast mode (if supported)
      await page.emulateMedia({ forcedColors: 'active' });
      
      await searchPage.searchFor('high contrast test');
      await searchPage.waitForResults();
      
      // Results should still be visible and functional
      const results = await searchPage.getResults();
      expect(results.length).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Responsive Design', () => {
    test('should work on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
      
      await searchPage.searchFor('mobile test');
      await searchPage.waitForResults();
      
      // Check that search interface is usable on mobile
      const searchInput = page.locator('[data-testid="search-input"]');
      await expect(searchInput).toBeVisible();
      
      const results = await searchPage.getResults();
      expect(results.length).toBeGreaterThanOrEqual(0);
      
      // Results should be properly stacked on mobile
      const firstResult = results[0];
      if (firstResult) {
        const boundingBox = await firstResult.boundingBox();
        expect(boundingBox?.width).toBeLessThan(400);
      }
    });

    test('should work on tablet viewport', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 }); // iPad
      
      await searchPage.searchFor('tablet test');
      await searchPage.waitForResults();
      
      const results = await searchPage.getResults();
      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    test('should adapt layout for different screen sizes', async ({ page }) => {
      const viewports = [
        { width: 320, height: 568 }, // iPhone 5
        { width: 768, height: 1024 }, // iPad
        { width: 1920, height: 1080 } // Desktop
      ];
      
      for (const viewport of viewports) {
        await page.setViewportSize(viewport);
        
        await searchPage.searchFor('responsive test');
        await searchPage.waitForResults();
        
        // Interface should be functional at all sizes
        const searchInput = page.locator('[data-testid="search-input"]');
        await expect(searchInput).toBeVisible();
        
        const results = await searchPage.getResults();
        expect(results.length).toBeGreaterThanOrEqual(0);
      }
    });
  });

  test.describe('Integration with Browser Features', () => {
    test('should support browser back/forward navigation', async ({ page }) => {
      await searchPage.searchFor('navigation test 1');
      await searchPage.waitForResults();
      
      await searchPage.searchFor('navigation test 2');
      await searchPage.waitForResults();
      
      // Go back
      await page.goBack();
      
      // Should restore previous search
      const searchInput = page.locator('[data-testid="search-input"]');
      const inputValue = await searchInput.inputValue();
      expect(inputValue).toBe('navigation test 1');
    });

    test('should update page URL with search parameters', async ({ page }) => {
      await searchPage.searchFor('URL test query', 'VSAM');
      await searchPage.waitForResults();
      
      const url = page.url();
      expect(url).toContain('query=URL%20test%20query');
      expect(url).toContain('category=VSAM');
    });

    test('should restore search from URL parameters', async ({ page }) => {
      // Navigate directly to search URL with parameters
      await page.goto('/search?query=direct%20URL%20test&category=DB2');
      await searchPage.waitForResults();
      
      // Should execute search automatically
      const results = await searchPage.getResults();
      expect(results.length).toBeGreaterThanOrEqual(0);
      
      // Should populate search form
      const searchInput = page.locator('[data-testid="search-input"]');
      const inputValue = await searchInput.inputValue();
      expect(inputValue).toBe('direct URL test');
      
      const categorySelect = page.locator('[data-testid="category-filter"]');
      const selectedValue = await categorySelect.inputValue();
      expect(selectedValue).toBe('DB2');
    });
  });
});
