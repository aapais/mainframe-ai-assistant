# Mainframe KB Assistant - UI Architecture Design
## Lead UI Architect Deliverables
### Version 1.0 | January 2025

---

## Executive Summary

This document presents a comprehensive UI architecture for the Mainframe Knowledge Base Assistant, designed specifically to optimize support team workflows and achieve the target -60% reduction in incident resolution time. The architecture follows atomic design principles, prioritizes performance and accessibility, and provides an intuitive experience requiring zero training.

**Key Architectural Decisions:**
- **State Management**: Custom hooks + Context API (avoiding Redux overhead)
- **Component Architecture**: Atomic Design with performance-optimized components
- **Offline-First**: Local-first with graceful fallbacks
- **Accessibility**: WCAG 2.1 AA compliant with keyboard-first navigation
- **Performance**: <1s search response, <5s application startup

---

## 1. Component Hierarchy & Atomic Design

### 1.1 Atomic Design Layers

```
Atoms (Base Components)
├── Input Elements
│   ├── TextField
│   ├── TextAreaField
│   ├── SelectField
│   ├── TagsField
│   └── SearchInput
├── Action Elements
│   ├── FormButton
│   ├── IconButton
│   └── KeyboardShortcut
├── Display Elements
│   ├── Badge
│   ├── StatusIndicator
│   ├── ProgressBar
│   └── Spinner
└── Feedback Elements
    ├── Toast
    ├── ConfirmDialog
    └── ErrorBoundary

Molecules (Composite Components)
├── Form Components
│   ├── SearchBar
│   ├── FilterControls
│   ├── KBEntryForm
│   └── ResultItem
├── Navigation Components
│   ├── WindowTitleBar
│   ├── WindowTabs
│   ├── QuickActions
│   └── BreadcrumbNav
├── Content Components
│   ├── EntryCard
│   ├── MetricCard
│   ├── PatternSummary
│   └── CodeSnippet
└── Layout Components
    ├── WindowResizer
    ├── StatusBar
    ├── SidePanel
    └── ToolPanel

Organisms (Complex Components)
├── Views
│   ├── SearchView
│   ├── DetailView
│   ├── CreateEntryView
│   └── MetricsView
├── Panels
│   ├── ResultsPanel
│   ├── DetailsPanel
│   ├── FiltersPanel
│   └── ActionsPanel
└── Windows
    ├── MainWindow
    ├── DetailWindow
    └── MetricsWindow

Templates (Layout Templates)
├── MainWindowLayout
├── DetailWindowLayout
├── MetricsWindowLayout
└── ModalLayout

Pages (Complete Views)
├── DashboardPage
├── KnowledgeBasePage
├── SearchPage
└── SettingsPage
```

### 1.2 Component Design Principles

**Performance-First Components:**
```typescript
// Example: Optimized SearchResult component
interface SearchResultProps {
  result: SearchResult;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onPreview?: (id: string) => void;
}

const SearchResult = memo(({ result, isSelected, onSelect, onPreview }: SearchResultProps) => {
  const handleClick = useCallback(() => onSelect(result.id), [onSelect, result.id]);
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(result.id);
    }
  }, [onSelect, result.id]);

  return (
    <div
      className={`search-result ${isSelected ? 'selected' : ''}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="option"
      aria-selected={isSelected}
    >
      <SearchResultContent result={result} />
    </div>
  );
});
```

---

## 2. State Management Architecture

### 2.1 Recommended Pattern: Context + Custom Hooks

**Rationale for avoiding Redux:**
- Reduces bundle size and complexity
- Better performance for local UI state
- Easier to understand and maintain
- More aligned with React's built-in patterns

### 2.2 State Architecture

```typescript
// Global State Structure
interface GlobalState {
  // Application State
  app: {
    theme: 'light' | 'dark';
    isOffline: boolean;
    connectionStatus: 'connected' | 'disconnected' | 'reconnecting';
    notifications: Notification[];
    shortcuts: KeyboardShortcut[];
  };

