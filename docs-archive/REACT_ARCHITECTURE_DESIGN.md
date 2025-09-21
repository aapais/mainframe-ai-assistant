# React App Architecture Design - Knowledge Base Assistant
## SwarmLead Coordinator Design Document

### **Executive Summary**
This document outlines the optimal React architecture for the Mainframe Knowledge Base Assistant, transforming the current monolithic structure into a scalable, maintainable system optimized for KB functionality.

## **🎯 Design Principles**

### **1. Component Hierarchy Optimization**
```
src/renderer/
├── App.tsx                     # Lightweight app shell
├── components/
│   ├── layout/                 # Layout components
│   │   ├── AppShell.tsx       # Main application shell
│   │   ├── Header.tsx         # Application header
│   │   ├── Sidebar.tsx        # Navigation sidebar
│   │   ├── StatusBar.tsx      # Status information
│   │   └── MainContent.tsx    # Content area wrapper
│   │
│   ├── features/              # Feature-based organization
│   │   ├── search/            # Search functionality
│   │   │   ├── SearchContainer.tsx
│   │   │   ├── SearchInput.tsx
│   │   │   ├── SearchResults.tsx
│   │   │   ├── SearchFilters.tsx
│   │   │   └── hooks/
│   │   │       ├── useSearch.ts
│   │   │       └── useSearchFilters.ts
│   │   │
│   │   ├── knowledge-base/    # KB management
│   │   │   ├── KBContainer.tsx
│   │   │   ├── KBEntryList.tsx
│   │   │   ├── KBEntryDetail.tsx
│   │   │   ├── KBEntryForm.tsx
│   │   │   └── hooks/
│   │   │       ├── useKBEntries.ts
│   │   │       └── useKBOperations.ts
│   │   │
│   │   ├── metrics/           # Analytics and metrics
│   │   │   ├── MetricsContainer.tsx
│   │   │   ├── MetricsDashboard.tsx
│   │   │   ├── PerformanceChart.tsx
│   │   │   └── hooks/
│   │   │       └── useMetrics.ts
│   │   │
│   │   └── settings/          # Application settings
│   │       ├── SettingsContainer.tsx
│   │       ├── SettingsForm.tsx
│   │       └── hooks/
│   │           └── useSettings.ts
│   │
│   ├── ui/                    # Reusable UI components
│   │   ├── Button/
│   │   ├── Input/
│   │   ├── Modal/
│   │   ├── Loading/
│   │   ├── Notification/
│   │   └── index.ts           # Barrel exports
│   │
│   └── shared/               # Shared utilities
│       ├── ErrorBoundary.tsx
│       ├── LoadingBoundary.tsx
│       └── AccessibilityWrapper.tsx
│
├── contexts/                  # State management
│   ├── AppContext.tsx        # Global app state
│   ├── SearchContext.tsx     # Search-specific state
│   ├── KBContext.tsx         # Knowledge base state
│   └── SettingsContext.tsx   # User settings
│
├── services/                 # Data layer
│   ├── api/                  # IPC abstraction
│   │   ├── KBService.ts
│   │   ├── SearchService.ts
│   │   ├── MetricsService.ts
│   │   └── index.ts
│   │
│   └── cache/               # Client-side caching
│       ├── QueryCache.ts
│       └── StateCache.ts
│
├── hooks/                   # Global custom hooks
│   ├── useLocalStorage.ts
│   ├── useDebounce.ts
│   ├── useKeyboardShortcuts.ts
│   └── useAccessibility.ts
│
├── routes/                  # Routing system
│   ├── AppRouter.tsx
│   ├── PrivateRoute.tsx
│   └── routes.ts
│
├── store/                   # Advanced state (if needed later)
│   ├── slices/
│   └── store.ts
│
└── utils/                   # Utility functions
    ├── formatters.ts
    ├── validators.ts
    └── constants.ts
```

## **🔄 State Management Strategy**

