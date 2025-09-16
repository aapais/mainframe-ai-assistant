/**
 * SearchFilters - Advanced Search Filters Component
 *
 * Provides comprehensive filtering capabilities:
 * - Category filters with icons
 * - Date range selection
 * - Tag multi-selection
 * - Complexity/difficulty range
 * - Custom filter types
 * - Responsive design
 * - Accessibility compliant
 *
 * @author Frontend Developer
 * @version 2.0.0
 */

import React, {
  useState,
  useCallback,
  useMemo,
  useEffect,
  memo
} from 'react';
import {
  Filter,
  X,
  Calendar,
  Tag,
  Layers,
  Settings,
  ChevronDown,
  ChevronUp,
  RotateCcw
} from 'lucide-react';
import { SearchFilter } from '../../types';

// ========================
// Types & Interfaces
// ========================

export interface SearchFiltersProps {
  /** Array of filter configurations */
  filters: SearchFilter[];
  /** Callback when filter values change */
  onFilterChange: (filterId: string, value: any, active?: boolean) => void;
  /** Callback to clear all filters */
  onClearFilters: () => void;
  /** Custom CSS className */
  className?: string;
  /** Compact mode for mobile */
  compact?: boolean;
  /** Enable filter animation */
  animated?: boolean;
  /** Available tag options for multiselect */
  availableTags?: string[];
  /** Custom filter sections */
  sections?: FilterSection[];
  /** Enable collapsible sections */
  collapsible?: boolean;
}

interface FilterSection {
  id: string;
  title: string;
  icon?: React.ReactNode;
  filters: string[];
  collapsed?: boolean;
}

interface FilterOption {
  label: string;
  value: any;
  count?: number;
  icon?: React.ReactNode;
  disabled?: boolean;
}

// ========================
// Default Configurations
// ========================

const DEFAULT_SECTIONS: FilterSection[] = [
  {
    id: 'content',
    title: 'Content Type',
    icon: <Layers size={16} />,
    filters: ['category', 'difficulty'],
    collapsed: false
  },
  {
    id: 'temporal',
    title: 'Time & Date',
    icon: <Calendar size={16} />,
    filters: ['date', 'usage'],
    collapsed: false
  },
  {
    id: 'metadata',
    title: 'Tags & Labels',
    icon: <Tag size={16} />,
    filters: ['tags', 'status'],
    collapsed: true
  }
];

const CATEGORY_ICONS: Record<string, string> = {
  'vsam': '💾',
  'jcl': '⚙️',
  'cobol': '📝',
  'db2': '🗄️',
  'system': '🖥️',
  'all': '📁'
};

const DIFFICULTY_COLORS: Record<number, string> = {
  1: 'bg-green-500',
  2: 'bg-yellow-500',
  3: 'bg-orange-500',
  4: 'bg-red-500',
  5: 'bg-purple-500'
};

// ========================
// Filter Components
// ========================

