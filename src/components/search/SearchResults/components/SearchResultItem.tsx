/**
 * SearchResultItem Component
 *
 * Individual search result item with accessibility and performance optimizations
 * @version 2.0.0
 */

import React, { memo, useCallback } from 'react';
import { SearchResultItemProps } from '../types';
import { useSearchHighlight } from '../hooks/useSearchHighlight';
import {
  formatConfidenceScore,
  getConfidenceScoreDescription,
  generateSearchResultItemAriaLabel,
  generateSearchResultDescription
} from '../utils';
import { HighlightText } from './HighlightText';
import { ConfidenceScore } from './ConfidenceScore';
import { LazyImage } from './LazyImage';

/**
 * Individual search result item component with comprehensive accessibility
 */
export const SearchResultItem: React.FC<SearchResultItemProps> = memo(({
  result,
  index,
  isSelected,
  searchTerms,
  showConfidenceScores,
  onSelect,
  className = '',
  style
}) => {
  const { entry, score, matchType, highlights } = result;

  const { highlightText } = useSearchHighlight(searchTerms.join(' '), {
    enableMemoization: true
  });

  // Event handlers
  const handleClick = useCallback(() => {
    onSelect(result, index);
  }, [result, index, onSelect]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(result, index);
    }
  }, [result, index, onSelect]);

  // ARIA labels
  const ariaLabel = generateSearchResultItemAriaLabel(result, index, showConfidenceScores);
  const description = generateSearchResultDescription(result, showConfidenceScores);

  return (
    <div
      className={`
        search-result-item p-4 border-b border-gray-200 cursor-pointer transition-all duration-200
        hover:bg-gray-50 focus-within:bg-gray-50
        ${isSelected ? 'bg-blue-50 border-blue-300 border-l-4 border-l-blue-500' : ''}
        ${className}
      `}
      style={style}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-selected={isSelected}
      aria-describedby={`result-${index}-description`}
      aria-label={ariaLabel}
      data-index={index}
      id={`result-${index}`}
    >
      <div className="flex items-start gap-4">
        {/* Category indicator */}
        <div
          className="flex-shrink-0 w-2 h-2 mt-2 bg-blue-500 rounded-full"
          aria-hidden="true"
        />

        <div className="flex-grow min-w-0">
          {/* Title */}
          <h3 className="text-lg font-semibold text-gray-900 mb-2 leading-tight">
            <HighlightText
              text={entry.title}
              searchTerms={searchTerms}
              className="inline"
            />
          </h3>

          {/* Problem description */}
          <div className="mb-2">
            <p className="text-sm text-gray-600 line-clamp-2">
              <HighlightText
                text={entry.problem}
                searchTerms={searchTerms}
                className="inline"
              />
            </p>
          </div>

          {/* Solution preview */}
          <div className="mb-3">
            <p className="text-sm text-gray-700 line-clamp-3">
              <HighlightText
                text={entry.solution}
                searchTerms={searchTerms}
                className="inline"
              />
            </p>
          </div>

          {/* Metadata */}
          <div className="flex items-center justify-between flex-wrap gap-2 text-xs text-gray-500">
            <div className="flex items-center gap-4">
              <span className="inline-flex items-center gap-1">
                <span
                  className="w-2 h-2 bg-green-500 rounded-full"
                  aria-hidden="true"
                />
                Category: {entry.category}
              </span>

              {entry.tags && entry.tags.length > 0 && (
                <div className="flex items-center gap-1">
                  <span>Tags:</span>
                  {entry.tags.slice(0, 3).map((tag, tagIndex) => (
                    <span
                      key={tagIndex}
                      className="px-1.5 py-0.5 bg-gray-100 rounded text-xs hover:bg-gray-200 transition-colors"
                    >
                      {tag}
                    </span>
                  ))}
                  {entry.tags.length > 3 && (
                    <span className="text-gray-400">
                      +{entry.tags.length - 3} more
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-4">
              <span>Usage: {entry.usage_count || 0}</span>
              <span>
                Updated: {new Date(entry.updated_at).toLocaleDateString()}
              </span>
            </div>
          </div>

          {/* Highlights */}
          {highlights && highlights.length > 0 && (
            <div className="mt-2 p-2 bg-yellow-50 rounded text-xs">
              <div className="font-medium text-yellow-800 mb-1">Key matches:</div>
              {highlights.slice(0, 2).map((highlight, idx) => (
                <div key={idx} className="text-yellow-700">
                  "...{highlight}..."
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Confidence score */}
        {showConfidenceScores && (
          <div className="flex-shrink-0">
            <ConfidenceScore
              score={score}
              matchType={matchType}
              showPercentage={true}
            />
          </div>
        )}
      </div>

      {/* Hidden description for screen readers */}
      <div
        id={`result-${index}-description`}
        className="sr-only"
      >
        {description}
      </div>
    </div>
  );
});

SearchResultItem.displayName = 'SearchResultItem';

// Export with forward ref for virtual scrolling compatibility
export const SearchResultItemWithRef = React.forwardRef<
  HTMLDivElement,
  SearchResultItemProps
>(({ result, index, isSelected, searchTerms, showConfidenceScores, onSelect, className, style }, ref) => (
  <div ref={ref}>
    <SearchResultItem
      result={result}
      index={index}
      isSelected={isSelected}
      searchTerms={searchTerms}
      showConfidenceScores={showConfidenceScores}
      onSelect={onSelect}
      className={className}
      style={style}
    />
  </div>
));

SearchResultItemWithRef.displayName = 'SearchResultItemWithRef';

export default SearchResultItem;