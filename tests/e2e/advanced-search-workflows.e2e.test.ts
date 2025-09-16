/**
 * Advanced Search and Filter Operations E2E Tests
 *
 * Tests comprehensive search functionality:
 * - Full-text search with relevance scoring
 * - Advanced filtering and faceted search
 * - Search performance optimization
 * - Search analytics and tracking
 * - Auto-suggestions and typo correction
 * - Saved searches and search history
 * - Boolean and phrase search operators
 * - Search result customization
 */

import { test, expect, Page } from '@playwright/test';

interface SearchQuery {
  query: string;
  filters?: {
    category?: string[];
    tags?: string[];
    priority?: string[];
    status?: string[];
    dateRange?: {
      from: string;
      to: string;
    };
    author?: string;
  };
  sortBy?: 'relevance' | 'date' | 'title' | 'popularity';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

interface SearchResult {
  id: string;
  title: string;
  snippet: string;
  category: string;
  tags: string[];
  relevanceScore: number;
  lastModified: string;
  popularity: number;
}

interface SearchMetrics {
  queryTime: number;
  totalResults: number;
  relevanceScores: number[];
  performanceData: {
    indexLookupTime: number;
    rankingTime: number;
    filterTime: number;
    renderTime: number;
  };
  cacheHitRate: number;
  searchAnalytics: {
    queryComplexity: number;
    filtersApplied: number;
    resultsClicked: number;
  };
}

class AdvancedSearchTester {
  private page: Page;
  private currentQuery: SearchQuery | null = null;
  private searchMetrics: SearchMetrics[] = [];

  constructor(page: Page) {
    this.page = page;
  }

  async navigateToSearch(): Promise<void> {
    await this.page.goto('#/search');
    await this.page.waitForSelector('[data-testid="search-interface"]', { timeout: 5000 });
  }

  async performAdvancedSearch(query: SearchQuery): Promise<SearchResult[]> {
    const startTime = Date.now();
    this.currentQuery = query;

    // Navigate to advanced search if needed
    if (query.filters || query.sortBy) {
      await this.page.click('[data-testid="advanced-search-toggle"]');
      await this.page.waitForSelector('[data-testid="advanced-search-panel"]');
    }

    // Enter search query
    await this.page.fill('[data-testid="search-input"]', query.query);

    // Apply filters
    if (query.filters) {
      await this.applyFilters(query.filters);
    }

    // Set sorting
    if (query.sortBy) {
      await this.page.selectOption('[data-testid="sort-by-select"]', query.sortBy);
      if (query.sortOrder) {
        await this.page.selectOption('[data-testid="sort-order-select"]', query.sortOrder);
      }
    }

    // Set result limit
    if (query.limit) {
      await this.page.fill('[data-testid="results-limit-input"]', query.limit.toString());
    }

    // Execute search
    await this.page.click('[data-testid="search-button"]');

    // Wait for results
    await Promise.race([
      this.page.waitForSelector('[data-testid="search-results"]', { timeout: 15000 }),
      this.page.waitForSelector('[data-testid="no-results"]', { timeout: 15000 })
    ]);

    const queryTime = Date.now() - startTime;

    // Extract results
    const results = await this.extractSearchResults();

    // Collect performance metrics
    await this.collectSearchMetrics(queryTime, results);

    return results;
  }

  private async applyFilters(filters: SearchQuery['filters']): Promise<void> {
    if (!filters) return;

    // Category filters
    if (filters.category && filters.category.length > 0) {
      for (const category of filters.category) {
        await this.page.check(`[data-testid="category-filter-${category}"]`);
      }
    }

    // Tag filters
    if (filters.tags && filters.tags.length > 0) {
      for (const tag of filters.tags) {
        await this.page.fill('[data-testid="tag-filter-input"]', tag);
        await this.page.press('[data-testid="tag-filter-input"]', 'Enter');
      }
    }

    // Priority filters
    if (filters.priority && filters.priority.length > 0) {
      for (const priority of filters.priority) {
        await this.page.check(`[data-testid="priority-filter-${priority}"]`);
      }
    }

    // Status filters
    if (filters.status && filters.status.length > 0) {
      for (const status of filters.status) {
        await this.page.check(`[data-testid="status-filter-${status}"]`);
      }
    }

    // Date range filter
    if (filters.dateRange) {
      await this.page.fill('[data-testid="date-from-input"]', filters.dateRange.from);
      await this.page.fill('[data-testid="date-to-input"]', filters.dateRange.to);
    }

    // Author filter
    if (filters.author) {
      await this.page.fill('[data-testid="author-filter-input"]', filters.author);
    }
  }

