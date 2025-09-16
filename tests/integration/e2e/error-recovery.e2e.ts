import { test, expect } from '@playwright/test';

/**
 * E2E Test: Error Recovery and Edge Cases
 * Tests: System resilience, error handling, and recovery mechanisms
 */
test.describe('Error Recovery and Edge Cases E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveTitle(/Mainframe AI Assistant/);
  });

  test('network connectivity issues and offline mode', async ({ page }) => {
    // Start with normal operation
    await page.click('[data-testid="search-tab"]');
    await page.fill('[data-testid="search-input"]', 'S0C4 ABEND troubleshooting');
    await page.click('[data-testid="search-button"]');
    await expect(page.locator('[data-testid="search-results"]')).toBeVisible();

    // Simulate network offline
    await page.context().setOffline(true);

    // Try another search - should show offline message
    await page.fill('[data-testid="search-input"]', 'CICS performance');
    await page.click('[data-testid="search-button"]');
    await expect(page.locator('[data-testid="offline-message"]')).toContainText('No internet connection');

    // Verify offline functionality still works
    await expect(page.locator('[data-testid="cached-results"]')).toBeVisible();
    await expect(page.locator('[data-testid="offline-search"]')).toBeVisible();

    // Test offline search (local knowledge base only)
    await page.fill('[data-testid="search-input"]', 'S0C4');
    await page.click('[data-testid="offline-search-button"]');
    await expect(page.locator('[data-testid="offline-search-results"]')).toBeVisible();
    await expect(page.locator('[data-testid="offline-notice"]')).toContainText('Searching local cache');

    // Restore network connection
    await page.context().setOffline(false);
    await page.reload();

    // Verify online functionality returns
    await expect(page.locator('[data-testid="online-status"]')).toBeVisible();
    await expect(page.locator('[data-testid="ai-search-toggle"]')).toBeEnabled();
  });

  test('API service failures and fallback mechanisms', async ({ page }) => {
    // Mock API failure scenario
    await page.route('**/api/ai/search', route => {
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Service temporarily unavailable' })
      });
    });

    // Attempt AI search
    await page.click('[data-testid="search-tab"]');
    await page.fill('[data-testid="search-input"]', 'Complex mainframe analysis');
    await page.check('[data-testid="ai-search-toggle"]');
    await page.click('[data-testid="search-button"]');
    await page.click('[data-testid="confirm-ai-search"]');

    // Should show fallback message and alternative options
    await expect(page.locator('[data-testid="api-failure-message"]')).toContainText('AI service temporarily unavailable');
    await expect(page.locator('[data-testid="fallback-search"]')).toBeVisible();
    await expect(page.locator('[data-testid="try-alternative"]')).toBeVisible();

    // Test fallback to local search
    await page.click('[data-testid="fallback-search"]');
    await expect(page.locator('[data-testid="local-search-results"]')).toBeVisible();
    await expect(page.locator('[data-testid="fallback-notice"]')).toContainText('Using local search');

    // Test retry mechanism
    await page.click('[data-testid="retry-ai-search"]');
    await expect(page.locator('[data-testid="retry-attempt"]')).toContainText('Retrying');

    // Mock API recovery
    await page.unroute('**/api/ai/search');
    await page.click('[data-testid="retry-ai-search"]');
    await expect(page.locator('[data-testid="search-results"]')).toBeVisible();
  });

  test('database corruption and recovery', async ({ page }) => {
    // Simulate database issues
    await page.route('**/api/knowledge-base/**', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Database connection failed' })
      });
    });

    // Try to access knowledge base
    await page.goto('/knowledge-base');
    await expect(page.locator('[data-testid="database-error"]')).toContainText('Database temporarily unavailable');
    await expect(page.locator('[data-testid="recovery-options"]')).toBeVisible();

    // Test backup data access
    await page.click('[data-testid="use-backup-data"]');
    await expect(page.locator('[data-testid="backup-data-notice"]')).toContainText('Using cached data');
    await expect(page.locator('[data-testid="kb-entries-backup"]')).toBeVisible();

    // Test database recovery notification
    await page.unroute('**/api/knowledge-base/**');
    await page.click('[data-testid="refresh-connection"]');
    await expect(page.locator('[data-testid="database-restored"]')).toContainText('Database connection restored');
  });

  test('session timeout and automatic recovery', async ({ page }) => {
    // Set short session timeout for testing
    await page.goto('/admin/security-settings');
    await page.fill('[data-testid="session-timeout"]', '1'); // 1 minute
    await page.click('[data-testid="save-security-settings"]');

    // Login as user
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'user@test.com');
    await page.fill('[data-testid="password"]', 'UserPassword123!');
    await page.click('[data-testid="login-button"]');

    // Start a long operation
    await page.click('[data-testid="knowledge-base"]');
    await page.click('[data-testid="create-kb-entry"]');
    await page.fill('[data-testid="entry-title"]', 'Long Entry Creation');
    await page.fill('[data-testid="entry-content"]', 'This is a long entry...');

    // Wait for session to expire (simulate by clearing auth)
    await page.evaluate(() => {
      localStorage.removeItem('auth-token');
      sessionStorage.clear();
    });

    // Try to save - should trigger session timeout
    await page.click('[data-testid="save-entry"]');
    await expect(page.locator('[data-testid="session-expired"]')).toContainText('Session has expired');
    await expect(page.locator('[data-testid="auto-save-notice"]')).toContainText('Draft saved automatically');

    // Re-authenticate
    await page.click('[data-testid="login-again"]');
    await page.fill('[data-testid="email"]', 'user@test.com');
    await page.fill('[data-testid="password"]', 'UserPassword123!');
    await page.click('[data-testid="login-button"]');

    // Verify draft is restored
    await expect(page.locator('[data-testid="draft-restored"]')).toContainText('Draft restored');
    await expect(page.locator('[data-testid="entry-title"]')).toHaveValue('Long Entry Creation');
  });

  test('memory leaks and performance degradation', async ({ page }) => {
    // Perform intensive operations to test memory management
    for (let i = 0; i < 10; i++) {
      await page.click('[data-testid="search-tab"]');
      await page.fill('[data-testid="search-input"]', `Large search query ${i} with extensive content to test memory usage patterns and performance characteristics under load`);
      await page.click('[data-testid="search-button"]');
      await expect(page.locator('[data-testid="search-results"]')).toBeVisible();

      // Clear results to avoid accumulation
      await page.click('[data-testid="clear-results"]');
    }

    // Monitor performance metrics
    await page.goto('/admin/performance-monitoring');
    await expect(page.locator('[data-testid="memory-usage"]')).toBeVisible();

    const memoryUsage = await page.locator('[data-testid="memory-usage-value"]').textContent();
    const memoryValue = parseFloat(memoryUsage?.replace(/[^0-9.]/g, '') || '0');

    // Memory should be within reasonable bounds (less than 500MB)
    expect(memoryValue).toBeLessThan(500);

    // Check for memory leak indicators
    await expect(page.locator('[data-testid="memory-leak-warning"]')).not.toBeVisible();

    // Verify garbage collection metrics
    const gcMetrics = await page.locator('[data-testid="gc-metrics"]').textContent();
    expect(gcMetrics).toContain('Normal');
  });

  test('concurrent user limit and queuing system', async ({ browser }) => {
    // Create multiple contexts to simulate concurrent users
    const contexts = [];
    const pages = [];

    for (let i = 0; i < 15; i++) { // Attempt to exceed typical concurrent limit
      const context = await browser.newContext();
      const page = await context.newPage();
      contexts.push(context);
      pages.push(page);
    }

    // Login all users simultaneously
    const loginPromises = pages.map(async (page, index) => {
      await page.goto('/login');
      await page.fill('[data-testid="email"]', `testuser${index}@test.com`);
      await page.fill('[data-testid="password"]', 'TestPassword123!');
      await page.click('[data-testid="login-button"]');
    });

    await Promise.allSettled(loginPromises);

    // Some users should be queued
    let queuedUsers = 0;
    for (const page of pages) {
      const isQueued = await page.locator('[data-testid="user-queued"]').isVisible().catch(() => false);
      if (isQueued) {
        queuedUsers++;
        await expect(page.locator('[data-testid="queue-position"]')).toBeVisible();
        await expect(page.locator('[data-testid="estimated-wait-time"]')).toBeVisible();
      }
    }

    expect(queuedUsers).toBeGreaterThan(0);

    // Cleanup
    await Promise.all(contexts.map(context => context.close()));
  });

  test('data corruption and validation errors', async ({ page }) => {
    // Test malformed data entry
    await page.goto('/knowledge-base');
    await page.click('[data-testid="create-kb-entry"]');

    // Attempt to save with invalid data
    await page.fill('[data-testid="entry-title"]', ''); // Empty title
    await page.fill('[data-testid="entry-content"]', 'A'.repeat(100000)); // Excessive content
    await page.click('[data-testid="save-entry"]');

    // Should show validation errors
    await expect(page.locator('[data-testid="validation-error"]')).toContainText('Title is required');
    await expect(page.locator('[data-testid="content-too-long"]')).toContainText('Content exceeds maximum length');

    // Test data sanitization
    await page.fill('[data-testid="entry-title"]', '<script>alert("XSS")</script>');
    await page.fill('[data-testid="entry-content"]', 'Normal content');
    await page.click('[data-testid="save-entry"]');

    // Verify XSS prevention
    await expect(page.locator('[data-testid="entry-title"]')).not.toContainText('<script>');
    await expect(page.locator('[data-testid="sanitized-notice"]')).toContainText('Input has been sanitized');

    // Test SQL injection prevention
    await page.fill('[data-testid="search-input"]', "'; DROP TABLE knowledge_base; --");
    await page.click('[data-testid="search-button"]');

    // Should return safe results without database errors
    await expect(page.locator('[data-testid="search-results"]')).toBeVisible();
    await expect(page.locator('[data-testid="sql-injection-blocked"]')).toContainText('Invalid characters detected');
  });

  test('third-party service integration failures', async ({ page }) => {
    // Mock email service failure
    await page.route('**/api/email/send', route => {
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Email service unavailable' })
      });
    });

    // Try operation that requires email
    await page.goto('/admin/user-management');
    await page.click('[data-testid="invite-user"]');
    await page.fill('[data-testid="invite-email"]', 'newuser@test.com');
    await page.click('[data-testid="send-invitation"]');

    // Should handle email failure gracefully
    await expect(page.locator('[data-testid="email-failure-notice"]')).toContainText('Email could not be sent');
    await expect(page.locator('[data-testid="manual-instructions"]')).toBeVisible();
    await expect(page.locator('[data-testid="invitation-link"]')).toBeVisible();

    // Test backup notification methods
    await page.click('[data-testid="use-backup-notification"]');
    await expect(page.locator('[data-testid="backup-notification-sent"]')).toContainText('Notification queued for retry');
  });

  test('browser compatibility and feature detection', async ({ page }) => {
    // Test feature detection
    await page.goto('/dashboard');

    // Check for modern browser features
    const hasWebStorage = await page.evaluate(() => typeof(Storage) !== 'undefined');
    const hasWebSockets = await page.evaluate(() => typeof(WebSocket) !== 'undefined');
    const hasServiceWorker = await page.evaluate(() => 'serviceWorker' in navigator);

    if (!hasWebStorage) {
      await expect(page.locator('[data-testid="storage-fallback"]')).toBeVisible();
    }

    if (!hasWebSockets) {
      await expect(page.locator('[data-testid="websocket-fallback"]')).toBeVisible();
    }

    // Test graceful degradation
    await page.addInitScript(() => {
      // Simulate older browser
      delete window.fetch;
      delete window.Promise;
    });

    await page.reload();
    await expect(page.locator('[data-testid="legacy-browser-notice"]')).toContainText('Limited functionality');
    await expect(page.locator('[data-testid="upgrade-recommendation"]')).toBeVisible();
  });

  test('system recovery after critical errors', async ({ page }) => {
    // Simulate critical system error
    await page.route('**/api/**', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Critical system error' })
      });
    });

    await page.goto('/dashboard');
    await expect(page.locator('[data-testid="system-error"]')).toContainText('System temporarily unavailable');
    await expect(page.locator('[data-testid="recovery-mode"]')).toBeVisible();

    // Test recovery mode functionality
    await page.click('[data-testid="enter-recovery-mode"]');
    await expect(page.locator('[data-testid="recovery-dashboard"]')).toBeVisible();
    await expect(page.locator('[data-testid="system-diagnostics"]')).toBeVisible();

    // Run system diagnostics
    await page.click('[data-testid="run-diagnostics"]');
    await expect(page.locator('[data-testid="diagnostic-results"]')).toBeVisible();

    // Restore system
    await page.unroute('**/api/**');
    await page.click('[data-testid="restore-system"]');
    await expect(page.locator('[data-testid="system-restored"]')).toContainText('System fully operational');

    // Verify normal functionality returns
    await page.goto('/dashboard');
    await expect(page.locator('[data-testid="system-error"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="search-tab"]')).toBeVisible();
  });
});