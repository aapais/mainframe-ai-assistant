/**
 * Search Component Interaction Tests
 *
 * Tests for search interface component communication patterns,
 * including SearchInterface, SearchResults, and SearchFilters interactions.
 *
 * @author UI Testing Specialist
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { jest } from '@jest/globals';

import { SearchInterface } from '../../../src/components/search/SearchInterface';
import { SearchResults } from '../../../src/components/search/SearchResults';
import { IntelligentSearchInput } from '../../../src/components/search/IntelligentSearchInput';
import { SearchFilters } from '../../../src/components/search/SearchFilters';

import {
  ComponentInteractionTester,
  ComponentCommunicationTester,
  componentInteractionTester
} from './ComponentInteractionTestSuite';

// Mock data
const mockSearchResults = [
  {
    entry: {
      id: '1',
      title: 'VSAM Error Resolution',
      problem: 'VSAM file access error',
      solution: 'Check file allocation',
      category: 'VSAM',
      tags: ['vsam', 'error', 'file'],
      usage_count: 5,
      created_at: '2024-01-01',
      updated_at: '2024-01-01'
    },
    score: 0.95,
    matchType: 'exact' as const,
    highlights: ['VSAM', 'error']
  }
];

const mockFilters = [
  {
    id: 'category',
    type: 'category' as const,
    label: 'Category',
    value: 'all',
    active: false,
    options: [
      { label: 'All', value: 'all' },
      { label: 'VSAM', value: 'vsam' }
    ]
  }
];

describe('Search Component Interactions', () => {
  let tester: ComponentInteractionTester;
  let communicationTester: ComponentCommunicationTester;
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    tester = new ComponentInteractionTester();
    communicationTester = new ComponentCommunicationTester();
    user = userEvent.setup();

    // Mock search API
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ results: mockSearchResults })
    });
  });

  afterEach(() => {
    tester.resetMocks();
    jest.clearAllMocks();
  });

  describe('SearchInterface Integration', () => {
    it('should handle search input to results communication', async () => {
      const onSearch = tester.createMock('onSearch');
      const onResultSelect = tester.createMock('onResultSelect');

      render(
        <SearchInterface
          onSearch={onSearch}
          onResultSelect={onResultSelect}
          initialQuery=""
          enableFilters={true}
          enableSnippetPreview={true}
        />
      );

      // Find search input
      const searchInput = screen.getByPlaceholderText(/search knowledge base/i);
      expect(searchInput).toBeInTheDocument();

      // Type search query
      await user.type(searchInput, 'VSAM error');

      // Wait for debounced search
      await waitFor(() => {
        expect(onSearch).toHaveBeenCalledWith(
          'VSAM error',
          expect.any(Array),
          expect.any(Object)
        );
      }, { timeout: 1000 });

      // Assert search was triggered
      expect(onSearch).toHaveBeenCalled();
    });

    it('should propagate filter changes to search', async () => {
      const onFilterChange = tester.createMock('onFilterChange');
      const onSearch = tester.createMock('onSearch');

      render(
        <SearchInterface
          onSearch={onSearch}
          onFilterChange={onFilterChange}
          enableFilters={true}
          customFilters={mockFilters}
        />
      );

      // Open filters
      const filterButton = screen.getByRole('button', { name: /toggle.*filter/i });
      await user.click(filterButton);

      // Select a filter option
      const categoryFilter = screen.getByLabelText(/category/i);
      await user.selectOptions(categoryFilter, 'vsam');

      // Assert filter change propagated
      await waitFor(() => {
        expect(onFilterChange).toHaveBeenCalled();
      });
    });

    it('should handle result selection and preview', async () => {
      const onResultSelect = tester.createMock('onResultSelect');

      // Mock search to return results
      const mockSearch = jest.fn().mockResolvedValue(mockSearchResults);

      render(
        <SearchInterface
          onSearch={mockSearch}
          onResultSelect={onResultSelect}
          enableSnippetPreview={true}
          initialQuery="test"
        />
      );

      // Wait for initial search
      await waitFor(() => {
        expect(mockSearch).toHaveBeenCalled();
      });

      // Find and click a result
      const resultItem = await screen.findByText('VSAM Error Resolution');
      await user.click(resultItem);

      // Assert result selection was handled
      await waitFor(() => {
        expect(onResultSelect).toHaveBeenCalledWith(
          mockSearchResults[0],
          0
        );
      });
    });
  });

  describe('SearchResults Communication', () => {
    it('should handle keyboard navigation events', async () => {
      const onResultSelect = tester.createMock('onResultSelect');

      render(
        <SearchResults
          results={mockSearchResults}
          searchQuery="test"
          onResultSelect={onResultSelect}
          selectedIndex={0}
        />
      );

      // Find results container
      const resultsContainer = screen.getByRole('listbox');

      // Focus the container
      await user.click(resultsContainer);

      // Use arrow key navigation
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');

      // Assert result selection
      await waitFor(() => {
        expect(onResultSelect).toHaveBeenCalled();
      });
    });

    it('should handle voice navigation if enabled', async () => {
      const onResultSelect = tester.createMock('onResultSelect');

      // Mock speech recognition
      const mockSpeechRecognition = {
        start: jest.fn(),
        stop: jest.fn(),
        onresult: jest.fn(),
        onstart: jest.fn(),
        onend: jest.fn(),
        continuous: true,
        interimResults: true,
        lang: 'en-US'
      };

      (global as any).SpeechRecognition = jest.fn(() => mockSpeechRecognition);
      (global as any).webkitSpeechRecognition = jest.fn(() => mockSpeechRecognition);

      render(
        <SearchResults
          results={mockSearchResults}
          searchQuery="test"
          onResultSelect={onResultSelect}
          voiceNavigationEnabled={true}
        />
      );

      // Find voice navigation button
      const voiceButton = screen.getByRole('button', { name: /voice navigation/i });
      await user.click(voiceButton);

      // Assert speech recognition started
      expect(mockSpeechRecognition.start).toHaveBeenCalled();
    });

    it('should handle load more events', async () => {
      const onLoadMore = tester.createMock('onLoadMore');

      render(
        <SearchResults
          results={Array.from({ length: 25 }, (_, i) => ({
            ...mockSearchResults[0],
            entry: { ...mockSearchResults[0].entry, id: `${i}` }
          }))}
          searchQuery="test"
          onLoadMore={onLoadMore}
        />
      );

      // Find load more button
      const loadMoreButton = screen.getByRole('button', { name: /load more/i });
      await user.click(loadMoreButton);

      // Assert load more was called
      expect(onLoadMore).toHaveBeenCalled();
    });
  });

  describe('Filter Component Communication', () => {
    it('should communicate filter changes to parent', async () => {
      const onFilterChange = tester.createMock('onFilterChange');
      const onClearFilters = tester.createMock('onClearFilters');

      render(
        <SearchFilters
          filters={mockFilters}
          onFilterChange={onFilterChange}
          onClearFilters={onClearFilters}
        />
      );

      // Change a filter
      const categorySelect = screen.getByLabelText(/category/i);
      await user.selectOptions(categorySelect, 'vsam');

      // Assert filter change communicated
      await waitFor(() => {
        expect(onFilterChange).toHaveBeenCalledWith(
          'category',
          'vsam',
          true
        );
      });

      // Clear filters
      const clearButton = screen.getByRole('button', { name: /clear.*filter/i });
      await user.click(clearButton);

      // Assert clear filters communicated
      expect(onClearFilters).toHaveBeenCalled();
    });

    it('should handle tag filter interactions', async () => {
      const onFilterChange = tester.createMock('onFilterChange');

      const tagFilter = {
        id: 'tags',
        type: 'multiselect' as const,
        label: 'Tags',
        value: [],
        active: false,
        options: [
          { label: 'VSAM', value: 'vsam' },
          { label: 'Error', value: 'error' }
        ]
      };

      render(
        <SearchFilters
          filters={[tagFilter]}
          onFilterChange={onFilterChange}
          onClearFilters={() => {}}
        />
      );

      // Select multiple tags
      const vsamTag = screen.getByRole('checkbox', { name: /vsam/i });
      const errorTag = screen.getByRole('checkbox', { name: /error/i });

      await user.click(vsamTag);
      await user.click(errorTag);

      // Assert multiple tag selections
      await waitFor(() => {
        expect(onFilterChange).toHaveBeenCalledWith(
          'tags',
          expect.arrayContaining(['vsam']),
          true
        );
      });

      await waitFor(() => {
        expect(onFilterChange).toHaveBeenCalledWith(
          'tags',
          expect.arrayContaining(['error']),
          true
        );
      });
    });
  });

  describe('Cross-Component Data Flow', () => {
    it('should handle complete search workflow', async () => {
      const onSearch = jest.fn().mockResolvedValue(mockSearchResults);
      const onResultSelect = tester.createMock('onResultSelect');
      const onFilterChange = tester.createMock('onFilterChange');

      render(
        <SearchInterface
          onSearch={onSearch}
          onResultSelect={onResultSelect}
          onFilterChange={onFilterChange}
          enableFilters={true}
          enableSnippetPreview={true}
        />
      );

      // Step 1: Enter search query
      const searchInput = screen.getByPlaceholderText(/search knowledge base/i);
      await user.type(searchInput, 'VSAM');

      // Step 2: Apply filter
      const filterButton = screen.getByRole('button', { name: /toggle.*filter/i });
      await user.click(filterButton);

      // Step 3: Wait for search results
      await waitFor(() => {
        expect(onSearch).toHaveBeenCalled();
      });

      // Step 4: Select a result
      const resultItem = await screen.findByText('VSAM Error Resolution');
      await user.click(resultItem);

      // Assert complete workflow
      expect(onSearch).toHaveBeenCalled();
      expect(onResultSelect).toHaveBeenCalled();
    });

    it('should handle error states across components', async () => {
      const onError = tester.createMock('onError');
      const onSearch = jest.fn().mockRejectedValue(new Error('Search failed'));

      render(
        <SearchInterface
          onSearch={onSearch}
          onError={onError}
          initialQuery="test"
        />
      );

      // Wait for error to propagate
      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'Search failed'
          })
        );
      });

      // Assert error message displayed
      expect(screen.getByText(/search.*error/i)).toBeInTheDocument();
    });
  });

  describe('Performance and Optimization', () => {
    it('should handle virtualization when many results', async () => {
      const manyResults = Array.from({ length: 100 }, (_, i) => ({
        ...mockSearchResults[0],
        entry: { ...mockSearchResults[0].entry, id: `${i}` }
      }));

      const onResultSelect = tester.createMock('onResultSelect');

      render(
        <SearchResults
          results={manyResults}
          searchQuery="test"
          onResultSelect={onResultSelect}
          virtualizeResults={true}
        />
      );

      // Assert virtual scrolling is active
      const virtualContainer = screen.getByClassName(/virtual.*container/i);
      expect(virtualContainer).toBeInTheDocument();

      // Test scrolling behavior
      fireEvent.scroll(virtualContainer, { target: { scrollTop: 1000 } });

      // Assert virtualization working
      await waitFor(() => {
        // Only visible items should be rendered
        const renderedItems = screen.getAllByTestId(/result-\d+/);
        expect(renderedItems.length).toBeLessThan(manyResults.length);
      });
    });

    it('should debounce search input properly', async () => {
      const onSearch = tester.createMock('onSearch');

      render(
        <SearchInterface
          onSearch={onSearch}
          debounceMs={300}
          enableRealTimeSearch={true}
        />
      );

      const searchInput = screen.getByPlaceholderText(/search knowledge base/i);

      // Type rapidly
      await user.type(searchInput, 'abc');

      // Search should not be called immediately
      expect(onSearch).not.toHaveBeenCalled();

      // Wait for debounce
      await waitFor(() => {
        expect(onSearch).toHaveBeenCalledWith(
          'abc',
          expect.any(Array),
          expect.any(Object)
        );
      }, { timeout: 500 });

      // Should only be called once despite multiple keystrokes
      expect(onSearch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Accessibility Interactions', () => {
    it('should handle screen reader announcements', async () => {
      const onAccessibilityAnnouncement = tester.createMock('onAccessibilityAnnouncement');

      render(
        <SearchResults
          results={mockSearchResults}
          searchQuery="test"
          onAccessibilityAnnouncement={onAccessibilityAnnouncement}
          announceResults={true}
        />
      );

      // Assert initial announcement
      await waitFor(() => {
        expect(onAccessibilityAnnouncement).toHaveBeenCalledWith(
          expect.stringContaining('1 search results loaded'),
          'polite'
        );
      });
    });

    it('should handle keyboard shortcuts', async () => {
      const onResultSelect = tester.createMock('onResultSelect');

      render(
        <SearchResults
          results={mockSearchResults}
          searchQuery="test"
          onResultSelect={onResultSelect}
          enableAdvancedKeyboardShortcuts={true}
        />
      );

      const resultsContainer = screen.getByRole('listbox');
      await user.click(resultsContainer);

      // Test vim-style navigation
      await user.keyboard('j'); // Next
      await user.keyboard('k'); // Previous
      await user.keyboard('{Enter}'); // Select

      await waitFor(() => {
        expect(onResultSelect).toHaveBeenCalled();
      });
    });
  });
});