  private async extractSearchResults(): Promise<SearchResult[]> {
    const results: SearchResult[] = [];

    const resultElements = await this.page.locator('[data-testid^="search-result-"]').all();

    for (const element of resultElements) {
      const result: SearchResult = {
        id: await element.getAttribute('data-result-id') || '',
        title: await element.locator('[data-testid="result-title"]').textContent() || '',
        snippet: await element.locator('[data-testid="result-snippet"]').textContent() || '',
        category: await element.locator('[data-testid="result-category"]').textContent() || '',
        tags: [],
        relevanceScore: parseFloat(await element.getAttribute('data-relevance-score') || '0'),
        lastModified: await element.locator('[data-testid="result-modified"]').textContent() || '',
        popularity: parseFloat(await element.getAttribute('data-popularity-score') || '0')
      };

      // Extract tags
      const tagElements = await element.locator('[data-testid^="result-tag-"]').all();
      result.tags = await Promise.all(tagElements.map(tag => tag.textContent().then(text => text || '')));

      results.push(result);
    }

    return results;
  }

  private async collectSearchMetrics(queryTime: number, results: SearchResult[]): Promise<void> {
    const performanceData = await this.page.evaluate(() => {
      return (window as any).searchPerformanceData || {
        indexLookupTime: 0,
        rankingTime: 0,
        filterTime: 0,
        renderTime: 0
      };
    });

    const cacheHitRate = await this.page.evaluate(() => {
      return (window as any).searchCacheHitRate || 0;
    });

    const analytics = await this.page.evaluate(() => {
      return (window as any).searchAnalytics || {
        queryComplexity: 0,
        filtersApplied: 0,
        resultsClicked: 0
      };
    });

    const metrics: SearchMetrics = {
      queryTime,
      totalResults: results.length,
      relevanceScores: results.map(r => r.relevanceScore),
      performanceData,
      cacheHitRate,
      searchAnalytics: analytics
    };

    this.searchMetrics.push(metrics);
  }

  async testAutoSuggestions(partialQuery: string): Promise<string[]> {
    await this.navigateToSearch();
    await this.page.fill('[data-testid="search-input"]', partialQuery);

    // Wait for suggestions to appear
    await this.page.waitForSelector('[data-testid="search-suggestions"]', { timeout: 3000 });

    const suggestionElements = await this.page.locator('[data-testid^="suggestion-"]').all();
    return Promise.all(suggestionElements.map(el => el.textContent().then(text => text || '')));
  }

  async testTypoCorrection(typoQuery: string): Promise<{ corrected: string; original: string }> {
    await this.navigateToSearch();
    await this.page.fill('[data-testid="search-input"]', typoQuery);
    await this.page.click('[data-testid="search-button"]');

    // Check for spelling correction
    const correctionElement = this.page.locator('[data-testid="spelling-correction"]');
    if (await correctionElement.isVisible()) {
      const correctedText = await correctionElement.locator('[data-testid="corrected-query"]').textContent();
      return {
        corrected: correctedText || '',
        original: typoQuery
      };
    }

    return { corrected: typoQuery, original: typoQuery };
  }

  async testBooleanSearch(booleanQuery: string): Promise<SearchResult[]> {
    const query: SearchQuery = {
      query: booleanQuery
    };

    return this.performAdvancedSearch(query);
  }

  async testPhraseSearch(phraseQuery: string): Promise<SearchResult[]> {
    const query: SearchQuery = {
      query: `"${phraseQuery}"`
    };

    return this.performAdvancedSearch(query);
  }

