/**
 * Comprehensive End-to-End Workflow Validation Tests
 *
 * Tests complete user workflows from input to results, validating:
 * - Search workflows from input to results
 * - Filter application and refinement flows
 * - Result interaction and detail viewing
 * - Navigation and breadcrumb flows
 * - Error recovery workflows
 * - Multi-step processes
 * - Workflow state persistence
 * - Workflow interruption and recovery
 * - Analytics interaction flows
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';

// Test configuration
test.describe.configure({ mode: 'parallel' });

interface WorkflowMetrics {
  startTime: number;
  endTime: number;
  duration: number;
  steps: Array<{
    step: string;
    timestamp: number;
    duration: number;
    success: boolean;
    error?: string;
  }>;
}

class WorkflowTestHelper {
  private metrics: WorkflowMetrics;

  constructor(private page: Page) {
    this.metrics = {
      startTime: Date.now(),
      endTime: 0,
      duration: 0,
      steps: []
    };
  }

  async startWorkflow(workflowName: string) {
    this.metrics.startTime = Date.now();
    await this.recordStep(`Start ${workflowName}`, true);
  }

  async recordStep(stepName: string, success: boolean, error?: string) {
    const timestamp = Date.now();
    const duration = timestamp - (this.metrics.steps.length > 0 ?
      this.metrics.steps[this.metrics.steps.length - 1].timestamp : this.metrics.startTime);

    this.metrics.steps.push({
      step: stepName,
      timestamp,
      duration,
      success,
      error
    });

    if (!success && error) {
      console.warn(`Workflow step failed: ${stepName} - ${error}`);
    }
  }

  async finishWorkflow(): Promise<WorkflowMetrics> {
    this.metrics.endTime = Date.now();
    this.metrics.duration = this.metrics.endTime - this.metrics.startTime;
    return this.metrics;
  }

  // Navigation helpers
  async navigateToSearch(query?: string, filters?: Record<string, string>): Promise<void> {
    try {
      let url = '#/search';
      const params = new URLSearchParams();

      if (query) {
        url += `/${encodeURIComponent(query)}`;
        params.set('q', query);
      }

      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          params.set(key, value);
        });
      }

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      await this.page.goto(url);
      await this.page.waitForSelector('[data-testid="search-interface"]', { timeout: 5000 });
      await this.recordStep('Navigate to search', true);
    } catch (error) {
      await this.recordStep('Navigate to search', false, (error as Error).message);
      throw error;
    }
  }

  async performSearch(query: string): Promise<number> {
    try {
      // Clear existing input and enter new query
      await this.page.fill('[data-testid="search-input"]', '');
      await this.page.fill('[data-testid="search-input"]', query);

      // Trigger search
      await this.page.click('[data-testid="search-button"]');

      // Wait for results or no results message
      await Promise.race([
        this.page.waitForSelector('[data-testid="search-results"]', { timeout: 10000 }),
        this.page.waitForSelector('[data-testid="no-results"]', { timeout: 10000 })
      ]);

      // Count results
      const resultElements = await this.page.locator('[data-testid^="search-result-"]').count();
      await this.recordStep(`Search for "${query}"`, true);
      return resultElements;
    } catch (error) {
      await this.recordStep(`Search for "${query}"`, false, (error as Error).message);
      throw error;
    }
  }

  async applyFilter(filterType: string, filterValue: string): Promise<void> {
    try {
      const filterSelector = `[data-testid="${filterType}-filter"]`;
      await this.page.waitForSelector(filterSelector, { timeout: 5000 });

      if (await this.page.locator(filterSelector).getAttribute('type') === 'select-one') {
        await this.page.selectOption(filterSelector, filterValue);
      } else {
        await this.page.click(filterSelector);
        await this.page.click(`[data-testid="${filterType}-option-${filterValue}"]`);
      }

      // Wait for filter to apply
      await this.page.waitForTimeout(500);
      await this.recordStep(`Apply ${filterType} filter: ${filterValue}`, true);
    } catch (error) {
      await this.recordStep(`Apply ${filterType} filter: ${filterValue}`, false, (error as Error).message);
      throw error;
    }
  }

  async selectSearchResult(index: number): Promise<void> {
    try {
      const resultSelector = `[data-testid="search-result-${index}"]`;
      await this.page.waitForSelector(resultSelector, { timeout: 5000 });
      await this.page.click(resultSelector);
      await this.page.waitForSelector('[data-testid="entry-detail"]', { timeout: 5000 });
      await this.recordStep(`Select search result ${index}`, true);
    } catch (error) {
      await this.recordStep(`Select search result ${index}`, false, (error as Error).message);
      throw error;
    }
  }

  async interactWithEntry(action: string): Promise<void> {
    try {
      const actionButton = `[data-testid="${action}-button"]`;
      await this.page.waitForSelector(actionButton, { timeout: 5000 });
      await this.page.click(actionButton);

      // Wait for action to complete
      await this.page.waitForTimeout(1000);
      await this.recordStep(`Entry interaction: ${action}`, true);
    } catch (error) {
      await this.recordStep(`Entry interaction: ${action}`, false, (error as Error).message);
      throw error;
    }
  }

  async navigateWithBreadcrumbs(breadcrumbIndex: number): Promise<void> {
    try {
      const breadcrumbSelector = `[data-testid="breadcrumb-${breadcrumbIndex}"]`;
      await this.page.waitForSelector(breadcrumbSelector, { timeout: 5000 });
      await this.page.click(breadcrumbSelector);
      await this.page.waitForTimeout(1000);
      await this.recordStep(`Navigate via breadcrumb ${breadcrumbIndex}`, true);
    } catch (error) {
      await this.recordStep(`Navigate via breadcrumb ${breadcrumbIndex}`, false, (error as Error).message);
      throw error;
    }
  }

  async recoverFromError(): Promise<void> {
    try {
      // Check for error states and recovery options
      const errorSelectors = [
        '[data-testid="error-message"]',
        '[data-testid="search-error"]',
        '[data-testid="network-error"]',
        '[data-testid="timeout-error"]'
      ];

      for (const selector of errorSelectors) {
        if (await this.page.locator(selector).isVisible()) {
          const retryButton = this.page.locator('[data-testid="retry-button"], [data-testid="try-again-button"]');
          if (await retryButton.isVisible()) {
            await retryButton.click();
            await this.page.waitForTimeout(2000);
            break;
          }
        }
      }

      await this.recordStep('Error recovery', true);
    } catch (error) {
      await this.recordStep('Error recovery', false, (error as Error).message);
      throw error;
    }
  }

  async validateWorkflowState(expectedState: Record<string, any>): Promise<boolean> {
    try {
      const currentUrl = this.page.url();
      const urlParams = new URLSearchParams(new URL(currentUrl).search);

      // Validate URL parameters
      for (const [key, expectedValue] of Object.entries(expectedState.urlParams || {})) {
        const actualValue = urlParams.get(key);
        if (actualValue !== expectedValue) {
          throw new Error(`URL param mismatch: ${key} expected ${expectedValue}, got ${actualValue}`);
        }
      }

      // Validate UI elements
      for (const selector of expectedState.visibleElements || []) {
        await expect(this.page.locator(selector)).toBeVisible();
      }

      // Validate form states
      for (const [selector, expectedValue] of Object.entries(expectedState.inputValues || {})) {
        const actualValue = await this.page.locator(selector).inputValue();
        if (actualValue !== expectedValue) {
          throw new Error(`Input value mismatch: ${selector} expected ${expectedValue}, got ${actualValue}`);
        }
      }

      await this.recordStep('Validate workflow state', true);
      return true;
    } catch (error) {
      await this.recordStep('Validate workflow state', false, (error as Error).message);
      return false;
    }
  }

  async interruptWorkflow(interruptionType: 'navigation' | 'refresh' | 'close_tab'): Promise<void> {
    try {
      switch (interruptionType) {
        case 'navigation':
          await this.page.goto('#/dashboard');
          break;
        case 'refresh':
          await this.page.reload();
          break;
        case 'close_tab':
          // Simulate tab close/reopen by going to blank and back
          await this.page.goto('about:blank');
          await this.page.waitForTimeout(1000);
          break;
      }
      await this.recordStep(`Workflow interruption: ${interruptionType}`, true);
    } catch (error) {
      await this.recordStep(`Workflow interruption: ${interruptionType}`, false, (error as Error).message);
      throw error;
    }
  }

  async restoreWorkflow(originalUrl: string): Promise<void> {
    try {
      await this.page.goto(originalUrl);
      await this.page.waitForTimeout(2000);
      await this.recordStep('Restore workflow', true);
    } catch (error) {
      await this.recordStep('Restore workflow', false, (error as Error).message);
      throw error;
    }
  }
}

test.describe('Complete Search Workflow Validation', () => {
  let helper: WorkflowTestHelper;

  test.beforeEach(async ({ page }) => {
    helper = new WorkflowTestHelper(page);

    // Setup test data
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('kb-test-data', JSON.stringify([
        {
          id: 'workflow-test-1',
          title: 'VSAM Status 35 File Not Found',
          problem: 'VSAM file cannot be located by the system',
          solution: 'Check dataset cataloging and verify file existence',
          category: 'VSAM',
          tags: ['vsam', 'status-35', 'file-not-found'],
          created: '2024-01-15T10:00:00Z'
        },
        {
          id: 'workflow-test-2',
          title: 'JCL Syntax Error in DD Statement',
          problem: 'Job fails due to syntax error in dataset definition',
          solution: 'Review DD statement syntax and correct errors',
          category: 'JCL',
          tags: ['jcl', 'syntax', 'dd-statement'],
          created: '2024-01-14T09:30:00Z'
        },
        {
          id: 'workflow-test-3',
          title: 'DB2 Connection Timeout',
          problem: 'Application cannot connect to DB2 database',
          solution: 'Increase connection timeout and check network connectivity',
          category: 'DB2',
          tags: ['db2', 'connection', 'timeout'],
          created: '2024-01-13T14:20:00Z'
        }
      ]));
    });
  });

  test('Complete search to result workflow', async () => {
    await helper.startWorkflow('Search to Result');

    // Step 1: Navigate to search
    await helper.navigateToSearch();

    // Step 2: Perform initial search
    const resultCount = await helper.performSearch('VSAM status');
    expect(resultCount).toBeGreaterThan(0);

    // Step 3: Validate search results
    await helper.validateWorkflowState({
      urlParams: { q: 'VSAM status' },
      visibleElements: ['[data-testid="search-results"]', '[data-testid="result-count"]']
    });

    // Step 4: Select and view result
    await helper.selectSearchResult(0);

    // Step 5: Validate entry detail view
    await helper.validateWorkflowState({
      visibleElements: [
        '[data-testid="entry-detail"]',
        '[data-testid="entry-title"]',
        '[data-testid="entry-problem"]',
        '[data-testid="entry-solution"]'
      ]
    });

    const metrics = await helper.finishWorkflow();
    console.log('Search to Result Workflow Metrics:', metrics);

    // Verify workflow completed efficiently
    expect(metrics.duration).toBeLessThan(10000); // 10 seconds max
    expect(metrics.steps.every(step => step.success)).toBe(true);
  });

  test('Multi-step filter refinement workflow', async () => {
    await helper.startWorkflow('Filter Refinement');

    // Step 1: Start with broad search
    await helper.navigateToSearch('error');
    const initialResults = await helper.performSearch('error');
    expect(initialResults).toBeGreaterThan(0);

    // Step 2: Apply category filter
    await helper.applyFilter('category', 'VSAM');

    // Step 3: Validate filtered results
    await helper.validateWorkflowState({
      urlParams: { q: 'error', category: 'VSAM' },
      visibleElements: ['[data-testid="active-filters"]']
    });

    // Step 4: Apply additional tag filter
    await helper.applyFilter('tag', 'status-35');

    // Step 5: Validate refined results
    await helper.validateWorkflowState({
      urlParams: { q: 'error', category: 'VSAM', tag: 'status-35' }
    });

    // Step 6: Clear filters one by one
    await helper.page.click('[data-testid="clear-tag-filter"]');
    await helper.validateWorkflowState({
      urlParams: { q: 'error', category: 'VSAM' }
    });

    const metrics = await helper.finishWorkflow();
    expect(metrics.steps.every(step => step.success)).toBe(true);
  });

  test('Navigation and breadcrumb workflow', async () => {
    await helper.startWorkflow('Navigation and Breadcrumbs');

    // Step 1: Navigate through multiple levels
    await helper.navigateToSearch('JCL syntax', { category: 'JCL' });
    await helper.performSearch('JCL syntax');
    await helper.selectSearchResult(0);

    // Step 2: Validate breadcrumb presence
    await helper.validateWorkflowState({
      visibleElements: [
        '[data-testid="breadcrumb-0"]', // Home
        '[data-testid="breadcrumb-1"]', // Search
        '[data-testid="breadcrumb-2"]'  // Current entry
      ]
    });

    // Step 3: Navigate back via breadcrumbs
    await helper.navigateWithBreadcrumbs(1); // Back to search

    // Step 4: Validate state restoration
    await helper.validateWorkflowState({
      urlParams: { q: 'JCL syntax', category: 'JCL' },
      visibleElements: ['[data-testid="search-results"]']
    });

    // Step 5: Navigate to different entry
    await helper.selectSearchResult(0);

    // Step 6: Use browser back button
    await helper.page.goBack();
    await helper.validateWorkflowState({
      urlParams: { q: 'JCL syntax', category: 'JCL' }
    });

    const metrics = await helper.finishWorkflow();
    expect(metrics.steps.every(step => step.success)).toBe(true);
  });

  test('Error recovery workflow', async () => {
    await helper.startWorkflow('Error Recovery');

    await helper.navigateToSearch();

    // Step 1: Simulate network error
    await helper.page.route('**/api/search**', route => {
      route.abort('failed');
    });

    try {
      await helper.performSearch('network test');
    } catch {
      // Expected to fail
    }

    // Step 2: Validate error state
    await expect(helper.page.locator('[data-testid="search-error"]')).toBeVisible();

    // Step 3: Attempt recovery
    await helper.page.unroute('**/api/search**');
    await helper.recoverFromError();

    // Step 4: Verify recovery success
    await helper.validateWorkflowState({
      visibleElements: ['[data-testid="search-results"], [data-testid="no-results"]']
    });

    const metrics = await helper.finishWorkflow();
    expect(metrics.steps.filter(step => step.success).length).toBeGreaterThan(0);
  });

  test('Workflow state persistence across navigation', async () => {
    await helper.startWorkflow('State Persistence');

    // Step 1: Set up complex search state
    await helper.navigateToSearch('VSAM error', { category: 'VSAM', sort: 'date' });
    await helper.performSearch('VSAM error');

    // Step 2: Navigate away
    const originalUrl = helper.page.url();
    await helper.page.goto('#/dashboard');

    // Step 3: Navigate back
    await helper.page.goto(originalUrl);

    // Step 4: Validate state restoration
    await helper.validateWorkflowState({
      urlParams: { q: 'VSAM error', category: 'VSAM', sort: 'date' },
      visibleElements: ['[data-testid="search-results"]']
    });

    const metrics = await helper.finishWorkflow();
    expect(metrics.steps.every(step => step.success)).toBe(true);
  });

  test('Workflow interruption and recovery', async () => {
    await helper.startWorkflow('Interruption Recovery');

    // Step 1: Start workflow
    await helper.navigateToSearch('DB2 connection');
    await helper.performSearch('DB2 connection');

    const originalUrl = helper.page.url();

    // Step 2: Interrupt with refresh
    await helper.interruptWorkflow('refresh');

    // Step 3: Restore workflow
    await helper.restoreWorkflow(originalUrl);

    // Step 4: Validate restoration
    await helper.validateWorkflowState({
      urlParams: { q: 'DB2 connection' },
      visibleElements: ['[data-testid="search-results"]']
    });

    // Step 5: Continue workflow
    await helper.selectSearchResult(0);
    await helper.interactWithEntry('copy-solution');

    const metrics = await helper.finishWorkflow();
    expect(metrics.steps.filter(step => step.success).length).toBeGreaterThan(3);
  });
});

