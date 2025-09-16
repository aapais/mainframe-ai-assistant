import React, { ComponentType, ForwardedRef, ReactNode, forwardRef } from 'react';
import { BaseComponentProps } from '../base/ComponentBase';

/**
 * Advanced Component Composition and HOC Patterns
 */

// Render Props Pattern
export interface RenderPropComponent<T> {
  children: (props: T) => ReactNode;
}

/**
 * Compound Component Pattern Implementation
 */
export interface CompoundComponentProps {
  children: ReactNode;
  className?: string;
}

export function createCompoundComponent<T extends Record<string, ComponentType<any>>>(
  displayName: string,
  components: T
) {
  const CompoundComponent = ({ children, ...props }: CompoundComponentProps) => {
    return <div {...props}>{children}</div>;
  };

  // Attach sub-components
  Object.keys(components).forEach(key => {
    (CompoundComponent as any)[key] = components[key];
  });

  CompoundComponent.displayName = displayName;
  return CompoundComponent as typeof CompoundComponent & T;
}

/**
 * HOC for adding loading state
 */
export interface WithLoadingProps {
  loading?: boolean;
  loadingComponent?: ReactNode;
  loadingMessage?: string;
}

export function withLoading<P extends object>(
  WrappedComponent: ComponentType<P>,
  defaultLoadingComponent?: ReactNode
) {
  const WithLoadingComponent = forwardRef<any, P & WithLoadingProps>(
    ({ loading, loadingComponent, loadingMessage, ...props }, ref) => {
      if (loading) {
        return (
          <div className="loading-container">
            {loadingComponent || defaultLoadingComponent || (
              <div className="loading-spinner">
                <div className="spinner" />
                {loadingMessage && <span>{loadingMessage}</span>}
              </div>
            )}
          </div>
        );
      }

      return <WrappedComponent {...(props as P)} ref={ref} />;
    }
  );

  WithLoadingComponent.displayName = `withLoading(${WrappedComponent.displayName || WrappedComponent.name})`;
  return WithLoadingComponent;
}

/**
 * HOC for conditional rendering
 */
export interface ConditionalRenderProps {
  condition?: boolean;
  fallback?: ReactNode;
  wrapper?: ComponentType<any>;
}

export function withConditionalRender<P extends object>(
  WrappedComponent: ComponentType<P>
) {
  const ConditionalComponent = forwardRef<any, P & ConditionalRenderProps>(
    ({ condition = true, fallback = null, wrapper: Wrapper, ...props }, ref) => {
      if (!condition) {
        return <>{fallback}</>;
      }

      const component = <WrappedComponent {...(props as P)} ref={ref} />;
      return Wrapper ? <Wrapper>{component}</Wrapper> : component;
    }
  );

  ConditionalComponent.displayName = `withConditionalRender(${WrappedComponent.displayName || WrappedComponent.name})`;
  return ConditionalComponent;
}

/**
 * HOC for adding click outside functionality
 */
export interface ClickOutsideProps {
  onClickOutside?: () => void;
  disabled?: boolean;
  excludeRefs?: React.RefObject<HTMLElement>[];
}

export function withClickOutside<P extends object>(
  WrappedComponent: ComponentType<P>
) {
  const ClickOutsideComponent = forwardRef<any, P & ClickOutsideProps>(
    ({ onClickOutside, disabled, excludeRefs = [], ...props }, ref) => {
      const elementRef = React.useRef<HTMLElement>(null);
      const combinedRef = React.useCallback((node: HTMLElement) => {
        elementRef.current = node;
        if (typeof ref === 'function') {
          ref(node);
        } else if (ref) {
          ref.current = node;
        }
      }, [ref]);

      React.useEffect(() => {
        if (disabled || !onClickOutside) return;

        const handleClick = (event: MouseEvent) => {
          const target = event.target as Node;
          const isOutside = elementRef.current && !elementRef.current.contains(target);
          
          // Check if click is inside excluded elements
          const isInExcluded = excludeRefs.some(excludeRef => 
            excludeRef.current?.contains(target)
          );

          if (isOutside && !isInExcluded) {
            onClickOutside();
          }
        };

        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
      }, [onClickOutside, disabled, excludeRefs]);

      return <WrappedComponent {...(props as P)} ref={combinedRef} />;
    }
  );

  ClickOutsideComponent.displayName = `withClickOutside(${WrappedComponent.displayName || WrappedComponent.name})`;
  return ClickOutsideComponent;
}

