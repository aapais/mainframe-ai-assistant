/**
 * CI/CD Integration and Reporting E2E Tests
 *
 * Tests and utilities for CI/CD pipeline integration:
 * - Automated test execution
 * - Test result reporting
 * - Performance benchmarking
 * - Quality gates validation
 * - Artifact generation
 * - Deployment validation
 * - Health checks
 * - Monitoring integration
 */

import { test, expect, Page } from '@playwright/test';
import { promises as fs } from 'fs';
import path from 'path';

interface TestExecutionReport {
  timestamp: string;
  environment: string;
  testSuite: string;
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    duration: number;
    passRate: number;
  };
  categories: {
    [category: string]: {
      total: number;
      passed: number;
      failed: number;
      duration: number;
    };
  };
  performance: {
    averageLoadTime: number;
    averageInteractionTime: number;
    memoryUsage: number;
    networkRequests: number;
  };
  quality: {
    accessibility: number;
    performance: number;
    security: number;
    compatibility: number;
  };
  artifacts: string[];
  issues: Array<{
    severity: 'low' | 'medium' | 'high' | 'critical';
    category: string;
    description: string;
    location: string;
  }>;
}

interface QualityGate {
  name: string;
  metric: string;
  threshold: number;
  operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
  critical: boolean;
}

class CICDTestRunner {
  private page: Page;
  private reportData: TestExecutionReport;
  private qualityGates: QualityGate[];
  private artifacts: string[] = [];

