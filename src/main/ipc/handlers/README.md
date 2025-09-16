# Categorization and Tagging API Handlers

This directory contains comprehensive IPC handlers for the flexible categorization and tagging system. The implementation provides RESTful-style API endpoints through Electron's IPC system with full transaction support, real-time updates, and intelligent autocomplete capabilities.

## Overview

The categorization and tagging system consists of several interconnected handlers:

- **CategoryHandler**: Hierarchical category management
- **TagHandler**: Tag CRUD operations and associations
- **AutocompleteHandler**: Intelligent search suggestions
- **BulkOperationsHandler**: Transaction-safe bulk operations
- **RealtimeHandler**: WebSocket/SSE-style real-time updates

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    IPC Handler Architecture                     │
├─────────────────────────────────────────────────────────────────┤
│  Frontend (Renderer)                                           │
│  ├── CategoryService (API Client)                              │
│  ├── TagService (API Client)                                   │
│  ├── AutocompleteService (API Client)                          │
│  └── RealtimeService (API Client)                              │
│                                                                 │
│  ←→ IPC Communication ←→                                        │
│                                                                 │
│  Backend (Main Process)                                         │
│  ├── CategoryHandler                                            │
│  ├── TagHandler                                                 │
│  ├── AutocompleteHandler                                        │
│  ├── BulkOperationsHandler                                      │
│  ├── RealtimeHandler                                            │
│  └── HandlerIntegration                                         │
│                                                                 │
│  Services Layer                                                 │
│  ├── CategoryService                                            │
│  ├── TagService                                                 │
│  └── AutocompleteService                                        │
│                                                                 │
│  Repository Layer                                               │
│  ├── CategoryRepository                                         │
│  └── TagRepository                                              │
│                                                                 │
│  Database Layer                                                 │
│  └── SQLite with FTS5 + Hierarchical Schema                    │
└─────────────────────────────────────────────────────────────────┘
```

## API Endpoints

### Category Management

#### Create Category
```typescript
// IPC Channel: 'category:create'
interface CategoryCreateRequest {
  category: {
    name: string;
    description?: string;
    parent_id?: string;
    color?: string;
    icon?: string;
    metadata?: Record<string, any>;
  };
  options?: {
    validateParent?: boolean;
    checkDuplicates?: boolean;
  };
}

// Example usage:
const response = await ipcRenderer.invoke('category:create', {
  requestId: uuid(),
  category: {
    name: "COBOL Programs",
    description: "COBOL-related knowledge entries",
    parent_id: "mainframe-technologies",
    color: "#3B82F6",
    icon: "code"
  },
  options: {
    validateParent: true,
    checkDuplicates: true
  }
});
```

#### Get Category Hierarchy
```typescript
// IPC Channel: 'category:hierarchy'
interface CategoryHierarchyRequest {
  parent_id?: string;
  options?: {
    maxDepth?: number;
    includeAnalytics?: boolean;
    includeInactive?: boolean;
  };
}

