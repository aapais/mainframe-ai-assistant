import { test, expect } from '@playwright/test';

/**
 * E2E Test: Admin Configuration Workflow
 * Tests: Admin configures API keys → encrypted storage → usage in AI calls
 */
test.describe('Admin Configuration E2E', () => {
  test.use({ storageState: './tests/integration/e2e/auth/admin-storage-state.json' });

  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/dashboard');
    await expect(page).toHaveTitle(/Admin Dashboard/);
  });

  test('complete API key configuration with encryption', async ({ page }) => {
    // Step 1: Navigate to API configuration
    await page.click('[data-testid="api-configuration"]');
    await expect(page.locator('[data-testid="api-config-panel"]')).toBeVisible();

    // Step 2: Configure OpenAI API key
    await page.click('[data-testid="add-openai-key"]');
    await page.fill('[data-testid="openai-api-key"]', 'sk-test-new-openai-key-12345');
    await page.fill('[data-testid="openai-rate-limit"]', '100');
    await page.fill('[data-testid="openai-cost-per-request"]', '0.002');

    // Step 3: Verify encryption warning
    await expect(page.locator('[data-testid="encryption-notice"]')).toContainText('will be encrypted');

    // Step 4: Save configuration
    await page.click('[data-testid="save-openai-config"]');
    await expect(page.locator('[data-testid="success-message"]')).toContainText('API key saved successfully');

    // Step 5: Verify key is masked in UI
    await page.reload();
    await expect(page.locator('[data-testid="openai-key-display"]')).toContainText('sk-****');
    await expect(page.locator('[data-testid="openai-key-display"]')).not.toContainText('12345');

    // Step 6: Configure Gemini API key
    await page.click('[data-testid="add-gemini-key"]');
    await page.fill('[data-testid="gemini-api-key"]', 'gemini-test-key-67890');
    await page.fill('[data-testid="gemini-rate-limit"]', '150');
    await page.fill('[data-testid="gemini-cost-per-request"]', '0.001');
    await page.click('[data-testid="save-gemini-config"]');

    // Step 7: Test API key validation
    await page.click('[data-testid="test-openai-connection"]');
    await expect(page.locator('[data-testid="connection-status"]')).toContainText('Testing connection...', { timeout: 10000 });

    // Step 8: Verify configuration audit log
    await page.click('[data-testid="configuration-audit"]');
    await expect(page.locator('[data-testid="audit-entries"]').first()).toContainText('API_KEY_UPDATED');
    await expect(page.locator('[data-testid="audit-entries"]').first()).toContainText('OpenAI');
  });

  test('API key rotation and version management', async ({ page }) => {
    // Navigate to API management
    await page.goto('/admin/api-management');

    // View current API key version
    await expect(page.locator('[data-testid="openai-key-version"]')).toContainText('v1');

    // Rotate API key
    await page.click('[data-testid="rotate-openai-key"]');
    await page.fill('[data-testid="new-openai-key"]', 'sk-rotated-key-98765');
    await page.click('[data-testid="confirm-rotation"]');

    // Verify new version
    await expect(page.locator('[data-testid="openai-key-version"]')).toContainText('v2');
    await expect(page.locator('[data-testid="rotation-success"]')).toBeVisible();

    // Verify old key is deactivated
    await page.click('[data-testid="key-history"]');
    await expect(page.locator('[data-testid="old-key-status"]')).toContainText('Deactivated');
  });

  test('bulk user API key configuration', async ({ page }) => {
    // Navigate to user management
    await page.goto('/admin/user-management');

    // Select multiple users
    await page.check('[data-testid="user-checkbox-user-001"]');
    await page.check('[data-testid="user-checkbox-user-002"]');

    // Bulk configure API access
    await page.click('[data-testid="bulk-api-config"]');
    await page.selectOption('[data-testid="default-provider"]', 'openai');
    await page.fill('[data-testid="default-rate-limit"]', '25');
    await page.fill('[data-testid="default-budget"]', '50');

    // Apply configuration
    await page.click('[data-testid="apply-bulk-config"]');
    await expect(page.locator('[data-testid="bulk-success-message"]')).toContainText('2 users updated');

    // Verify individual user configurations
    await page.click('[data-testid="view-user-001"]');
    await expect(page.locator('[data-testid="user-rate-limit"]')).toContainText('25');
    await expect(page.locator('[data-testid="user-budget"]')).toContainText('50');
  });

  test('API key security validation', async ({ page }) => {
    // Test weak API key rejection
    await page.goto('/admin/api-configuration');
    await page.click('[data-testid="add-openai-key"]');
    await page.fill('[data-testid="openai-api-key"]', 'weak-key');
    await page.click('[data-testid="save-openai-config"]');

    // Should show validation error
    await expect(page.locator('[data-testid="validation-error"]')).toContainText('Invalid API key format');

    // Test duplicate key detection
    await page.fill('[data-testid="openai-api-key"]', 'sk-test-new-openai-key-12345'); // Same as in first test
    await page.click('[data-testid="save-openai-config"]');
    await expect(page.locator('[data-testid="duplicate-key-warning"]')).toContainText('API key already exists');

    // Test encrypted storage verification
    await page.goto('/admin/security-dashboard');
    await expect(page.locator('[data-testid="encryption-status"]')).toContainText('All API keys encrypted');
    await expect(page.locator('[data-testid="key-count"]')).toContainText('2 keys stored');
  });

  test('API usage monitoring and alerts', async ({ page }) => {
    // Configure usage alerts
    await page.goto('/admin/monitoring');
    await page.click('[data-testid="configure-alerts"]');

    // Set usage thresholds
    await page.fill('[data-testid="daily-usage-threshold"]', '80');
    await page.fill('[data-testid="cost-threshold"]', '100');
    await page.check('[data-testid="enable-email-alerts"]');
    await page.click('[data-testid="save-alert-config"]');

    // Simulate high usage scenario
    await page.goto('/admin/usage-simulation');
    await page.click('[data-testid="simulate-high-usage"]');

    // Verify alert is triggered
    await expect(page.locator('[data-testid="alert-notification"]')).toContainText('Usage threshold exceeded');

    // Check alert history
    await page.click('[data-testid="alert-history"]');
    await expect(page.locator('[data-testid="recent-alerts"]').first()).toContainText('HIGH_USAGE_ALERT');
  });

  test('API provider failover configuration', async ({ page }) => {
    // Configure provider priorities
    await page.goto('/admin/provider-config');
    await page.click('[data-testid="configure-failover"]');

    // Set provider order
    await page.selectOption('[data-testid="primary-provider"]', 'openai');
    await page.selectOption('[data-testid="secondary-provider"]', 'gemini');
    await page.check('[data-testid="enable-auto-failover"]');
    await page.click('[data-testid="save-failover-config"]');

    // Test failover scenario
    await page.click('[data-testid="simulate-primary-failure"]');
    await expect(page.locator('[data-testid="failover-status"]')).toContainText('Switched to Gemini');

    // Verify failover audit log
    await page.click('[data-testid="failover-log"]');
    await expect(page.locator('[data-testid="failover-entries"]').first()).toContainText('PROVIDER_FAILOVER');
  });
});