test.describe('Multi-Step Process Workflows', () => {
  let helper: WorkflowTestHelper;

  test.beforeEach(async ({ page }) => {
    helper = new WorkflowTestHelper(page);
  });

  test('Complete entry creation workflow', async () => {
    await helper.startWorkflow('Entry Creation');

    // Step 1: Navigate to search with no results
    await helper.navigateToSearch();
    await helper.performSearch('nonexistent unique query');

    // Step 2: Trigger add entry from no results
    await helper.page.click('[data-testid="add-entry-from-search"]');

    // Step 3: Fill entry form
    await helper.page.fill('[data-testid="entry-title-input"]', 'New Test Entry');
    await helper.page.fill('[data-testid="entry-problem-input"]', 'Test problem description');
    await helper.page.fill('[data-testid="entry-solution-input"]', 'Test solution description');
    await helper.page.selectOption('[data-testid="entry-category-select"]', 'Testing');

    // Step 4: Submit entry
    await helper.page.click('[data-testid="submit-entry-button"]');

    // Step 5: Validate entry was created and redirected
    await helper.validateWorkflowState({
      visibleElements: ['[data-testid="entry-detail"]']
    });

    // Step 6: Verify entry can be found in search
    await helper.navigateToSearch();
    const results = await helper.performSearch('New Test Entry');
    expect(results).toBeGreaterThan(0);

    const metrics = await helper.finishWorkflow();
    expect(metrics.steps.every(step => step.success)).toBe(true);
  });

  test('Entry editing workflow with validation', async () => {
    await helper.startWorkflow('Entry Editing');

    // Step 1: Find and view entry
    await helper.navigateToSearch();
    await helper.performSearch('VSAM status');
    await helper.selectSearchResult(0);

    // Step 2: Start editing
    await helper.page.click('[data-testid="edit-entry-button"]');

    // Step 3: Modify entry
    await helper.page.fill('[data-testid="entry-title-input"]', 'Updated VSAM Status Error');
    await helper.page.fill('[data-testid="entry-solution-input"]', 'Updated solution with more details');

    // Step 4: Validate form
    const titleLength = await helper.page.locator('[data-testid="title-char-count"]').textContent();
    expect(parseInt(titleLength!)).toBeGreaterThan(0);

    // Step 5: Save changes
    await helper.page.click('[data-testid="save-entry-button"]');

    // Step 6: Validate changes persisted
    await helper.validateWorkflowState({
      visibleElements: ['[data-testid="entry-detail"]']
    });

    const updatedTitle = await helper.page.locator('[data-testid="entry-title"]').textContent();
    expect(updatedTitle).toContain('Updated VSAM Status Error');

    const metrics = await helper.finishWorkflow();
    expect(metrics.steps.every(step => step.success)).toBe(true);
  });

  test('Batch operations workflow', async () => {
    await helper.startWorkflow('Batch Operations');

    // Step 1: Search for multiple entries
    await helper.navigateToSearch();
    await helper.performSearch('error');

    // Step 2: Select multiple entries
    await helper.page.click('[data-testid="batch-select-mode"]');
    await helper.page.click('[data-testid="select-result-0"]');
    await helper.page.click('[data-testid="select-result-1"]');

    // Step 3: Apply batch operation
    await helper.page.click('[data-testid="batch-actions-menu"]');
    await helper.page.click('[data-testid="batch-tag-operation"]');

    // Step 4: Configure batch operation
    await helper.page.fill('[data-testid="batch-tag-input"]', 'batch-processed');
    await helper.page.click('[data-testid="apply-batch-operation"]');

    // Step 5: Validate operation completed
    await helper.validateWorkflowState({
      visibleElements: ['[data-testid="batch-success-message"]']
    });

    const metrics = await helper.finishWorkflow();
    expect(metrics.steps.every(step => step.success)).toBe(true);
  });
});

