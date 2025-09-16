/**
 * MobileFirstLayout Example
 *
 * Mobile-optimized Knowledge Base interface demonstrating:
 * - Progressive enhancement from mobile to desktop
 * - Touch-optimized interactions
 * - Swipe gestures and pull-to-refresh
 * - Collapsible navigation patterns
 * - Compact information density
 * - Thumb-friendly button sizing
 * - Responsive typography scaling
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { ResponsiveGrid, GridItem } from '../components/Layout/ResponsiveGrid';
import { useResponsive } from '../hooks/useResponsive';
import { useResizeObserver } from '../hooks/useResizeObserver';
import { Button } from '../components/foundation/Button';

// =========================
// TYPE DEFINITIONS
// =========================

interface MobileKBEntry {
  id: string;
  title: string;
  problem: string;
  solution: string;
  category: string;
  tags: string[];
  usage_count: number;
  success_rate: number;
  created_at: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  reading_time: string;
}

interface SearchState {
  query: string;
  isActive: boolean;
  showFilters: boolean;
  category: string;
  sortBy: 'relevance' | 'recent' | 'popular';
}

interface MobileLayoutProps {
  entries?: MobileKBEntry[];
  onSearch?: (query: string) => void;
  onEntrySelect?: (entry: MobileKBEntry) => void;
}

// =========================
// MOCK DATA
// =========================

const MOBILE_MOCK_ENTRIES: MobileKBEntry[] = [
  {
    id: '1',
    title: 'VSAM Status 35 Fix',
    problem: 'VSAM file not found error during batch job execution',
    solution: '1. Check dataset exists\n2. Verify DD statement\n3. Use LISTCAT command\n4. Check permissions',
    category: 'VSAM',
    tags: ['vsam', 'status-35', 'file-not-found'],
    usage_count: 156,
    success_rate: 94,
    created_at: '2025-01-15T10:30:00Z',
    severity: 'high',
    reading_time: '2 min read'
  },
  {
    id: '2',
    title: 'S0C7 Quick Debug',
    problem: 'Data exception in COBOL program',
    solution: '1. Check numeric fields\n2. Initialize variables\n3. Use CEDF',
    category: 'Batch',
    tags: ['s0c7', 'cobol', 'debug'],
    usage_count: 89,
    success_rate: 87,
    created_at: '2025-01-14T14:15:00Z',
    severity: 'high',
    reading_time: '1 min read'
  },
  {
    id: '3',
    title: 'JCL Dataset Error',
    problem: 'Dataset not found in JCL step',
    solution: '1. Check DSN spelling\n2. Verify catalog\n3. Check RACF access',
    category: 'JCL',
    tags: ['jcl', 'dataset', 'error'],
    usage_count: 203,
    success_rate: 91,
    created_at: '2025-01-12T09:00:00Z',
    severity: 'medium',
    reading_time: '3 min read'
  },
  {
    id: '4',
    title: 'DB2 Lock Timeout',
    problem: 'Database lock causing timeout',
    solution: '1. Check active locks\n2. Kill hanging processes\n3. Optimize queries',
    category: 'DB2',
    tags: ['db2', 'locks', 'timeout'],
    usage_count: 67,
    success_rate: 85,
    created_at: '2025-01-10T16:45:00Z',
    severity: 'critical',
    reading_time: '4 min read'
  },
  {
    id: '5',
    title: 'CICS ASRA Debug',
    problem: 'CICS transaction abend with ASRA',
    solution: '1. Use CEDF\n2. Check storage\n3. Review code logic',
    category: 'CICS',
    tags: ['cics', 'asra', 'debug'],
    usage_count: 34,
    success_rate: 78,
    created_at: '2025-01-08T11:20:00Z',
    severity: 'medium',
    reading_time: '2 min read'
  }
];

// =========================
// TOUCH UTILITIES
// =========================

/**
 * Touch interaction hook for mobile gestures
 */
