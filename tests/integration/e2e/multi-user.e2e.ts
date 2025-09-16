import { test, expect } from '@playwright/test';

/**
 * E2E Test: Multi-User Scenarios
 * Tests: Different user roles, preferences, and concurrent usage patterns
 */
test.describe('Multi-User Scenarios E2E', () => {
  test('admin user full access and management capabilities', async ({ page }) => {
    // Login as admin
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'admin@test.com');
    await page.fill('[data-testid="password"]', 'AdminPassword123!');
    await page.click('[data-testid="login-button"]');

    // Verify admin dashboard access
    await expect(page.locator('[data-testid="admin-dashboard"]')).toBeVisible();
    await expect(page.locator('[data-testid="user-management"]')).toBeVisible();
    await expect(page.locator('[data-testid="system-configuration"]')).toBeVisible();

    // Test user management capabilities
    await page.click('[data-testid="user-management"]');
    await expect(page.locator('[data-testid="create-user"]')).toBeVisible();
    await expect(page.locator('[data-testid="user-list"]')).toBeVisible();

    // Create new user
    await page.click('[data-testid="create-user"]');
    await page.fill('[data-testid="new-user-email"]', 'newuser@test.com');
    await page.fill('[data-testid="new-user-username"]', 'newuser');
    await page.selectOption('[data-testid="new-user-role"]', 'user');
    await page.fill('[data-testid="new-user-daily-budget"]', '20.00');
    await page.fill('[data-testid="new-user-weekly-budget"]', '100.00');
    await page.fill('[data-testid="new-user-monthly-budget"]', '400.00');
    await page.click('[data-testid="save-new-user"]');

    // Verify user creation
    await expect(page.locator('[data-testid="user-creation-success"]')).toContainText('User created successfully');
    await expect(page.locator('[data-testid="user-newuser"]')).toBeVisible();

    // Test system configuration access
    await page.click('[data-testid="system-configuration"]');
    await expect(page.locator('[data-testid="api-settings"]')).toBeVisible();
    await expect(page.locator('[data-testid="security-settings"]')).toBeVisible();
    await expect(page.locator('[data-testid="performance-settings"]')).toBeVisible();

    // Verify admin can access all knowledge base entries
    await page.goto('/knowledge-base');
    await expect(page.locator('[data-testid="admin-only-entries"]')).toBeVisible();
    await expect(page.locator('[data-testid="create-kb-entry"]')).toBeVisible();
    await expect(page.locator('[data-testid="bulk-operations"]')).toBeVisible();
  });

  test('regular user restricted access and functionality', async ({ page }) => {
    // Login as regular user
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'user@test.com');
    await page.fill('[data-testid="password"]', 'UserPassword123!');
    await page.click('[data-testid="login-button"]');

    // Verify user dashboard (no admin features)
    await expect(page.locator('[data-testid="user-dashboard"]')).toBeVisible();
    await expect(page.locator('[data-testid="admin-dashboard"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="user-management"]')).not.toBeVisible();

    // Test search functionality with budget awareness
    await page.click('[data-testid="search-tab"]');
    await expect(page.locator('[data-testid="budget-display"]')).toBeVisible();
    await expect(page.locator('[data-testid="remaining-budget"]')).toContainText('$');

    // Test knowledge base access (read/write permissions)
    await page.goto('/knowledge-base');
    await expect(page.locator('[data-testid="create-kb-entry"]')).toBeVisible(); // Users can create
    await expect(page.locator('[data-testid="bulk-operations"]')).not.toBeVisible(); // But not bulk ops

    // Create knowledge base entry
    await page.click('[data-testid="create-kb-entry"]');
    await page.fill('[data-testid="entry-title"]', 'User Created Entry');
    await page.fill('[data-testid="entry-content"]', 'Content created by regular user');
    await page.selectOption('[data-testid="entry-category"]', 'General');
    await page.click('[data-testid="save-entry"]');

    // Verify entry requires approval
    await expect(page.locator('[data-testid="pending-approval"]')).toContainText('Pending approval');

    // Test user preferences
    await page.click('[data-testid="user-menu"]');
    await page.click('[data-testid="preferences"]');
    await expect(page.locator('[data-testid="theme-selection"]')).toBeVisible();
    await expect(page.locator('[data-testid="notification-settings"]')).toBeVisible();
    await expect(page.locator('[data-testid="export-preferences"]')).toBeVisible();
  });

  test('read-only user limited access', async ({ page }) => {
    // Login as read-only user
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'user2@test.com');
    await page.fill('[data-testid="password"]', 'ReadOnlyPassword123!');
    await page.click('[data-testid="login-button"]');

    // Verify read-only dashboard
    await expect(page.locator('[data-testid="readonly-notice"]')).toContainText('Read-only access');

    // Test search functionality (should work with limited AI)
    await page.click('[data-testid="search-tab"]');
    await page.fill('[data-testid="search-input"]', 'S0C4 ABEND');
    await page.click('[data-testid="search-button"]');
    await expect(page.locator('[data-testid="search-results"]')).toBeVisible();

    // AI search should have restrictions
    await page.check('[data-testid="ai-search-toggle"]');
    await page.click('[data-testid="search-button"]');
    await expect(page.locator('[data-testid="ai-restricted-message"]')).toContainText('AI features limited');

    // Knowledge base should be read-only
    await page.goto('/knowledge-base');
    await expect(page.locator('[data-testid="create-kb-entry"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="edit-entry"]')).not.toBeVisible();

    // Can view but not modify
    await page.click('[data-testid="entry-kb-001"]');
    await expect(page.locator('[data-testid="entry-content"]')).toBeVisible();
    await expect(page.locator('[data-testid="edit-button"]')).not.toBeVisible();
  });

  test('concurrent user sessions and resource management', async ({ browser }) => {
    // Create multiple browser contexts for different users
    const adminContext = await browser.newContext();
    const user1Context = await browser.newContext();
    const user2Context = await browser.newContext();

    const adminPage = await adminContext.newPage();
    const user1Page = await user1Context.newPage();
    const user2Page = await user2Context.newPage();

    // Login all users simultaneously
    await Promise.all([
      // Admin login
      adminPage.goto('/login').then(() =>
        adminPage.fill('[data-testid="email"]', 'admin@test.com').then(() =>
          adminPage.fill('[data-testid="password"]', 'AdminPassword123!').then(() =>
            adminPage.click('[data-testid="login-button"]')
          )
        )
      ),
      // User 1 login
      user1Page.goto('/login').then(() =>
        user1Page.fill('[data-testid="email"]', 'user@test.com').then(() =>
          user1Page.fill('[data-testid="password"]', 'UserPassword123!').then(() =>
            user1Page.click('[data-testid="login-button"]')
          )
        )
      ),
      // User 2 login
      user2Page.goto('/login').then(() =>
        user2Page.fill('[data-testid="email"]', 'user2@test.com').then(() =>
          user2Page.fill('[data-testid="password"]', 'ReadOnlyPassword123!').then(() =>
            user2Page.click('[data-testid="login-button"]')
          )
        )
      )
    ]);

    // Verify all users are logged in
    await expect(adminPage.locator('[data-testid="admin-dashboard"]')).toBeVisible();
    await expect(user1Page.locator('[data-testid="user-dashboard"]')).toBeVisible();
    await expect(user2Page.locator('[data-testid="readonly-notice"]')).toBeVisible();

    // Test concurrent AI searches
    await Promise.all([
      user1Page.goto('/dashboard').then(() =>
        user1Page.click('[data-testid="search-tab"]').then(() =>
          user1Page.fill('[data-testid="search-input"]', 'CICS performance tuning').then(() =>
            user1Page.check('[data-testid="ai-search-toggle"]').then(() =>
              user1Page.click('[data-testid="search-button"]').then(() =>
                user1Page.click('[data-testid="confirm-ai-search"]')
              )
            )
          )
        )
      ),
      user2Page.goto('/dashboard').then(() =>
        user2Page.click('[data-testid="search-tab"]').then(() =>
          user2Page.fill('[data-testid="search-input"]', 'JCL optimization').then(() =>
            user2Page.click('[data-testid="search-button"]')
          )
        )
      )
    ]);

    // Monitor admin dashboard for concurrent usage
    await adminPage.goto('/admin/real-time-monitoring');
    await expect(adminPage.locator('[data-testid="active-users"]')).toContainText('3');
    await expect(adminPage.locator('[data-testid="concurrent-searches"]')).toContainText('2');

    // Cleanup
    await adminContext.close();
    await user1Context.close();
    await user2Context.close();
  });

  test('user preference customization and persistence', async ({ page }) => {
    // Login as user
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'user@test.com');
    await page.fill('[data-testid="password"]', 'UserPassword123!');
    await page.click('[data-testid="login-button"]');

    // Navigate to preferences
    await page.click('[data-testid="user-menu"]');
    await page.click('[data-testid="preferences"]');

    // Customize theme
    await page.selectOption('[data-testid="theme-selection"]', 'dark');
    await expect(page.locator('body')).toHaveClass(/dark-theme/);

    // Customize notifications
    await page.check('[data-testid="email-notifications"]');
    await page.uncheck('[data-testid="browser-notifications"]');
    await page.selectOption('[data-testid="notification-frequency"]', 'weekly');

    // Customize export preferences
    await page.selectOption('[data-testid="default-export-format"]', 'pdf');
    await page.check('[data-testid="include-metadata"]');

    // Customize search preferences
    await page.check('[data-testid="auto-enable-ai-search"]');
    await page.fill('[data-testid="max-search-results"]', '25');
    await page.selectOption('[data-testid="preferred-ai-provider"]', 'openai');

    // Save preferences
    await page.click('[data-testid="save-preferences"]');
    await expect(page.locator('[data-testid="preferences-saved"]')).toBeVisible();

    // Logout and login again to verify persistence
    await page.click('[data-testid="user-menu"]');
    await page.click('[data-testid="logout"]');

    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'user@test.com');
    await page.fill('[data-testid="password"]', 'UserPassword123!');
    await page.click('[data-testid="login-button"]');

    // Verify preferences persisted
    await expect(page.locator('body')).toHaveClass(/dark-theme/);

    await page.click('[data-testid="search-tab"]');
    await expect(page.locator('[data-testid="ai-search-toggle"]')).toBeChecked();

    await page.click('[data-testid="user-menu"]');
    await page.click('[data-testid="preferences"]');
    await expect(page.locator('[data-testid="theme-selection"]')).toHaveValue('dark');
    await expect(page.locator('[data-testid="default-export-format"]')).toHaveValue('pdf');
  });

  test('role-based knowledge base access control', async ({ page }) => {
    // Test as admin - create sensitive entry
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'admin@test.com');
    await page.fill('[data-testid="password"]', 'AdminPassword123!');
    await page.click('[data-testid="login-button"]');

    await page.goto('/knowledge-base');
    await page.click('[data-testid="create-kb-entry"]');
    await page.fill('[data-testid="entry-title"]', 'Confidential Security Procedures');
    await page.fill('[data-testid="entry-content"]', 'Sensitive security information...');
    await page.selectOption('[data-testid="entry-category"]', 'Security');
    await page.selectOption('[data-testid="access-level"]', 'admin-only');
    await page.click('[data-testid="save-entry"]');

    // Logout admin
    await page.click('[data-testid="user-menu"]');
    await page.click('[data-testid="logout"]');

    // Login as regular user
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'user@test.com');
    await page.fill('[data-testid="password"]', 'UserPassword123!');
    await page.click('[data-testid="login-button"]');

    // Verify user cannot see admin-only entry
    await page.goto('/knowledge-base');
    await expect(page.locator('[data-testid="entry-confidential-security"]')).not.toBeVisible();

    // Search should not return restricted content
    await page.click('[data-testid="search-tab"]');
    await page.fill('[data-testid="search-input"]', 'Confidential Security');
    await page.click('[data-testid="search-button"]');
    await expect(page.locator('[data-testid="no-results"]')).toBeVisible();

    // Direct URL access should be blocked
    await page.goto('/knowledge-base/confidential-security');
    await expect(page.locator('[data-testid="access-denied"]')).toContainText('insufficient permissions');
  });

  test('user activity tracking and analytics', async ({ page }) => {
    // Login as admin to view analytics
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'admin@test.com');
    await page.fill('[data-testid="password"]', 'AdminPassword123!');
    await page.click('[data-testid="login-button"]');

    // Navigate to user analytics
    await page.goto('/admin/user-analytics');

    // Verify user activity overview
    await expect(page.locator('[data-testid="total-active-users"]')).toBeVisible();
    await expect(page.locator('[data-testid="searches-today"]')).toBeVisible();
    await expect(page.locator('[data-testid="ai-usage-today"]')).toBeVisible();

    // View individual user details
    await page.click('[data-testid="user-detail-user-001"]');
    await expect(page.locator('[data-testid="user-search-history"]')).toBeVisible();
    await expect(page.locator('[data-testid="user-budget-usage"]')).toBeVisible();
    await expect(page.locator('[data-testid="user-login-history"]')).toBeVisible();

    // Verify activity patterns
    await page.click('[data-testid="activity-patterns"]');
    await expect(page.locator('[data-testid="peak-usage-times"]')).toBeVisible();
    await expect(page.locator('[data-testid="popular-search-terms"]')).toBeVisible();
    await expect(page.locator('[data-testid="user-engagement-metrics"]')).toBeVisible();

    // Export user analytics
    await page.click('[data-testid="export-analytics"]');
    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="confirm-export"]');
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('user-analytics');
  });
});