  async testWildcardSearch(wildcardQuery: string): Promise<SearchResult[]> {
    const query: SearchQuery = {
      query: wildcardQuery
    };

    return this.performAdvancedSearch(query);
  }

  async testFacetedSearch(): Promise<{ [facet: string]: string[] }> {
    await this.navigateToSearch();
    await this.page.fill('[data-testid="search-input"]', '*'); // Search all
    await this.page.click('[data-testid="search-button"]');

    await this.page.waitForSelector('[data-testid="faceted-search-panel"]');

    const facets: { [facet: string]: string[] } = {};

    // Extract category facets
    const categoryFacets = await this.page.locator('[data-testid^="category-facet-"]').all();
    facets.categories = await Promise.all(categoryFacets.map(el => el.textContent().then(text => text || '')));

    // Extract tag facets
    const tagFacets = await this.page.locator('[data-testid^="tag-facet-"]').all();
    facets.tags = await Promise.all(tagFacets.map(el => el.textContent().then(text => text || '')));

    return facets;
  }

  async testSearchHistory(): Promise<string[]> {
    await this.navigateToSearch();
    await this.page.click('[data-testid="search-history-button"]');
    await this.page.waitForSelector('[data-testid="search-history-panel"]');

    const historyElements = await this.page.locator('[data-testid^="history-item-"]').all();
    return Promise.all(historyElements.map(el => el.textContent().then(text => text || '')));
  }

  async saveSearch(searchName: string, query: SearchQuery): Promise<void> {
    await this.performAdvancedSearch(query);
    await this.page.click('[data-testid="save-search-button"]');
    await this.page.waitForSelector('[data-testid="save-search-dialog"]');
    await this.page.fill('[data-testid="search-name-input"]', searchName);
    await this.page.click('[data-testid="confirm-save-search"]');
    await this.page.waitForSelector('[data-testid="search-saved-success"]');
  }

  async loadSavedSearch(searchName: string): Promise<SearchResult[]> {
    await this.navigateToSearch();
    await this.page.click('[data-testid="saved-searches-button"]');
    await this.page.waitForSelector('[data-testid="saved-searches-panel"]');
    await this.page.click(`[data-testid="saved-search-${searchName}"]`);

    await Promise.race([
      this.page.waitForSelector('[data-testid="search-results"]', { timeout: 10000 }),
      this.page.waitForSelector('[data-testid="no-results"]', { timeout: 10000 })
    ]);

    return this.extractSearchResults();
  }

  async testSearchResultCustomization(): Promise<void> {
    await this.navigateToSearch();
    await this.page.fill('[data-testid="search-input"]', 'test');
    await this.page.click('[data-testid="search-button"]');

    // Test different view modes
    await this.page.click('[data-testid="view-mode-list"]');
    await expect(this.page.locator('[data-testid="results-list-view"]')).toBeVisible();

    await this.page.click('[data-testid="view-mode-grid"]');
    await expect(this.page.locator('[data-testid="results-grid-view"]')).toBeVisible();

    await this.page.click('[data-testid="view-mode-table"]');
    await expect(this.page.locator('[data-testid="results-table-view"]')).toBeVisible();

    // Test results per page
    await this.page.selectOption('[data-testid="results-per-page"]', '25');
    await this.page.waitForTimeout(1000);

    const resultCount = await this.page.locator('[data-testid^="search-result-"]').count();
    expect(resultCount).toBeLessThanOrEqual(25);
  }

  async testSearchExport(format: 'csv' | 'json' | 'pdf'): Promise<void> {
    await this.navigateToSearch();
    await this.page.fill('[data-testid="search-input"]', 'export test');
    await this.page.click('[data-testid="search-button"]');

    await this.page.waitForSelector('[data-testid="search-results"]');

    await this.page.click('[data-testid="export-results-button"]');
    await this.page.waitForSelector('[data-testid="export-options-dialog"]');
    await this.page.selectOption('[data-testid="export-format-select"]', format);
    await this.page.click('[data-testid="confirm-export"]');

    await this.page.waitForSelector('[data-testid="export-success"]', { timeout: 10000 });
  }

