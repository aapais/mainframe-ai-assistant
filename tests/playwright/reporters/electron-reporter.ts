import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult,
} from '@playwright/test/reporter';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Custom Playwright Reporter for Electron Testing
 * Provides specialized reporting for Electron application testing
 */
export default class ElectronReporter implements Reporter {
  private startTime!: number;
  private config!: FullConfig;
  private results: TestReportEntry[] = [];
  private electronMetrics: ElectronMetrics = {
    startupTimes: [],
    memoryUsage: [],
    windowCounts: [],
    errors: []
  };

  onBegin(config: FullConfig, suite: Suite) {
    this.startTime = Date.now();
    this.config = config;
    console.log(`🚀 Starting Electron test suite with ${suite.allTests().length} tests`);
  }

  onTestBegin(test: TestCase) {
    console.log(`▶️  Starting test: ${test.title}`);
  }

  onTestEnd(test: TestCase, result: TestResult) {
    const duration = result.duration;
    const status = result.status;

    console.log(
      `${this.getStatusIcon(status)} ${test.title} (${duration}ms)`
    );

    // Collect test metrics
    this.results.push({
      title: test.title,
      status,
      duration,
      errors: result.errors,
      startTime: result.startTime,
      attachments: result.attachments.map(att => ({
        name: att.name,
        path: att.path,
        contentType: att.contentType
      }))
    });

    // Extract Electron-specific metrics from attachments
    this.extractElectronMetrics(result);

    if (result.status === 'failed' && result.errors.length > 0) {
      result.errors.forEach(error => {
        console.error(`❌ Error: ${error.message}`);
        if (error.stack) {
          console.error(error.stack);
        }
      });
    }
  }

  onEnd(result: FullResult) {
    const duration = Date.now() - this.startTime;
    const stats = this.calculateStats();

    console.log('\n' + '='.repeat(80));
    console.log('📊 ELECTRON TEST RESULTS');
    console.log('='.repeat(80));

    console.log(`⏱️  Total Duration: ${duration}ms`);
    console.log(`✅ Passed: ${stats.passed}`);
    console.log(`❌ Failed: ${stats.failed}`);
    console.log(`⏭️  Skipped: ${stats.skipped}`);
    console.log(`🔄 Flaky: ${stats.flaky}`);

    if (this.electronMetrics.startupTimes.length > 0) {
      const avgStartup = this.electronMetrics.startupTimes.reduce((a, b) => a + b, 0) / this.electronMetrics.startupTimes.length;
      console.log(`🚀 Average App Startup: ${avgStartup.toFixed(2)}ms`);
    }

    if (this.electronMetrics.memoryUsage.length > 0) {
      const maxMemory = Math.max(...this.electronMetrics.memoryUsage);
      console.log(`💾 Peak Memory Usage: ${(maxMemory / 1024 / 1024).toFixed(2)}MB`);
    }

    // Generate detailed report
    this.generateDetailedReport(duration, stats);

    console.log('\n📄 Detailed report generated at: test-reports/electron-report.json');
    console.log('🎭 HTML report available at: test-reports/playwright-html/index.html');
  }

  private getStatusIcon(status: string): string {
    switch (status) {
      case 'passed': return '✅';
      case 'failed': return '❌';
      case 'skipped': return '⏭️';
      case 'timedOut': return '⏰';
      default: return '❓';
    }
  }

  private calculateStats() {
    const stats = {
      passed: 0,
      failed: 0,
      skipped: 0,
      flaky: 0,
      timedOut: 0
    };

    this.results.forEach(result => {
      switch (result.status) {
        case 'passed':
          stats.passed++;
          break;
        case 'failed':
          stats.failed++;
          break;
        case 'skipped':
          stats.skipped++;
          break;
        case 'timedOut':
          stats.timedOut++;
          break;
      }
    });

    return stats;
  }

  private extractElectronMetrics(result: TestResult) {
    // Look for electron-specific attachments or logs
    result.attachments.forEach(attachment => {
      if (attachment.name === 'startup-time' && attachment.body) {
        const time = parseInt(attachment.body.toString());
        this.electronMetrics.startupTimes.push(time);
      }

      if (attachment.name === 'memory-usage' && attachment.body) {
        const memory = parseInt(attachment.body.toString());
        this.electronMetrics.memoryUsage.push(memory);
      }

      if (attachment.name === 'window-count' && attachment.body) {
        const count = parseInt(attachment.body.toString());
        this.electronMetrics.windowCounts.push(count);
      }
    });

    // Extract errors
    if (result.errors.length > 0) {
      this.electronMetrics.errors.push(...result.errors.map(err => ({
        test: result.test?.title || 'Unknown',
        message: err.message,
        stack: err.stack || ''
      })));
    }
  }

