# Search Backend Services

High-performance, intelligent search system for the Mainframe Knowledge Base
Assistant. This backend provides comprehensive search capabilities with
multi-layer caching, real-time metrics, and seamless Electron integration.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Electron Renderer Process                    │
└─────────────────────┬───────────────────────────────────────────┘
                      │ IPC Communication
┌─────────────────────▼───────────────────────────────────────────┐
│                    Search IPC Handlers                         │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────────┐ │
│  │   Search    │  │ Autocomplete │  │    Search History       │ │
│  │ API Service │  │   Service    │  │      Service            │ │
│  └─────────────┘  └──────────────┘  └─────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│              Multi-Layer Cache System (L0/L1/L2)               │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────────┐ │
│  │  Advanced   │  │   Database   │  │    Metrics Collector    │ │
│  │Search Engine│  │    Schema    │  │                         │ │
│  └─────────────┘  └──────────────┘  └─────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│                      SQLite Database                           │
└─────────────────────────────────────────────────────────────────┘
```

## Features

### 🚀 High Performance

- **Sub-second response times** with intelligent caching
- **Multi-layer caching** (L0: Memory, L1: Redis, L2: Database)
- **Connection pooling** and prepared statements
- **Optimized database indexes** and query optimization

### 🧠 Intelligent Search

- **Advanced search algorithms** (BM25, TF-IDF, semantic matching)
- **AI-powered suggestions** via Google Gemini integration
- **Fuzzy matching** and typo tolerance
- **Personalized results** based on user history

### 📊 Real-time Analytics

- **Comprehensive metrics collection** and monitoring
- **Performance dashboards** with real-time updates
- **Usage analytics** and trend analysis
- **Alert system** for performance issues

### 🔒 Security & Reliability

- **Input validation** and sanitization
- **Rate limiting** with adaptive thresholds
- **Error handling** with graceful degradation
- **Health monitoring** and automatic recovery

## API Endpoints

### Search Operations

#### Execute Search

```typescript
// IPC Channel: 'search:execute'
interface SearchRequest {
  query: string;
  options?: {
    limit?: number; // Max results (1-100)
    offset?: number; // Pagination offset
    category?: string; // Filter by category
    includeArchived?: boolean;
    fuzzyThreshold?: number; // 0.1-1.0
    useAI?: boolean; // Enable AI enhancement
  };
  context?: {
    userId?: string;
    sessionId?: string;
  };
}
```

#### Autocomplete Suggestions

```typescript
// IPC Channel: 'search:autocomplete'
interface AutocompleteRequest {
  query: string;
  limit?: number; // Max suggestions (1-20)
  category?: string; // Filter by category
  userId?: string; // For personalization
}
```

### History Management

#### Get Search History

```typescript
// IPC Channel: 'search:history:get'
interface HistoryRequest {
  userId?: string;
  limit?: number; // Max entries (1-200)
  offset?: number; // Pagination offset
  timeframe?: string; // '1h', '6h', '1d', '7d', '30d'
  category?: string; // Filter by category
  successful?: boolean; // Filter by success status
}
```

#### Clear History

```typescript
// IPC Channel: 'search:history:clear'
interface ClearHistoryRequest {
  userId?: string;
  timeframe?: string; // 'all' or retention period
}
```

### Performance Metrics

#### Get Metrics Summary

```typescript
// IPC Channel: 'search:metrics:get'
interface MetricsRequest {
  timeframe?: string; // '1h', '6h', '1d', '7d', '30d'
  granularity?: string; // '5m', '15m', '1h', '1d'
  userId?: string; // User-specific metrics
}
```

#### Real-time Dashboard

```typescript
// IPC Channel: 'search:metrics:dashboard'
// Returns current performance indicators
interface DashboardData {
  currentRPS: number;
  avgResponseTime: number;
  errorRate: number;
  cacheHitRate: number;
  activeUsers: number;
  systemHealth: 'healthy' | 'warning' | 'critical';
}
```

### Cache Management

#### Cache Statistics

```typescript
// IPC Channel: 'search:cache:stats'
interface CacheStats {
  l0: LayerStats; // In-memory cache
  l1: LayerStats; // Redis cache
  l2: LayerStats; // Database cache
  overall: OverallStats; // Aggregated metrics
}
```

#### Cache Operations

```typescript
// Clear cache
// IPC Channel: 'search:cache:clear'
interface ClearCacheRequest {
  layer?: 'L0' | 'L1' | 'L2' | 'all';
}

// Warm cache with common queries
// IPC Channel: 'search:cache:warm'
interface WarmCacheRequest {
  queries: string[]; // Max 50 queries
}
```

## Configuration

### Basic Configuration

```typescript
import { createSearchBackend } from './backend/SearchBackendService';

const backend = createSearchBackend({
  database: {
    path: './data/knowledge-base.db',
  },
  search: {
    maxResults: 50,
    defaultTimeout: 3000,
    enableAI: true,
    geminiApiKey: process.env.GEMINI_API_KEY,
  },
  cache: {
    l0: {
      maxItems: 100,
      maxSizeBytes: 10 * 1024 * 1024, // 10MB
      ttlSeconds: 300,
    },
  },
  performance: {
    enableMetrics: true,
    metricsRetentionDays: 30,
  },
});
```

### Advanced Configuration

```typescript
const backend = createSearchBackend({
  cache: {
    l0: {
      maxItems: 200,
      maxSizeBytes: 50 * 1024 * 1024, // 50MB
      ttlSeconds: 600,
    },
    l1: {
      host: 'localhost',
      port: 6379,
      db: 1,
      maxRetries: 3,
    },
    compression: {
      enabled: true,
      algorithm: 'gzip',
      threshold: 1024,
    },
    monitoring: {
      enabled: true,
      alertThresholds: {
        hitRateBelow: 0.8,
        errorRateAbove: 0.05,
        latencyAbove: 1000,
      },
    },
  },
});
```

## Usage Examples

### Basic Integration

```typescript
import { app } from 'electron';
import { createSearchBackend } from './backend/SearchBackendService';

