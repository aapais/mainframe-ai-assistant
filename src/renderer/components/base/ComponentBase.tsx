import React, { Component, ErrorInfo, ReactNode, createRef } from 'react';
import { createPortal } from 'react-dom';
import { debounce, throttle } from 'lodash';

/**
 * Enhanced Base Component with advanced patterns
 * Provides common functionality for all components
 */

export interface BaseComponentProps {
  className?: string;
  testId?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
  onMount?: () => void;
  onUnmount?: () => void;
  errorBoundary?: boolean;
  performanceTracking?: boolean;
  debug?: boolean;
}

export interface BaseComponentState {
  hasError: boolean;
  errorMessage?: string;
  isVisible: boolean;
  isFocused: boolean;
  isHovered: boolean;
  renderCount: number;
}

/**
 * Enhanced Error Boundary with detailed error reporting
 */
export class EnhancedErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode; onError?: (error: Error, errorInfo: ErrorInfo) => void },
  { hasError: boolean; error?: Error }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Component Error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
    
    // Report to error tracking service
    if (window.electronAPI?.reportError) {
      window.electronAPI.reportError({
        error: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString()
      });
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="error-boundary-fallback">
          <h3>Something went wrong</h3>
          <p>{this.state.error?.message}</p>
          <button onClick={() => this.setState({ hasError: false, error: undefined })}>
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Base Component with lifecycle management and performance tracking
 */
export abstract class BaseComponent<P extends BaseComponentProps = BaseComponentProps, S extends BaseComponentState = BaseComponentState> extends Component<P, S> {
  protected elementRef = createRef<HTMLElement>();
  protected renderStartTime: number = 0;
  protected intersectionObserver?: IntersectionObserver;
  protected resizeObserver?: ResizeObserver;

  constructor(props: P) {
    super(props);
    this.state = {
      hasError: false,
      isVisible: false,
      isFocused: false,
      isHovered: false,
      renderCount: 0
    } as S;

    // Bind methods for performance
    this.handleFocus = this.handleFocus.bind(this);
    this.handleBlur = this.handleBlur.bind(this);
    this.handleMouseEnter = this.handleMouseEnter.bind(this);
    this.handleMouseLeave = this.handleMouseLeave.bind(this);
  }

  componentDidMount() {
    this.props.onMount?.();
    this.setupObservers();
    this.trackPerformance('mount');
  }

  componentWillUnmount() {
    this.props.onUnmount?.();
    this.cleanupObservers();
    this.trackPerformance('unmount');
  }

  componentDidUpdate() {
    this.trackPerformance('update');
  }

  private setupObservers() {
    if (this.elementRef.current) {
      // Intersection Observer for visibility tracking
      this.intersectionObserver = new IntersectionObserver(
        (entries) => {
          const [entry] = entries;
          this.setState({ isVisible: entry.isIntersecting } as Partial<S>);
        },
        { threshold: 0.1 }
      );
      this.intersectionObserver.observe(this.elementRef.current);

      // Resize Observer for responsive behavior
      this.resizeObserver = new ResizeObserver(
        debounce((entries) => {
          this.onResize?.(entries[0]);
        }, 100)
      );
      this.resizeObserver.observe(this.elementRef.current);
    }
  }

  private cleanupObservers() {
    this.intersectionObserver?.disconnect();
    this.resizeObserver?.disconnect();
  }

  private trackPerformance(event: string) {
    if (this.props.performanceTracking) {
      const timestamp = performance.now();
      console.log(`[${this.constructor.name}] ${event} at ${timestamp}ms`);
      
      // Track render performance
      if (event === 'update' && this.renderStartTime > 0) {
        const renderTime = timestamp - this.renderStartTime;
        if (renderTime > 16) { // Flag slow renders (>16ms)
          console.warn(`[${this.constructor.name}] Slow render: ${renderTime}ms`);
        }
      }
    }
  }

  protected handleFocus() {
    this.setState({ isFocused: true } as Partial<S>);
  }

  protected handleBlur() {
    this.setState({ isFocused: false } as Partial<S>);
  }

  protected handleMouseEnter() {
    this.setState({ isHovered: true } as Partial<S>);
  }

  protected handleMouseLeave() {
    this.setState({ isHovered: false } as Partial<S>);
  }

  // Override points for subclasses
  protected onResize?(entry: ResizeObserverEntry): void;
  protected onVisibilityChange?(isVisible: boolean): void;

  // Utility methods
  protected createPortal(content: ReactNode, target?: Element) {
    return createPortal(content, target || document.body);
  }

  protected debounce = debounce;
  protected throttle = throttle;

  // Accessibility helpers
  protected generateId(prefix: string = 'component'): string {
    return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
  }

  protected getAriaProps() {
    return {
      'aria-label': this.props['aria-label'],
      'aria-describedby': this.props['aria-describedby'],
    };
  }

  render() {
    this.renderStartTime = performance.now();
    this.setState(prevState => ({ 
      renderCount: prevState.renderCount + 1 
    } as Partial<S>));
    
    const content = this.renderContent();
    
    return this.props.errorBoundary ? (
      <EnhancedErrorBoundary>
        {content}
      </EnhancedErrorBoundary>
    ) : content;
  }

  protected abstract renderContent(): ReactNode;
}

/**
 * Higher-Order Component for adding base functionality
 */
export function withBaseComponent<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  options: {
    errorBoundary?: boolean;
    performanceTracking?: boolean;
    displayName?: string;
  } = {}
) {
  const WithBaseComponent = React.forwardRef<any, P & BaseComponentProps>(
    (props, ref) => {
      const enhancedProps = {
        ...props,
        errorBoundary: options.errorBoundary ?? props.errorBoundary,
        performanceTracking: options.performanceTracking ?? props.performanceTracking,
      };

      const content = <WrappedComponent {...enhancedProps} ref={ref} />;

      return enhancedProps.errorBoundary ? (
        <EnhancedErrorBoundary>
          {content}
        </EnhancedErrorBoundary>
      ) : content;
    }
  );

  WithBaseComponent.displayName = 
    options.displayName || `withBaseComponent(${WrappedComponent.displayName || WrappedComponent.name})`;

  return WithBaseComponent;
}