  private async generateDetailedReport(duration: number, stats: any) {
    const report: DetailedElectronReport = {
      summary: {
        startTime: new Date(this.startTime).toISOString(),
        endTime: new Date().toISOString(),
        duration,
        totalTests: this.results.length,
        ...stats
      },
      electronMetrics: {
        ...this.electronMetrics,
        averageStartupTime: this.electronMetrics.startupTimes.length > 0
          ? this.electronMetrics.startupTimes.reduce((a, b) => a + b, 0) / this.electronMetrics.startupTimes.length
          : 0,
        peakMemoryUsage: this.electronMetrics.memoryUsage.length > 0
          ? Math.max(...this.electronMetrics.memoryUsage)
          : 0,
        averageWindowCount: this.electronMetrics.windowCounts.length > 0
          ? this.electronMetrics.windowCounts.reduce((a, b) => a + b, 0) / this.electronMetrics.windowCounts.length
          : 0
      },
      testResults: this.results,
      environment: {
        node: process.version,
        platform: process.platform,
        arch: process.arch,
        ci: !!process.env.CI,
        workers: this.config.workers
      },
      performance: {
        slowestTests: this.results
          .sort((a, b) => b.duration - a.duration)
          .slice(0, 10)
          .map(t => ({ title: t.title, duration: t.duration })),
        fastestTests: this.results
          .sort((a, b) => a.duration - b.duration)
          .slice(0, 10)
          .map(t => ({ title: t.title, duration: t.duration })),
        averageTestDuration: this.results.length > 0
          ? this.results.reduce((sum, test) => sum + test.duration, 0) / this.results.length
          : 0
      }
    };

    const outputPath = path.join('test-reports', 'electron-report.json');
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, JSON.stringify(report, null, 2));

    // Also generate a simplified HTML report
    await this.generateHtmlReport(report);
  }

  private async generateHtmlReport(report: DetailedElectronReport) {
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Electron Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .stat-card { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; }
        .stat-value { font-size: 2em; font-weight: bold; color: #333; }
        .stat-label { color: #666; margin-top: 5px; }
        .metrics { margin-bottom: 30px; }
        .metrics h3 { border-bottom: 2px solid #007bff; padding-bottom: 10px; }
        .test-list { margin-top: 20px; }
        .test-item { padding: 10px; margin: 5px 0; border-radius: 4px; }
        .test-passed { background: #d4edda; border-left: 4px solid #28a745; }
        .test-failed { background: #f8d7da; border-left: 4px solid #dc3545; }
        .test-skipped { background: #fff3cd; border-left: 4px solid #ffc107; }
        .error-details { background: #f8f9fa; padding: 10px; margin: 10px 0; border-radius: 4px; font-family: monospace; white-space: pre-wrap; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔬 Electron Test Report</h1>
            <p>Generated on ${new Date().toLocaleString()}</p>
        </div>

        <div class="stats">
            <div class="stat-card">
                <div class="stat-value">${report.summary.totalTests}</div>
                <div class="stat-label">Total Tests</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${report.summary.passed}</div>
                <div class="stat-label">Passed</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${report.summary.failed}</div>
                <div class="stat-label">Failed</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${(report.summary.duration / 1000).toFixed(2)}s</div>
                <div class="stat-label">Total Duration</div>
            </div>
        </div>

        <div class="metrics">
            <h3>📊 Electron Metrics</h3>
            <div class="stats">
                <div class="stat-card">
                    <div class="stat-value">${report.electronMetrics.averageStartupTime.toFixed(0)}ms</div>
                    <div class="stat-label">Avg Startup Time</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${(report.electronMetrics.peakMemoryUsage / 1024 / 1024).toFixed(2)}MB</div>
                    <div class="stat-label">Peak Memory</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${report.performance.averageTestDuration.toFixed(0)}ms</div>
                    <div class="stat-label">Avg Test Duration</div>
                </div>
            </div>
        </div>

        <div class="test-list">
            <h3>📝 Test Results</h3>
            ${report.testResults.map(test => `
                <div class="test-item test-${test.status}">
                    <strong>${test.title}</strong>
                    <span style="float: right;">${test.duration}ms</span>
                    ${test.errors.length > 0 ? `
                        <div class="error-details">${test.errors.map(e => e.message).join('\\n')}</div>
                    ` : ''}
                </div>
            `).join('')}
        </div>
    </div>
</body>
</html>`;

    const htmlPath = path.join('test-reports', 'electron-report.html');
    await fs.writeFile(htmlPath, htmlContent);
  }
}

interface TestReportEntry {
  title: string;
  status: string;
  duration: number;
  errors: any[];
  startTime: Date;
  attachments: {
    name: string;
    path?: string;
    contentType: string;
  }[];
}

interface ElectronMetrics {
  startupTimes: number[];
  memoryUsage: number[];
  windowCounts: number[];
  errors: {
    test: string;
    message: string;
    stack: string;
  }[];
}

interface DetailedElectronReport {
  summary: {
    startTime: string;
    endTime: string;
    duration: number;
    totalTests: number;
    passed: number;
    failed: number;
    skipped: number;
    flaky: number;
    timedOut: number;
  };
  electronMetrics: ElectronMetrics & {
    averageStartupTime: number;
    peakMemoryUsage: number;
    averageWindowCount: number;
  };
  testResults: TestReportEntry[];
  environment: {
    node: string;
    platform: string;
    arch: string;
    ci: boolean;
    workers: number;
  };
  performance: {
    slowestTests: { title: string; duration: number }[];
    fastestTests: { title: string; duration: number }[];
    averageTestDuration: number;
  };
}