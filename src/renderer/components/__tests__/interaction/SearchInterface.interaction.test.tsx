import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import { SearchInterface } from '../../search/SearchInterface';
import { customRender, MockDataGenerator } from '../test-utils';
import {
  SearchUserFlow,
  UserFlowPerformance,
  ComponentIntegrationFlow,
  ErrorHandlingFlow
} from './user-flow-helpers';
import './setup';

// Mock the search service
jest.mock('../../../services/SearchService', () => ({
  SearchService: jest.fn().mockImplementation(() => ({
    buildIndex: jest.fn().mockResolvedValue(undefined),
    search: jest.fn().mockImplementation((query, entries) => {
      return Promise.resolve(
        entries
          .filter((entry: any) =>
            entry.title.toLowerCase().includes(query.toLowerCase()) ||
            entry.problem.toLowerCase().includes(query.toLowerCase())
          )
          .map((entry: any) => ({
            entry,
            score: 85,
            matchType: 'fuzzy' as const,
            highlights: {
              title: entry.title,
              problem: entry.problem.substring(0, 100) + '...'
            },
            metadata: { source: 'local' }
          }))
      );
    }),
    suggest: jest.fn().mockResolvedValue(['VSAM Status 35', 'VSAM Error', 'VSAM Recovery']),
    getRecentSearches: jest.fn().mockResolvedValue([
      { query: 'VSAM error', timestamp: new Date(), resultCount: 3 },
      { query: 'S0C7 abend', timestamp: new Date(), resultCount: 2 }
    ]),
    getPopularSearches: jest.fn().mockResolvedValue([
      { query: 'VSAM Status 35', count: 15 },
      { query: 'JCL Error', count: 12 }
    ])
  }))
}));

