import { jest } from '@jest/globals';

// Incident status update workflow
interface IncidentStatusUpdate {
  incidentId: string;
  newStatus: 'new' | 'assigned' | 'in_progress' | 'blocked' | 'resolved' | 'closed';
  updatedBy: string;
  comment?: string;
  resolution?: {
    type: 'fixed' | 'workaround' | 'duplicate' | 'not_reproducible' | 'by_design';
    description: string;
    rootCause?: string;
    preventionMeasures?: string[];
  };
  metadata?: Record<string, any>;
}

interface StatusUpdateResult {
  incident: any;
  statusHistory: Array<{
    previousStatus: string;
    newStatus: string;
    updatedBy: string;
    timestamp: Date;
    comment?: string;
  }>;
  notifications: Array<{
    recipient: string;
    channel: string;
    status: 'sent' | 'failed';
  }>;
  slaImpact: {
    wasViolated: boolean;
    remainingTime: number;
    riskLevel: 'low' | 'medium' | 'high';
  };
  validationResults: {
    valid: boolean;
    errors: string[];
    warnings: string[];
  };
}

class IncidentStatusUpdateWorkflow {
  constructor(
    private incidentService: any,
    private notificationService: any,
    private slaService: any,
    private auditService: any,
    private workflowService: any
  ) {}

  async updateIncidentStatus(update: IncidentStatusUpdate): Promise<StatusUpdateResult> {
    // Validate the update request
    const validation = await this.validateStatusUpdate(update);
    if (!validation.valid) {
      throw new Error(`Status update validation failed: ${validation.errors.join(', ')}`);
    }

    // Get current incident
    const currentIncident = await this.incidentService.getIncident(update.incidentId);
    if (!currentIncident) {
      throw new Error(`Incident ${update.incidentId} not found`);
    }

    // Check if status transition is allowed
    const transitionValidation = this.validateStatusTransition(
      currentIncident.status,
      update.newStatus,
      currentIncident
    );

    if (!transitionValidation.valid) {
      throw new Error(`Invalid status transition: ${transitionValidation.errors.join(', ')}`);
    }

    try {
      // Update incident status
      const updatedIncident = await this.updateIncidentRecord(currentIncident, update);

      // Create status history entry
      const statusHistory = await this.createStatusHistoryEntry(currentIncident, update);

      // Check SLA impact
      const slaImpact = await this.calculateSlaImpact(updatedIncident, update);

      // Send notifications
      const notifications = await this.sendStatusUpdateNotifications(updatedIncident, update);

      // Execute workflow actions
      await this.executeWorkflowActions(updatedIncident, update);

      // Record audit entry
      await this.recordAuditEntry(updatedIncident, update);

      return {
        incident: updatedIncident,
        statusHistory: [statusHistory],
        notifications,
        slaImpact,
        validationResults: validation
      };

    } catch (error) {
      // Rollback if needed and log error
      await this.handleUpdateError(update, error);
      throw error;
    }
  }

  async bulkUpdateStatus(updates: IncidentStatusUpdate[]): Promise<StatusUpdateResult[]> {
    const results: StatusUpdateResult[] = [];
    const errors: Array<{ update: IncidentStatusUpdate; error: string }> = [];

    for (const update of updates) {
      try {
        const result = await this.updateIncidentStatus(update);
        results.push(result);
      } catch (error) {
        errors.push({ update, error: error.message });
      }
    }

    if (errors.length > 0) {
      console.warn(`${errors.length} bulk status updates failed:`, errors);
    }

    return results;
  }

  async getStatusTransitionHistory(incidentId: string): Promise<Array<{
    fromStatus: string;
    toStatus: string;
    updatedBy: string;
    timestamp: Date;
    comment?: string;
    duration: number;
  }>> {
    return this.auditService.getStatusHistory(incidentId);
  }

  async getValidStatusTransitions(incidentId: string): Promise<string[]> {
    const incident = await this.incidentService.getIncident(incidentId);
    if (!incident) {
      throw new Error(`Incident ${incidentId} not found`);
    }

    return this.getAvailableStatusTransitions(incident.status, incident);
  }

