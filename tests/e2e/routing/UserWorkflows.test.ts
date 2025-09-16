/**
 * E2E Tests for User Workflows
 * Tests complete user journeys through the KB routing system
 * Using Playwright for full browser automation
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';

// Test configuration
test.describe.configure({ mode: 'serial' });

class KBPage {
  constructor(private page: Page) {}

  // Navigation helpers
  async goToDashboard() {
    await this.page.goto('#/');
    await this.page.waitForSelector('[data-testid="dashboard"]', { timeout: 5000 });
  }

  async goToSearch(query?: string, category?: string) {
    let url = '#/search';
    const params = new URLSearchParams();
    
    if (query) {
      url += `/${encodeURIComponent(query)}`;
      params.set('q', query);
    }
    
    if (category) {
      params.set('category', category);
    }
    
    if (params.toString()) {
      url += `?${params.toString()}`;
    }
    
    await this.page.goto(url);
    await this.page.waitForSelector('[data-testid="search-interface"]');
  }

  async goToEntry(entryId: string) {
    await this.page.goto(`#/entry/${entryId}`);
    await this.page.waitForSelector('[data-testid="entry-detail"]');
  }

  // Search operations
  async performSearch(query: string) {
    await this.page.fill('[data-testid="search-input"]', query);
    await this.page.click('[data-testid="search-button"]');
    await this.page.waitForSelector('[data-testid="search-results"]');
  }

  async selectSearchResult(index: number = 0) {
    await this.page.click(`[data-testid="search-result-${index}"]`);
    await this.page.waitForSelector('[data-testid="entry-detail"]');
  }

  async applySearchFilter(category: string) {
    await this.page.selectOption('[data-testid="category-filter"]', category);
    await this.page.waitForSelector('[data-testid="search-results"]');
  }

  // Entry operations
  async addNewEntry() {
    await this.page.click('[data-testid="add-entry-button"]');
    await this.page.waitForSelector('[data-testid="entry-form"]');
  }

  async fillEntryForm(data: {
    title?: string;
    problem?: string;
    solution?: string;
    category?: string;
    tags?: string[];
  }) {
    if (data.title) {
      await this.page.fill('[data-testid="form-title"]', data.title);
    }
    
    if (data.problem) {
      await this.page.fill('[data-testid="form-problem"]', data.problem);
    }
    
    if (data.solution) {
      await this.page.fill('[data-testid="form-solution"]', data.solution);
    }
    
    if (data.category) {
      await this.page.selectOption('[data-testid="form-category"]', data.category);
    }
    
    if (data.tags) {
      await this.page.fill('[data-testid="form-tags"]', data.tags.join(', '));
    }
  }

  async submitEntryForm() {
    await this.page.click('[data-testid="form-submit"]');
    await this.page.waitForNavigation();
  }

  async editEntry() {
    await this.page.click('[data-testid="edit-entry-button"]');
    await this.page.waitForSelector('[data-testid="entry-form"]');
  }

  // Verification helpers
  async expectRoute(path: string) {
    const url = new URL(this.page.url());
    expect(url.hash.substring(1)).toBe(path);
  }

  async expectSearchResults(count?: number) {
    await this.page.waitForSelector('[data-testid="search-results"]');
    
    if (count !== undefined) {
      const results = await this.page.locator('[data-testid^="search-result-"]');
      await expect(results).toHaveCount(count);
    }
  }

  async expectEntryDetail(title?: string) {
    await this.page.waitForSelector('[data-testid="entry-detail"]');
    
    if (title) {
      await expect(this.page.locator('[data-testid="entry-title"]')).toHaveText(title);
    }
  }

  async expectURL(expectedURL: string) {
    const url = new URL(this.page.url());
    const actualPath = url.hash.substring(1) + url.search;
    expect(actualPath).toBe(expectedURL);
  }
}

test.describe('KB User Workflows', () => {
  let kbPage: KBPage;

  test.beforeEach(async ({ page }) => {
    kbPage = new KBPage(page);
    
    // Set up test data
    await page.goto('/');
    await page.evaluate(() => {
      // Mock initial data
      localStorage.setItem('kb-test-data', JSON.stringify([
        {
          id: 'test-entry-1',
          title: 'VSAM Status 35 Error',
          problem: 'File not found error',
          solution: 'Check catalog and file existence',
          category: 'VSAM',
          tags: ['vsam', 'error', 'status-35']
        },
        {
          id: 'test-entry-2', 
          title: 'JCL Syntax Error',
          problem: 'Job fails with syntax error',
          solution: 'Review JCL syntax and fix errors',
          category: 'JCL',
          tags: ['jcl', 'syntax', 'error']
        }
      ]));
    });
  });

  test('Complete search workflow', async () => {
    // Start at dashboard
    await kbPage.goToDashboard();
    await kbPage.expectRoute('/');

    // Navigate to search
    await kbPage.page.click('[data-testid="search-nav-button"]');
    await kbPage.expectRoute('/search');

    // Perform search
    await kbPage.performSearch('VSAM error');
    await kbPage.expectSearchResults();

    // Verify URL reflects search state
    await kbPage.expectURL('/search/VSAM%20error?q=VSAM%20error');

    // Select a result
    await kbPage.selectSearchResult(0);
    await kbPage.expectEntryDetail('VSAM Status 35 Error');
    
    // Verify URL includes return context
    const url = new URL(kbPage.page.url());
    expect(url.hash).toContain('/entry/test-entry-1');
    expect(url.searchParams.get('return_query')).toBe('VSAM error');
  });

  test('Search with filters workflow', async () => {
    await kbPage.goToSearch();

    // Apply category filter
    await kbPage.applySearchFilter('VSAM');
    
    // Verify URL includes filter
    await kbPage.expectURL('/search?category=VSAM');

    // Perform search with filter active
    await kbPage.performSearch('status');
    
    // URL should reflect both query and filter
    await kbPage.expectURL('/search/status?q=status&category=VSAM');
  });

  test('Add new entry workflow', async () => {
    await kbPage.goToSearch('DB2 connection');

    // Add new entry from search context
    await kbPage.addNewEntry();
    await kbPage.expectRoute('/add?related_query=DB2%20connection');

    // Fill form
    await kbPage.fillEntryForm({
      title: 'DB2 Connection Timeout',
      problem: 'Database connection times out',
      solution: 'Increase timeout settings',
      category: 'DB2',
      tags: ['db2', 'connection', 'timeout']
    });

    // Submit form
    await kbPage.submitEntryForm();
    
    // Should return to search with original query
    await kbPage.expectRoute('/search/DB2%20connection');
  });

  test('Edit entry workflow', async () => {
    await kbPage.goToEntry('test-entry-1');
    await kbPage.expectEntryDetail('VSAM Status 35 Error');

    // Edit entry
    await kbPage.editEntry();
    await kbPage.expectRoute('/entry/test-entry-1/edit');

    // Modify entry
    await kbPage.fillEntryForm({
      title: 'Updated VSAM Status 35 Error',
      solution: 'Updated solution with more details'
    });

    await kbPage.submitEntryForm();
    
    // Should return to entry detail
    await kbPage.expectRoute('/entry/test-entry-1');
    await kbPage.expectEntryDetail('Updated VSAM Status 35 Error');
  });

  test('Deep linking workflow', async () => {
    // Direct navigation to search with query
    await kbPage.goToSearch('JCL syntax', 'JCL');
    
    // Should perform search automatically
    await kbPage.expectSearchResults();
    await kbPage.expectURL('/search/JCL%20syntax?q=JCL%20syntax&category=JCL');

    // Direct navigation to entry
    await kbPage.goToEntry('test-entry-2');
    await kbPage.expectEntryDetail('JCL Syntax Error');
  });

  test('Browser navigation workflow', async ({ page }) => {
    await kbPage.goToDashboard();
    
    // Navigate through multiple routes
    await kbPage.goToSearch('test');
    await kbPage.goToEntry('test-entry-1');
    
    // Use browser back
    await page.goBack();
    await kbPage.expectRoute('/search/test');
    
    // Use browser forward
    await page.goForward();
    await kbPage.expectRoute('/entry/test-entry-1');
    
    // Use browser back multiple times
    await page.goBack();
    await page.goBack();
    await kbPage.expectRoute('/');
  });

  test('State preservation across routes', async () => {
    // Perform search
    await kbPage.goToSearch('VSAM');
    await kbPage.performSearch('VSAM error');
    
    // Navigate to entry
    await kbPage.selectSearchResult(0);
    
    // Navigate to metrics
    await kbPage.page.click('[data-testid="metrics-nav"]');
    await kbPage.expectRoute('/metrics');
    
    // Return to search - should preserve search state
    await kbPage.page.click('[data-testid="close-metrics"]');
    await kbPage.expectRoute('/search/VSAM%20error');
    await kbPage.expectSearchResults();
  });

  test('Error handling workflow', async () => {
    // Navigate to non-existent entry
    await kbPage.goToEntry('non-existent-id');
    
    // Should show error state
    await expect(kbPage.page.locator('[data-testid="entry-not-found"]')).toBeVisible();
    
    // Click return to search
    await kbPage.page.click('[data-testid="return-to-search"]');
    await kbPage.expectRoute('/search');
  });

  test('Mobile responsive navigation', async ({ page, context }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await kbPage.goToDashboard();
    
    // Mobile menu should be present
    await expect(page.locator('[data-testid="mobile-menu-toggle"]')).toBeVisible();
    
    // Open mobile menu
    await page.click('[data-testid="mobile-menu-toggle"]');
    await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible();
    
    // Navigate via mobile menu
    await page.click('[data-testid="mobile-search-link"]');
    await kbPage.expectRoute('/search');
    
    // Menu should close after navigation
    await expect(page.locator('[data-testid="mobile-menu"]')).not.toBeVisible();
  });
});

test.describe('Advanced User Workflows', () => {
  let kbPage: KBPage;

  test.beforeEach(async ({ page }) => {
    kbPage = new KBPage(page);
  });

  test('Multi-tab workflow', async ({ context }) => {
    // Open multiple tabs
    const page1 = await context.newPage();
    const page2 = await context.newPage();
    
    const kbPage1 = new KBPage(page1);
    const kbPage2 = new KBPage(page2);
    
    // Different workflows in each tab
    await kbPage1.goToSearch('VSAM');
    await kbPage2.goToSearch('JCL');
    
    // Verify independent state
    await kbPage1.expectURL('/search/VSAM?q=VSAM');
    await kbPage2.expectURL('/search/JCL?q=JCL');
    
    // Perform operations in parallel
    await Promise.all([
      kbPage1.performSearch('VSAM error'),
      kbPage2.performSearch('JCL syntax')
    ]);
    
    // Verify independent results
    await kbPage1.expectURL('/search/VSAM%20error?q=VSAM%20error');
    await kbPage2.expectURL('/search/JCL%20syntax?q=JCL%20syntax');
  });

  test('Keyboard navigation workflow', async ({ page }) => {
    await kbPage.goToSearch();
    
    // Focus search input with Tab
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="search-input"]')).toBeFocused();
    
    // Type search query
    await page.keyboard.type('VSAM');
    
    // Submit with Enter
    await page.keyboard.press('Enter');
    await kbPage.expectSearchResults();
    
    // Navigate results with arrow keys
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    
    // Select with Enter
    await page.keyboard.press('Enter');
    await kbPage.expectEntryDetail();
    
    // Go back with Escape
    await page.keyboard.press('Escape');
    await kbPage.expectRoute('/search/VSAM');
  });

  test('URL sharing and bookmarking', async ({ page, context }) => {
    // Navigate to specific search
    await kbPage.goToSearch('VSAM status 35', 'VSAM');
    
    // Get shareable URL
    const currentURL = page.url();
    
    // Open new tab with shared URL
    const newPage = await context.newPage();
    await newPage.goto(currentURL);
    
    const newKBPage = new KBPage(newPage);
    
    // Should restore same search state
    await newKBPage.expectURL('/search/VSAM%20status%2035?q=VSAM%20status%2035&category=VSAM');
    await newKBPage.expectSearchResults();
  });

  test('Performance with rapid navigation', async ({ page }) => {
    const startTime = Date.now();
    
    // Rapid navigation sequence
    await kbPage.goToDashboard();
    await kbPage.goToSearch();
    await kbPage.performSearch('test');
    await kbPage.selectSearchResult(0);
    await page.goBack();
    await page.goForward();
    await kbPage.page.click('[data-testid="edit-entry-button"]');
    await page.goBack();
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Should complete within reasonable time (5 seconds)
    expect(duration).toBeLessThan(5000);
    
    // Verify final state is correct
    await kbPage.expectEntryDetail();
  });

  test('Concurrent user simulation', async ({ context }) => {
    // Simulate multiple users
    const users = await Promise.all([
      context.newPage(),
      context.newPage(),
      context.newPage()
    ]);
    
    const kbPages = users.map(page => new KBPage(page));
    
    // Different search patterns
    const workflows = [
      async () => {
        await kbPages[0].goToSearch();
        await kbPages[0].performSearch('VSAM');
        await kbPages[0].selectSearchResult(0);
      },
      async () => {
        await kbPages[1].goToSearch();
        await kbPages[1].performSearch('JCL');
        await kbPages[1].addNewEntry();
      },
      async () => {
        await kbPages[2].goToDashboard();
        await kbPages[2].page.click('[data-testid="metrics-nav"]');
      }
    ];
    
    // Execute concurrently
    await Promise.all(workflows.map(workflow => workflow()));
    
    // Verify each user's final state
    await kbPages[0].expectEntryDetail();
    await kbPages[1].expectRoute('/add');
    await kbPages[2].expectRoute('/metrics');
  });
});

test.describe('Accessibility Workflows', () => {
  let kbPage: KBPage;

  test.beforeEach(async ({ page }) => {
    kbPage = new KBPage(page);
  });

  test('Screen reader navigation', async ({ page }) => {
    await kbPage.goToDashboard();
    
    // Check ARIA labels
    await expect(page.locator('[role="main"]')).toBeVisible();
    await expect(page.locator('[aria-label="Search knowledge base"]')).toBeVisible();
    
    // Navigate to search
    await kbPage.goToSearch();
    
    // Check search interface accessibility
    await expect(page.locator('[role="search"]')).toBeVisible();
    await expect(page.locator('[aria-label="Search results"]')).toBeVisible();
  });

  test('High contrast mode compatibility', async ({ page }) => {
    // Simulate high contrast mode
    await page.addStyleTag({
      content: `
        @media (prefers-contrast: high) {
          * { outline: 2px solid white !important; }
        }
      `
    });
    
    await kbPage.goToSearch();
    await kbPage.performSearch('test');
    
    // Verify elements are still visible and functional
    await kbPage.expectSearchResults();
    await expect(page.locator('[data-testid="search-input"]')).toBeVisible();
  });

  test('Reduced motion preference', async ({ page }) => {
    // Respect reduced motion
    await page.emulateMedia({ reducedMotion: 'reduce' });
    
    await kbPage.goToDashboard();
    await kbPage.goToSearch();
    
    // Navigation should still work without animations
    await kbPage.performSearch('test');
    await kbPage.expectSearchResults();
  });
});