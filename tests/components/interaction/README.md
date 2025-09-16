# Component Interaction Test Suite

A comprehensive testing framework for validating component interactions, communication patterns, event handling, and cross-component data flow in React applications.

## Overview

This test suite provides extensive coverage for component interaction patterns, ensuring robust and reliable component communication across the application. It includes tests for:

- **Component Communication Patterns**: Parent-child communication, event propagation, context usage
- **Layout and Navigation**: Responsive behavior, routing, sidebar interactions
- **Form Integrations**: KB management, modal interactions, validation flows
- **State Management**: Context providers, custom hooks, cross-component synchronization
- **Composition Patterns**: HOCs, render props, compound components, polymorphic components
- **Performance Optimizations**: Memoization, virtualization, lazy loading
- **Modal and Overlay Systems**: Focus management, accessibility, stacking
- **Component Isolation**: Dependency injection, mocking, testing patterns

## Test Structure

### Core Framework

**ComponentInteractionTestSuite.ts**
- Base testing utilities and helper classes
- Mock creation and event logging
- Component interaction patterns
- Testing context and setup utilities

### Test Categories

#### 1. Core Component Patterns
- **EventPropagationStateManagement.test.tsx**: Event handling and state management
- **ComponentCompositionPatterns.test.tsx**: HOCs, render props, compound components
- **ComponentIsolationDependency.test.tsx**: Dependency injection and isolation patterns

#### 2. Integration Tests
- **SearchComponentInteraction.test.tsx**: Search interface communication
- **LayoutNavigationInteraction.test.tsx**: Layout and navigation patterns
- **KBManagerFormInteraction.test.tsx**: Knowledge base management workflows
- **ModalOverlayInteraction.test.tsx**: Modal systems and overlay behaviors

#### 3. Performance Tests
- **PerformanceOptimizationPatterns.test.tsx**: Memoization, virtualization, optimization

## Usage

### Running Individual Test Suites

```bash
# Run all component interaction tests
npm run test:components:interaction

# Run specific test categories
npm run test:components:interaction:core
npm run test:components:interaction:integration
npm run test:components:interaction:performance

# Run individual test files
npx jest tests/components/interaction/SearchComponentInteraction.test.tsx
npx jest tests/components/interaction/ModalOverlayInteraction.test.tsx
```

### Using the Test Runner

```typescript
import { ComponentInteractionTestRunner } from './ComponentInteractionTestRunner';

// Run all tests
const runner = new ComponentInteractionTestRunner({
  parallel: true,
  coverage: true,
  verbose: true
});

await runner.runTests();

// Run specific suites
await runner.runTests([
  'Search Component Interactions',
  'Modal Overlay Interactions'
]);

// Custom configuration
const runner = new ComponentInteractionTestRunner({
  parallel: false,
  failFast: true,
  outputFormat: 'html',
  outputFile: './test-report.html'
});
```

### Test Configuration Options

```typescript
interface TestRunnerConfig {
  parallel?: boolean;        // Run tests in parallel (default: true)
  maxWorkers?: number;       // Max parallel workers (default: 4)
  timeout?: number;          // Global timeout (default: 300000ms)
  coverage?: boolean;        // Generate coverage (default: true)
  watch?: boolean;           // Watch mode (default: false)
  verbose?: boolean;         // Verbose output (default: false)
  failFast?: boolean;        // Stop on first failure (default: false)
  suites?: string[];         // Specific suites to run
  outputFormat?: 'json' | 'html' | 'text'; // Report format
  outputFile?: string;       // Output file path
}
```

## Testing Patterns

### Component Communication Testing

```typescript
import { ComponentInteractionTester } from './ComponentInteractionTestSuite';

const tester = new ComponentInteractionTester();

test('parent-child communication', async () => {
  const onChildEvent = tester.createMock('onChildEvent');

  render(
    <Parent>
      <Child onEvent={onChildEvent} />
    </Parent>
  );

  await user.click(screen.getByTestId('child-button'));

  expect(onChildEvent).toHaveBeenCalledWith(expectedData);
});
```

### Event Propagation Testing

```typescript
test('event bubbling order', async () => {
  const onCapture = tester.createMock('onCapture');
  const onBubble = tester.createMock('onBubble');

  // Test event propagation order
  expect(onCapture).toHaveBeenCalledBefore(onBubble);
});
```

### Modal Interaction Testing

```typescript
test('modal focus management', async () => {
  render(<Modal isOpen={true} />);

  // Test focus trap
  await user.tab();
  expect(firstFocusableElement).toHaveFocus();

  // Test escape key
  await user.keyboard('{Escape}');
  expect(onClose).toHaveBeenCalled();
});
```

### Performance Pattern Testing

