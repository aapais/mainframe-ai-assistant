/**
 * Complex Keyboard Interactions Test Suite
 *
 * Tests advanced keyboard navigation scenarios:
 * - Multi-step workflows
 * - Complex form interactions
 * - Data table navigation
 * - Custom component keyboard handling
 * - Error recovery scenarios
 *
 * @author Keyboard Navigation Specialist
 * @version 1.0.0
 */

import { test, expect, Page } from '@playwright/test';
import { KeyboardTestUtils, ARIA_PATTERNS, COMMON_SHORTCUTS } from './keyboard-test-utils';

test.describe('Complex Keyboard Interactions', () => {
  let keyboardUtils: KeyboardTestUtils;

  test.beforeEach(async ({ page }) => {
    keyboardUtils = new KeyboardTestUtils(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('validates complete search workflow with keyboard only', async ({ page }) => {
    // Step 1: Navigate to search using skip link
    await page.keyboard.press('Tab'); // Skip link
    const skipLink = await page.evaluate(() => {
      const el = document.activeElement;
      return el?.textContent?.toLowerCase().includes('skip') ? el : null;
    });

    if (skipLink) {
      await page.keyboard.press('Enter');
    }

    // Step 2: Find and focus search input
    const searchInput = page.locator('input[type="text"], input[placeholder*="search" i]').first();
    await expect(searchInput).toBeVisible();
    await searchInput.focus();

    // Step 3: Enter search query
    await searchInput.fill('VSAM error 35');

    // Step 4: Navigate search suggestions with arrow keys
    await page.waitForTimeout(500); // Allow suggestions to appear
    const suggestions = page.locator('[role="listbox"] [role="option"], .suggestion-item');
    const suggestionCount = await suggestions.count();

    if (suggestionCount > 0) {
      await page.keyboard.press('ArrowDown'); // First suggestion
      await page.keyboard.press('ArrowDown'); // Second suggestion
      await page.keyboard.press('Enter'); // Select suggestion
    } else {
      await page.keyboard.press('Enter'); // Submit search
    }

    // Step 5: Navigate search results
    await page.waitForTimeout(1000); // Allow results to load

    const results = page.locator('[role="region"] article, .search-result, .kb-entry');
    const resultCount = await results.count();

    if (resultCount > 0) {
      // Tab to first result
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab'); // May need multiple tabs to reach results

      // Navigate through results
      for (let i = 0; i < Math.min(3, resultCount); i++) {
        await page.keyboard.press('Tab');

        // Verify we can interact with result
        const activeElement = await page.evaluate(() => document.activeElement?.tagName.toLowerCase());
        expect(['a', 'button', 'article'].includes(activeElement || '')).toBe(true);
      }

      // Open a result
      await page.keyboard.press('Enter');

      // Step 6: Navigate within entry details
      await page.waitForTimeout(500);

      // Should be able to navigate through entry content
      await page.keyboard.press('Tab'); // Entry title
      await page.keyboard.press('Tab'); // Entry content
      await page.keyboard.press('Tab'); // Actions (copy, rate, etc.)

      // Step 7: Rate the solution using keyboard
      const ratingButtons = page.locator('button').filter({ hasText: /helpful|rate|thumb/i });
      const ratingCount = await ratingButtons.count();

      if (ratingCount > 0) {
        const firstRating = ratingButtons.first();
        await firstRating.focus();
        await page.keyboard.press('Enter');

        // Verify rating was recorded (check for confirmation message)
        const confirmation = page.locator('[role="status"], .success, .confirmation');
        if (await confirmation.isVisible()) {
          expect(await confirmation.textContent()).toBeTruthy();
        }
      }

      // Step 8: Return to search using keyboard
      await page.keyboard.press('Escape'); // Close details
    }

    // Verify we're back at search interface
    const backAtSearch = await searchInput.isVisible();
    expect(backAtSearch).toBe(true);
  });

  test('validates form creation workflow with keyboard navigation', async ({ page }) => {
    // Step 1: Navigate to create entry form
    const createButton = page.locator('button, a').filter({ hasText: /add|create|new/i }).first();

    if (await createButton.isVisible()) {
      await createButton.focus();
      await page.keyboard.press('Enter');
    } else {
      // Use keyboard shortcut if available
      await page.keyboard.press('Control+n');
    }

    // Wait for form to load
    await page.waitForTimeout(500);
    const form = page.locator('form').first();
    await expect(form).toBeVisible();

    // Step 2: Fill title field
    const titleField = form.locator('input[name*="title"], input[id*="title"]').first();
    await titleField.focus();
    await titleField.fill('VSAM Status 35 - File Not Found Error');

    // Step 3: Navigate to category field using Tab
    await page.keyboard.press('Tab');

    const categoryField = page.locator('select, [role="combobox"]').first();
    if (await categoryField.isVisible()) {
      // Test dropdown navigation
      await page.keyboard.press('ArrowDown'); // Open dropdown
      await page.keyboard.press('ArrowDown'); // Navigate options
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter'); // Select option
    }

    // Step 4: Fill problem description
    let currentField = await page.evaluate(() => document.activeElement?.tagName.toLowerCase());

    // Navigate to textarea (problem field)
    while (currentField !== 'textarea') {
      await page.keyboard.press('Tab');
      currentField = await page.evaluate(() => document.activeElement?.tagName.toLowerCase());

      // Prevent infinite loop
      if (currentField === 'button') break;
    }

    if (currentField === 'textarea') {
      await page.keyboard.type('Job fails with VSAM error 35 when trying to access dataset PROD.VSAM.FILE. Error occurs during file open operation.');
    }

    // Step 5: Fill solution field
    await page.keyboard.press('Tab');
    currentField = await page.evaluate(() => document.activeElement?.tagName.toLowerCase());

    if (currentField === 'textarea') {
      await page.keyboard.type(`1. Check if dataset exists using LISTCAT command
2. Verify dataset allocation parameters
3. Ensure proper VSAM authorization
4. Check for dataset corruption using VERIFY command`);
    }

    // Step 6: Add tags using keyboard
    const tagInput = form.locator('input[placeholder*="tag" i]');
    if (await tagInput.isVisible()) {
      await tagInput.focus();
      await tagInput.fill('vsam');
      await page.keyboard.press('Enter'); // Add tag

      await tagInput.fill('error-35');
      await page.keyboard.press('Enter'); // Add another tag

      await tagInput.fill('file-not-found');
      await page.keyboard.press('Tab'); // Move away from tag input
    }

    // Step 7: Test form validation
    const submitButton = form.locator('button[type="submit"]').first();
    await submitButton.focus();

    // Clear a required field to test validation
    await titleField.focus();
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Delete');

    // Try to submit
    await submitButton.focus();
    await page.keyboard.press('Enter');

    // Should show validation errors
    const errorMessage = page.locator('[role="alert"], .error, [aria-invalid="true"]').first();
    if (await errorMessage.isVisible()) {
      // Error should be accessible
      const errorText = await errorMessage.textContent();
      expect(errorText).toBeTruthy();

      // Should be able to navigate to error field
      const errorLink = page.locator('button').filter({ hasText: /title|error/i }).first();
      if (await errorLink.isVisible()) {
        await errorLink.focus();
        await page.keyboard.press('Enter');

        // Focus should move to title field
        const focusedElement = await page.evaluate(() => document.activeElement);
        expect(focusedElement).toBe(await titleField.elementHandle());
      }
    }

    // Step 8: Fix validation error and submit
    await titleField.fill('VSAM Status 35 - File Not Found Error');

    // Use keyboard shortcut to submit
    await page.keyboard.press('Control+s');

    // Should show success message or redirect
    await page.waitForTimeout(1000);
    const successMessage = page.locator('[role="status"], .success').first();
    if (await successMessage.isVisible()) {
      expect(await successMessage.textContent()).toContain('success');
    }
  });

  test('validates data table keyboard navigation', async ({ page }) => {
    // Look for data tables or grids
    const table = page.locator('table, [role="grid"], [role="table"]').first();

    if (await table.isVisible()) {
      // Navigate to table
      await table.focus();

      const cells = table.locator('td, th, [role="gridcell"], [role="columnheader"]');
      const cellCount = await cells.count();

      if (cellCount > 0) {
        const firstCell = cells.first();
        await firstCell.focus();

        // Test arrow key navigation
        await page.keyboard.press('ArrowRight'); // Next column
        await page.keyboard.press('ArrowDown');  // Next row
        await page.keyboard.press('ArrowLeft');  // Previous column
        await page.keyboard.press('ArrowUp');    // Previous row

        // Test home/end navigation
        await page.keyboard.press('Home');       // First cell in row
        await page.keyboard.press('End');        // Last cell in row
        await page.keyboard.press('Control+Home'); // First cell in table
        await page.keyboard.press('Control+End');  // Last cell in table

        // Test page navigation if table is large
        if (cellCount > 20) {
          await page.keyboard.press('PageDown');
          await page.keyboard.press('PageUp');
        }

        // Verify focus is still within table
        const finalFocus = await page.evaluate(() => {
          const el = document.activeElement;
          return el?.closest('table, [role="grid"], [role="table"]') !== null;
        });

        expect(finalFocus).toBe(true);
      }
    }
  });

  test('validates modal dialog keyboard interaction and focus trapping', async ({ page }) => {
    // Find modal trigger
    const modalTrigger = page.locator('button, a').filter({
      hasText: /modal|dialog|open|settings|help|about/i
    }).first();

    if (await modalTrigger.isVisible()) {
      // Store current focus
      const initialFocus = await keyboardUtils.getCurrentFocusInfo();

      // Open modal
      await modalTrigger.focus();
      await page.keyboard.press('Enter');

      // Wait for modal to appear
      const modal = page.locator('[role="dialog"], [aria-modal="true"]').first();
      await expect(modal).toBeVisible();

      // Test focus trapping
      const trapResult = await keyboardUtils.testFocusTrapping('[role="dialog"], [aria-modal="true"]');
      expect(trapResult).toBe(true);

      // Test escape key closes modal
      await page.keyboard.press('Escape');
      await expect(modal).not.toBeVisible();

      // Focus should return to trigger
      const finalFocus = await keyboardUtils.getCurrentFocusInfo();
      expect(finalFocus?.element).toContain(initialFocus?.element || '');
    }
  });

  test('validates keyboard shortcuts and accelerators', async ({ page }) => {
    const shortcutResults = await keyboardUtils.testKeyboardShortcuts(COMMON_SHORTCUTS);

    // At least some shortcuts should work
    const workingShortcuts = shortcutResults.filter(result => result.works);
    expect(workingShortcuts.length).toBeGreaterThan(0);

    // Test application-specific shortcuts
    const appShortcuts = [
      { keys: 'Control+f', description: 'Focus search' },
      { keys: 'Control+n', description: 'New entry' },
      { keys: '?', description: 'Show help' },
      { keys: 'g h', description: 'Go to home' }, // Vim-style navigation
      { keys: 'g s', description: 'Go to search' }
    ];

    for (const shortcut of appShortcuts) {
      await page.keyboard.press(shortcut.keys);
      await page.waitForTimeout(200);

      // Basic test - ensure no JavaScript errors occurred
      const hasErrors = await page.evaluate(() => {
        return (window as any).hasJavaScriptErrors || false;
      });

      expect(hasErrors).toBeFalsy();
    }
  });

  test('validates custom dropdown/combobox keyboard interaction', async ({ page }) => {
    const combobox = page.locator('[role="combobox"]').first();

    if (await combobox.isVisible()) {
      await combobox.focus();

      // Test opening dropdown
      await page.keyboard.press('ArrowDown');

      const isExpanded = await combobox.getAttribute('aria-expanded');
      expect(isExpanded).toBe('true');

      // Test option navigation
      const options = page.locator('[role="option"]');
      const optionCount = await options.count();

      if (optionCount > 0) {
        // Navigate through options
        for (let i = 0; i < Math.min(3, optionCount); i++) {
          await page.keyboard.press('ArrowDown');

          // Check that option is selected/highlighted
          const selectedOption = page.locator('[role="option"][aria-selected="true"]');
          expect(await selectedOption.isVisible()).toBe(true);
        }

        // Test selection
        await page.keyboard.press('Enter');

        // Dropdown should close
        const finalExpanded = await combobox.getAttribute('aria-expanded');
        expect(finalExpanded).toBe('false');

        // Value should be selected
        const value = await combobox.inputValue();
        expect(value).toBeTruthy();
      }

      // Test escape closes dropdown
      await page.keyboard.press('ArrowDown'); // Reopen
      await page.keyboard.press('Escape');

      const escapedExpanded = await combobox.getAttribute('aria-expanded');
      expect(escapedExpanded).toBe('false');
    }
  });

  test('validates tab panel keyboard navigation', async ({ page }) => {
    const tabList = page.locator('[role="tablist"]').first();

    if (await tabList.isVisible()) {
      const tabs = tabList.locator('[role="tab"]');
      const tabCount = await tabs.count();

      if (tabCount > 1) {
        // Focus first tab
        const firstTab = tabs.first();
        await firstTab.focus();

        // Test arrow key navigation
        await page.keyboard.press('ArrowRight');

        // Second tab should be focused and selected
        const secondTab = tabs.nth(1);
        expect(await secondTab.evaluate(el => el === document.activeElement)).toBe(true);

        const isSelected = await secondTab.getAttribute('aria-selected');
        expect(isSelected).toBe('true');

        // Test Home/End keys
        await page.keyboard.press('End');
        const lastTab = tabs.last();
        expect(await lastTab.evaluate(el => el === document.activeElement)).toBe(true);

        await page.keyboard.press('Home');
        expect(await firstTab.evaluate(el => el === document.activeElement)).toBe(true);

        // Test activation
        await page.keyboard.press('Enter');

        // Associated tab panel should be visible
        const tabPanel = page.locator('[role="tabpanel"]').first();
        if (await tabPanel.isVisible()) {
          const isActivePanel = await tabPanel.getAttribute('aria-hidden');
          expect(isActivePanel).not.toBe('true');
        }
      }
    }
  });

  test('validates error recovery and help access', async ({ page }) => {
    // Test help access
    await page.keyboard.press('F1');
    await page.waitForTimeout(500);

    let helpVisible = await page.locator('[role="dialog"]').filter({ hasText: /help/i }).isVisible();

    if (!helpVisible) {
      // Try ? key for help
      await page.keyboard.press('?');
      await page.waitForTimeout(500);
      helpVisible = await page.locator('[role="dialog"]').filter({ hasText: /help/i }).isVisible();
    }

    if (helpVisible) {
      // Help should be keyboard accessible
      await page.keyboard.press('Tab');
      const focusInHelp = await page.evaluate(() => {
        const el = document.activeElement;
        return el?.closest('[role="dialog"]') !== null;
      });
      expect(focusInHelp).toBe(true);

      // Close help
      await page.keyboard.press('Escape');
    }

    // Test error recovery - trigger an error and ensure keyboard navigation still works
    const form = page.locator('form').first();
    if (await form.isVisible()) {
      // Submit empty form to trigger validation
      const submitButton = form.locator('button[type="submit"]').first();
      await submitButton.focus();
      await page.keyboard.press('Enter');

      // Errors should be keyboard accessible
      const errorElements = page.locator('[role="alert"], .error');
      const errorCount = await errorElements.count();

      if (errorCount > 0) {
        // Should be able to navigate to errors
        for (let i = 0; i < Math.min(3, errorCount); i++) {
          const error = errorElements.nth(i);
          if (await error.isVisible()) {
            // Error should be reachable via keyboard
            const isAccessible = await error.evaluate(el => {
              return el.tabIndex >= 0 ||
                     el.querySelector('button, a, [tabindex]') !== null ||
                     el.closest('button, a, [tabindex]') !== null;
            });

            expect(isAccessible).toBe(true);
          }
        }
      }
    }
  });

  test('validates complex multi-step workflow preservation', async ({ page }) => {
    // Start a multi-step process
    const searchInput = page.locator('input[type="text"]').first();

    if (await searchInput.isVisible()) {
      // Step 1: Perform search
      await searchInput.focus();
      await searchInput.fill('JCL error');
      await page.keyboard.press('Enter');

      await page.waitForTimeout(1000);

      // Step 2: Open first result
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab'); // Navigate to first result
      await page.keyboard.press('Enter');

      await page.waitForTimeout(500);

      // Step 3: Navigate within result
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');

      // Step 4: Test interruption and recovery
      // Open modal or navigate away
      await page.keyboard.press('Control+f'); // Try to open search

      // Return to original workflow
      await page.keyboard.press('Escape');

      // Should be able to continue workflow
      await page.keyboard.press('Tab');

      const focusedElement = await page.evaluate(() => {
        const el = document.activeElement;
        return el ? {
          tagName: el.tagName.toLowerCase(),
          role: el.getAttribute('role'),
          text: el.textContent?.substring(0, 50)
        } : null;
      });

      expect(focusedElement).toBeTruthy();
    }
  });

  test.afterEach(async ({ page }) => {
    // Generate keyboard accessibility report
    const report = await keyboardUtils.generateKeyboardReport();

    // Log report for analysis
    console.log('Keyboard Accessibility Report:', JSON.stringify(report, null, 2));

    // Store report data for CI/CD integration
    await page.evaluate((reportData) => {
      (window as any).keyboardAccessibilityReport = reportData;
    }, report);
  });
});