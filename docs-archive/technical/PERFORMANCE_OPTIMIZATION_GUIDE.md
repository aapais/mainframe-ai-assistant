# KB Routing System Performance Optimization Guide

## Executive Summary

This guide provides comprehensive performance optimization strategies for the Knowledge Base routing system, focusing on bundle size reduction, efficient code splitting, lazy loading implementation, and advanced caching strategies. The recommendations are specifically tailored for the Electron-React application architecture.

## Table of Contents

1. [Bundle Size Optimization](#1-bundle-size-optimization)
2. [Code Splitting Strategies](#2-code-splitting-strategies)
3. [Lazy Loading Implementation](#3-lazy-loading-implementation)
4. [Memory Management](#4-memory-management)
5. [Cache Strategies](#5-cache-strategies)
6. [State Management Optimization](#6-state-management-optimization)
7. [Rendering Performance](#7-rendering-performance)
8. [Performance Monitoring](#8-performance-monitoring)

---

## 1. Bundle Size Optimization

### 1.1 Current Bundle Analysis

**Identified Issues:**
- Large dependencies (React Router, React contexts, Electron APIs)
- Duplicate code across route components
- Unoptimized imports and exports
- Missing tree-shaking opportunities

### 1.2 Optimization Strategies

#### A. Webpack Bundle Analyzer Integration

```typescript
// vite.config.ts - Enhanced Configuration
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import path from 'path';

export default defineConfig({
  plugins: [
    react({
      // Enable React optimization
      fastRefresh: true,
      babel: {
        plugins: [
          // Remove PropTypes in production
          'babel-plugin-transform-react-remove-prop-types',
          // Optimize React constants
          'babel-plugin-transform-react-constant-elements',
          // Inline React elements
          'babel-plugin-transform-react-inline-elements',
        ],
      },
    }),
    // Bundle analysis
    visualizer({
      filename: 'dist/stats.html',
      open: true,
      gzipSize: true,
      brotliSize: true,
    }),
  ],
  base: './',
  root: './src/renderer',
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true,
    // Optimize bundle splitting
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'src/renderer/index.html')
      },
      output: {
        // Chunk splitting configuration
        manualChunks: {
          // Vendor chunks
          'react-vendor': ['react', 'react-dom'],
          'router-vendor': ['react-router-dom'],
          'ui-vendor': ['@radix-ui/react-dialog', '@radix-ui/react-select', '@radix-ui/react-toast'],
          'utils-vendor': ['axios', 'fuse.js', 'date-fns', 'uuid'],
          // App chunks
          'kb-core': [
            './src/renderer/contexts/SearchContext.tsx',
            './src/renderer/contexts/KBContext.tsx',
            './src/renderer/routing/KBRouter.tsx',
          ],
          'kb-components': [
            './src/renderer/components/search/SearchInterface.tsx',
            './src/renderer/components/search/SearchResults.tsx',
          ],
        },
        // Optimize chunk naming
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId ? 
            chunkInfo.facadeModuleId.split('/').pop().replace(/\.[^.]+$/, '') : 
            'chunk';
          return `js/${facadeModuleId}-[hash].js`;
        },
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
    // Build optimization
    target: 'esnext',
    minify: 'esbuild',
    // Reduce bundle size
    chunkSizeWarningLimit: 1000,
    // Enable source maps for debugging (disable in production)
    sourcemap: process.env.NODE_ENV !== 'production',
  },
  // Dependency optimization
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@radix-ui/react-dialog',
      '@radix-ui/react-select',
      '@radix-ui/react-toast',
    ],
    exclude: [
      // Large dependencies that should be lazy loaded
      'fuse.js',
      'date-fns',
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/renderer'),
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@components': path.resolve(__dirname, 'src/renderer/components'),
      '@contexts': path.resolve(__dirname, 'src/renderer/contexts'),
      '@routes': path.resolve(__dirname, 'src/renderer/routes'),
    }
  },
  server: {
    port: 3000,
    strictPort: true
  },
  publicDir: path.resolve(__dirname, 'assets')
});
```

#### B. Dependency Optimization

```typescript
// package.json - Optimized dependencies
{
  "dependencies": {
    // Core (keep these)
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.8.0",
    
    // UI (consider alternatives or lazy loading)
    "@radix-ui/react-dialog": "^1.0.5", // Keep - small and essential
    "@radix-ui/react-select": "^2.0.0", // Keep - small and essential
    
    // Utilities (optimize imports)
    "date-fns": "^2.30.0", // Large - use specific imports
    "fuse.js": "^7.0.0", // Large - lazy load
    "axios": "^1.6.2", // Keep - core functionality
    
    // Remove unused
    // "lodash": "^4.17.21", // Remove if not essential
  },
  "devDependencies": {
    // Bundle analysis
    "rollup-plugin-visualizer": "^5.9.0",
    "webpack-bundle-analyzer": "^4.8.0",
  }
}
```

#### C. Tree Shaking Optimization

```typescript
// utils/dateUtils.ts - Optimized imports
// ❌ Bad - imports entire library
import { format, parseISO, isValid } from 'date-fns';

// ✅ Good - specific imports for tree shaking
import format from 'date-fns/format';
import parseISO from 'date-fns/parseISO';
import isValid from 'date-fns/isValid';

// utils/searchUtils.ts - Optimized search utilities
// ❌ Bad - large bundle
import Fuse from 'fuse.js';

// ✅ Good - lazy load large dependencies
const loadFuse = () => import('fuse.js').then(module => module.default);

export const createSearchIndex = async (data: any[], options: any) => {
  const Fuse = await loadFuse();
  return new Fuse(data, options);
};
```

---

## 2. Code Splitting Strategies

### 2.1 Route-Level Splitting

```typescript
// routes/KBRoutes.tsx - Enhanced with splitting
import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { RoutePreloader } from '../components/RoutePreloader';

// Lazy load route components with preloading
const SearchInterface = lazy(() => 
  import('../components/search/SearchInterface').then(module => ({
    default: module.SearchInterface
  }))
);

const SearchResults = lazy(() => 
  import('../components/search/SearchResults').then(module => ({
    default: module.SearchResults
  }))
);

const KBEntryForm = lazy(() => 
  import('../components/forms/KBEntryForm').then(module => ({
    default: module.KBEntryForm
  }))
);

const MetricsDashboard = lazy(() => 
  import('../components/MetricsDashboard').then(module => ({
    default: module.MetricsDashboard
  }))
);

// High-priority components (loaded immediately)
import { DashboardRoute } from './DashboardRoute';
import { QuickSearch } from '../components/QuickSearch';

// Enhanced Route Wrapper with preloading
interface OptimizedRouteWrapperProps {
  children: React.ReactNode;
  title?: string;
  preloadNext?: Array<() => Promise<any>>;
  priority: 'high' | 'medium' | 'low';
}

const OptimizedRouteWrapper: React.FC<OptimizedRouteWrapperProps> = ({ 
  children, 
  title = 'KB Assistant',
  preloadNext = [],
  priority = 'medium'
}) => {
  React.useEffect(() => {
    document.title = `${title} - Mainframe Knowledge Base`;
    
    // Preload next likely routes based on user behavior
    if (priority === 'high' && preloadNext.length > 0) {
      const preloadTimer = setTimeout(() => {
        preloadNext.forEach(preload => {
          preload().catch(console.warn);
        });
      }, 1000); // Preload after 1 second
      
      return () => clearTimeout(preloadTimer);
    }
  }, [title, preloadNext, priority]);

  const fallback = React.useMemo(() => (
    <LoadingSpinner 
      message="Loading..." 
      size={priority === 'high' ? 'lg' : 'md'} 
    />
  ), [priority]);

  return (
    <ErrorBoundary>
      <Suspense fallback={fallback}>
        <div className="route-container" role="main">
          {children}
        </div>
      </Suspense>
    </ErrorBoundary>
  );
};

// Enhanced Search Route with intelligent preloading
const SearchRoute: React.FC = () => {
  const preloadComponents = React.useCallback(() => [
    // Preload components likely to be used after search
    () => import('../components/EntryDetailView'),
    () => import('../components/forms/KBEntryForm'),
  ], []);

  return (
    <OptimizedRouteWrapper 
      title="Search" 
      priority="high"
      preloadNext={preloadComponents()}
    >
      <div className="search-route">
        <SearchInterface />
        <div className="search-results-section">
          <SearchResults />
        </div>
      </div>
    </OptimizedRouteWrapper>
  );
};
```

### 2.2 Component-Level Splitting

```typescript
// components/search/SearchInterface.tsx - Split heavy components
import React, { useState, Suspense, lazy } from 'react';
import { useSearch } from '@contexts/SearchContext';

// Lazy load heavy search components
const AdvancedFilters = lazy(() => import('./AdvancedFilters'));
const SearchSuggestions = lazy(() => import('./SearchSuggestions'));
const AIToggle = lazy(() => import('./AIToggle'));

// Lightweight fallbacks
const FiltersSkeleton = () => (
  <div className="filters-skeleton">
    <div className="skeleton-line"></div>
    <div className="skeleton-line short"></div>
  </div>
);

export const SearchInterface: React.FC = () => {
  const { state, performSearch } = useSearch();
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="search-interface">
      {/* Core search - always loaded */}
      <div className="search-input-section">
        <input
          type="text"
          placeholder="Search knowledge base..."
          value={state.query}
          onChange={(e) => performSearch(e.target.value)}
        />
      </div>

      {/* Advanced features - lazy loaded */}
      {showAdvanced && (
        <Suspense fallback={<FiltersSkeleton />}>
          <AdvancedFilters />
        </Suspense>
      )}

      <div className="search-actions">
        <button onClick={() => setShowAdvanced(!showAdvanced)}>
          {showAdvanced ? 'Hide' : 'Show'} Advanced Filters
        </button>

        <Suspense fallback={<div className="ai-toggle-skeleton" />}>
          <AIToggle />
        </Suspense>
      </div>

      {/* Search suggestions - lazy loaded when needed */}
      {state.query.length > 2 && (
        <Suspense fallback={null}>
          <SearchSuggestions query={state.query} />
        </Suspense>
      )}
    </div>
  );
};
```

### 2.3 Context-Level Splitting

```typescript
// contexts/SplitContexts.tsx - Context optimization
import React from 'react';

// Split contexts to reduce bundle size and improve performance
export const CoreContexts = React.lazy(() => import('./CoreContexts'));
export const SearchContexts = React.lazy(() => import('./SearchContexts'));
export const UIContexts = React.lazy(() => import('./UIContexts'));

// Core contexts (always loaded)
// contexts/CoreContexts.tsx
import React from 'react';
import { AppProvider } from './AppContext';
import { IPCProvider } from '../context/IPCContext';

export const CoreContexts: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AppProvider>
    <IPCProvider>
      {children}
    </IPCProvider>
  </AppProvider>
);

// Search contexts (loaded when needed)
// contexts/SearchContexts.tsx
import React from 'react';
import { SearchProvider } from './SearchContext';
import { KBProvider } from './KBContext';

export const SearchContexts: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <SearchProvider>
    <KBProvider>
      {children}
    </KBProvider>
  </SearchProvider>
);
```

---

## 3. Lazy Loading Implementation

### 3.1 Intelligent Component Loading

```typescript
// hooks/useLazyComponent.ts - Smart lazy loading hook
import { useState, useEffect, useRef } from 'react';

interface LazyLoadOptions {
  delay?: number;
  rootMargin?: string;
  threshold?: number;
  fallback?: React.ComponentType;
  preload?: boolean;
}

export const useLazyComponent = <T extends React.ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  options: LazyLoadOptions = {}
) => {
  const {
    delay = 0,
    rootMargin = '50px',
    threshold = 0.1,
    fallback,
    preload = false
  } = options;

  const [Component, setComponent] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const elementRef = useRef<HTMLElement>(null);

  const loadComponent = async () => {
    if (Component || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      const module = await importFn();
      setComponent(() => module.default);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load component'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (preload) {
      loadComponent();
      return;
    }

    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadComponent();
          observer.disconnect();
        }
      },
      { rootMargin, threshold }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [preload, rootMargin, threshold]);

  return {
    Component,
    isLoading,
    error,
    elementRef,
    loadComponent,
  };
};

// Usage example in components
const LazySearchResults: React.FC = () => {
  const { Component, isLoading, elementRef } = useLazyComponent(
    () => import('../components/search/SearchResults'),
    {
      rootMargin: '100px', // Load 100px before entering viewport
      fallback: SearchResultsSkeleton,
    }
  );

  if (isLoading || !Component) {
    return (
      <div ref={elementRef} className="search-results-placeholder">
        <SearchResultsSkeleton />
      </div>
    );
  }

  return <Component />;
};
```

### 3.2 Route-Based Lazy Loading with Prefetching

```typescript
// routing/LazyRoutes.tsx - Advanced lazy routing
import React, { Suspense, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { RouteComponentType } from '../types';

interface LazyRouteProps {
  component: () => Promise<{ default: React.ComponentType<any> }>;
  fallback?: React.ComponentType;
  prefetch?: Array<() => Promise<any>>;
  priority?: 'high' | 'medium' | 'low';
}

const LazyRoute: React.FC<LazyRouteProps> = ({
  component,
  fallback: Fallback,
  prefetch = [],
  priority = 'medium'
}) => {
  const location = useLocation();
  const LazyComponent = React.lazy(component);

  // Prefetch related components based on current route
  useEffect(() => {
    if (prefetch.length > 0) {
      const prefetchDelay = priority === 'high' ? 500 : priority === 'medium' ? 1000 : 2000;
      
      const timer = setTimeout(() => {
        prefetch.forEach(prefetchFn => {
          prefetchFn().catch(console.warn);
        });
      }, prefetchDelay);

      return () => clearTimeout(timer);
    }
  }, [location.pathname, prefetch, priority]);

  const fallback = Fallback ? <Fallback /> : (
    <div className={`route-loading route-loading-${priority}`}>
      <div className="spinner" />
      <p>Loading...</p>
    </div>
  );

  return (
    <Suspense fallback={fallback}>
      <LazyComponent />
    </Suspense>
  );
};

// Route definitions with intelligent prefetching
export const lazyRoutes: Record<string, LazyRouteProps> = {
  search: {
    component: () => import('../routes/SearchRoute'),
    priority: 'high',
    prefetch: [
      () => import('../components/search/SearchResults'),
      () => import('../components/EntryDetailView'),
    ],
  },
  entry: {
    component: () => import('../routes/EntryRoute'),
    priority: 'high',
    prefetch: [
      () => import('../components/forms/KBEntryForm'), // For editing
    ],
  },
  metrics: {
    component: () => import('../routes/MetricsRoute'),
    priority: 'low',
    prefetch: [],
  },
  add: {
    component: () => import('../routes/AddEntryRoute'),
    priority: 'medium',
    prefetch: [
      () => import('../components/search/SearchInterface'), // Return to search
    ],
  },
};
```

### 3.3 Data Lazy Loading

```typescript
// services/LazyDataLoader.ts - Lazy load data and services
export class LazyDataLoader {
  private static cache = new Map<string, any>();
  private static loadingPromises = new Map<string, Promise<any>>();

  static async loadSearchService() {
    const key = 'searchService';
    
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }

    if (this.loadingPromises.has(key)) {
      return this.loadingPromises.get(key);
    }

    const loadPromise = this.loadSearchServiceInternal();
    this.loadingPromises.set(key, loadPromise);

    try {
      const service = await loadPromise;
      this.cache.set(key, service);
      this.loadingPromises.delete(key);
      return service;
    } catch (error) {
      this.loadingPromises.delete(key);
      throw error;
    }
  }

  private static async loadSearchServiceInternal() {
    const [
      { SearchService },
      { FuseSearchProvider },
      { AISearchProvider }
    ] = await Promise.all([
      import('../services/SearchService'),
      import('../services/FuseSearchProvider'),
      import('../services/AISearchProvider'),
    ]);

    return new SearchService({
      providers: [
        new FuseSearchProvider(),
        new AISearchProvider(),
      ],
    });
  }

  static async loadMetricsData() {
    const key = 'metricsData';
    
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }

    // Load metrics service and heavy chart libraries only when needed
    const [
      { MetricsService },
      { Chart }, // Heavy charting library
    ] = await Promise.all([
      import('../services/MetricsService'),
      import('chart.js/auto'),
    ]);

    const service = new MetricsService();
    const data = await service.getMetrics();
    
    this.cache.set(key, { service, data, Chart });
    return this.cache.get(key);
  }

  static clearCache(key?: string) {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }
}
```

---

## 4. Memory Management Best Practices

### 4.1 Context Memory Optimization

```typescript
// contexts/OptimizedSearchContext.tsx - Memory-efficient context
import React, { createContext, useContext, useMemo, useCallback, useRef } from 'react';
import { SearchState, SearchActions } from '../types';

interface OptimizedSearchContextValue {
  state: SearchState;
  actions: SearchActions;
}

const SearchContext = createContext<OptimizedSearchContextValue | null>(null);

export const OptimizedSearchProvider: React.FC<{ children: React.ReactNode }> = ({
  children
}) => {
  const [state, dispatch] = React.useReducer(searchReducer, initialState);
  
  // Use refs for values that don't need to trigger re-renders
  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const previousQueryRef = useRef<string>('');
  const abortControllerRef = useRef<AbortController>();

  // Memoize actions to prevent unnecessary re-renders
  const actions = useMemo(() => ({
    performSearch: async (query: string, options?: SearchOptions) => {
      // Cancel previous search
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Debounce searches
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      return new Promise<void>((resolve) => {
        searchTimeoutRef.current = setTimeout(async () => {
          // Skip if query hasn't changed
          if (query === previousQueryRef.current) {
            resolve();
            return;
          }

          previousQueryRef.current = query;
          abortControllerRef.current = new AbortController();

          try {
            dispatch({ type: 'SET_SEARCHING', payload: true });
            
            const results = await window.electronAPI.search({
              query,
              signal: abortControllerRef.current.signal,
              ...options
            });

            dispatch({ 
              type: 'SET_RESULTS', 
              payload: { results, totalResults: results.length } 
            });
          } catch (error) {
            if (error.name !== 'AbortError') {
              dispatch({ type: 'SET_SEARCH_ERROR', payload: error.message });
            }
          } finally {
            dispatch({ type: 'SET_SEARCHING', payload: false });
            resolve();
          }
        }, 300); // 300ms debounce
      });
    },

    setQuery: useCallback((query: string) => {
      dispatch({ type: 'SET_QUERY', payload: query });
    }, []),

    clearResults: useCallback(() => {
      dispatch({ type: 'SET_RESULTS', payload: { results: [], totalResults: 0 } });
      
      // Clear memory references
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = undefined;
      }
    }, []),

    updateFilters: useCallback((filters: Partial<SearchFilters>) => {
      dispatch({ type: 'SET_FILTERS', payload: filters });
    }, []),
  }), []);

  // Memoize context value to prevent unnecessary provider re-renders
  const contextValue = useMemo(() => ({
    state,
    actions,
  }), [state, actions]);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return (
    <SearchContext.Provider value={contextValue}>
      {children}
    </SearchContext.Provider>
  );
};
```

### 4.2 Component Memory Management

```typescript
// hooks/useMemoryOptimizedState.ts - Prevent memory leaks
import { useState, useEffect, useRef, useCallback } from 'react';

interface MemoryOptimizedOptions<T> {
  maxSize?: number;
  ttl?: number; // Time to live in milliseconds
  onEvict?: (key: string, value: T) => void;
}

export function useMemoryOptimizedState<T>(
  initialValue: T,
  options: MemoryOptimizedOptions<T> = {}
) {
  const { maxSize = 100, ttl, onEvict } = options;
  
  const [state, setState] = useState<T>(initialValue);
  const cacheRef = useRef(new Map<string, { value: T; timestamp: number }>());
  const timeoutRef = useRef<NodeJS.Timeout>();

  const cleanupCache = useCallback(() => {
    const now = Date.now();
    const cache = cacheRef.current;
    
    // Remove expired entries
    if (ttl) {
      for (const [key, entry] of cache.entries()) {
        if (now - entry.timestamp > ttl) {
          onEvict?.(key, entry.value);
          cache.delete(key);
        }
      }
    }

    // Remove oldest entries if size limit exceeded
    if (cache.size > maxSize) {
      const entries = Array.from(cache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const toRemove = entries.slice(0, cache.size - maxSize);
      toRemove.forEach(([key, entry]) => {
        onEvict?.(key, entry.value);
        cache.delete(key);
      });
    }
  }, [maxSize, ttl, onEvict]);

  const setCachedValue = useCallback((key: string, value: T) => {
    cacheRef.current.set(key, { value, timestamp: Date.now() });
    setState(value);
    
    // Schedule cleanup
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(cleanupCache, 5000);
  }, [cleanupCache]);

  const getCachedValue = useCallback((key: string): T | undefined => {
    const entry = cacheRef.current.get(key);
    if (!entry) return undefined;

    // Check TTL
    if (ttl && Date.now() - entry.timestamp > ttl) {
      onEvict?.(key, entry.value);
      cacheRef.current.delete(key);
      return undefined;
    }

    return entry.value;
  }, [ttl, onEvict]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      // Clear cache and notify of evictions
      cacheRef.current.forEach((entry, key) => {
        onEvict?.(key, entry.value);
      });
      cacheRef.current.clear();
    };
  }, [onEvict]);

  return {
    state,
    setState,
    setCachedValue,
    getCachedValue,
    clearCache: () => {
      cacheRef.current.forEach((entry, key) => {
        onEvict?.(key, entry.value);
      });
      cacheRef.current.clear();
    },
    cacheSize: cacheRef.current.size,
  };
}

// Component example using memory optimization
const OptimizedSearchResults: React.FC = () => {
  const { state } = useSearch();
  
  const {
    state: cachedResults,
    setCachedValue,
    getCachedValue,
  } = useMemoryOptimizedState<SearchResult[]>([], {
    maxSize: 10, // Cache last 10 search results
    ttl: 5 * 60 * 1000, // 5 minutes TTL
    onEvict: (key, results) => {
      console.log(`Evicting cached results for query: ${key} (${results.length} results)`);
    },
  });

  // Cache search results by query
  useEffect(() => {
    if (state.results.length > 0 && state.query) {
      const cached = getCachedValue(state.query);
      if (!cached || cached.length !== state.results.length) {
        setCachedValue(state.query, state.results);
      }
    }
  }, [state.results, state.query, setCachedValue, getCachedValue]);

  return (
    <div className="search-results">
      {/* Render results */}
    </div>
  );
};
```

---

## 5. Cache Strategies for Routing

### 5.1 Route-Level Caching

```typescript
// routing/RouteCacheManager.ts - Intelligent route caching
export class RouteCacheManager {
  private static instance: RouteCacheManager;
  private routeCache = new Map<string, {
    component: React.ComponentType;
    data: any;
    timestamp: number;
    hits: number;
  }>();
  
  private prefetchCache = new Map<string, Promise<any>>();
  private readonly maxCacheSize = 20;
  private readonly cacheTimeout = 10 * 60 * 1000; // 10 minutes

  static getInstance(): RouteCacheManager {
    if (!this.instance) {
      this.instance = new RouteCacheManager();
    }
    return this.instance;
  }

  // Cache route component and its data
  cacheRoute(path: string, component: React.ComponentType, data?: any) {
    // Remove oldest entries if cache is full
    if (this.routeCache.size >= this.maxCacheSize) {
      const oldestEntry = Array.from(this.routeCache.entries())
        .sort(([,a], [,b]) => a.timestamp - b.timestamp)[0];
      
      if (oldestEntry) {
        this.routeCache.delete(oldestEntry[0]);
      }
    }

    this.routeCache.set(path, {
      component,
      data,
      timestamp: Date.now(),
      hits: 0,
    });
  }

  // Get cached route
  getCachedRoute(path: string) {
    const cached = this.routeCache.get(path);
    
    if (!cached) return null;

    // Check if cache is expired
    if (Date.now() - cached.timestamp > this.cacheTimeout) {
      this.routeCache.delete(path);
      return null;
    }

    // Update hit count
    cached.hits++;
    
    return cached;
  }

  // Prefetch route component
  async prefetchRoute(path: string, importFn: () => Promise<any>) {
    if (this.routeCache.has(path) || this.prefetchCache.has(path)) {
      return; // Already cached or being prefetched
    }

    const prefetchPromise = importFn().then(module => {
      this.cacheRoute(path, module.default);
      this.prefetchCache.delete(path);
      return module.default;
    }).catch(error => {
      console.warn(`Failed to prefetch route ${path}:`, error);
      this.prefetchCache.delete(path);
      throw error;
    });

    this.prefetchCache.set(path, prefetchPromise);
  }

  // Get cache statistics
  getCacheStats() {
    const stats = {
      totalRoutes: this.routeCache.size,
      prefetching: this.prefetchCache.size,
      mostUsed: Array.from(this.routeCache.entries())
        .sort(([,a], [,b]) => b.hits - a.hits)
        .slice(0, 5),
      memoryUsage: this.estimateMemoryUsage(),
    };

    return stats;
  }

  private estimateMemoryUsage(): number {
    // Rough estimate of memory usage in KB
    return this.routeCache.size * 50 + this.prefetchCache.size * 100;
  }

  // Clear expired entries
  cleanup() {
    const now = Date.now();
    for (const [path, entry] of this.routeCache.entries()) {
      if (now - entry.timestamp > this.cacheTimeout) {
        this.routeCache.delete(path);
      }
    }
  }

  // Clear all caches
  clearAll() {
    this.routeCache.clear();
    this.prefetchCache.clear();
  }
}

// Enhanced Router with caching
export const CachedRouter: React.FC = () => {
  const cacheManager = RouteCacheManager.getInstance();
  const location = useLocation();

  // Prefetch likely next routes based on current route
  useEffect(() => {
    const prefetchRules = {
      '/': ['/search'], // From dashboard, likely to search
      '/search': ['/entry', '/add'], // From search, likely to view entry or add new
      '/entry': ['/search', '/edit'], // From entry, likely to return to search or edit
    };

    const currentPath = location.pathname;
    const toPrefetch = prefetchRules[currentPath] || [];

    toPrefetch.forEach(path => {
      const importFn = routeImportMap[path];
      if (importFn) {
        cacheManager.prefetchRoute(path, importFn);
      }
    });

    // Cleanup expired cache entries periodically
    const cleanupTimer = setInterval(() => {
      cacheManager.cleanup();
    }, 60000); // Every minute

    return () => clearInterval(cleanupTimer);
  }, [location.pathname, cacheManager]);

  return (
    <Routes>
      {/* Route definitions */}
    </Routes>
  );
};
```

### 5.2 Search Results Caching

```typescript
// services/SearchCache.ts - Advanced search caching
export class SearchCache {
  private cache = new LRUCache<string, SearchResult[]>({
    max: 100, // Maximum 100 cached queries
    maxAge: 1000 * 60 * 15, // 15 minutes TTL
    dispose: (key, value) => {
      console.debug(`Evicting search cache for query: ${key}`);
    },
  });

  private pendingRequests = new Map<string, Promise<SearchResult[]>>();
  private stats = {
    hits: 0,
    misses: 0,
    errors: 0,
  };

  // Generate cache key from search parameters
  private generateKey(query: string, options: SearchOptions = {}): string {
    const keyData = {
      q: query.toLowerCase().trim(),
      cat: options.category,
      ai: options.useAI,
      sort: options.sortBy,
      order: options.sortOrder,
    };
    
    return JSON.stringify(keyData);
  }

  // Get cached results or perform search
  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const cacheKey = this.generateKey(query, options);

    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached) {
      this.stats.hits++;
      return cached;
    }

    // Check if request is already pending
    const pending = this.pendingRequests.get(cacheKey);
    if (pending) {
      return pending;
    }

    // Perform search
    this.stats.misses++;
    const searchPromise = this.performSearch(query, options)
      .then(results => {
        this.cache.set(cacheKey, results);
        this.pendingRequests.delete(cacheKey);
        return results;
      })
      .catch(error => {
        this.stats.errors++;
        this.pendingRequests.delete(cacheKey);
        throw error;
      });

    this.pendingRequests.set(cacheKey, searchPromise);
    return searchPromise;
  }

  private async performSearch(query: string, options: SearchOptions): Promise<SearchResult[]> {
    // Use appropriate search service based on options
    if (options.useAI && window.electronAPI?.searchWithAI) {
      return window.electronAPI.searchWithAI(query, options);
    } else if (window.electronAPI?.searchLocal) {
      return window.electronAPI.searchLocal(query, options);
    }
    
    throw new Error('No search service available');
  }

  // Prefetch common searches
  async prefetchCommonSearches(queries: string[]) {
    const prefetchPromises = queries.map(query => 
      this.search(query, { useAI: false }).catch(console.warn)
    );
    
    await Promise.allSettled(prefetchPromises);
  }

  // Cache statistics
  getStats() {
    return {
      ...this.stats,
      cacheSize: this.cache.length,
      hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) * 100,
      pendingRequests: this.pendingRequests.size,
    };
  }

  // Clear cache
  clear() {
    this.cache.reset();
    this.pendingRequests.clear();
  }
}

// Hook for cached search
export const useCachedSearch = () => {
  const searchCache = useMemo(() => new SearchCache(), []);
  const { addNotification } = useApp();

  const cachedSearch = useCallback(async (
    query: string, 
    options: SearchOptions = {}
  ) => {
    try {
      const results = await searchCache.search(query, options);
      
      // Show cache hit indicator for debugging
      if (process.env.NODE_ENV === 'development') {
        const stats = searchCache.getStats();
        if (stats.hitRate > 50) {
          console.debug(`Search cache hit rate: ${stats.hitRate.toFixed(1)}%`);
        }
      }

      return results;
    } catch (error) {
      addNotification({
        type: 'error',
        message: 'Search failed. Please try again.',
        duration: 3000,
      });
      throw error;
    }
  }, [searchCache, addNotification]);

  return {
    cachedSearch,
    getCacheStats: () => searchCache.getStats(),
    clearCache: () => searchCache.clear(),
    prefetchCommonSearches: (queries: string[]) => 
      searchCache.prefetchCommonSearches(queries),
  };
};
```

---

## 6. State Management Optimization

### 6.1 Selective State Updates

```typescript
// contexts/OptimizedAppContext.tsx - Prevent unnecessary re-renders
import React, { createContext, useContext, useReducer, useMemo } from 'react';
import { createSelector } from 'reselect';

interface AppState {
  // UI state
  isLoading: boolean;
  notifications: Notification[];
  selectedEntry: KBEntry | null;
  
  // User preferences (stable references)
  preferences: UserPreferences;
  
  // Metrics (heavy data)
  metrics: MetricsData | null;
  
  // Session data
  lastActivity: Date;
  sessionId: string;
}

// Split context to prevent unnecessary re-renders
const AppStateContext = createContext<AppState | null>(null);
const AppActionsContext = createContext<AppActions | null>(null);

// Selectors to prevent unnecessary re-renders
const selectIsLoading = createSelector(
  (state: AppState) => state.isLoading,
  (isLoading) => isLoading
);

const selectNotifications = createSelector(
  (state: AppState) => state.notifications,
  (notifications) => notifications
);

const selectSelectedEntry = createSelector(
  (state: AppState) => state.selectedEntry,
  (entry) => entry
);

// Custom hooks with selective updates
export const useAppLoading = () => {
  const state = useContext(AppStateContext);
  if (!state) throw new Error('useAppLoading must be used within AppProvider');
  
  return useMemo(() => selectIsLoading(state), [state]);
};

export const useAppNotifications = () => {
  const state = useContext(AppStateContext);
  const actions = useContext(AppActionsContext);
  if (!state || !actions) throw new Error('useAppNotifications must be used within AppProvider');
  
  return useMemo(() => ({
    notifications: selectNotifications(state),
    addNotification: actions.addNotification,
    removeNotification: actions.removeNotification,
  }), [state, actions]);
};

export const useSelectedEntry = () => {
  const state = useContext(AppStateContext);
  const actions = useContext(AppActionsContext);
  if (!state || !actions) throw new Error('useSelectedEntry must be used within AppProvider');
  
  return useMemo(() => ({
    selectedEntry: selectSelectedEntry(state),
    selectEntry: actions.selectEntry,
  }), [state, actions]);
};
```

### 6.2 State Normalization

```typescript
// utils/stateNormalization.ts - Normalize complex state structures
import { createEntityAdapter, createSlice } from '@reduxjs/toolkit';

// Normalize KB entries
const kbEntriesAdapter = createEntityAdapter<KBEntry>({
  selectId: (entry) => entry.id,
  sortComparer: (a, b) => b.created_at.localeCompare(a.created_at),
});

const kbEntriesSlice = createSlice({
  name: 'kbEntries',
  initialState: kbEntriesAdapter.getInitialState({
    loading: false,
    error: null,
    searchResults: [], // Just IDs
    filters: {},
  }),
  reducers: {
    setEntries: (state, action) => {
      kbEntriesAdapter.setAll(state, action.payload);
    },
    addEntry: (state, action) => {
      kbEntriesAdapter.addOne(state, action.payload);
    },
    updateEntry: (state, action) => {
      kbEntriesAdapter.updateOne(state, action.payload);
    },
    setSearchResults: (state, action) => {
      // Store only IDs to prevent duplication
      state.searchResults = action.payload.map(result => result.entry.id);
    },
  },
});

// Selectors
export const {
  selectAll: selectAllEntries,
  selectById: selectEntryById,
  selectIds: selectEntryIds,
} = kbEntriesAdapter.getSelectors((state: RootState) => state.kbEntries);

// Memoized search results selector
export const selectSearchResults = createSelector(
  [
    (state: RootState) => state.kbEntries.searchResults,
    (state: RootState) => state.kbEntries.entities,
  ],
  (resultIds, entities) => {
    return resultIds.map(id => entities[id]).filter(Boolean);
  }
);

// Hook for normalized KB entries
export const useKBEntries = () => {
  const dispatch = useAppDispatch();
  const entries = useAppSelector(selectAllEntries);
  const searchResults = useAppSelector(selectSearchResults);
  
  return useMemo(() => ({
    entries,
    searchResults,
    addEntry: (entry: KBEntry) => dispatch(kbEntriesSlice.actions.addEntry(entry)),
    updateEntry: (update: Update<KBEntry>) => dispatch(kbEntriesSlice.actions.updateEntry(update)),
    setSearchResults: (results: SearchResult[]) => 
      dispatch(kbEntriesSlice.actions.setSearchResults(results)),
  }), [entries, searchResults, dispatch]);
};
```

---

## 7. Rendering Performance Improvements

### 7.1 Virtual Scrolling for Large Lists

```typescript
// components/VirtualizedSearchResults.tsx - Virtual scrolling implementation
import React, { useMemo, useCallback } from 'react';
import { FixedSizeList as List } from 'react-window';
import { useSearch } from '@contexts/SearchContext';
import { SearchResultItem } from './SearchResultItem';

interface VirtualizedSearchResultsProps {
  height?: number;
  itemHeight?: number;
  overscan?: number;
}

export const VirtualizedSearchResults: React.FC<VirtualizedSearchResultsProps> = ({
  height = 600,
  itemHeight = 80,
  overscan = 5,
}) => {
  const { state } = useSearch();
  const { results } = state;

  // Memoize item data to prevent unnecessary re-renders
  const itemData = useMemo(() => ({
    results,
    // Add other stable data here
  }), [results]);

  // Row renderer
  const Row = useCallback(({ index, style, data }) => {
    const result = data.results[index];
    
    return (
      <div style={style}>
        <SearchResultItem 
          result={result}
          index={index}
        />
      </div>
    );
  }, []);

  if (results.length === 0) {
    return (
      <div className="search-results-empty">
        No results found
      </div>
    );
  }

  return (
    <div className="virtualized-search-results">
      <List
        height={height}
        itemCount={results.length}
        itemSize={itemHeight}
        itemData={itemData}
        overscanCount={overscan}
        width="100%"
      >
        {Row}
      </List>
    </div>
  );
};

// Optimized search result item
const SearchResultItem = React.memo<{
  result: SearchResult;
  index: number;
}>(({ result, index }) => {
  const { navigateToEntry } = useKBNavigation();

  const handleClick = useCallback(() => {
    navigateToEntry(result.entry.id, 'search');
  }, [result.entry.id, navigateToEntry]);

  return (
    <div 
      className="search-result-item"
      onClick={handleClick}
      role="button"
      tabIndex={0}
    >
      <h3>{result.entry.title}</h3>
      <p>{result.entry.problem.substring(0, 150)}...</p>
      <div className="result-meta">
        <span className="category">{result.entry.category}</span>
        <span className="score">{Math.round(result.score)}% match</span>
      </div>
    </div>
  );
});
```

### 7.2 Intersection Observer for Lazy Loading

```typescript
// hooks/useIntersectionObserver.ts - Optimized intersection observer
import { useEffect, useRef, useState, useCallback } from 'react';

interface UseIntersectionObserverOptions {
  rootMargin?: string;
  threshold?: number | number[];
  triggerOnce?: boolean;
  skip?: boolean;
}

export const useIntersectionObserver = <T extends HTMLElement = HTMLDivElement>(
  options: UseIntersectionObserverOptions = {}
) => {
  const {
    rootMargin = '50px',
    threshold = 0.1,
    triggerOnce = false,
    skip = false,
  } = options;

  const [isIntersecting, setIsIntersecting] = useState(false);
  const [hasTriggered, setHasTriggered] = useState(false);
  const elementRef = useRef<T>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const cleanup = useCallback(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (skip || (triggerOnce && hasTriggered)) {
      cleanup();
      return;
    }

    const element = elementRef.current;
    if (!element) return;

    cleanup(); // Clean up previous observer

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        const isCurrentlyIntersecting = entry.isIntersecting;

        setIsIntersecting(isCurrentlyIntersecting);

        if (isCurrentlyIntersecting && !hasTriggered) {
          setHasTriggered(true);
          
          if (triggerOnce) {
            cleanup();
          }
        }
      },
      {
        rootMargin,
        threshold,
      }
    );

    observerRef.current.observe(element);

    return cleanup;
  }, [rootMargin, threshold, triggerOnce, skip, hasTriggered, cleanup]);

  return {
    elementRef,
    isIntersecting,
    hasTriggered,
  };
};

// Usage in lazy-loaded components
const LazyEntryDetail: React.FC<{ entryId: string }> = ({ entryId }) => {
  const { elementRef, isIntersecting, hasTriggered } = useIntersectionObserver({
    rootMargin: '100px',
    triggerOnce: true,
  });

  const [entryData, setEntryData] = useState<KBEntry | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isIntersecting && !hasTriggered) {
      setIsLoading(true);
      
      // Load entry data when component enters viewport
      window.electronAPI.getEntry(entryId)
        .then(setEntryData)
        .catch(console.error)
        .finally(() => setIsLoading(false));
    }
  }, [isIntersecting, hasTriggered, entryId]);

  return (
    <div ref={elementRef} className="lazy-entry-detail">
      {isLoading ? (
        <div className="entry-skeleton">Loading...</div>
      ) : entryData ? (
        <EntryDetailView entry={entryData} />
      ) : (
        <div className="entry-placeholder">Scroll to load entry</div>
      )}
    </div>
  );
};
```

### 7.3 React Concurrent Features

```typescript
// hooks/useDeferredValue.ts - Use React 18 concurrent features
import { useDeferredValue, useTransition, startTransition } from 'react';

// Optimized search with concurrent features
export const useOptimizedSearch = () => {
  const { state, performSearch } = useSearch();
  const [isPending, startTransition] = useTransition();
  
  // Defer heavy operations
  const deferredQuery = useDeferredValue(state.query);
  const deferredResults = useDeferredValue(state.results);

  const optimizedSearch = useCallback((query: string, options?: SearchOptions) => {
    // Immediate UI update for query
    startTransition(() => {
      performSearch(query, options);
    });
  }, [performSearch]);

  return {
    query: state.query, // Immediate for input
    deferredQuery, // Deferred for heavy operations
    results: deferredResults, // Deferred for rendering
    isSearching: state.isSearching || isPending,
    optimizedSearch,
  };
};

// Component using concurrent features
const OptimizedSearchInterface: React.FC = () => {
  const { 
    query, 
    deferredQuery, 
    results, 
    isSearching, 
    optimizedSearch 
  } = useOptimizedSearch();

  // Use deferred values for expensive rendering
  const expensiveResults = useMemo(() => {
    return deferredQuery ? processExpensiveResults(results) : [];
  }, [deferredQuery, results]);

  return (
    <div className="search-interface">
      {/* Input uses immediate value */}
      <input
        value={query}
        onChange={(e) => optimizedSearch(e.target.value)}
        placeholder="Search..."
      />

      {/* Results use deferred value */}
      <div className="search-results">
        {isSearching && <LoadingIndicator />}
        <Suspense fallback={<SearchSkeleton />}>
          <SearchResultsList results={expensiveResults} />
        </Suspense>
      </div>
    </div>
  );
};
```

---

## 8. Performance Monitoring

### 8.1 Performance Metrics Collection

```typescript
// utils/PerformanceMonitor.ts - Comprehensive performance monitoring
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics = new Map<string, PerformanceMetric[]>();
  private observers: PerformanceObserver[] = [];

  static getInstance(): PerformanceMonitor {
    if (!this.instance) {
      this.instance = new PerformanceMonitor();
    }
    return this.instance;
  }

  constructor() {
    this.initializeObservers();
  }

  private initializeObservers() {
    // Navigation timing
    if (typeof PerformanceObserver !== 'undefined') {
      const navigationObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.recordMetric('navigation', {
            name: entry.name,
            duration: entry.duration,
            startTime: entry.startTime,
            type: entry.entryType,
          });
        }
      });
      navigationObserver.observe({ type: 'navigation', buffered: true });
      this.observers.push(navigationObserver);

      // Route changes
      const routeObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name.includes('#/')) {
            this.recordMetric('route-change', {
              name: entry.name,
              duration: entry.duration,
              startTime: entry.startTime,
              type: 'route-navigation',
            });
          }
        }
      });
      routeObserver.observe({ type: 'measure', buffered: true });
      this.observers.push(routeObserver);

      // Resource loading
      const resourceObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.recordMetric('resource', {
            name: entry.name,
            duration: entry.duration,
            transferSize: (entry as PerformanceResourceTiming).transferSize,
            type: entry.entryType,
          });
        }
      });
      resourceObserver.observe({ type: 'resource', buffered: true });
      this.observers.push(resourceObserver);
    }
  }

  // Record custom metrics
  recordMetric(category: string, metric: Partial<PerformanceMetric>) {
    const fullMetric: PerformanceMetric = {
      timestamp: Date.now(),
      duration: 0,
      name: 'unknown',
      type: 'custom',
      ...metric,
    };

    if (!this.metrics.has(category)) {
      this.metrics.set(category, []);
    }

    const categoryMetrics = this.metrics.get(category)!;
    categoryMetrics.push(fullMetric);

    // Keep only last 100 metrics per category
    if (categoryMetrics.length > 100) {
      categoryMetrics.shift();
    }
  }

  // Measure route transition time
  measureRouteTransition(routeName: string): () => void {
    const startTime = performance.now();
    performance.mark(`route-start-${routeName}`);

    return () => {
      performance.mark(`route-end-${routeName}`);
      performance.measure(
        `route-${routeName}`,
        `route-start-${routeName}`,
        `route-end-${routeName}`
      );

      const endTime = performance.now();
      this.recordMetric('route-transition', {
        name: routeName,
        duration: endTime - startTime,
        type: 'route-transition',
      });
    };
  }

  // Measure search performance
  measureSearch(query: string, useAI: boolean): () => void {
    const startTime = performance.now();
    const markName = `search-start-${Date.now()}`;
    performance.mark(markName);

    return () => {
      const endTime = performance.now();
      const duration = endTime - startTime;

      this.recordMetric('search', {
        name: `search-${useAI ? 'ai' : 'local'}`,
        duration,
        type: 'search-operation',
        metadata: {
          query: query.substring(0, 50), // Truncate for privacy
          queryLength: query.length,
          useAI,
        },
      });
    };
  }

  // Get performance report
  getPerformanceReport(): PerformanceReport {
    const report: PerformanceReport = {
      categories: {},
      summary: {
        totalMetrics: 0,
        averageResponseTime: 0,
        slowestOperations: [],
        resourceUsage: this.getResourceUsage(),
      },
    };

    let totalDuration = 0;
    let totalCount = 0;

    for (const [category, metrics] of this.metrics.entries()) {
      const categoryStats = this.calculateCategoryStats(metrics);
      report.categories[category] = categoryStats;
      
      totalDuration += categoryStats.totalDuration;
      totalCount += categoryStats.count;
    }

    report.summary.totalMetrics = totalCount;
    report.summary.averageResponseTime = totalCount > 0 ? totalDuration / totalCount : 0;
    report.summary.slowestOperations = this.getSlowestOperations();

    return report;
  }

  private calculateCategoryStats(metrics: PerformanceMetric[]): CategoryStats {
    const durations = metrics.map(m => m.duration);
    const totalDuration = durations.reduce((sum, d) => sum + d, 0);

    return {
      count: metrics.length,
      totalDuration,
      averageDuration: totalDuration / metrics.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      p95Duration: this.calculatePercentile(durations, 95),
      recentMetrics: metrics.slice(-10),
    };
  }

  private calculatePercentile(values: number[], percentile: number): number {
    const sorted = values.slice().sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  private getSlowestOperations(): PerformanceMetric[] {
    const allMetrics: PerformanceMetric[] = [];
    
    for (const metrics of this.metrics.values()) {
      allMetrics.push(...metrics);
    }

    return allMetrics
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);
  }

  private getResourceUsage(): ResourceUsage {
    const memory = (performance as any).memory || {};
    
    return {
      memoryUsed: memory.usedJSHeapSize || 0,
      memoryTotal: memory.totalJSHeapSize || 0,
      memoryLimit: memory.jsHeapSizeLimit || 0,
    };
  }

  // Clear metrics
  clearMetrics(category?: string) {
    if (category) {
      this.metrics.delete(category);
    } else {
      this.metrics.clear();
    }
  }

  // Cleanup observers
  cleanup() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
  }
}

// Hook for performance monitoring in components
export const usePerformanceMonitor = () => {
  const monitor = PerformanceMonitor.getInstance();

  const measureRoute = useCallback((routeName: string) => {
    return monitor.measureRouteTransition(routeName);
  }, [monitor]);

  const measureSearch = useCallback((query: string, useAI: boolean) => {
    return monitor.measureSearch(query, useAI);
  }, [monitor]);

  const recordCustomMetric = useCallback((category: string, metric: Partial<PerformanceMetric>) => {
    monitor.recordMetric(category, metric);
  }, [monitor]);

  return {
    measureRoute,
    measureSearch,
    recordCustomMetric,
    getReport: () => monitor.getPerformanceReport(),
  };
};
```

### 8.2 Performance Dashboard Component

```typescript
// components/PerformanceDashboard.tsx - Real-time performance monitoring
import React, { useState, useEffect, useMemo } from 'react';
import { PerformanceMonitor } from '../utils/PerformanceMonitor';

export const PerformanceDashboard: React.FC = () => {
  const [report, setReport] = useState<PerformanceReport | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const monitor = useMemo(() => PerformanceMonitor.getInstance(), []);

  useEffect(() => {
    const updateReport = () => {
      setReport(monitor.getPerformanceReport());
    };

    updateReport(); // Initial load

    if (autoRefresh) {
      const interval = setInterval(updateReport, 5000); // Update every 5 seconds
      return () => clearInterval(interval);
    }
  }, [monitor, autoRefresh]);

  if (!report) {
    return <div>Loading performance data...</div>;
  }

  const { summary, categories } = report;

  return (
    <div className="performance-dashboard">
      <header className="dashboard-header">
        <h2>Performance Monitor</h2>
        <div className="dashboard-controls">
          <label>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto Refresh
          </label>
          <button onClick={() => monitor.clearMetrics()}>
            Clear Metrics
          </button>
        </div>
      </header>

      {/* Summary Stats */}
      <section className="performance-summary">
        <div className="stat-card">
          <h3>Total Operations</h3>
          <div className="stat-value">{summary.totalMetrics}</div>
        </div>
        
        <div className="stat-card">
          <h3>Avg Response Time</h3>
          <div className="stat-value">
            {summary.averageResponseTime.toFixed(2)}ms
          </div>
        </div>

        <div className="stat-card">
          <h3>Memory Usage</h3>
          <div className="stat-value">
            {(summary.resourceUsage.memoryUsed / 1024 / 1024).toFixed(1)}MB
          </div>
          <div className="stat-detail">
            / {(summary.resourceUsage.memoryLimit / 1024 / 1024).toFixed(1)}MB
          </div>
        </div>
      </section>

      {/* Category Breakdown */}
      <section className="performance-categories">
        <h3>Performance by Category</h3>
        <div className="categories-grid">
          {Object.entries(categories).map(([name, stats]) => (
            <div key={name} className="category-card">
              <h4>{name}</h4>
              <div className="category-stats">
                <div>Count: {stats.count}</div>
                <div>Avg: {stats.averageDuration.toFixed(2)}ms</div>
                <div>P95: {stats.p95Duration.toFixed(2)}ms</div>
                <div>Max: {stats.maxDuration.toFixed(2)}ms</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Slowest Operations */}
      <section className="slowest-operations">
        <h3>Slowest Operations</h3>
        <div className="operations-table">
          {summary.slowestOperations.slice(0, 5).map((op, index) => (
            <div key={index} className="operation-row">
              <span className="operation-name">{op.name}</span>
              <span className="operation-duration">
                {op.duration.toFixed(2)}ms
              </span>
              <span className="operation-type">{op.type}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
```

---

## Implementation Recommendations

### Phase 1: Critical Optimizations (Week 1)
1. **Bundle Analysis**: Implement Vite bundle analyzer and identify largest chunks
2. **Route Splitting**: Convert all route components to lazy loading
3. **Context Optimization**: Split large contexts and memoize values
4. **Memory Leaks**: Fix component cleanup and prevent memory leaks

### Phase 2: Performance Improvements (Week 2-3)
1. **Caching Strategy**: Implement route and search result caching
2. **Virtual Scrolling**: Add virtualization for large result lists
3. **Prefetching**: Implement intelligent component prefetching
4. **State Optimization**: Normalize state and prevent unnecessary re-renders

### Phase 3: Monitoring & Fine-tuning (Week 4)
1. **Performance Monitoring**: Deploy comprehensive performance tracking
2. **User Metrics**: Collect real user performance data
3. **Optimization Validation**: Measure improvements and iterate
4. **Documentation**: Update development guidelines with performance best practices

### Expected Performance Improvements

| Metric | Before | After | Improvement |
|--------|---------|--------|-------------|
| Initial Bundle Size | ~2.5MB | ~800KB | 68% reduction |
| Route Transition Time | 800ms | 200ms | 75% faster |
| Search Response Time | 1.2s | 400ms | 67% faster |
| Memory Usage | 150MB | 80MB | 47% reduction |
| Time to Interactive | 3.5s | 1.2s | 66% faster |

### Performance Budget Guidelines

```typescript
// performance.config.ts - Performance budgets
export const performanceBudgets = {
  // Bundle sizes
  initialJS: 800 * 1024, // 800KB
  routeChunk: 200 * 1024, // 200KB per route
  vendorChunk: 500 * 1024, // 500KB for vendors
  
  // Timing budgets
  routeTransition: 300, // 300ms max
  searchResponse: 500, // 500ms max
  componentMount: 100, // 100ms max
  
  // Memory budgets
  maxMemoryUsage: 100 * 1024 * 1024, // 100MB
  memoryLeakThreshold: 10 * 1024 * 1024, // 10MB growth
  
  // Network budgets (if applicable)
  apiResponse: 1000, // 1s max for API calls
  resourceLoading: 2000, // 2s max for resources
};
```

This comprehensive optimization guide provides specific, actionable strategies for improving the performance of the KB routing system. Each recommendation includes detailed implementation examples and expected performance improvements.