  // Knowledge Base State
  kb: {
    entries: KBEntry[];
    searchResults: SearchResult[];
    selectedEntry: KBEntry | null;
    searchQuery: string;
    filters: SearchFilters;
    metrics: KBMetrics;
    isSearching: boolean;
  };

  // UI State
  ui: {
    activeWindow: string;
    openWindows: Window[];
    sidePanelOpen: boolean;
    detailsPanelOpen: boolean;
    modalStack: Modal[];
    focusedElement: string | null;
  };

  // User State
  user: {
    preferences: UserPreferences;
    recentSearches: string[];
    bookmarks: string[];
    sessionData: SessionData;
  };
}

// Context Providers Structure
const StateProviders: React.FC = ({ children }) => (
  <AppStateProvider>
    <KBStateProvider>
      <UIStateProvider>
        <UserStateProvider>
          <NotificationProvider>
            {children}
          </NotificationProvider>
        </UserStateProvider>
      </UIStateProvider>
    </KBStateProvider>
  </AppStateProvider>
);
```

### 2.3 Custom Hooks for State Management

```typescript
// useKBSearch - High-performance search hook
export const useKBSearch = () => {
  const [searchState, setSearchState] = useState({
    query: '',
    results: [],
    isSearching: false,
    filters: defaultFilters
  });

  const debouncedSearch = useDebouncedCallback(
    async (query: string) => {
      if (!query.trim()) {
        setSearchState(prev => ({ ...prev, results: [], isSearching: false }));
        return;
      }

      setSearchState(prev => ({ ...prev, isSearching: true }));

      try {
        // Local search first (< 100ms)
        const localResults = await searchLocal(query);
        setSearchState(prev => ({ ...prev, results: localResults }));

        // AI enhancement if available (< 2s)
        if (isOnline && hasAIAccess) {
          const enhancedResults = await searchWithAI(query, localResults);
          setSearchState(prev => ({ ...prev, results: enhancedResults }));
        }
      } catch (error) {
        // Graceful degradation
        console.warn('Search failed, using local results only', error);
      } finally {
        setSearchState(prev => ({ ...prev, isSearching: false }));
      }
    },
    300 // 300ms debounce
  );

  return {
    ...searchState,
    search: debouncedSearch,
    clearResults: () => setSearchState(prev => ({ ...prev, results: [], query: '' }))
  };
};

// useOfflineFirst - Offline capability hook
export const useOfflineFirst = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncQueue, setSyncQueue] = useState<SyncItem[]>([]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      processSyncQueue();
    };

    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline, syncQueue, addToSyncQueue };
};
```

---

## 3. User Flow Optimization for Support Scenarios

### 3.1 Primary User Journey: Incident Resolution

**Optimized Flow Design:**
```
1. Incident Occurs
   ↓ (0s - Immediate)
2. Open KB Assistant (Hotkey: Ctrl+Shift+K)
   ↓ (1s - Fast startup)
3. Type error/problem in search
   ↓ (0.3s - Debounced search)
4. View results with confidence scores
   ↓ (0.1s - Instant selection)
5. Select best match
   ↓ (0.1s - Details panel opens)
6. View solution steps
   ↓ (Variable - Solution application)
7. Rate solution effectiveness
   ↓ (0.1s - Feedback recorded)
8. Optional: Add notes or create new entry

