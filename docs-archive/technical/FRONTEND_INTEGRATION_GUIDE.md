# Frontend Integration Guide
## State Management Integration with Context Providers

This guide demonstrates the complete integration of the new state management foundation with the existing UI components, showcasing proper patterns for React context usage, performance optimization, and component composition.

## 🏗️ Architecture Overview

### Context Provider Hierarchy

The application uses a hierarchical context provider structure for optimal performance and maintainability:

```
ErrorBoundary (App Level)
├── KBDataProvider (Master Provider)
    ├── AppProvider (Core app state)
    ├── KBDataProvider (Knowledge base data)
    ├── SearchProvider (Search state)
    └── MetricsProvider (Analytics data)
```

### Key Integration Points

1. **KBDataProvider** - Master context wrapper with configuration
2. **KBSearchBar** - Advanced search with context integration
3. **KBEntryList** - Optimized entry display with state management
4. **KBMetricsPanel** - Real-time analytics dashboard
5. **KnowledgeBasePage** - Main application page combining all components

## 📁 File Structure

```
src/renderer/
├── components/
│   ├── KBDataProvider.tsx      # Master context provider
│   ├── KBSearchBar.tsx         # Search component with contexts
│   ├── KBEntryList.tsx         # Entry list with state management
│   └── KBMetricsPanel.tsx      # Analytics panel
├── contexts/
│   ├── KBDataContext.tsx       # Knowledge base data management
│   ├── SearchContext.tsx       # Search state management
│   └── MetricsContext.tsx      # Analytics and metrics
├── pages/
│   └── KnowledgeBasePage.tsx   # Main application page
└── App.tsx                     # Root application component
```

## 🔧 Usage Patterns

### 1. Context Provider Composition

The `KBDataProvider` demonstrates optimal provider composition:

```tsx
// Hierarchical provider wrapping with error boundaries
<AppProvider>
  <KBDataContextProvider>
    <SearchProvider>
      <MetricsProvider>
        {children}
      </MetricsProvider>
    </SearchProvider>
  </KBDataContextProvider>
</AppProvider>
```

**Key Features:**
- Each layer has its own error boundary
- Performance optimization through proper ordering
- Configuration management centralized
- Connection status indicators
- Offline capability detection

### 2. Hook Usage Patterns

#### Basic Context Access
```tsx
import { useKBData, useSearch, useMetrics } from '../contexts';

const MyComponent = () => {
  const { state, createEntry, updateEntry } = useKBData();
  const { performSearch, state: searchState } = useSearch();
  const { recordUsage } = useMetrics();
  
  // Component logic
};
```

#### Granular Hook Usage
```tsx
import { useSearchQuery, useSearchResults, useSearchFilters } from '../contexts/SearchContext';

const SearchComponent = () => {
  const { query, setQuery } = useSearchQuery();
  const { results, isSearching } = useSearchResults();
  const { filters, updateFilters } = useSearchFilters();
  
  // Only re-renders when specific parts change
};
```

### 3. Performance Optimization Examples

#### Component Memoization
```tsx
const EntryItem = React.memo(({
  entry,
  isSelected,
  onSelect,
  onRate,
}) => {
  // Component implementation
});

// Only re-renders when props actually change
```

#### Selective State Updates
```tsx
const { state, updateFilters } = useSearch();

// This only triggers re-renders for components using filters
const handleCategoryChange = useCallback((category) => {
  updateFilters({ category });
}, [updateFilters]);
```

#### Virtual Scrolling
```tsx
<KBEntryList
  enableVirtualization={entries.length > 50}
  itemHeight={200}
  maxHeight="60vh"
/>
```

## 🎯 Component Integration Examples

### 1. KBSearchBar Integration

```tsx
<KBSearchBar
  autoFocus
  showFilters
  showHistory
  showSuggestions
  onSearchStart={(query) => console.log('Search started:', query)}
  onSearchComplete={(results, query) => console.log('Search completed')}
  onError={(error) => console.error('Search error:', error)}
/>
```

**Features Demonstrated:**
- Real-time suggestions from context
- Search history management
- Advanced filtering UI
- Loading states and error handling
- Keyboard navigation
- Performance optimization with debouncing

### 2. KBEntryList Integration

