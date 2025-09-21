import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { jest } from '@jest/globals';
import '@testing-library/jest-dom';
import { AlertPanel } from '../../../../src/components/alerts/AlertPanel';
import { PerformanceAlert } from '../../../../src/types/performance';

// Mock the performance alert type for incident testing
interface IncidentData extends PerformanceAlert {
  priority: 'critical' | 'high' | 'medium' | 'low';
  assignedTeam?: string;
  relatedIncidents?: string[];
  resolutionTime?: number;
  escalationLevel?: number;
}

// Test data fixtures
const mockIncidents: IncidentData[] = [
  {
    id: 'INC-001',
    description: 'Critical system outage affecting payment processing',
    severity: 'critical',
    priority: 'critical',
    status: 'active',
    metricId: 'system_availability',
    threshold: 0.95,
    condition: '<',
    createdAt: Date.now() - 3600000, // 1 hour ago
    tags: ['payment', 'outage', 'critical'],
    assignee: 'john.doe',
    assignedTeam: 'Infrastructure',
    escalationLevel: 2
  },
  {
    id: 'INC-002',
    description: 'Database connection timeout in user authentication',
    severity: 'high',
    priority: 'high',
    status: 'active',
    metricId: 'auth_response_time',
    threshold: 2000,
    condition: '>',
    createdAt: Date.now() - 1800000, // 30 minutes ago
    tags: ['database', 'authentication', 'timeout'],
    assignee: 'jane.smith',
    assignedTeam: 'Database',
    relatedIncidents: ['INC-003']
  },
  {
    id: 'INC-003',
    description: 'Slow query performance in reporting module',
    severity: 'medium',
    priority: 'medium',
    status: 'acknowledged',
    metricId: 'query_performance',
    threshold: 5000,
    condition: '>',
    createdAt: Date.now() - 7200000, // 2 hours ago
    resolvedAt: Date.now() - 3600000, // 1 hour ago
    tags: ['performance', 'reporting', 'query'],
    assignee: 'bob.johnson',
    assignedTeam: 'Application',
    resolutionTime: 3600000 // 1 hour
  },
  {
    id: 'INC-004',
    description: 'Minor UI glitch in dashboard display',
    severity: 'low',
    priority: 'low',
    status: 'resolved',
    metricId: 'ui_errors',
    threshold: 10,
    condition: '>',
    createdAt: Date.now() - 86400000, // 24 hours ago
    resolvedAt: Date.now() - 82800000, // 23 hours ago
    tags: ['ui', 'dashboard', 'display'],
    assignee: 'alice.wilson',
    assignedTeam: 'Frontend',
    resolutionTime: 3600000 // 1 hour
  }
];

// Mock handlers
const mockOnAlertAction = jest.fn();

