/**
 * Base Component Type System
 * Provides foundation types for all reusable components
 */

import { ReactNode, HTMLAttributes, CSSProperties } from 'react';

// =========================
// CORE BASE INTERFACES
// =========================

/**
 * Universal base properties for all components
 */
export interface BaseComponentProps {
  /** Unique identifier for the component */
  id?: string;

  /** CSS class names */
  className?: string;

  /** Inline styles */
  style?: CSSProperties;

  /** Data attributes for testing and analytics */
  'data-testid'?: string;
  'data-analytics'?: string;

  /** Accessibility properties */
  'aria-label'?: string;
  'aria-describedby'?: string;
  'aria-labelledby'?: string;
  role?: string;

  /** Component visibility and interaction state */
  hidden?: boolean;
  disabled?: boolean;
  readonly?: boolean;

  /** Children elements */
  children?: ReactNode;
}

/**
 * Enhanced component props with size and variant support
 */
export interface StyledComponentProps extends BaseComponentProps {
  /** Component size variant */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';

  /** Visual variant */
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';

  /** Color scheme preference */
  colorScheme?: 'light' | 'dark' | 'auto';

  /** Border radius preference */
  radius?: 'none' | 'sm' | 'md' | 'lg' | 'full';
}

/**
 * Interactive component base with event handling
 */
export interface InteractiveComponentProps extends StyledComponentProps {
  /** Loading state */
  loading?: boolean;

  /** Focus management */
  autoFocus?: boolean;
  tabIndex?: number;

  /** Event handlers */
  onClick?: (event: React.MouseEvent) => void;
  onFocus?: (event: React.FocusEvent) => void;
  onBlur?: (event: React.FocusEvent) => void;
  onKeyDown?: (event: React.KeyboardEvent) => void;
  onKeyUp?: (event: React.KeyboardEvent) => void;
}

/**
 * Form component base interface
 */
export interface FormComponentProps<TValue = any> extends InteractiveComponentProps {
  /** Field name for form binding */
  name: string;

  /** Current value */
  value?: TValue;

  /** Default value */
  defaultValue?: TValue;

  /** Value change handler */
  onChange?: (value: TValue, event?: React.ChangeEvent) => void;

  /** Validation state */
  invalid?: boolean;
  valid?: boolean;

  /** Error message */
  error?: string;

  /** Help text */
  helpText?: string;

  /** Field label */
  label?: string;

  /** Required field indicator */
  required?: boolean;

  /** Placeholder text */
  placeholder?: string;
}

// =========================
// ADVANCED TYPE PATTERNS
// =========================

/**
 * Generic component factory type for creating typed components
 */
export type ComponentFactory<TProps extends BaseComponentProps = BaseComponentProps> = {
  (props: TProps): ReactNode;
  displayName?: string;
  defaultProps?: Partial<TProps>;
};

/**
 * Polymorphic component pattern for flexible element rendering
 */
export type PolymorphicComponent<TProps, TElement extends React.ElementType = 'div'> = {
  <C extends React.ElementType = TElement>(
    props: PolymorphicComponentProps<TProps, C>
  ): ReactNode;
} & {
  displayName?: string;
};

export type PolymorphicComponentProps<TProps, TElement extends React.ElementType> =
  TProps &
  Omit<React.ComponentPropsWithoutRef<TElement>, keyof TProps> & {
    as?: TElement;
  };

/**
 * Render prop pattern for flexible content rendering
 */
export interface RenderPropComponent<TData = any> extends BaseComponentProps {
  render?: (data: TData) => ReactNode;
  children?: ((data: TData) => ReactNode) | ReactNode;
}

/**
 * Compound component pattern for component composition
 */
export interface CompoundComponent<TProps = {}> extends ComponentFactory<TProps> {
  Item?: ComponentFactory<any>;
  Header?: ComponentFactory<any>;
  Body?: ComponentFactory<any>;
  Footer?: ComponentFactory<any>;
  [key: string]: any;
}