test.describe('Analytics and Interaction Workflows', () => {
  let helper: WorkflowTestHelper;

  test.beforeEach(async ({ page }) => {
    helper = new WorkflowTestHelper(page);
  });

  test('Search analytics workflow', async () => {
    await helper.startWorkflow('Search Analytics');

    // Step 1: Perform searches to generate analytics data
    const queries = ['VSAM error', 'JCL syntax', 'DB2 connection'];

    for (const query of queries) {
      await helper.navigateToSearch();
      await helper.performSearch(query);
      await helper.page.waitForTimeout(1000); // Ensure analytics capture
    }

    // Step 2: Navigate to analytics
    await helper.page.goto('#/analytics');
    await helper.validateWorkflowState({
      visibleElements: ['[data-testid="analytics-dashboard"]']
    });

    // Step 3: View search statistics
    await helper.page.click('[data-testid="search-analytics-tab"]');
    await helper.validateWorkflowState({
      visibleElements: ['[data-testid="search-frequency-chart"]', '[data-testid="popular-queries"]']
    });

    // Step 4: Filter analytics by date
    await helper.page.click('[data-testid="date-filter"]');
    await helper.page.selectOption('[data-testid="date-range-select"]', 'last-7-days');

    // Step 5: Export analytics data
    await helper.page.click('[data-testid="export-analytics"]');
    await helper.validateWorkflowState({
      visibleElements: ['[data-testid="export-success"]']
    });

    const metrics = await helper.finishWorkflow();
    expect(metrics.steps.every(step => step.success)).toBe(true);
  });

  test('User interaction tracking workflow', async () => {
    await helper.startWorkflow('Interaction Tracking');

    // Step 1: Perform various interactions
    await helper.navigateToSearch();
    await helper.performSearch('VSAM status');
    await helper.selectSearchResult(0);

    // Step 2: Rate entry
    await helper.interactWithEntry('rate-helpful');

    // Step 3: Copy solution
    await helper.interactWithEntry('copy-solution');

    // Step 4: Share entry
    await helper.interactWithEntry('share-entry');

    // Step 5: View interaction history
    await helper.page.goto('#/profile/interactions');
    await helper.validateWorkflowState({
      visibleElements: ['[data-testid="interaction-history"]']
    });

    // Step 6: Analyze interaction patterns
    await helper.page.click('[data-testid="interaction-analytics"]');
    await helper.validateWorkflowState({
      visibleElements: ['[data-testid="interaction-chart"]']
    });

    const metrics = await helper.finishWorkflow();
    expect(metrics.steps.every(step => step.success)).toBe(true);
  });

  test('Performance monitoring workflow', async () => {
    await helper.startWorkflow('Performance Monitoring');

    // Step 1: Enable performance monitoring
    await helper.page.goto('#/settings/performance');
    await helper.page.check('[data-testid="enable-performance-monitoring"]');

    // Step 2: Perform monitored operations
    await helper.navigateToSearch();

    const startTime = Date.now();
    await helper.performSearch('performance test query');
    const searchDuration = Date.now() - startTime;

    // Step 3: View performance metrics
    await helper.page.goto('#/analytics/performance');
    await helper.validateWorkflowState({
      visibleElements: ['[data-testid="performance-dashboard"]']
    });

    // Step 4: Analyze search performance
    await helper.page.click('[data-testid="search-performance-tab"]');
    const avgResponseTime = await helper.page.locator('[data-testid="avg-response-time"]').textContent();
    expect(parseInt(avgResponseTime!)).toBeGreaterThan(0);

    // Step 5: Set performance alerts
    await helper.page.click('[data-testid="performance-alerts"]');
    await helper.page.fill('[data-testid="response-time-threshold"]', '2000');
    await helper.page.click('[data-testid="save-alert-settings"]');

    const metrics = await helper.finishWorkflow();
    expect(metrics.steps.every(step => step.success)).toBe(true);

    // Verify search performance was reasonable
    expect(searchDuration).toBeLessThan(5000);
  });
});

