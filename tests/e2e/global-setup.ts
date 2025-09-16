/**
 * Global Setup for E2E Workflow Tests
 * Prepares test environment and test data
 */

import { FullConfig } from '@playwright/test';
import fs from 'fs/promises';
import path from 'path';

async function globalSetup(config: FullConfig) {
  console.log('🔧 Setting up global E2E test environment...');

  try {
    // Create test directories
    await createTestDirectories();

    // Setup test database/storage
    await setupTestStorage();

    // Initialize test data
    await initializeTestData();

    // Setup mock services if needed
    await setupMockServices();

    // Verify application is ready
    await verifyApplicationReady();

    console.log('✅ Global E2E setup completed successfully');

  } catch (error) {
    console.error('❌ Global E2E setup failed:', error);
    throw error;
  }
}

async function createTestDirectories(): Promise<void> {
  const directories = [
    'test-results/workflow-tests',
    'test-results/screenshots',
    'test-results/videos',
    'test-results/traces',
    'test-results/reports'
  ];

  for (const dir of directories) {
    const fullPath = path.join(process.cwd(), dir);
    await fs.mkdir(fullPath, { recursive: true });
  }
}

async function setupTestStorage(): Promise<void> {
  // Setup test database or clear existing data
  const testDataPath = path.join(process.cwd(), 'test-data');
  await fs.mkdir(testDataPath, { recursive: true });

  // Create test SQLite database if needed
  // This would typically involve database migrations or data seeding
}

async function initializeTestData(): Promise<void> {
  // Load test data from fixtures
  const fixturesPath = path.join(process.cwd(), 'tests/fixtures/workflow-test-data.json');

  try {
    const testData = await fs.readFile(fixturesPath, 'utf-8');
    const data = JSON.parse(testData);

    // Store test data in application storage
    // This could involve API calls or direct database seeding
    console.log(`📊 Loaded ${data.entries.length} test entries and ${data.workflows.length} workflow definitions`);

  } catch (error) {
    console.warn('⚠️ Could not load test data from fixtures:', error);
  }
}

async function setupMockServices(): Promise<void> {
  // Setup any mock external services
  // For example, mock analytics endpoints, external APIs, etc.

  // Create mock server configuration
  const mockConfig = {
    analytics: {
      endpoint: process.env.MOCK_ANALYTICS_ENDPOINT || 'http://localhost:3001/analytics',
      enabled: process.env.ENABLE_MOCK_ANALYTICS === 'true'
    },
    search: {
      delay: parseInt(process.env.MOCK_SEARCH_DELAY || '100'),
      errorRate: parseFloat(process.env.MOCK_ERROR_RATE || '0.05')
    }
  };

  const configPath = path.join(process.cwd(), 'test-results/mock-config.json');
  await fs.writeFile(configPath, JSON.stringify(mockConfig, null, 2));
}

async function verifyApplicationReady(): Promise<void> {
  // Verify the application is running and ready for tests
  const maxRetries = 30;
  const retryDelay = 1000;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(process.env.TEST_BASE_URL || 'http://localhost:3000');
      if (response.ok) {
        console.log('✅ Application is ready for testing');
        return;
      }
    } catch (error) {
      // Application not ready yet
    }

    if (i < maxRetries - 1) {
      console.log(`⏳ Waiting for application to be ready... (${i + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }

  throw new Error('Application failed to become ready within the timeout period');
}

export default globalSetup;