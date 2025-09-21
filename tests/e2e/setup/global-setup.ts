/**
 * Global Setup for CreateIncidentModal Playwright Tests
 * Prepares test environment and mock data
 */

import { chromium, FullConfig } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Setting up CreateIncidentModal test environment...\n');

  // Create necessary directories
  const directories = [
    'tests/playwright/screenshots',
    'tests/playwright/reports',
    'tests/playwright/reports/accessibility',
    'tests/playwright/results',
    'tests/test-results'
  ];

  directories.forEach(dir => {
    try {
      mkdirSync(dir, { recursive: true });
      console.log(`📁 Created directory: ${dir}`);
    } catch (error) {
      // Directory already exists
    }
  });

  // Setup test data and mock server if needed
  await setupMockData();
  await validateTestEnvironment();

  console.log('\n✅ Global setup completed successfully!');
}

async function setupMockData() {
  console.log('\n📊 Setting up test data...');

  // Create mock incident data for testing
  const mockIncidents = [
    {
      id: 'INC202412010001',
      title: 'Sistema CICS Indisponível',
      description: 'Ambiente CICS apresentando falhas',
      priority: 'P1',
      status: 'aberto',
      category: 'CICS',
      created_at: new Date().toISOString()
    },
    {
      id: 'INC202412010002',
      title: 'Performance DB2 Degradada',
      description: 'Queries lentas no banco principal',
      priority: 'P2',
      status: 'em_tratamento',
      category: 'Base de Dados',
      created_at: new Date().toISOString()
    }
  ];

  // Save mock data
  try {
    writeFileSync(
      'tests/test-data/mock-incidents.json',
      JSON.stringify(mockIncidents, null, 2)
    );
    console.log('✅ Mock incident data created');
  } catch (error) {
    console.log('ℹ️ Mock data directory not found, skipping...');
  }

  // Create test configuration
  const testConfig = {
    baseUrl: process.env.BASE_URL || 'http://localhost:5173',
    apiUrl: process.env.API_URL || 'http://localhost:3001/api',
    testTimeout: 60000,
    language: 'pt-BR',
    timezone: 'America/Sao_Paulo'
  };

  try {
    writeFileSync(
      'tests/test-config.json',
      JSON.stringify(testConfig, null, 2)
    );
    console.log('✅ Test configuration created');
  } catch (error) {
    console.log('⚠️ Could not create test configuration');
  }
}

async function validateTestEnvironment() {
  console.log('\n🔍 Validating test environment...');

  // Test browser launch
  try {
    const browser = await chromium.launch();
    const context = await browser.newContext({
      locale: 'pt-BR',
      timezoneId: 'America/Sao_Paulo'
    });
    const page = await context.newPage();

    // Test basic navigation
    try {
      await page.goto('about:blank');
      console.log('✅ Browser navigation working');
    } catch (error) {
      console.log('❌ Browser navigation failed:', error);
    }

    await browser.close();
  } catch (error) {
    console.log('❌ Browser launch failed:', error);
    throw error;
  }

  // Validate required environment variables
  const requiredEnvVars = ['NODE_ENV'];
  const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

  if (missingEnvVars.length > 0) {
    console.log(`⚠️ Missing environment variables: ${missingEnvVars.join(', ')}`);
  }

  // Check if application server is running
  if (process.env.CI !== 'true') {
    try {
      const testUrl = process.env.BASE_URL || 'http://localhost:5173';
      console.log(`🌐 Testing application at: ${testUrl}`);

      const browser = await chromium.launch();
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.goto(testUrl, { waitUntil: 'networkidle', timeout: 10000 });
      console.log('✅ Application server is accessible');

      await browser.close();
    } catch (error) {
      console.log('⚠️ Application server check failed - will be started by webServer config');
    }
  }

  console.log('✅ Environment validation completed');
}

export default globalSetup;