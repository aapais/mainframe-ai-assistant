# Search Functional Test Suite

Comprehensive functional testing framework for search features verification.

## Overview

This test suite provides complete functional validation of the search system, covering:

- **Query Processing**: Parser validation, boolean operators, phrase queries
- **Ranking & Relevance**: BM25 algorithm, field boosting, fuzzy matching
- **Filtering & Facets**: Category/tag filters, multi-filter combinations
- **Caching & Performance**: Cache validation, response time verification
- **Analytics & Metrics**: Search metrics collection and reporting
- **Error Handling**: Edge cases, malformed queries, concurrent access

## Test Architecture

```
tests/functional/search/
├── SearchFunctionalTestSuite.test.ts  # Main test suite
├── fixtures/
│   └── SearchFunctionalTestData.ts    # Test data generator
├── helpers/
│   ├── SearchMetricsCollector.ts      # Metrics collection
│   └── SearchAssertions.ts            # Custom assertions
├── FunctionalTestRunner.ts            # Test orchestration
├── jest.config.functional.js          # Jest configuration
├── setup.ts                           # Test environment setup
└── README.md                          # This file
```

## Quick Start

### Run All Functional Tests

```bash
# Run comprehensive functional test suite
npm run test:search:functional

# Run with performance monitoring
npm run test:search:functional:performance

# Run stress tests
npm run test:search:functional:stress
```

### Run Specific Test Categories

```bash
# Query processing tests only
npm run test:search:functional -- --testNamePattern="Query Processing"

# Ranking algorithm tests only
npm run test:search:functional -- --testNamePattern="Ranking"

# Caching tests only
npm run test:search:functional -- --testNamePattern="Caching"
```

### Run with Custom Configuration

```bash
# Run with verbose output
VERBOSE_TESTS=true npm run test:search:functional

# Run with memory monitoring
MONITOR_MEMORY=true npm run test:search:functional

# Run stress tests with high load
STRESS_TEST_MODE=true npm run test:search:functional
```

## Test Categories

### 1. Query Processing and Parsing

Tests query parser functionality:
- Simple text queries
- Boolean operators (AND, OR, NOT)
- Phrase queries with quotes
- Field-specific queries
- Query validation and error handling

**Example Test:**
```typescript
test('should parse boolean query operators correctly', async () => {
  const parsed = queryParser.parse('VSAM AND DB2 OR JCL');
  expect(parsed.type).toBe('boolean');
  expect(parsed.terms).toContainOperators(['AND', 'OR']);
});
```

### 2. Search Result Ranking

Validates ranking algorithms:
- BM25 relevance scoring
- Field-specific boosting
- Fuzzy matching for misspellings
- Exact phrase prioritization

**Example Test:**
```typescript
test('should rank results by relevance using BM25', async () => {
  const results = await searchEngine.search('VSAM error');
  assertions.assertResultsRankedByRelevance(results.results);
  expect(results.results[0].score).toBeGreaterThan(results.results[1].score);
});
```

### 3. Filtering and Faceted Search

Tests filtering capabilities:
- Category filtering
- Tag-based filtering
- Multi-filter combinations
- Facet count accuracy

**Example Test:**
```typescript
test('should filter results by category', async () => {
  const results = await searchEngine.search('error', { category: 'VSAM' });
  results.results.forEach(result => {
    expect(result.entry.category).toBe('VSAM');
  });
});
```

### 4. Caching and Performance

Validates caching system:
- Cache hit/miss behavior
- Cache invalidation on updates
- Performance threshold compliance
- Concurrent request handling

**Example Test:**
```typescript
test('should cache search results correctly', async () => {
  const firstResults = await searchEngine.search('test query');
  expect(firstResults.metrics.cacheHit).toBe(false);

  const secondResults = await searchEngine.search('test query');
  expect(secondResults.metrics.cacheHit).toBe(true);
});
```

### 5. Analytics and Metrics

Tests metrics collection:
- Search performance metrics
- Engine statistics tracking
- Score explanations
- Usage analytics

**Example Test:**
```typescript
test('should collect search metrics accurately', async () => {
  const results = await searchEngine.search('analytics test');
  expect(results.metrics.totalTime).toBeGreaterThan(0);
  expect(results.metrics.algorithm).toBeDefined();
});
```

### 6. Error Handling and Edge Cases

Validates robustness:
- Empty queries
- Very long queries
- Special characters
- Concurrent access
- Malformed input

**Example Test:**
```typescript
test('should handle special characters gracefully', async () => {
  const query = 'error@system.com (parentheses) "quotes"';
  const results = await searchEngine.search(query);
  expect(results).toBeDefined();
  expect(results.metadata.processingTime).toBeLessThan(1000);
});
```

## Test Data

### Realistic Test Data Generation

The `SearchFunctionalTestData` class generates realistic mainframe knowledge base entries:

```typescript
const testData = new SearchFunctionalTestData();
const entries = await testData.generateTestEntries(1000, {
  categoryDistribution: {
    'VSAM': 0.25,
    'DB2': 0.20,
    'JCL': 0.20,
    'CICS': 0.15,
    'IMS': 0.10,
    'COBOL': 0.10
  }
});
```

### Edge Case Data

Includes challenging test cases:
- Very long content
- Special characters and Unicode
- Empty/minimal content
- Error codes and numbers
- Stress test data

## Performance Thresholds

### Response Time Requirements

- **Search queries**: < 1000ms
- **Cache hits**: < 100ms
- **Index operations**: < 5000ms
- **Concurrent requests**: < 2000ms per request

### Cache Performance

- **Hit rate target**: ≥ 70%
- **Cache invalidation**: < 50ms
- **Memory usage**: < 512MB