const CategoryFilter = memo<{
  filter: SearchFilter;
  onChange: (value: any, active: boolean) => void;
  compact?: boolean;
}>(({ filter, onChange, compact = false }) => {
  const options = filter.options || [];

  return (
    <div className="category-filter space-y-2">
      <div className="grid grid-cols-1 gap-2">
        {options.map((option: FilterOption) => {
          const isSelected = filter.value === option.value;
          const icon = CATEGORY_ICONS[option.value] || '📁';

          return (
            <button
              key={option.value}
              onClick={() => onChange(option.value, !isSelected)}
              className={`
                flex items-center justify-between p-3 rounded-lg border-2 transition-all
                ${isSelected
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }
                ${compact ? 'p-2 text-sm' : ''}
                ${option.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
              disabled={option.disabled}
              aria-pressed={isSelected}
              aria-label={`Filter by ${option.label}`}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg" role="img" aria-hidden="true">
                  {icon}
                </span>
                <span className="font-medium">{option.label}</span>
              </div>
              {option.count !== undefined && (
                <span className="text-xs bg-gray-100 px-2 py-1 rounded-full">
                  {option.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
});

const RangeFilter = memo<{
  filter: SearchFilter;
  onChange: (value: any, active: boolean) => void;
  compact?: boolean;
}>(({ filter, onChange, compact = false }) => {
  const [min, max] = Array.isArray(filter.value) ? filter.value : [filter.min || 1, filter.max || 5];
  const filterMin = filter.min || 1;
  const filterMax = filter.max || 5;

  const handleChange = useCallback((newMin: number, newMax: number) => {
    const newValue = [newMin, newMax];
    const isActive = newMin > filterMin || newMax < filterMax;
    onChange(newValue, isActive);
  }, [filterMin, filterMax, onChange]);

  const handleMinChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newMin = parseInt(e.target.value);
    handleChange(newMin, Math.max(newMin, max));
  }, [max, handleChange]);

  const handleMaxChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newMax = parseInt(e.target.value);
    handleChange(Math.min(min, newMax), newMax);
  }, [min, handleChange]);

  return (
    <div className="range-filter space-y-3">
      {/* Visual Range Display */}
      <div className="flex items-center gap-2 mb-4">
        {Array.from({ length: filterMax - filterMin + 1 }, (_, i) => {
          const level = filterMin + i;
          const isInRange = level >= min && level <= max;
          const colorClass = DIFFICULTY_COLORS[level] || 'bg-gray-300';

          return (
            <div
              key={level}
              className={`
                w-6 h-6 rounded-full transition-all cursor-pointer
                ${isInRange ? colorClass : 'bg-gray-200'}
                ${isInRange ? 'transform scale-110' : 'opacity-50'}
              `}
              onClick={() => {
                if (isInRange) {
                  // Remove from range
                  if (level === min && level === max) {
                    handleChange(filterMin, filterMax);
                  } else if (level === min) {
                    handleChange(min + 1, max);
                  } else if (level === max) {
                    handleChange(min, max - 1);
                  }
                } else {
                  // Add to range
                  handleChange(Math.min(min, level), Math.max(max, level));
                }
              }}
              title={`Difficulty level ${level}`}
              aria-label={`Difficulty level ${level}${isInRange ? ' (selected)' : ''}`}
            />
          );
        })}
      </div>

      {/* Range Sliders */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700 w-12">Min:</label>
          <input
            type="range"
            min={filterMin}
            max={filterMax}
            value={min}
            onChange={handleMinChange}
            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            aria-label="Minimum difficulty level"
          />
          <span className="text-sm font-mono w-8 text-center">{min}</span>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700 w-12">Max:</label>
          <input
            type="range"
            min={filterMin}
            max={filterMax}
            value={max}
            onChange={handleMaxChange}
            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            aria-label="Maximum difficulty level"
          />
          <span className="text-sm font-mono w-8 text-center">{max}</span>
        </div>
      </div>

      {/* Quick Presets */}
      <div className="flex gap-2 flex-wrap">
        {[
          { label: 'Beginner', range: [1, 2] },
          { label: 'Intermediate', range: [3, 4] },
          { label: 'Advanced', range: [4, 5] },
          { label: 'All', range: [filterMin, filterMax] }
        ].map(preset => (
          <button
            key={preset.label}
            onClick={() => handleChange(preset.range[0], preset.range[1])}
            className={`
              px-3 py-1 text-xs rounded-full border transition-colors
              ${min === preset.range[0] && max === preset.range[1]
                ? 'bg-blue-100 border-blue-300 text-blue-700'
                : 'border-gray-300 hover:border-gray-400'
              }
            `}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
});

const DateFilter = memo<{
  filter: SearchFilter;
  onChange: (value: any, active: boolean) => void;
  compact?: boolean;
}>(({ filter, onChange, compact = false }) => {
  const options = filter.options || [];

  return (
    <div className="date-filter space-y-2">
      <div className="grid grid-cols-1 gap-2">
        {options.map((option: FilterOption) => {
          const isSelected = filter.value === option.value;

          return (
            <button
              key={option.value || 'any'}
              onClick={() => onChange(option.value, option.value !== null)}
              className={`
                flex items-center justify-between p-2 rounded-lg border transition-colors text-sm
                ${isSelected
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }
              `}
              aria-pressed={isSelected}
            >
              <div className="flex items-center gap-2">
                <Calendar size={14} />
                <span>{option.label}</span>
              </div>
              {option.count !== undefined && (
                <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">
                  {option.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
});

const TagFilter = memo<{
  filter: SearchFilter;
  onChange: (value: any, active: boolean) => void;
  availableTags?: string[];
  compact?: boolean;
}>(({ filter, onChange, availableTags = [], compact = false }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const selectedTags = Array.isArray(filter.value) ? filter.value : [];

  const filteredTags = useMemo(() => {
    return availableTags.filter(tag =>
      tag.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [availableTags, searchTerm]);

  const toggleTag = useCallback((tag: string) => {
    const newTags = selectedTags.includes(tag)
      ? selectedTags.filter(t => t !== tag)
      : [...selectedTags, tag];

    onChange(newTags, newTags.length > 0);
  }, [selectedTags, onChange]);

  return (
    <div className="tag-filter space-y-3">
      {/* Search Input */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search tags..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-3 py-2 pl-8 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <Tag size={14} className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400" />
      </div>

      {/* Selected Tags */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedTags.map(tag => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs"
            >
              {tag}
              <button
                onClick={() => toggleTag(tag)}
                className="hover:bg-blue-200 rounded-full p-0.5"
                aria-label={`Remove ${tag} filter`}
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Available Tags */}
      <div className="max-h-32 overflow-y-auto space-y-1">
        {filteredTags.map(tag => {
          const isSelected = selectedTags.includes(tag);

          return (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={`
                w-full flex items-center justify-between p-2 rounded text-sm transition-colors
                ${isSelected
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'hover:bg-gray-50 border border-transparent'
                }
              `}
              aria-pressed={isSelected}
            >
              <span className="truncate">{tag}</span>
              {isSelected && (
                <X size={12} className="ml-2 flex-shrink-0" />
              )}
            </button>
          );
        })}
      </div>

      {filteredTags.length === 0 && searchTerm && (
        <p className="text-sm text-gray-500 text-center py-4">
          No tags found matching "{searchTerm}"
        </p>
      )}
    </div>
  );
});

// ========================
// Main Component
// ========================

export const SearchFilters = memo<SearchFiltersProps>(({
  filters,
  onFilterChange,
  onClearFilters,
  className = '',
  compact = false,
  animated = true,
  availableTags = [],
  sections = DEFAULT_SECTIONS,
  collapsible = true
}) => {
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    new Set(sections.filter(s => s.collapsed).map(s => s.id))
  );

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

  const activeFilterCount = useMemo(() =>
    filters.filter(f => f.active).length,
    [filters]
  );

  const renderFilter = useCallback((filter: SearchFilter) => {
    const commonProps = {
      filter,
      onChange: (value: any, active: boolean) => onFilterChange(filter.id, value, active),
      compact
    };

    switch (filter.type) {
      case 'category':
        return <CategoryFilter key={filter.id} {...commonProps} />;

      case 'range':
        return <RangeFilter key={filter.id} {...commonProps} />;

      case 'date':
        return <DateFilter key={filter.id} {...commonProps} />;

      case 'multiselect':
        return (
          <TagFilter
            key={filter.id}
            {...commonProps}
            availableTags={availableTags}
          />
        );

      default:
        return (
          <div key={filter.id} className="text-sm text-gray-500">
            Unknown filter type: {filter.type}
          </div>
        );
    }
  }, [onFilterChange, compact, availableTags]);

  const renderSection = useCallback((section: FilterSection) => {
    const isCollapsed = collapsedSections.has(section.id);
    const sectionFilters = filters.filter(f => section.filters.includes(f.id));
    const activeSectionFilters = sectionFilters.filter(f => f.active).length;

    if (sectionFilters.length === 0) return null;

    return (
      <div
        key={section.id}
        className={`filter-section border border-gray-200 rounded-lg ${
          animated ? 'transition-all duration-200' : ''
        }`}
      >
        {/* Section Header */}
        <div
          className={`
            flex items-center justify-between p-3 cursor-pointer border-b border-gray-200
            ${collapsible ? 'hover:bg-gray-50' : ''}
            ${activeSectionFilters > 0 ? 'bg-blue-50 border-blue-200' : ''}
          `}
          onClick={collapsible ? () => toggleSection(section.id) : undefined}
        >
          <div className="flex items-center gap-2">
            {section.icon}
            <h3 className="font-medium text-gray-900">{section.title}</h3>
            {activeSectionFilters > 0 && (
              <span className="bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                {activeSectionFilters}
              </span>
            )}
          </div>

          {collapsible && (
            <button
              className="p-1 hover:bg-gray-100 rounded"
              aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${section.title} section`}
            >
              {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            </button>
          )}
        </div>

        {/* Section Content */}
        {(!collapsible || !isCollapsed) && (
          <div className="p-3 space-y-4">
            {sectionFilters.map(filter => (
              <div key={filter.id}>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {filter.label}
                </label>
                {renderFilter(filter)}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }, [
    collapsedSections,
    filters,
    animated,
    collapsible,
    toggleSection,
    renderFilter
  ]);

  return (
    <div className={`search-filters ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Filter size={18} className="text-gray-600" />
          <h2 className="font-semibold text-gray-900">Filters</h2>
          {activeFilterCount > 0 && (
            <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
              {activeFilterCount}
            </span>
          )}
        </div>

        {activeFilterCount > 0 && (
          <button
            onClick={onClearFilters}
            className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            aria-label="Clear all filters"
          >
            <RotateCcw size={14} />
            Clear All
          </button>
        )}
      </div>

      {/* Filter Sections */}
      <div className="space-y-4">
        {sections.map(renderSection)}
      </div>

      {/* Quick Actions */}
      {activeFilterCount === 0 && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg text-center">
          <Settings size={24} className="mx-auto text-gray-400 mb-2" />
          <p className="text-sm text-gray-600">
            Apply filters to narrow down your search results
          </p>
        </div>
      )}
    </div>
  );
});

SearchFilters.displayName = 'SearchFilters';

export default SearchFilters;