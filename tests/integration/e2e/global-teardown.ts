import { FullConfig } from '@playwright/test';
import { DatabaseManager } from '../../../src/database/DatabaseManager';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Global teardown for E2E tests
 * Cleans up test database and temporary files
 */
async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting E2E global teardown...');

  try {
    // Clean up test database
    const testDbPath = './tests/integration/e2e/test.db';
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
      console.log('✅ Test database cleaned up');
    }

    // Clean up authentication files
    const authDir = './tests/integration/e2e/auth';
    if (fs.existsSync(authDir)) {
      fs.rmSync(authDir, { recursive: true, force: true });
      console.log('✅ Authentication files cleaned up');
    }

    // Clean up temporary test files
    const tempFiles = [
      './tests/integration/e2e/temp',
      './tests/integration/e2e/downloads',
      './tests/integration/e2e/uploads'
    ];

    tempFiles.forEach(dir => {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });

    console.log('✅ E2E global teardown completed');
  } catch (error) {
    console.error('❌ Error during global teardown:', error);
  }
}

export default globalTeardown;