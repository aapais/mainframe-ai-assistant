# IPC Communication Test Suite

Comprehensive testing framework for Electron IPC communication in the Mainframe KB Assistant application.

## Overview

This test suite provides complete coverage for all aspects of Inter-Process Communication (IPC) between the main and renderer processes in the Electron application. It ensures security, performance, reliability, and proper error handling across all IPC channels.

## Test Architecture

### Test Files Structure

```
tests/ipc/
├── IPC.comprehensive.test.ts      # Main IPC functionality tests
├── IPC.security.test.ts            # Security and validation tests
├── IPC.performance.test.ts         # Performance and load tests
├── IPC.contextBridge.test.ts       # Context bridge security tests
├── IPC.edgeCases.test.ts           # Edge cases and integration tests
├── jest.config.ipc.js              # Jest configuration for IPC tests
├── setup.ts                        # Test setup and utilities
├── globalSetup.ts                  # Global test environment setup
├── globalTeardown.ts               # Global test cleanup
├── run-ipc-tests.js               # Test runner with advanced options
└── README.md                       # This documentation
```

### Test Categories

#### 1. Comprehensive IPC Tests (`IPC.comprehensive.test.ts`)
- Main to renderer process communication
- Renderer to main process communication
- Bidirectional communication patterns
- Error handling in IPC
- Message serialization and deserialization
- Real-world workflow scenarios
- IPC channel registration and cleanup

#### 2. Security Tests (`IPC.security.test.ts`)
- Input validation and sanitization
- SQL injection prevention
- XSS attack prevention
- Rate limiting and DoS protection
- Authentication and authorization
- Origin validation
- Data encryption and integrity
- Security event logging

#### 3. Performance Tests (`IPC.performance.test.ts`)
- Response time measurements
- Throughput and concurrency testing
- Memory usage monitoring
- Streaming performance
- Cache effectiveness
- Load testing scenarios
- Performance regression detection

#### 4. Context Bridge Tests (`IPC.contextBridge.test.ts`)
- Secure API exposure through contextBridge
- Preload script isolation
- Node.js API access restrictions
- TypeScript interface validation
- Error handling in exposed functions
- Security boundary validation
- Memory management

#### 5. Edge Cases Tests (`IPC.edgeCases.test.ts`)
- Network interruption handling
- Process restart scenarios
- Memory pressure situations
- Concurrent window management
- Complex data structure handling
- Error recovery mechanisms
- Real-world integration scenarios

## Running Tests

### Basic Usage

```bash
# Run all IPC tests
node tests/ipc/run-ipc-tests.js

# Run with coverage
node tests/ipc/run-ipc-tests.js --coverage

# Run specific test suite
node tests/ipc/run-ipc-tests.js --suite "Security Tests"

# Run in watch mode for development
node tests/ipc/run-ipc-tests.js --watch --verbose
```

### Advanced Options

```bash
# CI/CD mode with optimized settings
node tests/ipc/run-ipc-tests.js --ci --bail

# Performance testing with leak detection
node tests/ipc/run-ipc-tests.js --detect-leaks --timeout 60000

# Custom worker configuration
node tests/ipc/run-ipc-tests.js --max-workers 4

# Verbose output with specific suite
node tests/ipc/run-ipc-tests.js --verbose --suite "Performance"
```

### NPM Scripts Integration

Add these scripts to your `package.json`:

```json
{
  "scripts": {
    "test:ipc": "node tests/ipc/run-ipc-tests.js",
    "test:ipc:coverage": "node tests/ipc/run-ipc-tests.js --coverage",
    "test:ipc:watch": "node tests/ipc/run-ipc-tests.js --watch",
    "test:ipc:security": "node tests/ipc/run-ipc-tests.js --suite Security",
    "test:ipc:performance": "node tests/ipc/run-ipc-tests.js --suite Performance",
    "test:ipc:ci": "node tests/ipc/run-ipc-tests.js --ci"
  }
}
```

## Test Features

### Security Testing

- **Input Validation**: Tests for malicious script injection, SQL injection, and XSS attacks
- **Rate Limiting**: Validates DoS protection mechanisms
- **Authentication**: Tests session validation and permission-based access control
- **Origin Validation**: Ensures IPC messages come from trusted sources
- **Data Encryption**: Validates secure data transmission

### Performance Testing

- **Response Time**: Measures IPC operation response times
- **Throughput**: Tests concurrent request handling capabilities
- **Memory Usage**: Monitors memory consumption and leak detection
- **Load Testing**: Simulates realistic user load patterns
- **Cache Performance**: Validates caching effectiveness

### Error Handling

- **Network Failures**: Tests recovery from network interruptions
- **Timeout Handling**: Validates timeout mechanisms
- **Data Corruption**: Tests data integrity validation
- **Process Failures**: Tests recovery from process restarts
- **Graceful Degradation**: Validates fallback mechanisms

### Real-world Scenarios

- **Knowledge Base Operations**: CRUD operations through IPC
- **Search Functionality**: Search operations and result streaming
- **File Operations**: Import/export and backup operations
- **Settings Management**: Configuration operations
- **Multi-window Support**: Concurrent window operations

