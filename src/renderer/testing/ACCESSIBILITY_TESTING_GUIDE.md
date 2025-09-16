# Accessibility Testing Framework Guide

## Overview

This comprehensive accessibility testing framework provides tools and utilities to ensure our Mainframe AI Assistant meets WCAG 2.1 AA standards. The framework includes automated testing, custom matchers, screen reader simulation, and keyboard navigation testing.

## Quick Start

### 1. Setup

Import the testing framework in your test files:

```typescript
import {
  runAccessibilityTests,
  testKeyboardNavigation,
  testScreenReaderAnnouncements,
  validateColorContrast,
  accessibilityScenarios
} from '../testing/accessibility';
import { AriaLiveProvider } from '../components/AriaLiveRegions';
```

### 2. Basic Component Testing

```typescript
test('component should be accessible', async () => {
  await runAccessibilityTests(<MyComponent />);
});
```

### 3. Custom Testing with Options

```typescript
test('complex component accessibility', async () => {
  await runAccessibilityTests(<ComplexComponent />, {
    skipAxe: false,
    skipKeyboard: false,
    skipScreenReader: false,
    customTests: [
      async (container) => {
        // Your custom accessibility tests
        const headings = container.querySelectorAll('h1, h2, h3');
        expect(headings.length).toBeGreaterThan(0);
      }
    ]
  });
});
```

## Testing Framework Components

### 1. Custom Jest Matchers

#### `toBeAccessible()`
Tests element against WCAG 2.1 AA standards using axe-core.

```typescript
test('button accessibility', async () => {
  const { container } = render(<button>Click me</button>);
  await expect(container).toBeAccessible();
});
```

#### `toSupportKeyboardNavigation()`
Validates keyboard accessibility patterns.

```typescript
test('keyboard navigation', () => {
  const { container } = render(<NavigationMenu />);
  expect(container).toSupportKeyboardNavigation();
});
```

#### `toHaveValidAriaAttributes()`
Validates ARIA attribute usage.

```typescript
test('ARIA attributes', () => {
  const { container } = render(
    <button aria-expanded="true" aria-controls="menu">
      Menu
    </button>
  );
  expect(container).toHaveValidAriaAttributes();
});
```

### 2. Keyboard Navigation Testing

```typescript
import { testKeyboardNavigation } from '../testing/accessibility';

test('tab navigation order', async () => {
  const { container } = render(<FormComponent />);

  await testKeyboardNavigation(container, [
    '[data-testid="first-input"]',
    '[data-testid="second-input"]',
    '[data-testid="submit-button"]'
  ]);
});
```

### 3. Screen Reader Testing

```typescript
import { testScreenReaderAnnouncements } from '../testing/accessibility';

test('success message announcement', async () => {
  render(
    <AriaLiveProvider>
      <FormComponent />
    </AriaLiveProvider>
  );

  await testScreenReaderAnnouncements(
    async () => {
      // Action that should trigger announcement
      fireEvent.click(screen.getByText('Submit'));
    },
    'Form submitted successfully'
  );
});
```

### 4. Focus Management Testing

```typescript
import { testFocusManagement } from '../testing/accessibility';

test('modal focus management', async () => {
  const openButton = screen.getByText('Open Modal');
  openButton.focus();

  await testFocusManagement(
    async () => {
      fireEvent.click(openButton);
    },
    {
      expectedInitialFocus: '[role="dialog"]',
      trapFocus: true,
      returnFocus: true,
      originalActiveElement: openButton
    }
  );
});
```

### 5. Color Contrast Validation

```typescript
import { validateColorContrast } from '../testing/accessibility';

test('color contrast compliance', () => {
  const result = validateColorContrast('#000000', '#ffffff');

  expect(result.passes).toBe(true);
  expect(result.level).toBe('AAA');
  expect(result.ratio).toBeGreaterThan(7);
});
```

## ARIA Live Regions

### Setup

Wrap your application with the `AriaLiveProvider`:

```typescript
import { AriaLiveProvider } from '../components/AriaLiveRegions';

function App() {
  return (
    <AriaLiveProvider>
      <YourAppContent />
    </AriaLiveProvider>
  );
}
```

### Usage in Components

```typescript
import { useAriaLive } from '../hooks/useAriaLive';

function MyComponent() {
  const { announce, announceError, announceSuccess } = useAriaLive();

  const handleSubmit = async () => {
    try {
      await submitForm();
      announceSuccess('Form submitted successfully');
    } catch (error) {
      announceError('Form submission failed');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* form content */}
    </form>
  );
}
```

### Announcement Options

```typescript
const { announce } = useAriaLive();

// Basic announcement
announce('Operation completed');

// With options
announce('Critical error occurred', {
  politeness: 'assertive',
  priority: 'high',
  clearPrevious: true,
  interrupt: true
});
```

## Testing Scenarios

### 1. Form Accessibility

```typescript
import { accessibilityScenarios } from '../testing/accessibility';

test('form accessibility', async () => {
  const { container } = render(<ContactForm />);
  const form = container.querySelector('form')!;

  await accessibilityScenarios.testFormAccessibility(form);
});
```

### 2. Button Accessibility