// Example usage:
const hierarchy = await ipcRenderer.invoke('category:hierarchy', {
  requestId: uuid(),
  parent_id: null, // Get root categories
  options: {
    maxDepth: 5,
    includeAnalytics: true,
    includeInactive: false
  }
});
```

#### Move Category
```typescript
// IPC Channel: 'category:move'
const moveResponse = await ipcRenderer.invoke('category:move', {
  requestId: uuid(),
  id: "category-id",
  new_parent_id: "new-parent-id",
  position: 2,
  options: {
    validateMove: true,
    preserveOrder: false
  }
});
```

### Tag Management

#### Create Tag
```typescript
// IPC Channel: 'tag:create'
const tagResponse = await ipcRenderer.invoke('tag:create', {
  requestId: uuid(),
  tag: {
    name: "performance-issue",
    description: "Performance-related problems and solutions",
    color: "#F59E0B",
    category: "troubleshooting"
  },
  options: {
    checkDuplicates: true,
    autoComplete: true
  }
});
```

#### Associate Tag with KB Entry
```typescript
// IPC Channel: 'tag:associate'
const associationResponse = await ipcRenderer.invoke('tag:associate', {
  requestId: uuid(),
  tag_id: "performance-issue-tag-id",
  entry_id: "kb-entry-id",
  relevance_score: 0.9,
  confidence_level: 0.8,
  metadata: {
    auto_generated: false,
    source: "user"
  }
});
```

#### Get Tag Suggestions
```typescript
// IPC Channel: 'tag:suggestions'
const suggestions = await ipcRenderer.invoke('tag:suggestions', {
  requestId: uuid(),
  entry_content: {
    title: "COBOL S0C7 Data Exception",
    problem: "Program abends with S0C7 during arithmetic operation",
    solution: "Check numeric field initialization and data validation",
    category: "Batch"
  },
  options: {
    limit: 10,
    confidence_threshold: 0.6,
    include_auto_generated: true
  }
});
```

### Autocomplete and Search

#### Get Autocomplete Suggestions
```typescript
// IPC Channel: 'autocomplete:suggestions'
const autocomplete = await ipcRenderer.invoke('autocomplete:suggestions', {
  requestId: uuid(),
  query: "vsam",
  context: {
    current_category: "VSAM",
    user_id: "user-123",
    session_id: "session-456"
  },
  options: {
    max_suggestions: 10,
    min_confidence: 0.1,
    sources: ['categories', 'tags', 'entries', 'history'],
    include_learning: true,
    fuzzy_matching: true
  }
});
```

#### Unified Search
```typescript
// IPC Channel: 'autocomplete:search'
const searchResults = await ipcRenderer.invoke('autocomplete:search', {
  requestId: uuid(),
  query: "database connection",
  search_type: "unified",
  context: {
    current_category: "DB2"
  },
  options: {
    limit: 20,
    include_analytics: true,
    boost_popular: true
  }
});
```

#### Learn from User Selection
```typescript
// IPC Channel: 'autocomplete:learn'
const learning = await ipcRenderer.invoke('autocomplete:learn', {
  requestId: uuid(),
  query: "vsam status 35",
  selected_suggestion: {
    text: "VSAM Status 35 - File Not Found",
    type: "entry",
    confidence: 0.95,
    source: "entries"
  },
  context: {
    current_category: "VSAM"
  },
  outcome: {
    was_helpful: true,
    result_found: true,
    time_to_result: 1500 // milliseconds
  }
});
```

### Bulk Operations

#### Execute Bulk Operations
```typescript
// IPC Channel: 'bulk:execute'
const bulkResult = await ipcRenderer.invoke('bulk:execute', {
  requestId: uuid(),
  operations: [
    {
      id: "op-1",
      type: "category_create",
      data: {
        name: "System Utilities",
        description: "System utility programs",
        parent_id: "mainframe-systems"
      }
    },
    {
      id: "op-2",
      type: "tag_create",
      data: {
        name: "utility",
        description: "Utility programs and scripts"
      },
      dependencies: ["op-1"] // Wait for category creation
    },
    {
      id: "op-3",
      type: "kb_entry_create",
      data: {
        title: "Using IEBGENER for File Copy",
        problem: "Need to copy datasets efficiently",
        solution: "Use IEBGENER utility with appropriate JCL",
        category_id: "op-1", // Reference to created category
        tags: ["op-2"] // Reference to created tag
      },
      dependencies: ["op-1", "op-2"]
    }
  ],
  options: {
    transaction: true,
    stop_on_error: true,
    validate_dependencies: true,
    validate_all_first: true,
    parallel_execution: false
  }
});
```

#### Validate Bulk Operations
```typescript
// IPC Channel: 'bulk:validate'
const validation = await ipcRenderer.invoke('bulk:validate', {
  requestId: uuid(),
  operations: [...operations],
  options: {
    check_dependencies: true,
    check_permissions: true,
    dry_run: true
  }
});
```

### Real-time Updates

#### Subscribe to Real-time Events
```typescript
// IPC Channel: 'realtime:subscribe'
const subscription = await ipcRenderer.invoke('realtime:subscribe', {
  requestId: uuid(),
  subscription: {
    event_types: [
      'category_created',
      'category_updated',
      'tag_created',
      'kb_entry_updated'
    ],
    filters: {
      categories: ["mainframe-systems", "vsam"],
      exclude_own_events: true
    },
    options: {
      batch_events: false,
      include_historical: true,
      historical_limit: 20
    }
  }
});