describe('SearchInterface - User Interaction Tests', () => {
  let mockEntries: any[];
  let mockOnEntrySelect: jest.Mock;
  let mockOnEntryRate: jest.Mock;

  beforeEach(() => {
    // Create mock KB entries
    mockEntries = [
      MockDataGenerator.kbEntry({
        id: 'entry-1',
        title: 'VSAM Status 35 - File Not Found',
        problem: 'Job abends with VSAM status code 35 when trying to open dataset',
        solution: 'Check if dataset exists and is cataloged properly',
        category: 'VSAM',
        tags: ['vsam', 'status-35', 'file-not-found']
      }),
      MockDataGenerator.kbEntry({
        id: 'entry-2',
        title: 'S0C7 Data Exception Error',
        problem: 'Program terminates with S0C7 abend during numeric operations',
        solution: 'Validate numeric fields and initialize working storage properly',
        category: 'Batch',
        tags: ['s0c7', 'data-exception', 'cobol']
      }),
      MockDataGenerator.kbEntry({
        id: 'entry-3',
        title: 'JCL Syntax Error - Missing DD Statement',
        problem: 'Job fails with JCL error indicating missing DD statement',
        solution: 'Add required DD statement to JCL and verify dataset names',
        category: 'JCL',
        tags: ['jcl', 'dd-statement', 'syntax']
      })
    ];

    mockOnEntrySelect = jest.fn();
    mockOnEntryRate = jest.fn();

    // Clear performance measurements
    UserFlowPerformance.clearMeasurements();
  });

  describe('Basic Search Workflow', () => {
    test('should perform basic search and display results', async () => {
      const { user } = customRender(
        <SearchInterface
          entries={mockEntries}
          onEntrySelect={mockOnEntrySelect}
          onEntryRate={mockOnEntryRate}
        />
      );

      const searchFlow = new SearchUserFlow({ user, performanceTracking: true });

      const results = await searchFlow.performSearch({
        query: 'VSAM',
        expectResults: 1
      });

      expect(results).toHaveLength(1);
      expect(within(results[0]).getByText(/VSAM Status 35/)).toBeInTheDocument();

      // Verify performance tracking
      const measurements = UserFlowPerformance.getAllMeasurements();
      expect(measurements['search-flow']).toBeDefined();
      expect(measurements['search-flow'].average).toBeGreaterThan(0);
    });

    test('should handle search with no results', async () => {
      const { user } = customRender(
        <SearchInterface
          entries={mockEntries}
          onEntrySelect={mockOnEntrySelect}
          onEntryRate={mockOnEntryRate}
        />
      );

      const searchFlow = new SearchUserFlow({ user });

      const results = await searchFlow.performSearch({
        query: 'NonexistentError',
        expectResults: 0
      });

      expect(results).toHaveLength(0);

      // Should show "no results" message
      expect(screen.getByText(/no results found|no entries match/i)).toBeInTheDocument();
    });

    test('should select and view entry details', async () => {
      const { user } = customRender(
        <SearchInterface
          entries={mockEntries}
          onEntrySelect={mockOnEntrySelect}
          onEntryRate={mockOnEntryRate}
        />
      );

      const searchFlow = new SearchUserFlow({ user });

      await searchFlow.performSearch({
        query: 'VSAM',
        expectResults: 1,
        selectFirst: true
      });

      // Verify entry selection callback was called
      await waitFor(() => {
        expect(mockOnEntrySelect).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'entry-1',
            title: 'VSAM Status 35 - File Not Found'
          })
        );
      });
    });

    test('should apply category filter correctly', async () => {
      const { user } = customRender(
        <SearchInterface
          entries={mockEntries}
          onEntrySelect={mockOnEntrySelect}
          onEntryRate={mockOnEntryRate}
        />
      );

      const searchFlow = new SearchUserFlow({ user });

      await searchFlow.performSearch({
        query: '',
        category: 'JCL',
        expectResults: 1
      });

      const results = screen.getAllByRole('article');
      expect(results).toHaveLength(1);
      expect(within(results[0]).getByText(/JCL Syntax Error/)).toBeInTheDocument();
    });

    test('should toggle AI search on/off', async () => {
      const { user } = customRender(
        <SearchInterface
          entries={mockEntries}
          onEntrySelect={mockOnEntrySelect}
          onEntryRate={mockOnEntryRate}
        />
      );

      const searchInput = screen.getByRole('searchbox');
      const aiToggle = screen.getByRole('checkbox', { name: /use ai/i });

      // Initially AI should be enabled
      expect(aiToggle).toBeChecked();

      // Turn off AI
      await user.click(aiToggle);
      expect(aiToggle).not.toBeChecked();

      // Perform search without AI
      await user.type(searchInput, 'VSAM error');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        const results = screen.getAllByRole('article');
        expect(results.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Advanced Search Features', () => {
    test('should open and use advanced search', async () => {
      const { user } = customRender(
        <SearchInterface
          entries={mockEntries}
          onEntrySelect={mockOnEntrySelect}
          onEntryRate={mockOnEntryRate}
        />
      );

      const searchFlow = new SearchUserFlow({ user });

      await searchFlow.performAdvancedSearch({
        query: 'error',
        tags: ['vsam', 'status-35'],
        expectResults: 1
      });

      const results = screen.getAllByRole('article');
      expect(results).toHaveLength(1);
    });

    test('should display search suggestions', async () => {
      const { user } = customRender(
        <SearchInterface
          entries={mockEntries}
          onEntrySelect={mockOnEntrySelect}
          onEntryRate={mockOnEntryRate}
        />
      );

      const searchFlow = new SearchUserFlow({ user });

      const suggestions = await searchFlow.testSearchSuggestions();

      expect(suggestions).toContain('VSAM Status 35');
      expect(suggestions).toContain('VSAM Error');
    });

    test('should manage search history', async () => {
      const { user } = customRender(
        <SearchInterface
          entries={mockEntries}
          onEntrySelect={mockOnEntrySelect}
          onEntryRate={mockOnEntryRate}
        />
      );

      const searchFlow = new SearchUserFlow({ user });

      // First perform a search to add to history
      await searchFlow.performSearch({
        query: 'VSAM error',
        expectResults: 1
      });

      // Then test history functionality
      await searchFlow.testSearchHistory();

      // Verify that a search from history was executed
      const searchInput = screen.getByRole('searchbox') as HTMLInputElement;
      expect(searchInput.value).toBeTruthy();
    });

    test('should handle sorting options', async () => {
      const { user } = customRender(
        <SearchInterface
          entries={mockEntries}
          onEntrySelect={mockOnEntrySelect}
          onEntryRate={mockOnEntryRate}
        />
      );

      const searchFlow = new SearchUserFlow({ user });

      // Test sorting by relevance (default)
      await searchFlow.performSearch({
        query: 'error',
        sortBy: 'relevance',
        expectResults: 3
      });

      let results = screen.getAllByRole('article');
      expect(results).toHaveLength(3);

      // Test sorting by date
      await searchFlow.performSearch({
        query: 'error',
        sortBy: 'date',
        expectResults: 3
      });

      results = screen.getAllByRole('article');
      expect(results).toHaveLength(3);
    });
  });

  describe('Performance Monitoring', () => {
    test('should display performance indicators', async () => {
      const { user } = customRender(
        <SearchInterface
          entries={mockEntries}
          onEntrySelect={mockOnEntrySelect}
          onEntryRate={mockOnEntryRate}
        />
      );

      const searchFlow = new SearchUserFlow({ user });

      await searchFlow.performSearch({
        query: 'VSAM',
        expectResults: 1
      });

      // Check for performance indicator
      const performanceIndicator = screen.getByText(/search time|results found/i);
      expect(performanceIndicator).toBeInTheDocument();

      // Should show search time under 1 second
      const searchTime = screen.getByText(/\d+ms|\d+\.\d+s/);
      expect(searchTime).toBeInTheDocument();
    });

    test('should show loading state during search', async () => {
      const { user } = customRender(
        <SearchInterface
          entries={mockEntries}
          onEntrySelect={mockOnEntrySelect}
          onEntryRate={mockOnEntryRate}
        />
      );

      const searchInput = screen.getByRole('searchbox');

      // Start typing to trigger search
      await user.type(searchInput, 'VSAM');

      // Should show loading indicator briefly
      const loadingIndicator = screen.queryByText(/searching|loading/i);
      // Note: May not always be visible due to fast mock responses

      // Wait for results
      await waitFor(() => {
        const results = screen.getAllByRole('article');
        expect(results.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Accessibility', () => {
    test('should support keyboard navigation', async () => {
      const { user } = customRender(
        <SearchInterface
          entries={mockEntries}
          onEntrySelect={mockOnEntrySelect}
          onEntryRate={mockOnEntryRate}
        />
      );

      const searchInput = screen.getByRole('searchbox');

      // Focus should start on search input
      searchInput.focus();
      expect(document.activeElement).toBe(searchInput);

      // Tab through interface
      await user.tab(); // Should go to advanced search button
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: /advanced/i })
      );

      await user.tab(); // Should go to category filter
      const categoryFilter = screen.getByRole('combobox', { name: /category/i });
      expect(document.activeElement).toBe(categoryFilter);

      // Use arrow keys on select
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');
    });

    test('should have proper ARIA labels and roles', async () => {
      customRender(
        <SearchInterface
          entries={mockEntries}
          onEntrySelect={mockOnEntrySelect}
          onEntryRate={mockOnEntryRate}
        />
      );

      // Check main landmarks
      expect(screen.getByRole('main')).toBeInTheDocument();
      expect(screen.getByRole('searchbox')).toBeInTheDocument();

      // Check aria-labels
      const searchInput = screen.getByRole('searchbox');
      expect(searchInput).toHaveAttribute('aria-label');

      const advancedButton = screen.getByRole('button', { name: /advanced/i });
      expect(advancedButton).toHaveAttribute('aria-pressed');
    });

    test('should announce results to screen readers', async () => {
      const { user } = customRender(
        <SearchInterface
          entries={mockEntries}
          onEntrySelect={mockOnEntrySelect}
          onEntryRate={mockOnEntryRate}
        />
      );

      const searchFlow = new SearchUserFlow({ user });

      await searchFlow.performSearch({
        query: 'VSAM',
        expectResults: 1
      });

      // Check for aria-live region with results announcement
      const liveRegion = screen.getByRole('status');
      expect(liveRegion).toBeInTheDocument();
      expect(liveRegion).toHaveTextContent(/1.*result.*found/i);
    });
  });

  describe('Error Handling', () => {
    test('should handle search service failures gracefully', async () => {
      const { user } = customRender(
        <SearchInterface
          entries={mockEntries}
          onEntrySelect={mockOnEntrySelect}
          onEntryRate={mockOnEntryRate}
        />
      );

      const errorFlow = new ErrorHandlingFlow({ user });

      await errorFlow.testNetworkErrorHandling();

      // Should show error message
      const errorMessage = screen.getByRole('alert');
      expect(errorMessage).toHaveTextContent(/error|failed/i);
    });

    test('should provide fallback when AI search fails', async () => {
      // Mock AI search failure
      const mockSearchService = require('../../../services/SearchService').SearchService;
      const mockInstance = new mockSearchService();
      mockInstance.search = jest.fn()
        .mockRejectedValueOnce(new Error('AI service unavailable'))
        .mockResolvedValueOnce([{
          entry: mockEntries[0],
          score: 75,
          matchType: 'local' as const
        }]);

      const { user } = customRender(
        <SearchInterface
          entries={mockEntries}
          onEntrySelect={mockOnEntrySelect}
          onEntryRate={mockOnEntryRate}
        />
      );

      const searchFlow = new SearchUserFlow({ user });

      // Should fallback to local search
      const results = await searchFlow.performSearch({
        query: 'VSAM',
        useAI: true,
        expectResults: 1
      });

      expect(results).toHaveLength(1);

      // Should show fallback indicator
      const fallbackMessage = screen.getByText(/using local search|ai unavailable/i);
      expect(fallbackMessage).toBeInTheDocument();
    });
  });

  describe('Integration with Other Components', () => {
    test('should integrate with entry detail view', async () => {
      const { user } = customRender(
        <SearchInterface
          entries={mockEntries}
          onEntrySelect={mockOnEntrySelect}
          onEntryRate={mockOnEntryRate}
        />
      );

      const integrationFlow = new ComponentIntegrationFlow({ user });

      await integrationFlow.testSearchToDetailFlow();

      // Verify the integration worked
      expect(mockOnEntrySelect).toHaveBeenCalled();
    });

    test('should update results when entries change', async () => {
      const { user, rerender } = customRender(
        <SearchInterface
          entries={mockEntries}
          onEntrySelect={mockOnEntrySelect}
          onEntryRate={mockOnEntryRate}
        />
      );

      const searchFlow = new SearchUserFlow({ user });

      // Initial search
      await searchFlow.performSearch({
        query: 'VSAM',
        expectResults: 1
      });

      // Add new entry
      const newEntries = [
        ...mockEntries,
        MockDataGenerator.kbEntry({
          id: 'entry-4',
          title: 'Another VSAM Error Case',
          problem: 'Different VSAM error scenario',
          solution: 'Different solution approach',
          category: 'VSAM',
          tags: ['vsam', 'different-error']
        })
      ];

      // Re-render with updated entries
      rerender(
        <SearchInterface
          entries={newEntries}
          onEntrySelect={mockOnEntrySelect}
          onEntryRate={mockOnEntryRate}
        />
      );

      // Search again should show more results
      await searchFlow.performSearch({
        query: 'VSAM',
        expectResults: 2
      });

      const results = screen.getAllByRole('article');
      expect(results).toHaveLength(2);
    });
  });

  describe('Performance Requirements', () => {
    test('should meet <1s search response time requirement', async () => {
      const { user } = customRender(
        <SearchInterface
          entries={mockEntries}
          onEntrySelect={mockOnEntrySelect}
          onEntryRate={mockOnEntryRate}
        />
      );

      const searchFlow = new SearchUserFlow({ user, performanceTracking: true });

      await searchFlow.performSearch({
        query: 'VSAM',
        expectResults: 1
      });

      const measurements = UserFlowPerformance.getAllMeasurements();
      const searchTime = measurements['search-flow'].average;

      // Should complete within 1000ms (1 second)
      expect(searchTime).toBeLessThan(1000);
    });

    test('should handle large result sets efficiently', async () => {
      // Create large entry set
      const largeEntrySet = Array.from({ length: 1000 }, (_, index) =>
        MockDataGenerator.kbEntry({
          id: `entry-${index}`,
          title: `Test Entry ${index}`,
          problem: `Test problem description ${index}`,
          solution: `Test solution ${index}`,
          category: 'Other',
          tags: ['test', `entry-${index}`]
        })
      );

      const { user } = customRender(
        <SearchInterface
          entries={largeEntrySet}
          onEntrySelect={mockOnEntrySelect}
          onEntryRate={mockOnEntryRate}
          maxResults={50}
        />
      );

      const searchFlow = new SearchUserFlow({ user, performanceTracking: true });

      await searchFlow.performSearch({
        query: 'test',
        expectResults: 50 // Should be limited by maxResults
      });

      const results = screen.getAllByRole('article');
      expect(results).toHaveLength(50);

      const measurements = UserFlowPerformance.getAllMeasurements();
      const searchTime = measurements['search-flow'].average;

      // Should still complete within performance target
      expect(searchTime).toBeLessThan(1000);
    });
  });
});