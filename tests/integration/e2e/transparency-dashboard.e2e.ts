import { test, expect } from '@playwright/test';

/**
 * E2E Test: Transparency Dashboard
 * Tests: User views transparency dashboard → export to CSV/PDF
 */
test.describe('Transparency Dashboard E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveTitle(/Mainframe AI Assistant/);
  });

  test('complete transparency dashboard workflow with export', async ({ page }) => {
    // Step 1: Navigate to transparency dashboard
    await page.click('[data-testid="transparency-tab"]');
    await expect(page.locator('[data-testid="transparency-dashboard"]')).toBeVisible();

    // Step 2: Verify cost overview section
    await expect(page.locator('[data-testid="total-costs-today"]')).toBeVisible();
    await expect(page.locator('[data-testid="total-costs-week"]')).toBeVisible();
    await expect(page.locator('[data-testid="total-costs-month"]')).toBeVisible();

    // Verify costs have realistic values
    await expect(page.locator('[data-testid="total-costs-today"]')).toContainText('$');
    await expect(page.locator('[data-testid="budget-remaining"]')).toContainText('$');

    // Step 3: Verify usage breakdown charts
    await expect(page.locator('[data-testid="usage-by-provider-chart"]')).toBeVisible();
    await expect(page.locator('[data-testid="usage-by-operation-chart"]')).toBeVisible();
    await expect(page.locator('[data-testid="cost-trend-chart"]')).toBeVisible();

    // Step 4: Verify detailed usage table
    await expect(page.locator('[data-testid="usage-details-table"]')).toBeVisible();
    await expect(page.locator('[data-testid="usage-table-headers"]')).toContainText('Date');
    await expect(page.locator('[data-testid="usage-table-headers"]')).toContainText('Operation');
    await expect(page.locator('[data-testid="usage-table-headers"]')).toContainText('Cost');
    await expect(page.locator('[data-testid="usage-table-headers"]')).toContainText('Provider');

    // Step 5: Test filtering functionality
    await page.selectOption('[data-testid="filter-provider"]', 'openai');
    await expect(page.locator('[data-testid="filtered-results"]')).toBeVisible();
    await expect(page.locator('[data-testid="usage-row"]').first()).toContainText('OpenAI');

    // Step 6: Test date range filtering
    await page.click('[data-testid="date-range-picker"]');
    await page.fill('[data-testid="start-date"]', '2024-01-01');
    await page.fill('[data-testid="end-date"]', '2024-12-31');
    await page.click('[data-testid="apply-date-filter"]');
    await expect(page.locator('[data-testid="date-filter-applied"]')).toBeVisible();

    // Step 7: Export to CSV
    await page.click('[data-testid="export-dropdown"]');
    await page.click('[data-testid="export-csv"]');

    // Wait for download
    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="confirm-csv-export"]');
    const download = await downloadPromise;

    // Verify download
    expect(download.suggestedFilename()).toContain('transparency-report');
    expect(download.suggestedFilename()).toContain('.csv');

    // Step 8: Export to PDF
    await page.click('[data-testid="export-dropdown"]');
    await page.click('[data-testid="export-pdf"]');

    // Configure PDF export options
    await page.check('[data-testid="include-charts"]');
    await page.check('[data-testid="include-summary"]');
    await page.selectOption('[data-testid="pdf-layout"]', 'landscape');

    const pdfDownloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="confirm-pdf-export"]');
    const pdfDownload = await pdfDownloadPromise;

    // Verify PDF download
    expect(pdfDownload.suggestedFilename()).toContain('transparency-report');
    expect(pdfDownload.suggestedFilename()).toContain('.pdf');
  });

  test('transparency dashboard real-time updates', async ({ page }) => {
    // Open transparency dashboard
    await page.goto('/transparency');

    // Record initial cost values
    const initialCost = await page.locator('[data-testid="total-costs-today"]').textContent();

    // Perform an AI search in another tab to generate usage
    const searchPage = await page.context().newPage();
    await searchPage.goto('/dashboard');
    await searchPage.click('[data-testid="search-tab"]');
    await searchPage.fill('[data-testid="search-input"]', 'Test search for transparency update');
    await searchPage.check('[data-testid="ai-search-toggle"]');
    await searchPage.click('[data-testid="search-button"]');
    await searchPage.click('[data-testid="confirm-ai-search"]');
    await searchPage.waitForSelector('[data-testid="search-results"]');
    await searchPage.close();

    // Refresh transparency dashboard and verify updates
    await page.reload();
    await expect(page.locator('[data-testid="total-costs-today"]')).not.toHaveText(initialCost);
    await expect(page.locator('[data-testid="recent-usage"]').first()).toContainText('Test search for transparency update');
  });

  test('budget alerts and notifications in transparency dashboard', async ({ page }) => {
    // Navigate to transparency dashboard
    await page.goto('/transparency');

    // Check for budget alerts if user is near limit
    const budgetAlert = page.locator('[data-testid="budget-alert"]');
    if (await budgetAlert.isVisible()) {
      await expect(budgetAlert).toContainText('budget limit');
      await expect(page.locator('[data-testid="alert-severity"]')).toBeVisible();
    }

    // Test alert acknowledgment
    if (await budgetAlert.isVisible()) {
      await page.click('[data-testid="acknowledge-alert"]');
      await expect(budgetAlert).not.toBeVisible();
    }

    // Verify alert history
    await page.click('[data-testid="alert-history"]');
    await expect(page.locator('[data-testid="alert-timeline"]')).toBeVisible();
  });

  test('transparency dashboard accessibility and mobile responsiveness', async ({ page }) => {
    // Test keyboard navigation
    await page.goto('/transparency');
    await page.keyboard.press('Tab');
    await expect(page.locator(':focus')).toBeVisible();

    // Test screen reader compatibility
    await expect(page.locator('[data-testid="transparency-dashboard"]')).toHaveAttribute('role', 'main');
    await expect(page.locator('[data-testid="usage-chart"]')).toHaveAttribute('aria-label');

    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('[data-testid="mobile-navigation"]')).toBeVisible();
    await expect(page.locator('[data-testid="chart-responsive"]')).toBeVisible();

    // Test touch interactions
    await page.locator('[data-testid="chart-zoom"]').tap();
    await expect(page.locator('[data-testid="zoomed-chart"]')).toBeVisible();
  });

  test('transparency dashboard data accuracy validation', async ({ page }) => {
    // Navigate to dashboard
    await page.goto('/transparency');

    // Get displayed totals
    const displayedDaily = await page.locator('[data-testid="total-costs-today"]').textContent();
    const displayedWeekly = await page.locator('[data-testid="total-costs-week"]').textContent();
    const displayedMonthly = await page.locator('[data-testid="total-costs-month"]').textContent();

    // Extract numeric values
    const dailyAmount = parseFloat(displayedDaily?.replace(/[^0-9.]/g, '') || '0');
    const weeklyAmount = parseFloat(displayedWeekly?.replace(/[^0-9.]/g, '') || '0');
    const monthlyAmount = parseFloat(displayedMonthly?.replace(/[^0-9.]/g, '') || '0');

    // Validate logical relationships
    expect(dailyAmount).toBeLessThanOrEqual(weeklyAmount);
    expect(weeklyAmount).toBeLessThanOrEqual(monthlyAmount);

    // Verify sum of individual transactions matches totals
    await page.click('[data-testid="view-all-transactions"]');
    const transactionRows = page.locator('[data-testid="transaction-row"]');
    const count = await transactionRows.count();

    let calculatedTotal = 0;
    for (let i = 0; i < count; i++) {
      const costText = await transactionRows.nth(i).locator('[data-testid="transaction-cost"]').textContent();
      const cost = parseFloat(costText?.replace(/[^0-9.]/g, '') || '0');
      calculatedTotal += cost;
    }

    // Allow for small rounding differences
    expect(Math.abs(calculatedTotal - monthlyAmount)).toBeLessThan(0.01);
  });

  test('transparency dashboard performance with large datasets', async ({ page }) => {
    // Navigate to dashboard with large date range
    await page.goto('/transparency');
    await page.click('[data-testid="date-range-picker"]');
    await page.fill('[data-testid="start-date"]', '2023-01-01');
    await page.fill('[data-testid="end-date"]', '2024-12-31');

    // Measure load time
    const startTime = Date.now();
    await page.click('[data-testid="apply-date-filter"]');
    await expect(page.locator('[data-testid="data-loaded"]')).toBeVisible();
    const loadTime = Date.now() - startTime;

    // Verify performance is acceptable
    expect(loadTime).toBeLessThan(5000); // 5 seconds max

    // Test pagination for large datasets
    await expect(page.locator('[data-testid="pagination"]')).toBeVisible();
    await page.click('[data-testid="next-page"]');
    await expect(page.locator('[data-testid="page-2"]')).toBeVisible();

    // Test export performance with large dataset
    const exportStartTime = Date.now();
    await page.click('[data-testid="export-csv"]');
    const exportDownloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="confirm-csv-export"]');
    await exportDownloadPromise;
    const exportTime = Date.now() - exportStartTime;

    expect(exportTime).toBeLessThan(10000); // 10 seconds max for large export
  });
});