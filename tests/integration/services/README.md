# Service Integration Tests

This directory contains comprehensive integration tests for the core services of the Mainframe KB Assistant, focusing on real-world scenarios and service interactions.

## 📋 Test Files

### 1. `gemini-service.integration.test.ts`
**Purpose**: Integration testing for Google Gemini AI service
**Coverage**: 
- API communication with rate limiting and retry logic
- Fallback to local search on API failure  
- Response parsing and validation
- Semantic matching accuracy
- Performance under various loads
- Mock strategies for API responses

**Key Test Categories**:
- ✅ API Communication and Authentication
- ✅ Rate Limiting and Request Management  
- ✅ Response Parsing and Validation
- ✅ Semantic Matching Accuracy
- ✅ Fallback Mechanisms
- ✅ Error Explanation Feature
- ✅ Performance and Scalability
- ✅ Integration with Knowledge Base Categories
- ✅ Memory Management and Resource Cleanup

### 2. `pattern-detector.integration.test.ts`
**Purpose**: Integration testing for Pattern Detection service
**Coverage**:
- Temporal pattern detection algorithms
- Component failure pattern recognition
- Error code pattern clustering
- Real-time incident processing
- Alert generation and throttling
- Performance under high load scenarios

**Key Test Categories**:
- ✅ Temporal Pattern Detection
- ✅ Component Failure Pattern Recognition
- ✅ Error Code Pattern Clustering  
- ✅ Real-time Incident Processing
- ✅ Alert Generation and Throttling
- ✅ Performance and Scalability
- ✅ Pattern Analysis Quality and Accuracy

## 🚀 Running Tests

### Quick Start
```bash
# Run all service integration tests
npm run test:services

# Run with coverage report
npm run test:services:coverage

# Run with verbose output
npm run test:services:verbose
```

### Individual Test Suites
```bash
# Test only Gemini Service
npm run test:services:gemini

# Test only Pattern Detection
npm run test:services:patterns
```

### Advanced Options
```bash
# Run with custom timeout (180 seconds)
npx tsx tests/integration/services/run-service-integration-tests.ts -- --timeout 180

# Stop on first failure
npx tsx tests/integration/services/run-service-integration-tests.ts -- --bail

# All options combined
npm run test:services -- --coverage --verbose --bail --timeout 300
```

## 📊 Test Configuration

### Performance Thresholds
```typescript
const TEST_CONFIG = {
  // Gemini Service
  API_TIMEOUT: 5000,              // 5 second timeout
  RETRY_ATTEMPTS: 3,              // Retry failed requests
  RATE_LIMIT_WINDOW: 60000,       // 1 minute rate limit window
  MAX_REQUESTS_PER_MINUTE: 60,    // API rate limit
  PERFORMANCE_THRESHOLD: 2000,    // Max response time in ms
  
  // Pattern Detection
  PATTERN_DETECTION_TIMEOUT: 5000,     // 5 seconds max for pattern detection
  LARGE_INCIDENT_COUNT: 1000,          // For performance testing
  CONCURRENT_INCIDENTS: 100,           // Concurrent processing test
  PERFORMANCE_THRESHOLD: 3000,         // Max processing time for 1000 incidents
  PATTERN_CONFIDENCE_THRESHOLD: 70,    // Minimum pattern confidence
}
```

### Test Data Generation
Both test suites include sophisticated data generators:

**Gemini Service**:
- `TestDataGenerator.createKBEntry()` - Creates realistic KB entries
- `TestDataGenerator.createKBEntrySet()` - Creates large datasets for performance testing
- `MockAPIResponses.createSuccessResponse()` - Simulates API responses

**Pattern Detection**:
- `IncidentDataGenerator.createIncident()` - Creates individual incidents
- `IncidentDataGenerator.createTemporalIncidentCluster()` - Creates time-based patterns
- `IncidentDataGenerator.createComponentIncidentCluster()` - Creates component-specific patterns
- `IncidentDataGenerator.createErrorCodeIncidentCluster()` - Creates error-based patterns

## 🔧 Mock Strategies

### Gemini Service Mocking
The tests use sophisticated mocking strategies for the Gemini API:

