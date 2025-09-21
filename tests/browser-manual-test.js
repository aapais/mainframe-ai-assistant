const { exec } = require('child_process');
const fs = require('fs').promises;
const util = require('util');

const execAsync = util.promisify(exec);

class ManualBrowserTester {
  constructor() {
    this.testResults = [];
    this.screenshotDir = '/mnt/c/mainframe-ai-assistant/test-results/screenshots';
    this.reportPath = '/mnt/c/mainframe-ai-assistant/test-results/manual-test-report.json';
  }

  async initialize() {
    // Create directories
    await fs.mkdir(this.screenshotDir, { recursive: true });
    console.log('📁 Test directories created');
  }

  async testApplicationConnectivity() {
    console.log('🌐 Testing application connectivity...');

    try {
      // Test basic connectivity
      const { stdout, stderr } = await execAsync('curl -s -o /dev/null -w "%{http_code}" http://localhost:3002');
      const statusCode = stdout.trim();

      console.log(`📊 HTTP Status: ${statusCode}`);

      // Get page content
      const { stdout: content } = await execAsync('curl -s http://localhost:3002');

      // Analyze HTML content
      const hasTitle = content.includes('<title>');
      const hasReact = content.includes('react') || content.includes('React');
      const hasVite = content.includes('vite') || content.includes('@vite');
      const hasScripts = content.includes('<script');

      const analysis = {
        statusCode: parseInt(statusCode),
        contentLength: content.length,
        hasTitle,
        hasReact,
        hasVite,
        hasScripts,
        title: this.extractTitle(content)
      };

      console.log('📋 Content Analysis:', analysis);

      const testResult = {
        test: 'Application Connectivity',
        status: statusCode === '200' ? 'PASS' : 'FAIL',
        details: analysis,
        timestamp: new Date().toISOString()
      };

      this.testResults.push(testResult);
      return testResult;

    } catch (error) {
      console.error('❌ Connectivity test failed:', error.message);

      const testResult = {
        test: 'Application Connectivity',
        status: 'FAIL',
        error: error.message,
        timestamp: new Date().toISOString()
      };

      this.testResults.push(testResult);
      return testResult;
    }
  }

  extractTitle(html) {
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    return titleMatch ? titleMatch[1] : 'No title found';
  }

  async testUIStructure() {
    console.log('🏗️ Testing UI structure via HTML analysis...');

    try {
      const { stdout: content } = await execAsync('curl -s http://localhost:3002');

      // Look for navigation elements
      const hasNav = content.includes('<nav') || content.includes('nav') || content.includes('navigation');
      const hasHeader = content.includes('<header') || content.includes('header');
      const hasMain = content.includes('<main') || content.includes('main');

      // Look for button elements
      const buttonCount = (content.match(/<button/gi) || []).length;
      const linkCount = (content.match(/<a\s+href/gi) || []).length;

      // Look for modal-related elements
      const hasModalTerms = content.toLowerCase().includes('modal') ||
                           content.toLowerCase().includes('dialog') ||
                           content.toLowerCase().includes('popup');

      // Look for form elements
      const hasForm = content.includes('<form') || content.includes('form');
      const hasInput = content.includes('<input') || content.includes('input');

      const structure = {
        hasNav,
        hasHeader,
        hasMain,
        buttonCount,
        linkCount,
        hasModalTerms,
        hasForm,
        hasInput,
        totalLength: content.length
      };

      console.log('🏗️ UI Structure Analysis:', structure);

      const testResult = {
        test: 'UI Structure Analysis',
        status: buttonCount > 0 && linkCount > 0 ? 'PASS' : 'WARN',
        details: structure,
        timestamp: new Date().toISOString()
      };

      this.testResults.push(testResult);
      return testResult;

    } catch (error) {
      console.error('❌ UI structure test failed:', error.message);

      const testResult = {
        test: 'UI Structure Analysis',
        status: 'FAIL',
        error: error.message,
        timestamp: new Date().toISOString()
      };

      this.testResults.push(testResult);
      return testResult;
    }
  }

