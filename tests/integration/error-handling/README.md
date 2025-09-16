# Error Handling Integration Tests

This directory contains comprehensive integration tests that validate error handling and recovery mechanisms across all services in the Mainframe KB Assistant application.

## Overview

The error handling test suite provides thorough validation of:

- **Database Error Recovery**: Connection failures, corruption, locks, disk space issues
- **Network Error Handling**: Timeouts, retries, disconnections, rate limiting  
- **Resource Exhaustion**: Memory limits, CPU pressure, file handle exhaustion
- **Service Failure Cascades**: Isolation, graceful degradation, fault tolerance
- **Circuit Breaker Patterns**: State transitions, fast-fail, recovery mechanisms
- **Recovery Validation**: System resilience, performance impact, monitoring

## Test Files

### 1. `error-scenarios.integration.test.ts`
Main error handling scenarios across all services.

**Coverage:**
- Database connection and transaction failures
- AI service unavailability and fallback mechanisms  
- Resource exhaustion scenarios (memory, cache, file handles)
- Data consistency and concurrent modification handling
- Error logging and monitoring validation

**Runtime:** ~5-10 minutes

### 2. `recovery-testing.integration.test.ts`
Recovery mechanism validation and performance testing.

**Coverage:**
- Service crash and restart recovery
- Database corruption recovery using backups
- Transaction recovery after system crashes
- Network partition recovery and failover
- Memory exhaustion recovery and cleanup
- Multi-cycle resilience testing

**Runtime:** ~10-15 minutes  

### 3. `circuit-breaker.test.ts`
Circuit breaker pattern implementation and validation.

**Coverage:**
- State transitions (CLOSED → OPEN → HALF_OPEN → CLOSED)
- Failure threshold detection and management
- Fast-fail mechanisms during OPEN state
- Recovery timeout and success threshold handling
- Performance impact analysis
- Multiple circuit isolation and independence

**Runtime:** ~3-5 minutes

## Utilities

### `test-utils/error-injection-utils.ts`
Comprehensive utilities for error simulation and testing:

- **Database Setup**: `createTestDB()`, `cleanupTestDB()`
- **Error Injection**: `injectError()`, `simulateFailure()` 
- **Recovery Monitoring**: `RecoveryMonitor` class
- **Resource Monitoring**: `ResourceMonitor` class
- **Chaos Testing**: `ChaosEngine` class
- **Pattern Generation**: `ErrorPatternGenerator` class
- **Test Data**: `TestDataGenerators` utilities

## Running Tests

### Quick Start
```bash
# Run all error handling tests
npm run test:error-handling

# Run specific test suite
npm test -- --testNamePattern="error-scenarios"
npm test -- --testNamePattern="recovery-testing" 
npm test -- --testNamePattern="circuit-breaker"

# Run with verbose output
npm test tests/integration/error-handling/ -- --verbose
```

### Advanced Usage
```bash
# Run specific suite with detailed reporting
node tests/integration/error-handling/run-error-handling-tests.ts --suite=circuit-breaker --report=detailed

# Run with coverage analysis
node tests/integration/error-handling/run-error-handling-tests.ts --coverage

# Run sequentially for debugging
node tests/integration/error-handling/run-error-handling-tests.ts --sequential --verbose

# Set custom timeout (in milliseconds)
node tests/integration/error-handling/run-error-handling-tests.ts --timeout=600000
```

### Test Runner Options
- `--suite=<name>`: Run specific test suite only
- `--report=<type>`: Output format (summary|detailed|json)
- `--timeout=<ms>`: Per-suite timeout in milliseconds
- `--verbose`: Detailed output during test execution
- `--coverage`: Generate code coverage reports
- `--sequential`: Run suites sequentially instead of parallel
- `--max-workers=<n>`: Maximum parallel workers

## Configuration

### Environment Variables
```bash
export NODE_ENV=test
export LOG_LEVEL=warn           # debug|info|warn|error
export TEST_TIMEOUT=300000      # 5 minutes default
export MAX_MEMORY=512M          # Memory limit for testing
export TEST_DB_PATH=/tmp/test   # Custom test database location
```

### Test Configurations
The tests adapt to different environments:

**Development:**
- Short timeouts for fast feedback
- Limited resource constraints
- Detailed error logging

**CI/Production:**
- Extended timeouts for stability
- Realistic resource limits  
- Structured logging for analysis

## Error Scenarios Tested

### Database Errors
- **Connection Timeouts**: Pool exhaustion, lock contention
- **Corruption Recovery**: File corruption, partial corruption
- **Constraint Violations**: Foreign key, unique, check constraints
- **Transaction Failures**: Rollback scenarios, nested transactions
- **Disk Space Issues**: Full disk simulation, permission errors

### Network Errors
- **Service Unavailability**: AI service failures, timeout handling
- **Rate Limiting**: Exponential backoff, circuit breaking
- **Connection Issues**: Refused connections, DNS failures
- **Intermittent Failures**: Flaky service simulation

### Resource Exhaustion  
- **Memory Pressure**: Large payloads, memory leaks
- **Cache Overflow**: LRU eviction, cache consistency
- **File Handle Limits**: Descriptor exhaustion, cleanup
- **CPU Pressure**: Long-running operations, deadlocks

