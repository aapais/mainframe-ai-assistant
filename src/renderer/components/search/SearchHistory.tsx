import React, { useState, useCallback, useMemo } from 'react';
import { SearchQuery, PopularSearch } from '../../../types/services';
import { formatRelativeTime, formatDate } from '../../utils/formatters';
import './SearchHistory.css';

interface SearchHistoryProps {
  recentSearches: SearchQuery[];
  popularSearches: PopularSearch[];
  onSearchSelect: (query: string, useAI?: boolean) => void;
  maxItems?: number;
  className?: string;
  showTimestamps?: boolean;
  showClearAll?: boolean;
}

interface SearchHistoryState {
  activeTab: 'recent' | 'popular' | 'trending';
  expanded: boolean;
  filter: string;
}

/**
 * Search History Component
 * 
 * Features:
 * - Recent searches with timestamps
 * - Popular searches with usage stats
 * - Trending searches analysis
 * - Quick search replay
 * - Search history management
 * - Responsive collapsible design
 */
export const SearchHistory: React.FC<SearchHistoryProps> = ({
  recentSearches,
  popularSearches,
  onSearchSelect,
  maxItems = 10,
  className = '',
  showTimestamps = true,
  showClearAll = true
}) => {
  const [state, setState] = useState<SearchHistoryState>({
    activeTab: 'recent',
    expanded: false,
    filter: ''
  });

  // Filter searches based on query
  const filteredRecentSearches = useMemo(() => {
    if (!state.filter.trim()) return recentSearches.slice(0, maxItems);
    
    const filter = state.filter.toLowerCase();
    return recentSearches
      .filter(search => search.text.toLowerCase().includes(filter))
      .slice(0, maxItems);
  }, [recentSearches, state.filter, maxItems]);

  const filteredPopularSearches = useMemo(() => {
    if (!state.filter.trim()) return popularSearches.slice(0, maxItems);
    
    const filter = state.filter.toLowerCase();
    return popularSearches
      .filter(search => search.query.toLowerCase().includes(filter))
      .slice(0, maxItems);
  }, [popularSearches, state.filter, maxItems]);

  // Calculate trending searches (popular + recent activity)
  const trendingSearches = useMemo(() => {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    // Get recent activity for popular searches
    const trending = popularSearches
      .filter(search => new Date(search.lastUsed) >= oneDayAgo)
      .map(search => {
        const recentUse = recentSearches.filter(recent => 
          recent.text.toLowerCase() === search.query.toLowerCase() &&
          recent.timestamp >= oneDayAgo
        ).length;
        
        return {
          ...search,
          trendScore: search.count * 0.7 + recentUse * 0.3
        };
      })
      .sort((a, b) => b.trendScore - a.trendScore)
      .slice(0, maxItems);

    return trending;
  }, [popularSearches, recentSearches, maxItems]);

  // Handle tab change
  const handleTabChange = useCallback((tab: SearchHistoryState['activeTab']) => {
    setState(prev => ({ ...prev, activeTab: tab }));
  }, []);

  // Handle search selection
  const handleSearchSelect = useCallback((query: string, useAI?: boolean) => {
    onSearchSelect(query, useAI);
  }, [onSearchSelect]);

  // Handle filter change
  const handleFilterChange = useCallback((filter: string) => {
    setState(prev => ({ ...prev, filter }));
  }, []);

  // Toggle expanded state
  const toggleExpanded = useCallback(() => {
    setState(prev => ({ ...prev, expanded: !prev.expanded }));
  }, []);

  // Clear search history
  const handleClearHistory = useCallback(async () => {
    if (window.confirm('Clear all search history? This cannot be undone.')) {
      try {
        await window.electronAPI?.clearSearchHistory?.();
        // Refresh would be handled by parent component
      } catch (error) {
        console.error('Failed to clear search history:', error);
      }
    }
  }, []);

  // Get search frequency indicator
  const getFrequencyIndicator = (count: number, maxCount: number) => {
    const percentage = (count / maxCount) * 100;
    if (percentage >= 80) return { level: 'high', icon: '🔥', label: 'Very Popular' };
    if (percentage >= 50) return { level: 'medium', icon: '📈', label: 'Popular' };
    if (percentage >= 20) return { level: 'low', icon: '📊', label: 'Moderate' };
    return { level: 'minimal', icon: '📉', label: 'Occasional' };
  };

  const maxPopularCount = Math.max(...popularSearches.map(s => s.count), 1);

  return (
    <div className={`search-history ${state.expanded ? 'expanded' : ''} ${className}`}>
      <div className="search-history__header">
        <button
          className="search-history__toggle"
          onClick={toggleExpanded}
          aria-expanded={state.expanded}
          aria-label={state.expanded ? 'Collapse search history' : 'Expand search history'}
        >
          <span className="icon">📚</span>
          <span className="text">Search History</span>
          <span className={`expand-icon ${state.expanded ? 'expanded' : ''}`}>▼</span>
        </button>

        {state.expanded && showClearAll && (
          <button
            className="btn btn--small btn--secondary"
            onClick={handleClearHistory}
            title="Clear all search history"
          >
            <span className="icon">🗑️</span>
          </button>
        )}
      </div>

      {state.expanded && (
        <div className="search-history__content">
          <div className="search-history__controls">
            <div className="tab-bar">
              <button
                className={`tab ${state.activeTab === 'recent' ? 'active' : ''}`}
                onClick={() => handleTabChange('recent')}
              >
                <span className="icon">🕐</span>
                <span className="text">Recent</span>
                <span className="count">{recentSearches.length}</span>
              </button>
              
              <button
                className={`tab ${state.activeTab === 'popular' ? 'active' : ''}`}
                onClick={() => handleTabChange('popular')}
              >
                <span className="icon">⭐</span>
                <span className="text">Popular</span>
                <span className="count">{popularSearches.length}</span>
              </button>
              
              <button
                className={`tab ${state.activeTab === 'trending' ? 'active' : ''}`}
                onClick={() => handleTabChange('trending')}
              >
                <span className="icon">📈</span>
                <span className="text">Trending</span>
                <span className="count">{trendingSearches.length}</span>
              </button>
            </div>

            <div className="search-filter">
              <input
                type="text"
                placeholder="Filter searches..."
                value={state.filter}
                onChange={(e) => handleFilterChange(e.target.value)}
                className="search-filter__input"
              />
              {state.filter && (
                <button
                  className="search-filter__clear"
                  onClick={() => handleFilterChange('')}
                  aria-label="Clear filter"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          <div className="search-history__list">
            {state.activeTab === 'recent' && (
              <div className="search-list search-list--recent">
                {filteredRecentSearches.length === 0 ? (
                  <div className="empty-state">
                    <span className="empty-state__icon">🔍</span>
                    <p className="empty-state__text">
                      {state.filter ? 'No matching searches found' : 'No recent searches'}
                    </p>
                  </div>
                ) : (
                  filteredRecentSearches.map((search, index) => (
                    <div key={`${search.text}-${search.timestamp.getTime()}-${index}`} className="search-item">
                      <button
                        className="search-item__button"
                        onClick={() => handleSearchSelect(search.text, search.options.useAI)}
                        title={`Search for: ${search.text}`}
                      >
                        <div className="search-item__content">
                          <div className="search-item__query">{search.text}</div>
                          {showTimestamps && (
                            <div className="search-item__meta">
                              <span className="timestamp">
                                {formatRelativeTime(search.timestamp)}
                              </span>
                              {search.options.useAI && (
                                <span className="ai-badge">🤖</span>
                              )}
                              {search.options.category && (
                                <span className="category-badge">
                                  {search.options.category}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}

            {state.activeTab === 'popular' && (
              <div className="search-list search-list--popular">
                {filteredPopularSearches.length === 0 ? (
                  <div className="empty-state">
                    <span className="empty-state__icon">⭐</span>
                    <p className="empty-state__text">
                      {state.filter ? 'No matching popular searches' : 'No popular searches yet'}
                    </p>
                  </div>
                ) : (
                  filteredPopularSearches.map((search, index) => {
                    const frequency = getFrequencyIndicator(search.count, maxPopularCount);
                    
                    return (
                      <div key={search.query} className="search-item search-item--popular">
                        <button
                          className="search-item__button"
                          onClick={() => handleSearchSelect(search.query)}
                          title={`Search for: ${search.query}`}
                        >
                          <div className="search-item__content">
                            <div className="search-item__query">{search.query}</div>
                            <div className="search-item__stats">
                              <span className={`frequency frequency--${frequency.level}`}>
                                <span className="frequency__icon">{frequency.icon}</span>
                                <span className="frequency__count">{search.count}x</span>
                              </span>
                              <span className="success-rate">
                                ✅ {Math.round(search.successRate * 100)}%
                              </span>
                              <span className="last-used">
                                {formatRelativeTime(search.lastUsed)}
                              </span>
                            </div>
                          </div>
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {state.activeTab === 'trending' && (
              <div className="search-list search-list--trending">
                {trendingSearches.length === 0 ? (
                  <div className="empty-state">
                    <span className="empty-state__icon">📈</span>
                    <p className="empty-state__text">No trending searches today</p>
                  </div>
                ) : (
                  trendingSearches.map((search, index) => (
                    <div key={search.query} className="search-item search-item--trending">
                      <button
                        className="search-item__button"
                        onClick={() => handleSearchSelect(search.query)}
                        title={`Search for: ${search.query}`}
                      >
                        <div className="search-item__content">
                          <div className="search-item__header">
                            <div className="search-item__query">{search.query}</div>
                            <div className="trend-indicator">
                              <span className="trend-icon">🔥</span>
                              <span className="trend-score">
                                {Math.round(search.trendScore)}
                              </span>
                            </div>
                          </div>
                          <div className="search-item__stats">
                            <span className="stat">
                              📊 {search.count} total
                            </span>
                            <span className="stat">
                              ⏰ {formatRelativeTime(search.lastUsed)}
                            </span>
                            <span className="stat">
                              ✅ {Math.round(search.successRate * 100)}%
                            </span>
                          </div>
                        </div>
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {state.activeTab === 'recent' && recentSearches.length > maxItems && (
            <div className="search-history__footer">
              <p className="footer-text">
                Showing {Math.min(maxItems, filteredRecentSearches.length)} of {recentSearches.length} recent searches
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchHistory;