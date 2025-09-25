# Design System - Mainframe KB Assistant

A comprehensive, modular design system built with CSS custom properties for
consistency, maintainability, and accessibility.

## 🎨 System Overview

The design system is organized into modular CSS files that work together to
provide a cohesive visual language:

```
src/styles/
├── index.css              # Main entry point and base utilities
├── spacing-system.css      # 4px-based spacing scale with utilities
├── typography.css          # Responsive type scale and text styles
├── visual-hierarchy.css    # Z-index layers, shadows, and depth
├── density-variants.css    # Compact/comfortable/spacious modes
└── responsive-grid.css     # Grid system (existing)
```

## 🏗️ Architecture

### CSS Custom Properties

All design tokens use CSS custom properties for:

- **Theming support** (light/dark mode)
- **Runtime customization** (density modes)
- **Consistent scaling** across components
- **Easy maintenance** and updates

### Progressive Enhancement

- **Mobile-first** responsive design
- **Accessibility-first** approach
- **Performance-optimized** with efficient selectors
- **Modern CSS** with fallbacks for older browsers

## 📏 Spacing System

Based on a **4px grid** for pixel-perfect alignment across all screen sizes.

### Core Scale

```css
--spacing-1: 4px /* xs */ --spacing-2: 8px --spacing-3: 12px /* sm */
  --spacing-4: 16px /* md */ --spacing-6: 24px /* lg */ --spacing-8: 32px
  /* xl */;
```

### Semantic Tokens

```css
--spacing-xs: 4px /* Tight spacing */ --spacing-sm: 12px /* Small spacing */
  --spacing-md: 16px /* Default spacing */ --spacing-lg: 24px
  /* Large spacing */ --spacing-xl: 32px /* Extra large spacing */;
```

### Usage Examples

```css
/* Utility classes */
.p-md {
  padding: var(--spacing-md);
}
.m-lg {
  margin: var(--spacing-lg);
}
.gap-sm {
  gap: var(--spacing-sm);
}

/* Component spacing */
.card {
  padding: var(--component-padding-md);
}
.container {
  padding: var(--container-padding-lg);
}
```

## 🔤 Typography System

Fluid, responsive typography using `clamp()` functions for optimal reading
experience.

### Responsive Scale

```css
--font-size-xs: clamp(0.75rem, 0.69rem + 0.31vw, 0.875rem) /* 12px → 14px */
  --font-size-sm: clamp(0.875rem, 0.81rem + 0.31vw, 1rem) /* 14px → 16px */
  --font-size-base: clamp(1rem, 0.94rem + 0.31vw, 1.125rem) /* 16px → 18px */
  --font-size-lg: clamp(1.125rem, 1.06rem + 0.31vw, 1.25rem) /* 18px → 20px */
  --font-size-xl: clamp(1.25rem, 1.19rem + 0.31vw, 1.375rem) /* 20px → 22px */;
```

### Semantic Styles

```css
.heading-primary    /* Large headings */
.heading-secondary  /* Section headings */
.body-default      /* Body text */
.body-small        /* Secondary text */
.label-large       /* Form labels */
.code              /* Inline code */
```

### Usage Examples

```html
<h1 class="heading-primary">Knowledge Base</h1>
<p class="body-default">Search for solutions...</p>
<label class="label-large">Search Query</label>
<code class="code">VSAM STATUS 35</code>
```

## 🏔️ Visual Hierarchy

Consistent layering, depth, and focus management for clear visual hierarchy.

### Z-Index Scale

```css
--z-index-base: 0 /* Base content */ --z-index-raised: 10 /* Elevated content */
  --z-index-floating: 30 /* Floating elements */ --z-index-overlay: 40
  /* Overlay backgrounds */ --z-index-modal: 50 /* Modal dialogs */
  --z-index-tooltip: 70 /* Tooltips */ --z-index-maximum: 100
  /* Highest priority */;
```

### Shadow System

```css
--shadow-xs:
  0 1px 2px rgba(0, 0, 0, 0.05) /* Subtle */ --shadow-sm: 0 1px 3px
    rgba(0, 0, 0, 0.1),
  0 1px 2px rgba(0, 0, 0, 0.06) --shadow-md: 0 10px 15px rgba(0, 0, 0, 0.1),
  0 4px 6px rgba(0, 0, 0, 0.05) --shadow-lg: 0 20px 25px rgba(0, 0, 0, 0.1),
  0 10px 10px rgba(0, 0, 0, 0.04);
```

### Usage Examples

```css
.surface-raised {
  background: var(--surface-raised);
  box-shadow: var(--shadow-xs);
  z-index: var(--z-index-raised);
}

.modal-content {
  background: var(--surface-modal);
  box-shadow: var(--shadow-xl);
  z-index: var(--z-index-modal);
}
```

## 📱 Density Variants

Three density modes for different user preferences and screen sizes.

### Density Modes

#### Compact (`data-density="compact"`)

- **Use case**: High information density, mobile devices
- **Spacing**: 75% of default
- **Typography**: Smaller sizes, tighter line heights
- **Components**: Minimal padding, smaller touch targets

#### Comfortable (`data-density="comfortable"`)

- **Use case**: Default mode, balanced density
- **Spacing**: Standard scale
- **Typography**: Optimal reading sizes
- **Components**: Standard sizing

#### Spacious (`data-density="spacious"`)

- **Use case**: Accessibility, large screens
- **Spacing**: 125% of default
- **Typography**: Larger sizes, generous line heights
- **Components**: Large touch targets, generous padding

