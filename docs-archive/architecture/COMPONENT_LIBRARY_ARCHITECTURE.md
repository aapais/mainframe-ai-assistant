# Component Library Architecture Design
## Mainframe KB Assistant - Foundational Design System

### Executive Summary

This document outlines the foundational architecture for a scalable, accessible, and performant component library for the Mainframe KB Assistant. The architecture follows a Knowledge-First approach, prioritizing immediate usability while maintaining extensibility for future MVP iterations.

---

## 1. System Architecture Overview

### 1.1 Component Hierarchy & Organization

```
src/renderer/
├── components/
│   ├── foundation/           # Core design tokens & primitives
│   │   ├── tokens/           # Design tokens
│   │   │   ├── colors.ts
│   │   │   ├── typography.ts
│   │   │   ├── spacing.ts
│   │   │   ├── breakpoints.ts
│   │   │   └── index.ts
│   │   ├── primitives/       # Base primitive components
│   │   │   ├── Box.tsx
│   │   │   ├── Text.tsx
│   │   │   ├── Stack.tsx
│   │   │   └── Grid.tsx
│   │   └── theme/            # Theme provider & utilities
│   │       ├── ThemeProvider.tsx
│   │       ├── useTheme.ts
│   │       └── theme-utils.ts
│   ├── core/                 # Essential UI components
│   │   ├── Button/           # Component-specific folder structure
│   │   │   ├── index.ts      # Main export
│   │   │   ├── Button.tsx    # Component implementation
│   │   │   ├── Button.css    # Component styles
│   │   │   ├── Button.test.tsx
│   │   │   └── Button.stories.tsx
│   │   ├── Input/
│   │   ├── Select/
│   │   ├── Modal/
│   │   └── Notification/
│   ├── patterns/             # Composite UI patterns
│   │   ├── SearchInterface/
│   │   ├── KBEntryCard/
│   │   ├── FormLayout/
│   │   └── DataTable/
│   ├── layout/               # Layout components
│   │   ├── AppLayout/
│   │   ├── Sidebar/
│   │   ├── Header/
│   │   └── MainContent/
│   └── accessibility/        # A11y utilities & components
│       ├── ScreenReader/
│       ├── FocusTrap/
│       ├── SkipLink/
│       └── AnnouncementRegion/
```

### 1.2 Design Philosophy Principles

1. **Progressive Enhancement**: Start with semantic HTML, enhance with CSS, add interactions with JavaScript
2. **Accessibility First**: WCAG 2.1 AA compliance built-in, not bolted on
3. **Performance by Default**: Lazy loading, tree shaking, minimal bundle impact
4. **Composability**: Small, focused components that combine into complex patterns
5. **Consistency**: Unified design language through systematic tokens and patterns
6. **Maintainability**: Clear separation of concerns, predictable file structure

---

## 2. Design Token System Architecture

### 2.1 Token Categories & Structure

```typescript
// src/renderer/components/foundation/tokens/colors.ts

export interface ColorTokens {
  // Semantic color scales
  primary: ColorScale;
  secondary: ColorScale;
  accent: ColorScale;
  
  // Functional colors
  success: ColorScale;
  warning: ColorScale;
  error: ColorScale;
  info: ColorScale;
  
  // Neutral grays
  gray: ColorScale;
  
  // Surface colors
  surface: {
    background: string;
    foreground: string;
    muted: string;
    subtle: string;
    emphasis: string;
  };
  
  // Text colors
  text: {
    primary: string;
    secondary: string;
    muted: string;
    inverted: string;
    disabled: string;
  };
  
  // Border colors
  border: {
    default: string;
    muted: string;
    emphasis: string;
  };
}

interface ColorScale {
  50: string;   // Lightest
  100: string;
  200: string;
  300: string;
  400: string;
  500: string;  // Base color
  600: string;
  700: string;
  800: string;
  900: string;  // Darkest
  950: string;  // Extra dark for text
}

// Mainframe-specific semantic tokens
export const colorTokens: ColorTokens = {
  primary: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6',  // Primary blue for knowledge base
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a',
    950: '#172554'
  },
  
  // Knowledge Base specific colors
  success: {
    500: '#10b981',  // Solution found
    600: '#059669',
    // ... complete scale
  },
  
  warning: {
    500: '#f59e0b',  // Pattern detected
    600: '#d97706',
    // ... complete scale
  },
  
  error: {
    500: '#ef4444',  // Error states
    600: '#dc2626',
    // ... complete scale
  },
  
  // Mainframe terminal inspired colors
  accent: {
    500: '#00ff00',  // Terminal green
    600: '#00cc00',
    // ... complete scale
  }
};
```

