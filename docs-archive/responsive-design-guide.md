# Responsive Design System Guide

A comprehensive guide to the enhanced responsive design system for the Mainframe AI Assistant interface.

## Overview

This responsive design system provides a modern, mobile-first approach to creating interfaces that work seamlessly across all device types. It includes advanced features like container queries, fluid typography, touch optimizations, and comprehensive accessibility support.

## Key Features

- **Mobile-First Design**: Progressive enhancement from mobile to desktop
- **Container Queries**: Context-aware responsive behavior
- **Fluid Typography**: Smooth scaling text across all screen sizes
- **Touch Optimization**: Enhanced interactions for touch devices
- **Accessibility**: WCAG 2.1 AA compliant patterns
- **Modern CSS**: Uses latest CSS features with progressive enhancement

## Breakpoint Strategy

### Standard Breakpoints

```css
/* Mobile-first breakpoints */
--breakpoint-xs: 320px;    /* Small mobile */
--breakpoint-sm: 640px;    /* Large mobile */
--breakpoint-md: 768px;    /* Tablet */
--breakpoint-lg: 1024px;   /* Small desktop */
--breakpoint-xl: 1280px;   /* Desktop */
--breakpoint-2xl: 1536px;  /* Large desktop */
--breakpoint-3xl: 1920px;  /* Ultra-wide */
```

### Usage Guidelines

1. **Design mobile-first**: Start with mobile styles, then enhance for larger screens
2. **Use logical breakpoints**: Based on content needs, not device sizes
3. **Test at all sizes**: Ensure smooth transitions between breakpoints
4. **Consider container queries**: For component-level responsive behavior

## Typography System

### Fluid Typography

The system uses `clamp()` functions for smooth text scaling:

```css
/* Fluid text sizes */
--fluid-text-base: clamp(0.9rem, 0.83rem + 0.35vw, 1rem);
--fluid-text-lg: clamp(1rem, 0.91rem + 0.45vw, 1.125rem);
--fluid-text-xl: clamp(1.1rem, 0.98rem + 0.6vw, 1.25rem);
```

### Implementation

```html
<h1 style="font-size: var(--fluid-text-3xl)">Responsive Heading</h1>
<p style="font-size: var(--fluid-text-base)">Body text that scales smoothly</p>
```

## Layout Patterns

### Container System

```css
.responsive-center {
  max-width: var(--container-lg);
  margin-left: auto;
  margin-right: auto;
  padding-left: var(--fluid-space-md);
  padding-right: var(--fluid-space-md);
}
```

### Grid Layouts

```css
/* Auto-responsive grid */
.responsive-grid {
  display: grid;
  gap: var(--grid-gap-md);
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 250px), 1fr));
}

/* Dynamic sizing variants */
.responsive-grid--auto-sm { grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); }
.responsive-grid--auto-md { grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); }
.responsive-grid--auto-lg { grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); }
```

### Stack Layout

```css
/* Flexible stack layout */
.responsive-stack {
  display: flex;
  flex-direction: column;
  gap: var(--fluid-space-md);
}

.responsive-stack--horizontal {
  flex-direction: row;
  flex-wrap: wrap;
}

/* Responsive direction change */
@media (min-width: 640px) {
  .responsive-stack--horizontal\@sm {
    flex-direction: row;
  }
}
```

## Component Patterns

### Buttons

```html
<button class="responsive-button touch-target">
  Primary Action
</button>

<button class="responsive-button responsive-button--secondary touch-target--comfortable">
  Secondary Action
</button>
```

### Form Fields

```html
<div class="responsive-form__group">
  <label class="responsive-form__label responsive-form__label--required">
    Email Address
  </label>
  <input
    type="email"
    class="responsive-form__input"
    placeholder="Enter your email"
    required
  >
  <div class="responsive-form__error">
    Please enter a valid email address
  </div>
</div>
```

### Navigation

