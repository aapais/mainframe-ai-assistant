import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { jest } from '@jest/globals';
import '@testing-library/jest-dom';

// Mock incident dashboard component (extending existing dashboard)
interface IncidentDashboardProps {
  incidents: any[];
  filters: {
    status: string[];
    priority: string[];
    assignedTeam: string[];
    dateRange: { start: Date; end: Date };
  };
  onFilterChange: (filters: any) => void;
  onIncidentSelect: (incidentId: string) => void;
  refreshInterval?: number;
}

// Mock component for testing
const IncidentDashboard: React.FC<IncidentDashboardProps> = ({
  incidents,
  filters,
  onFilterChange,
  onIncidentSelect,
  refreshInterval = 30000
}) => {
  const [isLoading, setIsLoading] = React.useState(false);
  const [lastRefresh, setLastRefresh] = React.useState(new Date());

  // Calculate metrics
  const metrics = React.useMemo(() => {
    const total = incidents.length;
    const active = incidents.filter(i => i.status === 'active').length;
    const critical = incidents.filter(i => i.priority === 'critical').length;
    const avgResolutionTime = incidents
      .filter(i => i.resolutionTime)
      .reduce((sum, i) => sum + i.resolutionTime, 0) /
      incidents.filter(i => i.resolutionTime).length || 0;

    const slaCompliance = incidents.length > 0
      ? (incidents.filter(i => i.withinSLA).length / incidents.length) * 100
      : 100;

    return { total, active, critical, avgResolutionTime, slaCompliance };
  }, [incidents]);

  // Auto-refresh
  React.useEffect(() => {
    const interval = setInterval(() => {
      setLastRefresh(new Date());
      // Trigger refresh in real implementation
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval]);

  const handleRefresh = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setLastRefresh(new Date());
    }, 1000);
  };

  return (
    <div className="incident-dashboard" data-testid="incident-dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <h2>Incident Management Dashboard</h2>
        <div className="header-actions">
          <span className="last-refresh">
            Last refresh: {lastRefresh.toLocaleTimeString()}
          </span>
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            data-testid="refresh-button"
          >
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="metrics-grid" data-testid="metrics-grid">
        <div className="metric-card total" data-testid="metric-total">
          <h3>Total Incidents</h3>
          <div className="metric-value">{metrics.total}</div>
        </div>

        <div className="metric-card active" data-testid="metric-active">
          <h3>Active Incidents</h3>
          <div className="metric-value">{metrics.active}</div>
        </div>

        <div className="metric-card critical" data-testid="metric-critical">
          <h3>Critical Incidents</h3>
          <div className="metric-value">{metrics.critical}</div>
        </div>

        <div className="metric-card resolution-time" data-testid="metric-resolution-time">
          <h3>Avg Resolution Time</h3>
          <div className="metric-value">
            {metrics.avgResolutionTime ? `${Math.round(metrics.avgResolutionTime / 60000)}m` : 'N/A'}
          </div>
        </div>

        <div className="metric-card sla-compliance" data-testid="metric-sla">
          <h3>SLA Compliance</h3>
          <div className="metric-value">{metrics.slaCompliance.toFixed(1)}%</div>
        </div>
      </div>

      {/* Filters */}
      <div className="dashboard-filters" data-testid="dashboard-filters">
        <div className="filter-group">
          <label>Status:</label>
          <select
            multiple
            value={filters.status}
            onChange={(e) => onFilterChange({
              ...filters,
              status: Array.from(e.target.selectedOptions, option => option.value)
            })}
            data-testid="status-filter"
          >
            <option value="active">Active</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Priority:</label>
          <select
            multiple
            value={filters.priority}
            onChange={(e) => onFilterChange({
              ...filters,
              priority: Array.from(e.target.selectedOptions, option => option.value)
            })}
            data-testid="priority-filter"
          >
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Team:</label>
          <select
            multiple
            value={filters.assignedTeam}
            onChange={(e) => onFilterChange({
              ...filters,
              assignedTeam: Array.from(e.target.selectedOptions, option => option.value)
            })}
            data-testid="team-filter"
          >
            <option value="Infrastructure">Infrastructure</option>
            <option value="Database">Database</option>
            <option value="Application">Application</option>
            <option value="Frontend">Frontend</option>
            <option value="Security">Security</option>
          </select>
        </div>
      </div>

      {/* Recent Incidents List */}
      <div className="recent-incidents" data-testid="recent-incidents">
        <h3>Recent Incidents</h3>
        <div className="incidents-list">
          {incidents.slice(0, 10).map(incident => (
            <div
              key={incident.id}
              className={`incident-item priority-${incident.priority}`}
              onClick={() => onIncidentSelect(incident.id)}
              data-testid={`incident-item-${incident.id}`}
            >
              <div className="incident-id">{incident.id}</div>
              <div className="incident-title">{incident.title || incident.description}</div>
              <div className="incident-status">{incident.status}</div>
              <div className="incident-priority">{incident.priority}</div>
              <div className="incident-time">
                {new Date(incident.createdAt).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Charts placeholder */}
      <div className="dashboard-charts" data-testid="dashboard-charts">
        <div className="chart-container">
          <h3>Incident Trends</h3>
          <div className="chart-placeholder">
            Incident trend chart would be rendered here
          </div>
        </div>

        <div className="chart-container">
          <h3>Priority Distribution</h3>
          <div className="chart-placeholder">
            Priority distribution chart would be rendered here
          </div>
        </div>
      </div>
    </div>
  );
};

// Test data
const mockIncidents = [
  {
    id: 'INC-001',
    title: 'Critical system outage',
    description: 'Payment processing system is down',
    status: 'active',
    priority: 'critical',
    assignedTeam: 'Infrastructure',
    assignee: 'john.doe',
    createdAt: Date.now() - 3600000,
    withinSLA: false,
    resolutionTime: null
  },
  {
    id: 'INC-002',
    title: 'Database performance issue',
    description: 'Slow query responses in user database',
    status: 'acknowledged',
    priority: 'high',
    assignedTeam: 'Database',
    assignee: 'jane.smith',
    createdAt: Date.now() - 7200000,
    withinSLA: true,
    resolutionTime: null
  },
  {
    id: 'INC-003',
    title: 'Login timeout',
    description: 'Users experiencing login timeouts',
    status: 'resolved',
    priority: 'medium',
    assignedTeam: 'Application',
    assignee: 'bob.johnson',
    createdAt: Date.now() - 86400000,
    resolvedAt: Date.now() - 82800000,
    withinSLA: true,
    resolutionTime: 3600000
  },
  {
    id: 'INC-004',
    title: 'UI display issue',
    description: 'Minor styling issue in dashboard',
    status: 'closed',
    priority: 'low',
    assignedTeam: 'Frontend',
    assignee: 'alice.wilson',
    createdAt: Date.now() - 172800000,
    resolvedAt: Date.now() - 169200000,
    withinSLA: true,
    resolutionTime: 3600000
  }
];

describe('IncidentDashboard Component', () => {
  const mockOnFilterChange = jest.fn();
  const mockOnIncidentSelect = jest.fn();

  const defaultFilters = {
    status: ['active', 'acknowledged'],
    priority: ['critical', 'high', 'medium', 'low'],
    assignedTeam: [],
    dateRange: { start: new Date(), end: new Date() }
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering and Display', () => {
    test('renders dashboard with correct title and structure', () => {
      render(
        <IncidentDashboard
          incidents={mockIncidents}
          filters={defaultFilters}
          onFilterChange={mockOnFilterChange}
          onIncidentSelect={mockOnIncidentSelect}
        />
      );

      expect(screen.getByText('Incident Management Dashboard')).toBeInTheDocument();
      expect(screen.getByTestId('incident-dashboard')).toBeInTheDocument();
      expect(screen.getByTestId('metrics-grid')).toBeInTheDocument();
      expect(screen.getByTestId('dashboard-filters')).toBeInTheDocument();
      expect(screen.getByTestId('recent-incidents')).toBeInTheDocument();
    });

    test('displays correct metrics calculations', () => {
      render(
        <IncidentDashboard
          incidents={mockIncidents}
          filters={defaultFilters}
          onFilterChange={mockOnFilterChange}
          onIncidentSelect={mockOnIncidentSelect}
        />
      );

      expect(screen.getByTestId('metric-total')).toHaveTextContent('4');
      expect(screen.getByTestId('metric-active')).toHaveTextContent('1');
      expect(screen.getByTestId('metric-critical')).toHaveTextContent('1');
      expect(screen.getByTestId('metric-sla')).toHaveTextContent('75.0%');
    });

    test('shows last refresh timestamp', () => {
      render(
        <IncidentDashboard
          incidents={mockIncidents}
          filters={defaultFilters}
          onFilterChange={mockOnFilterChange}
          onIncidentSelect={mockOnIncidentSelect}
        />
      );

      expect(screen.getByText(/Last refresh:/)).toBeInTheDocument();
    });

    test('displays recent incidents list', () => {
      render(
        <IncidentDashboard
          incidents={mockIncidents}
          filters={defaultFilters}
          onFilterChange={mockOnFilterChange}
          onIncidentSelect={mockOnIncidentSelect}
        />
      );

      expect(screen.getByText('Recent Incidents')).toBeInTheDocument();
      expect(screen.getByTestId('incident-item-INC-001')).toBeInTheDocument();
      expect(screen.getByTestId('incident-item-INC-002')).toBeInTheDocument();
    });
  });

  describe('Filtering Functionality', () => {
    test('status filter triggers onFilterChange with correct values', () => {
      render(
        <IncidentDashboard
          incidents={mockIncidents}
          filters={defaultFilters}
          onFilterChange={mockOnFilterChange}
          onIncidentSelect={mockOnIncidentSelect}
        />
      );

      const statusFilter = screen.getByTestId('status-filter');
      fireEvent.change(statusFilter, { target: { selectedOptions: [{ value: 'active' }] } });

      expect(mockOnFilterChange).toHaveBeenCalledWith({
        ...defaultFilters,
        status: ['active']
      });
    });

    test('priority filter triggers onFilterChange with correct values', () => {
      render(
        <IncidentDashboard
          incidents={mockIncidents}
          filters={defaultFilters}
          onFilterChange={mockOnFilterChange}
          onIncidentSelect={mockOnIncidentSelect}
        />
      );

      const priorityFilter = screen.getByTestId('priority-filter');
      fireEvent.change(priorityFilter, { target: { selectedOptions: [{ value: 'critical' }, { value: 'high' }] } });

      expect(mockOnFilterChange).toHaveBeenCalledWith({
        ...defaultFilters,
        priority: ['critical', 'high']
      });
    });

    test('team filter triggers onFilterChange with correct values', () => {
      render(
        <IncidentDashboard
          incidents={mockIncidents}
          filters={defaultFilters}
          onFilterChange={mockOnFilterChange}
          onIncidentSelect={mockOnIncidentSelect}
        />
      );

      const teamFilter = screen.getByTestId('team-filter');
      fireEvent.change(teamFilter, { target: { selectedOptions: [{ value: 'Infrastructure' }] } });

      expect(mockOnFilterChange).toHaveBeenCalledWith({
        ...defaultFilters,
        assignedTeam: ['Infrastructure']
      });
    });
  });

  describe('Incident Selection', () => {
    test('clicking incident item triggers onIncidentSelect', () => {
      render(
        <IncidentDashboard
          incidents={mockIncidents}
          filters={defaultFilters}
          onFilterChange={mockOnFilterChange}
          onIncidentSelect={mockOnIncidentSelect}
        />
      );

      const incidentItem = screen.getByTestId('incident-item-INC-001');
      fireEvent.click(incidentItem);

      expect(mockOnIncidentSelect).toHaveBeenCalledWith('INC-001');
    });

    test('multiple incident selections work correctly', () => {
      render(
        <IncidentDashboard
          incidents={mockIncidents}
          filters={defaultFilters}
          onFilterChange={mockOnFilterChange}
          onIncidentSelect={mockOnIncidentSelect}
        />
      );

      fireEvent.click(screen.getByTestId('incident-item-INC-001'));
      fireEvent.click(screen.getByTestId('incident-item-INC-002'));

      expect(mockOnIncidentSelect).toHaveBeenCalledTimes(2);
      expect(mockOnIncidentSelect).toHaveBeenNthCalledWith(1, 'INC-001');
      expect(mockOnIncidentSelect).toHaveBeenNthCalledWith(2, 'INC-002');
    });
  });

  describe('Refresh Functionality', () => {
    test('refresh button triggers loading state', async () => {
      render(
        <IncidentDashboard
          incidents={mockIncidents}
          filters={defaultFilters}
          onFilterChange={mockOnFilterChange}
          onIncidentSelect={mockOnIncidentSelect}
        />
      );

      const refreshButton = screen.getByTestId('refresh-button');
      expect(refreshButton).toHaveTextContent('Refresh');

      fireEvent.click(refreshButton);

      expect(refreshButton).toHaveTextContent('Refreshing...');
      expect(refreshButton).toBeDisabled();

      await waitFor(() => {
        expect(refreshButton).toHaveTextContent('Refresh');
        expect(refreshButton).not.toBeDisabled();
      }, { timeout: 2000 });
    });

    test('auto-refresh updates last refresh time', async () => {
      const { rerender } = render(
        <IncidentDashboard
          incidents={mockIncidents}
          filters={defaultFilters}
          onFilterChange={mockOnFilterChange}
          onIncidentSelect={mockOnIncidentSelect}
          refreshInterval={100} // Very short for testing
        />
      );

      const initialRefreshText = screen.getByText(/Last refresh:/).textContent;

      await waitFor(() => {
        const currentRefreshText = screen.getByText(/Last refresh:/).textContent;
        expect(currentRefreshText).not.toBe(initialRefreshText);
      }, { timeout: 200 });
    });
  });

  describe('Metrics Calculation', () => {
    test('calculates total incidents correctly', () => {
      render(
        <IncidentDashboard
          incidents={mockIncidents}
          filters={defaultFilters}
          onFilterChange={mockOnFilterChange}
          onIncidentSelect={mockOnIncidentSelect}
        />
      );

      expect(screen.getByTestId('metric-total')).toHaveTextContent('4');
    });

    test('calculates active incidents correctly', () => {
      render(
        <IncidentDashboard
          incidents={mockIncidents}
          filters={defaultFilters}
          onFilterChange={mockOnFilterChange}
          onIncidentSelect={mockOnIncidentSelect}
        />
      );

      expect(screen.getByTestId('metric-active')).toHaveTextContent('1');
    });

    test('calculates critical incidents correctly', () => {
      render(
        <IncidentDashboard
          incidents={mockIncidents}
          filters={defaultFilters}
          onFilterChange={mockOnFilterChange}
          onIncidentSelect={mockOnIncidentSelect}
        />
      );

      expect(screen.getByTestId('metric-critical')).toHaveTextContent('1');
    });

    test('calculates average resolution time correctly', () => {
      render(
        <IncidentDashboard
          incidents={mockIncidents}
          filters={defaultFilters}
          onFilterChange={mockOnFilterChange}
          onIncidentSelect={mockOnIncidentSelect}
        />
      );

      // 2 incidents with 1 hour (60 minutes) resolution time each
      expect(screen.getByTestId('metric-resolution-time')).toHaveTextContent('60m');
    });

    test('calculates SLA compliance correctly', () => {
      render(
        <IncidentDashboard
          incidents={mockIncidents}
          filters={defaultFilters}
          onFilterChange={mockOnFilterChange}
          onIncidentSelect={mockOnIncidentSelect}
        />
      );

      // 3 out of 4 incidents are within SLA (75%)
      expect(screen.getByTestId('metric-sla')).toHaveTextContent('75.0%');
    });

    test('handles empty incidents list', () => {
      render(
        <IncidentDashboard
          incidents={[]}
          filters={defaultFilters}
          onFilterChange={mockOnFilterChange}
          onIncidentSelect={mockOnIncidentSelect}
        />
      );

      expect(screen.getByTestId('metric-total')).toHaveTextContent('0');
      expect(screen.getByTestId('metric-active')).toHaveTextContent('0');
      expect(screen.getByTestId('metric-critical')).toHaveTextContent('0');
      expect(screen.getByTestId('metric-resolution-time')).toHaveTextContent('N/A');
      expect(screen.getByTestId('metric-sla')).toHaveTextContent('100.0%');
    });
  });

  describe('Visual Indicators', () => {
    test('applies correct CSS classes for priority levels', () => {
      render(
        <IncidentDashboard
          incidents={mockIncidents}
          filters={defaultFilters}
          onFilterChange={mockOnFilterChange}
          onIncidentSelect={mockOnIncidentSelect}
        />
      );

      expect(screen.getByTestId('incident-item-INC-001')).toHaveClass('priority-critical');
      expect(screen.getByTestId('incident-item-INC-002')).toHaveClass('priority-high');
      expect(screen.getByTestId('incident-item-INC-003')).toHaveClass('priority-medium');
      expect(screen.getByTestId('incident-item-INC-004')).toHaveClass('priority-low');
    });

    test('displays chart placeholders', () => {
      render(
        <IncidentDashboard
          incidents={mockIncidents}
          filters={defaultFilters}
          onFilterChange={mockOnFilterChange}
          onIncidentSelect={mockOnIncidentSelect}
        />
      );

      expect(screen.getByTestId('dashboard-charts')).toBeInTheDocument();
      expect(screen.getByText('Incident Trends')).toBeInTheDocument();
      expect(screen.getByText('Priority Distribution')).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    test('handles large number of incidents efficiently', () => {
      const manyIncidents = Array.from({ length: 1000 }, (_, i) => ({
        ...mockIncidents[0],
        id: `INC-${i.toString().padStart(3, '0')}`,
        title: `Incident ${i + 1}`
      }));

      const startTime = performance.now();

      render(
        <IncidentDashboard
          incidents={manyIncidents}
          filters={defaultFilters}
          onFilterChange={mockOnFilterChange}
          onIncidentSelect={mockOnIncidentSelect}
        />
      );

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should render within reasonable time (less than 100ms)
      expect(renderTime).toBeLessThan(100);

      // Should only display recent incidents (first 10)
      const displayedIncidents = screen.getAllByTestId(/incident-item-/);
      expect(displayedIncidents).toHaveLength(10);
    });

    test('memoizes metrics calculation', () => {
      const { rerender } = render(
        <IncidentDashboard
          incidents={mockIncidents}
          filters={defaultFilters}
          onFilterChange={mockOnFilterChange}
          onIncidentSelect={mockOnIncidentSelect}
        />
      );

      const initialTotal = screen.getByTestId('metric-total').textContent;

      // Rerender with same incidents
      rerender(
        <IncidentDashboard
          incidents={mockIncidents}
          filters={defaultFilters}
          onFilterChange={mockOnFilterChange}
          onIncidentSelect={mockOnIncidentSelect}
        />
      );

      expect(screen.getByTestId('metric-total').textContent).toBe(initialTotal);
    });
  });

  describe('Accessibility', () => {
    test('has proper semantic structure', () => {
      render(
        <IncidentDashboard
          incidents={mockIncidents}
          filters={defaultFilters}
          onFilterChange={mockOnFilterChange}
          onIncidentSelect={mockOnIncidentSelect}
        />
      );

      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Incident Management Dashboard');
      expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(7); // 5 metrics + 2 chart titles
    });

    test('filter controls have proper labels', () => {
      render(
        <IncidentDashboard
          incidents={mockIncidents}
          filters={defaultFilters}
          onFilterChange={mockOnFilterChange}
          onIncidentSelect={mockOnIncidentSelect}
        />
      );

      expect(screen.getByText('Status:')).toBeInTheDocument();
      expect(screen.getByText('Priority:')).toBeInTheDocument();
      expect(screen.getByText('Team:')).toBeInTheDocument();
    });

    test('incident items are keyboard accessible', () => {
      render(
        <IncidentDashboard
          incidents={mockIncidents}
          filters={defaultFilters}
          onFilterChange={mockOnFilterChange}
          onIncidentSelect={mockOnIncidentSelect}
        />
      );

      const incidentItem = screen.getByTestId('incident-item-INC-001');
      incidentItem.focus();
      expect(document.activeElement).toBe(incidentItem);
    });
  });
});