test.describe('Cross-Device and Accessibility Workflows', () => {
  let helper: WorkflowTestHelper;

  test.beforeEach(async ({ page }) => {
    helper = new WorkflowTestHelper(page);
  });

  test('Mobile responsive workflow', async ({ page }) => {
    await helper.startWorkflow('Mobile Responsive');

    // Step 1: Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Step 2: Navigate and search on mobile
    await helper.navigateToSearch();
    await helper.performSearch('mobile test');

    // Step 3: Validate mobile interface
    await helper.validateWorkflowState({
      visibleElements: [
        '[data-testid="mobile-search-interface"]',
        '[data-testid="mobile-menu-toggle"]'
      ]
    });

    // Step 4: Use mobile navigation
    await helper.page.click('[data-testid="mobile-menu-toggle"]');
    await helper.page.click('[data-testid="mobile-nav-analytics"]');

    // Step 5: Validate mobile analytics view
    await helper.validateWorkflowState({
      visibleElements: ['[data-testid="mobile-analytics-dashboard"]']
    });

    const metrics = await helper.finishWorkflow();
    expect(metrics.steps.every(step => step.success)).toBe(true);
  });

  test('Keyboard navigation workflow', async ({ page }) => {
    await helper.startWorkflow('Keyboard Navigation');

    await helper.navigateToSearch();

    // Step 1: Navigate using keyboard only
    await page.keyboard.press('Tab'); // Focus search input
    await page.keyboard.type('keyboard test');
    await page.keyboard.press('Enter'); // Submit search

    // Step 2: Navigate results with keyboard
    await page.keyboard.press('Tab'); // Focus first result
    await page.keyboard.press('Enter'); // Open result

    // Step 3: Navigate entry detail with keyboard
    await page.keyboard.press('Tab'); // Focus first action
    await page.keyboard.press('Enter'); // Activate action

    // Step 4: Navigate back with keyboard
    await page.keyboard.press('Escape'); // Go back

    // Step 5: Validate keyboard accessibility
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(['INPUT', 'BUTTON', 'A'].includes(focusedElement!)).toBe(true);

    const metrics = await helper.finishWorkflow();
    expect(metrics.steps.every(step => step.success)).toBe(true);
  });

  test('Screen reader compatibility workflow', async ({ page }) => {
    await helper.startWorkflow('Screen Reader Compatibility');

    await helper.navigateToSearch();

    // Step 1: Validate ARIA labels
    const searchInput = page.locator('[data-testid="search-input"]');
    await expect(searchInput).toHaveAttribute('aria-label');
    await expect(searchInput).toHaveAttribute('role', 'searchbox');

    // Step 2: Perform search and validate results accessibility
    await helper.performSearch('accessibility test');

    const resultsContainer = page.locator('[data-testid="search-results"]');
    await expect(resultsContainer).toHaveAttribute('role', 'region');
    await expect(resultsContainer).toHaveAttribute('aria-label');

    // Step 3: Validate result items accessibility
    const firstResult = page.locator('[data-testid="search-result-0"]');
    await expect(firstResult).toHaveAttribute('role', 'button');
    await expect(firstResult).toHaveAttribute('aria-label');

    // Step 4: Navigate to entry and validate detail accessibility
    await helper.selectSearchResult(0);

    const entryDetail = page.locator('[data-testid="entry-detail"]');
    await expect(entryDetail).toHaveAttribute('role', 'main');

    const metrics = await helper.finishWorkflow();
    expect(metrics.steps.every(step => step.success)).toBe(true);
  });
});