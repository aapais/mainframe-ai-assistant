# Reactive Data Layer Documentation

## Overview

The Reactive Data Layer provides a comprehensive state management solution optimized for Electron IPC communication. Built with Zustand and enhanced with custom IPC bridging, it offers:

- **Optimistic Updates** with automatic rollback on failure
- **Offline-First Operation** with sync queue management
- **Conflict Resolution** for concurrent modifications
- **Type-Safe** TypeScript implementation throughout
- **Performance Optimized** with selective re-renders
- **Comprehensive Error Handling** with retry mechanisms

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Reactive Data Layer                           │
├─────────────────────────────────────────────────────────────────┤
│  React Components                                               │
│       ↕️ (hooks)                                                │
│  useReactiveKB() Hook                                          │
│       ↕️ (state management)                                     │
│  Zustand Store (reactive-state.ts)                             │
│       ↕️ (IPC communication)                                    │
│  IPC Bridge (ipc-bridge.ts)                                    │
│       ↕️ (electron IPC)                                         │
│  Main Process (IPCManager)                                     │
│       ↕️ (database)                                             │
│  SQLite Database                                               │
└─────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Reactive State Store (`reactive-state.ts`)

The central Zustand store that manages all application state:

```typescript
import { useReactiveStore } from './stores/reactive-state';

// Access state
const entries = useReactiveStore(state => state.entries);
const isLoading = useReactiveStore(state => state.isLoading);

// Access actions
const { createEntry, updateEntry, deleteEntry } = useReactiveStore();
```

**Key Features:**
- Immutable state updates with Immer
- Persistent storage with selective serialization
- Development tools integration
- Subscription-based selectors for performance

### 2. IPC Bridge (`ipc-bridge.ts`)

Manages communication between renderer and main process:

```typescript
import { useIPCBridge } from './stores/ipc-bridge';

const { forceSync, getMetrics, isOnline } = useIPCBridge();
```

**Key Features:**
- Automatic sync with configurable intervals
- Network status monitoring
- Conflict detection and resolution
- Retry logic with exponential backoff
- Batch processing for performance

### 3. React Hook (`useReactiveKB.ts`)

Provides a convenient React interface:

```typescript
import { useReactiveKB } from '../hooks/useReactiveKB';

function MyComponent() {
  const {
    entries,
    createEntry,
    isLoading,
    syncStatus,
    searchEntries,
    filterByCategory
  } = useReactiveKB();

  // Component logic...
}
```

## Usage Examples

### Basic CRUD Operations

```typescript
import { useReactiveKB } from '../hooks/useReactiveKB';

function KnowledgeBaseManager() {
  const {
    entries,
    createEntry,
    updateEntry,
    deleteEntry,
    isLoading
  } = useReactiveKB();

  const handleCreate = async () => {
    try {
      await createEntry({
        title: 'New Entry',
        problem: 'Problem description',
        solution: 'Solution steps',
        category: 'JCL',
        tags: ['example']
      });
    } catch (error) {
      console.error('Create failed:', error);
    }
  };

  const handleUpdate = async (id: string) => {
    try {
      await updateEntry(id, {
        title: 'Updated Title',
        solution: 'Updated solution'
      });
    } catch (error) {
      console.error('Update failed:', error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteEntry(id);
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      <button onClick={handleCreate}>Create Entry</button>
      {entries.map(entry => (
        <div key={entry.id}>
          <h3>{entry.title}</h3>
          <button onClick={() => handleUpdate(entry.id)}>Update</button>
          <button onClick={() => handleDelete(entry.id)}>Delete</button>
        </div>
      ))}
    </div>
  );
}
```

### Optimistic Updates

