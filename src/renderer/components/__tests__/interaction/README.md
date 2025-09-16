# Interaction Testing Suite

This directory contains comprehensive interaction testing for the Mainframe KB Assistant UI components, focusing on user workflows and realistic usage scenarios.

## Overview

The interaction testing suite provides:

- **User Flow Testing**: Complete workflows from user perspective
- **Component Integration**: Tests between multiple components
- **Error Handling**: Graceful error recovery scenarios
- **Accessibility**: Full keyboard navigation and screen reader support
- **Performance**: Response time and interaction benchmarks

## Test Structure

```
interaction/
├── setup.ts                           # Test environment setup
├── user-flow-helpers.ts               # Reusable user interaction helpers
├── SearchInterface.interaction.test.tsx    # Search workflow tests
├── KBEntryForm.interaction.test.tsx         # Form interaction tests
├── RatingSolution.interaction.test.tsx     # Rating workflow tests
├── ComponentIntegration.interaction.test.tsx # Cross-component integration
├── ErrorHandling.interaction.test.tsx      # Error scenarios
├── test-coverage-report.ts            # Coverage analysis
├── jest.config.interaction.js         # Jest configuration
├── jest.setup.js                      # Custom matchers and utilities
└── README.md                          # This file
```

## Test Categories

### 1. User Flow Tests

#### Search Workflow (`SearchInterface.interaction.test.tsx`)
- Basic search input and results display
- Advanced search with filters and sorting
- Search suggestions and history
- AI-enhanced vs local search
- Performance benchmarks (<1s response time)
- Accessibility compliance
- Error handling and fallback mechanisms

#### Form Interaction (`KBEntryForm.interaction.test.tsx`)
- Complete form filling workflow
- Field validation (real-time and on submit)
- Tag management with add/remove
- Advanced options and conditional fields
- Draft functionality and auto-save
- Keyboard shortcuts (Ctrl+S, Ctrl+Enter, Escape)
- Character counting and limits
- Error recovery and retry

#### Rating Solution (`RatingSolution.interaction.test.tsx`)
- Binary rating (helpful/not helpful)
- Optional feedback modal
- State management and persistence
- Rapid interaction handling
- Visual feedback and confirmation
- Accessibility for screen readers
- Network error handling

### 2. Integration Tests

#### Component Integration (`ComponentIntegration.interaction.test.tsx`)
- Search → Detail view workflow
- Add entry → Search → Rate workflow
- State synchronization between components
- Performance across component boundaries
- Error propagation and isolation
- Complex user interactions

### 3. Error Handling Tests

#### Error Scenarios (`ErrorHandling.interaction.test.tsx`)
- Network connectivity issues
- API service failures
- Form validation errors
- Timeout conditions
- Component render errors (Error Boundaries)
- Graceful degradation patterns
- User-friendly error messages
- Recovery mechanisms and retry logic

## Test Utilities

### User Flow Helpers

The `user-flow-helpers.ts` provides high-level user interaction classes:

```typescript
// Search workflow
const searchFlow = new SearchUserFlow({ user });
await searchFlow.performSearch({
  query: 'VSAM error',
  expectResults: 3,
  selectFirst: true
});

// Form workflow
const addFlow = new AddEntryUserFlow({ user });
await addFlow.fillEntryForm({
  title: 'Test Entry',
  problem: 'Problem description',
  solution: 'Solution steps',
  category: 'VSAM'
});

// Rating workflow
const ratingFlow = new RatingSolutionUserFlow({ user });
await ratingFlow.rateSolution({
  entryId: 'test-entry',
  rating: true,
  expectFeedback: true
});
```

### Performance Tracking

```typescript
const flow = new SearchUserFlow({ user, performanceTracking: true });
await flow.performSearch({ query: 'test' });

const measurements = UserFlowPerformance.getAllMeasurements();
console.log(`Search time: ${measurements['search-flow'].average}ms`);
```

### Custom Jest Matchers

```typescript
// Performance assertions
expect(responseTime).toHavePerformanceBenchmark(1000); // <1s

// Accessibility checks
expect(element).toBeAccessible();

// Form validation
expect(form).toHaveValidFormStructure();

// Range testing
expect(value).toBeWithinRange(0, 100);
```

## Running Tests

### Run All Interaction Tests
```bash
npm run test:interaction
```

### Run Specific Test Suite
```bash
npm run test:interaction -- SearchInterface.interaction.test.tsx
```

### Run with Coverage
```bash
npm run test:interaction -- --coverage
```

### Watch Mode
```bash
npm run test:interaction -- --watch
```

### Debug Mode
```bash
npm run test:interaction -- --detectOpenHandles --forceExit
```

## Coverage Requirements

The interaction tests target **90% coverage** of:

- User interaction scenarios
- Error handling paths
- Accessibility patterns
- Performance benchmarks
- Integration workflows

### Coverage Thresholds

```javascript
coverageThreshold: {
  global: {
    branches: 85,
    functions: 90,
    lines: 90,
    statements: 90
  }
}
```

## Test Data and Mocking

### Mock Data Generation

```typescript
import { MockDataGenerator } from '../test-utils';

const mockEntry = MockDataGenerator.kbEntry({
  title: 'Custom Test Entry',
  category: 'VSAM',
  tags: ['test', 'vsam', 'error']
});

const searchResults = MockDataGenerator.searchResults(5);
```

