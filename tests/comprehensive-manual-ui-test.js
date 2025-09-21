const { exec } = require('child_process');
const fs = require('fs').promises;
const util = require('util');

const execAsync = util.promisify(exec);

class ComprehensiveUITester {
  constructor() {
    this.testResults = [];
    this.issuesFound = [];
    this.screenshotDir = '/mnt/c/mainframe-ai-assistant/test-results/screenshots';
    this.baseUrl = 'http://localhost:3002';
  }

  async initialize() {
    await fs.mkdir(this.screenshotDir, { recursive: true });
    console.log('🔧 Comprehensive UI testing initialized');
  }

  async analyzeApplicationStructure() {
    console.log('🏗️ Analyzing complete application structure...');

    try {
      // Get the main page content
      const { stdout: content } = await execAsync(`curl -s "${this.baseUrl}"`);

      // Check for SPA indicators
      const isSPA = content.includes('data-reactroot') ||
                   content.includes('id="root"') ||
                   content.includes('id="app"') ||
                   content.includes('__REACT_HOT_LOADER__');

      // Check for routing
      const hasRouter = content.includes('router') ||
                       content.includes('react-router') ||
                       content.includes('history');

      // Check for state management
      const hasRedux = content.includes('redux') || content.includes('Redux');
      const hasContext = content.includes('context') || content.includes('Context');

      // Look for module loading
      const hasVite = content.includes('@vite/client') || content.includes('vite');
      const hasWebpack = content.includes('webpack') || content.includes('__webpack');

      console.log('📊 Application Analysis:');
      console.log(`   📱 SPA: ${isSPA ? 'Yes' : 'No'}`);
      console.log(`   🗺️ Router: ${hasRouter ? 'Yes' : 'No'}`);
      console.log(`   🏪 Redux: ${hasRedux ? 'Yes' : 'No'}`);
      console.log(`   🎯 Context: ${hasContext ? 'Yes' : 'No'}`);
      console.log(`   ⚡ Vite: ${hasVite ? 'Yes' : 'No'}`);
      console.log(`   📦 Webpack: ${hasWebpack ? 'Yes' : 'No'}`);

      const analysisResult = {
        test: 'Application Structure Analysis',
        status: 'INFO',
        details: {
          isSPA,
          hasRouter,
          hasRedux,
          hasContext,
          hasVite,
          hasWebpack,
          contentLength: content.length
        }
      };

      this.testResults.push(analysisResult);
      return analysisResult;

    } catch (error) {
      console.error('❌ Structure analysis failed:', error.message);
      return { test: 'Application Structure Analysis', status: 'FAIL', error: error.message };
    }
  }

  async testAllRoutes() {
    console.log('🗺️ Testing all application routes thoroughly...');

    const routes = [
      { path: '/', name: 'Root/Dashboard' },
      { path: '/dashboard', name: 'Dashboard' },
      { path: '/incidents', name: 'Incidents List' },
      { path: '/incident/create', name: 'Create Incident' },
      { path: '/settings', name: 'Settings' },
      { path: '/nonexistent', name: 'Not Found (404 test)' }
    ];

    const routeResults = [];

    for (const route of routes) {
      try {
        console.log(`🔍 Testing route: ${route.path}`);

        const url = `${this.baseUrl}${route.path}`;
        const { stdout } = await execAsync(`curl -s -o /dev/null -w "%{http_code}:%{time_total}" "${url}"`);
        const [statusCode, timeTotal] = stdout.trim().split(':');

        // Get content for analysis
        const { stdout: content } = await execAsync(`curl -s "${url}"`);

        // Analyze content
        const hasError = content.toLowerCase().includes('error') ||
                        content.toLowerCase().includes('404') ||
                        content.toLowerCase().includes('not found');

        const hasContent = content.length > 1000; // Minimum content threshold

        routeResults.push({
          ...route,
          statusCode: parseInt(statusCode),
          responseTime: parseFloat(timeTotal),
          hasError,
          hasContent,
          contentLength: content.length,
          accessible: parseInt(statusCode) < 400 && !hasError
        });

        console.log(`   📊 ${route.path}: ${statusCode} (${timeTotal}s)`);

      } catch (error) {
        routeResults.push({
          ...route,
          error: error.message,
          accessible: false
        });
      }
    }

    const accessibleRoutes = routeResults.filter(r => r.accessible).length;
    const avgResponseTime = routeResults
      .filter(r => r.responseTime)
      .reduce((acc, r) => acc + r.responseTime, 0) / routeResults.length;

    const testResult = {
      test: 'Route Testing',
      status: accessibleRoutes >= 3 ? 'PASS' : 'WARN',
      accessibleRoutes,
      totalRoutes: routes.length,
      avgResponseTime,
      routeResults
    };

    this.testResults.push(testResult);

    if (accessibleRoutes < 3) {
      this.issuesFound.push({
        severity: 'WARNING',
        category: 'Navigation',
        issue: `Only ${accessibleRoutes} out of ${routes.length} routes are accessible`,
        impact: 'Users may not be able to navigate to all sections'
      });
    }

    return testResult;
  }

