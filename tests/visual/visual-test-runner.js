const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

/**
 * Comprehensive Visual Quality Test Runner
 * Coordinates all visual quality and accessibility testing
 */

class VisualTestRunner {
  constructor() {
    this.testSuites = {
      visual: {
        name: 'Visual Regression Tests',
        config: './tests/visual/visual-regression.config.js',
        tests: ['./tests/visual/component-visual.test.js']
      },
      accessibility: {
        name: 'Accessibility Compliance Tests',
        config: './tests/accessibility/accessibility.config.js',
        tests: [
          './tests/accessibility/accessibility-compliance.test.js',
          './tests/accessibility/color-contrast.test.js',
          './tests/accessibility/screen-reader.test.js'
        ]
      },
      performance: {
        name: 'Visual Performance Tests',
        config: './tests/performance/performance.config.js',
        tests: ['./tests/performance/visual-performance.test.js']
      },
      integration: {
        name: 'Design System Integration Tests',
        config: './tests/integration/integration.config.js',
        tests: ['./tests/integration/design-system-integration.test.js']
      },
      e2e: {
        name: 'End-to-End Accessibility Tests',
        config: './tests/e2e/e2e.config.js',
        tests: ['./tests/e2e/keyboard-navigation.test.js']
      }
    };
    
    this.results = {
      passed: 0,
      failed: 0,
      skipped: 0,
      total: 0,
      suiteResults: {},
      startTime: null,
      endTime: null
    };
  }

  async runAllTests() {
    console.log('🚀 Starting Comprehensive Visual Quality Test Suite\n');
    this.results.startTime = Date.now();
    
    for (const [suiteKey, suite] of Object.entries(this.testSuites)) {
      console.log(`\n📋 Running ${suite.name}...`);
      console.log(`${'='.repeat(50)}`);
      
      try {
        const result = await this.runTestSuite(suiteKey, suite);
        this.results.suiteResults[suiteKey] = result;
        
        this.results.passed += result.passed;
        this.results.failed += result.failed;
        this.results.skipped += result.skipped;
        this.results.total += result.total;
        
        console.log(`✅ ${suite.name} completed: ${result.passed}/${result.total} passed`);
      } catch (error) {
        console.error(`❌ ${suite.name} failed:`, error.message);
        this.results.suiteResults[suiteKey] = {
          passed: 0,
          failed: 1,
          skipped: 0,
          total: 1,
          error: error.message
        };
        this.results.failed += 1;
        this.results.total += 1;
      }
    }
    
    this.results.endTime = Date.now();
    await this.generateReport();
    
    return this.results;
  }

  async runTestSuite(suiteKey, suite) {
    const command = this.buildPlaywrightCommand(suite);
    
    return new Promise((resolve, reject) => {
      const process = exec(command, { cwd: process.cwd() });
      
      let stdout = '';
      let stderr = '';
      
      process.stdout?.on('data', (data) => {
        stdout += data;
        console.log(data.toString().trim());
      });
      
      process.stderr?.on('data', (data) => {
        stderr += data;
        console.error(data.toString().trim());
      });
      
      process.on('close', (code) => {
        const result = this.parseTestResults(stdout, stderr, code);
        
        if (code === 0) {
          resolve(result);
        } else {
          // Even if tests fail, we want to capture the results
          resolve(result);
        }
      });
      
      process.on('error', (error) => {
        reject(new Error(`Failed to run ${suite.name}: ${error.message}`));
      });
    });
  }

  buildPlaywrightCommand(suite) {
    const baseCommand = 'npx playwright test';
    const configFlag = suite.config ? `--config=${suite.config}` : '';
    const testFiles = suite.tests.join(' ');
    const outputFlag = '--reporter=json';
    
    return `${baseCommand} ${configFlag} ${outputFlag} ${testFiles}`.trim();
  }

  parseTestResults(stdout, stderr, exitCode) {
    // Default result structure
    let result = {
      passed: 0,
      failed: 0,
      skipped: 0,
      total: 0,
      duration: 0,
      details: []
    };
    
    try {
      // Try to parse Playwright JSON output
      const jsonMatch = stdout.match(/\{.*"stats".*\}/s);
      if (jsonMatch) {
        const report = JSON.parse(jsonMatch[0]);
        
        if (report.stats) {
          result.passed = report.stats.passed || 0;
          result.failed = report.stats.failed || 0;
          result.skipped = report.stats.skipped || 0;
          result.total = result.passed + result.failed + result.skipped;
          result.duration = report.stats.duration || 0;
        }
        
        if (report.suites) {
          result.details = this.extractTestDetails(report.suites);
        }
      } else {
        // Fallback: parse text output
        result = this.parseTextOutput(stdout, stderr, exitCode);
      }
    } catch (error) {
      console.warn('Failed to parse test results JSON, using fallback parsing');
      result = this.parseTextOutput(stdout, stderr, exitCode);
    }
    
    return result;
  }

