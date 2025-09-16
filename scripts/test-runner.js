#!/usr/bin/env node

/**
 * Comprehensive Test Runner Script
 * Orchestrates different types of testing for the component library
 */

const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const chalk = require('chalk');

class TestRunner {
  constructor() {
    this.results = {
      unit: null,
      integration: null,
      accessibility: null,
      performance: null,
      visual: null,
      browser: null
    };
    
    this.config = {
      coverage: {
        threshold: 80,
        reports: ['text', 'html', 'lcov']
      },
      performance: {
        renderThreshold: 100, // ms
        interactionThreshold: 50 // ms
      },
      accessibility: {
        level: 'AA', // WCAG level
        tags: ['wcag2a', 'wcag2aa']
      }
    };
  }

  async run(options = {}) {
    console.log(chalk.blue.bold('🧪 Starting Comprehensive Test Suite\n'));
    
    const startTime = Date.now();
    
    try {
      // Run tests based on options
      if (options.all || options.unit) {
        await this.runUnitTests(options);
      }
      
      if (options.all || options.accessibility) {
        await this.runAccessibilityTests(options);
      }
      
      if (options.all || options.performance) {
        await this.runPerformanceTests(options);
      }
      
      if (options.all || options.visual) {
        await this.runVisualTests(options);
      }
      
      if (options.all || options.browser) {
        await this.runBrowserTests(options);
      }
      
      if (options.all || options.integration) {
        await this.runIntegrationTests(options);
      }
      
      const endTime = Date.now();
      const duration = ((endTime - startTime) / 1000).toFixed(2);
      
      await this.generateReport(options);
      
      console.log(chalk.green.bold(`\n✅ Test Suite Completed in ${duration}s\n`));
      
      return this.results;
      
    } catch (error) {
      console.error(chalk.red.bold('\n❌ Test Suite Failed\n'));
      console.error(error);
      process.exit(1);
    }
  }

  async runUnitTests(options) {
    console.log(chalk.yellow('📋 Running Unit Tests...'));
    
    const jestConfig = {
      coverage: options.coverage || false,
      watch: options.watch || false,
      verbose: options.verbose || false
    };
    
    const args = [
      '--passWithNoTests',
      '--testMatch="**/__tests__/**/*.test.{ts,tsx}"',
      '--testPathIgnorePatterns=".*/(Performance|Visual|Browser).test.(ts|tsx)"'
    ];
    
    if (jestConfig.coverage) {
      args.push('--coverage');
      args.push('--coverageReporters=text,html,lcov');
    }
    
    if (jestConfig.verbose) {
      args.push('--verbose');
    }
    
    if (jestConfig.watch) {
      args.push('--watch');
    }
    
    try {
      const result = await this.executeCommand('npx', ['jest', ...args]);
      this.results.unit = {
        passed: result.code === 0,
        coverage: jestConfig.coverage ? await this.parseCoverageReport() : null,
        duration: result.duration
      };
      
      if (result.code === 0) {
        console.log(chalk.green('✅ Unit tests passed\n'));
      } else {
        console.log(chalk.red('❌ Unit tests failed\n'));
      }
    } catch (error) {
      console.error(chalk.red('❌ Unit tests error:', error.message));
      this.results.unit = { passed: false, error: error.message };
    }
  }

  async runAccessibilityTests(options) {
    console.log(chalk.yellow('♿ Running Accessibility Tests...'));
    
    const args = [
      '--testNamePattern=Accessibility',
      '--verbose'
    ];
    
    try {
      const result = await this.executeCommand('npx', ['jest', ...args]);
      
      this.results.accessibility = {
        passed: result.code === 0,
        wcagLevel: this.config.accessibility.level,
        violations: await this.parseAccessibilityViolations(),
        duration: result.duration
      };
      
      if (result.code === 0) {
        console.log(chalk.green('✅ Accessibility tests passed\n'));
      } else {
        console.log(chalk.red('❌ Accessibility tests failed\n'));
      }
    } catch (error) {
      console.error(chalk.red('❌ Accessibility tests error:', error.message));
      this.results.accessibility = { passed: false, error: error.message };
    }
  }

  async runPerformanceTests(options) {
    console.log(chalk.yellow('⚡ Running Performance Tests...'));
    
    const args = [
      '--testNamePattern=Performance',
      '--verbose',
      '--runInBand' // Run serially for accurate performance measurements
    ];
    
    try {
      const result = await this.executeCommand('npx', ['jest', ...args]);
      
      this.results.performance = {
        passed: result.code === 0,
        thresholds: this.config.performance,
        benchmarks: await this.parsePerformanceBenchmarks(),
        duration: result.duration
      };
      
      if (result.code === 0) {
        console.log(chalk.green('✅ Performance tests passed\n'));
      } else {
        console.log(chalk.red('❌ Performance tests failed\n'));
      }
    } catch (error) {
      console.error(chalk.red('❌ Performance tests error:', error.message));
      this.results.performance = { passed: false, error: error.message };
    }
  }

