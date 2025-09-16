import { test as setup, expect } from '@playwright/test';

/**
 * Authentication Setup for E2E Tests
 * Creates authenticated sessions for different user types
 */

setup('authenticate as admin', async ({ page }) => {
  await page.goto('/login');
  await page.fill('[data-testid="email"]', 'admin@test.com');
  await page.fill('[data-testid="password"]', 'AdminPassword123!');
  await page.click('[data-testid="login-button"]');

  // Wait for successful login
  await expect(page.locator('[data-testid="admin-dashboard"]')).toBeVisible();

  // Save admin session
  await page.context().storageState({
    path: './tests/integration/e2e/auth/admin-storage-state.json'
  });
});

setup('authenticate as user', async ({ page }) => {
  await page.goto('/login');
  await page.fill('[data-testid="email"]', 'user@test.com');
  await page.fill('[data-testid="password"]', 'UserPassword123!');
  await page.click('[data-testid="login-button"]');

  // Wait for successful login
  await expect(page.locator('[data-testid="user-dashboard"]')).toBeVisible();

  // Save user session
  await page.context().storageState({
    path: './tests/integration/e2e/auth/user-storage-state.json'
  });
});

setup('authenticate as readonly user', async ({ page }) => {
  await page.goto('/login');
  await page.fill('[data-testid="email"]', 'user2@test.com');
  await page.fill('[data-testid="password"]', 'ReadOnlyPassword123!');
  await page.click('[data-testid="login-button"]');

  // Wait for successful login
  await expect(page.locator('[data-testid="readonly-notice"]')).toBeVisible();

  // Save readonly session
  await page.context().storageState({
    path: './tests/integration/e2e/auth/readonly-storage-state.json'
  });
});