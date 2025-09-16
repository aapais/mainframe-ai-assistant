/**
 * Comprehensive Test Reporter
 * 
 * Generates detailed reports for all test execution scenarios including:
 * - HTML reports with interactive dashboards
 * - JSON reports for CI/CD integration
 * - JUnit XML for test result integration
 * - Coverage reports with trend analysis
 * - Performance analysis and recommendations
 * - MVP1 requirement validation results
 */

import { promises as fs } from 'fs';
import path from 'path';
import { TestRunConfig, PerformanceThresholds } from './test-config';

export interface TestMetrics {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  successRate: number;
  duration: number;
  avgDuration: number;
}

export interface SuiteResult {
  suite: string;
  category: string;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  errors: string[];
  warnings: string[];
  coverage?: CoverageResult;
  performance?: PerformanceResult;
  requirements?: RequirementResult;
}

export interface CoverageResult {
  statements: { pct: number; covered: number; total: number };
  branches: { pct: number; covered: number; total: number };
  functions: { pct: number; covered: number; total: number };
  lines: { pct: number; covered: number; total: number };
  files?: { [filename: string]: any };
}

export interface PerformanceResult {
  avgResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  throughput: number;
  memoryUsage: {
    peak: number;
    average: number;
    growth: number;
  };
  cpuUsage: {
    average: number;
    peak: number;
  };
  errors: string[];
  passed: boolean;
}

export interface RequirementResult {
  functional: string[];
  nonFunctional: string[];
  satisfied: boolean;
  missing: string[];
  details: Record<string, { passed: boolean; evidence: string[] }>;
}

export interface TestReport {
  metadata: {
    generatedAt: string;
    generatedBy: string;
    version: string;
    environment: string;
    nodeVersion: string;
    platform: string;
    arch: string;
  };
  configuration: TestRunConfig;
  summary: TestMetrics;
  suites: SuiteResult[];
  coverage?: {
    global: CoverageResult;
    byCategory: Record<string, CoverageResult>;
    trend: CoverageTrend[];
  };
  performance?: {
    summary: PerformanceResult;
    byCategory: Record<string, PerformanceResult>;
    thresholds: PerformanceThresholds;
    regressions: PerformanceRegression[];
  };
  mvp1?: {
    validation: any; // Will be defined in mvp1-validation.ts
    requirements: Record<string, RequirementResult>;
    completeness: number;
  };
  trends?: {
    successRate: TrendPoint[];
    duration: TrendPoint[];
    coverage: TrendPoint[];
  };
  recommendations: Recommendation[];
  artifacts: {
    reportFiles: string[];
    coverageFiles: string[];
    logFiles: string[];
  };
}

export interface CoverageTrend {
  date: string;
  statements: number;
  branches: number;
  functions: number;
  lines: number;
}

export interface PerformanceRegression {
  suite: string;
  metric: string;
  previous: number;
  current: number;
  change: number;
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface TrendPoint {
  date: string;
  value: number;
  metadata?: Record<string, any>;
}

export interface Recommendation {
  type: 'performance' | 'coverage' | 'quality' | 'mvp1' | 'infrastructure';
  severity: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  description: string;
  action: string;
  impact: string;
  effort: 'low' | 'medium' | 'high';
  evidence: string[];
}

export class TestReporter {
  private config: TestRunConfig;
  private reportDir: string;
  private templatesDir: string;

  constructor(config: TestRunConfig) {
    this.config = config;
    this.reportDir = path.join(process.cwd(), 'reports');
    this.templatesDir = path.join(__dirname, 'templates');
  }

  async generateComprehensiveReport(masterResult: any): Promise<TestReport> {
    console.log('📊 Generating comprehensive test report...');

    const report: TestReport = {
      metadata: {
        generatedAt: new Date().toISOString(),
        generatedBy: 'MVP1 Master Test Runner',
        version: '1.0.0',
        environment: this.config.environment || 'test',
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch
      },
      configuration: this.config,
      summary: this.calculateGlobalMetrics(masterResult.suites),
      suites: masterResult.suites,
      coverage: await this.aggregateCoverageData(masterResult.suites),
      performance: await this.aggregatePerformanceData(masterResult.suites),
      mvp1: masterResult.mvp1Validation ? {
        validation: masterResult.mvp1Validation,
        requirements: this.extractRequirementResults(masterResult.suites),
        completeness: this.calculateMVP1Completeness(masterResult.mvp1Validation)
      } : undefined,
      trends: await this.calculateTrends(),
      recommendations: this.generateRecommendations(masterResult),
      artifacts: {
        reportFiles: [],
        coverageFiles: [],
        logFiles: []
      }
    };

    // Generate different report formats
    const artifacts = await this.generateAllReports(report);
    report.artifacts = artifacts;

    console.log('✅ Comprehensive test report generated');
    return report;
  }

