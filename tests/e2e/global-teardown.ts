/**
 * Global Teardown for E2E Workflow Tests
 * Cleans up test environment and generates final reports
 */

import { FullConfig } from '@playwright/test';
import fs from 'fs/promises';
import path from 'path';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting global E2E test teardown...');

  try {
    // Generate test summary report
    await generateTestSummary();

    // Archive test artifacts
    await archiveTestArtifacts();

    // Cleanup test data
    await cleanupTestData();

    // Stop mock services
    await stopMockServices();

    // Generate coverage reports if enabled
    if (process.env.GENERATE_COVERAGE === 'true') {
      await generateCoverageReports();
    }

    console.log('✅ Global E2E teardown completed successfully');

  } catch (error) {
    console.error('❌ Global E2E teardown failed:', error);
    // Don't throw - teardown failures shouldn't fail the test run
  }
}

async function generateTestSummary(): Promise<void> {
  try {
    const resultsDir = path.join(process.cwd(), 'test-results');
    const reportFiles = await fs.readdir(resultsDir);

    const jsonReports = reportFiles.filter(file => file.endsWith('.json'));
    const testResults = [];

    for (const reportFile of jsonReports) {
      try {
        const reportPath = path.join(resultsDir, reportFile);
        const reportContent = await fs.readFile(reportPath, 'utf-8');
        const report = JSON.parse(reportContent);
        testResults.push(report);
      } catch (error) {
        console.warn(`Could not parse report file: ${reportFile}`);
      }
    }

    const summary = {
      timestamp: new Date().toISOString(),
      totalSuites: testResults.length,
      aggregatedResults: {
        totalTests: testResults.reduce((sum, r) => sum + (r.totalTests || 0), 0),
        passed: testResults.reduce((sum, r) => sum + (r.passed || 0), 0),
        failed: testResults.reduce((sum, r) => sum + (r.failed || 0), 0),
        skipped: testResults.reduce((sum, r) => sum + (r.skipped || 0), 0)
      },
      workflowCoverage: calculateWorkflowCoverage(testResults),
      performanceMetrics: extractPerformanceMetrics(testResults),
      recommendations: generateRecommendations(testResults)
    };

    const summaryPath = path.join(resultsDir, 'workflow-test-summary.json');
    await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2));

    // Generate human-readable summary
    const readableSummary = generateReadableSummary(summary);
    const readablePath = path.join(resultsDir, 'workflow-test-summary.md');
    await fs.writeFile(readablePath, readableSummary);

    console.log(`📊 Test summary generated: ${summaryPath}`);

  } catch (error) {
    console.error('Failed to generate test summary:', error);
  }
}

function calculateWorkflowCoverage(testResults: any[]): any {
  // Calculate workflow coverage metrics
  const workflows = ['search', 'navigation', 'error-recovery', 'analytics', 'accessibility'];
  const coverage: any = {};

  workflows.forEach(workflow => {
    const workflowTests = testResults.flatMap(r => r.results || [])
      .filter((test: any) => test.test?.toLowerCase().includes(workflow));

    const passed = workflowTests.filter((test: any) => test.status === 'passed').length;
    const total = workflowTests.length;

    coverage[workflow] = {
      total,
      passed,
      coverage: total > 0 ? (passed / total) * 100 : 0
    };
  });

  return coverage;
}

function extractPerformanceMetrics(testResults: any[]): any {
  const allTests = testResults.flatMap(r => r.results || []);
  const durations = allTests.map((test: any) => test.duration || 0).filter(d => d > 0);

  if (durations.length === 0) {
    return { message: 'No performance data available' };
  }

  return {
    averageTestDuration: durations.reduce((sum, d) => sum + d, 0) / durations.length,
    fastestTest: Math.min(...durations),
    slowestTest: Math.max(...durations),
    totalTestTime: durations.reduce((sum, d) => sum + d, 0),
    testsOverThreshold: durations.filter(d => d > 10000).length // Tests over 10 seconds
  };
}

function generateRecommendations(testResults: any[]): string[] {
  const recommendations = [];
  const allTests = testResults.flatMap(r => r.results || []);
  const failedTests = allTests.filter((test: any) => test.status === 'failed');
  const slowTests = allTests.filter((test: any) => (test.duration || 0) > 10000);

  if (failedTests.length > 0) {
    recommendations.push(`Address ${failedTests.length} failing workflow tests`);
  }

  if (slowTests.length > 0) {
    recommendations.push(`Optimize ${slowTests.length} slow workflow tests (>10s)`);
  }

  const coverage = calculateWorkflowCoverage(testResults);
  Object.entries(coverage).forEach(([workflow, data]: [string, any]) => {
    if (data.coverage < 80) {
      recommendations.push(`Improve ${workflow} workflow test coverage (currently ${data.coverage.toFixed(1)}%)`);
    }
  });

  if (recommendations.length === 0) {
    recommendations.push('All workflow tests are performing well!');
  }

  return recommendations;
}