  async testRoutingStructure() {
    console.log('🗺️ Testing routing structure...');

    const routes = [
      '/',
      '/incidents',
      '/dashboard',
      '/settings'
    ];

    const routeResults = [];

    for (const route of routes) {
      try {
        const url = `http://localhost:3002${route}`;
        const { stdout } = await execAsync(`curl -s -o /dev/null -w "%{http_code}" "${url}"`);
        const statusCode = parseInt(stdout.trim());

        routeResults.push({
          route,
          statusCode,
          accessible: statusCode < 400
        });

        console.log(`🗺️ Route ${route}: ${statusCode}`);

      } catch (error) {
        routeResults.push({
          route,
          error: error.message,
          accessible: false
        });
      }
    }

    const accessibleRoutes = routeResults.filter(r => r.accessible).length;

    const testResult = {
      test: 'Routing Structure',
      status: accessibleRoutes >= 2 ? 'PASS' : 'WARN',
      accessibleRoutes,
      totalRoutes: routes.length,
      routes: routeResults,
      timestamp: new Date().toISOString()
    };

    this.testResults.push(testResult);
    return testResult;
  }

  async testConsoleErrors() {
    console.log('🚨 Testing for JavaScript errors...');

    try {
      // Create a simple HTML file to test the app in headless mode
      const testHtml = `
<!DOCTYPE html>
<html>
<head>
    <title>Browser Test</title>
</head>
<body>
    <iframe src="http://localhost:3002" width="100%" height="600" onload="checkFrame()"></iframe>
    <script>
        function checkFrame() {
            console.log('Frame loaded successfully');
        }

        window.onerror = function(msg, url, line, col, error) {
            console.error('JavaScript Error:', msg, 'at', url, ':', line);
            return false;
        };
    </script>
</body>
</html>`;

      await fs.writeFile('/mnt/c/mainframe-ai-assistant/test-results/test-frame.html', testHtml);

      const testResult = {
        test: 'Console Error Detection',
        status: 'INFO',
        message: 'Manual verification required - check browser console',
        testFile: 'test-frame.html',
        timestamp: new Date().toISOString()
      };

      this.testResults.push(testResult);
      return testResult;

    } catch (error) {
      const testResult = {
        test: 'Console Error Detection',
        status: 'FAIL',
        error: error.message,
        timestamp: new Date().toISOString()
      };

      this.testResults.push(testResult);
      return testResult;
    }
  }

  async generateReport() {
    console.log('📊 Generating test report...');

    const summary = {
      totalTests: this.testResults.length,
      passed: this.testResults.filter(t => t.status === 'PASS').length,
      failed: this.testResults.filter(t => t.status === 'FAIL').length,
      warnings: this.testResults.filter(t => t.status === 'WARN').length,
      info: this.testResults.filter(t => t.status === 'INFO').length
    };

    const report = {
      timestamp: new Date().toISOString(),
      testSuite: 'Manual Browser Testing',
      summary,
      testResults: this.testResults,
      recommendations: this.generateRecommendations()
    };

    await fs.writeFile(this.reportPath, JSON.stringify(report, null, 2));

    console.log('📋 Report saved to:', this.reportPath);
    console.log('📊 Summary:', summary);

    return report;
  }

  generateRecommendations() {
    const recommendations = [];

    if (this.testResults.some(t => t.status === 'FAIL')) {
      recommendations.push('🚨 Critical issues detected - immediate attention required');
    }

    if (this.testResults.some(t => t.status === 'WARN')) {
      recommendations.push('⚠️ Warning conditions found - review recommended');
    }

    const connectivityTest = this.testResults.find(t => t.test === 'Application Connectivity');
    if (connectivityTest && connectivityTest.details?.statusCode !== 200) {
      recommendations.push('🌐 Application not responding properly - check server status');
    }

    return recommendations;
  }

  async runAllTests() {
    try {
      await this.initialize();

      console.log('🚀 Starting manual browser testing suite...\n');

      // Run all tests
      await this.testApplicationConnectivity();
      await this.testUIStructure();
      await this.testRoutingStructure();
      await this.testConsoleErrors();

      // Generate report
      const report = await this.generateReport();

      console.log('\n✅ Manual testing completed!');
      return report;

    } catch (error) {
      console.error('❌ Testing suite failed:', error);
      throw error;
    }
  }
}

// Run the tests
if (require.main === module) {
  const tester = new ManualBrowserTester();
  tester.runAllTests()
    .then(report => {
      console.log('🎉 All tests completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Testing failed:', error);
      process.exit(1);
    });
}

module.exports = ManualBrowserTester;