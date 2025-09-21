/**
 * E2E Teardown for Incident Management Tests
 * Cleanup after Playwright tests
 */

import { FullConfig } from '@playwright/test';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting E2E Test Teardown...');

  try {
    // Cleanup tasks
    console.log('🗑️ Cleaning up test artifacts...');

    // Additional cleanup if needed
    console.log('✅ E2E teardown completed successfully');
  } catch (error) {
    console.error('❌ E2E teardown failed:', error);
    throw error;
  }
}

export default globalTeardown;