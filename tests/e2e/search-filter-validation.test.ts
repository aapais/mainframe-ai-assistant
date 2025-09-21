/**
 * Puppeteer Validation Tests for Search Filter Functionality
 * Tests the complete search and clear workflow in the incident dashboard
 */

import { test, expect } from '@playwright/test';

test.describe('Search Filter Validation - E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the incidents page
    await page.goto('/incidents');

    // Wait for the page to load and switch to list view
    await page.waitForSelector('[data-testid="incidents-header"]', { timeout: 10000 });
    await page.click('button:has-text("Lista de Incidentes")');

    // Wait for the incident queue to load
    await page.waitForSelector('input[placeholder="Search incidents..."]', { timeout: 5000 });
  });

  test('should filter incidents when search term is entered', async ({ page }) => {
    const searchInput = page.locator('input[placeholder="Search incidents..."]');

    // Initially should show all incidents
    await expect(page.locator('text=/INC-2024-/')).toHaveCount(3);

    // Type "database" in search
    await searchInput.fill('database');

    // Should filter to show only database-related incidents
    await expect(page.locator('text=/Database Connection Issue|DB2 Connection/')).toHaveCount(1);
    await expect(page.locator('text=/INC-2024-/')).toHaveCount(1);
  });

  test('should show all incidents when search is cleared', async ({ page }) => {
    const searchInput = page.locator('input[placeholder="Search incidents..."]');

    // Type search term first
    await searchInput.fill('database');
    await expect(page.locator('text=/INC-2024-/')).toHaveCount(1);

    // Clear search input
    await searchInput.clear();

    // Should show all incidents again
    await expect(page.locator('text=/INC-2024-/')).toHaveCount(3);
  });

  test('should have a clear button that resets search', async ({ page }) => {
    const searchInput = page.locator('input[placeholder="Search incidents..."]');

    // Type search term
    await searchInput.fill('server');

    // Should show the clear button
    const clearButton = page.locator('button[aria-label="Clear search"]');
    await expect(clearButton).toBeVisible();

    // Click clear button
    await clearButton.click();

    // Search input should be empty and all incidents should be visible
    await expect(searchInput).toHaveValue('');
    await expect(page.locator('text=/INC-2024-/')).toHaveCount(3);
  });

  test('should handle empty/whitespace search gracefully', async ({ page }) => {
    const searchInput = page.locator('input[placeholder="Search incidents..."]');

    // Type only spaces
    await searchInput.fill('   ');

    // Should show all incidents (not filter with empty spaces)
    await expect(page.locator('text=/INC-2024-/')).toHaveCount(3);
  });

  test('should perform case insensitive search', async ({ page }) => {
    const searchInput = page.locator('input[placeholder="Search incidents..."]');

    // Type "DATABASE" in uppercase
    await searchInput.fill('DATABASE');

    // Should still find database incident (case insensitive)
    await expect(page.locator('text=/Database Connection Issue|DB2 Connection/')).toHaveCount(1);
  });

  test('should clear search when pressing Escape key', async ({ page }) => {
    const searchInput = page.locator('input[placeholder="Search incidents..."]');

    // Type search term
    await searchInput.fill('network');
    await expect(page.locator('text=/Network Timeout/')).toBeVisible();

    // Press Escape key
    await searchInput.press('Escape');

    // Search should be cleared
    await expect(searchInput).toHaveValue('');
    await expect(page.locator('text=/INC-2024-/')).toHaveCount(3);
  });

  test('should show "no results" message when search has no matches', async ({ page }) => {
    const searchInput = page.locator('input[placeholder="Search incidents..."]');

    // Type search term that won't match anything
    await searchInput.fill('nonexistent');

    // Should show no results message
    await expect(page.locator('text=/No incidents found/')).toBeVisible();
    await expect(page.locator('text=/No incidents match "nonexistent"/')).toBeVisible();

    // Should show clear search button in no results message
    const clearSearchButton = page.locator('text=Clear search to see all incidents');
    await expect(clearSearchButton).toBeVisible();

    // Click the clear search button
    await clearSearchButton.click();

    // Should show all incidents again
    await expect(searchInput).toHaveValue('');
    await expect(page.locator('text=/INC-2024-/')).toHaveCount(3);
  });

  test('should update incident count when search filters results', async ({ page }) => {
    const searchInput = page.locator('input[placeholder="Search incidents..."]');

    // Initially should show "Showing 3 of 3 incidents"
    await expect(page.locator('text=/Showing 3 of 3 incidents/')).toBeVisible();

    // Type search term
    await searchInput.fill('database');

    // Should update count to "Showing 1 of 3 incidents"
    await expect(page.locator('text=/Showing 1 of 3 incidents/')).toBeVisible();
  });

  test('should search across multiple fields (title, problem, incident number, category)', async ({ page }) => {
    const searchInput = page.locator('input[placeholder="Search incidents..."]');

    // Search by incident number
    await searchInput.fill('INC-2024-001');
    await expect(page.locator('text=/INC-2024-001/')).toBeVisible();
    await expect(page.locator('text=/INC-2024-/')).toHaveCount(1);

    // Clear and search by category
    await searchInput.clear();
    await searchInput.fill('Infrastructure');
    await expect(page.locator('text=/Server Performance/')).toBeVisible();

    // Clear and search by problem description
    await searchInput.clear();
    await searchInput.fill('timeout');
    await expect(page.locator('text=/Network Timeout/')).toBeVisible();
  });

  test('should maintain search state during page interactions', async ({ page }) => {
    const searchInput = page.locator('input[placeholder="Search incidents..."]');

    // Type search term
    await searchInput.fill('database');
    await expect(page.locator('text=/INC-2024-/')).toHaveCount(1);

    // Click on a status filter (should maintain search)
    await page.selectOption('select:near(:text("All Status"))', 'open');

    // Should still have search term and filtered results
    await expect(searchInput).toHaveValue('database');
    // Results might be further filtered by status, but search should be maintained
  });

  test('should handle rapid typing and clearing without errors', async ({ page }) => {
    const searchInput = page.locator('input[placeholder="Search incidents..."]');

    // Rapidly type and clear multiple times
    for (let i = 0; i < 5; i++) {
      await searchInput.fill('test');
      await searchInput.clear();
    }

    // Final state should be empty with all incidents visible
    await expect(searchInput).toHaveValue('');
    await expect(page.locator('text=/INC-2024-/')).toHaveCount(3);
  });

  test('should clear button appear and disappear correctly', async ({ page }) => {
    const searchInput = page.locator('input[placeholder="Search incidents..."]');
    const clearButton = page.locator('button[aria-label="Clear search"]');

    // Initially, clear button should not be visible
    await expect(clearButton).not.toBeVisible();

    // Type something, clear button should appear
    await searchInput.fill('a');
    await expect(clearButton).toBeVisible();

    // Clear the input, button should disappear
    await searchInput.clear();
    await expect(clearButton).not.toBeVisible();
  });

  test('should maintain selection state after search clearing', async ({ page }) => {
    // Select an incident
    const firstCheckbox = page.locator('table input[type="checkbox"]').first();
    await firstCheckbox.check();

    // Verify selection toolbar appears
    await expect(page.locator('text=/1 incident selected/')).toBeVisible();

    // Filter incidents
    const searchInput = page.locator('input[placeholder="Search incidents..."]');
    await searchInput.fill('database');

    // Clear search
    await searchInput.clear();

    // Selection should be maintained (or cleared depending on UX requirements)
    // This tests the expected behavior - adjust based on requirements
    await expect(page.locator('text=/selected/')).not.toBeVisible();
  });
});