### Implementation

```html
<!-- Set density on root element -->
<body data-density="compact">
  <div class="card">Content adapts automatically</div>
</body>

<!-- Or use utility classes -->
<div class="density-spacious">
  <button class="btn">Large button</button>
</div>
```

## 🎛️ Usage Guide

### 1. Import the System

```css
@import './styles/index.css';
```

### 2. Set Density Mode

```javascript
// Set application density
document.body.setAttribute('data-density', 'comfortable');

// Toggle density
function setDensity(mode) {
  document.body.setAttribute('data-density', mode);
}
```

### 3. Use Utility Classes

```html
<!-- Spacing -->
<div class="p-md m-lg gap-sm">
  <!-- Typography -->
  <h2 class="text-2xl font-semibold text-primary">
    <!-- Layout -->
    <div class="flex items-center justify-between">
      <!-- Surface layers -->
      <div class="surface-elevated shadow-md"></div>
    </div>
  </h2>
</div>
```

### 4. Create Custom Components

```css
.knowledge-card {
  /* Use design tokens */
  padding: var(--component-padding-lg);
  margin-bottom: var(--spacing-md);
  background: var(--surface-raised);
  box-shadow: var(--shadow-sm);
  border-radius: 0.5rem;

  /* Typography */
  font-size: var(--font-size-base);
  line-height: var(--line-height-normal);
  color: var(--text-primary);

  /* Responsive */
  @media (min-width: 768px) {
    padding: var(--component-padding-xl);
  }
}
```

## 🎨 Theming

The system supports light/dark mode through CSS custom properties:

```css
:root {
  --surface-base: #ffffff;
  --text-primary: #1a1a1a;
}

@media (prefers-color-scheme: dark) {
  :root {
    --surface-base: #111827;
    --text-primary: #f9fafb;
  }
}
```

## ♿ Accessibility Features

### Focus Management

- **Consistent focus rings** across all interactive elements
- **High contrast support** with enhanced borders
- **Keyboard navigation** optimized
- **Screen reader support** with utility classes

### Motion Preferences

- **Respects `prefers-reduced-motion`**
- **Graceful degradation** for animations
- **Performance optimizations** for transitions

### Touch Accessibility

- **Minimum 44px touch targets** on touch devices
- **Generous spacing** in spacious mode
- **Clear visual hierarchy** for better navigation

## 🔧 Customization

### Override Design Tokens

```css
:root {
  /* Custom spacing scale */
  --spacing-base: 6px; /* Change from 4px to 6px */

  /* Custom colors */
  --text-primary: #2d3748;
  --surface-raised: #f7fafc;

  /* Custom typography */
  --font-family-system: 'Inter', system-ui, sans-serif;
}
```

### Add Custom Density Mode

```css
[data-density='extra-compact'] {
  --spacing-xs: 1px;
  --spacing-sm: 4px;
  --spacing-md: 6px;
  --component-padding-sm: 2px;
  --component-padding-md: 4px;
}
```

## 📊 Performance Notes

- **CSS custom properties** are efficiently updated by browsers
- **Utility classes** reduce CSS specificity conflicts
- **Modular imports** allow tree-shaking unused styles
- **Minimal runtime overhead** for density switching

## 🧪 Testing

The design system includes considerations for:

- **Visual regression testing** with consistent tokens
- **Accessibility testing** with focus management
- **Cross-browser compatibility** with fallbacks
- **Performance testing** with optimized selectors

## 🚀 Migration Guide

### From Inline Styles

```css
/* Before */
.component {
  padding: 16px;
  margin: 24px 0;
  font-size: 14px;
}

/* After */
.component {
  padding: var(--component-padding-lg);
  margin: var(--spacing-lg) 0;
  font-size: var(--font-size-sm);
}
```

### From Fixed Values

```css
/* Before */
.card {
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  border-radius: 8px;
}

/* After */
.card {
  box-shadow: var(--shadow-md);
  border-radius: 0.5rem;
}
```

## 📚 Examples

### Knowledge Base Entry Card

```html
<article class="surface-raised shadow-md rounded-lg p-lg m-md">
  <header class="mb-sm">
    <h3 class="heading-secondary">VSAM Status 35 Error</h3>
    <p class="body-small text-secondary">Category: VSAM</p>
  </header>

  <div class="stack-sm">
    <section>
      <h4 class="label-large">Problem</h4>
      <p class="body-default">Job abends with VSAM status code 35...</p>
    </section>

    <section>
      <h4 class="label-large">Solution</h4>
      <ol class="body-default">
        <li>Check dataset exists</li>
        <li>Verify permissions</li>
      </ol>
    </section>
  </div>
</article>
```

### Search Interface

```html
<div class="container-lg p-container-md">
  <div class="stack-lg">
    <header class="text-center">
      <h1 class="display-large">Knowledge Base</h1>
      <p class="body-large text-secondary">Find solutions quickly</p>
    </header>

    <div class="surface-elevated rounded-xl p-lg">
      <div class="stack-md">
        <input
          type="search"
          class="w-full"
          placeholder="Search for errors, codes, or solutions..."
        />

        <div class="cluster-sm">
          <span class="label-default">Quick filters:</span>
          <button class="btn-secondary btn-sm">JCL</button>
          <button class="btn-secondary btn-sm">VSAM</button>
          <button class="btn-secondary btn-sm">DB2</button>
        </div>
      </div>
    </div>
  </div>
</div>
```

This design system provides a solid foundation for consistent, accessible, and
maintainable UI development across the Mainframe KB Assistant application.
