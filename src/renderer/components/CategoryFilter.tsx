import React, { useState, useCallback, useMemo } from 'react';
import { KBCategory } from '../../types';

export interface CategoryFilterProps {
  selectedCategory?: KBCategory;
  onCategoryChange: (category?: KBCategory) => void;
  disabled?: boolean;
  className?: string;
}

const CATEGORIES: Array<{ value: KBCategory; label: string; icon: string; description: string }> = [
  { value: 'JCL', label: 'JCL', icon: '📄', description: 'Job Control Language' },
  { value: 'VSAM', label: 'VSAM', icon: '💾', description: 'Virtual Storage Access Method' },
  { value: 'DB2', label: 'DB2', icon: '🗄️', description: 'Database Management' },
  { value: 'Batch', label: 'Batch', icon: '⚡', description: 'Batch Processing' },
  { value: 'Functional', label: 'Functional', icon: '⚙️', description: 'Business Logic' },
  { value: 'IMS', label: 'IMS', icon: '📊', description: 'Information Management System' },
  { value: 'CICS', label: 'CICS', icon: '🔄', description: 'Customer Information Control System' },
  { value: 'System', label: 'System', icon: '🖥️', description: 'System Level Issues' },
  { value: 'Other', label: 'Other', icon: '📂', description: 'Miscellaneous' }
];

/**
 * CategoryFilter Component
 * 
 * Provides an intuitive interface for filtering knowledge base entries by category.
 * Features:
 * - Visual category chips with icons
 * - Clear all filter option
 * - Keyboard navigation support
 * - Tooltips for category descriptions
 * - Accessibility support with ARIA labels
 */
export const CategoryFilter: React.FC<CategoryFilterProps> = ({
  selectedCategory,
  onCategoryChange,
  disabled = false,
  className = ''
}) => {
  const [hoveredCategory, setHoveredCategory] = useState<KBCategory | null>(null);

  // Memoize selected category info to avoid repeated lookups
  const selectedCategoryInfo = useMemo(() => {
    return selectedCategory ? CATEGORIES.find(c => c.value === selectedCategory) : null;
  }, [selectedCategory]);

  const handleCategoryClick = useCallback((category: KBCategory) => {
    if (disabled) return;
    
    // Toggle selection - if same category is clicked, clear filter
    if (selectedCategory === category) {
      onCategoryChange(undefined);
    } else {
      onCategoryChange(category);
    }
  }, [selectedCategory, onCategoryChange, disabled]);

  const handleClearAll = useCallback(() => {
    if (!disabled) {
      onCategoryChange(undefined);
    }
  }, [onCategoryChange, disabled]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent, category?: KBCategory) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (category) {
        handleCategoryClick(category);
      } else {
        handleClearAll();
      }
    }
  }, [handleCategoryClick, handleClearAll]);

  return (
    <div 
      className={`category-filter ${className}`}
      role="group"
      aria-label="Filter by category"
    >
      <div className="category-filter__header">
        <h3 className="category-filter__title">Filter by Category</h3>
        {selectedCategory && (
          <button
            className="category-filter__clear-all"
            onClick={handleClearAll}
            onKeyDown={(e) => handleKeyDown(e)}
            disabled={disabled}
            aria-label="Clear category filter"
            title="Clear filter"
          >
            Clear All
          </button>
        )}
      </div>

      <div className="category-filter__options">
        {CATEGORIES.map((category) => {
          const isSelected = selectedCategory === category.value;
          const isHovered = hoveredCategory === category.value;
          
          return (
            <div key={category.value} className="category-filter__option-container">
              <button
                className={`
                  category-filter__option
                  ${isSelected ? 'category-filter__option--selected' : ''}
                  ${disabled ? 'category-filter__option--disabled' : ''}
                `}
                onClick={() => handleCategoryClick(category.value)}
                onKeyDown={(e) => handleKeyDown(e, category.value)}
                onMouseEnter={() => setHoveredCategory(category.value)}
                onMouseLeave={() => setHoveredCategory(null)}
                disabled={disabled}
                aria-pressed={isSelected}
                aria-describedby={`category-desc-${category.value}`}
                title={`Filter by ${category.description}`}
              >
                <span className="category-filter__option-icon" aria-hidden="true">
                  {category.icon}
                </span>
                <span className="category-filter__option-label">
                  {category.label}
                </span>
                {isSelected && (
                  <span className="category-filter__option-selected-indicator" aria-hidden="true">
                    ✓
                  </span>
                )}
              </button>
              
              {/* Tooltip */}
              {isHovered && !disabled && (
                <div 
                  id={`category-desc-${category.value}`}
                  className="category-filter__tooltip"
                  role="tooltip"
                  aria-hidden="true"
                >
                  {category.description}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Active filter indicator */}
      {selectedCategory && (
        <div
          className="category-filter__active-filter"
          role="status"
          aria-live="polite"
        >
          <span className="category-filter__active-filter-text">
            Showing:
            <strong>
              {selectedCategoryInfo?.label}
            </strong>
          </span>
        </div>
      )}

      {/* Screen reader summary */}
      <div className="visually-hidden" aria-live="polite" aria-atomic="true">
        {selectedCategory
          ? `Filtering by ${selectedCategoryInfo?.label} category`
          : 'No category filter applied'
        }
      </div>
    </div>
  );
};

export default CategoryFilter;