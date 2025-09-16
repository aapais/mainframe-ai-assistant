/**
 * SearchHistoryPanel - Comprehensive search history management
 *
 * Features:
 * - Recent searches with timestamps
 * - Popular searches with usage counts
 * - Search filtering and organization
 * - Bulk operations (clear, export)
 * - Keyboard navigation support
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useKeyboardNavigation } from '../../hooks/useKeyboardNavigation';
import './SearchHistoryPanel.css';

export interface SearchHistoryItem {
  query: string;
  timestamp: Date;
  resultCount?: number;
  successful?: boolean;
}

export interface PopularSearch {
  query: string;
  count: number;
  lastUsed: Date;
  avgResultCount?: number;
}

export interface SearchHistoryPanelProps {
  recentSearches: string[];
  popularSearches: Array<{ query: string; count: number }>;
  onSelect: (query: string) => void;
  onClear: () => void;
  onClose: () => void;
  maxItems?: number;
  enableKeyboardNavigation?: boolean;
}

export const SearchHistoryPanel: React.FC<SearchHistoryPanelProps> = ({
  recentSearches = [],
  popularSearches = [],
  onSelect,
  onClear,
  onClose,
  maxItems = 20,
  enableKeyboardNavigation = true
}) => {
  // State
  const [activeTab, setActiveTab] = useState<'recent' | 'popular'>('recent');
  const [filterQuery, setFilterQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(-1);

  // Refs
  const panelRef = useRef<HTMLDivElement>(null);
  const filterInputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // Filter searches based on filter query
  const filteredRecentSearches = useMemo(() => {
    if (!filterQuery) return recentSearches.slice(0, maxItems);

    return recentSearches
      .filter(search =>
        search.toLowerCase().includes(filterQuery.toLowerCase())
      )
      .slice(0, maxItems);
  }, [recentSearches, filterQuery, maxItems]);

  const filteredPopularSearches = useMemo(() => {
    if (!filterQuery) return popularSearches.slice(0, maxItems);

    return popularSearches
      .filter(search =>
        search.query.toLowerCase().includes(filterQuery.toLowerCase())
      )
      .slice(0, maxItems);
  }, [popularSearches, filterQuery, maxItems]);

  // Get current list based on active tab
  const currentList = useMemo(() => {
    return activeTab === 'recent' ? filteredRecentSearches : filteredPopularSearches.map(p => p.query);
  }, [activeTab, filteredRecentSearches, filteredPopularSearches]);

  // Keyboard navigation
  const handleKeyDown = useKeyboardNavigation({
    onArrowUp: () => {
      setSelectedIndex(prev => Math.max(-1, prev - 1));
    },
    onArrowDown: () => {
      setSelectedIndex(prev => Math.min(currentList.length - 1, prev + 1));
    },
    onEnter: () => {
      if (selectedIndex >= 0 && selectedIndex < currentList.length) {
        onSelect(currentList[selectedIndex]);
      }
    },
    onEscape: () => {
      onClose();
    },
    enabled: enableKeyboardNavigation
  });

  // Focus management
  useEffect(() => {
    if (filterInputRef.current) {
      filterInputRef.current.focus();
    }
  }, []);

  // Update selected index when list changes
  useEffect(() => {
    if (selectedIndex >= currentList.length) {
      setSelectedIndex(currentList.length - 1);
    }
  }, [currentList.length, selectedIndex]);

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex >= 0 && itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      });
    }
  }, [selectedIndex]);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handleTabChange = (tab: 'recent' | 'popular') => {
    setActiveTab(tab);
    setSelectedIndex(-1);
    setFilterQuery('');
  };

  const handleItemSelect = (query: string) => {
    onSelect(query);
    onClose();
  };

  const handleExportHistory = () => {
    const exportData = {
      recent: recentSearches,
      popular: popularSearches,
      exportedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `search-history-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      ref={panelRef}
      className="search-history-panel"
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-labelledby="search-history-title"
      aria-modal="true"
    >
      {/* Header */}
      <div className="panel-header">
        <h3 id="search-history-title">Search History</h3>
        <button
          type="button"
          className="close-button"
          onClick={onClose}
          aria-label="Close search history panel"
        >
          ✕
        </button>
      </div>

      {/* Tabs */}
      <div className="history-tabs" role="tablist">
        <button
          type="button"
          className={`tab ${activeTab === 'recent' ? 'active' : ''}`}
          onClick={() => handleTabChange('recent')}
          role="tab"
          aria-selected={activeTab === 'recent'}
          aria-controls="recent-panel"
        >
          Recent ({filteredRecentSearches.length})
        </button>
        <button
          type="button"
          className={`tab ${activeTab === 'popular' ? 'active' : ''}`}
          onClick={() => handleTabChange('popular')}
          role="tab"
          aria-selected={activeTab === 'popular'}
          aria-controls="popular-panel"
        >
          Popular ({filteredPopularSearches.length})
        </button>
      </div>

      {/* Filter */}
      <div className="filter-section">
        <input
          ref={filterInputRef}
          type="text"
          value={filterQuery}
          onChange={(e) => setFilterQuery(e.target.value)}
          placeholder="Filter searches..."
          className="filter-input"
          aria-label="Filter search history"
        />
      </div>

      {/* Search Lists */}
      <div className="history-content">
        {/* Recent Searches Tab */}
        {activeTab === 'recent' && (
          <div
            id="recent-panel"
            className="search-list"
            role="tabpanel"
            aria-labelledby="recent-tab"
          >
            {filteredRecentSearches.length === 0 ? (
              <div className="empty-state">
                <p>No recent searches found</p>
                {filterQuery && <p>Try adjusting your filter</p>}
              </div>
            ) : (
              filteredRecentSearches.map((search, index) => (
                <button
                  key={`recent-${index}`}
                  ref={el => itemRefs.current[index] = el}
                  type="button"
                  className={`history-item ${selectedIndex === index ? 'selected' : ''}`}
                  onClick={() => handleItemSelect(search)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div className="item-content">
                    <span className="search-query">{search}</span>
                    <div className="item-meta">
                      <span className="item-type">Recent</span>
                      <span className="item-time">
                        {/* TODO: Add timestamp when available */}
                        Position #{index + 1}
                      </span>
                    </div>
                  </div>
                  <div className="item-actions">
                    <span className="select-hint">↩</span>
                  </div>
                </button>
              ))
            )}
          </div>
        )}

        {/* Popular Searches Tab */}
        {activeTab === 'popular' && (
          <div
            id="popular-panel"
            className="search-list"
            role="tabpanel"
            aria-labelledby="popular-tab"
          >
            {filteredPopularSearches.length === 0 ? (
              <div className="empty-state">
                <p>No popular searches found</p>
                {filterQuery && <p>Try adjusting your filter</p>}
              </div>
            ) : (
              filteredPopularSearches.map((search, index) => (
                <button
                  key={`popular-${index}`}
                  ref={el => itemRefs.current[index] = el}
                  type="button"
                  className={`history-item ${selectedIndex === index ? 'selected' : ''}`}
                  onClick={() => handleItemSelect(search.query)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div className="item-content">
                    <span className="search-query">{search.query}</span>
                    <div className="item-meta">
                      <span className="item-type">Popular</span>
                      <span className="usage-count">
                        {search.count} use{search.count !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                  <div className="item-actions">
                    <div className="popularity-indicator">
                      <div
                        className="popularity-bar"
                        style={{
                          width: `${Math.min(100, (search.count / Math.max(...popularSearches.map(p => p.count))) * 100)}%`
                        }}
                      />
                    </div>
                    <span className="select-hint">↩</span>
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="panel-footer">
        <div className="footer-actions">
          <button
            type="button"
            className="action-button secondary"
            onClick={handleExportHistory}
            title="Export search history as JSON"
          >
            💾 Export
          </button>

          <button
            type="button"
            className="action-button danger"
            onClick={onClear}
            title="Clear all search history"
          >
            🗑️ Clear All
          </button>
        </div>

        <div className="keyboard-hints">
          <span>↑↓ Navigate • ↩ Select • Esc Close</span>
        </div>
      </div>
    </div>
  );
};

export default SearchHistoryPanel;