### Throughput Requirements

- **Concurrent searches**: 10+ simultaneous
- **Queries per second**: 50+ sustained
- **Index size**: 10,000+ documents

## Metrics Collection

### Automated Metrics

The test suite automatically collects:
- Query parsing performance
- Search response times
- Cache hit/miss rates
- Memory usage patterns
- Error rates and types

### Custom Assertions

Specialized assertions for search functionality:

```typescript
// Query parsing validation
assertions.assertQueryParsing(parsed, {
  type: 'boolean',
  termCount: 3,
  containsTerms: ['vsam', 'error']
});

// Ranking validation
assertions.assertResultsRankedByRelevance(results, {
  scoreOrder: 'descending',
  minScore: 0.1
});

// Cache validation
assertions.assertCacheFunction(
  firstSearchTime,
  secondSearchTime,
  cacheHit,
  0.5 // 50% improvement expected
);
```

## Reporting

### Comprehensive Reports

Tests generate detailed reports:
- **JSON Report**: Machine-readable results
- **HTML Report**: Visual dashboard with charts
- **Coverage Report**: Code coverage analysis
- **Performance Report**: Timing and resource usage

### Report Contents

- Overall test results summary
- Individual test suite results
- Performance metrics and trends
- Coverage analysis
- Recommendations for improvements

### Example Report Structure

```json
{
  "timestamp": "2025-01-15T10:30:00Z",
  "overallResult": "PASSED",
  "summary": {
    "totalTests": 157,
    "passedTests": 154,
    "failedTests": 3,
    "averageResponseTime": 245.7
  },
  "recommendations": [
    "Consider optimizing fuzzy matching performance",
    "Expand stress test coverage for high concurrency"
  ]
}
```

## Configuration

### Environment Variables

```bash
# Test behavior
FUNCTIONAL_TEST_MODE=true        # Enable functional test mode
VERBOSE_TESTS=true              # Detailed logging
MONITOR_MEMORY=true             # Memory usage tracking

# Performance testing
PERFORMANCE_TEST_MODE=true      # Enable performance monitoring
STRESS_TEST_MODE=true          # Enable stress testing
ENABLE_STRESS_TESTS=true       # Include stress test suites

# Test data
TEST_DATA_SIZE=1000            # Number of test entries
INCLUDE_EDGE_CASES=true        # Include edge case data
SEED_DATA=true                 # Use consistent seed data
```

### Jest Configuration

Key Jest settings for functional tests:

```javascript
module.exports = {
  testTimeout: 60000,           // 60 second timeout
  maxWorkers: '50%',           // Use half of CPU cores
  collectCoverage: true,       // Generate coverage reports
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90
    }
  }
};
```

## Best Practices

### Writing Functional Tests

1. **Test Real Scenarios**: Use realistic queries and data
2. **Verify End-to-End**: Test complete search workflows
3. **Assert Behavior**: Check functional behavior, not just data
4. **Use Performance Thresholds**: Validate speed requirements
5. **Test Edge Cases**: Include error conditions and boundary values

### Test Organization

1. **Group Related Tests**: Organize by functionality
2. **Use Descriptive Names**: Clear test descriptions
3. **Independent Tests**: Each test should be self-contained
4. **Proper Setup/Teardown**: Clean state between tests
5. **Meaningful Assertions**: Validate expected behavior

### Performance Testing

1. **Set Clear Thresholds**: Define acceptable performance limits
2. **Monitor Resources**: Track memory and CPU usage
3. **Test Under Load**: Validate concurrent access scenarios
4. **Profile Bottlenecks**: Identify performance issues
5. **Regression Testing**: Prevent performance degradation

## Troubleshooting

### Common Issues

**Test Timeouts**
```bash
# Increase timeout for slow tests
jest --testTimeout=120000
```

**Memory Issues**
```bash
# Increase Node.js memory limit
node --max-old-space-size=4096 node_modules/.bin/jest
```

**Coverage Problems**
```bash
# Generate detailed coverage report
npm run test:search:functional -- --coverage --verbose
```

### Debug Mode

Enable detailed debugging:

```bash
# Run with debug output
DEBUG=search:* npm run test:search:functional

# Run single test with full output
npm run test:search:functional -- --testNamePattern="specific test" --verbose
```

### Performance Issues

Analyze performance problems:

```bash
# Run with performance profiling
MONITOR_MEMORY=true PERFORMANCE_TEST_MODE=true npm run test:search:functional

# Generate performance report
npm run test:search:functional:performance
```

## Contributing

### Adding New Tests

1. Create test in appropriate category
2. Use existing helpers and assertions
3. Include performance validation
4. Add edge case coverage
5. Update documentation

### Extending Test Data

1. Modify `SearchFunctionalTestData.ts`
2. Add new test scenarios
3. Include challenging edge cases
4. Maintain realistic data patterns
5. Document new test cases

### Custom Assertions

1. Add to `SearchAssertions.ts`
2. Include parameter validation
3. Provide clear error messages
4. Add usage examples
5. Write unit tests for assertions

---

## Summary

This functional test suite provides comprehensive validation of search functionality with:

- ✅ **157 functional tests** covering all search features
- ✅ **Performance validation** with strict thresholds
- ✅ **Realistic test data** with 1000+ generated entries
- ✅ **Comprehensive reporting** with HTML dashboards
- ✅ **Edge case coverage** including error conditions
- ✅ **Concurrent testing** for high-load scenarios
- ✅ **Cache validation** for optimization verification
- ✅ **Metrics collection** for performance analysis

The suite ensures search functionality meets requirements and performs reliably under all conditions.