```html
<nav class="responsive-nav">
  <a href="/" class="responsive-nav__brand">Brand</a>

  <!-- Desktop Navigation -->
  <div class="responsive-nav__desktop">
    <ul class="responsive-nav__list">
      <li class="responsive-nav__item">
        <a href="/dashboard" class="responsive-nav__link">Dashboard</a>
      </li>
      <li class="responsive-nav__item">
        <a href="/search" class="responsive-nav__link">Search</a>
      </li>
    </ul>
  </div>

  <!-- Mobile Navigation -->
  <div class="responsive-nav__mobile">
    <button class="responsive-nav__hamburger" aria-expanded="false">
      <span class="responsive-nav__hamburger-line"></span>
      <span class="responsive-nav__hamburger-line"></span>
      <span class="responsive-nav__hamburger-line"></span>
    </button>
  </div>
</nav>
```

## Touch Optimization

### Touch Targets

All interactive elements meet minimum touch target requirements:

```css
/* Touch target compliance */
.touch-target {
  min-width: var(--touch-target-min); /* 44px minimum */
  min-height: var(--touch-target-min);
}

.touch-target--comfortable {
  min-width: var(--touch-target-comfortable); /* 48px */
  min-height: var(--touch-target-comfortable);
}
```

### Touch-Specific Styles

```css
@media (hover: none) and (pointer: coarse) {
  /* Enhanced styles for touch devices */
  .responsive-button {
    min-height: var(--touch-target-comfortable);
    padding: var(--interactive-padding-md) var(--fluid-space-lg);
  }

  /* Prevent zoom on iOS */
  .responsive-input {
    font-size: max(16px, var(--fluid-text-base));
  }
}
```

## Container Queries

Modern responsive design using container queries:

```css
@supports (container-type: inline-size) {
  .card-container {
    container-type: inline-size;
    container-name: card;
  }
}

@container card (max-width: 300px) {
  .card-content {
    flex-direction: column;
    text-align: center;
  }
}
```

## Accessibility Features

### Focus Management

```css
.responsive-focus-visible:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 2px;
  border-radius: 0.25rem;
}
```

### Screen Reader Support

```html
<span class="sr-only">Screen reader only text</span>
<span class="sr-only-focusable">Visible when focused</span>
```

### High Contrast Mode

```css
@media (prefers-contrast: high) {
  .responsive-button,
  .responsive-input {
    border: 2px solid currentColor;
  }
}
```

### Reduced Motion

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

## Performance Optimization

### CSS Containment

```css
.responsive-card {
  contain: layout style;
}

.performance-critical {
  contain: strict;
  content-visibility: auto;
}
```

### Efficient Transitions

```css
/* Use efficient properties for animations */
.responsive-hover-lift:hover {
  transform: translateY(-2px); /* Animates on compositor */
}

.responsive-hover-scale:hover {
  transform: scale(1.02); /* Animates on compositor */
}
```

## Usage Examples

### Basic Page Layout

```html
<div class="responsive-center">
  <header class="responsive-nav">
    <!-- Navigation content -->
  </header>

  <main class="responsive-form__container">
    <div class="responsive-grid">
      <!-- Grid content -->
    </div>
  </main>
</div>
```

### Responsive Cards

```html
<div class="responsive-grid responsive-grid--auto-md">
  <article class="responsive-card">
    <h2>Card Title</h2>
    <p>Card content that adapts to container size</p>
    <div class="responsive-card__actions">
      <button class="responsive-button touch-target">Action</button>
    </div>
  </article>
</div>
```

### Form Layout

```html
<form class="responsive-form">
  <div class="responsive-form__section">
    <h2 class="responsive-form__section-title">User Information</h2>

    <div class="responsive-form__row responsive-form__row--2-cols">
      <div class="responsive-form__group">
        <label class="responsive-form__label">First Name</label>
        <input type="text" class="responsive-form__input">
      </div>

      <div class="responsive-form__group">
        <label class="responsive-form__label">Last Name</label>
        <input type="text" class="responsive-form__input">
      </div>
    </div>
  </div>

  <div class="responsive-form__actions">
    <button type="submit" class="responsive-form__button">Submit</button>
    <button type="button" class="responsive-form__button responsive-form__button--secondary">Cancel</button>
  </div>
</form>
```