Total Target Time: <30 seconds to solution
```

### 3.2 Keyboard-First Navigation

**Primary Shortcuts:**
```typescript
const KEYBOARD_SHORTCUTS = {
  // Global shortcuts
  'ctrl+shift+k': 'Open KB Assistant',
  'ctrl+f': 'Focus search',
  'escape': 'Clear/Close',

  // Navigation shortcuts
  'ctrl+1': 'Dashboard tab',
  'ctrl+2': 'Knowledge Base tab',
  'ctrl+3': 'Search tab',
  'ctrl+n': 'New entry',

  // Search shortcuts
  'enter': 'Search/Select',
  'tab': 'Next result',
  'shift+tab': 'Previous result',
  'ctrl+enter': 'Open in new window',

  // Action shortcuts
  'ctrl+s': 'Save entry',
  'ctrl+r': 'Rate solution',
  'f1': 'Help/Shortcuts',

  // Quick categories
  'alt+1': 'Filter: JCL',
  'alt+2': 'Filter: VSAM',
  'alt+3': 'Filter: DB2',
  'alt+4': 'Filter: Batch',
  'alt+5': 'Filter: Functional'
};
```

### 3.3 Context-Aware UI Patterns

```typescript
// Smart defaults based on context
const useSmartDefaults = () => {
  const getContextualDefaults = useCallback((searchQuery: string) => {
    // Auto-detect error patterns
    const errorPatterns = {
      'S0C7': { category: 'Batch', tags: ['abend', 'data-exception'] },
      'VSAM Status': { category: 'VSAM', tags: ['file-error'] },
      'IEF': { category: 'JCL', tags: ['allocation'] },
      'SQLCODE': { category: 'DB2', tags: ['database'] }
    };

    for (const [pattern, defaults] of Object.entries(errorPatterns)) {
      if (searchQuery.includes(pattern)) {
        return defaults;
      }
    }

    return { category: 'Other', tags: [] };
  }, []);

  return { getContextualDefaults };
};
```

---

## 4. Accessibility & Keyboard Navigation

### 4.1 WCAG 2.1 AA Compliance

**Implementation Strategy:**
```typescript
// Accessibility-first component example
const AccessibleSearchResult: React.FC<SearchResultProps> = ({
  result,
  index,
  total,
  isSelected
}) => {
  const ariaProps = useMemo(() => ({
    role: 'option',
    'aria-selected': isSelected,
    'aria-posinset': index + 1,
    'aria-setsize': total,
    'aria-label': `Search result ${index + 1} of ${total}: ${result.title}.
                   Category: ${result.category}.
                   Confidence: ${result.score}%.
                   Press Enter to select.`
  }), [result, index, total, isSelected]);

  return (
    <div
      {...ariaProps}
      className={`search-result ${isSelected ? 'selected' : ''}`}
      tabIndex={isSelected ? 0 : -1}
    >
      <SearchResultContent result={result} />
    </div>
  );
};
```

### 4.2 Keyboard Navigation Patterns

**Focus Management:**
```typescript
// Roving tabindex for result lists
const useRovingTabIndex = (items: any[], initialIndex = 0) => {
  const [focusedIndex, setFocusedIndex] = useState(initialIndex);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex(prev => Math.min(prev + 1, items.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Home':
        e.preventDefault();
        setFocusedIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setFocusedIndex(items.length - 1);
        break;
    }
  }, [items.length]);

  useEffect(() => {
    itemRefs.current[focusedIndex]?.focus();
  }, [focusedIndex]);

  return { focusedIndex, itemRefs, handleKeyDown };
};
```

### 4.3 Screen Reader Support

**Announcements for Actions:**
```typescript
// Live region for search feedback
const useLiveAnnouncements = () => {
  const announceSearch = useCallback((query: string, resultCount: number) => {
    const message = resultCount > 0
      ? `Found ${resultCount} results for "${query}"`
      : `No results found for "${query}". Try a different search term.`;

    announceToScreenReader(message);
  }, []);

  const announceSelection = useCallback((title: string) => {
    announceToScreenReader(`Selected: ${title}`);
  }, []);

  return { announceSearch, announceSelection };
};
```

---

## 5. Performance Optimization Strategies

### 5.1 Rendering Optimization

**Virtual Scrolling for Large Result Lists:**
```typescript
// Optimized results list with virtualization
const VirtualizedResultsList: React.FC<ResultsListProps> = ({ results }) => {
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 50 });
  const containerRef = useRef<HTMLDivElement>(null);
  const itemHeight = 120; // Fixed height for performance

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;

    const scrollTop = containerRef.current.scrollTop;
    const containerHeight = containerRef.current.clientHeight;

    const start = Math.floor(scrollTop / itemHeight);
    const end = Math.min(
      start + Math.ceil(containerHeight / itemHeight) + 5, // Buffer
      results.length
    );

    setVisibleRange({ start, end });
  }, [results.length]);

  const visibleResults = results.slice(visibleRange.start, visibleRange.end);

  return (
    <div
      ref={containerRef}
      className="results-list-container"
      onScroll={handleScroll}
      style={{ height: results.length * itemHeight }}
    >
      <div style={{ paddingTop: visibleRange.start * itemHeight }}>
        {visibleResults.map((result, index) => (
          <SearchResult
            key={result.id}
            result={result}
            index={visibleRange.start + index}
          />
        ))}
      </div>
    </div>
  );
};
```

### 5.2 State Updates Optimization

**Batched Updates and Memoization:**
```typescript
// Optimized search state management
const useOptimizedSearch = () => {
  const [searchState, setSearchState] = useReducer(
    searchReducer,
    initialSearchState
  );

  const memoizedResults = useMemo(() => {
    return searchState.results.map(result => ({
      ...result,
      highlightedTitle: highlightSearchTerms(result.title, searchState.query),
      highlightedSummary: highlightSearchTerms(result.summary, searchState.query)
    }));
  }, [searchState.results, searchState.query]);

  const batchedUpdateResults = useCallback(
    batch((results: SearchResult[]) => {
      setSearchState({ type: 'SET_RESULTS', payload: results });
    }),
    []
  );

  return { searchState, memoizedResults, batchedUpdateResults };
};
```

### 5.3 Database Query Optimization

**Indexing Strategy for <1s Search:**
```typescript
// Database indexing recommendations
const DB_INDEXES = {
  // Full-text search index
  kb_fts: {
    columns: ['title', 'problem', 'solution', 'tags'],
    type: 'FTS5',
    priority: 'HIGH'
  },

  // Category filtering
  idx_category: {
    columns: ['category'],
    type: 'BTREE',
    priority: 'HIGH'
  },

  // Usage-based ranking
  idx_usage_rank: {
    columns: ['usage_count DESC', 'success_rate DESC'],
    type: 'BTREE',
    priority: 'MEDIUM'
  },

  // Recent entries
  idx_created_at: {
    columns: ['created_at DESC'],
    type: 'BTREE',
    priority: 'LOW'
  }
};
```

---

## 6. Offline-First Architecture

### 6.1 Local-First Data Strategy

**SQLite + Sync Queue Pattern:**
```typescript
// Offline-first data service
class OfflineFirstKBService {
  private db: Database;
  private syncQueue: SyncOperation[] = [];
  private isOnline = navigator.onLine;