// Listen for real-time events
realtimeHandler.on('subscription_event', (data) => {
  const { subscription_id, event } = data;
  console.log('Real-time event received:', event.type, event.data);

  // Update UI based on event type
  switch (event.type) {
    case 'category_created':
      updateCategoryTree(event.data);
      break;
    case 'tag_created':
      refreshTagList();
      break;
    case 'kb_entry_updated':
      refreshKBEntry(event.data.id);
      break;
  }
});
```

#### Broadcast Custom Events
```typescript
// IPC Channel: 'realtime:broadcast'
const broadcast = await ipcRenderer.invoke('realtime:broadcast', {
  requestId: uuid(),
  event: {
    type: 'search_performed',
    source: 'user-search',
    data: {
      query: "VSAM issues",
      results_count: 15,
      user_id: "user-123"
    },
    metadata: {
      user_id: "user-123",
      session_id: "session-456",
      change_summary: "User performed search for VSAM issues"
    }
  },
  options: {
    persist: true,
    exclude_subscribers: [] // Broadcast to all
  }
});
```

## Error Handling

All handlers use consistent error response format:

```typescript
interface IPCErrorResponse {
  success: false;
  requestId: string;
  timestamp: number;
  executionTime: number;
  error: {
    code: IPCErrorCode;
    message: string;
    details?: any;
    severity: 'low' | 'medium' | 'high';
    retryable: boolean;
  };
}
```

Common error codes:
- `VALIDATION_FAILED`: Input validation errors
- `ENTRY_NOT_FOUND`: Resource not found
- `DUPLICATE_ENTRY`: Duplicate resource creation
- `DATABASE_ERROR`: Database operation errors
- `PERMISSION_DENIED`: Access control errors

## Performance Features

### Caching
- **Multi-layer caching**: Memory + disk caching with intelligent invalidation
- **Cache tags**: Granular cache invalidation by entity type
- **TTL management**: Automatic cache expiration
- **Hit rate optimization**: Popular queries cached longer

### Rate Limiting
- **Per-operation limits**: Different limits for read/write operations
- **Burst protection**: Prevents system overload
- **User-based limits**: Per-user rate limiting
- **Graceful degradation**: Fallback mechanisms when limits exceeded

### Transaction Support
- **ACID compliance**: Full transaction support for bulk operations
- **Rollback capability**: Automatic rollback on failure
- **Dependency management**: Topological sorting for dependent operations
- **Batch processing**: Efficient bulk operations with progress tracking

## Integration Example

```typescript
// main/index.ts - Integration setup
import { setupCategorizationHandlers } from './ipc/handlers/HandlerIntegration';

// Initialize the categorization system
const categorizationSystem = setupCategorizationHandlers(
  dbManager,
  cacheManager,
  handlerRegistry
);

// Example of emitting real-time events from services
categorizationSystem.emitCategoryEvent('created', {
  id: 'new-category-id',
  name: 'New Category',
  parent_id: 'parent-id'
});
```

## Frontend Usage

```typescript
// renderer/services/CategoryClient.ts
export class CategoryClient {
  async createCategory(categoryData: CategoryInput): Promise<string> {
    const response = await window.electronAPI.invoke('category:create', {
      requestId: uuidv4(),
      category: categoryData,
      options: { validateParent: true, checkDuplicates: true }
    });

    if (!response.success) {
      throw new Error(response.error.message);
    }

    return response.data;
  }

  async getHierarchy(parentId?: string): Promise<CategoryTree> {
    const response = await window.electronAPI.invoke('category:hierarchy', {
      requestId: uuidv4(),
      parent_id: parentId,
      options: { includeAnalytics: true }
    });

    return response.data;
  }
}
```

## Testing

Each handler includes comprehensive error handling and validation:

```typescript
// Example test for CategoryHandler
describe('CategoryHandler', () => {
  test('should create category with valid data', async () => {
    const request = {
      requestId: 'test-request',
      category: {
        name: 'Test Category',
        description: 'Test description'
      }
    };

    const response = await categoryHandler.handleCategoryCreate(request);
    expect(response.success).toBe(true);
    expect(response.data).toMatch(/^[0-9a-f-]{36}$/); // UUID format
  });

  test('should validate category input', async () => {
    const request = {
      requestId: 'test-request',
      category: { name: '' } // Invalid empty name
    };

    const response = await categoryHandler.handleCategoryCreate(request);
    expect(response.success).toBe(false);
    expect(response.error.code).toBe(IPCErrorCode.VALIDATION_FAILED);
  });
});
```

## Monitoring and Analytics

The system provides comprehensive monitoring:

- **Real-time status**: Active subscriptions, event counts, performance metrics
- **Analytics**: Usage patterns, popular searches, performance trends
- **Cache metrics**: Hit rates, memory usage, invalidation patterns
- **Error tracking**: Error rates, failure patterns, recovery metrics

Use the analytics endpoints to monitor system health:

```typescript
// Get system status
const status = await ipcRenderer.invoke('realtime:status', {
  requestId: uuid(),
  include_stats: true
});

// Get autocomplete analytics
const analytics = await ipcRenderer.invoke('autocomplete:analytics', {
  requestId: uuid(),
  timeframe: '7d',
  options: {
    include_learning_metrics: true,
    include_performance_metrics: true,
    include_popular_queries: true
  }
});
```

This comprehensive API provides all the functionality needed for a flexible, high-performance categorization and tagging system with real-time updates and intelligent suggestions.