  private calculateGlobalMetrics(suites: SuiteResult[]): TestMetrics {
    const totals = suites.reduce(
      (acc, suite) => ({
        total: acc.total + suite.passed + suite.failed + suite.skipped,
        passed: acc.passed + suite.passed,
        failed: acc.failed + suite.failed,
        skipped: acc.skipped + suite.skipped,
        duration: acc.duration + suite.duration
      }),
      { total: 0, passed: 0, failed: 0, skipped: 0, duration: 0 }
    );

    return {
      ...totals,
      successRate: totals.total > 0 ? (totals.passed / totals.total) * 100 : 100,
      avgDuration: suites.length > 0 ? totals.duration / suites.length : 0
    };
  }

  private async aggregateCoverageData(suites: SuiteResult[]): Promise<TestReport['coverage']> {
    const suitesWithCoverage = suites.filter(s => s.coverage);
    if (suitesWithCoverage.length === 0) return undefined;

    // Aggregate global coverage
    const global = this.aggregateCoverageResults(suitesWithCoverage.map(s => s.coverage!));
    
    // Group by category
    const byCategory: Record<string, CoverageResult> = {};
    const categories = [...new Set(suites.map(s => s.category))];
    
    for (const category of categories) {
      const categorySuites = suites.filter(s => s.category === category && s.coverage);
      if (categorySuites.length > 0) {
        byCategory[category] = this.aggregateCoverageResults(categorySuites.map(s => s.coverage!));
      }
    }

    // Load historical trends
    const trend = await this.loadCoverageTrends();

    return { global, byCategory, trend };
  }

  private aggregateCoverageResults(coverageResults: CoverageResult[]): CoverageResult {
    const totals = coverageResults.reduce(
      (acc, coverage) => ({
        statements: {
          covered: acc.statements.covered + coverage.statements.covered,
          total: acc.statements.total + coverage.statements.total
        },
        branches: {
          covered: acc.branches.covered + coverage.branches.covered,
          total: acc.branches.total + coverage.branches.total
        },
        functions: {
          covered: acc.functions.covered + coverage.functions.covered,
          total: acc.functions.total + coverage.functions.total
        },
        lines: {
          covered: acc.lines.covered + coverage.lines.covered,
          total: acc.lines.total + coverage.lines.total
        }
      }),
      {
        statements: { covered: 0, total: 0 },
        branches: { covered: 0, total: 0 },
        functions: { covered: 0, total: 0 },
        lines: { covered: 0, total: 0 }
      }
    );

    return {
      statements: {
        ...totals.statements,
        pct: totals.statements.total > 0 ? (totals.statements.covered / totals.statements.total) * 100 : 0
      },
      branches: {
        ...totals.branches,
        pct: totals.branches.total > 0 ? (totals.branches.covered / totals.branches.total) * 100 : 0
      },
      functions: {
        ...totals.functions,
        pct: totals.functions.total > 0 ? (totals.functions.covered / totals.functions.total) * 100 : 0
      },
      lines: {
        ...totals.lines,
        pct: totals.lines.total > 0 ? (totals.lines.covered / totals.lines.total) * 100 : 0
      }
    };
  }

  private async aggregatePerformanceData(suites: SuiteResult[]): Promise<TestReport['performance']> {
    const performanceSuites = suites.filter(s => s.performance);
    if (performanceSuites.length === 0) return undefined;

    // Aggregate performance metrics
    const summary = this.aggregatePerformanceResults(performanceSuites.map(s => s.performance!));

    // Group by category
    const byCategory: Record<string, PerformanceResult> = {};
    const categories = [...new Set(suites.map(s => s.category))];
    
    for (const category of categories) {
      const categorySuites = suites.filter(s => s.category === category && s.performance);
      if (categorySuites.length > 0) {
        byCategory[category] = this.aggregatePerformanceResults(categorySuites.map(s => s.performance!));
      }
    }

    // Detect regressions
    const regressions = await this.detectPerformanceRegressions(performanceSuites);

    return {
      summary,
      byCategory,
      thresholds: this.config.performanceThresholds || {},
      regressions
    };
  }

