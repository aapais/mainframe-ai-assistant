/**
 * Unit Testing Patterns for TypeScript React Components
 * Provides comprehensive patterns for testing all component types in the Mainframe KB Assistant
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { customRender, TestDataGenerator, MockFactory, AssertionHelpers, userEvent } from '../utils/TestingUtilities';
import { KBEntry, SearchResult } from '../../src/types';

/**
 * Base Test Pattern for all React Components
 */
export abstract class BaseComponentTest {
  protected mockElectronAPI: any;
  protected mockData: any;

  beforeEach(): void {
    this.mockElectronAPI = MockFactory.createMockElectronAPI();
    (window as any).electronAPI = this.mockElectronAPI;
    this.setupMockData();
  }

  afterEach(): void {
    vi.clearAllMocks();
    this.cleanup();
  }

  protected abstract setupMockData(): void;
  protected abstract cleanup(): void;

  // Common test patterns
  protected testComponentRenders(component: React.ReactElement, testId?: string): void {
    const { container } = customRender(component);

    if (testId) {
      expect(screen.getByTestId(testId)).toBeInTheDocument();
    } else {
      expect(container.firstChild).toBeInTheDocument();
    }
  }

  protected async testAsyncLoading(
    component: React.ReactElement,
    loadingSelector: string,
    contentSelector: string
  ): Promise<void> {
    customRender(component);

    // Should show loading state initially
    expect(screen.getByTestId(loadingSelector)).toBeInTheDocument();

    // Should show content after loading
    await screen.findByTestId(contentSelector);
    expect(screen.queryByTestId(loadingSelector)).not.toBeInTheDocument();
  }

  protected testErrorBoundary(componentWithError: React.ReactElement): void {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { container } = customRender(componentWithError);

    // Should render error fallback
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();

    consoleSpy.mockRestore();
  }

  protected testAccessibility(component: React.ReactElement): void {
    const { container } = customRender(component);
    AssertionHelpers.assertAccessibility(container);
  }
}

/**
 * Search Component Test Pattern
 */
export class SearchComponentTest extends BaseComponentTest {
  protected searchEntries: KBEntry[] = [];
  protected mockSearchService: any;

  protected setupMockData(): void {
    this.searchEntries = TestDataGenerator.createLargeDataset(10);
    this.mockSearchService = MockFactory.createMockSearchService();
  }

  protected cleanup(): void {
    // Cleanup any search-specific resources
  }

  /**
   * Test search functionality with performance assertion
   */
  testSearchFunctionality(searchComponent: React.ReactElement): void {
    describe('Search Functionality', () => {
      it('performs search within performance threshold', async () => {
        // Mock search results
        const mockResults = this.searchEntries.slice(0, 5).map(entry =>
          TestDataGenerator.createSearchResult(entry)
        );
        this.mockSearchService.search.mockResolvedValue(mockResults);

        customRender(searchComponent);

        const searchInput = screen.getByRole('textbox', { name: /search/i });

        await AssertionHelpers.assertPerformance(async () => {
          await userEvent.type(searchInput, 'VSAM');
          await screen.findByText(mockResults[0].entry.title);
        }, 1000, 'Search operation');

        expect(this.mockSearchService.search).toHaveBeenCalledWith(
          'VSAM',
          expect.any(Array),
          expect.any(Object)
        );
      });

      it('handles search with no results', async () => {
        this.mockSearchService.search.mockResolvedValue([]);

        customRender(searchComponent);

        const searchInput = screen.getByRole('textbox', { name: /search/i });
        await userEvent.type(searchInput, 'nonexistent query');

        await screen.findByText(/no results found/i);
        expect(screen.queryByRole('list')).not.toBeInTheDocument();
      });

      it('debounces search input', async () => {
        customRender(searchComponent);

        const searchInput = screen.getByRole('textbox', { name: /search/i });

        // Type multiple characters quickly
        await userEvent.type(searchInput, 'VSAM', { delay: 50 });

        // Wait for debounce period
        await new Promise(resolve => setTimeout(resolve, 400));

        // Search should only be called once
        expect(this.mockSearchService.search).toHaveBeenCalledTimes(1);
      });
    });
  }

