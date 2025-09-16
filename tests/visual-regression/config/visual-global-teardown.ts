/**
 * Visual Regression Global Teardown
 * Cleans up after visual testing and generates reports
 */

import { FullConfig } from '@playwright/test';
import fs from 'fs/promises';
import path from 'path';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Cleaning up visual regression testing environment...');

  try {
    // Generate visual test summary report
    await generateVisualTestReport();

    // Clean up temporary files
    await cleanupTempFiles();

    // Archive test results if needed
    await archiveResults();

    console.log('✅ Visual regression cleanup completed');
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
  }
}

async function generateVisualTestReport() {
  console.log('📊 Generating visual test summary report...');

  try {
    // Read test results
    const resultsPath = 'test-reports/visual-regression-json/results.json';
    let testResults: any = { tests: [], stats: { passed: 0, failed: 0, skipped: 0 } };

    try {
      const resultsContent = await fs.readFile(resultsPath, 'utf-8');
      testResults = JSON.parse(resultsContent);
    } catch (error) {
      console.warn('⚠️ Could not read test results, generating empty report');
    }

    // Generate HTML report
    const reportHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Visual Regression Test Report</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 2rem;
            border-radius: 8px;
            margin-bottom: 2rem;
        }
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
            margin: 2rem 0;
        }
        .stat-card {
            background: white;
            padding: 1.5rem;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            text-align: center;
        }
        .stat-number {
            font-size: 2.5rem;
            font-weight: bold;
            color: #333;
        }
        .stat-label {
            color: #666;
            margin-top: 0.5rem;
        }
        .passed { color: #22c55e; }
        .failed { color: #ef4444; }
        .skipped { color: #f59e0b; }
        .test-list {
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .test-item {
            padding: 1rem;
            border-bottom: 1px solid #e5e7eb;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .test-item:last-child {
            border-bottom: none;
        }
        .test-status {
            padding: 0.25rem 0.75rem;
            border-radius: 4px;
            font-size: 0.875rem;
            font-weight: 500;
        }
        .status-passed {
            background-color: #dcfce7;
            color: #16a34a;
        }
        .status-failed {
            background-color: #fef2f2;
            color: #dc2626;
        }
        .status-skipped {
            background-color: #fef3c7;
            color: #d97706;
        }
        .footer {
            margin-top: 2rem;
            text-align: center;
            color: #666;
            font-size: 0.875rem;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Visual Regression Test Report</h1>
        <p>Generated on ${new Date().toLocaleString()}</p>
    </div>

    <div class="stats">
        <div class="stat-card">
            <div class="stat-number passed">${testResults.stats?.passed || 0}</div>
            <div class="stat-label">Passed</div>
        </div>
        <div class="stat-card">
            <div class="stat-number failed">${testResults.stats?.failed || 0}</div>
            <div class="stat-label">Failed</div>
        </div>
        <div class="stat-card">
            <div class="stat-number skipped">${testResults.stats?.skipped || 0}</div>
            <div class="stat-label">Skipped</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${(testResults.tests?.length || 0)}</div>
            <div class="stat-label">Total Tests</div>
        </div>
    </div>

    <div class="test-list">
        ${(testResults.tests || []).map((test: any) => `
            <div class="test-item">
                <div>
                    <strong>${test.title || 'Unknown Test'}</strong>
                    <br>
                    <small>${test.file || 'Unknown File'}</small>
                </div>
                <div class="test-status status-${test.status || 'unknown'}">
                    ${(test.status || 'unknown').toUpperCase()}
                </div>
            </div>
        `).join('')}
    </div>

    <div class="footer">
        <p>Mainframe KB Assistant - Visual Regression Test Suite</p>
        <p>Coverage: 95% visual testing target across ${Object.keys(componentCategories).length} component categories</p>
    </div>
</body>
</html>
    `;

    await fs.writeFile(
      'test-reports/visual-regression-summary.html',
      reportHtml
    );

    console.log('✅ Visual test report generated: test-reports/visual-regression-summary.html');
  } catch (error) {
    console.error('❌ Failed to generate visual test report:', error);
  }
}

async function cleanupTempFiles() {
  console.log('🗑️ Cleaning up temporary files...');

  const tempPaths = [
    'tests/visual-regression/config/visual-test-styles.css',
    'test-results/visual-regression/temp'
  ];

  for (const tempPath of tempPaths) {
    try {
      await fs.rm(tempPath, { recursive: true, force: true });
      console.log(`🗑️ Cleaned up: ${tempPath}`);
    } catch (error) {
      // Ignore errors for non-existent files
      if (error.code !== 'ENOENT') {
        console.warn(`⚠️ Could not clean up ${tempPath}:`, error.message);
      }
    }
  }
}

async function archiveResults() {
  if (!process.env.CI) {
    console.log('📁 Skipping result archiving (not in CI)');
    return;
  }

  console.log('📦 Archiving visual test results...');

  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const archiveDir = `test-results/visual-regression-archive/${timestamp}`;

    await fs.mkdir(archiveDir, { recursive: true });

    // Copy important results to archive
    const filesToArchive = [
      'test-reports/visual-regression-html',
      'test-reports/visual-regression-json/results.json',
      'test-reports/visual-regression-summary.html'
    ];

    for (const file of filesToArchive) {
      try {
        const sourcePath = file;
        const targetPath = path.join(archiveDir, path.basename(file));

        const stats = await fs.stat(sourcePath);
        if (stats.isDirectory()) {
          await fs.cp(sourcePath, targetPath, { recursive: true });
        } else {
          await fs.cp(sourcePath, targetPath);
        }

        console.log(`📦 Archived: ${file}`);
      } catch (error) {
        console.warn(`⚠️ Could not archive ${file}:`, error.message);
      }
    }

    console.log(`✅ Results archived to: ${archiveDir}`);
  } catch (error) {
    console.error('❌ Failed to archive results:', error);
  }
}

// Component categories (imported from config)
const componentCategories = {
  forms: ['SearchBar', 'KBSearchBar', 'SimpleSearchBar', 'EnhancedKBSearchBar'],
  display: ['ResultsList', 'EntryDetail', 'MetricsDashboard'],
  navigation: ['AppLayout', 'DetailPanel', 'LayoutPanel'],
  interactive: ['Button', 'Modal', 'Dropdown', 'Tabs'],
  accessibility: ['AccessibilityChecker', 'AriaPatterns', 'AlertMessage']
};

export default globalTeardown;