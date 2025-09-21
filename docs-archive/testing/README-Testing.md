# Comprehensive Testing Architecture for Mainframe KB Assistant

This document describes the complete testing framework designed for the Mainframe Knowledge Base Assistant, supporting all MVP phases from basic Knowledge Base to Enterprise Intelligence Platform.

## 🏗️ Testing Architecture Overview

Our testing strategy implements multiple layers of testing to ensure comprehensive coverage:

### Testing Layers
- **Unit Tests**: Component/service isolation testing
- **Integration Tests**: Service interaction and data flow
- **Performance Tests**: Speed, memory, and scalability
- **Accessibility Tests**: WCAG 2.1 AA compliance automation
- **Visual Regression**: UI consistency across changes
- **E2E Tests**: Complete user workflows

### Technology Stack
- **Vitest**: Core testing framework with Jest compatibility
- **React Testing Library**: Component testing with user-centric approach
- **Playwright**: E2E testing and visual regression
- **Axe**: Automated accessibility testing
- **Custom Utilities**: Performance measurement and test data generation

## 🚀 Quick Start

### Prerequisites
```bash
npm install
npm run test:install-deps
```

### Running Tests

#### Unit Tests
```bash
# Run all unit tests
npm run test:unit

# Watch mode for development
npm run test:unit:watch

# Interactive UI
npm run test:unit:ui
```

#### Integration Tests
```bash
# Run integration tests
npm run test:integration

# Service layer integration
npm run test:services
```

#### Performance Tests
```bash
# Performance benchmarks
npm run test:performance

# Comprehensive performance analysis
npm run perf:benchmark
```

#### Accessibility Tests
```bash
# WCAG compliance testing
npm run a11y:test

# Full accessibility audit
npm run a11y:audit
```

#### Visual Regression Tests
```bash
# Run visual tests
npm run test:visual

# Update baselines
npm run test:visual:update

# Cross-browser visual testing
npm run test:cross-browser
```

#### End-to-End Tests
```bash
# Electron app E2E testing
npm run test:e2e

# Debug mode
npm run test:e2e:debug

# Mobile responsive testing
npm run test:mobile
```

#### Complete Test Suite
```bash
# Run all tests
npm run test:all

# CI pipeline
npm run test:ci

# With coverage
npm run test:coverage
```

## 📁 Test Structure

```
tests/
├── architecture/              # Testing documentation
│   └── TestingArchitecture.md
├── utils/                     # Common testing utilities
│   └── TestingUtilities.ts   # Helpers, mocks, assertions
├── unit/                      # Unit test patterns
│   └── ComponentTestPatterns.ts
├── integration/               # Integration test framework
│   └── IntegrationTestFramework.ts
├── performance/               # Performance testing
│   └── PerformanceTestFramework.ts
├── accessibility/             # Accessibility testing
│   └── AccessibilityTestFramework.ts
├── visual/                    # Visual regression testing
│   └── VisualRegressionTestFramework.ts
├── e2e/                      # End-to-end testing
│   └── E2ETestFramework.ts
├── examples/                  # Complete test examples
│   └── CompleteTestExamples.ts
├── setup.ts                  # Global test setup
└── TestConfiguration.ts     # Centralized configuration
```

## 🔧 Configuration

### Environment-Specific Configuration

The testing framework automatically adapts to different environments:

- **Development**: Full feature testing with visual baselines update
- **CI/CD**: Optimized for speed with essential tests
- **Testing**: Comprehensive coverage for local testing

### Environment Variables

```bash
# Coverage threshold (default: 70%)
COVERAGE_THRESHOLD=80

# E2E testing mode
E2E_HEADLESS=false
E2E_BASE_URL=http://localhost:3000

# Visual testing
VISUAL_UPDATE_BASELINES=true
VISUAL_THRESHOLD=0.2

# Performance limits
PERF_SEARCH_TIMEOUT=1000
PERF_MEMORY_LIMIT=200

# Database testing
TEST_DB_PATH=:memory:
```

## 🧪 Testing Patterns

### 1. Component Testing Pattern

```typescript
import { customRender, userEvent, screen } from '@tests/utils/TestingUtilities';

describe('SearchInterface Component', () => {
  it('performs search within performance threshold', async () => {
    customRender(<SearchInterface entries={mockEntries} />);

    await AssertionHelpers.assertPerformance(async () => {
      const searchInput = screen.getByRole('textbox');
      await userEvent.type(searchInput, 'VSAM');
      await screen.findByText(/results found/);
    }, 1000, 'Search operation');
  });
});
```

### 2. Integration Testing Pattern

```typescript
class SearchIntegrationTest extends BaseIntegrationTest {
  async testSearchWorkflow() {
    const results = await this.searchService.search('VSAM', this.testData, options);

    AssertionHelpers.assertSearchResults(results, 'VSAM');
    expect(results.length).toBeGreaterThan(0);
  }
}
```

### 3. Performance Testing Pattern

```typescript
class SearchPerformanceTest extends BasePerformanceTest {
  testSearchPerformance() {
    it('meets search response time requirements', async () => {
      const searchTimes: number[] = [];

      for (const query of testQueries) {
        const { time } = await this.measureOperation(
          () => this.searchService.search(query, this.testData),
          `Search: ${query}`
        );
        searchTimes.push(time);
      }

      const averageTime = searchTimes.reduce((sum, time) => sum + time) / searchTimes.length;
      expect(averageTime).toBeLessThan(1000);
    });
  }
}
```

### 4. Accessibility Testing Pattern

