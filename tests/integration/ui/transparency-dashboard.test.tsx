/**
 * Transparency Dashboard Integration Tests
 * Tests all 5 tabs: Usage, Costs, Auth, Trends, Logs
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TransparencyDashboard } from '../../../src/renderer/components/dashboard/TransparencyDashboard';

// Mock data for dashboard tabs
const mockDashboardData = {
  usage: {
    totalQueries: 1247,
    totalTokens: 2847392,
    avgResponseTime: 1.2,
    successRate: 98.5,
    lastUpdated: new Date().toISOString(),
  },
  costs: {
    currentMonth: 45.67,
    lastMonth: 38.92,
    yearToDate: 523.45,
    breakdown: [
      { service: 'OpenAI GPT-4', cost: 25.40, percentage: 55.6 },
      { service: 'Claude-3', cost: 15.20, percentage: 33.3 },
      { service: 'Embedding API', cost: 5.07, percentage: 11.1 },
    ],
  },
  authorization: {
    pendingRequests: 3,
    approvedToday: 15,
    rejectedToday: 2,
    avgApprovalTime: 45, // seconds
    recentAuthorizations: [
      {
        id: '1',
        operation: 'Document Analysis',
        cost: 2.45,
        status: 'approved',
        timestamp: new Date(Date.now() - 1800000).toISOString(), // 30 min ago
      },
      {
        id: '2',
        operation: 'Batch Processing',
        cost: 15.80,
        status: 'pending',
        timestamp: new Date(Date.now() - 600000).toISOString(), // 10 min ago
      },
    ],
  },
  trends: {
    dailyUsage: [
      { date: '2024-01-01', queries: 45, cost: 12.34 },
      { date: '2024-01-02', queries: 52, cost: 15.67 },
      { date: '2024-01-03', queries: 38, cost: 9.87 },
    ],
    topOperations: [
      { operation: 'Search', count: 456, avgCost: 0.15 },
      { operation: 'Analysis', count: 234, avgCost: 2.45 },
      { operation: 'Generation', count: 123, avgCost: 5.67 },
    ],
  },
  logs: {
    entries: [
      {
        id: '1',
        timestamp: new Date().toISOString(),
        level: 'info',
        operation: 'Search Query',
        message: 'Successful search for mainframe documentation',
        cost: 0.15,
        tokens: 750,
      },
      {
        id: '2',
        timestamp: new Date(Date.now() - 300000).toISOString(),
        level: 'warning',
        operation: 'High Cost Operation',
        message: 'Operation exceeded cost threshold',
        cost: 25.67,
        tokens: 15000,
      },
      {
        id: '3',
        timestamp: new Date(Date.now() - 600000).toISOString(),
        level: 'error',
        operation: 'API Failure',
        message: 'Failed to connect to OpenAI API',
        cost: 0,
        tokens: 0,
      },
    ],
  },
};

// Mock IPC for data fetching
const mockIpcRenderer = {
  invoke: jest.fn(),
  on: jest.fn(),
  removeAllListeners: jest.fn(),
};

Object.defineProperty(window, 'electronAPI', {
  value: mockIpcRenderer,
  writable: true,
});

describe('TransparencyDashboard Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIpcRenderer.invoke.mockImplementation((channel) => {
      switch (channel) {
        case 'transparency:get-usage-data':
          return Promise.resolve(mockDashboardData.usage);
        case 'transparency:get-cost-data':
          return Promise.resolve(mockDashboardData.costs);
        case 'transparency:get-auth-data':
          return Promise.resolve(mockDashboardData.authorization);
        case 'transparency:get-trends-data':
          return Promise.resolve(mockDashboardData.trends);
        case 'transparency:get-logs-data':
          return Promise.resolve(mockDashboardData.logs);
        default:
          return Promise.resolve({});
      }
    });
  });

  describe('Tab Navigation', () => {
    test('should render all 5 tabs correctly', async () => {
      render(<TransparencyDashboard />);

      // Wait for initial data load
      await waitFor(() => {
        expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('transparency:get-usage-data');
      });

      // Check all tab buttons exist
      expect(screen.getByRole('tab', { name: /usage/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /costs/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /authorization/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /trends/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /logs/i })).toBeInTheDocument();

      // First tab should be active
      expect(screen.getByRole('tab', { name: /usage/i })).toHaveAttribute('aria-selected', 'true');
    });

    test('should switch between tabs correctly', async () => {
      render(<TransparencyDashboard />);

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /usage/i })).toHaveAttribute('aria-selected', 'true');
      });

      // Click on Costs tab
      fireEvent.click(screen.getByRole('tab', { name: /costs/i }));

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /costs/i })).toHaveAttribute('aria-selected', 'true');
        expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('transparency:get-cost-data');
      });

      // Click on Authorization tab
      fireEvent.click(screen.getByRole('tab', { name: /authorization/i }));

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /authorization/i })).toHaveAttribute('aria-selected', 'true');
        expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('transparency:get-auth-data');
      });
    });
  });

  describe('Usage Tab', () => {
    test('should display usage statistics correctly', async () => {
      render(<TransparencyDashboard />);

      await waitFor(() => {
        expect(screen.getByText('1,247')).toBeInTheDocument(); // Total queries
        expect(screen.getByText('2,847,392')).toBeInTheDocument(); // Total tokens
        expect(screen.getByText('1.2s')).toBeInTheDocument(); // Avg response time
        expect(screen.getByText('98.5%')).toBeInTheDocument(); // Success rate
      });
    });

    test('should format large numbers correctly', async () => {
      render(<TransparencyDashboard />);

      await waitFor(() => {
        // Should use proper number formatting
        const tokenElement = screen.getByTestId('total-tokens');
        expect(tokenElement).toHaveTextContent('2,847,392');
      });
    });
  });

  describe('Costs Tab', () => {
    test('should display cost breakdown correctly', async () => {
      render(<TransparencyDashboard />);

      // Switch to costs tab
      fireEvent.click(screen.getByRole('tab', { name: /costs/i }));

      await waitFor(() => {
        expect(screen.getByText('$45.67')).toBeInTheDocument(); // Current month
        expect(screen.getByText('$38.92')).toBeInTheDocument(); // Last month
        expect(screen.getByText('$523.45')).toBeInTheDocument(); // Year to date
      });

      // Check service breakdown
      expect(screen.getByText('OpenAI GPT-4')).toBeInTheDocument();
      expect(screen.getByText('$25.40')).toBeInTheDocument();
      expect(screen.getByText('55.6%')).toBeInTheDocument();
    });

    test('should display cost trends chart', async () => {
      render(<TransparencyDashboard />);

      fireEvent.click(screen.getByRole('tab', { name: /costs/i }));

      await waitFor(() => {
        // Should render chart component
        expect(screen.getByTestId('cost-trends-chart')).toBeInTheDocument();
      });
    });
  });

  describe('Authorization Tab', () => {
    test('should display authorization metrics', async () => {
      render(<TransparencyDashboard />);

      fireEvent.click(screen.getByRole('tab', { name: /authorization/i }));

      await waitFor(() => {
        expect(screen.getByText('3')).toBeInTheDocument(); // Pending requests
        expect(screen.getByText('15')).toBeInTheDocument(); // Approved today
        expect(screen.getByText('2')).toBeInTheDocument(); // Rejected today
        expect(screen.getByText('45s')).toBeInTheDocument(); // Avg approval time
      });
    });

    test('should display recent authorizations list', async () => {
      render(<TransparencyDashboard />);

      fireEvent.click(screen.getByRole('tab', { name: /authorization/i }));

      await waitFor(() => {
        expect(screen.getByText('Document Analysis')).toBeInTheDocument();
        expect(screen.getByText('Batch Processing')).toBeInTheDocument();
        expect(screen.getByText('approved')).toBeInTheDocument();
        expect(screen.getByText('pending')).toBeInTheDocument();
      });
    });
  });

  describe('Trends Tab', () => {
    test('should display usage trends chart', async () => {
      render(<TransparencyDashboard />);

      fireEvent.click(screen.getByRole('tab', { name: /trends/i }));

      await waitFor(() => {
        expect(screen.getByTestId('usage-trends-chart')).toBeInTheDocument();
        expect(screen.getByTestId('top-operations-chart')).toBeInTheDocument();
      });
    });

    test('should show top operations', async () => {
      render(<TransparencyDashboard />);

      fireEvent.click(screen.getByRole('tab', { name: /trends/i }));

      await waitFor(() => {
        expect(screen.getByText('Search')).toBeInTheDocument();
        expect(screen.getByText('456')).toBeInTheDocument(); // Count
        expect(screen.getByText('$0.15')).toBeInTheDocument(); // Avg cost
      });
    });
  });

  describe('Logs Tab', () => {
    test('should display log entries with filtering', async () => {
      render(<TransparencyDashboard />);

      fireEvent.click(screen.getByRole('tab', { name: /logs/i }));

      await waitFor(() => {
        expect(screen.getByText('Successful search for mainframe documentation')).toBeInTheDocument();
        expect(screen.getByText('Operation exceeded cost threshold')).toBeInTheDocument();
        expect(screen.getByText('Failed to connect to OpenAI API')).toBeInTheDocument();
      });
    });

    test('should filter logs by level', async () => {
      render(<TransparencyDashboard />);

      fireEvent.click(screen.getByRole('tab', { name: /logs/i }));

      await waitFor(() => {
        const logFilter = screen.getByTestId('log-level-filter');
        fireEvent.change(logFilter, { target: { value: 'error' } });
      });

      await waitFor(() => {
        expect(screen.getByText('Failed to connect to OpenAI API')).toBeInTheDocument();
        expect(screen.queryByText('Successful search for mainframe documentation')).not.toBeInTheDocument();
      });
    });

    test('should export logs functionality', async () => {
      render(<TransparencyDashboard />);

      fireEvent.click(screen.getByRole('tab', { name: /logs/i }));

      await waitFor(() => {
        const exportBtn = screen.getByRole('button', { name: /export logs/i });
        fireEvent.click(exportBtn);
      });

      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('transparency:export-logs', expect.any(Object));
    });
  });

  describe('Real-time Updates', () => {
    test('should update data automatically', async () => {
      render(<TransparencyDashboard />);

      await waitFor(() => {
        expect(screen.getByText('1,247')).toBeInTheDocument();
      });

      // Simulate real-time update
      const updatedData = { ...mockDashboardData.usage, totalQueries: 1250 };
      mockIpcRenderer.invoke.mockResolvedValueOnce(updatedData);

      // Trigger update (simulating real-time data)
      fireEvent.click(screen.getByTestId('refresh-button'));

      await waitFor(() => {
        expect(screen.getByText('1,250')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility Compliance', () => {
    test('should have proper ARIA attributes for tabs', async () => {
      render(<TransparencyDashboard />);

      const tabList = screen.getByRole('tablist');
      expect(tabList).toBeInTheDocument();

      const tabs = screen.getAllByRole('tab');
      tabs.forEach((tab, index) => {
        expect(tab).toHaveAttribute('aria-controls');
        expect(tab).toHaveAttribute('aria-selected');
      });
    });

    test('should support keyboard navigation', async () => {
      render(<TransparencyDashboard />);

      const firstTab = screen.getByRole('tab', { name: /usage/i });
      firstTab.focus();

      // Arrow key navigation
      fireEvent.keyDown(firstTab, { key: 'ArrowRight' });
      expect(screen.getByRole('tab', { name: /costs/i })).toHaveFocus();

      fireEvent.keyDown(screen.getByRole('tab', { name: /costs/i }), { key: 'ArrowLeft' });
      expect(screen.getByRole('tab', { name: /usage/i })).toHaveFocus();
    });
  });

  describe('Accenture Branding', () => {
    test('should apply Accenture theme colors', async () => {
      render(<TransparencyDashboard />);

      const activeTab = screen.getByRole('tab', { name: /usage/i });
      const computedStyle = window.getComputedStyle(activeTab);

      // Check for Accenture purple theme
      expect(computedStyle.borderBottomColor).toBe('rgb(161, 0, 255)');
    });
  });
});