### 2.2 Typography System

```typescript
// src/renderer/components/foundation/tokens/typography.ts

export interface TypographyTokens {
  fontFamily: {
    sans: string[];
    mono: string[];
    display: string[];
  };
  
  fontSize: {
    xs: string;    // 12px - Small labels
    sm: string;    // 14px - Body small
    base: string;  // 16px - Body text
    lg: string;    // 18px - Large body
    xl: string;    // 20px - H4
    '2xl': string; // 24px - H3
    '3xl': string; // 30px - H2
    '4xl': string; // 36px - H1
    '5xl': string; // 48px - Display
  };
  
  fontWeight: {
    normal: number;
    medium: number;
    semibold: number;
    bold: number;
  };
  
  lineHeight: {
    none: number;
    tight: number;
    snug: number;
    normal: number;
    relaxed: number;
    loose: number;
  };
  
  letterSpacing: {
    tighter: string;
    tight: string;
    normal: string;
    wide: string;
    wider: string;
    widest: string;
  };
}

export const typographyTokens: TypographyTokens = {
  fontFamily: {
    sans: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif'
    ],
    mono: [
      '"SF Mono"',
      'Monaco',
      '"Cascadia Code"',
      '"Roboto Mono"',
      '"Courier New"',
      'monospace'
    ],
    display: [
      '"Inter"',
      'system-ui',
      'sans-serif'
    ]
  },
  
  fontSize: {
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
    '4xl': '2.25rem',
    '5xl': '3rem'
  },
  
  // Optimized for readability in knowledge base context
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700
  }
};
```

### 2.3 Spacing & Layout Tokens

```typescript
// src/renderer/components/foundation/tokens/spacing.ts

export interface SpacingTokens {
  space: {
    px: string;
    0: string;
    1: string;    // 4px
    2: string;    // 8px
    3: string;    // 12px
    4: string;    // 16px
    5: string;    // 20px
    6: string;    // 24px
    8: string;    // 32px
    10: string;   // 40px
    12: string;   // 48px
    16: string;   // 64px
    20: string;   // 80px
    24: string;   // 96px
    32: string;   // 128px
  };
  
  // Component-specific spacing
  component: {
    buttonPadding: {
      small: string;
      medium: string;
      large: string;
    };
    inputPadding: {
      small: string;
      medium: string;
      large: string;
    };
    cardPadding: string;
    sectionSpacing: string;
  };
  
  // Layout spacing
  layout: {
    containerMaxWidth: string;
    sidebarWidth: string;
    headerHeight: string;
    contentGutter: string;
  };
}

export const spacingTokens: SpacingTokens = {
  space: {
    px: '1px',
    0: '0',
    1: '0.25rem',
    2: '0.5rem',
    3: '0.75rem',
    4: '1rem',
    5: '1.25rem',
    6: '1.5rem',
    8: '2rem',
    10: '2.5rem',
    12: '3rem',
    16: '4rem',
    20: '5rem',
    24: '6rem',
    32: '8rem'
  },
  
  component: {
    buttonPadding: {
      small: '0.375rem 0.75rem',
      medium: '0.5rem 1rem',
      large: '0.75rem 1.5rem'
    },
    inputPadding: {
      small: '0.375rem 0.5rem',
      medium: '0.5rem 0.75rem',
      large: '0.75rem 1rem'
    },
    cardPadding: '1.5rem',
    sectionSpacing: '2rem'
  },
  
  layout: {
    containerMaxWidth: '1200px',
    sidebarWidth: '280px',
    headerHeight: '64px',
    contentGutter: '1.5rem'
  }
};
```

---

## 3. Theming & Customization Strategy

### 3.1 Theme Provider Architecture

