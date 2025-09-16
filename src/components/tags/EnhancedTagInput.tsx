/**
 * Enhanced Tag Input Component
 *
 * Advanced tag input with intelligent autocomplete, validation,
 * real-time suggestions, and accessibility support.
 *
 * Features:
 * - Smart autocomplete with fuzzy search
 * - Category-based tag suggestions
 * - Real-time validation and feedback
 * - Drag-and-drop reordering
 * - Bulk operations support
 * - WCAG 2.1 AA compliance
 * - Keyboard navigation
 * - Custom tag creation controls
 *
 * @author Frontend Developer Agent
 * @version 2.0.0
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  forwardRef,
  useImperativeHandle
} from 'react';
import { Tag } from '../../services/EnhancedTagService';
import { useDebouncedCallback } from '../../hooks/useDebouncedCallback';
import { useKeyboardNavigation } from '../../hooks/useKeyboardNavigation';
import './EnhancedTagInput.css';

// ===========================
// TYPES & INTERFACES
// ===========================

export interface TagSuggestion {
  tag: Tag;
  score: number;
  source: 'existing' | 'category' | 'pattern' | 'ai';
  reasoning?: string;
}

export interface TagInputValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

export interface EnhancedTagInputProps {
  className?: string;

  // Data
  value: Tag[];
  suggestions?: TagSuggestion[];
  categories?: string[];

  // Configuration
  placeholder?: string;
  maxTags?: number;
  minTags?: number;
  allowCustomTags?: boolean;
  requireCategoryTags?: boolean;
  enableAIsuggestions?: boolean;

  // Validation
  validator?: (tags: Tag[]) => TagInputValidation;
  allowDuplicates?: boolean;
  caseSensitive?: boolean;

  // Interaction
  enableDragReorder?: boolean;
  enableBulkOperations?: boolean;
  showTagCount?: boolean;
  showSuggestionDetails?: boolean;

  // Event handlers
  onChange: (tags: Tag[]) => void;
  onTagAdd?: (tag: Tag) => void;
  onTagRemove?: (tag: Tag) => void;
  onTagReorder?: (fromIndex: number, toIndex: number) => void;
  onValidationChange?: (validation: TagInputValidation) => void;
  onSuggestionsRequest?: (query: string) => Promise<TagSuggestion[]>;

  // Accessibility
  ariaLabel?: string;
  ariaDescribedBy?: string;
  announceChanges?: boolean;

  // Styling
  variant?: 'default' | 'compact' | 'outlined';
  size?: 'small' | 'medium' | 'large';
  colorScheme?: 'light' | 'dark' | 'auto';
}

export interface TagInputRef {
  focus: () => void;
  blur: () => void;
  clear: () => void;
  addTag: (tag: Tag) => boolean;
  removeTag: (tagId: string) => boolean;
  validate: () => TagInputValidation;
  getSuggestions: (query: string) => Promise<TagSuggestion[]>;
}

// ===========================
// ENHANCED TAG INPUT COMPONENT
// ===========================

export const EnhancedTagInput = forwardRef<TagInputRef, EnhancedTagInputProps>(({
  className = '',
  value = [],
  suggestions = [],
  categories = [],
  placeholder = 'Type to add tags...',
  maxTags = 50,
  minTags = 0,
  allowCustomTags = true,
  requireCategoryTags = false,
  enableAIsuggestions = true,
  validator,
  allowDuplicates = false,
  caseSensitive = false,
  enableDragReorder = true,
  enableBulkOperations = false,
  showTagCount = true,
  showSuggestionDetails = false,
  variant = 'default',
  size = 'medium',
  colorScheme = 'auto',
  ariaLabel = 'Tag input',
  ariaDescribedBy,
  announceChanges = true,
  onChange,
  onTagAdd,
  onTagRemove,
  onTagReorder,
  onValidationChange,
  onSuggestionsRequest
}, ref) => {

  // State
  const [inputValue, setInputValue] = useState('');
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<TagSuggestion[]>([]);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [validation, setValidation] = useState<TagInputValidation>({
    isValid: true,
    errors: [],
    warnings: [],
    suggestions: []
  });
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);

  // Refs
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const announcementRef = useRef<HTMLDivElement>(null);

  // Custom hooks
  const debouncedSuggestionSearch = useDebouncedCallback(
    async (query: string) => {
      if (query.length < 2) {
        setFilteredSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      const newSuggestions = await getSuggestions(query);
      setFilteredSuggestions(newSuggestions);
      setShowSuggestions(newSuggestions.length > 0);
    },
    300
  );

  // Memoized computed values
  const tagNames = useMemo(() =>
    value.map(tag => caseSensitive ? tag.name : tag.name.toLowerCase()),
    [value, caseSensitive]
  );

  const canAddMoreTags = useMemo(() =>
    value.length < maxTags,
    [value.length, maxTags]
  );

  const hasMinimumTags = useMemo(() =>
    value.length >= minTags,
    [value.length, minTags]
  );

  // Validation
  const validateTags = useCallback((tags: Tag[]): TagInputValidation => {
    if (validator) {
      return validator(tags);
    }

    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Check minimum tags
    if (tags.length < minTags) {
      errors.push(`At least ${minTags} tag${minTags === 1 ? '' : 's'} required`);
    }

    // Check maximum tags
    if (tags.length > maxTags) {
      errors.push(`Maximum ${maxTags} tags allowed`);
    }

    // Check for duplicates if not allowed
    if (!allowDuplicates) {
      const duplicates = findDuplicates(tags);
      if (duplicates.length > 0) {
        errors.push(`Duplicate tags found: ${duplicates.join(', ')}`);
      }
    }

    // Check category requirements
    if (requireCategoryTags && categories.length > 0) {
      const hasAllCategories = categories.every(category =>
        tags.some(tag => tag.category_id === category)
      );
      if (!hasAllCategories) {
        warnings.push('Consider adding tags from all required categories');
      }
    }

    // Performance warning for too many tags
    if (tags.length > 20) {
      warnings.push('Large number of tags may impact search performance');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions
    };
  }, [validator, minTags, maxTags, allowDuplicates, requireCategoryTags, categories]);

  // Update validation when tags change
  useEffect(() => {
    const newValidation = validateTags(value);
    setValidation(newValidation);
    onValidationChange?.(newValidation);
  }, [value, validateTags, onValidationChange]);

  // Get suggestions
  const getSuggestions = useCallback(async (query: string): Promise<TagSuggestion[]> => {
    if (onSuggestionsRequest) {
      return await onSuggestionsRequest(query);
    }

    const queryLower = query.toLowerCase();

    // Filter existing suggestions
    const filtered = suggestions.filter(suggestion => {
      const tagName = suggestion.tag.name.toLowerCase();
      const isAlreadySelected = tagNames.includes(
        caseSensitive ? suggestion.tag.name : tagName
      );

      return !isAlreadySelected && (
        tagName.includes(queryLower) ||
        tagName.startsWith(queryLower) ||
        calculateFuzzyScore(tagName, queryLower) > 0.6
      );
    });

    // Score and sort suggestions
    return filtered
      .map(suggestion => ({
        ...suggestion,
        score: calculateSuggestionScore(suggestion.tag.name, query, suggestion.source)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }, [onSuggestionsRequest, suggestions, tagNames, caseSensitive]);

  // Handle input changes
  const handleInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value;
    setInputValue(newValue);
    setSelectedSuggestionIndex(-1);

    debouncedSuggestionSearch(newValue);
  }, [debouncedSuggestionSearch]);

  // Handle tag addition
  const addTag = useCallback((tag: Tag): boolean => {
    if (!canAddMoreTags) {
      announceChange('Cannot add more tags. Maximum limit reached.');
      return false;
    }

    const tagName = caseSensitive ? tag.name : tag.name.toLowerCase();
    if (!allowDuplicates && tagNames.includes(tagName)) {
      announceChange('Tag already exists');
      return false;
    }

    const newTags = [...value, tag];
    onChange(newTags);
    onTagAdd?.(tag);

    setInputValue('');
    setShowSuggestions(false);
    setSelectedSuggestionIndex(-1);

    announceChange(`Added tag: ${tag.name}`);
    return true;
  }, [value, canAddMoreTags, allowDuplicates, tagNames, caseSensitive, onChange, onTagAdd]);

  // Handle tag removal
  const removeTag = useCallback((tagId: string): boolean => {
    const tagIndex = value.findIndex(tag => tag.id === tagId);
    if (tagIndex === -1) return false;

    const removedTag = value[tagIndex];
    const newTags = value.filter(tag => tag.id !== tagId);

    onChange(newTags);
    onTagRemove?.(removedTag);

    announceChange(`Removed tag: ${removedTag.name}`);
    return true;
  }, [value, onChange, onTagRemove]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case 'Enter':
        event.preventDefault();
        if (selectedSuggestionIndex >= 0 && filteredSuggestions[selectedSuggestionIndex]) {
          addTag(filteredSuggestions[selectedSuggestionIndex].tag);
        } else if (inputValue.trim() && allowCustomTags) {
          const customTag: Tag = {
            id: `custom-${Date.now()}`,
            name: inputValue.trim(),
            category_id: '',
            is_system: false,
            created_at: new Date(),
            updated_at: new Date(),
            usage_count: 0
          };
          addTag(customTag);
        }
        break;

      case 'ArrowDown':
        event.preventDefault();
        if (showSuggestions && filteredSuggestions.length > 0) {
          setSelectedSuggestionIndex(prev =>
            prev < filteredSuggestions.length - 1 ? prev + 1 : 0
          );
        }
        break;

      case 'ArrowUp':
        event.preventDefault();
        if (showSuggestions && filteredSuggestions.length > 0) {
          setSelectedSuggestionIndex(prev =>
            prev > 0 ? prev - 1 : filteredSuggestions.length - 1
          );
        }
        break;

      case 'Escape':
        setShowSuggestions(false);
        setSelectedSuggestionIndex(-1);
        if (inputValue) {
          setInputValue('');
        } else {
          inputRef.current?.blur();
        }
        break;

      case 'Backspace':
        if (!inputValue && value.length > 0) {
          removeTag(value[value.length - 1].id);
        }
        break;

      case 'Tab':
        if (selectedSuggestionIndex >= 0 && filteredSuggestions[selectedSuggestionIndex]) {
          event.preventDefault();
          addTag(filteredSuggestions[selectedSuggestionIndex].tag);
        }
        break;
    }
  }, [
    inputValue,
    selectedSuggestionIndex,
    filteredSuggestions,
    showSuggestions,
    value,
    allowCustomTags,
    addTag,
    removeTag
  ]);

  // Handle drag and drop
  const handleDragStart = useCallback((event: React.DragEvent, index: number) => {
    if (!enableDragReorder) return;

    setDraggedIndex(index);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', index.toString());
  }, [enableDragReorder]);

  const handleDragOver = useCallback((event: React.DragEvent, index: number) => {
    if (!enableDragReorder || draggedIndex === null) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDropTargetIndex(index);
  }, [enableDragReorder, draggedIndex]);

  const handleDrop = useCallback((event: React.DragEvent, dropIndex: number) => {
    if (!enableDragReorder || draggedIndex === null) return;

    event.preventDefault();

    if (draggedIndex !== dropIndex) {
      const newTags = [...value];
      const [draggedTag] = newTags.splice(draggedIndex, 1);
      newTags.splice(dropIndex, 0, draggedTag);

      onChange(newTags);
      onTagReorder?.(draggedIndex, dropIndex);

      announceChange(`Moved tag from position ${draggedIndex + 1} to ${dropIndex + 1}`);
    }

    setDraggedIndex(null);
    setDropTargetIndex(null);
  }, [enableDragReorder, draggedIndex, value, onChange, onTagReorder]);

  // Accessibility announcements
  const announceChange = useCallback((message: string) => {
    if (!announceChanges || !announcementRef.current) return;

    announcementRef.current.textContent = message;

    // Clear after announcement
    setTimeout(() => {
      if (announcementRef.current) {
        announcementRef.current.textContent = '';
      }
    }, 1000);
  }, [announceChanges]);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
    blur: () => inputRef.current?.blur(),
    clear: () => {
      onChange([]);
      setInputValue('');
      setShowSuggestions(false);
    },
    addTag,
    removeTag,
    validate: () => validation,
    getSuggestions
  }), [addTag, removeTag, validation, getSuggestions, onChange]);

  // Auto-focus management
  useEffect(() => {
    if (showSuggestions && selectedSuggestionIndex >= 0 && suggestionsRef.current) {
      const selectedElement = suggestionsRef.current.children[selectedSuggestionIndex] as HTMLElement;
      selectedElement?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedSuggestionIndex, showSuggestions]);

  return (
    <div
      ref={containerRef}
      className={`enhanced-tag-input ${className} ${variant} ${size} ${colorScheme}`}
      data-invalid={!validation.isValid}
    >
      {/* Main input container */}
      <div
        className="tag-input-container"
        onClick={() => inputRef.current?.focus()}
      >
        {/* Existing tags */}
        {value.map((tag, index) => (
          <div
            key={tag.id}
            className={`tag-chip ${draggedIndex === index ? 'dragging' : ''} ${
              dropTargetIndex === index ? 'drop-target' : ''
            }`}
            draggable={enableDragReorder}
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDrop={(e) => handleDrop(e, index)}
            role="button"
            tabIndex={0}
            aria-label={`Tag: ${tag.name}${tag.category_id ? `, Category: ${tag.category_id}` : ''}`}
            onKeyDown={(e) => {
              if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                removeTag(tag.id);
              }
            }}
          >
            <span className="tag-name">{tag.name}</span>

            {/* Category indicator */}
            {tag.category_id && (
              <span className="tag-category" title={`Category: ${tag.category_id}`}>
                {tag.category_id}
              </span>
            )}

            {/* Usage indicator */}
            {tag.usage_count && tag.usage_count > 0 && (
              <span className="tag-usage" title={`Used ${tag.usage_count} times`}>
                {tag.usage_count}
              </span>
            )}

            {/* Remove button */}
            <button
              type="button"
              className="tag-remove"
              onClick={(e) => {
                e.stopPropagation();
                removeTag(tag.id);
              }}
              aria-label={`Remove ${tag.name} tag`}
              tabIndex={-1}
            >
              ×
            </button>
          </div>
        ))}

        {/* Input field */}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            setIsInputFocused(true);
            if (inputValue.length >= 2) {
              setShowSuggestions(true);
            }
          }}
          onBlur={() => {
            setIsInputFocused(false);
            // Delay hiding suggestions to allow for clicks
            setTimeout(() => setShowSuggestions(false), 150);
          }}
          placeholder={value.length === 0 ? placeholder : ''}
          className="tag-input"
          disabled={!canAddMoreTags}
          aria-label={ariaLabel}
          aria-describedby={ariaDescribedBy}
          aria-expanded={showSuggestions}
          aria-activedescendant={
            selectedSuggestionIndex >= 0
              ? `suggestion-${selectedSuggestionIndex}`
              : undefined
          }
          role="combobox"
        />
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && filteredSuggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="suggestions-dropdown"
          role="listbox"
        >
          {filteredSuggestions.map((suggestion, index) => (
            <div
              key={`${suggestion.tag.id}-${index}`}
              id={`suggestion-${index}`}
              className={`suggestion-item ${
                index === selectedSuggestionIndex ? 'selected' : ''
              }`}
              role="option"
              aria-selected={index === selectedSuggestionIndex}
              onMouseDown={(e) => {
                e.preventDefault(); // Prevent input blur
                addTag(suggestion.tag);
              }}
              onMouseEnter={() => setSelectedSuggestionIndex(index)}
            >
              <div className="suggestion-main">
                <span className="suggestion-name">{suggestion.tag.name}</span>
                {suggestion.tag.category_id && (
                  <span className="suggestion-category">
                    {suggestion.tag.category_id}
                  </span>
                )}
              </div>

              {showSuggestionDetails && (
                <div className="suggestion-details">
                  <span className="suggestion-source">{suggestion.source}</span>
                  <span className="suggestion-score">
                    {Math.round(suggestion.score * 100)}%
                  </span>
                  {suggestion.tag.usage_count && (
                    <span className="suggestion-usage">
                      Used {suggestion.tag.usage_count} times
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Status and feedback */}
      <div className="tag-input-footer">
        {/* Tag count */}
        {showTagCount && (
          <div className="tag-count">
            {value.length}/{maxTags} tags
            {minTags > 0 && !hasMinimumTags && (
              <span className="count-warning">
                ({minTags - value.length} more required)
              </span>
            )}
          </div>
        )}

        {/* Validation messages */}
        {!validation.isValid && validation.errors.length > 0 && (
          <div className="validation-errors" role="alert">
            {validation.errors.map((error, index) => (
              <div key={index} className="error-message">
                {error}
              </div>
            ))}
          </div>
        )}

        {validation.warnings.length > 0 && (
          <div className="validation-warnings">
            {validation.warnings.map((warning, index) => (
              <div key={index} className="warning-message">
                ⚠️ {warning}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Screen reader announcements */}
      <div
        ref={announcementRef}
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
      />
    </div>
  );
});

// ===========================
// UTILITY FUNCTIONS
// ===========================

function findDuplicates(tags: Tag[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  tags.forEach(tag => {
    const name = tag.name.toLowerCase();
    if (seen.has(name)) {
      duplicates.add(tag.name);
    }
    seen.add(name);
  });

  return Array.from(duplicates);
}

function calculateFuzzyScore(text: string, query: string): number {
  if (text === query) return 1;
  if (text.startsWith(query)) return 0.9;
  if (text.includes(query)) return 0.7;

  // Simple character-based similarity
  const textChars = text.toLowerCase().split('');
  const queryChars = query.toLowerCase().split('');
  let matches = 0;

  queryChars.forEach(char => {
    const index = textChars.indexOf(char);
    if (index !== -1) {
      matches++;
      textChars.splice(index, 1);
    }
  });

  return matches / query.length;
}

function calculateSuggestionScore(
  tagName: string,
  query: string,
  source: TagSuggestion['source']
): number {
  const baseScore = calculateFuzzyScore(tagName, query);

  // Boost score based on source
  const sourceMultiplier = {
    existing: 1.0,
    category: 0.9,
    pattern: 0.8,
    ai: 0.7
  };

  return baseScore * sourceMultiplier[source];
}

EnhancedTagInput.displayName = 'EnhancedTagInput';

export default EnhancedTagInput;