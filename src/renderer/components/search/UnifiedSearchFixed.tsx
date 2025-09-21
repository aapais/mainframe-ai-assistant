/**
 * Unified Search Component - Simplified Search Experience with Working Filters
 * Fixed implementation with complete filter functionality
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Search, Sparkles, Filter, Clock, TrendingUp, X, Calendar, Tag, AlertCircle } from 'lucide-react';
import { useNotificationSystem } from '../common/NotificationSystem';

interface SearchFilters {
  categories: string[];
  dateRange: {
    start: Date | null;
    end: Date | null;
  };
  status: string[];
  priority: string[];
  tags: string[];
}

interface SearchSuggestion {
  id: string;
  text: string;
  type: 'recent' | 'popular' | 'suggested';
  category?: string;
  count?: number;
}

interface UnifiedSearchProps {
  onSearch: (query: string, useAI: boolean, filters?: SearchFilters) => void;
  loading?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  onFiltersChange?: (filters: SearchFilters) => void;
}

const POPULAR_SEARCHES = [
  { id: '1', text: 'S0C4 ABEND', type: 'popular', category: 'COBOL', count: 45 },
  { id: '2', text: 'DB2 SQLCODE -818', type: 'popular', category: 'DB2', count: 32 },
  { id: '3', text: 'VSAM File Status 93', type: 'popular', category: 'VSAM', count: 28 },
  { id: '4', text: 'JCL NOT FOUND', type: 'popular', category: 'JCL', count: 24 },
  { id: '5', text: 'CICS ABEND', type: 'popular', category: 'CICS', count: 19 }
] as const;

const SMART_SUGGESTIONS = [
  'S0C7 data exception',
  'Memory protection violation',
  'File not found error',
  'Compilation error',
  'Job execution failed'
];

export const UnifiedSearchFixed: React.FC<UnifiedSearchProps> = ({
  onSearch,
  loading = false,
  placeholder = "Describe your issue or search for solutions...",
  autoFocus = false,
  className = '',
  onFiltersChange
}) => {
  const [query, setQuery] = useState('');
  const [useAI, setUseAI] = useState(true);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);

  // Filter states
  const [activeFilters, setActiveFilters] = useState<SearchFilters>({
    categories: [],
    dateRange: { start: null, end: null },
    status: [],
    priority: [],
    tags: []
  });
  const [tempFilters, setTempFilters] = useState<SearchFilters>(activeFilters);

  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout>();
  const { info } = useNotificationSystem();

  // Filter options
  const categories = ['COBOL', 'DB2', 'VSAM', 'JCL', 'CICS', 'IMS', 'TSO', 'ISPF'];
  const statusOptions = ['Open', 'In Progress', 'Resolved', 'Closed', 'Pending'];
  const priorityOptions = ['Critical', 'High', 'Medium', 'Low'];
  const commonTags = ['performance', 'security', 'connectivity', 'data', 'syntax', 'configuration'];

  // Load saved filters from localStorage on component mount
  useEffect(() => {
    const savedFilters = localStorage.getItem('searchFilters');
    if (savedFilters) {
      try {
        const parsed = JSON.parse(savedFilters);
        // Convert date strings back to Date objects
        if (parsed.dateRange) {
          parsed.dateRange.start = parsed.dateRange.start ? new Date(parsed.dateRange.start) : null;
          parsed.dateRange.end = parsed.dateRange.end ? new Date(parsed.dateRange.end) : null;
        }
        setActiveFilters(parsed);
        setTempFilters(parsed);
      } catch (e) {
        console.warn('Failed to load saved filters:', e);
      }
    }
  }, []);

  // Save filters to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('searchFilters', JSON.stringify(activeFilters));
    if (onFiltersChange) {
      onFiltersChange(activeFilters);
    }
  }, [activeFilters, onFiltersChange]);

  // Smart debouncing
  useEffect(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(() => {
      setDebouncedQuery(query);
    }, 150);

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [query]);

  // Load suggestions when input gets focus or when query changes
  useEffect(() => {
    if (debouncedQuery.length >= 2) {
      const filtered = SMART_SUGGESTIONS
        .filter(suggestion =>
          suggestion.toLowerCase().includes(debouncedQuery.toLowerCase())
        )
        .map((text, index) => ({
          id: `suggested-${index}`,
          text,
          type: 'suggested' as const
        }));

      const recent = JSON.parse(localStorage.getItem('recentSearches') || '[]')
        .slice(0, 3)
        .map((text: string, index: number) => ({
          id: `recent-${index}`,
          text,
          type: 'recent' as const
        }));

      setSuggestions([...filtered, ...recent, ...POPULAR_SEARCHES.slice(0, 3)]);
    } else if (showSuggestions) {
      setSuggestions([...POPULAR_SEARCHES.slice(0, 5)]);
    }
    setSelectedSuggestionIndex(-1);
  }, [debouncedQuery, showSuggestions]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    // Only show suggestions when there's content
    setShowSuggestions(value.length > 0);

    // If the field was cleared, reset search results without AI
    if (!value.trim() && onSearch) {
      onSearch('', false); // Use local search to reset without AI dialog
    }
  };

  const handleSearch = useCallback((searchQuery?: string) => {
    const finalQuery = searchQuery || query;

    // Save to recent searches
    const recent = JSON.parse(localStorage.getItem('recentSearches') || '[]');
    const updated = [finalQuery, ...recent.filter((s: string) => s !== finalQuery)].slice(0, 10);
    localStorage.setItem('recentSearches', JSON.stringify(updated));

    // Perform search with active filters
    onSearch(finalQuery, useAI, activeFilters);
    setShowSuggestions(false);

    // Show feedback about search mode
    if (useAI) {
      info('AI-enhanced search initiated', { duration: 2000 });
    }
  }, [query, useAI, activeFilters, onSearch, info]);

  const handleSuggestionClick = (suggestion: SearchSuggestion) => {
    setQuery(suggestion.text);
    handleSearch(suggestion.text);
  };

  const handleAIToggle = () => {
    setUseAI(!useAI);
    info(`Switched to ${!useAI ? 'AI-enhanced' : 'local'} search`, { duration: 2000 });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedSuggestionIndex >= 0 && selectedSuggestionIndex < suggestions.length) {
        handleSuggestionClick(suggestions[selectedSuggestionIndex]);
      } else {
        handleSearch();
      }
    } else if (e.key === 'Escape') {
      if (query) {
        setQuery('');
        setShowSuggestions(false);
      } else {
        setShowSuggestions(false);
        inputRef.current?.blur();
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedSuggestionIndex(prev =>
        prev < suggestions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedSuggestionIndex(prev =>
        prev > 0 ? prev - 1 : suggestions.length - 1
      );
    } else if (e.key === 'Tab' && suggestions.length > 0) {
      e.preventDefault();
      if (selectedSuggestionIndex >= 0) {
        setQuery(suggestions[selectedSuggestionIndex].text);
      } else if (suggestions.length > 0) {
        setQuery(suggestions[0].text);
      }
    }
  };

  // Global keyboard shortcut for search (Ctrl+K or /)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      } else if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const getSuggestionIcon = (type: string) => {
    switch (type) {
      case 'recent':
        return <Clock className="w-4 h-4 text-gray-400" />;
      case 'popular':
        return <TrendingUp className="w-4 h-4 text-blue-500" />;
      default:
        return <Search className="w-4 h-4 text-gray-400" />;
    }
  };

  const getActiveFiltersCount = useCallback(() => {
    const { categories, status, priority, tags, dateRange } = activeFilters;
    return (
      categories.length +
      status.length +
      priority.length +
      tags.length +
      (dateRange.start || dateRange.end ? 1 : 0)
    );
  }, [activeFilters]);

  const applyFilters = () => {
    setActiveFilters(tempFilters);
    setShowFilters(false);
    // Trigger search with new filters
    if (query.trim()) {
      onSearch(query, useAI, tempFilters);
    }
  };

  const clearAllFilters = () => {
    const emptyFilters = {
      categories: [],
      dateRange: { start: null, end: null },
      status: [],
      priority: [],
      tags: []
    };
    setTempFilters(emptyFilters);
  };

  return (
    <div className={`unified-search ${className}`} id="main-unified-search">
      {/* Main Search Interface */}
      <div className="relative">
        <div className="search-container bg-white rounded-2xl shadow-xl shadow-purple-500/10 border border-gray-200/80 focus-within:border-purple-500 focus-within:ring-4 focus-within:ring-purple-500/20 focus-within:shadow-2xl focus-within:shadow-purple-500/20 transition-all duration-300 backdrop-blur-sm">
          <div className="flex items-center p-5">
            {/* Search Icon with Enhanced Animation */}
            <div className="relative mr-4">
              <Search className={`w-5 h-5 transition-all duration-300 ${
                showSuggestions ? 'text-purple-600 scale-110' : 'text-gray-400'
              }`} />
              {showSuggestions && (
                <div className="absolute inset-0 w-5 h-5 bg-purple-500/20 rounded-full animate-pulse"></div>
              )}
            </div>

            {/* Enhanced Search Input */}
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onFocus={() => setShowSuggestions(true)}
              placeholder={placeholder}
              aria-label="Search mainframe knowledge base"
              aria-autocomplete="list"
              aria-controls="search-suggestions"
              aria-expanded={showSuggestions}
              autoFocus={autoFocus}
              disabled={loading}
              className="flex-1 text-gray-900 placeholder-gray-400 border-none outline-none text-lg font-medium tracking-wide selection:bg-purple-200 selection:text-purple-900"
            />

            {/* Enhanced Clear Button */}
            {query && (
              <button
                id="unified-search-clear-btn"
                onClick={() => {
                  setQuery('');
                  if (onSearch) {
                    onSearch('', false);
                  }
                  inputRef.current?.focus();
                }}
                className="mr-3 p-2 rounded-xl hover:bg-gradient-to-r hover:from-red-50 hover:to-pink-50 hover:shadow-lg hover:shadow-red-200/40 transition-all duration-300 group transform hover:scale-110 active:scale-95"
                aria-label="Clear search"
                type="button"
              >
                <X className="w-4 h-4 text-gray-400 group-hover:text-red-500 transition-colors duration-300" />
              </button>
            )}

            {/* Enhanced Loading Indicator */}
            {loading && (
              <div className="mr-4">
                <div className="relative">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-r from-purple-500 to-blue-600 animate-spin">
                    <div className="absolute inset-1 bg-white rounded-full"></div>
                    <div className="absolute inset-2 bg-gradient-to-r from-purple-500 to-blue-600 rounded-full animate-pulse"></div>
                  </div>
                  <div className="absolute inset-0 w-6 h-6 rounded-full bg-purple-500/30 animate-ping"></div>
                </div>
              </div>
            )}

            {/* Enhanced AI Toggle Switch */}
            <div className="flex items-center mr-5">
              <button
                onClick={handleAIToggle}
                disabled={loading}
                className={`relative inline-flex h-9 w-16 items-center rounded-full transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-purple-500/30 focus:ring-offset-2 shadow-lg transform hover:scale-105 active:scale-95 ${
                  useAI
                    ? 'bg-gradient-to-r from-purple-600 to-blue-600 shadow-purple-500/40'
                    : 'bg-gradient-to-r from-gray-300 to-gray-400 hover:from-gray-400 hover:to-gray-500'
                }`}
                aria-label={`${useAI ? 'Disable' : 'Enable'} AI-enhanced search`}
              >
                <span
                  className={`inline-block h-7 w-7 transform rounded-full bg-white transition-all duration-300 shadow-lg ${
                    useAI ? 'translate-x-8 shadow-purple-300/50' : 'translate-x-1 shadow-gray-300/50'
                  }`}
                >
                  {useAI ? (
                    <Sparkles className="w-4 h-4 text-purple-600 m-1.5 animate-pulse" />
                  ) : (
                    <Search className="w-4 h-4 text-gray-500 m-1.5" />
                  )}
                </span>
                <div className={`absolute inset-0 rounded-full transition-opacity duration-300 ${
                  useAI ? 'bg-purple-500/20 opacity-100' : 'opacity-0'
                } animate-pulse`}></div>
              </button>
              <span className={`ml-3 text-sm font-semibold transition-colors duration-300 ${
                useAI ? 'text-purple-700' : 'text-gray-600'
              }`}>
                {useAI ? 'AI' : 'Local'}
              </span>
            </div>

            {/* Enhanced Filter Button with Active Indicator */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`mr-3 p-3 rounded-xl transition-all duration-300 transform hover:scale-110 active:scale-95 shadow-lg relative ${
                showFilters
                  ? 'bg-gradient-to-r from-purple-100 to-blue-100 text-purple-700 shadow-purple-200/50 border-2 border-purple-200'
                  : 'bg-gradient-to-r from-gray-100 to-gray-200 text-gray-600 hover:from-purple-50 hover:to-blue-50 hover:text-purple-600 hover:shadow-purple-200/40'
              }`}
              aria-label={`Search filters${getActiveFiltersCount() > 0 ? ` (${getActiveFiltersCount()} active)` : ''}`}
            >
              <Filter className="w-5 h-5" />
              {getActiveFiltersCount() > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold animate-pulse">
                  {getActiveFiltersCount()}
                </span>
              )}
            </button>

            {/* Enhanced Search Button */}
            <button
              onClick={() => handleSearch()}
              disabled={!query.trim() || loading}
              className={`px-6 py-3 rounded-xl font-semibold text-white transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-lg ${
                !query.trim() || loading
                  ? 'bg-gray-400 cursor-not-allowed shadow-gray-300/50'
                  : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 shadow-purple-500/40 hover:shadow-purple-500/60'
              }`}
            >
              {loading ? (
                <div className="flex items-center">
                  <div className="w-4 h-4 mr-2 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Searching...
                </div>
              ) : (
                'Search'
              )}
            </button>
          </div>

          {/* Enhanced Filters Panel */}
          {showFilters && (
            <div className="border-t border-gradient-to-r border-gray-200/50 bg-gradient-to-r from-purple-50/30 to-blue-50/30 p-5 rounded-b-2xl">
              <div className="space-y-6">
                {/* Categories Filter */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold text-gray-700 flex items-center">
                      <Filter className="w-4 h-4 mr-2 text-purple-600" />
                      Categories
                    </span>
                    {tempFilters.categories.length > 0 && (
                      <button
                        onClick={() => setTempFilters(prev => ({ ...prev, categories: [] }))}
                        className="text-xs text-red-600 hover:text-red-800 underline"
                      >
                        Clear all
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {categories.map(category => {
                      const isSelected = tempFilters.categories.includes(category);
                      return (
                        <button
                          key={category}
                          onClick={() => {
                            setTempFilters(prev => ({
                              ...prev,
                              categories: isSelected
                                ? prev.categories.filter(c => c !== category)
                                : [...prev.categories, category]
                            }));
                          }}
                          className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-sm ${
                            isSelected
                              ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-purple-300/50 border-2 border-purple-400'
                              : 'bg-white text-gray-700 hover:bg-gradient-to-r hover:from-purple-50 hover:to-blue-50 hover:text-purple-600 border border-gray-200 hover:border-purple-300'
                          }`}
                        >
                          {category}
                          {isSelected && <span className="ml-1">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Status Filter */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold text-gray-700 flex items-center">
                      <AlertCircle className="w-4 h-4 mr-2 text-green-600" />
                      Status
                    </span>
                    {tempFilters.status.length > 0 && (
                      <button
                        onClick={() => setTempFilters(prev => ({ ...prev, status: [] }))}
                        className="text-xs text-red-600 hover:text-red-800 underline"
                      >
                        Clear all
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {statusOptions.map(status => {
                      const isSelected = tempFilters.status.includes(status);
                      return (
                        <button
                          key={status}
                          onClick={() => {
                            setTempFilters(prev => ({
                              ...prev,
                              status: isSelected
                                ? prev.status.filter(s => s !== status)
                                : [...prev.status, status]
                            }));
                          }}
                          className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                            isSelected
                              ? 'bg-green-500 text-white border-2 border-green-400'
                              : 'bg-white text-gray-700 hover:bg-green-50 hover:text-green-600 border border-gray-200 hover:border-green-300'
                          }`}
                        >
                          {status}
                          {isSelected && <span className="ml-1">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Priority Filter */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold text-gray-700 flex items-center">
                      <AlertCircle className="w-4 h-4 mr-2 text-orange-600" />
                      Priority
                    </span>
                    {tempFilters.priority.length > 0 && (
                      <button
                        onClick={() => setTempFilters(prev => ({ ...prev, priority: [] }))}
                        className="text-xs text-red-600 hover:text-red-800 underline"
                      >
                        Clear all
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {priorityOptions.map(priority => {
                      const isSelected = tempFilters.priority.includes(priority);
                      const priorityColors = {
                        'Critical': 'bg-red-500 border-red-400 hover:bg-red-50 hover:text-red-600 hover:border-red-300',
                        'High': 'bg-orange-500 border-orange-400 hover:bg-orange-50 hover:text-orange-600 hover:border-orange-300',
                        'Medium': 'bg-yellow-500 border-yellow-400 hover:bg-yellow-50 hover:text-yellow-600 hover:border-yellow-300',
                        'Low': 'bg-blue-500 border-blue-400 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300'
                      };
                      return (
                        <button
                          key={priority}
                          onClick={() => {
                            setTempFilters(prev => ({
                              ...prev,
                              priority: isSelected
                                ? prev.priority.filter(p => p !== priority)
                                : [...prev.priority, priority]
                            }));
                          }}
                          className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                            isSelected
                              ? `${priorityColors[priority as keyof typeof priorityColors].split(' ')[0]} text-white border-2 ${priorityColors[priority as keyof typeof priorityColors].split(' ')[1]}`
                              : `bg-white text-gray-700 border border-gray-200 ${priorityColors[priority as keyof typeof priorityColors].split('hover:')[1]}`
                          }`}
                        >
                          {priority}
                          {isSelected && <span className="ml-1">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Date Range Filter */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold text-gray-700 flex items-center">
                      <Calendar className="w-4 h-4 mr-2 text-blue-600" />
                      Date Range
                    </span>
                    {(tempFilters.dateRange.start || tempFilters.dateRange.end) && (
                      <button
                        onClick={() => setTempFilters(prev => ({ ...prev, dateRange: { start: null, end: null } }))}
                        className="text-xs text-red-600 hover:text-red-800 underline"
                      >
                        Clear dates
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">From:</label>
                      <input
                        type="date"
                        value={tempFilters.dateRange.start ? tempFilters.dateRange.start.toISOString().split('T')[0] : ''}
                        onChange={(e) => {
                          const date = e.target.value ? new Date(e.target.value) : null;
                          setTempFilters(prev => ({
                            ...prev,
                            dateRange: { ...prev.dateRange, start: date }
                          }));
                        }}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">To:</label>
                      <input
                        type="date"
                        value={tempFilters.dateRange.end ? tempFilters.dateRange.end.toISOString().split('T')[0] : ''}
                        onChange={(e) => {
                          const date = e.target.value ? new Date(e.target.value) : null;
                          setTempFilters(prev => ({
                            ...prev,
                            dateRange: { ...prev.dateRange, end: date }
                          }));
                        }}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Quick Date Presets */}
                <div>
                  <span className="text-sm font-semibold text-gray-700 mb-3 block">Quick Presets</span>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: 'Today', days: 0 },
                      { label: 'Last 7 days', days: 7 },
                      { label: 'Last 30 days', days: 30 },
                      { label: 'Last 90 days', days: 90 }
                    ].map(preset => (
                      <button
                        key={preset.label}
                        onClick={() => {
                          const end = new Date();
                          const start = new Date();
                          start.setDate(start.getDate() - preset.days);
                          setTempFilters(prev => ({
                            ...prev,
                            dateRange: { start, end }
                          }));
                        }}
                        className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-purple-50 hover:text-purple-600 transition-colors duration-200"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tags Filter */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold text-gray-700 flex items-center">
                      <Tag className="w-4 h-4 mr-2 text-indigo-600" />
                      Common Tags
                    </span>
                    {tempFilters.tags.length > 0 && (
                      <button
                        onClick={() => setTempFilters(prev => ({ ...prev, tags: [] }))}
                        className="text-xs text-red-600 hover:text-red-800 underline"
                      >
                        Clear all
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {commonTags.map(tag => {
                      const isSelected = tempFilters.tags.includes(tag);
                      return (
                        <button
                          key={tag}
                          onClick={() => {
                            setTempFilters(prev => ({
                              ...prev,
                              tags: isSelected
                                ? prev.tags.filter(t => t !== tag)
                                : [...prev.tags, tag]
                            }));
                          }}
                          className={`px-3 py-1 rounded-full text-sm font-medium transition-all duration-200 ${
                            isSelected
                              ? 'bg-indigo-500 text-white border-2 border-indigo-400'
                              : 'bg-white text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 border border-gray-200 hover:border-indigo-300'
                          }`}
                        >
                          #{tag}
                          {isSelected && <span className="ml-1">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Filter Actions */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={clearAllFilters}
                      className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 underline"
                    >
                      Clear All Filters
                    </button>
                    <span className="text-xs text-gray-500">
                      {Object.values(tempFilters).flat().filter(Boolean).length +
                       (tempFilters.dateRange.start || tempFilters.dateRange.end ? 1 : 0)} filters selected
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => {
                        setTempFilters(activeFilters);
                        setShowFilters(false);
                      }}
                      className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={applyFilters}
                      className="px-4 py-2 text-sm bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 shadow-lg hover:shadow-xl transition-all duration-300"
                    >
                      Apply Filters
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Enhanced Search Suggestions */}
        {showSuggestions && !loading && (
          <div
            ref={suggestionsRef}
            id="search-suggestions"
            role="listbox"
            className="absolute top-full left-0 right-0 mt-3 bg-white rounded-2xl shadow-2xl shadow-purple-500/20 border border-gray-200/80 z-50 max-h-96 overflow-y-auto backdrop-blur-sm"
          >
            {suggestions.length > 0 ? (
              <div className="p-3">
                {query.length < 2 && (
                  <div className="px-4 py-3 text-sm font-semibold text-purple-700 border-b border-gray-100/80 bg-gradient-to-r from-purple-50/50 to-blue-50/50 rounded-t-xl flex items-center">
                    <TrendingUp className="w-4 h-4 mr-2" />
                    Popular searches
                  </div>
                )}
                {suggestions.map((suggestion, index) => {
                  const isSelected = index === selectedSuggestionIndex;
                  const highlightMatch = (text: string) => {
                    if (!query) return text;
                    const regex = new RegExp(`(${query})`, 'gi');
                    const parts = text.split(regex);
                    return parts.map((part, i) =>
                      regex.test(part) ?
                        <mark key={i} className="bg-gradient-to-r from-yellow-200 to-orange-200 text-purple-900 px-1 rounded font-medium">{part}</mark> :
                        part
                    );
                  };

                  return (
                    <button
                      key={suggestion.id}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handleSuggestionClick(suggestion)}
                      className={`w-full flex items-center px-4 py-3 text-left rounded-xl transition-all duration-300 group transform ${
                        isSelected
                          ? 'bg-gradient-to-r from-purple-50 to-blue-50 border-l-4 border-purple-500 translate-x-2 shadow-lg shadow-purple-200/40'
                          : 'hover:bg-gradient-to-r hover:from-purple-50/70 hover:to-blue-50/70 hover:translate-x-2 hover:shadow-md hover:shadow-purple-200/30'
                      }`}
                    >
                      <div className={`p-2 rounded-lg transition-all duration-300 ${
                        isSelected
                          ? 'bg-gradient-to-r from-purple-100 to-blue-100'
                          : 'bg-gray-50 group-hover:bg-gradient-to-r group-hover:from-purple-50 group-hover:to-blue-50'
                      }`}>
                        {getSuggestionIcon(suggestion.type)}
                      </div>
                      <span className="ml-4 flex-1 font-medium text-gray-800">{highlightMatch(suggestion.text)}</span>
                      {suggestion.category && (
                        <span className="px-3 py-1 bg-gradient-to-r from-blue-100 to-purple-100 text-blue-800 text-xs rounded-full font-semibold shadow-sm">
                          {suggestion.category}
                        </span>
                      )}
                      {suggestion.count && (
                        <span className="ml-3 text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                          {suggestion.count} uses
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="p-6 text-center">
                <div className="text-gray-500 mb-2">
                  <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  No suggestions found
                </div>
                <p className="text-sm text-gray-400">Try different keywords or check spelling</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Enhanced Search Mode Indicator and Keyboard Shortcuts */}
      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className={`flex items-center px-4 py-2 rounded-xl transition-all duration-300 ${
            useAI
              ? 'bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200'
              : 'bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-200'
          }`}>
            {useAI ? (
              <>
                <Sparkles className="w-4 h-4 mr-2 text-purple-600 animate-pulse" />
                <span className="text-sm font-semibold text-purple-700">AI-enhanced search enabled</span>
              </>
            ) : (
              <>
                <Search className="w-4 h-4 mr-2 text-gray-500" />
                <span className="text-sm font-semibold text-gray-600">Local search only</span>
              </>
            )}
          </div>

          {/* Active Filters Indicator */}
          {getActiveFiltersCount() > 0 && (
            <div className="flex items-center px-3 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl">
              <Filter className="w-4 h-4 mr-2 text-blue-600" />
              <span className="text-sm font-semibold text-blue-700">
                {getActiveFiltersCount()} filter{getActiveFiltersCount() > 1 ? 's' : ''} active
              </span>
            </div>
          )}
        </div>

        {/* Enhanced Keyboard Shortcuts */}
        <div className="hidden md:flex items-center space-x-4">
          <div className="flex items-center space-x-2 text-xs">
            <span className="flex items-center text-gray-600">
              <kbd className="px-2 py-1 bg-gradient-to-b from-white to-gray-100 border border-gray-300 rounded-lg text-xs font-mono shadow-sm mr-1">Ctrl+K</kbd>
              <span className="text-gray-400 mx-1">or</span>
              <kbd className="px-2 py-1 bg-gradient-to-b from-white to-gray-100 border border-gray-300 rounded-lg text-xs font-mono shadow-sm mx-1">/</kbd>
              <span className="ml-1">to focus</span>
            </span>
          </div>
          <div className="w-px h-4 bg-gray-300"></div>
          <div className="flex items-center space-x-2 text-xs">
            <span className="flex items-center text-gray-600">
              <kbd className="px-2 py-1 bg-gradient-to-b from-white to-gray-100 border border-gray-300 rounded-lg text-xs font-mono shadow-sm mr-1">↑↓</kbd>
              <span>navigate</span>
            </span>
          </div>
          <div className="w-px h-4 bg-gray-300"></div>
          <div className="flex items-center space-x-2 text-xs">
            <span className="flex items-center text-gray-600">
              <kbd className="px-2 py-1 bg-gradient-to-b from-white to-gray-100 border border-gray-300 rounded-lg text-xs font-mono shadow-sm mr-1">Esc</kbd>
              <span>clear</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UnifiedSearchFixed;