  async runVisualTests(options) {
    console.log(chalk.yellow('👁️ Running Visual Regression Tests...'));
    
    const args = [
      '--testNamePattern=VisualRegression',
      '--updateSnapshot=' + (options.updateSnapshots || false)
    ];
    
    try {
      const result = await this.executeCommand('npx', ['jest', ...args]);
      
      this.results.visual = {
        passed: result.code === 0,
        snapshots: await this.parseSnapshotResults(),
        duration: result.duration
      };
      
      if (result.code === 0) {
        console.log(chalk.green('✅ Visual regression tests passed\n'));
      } else {
        console.log(chalk.red('❌ Visual regression tests failed\n'));
      }
    } catch (error) {
      console.error(chalk.red('❌ Visual regression tests error:', error.message));
      this.results.visual = { passed: false, error: error.message };
    }
  }

  async runBrowserTests(options) {
    console.log(chalk.yellow('🌐 Running Cross-Browser Tests...'));
    
    const browsers = options.browsers || ['chrome', 'firefox', 'edge'];
    const browserResults = {};
    
    for (const browser of browsers) {
      console.log(chalk.blue(`  Testing in ${browser}...`));
      
      try {
        // This would integrate with Puppeteer or Playwright
        const result = await this.runBrowserSpecificTests(browser, options);
        browserResults[browser] = result;
      } catch (error) {
        console.error(chalk.red(`  ❌ ${browser} tests failed:`, error.message));
        browserResults[browser] = { passed: false, error: error.message };
      }
    }
    
    this.results.browser = {
      passed: Object.values(browserResults).every(r => r.passed),
      browsers: browserResults
    };
    
    if (this.results.browser.passed) {
      console.log(chalk.green('✅ Cross-browser tests passed\n'));
    } else {
      console.log(chalk.red('❌ Some browser tests failed\n'));
    }
  }

