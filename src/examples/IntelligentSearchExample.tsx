/**
 * IntelligentSearchExample Component
 *
 * Complete example demonstrating the intelligent search system with:
 * - IntelligentSearchInput with real-time autocomplete
 * - Virtual scrolling for large result sets
 * - Performance monitoring
 * - Accessibility features
 * - Dark/light theme support
 *
 * @author Frontend Team
 * @version 1.0.0
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Search, Filter, BarChart3, Settings, Moon, Sun } from 'lucide-react';
import { IntelligentSearchInput } from '../components/search/IntelligentSearchInput';
import { VirtualScrolling } from '../components/performance/VirtualScrolling';
import { AutocompleteSuggestion, SuggestionSource } from '../hooks/useAutocomplete';
import { SearchHistoryItem } from '../hooks/useSearchHistory';
import { SearchFilter } from '../components/search/IntelligentSearchInput';
import { useLiveRegion } from '../utils/accessibility';
import { performanceTimer } from '../utils/performance';

// ========================
// Types
// ========================

interface KnowledgeEntry {
  id: string;
  title: string;
  category: string;
  description: string;
  tags: string[];
  score?: number;
  usage: number;
  created: Date;
}

interface SearchResult {
  entry: KnowledgeEntry;
  score: number;
  matchType: 'exact' | 'fuzzy' | 'ai';
  highlights: string[];
}

// ========================
// Mock Data
// ========================

const mockEntries: KnowledgeEntry[] = [
  {
    id: '1',
    title: 'VSAM Status 35 - File Not Found',
    category: 'VSAM',
    description: 'Job abends with VSAM status code 35. The program cannot open the VSAM file.',
    tags: ['vsam', 'status-35', 'file-not-found', 'catalog'],
    usage: 45,
    created: new Date('2024-01-15')
  },
  {
    id: '2',
    title: 'S0C7 - Data Exception in COBOL',
    category: 'Batch',
    description: 'Program abends with S0C7 data exception during arithmetic operations.',
    tags: ['s0c7', 'data-exception', 'numeric', 'cobol'],
    usage: 89,
    created: new Date('2024-01-20')
  },
  {
    id: '3',
    title: 'JCL Error - Dataset Not Found (IEF212I)',
    category: 'JCL',
    description: 'JCL fails with IEF212I dataset not found error',
    tags: ['jcl', 'dataset', 'not-found', 'ief212i'],
    usage: 67,
    created: new Date('2024-01-25')
  },
  {
    id: '4',
    title: 'DB2 SQLCODE -904 - Resource Unavailable',
    category: 'DB2',
    description: 'Program receives SQLCODE -904 indicating resource unavailable',
    tags: ['db2', 'sqlcode', '-904', 'resource'],
    usage: 34,
    created: new Date('2024-01-30')
  },
  {
    id: '5',
    title: 'IMS U0778 - Database Not Available',
    category: 'IMS',
    description: 'IMS transaction abends with U0778 indicating database not available',
    tags: ['ims', 'u0778', 'database', 'unavailable'],
    usage: 23,
    created: new Date('2024-02-01')
  },
  // Add more entries for demonstration
  ...Array.from({ length: 45 }, (_, i) => ({
    id: `mock-${i + 6}`,
    title: `Sample Entry ${i + 6}`,
    category: ['VSAM', 'JCL', 'DB2', 'Batch', 'IMS'][i % 5],
    description: `This is a sample knowledge base entry for demonstration purposes. Entry ${i + 6}.`,
    tags: [`tag${i}`, `sample`, `demo`],
    usage: Math.floor(Math.random() * 100),
    created: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000)
  }))
];

// ========================
// Main Component
// ========================

export function IntelligentSearchExample() {
  // ========================
  // State
  // ========================

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<SearchFilter[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<KnowledgeEntry | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [performanceMetrics, setPerformanceMetrics] = useState<any>(null);

  // ========================
  // Hooks
  // ========================

  const { announce } = useLiveRegion();

  // ========================
  // Suggestion Sources
  // ========================

  const suggestionSources: SuggestionSource[] = useMemo(() => [
    {
      id: 'categories',
      name: 'Categories',
      getSuggestions: async (query) => {
        const categories = ['VSAM', 'JCL', 'DB2', 'Batch', 'IMS', 'CICS'];
        const filtered = categories.filter(cat =>
          cat.toLowerCase().includes(query.toLowerCase())
        );

        return filtered.map((category, index) => ({
          id: `category-${index}`,
          text: category,
          type: 'category' as const,
          description: `Search in ${category} category`,
          icon: 'tag',
          score: 0.8,
          metadata: { category }
        }));
      },
      priority: 8,
      enabled: true
    },
    {
      id: 'popular-searches',
      name: 'Popular Searches',
      getSuggestions: async (query) => {
        const popularTerms = [
          'VSAM Status 35',
          'S0C7 error',
          'JCL dataset not found',
          'DB2 SQLCODE -904',
          'COBOL abend',
          'File not cataloged'
        ];

        const filtered = popularTerms.filter(term =>
          term.toLowerCase().includes(query.toLowerCase())
        );

        return filtered.map((term, index) => ({
          id: `popular-${index}`,
          text: term,
          type: 'static' as const,
          description: 'Popular search term',
          icon: 'search',
          score: 0.9,
          metadata: { popular: true }
        }));
      },
      priority: 7,
      enabled: true
    },
    {
      id: 'ai-suggestions',
      name: 'AI Suggestions',
      getSuggestions: async (query) => {
        // Simulate AI-powered suggestions
        await new Promise(resolve => setTimeout(resolve, 200));

        if (query.toLowerCase().includes('error')) {
          return [
            {
              id: 'ai-1',
              text: `Common ${query} patterns`,
              type: 'ai' as const,
              description: 'AI-generated suggestion based on patterns',
              icon: 'brain',
              score: 0.85,
              metadata: { aiGenerated: true }
            }
          ];
        }

        return [];
      },
      priority: 6,
      enabled: true
    }
  ], []);

  // ========================
  // Search Functions
  // ========================

  const performSearch = useCallback(async (query: string, searchFilters: SearchFilter[] = []) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    performanceTimer.start('search');

    try {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 100));

      // Filter and score results
      let results = mockEntries.filter(entry => {
        const searchText = `${entry.title} ${entry.description} ${entry.tags.join(' ')}`.toLowerCase();
        const queryLower = query.toLowerCase();

        // Apply text filter
        const matchesText = searchText.includes(queryLower);

        // Apply category filters
        const categoryFilters = searchFilters.filter(f => f.type === 'category' && f.active);
        const matchesCategory = categoryFilters.length === 0 ||
          categoryFilters.some(f => entry.category === f.value);

        return matchesText && matchesCategory;
      });

      // Score and sort results
      const scoredResults: SearchResult[] = results.map(entry => {
        const searchText = `${entry.title} ${entry.description} ${entry.tags.join(' ')}`.toLowerCase();
        const queryLower = query.toLowerCase();

        let score = 0;
        let matchType: 'exact' | 'fuzzy' | 'ai' = 'fuzzy';

        // Exact title match
        if (entry.title.toLowerCase().includes(queryLower)) {
          score += 100;
          matchType = 'exact';
        }

        // Tag matches
        entry.tags.forEach(tag => {
          if (tag.toLowerCase().includes(queryLower)) {
            score += 50;
          }
        });

        // Description matches
        if (entry.description.toLowerCase().includes(queryLower)) {
          score += 25;
        }

        // Usage bonus
        score += Math.log(entry.usage + 1) * 5;

        // Recency bonus
        const daysSince = (Date.now() - entry.created.getTime()) / (1000 * 60 * 60 * 24);
        score += Math.max(0, 10 - daysSince);

        return {
          entry: { ...entry, score },
          score,
          matchType,
          highlights: [query]
        };
      });

      const sortedResults = scoredResults.sort((a, b) => b.score - a.score);

      setSearchResults(sortedResults);

      // Performance metrics
      const metrics = performanceTimer.end('search');
      setPerformanceMetrics({
        responseTime: Math.round(metrics?.duration || 0),
        resultsCount: sortedResults.length,
        cacheHit: Math.random() > 0.7,
        aiUsed: query.length > 5
      });

      // Announce results
      announce(
        `Found ${sortedResults.length} results for "${query}"`,
        'polite'
      );

    } catch (error) {
      console.error('Search error:', error);
      announce('Search failed. Please try again.', 'assertive');
    } finally {
      setLoading(false);
    }
  }, [announce]);

  // ========================
  // Event Handlers
  // ========================

  const handleSearch = useCallback((query: string, searchFilters: SearchFilter[]) => {
    setSearchQuery(query);
    performSearch(query, searchFilters);
  }, [performSearch]);

  const handleSuggestionSelect = useCallback((suggestion: AutocompleteSuggestion) => {
    console.log('Suggestion selected:', suggestion);
    performSearch(suggestion.text, filters);
  }, [performSearch, filters]);

  const handleHistorySelect = useCallback((item: SearchHistoryItem) => {
    console.log('History item selected:', item);
    performSearch(item.query, filters);
  }, [performSearch, filters]);

  const handleFilterChange = useCallback((newFilters: SearchFilter[]) => {
    setFilters(newFilters);
    if (searchQuery) {
      performSearch(searchQuery, newFilters);
    }
  }, [searchQuery, performSearch]);

  const handleEntrySelect = useCallback((entry: KnowledgeEntry) => {
    setSelectedEntry(entry);
    announce(`Selected: ${entry.title}`, 'polite');
  }, [announce]);

  const toggleDarkMode = useCallback(() => {
    setDarkMode(prev => !prev);
    document.documentElement.classList.toggle('dark');
  }, []);

  const toggleFilters = useCallback(() => {
    setShowFilters(prev => !prev);
  }, []);

  // ========================
  // Available Filters
  // ========================

  const availableFilters: SearchFilter[] = useMemo(() => {
    const categories = Array.from(new Set(mockEntries.map(entry => entry.category)));

    return categories.map(category => ({
      id: category,
      type: 'category' as const,
      label: category,
      value: category,
      active: false,
      count: mockEntries.filter(entry => entry.category === category).length
    }));
  }, []);

  // ========================
  // Virtual Scrolling Render
  // ========================

  const renderSearchResult = useCallback(({ item, index, style }: {
    item: SearchResult;
    index: number;
    style: React.CSSProperties;
  }) => (
    <div
      style={style}
      className={`p-4 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors ${
        selectedEntry?.id === item.entry.id ? 'bg-primary-50 dark:bg-primary-900/20' : ''
      }`}
      onClick={() => handleEntrySelect(item.entry)}
      role="option"
      aria-selected={selectedEntry?.id === item.entry.id}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleEntrySelect(item.entry);
        }
      }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
            {item.entry.title}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
            {item.entry.description}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-200">
              {item.entry.category}
            </span>
            {item.entry.tags.slice(0, 3).map(tag => (
              <span
                key={tag}
                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
        <div className="flex-shrink-0 ml-4 text-sm text-gray-500 dark:text-gray-400">
          <div className="text-right">
            <div className="font-medium">Score: {Math.round(item.score)}</div>
            <div className="text-xs">{item.matchType}</div>
            <div className="text-xs">{item.entry.usage} uses</div>
          </div>
        </div>
      </div>
    </div>
  ), [selectedEntry, handleEntrySelect]);

  // ========================
  // Effects
  // ========================

  useEffect(() => {
    // Initialize dark mode based on system preference
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  // ========================
  // Render
  // ========================

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Search className="w-8 h-8 text-primary-600 dark:text-primary-400" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Intelligent Search System
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleFilters}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              aria-label="Toggle filters"
            >
              <Filter size={16} />
              Filters
            </button>

            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {darkMode ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div className="mb-6">
          <IntelligentSearchInput
            placeholder="Search mainframe knowledge base..."
            suggestionSources={suggestionSources}
            enableAutocomplete={true}
            enableHistory={true}
            enablePerformanceIndicators={true}
            enableKeyboardShortcuts={true}
            showShortcutHints={true}
            variant="prominent"
            size="lg"
            filters={filters}
            performanceMetrics={performanceMetrics}
            loading={loading}
            onSearch={handleSearch}
            onFilterChange={handleFilterChange}
            onSuggestionSelect={handleSuggestionSelect}
            onHistorySelect={handleHistorySelect}
            className="w-full"
          />
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Filters Panel */}
          {showFilters && (
            <div className="lg:col-span-1">
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
                  Filters
                </h3>

                <div className="space-y-3">
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Categories
                    </h4>
                    {availableFilters.map(filter => (
                      <label
                        key={filter.id}
                        className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400"
                      >
                        <input
                          type="checkbox"
                          checked={filters.some(f => f.id === filter.id && f.active)}
                          onChange={(e) => {
                            const newFilters = [...filters];
                            const existingIndex = newFilters.findIndex(f => f.id === filter.id);

                            if (existingIndex >= 0) {
                              newFilters[existingIndex].active = e.target.checked;
                            } else {
                              newFilters.push({ ...filter, active: e.target.checked });
                            }

                            handleFilterChange(newFilters);
                          }}
                          className="rounded border-gray-300 dark:border-gray-600"
                        />
                        <span>{filter.label}</span>
                        <span className="text-xs text-gray-400">({filter.count})</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Results Panel */}
          <div className={showFilters ? 'lg:col-span-2' : 'lg:col-span-3'}>
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              {/* Results Header */}
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                    Search Results
                  </h3>
                  {searchResults.length > 0 && (
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {searchResults.length} results
                      {performanceMetrics && (
                        <> • {performanceMetrics.responseTime}ms</>
                      )}
                    </span>
                  )}
                </div>
              </div>

              {/* Virtual Scrolling Results */}
              <div className="h-96">
                {searchResults.length > 0 ? (
                  <VirtualScrolling
                    items={searchResults}
                    itemHeight={120}
                    height={384}
                    renderItem={renderSearchResult}
                    loading={loading}
                    renderLoading={() => (
                      <div className="flex items-center justify-center h-full">
                        <div className="text-gray-500 dark:text-gray-400">
                          Searching...
                        </div>
                      </div>
                    )}
                    renderEmpty={() => (
                      <div className="flex items-center justify-center h-full">
                        <div className="text-gray-500 dark:text-gray-400">
                          {searchQuery ? 'No results found' : 'Enter a search query to begin'}
                        </div>
                      </div>
                    )}
                    ariaLabel="Search results"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-gray-500 dark:text-gray-400">
                      {loading ? 'Searching...' : 'Enter a search query to begin'}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Details Panel */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              {selectedEntry ? (
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
                    Details
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Title
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {selectedEntry.title}
                      </p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Category
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {selectedEntry.category}
                      </p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Usage
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {selectedEntry.usage} times
                      </p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Created
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {selectedEntry.created.toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Tags
                      </h4>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {selectedEntry.tags.map(tag => (
                          <span
                            key={tag}
                            className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center text-gray-500 dark:text-gray-400">
                  Select a result to view details
                </div>
              )}
            </div>

            {/* Performance Stats */}
            {performanceMetrics && (
              <div className="mt-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                  <BarChart3 size={16} />
                  Performance
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Response Time:</span>
                    <span className="font-medium">{performanceMetrics.responseTime}ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Results:</span>
                    <span className="font-medium">{performanceMetrics.resultsCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Cache Hit:</span>
                    <span className={`font-medium ${performanceMetrics.cacheHit ? 'text-green-600' : 'text-gray-500'}`}>
                      {performanceMetrics.cacheHit ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">AI Used:</span>
                    <span className={`font-medium ${performanceMetrics.aiUsed ? 'text-blue-600' : 'text-gray-500'}`}>
                      {performanceMetrics.aiUsed ? 'Yes' : 'No'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}