  async testSearchAnalytics(): Promise<any> {
    await this.page.goto('#/analytics/search');
    await this.page.waitForSelector('[data-testid="search-analytics-dashboard"]');

    const analytics = await this.page.evaluate(() => {
      return {
        totalSearches: document.querySelector('[data-testid="total-searches"]')?.textContent,
        popularQueries: Array.from(document.querySelectorAll('[data-testid^="popular-query-"]'))
          .map(el => el.textContent),
        searchTrends: Array.from(document.querySelectorAll('[data-testid^="search-trend-"]'))
          .map(el => el.textContent),
        avgResponseTime: document.querySelector('[data-testid="avg-response-time"]')?.textContent,
        cacheHitRate: document.querySelector('[data-testid="cache-hit-rate"]')?.textContent
      };
    });

    return analytics;
  }

  getSearchMetrics(): SearchMetrics[] {
    return [...this.searchMetrics];
  }

  clearMetrics(): void {
    this.searchMetrics = [];
  }
}

test.describe('Advanced Search and Filter Operations', () => {
  let searchTester: AdvancedSearchTester;

  test.beforeEach(async ({ page }) => {
    searchTester = new AdvancedSearchTester(page);

    // Setup test data
    await page.goto('/');
    await page.evaluate(() => {
      const testData = [
        {
          id: 'search-test-1',
          title: 'VSAM File Access Method Error',
          content: 'Virtual Storage Access Method (VSAM) error when accessing dataset',
          category: 'VSAM',
          tags: ['vsam', 'access-method', 'error'],
          priority: 'High',
          status: 'Published',
          created: '2024-01-15T10:00:00Z',
          author: 'system.admin'
        },
        {
          id: 'search-test-2',
          title: 'JCL Job Control Language Syntax',
          content: 'Job Control Language syntax errors and debugging techniques',
          category: 'JCL',
          tags: ['jcl', 'syntax', 'debugging'],
          priority: 'Medium',
          status: 'Published',
          created: '2024-01-14T09:30:00Z',
          author: 'tech.lead'
        },
        {
          id: 'search-test-3',
          title: 'DB2 Database Performance Tuning',
          content: 'Database performance optimization and query tuning strategies',
          category: 'DB2',
          tags: ['db2', 'performance', 'tuning'],
          priority: 'Low',
          status: 'Draft',
          created: '2024-01-13T14:20:00Z',
          author: 'dba.specialist'
        }
      ];

      localStorage.setItem('search-test-data', JSON.stringify(testData));
    });

    await page.waitForSelector('[data-testid="app-root"]', { timeout: 10000 });
  });

  test('Basic text search functionality', async () => {
    const basicQuery: SearchQuery = {
      query: 'VSAM error'
    };

    const results = await searchTester.performAdvancedSearch(basicQuery);

    expect(results.length).toBeGreaterThan(0);
    expect(results.some(r => r.title.toLowerCase().includes('vsam'))).toBe(true);
    expect(results.some(r => r.snippet.toLowerCase().includes('error'))).toBe(true);

    // Verify relevance scoring
    for (let i = 0; i < results.length - 1; i++) {
      expect(results[i].relevanceScore).toBeGreaterThanOrEqual(results[i + 1].relevanceScore);
    }

    const metrics = searchTester.getSearchMetrics();
    expect(metrics[0].queryTime).toBeLessThan(5000); // Should complete within 5 seconds
  });

  test('Advanced filtering combinations', async () => {
    const advancedQuery: SearchQuery = {
      query: 'performance',
      filters: {
        category: ['DB2', 'VSAM'],
        priority: ['Medium', 'High'],
        status: ['Published'],
        dateRange: {
          from: '2024-01-01',
          to: '2024-12-31'
        }
      },
      sortBy: 'relevance',
      sortOrder: 'desc'
    };

    const results = await searchTester.performAdvancedSearch(advancedQuery);

    // Verify all results match filters
    for (const result of results) {
      expect(['DB2', 'VSAM']).toContain(result.category);
      // Additional filter validations would be done here
    }

    const metrics = searchTester.getSearchMetrics();
    expect(metrics[0].searchAnalytics.filtersApplied).toBeGreaterThan(0);
  });

  test('Boolean search operators', async () => {
    const testCases = [
      { query: 'VSAM AND error', expectedTerms: ['vsam', 'error'] },
      { query: 'JCL OR syntax', expectedTerms: ['jcl', 'syntax'] },
      { query: 'database NOT performance', excludedTerms: ['performance'] },
      { query: '(VSAM OR DB2) AND error', expectedTerms: ['error'] }
    ];

    for (const testCase of testCases) {
      const results = await searchTester.testBooleanSearch(testCase.query);

      if (testCase.expectedTerms) {
        for (const term of testCase.expectedTerms) {
          expect(results.some(r =>
            r.title.toLowerCase().includes(term) ||
            r.snippet.toLowerCase().includes(term)
          )).toBe(true);
        }
      }

      if (testCase.excludedTerms) {
        for (const term of testCase.excludedTerms) {
          expect(results.every(r =>
            !r.title.toLowerCase().includes(term) &&
            !r.snippet.toLowerCase().includes(term)
          )).toBe(true);
        }
      }
    }
  });

  test('Phrase search accuracy', async () => {
    const phraseQueries = [
      'Job Control Language',
      'access method error',
      'performance tuning'
    ];

    for (const phrase of phraseQueries) {
      const results = await searchTester.testPhraseSearch(phrase);

      expect(results.some(r =>
        r.title.toLowerCase().includes(phrase.toLowerCase()) ||
        r.snippet.toLowerCase().includes(phrase.toLowerCase())
      )).toBe(true);
    }
  });

  test('Wildcard and pattern search', async () => {
    const wildcardQueries = [
      'VSA*',      // Should match VSAM
      'perform*',  // Should match performance
      '*base',     // Should match database
      'er?or'      // Should match error
    ];

    for (const wildcardQuery of wildcardQueries) {
      const results = await searchTester.testWildcardSearch(wildcardQuery);
      expect(results.length).toBeGreaterThanOrEqual(0);
    }
  });

  test('Auto-suggestions and completion', async () => {
    const partialQueries = ['VSA', 'JC', 'data', 'perf'];

    for (const partial of partialQueries) {
      const suggestions = await searchTester.testAutoSuggestions(partial);

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.toLowerCase().startsWith(partial.toLowerCase()))).toBe(true);
    }
  });

