import { test, expect } from '@playwright/test';

/**
 * E2E Test: Budget Limit Scenarios
 * Tests: Daily, weekly, monthly budget limits and enforcement
 */
test.describe('Budget Limits E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveTitle(/Mainframe AI Assistant/);
  });

  test('daily budget limit enforcement', async ({ page }) => {
    // Login as user with low daily budget (user-001: $10 daily, $8.50 spent, $1.50 remaining)
    await page.goto('/logout');
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'user@test.com');
    await page.fill('[data-testid="password"]', 'UserPassword123!');
    await page.click('[data-testid="login-button"]');

    // Check current budget status
    await page.goto('/budget-status');
    await expect(page.locator('[data-testid="daily-remaining"]')).toContainText('$1.50');
    await expect(page.locator('[data-testid="budget-warning"]')).toContainText('85% of daily budget used');

    // Attempt AI search that would exceed budget
    await page.goto('/dashboard');
    await page.click('[data-testid="search-tab"]');
    await page.fill('[data-testid="search-input"]', 'Complex mainframe performance analysis with detailed recommendations and implementation strategies');
    await page.check('[data-testid="ai-search-toggle"]');
    await page.click('[data-testid="search-button"]');

    // Should show budget exceeded dialog
    await expect(page.locator('[data-testid="budget-exceeded-dialog"]')).toBeVisible();
    await expect(page.locator('[data-testid="estimated-cost"]')).toContainText('$2.50');
    await expect(page.locator('[data-testid="budget-exceeded-message"]')).toContainText('exceed your daily budget limit');

    // Verify search is blocked
    await page.click('[data-testid="cancel-search"]');
    await expect(page.locator('[data-testid="search-results"]')).not.toBeVisible();

    // Check audit log for blocked search
    await page.goto('/user-activity');
    await expect(page.locator('[data-testid="activity-log"]').first()).toContainText('SEARCH_BLOCKED_BUDGET_EXCEEDED');
  });

  test('weekly budget limit with rollover', async ({ page }) => {
    // Setup: Create user approaching weekly limit
    await page.goto('/admin/user-management');
    await page.click('[data-testid="edit-user-001"]');

    // Set user close to weekly limit
    await page.fill('[data-testid="weekly-spent"]', '45.00');
    await page.fill('[data-testid="weekly-limit"]', '50.00');
    await page.click('[data-testid="save-user-budget"]');

    // Login as that user
    await page.goto('/logout');
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'user@test.com');
    await page.fill('[data-testid="password"]', 'UserPassword123!');
    await page.click('[data-testid="login-button"]');

    // Check weekly budget status
    await page.goto('/budget-status');
    await expect(page.locator('[data-testid="weekly-remaining"]')).toContainText('$5.00');
    await expect(page.locator('[data-testid="weekly-usage-percent"]')).toContainText('90%');

    // Perform search that uses remaining budget
    await page.goto('/dashboard');
    await page.click('[data-testid="search-tab"]');
    await page.fill('[data-testid="search-input"]', 'CICS troubleshooting guide');
    await page.check('[data-testid="ai-search-toggle"]');
    await page.click('[data-testid="search-button"]');
    await page.click('[data-testid="confirm-ai-search"]');

    // Wait for search completion
    await expect(page.locator('[data-testid="search-results"]')).toBeVisible();

    // Check updated budget
    await page.goto('/budget-status');
    await expect(page.locator('[data-testid="weekly-remaining"]')).toContainText('$0.00');
    await expect(page.locator('[data-testid="weekly-exhausted"]')).toBeVisible();

    // Try another search - should be blocked
    await page.goto('/dashboard');
    await page.click('[data-testid="search-tab"]');
    await page.fill('[data-testid="search-input"]', 'Another search query');
    await page.check('[data-testid="ai-search-toggle"]');
    await page.click('[data-testid="search-button"]');

    await expect(page.locator('[data-testid="weekly-budget-exceeded"]')).toBeVisible();
  });

  test('monthly budget limit with grace period', async ({ page }) => {
    // Login as user near monthly limit (user-002: $100 monthly, $95 spent)
    await page.goto('/logout');
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'user2@test.com');
    await page.fill('[data-testid="password"]', 'ReadOnlyPassword123!');
    await page.click('[data-testid="login-button"]');

    // Check monthly budget status
    await page.goto('/budget-status');
    await expect(page.locator('[data-testid="monthly-remaining"]')).toContainText('$5.00');
    await expect(page.locator('[data-testid="monthly-alert"]')).toContainText('95% of monthly budget used');

    // Attempt search that would exceed budget
    await page.goto('/dashboard');
    await page.click('[data-testid="search-tab"]');
    await page.fill('[data-testid="search-input"]', 'Comprehensive mainframe security analysis');
    await page.check('[data-testid="ai-search-toggle"]');
    await page.click('[data-testid="search-button"]');

    // Should show grace period option
    await expect(page.locator('[data-testid="grace-period-dialog"]')).toBeVisible();
    await expect(page.locator('[data-testid="grace-period-cost"]')).toContainText('$7.50');
    await expect(page.locator('[data-testid="grace-period-warning"]')).toContainText('exceed monthly budget by $2.50');

    // Accept grace period
    await page.click('[data-testid="accept-grace-period"]');
    await expect(page.locator('[data-testid="search-results"]')).toBeVisible();

    // Verify grace period usage is tracked
    await page.goto('/budget-status');
    await expect(page.locator('[data-testid="grace-period-used"]')).toContainText('$2.50');
    await expect(page.locator('[data-testid="monthly-overage"]')).toBeVisible();
  });

  test('budget reset automation and notifications', async ({ page }) => {
    // Simulate budget reset (daily)
    await page.goto('/admin/budget-management');
    await page.click('[data-testid="simulate-daily-reset"]');

    // Verify reset notifications
    await expect(page.locator('[data-testid="reset-notification"]')).toContainText('Daily budgets reset for all users');

    // Check user budget after reset
    await page.goto('/user-management');
    await page.click('[data-testid="view-user-001"]');
    await expect(page.locator('[data-testid="daily-spent"]')).toContainText('$0.00');
    await expect(page.locator('[data-testid="daily-remaining"]')).toContainText('$10.00');

    // Verify reset audit trail
    await page.goto('/admin/audit-log');
    await expect(page.locator('[data-testid="audit-entries"]').first()).toContainText('BUDGET_RESET_DAILY');

    // Test weekly reset
    await page.goto('/admin/budget-management');
    await page.click('[data-testid="simulate-weekly-reset"]');

    await page.goto('/user-management');
    await page.click('[data-testid="view-user-001"]');
    await expect(page.locator('[data-testid="weekly-spent"]')).toContainText('$0.00');
  });

  test('budget alerts and threshold notifications', async ({ page }) => {
    // Configure alert thresholds
    await page.goto('/admin/budget-alerts');
    await page.fill('[data-testid="warning-threshold"]', '75');
    await page.fill('[data-testid="critical-threshold"]', '90');
    await page.check('[data-testid="email-notifications"]');
    await page.check('[data-testid="in-app-notifications"]');
    await page.click('[data-testid="save-alert-config"]');

    // Simulate user reaching warning threshold
    await page.goto('/admin/user-management');
    await page.click('[data-testid="edit-user-001"]');
    await page.fill('[data-testid="daily-spent"]', '7.50'); // 75% of $10
    await page.click('[data-testid="save-user-budget"]');

    // Login as user to see alert
    await page.goto('/logout');
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'user@test.com');
    await page.fill('[data-testid="password"]', 'UserPassword123!');
    await page.click('[data-testid="login-button"]');

    // Verify warning notification
    await expect(page.locator('[data-testid="budget-warning-notification"]')).toBeVisible();
    await expect(page.locator('[data-testid="warning-message"]')).toContainText('75% of daily budget used');

    // Simulate reaching critical threshold
    await page.goto('/logout');
    await page.goto('/admin/user-management');
    await page.click('[data-testid="edit-user-001"]');
    await page.fill('[data-testid="daily-spent"]', '9.00'); // 90% of $10
    await page.click('[data-testid="save-user-budget"]');

    // Login as user again
    await page.goto('/logout');
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'user@test.com');
    await page.fill('[data-testid="password"]', 'UserPassword123!');
    await page.click('[data-testid="login-button"]');

    // Verify critical alert
    await expect(page.locator('[data-testid="budget-critical-alert"]')).toBeVisible();
    await expect(page.locator('[data-testid="critical-message"]')).toContainText('90% of daily budget used');
  });

  test('budget override for emergency scenarios', async ({ page }) => {
    // Login as admin
    await page.goto('/admin/dashboard');

    // Create emergency budget override
    await page.click('[data-testid="emergency-budget-override"]');
    await page.selectOption('[data-testid="user-select"]', 'user-001');
    await page.fill('[data-testid="override-amount"]', '50.00');
    await page.fill('[data-testid="override-reason"]', 'Critical production issue requiring immediate AI assistance');
    await page.selectOption('[data-testid="override-duration"]', '24-hours');
    await page.click('[data-testid="approve-override"]');

    // Verify override is active
    await expect(page.locator('[data-testid="override-success"]')).toContainText('Emergency override granted');

    // Login as user and verify increased budget
    await page.goto('/logout');
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'user@test.com');
    await page.fill('[data-testid="password"]', 'UserPassword123!');
    await page.click('[data-testid="login-button"]');

    await page.goto('/budget-status');
    await expect(page.locator('[data-testid="emergency-override-notice"]')).toBeVisible();
    await expect(page.locator('[data-testid="override-amount"]')).toContainText('$50.00');
    await expect(page.locator('[data-testid="override-expiry"]')).toContainText('24 hours');

    // Verify override is logged
    await page.goto('/user-activity');
    await expect(page.locator('[data-testid="activity-log"]').first()).toContainText('EMERGENCY_BUDGET_OVERRIDE');
  });

  test('budget analytics and reporting', async ({ page }) => {
    // Navigate to budget analytics dashboard
    await page.goto('/admin/budget-analytics');

    // Verify budget overview charts
    await expect(page.locator('[data-testid="budget-utilization-chart"]')).toBeVisible();
    await expect(page.locator('[data-testid="user-spending-trends"]')).toBeVisible();
    await expect(page.locator('[data-testid="cost-breakdown-chart"]')).toBeVisible();

    // Test date range filtering
    await page.click('[data-testid="date-range-picker"]');
    await page.fill('[data-testid="start-date"]', '2024-01-01');
    await page.fill('[data-testid="end-date"]', '2024-12-31');
    await page.click('[data-testid="apply-filter"]');

    // Verify filtered data
    await expect(page.locator('[data-testid="filtered-results"]')).toBeVisible();
    await expect(page.locator('[data-testid="total-budget-allocated"]')).toContainText('$');
    await expect(page.locator('[data-testid="total-budget-used"]')).toContainText('$');

    // Export budget report
    await page.click('[data-testid="export-budget-report"]');
    await page.selectOption('[data-testid="report-format"]', 'pdf');
    await page.check('[data-testid="include-user-breakdown"]');
    await page.check('[data-testid="include-cost-analysis"]');

    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="generate-report"]');
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toContain('budget-analytics');
    expect(download.suggestedFilename()).toContain('.pdf');

    // Verify budget forecasting
    await page.click('[data-testid="budget-forecasting"]');
    await expect(page.locator('[data-testid="forecast-chart"]')).toBeVisible();
    await expect(page.locator('[data-testid="projected-monthly-costs"]')).toContainText('$');
    await expect(page.locator('[data-testid="budget-recommendations"]')).toBeVisible();
  });
});