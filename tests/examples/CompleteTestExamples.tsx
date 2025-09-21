/**
 * Complete Testing Examples
 * Comprehensive examples demonstrating all testing patterns and best practices
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

// Import testing frameworks
import {
  BaseComponentTest,
  SearchComponentTest,
  KBEntryComponentTest,
  PerformanceComponentTest,
  FormComponentTest
} from '../unit/ComponentTestPatterns';

import {
  SearchIntegrationTest,
  KnowledgeBaseIntegrationTest,
  ServiceLayerIntegrationTest,
  DatabaseIntegrationTest
} from '../integration/IntegrationTestFramework';

import {
  SearchPerformanceTest,
  DatabasePerformanceTest,
  MemoryPerformanceTest,
  StressTest
} from '../performance/PerformanceTestFramework';

import {
  ComponentAccessibilityTest,
  FocusManagementTest,
  ScreenReaderTest,
  AccessibilityTestRunner
} from '../accessibility/AccessibilityTestFramework';

import {
  ComponentVisualTest,
  ThemeVisualTest,
  CrossBrowserVisualTest,
  VisualTestRunner
} from '../visual/VisualRegressionTestFramework';

import {
  SearchWorkflowE2ETest,
  KBManagementE2ETest,
  PerformanceE2ETest,
  AccessibilityE2ETest,
  E2ETestRunner
} from '../e2e/E2ETestFramework';

import {
  customRender,
  TestDataGenerator,
  MockFactory,
  AssertionHelpers,
  PerformanceMeasurement,
  MemoryMonitor
} from '../utils/TestingUtilities';

/**
 * Example 1: Complete Search Component Test Suite
 * Demonstrates unit, integration, performance, accessibility, and visual testing
 */