  async analyzeUIComponents() {
    console.log('🧩 Analyzing UI components and structure...');

    try {
      // Get the incidents page to analyze UI
      const { stdout: incidentsContent } = await execAsync(`curl -s "${this.baseUrl}/incidents"`);

      // Check for UI framework patterns
      const hasMaterialUI = incidentsContent.includes('mui') ||
                           incidentsContent.includes('material-ui') ||
                           incidentsContent.includes('Material');

      const hasBootstrap = incidentsContent.includes('bootstrap') ||
                          incidentsContent.includes('Bootstrap');

      const hasTailwind = incidentsContent.includes('tailwind') ||
                         incidentsContent.includes('Tailwind');

      const hasChakra = incidentsContent.includes('chakra') ||
                       incidentsContent.includes('Chakra');

      // Look for component patterns in the rendered HTML
      const componentPatterns = {
        buttons: (incidentsContent.match(/<button/gi) || []).length,
        forms: (incidentsContent.match(/<form/gi) || []).length,
        inputs: (incidentsContent.match(/<input/gi) || []).length,
        modals: (incidentsContent.match(/modal|dialog/gi) || []).length,
        tables: (incidentsContent.match(/<table/gi) || []).length,
        lists: (incidentsContent.match(/<ul|<ol|<li/gi) || []).length
      };

      console.log('🎨 UI Framework Analysis:');
      console.log(`   🎭 Material-UI: ${hasMaterialUI ? 'Yes' : 'No'}`);
      console.log(`   🥾 Bootstrap: ${hasBootstrap ? 'Yes' : 'No'}`);
      console.log(`   🌊 Tailwind: ${hasTailwind ? 'Yes' : 'No'}`);
      console.log(`   ⚡ Chakra UI: ${hasChakra ? 'Yes' : 'No'}`);

      console.log('🧩 Component Count:');
      Object.entries(componentPatterns).forEach(([type, count]) => {
        console.log(`   ${type}: ${count}`);
      });

      const testResult = {
        test: 'UI Component Analysis',
        status: componentPatterns.buttons > 0 ? 'PASS' : 'WARN',
        frameworks: { hasMaterialUI, hasBootstrap, hasTailwind, hasChakra },
        componentPatterns
      };

      this.testResults.push(testResult);

      // Check for potential UI issues
      if (componentPatterns.buttons === 0) {
        this.issuesFound.push({
          severity: 'ERROR',
          category: 'UI Components',
          issue: 'No buttons found in the application',
          impact: 'Users cannot interact with the application'
        });
      }

      if (componentPatterns.modals === 0) {
        this.issuesFound.push({
          severity: 'WARNING',
          category: 'Modal Functionality',
          issue: 'No modal components detected',
          impact: 'Modal-based workflows may not be working'
        });
      }

      return testResult;

    } catch (error) {
      const testResult = {
        test: 'UI Component Analysis',
        status: 'FAIL',
        error: error.message
      };

      this.testResults.push(testResult);
      return testResult;
    }
  }