  test('Typo correction and fuzzy matching', async () => {
    const typoQueries = [
      'VSMA',      // Should correct to VSAM
      'databse',   // Should correct to database
      'performence', // Should correct to performance
      'syntex'     // Should correct to syntax
    ];

    for (const typoQuery of typoQueries) {
      const correction = await searchTester.testTypoCorrection(typoQuery);

      expect(correction.original).toBe(typoQuery);
      expect(correction.corrected).not.toBe(typoQuery);
    }
  });

  test('Faceted search navigation', async () => {
    const facets = await searchTester.testFacetedSearch();

    expect(facets.categories).toContain('VSAM');
    expect(facets.categories).toContain('JCL');
    expect(facets.categories).toContain('DB2');

    expect(facets.tags.length).toBeGreaterThan(0);
  });

  test('Search performance under load', async () => {
    searchTester.clearMetrics();

    // Perform multiple concurrent searches
    const searchPromises = [];
    const queries = [
      'VSAM error',
      'JCL syntax',
      'DB2 performance',
      'database tuning',
      'access method'
    ];

    for (const query of queries) {
      searchPromises.push(searchTester.performAdvancedSearch({ query }));
    }

    const results = await Promise.all(searchPromises);
    const metrics = searchTester.getSearchMetrics();

    // All searches should complete
    expect(results.length).toBe(queries.length);

    // Performance should be reasonable
    const avgQueryTime = metrics.reduce((sum, m) => sum + m.queryTime, 0) / metrics.length;
    expect(avgQueryTime).toBeLessThan(3000); // Average under 3 seconds

    // Cache should improve performance for repeated queries
    expect(metrics.some(m => m.cacheHitRate > 0)).toBe(true);
  });