```typescript
// src/renderer/components/foundation/theme/ThemeProvider.tsx

import React, { createContext, useContext, useEffect, useState } from 'react';
import { ColorTokens, TypographyTokens, SpacingTokens } from '../tokens';

export interface Theme {
  name: string;
  colors: ColorTokens;
  typography: TypographyTokens;
  spacing: SpacingTokens;
  accessibility: AccessibilityPreferences;
  mode: 'light' | 'dark' | 'high-contrast' | 'auto';
}

export interface AccessibilityPreferences {
  reduceMotion: boolean;
  highContrast: boolean;
  largeText: boolean;
  focusVisible: boolean;
  announceActions: boolean;
}

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Partial<Theme>) => void;
  toggleMode: () => void;
  updateAccessibilityPrefs: (prefs: Partial<AccessibilityPreferences>) => void;
  cssVariables: Record<string, string>;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

// Default themes
const lightTheme: Theme = {
  name: 'light',
  mode: 'light',
  colors: colorTokens,
  typography: typographyTokens,
  spacing: spacingTokens,
  accessibility: {
    reduceMotion: false,
    highContrast: false,
    largeText: false,
    focusVisible: true,
    announceActions: true
  }
};

const darkTheme: Theme = {
  ...lightTheme,
  name: 'dark',
  mode: 'dark',
  colors: {
    ...colorTokens,
    surface: {
      background: '#0a0a0a',
      foreground: '#fafafa',
      muted: '#262626',
      subtle: '#404040',
      emphasis: '#525252'
    },
    text: {
      primary: '#fafafa',
      secondary: '#a3a3a3',
      muted: '#737373',
      inverted: '#0a0a0a',
      disabled: '#525252'
    }
  }
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(lightTheme);
  
  // System preference detection
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const contrastQuery = window.matchMedia('(prefers-contrast: high)');
    
    // Initial detection
    if (mediaQuery.matches && theme.mode === 'auto') {
      setThemeState(prev => ({ ...prev, ...darkTheme, mode: 'auto' }));
    }
    
    setThemeState(prev => ({
      ...prev,
      accessibility: {
        ...prev.accessibility,
        reduceMotion: motionQuery.matches,
        highContrast: contrastQuery.matches
      }
    }));
    
    // Listeners for system changes
    const handleColorSchemeChange = (e: MediaQueryListEvent) => {
      if (theme.mode === 'auto') {
        const newTheme = e.matches ? darkTheme : lightTheme;
        setThemeState(prev => ({ ...prev, ...newTheme, mode: 'auto' }));
      }
    };
    
    const handleMotionChange = (e: MediaQueryListEvent) => {
      setThemeState(prev => ({
        ...prev,
        accessibility: {
          ...prev.accessibility,
          reduceMotion: e.matches
        }
      }));
    };
    
    const handleContrastChange = (e: MediaQueryListEvent) => {
      setThemeState(prev => ({
        ...prev,
        accessibility: {
          ...prev.accessibility,
          highContrast: e.matches
        }
      }));
    };
    
    mediaQuery.addListener(handleColorSchemeChange);
    motionQuery.addListener(handleMotionChange);
    contrastQuery.addListener(handleContrastChange);
    
    return () => {
      mediaQuery.removeListener(handleColorSchemeChange);
      motionQuery.removeListener(handleMotionChange);
      contrastQuery.removeListener(handleContrastChange);
    };
  }, [theme.mode]);
  
  // Generate CSS variables from theme tokens
  const cssVariables = React.useMemo(() => {
    const vars: Record<string, string> = {};
    
    // Color variables
    Object.entries(theme.colors).forEach(([category, colors]) => {
      if (typeof colors === 'object') {
        Object.entries(colors).forEach(([shade, value]) => {
          vars[`--color-${category}-${shade}`] = value;
        });
      }
    });
    
    // Typography variables
    Object.entries(theme.typography.fontSize).forEach(([size, value]) => {
      vars[`--font-size-${size}`] = value;
    });
    
    // Spacing variables
    Object.entries(theme.spacing.space).forEach(([key, value]) => {
      vars[`--space-${key}`] = value;
    });
    
    // Accessibility variables
    if (theme.accessibility.reduceMotion) {
      vars['--transition-duration'] = '0ms';
    } else {
      vars['--transition-duration'] = '200ms';
    }
    
    return vars;
  }, [theme]);
  
  // Apply CSS variables to root
  useEffect(() => {
    const root = document.documentElement;
    Object.entries(cssVariables).forEach(([property, value]) => {
      root.style.setProperty(property, value);
    });
    
    // Apply theme classes
    root.className = root.className.replace(/theme-\w+/g, '');
    root.classList.add(`theme-${theme.name}`);
    
    if (theme.accessibility.highContrast) {
      root.classList.add('high-contrast');
    } else {
      root.classList.remove('high-contrast');
    }
    
    if (theme.accessibility.largeText) {
      root.classList.add('large-text');
    } else {
      root.classList.remove('large-text');
    }
    
    if (theme.accessibility.reduceMotion) {
      root.classList.add('reduce-motion');
    } else {
      root.classList.remove('reduce-motion');
    }
  }, [cssVariables, theme]);
  
  const setTheme = (newTheme: Partial<Theme>) => {
    setThemeState(prev => ({ ...prev, ...newTheme }));
  };
  
  const toggleMode = () => {
    const modes: Theme['mode'][] = ['light', 'dark', 'high-contrast', 'auto'];
    const currentIndex = modes.indexOf(theme.mode);
    const nextIndex = (currentIndex + 1) % modes.length;
    const nextMode = modes[nextIndex];
    
    let newTheme: Theme = lightTheme;
    switch (nextMode) {
      case 'dark':
        newTheme = darkTheme;
        break;
      case 'high-contrast':
        newTheme = {
          ...lightTheme,
          mode: 'high-contrast',
          accessibility: { ...lightTheme.accessibility, highContrast: true }
        };
        break;
      case 'auto':
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        newTheme = prefersDark ? { ...darkTheme, mode: 'auto' } : { ...lightTheme, mode: 'auto' };
        break;
    }
    
    setThemeState(newTheme);
  };
  
  const updateAccessibilityPrefs = (prefs: Partial<AccessibilityPreferences>) => {
    setThemeState(prev => ({
      ...prev,
      accessibility: { ...prev.accessibility, ...prefs }
    }));
  };
  
  const value: ThemeContextValue = {
    theme,
    setTheme,
    toggleMode,
    updateAccessibilityPrefs,
    cssVariables
  };
  
  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
```

