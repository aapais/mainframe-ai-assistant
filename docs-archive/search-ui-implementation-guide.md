# Search UI Implementation Guide

## Quick Start

This guide provides step-by-step instructions for implementing the search results UI/UX architecture.

## Installation and Setup

### 1. Install Dependencies

```bash
npm install react react-dom typescript
npm install -D @types/react @types/react-dom
```

### 2. Copy Component Files

Copy the following component files to your project:
- `/src/components/search/SearchResultCard.tsx`
- `/src/components/search/RankingIndicator.tsx`
- `/src/components/search/ContentPreview.tsx`
- `/src/components/search/FilterPanel.tsx`
- `/src/components/search/ActionButtons.tsx`
- `/src/components/search/ExpandedDetails.tsx`
- `/src/components/search/InteractionHandlers.ts`

### 3. Import Styles

Add the CSS file to your project:
- `/src/styles/search-ui.css`

## Basic Usage

### 1. SearchResultCard

```tsx
import { SearchResultCard } from './components/search/SearchResultCard';

const App = () => {
  const [expandedCards, setExpandedCards] = useState(new Set<string>());

  const handleExpand = (id: string) => {
    setExpandedCards(prev => new Set([...prev, id]));
  };

  const handleCollapse = (id: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleOpen = (result: SearchResult) => {
    // Navigate to result or open in new tab
    window.open(result.url, '_blank');
  };

  return (
    <div className="search-results">
      {results.map((result, index) => (
        <SearchResultCard
          key={result.id}
          result={result}
          index={index}
          isExpanded={expandedCards.has(result.id)}
          onExpand={handleExpand}
          onCollapse={handleCollapse}
          onOpen={handleOpen}
          viewMode="detailed"
        />
      ))}
    </div>
  );
};
```

### 2. FilterPanel

```tsx
import { FilterPanel } from './components/search/FilterPanel';

const SearchPage = () => {
  const [filters, setFilters] = useState<FilterGroup[]>([
    {
      id: 'content-type',
      title: 'Content Type',
      type: 'checkbox',
      options: [
        { id: 'document', label: 'Documents', count: 45, isSelected: false },
        { id: 'image', label: 'Images', count: 23, isSelected: false },
        { id: 'video', label: 'Videos', count: 12, isSelected: false }
      ]
    },
    // ... more filter groups
  ]);

  const handleFilterChange = (groupId: string, optionId: string, isSelected: boolean) => {
    setFilters(prevFilters =>
      prevFilters.map(group =>
        group.id === groupId
          ? {
              ...group,
              options: group.options.map(option =>
                option.id === optionId
                  ? { ...option, isSelected }
                  : option
              )
            }
          : group
      )
    );
  };

  const handleClearAll = () => {
    setFilters(prevFilters =>
      prevFilters.map(group => ({
        ...group,
        options: group.options.map(option => ({ ...option, isSelected: false }))
      }))
    );
  };

  return (
    <div className="search-page">
      <FilterPanel
        filters={filters}
        onFilterChange={handleFilterChange}
        onClearAll={handleClearAll}
      />
      <div className="search-results">
        {/* Search results */}
      </div>
    </div>
  );
};
```

## Advanced Features

### 1. Keyboard Navigation

```tsx
import { createKeyboardHandlers, handleSearchKeydown } from './components/search/InteractionHandlers';

const SearchResults = () => {
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [expandedCards, setExpandedCards] = useState(new Set<string>());

  useEffect(() => {
    const keyboardHandlers = createKeyboardHandlers(
      focusedIndex,
      results.length,
      setFocusedIndex,
      () => handleOpen(results[focusedIndex]),
      () => {
        const id = results[focusedIndex].id;
        if (expandedCards.has(id)) {
          handleCollapse(id);
        } else {
          handleExpand(id);
        }
      },
      () => setFocusedIndex(0)
    );

    const handleKeydown = (e: KeyboardEvent) => {
      handleSearchKeydown(e, keyboardHandlers);
    };

    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  }, [focusedIndex, results, expandedCards]);

  // ... rest of component
};
```

### 2. Virtual Scrolling for Large Lists

```tsx
import { FixedSizeList } from 'react-window';

const VirtualizedSearchResults = ({ results }) => {
  const Row = ({ index, style }) => (
    <div style={style}>
      <SearchResultCard
        result={results[index]}
        index={index}
        // ... other props
      />
    </div>
  );

  return (
    <FixedSizeList
      height={600}
      itemCount={results.length}
      itemSize={120}
      overscanCount={5}
    >
      {Row}
    </FixedSizeList>
  );
};
```

### 3. Search State Management

```tsx
import { useQuery } from 'react-query';

const useSearchResults = (query: string, filters: FilterGroup[]) => {
  return useQuery({
    queryKey: ['search', query, filters],
    queryFn: async () => {
      const activeFilters = extractActiveFilters(filters);
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, filters: activeFilters })
      });
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: query.length > 2
  });
};

function extractActiveFilters(filters: FilterGroup[]) {
  const active: Record<string, string[]> = {};

  filters.forEach(group => {
    const selectedOptions = group.options
      .filter(option => option.isSelected)
      .map(option => option.id);

    if (selectedOptions.length > 0) {
      active[group.id] = selectedOptions;
    }
  });

  return active;
}
```

## Performance Optimization

### 1. Memoization