```typescript
test('memoization prevents re-renders', async () => {
  const onRender = jest.fn();

  const { rerender } = render(
    <MemoizedComponent data={data} onRender={onRender} />
  );

  // Same props - should not re-render
  rerender(<MemoizedComponent data={data} onRender={onRender} />);

  expect(onRender).toHaveBeenCalledTimes(1);
});
```

## Test Utilities

### ComponentInteractionTester

Core testing utility providing:
- Mock function creation and tracking
- Event logging and verification
- Component wrapper creation
- User interaction simulation
- State change assertions

### ComponentCommunicationTester

Specialized tester for communication patterns:
- Parent-child communication testing
- Event propagation verification
- Component composition validation

### ContextProviderTester

Context and provider pattern testing:
- Context value propagation
- Provider consumer interactions
- Context change handling

## Coverage Areas

### Component Interactions
- ✅ Parent-child communication
- ✅ Sibling component communication
- ✅ Context provider/consumer patterns
- ✅ Custom hook interactions
- ✅ Event bubbling and capturing

### State Management
- ✅ Local state updates
- ✅ Context state synchronization
- ✅ Cross-component state sharing
- ✅ State persistence patterns
- ✅ Optimistic updates

### Performance Patterns
- ✅ React.memo optimization
- ✅ useMemo and useCallback
- ✅ Virtual scrolling
- ✅ Lazy loading
- ✅ Code splitting

### Accessibility
- ✅ ARIA attribute management
- ✅ Focus management
- ✅ Keyboard navigation
- ✅ Screen reader support
- ✅ High contrast modes

### Error Handling
- ✅ Error boundary testing
- ✅ Async error handling
- ✅ Component recovery
- ✅ Error propagation
- ✅ Fallback UI testing

## Best Practices

### 1. Test Isolation
- Use dependency injection for external services
- Mock complex dependencies
- Test components in isolation where possible
- Avoid tight coupling between tests

### 2. Realistic Interactions
- Use userEvent for realistic user interactions
- Test complete user workflows
- Verify accessibility at each step
- Include timing and async behavior

### 3. Performance Awareness
- Test performance patterns explicitly
- Verify optimization strategies work
- Monitor render counts and timing
- Test with large datasets

### 4. Error Scenarios
- Test error boundaries and recovery
- Verify graceful degradation
- Test network failure scenarios
- Validate input sanitization

### 5. Accessibility Compliance
- Test keyboard navigation
- Verify ARIA attributes
- Test with screen reader simulation
- Validate focus management

## Troubleshooting

### Common Issues

**Test Timeouts**
```bash
# Increase timeout for slow tests
npx jest --testTimeout=60000 tests/components/interaction/
```

**Memory Leaks**
```typescript
// Always cleanup in afterEach
afterEach(() => {
  tester.resetMocks();
  jest.clearAllMocks();
});
```

**Async Race Conditions**
```typescript
// Use waitFor for async assertions
await waitFor(() => {
  expect(screen.getByTestId('result')).toBeInTheDocument();
});
```

**Portal Components**
```typescript
// Setup modal root for portal testing
beforeEach(() => {
  const modalRoot = document.createElement('div');
  modalRoot.id = 'modal-root';
  document.body.appendChild(modalRoot);
});
```

### Performance Tips

1. **Parallel Execution**: Enable parallel testing for faster runs
2. **Selective Testing**: Run only relevant test suites during development
3. **Coverage Threshold**: Set appropriate coverage thresholds
4. **Mock Heavy Dependencies**: Mock expensive operations and external services

## Continuous Integration

### Jest Configuration

```javascript
module.exports = {
  testMatch: [
    '**/tests/components/interaction/**/*.test.{ts,tsx}'
  ],
  setupFilesAfterEnv: [
    '<rootDir>/tests/components/interaction/setup.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};
```

### CI Pipeline

```yaml
- name: Run Component Interaction Tests
  run: |
    npm run test:components:interaction:ci

- name: Upload Coverage
  uses: codecov/codecov-action@v3
  with:
    file: ./coverage/lcov.info
```

## Contributing

When adding new component interaction tests:

1. **Follow Naming Conventions**: Use descriptive test names
2. **Document Test Purpose**: Include clear descriptions
3. **Add to Test Runner**: Update ComponentInteractionTestRunner.ts
4. **Maintain Coverage**: Ensure comprehensive test coverage
5. **Update Documentation**: Keep this README current

## Related Documentation

- [Testing Strategy](../../TESTING_STRATEGY.md)
- [Component Architecture](../../../COMPONENT_ARCHITECTURE_GUIDE.md)
- [Accessibility Testing](../../accessibility/README.md)
- [Performance Testing](../../performance/README.md)