  private aggregatePerformanceResults(results: PerformanceResult[]): PerformanceResult {
    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    const max = (arr: number[]) => Math.max(...arr);
    const min = (arr: number[]) => Math.min(...arr);

    const responseTimes = results.map(r => r.avgResponseTime);
    const p95Times = results.map(r => r.p95ResponseTime);
    const p99Times = results.map(r => r.p99ResponseTime);
    const minTimes = results.map(r => r.minResponseTime);
    const maxTimes = results.map(r => r.maxResponseTime);
    const throughputs = results.map(r => r.throughput);
    
    const memoryPeaks = results.map(r => r.memoryUsage.peak);
    const memoryAvgs = results.map(r => r.memoryUsage.average);
    const memoryGrowths = results.map(r => r.memoryUsage.growth);
    
    const cpuAvgs = results.map(r => r.cpuUsage.average);
    const cpuPeaks = results.map(r => r.cpuUsage.peak);

    const allErrors = results.flatMap(r => r.errors);
    const allPassed = results.every(r => r.passed);

    return {
      avgResponseTime: avg(responseTimes),
      p95ResponseTime: avg(p95Times),
      p99ResponseTime: avg(p99Times),
      minResponseTime: min(minTimes),
      maxResponseTime: max(maxTimes),
      throughput: avg(throughputs),
      memoryUsage: {
        peak: max(memoryPeaks),
        average: avg(memoryAvgs),
        growth: avg(memoryGrowths)
      },
      cpuUsage: {
        average: avg(cpuAvgs),
        peak: max(cpuPeaks)
      },
      errors: allErrors,
      passed: allPassed
    };
  }

  private extractRequirementResults(suites: SuiteResult[]): Record<string, RequirementResult> {
    const requirements: Record<string, RequirementResult> = {};
    
    for (const suite of suites) {
      if (suite.requirements) {
        requirements[suite.suite] = suite.requirements;
      }
    }

    return requirements;
  }

  private calculateMVP1Completeness(mvp1Validation: any): number {
    if (!mvp1Validation) return 0;
    
    const { satisfiedRequirements = [], totalRequirements = 1 } = mvp1Validation;
    return (satisfiedRequirements.length / totalRequirements) * 100;
  }

  private async calculateTrends(): Promise<TestReport['trends']> {
    try {
      const historicalData = await this.loadHistoricalData();
      
      return {
        successRate: historicalData.successRate || [],
        duration: historicalData.duration || [],
        coverage: historicalData.coverage || []
      };
    } catch (error) {
      console.warn('⚠️  Could not load historical trends:', error.message);
      return undefined;
    }
  }

