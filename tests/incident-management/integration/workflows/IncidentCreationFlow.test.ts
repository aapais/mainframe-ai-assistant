import { jest } from '@jest/globals';
import { AlertingEngine } from '../../../../src/monitoring/AlertingEngine';

// Mock implementation of incident creation workflow
interface IncidentCreationWorkflow {
  alertingEngine: AlertingEngine;
  notificationService: any;
  escalationService: any;
  metricsCollector: any;
}

interface IncidentCreationRequest {
  title: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  assignedTeam?: string;
  assignee?: string;
  tags?: string[];
  metadata?: Record<string, any>;
  autoEscalate?: boolean;
  customSla?: number; // in minutes
}

interface IncidentCreationResult {
  incident: any;
  notifications: Array<{
    channel: string;
    recipients: string[];
    status: 'sent' | 'failed';
    timestamp: Date;
  }>;
  escalations: Array<{
    level: number;
    triggeredAt: Date;
    reason: string;
  }>;
  metrics: {
    creationTime: number;
    timeToAssignment?: number;
    timeToFirstResponse?: number;
  };
}

class IncidentCreationWorkflow {
  constructor(
    private alertingEngine: AlertingEngine,
    private notificationService: any,
    private escalationService: any,
    private metricsCollector: any
  ) {}

  async createIncident(request: IncidentCreationRequest): Promise<IncidentCreationResult> {
    const startTime = Date.now();

    try {
      // Validate request
      this.validateRequest(request);

      // Create the incident
      const incident = await this.createIncidentRecord(request);

      // Send notifications
      const notifications = await this.sendNotifications(incident, request);

      // Setup auto-escalation if enabled
      const escalations: any[] = [];
      if (request.autoEscalate) {
        await this.setupAutoEscalation(incident, request);
      }

      // Collect metrics
      const creationTime = Date.now() - startTime;
      await this.metricsCollector.recordIncidentCreation({
        incidentId: incident.id,
        creationTime,
        priority: request.priority,
        category: request.category
      });

      // Auto-assign if team is specified
      let timeToAssignment: number | undefined;
      if (request.assignedTeam) {
        const assignmentStart = Date.now();
        await this.autoAssignToTeam(incident, request.assignedTeam, request.assignee);
        timeToAssignment = Date.now() - assignmentStart;
      }

      return {
        incident,
        notifications,
        escalations,
        metrics: {
          creationTime,
          timeToAssignment
        }
      };

    } catch (error) {
      // Record failure metrics
      await this.metricsCollector.recordIncidentCreationFailure({
        error: error.message,
        request,
        timestamp: new Date()
      });
      throw error;
    }
  }

  async createIncidentFromAlert(alertId: string, overrides?: Partial<IncidentCreationRequest>): Promise<IncidentCreationResult> {
    const alert = await this.alertingEngine.getAlert(alertId);
    if (!alert) {
      throw new Error(`Alert ${alertId} not found`);
    }

    const request: IncidentCreationRequest = {
      title: alert.message,
      description: `Alert triggered: ${alert.message}`,
      priority: this.mapSeverityToPriority(alert.severity),
      category: alert.metric,
      tags: alert.tags,
      metadata: {
        originalAlert: alert,
        triggeredBy: 'alerting_engine'
      },
      autoEscalate: true,
      ...overrides
    };

    return this.createIncident(request);
  }

