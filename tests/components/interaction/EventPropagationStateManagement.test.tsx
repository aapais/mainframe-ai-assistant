/**
 * Event Propagation and State Management Tests
 *
 * Tests for event handling, state management patterns, and cross-component
 * data flow including context providers, custom hooks, and state synchronization.
 *
 * @author UI Testing Specialist
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { jest } from '@jest/globals';

import {
  ComponentInteractionTester,
  ComponentCommunicationTester,
  ContextProviderTester
} from './ComponentInteractionTestSuite';

// Mock context and hooks
const TestContext = React.createContext<{
  state: any;
  dispatch: (action: any) => void;
}>({
  state: {},
  dispatch: () => {}
});

const useTestState = () => {
  const [state, setState] = React.useState({
    count: 0,
    items: [],
    isLoading: false,
    error: null
  });

  const dispatch = React.useCallback((action: any) => {
    setState(prevState => {
      switch (action.type) {
        case 'INCREMENT':
          return { ...prevState, count: prevState.count + 1 };
        case 'ADD_ITEM':
          return { ...prevState, items: [...prevState.items, action.payload] };
        case 'SET_LOADING':
          return { ...prevState, isLoading: action.payload };
        case 'SET_ERROR':
          return { ...prevState, error: action.payload };
        case 'RESET':
          return { count: 0, items: [], isLoading: false, error: null };
        default:
          return prevState;
      }
    });
  }, []);

  return { state, dispatch };
};

// Test components
const TestProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { state, dispatch } = useTestState();

  return (
    <TestContext.Provider value={{ state, dispatch }}>
      <div data-testid="test-provider" data-state={JSON.stringify(state)}>
        {children}
      </div>
    </TestContext.Provider>
  );
};

const TestConsumer: React.FC<{
  onStateChange?: (state: any) => void;
  onAction?: (action: any) => void;
}> = ({ onStateChange, onAction }) => {
  const { state, dispatch } = React.useContext(TestContext);

  React.useEffect(() => {
    onStateChange?.(state);
  }, [state, onStateChange]);

  const handleIncrement = () => {
    const action = { type: 'INCREMENT' };
    dispatch(action);
    onAction?.(action);
  };

  const handleAddItem = () => {
    const action = { type: 'ADD_ITEM', payload: `Item ${state.items.length + 1}` };
    dispatch(action);
    onAction?.(action);
  };

  const handleSetLoading = (loading: boolean) => {
    const action = { type: 'SET_LOADING', payload: loading };
    dispatch(action);
    onAction?.(action);
  };

  return (
    <div data-testid="test-consumer">
      <div data-testid="count">Count: {state.count}</div>
      <div data-testid="items">Items: {state.items.length}</div>
      <div data-testid="loading">Loading: {state.isLoading.toString()}</div>
      <div data-testid="error">Error: {state.error || 'none'}</div>

      <button onClick={handleIncrement} data-testid="increment-button">
        Increment
      </button>
      <button onClick={handleAddItem} data-testid="add-item-button">
        Add Item
      </button>
      <button onClick={() => handleSetLoading(!state.isLoading)} data-testid="toggle-loading-button">
        Toggle Loading
      </button>
    </div>
  );
};

const EventBubblingTestComponent: React.FC<{
  onContainerClick?: (e: React.MouseEvent) => void;
  onParentClick?: (e: React.MouseEvent) => void;
  onChildClick?: (e: React.MouseEvent) => void;
  onCaptureClick?: (e: React.MouseEvent) => void;
}> = ({ onContainerClick, onParentClick, onChildClick, onCaptureClick }) => {
  return (
    <div
      data-testid="container"
      onClick={onContainerClick}
      onClickCapture={onCaptureClick}
    >
      <div
        data-testid="parent"
        onClick={(e) => {
          onParentClick?.(e);
        }}
      >
        <button
          data-testid="child-button"
          onClick={(e) => {
            onChildClick?.(e);
          }}
        >
          Click Me
        </button>
      </div>
    </div>
  );
};

const StateSubscriptionComponent: React.FC<{
  initialState?: any;
  onStateUpdate?: (state: any) => void;
}> = ({ initialState = {}, onStateUpdate }) => {
  const [state, setState] = React.useState(initialState);
  const [subscribers, setSubscribers] = React.useState<((state: any) => void)[]>([]);

  const subscribe = React.useCallback((callback: (state: any) => void) => {
    setSubscribers(prev => [...prev, callback]);
    return () => {
      setSubscribers(prev => prev.filter(cb => cb !== callback));
    };
  }, []);

  const updateState = React.useCallback((updates: any) => {
    setState(prevState => {
      const newState = { ...prevState, ...updates };
      subscribers.forEach(callback => callback(newState));
      onStateUpdate?.(newState);
      return newState;
    });
  }, [subscribers, onStateUpdate]);

  const Child: React.FC<{ id: string }> = ({ id }) => {
    const [localState, setLocalState] = React.useState(null);

    React.useEffect(() => {
      return subscribe((newState) => {
        setLocalState(newState);
      });
    }, []);

    return (
      <div data-testid={`child-${id}`} data-state={JSON.stringify(localState)}>
        Child {id}: {JSON.stringify(localState)}
      </div>
    );
  };

  return (
    <div data-testid="subscription-container">
      <div data-testid="parent-state" data-state={JSON.stringify(state)}>
        Parent State: {JSON.stringify(state)}
      </div>

      <button
        onClick={() => updateState({ timestamp: Date.now(), counter: (state.counter || 0) + 1 })}
        data-testid="update-state-button"
      >
        Update State
      </button>

      <Child id="1" />
      <Child id="2" />
      <Child id="3" />
    </div>
  );
};

describe('Event Propagation and State Management', () => {
  let tester: ComponentInteractionTester;
  let communicationTester: ComponentCommunicationTester;
  let contextTester: ContextProviderTester;
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    tester = new ComponentInteractionTester();
    communicationTester = new ComponentCommunicationTester();
    contextTester = new ContextProviderTester();
    user = userEvent.setup();
  });

  afterEach(() => {
    tester.resetMocks();
    jest.clearAllMocks();
  });

  describe('Event Propagation Patterns', () => {
    it('should handle event bubbling correctly', async () => {
      const onContainerClick = tester.createMock('onContainerClick');
      const onParentClick = tester.createMock('onParentClick');
      const onChildClick = tester.createMock('onChildClick');
      const onCaptureClick = tester.createMock('onCaptureClick');

      render(
        <EventBubblingTestComponent
          onContainerClick={onContainerClick}
          onParentClick={onParentClick}
          onChildClick={onChildClick}
          onCaptureClick={onCaptureClick}
        />
      );

      const childButton = screen.getByTestId('child-button');
      await user.click(childButton);

      // Assert event propagation order
      await waitFor(() => {
        expect(onCaptureClick).toHaveBeenCalledBefore(onChildClick as jest.Mock);
        expect(onChildClick).toHaveBeenCalledBefore(onParentClick as jest.Mock);
        expect(onParentClick).toHaveBeenCalledBefore(onContainerClick as jest.Mock);
      });

      // All handlers should have been called
      expect(onCaptureClick).toHaveBeenCalled();
      expect(onChildClick).toHaveBeenCalled();
      expect(onParentClick).toHaveBeenCalled();
      expect(onContainerClick).toHaveBeenCalled();
    });

    it('should handle event stopPropagation', async () => {
      const onContainerClick = tester.createMock('onContainerClick');
      const onParentClick = tester.createMock('onParentClick');
      const onChildClick = jest.fn((e: React.MouseEvent) => {
        e.stopPropagation();
      });

      render(
        <EventBubblingTestComponent
          onContainerClick={onContainerClick}
          onParentClick={onParentClick}
          onChildClick={onChildClick}
        />
      );

      const childButton = screen.getByTestId('child-button');
      await user.click(childButton);

      // Only child click should have been called due to stopPropagation
      await waitFor(() => {
        expect(onChildClick).toHaveBeenCalled();
        expect(onParentClick).not.toHaveBeenCalled();
        expect(onContainerClick).not.toHaveBeenCalled();
      });
    });

    it('should handle preventDefault', async () => {
      const onSubmit = jest.fn((e: React.FormEvent) => {
        e.preventDefault();
      });

      const TestForm = () => (
        <form onSubmit={onSubmit} data-testid="test-form">
          <input type="text" defaultValue="test" data-testid="input" />
          <button type="submit" data-testid="submit-button">Submit</button>
        </form>
      );

      render(<TestForm />);

      const submitButton = screen.getByTestId('submit-button');
      await user.click(submitButton);

      // Assert form submission was prevented
      expect(onSubmit).toHaveBeenCalled();

      // Form should still be in the document (not navigated away)
      expect(screen.getByTestId('test-form')).toBeInTheDocument();
    });
  });

  describe('Context Provider and Consumer Patterns', () => {
    it('should handle context state changes', async () => {
      const onStateChange = tester.createMock('onStateChange');
      const onAction = tester.createMock('onAction');

      render(
        <TestProvider>
          <TestConsumer onStateChange={onStateChange} onAction={onAction} />
        </TestProvider>
      );

      // Initial state check
      expect(screen.getByTestId('count')).toHaveTextContent('Count: 0');
      expect(screen.getByTestId('items')).toHaveTextContent('Items: 0');

      // Increment counter
      const incrementButton = screen.getByTestId('increment-button');
      await user.click(incrementButton);

      // Assert state change
      await waitFor(() => {
        expect(screen.getByTestId('count')).toHaveTextContent('Count: 1');
      });

      expect(onStateChange).toHaveBeenCalledWith(
        expect.objectContaining({ count: 1 })
      );

      expect(onAction).toHaveBeenCalledWith({ type: 'INCREMENT' });

      // Add item
      const addItemButton = screen.getByTestId('add-item-button');
      await user.click(addItemButton);

      await waitFor(() => {
        expect(screen.getByTestId('items')).toHaveTextContent('Items: 1');
      });

      expect(onAction).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'ADD_ITEM', payload: 'Item 1' })
      );
    });

    it('should handle multiple consumers', async () => {
      const onStateChange1 = tester.createMock('onStateChange1');
      const onStateChange2 = tester.createMock('onStateChange2');

      render(
        <TestProvider>
          <TestConsumer onStateChange={onStateChange1} />
          <TestConsumer onStateChange={onStateChange2} />
        </TestProvider>
      );

      const incrementButtons = screen.getAllByTestId('increment-button');
      await user.click(incrementButtons[0]);

      // Both consumers should receive state updates
      await waitFor(() => {
        expect(onStateChange1).toHaveBeenCalledWith(
          expect.objectContaining({ count: 1 })
        );
        expect(onStateChange2).toHaveBeenCalledWith(
          expect.objectContaining({ count: 1 })
        );
      });

      // Both should show updated count
      const countDisplays = screen.getAllByTestId('count');
      countDisplays.forEach(display => {
        expect(display).toHaveTextContent('Count: 1');
      });
    });

    it('should handle context provider nesting', async () => {
      const NestedProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
        const { state, dispatch } = useTestState();

        // Add prefix to differentiate nested context
        const nestedState = { ...state, prefix: 'nested-' };

        return (
          <TestContext.Provider value={{ state: nestedState, dispatch }}>
            <div data-testid="nested-provider" data-state={JSON.stringify(nestedState)}>
              {children}
            </div>
          </TestContext.Provider>
        );
      };

      const onOuterStateChange = tester.createMock('onOuterStateChange');
      const onNestedStateChange = tester.createMock('onNestedStateChange');

      render(
        <TestProvider>
          <TestConsumer onStateChange={onOuterStateChange} />
          <NestedProvider>
            <TestConsumer onStateChange={onNestedStateChange} />
          </NestedProvider>
        </TestProvider>
      );

      const incrementButtons = screen.getAllByTestId('increment-button');

      // Click outer increment
      await user.click(incrementButtons[0]);

      await waitFor(() => {
        expect(onOuterStateChange).toHaveBeenCalledWith(
          expect.objectContaining({ count: 1 })
        );
      });

      // Click nested increment
      await user.click(incrementButtons[1]);

      await waitFor(() => {
        expect(onNestedStateChange).toHaveBeenCalledWith(
          expect.objectContaining({ count: 1, prefix: 'nested-' })
        );
      });
    });
  });

  describe('Custom Hooks and State Management', () => {
    it('should handle custom hook state updates', async () => {
      const useCounter = (initialValue: number = 0) => {
        const [count, setCount] = React.useState(initialValue);

        const increment = React.useCallback(() => setCount(c => c + 1), []);
        const decrement = React.useCallback(() => setCount(c => c - 1), []);
        const reset = React.useCallback(() => setCount(initialValue), [initialValue]);

        return { count, increment, decrement, reset };
      };

      const TestComponent = ({ onCountChange }: { onCountChange?: (count: number) => void }) => {
        const { count, increment, decrement, reset } = useCounter(5);

        React.useEffect(() => {
          onCountChange?.(count);
        }, [count, onCountChange]);

        return (
          <div data-testid="custom-hook-component">
            <div data-testid="hook-count">Count: {count}</div>
            <button onClick={increment} data-testid="hook-increment">+</button>
            <button onClick={decrement} data-testid="hook-decrement">-</button>
            <button onClick={reset} data-testid="hook-reset">Reset</button>
          </div>
        );
      };

      const onCountChange = tester.createMock('onCountChange');

      render(<TestComponent onCountChange={onCountChange} />);

      // Initial state
      expect(screen.getByTestId('hook-count')).toHaveTextContent('Count: 5');
      expect(onCountChange).toHaveBeenCalledWith(5);

      // Increment
      await user.click(screen.getByTestId('hook-increment'));

      await waitFor(() => {
        expect(screen.getByTestId('hook-count')).toHaveTextContent('Count: 6');
        expect(onCountChange).toHaveBeenCalledWith(6);
      });

      // Decrement
      await user.click(screen.getByTestId('hook-decrement'));

      await waitFor(() => {
        expect(screen.getByTestId('hook-count')).toHaveTextContent('Count: 5');
        expect(onCountChange).toHaveBeenCalledWith(5);
      });

      // Reset
      await user.click(screen.getByTestId('hook-reset'));

      await waitFor(() => {
        expect(screen.getByTestId('hook-count')).toHaveTextContent('Count: 5');
      });
    });

    it('should handle async state updates', async () => {
      const useAsyncData = () => {
        const [data, setData] = React.useState(null);
        const [loading, setLoading] = React.useState(false);
        const [error, setError] = React.useState(null);

        const fetchData = React.useCallback(async (shouldFail: boolean = false) => {
          setLoading(true);
          setError(null);

          try {
            await new Promise(resolve => setTimeout(resolve, 100));

            if (shouldFail) {
              throw new Error('Simulated fetch error');
            }

            setData({ id: 1, name: 'Test Data', timestamp: Date.now() });
          } catch (err: any) {
            setError(err.message);
          } finally {
            setLoading(false);
          }
        }, []);

        return { data, loading, error, fetchData };
      };

      const AsyncComponent = ({
        onDataChange,
        onLoadingChange,
        onError
      }: {
        onDataChange?: (data: any) => void;
        onLoadingChange?: (loading: boolean) => void;
        onError?: (error: string | null) => void;
      }) => {
        const { data, loading, error, fetchData } = useAsyncData();

        React.useEffect(() => {
          onDataChange?.(data);
        }, [data, onDataChange]);

        React.useEffect(() => {
          onLoadingChange?.(loading);
        }, [loading, onLoadingChange]);

        React.useEffect(() => {
          onError?.(error);
        }, [error, onError]);

        return (
          <div data-testid="async-component">
            <div data-testid="async-loading">Loading: {loading.toString()}</div>
            <div data-testid="async-data">
              Data: {data ? JSON.stringify(data) : 'null'}
            </div>
            <div data-testid="async-error">Error: {error || 'none'}</div>

            <button
              onClick={() => fetchData(false)}
              data-testid="fetch-success-button"
            >
              Fetch Success
            </button>
            <button
              onClick={() => fetchData(true)}
              data-testid="fetch-error-button"
            >
              Fetch Error
            </button>
          </div>
        );
      };

      const onDataChange = tester.createMock('onDataChange');
      const onLoadingChange = tester.createMock('onLoadingChange');
      const onError = tester.createMock('onError');

      render(
        <AsyncComponent
          onDataChange={onDataChange}
          onLoadingChange={onLoadingChange}
          onError={onError}
        />
      );

      // Test successful fetch
      const fetchSuccessButton = screen.getByTestId('fetch-success-button');
      await user.click(fetchSuccessButton);

      // Loading should start
      await waitFor(() => {
        expect(screen.getByTestId('async-loading')).toHaveTextContent('Loading: true');
        expect(onLoadingChange).toHaveBeenCalledWith(true);
      });

      // Data should arrive
      await waitFor(() => {
        expect(screen.getByTestId('async-loading')).toHaveTextContent('Loading: false');
        expect(onLoadingChange).toHaveBeenCalledWith(false);
        expect(onDataChange).toHaveBeenCalledWith(
          expect.objectContaining({ id: 1, name: 'Test Data' })
        );
      });

      // Test error fetch
      const fetchErrorButton = screen.getByTestId('fetch-error-button');
      await user.click(fetchErrorButton);

      await waitFor(() => {
        expect(screen.getByTestId('async-error')).toHaveTextContent('Error: Simulated fetch error');
        expect(onError).toHaveBeenCalledWith('Simulated fetch error');
      });
    });
  });

  describe('State Synchronization Patterns', () => {
    it('should handle pub/sub state synchronization', async () => {
      const onStateUpdate = tester.createMock('onStateUpdate');

      render(
        <StateSubscriptionComponent
          initialState={{ counter: 0 }}
          onStateUpdate={onStateUpdate}
        />
      );

      // All children should show initial state
      const children = screen.getAllByTestId(/child-\d+/);
      children.forEach(child => {
        expect(child).toHaveAttribute('data-state', JSON.stringify({ counter: 0 }));
      });

      // Update state
      const updateButton = screen.getByTestId('update-state-button');
      await user.click(updateButton);

      // All children should receive updated state
      await waitFor(() => {
        children.forEach(child => {
          const state = JSON.parse(child.getAttribute('data-state') || '{}');
          expect(state.counter).toBe(1);
          expect(state.timestamp).toBeDefined();
        });
      });

      expect(onStateUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          counter: 1,
          timestamp: expect.any(Number)
        })
      );
    });

    it('should handle cross-component state synchronization', async () => {
      const CrossSyncComponent = () => {
        const [sharedState, setSharedState] = React.useState({ value: 0 });

        const Component1 = () => (
          <div data-testid="component-1">
            <div data-testid="comp1-value">Value: {sharedState.value}</div>
            <button
              onClick={() => setSharedState(prev => ({ value: prev.value + 1 }))}
              data-testid="comp1-increment"
            >
              Increment from Component 1
            </button>
          </div>
        );

        const Component2 = () => (
          <div data-testid="component-2">
            <div data-testid="comp2-value">Value: {sharedState.value}</div>
            <button
              onClick={() => setSharedState(prev => ({ value: prev.value * 2 }))}
              data-testid="comp2-double"
            >
              Double from Component 2
            </button>
          </div>
        );

        return (
          <div data-testid="cross-sync-container">
            <Component1 />
            <Component2 />
          </div>
        );
      };

      render(<CrossSyncComponent />);

      // Both components should show initial value
      expect(screen.getByTestId('comp1-value')).toHaveTextContent('Value: 0');
      expect(screen.getByTestId('comp2-value')).toHaveTextContent('Value: 0');

      // Increment from component 1
      await user.click(screen.getByTestId('comp1-increment'));

      await waitFor(() => {
        expect(screen.getByTestId('comp1-value')).toHaveTextContent('Value: 1');
        expect(screen.getByTestId('comp2-value')).toHaveTextContent('Value: 1');
      });

      // Double from component 2
      await user.click(screen.getByTestId('comp2-double'));

      await waitFor(() => {
        expect(screen.getByTestId('comp1-value')).toHaveTextContent('Value: 2');
        expect(screen.getByTestId('comp2-value')).toHaveTextContent('Value: 2');
      });
    });
  });

  describe('Memory Management and Cleanup', () => {
    it('should handle component unmounting and cleanup', async () => {
      const cleanup = tester.createMock('cleanup');

      const CleanupComponent = ({ shouldRender }: { shouldRender: boolean }) => {
        const [count, setCount] = React.useState(0);

        React.useEffect(() => {
          const interval = setInterval(() => {
            setCount(c => c + 1);
          }, 100);

          return () => {
            clearInterval(interval);
            cleanup();
          };
        }, []);

        if (!shouldRender) return null;

        return (
          <div data-testid="cleanup-component">
            Count: {count}
          </div>
        );
      };

      const TestWrapper = () => {
        const [showComponent, setShowComponent] = React.useState(true);

        return (
          <div>
            <CleanupComponent shouldRender={showComponent} />
            <button
              onClick={() => setShowComponent(false)}
              data-testid="unmount-button"
            >
              Unmount Component
            </button>
          </div>
        );
      };

      render(<TestWrapper />);

      // Component should be rendered
      expect(screen.getByTestId('cleanup-component')).toBeInTheDocument();

      // Unmount component
      await user.click(screen.getByTestId('unmount-button'));

      // Component should be removed
      expect(screen.queryByTestId('cleanup-component')).not.toBeInTheDocument();

      // Cleanup should have been called
      expect(cleanup).toHaveBeenCalled();
    });
  });
});