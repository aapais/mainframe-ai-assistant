# Component Library Testing Strategy

This document outlines the comprehensive testing strategy implemented for the Mainframe Knowledge Base Assistant component library. The testing framework ensures high quality, accessibility, performance, and reliability across all components.

## Table of Contents

1. [Testing Philosophy](#testing-philosophy)
2. [Testing Pyramid](#testing-pyramid)
3. [Test Types](#test-types)
4. [Tools and Frameworks](#tools-and-frameworks)
5. [Test Structure](#test-structure)
6. [Running Tests](#running-tests)
7. [CI/CD Integration](#cicd-integration)
8. [Reporting](#reporting)
9. [Best Practices](#best-practices)

## Testing Philosophy

Our testing approach follows the **Quality Engineering** mindset:

- **Shift-Left Testing**: Catch issues early in development
- **Risk-Based Testing**: Focus on critical user journeys and business logic
- **Accessibility-First**: Ensure WCAG 2.1 AA compliance from day one
- **Performance-Conscious**: Validate performance requirements continuously
- **User-Centric**: Test from the user's perspective

## Testing Pyramid

```
                    ┌─────────────────┐
                    │   Visual &     │  ←  Visual regression, Cross-browser
                    │   E2E Tests    │     Manual exploratory testing
                    └─────────────────┘
                  ┌───────────────────────┐
                  │  Integration Tests   │  ←  Component integration
                  │  API Tests          │     Service layer testing  
                  └───────────────────────┘
            ┌─────────────────────────────────────┐
            │           Unit Tests               │  ←  Component logic
            │        Component Tests            │     Hooks, utilities
            │      Accessibility Tests          │     WCAG compliance
            │       Performance Tests           │     Render performance
            └─────────────────────────────────────┘
```

### Test Distribution
- **70%** Unit & Component Tests
- **20%** Integration Tests  
- **10%** E2E & Visual Tests

## Test Types

### 1. Unit Tests
**Purpose**: Test individual components in isolation
**Location**: `src/renderer/components/**/__tests__/*.test.tsx`

- Component rendering
- Props validation
- Event handling
- State management
- Error boundaries

### 2. Accessibility Tests
**Purpose**: Ensure WCAG 2.1 AA compliance
**Tools**: jest-axe, manual testing checklist

- Automated axe-core scanning
- Keyboard navigation testing
- Screen reader compatibility
- Color contrast validation
- Focus management

### 3. Performance Tests
**Purpose**: Validate rendering and interaction performance
**Benchmarks**:
- Component render time < 100ms
- User interaction response < 50ms
- Memory usage < 50MB increase per component

### 4. Visual Regression Tests
**Purpose**: Catch unintended visual changes
**Approach**:
- Component snapshot testing
- Responsive design validation
- Theme consistency checking
- Cross-browser visual parity

### 5. Integration Tests
**Purpose**: Test component interactions and workflows
**Scope**:
- Form submission flows
- Search and filter operations
- Modal and dialog interactions
- Error handling flows

### 6. Cross-Browser Tests
**Purpose**: Ensure compatibility across browsers
**Browsers**: Chrome, Firefox, Edge, Safari
**Testing**: Layout, JavaScript execution, API compatibility

## Tools and Frameworks

### Core Testing Framework
- **Jest**: Test runner and assertion library
- **React Testing Library**: Component testing utilities
- **jsdom**: DOM environment for testing

### Specialized Tools
- **jest-axe**: Accessibility testing
- **@testing-library/user-event**: User interaction simulation
- **Performance API**: Render performance measurement
- **Custom utilities**: Visual testing, form testing helpers

### Development Tools
- **ESLint**: Code quality and testing best practices
- **Prettier**: Consistent code formatting
- **TypeScript**: Type safety in tests

## Test Structure

### File Organization
```
src/renderer/components/
├── __tests__/
│   ├── setup.ts                 # Global test setup
│   ├── test-utils.ts           # Testing utilities
│   ├── Accessibility.test.tsx   # Accessibility tests
│   ├── Performance.test.tsx     # Performance tests
│   └── VisualRegression.test.tsx # Visual tests
├── common/
│   ├── __tests__/
│   │   └── Button.test.tsx      # Component-specific tests
│   └── Button.tsx
├── forms/
│   ├── __tests__/
│   │   ├── KBEntryForm.test.tsx
│   │   └── FormField.test.tsx
│   └── KBEntryForm.tsx
└── search/
    ├── __tests__/
    │   └── SearchInterface.test.tsx
    └── SearchInterface.tsx
```

### Test Naming Convention
- `ComponentName.test.tsx` - Main component tests
- `ComponentName.accessibility.test.tsx` - Accessibility-specific tests
- `ComponentName.performance.test.tsx` - Performance-specific tests
- `integration/*.test.tsx` - Integration tests

## Running Tests

### Basic Commands
```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test types
npm run test:unit
npm run test:accessibility
npm run test:performance
npm run test:visual

# Run tests in watch mode
npm run test:watch

# Update visual snapshots
npm run test:visual -- --updateSnapshots
```

### Advanced Commands
```bash
# Run comprehensive test suite
node scripts/test-runner.js --all

# Run specific test suite with options
node scripts/test-runner.js --accessibility --verbose

# Generate detailed reports
node scripts/test-runner.js --all --coverage --verbose
```

### Test Filtering
```bash
# Run tests for specific component
npm test Button

# Run tests matching pattern
npm test --testNamePattern="accessibility"

# Run tests in specific directory
npm test src/renderer/components/forms
```

## CI/CD Integration

### GitHub Actions Workflow
The testing pipeline runs on:
- **Push to main/develop**: Full test suite
- **Pull requests**: Full test suite + visual regression
- **Nightly**: Extended performance and stress tests

### Pipeline Stages
1. **Lint & Type Check**: Code quality validation
2. **Unit Tests**: Core functionality testing
3. **Accessibility Tests**: WCAG compliance verification
4. **Performance Tests**: Performance regression detection
5. **Visual Tests**: UI consistency validation
6. **Cross-Browser Tests**: Browser compatibility
7. **Integration Tests**: End-to-end workflows
8. **Security Tests**: Dependency and code security

### Quality Gates
- **Code Coverage**: Minimum 80% overall, 85% for forms
- **Accessibility**: Zero critical violations
- **Performance**: No regressions > 20%
- **Visual**: All snapshots must match

## Reporting

### Coverage Reports
- **Text Summary**: Console output during CI
- **HTML Report**: Detailed coverage visualization
- **LCOV Report**: Integration with coverage tools

### Accessibility Reports
- **Violation Summary**: Critical, serious, moderate, minor issues
- **Component Compliance**: Per-component WCAG status
- **Remediation Guide**: Specific fix recommendations

### Performance Reports
- **Benchmark Results**: Render times, interaction latency
- **Memory Usage**: Heap size tracking
- **Trend Analysis**: Performance over time

### Visual Reports
- **Snapshot Comparison**: Before/after visual diffs
- **Cross-Browser Consistency**: Visual parity across browsers
- **Responsive Validation**: Layout behavior at breakpoints

## Best Practices

### Test Writing Guidelines

#### 1. Test Structure (AAA Pattern)
```tsx
describe('Component', () => {
  it('should handle user interaction correctly', async () => {
    // Arrange
    const mockHandler = jest.fn();
    const user = userEvent.setup();
    
    // Act
    render(<Component onClick={mockHandler} />);
    await user.click(screen.getByRole('button'));
    
    // Assert
    expect(mockHandler).toHaveBeenCalledTimes(1);
  });
});
```

#### 2. Accessibility Testing
```tsx
it('should be accessible', async () => {
  const { container } = render(<Component />);
  
  // Automated accessibility testing
  const results = await axe(container);
  expect(results).toHaveNoViolations();
  
  // Manual accessibility checks
  const keyboardTest = await AccessibilityTester.testKeyboardNavigation(container);
  expect(keyboardTest.canFocusAll).toBe(true);
});
```

#### 3. Performance Testing
```tsx
it('should render efficiently', () => {
  const performanceTester = new PerformanceTester();
  const endMeasurement = performanceTester.startMeasurement('render');
  
  render(<Component />);
  
  const renderTime = endMeasurement();
  expect(renderTime).toBeLessThan(100); // 100ms threshold
});
```

#### 4. Mock Strategy
- Mock external dependencies, not internal logic
- Use `jest.fn()` for function mocks
- Mock at the module boundary
- Provide realistic mock data

#### 5. Error Testing
```tsx
it('should handle errors gracefully', () => {
  // Suppress console.error for this test
  const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  
  expect(() => {
    render(<ComponentWithError />);
  }).not.toThrow();
  
  consoleSpy.mockRestore();
});
```

### Performance Optimization
- Use `screen.getByRole()` over `querySelector()`
- Batch DOM updates in tests
- Clean up timers and event listeners
- Use `waitFor()` for async operations

### Maintenance
- Regular test review and cleanup
- Update snapshots when UI changes intentionally
- Monitor test execution time
- Remove obsolete tests

## Troubleshooting

### Common Issues

#### 1. Failing Accessibility Tests
```bash
# Run accessibility tests with verbose output
npm run test:accessibility -- --verbose

# Check specific component
npm test -- --testNamePattern="Button.*accessibility"
```

#### 2. Performance Regressions
```bash
# Run performance tests in isolation
npm run test:performance -- --runInBand

# Check memory usage
npm test -- --logHeapUsage
```

#### 3. Visual Regression Failures
```bash
# Update snapshots after intentional changes
npm run test:visual -- --updateSnapshots

# Compare specific snapshots
npm test -- --testNamePattern="visual.*Button"
```

#### 4. Flaky Tests
- Use `waitFor()` for async operations
- Mock timers with `jest.useFakeTimers()`
- Ensure proper cleanup in `afterEach()`

### Debug Mode
```bash
# Run tests with Node debugging
node --inspect-brk node_modules/.bin/jest --runInBand

# Use Chrome DevTools for debugging
# Navigate to chrome://inspect
```

## Contributing to Tests

### Adding New Components
1. Create component test file following naming convention
2. Include accessibility tests using `jest-axe`
3. Add performance benchmarks
4. Create visual snapshots
5. Update integration tests if needed

### Test Review Checklist
- [ ] Tests cover all user interactions
- [ ] Accessibility compliance verified
- [ ] Performance thresholds met
- [ ] Error cases handled
- [ ] Mock data is realistic
- [ ] Tests are maintainable and readable

---

## Conclusion

This comprehensive testing strategy ensures our component library maintains high standards for:
- **Functionality**: Components work as intended
- **Accessibility**: Inclusive design for all users
- **Performance**: Fast, responsive user experience
- **Visual Consistency**: Polished, professional interface
- **Cross-Browser Compatibility**: Works everywhere

The automated testing pipeline provides confidence in deployments while the detailed reporting helps maintain and improve code quality over time.