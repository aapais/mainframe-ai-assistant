/**
 * FiltersDropdown - Isolated Dropdown for Search Filters
 *
 * Features:
 * - Category filtering
 * - Tag selection
 * - Filter management
 * - Click outside handling
 */

import React, { memo } from 'react';
// import { Filter, X } from 'lucide-react'; // Disabled - not installed
const Filter = () => <span>🔽</span>;
const X = () => <span>❌</span>;
import { useClickOutside } from '../../hooks/useClickOutside';

interface FiltersDropdownProps {
  isOpen: boolean;
  selectedCategory: string | null;
  selectedTags: string[];
  onClose: () => void;
  onCategoryChange: (category: string | null) => void;
  onTagsChange: (tags: string[]) => void;
  onClearFilters: () => void;
  className?: string;
}

const CATEGORIES = ['COBOL', 'DB2', 'VSAM', 'JCL', 'CICS'];
const POPULAR_TAGS = [
  'error', 'abend', 'sqlcode', 'status', 'syntax',
  'compilation', 'runtime', 'memory', 'file', 'transaction'
];

const FiltersDropdown = memo<FiltersDropdownProps>(({
  isOpen,
  selectedCategory,
  selectedTags,
  onClose,
  onCategoryChange,
  onTagsChange,
  onClearFilters,
  className = ''
}) => {
  const dropdownRef = useClickOutside<HTMLDivElement>(onClose, isOpen);

  if (!isOpen) return null;

  const handleTagToggle = (tag: string) => {
    const newTags = selectedTags.includes(tag)
      ? selectedTags.filter(t => t !== tag)
      : [...selectedTags, tag];
    onTagsChange(newTags);
  };

  const hasActiveFilters = selectedCategory || selectedTags.length > 0;

  return (
    <div
      ref={dropdownRef}
      className={`filters-dropdown ${className}`}
    >
      <div className="absolute top-full left-0 right-0 mt-3 bg-white rounded-2xl shadow-2xl shadow-purple-500/20 border border-gray-200 z-50 backdrop-blur-sm">
        <div className="p-5">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <Filter className="w-5 h-5 text-purple-600 mr-2" />
              <h3 className="font-semibold text-gray-800">Search Filters</h3>
            </div>
            {hasActiveFilters && (
              <button
                onClick={onClearFilters}
                className="text-sm text-red-600 hover:text-red-800 flex items-center"
              >
                <X className="w-4 h-4 mr-1" />
                Clear All
              </button>
            )}
          </div>

          {/* Categories */}
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
              <span className="mr-2">📁</span>
              Categories
            </h4>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => onCategoryChange(null)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                  selectedCategory === null
                    ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gradient-to-r hover:from-purple-50 hover:to-blue-50 hover:text-purple-600'
                }`}
              >
                All Categories
              </button>
              {CATEGORIES.map(category => (
                <button
                  key={category}
                  onClick={() => onCategoryChange(category)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                    selectedCategory === category
                      ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gradient-to-r hover:from-purple-50 hover:to-blue-50 hover:text-purple-600'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
              <span className="mr-2">🏷️</span>
              Tags
              {selectedTags.length > 0 && (
                <span className="ml-2 bg-purple-100 text-purple-700 text-xs px-2 py-1 rounded-full">
                  {selectedTags.length} selected
                </span>
              )}
            </h4>

            {/* Selected Tags */}
            {selectedTags.length > 0 && (
              <div className="mb-3">
                <div className="flex flex-wrap gap-2">
                  {selectedTags.map(tag => (
                    <span
                      key={tag}
                      className="inline-flex items-center bg-gradient-to-r from-purple-100 to-blue-100 text-purple-800 text-sm px-3 py-1 rounded-full"
                    >
                      {tag}
                      <button
                        onClick={() => handleTagToggle(tag)}
                        className="ml-2 text-purple-600 hover:text-purple-800"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Available Tags */}
            <div className="flex flex-wrap gap-2">
              {POPULAR_TAGS.filter(tag => !selectedTags.includes(tag)).map(tag => (
                <button
                  key={tag}
                  onClick={() => handleTagToggle(tag)}
                  className="px-3 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gradient-to-r hover:from-purple-50 hover:to-blue-50 hover:text-purple-600 transition-all duration-300"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Applied Filters Summary */}
          {hasActiveFilters && (
            <div className="mt-6 p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl border border-purple-200">
              <h5 className="text-sm font-semibold text-purple-800 mb-2">Applied Filters</h5>
              <div className="text-sm text-purple-700">
                {selectedCategory && (
                  <div>Category: <span className="font-medium">{selectedCategory}</span></div>
                )}
                {selectedTags.length > 0 && (
                  <div>Tags: <span className="font-medium">{selectedTags.join(', ')}</span></div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

FiltersDropdown.displayName = 'FiltersDropdown';

export default FiltersDropdown;