/**
 * HOC for keyboard navigation
 */
export interface KeyboardNavigationProps {
  onKeyDown?: (event: KeyboardEvent) => void;
  keyMap?: Record<string, () => void>;
  trapFocus?: boolean;
}

export function withKeyboardNavigation<P extends object>(
  WrappedComponent: ComponentType<P>
) {
  const KeyboardNavigationComponent = forwardRef<any, P & KeyboardNavigationProps>(
    ({ onKeyDown, keyMap, trapFocus, ...props }, ref) => {
      const elementRef = React.useRef<HTMLElement>(null);
      
      React.useEffect(() => {
        const element = elementRef.current;
        if (!element) return;

        const handleKeyDown = (event: KeyboardEvent) => {
          // Handle custom key mappings
          if (keyMap) {
            const handler = keyMap[event.key] || keyMap[`${event.ctrlKey ? 'Ctrl+' : ''}${event.key}`];
            if (handler) {
              event.preventDefault();
              handler();
              return;
            }
          }

          // Handle focus trapping
          if (trapFocus && (event.key === 'Tab')) {
            const focusableElements = element.querySelectorAll(
              'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            
            if (focusableElements.length > 0) {
              const firstElement = focusableElements[0] as HTMLElement;
              const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;
              
              if (event.shiftKey && document.activeElement === firstElement) {
                event.preventDefault();
                lastElement.focus();
              } else if (!event.shiftKey && document.activeElement === lastElement) {
                event.preventDefault();
                firstElement.focus();
              }
            }
          }

          onKeyDown?.(event);
        };

        element.addEventListener('keydown', handleKeyDown);
        return () => element.removeEventListener('keydown', handleKeyDown);
      }, [onKeyDown, keyMap, trapFocus]);

      const combinedRef = React.useCallback((node: HTMLElement) => {
        elementRef.current = node;
        if (typeof ref === 'function') {
          ref(node);
        } else if (ref) {
          ref.current = node;
        }
      }, [ref]);

      return <WrappedComponent {...(props as P)} ref={combinedRef} />;
    }
  );

  KeyboardNavigationComponent.displayName = `withKeyboardNavigation(${WrappedComponent.displayName || WrappedComponent.name})`;
  return KeyboardNavigationComponent;
}

/**
 * HOC for adding drag and drop functionality
 */
export interface DragDropProps {
  draggable?: boolean;
  onDragStart?: (event: DragEvent) => void;
  onDragOver?: (event: DragEvent) => void;
  onDrop?: (event: DragEvent) => void;
  dropZone?: boolean;
  dragData?: any;
}

export function withDragDrop<P extends object>(
  WrappedComponent: ComponentType<P>
) {
  const DragDropComponent = forwardRef<any, P & DragDropProps>(
    ({ 
      draggable, 
      onDragStart, 
      onDragOver, 
      onDrop, 
      dropZone, 
      dragData,
      ...props 
    }, ref) => {
      const handleDragStart = React.useCallback((event: React.DragEvent) => {
        if (dragData) {
          event.dataTransfer.setData('application/json', JSON.stringify(dragData));
        }
        onDragStart?.(event.nativeEvent);
      }, [onDragStart, dragData]);

      const handleDragOver = React.useCallback((event: React.DragEvent) => {
        if (dropZone) {
          event.preventDefault();
        }
        onDragOver?.(event.nativeEvent);
      }, [onDragOver, dropZone]);

      const handleDrop = React.useCallback((event: React.DragEvent) => {
        if (dropZone) {
          event.preventDefault();
          try {
            const data = event.dataTransfer.getData('application/json');
            const parsedData = JSON.parse(data);
            // Add parsed data to the event for convenience
            (event.nativeEvent as any).parsedData = parsedData;
          } catch (error) {
            // Data might not be JSON
          }
        }
        onDrop?.(event.nativeEvent);
      }, [onDrop, dropZone]);

      const dragProps = {
        ...(draggable && {
          draggable: true,
          onDragStart: handleDragStart,
        }),
        ...(dropZone && {
          onDragOver: handleDragOver,
          onDrop: handleDrop,
        }),
      };

      return (
        <WrappedComponent 
          {...(props as P)} 
          {...dragProps}
          ref={ref} 
        />
      );
    }
  );

  DragDropComponent.displayName = `withDragDrop(${WrappedComponent.displayName || WrappedComponent.name})`;
  return DragDropComponent;
}

/**
 * Composition helper for combining multiple HOCs
 */
export function compose<T>(
  ...hocs: Array<(component: ComponentType<any>) => ComponentType<any>>
): (component: ComponentType<T>) => ComponentType<T> {
  return (component: ComponentType<T>) => {
    return hocs.reduceRight((acc, hoc) => hoc(acc), component);
  };
}

/**
 * Provider composition helper
 */
export interface ProviderComposerProps {
  providers: Array<ComponentType<{ children: ReactNode }>>;
  children: ReactNode;
}

export const ProviderComposer: React.FC<ProviderComposerProps> = ({ 
  providers, 
  children 
}) => {
  return providers.reduceRight(
    (acc, Provider) => <Provider>{acc}</Provider>,
    children as React.ReactElement
  );
};

/**
 * Render props component for intersection observer
 */
export interface IntersectionObserverRenderProps {
  isIntersecting: boolean;
  entry: IntersectionObserverEntry | null;
  ref: (node: Element | null) => void;
}

export interface IntersectionObserverProps {
  children: (props: IntersectionObserverRenderProps) => ReactNode;
  options?: IntersectionObserverInit;
  onIntersect?: (entry: IntersectionObserverEntry) => void;
}

export const IntersectionObserverComponent: React.FC<IntersectionObserverProps> = ({
  children,
  options = { threshold: 0.1 },
  onIntersect
}) => {
  const [entry, setEntry] = React.useState<IntersectionObserverEntry | null>(null);
  const [isIntersecting, setIsIntersecting] = React.useState(false);
  const elementRef = React.useRef<Element | null>(null);

  const setRef = React.useCallback((node: Element | null) => {
    elementRef.current = node;
  }, []);

  React.useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setEntry(entry);
        setIsIntersecting(entry.isIntersecting);
        if (entry.isIntersecting) {
          onIntersect?.(entry);
        }
      },
      options
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [options, onIntersect]);

  return (
    <>
      {children({ isIntersecting, entry, ref: setRef })}
    </>
  );
};