  private generateRecommendations(masterResult: any): Recommendation[] {
    const recommendations: Recommendation[] = [];
    const suites = masterResult.suites;
    const summary = this.calculateGlobalMetrics(suites);

    // Success rate recommendations
    if (summary.successRate < 90) {
      recommendations.push({
        type: 'quality',
        severity: 'critical',
        title: 'Low Test Success Rate',
        description: `Only ${summary.successRate.toFixed(1)}% of tests are passing`,
        action: 'Investigate and fix failing tests immediately',
        impact: 'System reliability is compromised',
        effort: 'high',
        evidence: [`${summary.failed} tests failing out of ${summary.total} total`]
      });
    } else if (summary.successRate < 95) {
      recommendations.push({
        type: 'quality',
        severity: 'warning',
        title: 'Moderate Test Success Rate',
        description: `Test success rate is ${summary.successRate.toFixed(1)}%`,
        action: 'Review and fix failing tests',
        impact: 'Quality could be improved',
        effort: 'medium',
        evidence: [`${summary.failed} tests failing`]
      });
    }

    // Performance recommendations
    const performanceSuites = suites.filter((s: any) => s.category === 'performance');
    const failedPerformance = performanceSuites.filter((s: any) => s.failed > 0);
    
    if (failedPerformance.length > 0) {
      recommendations.push({
        type: 'performance',
        severity: 'error',
        title: 'Performance Tests Failing',
        description: `${failedPerformance.length} performance test suites are failing`,
        action: 'Optimize performance bottlenecks and tune thresholds',
        impact: 'User experience degradation',
        effort: 'high',
        evidence: failedPerformance.map((s: any) => `${s.suite}: ${s.errors.join(', ')}`)
      });
    }

    // Coverage recommendations
    if (masterResult.coverage?.global) {
      const coverage = masterResult.coverage.global;
      const lowCoverage = [
        coverage.statements.pct < 80,
        coverage.branches.pct < 75,
        coverage.functions.pct < 80,
        coverage.lines.pct < 80
      ].some(Boolean);

      if (lowCoverage) {
        recommendations.push({
          type: 'coverage',
          severity: 'warning',
          title: 'Low Test Coverage',
          description: 'Test coverage is below recommended thresholds',
          action: 'Add tests for uncovered code paths',
          impact: 'Potential bugs may go undetected',
          effort: 'medium',
          evidence: [
            `Statements: ${coverage.statements.pct.toFixed(1)}%`,
            `Branches: ${coverage.branches.pct.toFixed(1)}%`,
            `Functions: ${coverage.functions.pct.toFixed(1)}%`,
            `Lines: ${coverage.lines.pct.toFixed(1)}%`
          ]
        });
      }
    }

    // MVP1 recommendations
    if (masterResult.mvp1Validation && !masterResult.mvp1Validation.passed) {
      recommendations.push({
        type: 'mvp1',
        severity: 'critical',
        title: 'MVP1 Requirements Not Met',
        description: 'Critical MVP1 requirements are not satisfied',
        action: 'Implement missing MVP1 functionality',
        impact: 'MVP1 delivery at risk',
        effort: 'high',
        evidence: masterResult.mvp1Validation.missingRequirements || []
      });
    }

    // Long duration recommendations
    if (summary.avgDuration > 60000) { // 1 minute
      recommendations.push({
        type: 'infrastructure',
        severity: 'warning',
        title: 'Long Test Duration',
        description: `Average test suite duration is ${(summary.avgDuration / 1000).toFixed(1)} seconds`,
        action: 'Optimize test performance and consider parallel execution',
        impact: 'Slower development feedback loop',
        effort: 'medium',
        evidence: [`Average duration: ${summary.avgDuration}ms`]
      });
    }

    return recommendations;
  }

  private async generateAllReports(report: TestReport): Promise<TestReport['artifacts']> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportFiles: string[] = [];
    const coverageFiles: string[] = [];
    const logFiles: string[] = [];

    // Ensure report directory exists
    await fs.mkdir(this.reportDir, { recursive: true });

    try {
      // Generate JSON report
      const jsonReportPath = path.join(this.reportDir, `test-report-${timestamp}.json`);
      await fs.writeFile(jsonReportPath, JSON.stringify(report, null, 2));
      reportFiles.push(jsonReportPath);
      console.log(`📄 JSON report: ${jsonReportPath}`);

      // Generate HTML report
      const htmlReportPath = path.join(this.reportDir, `test-report-${timestamp}.html`);
      const htmlReport = await this.generateHTMLReport(report);
      await fs.writeFile(htmlReportPath, htmlReport);
      reportFiles.push(htmlReportPath);
      console.log(`📄 HTML report: ${htmlReportPath}`);

      // Generate JUnit XML if needed
      if (this.config.reportFormat === 'junit' || this.config.reportFormat === 'comprehensive') {
        const junitReportPath = path.join(this.reportDir, `junit-${timestamp}.xml`);
        const junitReport = this.generateJUnitReport(report);
        await fs.writeFile(junitReportPath, junitReport);
        reportFiles.push(junitReportPath);
        console.log(`📄 JUnit report: ${junitReportPath}`);
      }

      // Generate summary report for quick viewing
      const summaryReportPath = path.join(this.reportDir, `summary-${timestamp}.txt`);
      const summaryReport = this.generateTextSummary(report);
      await fs.writeFile(summaryReportPath, summaryReport);
      reportFiles.push(summaryReportPath);
      console.log(`📄 Summary report: ${summaryReportPath}`);

      // Save trends data for future comparisons
      await this.saveTrendsData(report);

    } catch (error) {
      console.error('❌ Error generating reports:', error);
    }