---

## 4. Accessibility Integration Architecture

### 4.1 Built-in Accessibility Patterns

Based on the existing accessibility utilities, the component library integrates accessibility as a foundational concern:

```typescript
// src/renderer/components/accessibility/AccessibilityProvider.tsx

import React from 'react';
import { 
  ScreenReaderManager, 
  FocusManager, 
  KeyboardNavigation,
  HighContrastMode 
} from '../../utils/accessibility';

export interface AccessibilityConfig {
  announcePageChanges: boolean;
  announceFormErrors: boolean;
  announceLoadingStates: boolean;
  announceSearchResults: boolean;
  enableSkipLinks: boolean;
  enableHighContrast: boolean;
  enableRovingTabindex: boolean;
  focusTrapModals: boolean;
}

// Global accessibility context
export const AccessibilityProvider: React.FC<{
  config: AccessibilityConfig;
  children: React.ReactNode;
}> = ({ config, children }) => {
  // Initialize accessibility managers
  React.useEffect(() => {
    const screenReader = ScreenReaderManager.getInstance();
    const focusManager = new FocusManager();
    const keyboardNav = new KeyboardNavigation();
    const highContrast = new HighContrastMode();
    
    // Store in global context for component access
    (window as any).__accessibility = {
      screenReader,
      focusManager,
      keyboardNav,
      highContrast,
      config
    };
  }, [config]);
  
  return (
    <>
      {/* Skip Links */}
      {config.enableSkipLinks && <SkipLinks />}
      
      {/* Screen Reader Live Regions */}
      <div id="sr-live-region" aria-live="polite" aria-atomic="true" className="sr-only" />
      <div id="sr-assertive-region" aria-live="assertive" aria-atomic="true" className="sr-only" />
      
      {children}
    </>
  );
};

const SkipLinks: React.FC = () => (
  <nav className="skip-links" aria-label="Skip navigation">
    <a href="#main-content" className="skip-link">
      Skip to main content
    </a>
    <a href="#search" className="skip-link">
      Skip to search
    </a>
    <a href="#navigation" className="skip-link">
      Skip to navigation
    </a>
  </nav>
);
```

### 4.2 Component-Level Accessibility Integration

