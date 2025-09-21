# ARIA Implementation Guide

## Complete Accessibility Implementation for Mainframe AI Assistant

This guide documents the comprehensive ARIA (Accessible Rich Internet Applications) implementation that has been added to all UI components in the mainframe-ai-assistant project to meet WCAG 2.1 AA standards.

## Table of Contents

1. [Overview](#overview)
2. [Component Implementations](#component-implementations)
3. [ARIA Patterns](#aria-patterns)
4. [Testing Tools](#testing-tools)
5. [Best Practices](#best-practices)
6. [Validation](#validation)

## Overview

### What Has Been Implemented

✅ **Button Component** - Enhanced with proper ARIA attributes and focus management
✅ **Input Component** - Comprehensive form field accessibility
✅ **Modal Component** - Focus trapping and proper dialog semantics
✅ **Card Component** - Semantic article structure with proper headings
✅ **Navigation Component** - Full keyboard navigation support
✅ **KBEntryForm** - Advanced form accessibility with live regions
✅ **SearchInterface** - Accessible search with announcements
✅ **ARIA Pattern Library** - Reusable accessibility patterns
✅ **Accessibility Checker** - Development testing tool

### WCAG 2.1 AA Compliance Features

- **Proper semantic HTML5 elements**
- **ARIA roles, properties, and states**
- **Keyboard navigation support**
- **Focus management and trapping**
- **Live region announcements**
- **Accessible names and descriptions**
- **Error handling and validation**
- **High contrast and visual indicators**

## Component Implementations

### Button Component (`/src/renderer/components/ui/Button.tsx`)

#### Enhancements Made:

```typescript
// Icon-only buttons require accessible names
if (isIconOnly && !ariaLabel && !props['aria-labelledby']) {
  console.warn('Icon-only buttons should have an aria-label or aria-labelledby attribute');
}

// Enhanced button props
<button
  aria-label={ariaLabel}
  aria-disabled={isDisabled}
  aria-busy={loading}
  {...props}
>
```

#### Key Features:
- Automatic ARIA attribute validation
- Loading state announcements
- Icon accessibility with proper labeling
- Button group semantics with `role="group"`
- Toggle button state management

#### Usage Examples:

```tsx
// Icon-only button (requires aria-label)
<IconButton
  icon={<SearchIcon />}
  aria-label="Search knowledge base"
  onClick={handleSearch}
/>

// Button with loading state
<Button
  loading={isSubmitting}
  loadingText="Saving..."
  aria-busy={isSubmitting}
>
  Save Entry
</Button>

// Button group
<ButtonGroup orientation="horizontal" aria-label="Text formatting">
  <Button>Bold</Button>
  <Button>Italic</Button>
  <Button>Underline</Button>
</ButtonGroup>
```

### Input Component (`/src/renderer/components/ui/Input.tsx`)

#### Enhancements Made:

```typescript
// Comprehensive ARIA support
<input
  aria-required={props.required}
  aria-invalid={currentState === 'error'}
  aria-describedby={cn(
    errorMessage && `${inputId}-error`,
    successMessage && `${inputId}-success`,
    helperText && `${inputId}-help`,
    showCharacterCount && `${inputId}-count`,
    description && `${inputId}-description`
  )}
  aria-labelledby={label ? undefined : props['aria-labelledby']}
  aria-label={!label ? props['aria-label'] : undefined}
/>
```

#### Key Features:
- Automatic label association
- Error message linking with `aria-describedby`
- Live region announcements for validation
- Character count accessibility
- Clear button with proper labeling

#### Usage Examples:

```tsx
// Standard input with validation
<Input
  label="Entry Title"
  description="Provide a clear, descriptive title"
  errorMessage={errors.title}
  required
  maxLength={200}
  showCharacterCount
/>

// Textarea with live validation
<Textarea
  label="Problem Description"
  errorMessage={errors.problem}
  successMessage="Good description format"
  aria-describedby="problem-hint"
  required
/>
```

### Modal Component (`/src/renderer/components/ui/Modal.tsx`)

#### Enhancements Made:

```typescript
// Focus trapping and proper dialog semantics
const ModalContent = forwardRef<HTMLDivElement, ModalContentProps>(
  ({ 'aria-labelledby': ariaLabelledBy, 'aria-describedby': ariaDescribedBy, ...props }, ref) => {
    const titleId = ariaLabelledBy || `${modalId}-title`;
    const descriptionId = ariaDescribedBy || `${modalId}-description`;

    useFocusTrap(!!open, contentRef);

    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        {...props}
      >
```

#### Key Features:
- Automatic focus trapping
- Escape key handling
- Backdrop click management
- Modal title and description linking
- Focus restoration on close

#### Usage Examples:

```tsx
// Standard modal with accessibility
<Modal open={isOpen} onOpenChange={setIsOpen}>
  <ModalContent>
    <ModalHeader>
      <ModalTitle>Confirm Action</ModalTitle>
      <ModalDescription>
        This action cannot be undone. Are you sure you want to continue?
      </ModalDescription>
    </ModalHeader>
    <ModalFooter>
      <Button variant="secondary" onClick={() => setIsOpen(false)}>
        Cancel
      </Button>
      <Button variant="destructive" onClick={handleConfirm}>
        Confirm
      </Button>
    </ModalFooter>
  </ModalContent>
</Modal>
```

### Card Component (`/src/renderer/components/ui/Card.tsx`)

#### Enhancements Made:

```typescript
// Semantic article structure for KB entries
const KBEntryCard = forwardRef<HTMLDivElement, KBEntryCardProps>(({ title, problem, solution, ...props }, ref) => {
  const cardId = `kb-entry-${Math.random().toString(36).substr(2, 9)}`;
  const titleId = `${cardId}-title`;
  const problemId = `${cardId}-problem`;
  const solutionId = `${cardId}-solution`;

  return (
    <Card
      role="article"
      aria-labelledby={titleId}
      aria-describedby={`${problemId} ${solutionId}`}
      clickable={!!onView}
    >
      <CardTitle id={titleId}>{title}</CardTitle>
      <p id={problemId}>{problem}</p>
      <p id={solutionId}>{solution}</p>
    </Card>
  );
});
```

#### Key Features:
- Semantic HTML5 structure
- Proper heading hierarchy
- ARIA relationships between elements
- Keyboard navigation support
- Action button accessibility

### Form Components (`/src/renderer/components/forms/KBEntryForm.tsx`)

#### Enhancements Made:

```typescript
// Comprehensive form accessibility
<form
  role="form"
  aria-label={mode === 'create' ? 'Add new knowledge entry' : 'Edit knowledge entry'}
  noValidate
>
  {/* Advanced options with proper disclosure */}
  <button
    aria-expanded={showAdvanced}
    aria-controls="advanced-options"
    aria-label={showAdvanced ? 'Hide advanced options' : 'Show advanced options'}
  >

  <div
    id="advanced-options"
    role="region"
    aria-label="Advanced options"
  >
    {/* Advanced form fields */}
  </div>

  {/* Tags with proper list semantics */}
  <div className="kb-entry-form__tags-list" role="list" aria-label="Current tags">
    {tags.map((tag) => (
      <span key={tag} role="listitem">
        {tag}
        <button aria-label={`Remove tag: ${tag}`}>×</button>
      </span>
    ))}
  </div>

  {/* Error summary with proper alert */}
  <div
    role="alert"
    aria-live="assertive"
    aria-labelledby="error-summary-title"
  >
    <strong id="error-summary-title">Please correct the following errors:</strong>
    {/* Error list */}
  </div>
</form>
```

#### Key Features:
- Form landmark with proper labeling
- Live region error announcements
- Progressive disclosure for advanced options
- Tag management with list semantics
- Keyboard shortcuts with help

### Search Interface (`/src/renderer/components/search/SearchInterface.tsx`)

#### Enhancements Made:

```typescript
// Main search interface with proper landmarks
<main className="search-interface" role="main" aria-label="Knowledge base search">
  {/* Advanced search toggle */}
  <button
    aria-pressed={state.showAdvanced}
    aria-expanded={state.showAdvanced}
    aria-controls="advanced-search-panel"
    aria-label={`${state.showAdvanced ? 'Hide' : 'Show'} advanced search options`}
  >
    Advanced
    {state.activeFilters > 0 && (
      <span aria-label={`${state.activeFilters} active filters`}>
        {state.activeFilters}
      </span>
    )}
  </button>

  {/* Advanced search panel */}
  <div
    id="advanced-search-panel"
    role="region"
    aria-label="Advanced search options"
  >
    <QueryBuilder />
  </div>

  {/* Search results section */}
  <section className="search-interface__results" aria-label="Search results">
    <SearchResults />
  </section>

  {/* Sidebar navigation */}
  <aside className="search-interface__sidebar" aria-label="Search history and analytics">
    <SearchHistory />
  </aside>
</main>
```

#### Key Features:
- Proper landmark usage (`main`, `section`, `aside`)
- Search state announcements
- Filter badge accessibility
- Results navigation
- Loading state management

## ARIA Patterns

### Reusable Pattern Library (`/src/renderer/components/accessibility/AriaPatterns.tsx`)

#### Available Patterns:

1. **Disclosure Pattern** - For collapsible content
2. **Combobox Pattern** - For autocomplete and select components
3. **Tabs Pattern** - For tab navigation
4. **Menu Pattern** - For dropdown menus
5. **Modal Pattern** - For dialog boxes

#### Usage Examples:

```tsx
// Disclosure Pattern
<Disclosure defaultExpanded={false}>
  {({ isExpanded, triggerProps, contentProps }) => (
    <>
      <button {...triggerProps}>
        {isExpanded ? 'Hide' : 'Show'} Details
      </button>
      <div {...contentProps}>
        Content that can be expanded/collapsed
      </div>
    </>
  )}
</Disclosure>

// Combobox Pattern
<Combobox
  options={searchSuggestions}
  getOptionLabel={option => option.text}
  getOptionValue={option => option.value}
  onSelect={handleSelect}
>
  {({ inputProps, listboxProps, optionProps }) => (
    <>
      <input {...inputProps} placeholder="Search..." />
      <ul {...listboxProps}>
        {filteredOptions.map((option, index) => (
          <li key={option.value} {...optionProps(option, index)}>
            {option.text}
          </li>
        ))}
      </ul>
    </>
  )}
</Combobox>
```

## Testing Tools

### Accessibility Checker (`/src/renderer/components/accessibility/AccessibilityChecker.tsx`)

#### Features:
- Real-time accessibility auditing
- Visual issue highlighting
- Detailed error reporting
- Development-only component
- Automated checking with manual override

#### Usage:

```tsx
// Add to your development build
import AccessibilityChecker from './components/accessibility/AccessibilityChecker';

function App() {
  return (
    <div>
      {/* Your app content */}

      {process.env.NODE_ENV === 'development' && (
        <AccessibilityChecker
          showInline={true}
          onIssuesFound={(issues) => {
            console.log('Accessibility issues found:', issues);
          }}
        />
      )}
    </div>
  );
}
```

#### Testing Hook:

```tsx
// Use in components for testing
import { useAccessibilityChecker } from './AccessibilityChecker';

function MyComponent() {
  const ref = useRef<HTMLDivElement>(null);
  const { issues, checkAccessibility, hasErrors, score } = useAccessibilityChecker(ref.current);

  useEffect(() => {
    checkAccessibility();
  }, []);

  return (
    <div ref={ref}>
      {/* Component content */}
      {hasErrors && <div>Accessibility issues detected!</div>}
    </div>
  );
}
```

## Best Practices

### 1. Semantic HTML First

Always use semantic HTML5 elements before adding ARIA:

```tsx
// Good - Semantic HTML
<nav aria-label="Main navigation">
  <ul>
    <li><a href="/search">Search</a></li>
    <li><a href="/entries">Entries</a></li>
  </ul>
</nav>

// Avoid - Divs with ARIA when semantic elements exist
<div role="navigation" aria-label="Main navigation">
  <div role="list">
    <div role="listitem"><div role="link">Search</div></div>
  </div>
</div>
```

### 2. Progressive Enhancement

Build accessible features that work without JavaScript:

```tsx
// Form validation that works without JS
<input
  required
  pattern="[a-zA-Z0-9]+"
  aria-describedby="title-error"
  title="Only letters and numbers allowed"
/>
<div id="title-error" role="alert">
  {/* Error message injected by React */}
</div>
```

### 3. Focus Management

Properly manage focus for dynamic content:

```tsx
function Modal({ isOpen, onClose }) {
  const modalRef = useRef();
  const previousFocus = useRef();

  useEffect(() => {
    if (isOpen) {
      previousFocus.current = document.activeElement;
      modalRef.current?.focus();
    } else {
      previousFocus.current?.focus();
    }
  }, [isOpen]);

  // Focus trap implementation...
}
```

### 4. Live Region Announcements

Use live regions for dynamic content changes:

```tsx
import { LiveRegionManager } from '../utils/accessibility';

function SearchResults({ results, isLoading }) {
  const liveRegion = LiveRegionManager.getInstance();

  useEffect(() => {
    if (!isLoading && results) {
      liveRegion.announce(
        `Found ${results.length} results`,
        'polite'
      );
    }
  }, [results, isLoading]);

  // Component render...
}
```

### 5. Keyboard Navigation

Implement proper keyboard support:

```tsx
function MenuButton({ items }) {
  const [activeIndex, setActiveIndex] = useState(-1);

  const handleKeyDown = (event) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setActiveIndex(prev =>
          prev < items.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        event.preventDefault();
        setActiveIndex(prev =>
          prev > 0 ? prev - 1 : items.length - 1
        );
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        items[activeIndex]?.onClick();
        break;
      case 'Escape':
        closeMenu();
        break;
    }
  };

  // Component implementation...
}
```

## Validation

### Automated Testing

Run accessibility tests in your test suite:

```typescript
// In your Jest tests
import { AccessibilityTester } from '../utils/accessibility';

test('button has accessible name', () => {
  render(<Button>Save</Button>);
  const button = screen.getByRole('button');

  const audit = AccessibilityTester.audit(button);
  expect(audit.errors).toHaveLength(0);
  expect(audit.score).toBeGreaterThan(90);
});

// Test ARIA attributes
test('modal has proper dialog semantics', () => {
  render(<Modal isOpen={true}>Content</Modal>);

  const dialog = screen.getByRole('dialog');
  expect(dialog).toHaveAttribute('aria-modal', 'true');
  expect(dialog).toHaveAttribute('aria-labelledby');
});
```

### Manual Testing Checklist

- [ ] All interactive elements are keyboard accessible
- [ ] Focus indicators are visible and high contrast
- [ ] Screen reader can navigate all content
- [ ] Form errors are announced properly
- [ ] Loading states are communicated
- [ ] Modal focus is trapped correctly
- [ ] Live regions announce changes appropriately
- [ ] All images have appropriate alt text
- [ ] Color is not the only way to convey information
- [ ] Text meets contrast requirements (4.5:1 for normal text)

### Browser Testing

Test with actual assistive technologies:

1. **Screen Readers:**
   - NVDA (Windows, free)
   - JAWS (Windows, paid)
   - VoiceOver (macOS/iOS, built-in)
   - TalkBack (Android, built-in)

2. **Keyboard Navigation:**
   - Tab through all interactive elements
   - Use arrow keys for menus and lists
   - Test Escape key functionality
   - Verify Enter/Space activate buttons

3. **Browser Extensions:**
   - axe DevTools
   - WAVE Web Accessibility Evaluator
   - Lighthouse accessibility audit

### Continuous Integration

Add accessibility testing to your CI pipeline:

```yaml
# In your GitHub Actions workflow
- name: Run accessibility tests
  run: |
    npm run test:a11y
    npm run lighthouse:a11y
```

## Conclusion

This comprehensive ARIA implementation provides:

✅ **WCAG 2.1 AA Compliance** - All components meet accessibility standards
✅ **Keyboard Navigation** - Full keyboard support for all interactive elements
✅ **Screen Reader Support** - Proper semantics and announcements
✅ **Focus Management** - Logical focus flow and trapping
✅ **Error Handling** - Accessible form validation and error reporting
✅ **Live Updates** - Dynamic content changes announced appropriately
✅ **Testing Tools** - Built-in development aids for validation
✅ **Reusable Patterns** - Consistent accessibility patterns across components

The implementation ensures that the Mainframe AI Assistant is fully accessible to users with disabilities, providing an inclusive experience that meets enterprise accessibility requirements.