```tsx
import { memo, useMemo } from 'react';

const OptimizedSearchResultCard = memo(SearchResultCard, (prevProps, nextProps) => {
  return (
    prevProps.result.id === nextProps.result.id &&
    prevProps.isExpanded === nextProps.isExpanded &&
    prevProps.viewMode === nextProps.viewMode
  );
});

const SearchResults = ({ results, query }) => {
  const memoizedResults = useMemo(() => {
    return results.map(result => ({
      ...result,
      highlights: extractHighlights(result.content, query)
    }));
  }, [results, query]);

  return (
    <div>
      {memoizedResults.map(result => (
        <OptimizedSearchResultCard key={result.id} result={result} />
      ))}
    </div>
  );
};
```

### 2. Lazy Loading

```tsx
import { lazy, Suspense } from 'react';

const LazyExpandedDetails = lazy(() => import('./ExpandedDetails'));

const SearchResultCard = (props) => {
  return (
    <article>
      {/* Card content */}
      {props.isExpanded && (
        <Suspense fallback={<div>Loading details...</div>}>
          <LazyExpandedDetails result={props.result} />
        </Suspense>
      )}
    </article>
  );
};
```

### 3. Intersection Observer for Infinite Scroll

```tsx
import { useIntersectionObserver } from './hooks/useIntersectionObserver';

const InfiniteSearchResults = () => {
  const [results, setResults] = useState([]);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const loadMoreRef = useRef();

  useIntersectionObserver(loadMoreRef, {
    threshold: 0.1,
    onIntersect: () => {
      if (hasNextPage && !isLoading) {
        loadMoreResults();
      }
    }
  });

  const loadMoreResults = async () => {
    setIsLoading(true);
    try {
      const newResults = await fetchMoreResults(results.length);
      setResults(prev => [...prev, ...newResults.items]);
      setHasNextPage(newResults.hasNext);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      {results.map(result => (
        <SearchResultCard key={result.id} result={result} />
      ))}
      <div ref={loadMoreRef} style={{ height: 20 }}>
        {isLoading && <div>Loading more results...</div>}
      </div>
    </div>
  );
};
```

## Accessibility Implementation

### 1. ARIA Live Regions

```tsx
const SearchPage = () => {
  const [searchStatus, setSearchStatus] = useState('');
  const [resultCount, setResultCount] = useState(0);

  return (
    <div>
      {/* Screen reader announcements */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {searchStatus}
      </div>

      <div
        aria-live="polite"
        aria-atomic="false"
        className="sr-only"
      >
        {resultCount > 0 && `${resultCount} results found`}
      </div>

      {/* Search interface */}
    </div>
  );
};
```

### 2. Focus Management

```tsx
import { FocusManager } from './InteractionHandlers';

const SearchModal = ({ isOpen, onClose }) => {
  const modalRef = useRef();
  const focusManager = new FocusManager();
  const [previousFocus, setPreviousFocus] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setPreviousFocus(document.activeElement);

      // Focus first focusable element in modal
      const focusableElements = focusManager.getFocusableElements(modalRef.current);
      focusableElements[0]?.focus();
    } else {
      focusManager.restoreFocus(previousFocus);
    }
  }, [isOpen]);

  const handleKeydown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Tab') {
      focusManager.trapFocus(modalRef.current, e);
    }
  };

  return (
    <div
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="search-title"
      onKeyDown={handleKeydown}
    >
      {/* Modal content */}
    </div>
  );
};
```

## Testing

### 1. Component Testing

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { SearchResultCard } from './SearchResultCard';

describe('SearchResultCard', () => {
  const mockResult = {
    id: '1',
    title: 'Test Result',
    content: 'This is test content',
    metadata: {
      author: 'Test Author',
      date: '2023-01-01',
      fileType: 'PDF',
      source: 'Test Source'
    },
    relevanceScore: 85,
    highlights: ['test']
  };

  test('renders result title and content', () => {
    render(
      <SearchResultCard
        result={mockResult}
        index={0}
        onExpand={jest.fn()}
        onCollapse={jest.fn()}
        onOpen={jest.fn()}
        viewMode="detailed"
      />
    );

    expect(screen.getByText('Test Result')).toBeInTheDocument();
    expect(screen.getByText(/This is test content/)).toBeInTheDocument();
  });

  test('handles keyboard navigation', () => {
    const onOpen = jest.fn();
    render(
      <SearchResultCard
        result={mockResult}
        index={0}
        onExpand={jest.fn()}
        onCollapse={jest.fn()}
        onOpen={onOpen}
        viewMode="detailed"
      />
    );

    const card = screen.getByRole('listitem');
    fireEvent.keyDown(card, { key: 'Enter' });
    expect(onOpen).toHaveBeenCalledWith(mockResult);
  });
});
```

### 2. Accessibility Testing

```tsx
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

test('SearchResultCard has no accessibility violations', async () => {
  const { container } = render(<SearchResultCard {...props} />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

## Styling Customization

### 1. CSS Custom Properties

```css
:root {
  /* Override default colors */
  --color-primary: #your-brand-color;
  --color-success: #your-success-color;

  /* Override spacing */
  --space-md: 20px;

  /* Override typography */
  --font-size-base: 18px;
}
```

### 2. Component-Specific Overrides

```css
/* Custom card styling */
.search-result-card.compact {
  padding: 8px;
}

.search-result-card.featured {
  border-left: 4px solid var(--color-primary);
  background: var(--color-gray-50);
}

/* Custom ranking indicator */
.ranking-indicator.custom-style .score-badge {
  border-radius: 4px;
  font-family: 'Roboto Mono', monospace;
}
```

This implementation guide provides a complete foundation for building a sophisticated search results UI with excellent user experience, accessibility, and performance characteristics.