const useTouchInteractions = () => {
  const [touchState, setTouchState] = useState({
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    isDragging: false,
    direction: null as 'left' | 'right' | 'up' | 'down' | null
  });

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    setTouchState(prev => ({
      ...prev,
      startX: touch.clientX,
      startY: touch.clientY,
      currentX: touch.clientX,
      currentY: touch.clientY,
      isDragging: true
    }));
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchState.isDragging) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - touchState.startX;
    const deltaY = touch.clientY - touchState.startY;

    // Determine swipe direction
    let direction = null;
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      direction = deltaX > 0 ? 'right' : 'left';
    } else {
      direction = deltaY > 0 ? 'down' : 'up';
    }

    setTouchState(prev => ({
      ...prev,
      currentX: touch.clientX,
      currentY: touch.clientY,
      direction
    }));
  }, [touchState.isDragging, touchState.startX, touchState.startY]);

  const handleTouchEnd = useCallback(() => {
    setTouchState(prev => ({
      ...prev,
      isDragging: false,
      direction: null
    }));
  }, []);

  return {
    touchState,
    touchHandlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd
    }
  };
};

// =========================
// SUB-COMPONENTS
// =========================

/**
 * Mobile Search Header
 * Compact search with expandable filters
 */
const MobileSearchHeader: React.FC<{
  searchState: SearchState;
  onSearchChange: (state: Partial<SearchState>) => void;
  onSearch: (query: string) => void;
}> = ({ searchState, onSearchChange, onSearch }) => {
  const searchInputRef = useRef<HTMLInputElement>(null);

  const handleSearchSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    onSearch(searchState.query);
    searchInputRef.current?.blur();
  }, [searchState.query, onSearch]);

  const toggleFilters = useCallback(() => {
    onSearchChange({ showFilters: !searchState.showFilters });
  }, [searchState.showFilters, onSearchChange]);

  const categories = ['All', 'VSAM', 'JCL', 'DB2', 'Batch', 'CICS'];
  const sortOptions = [
    { value: 'relevance', label: 'Most Relevant' },
    { value: 'recent', label: 'Most Recent' },
    { value: 'popular', label: 'Most Popular' }
  ];

  return (
    <div className="sticky top-0 z-50 bg-white shadow-sm border-b border-gray-200">
      {/* Main Search */}
      <div className="p-4">
        <form onSubmit={handleSearchSubmit}>
          <div className="relative">
            <input
              ref={searchInputRef}
              type="text"
              value={searchState.query}
              onChange={(e) => onSearchChange({ query: e.target.value })}
              placeholder="Search knowledge base..."
              className="w-full pl-10 pr-12 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck="false"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <button
              type="button"
              onClick={toggleFilters}
              className={`absolute inset-y-0 right-0 pr-3 flex items-center ${
                searchState.showFilters ? 'text-blue-600' : 'text-gray-400'
              }`}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z" />
              </svg>
            </button>
          </div>
        </form>
      </div>

      {/* Expandable Filters */}
      {searchState.showFilters && (
        <div className="px-4 pb-4 space-y-4 bg-gray-50 border-t border-gray-200">
          {/* Category Pills */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => onSearchChange({
                    category: category === 'All' ? '' : category
                  })}
                  className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                    (category === 'All' && !searchState.category) ||
                    (category === searchState.category)
                      ? 'bg-blue-500 text-white border-blue-500'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          {/* Sort Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Sort by</label>
            <select
              value={searchState.sortBy}
              onChange={(e) => onSearchChange({ sortBy: e.target.value as any })}
              className="w-full px-3 py-2 text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Mobile Entry Card
 * Compact card optimized for touch
 */
const MobileEntryCard: React.FC<{
  entry: MobileKBEntry;
  onClick: (entry: MobileKBEntry) => void;
}> = ({ entry, onClick }) => {
  const { touchHandlers } = useTouchInteractions();

  const getSeverityColor = useCallback((severity: string) => {
    const colors = {
      low: 'bg-green-100 text-green-800 border-green-200',
      medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      high: 'bg-orange-100 text-orange-800 border-orange-200',
      critical: 'bg-red-100 text-red-800 border-red-200'
    };
    return colors[severity] || 'bg-gray-100 text-gray-800 border-gray-200';
  }, []);

  const getSeverityIcon = useCallback((severity: string) => {
    const icons = {
      low: '🟢',
      medium: '🟡',
      high: '🟠',
      critical: '🔴'
    };
    return icons[severity] || '⚪';
  }, []);

  return (
    <div
      {...touchHandlers}
      onClick={() => onClick(entry)}
      className="bg-white border border-gray-200 rounded-lg p-4 mb-3 active:bg-gray-50 transition-colors touch-manipulation"
      style={{ minHeight: '44px' }} // Minimum touch target
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 pr-3">
          <h3 className="font-semibold text-gray-900 text-base leading-snug line-clamp-2">
            {entry.title}
          </h3>
          <div className="flex items-center mt-1 space-x-2">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getSeverityColor(entry.severity)}`}>
              <span className="mr-1">{getSeverityIcon(entry.severity)}</span>
              {entry.severity.toUpperCase()}
            </span>
            <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded-full">
              {entry.category}
            </span>
          </div>
        </div>
      </div>

      {/* Problem Preview */}
      <p className="text-sm text-gray-600 leading-relaxed line-clamp-2 mb-3">
        {entry.problem}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center space-x-4">
          <span className="flex items-center">
            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            {entry.usage_count}
          </span>
          <span className="flex items-center">
            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            {entry.success_rate}%
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <span>{entry.reading_time}</span>
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>

      {/* Tags */}
      {entry.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3 pt-3 border-t border-gray-100">
          {entry.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="inline-block px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded"
            >
              #{tag}
            </span>
          ))}
          {entry.tags.length > 3 && (
            <span className="inline-block px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
              +{entry.tags.length - 3}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Mobile Bottom Navigation
 * Tab-based navigation for mobile
 */
const MobileBottomNav: React.FC<{
  activeTab: string;
  onTabChange: (tab: string) => void;
}> = ({ activeTab, onTabChange }) => {
  const tabs = [
    { id: 'search', label: 'Search', icon: '🔍' },
    { id: 'recent', label: 'Recent', icon: '🕒' },
    { id: 'favorites', label: 'Saved', icon: '❤️' },
    { id: 'profile', label: 'Profile', icon: '👤' }
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 safe-area-pb">
      <div className="grid grid-cols-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex flex-col items-center justify-center py-2 text-xs transition-colors ${
              activeTab === tab.id
                ? 'text-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-900'
            }`}
            style={{ minHeight: '60px' }} // Thumb-friendly height
          >
            <span className="text-lg mb-1">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

/**
 * Pull to Refresh Component
 */
const PullToRefresh: React.FC<{
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
}> = ({ onRefresh, children }) => {
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);
  const maxPullDistance = 80;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      startY.current = e.touches[0].clientY;
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (window.scrollY > 0 || isRefreshing) return;

    const currentY = e.touches[0].clientY;
    const distance = Math.max(0, currentY - startY.current);

    if (distance > 0) {
      e.preventDefault();
      setIsPulling(true);
      setPullDistance(Math.min(distance, maxPullDistance));
    }
  }, [isRefreshing]);

  const handleTouchEnd = useCallback(async () => {
    if (pullDistance > 50 && !isRefreshing) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    }

    setIsPulling(false);
    setPullDistance(0);
  }, [pullDistance, isRefreshing, onRefresh]);

  const pullProgress = (pullDistance / maxPullDistance) * 100;

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative"
    >
      {/* Pull Indicator */}
      {(isPulling || isRefreshing) && (
        <div
          className="absolute top-0 left-0 right-0 flex items-center justify-center bg-blue-50 transition-all duration-200"
          style={{
            height: `${Math.max(pullDistance, isRefreshing ? 60 : 0)}px`,
            transform: `translateY(-${Math.max(pullDistance, isRefreshing ? 60 : 0)}px)`
          }}
        >
          <div className="flex items-center space-x-2 text-blue-600">
            {isRefreshing ? (
              <>
                <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span className="text-sm">Refreshing...</span>
              </>
            ) : (
              <>
                <div
                  className="w-5 h-5 border-2 border-blue-200 border-t-blue-600 rounded-full transition-transform duration-200"
                  style={{ transform: `rotate(${pullProgress * 3.6}deg)` }}
                />
                <span className="text-sm">
                  {pullDistance > 50 ? 'Release to refresh' : 'Pull to refresh'}
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <div
        className="transition-transform duration-200"
        style={{
          transform: `translateY(${isPulling ? pullDistance : 0}px)`
        }}
      >
        {children}
      </div>
    </div>
  );
};

// =========================
// MAIN COMPONENT
// =========================

/**
 * MobileFirstLayout Example
 *
 * Complete mobile-optimized Knowledge Base interface
 */
export const MobileFirstLayout: React.FC<MobileLayoutProps> = ({
  entries = MOBILE_MOCK_ENTRIES,
  onSearch,
  onEntrySelect
}) => {
  const [searchState, setSearchState] = useState<SearchState>({
    query: '',
    isActive: false,
    showFilters: false,
    category: '',
    sortBy: 'relevance'
  });
  const [activeTab, setActiveTab] = useState('search');
  const [filteredEntries, setFilteredEntries] = useState(entries);
  const [isLoading, setIsLoading] = useState(false);

  const { device, breakpoint } = useResponsive();
  const containerRef = useRef<HTMLDivElement>(null);
  const dimensions = useResizeObserver(containerRef);

  // Filter entries based on search state
  useEffect(() => {
    let filtered = [...entries];

    // Apply text search
    if (searchState.query.trim()) {
      const query = searchState.query.toLowerCase();
      filtered = filtered.filter(entry =>
        entry.title.toLowerCase().includes(query) ||
        entry.problem.toLowerCase().includes(query) ||
        entry.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Apply category filter
    if (searchState.category) {
      filtered = filtered.filter(entry => entry.category === searchState.category);
    }

    // Apply sorting
    switch (searchState.sortBy) {
      case 'recent':
        filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case 'popular':
        filtered.sort((a, b) => b.usage_count - a.usage_count);
        break;
      default: // relevance
        if (searchState.query.trim()) {
          // Simple relevance scoring
          filtered.sort((a, b) => {
            const aScore = (a.title.toLowerCase().includes(searchState.query.toLowerCase()) ? 2 : 0) +
                          (a.problem.toLowerCase().includes(searchState.query.toLowerCase()) ? 1 : 0);
            const bScore = (b.title.toLowerCase().includes(searchState.query.toLowerCase()) ? 2 : 0) +
                          (b.problem.toLowerCase().includes(searchState.query.toLowerCase()) ? 1 : 0);
            return bScore - aScore;
          });
        }
        break;
    }

    setFilteredEntries(filtered);
  }, [entries, searchState]);

  // Handle search
  const handleSearch = useCallback((query: string) => {
    console.log('Mobile search:', query);
    onSearch?.(query);
  }, [onSearch]);

  // Handle entry selection
  const handleEntrySelect = useCallback((entry: MobileKBEntry) => {
    console.log('Mobile entry selected:', entry.id);
    onEntrySelect?.(entry);
  }, [onEntrySelect]);

  // Handle search state changes
  const handleSearchStateChange = useCallback((changes: Partial<SearchState>) => {
    setSearchState(prev => ({ ...prev, ...changes }));
  }, []);

  // Handle pull to refresh
  const handleRefresh = useCallback(async () => {
    setIsLoading(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsLoading(false);
    console.log('Mobile refresh completed');
  }, []);

  // Get content based on active tab
  const getTabContent = useCallback(() => {
    switch (activeTab) {
      case 'search':
        return (
          <div className="pb-20"> {/* Bottom nav spacing */}
            <PullToRefresh onRefresh={handleRefresh}>
              <div className="px-4 py-2">
                {/* Results Header */}
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">
                    {filteredEntries.length} Results
                  </h2>
                  {searchState.query && (
                    <button
                      onClick={() => handleSearchStateChange({ query: '', category: '' })}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Entry List */}
                {isLoading ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="bg-gray-200 rounded-lg h-32 animate-pulse" />
                    ))}
                  </div>
                ) : filteredEntries.length > 0 ? (
                  filteredEntries.map((entry) => (
                    <MobileEntryCard
                      key={entry.id}
                      entry={entry}
                      onClick={handleEntrySelect}
                    />
                  ))
                ) : (
                  <div className="text-center py-12">
                    <div className="text-4xl mb-4">🔍</div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No results found</h3>
                    <p className="text-gray-600 mb-4">
                      Try adjusting your search terms or filters
                    </p>
                    <Button
                      variant="primary"
                      onClick={() => handleSearchStateChange({ query: '', category: '', showFilters: false })}
                    >
                      Clear all filters
                    </Button>
                  </div>
                )}
              </div>
            </PullToRefresh>
          </div>
        );

      case 'recent':
        return (
          <div className="px-4 py-6 pb-20 text-center">
            <div className="text-4xl mb-4">🕒</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Recent Activity</h3>
            <p className="text-gray-600">Your recently viewed entries will appear here</p>
          </div>
        );

      case 'favorites':
        return (
          <div className="px-4 py-6 pb-20 text-center">
            <div className="text-4xl mb-4">❤️</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Saved Entries</h3>
            <p className="text-gray-600">Save entries for quick access later</p>
          </div>
        );

      case 'profile':
        return (
          <div className="px-4 py-6 pb-20 space-y-6">
            <div className="text-center">
              <div className="text-4xl mb-4">👤</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Profile</h3>
              <p className="text-gray-600">Manage your preferences and settings</p>
            </div>

            <div className="space-y-4">
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h4 className="font-medium text-gray-900 mb-2">Usage Stats</h4>
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-blue-600">47</div>
                    <div className="text-sm text-gray-600">Searches</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-600">23</div>
                    <div className="text-sm text-gray-600">Solutions Used</div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h4 className="font-medium text-gray-900 mb-2">Settings</h4>
                <div className="space-y-3">
                  <label className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">Dark Mode</span>
                    <input type="checkbox" className="rounded" />
                  </label>
                  <label className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">Notifications</span>
                    <input type="checkbox" className="rounded" defaultChecked />
                  </label>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  }, [activeTab, filteredEntries, isLoading, searchState, handleRefresh, handleEntrySelect, handleSearchStateChange]);

  return (
    <div ref={containerRef} className="min-h-screen bg-gray-50" data-testid="mobile-first-layout">
      {/* Mobile Search Header */}
      <MobileSearchHeader
        searchState={searchState}
        onSearchChange={handleSearchStateChange}
        onSearch={handleSearch}
      />

      {/* Main Content */}
      <main className="min-h-screen">
        {getTabContent()}
      </main>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Debug Info */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed top-16 right-2 z-40 bg-black bg-opacity-75 text-white text-xs p-2 rounded max-w-xs">
          <div><strong>Device:</strong> {device.isMobile ? 'Mobile' : device.isTablet ? 'Tablet' : 'Desktop'}</div>
          <div><strong>Breakpoint:</strong> {breakpoint}</div>
          <div><strong>Size:</strong> {dimensions?.width || 0}×{dimensions?.height || 0}px</div>
          <div><strong>Results:</strong> {filteredEntries.length}</div>
          <div><strong>Active Tab:</strong> {activeTab}</div>
        </div>
      )}
    </div>
  );
};

export default MobileFirstLayout;