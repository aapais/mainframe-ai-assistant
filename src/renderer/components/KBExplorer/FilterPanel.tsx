/**
 * FilterPanel Component
 *
 * Advanced filtering panel with multiple filter types:
 * - Category selection (checkboxes)
 * - Date range picker
 * - Success rate range slider
 * - Usage count range slider
 * - Tag selection with autocomplete
 * - Text search with real-time filtering
 *
 * @author Frontend Developer
 * @version 1.0.0
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { KBCategory } from '../../../types/services';
import { FilterState } from './index';
import { useDebounce } from '../../hooks/useDebounce';

// =====================
// Types & Interfaces
// =====================

export interface FilterPanelProps {
  filters: FilterState;
  onFiltersChange: (filters: Partial<FilterState>) => void;
  availableTags: string[];
  className?: string;
}

interface DateRangeSelectorProps {
  startDate: Date | null;
  endDate: Date | null;
  onChange: (start: Date | null, end: Date | null) => void;
  label: string;
}

interface RangeSelectorProps {
  min: number;
  max: number;
  value: { min: number; max: number };
  onChange: (value: { min: number; max: number }) => void;
  step?: number;
  label: string;
  unit?: string;
  formatLabel?: (value: number) => string;
}

interface TagSelectorProps {
  selectedTags: string[];
  availableTags: string[];
  onChange: (tags: string[]) => void;
  maxTags?: number;
}

// =====================
// Sub-components
// =====================

const DateRangeSelector: React.FC<DateRangeSelectorProps> = ({
  startDate,
  endDate,
  onChange,
  label,
}) => {
  const formatDate = useCallback((date: Date | null): string => {
    if (!date) return '';
    return date.toISOString().split('T')[0];
  }, []);

  const parseDate = useCallback((dateString: string): Date | null => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? null : date;
  }, []);

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <div className="space-y-2">
        <div>
          <label htmlFor="start-date" className="block text-xs text-gray-500 mb-1">
            From
          </label>
          <input
            id="start-date"
            type="date"
            value={formatDate(startDate)}
            onChange={(e) => onChange(parseDate(e.target.value), endDate)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 touch-manipulation"
          />
        </div>
        <div>
          <label htmlFor="end-date" className="block text-xs text-gray-500 mb-1">
            To
          </label>
          <input
            id="end-date"
            type="date"
            value={formatDate(endDate)}
            onChange={(e) => onChange(startDate, parseDate(e.target.value))}
            min={formatDate(startDate)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 touch-manipulation"
          />
        </div>
      </div>
      {(startDate || endDate) && (
        <button
          onClick={() => onChange(null, null)}
          className="text-xs text-gray-500 hover:text-gray-700"
        >
          Clear dates
        </button>
      )}
    </div>
  );
};

const RangeSelector: React.FC<RangeSelectorProps> = ({
  min,
  max,
  value,
  onChange,
  step = 1,
  label,
  unit = '',
  formatLabel,
}) => {
  const [isDragging, setIsDragging] = useState<'min' | 'max' | null>(null);
  const sliderRef = useRef<HTMLDivElement>(null);

  const formatValue = useCallback((val: number): string => {
    if (formatLabel) return formatLabel(val);
    return `${val}${unit}`;
  }, [formatLabel, unit]);

  const handleMouseDown = useCallback((type: 'min' | 'max') => (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(type);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !sliderRef.current) return;

    const rect = sliderRef.current.getBoundingClientRect();
    const percentage = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const newValue = Math.round((min + (max - min) * percentage) / step) * step;

    if (isDragging === 'min') {
      onChange({ min: Math.min(newValue, value.max - step), max: value.max });
    } else {
      onChange({ min: value.min, max: Math.max(newValue, value.min + step) });
    }
  }, [isDragging, min, max, step, value, onChange]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(null);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const minPercentage = ((value.min - min) / (max - min)) * 100;
  const maxPercentage = ((value.max - min) / (max - min)) * 100;

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-gray-700">{label}</label>

      {/* Range Display */}
      <div className="flex justify-between text-xs text-gray-600">
        <span>{formatValue(value.min)}</span>
        <span>{formatValue(value.max)}</span>
      </div>

      {/* Slider */}
      <div className="relative">
        <div
          ref={sliderRef}
          className="relative h-2 bg-gray-200 rounded-full cursor-pointer"
        >
          {/* Active Range */}
          <div
            className="absolute h-2 bg-blue-500 rounded-full"
            style={{
              left: `${minPercentage}%`,
              width: `${maxPercentage - minPercentage}%`,
            }}
          />

          {/* Min Handle */}
          <button
            type="button"
            className="absolute w-4 h-4 bg-white border-2 border-blue-500 rounded-full shadow-sm cursor-grab active:cursor-grabbing focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
            style={{
              left: `${minPercentage}%`,
              top: '50%',
              transform: 'translate(-50%, -50%)',
            }}
            onMouseDown={handleMouseDown('min')}
            aria-label={`Minimum ${label}: ${formatValue(value.min)}`}
          />

          {/* Max Handle */}
          <button
            type="button"
            className="absolute w-4 h-4 bg-white border-2 border-blue-500 rounded-full shadow-sm cursor-grab active:cursor-grabbing focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
            style={{
              left: `${maxPercentage}%`,
              top: '50%',
              transform: 'translate(-50%, -50%)',
            }}
            onMouseDown={handleMouseDown('max')}
            aria-label={`Maximum ${label}: ${formatValue(value.max)}`}
          />
        </div>
      </div>

      {/* Input Fields */}
      <div className="flex space-x-2">
        <div className="flex-1">
          <input
            type="number"
            value={value.min}
            onChange={(e) => {
              const newMin = Math.max(min, Math.min(parseInt(e.target.value) || min, value.max - step));
              onChange({ min: newMin, max: value.max });
            }}
            min={min}
            max={value.max - step}
            step={step}
            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Min"
          />
        </div>
        <div className="flex-1">
          <input
            type="number"
            value={value.max}
            onChange={(e) => {
              const newMax = Math.min(max, Math.max(parseInt(e.target.value) || max, value.min + step));
              onChange({ min: value.min, max: newMax });
            }}
            min={value.min + step}
            max={max}
            step={step}
            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Max"
          />
        </div>
      </div>

      {/* Reset */}
      {(value.min > min || value.max < max) && (
        <button
          onClick={() => onChange({ min, max })}
          className="text-xs text-gray-500 hover:text-gray-700"
        >
          Reset range
        </button>
      )}
    </div>
  );
};

