/**
 * Component Isolation and Dependency Tests
 *
 * Tests for component isolation, dependency injection, mocking patterns,
 * and ensuring components work independently without tight coupling.
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

// Dependency injection patterns
interface ApiService {
  get(url: string): Promise<any>;
  post(url: string, data: any): Promise<any>;
  put(url: string, data: any): Promise<any>;
  delete(url: string): Promise<any>;
}

interface Logger {
  log(message: string): void;
  error(message: string, error?: Error): void;
  warn(message: string): void;
}

interface AnalyticsService {
  track(event: string, properties?: Record<string, any>): void;
  identify(userId: string, traits?: Record<string, any>): void;
}

// Service context for dependency injection
interface ServiceContextValue {
  apiService: ApiService;
  logger: Logger;
  analytics: AnalyticsService;
}

const ServiceContext = React.createContext<ServiceContextValue | null>(null);

const useServices = () => {
  const context = React.useContext(ServiceContext);
  if (!context) {
    throw new Error('useServices must be used within ServiceProvider');
  }
  return context;
};

// Mock implementations
const createMockApiService = (): ApiService => ({
  get: jest.fn().mockResolvedValue({ data: 'mock data' }),
  post: jest.fn().mockResolvedValue({ id: 'new-id' }),
  put: jest.fn().mockResolvedValue({ success: true }),
  delete: jest.fn().mockResolvedValue({ success: true })
});

const createMockLogger = (): Logger => ({
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
});

const createMockAnalytics = (): AnalyticsService => ({
  track: jest.fn(),
  identify: jest.fn()
});

// Components with dependencies
interface UserListProps {
  onUserSelect?: (user: any) => void;
  className?: string;
}

const UserList: React.FC<UserListProps> = ({ onUserSelect, className = '' }) => {
  const { apiService, logger, analytics } = useServices();
  const [users, setUsers] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      setError(null);

      try {
        logger.log('Fetching users');
        analytics.track('users_fetch_started');

        const response = await apiService.get('/api/users');
        setUsers(response.data || response);

        analytics.track('users_fetch_success', { count: response.data?.length || 0 });
      } catch (err: any) {
        const errorMessage = err.message || 'Failed to fetch users';
        setError(errorMessage);
        logger.error('Failed to fetch users', err);
        analytics.track('users_fetch_error', { error: errorMessage });
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [apiService, logger, analytics]);

  const handleUserClick = React.useCallback((user: any) => {
    analytics.track('user_selected', { userId: user.id, userName: user.name });
    onUserSelect?.(user);
  }, [analytics, onUserSelect]);

  if (loading) {
    return (
      <div className={`user-list ${className}`} data-testid="user-list-loading">
        Loading users...
      </div>
    );
  }

  if (error) {
    return (
      <div className={`user-list ${className}`} data-testid="user-list-error">
        Error: {error}
      </div>
    );
  }

  return (
    <div className={`user-list ${className}`} data-testid="user-list">
      {users.length === 0 ? (
        <div data-testid="user-list-empty">No users found</div>
      ) : (
        <ul>
          {users.map((user) => (
            <li key={user.id}>
              <button
                onClick={() => handleUserClick(user)}
                data-testid={`user-item-${user.id}`}
                className="user-item-button"
              >
                {user.name} ({user.email})
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// Pure component (no dependencies)
interface CounterProps {
  initialValue?: number;
  onCountChange?: (count: number) => void;
  step?: number;
  min?: number;
  max?: number;
}

const PureCounter: React.FC<CounterProps> = ({
  initialValue = 0,
  onCountChange,
  step = 1,
  min = -Infinity,
  max = Infinity
}) => {
  const [count, setCount] = React.useState(initialValue);

  React.useEffect(() => {
    onCountChange?.(count);
  }, [count, onCountChange]);

  const increment = React.useCallback(() => {
    setCount(prev => Math.min(prev + step, max));
  }, [step, max]);

  const decrement = React.useCallback(() => {
    setCount(prev => Math.max(prev - step, min));
  }, [step, min]);

  const reset = React.useCallback(() => {
    setCount(initialValue);
  }, [initialValue]);

  return (
    <div data-testid="pure-counter" className="counter">
      <div data-testid="counter-value">Count: {count}</div>
      <div className="counter-controls">
        <button
          onClick={decrement}
          disabled={count <= min}
          data-testid="counter-decrement"
        >
          -
        </button>
        <button
          onClick={reset}
          data-testid="counter-reset"
        >
          Reset
        </button>
        <button
          onClick={increment}
          disabled={count >= max}
          data-testid="counter-increment"
        >
          +
        </button>
      </div>
    </div>
  );
};

// Component with configurable dependencies
interface ConfigurableComponentProps {
  config: {
    enableLogging?: boolean;
    enableAnalytics?: boolean;
    apiEndpoint?: string;
    retryAttempts?: number;
  };
  children?: React.ReactNode;
}

const ConfigurableComponent: React.FC<ConfigurableComponentProps> = ({
  config,
  children
}) => {
  const services = useServices();
  const [data, setData] = React.useState<any>(null);
  const [retryCount, setRetryCount] = React.useState(0);

  const fetchData = React.useCallback(async () => {
    try {
      if (config.enableLogging) {
        services.logger.log(`Fetching data from ${config.apiEndpoint}`);
      }

      const response = await services.apiService.get(config.apiEndpoint || '/api/data');
      setData(response);

      if (config.enableAnalytics) {
        services.analytics.track('data_fetch_success');
      }
    } catch (error: any) {
      if (config.enableLogging) {
        services.logger.error('Data fetch failed', error);
      }

      if (retryCount < (config.retryAttempts || 0)) {
        setRetryCount(prev => prev + 1);
        setTimeout(fetchData, 1000 * (retryCount + 1));
      }
    }
  }, [config, services, retryCount]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div data-testid="configurable-component" data-config={JSON.stringify(config)}>
      <div data-testid="retry-count">Retry Count: {retryCount}</div>
      <div data-testid="component-data">
        Data: {data ? JSON.stringify(data) : 'No data'}
      </div>
      {children}
    </div>
  );
};

// Higher-order component for dependency injection
const withServices = <P extends object>(
  Component: React.ComponentType<P>,
  serviceOverrides?: Partial<ServiceContextValue>
) => {
  return React.forwardRef<any, P>((props, ref) => {
    const existingServices = React.useContext(ServiceContext);

    const services = React.useMemo(() => ({
      ...existingServices,
      ...serviceOverrides
    }), [existingServices]);

    if (!existingServices && !serviceOverrides) {
      throw new Error('Component requires ServiceProvider or service overrides');
    }

    return (
      <ServiceContext.Provider value={services as ServiceContextValue}>
        <Component ref={ref} {...props} />
      </ServiceContext.Provider>
    );
  });
};

// Test wrapper component
const TestServiceProvider: React.FC<{
  children: React.ReactNode;
  apiService?: ApiService;
  logger?: Logger;
  analytics?: AnalyticsService;
}> = ({
  children,
  apiService = createMockApiService(),
  logger = createMockLogger(),
  analytics = createMockAnalytics()
}) => {
  const services = React.useMemo(() => ({
    apiService,
    logger,
    analytics
  }), [apiService, logger, analytics]);

  return (
    <ServiceContext.Provider value={services}>
      {children}
    </ServiceContext.Provider>
  );
};

describe('Component Isolation and Dependency Tests', () => {
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

  describe('Pure Component Isolation', () => {
    it('should work independently without external dependencies', async () => {
      const onCountChange = tester.createMock('onCountChange');

      render(
        <PureCounter
          initialValue={5}
          onCountChange={onCountChange}
          step={2}
          min={0}
          max={10}
        />
      );

      // Initial state
      expect(screen.getByTestId('counter-value')).toHaveTextContent('Count: 5');
      expect(onCountChange).toHaveBeenCalledWith(5);

      // Increment
      await user.click(screen.getByTestId('counter-increment'));

      await waitFor(() => {
        expect(screen.getByTestId('counter-value')).toHaveTextContent('Count: 7');
        expect(onCountChange).toHaveBeenCalledWith(7);
      });

      // Decrement
      await user.click(screen.getByTestId('counter-decrement'));

      await waitFor(() => {
        expect(screen.getByTestId('counter-value')).toHaveTextContent('Count: 5');
        expect(onCountChange).toHaveBeenCalledWith(5);
      });

      // Reset
      await user.click(screen.getByTestId('counter-reset'));

      await waitFor(() => {
        expect(screen.getByTestId('counter-value')).toHaveTextContent('Count: 5');
      });
    });

    it('should respect constraints without external validation', async () => {
      render(
        <PureCounter
          initialValue={8}
          min={0}
          max={10}
          step={3}
        />
      );

      const incrementButton = screen.getByTestId('counter-increment');
      const decrementButton = screen.getByTestId('counter-decrement');

      // Should be able to increment to max
      await user.click(incrementButton);

      await waitFor(() => {
        expect(screen.getByTestId('counter-value')).toHaveTextContent('Count: 10');
        expect(incrementButton).toBeDisabled();
      });

      // Multiple decrements to test min boundary
      await user.click(decrementButton);
      await user.click(decrementButton);
      await user.click(decrementButton);

      await waitFor(() => {
        expect(screen.getByTestId('counter-value')).toHaveTextContent('Count: 1');
      });

      await user.click(decrementButton);

      await waitFor(() => {
        expect(screen.getByTestId('counter-value')).toHaveTextContent('Count: 0');
        expect(decrementButton).toBeDisabled();
      });
    });
  });

  describe('Dependency Injection Patterns', () => {
    it('should work with injected dependencies', async () => {
      const mockApiService = createMockApiService();
      const mockLogger = createMockLogger();
      const mockAnalytics = createMockAnalytics();

      const userData = [
        { id: '1', name: 'John Doe', email: 'john@example.com' },
        { id: '2', name: 'Jane Smith', email: 'jane@example.com' }
      ];

      mockApiService.get = jest.fn().mockResolvedValue({ data: userData });

      const onUserSelect = tester.createMock('onUserSelect');

      render(
        <TestServiceProvider
          apiService={mockApiService}
          logger={mockLogger}
          analytics={mockAnalytics}
        >
          <UserList onUserSelect={onUserSelect} />
        </TestServiceProvider>
      );

      // Should show loading initially
      expect(screen.getByTestId('user-list-loading')).toBeInTheDocument();

      // Wait for data to load
      await waitFor(() => {
        expect(screen.getByTestId('user-list')).toBeInTheDocument();
      });

      // Verify API was called
      expect(mockApiService.get).toHaveBeenCalledWith('/api/users');

      // Verify logging
      expect(mockLogger.log).toHaveBeenCalledWith('Fetching users');

      // Verify analytics
      expect(mockAnalytics.track).toHaveBeenCalledWith('users_fetch_started');
      expect(mockAnalytics.track).toHaveBeenCalledWith('users_fetch_success', { count: 2 });

      // Test user interaction
      await user.click(screen.getByTestId('user-item-1'));

      expect(onUserSelect).toHaveBeenCalledWith(userData[0]);
      expect(mockAnalytics.track).toHaveBeenCalledWith('user_selected', {
        userId: '1',
        userName: 'John Doe'
      });
    });

    it('should handle dependency errors gracefully', async () => {
      const mockApiService = createMockApiService();
      const mockLogger = createMockLogger();
      const mockAnalytics = createMockAnalytics();

      const errorMessage = 'Network error';
      mockApiService.get = jest.fn().mockRejectedValue(new Error(errorMessage));

      render(
        <TestServiceProvider
          apiService={mockApiService}
          logger={mockLogger}
          analytics={mockAnalytics}
        >
          <UserList />
        </TestServiceProvider>
      );

      // Wait for error state
      await waitFor(() => {
        expect(screen.getByTestId('user-list-error')).toBeInTheDocument();
        expect(screen.getByText(`Error: ${errorMessage}`)).toBeInTheDocument();
      });

      // Verify error handling
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to fetch users', expect.any(Error));
      expect(mockAnalytics.track).toHaveBeenCalledWith('users_fetch_error', {
        error: errorMessage
      });
    });

    it('should allow selective dependency mocking', async () => {
      const mockLogger = createMockLogger();

      // Use real analytics but mock logger
      const realAnalytics = createMockAnalytics();

      render(
        <TestServiceProvider logger={mockLogger} analytics={realAnalytics}>
          <UserList />
        </TestServiceProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('user-list')).toBeInTheDocument();
      });

      // Only mocked logger should have been called
      expect(mockLogger.log).toHaveBeenCalled();
      expect(realAnalytics.track).toHaveBeenCalled();
    });
  });

  describe('Configuration-based Dependencies', () => {
    it('should behave differently based on configuration', async () => {
      const mockApiService = createMockApiService();
      const mockLogger = createMockLogger();
      const mockAnalytics = createMockAnalytics();

      const config1 = {
        enableLogging: true,
        enableAnalytics: false,
        apiEndpoint: '/api/data1'
      };

      const config2 = {
        enableLogging: false,
        enableAnalytics: true,
        apiEndpoint: '/api/data2'
      };

      const { rerender } = render(
        <TestServiceProvider
          apiService={mockApiService}
          logger={mockLogger}
          analytics={mockAnalytics}
        >
          <ConfigurableComponent config={config1} />
        </TestServiceProvider>
      );

      // Wait for first configuration
      await waitFor(() => {
        expect(mockApiService.get).toHaveBeenCalledWith('/api/data1');
        expect(mockLogger.log).toHaveBeenCalled();
        expect(mockAnalytics.track).not.toHaveBeenCalled();
      });

      // Reset mocks
      jest.clearAllMocks();

      // Rerender with different config
      rerender(
        <TestServiceProvider
          apiService={mockApiService}
          logger={mockLogger}
          analytics={mockAnalytics}
        >
          <ConfigurableComponent config={config2} />
        </TestServiceProvider>
      );

      await waitFor(() => {
        expect(mockApiService.get).toHaveBeenCalledWith('/api/data2');
        expect(mockLogger.log).not.toHaveBeenCalled();
        expect(mockAnalytics.track).toHaveBeenCalled();
      });
    });

    it('should handle retry logic based on configuration', async () => {
      jest.useFakeTimers();

      const mockApiService = createMockApiService();
      mockApiService.get = jest.fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockRejectedValueOnce(new Error('Second failure'))
        .mockResolvedValue({ success: true });

      const config = {
        retryAttempts: 2,
        enableLogging: true
      };

      render(
        <TestServiceProvider apiService={mockApiService}>
          <ConfigurableComponent config={config} />
        </TestServiceProvider>
      );

      // Initial failure
      await waitFor(() => {
        expect(screen.getByTestId('retry-count')).toHaveTextContent('Retry Count: 0');
      });

      // First retry
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(screen.getByTestId('retry-count')).toHaveTextContent('Retry Count: 1');
      });

      // Second retry
      act(() => {
        jest.advanceTimersByTime(2000);
      });

      await waitFor(() => {
        expect(screen.getByTestId('retry-count')).toHaveTextContent('Retry Count: 2');
      });

      // Final success
      act(() => {
        jest.advanceTimersByTime(3000);
      });

      await waitFor(() => {
        expect(screen.getByTestId('component-data')).toHaveTextContent(
          'Data: {"success":true}'
        );
      });

      expect(mockApiService.get).toHaveBeenCalledTimes(3);

      jest.useRealTimers();
    });
  });

  describe('Higher-Order Component Patterns', () => {
    it('should inject dependencies through HOC', async () => {
      const customApiService = createMockApiService();
      customApiService.get = jest.fn().mockResolvedValue({ data: ['custom', 'data'] });

      const EnhancedUserList = withServices(UserList, {
        apiService: customApiService
      });

      render(
        <TestServiceProvider>
          <EnhancedUserList />
        </TestServiceProvider>
      );

      await waitFor(() => {
        expect(customApiService.get).toHaveBeenCalled();
      });
    });

    it('should handle missing dependencies in HOC', async () => {
      const ConsoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      expect(() => {
        render(<withServices(UserList) />);
      }).toThrow('Component requires ServiceProvider or service overrides');

      ConsoleErrorSpy.mockRestore();
    });
  });

  describe('Component Mocking and Testing Isolation', () => {
    it('should isolate component behavior with mocked dependencies', async () => {
      const mockApiService = createMockApiService();
      const mockLogger = createMockLogger();
      const mockAnalytics = createMockAnalytics();

      // Create specific mock behaviors
      mockApiService.get = jest.fn()
        .mockResolvedValueOnce({ data: [] }) // Empty response
        .mockResolvedValueOnce({ data: [{ id: '1', name: 'Test User', email: 'test@example.com' }] });

      const { rerender } = render(
        <TestServiceProvider
          apiService={mockApiService}
          logger={mockLogger}
          analytics={mockAnalytics}
        >
          <UserList />
        </TestServiceProvider>
      );

      // First render should show empty state
      await waitFor(() => {
        expect(screen.getByTestId('user-list-empty')).toBeInTheDocument();
      });

      // Force re-render with different mock response
      rerender(
        <TestServiceProvider
          apiService={mockApiService}
          logger={mockLogger}
          analytics={mockAnalytics}
        >
          <UserList key="second-render" />
        </TestServiceProvider>
      );

      // Second render should show user data
      await waitFor(() => {
        expect(screen.getByTestId('user-item-1')).toBeInTheDocument();
      });

      // Verify both API calls happened
      expect(mockApiService.get).toHaveBeenCalledTimes(2);
    });

    it('should test component in complete isolation', async () => {
      // Test PureCounter without any external dependencies
      const onCountChange = jest.fn();

      render(
        <PureCounter
          initialValue={0}
          onCountChange={onCountChange}
          step={1}
          min={-5}
          max={5}
        />
      );

      // Test full functionality without any service dependencies
      await user.click(screen.getByTestId('counter-increment'));
      expect(onCountChange).toHaveBeenLastCalledWith(1);

      await user.click(screen.getByTestId('counter-increment'));
      expect(onCountChange).toHaveBeenLastCalledWith(2);

      await user.click(screen.getByTestId('counter-decrement'));
      expect(onCountChange).toHaveBeenLastCalledWith(1);

      await user.click(screen.getByTestId('counter-reset'));
      expect(onCountChange).toHaveBeenLastCalledWith(0);

      // Test that it works completely independently
      expect(onCountChange).toHaveBeenCalledTimes(5); // Initial + 4 interactions
    });
  });

  describe('Dependency Replacement and Swapping', () => {
    it('should allow runtime dependency replacement', async () => {
      const originalApiService = createMockApiService();
      const replacementApiService = createMockApiService();

      originalApiService.get = jest.fn().mockResolvedValue({ data: ['original'] });
      replacementApiService.get = jest.fn().mockResolvedValue({ data: ['replacement'] });

      const TestWrapper = ({ useReplacement }: { useReplacement: boolean }) => (
        <TestServiceProvider
          apiService={useReplacement ? replacementApiService : originalApiService}
        >
          <UserList />
        </TestServiceProvider>
      );

      const { rerender } = render(<TestWrapper useReplacement={false} />);

      await waitFor(() => {
        expect(originalApiService.get).toHaveBeenCalled();
        expect(replacementApiService.get).not.toHaveBeenCalled();
      });

      // Switch to replacement service
      rerender(<TestWrapper useReplacement={true} />);

      await waitFor(() => {
        expect(replacementApiService.get).toHaveBeenCalled();
      });
    });
  });
});