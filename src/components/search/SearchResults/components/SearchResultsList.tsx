/**
 * SearchResultsList Component
 *
 * Main list component for displaying search results with virtualization
 * @version 2.0.0
 */

import React, { memo, useRef } from 'react';
import { useSearchResultsContext } from '../providers/SearchResultsProvider';
import { useKeyboardNavigation } from '../hooks/useKeyboardNavigation';
import { useVirtualization } from '../hooks/useVirtualization';
import { VirtualList, SimpleList } from './VirtualList';
import { SearchResultItem } from './SearchResultItem';
import { generateSearchResultsAriaLabel } from '../utils';
import { VirtualizedResultItemProps } from '../types';

interface SearchResultsListProps {
  /** Custom className */
  className?: string;
  /** Custom ARIA label */
  ariaLabel?: string;
  /** Whether to force virtualization */
  forceVirtualization?: boolean;
  /** Virtualization threshold override */
  virtualizationThreshold?: number;
}

/**
 * Main search results list component with auto-virtualization
 */
export const SearchResultsList: React.FC<SearchResultsListProps> = memo(({
  className = '',
  ariaLabel,
  forceVirtualization = false,
  virtualizationThreshold = 20
}) => {
  const {
    results,
    searchQuery,
    selectedIndex,
    setSelectedIndex,
    searchTerms,
    showConfidenceScores,
    onResultSelect,
    virtualization
  } = useSearchResultsContext();

  const containerRef = useRef<HTMLDivElement>(null);

  // Keyboard navigation
  const { handleKeyDown } = useKeyboardNavigation({
    itemCount: results.length,
    initialSelectedIndex: selectedIndex,
    onSelectionChange: setSelectedIndex,
    onItemActivate: (index) => {
      if (onResultSelect && results[index]) {
        onResultSelect(results[index], index);
      }
    },
    containerRef,
    autoScroll: true
  });

  // Determine if virtualization should be used
  const shouldVirtualize = forceVirtualization ||
    virtualization.enabled ||
    results.length >= virtualizationThreshold;

  // Virtualization hook (only used if virtualizing)
  const virtualizationResult = useVirtualization({
    itemCount: results.length,
    itemHeight: virtualization.itemHeight,
    containerHeight: virtualization.containerHeight,
    bufferSize: virtualization.bufferSize,
    enabled: shouldVirtualize,
    threshold: virtualizationThreshold
  });

  // ARIA label
  const finalAriaLabel = ariaLabel || generateSearchResultsAriaLabel(
    results.length,
    searchQuery,
    selectedIndex
  );

  // Render item function for virtual list
  const renderVirtualItem = ({ index, style, data }: VirtualizedResultItemProps) => (
    <SearchResultItem
      result={data.results[index]}
      index={index}
      isSelected={index === data.selectedIndex}
      searchTerms={data.searchTerms}
      showConfidenceScores={data.showConfidenceScores}
      onSelect={data.onResultSelect}
      style={style}
    />
  );

  // Render item function for simple list
  const renderSimpleItem = (result: any, index: number) => (
    <SearchResultItem
      result={result}
      index={index}
      isSelected={index === selectedIndex}
      searchTerms={searchTerms}
      showConfidenceScores={showConfidenceScores}
      onSelect={onResultSelect || (() => {})}
    />
  );

  // Item data for virtualization
  const itemData = {
    results,
    searchQuery,
    selectedIndex,
    onResultSelect: onResultSelect || (() => {}),
    showConfidenceScores,
    searchTerms
  };

  return (
    <div
      ref={containerRef}
      className={`search-results-list ${className}`}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="listbox"
      aria-label={finalAriaLabel}
      aria-activedescendant={
        selectedIndex >= 0 ? `result-${selectedIndex}` : undefined
      }
    >
      {shouldVirtualize ? (
        <VirtualList
          items={results}
          itemHeight={virtualization.itemHeight}
          containerHeight={virtualization.containerHeight}
          renderItem={renderVirtualItem}
          itemData={itemData}
          bufferSize={virtualization.bufferSize}
        />
      ) : (
        <div className="divide-y divide-gray-200">
          {results.map((result, index) => (
            <div
              key={result.entry.id}
              data-index={index}
              id={`result-${index}`}
            >
              <SearchResultItem
                result={result}
                index={index}
                isSelected={index === selectedIndex}
                searchTerms={searchTerms}
                showConfidenceScores={showConfidenceScores}
                onSelect={onResultSelect || (() => {})}
              />
            </div>
          ))}
        </div>
      )}

      {/* Screen reader summary */}
      <div className="sr-only" aria-live="polite">
        Displaying {results.length} search results.
        {selectedIndex >= 0 &&
          ` Currently selected: result ${selectedIndex + 1} of ${results.length}`
        }
      </div>
    </div>
  );
});

SearchResultsList.displayName = 'SearchResultsList';

/**
 * Simplified list component without context dependency
 */
export const StandaloneSearchResultsList: React.FC<{
  results: any[];
  searchQuery: string;
  selectedIndex?: number;
  searchTerms: readonly string[];
  showConfidenceScores?: boolean;
  onResultSelect?: (result: any, index: number) => void;
  className?: string;
  virtualizationThreshold?: number;
}> = memo(({
  results,
  searchQuery,
  selectedIndex = -1,
  searchTerms,
  showConfidenceScores = true,
  onResultSelect,
  className = '',
  virtualizationThreshold = 20
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const { handleKeyDown } = useKeyboardNavigation({
    itemCount: results.length,
    initialSelectedIndex: selectedIndex,
    onItemActivate: (index) => {
      if (onResultSelect && results[index]) {
        onResultSelect(results[index], index);
      }
    },
    containerRef
  });

  const shouldVirtualize = results.length >= virtualizationThreshold;
  const ariaLabel = generateSearchResultsAriaLabel(results.length, searchQuery, selectedIndex);

  return (
    <div
      ref={containerRef}
      className={`search-results-list ${className}`}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="listbox"
      aria-label={ariaLabel}
      aria-activedescendant={selectedIndex >= 0 ? `result-${selectedIndex}` : undefined}
    >
      {shouldVirtualize ? (
        <VirtualList
          items={results}
          itemHeight={200}
          containerHeight={600}
          renderItem={({ index, style, data }) => (
            <SearchResultItem
              result={data.results[index]}
              index={index}
              isSelected={index === selectedIndex}
              searchTerms={searchTerms}
              showConfidenceScores={showConfidenceScores}
              onSelect={onResultSelect || (() => {})}
              style={style}
            />
          )}
          itemData={{
            results,
            searchQuery,
            selectedIndex,
            onResultSelect: onResultSelect || (() => {}),
            showConfidenceScores,
            searchTerms
          }}
        />
      ) : (
        <div className="divide-y divide-gray-200">
          {results.map((result, index) => (
            <div key={result.entry.id} data-index={index} id={`result-${index}`}>
              <SearchResultItem
                result={result}
                index={index}
                isSelected={index === selectedIndex}
                searchTerms={searchTerms}
                showConfidenceScores={showConfidenceScores}
                onSelect={onResultSelect || (() => {})}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

StandaloneSearchResultsList.displayName = 'StandaloneSearchResultsList';

export default SearchResultsList;