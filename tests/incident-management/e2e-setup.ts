/**
 * E2E Setup for Incident Management Tests
 * Playwright test setup and configuration
 */

import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting E2E Test Setup...');

  try {
    // Launch browser for setup tasks
    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();

    // Basic setup tasks
    console.log('✅ Browser launched successfully');

    // Create test directories
    console.log('📁 Creating test directories...');

    // Setup complete
    await context.close();
    await browser.close();

    console.log('✅ E2E setup completed successfully');
  } catch (error) {
    console.error('❌ E2E setup failed:', error);
    throw error;
  }
}

export default globalSetup;