```typescript
class ComponentAccessibilityTest extends BaseAccessibilityTest {
  testAccessibility(component: React.ReactElement) {
    it('meets WCAG 2.1 AA requirements', async () => {
      const { container } = customRender(component);
      await this.runAxeTest(container, 'Component accessibility');
    });
  }
}
```

### 5. E2E Testing Pattern

```typescript
class SearchWorkflowE2ETest extends BaseE2ETest {
  async testCompleteWorkflow() {
    const searchPage = new SearchPageObject(this.page);

    await searchPage.search('VSAM Status 35');
    await searchPage.waitForResults();
    await searchPage.selectFirstResult();

    expect(await this.page.getByTestId('entry-title')).toBeVisible();
  }
}
```

## 📊 Performance Standards

### Response Time Requirements
- Search operations: < 1 second
- Database queries: < 500ms
- Component rendering: < 100ms
- E2E workflow completion: < 5 seconds

### Memory Usage Limits
- Unit tests: < 50MB per test
- Integration tests: < 100MB peak usage
- E2E tests: < 200MB application memory
- Performance tests: < 20MB growth over baseline

### Coverage Thresholds
- **Development**: 60% minimum
- **Testing**: 70% minimum
- **CI/CD**: 80% minimum

## ♿ Accessibility Standards

### WCAG 2.1 AA Compliance
- Color contrast ratio ≥ 4.5:1
- Keyboard navigation support
- Screen reader compatibility
- Focus management
- ARIA label completeness

### Testing Checklist
- [ ] All interactive elements are keyboard accessible
- [ ] Form fields have proper labels
- [ ] Error messages are announced
- [ ] Live regions update screen readers
- [ ] Focus order is logical
- [ ] Color contrast meets standards

## 👁️ Visual Testing

### Browser Support
- **Chromium** (primary)
- **Firefox** (cross-browser)
- **WebKit** (Safari compatibility)

### Viewport Testing
- Desktop: 1920x1080
- Laptop: 1366x768
- Tablet: 768x1024
- Mobile: 375x667

### Visual Standards
- Difference threshold: 0.2% (adjustable)
- Baseline management for consistent comparisons
- Theme variation testing (light/dark/high-contrast)

## 🔄 CI/CD Integration

### GitHub Actions Workflow

```yaml
name: Testing Pipeline
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run test:ci
      - uses: actions/upload-artifact@v3
        with:
          name: test-reports
          path: test-reports/
```

### Test Reports

The framework generates comprehensive reports:
- **HTML Coverage Reports**: Interactive coverage visualization
- **Performance Reports**: Benchmark results and trends
- **Accessibility Reports**: WCAG compliance status
- **Visual Diff Reports**: Screenshot comparisons
- **JUnit XML**: CI/CD integration format

## 🛠️ Development Workflow

### Test-Driven Development
1. Write failing test
2. Implement minimal code to pass
3. Refactor while keeping tests green
4. Add performance and accessibility tests

### Pre-commit Hooks
```bash
# Install pre-commit hooks
npm run prepare

# Hooks run automatically:
# - Lint checking
# - Type checking
# - Unit tests
# - Coverage validation
```

### Debugging Tests

```bash
# Debug unit tests
npm run test:unit:ui

# Debug E2E tests
npm run test:e2e:debug

# Performance profiling
npm run perf:profile
```

## 📈 Metrics and Monitoring

### Key Performance Indicators
- Test execution time trends
- Coverage percentage over time
- Performance regression detection
- Accessibility compliance score
- Visual regression frequency

### Continuous Monitoring
- Automated performance baselines
- Coverage trend analysis
- Accessibility regression detection
- Visual consistency tracking

## 🤝 Best Practices

### Test Organization
- **Arrange-Act-Assert** pattern
- **Page Object Model** for E2E tests
- **Factory Pattern** for test data
- **Builder Pattern** for complex scenarios

### Naming Conventions
- Test files: `*.test.ts` or `*.spec.ts`
- E2E tests: `*.e2e.ts`
- Visual tests: `*.visual.ts`
- Performance tests: `*.perf.ts`

### Mock Strategies
- **Service mocks** for external dependencies
- **Data mocks** for consistent testing
- **API mocks** with MSW for realistic scenarios
- **Electron API mocks** for desktop app testing

## 🚨 Troubleshooting

### Common Issues

#### Test Timeouts
```bash
# Increase timeout for slow tests
TEST_TIMEOUT=60000 npm run test:unit
```

#### Memory Issues
```bash
# Run tests with increased memory
node --max-old-space-size=4096 node_modules/.bin/vitest
```

#### E2E Test Failures
```bash
# Run with visual output
npm run test:e2e:headed

# Generate trace files
npm run test:e2e:debug
```

#### Visual Test Mismatches
```bash
# Update baselines after UI changes
npm run test:visual:update

# Compare differences
npm run visual:compare
```

## 📚 Additional Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Playwright Documentation](https://playwright.dev/)
- [Axe Accessibility Testing](https://www.deque.com/axe/)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)

## 🔄 Migration Guide

### From Jest to Vitest
The framework is designed with Jest compatibility. Most existing Jest tests should work with minimal changes:

```typescript
// Update imports
- import { describe, it, expect } from '@jest/globals';
+ import { describe, it, expect } from 'vitest';

// Mock syntax remains the same
vi.mock('./module'); // instead of jest.mock()
```

### Adding New Test Types
1. Create test framework in appropriate directory
2. Extend base test classes
3. Add configuration to `TestConfiguration.ts`
4. Update scripts in `package.json`
5. Document usage patterns

---

**Happy Testing! 🧪✨**

For questions or issues, please check the troubleshooting section or create an issue in the project repository.