/**
 * Factory for creating reusable compound components
 */
export function createCompoundComponentFactory<T extends Record<string, any>>() {
  return function <U extends Record<string, ComponentType<any>>>(
    MainComponent: ComponentType<T>,
    subComponents: U,
    displayName?: string
  ) {
    const CompoundComponent = forwardRef<any, T>((props, ref) => {
      return <MainComponent {...props} ref={ref} />;
    });

    // Attach sub-components
    Object.keys(subComponents).forEach(key => {
      (CompoundComponent as any)[key] = subComponents[key];
    });

    CompoundComponent.displayName = displayName || MainComponent.displayName || MainComponent.name;
    return CompoundComponent as typeof CompoundComponent & U;
  };
}

/**
 * Enhanced forwardRef with better TypeScript support
 */
export function createForwardRefComponent<T, P = {}>(
  render: (props: P, ref: ForwardedRef<T>) => React.ReactElement | null,
  displayName?: string
) {
  const component = forwardRef<T, P>(render);
  if (displayName) {
    component.displayName = displayName;
  }
  return component;
}

/**
 * Example usage of compound component pattern
 */
export const ExampleCard = createCompoundComponent('Card', {
  Header: ({ children }: { children: ReactNode }) => (
    <div className="card-header">{children}</div>
  ),
  Body: ({ children }: { children: ReactNode }) => (
    <div className="card-body">{children}</div>
  ),
  Footer: ({ children }: { children: ReactNode }) => (
    <div className="card-footer">{children}</div>
  ),
});

// Usage:
// <ExampleCard>
//   <ExampleCard.Header>Title</ExampleCard.Header>
//   <ExampleCard.Body>Content</ExampleCard.Body>
//   <ExampleCard.Footer>Actions</ExampleCard.Footer>
// </ExampleCard>
