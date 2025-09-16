/**
 * Optimized Accessibility Test Runner
 *
 * Provides performance-optimized accessibility testing for CI/CD pipelines
 * with intelligent caching, parallel execution, and smart test selection.
 */

import { AxeResults, Result } from 'axe-core';
import { render, RenderResult } from '@testing-library/react';
import { axe } from 'jest-axe';
import React from 'react';

interface TestConfig {
  enableCache?: boolean;
  parallelExecution?: boolean;
  skipSlowTests?: boolean;
  maxExecutionTime?: number;
  focusedTests?: string[];
  excludeRules?: string[];
}

interface TestResult {
  componentName: string;
  executionTime: number;
  violations: Result[];
  passed: boolean;
  skipped: boolean;
  cached: boolean;
}

interface TestSuite {
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  totalTime: number;
  results: TestResult[];
}

export class OptimizedTestRunner {
  private cache: Map<string, TestResult> = new Map();
  private config: TestConfig;
  private performanceThreshold = 1000; // 1 second default

  constructor(config: TestConfig = {}) {
    this.config = {
      enableCache: true,
      parallelExecution: true,
      skipSlowTests: false,
      maxExecutionTime: 5000, // 5 seconds
      focusedTests: [],
      excludeRules: [],
      ...config,
    };
  }

  /**
   * Run accessibility tests on a single component with performance optimization
   */
  async testComponent(
    componentName: string,
    component: React.ReactElement,
    rules?: string[]
  ): Promise<TestResult> {
    const startTime = performance.now();
    const cacheKey = this.generateCacheKey(componentName, component, rules);

    // Check cache first
    if (this.config.enableCache && this.cache.has(cacheKey)) {
      const cachedResult = this.cache.get(cacheKey)!;
      return { ...cachedResult, cached: true };
    }

    // Skip slow tests in CI if configured
    if (this.config.skipSlowTests && this.isSlowTest(componentName)) {
      return {
        componentName,
        executionTime: 0,
        violations: [],
        passed: true,
        skipped: true,
        cached: false,
      };
    }

    let renderResult: RenderResult | null = null;
    let axeResults: AxeResults | null = null;

    try {
      // Render component with timeout
      renderResult = await this.withTimeout(
        () => render(component),
        this.config.maxExecutionTime!
      );

      // Configure axe for performance
      const axeConfig = {
        rules: this.buildOptimizedRules(rules),
        tags: ['wcag2a', 'wcag2aa', 'wcag21aa'],
        exclude: [
          // Exclude potentially slow selectors
          '[data-testid="complex-chart"]',
          '[data-testid="large-table"]',
        ],
      };

      // Run axe with performance optimization
      axeResults = await this.withTimeout(
        () => axe(renderResult!.container, axeConfig),
        this.config.maxExecutionTime! - (performance.now() - startTime)
      );

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      const result: TestResult = {
        componentName,
        executionTime,
        violations: axeResults.violations,
        passed: axeResults.violations.length === 0,
        skipped: false,
        cached: false,
      };

      // Cache successful results
      if (this.config.enableCache && result.passed) {
        this.cache.set(cacheKey, result);
      }

      return result;
    } catch (error) {
      console.warn(`Accessibility test failed for ${componentName}:`, error);

      return {
        componentName,
        executionTime: performance.now() - startTime,
        violations: [{
          id: 'test-error',
          description: `Test execution error: ${error instanceof Error ? error.message : String(error)}`,
          help: 'Fix the underlying component issue',
          helpUrl: '',
          impact: 'critical' as const,
          nodes: [],
          tags: ['error'],
        }],
        passed: false,
        skipped: false,
        cached: false,
      };
    } finally {
      // Cleanup
      if (renderResult) {
        renderResult.unmount();
      }
    }
  }

  /**
   * Run accessibility tests on multiple components with parallel execution
   */
  async testSuite(components: Array<{
    name: string;
    component: React.ReactElement;
    rules?: string[];
  }>): Promise<TestSuite> {
    const startTime = performance.now();

    // Filter focused tests if specified
    const testsToRun = this.config.focusedTests && this.config.focusedTests.length > 0
      ? components.filter(c => this.config.focusedTests!.includes(c.name))
      : components;

    let results: TestResult[];

    if (this.config.parallelExecution) {
      // Run tests in parallel with controlled concurrency
      const concurrency = Math.min(testsToRun.length, 4); // Max 4 parallel tests
      results = await this.runParallel(testsToRun, concurrency);
    } else {
      // Run tests sequentially
      results = await this.runSequential(testsToRun);
    }

    const endTime = performance.now();

    return {
      totalTests: testsToRun.length,
      passed: results.filter(r => r.passed).length,
      failed: results.filter(r => !r.passed && !r.skipped).length,
      skipped: results.filter(r => r.skipped).length,
      totalTime: endTime - startTime,
      results,
    };
  }

