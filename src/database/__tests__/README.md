# Database Test Suite

A comprehensive test suite for all database utilities and migration systems,
designed to ensure 90%+ code coverage with performance regression detection and
automated CI/CD integration.

## 🎯 Overview

This test suite provides comprehensive testing across four main categories:

- **Unit Tests**: Individual component testing with mocking and isolation
- **Integration Tests**: End-to-end workflows and cross-component interactions
- **Performance Tests**: Benchmarking, scaling tests, and regression detection
- **Error Handling Tests**: Failure scenarios, recovery mechanisms, and
  resilience testing

## 📁 Structure

```
__tests__/
├── unit/                          # Unit tests for individual components
│   ├── DatabaseManager.test.ts    # Database connection and query management
│   ├── MigrationManager.test.ts   # Schema migrations and rollbacks
│   ├── KnowledgeDB.test.ts        # Knowledge base operations
│   └── ...                        # Other component tests
├── integration/                   # Cross-component integration tests
│   └── DatabaseIntegration.test.ts # End-to-end scenarios
├── performance/                   # Performance and benchmarking tests
│   └── QueryPerformance.test.ts   # Query optimization and scaling tests
├── error-handling/                # Error scenarios and recovery tests
│   └── DatabaseErrorRecovery.test.ts # Failure modes and recovery
├── test-utils/                    # Shared testing utilities
│   ├── TestDatabaseFactory.ts     # Database creation and seeding
│   ├── PerformanceTestHelper.ts   # Performance measurement utilities
│   └── setup.ts                   # Global test configuration
├── jest.config.js                 # Jest configuration for database tests
├── run-tests.js                   # Comprehensive test runner script
└── README.md                      # This documentation
```

## 🚀 Quick Start

### Run All Tests

```bash
# From the database directory
node __tests__/run-tests.js

# Or from project root
npm run test:database
```

### Run Specific Test Suites

```bash
# Unit tests only
node __tests__/run-tests.js --suite=unit

# Integration tests
node __tests__/run-tests.js --suite=integration

# Performance tests
node __tests__/run-tests.js --suite=performance

# Error handling tests
node __tests__/run-tests.js --suite=error-handling
```

### Coverage Reports

```bash
# Generate coverage report
node __tests__/run-tests.js --coverage

# CI mode with coverage
node __tests__/run-tests.js --ci
```

### Verbose Output

```bash
# Detailed test output
node __tests__/run-tests.js --verbose
```

## 🧪 Test Categories

### Unit Tests (`unit/`)

Individual component testing with proper isolation and mocking:

- **DatabaseManager**: Connection pooling, transactions, query execution
- **MigrationManager**: Schema versioning, rollback mechanisms
- **KnowledgeDB**: CRUD operations, search functionality, usage tracking
- **BackupSystem**: Backup creation, restoration, validation
- **QueryBuilder**: Query construction, optimization
- **DataValidator**: Input validation, constraint checking

**Key Features:**

- In-memory databases for fast execution
- Comprehensive mocking of external dependencies
- Performance thresholds for critical operations
- Edge case and boundary condition testing

### Integration Tests (`integration/`)

End-to-end testing of complete workflows:

- **Migration Workflows**: Full migration lifecycle from discovery to rollback
- **Backup & Restore**: Complete backup/restore cycles with validation
- **Transaction Integrity**: Cross-component transaction consistency
- **Performance Under Load**: Sustained load testing with real data
- **Health Monitoring**: System health checks and degradation scenarios

**Key Features:**

- File-based databases for realistic testing
- Multi-component interactions
- Concurrent operation testing
- Resource usage monitoring

### Performance Tests (`performance/`)

Benchmarking and performance regression detection:

- **Query Performance**: Execution time benchmarks across data sizes
- **Bulk Operations**: Large dataset processing efficiency
- **Index Effectiveness**: Query optimization verification
- **Cache Performance**: Cache hit ratios and effectiveness
- **Connection Pooling**: Concurrent access performance
- **Scaling Tests**: Performance scaling with dataset growth

**Key Features:**

- Automated baseline comparisons
- Performance regression detection
- Memory usage profiling
- Throughput measurements
- Load testing with concurrent users

### Error Handling Tests (`error-handling/`)

