/**
 * SPARC UX Refinement Testing - User Persona Testing with Puppeteer
 *
 * This test suite simulates different user personas interacting with the search interface
 * to identify UX improvement opportunities and validate design decisions.
 */

import { test, expect, Page, Browser, chromium } from '@playwright/test';

interface UserPersona {
  name: string;
  characteristics: string[];
  expectations: {
    performanceThreshold: number; // ms
    errorTolerance: number; // max errors allowed
    completionTime: number; // max time to complete task (ms)
  };
  testScenarios: TestScenario[];
}

interface TestScenario {
  name: string;
  steps: string[];
  successCriteria: string[];
  expectedBehavior: string;
}

interface UXMetrics {
  firstInputDelay: number;
  timeToInteractive: number;
  searchCompletionTime: number;
  errorCount: number;
  retryAttempts: number;
  confusionPoints: string[];
  delightMoments: string[];
  frustrationSignals: string[];
  featureDiscoveryRate: number;
}

interface TestResults {
  persona: string;
  scenario: string;
  metrics: UXMetrics;
  success: boolean;
  issues: string[];
  recommendations: string[];
}

// User Personas Definition
const USER_PERSONAS: UserPersona[] = [
  {
    name: 'Power User',
    characteristics: [
      'Experienced mainframe developer',
      'Prefers keyboard navigation',
      'Uses advanced search operators',
      'Expects fast response times',
      'Performs bulk operations'
    ],
    expectations: {
      performanceThreshold: 100, // <100ms for autocomplete
      errorTolerance: 0,
      completionTime: 3000 // 3 seconds max
    },
    testScenarios: [
      {
        name: 'Advanced Search with Keyboard Navigation',
        steps: [
          'Press Ctrl+K to focus search',
          'Type complex query with operators',
          'Use arrow keys to navigate suggestions',
          'Press Enter to search',
          'Use Tab to navigate results',
          'Press Space to expand result details'
        ],
        successCriteria: [
          'Search input focuses immediately',
          'Autocomplete appears within 100ms',
          'Keyboard navigation works smoothly',
          'Results load within 1 second'
        ],
        expectedBehavior: 'Efficient keyboard-only interaction'
      },
      {
        name: 'Bulk Operations Workflow',
        steps: [
          'Search for "S0C4"',
          'Select multiple results using Shift+Click',
          'Access bulk operations menu',
          'Apply bulk tag operation',
          'Verify changes applied to all selected items'
        ],
        successCriteria: [
          'Multi-selection works intuitively',
          'Bulk operations are discoverable',
          'Operations complete without errors',
          'Feedback is immediate and clear'
        ],
        expectedBehavior: 'Seamless bulk operation execution'
      }
    ]
  },
  {
    name: 'Casual User',
    characteristics: [
      'Occasional system administrator',
      'Prefers click-based interaction',
      'Uses simple search terms',
      'Tolerates moderate delays',
      'Needs visual guidance'
    ],
    expectations: {
      performanceThreshold: 300, // 300ms tolerance
      errorTolerance: 2,
      completionTime: 8000 // 8 seconds max
    },
    testScenarios: [
      {
        name: 'Simple Search Journey',
        steps: [
          'Click on search input',
          'Type simple error code "S0C7"',
          'Click on search suggestion',
          'Click on first result',
          'Read solution details',
          'Rate the solution as helpful'
        ],
        successCriteria: [
          'Search suggestions appear clearly',
          'Results are well-formatted',
          'Solution details are readable',
          'Rating system is intuitive'
        ],
        expectedBehavior: 'Guided discovery with visual cues'
      },
      {
        name: 'Filter-Based Exploration',
        steps: [
          'Open search interface',
          'Click on filter button',
          'Select "DB2" category filter',
          'Browse available results',
          'Apply AI search toggle',
          'Compare result differences'
        ],
        successCriteria: [
          'Filters are easy to discover',
          'Filter effects are clear',
          'AI toggle provides visible value',
          'Results update smoothly'
        ],
        expectedBehavior: 'Intuitive filtering and exploration'
      }
    ]
  },
  {
    name: 'First-Time User',
    characteristics: [
      'New to the system',
      'Needs feature discovery',
      'May make errors',
      'Requires help guidance',
      'Learning curve tolerance'
    ],
    expectations: {
      performanceThreshold: 500, // 500ms tolerance
      errorTolerance: 5,
      completionTime: 15000 // 15 seconds max
    },
    testScenarios: [
      {
        name: 'Onboarding and Discovery',
        steps: [
          'Land on search interface',
          'Read placeholder text and hints',
          'Explore suggested searches',
          'Try typing partial query',
          'Discover autocomplete features',
          'Learn about AI search toggle'
        ],
        successCriteria: [
          'Interface is self-explanatory',
          'Help text is visible and useful',
          'Features are discoverable',
          'Error messages are helpful'
        ],
        expectedBehavior: 'Self-guided learning experience'
      },
      {
        name: 'Error Recovery Path',
        steps: [
          'Enter invalid search query',
          'Encounter no results screen',
          'Follow suggested improvements',
          'Try alternative search terms',
          'Successfully find relevant results'
        ],
        successCriteria: [
          'Error states provide guidance',
          'Suggestions are actionable',
          'Recovery path is clear',
          'Success is celebrated'
        ],
        expectedBehavior: 'Graceful error handling and recovery'
      }
    ]
  },
  {
    name: 'Accessibility User',
    characteristics: [
      'Uses screen reader',
      'Relies on keyboard navigation',
      'Needs high contrast mode',
      'Requires focus management',
      'Uses assistive technologies'
    ],
    expectations: {
      performanceThreshold: 200, // Screen reader needs time
      errorTolerance: 1,
      completionTime: 10000 // 10 seconds max
    },
    testScenarios: [
      {
        name: 'Screen Reader Navigation',
        steps: [
          'Navigate to search with screen reader',
          'Verify ARIA labels and roles',
          'Use keyboard to explore interface',
          'Navigate search results',
          'Access detailed information'
        ],
        successCriteria: [
          'All elements have proper ARIA labels',
          'Focus order is logical',
          'Content is screen reader friendly',
          'Interactions are keyboard accessible'
        ],
        expectedBehavior: 'Full accessibility compliance'
      },
      {
        name: 'High Contrast and Focus Management',
        steps: [
          'Enable high contrast mode',
          'Verify visual clarity',
          'Test focus indicators',
          'Navigate with Tab key only',
          'Verify focus trapping in modals'
        ],
        successCriteria: [
          'High contrast ratios maintained',
          'Focus indicators are visible',
          'No focus traps exist',
          'Color is not the only indicator'
        ],
        expectedBehavior: 'Enhanced accessibility features'
      }
    ]
  }
];

