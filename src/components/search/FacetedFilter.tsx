/**
 * FacetedFilter - Multi-Type Filter Component
 *
 * Supports multiple filter types:
 * - Single selection (radio buttons)
 * - Multi-selection (checkboxes)
 * - Tag selection with autocomplete
 * - Range selection (sliders)
 * - Custom filter types
 * 
 * Features:
 * - Real-time filtering
 * - Search within options
 * - Option counts/statistics
 * - Keyboard navigation
 * - Accessibility compliance
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
  Search,
  X,
  Check,
  ChevronDown,
  ChevronUp,
  Hash,
  Tag,
  Filter
} from 'lucide-react';

// ========================
// Types & Interfaces
// ========================

export interface FacetOption {
  label: string;
  value: any;
  count?: number;
  icon?: React.ReactNode;
  disabled?: boolean;
  description?: string;
  color?: string;
}

export interface FacetedFilterProps {
  /** Filter configuration */
  filter: {
    id: string;
    type: 'single' | 'multi' | 'multiselect' | 'range' | 'custom';
    label: string;
    value: any;
    active: boolean;
    options?: FacetOption[];
    min?: number;
    max?: number;
    metadata?: Record<string, any>;
  };
  /** Filter type override */
  type?: 'single' | 'multi' | 'multiselect' | 'range' | 'tags';
  /** Callback when filter value changes */
  onChange: (value: any, active: boolean) => void;
  /** Available tags for autocomplete (when type is 'tags') */
  availableTags?: string[];
  /** Maximum visible options before scrolling */
  maxVisibleOptions?: number;
  /** Enable search within options */
  searchable?: boolean;
  /** Compact mode */
  compact?: boolean;
  /** Show option counts */
  showCounts?: boolean;
  /** Custom placeholder for search */
  searchPlaceholder?: string;
  /** Loading state */
  loading?: boolean;
  /** Custom CSS className */
  className?: string;
}

// ========================
// Utility Functions
// ========================

const normalizeText = (text: string): string => {
  return text.toLowerCase().trim().replace(/\s+/g, ' ');
};

const filterOptions = (options: FacetOption[], searchTerm: string): FacetOption[] => {
  if (!searchTerm) return options;
  
  const normalizedSearch = normalizeText(searchTerm);
  return options.filter(option => 
    normalizeText(option.label).includes(normalizedSearch) ||
    (option.description && normalizeText(option.description).includes(normalizedSearch))
  );
};

// ========================
// Single Selection Component
// ========================

