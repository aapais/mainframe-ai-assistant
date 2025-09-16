/**
 * Workflow Test Runner
 * Orchestrates execution of comprehensive workflow tests with reporting
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

interface TestResult {
  suite: string;
  test: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
}

interface WorkflowReport {
  timestamp: string;
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  results: TestResult[];
  coverage?: {
    workflows: number;
    userJourneys: number;
    errorScenarios: number;
  };
}

class WorkflowTestRunner {
  private results: TestResult[] = [];
  private startTime: number = 0;

  async runWorkflowTests(options: {
    suite?: string;
    parallel?: boolean;
    headless?: boolean;
    browsers?: string[];
    coverage?: boolean;
  } = {}): Promise<WorkflowReport> {
    this.startTime = Date.now();

    console.log('🚀 Starting Comprehensive Workflow Testing...');

    try {
      // Prepare test environment
      await this.setupTestEnvironment();

      // Run workflow tests based on suite
      switch (options.suite) {
        case 'search':
          await this.runSearchWorkflows(options);
          break;
        case 'navigation':
          await this.runNavigationWorkflows(options);
          break;
        case 'error-recovery':
          await this.runErrorRecoveryWorkflows(options);
          break;
        case 'analytics':
          await this.runAnalyticsWorkflows(options);
          break;
        case 'accessibility':
          await this.runAccessibilityWorkflows(options);
          break;
        default:
          await this.runAllWorkflows(options);
      }

      // Generate report
      const report = await this.generateReport(options.coverage);
      await this.saveReport(report);

      console.log('✅ Workflow testing completed successfully');
      return report;

    } catch (error) {
      console.error('❌ Workflow testing failed:', error);
      throw error;
    }
  }

  private async setupTestEnvironment(): Promise<void> {
    console.log('📋 Setting up test environment...');

    // Ensure test data is available
    await this.ensureTestData();

    // Setup test configurations
    await this.setupTestConfigs();

    // Clear previous test artifacts
    await this.clearTestArtifacts();
  }

  private async ensureTestData(): Promise<void> {
    const testDataPath = path.join(process.cwd(), 'tests/fixtures/workflow-test-data.json');

    const testData = {
      entries: [
        {
          id: 'workflow-test-1',
          title: 'VSAM Status 35 File Not Found',
          problem: 'VSAM file cannot be located by the system',
          solution: 'Check dataset cataloging and verify file existence',
          category: 'VSAM',
          tags: ['vsam', 'status-35', 'file-not-found'],
          created: '2024-01-15T10:00:00Z'
        },
        {
          id: 'workflow-test-2',
          title: 'JCL Syntax Error in DD Statement',
          problem: 'Job fails due to syntax error in dataset definition',
          solution: 'Review DD statement syntax and correct errors',
          category: 'JCL',
          tags: ['jcl', 'syntax', 'dd-statement'],
          created: '2024-01-14T09:30:00Z'
        },
        // Add more test data as needed
      ],
      workflows: [
        {
          name: 'complete-search-workflow',
          steps: ['navigate', 'search', 'filter', 'select', 'view-detail'],
          expectedDuration: 10000
        },
        {
          name: 'error-recovery-workflow',
          steps: ['search', 'trigger-error', 'recover', 'retry'],
          expectedDuration: 15000
        }
      ]
    };

    await fs.writeFile(testDataPath, JSON.stringify(testData, null, 2));
  }

  private async setupTestConfigs(): Promise<void> {
    // Create dynamic test configuration based on environment
    const config = {
      use: {
        baseURL: process.env.TEST_BASE_URL || 'http://localhost:3000',
        headless: process.env.HEADLESS !== 'false',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure'
      },
      projects: [
        {
          name: 'workflow-chromium',
          use: { browserName: 'chromium' }
        },
        {
          name: 'workflow-firefox',
          use: { browserName: 'firefox' }
        }
      ]
    };

    const configPath = path.join(process.cwd(), 'playwright.workflow.config.ts');
    const configContent = `
import { defineConfig } from '@playwright/test';

export default defineConfig(${JSON.stringify(config, null, 2)});
`;

    await fs.writeFile(configPath, configContent);
  }

  private async clearTestArtifacts(): Promise<void> {
    const artifactsDir = path.join(process.cwd(), 'test-results/workflow-tests');
    try {
      await fs.rmdir(artifactsDir, { recursive: true });
    } catch {
      // Directory might not exist
    }
    await fs.mkdir(artifactsDir, { recursive: true });
  }

  private async runSearchWorkflows(options: any): Promise<void> {
    console.log('🔍 Running search workflow tests...');

    const testCommands = [
      'npx playwright test tests/e2e/comprehensive-workflow-validation.e2e.test.ts --grep "Complete search to result workflow"',
      'npx playwright test tests/e2e/comprehensive-workflow-validation.e2e.test.ts --grep "Multi-step filter refinement workflow"',
      'npx playwright test tests/e2e/comprehensive-workflow-validation.e2e.test.ts --grep "Search analytics workflow"'
    ];

    await this.executeTestCommands(testCommands, options);
  }

  private async runNavigationWorkflows(options: any): Promise<void> {
    console.log('🧭 Running navigation workflow tests...');

    const testCommands = [
      'npx playwright test tests/e2e/comprehensive-workflow-validation.e2e.test.ts --grep "Navigation and breadcrumb workflow"',
      'npx playwright test tests/e2e/comprehensive-workflow-validation.e2e.test.ts --grep "Workflow state persistence"',
      'npx playwright test tests/e2e/comprehensive-workflow-validation.e2e.test.ts --grep "Mobile responsive workflow"'
    ];

    await this.executeTestCommands(testCommands, options);
  }

  private async runErrorRecoveryWorkflows(options: any): Promise<void> {
    console.log('⚠️ Running error recovery workflow tests...');

    const testCommands = [
      'npx playwright test tests/e2e/comprehensive-workflow-validation.e2e.test.ts --grep "Error recovery workflow"',
      'npx playwright test tests/e2e/comprehensive-workflow-validation.e2e.test.ts --grep "Workflow interruption and recovery"'
    ];

    await this.executeTestCommands(testCommands, options);
  }

  private async runAnalyticsWorkflows(options: any): Promise<void> {
    console.log('📊 Running analytics workflow tests...');

    const testCommands = [
      'npx playwright test tests/e2e/comprehensive-workflow-validation.e2e.test.ts --grep "Search analytics workflow"',
      'npx playwright test tests/e2e/comprehensive-workflow-validation.e2e.test.ts --grep "User interaction tracking workflow"',
      'npx playwright test tests/e2e/comprehensive-workflow-validation.e2e.test.ts --grep "Performance monitoring workflow"'
    ];

    await this.executeTestCommands(testCommands, options);
  }

  private async runAccessibilityWorkflows(options: any): Promise<void> {
    console.log('♿ Running accessibility workflow tests...');

    const testCommands = [
      'npx playwright test tests/e2e/comprehensive-workflow-validation.e2e.test.ts --grep "Keyboard navigation workflow"',
      'npx playwright test tests/e2e/comprehensive-workflow-validation.e2e.test.ts --grep "Screen reader compatibility workflow"'
    ];

    await this.executeTestCommands(testCommands, options);
  }

  private async runAllWorkflows(options: any): Promise<void> {
    console.log('🎯 Running all workflow tests...');

    const testCommand = 'npx playwright test tests/e2e/comprehensive-workflow-validation.e2e.test.ts';
    await this.executeTestCommands([testCommand], options);
  }

  private async executeTestCommands(commands: string[], options: any): Promise<void> {
    for (const command of commands) {
      try {
        let fullCommand = command;

        if (options.headless === false) {
          fullCommand += ' --headed';
        }

        if (options.browsers) {
          fullCommand += ` --project=${options.browsers.join(',')}`;
        }

        console.log(`Executing: ${fullCommand}`);
        const { stdout, stderr } = await execAsync(fullCommand);

        // Parse test results from output
        this.parseTestResults(stdout, stderr);

      } catch (error: any) {
        console.error(`Test command failed: ${command}`);
        console.error(error.stdout || error.message);

        // Record failed test
        this.results.push({
          suite: 'workflow-tests',
          test: command,
          status: 'failed',
          duration: 0,
          error: error.message
        });
      }
    }
  }

  private parseTestResults(stdout: string, stderr: string): void {
    // Parse Playwright test output to extract individual test results
    const lines = stdout.split('\n');

    for (const line of lines) {
      if (line.includes('✓') || line.includes('✗') || line.includes('↷')) {
        const match = line.match(/([✓✗↷])\s+(.+?)\s+\((\d+)ms\)/);
        if (match) {
          const [, symbol, testName, duration] = match;

          let status: 'passed' | 'failed' | 'skipped';
          switch (symbol) {
            case '✓':
              status = 'passed';
              break;
            case '✗':
              status = 'failed';
              break;
            default:
              status = 'skipped';
          }

          this.results.push({
            suite: 'workflow-tests',
            test: testName,
            status,
            duration: parseInt(duration)
          });
        }
      }
    }
  }

  private async generateReport(includeCoverage: boolean = false): Promise<WorkflowReport> {
    const totalDuration = Date.now() - this.startTime;

    const report: WorkflowReport = {
      timestamp: new Date().toISOString(),
      totalTests: this.results.length,
      passed: this.results.filter(r => r.status === 'passed').length,
      failed: this.results.filter(r => r.status === 'failed').length,
      skipped: this.results.filter(r => r.status === 'skipped').length,
      duration: totalDuration,
      results: this.results
    };

    if (includeCoverage) {
      report.coverage = await this.calculateWorkflowCoverage();
    }

    return report;
  }

  private async calculateWorkflowCoverage(): Promise<{ workflows: number; userJourneys: number; errorScenarios: number }> {
    // Calculate workflow coverage based on test results
    const workflowTests = this.results.filter(r => r.test.includes('workflow'));
    const journeyTests = this.results.filter(r => r.test.includes('journey') || r.test.includes('user'));
    const errorTests = this.results.filter(r => r.test.includes('error') || r.test.includes('recovery'));

    return {
      workflows: (workflowTests.filter(t => t.status === 'passed').length / Math.max(workflowTests.length, 1)) * 100,
      userJourneys: (journeyTests.filter(t => t.status === 'passed').length / Math.max(journeyTests.length, 1)) * 100,
      errorScenarios: (errorTests.filter(t => t.status === 'passed').length / Math.max(errorTests.length, 1)) * 100
    };
  }

  private async saveReport(report: WorkflowReport): Promise<void> {
    const reportsDir = path.join(process.cwd(), 'test-results/workflow-reports');
    await fs.mkdir(reportsDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = path.join(reportsDir, `workflow-report-${timestamp}.json`);

    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

    // Also generate HTML report
    const htmlReport = this.generateHtmlReport(report);
    const htmlPath = path.join(reportsDir, `workflow-report-${timestamp}.html`);
    await fs.writeFile(htmlPath, htmlReport);

    console.log(`📊 Workflow test report saved: ${reportPath}`);
    console.log(`🌐 HTML report saved: ${htmlPath}`);
  }

  private generateHtmlReport(report: WorkflowReport): string {
    const passRate = ((report.passed / report.totalTests) * 100).toFixed(1);

    return `
<!DOCTYPE html>
<html>
<head>
    <title>Workflow Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .summary { display: flex; gap: 20px; margin: 20px 0; }
        .metric { background: white; padding: 15px; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .metric.passed { border-left: 4px solid #4CAF50; }
        .metric.failed { border-left: 4px solid #f44336; }
        .metric.skipped { border-left: 4px solid #ff9800; }
        .results { margin: 20px 0; }
        .test-result { padding: 10px; margin: 5px 0; border-radius: 3px; }
        .test-result.passed { background: #e8f5e8; }
        .test-result.failed { background: #ffebee; }
        .test-result.skipped { background: #fff3e0; }
        .coverage { margin: 20px 0; }
        .progress-bar { background: #ddd; border-radius: 10px; overflow: hidden; margin: 5px 0; }
        .progress-fill { height: 20px; background: #4CAF50; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Workflow Test Report</h1>
        <p>Generated: ${report.timestamp}</p>
        <p>Duration: ${(report.duration / 1000).toFixed(2)}s</p>
        <p>Pass Rate: ${passRate}%</p>
    </div>

    <div class="summary">
        <div class="metric passed">
            <h3>Passed</h3>
            <p>${report.passed}</p>
        </div>
        <div class="metric failed">
            <h3>Failed</h3>
            <p>${report.failed}</p>
        </div>
        <div class="metric skipped">
            <h3>Skipped</h3>
            <p>${report.skipped}</p>
        </div>
    </div>

    ${report.coverage ? `
    <div class="coverage">
        <h2>Workflow Coverage</h2>
        <div>
            <strong>Complete Workflows:</strong> ${report.coverage.workflows.toFixed(1)}%
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${report.coverage.workflows}%"></div>
            </div>
        </div>
        <div>
            <strong>User Journeys:</strong> ${report.coverage.userJourneys.toFixed(1)}%
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${report.coverage.userJourneys}%"></div>
            </div>
        </div>
        <div>
            <strong>Error Scenarios:</strong> ${report.coverage.errorScenarios.toFixed(1)}%
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${report.coverage.errorScenarios}%"></div>
            </div>
        </div>
    </div>
    ` : ''}

    <div class="results">
        <h2>Test Results</h2>
        ${report.results.map(result => `
            <div class="test-result ${result.status}">
                <strong>${result.test}</strong>
                <span style="float: right;">${result.duration}ms</span>
                ${result.error ? `<div style="color: red; margin-top: 5px;">${result.error}</div>` : ''}
            </div>
        `).join('')}
    </div>
</body>
</html>
    `;
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const options: any = {};

  // Parse command line arguments
  args.forEach((arg, index) => {
    switch (arg) {
      case '--suite':
        options.suite = args[index + 1];
        break;
      case '--parallel':
        options.parallel = true;
        break;
      case '--headed':
        options.headless = false;
        break;
      case '--coverage':
        options.coverage = true;
        break;
      case '--browsers':
        options.browsers = args[index + 1]?.split(',');
        break;
    }
  });

  const runner = new WorkflowTestRunner();
  runner.runWorkflowTests(options)
    .then(report => {
      console.log(`\n📊 Workflow Test Summary:`);
      console.log(`Total Tests: ${report.totalTests}`);
      console.log(`Passed: ${report.passed} (${((report.passed / report.totalTests) * 100).toFixed(1)}%)`);
      console.log(`Failed: ${report.failed}`);
      console.log(`Skipped: ${report.skipped}`);
      console.log(`Duration: ${(report.duration / 1000).toFixed(2)}s`);

      if (report.failed > 0) {
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('❌ Workflow test runner failed:', error);
      process.exit(1);
    });
}

export { WorkflowTestRunner };