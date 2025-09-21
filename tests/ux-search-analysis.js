const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

class SearchUXAnalyzer {
  constructor() {
    this.browser = null;
    this.page = null;
    this.results = {
      interactions: [],
      metrics: {},
      painPoints: [],
      accessibility: {},
      performance: {}
    };
  }

  async init() {
    this.browser = await puppeteer.launch({
      headless: false,
      devtools: true,
      args: ['--disable-web-security', '--allow-running-insecure-content']
    });
    this.page = await this.browser.newPage();

    // Set viewport for desktop testing
    await this.page.setViewport({ width: 1920, height: 1080 });

    // Enable performance monitoring
    await this.page.tracing.start({ path: '/tmp/search-ux-trace.json', screenshots: true });

    console.log('🔧 Puppeteer initialized for UX testing');
  }

  async navigateToApp() {
    console.log('🌐 Navigating to dashboard...');
    await this.page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });

    // Take initial screenshot
    await this.page.screenshot({
      path: '/mnt/c/mainframe-ai-assistant/tests/screenshots/dashboard-initial.png',
      fullPage: true
    });
  }

  async findSearchElements() {
    console.log('🔍 Identifying search elements...');

    // Try multiple search element selectors
    const searchSelectors = [
      'input[type="search"]',
      'input[placeholder*="search" i]',
      'input[placeholder*="Search" i]',
      '[data-testid*="search"]',
      '.search-input',
      '#search',
      '.kb-search',
      'input[name*="search"]'
    ];

    for (const selector of searchSelectors) {
      try {
        const element = await this.page.$(selector);
        if (element) {
          console.log(`✅ Found search element: ${selector}`);
          return { element, selector };
        }
      } catch (e) {
        console.log(`❌ Selector failed: ${selector}`);
      }
    }

    // Fallback: look for any input in the header/nav area
    const allInputs = await this.page.$$('input');
    console.log(`🔍 Found ${allInputs.length} input elements, analyzing...`);

    for (let i = 0; i < allInputs.length; i++) {
      const input = allInputs[i];
      const placeholder = await input.getProperty('placeholder');
      const placeholderText = await placeholder.jsonValue();
      const type = await input.getProperty('type');
      const typeValue = await type.jsonValue();

      console.log(`Input ${i}: type="${typeValue}", placeholder="${placeholderText}"`);

      if (placeholderText && placeholderText.toLowerCase().includes('search')) {
        console.log(`✅ Found search input by placeholder: "${placeholderText}"`);
        return { element: input, selector: `input[placeholder="${placeholderText}"]` };
      }
    }

    throw new Error('No search element found');
  }

  async testBasicInteractions(searchElement) {
    console.log('🧪 Testing basic search interactions...');
    const startTime = Date.now();

    // Test 1: Click to focus
    console.log('1️⃣ Testing click focus...');
    await searchElement.click();
    await this.page.waitForTimeout(100);

    const isFocused = await this.page.evaluate(() => {
      return document.activeElement && document.activeElement.type === 'search';
    });

    this.results.interactions.push({
      test: 'click-focus',
      success: isFocused,
      time: Date.now() - startTime
    });

    // Test 2: Character by character typing (slow)
    console.log('2️⃣ Testing slow typing...');
    const slowTypeStart = Date.now();
    const testText = 'incident';

    for (const char of testText) {
      await searchElement.type(char, { delay: 100 });
      await this.page.waitForTimeout(50);
    }

    this.results.interactions.push({
      test: 'slow-typing',
      text: testText,
      time: Date.now() - slowTypeStart
    });

    // Test 3: Clear and fast typing
    console.log('3️⃣ Testing fast typing...');
    await searchElement.click({ clickCount: 3 }); // Select all
    await searchElement.press('Backspace');

    const fastTypeStart = Date.now();
    await searchElement.type('fast typing test', { delay: 10 });

    this.results.interactions.push({
      test: 'fast-typing',
      text: 'fast typing test',
      time: Date.now() - fastTypeStart
    });

    // Take screenshot after typing
    await this.page.screenshot({
      path: '/mnt/c/mainframe-ai-assistant/tests/screenshots/search-typed.png'
    });
  }

  async testSpecialCharacters(searchElement) {
    console.log('4️⃣ Testing special characters...');

    const specialInputs = [
      '!@#$%^&*()',
      'hello "world"',
      "single'quotes",
      '<script>alert("test")</script>',
      '   leading spaces',
      'trailing spaces   ',
      'unicode: café naïve résumé',
      'numbers: 123.456.789',
      'symbols: ±×÷≈≠≤≥'
    ];

    for (const input of specialInputs) {
      await searchElement.click({ clickCount: 3 });
      await searchElement.press('Backspace');

      const testStart = Date.now();
      try {
        await searchElement.type(input);
        await this.page.waitForTimeout(200);

        const currentValue = await searchElement.getProperty('value');
        const actualValue = await currentValue.jsonValue();

        this.results.interactions.push({
          test: 'special-characters',
          input: input,
          output: actualValue,
          success: true,
          time: Date.now() - testStart
        });
      } catch (error) {
        this.results.interactions.push({
          test: 'special-characters',
          input: input,
          error: error.message,
          success: false,
          time: Date.now() - testStart
        });
      }
    }
  }

  async testKeyboardNavigation(searchElement) {
    console.log('5️⃣ Testing keyboard navigation...');

    // Clear search
    await searchElement.click({ clickCount: 3 });
    await searchElement.press('Backspace');

    // Test keyboard shortcuts
    const keyTests = [
      { key: 'Tab', description: 'Tab navigation' },
      { key: 'Escape', description: 'Escape to clear/blur' },
      { key: 'Enter', description: 'Enter to search' },
      { key: 'ArrowDown', description: 'Arrow down for suggestions' },
      { key: 'ArrowUp', description: 'Arrow up for suggestions' }
    ];

    for (const keyTest of keyTests) {
      const testStart = Date.now();
      try {
        await searchElement.focus();
        await searchElement.type('test query');
        await this.page.keyboard.press(keyTest.key);
        await this.page.waitForTimeout(300);

        this.results.interactions.push({
          test: 'keyboard-navigation',
          key: keyTest.key,
          description: keyTest.description,
          success: true,
          time: Date.now() - testStart
        });
      } catch (error) {
        this.results.interactions.push({
          test: 'keyboard-navigation',
          key: keyTest.key,
          error: error.message,
          success: false,
          time: Date.now() - testStart
        });
      }
    }
  }

  async measurePerformanceMetrics() {
    console.log('📊 Measuring performance metrics...');

    // Measure page load performance
    const performanceMetrics = await this.page.metrics();

    // Measure search response time
    const searchResponseTimes = [];

    for (let i = 0; i < 5; i++) {
      const searchElement = await this.findSearchElements();
      await searchElement.element.click({ clickCount: 3 });
      await searchElement.element.press('Backspace');

      const startTime = performance.now();
      await searchElement.element.type(`test query ${i}`);

      // Wait for any search results or feedback
      try {
        await this.page.waitForSelector('.search-results, .search-suggestions, [data-testid="search-results"]', { timeout: 1000 });
        const endTime = performance.now();
        searchResponseTimes.push(endTime - startTime);
      } catch (e) {
        // No search results appeared
        searchResponseTimes.push(1000); // Timeout value
      }
    }

    this.results.performance = {
      pageMetrics: performanceMetrics,
      searchResponseTimes: searchResponseTimes,
      averageResponseTime: searchResponseTimes.reduce((a, b) => a + b, 0) / searchResponseTimes.length
    };
  }

  async evaluateAccessibility() {
    console.log('♿ Evaluating accessibility...');

    // Check ARIA attributes
    const searchElement = await this.findSearchElements();

    const ariaLabel = await searchElement.element.getProperty('aria-label');
    const ariaLabelValue = await ariaLabel.jsonValue();

    const ariaDescribedBy = await searchElement.element.getProperty('aria-describedby');
    const ariaDescribedByValue = await ariaDescribedBy.jsonValue();

    const role = await searchElement.element.getProperty('role');
    const roleValue = await role.jsonValue();

    // Check color contrast (simplified)
    const styles = await this.page.evaluate((selector) => {
      const element = document.querySelector(selector);
      const computedStyles = window.getComputedStyle(element);
      return {
        color: computedStyles.color,
        backgroundColor: computedStyles.backgroundColor,
        borderColor: computedStyles.borderColor,
        fontSize: computedStyles.fontSize,
        fontWeight: computedStyles.fontWeight
      };
    }, searchElement.selector);

    this.results.accessibility = {
      ariaLabel: ariaLabelValue,
      ariaDescribedBy: ariaDescribedByValue,
      role: roleValue,
      styles: styles,
      hasProperLabeling: !!ariaLabelValue || !!ariaDescribedByValue
    };
  }

  async identifyPainPoints() {
    console.log('🎯 Identifying pain points...');

    const painPoints = [];

    // Analyze interaction results for pain points
    const slowInteractions = this.results.interactions.filter(i => i.time > 500);
    if (slowInteractions.length > 0) {
      painPoints.push({
        type: 'performance',
        severity: 'medium',
        description: 'Slow response times detected',
        interactions: slowInteractions
      });
    }

    const failedInteractions = this.results.interactions.filter(i => !i.success);
    if (failedInteractions.length > 0) {
      painPoints.push({
        type: 'functionality',
        severity: 'high',
        description: 'Failed interactions detected',
        interactions: failedInteractions
      });
    }

    // Check if search provides immediate feedback
    const hasInstantFeedback = this.results.performance.averageResponseTime < 300;
    if (!hasInstantFeedback) {
      painPoints.push({
        type: 'ux',
        severity: 'medium',
        description: 'Lack of instant search feedback',
        metric: this.results.performance.averageResponseTime
      });
    }

    // Check accessibility issues
    if (!this.results.accessibility.hasProperLabeling) {
      painPoints.push({
        type: 'accessibility',
        severity: 'high',
        description: 'Missing proper ARIA labeling for screen readers'
      });
    }

    this.results.painPoints = painPoints;
  }

  async generateReport() {
    console.log('📄 Generating comprehensive UX report...');

    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalTests: this.results.interactions.length,
        successRate: (this.results.interactions.filter(i => i.success).length / this.results.interactions.length * 100).toFixed(2),
        averageResponseTime: this.results.performance.averageResponseTime,
        painPointsCount: this.results.painPoints.length
      },
      interactions: this.results.interactions,
      performance: this.results.performance,
      accessibility: this.results.accessibility,
      painPoints: this.results.painPoints,
      recommendations: this.generateRecommendations()
    };

    // Save report
    const reportPath = '/mnt/c/mainframe-ai-assistant/tests/ux-search-analysis-report.json';
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`📊 Report saved to: ${reportPath}`);

    return report;
  }

  generateRecommendations() {
    const recommendations = [];

    // Performance recommendations
    if (this.results.performance.averageResponseTime > 300) {
      recommendations.push({
        category: 'Performance',
        priority: 'High',
        recommendation: 'Implement debounced search with 150ms delay',
        implementation: 'Use lodash debounce or custom debouncing'
      });
    }

    // Accessibility recommendations
    if (!this.results.accessibility.hasProperLabeling) {
      recommendations.push({
        category: 'Accessibility',
        priority: 'Critical',
        recommendation: 'Add proper ARIA labels and descriptions',
        implementation: 'aria-label="Search knowledge base" aria-describedby="search-help"'
      });
    }

    // UX recommendations
    recommendations.push({
      category: 'User Experience',
      priority: 'Medium',
      recommendation: 'Add search suggestions/autocomplete',
      implementation: 'Implement typeahead with recent searches and popular queries'
    });

    recommendations.push({
      category: 'User Experience',
      priority: 'Low',
      recommendation: 'Add search shortcuts (Ctrl+K or /)',
      implementation: 'Global keyboard listener for search activation'
    });

    return recommendations;
  }

  async cleanup() {
    if (this.page) {
      await this.page.tracing.stop();
    }
    if (this.browser) {
      await this.browser.close();
    }
  }

  async runCompleteAnalysis() {
    try {
      await this.init();
      await this.navigateToApp();

      const searchElements = await this.findSearchElements();

      await this.testBasicInteractions(searchElements.element);
      await this.testSpecialCharacters(searchElements.element);
      await this.testKeyboardNavigation(searchElements.element);
      await this.measurePerformanceMetrics();
      await this.evaluateAccessibility();
      await this.identifyPainPoints();

      const report = await this.generateReport();

      console.log('✅ Complete UX analysis finished!');
      console.log(`📊 Success Rate: ${report.summary.successRate}%`);
      console.log(`⚡ Average Response: ${report.summary.averageResponseTime.toFixed(2)}ms`);
      console.log(`🎯 Pain Points: ${report.summary.painPointsCount}`);

      return report;

    } catch (error) {
      console.error('❌ UX Analysis failed:', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }
}

// Run the analysis
async function main() {
  const analyzer = new SearchUXAnalyzer();
  const report = await analyzer.runCompleteAnalysis();
  console.log('Analysis complete. Check the generated report.');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = SearchUXAnalyzer;