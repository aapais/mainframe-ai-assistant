# Keyboard Navigation System

A comprehensive keyboard navigation and accessibility system for the Mainframe AI Assistant application, designed to provide full keyboard accessibility and enhance productivity for all users.

## Overview

This system provides:
- **Global keyboard shortcuts** for common actions
- **Focus management** with visual indicators
- **Modal and dialog focus trapping**
- **Roving tabindex** for complex widgets
- **Skip links** for screen readers
- **Keyboard help documentation**
- **Enhanced components** with keyboard support
- **Screen reader compatibility**

## Quick Start

### 1. Wrap Your App

```tsx
import { KeyboardProvider } from './contexts/KeyboardContext';
import { GlobalKeyboardHelp } from './components/KeyboardHelp';
import './styles/keyboard-navigation.css';

function App() {
  return (
    <KeyboardProvider
      enableSkipLinks={true}
      skipLinks={[
        { href: '#main-content', text: 'Skip to main content' },
        { href: '#search', text: 'Skip to search' }
      ]}
    >
      <YourAppContent />
      <GlobalKeyboardHelp />
    </KeyboardProvider>
  );
}
```

### 2. Use Keyboard-Enhanced Components

```tsx
import { Button } from './components/common/Button';
import { useKeyboardShortcuts } from './contexts/KeyboardContext';

function MyComponent() {
  // Register keyboard shortcuts
  useKeyboardShortcuts([
    {
      key: 'n',
      ctrlKey: true,
      description: 'Create new entry',
      action: () => setShowModal(true)
    }
  ]);

  return (
    <Button
      variant="primary"
      shortcut={{ key: 'n', ctrlKey: true, description: 'Create new entry' }}
      onClick={() => setShowModal(true)}
    >
      New Entry
    </Button>
  );
}
```

### 3. Add Navigation to Lists and Forms

```tsx
import { useListNavigation, useModalNavigation } from './hooks/useKeyboardNavigation';

function MyList({ items }) {
  const navigation = useListNavigation('vertical', true);

  return (
    <div ref={navigation.containerRef} role="listbox">
      {items.map((item, index) => (
        <div
          key={item.id}
          role="option"
          tabIndex={0}
          onClick={() => onSelect(item)}
        >
          {item.name}
        </div>
      ))}
    </div>
  );
}
```

## Core Components

### KeyboardProvider

The main context provider that manages global keyboard state and shortcuts.

```tsx
interface KeyboardProviderProps {
  children: ReactNode;
  enableSkipLinks?: boolean;
  skipLinks?: Array<{ href: string; text: string }>;
}
```

**Features:**
- Global shortcut registration
- Keyboard mode detection
- Focus management
- Skip link creation
- Screen reader support

### FocusManager

Central focus management utility with advanced features.

```tsx
import { focusManager } from './utils/focusManager';

// Create focus trap for modals
const trap = focusManager.createFocusTrap(containerElement, {
  trapFocus: true,
  initialFocus: '.first-input',
  onEscape: () => closeModal()
});

// Get focusable elements
const focusable = focusManager.getFocusableElements(container);

// Focus first/last elements
focusManager.focusFirst(container);
focusManager.focusLast(container);

// Check keyboard mode
if (focusManager.isKeyboardOnlyMode()) {
  // Enhanced keyboard experience
}
```

### Enhanced Components

#### Button with Shortcuts

```tsx
<Button
  variant="primary"
  shortcut={{
    key: 'Enter',
    ctrlKey: true,
    description: 'Submit form'
  }}
  onClick={handleSubmit}
>
  Submit
</Button>
```

#### Button Group with Navigation

```tsx
<ButtonGroup
  orientation="horizontal"
  keyboardNavigation={true}
  label="Primary actions"
>
  <Button>Save</Button>
  <Button>Cancel</Button>
  <Button>Help</Button>
</ButtonGroup>
```

## Hooks

### useKeyboardNavigation

Main hook for component keyboard navigation.

```tsx
const navigation = useKeyboardNavigation({
  orientation: 'vertical',
  wrap: true,
  trapFocus: false,
  shortcuts: [
    {
      key: 'Enter',
      action: () => activateSelected(),
      description: 'Activate selected item'
    }
  ],
  onFocus: (element) => console.log('Focused:', element),
  onEscape: () => closeComponent()
});

return (
  <div ref={navigation.containerRef}>
    {/* Your navigable content */}
  </div>
);
```

### useKeyboardShortcuts

Register keyboard shortcuts for components.

```tsx
useKeyboardShortcuts([
  {
    key: 'n',
    ctrlKey: true,
    description: 'New item',
    action: () => createNew(),
    scope: 'editor' // Optional scope
  },
  {
    key: 'Escape',
    description: 'Cancel',
    action: () => cancel()
  }
], 'my-component');
```

### Specialized Hooks

