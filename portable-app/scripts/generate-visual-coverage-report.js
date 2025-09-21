#!/usr/bin/env node

/**
 * Visual Coverage Report Generator
 * Analyzes visual test results and generates comprehensive coverage reports
 */

const fs = require('fs');
const path = require('path');

// Configuration
const RESULTS_PATH = process.env.RESULTS_PATH || 'combined-test-results';
const OUTPUT_HTML = 'visual-coverage-report.html';
const OUTPUT_JSON = 'visual-coverage-summary.json';

// Component categories for coverage analysis
const COMPONENT_CATEGORIES = {
  forms: ['SearchBar', 'KBSearchBar', 'SimpleSearchBar', 'EnhancedKBSearchBar'],
  display: ['ResultsList', 'EntryDetail', 'MetricsDashboard'],
  navigation: ['AppLayout', 'DetailPanel', 'LayoutPanel'],
  interactive: ['Button', 'Modal', 'Dropdown', 'Tabs'],
  accessibility: ['AccessibilityChecker', 'AriaPatterns', 'AlertMessage']
};

// Expected test coverage targets
const COVERAGE_TARGETS = {
  component: 95,      // 95% component visual coverage
  responsive: 90,     // 90% responsive design coverage
  themes: 85,         // 85% theme variation coverage
  crossBrowser: 80,   // 80% cross-browser coverage
  accessibility: 90   // 90% accessibility visual coverage
};

class VisualCoverageAnalyzer {
  constructor() {
    this.results = {
      desktop: { passed: 0, failed: 0, total: 0, tests: [] },
      responsive: { passed: 0, failed: 0, total: 0, tests: [] },
      themes: { passed: 0, failed: 0, total: 0, tests: [] },
      crossBrowser: { passed: 0, failed: 0, total: 0, tests: [] },
      accessibility: { passed: 0, failed: 0, total: 0, tests: [] }
    };

    this.componentCoverage = {};
    this.missingTests = [];
  }

  async analyzeResults() {
    console.log('🔍 Analyzing visual regression test results...');

    try {
      // Read all test result files
      await this.readTestResults();

      // Analyze component coverage
      await this.analyzeComponentCoverage();

      // Generate reports
      await this.generateHtmlReport();
      await this.generateJsonSummary();

      console.log('✅ Visual coverage analysis completed');
    } catch (error) {
      console.error('❌ Analysis failed:', error);
      process.exit(1);
    }
  }

  async readTestResults() {
    if (!fs.existsSync(RESULTS_PATH)) {
      console.warn('⚠️ Results path not found, generating empty report');
      return;
    }

    const resultDirs = fs.readdirSync(RESULTS_PATH);

    for (const dir of resultDirs) {
      const dirPath = path.join(RESULTS_PATH, dir);
      if (!fs.statSync(dirPath).isDirectory()) continue;

      await this.processResultDirectory(dirPath, dir);
    }
  }

  async processResultDirectory(dirPath, dirName) {
    const jsonFiles = this.findJsonResults(dirPath);

    for (const jsonFile of jsonFiles) {
      try {
        const resultData = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
        this.categorizeResults(resultData, dirName);
      } catch (error) {
        console.warn(`⚠️ Could not parse ${jsonFile}:`, error.message);
      }
    }
  }

  findJsonResults(dirPath) {
    const jsonFiles = [];

    const searchDir = (dir) => {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const itemPath = path.join(dir, item);
        if (fs.statSync(itemPath).isDirectory()) {
          searchDir(itemPath);
        } else if (item.endsWith('.json') && item.includes('results')) {
          jsonFiles.push(itemPath);
        }
      }
    };