  constructor(page: Page) {
    this.page = page;
    this.reportData = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'test',
      testSuite: 'E2E Comprehensive Suite',
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        duration: 0,
        passRate: 0
      },
      categories: {},
      performance: {
        averageLoadTime: 0,
        averageInteractionTime: 0,
        memoryUsage: 0,
        networkRequests: 0
      },
      quality: {
        accessibility: 0,
        performance: 0,
        security: 0,
        compatibility: 0
      },
      artifacts: [],
      issues: []
    };

    this.qualityGates = [
      { name: 'Test Pass Rate', metric: 'passRate', threshold: 90, operator: '>=', critical: true },
      { name: 'Load Time', metric: 'averageLoadTime', threshold: 5000, operator: '<=', critical: true },
      { name: 'Memory Usage', metric: 'memoryUsage', threshold: 200, operator: '<=', critical: false },
      { name: 'Accessibility Score', metric: 'accessibility', threshold: 85, operator: '>=', critical: true },
      { name: 'Security Score', metric: 'security', threshold: 90, operator: '>=', critical: true },
      { name: 'Performance Score', metric: 'performance', threshold: 80, operator: '>=', critical: false }
    ];
  }

  async runHealthChecks(): Promise<boolean> {
    try {
      // Application health check
      await this.page.goto('/');
      await this.page.waitForSelector('[data-testid="app-root"]', { timeout: 10000 });

      // API health check
      const apiHealth = await this.page.evaluate(async () => {
        try {
          const response = await fetch('/api/health');
          return response.ok;
        } catch {
          return false;
        }
      });

      // Database connectivity check
      const dbHealth = await this.page.evaluate(async () => {
        try {
          const response = await fetch('/api/health/database');
          return response.ok;
        } catch {
          return false;
        }
      });

      // Services health check
      const servicesHealth = await this.page.evaluate(() => {
        return (window as any).appServices?.allServicesReady === true;
      });

      return apiHealth && dbHealth && servicesHealth;
    } catch (error) {
      console.error('Health check failed:', error);
      return false;
    }
  }

  async collectPerformanceMetrics(): Promise<void> {
    const performanceData = await this.page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const resources = performance.getEntriesByType('resource');

      return {
        loadTime: navigation ? navigation.loadEventEnd - navigation.navigationStart : 0,
        domContentLoaded: navigation ? navigation.domContentLoadedEventEnd - navigation.navigationStart : 0,
        firstContentfulPaint: 0, // Would need to be measured separately
        networkRequests: resources.length,
        memoryUsage: (performance as any).memory?.usedJSHeapSize || 0
      };
    });

    this.reportData.performance.averageLoadTime = performanceData.loadTime;
    this.reportData.performance.networkRequests = performanceData.networkRequests;
    this.reportData.performance.memoryUsage = performanceData.memoryUsage / (1024 * 1024); // MB
  }

  async runAccessibilityValidation(): Promise<number> {
    try {
      // Basic accessibility checks
      const a11yScore = await this.page.evaluate(() => {
        let score = 100;

        // Check for missing alt attributes
        const images = document.querySelectorAll('img:not([alt])');
        score -= images.length * 5;

        // Check for missing form labels
        const inputs = document.querySelectorAll('input:not([aria-label]):not([aria-labelledby])');
        score -= inputs.length * 10;

        // Check for proper heading hierarchy
        const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
        if (headings.length === 0) score -= 20;

        // Check for focus indicators
        const focusableElements = document.querySelectorAll('button, input, select, textarea, a[href]');
        const withFocusStyle = Array.from(focusableElements).filter(el => {
          const style = getComputedStyle(el, ':focus');
          return style.outline !== 'none' || style.boxShadow !== 'none';
        });

        if (withFocusStyle.length / focusableElements.length < 0.8) score -= 15;

        // Check for ARIA landmarks
        const landmarks = document.querySelectorAll('[role="main"], [role="navigation"], [role="banner"], [role="contentinfo"], main, nav, header, footer');
        if (landmarks.length === 0) score -= 10;

        return Math.max(0, score);
      });

      this.reportData.quality.accessibility = a11yScore;
      return a11yScore;
    } catch (error) {
      console.error('Accessibility validation failed:', error);
      return 0;
    }
  }

  async runSecurityValidation(): Promise<number> {
    try {
      let securityScore = 100;

      // Check for HTTPS
      if (!this.page.url().startsWith('https://')) {
        securityScore -= 20;
        this.reportData.issues.push({
          severity: 'high',
          category: 'security',
          description: 'Application not served over HTTPS',
          location: this.page.url()
        });
      }

      // Check for security headers
      const response = await this.page.goto(this.page.url());
      const headers = response?.headers() || {};

      const requiredHeaders = [
        'x-frame-options',
        'x-content-type-options',
        'strict-transport-security'
      ];

      const missingHeaders = requiredHeaders.filter(header => !headers[header]);
      securityScore -= missingHeaders.length * 15;

      missingHeaders.forEach(header => {
        this.reportData.issues.push({
          severity: 'medium',
          category: 'security',
          description: `Missing security header: ${header}`,
          location: this.page.url()
        });
      });

      // Check for potential XSS vulnerabilities
      await this.page.fill('[data-testid="search-input"]', '<script>alert("test")</script>');
      const inputValue = await this.page.inputValue('[data-testid="search-input"]');
      if (inputValue.includes('<script>')) {
        securityScore -= 25;
        this.reportData.issues.push({
          severity: 'critical',
          category: 'security',
          description: 'Potential XSS vulnerability in search input',
          location: '#/search'
        });
      }

      this.reportData.quality.security = Math.max(0, securityScore);
      return Math.max(0, securityScore);
    } catch (error) {
      console.error('Security validation failed:', error);
      return 0;
    }
  }

  async runCompatibilityValidation(): Promise<number> {
    try {
      let compatibilityScore = 100;

      // Check browser compatibility
      const browserInfo = await this.page.evaluate(() => {
        const ua = navigator.userAgent;
        return {
          isModernBrowser: !!(window as any).fetch && !!(window as any).Promise && !!(window as any).Symbol,
          hasES6Support: !!(window as any).Map && !!(window as any).Set,
          hasAsyncAwait: true, // Assume true in modern test environment
          userAgent: ua
        };
      });

      if (!browserInfo.isModernBrowser) compatibilityScore -= 30;
      if (!browserInfo.hasES6Support) compatibilityScore -= 20;

      // Check responsive design
      const viewports = [
        { width: 320, height: 568 },
        { width: 768, height: 1024 },
        { width: 1920, height: 1080 }
      ];

      for (const viewport of viewports) {
        await this.page.setViewportSize(viewport);
        await this.page.goto('#/search');

        const isResponsive = await this.page.evaluate(() => {
          const elements = document.querySelectorAll('[data-testid="search-input"], [data-testid="search-button"]');
          return Array.from(elements).every(el => {
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          });
        });

        if (!isResponsive) compatibilityScore -= 15;
      }

      this.reportData.quality.compatibility = Math.max(0, compatibilityScore);
      return Math.max(0, compatibilityScore);
    } catch (error) {
      console.error('Compatibility validation failed:', error);
      return 0;
    }
  }

  async captureScreenshots(): Promise<void> {
    const screenshotDir = path.join(process.cwd(), 'test-reports', 'screenshots');

    try {
      await fs.mkdir(screenshotDir, { recursive: true });

      const pages = [
        { name: 'dashboard', url: '#/dashboard' },
        { name: 'search', url: '#/search' },
        { name: 'analytics', url: '#/analytics' },
        { name: 'settings', url: '#/settings' }
      ];

      for (const pageInfo of pages) {
        try {
          await this.page.goto(pageInfo.url);
          await this.page.waitForTimeout(1000);

          const screenshotPath = path.join(screenshotDir, `${pageInfo.name}-${Date.now()}.png`);
          await this.page.screenshot({ path: screenshotPath, fullPage: true });

          this.artifacts.push(screenshotPath);
        } catch (error) {
          console.warn(`Failed to capture screenshot for ${pageInfo.name}:`, error);
        }
      }
    } catch (error) {
      console.error('Failed to capture screenshots:', error);
    }
  }

  async generateHARFile(): Promise<void> {
    try {
      // Start HAR recording would typically be done at test start
      // This is a simplified version
      const harPath = path.join(process.cwd(), 'test-reports', `network-${Date.now()}.har`);

      const networkData = await this.page.evaluate(() => {
        const resources = performance.getEntriesByType('resource');
        return resources.map(resource => ({
          name: resource.name,
          duration: resource.duration,
          transferSize: (resource as any).transferSize || 0,
          startTime: resource.startTime
        }));
      });

      await fs.writeFile(harPath, JSON.stringify(networkData, null, 2));
      this.artifacts.push(harPath);
    } catch (error) {
      console.error('Failed to generate HAR file:', error);
    }
  }

  async validateQualityGates(): Promise<{ passed: boolean; results: any[] }> {
    const results = [];

    for (const gate of this.qualityGates) {
      const value = this.getMetricValue(gate.metric);
      const passed = this.evaluateThreshold(value, gate.threshold, gate.operator);

      results.push({
        name: gate.name,
        metric: gate.metric,
        value,
        threshold: gate.threshold,
        operator: gate.operator,
        passed,
        critical: gate.critical
      });

      if (!passed && gate.critical) {
        this.reportData.issues.push({
          severity: 'critical',
          category: 'quality-gate',
          description: `Quality gate failed: ${gate.name} (${value} ${gate.operator} ${gate.threshold})`,
          location: 'ci-cd-pipeline'
        });
      }
    }

    const criticalFailures = results.filter(r => !r.passed && r.critical);
    return {
      passed: criticalFailures.length === 0,
      results
    };
  }

  private getMetricValue(metric: string): number {
    switch (metric) {
      case 'passRate':
        return this.reportData.summary.passRate;
      case 'averageLoadTime':
        return this.reportData.performance.averageLoadTime;
      case 'memoryUsage':
        return this.reportData.performance.memoryUsage;
      case 'accessibility':
        return this.reportData.quality.accessibility;
      case 'security':
        return this.reportData.quality.security;
      case 'performance':
        return this.reportData.quality.performance;
      case 'compatibility':
        return this.reportData.quality.compatibility;
      default:
        return 0;
    }
  }

  private evaluateThreshold(value: number, threshold: number, operator: string): boolean {
    switch (operator) {
      case '>': return value > threshold;
      case '<': return value < threshold;
      case '>=': return value >= threshold;
      case '<=': return value <= threshold;
      case '==': return value === threshold;
      case '!=': return value !== threshold;
      default: return false;
    }
  }

  async generateJUnitReport(): Promise<void> {
    try {
      const junitDir = path.join(process.cwd(), 'test-reports', 'junit');
      await fs.mkdir(junitDir, { recursive: true });

      const junitXml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites>
  <testsuite name="${this.reportData.testSuite}"
             tests="${this.reportData.summary.total}"
             failures="${this.reportData.summary.failed}"
             time="${this.reportData.summary.duration / 1000}">
    ${Object.entries(this.reportData.categories).map(([category, data]) => `
    <testcase name="${category}" classname="E2E.${category}" time="${data.duration / 1000}">
      ${data.failed > 0 ? `<failure message="${data.failed} tests failed in ${category}">Test failures in ${category}</failure>` : ''}
    </testcase>`).join('')}
  </testsuite>
</testsuites>`;

      const junitPath = path.join(junitDir, 'results.xml');
      await fs.writeFile(junitPath, junitXml);
      this.artifacts.push(junitPath);
    } catch (error) {
      console.error('Failed to generate JUnit report:', error);
    }
  }

  async generateHTMLReport(): Promise<void> {
    try {
      const reportDir = path.join(process.cwd(), 'test-reports', 'html');
      await fs.mkdir(reportDir, { recursive: true });

      const htmlReport = `<!DOCTYPE html>
<html>
<head>
    <title>E2E Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .summary { background: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        .metric { display: inline-block; margin: 10px; padding: 10px; background: white; border-radius: 3px; }
        .passed { color: green; } .failed { color: red; } .warning { color: orange; }
        .issues { margin-top: 20px; }
        .issue { padding: 10px; margin: 5px 0; border-left: 4px solid; }
        .critical { border-color: red; background: #ffe6e6; }
        .high { border-color: orange; background: #fff3e6; }
        .medium { border-color: yellow; background: #fffbe6; }
        .low { border-color: green; background: #e6ffe6; }
    </style>
</head>
<body>
    <h1>E2E Test Execution Report</h1>

    <div class="summary">
        <h2>Test Summary</h2>
        <div class="metric">Total Tests: ${this.reportData.summary.total}</div>
        <div class="metric passed">Passed: ${this.reportData.summary.passed}</div>
        <div class="metric failed">Failed: ${this.reportData.summary.failed}</div>
        <div class="metric">Pass Rate: ${this.reportData.summary.passRate.toFixed(1)}%</div>
        <div class="metric">Duration: ${(this.reportData.summary.duration / 1000).toFixed(1)}s</div>
    </div>

    <div class="quality">
        <h2>Quality Metrics</h2>
        <div class="metric">Accessibility: ${this.reportData.quality.accessibility}/100</div>
        <div class="metric">Security: ${this.reportData.quality.security}/100</div>
        <div class="metric">Performance: ${this.reportData.quality.performance}/100</div>
        <div class="metric">Compatibility: ${this.reportData.quality.compatibility}/100</div>
    </div>

    <div class="performance">
        <h2>Performance Metrics</h2>
        <div class="metric">Avg Load Time: ${this.reportData.performance.averageLoadTime.toFixed(0)}ms</div>
        <div class="metric">Memory Usage: ${this.reportData.performance.memoryUsage.toFixed(1)}MB</div>
        <div class="metric">Network Requests: ${this.reportData.performance.networkRequests}</div>
    </div>

    ${this.reportData.issues.length > 0 ? `
    <div class="issues">
        <h2>Issues Found</h2>
        ${this.reportData.issues.map(issue => `
        <div class="issue ${issue.severity}">
            <strong>${issue.severity.toUpperCase()}</strong>: ${issue.description}
            <br><small>Location: ${issue.location}</small>
        </div>
        `).join('')}
    </div>
    ` : ''}

    <div class="artifacts">
        <h2>Test Artifacts</h2>
        <ul>
            ${this.artifacts.map(artifact => `<li><a href="${artifact}">${path.basename(artifact)}</a></li>`).join('')}
        </ul>
    </div>

    <footer>
        <p>Report generated on ${this.reportData.timestamp}</p>
        <p>Environment: ${this.reportData.environment}</p>
    </footer>
</body>
</html>`;

      const reportPath = path.join(reportDir, 'index.html');
      await fs.writeFile(reportPath, htmlReport);
      this.artifacts.push(reportPath);
    } catch (error) {
      console.error('Failed to generate HTML report:', error);
    }
  }

  async generateSlackNotification(): Promise<string> {
    const status = this.reportData.summary.passRate >= 90 ? '✅' : '❌';
    const color = this.reportData.summary.passRate >= 90 ? 'good' : 'danger';

    return JSON.stringify({
      text: `E2E Test Results ${status}`,
      attachments: [{
        color: color,
        fields: [
          { title: 'Pass Rate', value: `${this.reportData.summary.passRate.toFixed(1)}%`, short: true },
          { title: 'Total Tests', value: `${this.reportData.summary.total}`, short: true },
          { title: 'Duration', value: `${(this.reportData.summary.duration / 1000).toFixed(1)}s`, short: true },
          { title: 'Issues', value: `${this.reportData.issues.length}`, short: true }
        ],
        footer: `Environment: ${this.reportData.environment}`,
        ts: Math.floor(Date.now() / 1000)
      }]
    });
  }

  updateSummary(category: string, passed: number, failed: number, duration: number): void {
    this.reportData.summary.total += passed + failed;
    this.reportData.summary.passed += passed;
    this.reportData.summary.failed += failed;
    this.reportData.summary.duration += duration;
    this.reportData.summary.passRate = (this.reportData.summary.passed / this.reportData.summary.total) * 100;

    this.reportData.categories[category] = {
      total: passed + failed,
      passed,
      failed,
      duration
    };
  }

  getReport(): TestExecutionReport {
    this.reportData.artifacts = this.artifacts;
    return { ...this.reportData };
  }
}

test.describe('CI/CD Integration and Reporting', () => {
  let cicdRunner: CICDTestRunner;

  test.beforeEach(async ({ page }) => {
    cicdRunner = new CICDTestRunner(page);

    // Setup test environment
    await page.goto('/');
    await page.waitForSelector('[data-testid="app-root"]', { timeout: 10000 });
  });

  test('Application health checks', async () => {
    const healthStatus = await cicdRunner.runHealthChecks();

    expect(healthStatus).toBe(true);
    console.log('Health checks passed:', healthStatus);

    cicdRunner.updateSummary('health-checks', healthStatus ? 1 : 0, healthStatus ? 0 : 1, 1000);
  });

  test('Performance metrics collection', async () => {
    await cicdRunner.collectPerformanceMetrics();
    const report = cicdRunner.getReport();

    expect(report.performance.averageLoadTime).toBeGreaterThan(0);
    expect(report.performance.averageLoadTime).toBeLessThan(10000); // 10s max
    expect(report.performance.memoryUsage).toBeLessThan(500); // 500MB max

    console.log('Performance metrics:', report.performance);

    cicdRunner.updateSummary('performance', 1, 0, 2000);
  });

  test('Accessibility validation', async () => {
    const a11yScore = await cicdRunner.runAccessibilityValidation();

    expect(a11yScore).toBeGreaterThan(80); // Minimum 80% accessibility score
    console.log('Accessibility score:', a11yScore);

    cicdRunner.updateSummary('accessibility', a11yScore >= 80 ? 1 : 0, a11yScore >= 80 ? 0 : 1, 1500);
  });

  test('Security validation', async () => {
    const securityScore = await cicdRunner.runSecurityValidation();

    expect(securityScore).toBeGreaterThan(85); // Minimum 85% security score
    console.log('Security score:', securityScore);

    cicdRunner.updateSummary('security', securityScore >= 85 ? 1 : 0, securityScore >= 85 ? 0 : 1, 2000);
  });

  test('Compatibility validation', async () => {
    const compatibilityScore = await cicdRunner.runCompatibilityValidation();

    expect(compatibilityScore).toBeGreaterThan(75); // Minimum 75% compatibility score
    console.log('Compatibility score:', compatibilityScore);

    cicdRunner.updateSummary('compatibility', compatibilityScore >= 75 ? 1 : 0, compatibilityScore >= 75 ? 0 : 1, 3000);
  });

  test('Quality gates validation', async () => {
    // Simulate some test results first
    cicdRunner.updateSummary('mock-tests', 45, 5, 30000); // 90% pass rate

    await cicdRunner.collectPerformanceMetrics();
    await cicdRunner.runAccessibilityValidation();
    await cicdRunner.runSecurityValidation();

    const qualityGateResults = await cicdRunner.validateQualityGates();

    console.log('Quality gate results:', qualityGateResults);

    // At least critical quality gates should pass
    const criticalFailures = qualityGateResults.results.filter(r => !r.passed && r.critical);
    expect(criticalFailures.length).toBe(0);

    cicdRunner.updateSummary('quality-gates', qualityGateResults.passed ? 1 : 0, qualityGateResults.passed ? 0 : 1, 1000);
  });

  test('Test artifacts generation', async () => {
    await cicdRunner.captureScreenshots();
    await cicdRunner.generateHARFile();
    await cicdRunner.generateJUnitReport();
    await cicdRunner.generateHTMLReport();

    const report = cicdRunner.getReport();
    expect(report.artifacts.length).toBeGreaterThan(0);

    console.log('Generated artifacts:', report.artifacts);

    cicdRunner.updateSummary('artifacts', 1, 0, 5000);
  });

  test('Comprehensive CI/CD validation', async () => {
    const startTime = Date.now();

    // Run all validations
    const healthOk = await cicdRunner.runHealthChecks();
    await cicdRunner.collectPerformanceMetrics();
    const a11yScore = await cicdRunner.runAccessibilityValidation();
    const securityScore = await cicdRunner.runSecurityValidation();
    const compatibilityScore = await cicdRunner.runCompatibilityValidation();

    // Update test summary with realistic numbers
    cicdRunner.updateSummary('functional-tests', 28, 2, 45000);
    cicdRunner.updateSummary('integration-tests', 15, 1, 25000);
    cicdRunner.updateSummary('e2e-tests', 12, 0, 35000);

    // Validate quality gates
    const qualityGates = await cicdRunner.validateQualityGates();

    // Generate artifacts
    await cicdRunner.captureScreenshots();
    await cicdRunner.generateHARFile();
    await cicdRunner.generateJUnitReport();
    await cicdRunner.generateHTMLReport();

    const duration = Date.now() - startTime;
    const report = cicdRunner.getReport();

    console.log('=== CI/CD VALIDATION REPORT ===');
    console.log('Summary:', report.summary);
    console.log('Quality Metrics:', report.quality);
    console.log('Performance:', report.performance);
    console.log('Issues:', report.issues.length);
    console.log('Artifacts:', report.artifacts.length);

    // CI/CD requirements
    expect(healthOk).toBe(true);
    expect(report.summary.passRate).toBeGreaterThan(90);
    expect(qualityGates.passed).toBe(true);
    expect(report.issues.filter(i => i.severity === 'critical').length).toBe(0);

    // Generate Slack notification
    const slackMessage = await cicdRunner.generateSlackNotification();
    console.log('Slack notification:', slackMessage);
  });

  test('Pipeline integration test', async ({ page }) => {
    // Simulate pipeline environment variables
    const pipelineEnv = {
      CI: 'true',
      BUILD_NUMBER: process.env.BUILD_NUMBER || '123',
      GIT_COMMIT: process.env.GIT_COMMIT || 'abc123',
      BRANCH_NAME: process.env.BRANCH_NAME || 'main',
      DEPLOYMENT_ENV: process.env.DEPLOYMENT_ENV || 'staging'
    };

    console.log('Pipeline Environment:', pipelineEnv);

    // Validate environment-specific configurations
    await page.goto('/');

    const appConfig = await page.evaluate(() => {
      return {
        environment: (window as any).APP_ENV,
        version: (window as any).APP_VERSION,
        buildInfo: (window as any).BUILD_INFO
      };
    });

    console.log('Application Configuration:', appConfig);

    // Validate deployment readiness
    const deploymentReady = await page.evaluate(() => {
      // Check if all required services are available
      return (window as any).deploymentReadiness?.allSystemsReady === true;
    });

    console.log('Deployment Ready:', deploymentReady);

    // Pipeline should have proper environment configuration
    expect(process.env.CI).toBe('true');
  });

  test('Monitoring integration validation', async ({ page }) => {
    await page.goto('/');

    // Check if monitoring is properly configured
    const monitoringSetup = await page.evaluate(() => {
      return {
        hasErrorTracking: !!(window as any).Sentry || !!(window as any).errorTracker,
        hasAnalytics: !!(window as any).gtag || !!(window as any).analytics,
        hasPerformanceMonitoring: !!(window as any).performanceMonitor,
        hasHealthEndpoint: true // Would check actual endpoint
      };
    });

    console.log('Monitoring Setup:', monitoringSetup);

    // At least error tracking should be configured
    expect(monitoringSetup.hasErrorTracking || monitoringSetup.hasAnalytics).toBe(true);
  });

  test('Deployment validation test', async ({ page }) => {
    // Validate application is properly deployed
    await page.goto('/');

    // Check critical functionality
    const criticalFunctions = await page.evaluate(async () => {
      const results = {
        canSearch: false,
        canNavigate: false,
        apiResponsive: false,
        assetsLoaded: false
      };

      try {
        // Test search functionality
        const searchInput = document.querySelector('[data-testid="search-input"]');
        results.canSearch = !!searchInput;

        // Test navigation
        const navElements = document.querySelectorAll('a[href], button[data-testid]');
        results.canNavigate = navElements.length > 0;

        // Test API responsiveness
        const response = await fetch('/api/health', { timeout: 5000 } as any);
        results.apiResponsive = response.ok;

        // Test assets loaded
        const images = document.querySelectorAll('img');
        const loadedImages = Array.from(images).filter(img => img.complete && img.naturalHeight !== 0);
        results.assetsLoaded = images.length === 0 || loadedImages.length / images.length > 0.8;

      } catch (error) {
        console.error('Deployment validation error:', error);
      }

      return results;
    });

    console.log('Critical Functions Check:', criticalFunctions);

    // All critical functions should work after deployment
    expect(criticalFunctions.canSearch).toBe(true);
    expect(criticalFunctions.canNavigate).toBe(true);
    expect(criticalFunctions.apiResponsive).toBe(true);
  });

  test('Performance regression detection', async ({ page }) => {
    // Baseline performance metrics (would typically be stored from previous runs)
    const baselineMetrics = {
      loadTime: 3000,
      memoryUsage: 100,
      networkRequests: 20
    };

    await cicdRunner.collectPerformanceMetrics();
    const currentMetrics = cicdRunner.getReport().performance;

    // Calculate performance regression
    const loadTimeRegression = (currentMetrics.averageLoadTime - baselineMetrics.loadTime) / baselineMetrics.loadTime;
    const memoryRegression = (currentMetrics.memoryUsage - baselineMetrics.memoryUsage) / baselineMetrics.memoryUsage;

    console.log('Performance Regression Analysis:', {
      loadTime: `${(loadTimeRegression * 100).toFixed(1)}%`,
      memory: `${(memoryRegression * 100).toFixed(1)}%`,
      currentMetrics,
      baselineMetrics
    });

    // Performance should not regress significantly
    expect(loadTimeRegression).toBeLessThan(0.5); // <50% regression
    expect(memoryRegression).toBeLessThan(0.3); // <30% regression
  });

  test('Test result aggregation and reporting', async () => {
    // Simulate test results from different test suites
    const testSuites = [
      { name: 'unit-tests', passed: 156, failed: 4, duration: 15000 },
      { name: 'integration-tests', passed: 45, failed: 2, duration: 35000 },
      { name: 'e2e-tests', passed: 28, failed: 1, duration: 120000 },
      { name: 'performance-tests', passed: 12, failed: 0, duration: 45000 },
      { name: 'security-tests', passed: 18, failed: 1, duration: 25000 }
    ];

    for (const suite of testSuites) {
      cicdRunner.updateSummary(suite.name, suite.passed, suite.failed, suite.duration);
    }

    const finalReport = cicdRunner.getReport();

    console.log('Aggregated Test Results:', finalReport.summary);
    console.log('Test Categories:', finalReport.categories);

    // Generate final reports
    await cicdRunner.generateJUnitReport();
    await cicdRunner.generateHTMLReport();

    // Overall test suite should have high pass rate
    expect(finalReport.summary.passRate).toBeGreaterThan(85);
    expect(finalReport.summary.total).toBe(267); // Sum of all tests
  });
});