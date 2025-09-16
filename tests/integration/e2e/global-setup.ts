import { chromium, FullConfig } from '@playwright/test';
import { E2ETestDataFactory } from './fixtures/E2ETestDataFactory';
import { DatabaseManager } from '../../../src/database/DatabaseManager';

/**
 * Global setup for E2E tests
 * Initializes test database, creates test users, and sets up authentication
 */
async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting E2E global setup...');

  // Initialize test database
  const dbManager = new DatabaseManager('./tests/integration/e2e/test.db');
  await dbManager.initialize();

  // Create test data
  const dataFactory = new E2ETestDataFactory(dbManager);
  await dataFactory.createTestUsers();
  await dataFactory.createTestKnowledgeBase();
  await dataFactory.createTestApiKeys();
  await dataFactory.createTestBudgets();

  // Setup authentication for different user types
  const browser = await chromium.launch();

  // Admin user authentication
  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await adminPage.goto('http://localhost:3000/login');
  await adminPage.fill('[data-testid="email"]', 'admin@test.com');
  await adminPage.fill('[data-testid="password"]', 'AdminPassword123!');
  await adminPage.click('[data-testid="login-button"]');
  await adminPage.waitForURL('**/dashboard');
  await adminContext.storageState({ path: './tests/integration/e2e/auth/admin-storage-state.json' });
  await adminContext.close();

  // Regular user authentication
  const userContext = await browser.newContext();
  const userPage = await userContext.newPage();
  await userPage.goto('http://localhost:3000/login');
  await userPage.fill('[data-testid="email"]', 'user@test.com');
  await userPage.fill('[data-testid="password"]', 'UserPassword123!');
  await userPage.click('[data-testid="login-button"]');
  await userPage.waitForURL('**/dashboard');
  await userContext.storageState({ path: './tests/integration/e2e/auth/user-storage-state.json' });
  await userContext.close();

  await browser.close();

  console.log('✅ E2E global setup completed');
}

export default globalSetup;