### **1. Hierarchical Context Pattern**
```typescript
// Global App Context
interface AppContextValue {
  theme: 'light' | 'dark' | 'system';
  isLoading: boolean;
  notifications: Notification[];
  currentView: ViewType;
  addNotification: (notification: Notification) => void;
  removeNotification: (id: string) => void;
  setCurrentView: (view: ViewType) => void;
}

// Feature-Specific Contexts
interface SearchContextValue {
  query: string;
  results: SearchResult[];
  filters: SearchFilters;
  isSearching: boolean;
  searchHistory: string[];
  performSearch: (query: string, options?: SearchOptions) => Promise<void>;
  updateFilters: (filters: Partial<SearchFilters>) => void;
  clearResults: () => void;
}

interface KBContextValue {
  entries: KBEntry[];
  selectedEntry: KBEntry | null;
  isLoading: boolean;
  categories: KBCategory[];
  addEntry: (entry: KBEntry) => Promise<void>;
  updateEntry: (id: string, entry: Partial<KBEntry>) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  selectEntry: (entry: KBEntry) => void;
  rateEntry: (id: string, successful: boolean) => Promise<void>;
}
```

### **2. Custom Hooks for Business Logic**
```typescript
// Search functionality
export const useSearch = () => {
  const context = useContext(SearchContext);
  if (!context) throw new Error('useSearch must be used within SearchProvider');
  return context;
};

// KB operations
export const useKBOperations = () => {
  const { addEntry, updateEntry, deleteEntry, rateEntry } = useContext(KBContext);
  
  const handleAddEntry = useCallback(async (entry: KBEntryInput) => {
    try {
      await addEntry(entry);
      // Show success notification
    } catch (error) {
      // Handle error
    }
  }, [addEntry]);

  return { handleAddEntry, updateEntry, deleteEntry, rateEntry };
};
```

## **🚀 Performance Optimizations**

### **1. Code Splitting Strategy**
```typescript
// Lazy loading for feature modules
const SearchModule = lazy(() => import('./features/search/SearchContainer'));
const MetricsModule = lazy(() => import('./features/metrics/MetricsContainer'));
const SettingsModule = lazy(() => import('./features/settings/SettingsContainer'));

// Route-based code splitting
const routes = [
  {
    path: '/search',
    component: lazy(() => import('./pages/SearchPage')),
  },
  {
    path: '/metrics',
    component: lazy(() => import('./pages/MetricsPage')),
  }
];
```

### **2. Memoization Strategy**
```typescript
// Component memoization
const SearchResultItem = React.memo(({ result, query, onSelect }) => {
  // Component implementation
}, (prevProps, nextProps) => {
  return prevProps.result.id === nextProps.result.id && 
         prevProps.query === nextProps.query;
});

// Value memoization in contexts
const SearchProvider = ({ children }) => {
  const [state, setState] = useState(initialState);
  
  const contextValue = useMemo(() => ({
    ...state,
    performSearch: useCallback(async (query, options) => {
      // Search implementation
    }, []),
  }), [state]);

  return (
    <SearchContext.Provider value={contextValue}>
      {children}
    </SearchContext.Provider>
  );
};
```

## **🔌 Data Layer Abstraction**

### **1. Service Layer Pattern**
```typescript
// Abstract service interface
interface IKBService {
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  getEntries(filters?: KBFilters): Promise<KBEntry[]>;
  addEntry(entry: KBEntryInput): Promise<KBEntry>;
  updateEntry(id: string, updates: Partial<KBEntry>): Promise<KBEntry>;
  deleteEntry(id: string): Promise<void>;
  rateEntry(id: string, successful: boolean): Promise<void>;
}

// Electron IPC implementation
class ElectronKBService implements IKBService {
  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    return window.electronAPI.searchKB(query, options);
  }

  async getEntries(filters?: KBFilters): Promise<KBEntry[]> {
    return window.electronAPI.getKBEntries(filters);
  }

  // ... other implementations
}

// Service provider
const ServiceContext = createContext<{
  kbService: IKBService;
  searchService: ISearchService;
  metricsService: IMetricsService;
} | null>(null);
```

### **2. Query Cache Integration**
```typescript
class QueryCache {
  private cache = new Map<string, { data: any; timestamp: number; expiry: number }>();

  async get<T>(key: string, fetcher: () => Promise<T>, ttl: number = 300000): Promise<T> {
    const cached = this.cache.get(key);
    
    if (cached && Date.now() < cached.timestamp + cached.expiry) {
      return cached.data;
    }

    const data = await fetcher();
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiry: ttl
    });

    return data;
  }

  invalidate(pattern: string) {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }
}
```

