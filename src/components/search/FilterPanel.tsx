/**
 * FilterPanel - Advanced Collapsible Filtering Interface
 *
 * Provides comprehensive filtering capabilities with:
 * - Collapsible filter sections
 * - Multiple filter types (faceted, date range, tags, etc.)
 * - Real-time filter application
 * - URL persistence and sharing
 * - Filter presets and saved filters
 * - Accessibility compliant (WCAG 2.1 AA)
 *
 * @author Frontend Developer
 * @version 2.0.0
 */

import React, {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
  memo
} from 'react';
import {
  ChevronDown,
  ChevronUp,
  Filter,
  X,
  RotateCcw,
  Save,
  Share2,
  Settings,
  Search,
  Calendar,
  Tag,
  Layers,
  Target,
  Bookmark
} from 'lucide-react';
import { FacetedFilter } from './FacetedFilter';
import { DateRangeFilter } from './DateRangeFilter';
import { QueryBuilder } from './QueryBuilder';
import { FilterPresets } from './FilterPresets';

// ========================
// Types & Interfaces
// ========================

export interface FilterConfig {
  id: string;
  type: 'faceted' | 'date-range' | 'tags' | 'query' | 'custom';
  label: string;
  icon?: React.ReactNode;
  value: any;
  active: boolean;
  options?: FilterOption[];
  metadata?: Record<string, any>;
}

export interface FilterOption {
  label: string;
  value: any;
  count?: number;
  icon?: React.ReactNode;
  disabled?: boolean;
  description?: string;
}

export interface FilterSection {
  id: string;
  title: string;
  icon?: React.ReactNode;
  filters: string[];
  collapsed?: boolean;
  collapsible?: boolean;
  description?: string;
}

export interface FilterPanelProps {
  /** Filter configurations */
  filters: FilterConfig[];
  /** Filter sections for organization */
  sections?: FilterSection[];
  /** Callback when filters change */
  onFilterChange: (filterId: string, value: any, active?: boolean) => void;
  /** Callback to clear all filters */
  onClearFilters: () => void;
  /** Available filter presets */
  presets?: FilterPreset[];
  /** Callback when preset is selected */
  onPresetSelect?: (preset: FilterPreset) => void;
  /** Callback when saving current filters as preset */
  onPresetSave?: (name: string, filters: FilterConfig[]) => void;
  /** Callback when sharing filters */
  onShare?: (url: string) => void;
  /** Enable URL persistence */
  urlPersistence?: boolean;
  /** Custom CSS className */
  className?: string;
  /** Compact mode for mobile */
  compact?: boolean;
  /** Enable animation */
  animated?: boolean;
  /** Loading state */
  loading?: boolean;
  /** Available tags for autocomplete */
  availableTags?: string[];
  /** Custom query fields for QueryBuilder */
  queryFields?: QueryField[];
}

export interface FilterPreset {
  id: string;
  name: string;
  description?: string;
  filters: FilterConfig[];
  isDefault?: boolean;
  created?: Date;
  usage?: number;
}

export interface QueryField {
  id: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'multiselect';
  options?: { label: string; value: any }[];
  operators?: string[];
}

// ========================
// Default Configurations
// ========================

const DEFAULT_SECTIONS: FilterSection[] = [
  {
    id: 'primary',
    title: 'Primary Filters',
    icon: <Target size={16} />,
    filters: ['category', 'status', 'priority'],
    collapsed: false,
    collapsible: true,
    description: 'Main filtering criteria'
  },
  {
    id: 'temporal',
    title: 'Date & Time',
    icon: <Calendar size={16} />,
    filters: ['dateRange', 'lastModified', 'created'],
    collapsed: false,
    collapsible: true,
    description: 'Time-based filtering'
  },
  {
    id: 'metadata',
    title: 'Tags & Metadata',
    icon: <Tag size={16} />,
    filters: ['tags', 'author', 'difficulty'],
    collapsed: true,
    collapsible: true,
    description: 'Additional metadata filters'
  },
  {
    id: 'advanced',
    title: 'Advanced Query',
    icon: <Search size={16} />,
    filters: ['queryBuilder'],
    collapsed: true,
    collapsible: true,
    description: 'Complex query construction'
  }
];

const DEFAULT_QUERY_FIELDS: QueryField[] = [
  {
    id: 'title',
    label: 'Title',
    type: 'text',
    operators: ['contains', 'equals', 'starts_with', 'ends_with']
  },
  {
    id: 'content',
    label: 'Content',
    type: 'text',
    operators: ['contains', 'equals', 'not_contains']
  },
  {
    id: 'category',
    label: 'Category',
    type: 'select',
    options: [
      { label: 'VSAM', value: 'vsam' },
      { label: 'JCL', value: 'jcl' },
      { label: 'COBOL', value: 'cobol' },
      { label: 'DB2', value: 'db2' },
      { label: 'System', value: 'system' }
    ],
    operators: ['equals', 'not_equals', 'in']
  },
  {
    id: 'difficulty',
    label: 'Difficulty',
    type: 'number',
    operators: ['equals', 'greater_than', 'less_than', 'between']
  },
  {
    id: 'tags',
    label: 'Tags',
    type: 'multiselect',
    operators: ['contains_any', 'contains_all', 'not_contains']
  }
];

