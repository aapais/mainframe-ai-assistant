/**
 * Advanced Composition Patterns
 * Reusable component composition strategies for maximum flexibility
 */

import React, {
  ComponentType,
  ReactNode,
  ReactElement,
  Children,
  cloneElement,
  isValidElement,
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo
} from 'react';

import { BaseComponentProps } from '../types/BaseComponent';

// =========================
// COMPOUND COMPONENTS
// =========================

/**
 * Compound component factory
 */
export function createCompoundComponent<TProps extends BaseComponentProps, TContext = any>(
  name: string,
  contextValue?: TContext
) {
  const Context = createContext<TContext | undefined>(contextValue);

  const useCompoundContext = () => {
    const context = useContext(Context);
    if (context === undefined) {
      throw new Error(`use${name}Context must be used within a ${name} component`);
    }
    return context;
  };

  interface CompoundComponentType<P> extends ComponentType<P> {
    displayName: string;
    Context: typeof Context;
    useContext: typeof useCompoundContext;
  }

  function withCompoundProvider<P extends TProps>(
    Component: ComponentType<P>
  ): CompoundComponentType<P> {
    const CompoundComponent = (props: P) => (
      <Context.Provider value={contextValue}>
        <Component {...props} />
      </Context.Provider>
    );

    CompoundComponent.displayName = name;
    CompoundComponent.Context = Context;
    CompoundComponent.useContext = useCompoundContext;

    return CompoundComponent as CompoundComponentType<P>;
  }

  return {
    Context,
    useContext: useCompoundContext,
    withProvider: withCompoundProvider
  };
}

/**
 * Example: Card compound component
 */
interface CardContextValue {
  variant: 'default' | 'elevated' | 'outlined';
  size: 'sm' | 'md' | 'lg';
  padding: string;
}

const { Context: CardContext, useContext: useCardContext, withProvider } = createCompoundComponent<
  BaseComponentProps,
  CardContextValue
>('Card', {
  variant: 'default',
  size: 'md',
  padding: '16px'
});

// =========================
// RENDER PROPS PATTERN
// =========================

/**
 * Generic render prop component
 */
export interface RenderPropComponent<TData, TActions = {}> extends BaseComponentProps {
  /** Render function that receives data and actions */
  render?: (data: TData, actions: TActions) => ReactNode;

  /** Children as render function (alternative to render prop) */
  children?: ((data: TData, actions: TActions) => ReactNode) | ReactNode;
}

/**
 * Render prop factory
 */
export function createRenderProp<TData, TActions = {}, TProps extends BaseComponentProps = BaseComponentProps>(
  useData: (props: TProps) => { data: TData; actions: TActions }
) {
  return (props: TProps & RenderPropComponent<TData, TActions>) => {
    const { render, children, ...restProps } = props;
    const { data, actions } = useData(restProps as TProps);

    if (render) {
      return <>{render(data, actions)}</>;
    }

    if (typeof children === 'function') {
      return <>{children(data, actions)}</>;
    }

    return <>{children}</>;
  };
}

/**
 * Example: Data fetcher render prop
 */
interface DataFetcherProps extends BaseComponentProps {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
}

interface DataFetcherData<T = any> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

interface DataFetcherActions {
  refetch: () => void;
  reset: () => void;
}

export const DataFetcher = createRenderProp<
  DataFetcherData,
  DataFetcherActions,
  DataFetcherProps
>((props) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(props.url, {
        method: props.method || 'GET',
        headers: props.headers
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [props.url, props.method, props.headers]);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return {
    data: { data, loading, error },
    actions: { refetch: fetchData, reset }
  };
});

// =========================
// SLOT PATTERN
// =========================

/**
 * Slot-based component system
 */
export interface SlotProps {
  /** Slot name identifier */
  name: string;

  /** Children to render in slot */
  children?: ReactNode;

  /** Default content when slot is empty */
  fallback?: ReactNode;

  /** Slot-specific props */
  slotProps?: Record<string, any>;
}

export const Slot: React.FC<SlotProps> = ({ children, fallback }) => {
  return <>{children || fallback}</>;
};

/**
 * Slot provider component
 */
export interface SlotProviderProps extends BaseComponentProps {
  /** Slots configuration */
  slots?: Record<string, ReactNode>;

  /** Children components */
  children: ReactNode;
}

export const SlotProvider: React.FC<SlotProviderProps> = ({ slots = {}, children }) => {
  const slotsWithFallback = useMemo(() => {
    const childrenArray = Children.toArray(children);
    const slotChildren: Record<string, ReactNode> = {};

    // Extract slot children
    childrenArray.forEach((child) => {
      if (isValidElement(child) && child.type === Slot) {
        const slotName = child.props.name;
        if (slotName) {
          slotChildren[slotName] = child.props.children;
        }
      }
    });

    return { ...slots, ...slotChildren };
  }, [slots, children]);

  return (
    <>
      {Children.map(children, (child) => {
        if (isValidElement(child) && typeof child.type !== 'string') {
          return cloneElement(child, {
            ...child.props,
            slots: slotsWithFallback
          });
        }
        return child;
      })}
    </>
  );
};

// =========================
// POLYMORPHIC COMPONENTS
// =========================

/**
 * Create polymorphic component
 */