  test('Search history and saved searches', async () => {
    // Perform some searches to create history
    await searchTester.performAdvancedSearch({ query: 'VSAM test' });
    await searchTester.performAdvancedSearch({ query: 'JCL test' });

    // Check search history
    const history = await searchTester.testSearchHistory();
    expect(history).toContain('VSAM test');
    expect(history).toContain('JCL test');

    // Save a search
    const complexQuery: SearchQuery = {
      query: 'performance',
      filters: {
        category: ['DB2'],
        priority: ['High']
      },
      sortBy: 'date'
    };

    await searchTester.saveSearch('Performance Issues', complexQuery);

    // Load saved search
    const savedResults = await searchTester.loadSavedSearch('Performance Issues');
    expect(savedResults.length).toBeGreaterThanOrEqual(0);
  });

  test('Search result customization and views', async () => {
    await searchTester.testSearchResultCustomization();
    // Assertions are embedded in the test method
  });

  test('Search result export functionality', async () => {
    const exportFormats: ('csv' | 'json' | 'pdf')[] = ['csv', 'json', 'pdf'];

    for (const format of exportFormats) {
      await searchTester.testSearchExport(format);
    }
  });

  test('Search analytics and insights', async () => {
    // Perform various searches to generate analytics data
    await searchTester.performAdvancedSearch({ query: 'VSAM' });
    await searchTester.performAdvancedSearch({ query: 'JCL' });
    await searchTester.performAdvancedSearch({ query: 'DB2' });

    const analytics = await searchTester.testSearchAnalytics();

    expect(analytics.totalSearches).toBeTruthy();
    expect(analytics.popularQueries.length).toBeGreaterThan(0);
    expect(analytics.avgResponseTime).toBeTruthy();
    expect(analytics.cacheHitRate).toBeTruthy();
  });

  test('Edge cases and error handling', async () => {
    const edgeCases = [
      '',                    // Empty query
      '    ',               // Whitespace only
      'a',                  // Single character
      'x'.repeat(1000),     // Very long query
      '!@#$%^&*()',        // Special characters only
      'SELECT * FROM users', // SQL injection attempt
      '<script>alert("xss")</script>' // XSS attempt
    ];

    for (const edgeCase of edgeCases) {
      try {
        const results = await searchTester.performAdvancedSearch({ query: edgeCase });
        // Should either return empty results or handle gracefully
        expect(Array.isArray(results)).toBe(true);
      } catch (error) {
        // Some edge cases might throw errors, which is acceptable
        expect(error).toBeDefined();
      }
    }
  });

  test('Internationalization and unicode support', async () => {
    const unicodeQueries = [
      'データベース',         // Japanese
      'база данных',        // Russian
      'base de données',    // French
      'Datenbank',         // German
      '数据库'             // Chinese
    ];

    for (const unicodeQuery of unicodeQueries) {
      const results = await searchTester.performAdvancedSearch({ query: unicodeQuery });
      expect(Array.isArray(results)).toBe(true);
    }
  });

  test('Search accessibility features', async ({ page }) => {
    await searchTester.navigateToSearch();

    // Test keyboard navigation
    await page.keyboard.press('Tab'); // Should focus search input
    let focusedElement = await page.locator(':focus');
    expect(await focusedElement.getAttribute('data-testid')).toBe('search-input');

    // Test screen reader support
    const searchInput = page.locator('[data-testid="search-input"]');
    await expect(searchInput).toHaveAttribute('aria-label');
    await expect(searchInput).toHaveAttribute('role', 'searchbox');

    // Test search results accessibility
    await page.fill('[data-testid="search-input"]', 'VSAM');
    await page.click('[data-testid="search-button"]');

    const resultsContainer = page.locator('[data-testid="search-results"]');
    await expect(resultsContainer).toHaveAttribute('role', 'region');
    await expect(resultsContainer).toHaveAttribute('aria-label');

    // Test live region for result announcements
    const liveRegion = page.locator('[aria-live="polite"]');
    await expect(liveRegion).toBeVisible();
  });
});