Each component in the library automatically includes accessibility features:

```typescript
// src/renderer/components/core/Button/useButtonAccessibility.ts

import { useRef, useEffect } from 'react';
import { announceToScreenReader, AriaUtils } from '../../../utils/accessibility';

export interface ButtonA11yProps {
  announce?: boolean;
  announceText?: string;
  loadingText?: string;
  destructive?: boolean;
}

export const useButtonAccessibility = (props: ButtonA11yProps & {
  loading?: boolean;
  disabled?: boolean;
  children?: React.ReactNode;
}) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const previousLoading = useRef(props.loading);
  
  // Loading state announcements
  useEffect(() => {
    if (props.loading !== previousLoading.current) {
      if (props.loading) {
        announceToScreenReader(props.loadingText || 'Loading', 'polite');
      } else if (previousLoading.current) {
        announceToScreenReader('Finished loading', 'polite');
      }
      previousLoading.current = props.loading;
    }
  }, [props.loading, props.loadingText]);
  
  // Generate ARIA attributes
  const ariaProps = {
    'aria-disabled': props.disabled || props.loading || undefined,
    'aria-busy': props.loading || undefined,
    'aria-description': props.destructive ? 'This action cannot be undone' : undefined
  };
  
  // Handle accessible click announcement
  const handleAccessibleClick = (originalHandler?: (e: React.MouseEvent) => void) => 
    (e: React.MouseEvent<HTMLButtonElement>) => {
      if (props.disabled || props.loading) {
        e.preventDefault();
        return;
      }
      
      if (props.announce || props.announceText) {
        const message = props.announceText || `${props.children || 'Button'} activated`;
        announceToScreenReader(message, 'polite');
      }
      
      originalHandler?.(e);
    };
  
  return {
    buttonRef,
    ariaProps,
    handleAccessibleClick
  };
};
```

---

## 5. Performance Optimization Architecture

### 5.1 Bundle Optimization Strategy

```typescript
// src/renderer/components/index.ts - Tree-shakable exports

// Core components (always included)
export { Button, IconButton, ButtonGroup } from './core/Button';
export { Input, TextArea, Select } from './core/Input';

// Conditional exports for lazy loading
export const LazyModal = React.lazy(() => import('./core/Modal').then(m => ({ default: m.Modal })));
export const LazyDataTable = React.lazy(() => import('./patterns/DataTable').then(m => ({ default: m.DataTable })));

// Utility exports
export { ThemeProvider, useTheme } from './foundation/theme';
export { tokens } from './foundation/tokens';
export type { Theme, ColorTokens, TypographyTokens } from './foundation/tokens';
```

### 5.2 Component-Level Performance Patterns

```typescript
// src/renderer/components/core/Button/Button.tsx

import React, { memo, forwardRef } from 'react';
import { useButtonAccessibility } from './useButtonAccessibility';
import styles from './Button.module.css';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'small' | 'medium' | 'large';
  loading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

// Memoized component for performance
export const Button = memo(forwardRef<HTMLButtonElement, ButtonProps>(({
  children,
  variant = 'primary',
  size = 'medium',
  loading = false,
  disabled = false,
  icon,
  fullWidth = false,
  className = '',
  onClick,
  ...props
}, ref) => {
  // Accessibility hook
  const { ariaProps, handleAccessibleClick } = useButtonAccessibility({
    loading,
    disabled,
    children,
    announce: true
  });
  
  // Optimized class name generation
  const buttonClasses = React.useMemo(() => [
    styles.button,
    styles[`button--${variant}`],
    styles[`button--${size}`],
    loading && styles['button--loading'],
    disabled && styles['button--disabled'],
    fullWidth && styles['button--full-width'],
    className
  ].filter(Boolean).join(' '), [variant, size, loading, disabled, fullWidth, className]);
  
  return (
    <button
      ref={ref}
      className={buttonClasses}
      disabled={disabled || loading}
      onClick={handleAccessibleClick(onClick)}
      {...ariaProps}
      {...props}
    >
      {loading && <LoadingSpinner size="small" />}
      {!loading && icon && <span className={styles.icon}>{icon}</span>}
      {children && <span className={styles.text}>{children}</span>}
    </button>
  );
}));

Button.displayName = 'Button';
```

