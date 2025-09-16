#!/usr/bin/env node

/**
 * Accessibility Audit Script
 *
 * This script runs comprehensive accessibility audits on the application
 * and generates detailed reports for CI/CD and development workflows.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  outputDir: './accessibility-reports',
  timeoutMs: 60000,
  maxRetries: 3,
  reportFormats: ['json', 'html', 'markdown'],
  thresholds: {
    violations: 0,
    criticalViolations: 0,
    wcagLevelAA: true,
  },
};

class AccessibilityAuditor {
  constructor(config = {}) {
    this.config = { ...CONFIG, ...config };
    this.results = {
      timestamp: new Date().toISOString(),
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      violations: [],
      summary: {},
    };
  }

  async run() {
    console.log('🔍 Starting accessibility audit...\n');

    try {
      // Setup output directory
      this.setupOutputDirectory();

      // Run automated tests
      await this.runAutomatedTests();

      // Generate reports
      await this.generateReports();

      // Validate against thresholds
      const passed = this.validateThresholds();

      // Print summary
      this.printSummary();

      process.exit(passed ? 0 : 1);
    } catch (error) {
      console.error('❌ Audit failed:', error.message);
      process.exit(1);
    }
  }

  setupOutputDirectory() {
    if (!fs.existsSync(this.config.outputDir)) {
      fs.mkdirSync(this.config.outputDir, { recursive: true });
    }

    // Clean old reports
    const files = fs.readdirSync(this.config.outputDir);
    files.forEach(file => {
      if (file.startsWith('accessibility-')) {
        fs.unlinkSync(path.join(this.config.outputDir, file));
      }
    });
  }

  async runAutomatedTests() {
    console.log('🧪 Running automated accessibility tests...');

    try {
      // Run Jest accessibility tests
      const testCommand = 'npm run test:accessibility:ci';
      const output = execSync(testCommand, {
        encoding: 'utf8',
        timeout: this.config.timeoutMs,
        stdio: 'pipe',
      });

      this.parseTestResults(output);
      console.log('✅ Automated tests completed');
    } catch (error) {
      console.error('❌ Automated tests failed');
      this.results.failedTests++;
      throw error;
    }
  }

  parseTestResults(output) {
    // Parse Jest output for test results
    const lines = output.split('\n');
    let currentSuite = null;
    let testResults = [];

    lines.forEach(line => {
      // Parse test suite headers
      if (line.includes('PASS') || line.includes('FAIL')) {
        const match = line.match(/(PASS|FAIL)\s+(.+)/);
        if (match) {
          const [, status, file] = match;
          testResults.push({
            file,
            status,
            violations: [],
          });
        }
      }

      // Parse violation details (simplified parsing)
      if (line.includes('violations')) {
        // Extract violation count and details
        this.results.violations.push({
          description: line.trim(),
          severity: 'error',
          file: currentSuite,
        });
      }
    });

    this.results.totalTests = testResults.length;
    this.results.passedTests = testResults.filter(r => r.status === 'PASS').length;
    this.results.failedTests = testResults.filter(r => r.status === 'FAIL').length;
  }

  async generateReports() {
    console.log('📊 Generating accessibility reports...');

    const timestamp = new Date().toISOString().split('T')[0];
    const baseFilename = `accessibility-audit-${timestamp}`;

    // Generate JSON report
    if (this.config.reportFormats.includes('json')) {
      const jsonReport = {
        metadata: {
          timestamp: this.results.timestamp,
          version: '1.0.0',
          standard: 'WCAG 2.1 AA',
          tool: 'mainframe-ai-assistant-audit',
        },
        summary: {
          totalTests: this.results.totalTests,
          passedTests: this.results.passedTests,
          failedTests: this.results.failedTests,
          violationCount: this.results.violations.length,
          passed: this.results.failedTests === 0,
        },
        violations: this.results.violations,
        thresholds: this.config.thresholds,
      };

      fs.writeFileSync(
        path.join(this.config.outputDir, `${baseFilename}.json`),
        JSON.stringify(jsonReport, null, 2)
      );
    }

    // Generate HTML report
    if (this.config.reportFormats.includes('html')) {
      const htmlReport = this.generateHTMLReport();
      fs.writeFileSync(
        path.join(this.config.outputDir, `${baseFilename}.html`),
        htmlReport
      );
    }

    // Generate Markdown report
    if (this.config.reportFormats.includes('markdown')) {
      const markdownReport = this.generateMarkdownReport();
      fs.writeFileSync(
        path.join(this.config.outputDir, `${baseFilename}.md`),
        markdownReport
      );
    }

    console.log(`✅ Reports generated in ${this.config.outputDir}`);
  }

  generateHTMLReport() {
    const violationsCount = this.results.violations.length;
    const statusColor = violationsCount === 0 ? '#28a745' : '#dc3545';
    const statusText = violationsCount === 0 ? 'PASSED' : 'FAILED';

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Accessibility Audit Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 40px; }
        .header { border-bottom: 2px solid #eee; padding-bottom: 20px; margin-bottom: 30px; }
        .status { display: inline-block; padding: 8px 16px; border-radius: 4px; color: white; font-weight: bold; }
        .passed { background-color: #28a745; }
        .failed { background-color: #dc3545; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 30px 0; }
        .metric { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; }
        .metric-value { font-size: 2em; font-weight: bold; color: #333; }
        .metric-label { color: #666; margin-top: 5px; }
        .violation { background: #fff5f5; border-left: 4px solid #dc3545; padding: 15px; margin: 10px 0; }
        .violation-title { font-weight: bold; color: #dc3545; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f8f9fa; font-weight: 600; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Accessibility Audit Report</h1>
        <p><strong>Generated:</strong> ${this.results.timestamp}</p>
        <p><strong>Standard:</strong> WCAG 2.1 AA</p>
        <span class="status ${statusText.toLowerCase()}">${statusText}</span>
    </div>

    <div class="summary">
        <div class="metric">
            <div class="metric-value">${this.results.totalTests}</div>
            <div class="metric-label">Total Tests</div>
        </div>
        <div class="metric">
            <div class="metric-value" style="color: #28a745;">${this.results.passedTests}</div>
            <div class="metric-label">Passed</div>
        </div>
        <div class="metric">
            <div class="metric-value" style="color: #dc3545;">${this.results.failedTests}</div>
            <div class="metric-label">Failed</div>
        </div>
        <div class="metric">
            <div class="metric-value" style="color: #dc3545;">${violationsCount}</div>
            <div class="metric-label">Violations</div>
        </div>
    </div>

    ${violationsCount > 0 ? `
    <h2>Violations</h2>
    ${this.results.violations.map(violation => `
        <div class="violation">
            <div class="violation-title">${violation.description}</div>
            <p><strong>Severity:</strong> ${violation.severity}</p>
            <p><strong>File:</strong> ${violation.file || 'Unknown'}</p>
        </div>
    `).join('')}
    ` : '<h2>🎉 No violations found!</h2>'}

    <h2>Test Results</h2>
    <table>
        <thead>
            <tr>
                <th>Metric</th>
                <th>Value</th>
                <th>Threshold</th>
                <th>Status</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>Total Violations</td>
                <td>${violationsCount}</td>
                <td>${this.config.thresholds.violations}</td>
                <td>${violationsCount <= this.config.thresholds.violations ? '✅' : '❌'}</td>
            </tr>
            <tr>
                <td>Failed Tests</td>
                <td>${this.results.failedTests}</td>
                <td>0</td>
                <td>${this.results.failedTests === 0 ? '✅' : '❌'}</td>
            </tr>
        </tbody>
    </table>
</body>
</html>`;
  }

  generateMarkdownReport() {
    const violationsCount = this.results.violations.length;
    const statusEmoji = violationsCount === 0 ? '✅' : '❌';
    const statusText = violationsCount === 0 ? 'PASSED' : 'FAILED';

    return `# Accessibility Audit Report ${statusEmoji}

**Generated:** ${this.results.timestamp}
**Standard:** WCAG 2.1 AA
**Status:** ${statusText}

## Summary

| Metric | Value |
|--------|-------|
| Total Tests | ${this.results.totalTests} |
| Passed Tests | ${this.results.passedTests} |
| Failed Tests | ${this.results.failedTests} |
| Violations | ${violationsCount} |

## Test Results

${violationsCount === 0 ? '🎉 **All accessibility tests passed!**' : ''}

${violationsCount > 0 ? `
## Violations Found

${this.results.violations.map((violation, index) => `
### ${index + 1}. ${violation.description}

- **Severity:** ${violation.severity}
- **File:** ${violation.file || 'Unknown'}
`).join('')}
` : ''}

## Thresholds

| Metric | Current | Threshold | Status |
|--------|---------|-----------|--------|
| Total Violations | ${violationsCount} | ${this.config.thresholds.violations} | ${violationsCount <= this.config.thresholds.violations ? '✅' : '❌'} |
| Failed Tests | ${this.results.failedTests} | 0 | ${this.results.failedTests === 0 ? '✅' : '❌'} |

---
*Report generated by mainframe-ai-assistant accessibility audit tool*`;
  }

  validateThresholds() {
    const violationsCount = this.results.violations.length;

    const checks = {
      violations: violationsCount <= this.config.thresholds.violations,
      criticalViolations: this.results.violations.filter(v => v.severity === 'critical').length <= this.config.thresholds.criticalViolations,
      failedTests: this.results.failedTests === 0,
    };

    return Object.values(checks).every(check => check);
  }

  printSummary() {
    console.log('\n📋 Accessibility Audit Summary');
    console.log('=====================================');
    console.log(`Total Tests:     ${this.results.totalTests}`);
    console.log(`Passed Tests:    ${this.results.passedTests}`);
    console.log(`Failed Tests:    ${this.results.failedTests}`);
    console.log(`Violations:      ${this.results.violations.length}`);
    console.log(`Status:          ${this.results.violations.length === 0 ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Reports:         ${this.config.outputDir}/`);
    console.log('=====================================\n');

    if (this.results.violations.length > 0) {
      console.log('❌ Accessibility violations found. Please review the generated reports.');
    } else {
      console.log('✅ All accessibility tests passed!');
    }
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const config = {};

  // Parse command line arguments
  for (let i = 0; i < args.length; i += 2) {
    const arg = args[i];
    const value = args[i + 1];

    switch (arg) {
      case '--output':
        config.outputDir = value;
        break;
      case '--timeout':
        config.timeoutMs = parseInt(value) * 1000;
        break;
      case '--format':
        config.reportFormats = value.split(',');
        break;
      case '--threshold-violations':
        config.thresholds = { ...config.thresholds, violations: parseInt(value) };
        break;
      default:
        if (arg.startsWith('--')) {
          console.warn(`Unknown argument: ${arg}`);
        }
    }
  }

  const auditor = new AccessibilityAuditor(config);
  auditor.run().catch(error => {
    console.error('Audit failed:', error);
    process.exit(1);
  });
}

module.exports = AccessibilityAuditor;