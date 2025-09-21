/**
 * TDD Tests for Search Filter Clearing - RED Phase
 * Testing search filter functionality and clearing behavior
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import IncidentQueue from '../../../src/renderer/components/incident/IncidentQueue';
import { useSearch } from '../../../src/renderer/hooks/useSearch';

// Mock the useSearch hook
jest.mock('../../../src/renderer/hooks/useSearch');
const mockUseSearch = useSearch as jest.MockedFunction<typeof useSearch>;

// Mock incident data
const mockIncidents = [
  {
    id: '1',
    title: 'Database Connection Issue',
    problem: 'Cannot connect to production database',
    solution: 'Check connection settings',
    category: 'Database',
    tags: ['database', 'connection', 'production'],
    created_at: new Date('2024-01-15T10:30:00'),
    updated_at: new Date(),
    created_by: 'system',
    usage_count: 5,
    success_count: 4,
    failure_count: 1,
    version: 1,
    status: 'open',
    priority: 'P1',
    escalation_level: 'none',
    business_impact: 'critical',
    customer_impact: true,
    incident_number: 'INC-2024-001',
    reporter: 'ops@company.com'
  },
  {
    id: '2',
    title: 'Server Performance Degradation',
    problem: 'Server responding slowly',
    solution: 'Restart application server',
    category: 'Infrastructure',
    tags: ['server', 'performance', 'slow'],
    created_at: new Date('2024-01-15T09:15:00'),
    updated_at: new Date(),
    created_by: 'monitoring',
    usage_count: 3,
    success_count: 3,
    failure_count: 0,
    version: 1,
    status: 'in_progress',
    priority: 'P2',
    escalation_level: 'none',
    business_impact: 'high',
    customer_impact: false,
    incident_number: 'INC-2024-002',
    reporter: 'monitoring@company.com'
  },
  {
    id: '3',
    title: 'Network Timeout Error',
    problem: 'Network requests timing out',
    solution: 'Check network configuration',
    category: 'Network',
    tags: ['network', 'timeout', 'connectivity'],
    created_at: new Date('2024-01-15T08:00:00'),
    updated_at: new Date(),
    created_by: 'system',
    usage_count: 2,
    success_count: 2,
    failure_count: 0,
    version: 1,
    status: 'resolved',
    priority: 'P3',
    escalation_level: 'none',
    business_impact: 'medium',
    customer_impact: false,
    incident_number: 'INC-2024-003',
    reporter: 'network@company.com'
  }
];

describe('Dashboard Search Filter - TDD Tests', () => {
  let mockSearchReturn: any;

  beforeEach(() => {
    mockSearchReturn = {
      query: '',
      results: [],
      isLoading: false,
      isSearching: false,
      error: null,
      hasSearched: false,
      searchType: 'local',
      resultCount: 0,
      searchTime: 0,
      search: jest.fn(),
      searchLocal: jest.fn(),
      searchWithAI: jest.fn(),
      setQuery: jest.fn(),
      clearQuery: jest.fn(),
      clearResults: jest.fn(),
      setCategory: jest.fn(),
      setTags: jest.fn(),
      addTag: jest.fn(),
      removeTag: jest.fn(),
      clearError: jest.fn(),
      retryLastSearch: jest.fn(),
      getSearchSuggestions: jest.fn(() => []),
      isEmpty: true,
      hasResults: false,
      filteredResults: [],
      topResults: []
    };

    mockUseSearch.mockReturnValue(mockSearchReturn);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('RED Phase - Initial Tests (Should Fail)', () => {
    test('should filter incidents when search term is entered', async () => {
      const user = userEvent.setup();
      const mockOnIncidentSelect = jest.fn();

      render(
        <IncidentQueue
          filters={{}}
          onIncidentSelect={mockOnIncidentSelect}
          onBulkAction={jest.fn()}
        />
      );

      const searchInput = screen.getByPlaceholderText('Search incidents...');

      // Type "database" in search
      await user.type(searchInput, 'database');

      // Should filter to show only database-related incidents
      await waitFor(() => {
        expect(searchInput).toHaveValue('database');
        // This should fail initially - we expect only 1 incident to be visible
        const incidents = screen.getAllByText(/INC-2024-/);
        expect(incidents).toHaveLength(1); // Should show only database incident
      });
    });

    test('should show all incidents when search is cleared', async () => {
      const user = userEvent.setup();
      const mockOnIncidentSelect = jest.fn();

      render(
        <IncidentQueue
          filters={{}}
          onIncidentSelect={mockOnIncidentSelect}
          onBulkAction={jest.fn()}
        />
      );

      const searchInput = screen.getByPlaceholderText('Search incidents...');

      // Type search term first
      await user.type(searchInput, 'database');
      await waitFor(() => {
        expect(searchInput).toHaveValue('database');
      });

      // Clear search input
      await user.clear(searchInput);

      // Should show all incidents again
      await waitFor(() => {
        expect(searchInput).toHaveValue('');
        // This should fail initially - expecting all 3 incidents to be visible
        const incidents = screen.getAllByText(/INC-2024-/);
        expect(incidents).toHaveLength(3); // Should show all incidents
      });
    });

    test('should have a clear button that resets search', async () => {
      const user = userEvent.setup();
      const mockOnIncidentSelect = jest.fn();

      render(
        <IncidentQueue
          filters={{}}
          onIncidentSelect={mockOnIncidentSelect}
          onBulkAction={jest.fn()}
        />
      );

      const searchInput = screen.getByPlaceholderText('Search incidents...');

      // Type search term
      await user.type(searchInput, 'server');

      // Should have a clear button (this will fail initially)
      const clearButton = screen.getByLabelText('Clear search');
      expect(clearButton).toBeInTheDocument();

      // Click clear button
      await user.click(clearButton);

      // Search input should be empty and all incidents should be visible
      await waitFor(() => {
        expect(searchInput).toHaveValue('');
        const incidents = screen.getAllByText(/INC-2024-/);
        expect(incidents).toHaveLength(3);
      });
    });

    test('should handle empty/whitespace search gracefully', async () => {
      const user = userEvent.setup();
      const mockOnIncidentSelect = jest.fn();

      render(
        <IncidentQueue
          filters={{}}
          onIncidentSelect={mockOnIncidentSelect}
          onBulkAction={jest.fn()}
        />
      );

      const searchInput = screen.getByPlaceholderText('Search incidents...');

      // Type only spaces
      await user.type(searchInput, '   ');

      // Should show all incidents (not filter with empty spaces)
      await waitFor(() => {
        const incidents = screen.getAllByText(/INC-2024-/);
        expect(incidents).toHaveLength(3); // Should show all incidents
      });
    });

    test('should perform case insensitive search', async () => {
      const user = userEvent.setup();
      const mockOnIncidentSelect = jest.fn();

      render(
        <IncidentQueue
          filters={{}}
          onIncidentSelect={mockOnIncidentSelect}
          onBulkAction={jest.fn()}
        />
      );

      const searchInput = screen.getByPlaceholderText('Search incidents...');

      // Type "DATABASE" in uppercase
      await user.type(searchInput, 'DATABASE');

      // Should still find database incident (case insensitive)
      await waitFor(() => {
        expect(searchInput).toHaveValue('DATABASE');
        const incidents = screen.getAllByText(/INC-2024-/);
        expect(incidents).toHaveLength(1); // Should find database incident
      });
    });

    test('should clear search when pressing Escape key', async () => {
      const user = userEvent.setup();
      const mockOnIncidentSelect = jest.fn();

      render(
        <IncidentQueue
          filters={{}}
          onIncidentSelect={mockOnIncidentSelect}
          onBulkAction={jest.fn()}
        />
      );

      const searchInput = screen.getByPlaceholderText('Search incidents...');

      // Type search term
      await user.type(searchInput, 'network');

      // Press Escape key
      await user.keyboard('{Escape}');

      // Search should be cleared
      await waitFor(() => {
        expect(searchInput).toHaveValue('');
        const incidents = screen.getAllByText(/INC-2024-/);
        expect(incidents).toHaveLength(3);
      });
    });

    test('should show "no results" message when search has no matches', async () => {
      const user = userEvent.setup();
      const mockOnIncidentSelect = jest.fn();

      render(
        <IncidentQueue
          filters={{}}
          onIncidentSelect={mockOnIncidentSelect}
          onBulkAction={jest.fn()}
        />
      );

      const searchInput = screen.getByPlaceholderText('Search incidents...');

      // Type search term that won't match anything
      await user.type(searchInput, 'nonexistent');

      // Should show no results message
      await waitFor(() => {
        expect(screen.getByText(/no incidents found/i)).toBeInTheDocument();
      });
    });

    test('should update incident count when search filters results', async () => {
      const user = userEvent.setup();
      const mockOnIncidentSelect = jest.fn();

      render(
        <IncidentQueue
          filters={{}}
          onIncidentSelect={mockOnIncidentSelect}
          onBulkAction={jest.fn()}
        />
      );

      const searchInput = screen.getByPlaceholderText('Search incidents...');

      // Initially should show "Showing 3 of 3 incidents"
      expect(screen.getByText(/showing 3 of 3 incidents/i)).toBeInTheDocument();

      // Type search term
      await user.type(searchInput, 'database');

      // Should update count to "Showing 1 of 3 incidents"
      await waitFor(() => {
        expect(screen.getByText(/showing 1 of 3 incidents/i)).toBeInTheDocument();
      });
    });
  });

  describe('Search Hook Integration Tests', () => {
    test('should call useSearch clearQuery when clear button is clicked', async () => {
      const user = userEvent.setup();
      const mockClearQuery = jest.fn();
      mockSearchReturn.clearQuery = mockClearQuery;

      render(
        <IncidentQueue
          filters={{}}
          onIncidentSelect={jest.fn()}
          onBulkAction={jest.fn()}
        />
      );

      const searchInput = screen.getByPlaceholderText('Search incidents...');
      await user.type(searchInput, 'test');

      // This will fail initially - no clear button exists
      const clearButton = screen.getByLabelText('Clear search');
      await user.click(clearButton);

      expect(mockClearQuery).toHaveBeenCalled();
    });

    test('should call setQuery when typing in search input', async () => {
      const user = userEvent.setup();
      const mockSetQuery = jest.fn();
      mockSearchReturn.setQuery = mockSetQuery;

      render(
        <IncidentQueue
          filters={{}}
          onIncidentSelect={jest.fn()}
          onBulkAction={jest.fn()}
        />
      );

      const searchInput = screen.getByPlaceholderText('Search incidents...');
      await user.type(searchInput, 'test');

      expect(mockSetQuery).toHaveBeenCalledWith('test');
    });

    test('should handle edge case when filteredResults is empty after clear', async () => {
      const user = userEvent.setup();
      mockSearchReturn.filteredResults = [];
      mockSearchReturn.isEmpty = true;

      render(
        <IncidentQueue
          filters={{}}
          onIncidentSelect={jest.fn()}
          onBulkAction={jest.fn()}
        />
      );

      const searchInput = screen.getByPlaceholderText('Search incidents...');
      await user.type(searchInput, 'test');
      await user.clear(searchInput);

      // Should handle empty results gracefully
      await waitFor(() => {
        expect(searchInput).toHaveValue('');
        // Should show empty state or all incidents
      });
    });
  });

  describe('Performance Tests', () => {
    test('should debounce search input to avoid excessive filtering', async () => {
      const user = userEvent.setup();
      const mockSearch = jest.fn();
      mockSearchReturn.search = mockSearch;

      render(
        <IncidentQueue
          filters={{}}
          onIncidentSelect={jest.fn()}
          onBulkAction={jest.fn()}
        />
      );

      const searchInput = screen.getByPlaceholderText('Search incidents...');

      // Type multiple characters quickly
      await user.type(searchInput, 'database', { delay: 50 });

      // Should debounce and only call search once after delay
      await waitFor(() => {
        expect(mockSearch).toHaveBeenCalledTimes(1);
      }, { timeout: 1000 });
    });
  });
});