### 5.3 CSS Performance Strategy

```css
/* src/renderer/components/core/Button/Button.module.css */

/* Use CSS custom properties for theming */
.button {
  /* Base styles using CSS variables from theme */
  background: var(--color-primary-500);
  color: var(--color-surface-foreground);
  border: 1px solid transparent;
  border-radius: var(--border-radius-md);
  font-family: var(--font-family-sans);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  line-height: var(--line-height-none);
  padding: var(--button-padding-medium);
  
  /* Performance optimizations */
  transform: translateZ(0); /* Force GPU acceleration */
  will-change: background-color, border-color, color; /* Hint browser for optimization */
  
  /* Transitions only when motion is allowed */
  transition: 
    background-color var(--transition-duration) ease,
    border-color var(--transition-duration) ease,
    color var(--transition-duration) ease,
    transform var(--transition-duration) ease;
  
  /* Interaction states */
  cursor: pointer;
  outline: none;
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  
  /* Accessibility */
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}

.button:hover:not(:disabled):not(.button--loading) {
  background: var(--color-primary-600);
  transform: translateY(-1px);
}

.button:focus-visible {
  outline: 2px solid var(--color-primary-500);
  outline-offset: 2px;
}

.button:active:not(:disabled):not(.button--loading) {
  transform: translateY(0);
}

/* Variant optimizations */
.button--primary {
  background: var(--color-primary-500);
}

.button--secondary {
  background: var(--color-surface-muted);
  color: var(--color-text-primary);
  border-color: var(--color-border-default);
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .button {
    border-width: 2px;
    font-weight: var(--font-weight-semibold);
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .button {
    transition: none;
  }
  
  .button:hover:not(:disabled) {
    transform: none;
  }
}

/* Loading state */
.button--loading {
  cursor: wait;
  color: transparent;
}

.button--loading .icon,
.button--loading .text {
  opacity: 0;
}

/* Performance: Use contain for layout optimization */
.button {
  contain: layout style paint;
}
```

---

## 6. Component Composition & Reusability Patterns

### 6.1 Compound Component Pattern

```typescript
// src/renderer/components/patterns/SearchInterface/SearchInterface.tsx

import React, { createContext, useContext } from 'react';

interface SearchContextValue {
  query: string;
  results: any[];
  isLoading: boolean;
  onSearch: (query: string) => void;
  onClear: () => void;
}

const SearchContext = createContext<SearchContextValue | undefined>(undefined);

// Main compound component
export const SearchInterface = ({ children, ...props }: {
  children: React.ReactNode;
} & SearchContextValue) => {
  return (
    <SearchContext.Provider value={props}>
      <div className="search-interface" role="search" aria-label="Knowledge base search">
        {children}
      </div>
    </SearchContext.Provider>
  );
};

// Sub-components
SearchInterface.Input = ({ placeholder = "Search knowledge base..." }) => {
  const context = useContext(SearchContext);
  if (!context) throw new Error('SearchInterface.Input must be used within SearchInterface');
  
  return (
    <Input
      value={context.query}
      onChange={e => context.onSearch(e.target.value)}
      placeholder={placeholder}
      loading={context.isLoading}
      onClear={context.onClear}
    />
  );
};

SearchInterface.Results = ({ children }) => {
  const context = useContext(SearchContext);
  if (!context) throw new Error('SearchInterface.Results must be used within SearchInterface');
  
  return (
    <div className="search-results" aria-live="polite" aria-label={`${context.results.length} search results`}>
      {context.isLoading ? (
        <LoadingState />
      ) : (
        children
      )}
    </div>
  );
};

SearchInterface.NoResults = ({ message = "No results found" }) => {
  const context = useContext(SearchContext);
  if (!context || context.results.length > 0) return null;
  
  return (
    <div className="no-results" role="status">
      <Text variant="muted">{message}</Text>
    </div>
  );
};

// Usage example:
// <SearchInterface query={query} results={results} onSearch={handleSearch} isLoading={loading}>
//   <SearchInterface.Input placeholder="Search for solutions..." />
//   <SearchInterface.Results>
//     {results.map(result => <KBEntryCard key={result.id} entry={result} />)}
//   </SearchInterface.Results>
//   <SearchInterface.NoResults message="No knowledge base entries found. Try different search terms." />
// </SearchInterface>
```