  /**
   * Test search filters and sorting
   */
  testSearchFilters(searchComponent: React.ReactElement): void {
    describe('Search Filters', () => {
      it('filters by category', async () => {
        const mockResults = this.searchEntries
          .filter(e => e.category === 'VSAM')
          .map(entry => TestDataGenerator.createSearchResult(entry));

        this.mockSearchService.search.mockResolvedValue(mockResults);

        customRender(searchComponent);

        // Open filters
        const filtersButton = screen.getByRole('button', { name: /filters/i });
        await userEvent.click(filtersButton);

        // Select VSAM category
        const categoryFilter = screen.getByRole('checkbox', { name: /vsam/i });
        await userEvent.click(categoryFilter);

        await screen.findByText(mockResults[0].entry.title);

        expect(this.mockSearchService.search).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(Array),
          expect.objectContaining({
            categories: ['VSAM']
          })
        );
      });

      it('sorts results by relevance', async () => {
        const mockResults = this.searchEntries.slice(0, 3).map((entry, index) =>
          TestDataGenerator.createSearchResult(entry, { score: 100 - (index * 10) })
        );

        this.mockSearchService.search.mockResolvedValue(mockResults);

        customRender(searchComponent);

        const searchInput = screen.getByRole('textbox', { name: /search/i });
        await userEvent.type(searchInput, 'test');

        await screen.findByText(mockResults[0].entry.title);

        // Verify results are displayed in score order
        const resultTitles = screen.getAllByTestId(/search-result-title/);
        expect(resultTitles[0]).toHaveTextContent(mockResults[0].entry.title);
        expect(resultTitles[1]).toHaveTextContent(mockResults[1].entry.title);
      });
    });
  }
}

/**
 * Knowledge Base Entry Component Test Pattern
 */
export class KBEntryComponentTest extends BaseComponentTest {
  protected testEntry: KBEntry;

  protected setupMockData(): void {
    this.testEntry = TestDataGenerator.createKBEntry({
      title: 'Test VSAM Issue',
      problem: 'VSAM file cannot be opened with status code 35',
      solution: '1. Check file catalog\n2. Verify permissions\n3. Try VERIFY command',
      category: 'VSAM',
      tags: ['vsam', 'file-error', 'status-35']
    });
  }

  protected cleanup(): void {
    // Cleanup KB entry specific resources
  }

  testKBEntryDisplay(entryComponent: React.ReactElement): void {
    describe('KB Entry Display', () => {
      it('displays entry information correctly', () => {
        customRender(entryComponent);

        expect(screen.getByText(this.testEntry.title)).toBeInTheDocument();
        expect(screen.getByText(this.testEntry.problem)).toBeInTheDocument();
        expect(screen.getByText(/check file catalog/i)).toBeInTheDocument();
        expect(screen.getByText(this.testEntry.category)).toBeInTheDocument();

        this.testEntry.tags?.forEach(tag => {
          expect(screen.getByText(tag)).toBeInTheDocument();
        });
      });

      it('handles entry rating', async () => {
        const onRate = vi.fn();
        const EntryWithRating = React.cloneElement(entryComponent, { onRate });

        customRender(EntryWithRating);

        const successButton = screen.getByRole('button', { name: /helpful/i });
        await userEvent.click(successButton);

        expect(onRate).toHaveBeenCalledWith(this.testEntry.id, true);
      });

      it('displays usage statistics', () => {
        customRender(entryComponent);

        expect(screen.getByText(`Used ${this.testEntry.usage_count} times`)).toBeInTheDocument();

        const successRate = Math.round(
          (this.testEntry.success_count / this.testEntry.usage_count) * 100
        );
        expect(screen.getByText(`${successRate}% success rate`)).toBeInTheDocument();
      });
    });
  }

  testKBEntryEditing(editableEntryComponent: React.ReactElement): void {
    describe('KB Entry Editing', () => {
      it('enables edit mode', async () => {
        customRender(editableEntryComponent);

        const editButton = screen.getByRole('button', { name: /edit/i });
        await userEvent.click(editButton);

        // Should show form fields
        expect(screen.getByDisplayValue(this.testEntry.title)).toBeInTheDocument();
        expect(screen.getByDisplayValue(this.testEntry.problem)).toBeInTheDocument();
        expect(screen.getByDisplayValue(this.testEntry.solution)).toBeInTheDocument();
      });

      it('validates required fields', async () => {
        const onSave = vi.fn();
        const EditableEntry = React.cloneElement(editableEntryComponent, { onSave });

        customRender(EditableEntry);

        const editButton = screen.getByRole('button', { name: /edit/i });
        await userEvent.click(editButton);

        // Clear required field
        const titleInput = screen.getByDisplayValue(this.testEntry.title);
        await userEvent.clear(titleInput);

        const saveButton = screen.getByRole('button', { name: /save/i });
        await userEvent.click(saveButton);

        // Should show validation error
        expect(screen.getByText(/title is required/i)).toBeInTheDocument();
        expect(onSave).not.toHaveBeenCalled();
      });

      it('saves changes successfully', async () => {
        const onSave = vi.fn();
        const EditableEntry = React.cloneElement(editableEntryComponent, { onSave });

        customRender(EditableEntry);

        const editButton = screen.getByRole('button', { name: /edit/i });
        await userEvent.click(editButton);

        // Modify title
        const titleInput = screen.getByDisplayValue(this.testEntry.title);
        await userEvent.clear(titleInput);
        await userEvent.type(titleInput, 'Updated VSAM Issue');

        const saveButton = screen.getByRole('button', { name: /save/i });
        await userEvent.click(saveButton);

        expect(onSave).toHaveBeenCalledWith(
          expect.objectContaining({
            ...this.testEntry,
            title: 'Updated VSAM Issue'
          })
        );
      });
    });
  }
}