  parseTextOutput(stdout, stderr, exitCode) {
    const result = {
      passed: 0,
      failed: 0,
      skipped: 0,
      total: 0,
      duration: 0,
      details: []
    };
    
    // Extract test counts from text output
    const passedMatch = stdout.match(/(\d+) passed/i);
    const failedMatch = stdout.match(/(\d+) failed/i);
    const skippedMatch = stdout.match(/(\d+) skipped/i);
    
    if (passedMatch) result.passed = parseInt(passedMatch[1]);
    if (failedMatch) result.failed = parseInt(failedMatch[1]);
    if (skippedMatch) result.skipped = parseInt(skippedMatch[1]);
    
    result.total = result.passed + result.failed + result.skipped;
    
    // If no explicit counts found, infer from exit code
    if (result.total === 0) {
      if (exitCode === 0) {
        result.passed = 1;
        result.total = 1;
      } else {
        result.failed = 1;
        result.total = 1;
      }
    }
    
    return result;
  }

  extractTestDetails(suites) {
    const details = [];
    
    for (const suite of suites) {
      for (const spec of suite.specs || []) {
        for (const test of spec.tests || []) {
          details.push({
            title: test.title,
            status: test.outcome,
            duration: test.results?.[0]?.duration || 0,
            error: test.results?.[0]?.error?.message
          });
        }
      }
    }
    
    return details;
  }

  async generateReport() {
    const duration = this.results.endTime - this.results.startTime;
    const passRate = this.results.total > 0 ? (this.results.passed / this.results.total * 100).toFixed(2) : 0;
    
    const report = {
      summary: {
        timestamp: new Date().toISOString(),
        duration: `${(duration / 1000).toFixed(2)}s`,
        total: this.results.total,
        passed: this.results.passed,
        failed: this.results.failed,
        skipped: this.results.skipped,
        passRate: `${passRate}%`,
        status: this.results.failed === 0 ? 'PASSED' : 'FAILED'
      },
      suites: this.results.suiteResults
    };
    
    // Generate detailed report
    await this.writeReport(report);
    
    // Display summary
    this.displaySummary(report);
    
    return report;
  }

  async writeReport(report) {
    const reportDir = './test-results';
    const reportPath = path.join(reportDir, 'visual-quality-report.json');
    const htmlReportPath = path.join(reportDir, 'visual-quality-report.html');
    
    try {
      await fs.mkdir(reportDir, { recursive: true });
      
      // Write JSON report
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
      
      // Generate HTML report
      const htmlReport = this.generateHTMLReport(report);
      await fs.writeFile(htmlReportPath, htmlReport);
      
      console.log(`\n📊 Reports generated:`);
      console.log(`   JSON: ${reportPath}`);
      console.log(`   HTML: ${htmlReportPath}`);
    } catch (error) {
      console.error('Failed to write report:', error.message);
    }
  }

