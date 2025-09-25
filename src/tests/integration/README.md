# Integration Test Suite

Comprehensive integration tests for the Mainframe AI Assistant categorization
and tagging system.

## Overview

This test suite provides end-to-end validation of the complete categorization
and tagging system, including:

- **System Integration**: Cross-component workflows and data flow
- **Performance Benchmarking**: Autocomplete, virtual scrolling, and bulk
  operations
- **Accessibility Compliance**: WCAG 2.1 AA validation
- **Error Handling**: Network failures, database errors, and recovery scenarios
- **Memory Management**: Leak detection and resource cleanup

## Test Structure

```
src/tests/integration/
├── CategoryTagSystem.integration.test.tsx    # Core system integration
├── PerformanceBenchmark.integration.test.ts  # Performance validation
├── AccessibilityCompliance.integration.test.tsx # A11y compliance
├── TestRunner.integration.ts                 # Test orchestration
├── README.md                                 # This file
└── utils/
    ├── mockData.ts                           # Test data generators
    ├── testDatabase.ts                       # Database testing utilities
    ├── performanceHelpers.ts                 # Performance measurement tools
    └── mockServices.ts                       # Service mocking utilities
```

## Running Tests

### Full Integration Suite

```bash
# Run all integration tests with comprehensive reporting
npm run test:integration

# Run with coverage and performance monitoring
npm run test:integration -- --coverage --detectLeaks

# Run specific test suite
npm run test:integration -- --testNamePattern="Category-Tag System Integration"
```

### Individual Test Categories

```bash
# Performance benchmarks only
npm run test:integration -- --testPathPattern="PerformanceBenchmark"

# Accessibility tests only
npm run test:integration -- --testPathPattern="AccessibilityCompliance"

# Core integration tests only
npm run test:integration -- --testPathPattern="CategoryTagSystem"
```

### Development Mode

```bash
# Watch mode for active development
npm run test:integration -- --watch

# Debug mode with verbose output
npm run test:integration -- --verbose --no-cache
```

## Test Categories

### 1. Core System Integration

**File**: `CategoryTagSystem.integration.test.tsx`

Tests complete workflows across all major components:

- **Entry Management**: Full CRUD operations with tags and categories
- **Category Tree Operations**: Drag-and-drop, hierarchical management
- **Tag Input Features**: Autocomplete, validation, bulk operations
- **Cross-Component Integration**: Data synchronization and state management
- **Error Handling**: Graceful degradation and recovery
- **Bulk Operations**: Multi-select operations with rollback support

**Key Test Scenarios**:

- Complete entry creation with categories and tags
- Category-tag relationship validation
- Bulk tag operations with conflict resolution
- Cross-component state synchronization
- Database error recovery

### 2. Performance Benchmarking

**File**: `PerformanceBenchmark.integration.test.ts`

Validates performance across different scenarios:

- **Autocomplete Performance**: Large tag datasets (500+ tags)
- **Virtual Scrolling**: Category trees (200+ categories)
- **Bulk Operations**: Processing 100+ entries
- **Memory Management**: Leak detection and cleanup
- **Concurrent Operations**: Multi-user simulation

**Performance Thresholds**:

- Tag autocomplete: < 200ms average
- Category tree render: < 150ms
- Bulk operations: < 2s for 500 entries
- Memory growth: < 10MB over test run
- Operations/second: > 5 for interactive operations

### 3. Accessibility Compliance

**File**: `AccessibilityCompliance.integration.test.tsx`

Ensures WCAG 2.1 AA compliance across all components:

- **ARIA Support**: Proper labels, descriptions, and live regions
- **Keyboard Navigation**: Full keyboard accessibility
- **Screen Reader Support**: Meaningful announcements
- **Color and Contrast**: Sufficient contrast ratios
- **Focus Management**: Proper focus indicators and movement
- **Responsive Design**: Accessibility across viewport sizes

**Compliance Areas**:

- Zero axe-core violations
- Complete keyboard navigation
- Screen reader announcements
- High contrast mode support
- Focus management during modals
- Meaningful error messages

## Test Data Generation

The test suite includes sophisticated mock data generators:

### Mock Data Types

```typescript
// Realistic KB entries with category relationships
const entries = createRealisticKBEntry('VSAM', [
  'file-access',
  'troubleshooting',
]);

// Large datasets for performance testing
const largeDataset = createLargeDataset({
  entryCount: 1000,
  tagCount: 500,
  categoryCount: 50,
  maxTagsPerEntry: 8,
});

// Category hierarchies with proper relationships
const categories = buildCategoryHierarchy(mockCategories);
```

### Performance Test Data

```typescript
// Configurable large dataset generation
const performanceData = createPerformanceTestData();

// Stress testing with concurrent operations
const stressTest = new StressTest();
const result = await stressTest.run({
  maxConcurrency: 5,
  duration: 2000,
  operations: [...]
});
```

## Performance Monitoring

### Built-in Metrics

- **Response Times**: Average, min, max, percentiles
- **Memory Usage**: Heap size, peak usage, leak detection
- **Operations/Second**: Throughput measurements
- **Resource Cleanup**: Proper unmounting and cleanup

### Custom Performance Helpers

```typescript
// Benchmark operations
const benchmark = new Benchmark();
const result = await benchmark.run(
  'operation-name',
  async () => {
    // Your operation here
  },
  {
    iterations: 20,
    memoryProfiling: true,
  }
);

// Performance validation
const validator = new PerformanceValidator();
const validation = validator.validateBenchmark(result, {
  maxDuration: 200,
  maxMemoryLeak: 5 * 1024 * 1024,
});
```

