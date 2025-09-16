/**
 * Test Coverage Analyzer and Quality Metrics Validator
 * Analyzes test coverage and validates quality metrics for the search system
 */

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

interface CoverageReport {
  lines: { total: number; covered: number; skipped: number; pct: number };
  functions: { total: number; covered: number; skipped: number; pct: number };
  statements: { total: number; covered: number; skipped: number; pct: number };
  branches: { total: number; covered: number; skipped: number; pct: number };
}

interface FileCoverage extends CoverageReport {
  path: string;
  uncoveredLines: number[];
}

interface QualityMetrics {
  coverage: {
    overall: CoverageReport;
    byFile: FileCoverage[];
    criticalComponents: {
      searchEngine: number;
      database: number;
      services: number;
      ui: number;
    };
  };
  testDistribution: {
    unit: number;
    integration: number;
    e2e: number;
    performance: number;
  };
  codeQuality: {
    lintWarnings: number;
    lintErrors: number;
    typeErrors: number;
    duplicateCode: number;
  };
  performance: {
    averageTestTime: number;
    slowestTests: Array<{ name: string; duration: number }>;
    memoryUsage: number;
  };
  accessibility: {
    violations: number;
    wcagLevel: 'A' | 'AA' | 'AAA';
    keyboardNavigation: boolean;
    screenReader: boolean;
  };
}

interface QualityThresholds {
  coverage: {
    overall: number;
    criticalComponents: number;
    lines: number;
    functions: number;
    branches: number;
  };
  performance: {
    maxTestTime: number;
    maxMemoryUsage: number;
  };
  quality: {
    maxLintErrors: number;
    maxTypeErrors: number;
  };
}

