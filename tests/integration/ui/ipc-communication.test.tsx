/**
 * IPC Communication Integration Tests
 * Tests communication between renderer and main process
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Test components that use IPC
import { AIAuthorizationDialog } from '../../../src/renderer/components/dialogs/AIAuthorizationDialog';
import { TransparencyDashboard } from '../../../src/renderer/components/dashboard/TransparencyDashboard';
import { APISettingsManagement } from '../../../src/renderer/components/settings/APISettingsManagement';

// Mock IPC channels and responses
const mockIpcChannels = {
  // AI Authorization channels
  'ai:authorization-request': { requestId: 'req-123', approved: false },
  'ai:authorization-result': { success: true },
  'ai:cost-estimation': { estimatedCost: 2.45, tokensToUse: 5000 },

  // Transparency channels
  'transparency:get-usage-data': {
    totalQueries: 1247,
    totalTokens: 2847392,
    avgResponseTime: 1.2,
    successRate: 98.5,
  },
  'transparency:get-cost-data': {
    currentMonth: 45.67,
    lastMonth: 38.92,
    yearToDate: 523.45,
  },
  'transparency:get-auth-data': {
    pendingRequests: 3,
    approvedToday: 15,
    rejectedToday: 2,
  },
  'transparency:get-trends-data': {
    dailyUsage: [
      { date: '2024-01-01', queries: 45, cost: 12.34 },
    ],
  },
  'transparency:get-logs-data': {
    entries: [
      {
        id: '1',
        timestamp: new Date().toISOString(),
        level: 'info',
        operation: 'Search',
        message: 'Search completed successfully',
      },
    ],
  },

  // API Settings channels
  'api-settings:get-all': {
    openai: { apiKey: 'sk-test-key', model: 'gpt-4' },
    anthropic: { apiKey: 'claude-test-key', model: 'claude-3' },
  },
  'api-settings:save': { success: true },
  'api-settings:test-connection': { success: true, responseTime: 245 },
  'api-settings:encrypt-key': 'encrypted-key-data',
  'api-settings:decrypt-key': 'decrypted-key-data',

  // Error simulation channels
  'error:network-failure': new Error('Network connection failed'),
  'error:invalid-params': new Error('Invalid parameters provided'),
};

// Mock IPC renderer with comprehensive tracking
const mockIpcRenderer = {
  invoke: jest.fn(),
  on: jest.fn(),
  removeAllListeners: jest.fn(),
  send: jest.fn(),

  // Track all IPC calls for testing
  _callLog: [] as any[],
  _listeners: new Map(),
};

// Enhanced invoke implementation with call tracking
mockIpcRenderer.invoke.mockImplementation(async (channel: string, ...args: any[]) => {
  // Log the call
  const call = { channel, args, timestamp: Date.now() };
  mockIpcRenderer._callLog.push(call);

  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 10));

  // Return mock data or throw error
  if (channel.startsWith('error:')) {
    throw mockIpcChannels[channel as keyof typeof mockIpcChannels];
  }

  return mockIpcChannels[channel as keyof typeof mockIpcChannels] || {};
});

// Enhanced on implementation with listener tracking
mockIpcRenderer.on.mockImplementation((channel: string, callback: Function) => {
  if (!mockIpcRenderer._listeners.has(channel)) {
    mockIpcRenderer._listeners.set(channel, []);
  }
  mockIpcRenderer._listeners.get(channel).push(callback);
  return mockIpcRenderer;
});

Object.defineProperty(window, 'electronAPI', {
  value: mockIpcRenderer,
  writable: true,
});

describe('IPC Communication Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIpcRenderer._callLog = [];
    mockIpcRenderer._listeners.clear();
  });

  describe('AI Authorization IPC Flow', () => {
    test('should send authorization request to main process', async () => {
      const costData = {
        estimatedCost: 2.45,
        tokensToUse: 5000,
        operation: 'Document Analysis',
      };

      render(
        <AIAuthorizationDialog
          isOpen={true}
          onClose={jest.fn()}
          onAuthorize={jest.fn()}
          costData={costData}
        />
      );

      const authorizeBtn = screen.getByRole('button', { name: /authorize/i });
      fireEvent.click(authorizeBtn);

      await waitFor(() => {
        expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
          'ai:authorization-result',
          expect.objectContaining({
            approved: true,
            costData,
            timestamp: expect.any(Number),
          })
        );
      });
    });

    test('should handle authorization response from main process', async () => {
      const onAuthorize = jest.fn();

      render(
        <AIAuthorizationDialog
          isOpen={true}
          onClose={jest.fn()}
          onAuthorize={onAuthorize}
          costData={{ estimatedCost: 1.0, tokensToUse: 1000, operation: 'Test' }}
        />
      );

      const authorizeBtn = screen.getByRole('button', { name: /authorize/i });
      fireEvent.click(authorizeBtn);

      await waitFor(() => {
        expect(onAuthorize).toHaveBeenCalledWith(
          expect.objectContaining({
            approved: true,
          })
        );
      });
    });

    test('should request cost estimation from main process', async () => {
      mockIpcRenderer.invoke.mockResolvedValueOnce({
        estimatedCost: 3.75,
        tokensToUse: 7500,
      });

      const TestComponent = () => {
        const [costData, setCostData] = React.useState(null);

        React.useEffect(() => {
          window.electronAPI.invoke('ai:cost-estimation', {
            operation: 'Complex Analysis',
            inputSize: 15000,
          }).then(setCostData);
        }, []);

        if (!costData) return <div>Loading...</div>;

        return (
          <AIAuthorizationDialog
            isOpen={true}
            onClose={jest.fn()}
            onAuthorize={jest.fn()}
            costData={costData}
          />
        );
      };

      render(<TestComponent />);

      await waitFor(() => {
        expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
          'ai:cost-estimation',
          expect.objectContaining({
            operation: 'Complex Analysis',
            inputSize: 15000,
          })
        );
      });
    });
  });

  describe('Transparency Dashboard IPC Flow', () => {
    test('should fetch all dashboard data on component mount', async () => {
      render(<TransparencyDashboard />);

      await waitFor(() => {
        expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('transparency:get-usage-data');
        expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('transparency:get-cost-data');
        expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('transparency:get-auth-data');
        expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('transparency:get-trends-data');
        expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('transparency:get-logs-data');
      });

      // Verify data is displayed
      expect(screen.getByText('1,247')).toBeInTheDocument(); // Total queries
      expect(screen.getByText('$45.67')).toBeInTheDocument(); // Current month cost
    });

    test('should handle tab switching with selective data fetching', async () => {
      render(<TransparencyDashboard />);

      // Clear call log after initial load
      await waitFor(() => {
        expect(mockIpcRenderer.invoke).toHaveBeenCalled();
      });
      mockIpcRenderer._callLog = [];

      // Switch to Costs tab
      const costsTab = screen.getByRole('tab', { name: /costs/i });
      fireEvent.click(costsTab);

      await waitFor(() => {
        // Should fetch cost data when switching to costs tab
        const costsCalls = mockIpcRenderer._callLog.filter(
          call => call.channel === 'transparency:get-cost-data'
        );
        expect(costsCalls.length).toBeGreaterThan(0);
      });
    });

    test('should setup real-time data listeners', async () => {
      render(<TransparencyDashboard />);

      await waitFor(() => {
        // Should register listeners for real-time updates
        expect(mockIpcRenderer.on).toHaveBeenCalledWith(
          'transparency:usage-updated',
          expect.any(Function)
        );
        expect(mockIpcRenderer.on).toHaveBeenCalledWith(
          'transparency:cost-updated',
          expect.any(Function)
        );
      });
    });

    test('should export logs data via IPC', async () => {
      render(<TransparencyDashboard />);

      // Switch to logs tab
      const logsTab = screen.getByRole('tab', { name: /logs/i });
      fireEvent.click(logsTab);

      await waitFor(() => {
        const exportBtn = screen.getByRole('button', { name: /export/i });
        fireEvent.click(exportBtn);
      });

      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
        'transparency:export-logs',
        expect.objectContaining({
          format: expect.any(String),
          dateRange: expect.any(Object),
        })
      );
    });
  });

  describe('API Settings IPC Flow', () => {
    test('should load settings from main process on mount', async () => {
      render(<APISettingsManagement />);

      await waitFor(() => {
        expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('api-settings:get-all');
      });

      // Verify settings are loaded and displayed
      expect(screen.getByDisplayValue('sk-test-key')).toBeInTheDocument();
    });

    test('should save settings to main process', async () => {
      render(<APISettingsManagement />);

      await waitFor(() => {
        const apiKeyInput = screen.getByDisplayValue('sk-test-key');
        fireEvent.change(apiKeyInput, { target: { value: 'sk-new-key-123' } });

        const saveBtn = screen.getByRole('button', { name: /save/i });
        fireEvent.click(saveBtn);
      });

      await waitFor(() => {
        expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
          'api-settings:save',
          expect.objectContaining({
            openai: expect.objectContaining({
              apiKey: 'sk-new-key-123',
            }),
          })
        );
      });
    });

    test('should test API connection via main process', async () => {
      render(<APISettingsManagement />);

      await waitFor(() => {
        const testBtn = screen.getByTestId('test-connection-btn');
        fireEvent.click(testBtn);
      });

      await waitFor(() => {
        expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
          'api-settings:test-connection',
          'openai',
          expect.any(String)
        );
      });

      // Verify success message is shown
      expect(screen.getByText(/connection successful/i)).toBeInTheDocument();
    });

    test('should handle encryption/decryption via main process', async () => {
      render(<APISettingsManagement />);

      await waitFor(() => {
        const apiKeyInput = screen.getByDisplayValue('sk-test-key');
        fireEvent.change(apiKeyInput, { target: { value: 'sk-sensitive-key' } });

        const saveBtn = screen.getByRole('button', { name: /save/i });
        fireEvent.click(saveBtn);
      });

      await waitFor(() => {
        expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
          'api-settings:encrypt-key',
          'sk-sensitive-key'
        );
      });
    });
  });

  describe('Error Handling in IPC Communication', () => {
    test('should handle network failure errors gracefully', async () => {
      mockIpcRenderer.invoke.mockRejectedValueOnce(
        new Error('Network connection failed')
      );

      render(<TransparencyDashboard />);

      await waitFor(() => {
        expect(screen.getByText(/failed to load data/i)).toBeInTheDocument();
      });
    });

    test('should handle authorization timeout errors', async () => {
      mockIpcRenderer.invoke.mockImplementation((channel) => {
        if (channel === 'ai:authorization-result') {
          return new Promise(() => {}); // Never resolves (timeout)
        }
        return Promise.resolve({});
      });

      render(
        <AIAuthorizationDialog
          isOpen={true}
          onClose={jest.fn()}
          onAuthorize={jest.fn()}
          costData={{ estimatedCost: 1.0, tokensToUse: 1000, operation: 'Test' }}
        />
      );

      const authorizeBtn = screen.getByRole('button', { name: /authorize/i });
      fireEvent.click(authorizeBtn);

      // Should show loading state
      expect(authorizeBtn).toBeDisabled();
      expect(screen.getByTestId('authorization-loading')).toBeInTheDocument();
    });

    test('should handle API settings validation errors', async () => {
      mockIpcRenderer.invoke.mockImplementation((channel) => {
        if (channel === 'api-settings:save') {
          return Promise.reject(new Error('Invalid API key format'));
        }
        return Promise.resolve({});
      });

      render(<APISettingsManagement />);

      await waitFor(() => {
        const saveBtn = screen.getByRole('button', { name: /save/i });
        fireEvent.click(saveBtn);
      });

      await waitFor(() => {
        expect(screen.getByText(/invalid api key format/i)).toBeInTheDocument();
      });
    });
  });

  describe('IPC Performance and Reliability', () => {
    test('should batch multiple rapid IPC calls', async () => {
      const TestComponent = () => {
        const [data, setData] = React.useState({});

        const handleMultipleUpdates = async () => {
          // Simulate rapid successive calls
          const promises = [
            window.electronAPI.invoke('transparency:get-usage-data'),
            window.electronAPI.invoke('transparency:get-cost-data'),
            window.electronAPI.invoke('transparency:get-auth-data'),
          ];

          const results = await Promise.all(promises);
          setData(results);
        };

        return (
          <button onClick={handleMultipleUpdates}>
            Update All Data
          </button>
        );
      };

      render(<TestComponent />);

      const updateBtn = screen.getByRole('button', { name: /update all data/i });
      fireEvent.click(updateBtn);

      await waitFor(() => {
        // Should have made all three calls
        expect(mockIpcRenderer._callLog.length).toBe(3);

        // Calls should be within reasonable time window
        const timestamps = mockIpcRenderer._callLog.map(call => call.timestamp);
        const timeDiff = Math.max(...timestamps) - Math.min(...timestamps);
        expect(timeDiff).toBeLessThan(100); // Within 100ms
      });
    });

    test('should handle concurrent IPC calls correctly', async () => {
      const TestComponent = () => {
        const [results, setResults] = React.useState<any[]>([]);

        const handleConcurrentCalls = async () => {
          // Start multiple calls simultaneously
          const call1 = window.electronAPI.invoke('transparency:get-usage-data');
          const call2 = window.electronAPI.invoke('transparency:get-cost-data');
          const call3 = window.electronAPI.invoke('api-settings:get-all');

          const results = await Promise.all([call1, call2, call3]);
          setResults(results);
        };

        return (
          <div>
            <button onClick={handleConcurrentCalls}>Concurrent Calls</button>
            <div data-testid="results-count">{results.length}</div>
          </div>
        );
      };

      render(<TestComponent />);

      const callBtn = screen.getByRole('button', { name: /concurrent calls/i });
      fireEvent.click(callBtn);

      await waitFor(() => {
        expect(screen.getByTestId('results-count')).toHaveTextContent('3');
      });
    });

    test('should cleanup IPC listeners on component unmount', async () => {
      const { unmount } = render(<TransparencyDashboard />);

      await waitFor(() => {
        expect(mockIpcRenderer.on).toHaveBeenCalled();
      });

      unmount();

      // Should cleanup listeners
      expect(mockIpcRenderer.removeAllListeners).toHaveBeenCalled();
    });
  });

  describe('IPC Security and Validation', () => {
    test('should validate IPC channel names', async () => {
      const TestComponent = () => {
        const handleInvalidChannel = () => {
          // Attempt to call invalid/restricted channel
          window.electronAPI.invoke('file-system:read-private', '/etc/passwd');
        };

        return (
          <button onClick={handleInvalidChannel}>
            Invalid Channel Call
          </button>
        );
      };

      render(<TestComponent />);

      const invalidBtn = screen.getByRole('button', { name: /invalid channel call/i });
      fireEvent.click(invalidBtn);

      // Should reject invalid channel calls
      await waitFor(() => {
        expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
          'file-system:read-private',
          '/etc/passwd'
        );
      });
    });

    test('should sanitize data sent through IPC', async () => {
      render(<APISettingsManagement />);

      await waitFor(() => {
        const apiKeyInput = screen.getByDisplayValue('sk-test-key');
        // Attempt to inject malicious script
        fireEvent.change(apiKeyInput, {
          target: { value: '<script>alert("xss")</script>' }
        });

        const saveBtn = screen.getByRole('button', { name: /save/i });
        fireEvent.click(saveBtn);
      });

      await waitFor(() => {
        const saveCall = mockIpcRenderer._callLog.find(
          call => call.channel === 'api-settings:save'
        );

        // Data should be sanitized before sending
        expect(saveCall.args[0].openai.apiKey).not.toContain('<script>');
      });
    });
  });
});