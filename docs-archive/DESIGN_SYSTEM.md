# Mainframe KB Assistant - Design System Documentation

**Version:** 1.0.0
**WCAG Compliance:** 2.1 AA
**Last Updated:** January 2025

## Table of Contents

1. [Overview](#overview)
2. [Design Principles](#design-principles)
3. [Design Tokens](#design-tokens)
4. [Typography](#typography)
5. [Color System](#color-system)
6. [Spacing & Layout](#spacing--layout)
7. [Components](#components)
8. [Accessibility](#accessibility)
9. [Theming](#theming)
10. [Usage Guidelines](#usage-guidelines)
11. [Implementation](#implementation)

## Overview

The Mainframe KB Assistant Design System provides a comprehensive foundation for building consistent, accessible, and professional user interfaces optimized for mainframe support teams.

### Goals

- **Consistency**: Ensure visual and functional consistency across all interfaces
- **Accessibility**: Meet WCAG 2.1 AA compliance standards
- **Efficiency**: Enable rapid development with reusable components
- **Professionalism**: Maintain enterprise-grade appearance and behavior
- **Performance**: Optimize for fast rendering and minimal resource usage

### Architecture

The design system is built using:
- **CSS Custom Properties** for design tokens
- **BEM Methodology** for class naming
- **Progressive Enhancement** for accessibility
- **Mobile-First** responsive design principles

## Design Principles

### 1. Professional First
- Enterprise-ready appearance suitable for critical business operations
- Clean, uncluttered interfaces that reduce cognitive load
- High contrast ratios for extended viewing sessions

### 2. Accessibility by Default
- WCAG 2.1 AA compliance built into every component
- Keyboard navigation support throughout
- Screen reader optimized content structure

### 3. Performance Conscious
- System fonts for fast loading and native feel
- Minimal CSS footprint with efficient selectors
- Optimized animations and transitions

### 4. Context Aware
- Designed specifically for mainframe support workflows
- Quick information scanning and error identification
- Offline-capable appearance patterns

## Design Tokens

Design tokens are stored as CSS custom properties in `/src/renderer/styles/design-system.css`.

### Color Tokens

```css
/* Primary Brand Colors */
--color-primary-500: #3b82f6;    /* Main brand color */
--color-primary-600: #2563eb;    /* Primary action color */

/* Semantic Colors */
--color-success-600: #16a34a;    /* Success states */
--color-warning-500: #f59e0b;    /* Warning states */
--color-error-600: #dc2626;      /* Error states */

/* Surface Colors */
--color-background-primary: #ffffff;
--color-surface-primary: #ffffff;
--color-text-primary: #1f2937;
```

### Typography Tokens

```css
/* Font Families */
--font-family-system: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
--font-family-mono: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;

/* Font Sizes (Modular Scale 1.250) */
--font-size-xs: 0.75rem;     /* 12px */
--font-size-sm: 0.875rem;    /* 14px */
--font-size-base: 1rem;      /* 16px */
--font-size-lg: 1.125rem;    /* 18px */
--font-size-xl: 1.25rem;     /* 20px */
```

### Spacing Tokens

```css
/* Spacing Scale (4px base unit) */
--space-1: 0.25rem;    /* 4px */
--space-2: 0.5rem;     /* 8px */
--space-3: 0.75rem;    /* 12px */
--space-4: 1rem;       /* 16px */
--space-6: 1.5rem;     /* 24px */
--space-8: 2rem;       /* 32px */
```

## Typography

### Type Scale

The typography system uses a modular scale (1.250 ratio) for consistent hierarchy:

| Size | Token | Value | Usage |
|------|--------|--------|-------|
| XS | `--font-size-xs` | 12px | Captions, metadata |
| SM | `--font-size-sm` | 14px | Body text, labels |
| Base | `--font-size-base` | 16px | Default body text |
| LG | `--font-size-lg` | 18px | Large body text |
| XL | `--font-size-xl` | 20px | Headings |
| 2XL | `--font-size-2xl` | 24px | Page titles |

### Font Weights

| Weight | Token | Value | Usage |
|--------|--------|--------|-------|
| Normal | `--font-weight-normal` | 400 | Body text |
| Medium | `--font-weight-medium` | 500 | Labels, buttons |
| Semibold | `--font-weight-semibold` | 600 | Headings |
| Bold | `--font-weight-bold` | 700 | Important text |

### Usage Examples

```css
/* Heading styles */
.heading-primary {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-semibold);
  line-height: var(--line-height-tight);
  color: var(--color-text-primary);
}

/* Body text */
.text-body {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-normal);
  line-height: var(--line-height-normal);
  color: var(--color-text-primary);
}
```

## Color System

### Brand Colors

**Primary Blue**: Professional, trustworthy, enterprise-appropriate
- Used for: Primary actions, links, focus states
- Contrast ratio: 4.5:1+ against white backgrounds

**Success Green**: Clear indication of positive outcomes
- Used for: Success messages, completed states
- Ensures differentiation from error states

**Warning Amber**: Attention-grabbing without alarm
- Used for: Cautions, pattern alerts
- Balances visibility with appropriate urgency

**Error Red**: Clear danger indication
- Used for: Error states, critical alerts
- High contrast for immediate recognition

### Semantic Color Usage

```css
/* Success States */
.success-indicator {
  background-color: var(--status-success-bg);
  color: var(--status-success-text);
  border: 1px solid var(--status-success-border);
}

/* Error States */
.error-indicator {
  background-color: var(--status-error-bg);
  color: var(--status-error-text);
  border: 1px solid var(--status-error-border);
}
```

### Accessibility Considerations

- All colors meet WCAG 2.1 AA contrast requirements
- Color is never the only indicator of state or information
- High contrast variants available for accessibility needs
- Colorblind-friendly palette selection

## Spacing & Layout

### Spacing Scale

The spacing system uses a 4px base unit for consistent rhythm:

```css
/* Common spacing patterns */
.card-spacing {
  padding: var(--space-6);        /* 24px - comfortable card padding */
  margin-bottom: var(--space-4);  /* 16px - consistent card separation */
}

.form-spacing {
  gap: var(--space-3);            /* 12px - form field separation */
  margin-bottom: var(--space-6);  /* 24px - form section separation */
}
```

### Container Sizes

```css
/* Max-width containers */
--container-sm: 24rem;    /* 384px - Small content */
--container-md: 28rem;    /* 448px - Forms, modals */
--container-lg: 32rem;    /* 512px - Main content */
--container-xl: 36rem;    /* 576px - Wide content */
```

### Layout Patterns

```css
/* Search interface layout */
.search-layout {
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: var(--space-6);
  max-width: var(--container-7xl);
}

/* Card grid layout */
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: var(--space-4);
}
```

## Components

### Button System

The button system provides consistent interactive elements across the application.

#### Base Button

```html
<button class="btn btn--primary">Primary Action</button>
<button class="btn btn--secondary">Secondary Action</button>
<button class="btn btn--ghost">Tertiary Action</button>
<button class="btn btn--danger">Destructive Action</button>
```

#### Button Sizes

```html
<button class="btn btn--primary btn--sm">Small</button>
<button class="btn btn--primary">Default</button>
<button class="btn btn--primary btn--lg">Large</button>
<button class="btn btn--primary btn--xl">Extra Large</button>
```

#### Icon Buttons

```html
<button class="btn btn--icon btn--secondary" aria-label="Search">
  <svg><!-- search icon --></svg>
</button>
```

#### Accessibility Features

- Minimum 44px touch target on mobile
- Focus visible indicators
- Disabled state handling
- Screen reader support

### Card System

Cards organize related information in scannable containers.

```html
<div class="card">
  <div class="card__header">
    <h3 class="card__title">KB Entry Title</h3>
    <span class="card__subtitle">Category: VSAM</span>
  </div>
  <div class="card__body">
    <p>Knowledge base entry content...</p>
  </div>
  <div class="card__footer">
    <div class="badge badge--success">Success Rate: 95%</div>
    <button class="btn btn--sm btn--secondary">View Details</button>
  </div>
</div>
```

#### Card Variants

```html
<!-- Interactive card -->
<div class="card card--interactive" tabindex="0" role="button">
  <!-- card content -->
</div>

<!-- Status cards -->
<div class="card card--success"><!-- Success state --></div>
<div class="card card--warning"><!-- Warning state --></div>
<div class="card card--error"><!-- Error state --></div>
```

### Form System

Consistent form components with built-in validation and accessibility.

```html
<div class="form-field">
  <label class="form-label form-label--required" for="title">
    Entry Title
  </label>
  <input
    class="form-input"
    type="text"
    id="title"
    required
    aria-describedby="title-help"
  >
  <div class="form-help" id="title-help">
    Enter a descriptive title for the knowledge entry
  </div>
</div>
```

#### Error States

```html
<div class="form-field form-field--error">
  <label class="form-label form-label--required" for="problem">
    Problem Description
  </label>
  <textarea
    class="form-textarea"
    id="problem"
    aria-invalid="true"
    aria-describedby="problem-error"
  ></textarea>
  <div class="form-error" role="alert" id="problem-error">
    Problem description is required
  </div>
</div>
```

### Badge System

Badges communicate status, categories, and metadata.

```html
<span class="badge badge--primary">VSAM</span>
<span class="badge badge--success">Resolved</span>
<span class="badge badge--warning">Pattern Detected</span>
<span class="badge badge--error">Critical</span>
```

### Modal System

Accessible modal dialogs for focused interactions.

```html
<div class="modal-backdrop">
  <div class="modal" role="dialog" aria-labelledby="modal-title" aria-describedby="modal-content">
    <div class="modal__header">
      <h2 class="modal__title" id="modal-title">Add Knowledge Entry</h2>
      <button class="modal__close" aria-label="Close dialog">
        <svg><!-- close icon --></svg>
      </button>
    </div>
    <div class="modal__body" id="modal-content">
      <!-- modal content -->
    </div>
    <div class="modal__footer">
      <button class="btn btn--secondary">Cancel</button>
      <button class="btn btn--primary">Save Entry</button>
    </div>
  </div>
</div>
```

### Toast Notifications

Non-intrusive feedback system.

```html
<div class="toast-container">
  <div class="toast toast--success" role="alert">
    <div class="toast__icon">✓</div>
    <div class="toast__content">
      <div class="toast__title">Success</div>
      <div class="toast__message">Knowledge entry saved successfully</div>
    </div>
    <button class="toast__close" aria-label="Dismiss notification">×</button>
  </div>
</div>
```

## Accessibility

### Focus Management

The design system provides comprehensive focus management:

```css
/* Base focus styles */
*:focus {
  outline: var(--focus-ring-width) var(--focus-ring-style) var(--focus-ring-color);
  outline-offset: var(--focus-ring-offset);
}

/* Enhanced focus for interactive elements */
button:focus,
a:focus,
input:focus {
  outline: var(--focus-ring-width) var(--focus-ring-style) var(--focus-ring-color);
  outline-offset: var(--focus-ring-offset);
  box-shadow: var(--shadow-focus);
}
```

### Skip Links

Essential navigation shortcuts for keyboard users:

```html
<div class="skip-links">
  <a class="skip-link" href="#main-content">Skip to main content</a>
  <a class="skip-link" href="#navigation">Skip to navigation</a>
  <a class="skip-link" href="#search">Skip to search</a>
</div>
```

### Screen Reader Support

```html
<!-- Live regions for dynamic content -->
<div aria-live="polite" class="sr-only">
  Search completed. Found 12 results.
</div>

<!-- Hidden labels for context -->
<button class="btn btn--icon" aria-label="Search knowledge base">
  <svg aria-hidden="true"><!-- search icon --></svg>
</button>

<!-- Status indicators -->
<div class="status-indicator--success" aria-label="Successfully resolved">
  <span aria-hidden="true">✓</span>
  Resolved
</div>
```

### High Contrast Support

The system automatically adapts to high contrast preferences:

```css
@media (prefers-contrast: high) {
  :root {
    --color-border-primary: var(--color-black);
    --focus-ring-width: 3px;
  }

  .btn {
    border-width: 2px;
  }
}
```

### Reduced Motion Support

Respects user motion preferences:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

## Theming

### Theme System

The design system supports multiple themes:

- **Light Theme** (default): Optimal for well-lit environments
- **Dark Theme**: Reduces eye strain in low-light conditions
- **High Contrast**: Enhanced accessibility for vision needs
- **System**: Automatically matches user's system preference

### Theme Implementation

```html
<!-- Theme attributes -->
<body data-theme="dark">
<body data-theme="light">
<body data-theme="dark-hc">
<body data-contrast="high">
```

### Theme Toggle Component

```html
<button class="theme-toggle" aria-label="Toggle dark mode">
  <span class="sr-only">Current theme: Light</span>
</button>
```

### Custom Theme Variables

```css
[data-theme="dark"] {
  --color-background-primary: #111827;
  --color-text-primary: #f9fafb;
  --color-surface-primary: #1f2937;
  /* ... other dark theme variables */
}
```

## Usage Guidelines

### Component Composition

```html
<!-- Good: Proper semantic structure -->
<article class="card card--interactive">
  <header class="card__header">
    <h3 class="card__title">VSAM Status 35 Error</h3>
    <div class="badge badge--warning">Pattern Alert</div>
  </header>
  <div class="card__body">
    <p>Multiple incidents detected with VSAM Status 35...</p>
  </div>
  <footer class="card__footer">
    <button class="btn btn--primary btn--sm">View Details</button>
  </footer>
</article>
```

### Color Usage

```css
/* Good: Use semantic color tokens */
.error-state {
  background-color: var(--status-error-bg);
  color: var(--status-error-text);
}

/* Avoid: Direct color values */
.error-state {
  background-color: #fee2e2; /* Don't use direct colors */
}
```

### Spacing Consistency

```css
/* Good: Use spacing tokens */
.content-section {
  padding: var(--space-6);
  margin-bottom: var(--space-4);
}

/* Avoid: Arbitrary spacing values */
.content-section {
  padding: 22px; /* Don't use arbitrary values */
}
```

## Implementation

### File Structure

```
src/renderer/styles/
├── design-system.css      # Design tokens and foundation
├── components.css         # Component styles
├── themes.css            # Theme implementations
└── accessibility.css     # Accessibility features
```

### Import Order

```css
/* In your main CSS file */
@import './design-system.css';  /* First: Design tokens */
@import './themes.css';         /* Second: Theme system */
@import './accessibility.css';  /* Third: Accessibility */
@import './components.css';     /* Fourth: Components */
```

### Usage in Components

```tsx
// React component example
import './SearchInterface.css';

export function SearchInterface() {
  return (
    <div className="search-interface">
      <div className="search-interface__header">
        <div className="form-field">
          <label className="form-label" htmlFor="search">
            Search Knowledge Base
          </label>
          <input
            className="form-input"
            type="search"
            id="search"
            placeholder="Enter keywords, error codes, or descriptions..."
          />
        </div>
      </div>

      <div className="search-interface__content">
        <main className="search-interface__results">
          {/* Search results */}
        </main>
        <aside className="search-interface__sidebar">
          {/* Filters and analytics */}
        </aside>
      </div>
    </div>
  );
}
```

### Testing Guidelines

1. **Keyboard Navigation**: Ensure all interactive elements are keyboard accessible
2. **Screen Reader**: Test with screen reader software
3. **Color Contrast**: Verify all text meets WCAG contrast requirements
4. **Responsive**: Test across different screen sizes
5. **Theme Switching**: Verify all themes work correctly
6. **High Contrast**: Test with system high contrast mode enabled

### Performance Considerations

- Use CSS custom properties for theme switching efficiency
- Minimize CSS specificity conflicts
- Leverage system fonts for fast loading
- Optimize animations for 60fps performance
- Use efficient selectors to minimize recalculation

## Browser Support

- **Chrome**: 88+
- **Firefox**: 85+
- **Safari**: 14+
- **Edge**: 88+

CSS Custom Properties and modern features are required. The system does not support Internet Explorer.

## Contributing

When adding new components or patterns:

1. Follow existing naming conventions
2. Use design tokens for all values
3. Include accessibility features by default
4. Test across all supported themes
5. Document usage examples
6. Ensure WCAG 2.1 AA compliance

## Changelog

### Version 1.0.0 (January 2025)
- Initial design system release
- Complete component library
- Theme system implementation
- WCAG 2.1 AA compliance
- Comprehensive accessibility features

---

**Maintained by:** UI/UX Team
**Questions?** Create an issue in the project repository