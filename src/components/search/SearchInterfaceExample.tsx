/**
 * SearchInterfaceExample - Complete Usage Example
 *
 * Demonstrates how to use the comprehensive search interface components:
 * - Main SearchInterface with all features enabled
 * - ResponsiveSearchLayout for mobile-first design
 * - Custom filters and export functionality
 * - Real-time search with WebSocket support
 * - Accessibility features and keyboard navigation
 *
 * @author Frontend Developer
 * @version 2.0.0
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { SearchInterface, SearchInterfaceHandle } from './SearchInterface';
import { ResponsiveSearchLayout } from './ResponsiveSearchLayout';
import { IntelligentSearchInput } from './IntelligentSearchInput';
import { SearchFilters } from './SearchFilters';
import { SnippetPreview } from './SnippetPreview';
import { SearchResults } from './SearchResults';
import type { SearchResult, SearchFilter, SearchOptions } from '../../types';

// ========================
// Example Data
// ========================

const EXAMPLE_SEARCH_RESULTS: SearchResult[] = [
  {
    entry: {
      id: '1',
      title: 'VSAM Status Code 92 - Invalid Key Length',
      category: 'VSAM Errors',
      problem: 'Getting VSAM status code 92 when trying to read a KSDS file. The error indicates an invalid key length but the key appears correct.',
      solution: 'Check the DEFINE CLUSTER parameters for key length. Ensure the key length in your program matches the DEFINE CLUSTER KEYLEN parameter. For this error: 1) Verify KEYLEN in DEFINE CLUSTER matches program key length 2) Check for trailing spaces in key fields 3) Validate MAXLRECL setting',
      details: 'VSAM status code 92 specifically indicates that the key length specified in the access request does not match the key length defined for the cluster.',
      code_examples: 'DEFINE CLUSTER (NAME(TEST.KSDS) KEYLEN(10) MAXLRECL(80) INDEXED)',
      tags: ['VSAM', 'KSDS', 'Status Code', 'Key Length'],
      usage_count: 45,
      updated_at: '2024-01-15T10:30:00Z',
      created_at: '2023-12-01T09:00:00Z',
      version: '1.2'
    },
    score: 0.95,
    matchType: 'exact',
    highlights: ['VSAM status code 92', 'invalid key length', 'DEFINE CLUSTER KEYLEN']
  },
  {
    entry: {
      id: '2',
      title: 'JCL S0C7 Data Exception Error Resolution',
      category: 'JCL Issues',
      problem: 'Program abending with S0C7 data exception. Usually occurs during numeric operations with invalid data.',
      solution: 'S0C7 indicates invalid numeric data. Check for: 1) Uninitialized numeric fields 2) Non-numeric data in COMP fields 3) Invalid PACKED-DECIMAL data 4) File corruption. Use debugging tools to identify the exact field causing the issue.',
      details: 'System completion code S0C7 is a data exception that occurs when the CPU encounters invalid numeric data during arithmetic operations.',
      code_examples: 'Use EXHIBIT NAMED or display statements to identify problematic fields.',
      tags: ['JCL', 'S0C7', 'Data Exception', 'Numeric'],
      usage_count: 89,
      updated_at: '2024-01-10T14:20:00Z',
      created_at: '2023-11-15T11:30:00Z',
      version: '1.1'
    },
    score: 0.87,
    matchType: 'fuzzy',
    highlights: ['S0C7 data exception', 'numeric operations', 'invalid data']
  },
  {
    entry: {
      id: '3',
      title: 'DB2 SQL Error -811 Multiple Rows Returned',
      category: 'DB2 SQL',
      problem: 'Getting SQL error -811 when executing a SELECT INTO statement. The error indicates multiple rows are being returned.',
      solution: 'Error -811 occurs when a SELECT INTO returns more than one row. Solutions: 1) Add more restrictive WHERE conditions 2) Use FETCH FIRST 1 ROW ONLY 3) Convert to cursor processing 4) Use aggregate functions if appropriate',
      details: 'SQLCODE -811 is raised when a subselect of a basic predicate returns more than one value.',
      code_examples: 'SELECT col1 INTO :var1 FROM table WHERE key = :key-value FETCH FIRST 1 ROW ONLY',
      tags: ['DB2', 'SQL', 'Error -811', 'SELECT INTO'],
      usage_count: 67,
      updated_at: '2024-01-12T16:45:00Z',
      created_at: '2023-12-10T13:15:00Z',
      version: '1.0'
    },
    score: 0.78,
    matchType: 'semantic',
    highlights: ['SQL error -811', 'multiple rows', 'SELECT INTO']
  }
];

const EXAMPLE_CUSTOM_FILTERS: SearchFilter[] = [
  {
    id: 'severity',
    type: 'category',
    label: 'Error Severity',
    value: 'all',
    active: false,
    options: [
      { label: 'All Severities', value: 'all' },
      { label: 'Critical', value: 'critical', count: 12 },
      { label: 'High', value: 'high', count: 34 },
      { label: 'Medium', value: 'medium', count: 56 },
      { label: 'Low', value: 'low', count: 23 }
    ]
  },
  {
    id: 'frequency',
    type: 'range',
    label: 'Usage Frequency',
    value: [0, 100],
    active: false,
    min: 0,
    max: 100
  }
];

// ========================
// Example Component
// ========================

export const SearchInterfaceExample: React.FC = () => {
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [websocketConnected, setWebsocketConnected] = useState(false);

  const searchInterfaceRef = useRef<SearchInterfaceHandle>(null);

  // ========================
  // Mock Search Implementation
  // ========================

  const handleSearch = useCallback(async (
    query: string,
    filters: SearchFilter[],
    options: SearchOptions
  ): Promise<SearchResult[]> => {
    setIsLoading(true);
    setError(null);

    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));

      // Mock search logic
      let results = [...EXAMPLE_SEARCH_RESULTS];

      // Filter by query
      if (query.trim()) {
        const queryLower = query.toLowerCase();
        results = results.filter(result =>
          result.entry.title.toLowerCase().includes(queryLower) ||
          result.entry.problem.toLowerCase().includes(queryLower) ||
          result.entry.solution.toLowerCase().includes(queryLower) ||
          result.entry.tags.some(tag => tag.toLowerCase().includes(queryLower))
        );
      }

      // Apply filters
      const activeFilters = filters.filter(f => f.active);
      activeFilters.forEach(filter => {
        switch (filter.id) {
          case 'category':
            if (filter.value !== 'all') {
              results = results.filter(result =>
                result.entry.category.toLowerCase().includes(filter.value.toLowerCase())
              );
            }
            break;
          case 'difficulty':
            // Mock difficulty scoring based on usage count
            const [minDiff, maxDiff] = Array.isArray(filter.value) ? filter.value : [1, 5];
            results = results.filter(result => {
              const difficulty = Math.min(5, Math.floor((result.entry.usage_count || 0) / 20) + 1);
              return difficulty >= minDiff && difficulty <= maxDiff;
            });
            break;
          case 'date':
            if (filter.value) {
              const daysAgo = parseInt(filter.value.replace('d', ''));
              const cutoffDate = new Date();
              cutoffDate.setDate(cutoffDate.getDate() - daysAgo);
              results = results.filter(result =>
                new Date(result.entry.updated_at) >= cutoffDate
              );
            }
            break;
        }
      });

      // Sort by relevance score
      results.sort((a, b) => b.score - a.score);

      setSearchResults(results);
      return results;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Search failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ========================
  // Event Handlers
  // ========================

  const handleResultSelect = useCallback((result: SearchResult, index: number) => {
    setSelectedResult(result);
    console.log('Result selected:', result.entry.title, 'at index', index);
  }, []);

  const handleFilterChange = useCallback((filters: SearchFilter[]) => {
    console.log('Filters changed:', filters.filter(f => f.active));
  }, []);

  const handleExport = useCallback((format: string, data: any) => {
    console.log('Export requested:', format, 'Data length:', JSON.stringify(data).length);
  }, []);

  const handleError = useCallback((error: Error) => {
    console.error('Search interface error:', error);
    setError(error.message);
  }, []);

  // ========================
  // WebSocket Simulation
  // ========================

  useEffect(() => {
    // Simulate WebSocket connection
    const timer = setTimeout(() => {
      setWebsocketConnected(true);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  // ========================
  // Component Examples
  // ========================

  const renderBasicExample = () => (
    <div className="example-section">
      <h3 className="text-lg font-semibold mb-4">Basic Search Interface</h3>
      <div className="border border-gray-200 rounded-lg overflow-hidden" style={{ height: '600px' }}>
        <SearchInterface
          ref={searchInterfaceRef}
          initialQuery=""
          placeholder="Search mainframe knowledge base..."
          enableRealTimeSearch={true}
          enableFilters={true}
          enableSnippetPreview={true}
          enableExport={true}
          customFilters={EXAMPLE_CUSTOM_FILTERS}
          variant="default"
          onSearch={handleSearch}
          onResultSelect={handleResultSelect}
          onFilterChange={handleFilterChange}
          onExport={handleExport}
          onError={handleError}
          virtualizeResults={true}
          announceResults={true}
          className="h-full"
        />
      </div>
    </div>
  );

  const renderResponsiveExample = () => (
    <div className="example-section">
      <h3 className="text-lg font-semibold mb-4">Responsive Layout Example</h3>
      <div className="border border-gray-200 rounded-lg overflow-hidden" style={{ height: '500px' }}>
        <ResponsiveSearchLayout
          searchInput={
            <IntelligentSearchInput
              placeholder="Responsive search..."
              enableAutocomplete={true}
              enableHistory={true}
              size="md"
            />
          }
          filtersContent={
            <SearchFilters
              filters={EXAMPLE_CUSTOM_FILTERS}
              onFilterChange={() => {}}
              onClearFilters={() => {}}
              compact={true}
            />
          }
          resultsContent={
            <SearchResults
              results={searchResults}
              searchQuery=""
              onResultSelect={handleResultSelect}
              loading={isLoading}
              error={error}
            />
          }
          previewContent={
            selectedResult && (
              <SnippetPreview
                result={selectedResult}
                searchQuery=""
                onClose={() => setSelectedResult(null)}
                compact={true}
              />
            )
          }
          enableSwipeGestures={true}
          enableKeyboardShortcuts={true}
          initialFiltersVisible={false}
          initialPreviewVisible={false}
          className="h-full"
        />
      </div>
    </div>
  );

  const renderCustomExample = () => (
    <div className="example-section">
      <h3 className="text-lg font-semibold mb-4">Custom Configuration Example</h3>
      <div className="border border-gray-200 rounded-lg overflow-hidden" style={{ height: '600px' }}>
        <SearchInterface
          initialQuery="VSAM"
          placeholder="Search with custom settings..."
          enableRealTimeSearch={true}
          enableFilters={true}
          enableSnippetPreview={true}
          enableExport={true}
          customFilters={EXAMPLE_CUSTOM_FILTERS}
          variant="compact"
          websocketUrl={websocketConnected ? 'ws://localhost:8080' : undefined}
          pageSize={10}
          debounceMs={500}
          virtualizeResults={false}
          cacheResults={true}
          maxCachedQueries={25}
          highContrastMode={false}
          announceResults={true}
          onSearch={handleSearch}
          onResultSelect={handleResultSelect}
          onFilterChange={handleFilterChange}
          onExport={handleExport}
          onError={handleError}
          className="h-full"
          ariaLabel="Custom search interface for mainframe knowledge"
        />
      </div>
    </div>
  );

  // ========================
  // Control Panel
  // ========================

  const renderControlPanel = () => (
    <div className="control-panel bg-gray-50 p-4 rounded-lg mb-6">
      <h3 className="text-lg font-semibold mb-4">Search Interface Controls</h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <button
            onClick={() => searchInterfaceRef.current?.performSearch('S0C7')}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
          >
            Search for "S0C7"
          </button>
          <button
            onClick={() => searchInterfaceRef.current?.performSearch('VSAM')}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
          >
            Search for "VSAM"
          </button>
          <button
            onClick={() => searchInterfaceRef.current?.clearSearch()}
            className="w-full px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm"
          >
            Clear Search
          </button>
        </div>

        <div className="space-y-2">
          <button
            onClick={() => searchInterfaceRef.current?.toggleFilters()}
            className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
          >
            Toggle Filters
          </button>
          <button
            onClick={() => searchInterfaceRef.current?.exportResults('json')}
            className="w-full px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm"
          >
            Export as JSON
          </button>
          <button
            onClick={() => searchInterfaceRef.current?.focusSearch()}
            className="w-full px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 text-sm"
          >
            Focus Search Input
          </button>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Results:</span>
            <span className="font-semibold">{searchResults.length}</span>
          </div>
          <div className="flex justify-between">
            <span>Loading:</span>
            <span className={isLoading ? 'text-blue-600' : 'text-gray-500'}>
              {isLoading ? 'Yes' : 'No'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>WebSocket:</span>
            <span className={websocketConnected ? 'text-green-600' : 'text-red-600'}>
              {websocketConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Selected:</span>
            <span className="font-semibold truncate max-w-20" title={selectedResult?.entry.title}>
              {selectedResult ? selectedResult.entry.title.substring(0, 20) + '...' : 'None'}
            </span>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-100 border border-red-300 rounded text-red-700 text-sm">
          <strong>Error:</strong> {error}
        </div>
      )}
    </div>
  );

  // ========================
  // Main Render
  // ========================

  return (
    <div className="search-interface-examples p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Search Interface Examples
        </h1>
        <p className="text-gray-600 mb-6">
          Comprehensive examples demonstrating the search interface components with various configurations.
          Features include intelligent autocomplete, responsive design, advanced filtering, snippet preview,
          and accessibility support.
        </p>

        {renderControlPanel()}
      </div>

      <div className="space-y-8">
        {renderBasicExample()}
        {renderResponsiveExample()}
        {renderCustomExample()}
      </div>

      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">Implementation Notes</h3>
        <ul className="text-blue-800 text-sm space-y-1">
          <li>• Uses debounced search with configurable delay</li>
          <li>• Supports virtual scrolling for large result sets</li>
          <li>• Includes comprehensive keyboard navigation</li>
          <li>• WCAG 2.1 AA accessibility compliant</li>
          <li>• Mobile-first responsive design with swipe gestures</li>
          <li>• Real-time updates via WebSocket integration</li>
          <li>• Export functionality with multiple formats</li>
          <li>• Advanced filtering with multiple types</li>
          <li>• Search history and autocomplete suggestions</li>
          <li>• High contrast and reduced motion support</li>
        </ul>
      </div>
    </div>
  );
};

export default SearchInterfaceExample;