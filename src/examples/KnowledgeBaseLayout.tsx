/**
 * KnowledgeBaseLayout Example
 *
 * Complete Knowledge Base interface layout demonstrating:
 * - Responsive search and results panels
 * - Progressive enhancement across breakpoints
 * - Performance-optimized rendering
 * - Accessibility best practices
 * - TypeScript integration patterns
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { AppLayout } from '../components/Layout/AppLayout';
import { ResponsiveGrid, GridItem } from '../components/Layout/ResponsiveGrid';
import { useResponsive } from '../hooks/useResponsive';
import { useResizeObserver } from '../hooks/useResizeObserver';
import { Button } from '../components/foundation/Button';

// =========================
// TYPE DEFINITIONS
// =========================

interface KBEntry {
  id: string;
  title: string;
  problem: string;
  solution: string;
  category: 'JCL' | 'VSAM' | 'DB2' | 'Batch' | 'Functional' | 'Other';
  tags: string[];
  usage_count: number;
  success_rate: number;
  created_at: string;
}

interface SearchFilters {
  category?: string;
  tags?: string[];
  sortBy: 'relevance' | 'usage' | 'recent' | 'success_rate';
  timeRange?: '24h' | '7d' | '30d' | 'all';
}

interface KnowledgeBaseLayoutProps {
  entries: KBEntry[];
  onSearch: (query: string, filters: SearchFilters) => void;
  onEntrySelect: (entry: KBEntry) => void;
  onRateEntry: (entryId: string, helpful: boolean) => void;
  isLoading?: boolean;
  selectedEntry?: KBEntry;
}

// =========================
// MOCK DATA FOR EXAMPLE
// =========================

const MOCK_ENTRIES: KBEntry[] = [
  {
    id: '1',
    title: 'VSAM Status 35 - File Not Found',
    problem: 'Job abends with VSAM status code 35. The program cannot open the VSAM file.',
    solution: '1. Verify the dataset exists using ISPF 3.4 or LISTCAT command\n2. Check the DD statement in JCL has correct DSN\n3. Ensure file is cataloged properly',
    category: 'VSAM',
    tags: ['vsam', 'status-35', 'file-not-found', 'catalog'],
    usage_count: 156,
    success_rate: 0.94,
    created_at: '2025-01-10T08:30:00Z'
  },
  {
    id: '2',
    title: 'S0C7 - Data Exception in COBOL',
    problem: 'Program abends with S0C7 data exception during arithmetic operations.',
    solution: '1. Check for non-numeric data in numeric fields\n2. Use NUMERIC test before arithmetic\n3. Initialize all COMP-3 fields properly',
    category: 'Batch',
    tags: ['s0c7', 'data-exception', 'numeric', 'abend', 'cobol'],
    usage_count: 89,
    success_rate: 0.87,
    created_at: '2025-01-08T14:15:00Z'
  },
  {
    id: '3',
    title: 'JCL Error - Dataset Not Found',
    problem: 'JCL fails with IEF212I dataset not found error',
    solution: '1. Verify dataset name spelling\n2. Check if dataset exists using TSO LISTD\n3. For GDG: Verify generation exists',
    category: 'JCL',
    tags: ['jcl', 'dataset', 'not-found', 'ief212i'],
    usage_count: 203,
    success_rate: 0.91,
    created_at: '2025-01-05T09:45:00Z'
  }
];

// =========================
// SUB-COMPONENTS
// =========================

/**
 * Search Header Component
 * Adaptive search interface with responsive behavior
 */
