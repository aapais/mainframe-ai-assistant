# Component Library Documentation

## Overview

The Mainframe KB Assistant component library is built with accessibility, performance, and maintainability at its core. All components follow WCAG 2.1 AA guidelines and include comprehensive TypeScript types, prop validation, and performance optimizations.

## Design Principles

### 1. Accessibility First
- **WCAG 2.1 AA Compliance**: All components meet or exceed WCAG 2.1 AA standards
- **Screen Reader Support**: Complete ARIA support and semantic HTML
- **Keyboard Navigation**: Full keyboard accessibility with logical tab order
- **Focus Management**: Proper focus handling and visible focus indicators
- **Color Contrast**: Minimum 4.5:1 contrast ratio for normal text, 3:1 for large text

### 2. Performance Optimized
- **Smart Memoization**: Components use `smartMemo` for optimal re-render prevention
- **Bundle Size**: Tree-shakeable exports and minimal dependencies
- **Lazy Loading**: Components support lazy loading patterns
- **Memory Management**: Proper cleanup and memory leak prevention

### 3. Type Safety
- **Full TypeScript**: Complete type coverage with strict mode
- **Prop Validation**: Runtime validation in development mode
- **Generic Support**: Generic components for type-safe reuse
- **IntelliSense**: Rich IDE support with JSDoc comments

## Component Categories

### Foundation Components
Core building blocks that form the basis of all UI elements:

- **[Button](#button)** - Primary action component with variants and states
- **[Input](#input)** - Text input with validation and accessibility
- **[Select](#select)** - Dropdown selection with keyboard navigation
- **[TextArea](#textarea)** - Multi-line text input with auto-resize

### Form Components
Specialized components for form creation and validation:

- **[FormField](#formfield)** - Wrapper component with label and validation
- **[FormButton](#formbutton)** - Form-specific button with submission states
- **[TagsField](#tagsfield)** - Tag input with keyboard shortcuts
- **[SelectField](#selectfield)** - Select with integrated form field wrapper

### Layout Components
Components for structuring page layouts:

- **[WindowLayout](#windowlayout)** - Multi-window layout manager
- **[WindowTabs](#windowtabs)** - Tabbed interface component
- **[WindowTitleBar](#windowtitlebar)** - Title bar with controls

### Feedback Components
Components for user feedback and notifications:

- **[AlertMessage](#alertmessage)** - Alert notifications with ARIA live regions
- **[LoadingIndicator](#loadingindicator)** - Loading states with accessibility
- **[ErrorBoundary](#errorboundary)** - Error handling with user-friendly messages

### Accessibility Components
Specialized components for enhanced accessibility:

- **[AccessibilityChecker](#accessibilitychecker)** - Runtime accessibility validation
- **[AriaPatterns](#ariapatterns)** - Common ARIA pattern implementations
- **[ScreenReaderSupport](#screenreadersupport)** - Screen reader enhancements

## Quick Start

### Installation

```bash
npm install @mainframe-kb/components
```

### Basic Usage

```tsx
import React from 'react';
import { Button, AlertMessage, FormField, Input } from '@mainframe-kb/components';

function MyComponent() {
  const [showAlert, setShowAlert] = React.useState(false);

  return (
    <div>
      <FormField label="Username" required>
        <Input
          id="username"
          type="text"
          placeholder="Enter username"
          aria-describedby="username-help"
        />
      </FormField>

      <Button
        variant="primary"
        onClick={() => setShowAlert(true)}
      >
        Submit
      </Button>

      {showAlert && (
        <AlertMessage
          severity="success"
          message="Form submitted successfully!"
          dismissible
          onDismiss={() => setShowAlert(false)}
        />
      )}
    </div>
  );
}
```

## Component Documentation

---

## Button

Versatile button component with multiple variants, sizes, and states.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `'primary' \| 'secondary' \| 'outline' \| 'ghost' \| 'danger' \| 'success'` | `'primary'` | Visual variant of the button |
| `size` | `'xs' \| 'sm' \| 'md' \| 'lg' \| 'xl'` | `'md'` | Size of the button |
| `loading` | `boolean` | `false` | Shows loading spinner and disables interaction |
| `disabled` | `boolean` | `false` | Disables the button |
| `fullWidth` | `boolean` | `false` | Makes button take full width of container |
| `startIcon` | `React.ReactNode` | - | Icon displayed before the button text |
| `endIcon` | `React.ReactNode` | - | Icon displayed after the button text |
| `onClick` | `(event: MouseEvent) => void` | - | Click handler function |

### Accessibility Features

- ✅ **Keyboard Navigation**: Full keyboard support with Enter and Space activation
- ✅ **Screen Reader**: Proper ARIA labels and state announcements
- ✅ **Focus Management**: Visible focus indicators with proper contrast
- ✅ **Loading States**: Accessible loading indication with ARIA status
- ✅ **Color Contrast**: All variants meet WCAG AA contrast requirements

### Examples

#### Basic Button

```tsx
<Button onClick={() => console.log('Clicked')}>
  Click Me
</Button>
```

#### Button with Icon

```tsx
<Button
  variant="primary"
  startIcon={<PlusIcon />}
  onClick={handleCreate}
>
  Create New
</Button>
```

#### Loading Button

```tsx
<Button
  loading={isSubmitting}
  disabled={!isValid}
  onClick={handleSubmit}
>
  {isSubmitting ? 'Submitting...' : 'Submit'}
</Button>
```

#### Button Group

```tsx
<ButtonGroup orientation="horizontal" attached>
  <Button variant="outline">First</Button>
  <Button variant="outline">Second</Button>
  <Button variant="outline">Third</Button>
</ButtonGroup>
```

---

## AlertMessage

Comprehensive alert component supporting multiple styles and interaction patterns.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `severity` | `'info' \| 'success' \| 'warning' \| 'error'` | `'info'` | Alert severity level |
| `title` | `string` | - | Optional alert title |
| `message` | `string \| React.ReactNode` | **required** | Alert message content |
| `dismissible` | `boolean` | `false` | Shows dismiss button |
| `autoDismiss` | `number` | - | Auto-dismiss timer in milliseconds |
| `alertStyle` | `'inline' \| 'toast' \| 'banner' \| 'modal'` | `'inline'` | Visual style of the alert |
| `actions` | `AlertAction[]` | `[]` | Action buttons for the alert |
| `onDismiss` | `() => void` | - | Dismiss callback |

### Accessibility Features

- ✅ **ARIA Live Regions**: Automatic announcements based on severity
- ✅ **Role Management**: Appropriate ARIA roles (alert, status, alertdialog)
- ✅ **Keyboard Navigation**: Full keyboard support for actions
- ✅ **Focus Management**: Proper focus handling for modal alerts
- ✅ **Screen Reader**: Complete screen reader support with announcements

### Examples

#### Basic Alert

```tsx
<AlertMessage
  severity="info"
  message="Your changes have been saved."
/>
```

#### Dismissible Alert

```tsx
<AlertMessage
  severity="warning"
  title="Validation Error"
  message="Please correct the errors below before submitting."
  dismissible
  onDismiss={() => setShowAlert(false)}
/>
```

#### Alert with Actions

```tsx
<AlertMessage
  severity="error"
  title="Connection Lost"
  message="Unable to connect to the server. Would you like to retry?"
  actions={[
    {
      id: 'retry',
      label: 'Retry',
      onClick: handleRetry,
      variant: 'primary'
    },
    {
      id: 'cancel',
      label: 'Cancel',
      onClick: handleCancel,
      variant: 'ghost'
    }
  ]}
/>
```

#### Toast Notification

```tsx
// Programmatic toast
import { showToast } from '@mainframe-kb/components';

showToast({
  severity: 'success',
  message: 'Operation completed successfully!',
  autoDismiss: 5000,
  position: 'top-right'
});
```

---

## FormField

Wrapper component that provides consistent layout and accessibility for form inputs.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `string` | **required** | Field label text |
| `required` | `boolean` | `false` | Marks field as required |
| `optional` | `boolean` | `false` | Marks field as optional |
| `helpText` | `string` | - | Help text displayed below input |
| `error` | `string` | - | Error message |
| `children` | `React.ReactNode` | **required** | Form control element |

### Accessibility Features

- ✅ **Label Association**: Proper label-to-input association
- ✅ **Error Handling**: ARIA error descriptions and announcements
- ✅ **Help Text**: Associated help text with aria-describedby
- ✅ **Required Indication**: Clear required field indication

### Examples

#### Basic Form Field

```tsx
<FormField label="Email Address" required>
  <Input
    type="email"
    placeholder="user@example.com"
  />
</FormField>
```

#### Field with Help Text

```tsx
<FormField
  label="Password"
  helpText="Must be at least 8 characters long"
  required
>
  <Input
    type="password"
    minLength={8}
  />
</FormField>
```

#### Field with Error

```tsx
<FormField
  label="Username"
  error="Username is already taken"
  required
>
  <Input
    type="text"
    value={username}
    onChange={setUsername}
    aria-invalid={!!error}
  />
</FormField>
```

---

## Input

Flexible input component with validation and accessibility features.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `type` | `string` | `'text'` | HTML input type |
| `value` | `string` | - | Controlled value |
| `defaultValue` | `string` | - | Uncontrolled default value |
| `placeholder` | `string` | - | Placeholder text |
| `disabled` | `boolean` | `false` | Disables the input |
| `required` | `boolean` | `false` | Marks input as required |
| `onChange` | `(value: string, event: ChangeEvent) => void` | - | Change handler |
| `onBlur` | `(event: FocusEvent) => void` | - | Blur handler |
| `onFocus` | `(event: FocusEvent) => void` | - | Focus handler |

### Accessibility Features

- ✅ **ARIA Support**: Complete ARIA attribute support
- ✅ **Validation States**: Proper invalid/valid state indication
- ✅ **Error Association**: Links to error messages via aria-describedby
- ✅ **Label Association**: Works with FormField for proper labeling

### Examples

#### Controlled Input

```tsx
const [value, setValue] = React.useState('');

<Input
  value={value}
  onChange={(newValue) => setValue(newValue)}
  placeholder="Enter text..."
/>
```

#### Input with Validation

```tsx
<Input
  type="email"
  required
  aria-invalid={!isValidEmail}
  aria-describedby={!isValidEmail ? 'email-error' : undefined}
/>
```

---

## WindowLayout

Multi-window layout manager for desktop-style applications.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `windows` | `WindowConfig[]` | **required** | Array of window configurations |
| `activeWindow` | `string` | - | ID of currently active window |
| `onWindowChange` | `(windowId: string) => void` | - | Window change handler |
| `allowResize` | `boolean` | `true` | Allows window resizing |
| `allowMove` | `boolean` | `true` | Allows window moving |

### Accessibility Features

- ✅ **Keyboard Navigation**: Full keyboard support for window management
- ✅ **Focus Management**: Proper focus containment within windows
- ✅ **ARIA Roles**: Appropriate ARIA roles for dialog/window patterns
- ✅ **Screen Reader**: Window state announcements

### Examples

#### Multi-Window Layout

```tsx
const windows = [
  {
    id: 'search',
    title: 'Search',
    component: <SearchWindow />,
    defaultSize: { width: 400, height: 300 }
  },
  {
    id: 'details',
    title: 'Details',
    component: <DetailsWindow />,
    defaultSize: { width: 600, height: 400 }
  }
];

<WindowLayout
  windows={windows}
  activeWindow="search"
  onWindowChange={setActiveWindow}
/>
```

## Performance Guidelines

### Component Optimization

1. **Use smartMemo**: All components use smart memoization for optimal performance
2. **Prop Drilling**: Avoid excessive prop drilling; use context for shared state
3. **Bundle Splitting**: Import only needed components to reduce bundle size
4. **Lazy Loading**: Use React.lazy for components not immediately needed

### Example Optimizations

```tsx
// ✅ Good: Import only what you need
import { Button, Input } from '@mainframe-kb/components';

// ❌ Avoid: Import entire library
import * as Components from '@mainframe-kb/components';

// ✅ Good: Lazy load heavy components
const HeavyChart = React.lazy(() => import('./HeavyChart'));

// ✅ Good: Memoize expensive computations
const expensiveValue = React.useMemo(() => {
  return computeExpensiveValue(data);
}, [data]);
```

## Testing Guidelines

### Accessibility Testing

All components include comprehensive accessibility tests:

```tsx
// Example accessibility test
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

test('Button has no accessibility violations', async () => {
  const { container } = render(
    <Button onClick={() => {}}>Test Button</Button>
  );

  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

### Component Testing

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

test('Button handles click events', async () => {
  const handleClick = jest.fn();
  render(<Button onClick={handleClick}>Click me</Button>);

  await userEvent.click(screen.getByRole('button'));
  expect(handleClick).toHaveBeenCalledTimes(1);
});
```

## Migration Guide

### From v1.x to v2.x

1. **Import Changes**: Update import statements to use new paths
2. **Prop Renames**: Some props have been renamed for consistency
3. **Removed Props**: Legacy props have been removed
4. **New Features**: Take advantage of new accessibility features

```tsx
// v1.x
import { Button } from '@mainframe-kb/components/Button';
<Button color="primary" />

// v2.x
import { Button } from '@mainframe-kb/components';
<Button variant="primary" />
```

## Contributing

### Development Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Start Storybook: `npm run storybook`
4. Run tests: `npm test`
5. Run accessibility tests: `npm run test:a11y`

### Component Development Guidelines

1. **Start with Accessibility**: Design with screen readers and keyboard users in mind
2. **Type Everything**: Provide complete TypeScript types
3. **Test Thoroughly**: Include unit, integration, and accessibility tests
4. **Document Well**: Provide clear examples and API documentation
5. **Performance First**: Use memoization and optimize bundle size

### Code Standards

- **ESLint**: Follow the project ESLint configuration
- **Prettier**: Code is automatically formatted
- **TypeScript Strict**: All code must pass TypeScript strict mode
- **Accessibility**: All components must pass axe-core tests

## Support

### Getting Help

- **Documentation**: Check this README and component-specific docs
- **Examples**: See the `/examples` directory for usage patterns
- **Issues**: Report bugs and request features on GitHub
- **Discord**: Join our community Discord for real-time help

### Common Issues

#### Component Not Rendering
- Ensure all required props are provided
- Check console for TypeScript/validation errors
- Verify import statements are correct

#### Accessibility Warnings
- Run `npm run test:a11y` to identify issues
- Check ARIA attributes are properly set
- Ensure proper semantic HTML structure

#### Performance Issues
- Use React DevTools Profiler to identify bottlenecks
- Verify components are properly memoized
- Check for memory leaks in useEffect hooks

---

## Changelog

### v2.1.0 (Latest)
- ✨ Added WindowLayout component for multi-window interfaces
- ✨ Enhanced AlertMessage with toast notifications
- 🐛 Fixed focus management in modal alerts
- ♿ Improved screen reader announcements
- 📝 Added comprehensive accessibility documentation

### v2.0.0
- 💥 **Breaking**: Renamed `color` prop to `variant` in Button
- ✨ Added comprehensive accessibility features
- ✨ Added smart memoization for performance
- 🎨 Updated design tokens and color system
- ♿ WCAG 2.1 AA compliance across all components

### v1.0.0
- 🎉 Initial release with core components
- ✨ Button, Input, Select, TextArea components
- 🎨 Basic styling and theming
- 📝 Initial documentation

---

*This documentation is automatically generated and tested for accuracy. Last updated: $(date)*