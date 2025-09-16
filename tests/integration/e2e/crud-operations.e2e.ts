import { test, expect } from '@playwright/test';

/**
 * E2E Test: CRUD Operations with Authorization
 * Tests: Knowledge base CRUD operations with role-based authorization checks
 */
test.describe('CRUD Operations E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveTitle(/Mainframe AI Assistant/);
  });

  test('knowledge base entry creation with authorization', async ({ page }) => {
    // Step 1: Navigate to knowledge base management
    await page.click('[data-testid="knowledge-base-tab"]');
    await expect(page.locator('[data-testid="kb-management"]')).toBeVisible();

    // Step 2: Attempt to create new entry
    await page.click('[data-testid="create-kb-entry"]');
    await expect(page.locator('[data-testid="create-entry-form"]')).toBeVisible();

    // Step 3: Fill in entry details
    await page.fill('[data-testid="entry-title"]', 'Test ABEND S0C7 Analysis');
    await page.fill('[data-testid="entry-content"]', `
      S0C7 ABEND occurs due to data exception.

      Common causes:
      1. Invalid numeric data
      2. Arithmetic overflow
      3. Division by zero
      4. Invalid decimal operations

      Resolution steps:
      - Validate input data
      - Check arithmetic operations
      - Review data conversion logic
    `);
    await page.selectOption('[data-testid="entry-category"]', 'ABEND Analysis');
    await page.fill('[data-testid="entry-tags"]', 'S0C7,ABEND,data exception,arithmetic');
    await page.selectOption('[data-testid="entry-priority"]', 'high');

    // Step 4: Save entry and verify authorization
    await page.click('[data-testid="save-entry"]');
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Entry created successfully');

    // Step 5: Verify entry appears in list
    await page.click('[data-testid="kb-list"]');
    await expect(page.locator('[data-testid="entry-S0C7"]')).toBeVisible();
    await expect(page.locator('[data-testid="entry-S0C7"]')).toContainText('Test ABEND S0C7 Analysis');

    // Step 6: Verify audit trail
    await page.click('[data-testid="admin-panel"]');
    await page.click('[data-testid="audit-log"]');
    await expect(page.locator('[data-testid="audit-entries"]').first()).toContainText('CREATE_KB_ENTRY');
    await expect(page.locator('[data-testid="audit-entries"]').first()).toContainText('S0C7');
  });

  test('knowledge base entry update with version control', async ({ page }) => {
    // Navigate to existing entry
    await page.goto('/knowledge-base');
    await page.click('[data-testid="entry-kb-001"]'); // S0C4 ABEND entry from test data

    // Verify current version
    await expect(page.locator('[data-testid="entry-version"]')).toContainText('v1.0');

    // Edit entry
    await page.click('[data-testid="edit-entry"]');
    await expect(page.locator('[data-testid="edit-form"]')).toBeVisible();

    // Make changes
    const updatedContent = `S0C4 ABEND (System Completion Code 4) indicates a protection exception.

    UPDATED: Common Causes:
    1. Attempting to access storage outside program boundaries
    2. Uninitialized pointers
    3. Array index out of bounds
    4. Corrupted control blocks
    5. Buffer overflow attacks (NEW)

    UPDATED: Diagnostic Steps:
    1. Check the PSW and registers at time of failure
    2. Examine storage dumps for invalid addresses
    3. Review recent program changes
    4. Validate data integrity
    5. Check for security vulnerabilities (NEW)`;

    await page.fill('[data-testid="entry-content"]', updatedContent);
    await page.fill('[data-testid="change-summary"]', 'Added security considerations and buffer overflow detection');

    // Save changes
    await page.click('[data-testid="save-changes"]');
    await expect(page.locator('[data-testid="update-success"]')).toBeVisible();

    // Verify new version
    await expect(page.locator('[data-testid="entry-version"]')).toContainText('v1.1');

    // Check version history
    await page.click('[data-testid="version-history"]');
    await expect(page.locator('[data-testid="version-v1.0"]')).toBeVisible();
    await expect(page.locator('[data-testid="version-v1.1"]')).toBeVisible();
    await expect(page.locator('[data-testid="change-summary-v1.1"]')).toContainText('security considerations');
  });

  test('knowledge base entry deletion with authorization checks', async ({ page }) => {
    // Navigate to entry list
    await page.goto('/knowledge-base');

    // Try to delete entry (should require confirmation)
    await page.click('[data-testid="entry-actions-kb-002"]');
    await page.click('[data-testid="delete-entry"]');

    // Verify deletion confirmation dialog
    await expect(page.locator('[data-testid="delete-confirmation"]')).toBeVisible();
    await expect(page.locator('[data-testid="delete-warning"]')).toContainText('This action cannot be undone');

    // Confirm deletion
    await page.fill('[data-testid="delete-confirmation-text"]', 'DELETE');
    await page.click('[data-testid="confirm-delete"]');

    // Verify entry is removed
    await expect(page.locator('[data-testid="entry-kb-002"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="deletion-success"]')).toContainText('Entry deleted successfully');

    // Verify audit trail
    await page.click('[data-testid="admin-panel"]');
    await page.click('[data-testid="audit-log"]');
    await expect(page.locator('[data-testid="audit-entries"]').first()).toContainText('DELETE_KB_ENTRY');
  });

  test('unauthorized user CRUD operations blocking', async ({ page }) => {
    // Switch to read-only user context
    await page.goto('/logout');
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'user2@test.com'); // Read-only user
    await page.fill('[data-testid="password"]', 'ReadOnlyPassword123!');
    await page.click('[data-testid="login-button"]');

    // Navigate to knowledge base
    await page.goto('/knowledge-base');

    // Verify create button is not visible/disabled
    await expect(page.locator('[data-testid="create-kb-entry"]')).not.toBeVisible();

    // Try to access create URL directly
    await page.goto('/knowledge-base/create');
    await expect(page.locator('[data-testid="unauthorized-message"]')).toContainText('insufficient permissions');

    // Try to edit existing entry
    await page.goto('/knowledge-base');
    await page.click('[data-testid="entry-kb-001"]');
    await expect(page.locator('[data-testid="edit-entry"]')).not.toBeVisible();

    // Try to access edit URL directly
    await page.goto('/knowledge-base/kb-001/edit');
    await expect(page.locator('[data-testid="unauthorized-message"]')).toContainText('insufficient permissions');
  });

  test('bulk operations with authorization', async ({ page }) => {
    // Navigate to knowledge base management
    await page.goto('/knowledge-base/management');

    // Select multiple entries
    await page.check('[data-testid="select-entry-kb-001"]');
    await page.check('[data-testid="select-entry-kb-003"]');

    // Verify bulk actions are available
    await expect(page.locator('[data-testid="bulk-actions"]')).toBeVisible();

    // Test bulk category update
    await page.click('[data-testid="bulk-update-category"]');
    await page.selectOption('[data-testid="new-category"]', 'Performance');
    await page.click('[data-testid="apply-bulk-update"]');

    // Verify update confirmation
    await expect(page.locator('[data-testid="bulk-update-success"]')).toContainText('2 entries updated');

    // Test bulk tag addition
    await page.click('[data-testid="bulk-add-tags"]');
    await page.fill('[data-testid="new-tags"]', 'reviewed,updated');
    await page.click('[data-testid="apply-bulk-tags"]');

    // Verify audit trail for bulk operations
    await page.click('[data-testid="admin-panel"]');
    await page.click('[data-testid="audit-log"]');
    await expect(page.locator('[data-testid="audit-entries"]').first()).toContainText('BULK_UPDATE');
  });

  test('entry approval workflow for non-admin users', async ({ page }) => {
    // Login as regular user
    await page.goto('/logout');
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'user@test.com');
    await page.fill('[data-testid="password"]', 'UserPassword123!');
    await page.click('[data-testid="login-button"]');

    // Create entry that requires approval
    await page.goto('/knowledge-base');
    await page.click('[data-testid="create-kb-entry"]');

    await page.fill('[data-testid="entry-title"]', 'IMS Database Optimization Guide');
    await page.fill('[data-testid="entry-content"]', 'Comprehensive guide for IMS database performance optimization...');
    await page.selectOption('[data-testid="entry-category"]', 'Performance');
    await page.click('[data-testid="save-entry"]');

    // Verify entry is in pending approval status
    await expect(page.locator('[data-testid="approval-pending"]')).toContainText('Pending approval');

    // Switch to admin user to approve
    await page.goto('/logout');
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'admin@test.com');
    await page.fill('[data-testid="password"]', 'AdminPassword123!');
    await page.click('[data-testid="login-button"]');

    // Navigate to approval queue
    await page.goto('/admin/approval-queue');
    await expect(page.locator('[data-testid="pending-entries"]')).toContainText('IMS Database Optimization');

    // Approve entry
    await page.click('[data-testid="approve-entry"]');
    await page.fill('[data-testid="approval-comments"]', 'Good content, approved for publication');
    await page.click('[data-testid="confirm-approval"]');

    // Verify entry is now published
    await page.goto('/knowledge-base');
    await expect(page.locator('[data-testid="entry-ims-optimization"]')).toBeVisible();
    await expect(page.locator('[data-testid="entry-status"]')).toContainText('Published');
  });

  test('concurrent editing detection and resolution', async ({ page }) => {
    // Open entry in first browser context
    await page.goto('/knowledge-base/kb-001/edit');
    await expect(page.locator('[data-testid="edit-form"]')).toBeVisible();

    // Open same entry in second browser context
    const secondPage = await page.context().newPage();
    await secondPage.goto('/login');
    await secondPage.fill('[data-testid="email"]', 'admin@test.com');
    await secondPage.fill('[data-testid="password"]', 'AdminPassword123!');
    await secondPage.click('[data-testid="login-button"]');
    await secondPage.goto('/knowledge-base/kb-001/edit');

    // Verify concurrent editing warning
    await expect(secondPage.locator('[data-testid="concurrent-edit-warning"]')).toContainText('currently being edited');

    // Make changes in first context
    await page.fill('[data-testid="entry-content"]', 'Updated content from first user');
    await page.click('[data-testid="save-changes"]');

    // Try to save changes in second context
    await secondPage.fill('[data-testid="entry-content"]', 'Updated content from second user');
    await secondPage.click('[data-testid="save-changes"]');

    // Verify conflict resolution dialog
    await expect(secondPage.locator('[data-testid="merge-conflict-dialog"]')).toBeVisible();
    await expect(secondPage.locator('[data-testid="conflict-resolution-options"]')).toBeVisible();

    // Resolve conflict by merging
    await secondPage.click('[data-testid="merge-changes"]');
    await expect(secondPage.locator('[data-testid="merge-success"]')).toBeVisible();

    await secondPage.close();
  });
});