/**
 * Comprehensive Integration Tests for Categorization and Tagging System
 *
 * Tests complete end-to-end workflows including:
 * - Tag and category management integration
 * - Bulk operations with rollback scenarios
 * - Autocomplete performance with large datasets
 * - Accessibility compliance validation
 * - Cross-component integration
 *
 * @author Integration Tester Agent
 * @version 1.0.0
 */

import React from 'react';
import { render, screen, waitFor, fireEvent, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { performance } from 'perf_hooks';

// Components under test
import { EnhancedCategoryTree } from '../../components/categorization/EnhancedCategoryTree';
import { EnhancedTagInput } from '../../components/tags/EnhancedTagInput';
import { BulkOperationsPanel } from '../../components/bulk/BulkOperationsPanel';
import { EnhancedSmartEntryForm } from '../../components/forms/EnhancedSmartEntryForm';

// Test utilities and mocks
import { createMockKBEntry, createMockTag, createMockCategory } from '../utils/mockData';
import { setupTestDatabase } from '../utils/testDatabase';
import { createLargeDataset } from '../utils/performanceHelpers';
import { mockGeminiService } from '../utils/mockServices';

// Types
import { KBEntry } from '../../database/KnowledgeDB';
import { Tag } from '../../services/EnhancedTagService';
import { CategoryNode } from '../../services/CategoryHierarchyService';
import { BulkOperation, BulkOperationResult } from '../../components/bulk/BulkOperationsPanel';

// Add jest-axe matcher
expect.extend(toHaveNoViolations);

// ===========================
// TEST SETUP & UTILITIES
// ===========================

interface TestContext {
  entries: KBEntry[];
  tags: Tag[];
  categories: CategoryNode[];
  database: any;
  user: ReturnType<typeof userEvent.setup>;
}

const setupIntegrationTest = async (): Promise<TestContext> => {
  const database = await setupTestDatabase();
  const user = userEvent.setup();

  // Create test data
  const categories = [
    createMockCategory('cat1', 'JCL', { is_system: true, entry_count: 15 }),
    createMockCategory('cat2', 'VSAM', { is_system: true, entry_count: 8 }),
    createMockCategory('cat3', 'DB2', { is_system: true, entry_count: 22 }),
    createMockCategory('cat4', 'Custom Category', { is_system: false, entry_count: 5 }),
  ];

  const tags = [
    createMockTag('tag1', 'error-handling', { usage_count: 45, category: 'JCL' }),
    createMockTag('tag2', 'performance', { usage_count: 32, category: 'DB2' }),
    createMockTag('tag3', 'data-validation', { usage_count: 28, category: 'VSAM' }),
    createMockTag('tag4', 'troubleshooting', { usage_count: 19, category: null }),
  ];

  const entries = [
    createMockKBEntry('entry1', {
      title: 'VSAM File Access Issue',
      category: 'VSAM',
      tags: ['data-validation', 'error-handling'],
      success_rate: 0.85
    }),
    createMockKBEntry('entry2', {
      title: 'DB2 Query Optimization',
      category: 'DB2',
      tags: ['performance', 'troubleshooting'],
      success_rate: 0.92
    }),
    createMockKBEntry('entry3', {
      title: 'JCL Parameter Error',
      category: 'JCL',
      tags: ['error-handling'],
      success_rate: 0.78
    }),
  ];

  return { entries, tags, categories, database, user };
};

const createPerformanceTestData = () => {
  return createLargeDataset({
    entryCount: 1000,
    tagCount: 200,
    categoryCount: 50,
    maxTagsPerEntry: 8
  });
};

// ===========================
// COMPONENT INTEGRATION TESTS
// ===========================

describe('Category-Tag System Integration', () => {
  let context: TestContext;

  beforeEach(async () => {
    context = await setupIntegrationTest();
  });

  afterEach(async () => {
    await context.database.cleanup();
  });

  describe('Complete Entry Management Workflow', () => {
    test('should handle full entry creation with categories and tags', async () => {
      const { user } = context;
      const mockOnSubmit = jest.fn();

      render(
        <EnhancedSmartEntryForm
          onSubmit={mockOnSubmit}
          availableTags={context.tags}
          availableCategories={context.categories}
          enableAIAssist={true}
        />
      );

      // Fill out entry form
      await user.type(screen.getByLabelText(/title/i), 'Test Integration Entry');
      await user.type(screen.getByLabelText(/problem/i), 'This is a test problem description');
      await user.type(screen.getByLabelText(/solution/i), 'This is the solution steps');

      // Select category
      const categorySelect = screen.getByLabelText(/category/i);
      await user.selectOptions(categorySelect, 'VSAM');

      // Add tags
      const tagInput = screen.getByLabelText(/tags/i);
      await user.type(tagInput, 'data-validation');
      await user.keyboard('{Enter}');
      await user.type(tagInput, 'error-handling');
      await user.keyboard('{Enter}');

      // Submit form
      await user.click(screen.getByRole('button', { name: /save/i }));

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Test Integration Entry',
            category: 'VSAM',
            tags: expect.arrayContaining(['data-validation', 'error-handling'])
          })
        );
      });
    });

    test('should validate category-tag relationships', async () => {
      const { user } = context;
      const mockOnSubmit = jest.fn();

      render(
        <EnhancedSmartEntryForm
          onSubmit={mockOnSubmit}
          availableTags={context.tags}
          availableCategories={context.categories}
          requireCategoryTags={true}
        />
      );

      // Fill basic fields
      await user.type(screen.getByLabelText(/title/i), 'Test Entry');
      await user.type(screen.getByLabelText(/problem/i), 'Problem');
      await user.type(screen.getByLabelText(/solution/i), 'Solution');

      // Select DB2 category
      await user.selectOptions(screen.getByLabelText(/category/i), 'DB2');

      // Try to add incompatible tag
      const tagInput = screen.getByLabelText(/tags/i);
      await user.type(tagInput, 'data-validation'); // VSAM-specific tag
      await user.keyboard('{Enter}');

      // Should show validation warning
      await waitFor(() => {
        expect(screen.getByText(/tag may not be suitable for this category/i)).toBeInTheDocument();
      });

      // Submit should still work but with warning
      await user.click(screen.getByRole('button', { name: /save/i }));
      expect(mockOnSubmit).toHaveBeenCalled();
    });
  });

  describe('Category Tree Operations', () => {
    test('should handle drag-and-drop category reordering', async () => {
      const { user } = context;
      const mockOnMove = jest.fn().mockResolvedValue(true);

      const { container } = render(
        <EnhancedCategoryTree
          categories={context.categories.map(cat => ({
            node: cat,
            children: [],
            depth: 0,
            path: [cat.name],
            parent: null
          }))}
          enableDragDrop={true}
          onNodeMove={mockOnMove}
        />
      );

      // Find draggable elements
      const dragHandles = container.querySelectorAll('.drag-handle');
      expect(dragHandles).toHaveLength(1); // Only non-system categories are draggable

      // Simulate drag and drop
      const sourceHandle = dragHandles[0];
      const targetNode = screen.getByText('VSAM').closest('.tree-node');

      // Use react-dnd test backend for proper drag-and-drop simulation
      fireEvent.dragStart(sourceHandle);
      fireEvent.dragEnter(targetNode!);
      fireEvent.dragOver(targetNode!);
      fireEvent.drop(targetNode!);

      await waitFor(() => {
        expect(mockOnMove).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(String),
          expect.any(Number)
        );
      });
    });

    test('should prevent invalid category operations', async () => {
      const { user } = context;
      const mockOnDelete = jest.fn();

      render(
        <EnhancedCategoryTree
          categories={context.categories.map(cat => ({
            node: cat,
            children: [],
            depth: 0,
            path: [cat.name],
            parent: null
          }))}
          onNodeDelete={mockOnDelete}
        />
      );

      // Try to delete system category
      const jclNode = screen.getByText('JCL').closest('.tree-node');
      await user.rightClick(jclNode!);

      // System categories should not have delete option
      expect(screen.queryByText(/delete/i)).not.toBeInTheDocument();

      // Try with custom category
      const customNode = screen.getByText('Custom Category').closest('.tree-node');
      await user.rightClick(customNode!);

      // Should have delete option
      expect(screen.getByText(/delete/i)).toBeInTheDocument();
    });
  });

  describe('Tag Input Advanced Features', () => {
    test('should provide context-aware tag suggestions', async () => {
      const { user } = context;
      const mockOnSuggestionsRequest = jest.fn().mockResolvedValue([
        {
          tag: createMockTag('sug1', 'performance-tuning'),
          score: 0.92,
          source: 'ai',
          reasoning: 'Based on similar DB2 entries'
        }
      ]);

      render(
        <EnhancedTagInput
          value={[]}
          onChange={jest.fn()}
          onSuggestionsRequest={mockOnSuggestionsRequest}
          categories={['DB2']}
          enableAIsuggestions={true}
        />
      );

      // Type partial tag
      const input = screen.getByRole('textbox');
      await user.type(input, 'perf');

      await waitFor(() => {
        expect(mockOnSuggestionsRequest).toHaveBeenCalledWith('perf');
      });

      // Should show AI suggestion
      await waitFor(() => {
        expect(screen.getByText('performance-tuning')).toBeInTheDocument();
        expect(screen.getByText(/based on similar db2 entries/i)).toBeInTheDocument();
      });
    });

    test('should handle tag validation and conflicts', async () => {
      const { user } = context;
      const mockValidator = jest.fn().mockReturnValue({
        isValid: false,
        errors: ['Duplicate tag detected'],
        warnings: ['Tag rarely used in this category'],
        suggestions: ['Consider using "data-processing" instead']
      });

      render(
        <EnhancedTagInput
          value={[createMockTag('existing', 'existing-tag')]}
          onChange={jest.fn()}
          validator={mockValidator}
        />
      );

      // Try to add duplicate tag
      const input = screen.getByRole('textbox');
      await user.type(input, 'existing-tag');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(screen.getByText('Duplicate tag detected')).toBeInTheDocument();
        expect(screen.getByText('Tag rarely used in this category')).toBeInTheDocument();
        expect(screen.getByText('Consider using "data-processing" instead')).toBeInTheDocument();
      });
    });
  });

  describe('Bulk Operations Integration', () => {
    test('should handle bulk tag operations with validation', async () => {
      const { user } = context;
      let operationResult: BulkOperationResult;

      const mockOnExecute = jest.fn().mockImplementation(async (operation, entries) => {
        operationResult = {
          operation,
          totalItems: entries.length,
          successCount: entries.length - 1,
          failureCount: 1,
          skippedCount: 0,
          errors: [{ itemId: 'entry1', error: 'Tag already exists' }],
          warnings: [],
          duration: 1200,
          canUndo: true
        };
        return operationResult;
      });

      render(
        <BulkOperationsPanel
          selectedEntries={context.entries}
          availableTags={context.tags}
          availableCategories={context.categories}
          onOperationExecute={mockOnExecute}
          enableUndoRedo={true}
        />
      );

      // Select bulk tag operation
      await user.click(screen.getByText(/bulk tag/i));

      // Add new tag
      const tagInput = within(screen.getByTestId('bulk-tag-input')).getByRole('textbox');
      await user.type(tagInput, 'bulk-test-tag');
      await user.keyboard('{Enter}');

      // Execute operation
      await user.click(screen.getByRole('button', { name: /apply tags/i }));

      // Confirm operation
      await user.click(screen.getByRole('button', { name: /confirm/i }));

      await waitFor(() => {
        expect(mockOnExecute).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'tag' }),
          context.entries
        );
      });

      // Should show operation results
      await waitFor(() => {
        expect(screen.getByText(/operation completed/i)).toBeInTheDocument();
        expect(screen.getByText(/2 successful, 1 failed/i)).toBeInTheDocument();
        expect(screen.getByText(/tag already exists/i)).toBeInTheDocument();
      });
    });

    test('should support operation rollback', async () => {
      const { user } = context;
      const mockOnExecute = jest.fn().mockResolvedValue({
        operation: { type: 'tag' },
        totalItems: 3,
        successCount: 3,
        failureCount: 0,
        skippedCount: 0,
        errors: [],
        warnings: [],
        duration: 800,
        canUndo: true
      });

      const mockOnUndo = jest.fn().mockResolvedValue(true);

      render(
        <BulkOperationsPanel
          selectedEntries={context.entries}
          availableTags={context.tags}
          availableCategories={context.categories}
          onOperationExecute={mockOnExecute}
          enableUndoRedo={true}
        />
      );

      // Execute operation
      await user.click(screen.getByText(/bulk tag/i));
      await user.click(screen.getByRole('button', { name: /apply/i }));
      await user.click(screen.getByRole('button', { name: /confirm/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /undo/i })).toBeInTheDocument();
      });

      // Test undo
      await user.click(screen.getByRole('button', { name: /undo/i }));

      await waitFor(() => {
        expect(mockOnUndo).toHaveBeenCalled();
      });
    });

    test('should handle bulk operation cancellation', async () => {
      const { user } = context;
      let operationCancelled = false;

      const mockOnExecute = jest.fn().mockImplementation(async () => {
        // Simulate long-running operation
        return new Promise((resolve) => {
          setTimeout(() => {
            if (!operationCancelled) {
              resolve({
                operation: { type: 'tag' },
                totalItems: 1000,
                successCount: 1000,
                failureCount: 0,
                skippedCount: 0,
                errors: [],
                warnings: [],
                duration: 5000,
                canUndo: true
              });
            }
          }, 100);
        });
      });

      const mockOnCancel = jest.fn().mockImplementation(() => {
        operationCancelled = true;
      });

      // Create large dataset for meaningful cancellation test
      const largeEntries = Array.from({ length: 1000 }, (_, i) =>
        createMockKBEntry(`entry${i}`, { title: `Entry ${i}` })
      );

      render(
        <BulkOperationsPanel
          selectedEntries={largeEntries}
          availableTags={context.tags}
          availableCategories={context.categories}
          onOperationExecute={mockOnExecute}
          onOperationCancel={mockOnCancel}
        />
      );

      // Start operation
      await user.click(screen.getByText(/bulk categorize/i));
      await user.click(screen.getByRole('button', { name: /apply/i }));
      await user.click(screen.getByRole('button', { name: /confirm/i }));

      // Should show progress
      await waitFor(() => {
        expect(screen.getByText(/processing/i)).toBeInTheDocument();
      });

      // Cancel operation
      await user.click(screen.getByRole('button', { name: /cancel/i }));

      await waitFor(() => {
        expect(mockOnCancel).toHaveBeenCalled();
        expect(screen.getByText(/operation cancelled/i)).toBeInTheDocument();
      });
    });
  });
});

