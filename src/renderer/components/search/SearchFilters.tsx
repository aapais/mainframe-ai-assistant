import React, { useState, useCallback, useMemo, memo, useEffect } from 'react';
import { SearchOptions, KBEntry, KBCategory } from '../../../types/services';
import './SearchFilters.css';

interface SavedFilterSet {
  id: string;
  name: string;
  filters: Partial<SearchOptions>;
  created: Date;
  lastUsed?: Date;
  useCount: number;
}

interface SearchFiltersProps {
  options: SearchOptions;
  onChange: (filters: Partial<SearchOptions>) => void;
  entries: KBEntry[];
  resultCount: number;
  className?: string;
  onPreview?: (filters: Partial<SearchOptions>) => void;
  previewEnabled?: boolean;
}

interface FilterStats {
  categories: Array<{ category: KBCategory; count: number; percentage: number }>;
  popularTags: Array<{ tag: string; count: number; percentage: number }>;
  dateRanges: Array<{ label: string; count: number; days: number }>;
  usageRanges: Array<{ label: string; count: number; min: number; max?: number }>;
}

/**
 * Search Filters Component
 * 
 * Features:
 * - Category filtering with counts
 * - Tag-based filtering with popularity
 * - Date range filtering
 * - Usage and success rate filtering
 * - Quick preset filters
 * - Responsive collapsible design
 */