Failure scenarios and recovery mechanisms:

- **Database Corruption**: Detection and recovery from corruption
- **Transaction Failures**: Rollback integrity and consistency
- **Connection Failures**: Recovery from connection interruptions
- **Constraint Violations**: Handling of data integrity errors
- **Resource Exhaustion**: Memory and disk space limitations
- **Migration Failures**: Recovery from failed schema updates

**Key Features:**

- Simulated failure conditions
- Recovery time measurements
- Data consistency verification
- Graceful degradation testing

## 🛠 Test Utilities

### TestDatabaseFactory

Utility for creating test databases with various configurations:

```typescript
// Create in-memory database for unit tests
const db = TestDatabaseFactory.createMemoryDatabase();

// Create file database with test data
const kb = TestDatabaseFactory.createTestKnowledgeDB();
await TestDatabaseFactory.seedKnowledgeDB(kb);

// Create large dataset for performance testing
const entries = TestDatabaseFactory.createLargeTestDataset(10000);
```

### PerformanceTestHelper

Comprehensive performance measurement and benchmarking:

```typescript
const helper = new PerformanceTestHelper();

// Measure operation performance
const result = await helper.measureOperation(
  'test-operation',
  () => someOperation(),
  100
);

// Run load tests
const loadResults = await helper.runLoadTest({
  concurrentUsers: 10,
  duration: 30,
  operations: [op1, op2, op3],
});

// Compare implementations
const comparison = await helper.compareImplementations([
  { name: 'implementation-a', fn: implA },
  { name: 'implementation-b', fn: implB },
]);
```

## 📊 Coverage Goals

The test suite targets 90%+ coverage across all metrics:

- **Lines**: 90%+
- **Branches**: 90%+
- **Functions**: 90%+
- **Statements**: 90%+

Coverage reports are generated in multiple formats:

- HTML reports for detailed analysis
- LCOV format for CI integration
- Cobertura XML for build systems
- Text summary for quick review

## 🔄 CI/CD Integration

### GitHub Actions Integration

```yaml
- name: Run Database Tests
  run: |
    cd src/database
    node __tests__/run-tests.js --ci

- name: Upload Coverage
  uses: codecov/codecov-action@v3
  with:
    file: coverage/database/lcov.info
    flags: database
```

### Performance Regression Detection

The test suite includes automated performance regression detection:

- Baseline performance metrics stored
- Automatic comparison with previous runs
- Configurable degradation thresholds
- Failed builds on significant regressions

### Parallel Execution

For CI environments, tests can be split across multiple jobs:

```yaml
strategy:
  matrix:
    test-suite: [unit, integration, performance, error-handling]
steps:
  - run: node __tests__/run-tests.js --suite=${{ matrix.test-suite }} --ci
```

## 📈 Performance Benchmarks

### Target Performance Metrics

| Operation       | Target        | Measurement               |
| --------------- | ------------- | ------------------------- |
| Simple Query    | <1ms          | Average execution time    |
| KB Search       | <50ms         | Full-text search response |
| Bulk Insert     | >1000 ops/sec | Transaction throughput    |
| Migration       | <30s          | Schema update completion  |
| Backup Creation | <60s          | Full database backup      |

### Scaling Requirements

| Data Size    | Search Time | Memory Usage |
| ------------ | ----------- | ------------ |
| 1K entries   | <10ms       | <50MB        |
| 10K entries  | <50ms       | <100MB       |
| 100K entries | <200ms      | <200MB       |
| 1M entries   | <1s         | <500MB       |

## 🚨 Error Recovery Testing

### Failure Scenarios

The test suite validates recovery from:

- **Database corruption**: File integrity issues
- **Disk full conditions**: Storage exhaustion
- **Network interruptions**: Connection failures
- **Memory pressure**: Resource limitations
- **Concurrent conflicts**: Race conditions
- **Migration failures**: Schema update errors

### Recovery Validation

Each failure scenario tests:

1. **Detection**: Error identification and reporting
2. **Isolation**: Preventing failure spread
3. **Recovery**: Restoration to working state
4. **Consistency**: Data integrity maintenance
5. **Performance**: Recovery time measurement

## 🔧 Configuration

### Jest Configuration

