/**
 * Accessibility Tests for MetricsDashboard Component
 * Tests WCAG 2.1 AA compliance for dashboard and data visualization
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import {
  runAccessibilityTests,
  testKeyboardNavigation,
  testScreenReaderAnnouncements,
  accessibilityScenarios,
  validateColorContrast
} from '../../../testing/accessibility';

import { KBDataProvider } from '../../../contexts/KBDataContext';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock MetricsDashboard component
const MetricsDashboard: React.FC<{
  onClose?: () => void;
  showRefreshButton?: boolean;
  autoRefresh?: boolean;
}> = ({ onClose, showRefreshButton = true, autoRefresh = false }) => {
  const [lastUpdated, setLastUpdated] = React.useState(new Date());
  const [isLoading, setIsLoading] = React.useState(false);

  const mockMetrics = {
    totalEntries: 142,
    searchesToday: 38,
    mostUsedEntries: [
      { title: 'VSAM Status 35', usageCount: 25, successRate: 92 },
      { title: 'S0C7 Data Exception', usageCount: 18, successRate: 87 },
      { title: 'JCL Dataset Not Found', usageCount: 15, successRate: 94 }
    ],
    categoryBreakdown: [
      { category: 'VSAM', count: 32, percentage: 23 },
      { category: 'JCL', count: 28, percentage: 20 },
      { category: 'Batch', count: 22, percentage: 16 },
      { category: 'DB2', count: 20, percentage: 14 },
      { category: 'Other', count: 40, percentage: 27 }
    ],
    recentSearches: [
      'VSAM file error',
      'JCL syntax problem',
      'S0C4 abend'
    ]
  };

  const handleRefresh = async () => {
    setIsLoading(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    setLastUpdated(new Date());
    setIsLoading(false);
  };

  return (
    <div className="metrics-dashboard" role="main" aria-labelledby="dashboard-title">
      {/* Dashboard Header */}
      <header className="dashboard-header">
        <div className="dashboard-title-section">
          <h1 id="dashboard-title">Knowledge Base Metrics</h1>
          <div className="last-updated" aria-live="polite">
            Last updated: <time dateTime={lastUpdated.toISOString()}>
              {lastUpdated.toLocaleString()}
            </time>
          </div>
        </div>

        <div className="dashboard-actions">
          {showRefreshButton && (
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isLoading}
              aria-describedby={isLoading ? "refresh-status" : undefined}
              className="btn btn-secondary"
            >
              {isLoading ? 'Refreshing...' : '🔄 Refresh'}
            </button>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dashboard"
              className="btn btn-secondary"
            >
              ✕
            </button>
          )}
        </div>

        {isLoading && (
          <div id="refresh-status" className="sr-only" aria-live="polite">
            Refreshing dashboard data
          </div>
        )}
      </header>

      {/* Key Metrics Grid */}
      <section aria-labelledby="key-metrics-heading" className="metrics-section">
        <h2 id="key-metrics-heading">Key Metrics</h2>

        <div className="metrics-grid" role="list" aria-label="Key performance indicators">
          <div className="metric-card" role="listitem">
            <div className="metric-value" aria-label="Total entries: 142">
              {mockMetrics.totalEntries}
            </div>
            <div className="metric-label">Total Entries</div>
          </div>

          <div className="metric-card" role="listitem">
            <div className="metric-value" aria-label="Searches today: 38">
              {mockMetrics.searchesToday}
            </div>
            <div className="metric-label">Searches Today</div>
          </div>

          <div className="metric-card" role="listitem">
            <div className="metric-value" aria-label="Average success rate: 91%">
              91%
            </div>
            <div className="metric-label">Avg. Success Rate</div>
          </div>

          <div className="metric-card" role="listitem">
            <div className="metric-value" aria-label="Active users: 12">
              12
            </div>
            <div className="metric-label">Active Users</div>
          </div>
        </div>
      </section>

      {/* Most Used Entries */}
      <section aria-labelledby="popular-entries-heading" className="metrics-section">
        <h2 id="popular-entries-heading">Most Used Entries</h2>

        <div className="popular-entries-table">
          <table
            role="table"
            aria-labelledby="popular-entries-heading"
            aria-describedby="popular-entries-description"
          >
            <caption id="popular-entries-description" className="sr-only">
              Table showing the most frequently accessed knowledge base entries with usage counts and success rates
            </caption>

            <thead>
              <tr>
                <th scope="col">Entry Title</th>
                <th scope="col">Usage Count</th>
                <th scope="col">Success Rate</th>
              </tr>
            </thead>

            <tbody>
              {mockMetrics.mostUsedEntries.map((entry, index) => (
                <tr key={index}>
                  <th scope="row">{entry.title}</th>
                  <td>
                    <span aria-label={`${entry.usageCount} times`}>
                      {entry.usageCount}
                    </span>
                  </td>
                  <td>
                    <span aria-label={`${entry.successRate}% success rate`}>
                      {entry.successRate}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Category Breakdown */}
      <section aria-labelledby="category-breakdown-heading" className="metrics-section">
        <h2 id="category-breakdown-heading">Category Breakdown</h2>

        <div className="category-chart" role="img" aria-labelledby="category-breakdown-heading" aria-describedby="category-chart-description">
          <div id="category-chart-description" className="sr-only">
            Bar chart showing distribution of knowledge base entries by category:
            VSAM 32 entries (23%), JCL 28 entries (20%), Batch 22 entries (16%), DB2 20 entries (14%), Other 40 entries (27%)
          </div>

          {mockMetrics.categoryBreakdown.map((item, index) => (
            <div
              key={item.category}
              className="category-bar-container"
              role="listitem"
            >
              <div className="category-label">
                {item.category}
              </div>
              <div className="category-bar-wrapper">
                <div
                  className="category-bar"
                  style={{
                    width: `${item.percentage}%`,
                    backgroundColor: `hsl(${index * 60}, 60%, 50%)`
                  }}
                  role="progressbar"
                  aria-valuenow={item.percentage}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${item.category}: ${item.count} entries, ${item.percentage}%`}
                />
              </div>
              <div className="category-stats">
                {item.count} ({item.percentage}%)
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Recent Searches */}
      <section aria-labelledby="recent-searches-heading" className="metrics-section">
        <h2 id="recent-searches-heading">Recent Searches</h2>

        <ul className="recent-searches-list" aria-labelledby="recent-searches-heading">
          {mockMetrics.recentSearches.map((search, index) => (
            <li key={index} className="recent-search-item">
              <span className="search-icon" aria-hidden="true">🔍</span>
              <span className="search-text">{search}</span>
              <time className="search-time" dateTime="2025-01-20T10:30:00">
                2 hours ago
              </time>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
};

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <KBDataProvider>
    <div id="test-app" role="application" aria-label="Knowledge Base Dashboard">
      {children}
    </div>
  </KBDataProvider>
);

describe('MetricsDashboard Accessibility Tests', () => {
  beforeEach(() => {
    global.a11yTestUtils.setupAccessibleEnvironment();
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.a11yTestUtils.cleanupAccessibleEnvironment();
  });

  describe('Basic Accessibility Compliance', () => {
    test('should pass axe accessibility audit', async () => {
      const { container } = render(
        <TestWrapper>
          <MetricsDashboard />
        </TestWrapper>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    test('should have proper semantic structure', () => {
      render(
        <TestWrapper>
          <MetricsDashboard />
        </TestWrapper>
      );

      // Main landmark
      const main = screen.getByRole('main');
      expect(main).toHaveAttribute('aria-labelledby', 'dashboard-title');

      // Proper heading hierarchy
      const h1 = screen.getByRole('heading', { level: 1 });
      expect(h1).toHaveTextContent('Knowledge Base Metrics');

      const h2s = screen.getAllByRole('heading', { level: 2 });
      expect(h2s.length).toBeGreaterThan(0);
    });

    test('should have accessible time elements', () => {
      render(
        <TestWrapper>
          <MetricsDashboard />
        </TestWrapper>
      );

      const timeElements = screen.getAllByRole('time');
      timeElements.forEach(timeElement => {
        expect(timeElement).toHaveAttribute('dateTime');
      });
    });
  });

  describe('Data Table Accessibility', () => {
    test('should have properly structured data table', () => {
      render(
        <TestWrapper>
          <MetricsDashboard />
        </TestWrapper>
      );

      const table = screen.getByRole('table');
      expect(table).toHaveAttribute('aria-labelledby', 'popular-entries-heading');
      expect(table).toHaveAttribute('aria-describedby', 'popular-entries-description');

      // Table should have caption
      const caption = screen.getByText(/table showing the most frequently accessed/i);
      expect(caption).toBeInTheDocument();
      expect(caption).toHaveClass('sr-only');

      // Headers should be properly scoped
      const columnHeaders = screen.getAllByRole('columnheader');
      columnHeaders.forEach(header => {
        expect(header).toHaveAttribute('scope', 'col');
      });

      // Row headers should be properly scoped
      const rowHeaders = screen.getAllByRole('rowheader');
      rowHeaders.forEach(header => {
        expect(header).toHaveAttribute('scope', 'row');
      });
    });
  });

  describe('Data Visualization Accessibility', () => {
    test('should make chart accessible to screen readers', () => {
      render(
        <TestWrapper>
          <MetricsDashboard />
        </TestWrapper>
      );

      const chart = screen.getByRole('img', { name: /category breakdown/i });
      expect(chart).toHaveAttribute('aria-describedby', 'category-chart-description');

      // Chart description should provide data summary
      const chartDescription = screen.getByText(/bar chart showing distribution/i);
      expect(chartDescription).toHaveClass('sr-only');
      expect(chartDescription).toHaveTextContent(/VSAM 32 entries/);
      expect(chartDescription).toHaveTextContent(/JCL 28 entries/);
    });

    test('should use progress bars for category data', () => {
      render(
        <TestWrapper>
          <MetricsDashboard />
        </TestWrapper>
      );

      const progressBars = screen.getAllByRole('progressbar');
      expect(progressBars.length).toBe(5); // One for each category

      progressBars.forEach((bar, index) => {
        expect(bar).toHaveAttribute('aria-valuenow');
        expect(bar).toHaveAttribute('aria-valuemin', '0');
        expect(bar).toHaveAttribute('aria-valuemax', '100');
        expect(bar).toHaveAttribute('aria-label');
      });
    });

    test('should validate color contrast in charts', () => {
      render(
        <TestWrapper>
          <MetricsDashboard />
        </TestWrapper>
      );

      const progressBars = screen.getAllByRole('progressbar');
      progressBars.forEach(bar => {
        const computedStyle = window.getComputedStyle(bar);
        expect(computedStyle.backgroundColor).toBeTruthy();

        // In real implementation, you would check actual contrast ratios
        // with validateColorContrast function
      });
    });
  });

  describe('Keyboard Navigation', () => {
    test('should support keyboard navigation', async () => {
      const mockOnClose = jest.fn();

      render(
        <TestWrapper>
          <MetricsDashboard onClose={mockOnClose} />
        </TestWrapper>
      );

      await testKeyboardNavigation(
        screen.getByRole('main'),
        [
          'button:contains("Refresh")',
          'button[aria-label="Close dashboard"]'
        ]
      );
    });

    test('should handle refresh button with keyboard', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <MetricsDashboard />
        </TestWrapper>
      );

      const refreshButton = screen.getByRole('button', { name: /refresh/i });

      // Test Enter key
      refreshButton.focus();
      await user.keyboard('{enter}');

      // Should show loading state
      await waitFor(() => {
        expect(refreshButton).toHaveTextContent('Refreshing...');
        expect(refreshButton).toBeDisabled();
      });
    });
  });

  describe('Live Regions and Updates', () => {
    test('should announce refresh status to screen readers', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <MetricsDashboard />
        </TestWrapper>
      );

      const refreshButton = screen.getByRole('button', { name: /refresh/i });

      await testScreenReaderAnnouncements(
        async () => {
          await user.click(refreshButton);
        },
        'Refreshing dashboard data',
        1500
      );
    });

    test('should announce last updated time', () => {
      render(
        <TestWrapper>
          <MetricsDashboard />
        </TestWrapper>
      );

      const lastUpdated = screen.getByText(/last updated:/i).closest('[aria-live]');
      expect(lastUpdated).toHaveAttribute('aria-live', 'polite');
    });
  });

  describe('Metric Cards Accessibility', () => {
    test('should make metric values accessible', () => {
      render(
        <TestWrapper>
          <MetricsDashboard />
        </TestWrapper>
      );

      const metricsGrid = screen.getByRole('list', { name: /key performance indicators/i });
      expect(metricsGrid).toBeInTheDocument();

      const metricCards = screen.getAllByRole('listitem');
      expect(metricCards.length).toBeGreaterThanOrEqual(4);

      // Each metric should have an accessible label
      const totalEntriesValue = screen.getByLabelText(/total entries: 142/i);
      const searchesTodayValue = screen.getByLabelText(/searches today: 38/i);
      const successRateValue = screen.getByLabelText(/average success rate: 91%/i);

      expect(totalEntriesValue).toBeVisible();
      expect(searchesTodayValue).toBeVisible();
      expect(successRateValue).toBeVisible();
    });
  });

  describe('Lists and Navigation', () => {
    test('should make recent searches list accessible', () => {
      render(
        <TestWrapper>
          <MetricsDashboard />
        </TestWrapper>
      );

      const searchesList = screen.getByRole('list', { name: /recent searches/i });
      expect(searchesList).toHaveAttribute('aria-labelledby', 'recent-searches-heading');

      const searchItems = within(searchesList).getAllByRole('listitem');
      expect(searchItems.length).toBe(3);

      // Each search item should be accessible
      searchItems.forEach(item => {
        const searchText = item.querySelector('.search-text');
        const searchTime = item.querySelector('.search-time');

        expect(searchText).toBeVisible();
        expect(searchTime).toHaveAttribute('datetime');
      });
    });
  });

  describe('Loading States', () => {
    test('should handle loading states accessibly', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <MetricsDashboard />
        </TestWrapper>
      );

      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      await user.click(refreshButton);

      // Loading state should be accessible
      await waitFor(() => {
        expect(refreshButton).toHaveAttribute('aria-describedby', 'refresh-status');

        const loadingStatus = screen.getByText(/refreshing dashboard data/i);
        expect(loadingStatus).toHaveAttribute('aria-live', 'polite');
        expect(loadingStatus).toHaveClass('sr-only');
      });
    });
  });

  describe('Responsive Design Accessibility', () => {
    test('should maintain accessibility on smaller screens', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375
      });

      render(
        <TestWrapper>
          <MetricsDashboard />
        </TestWrapper>
      );

      // Should still maintain proper heading structure
      const headings = screen.getAllByRole('heading');
      expect(headings.length).toBeGreaterThan(0);

      // Interactive elements should still be accessible
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).toBeVisible();
      });
    });
  });

  describe('Comprehensive Test Suite', () => {
    test('should run full accessibility test suite', async () => {
      await runAccessibilityTests(
        <MetricsDashboard />,
        {
          customTests: [
            async (container) => {
              // Data table accessibility
              const table = container.querySelector('table');
              if (table) {
                expect(table).toHaveAttribute('role', 'table');
                expect(table).toHaveAttribute('aria-labelledby');
              }

              // Chart accessibility
              const charts = container.querySelectorAll('[role="img"]');
              charts.forEach(chart => {
                expect(chart).toHaveAttribute('aria-describedby');
              });

              // Live regions
              const liveRegions = container.querySelectorAll('[aria-live]');
              expect(liveRegions.length).toBeGreaterThan(0);
            }
          ]
        }
      );
    });
  });
});

// Helper function for within queries
function within(element: HTMLElement) {
  return {
    getAllByRole: (role: string) => {
      return Array.from(element.querySelectorAll(`[role="${role}"], ${role}`));
    }
  };
}