// ===========================
// PERFORMANCE TESTS
// ===========================

describe('Performance Integration Tests', () => {
  describe('Autocomplete Performance', () => {
    test('should handle large tag datasets efficiently', async () => {
      const largeDataset = createPerformanceTestData();
      const { user } = userEvent.setup();

      const startTime = performance.now();

      render(
        <EnhancedTagInput
          value={[]}
          onChange={jest.fn()}
          suggestions={largeDataset.tags.map(tag => ({
            tag,
            score: Math.random(),
            source: 'existing'
          }))}
        />
      );

      const input = screen.getByRole('textbox');

      // Test typing performance
      const typeStartTime = performance.now();
      await user.type(input, 'perf');
      const typeEndTime = performance.now();

      // Should complete typing within reasonable time
      expect(typeEndTime - typeStartTime).toBeLessThan(100);

      // Test suggestions rendering performance
      const suggestionsStartTime = performance.now();
      await waitFor(() => {
        expect(screen.getAllByRole('option')).toHaveLength(expect.any(Number));
      });
      const suggestionsEndTime = performance.now();

      // Suggestions should render quickly even with large datasets
      expect(suggestionsEndTime - suggestionsStartTime).toBeLessThan(200);

      const totalTime = performance.now() - startTime;
      expect(totalTime).toBeLessThan(500); // Total interaction under 500ms
    });

    test('should virtualize large category trees efficiently', async () => {
      const largeDataset = createPerformanceTestData();
      const { user } = userEvent.setup();

      const startTime = performance.now();

      render(
        <EnhancedCategoryTree
          categories={largeDataset.categories.map(cat => ({
            node: cat,
            children: [],
            depth: Math.floor(Math.random() * 3),
            path: [cat.name],
            parent: null
          }))}
          height={600}
          enableVirtualScrolling={true}
        />
      );

      const renderTime = performance.now() - startTime;
      expect(renderTime).toBeLessThan(300); // Should render quickly

      // Test scrolling performance
      const treeContainer = screen.getByRole('tree');

      const scrollStartTime = performance.now();
      fireEvent.scroll(treeContainer, { target: { scrollTop: 1000 } });

      await waitFor(() => {
        // Should maintain smooth scrolling
        const scrollEndTime = performance.now();
        expect(scrollEndTime - scrollStartTime).toBeLessThan(50);
      });
    });
  });

  describe('Memory Management', () => {
    test('should not leak memory during bulk operations', async () => {
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;

      // Simulate memory-intensive operations
      for (let i = 0; i < 10; i++) {
        const entries = Array.from({ length: 100 }, (_, j) =>
          createMockKBEntry(`entry${i}-${j}`, { title: `Entry ${i}-${j}` })
        );

        const { unmount } = render(
          <BulkOperationsPanel
            selectedEntries={entries}
            availableTags={[]}
            availableCategories={[]}
            onOperationExecute={jest.fn()}
          />
        );

        unmount();
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });
  });
});

// ===========================
// ACCESSIBILITY TESTS
// ===========================

describe('Accessibility Integration Tests', () => {
  let context: TestContext;

  beforeEach(async () => {
    context = await setupIntegrationTest();
  });

  test('should have no accessibility violations in category tree', async () => {
    const { container } = render(
      <EnhancedCategoryTree
        categories={context.categories.map(cat => ({
          node: cat,
          children: [],
          depth: 0,
          path: [cat.name],
          parent: null
        }))}
        ariaLabel="Knowledge base categories"
        announceChanges={true}
      />
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  test('should have no accessibility violations in tag input', async () => {
    const { container } = render(
      <EnhancedTagInput
        value={context.tags}
        onChange={jest.fn()}
        ariaLabel="Entry tags"
        announceChanges={true}
      />
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  test('should have no accessibility violations in bulk operations', async () => {
    const { container } = render(
      <BulkOperationsPanel
        selectedEntries={context.entries}
        availableTags={context.tags}
        availableCategories={context.categories}
        ariaLabel="Bulk operations panel"
        announceProgress={true}
      />
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  test('should support keyboard navigation across components', async () => {
    const { user } = context;

    render(
      <div>
        <EnhancedCategoryTree
          categories={context.categories.map(cat => ({
            node: cat,
            children: [],
            depth: 0,
            path: [cat.name],
            parent: null
          }))}
          enableKeyboardNavigation={true}
        />
        <EnhancedTagInput
          value={[]}
          onChange={jest.fn()}
        />
      </div>
    );

    // Tab between components
    await user.tab();
    expect(screen.getByRole('tree')).toHaveFocus();

    await user.tab();
    expect(screen.getByRole('textbox')).toHaveFocus();

    // Test keyboard navigation within category tree
    const tree = screen.getByRole('tree');
    tree.focus();

    await user.keyboard('{ArrowDown}');
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{Enter}');

    // Should select category
    expect(tree.querySelector('.tree-node.selected')).toBeInTheDocument();
  });

  test('should announce important changes to screen readers', async () => {
    const { user } = context;

    render(
      <EnhancedTagInput
        value={[]}
        onChange={jest.fn()}
        announceChanges={true}
      />
    );

    // Add tag
    const input = screen.getByRole('textbox');
    await user.type(input, 'test-tag');
    await user.keyboard('{Enter}');

    // Should announce the change
    await waitFor(() => {
      const announcement = screen.getByRole('status', { hidden: true });
      expect(announcement).toHaveTextContent(/added tag/i);
    });
  });

  test('should provide proper ARIA labels and descriptions', () => {
    render(
      <div>
        <EnhancedCategoryTree
          categories={context.categories.map(cat => ({
            node: cat,
            children: [],
            depth: 0,
            path: [cat.name],
            parent: null
          }))}
          ariaLabel="Category hierarchy"
          ariaDescribedBy="category-help"
        />
        <div id="category-help">
          Use arrow keys to navigate, Enter to select, F2 to rename
        </div>
      </div>
    );

    const tree = screen.getByRole('tree');
    expect(tree).toHaveAttribute('aria-label', 'Category hierarchy');
    expect(tree).toHaveAttribute('aria-describedby', 'category-help');
  });
});

// ===========================
// ERROR HANDLING TESTS
// ===========================

describe('Error Handling Integration Tests', () => {
  let context: TestContext;

  beforeEach(async () => {
    context = await setupIntegrationTest();
  });

  test('should handle API failures gracefully', async () => {
    const { user } = context;

    // Mock failed API calls
    const mockFailingService = {
      searchTags: jest.fn().mockRejectedValue(new Error('API Error')),
      suggestTags: jest.fn().mockRejectedValue(new Error('Service Unavailable'))
    };

    render(
      <EnhancedTagInput
        value={[]}
        onChange={jest.fn()}
        onSuggestionsRequest={mockFailingService.suggestTags}
      />
    );

    // Try to get suggestions
    const input = screen.getByRole('textbox');
    await user.type(input, 'test');

    // Should show error state, not crash
    await waitFor(() => {
      expect(screen.getByText(/suggestions unavailable/i)).toBeInTheDocument();
    });

    // Should still allow manual tag entry
    await user.keyboard('{Enter}');
    expect(screen.getByText('test')).toBeInTheDocument();
  });

  test('should handle database errors during bulk operations', async () => {
    const { user } = context;

    const mockOnExecute = jest.fn().mockRejectedValue(new Error('Database connection failed'));

    render(
      <BulkOperationsPanel
        selectedEntries={context.entries}
        availableTags={context.tags}
        availableCategories={context.categories}
        onOperationExecute={mockOnExecute}
      />
    );

    // Start bulk operation
    await user.click(screen.getByText(/bulk tag/i));
    await user.click(screen.getByRole('button', { name: /apply/i }));
    await user.click(screen.getByRole('button', { name: /confirm/i }));

    // Should show error message
    await waitFor(() => {
      expect(screen.getByText(/operation failed/i)).toBeInTheDocument();
      expect(screen.getByText(/database connection failed/i)).toBeInTheDocument();
    });

    // Should allow retry
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  test('should validate data integrity across operations', async () => {
    const { user } = context;

    // Mock operations that could cause data inconsistency
    let categoryDeleted = false;
    const mockOnCategoryDelete = jest.fn().mockImplementation(() => {
      categoryDeleted = true;
      return Promise.resolve(true);
    });

    const mockOnTagOperation = jest.fn().mockImplementation((operation, entries) => {
      // Simulate checking for deleted categories
      if (categoryDeleted && operation.data?.categoryId === 'deleted-cat') {
        throw new Error('Referenced category no longer exists');
      }
      return Promise.resolve({ successCount: entries.length });
    });

    render(
      <div>
        <EnhancedCategoryTree
          categories={context.categories.map(cat => ({
            node: cat,
            children: [],
            depth: 0,
            path: [cat.name],
            parent: null
          }))}
          onNodeDelete={mockOnCategoryDelete}
        />
        <BulkOperationsPanel
          selectedEntries={context.entries}
          availableTags={context.tags}
          availableCategories={context.categories}
          onOperationExecute={mockOnTagOperation}
        />
      </div>
    );

    // Delete category
    const customCategory = screen.getByText('Custom Category');
    await user.rightClick(customCategory);
    await user.click(screen.getByText(/delete/i));

    // Try to use deleted category in bulk operation
    await user.click(screen.getByText(/bulk categorize/i));

    // Should detect integrity issue and prevent operation
    await waitFor(() => {
      expect(screen.getByText(/some categories are no longer available/i)).toBeInTheDocument();
    });
  });
});

// ===========================
// CROSS-COMPONENT INTEGRATION
// ===========================

describe('Cross-Component Integration', () => {
  let context: TestContext;

  beforeEach(async () => {
    context = await setupIntegrationTest();
  });

  test('should sync selections between components', async () => {
    const { user } = context;
    let sharedSelection: string[] = [];

    const CategoryComponent = () => (
      <EnhancedCategoryTree
        categories={context.categories.map(cat => ({
          node: cat,
          children: [],
          depth: 0,
          path: [cat.name],
          parent: null
        }))}
        selectedIds={sharedSelection}
        onSelectionChange={(ids) => { sharedSelection = ids; }}
      />
    );

    const BulkComponent = () => (
      <BulkOperationsPanel
        selectedEntries={context.entries.filter(entry =>
          sharedSelection.includes(entry.category)
        )}
        availableTags={context.tags}
        availableCategories={context.categories}
      />
    );

    const { rerender } = render(
      <div>
        <CategoryComponent />
        <BulkComponent />
      </div>
    );

    // Select category
    await user.click(screen.getByText('VSAM'));
    sharedSelection = ['VSAM'];

    // Re-render with updated selection
    rerender(
      <div>
        <CategoryComponent />
        <BulkComponent />
      </div>
    );

    // Bulk operations should show filtered entries
    await waitFor(() => {
      expect(screen.getByText(/1 selected/i)).toBeInTheDocument();
    });
  });

  test('should handle cascading updates correctly', async () => {
    const { user } = context;

    const mockOnCategoryUpdate = jest.fn();
    const mockOnTagUpdate = jest.fn();
    const mockOnEntryUpdate = jest.fn();

    render(
      <EnhancedSmartEntryForm
        initialEntry={context.entries[0]}
        availableTags={context.tags}
        availableCategories={context.categories}
        onSubmit={mockOnEntryUpdate}
        onCategoryUpdate={mockOnCategoryUpdate}
        onTagUpdate={mockOnTagUpdate}
      />
    );

    // Change category
    await user.selectOptions(screen.getByLabelText(/category/i), 'DB2');

    // Should trigger tag suggestions update
    await waitFor(() => {
      expect(screen.getByText(/performance/i)).toBeInTheDocument();
    });

    // Change triggers should cascade properly
    expect(mockOnCategoryUpdate).toHaveBeenCalled();
  });

  test('should maintain state consistency during concurrent operations', async () => {
    const { user } = context;

    // Simulate concurrent tag operations
    const operations = [
      { type: 'add', tag: 'concurrent-tag-1' },
      { type: 'add', tag: 'concurrent-tag-2' },
      { type: 'remove', tag: 'existing-tag' },
    ];

    let currentTags = [...context.tags];
    const mockOnChange = jest.fn((newTags) => {
      currentTags = newTags;
    });

    const { rerender } = render(
      <EnhancedTagInput
        value={currentTags}
        onChange={mockOnChange}
      />
    );

    // Execute operations concurrently
    const promises = operations.map(async (op, index) => {
      if (op.type === 'add') {
        const input = screen.getByRole('textbox');
        await user.type(input, op.tag);
        await user.keyboard('{Enter}');
      }
    });

    await Promise.all(promises);

    // Should maintain consistent state
    expect(mockOnChange).toHaveBeenCalledTimes(2); // Two add operations
    expect(currentTags.some(tag => tag.name === 'concurrent-tag-1')).toBe(true);
    expect(currentTags.some(tag => tag.name === 'concurrent-tag-2')).toBe(true);
  });
});