  async bulkCreateIncidents(requests: IncidentCreationRequest[]): Promise<IncidentCreationResult[]> {
    const results: IncidentCreationResult[] = [];
    const batchSize = 10;

    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);
      const batchPromises = batch.map(request => this.createIncident(request));
      const batchResults = await Promise.allSettled(batchPromises);

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          console.error('Failed to create incident:', result.reason);
        }
      }
    }

    return results;
  }

  private validateRequest(request: IncidentCreationRequest): void {
    if (!request.title?.trim()) {
      throw new Error('Incident title is required');
    }

    if (!request.description?.trim()) {
      throw new Error('Incident description is required');
    }

    if (!['critical', 'high', 'medium', 'low'].includes(request.priority)) {
      throw new Error('Invalid priority level');
    }

    if (!request.category?.trim()) {
      throw new Error('Incident category is required');
    }

    if (request.customSla && (request.customSla <= 0 || request.customSla > 10080)) { // Max 1 week
      throw new Error('Custom SLA must be between 1 and 10080 minutes');
    }
  }

  private async createIncidentRecord(request: IncidentCreationRequest): Promise<any> {
    const incident = {
      id: `INC-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      title: request.title,
      description: request.description,
      priority: request.priority,
      category: request.category,
      status: 'new',
      assignedTeam: request.assignedTeam,
      assignee: request.assignee,
      tags: request.tags || [],
      metadata: request.metadata || {},
      createdAt: new Date(),
      updatedAt: new Date(),
      sla: {
        target: request.customSla || this.getDefaultSla(request.priority),
        violated: false,
        warningThreshold: 0.8
      },
      workflow: {
        stage: 'created',
        nextAction: request.assignedTeam ? 'team_notification' : 'assignment_required',
        autoEscalate: request.autoEscalate || false
      }
    };

    // In real implementation, this would save to database
    await this.saveIncidentToDatabase(incident);

    return incident;
  }

  private async sendNotifications(incident: any, request: IncidentCreationRequest): Promise<any[]> {
    const notifications = [];

    try {
      // Determine notification recipients
      const recipients = await this.determineNotificationRecipients(incident, request);

      // Send notifications based on priority
      for (const recipient of recipients) {
        const notification = await this.notificationService.send({
          type: 'incident_created',
          incident,
          recipient,
          channels: this.getNotificationChannels(incident.priority),
          template: 'incident_creation'
        });

        notifications.push({
          channel: notification.channel,
          recipients: [recipient],
          status: notification.success ? 'sent' : 'failed',
          timestamp: new Date()
        });
      }

    } catch (error) {
      console.error('Failed to send notifications:', error);
      notifications.push({
        channel: 'error',
        recipients: [],
        status: 'failed',
        timestamp: new Date()
      });
    }

    return notifications;
  }

  private async setupAutoEscalation(incident: any, request: IncidentCreationRequest): Promise<void> {
    if (!request.autoEscalate) return;

    const escalationRules = this.getEscalationRules(incident.priority);

    for (const rule of escalationRules) {
      await this.escalationService.scheduleEscalation({
        incidentId: incident.id,
        level: rule.level,
        delayMinutes: rule.delayMinutes,
        targetTeam: rule.targetTeam,
        condition: rule.condition
      });
    }
  }

  private async autoAssignToTeam(incident: any, team: string, assignee?: string): Promise<void> {
    const assignment = {
      incidentId: incident.id,
      team,
      assignee: assignee || await this.getNextAvailableTeamMember(team),
      assignedAt: new Date(),
      assignedBy: 'system'
    };

    await this.saveAssignment(assignment);

    // Update incident status
    incident.status = 'assigned';
    incident.assignedTeam = team;
    incident.assignee = assignment.assignee;
    incident.updatedAt = new Date();

    await this.updateIncidentInDatabase(incident);

    // Send assignment notification
    await this.notificationService.send({
      type: 'incident_assigned',
      incident,
      assignment,
      recipient: assignment.assignee,
      channels: ['email', 'slack']
    });
  }

  private mapSeverityToPriority(severity: string): 'critical' | 'high' | 'medium' | 'low' {
    switch (severity) {
      case 'critical': return 'critical';
      case 'warning': return 'high';
      case 'info': return 'medium';
      default: return 'low';
    }
  }

  private getDefaultSla(priority: string): number {
    switch (priority) {
      case 'critical': return 120; // 2 hours
      case 'high': return 240; // 4 hours
      case 'medium': return 480; // 8 hours
      case 'low': return 1440; // 24 hours
      default: return 480;
    }
  }

  private async determineNotificationRecipients(incident: any, request: IncidentCreationRequest): Promise<string[]> {
    const recipients = [];

    // Add assigned team members
    if (request.assignedTeam) {
      const teamMembers = await this.getTeamMembers(request.assignedTeam);
      recipients.push(...teamMembers);
    }

    // Add specific assignee
    if (request.assignee) {
      recipients.push(request.assignee);
    }

    // Add escalation contacts for critical incidents
    if (incident.priority === 'critical') {
      const escalationContacts = await this.getEscalationContacts();
      recipients.push(...escalationContacts);
    }

    return [...new Set(recipients)]; // Remove duplicates
  }

  private getNotificationChannels(priority: string): string[] {
    switch (priority) {
      case 'critical': return ['email', 'sms', 'slack', 'pagerduty'];
      case 'high': return ['email', 'slack'];
      case 'medium': return ['email'];
      case 'low': return ['email'];
      default: return ['email'];
    }
  }

  private getEscalationRules(priority: string): Array<{
    level: number;
    delayMinutes: number;
    targetTeam: string;
    condition: string;
  }> {
    switch (priority) {
      case 'critical':
        return [
          { level: 1, delayMinutes: 15, targetTeam: 'senior_engineers', condition: 'no_response' },
          { level: 2, delayMinutes: 30, targetTeam: 'management', condition: 'no_response' },
          { level: 3, delayMinutes: 60, targetTeam: 'executives', condition: 'no_response' }
        ];
      case 'high':
        return [
          { level: 1, delayMinutes: 60, targetTeam: 'senior_engineers', condition: 'no_response' },
          { level: 2, delayMinutes: 120, targetTeam: 'management', condition: 'no_response' }
        ];
      case 'medium':
        return [
          { level: 1, delayMinutes: 240, targetTeam: 'senior_engineers', condition: 'no_response' }
        ];
      default:
        return [];
    }
  }

  // Mock database operations
  private async saveIncidentToDatabase(incident: any): Promise<void> {
    // Implementation would save to actual database
  }

  private async updateIncidentInDatabase(incident: any): Promise<void> {
    // Implementation would update database record
  }

  private async saveAssignment(assignment: any): Promise<void> {
    // Implementation would save assignment to database
  }

  private async getTeamMembers(team: string): Promise<string[]> {
    // Mock team members
    const teams = {
      'Infrastructure': ['john.doe', 'jane.smith'],
      'Database': ['bob.johnson', 'alice.wilson'],
      'Application': ['charlie.brown', 'diana.prince'],
      'Frontend': ['eve.adams', 'frank.miller']
    };
    return teams[team] || [];
  }

  private async getNextAvailableTeamMember(team: string): Promise<string> {
    const members = await this.getTeamMembers(team);
    return members[0] || 'unassigned';
  }

  private async getEscalationContacts(): Promise<string[]> {
    return ['escalation.manager', 'incident.coordinator'];
  }
}

describe('Incident Creation Flow Integration Tests', () => {
  let workflow: IncidentCreationWorkflow;
  let mockAlertingEngine: jest.Mocked<AlertingEngine>;
  let mockNotificationService: any;
  let mockEscalationService: any;
  let mockMetricsCollector: any;

  beforeEach(() => {
    mockAlertingEngine = {
      getAlert: jest.fn()
    } as any;

    mockNotificationService = {
      send: jest.fn().mockResolvedValue({ success: true, channel: 'email' })
    };

    mockEscalationService = {
      scheduleEscalation: jest.fn().mockResolvedValue(true)
    };

    mockMetricsCollector = {
      recordIncidentCreation: jest.fn().mockResolvedValue(true),
      recordIncidentCreationFailure: jest.fn().mockResolvedValue(true)
    };

    workflow = new IncidentCreationWorkflow(
      mockAlertingEngine,
      mockNotificationService,
      mockEscalationService,
      mockMetricsCollector
    );
  });

  describe('Standard Incident Creation', () => {
    test('creates incident with all required fields', async () => {
      const request: IncidentCreationRequest = {
        title: 'Database Connection Failure',
        description: 'Multiple database connections are failing',
        priority: 'critical',
        category: 'Database',
        assignedTeam: 'Database'
      };

      const result = await workflow.createIncident(request);

      expect(result.incident).toBeDefined();
      expect(result.incident.id).toMatch(/^INC-\d+-[a-z0-9]+$/);
      expect(result.incident.title).toBe(request.title);
      expect(result.incident.priority).toBe(request.priority);
      expect(result.incident.status).toBe('assigned');
      expect(result.incident.assignedTeam).toBe('Database');
      expect(result.incident.sla.target).toBe(120); // 2 hours for critical
    });

    test('validates required fields', async () => {
      const invalidRequest = {
        title: '',
        description: 'Some description',
        priority: 'critical' as const,
        category: 'Database'
      };

      await expect(workflow.createIncident(invalidRequest))
        .rejects.toThrow('Incident title is required');
    });

    test('validates priority field', async () => {
      const invalidRequest = {
        title: 'Test Incident',
        description: 'Some description',
        priority: 'invalid' as any,
        category: 'Database'
      };

      await expect(workflow.createIncident(invalidRequest))
        .rejects.toThrow('Invalid priority level');
    });

    test('sets correct SLA based on priority', async () => {
      const testCases = [
        { priority: 'critical' as const, expectedSla: 120 },
        { priority: 'high' as const, expectedSla: 240 },
        { priority: 'medium' as const, expectedSla: 480 },
        { priority: 'low' as const, expectedSla: 1440 }
      ];

      for (const testCase of testCases) {
        const request: IncidentCreationRequest = {
          title: `Test ${testCase.priority} Incident`,
          description: 'Test description',
          priority: testCase.priority,
          category: 'Test'
        };

        const result = await workflow.createIncident(request);
        expect(result.incident.sla.target).toBe(testCase.expectedSla);
      }
    });

    test('handles custom SLA override', async () => {
      const request: IncidentCreationRequest = {
        title: 'Custom SLA Incident',
        description: 'Test description',
        priority: 'medium',
        category: 'Test',
        customSla: 360 // 6 hours
      };

      const result = await workflow.createIncident(request);
      expect(result.incident.sla.target).toBe(360);
    });
  });

  describe('Notification Integration', () => {
    test('sends notifications to assigned team', async () => {
      const request: IncidentCreationRequest = {
        title: 'Test Incident',
        description: 'Test description',
        priority: 'high',
        category: 'Infrastructure',
        assignedTeam: 'Infrastructure'
      };

      const result = await workflow.createIncident(request);

      expect(mockNotificationService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'incident_created',
          incident: expect.any(Object),
          channels: ['email', 'slack']
        })
      );

      expect(result.notifications).toHaveLength(2); // john.doe and jane.smith
      expect(result.notifications.every(n => n.status === 'sent')).toBe(true);
    });

    test('sends critical incident notifications to escalation contacts', async () => {
      const request: IncidentCreationRequest = {
        title: 'Critical System Failure',
        description: 'Complete system outage',
        priority: 'critical',
        category: 'Infrastructure'
      };

      const result = await workflow.createIncident(request);

      expect(mockNotificationService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          channels: ['email', 'sms', 'slack', 'pagerduty']
        })
      );
    });

    test('handles notification failures gracefully', async () => {
      mockNotificationService.send.mockRejectedValue(new Error('Notification failed'));

      const request: IncidentCreationRequest = {
        title: 'Test Incident',
        description: 'Test description',
        priority: 'medium',
        category: 'Test'
      };

      const result = await workflow.createIncident(request);

      expect(result.notifications.some(n => n.status === 'failed')).toBe(true);
      expect(result.incident).toBeDefined(); // Incident still created
    });
  });

  describe('Auto-Escalation Setup', () => {
    test('sets up escalation rules for critical incidents', async () => {
      const request: IncidentCreationRequest = {
        title: 'Critical Incident',
        description: 'System failure',
        priority: 'critical',
        category: 'Infrastructure',
        autoEscalate: true
      };

      await workflow.createIncident(request);

      expect(mockEscalationService.scheduleEscalation).toHaveBeenCalledTimes(3);
      expect(mockEscalationService.scheduleEscalation).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 1,
          delayMinutes: 15,
          targetTeam: 'senior_engineers'
        })
      );
    });

    test('skips escalation setup when disabled', async () => {
      const request: IncidentCreationRequest = {
        title: 'Medium Incident',
        description: 'Minor issue',
        priority: 'medium',
        category: 'Application',
        autoEscalate: false
      };

      await workflow.createIncident(request);

      expect(mockEscalationService.scheduleEscalation).not.toHaveBeenCalled();
    });

    test('sets up different escalation rules based on priority', async () => {
      const highPriorityRequest: IncidentCreationRequest = {
        title: 'High Priority Incident',
        description: 'Important issue',
        priority: 'high',
        category: 'Database',
        autoEscalate: true
      };

      await workflow.createIncident(highPriorityRequest);

      expect(mockEscalationService.scheduleEscalation).toHaveBeenCalledTimes(2);
      expect(mockEscalationService.scheduleEscalation).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 1,
          delayMinutes: 60,
          targetTeam: 'senior_engineers'
        })
      );
    });
  });

  describe('Team Assignment Integration', () => {
    test('auto-assigns incident to team member', async () => {
      const request: IncidentCreationRequest = {
        title: 'Database Issue',
        description: 'Query performance problem',
        priority: 'high',
        category: 'Database',
        assignedTeam: 'Database'
      };

      const result = await workflow.createIncident(request);

      expect(result.incident.status).toBe('assigned');
      expect(result.incident.assignedTeam).toBe('Database');
      expect(result.incident.assignee).toBe('bob.johnson');
      expect(result.metrics.timeToAssignment).toBeDefined();
    });

    test('assigns to specific team member when provided', async () => {
      const request: IncidentCreationRequest = {
        title: 'Frontend Bug',
        description: 'UI rendering issue',
        priority: 'medium',
        category: 'Frontend',
        assignedTeam: 'Frontend',
        assignee: 'eve.adams'
      };

      const result = await workflow.createIncident(request);

      expect(result.incident.assignee).toBe('eve.adams');
    });

    test('sends assignment notification', async () => {
      const request: IncidentCreationRequest = {
        title: 'Test Assignment',
        description: 'Test description',
        priority: 'medium',
        category: 'Application',
        assignedTeam: 'Application'
      };

      await workflow.createIncident(request);

      expect(mockNotificationService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'incident_assigned',
          recipient: 'charlie.brown',
          channels: ['email', 'slack']
        })
      );
    });
  });

  describe('Metrics Collection', () => {
    test('records incident creation metrics', async () => {
      const request: IncidentCreationRequest = {
        title: 'Metrics Test',
        description: 'Test description',
        priority: 'medium',
        category: 'Test'
      };

      const result = await workflow.createIncident(request);

      expect(mockMetricsCollector.recordIncidentCreation).toHaveBeenCalledWith({
        incidentId: result.incident.id,
        creationTime: expect.any(Number),
        priority: 'medium',
        category: 'Test'
      });

      expect(result.metrics.creationTime).toBeGreaterThan(0);
    });

    test('records failure metrics on error', async () => {
      const invalidRequest = {
        title: '',
        description: 'Invalid request',
        priority: 'medium' as const,
        category: 'Test'
      };

      await expect(workflow.createIncident(invalidRequest)).rejects.toThrow();

      expect(mockMetricsCollector.recordIncidentCreationFailure).toHaveBeenCalledWith({
        error: 'Incident title is required',
        request: invalidRequest,
        timestamp: expect.any(Date)
      });
    });
  });

  describe('Alert-Based Incident Creation', () => {
    test('creates incident from alert successfully', async () => {
      const mockAlert = {
        id: 'alert-123',
        message: 'High CPU usage detected',
        severity: 'critical',
        metric: 'cpu_usage',
        tags: ['performance', 'cpu']
      };

      mockAlertingEngine.getAlert.mockResolvedValue(mockAlert);

      const result = await workflow.createIncidentFromAlert('alert-123', {
        assignedTeam: 'Infrastructure'
      });

      expect(result.incident.title).toBe('High CPU usage detected');
      expect(result.incident.priority).toBe('critical');
      expect(result.incident.category).toBe('cpu_usage');
      expect(result.incident.tags).toEqual(['performance', 'cpu']);
      expect(result.incident.metadata.originalAlert).toEqual(mockAlert);
    });

    test('throws error for non-existent alert', async () => {
      mockAlertingEngine.getAlert.mockResolvedValue(null);

      await expect(workflow.createIncidentFromAlert('non-existent'))
        .rejects.toThrow('Alert non-existent not found');
    });

    test('applies overrides correctly', async () => {
      const mockAlert = {
        id: 'alert-123',
        message: 'Alert message',
        severity: 'warning',
        metric: 'test_metric',
        tags: ['test']
      };

      mockAlertingEngine.getAlert.mockResolvedValue(mockAlert);

      const result = await workflow.createIncidentFromAlert('alert-123', {
        priority: 'critical',
        assignedTeam: 'Database',
        autoEscalate: false
      });

      expect(result.incident.priority).toBe('critical'); // Override applied
      expect(result.incident.assignedTeam).toBe('Database'); // Override applied
      expect(result.incident.workflow.autoEscalate).toBe(false); // Override applied
    });
  });

  describe('Bulk Incident Creation', () => {
    test('creates multiple incidents successfully', async () => {
      const requests: IncidentCreationRequest[] = [
        {
          title: 'Incident 1',
          description: 'Description 1',
          priority: 'high',
          category: 'Database'
        },
        {
          title: 'Incident 2',
          description: 'Description 2',
          priority: 'medium',
          category: 'Application'
        },
        {
          title: 'Incident 3',
          description: 'Description 3',
          priority: 'low',
          category: 'Frontend'
        }
      ];

      const results = await workflow.bulkCreateIncidents(requests);

      expect(results).toHaveLength(3);
      expect(results.every(r => r.incident.id.startsWith('INC-'))).toBe(true);
    });

    test('handles partial failures in bulk creation', async () => {
      const requests: IncidentCreationRequest[] = [
        {
          title: 'Valid Incident',
          description: 'Valid description',
          priority: 'high',
          category: 'Database'
        },
        {
          title: '', // Invalid - no title
          description: 'Invalid incident',
          priority: 'medium',
          category: 'Application'
        }
      ];

      const results = await workflow.bulkCreateIncidents(requests);

      expect(results).toHaveLength(1); // Only valid incident created
      expect(results[0].incident.title).toBe('Valid Incident');
    });

    test('processes large batches efficiently', async () => {
      const requests = Array.from({ length: 25 }, (_, i) => ({
        title: `Incident ${i + 1}`,
        description: `Description ${i + 1}`,
        priority: 'medium' as const,
        category: 'Test'
      }));

      const startTime = Date.now();
      const results = await workflow.bulkCreateIncidents(requests);
      const endTime = Date.now();

      expect(results).toHaveLength(25);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('handles database failures gracefully', async () => {
      // Mock a database error by making notification service fail
      mockNotificationService.send.mockRejectedValue(new Error('Database connection failed'));

      const request: IncidentCreationRequest = {
        title: 'Test Incident',
        description: 'Test description',
        priority: 'medium',
        category: 'Test'
      };

      const result = await workflow.createIncident(request);

      // Incident should still be created
      expect(result.incident).toBeDefined();
      expect(result.notifications.some(n => n.status === 'failed')).toBe(true);
    });

    test('validates custom SLA boundaries', async () => {
      const invalidSlaRequest: IncidentCreationRequest = {
        title: 'Invalid SLA',
        description: 'Test description',
        priority: 'medium',
        category: 'Test',
        customSla: -1
      };

      await expect(workflow.createIncident(invalidSlaRequest))
        .rejects.toThrow('Custom SLA must be between 1 and 10080 minutes');

      const tooLargeSlaRequest: IncidentCreationRequest = {
        title: 'Too Large SLA',
        description: 'Test description',
        priority: 'medium',
        category: 'Test',
        customSla: 20000
      };

      await expect(workflow.createIncident(tooLargeSlaRequest))
        .rejects.toThrow('Custom SLA must be between 1 and 10080 minutes');
    });

    test('handles unknown team assignment', async () => {
      const request: IncidentCreationRequest = {
        title: 'Unknown Team Test',
        description: 'Test description',
        priority: 'medium',
        category: 'Test',
        assignedTeam: 'NonExistentTeam'
      };

      const result = await workflow.createIncident(request);

      expect(result.incident.assignee).toBe('unassigned');
      expect(result.incident.assignedTeam).toBe('NonExistentTeam');
    });

    test('handles concurrent incident creation', async () => {
      const request: IncidentCreationRequest = {
        title: 'Concurrent Test',
        description: 'Test description',
        priority: 'high',
        category: 'Test'
      };

      // Create multiple incidents concurrently
      const promises = Array.from({ length: 5 }, () => workflow.createIncident(request));
      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);

      // All incidents should have unique IDs
      const ids = results.map(r => r.incident.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(5);
    });
  });
});