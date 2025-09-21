# Mainframe KB Assistant - Service Architecture Documentation

## Overview

The Mainframe KB Assistant MVP1 implements a comprehensive, production-ready service architecture following enterprise-grade patterns including dependency injection, event-driven communication, and separation of concerns. The architecture is designed for extensibility, supporting the planned evolution through MVP2-5.

## Architecture Principles

### 1. **Separation of Concerns**
Each service has a single responsibility:
- **KnowledgeBaseService**: Core CRUD operations and orchestration
- **ValidationService**: Input validation and sanitization
- **SearchService**: Unified search (local + AI)
- **CacheService**: Performance optimization
- **MetricsService**: Analytics and monitoring
- **ImportExportService**: Data portability

### 2. **Dependency Injection**
Services are loosely coupled through constructor injection, managed by ServiceFactory.

### 3. **Event-Driven Architecture**
Services communicate through events, enabling reactive patterns and extensibility.

### 4. **Repository Pattern**
Database operations are abstracted through well-defined interfaces.

### 5. **Factory Pattern**
ServiceFactory manages service lifecycle and configuration.

## Service Layer Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         SERVICE FACTORY                         │
│                    (Dependency Injection)                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ KnowledgeBase   │  │   Validation    │  │     Search      │ │
│  │    Service      │  │    Service      │  │    Service      │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│           │                     │                     │         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │     Cache       │  │    Metrics      │  │ ImportExport    │ │
│  │    Service      │  │    Service      │  │    Service      │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                         DATA LAYER                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │     SQLite      │  │   File System   │  │   External API  │ │
│  │   (Main DB)     │  │   (Backups)     │  │    (Gemini)     │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Service Details

### KnowledgeBaseService (Core Orchestrator)

**Responsibilities:**
- CRUD operations for KB entries
- Transaction management
- Event orchestration
- Service coordination

**Key Features:**
- Batch operations support
- Optimistic locking with versioning
- Comprehensive error handling
- Performance monitoring
- Automatic backup scheduling

**Example Usage:**
```typescript
const kbService = factory.getKnowledgeBaseService();

// Create entry
const id = await kbService.create({
  title: "VSAM Status 35 Error",
  problem: "Job fails with VSAM status 35",
  solution: "Check file exists and is properly cataloged",
  category: "VSAM",
  tags: ["vsam", "file", "catalog"]
});

// Search entries
const results = await kbService.search("VSAM error", {
  category: "VSAM",
  useAI: true,
  limit: 10
});
```

### ValidationService

**Responsibilities:**
- Input validation and sanitization
- Business rule enforcement
- Security checks
- Custom validation rules

**Key Features:**
- Comprehensive field validation
- Sensitive data detection
- Content quality assessment
- Custom validator support
- Batch validation

**Example Usage:**
```typescript
const validationService = factory.getValidationService();

const result = validationService.validateEntry({
  title: "Test Entry",
  problem: "Test problem",
  solution: "Test solution",
  category: "Other"
});

if (!result.valid) {
  console.log("Validation errors:", result.errors);
}
```

### SearchService

**Responsibilities:**
- Unified search interface
- Local FTS search
- AI semantic search (Gemini)
- Search suggestions
- Result ranking and highlighting

**Key Features:**
- Intelligent fallback mechanisms
- Multiple search strategies
- Result explanation
- Search history tracking
- Performance optimization

**Example Usage:**
```typescript
const searchService = factory.getSearchService();

// Search with AI enhancement
const results = await searchService.search("database connection error", entries, {
  useAI: true,
  includeHighlights: true,
  threshold: 0.7
});

// Get search suggestions
const suggestions = await searchService.suggest("data");
```

### CacheService

**Responsibilities:**
- LRU caching with TTL
- Memory management
- Performance optimization
- Cache statistics

**Key Features:**
- Multiple eviction strategies
- TTL support
- Pattern-based deletion
- Memory usage monitoring
- Batch operations