  async runBrowserSpecificTests(browser, options) {
    // Placeholder for browser-specific testing
    // In a real implementation, this would use Puppeteer/Playwright
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          passed: Math.random() > 0.1, // 90% success rate for demo
          testCount: 25,
          passedCount: 23,
          duration: Math.floor(Math.random() * 5000) + 2000
        });
      }, 1000);
    });
  }

  async runIntegrationTests(options) {
    console.log(chalk.yellow('🔗 Running Integration Tests...'));
    
    const args = [
      '--testMatch="**/integration/**/*.test.{ts,tsx}"',
      '--runInBand'
    ];
    
    try {
      const result = await this.executeCommand('npx', ['jest', ...args]);
      
      this.results.integration = {
        passed: result.code === 0,
        duration: result.duration
      };
      
      if (result.code === 0) {
        console.log(chalk.green('✅ Integration tests passed\n'));
      } else {
        console.log(chalk.red('❌ Integration tests failed\n'));
      }
    } catch (error) {
      console.error(chalk.red('❌ Integration tests error:', error.message));
      this.results.integration = { passed: false, error: error.message };
    }
  }

  async executeCommand(command, args) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const process = spawn(command, args, { 
        stdio: 'inherit',
        shell: true 
      });
      
      process.on('close', (code) => {
        const duration = Date.now() - startTime;
        resolve({ code, duration });
      });
      
      process.on('error', (error) => {
        reject(error);
      });
    });
  }

  async parseCoverageReport() {
    try {
      const coveragePath = path.join(process.cwd(), 'coverage', 'coverage-summary.json');
      const coverageData = JSON.parse(await fs.readFile(coveragePath, 'utf8'));
      
      return {
        lines: coverageData.total.lines.pct,
        functions: coverageData.total.functions.pct,
        branches: coverageData.total.branches.pct,
        statements: coverageData.total.statements.pct
      };
    } catch (error) {
      return null;
    }
  }

  async parseAccessibilityViolations() {
    // Placeholder - would parse axe-core results
    return {
      critical: 0,
      serious: 1,
      moderate: 3,
      minor: 5
    };
  }

  async parsePerformanceBenchmarks() {
    // Placeholder - would parse performance test results
    return {
      averageRenderTime: 85, // ms
      averageInteractionTime: 42, // ms
      memoryUsage: 15.2 // MB
    };
  }

  async parseSnapshotResults() {
    // Placeholder - would parse Jest snapshot results
    return {
      total: 45,
      passed: 43,
      failed: 2,
      updated: 0
    };
  }

  async generateReport(options) {
    console.log(chalk.blue('📊 Generating Comprehensive Test Report...\n'));
    
    const report = {
      timestamp: new Date().toISOString(),
      summary: this.generateSummary(),
      details: this.results,
      recommendations: this.generateRecommendations()
    };
    
    // Write JSON report
    const reportPath = path.join(process.cwd(), 'test-reports');
    await fs.mkdir(reportPath, { recursive: true });
    
    await fs.writeFile(
      path.join(reportPath, 'comprehensive-report.json'),
      JSON.stringify(report, null, 2)
    );
    
    // Write HTML report
    await this.generateHTMLReport(report, reportPath);
    
    // Console summary
    this.printSummary();
  }

  generateSummary() {
    const total = Object.keys(this.results).length;
    const passed = Object.values(this.results).filter(r => r && r.passed).length;
    
    return {
      total,
      passed,
      failed: total - passed,
      successRate: Math.round((passed / total) * 100)
    };
  }

  generateRecommendations() {
    const recommendations = [];
    
    if (this.results.unit && this.results.unit.coverage) {
      const coverage = this.results.unit.coverage;
      if (coverage.lines < this.config.coverage.threshold) {
        recommendations.push(`Increase line coverage from ${coverage.lines}% to ${this.config.coverage.threshold}%`);
      }
    }
    
    if (this.results.accessibility && !this.results.accessibility.passed) {
      recommendations.push('Fix accessibility violations to improve WCAG compliance');
    }
    
    if (this.results.performance && this.results.performance.benchmarks) {
      const perf = this.results.performance.benchmarks;
      if (perf.averageRenderTime > this.config.performance.renderThreshold) {
        recommendations.push(`Optimize render performance (current: ${perf.averageRenderTime}ms, target: <${this.config.performance.renderThreshold}ms)`);
      }
    }
    
    return recommendations;
  }

  async generateHTMLReport(report, reportPath) {
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Test Report - ${new Date().toLocaleDateString()}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .summary { background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .passed { color: #28a745; }
        .failed { color: #dc3545; }
        .test-section { margin-bottom: 30px; }
        .test-section h2 { border-bottom: 2px solid #ccc; padding-bottom: 10px; }
        .recommendations { background: #fff3cd; padding: 15px; border-radius: 5px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f8f9fa; }
      </style>
    </head>
    <body>
      <h1>Comprehensive Test Report</h1>
      <div class="summary">
        <h2>Summary</h2>
        <p>Generated: ${report.timestamp}</p>
        <p>Success Rate: <strong>${report.summary.successRate}%</strong></p>
        <p>Total Tests: ${report.summary.total} | 
           Passed: <span class="passed">${report.summary.passed}</span> | 
           Failed: <span class="failed">${report.summary.failed}</span></p>
      </div>
      
      <div class="test-section">
        <h2>Test Results</h2>
        <table>
          <tr><th>Test Suite</th><th>Status</th><th>Details</th></tr>
          ${Object.entries(report.details).map(([key, result]) => `
            <tr>
              <td>${key}</td>
              <td class="${result && result.passed ? 'passed' : 'failed'}">
                ${result && result.passed ? '✅ Passed' : '❌ Failed'}
              </td>
              <td>${result ? JSON.stringify(result, null, 2) : 'Not run'}</td>
            </tr>
          `).join('')}
        </table>
      </div>
      
      ${report.recommendations.length > 0 ? `
      <div class="recommendations">
        <h2>Recommendations</h2>
        <ul>
          ${report.recommendations.map(rec => `<li>${rec}</li>`).join('')}
        </ul>
      </div>
      ` : ''}
    </body>
    </html>
    `;
    
    await fs.writeFile(path.join(reportPath, 'report.html'), html);
  }

  printSummary() {
    const summary = this.generateSummary();
    
    console.log(chalk.blue.bold('📊 Test Summary:'));
    console.log(chalk.blue(`   Success Rate: ${summary.successRate}%`));
    console.log(chalk.green(`   Passed: ${summary.passed}`));
    console.log(chalk.red(`   Failed: ${summary.failed}`));
    console.log(chalk.blue(`   Total: ${summary.total}\n`));
    
    // Individual test results
    Object.entries(this.results).forEach(([testType, result]) => {
      const status = result && result.passed ? 
        chalk.green('✅') : chalk.red('❌');
      console.log(`   ${status} ${testType}`);
    });
    
    console.log(chalk.blue('\n📁 Reports generated in test-reports/'));
  }
}

// CLI Interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {
    all: args.includes('--all') || args.length === 0,
    unit: args.includes('--unit'),
    accessibility: args.includes('--accessibility'),
    performance: args.includes('--performance'),
    visual: args.includes('--visual'),
    browser: args.includes('--browser'),
    integration: args.includes('--integration'),
    coverage: args.includes('--coverage'),
    watch: args.includes('--watch'),
    verbose: args.includes('--verbose'),
    updateSnapshots: args.includes('--updateSnapshots')
  };
  
  const runner = new TestRunner();
  runner.run(options).catch(error => {
    console.error('Test runner failed:', error);
    process.exit(1);
  });
}

module.exports = TestRunner;