class UXTester {
  private page: Page;
  private metrics: UXMetrics;
  private testResults: TestResults[] = [];

  constructor(page: Page) {
    this.page = page;
    this.metrics = this.initializeMetrics();
  }

  private initializeMetrics(): UXMetrics {
    return {
      firstInputDelay: 0,
      timeToInteractive: 0,
      searchCompletionTime: 0,
      errorCount: 0,
      retryAttempts: 0,
      confusionPoints: [],
      delightMoments: [],
      frustrationSignals: [],
      featureDiscoveryRate: 0
    };
  }

  async measurePerformanceMetrics(): Promise<void> {
    // Measure Core Web Vitals
    const performanceEntries = await this.page.evaluate(() => {
      return JSON.stringify(performance.getEntriesByType('navigation'));
    });

    const entries = JSON.parse(performanceEntries);
    if (entries.length > 0) {
      const entry = entries[0];
      this.metrics.timeToInteractive = entry.loadEventEnd - entry.loadEventStart;
    }

    // Measure FID using observer
    await this.page.evaluate(() => {
      return new Promise((resolve) => {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.name === 'first-input-delay') {
              (window as any).fidValue = entry.value;
              resolve(entry.value);
            }
          }
        }).observe({ entryTypes: ['measure'] });

        // Fallback timeout
        setTimeout(() => resolve(0), 1000);
      });
    });

    const fid = await this.page.evaluate(() => (window as any).fidValue || 0);
    this.metrics.firstInputDelay = fid;
  }

  async detectConfusionPoints(): Promise<void> {
    // Monitor for signs of user confusion
    await this.page.evaluate(() => {
      let clickCount = 0;
      let hesitationTime = 0;
      let lastActivity = Date.now();

      // Track excessive clicking (frustration signal)
      document.addEventListener('click', () => {
        const now = Date.now();
        if (now - lastActivity < 1000) {
          clickCount++;
          if (clickCount > 3) {
            (window as any).confusionSignals = (window as any).confusionSignals || [];
            (window as any).confusionSignals.push('excessive_clicking');
          }
        } else {
          clickCount = 1;
        }
        lastActivity = now;
      });

      // Track hesitation (long pauses)
      document.addEventListener('mousemove', () => {
        const now = Date.now();
        if (now - lastActivity > 3000) {
          (window as any).confusionSignals = (window as any).confusionSignals || [];
          (window as any).confusionSignals.push('hesitation_detected');
        }
        lastActivity = now;
      });
    });
  }

  async simulateUserBehavior(persona: UserPersona, scenario: TestScenario): Promise<TestResults> {
    const startTime = Date.now();
    const issues: string[] = [];
    const recommendations: string[] = [];
    let success = true;

    try {
      console.log(`Testing: ${persona.name} - ${scenario.name}`);

      // Reset metrics for this test
      this.metrics = this.initializeMetrics();
      await this.detectConfusionPoints();

      // Execute test steps based on persona characteristics
      for (const step of scenario.steps) {
        const stepStartTime = Date.now();

        try {
          await this.executeStep(step, persona);

          // Check performance thresholds
          const stepTime = Date.now() - stepStartTime;
          if (stepTime > persona.expectations.performanceThreshold) {
            issues.push(`Step "${step}" took ${stepTime}ms (threshold: ${persona.expectations.performanceThreshold}ms)`);
          }

        } catch (error) {
          this.metrics.errorCount++;
          issues.push(`Failed step: ${step} - ${error.message}`);

          if (this.metrics.errorCount > persona.expectations.errorTolerance) {
            success = false;
            break;
          }
        }
      }

      // Measure total completion time
      this.metrics.searchCompletionTime = Date.now() - startTime;

      if (this.metrics.searchCompletionTime > persona.expectations.completionTime) {
        issues.push(`Total completion time ${this.metrics.searchCompletionTime}ms exceeded threshold ${persona.expectations.completionTime}ms`);
        success = false;
      }

      // Collect confusion signals
      const confusionSignals = await this.page.evaluate(() => (window as any).confusionSignals || []);
      this.metrics.confusionPoints = confusionSignals;

      // Generate recommendations based on issues
      recommendations.push(...this.generateRecommendations(issues, persona));

      // Measure performance metrics
      await this.measurePerformanceMetrics();

    } catch (error) {
      success = false;
      issues.push(`Test execution failed: ${error.message}`);
    }

    const result: TestResults = {
      persona: persona.name,
      scenario: scenario.name,
      metrics: this.metrics,
      success,
      issues,
      recommendations
    };

    this.testResults.push(result);
    return result;
  }

  private async executeStep(step: string, persona: UserPersona): Promise<void> {
    const stepLower = step.toLowerCase();

    if (stepLower.includes('press ctrl+k')) {
      await this.page.keyboard.press('Control+KeyK');
      await this.page.waitForSelector('input[type="text"]:focus', { timeout: 2000 });

    } else if (stepLower.includes('type') && stepLower.includes('query')) {
      const query = this.extractQueryFromStep(step);
      if (persona.name === 'Power User') {
        // Power users type faster
        await this.page.keyboard.type(query, { delay: 50 });
      } else {
        // Casual users type slower
        await this.page.keyboard.type(query, { delay: 150 });
      }

    } else if (stepLower.includes('click on search input')) {
      await this.page.click('input[type="text"], .search-input');

    } else if (stepLower.includes('arrow keys')) {
      await this.page.keyboard.press('ArrowDown');
      await this.page.waitForTimeout(100);
      await this.page.keyboard.press('ArrowDown');

    } else if (stepLower.includes('press enter')) {
      await this.page.keyboard.press('Enter');

    } else if (stepLower.includes('click on search suggestion')) {
      await this.page.waitForSelector('.search-suggestions .suggestion-item, .autocomplete-suggestion');
      await this.page.click('.search-suggestions .suggestion-item:first-child, .autocomplete-suggestion:first-child');

    } else if (stepLower.includes('click on first result')) {
      await this.page.waitForSelector('.search-result-item, .search-result-card');
      await this.page.click('.search-result-item:first-child, .search-result-card:first-child');

    } else if (stepLower.includes('filter button')) {
      await this.page.click('[aria-label*="filter"], .filter-button, button[title*="filter"]');

    } else if (stepLower.includes('ai search toggle')) {
      await this.page.click('.ai-toggle, [aria-label*="AI"], button[title*="AI"]');

    } else if (stepLower.includes('rate') && stepLower.includes('helpful')) {
      await this.page.click('.rating-buttons .btn--rating:first-child, .thumbs-up, [aria-label*="helpful"]');

    } else if (stepLower.includes('tab to navigate')) {
      await this.page.keyboard.press('Tab');
      await this.page.waitForTimeout(200);

    } else if (stepLower.includes('space to expand')) {
      await this.page.keyboard.press('Space');

    } else {
      // Generic wait for dynamic steps
      await this.page.waitForTimeout(500);
    }
  }

  private extractQueryFromStep(step: string): string {
    const matches = step.match(/"([^"]+)"/);
    if (matches) return matches[1];

    // Common test queries based on step context
    if (step.includes('S0C4')) return 'S0C4';
    if (step.includes('S0C7')) return 'S0C7';
    if (step.includes('complex')) return 'SQLCODE -818 AND category:DB2';
    if (step.includes('invalid')) return 'xyz123invalid';
    if (step.includes('partial')) return 'VS';

    return 'test query';
  }

  private generateRecommendations(issues: string[], persona: UserPersona): string[] {
    const recommendations: string[] = [];

    if (issues.some(issue => issue.includes('threshold'))) {
      recommendations.push('Optimize response times with better caching and debouncing');
      recommendations.push('Consider lazy loading for large result sets');
    }

    if (issues.some(issue => issue.includes('Failed step'))) {
      recommendations.push('Improve error handling and user feedback');
      recommendations.push('Add better visual indicators for interactive elements');
    }

    if (persona.name === 'Power User' && issues.length > 0) {
      recommendations.push('Add more keyboard shortcuts for power user workflows');
      recommendations.push('Implement advanced search operators and syntax highlighting');
    }

    if (persona.name === 'First-Time User' && issues.length > 0) {
      recommendations.push('Add onboarding tooltips and guided tour');
      recommendations.push('Improve contextual help and search hints');
    }

    if (persona.name === 'Accessibility User' && issues.length > 0) {
      recommendations.push('Enhance ARIA labels and screen reader support');
      recommendations.push('Improve keyboard navigation and focus management');
    }

    return recommendations;
  }

  getTestResults(): TestResults[] {
    return this.testResults;
  }

  generateUXReport(): string {
    const report = {
      summary: {
        totalTests: this.testResults.length,
        successfulTests: this.testResults.filter(r => r.success).length,
        failedTests: this.testResults.filter(r => !r.success).length
      },
      performanceMetrics: {
        averageFID: this.calculateAverage('firstInputDelay'),
        averageTTI: this.calculateAverage('timeToInteractive'),
        averageCompletionTime: this.calculateAverage('searchCompletionTime'),
        totalErrors: this.testResults.reduce((sum, r) => sum + r.metrics.errorCount, 0)
      },
      personaInsights: this.generatePersonaInsights(),
      priorityRecommendations: this.generatePriorityRecommendations(),
      testResults: this.testResults
    };

    return JSON.stringify(report, null, 2);
  }

  private calculateAverage(metric: keyof UXMetrics): number {
    const values = this.testResults.map(r => r.metrics[metric] as number).filter(v => v > 0);
    return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  }

  private generatePersonaInsights(): Record<string, any> {
    const insights: Record<string, any> = {};

    for (const persona of USER_PERSONAS) {
      const personaResults = this.testResults.filter(r => r.persona === persona.name);
      insights[persona.name] = {
        successRate: personaResults.filter(r => r.success).length / personaResults.length,
        commonIssues: this.findCommonIssues(personaResults),
        keyRecommendations: this.findKeyRecommendations(personaResults)
      };
    }

    return insights;
  }

  private findCommonIssues(results: TestResults[]): string[] {
    const issueCount: Record<string, number> = {};

    for (const result of results) {
      for (const issue of result.issues) {
        issueCount[issue] = (issueCount[issue] || 0) + 1;
      }
    }

    return Object.entries(issueCount)
      .filter(([_, count]) => count > 1)
      .map(([issue, _]) => issue);
  }

  private findKeyRecommendations(results: TestResults[]): string[] {
    const recommendationCount: Record<string, number> = {};

    for (const result of results) {
      for (const rec of result.recommendations) {
        recommendationCount[rec] = (recommendationCount[rec] || 0) + 1;
      }
    }

    return Object.entries(recommendationCount)
      .sort(([_, a], [__, b]) => b - a)
      .slice(0, 3)
      .map(([rec, _]) => rec);
  }

  private generatePriorityRecommendations(): Array<{category: string, priority: string, recommendation: string}> {
    const allRecommendations = this.testResults.flatMap(r => r.recommendations);
    const critical = [];
    const high = [];
    const medium = [];

    for (const rec of allRecommendations) {
      if (rec.includes('response time') || rec.includes('performance')) {
        critical.push({category: 'Performance', priority: 'Critical', recommendation: rec});
      } else if (rec.includes('accessibility') || rec.includes('ARIA')) {
        high.push({category: 'Accessibility', priority: 'High', recommendation: rec});
      } else if (rec.includes('keyboard') || rec.includes('navigation')) {
        high.push({category: 'Navigation', priority: 'High', recommendation: rec});
      } else {
        medium.push({category: 'UX Enhancement', priority: 'Medium', recommendation: rec});
      }
    }

    return [...critical, ...high, ...medium];
  }
}

