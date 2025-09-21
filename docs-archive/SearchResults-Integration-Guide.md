# SearchResults Integration Guide

## Overview

This guide provides comprehensive documentation for integrating SearchResults with existing services and state management systems. The integration includes real-time search capabilities, advanced caching, monitoring, analytics, and WebSocket support.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Enhanced SearchResults Component             │
├─────────────────────────────────────────────────────────────────┤
│                SearchResults Integration Adapter               │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌────────────┐ │
│  │ SearchService│ │Caching Layer│ │WebSocket Svc│ │Analytics   │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌────────────┐ │
│  │State Mgmt   │ │Memory Store │ │Export Svc   │ │Monitoring  │ │
│  │(Zustand)    │ │Integration  │ │             │ │            │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Key Components

### 1. SearchResults Integration Adapter

**File:** `/src/services/SearchResultsIntegrationAdapter.ts`

The main integration adapter that provides a unified interface for all SearchResults interactions.

**Key Features:**
- Unified search interface with real-time capabilities
- Multi-layer caching integration
- State management synchronization
- Analytics and monitoring integration
- WebSocket real-time updates
- Export functionality
- Pagination and infinite scroll

**Usage:**
```typescript
import { useSearchResultsIntegration } from '../services/SearchResultsIntegrationAdapter';

const MyComponent = () => {
  const integration = useSearchResultsIntegration('ws://localhost:3001/search');

  // Perform search with caching and analytics
  const handleSearch = async (query: string) => {
    const results = await integration.performSearch(query, {
      useAI: true,
      category: 'JCL',
      includeHighlights: true
    });
  };

  // Subscribe to real-time updates
  React.useEffect(() => {
    const unsubscribe = integration.subscribeToUpdates((results) => {
      console.log('Real-time results update:', results);
    });

    return unsubscribe;
  }, []);
};
```

### 2. Enhanced SearchResults Component

**File:** `/src/components/search/EnhancedSearchResults.tsx`

A fully integrated SearchResults component with all advanced features.

**Features:**
- Virtual scrolling for performance
- Infinite scroll with backend integration
- Real-time updates via WebSocket
- Export functionality (JSON, CSV, Excel, PDF, Markdown)
- Selection management
- Performance metrics display
- Error handling and retry logic

**Usage:**
```typescript
import { EnhancedSearchResults } from '../components/search/EnhancedSearchResults';

const SearchPage = () => {
  const searchResultsRef = useRef<SearchResultsHandle>(null);

  const handleSearch = async (query: string) => {
    await searchResultsRef.current?.performSearch(query, {
      useAI: true,
      limit: 50
    });
  };

  return (
    <EnhancedSearchResults
      ref={searchResultsRef}
      enableRealTimeUpdates={true}
      enableInfiniteScroll={true}
      showExportOptions={true}
      websocketUrl="ws://localhost:3001/search"
      onResultSelect={(result, index) => {
        console.log('Selected result:', result);
      }}
    />
  );
};
```

### 3. Advanced Caching System

**File:** `/src/services/SearchCacheManager.ts`

Multi-layer caching system with L1 (memory), L2 (IndexedDB), and L3 (Service Worker) caches.

**Features:**
- LRU eviction policy
- TTL-based expiration
- Cache warming and prefetching
- Compression support
- Performance metrics
- Automatic cleanup

**Configuration:**
```typescript
const cacheManager = new SearchCacheManager({
  l1MaxSize: 100,        // Memory cache size
  l2MaxSize: 1000,       // IndexedDB cache size
  defaultTTL: 300000,    // 5 minutes
  compressionEnabled: true,
  persistentCacheEnabled: true,
  serviceWorkerCacheEnabled: false
});

// Warm cache with popular queries
await cacheManager.warmCache([
  { query: 'JCL error', options: { category: 'JCL' } },
  { query: 'VSAM status', options: { category: 'VSAM' } }
]);
```

### 4. WebSocket Real-time Service

**File:** `/src/services/SearchWebSocketService.ts`

Real-time communication service for live search updates and collaboration.

**Features:**
- Automatic reconnection with exponential backoff
- Message queuing and delivery guarantees
- Heartbeat monitoring
- Connection pooling
- Message prioritization

**Usage:**
```typescript
const { webSocketService, connectionStatus } = useSearchWebSocket({
  url: 'ws://localhost:3001/search',
  reconnectAttempts: 5,
  heartbeatInterval: 30000
});

// Subscribe to search updates
const unsubscribe = webSocketService.subscribeToSearchUpdates((update) => {
  console.log('Search update received:', update);
});

// Subscribe to KB changes
webSocketService.subscribeToKBChanges((change) => {
  console.log('KB entry changed:', change);
});

// Broadcast search activity
await webSocketService.broadcastSearchActivity('mainframe error', 15);
```

