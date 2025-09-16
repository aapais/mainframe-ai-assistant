/**
 * Visual Regression Global Setup
 * Prepares the testing environment for consistent visual testing
 */

import { chromium, FullConfig } from '@playwright/test';
import path from 'path';
import fs from 'fs/promises';

async function globalSetup(config: FullConfig) {
  console.log('🎭 Setting up visual regression testing environment...');

  // Create necessary directories
  await createTestDirectories();

  // Setup font consistency
  await setupFontConsistency();

  // Setup test data
  await setupTestData();

  // Warm up browser for consistent rendering
  await warmupBrowser();

  console.log('✅ Visual regression environment ready');
}

async function createTestDirectories() {
  const directories = [
    'test-results/visual-regression',
    'test-results/visual-regression/actual',
    'test-results/visual-regression/expected',
    'test-results/visual-regression/diff',
    'test-reports/visual-regression-html',
    'test-reports/visual-regression-json',
    'test-reports/visual-regression-junit'
  ];

  for (const dir of directories) {
    try {
      await fs.mkdir(dir, { recursive: true });
      console.log(`📁 Created directory: ${dir}`);
    } catch (error) {
      console.warn(`⚠️ Could not create directory ${dir}:`, error);
    }
  }
}

async function setupFontConsistency() {
  console.log('🔤 Setting up font consistency...');

  // Create font configuration for consistent rendering across environments
  const fontConfig = `
    /* Visual Testing Font Overrides */
    * {
      font-family: 'Arial', 'Helvetica', sans-serif !important;
      -webkit-font-smoothing: antialiased !important;
      -moz-osx-font-smoothing: grayscale !important;
      text-rendering: optimizeLegibility !important;
    }

    /* Disable font loading animations */
    @font-face {
      font-display: block;
    }

    /* Consistent line heights */
    body, html {
      line-height: 1.5 !important;
      letter-spacing: normal !important;
    }

    /* Disable text selection for consistent screenshots */
    .visual-test * {
      -webkit-user-select: none !important;
      -moz-user-select: none !important;
      -ms-user-select: none !important;
      user-select: none !important;
    }

    /* Remove focus outlines for visual testing */
    .visual-test *:focus {
      outline: none !important;
    }

    /* Disable animations during visual testing */
    .visual-test *,
    .visual-test *::before,
    .visual-test *::after {
      animation-duration: 0s !important;
      animation-delay: 0s !important;
      transition-duration: 0s !important;
      transition-delay: 0s !important;
    }
  `;

  try {
    await fs.writeFile(
      path.join('tests/visual-regression/config/visual-test-styles.css'),
      fontConfig
    );
    console.log('✅ Font consistency configuration created');
  } catch (error) {
    console.error('❌ Failed to create font configuration:', error);
  }
}

async function setupTestData() {
  console.log('📊 Setting up test data...');

  // Mock data for consistent component rendering
  const mockKBEntries = [
    {
      id: 'test-entry-1',
      title: 'VSAM Status 35 - File Not Found',
      problem: 'Job abends with VSAM status code 35. The program cannot open the VSAM file.',
      solution: '1. Verify the dataset exists using ISPF 3.4\n2. Check the DD statement in JCL\n3. Ensure file is cataloged properly',
      category: 'VSAM',
      tags: ['vsam', 'status-35', 'file-not-found'],
      usage_count: 42,
      success_count: 38,
      failure_count: 4
    },
    {
      id: 'test-entry-2',
      title: 'S0C7 - Data Exception in COBOL',
      problem: 'Program abends with S0C7 data exception during arithmetic operations.',
      solution: '1. Check for non-numeric data in numeric fields\n2. Initialize all COMP-3 fields properly\n3. Add NUMERIC test before arithmetic',
      category: 'Batch',
      tags: ['s0c7', 'data-exception', 'cobol'],
      usage_count: 28,
      success_count: 25,
      failure_count: 3
    },
    {
      id: 'test-entry-3',
      title: 'JCL Error - Dataset Not Found',
      problem: 'JCL fails with IEF212I dataset not found error',
      solution: '1. Verify dataset name spelling\n2. Check if dataset exists using LISTD\n3. Verify UNIT and VOL parameters',
      category: 'JCL',
      tags: ['jcl', 'dataset', 'not-found'],
      usage_count: 15,
      success_count: 14,
      failure_count: 1
    }
  ];

  try {
    await fs.writeFile(
      path.join('tests/visual-regression/fixtures/mock-kb-data.json'),
      JSON.stringify(mockKBEntries, null, 2)
    );

    // Create component test fixtures
    const componentFixtures = {
      searchStates: {
        empty: { query: '', loading: false, results: [] },
        loading: { query: 'VSAM', loading: true, results: [] },
        withResults: { query: 'VSAM', loading: false, results: mockKBEntries },
        noResults: { query: 'nonexistent', loading: false, results: [] },
        error: { query: 'error', loading: false, error: 'Search failed' }
      },
      themes: {
        light: { colorScheme: 'light', className: 'theme-light' },
        dark: { colorScheme: 'dark', className: 'theme-dark' },
        highContrast: { colorScheme: 'light', className: 'theme-high-contrast' }
      }
    };

    await fs.writeFile(
      path.join('tests/visual-regression/fixtures/component-fixtures.json'),
      JSON.stringify(componentFixtures, null, 2)
    );

    console.log('✅ Test data fixtures created');
  } catch (error) {
    console.error('❌ Failed to create test data:', error);
  }
}

async function warmupBrowser() {
  console.log('🔥 Warming up browser for consistent rendering...');

  try {
    const browser = await chromium.launch({
      args: [
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-gpu-sandbox',
        '--use-gl=swiftshader',
        '--no-sandbox'
      ]
    });

    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
      reducedMotion: 'reduce',
      colorScheme: 'light'
    });

    const page = await context.newPage();

    // Load a simple page to initialize rendering engine
    await page.setContent(`
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
            .test-element { width: 100px; height: 100px; background: #007bff; }
          </style>
        </head>
        <body>
          <div class="test-element"></div>
        </body>
      </html>
    `);

    await page.waitForTimeout(1000); // Allow rendering to settle
    await browser.close();

    console.log('✅ Browser warmed up successfully');
  } catch (error) {
    console.warn('⚠️ Browser warmup failed:', error);
  }
}

export default globalSetup;