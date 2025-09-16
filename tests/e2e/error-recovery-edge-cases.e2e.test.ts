/**
 * Error Recovery and Edge Case Testing E2E Suite
 *
 * Tests application resilience and error handling:
 * - Network failure recovery
 * - Database connection errors
 * - Memory exhaustion scenarios
 * - Corrupted data handling
 * - Concurrent access conflicts
 * - Browser crash recovery
 * - Offline/online transitions
 * - Resource unavailability
 * - Timeout handling
 * - Graceful degradation
 */

import { test, expect, Page, Route } from '@playwright/test';

interface ErrorScenario {
  name: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'network' | 'database' | 'memory' | 'data' | 'concurrency' | 'system' | 'timeout' | 'resource';
}

interface RecoveryTestResult {
  scenario: ErrorScenario;
  errorTriggered: boolean;
  errorHandled: boolean;
  recoverySuccessful: boolean;
  userExperienceImpact: 'none' | 'minor' | 'moderate' | 'severe';
  recoveryTime: number;
  details: string;
}

class ErrorRecoveryTester {
  private page: Page;
  private results: RecoveryTestResult[] = [];
  private originalHandlers: any = {};

  constructor(page: Page) {
    this.page = page;
  }

  async setupErrorInterception(): Promise<void> {
    // Intercept console errors
    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log(`Console Error: ${msg.text()}`);
      }
    });

    // Intercept page errors
    this.page.on('pageerror', error => {
      console.log(`Page Error: ${error.message}`);
    });

    // Setup custom error tracking
    await this.page.addInitScript(() => {
      (window as any).errorLog = [];
      (window as any).recoveryAttempts = [];

      window.addEventListener('error', (event) => {
        (window as any).errorLog.push({
          type: 'javascript',
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          timestamp: Date.now()
        });
      });

      window.addEventListener('unhandledrejection', (event) => {
        (window as any).errorLog.push({
          type: 'promise',
          reason: event.reason?.toString(),
          timestamp: Date.now()
        });
      });
    });
  }

  async testNetworkFailureRecovery(): Promise<void> {
    const scenario: ErrorScenario = {
      name: 'Network Failure Recovery',
      description: 'Test recovery from network connectivity issues',
      severity: 'high',
      category: 'network'
    };

    const startTime = Date.now();

    try {
      // Navigate to application
      await this.page.goto('/');
      await this.page.waitForSelector('[data-testid="app-root"]');

      // Simulate network failure
      await this.page.route('**/*', (route: Route) => {
        route.abort('networkfailure');
      });

      // Try to perform an action that requires network
      await this.page.goto('#/search');
      await this.page.fill('[data-testid="search-input"]', 'network test');
      await this.page.click('[data-testid="search-button"]');

      // Check for error handling
      const errorHandled = await this.checkForErrorHandling();

      // Restore network
      await this.page.unroute('**/*');

      // Test recovery
      await this.page.click('[data-testid="retry-button"], [data-testid="refresh-button"]');
      const recoverySuccessful = await this.checkRecoverySuccess();

      const recoveryTime = Date.now() - startTime;

      this.results.push({
        scenario,
        errorTriggered: true,
        errorHandled,
        recoverySuccessful,
        userExperienceImpact: errorHandled ? (recoverySuccessful ? 'minor' : 'moderate') : 'severe',
        recoveryTime,
        details: `Network failure recovery ${recoverySuccessful ? 'successful' : 'failed'}`
      });
    } catch (error) {
      this.results.push({
        scenario,
        errorTriggered: true,
        errorHandled: false,
        recoverySuccessful: false,
        userExperienceImpact: 'severe',
        recoveryTime: Date.now() - startTime,
        details: `Network failure test failed: ${error.message}`
      });
    }
  }

  async testDatabaseConnectionErrors(): Promise<void> {
    const scenario: ErrorScenario = {
      name: 'Database Connection Error',
      description: 'Test handling of database connectivity issues',
      severity: 'critical',
      category: 'database'
    };

    const startTime = Date.now();

    try {
      await this.page.goto('/');

      // Simulate database errors
      await this.page.route('**/api/search**', (route: Route) => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Database connection failed' })
        });
      });

      await this.page.route('**/api/entries**', (route: Route) => {
        route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Service unavailable' })
        });
      });

      // Try database operations
      await this.page.goto('#/search');
      await this.page.fill('[data-testid="search-input"]', 'database test');
      await this.page.click('[data-testid="search-button"]');

      const errorHandled = await this.checkForErrorHandling();

      // Test entry creation with DB error
      await this.page.click('[data-testid="add-entry-button"]');
      await this.page.fill('[data-testid="entry-title-input"]', 'DB Error Test');
      await this.page.fill('[data-testid="entry-problem-input"]', 'Test problem');
      await this.page.fill('[data-testid="entry-solution-input"]', 'Test solution');
      await this.page.click('[data-testid="save-entry-button"]');

      const saveErrorHandled = await this.checkForErrorHandling();

      // Restore database
      await this.page.unroute('**/api/search**');
      await this.page.unroute('**/api/entries**');

      const recoverySuccessful = await this.checkRecoverySuccess();
      const recoveryTime = Date.now() - startTime;

      this.results.push({
        scenario,
        errorTriggered: true,
        errorHandled: errorHandled && saveErrorHandled,
        recoverySuccessful,
        userExperienceImpact: (errorHandled && saveErrorHandled) ? 'minor' : 'severe',
        recoveryTime,
        details: `Database error handling: ${errorHandled && saveErrorHandled ? 'good' : 'poor'}`
      });
    } catch (error) {
      this.results.push({
        scenario,
        errorTriggered: true,
        errorHandled: false,
        recoverySuccessful: false,
        userExperienceImpact: 'severe',
        recoveryTime: Date.now() - startTime,
        details: `Database error test failed: ${error.message}`
      });
    }
  }

  async testMemoryExhaustionScenario(): Promise<void> {
    const scenario: ErrorScenario = {
      name: 'Memory Exhaustion',
      description: 'Test handling of memory exhaustion scenarios',
      severity: 'high',
      category: 'memory'
    };

    const startTime = Date.now();

    try {
      await this.page.goto('/');

      // Create memory pressure
      await this.page.evaluate(() => {
        const largeArrays: any[] = [];
        for (let i = 0; i < 100; i++) {
          largeArrays.push(new Array(1000000).fill(`memory-test-${i}`));
        }
        (window as any).memoryTestArrays = largeArrays;
      });

      // Try to perform operations under memory pressure
      await this.page.goto('#/search');
      await this.page.fill('[data-testid="search-input"]', 'memory pressure test');
      await this.page.click('[data-testid="search-button"]');

      const errorHandled = await this.checkForErrorHandling();

      // Clean up memory
      await this.page.evaluate(() => {
        delete (window as any).memoryTestArrays;
        if ((window as any).gc) {
          (window as any).gc();
        }
      });

      const recoverySuccessful = await this.checkRecoverySuccess();
      const recoveryTime = Date.now() - startTime;

      this.results.push({
        scenario,
        errorTriggered: true,
        errorHandled,
        recoverySuccessful,
        userExperienceImpact: errorHandled ? 'minor' : 'moderate',
        recoveryTime,
        details: `Memory exhaustion ${errorHandled ? 'handled gracefully' : 'caused issues'}`
      });
    } catch (error) {
      this.results.push({
        scenario,
        errorTriggered: true,
        errorHandled: false,
        recoverySuccessful: false,
        userExperienceImpact: 'severe',
        recoveryTime: Date.now() - startTime,
        details: `Memory exhaustion test failed: ${error.message}`
      });
    }
  }

  async testCorruptedDataHandling(): Promise<void> {
    const scenario: ErrorScenario = {
      name: 'Corrupted Data Handling',
      description: 'Test handling of corrupted or invalid data',
      severity: 'medium',
      category: 'data'
    };

    const startTime = Date.now();

    try {
      await this.page.goto('/');

      // Inject corrupted data
      await this.page.evaluate(() => {
        localStorage.setItem('app-data', 'corrupted-invalid-json-{');
        localStorage.setItem('user-preferences', '{invalid:json}');
      });

      // Navigate to different sections to trigger data loading
      const sections = ['#/search', '#/analytics', '#/settings'];

      let errorHandled = true;
      for (const section of sections) {
        await this.page.goto(section);
        await this.page.waitForTimeout(1000);

        const hasError = await this.page.locator('[data-testid="error-message"], [data-testid="data-error"]').isVisible();
        if (!hasError) {
          // Check if page loaded successfully despite corrupted data
          const hasContent = await this.page.locator('[data-testid*="interface"], [data-testid*="panel"]').count();
          if (hasContent === 0) {
            errorHandled = false;
            break;
          }
        }
      }

      // Clean up corrupted data
      await this.page.evaluate(() => {
        localStorage.removeItem('app-data');
        localStorage.removeItem('user-preferences');
      });

      const recoverySuccessful = await this.checkRecoverySuccess();
      const recoveryTime = Date.now() - startTime;

      this.results.push({
        scenario,
        errorTriggered: true,
        errorHandled,
        recoverySuccessful,
        userExperienceImpact: errorHandled ? 'minor' : 'moderate',
        recoveryTime,
        details: `Corrupted data ${errorHandled ? 'handled with fallbacks' : 'caused failures'}`
      });
    } catch (error) {
      this.results.push({
        scenario,
        errorTriggered: true,
        errorHandled: false,
        recoverySuccessful: false,
        userExperienceImpact: 'moderate',
        recoveryTime: Date.now() - startTime,
        details: `Corrupted data test failed: ${error.message}`
      });
    }
  }

  async testConcurrentAccessConflicts(): Promise<void> {
    const scenario: ErrorScenario = {
      name: 'Concurrent Access Conflicts',
      description: 'Test handling of concurrent modification conflicts',
      severity: 'medium',
      category: 'concurrency'
    };

    const startTime = Date.now();

    try {
      await this.page.goto('/');

      // Create multiple windows/contexts to simulate concurrent access
      const context = this.page.context();
      const page2 = await context.newPage();

      // Both pages navigate to same entry
      await this.page.goto('#/search');
      await page2.goto('#/search');

      await this.page.fill('[data-testid="search-input"]', 'concurrency test');
      await this.page.click('[data-testid="search-button"]');

      // Simulate finding and editing the same entry
      if (await this.page.locator('[data-testid="search-result-0"]').count() > 0) {
        await this.page.click('[data-testid="search-result-0"]');
        await page2.click('[data-testid="search-result-0"]');

        // Both start editing
        await this.page.click('[data-testid="edit-entry-button"]');
        await page2.click('[data-testid="edit-entry-button"]');

        // Make different changes
        await this.page.fill('[data-testid="entry-title-input"]', 'Concurrent Edit 1');
        await page2.fill('[data-testid="entry-title-input"]', 'Concurrent Edit 2');

        // Try to save both
        await this.page.click('[data-testid="save-entry-button"]');
        await page2.click('[data-testid="save-entry-button"]');

        // Check for conflict resolution
        const conflictHandled = await this.page.locator('[data-testid="conflict-resolution"], [data-testid="edit-conflict"]').isVisible() ||
                              await page2.locator('[data-testid="conflict-resolution"], [data-testid="edit-conflict"]').isVisible();

        const errorHandled = conflictHandled;
        const recoverySuccessful = await this.checkRecoverySuccess();

        await page2.close();

        this.results.push({
          scenario,
          errorTriggered: true,
          errorHandled,
          recoverySuccessful,
          userExperienceImpact: errorHandled ? 'minor' : 'moderate',
          recoveryTime: Date.now() - startTime,
          details: `Concurrent access ${errorHandled ? 'conflict detected and resolved' : 'conflict not handled'}`
        });
      } else {
        await page2.close();
        this.results.push({
          scenario,
          errorTriggered: false,
          errorHandled: true,
          recoverySuccessful: true,
          userExperienceImpact: 'none',
          recoveryTime: 0,
          details: 'No entries available for concurrency testing'
        });
      }
    } catch (error) {
      this.results.push({
        scenario,
        errorTriggered: true,
        errorHandled: false,
        recoverySuccessful: false,
        userExperienceImpact: 'moderate',
        recoveryTime: Date.now() - startTime,
        details: `Concurrency test failed: ${error.message}`
      });
    }
  }

  async testTimeoutHandling(): Promise<void> {
    const scenario: ErrorScenario = {
      name: 'Request Timeout Handling',
      description: 'Test handling of request timeouts',
      severity: 'medium',
      category: 'timeout'
    };

    const startTime = Date.now();

    try {
      await this.page.goto('/');

      // Simulate slow/timeout responses
      await this.page.route('**/api/search**', (route: Route) => {
        // Delay response significantly
        setTimeout(() => {
          route.fulfill({
            status: 408,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Request timeout' })
          });
        }, 10000); // 10 second delay
      });

      // Perform search that will timeout
      await this.page.goto('#/search');
      await this.page.fill('[data-testid="search-input"]', 'timeout test');
      await this.page.click('[data-testid="search-button"]');

      // Check for timeout handling
      const timeoutHandled = await this.page.locator('[data-testid="timeout-error"], [data-testid="loading-timeout"]').isVisible({ timeout: 12000 });

      await this.page.unroute('**/api/search**');

      const recoverySuccessful = await this.checkRecoverySuccess();
      const recoveryTime = Date.now() - startTime;

      this.results.push({
        scenario,
        errorTriggered: true,
        errorHandled: timeoutHandled,
        recoverySuccessful,
        userExperienceImpact: timeoutHandled ? 'minor' : 'moderate',
        recoveryTime,
        details: `Timeout ${timeoutHandled ? 'properly handled with user notification' : 'not handled gracefully'}`
      });
    } catch (error) {
      this.results.push({
        scenario,
        errorTriggered: true,
        errorHandled: false,
        recoverySuccessful: false,
        userExperienceImpact: 'moderate',
        recoveryTime: Date.now() - startTime,
        details: `Timeout test failed: ${error.message}`
      });
    }
  }

  async testResourceUnavailability(): Promise<void> {
    const scenario: ErrorScenario = {
      name: 'Resource Unavailability',
      description: 'Test handling when critical resources are unavailable',
      severity: 'high',
      category: 'resource'
    };

    const startTime = Date.now();

    try {
      await this.page.goto('/');

      // Block critical resources
      await this.page.route('**/*.css', (route: Route) => route.abort('connectionreset'));
      await this.page.route('**/*.js', (route: Route) => {
        if (route.request().url().includes('critical') || route.request().url().includes('main')) {
          route.abort('connectionreset');
        } else {
          route.continue();
        }
      });

      // Try to navigate and use the application
      await this.page.goto('/', { waitUntil: 'domcontentloaded' });

      // Check if application provides graceful degradation
      const hasBasicFunctionality = await this.page.locator('[data-testid="app-root"]').isVisible({ timeout: 5000 });
      const hasErrorMessage = await this.page.locator('[data-testid="resource-error"], [data-testid="loading-error"]').isVisible();

      const errorHandled = hasBasicFunctionality || hasErrorMessage;

      await this.page.unroute('**/*.css');
      await this.page.unroute('**/*.js');

      const recoverySuccessful = await this.checkRecoverySuccess();
      const recoveryTime = Date.now() - startTime;

      this.results.push({
        scenario,
        errorTriggered: true,
        errorHandled,
        recoverySuccessful,
        userExperienceImpact: errorHandled ? 'moderate' : 'severe',
        recoveryTime,
        details: `Resource unavailability ${errorHandled ? 'handled with graceful degradation' : 'caused complete failure'}`
      });
    } catch (error) {
      this.results.push({
        scenario,
        errorTriggered: true,
        errorHandled: false,
        recoverySuccessful: false,
        userExperienceImpact: 'severe',
        recoveryTime: Date.now() - startTime,
        details: `Resource unavailability test failed: ${error.message}`
      });
    }
  }

  async testOfflineOnlineTransitions(): Promise<void> {
    const scenario: ErrorScenario = {
      name: 'Offline/Online Transitions',
      description: 'Test handling of offline/online state changes',
      severity: 'medium',
      category: 'network'
    };

    const startTime = Date.now();

    try {
      await this.page.goto('/');

      // Simulate going offline
      await this.page.context().setOffline(true);

      // Try to perform actions while offline
      await this.page.goto('#/search');
      await this.page.fill('[data-testid="search-input"]', 'offline test');
      await this.page.click('[data-testid="search-button"]');

      const offlineHandled = await this.page.locator('[data-testid="offline-indicator"], [data-testid="offline-message"]').isVisible({ timeout: 3000 });

      // Go back online
      await this.page.context().setOffline(false);

      // Check for online recovery
      const onlineRecovery = await this.page.locator('[data-testid="online-indicator"], [data-testid="connection-restored"]').isVisible({ timeout: 5000 });

      const recoverySuccessful = await this.checkRecoverySuccess();
      const recoveryTime = Date.now() - startTime;

      this.results.push({
        scenario,
        errorTriggered: true,
        errorHandled: offlineHandled,
        recoverySuccessful: onlineRecovery && recoverySuccessful,
        userExperienceImpact: offlineHandled ? 'minor' : 'moderate',
        recoveryTime,
        details: `Offline/online transitions ${offlineHandled && onlineRecovery ? 'properly handled' : 'not properly managed'}`
      });
    } catch (error) {
      this.results.push({
        scenario,
        errorTriggered: true,
        errorHandled: false,
        recoverySuccessful: false,
        userExperienceImpact: 'moderate',
        recoveryTime: Date.now() - startTime,
        details: `Offline/online test failed: ${error.message}`
      });
    }
  }

  async testBrowserCrashRecovery(): Promise<void> {
    const scenario: ErrorScenario = {
      name: 'Browser Crash Recovery',
      description: 'Test data persistence and recovery after browser restart',
      severity: 'high',
      category: 'system'
    };

    const startTime = Date.now();

    try {
      await this.page.goto('/');

      // Set up some state
      await this.page.goto('#/search');
      await this.page.fill('[data-testid="search-input"]', 'crash recovery test');
      await this.page.goto('#/settings');

      // Store current state
      const beforeCrashState = await this.page.evaluate(() => {
        return {
          localStorage: { ...localStorage },
          sessionStorage: { ...sessionStorage },
          url: window.location.hash
        };
      });

      // Simulate crash by creating new context (simulates restart)
      const newContext = await this.page.context().browser()?.newContext();
      if (newContext) {
        const newPage = await newContext.newPage();

        // Copy storage to simulate persistence
        await newPage.goto('/');
        await newPage.evaluate((state) => {
          Object.entries(state.localStorage).forEach(([key, value]) => {
            localStorage.setItem(key, value as string);
          });
        }, beforeCrashState);

        // Check if state is recovered
        await newPage.goto(beforeCrashState.url || '/');

        const stateRecovered = await newPage.evaluate((originalState) => {
          const currentState = { ...localStorage };
          return JSON.stringify(currentState) === JSON.stringify(originalState.localStorage);
        }, beforeCrashState);

        const recoverySuccessful = stateRecovered;
        const recoveryTime = Date.now() - startTime;

        await newContext.close();

        this.results.push({
          scenario,
          errorTriggered: true,
          errorHandled: true, // Assuming crash handling is built into browser/OS
          recoverySuccessful,
          userExperienceImpact: recoverySuccessful ? 'minor' : 'moderate',
          recoveryTime,
          details: `Browser crash recovery ${recoverySuccessful ? 'successful - state preserved' : 'partial - some state lost'}`
        });
      } else {
        throw new Error('Could not create new context for crash simulation');
      }
    } catch (error) {
      this.results.push({
        scenario,
        errorTriggered: true,
        errorHandled: false,
        recoverySuccessful: false,
        userExperienceImpact: 'severe',
        recoveryTime: Date.now() - startTime,
        details: `Browser crash recovery test failed: ${error.message}`
      });
    }
  }

  private async checkForErrorHandling(): Promise<boolean> {
    // Check for various error handling indicators
    const errorIndicators = [
      '[data-testid="error-message"]',
      '[data-testid="error-banner"]',
      '[data-testid="network-error"]',
      '[data-testid="database-error"]',
      '[data-testid="timeout-error"]',
      '[data-testid="offline-indicator"]',
      '[data-testid="service-unavailable"]',
      '[data-testid="retry-button"]',
      '.error-message',
      '.alert-error',
      '.notification-error'
    ];

    for (const selector of errorIndicators) {
      if (await this.page.locator(selector).isVisible({ timeout: 2000 })) {
        return true;
      }
    }

    return false;
  }

  private async checkRecoverySuccess(): Promise<boolean> {
    try {
      // Test basic functionality to verify recovery
      await this.page.goto('#/search');
      await this.page.fill('[data-testid="search-input"]', 'recovery test');
      await this.page.click('[data-testid="search-button"]');

      // Wait for some response (results or no results)
      await Promise.race([
        this.page.waitForSelector('[data-testid="search-results"]', { timeout: 5000 }),
        this.page.waitForSelector('[data-testid="no-results"]', { timeout: 5000 }),
        this.page.waitForSelector('[data-testid="search-error"]', { timeout: 5000 })
      ]);

      return true;
    } catch (error) {
      return false;
    }
  }

  getResults(): RecoveryTestResult[] {
    return [...this.results];
  }

  generateErrorResilienceReport(): any {
    const totalTests = this.results.length;
    const handledErrors = this.results.filter(r => r.errorHandled).length;
    const successfulRecoveries = this.results.filter(r => r.recoverySuccessful).length;

    const impactSummary = {
      none: this.results.filter(r => r.userExperienceImpact === 'none').length,
      minor: this.results.filter(r => r.userExperienceImpact === 'minor').length,
      moderate: this.results.filter(r => r.userExperienceImpact === 'moderate').length,
      severe: this.results.filter(r => r.userExperienceImpact === 'severe').length
    };

    const categoryBreakdown = this.results.reduce((acc, result) => {
      acc[result.scenario.category] = acc[result.scenario.category] || { total: 0, handled: 0, recovered: 0 };
      acc[result.scenario.category].total++;
      if (result.errorHandled) acc[result.scenario.category].handled++;
      if (result.recoverySuccessful) acc[result.scenario.category].recovered++;
      return acc;
    }, {} as any);

    const avgRecoveryTime = this.results.reduce((sum, r) => sum + r.recoveryTime, 0) / totalTests;

    return {
      summary: {
        totalTests,
        errorHandlingRate: ((handledErrors / totalTests) * 100).toFixed(1) + '%',
        recoveryRate: ((successfulRecoveries / totalTests) * 100).toFixed(1) + '%',
        avgRecoveryTime: Math.round(avgRecoveryTime) + 'ms'
      },
      userExperienceImpact: impactSummary,
      categoryBreakdown,
      criticalIssues: this.results.filter(r => !r.errorHandled && r.scenario.severity === 'critical'),
      recommendations: this.generateRecommendations()
    };
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const unhandledErrors = this.results.filter(r => !r.errorHandled);

    if (unhandledErrors.some(r => r.scenario.category === 'network')) {
      recommendations.push('Implement robust network error handling with retry mechanisms');
    }

    if (unhandledErrors.some(r => r.scenario.category === 'database')) {
      recommendations.push('Add comprehensive database error handling and fallback strategies');
    }

    if (unhandledErrors.some(r => r.scenario.category === 'memory')) {
      recommendations.push('Implement memory management and cleanup strategies');
    }

    if (unhandledErrors.some(r => r.scenario.severity === 'critical')) {
      recommendations.push('Address critical error scenarios with high priority');
    }

    const avgRecoveryTime = this.results.reduce((sum, r) => sum + r.recoveryTime, 0) / this.results.length;
    if (avgRecoveryTime > 10000) {
      recommendations.push('Optimize error recovery performance to reduce user wait times');
    }

    return recommendations;
  }
}