### 6.2 Render Props Pattern for Complex Logic

```typescript
// src/renderer/components/patterns/DataFetcher/DataFetcher.tsx

export interface DataFetcherRenderProps<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

export interface DataFetcherProps<T> {
  fetcher: () => Promise<T>;
  children: (props: DataFetcherRenderProps<T>) => React.ReactNode;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
}

export const DataFetcher = <T,>({ fetcher, children, onSuccess, onError }: DataFetcherProps<T>) => {
  const [state, setState] = React.useState<{
    data: T | null;
    loading: boolean;
    error: Error | null;
  }>({
    data: null,
    loading: true,
    error: null
  });

  const fetchData = React.useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const data = await fetcher();
      setState({ data, loading: false, error: null });
      onSuccess?.(data);
    } catch (error) {
      const err = error as Error;
      setState({ data: null, loading: false, error: err });
      onError?.(err);
    }
  }, [fetcher, onSuccess, onError]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  return <>{children({ ...state, refetch: fetchData })}</>;
};

// Usage:
// <DataFetcher fetcher={fetchKBEntries}>
//   {({ data, loading, error, refetch }) => (
//     <>
//       {loading && <LoadingSpinner />}
//       {error && <ErrorMessage error={error} onRetry={refetch} />}
//       {data && <KBEntriesList entries={data} />}
//     </>
//   )}
// </DataFetcher>
```

---

## 7. Build & Distribution Strategy

### 7.1 Build Configuration

```javascript
// vite.config.ts - Component library build

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    react(),
    dts({
      insertTypesEntry: true,
      include: ['src/renderer/components/**/*'],
      exclude: ['src/**/*.test.tsx', 'src/**/*.stories.tsx']
    })
  ],
  
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/renderer/components/index.ts'),
        tokens: resolve(__dirname, 'src/renderer/components/foundation/tokens/index.ts'),
        theme: resolve(__dirname, 'src/renderer/components/foundation/theme/index.ts'),
        accessibility: resolve(__dirname, 'src/renderer/utils/accessibility.ts')
      },
      formats: ['es', 'cjs'],
      fileName: (format, entryName) => `${entryName}.${format}.js`
    },
    
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime'
      ],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM'
        },
        preserveModules: true,
        preserveModulesRoot: 'src/renderer/components'
      }
    },
    
    cssCodeSplit: true,
    sourcemap: true,
    
    // Bundle size optimization
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    }
  },
  
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/renderer/components'),
      '@tokens': resolve(__dirname, 'src/renderer/components/foundation/tokens'),
      '@utils': resolve(__dirname, 'src/renderer/utils')
    }
  }
});
```

### 7.2 Package Distribution

```json
// package.json - Component library distribution

{
  "name": "@mainframe-kb/components",
  "version": "1.0.0-mvp1",
  "description": "Component library for Mainframe Knowledge Base Assistant",
  
  "main": "dist/index.cjs.js",
  "module": "dist/index.es.js",
  "types": "dist/index.d.ts",
  
  "exports": {
    ".": {
      "import": "./dist/index.es.js",
      "require": "./dist/index.cjs.js",
      "types": "./dist/index.d.ts"
    },
    "./tokens": {
      "import": "./dist/tokens.es.js",
      "require": "./dist/tokens.cjs.js",
      "types": "./dist/tokens.d.ts"
    },
    "./theme": {
      "import": "./dist/theme.es.js",
      "require": "./dist/theme.cjs.js",
      "types": "./dist/theme.d.ts"
    },
    "./accessibility": {
      "import": "./dist/accessibility.es.js",
      "require": "./dist/accessibility.cjs.js",
      "types": "./dist/accessibility.d.ts"
    },
    "./styles": "./dist/styles.css"
  },
  
  "files": [
    "dist",
    "README.md",
    "CHANGELOG.md"
  ],
  
  "peerDependencies": {
    "react": ">=18.0.0",
    "react-dom": ">=18.0.0"
  },
  
  "sideEffects": ["**/*.css"],
  
  "keywords": [
    "react",
    "components",
    "design-system",
    "accessibility",
    "typescript",
    "mainframe",
    "knowledge-base"
  ]
}
```

### 7.3 Development Workflow