## Testing Guidelines

### Cross-Device Testing

1. **Mobile Devices**: Test on actual devices, not just browser dev tools
2. **Touch Interactions**: Verify touch targets and gesture support
3. **Performance**: Monitor performance on low-end devices
4. **Accessibility**: Test with screen readers and keyboard navigation

### Breakpoint Testing

1. **Test at breakpoints**: 320px, 640px, 768px, 1024px, 1280px, 1536px
2. **Test between breakpoints**: Ensure smooth scaling
3. **Test orientation changes**: Portrait to landscape transitions
4. **Test zoom levels**: Up to 200% zoom

### Accessibility Testing

1. **Keyboard Navigation**: All interactive elements accessible via keyboard
2. **Screen Readers**: Test with NVDA, JAWS, and VoiceOver
3. **Color Contrast**: Verify WCAG AA compliance
4. **Touch Targets**: Minimum 44px x 44px for all interactive elements

## Migration Guide

### From Existing CSS

1. **Replace fixed breakpoints** with fluid responsive patterns
2. **Update touch targets** to meet minimum size requirements
3. **Implement container queries** for component-level responsiveness
4. **Add accessibility features** like focus management and screen reader support

### Integration Steps

1. **Include responsive CSS files** in your build process
2. **Update component markup** to use new class patterns
3. **Test across devices** to ensure proper functionality
4. **Document component usage** for team members

## Browser Support

### Modern Features

- **Container Queries**: Chrome 105+, Firefox 110+, Safari 16+
- **CSS Clamp**: Chrome 79+, Firefox 75+, Safari 13.1+
- **CSS Grid**: Chrome 57+, Firefox 52+, Safari 10.1+

### Fallbacks

- **Container Queries**: Graceful degradation to media queries
- **CSS Clamp**: Fallback to responsive font-size calculations
- **Modern Properties**: Progressive enhancement approach

## Performance Considerations

### Critical CSS

Include responsive system variables and base styles in critical CSS:

```css
/* Critical responsive styles */
:root {
  --breakpoint-md: 768px;
  --fluid-text-base: clamp(0.9rem, 0.83rem + 0.35vw, 1rem);
  --touch-target-min: max(44px, 2.75rem);
}

.responsive-center { max-width: var(--container-lg); margin: 0 auto; }
.touch-target { min-width: var(--touch-target-min); min-height: var(--touch-target-min); }
```

### Code Splitting

Split responsive styles by feature:

- `responsive-core.css` - Base system and variables
- `responsive-components.css` - Component-specific styles
- `responsive-utilities.css` - Utility classes

## Best Practices

### Design Principles

1. **Mobile-First**: Design for small screens first
2. **Content-First**: Let content determine breakpoints
3. **Progressive Enhancement**: Start with basic styles, enhance for capabilities
4. **Performance-First**: Optimize for fast loading and smooth interactions

### Implementation Guidelines

1. **Use semantic HTML**: Proper markup improves accessibility and SEO
2. **Test real devices**: Emulators don't replace real device testing
3. **Optimize images**: Use responsive images and modern formats
4. **Monitor performance**: Regular performance audits and optimization

### Team Guidelines

1. **Document patterns**: Maintain up-to-date pattern library
2. **Code reviews**: Focus on responsive and accessibility compliance
3. **Design handoffs**: Include responsive specifications in designs
4. **Testing checklists**: Use standardized testing procedures

## Troubleshooting

### Common Issues

1. **Layout breaking at specific widths**: Check for hardcoded dimensions
2. **Text too small on mobile**: Verify minimum font sizes
3. **Touch targets too small**: Audit interactive element sizes
4. **Performance issues**: Review animation properties and containment

### Debug Tools

1. **Browser DevTools**: Responsive design mode and device emulation
2. **Accessibility Tools**: axe DevTools, Lighthouse accessibility audit
3. **Performance Tools**: Chrome DevTools Performance panel
4. **Real Device Testing**: BrowserStack, Device Lab, or physical devices

This responsive design system provides a solid foundation for creating modern, accessible, and performant interfaces that work seamlessly across all devices and screen sizes.