// ========================
// URL Persistence Utilities
// ========================

const serializeFiltersToURL = (filters: FilterConfig[]): string => {
  const activeFilters = filters.filter(f => f.active);
  const filterParams = activeFilters.reduce((acc, filter) => {
    acc[filter.id] = JSON.stringify(filter.value);
    return acc;
  }, {} as Record<string, string>);

  const params = new URLSearchParams(filterParams);
  return params.toString();
};

const deserializeFiltersFromURL = (urlParams: string, availableFilters: FilterConfig[]): FilterConfig[] => {
  const params = new URLSearchParams(urlParams);
  const updatedFilters = [...availableFilters];

  params.forEach((value, key) => {
    const filterIndex = updatedFilters.findIndex(f => f.id === key);
    if (filterIndex !== -1) {
      try {
        updatedFilters[filterIndex] = {
          ...updatedFilters[filterIndex],
          value: JSON.parse(value),
          active: true
        };
      } catch (error) {
        console.warn(`Failed to parse URL filter value for ${key}:`, error);
      }
    }
  });

  return updatedFilters;
};

// ========================
// Filter Section Component
// ========================

const FilterSectionComponent = memo<{
  section: FilterSection;
  filters: FilterConfig[];
  isCollapsed: boolean;
  onToggleCollapse: (sectionId: string) => void;
  onFilterChange: (filterId: string, value: any, active?: boolean) => void;
  availableTags?: string[];
  queryFields?: QueryField[];
  compact?: boolean;
  animated?: boolean;
}>(({
  section,
  filters,
  isCollapsed,
  onToggleCollapse,
  onFilterChange,
  availableTags = [],
  queryFields = DEFAULT_QUERY_FIELDS,
  compact = false,
  animated = true
}) => {
  const sectionFilters = useMemo(() =>
    filters.filter(f => section.filters.includes(f.id)),
    [filters, section.filters]
  );

  const activeCount = useMemo(() =>
    sectionFilters.filter(f => f.active).length,
    [sectionFilters]
  );

  const renderFilter = useCallback((filter: FilterConfig) => {
    const commonProps = {
      key: filter.id,
      filter,
      onChange: (value: any, active: boolean) => onFilterChange(filter.id, value, active),
      compact
    };

    switch (filter.type) {
      case 'faceted':
        return <FacetedFilter {...commonProps} />;

      case 'date-range':
        return <DateRangeFilter {...commonProps} />;

      case 'tags':
        return (
          <FacetedFilter
            {...commonProps}
            type="multiselect"
            availableTags={availableTags}
          />
        );

      case 'query':
        return (
          <QueryBuilder
            {...commonProps}
            fields={queryFields}
          />
        );

      default:
        return (
          <div className="text-sm text-gray-500 p-2">
            Unknown filter type: {filter.type}
          </div>
        );
    }
  }, [onFilterChange, compact, availableTags, queryFields]);

  if (sectionFilters.length === 0) return null;

  return (
    <div
      className={`
        filter-section border border-gray-200 rounded-lg bg-white
        ${animated ? 'transition-all duration-200' : ''}
        ${activeCount > 0 ? 'ring-2 ring-blue-100 border-blue-300' : ''}
      `}
    >
      {/* Section Header */}
      <div
        className={`
          flex items-center justify-between p-3 cursor-pointer
          ${section.collapsible ? 'hover:bg-gray-50' : ''}
          ${activeCount > 0 ? 'bg-blue-50' : ''}
          rounded-t-lg
        `}
        onClick={section.collapsible ? () => onToggleCollapse(section.id) : undefined}
        role={section.collapsible ? "button" : undefined}
        tabIndex={section.collapsible ? 0 : undefined}
        aria-expanded={section.collapsible ? !isCollapsed : undefined}
        aria-controls={`filter-section-${section.id}`}
      >
        <div className="flex items-center gap-2">
          {section.icon}
          <h3 className="font-semibold text-gray-900">{section.title}</h3>
          {activeCount > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {activeCount}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {section.description && (
            <span className="text-xs text-gray-500 hidden md:inline">
              {section.description}
            </span>
          )}
          {section.collapsible && (
            <button
              className="p-1 hover:bg-gray-100 rounded transition-colors"
              aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${section.title} section`}
            >
              {isCollapsed ? (
                <ChevronDown size={16} className="text-gray-500" />
              ) : (
                <ChevronUp size={16} className="text-gray-500" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Section Content */}
      {(!section.collapsible || !isCollapsed) && (
        <div
          id={`filter-section-${section.id}`}
          className="p-3 space-y-4 border-t border-gray-100"
        >
          {sectionFilters.map(filter => (
            <div key={filter.id} className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                {filter.label}
              </label>
              {renderFilter(filter)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

FilterSectionComponent.displayName = 'FilterSectionComponent';

// ========================
// Main FilterPanel Component
// ========================

export const FilterPanel = memo<FilterPanelProps>(({
  filters,
  sections = DEFAULT_SECTIONS,
  onFilterChange,
  onClearFilters,
  presets = [],
  onPresetSelect,
  onPresetSave,
  onShare,
  urlPersistence = false,
  className = '',
  compact = false,
  animated = true,
  loading = false,
  availableTags = [],
  queryFields = DEFAULT_QUERY_FIELDS
}) => {
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    new Set(sections.filter(s => s.collapsed).map(s => s.id))
  );
  const [showPresets, setShowPresets] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);

  // Calculate active filter count
  const activeFilterCount = useMemo(() =>
    filters.filter(f => f.active).length,
    [filters]
  );

  // Toggle section collapse
  const toggleSection = useCallback((sectionId: string) => {
    setCollapsedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  }, []);

  // Handle URL persistence
  useEffect(() => {
    if (urlPersistence && activeFilterCount > 0) {
      const url = serializeFiltersToURL(filters);
      const newURL = `${window.location.pathname}?${url}`;
      window.history.replaceState({}, '', newURL);
    }
  }, [filters, urlPersistence, activeFilterCount]);

  // Handle filter preset save
  const handleSavePreset = useCallback(() => {
    if (presetName.trim() && onPresetSave) {
      const preset: FilterPreset = {
        id: `preset-${Date.now()}`,
        name: presetName.trim(),
        filters: filters.filter(f => f.active),
        created: new Date()
      };
      onPresetSave(presetName.trim(), filters.filter(f => f.active));
      setPresetName('');
      setShowSaveDialog(false);
    }
  }, [presetName, onPresetSave, filters]);

  // Handle sharing
  const handleShare = useCallback(() => {
    if (onShare) {
      const url = `${window.location.origin}${window.location.pathname}?${serializeFiltersToURL(filters)}`;
      onShare(url);
    }
  }, [onShare, filters]);

  return (
    <div
      ref={panelRef}
      className={`
        filter-panel bg-gray-50 rounded-lg border border-gray-200
        ${compact ? 'text-sm' : ''}
        ${className}
      `}
      role="region"
      aria-label="Search filters"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white rounded-t-lg">
        <div className="flex items-center gap-3">
          <Filter size={20} className="text-gray-600" />
          <div>
            <h2 className="font-semibold text-gray-900">Filters</h2>
            {activeFilterCount > 0 && (
              <span className="text-xs text-gray-500">
                {activeFilterCount} active filter{activeFilterCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Filter Presets */}
          {presets.length > 0 && (
            <button
              onClick={() => setShowPresets(!showPresets)}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
              title="Filter presets"
            >
              <Bookmark size={16} />
            </button>
          )}

          {/* Save Preset */}
          {activeFilterCount > 0 && onPresetSave && (
            <button
              onClick={() => setShowSaveDialog(true)}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
              title="Save current filters as preset"
            >
              <Save size={16} />
            </button>
          )}

          {/* Share Filters */}
          {activeFilterCount > 0 && onShare && (
            <button
              onClick={handleShare}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
              title="Share current filters"
            >
              <Share2 size={16} />
            </button>
          )}

          {/* Clear All */}
          {activeFilterCount > 0 && (
            <button
              onClick={onClearFilters}
              className="flex items-center gap-1 px-3 py-1 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
              title="Clear all filters"
            >
              <RotateCcw size={14} />
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Filter Presets */}
      {showPresets && presets.length > 0 && (
        <FilterPresets
          presets={presets}
          onSelect={onPresetSelect}
          onClose={() => setShowPresets(false)}
        />
      )}

      {/* Save Preset Dialog */}
      {showSaveDialog && (
        <div className="p-4 border-b border-gray-200 bg-blue-50">
          <div className="flex items-center gap-2 mb-2">
            <Save size={16} className="text-blue-600" />
            <span className="font-medium text-blue-900">Save Filter Preset</span>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="Enter preset name..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSavePreset();
                if (e.key === 'Escape') setShowSaveDialog(false);
              }}
              autoFocus
            />
            <button
              onClick={handleSavePreset}
              disabled={!presetName.trim()}
              className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Save
            </button>
            <button
              onClick={() => setShowSaveDialog(false)}
              className="px-3 py-2 text-gray-600 hover:text-gray-800 text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Filter Sections */}
      <div className="p-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Loading filters...</span>
          </div>
        ) : (
          sections.map(section => (
            <FilterSectionComponent
              key={section.id}
              section={section}
              filters={filters}
              isCollapsed={collapsedSections.has(section.id)}
              onToggleCollapse={toggleSection}
              onFilterChange={onFilterChange}
              availableTags={availableTags}
              queryFields={queryFields}
              compact={compact}
              animated={animated}
            />
          ))
        )}
      </div>

      {/* Empty State */}
      {activeFilterCount === 0 && !loading && (
        <div className="p-6 text-center">
          <Settings size={32} className="mx-auto text-gray-400 mb-3" />
          <p className="text-gray-600 mb-2">No active filters</p>
          <p className="text-sm text-gray-500">
            Apply filters to narrow down your search results
          </p>
        </div>
      )}
    </div>
  );
});

FilterPanel.displayName = 'FilterPanel';

export default FilterPanel;