  private async validateStatusUpdate(update: IncidentStatusUpdate): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required fields
    if (!update.incidentId) {
      errors.push('Incident ID is required');
    }

    if (!update.newStatus) {
      errors.push('New status is required');
    }

    if (!update.updatedBy) {
      errors.push('Updated by user is required');
    }

    // Validate status value
    const validStatuses = ['new', 'assigned', 'in_progress', 'blocked', 'resolved', 'closed'];
    if (update.newStatus && !validStatuses.includes(update.newStatus)) {
      errors.push(`Invalid status: ${update.newStatus}`);
    }

    // Check resolution requirements
    if (update.newStatus === 'resolved' && !update.resolution) {
      errors.push('Resolution details are required when resolving an incident');
    }

    if (update.resolution) {
      if (!update.resolution.type) {
        errors.push('Resolution type is required');
      }
      if (!update.resolution.description?.trim()) {
        errors.push('Resolution description is required');
      }
    }

    // Check user permissions
    const hasPermission = await this.checkUserPermissions(update.updatedBy, update.newStatus);
    if (!hasPermission) {
      errors.push(`User ${update.updatedBy} does not have permission to set status to ${update.newStatus}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  private validateStatusTransition(
    currentStatus: string,
    newStatus: string,
    incident: any
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // No change
    if (currentStatus === newStatus) {
      errors.push('New status must be different from current status');
      return { valid: false, errors };
    }

    // Define valid transitions
    const validTransitions: Record<string, string[]> = {
      'new': ['assigned', 'in_progress', 'closed'],
      'assigned': ['in_progress', 'blocked', 'resolved', 'closed'],
      'in_progress': ['blocked', 'resolved', 'assigned'],
      'blocked': ['in_progress', 'assigned'],
      'resolved': ['closed', 'in_progress'], // Can reopen
      'closed': [] // Final status
    };

    const allowedTransitions = validTransitions[currentStatus] || [];
    if (!allowedTransitions.includes(newStatus)) {
      errors.push(`Cannot transition from ${currentStatus} to ${newStatus}`);
    }

    // Additional business rules
    if (newStatus === 'resolved' && !incident.assignee) {
      errors.push('Incident must be assigned before it can be resolved');
    }

    if (newStatus === 'closed' && currentStatus !== 'resolved') {
      errors.push('Incident must be resolved before it can be closed');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  private async updateIncidentRecord(currentIncident: any, update: IncidentStatusUpdate): Promise<any> {
    const updatedIncident = {
      ...currentIncident,
      status: update.newStatus,
      updatedBy: update.updatedBy,
      updatedAt: new Date()
    };

    // Add resolution details if resolving
    if (update.newStatus === 'resolved' && update.resolution) {
      updatedIncident.resolution = {
        ...update.resolution,
        resolvedAt: new Date(),
        resolvedBy: update.updatedBy
      };
      updatedIncident.resolvedAt = new Date();
    }

    // Add closure details if closing
    if (update.newStatus === 'closed') {
      updatedIncident.closedAt = new Date();
      updatedIncident.closedBy = update.updatedBy;
    }

    // Update workflow stage
    updatedIncident.workflow = {
      ...updatedIncident.workflow,
      stage: this.mapStatusToWorkflowStage(update.newStatus),
      lastUpdate: new Date()
    };

    // Save to database
    await this.incidentService.updateIncident(updatedIncident.id, updatedIncident);

    return updatedIncident;
  }

  private async createStatusHistoryEntry(currentIncident: any, update: IncidentStatusUpdate): Promise<any> {
    const historyEntry = {
      incidentId: update.incidentId,
      previousStatus: currentIncident.status,
      newStatus: update.newStatus,
      updatedBy: update.updatedBy,
      timestamp: new Date(),
      comment: update.comment,
      metadata: update.metadata
    };

    await this.auditService.recordStatusChange(historyEntry);
    return historyEntry;
  }

  private async calculateSlaImpact(incident: any, update: IncidentStatusUpdate): Promise<{
    wasViolated: boolean;
    remainingTime: number;
    riskLevel: 'low' | 'medium' | 'high';
  }> {
    return this.slaService.calculateImpact(incident, update);
  }

  private async sendStatusUpdateNotifications(incident: any, update: IncidentStatusUpdate): Promise<Array<{
    recipient: string;
    channel: string;
    status: 'sent' | 'failed';
  }>> {
    const notifications = [];

    try {
      // Determine who should be notified
      const recipients = await this.getNotificationRecipients(incident, update);

      for (const recipient of recipients) {
        const channels = this.getNotificationChannels(incident.priority, update.newStatus);

        for (const channel of channels) {
          try {
            await this.notificationService.send({
              type: 'status_update',
              incident,
              update,
              recipient,
              channel,
              template: `status_update_${update.newStatus}`
            });

            notifications.push({
              recipient,
              channel,
              status: 'sent'
            });
          } catch (error) {
            notifications.push({
              recipient,
              channel,
              status: 'failed'
            });
          }
        }
      }
    } catch (error) {
      console.error('Failed to send notifications:', error);
    }

    return notifications;
  }

  private async executeWorkflowActions(incident: any, update: IncidentStatusUpdate): Promise<void> {
    const actions = this.getWorkflowActions(update.newStatus, incident);

    for (const action of actions) {
      try {
        await this.workflowService.executeAction(action, incident, update);
      } catch (error) {
        console.error(`Failed to execute workflow action ${action.type}:`, error);
      }
    }
  }

  private async recordAuditEntry(incident: any, update: IncidentStatusUpdate): Promise<void> {
    await this.auditService.recordEvent({
      type: 'status_update',
      incidentId: incident.id,
      userId: update.updatedBy,
      timestamp: new Date(),
      details: {
        previousStatus: incident.status,
        newStatus: update.newStatus,
        comment: update.comment,
        resolution: update.resolution
      }
    });
  }

  private async handleUpdateError(update: IncidentStatusUpdate, error: any): Promise<void> {
    await this.auditService.recordError({
      type: 'status_update_error',
      incidentId: update.incidentId,
      userId: update.updatedBy,
      timestamp: new Date(),
      error: error.message,
      update
    });
  }

  private getAvailableStatusTransitions(currentStatus: string, incident: any): string[] {
    const validTransitions: Record<string, string[]> = {
      'new': ['assigned', 'in_progress', 'closed'],
      'assigned': ['in_progress', 'blocked', 'resolved', 'closed'],
      'in_progress': ['blocked', 'resolved', 'assigned'],
      'blocked': ['in_progress', 'assigned'],
      'resolved': ['closed', 'in_progress'],
      'closed': []
    };

    let available = validTransitions[currentStatus] || [];

    // Apply business rules
    if (!incident.assignee) {
      available = available.filter(status => status !== 'resolved');
    }

    return available;
  }

  private mapStatusToWorkflowStage(status: string): string {
    const mapping = {
      'new': 'created',
      'assigned': 'assigned',
      'in_progress': 'working',
      'blocked': 'blocked',
      'resolved': 'resolved',
      'closed': 'closed'
    };

    return mapping[status] || 'unknown';
  }

  private async getNotificationRecipients(incident: any, update: IncidentStatusUpdate): Promise<string[]> {
    const recipients = [];

    // Always notify assignee
    if (incident.assignee) {
      recipients.push(incident.assignee);
    }

    // Notify team for certain status changes
    if (['resolved', 'closed'].includes(update.newStatus) && incident.assignedTeam) {
      const teamMembers = await this.getTeamMembers(incident.assignedTeam);
      recipients.push(...teamMembers);
    }

    // Notify escalation contacts for critical incidents
    if (incident.priority === 'critical' && ['blocked', 'resolved'].includes(update.newStatus)) {
      const escalationContacts = await this.getEscalationContacts();
      recipients.push(...escalationContacts);
    }

    // Notify stakeholders for resolution/closure
    if (['resolved', 'closed'].includes(update.newStatus)) {
      const stakeholders = await this.getIncidentStakeholders(incident.id);
      recipients.push(...stakeholders);
    }

    return [...new Set(recipients)]; // Remove duplicates
  }

  private getNotificationChannels(priority: string, newStatus: string): string[] {
    if (newStatus === 'resolved' || newStatus === 'closed') {
      switch (priority) {
        case 'critical': return ['email', 'slack', 'dashboard'];
        case 'high': return ['email', 'slack'];
        case 'medium': return ['email'];
        case 'low': return ['dashboard'];
        default: return ['email'];
      }
    }

    if (newStatus === 'blocked') {
      switch (priority) {
        case 'critical': return ['email', 'slack', 'sms'];
        case 'high': return ['email', 'slack'];
        default: return ['email'];
      }
    }

    return ['email'];
  }

  private getWorkflowActions(newStatus: string, incident: any): Array<{
    type: string;
    config: any;
  }> {
    const actions = [];

    switch (newStatus) {
      case 'resolved':
        actions.push(
          { type: 'calculate_resolution_time', config: {} },
          { type: 'update_metrics', config: {} },
          { type: 'check_related_incidents', config: {} }
        );
        break;

      case 'closed':
        actions.push(
          { type: 'update_metrics', config: {} },
          { type: 'archive_incident', config: { delay: '30d' } },
          { type: 'cleanup_resources', config: {} }
        );
        break;

      case 'blocked':
        actions.push(
          { type: 'escalate_if_critical', config: {} },
          { type: 'schedule_followup', config: { delay: '2h' } }
        );
        break;

      case 'in_progress':
        actions.push(
          { type: 'start_timer', config: {} },
          { type: 'check_sla_risk', config: {} }
        );
        break;
    }

    return actions;
  }

  private async checkUserPermissions(userId: string, newStatus: string): Promise<boolean> {
    // Mock permission check - in real implementation, this would check actual permissions
    const restrictedStatuses = ['closed'];
    const adminUsers = ['admin', 'incident.manager'];

    if (restrictedStatuses.includes(newStatus)) {
      return adminUsers.includes(userId);
    }

    return true; // Most status changes are allowed
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

  private async getEscalationContacts(): Promise<string[]> {
    return ['escalation.manager', 'incident.coordinator'];
  }

  private async getIncidentStakeholders(incidentId: string): Promise<string[]> {
    // Mock stakeholders - would be from database
    return ['stakeholder1', 'stakeholder2'];
  }
}

describe('Incident Status Update Flow Integration Tests', () => {
  let workflow: IncidentStatusUpdateWorkflow;
  let mockIncidentService: any;
  let mockNotificationService: any;
  let mockSlaService: any;
  let mockAuditService: any;
  let mockWorkflowService: any;

  beforeEach(() => {
    mockIncidentService = {
      getIncident: jest.fn(),
      updateIncident: jest.fn().mockResolvedValue(true)
    };

    mockNotificationService = {
      send: jest.fn().mockResolvedValue(true)
    };

    mockSlaService = {
      calculateImpact: jest.fn().mockResolvedValue({
        wasViolated: false,
        remainingTime: 3600000,
        riskLevel: 'low'
      })
    };

    mockAuditService = {
      recordStatusChange: jest.fn().mockResolvedValue(true),
      recordEvent: jest.fn().mockResolvedValue(true),
      recordError: jest.fn().mockResolvedValue(true),
      getStatusHistory: jest.fn().mockResolvedValue([])
    };

    mockWorkflowService = {
      executeAction: jest.fn().mockResolvedValue(true)
    };

    workflow = new IncidentStatusUpdateWorkflow(
      mockIncidentService,
      mockNotificationService,
      mockSlaService,
      mockAuditService,
      mockWorkflowService
    );
  });

  const mockIncident = {
    id: 'INC-001',
    title: 'Test Incident',
    status: 'assigned',
    priority: 'high',
    assignee: 'john.doe',
    assignedTeam: 'Infrastructure',
    createdAt: new Date(),
    workflow: { stage: 'assigned' }
  };

  describe('Valid Status Updates', () => {
    beforeEach(() => {
      mockIncidentService.getIncident.mockResolvedValue(mockIncident);
    });

    test('updates incident from assigned to in_progress', async () => {
      const update: IncidentStatusUpdate = {
        incidentId: 'INC-001',
        newStatus: 'in_progress',
        updatedBy: 'john.doe',
        comment: 'Starting work on the incident'
      };

      const result = await workflow.updateIncidentStatus(update);

      expect(result.incident.status).toBe('in_progress');
      expect(result.incident.updatedBy).toBe('john.doe');
      expect(result.statusHistory).toHaveLength(1);
      expect(result.statusHistory[0].previousStatus).toBe('assigned');
      expect(result.statusHistory[0].newStatus).toBe('in_progress');
    });

    test('resolves incident with resolution details', async () => {
      const workingIncident = { ...mockIncident, status: 'in_progress' };
      mockIncidentService.getIncident.mockResolvedValue(workingIncident);

      const update: IncidentStatusUpdate = {
        incidentId: 'INC-001',
        newStatus: 'resolved',
        updatedBy: 'john.doe',
        comment: 'Issue has been fixed',
        resolution: {
          type: 'fixed',
          description: 'Restarted the service and cleared cache',
          rootCause: 'Memory leak in application code',
          preventionMeasures: ['Add memory monitoring', 'Implement automatic restarts']
        }
      };

      const result = await workflow.updateIncidentStatus(update);

      expect(result.incident.status).toBe('resolved');
      expect(result.incident.resolution).toBeDefined();
      expect(result.incident.resolution.type).toBe('fixed');
      expect(result.incident.resolvedAt).toBeInstanceOf(Date);
      expect(result.incident.resolvedBy).toBe('john.doe');
    });

    test('closes resolved incident', async () => {
      const resolvedIncident = { ...mockIncident, status: 'resolved' };
      mockIncidentService.getIncident.mockResolvedValue(resolvedIncident);

      const update: IncidentStatusUpdate = {
        incidentId: 'INC-001',
        newStatus: 'closed',
        updatedBy: 'admin',
        comment: 'Verified resolution and closing incident'
      };

      const result = await workflow.updateIncidentStatus(update);

      expect(result.incident.status).toBe('closed');
      expect(result.incident.closedAt).toBeInstanceOf(Date);
      expect(result.incident.closedBy).toBe('admin');
    });

    test('blocks incident with appropriate reason', async () => {
      const workingIncident = { ...mockIncident, status: 'in_progress' };
      mockIncidentService.getIncident.mockResolvedValue(workingIncident);

      const update: IncidentStatusUpdate = {
        incidentId: 'INC-001',
        newStatus: 'blocked',
        updatedBy: 'john.doe',
        comment: 'Waiting for database team to provide access',
        metadata: {
          blockingReason: 'missing_access',
          expectedUnblockDate: new Date(Date.now() + 86400000) // Tomorrow
        }
      };

      const result = await workflow.updateIncidentStatus(update);

      expect(result.incident.status).toBe('blocked');
      expect(mockWorkflowService.executeAction).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'escalate_if_critical' }),
        expect.any(Object),
        expect.any(Object)
      );
    });
  });

  describe('Status Transition Validation', () => {
    beforeEach(() => {
      mockIncidentService.getIncident.mockResolvedValue(mockIncident);
    });

    test('rejects invalid status transitions', async () => {
      const update: IncidentStatusUpdate = {
        incidentId: 'INC-001',
        newStatus: 'closed', // Cannot go directly from assigned to closed
        updatedBy: 'john.doe'
      };

      await expect(workflow.updateIncidentStatus(update))
        .rejects.toThrow('Incident must be resolved before it can be closed');
    });

    test('rejects transition from closed status', async () => {
      const closedIncident = { ...mockIncident, status: 'closed' };
      mockIncidentService.getIncident.mockResolvedValue(closedIncident);

      const update: IncidentStatusUpdate = {
        incidentId: 'INC-001',
        newStatus: 'in_progress',
        updatedBy: 'john.doe'
      };

      await expect(workflow.updateIncidentStatus(update))
        .rejects.toThrow('Cannot transition from closed to in_progress');
    });

    test('allows reopening resolved incident', async () => {
      const resolvedIncident = { ...mockIncident, status: 'resolved' };
      mockIncidentService.getIncident.mockResolvedValue(resolvedIncident);

      const update: IncidentStatusUpdate = {
        incidentId: 'INC-001',
        newStatus: 'in_progress',
        updatedBy: 'john.doe',
        comment: 'Issue has reoccurred, reopening incident'
      };

      const result = await workflow.updateIncidentStatus(update);

      expect(result.incident.status).toBe('in_progress');
      expect(result.validationResults.valid).toBe(true);
    });

    test('rejects same status update', async () => {
      const update: IncidentStatusUpdate = {
        incidentId: 'INC-001',
        newStatus: 'assigned', // Same as current status
        updatedBy: 'john.doe'
      };

      await expect(workflow.updateIncidentStatus(update))
        .rejects.toThrow('New status must be different from current status');
    });
  });

  describe('Validation Rules', () => {
    beforeEach(() => {
      mockIncidentService.getIncident.mockResolvedValue(mockIncident);
    });

    test('requires resolution details when resolving', async () => {
      const workingIncident = { ...mockIncident, status: 'in_progress' };
      mockIncidentService.getIncident.mockResolvedValue(workingIncident);

      const update: IncidentStatusUpdate = {
        incidentId: 'INC-001',
        newStatus: 'resolved',
        updatedBy: 'john.doe'
        // Missing resolution details
      };

      await expect(workflow.updateIncidentStatus(update))
        .rejects.toThrow('Resolution details are required when resolving an incident');
    });

    test('validates required fields', async () => {
      const update: IncidentStatusUpdate = {
        incidentId: '',
        newStatus: 'in_progress',
        updatedBy: 'john.doe'
      };

      await expect(workflow.updateIncidentStatus(update))
        .rejects.toThrow('Incident ID is required');
    });

    test('validates status values', async () => {
      const update: IncidentStatusUpdate = {
        incidentId: 'INC-001',
        newStatus: 'invalid_status' as any,
        updatedBy: 'john.doe'
      };

      await expect(workflow.updateIncidentStatus(update))
        .rejects.toThrow('Invalid status: invalid_status');
    });

    test('checks user permissions for restricted operations', async () => {
      const resolvedIncident = { ...mockIncident, status: 'resolved' };
      mockIncidentService.getIncident.mockResolvedValue(resolvedIncident);

      const update: IncidentStatusUpdate = {
        incidentId: 'INC-001',
        newStatus: 'closed',
        updatedBy: 'regular.user' // Not admin
      };

      await expect(workflow.updateIncidentStatus(update))
        .rejects.toThrow('User regular.user does not have permission to set status to closed');
    });
  });

  describe('Notification Integration', () => {
    beforeEach(() => {
      mockIncidentService.getIncident.mockResolvedValue(mockIncident);
    });

    test('sends notifications for status updates', async () => {
      const update: IncidentStatusUpdate = {
        incidentId: 'INC-001',
        newStatus: 'in_progress',
        updatedBy: 'john.doe'
      };

      const result = await workflow.updateIncidentStatus(update);

      expect(mockNotificationService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'status_update',
          incident: expect.any(Object),
          update: expect.any(Object),
          template: 'status_update_in_progress'
        })
      );

      expect(result.notifications.length).toBeGreaterThan(0);
      expect(result.notifications.every(n => n.status === 'sent')).toBe(true);
    });

    test('notifies different recipients based on status change', async () => {
      const criticalIncident = { ...mockIncident, priority: 'critical', status: 'in_progress' };
      mockIncidentService.getIncident.mockResolvedValue(criticalIncident);

      const update: IncidentStatusUpdate = {
        incidentId: 'INC-001',
        newStatus: 'resolved',
        updatedBy: 'john.doe',
        resolution: {
          type: 'fixed',
          description: 'System restored'
        }
      };

      await workflow.updateIncidentStatus(update);

      // Should notify assignee, team, escalation contacts, and stakeholders
      expect(mockNotificationService.send).toHaveBeenCalledTimes(6); // Multiple recipients and channels
    });

    test('handles notification failures gracefully', async () => {
      mockNotificationService.send.mockRejectedValue(new Error('Notification service down'));

      const update: IncidentStatusUpdate = {
        incidentId: 'INC-001',
        newStatus: 'in_progress',
        updatedBy: 'john.doe'
      };

      const result = await workflow.updateIncidentStatus(update);

      expect(result.incident.status).toBe('in_progress'); // Update still succeeds
      expect(result.notifications.some(n => n.status === 'failed')).toBe(true);
    });
  });

  describe('Workflow Actions', () => {
    beforeEach(() => {
      mockIncidentService.getIncident.mockResolvedValue(mockIncident);
    });

    test('executes workflow actions for resolution', async () => {
      const workingIncident = { ...mockIncident, status: 'in_progress' };
      mockIncidentService.getIncident.mockResolvedValue(workingIncident);

      const update: IncidentStatusUpdate = {
        incidentId: 'INC-001',
        newStatus: 'resolved',
        updatedBy: 'john.doe',
        resolution: {
          type: 'fixed',
          description: 'Issue resolved'
        }
      };

      await workflow.updateIncidentStatus(update);

      expect(mockWorkflowService.executeAction).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'calculate_resolution_time' }),
        expect.any(Object),
        expect.any(Object)
      );

      expect(mockWorkflowService.executeAction).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'update_metrics' }),
        expect.any(Object),
        expect.any(Object)
      );

      expect(mockWorkflowService.executeAction).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'check_related_incidents' }),
        expect.any(Object),
        expect.any(Object)
      );
    });

    test('executes closure workflow actions', async () => {
      const resolvedIncident = { ...mockIncident, status: 'resolved' };
      mockIncidentService.getIncident.mockResolvedValue(resolvedIncident);

      const update: IncidentStatusUpdate = {
        incidentId: 'INC-001',
        newStatus: 'closed',
        updatedBy: 'admin'
      };

      await workflow.updateIncidentStatus(update);

      expect(mockWorkflowService.executeAction).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'archive_incident' }),
        expect.any(Object),
        expect.any(Object)
      );
    });

    test('handles workflow action failures gracefully', async () => {
      mockWorkflowService.executeAction.mockRejectedValue(new Error('Workflow action failed'));

      const update: IncidentStatusUpdate = {
        incidentId: 'INC-001',
        newStatus: 'in_progress',
        updatedBy: 'john.doe'
      };

      // Should not throw - workflow action failures are logged but don't fail the update
      const result = await workflow.updateIncidentStatus(update);
      expect(result.incident.status).toBe('in_progress');
    });
  });

  describe('SLA Impact Calculation', () => {
    beforeEach(() => {
      mockIncidentService.getIncident.mockResolvedValue(mockIncident);
    });

    test('calculates SLA impact correctly', async () => {
      mockSlaService.calculateImpact.mockResolvedValue({
        wasViolated: true,
        remainingTime: -3600000, // 1 hour overdue
        riskLevel: 'high'
      });

      const update: IncidentStatusUpdate = {
        incidentId: 'INC-001',
        newStatus: 'in_progress',
        updatedBy: 'john.doe'
      };

      const result = await workflow.updateIncidentStatus(update);

      expect(result.slaImpact.wasViolated).toBe(true);
      expect(result.slaImpact.remainingTime).toBe(-3600000);
      expect(result.slaImpact.riskLevel).toBe('high');
    });
  });

  describe('Bulk Status Updates', () => {
    beforeEach(() => {
      mockIncidentService.getIncident.mockResolvedValue(mockIncident);
    });

    test('processes multiple status updates', async () => {
      const updates: IncidentStatusUpdate[] = [
        {
          incidentId: 'INC-001',
          newStatus: 'in_progress',
          updatedBy: 'john.doe'
        },
        {
          incidentId: 'INC-002',
          newStatus: 'in_progress',
          updatedBy: 'jane.smith'
        }
      ];

      const results = await workflow.bulkUpdateStatus(updates);

      expect(results).toHaveLength(2);
      expect(results.every(r => r.incident.status === 'in_progress')).toBe(true);
    });

    test('handles partial failures in bulk updates', async () => {
      const updates: IncidentStatusUpdate[] = [
        {
          incidentId: 'INC-001',
          newStatus: 'in_progress',
          updatedBy: 'john.doe'
        },
        {
          incidentId: '', // Invalid
          newStatus: 'in_progress',
          updatedBy: 'john.doe'
        }
      ];

      const results = await workflow.bulkUpdateStatus(updates);

      expect(results).toHaveLength(1); // Only valid update succeeds
    });
  });

  describe('Status History and Audit', () => {
    beforeEach(() => {
      mockIncidentService.getIncident.mockResolvedValue(mockIncident);
    });

    test('records status history', async () => {
      const update: IncidentStatusUpdate = {
        incidentId: 'INC-001',
        newStatus: 'in_progress',
        updatedBy: 'john.doe',
        comment: 'Starting work'
      };

      await workflow.updateIncidentStatus(update);

      expect(mockAuditService.recordStatusChange).toHaveBeenCalledWith({
        incidentId: 'INC-001',
        previousStatus: 'assigned',
        newStatus: 'in_progress',
        updatedBy: 'john.doe',
        timestamp: expect.any(Date),
        comment: 'Starting work',
        metadata: undefined
      });
    });

    test('records audit events', async () => {
      const update: IncidentStatusUpdate = {
        incidentId: 'INC-001',
        newStatus: 'in_progress',
        updatedBy: 'john.doe'
      };

      await workflow.updateIncidentStatus(update);

      expect(mockAuditService.recordEvent).toHaveBeenCalledWith({
        type: 'status_update',
        incidentId: 'INC-001',
        userId: 'john.doe',
        timestamp: expect.any(Date),
        details: expect.objectContaining({
          previousStatus: 'assigned',
          newStatus: 'in_progress'
        })
      });
    });

    test('retrieves status transition history', async () => {
      const mockHistory = [
        {
          fromStatus: 'new',
          toStatus: 'assigned',
          updatedBy: 'admin',
          timestamp: new Date(),
          duration: 300000
        }
      ];

      mockAuditService.getStatusHistory.mockResolvedValue(mockHistory);

      const history = await workflow.getStatusTransitionHistory('INC-001');

      expect(history).toEqual(mockHistory);
      expect(mockAuditService.getStatusHistory).toHaveBeenCalledWith('INC-001');
    });
  });

  describe('Error Handling', () => {
    test('handles non-existent incident', async () => {
      mockIncidentService.getIncident.mockResolvedValue(null);

      const update: IncidentStatusUpdate = {
        incidentId: 'NON-EXISTENT',
        newStatus: 'in_progress',
        updatedBy: 'john.doe'
      };

      await expect(workflow.updateIncidentStatus(update))
        .rejects.toThrow('Incident NON-EXISTENT not found');
    });

    test('records errors in audit log', async () => {
      mockIncidentService.getIncident.mockResolvedValue(null);

      const update: IncidentStatusUpdate = {
        incidentId: 'NON-EXISTENT',
        newStatus: 'in_progress',
        updatedBy: 'john.doe'
      };

      try {
        await workflow.updateIncidentStatus(update);
      } catch (error) {
        // Expected to throw
      }

      expect(mockAuditService.recordError).toHaveBeenCalledWith({
        type: 'status_update_error',
        incidentId: 'NON-EXISTENT',
        userId: 'john.doe',
        timestamp: expect.any(Date),
        error: 'Incident NON-EXISTENT not found',
        update
      });
    });

    test('gets valid status transitions for incident', async () => {
      mockIncidentService.getIncident.mockResolvedValue(mockIncident);

      const validTransitions = await workflow.getValidStatusTransitions('INC-001');

      expect(validTransitions).toContain('in_progress');
      expect(validTransitions).toContain('blocked');
      expect(validTransitions).toContain('resolved');
      expect(validTransitions).not.toContain('closed'); // Cannot go directly to closed
    });
  });
});