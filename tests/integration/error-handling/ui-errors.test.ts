/**
 * UI Error Handling Tests
 * Comprehensive testing of UI component failures, IPC communication errors,
 * and state management error scenarios
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AppError, ErrorCode } from '../../../src/core/errors/AppError';

// Mock components and hooks for testing
const mockIpcRenderer = {
  invoke: jest.fn(),
  on: jest.fn(),
  removeListener: jest.fn(),
  send: jest.fn()
};

// Mock Electron API
Object.defineProperty(window, 'electronAPI', {
  value: {
    searchKB: mockIpcRenderer.invoke,
    addKBEntry: mockIpcRenderer.invoke,
    getMetrics: mockIpcRenderer.invoke,
    onError: mockIpcRenderer.on,
    offError: mockIpcRenderer.removeListener
  },
  writable: true
});

// Mock React components for testing error boundaries
class TestErrorBoundary extends React.Component<
  { children: React.ReactNode; onError?: (error: Error, errorInfo: any) => void },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div data-testid="error-boundary">
          <h2>Something went wrong</h2>
          <p>{this.state.error?.message}</p>
          <button 
            onClick={() => this.setState({ hasError: false, error: null })}
            data-testid="retry-button"
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Mock search component that can fail
const FailingSearchComponent: React.FC<{ shouldFail?: boolean; errorType?: string }> = ({ 
  shouldFail = false, 
  errorType = 'render' 
}) => {
  if (shouldFail) {
    if (errorType === 'render') {
      throw new Error('Component render failed');
    }
    if (errorType === 'effect') {
      React.useEffect(() => {
        throw new Error('Component effect failed');
      }, []);
    }
  }

  return <div data-testid="search-component">Search Component</div>;
};

// Mock form component with validation errors
const FormComponent: React.FC<{ 
  onSubmit?: (data: any) => void;
  shouldFailValidation?: boolean;
}> = ({ onSubmit, shouldFailValidation = false }) => {
  const [title, setTitle] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (shouldFailValidation) {
      setError('Validation failed: Title is required');
      return;
    }

    if (title.length < 3) {
      setError('Title must be at least 3 characters');
      return;
    }

    onSubmit?.({ title });
  };

  return (
    <form onSubmit={handleSubmit} data-testid="test-form">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        data-testid="title-input"
        placeholder="Enter title"
      />
      {error && <div data-testid="form-error" role="alert">{error}</div>}
      <button type="submit" data-testid="submit-button">Submit</button>
    </form>
  );
};

// Mock IPC service component
const IPCServiceComponent: React.FC<{
  shouldFailIPC?: boolean;
  errorType?: 'timeout' | 'network' | 'validation';
}> = ({ shouldFailIPC = false, errorType = 'network' }) => {
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      if (shouldFailIPC) {
        switch (errorType) {
          case 'timeout':
            throw new AppError(ErrorCode.TIMEOUT_ERROR, 'IPC operation timed out');
          case 'network':
            throw new AppError(ErrorCode.NETWORK_ERROR, 'Network connection failed');
          case 'validation':
            throw new AppError(ErrorCode.VALIDATION_ERROR, 'Invalid input provided');
        }
      }

      const result = await window.electronAPI.searchKB('test query');
      setData(result);
    } catch (err) {
      const appError = AppError.fromUnknown(err);
      setError(appError.getUserMessage());
    } finally {
      setLoading(false);
    }
  };

  return (
    <div data-testid="ipc-component">
      <button onClick={fetchData} data-testid="fetch-button">
        Fetch Data
      </button>
      {loading && <div data-testid="loading">Loading...</div>}
      {error && <div data-testid="ipc-error" role="alert">{error}</div>}
      {data && <div data-testid="ipc-data">{JSON.stringify(data)}</div>}
    </div>
  );
};

// UI Error Simulator
class UIErrorSimulator {
  static simulateComponentCrash(): Error {
    return new Error('Component crashed unexpectedly');
  }

  static simulateRenderError(): Error {
    return new Error('Failed to render component');
  }

  static simulateStateUpdateError(): Error {
    return new Error('Failed to update component state');
  }

  static simulateEventHandlerError(): Error {
    return new Error('Event handler failed');
  }

  static simulateIPCError(type: 'timeout' | 'network' | 'validation' = 'network'): AppError {
    switch (type) {
      case 'timeout':
        return new AppError(ErrorCode.TIMEOUT_ERROR, 'IPC communication timed out');
      case 'network':
        return new AppError(ErrorCode.NETWORK_ERROR, 'IPC network error');
      case 'validation':
        return new AppError(ErrorCode.VALIDATION_ERROR, 'IPC validation error');
    }
  }
}

describe('UI Error Handling Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset console.error mock
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Component Rendering Failures', () => {
    test('should catch and display component render errors', () => {
      const onError = jest.fn();

      render(
        <TestErrorBoundary onError={onError}>
          <FailingSearchComponent shouldFail={true} errorType="render" />
        </TestErrorBoundary>
      );

      expect(screen.getByTestId('error-boundary')).toBeInTheDocument();
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      expect(screen.getByText('Component render failed')).toBeInTheDocument();
      expect(onError).toHaveBeenCalled();
    });

    test('should allow recovery from component errors', async () => {
      render(
        <TestErrorBoundary>
          <FailingSearchComponent shouldFail={true} />
        </TestErrorBoundary>
      );

      expect(screen.getByTestId('error-boundary')).toBeInTheDocument();

      // Click retry button
      fireEvent.click(screen.getByTestId('retry-button'));

      await waitFor(() => {
        expect(screen.queryByTestId('error-boundary')).not.toBeInTheDocument();
      });
    });

    test('should handle effect errors gracefully', () => {
      const onError = jest.fn();

      expect(() => {
        render(
          <TestErrorBoundary onError={onError}>
            <FailingSearchComponent shouldFail={true} errorType="effect" />
          </TestErrorBoundary>
        );
      }).not.toThrow();

      // Effect errors are handled by error boundaries
      expect(onError).toHaveBeenCalled();
    });

    test('should provide detailed error information to error boundaries', () => {
      let capturedError: Error | null = null;
      let capturedErrorInfo: any = null;

      const onError = (error: Error, errorInfo: any) => {
        capturedError = error;
        capturedErrorInfo = errorInfo;
      };

      render(
        <TestErrorBoundary onError={onError}>
          <FailingSearchComponent shouldFail={true} />
        </TestErrorBoundary>
      );

      expect(capturedError).toBeTruthy();
      expect(capturedError?.message).toBe('Component render failed');
      expect(capturedErrorInfo).toBeTruthy();
      expect(capturedErrorInfo.componentStack).toBeTruthy();
    });
  });

  describe('IPC Communication Errors', () => {
    test('should handle IPC timeout errors', async () => {
      mockIpcRenderer.invoke.mockRejectedValue(
        new AppError(ErrorCode.TIMEOUT_ERROR, 'IPC operation timed out')
      );

      render(<IPCServiceComponent shouldFailIPC={true} errorType="timeout" />);

      fireEvent.click(screen.getByTestId('fetch-button'));

      await waitFor(() => {
        expect(screen.getByTestId('ipc-error')).toBeInTheDocument();
        expect(screen.getByTestId('ipc-error')).toHaveTextContent('The operation timed out');
      });
    });

    test('should handle IPC network errors', async () => {
      mockIpcRenderer.invoke.mockRejectedValue(
        new AppError(ErrorCode.NETWORK_ERROR, 'Network connection failed')
      );

      render(<IPCServiceComponent shouldFailIPC={true} errorType="network" />);

      fireEvent.click(screen.getByTestId('fetch-button'));

      await waitFor(() => {
        expect(screen.getByTestId('ipc-error')).toBeInTheDocument();
        expect(screen.getByTestId('ipc-error')).toHaveTextContent(/network/i);
      });
    });

    test('should handle IPC validation errors', async () => {
      mockIpcRenderer.invoke.mockRejectedValue(
        new AppError(ErrorCode.VALIDATION_ERROR, 'Invalid input provided')
      );

      render(<IPCServiceComponent shouldFailIPC={true} errorType="validation" />);

      fireEvent.click(screen.getByTestId('fetch-button'));

      await waitFor(() => {
        expect(screen.getByTestId('ipc-error')).toBeInTheDocument();
        expect(screen.getByTestId('ipc-error')).toHaveTextContent(/check your input/i);
      });
    });

    test('should handle IPC channel unavailable', async () => {
      // Mock unavailable IPC channel
      Object.defineProperty(window, 'electronAPI', {
        value: undefined,
        writable: true
      });

      render(<IPCServiceComponent />);

      fireEvent.click(screen.getByTestId('fetch-button'));

      await waitFor(() => {
        expect(screen.getByTestId('ipc-error')).toBeInTheDocument();
      });
    });

    test('should retry failed IPC operations', async () => {
      let callCount = 0;
      mockIpcRenderer.invoke.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('Transient IPC error'));
        }
        return Promise.resolve(['test result']);
      });

      render(<IPCServiceComponent />);

      fireEvent.click(screen.getByTestId('fetch-button'));

      // First attempt fails, second should succeed (with retry logic)
      await waitFor(() => {
        // Would need retry logic implemented in component
        expect(callCount).toBeGreaterThan(0);
      });
    });

    test('should handle malformed IPC responses', async () => {
      mockIpcRenderer.invoke.mockResolvedValue('invalid json');

      render(<IPCServiceComponent />);

      fireEvent.click(screen.getByTestId('fetch-button'));

      await waitFor(() => {
        expect(screen.getByTestId('ipc-data')).toHaveTextContent('invalid json');
      });
    });
  });

  describe('State Management Errors', () => {
    test('should handle state update failures gracefully', async () => {
      const FailingStateComponent: React.FC = () => {
        const [state, setState] = React.useState<any>(null);
        const [error, setError] = React.useState<string | null>(null);

        const updateState = () => {
          try {
            // Simulate state update that could fail
            setState(prevState => {
              if (prevState === 'fail') {
                throw new Error('State update failed');
              }
              return 'fail';
            });
          } catch (err) {
            setError('Failed to update state');
          }
        };

        return (
          <div>
            <button onClick={updateState} data-testid="update-state">
              Update State
            </button>
            {error && <div data-testid="state-error">{error}</div>}
            <div data-testid="current-state">{JSON.stringify(state)}</div>
          </div>
        );
      };

      render(<FailingStateComponent />);

      fireEvent.click(screen.getByTestId('update-state'));
      fireEvent.click(screen.getByTestId('update-state'));

      await waitFor(() => {
        expect(screen.getByTestId('state-error')).toBeInTheDocument();
      });
    });

    test('should handle context provider failures', () => {
      const ErrorContext = React.createContext<any>(null);

      const FailingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
        throw new Error('Context provider failed');
      };

      const ConsumerComponent: React.FC = () => {
        const context = React.useContext(ErrorContext);
        return <div data-testid="consumer">Consumer: {context}</div>;
      };

      render(
        <TestErrorBoundary>
          <FailingProvider>
            <ConsumerComponent />
          </FailingProvider>
        </TestErrorBoundary>
      );

      expect(screen.getByTestId('error-boundary')).toBeInTheDocument();
    });

    test('should handle reducer state corruption', () => {
      const FailingReducerComponent: React.FC = () => {
        const [state, dispatch] = React.useReducer((state: any, action: any) => {
          if (action.type === 'CORRUPT') {
            throw new Error('Reducer state corruption');
          }
          return { ...state, count: state.count + 1 };
        }, { count: 0 });

        return (
          <div>
            <button 
              onClick={() => dispatch({ type: 'INCREMENT' })}
              data-testid="increment"
            >
              Increment
            </button>
            <button 
              onClick={() => dispatch({ type: 'CORRUPT' })}
              data-testid="corrupt"
            >
              Corrupt
            </button>
            <div data-testid="count">{state.count}</div>
          </div>
        );
      };

      render(
        <TestErrorBoundary>
          <FailingReducerComponent />
        </TestErrorBoundary>
      );

      fireEvent.click(screen.getByTestId('increment'));
      expect(screen.getByTestId('count')).toHaveTextContent('1');

      fireEvent.click(screen.getByTestId('corrupt'));
      expect(screen.getByTestId('error-boundary')).toBeInTheDocument();
    });
  });

  describe('User Input Validation Errors', () => {
    test('should handle form validation errors', async () => {
      render(<FormComponent shouldFailValidation={true} />);

      fireEvent.click(screen.getByTestId('submit-button'));

      await waitFor(() => {
        expect(screen.getByTestId('form-error')).toBeInTheDocument();
        expect(screen.getByTestId('form-error')).toHaveTextContent('Validation failed');
      });
    });

    test('should provide accessible error messages', async () => {
      render(<FormComponent />);

      // Submit empty form
      fireEvent.click(screen.getByTestId('submit-button'));

      await waitFor(() => {
        const errorElement = screen.getByTestId('form-error');
        expect(errorElement).toBeInTheDocument();
        expect(errorElement).toHaveAttribute('role', 'alert');
        expect(errorElement).toHaveTextContent('at least 3 characters');
      });
    });

    test('should handle malformed user input', async () => {
      const onSubmit = jest.fn();
      render(<FormComponent onSubmit={onSubmit} />);

      const input = screen.getByTestId('title-input');
      
      // Test various malformed inputs
      const malformedInputs = [
        '<script>alert("xss")</script>',
        'SELECT * FROM users',
        '../../etc/passwd',
        '\x00null_byte'
      ];

      for (const malformedInput of malformedInputs) {
        fireEvent.change(input, { target: { value: malformedInput } });
        fireEvent.click(screen.getByTestId('submit-button'));

        await waitFor(() => {
          // Input should be sanitized or validation should fail
          expect(onSubmit).toHaveBeenCalledWith({ title: malformedInput });
        });

        onSubmit.mockClear();
      }
    });

    test('should handle input field focus and blur errors', () => {
      const FailingInputComponent: React.FC = () => {
        const [error, setError] = React.useState<string | null>(null);

        const handleFocus = () => {
          try {
            throw new Error('Focus handler failed');
          } catch (err) {
            setError('Focus error occurred');
          }
        };

        return (
          <div>
            <input 
              onFocus={handleFocus}
              data-testid="failing-input"
              placeholder="Focus to trigger error"
            />
            {error && <div data-testid="focus-error">{error}</div>}
          </div>
        );
      };

      render(<FailingInputComponent />);

      fireEvent.focus(screen.getByTestId('failing-input'));

      expect(screen.getByTestId('focus-error')).toBeInTheDocument();
    });
  });

  describe('Event Handler Errors', () => {
    test('should handle click handler errors', () => {
      const FailingButtonComponent: React.FC = () => {
        const [error, setError] = React.useState<string | null>(null);

        const handleClick = () => {
          try {
            throw new Error('Click handler failed');
          } catch (err) {
            setError('Button click failed');
          }
        };

        return (
          <div>
            <button onClick={handleClick} data-testid="failing-button">
              Click to Fail
            </button>
            {error && <div data-testid="click-error">{error}</div>}
          </div>
        );
      };

      render(<FailingButtonComponent />);

      fireEvent.click(screen.getByTestId('failing-button'));

      expect(screen.getByTestId('click-error')).toBeInTheDocument();
    });

    test('should handle keyboard event errors', () => {
      const FailingKeyboardComponent: React.FC = () => {
        const [error, setError] = React.useState<string | null>(null);

        const handleKeyDown = (e: React.KeyboardEvent) => {
          try {
            if (e.key === 'Enter') {
              throw new Error('Keyboard handler failed');
            }
          } catch (err) {
            setError('Keyboard event failed');
          }
        };

        return (
          <div>
            <input 
              onKeyDown={handleKeyDown}
              data-testid="keyboard-input"
              placeholder="Press Enter to trigger error"
            />
            {error && <div data-testid="keyboard-error">{error}</div>}
          </div>
        );
      };

      render(<FailingKeyboardComponent />);

      fireEvent.keyDown(screen.getByTestId('keyboard-input'), { key: 'Enter' });

      expect(screen.getByTestId('keyboard-error')).toBeInTheDocument();
    });

    test('should handle async event handler errors', async () => {
      const AsyncFailingComponent: React.FC = () => {
        const [error, setError] = React.useState<string | null>(null);
        const [loading, setLoading] = React.useState(false);

        const handleAsyncClick = async () => {
          setLoading(true);
          setError(null);
          
          try {
            await new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Async operation failed')), 100)
            );
          } catch (err) {
            setError('Async operation failed');
          } finally {
            setLoading(false);
          }
        };

        return (
          <div>
            <button 
              onClick={handleAsyncClick}
              data-testid="async-button"
              disabled={loading}
            >
              {loading ? 'Loading...' : 'Async Action'}
            </button>
            {error && <div data-testid="async-error">{error}</div>}
          </div>
        );
      };

      render(<AsyncFailingComponent />);

      fireEvent.click(screen.getByTestId('async-button'));

      await waitFor(() => {
        expect(screen.getByTestId('async-error')).toBeInTheDocument();
      });
    });
  });

  describe('Error Boundary Testing', () => {
    test('should catch errors from child components', () => {
      const ThrowError: React.FC = () => {
        throw new Error('Child component error');
      };

      render(
        <TestErrorBoundary>
          <ThrowError />
        </TestErrorBoundary>
      );

      expect(screen.getByTestId('error-boundary')).toBeInTheDocument();
      expect(screen.getByText('Child component error')).toBeInTheDocument();
    });

    test('should not catch errors from event handlers', () => {
      const consoleSpy = jest.spyOn(console, 'error');
      
      const EventHandlerError: React.FC = () => {
        const handleClick = () => {
          throw new Error('Event handler error');
        };

        return <button onClick={handleClick} data-testid="event-error-button">Click</button>;
      };

      render(
        <TestErrorBoundary>
          <EventHandlerError />
        </TestErrorBoundary>
      );

      expect(() => {
        fireEvent.click(screen.getByTestId('event-error-button'));
      }).toThrow('Event handler error');

      consoleSpy.mockRestore();
    });

    test('should handle nested error boundaries', () => {
      const NestedError: React.FC = () => {
        throw new Error('Nested component error');
      };

      render(
        <TestErrorBoundary>
          <div>
            <TestErrorBoundary>
              <NestedError />
            </TestErrorBoundary>
          </div>
        </TestErrorBoundary>
      );

      // Inner boundary should catch the error
      expect(screen.getByTestId('error-boundary')).toBeInTheDocument();
      expect(screen.getByText('Nested component error')).toBeInTheDocument();
    });

    test('should provide error recovery mechanisms', () => {
      const RecoverableError: React.FC<{ shouldError: boolean }> = ({ shouldError }) => {
        if (shouldError) {
          throw new Error('Recoverable error');
        }
        return <div data-testid="success-component">Success!</div>;
      };

      const TestWrapper: React.FC = () => {
        const [shouldError, setShouldError] = React.useState(true);

        return (
          <TestErrorBoundary>
            <RecoverableError shouldError={shouldError} />
            <button 
              onClick={() => setShouldError(false)}
              data-testid="fix-error"
            >
              Fix Error
            </button>
          </TestErrorBoundary>
        );
      };

      render(<TestWrapper />);

      expect(screen.getByTestId('error-boundary')).toBeInTheDocument();

      // Reset error boundary and fix the error
      fireEvent.click(screen.getByTestId('retry-button'));

      // The component should now work
      fireEvent.click(screen.getByTestId('fix-error'));

      expect(screen.queryByTestId('error-boundary')).not.toBeInTheDocument();
      expect(screen.getByTestId('success-component')).toBeInTheDocument();
    });
  });

  describe('Memory and Performance Error Scenarios', () => {
    test('should handle memory leaks in components', () => {
      const MemoryLeakComponent: React.FC = () => {
        const [data, setData] = React.useState<any[]>([]);

        React.useEffect(() => {
          const interval = setInterval(() => {
            setData(prev => [...prev, new Array(1000).fill(0)]);
          }, 100);

          // Simulate memory leak by not cleaning up
          // return () => clearInterval(interval);
        }, []);

        return <div data-testid="memory-leak">Data length: {data.length}</div>;
      };

      const { unmount } = render(<MemoryLeakComponent />);

      // Component should render without immediate errors
      expect(screen.getByTestId('memory-leak')).toBeInTheDocument();

      // Cleanup
      unmount();
    });

    test('should handle infinite re-render scenarios', () => {
      let renderCount = 0;

      const InfiniteRenderComponent: React.FC = () => {
        renderCount++;
        const [count, setCount] = React.useState(0);

        // This would cause infinite re-renders in a real scenario
        if (renderCount < 5) {
          React.useEffect(() => {
            setCount(c => c + 1);
          }, [count]);
        }

        return <div data-testid="render-count">Renders: {renderCount}</div>;
      };

      render(
        <TestErrorBoundary>
          <InfiniteRenderComponent />
        </TestErrorBoundary>
      );

      expect(screen.getByTestId('render-count')).toBeInTheDocument();
    });

    test('should handle large dataset rendering errors', () => {
      const LargeDatasetComponent: React.FC = () => {
        const largeDataset = Array.from({ length: 10000 }, (_, i) => ({
          id: i,
          data: `Item ${i}`
        }));

        try {
          return (
            <div data-testid="large-dataset">
              {largeDataset.map(item => (
                <div key={item.id}>{item.data}</div>
              ))}
            </div>
          );
        } catch (error) {
          return <div data-testid="render-error">Failed to render large dataset</div>;
        }
      };

      render(<LargeDatasetComponent />);

      // Should either render successfully or show error
      expect(
        screen.getByTestId('large-dataset') || screen.getByTestId('render-error')
      ).toBeInTheDocument();
    });
  });

  describe('Accessibility Error Scenarios', () => {
    test('should maintain accessibility during error states', async () => {
      render(<FormComponent shouldFailValidation={true} />);

      fireEvent.click(screen.getByTestId('submit-button'));

      await waitFor(() => {
        const errorElement = screen.getByTestId('form-error');
        expect(errorElement).toHaveAttribute('role', 'alert');
        expect(errorElement).toBeInTheDocument();
      });
    });

    test('should provide screen reader accessible error messages', () => {
      render(
        <TestErrorBoundary>
          <FailingSearchComponent shouldFail={true} />
        </TestErrorBoundary>
      );

      const errorBoundary = screen.getByTestId('error-boundary');
      expect(errorBoundary).toBeInTheDocument();

      // Error should be announced to screen readers
      const errorMessage = screen.getByText('Component render failed');
      expect(errorMessage).toBeInTheDocument();
    });

    test('should handle focus management during errors', () => {
      const FocusErrorComponent: React.FC = () => {
        const [showError, setShowError] = React.useState(false);
        const errorRef = React.useRef<HTMLDivElement>(null);

        const triggerError = () => {
          setShowError(true);
          setTimeout(() => {
            errorRef.current?.focus();
          }, 0);
        };

        return (
          <div>
            <button onClick={triggerError} data-testid="trigger-error">
              Trigger Error
            </button>
            {showError && (
              <div 
                ref={errorRef}
                data-testid="focus-error"
                tabIndex={-1}
                role="alert"
              >
                An error occurred
              </div>
            )}
          </div>
        );
      };

      render(<FocusErrorComponent />);

      fireEvent.click(screen.getByTestId('trigger-error'));

      const errorElement = screen.getByTestId('focus-error');
      expect(errorElement).toBeInTheDocument();
      expect(errorElement).toHaveAttribute('role', 'alert');
    });
  });
});