```tsx
<KBEntryList
  onEntrySelect={handleEntrySelect}
  onEntryRate={handleEntryRate}
  selectedEntryId={selectedEntry?.id}
  showUsageStats
  showCategories
  enableVirtualization={searchState.results.length > 50}
/>
```

**Features Demonstrated:**
- Context-driven data display
- Optimistic updates for ratings
- Virtual scrolling for performance
- Entry selection state management
- Usage tracking integration
- Error boundary protection

### 3. KBMetricsPanel Integration

```tsx
<KBMetricsPanel
  onClose={() => setCurrentView('search')}
  showAdvanced
  refreshInterval={30000}
/>
```

**Features Demonstrated:**
- Real-time metrics from multiple contexts
- Interactive charts and visualizations
- System health monitoring
- Cache performance tracking
- Auto-refresh capability
- Tab-based navigation

## 🔄 State Management Patterns

### 1. Loading States

```tsx
const MyComponent = () => {
  const { state } = useKBData();
  
  if (state.isLoading) {
    return <LoadingIndicator message="Loading entries..." />;
  }
  
  if (state.error) {
    return <ErrorMessage error={state.error} />;
  }
  
  return <div>{/* Component content */}</div>;
};
```

### 2. Error Handling

```tsx
<ErrorBoundary
  FallbackComponent={ErrorFallback}
  onError={(error, errorInfo) => {
    console.error('Component Error:', error, errorInfo);
    // Report to metrics if available
    recordError('component_error', error.message);
  }}
>
  <MyComponent />
</ErrorBoundary>
```

### 3. Optimistic Updates

```tsx
const handleEntryRate = useCallback(async (entryId, successful) => {
  try {
    // Optimistically update UI
    setIsRating(true);
    
    // Perform actual update through context
    await recordEntryUsage(entryId, successful);
    
    // Show success feedback
    showNotification('Rating recorded successfully');
  } catch (error) {
    // Revert optimistic update
    showNotification('Failed to record rating', 'error');
  } finally {
    setIsRating(false);
  }
}, [recordEntryUsage, showNotification]);
```

## ⚡ Performance Best Practices

### 1. Context Splitting

Separate contexts by update frequency:
- **AppProvider**: Infrequent updates (app state)
- **KBDataProvider**: Moderate updates (data changes)
- **SearchProvider**: Frequent updates (search state)
- **MetricsProvider**: Independent updates (analytics)

### 2. Memo Usage

```tsx
// Memoize expensive computations
const processedData = useMemo(() => {
  return entries.map(entry => ({
    ...entry,
    successRate: calculateSuccessRate(entry),
    category: normalizeCategory(entry.category),
  }));
}, [entries]);

// Memoize event handlers
const handleEntrySelect = useCallback((entry) => {
  setSelectedEntry(entry);
  recordEntryView(entry.id);
}, [recordEntryView]);
```

### 3. Lazy Loading

```tsx
// Lazy load heavy components
const KBMetricsPanel = lazy(() => import('../components/KBMetricsPanel'));
const KBEntryForm = lazy(() => import('../components/forms/KBEntryForm'));

// Use with Suspense
<Suspense fallback={<LoadingIndicator message="Loading component..." />}>
  <KBMetricsPanel />
</Suspense>
```

## 🛡️ Error Boundary Patterns

### 1. Component-Level Error Boundaries

```tsx
const ComponentWithErrorBoundary = () => (
  <ErrorBoundary
    FallbackComponent={({ error, resetErrorBoundary }) => (
      <div className="error-fallback">
        <h3>Something went wrong</h3>
        <p>{error.message}</p>
        <button onClick={resetErrorBoundary}>Try Again</button>
      </div>
    )}
    onError={(error, errorInfo) => {
      console.error('Component Error:', error, errorInfo);
    }}
  >
    <MyComponent />
  </ErrorBoundary>
);
```

### 2. Context-Level Error Recovery

```tsx
const ContextWithErrorBoundary = ({ children }) => (
  <ErrorBoundary
    onError={(error, errorInfo) => {
      // Clear potentially corrupted state
      clearCache();
      // Report error
      reportError(error);
    }}
    onReset={() => {
      // Reset context state
      resetContextState();
    }}
  >
    <MyContextProvider>
      {children}
    </MyContextProvider>
  </ErrorBoundary>
);
```

## 🔌 Offline Support Patterns

### 1. Connection Status Handling