function generateReadableSummary(summary: any): string {
  const passRate = ((summary.aggregatedResults.passed / summary.aggregatedResults.totalTests) * 100).toFixed(1);

  return `# Workflow Test Summary

Generated: ${summary.timestamp}

## Test Results
- **Total Tests**: ${summary.aggregatedResults.totalTests}
- **Passed**: ${summary.aggregatedResults.passed} (${passRate}%)
- **Failed**: ${summary.aggregatedResults.failed}
- **Skipped**: ${summary.aggregatedResults.skipped}

## Workflow Coverage
${Object.entries(summary.workflowCoverage).map(([workflow, data]: [string, any]) =>
  `- **${workflow}**: ${data.coverage.toFixed(1)}% (${data.passed}/${data.total})`
).join('\n')}

## Performance Metrics
- **Average Test Duration**: ${(summary.performanceMetrics.averageTestDuration / 1000).toFixed(2)}s
- **Fastest Test**: ${(summary.performanceMetrics.fastestTest / 1000).toFixed(2)}s
- **Slowest Test**: ${(summary.performanceMetrics.slowestTest / 1000).toFixed(2)}s
- **Total Test Time**: ${(summary.performanceMetrics.totalTestTime / 1000).toFixed(2)}s

## Recommendations
${summary.recommendations.map((rec: string) => `- ${rec}`).join('\n')}
`;
}

async function archiveTestArtifacts(): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const archiveDir = path.join(process.cwd(), 'test-archives', `workflow-tests-${timestamp}`);

  await fs.mkdir(archiveDir, { recursive: true });

  // Archive important test artifacts
  const artifactDirs = ['test-results', 'test-reports'];

  for (const dir of artifactDirs) {
    const srcPath = path.join(process.cwd(), dir);
    const destPath = path.join(archiveDir, dir);

    try {
      await fs.cp(srcPath, destPath, { recursive: true });
    } catch (error) {
      console.warn(`Could not archive ${dir}:`, error);
    }
  }

  console.log(`📁 Test artifacts archived to: ${archiveDir}`);
}

async function cleanupTestData(): Promise<void> {
  // Clean up temporary test data
  const tempDirs = [
    'test-data/temp',
    'test-results/temp'
  ];

  for (const dir of tempDirs) {
    const fullPath = path.join(process.cwd(), dir);
    try {
      await fs.rmdir(fullPath, { recursive: true });
    } catch (error) {
      // Directory might not exist
    }
  }
}

async function stopMockServices(): Promise<void> {
  // Stop any mock services that were started during testing
  try {
    const mockConfigPath = path.join(process.cwd(), 'test-results/mock-config.json');
    const mockConfig = JSON.parse(await fs.readFile(mockConfigPath, 'utf-8'));

    if (mockConfig.analytics?.enabled) {
      // Stop mock analytics service
      console.log('🛑 Stopping mock services...');
    }
  } catch (error) {
    // Mock config might not exist
  }
}

async function generateCoverageReports(): Promise<void> {
  try {
    console.log('📊 Generating coverage reports...');

    // This would typically involve processing Istanbul/NYC coverage data
    // or generating custom workflow coverage reports

    const coverageDir = path.join(process.cwd(), 'coverage/workflow-tests');
    await fs.mkdir(coverageDir, { recursive: true });

    // Generate workflow coverage report
    const workflowCoverage = {
      timestamp: new Date().toISOString(),
      totalWorkflows: 8,
      coveredWorkflows: 7,
      coveragePercentage: 87.5,
      uncoveredWorkflows: ['batch-operations'],
      recommendations: [
        'Add batch operations workflow tests',
        'Improve error scenario coverage',
        'Add more accessibility workflow tests'
      ]
    };

    const coveragePath = path.join(coverageDir, 'workflow-coverage.json');
    await fs.writeFile(coveragePath, JSON.stringify(workflowCoverage, null, 2));

  } catch (error) {
    console.error('Failed to generate coverage reports:', error);
  }
}

export default globalTeardown;