### Service Mocking

Tests mock external services to ensure:
- Predictable test behavior
- Fast execution
- Offline capability
- Error scenario simulation

```typescript
// Mock search service
jest.mock('../../../services/SearchService', () => ({
  SearchService: jest.fn().mockImplementation(() => ({
    search: jest.fn().mockResolvedValue(mockResults),
    suggest: jest.fn().mockResolvedValue(['suggestion1', 'suggestion2'])
  }))
}));
```

## Accessibility Testing

All interaction tests include accessibility validation:

### Keyboard Navigation
- Tab order verification
- Enter/Space activation
- Escape key handling
- Arrow key navigation

### Screen Reader Support
- ARIA labels and descriptions
- Live regions for dynamic content
- Proper heading structure
- Form field associations

### Focus Management
- Initial focus placement
- Modal focus trapping
- Focus restoration after actions
- Visible focus indicators

## Performance Benchmarks

### Response Time Requirements
- Search operations: <1 second
- Form submission: <2 seconds
- Component mounting: <500ms
- State updates: <100ms

### Performance Testing
```typescript
test('should meet search performance benchmark', async () => {
  const { user } = customRender(<SearchInterface />);
  const startTime = performance.now();

  await user.type(screen.getByRole('searchbox'), 'test query');

  await waitFor(() => {
    expect(screen.getAllByRole('article')).toHaveLength(3);
  });

  const endTime = performance.now();
  expect(endTime - startTime).toBeLessThan(1000);
});
```

## Error Scenario Testing

### Network Errors
```typescript
const restoreNetwork = errorSimulation.networkError();
// Perform action that should handle network failure
await user.click(submitButton);
expect(screen.getByRole('alert')).toHaveTextContent(/network error/i);
restoreNetwork();
```

### Validation Errors
```typescript
// Submit form with invalid data
await addFlow.testFormValidation({
  triggerValidation: true,
  expectErrors: ['Title is required', 'Problem too short']
});
```

### Timeout Scenarios
```typescript
const restoreNetwork = errorSimulation.slowResponse(5000);
// Test timeout handling
await user.type(searchInput, 'query');
await waitFor(() => {
  expect(screen.getByText(/timeout/i)).toBeInTheDocument();
}, { timeout: 6000 });
restoreNetwork();
```

## Best Practices

### Test Organization
1. **Group by user flow**, not by component methods
2. **Use descriptive test names** that explain user actions
3. **Test the happy path first**, then edge cases
4. **Include accessibility checks** in every test
5. **Verify performance benchmarks** for critical paths

### User Simulation
1. **Use realistic user actions** (typing, clicking, tabbing)
2. **Include delays and natural interaction patterns**
3. **Test keyboard and mouse interactions**
4. **Verify visual feedback** and state changes
5. **Test error recovery workflows**

### Assertions
1. **Assert on user-visible changes**, not internal state
2. **Use semantic queries** (byRole, byLabelText)
3. **Wait for asynchronous updates** with waitFor
4. **Test accessibility attributes** and behavior
5. **Verify performance within benchmarks**

## Troubleshooting

### Common Issues

#### Tests Timing Out
```typescript
// Increase timeout for complex interactions
jest.setTimeout(10000);

// Or use waitFor with custom timeout
await waitFor(() => {
  expect(element).toBeInTheDocument();
}, { timeout: 5000 });
```

#### Mock Not Working
```typescript
// Ensure mock is set up before component render
jest.mock('./service');
const { user } = customRender(<Component />); // Mock already active
```

#### Accessibility Errors
```typescript
// Debug accessibility issues
const a11yIssues = checkAccessibility(container);
console.log('A11y issues:', a11yIssues);
```

#### Performance Flakiness
```typescript
// Use consistent timing
jest.useFakeTimers();
// ... perform test
jest.runAllTimers();
jest.useRealTimers();
```

## Coverage Report

Generate a detailed coverage report:

```bash
npm run test:interaction -- --coverage
open coverage/interaction/lcov-report/index.html
```

View interaction-specific coverage analysis:

```typescript
import { coverageAnalyzer } from './test-coverage-report';

const report = await coverageAnalyzer.generateReport();
console.log(report);
```

## Contributing

When adding new interaction tests:

1. **Follow the established patterns** in existing test files
2. **Use the helper classes** for common user flows
3. **Include accessibility testing** for all interactive elements
4. **Add performance benchmarks** for time-sensitive operations
5. **Test error scenarios** and recovery paths
6. **Update the coverage report** if adding new components

### Test Naming Convention

```typescript
describe('ComponentName - User Interaction Tests', () => {
  describe('Primary User Flow', () => {
    test('should complete [specific user action] successfully', async () => {
      // Test implementation
    });
  });

  describe('Error Scenarios', () => {
    test('should handle [specific error condition] gracefully', async () => {
      // Error test implementation
    });
  });

  describe('Accessibility', () => {
    test('should support keyboard navigation for [specific flow]', async () => {
      // Accessibility test implementation
    });
  });
});
```

---

For more information about the testing strategy and implementation details, see the individual test files and the test coverage report.