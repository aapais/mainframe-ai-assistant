/**
 * Category Filters Component
 *
 * Interactive category filters with visual indicators, counters, and
 * enhanced accessibility for efficient KB browsing.
 *
 * Features:
 * - Visual filter chips with counters and status indicators
 * - Quick filter presets (All, Recent, Popular, System)
 * - Active filter state management with clear affordances
 * - Search-based filter suggestions
 * - Bulk filter operations (select all, clear all, invert)
 * - Keyboard navigation and ARIA support
 * - Responsive collapse for mobile devices
 *
 * @author Swarm Navigation Team
 * @version 1.0.0
 */

import React, { useState, useCallback, useMemo, useRef, memo } from 'react';
import { XMarkIcon, FunnelIcon, ChevronDownIcon, MagnifyingGlassIcon } from '../icons/NavigationIcons';
import { useKeyboardNavigation } from '../../hooks/useKeyboardNavigation';
import './CategoryFilters.css';

// ========================
// TYPES & INTERFACES
// ========================

export interface FilterOption {
  id: string;
  label: string;
  value: string;
  count: number;
  active: boolean;
  color?: string;
  icon?: React.ReactNode;
  description?: string;
  metadata?: {
    trending?: boolean;
    system?: boolean;
    recent?: boolean;
    popular?: boolean;
  };
}

export interface FilterPreset {
  id: string;
  label: string;
  icon?: React.ReactNode;
  description: string;
  filters: string[];
  shortcut?: string;
}

export interface CategoryFiltersProps {
  className?: string;
  /** Available filter options */
  options: FilterOption[];
  /** Active filter IDs */
  activeFilters: string[];
  /** Filter presets */
  presets?: FilterPreset[];
  /** Enable search in filters */
  enableSearch?: boolean;
  /** Enable bulk operations */
  enableBulkOps?: boolean;
  /** Show filter counts */
  showCounts?: boolean;
  /** Show trending indicators */
  showTrending?: boolean;
  /** Maximum visible filters before collapse */
  maxVisible?: number;
  /** Responsive behavior */
  responsive?: boolean;
  /** Loading state */
  loading?: boolean;
  /** Event handlers */
  onFilterChange?: (filterId: string, active: boolean) => void;
  onFiltersChange?: (activeFilters: string[]) => void;
  onPresetApply?: (preset: FilterPreset) => void;
  onFilterSearch?: (query: string) => void;
  onClearAll?: () => void;
  onSelectAll?: () => void;
  /** Accessibility */
  ariaLabel?: string;
  announceChanges?: boolean;
}

// ========================
// FILTER PRESETS
// ========================

const DEFAULT_PRESETS: FilterPreset[] = [
  {
    id: 'all',
    label: 'All',
    description: 'Show all categories',
    filters: [],
    shortcut: 'Ctrl+1'
  },
  {
    id: 'recent',
    label: 'Recent',
    description: 'Recently added or updated',
    filters: ['recent'],
    shortcut: 'Ctrl+2'
  },
  {
    id: 'popular',
    label: 'Popular',
    description: 'Most accessed categories',
    filters: ['popular'],
    shortcut: 'Ctrl+3'
  },
  {
    id: 'system',
    label: 'System',
    description: 'System-defined categories',
    filters: ['system'],
    shortcut: 'Ctrl+4'
  }
];

// ========================
// FILTER CHIP COMPONENT
// ========================

interface FilterChipProps {
  option: FilterOption;
  active: boolean;
  showCount: boolean;
  showTrending: boolean;
  onClick: (option: FilterOption) => void;
  onRemove?: (option: FilterOption) => void;
}