const SingleSelectionFilter = memo<{
  options: FacetOption[];
  value: any;
  onChange: (value: any, active: boolean) => void;
  showCounts?: boolean;
  compact?: boolean;
  searchTerm?: string;
}>(({ options, value, onChange, showCounts = false, compact = false, searchTerm = '' }) => {
  const filteredOptions = useMemo(() => 
    filterOptions(options, searchTerm),
    [options, searchTerm]
  );
  
  return (
    <div className={`space-y-${compact ? '1' : '2'}`}>
      {filteredOptions.map((option) => {
        const isSelected = option.value === value;
        
        return (
          <label
            key={option.value}
            className={`
              flex items-center justify-between p-${compact ? '2' : '3'} 
              rounded-lg border cursor-pointer transition-all
              ${isSelected 
                ? 'border-blue-500 bg-blue-50 text-blue-700' 
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }
              ${option.disabled ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            <div className="flex items-center gap-3 flex-1">
              <input
                type="radio"
                name={`filter-radio`}
                value={option.value}
                checked={isSelected}
                onChange={() => onChange(option.value, option.value !== null)}
                disabled={option.disabled}
                className="text-blue-600 focus:ring-blue-500"
              />
              {option.icon && (
                <span className="flex-shrink-0" role="img" aria-hidden="true">
                  {option.icon}
                </span>
              )}
              <div className="flex-1 min-w-0">
                <span className={`font-medium ${compact ? 'text-sm' : ''}`}>
                  {option.label}
                </span>
                {option.description && (
                  <p className="text-xs text-gray-500 mt-1 truncate">
                    {option.description}
                  </p>
                )}
              </div>
            </div>
            
            {showCounts && option.count !== undefined && (
              <span className="text-xs bg-gray-100 px-2 py-1 rounded-full ml-2">
                {option.count}
              </span>
            )}
          </label>
        );
      })}
      
      {filteredOptions.length === 0 && searchTerm && (
        <div className="text-center py-4 text-gray-500 text-sm">
          No options found for "{searchTerm}"
        </div>
      )}
    </div>
  );
});

// ========================
// Multi Selection Component
// ========================

const MultiSelectionFilter = memo<{
  options: FacetOption[];
  value: any[];
  onChange: (value: any[], active: boolean) => void;
  showCounts?: boolean;
  compact?: boolean;
  searchTerm?: string;
}>(({ options, value = [], onChange, showCounts = false, compact = false, searchTerm = '' }) => {
  const filteredOptions = useMemo(() => 
    filterOptions(options, searchTerm),
    [options, searchTerm]
  );
  
  const toggleOption = useCallback((optionValue: any) => {
    const newValue = value.includes(optionValue)
      ? value.filter(v => v !== optionValue)
      : [...value, optionValue];
    onChange(newValue, newValue.length > 0);
  }, [value, onChange]);
  
  return (
    <div className={`space-y-${compact ? '1' : '2'}`}>
      {filteredOptions.map((option) => {
        const isSelected = value.includes(option.value);
        
        return (
          <label
            key={option.value}
            className={`
              flex items-center justify-between p-${compact ? '2' : '3'} 
              rounded-lg border cursor-pointer transition-all
              ${isSelected 
                ? 'border-blue-500 bg-blue-50 text-blue-700' 
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }
              ${option.disabled ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            <div className="flex items-center gap-3 flex-1">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggleOption(option.value)}
                disabled={option.disabled}
                className="text-blue-600 focus:ring-blue-500 rounded"
              />
              {option.icon && (
                <span className="flex-shrink-0" role="img" aria-hidden="true">
                  {option.icon}
                </span>
              )}
              <div className="flex-1 min-w-0">
                <span className={`font-medium ${compact ? 'text-sm' : ''}`}>
                  {option.label}
                </span>
                {option.description && (
                  <p className="text-xs text-gray-500 mt-1 truncate">
                    {option.description}
                  </p>
                )}
              </div>
            </div>
            
            {showCounts && option.count !== undefined && (
              <span className="text-xs bg-gray-100 px-2 py-1 rounded-full ml-2">
                {option.count}
              </span>
            )}
          </label>
        );
      })}
      
      {filteredOptions.length === 0 && searchTerm && (
        <div className="text-center py-4 text-gray-500 text-sm">
          No options found for "{searchTerm}"
        </div>
      )}
    </div>
  );
});

// ========================
// Tag Selection Component
// ========================

const TagSelectionFilter = memo<{
  availableTags: string[];
  value: string[];
  onChange: (value: string[], active: boolean) => void;
  compact?: boolean;
  searchTerm?: string;
}>(({ availableTags, value = [], onChange, compact = false, searchTerm = '' }) => {
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const filteredTags = useMemo(() => {
    const search = searchTerm || inputValue;
    return availableTags
      .filter(tag => !value.includes(tag))
      .filter(tag => tag.toLowerCase().includes(search.toLowerCase()))
      .slice(0, 10);
  }, [availableTags, value, searchTerm, inputValue]);
  
  const addTag = useCallback((tag: string) => {
    if (!value.includes(tag)) {
      const newValue = [...value, tag];
      onChange(newValue, true);
    }
    setInputValue('');
    setShowSuggestions(false);
  }, [value, onChange]);
  
  const removeTag = useCallback((tag: string) => {
    const newValue = value.filter(t => t !== tag);
    onChange(newValue, newValue.length > 0);
  }, [value, onChange]);
  
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault();
      addTag(inputValue.trim());
    } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
      removeTag(value[value.length - 1]);
    }
  }, [inputValue, value, addTag, removeTag]);
  
  return (
    <div className="space-y-3">
      {/* Selected Tags */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map(tag => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium"
            >
              <Tag size={10} />
              {tag}
              <button
                onClick={() => removeTag(tag)}
                className="hover:bg-blue-200 rounded-full p-0.5 transition-colors"
                aria-label={`Remove ${tag} tag`}
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}
      
      {/* Tag Input */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          placeholder="Type to add tags..."
          className={`
            w-full px-3 py-2 pl-8 border border-gray-300 rounded-lg 
            ${compact ? 'text-sm' : ''} 
            focus:ring-2 focus:ring-blue-500 focus:border-transparent
          `}
        />
        <Tag size={14} className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400" />
        
        {/* Tag Suggestions */}
        {showSuggestions && filteredTags.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-40 overflow-y-auto">
            {filteredTags.map(tag => (
              <button
                key={tag}
                onClick={() => addTag(tag)}
                className="w-full px-3 py-2 text-left hover:bg-gray-50 text-sm transition-colors"
              >
                <Tag size={12} className="inline mr-2" />
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

// ========================
// Range Selection Component
// ========================

const RangeSelectionFilter = memo<{
  min: number;
  max: number;
  value: [number, number];
  onChange: (value: [number, number], active: boolean) => void;
  compact?: boolean;
}>(({ min, max, value = [min, max], onChange, compact = false }) => {
  const [localValue, setLocalValue] = useState(value);
  
  useEffect(() => {
    setLocalValue(value);
  }, [value]);
  
  const handleChange = useCallback((newValue: [number, number]) => {
    setLocalValue(newValue);
    const isActive = newValue[0] > min || newValue[1] < max;
    onChange(newValue, isActive);
  }, [min, max, onChange]);
  
  const handleMinChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newMin = Number(e.target.value);
    handleChange([newMin, Math.max(newMin, localValue[1])]);
  }, [localValue, handleChange]);
  
  const handleMaxChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newMax = Number(e.target.value);
    handleChange([Math.min(localValue[0], newMax), newMax]);
  }, [localValue, handleChange]);
  
  return (
    <div className="space-y-4">
      {/* Range Display */}
      <div className="text-center">
        <span className={`font-medium ${compact ? 'text-sm' : ''}`}>
          {localValue[0]} - {localValue[1]}
        </span>
      </div>
      
      {/* Range Sliders */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700 w-12">Min:</label>
          <input
            type="range"
            min={min}
            max={max}
            value={localValue[0]}
            onChange={handleMinChange}
            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
          <span className="text-sm font-mono w-8 text-center">{localValue[0]}</span>
        </div>
        
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700 w-12">Max:</label>
          <input
            type="range"
            min={min}
            max={max}
            value={localValue[1]}
            onChange={handleMaxChange}
            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
          <span className="text-sm font-mono w-8 text-center">{localValue[1]}</span>
        </div>
      </div>
      
      {/* Quick Presets */}
      <div className="flex gap-2 flex-wrap">
        {[
          { label: 'All', range: [min, max] as [number, number] },
          { label: 'Low', range: [min, Math.floor((max - min) / 3) + min] as [number, number] },
          { label: 'Medium', range: [Math.floor((max - min) / 3) + min, Math.floor(2 * (max - min) / 3) + min] as [number, number] },
          { label: 'High', range: [Math.floor(2 * (max - min) / 3) + min, max] as [number, number] }
        ].map(preset => (
          <button
            key={preset.label}
            onClick={() => handleChange(preset.range)}
            className={`
              px-2 py-1 text-xs rounded-full border transition-colors
              ${localValue[0] === preset.range[0] && localValue[1] === preset.range[1]
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

// ========================
// Main FacetedFilter Component
// ========================

export const FacetedFilter = memo<FacetedFilterProps>(({
  filter,
  type,
  onChange,
  availableTags = [],
  maxVisibleOptions = 10,
  searchable = true,
  compact = false,
  showCounts = true,
  searchPlaceholder = "Search options...",
  loading = false,
  className = ''
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isExpanded, setIsExpanded] = useState(true);
  
  const effectiveType = type || filter.type;
  const options = filter.options || [];
  
  const visibleOptions = useMemo(() => {
    const filtered = filterOptions(options, searchTerm);
    return isExpanded ? filtered : filtered.slice(0, maxVisibleOptions);
  }, [options, searchTerm, isExpanded, maxVisibleOptions]);
  
  const hasMoreOptions = useMemo(() => 
    filterOptions(options, searchTerm).length > maxVisibleOptions,
    [options, searchTerm, maxVisibleOptions]
  );
  
  const renderFilterContent = useCallback(() => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600 text-sm">Loading options...</span>
        </div>
      );
    }
    
    switch (effectiveType) {
      case 'single':
        return (
          <SingleSelectionFilter
            options={visibleOptions}
            value={filter.value}
            onChange={onChange}
            showCounts={showCounts}
            compact={compact}
            searchTerm={searchTerm}
          />
        );
      
      case 'multi':
      case 'multiselect':
        return (
          <MultiSelectionFilter
            options={visibleOptions}
            value={Array.isArray(filter.value) ? filter.value : []}
            onChange={onChange}
            showCounts={showCounts}
            compact={compact}
            searchTerm={searchTerm}
          />
        );
      
      case 'tags':
        return (
          <TagSelectionFilter
            availableTags={availableTags}
            value={Array.isArray(filter.value) ? filter.value : []}
            onChange={onChange}
            compact={compact}
            searchTerm={searchTerm}
          />
        );
      
      case 'range':
        return (
          <RangeSelectionFilter
            min={filter.min || 0}
            max={filter.max || 100}
            value={Array.isArray(filter.value) ? filter.value : [filter.min || 0, filter.max || 100]}
            onChange={onChange}
            compact={compact}
          />
        );
      
      default:
        return (
          <div className="text-sm text-gray-500 p-3 text-center">
            Unsupported filter type: {effectiveType}
          </div>
        );
    }
  }, [effectiveType, filter, onChange, visibleOptions, availableTags, showCounts, compact, searchTerm, loading]);
  
  return (
    <div className={`faceted-filter ${className}`}>
      {/* Search Input */}
      {searchable && options.length > 5 && (effectiveType === 'single' || effectiveType === 'multi' || effectiveType === 'multiselect') && (
        <div className="relative mb-3">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={searchPlaceholder}
            className={`
              w-full px-3 py-2 pl-8 border border-gray-300 rounded-lg 
              ${compact ? 'text-sm' : ''} 
              focus:ring-2 focus:ring-blue-500 focus:border-transparent
            `}
          />
          <Search size={14} className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400" />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}
      
      {/* Filter Content */}
      <div className="max-h-64 overflow-y-auto">
        {renderFilterContent()}
      </div>
      
      {/* Show More/Less Toggle */}
      {hasMoreOptions && !searchTerm && (effectiveType === 'single' || effectiveType === 'multi' || effectiveType === 'multiselect') && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full mt-3 px-3 py-2 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors flex items-center justify-center gap-1"
        >
          {isExpanded ? (
            <>
              <ChevronUp size={14} />
              Show Less
            </>
          ) : (
            <>
              <ChevronDown size={14} />
              Show More ({filterOptions(options, searchTerm).length - maxVisibleOptions} more)
            </>
          )}
        </button>
      )}
    </div>
  );
});

FacetedFilter.displayName = 'FacetedFilter';

export default FacetedFilter;