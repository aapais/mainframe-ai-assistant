#!/usr/bin/env node

/**
 * KB Routing Test Suite Runner
 * Orchestrates and executes all routing-related tests
 */

const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { testSuites, reportingConfig } = require('./routing-test-suite.config');

class RoutingTestRunner {
  constructor() {
    this.results = {};
    this.startTime = Date.now();
    this.verbose = process.argv.includes('--verbose');
    this.ci = process.env.CI || process.argv.includes('--ci');
    this.suite = process.argv.find(arg => arg.startsWith('--suite='))?.split('=')[1] || 'all';
    this.generateReport = process.argv.includes('--report') || this.ci;
  }

  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = {
      info: '📋',
      success: '✅',
      error: '❌',
      warning: '⚠️',
      performance: '⚡',
      accessibility: '♿',
    }[level] || 'ℹ️';

    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  async runCommand(command, description, timeout = 60000) {
    return new Promise((resolve, reject) => {
      this.log(`Starting: ${description}`);
      
      const child = spawn(command, [], {
        shell: true,
        stdio: this.verbose ? 'inherit' : 'pipe',
        timeout,
      });

      let stdout = '';
      let stderr = '';

      if (!this.verbose) {
        child.stdout?.on('data', (data) => {
          stdout += data.toString();
        });

        child.stderr?.on('data', (data) => {
          stderr += data.toString();
        });
      }

      child.on('close', (code) => {
        const duration = Date.now() - this.startTime;
        
        if (code === 0) {
          this.log(`Completed: ${description} (${duration}ms)`, 'success');
          resolve({ code, stdout, stderr, duration });
        } else {
          this.log(`Failed: ${description} (${duration}ms)`, 'error');
          if (!this.verbose && stderr) {
            console.error(stderr);
          }
          reject(new Error(`Command failed with code ${code}`));
        }
      });

      child.on('error', (error) => {
        this.log(`Error: ${description} - ${error.message}`, 'error');
        reject(error);
      });
    });
  }