### Data Consistency
- **Concurrent Modifications**: Race conditions, optimistic locking
- **Orphaned Data**: Cleanup mechanisms, referential integrity
- **Checksum Validation**: Corruption detection, recovery

## Circuit Breaker Testing

### State Transitions
```
CLOSED (Normal) ──[Failures ≥ Threshold]──> OPEN (Failing)
   ↑                                            │
   │                                            │
   └──[Successes ≥ Threshold]──HALF_OPEN <──[Recovery Timeout]
                                   │
                                   └──[Any Failure]──> OPEN
```

### Validation Points
- **Failure Detection**: Threshold counting, time windows
- **Fast Fail**: Immediate rejection during OPEN state
- **Recovery Testing**: HALF_OPEN probe behavior
- **State Consistency**: Thread safety, race conditions  
- **Performance Impact**: Overhead measurement, throughput

## Metrics and Monitoring

### Test Metrics Collected
- **Test Execution**: Pass/fail rates, duration, coverage
- **Error Recovery**: Success rates, recovery times
- **Resource Usage**: Memory, CPU, file descriptors
- **Circuit Breaker**: State changes, activation frequency
- **Performance Impact**: Latency overhead, throughput degradation

### Report Formats

**Summary Report:**
```
📈 OVERALL RESULTS:
   Tests:        45 total
   Passed:       43 ✅  
   Failed:       2 ❌
   Success Rate: 95.6%
   Duration:     12,345ms
```

**Detailed Report:**
- Per-suite breakdown with error details
- Performance analysis and trends
- Resource usage patterns
- Recommendations for improvements

**JSON Report:**
Machine-readable format for CI/CD integration and automated analysis.

## Best Practices

### Test Design
- ✅ Test both expected and unexpected error scenarios
- ✅ Validate error propagation through all system layers
- ✅ Ensure graceful degradation under resource constraints  
- ✅ Test recovery mechanisms under various failure conditions
- ✅ Validate error logging and monitoring integration

### Error Recovery
- ✅ Implement exponential backoff for retry mechanisms
- ✅ Provide circuit breakers for external service dependencies
- ✅ Ensure database transactions can rollback cleanly
- ✅ Monitor and alert on error rate thresholds
- ✅ Maintain system functionality during partial failures

### Monitoring Integration
- ✅ Log all errors with sufficient context for debugging
- ✅ Track error rates and recovery times as key metrics
- ✅ Implement health checks for all critical services
- ✅ Provide dashboards for real-time error monitoring
- ✅ Set up automated alerts for critical error conditions

## Troubleshooting

### Common Issues

**Tests Timing Out:**
```bash
# Increase timeout for slow environments
node run-error-handling-tests.ts --timeout=900000  # 15 minutes
```

**Resource Exhaustion:**
```bash
# Run sequentially to reduce resource pressure
node run-error-handling-tests.ts --sequential --max-workers=1
```

**Database Lock Errors:**
```bash
# Ensure no other processes are using test database
lsof | grep test-database.db
killall node  # Kill any hanging processes
```

**Permission Errors:**
```bash
# Ensure test directory is writable
chmod 755 tests/temp/
rm -rf tests/temp/*  # Clean temporary files
```

### Debugging Failed Tests

1. **Run with verbose output:**
   ```bash
   npm test tests/integration/error-handling/ -- --verbose
   ```

2. **Check generated reports:**
   ```bash
   cat reports/error-handling-tests-*.json | jq '.results[] | select(.failed > 0)'
   ```

3. **Examine test logs:**
   ```bash
   tail -f tests/temp/test-*.log
   ```

4. **Validate environment setup:**
   ```bash
   node -e "console.log(process.memoryUsage()); console.log(process.version);"
   ```

## Contributing

When adding new error handling tests:

1. **Follow Naming Convention**: `<category>-<scenario>.test.ts`
2. **Use Test Utilities**: Leverage existing error injection utilities
3. **Document Scenarios**: Add clear descriptions and expected outcomes
4. **Update Metrics**: Include new test types in reporting
5. **Validate Recovery**: Ensure tests verify actual recovery, not just failure

### Test Template
```typescript
describe('New Error Scenario', () => {
  let testContext: TestContext;
  
  beforeEach(async () => {
    testContext = await setupTestContext();
  });

  afterEach(async () => {
    await cleanupTestContext(testContext);
  });

  it('should handle specific error gracefully', async () => {
    // Setup error scenario
    await injectError('specific-type');
    
    // Trigger operation that should fail
    let error: AppError | null = null;
    try {
      await performOperation();
    } catch (e) {
      error = e as AppError;
    }
    
    // Validate error handling
    expect(error).toBeDefined();
    expect(error!.code).toBe(ErrorCode.EXPECTED_ERROR);
    expect(error!.retryable).toBe(true);
    
    // Validate recovery
    await waitFor(error!.recoveryTime || 1000);
    const result = await performOperation();
    expect(result).toBeDefined();
  });
});
```

---

## License

This test suite is part of the Mainframe KB Assistant project and follows the same licensing terms.