  /**
   * Generate performance report
   */
  generatePerformanceReport(suite: TestSuite): string {
    const avgTime = suite.totalTime / suite.totalTests;
    const slowTests = suite.results
      .filter(r => r.executionTime > this.performanceThreshold)
      .sort((a, b) => b.executionTime - a.executionTime);

    return `
Accessibility Test Performance Report
=====================================

Summary:
- Total Tests: ${suite.totalTests}
- Passed: ${suite.passed}
- Failed: ${suite.failed}
- Skipped: ${suite.skipped}
- Total Time: ${Math.round(suite.totalTime)}ms
- Average Time: ${Math.round(avgTime)}ms

Performance Analysis:
- Tests over ${this.performanceThreshold}ms: ${slowTests.length}
${slowTests.length > 0 ? `
Slow Tests:
${slowTests.map(t => `  - ${t.componentName}: ${Math.round(t.executionTime)}ms`).join('\n')}
` : ''}

Cache Performance:
- Cached Results: ${suite.results.filter(r => r.cached).length}
- Cache Hit Rate: ${Math.round((suite.results.filter(r => r.cached).length / suite.totalTests) * 100)}%

Recommendations:
${this.generateRecommendations(suite)}
    `.trim();
  }

  /**
   * Clear test cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  // Private methods

  private async withTimeout<T>(
    operation: () => Promise<T> | T,
    timeoutMs: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      Promise.resolve(operation())
        .then(result => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  private generateCacheKey(
    componentName: string,
    component: React.ReactElement,
    rules?: string[]
  ): string {
    // Create a simple hash based on component name and rules
    const rulesStr = rules ? rules.sort().join(',') : '';
    return `${componentName}-${rulesStr}`;
  }

  private isSlowTest(componentName: string): boolean {
    const slowTestPatterns = [
      /chart/i,
      /table.*large/i,
      /visualization/i,
      /complex.*form/i,
    ];

    return slowTestPatterns.some(pattern => pattern.test(componentName));
  }

  private buildOptimizedRules(rules?: string[]): Record<string, any> {
    const optimizedRules: Record<string, any> = {};

    // Disable slow/intensive rules for performance
    const slowRules = [
      'color-contrast-enhanced', // Use basic color-contrast instead
      'focus-order-semantics',   // Can be slow on large DOM
      'landmark-contentinfo-is-top-level',
    ];

    // Disable excluded rules
    [...slowRules, ...(this.config.excludeRules || [])].forEach(rule => {
      optimizedRules[rule] = { enabled: false };
    });

    // Enable specific rules if provided
    if (rules) {
      rules.forEach(rule => {
        optimizedRules[rule] = { enabled: true };
      });
    }

    return optimizedRules;
  }

  private async runParallel(
    tests: Array<{ name: string; component: React.ReactElement; rules?: string[] }>,
    concurrency: number
  ): Promise<TestResult[]> {
    const results: TestResult[] = [];

    for (let i = 0; i < tests.length; i += concurrency) {
      const batch = tests.slice(i, i + concurrency);
      const batchPromises = batch.map(test =>
        this.testComponent(test.name, test.component, test.rules)
      );

      const batchResults = await Promise.allSettled(batchPromises);

      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            componentName: batch[index].name,
            executionTime: 0,
            violations: [{
              id: 'parallel-test-error',
              description: `Parallel test execution failed: ${result.reason}`,
              help: 'Check component for issues',
              helpUrl: '',
              impact: 'critical' as const,
              nodes: [],
              tags: ['error'],
            }],
            passed: false,
            skipped: false,
            cached: false,
          });
        }
      });
    }

    return results;
  }

  private async runSequential(
    tests: Array<{ name: string; component: React.ReactElement; rules?: string[] }>
  ): Promise<TestResult[]> {
    const results: TestResult[] = [];

    for (const test of tests) {
      const result = await this.testComponent(test.name, test.component, test.rules);
      results.push(result);
    }

    return results;
  }

  private generateRecommendations(suite: TestSuite): string {
    const recommendations: string[] = [];

    // Performance recommendations
    const slowTests = suite.results.filter(r => r.executionTime > this.performanceThreshold);
    if (slowTests.length > 0) {
      recommendations.push('- Consider optimizing slow components or using test mocking');
    }

    // Cache recommendations
    const cacheHitRate = suite.results.filter(r => r.cached).length / suite.totalTests;
    if (cacheHitRate < 0.3) {
      recommendations.push('- Consider enabling test caching for better performance');
    }

    // Failure recommendations
    const failedTests = suite.results.filter(r => !r.passed && !r.skipped);
    if (failedTests.length > 0) {
      recommendations.push('- Address accessibility violations in failed components');
    }

    // Parallel execution recommendations
    if (!this.config.parallelExecution && suite.totalTests > 5) {
      recommendations.push('- Enable parallel execution for faster test runs');
    }

    return recommendations.length > 0 ? recommendations.join('\n') : '- All tests are running efficiently';
  }
}

// Export a default instance for easy use
export const optimizedTestRunner = new OptimizedTestRunner();

// Export utility functions
export const createFastAccessibilityTest = (
  componentName: string,
  component: React.ReactElement,
  rules?: string[]
) => {
  return optimizedTestRunner.testComponent(componentName, component, rules);
};

export const createAccessibilityTestSuite = (
  components: Array<{
    name: string;
    component: React.ReactElement;
    rules?: string[];
  }>
) => {
  return optimizedTestRunner.testSuite(components);
};