    return { reportFiles, coverageFiles, logFiles };
  }

  private async generateHTMLReport(report: TestReport): Promise<string> {
    // Simplified HTML template - in a real implementation, this would be much more sophisticated
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MVP1 Test Report - ${report.metadata.generatedAt}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .header { border-bottom: 2px solid #e0e0e0; padding-bottom: 20px; margin-bottom: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric { background: #f8f9fa; padding: 15px; border-radius: 6px; text-align: center; }
        .metric-value { font-size: 24px; font-weight: bold; color: #333; }
        .metric-label { font-size: 12px; color: #666; text-transform: uppercase; margin-top: 5px; }
        .success { color: #28a745; }
        .warning { color: #ffc107; }
        .error { color: #dc3545; }
        .suites { margin-bottom: 30px; }
        .suite { border: 1px solid #e0e0e0; border-radius: 6px; margin-bottom: 15px; }
        .suite-header { background: #f8f9fa; padding: 15px; font-weight: bold; cursor: pointer; }
        .suite-content { padding: 15px; display: none; }
        .suite-content.expanded { display: block; }
        .recommendations { background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 6px; padding: 20px; margin-top: 20px; }
        .recommendation { margin-bottom: 15px; padding: 10px; border-left: 4px solid #ffc107; background: #fffbf0; }
        .recommendation.critical { border-left-color: #dc3545; background: #fff5f5; }
        .recommendation.error { border-left-color: #dc3545; background: #fff5f5; }
        .recommendation.warning { border-left-color: #ffc107; background: #fffbf0; }
        .recommendation.info { border-left-color: #17a2b8; background: #f0f8ff; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #e0e0e0; }
        th { background: #f8f9fa; font-weight: bold; }
        .status-passed { color: #28a745; }
        .status-failed { color: #dc3545; }
        .status-skipped { color: #6c757d; }
    </style>
    <script>
        function toggleSuite(id) {
            const content = document.getElementById('suite-content-' + id);
            content.classList.toggle('expanded');
        }
    </script>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🧪 MVP1 Test Report</h1>
            <p><strong>Generated:</strong> ${report.metadata.generatedAt}</p>
            <p><strong>Environment:</strong> ${report.metadata.environment} | <strong>Node:</strong> ${report.metadata.nodeVersion} | <strong>Platform:</strong> ${report.metadata.platform}</p>
        </div>

        <div class="summary">
            <div class="metric">
                <div class="metric-value ${report.summary.successRate >= 95 ? 'success' : report.summary.successRate >= 90 ? 'warning' : 'error'}">${report.summary.successRate.toFixed(1)}%</div>
                <div class="metric-label">Success Rate</div>
            </div>
            <div class="metric">
                <div class="metric-value">${report.summary.total}</div>
                <div class="metric-label">Total Tests</div>
            </div>
            <div class="metric">
                <div class="metric-value success">${report.summary.passed}</div>
                <div class="metric-label">Passed</div>
            </div>
            <div class="metric">
                <div class="metric-value error">${report.summary.failed}</div>
                <div class="metric-label">Failed</div>
            </div>
            <div class="metric">
                <div class="metric-value">${report.summary.skipped}</div>
                <div class="metric-label">Skipped</div>
            </div>
            <div class="metric">
                <div class="metric-value">${(report.summary.duration / 1000).toFixed(1)}s</div>
                <div class="metric-label">Duration</div>
            </div>
        </div>

        <div class="suites">
            <h2>📋 Test Suites</h2>
            ${report.suites.map((suite, index) => `
                <div class="suite">
                    <div class="suite-header" onclick="toggleSuite(${index})">
                        <span class="${suite.failed > 0 ? 'status-failed' : 'status-passed'}">${suite.failed > 0 ? '❌' : '✅'}</span>
                        ${suite.category}/${suite.suite}
                        <small style="float: right;">${suite.passed}P ${suite.failed}F ${suite.skipped}S (${(suite.duration / 1000).toFixed(1)}s)</small>
                    </div>
                    <div id="suite-content-${index}" class="suite-content">
                        <table>
                            <tr><th>Metric</th><th>Value</th></tr>
                            <tr><td>Passed</td><td class="status-passed">${suite.passed}</td></tr>
                            <tr><td>Failed</td><td class="status-failed">${suite.failed}</td></tr>
                            <tr><td>Skipped</td><td class="status-skipped">${suite.skipped}</td></tr>
                            <tr><td>Duration</td><td>${(suite.duration / 1000).toFixed(1)}s</td></tr>
                        </table>
                        ${suite.errors.length > 0 ? `
                            <h4>Errors:</h4>
                            <ul>
                                ${suite.errors.map(error => `<li style="color: #dc3545; font-family: monospace; font-size: 12px;">${this.escapeHtml(error)}</li>`).join('')}
                            </ul>
                        ` : ''}
                    </div>
                </div>
            `).join('')}
        </div>

        ${report.mvp1 ? `
            <div class="mvp1">
                <h2>🎯 MVP1 Validation</h2>
                <div class="metric">
                    <div class="metric-value ${report.mvp1.validation.passed ? 'success' : 'error'}">${report.mvp1.validation.passed ? '✅ PASSED' : '❌ FAILED'}</div>
                    <div class="metric-label">MVP1 Requirements</div>
                </div>
                <p><strong>Completeness:</strong> ${report.mvp1.completeness.toFixed(1)}%</p>
            </div>
        ` : ''}

        ${report.recommendations.length > 0 ? `
            <div class="recommendations">
                <h2>💡 Recommendations</h2>
                ${report.recommendations.map(rec => `
                    <div class="recommendation ${rec.severity}">
                        <h4>${rec.title}</h4>
                        <p>${rec.description}</p>
                        <p><strong>Action:</strong> ${rec.action}</p>
                        <p><strong>Impact:</strong> ${rec.impact} | <strong>Effort:</strong> ${rec.effort}</p>
                    </div>
                `).join('')}
            </div>
        ` : ''}
    </div>
</body>
</html>
    `.trim();
  }

  private escapeHtml(text: string): string {
    const div = { innerHTML: '' } as any;
    div.textContent = text;
    return div.innerHTML;
  }

  private generateJUnitReport(report: TestReport): string {
    const testsuites = report.suites.map(suite => {
      const tests = Array.from({ length: suite.passed + suite.failed + suite.skipped }, (_, i) => {
        if (i < suite.failed) {
          return `    <testcase name="${suite.suite}_test_${i + 1}" classname="${suite.category}.${suite.suite}" time="${(suite.duration / 1000).toFixed(3)}">
      <failure message="Test failed">${suite.errors[0] || 'Test failed'}</failure>
    </testcase>`;
        } else if (i < suite.failed + suite.skipped) {
          return `    <testcase name="${suite.suite}_test_${i + 1}" classname="${suite.category}.${suite.suite}" time="0">
      <skipped/>
    </testcase>`;
        } else {
          return `    <testcase name="${suite.suite}_test_${i + 1}" classname="${suite.category}.${suite.suite}" time="${(suite.duration / 1000).toFixed(3)}"/>`;
        }
      });

      return `  <testsuite name="${suite.category}.${suite.suite}" tests="${suite.passed + suite.failed + suite.skipped}" failures="${suite.failed}" skipped="${suite.skipped}" time="${(suite.duration / 1000).toFixed(3)}">
${tests.join('\n')}
  </testsuite>`;
    });

    return `<?xml version="1.0" encoding="UTF-8"?>
<testsuites tests="${report.summary.total}" failures="${report.summary.failed}" skipped="${report.summary.skipped}" time="${(report.summary.duration / 1000).toFixed(3)}">
${testsuites.join('\n')}
</testsuites>`;
  }

  private generateTextSummary(report: TestReport): string {
    const lines = [
      '=' .repeat(80),
      'MVP1 Knowledge Base Assistant - Test Report Summary',
      '=' .repeat(80),
      `Generated: ${report.metadata.generatedAt}`,
      `Environment: ${report.metadata.environment}`,
      `Platform: ${report.metadata.platform} ${report.metadata.arch}`,
      `Node.js: ${report.metadata.nodeVersion}`,
      '',
      '📊 OVERALL RESULTS:',
      `   Tests:        ${report.summary.total} total`,
      `   Passed:       ${report.summary.passed} ✅`,
      `   Failed:       ${report.summary.failed} ❌`,
      `   Skipped:      ${report.summary.skipped} ⏭️`,
      `   Success Rate: ${report.summary.successRate.toFixed(1)}%`,
      `   Duration:     ${(report.summary.duration / 1000).toFixed(1)}s`,
      '',
      '📋 SUITE BREAKDOWN:',
      ...report.suites.map(suite => {
        const status = suite.failed > 0 ? '❌' : '✅';
        const successRate = suite.passed + suite.failed > 0 
          ? ((suite.passed / (suite.passed + suite.failed)) * 100).toFixed(1)
          : '100.0';
        return `   ${status} ${suite.category}/${suite.suite}: ${suite.passed}P ${suite.failed}F ${suite.skipped}S (${successRate}%) - ${(suite.duration / 1000).toFixed(1)}s`;
      }),
      ''
    ];

    if (report.mvp1) {
      lines.push(
        '🎯 MVP1 VALIDATION:',
        `   Status: ${report.mvp1.validation.passed ? '✅ PASSED' : '❌ FAILED'}`,
        `   Completeness: ${report.mvp1.completeness.toFixed(1)}%`,
        ''
      );
    }

    if (report.recommendations.length > 0) {
      lines.push(
        '💡 RECOMMENDATIONS:',
        ...report.recommendations.map(rec => `   ${this.getSeverityEmoji(rec.severity)} ${rec.title}: ${rec.action}`),
        ''
      );
    }

    lines.push('=' .repeat(80));

    return lines.join('\n');
  }

  private getSeverityEmoji(severity: string): string {
    switch (severity) {
      case 'critical': return '🔴';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      default: return '📝';
    }
  }

  async exportResults(results: SuiteResult[], format: 'json' | 'xml' | 'junit' = 'json', outputPath?: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    let filename: string;
    let content: string;

    switch (format) {
      case 'json':
        filename = outputPath || path.join(this.reportDir, `results-${timestamp}.json`);
        content = JSON.stringify(results, null, 2);
        break;
      case 'junit':
      case 'xml':
        filename = outputPath || path.join(this.reportDir, `junit-${timestamp}.xml`);
        content = this.generateJUnitReport({ suites: results, summary: this.calculateGlobalMetrics(results) } as any);
        break;
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }

    await fs.writeFile(filename, content);
    console.log(`📄 Results exported to: ${filename}`);
    return filename;
  }

  private async loadCoverageTrends(): Promise<CoverageTrend[]> {
    try {
      const trendsFile = path.join(this.reportDir, 'coverage-trends.json');
      const data = await fs.readFile(trendsFile, 'utf-8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  private async loadHistoricalData(): Promise<any> {
    try {
      const trendsFile = path.join(this.reportDir, 'test-trends.json');
      const data = await fs.readFile(trendsFile, 'utf-8');
      return JSON.parse(data);
    } catch {
      return {};
    }
  }

  private async detectPerformanceRegressions(performanceSuites: SuiteResult[]): Promise<PerformanceRegression[]> {
    // Simplified regression detection - would compare with historical data in real implementation
    return [];
  }

  private async saveTrendsData(report: TestReport): Promise<void> {
    try {
      const trendsFile = path.join(this.reportDir, 'test-trends.json');
      const now = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

      let trends: any = {};
      try {
        const data = await fs.readFile(trendsFile, 'utf-8');
        trends = JSON.parse(data);
      } catch {
        // Initialize trends data structure
      }

      // Add current data point
      if (!trends.successRate) trends.successRate = [];
      if (!trends.duration) trends.duration = [];
      if (!trends.coverage) trends.coverage = [];

      trends.successRate.push({ date: now, value: report.summary.successRate });
      trends.duration.push({ date: now, value: report.summary.duration });
      
      if (report.coverage?.global) {
        trends.coverage.push({ 
          date: now, 
          value: report.coverage.global.statements.pct 
        });
      }

      // Keep only last 30 data points
      const keepLast = (arr: any[]) => arr.slice(-30);
      trends.successRate = keepLast(trends.successRate);
      trends.duration = keepLast(trends.duration);
      trends.coverage = keepLast(trends.coverage);

      await fs.writeFile(trendsFile, JSON.stringify(trends, null, 2));
    } catch (error) {
      console.warn('⚠️  Could not save trends data:', error.message);
    }
  }
}

export default TestReporter;