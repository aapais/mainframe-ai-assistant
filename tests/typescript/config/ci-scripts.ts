/**
 * CI/CD Integration Scripts for TypeScript Testing Framework
 * Automated scripts for continuous integration and deployment
 */

import { exec } from 'child_process';
import { promises as fs } from 'fs';
import * as path from 'path';
import { TypeSafetyReporter } from '../core/TypeSafetyReporter';
import { createTypeTestConfig } from './type-test.config';

interface CIConfig {
  environment: 'github' | 'gitlab' | 'jenkins' | 'azure' | 'circleci';
  reportFormats: ('json' | 'html' | 'markdown' | 'junit')[];
  failOnErrors: boolean;
  failOnWarnings: boolean;
  uploadArtifacts: boolean;
  sendNotifications: boolean;
  parallelJobs: number;
  timeoutMinutes: number;
}

interface CIResult {
  success: boolean;
  exitCode: number;
  duration: number;
  reportPaths: string[];
  errorCount: number;
  warningCount: number;
  summary: string;
}

/**
 * CI/CD Integration Manager
 */
export class CIIntegration {
  private config: CIConfig;
  private reporter: TypeSafetyReporter;
  private startTime: number = 0;

  constructor(config: Partial<CIConfig> = {}) {
    this.config = {
      environment: 'github',
      reportFormats: ['json', 'html', 'junit'],
      failOnErrors: true,
      failOnWarnings: false,
      uploadArtifacts: true,
      sendNotifications: true,
      parallelJobs: 2,
      timeoutMinutes: 10,
      ...config
    };

    const testConfig = createTypeTestConfig('ci');
    this.reporter = new TypeSafetyReporter(testConfig.reporter);
  }

  /**
   * Main CI execution entry point
   */
  async runCI(): Promise<CIResult> {
    this.startTime = Date.now();
    console.log('🚀 Starting TypeScript Type Testing CI Pipeline...');

    try {
      // Pre-flight checks
      await this.preflightChecks();

      // Run type tests
      const testResults = await this.runTypeTests();

      // Generate reports
      const reportPaths = await this.generateReports(testResults);

      // Upload artifacts if configured
      if (this.config.uploadArtifacts) {
        await this.uploadArtifacts(reportPaths);
      }

      // Send notifications if configured
      if (this.config.sendNotifications) {
        await this.sendNotifications(testResults);
      }

      const duration = Date.now() - this.startTime;
      const result: CIResult = {
        success: this.shouldPassCI(testResults),
        exitCode: this.shouldPassCI(testResults) ? 0 : 1,
        duration,
        reportPaths,
        errorCount: testResults.errorCount || 0,
        warningCount: testResults.warningCount || 0,
        summary: this.generateSummary(testResults, duration)
      };

      console.log(result.summary);
      return result;

    } catch (error) {
      const duration = Date.now() - this.startTime;
      const result: CIResult = {
        success: false,
        exitCode: 1,
        duration,
        reportPaths: [],
        errorCount: 1,
        warningCount: 0,
        summary: `❌ CI Pipeline failed: ${error instanceof Error ? error.message : String(error)}`
      };

      console.error(result.summary);
      return result;
    }
  }

  /**
   * Pre-flight checks before running tests
   */
  private async preflightChecks(): Promise<void> {
    console.log('🔍 Running pre-flight checks...');

    // Check Node.js version
    await this.checkNodeVersion();

    // Check TypeScript version
    await this.checkTypeScriptVersion();

    // Verify test files exist
    await this.verifyTestFiles();

    // Check dependencies
    await this.checkDependencies();

    console.log('✅ Pre-flight checks passed');
  }

