/**
 * Component Composition Patterns Tests
 *
 * Tests for component composition, HOCs, render props, compound components,
 * and advanced composition patterns including performance optimizations.
 *
 * @author UI Testing Specialist
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { jest } from '@jest/globals';

import {
  ComponentInteractionTester,
  ComponentCommunicationTester
} from './ComponentInteractionTestSuite';

// Higher-Order Component pattern
const withLoading = <P extends object>(
  WrappedComponent: React.ComponentType<P>
) => {
  return React.forwardRef<any, P & { isLoading?: boolean; loadingText?: string }>((props, ref) => {
    const { isLoading = false, loadingText = 'Loading...', ...restProps } = props;

    if (isLoading) {
      return (
        <div data-testid="loading-wrapper" role="status" aria-live="polite">
          <div className="loading-spinner" aria-hidden="true" />
          <span>{loadingText}</span>
        </div>
      );
    }

    return <WrappedComponent ref={ref} {...(restProps as P)} />;
  });
};

const withErrorBoundary = <P extends object>(
  WrappedComponent: React.ComponentType<P>
) => {
  return React.forwardRef<any, P & { onError?: (error: Error) => void }>((props, ref) => {
    const { onError, ...restProps } = props;

    class ErrorBoundary extends React.Component<
      { children: React.ReactNode; onError?: (error: Error) => void },
      { hasError: boolean; error?: Error }
    > {
      constructor(props: any) {
        super(props);
        this.state = { hasError: false };
      }

      static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
      }

      componentDidCatch(error: Error) {
        this.props.onError?.(error);
      }

      render() {
        if (this.state.hasError) {
          return (
            <div data-testid="error-boundary" role="alert">
              <h2>Something went wrong</h2>
              <p>{this.state.error?.message}</p>
            </div>
          );
        }

        return this.props.children;
      }
    }

    return (
      <ErrorBoundary onError={onError}>
        <WrappedComponent ref={ref} {...(restProps as P)} />
      </ErrorBoundary>
    );
  });
};

// Render Props pattern
interface RenderPropsComponentProps {
  children: (state: {
    count: number;
    increment: () => void;
    decrement: () => void;
    reset: () => void;
  }) => React.ReactNode;
  initialCount?: number;
  onCountChange?: (count: number) => void;
}

const RenderPropsComponent: React.FC<RenderPropsComponentProps> = ({
  children,
  initialCount = 0,
  onCountChange
}) => {
  const [count, setCount] = React.useState(initialCount);

  React.useEffect(() => {
    onCountChange?.(count);
  }, [count, onCountChange]);

  const increment = React.useCallback(() => setCount(c => c + 1), []);
  const decrement = React.useCallback(() => setCount(c => c - 1), []);
  const reset = React.useCallback(() => setCount(initialCount), [initialCount]);

  return (
    <div data-testid="render-props-container">
      {children({ count, increment, decrement, reset })}
    </div>
  );
};

// Compound Component pattern
interface AccordionContextValue {
  openItems: Set<string>;
  toggleItem: (itemId: string) => void;
  allowMultiple: boolean;
}

const AccordionContext = React.createContext<AccordionContextValue | null>(null);

const useAccordionContext = () => {
  const context = React.useContext(AccordionContext);
  if (!context) {
    throw new Error('Accordion components must be used within an Accordion');
  }
  return context;
};

interface AccordionProps {
  children: React.ReactNode;
  allowMultiple?: boolean;
  defaultOpen?: string[];
  onItemToggle?: (itemId: string, isOpen: boolean) => void;
}

const Accordion: React.FC<AccordionProps> & {
  Item: typeof AccordionItem;
  Header: typeof AccordionHeader;
  Panel: typeof AccordionPanel;
} = ({ children, allowMultiple = false, defaultOpen = [], onItemToggle }) => {
  const [openItems, setOpenItems] = React.useState(new Set(defaultOpen));

  const toggleItem = React.useCallback((itemId: string) => {
    setOpenItems(prev => {
      const newOpenItems = new Set(prev);

      if (newOpenItems.has(itemId)) {
        newOpenItems.delete(itemId);
        onItemToggle?.(itemId, false);
      } else {
        if (!allowMultiple) {
          newOpenItems.clear();
        }
        newOpenItems.add(itemId);
        onItemToggle?.(itemId, true);
      }

      return newOpenItems;
    });
  }, [allowMultiple, onItemToggle]);

  const value = React.useMemo(() => ({
    openItems,
    toggleItem,
    allowMultiple
  }), [openItems, toggleItem, allowMultiple]);

  return (
    <AccordionContext.Provider value={value}>
      <div data-testid="accordion" role="tablist" aria-multiselectable={allowMultiple}>
        {children}
      </div>
    </AccordionContext.Provider>
  );
};

const AccordionItem: React.FC<{
  children: React.ReactNode;
  itemId: string;
}> = ({ children, itemId }) => {
  const { openItems } = useAccordionContext();
  const isOpen = openItems.has(itemId);

  return (
    <div
      data-testid={`accordion-item-${itemId}`}
      data-open={isOpen}
      className="accordion-item"
    >
      {children}
    </div>
  );
};

const AccordionHeader: React.FC<{
  children: React.ReactNode;
  itemId: string;
}> = ({ children, itemId }) => {
  const { toggleItem, openItems } = useAccordionContext();
  const isOpen = openItems.has(itemId);

  return (
    <button
      data-testid={`accordion-header-${itemId}`}
      role="tab"
      aria-expanded={isOpen}
      aria-controls={`accordion-panel-${itemId}`}
      onClick={() => toggleItem(itemId)}
      className="accordion-header"
    >
      {children}
      <span aria-hidden="true">{isOpen ? '−' : '+'}</span>
    </button>
  );
};

const AccordionPanel: React.FC<{
  children: React.ReactNode;
  itemId: string;
}> = ({ children, itemId }) => {
  const { openItems } = useAccordionContext();
  const isOpen = openItems.has(itemId);

  if (!isOpen) return null;

  return (
    <div
      data-testid={`accordion-panel-${itemId}`}
      id={`accordion-panel-${itemId}`}
      role="tabpanel"
      className="accordion-panel"
    >
      {children}
    </div>
  );
};

Accordion.Item = AccordionItem;
Accordion.Header = AccordionHeader;
Accordion.Panel = AccordionPanel;

// Function as Children pattern
interface FunctionAsChildrenProps {
  data: any[];
  loading: boolean;
  error?: string | null;
  children: (props: {
    data: any[];
    loading: boolean;
    error?: string | null;
    hasData: boolean;
    isEmpty: boolean;
  }) => React.ReactNode;
}

const FunctionAsChildren: React.FC<FunctionAsChildrenProps> = ({
  data,
  loading,
  error,
  children
}) => {
  const hasData = data.length > 0;
  const isEmpty = data.length === 0 && !loading && !error;

  return (
    <div data-testid="function-as-children-container">
      {children({ data, loading, error, hasData, isEmpty })}
    </div>
  );
};

// Polymorphic Component pattern
type AsProps<T extends React.ElementType> = {
  as?: T;
} & React.ComponentPropsWithoutRef<T>;

type PolymorphicButtonProps<T extends React.ElementType = 'button'> = AsProps<T> & {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
};

const PolymorphicButton = <T extends React.ElementType = 'button'>({
  as,
  variant = 'primary',
  size = 'md',
  children,
  className = '',
  ...props
}: PolymorphicButtonProps<T>) => {
  const Component = as || 'button';

  const variantClasses = {
    primary: 'bg-blue-500 text-white',
    secondary: 'bg-gray-500 text-white',
    danger: 'bg-red-500 text-white'
  };

  const sizeClasses = {
    sm: 'px-2 py-1 text-sm',
    md: 'px-4 py-2',
    lg: 'px-6 py-3 text-lg'
  };

  const classes = `${variantClasses[variant]} ${sizeClasses[size]} ${className}`.trim();

  return (
    <Component
      className={classes}
      data-variant={variant}
      data-size={size}
      data-testid="polymorphic-button"
      {...props}
    >
      {children}
    </Component>
  );
};

// Test Components
const TestButton: React.FC<{ onClick?: () => void; children: React.ReactNode }> = ({
  onClick,
  children
}) => (
  <button onClick={onClick} data-testid="test-button">
    {children}
  </button>
);

const EnhancedTestButton = withLoading(withErrorBoundary(TestButton));

const ErrorThrowingComponent: React.FC<{ shouldThrow?: boolean }> = ({ shouldThrow = false }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div data-testid="error-throwing-component">No error</div>;
};

describe('Component Composition Patterns', () => {
  let tester: ComponentInteractionTester;
  let communicationTester: ComponentCommunicationTester;
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    tester = new ComponentInteractionTester();
    communicationTester = new ComponentCommunicationTester();
    user = userEvent.setup();
  });

  afterEach(() => {
    tester.resetMocks();
    jest.clearAllMocks();
  });

  describe('Higher-Order Components (HOCs)', () => {
    it('should handle HOC composition and props passing', async () => {
      const onClick = tester.createMock('onClick');

      render(
        <EnhancedTestButton onClick={onClick} isLoading={false}>
          Click me
        </EnhancedTestButton>
      );

      const button = screen.getByTestId('test-button');
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent('Click me');

      await user.click(button);
      expect(onClick).toHaveBeenCalled();
    });

    it('should handle loading state in HOC', async () => {
      render(
        <EnhancedTestButton isLoading={true} loadingText="Processing...">
          Click me
        </EnhancedTestButton>
      );

      const loadingWrapper = screen.getByTestId('loading-wrapper');
      expect(loadingWrapper).toBeInTheDocument();
      expect(loadingWrapper).toHaveTextContent('Processing...');

      // Original button should not be rendered
      expect(screen.queryByTestId('test-button')).not.toBeInTheDocument();
    });

    it('should handle error boundary in HOC', async () => {
      const onError = tester.createMock('onError');

      const { rerender } = render(
        <withErrorBoundary(ErrorThrowingComponent)
          shouldThrow={false}
          onError={onError}
        />
      );

      // Component should render normally
      expect(screen.getByTestId('error-throwing-component')).toBeInTheDocument();

      // Trigger error
      expect(() => {
        rerender(
          <withErrorBoundary(ErrorThrowingComponent)
            shouldThrow={true}
            onError={onError}
          />
        );
      }).not.toThrow();

      // Error boundary should catch and display error
      expect(screen.getByTestId('error-boundary')).toBeInTheDocument();
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('Render Props Pattern', () => {
    it('should handle render props data flow', async () => {
      const onCountChange = tester.createMock('onCountChange');

      render(
        <RenderPropsComponent initialCount={5} onCountChange={onCountChange}>
          {({ count, increment, decrement, reset }) => (
            <div data-testid="render-props-child">
              <div data-testid="count-display">Count: {count}</div>
              <button onClick={increment} data-testid="increment-btn">+</button>
              <button onClick={decrement} data-testid="decrement-btn">-</button>
              <button onClick={reset} data-testid="reset-btn">Reset</button>
            </div>
          )}
        </RenderPropsComponent>
      );

      // Initial state
      expect(screen.getByTestId('count-display')).toHaveTextContent('Count: 5');
      expect(onCountChange).toHaveBeenCalledWith(5);

      // Increment
      await user.click(screen.getByTestId('increment-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('count-display')).toHaveTextContent('Count: 6');
        expect(onCountChange).toHaveBeenCalledWith(6);
      });

      // Decrement
      await user.click(screen.getByTestId('decrement-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('count-display')).toHaveTextContent('Count: 5');
        expect(onCountChange).toHaveBeenCalledWith(5);
      });

      // Reset
      await user.click(screen.getByTestId('reset-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('count-display')).toHaveTextContent('Count: 5');
      });
    });

    it('should handle multiple render props consumers', async () => {
      render(
        <RenderPropsComponent initialCount={0}>
          {({ count, increment }) => (
            <div>
              <div data-testid="consumer-1">
                Consumer 1: {count}
                <button onClick={increment} data-testid="consumer-1-btn">Inc</button>
              </div>
              <div data-testid="consumer-2">
                Consumer 2: {count * 2}
              </div>
            </div>
          )}
        </RenderPropsComponent>
      );

      expect(screen.getByTestId('consumer-1')).toHaveTextContent('Consumer 1: 0');
      expect(screen.getByTestId('consumer-2')).toHaveTextContent('Consumer 2: 0');

      await user.click(screen.getByTestId('consumer-1-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('consumer-1')).toHaveTextContent('Consumer 1: 1');
        expect(screen.getByTestId('consumer-2')).toHaveTextContent('Consumer 2: 2');
      });
    });
  });

  describe('Compound Components Pattern', () => {
    it('should handle compound component interactions', async () => {
      const onItemToggle = tester.createMock('onItemToggle');

      render(
        <Accordion onItemToggle={onItemToggle} defaultOpen={['item1']}>
          <Accordion.Item itemId="item1">
            <Accordion.Header itemId="item1">
              Item 1 Header
            </Accordion.Header>
            <Accordion.Panel itemId="item1">
              Item 1 Content
            </Accordion.Panel>
          </Accordion.Item>

          <Accordion.Item itemId="item2">
            <Accordion.Header itemId="item2">
              Item 2 Header
            </Accordion.Header>
            <Accordion.Panel itemId="item2">
              Item 2 Content
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>
      );

      // Item 1 should be open by default
      expect(screen.getByTestId('accordion-item-item1')).toHaveAttribute('data-open', 'true');
      expect(screen.getByTestId('accordion-panel-item1')).toBeInTheDocument();
      expect(screen.getByText('Item 1 Content')).toBeInTheDocument();

      // Item 2 should be closed
      expect(screen.getByTestId('accordion-item-item2')).toHaveAttribute('data-open', 'false');
      expect(screen.queryByTestId('accordion-panel-item2')).not.toBeInTheDocument();

      // Click item 2 header to open
      await user.click(screen.getByTestId('accordion-header-item2'));

      await waitFor(() => {
        expect(onItemToggle).toHaveBeenCalledWith('item2', true);
        expect(screen.getByTestId('accordion-panel-item2')).toBeInTheDocument();
      });

      // By default, opening item2 should close item1 (single accordion)
      expect(screen.queryByTestId('accordion-panel-item1')).not.toBeInTheDocument();
    });

    it('should handle multiple open items when allowMultiple is true', async () => {
      render(
        <Accordion allowMultiple={true}>
          <Accordion.Item itemId="item1">
            <Accordion.Header itemId="item1">Item 1</Accordion.Header>
            <Accordion.Panel itemId="item1">Content 1</Accordion.Panel>
          </Accordion.Item>

          <Accordion.Item itemId="item2">
            <Accordion.Header itemId="item2">Item 2</Accordion.Header>
            <Accordion.Panel itemId="item2">Content 2</Accordion.Panel>
          </Accordion.Item>
        </Accordion>
      );

      // Open item 1
      await user.click(screen.getByTestId('accordion-header-item1'));

      await waitFor(() => {
        expect(screen.getByTestId('accordion-panel-item1')).toBeInTheDocument();
      });

      // Open item 2
      await user.click(screen.getByTestId('accordion-header-item2'));

      await waitFor(() => {
        expect(screen.getByTestId('accordion-panel-item2')).toBeInTheDocument();
      });

      // Both should remain open
      expect(screen.getByTestId('accordion-panel-item1')).toBeInTheDocument();
      expect(screen.getByTestId('accordion-panel-item2')).toBeInTheDocument();
    });

    it('should handle accessibility attributes in compound components', async () => {
      render(
        <Accordion>
          <Accordion.Item itemId="item1">
            <Accordion.Header itemId="item1">Item 1</Accordion.Header>
            <Accordion.Panel itemId="item1">Content 1</Accordion.Panel>
          </Accordion.Item>
        </Accordion>
      );

      const accordion = screen.getByTestId('accordion');
      expect(accordion).toHaveAttribute('role', 'tablist');
      expect(accordion).toHaveAttribute('aria-multiselectable', 'false');

      const header = screen.getByTestId('accordion-header-item1');
      expect(header).toHaveAttribute('role', 'tab');
      expect(header).toHaveAttribute('aria-expanded', 'false');
      expect(header).toHaveAttribute('aria-controls', 'accordion-panel-item1');

      // Open the accordion
      await user.click(header);

      await waitFor(() => {
        expect(header).toHaveAttribute('aria-expanded', 'true');

        const panel = screen.getByTestId('accordion-panel-item1');
        expect(panel).toHaveAttribute('role', 'tabpanel');
        expect(panel).toHaveAttribute('id', 'accordion-panel-item1');
      });
    });
  });

  describe('Function as Children Pattern', () => {
    it('should handle function as children with different states', async () => {
      const testData = [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' }
      ];

      const { rerender } = render(
        <FunctionAsChildren data={[]} loading={true}>
          {({ data, loading, error, hasData, isEmpty }) => (
            <div data-testid="function-children-content">
              {loading && <div data-testid="loading-state">Loading...</div>}
              {error && <div data-testid="error-state">Error: {error}</div>}
              {hasData && (
                <div data-testid="data-state">
                  Data count: {data.length}
                </div>
              )}
              {isEmpty && <div data-testid="empty-state">No data</div>}
            </div>
          )}
        </FunctionAsChildren>
      );

      // Loading state
      expect(screen.getByTestId('loading-state')).toBeInTheDocument();

      // Data loaded state
      rerender(
        <FunctionAsChildren data={testData} loading={false}>
          {({ data, loading, error, hasData, isEmpty }) => (
            <div data-testid="function-children-content">
              {loading && <div data-testid="loading-state">Loading...</div>}
              {error && <div data-testid="error-state">Error: {error}</div>}
              {hasData && (
                <div data-testid="data-state">
                  Data count: {data.length}
                </div>
              )}
              {isEmpty && <div data-testid="empty-state">No data</div>}
            </div>
          )}
        </FunctionAsChildren>
      );

      expect(screen.getByTestId('data-state')).toHaveTextContent('Data count: 2');
      expect(screen.queryByTestId('loading-state')).not.toBeInTheDocument();

      // Error state
      rerender(
        <FunctionAsChildren data={[]} loading={false} error="Failed to load">
          {({ data, loading, error, hasData, isEmpty }) => (
            <div data-testid="function-children-content">
              {loading && <div data-testid="loading-state">Loading...</div>}
              {error && <div data-testid="error-state">Error: {error}</div>}
              {hasData && (
                <div data-testid="data-state">
                  Data count: {data.length}
                </div>
              )}
              {isEmpty && <div data-testid="empty-state">No data</div>}
            </div>
          )}
        </FunctionAsChildren>
      );

      expect(screen.getByTestId('error-state')).toHaveTextContent('Error: Failed to load');

      // Empty state
      rerender(
        <FunctionAsChildren data={[]} loading={false}>
          {({ data, loading, error, hasData, isEmpty }) => (
            <div data-testid="function-children-content">
              {loading && <div data-testid="loading-state">Loading...</div>}
              {error && <div data-testid="error-state">Error: {error}</div>}
              {hasData && (
                <div data-testid="data-state">
                  Data count: {data.length}
                </div>
              )}
              {isEmpty && <div data-testid="empty-state">No data</div>}
            </div>
          )}
        </FunctionAsChildren>
      );

      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    });
  });

  describe('Polymorphic Components', () => {
    it('should render as different elements based on "as" prop', async () => {
      const onClick = tester.createMock('onClick');

      const { rerender } = render(
        <PolymorphicButton onClick={onClick} variant="primary" size="md">
          Button Content
        </PolymorphicButton>
      );

      // Default as button
      let element = screen.getByTestId('polymorphic-button');
      expect(element.tagName).toBe('BUTTON');
      expect(element).toHaveAttribute('data-variant', 'primary');
      expect(element).toHaveAttribute('data-size', 'md');

      await user.click(element);
      expect(onClick).toHaveBeenCalled();

      // Render as anchor
      rerender(
        <PolymorphicButton as="a" href="/test" variant="secondary" size="lg">
          Link Content
        </PolymorphicButton>
      );

      element = screen.getByTestId('polymorphic-button');
      expect(element.tagName).toBe('A');
      expect(element).toHaveAttribute('href', '/test');
      expect(element).toHaveAttribute('data-variant', 'secondary');
      expect(element).toHaveAttribute('data-size', 'lg');

      // Render as div
      rerender(
        <PolymorphicButton as="div" variant="danger" size="sm">
          Div Content
        </PolymorphicButton>
      );

      element = screen.getByTestId('polymorphic-button');
      expect(element.tagName).toBe('DIV');
      expect(element).toHaveAttribute('data-variant', 'danger');
      expect(element).toHaveAttribute('data-size', 'sm');
    });
  });

  describe('Complex Composition Scenarios', () => {
    it('should handle nested composition patterns', async () => {
      const ComplexComposition = () => (
        <RenderPropsComponent initialCount={0}>
          {({ count, increment }) => (
            <Accordion allowMultiple={true}>
              <Accordion.Item itemId="counter">
                <Accordion.Header itemId="counter">
                  Counter: {count}
                </Accordion.Header>
                <Accordion.Panel itemId="counter">
                  <PolymorphicButton onClick={increment} variant="primary">
                    Increment
                  </PolymorphicButton>
                </Accordion.Panel>
              </Accordion.Item>

              <Accordion.Item itemId="status">
                <Accordion.Header itemId="status">
                  Status
                </Accordion.Header>
                <Accordion.Panel itemId="status">
                  <FunctionAsChildren
                    data={Array.from({ length: count }, (_, i) => ({ id: i }))}
                    loading={false}
                  >
                    {({ data, hasData, isEmpty }) => (
                      <div>
                        {hasData && <div data-testid="status-has-data">Items: {data.length}</div>}
                        {isEmpty && <div data-testid="status-empty">No items</div>}
                      </div>
                    )}
                  </FunctionAsChildren>
                </Accordion.Panel>
              </Accordion.Item>
            </Accordion>
          )}
        </RenderPropsComponent>
      );

      render(<ComplexComposition />);

      // Initial state
      expect(screen.getByText('Counter: 0')).toBeInTheDocument();

      // Open counter accordion
      await user.click(screen.getByTestId('accordion-header-counter'));

      await waitFor(() => {
        expect(screen.getByTestId('polymorphic-button')).toBeInTheDocument();
      });

      // Increment counter
      await user.click(screen.getByTestId('polymorphic-button'));

      await waitFor(() => {
        expect(screen.getByText('Counter: 1')).toBeInTheDocument();
      });

      // Open status accordion
      await user.click(screen.getByTestId('accordion-header-status'));

      await waitFor(() => {
        expect(screen.getByTestId('status-has-data')).toHaveTextContent('Items: 1');
      });
    });

    it('should handle composition with error boundaries and loading states', async () => {
      const ErrorProneComponent: React.FC<{ shouldError: boolean }> = ({ shouldError }) => {
        if (shouldError) {
          throw new Error('Composition error');
        }
        return <div data-testid="error-prone-content">Working fine</div>;
      };

      const ComplexCompositionWithError = ({
        isLoading,
        hasError
      }: {
        isLoading: boolean;
        hasError: boolean;
      }) => {
        const EnhancedErrorProneComponent = withLoading(withErrorBoundary(ErrorProneComponent));

        return (
          <EnhancedErrorProneComponent
            isLoading={isLoading}
            shouldError={hasError}
            loadingText="Processing..."
            onError={(error) => console.log('Error caught:', error.message)}
          />
        );
      };

      const { rerender } = render(
        <ComplexCompositionWithError isLoading={true} hasError={false} />
      );

      // Loading state
      expect(screen.getByTestId('loading-wrapper')).toBeInTheDocument();
      expect(screen.getByText('Processing...')).toBeInTheDocument();

      // Normal state
      rerender(<ComplexCompositionWithError isLoading={false} hasError={false} />);

      expect(screen.getByTestId('error-prone-content')).toBeInTheDocument();
      expect(screen.queryByTestId('loading-wrapper')).not.toBeInTheDocument();

      // Error state
      expect(() => {
        rerender(<ComplexCompositionWithError isLoading={false} hasError={true} />);
      }).not.toThrow();

      expect(screen.getByTestId('error-boundary')).toBeInTheDocument();
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });
  });

  describe('Performance Optimization in Composition', () => {
    it('should handle memoization in composition patterns', async () => {
      const renderSpy = tester.createMock('renderSpy');

      const MemoizedChild = React.memo<{ count: number; onRender: () => void }>(({ count, onRender }) => {
        onRender();
        return <div data-testid="memoized-child">Count: {count}</div>;
      });

      const ParentWithMemoization = () => {
        const [count, setCount] = React.useState(0);
        const [otherState, setOtherState] = React.useState(0);

        return (
          <div>
            <div data-testid="parent-count">Parent Count: {count}</div>
            <div data-testid="parent-other">Other: {otherState}</div>

            <MemoizedChild count={count} onRender={renderSpy} />

            <button
              onClick={() => setCount(c => c + 1)}
              data-testid="increment-count"
            >
              Increment Count
            </button>
            <button
              onClick={() => setOtherState(s => s + 1)}
              data-testid="increment-other"
            >
              Increment Other
            </button>
          </div>
        );
      };

      render(<ParentWithMemoization />);

      // Initial render
      expect(renderSpy).toHaveBeenCalledTimes(1);

      // Change count - should trigger child re-render
      await user.click(screen.getByTestId('increment-count'));

      await waitFor(() => {
        expect(screen.getByTestId('memoized-child')).toHaveTextContent('Count: 1');
        expect(renderSpy).toHaveBeenCalledTimes(2);
      });

      // Change other state - should NOT trigger child re-render due to memoization
      await user.click(screen.getByTestId('increment-other'));

      await waitFor(() => {
        expect(screen.getByTestId('parent-other')).toHaveTextContent('Other: 1');
        // Child should not re-render since count prop didn't change
        expect(renderSpy).toHaveBeenCalledTimes(2);
      });
    });
  });
});