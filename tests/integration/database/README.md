# KnowledgeDB Integration Tests

Comprehensive integration testing suite for the KnowledgeDB system, covering all critical database operations and performance requirements.

## Overview

This test suite validates:

- **CRUD Operations**: Create, Read, Update, Delete with concurrent access patterns
- **Transaction Integrity**: Rollback scenarios and data consistency validation
- **Performance Benchmarks**: Sub-1-second search response times for 1000+ entries
- **FTS5 Index Consistency**: Full-text search index maintenance and accuracy
- **Schema Migration**: Database schema versioning and data preservation
- **Backup/Restore**: Data export/import functionality and integrity validation
- **Error Recovery**: Graceful handling of corruption, locks, and edge cases
- **System Health**: Monitoring, metrics, and resource usage validation

## Quick Start

### Run All Tests
```bash
# Run complete integration test suite
npm run test:database:integration

# Or using the specialized runner
node tests/integration/database/run-integration-tests.js
```

### Run Specific Test Suites
```bash
# Performance benchmarks only
node tests/integration/database/run-integration-tests.js --suite performance

# CRUD operations only  
node tests/integration/database/run-integration-tests.js --suite crud

# Backup and restore tests
node tests/integration/database/run-integration-tests.js --suite backup
```

### Advanced Testing Options
```bash
# Verbose output with performance analysis
node tests/integration/database/run-integration-tests.js --verbose --performance

# Memory leak detection
node tests/integration/database/run-integration-tests.js --memory-check

# Generate coverage report
node tests/integration/database/run-integration-tests.js --coverage

# Custom timeout for long-running tests
node tests/integration/database/run-integration-tests.js --timeout 120000
```

## Test Suites

### 1. CRUD Operations with Concurrent Access
**Focus**: Multi-user database operations and data integrity

- ✅ Basic CRUD operation validation
- ✅ Concurrent read operations (50+ simultaneous)
- ✅ Concurrent write operations with isolation
- ✅ Mixed read/write/update operations
- ✅ Data consistency validation

**Performance Target**: 95% success rate under concurrent load

### 2. Transaction Integrity and Rollback Scenarios
**Focus**: Data consistency and error recovery

- ✅ Transaction commit validation
- ✅ Validation failure handling
- ✅ Database corruption recovery
- ✅ Referential integrity maintenance
- ✅ Rollback scenario testing

**Performance Target**: Zero data loss, complete rollback on failures

### 3. Performance Benchmarks
**Focus**: Meeting strict performance requirements

- ✅ Search response time <1s for 1000 entries
- ✅ Pagination efficiency with large datasets
- ✅ Concurrent search operations
- ✅ Bulk operation performance
- ✅ Memory usage optimization

**Performance Targets**:
- Search: <1000ms for 1000 entries
- Pagination: <500ms per page
- Concurrent ops: >90% success rate

### 4. FTS5 Index Consistency
**Focus**: Full-text search accuracy and maintenance

- ✅ Index maintenance during CRUD operations
- ✅ Special character and Unicode handling
- ✅ Index rebuilding and optimization
- ✅ Search result accuracy validation
- ✅ Query performance consistency

**Performance Target**: Consistent search results, index integrity

### 5. Schema Migration Testing
**Focus**: Database versioning and upgrade paths

- ✅ Schema version management
- ✅ Data preservation during migrations
- ✅ Migration failure recovery
- ✅ Backward compatibility validation
- ✅ Multiple migration sequences

**Performance Target**: 100% data preservation, <30s migration time

### 6. Backup and Restore Validation
**Focus**: Data protection and recovery capabilities

- ✅ Backup creation and validation
- ✅ Restore functionality and integrity
- ✅ Incremental backup scenarios
- ✅ Cross-platform backup compatibility
- ✅ Backup corruption handling

**Performance Target**: Complete data recovery, integrity validation

### 7. Error Recovery and Edge Cases
**Focus**: System resilience and fault tolerance

- ✅ Disk space exhaustion handling
- ✅ Database lock management
- ✅ Unexpected shutdown recovery
- ✅ Corrupted data handling
- ✅ Resource constraint management

**Performance Target**: Graceful degradation, automatic recovery

### 8. System Health and Monitoring
**Focus**: Operational monitoring and diagnostics

- ✅ Health check accuracy
- ✅ Performance metrics collection
- ✅ Resource usage monitoring
- ✅ Trend analysis capabilities
- ✅ Alert threshold validation

**Performance Target**: Real-time monitoring, accurate metrics