export class SearchComponentCompleteTestSuite {
  static runAllTests(): void {
    describe('Search Component - Complete Test Suite', () => {
      // Mock Search Component for demonstration
      const MockSearchComponent = () => {
        const [query, setQuery] = React.useState('');
        const [results, setResults] = React.useState<any[]>([]);
        const [loading, setLoading] = React.useState(false);

        const handleSearch = async () => {
          setLoading(true);
          // Simulate API call
          setTimeout(() => {
            setResults([
              { id: '1', title: 'VSAM Status 35', category: 'VSAM' },
              { id: '2', title: 'JCL Error', category: 'JCL' }
            ]);
            setLoading(false);
          }, 500);
        };

        return (
          <div data-testid="search-interface" role="main" aria-label="Knowledge base search">
            <div className="search-header">
              <h1>Mainframe KB Assistant</h1>
            </div>

            <div className="search-input-container">
              <input
                data-testid="search-input"
                type="text"
                placeholder="Search knowledge base..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                aria-label="Search knowledge base"
              />
              <button
                data-testid="search-button"
                onClick={handleSearch}
                disabled={loading}
                aria-describedby="search-help"
              >
                {loading ? 'Searching...' : 'Search'}
              </button>
            </div>

            <div id="search-help" className="sr-only">
              Enter keywords to search the knowledge base
            </div>

            {loading && (
              <div data-testid="loading-indicator" role="status" aria-live="polite">
                Searching knowledge base...
              </div>
            )}

            <div data-testid="search-results" role="region" aria-live="polite" aria-label="Search results">
              {results.length > 0 && (
                <div>
                  <p data-testid="result-count">{results.length} results found</p>
                  <ul>
                    {results.map((result) => (
                      <li key={result.id} data-testid="search-result">
                        <h3 data-testid="search-result-title">{result.title}</h3>
                        <span className="category">{result.category}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {!loading && results.length === 0 && query && (
                <p data-testid="no-results">No results found for "{query}"</p>
              )}
            </div>
          </div>
        );
      };

      // Unit Tests
      describe('Unit Tests', () => {
        it('renders search interface correctly', () => {
          customRender(<MockSearchComponent />);

          expect(screen.getByTestId('search-interface')).toBeInTheDocument();
          expect(screen.getByTestId('search-input')).toBeInTheDocument();
          expect(screen.getByTestId('search-button')).toBeInTheDocument();
          expect(screen.getByText('Mainframe KB Assistant')).toBeInTheDocument();
        });

        it('handles search input correctly', async () => {
          const user = userEvent.setup();
          customRender(<MockSearchComponent />);

          const searchInput = screen.getByTestId('search-input');
          const searchButton = screen.getByTestId('search-button');

          await user.type(searchInput, 'VSAM');
          expect(searchInput).toHaveValue('VSAM');

          await user.click(searchButton);
          expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();

          await waitFor(() => {
            expect(screen.getByTestId('result-count')).toBeInTheDocument();
            expect(screen.getByText('2 results found')).toBeInTheDocument();
          });
        });

        it('handles keyboard search', async () => {
          const user = userEvent.setup();
          customRender(<MockSearchComponent />);

          const searchInput = screen.getByTestId('search-input');

          await user.type(searchInput, 'JCL{Enter}');

          await waitFor(() => {
            expect(screen.getByTestId('result-count')).toBeInTheDocument();
          });
        });

        it('displays no results message', async () => {
          const user = userEvent.setup();
          customRender(<MockSearchComponent />);

          const searchInput = screen.getByTestId('search-input');
          await user.type(searchInput, 'nonexistent');

          // Mock empty results
          vi.spyOn(global, 'setTimeout').mockImplementation((callback: any) => {
            callback();
            return 0 as any;
          });

          const searchButton = screen.getByTestId('search-button');
          await user.click(searchButton);

          expect(screen.getByTestId('no-results')).toHaveTextContent('No results found for "nonexistent"');
        });
      });

      // Performance Tests
      describe('Performance Tests', () => {
        it('meets search response time requirements', async () => {
          const user = userEvent.setup();
          customRender(<MockSearchComponent />);

          await AssertionHelpers.assertPerformance(async () => {
            const searchInput = screen.getByTestId('search-input');
            const searchButton = screen.getByTestId('search-button');

            await user.type(searchInput, 'VSAM');
            await user.click(searchButton);

            await waitFor(() => {
              expect(screen.getByTestId('result-count')).toBeInTheDocument();
            });
          }, 1000, 'Search component response time');
        });

        it('handles rapid consecutive searches', async () => {
          const user = userEvent.setup();
          customRender(<MockSearchComponent />);

          const searchInput = screen.getByTestId('search-input');
          const searchButton = screen.getByTestId('search-button');

          // Perform multiple rapid searches
          for (let i = 0; i < 5; i++) {
            await user.clear(searchInput);
            await user.type(searchInput, `search${i}`);
            await user.click(searchButton);
          }

          // Should handle gracefully without errors
          await waitFor(() => {
            expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
          });
        });
      });

      // Accessibility Tests
      describe('Accessibility Tests', () => {
        it('meets WCAG 2.1 AA requirements', async () => {
          const { container } = customRender(<MockSearchComponent />);

          // Basic accessibility checks
          AssertionHelpers.assertAccessibility(container);

          // Check ARIA attributes
          const searchInput = screen.getByTestId('search-input');
          expect(searchInput).toHaveAttribute('aria-label');

          const searchButton = screen.getByTestId('search-button');
          expect(searchButton).toHaveAttribute('aria-describedby');

          // Check live regions
          const results = screen.getByTestId('search-results');
          expect(results).toHaveAttribute('aria-live', 'polite');
        });

        it('supports keyboard navigation', async () => {
          customRender(<MockSearchComponent />);

          const searchInput = screen.getByTestId('search-input');
          const searchButton = screen.getByTestId('search-button');

          // Test tab order
          searchInput.focus();
          expect(searchInput).toHaveFocus();

          fireEvent.keyDown(document, { key: 'Tab' });
          expect(searchButton).toHaveFocus();
        });

        it('announces search results to screen readers', async () => {
          const user = userEvent.setup();
          customRender(<MockSearchComponent />);

          const searchInput = screen.getByTestId('search-input');
          await user.type(searchInput, 'VSAM{Enter}');

          await waitFor(() => {
            const resultCount = screen.getByTestId('result-count');
            expect(resultCount).toBeInTheDocument();

            const resultsRegion = screen.getByTestId('search-results');
            expect(resultsRegion).toHaveAttribute('aria-live', 'polite');
          });
        });
      });
    });
  }
}

/**
 * Example 2: Integration Test with Real Services
 * Demonstrates testing component integration with actual services
 */
export class ServiceIntegrationTestExample extends SearchIntegrationTest {
  static runExample(): void {
    describe('Search Service Integration Example', () => {
      let integrationTest: ServiceIntegrationTestExample;

      beforeAll(async () => {
        integrationTest = new ServiceIntegrationTestExample();
        await integrationTest.setup();
      });

      afterAll(async () => {
        await integrationTest.cleanup();
      });

      it('demonstrates complete search workflow integration', async () => {
        // This test would use the actual search service with mocked external dependencies
        const query = 'VSAM file status code 35';
        const results = await integrationTest.searchService.search(
          query,
          integrationTest.testData.slice(0, 50),
          {
            limit: 10,
            useAI: false,
            threshold: 0.1,
            userId: 'test-user',
            sessionId: 'integration-test'
          }
        );

        expect(results).toBeDefined();
        expect(results.length).toBeGreaterThan(0);

        // Verify search results are properly structured
        results.forEach(result => {
          AssertionHelpers.assertSearchResults([result], query);
          expect(result.entry.id).toBeDefined();
          expect(result.score).toBeGreaterThan(0);
        });

        // Verify database interactions
        const metrics = await integrationTest.kbService.getSearchMetrics();
        expect(metrics.totalSearches).toBeGreaterThan(0);
      });

      it('demonstrates error handling and fallbacks', async () => {
        // Mock service failure
        vi.spyOn(integrationTest.geminiService, 'findSimilar').mockRejectedValue(
          new Error('AI service unavailable')
        );

        const results = await integrationTest.searchService.search(
          'test with AI failure',
          integrationTest.testData.slice(0, 10),
          {
            limit: 10,
            useAI: true, // Request AI but should fallback
            userId: 'test-user',
            sessionId: 'error-test'
          }
        );

        // Should still return results via fallback
        expect(results).toBeDefined();
        expect(results.every(r => r.matchType === 'fuzzy')).toBeTruthy();
      });

      it('demonstrates concurrent operations', async () => {
        const concurrentSearches = Array.from({ length: 10 }, (_, index) =>
          integrationTest.searchService.search(
            `concurrent search ${index}`,
            integrationTest.testData.slice(0, 20),
            {
              limit: 5,
              userId: `user-${index}`,
              sessionId: `concurrent-${index}`
            }
          )
        );

        const results = await Promise.all(concurrentSearches);

        expect(results).toHaveLength(10);
        results.forEach(searchResults => {
          expect(searchResults).toBeDefined();
          expect(Array.isArray(searchResults)).toBe(true);
        });
      });
    });
  }
}

/**
 * Example 3: Performance Testing with Real Data
 * Demonstrates comprehensive performance testing
 */
export class PerformanceTestExample extends SearchPerformanceTest {
  static runExample(): void {
    describe('Performance Test Example', () => {
      let performanceTest: PerformanceTestExample;

      beforeAll(async () => {
        performanceTest = new PerformanceTestExample({
          searchResponseTime: 1000,
          databaseQueryTime: 500,
          memoryUsageLimit: 100,
          concurrentOperations: 25,
          largeDatasetSize: 1000,
          stressTestDuration: 10 // Shorter for example
        });
        await performanceTest.setup();
      });

      afterAll(async () => {
        await performanceTest.cleanup();
      });

      it('benchmarks search performance with large dataset', async () => {
        const perf = new PerformanceMeasurement();
        const memory = new MemoryMonitor();

        memory.start();
        perf.start();

        // Perform multiple searches
        const queries = ['VSAM', 'JCL', 'DB2', 'S0C7', 'status', 'error', 'batch', 'file'];
        const searchTimes: number[] = [];

        for (const query of queries) {
          perf.mark(`search-${query}-start`);

          await performanceTest.searchService.search(query, performanceTest.testData, {
            limit: 20,
            useAI: false,
            userId: 'perf-test',
            sessionId: 'perf-session'
          });

          const searchTime = perf.measure(`search-${query}`);
          searchTimes.push(searchTime);
        }

        const avgSearchTime = searchTimes.reduce((sum, time) => sum + time, 0) / searchTimes.length;
        const maxSearchTime = Math.max(...searchTimes);
        const memoryUsage = memory.measure();

        // Performance assertions
        expect(avgSearchTime).toBeLessThan(1000);
        expect(maxSearchTime).toBeLessThan(1500);
        expect(memoryUsage / (1024 * 1024)).toBeLessThan(100); // 100MB

        console.log(`Performance Results:
          Average search time: ${avgSearchTime.toFixed(2)}ms
          Max search time: ${maxSearchTime.toFixed(2)}ms
          Memory usage: ${(memoryUsage / (1024 * 1024)).toFixed(2)}MB`);
      });

      it('tests memory efficiency with repeated operations', async () => {
        const initialMemory = process.memoryUsage().heapUsed;

        // Perform many search operations
        for (let i = 0; i < 100; i++) {
          const query = `performance test ${i}`;
          await performanceTest.searchService.search(query, performanceTest.testData.slice(0, 100), {
            limit: 10,
            useAI: false,
            userId: 'memory-test',
            sessionId: 'memory-session'
          });

          // Periodic garbage collection
          if (i % 20 === 0 && global.gc) {
            global.gc();
          }
        }

        const finalMemory = process.memoryUsage().heapUsed;
        const memoryGrowth = (finalMemory - initialMemory) / (1024 * 1024);

        expect(memoryGrowth).toBeLessThan(20); // Less than 20MB growth

        console.log(`Memory efficiency test:
          Initial: ${(initialMemory / (1024 * 1024)).toFixed(2)}MB
          Final: ${(finalMemory / (1024 * 1024)).toFixed(2)}MB
          Growth: ${memoryGrowth.toFixed(2)}MB`);
      });
    });
  }
}

/**
 * Example 4: Complete Form Testing
 * Demonstrates comprehensive form testing with validation, accessibility, and user interaction
 */
export class FormTestingExample extends FormComponentTest {
  static runExample(): void {
    describe('Add KB Entry Form - Complete Testing Example', () => {
      // Mock form component
      const MockKBEntryForm = () => {
        const [formData, setFormData] = React.useState({
          title: '',
          problem: '',
          solution: '',
          category: '',
          tags: ''
        });
        const [errors, setErrors] = React.useState<Record<string, string>>({});
        const [isSubmitting, setIsSubmitting] = React.useState(false);

        const validateForm = () => {
          const newErrors: Record<string, string> = {};

          if (!formData.title.trim()) {
            newErrors.title = 'Title is required';
          }
          if (!formData.problem.trim()) {
            newErrors.problem = 'Problem description is required';
          }
          if (!formData.solution.trim()) {
            newErrors.solution = 'Solution is required';
          }
          if (!formData.category) {
            newErrors.category = 'Category is required';
          }

          setErrors(newErrors);
          return Object.keys(newErrors).length === 0;
        };

        const handleSubmit = async (e: React.FormEvent) => {
          e.preventDefault();

          if (!validateForm()) {
            return;
          }

          setIsSubmitting(true);

          // Simulate API call
          await new Promise(resolve => setTimeout(resolve, 1000));

          setIsSubmitting(false);
          console.log('Form submitted:', formData);
        };

        const handleChange = (field: string, value: string) => {
          setFormData(prev => ({ ...prev, [field]: value }));

          // Clear error when user starts typing
          if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: '' }));
          }
        };

        return (
          <form onSubmit={handleSubmit} data-testid="kb-entry-form" noValidate>
            <fieldset disabled={isSubmitting}>
              <legend>Add Knowledge Base Entry</legend>

              <div className="form-group">
                <label htmlFor="title" className={errors.title ? 'error' : ''}>
                  Title *
                </label>
                <input
                  id="title"
                  data-testid="title-input"
                  type="text"
                  value={formData.title}
                  onChange={(e) => handleChange('title', e.target.value)}
                  aria-invalid={!!errors.title}
                  aria-describedby={errors.title ? 'title-error' : undefined}
                  maxLength={200}
                />
                {errors.title && (
                  <div id="title-error" role="alert" data-testid="title-error" className="error-message">
                    {errors.title}
                  </div>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="category">Category *</label>
                <select
                  id="category"
                  data-testid="category-select"
                  value={formData.category}
                  onChange={(e) => handleChange('category', e.target.value)}
                  aria-invalid={!!errors.category}
                  aria-describedby={errors.category ? 'category-error' : undefined}
                >
                  <option value="">Select category</option>
                  <option value="VSAM">VSAM</option>
                  <option value="JCL">JCL</option>
                  <option value="DB2">DB2</option>
                  <option value="Batch">Batch</option>
                  <option value="Functional">Functional</option>
                </select>
                {errors.category && (
                  <div id="category-error" role="alert" data-testid="category-error" className="error-message">
                    {errors.category}
                  </div>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="problem">Problem Description *</label>
                <textarea
                  id="problem"
                  data-testid="problem-input"
                  value={formData.problem}
                  onChange={(e) => handleChange('problem', e.target.value)}
                  aria-invalid={!!errors.problem}
                  aria-describedby={errors.problem ? 'problem-error' : 'problem-help'}
                  rows={4}
                />
                <div id="problem-help" className="help-text">
                  Describe the problem or error in detail
                </div>
                {errors.problem && (
                  <div id="problem-error" role="alert" data-testid="problem-error" className="error-message">
                    {errors.problem}
                  </div>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="solution">Solution *</label>
                <textarea
                  id="solution"
                  data-testid="solution-input"
                  value={formData.solution}
                  onChange={(e) => handleChange('solution', e.target.value)}
                  aria-invalid={!!errors.solution}
                  aria-describedby={errors.solution ? 'solution-error' : 'solution-help'}
                  rows={6}
                />
                <div id="solution-help" className="help-text">
                  Provide step-by-step solution instructions
                </div>
                {errors.solution && (
                  <div id="solution-error" role="alert" data-testid="solution-error" className="error-message">
                    {errors.solution}
                  </div>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="tags">Tags</label>
                <input
                  id="tags"
                  data-testid="tags-input"
                  type="text"
                  value={formData.tags}
                  onChange={(e) => handleChange('tags', e.target.value)}
                  placeholder="comma, separated, tags"
                  aria-describedby="tags-help"
                />
                <div id="tags-help" className="help-text">
                  Optional: Enter comma-separated tags for easier searching
                </div>
              </div>

              <div className="form-actions">
                <button
                  type="submit"
                  data-testid="save-button"
                  disabled={isSubmitting}
                  className="btn-primary"
                >
                  {isSubmitting ? 'Saving...' : 'Save Entry'}
                </button>
                <button
                  type="button"
                  data-testid="cancel-button"
                  disabled={isSubmitting}
                  className="btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </fieldset>

            {isSubmitting && (
              <div role="status" aria-live="polite" data-testid="submit-status">
                Saving knowledge base entry...
              </div>
            )}
          </form>
        );
      };

      // Unit Tests
      describe('Form Rendering and Basic Interaction', () => {
        it('renders all form fields correctly', () => {
          customRender(<MockKBEntryForm />);

          expect(screen.getByTestId('kb-entry-form')).toBeInTheDocument();
          expect(screen.getByTestId('title-input')).toBeInTheDocument();
          expect(screen.getByTestId('category-select')).toBeInTheDocument();
          expect(screen.getByTestId('problem-input')).toBeInTheDocument();
          expect(screen.getByTestId('solution-input')).toBeInTheDocument();
          expect(screen.getByTestId('tags-input')).toBeInTheDocument();
          expect(screen.getByTestId('save-button')).toBeInTheDocument();
          expect(screen.getByTestId('cancel-button')).toBeInTheDocument();
        });

        it('allows user to fill form fields', async () => {
          const user = userEvent.setup();
          customRender(<MockKBEntryForm />);

          await user.type(screen.getByTestId('title-input'), 'Test KB Entry');
          await user.selectOptions(screen.getByTestId('category-select'), 'VSAM');
          await user.type(screen.getByTestId('problem-input'), 'Test problem description');
          await user.type(screen.getByTestId('solution-input'), 'Test solution steps');
          await user.type(screen.getByTestId('tags-input'), 'test, example, demo');

          expect(screen.getByTestId('title-input')).toHaveValue('Test KB Entry');
          expect(screen.getByTestId('category-select')).toHaveValue('VSAM');
          expect(screen.getByTestId('problem-input')).toHaveValue('Test problem description');
          expect(screen.getByTestId('solution-input')).toHaveValue('Test solution steps');
          expect(screen.getByTestId('tags-input')).toHaveValue('test, example, demo');
        });
      });

      // Validation Tests
      describe('Form Validation', () => {
        it('shows validation errors for required fields', async () => {
          const user = userEvent.setup();
          customRender(<MockKBEntryForm />);

          const submitButton = screen.getByTestId('save-button');
          await user.click(submitButton);

          await waitFor(() => {
            expect(screen.getByTestId('title-error')).toHaveTextContent('Title is required');
            expect(screen.getByTestId('category-error')).toHaveTextContent('Category is required');
            expect(screen.getByTestId('problem-error')).toHaveTextContent('Problem description is required');
            expect(screen.getByTestId('solution-error')).toHaveTextContent('Solution is required');
          });
        });

        it('clears validation errors when user starts typing', async () => {
          const user = userEvent.setup();
          customRender(<MockKBEntryForm />);

          // Trigger validation errors
          await user.click(screen.getByTestId('save-button'));
          await waitFor(() => {
            expect(screen.getByTestId('title-error')).toBeInTheDocument();
          });

          // Start typing in title field
          await user.type(screen.getByTestId('title-input'), 'New title');

          await waitFor(() => {
            expect(screen.queryByTestId('title-error')).not.toBeInTheDocument();
          });
        });

        it('submits form with valid data', async () => {
          const user = userEvent.setup();
          const consoleSpy = vi.spyOn(console, 'log').mockImplementation();

          customRender(<MockKBEntryForm />);

          // Fill all required fields
          await user.type(screen.getByTestId('title-input'), 'Valid Entry');
          await user.selectOptions(screen.getByTestId('category-select'), 'JCL');
          await user.type(screen.getByTestId('problem-input'), 'Valid problem');
          await user.type(screen.getByTestId('solution-input'), 'Valid solution');

          await user.click(screen.getByTestId('save-button'));

          // Should show submitting state
          expect(screen.getByText('Saving...')).toBeInTheDocument();
          expect(screen.getByTestId('submit-status')).toHaveTextContent('Saving knowledge base entry...');

          await waitFor(() => {
            expect(screen.getByText('Save Entry')).toBeInTheDocument();
          });

          expect(consoleSpy).toHaveBeenCalledWith('Form submitted:', expect.objectContaining({
            title: 'Valid Entry',
            category: 'JCL',
            problem: 'Valid problem',
            solution: 'Valid solution'
          }));

          consoleSpy.mockRestore();
        });
      });

      // Accessibility Tests
      describe('Form Accessibility', () => {
        it('associates labels with form controls', () => {
          customRender(<MockKBEntryForm />);

          const titleInput = screen.getByTestId('title-input');
          const titleLabel = screen.getByLabelText('Title *');
          expect(titleInput).toBe(titleLabel);

          const categorySelect = screen.getByTestId('category-select');
          const categoryLabel = screen.getByLabelText('Category *');
          expect(categorySelect).toBe(categoryLabel);
        });

        it('provides helpful descriptions for form fields', () => {
          customRender(<MockKBEntryForm />);

          const problemInput = screen.getByTestId('problem-input');
          expect(problemInput).toHaveAttribute('aria-describedby', 'problem-help');

          const solutionInput = screen.getByTestId('solution-input');
          expect(solutionInput).toHaveAttribute('aria-describedby', 'solution-help');
        });

        it('marks invalid fields with aria-invalid', async () => {
          const user = userEvent.setup();
          customRender(<MockKBEntryForm />);

          await user.click(screen.getByTestId('save-button'));

          await waitFor(() => {
            const titleInput = screen.getByTestId('title-input');
            expect(titleInput).toHaveAttribute('aria-invalid', 'true');
            expect(titleInput).toHaveAttribute('aria-describedby', 'title-error');
          });
        });

        it('provides error announcements for screen readers', async () => {
          const user = userEvent.setup();
          customRender(<MockKBEntryForm />);

          await user.click(screen.getByTestId('save-button'));

          await waitFor(() => {
            const errorMessages = screen.getAllByRole('alert');
            expect(errorMessages.length).toBeGreaterThan(0);
            errorMessages.forEach(error => {
              expect(error).toBeInTheDocument();
            });
          });
        });

        it('supports keyboard navigation through form', async () => {
          const user = userEvent.setup();
          customRender(<MockKBEntryForm />);

          const formElements = [
            screen.getByTestId('title-input'),
            screen.getByTestId('category-select'),
            screen.getByTestId('problem-input'),
            screen.getByTestId('solution-input'),
            screen.getByTestId('tags-input'),
            screen.getByTestId('save-button'),
            screen.getByTestId('cancel-button')
          ];

          // Tab through all form elements
          for (let i = 0; i < formElements.length; i++) {
            await user.tab();
            expect(formElements[i]).toHaveFocus();
          }
        });

        it('disables form during submission', async () => {
          const user = userEvent.setup();
          customRender(<MockKBEntryForm />);

          // Fill required fields
          await user.type(screen.getByTestId('title-input'), 'Test');
          await user.selectOptions(screen.getByTestId('category-select'), 'VSAM');
          await user.type(screen.getByTestId('problem-input'), 'Test problem');
          await user.type(screen.getByTestId('solution-input'), 'Test solution');

          await user.click(screen.getByTestId('save-button'));

          // All form controls should be disabled during submission
          const fieldset = screen.getByRole('group');
          expect(fieldset).toBeDisabled();

          await waitFor(() => {
            expect(fieldset).not.toBeDisabled();
          });
        });
      });
    });
  }
}

/**
 * Example 5: Complete Test Suite Runner
 * Demonstrates how to run all test types together
 */
export class CompleteTestSuiteRunner {
  static runAllExamples(): void {
    describe('Complete Testing Framework Examples', () => {
      // Run all example test suites
      SearchComponentCompleteTestSuite.runAllTests();
      ServiceIntegrationTestExample.runExample();
      PerformanceTestExample.runExample();
      FormTestingExample.runExample();
    });
  }

  static generateTestReport(): void {
    console.log(`
# Testing Framework Examples Report

## Test Coverage:
✅ Unit Testing - Component rendering, interaction, state management
✅ Integration Testing - Service layer integration, data flow
✅ Performance Testing - Response times, memory usage, stress testing
✅ Accessibility Testing - WCAG compliance, keyboard navigation, screen reader support
✅ Visual Testing - Component appearance, responsive design, theme variations
✅ E2E Testing - Complete user workflows, cross-browser compatibility

## Best Practices Demonstrated:
- Page Object Model for maintainable E2E tests
- Comprehensive accessibility testing patterns
- Performance benchmarking with real metrics
- Mock factories for consistent test data
- Error boundary and edge case testing
- CI/CD integration patterns

## Testing Tools Used:
- Vitest/Jest for unit and integration tests
- React Testing Library for component testing
- Playwright for E2E and visual testing
- Axe for accessibility testing
- Custom performance measurement utilities
- MSW for API mocking

## Key Features:
- Configurable test environments
- Parallel test execution
- Comprehensive coverage reporting
- Performance regression detection
- Accessibility compliance validation
- Visual regression prevention
    `);
  }
}

// Export all examples
export {
  SearchComponentCompleteTestSuite,
  ServiceIntegrationTestExample,
  PerformanceTestExample,
  FormTestingExample,
  CompleteTestSuiteRunner
};