  async testJavaScriptExecution() {
    console.log('🟨 Testing JavaScript execution and errors...');

    try {
      // Create a simple test HTML that loads the application
      const testHTML = `
<!DOCTYPE html>
<html>
<head>
    <title>JS Test</title>
    <style>
        iframe { width: 100%; height: 600px; border: 1px solid #ccc; }
        .results { margin: 20px 0; padding: 10px; background: #f5f5f5; }
    </style>
</head>
<body>
    <h1>JavaScript Execution Test</h1>
    <div class="results" id="results">Loading...</div>
    <iframe src="${this.baseUrl}" id="appFrame"></iframe>

    <script>
        let jsErrors = [];
        let loadComplete = false;

        // Capture errors
        window.onerror = function(msg, url, line, col, error) {
            jsErrors.push({
                message: msg,
                url: url,
                line: line,
                column: col,
                error: error ? error.toString() : 'Unknown error'
            });
            updateResults();
            return false;
        };

        window.addEventListener('unhandledrejection', function(event) {
            jsErrors.push({
                message: 'Unhandled Promise Rejection',
                error: event.reason ? event.reason.toString() : 'Unknown promise rejection'
            });
            updateResults();
        });

        // Monitor iframe load
        document.getElementById('appFrame').addEventListener('load', function() {
            loadComplete = true;
            setTimeout(updateResults, 2000); // Wait 2 seconds for any delayed errors
        });

        function updateResults() {
            const results = document.getElementById('results');
            results.innerHTML = \`
                <h3>Test Results</h3>
                <p><strong>Load Complete:</strong> \${loadComplete ? 'Yes' : 'No'}</p>
                <p><strong>JavaScript Errors:</strong> \${jsErrors.length}</p>
                \${jsErrors.length > 0 ? '<h4>Errors:</h4><ul>' + jsErrors.map(err =>
                    \`<li><strong>\${err.message}</strong> - \${err.url || 'Unknown URL'} (\${err.line || 'Unknown line'})</li>\`
                ).join('') + '</ul>' : '<p style="color: green;">No errors detected!</p>'}
            \`;
        }

        // Initial update
        setTimeout(updateResults, 1000);
    </script>
</body>
</html>`;

      const testFilePath = '/mnt/c/mainframe-ai-assistant/test-results/js-test.html';
      await fs.writeFile(testFilePath, testHTML);

      console.log(`📄 JavaScript test file created: ${testFilePath}`);

      const testResult = {
        test: 'JavaScript Execution Test',
        status: 'INFO',
        message: 'Test file created - manual verification required',
        testFile: testFilePath,
        instructions: [
          '1. Open the test file in a browser',
          '2. Wait for the application to load in the iframe',
          '3. Check for any JavaScript errors displayed',
          '4. Verify the application loads and renders correctly'
        ]
      };

      this.testResults.push(testResult);
      return testResult;

    } catch (error) {
      const testResult = {
        test: 'JavaScript Execution Test',
        status: 'FAIL',
        error: error.message
      };

      this.testResults.push(testResult);
      return testResult;
    }
  }

  async validateUIExpectations() {
    console.log('✅ Validating UI expectations based on application structure...');

    const expectations = [
      {
        name: 'Modal Functionality',
        description: 'Create incident modal should open and close properly',
        expected: 'Modal opens with create button, closes with X, ESC, or backdrop click'
      },
      {
        name: 'Tab Navigation',
        description: 'Only Dashboard and Incidents tabs should be present',
        expected: 'Exactly 2 navigation tabs visible'
      },
      {
        name: 'Scroll Behavior',
        description: 'Page scroll should be preserved during navigation',
        expected: 'Scroll position maintained between route changes'
      },
      {
        name: 'Responsive Design',
        description: 'Application should work on different screen sizes',
        expected: 'UI adapts to viewport changes'
      }
    ];

    const validationResults = expectations.map(expectation => ({
      ...expectation,
      status: 'PENDING',
      note: 'Requires interactive browser testing to validate'
    }));

    const testResult = {
      test: 'UI Expectations Validation',
      status: 'INFO',
      expectations: validationResults,
      recommendations: [
        'Use Playwright or Puppeteer for interactive testing',
        'Test modal interactions with actual button clicks',
        'Verify tab navigation behavior',
        'Check scroll preservation across routes',
        'Test responsive design with viewport changes'
      ]
    };

    this.testResults.push(testResult);
    return testResult;
  }

