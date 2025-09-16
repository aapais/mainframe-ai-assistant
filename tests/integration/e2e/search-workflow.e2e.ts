import { test, expect } from '@playwright/test';

/**
 * E2E Test: Complete Search Workflow
 * Tests: User searches for "S0C4 ABEND" → AI authorization → cost tracking → operation logging
 */
test.describe('Search Workflow E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Start with authenticated user session
    await page.goto('/dashboard');
    await expect(page).toHaveTitle(/Mainframe AI Assistant/);
  });

  test('complete search workflow with AI authorization and cost tracking', async ({ page }) => {
    // Step 1: Navigate to search interface
    await page.click('[data-testid="search-tab"]');
    await expect(page.locator('[data-testid="search-container"]')).toBeVisible();

    // Step 2: Enter search query
    const searchQuery = 'S0C4 ABEND troubleshooting';
    await page.fill('[data-testid="search-input"]', searchQuery);

    // Step 3: Enable AI search
    await page.check('[data-testid="ai-search-toggle"]');
    await expect(page.locator('[data-testid="ai-search-enabled"]')).toBeVisible();

    // Step 4: Verify budget check before search
    await page.click('[data-testid="search-button"]');

    // Should show budget confirmation dialog
    await expect(page.locator('[data-testid="budget-confirmation-dialog"]')).toBeVisible();
    await expect(page.locator('[data-testid="estimated-cost"]')).toContainText('$');
    await expect(page.locator('[data-testid="remaining-budget"]')).toContainText('$');

    // Step 5: Confirm AI search authorization
    await page.click('[data-testid="confirm-ai-search"]');

    // Step 6: Wait for search results
    await expect(page.locator('[data-testid="search-results"]')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('[data-testid="ai-results-section"]')).toBeVisible();

    // Step 7: Verify search results contain expected content
    await expect(page.locator('[data-testid="search-results"]')).toContainText('S0C4');
    await expect(page.locator('[data-testid="ai-analysis"]')).toContainText('protection exception');

    // Step 8: Verify cost tracking updated
    await page.click('[data-testid="user-menu"]');
    await page.click('[data-testid="budget-status"]');

    await expect(page.locator('[data-testid="recent-usage"]')).toContainText(searchQuery);
    await expect(page.locator('[data-testid="cost-breakdown"]')).toContainText('AI Search');

    // Step 9: Verify operation logging
    await page.click('[data-testid="admin-panel"]');
    await page.click('[data-testid="audit-log"]');

    await expect(page.locator('[data-testid="audit-entries"]').first()).toContainText('AI_SEARCH');
    await expect(page.locator('[data-testid="audit-entries"]').first()).toContainText(searchQuery);

    // Step 10: Verify transparency dashboard update
    await page.click('[data-testid="transparency-dashboard"]');
    await expect(page.locator('[data-testid="total-ai-costs"]')).toBeVisible();
    await expect(page.locator('[data-testid="usage-chart"]')).toBeVisible();
  });

  test('search workflow with budget exceeded scenario', async ({ page }) => {
    // Set user to near budget limit (user-001 has $1.50 remaining)
    await page.goto('/dashboard');

    // Try expensive AI search
    await page.click('[data-testid="search-tab"]');
    await page.fill('[data-testid="search-input"]', 'Complex CICS performance analysis with detailed optimization recommendations');
    await page.check('[data-testid="ai-search-toggle"]');
    await page.click('[data-testid="search-button"]');

    // Should show budget exceeded warning
    await expect(page.locator('[data-testid="budget-exceeded-dialog"]')).toBeVisible();
    await expect(page.locator('[data-testid="budget-exceeded-message"]')).toContainText('exceed your daily budget');

    // Verify search is blocked
    await page.click('[data-testid="cancel-search"]');
    await expect(page.locator('[data-testid="search-results"]')).not.toBeVisible();

    // Verify audit log shows blocked attempt
    await page.click('[data-testid="admin-panel"]');
    await page.click('[data-testid="audit-log"]');
    await expect(page.locator('[data-testid="audit-entries"]').first()).toContainText('SEARCH_BLOCKED_BUDGET');
  });

  test('search workflow with API key validation', async ({ page }) => {
    // Navigate to admin API configuration first
    await page.goto('/admin/api-config');

    // Temporarily disable API key
    await page.click('[data-testid="openai-config-toggle"]');
    await page.click('[data-testid="save-config"]');

    // Try AI search without valid API key
    await page.goto('/dashboard');
    await page.click('[data-testid="search-tab"]');
    await page.fill('[data-testid="search-input"]', 'S0C4 ABEND');
    await page.check('[data-testid="ai-search-toggle"]');
    await page.click('[data-testid="search-button"]');

    // Should show API configuration error
    await expect(page.locator('[data-testid="api-error-dialog"]')).toBeVisible();
    await expect(page.locator('[data-testid="api-error-message"]')).toContainText('API key not configured');

    // Re-enable API key for cleanup
    await page.goto('/admin/api-config');
    await page.click('[data-testid="openai-config-toggle"]');
    await page.click('[data-testid="save-config"]');
  });

  test('search workflow performance tracking', async ({ page }) => {
    const startTime = Date.now();

    // Perform search and measure performance
    await page.goto('/dashboard');
    await page.click('[data-testid="search-tab"]');
    await page.fill('[data-testid="search-input"]', 'JCL optimization');
    await page.click('[data-testid="search-button"]');

    // Wait for results and measure time
    await expect(page.locator('[data-testid="search-results"]')).toBeVisible();
    const searchDuration = Date.now() - startTime;

    // Verify performance is within acceptable limits
    expect(searchDuration).toBeLessThan(5000); // 5 seconds max

    // Check performance metrics in dashboard
    await page.click('[data-testid="admin-panel"]');
    await page.click('[data-testid="performance-metrics"]');

    await expect(page.locator('[data-testid="avg-search-time"]')).toBeVisible();
    await expect(page.locator('[data-testid="search-performance-chart"]')).toBeVisible();
  });
});