**Example Usage:**
```typescript
const cacheService = factory.getCacheService();

// Set/Get cache values
await cacheService.set("key", data, 300000); // 5 minutes TTL
const cached = await cacheService.get("key");

// Get cache statistics
const stats = cacheService.stats();
console.log(`Cache hit rate: ${stats.hitRate}%`);
```

### MetricsService

**Responsibilities:**
- Usage analytics
- Performance monitoring
- Alert management
- Trend analysis

**Key Features:**
- Real-time metrics collection
- Configurable alerts
- Export capabilities (JSON, CSV, Prometheus)
- Historical trend analysis
- Performance benchmarking

**Example Usage:**
```typescript
const metricsService = factory.getMetricsService();

// Get comprehensive metrics
const metrics = await metricsService.getMetrics("24h");

// Record custom usage
await metricsService.recordUsage("entry-123", "view", "user-456");

// Get alerts
const alerts = await metricsService.getAlerts();
```

### ImportExportService

**Responsibilities:**
- Data portability
- Backup/restore operations
- Format conversion
- Data validation

**Key Features:**
- Multiple format support (JSON, CSV, XML)
- Batch processing
- Duplicate detection
- Data validation
- Error recovery

**Example Usage:**
```typescript
const importExportService = factory.getImportExportService();

// Export to JSON
const jsonData = await importExportService.exportToJSON({
  includeMetrics: true,
  format: "full"
});

// Import from CSV
const result = await importExportService.importFromCSV(csvData, {
  batchSize: 100,
  skipDuplicates: true
});
```

## Configuration Management

### Production Configuration
```typescript
const factory = ServiceFactory.createProductionFactory({
  database: {
    path: "./production-kb.db",
    backup: {
      enabled: true,
      interval: 1800000, // 30 minutes
      retention: 24
    }
  },
  cache: {
    maxSize: 50000,
    ttl: 600000 // 10 minutes
  },
  metrics: {
    enabled: true,
    alerts: {
      enabled: true,
      thresholds: {
        searchTime: 2000,
        errorRate: 0.02
      }
    }
  }
});
```

### Development Configuration
```typescript
const factory = ServiceFactory.createDevelopmentFactory({
  logging: {
    level: "debug",
    console: true
  },
  metrics: {
    aggregation: {
      enabled: false
    }
  }
});
```

### Test Configuration
```typescript
const factory = ServiceFactory.createTestFactory({
  database: {
    path: ":memory:"
  },
  metrics: {
    enabled: false
  }
});
```

## Event System

Services communicate through a comprehensive event system:

### KB Events
- `entry:created`
- `entry:updated`
- `entry:deleted`
- `entries:batch-created`
- `entries:batch-updated`
- `entries:batch-deleted`

### Search Events
- `search:performed`
- `search:no-results`
- `search:ai-fallback`

### System Events
- `error:occurred`
- `performance:degraded`
- `cache:hit`
- `cache:miss`
- `metrics:updated`
- `metrics:alert`

### Usage Example
```typescript
kbService.on('entry:created', (entry) => {
  console.log(`New entry created: ${entry.title}`);
});

kbService.on('search:performed', (query, results) => {
  console.log(`Search "${query.text}" returned ${results.length} results`);
});
```

## Performance Considerations

### Database Optimization
- SQLite WAL mode for concurrent access
- Comprehensive indexing strategy
- Connection pooling
- Query optimization with prepared statements

### Caching Strategy
- Multi-level caching (L1: Memory, L2: Disk)
- Intelligent cache invalidation
- Performance-aware eviction policies

### Search Performance
- FTS5 indexing for fast text search
- Intelligent AI fallback
- Result caching
- Query optimization

### Memory Management
- Bounded cache sizes
- Memory usage monitoring
- Automatic cleanup processes

## Monitoring and Observability

### Health Checks
```typescript
const health = await factory.healthCheck();
console.log(`System health: ${health.healthy ? 'OK' : 'DEGRADED'}`);
```

### Performance Benchmarking
```typescript
const benchmark = await benchmarkServices(factory, {
  iterations: 1000,
  includeSearch: true,
  includeCRUD: true
});
```