/**
 * Performance Component Test Pattern
 */
export class PerformanceComponentTest extends BaseComponentTest {
  protected setupMockData(): void {
    // Setup performance-specific mock data
  }

  protected cleanup(): void {
    // Cleanup performance monitoring
  }

  testComponentPerformance(component: React.ReactElement, maxRenderTime: number = 100): void {
    describe('Component Performance', () => {
      it('renders within performance threshold', async () => {
        await AssertionHelpers.assertPerformance(
          async () => {
            customRender(component);
          },
          maxRenderTime,
          'Component render'
        );
      });

      it('handles large datasets efficiently', async () => {
        const largeDataset = TestDataGenerator.createLargeDataset(1000);
        const ComponentWithLargeData = React.cloneElement(component, {
          data: largeDataset
        });

        await AssertionHelpers.assertMemoryUsage(
          async () => {
            customRender(ComponentWithLargeData);
          },
          50, // 50MB max
          'Large dataset rendering'
        );
      });

      it('implements proper memoization', () => {
        const renderSpy = vi.fn();
        const MemoizedComponent = React.memo(
          (props: any) => {
            renderSpy();
            return component;
          }
        );

        const { rerender } = customRender(<MemoizedComponent data={[]} />);

        // Re-render with same props
        rerender(<MemoizedComponent data={[]} />);

        // Should only render once due to memoization
        expect(renderSpy).toHaveBeenCalledTimes(1);
      });
    });
  }
}

/**
 * Form Component Test Pattern
 */
export class FormComponentTest extends BaseComponentTest {
  protected setupMockData(): void {
    // Setup form-specific mock data
  }

  protected cleanup(): void {
    // Cleanup form resources
  }

  testFormValidation(formComponent: React.ReactElement): void {
    describe('Form Validation', () => {
      it('validates required fields', async () => {
        customRender(formComponent);

        const submitButton = screen.getByRole('button', { name: /submit/i });
        await userEvent.click(submitButton);

        // Should show validation errors
        expect(screen.getByText(/required/i)).toBeInTheDocument();
      });

      it('validates field formats', async () => {
        customRender(formComponent);

        const emailInput = screen.getByRole('textbox', { name: /email/i });
        await userEvent.type(emailInput, 'invalid-email');

        const submitButton = screen.getByRole('button', { name: /submit/i });
        await userEvent.click(submitButton);

        expect(screen.getByText(/valid email/i)).toBeInTheDocument();
      });

      it('submits valid form data', async () => {
        const onSubmit = vi.fn();
        const FormWithSubmit = React.cloneElement(formComponent, { onSubmit });

        customRender(FormWithSubmit);

        // Fill required fields
        const titleInput = screen.getByRole('textbox', { name: /title/i });
        await userEvent.type(titleInput, 'Valid Title');

        const submitButton = screen.getByRole('button', { name: /submit/i });
        await userEvent.click(submitButton);

        expect(onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Valid Title'
          })
        );
      });
    });
  }

  testFormAccessibility(formComponent: React.ReactElement): void {
    describe('Form Accessibility', () => {
      it('associates labels with form controls', () => {
        customRender(formComponent);

        const inputs = screen.getAllByRole('textbox');
        inputs.forEach(input => {
          const inputId = input.getAttribute('id');
          if (inputId) {
            const label = screen.getByLabelText(inputId);
            expect(label).toBeInTheDocument();
          }
        });
      });

      it('provides error messages for screen readers', async () => {
        customRender(formComponent);

        const submitButton = screen.getByRole('button', { name: /submit/i });
        await userEvent.click(submitButton);

        const errorMessage = screen.getByRole('alert');
        expect(errorMessage).toBeInTheDocument();
        expect(errorMessage).toHaveAttribute('aria-live', 'polite');
      });

      it('manages focus properly', async () => {
        customRender(formComponent);

        const firstInput = screen.getAllByRole('textbox')[0];
        const submitButton = screen.getByRole('button', { name: /submit/i });

        // Tab navigation should work
        firstInput.focus();
        await userEvent.tab();

        expect(document.activeElement).not.toBe(firstInput);

        // Submit button should be focusable
        submitButton.focus();
        expect(document.activeElement).toBe(submitButton);
      });
    });
  }
}

// Export test pattern classes
export {
  BaseComponentTest,
  SearchComponentTest,
  KBEntryComponentTest,
  PerformanceComponentTest,
  FormComponentTest
};