import { jest } from '@jest/globals';
import { AlertingEngine, Alert, AlertRule } from '../../../../src/monitoring/AlertingEngine';

// Extended incident interface
interface Incident extends Alert {
  priority: 'critical' | 'high' | 'medium' | 'low';
  assignedTeam?: string;
  relatedIncidents?: string[];
  escalationLevel?: number;
  workflowStatus?: 'new' | 'triaged' | 'in_progress' | 'blocked' | 'resolved';
  slaViolated?: boolean;
  customerImpact?: 'high' | 'medium' | 'low' | 'none';
  estimatedResolutionTime?: number;
  actualResolutionTime?: number;
  rootCause?: string;
  preventionMeasures?: string[];
}

interface IncidentFilters {
  status?: string[];
  priority?: string[];
  assignedTeam?: string[];
  dateRange?: { start: Date; end: Date };
  customerImpact?: string[];
  slaStatus?: 'within' | 'violated' | 'at_risk';
}

interface IncidentMetrics {
  totalIncidents: number;
  activeIncidents: number;
  criticalIncidents: number;
  avgResolutionTime: number;
  slaCompliance: number;
  escalatedIncidents: number;
  incidentsByPriority: Record<string, number>;
  incidentsByTeam: Record<string, number>;
  trendsLastWeek: Array<{ date: string; count: number }>;
}

// Mock IncidentService class extending AlertingEngine functionality
class IncidentService {
  private alertingEngine: AlertingEngine;
  private incidents: Map<string, Incident> = new Map();

  constructor(alertingEngine: AlertingEngine) {
    this.alertingEngine = alertingEngine;
  }

  // Create incident from alert
  async createIncident(
    alert: Alert,
    priority: 'critical' | 'high' | 'medium' | 'low',
    assignedTeam?: string
  ): Promise<Incident> {
    const incident: Incident = {
      ...alert,
      priority,
      assignedTeam,
      escalationLevel: 0,
      workflowStatus: 'new',
      slaViolated: false,
      customerImpact: this.calculateCustomerImpact(priority),
      estimatedResolutionTime: this.calculateEstimatedResolutionTime(priority)
    };

    this.incidents.set(incident.id, incident);
    return incident;
  }

  // Get incidents with filtering
  async getIncidents(filters?: IncidentFilters): Promise<Incident[]> {
    let incidents = Array.from(this.incidents.values());

    if (filters) {
      if (filters.status?.length) {
        incidents = incidents.filter(i => filters.status!.includes(i.status));
      }

      if (filters.priority?.length) {
        incidents = incidents.filter(i => filters.priority!.includes(i.priority));
      }

      if (filters.assignedTeam?.length) {
        incidents = incidents.filter(i =>
          i.assignedTeam && filters.assignedTeam!.includes(i.assignedTeam)
        );
      }

      if (filters.dateRange) {
        incidents = incidents.filter(i => {
          const incidentDate = new Date(i.triggered_at);
          return incidentDate >= filters.dateRange!.start &&
                 incidentDate <= filters.dateRange!.end;
        });
      }

      if (filters.customerImpact?.length) {
        incidents = incidents.filter(i =>
          i.customerImpact && filters.customerImpact!.includes(i.customerImpact)
        );
      }

      if (filters.slaStatus) {
        incidents = incidents.filter(i => {
          switch (filters.slaStatus) {
            case 'within':
              return !i.slaViolated;
            case 'violated':
              return i.slaViolated;
            case 'at_risk':
              return this.isAtRiskOfSlaViolation(i);
            default:
              return true;
          }
        });
      }
    }

    return incidents.sort((a, b) => {
      // Sort by priority first, then by creation time
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const aPriority = priorityOrder[a.priority] || 0;
      const bPriority = priorityOrder[b.priority] || 0;

      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }

      return b.triggered_at.getTime() - a.triggered_at.getTime();
    });
  }

  // Update incident
  async updateIncident(id: string, updates: Partial<Incident>): Promise<Incident> {
    const incident = this.incidents.get(id);
    if (!incident) {
      throw new Error(`Incident ${id} not found`);
    }

    const updatedIncident: Incident = {
      ...incident,
      ...updates
    };

    // Update resolution time if status changed to resolved
    if (updates.status === 'resolved' && incident.status !== 'resolved') {
      updatedIncident.actualResolutionTime = Date.now() - incident.triggered_at.getTime();
      updatedIncident.resolved_at = new Date();
    }

    this.incidents.set(id, updatedIncident);
    return updatedIncident;
  }

  // Escalate incident
  async escalateIncident(id: string, reason: string): Promise<Incident> {
    const incident = this.incidents.get(id);
    if (!incident) {
      throw new Error(`Incident ${id} not found`);
    }

    const updatedIncident: Incident = {
      ...incident,
      escalationLevel: (incident.escalationLevel || 0) + 1,
      workflowStatus: 'escalated' as any
    };

    // Auto-assign to higher priority team if needed
    if (updatedIncident.escalationLevel >= 2) {
      updatedIncident.assignedTeam = 'Management';
      updatedIncident.priority = 'critical';
    }

    this.incidents.set(id, updatedIncident);
    return updatedIncident;
  }

  // Assign incident
  async assignIncident(id: string, assignee: string, team?: string): Promise<Incident> {
    const incident = this.incidents.get(id);
    if (!incident) {
      throw new Error(`Incident ${id} not found`);
    }

    const updatedIncident: Incident = {
      ...incident,
      assignee,
      assignedTeam: team || incident.assignedTeam,
      status: 'acknowledged',
      acknowledged_by: assignee,
      acknowledged_at: new Date()
    };

    this.incidents.set(id, updatedIncident);
    return updatedIncident;
  }

  // Get incident metrics
  async getIncidentMetrics(timeRange?: { start: Date; end: Date }): Promise<IncidentMetrics> {
    let incidents = Array.from(this.incidents.values());

    if (timeRange) {
      incidents = incidents.filter(i => {
        const incidentDate = new Date(i.triggered_at);
        return incidentDate >= timeRange.start && incidentDate <= timeRange.end;
      });
    }

    const totalIncidents = incidents.length;
    const activeIncidents = incidents.filter(i => i.status === 'active').length;
    const criticalIncidents = incidents.filter(i => i.priority === 'critical').length;
    const escalatedIncidents = incidents.filter(i => (i.escalationLevel || 0) > 0).length;

    const resolvedIncidents = incidents.filter(i => i.actualResolutionTime);
    const avgResolutionTime = resolvedIncidents.length > 0
      ? resolvedIncidents.reduce((sum, i) => sum + (i.actualResolutionTime || 0), 0) / resolvedIncidents.length
      : 0;

    const slaCompliantIncidents = incidents.filter(i => !i.slaViolated).length;
    const slaCompliance = totalIncidents > 0 ? (slaCompliantIncidents / totalIncidents) * 100 : 100;

    // Group by priority
    const incidentsByPriority = incidents.reduce((acc, incident) => {
      acc[incident.priority] = (acc[incident.priority] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Group by team
    const incidentsByTeam = incidents.reduce((acc, incident) => {
      if (incident.assignedTeam) {
        acc[incident.assignedTeam] = (acc[incident.assignedTeam] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    // Generate trends for last week
    const trendsLastWeek = this.generateWeeklyTrends(incidents);

    return {
      totalIncidents,
      activeIncidents,
      criticalIncidents,
      avgResolutionTime,
      slaCompliance,
      escalatedIncidents,
      incidentsByPriority,
      incidentsByTeam,
      trendsLastWeek
    };
  }

  // Search incidents
  async searchIncidents(query: string, filters?: IncidentFilters): Promise<Incident[]> {
    const incidents = await this.getIncidents(filters);

    if (!query.trim()) {
      return incidents;
    }

    const searchTerm = query.toLowerCase();
    return incidents.filter(incident =>
      incident.id.toLowerCase().includes(searchTerm) ||
      incident.message.toLowerCase().includes(searchTerm) ||
      incident.metric.toLowerCase().includes(searchTerm) ||
      (incident.assignee && incident.assignee.toLowerCase().includes(searchTerm)) ||
      (incident.assignedTeam && incident.assignedTeam.toLowerCase().includes(searchTerm)) ||
      incident.tags.some(tag => tag.toLowerCase().includes(searchTerm))
    );
  }

  // Link related incidents
  async linkIncidents(sourceId: string, targetId: string, relationType: string = 'related'): Promise<void> {
    const sourceIncident = this.incidents.get(sourceId);
    const targetIncident = this.incidents.get(targetId);

    if (!sourceIncident || !targetIncident) {
      throw new Error('One or both incidents not found');
    }

    sourceIncident.relatedIncidents = sourceIncident.relatedIncidents || [];
    if (!sourceIncident.relatedIncidents.includes(targetId)) {
      sourceIncident.relatedIncidents.push(targetId);
    }

    targetIncident.relatedIncidents = targetIncident.relatedIncidents || [];
    if (!targetIncident.relatedIncidents.includes(sourceId)) {
      targetIncident.relatedIncidents.push(sourceId);
    }
  }

  // Get incident timeline
  async getIncidentTimeline(id: string): Promise<Array<{
    timestamp: Date;
    event: string;
    details: string;
    user?: string;
  }>> {
    const incident = this.incidents.get(id);
    if (!incident) {
      throw new Error(`Incident ${id} not found`);
    }

    const timeline = [
      {
        timestamp: incident.triggered_at,
        event: 'Incident Created',
        details: `Incident triggered: ${incident.message}`,
        user: 'system'
      }
    ];

    if (incident.acknowledged_at) {
      timeline.push({
        timestamp: incident.acknowledged_at,
        event: 'Incident Acknowledged',
        details: `Incident acknowledged by ${incident.acknowledged_by}`,
        user: incident.acknowledged_by
      });
    }

    if (incident.resolved_at) {
      timeline.push({
        timestamp: incident.resolved_at,
        event: 'Incident Resolved',
        details: 'Incident marked as resolved',
        user: incident.assignee
      });
    }

    return timeline.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  // Private helper methods
  private calculateCustomerImpact(priority: string): 'high' | 'medium' | 'low' | 'none' {
    switch (priority) {
      case 'critical': return 'high';
      case 'high': return 'medium';
      case 'medium': return 'low';
      case 'low': return 'none';
      default: return 'none';
    }
  }

  private calculateEstimatedResolutionTime(priority: string): number {
    switch (priority) {
      case 'critical': return 2 * 60 * 60 * 1000; // 2 hours
      case 'high': return 4 * 60 * 60 * 1000; // 4 hours
      case 'medium': return 8 * 60 * 60 * 1000; // 8 hours
      case 'low': return 24 * 60 * 60 * 1000; // 24 hours
      default: return 8 * 60 * 60 * 1000;
    }
  }

  private isAtRiskOfSlaViolation(incident: Incident): boolean {
    if (incident.status === 'resolved' || incident.slaViolated) {
      return false;
    }

    const timeSinceCreation = Date.now() - incident.triggered_at.getTime();
    const estimatedTime = incident.estimatedResolutionTime || 0;

    return timeSinceCreation > (estimatedTime * 0.8); // 80% of estimated time
  }

  private generateWeeklyTrends(incidents: Incident[]): Array<{ date: string; count: number }> {
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);

    const trends = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const dayIncidents = incidents.filter(incident => {
        const incidentDate = new Date(incident.triggered_at);
        return incidentDate.toISOString().split('T')[0] === dateStr;
      });

      trends.push({
        date: dateStr,
        count: dayIncidents.length
      });
    }

    return trends;
  }
}

// Test setup
describe('IncidentService', () => {
  let mockAlertingEngine: jest.Mocked<AlertingEngine>;
  let incidentService: IncidentService;

  const mockAlert: Alert = {
    id: 'alert-001',
    rule_id: 'rule-001',
    message: 'High CPU usage detected',
    severity: 'critical',
    metric: 'cpu_usage',
    current_value: 95,
    threshold: 80,
    status: 'active',
    triggered_at: new Date(),
    last_notification: new Date(),
    notification_count: 1,
    tags: ['performance', 'cpu'],
    context: { server: 'web-01' }
  };

  beforeEach(() => {
    mockAlertingEngine = {
      getRules: jest.fn(),
      getActiveAlerts: jest.fn(),
      acknowledgeAlert: jest.fn(),
      resolveAlert: jest.fn()
    } as any;

    incidentService = new IncidentService(mockAlertingEngine);
  });

  describe('Incident Creation', () => {
    test('creates incident from alert with correct properties', async () => {
      const incident = await incidentService.createIncident(mockAlert, 'critical', 'Infrastructure');

      expect(incident.id).toBe('alert-001');
      expect(incident.priority).toBe('critical');
      expect(incident.assignedTeam).toBe('Infrastructure');
      expect(incident.workflowStatus).toBe('new');
      expect(incident.customerImpact).toBe('high');
      expect(incident.escalationLevel).toBe(0);
      expect(incident.slaViolated).toBe(false);
      expect(incident.estimatedResolutionTime).toBe(2 * 60 * 60 * 1000); // 2 hours
    });

    test('calculates customer impact based on priority', async () => {
      const criticalIncident = await incidentService.createIncident(mockAlert, 'critical');
      const highIncident = await incidentService.createIncident(mockAlert, 'high');
      const mediumIncident = await incidentService.createIncident(mockAlert, 'medium');
      const lowIncident = await incidentService.createIncident(mockAlert, 'low');

      expect(criticalIncident.customerImpact).toBe('high');
      expect(highIncident.customerImpact).toBe('medium');
      expect(mediumIncident.customerImpact).toBe('low');
      expect(lowIncident.customerImpact).toBe('none');
    });

    test('calculates estimated resolution time based on priority', async () => {
      const criticalIncident = await incidentService.createIncident(mockAlert, 'critical');
      const highIncident = await incidentService.createIncident(mockAlert, 'high');
      const mediumIncident = await incidentService.createIncident(mockAlert, 'medium');
      const lowIncident = await incidentService.createIncident(mockAlert, 'low');

      expect(criticalIncident.estimatedResolutionTime).toBe(2 * 60 * 60 * 1000); // 2 hours
      expect(highIncident.estimatedResolutionTime).toBe(4 * 60 * 60 * 1000); // 4 hours
      expect(mediumIncident.estimatedResolutionTime).toBe(8 * 60 * 60 * 1000); // 8 hours
      expect(lowIncident.estimatedResolutionTime).toBe(24 * 60 * 60 * 1000); // 24 hours
    });
  });

  describe('Incident Retrieval and Filtering', () => {
    beforeEach(async () => {
      // Create test incidents
      await incidentService.createIncident({...mockAlert, id: 'inc-1'}, 'critical', 'Infrastructure');
      await incidentService.createIncident({...mockAlert, id: 'inc-2'}, 'high', 'Database');
      await incidentService.createIncident({...mockAlert, id: 'inc-3'}, 'medium', 'Application');
      await incidentService.createIncident({...mockAlert, id: 'inc-4'}, 'low', 'Frontend');
    });

    test('gets all incidents without filters', async () => {
      const incidents = await incidentService.getIncidents();
      expect(incidents).toHaveLength(4);
    });

    test('filters incidents by status', async () => {
      await incidentService.updateIncident('inc-1', { status: 'resolved' });

      const activeIncidents = await incidentService.getIncidents({ status: ['active'] });
      const resolvedIncidents = await incidentService.getIncidents({ status: ['resolved'] });

      expect(activeIncidents).toHaveLength(3);
      expect(resolvedIncidents).toHaveLength(1);
      expect(resolvedIncidents[0].id).toBe('inc-1');
    });

    test('filters incidents by priority', async () => {
      const criticalIncidents = await incidentService.getIncidents({ priority: ['critical'] });
      const highAndCritical = await incidentService.getIncidents({ priority: ['critical', 'high'] });

      expect(criticalIncidents).toHaveLength(1);
      expect(criticalIncidents[0].priority).toBe('critical');
      expect(highAndCritical).toHaveLength(2);
    });

    test('filters incidents by assigned team', async () => {
      const infraIncidents = await incidentService.getIncidents({ assignedTeam: ['Infrastructure'] });
      const dbIncidents = await incidentService.getIncidents({ assignedTeam: ['Database'] });

      expect(infraIncidents).toHaveLength(1);
      expect(infraIncidents[0].assignedTeam).toBe('Infrastructure');
      expect(dbIncidents).toHaveLength(1);
      expect(dbIncidents[0].assignedTeam).toBe('Database');
    });

    test('filters incidents by date range', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const recentIncidents = await incidentService.getIncidents({
        dateRange: { start: yesterday, end: tomorrow }
      });

      expect(recentIncidents).toHaveLength(4);

      const futureIncidents = await incidentService.getIncidents({
        dateRange: { start: tomorrow, end: new Date(tomorrow.getTime() + 86400000) }
      });

      expect(futureIncidents).toHaveLength(0);
    });

    test('sorts incidents by priority and creation time', async () => {
      const incidents = await incidentService.getIncidents();

      expect(incidents[0].priority).toBe('critical');
      expect(incidents[1].priority).toBe('high');
      expect(incidents[2].priority).toBe('medium');
      expect(incidents[3].priority).toBe('low');
    });
  });

  describe('Incident Updates', () => {
    let incidentId: string;

    beforeEach(async () => {
      const incident = await incidentService.createIncident(mockAlert, 'critical', 'Infrastructure');
      incidentId = incident.id;
    });

    test('updates incident properties', async () => {
      const updatedIncident = await incidentService.updateIncident(incidentId, {
        priority: 'high',
        assignedTeam: 'Database',
        rootCause: 'Database connection pool exhausted'
      });

      expect(updatedIncident.priority).toBe('high');
      expect(updatedIncident.assignedTeam).toBe('Database');
      expect(updatedIncident.rootCause).toBe('Database connection pool exhausted');
    });

    test('calculates resolution time when status changes to resolved', async () => {
      const beforeResolve = Date.now();

      const resolvedIncident = await incidentService.updateIncident(incidentId, {
        status: 'resolved'
      });

      expect(resolvedIncident.status).toBe('resolved');
      expect(resolvedIncident.actualResolutionTime).toBeDefined();
      expect(resolvedIncident.actualResolutionTime).toBeGreaterThan(0);
      expect(resolvedIncident.resolved_at).toBeInstanceOf(Date);
    });

    test('throws error when updating non-existent incident', async () => {
      await expect(
        incidentService.updateIncident('non-existent', { priority: 'high' })
      ).rejects.toThrow('Incident non-existent not found');
    });
  });

  describe('Incident Escalation', () => {
    let incidentId: string;

    beforeEach(async () => {
      const incident = await incidentService.createIncident(mockAlert, 'medium', 'Application');
      incidentId = incident.id;
    });

    test('escalates incident and increases escalation level', async () => {
      const escalatedIncident = await incidentService.escalateIncident(incidentId, 'No response from team');

      expect(escalatedIncident.escalationLevel).toBe(1);
      expect(escalatedIncident.workflowStatus).toBe('escalated');
    });

    test('auto-escalates to management for level 2+ escalations', async () => {
      await incidentService.escalateIncident(incidentId, 'First escalation');
      const secondEscalation = await incidentService.escalateIncident(incidentId, 'Second escalation');

      expect(secondEscalation.escalationLevel).toBe(2);
      expect(secondEscalation.assignedTeam).toBe('Management');
      expect(secondEscalation.priority).toBe('critical');
    });

    test('throws error when escalating non-existent incident', async () => {
      await expect(
        incidentService.escalateIncident('non-existent', 'reason')
      ).rejects.toThrow('Incident non-existent not found');
    });
  });

  describe('Incident Assignment', () => {
    let incidentId: string;

    beforeEach(async () => {
      const incident = await incidentService.createIncident(mockAlert, 'high', 'Infrastructure');
      incidentId = incident.id;
    });

    test('assigns incident to user and team', async () => {
      const assignedIncident = await incidentService.assignIncident(incidentId, 'john.doe', 'Database');

      expect(assignedIncident.assignee).toBe('john.doe');
      expect(assignedIncident.assignedTeam).toBe('Database');
      expect(assignedIncident.status).toBe('acknowledged');
      expect(assignedIncident.acknowledged_by).toBe('john.doe');
      expect(assignedIncident.acknowledged_at).toBeInstanceOf(Date);
    });

    test('assigns incident to user only, keeping existing team', async () => {
      const assignedIncident = await incidentService.assignIncident(incidentId, 'jane.smith');

      expect(assignedIncident.assignee).toBe('jane.smith');
      expect(assignedIncident.assignedTeam).toBe('Infrastructure'); // Original team
    });

    test('throws error when assigning non-existent incident', async () => {
      await expect(
        incidentService.assignIncident('non-existent', 'user')
      ).rejects.toThrow('Incident non-existent not found');
    });
  });

  describe('Incident Metrics', () => {
    beforeEach(async () => {
      // Create test incidents with different properties
      await incidentService.createIncident({...mockAlert, id: 'inc-1'}, 'critical', 'Infrastructure');
      await incidentService.createIncident({...mockAlert, id: 'inc-2'}, 'high', 'Database');
      await incidentService.createIncident({...mockAlert, id: 'inc-3'}, 'medium', 'Application');

      // Resolve one incident
      await incidentService.updateIncident('inc-3', {
        status: 'resolved',
        actualResolutionTime: 3600000 // 1 hour
      });

      // Escalate one incident
      await incidentService.escalateIncident('inc-1', 'Critical issue');
    });

    test('calculates correct incident metrics', async () => {
      const metrics = await incidentService.getIncidentMetrics();

      expect(metrics.totalIncidents).toBe(3);
      expect(metrics.activeIncidents).toBe(2);
      expect(metrics.criticalIncidents).toBe(1);
      expect(metrics.escalatedIncidents).toBe(1);
      expect(metrics.avgResolutionTime).toBe(3600000); // 1 hour
      expect(metrics.slaCompliance).toBe(100); // No SLA violations
    });

    test('groups incidents by priority correctly', async () => {
      const metrics = await incidentService.getIncidentMetrics();

      expect(metrics.incidentsByPriority.critical).toBe(1);
      expect(metrics.incidentsByPriority.high).toBe(1);
      expect(metrics.incidentsByPriority.medium).toBe(1);
      expect(metrics.incidentsByPriority.low).toBeUndefined();
    });

    test('groups incidents by team correctly', async () => {
      const metrics = await incidentService.getIncidentMetrics();

      expect(metrics.incidentsByTeam.Infrastructure).toBe(1);
      expect(metrics.incidentsByTeam.Database).toBe(1);
      expect(metrics.incidentsByTeam.Application).toBe(1);
    });

    test('generates weekly trends', async () => {
      const metrics = await incidentService.getIncidentMetrics();

      expect(metrics.trendsLastWeek).toHaveLength(7);
      expect(metrics.trendsLastWeek[6].count).toBe(3); // Today's incidents
    });

    test('filters metrics by time range', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dayAfterTomorrow = new Date();
      dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);

      const futureMetrics = await incidentService.getIncidentMetrics({
        start: tomorrow,
        end: dayAfterTomorrow
      });

      expect(futureMetrics.totalIncidents).toBe(0);
      expect(futureMetrics.activeIncidents).toBe(0);
    });
  });

  describe('Incident Search', () => {
    beforeEach(async () => {
      await incidentService.createIncident({
        ...mockAlert,
        id: 'inc-1',
        message: 'Database connection timeout',
        tags: ['database', 'timeout']
      }, 'critical', 'Infrastructure');

      await incidentService.createIncident({
        ...mockAlert,
        id: 'inc-2',
        message: 'High CPU usage on web server',
        tags: ['performance', 'cpu', 'web']
      }, 'high', 'Database');

      await incidentService.assignIncident('inc-1', 'john.doe');
    });

    test('searches incidents by message content', async () => {
      const results = await incidentService.searchIncidents('database');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('inc-1');
    });

    test('searches incidents by tags', async () => {
      const results = await incidentService.searchIncidents('performance');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('inc-2');
    });

    test('searches incidents by assignee', async () => {
      const results = await incidentService.searchIncidents('john.doe');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('inc-1');
    });

    test('searches incidents by team', async () => {
      const results = await incidentService.searchIncidents('Database');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('inc-2');
    });

    test('returns all incidents for empty search', async () => {
      const results = await incidentService.searchIncidents('');
      expect(results).toHaveLength(2);
    });

    test('combines search with filters', async () => {
      const results = await incidentService.searchIncidents('inc', {
        priority: ['critical']
      });
      expect(results).toHaveLength(1);
      expect(results[0].priority).toBe('critical');
    });
  });

  describe('Incident Relationships', () => {
    let incident1Id: string;
    let incident2Id: string;

    beforeEach(async () => {
      const inc1 = await incidentService.createIncident({...mockAlert, id: 'inc-1'}, 'critical', 'Infrastructure');
      const inc2 = await incidentService.createIncident({...mockAlert, id: 'inc-2'}, 'high', 'Database');
      incident1Id = inc1.id;
      incident2Id = inc2.id;
    });

    test('links two incidents bidirectionally', async () => {
      await incidentService.linkIncidents(incident1Id, incident2Id);

      const incidents = await incidentService.getIncidents();
      const inc1 = incidents.find(i => i.id === incident1Id);
      const inc2 = incidents.find(i => i.id === incident2Id);

      expect(inc1?.relatedIncidents).toContain(incident2Id);
      expect(inc2?.relatedIncidents).toContain(incident1Id);
    });

    test('prevents duplicate links', async () => {
      await incidentService.linkIncidents(incident1Id, incident2Id);
      await incidentService.linkIncidents(incident1Id, incident2Id); // Duplicate

      const incidents = await incidentService.getIncidents();
      const inc1 = incidents.find(i => i.id === incident1Id);

      expect(inc1?.relatedIncidents).toHaveLength(1);
      expect(inc1?.relatedIncidents?.[0]).toBe(incident2Id);
    });

    test('throws error when linking non-existent incidents', async () => {
      await expect(
        incidentService.linkIncidents('non-existent', incident2Id)
      ).rejects.toThrow('One or both incidents not found');

      await expect(
        incidentService.linkIncidents(incident1Id, 'non-existent')
      ).rejects.toThrow('One or both incidents not found');
    });
  });

  describe('Incident Timeline', () => {
    let incidentId: string;

    beforeEach(async () => {
      const incident = await incidentService.createIncident(mockAlert, 'critical', 'Infrastructure');
      incidentId = incident.id;
    });

    test('generates timeline with creation event', async () => {
      const timeline = await incidentService.getIncidentTimeline(incidentId);

      expect(timeline).toHaveLength(1);
      expect(timeline[0].event).toBe('Incident Created');
      expect(timeline[0].user).toBe('system');
      expect(timeline[0].timestamp).toBeInstanceOf(Date);
    });

    test('includes acknowledgment in timeline', async () => {
      await incidentService.assignIncident(incidentId, 'john.doe');
      const timeline = await incidentService.getIncidentTimeline(incidentId);

      expect(timeline).toHaveLength(2);
      expect(timeline[1].event).toBe('Incident Acknowledged');
      expect(timeline[1].user).toBe('john.doe');
    });

    test('includes resolution in timeline', async () => {
      await incidentService.assignIncident(incidentId, 'john.doe');
      await incidentService.updateIncident(incidentId, { status: 'resolved' });

      const timeline = await incidentService.getIncidentTimeline(incidentId);

      expect(timeline).toHaveLength(3);
      expect(timeline[2].event).toBe('Incident Resolved');
    });

    test('sorts timeline events chronologically', async () => {
      await incidentService.assignIncident(incidentId, 'john.doe');
      await incidentService.updateIncident(incidentId, { status: 'resolved' });

      const timeline = await incidentService.getIncidentTimeline(incidentId);

      for (let i = 1; i < timeline.length; i++) {
        expect(timeline[i].timestamp.getTime()).toBeGreaterThanOrEqual(
          timeline[i - 1].timestamp.getTime()
        );
      }
    });

    test('throws error for non-existent incident', async () => {
      await expect(
        incidentService.getIncidentTimeline('non-existent')
      ).rejects.toThrow('Incident non-existent not found');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('handles empty incident list gracefully', async () => {
      const incidents = await incidentService.getIncidents();
      const metrics = await incidentService.getIncidentMetrics();

      expect(incidents).toHaveLength(0);
      expect(metrics.totalIncidents).toBe(0);
      expect(metrics.slaCompliance).toBe(100);
    });

    test('handles malformed filter objects', async () => {
      const incidents = await incidentService.getIncidents({
        status: [],
        priority: undefined as any,
        assignedTeam: null as any
      });

      expect(incidents).toHaveLength(0);
    });

    test('validates incident updates', async () => {
      const incident = await incidentService.createIncident(mockAlert, 'critical');

      // Should not throw for valid updates
      await expect(
        incidentService.updateIncident(incident.id, { priority: 'high' })
      ).resolves.toBeDefined();
    });
  });
});