  async generateComprehensiveReport() {
    console.log('📊 Generating comprehensive UI test report...');

    const summary = {
      totalTests: this.testResults.length,
      passed: this.testResults.filter(t => t.status === 'PASS').length,
      failed: this.testResults.filter(t => t.status === 'FAIL').length,
      warnings: this.testResults.filter(t => t.status === 'WARN').length,
      info: this.testResults.filter(t => t.status === 'INFO').length,
      issuesFound: this.issuesFound.length
    };

    const report = {
      timestamp: new Date().toISOString(),
      testSuite: 'Comprehensive Manual UI Testing',
      applicationUrl: this.baseUrl,
      summary,
      testResults: this.testResults,
      issuesFound: this.issuesFound,
      recommendations: [
        '🔧 Install and configure Playwright/Puppeteer for interactive testing',
        '🧪 Run automated tests for modal functionality',
        '🧭 Verify navigation tab count and behavior',
        '📱 Test responsive design across different viewports',
        '🎯 Check JavaScript console for runtime errors',
        '⚡ Optimize performance if response times are slow'
      ],
      nextSteps: [
        'Set up automated browser testing environment',
        'Create test cases for modal interactions',
        'Implement navigation flow tests',
        'Add performance monitoring',
        'Set up error tracking and reporting'
      ]
    };

    const reportPath = '/mnt/c/mainframe-ai-assistant/test-results/comprehensive-ui-test-report.json';
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

    // Create a human-readable summary
    const summaryText = `
# Comprehensive UI Testing Report

## Summary
- 📊 Total Tests: ${summary.totalTests}
- ✅ Passed: ${summary.passed}
- ❌ Failed: ${summary.failed}
- ⚠️ Warnings: ${summary.warnings}
- ℹ️ Info: ${summary.info}
- 🚨 Issues Found: ${summary.issuesFound}

## Key Findings

${this.issuesFound.map(issue => `
### ${issue.severity}: ${issue.category}
**Issue:** ${issue.issue}
**Impact:** ${issue.impact}
`).join('')}

## Test Results

${this.testResults.map(test => `
### ${test.test}
**Status:** ${test.status}
${test.error ? `**Error:** ${test.error}` : ''}
${test.details ? `**Details:** ${JSON.stringify(test.details, null, 2)}` : ''}
`).join('')}

## Recommendations

${report.recommendations.map(rec => `- ${rec}`).join('\n')}

## Next Steps

${report.nextSteps.map(step => `1. ${step}`).join('\n')}

---
Generated: ${report.timestamp}
`;

    const summaryPath = '/mnt/c/mainframe-ai-assistant/test-results/UI_TEST_SUMMARY.md';
    await fs.writeFile(summaryPath, summaryText);

    console.log('📋 Comprehensive report saved to:', reportPath);
    console.log('📝 Summary saved to:', summaryPath);
    console.log('📊 Summary:', summary);

    return report;
  }

  async runCompleteTestSuite() {
    try {
      await this.initialize();

      console.log('🚀 Starting comprehensive manual UI testing suite...\n');

      await this.analyzeApplicationStructure();
      await this.testAllRoutes();
      await this.analyzeUIComponents();
      await this.testJavaScriptExecution();
      await this.validateUIExpectations();

      const report = await this.generateComprehensiveReport();

      console.log('\n🎯 COMPREHENSIVE UI TESTING COMPLETE!');
      console.log(`📊 Summary: ${report.summary.passed} passed, ${report.summary.failed} failed, ${report.summary.warnings} warnings`);
      console.log(`🚨 Issues found: ${report.summary.issuesFound}`);

      return report;

    } catch (error) {
      console.error('❌ Comprehensive testing failed:', error);
      throw error;
    }
  }
}

// Run the tests
if (require.main === module) {
  const tester = new ComprehensiveUITester();
  tester.runCompleteTestSuite()
    .then(report => {
      console.log('🎉 Comprehensive UI testing completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Testing failed:', error);
      process.exit(1);
    });
}

module.exports = ComprehensiveUITester;