export const SearchFilters = memo<SearchFiltersProps>(({
  options,
  onChange,
  entries,
  resultCount,
  className = '',
  onPreview,
  previewEnabled = false
}) => {
  const [expanded, setExpanded] = useState(false);
  const [tagSearchQuery, setTagSearchQuery] = useState('');
  const [savedFilterSets, setSavedFilterSets] = useState<SavedFilterSet[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [newFilterSetName, setNewFilterSetName] = useState('');
  const [previewFilters, setPreviewFilters] = useState<Partial<SearchOptions> | null>(null);

  // Calculate filter statistics with expensive computation memoization
  const stats = useMemo<FilterStats>(() => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Category statistics
    const categoryStats = new Map<KBCategory, number>();
    entries.forEach(entry => {
      const current = categoryStats.get(entry.category as KBCategory) || 0;
      categoryStats.set(entry.category as KBCategory, current + 1);
    });

    const categories = Array.from(categoryStats.entries())
      .map(([category, count]) => ({
        category,
        count,
        percentage: (count / entries.length) * 100
      }))
      .sort((a, b) => b.count - a.count);

    // Tag statistics
    const tagStats = new Map<string, number>();
    entries.forEach(entry => {
      entry.tags.forEach(tag => {
        const current = tagStats.get(tag) || 0;
        tagStats.set(tag, current + 1);
      });
    });

    const popularTags = Array.from(tagStats.entries())
      .map(([tag, count]) => ({
        tag,
        count,
        percentage: (count / entries.length) * 100
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20); // Top 20 tags

    // Date range statistics
    const dateRanges = [
      {
        label: 'Last 24 hours',
        count: entries.filter(e => new Date(e.created_at) >= oneDayAgo).length,
        days: 1
      },
      {
        label: 'Last 7 days',
        count: entries.filter(e => new Date(e.created_at) >= sevenDaysAgo).length,
        days: 7
      },
      {
        label: 'Last 30 days',
        count: entries.filter(e => new Date(e.created_at) >= thirtyDaysAgo).length,
        days: 30
      },
      {
        label: 'Older',
        count: entries.filter(e => new Date(e.created_at) < thirtyDaysAgo).length,
        days: 999
      }
    ];

    // Usage range statistics
    const usageRanges = [
      {
        label: 'Never used',
        count: entries.filter(e => e.usage_count === 0).length,
        min: 0,
        max: 0
      },
      {
        label: '1-5 times',
        count: entries.filter(e => e.usage_count >= 1 && e.usage_count <= 5).length,
        min: 1,
        max: 5
      },
      {
        label: '6-20 times',
        count: entries.filter(e => e.usage_count >= 6 && e.usage_count <= 20).length,
        min: 6,
        max: 20
      },
      {
        label: '20+ times',
        count: entries.filter(e => e.usage_count > 20).length,
        min: 21
      }
    ];

    return { categories, popularTags, dateRanges, usageRanges };
  }, [entries]);

  // Filter available tags based on search query
  const filteredTags = useMemo(() => {
    if (!tagSearchQuery.trim()) return stats.popularTags;
    
    const query = tagSearchQuery.toLowerCase();
    return stats.popularTags.filter(({ tag }) => 
      tag.toLowerCase().includes(query)
    );
  }, [stats.popularTags, tagSearchQuery]);

  // Handle category filter
  const handleCategoryChange = useCallback((category: KBCategory | undefined) => {
    onChange({ category });
  }, [onChange]);

  // Handle tag filter
  const handleTagsChange = useCallback((tags: string[]) => {
    onChange({ tags: tags.length > 0 ? tags : undefined });
  }, [onChange]);

  // Handle tag toggle
  const handleTagToggle = useCallback((tag: string) => {
    const currentTags = options.tags || [];
    const newTags = currentTags.includes(tag)
      ? currentTags.filter(t => t !== tag)
      : [...currentTags, tag];
    
    handleTagsChange(newTags);
  }, [options.tags, handleTagsChange]);

  // Handle threshold change
  const handleThresholdChange = useCallback((threshold: number) => {
    onChange({ threshold: threshold / 100 });
  }, [onChange]);

  // Load saved filter sets from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('kb-saved-filter-sets');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSavedFilterSets(parsed.map((set: any) => ({
          ...set,
          created: new Date(set.created),
          lastUsed: set.lastUsed ? new Date(set.lastUsed) : undefined
        })));
      } catch (error) {
        console.warn('Failed to load saved filter sets:', error);
      }
    }
  }, []);

  // Save filter sets to localStorage
  const saveFilterSetsToStorage = useCallback((sets: SavedFilterSet[]) => {
    localStorage.setItem('kb-saved-filter-sets', JSON.stringify(sets));
  }, []);

  // Clear all filters
  const clearAllFilters = useCallback(() => {
    const clearedFilters = {
      category: undefined,
      tags: undefined,
      threshold: 0.1,
      sortBy: 'relevance',
      sortOrder: 'desc'
    };
    setPreviewFilters(null);
    onChange(clearedFilters);
  }, [onChange]);

  // Save current filters as a set
  const saveCurrentFilters = useCallback(() => {
    if (!newFilterSetName.trim()) return;

    const newFilterSet: SavedFilterSet = {
      id: Date.now().toString(),
      name: newFilterSetName.trim(),
      filters: {
        category: options.category,
        tags: options.tags,
        threshold: options.threshold,
        sortBy: options.sortBy,
        sortOrder: options.sortOrder
      },
      created: new Date(),
      useCount: 0
    };

    const updatedSets = [...savedFilterSets, newFilterSet];
    setSavedFilterSets(updatedSets);
    saveFilterSetsToStorage(updatedSets);
    setNewFilterSetName('');
    setShowSaveDialog(false);
  }, [newFilterSetName, options, savedFilterSets, saveFilterSetsToStorage]);

  // Load a saved filter set
  const loadFilterSet = useCallback((filterSet: SavedFilterSet) => {
    // Update use count and last used
    const updatedSets = savedFilterSets.map(set =>
      set.id === filterSet.id
        ? { ...set, useCount: set.useCount + 1, lastUsed: new Date() }
        : set
    );
    setSavedFilterSets(updatedSets);
    saveFilterSetsToStorage(updatedSets);

    // Apply filters
    onChange(filterSet.filters);
  }, [savedFilterSets, saveFilterSetsToStorage, onChange]);

  // Delete a saved filter set
  const deleteFilterSet = useCallback((filterSetId: string) => {
    const updatedSets = savedFilterSets.filter(set => set.id !== filterSetId);
    setSavedFilterSets(updatedSets);
    saveFilterSetsToStorage(updatedSets);
  }, [savedFilterSets, saveFilterSetsToStorage]);

  // Preview filters (if enabled)
  const handlePreview = useCallback((filters: Partial<SearchOptions>) => {
    if (previewEnabled && onPreview) {
      setPreviewFilters(filters);
      onPreview(filters);
    }
  }, [previewEnabled, onPreview]);

  // Cancel preview
  const cancelPreview = useCallback(() => {
    setPreviewFilters(null);
    if (previewEnabled && onPreview) {
      onPreview(options);
    }
  }, [previewEnabled, onPreview, options]);

  // Apply preview
  const applyPreview = useCallback(() => {
    if (previewFilters) {
      onChange(previewFilters);
      setPreviewFilters(null);
    }
  }, [previewFilters, onChange]);

  // Quick filter presets
  const quickFilters = [
    {
      label: 'Most Popular',
      icon: '🔥',
      filters: { sortBy: 'usage' as const, sortOrder: 'desc' as const }
    },
    {
      label: 'Highest Success',
      icon: '✅',
      filters: { sortBy: 'success_rate' as const, sortOrder: 'desc' as const }
    },
    {
      label: 'Recent',
      icon: '📅',
      filters: { sortBy: 'recent' as const, sortOrder: 'desc' as const }
    },
    {
      label: 'High Quality',
      icon: '⭐',
      filters: { threshold: 0.7, sortBy: 'score' as const }
    }
  ];

  // Check if any filters are active
  const hasActiveFilters = options.category || 
    (options.tags && options.tags.length > 0) || 
    (options.threshold && options.threshold > 0.1);

  return (
    <div className={`search-filters ${expanded ? 'expanded' : ''} ${className}`}>
      <div className="search-filters__header">
        <div className="search-filters__title">
          <button
            className="search-filters__toggle"
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
            aria-label={expanded ? 'Collapse filters' : 'Expand filters'}
          >
            <span className="icon">🔽</span>
            <span className="text">Filters</span>
            {hasActiveFilters && <span className="active-indicator" />}
          </button>
          
          <span className="search-filters__count">
            {resultCount} result{resultCount !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="search-filters__actions">
          <div className="search-filters__quick">
            {quickFilters.map(filter => (
              <button
                key={filter.label}
                className="btn btn--quick-filter"
                onClick={() => onChange(filter.filters)}
                onMouseEnter={() => previewEnabled && handlePreview(filter.filters)}
                onMouseLeave={() => previewEnabled && cancelPreview()}
                title={filter.label}
              >
                <span className="icon">{filter.icon}</span>
                <span className="text">{filter.label}</span>
              </button>
            ))}
          </div>

          {hasActiveFilters && (
            <button
              className="btn btn--save-filters"
              onClick={() => setShowSaveDialog(true)}
              title="Save current filter set"
            >
              <span className="icon">💾</span>
              <span className="text">Save</span>
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="search-filters__content">
          {/* Saved Filter Sets */}
          {savedFilterSets.length > 0 && (
            <div className="search-filters__section">
              <div className="filter-section">
                <h3 className="filter-section__title">
                  <span className="icon">💾</span>
                  Saved Filter Sets
                </h3>

                <div className="saved-filter-sets">
                  {savedFilterSets
                    .sort((a, b) => (b.lastUsed || b.created).getTime() - (a.lastUsed || a.created).getTime())
                    .slice(0, 5)
                    .map(filterSet => (
                    <div key={filterSet.id} className="saved-filter-set">
                      <button
                        className="saved-filter-set__load"
                        onClick={() => loadFilterSet(filterSet)}
                        onMouseEnter={() => previewEnabled && handlePreview(filterSet.filters)}
                        onMouseLeave={() => previewEnabled && cancelPreview()}
                        title={`Load "${filterSet.name}" filter set`}
                      >
                        <div className="saved-filter-set__name">{filterSet.name}</div>
                        <div className="saved-filter-set__meta">
                          <span className="usage-count">Used {filterSet.useCount} times</span>
                          {filterSet.lastUsed && (
                            <span className="last-used">
                              Last: {filterSet.lastUsed.toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        <div className="saved-filter-set__preview">
                          {filterSet.filters.category && (
                            <span className="filter-preview filter-preview--category">
                              {filterSet.filters.category}
                            </span>
                          )}
                          {filterSet.filters.tags && filterSet.filters.tags.length > 0 && (
                            <span className="filter-preview filter-preview--tags">
                              {filterSet.filters.tags.length} tag{filterSet.filters.tags.length > 1 ? 's' : ''}
                            </span>
                          )}
                          {filterSet.filters.threshold && filterSet.filters.threshold > 0.1 && (
                            <span className="filter-preview filter-preview--threshold">
                              {Math.round(filterSet.filters.threshold * 100)}% min
                            </span>
                          )}
                        </div>
                      </button>
                      <button
                        className="saved-filter-set__delete"
                        onClick={() => deleteFilterSet(filterSet.id)}
                        title="Delete filter set"
                      >
                        🗑️
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Preview Banner */}
          {previewFilters && (
            <div className="search-filters__preview">
              <div className="preview-banner">
                <div className="preview-banner__content">
                  <span className="preview-banner__icon">👁️</span>
                  <span className="preview-banner__text">
                    Previewing filter changes - {resultCount} results would be shown
                  </span>
                </div>
                <div className="preview-banner__actions">
                  <button
                    className="btn btn--small btn--primary"
                    onClick={applyPreview}
                  >
                    Apply
                  </button>
                  <button
                    className="btn btn--small btn--secondary"
                    onClick={cancelPreview}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="search-filters__section">
            <div className="filter-section">
              <h3 className="filter-section__title">
                <span className="icon">📁</span>
                Categories
              </h3>
              
              <div className="filter-options">
                <button
                  className={`filter-option ${!options.category ? 'active' : ''}`}
                  onClick={() => handleCategoryChange(undefined)}
                >
                  <span className="filter-option__label">All Categories</span>
                  <span className="filter-option__count">{entries.length}</span>
                </button>
                
                {stats.categories.map(({ category, count, percentage }) => (
                  <button
                    key={category}
                    className={`filter-option ${options.category === category ? 'active' : ''}`}
                    onClick={() => handleCategoryChange(category)}
                  >
                    <span className="filter-option__label">{category}</span>
                    <span className="filter-option__count">{count}</span>
                    <div 
                      className="filter-option__bar"
                      style={{ width: `${Math.max(5, percentage)}%` }}
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="search-filters__section">
            <div className="filter-section">
              <h3 className="filter-section__title">
                <span className="icon">🏷️</span>
                Tags
              </h3>
              
              <div className="tag-search">
                <input
                  type="text"
                  placeholder="Search tags..."
                  value={tagSearchQuery}
                  onChange={(e) => setTagSearchQuery(e.target.value)}
                  className="tag-search__input"
                />
              </div>

              {options.tags && options.tags.length > 0 && (
                <div className="selected-tags">
                  <div className="selected-tags__label">Selected:</div>
                  <div className="selected-tags__list">
                    {options.tags.map(tag => (
                      <span key={tag} className="tag tag--selected">
                        {tag}
                        <button
                          className="tag__remove"
                          onClick={() => handleTagToggle(tag)}
                          aria-label={`Remove ${tag} filter`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="tag-cloud">
                {filteredTags.slice(0, 15).map(({ tag, count }) => (
                  <button
                    key={tag}
                    className={`tag tag--clickable ${
                      options.tags?.includes(tag) ? 'tag--active' : ''
                    }`}
                    onClick={() => handleTagToggle(tag)}
                    title={`${count} entries`}
                  >
                    {tag}
                    <span className="tag__count">{count}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="search-filters__section">
            <div className="filter-section">
              <h3 className="filter-section__title">
                <span className="icon">🎯</span>
                Match Quality
              </h3>
              
              <div className="threshold-slider">
                <label className="threshold-slider__label">
                  Minimum match score: {Math.round((options.threshold || 0.1) * 100)}%
                </label>
                <input
                  type="range"
                  min="10"
                  max="90"
                  step="5"
                  value={Math.round((options.threshold || 0.1) * 100)}
                  onChange={(e) => handleThresholdChange(parseInt(e.target.value))}
                  className="threshold-slider__input"
                />
                <div className="threshold-slider__labels">
                  <span>Lower quality</span>
                  <span>Higher quality</span>
                </div>
              </div>
            </div>
          </div>

          <div className="search-filters__section">
            <div className="filter-section">
              <h3 className="filter-section__title">
                <span className="icon">📊</span>
                Statistics
              </h3>
              
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-card__label">Total Entries</div>
                  <div className="stat-card__value">{entries.length}</div>
                </div>
                
                <div className="stat-card">
                  <div className="stat-card__label">Categories</div>
                  <div className="stat-card__value">{stats.categories.length}</div>
                </div>
                
                <div className="stat-card">
                  <div className="stat-card__label">Unique Tags</div>
                  <div className="stat-card__value">{stats.popularTags.length}</div>
                </div>
                
                <div className="stat-card">
                  <div className="stat-card__label">Avg Usage</div>
                  <div className="stat-card__value">
                    {Math.round(entries.reduce((sum, e) => sum + e.usage_count, 0) / entries.length)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {hasActiveFilters && (
            <div className="search-filters__actions">
              <button
                className="btn btn--secondary"
                onClick={clearAllFilters}
              >
                <span className="icon">🗑️</span>
                Clear All Filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* Save Filter Dialog */}
      {showSaveDialog && (
        <div className="save-filter-dialog-overlay">
          <div className="save-filter-dialog">
            <div className="save-filter-dialog__header">
              <h3>Save Filter Set</h3>
              <button
                className="close-button"
                onClick={() => {
                  setShowSaveDialog(false);
                  setNewFilterSetName('');
                }}
              >
                ×
              </button>
            </div>
            <div className="save-filter-dialog__content">
              <div className="form-group">
                <label htmlFor="filter-set-name">Filter Set Name</label>
                <input
                  id="filter-set-name"
                  type="text"
                  placeholder="My custom filters..."
                  value={newFilterSetName}
                  onChange={(e) => setNewFilterSetName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newFilterSetName.trim()) {
                      saveCurrentFilters();
                    }
                    if (e.key === 'Escape') {
                      setShowSaveDialog(false);
                      setNewFilterSetName('');
                    }
                  }}
                  autoFocus
                />
              </div>
              <div className="current-filters-preview">
                <h4>Current Filters:</h4>
                <div className="filter-chips">
                  {options.category && (
                    <span className="filter-chip filter-chip--category">
                      Category: {options.category}
                    </span>
                  )}
                  {options.tags && options.tags.length > 0 && (
                    <span className="filter-chip filter-chip--tags">
                      Tags: {options.tags.join(', ')}
                    </span>
                  )}
                  {options.threshold && options.threshold > 0.1 && (
                    <span className="filter-chip filter-chip--threshold">
                      Min Score: {Math.round(options.threshold * 100)}%
                    </span>
                  )}
                  {options.sortBy !== 'relevance' && (
                    <span className="filter-chip filter-chip--sort">
                      Sort: {options.sortBy} ({options.sortOrder})
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="save-filter-dialog__actions">
              <button
                className="btn btn--secondary"
                onClick={() => {
                  setShowSaveDialog(false);
                  setNewFilterSetName('');
                }}
              >
                Cancel
              </button>
              <button
                className="btn btn--primary"
                onClick={saveCurrentFilters}
                disabled={!newFilterSetName.trim()}
              >
                Save Filter Set
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

SearchFilters.displayName = 'SearchFilters';

export default SearchFilters;