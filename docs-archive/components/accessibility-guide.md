# Accessibility Guide - WCAG 2.1 AA Compliance

## Overview

This guide provides comprehensive accessibility requirements and implementation patterns for the Mainframe KB Assistant component library. All components must meet WCAG 2.1 AA standards to ensure inclusivity and usability for all users.

## Table of Contents

1. [WCAG 2.1 AA Requirements](#wcag-21-aa-requirements)
2. [Testing Procedures](#testing-procedures)
3. [Keyboard Navigation Patterns](#keyboard-navigation-patterns)
4. [Focus Management Guidelines](#focus-management-guidelines)
5. [ARIA Implementation Patterns](#aria-implementation-patterns)
6. [Color Contrast Requirements](#color-contrast-requirements)
7. [Screen Reader Support](#screen-reader-support)
8. [Component-Specific Guidelines](#component-specific-guidelines)
9. [Testing Tools and Automation](#testing-tools-and-automation)
10. [Common Issues and Solutions](#common-issues-and-solutions)

---

## WCAG 2.1 AA Requirements

### Core Principles

#### 1. Perceivable
Information and user interface components must be presentable to users in ways they can perceive.

**Success Criteria (Level AA):**
- ✅ **1.1.1 Non-text Content** - All images have alt text
- ✅ **1.2.1 Audio-only and Video-only (Prerecorded)** - Alternatives provided
- ✅ **1.3.1 Info and Relationships** - Semantic markup used
- ✅ **1.3.2 Meaningful Sequence** - Reading order is logical
- ✅ **1.3.3 Sensory Characteristics** - Don't rely on shape/color alone
- ✅ **1.4.1 Use of Color** - Color not sole method of conveying info
- ✅ **1.4.2 Audio Control** - Audio controls available
- ✅ **1.4.3 Contrast (Minimum)** - 4.5:1 ratio for normal text
- ✅ **1.4.4 Resize Text** - Text resizable to 200%
- ✅ **1.4.5 Images of Text** - Use real text when possible
- ✅ **1.4.10 Reflow** - No horizontal scrolling at 400% zoom
- ✅ **1.4.11 Non-text Contrast** - 3:1 ratio for UI components
- ✅ **1.4.12 Text Spacing** - No loss of content with increased spacing
- ✅ **1.4.13 Content on Hover or Focus** - Dismissible, hoverable, persistent

#### 2. Operable
User interface components and navigation must be operable.

**Success Criteria (Level AA):**
- ✅ **2.1.1 Keyboard** - All content keyboard accessible
- ✅ **2.1.2 No Keyboard Trap** - Focus not trapped
- ✅ **2.1.4 Character Key Shortcuts** - Single key shortcuts modifiable
- ✅ **2.2.1 Timing Adjustable** - Time limits adjustable
- ✅ **2.2.2 Pause, Stop, Hide** - Moving content controllable
- ✅ **2.3.1 Three Flashes or Below** - No seizure-inducing content
- ✅ **2.4.1 Bypass Blocks** - Skip links available
- ✅ **2.4.2 Page Titled** - Descriptive page titles
- ✅ **2.4.3 Focus Order** - Logical focus order
- ✅ **2.4.4 Link Purpose (In Context)** - Clear link purposes
- ✅ **2.4.5 Multiple Ways** - Multiple navigation methods
- ✅ **2.4.6 Headings and Labels** - Descriptive headings/labels
- ✅ **2.4.7 Focus Visible** - Visible focus indicators
- ✅ **2.5.1 Pointer Gestures** - No complex gestures required
- ✅ **2.5.2 Pointer Cancellation** - Actions cancellable
- ✅ **2.5.3 Label in Name** - Accessible name includes visible text
- ✅ **2.5.4 Motion Actuation** - Motion-triggered functions optional

#### 3. Understandable
Information and the operation of user interface must be understandable.

**Success Criteria (Level AA):**
- ✅ **3.1.1 Language of Page** - Page language identified
- ✅ **3.1.2 Language of Parts** - Parts language identified
- ✅ **3.2.1 On Focus** - No unexpected context changes on focus
- ✅ **3.2.2 On Input** - No unexpected context changes on input
- ✅ **3.2.3 Consistent Navigation** - Consistent navigation order
- ✅ **3.2.4 Consistent Identification** - Components identified consistently
- ✅ **3.3.1 Error Identification** - Errors clearly identified
- ✅ **3.3.2 Labels or Instructions** - Labels provided for inputs
- ✅ **3.3.3 Error Suggestion** - Error correction suggestions
- ✅ **3.3.4 Error Prevention** - Error prevention for critical actions

#### 4. Robust
Content must be robust enough to be interpreted reliably by assistive technologies.

**Success Criteria (Level AA):**
- ✅ **4.1.1 Parsing** - Valid markup
- ✅ **4.1.2 Name, Role, Value** - Custom components properly exposed
- ✅ **4.1.3 Status Messages** - Status messages programmatically determined

---

## Testing Procedures

### 1. Screen Reader Testing

#### Required Screen Readers
- **NVDA** (Windows) - Primary testing
- **JAWS** (Windows) - Secondary testing
- **VoiceOver** (macOS) - Cross-platform verification
- **TalkBack** (Android) - Mobile testing (future)

#### Testing Checklist

```markdown
## Screen Reader Testing Checklist

### Navigation
- [ ] All content is announced correctly
- [ ] Headings create proper structure
- [ ] Skip links function properly
- [ ] Landmarks are properly identified
- [ ] Focus moves logically through content

### Form Controls
- [ ] Labels are announced with form fields
- [ ] Required fields are identified
- [ ] Error messages are announced
- [ ] Field purposes are clear
- [ ] Group relationships are announced

### Interactive Elements
- [ ] Buttons announce their purpose and state
- [ ] Links announce their destination
- [ ] Menu items are navigable
- [ ] Modal dialogs trap focus appropriately
- [ ] Loading states are announced

### Dynamic Content
- [ ] Live regions announce changes
- [ ] Status messages are communicated
- [ ] Progressive disclosure works correctly
- [ ] State changes are announced
```

#### NVDA Testing Commands

```markdown
## NVDA Essential Commands

### Navigation
- `Tab` - Next focusable element
- `Shift + Tab` - Previous focusable element
- `H` - Next heading
- `Shift + H` - Previous heading
- `1-6` - Headings by level
- `D` - Next landmark
- `F` - Next form field
- `B` - Next button
- `L` - Next link

### Reading
- `Insert + Down Arrow` - Read all
- `Up/Down Arrow` - Read by line
- `Left/Right Arrow` - Read by character
- `Ctrl + Left/Right` - Read by word

### Lists and Tables
- `I` - Next list item
- `T` - Next table
- `Ctrl + Alt + Arrow Keys` - Navigate table cells
```

### 2. Keyboard Testing

#### Testing Protocol

```markdown
## Keyboard Testing Protocol

### Basic Navigation
- [ ] Tab order is logical and complete
- [ ] All interactive elements are keyboard accessible
- [ ] Focus indicators are clearly visible
- [ ] No keyboard traps exist
- [ ] Escape key works to close modals/menus

### Custom Components
- [ ] Arrow keys work for complex widgets
- [ ] Enter/Space activate buttons/links
- [ ] Home/End keys work in appropriate contexts
- [ ] Page Up/Page Down work for scrollable content

### Focus Management
- [ ] Focus moves to newly opened content
- [ ] Focus returns to triggering element when closing
- [ ] Focus doesn't get lost during dynamic updates
- [ ] Skip links allow bypassing repetitive content
```

### 3. Automated Testing

#### Tools Required
- **axe-core** - Accessibility rules engine
- **jest-axe** - Jest integration
- **@axe-core/react** - React integration
- **Lighthouse** - Performance and accessibility audit

#### Test Implementation

```typescript
// accessibility.test.tsx
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { Button } from '../components/Button';

expect.extend(toHaveNoViolations);

describe('Button Accessibility', () => {
  test('should not have accessibility violations', async () => {
    const { container } = render(
      <Button onClick={() => {}}>Test Button</Button>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  test('should be keyboard accessible', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Test</Button>);

    const button = screen.getByRole('button');

    // Test focus
    button.focus();
    expect(button).toHaveFocus();

    // Test activation with Enter
    fireEvent.keyDown(button, { key: 'Enter' });
    expect(handleClick).toHaveBeenCalled();

    // Test activation with Space
    fireEvent.keyDown(button, { key: ' ' });
    expect(handleClick).toHaveBeenCalledTimes(2);
  });
});
```

---

## Keyboard Navigation Patterns

### Standard Keyboard Interactions

| Element Type | Keys | Behavior |
|--------------|------|----------|
| **Button** | `Enter`, `Space` | Activates the button |
| **Link** | `Enter` | Follows the link |
| **Checkbox** | `Space` | Toggles checked state |
| **Radio Button** | `Arrow Keys` | Moves between options in group |
| **Select** | `Arrow Keys`, `Enter`, `Escape` | Opens/navigates/closes dropdown |
| **Text Input** | `Tab`, `Shift+Tab` | Moves focus in/out of field |
| **Modal** | `Escape` | Closes modal |
| **Menu** | `Arrow Keys`, `Enter`, `Escape` | Navigates and activates items |

### Complex Widget Patterns

#### Tab Panel
```typescript
// Keyboard interaction for tab panels
const TabPanel = ({ tabs, activeTab, onTabChange }) => {
  const handleKeyDown = (event: KeyboardEvent, index: number) => {
    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault();
        const prevIndex = index === 0 ? tabs.length - 1 : index - 1;
        onTabChange(prevIndex);
        break;

      case 'ArrowRight':
        event.preventDefault();
        const nextIndex = index === tabs.length - 1 ? 0 : index + 1;
        onTabChange(nextIndex);
        break;

      case 'Home':
        event.preventDefault();
        onTabChange(0);
        break;

      case 'End':
        event.preventDefault();
        onTabChange(tabs.length - 1);
        break;
    }
  };

  return (
    <div role="tablist">
      {tabs.map((tab, index) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={activeTab === index}
          aria-controls={`panel-${tab.id}`}
          id={`tab-${tab.id}`}
          tabIndex={activeTab === index ? 0 : -1}
          onKeyDown={(e) => handleKeyDown(e, index)}
          onClick={() => onTabChange(index)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
};
```

#### Listbox (Select)
```typescript
const Listbox = ({ options, value, onChange, label }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const handleKeyDown = (event: KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
          setFocusedIndex(0);
        } else {
          setFocusedIndex(prev =>
            prev < options.length - 1 ? prev + 1 : prev
          );
        }
        break;

      case 'ArrowUp':
        event.preventDefault();
        if (isOpen) {
          setFocusedIndex(prev => prev > 0 ? prev - 1 : prev);
        }
        break;

      case 'Enter':
      case ' ':
        event.preventDefault();
        if (isOpen && focusedIndex >= 0) {
          onChange(options[focusedIndex]);
          setIsOpen(false);
        } else {
          setIsOpen(!isOpen);
        }
        break;

      case 'Escape':
        setIsOpen(false);
        setFocusedIndex(-1);
        break;
    }
  };

  return (
    <div className="listbox-container">
      <button
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-labelledby="listbox-label"
        onKeyDown={handleKeyDown}
        onClick={() => setIsOpen(!isOpen)}
      >
        {value?.label || 'Select an option'}
      </button>

      {isOpen && (
        <ul role="listbox" aria-labelledby="listbox-label">
          {options.map((option, index) => (
            <li
              key={option.value}
              role="option"
              aria-selected={option.value === value?.value}
              className={index === focusedIndex ? 'focused' : ''}
              onClick={() => {
                onChange(option);
                setIsOpen(false);
              }}
            >
              {option.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
```

---

## Focus Management Guidelines

### Focus Order
1. **Logical Sequence**: Focus moves through content in a meaningful order
2. **Skip Links**: Provide skip links for repetitive navigation
3. **Modal Dialogs**: Focus trapped within modal, returns to trigger on close
4. **Dynamic Content**: Focus moves to newly revealed content

### Focus Indicators
```css
/* High contrast focus indicators */
.focus-visible:focus {
  outline: 2px solid #005fcc;
  outline-offset: 2px;
  border-radius: 2px;
}

/* Custom focus ring for components */
.component:focus-within {
  box-shadow: 0 0 0 2px #005fcc, 0 0 0 4px rgba(0, 95, 204, 0.3);
}

/* Ensure focus indicators work in Windows High Contrast Mode */
@media (prefers-contrast: high) {
  .component:focus {
    outline: 2px solid ButtonText;
  }
}
```

### Focus Management Hooks

```typescript
// useFocusManagement.ts
export const useFocusManagement = () => {
  const focusStack = useRef<HTMLElement[]>([]);

  const pushFocus = (element: HTMLElement) => {
    const currentFocus = document.activeElement as HTMLElement;
    if (currentFocus) {
      focusStack.current.push(currentFocus);
    }
    element.focus();
  };

  const popFocus = () => {
    const previousFocus = focusStack.current.pop();
    if (previousFocus) {
      previousFocus.focus();
    }
  };

  const trapFocus = (container: HTMLElement) => {
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    const handleTabKey = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        if (event.shiftKey) {
          if (document.activeElement === firstElement) {
            event.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            event.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    container.addEventListener('keydown', handleTabKey);
    firstElement.focus();

    return () => {
      container.removeEventListener('keydown', handleTabKey);
    };
  };

  return { pushFocus, popFocus, trapFocus };
};
```

---

## ARIA Implementation Patterns

### Common ARIA Roles

#### Button Pattern
```typescript
const CustomButton = ({ onClick, children, pressed, disabled }) => (
  <div
    role="button"
    tabIndex={disabled ? -1 : 0}
    aria-pressed={pressed}
    aria-disabled={disabled}
    onClick={disabled ? undefined : onClick}
    onKeyDown={(e) => {
      if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
        e.preventDefault();
        onClick();
      }
    }}
  >
    {children}
  </div>
);
```

#### Dialog Pattern
```typescript
const Dialog = ({ isOpen, onClose, title, children }) => {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && dialogRef.current) {
      const trapFocus = useFocusManagement().trapFocus;
      return trapFocus(dialogRef.current);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
      ref={dialogRef}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          onClose();
        }
      }}
    >
      <h2 id="dialog-title">{title}</h2>
      {children}
      <button onClick={onClose}>Close</button>
    </div>
  );
};
```

#### Alert Pattern
```typescript
const Alert = ({ severity, message, onDismiss }) => {
  const role = severity === 'error' ? 'alert' : 'status';
  const ariaLive = severity === 'error' ? 'assertive' : 'polite';

  return (
    <div
      role={role}
      aria-live={ariaLive}
      aria-atomic="true"
      className={`alert alert-${severity}`}
    >
      <div className="alert-content">
        {message}
      </div>
      {onDismiss && (
        <button
          className="alert-dismiss"
          onClick={onDismiss}
          aria-label="Dismiss alert"
        >
          ×
        </button>
      )}
    </div>
  );
};
```

### ARIA States and Properties

#### Form Validation
```typescript
const FormField = ({ label, error, required, children }) => {
  const fieldId = useId();
  const errorId = error ? `${fieldId}-error` : undefined;
  const helpId = `${fieldId}-help`;

  return (
    <div className="form-field">
      <label htmlFor={fieldId}>
        {label}
        {required && <span aria-hidden="true">*</span>}
      </label>

      {React.cloneElement(children, {
        id: fieldId,
        'aria-required': required,
        'aria-invalid': !!error,
        'aria-describedby': [errorId, helpId].filter(Boolean).join(' ')
      })}

      <div id={helpId} className="field-help">
        {required && 'Required field'}
      </div>

      {error && (
        <div id={errorId} role="alert" className="field-error">
          {error}
        </div>
      )}
    </div>
  );
};
```

---

## Color Contrast Requirements

### WCAG AA Standards
- **Normal Text (< 18pt)**: Minimum 4.5:1 contrast ratio
- **Large Text (≥ 18pt or 14pt bold)**: Minimum 3:1 contrast ratio
- **UI Components**: Minimum 3:1 contrast ratio for borders, focus indicators
- **Graphical Objects**: Minimum 3:1 contrast ratio for meaningful graphics

### Color Palette Compliance

```scss
// WCAG AA Compliant Color System
$colors: (
  // Text Colors (4.5:1+ on white background)
  text-primary: #1a1a1a,      // 12.63:1 ratio
  text-secondary: #4a5568,    // 7.53:1 ratio
  text-disabled: #718096,     // 4.54:1 ratio (minimum)

  // Background Colors
  bg-primary: #ffffff,
  bg-secondary: #f7fafc,
  bg-muted: #edf2f7,

  // Accent Colors (3:1+ for UI elements)
  blue-600: #3182ce,          // 4.56:1 on white
  blue-700: #2c5282,          // 6.27:1 on white
  green-600: #38a169,         // 3.98:1 on white
  red-600: #e53e3e,           // 4.03:1 on white

  // Focus Colors
  focus-ring: #005fcc,        // High contrast focus
  focus-bg: rgba(0, 95, 204, 0.1)
);

// Dark mode compliant colors
$colors-dark: (
  text-primary: #f7fafc,      // 15.8:1 on dark bg
  text-secondary: #e2e8f0,    // 12.6:1 on dark bg
  bg-primary: #1a202c,
  bg-secondary: #2d3748,
);
```

### Contrast Testing Tools

```typescript
// Contrast checking utility
export const checkContrast = (foreground: string, background: string): {
  ratio: number;
  wcagAA: boolean;
  wcagAAA: boolean;
} => {
  const luminance = (color: string): number => {
    const rgb = hexToRgb(color);
    const [r, g, b] = rgb.map(c => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  const l1 = luminance(foreground);
  const l2 = luminance(background);
  const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);

  return {
    ratio: Math.round(ratio * 100) / 100,
    wcagAA: ratio >= 4.5,
    wcagAAA: ratio >= 7,
  };
};
```

---

## Screen Reader Support

### Live Regions

```typescript
// Screen reader announcements
export const useScreenReaderAnnouncements = () => {
  const announceRef = useRef<HTMLDivElement>(null);

  const announce = (message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (!announceRef.current) return;

    // Create temporary announcement element
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', priority);
    announcement.setAttribute('aria-atomic', 'true');
    announcement.textContent = message;
    announcement.className = 'sr-only';

    document.body.appendChild(announcement);

    // Remove after announcement
    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  };

  const announceError = (message: string) => announce(message, 'assertive');
  const announceSuccess = (message: string) => announce(message, 'polite');

  return { announce, announceError, announceSuccess };
};
```

### Screen Reader Only Content

```css
/* Screen reader only utility class */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* Focusable screen reader content */
.sr-only-focusable:focus {
  position: static;
  width: auto;
  height: auto;
  padding: inherit;
  margin: inherit;
  overflow: visible;
  clip: auto;
  white-space: inherit;
}
```

---

## Component-Specific Guidelines

### Form Components

#### Input Fields
```typescript
const AccessibleInput = ({
  label,
  error,
  required,
  helpText,
  type = 'text',
  ...props
}) => {
  const inputId = useId();
  const errorId = error ? `${inputId}-error` : undefined;
  const helpId = helpText ? `${inputId}-help` : undefined;

  const describedBy = [errorId, helpId].filter(Boolean).join(' ');

  return (
    <div className="input-wrapper">
      <label htmlFor={inputId} className="input-label">
        {label}
        {required && <span className="required" aria-hidden="true">*</span>}
      </label>

      <input
        id={inputId}
        type={type}
        aria-required={required}
        aria-invalid={!!error}
        aria-describedby={describedBy || undefined}
        className={`input ${error ? 'input-error' : ''}`}
        {...props}
      />

      {helpText && (
        <div id={helpId} className="input-help">
          {helpText}
        </div>
      )}

      {error && (
        <div id={errorId} role="alert" className="input-error-message">
          {error}
        </div>
      )}
    </div>
  );
};
```

#### Select Dropdown
```typescript
const AccessibleSelect = ({ options, value, onChange, label, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const selectId = useId();
  const listboxId = useId();

  return (
    <div className="select-wrapper">
      <label htmlFor={selectId}>{label}</label>

      <button
        id={selectId}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        aria-activedescendant={focusedIndex >= 0 ? `option-${focusedIndex}` : undefined}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        className="select-button"
      >
        {value?.label || placeholder}
        <ChevronIcon aria-hidden="true" />
      </button>

      {isOpen && (
        <ul
          id={listboxId}
          role="listbox"
          aria-labelledby={selectId}
          className="select-dropdown"
        >
          {options.map((option, index) => (
            <li
              key={option.value}
              id={`option-${index}`}
              role="option"
              aria-selected={option.value === value?.value}
              className={`select-option ${index === focusedIndex ? 'focused' : ''}`}
              onClick={() => handleOptionSelect(option)}
            >
              {option.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
```

### Navigation Components

#### Tab Navigation
```typescript
const TabNavigation = ({ tabs, activeTab, onTabChange }) => {
  const tabRefs = useRef<HTMLButtonElement[]>([]);

  const handleKeyDown = (event: KeyboardEvent, currentIndex: number) => {
    let newIndex = currentIndex;

    switch (event.key) {
      case 'ArrowLeft':
        newIndex = currentIndex === 0 ? tabs.length - 1 : currentIndex - 1;
        break;
      case 'ArrowRight':
        newIndex = currentIndex === tabs.length - 1 ? 0 : currentIndex + 1;
        break;
      case 'Home':
        newIndex = 0;
        break;
      case 'End':
        newIndex = tabs.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    onTabChange(newIndex);
    tabRefs.current[newIndex]?.focus();
  };

  return (
    <div className="tab-container">
      <div role="tablist" className="tab-list">
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            ref={(el) => (tabRefs.current[index] = el!)}
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={activeTab === index}
            aria-controls={`panel-${tab.id}`}
            tabIndex={activeTab === index ? 0 : -1}
            onKeyDown={(e) => handleKeyDown(e, index)}
            onClick={() => onTabChange(index)}
            className={`tab ${activeTab === index ? 'active' : ''}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {tabs.map((tab, index) => (
        <div
          key={tab.id}
          id={`panel-${tab.id}`}
          role="tabpanel"
          aria-labelledby={`tab-${tab.id}`}
          hidden={activeTab !== index}
          className="tab-panel"
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
};
```

---

## Testing Tools and Automation

### Development Tools
1. **Chrome DevTools Accessibility Panel**
2. **Firefox Accessibility Inspector**
3. **axe DevTools Extension**
4. **WAVE Web Accessibility Evaluator**
5. **Lighthouse Accessibility Audit**

### CI/CD Integration

```yaml
# .github/workflows/accessibility.yml
name: Accessibility Testing

on: [push, pull_request]

jobs:
  a11y-tests:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v2

      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Run accessibility tests
        run: npm run test:a11y

      - name: Run WCAG validation
        run: npm run wcag:validate

      - name: Generate accessibility report
        run: npm run a11y:report

      - name: Upload report
        uses: actions/upload-artifact@v2
        with:
          name: accessibility-report
          path: accessibility-report.html
```

### Automated Test Setup

```javascript
// jest-setup-a11y.js
import 'jest-axe/extend-expect';
import { configure } from '@testing-library/react';

// Configure testing library
configure({
  testIdAttribute: 'data-testid',
});

// Global axe configuration
beforeAll(() => {
  // Add custom axe rules if needed
});

// Clean up after each test
afterEach(() => {
  // Clean up any created elements
  document.body.innerHTML = '';
});
```

---

## Common Issues and Solutions

### Issue 1: Missing Form Labels

**Problem**: Form inputs without proper labels
```jsx
// ❌ Inaccessible
<input type="text" placeholder="Username" />
```

**Solution**: Always provide labels
```jsx
// ✅ Accessible
<label htmlFor="username">Username</label>
<input id="username" type="text" placeholder="e.g., john.doe" />
```

### Issue 2: Low Color Contrast

**Problem**: Text with insufficient contrast
```css
/* ❌ Fails WCAG AA (2.1:1 ratio) */
.text-muted {
  color: #999999;
  background: #ffffff;
}
```

**Solution**: Use compliant colors
```css
/* ✅ Meets WCAG AA (4.6:1 ratio) */
.text-muted {
  color: #666666;
  background: #ffffff;
}
```

### Issue 3: Keyboard Traps

**Problem**: Focus gets trapped without escape
```jsx
// ❌ Trap without escape
const Modal = () => (
  <div tabIndex={0}>
    <input />
    <button>Save</button>
    {/* No way to escape with keyboard */}
  </div>
);
```

**Solution**: Implement proper focus management
```jsx
// ✅ Proper focus trap with escape
const Modal = ({ onClose }) => {
  const trapRef = useRef();

  useEffect(() => {
    const trap = focusTrap.createFocusTrap(trapRef.current, {
      escapeDeactivates: true,
      onDeactivate: onClose
    });
    trap.activate();
    return () => trap.deactivate();
  }, []);

  return (
    <div ref={trapRef}>
      <input />
      <button>Save</button>
      <button onClick={onClose}>Cancel</button>
    </div>
  );
};
```

### Issue 4: Missing Error Announcements

**Problem**: Form errors not announced to screen readers
```jsx
// ❌ Silent errors
const FormField = () => (
  <div>
    <input className={error ? 'error' : ''} />
    {error && <span className="error-text">{error}</span>}
  </div>
);
```

**Solution**: Use proper ARIA announcements
```jsx
// ✅ Announced errors
const FormField = () => (
  <div>
    <input
      aria-invalid={!!error}
      aria-describedby={error ? 'error-message' : undefined}
    />
    {error && (
      <div id="error-message" role="alert">
        {error}
      </div>
    )}
  </div>
);
```

### Issue 5: Inadequate Focus Indicators

**Problem**: Invisible or weak focus indicators
```css
/* ❌ Poor focus visibility */
button:focus {
  outline: 1px dotted gray;
}
```

**Solution**: High-contrast focus indicators
```css
/* ✅ Clear focus indicators */
button:focus-visible {
  outline: 2px solid #005fcc;
  outline-offset: 2px;
  box-shadow: 0 0 0 4px rgba(0, 95, 204, 0.3);
}
```

---

## Conclusion

This accessibility guide provides the foundation for creating inclusive, WCAG 2.1 AA compliant components. Regular testing, both automated and manual, ensures that accessibility remains a priority throughout the development process.

### Key Takeaways

1. **Start with Accessibility**: Design with accessibility in mind from the beginning
2. **Test Early and Often**: Incorporate accessibility testing into your development workflow
3. **Use Semantic HTML**: Leverage browser accessibility features with proper markup
4. **Provide Multiple Ways**: Offer various methods for users to accomplish tasks
5. **Focus on User Experience**: Accessibility improvements benefit all users

### Resources for Continued Learning

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/Understanding/)
- [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM Accessibility Resources](https://webaim.org/resources/)
- [MDN Accessibility Documentation](https://developer.mozilla.org/en-US/docs/Web/Accessibility)
- [React Accessibility Documentation](https://react.dev/learn/accessibility)

---

*This guide is regularly updated to reflect current accessibility standards and best practices. Last updated: January 2025*