const FilterChip = memo<FilterChipProps>(({
  option,
  active,
  showCount,
  showTrending,
  onClick,
  onRemove
}) => {
  const handleClick = useCallback(() => {
    onClick(option);
  }, [option, onClick]);

  const handleRemove = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    onRemove?.(option);
  }, [option, onRemove]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'Enter':
      case ' ':
        event.preventDefault();
        onClick(option);
        break;
      case 'Backspace':
      case 'Delete':
        if (active && onRemove) {
          event.preventDefault();
          onRemove(option);
        }
        break;
    }
  }, [option, active, onClick, onRemove]);

  return (
    <button
      type="button"
      className={`filter-chip ${active ? 'active' : ''} ${option.metadata?.system ? 'system' : ''}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-pressed={active}
      aria-describedby={option.description ? `filter-desc-${option.id}` : undefined}
      data-filter-id={option.id}
      style={{ '--filter-color': option.color } as React.CSSProperties}
    >
      {/* Icon */}
      {option.icon && (
        <span className="filter-chip-icon" aria-hidden="true">
          {option.icon}
        </span>
      )}

      {/* Label */}
      <span className="filter-chip-label">
        {option.label}
      </span>

      {/* Count Badge */}
      {showCount && (
        <span className="filter-chip-count" title={`${option.count} items`}>
          {option.count}
        </span>
      )}

      {/* Trending Indicator */}
      {showTrending && option.metadata?.trending && (
        <span className="filter-chip-trending" title="Trending category" aria-label="Trending">
          📈
        </span>
      )}

      {/* Remove Button */}
      {active && onRemove && (
        <button
          type="button"
          className="filter-chip-remove"
          onClick={handleRemove}
          aria-label={`Remove ${option.label} filter`}
        >
          <XMarkIcon className="w-3 h-3" />
        </button>
      )}

      {/* Hidden description for screen readers */}
      {option.description && (
        <span id={`filter-desc-${option.id}`} className="sr-only">
          {option.description}
        </span>
      )}
    </button>
  );
});

FilterChip.displayName = 'FilterChip';

// ========================
// FILTER SEARCH COMPONENT
// ========================

interface FilterSearchProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  placeholder?: string;
}

const FilterSearch = memo<FilterSearchProps>(({
  searchQuery,
  onSearchChange,
  placeholder = 'Search filters...'
}) => {
  const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    onSearchChange(event.target.value);
  }, [onSearchChange]);

  const handleClear = useCallback(() => {
    onSearchChange('');
  }, [onSearchChange]);

  return (
    <div className="filter-search">
      <div className="filter-search-input-container">
        <MagnifyingGlassIcon className="filter-search-icon" />
        <input
          type="text"
          className="filter-search-input"
          placeholder={placeholder}
          value={searchQuery}
          onChange={handleChange}
          aria-label="Search category filters"
        />
        {searchQuery && (
          <button
            type="button"
            className="filter-search-clear"
            onClick={handleClear}
            aria-label="Clear search"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
});

FilterSearch.displayName = 'FilterSearch';

// ========================
// MAIN COMPONENT
// ========================

export const CategoryFilters: React.FC<CategoryFiltersProps> = memo(({
  className = '',
  options = [],
  activeFilters = [],
  presets = DEFAULT_PRESETS,
  enableSearch = true,
  enableBulkOps = true,
  showCounts = true,
  showTrending = true,
  maxVisible = 8,
  responsive = true,
  loading = false,
  onFilterChange,
  onFiltersChange,
  onPresetApply,
  onFilterSearch,
  onClearAll,
  onSelectAll,
  ariaLabel = 'Category filters',
  announceChanges = true
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expanded, setExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter options based on search
  const filteredOptions = useMemo(() => {
    if (!searchQuery) return options;

    const query = searchQuery.toLowerCase();
    return options.filter(option =>
      option.label.toLowerCase().includes(query) ||
      option.description?.toLowerCase().includes(query) ||
      option.value.toLowerCase().includes(query)
    );
  }, [options, searchQuery]);

  // Separate active and inactive filters
  const { activeOptions, inactiveOptions } = useMemo(() => {
    const activeIds = new Set(activeFilters);
    const active = filteredOptions.filter(option => activeIds.has(option.id));
    const inactive = filteredOptions.filter(option => !activeIds.has(option.id));
    return { activeOptions: active, inactiveOptions: inactive };
  }, [filteredOptions, activeFilters]);

  // Determine visible options for responsive behavior
  const { visibleOptions, hasMore } = useMemo(() => {
    if (expanded || !responsive) {
      return { visibleOptions: inactiveOptions, hasMore: false };
    }

    const visible = inactiveOptions.slice(0, maxVisible - activeOptions.length);
    const more = inactiveOptions.length > visible.length;
    return { visibleOptions: visible, hasMore: more };
  }, [inactiveOptions, expanded, responsive, maxVisible, activeOptions.length]);

  // Keyboard navigation
  const { focusedIndex, handleKeyDown } = useKeyboardNavigation({
    itemCount: activeOptions.length + visibleOptions.length,
    orientation: 'horizontal',
    wrap: true
  });

  // Handle filter toggle
  const handleFilterToggle = useCallback((option: FilterOption) => {
    const isActive = activeFilters.includes(option.id);
    const newActiveFilters = isActive
      ? activeFilters.filter(id => id !== option.id)
      : [...activeFilters, option.id];

    onFilterChange?.(option.id, !isActive);
    onFiltersChange?.(newActiveFilters);

    // Announce change for accessibility
    if (announceChanges) {
      const action = isActive ? 'removed' : 'added';
      const announcement = document.createElement('div');
      announcement.setAttribute('aria-live', 'polite');
      announcement.textContent = `Filter ${option.label} ${action}`;
      document.body.appendChild(announcement);
      setTimeout(() => document.body.removeChild(announcement), 1000);
    }
  }, [activeFilters, onFilterChange, onFiltersChange, announceChanges]);

  // Handle filter removal
  const handleFilterRemove = useCallback((option: FilterOption) => {
    const newActiveFilters = activeFilters.filter(id => id !== option.id);
    onFilterChange?.(option.id, false);
    onFiltersChange?.(newActiveFilters);
  }, [activeFilters, onFilterChange, onFiltersChange]);

  // Handle preset application
  const handlePresetApply = useCallback((preset: FilterPreset) => {
    onPresetApply?.(preset);
    onFiltersChange?.(preset.filters);
  }, [onPresetApply, onFiltersChange]);

  // Handle search
  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
    onFilterSearch?.(query);
  }, [onFilterSearch]);

  // Handle bulk operations
  const handleClearAll = useCallback(() => {
    onClearAll?.();
    onFiltersChange?.([]);
  }, [onClearAll, onFiltersChange]);

  const handleSelectAll = useCallback(() => {
    const allIds = options.map(option => option.id);
    onSelectAll?.();
    onFiltersChange?.(allIds);
  }, [options, onSelectAll, onFiltersChange]);

  // Handle expand/collapse
  const handleToggleExpanded = useCallback(() => {
    setExpanded(prev => !prev);
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className={`category-filters loading ${className}`} aria-label={ariaLabel}>
        <div className="filters-skeleton">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="filter-chip-skeleton" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`category-filters ${expanded ? 'expanded' : ''} ${className}`}
      role="region"
      aria-label={ariaLabel}
    >
      {/* Filter Header */}
      <div className="filters-header">
        <div className="filters-title">
          <FunnelIcon className="w-4 h-4" />
          <span>Filters</span>
          {activeFilters.length > 0 && (
            <span className="active-count">({activeFilters.length})</span>
          )}
        </div>

        {/* Bulk Operations */}
        {enableBulkOps && (
          <div className="filters-actions">
            {activeFilters.length > 0 && (
              <button
                type="button"
                className="filters-action-btn"
                onClick={handleClearAll}
                aria-label="Clear all filters"
              >
                Clear All
              </button>
            )}
            <button
              type="button"
              className="filters-action-btn"
              onClick={handleSelectAll}
              aria-label="Select all filters"
            >
              Select All
            </button>
          </div>
        )}
      </div>

      {/* Filter Search */}
      {enableSearch && (
        <FilterSearch
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
        />
      )}

      {/* Filter Presets */}
      {presets.length > 0 && (
        <div className="filter-presets" role="group" aria-label="Filter presets">
          {presets.map(preset => (
            <button
              key={preset.id}
              type="button"
              className="filter-preset"
              onClick={() => handlePresetApply(preset)}
              title={preset.description}
              aria-describedby={`preset-desc-${preset.id}`}
            >
              {preset.icon}
              <span>{preset.label}</span>
              {preset.shortcut && (
                <span className="preset-shortcut">{preset.shortcut}</span>
              )}
              <span id={`preset-desc-${preset.id}`} className="sr-only">
                {preset.description}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Active Filters */}
      {activeOptions.length > 0 && (
        <div className="active-filters" role="group" aria-label="Active filters">
          <h4 className="filter-group-title">Active</h4>
          <div className="filter-chips">
            {activeOptions.map(option => (
              <FilterChip
                key={option.id}
                option={option}
                active={true}
                showCount={showCounts}
                showTrending={showTrending}
                onClick={handleFilterToggle}
                onRemove={handleFilterRemove}
              />
            ))}
          </div>
        </div>
      )}

      {/* Available Filters */}
      {visibleOptions.length > 0 && (
        <div className="available-filters" role="group" aria-label="Available filters">
          <h4 className="filter-group-title">Available</h4>
          <div className="filter-chips">
            {visibleOptions.map(option => (
              <FilterChip
                key={option.id}
                option={option}
                active={false}
                showCount={showCounts}
                showTrending={showTrending}
                onClick={handleFilterToggle}
              />
            ))}
          </div>

          {/* Expand/Collapse Button */}
          {hasMore && responsive && (
            <button
              type="button"
              className="filters-expand-btn"
              onClick={handleToggleExpanded}
              aria-expanded={expanded}
            >
              <span>{expanded ? 'Show Less' : `Show ${inactiveOptions.length - visibleOptions.length} More`}</span>
              <ChevronDownIcon className={`w-4 h-4 transform transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>
      )}

      {/* No Results */}
      {filteredOptions.length === 0 && searchQuery && (
        <div className="filters-no-results">
          <p>No filters match "{searchQuery}"</p>
          <button
            type="button"
            className="filters-clear-search"
            onClick={() => setSearchQuery('')}
          >
            Clear search
          </button>
        </div>
      )}

      {/* Screen Reader Announcements */}
      {announceChanges && (
        <div className="sr-only" aria-live="polite" aria-atomic="false">
          {activeFilters.length === 0 && 'No filters active'}
          {activeFilters.length === 1 && '1 filter active'}
          {activeFilters.length > 1 && `${activeFilters.length} filters active`}
        </div>
      )}
    </div>
  );
});

CategoryFilters.displayName = 'CategoryFilters';

export default CategoryFilters;