# IPC Testing Guide

## Overview

This guide provides comprehensive documentation for testing the Inter-Process Communication (IPC) implementation in the Mainframe AI Assistant. The test suite covers unit testing, integration testing, performance benchmarking, security validation, and end-to-end scenarios.

## Table of Contents

1. [Test Structure](#test-structure)
2. [Test Categories](#test-categories)
3. [Running Tests](#running-tests)
4. [Test Utilities](#test-utilities)
5. [Performance Benchmarks](#performance-benchmarks)
6. [Security Testing](#security-testing)
7. [Coverage Requirements](#coverage-requirements)
8. [CI/CD Integration](#cicd-integration)
9. [Troubleshooting](#troubleshooting)

## Test Structure

The IPC test suite is organized into the following structure:

```
tests/
├── fixtures/
│   └── ipc-test-data.ts          # Test data and fixtures
├── helpers/
│   └── ipc-test-utils.ts         # Testing utilities and mocks
├── unit/
│   └── ipc/
│       ├── handlers.test.ts      # Unit tests for IPC handlers
│       └── security.test.ts      # Security validation tests
├── integration/
│   └── ipc-flow.test.ts          # Integration tests
├── performance/
│   └── ipc-benchmark.test.ts     # Performance benchmarks
└── e2e/
    └── ipc-e2e.test.ts          # End-to-end tests
```

## Test Categories

### 1. Unit Tests (`tests/unit/ipc/`)

#### Handler Tests (`handlers.test.ts`)
Tests individual IPC handler functions in isolation:

- **KnowledgeBaseHandler**: CRUD operations, validation, caching
- **SearchHandler**: Semantic search, autocomplete, AI integration
- **MetricsHandler**: System metrics, usage statistics
- **IPCHandlerRegistry**: Handler registration and execution

**Key Test Scenarios:**
- Valid request processing
- Input validation and sanitization
- Error handling and recovery
- Cache utilization
- Business logic correctness

#### Security Tests (`security.test.ts`)
Comprehensive security testing:

- **Input Validation**: Required fields, data types, format validation
- **Input Sanitization**: XSS prevention, SQL injection protection
- **Rate Limiting**: Request throttling, abuse prevention
- **Authorization**: Permission checking, session validation
- **Attack Prevention**: DoS protection, threat detection

### 2. Integration Tests (`tests/integration/ipc-flow.test.ts`)

Tests complete IPC communication flows:

- **Complete CRUD Workflows**: Multi-step operations
- **Cross-Handler Communication**: Handler coordination
- **Error Handling and Recovery**: Graceful degradation
- **Performance and Scalability**: Load handling
- **Security Integration**: End-to-end security validation

### 3. Performance Tests (`tests/performance/ipc-benchmark.test.ts`)

Comprehensive performance benchmarking:

- **Single Operation Performance**: Latency measurements
- **Concurrent Operations**: Parallelization effectiveness
- **Throughput Testing**: Operations per second
- **Caching Performance**: Cache hit/miss ratios
- **Memory Usage**: Resource consumption monitoring
- **Scalability Testing**: Performance under load

### 4. End-to-End Tests (`tests/e2e/ipc-e2e.test.ts`)

Complete user workflow simulation:

- **User Workflow Scenarios**: Real user interactions
- **Multi-User Concurrent Usage**: Collaborative scenarios
- **Application Lifecycle Events**: Startup/shutdown handling
- **Error Recovery Scenarios**: Resilience testing
- **Performance in Real-World Scenarios**: Production-like conditions

## Running Tests

### Prerequisites

```bash
# Install dependencies
npm install

# Install development dependencies
npm install --save-dev
```

### Running Individual Test Suites

```bash
# Run all IPC tests
npm test -- tests/unit/ipc tests/integration/ipc-flow.test.ts

# Run unit tests only
npm test -- tests/unit/ipc

# Run integration tests
npm test -- tests/integration/ipc-flow.test.ts

# Run performance benchmarks
npm test -- tests/performance/ipc-benchmark.test.ts

# Run E2E tests
npm test -- tests/e2e/ipc-e2e.test.ts

# Run security tests specifically
npm test -- tests/unit/ipc/security.test.ts
```

### Running with Coverage

```bash
# Generate coverage report
npm run test:coverage

# Coverage with specific threshold
npm run test:coverage -- --coverage-threshold=90
```

### Running Performance Benchmarks

```bash
# Run benchmarks with detailed output
npm run test:performance

# Run benchmarks with memory profiling
node --expose-gc npm run test:performance

# Run stress tests
npm run test:stress
```

## Test Utilities

### Mock Objects

The test suite provides comprehensive mock objects:

```typescript
import {
  MockIPCMain,
  MockBrowserWindow,
  MockKnowledgeDB,
  MockCacheManager,
  IPCTestEnvironment
} from '../helpers/ipc-test-utils';
```

#### IPCTestEnvironment
Complete test environment setup:

```typescript
const testEnv = new IPCTestEnvironment();

// Setup test data
await testEnv.setupTestData([
  { id: 'test-1', title: 'Test Entry' }
]);

// Reset between tests
testEnv.reset();
```

#### Performance Tracking

```typescript
import { PerformanceTracker } from '../helpers/ipc-test-utils';

const tracker = new PerformanceTracker();

const operationId = tracker.start('test-operation');
// ... perform operation
const duration = tracker.end(operationId);

const stats = tracker.getStats(); // min, max, avg, total
```

#### Load Testing

```typescript
import { LoadTestRunner } from '../helpers/ipc-test-utils';

const runner = new LoadTestRunner();

const requests = Array.from({ length: 100 }, () => 
  () => performOperation()
);

const results = await runner.runConcurrentRequests(requests, 10);
```

### Assertion Helpers

Specialized assertion functions:

```typescript
import {
  assertValidIPCRequest,
  assertValidIPCResponse,
  assertValidIPCError,
  assertPerformanceMetrics,
  assertSecurityValidation
} from '../helpers/ipc-test-utils';

// Validate IPC response structure
assertValidIPCResponse(response);

// Validate performance within limits
assertPerformanceMetrics(duration, maxTime);

// Validate security blocking
assertSecurityValidation(response, shouldFail);
```

## Performance Benchmarks

### Performance Thresholds

The test suite enforces the following performance thresholds:

```typescript
const PERFORMANCE_THRESHOLDS = {
  search: {
    fast: 50,      // < 50ms for cached/simple searches
    normal: 200,   // < 200ms for complex searches
    slow: 1000     // < 1s for AI-enhanced searches
  },
  create: {
    fast: 100,     // < 100ms for simple entries
    normal: 300,   // < 300ms for complex entries
    slow: 1000     // < 1s for entries with AI processing
  },
  batch: {
    throughput: 100, // > 100 operations per second
    latency: 500     // < 500ms average latency
  }
};
```

### Benchmark Categories

1. **Single Operation Performance**
   - Simple search operations: < 50ms
   - Complex search operations: < 200ms
   - Entry creation: < 300ms
   - Large entry handling: < 1000ms

2. **Concurrent Operations**
   - 50 concurrent searches: < 200ms average
   - Mixed operation types: < 500ms average
   - Cache effectiveness: > 50% performance improvement

3. **Throughput Testing**
   - Read operations: > 100 ops/sec
   - Write operations: > 50 ops/sec
   - Success rate: > 95%

4. **Memory Usage**
   - Memory increase during tests: < 50MB
   - Memory leak detection: < 10MB growth
   - Resource cleanup verification

### Running Performance Tests

```bash
# Standard benchmarks
npm run test:performance

# Memory profiling enabled
node --expose-gc npm test -- tests/performance/

# Detailed performance analysis
npm run test:performance -- --verbose

# Stress testing
npm run test:stress -- --iterations=1000
```

## Security Testing

### Security Test Categories

1. **Input Validation**
   - Required field enforcement
   - Data type validation
   - Format validation
   - Range checking

2. **Input Sanitization**
   - XSS attack prevention
   - SQL injection protection
   - HTML sanitization
   - Unicode handling

3. **Rate Limiting**
   - Request throttling
   - User-based limits
   - Channel-specific limits
   - Reset window handling

4. **Authorization**
   - Permission validation
   - Session verification
   - Role-based access
   - Resource ownership

5. **Attack Prevention**
   - DoS protection
   - Pattern recognition
   - Threat scoring
   - Response limiting

### Security Test Data

```typescript
import { securityTestData } from '../fixtures/ipc-test-data';

// SQL injection attempts
securityTestData.sqlInjectionAttempts

// XSS payloads
securityTestData.xssAttempts

// Oversized requests
securityTestData.oversizedRequests

// Unauthorized access attempts
securityTestData.unauthorizedRequests
```

### Running Security Tests

```bash
# All security tests
npm test -- tests/unit/ipc/security.test.ts

# Specific security category
npm test -- tests/unit/ipc/security.test.ts -t "Input Validation"

# Security integration tests
npm test -- tests/integration/ipc-flow.test.ts -t "Security"
```

## Coverage Requirements

### Minimum Coverage Targets

- **Overall Code Coverage**: 90%
- **Handler Functions**: 95%
- **Security Functions**: 100%
- **Error Handling Paths**: 85%
- **Integration Flows**: 80%

### Coverage Commands

```bash
# Generate coverage report
npm run test:coverage

# Coverage with HTML report
npm run test:coverage -- --coverage --coverageReporters=html

# Coverage for specific files
npm run test:coverage -- tests/unit/ipc/ --collectCoverageFrom="src/main/ipc/**/*.ts"
```

### Coverage Analysis

Coverage reports are generated in the `coverage/` directory:

```
coverage/
├── lcov-report/
│   └── index.html          # HTML coverage report
├── lcov.info              # LCOV format
└── coverage-summary.json  # JSON summary
```

## CI/CD Integration

### GitHub Actions Example

```yaml
# .github/workflows/ipc-tests.yml
name: IPC Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run unit tests
        run: npm test -- tests/unit/ipc/
      
      - name: Run integration tests
        run: npm test -- tests/integration/ipc-flow.test.ts
      
      - name: Run security tests
        run: npm test -- tests/unit/ipc/security.test.ts
      
      - name: Performance benchmarks
        run: npm run test:performance
      
      - name: Coverage report
        run: npm run test:coverage
      
      - name: Upload coverage
        uses: codecov/codecov-action@v1
```

### Jenkins Pipeline

```groovy
pipeline {
  agent any
  stages {
    stage('Test') {
      parallel {
        stage('Unit Tests') {
          steps {
            sh 'npm test -- tests/unit/ipc/'
          }
        }
        stage('Integration Tests') {
          steps {
            sh 'npm test -- tests/integration/ipc-flow.test.ts'
          }
        }
        stage('Performance Tests') {
          steps {
            sh 'npm run test:performance'
          }
        }
      }
    }
    stage('Coverage') {
      steps {
        sh 'npm run test:coverage'
        publishHTML([
          allowMissing: false,
          alwaysLinkToLastBuild: true,
          keepAll: true,
          reportDir: 'coverage/lcov-report',
          reportFiles: 'index.html',
          reportName: 'Coverage Report'
        ])
      }
    }
  }
}
```

## Troubleshooting

### Common Issues

#### 1. Test Timeouts

```typescript
// Increase timeout for slow operations
jest.setTimeout(30000); // 30 seconds

// Or per test
test('slow operation', async () => {
  // test code
}, 30000);
```

#### 2. Memory Leaks in Tests

```typescript
// Enable garbage collection
beforeAll(() => {
  if (global.gc) {
    global.gc();
  }
});

// Clean up after tests
afterEach(() => {
  testEnv.reset();
  jest.clearAllMocks();
});
```

#### 3. Flaky Performance Tests

```typescript
// Use performance ranges instead of fixed values
expect(duration).toBeGreaterThan(minTime);
expect(duration).toBeLessThan(maxTime);

// Average multiple runs
const durations = [];
for (let i = 0; i < 10; i++) {
  durations.push(await measureOperation());
}
const avgDuration = durations.reduce((a, b) => a + b) / durations.length;
```

#### 4. Mock Issues

```typescript
// Ensure mocks are reset between tests
afterEach(() => {
  jest.clearAllMocks();
  jest.resetAllMocks();
});

// Verify mock calls
expect(mockFunction).toHaveBeenCalledWith(expectedArgs);
expect(mockFunction).toHaveBeenCalledTimes(expectedCount);
```

### Debugging Tests

#### Enable Debug Logging

```bash
# Enable debug output
DEBUG=ipc:* npm test

# Test-specific debugging
NODE_ENV=test DEBUG=test:* npm test
```

#### Test-Specific Debugging

```typescript
// Add debug output to tests
beforeEach(() => {
  if (process.env.DEBUG_TESTS) {
    console.log('Starting test:', expect.getState().currentTestName);
  }
});
```

### Performance Debugging

```typescript
// Add performance monitoring
const tracker = new PerformanceTracker();
const id = tracker.start('operation');
// ... operation
const duration = tracker.end(id);

if (duration > threshold) {
  console.warn(`Slow operation detected: ${duration}ms`);
}
```

## Best Practices

### 1. Test Organization

- Group related tests in describe blocks
- Use descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)
- Keep tests focused and independent

### 2. Mock Usage

- Mock external dependencies
- Use realistic test data
- Verify mock interactions
- Reset mocks between tests

### 3. Performance Testing

- Use realistic data sizes
- Test under various load conditions
- Monitor memory usage
- Establish baseline metrics

### 4. Security Testing

- Test all input validation paths
- Use comprehensive attack vectors
- Verify security error responses
- Test authorization boundaries

### 5. Maintenance

- Update tests when code changes
- Review test coverage regularly
- Monitor performance trends
- Keep test data current

## Additional Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
- [Performance Testing Guide](https://web.dev/performance-testing/)
- [Security Testing Fundamentals](https://owasp.org/www-community/Testing/)

---

This testing guide provides comprehensive coverage of the IPC implementation testing strategy. For specific questions or issues, consult the inline comments in the test files or reach out to the development team.