const SearchHeader: React.FC<{
  onSearch: (query: string, filters: SearchFilters) => void;
  isLoading: boolean;
}> = ({ onSearch, isLoading }) => {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>({
    sortBy: 'relevance'
  });

  const { device } = useResponsive();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    onSearch(query, filters);
  }, [query, filters, onSearch]);

  const handleQuickSearch = useCallback((category: string) => {
    setFilters(prev => ({ ...prev, category }));
    onSearch(query, { ...filters, category });
  }, [query, filters, onSearch]);

  return (
    <div className="kb-search-area">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Main Search Input */}
          <div className="relative">
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search knowledge base... (e.g., VSAM status 35, S0C7 abend)"
              className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
              disabled={isLoading}
              data-testid="kb-search-input"
              aria-label="Search knowledge base"
              autoComplete="off"
            />
            <button
              type="submit"
              disabled={isLoading}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none focus:text-blue-500"
              aria-label="Search"
            >
              {isLoading ? (
                <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              )}
            </button>
          </div>

          {/* Quick Category Filters */}
          <ResponsiveGrid
            cols={{ xs: 2, sm: 3, lg: 6 }}
            gap="sm"
            className="mt-4"
          >
            {['JCL', 'VSAM', 'DB2', 'Batch', 'Functional', 'Other'].map((category) => (
              <GridItem key={category}>
                <Button
                  variant={filters.category === category ? 'primary' : 'secondary'}
                  size={device.isMobile ? 'sm' : 'md'}
                  onClick={() => handleQuickSearch(category)}
                  className="w-full"
                  disabled={isLoading}
                >
                  {category}
                </Button>
              </GridItem>
            ))}
          </ResponsiveGrid>

          {/* Advanced Filters - Collapsible on mobile */}
          {!device.isMobile && (
            <ResponsiveGrid
              cols={{ sm: 2, lg: 4 }}
              gap="sm"
              className="mt-4 pt-4 border-t border-gray-200"
            >
              <GridItem>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sort By
                </label>
                <select
                  value={filters.sortBy}
                  onChange={(e) => setFilters(prev => ({
                    ...prev,
                    sortBy: e.target.value as SearchFilters['sortBy']
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  <option value="relevance">Relevance</option>
                  <option value="usage">Most Used</option>
                  <option value="recent">Most Recent</option>
                  <option value="success_rate">Success Rate</option>
                </select>
              </GridItem>

              <GridItem>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Time Range
                </label>
                <select
                  value={filters.timeRange || 'all'}
                  onChange={(e) => setFilters(prev => ({
                    ...prev,
                    timeRange: e.target.value as SearchFilters['timeRange']
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  <option value="all">All Time</option>
                  <option value="24h">Last 24 Hours</option>
                  <option value="7d">Last 7 Days</option>
                  <option value="30d">Last 30 Days</option>
                </select>
              </GridItem>

              <GridItem colSpan={2}>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setFilters({ sortBy: 'relevance' })}
                  className="mt-5"
                >
                  Clear Filters
                </Button>
              </GridItem>
            </ResponsiveGrid>
          )}
        </form>
      </div>
    </div>
  );
};

/**
 * Results List Component
 * Responsive results display with virtual scrolling support
 */
const ResultsList: React.FC<{
  entries: KBEntry[];
  onSelect: (entry: KBEntry) => void;
  selectedId?: string;
  isLoading: boolean;
}> = ({ entries, onSelect, selectedId, isLoading }) => {
  const { device } = useResponsive();
  const listRef = useRef<HTMLDivElement>(null);

  // Auto-resize observer for container height optimization
  const dimensions = useResizeObserver(listRef);

  const formatSuccessRate = useCallback((rate: number) => {
    return `${Math.round(rate * 100)}%`;
  }, []);

  const formatUsageCount = useCallback((count: number) => {
    if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
    return count.toString();
  }, []);

  if (isLoading) {
    return (
      <div className="kb-results-area">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="animate-pulse space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="border-b border-gray-200 pb-4 last:border-b-0">
                <div className="h-4 bg-gray-300 rounded mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="flex space-x-4">
                  <div className="h-3 bg-gray-200 rounded w-16"></div>
                  <div className="h-3 bg-gray-200 rounded w-20"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={listRef} className="kb-results-area">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-900">
              {entries.length} Results
            </h3>
            <div className="text-xs text-gray-500">
              Height: {dimensions?.height || 0}px
            </div>
          </div>
        </div>

        <div
          className="max-h-96 overflow-y-auto"
          role="listbox"
          aria-label="Knowledge base search results"
        >
          {entries.length === 0 ? (
            <div className="p-8 text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.034 0-3.9.785-5.291 2.083A8.002 8.002 0 0112 21a8.002 8.002 0 015.291-2.083A7.962 7.962 0 0112 15z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No results found</h3>
              <p className="mt-1 text-sm text-gray-500">Try adjusting your search terms or filters</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {entries.map((entry) => (
                <button
                  key={entry.id}
                  onClick={() => onSelect(entry)}
                  className={`w-full px-4 py-4 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 transition-colors duration-150 ${
                    selectedId === entry.id ? 'bg-blue-50 border-r-2 border-blue-500' : ''
                  }`}
                  role="option"
                  aria-selected={selectedId === entry.id}
                  data-testid={`kb-result-${entry.id}`}
                >
                  <ResponsiveGrid
                    cols={{ xs: 1, sm: 1 }}
                    gap="xs"
                    className="w-full"
                  >
                    <GridItem>
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="text-sm font-medium text-gray-900 line-clamp-2 flex-1">
                          {entry.title}
                        </h4>
                        <span className={`ml-2 px-2 py-1 text-xs rounded-full flex-shrink-0 ${
                          {
                            'JCL': 'bg-blue-100 text-blue-800',
                            'VSAM': 'bg-green-100 text-green-800',
                            'DB2': 'bg-purple-100 text-purple-800',
                            'Batch': 'bg-orange-100 text-orange-800',
                            'Functional': 'bg-pink-100 text-pink-800',
                            'Other': 'bg-gray-100 text-gray-800'
                          }[entry.category]
                        }`}>
                          {entry.category}
                        </span>
                      </div>

                      <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                        {entry.problem}
                      </p>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                          <span className="flex items-center">
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            {formatUsageCount(entry.usage_count)} views
                          </span>
                          <span className="flex items-center">
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                            </svg>
                            {formatSuccessRate(entry.success_rate)} helpful
                          </span>
                        </div>

                        {!device.isMobile && (
                          <div className="flex flex-wrap gap-1">
                            {entry.tags.slice(0, 2).map((tag) => (
                              <span
                                key={tag}
                                className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-md"
                              >
                                {tag}
                              </span>
                            ))}
                            {entry.tags.length > 2 && (
                              <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-md">
                                +{entry.tags.length - 2}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </GridItem>
                  </ResponsiveGrid>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Entry Detail Component
 * Comprehensive entry display with actions and feedback
 */
const EntryDetail: React.FC<{
  entry: KBEntry | undefined;
  onRate: (entryId: string, helpful: boolean) => void;
}> = ({ entry, onRate }) => {
  const [feedback, setFeedback] = useState<'helpful' | 'not-helpful' | null>(null);
  const { device } = useResponsive();

  const handleRate = useCallback((helpful: boolean) => {
    if (!entry) return;
    onRate(entry.id, helpful);
    setFeedback(helpful ? 'helpful' : 'not-helpful');

    // Reset feedback after 3 seconds
    setTimeout(() => setFeedback(null), 3000);
  }, [entry, onRate]);

  const formatDate = useCallback((dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }, []);

  if (!entry) {
    return (
      <div className="kb-detail-area">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.034 0-3.9.785-5.291 2.083A8.002 8.002 0 0112 21a8.002 8.002 0 015.291-2.083A7.962 7.962 0 0112 15z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Entry Selected</h3>
          <p className="text-gray-500">Select an entry from the results to view details and solutions</p>
        </div>
      </div>
    );
  }

  return (
    <div className="kb-detail-area">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-start justify-between mb-2">
            <h2 className="text-lg font-semibold text-gray-900 flex-1 pr-4">
              {entry.title}
            </h2>
            <span className={`px-3 py-1 text-sm rounded-full flex-shrink-0 ${
              {
                'JCL': 'bg-blue-100 text-blue-800',
                'VSAM': 'bg-green-100 text-green-800',
                'DB2': 'bg-purple-100 text-purple-800',
                'Batch': 'bg-orange-100 text-orange-800',
                'Functional': 'bg-pink-100 text-pink-800',
                'Other': 'bg-gray-100 text-gray-800'
              }[entry.category]
            }`}>
              {entry.category}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
            <span className="flex items-center">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              {entry.usage_count} views
            </span>
            <span className="flex items-center">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              {Math.round(entry.success_rate * 100)}% helpful
            </span>
            <span className="flex items-center">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {formatDate(entry.created_at)}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-6">
          {/* Problem Description */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
              <svg className="w-5 h-5 mr-2 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              Problem Description
            </h3>
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                {entry.problem}
              </p>
            </div>
          </div>

          {/* Solution */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
              <svg className="w-5 h-5 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Solution Steps
            </h3>
            <div className="bg-green-50 border border-green-200 rounded-md p-4">
              <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed space-y-2">
                {entry.solution.split('\n').map((step, index) => (
                  <div key={index} className="flex items-start">
                    {step.match(/^\d+\./) ? (
                      <>
                        <span className="bg-green-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center mr-3 mt-0.5 flex-shrink-0">
                          {step.match(/^(\d+)\./)?.[1]}
                        </span>
                        <span className="flex-1">{step.replace(/^\d+\.\s*/, '')}</span>
                      </>
                    ) : (
                      <span className="flex-1 ml-8">{step}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Tags */}
          {entry.tags.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-3">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {entry.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded-full"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Was this solution helpful?
            </div>
            <div className="flex items-center space-x-2">
              {feedback && (
                <span className={`text-sm font-medium mr-3 ${
                  feedback === 'helpful' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {feedback === 'helpful' ? 'Thank you!' : 'Thanks for feedback!'}
                </span>
              )}
              <Button
                variant={feedback === 'helpful' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => handleRate(true)}
                className="flex items-center"
                data-testid="rate-helpful"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                </svg>
                Helpful
              </Button>
              <Button
                variant={feedback === 'not-helpful' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => handleRate(false)}
                className="flex items-center"
                data-testid="rate-not-helpful"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.737 3h4.018c.163 0 .326.02.485.06L17 4m-7 10v2a2 2 0 002 2h.095c.5 0 .905-.405.905-.905 0-.714.211-1.412.608-2.006L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
                </svg>
                Not Helpful
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// =========================
// MAIN COMPONENT
// =========================

/**
 * Complete Knowledge Base Layout Example
 *
 * Demonstrates progressive enhancement:
 * - Mobile: Stacked layout with collapsible panels
 * - Tablet: Side-by-side search and results, detail below
 * - Desktop: Three-column layout with search header
 */
export const KnowledgeBaseLayout: React.FC<KnowledgeBaseLayoutProps> = ({
  entries = MOCK_ENTRIES,
  onSearch,
  onEntrySelect,
  onRateEntry,
  isLoading = false,
  selectedEntry
}) => {
  const [searchResults, setSearchResults] = useState<KBEntry[]>(entries);
  const [currentEntry, setCurrentEntry] = useState<KBEntry | undefined>(selectedEntry);
  const { device, breakpoint } = useResponsive();

  // Search handler with mock implementation
  const handleSearch = useCallback((query: string, filters: SearchFilters) => {
    console.log('Search:', query, filters);

    // Mock search implementation
    let filtered = entries;

    if (query.trim()) {
      filtered = entries.filter(entry =>
        entry.title.toLowerCase().includes(query.toLowerCase()) ||
        entry.problem.toLowerCase().includes(query.toLowerCase()) ||
        entry.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()))
      );
    }

    if (filters.category) {
      filtered = filtered.filter(entry => entry.category === filters.category);
    }

    // Apply sorting
    switch (filters.sortBy) {
      case 'usage':
        filtered.sort((a, b) => b.usage_count - a.usage_count);
        break;
      case 'recent':
        filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case 'success_rate':
        filtered.sort((a, b) => b.success_rate - a.success_rate);
        break;
      default:
        // Keep relevance order
        break;
    }

    setSearchResults(filtered);
    onSearch?.(query, filters);
  }, [entries, onSearch]);

  // Entry selection handler
  const handleEntrySelect = useCallback((entry: KBEntry) => {
    setCurrentEntry(entry);
    onEntrySelect?.(entry);
  }, [onEntrySelect]);

  // Rating handler
  const handleRate = useCallback((entryId: string, helpful: boolean) => {
    console.log('Rate entry:', entryId, helpful);
    onRateEntry?.(entryId, helpful);
  }, [onRateEntry]);

  // Initialize search results
  useEffect(() => {
    setSearchResults(entries);
  }, [entries]);

  // Header content
  const headerContent = (
    <div className="flex items-center justify-between w-full">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">
          🧠 Mainframe Knowledge Assistant
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          {device.isMobile ? 'Mobile View' : device.isTablet ? 'Tablet View' : 'Desktop View'} •
          {breakpoint.toUpperCase()} • {searchResults.length} entries
        </p>
      </div>

      {!device.isMobile && (
        <div className="flex items-center space-x-4">
          <Button variant="secondary" size="sm">
            + Add Entry
          </Button>
          <Button variant="primary" size="sm">
            📊 Metrics
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <AppLayout
      header={headerContent}
      variant="full-width"
      maxWidth="2xl"
      padding="none"
      className="bg-gray-50"
      data-testid="knowledge-base-layout"
    >
      {/* Main Content Grid */}
      <div className="kb-main-layout h-full">
        {/* Search Area */}
        <SearchHeader
          onSearch={handleSearch}
          isLoading={isLoading}
        />

        {/* Results Panel */}
        <ResultsList
          entries={searchResults}
          onSelect={handleEntrySelect}
          selectedId={currentEntry?.id}
          isLoading={isLoading}
        />

        {/* Detail Panel */}
        <EntryDetail
          entry={currentEntry}
          onRate={handleRate}
        />
      </div>
    </AppLayout>
  );
};

export default KnowledgeBaseLayout;