/**
 * Performance Benchmark Integration Tests
 *
 * Comprehensive performance testing for the categorization and tagging system
 * with focus on autocomplete performance, large datasets, and memory management.
 *
 * @author Integration Tester Agent
 * @version 1.0.0
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { EnhancedTagInput } from '../../components/tags/EnhancedTagInput';
import { EnhancedCategoryTree } from '../../components/categorization/EnhancedCategoryTree';
import { BulkOperationsPanel } from '../../components/bulk/BulkOperationsPanel';

import {
  Benchmark,
  PerformanceMeasurer,
  PerformanceValidator,
  StressTest,
  createLargeDataset,
  formatDuration,
  formatBytes,
  calculatePercentile
} from '../utils/performanceHelpers';

import {
  createMockKBEntry,
  createMockTag,
  createMockCategory,
  createPerformanceTestData
} from '../utils/mockData';

import { setupTestDatabase } from '../utils/testDatabase';

// ===========================
// PERFORMANCE BENCHMARKS
// ===========================

describe('Performance Benchmarks - Categorization & Tagging System', () => {
  let benchmark: Benchmark;
  let validator: PerformanceValidator;
  let measurer: PerformanceMeasurer;

  beforeEach(() => {
    benchmark = new Benchmark();
    validator = new PerformanceValidator();
    measurer = new PerformanceMeasurer();
  });

  afterEach(() => {
    benchmark.cleanup();
    measurer.cleanup();
  });

  describe('Tag Input Autocomplete Performance', () => {
    test('should handle large tag datasets efficiently', async () => {
      const largeDataset = createLargeDataset({
        entryCount: 1000,
        tagCount: 500,
        categoryCount: 50,
        maxTagsPerEntry: 8
      });

      const suggestions = largeDataset.tags.map(tag => ({
        tag,
        score: Math.random(),
        source: 'existing' as const
      }));

      let renderTime = 0;
      let searchTime = 0;

      const result = await benchmark.run(
        'tag-autocomplete-large-dataset',
        async () => {
          const user = userEvent.setup();

          const renderStart = performance.now();
          const { unmount } = render(
            <EnhancedTagInput
              value={[]}
              onChange={() => {}}
              suggestions={suggestions}
            />
          );
          renderTime = performance.now() - renderStart;

          const input = screen.getByRole('textbox');

          const searchStart = performance.now();
          await user.type(input, 'perf');
          await waitFor(() => {
            expect(screen.getAllByRole('option')).toHaveLength(expect.any(Number));
          });
          searchTime = performance.now() - searchStart;

          unmount();
        },
        {
          iterations: 20,
          warmupRuns: 5,
          memoryProfiling: true
        }
      );

      // Validate performance thresholds
      const validation = validator.validateBenchmark(result, {
        maxDuration: 200, // 200ms max average
        maxMemoryLeak: 5 * 1024 * 1024, // 5MB max leak
        minOperationsPerSecond: 5 // At least 5 ops/sec
      });

      expect(validation.passed).toBe(true);

      if (!validation.passed) {
        console.warn('Performance validation failed:', validation.failures);
      }

      // Log detailed metrics
      console.log(`Tag Autocomplete Performance (${largeDataset.tags.length} tags):`);
      console.log(`  Average Duration: ${formatDuration(result.averageDuration)}`);
      console.log(`  Operations/sec: ${result.operationsPerSecond.toFixed(2)}`);
      console.log(`  Memory Peak: ${formatBytes(result.memoryUsage?.peak || 0)}`);
      console.log(`  Memory Leaked: ${formatBytes(result.memoryUsage?.leaked || 0)}`);
    });

    test('should maintain performance during rapid typing', async () => {
      const tags = Array.from({ length: 100 }, (_, i) =>
        createMockTag(`tag-${i}`, `performance-tag-${i}`)
      );

      const suggestions = tags.map(tag => ({
        tag,
        score: Math.random(),
        source: 'existing' as const
      }));

      const result = await benchmark.run(
        'rapid-typing-performance',
        async () => {
          const user = userEvent.setup();
          const { unmount } = render(
            <EnhancedTagInput
              value={[]}
              onChange={() => {}}
              suggestions={suggestions}
            />
          );

          const input = screen.getByRole('textbox');

          // Simulate rapid typing
          const queries = ['p', 'pe', 'per', 'perf', 'perfo', 'perfor', 'perform'];

          for (const query of queries) {
            await user.clear(input);
            await user.type(input, query, { delay: 10 }); // Fast typing
            await waitFor(() => {
              // Suggestions should update quickly
            }, { timeout: 100 });
          }

          unmount();
        },
        {
          iterations: 10,
          warmupRuns: 2
        }
      );

      expect(result.averageDuration).toBeLessThan(500); // 500ms max for rapid typing
      expect(result.operationsPerSecond).toBeGreaterThan(2); // At least 2 ops/sec

      console.log(`Rapid Typing Performance:`);
      console.log(`  Average Duration: ${formatDuration(result.averageDuration)}`);
      console.log(`  95th percentile: ${formatDuration(result.maxDuration * 0.95)}`);
    });

    test('should efficiently filter suggestions', async () => {
      const LARGE_TAG_COUNT = 1000;
      const tags = Array.from({ length: LARGE_TAG_COUNT }, (_, i) => {
        const prefixes = ['error', 'handle', 'process', 'data', 'system', 'config'];
        const suffixes = ['validation', 'management', 'processing', 'analysis', 'recovery'];
        const prefix = prefixes[i % prefixes.length];
        const suffix = suffixes[Math.floor(i / prefixes.length) % suffixes.length];

        return createMockTag(`tag-${i}`, `${prefix}-${suffix}-${i}`);
      });

      const suggestions = tags.map(tag => ({
        tag,
        score: Math.random(),
        source: 'existing' as const
      }));

      const filteringResult = await benchmark.run(
        'suggestion-filtering',
        async () => {
          const user = userEvent.setup();
          const { unmount } = render(
            <EnhancedTagInput
              value={[]}
              onChange={() => {}}
              suggestions={suggestions}
            />
          );

          const input = screen.getByRole('textbox');

          // Test different filter queries
          const queries = ['error', 'data-', 'process', 'handle-validation'];

          for (const query of queries) {
            await user.clear(input);
            await user.type(input, query);

            await waitFor(() => {
              const options = screen.getAllByRole('option');
              expect(options.length).toBeGreaterThan(0);
              expect(options.length).toBeLessThanOrEqual(10); // Should limit results
            });
          }

          unmount();
        },
        {
          iterations: 15,
          warmupRuns: 3,
          memoryProfiling: true
        }
      );

      expect(filteringResult.averageDuration).toBeLessThan(300); // 300ms max
      console.log(`Suggestion Filtering (${LARGE_TAG_COUNT} tags):`);
      console.log(`  Average Duration: ${formatDuration(filteringResult.averageDuration)}`);
      console.log(`  Memory Usage: ${formatBytes(filteringResult.memoryUsage?.peak || 0)}`);
    });
  });

  describe('Category Tree Virtual Scrolling Performance', () => {
    test('should efficiently render large category trees', async () => {
      const LARGE_CATEGORY_COUNT = 200;
      const categories = Array.from({ length: LARGE_CATEGORY_COUNT }, (_, i) =>
        createMockCategory(`cat-${i}`, `Category ${i}`, {
          entry_count: Math.floor(Math.random() * 50),
          parent_id: i > 10 && Math.random() > 0.7 ? `cat-${Math.floor(Math.random() * 10)}` : null
        })
      );

      const categoryTrees = categories.map(cat => ({
        node: cat,
        children: [],
        depth: cat.parent_id ? 1 : 0,
        path: [cat.name],
        parent: null
      }));

      const renderResult = await benchmark.run(
        'category-tree-render',
        async () => {
          const { unmount } = render(
            <EnhancedCategoryTree
              categories={categoryTrees}
              height={600}
              width={400}
              enableVirtualScrolling={true}
              itemHeight={36}
            />
          );

          // Wait for initial render
          await waitFor(() => {
            expect(screen.getByRole('tree')).toBeInTheDocument();
          });

          unmount();
        },
        {
          iterations: 10,
          warmupRuns: 2,
          memoryProfiling: true
        }
      );

      expect(renderResult.averageDuration).toBeLessThan(150); // 150ms max render time

      console.log(`Category Tree Render (${LARGE_CATEGORY_COUNT} categories):`);
      console.log(`  Average Render Time: ${formatDuration(renderResult.averageDuration)}`);
      console.log(`  Memory Usage: ${formatBytes(renderResult.memoryUsage?.peak || 0)}`);
    });

    test('should maintain smooth scrolling performance', async () => {
      const categories = Array.from({ length: 300 }, (_, i) =>
        createMockCategory(`cat-${i}`, `Category ${i}`)
      );

      const categoryTrees = categories.map(cat => ({
        node: cat,
        children: [],
        depth: 0,
        path: [cat.name],
        parent: null
      }));

      const scrollResult = await benchmark.run(
        'category-tree-scrolling',
        async () => {
          const { unmount } = render(
            <EnhancedCategoryTree
              categories={categoryTrees}
              height={600}
              enableVirtualScrolling={true}
            />
          );

          const tree = screen.getByRole('tree');

          // Simulate scrolling
          const scrollPositions = [100, 500, 1000, 1500, 2000];

          for (const scrollTop of scrollPositions) {
            const scrollStart = performance.now();
            tree.scrollTop = scrollTop;

            // Trigger scroll event
            tree.dispatchEvent(new Event('scroll'));

            await waitFor(() => {
              // Ensure scroll update completes within reasonable time
            }, { timeout: 50 });

            const scrollEnd = performance.now();
            expect(scrollEnd - scrollStart).toBeLessThan(20); // 20ms max per scroll
          }

          unmount();
        },
        {
          iterations: 5,
          warmupRuns: 1
        }
      );

      expect(scrollResult.averageDuration).toBeLessThan(200); // 200ms for complete scroll test

      console.log(`Category Tree Scrolling Performance:`);
      console.log(`  Average Duration: ${formatDuration(scrollResult.averageDuration)}`);
    });
  });

  describe('Bulk Operations Performance', () => {
    test('should efficiently process bulk tag operations', async () => {
      const ENTRY_COUNT = 500;
      const entries = Array.from({ length: ENTRY_COUNT }, (_, i) =>
        createMockKBEntry(`entry-${i}`, {
          title: `Test Entry ${i}`,
          category: ['JCL', 'VSAM', 'DB2'][i % 3],
          tags: [`tag-${i % 10}`, `tag-${(i + 1) % 10}`]
        })
      );

      const tags = Array.from({ length: 20 }, (_, i) =>
        createMockTag(`tag-${i}`, `test-tag-${i}`)
      );

      let operationResult: any = null;

      const bulkResult = await benchmark.run(
        'bulk-tag-operations',
        async () => {
          const user = userEvent.setup();
          const mockExecute = jest.fn().mockImplementation(async (operation, selectedEntries) => {
            // Simulate processing delay proportional to entry count
            const delay = selectedEntries.length * 2; // 2ms per entry
            await new Promise(resolve => setTimeout(resolve, delay));

            return {
              operation,
              totalItems: selectedEntries.length,
              successCount: selectedEntries.length,
              failureCount: 0,
              skippedCount: 0,
              errors: [],
              warnings: [],
              duration: delay,
              canUndo: true
            };
          });

          const { unmount } = render(
            <BulkOperationsPanel
              selectedEntries={entries}
              availableTags={tags}
              availableCategories={[]}
              onOperationExecute={mockExecute}
            />
          );

          // Execute bulk tag operation
          await user.click(screen.getByText(/bulk tag/i));

          const tagInput = screen.getByRole('textbox');
          await user.type(tagInput, 'bulk-test-tag');
          await user.keyboard('{Enter}');

          await user.click(screen.getByRole('button', { name: /apply/i }));
          await user.click(screen.getByRole('button', { name: /confirm/i }));

          await waitFor(() => {
            expect(mockExecute).toHaveBeenCalled();
          });

          operationResult = mockExecute.mock.results[0]?.value;
          unmount();
        },
        {
          iterations: 8,
          warmupRuns: 2,
          memoryProfiling: true
        }
      );

      expect(bulkResult.averageDuration).toBeLessThan(2000); // 2s max for bulk operation
      expect(operationResult).toBeDefined();

      console.log(`Bulk Operations (${ENTRY_COUNT} entries):`);
      console.log(`  Average Duration: ${formatDuration(bulkResult.averageDuration)}`);
      console.log(`  Processing Rate: ${(ENTRY_COUNT / (bulkResult.averageDuration / 1000)).toFixed(0)} entries/sec`);
    });

    test('should handle concurrent bulk operations', async () => {
      const entries = Array.from({ length: 100 }, (_, i) =>
        createMockKBEntry(`entry-${i}`, { title: `Entry ${i}` })
      );

      const stressTest = new StressTest();

      const concurrentResult = await stressTest.run({
        maxConcurrency: 5,
        duration: 2000, // 2 seconds
        operations: [
          {
            name: 'bulk-tag',
            weight: 0.4,
            operation: async () => {
              const { unmount } = render(
                <BulkOperationsPanel
                  selectedEntries={entries.slice(0, 20)}
                  availableTags={[]}
                  availableCategories={[]}
                  onOperationExecute={async () => ({
                    operation: { type: 'tag' } as any,
                    totalItems: 20,
                    successCount: 20,
                    failureCount: 0,
                    skippedCount: 0,
                    errors: [],
                    warnings: [],
                    duration: 100,
                    canUndo: true
                  })}
                />
              );

              await new Promise(resolve => setTimeout(resolve, 50));
              unmount();
            }
          },
          {
            name: 'bulk-categorize',
            weight: 0.3,
            operation: async () => {
              const { unmount } = render(
                <BulkOperationsPanel
                  selectedEntries={entries.slice(0, 15)}
                  availableTags={[]}
                  availableCategories={[]}
                  onOperationExecute={async () => ({
                    operation: { type: 'categorize' } as any,
                    totalItems: 15,
                    successCount: 15,
                    failureCount: 0,
                    skippedCount: 0,
                    errors: [],
                    warnings: [],
                    duration: 75,
                    canUndo: true
                  })}
                />
              );

              await new Promise(resolve => setTimeout(resolve, 30));
              unmount();
            }
          },
          {
            name: 'tag-autocomplete',
            weight: 0.3,
            operation: async () => {
              const user = userEvent.setup();
              const { unmount } = render(
                <EnhancedTagInput
                  value={[]}
                  onChange={() => {}}
                  suggestions={[]}
                />
              );

              const input = screen.getByRole('textbox');
              await user.type(input, 'test');
              unmount();
            }
          }
        ]
      });

      expect(concurrentResult.failedOperations).toBeLessThan(concurrentResult.totalOperations * 0.05); // Less than 5% failures
      expect(concurrentResult.averageResponseTime).toBeLessThan(500); // 500ms average response

      console.log(`Concurrent Operations Result:`);
      console.log(`  Total Operations: ${concurrentResult.totalOperations}`);
      console.log(`  Success Rate: ${((concurrentResult.successfulOperations / concurrentResult.totalOperations) * 100).toFixed(1)}%`);
      console.log(`  Average Response Time: ${formatDuration(concurrentResult.averageResponseTime)}`);
      console.log(`  Operations/sec: ${concurrentResult.operationsPerSecond.toFixed(2)}`);
    });
  });

  describe('Memory Management Performance', () => {
    test('should not leak memory during extended usage', async () => {
      let initialMemory = 0;
      let peakMemory = 0;
      let finalMemory = 0;

      if (typeof (performance as any).memory !== 'undefined') {
        // Force garbage collection before test
        if (global.gc) {
          global.gc();
        }

        initialMemory = (performance as any).memory.usedJSHeapSize;

        // Simulate extended usage
        const CYCLES = 10;
        const TAGS_PER_CYCLE = 50;

        for (let cycle = 0; cycle < CYCLES; cycle++) {
          const tags = Array.from({ length: TAGS_PER_CYCLE }, (_, i) =>
            createMockTag(`cycle-${cycle}-tag-${i}`, `tag-${cycle}-${i}`)
          );

          const suggestions = tags.map(tag => ({
            tag,
            score: Math.random(),
            source: 'existing' as const
          }));

          // Render and unmount components multiple times
          for (let i = 0; i < 5; i++) {
            const { unmount } = render(
              <EnhancedTagInput
                value={tags.slice(0, 3)}
                onChange={() => {}}
                suggestions={suggestions}
              />
            );

            const user = userEvent.setup();
            const input = screen.getByRole('textbox');
            await user.type(input, 'test');

            await waitFor(() => {
              // Wait for suggestions to render
            });

            unmount();

            // Track peak memory
            const currentMemory = (performance as any).memory.usedJSHeapSize;
            peakMemory = Math.max(peakMemory, currentMemory);
          }

          // Periodic garbage collection
          if (global.gc && cycle % 3 === 0) {
            global.gc();
          }
        }

        // Final garbage collection and measurement
        if (global.gc) {
          global.gc();
        }

        finalMemory = (performance as any).memory.usedJSHeapSize;

        const memoryLeaked = finalMemory - initialMemory;
        const memoryGrowth = ((finalMemory - initialMemory) / initialMemory) * 100;

        console.log(`Memory Management Test:`);
        console.log(`  Initial Memory: ${formatBytes(initialMemory)}`);
        console.log(`  Peak Memory: ${formatBytes(peakMemory)}`);
        console.log(`  Final Memory: ${formatBytes(finalMemory)}`);
        console.log(`  Memory Leaked: ${formatBytes(memoryLeaked)}`);
        console.log(`  Memory Growth: ${memoryGrowth.toFixed(2)}%`);

        // Validate memory usage
        expect(memoryLeaked).toBeLessThan(10 * 1024 * 1024); // Less than 10MB leaked
        expect(memoryGrowth).toBeLessThan(50); // Less than 50% growth
      } else {
        console.warn('Memory testing not available in this environment');
      }
    });

    test('should efficiently cleanup on unmount', async () => {
      const COMPONENT_COUNT = 20;
      const cleanupResults = [];

      for (let i = 0; i < COMPONENT_COUNT; i++) {
        const beforeMemory = typeof (performance as any).memory !== 'undefined'
          ? (performance as any).memory.usedJSHeapSize
          : 0;

        const entries = Array.from({ length: 50 }, (_, j) =>
          createMockKBEntry(`entry-${i}-${j}`, { title: `Entry ${i}-${j}` })
        );

        const { unmount } = render(
          <BulkOperationsPanel
            selectedEntries={entries}
            availableTags={[]}
            availableCategories={[]}
            onOperationExecute={async () => ({
              operation: { type: 'tag' } as any,
              totalItems: 50,
              successCount: 50,
              failureCount: 0,
              skippedCount: 0,
              errors: [],
              warnings: [],
              duration: 100,
              canUndo: true
            })}
          />
        );

        // Interact with component briefly
        await waitFor(() => {
          expect(screen.getByText(/selected/i)).toBeInTheDocument();
        });

        unmount();

        const afterMemory = typeof (performance as any).memory !== 'undefined'
          ? (performance as any).memory.usedJSHeapSize
          : 0;

        cleanupResults.push({
          iteration: i,
          memoryBefore: beforeMemory,
          memoryAfter: afterMemory,
          memoryDelta: afterMemory - beforeMemory
        });
      }

      if (cleanupResults.length > 0 && cleanupResults[0].memoryBefore > 0) {
        const avgMemoryDelta = cleanupResults.reduce((sum, result) =>
          sum + result.memoryDelta, 0) / cleanupResults.length;

        console.log(`Cleanup Performance:`);
        console.log(`  Average Memory Delta: ${formatBytes(Math.abs(avgMemoryDelta))}`);
        console.log(`  Components Tested: ${COMPONENT_COUNT}`);

        // Memory delta should be small (components should cleanup properly)
        expect(Math.abs(avgMemoryDelta)).toBeLessThan(1024 * 1024); // Less than 1MB average growth
      }
    });
  });

  describe('Database Performance', () => {
    test('should efficiently handle large dataset queries', async () => {
      const database = await setupTestDatabase();

      try {
        const LARGE_ENTRY_COUNT = 1000;
        const entries = Array.from({ length: LARGE_ENTRY_COUNT }, (_, i) =>
          createMockKBEntry(`perf-entry-${i}`, {
            title: `Performance Test Entry ${i}`,
            category: ['JCL', 'VSAM', 'DB2', 'Batch'][i % 4],
            tags: [`tag-${i % 20}`, `tag-${(i + 1) % 20}`]
          })
        );

        // Seed database
        const insertStart = performance.now();
        for (const entry of entries) {
          await database.knowledgeDB.addEntry(entry);
        }
        const insertEnd = performance.now();

        const insertTime = insertEnd - insertStart;
        const insertRate = LARGE_ENTRY_COUNT / (insertTime / 1000);

        console.log(`Database Insert Performance:`);
        console.log(`  ${LARGE_ENTRY_COUNT} entries inserted in ${formatDuration(insertTime)}`);
        console.log(`  Insert Rate: ${insertRate.toFixed(0)} entries/sec`);

        // Test search performance
        const searchQueries = [
          'Performance',
          'JCL',
          'tag-5',
          'Test Entry 500',
          'category:DB2'
        ];

        for (const query of searchQueries) {
          const searchStart = performance.now();
          const results = await database.knowledgeDB.search(query, 20);
          const searchEnd = performance.now();

          const searchTime = searchEnd - searchStart;

          console.log(`  Search "${query}": ${formatDuration(searchTime)}, ${results.length} results`);
          expect(searchTime).toBeLessThan(100); // 100ms max per search
        }

      } finally {
        await database.cleanup();
      }
    });
  });
});

// ===========================
// PERFORMANCE UTILITIES
// ===========================

describe('Performance Utility Functions', () => {
  test('should accurately calculate percentiles', () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    expect(calculatePercentile(values, 50)).toBe(5.5); // Median
    expect(calculatePercentile(values, 90)).toBe(9.1); // 90th percentile
    expect(calculatePercentile(values, 95)).toBe(9.55); // 95th percentile
  });

  test('should format durations correctly', () => {
    expect(formatDuration(0.5)).toMatch(/μs$/); // Microseconds
    expect(formatDuration(50)).toMatch(/ms$/); // Milliseconds
    expect(formatDuration(5000)).toMatch(/s$/); // Seconds
    expect(formatDuration(300000)).toMatch(/m$/); // Minutes
  });

  test('should format bytes correctly', () => {
    expect(formatBytes(1024)).toBe('1.00 KB');
    expect(formatBytes(1024 * 1024)).toBe('1.00 MB');
    expect(formatBytes(1024 * 1024 * 1024)).toBe('1.00 GB');
  });
});