## Accessibility Testing

### Axe Integration

```typescript
// Comprehensive accessibility testing
import { axe, toHaveNoViolations } from 'jest-axe';

test('should have no accessibility violations', async () => {
  const { container } = render(<YourComponent />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

### Keyboard Navigation Testing

```typescript
// Test complete keyboard workflows
const user = userEvent.setup();
await user.tab(); // Navigate with tab
await user.keyboard('{ArrowDown}'); // Use arrow keys
await user.keyboard('{Enter}'); // Activate controls
```

### Screen Reader Testing

```typescript
// Verify announcements
await waitFor(() => {
  const announcement = screen.getByRole('status', { hidden: true });
  expect(announcement).toHaveTextContent(/expected message/i);
});
```

## Error Scenarios

### Network Failures

```typescript
// Test API failure handling
const mockFailingService = {
  searchTags: jest.fn().mockRejectedValue(new Error('API Error')),
};

// Should gracefully degrade
expect(screen.getByText(/suggestions unavailable/i)).toBeInTheDocument();
```

### Database Errors

```typescript
// Test database recovery
const mockOnExecute = jest
  .fn()
  .mockRejectedValue(new Error('Database connection failed'));

// Should show error and retry option
await waitFor(() => {
  expect(screen.getByText(/operation failed/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
});
```

## Test Reports

### Generated Reports

The test suite generates comprehensive reports in the `test-reports/` directory:

- **integration-report.html**: Visual HTML report with metrics
- **integration-report.json**: Detailed JSON data for CI/CD
- **junit-integration.xml**: JUnit format for CI integration
- **performance-report.json**: Performance-specific metrics
- **accessibility-report.json**: Accessibility compliance data

### Report Contents

- **Test Results**: Pass/fail status, duration, coverage
- **Performance Metrics**: Response times, memory usage, throughput
- **Accessibility Results**: Violations, compliance level, categories
- **Error Analysis**: Failure categorization and recommendations
- **Trends**: Performance trends over time (in CI)

## Best Practices

### Writing Integration Tests

1. **Test Real Workflows**: Focus on user journeys, not isolated units
2. **Use Realistic Data**: Generate data that mirrors production scenarios
3. **Performance Aware**: Include performance assertions in functional tests
4. **Accessibility First**: Test accessibility alongside functionality
5. **Error Scenarios**: Test failure modes and recovery paths

### Performance Testing

1. **Set Realistic Thresholds**: Based on actual user requirements
2. **Test at Scale**: Use large datasets to expose performance issues
3. **Monitor Memory**: Include memory leak detection
4. **Measure Consistently**: Use same environment for comparable results
5. **Profile Bottlenecks**: Identify and document performance hotspots

### Accessibility Testing

1. **Automated + Manual**: Use axe-core plus keyboard/screen reader testing
2. **Real User Scenarios**: Test actual workflows with accessibility tools
3. **Multiple Contexts**: Test across different browsers and assistive
   technologies
4. **Performance Impact**: Ensure accessibility features don't degrade
   performance
5. **Documentation**: Document accessibility features and testing approaches

## Troubleshooting

### Common Issues

**Test Timeouts**:

```bash
# Increase timeout for slow operations
npm run test:integration -- --testTimeout=600000
```

**Memory Issues**:

```bash
# Enable garbage collection and increase memory
node --expose-gc --max-old-space-size=4096 ./node_modules/.bin/jest --config=jest.config.integration.js
```

**Accessibility Violations**:

```bash
# Run with detailed axe output
npm run test:integration -- --verbose
```

### Debug Mode

```bash
# Enable debug logging
DEBUG=integration-tests npm run test:integration

# Enable performance profiling
ENABLE_PERFORMANCE_MONITORING=true npm run test:integration

# Enable memory profiling
ENABLE_MEMORY_PROFILING=true npm run test:integration
```

## CI/CD Integration

### GitHub Actions Example

```yaml
- name: Run Integration Tests
  run: |
    npm run test:integration -- --coverage --ci

- name: Upload Test Reports
  uses: actions/upload-artifact@v3
  with:
    name: integration-test-reports
    path: test-reports/
```

### Test Metrics Collection

The integration tests output metrics suitable for tracking:

- **Performance Trends**: Track response times over time
- **Coverage Trends**: Monitor test coverage changes
- **Accessibility Compliance**: Track violation counts
- **Flaky Test Detection**: Identify unstable tests

## Contributing

### Adding New Tests

1. **Choose Appropriate Suite**: Add to existing or create new test file
2. **Follow Naming**: Use descriptive test names with clear intent
3. **Include Performance**: Add performance assertions where relevant
4. **Test Accessibility**: Include accessibility verification
5. **Update Documentation**: Document new test scenarios

### Performance Baselines

When adding performance tests:

1. **Establish Baseline**: Run tests multiple times to establish baseline
2. **Set Realistic Thresholds**: Based on actual user requirements
3. **Document Rationale**: Explain why specific thresholds were chosen
4. **Monitor Trends**: Track performance over time in CI

### Test Data

When adding test data:

1. **Realistic Scenarios**: Mirror production data patterns
2. **Sufficient Scale**: Test with appropriately sized datasets
3. **Edge Cases**: Include boundary conditions
4. **Clean Data**: Ensure test data doesn't affect other tests

## References

- [Testing Library Documentation](https://testing-library.com/)
- [Jest Configuration](https://jestjs.io/docs/configuration)
- [Axe Accessibility Testing](https://github.com/dequelabs/axe-core)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/Understanding/)
- [Performance Testing Best Practices](https://web.dev/performance/)