export function createPolymorphicComponent<TBaseProps extends BaseComponentProps>(
  baseComponent: ComponentType<TBaseProps>
) {
  return function PolymorphicComponent<TElement extends React.ElementType = 'div'>(
    props: TBaseProps & {
      as?: TElement;
    } & Omit<React.ComponentPropsWithoutRef<TElement>, keyof TBaseProps>
  ) {
    const { as: Component = baseComponent, ...restProps } = props;
    return <Component {...restProps} />;
  };
}

/**
 * Example: Polymorphic text component
 */
interface TextProps extends BaseComponentProps {
  variant?: 'h1' | 'h2' | 'h3' | 'p' | 'span';
  weight?: 'normal' | 'medium' | 'semibold' | 'bold';
  size?: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl';
}

const BaseText: React.FC<TextProps> = ({ variant = 'p', weight, size, children, className, ...props }) => {
  const Element = variant as keyof JSX.IntrinsicElements;
  const classes = `text-${size} font-${weight} ${className || ''}`.trim();

  return (
    <Element className={classes} {...props}>
      {children}
    </Element>
  );
};

export const Text = createPolymorphicComponent(BaseText);

// =========================
// PROVIDER PATTERN
// =========================

/**
 * Generic provider factory
 */
export function createProvider<TValue, TProps = {}>(
  name: string,
  useProviderValue: (props: TProps) => TValue
) {
  const Context = createContext<TValue | undefined>(undefined);

  const Provider: React.FC<TProps & { children: ReactNode }> = ({ children, ...props }) => {
    const value = useProviderValue(props as TProps);

    return (
      <Context.Provider value={value}>
        {children}
      </Context.Provider>
    );
  };

  Provider.displayName = `${name}Provider`;

  const useContext = (): TValue => {
    const context = React.useContext(Context);
    if (context === undefined) {
      throw new Error(`use${name} must be used within a ${name}Provider`);
    }
    return context;
  };

  return {
    Provider,
    useContext,
    Context
  };
}

/**
 * Example: Theme provider
 */
interface ThemeValue {
  colors: Record<string, string>;
  spacing: Record<string, string>;
  typography: Record<string, string>;
  mode: 'light' | 'dark';
  setMode: (mode: 'light' | 'dark') => void;
}

interface ThemeProviderProps {
  defaultTheme?: Partial<ThemeValue>;
  defaultMode?: 'light' | 'dark';
}

const { Provider: ThemeProvider, useContext: useTheme } = createProvider<
  ThemeValue,
  ThemeProviderProps
>('Theme', ({ defaultMode = 'light', defaultTheme = {} }) => {
  const [mode, setMode] = useState(defaultMode);

  const theme = useMemo(() => ({
    colors: {
      primary: '#3b82f6',
      secondary: '#64748b',
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      ...defaultTheme.colors
    },
    spacing: {
      xs: '0.25rem',
      sm: '0.5rem',
      md: '1rem',
      lg: '1.5rem',
      xl: '2rem',
      ...defaultTheme.spacing
    },
    typography: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      ...defaultTheme.typography
    },
    mode,
    setMode,
    ...defaultTheme
  }), [mode, defaultTheme]);

  return theme;
});

export { ThemeProvider, useTheme };

// =========================
// COMPOSITION UTILITIES
// =========================

/**
 * Compose multiple HOCs
 */
export function compose<TProps>(...hocs: Array<(Component: ComponentType<any>) => ComponentType<any>>) {
  return (Component: ComponentType<TProps>) => {
    return hocs.reduceRight((AccumulatedComponent, hoc) => hoc(AccumulatedComponent), Component);
  };
}

/**
 * Create forwarded ref component
 */
export function createForwardRef<TProps, TElement>(
  render: (props: TProps, ref: React.Ref<TElement>) => ReactElement | null
) {
  const Component = React.forwardRef<TElement, TProps>(render);
  return Component;
}

/**
 * Merge props utility
 */
export function mergeProps<T extends Record<string, any>>(...propsList: Array<Partial<T>>): T {
  return propsList.reduce((merged, props) => {
    const result = { ...merged };

    Object.keys(props).forEach((key) => {
      const mergedValue = merged[key];
      const propsValue = props[key];

      // Merge className strings
      if (key === 'className' && typeof mergedValue === 'string' && typeof propsValue === 'string') {
        result[key] = `${mergedValue} ${propsValue}`.trim();
      }
      // Merge style objects
      else if (key === 'style' && typeof mergedValue === 'object' && typeof propsValue === 'object') {
        result[key] = { ...mergedValue, ...propsValue };
      }
      // Merge event handlers
      else if (key.startsWith('on') && typeof mergedValue === 'function' && typeof propsValue === 'function') {
        result[key] = (...args: any[]) => {
          mergedValue(...args);
          propsValue(...args);
        };
      }
      // Default: override
      else {
        result[key] = propsValue;
      }
    });

    return result;
  }, {} as T);
}

/**
 * Create displayName for HOCs
 */
export function getDisplayName(Component: ComponentType<any>): string {
  return Component.displayName || Component.name || 'Component';
}

/**
 * HOC with display name
 */
export function withDisplayName<TProps>(
  hoc: (Component: ComponentType<TProps>) => ComponentType<TProps>,
  hocName: string
) {
  return (Component: ComponentType<TProps>) => {
    const WrappedComponent = hoc(Component);
    WrappedComponent.displayName = `${hocName}(${getDisplayName(Component)})`;
    return WrappedComponent;
  };
}