```typescript
function OptimisticExample() {
  const {
    createEntry,
    optimisticOperations,
    rollbackOperation,
    retryOperation
  } = useReactiveKB();

  const handleOptimisticCreate = async () => {
    try {
      // This will show in UI immediately, then sync with server
      await createEntry({
        title: 'Optimistic Entry',
        problem: 'Will appear immediately',
        solution: 'Syncs in background',
        category: 'VSAM',
        tags: ['optimistic']
      }); // optimistic: true by default
    } catch (error) {
      // Error handling - entry will be rolled back automatically
      console.error('Optimistic create failed:', error);
    }
  };

  return (
    <div>
      <button onClick={handleOptimisticCreate}>Create (Optimistic)</button>

      {/* Show pending operations */}
      {optimisticOperations.map(op => (
        <div key={op.id} className="pending-operation">
          <span>Syncing {op.type}...</span>
          <button onClick={() => rollbackOperation(op.id)}>Cancel</button>
          <button onClick={() => retryOperation(op.id)}>Retry</button>
        </div>
      ))}
    </div>
  );
}
```

### Search and Filtering

```typescript
function SearchExample() {
  const {
    filteredEntries,
    searchEntries,
    filterByCategory,
    filterByTags,
    clearFilters,
    filters
  } = useReactiveKB();

  const handleSearch = (query: string) => {
    searchEntries(query);
  };

  const handleCategoryFilter = (category: string) => {
    filterByCategory(category);
  };

  return (
    <div>
      <input
        type="text"
        placeholder="Search entries..."
        onChange={(e) => handleSearch(e.target.value)}
      />

      <select onChange={(e) => handleCategoryFilter(e.target.value)}>
        <option value="">All Categories</option>
        <option value="JCL">JCL</option>
        <option value="VSAM">VSAM</option>
        <option value="DB2">DB2</option>
      </select>

      <button onClick={clearFilters}>Clear Filters</button>

      <div>
        <p>Filters: {JSON.stringify(filters)}</p>
        <p>Results: {filteredEntries.length} entries</p>

        {filteredEntries.map(entry => (
          <div key={entry.id}>
            <h3>{entry.title}</h3>
            <p>Category: {entry.category}</p>
            <p>Tags: {entry.tags?.join(', ')}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Offline Handling

```typescript
function OfflineExample() {
  const {
    syncStatus,
    forceBridgeSync,
    hasErrors,
    errors,
    dismissError
  } = useReactiveKB();

  return (
    <div>
      {/* Connection Status */}
      <div className={`status ${syncStatus.isOffline ? 'offline' : 'online'}`}>
        {syncStatus.isOffline ? '🔴 Offline' : '🟢 Online'}
        {syncStatus.isSyncing && ' (Syncing...)'}
      </div>

      {/* Sync Queue */}
      {syncStatus.syncQueueLength > 0 && (
        <div>
          {syncStatus.syncQueueLength} operations pending sync
          <button onClick={forceBridgeSync}>Force Sync</button>
        </div>
      )}

      {/* Error Handling */}
      {hasErrors && (
        <div className="errors">
          <h4>Sync Errors:</h4>
          {errors.map(error => (
            <div key={error.timestamp} className="error">
              <span>{error.message}</span>
              <button onClick={() => dismissError(error.timestamp.toString())}>
                Dismiss
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

### Batch Operations

```typescript
function BatchExample() {
  const {
    batchCreateEntries,
    batchUpdateEntries,
    batchDeleteEntries,
    entries
  } = useReactiveKB();

  const handleBatchCreate = async () => {
    const newEntries = [
      {
        title: 'Batch Entry 1',
        problem: 'Problem 1',
        solution: 'Solution 1',
        category: 'JCL' as const,
        tags: ['batch']
      },
      {
        title: 'Batch Entry 2',
        problem: 'Problem 2',
        solution: 'Solution 2',
        category: 'VSAM' as const,
        tags: ['batch']
      }
    ];

    try {
      await batchCreateEntries(newEntries);
      console.log('Batch create successful');
    } catch (error) {
      console.error('Batch create failed:', error);
    }
  };

  const handleBatchUpdate = async () => {
    const updates = entries.slice(0, 3).map(entry => ({
      id: entry.id,
      updates: { tags: [...(entry.tags || []), 'updated'] }
    }));

    try {
      await batchUpdateEntries(updates);
      console.log('Batch update successful');
    } catch (error) {
      console.error('Batch update failed:', error);
    }
  };

  const handleBatchDelete = async () => {
    const idsToDelete = entries.slice(0, 2).map(entry => entry.id);

    try {
      await batchDeleteEntries(idsToDelete);
      console.log('Batch delete successful');
    } catch (error) {
      console.error('Batch delete failed:', error);
    }
  };

  return (
    <div>
      <button onClick={handleBatchCreate}>Batch Create (2 entries)</button>
      <button onClick={handleBatchUpdate}>Batch Update (first 3)</button>
      <button onClick={handleBatchDelete}>Batch Delete (first 2)</button>
    </div>
  );
}
```

### Performance Monitoring

```typescript
function PerformanceExample() {
  const { getPerformanceMetrics } = useReactiveKB();
  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    const updateMetrics = () => {
      setMetrics(getPerformanceMetrics());
    };

    updateMetrics();
    const interval = setInterval(updateMetrics, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, [getPerformanceMetrics]);

  if (!metrics) return <div>Loading metrics...</div>;

  return (
    <div>
      <h3>Performance Metrics</h3>

      <div>
        <h4>Store Metrics:</h4>
        <p>Total Operations: {metrics.store.totalOperations}</p>
        <p>Success Rate: {((metrics.store.successfulOperations / metrics.store.totalOperations) * 100).toFixed(1)}%</p>
        <p>Average Response Time: {metrics.store.averageResponseTime.toFixed(2)}ms</p>
        <p>Optimistic Success Rate: {metrics.store.optimisticSuccessRate.toFixed(1)}%</p>
      </div>

      <div>
        <h4>IPC Bridge Metrics:</h4>
        <p>Total Requests: {metrics.bridge.totalRequests}</p>
        <p>Successful Requests: {metrics.bridge.successfulRequests}</p>
        <p>Failed Requests: {metrics.bridge.failedRequests}</p>
        <p>Sync Operations: {metrics.bridge.syncOperations}</p>
        <p>Conflicts Resolved: {metrics.bridge.conflictsResolved}</p>
      </div>

      <div>
        <h4>Combined Metrics:</h4>
        <p>Overall Success Rate: {metrics.combined.successRate.toFixed(1)}%</p>
        <p>Combined Response Time: {metrics.combined.averageResponseTime.toFixed(2)}ms</p>
      </div>
    </div>
  );
}
```

## Configuration

### IPC Bridge Configuration

```typescript
import { useIPCBridge } from '../stores/ipc-bridge';

// Custom configuration
const { updateConfig } = useIPCBridge({
  syncInterval: 30000,      // Sync every 30 seconds
  retryDelay: 2000,         // 2 second delay between retries
  maxRetries: 3,            // Maximum 3 retry attempts
  offlineTimeout: 5000,     // 5 second timeout for connectivity tests
  batchSize: 10,            // Process 10 operations per batch
  enableOptimisticUpdates: true,    // Enable optimistic updates
  enableConflictResolution: true,   // Enable automatic conflict resolution
  enablePerformanceMonitoring: true // Enable metrics collection
});

// Update configuration at runtime
updateConfig({
  syncInterval: 60000,      // Change to 1 minute
  maxRetries: 5             // Increase retry attempts
});
```

### Store Persistence Configuration

The store automatically persists state to localStorage. You can customize what gets persisted:

```typescript
// In reactive-state.ts, the persist middleware configuration:
{
  name: 'kb-reactive-store',
  storage: createJSONStorage(() => localStorage),
  partialize: (state) => ({
    // Only persist essential state
    entries: Array.from(state.entries.entries()),
    categories: state.categories,
    filters: state.filters,
    pagination: state.pagination,
    metrics: state.metrics,
    lastSyncTimestamp: state.lastSyncTimestamp,
  }),
}
```

## Advanced Features

### Custom Selectors

Create optimized selectors for specific use cases:

```typescript
import { useReactiveStore } from '../stores/reactive-state';
import { useMemo } from 'react';

function useCustomSelectors() {
  // Get only JCL entries
  const jclEntries = useReactiveStore(
    state => Array.from(state.entries.values()).filter(e => e.category === 'JCL'),
    // Shallow comparison for performance
    (a, b) => a.length === b.length && a.every((item, index) => item.id === b[index]?.id)
  );

  // Get error count
  const errorCount = useReactiveStore(state => state.errors.size);

  // Get sync status summary
  const syncSummary = useReactiveStore(state => ({
    isOnline: !state.isOffline,
    isSyncing: state.isSyncing,
    queueLength: state.syncQueue.length,
    lastSync: state.lastSyncTimestamp
  }));

  return { jclEntries, errorCount, syncSummary };
}
```

### Error Recovery Strategies

Implement custom error recovery:

```typescript
function useErrorRecovery() {
  const { errors, retryOperation, rollbackOperation, dismissError } = useReactiveKB();

  const handleErrorRecovery = useCallback(async (error) => {
    if (error.operation) {
      switch (error.operation.type) {
        case 'create':
          // For create operations, retry is usually safe
          try {
            await retryOperation(error.operation.id);
          } catch (retryError) {
            // If retry fails, rollback optimistic changes
            rollbackOperation(error.operation.id);
          }
          break;

        case 'update':
          // For updates, show user conflict resolution UI
          showConflictResolutionDialog(error);
          break;

        case 'delete':
          // For deletes, confirm with user before retry
          if (confirm('Retry delete operation?')) {
            await retryOperation(error.operation.id);
          } else {
            rollbackOperation(error.operation.id);
          }
          break;
      }
    }

    dismissError(error.id);
  }, [retryOperation, rollbackOperation, dismissError]);

  return { handleErrorRecovery };
}
```

## Testing

The reactive data layer includes comprehensive tests. Run them with:

```bash
npm test src/renderer/stores/__tests__/
```

### Test Coverage

- **reactive-state.test.ts**: Core store functionality
  - CRUD operations with optimistic updates
  - Batch operations
  - Error handling and recovery
  - Filter and pagination
  - Offline mode handling

- **ipc-bridge.test.ts**: IPC communication
  - Network status detection
  - Sync queue processing
  - Conflict resolution
  - Performance metrics
  - Configuration management

## Performance Considerations

1. **Selective Re-renders**: Use specific selectors to minimize re-renders
2. **Batch Operations**: Group multiple operations for better performance
3. **Optimistic Updates**: Improve perceived performance with immediate UI updates
4. **Caching**: Store results are automatically cached and persisted
5. **Memory Management**: Large datasets are handled efficiently with pagination

## Migration from Context-based State

If migrating from the existing Context-based state management:

1. Replace `useKBData()` with `useReactiveKB()`
2. Update component prop interfaces to match new hook API
3. Remove Context providers and replace with IPC bridge initialization
4. Update tests to use new store structure

## Best Practices

1. **Always use optimistic updates** for better UX
2. **Handle errors gracefully** with retry mechanisms
3. **Monitor performance metrics** in production
4. **Use batch operations** for multiple changes
5. **Implement proper loading states** for all operations
6. **Test offline scenarios** thoroughly

## Troubleshooting

### Common Issues

**Q: Operations are not syncing**
A: Check network connectivity and IPC bridge status. Use `forceBridgeSync()` to trigger manual sync.

**Q: Optimistic updates are not rolling back**
A: Ensure error handling is properly implemented and rollback data is stored correctly.

**Q: Performance is slow with large datasets**
A: Use pagination and specific selectors. Consider implementing virtual scrolling for large lists.

**Q: Conflicts are not resolving automatically**
A: Check conflict resolution configuration and ensure server timestamps are accurate.

For more detailed troubleshooting, enable development tools and monitor the console for detailed error messages and performance metrics.