const TagSelector: React.FC<TagSelectorProps> = ({
  selectedTags,
  availableTags,
  onChange,
  maxTags = 10,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredTags = useMemo(() => {
    if (!inputValue.trim()) return availableTags;
    return availableTags.filter(tag =>
      tag.toLowerCase().includes(inputValue.toLowerCase()) &&
      !selectedTags.includes(tag)
    );
  }, [availableTags, inputValue, selectedTags]);

  const addTag = useCallback((tag: string) => {
    if (!selectedTags.includes(tag) && selectedTags.length < maxTags) {
      onChange([...selectedTags, tag]);
      setInputValue('');
      setIsOpen(false);
    }
  }, [selectedTags, maxTags, onChange]);

  const removeTag = useCallback((tagToRemove: string) => {
    onChange(selectedTags.filter(tag => tag !== tagToRemove));
  }, [selectedTags, onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault();
      const trimmedValue = inputValue.trim();
      if (filteredTags.includes(trimmedValue)) {
        addTag(trimmedValue);
      } else if (!selectedTags.includes(trimmedValue)) {
        // Allow custom tags
        addTag(trimmedValue);
      }
    } else if (e.key === 'Backspace' && !inputValue && selectedTags.length > 0) {
      removeTag(selectedTags[selectedTags.length - 1]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  }, [inputValue, filteredTags, selectedTags, addTag, removeTag]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-gray-700">Tags</label>

      {/* Selected Tags */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedTags.map(tag => (
            <span
              key={tag}
              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
            >
              {tag}
              <button
                onClick={() => removeTag(tag)}
                className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-blue-200 focus:outline-none focus:bg-blue-200"
                aria-label={`Remove ${tag} tag`}
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={selectedTags.length >= maxTags ? 'Maximum tags reached' : 'Add tags...'}
          disabled={selectedTags.length >= maxTags}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
        />

        {/* Dropdown */}
        {isOpen && filteredTags.length > 0 && (
          <div
            ref={dropdownRef}
            className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm"
          >
            {filteredTags.map(tag => (
              <button
                key={tag}
                onClick={() => addTag(tag)}
                className="w-full text-left px-4 py-2 text-sm text-gray-900 hover:bg-gray-100 focus:outline-none focus:bg-gray-100"
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="text-xs text-gray-500">
        {selectedTags.length}/{maxTags} tags selected
      </div>
    </div>
  );
};

// =====================
// Main Component
// =====================

export const FilterPanel: React.FC<FilterPanelProps> = ({
  filters,
  onFiltersChange,
  availableTags,
  className = '',
}) => {
  const [searchInput, setSearchInput] = useState(filters.searchQuery);
  const debouncedSearch = useDebounce(searchInput, 300);

  // Available categories
  const categories: KBCategory[] = ['JCL', 'VSAM', 'DB2', 'Batch', 'Functional', 'Other'];

  // Update search when debounced value changes
  useEffect(() => {
    if (debouncedSearch !== filters.searchQuery) {
      onFiltersChange({ searchQuery: debouncedSearch });
    }
  }, [debouncedSearch, filters.searchQuery, onFiltersChange]);

  // Category selection handlers
  const handleCategoryChange = useCallback((category: KBCategory, checked: boolean) => {
    const newCategories = checked
      ? [...filters.categories, category]
      : filters.categories.filter(c => c !== category);
    onFiltersChange({ categories: newCategories });
  }, [filters.categories, onFiltersChange]);

  const handleSelectAllCategories = useCallback(() => {
    const allSelected = categories.length === filters.categories.length;
    onFiltersChange({ categories: allSelected ? [] : [...categories] });
  }, [categories, filters.categories, onFiltersChange]);

  // Date range handler
  const handleDateRangeChange = useCallback((start: Date | null, end: Date | null) => {
    onFiltersChange({
      dateRange: { start, end }
    });
  }, [onFiltersChange]);

  // Success rate range handler
  const handleSuccessRateChange = useCallback((range: { min: number; max: number }) => {
    onFiltersChange({
      successRateRange: range
    });
  }, [onFiltersChange]);

  // Usage range handler
  const handleUsageRangeChange = useCallback((range: { min: number; max: number }) => {
    onFiltersChange({
      usageRange: range
    });
  }, [onFiltersChange]);

  // Tags handler
  const handleTagsChange = useCallback((tags: string[]) => {
    onFiltersChange({ tags });
  }, [onFiltersChange]);

  // Clear all filters
  const handleClearAll = useCallback(() => {
    setSearchInput('');
    onFiltersChange({
      categories: [],
      dateRange: { start: null, end: null },
      successRateRange: { min: 0, max: 100 },
      usageRange: { min: 0, max: 1000 },
      tags: [],
      searchQuery: '',
    });
  }, [onFiltersChange]);

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return (
      filters.categories.length > 0 ||
      filters.tags.length > 0 ||
      filters.dateRange.start ||
      filters.dateRange.end ||
      filters.successRateRange.min > 0 ||
      filters.successRateRange.max < 100 ||
      filters.usageRange.min > 0 ||
      filters.usageRange.max < 1000 ||
      filters.searchQuery.trim().length > 0
    );
  }, [filters]);

  return (
    <div className={`filter-panel bg-gray-50 border-b lg:border-b-0 lg:border-r border-gray-200 ${className}`}>
      <div className="p-4 lg:p-6 space-y-4 lg:space-y-6 overflow-y-auto h-full max-h-96 lg:max-h-none">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-base lg:text-lg font-medium text-gray-900">Filters</h2>
          {hasActiveFilters && (
            <button
              onClick={handleClearAll}
              className="text-sm text-gray-500 hover:text-gray-700 focus:outline-none focus:underline"
            >
              Clear all
            </button>
          )}
        </div>

        {/* Search */}
        <div className="space-y-2">
          <label htmlFor="search" className="text-sm font-medium text-gray-700">
            Search
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              id="search"
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search entries..."
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm touch-manipulation"
            />
          </div>
        </div>

        {/* Categories */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">Categories</label>
            <button
              onClick={handleSelectAllCategories}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              {categories.length === filters.categories.length ? 'Clear all' : 'Select all'}
            </button>
          </div>
          <div className="space-y-2">
            {categories.map(category => (
              <label key={category} className="flex items-center">
                <input
                  type="checkbox"
                  checked={filters.categories.includes(category)}
                  onChange={(e) => handleCategoryChange(category, e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-3 text-sm text-gray-600">{category}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Date Range */}
        <DateRangeSelector
          startDate={filters.dateRange.start}
          endDate={filters.dateRange.end}
          onChange={handleDateRangeChange}
          label="Date Range"
        />

        {/* Success Rate Range */}
        <RangeSelector
          min={0}
          max={100}
          value={filters.successRateRange}
          onChange={handleSuccessRateChange}
          step={5}
          label="Success Rate"
          unit="%"
        />

        {/* Usage Range */}
        <RangeSelector
          min={0}
          max={1000}
          value={filters.usageRange}
          onChange={handleUsageRangeChange}
          step={10}
          label="Usage Count"
          formatLabel={(value) => value >= 1000 ? '1000+' : value.toString()}
        />

        {/* Tags */}
        <TagSelector
          selectedTags={filters.tags}
          availableTags={availableTags}
          onChange={handleTagsChange}
          maxTags={10}
        />

        {/* Filter Summary */}
        {hasActiveFilters && (
          <div className="pt-4 border-t border-gray-200">
            <div className="text-sm text-gray-600">
              <div className="font-medium mb-2">Active Filters:</div>
              <ul className="space-y-1 text-xs">
                {filters.categories.length > 0 && (
                  <li>• {filters.categories.length} categories selected</li>
                )}
                {filters.tags.length > 0 && (
                  <li>• {filters.tags.length} tags selected</li>
                )}
                {(filters.dateRange.start || filters.dateRange.end) && (
                  <li>• Date range specified</li>
                )}
                {(filters.successRateRange.min > 0 || filters.successRateRange.max < 100) && (
                  <li>• Success rate: {filters.successRateRange.min}%-{filters.successRateRange.max}%</li>
                )}
                {(filters.usageRange.min > 0 || filters.usageRange.max < 1000) && (
                  <li>• Usage range: {filters.usageRange.min}-{filters.usageRange.max >= 1000 ? '1000+' : filters.usageRange.max}</li>
                )}
                {filters.searchQuery.trim() && (
                  <li>• Text search active</li>
                )}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FilterPanel;