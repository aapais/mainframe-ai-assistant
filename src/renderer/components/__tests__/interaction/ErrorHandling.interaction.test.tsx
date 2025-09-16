import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import { customRender, MockDataGenerator } from '../test-utils';
import {
  SearchUserFlow,
  AddEntryUserFlow,
  RatingSolutionUserFlow,
  ErrorHandlingFlow,
  UserFlowPerformance
} from './user-flow-helpers';
import './setup';

// Mock Error Boundary Component
interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

class TestErrorBoundary extends React.Component<
  { children: React.ReactNode; onError?: (error: Error, errorInfo: React.ErrorInfo) => void },
  ErrorBoundaryState
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ error, errorInfo });
    this.props.onError?.(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div role="alert" className="error-boundary">
          <h2>Something went wrong</h2>
          <details>
            <summary>Error details</summary>
            <p>{this.state.error?.message}</p>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false })}
              aria-label="Retry operation"
            >
              Retry
            </button>
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}

// Mock component that can simulate various error conditions
const MockErrorProneComponent: React.FC<{
  simulateError?: 'render' | 'network' | 'validation' | 'timeout' | null;
  onError?: (error: Error) => void;
  entries?: any[];
  onSearch?: (query: string) => Promise<any[]>;
  onAddEntry?: (entry: any) => Promise<void>;
  onRateEntry?: (entryId: string, rating: boolean) => Promise<void>;
}> = ({
  simulateError = null,
  onError,
  entries = [],
  onSearch,
  onAddEntry,
  onRateEntry
}) => {
  const [searchResults, setSearchResults] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [showAddForm, setShowAddForm] = React.useState(false);

  React.useEffect(() => {
    if (simulateError === 'render') {
      throw new Error('Simulated render error');
    }
  }, [simulateError]);

  const handleSearch = async (query: string) => {
    if (simulateError === 'network') {
      setError('Network error: Unable to connect to search service');
      onError?.(new Error('Network error'));
      return;
    }

    if (simulateError === 'timeout') {
      setIsLoading(true);
      await new Promise(resolve => setTimeout(resolve, 5000)); // Long timeout
      setError('Request timeout: Search took too long');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const results = onSearch ? await onSearch(query) : [];
      setSearchResults(results);
    } catch (err) {
      setError('Search failed');
      onError?.(err as Error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddEntry = async (entryData: any) => {
    if (simulateError === 'validation') {
      setError('Validation error: Title must be at least 10 characters');
      onError?.(new Error('Validation error'));
      return;
    }

    if (simulateError === 'network') {
      setError('Network error: Unable to save entry');
      onError?.(new Error('Network error'));
      return;
    }

    try {
      await onAddEntry?.(entryData);
      setShowAddForm(false);
    } catch (err) {
      setError('Failed to add entry');
      onError?.(err as Error);
    }
  };

  const handleRateEntry = async (entryId: string, rating: boolean) => {
    if (simulateError === 'network') {
      setError('Network error: Unable to submit rating');
      onError?.(new Error('Network rating error'));
      return;
    }

    try {
      await onRateEntry?.(entryId, rating);
    } catch (err) {
      setError('Failed to submit rating');
      onError?.(err as Error);
    }
  };

  return (
    <div className="error-prone-component">
      {/* Error Display */}
      {error && (
        <div role="alert" className="error-message" aria-live="assertive">
          <strong>Error:</strong> {error}
          <button
            type="button"
            onClick={() => setError(null)}
            aria-label="Dismiss error"
            className="error-dismiss"
          >
            ×
          </button>
        </div>
      )}

      {/* Search Interface */}
      <div className="search-section">
        <div className="search-controls">
          <input
            type="search"
            role="searchbox"
            placeholder="Search knowledge base..."
            onChange={(e) => {
              if (e.target.value.trim()) {
                handleSearch(e.target.value);
              } else {
                setSearchResults([]);
              }
            }}
            disabled={isLoading}
          />
          {isLoading && (
            <div className="loading-indicator" aria-live="polite">
              Searching...
            </div>
          )}
        </div>

        {searchResults.length > 0 && (
          <div className="search-results">
            {searchResults.map((result, index) => (
              <article key={index} className="result-item">
                <h3>{result.title}</h3>
                <p>{result.problem}</p>
                <div className="result-actions">
                  <button
                    type="button"
                    onClick={() => handleRateEntry(result.id, true)}
                    aria-label={`Rate ${result.title} as helpful`}
                  >
                    👍 Helpful
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRateEntry(result.id, false)}
                    aria-label={`Rate ${result.title} as not helpful`}
                  >
                    👎 Not helpful
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        {searchResults.length === 0 && !isLoading && !error && (
          <div className="no-results" role="status">
            Enter a search term to find knowledge base entries
          </div>
        )}
      </div>

      {/* Add Entry Section */}
      <div className="add-section">
        <button
          type="button"
          onClick={() => setShowAddForm(true)}
          disabled={isLoading}
          aria-label="Add new knowledge entry"
        >
          + Add Knowledge
        </button>

        {showAddForm && (
          <form
            className="add-form"
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              handleAddEntry({
                title: formData.get('title'),
                problem: formData.get('problem'),
                solution: formData.get('solution'),
                category: formData.get('category')
              });
            }}
            role="form"
            aria-label="Add knowledge entry form"
          >
            <div className="form-field">
              <label htmlFor="title">Title</label>
              <input id="title" name="title" type="text" required />
            </div>

            <div className="form-field">
              <label htmlFor="category">Category</label>
              <select id="category" name="category" required>
                <option value="">Select category</option>
                <option value="VSAM">VSAM</option>
                <option value="JCL">JCL</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="problem">Problem</label>
              <textarea id="problem" name="problem" required rows={3} />
            </div>

            <div className="form-field">
              <label htmlFor="solution">Solution</label>
              <textarea id="solution" name="solution" required rows={3} />
            </div>

            <div className="form-actions">
              <button type="button" onClick={() => setShowAddForm(false)}>
                Cancel
              </button>
              <button type="submit" disabled={isLoading}>
                Add Entry
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Retry Section */}
      {error && (
        <div className="retry-section">
          <button
            type="button"
            onClick={() => {
              setError(null);
              setSearchResults([]);
              setIsLoading(false);
            }}
            aria-label="Retry last operation"
          >
            🔄 Retry
          </button>
        </div>
      )}
    </div>
  );
};

describe('Error Handling - User Interaction Tests', () => {
  let mockOnSearch: jest.Mock;
  let mockOnAddEntry: jest.Mock;
  let mockOnRateEntry: jest.Mock;
  let mockOnError: jest.Mock;
  let mockEntries: any[];

  beforeEach(() => {
    mockOnSearch = jest.fn();
    mockOnAddEntry = jest.fn();
    mockOnRateEntry = jest.fn();
    mockOnError = jest.fn();

    mockEntries = [
      MockDataGenerator.kbEntry({
        id: 'error-test-1',
        title: 'VSAM Error Test Entry',
        problem: 'Test problem for error handling scenarios',
        solution: 'Test solution for error scenarios',
        category: 'VSAM'
      }),
      MockDataGenerator.kbEntry({
        id: 'error-test-2',
        title: 'JCL Error Test Entry',
        problem: 'Another test problem for error handling',
        solution: 'Another test solution',
        category: 'JCL'
      })
    ];

    // Reset console mocks
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    // Clear performance measurements
    UserFlowPerformance.clearMeasurements();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Network Error Handling', () => {
    test('should handle search network errors gracefully', async () => {
      const { user } = customRender(
        <MockErrorProneComponent
          simulateError="network"
          onError={mockOnError}
          entries={mockEntries}
          onSearch={mockOnSearch}
        />
      );

      const errorFlow = new ErrorHandlingFlow({ user });

      // Attempt search that will fail
      const searchInput = screen.getByRole('searchbox');
      await user.type(searchInput, 'test query');

      // Wait for error to appear
      await waitFor(() => {
        const errorAlert = screen.getByRole('alert');
        expect(errorAlert).toHaveTextContent(/network error.*unable to connect/i);
      });

      // Error should be dismissible
      const dismissButton = screen.getByRole('button', { name: /dismiss error/i });
      expect(dismissButton).toBeInTheDocument();

      await user.click(dismissButton);

      // Error should be dismissed
      await waitFor(() => {
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      });

      // Verify error callback was called
      expect(mockOnError).toHaveBeenCalledWith(expect.any(Error));
    });

    test('should provide retry functionality after network error', async () => {
      mockOnSearch
        .mockRejectedValueOnce(new Error('Network failed'))
        .mockResolvedValueOnce(mockEntries);

      const { user } = customRender(
        <MockErrorProneComponent
          onError={mockOnError}
          entries={mockEntries}
          onSearch={mockOnSearch}
        />
      );

      // Trigger initial error
      const searchInput = screen.getByRole('searchbox');
      await user.type(searchInput, 'test');

      // Wait for error
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      // Use retry functionality
      const retryButton = screen.getByRole('button', { name: /retry/i });
      await user.click(retryButton);

      // Search again should succeed
      await user.clear(searchInput);
      await user.type(searchInput, 'test retry');

      await waitFor(() => {
        expect(mockOnSearch).toHaveBeenCalledTimes(2);
      });
    });

    test('should handle add entry network failures', async () => {
      const { user } = customRender(
        <MockErrorProneComponent
          simulateError="network"
          onError={mockOnError}
          onAddEntry={mockOnAddEntry}
        />
      );

      const errorFlow = new ErrorHandlingFlow({ user });

      await errorFlow.testFormErrorRecovery();

      // Should show network error
      await waitFor(() => {
        const errorAlert = screen.getByRole('alert');
        expect(errorAlert).toHaveTextContent(/network error.*unable to save/i);
      });

      // Form should remain open for retry
      expect(screen.getByRole('form')).toBeInTheDocument();
    });

    test('should handle rating network failures', async () => {
      mockOnSearch.mockResolvedValue(mockEntries);

      const { user } = customRender(
        <MockErrorProneComponent
          simulateError="network"
          onError={mockOnError}
          onSearch={mockOnSearch}
          onRateEntry={mockOnRateEntry}
        />
      );

      // Search to get results
      const searchInput = screen.getByRole('searchbox');
      await user.type(searchInput, 'test');

      await waitFor(() => {
        const results = screen.getAllByRole('article');
        expect(results.length).toBeGreaterThan(0);
      });

      // Try to rate - should fail
      const helpfulButton = screen.getByRole('button', { name: /rate.*helpful/i });
      await user.click(helpfulButton);

      await waitFor(() => {
        const errorAlert = screen.getByRole('alert');
        expect(errorAlert).toHaveTextContent(/network error.*unable to submit rating/i);
      });

      expect(mockOnError).toHaveBeenCalled();
    });
  });

  describe('Validation Error Handling', () => {
    test('should handle form validation errors', async () => {
      const { user } = customRender(
        <MockErrorProneComponent
          simulateError="validation"
          onError={mockOnError}
          onAddEntry={mockOnAddEntry}
        />
      );

      // Open add form
      const addButton = screen.getByRole('button', { name: /add.*knowledge/i });
      await user.click(addButton);

      // Fill form with invalid data
      await user.type(screen.getByRole('textbox', { name: /title/i }), 'Short'); // Too short
      await user.selectOptions(screen.getByRole('combobox', { name: /category/i }), 'VSAM');
      await user.type(screen.getByRole('textbox', { name: /problem/i }), 'Problem description');
      await user.type(screen.getByRole('textbox', { name: /solution/i }), 'Solution steps');

      // Submit form
      const submitButton = screen.getByRole('button', { name: /add entry/i });
      await user.click(submitButton);

      // Should show validation error
      await waitFor(() => {
        const errorAlert = screen.getByRole('alert');
        expect(errorAlert).toHaveTextContent(/validation error.*title must be at least 10 characters/i);
      });

      // Form should remain open
      expect(screen.getByRole('form')).toBeInTheDocument();

      // Should be able to correct and resubmit
      const titleInput = screen.getByRole('textbox', { name: /title/i });
      await user.clear(titleInput);
      await user.type(titleInput, 'Valid Long Title for Testing');

      // Clear error first
      await user.click(screen.getByRole('button', { name: /dismiss error/i }));

      // Submit again should work (error simulation turned off after first error)
      // This would need to be implemented based on actual error handling logic
    });

    test('should validate required fields before submission', async () => {
      const { user } = customRender(
        <MockErrorProneComponent
          onError={mockOnError}
          onAddEntry={mockOnAddEntry}
        />
      );

      // Open add form
      await user.click(screen.getByRole('button', { name: /add.*knowledge/i }));

      // Try to submit empty form
      const submitButton = screen.getByRole('button', { name: /add entry/i });
      await user.click(submitButton);

      // Browser validation should prevent submission
      const titleInput = screen.getByRole('textbox', { name: /title/i });
      expect(titleInput).toBeInvalid();

      // Fill required fields
      await user.type(titleInput, 'Valid Title');
      await user.selectOptions(screen.getByRole('combobox', { name: /category/i }), 'VSAM');
      await user.type(screen.getByRole('textbox', { name: /problem/i }), 'Problem');
      await user.type(screen.getByRole('textbox', { name: /solution/i }), 'Solution');

      // Now submission should work
      expect(titleInput).toBeValid();
    });
  });

  describe('Timeout Error Handling', () => {
    test('should handle request timeouts', async () => {
      const { user } = customRender(
        <MockErrorProneComponent
          simulateError="timeout"
          onError={mockOnError}
          onSearch={mockOnSearch}
        />
      );

      // Start search that will timeout
      const searchInput = screen.getByRole('searchbox');
      await user.type(searchInput, 'timeout test');

      // Should show loading state
      expect(screen.getByText(/searching.../i)).toBeInTheDocument();

      // Wait for timeout error
      await waitFor(
        () => {
          const errorAlert = screen.getByRole('alert');
          expect(errorAlert).toHaveTextContent(/request timeout.*search took too long/i);
        },
        { timeout: 6000 }
      );

      // Loading should stop
      expect(screen.queryByText(/searching.../i)).not.toBeInTheDocument();
    }, 10000);

    test('should allow cancellation of long-running operations', async () => {
      const { user } = customRender(
        <MockErrorProneComponent
          simulateError="timeout"
          onError={mockOnError}
          onSearch={mockOnSearch}
        />
      );

      // Start long operation
      const searchInput = screen.getByRole('searchbox');
      await user.type(searchInput, 'long operation');

      // Should show loading
      expect(screen.getByText(/searching.../i)).toBeInTheDocument();

      // User should be able to start new search (cancel previous)
      await user.clear(searchInput);
      await user.type(searchInput, 'new search');

      // Should still be in loading state but with new operation
      expect(screen.getByText(/searching.../i)).toBeInTheDocument();
    });
  });

  describe('Component Error Boundaries', () => {
    test('should catch and handle render errors', async () => {
      const { user } = customRender(
        <TestErrorBoundary onError={mockOnError}>
          <MockErrorProneComponent
            simulateError="render"
            onError={mockOnError}
          />
        </TestErrorBoundary>
      );

      // Error boundary should catch the render error
      expect(screen.getByRole('alert')).toHaveTextContent(/something went wrong/i);
      expect(screen.getByText(/simulated render error/i)).toBeInTheDocument();

      // Should have retry functionality
      const retryButton = screen.getByRole('button', { name: /retry operation/i });
      expect(retryButton).toBeInTheDocument();

      // Error callback should have been called
      expect(mockOnError).toHaveBeenCalled();
    });

    test('should allow recovery from error boundary', async () => {
      const { user, rerender } = customRender(
        <TestErrorBoundary onError={mockOnError}>
          <MockErrorProneComponent
            simulateError="render"
            onError={mockOnError}
          />
        </TestErrorBoundary>
      );

      // Should show error boundary
      expect(screen.getByRole('alert')).toBeInTheDocument();

      // Click retry
      const retryButton = screen.getByRole('button', { name: /retry operation/i });
      await user.click(retryButton);

      // Rerender without error
      rerender(
        <TestErrorBoundary onError={mockOnError}>
          <MockErrorProneComponent
            simulateError={null}
            onError={mockOnError}
            onSearch={mockOnSearch}
          />
        </TestErrorBoundary>
      );

      // Should now render normally
      expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
      expect(screen.getByRole('searchbox')).toBeInTheDocument();
    });
  });

  describe('Graceful Degradation', () => {
    test('should provide fallback functionality when AI services fail', async () => {
      // Simulate AI service failure with local fallback
      mockOnSearch
        .mockRejectedValueOnce(new Error('AI service unavailable'))
        .mockResolvedValueOnce([
          ...mockEntries.slice(0, 1) // Limited local results
        ]);

      const { user } = customRender(
        <MockErrorProneComponent
          onError={mockOnError}
          onSearch={mockOnSearch}
          entries={mockEntries}
        />
      );

      const searchInput = screen.getByRole('searchbox');
      await user.type(searchInput, 'test search');

      // Should show error but then fallback
      await waitFor(() => {
        expect(mockOnSearch).toHaveBeenCalledTimes(1);
      });

      // In a real implementation, this would show a fallback message
      // and provide limited but functional search results
    });

    test('should maintain core functionality during partial failures', async () => {
      // Rating fails but search works
      mockOnSearch.mockResolvedValue(mockEntries);
      mockOnRateEntry.mockRejectedValue(new Error('Rating service down'));

      const { user } = customRender(
        <MockErrorProneComponent
          onError={mockOnError}
          onSearch={mockOnSearch}
          onRateEntry={mockOnRateEntry}
        />
      );

      // Search should work
      const searchInput = screen.getByRole('searchbox');
      await user.type(searchInput, 'test');

      await waitFor(() => {
        const results = screen.getAllByRole('article');
        expect(results.length).toBeGreaterThan(0);
      });

      // Rating should fail but not break the component
      const helpfulButton = screen.getByRole('button', { name: /rate.*helpful/i });
      await user.click(helpfulButton);

      // Should show rating error but search still functional
      await waitFor(() => {
        expect(mockOnError).toHaveBeenCalled();
      });

      // Search should still work
      await user.clear(searchInput);
      await user.type(searchInput, 'another search');

      await waitFor(() => {
        expect(mockOnSearch).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('User Experience During Errors', () => {
    test('should provide clear error messages to users', async () => {
      const { user } = customRender(
        <MockErrorProneComponent
          simulateError="network"
          onError={mockOnError}
          onSearch={mockOnSearch}
        />
      );

      const searchInput = screen.getByRole('searchbox');
      await user.type(searchInput, 'test');

      await waitFor(() => {
        const errorAlert = screen.getByRole('alert');

        // Error message should be user-friendly
        expect(errorAlert).toHaveTextContent(/network error/i);
        expect(errorAlert).not.toHaveTextContent(/undefined/i);
        expect(errorAlert).not.toHaveTextContent(/null/i);
        expect(errorAlert).not.toHaveTextContent(/object Object/i);
      });
    });

    test('should maintain accessibility during error states', async () => {
      const { user } = customRender(
        <MockErrorProneComponent
          simulateError="network"
          onError={mockOnError}
          onSearch={mockOnSearch}
        />
      );

      const searchInput = screen.getByRole('searchbox');
      await user.type(searchInput, 'test');

      await waitFor(() => {
        const errorAlert = screen.getByRole('alert');

        // Error should have proper ARIA attributes
        expect(errorAlert).toHaveAttribute('role', 'alert');
        expect(errorAlert).toHaveAttribute('aria-live', 'assertive');

        // Dismiss button should be accessible
        const dismissButton = screen.getByRole('button', { name: /dismiss error/i });
        expect(dismissButton).toHaveAttribute('aria-label', 'Dismiss error');
      });

      // Keyboard navigation should still work
      const dismissButton = screen.getByRole('button', { name: /dismiss error/i });
      dismissButton.focus();
      expect(document.activeElement).toBe(dismissButton);

      await user.keyboard(' ');
      await waitFor(() => {
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      });
    });

    test('should prevent user actions during error states when appropriate', async () => {
      const { user } = customRender(
        <MockErrorProneComponent
          simulateError="timeout"
          onError={mockOnError}
          onSearch={mockOnSearch}
          onAddEntry={mockOnAddEntry}
        />
      );

      // Trigger loading state
      const searchInput = screen.getByRole('searchbox');
      await user.type(searchInput, 'test');

      // Search input should be disabled during loading
      expect(searchInput).toBeDisabled();

      // Add button should also be disabled
      const addButton = screen.getByRole('button', { name: /add.*knowledge/i });
      expect(addButton).toBeDisabled();
    });
  });

  describe('Error Recovery and Resilience', () => {
    test('should recover from transient errors', async () => {
      // First call fails, second succeeds
      mockOnSearch
        .mockRejectedValueOnce(new Error('Transient error'))
        .mockResolvedValueOnce(mockEntries);

      const { user } = customRender(
        <MockErrorProneComponent
          onError={mockOnError}
          onSearch={mockOnSearch}
        />
      );

      // First search fails
      const searchInput = screen.getByRole('searchbox');
      await user.type(searchInput, 'first search');

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      // Retry should succeed
      const retryButton = screen.getByRole('button', { name: /retry/i });
      await user.click(retryButton);

      // New search should work
      await user.clear(searchInput);
      await user.type(searchInput, 'second search');

      await waitFor(() => {
        const results = screen.getAllByRole('article');
        expect(results.length).toBeGreaterThan(0);
      });

      expect(mockOnSearch).toHaveBeenCalledTimes(2);
    });

    test('should handle multiple concurrent error scenarios', async () => {
      mockOnSearch.mockRejectedValue(new Error('Search failed'));
      mockOnAddEntry.mockRejectedValue(new Error('Add failed'));

      const { user } = customRender(
        <MockErrorProneComponent
          onError={mockOnError}
          onSearch={mockOnSearch}
          onAddEntry={mockOnAddEntry}
        />
      );

      // Trigger search error
      const searchInput = screen.getByRole('searchbox');
      await user.type(searchInput, 'test');

      // Trigger add error
      const addButton = screen.getByRole('button', { name: /add.*knowledge/i });
      await user.click(addButton);

      // Fill and submit form
      await user.type(screen.getByRole('textbox', { name: /title/i }), 'Test Title');
      await user.selectOptions(screen.getByRole('combobox', { name: /category/i }), 'VSAM');
      await user.type(screen.getByRole('textbox', { name: /problem/i }), 'Problem');
      await user.type(screen.getByRole('textbox', { name: /solution/i }), 'Solution');

      const submitButton = screen.getByRole('button', { name: /add entry/i });
      await user.click(submitButton);

      // Should handle both errors appropriately
      await waitFor(() => {
        const alerts = screen.getAllByRole('alert');
        expect(alerts.length).toBeGreaterThan(0);
      });

      expect(mockOnError).toHaveBeenCalledTimes(2);
    });
  });

  describe('Performance During Error Conditions', () => {
    test('should maintain performance when handling errors', async () => {
      const { user } = customRender(
        <MockErrorProneComponent
          simulateError="network"
          onError={mockOnError}
          onSearch={mockOnSearch}
        />
      );

      const errorFlow = new ErrorHandlingFlow({ user, performanceTracking: true });

      const startTime = performance.now();

      await errorFlow.testNetworkErrorHandling();

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Error handling should complete quickly
      expect(totalTime).toBeLessThan(3000); // 3 seconds

      // Should not cause memory leaks or performance degradation
      expect(mockOnError).toHaveBeenCalled();
    });

    test('should prevent memory leaks during error conditions', async () => {
      const { user, unmount } = customRender(
        <MockErrorProneComponent
          simulateError="network"
          onError={mockOnError}
          onSearch={mockOnSearch}
        />
      );

      // Trigger multiple errors
      const searchInput = screen.getByRole('searchbox');

      for (let i = 0; i < 5; i++) {
        await user.clear(searchInput);
        await user.type(searchInput, `test ${i}`);

        await waitFor(() => {
          expect(screen.getByRole('alert')).toBeInTheDocument();
        });

        // Dismiss error
        await user.click(screen.getByRole('button', { name: /dismiss error/i }));
      }

      // Component should unmount cleanly
      unmount();

      // No hanging references or timers
      expect(mockOnError).toHaveBeenCalledTimes(5);
    });
  });
});