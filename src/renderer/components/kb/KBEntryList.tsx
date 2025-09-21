/**
 * KB Entry List - Optimized Knowledge Base Entry Display Component
 * 
 * This component provides a comprehensive entry list interface with:
 * - Integration with KBDataContext for state management
 * - Virtual scrolling for performance with large datasets
 * - Entry selection and action handling
 * - Real-time usage tracking and metrics
 * - Filtering and sorting capabilities
 * - Optimistic updates and error handling
 * - Accessibility features and keyboard navigation
 * 
 * @author Frontend Integration Specialist
 * @version 1.0.0
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useKBData } from '../contexts/KBDataContext';
import { useSearch } from '../contexts/SearchContext';
import { KBEntry, KBCategory } from '../../types/services';
import { VirtualList, FixedSizeList } from './ui/VirtualList';

// =====================
// Types & Interfaces
// =====================

export interface KBEntryListProps {
  className?: string;
  onEntrySelect?: (entry: KBEntry) => void;
  onEntryRate?: (entryId: string, successful: boolean) => void;
  selectedEntryId?: string;
  showUsageStats?: boolean;
  showCategories?: boolean;
  enableVirtualization?: boolean;
  itemHeight?: number;
  maxHeight?: string;
}

export interface EntryItemProps {
  entry: KBEntry;
  isSelected: boolean;
  onSelect: (entry: KBEntry) => void;
  onRate: (entryId: string, successful: boolean) => void;
  showUsageStats: boolean;
  showCategories: boolean;
  style?: React.CSSProperties;
}

// =====================
// Entry Item Component
// =====================

const EntryItem: React.FC<EntryItemProps> = React.memo(({
  entry,
  isSelected,
  onSelect,
  onRate,
  showUsageStats,
  showCategories,
  style,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isRating, setIsRating] = useState(false);

  const { recordEntryView } = useKBData();

  const handleClick = useCallback(() => {
    onSelect(entry);
    recordEntryView(entry.id);
  }, [entry, onSelect, recordEntryView]);

  const handleRate = useCallback(async (successful: boolean) => {
    setIsRating(true);
    try {
      await onRate(entry.id, successful);
    } finally {
      setIsRating(false);
    }
  }, [entry.id, onRate]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        handleClick();
        break;
      case 'ArrowRight':
        if (!isExpanded) {
          setIsExpanded(true);
        }
        break;
      case 'ArrowLeft':
        if (isExpanded) {
          setIsExpanded(false);
        }
        break;
    }
  }, [handleClick, isExpanded]);

  const successRate = useMemo(() => {
    const total = entry.success_count + entry.failure_count;
    return total > 0 ? (entry.success_count / total) * 100 : 0;
  }, [entry.success_count, entry.failure_count]);

  const getCategoryColor = useCallback((category: KBCategory) => {
    const colors = {
      'JCL': '#3b82f6',
      'VSAM': '#059669',
      'DB2': '#7c3aed',
      'Batch': '#dc2626',
      'Functional': '#f59e0b',
      'IMS': '#ec4899',
      'CICS': '#06b6d4',
      'System': '#6b7280',
      'Other': '#374151',
    };
    return colors[category] || colors['Other'];
  }, []);

  return (
    <div
      style={{
        ...style,
        padding: '1rem',
        border: `2px solid ${isSelected ? '#3b82f6' : '#e5e7eb'}`,
        borderRadius: '8px',
        backgroundColor: isSelected ? '#eff6ff' : 'white',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        ...(isSelected && {
          boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.1)',
        }),
      }}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-selected={isSelected}
      aria-expanded={isExpanded}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.5rem' }}>
        {/* Category Badge */}
        {showCategories && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '0.25rem 0.5rem',
              fontSize: '0.75rem',
              fontWeight: '500',
              color: 'white',
              backgroundColor: getCategoryColor(entry.category),
              borderRadius: '4px',
              flexShrink: 0,
            }}
          >
            {entry.category}
          </span>
        )}

        {/* Title and Stats */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3
            style={{
              margin: 0,
              fontSize: '1rem',
              fontWeight: '600',
              color: '#111827',
              lineHeight: '1.25',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {entry.title}
          </h3>

          {/* Usage Stats */}
          {showUsageStats && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.25rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                Used {entry.usage_count} times
              </span>
              {successRate > 0 && (
                <span 
                  style={{ 
                    fontSize: '0.75rem', 
                    color: successRate >= 70 ? '#059669' : successRate >= 40 ? '#f59e0b' : '#dc2626',
                    fontWeight: '500',
                  }}
                >
                  {successRate.toFixed(0)}% success
                </span>
              )}
            </div>
          )}
        </div>

        {/* Expand Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          style={{
            padding: '0.25rem',
            border: 'none',
            backgroundColor: 'transparent',
            color: '#6b7280',
            cursor: 'pointer',
            borderRadius: '4px',
            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
          }}
          aria-label={isExpanded ? 'Collapse entry' : 'Expand entry'}
        >
          ▼
        </button>
      </div>

      {/* Problem Preview */}
      <div
        style={{
          fontSize: '0.875rem',
          color: '#4b5563',
          lineHeight: '1.4',
          marginBottom: '0.5rem',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: '-webkit-box',
          WebkitLineClamp: isExpanded ? 'none' : 2,
          WebkitBoxOrient: 'vertical',
        }}
      >
        {entry.problem}
      </div>

      {/* Tags */}
      {entry.tags && entry.tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginBottom: '0.5rem' }}>
          {entry.tags.slice(0, isExpanded ? undefined : 3).map((tag) => (
            <span
              key={tag}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '0.125rem 0.375rem',
                fontSize: '0.75rem',
                color: '#374151',
                backgroundColor: '#f3f4f6',
                borderRadius: '12px',
                border: '1px solid #d1d5db',
              }}
            >
              {tag}
            </span>
          ))}
          {!isExpanded && entry.tags.length > 3 && (
            <span
              style={{
                fontSize: '0.75rem',
                color: '#6b7280',
                fontStyle: 'italic',
              }}
            >
              +{entry.tags.length - 3} more
            </span>
          )}
        </div>
      )}

      {/* Expanded Content */}
      {isExpanded && (
        <div
          style={{
            marginTop: '0.75rem',
            paddingTop: '0.75rem',
            borderTop: '1px solid #e5e7eb',
          }}
        >
          {/* Solution Preview */}
          <div style={{ marginBottom: '0.75rem' }}>
            <h4 style={{ 
              margin: '0 0 0.5rem 0', 
              fontSize: '0.875rem', 
              fontWeight: '600', 
              color: '#374151' 
            }}>
              Solution:
            </h4>
            <div
              style={{
                fontSize: '0.875rem',
                color: '#4b5563',
                lineHeight: '1.5',
                maxHeight: '6rem',
                overflow: 'auto',
                padding: '0.5rem',
                backgroundColor: '#f9fafb',
                borderRadius: '4px',
                border: '1px solid #e5e7eb',
              }}
            >
              {entry.solution}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
              Was this helpful?
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleRate(true);
              }}
              disabled={isRating}
              style={{
                padding: '0.25rem 0.5rem',
                border: '1px solid #10b981',
                backgroundColor: 'white',
                color: '#10b981',
                cursor: isRating ? 'not-allowed' : 'pointer',
                borderRadius: '4px',
                fontSize: '0.75rem',
                opacity: isRating ? 0.6 : 1,
              }}
            >
              👍 Yes
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleRate(false);
              }}
              disabled={isRating}
              style={{
                padding: '0.25rem 0.5rem',
                border: '1px solid #ef4444',
                backgroundColor: 'white',
                color: '#ef4444',
                cursor: isRating ? 'not-allowed' : 'pointer',
                borderRadius: '4px',
                fontSize: '0.75rem',
                opacity: isRating ? 0.6 : 1,
              }}
            >
              👎 No
            </button>
            {isRating && (
              <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                Saving...
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

EntryItem.displayName = 'EntryItem';

// Virtual scrolling is now handled by the improved VirtualList component

// =====================
// Main Entry List Component
// =====================

export const KBEntryList: React.FC<KBEntryListProps> = ({
  className = '',
  onEntrySelect,
  onEntryRate,
  selectedEntryId,
  showUsageStats = true,
  showCategories = true,
  enableVirtualization = false,
  itemHeight = 200,
  maxHeight = '60vh',
}) => {
  // Context hooks
  const { state, recordEntryUsage } = useKBData();
  const { state: searchState } = useSearch();

  // Local state
  const [selectedEntry, setSelectedEntry] = useState<KBEntry | null>(null);

  // Get entries from search results or all entries
  const displayEntries = useMemo(() => {
    if (searchState.results.length > 0) {
      return searchState.results.map(result => result.entry);
    }
    return Array.from(state.entries.values());
  }, [searchState.results, state.entries]);

  // Handle entry selection
  const handleEntrySelect = useCallback((entry: KBEntry) => {
    setSelectedEntry(entry);
    onEntrySelect?.(entry);
  }, [onEntrySelect]);

  // Handle entry rating
  const handleEntryRate = useCallback(async (entryId: string, successful: boolean) => {
    try {
      await recordEntryUsage(entryId, successful);
      onEntryRate?.(entryId, successful);
    } catch (error) {
      console.error('Failed to rate entry:', error);
    }
  }, [recordEntryUsage, onEntryRate]);

  // Update selected entry when selectedEntryId prop changes
  useEffect(() => {
    if (selectedEntryId) {
      const entry = state.entries.get(selectedEntryId);
      if (entry) {
        setSelectedEntry(entry);
      }
    } else {
      setSelectedEntry(null);
    }
  }, [selectedEntryId, state.entries]);

  // Render item function for virtualized list
  const renderItem = useCallback((entry: KBEntry, index: number) => (
    <EntryItem
      entry={entry}
      isSelected={selectedEntry?.id === entry.id}
      onSelect={handleEntrySelect}
      onRate={handleEntryRate}
      showUsageStats={showUsageStats}
      showCategories={showCategories}
      style={{ marginBottom: '0.5rem' }}
    />
  ), [selectedEntry, handleEntrySelect, handleEntryRate, showUsageStats, showCategories]);

  // Loading state
  if (state.isLoading) {
    return (
      <div 
        className={`kb-entry-list ${className}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '200px',
          color: '#6b7280',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📖</div>
          <div>Loading knowledge base entries...</div>
        </div>
      </div>
    );
  }

  // Error state
  if (state.error) {
    return (
      <div 
        className={`kb-entry-list ${className}`}
        style={{
          padding: '1rem',
          border: '1px solid #fecaca',
          borderRadius: '8px',
          backgroundColor: '#fef2f2',
          color: '#991b1b',
        }}
        role="alert"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '1.25rem' }}>⚠️</span>
          <strong>Error Loading Entries</strong>
        </div>
        <p style={{ margin: 0, fontSize: '0.875rem' }}>
          {state.error}
        </p>
      </div>
    );
  }

  // Empty state
  if (displayEntries.length === 0) {
    const isSearching = searchState.isSearching;
    const hasQuery = searchState.query.length > 0;

    return (
      <div 
        className={`kb-entry-list ${className}`}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '200px',
          padding: '2rem',
          color: '#6b7280',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>
          {isSearching ? '🔍' : hasQuery ? '📭' : '📚'}
        </div>
        <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.125rem', color: '#374151' }}>
          {isSearching ? 'Searching...' : hasQuery ? 'No Results Found' : 'No Entries Available'}
        </h3>
        <p style={{ margin: 0, fontSize: '0.875rem', maxWidth: '300px', lineHeight: '1.5' }}>
          {isSearching 
            ? 'Searching through the knowledge base...' 
            : hasQuery 
            ? `No entries found for "${searchState.query}". Try different keywords or check your spelling.`
            : 'The knowledge base is empty. Add some entries to get started.'
          }
        </p>
      </div>
    );
  }

  // Main list render
  return (
    <div className={`kb-entry-list ${className}`}>
      {/* List Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '1rem',
        padding: '0 0.5rem',
      }}>
        <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
          {displayEntries.length} {displayEntries.length === 1 ? 'entry' : 'entries'}
          {searchState.query && ` found for "${searchState.query}"`}
        </div>
        
        {state.totalEntries !== displayEntries.length && (
          <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
            Showing {displayEntries.length} of {state.totalEntries}
          </div>
        )}
      </div>

      {/* Entry List */}
      {enableVirtualization && displayEntries.length > 20 ? (
        <VirtualList
          items={displayEntries}
          itemHeight={(index, entry) => {
            // Calculate dynamic height based on content
            const baseHeight = 120;
            const tagsHeight = entry.tags?.length > 3 ? 40 : 20;
            const problemHeight = entry.problem.length > 200 ? 80 : 40;
            return baseHeight + tagsHeight + problemHeight;
          }}
          height={maxHeight}
          className="virtualized-kb-entry-list"
        >
          {({ item: entry, index, style }) => (
            <div style={{ ...style, padding: '0.5rem 0' }}>
              <EntryItem
                entry={entry}
                isSelected={selectedEntry?.id === entry.id}
                onSelect={handleEntrySelect}
                onRate={handleEntryRate}
                showUsageStats={showUsageStats}
                showCategories={showCategories}
              />
            </div>
          )}
        </VirtualList>
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            maxHeight,
            overflowY: 'auto',
          }}
        >
          {displayEntries.map((entry) => (
            <EntryItem
              key={entry.id}
              entry={entry}
              isSelected={selectedEntry?.id === entry.id}
              onSelect={handleEntrySelect}
              onRate={handleEntryRate}
              showUsageStats={showUsageStats}
              showCategories={showCategories}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default KBEntryList;