    searchDir(dirPath);
    return jsonFiles;
  }

  categorizeResults(resultData, dirName) {
    const tests = resultData.tests || resultData.suites?.flatMap(s => s.tests) || [];

    for (const test of tests) {
      const testInfo = {
        title: test.title,
        status: test.outcome || test.status,
        duration: test.duration,
        file: test.location?.file
      };

      // Categorize based on directory name and test content
      if (dirName.includes('responsive') || test.title.includes('responsive')) {
        this.results.responsive.tests.push(testInfo);
        this.updateCategoryStats('responsive', testInfo.status);
      } else if (dirName.includes('theme') || test.title.includes('theme')) {
        this.results.themes.tests.push(testInfo);
        this.updateCategoryStats('themes', testInfo.status);
      } else if (dirName.includes('firefox') || dirName.includes('webkit') || test.title.includes('cross-browser')) {
        this.results.crossBrowser.tests.push(testInfo);
        this.updateCategoryStats('crossBrowser', testInfo.status);
      } else if (test.title.includes('accessibility') || test.title.includes('contrast')) {
        this.results.accessibility.tests.push(testInfo);
        this.updateCategoryStats('accessibility', testInfo.status);
      } else {
        this.results.desktop.tests.push(testInfo);
        this.updateCategoryStats('desktop', testInfo.status);
      }
    }
  }

  updateCategoryStats(category, status) {
    this.results[category].total++;
    if (status === 'passed') {
      this.results[category].passed++;
    } else {
      this.results[category].failed++;
    }
  }

  async analyzeComponentCoverage() {
    console.log('📊 Analyzing component coverage...');

    // Initialize component coverage tracking
    for (const [category, components] of Object.entries(COMPONENT_CATEGORIES)) {
      this.componentCoverage[category] = {
        total: components.length,
        tested: 0,
        components: {}
      };

      for (const component of components) {
        this.componentCoverage[category].components[component] = {
          visual: false,
          responsive: false,
          themes: false,
          crossBrowser: false,
          accessibility: false
        };
      }
    }

    // Analyze which components have been tested
    this.analyzeTestCoverage();

    // Calculate coverage percentages
    this.calculateCoveragePercentages();

    // Identify missing tests
    this.identifyMissingTests();
  }

  analyzeTestCoverage() {
    const allTests = [
      ...this.results.desktop.tests,
      ...this.results.responsive.tests,
      ...this.results.themes.tests,
      ...this.results.crossBrowser.tests,
      ...this.results.accessibility.tests
    ];

    for (const test of allTests) {
      // Extract component name from test title or file
      const componentName = this.extractComponentName(test.title, test.file);

      if (componentName) {
        const category = this.findComponentCategory(componentName);
        if (category) {
          const testType = this.determineTestType(test);
          this.componentCoverage[category].components[componentName][testType] = true;
        }
      }
    }
  }

  extractComponentName(title, file) {
    // Try to extract component name from test title
    const titleMatch = title.match(/(SearchBar|ResultsList|EntryDetail|Button|Modal|Dropdown|Tabs|AppLayout|DetailPanel|LayoutPanel|MetricsDashboard|AccessibilityChecker|AriaPatterns|AlertMessage)/i);
    if (titleMatch) return titleMatch[1];

    // Try to extract from file path
    if (file) {
      const fileMatch = file.match(/(SearchBar|ResultsList|EntryDetail|Button|Modal|Dropdown|Tabs|AppLayout|DetailPanel|LayoutPanel|MetricsDashboard|AccessibilityChecker|AriaPatterns|AlertMessage)/i);
      if (fileMatch) return fileMatch[1];
    }

    return null;
  }

  findComponentCategory(componentName) {
    for (const [category, components] of Object.entries(COMPONENT_CATEGORIES)) {
      if (components.includes(componentName)) {
        return category;
      }
    }
    return null;
  }

  determineTestType(test) {
    const title = test.title.toLowerCase();
    const file = (test.file || '').toLowerCase();

    if (title.includes('responsive') || file.includes('responsive')) return 'responsive';
    if (title.includes('theme') || title.includes('dark') || title.includes('contrast')) return 'themes';
    if (title.includes('cross-browser') || title.includes('firefox') || title.includes('webkit')) return 'crossBrowser';
    if (title.includes('accessibility') || title.includes('a11y')) return 'accessibility';

    return 'visual';
  }

  calculateCoveragePercentages() {
    for (const category of Object.keys(this.componentCoverage)) {
      let testedCount = 0;

      for (const component of Object.values(this.componentCoverage[category].components)) {
        if (Object.values(component).some(tested => tested)) {
          testedCount++;
        }
      }

      this.componentCoverage[category].tested = testedCount;
      this.componentCoverage[category].percentage = Math.round((testedCount / this.componentCoverage[category].total) * 100);
    }
  }

  identifyMissingTests() {
    for (const [category, categoryData] of Object.entries(this.componentCoverage)) {
      for (const [component, testTypes] of Object.entries(categoryData.components)) {
        const missingTypes = Object.entries(testTypes)
          .filter(([type, tested]) => !tested)
          .map(([type]) => type);

        if (missingTypes.length > 0) {
          this.missingTests.push({
            category,
            component,
            missingTypes
          });
        }
      }
    }
  }

  async generateHtmlReport() {
    console.log('📄 Generating HTML report...');

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Visual Regression Test Coverage Report</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
            line-height: 1.6;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 2rem;
            border-radius: 8px;
            margin-bottom: 2rem;
            text-align: center;
        }
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
            margin-bottom: 2rem;
        }
        .summary-card {
            background: white;
            padding: 1.5rem;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            text-align: center;
        }
        .summary-number {
            font-size: 2rem;
            font-weight: bold;
            margin-bottom: 0.5rem;
        }
        .passed { color: #10b981; }
        .failed { color: #ef4444; }
        .coverage { color: #3b82f6; }
        .section {
            background: white;
            padding: 2rem;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            margin-bottom: 2rem;
        }
        .section h2 {
            margin-top: 0;
            color: #1f2937;
            border-bottom: 2px solid #e5e7eb;
            padding-bottom: 0.5rem;
        }
        .test-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 1rem;
            margin-bottom: 2rem;
        }
        .test-category {
            border: 1px solid #e5e7eb;
            border-radius: 6px;
            padding: 1rem;
        }
        .category-header {
            font-weight: 600;
            color: #374151;
            margin-bottom: 1rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .category-stats {
            font-size: 0.875rem;
            color: #6b7280;
        }
        .test-list {
            font-size: 0.875rem;
        }
        .test-item {
            padding: 0.5rem 0;
            border-bottom: 1px solid #f3f4f6;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .test-item:last-child {
            border-bottom: none;
        }
        .status {
            padding: 0.125rem 0.5rem;
            border-radius: 4px;
            font-size: 0.75rem;
            font-weight: 500;
        }
        .status-passed {
            background-color: #dcfce7;
            color: #16a34a;
        }
        .status-failed {
            background-color: #fef2f2;
            color: #dc2626;
        }
        .coverage-bar {
            width: 100%;
            height: 8px;
            background: #e5e7eb;
            border-radius: 4px;
            overflow: hidden;
            margin: 0.5rem 0;
        }
        .coverage-fill {
            height: 100%;
            background: linear-gradient(90deg, #10b981, #059669);
            transition: width 0.3s ease;
        }
        .missing-tests {
            background: #fef3c7;
            border: 1px solid #f59e0b;
            border-radius: 6px;
            padding: 1rem;
            margin-top: 1rem;
        }
        .component-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 1rem;
        }
        .component-card {
            border: 1px solid #e5e7eb;
            border-radius: 6px;
            padding: 1rem;
        }
        .component-name {
            font-weight: 600;
            margin-bottom: 0.5rem;
        }
        .test-type {
            display: inline-block;
            padding: 0.125rem 0.5rem;
            margin: 0.125rem;
            border-radius: 4px;
            font-size: 0.75rem;
        }
        .test-type.covered {
            background: #dcfce7;
            color: #16a34a;
        }
        .test-type.missing {
            background: #fef2f2;
            color: #dc2626;
        }
        .footer {
            text-align: center;
            color: #6b7280;
            font-size: 0.875rem;
            margin-top: 2rem;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🎭 Visual Regression Test Coverage Report</h1>
        <p>Generated on ${new Date().toLocaleString()}</p>
    </div>

    <div class="summary">
        <div class="summary-card">
            <div class="summary-number passed">${this.getTotalPassed()}</div>
            <div>Tests Passed</div>
        </div>
        <div class="summary-card">
            <div class="summary-number failed">${this.getTotalFailed()}</div>
            <div>Tests Failed</div>
        </div>
        <div class="summary-card">
            <div class="summary-number">${this.getTotalTests()}</div>
            <div>Total Tests</div>
        </div>
        <div class="summary-card">
            <div class="summary-number coverage">${this.getOverallCoverage()}%</div>
            <div>Overall Coverage</div>
        </div>
    </div>

    ${this.generateTestResultsSection()}
    ${this.generateComponentCoverageSection()}
    ${this.generateMissingTestsSection()}

    <div class="footer">
        <p>Mainframe KB Assistant - Visual Regression Test Suite</p>
        <p>Target Coverage: Components ${COVERAGE_TARGETS.component}% | Responsive ${COVERAGE_TARGETS.responsive}% | Themes ${COVERAGE_TARGETS.themes}% | Cross-browser ${COVERAGE_TARGETS.crossBrowser}%</p>
    </div>
</body>
</html>`;

    fs.writeFileSync(OUTPUT_HTML, html);
  }

  generateTestResultsSection() {
    return `
    <div class="section">
        <h2>📊 Test Results by Category</h2>
        <div class="test-grid">
            ${Object.entries(this.results).map(([category, data]) => `
                <div class="test-category">
                    <div class="category-header">
                        <span>${this.getCategoryTitle(category)}</span>
                        <span class="category-stats">${data.passed}/${data.total}</span>
                    </div>
                    <div class="coverage-bar">
                        <div class="coverage-fill" style="width: ${data.total > 0 ? (data.passed / data.total) * 100 : 0}%"></div>
                    </div>
                    <div class="test-list">
                        ${data.tests.slice(0, 5).map(test => `
                            <div class="test-item">
                                <span>${test.title}</span>
                                <span class="status status-${test.status}">${test.status}</span>
                            </div>
                        `).join('')}
                        ${data.tests.length > 5 ? `<div style="text-align: center; color: #6b7280; font-size: 0.75rem; margin-top: 0.5rem;">... and ${data.tests.length - 5} more</div>` : ''}
                    </div>
                </div>
            `).join('')}
        </div>
    </div>`;
  }

  generateComponentCoverageSection() {
    return `
    <div class="section">
        <h2>🧩 Component Test Coverage</h2>
        <div class="component-grid">
            ${Object.entries(this.componentCoverage).map(([category, data]) => `
                <div class="component-card">
                    <div class="component-name">${this.getCategoryTitle(category)} (${data.percentage}%)</div>
                    <div class="coverage-bar">
                        <div class="coverage-fill" style="width: ${data.percentage}%"></div>
                    </div>
                    ${Object.entries(data.components).map(([component, tests]) => `
                        <div style="margin: 0.5rem 0;">
                            <strong>${component}</strong><br>
                            ${Object.entries(tests).map(([testType, covered]) => `
                                <span class="test-type ${covered ? 'covered' : 'missing'}">${testType}</span>
                            `).join('')}
                        </div>
                    `).join('')}
                </div>
            `).join('')}
        </div>
    </div>`;
  }

  generateMissingTestsSection() {
    if (this.missingTests.length === 0) {
      return `
        <div class="section">
            <h2>✅ Test Coverage Complete</h2>
            <p>All components have comprehensive visual test coverage!</p>
        </div>`;
    }

    return `
    <div class="section">
        <h2>⚠️ Missing Test Coverage</h2>
        <div class="missing-tests">
            <h3>Components needing additional tests:</h3>
            <ul>
                ${this.missingTests.map(missing => `
                    <li><strong>${missing.component}</strong> (${missing.category}): Missing ${missing.missingTypes.join(', ')}</li>
                `).join('')}
            </ul>
        </div>
    </div>`;
  }

  getCategoryTitle(category) {
    const titles = {
      desktop: 'Desktop Visual',
      responsive: 'Responsive Design',
      themes: 'Theme Variations',
      crossBrowser: 'Cross-browser',
      accessibility: 'Accessibility Visual',
      forms: 'Form Components',
      display: 'Display Components',
      navigation: 'Navigation Components',
      interactive: 'Interactive Components'
    };
    return titles[category] || category;
  }

  getTotalPassed() {
    return Object.values(this.results).reduce((sum, category) => sum + category.passed, 0);
  }

  getTotalFailed() {
    return Object.values(this.results).reduce((sum, category) => sum + category.failed, 0);
  }

  getTotalTests() {
    return this.getTotalPassed() + this.getTotalFailed();
  }

  getOverallCoverage() {
    const totalCoverage = Object.values(this.componentCoverage).reduce((sum, category) => sum + category.percentage, 0);
    return Math.round(totalCoverage / Object.keys(this.componentCoverage).length);
  }

  async generateJsonSummary() {
    const summary = {
      timestamp: new Date().toISOString(),
      overall: {
        passed: this.getTotalPassed(),
        failed: this.getTotalFailed(),
        total: this.getTotalTests(),
        coverage: this.getOverallCoverage()
      },
      desktop: this.getCategorySummary('desktop'),
      responsive: this.getCategorySummary('responsive'),
      themes: this.getCategorySummary('themes'),
      crossBrowser: this.getCategorySummary('crossBrowser'),
      accessibility: this.getCategorySummary('accessibility'),
      componentCoverage: this.componentCoverage,
      missingTests: this.missingTests,
      targets: COVERAGE_TARGETS
    };

    fs.writeFileSync(OUTPUT_JSON, JSON.stringify(summary, null, 2));
  }

  getCategorySummary(category) {
    const data = this.results[category];
    return {
      passed: data.passed,
      failed: data.failed,
      total: data.total,
      coverage: data.total > 0 ? Math.round((data.passed / data.total) * 100) : 0
    };
  }
}

// Main execution
if (require.main === module) {
  const analyzer = new VisualCoverageAnalyzer();
  analyzer.analyzeResults().catch(console.error);
}

module.exports = VisualCoverageAnalyzer;