/**
 * Hook for base component functionality in functional components
 */
export function useBaseComponent(options: {
  performanceTracking?: boolean;
  onMount?: () => void;
  onUnmount?: () => void;
} = {}) {
  const elementRef = React.useRef<HTMLElement>(null);
  const [state, setState] = React.useState({
    isVisible: false,
    isFocused: false,
    isHovered: false,
    renderCount: 0
  });

  const renderStartTime = React.useRef(0);

  React.useEffect(() => {
    options.onMount?.();
    return () => options.onUnmount?.();
  }, [options]);

  React.useEffect(() => {
    if (options.performanceTracking) {
      const renderTime = performance.now() - renderStartTime.current;
      if (renderTime > 16) {
        console.warn(`Slow render: ${renderTime}ms`);
      }
    }
  });

  const handlers = React.useMemo(() => ({
    onFocus: () => setState(prev => ({ ...prev, isFocused: true })),
    onBlur: () => setState(prev => ({ ...prev, isFocused: false })),
    onMouseEnter: () => setState(prev => ({ ...prev, isHovered: true })),
    onMouseLeave: () => setState(prev => ({ ...prev, isHovered: false }))
  }), []);

  // Track render performance
  React.useLayoutEffect(() => {
    renderStartTime.current = performance.now();
  });

  return {
    elementRef,
    state,
    handlers,
    generateId: React.useCallback((prefix: string = 'component') => 
      `${prefix}-${Math.random().toString(36).substr(2, 9)}`, []),
  };
}