```tsx
const ConnectionAwareComponent = () => {
  const { isOnline, isAIAvailable } = useKBStatus();
  
  return (
    <div>
      {!isOnline && (
        <div className="offline-banner">
          Working offline - some features limited
        </div>
      )}
      
      {!isAIAvailable && (
        <div className="ai-unavailable-banner">
          AI search unavailable - using local search
        </div>
      )}
      
      {/* Component content */}
    </div>
  );
};
```

### 2. Graceful Degradation

```tsx
const SearchWithFallback = () => {
  const { performSearch } = useSearch();
  
  const handleSearch = useCallback(async (query, useAI = true) => {
    try {
      // Try AI search first
      if (useAI) {
        await performSearch(query, { useAI: true });
      }
    } catch (aiError) {
      console.warn('AI search failed, falling back to local search');
      
      // Fallback to local search
      await performSearch(query, { useAI: false });
      
      showNotification('Using local search - AI unavailable', 'warning');
    }
  }, [performSearch]);
  
  return <SearchInterface onSearch={handleSearch} />;
};
```

## 📊 Testing Patterns

### 1. Context Testing

```tsx
import { renderWithProviders } from '../test-utils';

test('should display entries from context', () => {
  const mockEntries = [
    { id: '1', title: 'Test Entry', category: 'JCL' }
  ];
  
  renderWithProviders(
    <KBEntryList />,
    {
      kbDataState: { entries: new Map([['1', mockEntries[0]]]) }
    }
  );
  
  expect(screen.getByText('Test Entry')).toBeInTheDocument();
});
```

### 2. Hook Testing

```tsx
import { renderHook } from '@testing-library/react-hooks';
import { useKBData } from '../contexts/KBDataContext';

test('should handle entry creation', async () => {
  const wrapper = ({ children }) => (
    <KBDataProvider>{children}</KBDataProvider>
  );
  
  const { result } = renderHook(() => useKBData(), { wrapper });
  
  await act(async () => {
    await result.current.createEntry({
      title: 'New Entry',
      problem: 'Test problem',
      solution: 'Test solution',
      category: 'JCL'
    });
  });
  
  expect(result.current.state.entries.size).toBe(1);
});
```

## 🚀 Deployment Considerations

### 1. Environment Configuration

```tsx
// Production optimizations
<KBDataProvider
  config={{
    cacheTimeout: process.env.NODE_ENV === 'production' ? 10 * 60 * 1000 : 5 * 60 * 1000,
    enableDebugMode: process.env.NODE_ENV === 'development',
    logPerformanceMetrics: process.env.NODE_ENV === 'development',
    maxCacheSize: process.env.NODE_ENV === 'production' ? 2000 : 1000,
  }}
>
  <App />
</KBDataProvider>
```

### 2. Bundle Optimization

```tsx
// Lazy load non-critical components
const LazyMetricsPanel = React.lazy(() => 
  import('../components/KBMetricsPanel').then(module => ({
    default: module.KBMetricsPanel
  }))
);

// Code splitting by route
const LazyAdminPage = React.lazy(() => import('../pages/AdminPage'));
```

## 📋 Migration Checklist

- [x] **Context Integration**: All contexts properly integrated with hierarchical structure
- [x] **Component Updates**: All components using new context hooks
- [x] **Error Boundaries**: Comprehensive error handling at all levels
- [x] **Performance Optimization**: Memoization and lazy loading implemented
- [x] **Offline Support**: Connection status and graceful degradation
- [x] **Loading States**: Proper loading indicators and suspense boundaries
- [x] **Testing Setup**: Test utilities for context providers
- [x] **Documentation**: Complete usage examples and patterns
- [x] **Type Safety**: Full TypeScript coverage with proper interfaces
- [x] **Accessibility**: ARIA labels and keyboard navigation

## 🎉 Summary

This integration provides:

1. **Optimal Performance**: Context splitting, memoization, virtual scrolling
2. **Robust Error Handling**: Multi-level error boundaries with recovery
3. **Excellent UX**: Loading states, offline support, real-time feedback  
4. **Developer Experience**: Clear patterns, comprehensive typing, debugging tools
5. **Maintainability**: Clean separation of concerns and reusable patterns
6. **Scalability**: Architecture that grows with the application

The implementation demonstrates enterprise-grade React patterns with proper state management, performance optimization, and user experience considerations.