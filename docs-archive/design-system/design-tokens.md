# Design Tokens Reference

## Overview

Design tokens are the foundation of the Mainframe AI Assistant Design System. They provide a single source of truth for all design decisions, ensuring consistency across components and themes while enabling easy customization and maintenance.

## Token Categories

- [Colors](#colors)
- [Typography](#typography)
- [Spacing](#spacing)
- [Sizing](#sizing)
- [Border Radius](#border-radius)
- [Shadows](#shadows)
- [Z-Index](#z-index)
- [Transitions](#transitions)
- [Breakpoints](#breakpoints)

---

## Colors

### Color Philosophy

Our color system is built around accessibility, semantic meaning, and visual hierarchy. Each color family includes 11 shades (50-950) following a consistent lightness curve that ensures excellent contrast ratios.

#### Primary Color Palette

**Blue Scale - Professional and Trustworthy**
```css
--color-primary-50: #eff6ff;   /* Lightest tint */
--color-primary-100: #dbeafe;
--color-primary-200: #bfdbfe;
--color-primary-300: #93c5fd;
--color-primary-400: #60a5fa;
--color-primary-500: #3b82f6;  /* Base color */
--color-primary-600: #2563eb;  /* Interactive default */
--color-primary-700: #1d4ed8;
--color-primary-800: #1e40af;
--color-primary-900: #1e3a8a;
--color-primary-950: #172554;  /* Darkest shade */
```

**Usage Guidelines:**
- **50-200**: Subtle backgrounds, light states
- **300-500**: Icons, borders, secondary elements
- **600**: Primary actions, buttons, links (default interactive state)
- **700-800**: Hover and active states
- **900-950**: Text on light backgrounds

#### Success Colors

**Green Scale - Positive Actions**
```css
--color-success-50: #f0fdf4;
--color-success-100: #dcfce7;
--color-success-200: #bbf7d0;
--color-success-300: #86efac;
--color-success-400: #4ade80;
--color-success-500: #22c55e;
--color-success-600: #16a34a;  /* Primary success color */
--color-success-700: #15803d;
--color-success-800: #166534;
--color-success-900: #14532d;
--color-success-950: #052e16;
```

#### Warning Colors

**Amber Scale - Caution and Attention**
```css
--color-warning-50: #fffbeb;
--color-warning-100: #fef3c7;
--color-warning-200: #fde68a;
--color-warning-300: #fcd34d;
--color-warning-400: #fbbf24;
--color-warning-500: #f59e0b;  /* Primary warning color */
--color-warning-600: #d97706;
--color-warning-700: #b45309;
--color-warning-800: #92400e;
--color-warning-900: #78350f;
--color-warning-950: #451a03;
```

#### Error Colors

**Red Scale - Destructive Actions**
```css
--color-error-50: #fef2f2;
--color-error-100: #fee2e2;
--color-error-200: #fecaca;
--color-error-300: #fca5a5;
--color-error-400: #f87171;
--color-error-500: #ef4444;
--color-error-600: #dc2626;    /* Primary error color */
--color-error-700: #b91c1c;
--color-error-800: #991b1b;
--color-error-900: #7f1d1d;
--color-error-950: #450a0a;
```

#### Neutral Colors

**Gray Scale - Text, Borders, Backgrounds**
```css
--color-gray-50: #f9fafb;     /* Lightest background */
--color-gray-100: #f3f4f6;
--color-gray-200: #e5e7eb;    /* Subtle borders */
--color-gray-300: #d1d5db;
--color-gray-400: #9ca3af;    /* Disabled text, placeholders */
--color-gray-500: #6b7280;    /* Secondary text */
--color-gray-600: #4b5563;
--color-gray-700: #374151;
--color-gray-800: #1f2937;
--color-gray-900: #111827;    /* Primary text */
--color-gray-950: #030712;    /* Darkest shade */
```

### Mainframe Theme Colors

**Terminal Aesthetic Colors**
```css
--color-mainframe-green: #00ff00;      /* Classic terminal green */
--color-mainframe-amber: #ffb000;      /* Terminal amber */
--color-mainframe-blue: #0080ff;       /* IBM blue variant */
--color-mainframe-black: #000000;      /* Terminal background */
--color-mainframe-white: #ffffff;      /* Terminal text */

/* Terminal-specific colors */
--color-terminal-background: #000000;
--color-terminal-text: #00ff00;
--color-terminal-cursor: #ffffff;
--color-terminal-selection: #004400;
```

### Semantic Color Tokens

These tokens map to specific UI elements and automatically adapt to theme changes:

```css
/* Background Colors */
--color-background-primary: var(--color-white);      /* Main content area */
--color-background-secondary: var(--color-gray-50);  /* Secondary content */
--color-background-tertiary: var(--color-gray-100);  /* Subtle backgrounds */
--color-background-inverse: var(--color-gray-900);   /* Dark backgrounds */
--color-background-overlay: rgba(0, 0, 0, 0.5);      /* Modal overlays */

/* Surface Colors */
--color-surface-primary: var(--color-white);         /* Cards, panels */
--color-surface-secondary: var(--color-gray-50);     /* Subtle elevation */
--color-surface-elevated: var(--color-white);        /* Elevated cards */
--color-surface-sunken: var(--color-gray-100);       /* Inset areas */

/* Text Colors */
--color-text-primary: var(--color-gray-900);         /* Main text */
--color-text-secondary: var(--color-gray-600);       /* Supporting text */
--color-text-tertiary: var(--color-gray-500);        /* Subtle text */
--color-text-placeholder: var(--color-gray-400);     /* Placeholder text */
--color-text-inverse: var(--color-white);            /* Text on dark */
--color-text-disabled: var(--color-gray-400);        /* Disabled text */

/* Interactive Colors */
--color-interactive-primary: var(--color-primary-600);        /* Primary actions */
--color-interactive-primary-hover: var(--color-primary-700);  /* Hover state */
--color-interactive-primary-active: var(--color-primary-800); /* Active state */

/* Border Colors */
--color-border-primary: var(--color-gray-200);       /* Default borders */
--color-border-secondary: var(--color-gray-300);     /* Stronger borders */
--color-border-focus: var(--color-primary-500);      /* Focus indicators */
--color-border-error: var(--color-error-500);        /* Error states */
--color-border-disabled: var(--color-gray-200);      /* Disabled elements */
```

### Dark Theme Overrides

```css
[data-theme="dark"] {
  /* Background Colors */
  --color-background-primary: var(--color-gray-900);
  --color-background-secondary: var(--color-gray-800);
  --color-background-tertiary: var(--color-gray-700);
  --color-background-inverse: var(--color-gray-50);
  --color-background-overlay: rgba(0, 0, 0, 0.8);

  /* Surface Colors */
  --color-surface-primary: var(--color-gray-900);
  --color-surface-secondary: var(--color-gray-800);
  --color-surface-elevated: var(--color-gray-800);
  --color-surface-sunken: var(--color-gray-950);

  /* Text Colors */
  --color-text-primary: var(--color-gray-100);
  --color-text-secondary: var(--color-gray-300);
  --color-text-tertiary: var(--color-gray-400);
  --color-text-placeholder: var(--color-gray-500);
  --color-text-inverse: var(--color-gray-900);
  --color-text-disabled: var(--color-gray-600);

  /* Border Colors */
  --color-border-primary: var(--color-gray-700);
  --color-border-secondary: var(--color-gray-600);
  --color-border-disabled: var(--color-gray-700);
}
```

### Color Usage Examples

```tsx
// Using semantic color tokens
const Button = styled.button`
  background-color: var(--color-interactive-primary);
  color: var(--color-text-inverse);
  border: 1px solid var(--color-border-primary);

  &:hover {
    background-color: var(--color-interactive-primary-hover);
  }

  &:focus {
    outline: 2px solid var(--color-border-focus);
    outline-offset: 2px;
  }

  &:disabled {
    background-color: var(--color-surface-disabled);
    color: var(--color-text-disabled);
    border-color: var(--color-border-disabled);
  }
`;

// Error state styling
const ErrorMessage = styled.div`
  background-color: var(--color-error-50);
  color: var(--color-error-800);
  border: 1px solid var(--color-error-200);
  border-left: 4px solid var(--color-error-600);
`;

// Success state styling
const SuccessMessage = styled.div`
  background-color: var(--color-success-50);
  color: var(--color-success-800);
  border: 1px solid var(--color-success-200);
`;
```

---

## Typography

### Font Families

```css
/* System Font Stack - Primary */
--font-family-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto',
                    'Helvetica Neue', Arial, sans-serif;

/* Monospace Stack - Code and Data */
--font-family-mono: 'SF Mono', 'Monaco', 'Cascadia Code', 'Roboto Mono',
                    Consolas, 'Courier New', monospace;

/* Display Font Stack - Headlines */
--font-family-display: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;

/* Mainframe Font Stack - Terminal Aesthetic */
--font-family-mainframe: 'Courier New', 'Monaco', 'SF Mono', monospace;
```

### Font Sizes

**Modular Scale (1.250 - Major Third)**
```css
--font-size-xs: 0.75rem;     /* 12px - Captions, labels */
--font-size-sm: 0.875rem;    /* 14px - Small text, metadata */
--font-size-base: 1rem;      /* 16px - Body text (never smaller) */
--font-size-lg: 1.125rem;    /* 18px - Large body text */
--font-size-xl: 1.25rem;     /* 20px - Subheadings */
--font-size-2xl: 1.5rem;     /* 24px - Card titles */
--font-size-3xl: 1.875rem;   /* 30px - Section headings */
--font-size-4xl: 2.25rem;    /* 36px - Page titles */
--font-size-5xl: 3rem;       /* 48px - Hero headings */
--font-size-6xl: 3.75rem;    /* 60px - Display text */
```

**Responsive Typography**
```css
/* Fluid typography for better scaling */
--font-size-fluid-sm: clamp(0.875rem, 0.8rem + 0.4vw, 1rem);
--font-size-fluid-base: clamp(1rem, 0.9rem + 0.5vw, 1.125rem);
--font-size-fluid-lg: clamp(1.125rem, 1rem + 0.6vw, 1.25rem);
--font-size-fluid-xl: clamp(1.25rem, 1.1rem + 0.75vw, 1.5rem);
--font-size-fluid-2xl: clamp(1.5rem, 1.3rem + 1vw, 2rem);
--font-size-fluid-3xl: clamp(1.875rem, 1.5rem + 1.5vw, 2.5rem);
--font-size-fluid-4xl: clamp(2.25rem, 1.8rem + 2vw, 3rem);
```

### Font Weights

```css
--font-weight-thin: 100;      /* Rarely used */
--font-weight-extralight: 200; /* Light decorative text */
--font-weight-light: 300;     /* Light body text */
--font-weight-normal: 400;    /* Default body text */
--font-weight-medium: 500;    /* Emphasized text, labels */
--font-weight-semibold: 600;  /* Subheadings, buttons */
--font-weight-bold: 700;      /* Headings, strong emphasis */
--font-weight-extrabold: 800; /* Display text */
--font-weight-black: 900;     /* Heavy display text */
```

### Line Heights

```css
--line-height-none: 1;        /* Headings, display text */
--line-height-tight: 1.25;    /* Large headings */
--line-height-snug: 1.375;    /* Subheadings */
--line-height-normal: 1.5;    /* Body text (WCAG recommended) */
--line-height-relaxed: 1.625; /* Large body text */
--line-height-loose: 2;       /* Widely spaced text */
```

### Letter Spacing

```css
--letter-spacing-tighter: -0.05em; /* Display headings */
--letter-spacing-tight: -0.025em;  /* Headings */
--letter-spacing-normal: 0;        /* Default */
--letter-spacing-wide: 0.025em;    /* All caps text */
--letter-spacing-wider: 0.05em;    /* Spaced caps */
--letter-spacing-widest: 0.1em;    /* Very spaced caps */
```

### Typography Usage Examples

```css
/* Heading styles */
.heading-1 {
  font-family: var(--font-family-display);
  font-size: var(--font-size-4xl);
  font-weight: var(--font-weight-bold);
  line-height: var(--line-height-tight);
  letter-spacing: var(--letter-spacing-tight);
  color: var(--color-text-primary);
}

/* Body text styles */
.body-text {
  font-family: var(--font-family-sans);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-normal);
  line-height: var(--line-height-normal);
  color: var(--color-text-primary);
}

/* Code text styles */
.code-text {
  font-family: var(--font-family-mono);
  font-size: 0.875em; /* Slightly smaller than body */
  background-color: var(--color-surface-subtle);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--border-radius-sm);
}
```

---

## Spacing

### Base Unit System

Our spacing system is based on an 8px grid for consistent rhythm and alignment:

```css
--space-0: 0;
--space-px: 1px;              /* 1px - Borders */
--space-0-5: 0.125rem;        /* 2px - Fine adjustments */
--space-1: 0.25rem;           /* 4px - Tight spacing */
--space-1-5: 0.375rem;        /* 6px - Small gaps */
--space-2: 0.5rem;            /* 8px - Base unit */
--space-2-5: 0.625rem;        /* 10px - Small elements */
--space-3: 0.75rem;           /* 12px - Component spacing */
--space-3-5: 0.875rem;        /* 14px - Medium gaps */
--space-4: 1rem;              /* 16px - Standard spacing */
--space-5: 1.25rem;           /* 20px - Element spacing */
--space-6: 1.5rem;            /* 24px - Section spacing */
--space-7: 1.75rem;           /* 28px - Large gaps */
--space-8: 2rem;              /* 32px - Component margins */
--space-9: 2.25rem;           /* 36px - Section margins */
--space-10: 2.5rem;           /* 40px - Large spacing */
--space-11: 2.75rem;          /* 44px - Extra spacing */
--space-12: 3rem;             /* 48px - Page sections */
--space-14: 3.5rem;           /* 56px - Large sections */
--space-16: 4rem;             /* 64px - Page margins */
--space-20: 5rem;             /* 80px - Hero sections */
--space-24: 6rem;             /* 96px - Large sections */
--space-28: 7rem;             /* 112px - Extra large */
--space-32: 8rem;             /* 128px - Maximum spacing */
```

### Semantic Spacing Tokens

```css
/* Component-specific spacing */
--spacing-component-xs: var(--space-2);    /* 8px - Tight component spacing */
--spacing-component-sm: var(--space-3);    /* 12px - Small component spacing */
--spacing-component-md: var(--space-4);    /* 16px - Default component spacing */
--spacing-component-lg: var(--space-6);    /* 24px - Large component spacing */
--spacing-component-xl: var(--space-8);    /* 32px - Extra large spacing */

/* Layout spacing */
--spacing-layout-xs: var(--space-4);       /* 16px - Tight layout spacing */
--spacing-layout-sm: var(--space-6);       /* 24px - Small layout spacing */
--spacing-layout-md: var(--space-8);       /* 32px - Default layout spacing */
--spacing-layout-lg: var(--space-12);      /* 48px - Large layout spacing */
--spacing-layout-xl: var(--space-16);      /* 64px - Extra large spacing */

/* Content spacing */
--spacing-content-xs: var(--space-2);      /* 8px - Inline content spacing */
--spacing-content-sm: var(--space-4);      /* 16px - Small content spacing */
--spacing-content-md: var(--space-6);      /* 24px - Default content spacing */
--spacing-content-lg: var(--space-8);      /* 32px - Large content spacing */
--spacing-content-xl: var(--space-12);     /* 48px - Extra large spacing */
```

### Spacing Usage Guidelines

**Button Padding**
```css
.btn--xs { padding: var(--space-1) var(--space-2); }     /* 4px 8px */
.btn--sm { padding: var(--space-2) var(--space-3); }     /* 8px 12px */
.btn--md { padding: var(--space-2-5) var(--space-4); }   /* 10px 16px */
.btn--lg { padding: var(--space-3) var(--space-6); }     /* 12px 24px */
.btn--xl { padding: var(--space-4) var(--space-8); }     /* 16px 32px */
```

**Card Spacing**
```css
.card { padding: var(--space-6); }                       /* 24px all around */
.card-header { padding: var(--space-6) var(--space-6) var(--space-4); } /* 24px sides, 16px bottom */
.card-content { padding: var(--space-4) var(--space-6); }               /* 16px top/bottom, 24px sides */
.card-footer { padding: var(--space-4) var(--space-6) var(--space-6); } /* 16px top, 24px sides/bottom */
```

**Form Spacing**
```css
.form-field { margin-bottom: var(--space-6); }           /* 24px between fields */
.form-label { margin-bottom: var(--space-2); }           /* 8px below labels */
.form-error { margin-top: var(--space-1); }              /* 4px above errors */
.form-help { margin-top: var(--space-1); }               /* 4px above help text */
```

---

## Sizing

### Width and Height Scale

```css
--size-0: 0;
--size-px: 1px;
--size-0-5: 0.125rem;    /* 2px */
--size-1: 0.25rem;       /* 4px */
--size-1-5: 0.375rem;    /* 6px */
--size-2: 0.5rem;        /* 8px */
--size-2-5: 0.625rem;    /* 10px */
--size-3: 0.75rem;       /* 12px */
--size-3-5: 0.875rem;    /* 14px */
--size-4: 1rem;          /* 16px */
--size-5: 1.25rem;       /* 20px */
--size-6: 1.5rem;        /* 24px */
--size-7: 1.75rem;       /* 28px */
--size-8: 2rem;          /* 32px */
--size-9: 2.25rem;       /* 36px */
--size-10: 2.5rem;       /* 40px */
--size-11: 2.75rem;      /* 44px */
--size-12: 3rem;         /* 48px */
--size-14: 3.5rem;       /* 56px */
--size-16: 4rem;         /* 64px */
--size-20: 5rem;         /* 80px */
--size-24: 6rem;         /* 96px */
--size-28: 7rem;         /* 112px */
--size-32: 8rem;         /* 128px */
--size-36: 9rem;         /* 144px */
--size-40: 10rem;        /* 160px */
--size-44: 11rem;        /* 176px */
--size-48: 12rem;        /* 192px */
--size-52: 13rem;        /* 208px */
--size-56: 14rem;        /* 224px */
--size-60: 15rem;        /* 240px */
--size-64: 16rem;        /* 256px */
--size-72: 18rem;        /* 288px */
--size-80: 20rem;        /* 320px */
--size-96: 24rem;        /* 384px */
```

### Component Sizes

```css
/* Button heights */
--button-height-xs: var(--size-6);    /* 24px */
--button-height-sm: var(--size-8);    /* 32px */
--button-height-md: var(--size-10);   /* 40px */
--button-height-lg: var(--size-12);   /* 48px */
--button-height-xl: var(--size-14);   /* 56px */

/* Input heights */
--input-height-sm: var(--size-8);     /* 32px */
--input-height-md: var(--size-10);    /* 40px */
--input-height-lg: var(--size-12);    /* 48px */

/* Icon sizes */
--icon-size-xs: var(--size-3);        /* 12px */
--icon-size-sm: var(--size-4);        /* 16px */
--icon-size-md: var(--size-5);        /* 20px */
--icon-size-lg: var(--size-6);        /* 24px */
--icon-size-xl: var(--size-8);        /* 32px */
--icon-size-2xl: var(--size-10);      /* 40px */

/* Avatar sizes */
--avatar-size-xs: var(--size-6);      /* 24px */
--avatar-size-sm: var(--size-8);      /* 32px */
--avatar-size-md: var(--size-10);     /* 40px */
--avatar-size-lg: var(--size-12);     /* 48px */
--avatar-size-xl: var(--size-16);     /* 64px */
--avatar-size-2xl: var(--size-20);    /* 80px */
```

### Container Max Widths

```css
--container-xs: 20rem;      /* 320px - Mobile content */
--container-sm: 24rem;      /* 384px - Small forms */
--container-md: 28rem;      /* 448px - Medium content */
--container-lg: 32rem;      /* 512px - Large content */
--container-xl: 36rem;      /* 576px - Extra large */
--container-2xl: 42rem;     /* 672px - Wide content */
--container-3xl: 48rem;     /* 768px - Very wide */
--container-4xl: 56rem;     /* 896px - Maximum readable width */
--container-5xl: 64rem;     /* 1024px - Full content */
--container-6xl: 72rem;     /* 1152px - Wide layouts */
--container-7xl: 80rem;     /* 1280px - Maximum width */
--container-full: 100%;     /* Full width */
```

---

## Border Radius

```css
--border-radius-none: 0;
--border-radius-sm: 0.125rem;    /* 2px - Subtle rounding */
--border-radius-md: 0.25rem;     /* 4px - Default rounding */
--border-radius-lg: 0.375rem;    /* 6px - Noticeable rounding */
--border-radius-xl: 0.5rem;      /* 8px - Strong rounding */
--border-radius-2xl: 0.75rem;    /* 12px - Very rounded */
--border-radius-3xl: 1rem;       /* 16px - Extra rounded */
--border-radius-4xl: 1.5rem;     /* 24px - Heavily rounded */
--border-radius-full: 9999px;    /* Fully rounded (circles) */
```

### Component-Specific Border Radius

```css
/* Buttons */
--border-radius-button: var(--border-radius-md);        /* 4px */
--border-radius-button-sm: var(--border-radius-sm);     /* 2px */
--border-radius-button-lg: var(--border-radius-lg);     /* 6px */

/* Cards */
--border-radius-card: var(--border-radius-xl);          /* 8px */
--border-radius-card-lg: var(--border-radius-2xl);      /* 12px */

/* Inputs */
--border-radius-input: var(--border-radius-md);         /* 4px */

/* Modals */
--border-radius-modal: var(--border-radius-2xl);        /* 12px */

/* Images */
--border-radius-image: var(--border-radius-lg);         /* 6px */
--border-radius-avatar: var(--border-radius-full);      /* Circle */

/* Badges */
--border-radius-badge: var(--border-radius-full);       /* Pill shape */

/* Tooltips */
--border-radius-tooltip: var(--border-radius-md);       /* 4px */
```

---

## Shadows

### Base Shadow System

```css
/* Shadow scale for depth and elevation */
--shadow-xs: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
--shadow-sm: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1);
--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1);
--shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
--shadow-2xl: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
--shadow-inner: inset 0 2px 4px 0 rgba(0, 0, 0, 0.05);
--shadow-none: 0 0 #0000;

/* Focus shadows */
--shadow-focus: 0 0 0 3px rgba(59, 130, 246, 0.1);
--shadow-focus-danger: 0 0 0 3px rgba(239, 68, 68, 0.1);
--shadow-focus-success: 0 0 0 3px rgba(34, 197, 94, 0.1);
--shadow-focus-warning: 0 0 0 3px rgba(245, 158, 11, 0.1);

/* Glow effects */
--shadow-glow: 0 0 20px rgba(59, 130, 246, 0.5);
--shadow-glow-success: 0 0 20px rgba(34, 197, 94, 0.5);
--shadow-glow-warning: 0 0 20px rgba(245, 158, 11, 0.5);
--shadow-glow-danger: 0 0 20px rgba(239, 68, 68, 0.5);

/* Mainframe glow */
--shadow-mainframe-glow: 0 0 15px rgba(0, 255, 0, 0.5);
```

### Component-Specific Shadows

```css
/* Button shadows */
--shadow-button: var(--shadow-sm);
--shadow-button-hover: var(--shadow-md);
--shadow-button-pressed: var(--shadow-xs);

/* Card shadows */
--shadow-card: var(--shadow-sm);
--shadow-card-hover: var(--shadow-lg);
--shadow-card-elevated: var(--shadow-xl);

/* Modal shadows */
--shadow-modal: var(--shadow-2xl);

/* Dropdown shadows */
--shadow-dropdown: var(--shadow-lg);

/* Tooltip shadows */
--shadow-tooltip: var(--shadow-md);
```

---

## Z-Index

### Layering System

```css
--z-index-hide: -1;           /* Hidden elements */
--z-index-base: 0;            /* Base layer */
--z-index-docked: 10;         /* Docked elements */
--z-index-dropdown: 1000;     /* Dropdowns */
--z-index-sticky: 1020;       /* Sticky elements */
--z-index-banner: 1030;       /* Banners */
--z-index-overlay: 1040;      /* Overlays */
--z-index-modal: 1050;        /* Modals */
--z-index-popover: 1060;      /* Popovers */
--z-index-skiplink: 1070;     /* Skip links */
--z-index-toast: 1080;        /* Notifications */
--z-index-tooltip: 1090;      /* Tooltips */
```

### Usage Guidelines

- **Base (0)**: Normal document flow
- **Docked (10)**: Navigation bars, headers
- **Dropdown (1000)**: Select dropdowns, menus
- **Sticky (1020)**: Sticky headers, sidebars
- **Banner (1030)**: Announcement banners
- **Overlay (1040)**: Modal backdrops
- **Modal (1050)**: Dialog boxes, modals
- **Popover (1060)**: Context menus, popovers
- **Toast (1080)**: Notifications, alerts
- **Tooltip (1090)**: Tooltips (highest layer)

---

## Transitions

### Duration Tokens

```css
--transition-duration-fast: 150ms;    /* Quick interactions */
--transition-duration-normal: 200ms;  /* Default duration */
--transition-duration-slow: 300ms;    /* Slower animations */
--transition-duration-slower: 500ms;  /* Complex animations */
```

### Easing Functions

```css
--transition-easing-linear: linear;
--transition-easing-ease: ease;
--transition-easing-ease-in: ease-in;
--transition-easing-ease-out: ease-out;
--transition-easing-ease-in-out: ease-in-out;
--transition-easing-smooth: cubic-bezier(0.4, 0, 0.2, 1);      /* Smooth, natural */
--transition-easing-snappy: cubic-bezier(0.4, 0, 1, 1);        /* Quick ease-in */
--transition-easing-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55); /* Bounce effect */
```

### Common Transition Patterns

```css
/* Base transitions */
--transition-colors: color var(--transition-duration-normal) var(--transition-easing-smooth),
                    background-color var(--transition-duration-normal) var(--transition-easing-smooth),
                    border-color var(--transition-duration-normal) var(--transition-easing-smooth);

--transition-opacity: opacity var(--transition-duration-normal) var(--transition-easing-smooth);

--transition-transform: transform var(--transition-duration-normal) var(--transition-easing-smooth);

--transition-shadow: box-shadow var(--transition-duration-normal) var(--transition-easing-smooth);

--transition-all: all var(--transition-duration-normal) var(--transition-easing-smooth);

/* Component-specific transitions */
--transition-button: background-color var(--transition-duration-fast) var(--transition-easing-smooth),
                    transform var(--transition-duration-fast) var(--transition-easing-smooth),
                    box-shadow var(--transition-duration-fast) var(--transition-easing-smooth);

--transition-input: border-color var(--transition-duration-fast) var(--transition-easing-smooth),
                   box-shadow var(--transition-duration-fast) var(--transition-easing-smooth);

--transition-card: transform var(--transition-duration-normal) var(--transition-easing-smooth),
                  box-shadow var(--transition-duration-normal) var(--transition-easing-smooth);
```

---

## Breakpoints

### Responsive Design System

```css
--breakpoint-xs: 475px;       /* Extra small devices */
--breakpoint-sm: 640px;       /* Small devices (landscape phones) */
--breakpoint-md: 768px;       /* Medium devices (tablets) */
--breakpoint-lg: 1024px;      /* Large devices (desktops) */
--breakpoint-xl: 1280px;      /* Extra large devices */
--breakpoint-2xl: 1536px;     /* 2X large devices */
```

### Media Query Helpers

```css
/* Mobile-first approach */
@media (min-width: 475px) { /* xs and up */ }
@media (min-width: 640px) { /* sm and up */ }
@media (min-width: 768px) { /* md and up */ }
@media (min-width: 1024px) { /* lg and up */ }
@media (min-width: 1280px) { /* xl and up */ }
@media (min-width: 1536px) { /* 2xl and up */ }

/* Container queries for component-based responsive design */
@container (min-width: 320px) { /* Component small */ }
@container (min-width: 480px) { /* Component medium */ }
@container (min-width: 640px) { /* Component large */ }
```

### Usage in Components

```scss
// Sass mixins for breakpoints
@mixin respond-to($breakpoint) {
  @if $breakpoint == xs {
    @media (min-width: 475px) { @content; }
  }
  @if $breakpoint == sm {
    @media (min-width: 640px) { @content; }
  }
  @if $breakpoint == md {
    @media (min-width: 768px) { @content; }
  }
  @if $breakpoint == lg {
    @media (min-width: 1024px) { @content; }
  }
  @if $breakpoint == xl {
    @media (min-width: 1280px) { @content; }
  }
  @if $breakpoint == 2xl {
    @media (min-width: 1536px) { @content; }
  }
}

// Usage example
.card {
  padding: var(--space-4);

  @include respond-to(sm) {
    padding: var(--space-6);
  }

  @include respond-to(lg) {
    padding: var(--space-8);
  }
}
```

---

## Token Usage Guidelines

### CSS Custom Properties

```css
/* Using tokens in component styles */
.my-component {
  /* Colors */
  background-color: var(--color-surface-primary);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border-primary);

  /* Spacing */
  padding: var(--space-4) var(--space-6);
  margin-bottom: var(--space-8);

  /* Typography */
  font-family: var(--font-family-sans);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  line-height: var(--line-height-normal);

  /* Styling */
  border-radius: var(--border-radius-lg);
  box-shadow: var(--shadow-card);

  /* Transitions */
  transition: var(--transition-card);
}

.my-component:hover {
  background-color: var(--color-surface-secondary);
  box-shadow: var(--shadow-card-hover);
  transform: translateY(-1px);
}
```

### JavaScript/TypeScript Usage

```typescript
// Using design tokens in styled-components
import styled from 'styled-components';

const Card = styled.div`
  background-color: var(--color-surface-primary);
  border-radius: var(--border-radius-card);
  box-shadow: var(--shadow-card);
  padding: var(--space-6);

  &:hover {
    box-shadow: var(--shadow-card-hover);
    transform: translateY(-2px);
  }
`;

// Using tokens in React inline styles
const buttonStyle = {
  backgroundColor: 'var(--color-interactive-primary)',
  color: 'var(--color-text-inverse)',
  padding: 'var(--space-2-5) var(--space-4)',
  borderRadius: 'var(--border-radius-button)',
  fontSize: 'var(--font-size-sm)',
  fontWeight: 'var(--font-weight-medium)',
  border: 'none',
  cursor: 'pointer',
  transition: 'var(--transition-button)'
};

// Using tokens with Tailwind CSS (via CSS variables)
<div className="bg-surface-primary text-text-primary p-6 rounded-card shadow-card">
  Content here
</div>
```

### Token Migration

When updating tokens, follow this process:

1. **Add new token** alongside existing one
2. **Update components** gradually to use new token
3. **Deprecate old token** with console warnings
4. **Remove old token** in next major version

```css
/* Migration example */
/* OLD - deprecated */
--color-primary: #3b82f6; /* @deprecated Use --color-interactive-primary instead */

/* NEW - current */
--color-interactive-primary: #2563eb;
```

---

*This design tokens reference is the single source of truth for all design decisions in the Mainframe AI Assistant Design System. Always reference these tokens when creating new components or customizing existing ones.*