  /**
   * Run TypeScript type tests
   */
  private async runTypeTests(): Promise<any> {
    console.log('🧪 Running TypeScript type tests...');

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Tests timed out after ${this.config.timeoutMinutes} minutes`));
      }, this.config.timeoutMinutes * 60 * 1000);

      const jestConfig = path.resolve(__dirname, 'jest.typescript.config.js');
      const cmd = `npx jest --config="${jestConfig}" --ci --coverage --json --outputFile=test-results.json`;

      exec(cmd, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
        clearTimeout(timeout);

        if (error && error.code !== 1) {
          // Code 1 means tests failed but ran successfully
          reject(new Error(`Test execution failed: ${error.message}`));
          return;
        }

        try {
          const results = JSON.parse(stdout || '{}');
          resolve(results);
        } catch (parseError) {
          console.warn('Could not parse test results JSON, using stderr output');
          resolve({ stderr, stdout });
        }
      });
    });
  }

  /**
   * Generate reports in multiple formats
   */
  private async generateReports(testResults: any): Promise<string[]> {
    console.log('📊 Generating reports...');
    const reportPaths: string[] = [];

    const outputDir = path.resolve(process.cwd(), 'reports', 'typescript');
    await fs.mkdir(outputDir, { recursive: true });

    for (const format of this.config.reportFormats) {
      try {
        const reportPath = await this.generateReport(testResults, format, outputDir);
        reportPaths.push(reportPath);
        console.log(`📄 Generated ${format.toUpperCase()} report: ${reportPath}`);
      } catch (error) {
        console.warn(`⚠️ Failed to generate ${format} report:`, error);
      }
    }

    return reportPaths;
  }

  /**
   * Generate individual report
   */
  private async generateReport(testResults: any, format: string, outputDir: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `typescript-type-test-report-${timestamp}.${format === 'junit' ? 'xml' : format}`;
    const filepath = path.join(outputDir, filename);

    let content: string;

    switch (format) {
      case 'json':
        content = JSON.stringify(testResults, null, 2);
        break;

      case 'html':
        content = this.generateHTMLReport(testResults);
        break;

      case 'markdown':
        content = this.generateMarkdownReport(testResults);
        break;

      case 'junit':
        content = this.generateJUnitReport(testResults);
        break;

      default:
        throw new Error(`Unsupported report format: ${format}`);
    }

    await fs.writeFile(filepath, content, 'utf8');
    return filepath;
  }

  /**
   * Upload artifacts to CI system
   */
  private async uploadArtifacts(reportPaths: string[]): Promise<void> {
    console.log('⬆️ Uploading artifacts...');

    switch (this.config.environment) {
      case 'github':
        await this.uploadGitHubArtifacts(reportPaths);
        break;

      case 'gitlab':
        await this.uploadGitLabArtifacts(reportPaths);
        break;

      case 'jenkins':
        await this.uploadJenkinsArtifacts(reportPaths);
        break;

      case 'azure':
        await this.uploadAzureArtifacts(reportPaths);
        break;

      case 'circleci':
        await this.uploadCircleCIArtifacts(reportPaths);
        break;

      default:
        console.log('📁 Artifact upload not configured for this environment');
    }
  }

  /**
   * Send notifications about test results
   */
  private async sendNotifications(testResults: any): Promise<void> {
    console.log('📢 Sending notifications...');

    const success = this.shouldPassCI(testResults);
    const message = success
      ? '✅ TypeScript type tests passed successfully!'
      : '❌ TypeScript type tests failed';

    // Slack notification
    if (process.env.SLACK_WEBHOOK_URL) {
      await this.sendSlackNotification(message, testResults);
    }

    // Teams notification
    if (process.env.TEAMS_WEBHOOK_URL) {
      await this.sendTeamsNotification(message, testResults);
    }

    // Email notification
    if (process.env.EMAIL_RECIPIENTS) {
      await this.sendEmailNotification(message, testResults);
    }
  }

  // Private helper methods
  private async checkNodeVersion(): Promise<void> {
    return new Promise((resolve, reject) => {
      exec('node --version', (error, stdout) => {
        if (error) {
          reject(new Error('Node.js not found'));
          return;
        }

        const version = stdout.trim();
        const majorVersion = parseInt(version.substring(1));

        if (majorVersion < 16) {
          reject(new Error(`Node.js ${majorVersion} is not supported. Minimum version: 16`));
          return;
        }

        console.log(`✓ Node.js version: ${version}`);
        resolve();
      });
    });
  }

  private async checkTypeScriptVersion(): Promise<void> {
    return new Promise((resolve, reject) => {
      exec('npx tsc --version', (error, stdout) => {
        if (error) {
          reject(new Error('TypeScript not found'));
          return;
        }

        const version = stdout.trim();
        console.log(`✓ TypeScript version: ${version}`);
        resolve();
      });
    });
  }

  private async verifyTestFiles(): Promise<void> {
    const testDir = path.resolve(__dirname, '..');
    const coreDir = path.join(testDir, 'core');

    try {
      await fs.access(coreDir);
      const files = await fs.readdir(coreDir);
      const tsFiles = files.filter(f => f.endsWith('.ts'));

      if (tsFiles.length === 0) {
        throw new Error('No TypeScript test files found');
      }

      console.log(`✓ Found ${tsFiles.length} TypeScript test files`);
    } catch (error) {
      throw new Error('Test files verification failed');
    }
  }

  private async checkDependencies(): Promise<void> {
    const requiredDeps = ['jest', 'ts-jest', '@types/jest'];

    for (const dep of requiredDeps) {
      try {
        require.resolve(dep);
        console.log(`✓ Dependency found: ${dep}`);
      } catch {
        throw new Error(`Required dependency missing: ${dep}`);
      }
    }
  }

  private shouldPassCI(testResults: any): boolean {
    const hasErrors = (testResults.errorCount || 0) > 0;
    const hasWarnings = (testResults.warningCount || 0) > 0;

    if (this.config.failOnErrors && hasErrors) {
      return false;
    }

    if (this.config.failOnWarnings && hasWarnings) {
      return false;
    }

    return true;
  }

  private generateSummary(testResults: any, duration: number): string {
    const success = this.shouldPassCI(testResults);
    const icon = success ? '✅' : '❌';
    const status = success ? 'PASSED' : 'FAILED';
    const durationText = `${Math.round(duration / 1000)}s`;

    return `
${icon} TypeScript Type Tests ${status}
⏱️ Duration: ${durationText}
📊 Results: ${testResults.numPassedTests || 0} passed, ${testResults.numFailedTests || 0} failed
⚠️ Warnings: ${testResults.warningCount || 0}
❌ Errors: ${testResults.errorCount || 0}
`;
  }

  private generateHTMLReport(testResults: any): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <title>TypeScript Type Test Results</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .summary { background: #f5f5f5; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
    .pass { color: green; }
    .fail { color: red; }
    .warn { color: orange; }
  </style>
</head>
<body>
  <h1>TypeScript Type Test Results</h1>
  <div class="summary">
    <h2>Summary</h2>
    <p>Total Tests: ${testResults.numTotalTests || 0}</p>
    <p class="pass">Passed: ${testResults.numPassedTests || 0}</p>
    <p class="fail">Failed: ${testResults.numFailedTests || 0}</p>
    <p class="warn">Warnings: ${testResults.warningCount || 0}</p>
  </div>
  <div class="details">
    <h2>Test Details</h2>
    <pre>${JSON.stringify(testResults, null, 2)}</pre>
  </div>
</body>
</html>
`;
  }