## **🛣️ Routing Strategy**

### **1. Hash-based Routing (Electron-friendly)**
```typescript
// Route configuration
export const routes = [
  {
    path: '/',
    component: SearchPage,
    exact: true,
  },
  {
    path: '/search',
    component: SearchPage,
  },
  {
    path: '/kb',
    component: KnowledgeBasePage,
  },
  {
    path: '/metrics',
    component: MetricsPage,
  },
  {
    path: '/settings',
    component: SettingsPage,
  }
];

// Router component
export const AppRouter = () => (
  <Router basename="#">
    <Routes>
      {routes.map(route => (
        <Route
          key={route.path}
          path={route.path}
          element={
            <Suspense fallback={<LoadingSpinner />}>
              <route.component />
            </Suspense>
          }
        />
      ))}
    </Routes>
  </Router>
);
```

## **♿ Accessibility Architecture**

### **1. Accessibility Context**
```typescript
interface AccessibilityContextValue {
  isScreenReaderActive: boolean;
  isHighContrastMode: boolean;
  isReducedMotionMode: boolean;
  fontSize: 'small' | 'medium' | 'large';
  announceToScreenReader: (message: string, priority?: 'polite' | 'assertive') => void;
  toggleHighContrast: () => void;
  toggleReducedMotion: () => void;
  setFontSize: (size: 'small' | 'medium' | 'large') => void;
}
```

### **2. Keyboard Navigation System**
```typescript
class KeyboardNavigationManager {
  private focusableElements: HTMLElement[] = [];
  private currentIndex = -1;

  init(container: HTMLElement) {
    this.focusableElements = this.getFocusableElements(container);
    this.setupKeyboardListeners();
  }

  navigateNext() {
    this.currentIndex = Math.min(this.currentIndex + 1, this.focusableElements.length - 1);
    this.focusableElements[this.currentIndex]?.focus();
  }

  navigatePrevious() {
    this.currentIndex = Math.max(this.currentIndex - 1, 0);
    this.focusableElements[this.currentIndex]?.focus();
  }
}
```

## **🧪 Testing Strategy**

### **1. Component Testing Structure**
```typescript
// Testing utilities
export const renderWithProviders = (
  component: ReactElement,
  options?: {
    initialState?: Partial<AppState>;
    route?: string;
  }
) => {
  const AllProviders = ({ children }: { children: ReactNode }) => (
    <AppProvider initialState={options?.initialState}>
      <Router initialEntries={[options?.route || '/']}>
        {children}
      </Router>
    </AppProvider>
  );

  return render(component, { wrapper: AllProviders });
};

// Component test example
describe('SearchContainer', () => {
  it('should perform search when query is submitted', async () => {
    const mockSearch = jest.fn();
    const { user } = renderWithProviders(
      <SearchContainer />,
      { initialState: { search: { query: '' } } }
    );

    await user.type(screen.getByRole('textbox'), 'test query');
    await user.click(screen.getByRole('button', { name: /search/i }));

    expect(mockSearch).toHaveBeenCalledWith('test query', expect.any(Object));
  });
});
```

## **📊 Migration Strategy**

### **Phase 1: Foundation** ✅
1. Create new directory structure
2. Set up contexts and providers
3. Create base UI components

### **Phase 2: Feature Extraction** 🔄
1. Extract search functionality
2. Extract KB management
3. Refactor App.tsx

### **Phase 3: Performance** ⏳
1. Implement code splitting
2. Add query caching
3. Optimize re-renders

### **Phase 4: Enhancement** ⏳
1. Add routing system
2. Enhance accessibility
3. Performance monitoring

## **🎯 Success Metrics**

- **Bundle Size**: Reduce main bundle by 40%
- **Performance**: First Contentful Paint < 1.5s
- **Maintainability**: Component complexity < 100 lines average
- **Testability**: 90%+ test coverage
- **Accessibility**: WCAG 2.1 AA compliance
- **Developer Experience**: Hot reload < 2s

This architecture provides a solid foundation for the Knowledge Base assistant while maintaining the flexibility to grow through the 5 MVP phases.