## Configuration

### Jest Configuration (`jest.config.ipc.js`)

Specialized Jest configuration optimized for IPC testing:

- **Environment**: Node.js test environment
- **Timeout**: 30-second timeout for IPC operations
- **Coverage**: Comprehensive coverage reporting
- **Workers**: Optimized for concurrent testing
- **Reporters**: HTML and JUnit reporting

### Global Setup

The global setup (`globalSetup.ts`) provides:

- Environment variable configuration
- Test data generation
- Mock database setup
- Performance monitoring initialization
- Error tracking setup

### Test Utilities

Built-in utilities for testing:

```typescript
// Wait for conditions
await global.testUtils.waitFor(() => condition, 5000);

// Create mock IPC responses
const response = global.testUtils.createMockIPCResponse(data, true);

// Generate test data
const entry = global.testUtils.generateKBEntry('test-id');
const results = global.testUtils.generateSearchResults('query', 10);

// Simulate delays
await global.testUtils.delay(1000);
```

### Custom Matchers

Specialized Jest matchers for IPC testing:

```typescript
// Validate IPC response structure
expect(response).toBeValidIPCResponse();

// Check for specific errors
expect(response).toHaveIPCError('VALIDATION_FAILED');

// Validate execution time
expect(response).toHaveExecutionTime(100); // max 100ms
```

## Coverage Requirements

### Minimum Coverage Thresholds

- **Lines**: 85%
- **Functions**: 90%
- **Branches**: 85%
- **Statements**: 85%

### Critical Components (Higher Requirements)

- **Preload Script**: 95% coverage
- **Security Functions**: 95% coverage
- **Error Handlers**: 90% coverage

## Performance Benchmarks

### Response Time Targets

- **Cached Operations**: < 20ms average
- **Database Queries**: < 200ms average
- **File Operations**: < 5s average
- **Streaming**: > 1000 items/second

### Concurrency Targets

- **Concurrent Requests**: > 50 RPS
- **Multiple Windows**: 5+ windows simultaneously
- **Memory Usage**: < 100MB increase during testing

## Debugging

### Verbose Mode

Run tests with verbose output:

```bash
node tests/ipc/run-ipc-tests.js --verbose
```

### Memory Leak Detection

Enable memory leak detection:

```bash
node tests/ipc/run-ipc-tests.js --detect-leaks
```

### Performance Monitoring

View performance metrics in test reports:

- Response time distribution
- Memory usage patterns
- Error rate analysis
- Throughput measurements

## Reporting

### Coverage Reports

- **HTML Report**: `coverage/ipc/lcov-report/index.html`
- **LCOV Data**: `coverage/ipc/lcov.info`
- **JSON Summary**: `coverage/ipc/coverage-summary.json`

### Execution Reports

- **Detailed Report**: `coverage/ipc/test-execution-report.json`
- **Summary Report**: `coverage/ipc/test-summary.md`
- **JUnit XML**: `coverage/ipc/ipc-junit.xml`

## Integration with CI/CD

### GitHub Actions Example

```yaml
name: IPC Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  ipc-tests:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run IPC tests
      run: node tests/ipc/run-ipc-tests.js --ci
    
    - name: Upload coverage
      uses: codecov/codecov-action@v3
      with:
        file: coverage/ipc/lcov.info
        flags: ipc
```

## Troubleshooting

### Common Issues

1. **Test Timeouts**
   - Increase timeout with `--timeout 60000`
   - Check for memory leaks or infinite loops

2. **Memory Issues**
   - Run with `--detect-leaks` to identify leaks
   - Use fewer workers with `--max-workers 1`

3. **Coverage Issues**
   - Ensure all IPC handlers are tested
   - Check for uncovered error paths

4. **Performance Issues**
   - Run performance tests separately
   - Check system resources during testing

### Debug Environment

Set environment variables for debugging:

```bash
DEBUG=1 node tests/ipc/run-ipc-tests.js --verbose
NODE_ENV=test ELECTRON_ENABLE_LOGGING=true npm run test:ipc
```

## Contributing

### Adding New Tests

1. Choose the appropriate test file based on test category
2. Follow existing test patterns and naming conventions
3. Include proper error handling and cleanup
4. Add performance expectations where relevant
5. Update documentation as needed

### Test Guidelines

- Use descriptive test names that explain the scenario
- Include both positive and negative test cases
- Test edge cases and error conditions
- Mock external dependencies appropriately
- Ensure tests are deterministic and isolated

## Coordination with Claude Flow

The IPC tests coordinate with Claude Flow hooks for task management:

```bash
# Before starting tests
npx claude-flow@alpha hooks pre-task --description "implement-ipc-tests"

# Store progress
npx claude-flow@alpha hooks post-edit --memory-key "swarm/electron-testing/ipc"

# After completion
npx claude-flow@alpha hooks post-task --task-id "ipc-testing"
```

## Conclusion

This comprehensive IPC test suite ensures the reliability, security, and performance of all inter-process communication in the Mainframe KB Assistant. It provides the foundation for confident development and deployment of Electron-based features.

For questions or issues, refer to the troubleshooting section or check the generated test reports for detailed analysis.