  async ensureDirectories() {
    const dirs = [
      'coverage/routing',
      'reports/routing-test-suite',
      'reports/performance',
      'reports/accessibility',
    ];

    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        this.log(`Created directory: ${dir}`);
      }
    }
  }

  async runTestSuite(suiteName) {
    const suite = testSuites[suiteName];
    if (!suite) {
      throw new Error(`Unknown test suite: ${suiteName}`);
    }

    this.log(`Running ${suiteName} tests: ${suite.description}`);
    
    const startTime = Date.now();
    try {
      const result = await this.runCommand(
        suite.command,
        suite.description,
        suite.timeout
      );
      
      const endTime = Date.now();
      this.results[suiteName] = {
        success: true,
        duration: endTime - startTime,
        output: result.stdout,
      };
      
      return result;
    } catch (error) {
      const endTime = Date.now();
      this.results[suiteName] = {
        success: false,
        duration: endTime - startTime,
        error: error.message,
      };
      
      throw error;
    }
  }

  async runUnitTests() {
    this.log('🧪 Running Unit Tests', 'info');
    return this.runTestSuite('unit');
  }

  async runIntegrationTests() {
    this.log('🔗 Running Integration Tests', 'info');
    return this.runTestSuite('integration');
  }

  async runE2ETests() {
    this.log('🌐 Running E2E Tests', 'info');
    
    // Start development server if needed
    if (!this.ci) {
      this.log('Starting development server...');
      const serverProcess = spawn('npm', ['run', 'dev'], {
        detached: true,
        stdio: 'ignore',
      });
      
      // Wait for server to start
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      try {
        await this.runTestSuite('e2e');
      } finally {
        // Cleanup server
        process.kill(-serverProcess.pid);
      }
    } else {
      await this.runTestSuite('e2e');
    }
  }

  async runPerformanceTests() {
    this.log('⚡ Running Performance Tests', 'performance');
    return this.runTestSuite('performance');
  }

  async runAccessibilityTests() {
    this.log('♿ Running Accessibility Tests', 'accessibility');
    return this.runTestSuite('accessibility');
  }

  async generateCoverageReport() {
    this.log('📊 Generating Coverage Report');
    
    try {
      // Merge coverage reports
      await this.runCommand(
        'npx nyc merge coverage/routing coverage/merged-coverage.json',
        'Merging coverage reports'
      );
      
      // Generate HTML report
      await this.runCommand(
        'npx nyc report --reporter=html --report-dir=reports/routing-test-suite/coverage',
        'Generating HTML coverage report'
      );
      
      // Generate summary
      const result = await this.runCommand(
        'npx nyc report --reporter=json-summary',
        'Generating coverage summary',
        10000
      );
      
      return JSON.parse(result.stdout);
    } catch (error) {
      this.log(`Coverage report generation failed: ${error.message}`, 'warning');
      return null;
    }
  }

  async generatePerformanceReport() {
    this.log('📈 Generating Performance Report');
    
    const reportPath = 'reports/performance/routing-performance.html';
    const templatePath = path.join(__dirname, 'templates', 'performance-report.html');
    
    if (fs.existsSync(templatePath)) {
      let template = fs.readFileSync(templatePath, 'utf8');
      
      // Replace placeholders with actual data
      template = template.replace('{{RESULTS}}', JSON.stringify(this.results, null, 2));
      template = template.replace('{{TIMESTAMP}}', new Date().toISOString());
      
      fs.writeFileSync(reportPath, template);
      this.log(`Performance report generated: ${reportPath}`, 'success');
    }
  }

  async generateAccessibilityReport() {
    this.log('♿ Generating Accessibility Report');
    
    // Generate accessibility report if axe results exist
    const axeResultsPath = 'coverage/axe-results.json';
    
    if (fs.existsSync(axeResultsPath)) {
      const results = JSON.parse(fs.readFileSync(axeResultsPath, 'utf8'));
      
      const reportPath = 'reports/accessibility/routing-accessibility.html';
      const report = this.generateAccessibilityHTML(results);
      
      fs.writeFileSync(reportPath, report);
      this.log(`Accessibility report generated: ${reportPath}`, 'success');
    }
  }

  generateAccessibilityHTML(results) {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>KB Routing Accessibility Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .violation { background: #fff2f2; border-left: 4px solid #d73502; padding: 15px; margin: 10px 0; }
        .pass { background: #f0fff4; border-left: 4px solid #22863a; padding: 15px; margin: 10px 0; }
        .summary { background: #f6f8fa; padding: 20px; border-radius: 6px; margin-bottom: 30px; }
        .metric { display: inline-block; margin: 10px 20px 10px 0; }
        .metric-value { font-size: 24px; font-weight: bold; color: #0366d6; }
        .metric-label { font-size: 14px; color: #586069; }
    </style>
</head>
<body>
    <h1>KB Routing Accessibility Report</h1>
    
    <div class="summary">
        <h2>Summary</h2>
        <div class="metric">
            <div class="metric-value">${results.violations?.length || 0}</div>
            <div class="metric-label">Violations</div>
        </div>
        <div class="metric">
            <div class="metric-value">${results.passes?.length || 0}</div>
            <div class="metric-label">Passes</div>
        </div>
        <div class="metric">
            <div class="metric-value">${new Date().toLocaleString()}</div>
            <div class="metric-label">Generated</div>
        </div>
    </div>

    ${results.violations?.map(violation => `
        <div class="violation">
            <h3>${violation.id}: ${violation.description}</h3>
            <p><strong>Impact:</strong> ${violation.impact}</p>
            <p><strong>Help:</strong> ${violation.help}</p>
            <a href="${violation.helpUrl}" target="_blank">Learn more</a>
        </div>
    `).join('') || ''}

    <h2>Accessibility Passes (${results.passes?.length || 0})</h2>
    ${results.passes?.map(pass => `
        <div class="pass">
            <h3>${pass.id}: ${pass.description}</h3>
        </div>
    `).join('') || ''}
</body>
</html>
    `;
  }

  async generateConsolidatedReport() {
    this.log('📋 Generating Consolidated Report');
    
    const report = {
      timestamp: new Date().toISOString(),
      duration: Date.now() - this.startTime,
      environment: {
        node: process.version,
        platform: process.platform,
        ci: this.ci,
      },
      results: this.results,
      summary: {
        total: Object.keys(this.results).length,
        passed: Object.values(this.results).filter(r => r.success).length,
        failed: Object.values(this.results).filter(r => !r.success).length,
      },
    };

    const reportPath = 'reports/routing-test-suite/consolidated-report.json';
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    // Generate HTML report
    const htmlReportPath = 'reports/routing-test-suite/index.html';
    const htmlReport = this.generateConsolidatedHTML(report);
    fs.writeFileSync(htmlReportPath, htmlReport);
    
    this.log(`Consolidated report generated: ${htmlReportPath}`, 'success');
    return report;
  }

  generateConsolidatedHTML(report) {
    const successRate = (report.summary.passed / report.summary.total) * 100;
    
    return `
<!DOCTYPE html>
<html>
<head>
    <title>KB Routing Test Suite Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f6f8fa; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { background: white; padding: 30px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric-card { background: white; padding: 20px; border-radius: 8px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .metric-value { font-size: 2em; font-weight: bold; }
        .metric-label { color: #586069; margin-top: 5px; }
        .success { color: #28a745; }
        .failure { color: #d73a49; }
        .results { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .test-result { padding: 15px; margin: 10px 0; border-radius: 6px; border-left: 4px solid #e1e4e8; }
        .test-result.success { background: #f0fff4; border-left-color: #28a745; }
        .test-result.failure { background: #ffeef0; border-left-color: #d73a49; }
        .duration { color: #586069; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>KB Routing Test Suite Report</h1>
            <p>Generated on ${new Date(report.timestamp).toLocaleString()}</p>
            <p>Total Duration: ${Math.round(report.duration / 1000)}s</p>
        </div>

        <div class="metrics">
            <div class="metric-card">
                <div class="metric-value success">${report.summary.passed}</div>
                <div class="metric-label">Passed</div>
            </div>
            <div class="metric-card">
                <div class="metric-value failure">${report.summary.failed}</div>
                <div class="metric-label">Failed</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${successRate.toFixed(1)}%</div>
                <div class="metric-label">Success Rate</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${report.summary.total}</div>
                <div class="metric-label">Total Suites</div>
            </div>
        </div>

        <div class="results">
            <h2>Test Suite Results</h2>
            ${Object.entries(report.results).map(([suite, result]) => `
                <div class="test-result ${result.success ? 'success' : 'failure'}">
                    <h3>${suite.charAt(0).toUpperCase() + suite.slice(1)} Tests</h3>
                    <p>Status: ${result.success ? '✅ Passed' : '❌ Failed'}</p>
                    <p class="duration">Duration: ${Math.round(result.duration / 1000)}s</p>
                    ${result.error ? `<p class="error">Error: ${result.error}</p>` : ''}
                </div>
            `).join('')}
        </div>

        <div class="results">
            <h2>Environment</h2>
            <ul>
                <li>Node.js: ${report.environment.node}</li>
                <li>Platform: ${report.environment.platform}</li>
                <li>CI: ${report.environment.ci ? 'Yes' : 'No'}</li>
            </ul>
        </div>
    </div>
</body>
</html>
    `;
  }

  async run() {
    try {
      this.log(`🚀 Starting KB Routing Test Suite (${this.suite})`);
      
      await this.ensureDirectories();
      
      // Run selected test suites
      if (this.suite === 'all') {
        await this.runUnitTests();
        await this.runIntegrationTests();
        await this.runAccessibilityTests();
        
        if (!this.ci) {
          await this.runE2ETests();
        }
        
        await this.runPerformanceTests();
      } else {
        const suiteMethod = `run${this.suite.charAt(0).toUpperCase() + this.suite.slice(1)}Tests`;
        if (typeof this[suiteMethod] === 'function') {
          await this[suiteMethod]();
        } else {
          throw new Error(`Unknown test suite: ${this.suite}`);
        }
      }
      
      // Generate reports
      if (this.generateReport) {
        await this.generateCoverageReport();
        await this.generatePerformanceReport();
        await this.generateAccessibilityReport();
        await this.generateConsolidatedReport();
      }
      
      const duration = Date.now() - this.startTime;
      const passed = Object.values(this.results).filter(r => r.success).length;
      const total = Object.keys(this.results).length;
      
      if (passed === total) {
        this.log(`🎉 All tests passed! (${passed}/${total}) in ${Math.round(duration / 1000)}s`, 'success');
        process.exit(0);
      } else {
        this.log(`❌ Tests failed (${passed}/${total}) in ${Math.round(duration / 1000)}s`, 'error');
        process.exit(1);
      }
      
    } catch (error) {
      this.log(`Fatal error: ${error.message}`, 'error');
      console.error(error);
      process.exit(1);
    }
  }
}

// Command line help
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
KB Routing Test Suite Runner

Usage: node run-routing-tests.js [options]

Options:
  --suite=<name>    Run specific test suite (unit, integration, e2e, performance, accessibility, all)
  --verbose         Show detailed output
  --ci              Run in CI mode
  --report          Generate reports
  --help, -h        Show this help message

Examples:
  node run-routing-tests.js --suite=unit --verbose
  node run-routing-tests.js --suite=all --report
  node run-routing-tests.js --ci
  `);
  process.exit(0);
}

// Run the test suite
const runner = new RoutingTestRunner();
runner.run();