## Test Data Generation

The test suite includes sophisticated test data generators:

### TestDataGenerator
- `createKBEntry()`: Single knowledge base entry
- `createBatchKBEntries(count)`: Batch entries for load testing  
- `createPerformanceTestData(count)`: Optimized for performance testing

### Example Usage
```typescript
// Create test data
const entries = TestDataGenerator.createBatchKBEntries(100);
const perfData = TestDataGenerator.createPerformanceTestData(1000);

// Add to database
for (const entry of entries) {
  await db.addEntry(entry);
}
```

## Performance Measurement

### PerformanceValidator
Tracks operation timings and validates performance requirements:

```typescript
// Measure operation performance
const startTime = PerformanceValidator.startTimer('search');
const results = await db.search('query');
const duration = PerformanceValidator.endTimer('search', startTime);

// Validate against requirements
const isValid = PerformanceValidator.validatePerformance('search', 1000);
```

### Performance Metrics Tracked
- Search response times
- CRUD operation latency  
- Concurrent operation success rates
- Memory usage patterns
- Database file size growth

## Test Environment Setup

### Temporary Database Management
- Automatic temporary database creation
- Isolated test environments
- Cleanup after test completion
- Cross-platform path handling

### TestDatabaseFactory
```typescript
// Create isolated test database
const dbPath = TestDatabaseFactory.createTemporaryDatabase();
const db = new KnowledgeDB(dbPath, { autoBackup: false });

// Cleanup automatically handled
TestDatabaseFactory.cleanup();
```

## CI/CD Integration

### GitHub Actions
```yaml
- name: Run Database Integration Tests
  run: |
    npm run test:database:integration
    node tests/integration/database/run-integration-tests.js --coverage --performance
```

### Test Reports
Generated reports include:
- **JSON Report**: Detailed test results and metrics
- **Performance Report**: Search times, concurrent operation analysis
- **Memory Report**: Memory usage and leak detection
- **Coverage Report**: Code coverage analysis

## Troubleshooting

### Common Issues

**1. Test Timeout Errors**
```bash
# Increase timeout for slow systems
node run-integration-tests.js --timeout 120000
```

**2. Memory Issues**
```bash
# Enable memory monitoring
node run-integration-tests.js --memory-check --verbose
```

**3. Performance Failures**
```bash
# Run performance-specific tests with detailed output
node run-integration-tests.js --suite performance --verbose
```

**4. Database Lock Issues**
```bash
# Run tests sequentially instead of parallel
node run-integration-tests.js --parallel false
```

### Debug Mode
```bash
# Maximum verbosity and monitoring
node run-integration-tests.js --verbose --memory-check --performance --coverage
```

## Requirements

### System Requirements
- Node.js 18.0.0+
- SQLite 3.x
- Available disk space: 1GB+ for large dataset tests
- Available memory: 2GB+ recommended

### Dependencies
- `better-sqlite3`: Database operations
- `jest`: Test framework  
- `uuid`: Unique ID generation
- TypeScript support for type safety

## Contributing

### Adding New Tests
1. Follow existing test structure and naming conventions
2. Include performance measurements where applicable
3. Add appropriate test data generators
4. Update this README with new test descriptions

### Test Categories
- **Unit**: Single function/method testing
- **Integration**: Multi-component interaction testing  
- **Performance**: Speed and scalability testing
- **End-to-End**: Complete workflow testing

### Code Coverage
Maintain >90% code coverage for database components:
```bash
npm run test:database:coverage
```

## Performance Benchmarks

### Current Targets
| Operation | Target | Measurement |
|-----------|---------|-------------|
| Search 1000 entries | <1000ms | Average response time |
| Concurrent reads | >95% success | 50 simultaneous operations |
| Concurrent writes | >90% success | 50 simultaneous operations |
| Database startup | <5000ms | Cold start to ready |
| Bulk insert 1000 | <30000ms | Batch operation time |

### Historical Performance
Track performance trends over time to detect regressions:
- Search performance: Maintained <500ms average
- Concurrent operations: >95% success rate sustained
- Memory usage: <100MB growth per 1000 entries
- Database growth: Linear with content size

---

## Support

For issues with integration tests:
1. Check system requirements and dependencies
2. Review test logs with `--verbose` flag
3. Generate performance reports for analysis
4. Check GitHub Issues for known problems

**Test Suite Version**: 1.0.0
**Last Updated**: January 2025
**Compatibility**: KnowledgeDB v1.0+