// =========================
// PERFORMANCE OPTIMIZATION TYPES
// =========================

/**
 * Memoization configuration for performance optimization
 */
export interface MemoizationConfig {
  /** Enable React.memo */
  memo?: boolean;

  /** Custom comparison function for React.memo */
  compare?: (prevProps: any, nextProps: any) => boolean;

  /** Properties to exclude from memoization comparison */
  excludeFromMemo?: string[];
}

/**
 * Virtual scrolling support for large lists
 */
export interface VirtualizedComponentProps extends BaseComponentProps {
  /** Total number of items */
  itemCount: number;

  /** Height of each item */
  itemHeight: number | ((index: number) => number);

  /** Container height */
  height: number;

  /** Width of container */
  width?: number;

  /** Overscan count for performance */
  overscanCount?: number;
}

/**
 * Lazy loading configuration
 */
export interface LazyComponentProps extends BaseComponentProps {
  /** Enable lazy loading */
  lazy?: boolean;

  /** Intersection observer options */
  threshold?: number;
  rootMargin?: string;

  /** Fallback component while loading */
  fallback?: ReactNode;

  /** Loading placeholder */
  placeholder?: ReactNode;
}

// =========================
// EXTENSION & THEMING TYPES
// =========================

/**
 * Theme-aware component interface
 */
export interface ThemedComponentProps extends BaseComponentProps {
  /** Theme override */
  theme?: string | object;

  /** CSS custom properties */
  css?: CSSProperties;

  /** Style variant mapping */
  variants?: Record<string, CSSProperties>;
}

/**
 * Plugin/extension system for components
 */
export interface ExtensibleComponentProps extends BaseComponentProps {
  /** Plugins to apply */
  plugins?: ComponentPlugin[];

  /** Custom behaviors */
  behaviors?: ComponentBehavior[];

  /** Extension points */
  extensions?: Record<string, any>;
}

export interface ComponentPlugin {
  name: string;
  version: string;
  apply: (component: any) => any;
  config?: Record<string, any>;
}

export interface ComponentBehavior {
  name: string;
  handler: (props: any, context: any) => any;
  dependencies?: string[];
}

// =========================
// ERROR HANDLING & VALIDATION
// =========================

/**
 * Error boundary component props
 */
export interface ErrorBoundaryProps extends BaseComponentProps {
  /** Error fallback component */
  fallback?: (error: Error, errorInfo: any) => ReactNode;

  /** Error handler */
  onError?: (error: Error, errorInfo: any) => void;

  /** Recovery handler */
  onRetry?: () => void;

  /** Enable error reporting */
  reportError?: boolean;
}

/**
 * Validation configuration
 */
export interface ValidationConfig<T = any> {
  /** Validation rules */
  rules?: ValidationRule<T>[];

  /** Validation strategy */
  strategy?: 'onChange' | 'onBlur' | 'onSubmit' | 'realTime';

  /** Debounce delay for validation */
  debounce?: number;

  /** Async validation */
  asyncValidation?: (value: T) => Promise<ValidationResult>;
}

export interface ValidationRule<T = any> {
  name: string;
  message: string;
  validator: (value: T) => boolean | Promise<boolean>;
  dependencies?: string[];
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings?: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  type: 'error' | 'warning';
  meta?: Record<string, any>;
}

// =========================
// UTILITY TYPES
// =========================

/**
 * Extract component props type
 */
export type ComponentPropsType<T> = T extends ComponentFactory<infer P> ? P : never;

/**
 * Merge component props with HTML attributes
 */
export type MergedProps<TComponent, TElement extends keyof HTMLElementTagNameMap> =
  TComponent & HTMLAttributes<HTMLElementTagNameMap[TElement]>;

/**
 * Optional properties helper
 */
export type OptionalProps<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Required properties helper
 */
export type RequiredProps<T, K extends keyof T> = T & Required<Pick<T, K>>;