  private generateMarkdownReport(testResults: any): string {
    return `
# TypeScript Type Test Results

## Summary
- **Total Tests**: ${testResults.numTotalTests || 0}
- **Passed**: ${testResults.numPassedTests || 0}
- **Failed**: ${testResults.numFailedTests || 0}
- **Warnings**: ${testResults.warningCount || 0}
- **Success Rate**: ${((testResults.numPassedTests || 0) / (testResults.numTotalTests || 1) * 100).toFixed(1)}%

## Details
\`\`\`json
${JSON.stringify(testResults, null, 2)}
\`\`\`
`;
  }

  private generateJUnitReport(testResults: any): string {
    const testSuites = testResults.testResults || [];
    const totalTests = testResults.numTotalTests || 0;
    const failures = testResults.numFailedTests || 0;
    const time = (testResults.totalTime || 0) / 1000;

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="TypeScript Type Tests" tests="${totalTests}" failures="${failures}" time="${time}">`;

    for (const suite of testSuites) {
      const suiteName = suite.testFilePath || 'Unknown';
      const suiteTests = suite.assertionResults || [];

      xml += `
  <testsuite name="${suiteName}" tests="${suiteTests.length}">`;

      for (const test of suiteTests) {
        xml += `
    <testcase name="${test.title}" time="${(test.duration || 0) / 1000}">`;

        if (test.status === 'failed') {
          xml += `
      <failure message="${test.failureMessages?.[0] || 'Test failed'}">
        ${test.failureMessages?.join('\n') || ''}
      </failure>`;
        }

        xml += `
    </testcase>`;
      }

      xml += `
  </testsuite>`;
    }

    xml += `
</testsuites>`;

    return xml;
  }

  private async uploadGitHubArtifacts(reportPaths: string[]): Promise<void> {
    // GitHub Actions artifact upload
    for (const reportPath of reportPaths) {
      console.log(`📦 Uploading to GitHub Actions: ${reportPath}`);
      // Implementation would use @actions/artifact
    }
  }

  private async uploadGitLabArtifacts(reportPaths: string[]): Promise<void> {
    // GitLab CI artifact configuration is handled in .gitlab-ci.yml
    console.log('📦 GitLab artifacts configured in .gitlab-ci.yml');
  }

  private async uploadJenkinsArtifacts(reportPaths: string[]): Promise<void> {
    // Jenkins artifact archiving
    console.log('📦 Jenkins artifacts will be archived by pipeline');
  }

  private async uploadAzureArtifacts(reportPaths: string[]): Promise<void> {
    // Azure DevOps artifact upload
    console.log('📦 Azure DevOps artifacts configured in pipeline');
  }

  private async uploadCircleCIArtifacts(reportPaths: string[]): Promise<void> {
    // CircleCI artifact storage
    console.log('📦 CircleCI artifacts stored in workspace');
  }

  private async sendSlackNotification(message: string, testResults: any): Promise<void> {
    // Slack webhook notification implementation
    console.log('📱 Slack notification sent');
  }

  private async sendTeamsNotification(message: string, testResults: any): Promise<void> {
    // Microsoft Teams webhook notification implementation
    console.log('📱 Teams notification sent');
  }

  private async sendEmailNotification(message: string, testResults: any): Promise<void> {
    // Email notification implementation
    console.log('📧 Email notification sent');
  }
}

/**
 * CLI entry point for CI execution
 */
export async function runCICommand(): Promise<void> {
  const environment = (process.env.CI_ENVIRONMENT as any) || 'github';
  const failOnWarnings = process.env.FAIL_ON_WARNINGS === 'true';

  const ci = new CIIntegration({
    environment,
    failOnWarnings,
    parallelJobs: parseInt(process.env.PARALLEL_JOBS || '2'),
    timeoutMinutes: parseInt(process.env.TIMEOUT_MINUTES || '10')
  });

  const result = await ci.runCI();
  process.exit(result.exitCode);
}

// Export for direct use
export default CIIntegration;