```typescript
// Success response simulation
MockAPIResponses.createSuccessResponse(entries, query)

// Error response simulation  
MockAPIResponses.createErrorResponse(status, message)

// Rate limiting simulation
MockAPIResponses.createRateLimitResponse()

// Malformed response simulation
MockAPIResponses.createMalformedResponse()
```

### Pattern Detection Mocking
Uses `MockStorageAdapter` to simulate database operations without requiring actual SQLite:

```typescript
const mockAdapter = new MockStorageAdapter();
const patternDetector = new PatternDetectionPlugin(mockAdapter, testConfig);
```

## 📈 Performance Monitoring

Both test suites include comprehensive performance monitoring:

### Metrics Collected
- **Response Times**: API calls, database operations, pattern detection
- **Memory Usage**: Heap usage before/after operations
- **Throughput**: Operations per second under load
- **Accuracy**: Pattern detection confidence, semantic matching accuracy

### Performance Verification
```typescript
class PerformanceMonitor {
  startOperation(name: string): () => number;
  recordMetric(name: string, value: number): void;
  getStats(name: string): { avg, min, max, count };
}
```

## 🚨 Alert Testing

Pattern Detection tests include sophisticated alert monitoring:

```typescript
class AlertMonitor extends EventEmitter {
  getAlerts(): Alert[];
  getAlertCount(type?: string): number;
  // Includes throttling verification
}
```

**Alert Types Tested**:
- Critical pattern alerts
- Component failure alerts
- Escalation alerts
- Throttling behavior

## 🧪 Test Categories

### Unit-style Integration Tests
Focus on individual service behavior with external dependencies mocked.

### System Integration Tests  
Test service interactions with real-world data flows and timing.

### Performance Integration Tests
Validate service behavior under load with large datasets.

### Error Handling Integration Tests
Test resilience, fallback mechanisms, and graceful degradation.

## 📋 Coverage Expectations

### Gemini Service Coverage
- ✅ API communication patterns (100%)
- ✅ Fallback mechanisms (100%)
- ✅ Response parsing (100%)
- ✅ Error handling (100%)
- ✅ Performance scenarios (95%+)

### Pattern Detection Coverage
- ✅ Pattern detection algorithms (100%)
- ✅ Real-time processing (100%)
- ✅ Alert generation (100%)
- ✅ Database operations (95%+)
- ✅ Performance optimization (95%+)

## 🔍 Debugging Failed Tests

### Common Issues

1. **API Timeout Errors**
   ```bash
   # Increase timeout
   npm run test:services -- --timeout 300
   ```

2. **Memory Issues**
   ```bash
   # Run with garbage collection
   node --expose-gc tests/integration/services/run-service-integration-tests.ts
   ```

3. **Rate Limiting**
   ```bash
   # Run individual tests with delays
   npm run test:services:gemini
   sleep 60
   npm run test:services:patterns
   ```

### Debug Output
```bash
# Enable verbose logging
npm run test:services:verbose

# Check Jest debug output
DEBUG=jest* npm run test:services
```

## 🔮 Future Enhancements

### Planned Additions
- [ ] End-to-end service orchestration tests
- [ ] Load testing with realistic workloads  
- [ ] Integration with external systems (ServiceNow, Jira)
- [ ] Performance regression testing
- [ ] Chaos engineering scenarios

### Test Data Evolution
- [ ] Machine learning-generated test incidents
- [ ] Historical data replay scenarios
- [ ] Multi-tenant pattern simulation
- [ ] Geographic distribution testing

## 📚 Related Documentation

- [Service Architecture](../../../src/services/README.md)
- [Database Integration Tests](../database/README.md)
- [Performance Benchmarks](../../../docs/performance.md)
- [MVP Implementation Guide](../../../project-docs/complete/guia-implementacao-mvp-knowledge-first-v1.md)

## 🤝 Contributing

When adding new integration tests:

1. **Follow the existing patterns** for data generation and mocking
2. **Include performance monitoring** for all new test scenarios
3. **Add both success and failure paths** for comprehensive coverage
4. **Document any new test categories** in this README
5. **Ensure tests are deterministic** and don't rely on external services

### Test Naming Convention
```typescript
describe('Service Integration Tests', () => {
  describe('Feature Category', () => {
    it('should behavior under specific conditions', async () => {
      // Test implementation
    });
  });
});
```

---

*Last updated: September 2025*  
*Maintainer: Service Testing Specialist*