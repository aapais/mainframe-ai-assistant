# SearchService Test Suite

Comprehensive test suite for the SearchService module, ensuring <1s response
time and high-quality search functionality.

## 🎯 Test Objectives

The SearchService test suite validates:

- **Performance**: Response times consistently under 1 second
- **Quality**: Accurate relevance scoring and ranking
- **Reliability**: Robust error handling and fallback mechanisms
- **Scalability**: Performance under various load conditions
- **Accuracy**: Correct search algorithms and tokenization

## 📋 Test Suites

### 1. Unit Tests (`SearchService.unit.test.ts`)

**Purpose**: Test core search algorithms, tokenization, and ranking logic in
isolation.

**Coverage**:

- Search algorithm functionality
- Tokenization and query processing
- Relevance scoring calculations
- Ranking logic validation
- Search options handling
- Edge case scenarios

**Key Validations**:

- Exact vs fuzzy match prioritization
- Score calculation accuracy
- Usage and success rate boosting
- Category and tag filtering
- Performance metadata generation

**Run Command**:

```bash
npm run test:search:unit
```

### 2. Integration Tests (`SearchService.integration.test.ts`)

**Purpose**: Test SearchService integration with database, cache, and external
services.

**Coverage**:

- Database integration
- Search index operations
- Cache functionality
- AI service integration (with fallbacks)
- Search history tracking
- Error handling across components

**Key Validations**:

- Database transaction integrity
- Cache invalidation policies
- AI service fallback mechanisms
- Search history persistence
- Cross-component error handling

**Run Command**:

```bash
npm run test:search:integration
```

### 3. Performance Tests (`SearchService.performance.test.ts`)

**Purpose**: Validate <1s response time requirement under various load
conditions.

**Coverage**:

- Load testing (concurrent searches)
- Stress testing (maximum capacity)
- Spike testing (sudden load increases)
- Endurance testing (sustained performance)
- Memory leak detection

**Key Validations**:

- Response time < 1000ms consistently
- Throughput > 10 QPS under load
- Memory usage stability
- Performance degradation limits
- Recovery after stress

**Run Command**:

```bash
npm run test:search:performance
```

### 4. Quality Tests (`SearchService.quality.test.ts`)

**Purpose**: Ensure search result relevance, ranking accuracy, and fuzzy
matching quality.

**Coverage**:

- Relevance scoring quality
- Ranking accuracy validation
- Fuzzy matching effectiveness
- Search context understanding
- Edge case handling

**Key Validations**:

- Exact matches rank highest
- Domain-specific prioritization
- Typo tolerance
- Case insensitive matching
- Mainframe terminology recognition

**Run Command**:

```bash
npm run test:search:quality
```

### 5. Benchmark Tests (`SearchService.benchmark.test.ts`)

**Purpose**: Comprehensive performance benchmarking with detailed metrics.

**Coverage**:

- Response time benchmarks across dataset sizes
- Throughput measurements
- Memory usage profiling
- Index performance
- Concurrent user simulation

**Key Validations**:

- Statistical performance analysis
- P95/P99 response time metrics
- Memory leak detection
- Scalability validation
- Index optimization effectiveness

**Run Command**:

```bash
npm run test:search:benchmark
```

## 🚀 Quick Start

### Run All Tests

```bash
npm run test:search
```

### Run Specific Test Suite

```bash
npm run test:search:unit           # Unit tests only
npm run test:search:integration    # Integration tests only
npm run test:search:performance    # Performance tests only
npm run test:search:quality        # Quality tests only
npm run test:search:benchmark      # Benchmark tests only
```

### Test Runner Options

```bash
# Show available test suites
node src/services/__tests__/run-search-tests.js --list

# Show help
node src/services/__tests__/run-search-tests.js --help

# Run specific suite with custom options
node src/services/__tests__/run-search-tests.js benchmark
```

## 📊 Performance Targets

| Metric           | Target          | Test Suite             | Notes            |
| ---------------- | --------------- | ---------------------- | ---------------- |
| Response Time    | <1000ms         | Performance, Benchmark | 95th percentile  |
| Throughput       | >10 QPS         | Performance, Benchmark | Sustained load   |
| Memory Usage     | <100MB increase | Performance, Benchmark | During stress    |
| Search Accuracy  | >80% relevant   | Quality                | Top 10 results   |
| Index Build Time | <5s             | Benchmark              | For 2000 entries |
| Concurrent Users | 5+ simultaneous | Performance            | No degradation   |

## 🧪 Test Data

### Mock Datasets

**Small Dataset (100 entries)**:

- Basic functionality testing
- Fast execution for unit tests
- Covers all categories and error types

**Medium Dataset (500 entries)**:

- Integration testing
- Performance validation
- Real-world simulation

**Large Dataset (2000 entries)**:

- Stress testing
- Scalability validation
- Benchmark measurements

### Test Entry Structure

```typescript
{
  id: string;
  title: string;           // Brief description
  problem: string;         // Detailed problem description
  solution: string;        // Step-by-step solution
  category: KBCategory;    // JCL, VSAM, DB2, etc.
  tags: string[];          // Keywords for matching
  usage_count: number;     // Simulated usage statistics
  success_count: number;   // Success tracking
  failure_count: number;   // Failure tracking
}
```

## 📈 Test Metrics & Reporting

### Performance Metrics Collected

1. **Response Time Statistics**:
   - Mean, median, min, max
   - 95th and 99th percentiles
   - Standard deviation

2. **Throughput Measurements**:
   - Queries per second (QPS)
   - Concurrent user handling
   - Parallel execution efficiency

3. **Memory Usage Tracking**:
   - Heap usage monitoring
   - Memory leak detection
   - Garbage collection impact

4. **Search Quality Metrics**:
   - Relevance accuracy
   - Ranking consistency
   - Match type distribution

### Test Output Example

```
🧪 SearchService Comprehensive Test Suite
====================================

📋 Unit Tests - Search algorithms, tokenization, scoring
✅ PASSED - Duration: 2847ms

📋 Integration Tests - API endpoints, database, cache
✅ PASSED - Duration: 5124ms

📋 Performance Tests - Load, stress, spike, endurance
✅ PASSED - Duration: 15678ms

📋 Quality Tests - Relevance, ranking accuracy, fuzzy matching
✅ PASSED - Duration: 3456ms

📋 Benchmark Tests - Response time, throughput, memory
✅ PASSED - Duration: 45123ms

📈 Overall Results:
   Passed: 5/5
   Duration: 72s
   Success Rate: 100%
```

## 🔧 Configuration

### Environment Variables

```bash
NODE_ENV=test                    # Test environment
GEMINI_API_KEY=test-api-key     # Mock API key for tests
VERBOSE_TESTS=true              # Enable detailed logging
```

### Jest Configuration

Tests use custom Jest setup from `src/test-setup.ts`:

- Custom matchers for performance validation
- Memory monitoring
- Console filtering for benchmarks
- Timeout configuration (30s default)

### Test Timeouts

- Unit tests: 30 seconds
- Integration tests: 60 seconds
- Performance tests: 120 seconds
- Quality tests: 45 seconds
- Benchmark tests: 180 seconds

## 🐛 Troubleshooting

### Common Issues

**Memory Errors**:

```bash
# Increase Node.js memory limit
node --max-old-space-size=4096 node_modules/.bin/jest
```

**Timeout Errors**:

```bash
# Run specific slow tests
npm run test:search:benchmark -- --timeout=300000
```

**Database Lock Issues**:

- Tests use in-memory SQLite databases
- Each test suite creates isolated database instances
- Cleanup handled automatically

### Performance Issues

**Slow Test Execution**:

1. Check system resources during test run
2. Verify no background processes affecting performance
3. Consider running tests on dedicated test environment

**Inconsistent Results**:

1. Ensure stable system load during testing
2. Run warmup rounds before benchmarks
3. Check for memory pressure

### Debug Mode

```bash
# Enable verbose logging
VERBOSE_TESTS=true npm run test:search

# Run with Node.js debugger
node --inspect-brk node_modules/.bin/jest --testPathPattern=SearchService
```

## 🎯 Success Criteria

### Test Suite Passes When:

1. **All tests complete successfully** (exit code 0)
2. **Response times consistently <1s** (95th percentile)
3. **No memory leaks detected** (<100MB increase during stress)
4. **Search quality maintained** (>80% relevance accuracy)
5. **Error handling robust** (graceful fallbacks working)

### CI/CD Integration

The test suite is designed for continuous integration:

```bash
# CI/CD pipeline command
npm run test:search 2>&1 | tee search-test-results.log
```

Exit codes:

- `0`: All tests passed
- `1`: One or more test suites failed

## 📚 References

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [SearchService Implementation](../SearchService.ts)
- [Type Definitions](../../types/services.ts)
- [Performance Requirements](../../../project-docs/complete/requisitos-funcionais-por-mvp-v1.md)

---

**Last Updated**: January 2025  
**Test Suite Version**: 1.0.0  
**Minimum Node.js**: 18.0.0