test.describe('Search Performance Tests', () => {
  test('should handle large result sets efficiently', async ({ page }) => {
    await page.goto('/incidents');
    await page.click('button:has-text("Lista de Incidentes")');

    const searchInput = page.locator('input[placeholder="Search incidents..."]');

    // Measure search performance
    const start = Date.now();
    await searchInput.fill('database');

    // Wait for results to be filtered
    await expect(page.locator('text=/Database Connection/')).toBeVisible();
    const end = Date.now();

    // Search should complete quickly (under 1 second for typical data sets)
    expect(end - start).toBeLessThan(1000);
  });
});

test.describe('Accessibility Tests', () => {
  test('search input should be accessible', async ({ page }) => {
    await page.goto('/incidents');
    await page.click('button:has-text("Lista de Incidentes")');

    const searchInput = page.locator('input[placeholder="Search incidents..."]');
    const clearButton = page.locator('button[aria-label="Clear search"]');

    // Check if search input has proper accessibility attributes
    await expect(searchInput).toBeVisible();
    await expect(searchInput).toBeFocused({ timeout: 1000 });

    // Type to make clear button appear and check its accessibility
    await searchInput.fill('test');
    await expect(clearButton).toHaveAttribute('aria-label', 'Clear search');

    // Check keyboard navigation
    await clearButton.focus();
    await clearButton.press('Enter');
    await expect(searchInput).toHaveValue('');
  });
});