class MainApp {
  private searchBackend;

  async initialize() {
    // Initialize backend
    this.searchBackend = createSearchBackend();
    await this.searchBackend.initialize();

    // Check health
    const health = await this.searchBackend.healthCheck();
    console.log('Backend health:', health.healthy);
  }

  async shutdown() {
    await this.searchBackend.shutdown();
  }
}
```

### Direct Service Access

```typescript
const services = backend.getServices();

// Execute search directly
const results = await services.searchApiService.executeSearch({
  query: 'VSAM error status 35',
  limit: 10,
  useAI: true,
});

// Get autocomplete suggestions
const suggestions =
  await services.autocompleteService.getAutocompleteSuggestions({
    query: 'JCL',
    limit: 5,
  });

// Access search history
const history = await services.historyService.getHistory({
  userId: 'user-123',
  limit: 20,
  timeframe: 24,
});
```

### Performance Monitoring

```typescript
// Get comprehensive metrics
const metrics = await backend.getMetrics('1d');
console.log('Performance:', {
  searches: metrics.overview.totalSearches,
  avgTime: metrics.overview.avgResponseTime,
  hitRate: metrics.cache.hitRate,
});

// Monitor system health
setInterval(async () => {
  const status = await backend.getStatus();
  if (status.performance.errorRate > 0.05) {
    console.warn('High error rate detected:', status.performance.errorRate);
  }
}, 30000);
```

## Performance Targets

| Metric                | Target    | Notes                       |
| --------------------- | --------- | --------------------------- |
| Search Response Time  | < 1s      | 95th percentile             |
| Autocomplete Response | < 50ms    | Real-time typing            |
| Cache Hit Rate        | > 80%     | L0 + L1 combined            |
| Memory Usage          | < 512MB   | Including all caches        |
| Error Rate            | < 1%      | Excluding user input errors |
| Throughput            | > 100 QPS | Concurrent searches         |

## Database Schema

The backend uses an optimized SQLite schema with the following key tables:

- **search_history** - All search operations with performance metrics
- **search_metrics** - Aggregated performance data by time windows
- **popular_searches** - Materialized view of frequently searched queries
- **search_suggestions** - Autocomplete suggestions with frequency tracking
- **search_performance_log** - Detailed operation logs for monitoring

### Key Indexes

- Full-text search indexes for rapid query execution
- Composite indexes for common query patterns
- Time-based indexes for efficient history retrieval
- User-based indexes for personalization

## Caching Strategy

### L0 Cache (Memory)

- **Purpose**: Ultra-fast access for recent/popular queries
- **Size**: 100 items, 10MB max
- **TTL**: 5 minutes
- **Hit Rate Target**: > 40%

### L1 Cache (Redis)

- **Purpose**: Shared cache across instances
- **Size**: 1000 items
- **TTL**: 30 minutes
- **Hit Rate Target**: > 30%

### L2 Cache (Database)

- **Purpose**: Persistent cache with compression
- **Size**: Unlimited
- **TTL**: 24 hours
- **Compression**: Gzip for large results

## Error Handling

The backend implements comprehensive error handling:

1. **Input Validation**: All inputs are validated and sanitized
2. **Rate Limiting**: Prevents abuse and ensures fair usage
3. **Circuit Breakers**: Automatic fallback when services fail
4. **Graceful Degradation**: Core functionality maintained even when AI services
   are unavailable
5. **Error Recovery**: Automatic retry mechanisms and service recovery

## Monitoring & Alerts

### Built-in Monitoring

- Real-time performance metrics
- Cache hit/miss rates
- Database query performance
- Memory and CPU usage
- Error rates and patterns

### Alert Conditions

- Response time > 1000ms
- Error rate > 5%
- Cache hit rate < 70%
- Memory usage > 80%
- Service unavailability

## Security Features

### Input Protection

- SQL injection prevention
- XSS protection
- Path traversal protection
- Input size limits
- Character encoding validation

### Rate Limiting

- Per-user limits
- Per-session limits
- Adaptive limits based on system load
- Separate limits for different operations

## Troubleshooting

### Common Issues

#### High Response Times

1. Check cache hit rates
2. Monitor database query performance
3. Verify AI service availability
4. Review system resource usage

#### Memory Usage

1. Adjust cache sizes in configuration
2. Enable compression for large values
3. Tune garbage collection settings
4. Monitor for memory leaks

#### Database Lock Errors

1. Enable WAL mode (automatic)
2. Reduce concurrent operations
3. Check disk I/O performance
4. Consider connection pooling

### Debug Mode

Enable detailed logging:

```typescript
process.env.NODE_ENV = 'development';
// This enables verbose SQL logging and detailed error traces
```

## Contributing

When adding new features:

1. **Maintain backward compatibility** with existing IPC channels
2. **Add comprehensive error handling** for all new operations
3. **Include performance tests** to ensure response time targets
4. **Update metrics collection** for new operations
5. **Add appropriate caching** for frequently accessed data

## License

This search backend system is part of the Mainframe Knowledge Base Assistant
project.