  async search(query: string): Promise<SearchResult[]> {
    // Always search locally first
    const localResults = await this.searchLocal(query);

    // If online, enhance with AI
    if (this.isOnline && localResults.length > 0) {
      try {
        const enhancedResults = await this.enhanceWithAI(query, localResults);
        return enhancedResults;
      } catch (error) {
        // Graceful degradation - return local results
        console.warn('AI enhancement failed, using local results', error);
        return localResults;
      }
    }

    return localResults;
  }

  async addEntry(entry: KBEntry): Promise<void> {
    // Save locally immediately
    await this.db.addEntry(entry);

    // Add to sync queue for when online
    this.syncQueue.push({
      type: 'ADD_ENTRY',
      data: entry,
      timestamp: Date.now()
    });

    // Try to sync if online
    if (this.isOnline) {
      this.processSyncQueue();
    }
  }
}
```

### 6.2 Graceful Degradation

**Feature Availability Matrix:**
```typescript
const FEATURE_AVAILABILITY = {
  offline: {
    search: true,
    addEntry: true,
    editEntry: true,
    viewEntry: true,
    localMetrics: true,
    // Disabled when offline
    aiEnhancement: false,
    realTimeSync: false,
    sharedMetrics: false
  },

  online: {
    // All features available
    search: true,
    addEntry: true,
    editEntry: true,
    viewEntry: true,
    localMetrics: true,
    aiEnhancement: true,
    realTimeSync: true,
    sharedMetrics: true
  }
};
```

---

## 7. Implementation Roadmap

### 7.1 Phase 1: Foundation (Week 1-2)
- ✅ Atomic components library
- ✅ Custom hooks for state management
- ✅ Keyboard navigation system
- ✅ Basic accessibility implementation
- ✅ Performance monitoring setup

### 7.2 Phase 2: Core Features (Week 3-4)
- ✅ Search interface with <1s response
- ✅ Results display with virtualization
- ✅ Entry creation/editing forms
- ✅ Offline-first data layer
- ✅ Basic metrics dashboard

### 7.3 Phase 3: Enhancement (Week 5-6)
- ✅ AI integration with fallbacks
- ✅ Advanced keyboard shortcuts
- ✅ Context-aware UI patterns
- ✅ Performance optimization
- ✅ Accessibility testing

### 7.4 Phase 4: Polish (Week 7-8)
- ✅ User experience refinement
- ✅ Animation and transitions
- ✅ Error handling improvement
- ✅ Documentation completion
- ✅ User testing and feedback

---

## 8. Success Metrics & KPIs

### 8.1 Performance Metrics
- **Search Response Time**: <1s (Target: <500ms)
- **Application Startup**: <5s (Target: <3s)
- **Memory Usage**: <200MB (Target: <150MB)
- **CPU Usage**: <5% idle (Target: <3%)

### 8.2 User Experience Metrics
- **Time to Solution**: <30s (Target: <20s)
- **Search Success Rate**: >90% (Target: >95%)
- **Keyboard Navigation Coverage**: 100%
- **Accessibility Score**: WCAG 2.1 AA (Target: AAA)

### 8.3 Adoption Metrics
- **Daily Active Users**: >5 (Target: >10)
- **User Satisfaction**: >7/10 (Target: >8/10)
- **Zero Training Achievement**: 100%
- **Resolution Time Reduction**: -60% (Critical success criteria)

---

## 9. Risk Mitigation

### 9.1 Performance Risks
**Risk**: Search slower than 1s target
**Mitigation**:
- Implement progressive result loading
- Use database query optimization
- Add result caching layer

**Risk**: High memory usage with large datasets
**Mitigation**:
- Virtual scrolling for long lists
- Lazy loading of entry details
- Regular memory profiling

### 9.2 User Experience Risks
**Risk**: Complex UI requiring training
**Mitigation**:
- Extensive usability testing
- Progressive disclosure of features
- Contextual help system

**Risk**: Poor offline experience
**Mitigation**:
- Comprehensive offline testing
- Clear offline status indicators
- Sync queue with user feedback

---

## 10. Technical Specifications

### 10.1 Browser Requirements
- **Electron**: 28.x+
- **React**: 18.2+
- **TypeScript**: 5.0+
- **Node.js**: 18.x+

### 10.2 Performance Requirements
- **Bundle Size**: <2MB (excluding Electron)
- **Memory Usage**: <200MB typical
- **CPU Usage**: <5% idle, <20% active
- **Storage**: <100MB for 1000 entries

### 10.3 Accessibility Requirements
- **WCAG 2.1 AA**: Full compliance
- **Keyboard Navigation**: 100% functionality
- **Screen Reader**: Full support
- **Color Contrast**: 4.5:1 minimum ratio

---

## Conclusion

This UI architecture provides a robust foundation for the Mainframe KB Assistant that prioritizes support team efficiency while maintaining scalability for future MVP iterations. The design emphasizes performance, accessibility, and offline-first functionality to ensure the system delivers the targeted -60% reduction in incident resolution time.

**Key Success Factors:**
1. **Performance-First Design**: Every decision optimized for speed
2. **Keyboard-Centric Navigation**: Supports power users' workflows
3. **Offline-First Architecture**: Reliable when connectivity is poor
4. **Progressive Enhancement**: AI features enhance but don't block core functionality
5. **Zero Training Interface**: Intuitive design patterns throughout

The architecture is designed to scale from MVP1 through MVP5 while maintaining consistent performance and user experience standards.