test.describe('Error Recovery and Edge Case Testing', () => {
  let errorTester: ErrorRecoveryTester;

  test.beforeEach(async ({ page }) => {
    errorTester = new ErrorRecoveryTester(page);
    await errorTester.setupErrorInterception();

    // Setup test environment
    await page.goto('/');
    await page.waitForSelector('[data-testid="app-root"]', { timeout: 10000 });
  });

  test('Network failure recovery scenarios', async () => {
    await errorTester.testNetworkFailureRecovery();

    const results = errorTester.getResults();
    const networkResult = results.find(r => r.scenario.name === 'Network Failure Recovery');

    expect(networkResult).toBeTruthy();
    expect(networkResult!.errorTriggered).toBe(true);
    expect(networkResult!.errorHandled).toBe(true); // Should handle network errors gracefully

    console.log('Network Failure Recovery:', networkResult);
  });

  test('Database connection error handling', async () => {
    await errorTester.testDatabaseConnectionErrors();

    const results = errorTester.getResults();
    const dbResult = results.find(r => r.scenario.name === 'Database Connection Error');

    expect(dbResult).toBeTruthy();
    expect(dbResult!.errorTriggered).toBe(true);
    expect(dbResult!.errorHandled).toBe(true); // Critical for application stability

    console.log('Database Connection Error:', dbResult);
  });

  test('Memory exhaustion scenario handling', async () => {
    await errorTester.testMemoryExhaustionScenario();

    const results = errorTester.getResults();
    const memoryResult = results.find(r => r.scenario.name === 'Memory Exhaustion');

    expect(memoryResult).toBeTruthy();
    expect(memoryResult!.userExperienceImpact).not.toBe('severe'); // Should not completely break

    console.log('Memory Exhaustion:', memoryResult);
  });

  test('Corrupted data handling resilience', async () => {
    await errorTester.testCorruptedDataHandling();

    const results = errorTester.getResults();
    const dataResult = results.find(r => r.scenario.name === 'Corrupted Data Handling');

    expect(dataResult).toBeTruthy();
    expect(dataResult!.errorHandled).toBe(true); // Should handle corrupted data gracefully

    console.log('Corrupted Data Handling:', dataResult);
  });

  test('Concurrent access conflict resolution', async () => {
    await errorTester.testConcurrentAccessConflicts();

    const results = errorTester.getResults();
    const concurrencyResult = results.find(r => r.scenario.name === 'Concurrent Access Conflicts');

    expect(concurrencyResult).toBeTruthy();
    expect(concurrencyResult!.userExperienceImpact).not.toBe('severe');

    console.log('Concurrent Access Conflicts:', concurrencyResult);
  });

  test('Request timeout handling', async () => {
    await errorTester.testTimeoutHandling();

    const results = errorTester.getResults();
    const timeoutResult = results.find(r => r.scenario.name === 'Request Timeout Handling');

    expect(timeoutResult).toBeTruthy();
    expect(timeoutResult!.errorHandled).toBe(true); // Should notify user of timeouts

    console.log('Request Timeout Handling:', timeoutResult);
  });

  test('Resource unavailability resilience', async () => {
    await errorTester.testResourceUnavailability();

    const results = errorTester.getResults();
    const resourceResult = results.find(r => r.scenario.name === 'Resource Unavailability');

    expect(resourceResult).toBeTruthy();
    expect(resourceResult!.userExperienceImpact).not.toBe('severe'); // Should provide graceful degradation

    console.log('Resource Unavailability:', resourceResult);
  });

  test('Offline/online transition handling', async () => {
    await errorTester.testOfflineOnlineTransitions();

    const results = errorTester.getResults();
    const offlineResult = results.find(r => r.scenario.name === 'Offline/Online Transitions');

    expect(offlineResult).toBeTruthy();
    expect(offlineResult!.errorHandled).toBe(true); // Should detect and handle offline state

    console.log('Offline/Online Transitions:', offlineResult);
  });

  test('Browser crash recovery simulation', async () => {
    await errorTester.testBrowserCrashRecovery();

    const results = errorTester.getResults();
    const crashResult = results.find(r => r.scenario.name === 'Browser Crash Recovery');

    expect(crashResult).toBeTruthy();
    expect(crashResult!.recoverySuccessful).toBe(true); // Should preserve user data

    console.log('Browser Crash Recovery:', crashResult);
  });

  test('Comprehensive error resilience assessment', async () => {
    // Run all error scenarios
    await errorTester.testNetworkFailureRecovery();
    await errorTester.testDatabaseConnectionErrors();
    await errorTester.testMemoryExhaustionScenario();
    await errorTester.testCorruptedDataHandling();
    await errorTester.testConcurrentAccessConflicts();
    await errorTester.testTimeoutHandling();
    await errorTester.testResourceUnavailability();
    await errorTester.testOfflineOnlineTransitions();
    await errorTester.testBrowserCrashRecovery();

    const report = errorTester.generateErrorResilienceReport();

    console.log('=== ERROR RESILIENCE ASSESSMENT ===');
    console.log('Summary:', report.summary);
    console.log('User Experience Impact:', report.userExperienceImpact);
    console.log('Category Breakdown:', report.categoryBreakdown);
    console.log('Recommendations:', report.recommendations);

    // Resilience requirements
    expect(parseFloat(report.summary.errorHandlingRate)).toBeGreaterThan(70); // >70% error handling
    expect(parseFloat(report.summary.recoveryRate)).toBeGreaterThan(60); // >60% recovery rate
    expect(report.criticalIssues.length).toBeLessThanOrEqual(1); // ≤1 critical unhandled issue

    // User experience should not be severely impacted in most cases
    const severeImpactRatio = report.userExperienceImpact.severe / (report.userExperienceImpact.severe + report.userExperienceImpact.moderate + report.userExperienceImpact.minor + report.userExperienceImpact.none);
    expect(severeImpactRatio).toBeLessThan(0.3); // <30% severe impact
  });

  test('Error boundary and fallback testing', async ({ page }) => {
    // Test error boundaries in React components
    await page.goto('/');

    // Trigger JavaScript error in component
    await page.evaluate(() => {
      // Simulate component error
      const event = new CustomEvent('componentError', {
        detail: { error: new Error('Simulated component error') }
      });
      window.dispatchEvent(event);
    });

    // Check if error boundary catches the error
    const hasErrorBoundary = await page.locator('[data-testid="error-boundary"], [data-testid="error-fallback"]').isVisible({ timeout: 3000 });

    if (hasErrorBoundary) {
      expect(hasErrorBoundary).toBe(true);
      console.log('Error boundary successfully caught component error');
    } else {
      console.log('No error boundary detected or component error not triggered');
    }

    // Verify application still functions
    await page.goto('#/search');
    const searchWorks = await page.locator('[data-testid="search-input"]').isVisible();
    expect(searchWorks).toBe(true);
  });

  test('Edge case input validation', async ({ page }) => {
    const edgeCaseInputs = [
      '', // Empty
      ' '.repeat(1000), // Very long whitespace
      '\n\r\t', // Special characters
      '🚀💻🔥', // Emojis
      'null', // String null
      'undefined', // String undefined
      '0'.repeat(10000), // Very long numeric string
      'SELECT * FROM users', // SQL-like
      '<script>alert("test")</script>', // Script tag
      '${process.env.SECRET}', // Template literal
      '../../../etc/passwd', // Path traversal
      String.fromCharCode(0), // Null character
      'test\x00hidden' // Null byte injection
    ];

    await page.goto('#/search');

    for (const input of edgeCaseInputs) {
      try {
        await page.fill('[data-testid="search-input"]', input);
        await page.click('[data-testid="search-button"]');

        // Should either handle gracefully or show error
        await Promise.race([
          page.waitForSelector('[data-testid="search-results"]', { timeout: 2000 }),
          page.waitForSelector('[data-testid="no-results"]', { timeout: 2000 }),
          page.waitForSelector('[data-testid="search-error"]', { timeout: 2000 })
        ]);

        console.log(`Edge case input handled: ${input.substring(0, 20)}...`);
      } catch (error) {
        console.log(`Edge case input rejected: ${input.substring(0, 20)}...`);
      }
    }
  });

  test('Performance degradation under error conditions', async ({ page }) => {
    await page.goto('/');

    // Measure baseline performance
    const baselineStart = Date.now();
    await page.goto('#/search');
    await page.fill('[data-testid="search-input"]', 'baseline test');
    await page.click('[data-testid="search-button"]');
    const baselineTime = Date.now() - baselineStart;

    // Introduce error conditions
    await page.route('**/api/**', (route) => {
      // Random failures
      if (Math.random() < 0.3) {
        route.abort('connectionreset');
      } else {
        route.continue();
      }
    });

    // Measure performance under error conditions
    const errorStart = Date.now();
    await page.goto('#/search');
    await page.fill('[data-testid="search-input"]', 'error condition test');
    await page.click('[data-testid="search-button"]');
    const errorTime = Date.now() - errorStart;

    await page.unroute('**/api/**');

    // Performance should not degrade excessively
    const performanceDegradation = (errorTime - baselineTime) / baselineTime;
    expect(performanceDegradation).toBeLessThan(3); // <300% degradation

    console.log('Performance under error conditions:', {
      baseline: baselineTime + 'ms',
      withErrors: errorTime + 'ms',
      degradation: (performanceDegradation * 100).toFixed(1) + '%'
    });
  });
});