### 5. Analytics and Monitoring

**File:** `/src/services/SearchAnalyticsService.ts`

Comprehensive analytics and monitoring for search operations.

**Features:**
- Performance metrics tracking
- User behavior analytics
- Search quality metrics
- Error tracking and alerting
- A/B testing support
- Real-time monitoring dashboards

**Usage:**
```typescript
const analytics = new SearchAnalyticsService({
  enableTracking: true,
  enablePerformanceMonitoring: true,
  enableUserBehaviorTracking: true,
  batchSize: 50,
  retentionPeriod: 30 * 24 * 60 * 60 * 1000 // 30 days
});

// Track search operation
analytics.trackSearch(query, results, options, {
  query,
  searchTime: 150,
  resultCount: results.length,
  cacheHit: false,
  aiUsed: true
});

// Track user interaction
analytics.trackResultClick(result, position, query, dwellTime);

// Get performance metrics
const metrics = analytics.getPerformanceMetrics({
  from: Date.now() - 24 * 60 * 60 * 1000, // Last 24 hours
  to: Date.now()
});
```

### 6. Integration Memory Store

**File:** `/src/services/IntegrationMemoryStore.ts`

Centralized memory management for integration mappings and cross-component communication.

**Features:**
- Service connection management
- Configuration management
- Runtime state tracking
- Performance metrics storage
- Cross-component messaging
- Health monitoring

**Usage:**
```typescript
const memoryStore = new IntegrationMemoryStore({
  maxMappings: 1000,
  persistenceEnabled: true,
  encryptionEnabled: false
});

// Store integration mapping
const mappingId = memoryStore.storeIntegrationMapping({
  type: 'service-adapter',
  source: 'SearchResults',
  target: 'SearchService',
  status: 'active',
  config: { timeout: 5000, retries: 3 }
});

// Register service connection
memoryStore.registerServiceConnection({
  serviceId: 'search-service',
  serviceName: 'Enhanced Search Service',
  serviceType: 'search',
  configuration: { apiVersion: 'v2' },
  metrics: {
    requestCount: 0,
    errorCount: 0,
    averageResponseTime: 0,
    lastActivity: Date.now()
  }
});

// Store runtime state
memoryStore.storeRuntimeState('search-component', {
  query: 'current search',
  results: [],
  filters: { category: 'JCL' }
});
```

## Integration Patterns

### 1. State Management Integration

The integration supports both Redux and Zustand patterns:

**Zustand Integration:**
```typescript
import { useReactiveStore } from '../renderer/stores/reactive-state';

const SearchComponent = () => {
  const { entries, loadEntries, createEntry } = useReactiveStore();
  const integration = useSearchResultsIntegration();

  // Integrate with reactive store
  React.useEffect(() => {
    const allEntries = Array.from(entries.values());
    integration.updateSearchState({
      results: allEntries.map(entry => ({
        entry,
        score: 100,
        matchType: 'exact'
      }))
    });
  }, [entries]);
};
```

**Redux Integration:**
```typescript
import { useDispatch, useSelector } from 'react-redux';

const SearchComponent = () => {
  const dispatch = useDispatch();
  const searchState = useSelector(state => state.search);
  const integration = useSearchResultsIntegration();

  // Sync with Redux store
  React.useEffect(() => {
    integration.subscribeToUpdates((results) => {
      dispatch(updateSearchResults(results));
    });
  }, []);
};
```

### 2. Export Integration

Export functionality with multiple formats:

```typescript
const handleExport = async (format: 'json' | 'csv' | 'excel' | 'pdf' | 'markdown') => {
  try {
    const selectedResults = searchResultsRef.current?.getSelectedResults() || allResults;
    await searchResultsRef.current?.exportResults(format);

    // Analytics tracking
    analytics.trackExport(format, selectedResults.length, currentQuery);
  } catch (error) {
    console.error('Export failed:', error);
    analytics.trackError(error, { operation: 'export', format });
  }
};
```

### 3. Pagination and Infinite Scroll

Backend-integrated pagination:

```typescript
const SearchWithPagination = () => {
  const [hasMore, setHasMore] = useState(true);
  const integration = useSearchResultsIntegration();

  const loadMore = useCallback(async () => {
    if (!hasMore) return;

    const currentResults = integration.getSearchState().results;
    const moreResults = await integration.loadMoreResults(
      currentQuery,
      currentResults.length,
      20 // page size
    );

    setHasMore(moreResults.length === 20);
  }, [hasMore, currentQuery]);

  return (
    <InfiniteScroll
      dataLength={results.length}
      next={loadMore}
      hasMore={hasMore}
      loader={<div>Loading...</div>}
    >
      {/* Render results */}
    </InfiniteScroll>
  );
};
```

## Configuration

### Environment Variables

```bash
# WebSocket Configuration
WEBSOCKET_URL=ws://localhost:3001/search
WEBSOCKET_RECONNECT_ATTEMPTS=5
WEBSOCKET_HEARTBEAT_INTERVAL=30000

# Caching Configuration
CACHE_L1_SIZE=100
CACHE_L2_SIZE=1000
CACHE_DEFAULT_TTL=300000

# Analytics Configuration
ANALYTICS_ENABLED=true
ANALYTICS_BATCH_SIZE=50
ANALYTICS_RETENTION_PERIOD=2592000000

# Performance Configuration
PERFORMANCE_MONITORING=true
SEARCH_TIMEOUT=5000
MAX_RESULTS_PER_PAGE=50
```

### Configuration Files

**`config/search-integration.json`:**
```json
{
  "search": {
    "timeoutMs": 5000,
    "maxRetries": 3,
    "enableAI": true,
    "defaultPageSize": 50
  },
  "cache": {
    "l1MaxSize": 100,
    "l2MaxSize": 1000,
    "defaultTTL": 300000,
    "cleanupInterval": 300000
  },
  "webSocket": {
    "url": "ws://localhost:3001/search",
    "reconnectAttempts": 5,
    "reconnectDelay": 1000,
    "heartbeatInterval": 30000
  },
  "analytics": {
    "enabled": true,
    "batchSize": 50,
    "batchTimeout": 5000,
    "retentionPeriod": 2592000000
  }
}
```

## Performance Optimizations

### 1. Virtual Scrolling

Large result sets use virtual scrolling for optimal performance:

```typescript
// Automatically enabled for > 20 results
<EnhancedSearchResults
  enableInfiniteScroll={true}
  pageSize={50}
  // Virtual scrolling automatically handles large datasets
/>
```

### 2. Caching Strategy

Three-tier caching strategy:
- **L1 (Memory)**: Fastest access, limited size
- **L2 (IndexedDB)**: Persistent, larger capacity
- **L3 (Service Worker)**: Offline support

### 3. Debounced Operations

All search operations are automatically debounced to prevent excessive API calls:

```typescript
// Built-in debouncing (300ms default)
const debouncedSearch = useMemo(
  () => debounce(integration.performSearch, 300),
  [integration]
);
```

## Error Handling

### Comprehensive Error Recovery

```typescript
const SearchWithErrorHandling = () => {
  const [error, setError] = useState<string | null>(null);
  const integration = useSearchResultsIntegration();

  React.useEffect(() => {
    // Subscribe to integration errors
    integration.on('error', (error) => {
      setError(error.message);

      // Track error for analytics
      analytics.trackError(error, {
        operation: 'search',
        component: 'SearchResults'
      });
    });

    // Auto-retry logic
    integration.on('searchError', async (error) => {
      if (error.retryable && error.retryCount < 3) {
        setTimeout(() => {
          integration.performSearch(error.query, {
            ...error.options,
            force: true
          });
        }, 1000 * Math.pow(2, error.retryCount));
      }
    });
  }, []);
};
```

### Fallback Strategies

1. **AI to Local Search**: If AI search fails, automatically falls back to local search
2. **Cache Fallback**: If fresh data fails, serve from cache with warning
3. **Offline Mode**: Service worker cache enables offline search capabilities

## Monitoring and Alerting

### Real-time Monitoring

```typescript
// Set up monitoring dashboard
const monitoringDashboard = new SearchAnalyticsService({
  enableRealTimeMonitoring: true
});

// Custom alert rules
monitoringDashboard.addAlertRule({
  id: 'high-search-latency',
  name: 'High Search Latency',
  condition: (metrics) => metrics.searchLatency.p95 > 2000,
  severity: 'high',
  cooldownPeriod: 300000 // 5 minutes
});

// Listen for alerts
monitoringDashboard.on('alert', (alert) => {
  console.warn('Performance alert:', alert);
  // Send to monitoring service
});
```

### Health Checks

```typescript
// Automated health monitoring
const healthChecker = setInterval(async () => {
  const health = await integration.checkHealth();

  memoryStore.updateIntegrationHealth('search-integration', {
    lastCheck: Date.now(),
    status: health.healthy ? 'healthy' : 'degraded',
    latency: health.responseTime,
    errorRate: health.errorRate
  });
}, 30000); // Every 30 seconds
```