```typescript
test('button accessibility', () => {
  const { container } = render(<ButtonGroup />);
  const buttons = container.querySelectorAll('button');

  buttons.forEach(button => {
    accessibilityScenarios.testButtonAccessibility(button);
  });
});
```

### 3. Modal Accessibility

```typescript
test('modal accessibility', async () => {
  const { container } = render(<Modal isOpen={true} />);
  const modal = container.querySelector('[role="dialog"]')!;

  await accessibilityScenarios.testModalAccessibility(modal);
});
```

## Best Practices

### 1. Always Test with Live Regions

When testing components that provide user feedback, always wrap them with `AriaLiveProvider`:

```typescript
test('feedback component', async () => {
  render(
    <AriaLiveProvider>
      <FeedbackComponent />
    </AriaLiveProvider>
  );

  // Test announcements
  await testScreenReaderAnnouncements(
    () => triggerFeedback(),
    'Expected announcement text'
  );
});
```

### 2. Test Keyboard Navigation Patterns

Always test keyboard navigation for interactive components:

```typescript
test('dropdown keyboard navigation', async () => {
  const { container } = render(<Dropdown />);

  // Test expected focus order
  await testKeyboardNavigation(container);

  // Test specific keyboard interactions
  const user = userEvent.setup();
  const trigger = screen.getByRole('button');

  await user.click(trigger);
  await user.keyboard('{ArrowDown}');

  expect(screen.getByRole('option')).toHaveFocus();
});
```

### 3. Validate ARIA Usage

Check that ARIA attributes are used correctly:

```typescript
test('ARIA attributes are valid', () => {
  const { container } = render(<ComplexWidget />);
  expect(container).toHaveValidAriaAttributes();
});
```

### 4. Test Error States

Ensure error states are announced properly:

```typescript
test('error state announcements', async () => {
  render(
    <AriaLiveProvider>
      <FormWithValidation />
    </AriaLiveProvider>
  );

  // Trigger validation error
  const submitButton = screen.getByText('Submit');
  fireEvent.click(submitButton);

  // Wait for error announcement
  await global.waitForAnnouncement('Email is required');
});
```

## Common Accessibility Issues and Solutions

### 1. Missing Form Labels

**Problem:**
```jsx
<input type="email" placeholder="Email" />
```

**Solution:**
```jsx
<label htmlFor="email">Email</label>
<input type="email" id="email" placeholder="Email" />
```

### 2. Poor Color Contrast

**Problem:**
```css
.text { color: #999; background: #ccc; }
```

**Solution:**
```css
.text { color: #333; background: #fff; }
```

**Test:**
```typescript
test('text has sufficient contrast', () => {
  const result = validateColorContrast('#333333', '#ffffff');
  expect(result.passes).toBe(true);
});
```

### 3. Missing Focus Indicators

**Problem:**
```css
button:focus { outline: none; }
```

**Solution:**
```css
button:focus {
  outline: 2px solid #0066cc;
  outline-offset: 2px;
}
```

### 4. Inaccessible Modals

**Problem:**
```jsx
<div className="modal">
  <h2>Modal Title</h2>
  <p>Content</p>
</div>
```

**Solution:**
```jsx
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="modal-title"
  tabIndex={-1}
>
  <h2 id="modal-title">Modal Title</h2>
  <p>Content</p>
</div>
```

## Integration with CI/CD

### Jest Configuration

Add to your `jest.config.js`:

```javascript
module.exports = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.accessibility.js'],
  testEnvironment: 'jsdom',
  moduleNameMapping: {
    '\\.(css|less|scss)$': 'identity-obj-proxy'
  }
};
```

### Package Scripts

Add to your `package.json`:

```json
{
  "scripts": {
    "test:a11y": "jest --testPathPattern=accessibility",
    "test:a11y:watch": "jest --testPathPattern=accessibility --watch",
    "test:a11y:coverage": "jest --testPathPattern=accessibility --coverage"
  }
}
```

### GitHub Actions

```yaml
name: Accessibility Tests
on: [push, pull_request]

jobs:
  accessibility:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:a11y
```

## Advanced Usage

### Custom Accessibility Rules

```typescript
import { configureAxe } from 'jest-axe';

configureAxe({
  rules: {
    'custom-rule': {
      enabled: true,
      options: { /* custom options */ }
    }
  }
});
```

### Performance Considerations

For large test suites, you can skip certain tests conditionally:

```typescript
const skipA11yTests = process.env.SKIP_A11Y_TESTS === 'true';

test('accessibility test', async () => {
  if (skipA11yTests) {
    console.log('Skipping accessibility test');
    return;
  }

  await runAccessibilityTests(<Component />);
});
```

## Troubleshooting

### Common Issues

1. **Tests timeout**: Increase timeout for screen reader tests
2. **False positives**: Configure axe rules to match your needs
3. **Focus management**: Ensure proper cleanup between tests

### Debug Mode

Enable debug logging:

```typescript
process.env.DEBUG_A11Y = 'true';
```

This will provide detailed information about accessibility violations and test execution.

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [axe-core Rules](https://github.com/dequelabs/axe-core/blob/develop/doc/rule-descriptions.md)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM Screen Reader Testing](https://webaim.org/articles/screenreader_testing/)