export class TestCoverageAnalyzer {
  private projectRoot: string;
  private coverageDir: string;
  private thresholds: QualityThresholds;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
    this.coverageDir = path.join(projectRoot, 'coverage');
    this.thresholds = {
      coverage: {
        overall: 90,
        criticalComponents: 95,
        lines: 90,
        functions: 90,
        branches: 85
      },
      performance: {
        maxTestTime: 5000, // 5 seconds
        maxMemoryUsage: 512 * 1024 * 1024 // 512MB
      },
      quality: {
        maxLintErrors: 0,
        maxTypeErrors: 0
      }
    };
  }

  async analyzeCoverage(): Promise<QualityMetrics['coverage']> {
    const coverageSummaryPath = path.join(this.coverageDir, 'coverage-summary.json');

    if (!fs.existsSync(coverageSummaryPath)) {
      throw new Error('Coverage summary not found. Run tests with coverage first.');
    }

    const coverageSummary = JSON.parse(fs.readFileSync(coverageSummaryPath, 'utf8'));
    const overall = coverageSummary.total;

    // Analyze coverage by file
    const byFile: FileCoverage[] = Object.entries(coverageSummary)
      .filter(([key]) => key !== 'total')
      .map(([filePath, coverage]: [string, any]) => ({
        path: filePath,
        lines: coverage.lines,
        functions: coverage.functions,
        statements: coverage.statements,
        branches: coverage.branches,
        uncoveredLines: coverage.lines.uncoveredLines || []
      }));

    // Analyze critical components
    const criticalComponents = {
      searchEngine: this.calculateComponentCoverage(byFile, 'services/search/'),
      database: this.calculateComponentCoverage(byFile, 'database/'),
      services: this.calculateComponentCoverage(byFile, 'services/'),
      ui: this.calculateComponentCoverage(byFile, 'renderer/components/')
    };

    return {
      overall,
      byFile,
      criticalComponents
    };
  }

  private calculateComponentCoverage(files: FileCoverage[], pathPattern: string): number {
    const componentFiles = files.filter(f => f.path.includes(pathPattern));
    if (componentFiles.length === 0) return 0;

    const totalLines = componentFiles.reduce((sum, f) => sum + f.lines.total, 0);
    const coveredLines = componentFiles.reduce((sum, f) => sum + f.lines.covered, 0);

    return totalLines > 0 ? (coveredLines / totalLines) * 100 : 0;
  }

  async analyzeTestDistribution(): Promise<QualityMetrics['testDistribution']> {
    const testFiles = await glob('**/*.{test,spec}.{ts,tsx,js,jsx}', {
      cwd: this.projectRoot,
      ignore: ['node_modules/**', 'dist/**']
    });

    const distribution = {
      unit: 0,
      integration: 0,
      e2e: 0,
      performance: 0
    };

    testFiles.forEach(file => {
      if (file.includes('unit') || file.includes('.unit.')) {
        distribution.unit++;
      } else if (file.includes('integration') || file.includes('.integration.')) {
        distribution.integration++;
      } else if (file.includes('e2e') || file.includes('.e2e.')) {
        distribution.e2e++;
      } else if (file.includes('performance') || file.includes('.perf.')) {
        distribution.performance++;
      } else {
        // Default to unit tests
        distribution.unit++;
      }
    });

    return distribution;
  }

  async analyzeCodeQuality(): Promise<QualityMetrics['codeQuality']> {
    const quality = {
      lintWarnings: 0,
      lintErrors: 0,
      typeErrors: 0,
      duplicateCode: 0
    };

    // Analyze ESLint results
    const eslintResultsPath = path.join(this.projectRoot, 'eslint-results.json');
    if (fs.existsSync(eslintResultsPath)) {
      const eslintResults = JSON.parse(fs.readFileSync(eslintResultsPath, 'utf8'));
      eslintResults.forEach((result: any) => {
        result.messages.forEach((message: any) => {
          if (message.severity === 1) {
            quality.lintWarnings++;
          } else if (message.severity === 2) {
            quality.lintErrors++;
          }
        });
      });
    }

    // Analyze TypeScript errors
    const tscResultsPath = path.join(this.projectRoot, 'tsc-results.json');
    if (fs.existsSync(tscResultsPath)) {
      const tscResults = JSON.parse(fs.readFileSync(tscResultsPath, 'utf8'));
      quality.typeErrors = tscResults.length || 0;
    }

    return quality;
  }

  async analyzePerformance(): Promise<QualityMetrics['performance']> {
    const testResultsPath = path.join(this.projectRoot, 'test-results', 'junit.xml');
    let averageTestTime = 0;
    let slowestTests: Array<{ name: string; duration: number }> = [];

    // Mock performance data - in real implementation, parse from test results
    if (fs.existsSync(path.join(this.projectRoot, 'test-results'))) {
      const performanceDataPath = path.join(this.projectRoot, 'test-results', 'performance.json');
      if (fs.existsSync(performanceDataPath)) {
        const performanceData = JSON.parse(fs.readFileSync(performanceDataPath, 'utf8'));
        averageTestTime = performanceData.averageTime || 0;
        slowestTests = performanceData.slowestTests || [];
      }
    }

    return {
      averageTestTime,
      slowestTests,
      memoryUsage: process.memoryUsage().heapUsed
    };
  }

  async analyzeAccessibility(): Promise<QualityMetrics['accessibility']> {
    const a11yReportsPath = path.join(this.projectRoot, 'accessibility-reports');
    let violations = 0;
    let wcagLevel: 'A' | 'AA' | 'AAA' = 'A';
    let keyboardNavigation = false;
    let screenReader = false;

    if (fs.existsSync(a11yReportsPath)) {
      const violationsPath = path.join(a11yReportsPath, 'violations.json');
      if (fs.existsSync(violationsPath)) {
        const violationsData = JSON.parse(fs.readFileSync(violationsPath, 'utf8'));
        violations = violationsData.length || 0;

        // Determine WCAG level based on violation types
        const hasAAViolations = violationsData.some((v: any) =>
          v.tags && v.tags.includes('wcag2aa')
        );
        const hasAAAViolations = violationsData.some((v: any) =>
          v.tags && v.tags.includes('wcag2aaa')
        );

        if (!hasAAViolations && !hasAAAViolations) {
          wcagLevel = 'AAA';
        } else if (!hasAAViolations) {
          wcagLevel = 'AA';
        }
      }

      // Check keyboard navigation and screen reader support
      const keyboardTestPath = path.join(a11yReportsPath, 'keyboard-test.json');
      if (fs.existsSync(keyboardTestPath)) {
        const keyboardData = JSON.parse(fs.readFileSync(keyboardTestPath, 'utf8'));
        keyboardNavigation = keyboardData.passed || false;
      }

      const screenReaderPath = path.join(a11yReportsPath, 'screenreader-test.json');
      if (fs.existsSync(screenReaderPath)) {
        const screenReaderData = JSON.parse(fs.readFileSync(screenReaderPath, 'utf8'));
        screenReader = screenReaderData.passed || false;
      }
    }

    return {
      violations,
      wcagLevel,
      keyboardNavigation,
      screenReader
    };
  }

  async generateQualityReport(): Promise<QualityMetrics> {
    console.log('📊 Analyzing test coverage and quality metrics...\n');

    const [coverage, testDistribution, codeQuality, performance, accessibility] = await Promise.all([
      this.analyzeCoverage().catch(err => {
        console.warn('Coverage analysis failed:', err.message);
        return {
          overall: { lines: { pct: 0 }, functions: { pct: 0 }, statements: { pct: 0 }, branches: { pct: 0 } },
          byFile: [],
          criticalComponents: { searchEngine: 0, database: 0, services: 0, ui: 0 }
        } as QualityMetrics['coverage'];
      }),
      this.analyzeTestDistribution(),
      this.analyzeCodeQuality(),
      this.analyzePerformance(),
      this.analyzeAccessibility()
    ]);

    return {
      coverage,
      testDistribution,
      codeQuality,
      performance,
      accessibility
    };
  }

  validateQualityThresholds(metrics: QualityMetrics): {
    passed: boolean;
    violations: string[];
    summary: string;
  } {
    const violations: string[] = [];

    // Coverage thresholds
    if (metrics.coverage.overall.lines.pct < this.thresholds.coverage.lines) {
      violations.push(`Line coverage ${metrics.coverage.overall.lines.pct}% below threshold ${this.thresholds.coverage.lines}%`);
    }

    if (metrics.coverage.overall.functions.pct < this.thresholds.coverage.functions) {
      violations.push(`Function coverage ${metrics.coverage.overall.functions.pct}% below threshold ${this.thresholds.coverage.functions}%`);
    }

    if (metrics.coverage.overall.branches.pct < this.thresholds.coverage.branches) {
      violations.push(`Branch coverage ${metrics.coverage.overall.branches.pct}% below threshold ${this.thresholds.coverage.branches}%`);
    }

    // Critical component coverage
    Object.entries(metrics.coverage.criticalComponents).forEach(([component, coverage]) => {
      if (coverage < this.thresholds.coverage.criticalComponents) {
        violations.push(`${component} coverage ${coverage.toFixed(1)}% below critical threshold ${this.thresholds.coverage.criticalComponents}%`);
      }
    });

    // Code quality thresholds
    if (metrics.codeQuality.lintErrors > this.thresholds.quality.maxLintErrors) {
      violations.push(`${metrics.codeQuality.lintErrors} lint errors exceed threshold ${this.thresholds.quality.maxLintErrors}`);
    }

    if (metrics.codeQuality.typeErrors > this.thresholds.quality.maxTypeErrors) {
      violations.push(`${metrics.codeQuality.typeErrors} TypeScript errors exceed threshold ${this.thresholds.quality.maxTypeErrors}`);
    }

    // Performance thresholds
    if (metrics.performance.averageTestTime > this.thresholds.performance.maxTestTime) {
      violations.push(`Average test time ${metrics.performance.averageTestTime}ms exceeds threshold ${this.thresholds.performance.maxTestTime}ms`);
    }

    if (metrics.performance.memoryUsage > this.thresholds.performance.maxMemoryUsage) {
      const memoryMB = metrics.performance.memoryUsage / (1024 * 1024);
      const thresholdMB = this.thresholds.performance.maxMemoryUsage / (1024 * 1024);
      violations.push(`Memory usage ${memoryMB.toFixed(1)}MB exceeds threshold ${thresholdMB}MB`);
    }

    // Accessibility requirements
    if (metrics.accessibility.violations > 0) {
      violations.push(`${metrics.accessibility.violations} accessibility violations found`);
    }

    if (metrics.accessibility.wcagLevel === 'A') {
      violations.push('WCAG compliance below AA level');
    }

    const passed = violations.length === 0;
    const summary = passed
      ? '✅ All quality thresholds met'
      : `❌ ${violations.length} quality threshold violations`;

    return { passed, violations, summary };
  }

  generateHtmlReport(metrics: QualityMetrics): string {
    const validation = this.validateQualityThresholds(metrics);

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Quality Metrics Report - Intelligent Search System</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; }
        .header { text-align: center; margin-bottom: 30px; }
        .metric-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
        .metric-card { background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 5px; padding: 15px; }
        .metric-title { font-size: 18px; font-weight: bold; margin-bottom: 10px; color: #495057; }
        .metric-value { font-size: 24px; font-weight: bold; margin: 5px 0; }
        .success { color: #28a745; }
        .warning { color: #ffc107; }
        .danger { color: #dc3545; }
        .progress-bar { width: 100%; height: 20px; background: #e9ecef; border-radius: 10px; overflow: hidden; }
        .progress-fill { height: 100%; background: #28a745; transition: width 0.3s ease; }
        .violations { background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 5px; padding: 10px; margin: 10px 0; }
        .test-distribution { display: flex; gap: 10px; }
        .test-type { flex: 1; text-align: center; padding: 10px; background: #e9ecef; border-radius: 5px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🧠 Intelligent Search System</h1>
            <h2>Quality Metrics Report</h2>
            <p>Generated on: ${new Date().toLocaleString()}</p>
            <div class="${validation.passed ? 'success' : 'danger'}">
                <h3>${validation.summary}</h3>
            </div>
        </div>

        <div class="metric-grid">
            <!-- Coverage Metrics -->
            <div class="metric-card">
                <div class="metric-title">📊 Code Coverage</div>
                <div class="metric-value ${metrics.coverage.overall.lines.pct >= 90 ? 'success' : 'danger'}">
                    ${metrics.coverage.overall.lines.pct.toFixed(1)}%
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${metrics.coverage.overall.lines.pct}%"></div>
                </div>
                <div style="margin-top: 10px;">
                    <div>Functions: ${metrics.coverage.overall.functions.pct.toFixed(1)}%</div>
                    <div>Branches: ${metrics.coverage.overall.branches.pct.toFixed(1)}%</div>
                    <div>Statements: ${metrics.coverage.overall.statements.pct.toFixed(1)}%</div>
                </div>
            </div>

            <!-- Critical Components -->
            <div class="metric-card">
                <div class="metric-title">🎯 Critical Components</div>
                <div>Search Engine: ${metrics.coverage.criticalComponents.searchEngine.toFixed(1)}%</div>
                <div>Database: ${metrics.coverage.criticalComponents.database.toFixed(1)}%</div>
                <div>Services: ${metrics.coverage.criticalComponents.services.toFixed(1)}%</div>
                <div>UI Components: ${metrics.coverage.criticalComponents.ui.toFixed(1)}%</div>
            </div>

            <!-- Test Distribution -->
            <div class="metric-card">
                <div class="metric-title">🧪 Test Distribution</div>
                <div class="test-distribution">
                    <div class="test-type">
                        <div>Unit</div>
                        <div class="metric-value">${metrics.testDistribution.unit}</div>
                    </div>
                    <div class="test-type">
                        <div>Integration</div>
                        <div class="metric-value">${metrics.testDistribution.integration}</div>
                    </div>
                    <div class="test-type">
                        <div>E2E</div>
                        <div class="metric-value">${metrics.testDistribution.e2e}</div>
                    </div>
                    <div class="test-type">
                        <div>Performance</div>
                        <div class="metric-value">${metrics.testDistribution.performance}</div>
                    </div>
                </div>
            </div>

            <!-- Code Quality -->
            <div class="metric-card">
                <div class="metric-title">✨ Code Quality</div>
                <div class="metric-value ${metrics.codeQuality.lintErrors === 0 ? 'success' : 'danger'}">
                    ${metrics.codeQuality.lintErrors} Errors
                </div>
                <div>Lint Warnings: ${metrics.codeQuality.lintWarnings}</div>
                <div>TypeScript Errors: ${metrics.codeQuality.typeErrors}</div>
                <div>Duplicate Code: ${metrics.codeQuality.duplicateCode}</div>
            </div>

            <!-- Performance -->
            <div class="metric-card">
                <div class="metric-title">⚡ Performance</div>
                <div class="metric-value ${metrics.performance.averageTestTime < 5000 ? 'success' : 'warning'}">
                    ${metrics.performance.averageTestTime.toFixed(0)}ms
                </div>
                <div>Average Test Time</div>
                <div>Memory Usage: ${(metrics.performance.memoryUsage / 1024 / 1024).toFixed(1)}MB</div>
                <div>Slowest Tests: ${metrics.performance.slowestTests.length}</div>
            </div>

            <!-- Accessibility -->
            <div class="metric-card">
                <div class="metric-title">♿ Accessibility</div>
                <div class="metric-value ${metrics.accessibility.violations === 0 ? 'success' : 'danger'}">
                    ${metrics.accessibility.violations} Violations
                </div>
                <div>WCAG Level: ${metrics.accessibility.wcagLevel}</div>
                <div>Keyboard Navigation: ${metrics.accessibility.keyboardNavigation ? '✅' : '❌'}</div>
                <div>Screen Reader: ${metrics.accessibility.screenReader ? '✅' : '❌'}</div>
            </div>
        </div>

        ${validation.violations.length > 0 ? `
        <div class="violations">
            <h3>⚠️ Quality Violations</h3>
            <ul>
                ${validation.violations.map(v => `<li>${v}</li>`).join('')}
            </ul>
        </div>
        ` : ''}

        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; text-align: center; color: #6c757d;">
            <p>Report generated by Test Coverage Analyzer v1.0</p>
        </div>
    </div>
</body>
</html>`;
  }

  async saveReport(metrics: QualityMetrics, outputPath?: string): Promise<void> {
    const reportPath = outputPath || path.join(this.projectRoot, 'quality-report.html');
    const htmlReport = this.generateHtmlReport(metrics);

    fs.writeFileSync(reportPath, htmlReport);
    console.log(`📊 Quality report saved to: ${reportPath}`);

    // Also save JSON report for CI/CD
    const jsonPath = reportPath.replace('.html', '.json');
    fs.writeFileSync(jsonPath, JSON.stringify(metrics, null, 2));
    console.log(`📋 JSON report saved to: ${jsonPath}`);
  }
}

// CLI interface for running the analyzer
if (require.main === module) {
  async function main() {
    const analyzer = new TestCoverageAnalyzer();

    try {
      console.log('🔍 Starting quality metrics analysis...\n');
      const metrics = await analyzer.generateQualityReport();
      const validation = analyzer.validateQualityThresholds(metrics);

      // Print summary to console
      console.log('📊 QUALITY METRICS SUMMARY');
      console.log('═══════════════════════════');
      console.log(`Coverage: ${metrics.coverage.overall.lines.pct.toFixed(1)}%`);
      console.log(`Code Quality: ${metrics.codeQuality.lintErrors} errors`);
      console.log(`Performance: ${metrics.performance.averageTestTime.toFixed(0)}ms avg`);
      console.log(`Accessibility: ${metrics.accessibility.violations} violations`);
      console.log(`Test Distribution: ${Object.values(metrics.testDistribution).reduce((a, b) => a + b, 0)} total tests\n`);

      console.log(validation.summary);
      if (validation.violations.length > 0) {
        console.log('\n⚠️  Violations:');
        validation.violations.forEach(v => console.log(`   • ${v}`));
      }

      await analyzer.saveReport(metrics);

      process.exit(validation.passed ? 0 : 1);

    } catch (error) {
      console.error('❌ Quality analysis failed:', error);
      process.exit(1);
    }
  }

  main();
}

export { TestCoverageAnalyzer, QualityMetrics, QualityThresholds };