## Testing Strategy

### Unit Tests

```typescript
// Example test for integration adapter
describe('SearchResultsIntegrationAdapter', () => {
  it('should cache search results', async () => {
    const adapter = new SearchResultsIntegrationAdapter(mockSearchService);

    const results1 = await adapter.performSearch('test query');
    const results2 = await adapter.performSearch('test query');

    expect(results1).toEqual(results2);
    expect(mockSearchService.search).toHaveBeenCalledTimes(1);
  });

  it('should handle WebSocket reconnection', async () => {
    const adapter = new SearchResultsIntegrationAdapter(mockSearchService, 'ws://test');

    // Simulate connection drop
    adapter.webSocket.close();

    // Should automatically reconnect
    await new Promise(resolve => setTimeout(resolve, 2000));
    expect(adapter.getConnectionStatus()).toBe('open');
  });
});
```

### Integration Tests

```typescript
// End-to-end integration test
describe('SearchResults Integration', () => {
  it('should perform complete search workflow', async () => {
    render(
      <SearchProvider>
        <EnhancedSearchResults enableRealTimeUpdates={true} />
      </SearchProvider>
    );

    // Perform search
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'JCL error' }
    });

    // Wait for results
    await waitFor(() => {
      expect(screen.getByText(/Found \d+ results/)).toBeInTheDocument();
    });

    // Test export functionality
    fireEvent.click(screen.getByText('Export'));
    fireEvent.click(screen.getByText('JSON'));

    // Verify analytics tracking
    expect(mockAnalytics.trackSearch).toHaveBeenCalled();
    expect(mockAnalytics.trackExport).toHaveBeenCalled();
  });
});
```

## Migration Guide

### From Basic SearchResults

1. **Replace component import:**
```typescript
// Before
import { SearchResults } from '../components/search/SearchResults';

// After
import { EnhancedSearchResults } from '../components/search/EnhancedSearchResults';
```

2. **Update props:**
```typescript
// Before
<SearchResults
  results={results}
  searchQuery={query}
  onResultSelect={handleSelect}
/>

// After
<EnhancedSearchResults
  searchQuery={query}
  enableRealTimeUpdates={true}
  enableInfiniteScroll={true}
  showExportOptions={true}
  onResultSelect={handleSelect}
/>
```

3. **Add integration adapter:**
```typescript
const integration = useSearchResultsIntegration();

// Migration of existing search logic
const handleSearch = async (query: string) => {
  // Before: Direct service call
  // const results = await searchService.search(query, entries);

  // After: Integration adapter
  const results = await integration.performSearch(query);
};
```

## Troubleshooting

### Common Issues

1. **WebSocket Connection Failed**
   - Check WebSocket server is running
   - Verify URL and port configuration
   - Check firewall settings

2. **Cache Not Working**
   - Verify IndexedDB support in browser
   - Check storage quotas
   - Clear browser data if corrupted

3. **High Memory Usage**
   - Adjust cache sizes in configuration
   - Enable compression
   - Implement cache cleanup intervals

4. **Poor Search Performance**
   - Enable caching layers
   - Optimize database indexes
   - Use search result virtualization

### Debug Mode

Enable debug logging:

```typescript
const integration = useSearchResultsIntegration();

// Enable debug mode
integration.setConfig('debug', true);

// Monitor all events
integration.on('*', (event, data) => {
  console.log(`Integration event: ${event}`, data);
});
```

## Best Practices

1. **Always use the integration adapter** instead of calling services directly
2. **Enable caching** for production environments
3. **Monitor performance metrics** and set up alerts
4. **Use virtual scrolling** for large result sets
5. **Implement proper error handling** with fallback strategies
6. **Test WebSocket reconnection** scenarios
7. **Optimize cache sizes** based on usage patterns
8. **Use analytics** to understand user behavior
9. **Implement proper cleanup** in component unmount
10. **Keep integration mappings** in centralized memory store

## API Reference

See individual service files for detailed API documentation:
- [SearchResultsIntegrationAdapter](../src/services/SearchResultsIntegrationAdapter.ts)
- [SearchCacheManager](../src/services/SearchCacheManager.ts)
- [SearchWebSocketService](../src/services/SearchWebSocketService.ts)
- [SearchAnalyticsService](../src/services/SearchAnalyticsService.ts)
- [IntegrationMemoryStore](../src/services/IntegrationMemoryStore.ts)