  generateHTMLReport(report) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Visual Quality Test Report</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      margin: 0;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      border-radius: 8px;
      padding: 30px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 2px solid #eee;
    }
    .status {
      display: inline-block;
      padding: 8px 16px;
      border-radius: 20px;
      font-weight: bold;
      text-transform: uppercase;
      font-size: 14px;
    }
    .status.passed { background: #d4edda; color: #155724; }
    .status.failed { background: #f8d7da; color: #721c24; }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .summary-card {
      background: #f8f9fa;
      padding: 20px;
      border-radius: 8px;
      text-align: center;
      border-left: 4px solid #007bff;
    }
    .summary-card.passed { border-left-color: #28a745; }
    .summary-card.failed { border-left-color: #dc3545; }
    .summary-card.skipped { border-left-color: #ffc107; }
    .summary-number {
      font-size: 2em;
      font-weight: bold;
      color: #333;
    }
    .summary-label {
      color: #666;
      margin-top: 5px;
    }
    .suite-section {
      margin-bottom: 30px;
    }
    .suite-header {
      background: #e9ecef;
      padding: 15px;
      border-radius: 6px;
      margin-bottom: 15px;
    }
    .suite-title {
      margin: 0;
      font-size: 1.2em;
      color: #333;
    }
    .suite-stats {
      display: flex;
      gap: 15px;
      margin-top: 10px;
      font-size: 14px;
    }
    .stat {
      display: flex;
      align-items: center;
      gap: 5px;
    }
    .stat-icon {
      width: 12px;
      height: 12px;
      border-radius: 50%;
    }
    .stat-icon.passed { background: #28a745; }
    .stat-icon.failed { background: #dc3545; }
    .stat-icon.skipped { background: #ffc107; }
    .error-message {
      background: #f8d7da;
      color: #721c24;
      padding: 10px;
      border-radius: 4px;
      margin-top: 10px;
      font-family: monospace;
      font-size: 12px;
    }
    .timestamp {
      color: #666;
      font-size: 14px;
      text-align: center;
      margin-top: 30px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Visual Quality Test Report</h1>
      <div class="status ${report.summary.status.toLowerCase()}">
        ${report.summary.status}
      </div>
    </div>
    
    <div class="summary-grid">
      <div class="summary-card">
        <div class="summary-number">${report.summary.total}</div>
        <div class="summary-label">Total Tests</div>
      </div>
      <div class="summary-card passed">
        <div class="summary-number">${report.summary.passed}</div>
        <div class="summary-label">Passed</div>
      </div>
      <div class="summary-card failed">
        <div class="summary-number">${report.summary.failed}</div>
        <div class="summary-label">Failed</div>
      </div>
      <div class="summary-card skipped">
        <div class="summary-number">${report.summary.skipped}</div>
        <div class="summary-label">Skipped</div>
      </div>
      <div class="summary-card">
        <div class="summary-number">${report.summary.passRate}</div>
        <div class="summary-label">Pass Rate</div>
      </div>
      <div class="summary-card">
        <div class="summary-number">${report.summary.duration}</div>
        <div class="summary-label">Duration</div>
      </div>
    </div>
    
    <div class="suites">
      ${Object.entries(report.suites).map(([key, suite]) => `
        <div class="suite-section">
          <div class="suite-header">
            <h3 class="suite-title">${this.testSuites[key]?.name || key}</h3>
            <div class="suite-stats">
              <div class="stat">
                <div class="stat-icon passed"></div>
                <span>${suite.passed} passed</span>
              </div>
              <div class="stat">
                <div class="stat-icon failed"></div>
                <span>${suite.failed} failed</span>
              </div>
              <div class="stat">
                <div class="stat-icon skipped"></div>
                <span>${suite.skipped} skipped</span>
              </div>
            </div>
            ${suite.error ? `<div class="error-message">${suite.error}</div>` : ''}
          </div>
        </div>
      `).join('')}
    </div>
    
    <div class="timestamp">
      Generated on ${new Date(report.summary.timestamp).toLocaleString()}
    </div>
  </div>
</body>
</html>
    `.trim();
  }

  displaySummary(report) {
    const { summary } = report;
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 VISUAL QUALITY TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`Status: ${summary.status === 'PASSED' ? '✅' : '❌'} ${summary.status}`);
    console.log(`Duration: ⏱️  ${summary.duration}`);
    console.log(`Pass Rate: 📈 ${summary.passRate}`);
    console.log('');
    console.log(`Total Tests: ${summary.total}`);
    console.log(`✅ Passed: ${summary.passed}`);
    console.log(`❌ Failed: ${summary.failed}`);
    console.log(`⏭️  Skipped: ${summary.skipped}`);
    console.log('');
    
    // Suite breakdown
    console.log('📋 Suite Results:');
    for (const [key, suite] of Object.entries(report.suites)) {
      const suiteName = this.testSuites[key]?.name || key;
      const status = suite.failed === 0 ? '✅' : '❌';
      console.log(`   ${status} ${suiteName}: ${suite.passed}/${suite.total}`);
      
      if (suite.error) {
        console.log(`      Error: ${suite.error}`);
      }
    }
    
    console.log('='.repeat(60));
    
    if (summary.status === 'FAILED') {
      console.log('\n❌ Some visual quality tests failed. Check the detailed report for more information.');
      process.exit(1);
    } else {
      console.log('\n🎉 All visual quality tests passed!');
    }
  }

  // Individual test suite runners
  async runVisualRegressionTests() {
    return this.runTestSuite('visual', this.testSuites.visual);
  }

  async runAccessibilityTests() {
    return this.runTestSuite('accessibility', this.testSuites.accessibility);
  }

  async runPerformanceTests() {
    return this.runTestSuite('performance', this.testSuites.performance);
  }

  async runIntegrationTests() {
    return this.runTestSuite('integration', this.testSuites.integration);
  }

  async runE2ETests() {
    return this.runTestSuite('e2e', this.testSuites.e2e);
  }
}

// CLI interface
if (require.main === module) {
  const runner = new VisualTestRunner();
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Visual Quality Test Runner

Usage:
  node visual-test-runner.js [options] [suite]

Options:
  --help, -h     Show this help message
  --suite, -s    Run specific test suite

Suites:
  visual         Visual regression tests
  accessibility  Accessibility compliance tests
  performance    Visual performance tests
  integration    Design system integration tests
  e2e           End-to-end accessibility tests
  all           Run all test suites (default)

Examples:
  node visual-test-runner.js
  node visual-test-runner.js --suite accessibility
  node visual-test-runner.js -s visual
`);
    process.exit(0);
  }
  
  const suiteIndex = args.indexOf('--suite') !== -1 ? args.indexOf('--suite') : args.indexOf('-s');
  const suiteName = suiteIndex !== -1 ? args[suiteIndex + 1] : 'all';
  
  (async () => {
    try {
      let result;
      
      switch (suiteName) {
        case 'visual':
          result = await runner.runVisualRegressionTests();
          break;
        case 'accessibility':
          result = await runner.runAccessibilityTests();
          break;
        case 'performance':
          result = await runner.runPerformanceTests();
          break;
        case 'integration':
          result = await runner.runIntegrationTests();
          break;
        case 'e2e':
          result = await runner.runE2ETests();
          break;
        case 'all':
        default:
          result = await runner.runAllTests();
          break;
      }
      
      console.log('\n✨ Test execution completed!');
    } catch (error) {
      console.error('\n💥 Test execution failed:', error.message);
      process.exit(1);
    }
  })();
}

module.exports = VisualTestRunner;
