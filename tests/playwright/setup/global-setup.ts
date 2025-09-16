import { FullConfig } from '@playwright/test';
import { spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { chromium } from '@playwright/test';

/**
 * Global Setup for Playwright Electron Testing
 * Handles pre-test environment preparation and cleanup
 */
async function globalSetup(config: FullConfig): Promise<void> {
  console.log('🔧 Setting up Electron test environment...');

  try {
    // 1. Ensure test directories exist
    await setupTestDirectories();

    // 2. Build the Electron application if needed
    await buildElectronApp();

    // 3. Setup test database and data
    await setupTestData();

    // 4. Install browser dependencies if needed
    await installBrowserDependencies();

    // 5. Setup test environment variables
    setupEnvironmentVariables();

    // 6. Clear previous test artifacts
    await clearTestArtifacts();

    // 7. Validate Electron app can start
    await validateElectronApp();

    console.log('✅ Global setup completed successfully');

  } catch (error) {
    console.error('❌ Global setup failed:', error);
    throw error;
  }
}

/**
 * Setup required test directories
 */
async function setupTestDirectories(): Promise<void> {
  console.log('📁 Creating test directories...');

  const directories = [
    'test-results/playwright',
    'test-reports/playwright-html',
    'test-reports/playwright-json',
    'test-reports/playwright-junit',
    'tests/playwright/temp',
    'tests/playwright/screenshots',
    'tests/playwright/downloads',
    'tests/playwright/test-data'
  ];

  for (const dir of directories) {
    await fs.mkdir(dir, { recursive: true });
  }
}

/**
 * Build the Electron application for testing
 */
async function buildElectronApp(): Promise<void> {
  console.log('🔨 Building Electron application...');

  const mainDistPath = './dist/main/index.js';

  try {
    // Check if already built
    await fs.access(mainDistPath);
    console.log('📦 Electron app already built');
    return;
  } catch {
    // Need to build
    console.log('🔄 Building main process...');

    await runCommand('npm', ['run', 'build:main']);

    // Verify build completed
    await fs.access(mainDistPath);
    console.log('✅ Main process built successfully');
  }
}

/**
 * Setup test data and fixtures
 */
async function setupTestData(): Promise<void> {
  console.log('📊 Setting up test data...');

  // Create sample knowledge base entries for testing
  const sampleEntries = [
    {
      id: 'test-001',
      title: 'COBOL File Processing',
      category: 'COBOL',
      content: 'Basic COBOL file processing techniques...',
      tags: ['cobol', 'file-processing', 'test'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'test-002',
      title: 'JCL Job Submission',
      category: 'JCL',
      content: 'How to submit JCL jobs to the mainframe...',
      tags: ['jcl', 'job-submission', 'test'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'test-003',
      title: 'VSAM Dataset Management',
      category: 'VSAM',
      content: 'Managing VSAM datasets and access methods...',
      tags: ['vsam', 'dataset', 'test'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];

  const testDataPath = path.join('tests/playwright/test-data', 'sample-kb.json');
  await fs.writeFile(testDataPath, JSON.stringify(sampleEntries, null, 2));

  // Create empty test database file
  const testDbPath = path.join('tests/playwright/temp', 'test.db');
  await fs.writeFile(testDbPath, '');

  console.log('✅ Test data created');
}

/**
 * Install browser dependencies if needed
 */
async function installBrowserDependencies(): Promise<void> {
  console.log('🌐 Checking browser dependencies...');

  try {
    // Check if browsers are installed
    const browser = await chromium.launch({ headless: true });
    await browser.close();
    console.log('✅ Browser dependencies are available');
  } catch (error) {
    console.log('📥 Installing browser dependencies...');
    await runCommand('npx', ['playwright', 'install', 'chromium']);
  }
}

/**
 * Setup environment variables for testing
 */
function setupEnvironmentVariables(): void {
  console.log('🔧 Setting up environment variables...');

  // Set test-specific environment variables
  process.env.NODE_ENV = 'test';
  process.env.ELECTRON_DISABLE_GPU = '1';
  process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = '1';
  process.env.PLAYWRIGHT_HEADLESS = process.env.CI ? '1' : '0';
  process.env.TEST_DATABASE_PATH = path.join('tests/playwright/temp', 'test.db');
  process.env.TEST_DATA_PATH = path.join('tests/playwright/test-data');

  console.log('✅ Environment variables configured');
}

/**
 * Clear previous test artifacts
 */
async function clearTestArtifacts(): Promise<void> {
  console.log('🧹 Clearing previous test artifacts...');

  const artifactDirectories = [
    'test-results/playwright',
    'tests/playwright/temp',
    'tests/playwright/screenshots'
  ];

  for (const dir of artifactDirectories) {
    try {
      await fs.rm(dir, { recursive: true, force: true });
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      // Directory might not exist, continue
    }
  }

  console.log('✅ Test artifacts cleared');
}

/**
 * Validate that the Electron app can start properly
 */
async function validateElectronApp(): Promise<void> {
  console.log('🔍 Validating Electron application...');

  const { _electron } = require('playwright');

  try {
    const electronApp = await _electron.launch({
      args: ['./dist/main/index.js', '--test-mode'],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        ELECTRON_DISABLE_GPU: '1'
      },
      timeout: 30000
    });

    // Wait for app to be ready
    await electronApp.evaluate(async ({ app }) => {
      return app.whenReady();
    });

    // Get the main window
    const page = await electronApp.firstWindow();
    await page.waitForLoadState('domcontentloaded');

    // Basic validation - check if the app loads
    const title = await page.title();
    console.log(`📱 App loaded with title: ${title}`);

    // Close the app
    await electronApp.close();

    console.log('✅ Electron application validated successfully');

  } catch (error) {
    console.error('❌ Electron application validation failed:', error);
    throw new Error(`Electron app validation failed: ${error.message}`);
  }
}

/**
 * Run a command and return a promise
 */
function runCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const process = spawn(command, args, {
      stdio: 'inherit',
      shell: true
    });

    process.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with exit code ${code}: ${command} ${args.join(' ')}`));
      }
    });

    process.on('error', (error) => {
      reject(new Error(`Command error: ${error.message}`));
    });
  });
}

/**
 * Create state storage for sharing data between tests
 */
async function setupTestState(): Promise<void> {
  const testState = {
    startTime: Date.now(),
    electronAppPath: './dist/main/index.js',
    testDataPath: path.join('tests/playwright/test-data'),
    tempPath: path.join('tests/playwright/temp'),
    config: {
      timeout: 120000,
      headless: process.env.CI === 'true',
      slowMo: process.env.CI ? 0 : 100
    }
  };

  const statePath = path.join('tests/playwright/temp', 'test-state.json');
  await fs.writeFile(statePath, JSON.stringify(testState, null, 2));
}

export default globalSetup;