### Metrics Export
```typescript
// Export metrics in Prometheus format
const metricsService = factory.getMetricsService();
const prometheusData = await metricsService.exportMetrics('prometheus');
```

## Error Handling

### Service Errors
All services use a comprehensive error hierarchy:
- `ServiceError` - Base error class
- `ValidationError` - Validation failures
- `DatabaseError` - Database operation failures  
- `SearchError` - Search operation failures
- `CacheError` - Cache operation failures
- `AIServiceError` - AI service failures

### Error Recovery
- Automatic retry mechanisms
- Graceful degradation
- Circuit breaker patterns
- Comprehensive error logging

## Testing Strategy

### Unit Tests
Each service includes comprehensive unit tests:
```typescript
describe('KnowledgeBaseService', () => {
  test('should create entry successfully', async () => {
    const id = await kbService.create(validEntry);
    expect(id).toBeDefined();
  });
});
```

### Integration Tests
Full service integration testing:
```typescript
describe('Service Integration', () => {
  test('search should work with cache', async () => {
    const results = await kbService.search('test');
    // Verify cache was used
  });
});
```

### Performance Tests
Automated performance benchmarking:
```typescript
test('search performance should be under 1s', async () => {
  const start = Date.now();
  await kbService.search('test');
  expect(Date.now() - start).toBeLessThan(1000);
});
```

## Future Extensibility (MVP2-5 Ready)

The architecture is designed to support future MVPs:

### MVP2 - Pattern Detection
- PatternDetectionService will integrate via events
- Existing MetricsService provides foundation
- Event-driven architecture enables real-time pattern analysis

### MVP3 - Code Analysis  
- CodeAnalysisService will extend SearchService
- Link KB entries to code locations
- Leverage existing validation and caching layers

### MVP4 - IDZ Integration
- IDZBridgeService will extend ImportExportService
- Template generation using existing KB patterns
- Multi-file workspace management

### MVP5 - Enterprise Features
- Auto-resolution using existing AI integration
- Advanced analytics via MetricsService extension
- Enterprise security and governance layers

## Quick Start Guide

### 1. Basic Setup
```typescript
import { initializeProductionServices } from './src/services';

const factory = await initializeProductionServices({
  database: { path: './my-kb.db' },
  gemini: { apiKey: 'your-api-key' }
});

const kbService = factory.getKnowledgeBaseService();
```

### 2. Create Knowledge Entry
```typescript
const entryId = await kbService.create({
  title: "JCL Job Failure",
  problem: "Job fails with JCL error IEF212I",
  solution: "Check dataset allocation and permissions",
  category: "JCL",
  tags: ["jcl", "error", "dataset"]
});
```

### 3. Search Knowledge Base
```typescript
const results = await kbService.search("JCL error", {
  useAI: true,
  category: "JCL",
  limit: 10
});
```

### 4. Import/Export Data
```typescript
const importExportService = factory.getImportExportService();

// Export to JSON
const jsonData = await importExportService.exportToJSON();

// Import from JSON
const result = await importExportService.importFromJSON(jsonData);
```

### 5. Monitor Performance
```typescript
const metricsService = factory.getMetricsService();
const metrics = await metricsService.getMetrics();
console.log(`Success rate: ${metrics.overview.averageSuccessRate}%`);
```

## Best Practices

### Service Configuration
- Use environment-specific configurations
- Enable appropriate logging levels
- Configure proper backup schedules
- Set reasonable cache sizes

### Error Handling
- Always handle service errors gracefully
- Implement proper fallback mechanisms
- Log errors with sufficient context
- Use circuit breakers for external services

### Performance
- Monitor key performance metrics
- Use caching effectively
- Optimize database queries
- Profile and benchmark regularly

### Security
- Validate all inputs
- Sanitize data before storage
- Use proper access controls
- Audit sensitive operations

This architecture provides a solid foundation for the Mainframe KB Assistant MVP1 while being extensible for future enhancements. The comprehensive service layer ensures production readiness with proper separation of concerns, error handling, and performance optimization.