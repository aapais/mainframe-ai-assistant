import { FullConfig } from '@playwright/test';
import { promises as fs } from 'fs';
import path from 'path';
import { spawn } from 'child_process';

/**
 * Global Teardown for Playwright Electron Testing
 * Handles post-test cleanup and report generation
 */
async function globalTeardown(config: FullConfig): Promise<void> {
  console.log('🧹 Starting global teardown...');

  try {
    // 1. Kill any remaining Electron processes
    await killRemainingElectronProcesses();

    // 2. Generate comprehensive test summary
    await generateTestSummary();

    // 3. Archive test artifacts if needed
    await archiveTestArtifacts();

    // 4. Cleanup temporary files
    await cleanupTemporaryFiles();

    // 5. Generate performance report
    await generatePerformanceReport();

    // 6. Send notifications if in CI
    await sendNotifications();

    console.log('✅ Global teardown completed successfully');

  } catch (error) {
    console.error('❌ Global teardown failed:', error);
    // Don't throw here as tests have already completed
  }
}

/**
 * Kill any remaining Electron processes that might be hanging
 */
async function killRemainingElectronProcesses(): Promise<void> {
  console.log('🔄 Checking for remaining Electron processes...');

  if (process.platform === 'win32') {
    // Windows
    try {
      await runCommand('taskkill', ['/f', '/im', 'electron.exe']);
    } catch {
      // Process might not exist, which is fine
    }
  } else {
    // Unix-like systems
    try {
      await runCommand('pkill', ['-f', 'electron']);
    } catch {
      // Process might not exist, which is fine
    }
  }

  console.log('✅ Electron process cleanup completed');
}

/**
 * Generate a comprehensive test summary
 */
async function generateTestSummary(): Promise<void> {
  console.log('📊 Generating test summary...');

  try {
    // Read the test results
    const resultsPath = path.join('test-reports/playwright-json', 'results.json');
    const resultsExist = await fileExists(resultsPath);

    if (!resultsExist) {
      console.log('⚠️ No test results found, skipping summary generation');
      return;
    }

    const resultsContent = await fs.readFile(resultsPath, 'utf8');
    const results = JSON.parse(resultsContent);

    // Calculate summary statistics
    const summary = calculateTestSummary(results);

    // Read test state if available
    const testStatePath = path.join('tests/playwright/temp', 'test-state.json');
    let testState = {};
    try {
      const stateContent = await fs.readFile(testStatePath, 'utf8');
      testState = JSON.parse(stateContent);
    } catch {
      // State file might not exist
    }

    // Generate summary report
    const summaryReport = {
      timestamp: new Date().toISOString(),
      duration: summary.duration,
      summary: {
        total: summary.total,
        passed: summary.passed,
        failed: summary.failed,
        skipped: summary.skipped,
        passRate: summary.total > 0 ? (summary.passed / summary.total * 100).toFixed(2) : '0'
      },
      environment: {
        node: process.version,
        platform: process.platform,
        arch: process.arch,
        ci: !!process.env.CI,
        electronVersion: process.env.npm_package_devDependencies_electron || 'unknown'
      },
      testState,
      artifacts: await getArtifactsSummary()
    };

    const summaryPath = path.join('test-reports', 'test-summary.json');
    await fs.writeFile(summaryPath, JSON.stringify(summaryReport, null, 2));

    // Generate markdown summary for CI
    if (process.env.CI) {
      await generateMarkdownSummary(summaryReport);
    }

    console.log('✅ Test summary generated');

  } catch (error) {
    console.error('❌ Failed to generate test summary:', error);
  }
}

/**
 * Archive test artifacts for CI or long-term storage
 */
async function archiveTestArtifacts(): Promise<void> {
  if (!process.env.CI && !process.env.ARCHIVE_ARTIFACTS) {
    return;
  }

  console.log('📦 Archiving test artifacts...');

  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const archivePath = path.join('test-reports', `artifacts-${timestamp}`);

    // Create archive directory
    await fs.mkdir(archivePath, { recursive: true });

    // Copy important files
    const filesToArchive = [
      { src: 'test-reports/playwright-html', dest: 'html-report' },
      { src: 'test-reports/playwright-json/results.json', dest: 'results.json' },
      { src: 'test-reports/electron-report.json', dest: 'electron-report.json' },
      { src: 'test-reports/test-summary.json', dest: 'test-summary.json' },
      { src: 'tests/playwright/screenshots', dest: 'screenshots' },
      { src: 'test-results/playwright', dest: 'test-results' }
    ];

    for (const file of filesToArchive) {
      try {
        const srcExists = await fileExists(file.src);
        if (srcExists) {
          const destPath = path.join(archivePath, file.dest);

          const stats = await fs.stat(file.src);
          if (stats.isDirectory()) {
            await copyDirectory(file.src, destPath);
          } else {
            await fs.mkdir(path.dirname(destPath), { recursive: true });
            await fs.copyFile(file.src, destPath);
          }
        }
      } catch (error) {
        console.warn(`Failed to archive ${file.src}:`, error);
      }
    }

    console.log(`✅ Artifacts archived to: ${archivePath}`);

  } catch (error) {
    console.error('❌ Failed to archive artifacts:', error);
  }
}

/**
 * Cleanup temporary files and directories
 */
async function cleanupTemporaryFiles(): Promise<void> {
  console.log('🗑️ Cleaning up temporary files...');

  const tempDirectories = [
    'tests/playwright/temp',
    'tests/playwright/downloads'
  ];

  for (const dir of tempDirectories) {
    try {
      const exists = await fileExists(dir);
      if (exists) {
        await fs.rm(dir, { recursive: true, force: true });
        await fs.mkdir(dir, { recursive: true });
      }
    } catch (error) {
      console.warn(`Failed to cleanup ${dir}:`, error);
    }
  }

  console.log('✅ Temporary files cleaned up');
}