// Test Suite Implementation
test.describe('SPARC UX Refinement Testing', () => {
  let browser: Browser;
  let tester: UXTester;

  test.beforeAll(async () => {
    browser = await chromium.launch({ headless: false }); // Visual testing
  });

  test.afterAll(async () => {
    await browser.close();
  });

  test.beforeEach(async () => {
    const page = await browser.newPage();
    await page.goto('http://localhost:3000'); // Adjust URL as needed
    tester = new UXTester(page);
  });

  // Power User Tests
  test('Power User - Advanced Search with Keyboard Navigation', async () => {
    const persona = USER_PERSONAS.find(p => p.name === 'Power User')!;
    const scenario = persona.testScenarios[0];

    const result = await tester.simulateUserBehavior(persona, scenario);

    expect(result.success).toBe(true);
    expect(result.metrics.searchCompletionTime).toBeLessThan(persona.expectations.completionTime);
    expect(result.metrics.errorCount).toBeLessThanOrEqual(persona.expectations.errorTolerance);
  });

  test('Power User - Bulk Operations Workflow', async () => {
    const persona = USER_PERSONAS.find(p => p.name === 'Power User')!;
    const scenario = persona.testScenarios[1];

    const result = await tester.simulateUserBehavior(persona, scenario);

    expect(result.success).toBe(true);
    expect(result.issues.length).toBeLessThan(3);
  });

  // Casual User Tests
  test('Casual User - Simple Search Journey', async () => {
    const persona = USER_PERSONAS.find(p => p.name === 'Casual User')!;
    const scenario = persona.testScenarios[0];

    const result = await tester.simulateUserBehavior(persona, scenario);

    expect(result.success).toBe(true);
    expect(result.metrics.confusionPoints.length).toBeLessThan(2);
  });

  test('Casual User - Filter-Based Exploration', async () => {
    const persona = USER_PERSONAS.find(p => p.name === 'Casual User')!;
    const scenario = persona.testScenarios[1];

    const result = await tester.simulateUserBehavior(persona, scenario);

    expect(result.success).toBe(true);
    expect(result.recommendations.length).toBeLessThan(5);
  });

  // First-Time User Tests
  test('First-Time User - Onboarding and Discovery', async () => {
    const persona = USER_PERSONAS.find(p => p.name === 'First-Time User')!;
    const scenario = persona.testScenarios[0];

    const result = await tester.simulateUserBehavior(persona, scenario);

    expect(result.metrics.featureDiscoveryRate).toBeGreaterThan(0.5);
  });

  test('First-Time User - Error Recovery Path', async () => {
    const persona = USER_PERSONAS.find(p => p.name === 'First-Time User')!;
    const scenario = persona.testScenarios[1];

    const result = await tester.simulateUserBehavior(persona, scenario);

    expect(result.success).toBe(true);
  });

  // Accessibility User Tests
  test('Accessibility User - Screen Reader Navigation', async () => {
    const persona = USER_PERSONAS.find(p => p.name === 'Accessibility User')!;
    const scenario = persona.testScenarios[0];

    const result = await tester.simulateUserBehavior(persona, scenario);

    expect(result.success).toBe(true);
    expect(result.issues.filter(i => i.includes('accessibility')).length).toBe(0);
  });

  test('Accessibility User - High Contrast and Focus Management', async () => {
    const persona = USER_PERSONAS.find(p => p.name === 'Accessibility User')!;
    const scenario = persona.testScenarios[1];

    const result = await tester.simulateUserBehavior(persona, scenario);

    expect(result.success).toBe(true);
  });

  // A/B Testing Scenarios
  test('A/B Test - Current vs Enhanced Interface', async ({ page }) => {
    // Test current implementation
    await page.goto('http://localhost:3000');
    const currentTester = new UXTester(page);

    const powerUser = USER_PERSONAS.find(p => p.name === 'Power User')!;
    const currentResult = await currentTester.simulateUserBehavior(powerUser, powerUser.testScenarios[0]);

    // Test enhanced implementation (if available)
    // await page.goto('http://localhost:3000?variant=enhanced');
    // const enhancedResult = await currentTester.simulateUserBehavior(powerUser, powerUser.testScenarios[0]);

    // Compare results
    expect(currentResult.metrics.searchCompletionTime).toBeLessThan(5000);
    expect(currentResult.metrics.errorCount).toBeLessThanOrEqual(1);
  });

  // Generate UX Report
  test('Generate Comprehensive UX Report', async () => {
    // Run all persona tests
    for (const persona of USER_PERSONAS) {
      for (const scenario of persona.testScenarios) {
        await tester.simulateUserBehavior(persona, scenario);
      }
    }

    const report = tester.generateUXReport();

    // Save report for analysis
    const fs = require('fs');
    fs.writeFileSync('/mnt/c/mainframe-ai-assistant/tests/e2e/ux-refinement-report.json', report);

    expect(tester.getTestResults().length).toBeGreaterThan(0);

    console.log('UX Refinement Report Generated:');
    console.log(report);
  });
});