describe('IncidentPanel Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Rendering and Display', () => {
    test('renders incident panel with correct title and counts', () => {
      render(
        <AlertPanel
          alerts={mockIncidents}
          onAlertAction={mockOnAlertAction}
        />
      );

      expect(screen.getByText('Alerts & Notifications')).toBeInTheDocument();
      expect(screen.getByText('Total: 4')).toBeInTheDocument();
      expect(screen.getByText('Active: 2')).toBeInTheDocument();
      expect(screen.getByText('Resolved: 1')).toBeInTheDocument();
    });

    test('displays incidents in correct severity order', () => {
      render(
        <AlertPanel
          alerts={mockIncidents}
          onAlertAction={mockOnAlertAction}
        />
      );

      const incidents = screen.getAllByText(/INC-\d+/);
      expect(incidents).toHaveLength(4);

      // Critical should appear first
      const criticalIncident = screen.getByText(/Critical system outage/);
      expect(criticalIncident).toBeInTheDocument();
    });

    test('shows correct severity indicators and colors', () => {
      render(
        <AlertPanel
          alerts={mockIncidents}
          onAlertAction={mockOnAlertAction}
        />
      );

      // Check for severity indicators
      expect(screen.getByText('🚨')).toBeInTheDocument(); // Critical
      expect(screen.getByText('⚠️')).toBeInTheDocument(); // High
      expect(screen.getByText('⚡')).toBeInTheDocument(); // Medium
      expect(screen.getByText('ℹ️')).toBeInTheDocument(); // Low
    });

    test('displays assignee information correctly', () => {
      render(
        <AlertPanel
          alerts={mockIncidents}
          onAlertAction={mockOnAlertAction}
        />
      );

      expect(screen.getByText('@john.doe')).toBeInTheDocument();
      expect(screen.getByText('@jane.smith')).toBeInTheDocument();
      expect(screen.getByText('@bob.johnson')).toBeInTheDocument();
    });

    test('shows appropriate status badges', () => {
      render(
        <AlertPanel
          alerts={mockIncidents}
          onAlertAction={mockOnAlertAction}
        />
      );

      expect(screen.getAllByText('Active')).toHaveLength(2);
      expect(screen.getByText('Resolved')).toBeInTheDocument();
    });
  });

  describe('Filtering and Sorting', () => {
    test('filters incidents by status correctly', async () => {
      render(
        <AlertPanel
          alerts={mockIncidents}
          onAlertAction={mockOnAlertAction}
        />
      );

      const filterSelect = screen.getByRole('combobox', { name: /filter/i });

      fireEvent.change(filterSelect, { target: { value: 'active' } });

      await waitFor(() => {
        const activeIncidents = screen.getAllByText('Active');
        expect(activeIncidents).toHaveLength(2);
        expect(screen.queryByText('Resolved')).not.toBeInTheDocument();
      });
    });

    test('sorts incidents by severity correctly', async () => {
      render(
        <AlertPanel
          alerts={mockIncidents}
          onAlertAction={mockOnAlertAction}
        />
      );

      const sortSelect = screen.getByRole('combobox', { name: /sort/i });

      fireEvent.change(sortSelect, { target: { value: 'severity' } });

      await waitFor(() => {
        const severityTexts = screen.getAllByText(/CRITICAL|HIGH|MEDIUM|LOW/);
        expect(severityTexts[0]).toHaveTextContent('CRITICAL');
      });
    });

    test('shows "no incidents" message when filtered list is empty', async () => {
      render(
        <AlertPanel
          alerts={[]}
          onAlertAction={mockOnAlertAction}
        />
      );

      expect(screen.getByText('No alerts found')).toBeInTheDocument();
      expect(screen.getByText('✅')).toBeInTheDocument();
    });
  });

  describe('Incident Actions', () => {
    test('calls onAlertAction when resolve button is clicked', () => {
      render(
        <AlertPanel
          alerts={mockIncidents}
          onAlertAction={mockOnAlertAction}
        />
      );

      const resolveButtons = screen.getAllByTitle('Resolve Alert');
      fireEvent.click(resolveButtons[0]);

      expect(mockOnAlertAction).toHaveBeenCalledWith('INC-001', 'resolve');
    });

    test('calls onAlertAction when mute button is clicked', () => {
      render(
        <AlertPanel
          alerts={mockIncidents}
          onAlertAction={mockOnAlertAction}
        />
      );

      const muteButtons = screen.getAllByTitle('Mute Alert');
      fireEvent.click(muteButtons[0]);

      expect(mockOnAlertAction).toHaveBeenCalledWith('INC-001', 'mute');
    });

    test('prevents action buttons from triggering detail expansion', () => {
      render(
        <AlertPanel
          alerts={mockIncidents}
          onAlertAction={mockOnAlertAction}
        />
      );

      const resolveButton = screen.getAllByTitle('Resolve Alert')[0];
      fireEvent.click(resolveButton);

      // Incident details should not be expanded
      expect(screen.queryByText('Alert ID:')).not.toBeInTheDocument();
    });
  });

  describe('Incident Details Expansion', () => {
    test('expands incident details when header is clicked', async () => {
      render(
        <AlertPanel
          alerts={mockIncidents}
          onAlertAction={mockOnAlertAction}
        />
      );

      const incidentHeader = screen.getByText(/Critical system outage/).closest('.alert-header');
      fireEvent.click(incidentHeader!);

      await waitFor(() => {
        expect(screen.getByText('Alert ID:')).toBeInTheDocument();
        expect(screen.getByText('INC-001')).toBeInTheDocument();
        expect(screen.getByText('Created:')).toBeInTheDocument();
      });
    });

    test('toggles details when details button is clicked', async () => {
      render(
        <AlertPanel
          alerts={mockIncidents}
          onAlertAction={mockOnAlertAction}
        />
      );

      const detailsButton = screen.getAllByTitle('Toggle Details')[0];

      // Expand details
      fireEvent.click(detailsButton);
      await waitFor(() => {
        expect(screen.getByText('Alert ID:')).toBeInTheDocument();
      });

      // Collapse details
      fireEvent.click(detailsButton);
      await waitFor(() => {
        expect(screen.queryByText('Alert ID:')).not.toBeInTheDocument();
      });
    });

    test('shows resolved timestamp when incident is resolved', async () => {
      render(
        <AlertPanel
          alerts={mockIncidents}
          onAlertAction={mockOnAlertAction}
        />
      );

      // Find and expand resolved incident
      const resolvedIncident = screen.getByText(/Minor UI glitch/).closest('.alert-header');
      fireEvent.click(resolvedIncident!);

      await waitFor(() => {
        expect(screen.getByText('Resolved:')).toBeInTheDocument();
      });
    });

    test('displays tags correctly in expanded view', async () => {
      render(
        <AlertPanel
          alerts={mockIncidents}
          onAlertAction={mockOnAlertAction}
        />
      );

      const incidentHeader = screen.getByText(/Critical system outage/).closest('.alert-header');
      fireEvent.click(incidentHeader!);

      await waitFor(() => {
        expect(screen.getByText('Tags:')).toBeInTheDocument();
        expect(screen.getByText('payment')).toBeInTheDocument();
        expect(screen.getByText('outage')).toBeInTheDocument();
        expect(screen.getByText('critical')).toBeInTheDocument();
      });
    });
  });

  describe('Compact Mode', () => {
    test('renders in compact mode with reduced information', () => {
      render(
        <AlertPanel
          alerts={mockIncidents}
          onAlertAction={mockOnAlertAction}
          compact={true}
        />
      );

      // Should not show meta information in compact mode
      expect(screen.queryByText('Metric:')).not.toBeInTheDocument();
      expect(screen.queryByText('Threshold:')).not.toBeInTheDocument();
    });

    test('limits maximum visible incidents when maxVisible is set', () => {
      render(
        <AlertPanel
          alerts={mockIncidents}
          onAlertAction={mockOnAlertAction}
          maxVisible={2}
        />
      );

      // Should only show 2 incidents out of 4
      const incidents = screen.getAllByText(/INC-\d+/);
      expect(incidents).toHaveLength(2);

      // Should show "Showing X of Y" message
      expect(screen.getByText(/Showing 2 of 4 alerts/)).toBeInTheDocument();
    });
  });

  describe('Time Formatting', () => {
    test('formats recent timestamps correctly', () => {
      const recentIncident: IncidentData = {
        ...mockIncidents[0],
        createdAt: Date.now() - 1800000 // 30 minutes ago
      };

      render(
        <AlertPanel
          alerts={[recentIncident]}
          onAlertAction={mockOnAlertAction}
        />
      );

      expect(screen.getByText('30m ago')).toBeInTheDocument();
    });

    test('formats hour timestamps correctly', () => {
      const hourOldIncident: IncidentData = {
        ...mockIncidents[0],
        createdAt: Date.now() - 7200000 // 2 hours ago
      };

      render(
        <AlertPanel
          alerts={[hourOldIncident]}
          onAlertAction={mockOnAlertAction}
        />
      );

      expect(screen.getByText('2h ago')).toBeInTheDocument();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('handles empty incidents list gracefully', () => {
      render(
        <AlertPanel
          alerts={[]}
          onAlertAction={mockOnAlertAction}
        />
      );

      expect(screen.getByText('Total: 0')).toBeInTheDocument();
      expect(screen.getByText('Active: 0')).toBeInTheDocument();
      expect(screen.getByText('No alerts found')).toBeInTheDocument();
    });

    test('handles incidents without assignee', () => {
      const incidentWithoutAssignee: IncidentData = {
        ...mockIncidents[0],
        assignee: undefined
      };

      render(
        <AlertPanel
          alerts={[incidentWithoutAssignee]}
          onAlertAction={mockOnAlertAction}
        />
      );

      expect(screen.queryByText(/^@/)).not.toBeInTheDocument();
    });

    test('handles incidents without tags', () => {
      const incidentWithoutTags: IncidentData = {
        ...mockIncidents[0],
        tags: []
      };

      render(
        <AlertPanel
          alerts={[incidentWithoutTags]}
          onAlertAction={mockOnAlertAction}
        />
      );

      // Expand details to check tags section
      const incidentHeader = screen.getByText(/Critical system outage/).closest('.alert-header');
      fireEvent.click(incidentHeader!);

      // Tags section should not appear
      expect(screen.queryByText('Tags:')).not.toBeInTheDocument();
    });

    test('handles unknown severity levels gracefully', () => {
      const incidentWithUnknownSeverity: IncidentData = {
        ...mockIncidents[0],
        severity: 'unknown' as any
      };

      render(
        <AlertPanel
          alerts={[incidentWithUnknownSeverity]}
          onAlertAction={mockOnAlertAction}
        />
      );

      // Should render without crashing and use default icon
      expect(screen.getByText('📊')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    test('has proper ARIA labels and roles', () => {
      render(
        <AlertPanel
          alerts={mockIncidents}
          onAlertAction={mockOnAlertAction}
        />
      );

      const filterSelect = screen.getByRole('combobox');
      expect(filterSelect).toBeInTheDocument();
      expect(filterSelect).toHaveAccessibleName();
    });

    test('action buttons have proper titles for screen readers', () => {
      render(
        <AlertPanel
          alerts={mockIncidents}
          onAlertAction={mockOnAlertAction}
        />
      );

      expect(screen.getAllByTitle('Resolve Alert')).toBeTruthy();
      expect(screen.getAllByTitle('Mute Alert')).toBeTruthy();
      expect(screen.getAllByTitle('Toggle Details')).toBeTruthy();
    });

    test('supports keyboard navigation', () => {
      render(
        <AlertPanel
          alerts={mockIncidents}
          onAlertAction={mockOnAlertAction}
        />
      );

      const resolveButton = screen.getAllByTitle('Resolve Alert')[0];
      resolveButton.focus();
      expect(document.activeElement).toBe(resolveButton);
    });
  });

  describe('Performance', () => {
    test('handles large number of incidents efficiently', () => {
      const manyIncidents = Array.from({ length: 1000 }, (_, i) => ({
        ...mockIncidents[0],
        id: `INC-${i.toString().padStart(3, '0')}`,
        description: `Incident ${i + 1}`,
        createdAt: Date.now() - (i * 1000)
      }));

      const startTime = performance.now();

      render(
        <AlertPanel
          alerts={manyIncidents}
          onAlertAction={mockOnAlertAction}
          maxVisible={50}
        />
      );

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should render within reasonable time (less than 100ms)
      expect(renderTime).toBeLessThan(100);

      // Should limit displayed incidents
      const displayedIncidents = screen.getAllByText(/INC-\d+/);
      expect(displayedIncidents).toHaveLength(50);
    });
  });
});