/**
 * Generate performance report from collected metrics
 */
async function generatePerformanceReport(): Promise<void> {
  console.log('⚡ Generating performance report...');

  try {
    const electronReportPath = path.join('test-reports', 'electron-report.json');
    const reportExists = await fileExists(electronReportPath);

    if (!reportExists) {
      console.log('⚠️ No electron report found, skipping performance report');
      return;
    }

    const reportContent = await fs.readFile(electronReportPath, 'utf8');
    const report = JSON.parse(reportContent);

    const performanceReport = {
      timestamp: new Date().toISOString(),
      electronMetrics: report.electronMetrics,
      performance: report.performance,
      recommendations: generatePerformanceRecommendations(report)
    };

    const perfReportPath = path.join('test-reports', 'performance-report.json');
    await fs.writeFile(perfReportPath, JSON.stringify(performanceReport, null, 2));

    console.log('✅ Performance report generated');

  } catch (error) {
    console.error('❌ Failed to generate performance report:', error);
  }
}

/**
 * Send notifications if in CI environment
 */
async function sendNotifications(): Promise<void> {
  if (!process.env.CI) {
    return;
  }

  console.log('📧 Sending CI notifications...');

  try {
    // Read test summary
    const summaryPath = path.join('test-reports', 'test-summary.json');
    const summaryExists = await fileExists(summaryPath);

    if (summaryExists) {
      const summaryContent = await fs.readFile(summaryPath, 'utf8');
      const summary = JSON.parse(summaryContent);

      // Generate GitHub Actions summary
      if (process.env.GITHUB_ACTIONS) {
        await generateGitHubActionsSummary(summary);
      }

      // Other CI notifications can be added here
    }

    console.log('✅ CI notifications sent');

  } catch (error) {
    console.error('❌ Failed to send notifications:', error);
  }
}

/**
 * Helper functions
 */

function calculateTestSummary(results: any) {
  const summary = {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    duration: 0
  };

  if (results.suites) {
    results.suites.forEach((suite: any) => {
      if (suite.specs) {
        suite.specs.forEach((spec: any) => {
          if (spec.tests) {
            spec.tests.forEach((test: any) => {
              summary.total++;
              summary.duration += test.results?.[0]?.duration || 0;

              const status = test.results?.[0]?.status;
              switch (status) {
                case 'passed':
                  summary.passed++;
                  break;
                case 'failed':
                  summary.failed++;
                  break;
                case 'skipped':
                  summary.skipped++;
                  break;
              }
            });
          }
        });
      }
    });
  }

  return summary;
}

async function getArtifactsSummary() {
  const artifacts = {
    htmlReport: await fileExists('test-reports/playwright-html/index.html'),
    jsonResults: await fileExists('test-reports/playwright-json/results.json'),
    electronReport: await fileExists('test-reports/electron-report.json'),
    screenshots: await getFileCount('tests/playwright/screenshots'),
    videos: await getFileCount('test-results/playwright', '.webm')
  };

  return artifacts;
}

async function generateMarkdownSummary(summary: any) {
  const markdown = `
# 🔬 Electron Test Results

## Summary
- **Total Tests**: ${summary.summary.total}
- **Passed**: ${summary.summary.passed} ✅
- **Failed**: ${summary.summary.failed} ❌
- **Skipped**: ${summary.summary.skipped} ⏭️
- **Pass Rate**: ${summary.summary.passRate}%
- **Duration**: ${(summary.duration / 1000).toFixed(2)}s

## Environment
- **Platform**: ${summary.environment.platform}
- **Node**: ${summary.environment.node}
- **CI**: ${summary.environment.ci}

## Artifacts
- **HTML Report**: ${summary.artifacts.htmlReport ? '✅' : '❌'}
- **JSON Results**: ${summary.artifacts.jsonResults ? '✅' : '❌'}
- **Electron Report**: ${summary.artifacts.electronReport ? '✅' : '❌'}
- **Screenshots**: ${summary.artifacts.screenshots}
- **Videos**: ${summary.artifacts.videos}

Generated at: ${summary.timestamp}
`;

  const markdownPath = path.join('test-reports', 'summary.md');
  await fs.writeFile(markdownPath, markdown);
}

async function generateGitHubActionsSummary(summary: any) {
  const stepSummary = process.env.GITHUB_STEP_SUMMARY;
  if (stepSummary) {
    const markdown = await fs.readFile(path.join('test-reports', 'summary.md'), 'utf8');
    await fs.appendFile(stepSummary, markdown);
  }
}

function generatePerformanceRecommendations(report: any) {
  const recommendations = [];

  if (report.electronMetrics.averageStartupTime > 5000) {
    recommendations.push('Consider optimizing app startup time - currently averaging over 5 seconds');
  }

  if (report.electronMetrics.peakMemoryUsage > 500 * 1024 * 1024) {
    recommendations.push('Memory usage is high - consider memory optimization');
  }

  if (report.performance.averageTestDuration > 10000) {
    recommendations.push('Tests are running slowly - consider test optimization');
  }

  return recommendations;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function getFileCount(dirPath: string, extension?: string): Promise<number> {
  try {
    const exists = await fileExists(dirPath);
    if (!exists) return 0;

    const files = await fs.readdir(dirPath);
    return extension
      ? files.filter(file => file.endsWith(extension)).length
      : files.length;
  } catch {
    return 0;
  }
}

async function copyDirectory(src: string, dest: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

function runCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const process = spawn(command, args, { stdio: 'pipe', shell: true });

    process.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });

    process.on('error', (error) => {
      reject(error);
    });
  });
}

export default globalTeardown;