The test suite uses a specialized Jest configuration optimized for database
testing:

```javascript
{
  testEnvironment: 'node',
  maxWorkers: 1,              // Prevent SQLite locking issues
  testTimeout: 30000,         // Longer timeouts for database operations
  forceExit: true,           // Clean exit after tests
  detectOpenHandles: true,   // Find resource leaks
  setupFilesAfterEnv: ['setup.ts']
}
```

### Environment Variables

Configure test behavior with environment variables:

```bash
# Enable debug logging
DEBUG=database:test

# Custom test database path
TEST_DB_PATH=/tmp/test-db

# Performance test iterations
PERF_TEST_ITERATIONS=1000

# Coverage threshold override
COVERAGE_THRESHOLD=85
```

## 📝 Writing New Tests

### Unit Test Template

```typescript
describe('MyComponent Unit Tests', () => {
  let component: MyComponent;
  let mockDependency: jest.Mocked<Dependency>;

  beforeEach(() => {
    mockDependency = createMockDependency();
    component = new MyComponent(mockDependency);
  });

  it('should handle normal operation', async () => {
    // Arrange
    const input = createTestInput();

    // Act
    const result = await component.process(input);

    // Assert
    expect(result).toBeDefined();
    expect(mockDependency.method).toHaveBeenCalledWith(input);
  });
});
```

### Integration Test Template

```typescript
describe('MyWorkflow Integration Tests', () => {
  let dbManager: DatabaseManager;
  let component: MyComponent;

  beforeEach(async () => {
    dbManager = await TestDatabaseFactory.createTestDatabaseManager();
    component = new MyComponent(dbManager);
  });

  it('should execute complete workflow', async () => {
    // Setup
    await setupTestData(dbManager);

    // Execute
    const result = await component.executeWorkflow();

    // Verify
    expect(result.success).toBe(true);
    await verifyDatabaseState(dbManager);
  });
});
```

### Performance Test Template

```typescript
describe('MyComponent Performance Tests', () => {
  let performanceHelper: PerformanceTestHelper;

  beforeAll(() => {
    performanceHelper = new PerformanceTestHelper();
  });

  it('should meet performance targets', async () => {
    const result = await performanceHelper.measureOperation(
      'operation-name',
      () => component.performOperation(),
      100 // iterations
    );

    expect(result.metrics.operationsPerSecond).toBeGreaterThan(1000);
    expect(result.metrics.executionTime).toHaveExecutedWithin(10);
  });
});
```

## 🐛 Debugging Tests

### Common Issues

1. **SQLite Locking**: Use `maxWorkers: 1` in Jest config
2. **Memory Leaks**: Check `detectOpenHandles: true` output
3. **Timeout Issues**: Increase `testTimeout` for slow operations
4. **File Cleanup**: Ensure proper cleanup in `afterEach`

### Debug Logging

Enable detailed logging for troubleshooting:

```bash
DEBUG=database:*,test:* node __tests__/run-tests.js --verbose
```

### Test Isolation

Ensure tests are properly isolated:

- Use unique database names/paths
- Clean up resources in `afterEach`
- Reset global state between tests
- Use separate directories for each test

## 📚 Best Practices

### Test Organization

1. **One concept per test**: Each test should verify a single behavior
2. **Clear test names**: Describe the expected behavior
3. **Arrange-Act-Assert**: Structure tests clearly
4. **Deterministic tests**: Avoid random data and timing dependencies

### Performance Testing

1. **Baseline measurements**: Establish performance baselines
2. **Multiple iterations**: Average multiple runs for accuracy
3. **Environment consistency**: Use consistent test environments
4. **Resource monitoring**: Track memory and CPU usage

### Error Handling

1. **Explicit error testing**: Test both success and failure paths
2. **Error message validation**: Verify meaningful error messages
3. **State consistency**: Ensure system state after errors
4. **Recovery testing**: Validate recovery mechanisms

## 🤝 Contributing

When adding new tests:

1. Follow the existing patterns and structure
2. Add appropriate documentation
3. Ensure proper cleanup and isolation
4. Include performance benchmarks for new operations
5. Test both success and failure scenarios
6. Update this README for new test categories

## 📄 License

This test suite is part of the Mainframe KB Assistant project and follows the
same license terms.
