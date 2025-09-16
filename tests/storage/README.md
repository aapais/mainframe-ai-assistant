# Storage Service Test Suite

Comprehensive test coverage for the Storage Service implementation, including unit tests, integration tests, performance benchmarks, and end-to-end workflows.

## 📁 Directory Structure

```
tests/storage/
├── unit/                   # Unit tests for individual components
│   ├── adapters/          # Storage adapter tests
│   ├── plugins/           # Plugin system tests
│   ├── backup/           # Backup service tests
│   ├── export/           # Export/import tests
│   └── migration/        # Migration service tests
├── integration/           # Integration tests with real dependencies
├── performance/          # Performance benchmarks and stress tests
├── e2e/                  # End-to-end workflow tests
├── mocks/                # Mock implementations for testing
├── fixtures/             # Test data and utilities
├── setup/                # Test configuration and setup
├── scripts/              # Test runner and utilities
└── README.md             # This file
```

## 🧪 Test Categories

### Unit Tests (`/unit/`)
Fast, isolated tests for individual components without external dependencies.

- **StorageService.test.ts** - Core storage service functionality
- **adapters/SQLiteAdapter.test.ts** - SQLite adapter implementation
- **plugins/BaseStoragePlugin.test.ts** - Plugin system base functionality
- **backup/BackupService.test.ts** - Backup and restore operations
- **export/ExportService.test.ts** - Data export functionality
- **migration/MigrationService.test.ts** - Schema and data migration

### Integration Tests (`/integration/`)
Tests for component interactions using real dependencies like databases and file systems.

- **StorageServiceIntegration.test.ts** - Full service integration
- **PluginIntegration.test.ts** - Plugin system integration
- **BackupIntegration.test.ts** - Backup system with real storage

### Performance Tests (`/performance/`)
Benchmarks and performance validation tests with measurable metrics.

- **StoragePerformance.test.ts** - Comprehensive performance benchmarks
- **ConcurrencyPerformance.test.ts** - Concurrent operation handling
- **MemoryPerformance.test.ts** - Memory usage and leak detection

### End-to-End Tests (`/e2e/`)
Complete workflow tests simulating real-world usage scenarios.

- **CompleteWorkflow.test.ts** - Full application lifecycle tests
- **UserScenarios.test.ts** - Realistic user interaction patterns
- **DisasterRecovery.test.ts** - Complete disaster recovery workflows

## 🚀 Running Tests

### Quick Start

```bash
# Run all tests
npm run test:storage

# Run specific test suites
npm run test:storage unit
npm run test:storage integration
npm run test:storage performance
npm run test:storage e2e

# Run with coverage
npm run test:storage all --coverage

# Run in watch mode (for development)
npm run test:storage unit --watch
```

### Advanced Usage

```bash
# Run specific test files
npm run test:storage unit --path-pattern="StorageService"

# Run tests matching name pattern
npm run test:storage all --name-pattern="should handle errors"

# Verbose output for debugging
npm run test:storage integration --verbose

# CI mode (optimized for continuous integration)
npm run test:storage all --ci

# Update snapshots
npm run test:storage unit --update-snapshots

# Stop on first failure
npm run test:storage all --bail
```

### Custom Test Runner

Use the TypeScript test runner for advanced functionality:

```bash
# Validate test environment
npx ts-node tests/storage/scripts/run-tests.ts --validate

# Run benchmark suite
npx ts-node tests/storage/scripts/run-tests.ts --benchmark

# Get help
npx ts-node tests/storage/scripts/run-tests.ts --help
```

## 📊 Test Coverage

### Coverage Targets

| Component | Branches | Functions | Lines | Statements |
|-----------|----------|-----------|-------|------------|
| **Overall** | 80% | 85% | 85% | 85% |
| **StorageService** | 90% | 95% | 95% | 95% |
| **Adapters** | 85% | 90% | 90% | 90% |
| **Plugins** | 80% | 85% | 85% | 85% |

### Viewing Coverage Reports

```bash
# Generate coverage report
npm run test:storage all --coverage

# Open HTML coverage report
open coverage/storage/lcov-report/index.html
```

## 🛠️ Test Utilities

### Mock Implementations

Located in `/mocks/`:

- **MockStorageAdapter** - In-memory storage adapter for testing
- **MockPlugin** - Configurable plugin implementation
- **MockBackupService** - Backup service simulation

### Test Data Fixtures

Located in `/fixtures/`:

- **testData.ts** - Factory functions for test data generation
- **sampleData.ts** - Realistic sample knowledge base entries
- **performanceData.ts** - Large datasets for performance testing

### Custom Jest Matchers

```typescript
// Custom matchers for storage-specific assertions
expect(entry).toBeValidKBEntry();
expect(searchResult).toBeValidSearchResult();
expect(operationTime).toHaveReasonablePerformance(1000);
expect(memoryUsage).toBeWithinMemoryLimit(100); // 100MB
```

## 🔧 Configuration

### Jest Configuration

Test configuration is in `jest.config.js` with project-specific settings:

- TypeScript transformation
- Custom test environment setup
- Coverage collection and thresholds
- Test timeouts and worker configuration
- Reporter configuration for CI/CD

### Environment Variables

```bash
NODE_ENV=test              # Test environment
LOG_LEVEL=error           # Reduce log noise
NODE_OPTIONS=--max-old-space-size=4096  # Memory for large tests
CI=true                   # CI mode optimizations
```

## 📈 Performance Benchmarks

### Benchmark Targets

| Operation | Target | Measurement |
|-----------|--------|-------------|
| **Single Insert** | <100ms | Average time per operation |
| **Single Search** | <50ms | Average time per operation |
| **Batch Insert (100)** | <5ms/entry | Time per entry in batch |
| **Full-text Search** | <1s | With 1000+ entries |
| **Concurrent Reads** | >50 ops/sec | Throughput under load |

### Running Benchmarks

```bash
# Run all performance tests
npm run test:storage performance

# Run specific benchmark
npm run test:storage performance --name-pattern="Single Operation"

# Run with detailed output
npm run test:storage performance --verbose
```

## 🐛 Debugging Tests

### Debug Mode

```bash
# Run tests with Node.js debugger
node --inspect-brk node_modules/.bin/jest --config tests/storage/jest.config.js

# Debug specific test
npx jest --config tests/storage/jest.config.js --testNamePattern="should handle errors" --runInBand
```

### Logging and Diagnostics

```typescript
// Enable debug logging in tests
process.env.LOG_LEVEL = 'debug';

// Memory usage tracking
console.log(process.memoryUsage());

// Performance timing
console.time('operation');
await storageService.someOperation();
console.timeEnd('operation');
```

## 🚨 Error Scenarios

### Error Testing Patterns

Tests include comprehensive error scenario coverage:

- **Database Connection Failures** - Network issues, permission errors
- **Data Corruption** - Invalid data, schema mismatches
- **Memory Pressure** - Large datasets, memory leaks
- **Concurrent Access** - Race conditions, deadlocks
- **Plugin Failures** - Plugin crashes, dependency issues

### Chaos Testing

```bash
# Run tests with simulated failures
npm run test:storage integration --name-pattern="should handle.*errors"

# Stress test with resource constraints
npm run test:storage performance --workers=1
```

## 📋 Test Checklist

Before committing changes, ensure:

- [ ] All unit tests pass
- [ ] Integration tests pass with real dependencies
- [ ] Performance benchmarks meet targets
- [ ] Code coverage meets thresholds
- [ ] No memory leaks detected
- [ ] Error scenarios are covered
- [ ] Documentation is updated

### Pre-commit Hook

```bash
# Add to .git/hooks/pre-commit
#!/bin/sh
npm run test:storage unit --bail
npm run test:storage integration --bail
```

## 📝 Writing New Tests

### Test Structure

```typescript
describe('ComponentName', () => {
  let component: ComponentType;
  
  beforeEach(async () => {
    component = new ComponentType();
    await component.initialize();
  });
  
  afterEach(async () => {
    await component.cleanup();
  });
  
  describe('functionality group', () => {
    it('should behave correctly', async () => {
      // Arrange
      const input = createTestData();
      
      // Act
      const result = await component.method(input);
      
      // Assert
      expect(result).toBeValidResult();
    });
  });
});
```

### Best Practices

1. **Use descriptive test names** - `should handle concurrent operations without data corruption`
2. **Follow AAA pattern** - Arrange, Act, Assert
3. **Test one thing per test** - Single responsibility
4. **Use appropriate test type** - Unit vs Integration vs E2E
5. **Clean up resources** - Prevent test pollution
6. **Mock external dependencies** - For unit tests
7. **Test error scenarios** - Not just happy paths
8. **Measure performance** - Use custom matchers
9. **Use realistic data** - Leverage fixtures
10. **Document complex tests** - Add comments for clarity

## 🔄 Continuous Integration

### CI Configuration

```yaml
# .github/workflows/test-storage.yml
name: Storage Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:storage all --ci
      - uses: codecov/codecov-action@v3
        with:
          file: coverage/storage/lcov.info
```

### Quality Gates

- **Coverage**: Minimum 85% overall coverage
- **Performance**: All benchmarks must pass
- **No Regressions**: New code doesn't slow down existing functionality
- **Memory**: No memory leaks detected
- **Reliability**: All tests pass consistently

## 📚 References

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [TypeScript Testing Best Practices](https://typescript-eslint.io/docs/linting/troubleshooting/performance-troubleshooting)
- [Node.js Testing Guide](https://nodejs.org/en/docs/guides/testing/)
- [Storage Service Architecture](../../src/services/storage/README.md)

## 🤝 Contributing

When adding new tests:

1. Choose the appropriate test category
2. Follow the established patterns
3. Add to the relevant test suite
4. Update coverage targets if needed
5. Document complex test scenarios
6. Ensure tests are deterministic
7. Add performance benchmarks for new features

For questions or issues with the test suite, please create an issue with the `testing` label.