```yaml
# .github/workflows/component-library.yml

name: Component Library CI/CD

on:
  push:
    branches: [main, develop]
    paths: ['src/renderer/components/**']
  pull_request:
    branches: [main]
    paths: ['src/renderer/components/**']

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check
      - run: npm run test:components
      - run: npm run test:a11y
      
      - name: Component visual regression tests
        run: npm run test:visual
      
      - name: Bundle size analysis
        run: npm run analyze:bundle
        
  build:
    runs-on: ubuntu-latest
    needs: test
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      
      - run: npm ci
      - run: npm run build:components
      
      - name: Check bundle size limits
        run: npm run check:bundle-size
```

---

## 8. Success Metrics & Performance Targets

### 8.1 Performance Benchmarks

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| **Bundle Size** | ||
| Core components | < 50KB gzipped | webpack-bundle-analyzer |
| Individual component | < 5KB gzipped | Component-level analysis |
| Tree-shaking effectiveness | > 90% unused code eliminated | Bundle analysis |
| **Runtime Performance** | ||
| Component render time | < 16ms (60fps) | React DevTools Profiler |
| Theme switching | < 100ms | Performance API |
| First paint with components | < 200ms | Lighthouse |
| **Accessibility** | ||
| WCAG 2.1 AA compliance | 100% automated tests pass | axe-core testing |
| Screen reader compatibility | All components announce correctly | Manual testing |
| Keyboard navigation | 100% functionality accessible | Automated testing |
| Focus management | No focus traps or lost focus | Manual testing |

### 8.2 Quality Gates

```typescript
// tests/performance/component-benchmarks.test.ts

describe('Component Performance Benchmarks', () => {
  test('Button render time under 16ms', async () => {
    const renderTime = await measureRenderTime(() => 
      render(<Button>Test Button</Button>)
    );
    expect(renderTime).toBeLessThan(16);
  });
  
  test('Theme provider switching under 100ms', async () => {
    const switchTime = await measureThemeSwitchTime();
    expect(switchTime).toBeLessThan(100);
  });
  
  test('Bundle size within limits', () => {
    const bundleSize = getBundleSize('components');
    expect(bundleSize.gzipped).toBeLessThan(50 * 1024); // 50KB
  });
});
```

---

## 9. Implementation Roadmap

### 9.1 Phase 1: Foundation (Week 1-2)
- [ ] Set up design token system
- [ ] Implement theme provider and CSS variable system
- [ ] Create base primitive components (Box, Text, Stack)
- [ ] Integrate accessibility utilities
- [ ] Set up build and testing infrastructure

### 9.2 Phase 2: Core Components (Week 3-4)
- [ ] Implement core components (Button, Input, Select, Modal)
- [ ] Add comprehensive accessibility testing
- [ ] Performance optimization and bundle size analysis
- [ ] Documentation and Storybook stories

### 9.3 Phase 3: Patterns & Composition (Week 5-6)
- [ ] Build composite components (SearchInterface, KBEntryCard)
- [ ] Implement compound component patterns
- [ ] Add layout components and responsive utilities
- [ ] Integration testing with main application

### 9.4 Phase 4: Advanced Features (Week 7-8)
- [ ] Advanced theming capabilities
- [ ] Animation and motion systems (with reduced-motion support)
- [ ] Complex data visualization components
- [ ] Performance monitoring and optimization

<function_calls>
<invoke name="TodoWrite">
<parameter name="todos">[{"content": "Design component library architecture for Mainframe KB Assistant", "status": "completed", "activeForm": "Completed component library architecture design"}, {"content": "Analyze existing component structure and styling patterns", "status": "completed", "activeForm": "Completed analysis of current component patterns"}, {"content": "Create design token system architecture", "status": "completed", "activeForm": "Completed design token system design"}, {"content": "Plan theming and customization strategy", "status": "completed", "activeForm": "Completed theming strategy design"}, {"content": "Design accessibility integration patterns", "status": "completed", "activeForm": "Completed accessibility patterns design"}, {"content": "Architect performance optimization approach", "status": "completed", "activeForm": "Completed performance optimization architecture"}, {"content": "Design component composition and reusability patterns", "status": "completed", "activeForm": "Completed component composition patterns"}, {"content": "Plan build and distribution strategy", "status": "completed", "activeForm": "Completed build and distribution strategy"}]