```tsx
// Modal navigation with focus trap
const modalNav = useModalNavigation(isOpen, onClose);

// List navigation
const listNav = useListNavigation('vertical', true);

// Form navigation
const formNav = useFormNavigation();

// Grid navigation
const gridNav = useGridNavigation(rows, columns);
```

## Navigation Patterns

### List Navigation

```tsx
function MyList({ items, onSelect }) {
  const navigation = useListNavigation('vertical', true);

  return (
    <div
      ref={navigation.containerRef}
      role="listbox"
      aria-label="Items list"
    >
      {items.map((item, index) => (
        <div
          key={item.id}
          role="option"
          tabIndex={0}
          aria-selected={selectedId === item.id}
          onClick={() => onSelect(item)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSelect(item);
            }
          }}
        >
          {/* Number shortcut for first 9 items */}
          {index < 9 && <span className="shortcut-hint">{index + 1}</span>}
          {item.name}
        </div>
      ))}
    </div>
  );
}
```

### Modal Navigation

```tsx
function Modal({ isOpen, onClose, children }) {
  const navigation = useModalNavigation(isOpen, onClose);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        ref={navigation.containerRef}
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <header>
          <h2>Modal Title</h2>
          <button
            onClick={onClose}
            aria-label="Close dialog"
          >
            ✕
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}
```

### Form Navigation

```tsx
function MyForm({ onSubmit }) {
  const navigation = useFormNavigation();

  return (
    <form
      ref={navigation.containerRef}
      onSubmit={onSubmit}
      className="form-navigation"
    >
      <fieldset>
        <legend>User Information</legend>

        <div className="form-field">
          <label htmlFor="name">Name:</label>
          <input id="name" type="text" required />
        </div>

        <div className="form-field">
          <label htmlFor="email">Email:</label>
          <input id="email" type="email" required />
        </div>
      </fieldset>

      <ButtonGroup>
        <Button
          type="submit"
          variant="primary"
          shortcut={{
            key: 'Enter',
            ctrlKey: true,
            description: 'Submit form'
          }}
        >
          Submit
        </Button>
        <Button type="button" variant="secondary">
          Cancel
        </Button>
      </ButtonGroup>
    </form>
  );
}
```

## Global Shortcuts

The system provides these global shortcuts by default:

| Shortcut | Action | Description |
|----------|--------|-------------|
| `F1` | Toggle Help | Show/hide keyboard shortcuts help |
| `/` | Focus Search | Focus the main search input |
| `Ctrl+K` | Focus Search | Alternative search focus |
| `Escape` | Close/Cancel | Close modals, clear selection |

### Custom Global Shortcuts

```tsx
// In your main app component
useKeyboardShortcuts([
  {
    key: 'n',
    ctrlKey: true,
    description: 'New entry',
    action: () => createNewEntry(),
    scope: 'global' // Available everywhere
  }
], 'app');
```

## Accessibility Features

### Skip Links

Automatically created skip links for keyboard users:

```tsx
<KeyboardProvider
  enableSkipLinks={true}
  skipLinks={[
    { href: '#main-content', text: 'Skip to main content' },
    { href: '#search', text: 'Skip to search' },
    { href: '#navigation', text: 'Skip to navigation' }
  ]}
>
```

### Screen Reader Support

- **Live regions** for dynamic announcements
- **ARIA labels and descriptions** for all interactive elements
- **Proper roles and states** (listbox, option, dialog, etc.)
- **Keyboard shortcut announcements** via `aria-keyshortcuts`

### Focus Management

- **Visual focus indicators** that only show for keyboard users
- **Focus trapping** in modals and dialogs
- **Focus restoration** when closing modals
- **Logical tab order** throughout the application

### High Contrast and Dark Mode

The CSS includes support for:
- **High contrast mode** with enhanced focus indicators
- **Dark mode** with appropriate color adjustments
- **Reduced motion** support for users with vestibular disorders
- **Print styles** that hide focus indicators

## Visual Indicators

### CSS Classes

The system automatically applies these CSS classes:

- `.keyboard-focused` - Applied to elements focused via keyboard
- `.focus-trapped` - Applied to containers with focus traps
- `.navigation-list` - Applied to keyboard-navigable lists
- `.form-navigation` - Applied to keyboard-navigable forms

### Customizing Styles

```css
/* Enhanced focus for your components */
.my-component.keyboard-focused {
  outline: 3px solid #3b82f6;
  outline-offset: 2px;
  box-shadow: 0 0 0 6px rgba(59, 130, 246, 0.2);
}

/* Custom button focus */
.my-button:focus-visible {
  background-color: rgba(29, 78, 216, 0.1);
  border-color: #1d4ed8;
}
```

## Help System

### Keyboard Help Dialog

Shows all available shortcuts organized by category:

```tsx
import { KeyboardHelp } from './components/KeyboardHelp';

// Controlled usage
<KeyboardHelp
  isOpen={showHelp}
  onClose={() => setShowHelp(false)}
  additionalShortcuts={[
    {
      title: 'Custom Actions',
      shortcuts: [
        { keys: ['Ctrl', 'D'], description: 'Duplicate item' }
      ]
    }
  ]}
/>

// Global help (automatically responds to F1)
<GlobalKeyboardHelp />
```

### Help Button

```tsx
import { KeyboardHelpButton } from './components/KeyboardHelp';

// Icon only
<KeyboardHelpButton variant="icon" />

// Full button with shortcut
<KeyboardHelpButton variant="full" />
```

## Performance Considerations

### Lazy Loading

The system only activates keyboard navigation when needed:

- **Keyboard detection** happens automatically
- **Shortcuts only register** when components mount
- **Focus management** is optimized for performance
- **Visual indicators** only show for keyboard users

### Memory Management

- **Automatic cleanup** when components unmount
- **Event listeners** are properly removed
- **Focus traps** are destroyed when not needed
- **Shortcuts** are unregistered automatically

## Browser Support

### Full Support
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

### Graceful Degradation
- Internet Explorer 11 (basic functionality)
- Older browsers (standard Tab navigation)

## Testing

### Manual Testing Checklist

- [ ] Tab through all interactive elements
- [ ] Use only keyboard to complete all tasks
- [ ] Test with screen reader (NVDA, JAWS, VoiceOver)
- [ ] Verify skip links appear on Tab
- [ ] Test all keyboard shortcuts
- [ ] Verify focus trapping in modals
- [ ] Test with high contrast mode
- [ ] Verify reduced motion support

### Automated Testing

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { KeyboardProvider } from '../contexts/KeyboardContext';

test('keyboard navigation works', async () => {
  const user = userEvent.setup();

  render(
    <KeyboardProvider>
      <MyComponent />
    </KeyboardProvider>
  );

  // Test keyboard shortcut
  await user.keyboard('{Control>}n{/Control}');
  expect(screen.getByRole('dialog')).toBeVisible();

  // Test focus navigation
  await user.tab();
  expect(screen.getByRole('button', { name: 'Save' })).toHaveFocus();
});
```

## Migration Guide

### From Standard Components

```tsx
// Before
<button onClick={save}>Save</button>

// After
<Button
  onClick={save}
  shortcut={{ key: 's', ctrlKey: true, description: 'Save changes' }}
>
  Save
</Button>
```

### Adding Navigation to Existing Lists

```tsx
// Before
<div>
  {items.map(item => (
    <div key={item.id} onClick={() => select(item)}>
      {item.name}
    </div>
  ))}
</div>

// After
function MyList({ items, onSelect }) {
  const navigation = useListNavigation();

  return (
    <div ref={navigation.containerRef} role="listbox">
      {items.map((item, index) => (
        <div
          key={item.id}
          role="option"
          tabIndex={0}
          onClick={() => onSelect(item)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSelect(item);
          }}
        >
          {item.name}
        </div>
      ))}
    </div>
  );
}
```

## Examples

See the complete working example at:
`src/renderer/examples/KeyboardNavigationExample.tsx`

This example demonstrates:
- Full application integration
- Multiple navigation patterns
- Modal dialogs with focus trapping
- Settings panel with form navigation
- Search with autocomplete
- List navigation with quick selection
- Toolbar with horizontal navigation

## Troubleshooting

### Common Issues

1. **Shortcuts not working**
   - Ensure KeyboardProvider wraps your app
   - Check for scope conflicts
   - Verify shortcut registration

2. **Focus indicators not showing**
   - Import keyboard-navigation.css
   - Check if keyboard mode is detected
   - Verify CSS is not overridden

3. **Focus trap not working**
   - Ensure modal has focusable elements
   - Check if container ref is attached
   - Verify modal is properly structured

4. **Screen reader issues**
   - Check ARIA labels and roles
   - Verify live regions exist
   - Test with actual screen reader

### Debug Mode

```tsx
import { useKeyboard } from './contexts/KeyboardContext';

function DebugInfo() {
  const { state } = useKeyboard();

  return (
    <div style={{ position: 'fixed', bottom: 0, right: 0, background: '#000', color: '#fff', padding: '1rem' }}>
      <div>Keyboard Mode: {state.isKeyboardMode ? 'ON' : 'OFF'}</div>
      <div>Active Scope: {state.activeScope || 'Global'}</div>
      <div>Shortcuts: {state.registeredShortcuts.size}</div>
      <div>Help Visible: {state.showKeyboardHelp ? 'YES' : 'NO'}</div>
    </div>
  );
}
```

## Contributing

When adding new components:

1. **Use keyboard navigation hooks** where appropriate
2. **Add proper ARIA attributes** for screen readers
3. **Support keyboard shortcuts** for primary actions
4. **Test with keyboard only** before submitting
5. **Update documentation** for new patterns

## License

This keyboard navigation system is part of the Mainframe AI Assistant project and follows the same license terms.