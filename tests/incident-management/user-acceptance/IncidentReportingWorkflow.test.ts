import { jest } from '@jest/globals';

// User Acceptance Tests for Incident Reporting Workflow
// These tests validate the complete user journey from incident discovery to reporting

interface UserAcceptanceScenario {
  scenarioName: string;
  description: string;
  userRole: 'end_user' | 'support_agent' | 'team_lead' | 'manager' | 'admin';
  preconditions: string[];
  steps: AcceptanceStep[];
  expectedOutcomes: string[];
  acceptanceCriteria: string[];
}

interface AcceptanceStep {
  stepNumber: number;
  action: string;
  expectedResult: string;
  userInput?: any;
  systemResponse?: any;
}

// Mock user acceptance testing framework
class IncidentReportingWorkflowTester {
  private currentUser: any;
  private currentSession: any;
  private systemState: any;

  constructor() {
    this.systemState = {
      incidents: new Map(),
      notifications: [],
      metrics: {},
      userSessions: new Map()
    };
  }

  async setupUser(userRole: string, userData: any): Promise<void> {
    this.currentUser = {
      id: userData.id || `user_${Date.now()}`,
      role: userRole,
      permissions: this.getUserPermissions(userRole),
      team: userData.team || 'General',
      preferences: userData.preferences || {},
      ...userData
    };

    this.currentSession = {
      userId: this.currentUser.id,
      startTime: new Date(),
      actions: [],
      context: {}
    };
  }

  async executeScenario(scenario: UserAcceptanceScenario): Promise<{
    success: boolean;
    completedSteps: number;
    failedSteps: AcceptanceStep[];
    actualOutcomes: string[];
    criteriaMet: boolean[];
  }> {
    console.log(`\n=== Executing Scenario: ${scenario.scenarioName} ===`);
    console.log(`User Role: ${scenario.userRole}`);
    console.log(`Description: ${scenario.description}`);

    // Verify preconditions
    await this.verifyPreconditions(scenario.preconditions);

    const results = {
      success: true,
      completedSteps: 0,
      failedSteps: [] as AcceptanceStep[],
      actualOutcomes: [] as string[],
      criteriaMet: [] as boolean[]
    };

    // Execute each step
    for (const step of scenario.steps) {
      try {
        console.log(`\nStep ${step.stepNumber}: ${step.action}`);

        const stepResult = await this.executeStep(step);

        if (stepResult.success) {
          console.log(`✓ Expected: ${step.expectedResult}`);
          console.log(`✓ Actual: ${stepResult.actualResult}`);
          results.completedSteps++;
        } else {
          console.log(`✗ Expected: ${step.expectedResult}`);
          console.log(`✗ Actual: ${stepResult.actualResult}`);
          results.failedSteps.push(step);
          results.success = false;
        }

        results.actualOutcomes.push(stepResult.actualResult);

      } catch (error) {
        console.log(`✗ Step failed with error: ${error.message}`);
        results.failedSteps.push(step);
        results.success = false;
      }
    }

    // Verify expected outcomes
    for (const expectedOutcome of scenario.expectedOutcomes) {
      const outcomeMet = await this.verifyOutcome(expectedOutcome);
      results.actualOutcomes.push(outcomeMet ? `✓ ${expectedOutcome}` : `✗ ${expectedOutcome}`);
    }

    // Check acceptance criteria
    for (const criteria of scenario.acceptanceCriteria) {
      const criteriaMet = await this.verifyAcceptanceCriteria(criteria);
      results.criteriaMet.push(criteriaMet);
    }

    console.log(`\n=== Scenario Result: ${results.success ? 'PASSED' : 'FAILED'} ===`);
    return results;
  }

  private async executeStep(step: AcceptanceStep): Promise<{ success: boolean; actualResult: string }> {
    const action = step.action.toLowerCase();

    switch (true) {
      case action.includes('report incident'):
        return await this.reportIncident(step);

      case action.includes('search incident'):
        return await this.searchIncident(step);

      case action.includes('update status'):
        return await this.updateIncidentStatus(step);

      case action.includes('assign incident'):
        return await this.assignIncident(step);

      case action.includes('add comment'):
        return await this.addComment(step);

      case action.includes('escalate'):
        return await this.escalateIncident(step);

      case action.includes('generate report'):
        return await this.generateReport(step);

      case action.includes('view dashboard'):
        return await this.viewDashboard(step);

      case action.includes('filter incidents'):
        return await this.filterIncidents(step);

      case action.includes('export data'):
        return await this.exportData(step);

      case action.includes('receive notification'):
        return await this.verifyNotification(step);

      default:
        return { success: false, actualResult: `Unknown action: ${step.action}` };
    }
  }

  private async reportIncident(step: AcceptanceStep): Promise<{ success: boolean; actualResult: string }> {
    try {
      const incidentData = step.userInput || {
        title: 'Test Incident',
        description: 'User reported incident',
        priority: 'medium',
        category: 'General'
      };

      const incidentId = `INC-${Date.now()}`;
      const incident = {
        id: incidentId,
        ...incidentData,
        reportedBy: this.currentUser.id,
        status: 'new',
        createdAt: new Date(),
        assignedTeam: null,
        assignee: null
      };

      this.systemState.incidents.set(incidentId, incident);

      // Record user action
      this.currentSession.actions.push({
        action: 'report_incident',
        timestamp: new Date(),
        data: incident
      });

      // Send notification to appropriate team
      this.systemState.notifications.push({
        type: 'incident_reported',
        incidentId,
        recipients: ['support_team'],
        timestamp: new Date()
      });

      return {
        success: true,
        actualResult: `Incident ${incidentId} reported successfully`
      };

    } catch (error) {
      return {
        success: false,
        actualResult: `Failed to report incident: ${error.message}`
      };
    }
  }

  private async searchIncident(step: AcceptanceStep): Promise<{ success: boolean; actualResult: string }> {
    try {
      const searchQuery = step.userInput?.query || 'test';
      const incidents = Array.from(this.systemState.incidents.values());

      const results = incidents.filter(incident =>
        incident.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        incident.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        incident.id.toLowerCase().includes(searchQuery.toLowerCase())
      );

      return {
        success: results.length > 0,
        actualResult: `Found ${results.length} incidents matching "${searchQuery}"`
      };

    } catch (error) {
      return {
        success: false,
        actualResult: `Search failed: ${error.message}`
      };
    }
  }

  private async updateIncidentStatus(step: AcceptanceStep): Promise<{ success: boolean; actualResult: string }> {
    try {
      const { incidentId, newStatus } = step.userInput;
      const incident = this.systemState.incidents.get(incidentId);

      if (!incident) {
        return {
          success: false,
          actualResult: `Incident ${incidentId} not found`
        };
      }

      // Check permissions
      if (!this.canUpdateIncident(incident)) {
        return {
          success: false,
          actualResult: 'Insufficient permissions to update incident'
        };
      }

      const oldStatus = incident.status;
      incident.status = newStatus;
      incident.updatedAt = new Date();
      incident.updatedBy = this.currentUser.id;

      // Send notification
      this.systemState.notifications.push({
        type: 'status_updated',
        incidentId,
        oldStatus,
        newStatus,
        updatedBy: this.currentUser.id,
        timestamp: new Date()
      });

      return {
        success: true,
        actualResult: `Incident ${incidentId} status updated from ${oldStatus} to ${newStatus}`
      };

    } catch (error) {
      return {
        success: false,
        actualResult: `Status update failed: ${error.message}`
      };
    }
  }

  private async assignIncident(step: AcceptanceStep): Promise<{ success: boolean; actualResult: string }> {
    try {
      const { incidentId, assignee } = step.userInput;
      const incident = this.systemState.incidents.get(incidentId);

      if (!incident) {
        return {
          success: false,
          actualResult: `Incident ${incidentId} not found`
        };
      }

      incident.assignee = assignee;
      incident.status = 'assigned';
      incident.assignedAt = new Date();
      incident.assignedBy = this.currentUser.id;

      // Send notification to assignee
      this.systemState.notifications.push({
        type: 'incident_assigned',
        incidentId,
        assignee,
        assignedBy: this.currentUser.id,
        timestamp: new Date()
      });

      return {
        success: true,
        actualResult: `Incident ${incidentId} assigned to ${assignee}`
      };

    } catch (error) {
      return {
        success: false,
        actualResult: `Assignment failed: ${error.message}`
      };
    }
  }

  private async addComment(step: AcceptanceStep): Promise<{ success: boolean; actualResult: string }> {
    try {
      const { incidentId, comment } = step.userInput;
      const incident = this.systemState.incidents.get(incidentId);

      if (!incident) {
        return {
          success: false,
          actualResult: `Incident ${incidentId} not found`
        };
      }

      if (!incident.comments) {
        incident.comments = [];
      }

      incident.comments.push({
        id: `comment_${Date.now()}`,
        text: comment,
        author: this.currentUser.id,
        timestamp: new Date()
      });

      return {
        success: true,
        actualResult: `Comment added to incident ${incidentId}`
      };

    } catch (error) {
      return {
        success: false,
        actualResult: `Failed to add comment: ${error.message}`
      };
    }
  }

  private async escalateIncident(step: AcceptanceStep): Promise<{ success: boolean; actualResult: string }> {
    try {
      const { incidentId, reason } = step.userInput;
      const incident = this.systemState.incidents.get(incidentId);

      if (!incident) {
        return {
          success: false,
          actualResult: `Incident ${incidentId} not found`
        };
      }

      incident.escalationLevel = (incident.escalationLevel || 0) + 1;
      incident.escalatedAt = new Date();
      incident.escalatedBy = this.currentUser.id;
      incident.escalationReason = reason;

      // Auto-promote priority if not already critical
      if (incident.priority !== 'critical') {
        const priorityMap = { low: 'medium', medium: 'high', high: 'critical' };
        incident.priority = priorityMap[incident.priority] || 'critical';
      }

      // Send escalation notification
      this.systemState.notifications.push({
        type: 'incident_escalated',
        incidentId,
        escalationLevel: incident.escalationLevel,
        reason,
        escalatedBy: this.currentUser.id,
        timestamp: new Date()
      });

      return {
        success: true,
        actualResult: `Incident ${incidentId} escalated to level ${incident.escalationLevel}`
      };

    } catch (error) {
      return {
        success: false,
        actualResult: `Escalation failed: ${error.message}`
      };
    }
  }

  private async generateReport(step: AcceptanceStep): Promise<{ success: boolean; actualResult: string }> {
    try {
      const { reportType, parameters } = step.userInput;
      const incidents = Array.from(this.systemState.incidents.values());

      let reportData;
      switch (reportType) {
        case 'summary':
          reportData = this.generateSummaryReport(incidents, parameters);
          break;
        case 'detailed':
          reportData = this.generateDetailedReport(incidents, parameters);
          break;
        case 'trend':
          reportData = this.generateTrendReport(incidents, parameters);
          break;
        default:
          throw new Error(`Unknown report type: ${reportType}`);
      }

      return {
        success: true,
        actualResult: `${reportType} report generated with ${reportData.incidents.length} incidents`
      };

    } catch (error) {
      return {
        success: false,
        actualResult: `Report generation failed: ${error.message}`
      };
    }
  }

  private async viewDashboard(step: AcceptanceStep): Promise<{ success: boolean; actualResult: string }> {
    try {
      const incidents = Array.from(this.systemState.incidents.values());

      // Calculate dashboard metrics
      const metrics = {
        total: incidents.length,
        active: incidents.filter(i => ['new', 'assigned', 'in_progress'].includes(i.status)).length,
        critical: incidents.filter(i => i.priority === 'critical').length,
        resolved: incidents.filter(i => i.status === 'resolved').length,
        slaCompliance: this.calculateSlaCompliance(incidents)
      };

      this.systemState.metrics = metrics;

      return {
        success: true,
        actualResult: `Dashboard loaded: ${metrics.total} total, ${metrics.active} active, ${metrics.critical} critical`
      };

    } catch (error) {
      return {
        success: false,
        actualResult: `Dashboard loading failed: ${error.message}`
      };
    }
  }

  private async filterIncidents(step: AcceptanceStep): Promise<{ success: boolean; actualResult: string }> {
    try {
      const filters = step.userInput;
      const incidents = Array.from(this.systemState.incidents.values());

      let filtered = incidents;

      if (filters.status) {
        filtered = filtered.filter(i => filters.status.includes(i.status));
      }

      if (filters.priority) {
        filtered = filtered.filter(i => filters.priority.includes(i.priority));
      }

      if (filters.assignee) {
        filtered = filtered.filter(i => i.assignee === filters.assignee);
      }

      if (filters.dateRange) {
        filtered = filtered.filter(i => {
          const incidentDate = new Date(i.createdAt);
          return incidentDate >= filters.dateRange.start && incidentDate <= filters.dateRange.end;
        });
      }

      return {
        success: true,
        actualResult: `Filtered to ${filtered.length} incidents from ${incidents.length} total`
      };

    } catch (error) {
      return {
        success: false,
        actualResult: `Filtering failed: ${error.message}`
      };
    }
  }

  private async exportData(step: AcceptanceStep): Promise<{ success: boolean; actualResult: string }> {
    try {
      const { format, incidentIds } = step.userInput;
      const incidents = incidentIds
        ? incidentIds.map(id => this.systemState.incidents.get(id)).filter(Boolean)
        : Array.from(this.systemState.incidents.values());

      let exportData;
      switch (format) {
        case 'csv':
          exportData = this.exportToCsv(incidents);
          break;
        case 'pdf':
          exportData = this.exportToPdf(incidents);
          break;
        case 'excel':
          exportData = this.exportToExcel(incidents);
          break;
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }

      return {
        success: true,
        actualResult: `Exported ${incidents.length} incidents to ${format} format`
      };

    } catch (error) {
      return {
        success: false,
        actualResult: `Export failed: ${error.message}`
      };
    }
  }

  private async verifyNotification(step: AcceptanceStep): Promise<{ success: boolean; actualResult: string }> {
    try {
      const { notificationType, incidentId } = step.userInput;

      const notification = this.systemState.notifications.find(n =>
        n.type === notificationType && (!incidentId || n.incidentId === incidentId)
      );

      if (notification) {
        return {
          success: true,
          actualResult: `Notification of type ${notificationType} found`
        };
      } else {
        return {
          success: false,
          actualResult: `No notification of type ${notificationType} found`
        };
      }

    } catch (error) {
      return {
        success: false,
        actualResult: `Notification verification failed: ${error.message}`
      };
    }
  }

  // Helper methods
  private getUserPermissions(role: string): string[] {
    const permissions = {
      'end_user': ['report_incident', 'view_own_incidents', 'comment'],
      'support_agent': ['report_incident', 'view_incidents', 'update_status', 'assign', 'comment'],
      'team_lead': ['report_incident', 'view_incidents', 'update_status', 'assign', 'comment', 'escalate', 'generate_reports'],
      'manager': ['view_all_incidents', 'update_status', 'assign', 'comment', 'escalate', 'generate_reports', 'export_data'],
      'admin': ['*'] // All permissions
    };

    return permissions[role] || [];
  }

  private canUpdateIncident(incident: any): boolean {
    const userPermissions = this.currentUser.permissions;

    if (userPermissions.includes('*')) {
      return true;
    }

    if (userPermissions.includes('update_status')) {
      return true;
    }

    // Users can update their own reported incidents
    if (incident.reportedBy === this.currentUser.id && userPermissions.includes('view_own_incidents')) {
      return true;
    }

    return false;
  }

  private calculateSlaCompliance(incidents: any[]): number {
    if (incidents.length === 0) return 100;

    const compliantIncidents = incidents.filter(incident => {
      // Mock SLA compliance check
      const slaTarget = this.getSlaTarget(incident.priority);
      const timeElapsed = Date.now() - new Date(incident.createdAt).getTime();
      return timeElapsed <= slaTarget;
    });

    return (compliantIncidents.length / incidents.length) * 100;
  }

  private getSlaTarget(priority: string): number {
    const targets = {
      'critical': 2 * 60 * 60 * 1000, // 2 hours
      'high': 4 * 60 * 60 * 1000, // 4 hours
      'medium': 8 * 60 * 60 * 1000, // 8 hours
      'low': 24 * 60 * 60 * 1000 // 24 hours
    };
    return targets[priority] || targets['medium'];
  }

  private generateSummaryReport(incidents: any[], parameters: any): any {
    return {
      type: 'summary',
      generatedAt: new Date(),
      parameters,
      incidents: incidents.slice(0, parameters?.limit || 100),
      summary: {
        total: incidents.length,
        byStatus: this.groupBy(incidents, 'status'),
        byPriority: this.groupBy(incidents, 'priority'),
        avgResolutionTime: this.calculateAverageResolutionTime(incidents)
      }
    };
  }

  private generateDetailedReport(incidents: any[], parameters: any): any {
    return {
      type: 'detailed',
      generatedAt: new Date(),
      parameters,
      incidents: incidents.map(incident => ({
        ...incident,
        timeline: incident.timeline || [],
        comments: incident.comments || []
      }))
    };
  }

  private generateTrendReport(incidents: any[], parameters: any): any {
    return {
      type: 'trend',
      generatedAt: new Date(),
      parameters,
      incidents,
      trends: {
        daily: this.calculateDailyTrends(incidents),
        weekly: this.calculateWeeklyTrends(incidents),
        monthly: this.calculateMonthlyTrends(incidents)
      }
    };
  }

  private exportToCsv(incidents: any[]): string {
    const headers = ['ID', 'Title', 'Status', 'Priority', 'Created', 'Assignee'];
    const rows = incidents.map(i => [
      i.id, i.title, i.status, i.priority,
      i.createdAt.toISOString(), i.assignee || ''
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  private exportToPdf(incidents: any[]): any {
    return {
      format: 'pdf',
      content: incidents,
      metadata: {
        title: 'Incident Report',
        generatedAt: new Date(),
        incidentCount: incidents.length
      }
    };
  }

  private exportToExcel(incidents: any[]): any {
    return {
      format: 'excel',
      sheets: {
        'Incidents': incidents,
        'Summary': this.generateSummaryReport(incidents, {}).summary
      }
    };
  }

  private groupBy(array: any[], key: string): Record<string, number> {
    return array.reduce((groups, item) => {
      const groupKey = item[key];
      groups[groupKey] = (groups[groupKey] || 0) + 1;
      return groups;
    }, {});
  }

  private calculateAverageResolutionTime(incidents: any[]): number {
    const resolvedIncidents = incidents.filter(i => i.status === 'resolved' && i.resolvedAt);
    if (resolvedIncidents.length === 0) return 0;

    const totalTime = resolvedIncidents.reduce((sum, incident) => {
      return sum + (new Date(incident.resolvedAt).getTime() - new Date(incident.createdAt).getTime());
    }, 0);

    return totalTime / resolvedIncidents.length;
  }

  private calculateDailyTrends(incidents: any[]): any[] {
    // Mock daily trend calculation
    return [{ date: '2024-01-01', count: incidents.length }];
  }

  private calculateWeeklyTrends(incidents: any[]): any[] {
    // Mock weekly trend calculation
    return [{ week: '2024-W01', count: incidents.length }];
  }

  private calculateMonthlyTrends(incidents: any[]): any[] {
    // Mock monthly trend calculation
    return [{ month: '2024-01', count: incidents.length }];
  }

  private async verifyPreconditions(preconditions: string[]): Promise<void> {
    for (const condition of preconditions) {
      console.log(`Verifying precondition: ${condition}`);
      // Mock precondition verification
    }
  }

  private async verifyOutcome(outcome: string): Promise<boolean> {
    // Mock outcome verification
    return true;
  }

  private async verifyAcceptanceCriteria(criteria: string): Promise<boolean> {
    // Mock acceptance criteria verification
    return true;
  }
}

// User Acceptance Test Scenarios
describe('Incident Reporting Workflow User Acceptance Tests', () => {
  let tester: IncidentReportingWorkflowTester;

  beforeEach(() => {
    tester = new IncidentReportingWorkflowTester();
  });

  describe('End User Incident Reporting Scenarios', () => {
    const endUserScenarios: UserAcceptanceScenario[] = [
      {
        scenarioName: 'End User Reports System Outage',
        description: 'An end user experiences a system outage and reports it through the incident management system',
        userRole: 'end_user',
        preconditions: [
          'User is logged into the system',
          'User has access to incident reporting',
          'System is experiencing an outage'
        ],
        steps: [
          {
            stepNumber: 1,
            action: 'User accesses the incident reporting form',
            expectedResult: 'Incident reporting form is displayed with all required fields',
            userInput: { formAccess: true }
          },
          {
            stepNumber: 2,
            action: 'User fills out incident details',
            expectedResult: 'Form accepts user input and validates required fields',
            userInput: {
              title: 'Unable to access customer portal',
              description: 'Getting timeout errors when trying to log into the customer portal. Multiple users affected.',
              priority: 'high',
              category: 'Application',
              impactLevel: 'multiple_users'
            }
          },
          {
            stepNumber: 3,
            action: 'User submits the incident report',
            expectedResult: 'Incident is created and user receives confirmation with incident ID',
            userInput: { submit: true }
          },
          {
            stepNumber: 4,
            action: 'System sends notification to support team',
            expectedResult: 'Support team receives notification about new high-priority incident',
            userInput: { notificationType: 'incident_reported' }
          },
          {
            stepNumber: 5,
            action: 'User receives email confirmation',
            expectedResult: 'User gets email with incident details and tracking information',
            userInput: { notificationType: 'confirmation_email' }
          }
        ],
        expectedOutcomes: [
          'Incident is successfully created in the system',
          'Incident has unique ID starting with INC-',
          'Support team is notified',
          'User can track incident status',
          'Incident appears in support queue'
        ],
        acceptanceCriteria: [
          'Incident creation takes less than 30 seconds',
          'All required fields are validated',
          'User receives immediate feedback',
          'Support team gets notification within 1 minute',
          'Incident is properly categorized and prioritized'
        ]
      },
      {
        scenarioName: 'End User Tracks Incident Progress',
        description: 'An end user wants to check the status and progress of their reported incident',
        userRole: 'end_user',
        preconditions: [
          'User has previously reported an incident',
          'User has incident ID or email confirmation'
        ],
        steps: [
          {
            stepNumber: 1,
            action: 'User searches for their incident',
            expectedResult: 'Search returns the user\'s incident',
            userInput: { query: 'INC-' }
          },
          {
            stepNumber: 2,
            action: 'User views incident details',
            expectedResult: 'Incident details page shows current status, timeline, and updates',
            userInput: { incidentId: 'INC-123' }
          },
          {
            stepNumber: 3,
            action: 'User adds additional information',
            expectedResult: 'User can add comments or updates to provide more context',
            userInput: {
              incidentId: 'INC-123',
              comment: 'Issue is still occurring. Now affecting our mobile app as well.'
            }
          }
        ],
        expectedOutcomes: [
          'User can easily find their incident',
          'Status information is clear and up-to-date',
          'User can contribute additional information',
          'Timeline shows all updates chronologically'
        ],
        acceptanceCriteria: [
          'Search finds incident within 3 seconds',
          'Status is updated in real-time',
          'User comments are immediately visible',
          'Timeline is easy to understand'
        ]
      }
    ];

    endUserScenarios.forEach(scenario => {
      test(`should complete scenario: ${scenario.scenarioName}`, async () => {
        await tester.setupUser(scenario.userRole, {
          id: 'test_end_user',
          name: 'Test End User',
          email: 'test.user@company.com'
        });

        const result = await tester.executeScenario(scenario);

        expect(result.success).toBe(true);
        expect(result.completedSteps).toBe(scenario.steps.length);
        expect(result.failedSteps).toHaveLength(0);
        expect(result.criteriaMet.every(met => met)).toBe(true);
      });
    });
  });

  describe('Support Agent Workflow Scenarios', () => {
    const supportAgentScenarios: UserAcceptanceScenario[] = [
      {
        scenarioName: 'Support Agent Triages New Incident',
        description: 'A support agent receives a new incident and performs initial triage',
        userRole: 'support_agent',
        preconditions: [
          'New incident exists in the queue',
          'Support agent is logged in',
          'Support agent has triage permissions'
        ],
        steps: [
          {
            stepNumber: 1,
            action: 'Agent views incident queue',
            expectedResult: 'Queue displays new incidents sorted by priority and creation time',
            userInput: { viewDashboard: true }
          },
          {
            stepNumber: 2,
            action: 'Agent selects high-priority incident',
            expectedResult: 'Incident details are displayed with all relevant information',
            userInput: { incidentId: 'INC-001' }
          },
          {
            stepNumber: 3,
            action: 'Agent assesses incident severity and impact',
            expectedResult: 'Agent can update priority and categorization based on assessment',
            userInput: {
              incidentId: 'INC-001',
              newPriority: 'critical',
              reason: 'Affects multiple critical business systems'
            }
          },
          {
            stepNumber: 4,
            action: 'Agent assigns incident to appropriate team',
            expectedResult: 'Incident is assigned and team is notified',
            userInput: {
              incidentId: 'INC-001',
              assignee: 'infrastructure_team_lead'
            }
          },
          {
            stepNumber: 5,
            action: 'Agent adds initial assessment notes',
            expectedResult: 'Comments are added to incident timeline',
            userInput: {
              incidentId: 'INC-001',
              comment: 'Initial assessment: Database connectivity issue affecting web portal. Escalating to infrastructure team for immediate attention.'
            }
          }
        ],
        expectedOutcomes: [
          'Incident is properly triaged and categorized',
          'Appropriate team is assigned and notified',
          'Priority reflects actual business impact',
          'Initial assessment is documented'
        ],
        acceptanceCriteria: [
          'Triage process completes within 5 minutes',
          'Team receives assignment notification immediately',
          'All changes are logged with timestamps',
          'User who reported incident is updated on progress'
        ]
      }
    ];

    supportAgentScenarios.forEach(scenario => {
      test(`should complete scenario: ${scenario.scenarioName}`, async () => {
        // Create a pre-existing incident for triage
        await tester.setupUser('end_user', { id: 'incident_reporter' });
        await tester.executeStep({
          stepNumber: 0,
          action: 'report incident',
          expectedResult: 'incident created',
          userInput: {
            title: 'Database connectivity issues',
            description: 'Users unable to connect to main database',
            priority: 'high',
            category: 'Database'
          }
        });

        await tester.setupUser(scenario.userRole, {
          id: 'support_agent_1',
          name: 'Support Agent',
          team: 'Support'
        });

        const result = await tester.executeScenario(scenario);

        expect(result.success).toBe(true);
        expect(result.completedSteps).toBe(scenario.steps.length);
        expect(result.failedSteps).toHaveLength(0);
      });
    });
  });

  describe('Team Lead Management Scenarios', () => {
    const teamLeadScenarios: UserAcceptanceScenario[] = [
      {
        scenarioName: 'Team Lead Manages Team Workload',
        description: 'A team lead monitors their team\'s incident workload and redistributes as needed',
        userRole: 'team_lead',
        preconditions: [
          'Multiple incidents assigned to team',
          'Team members have varying workloads',
          'Some incidents approaching SLA deadlines'
        ],
        steps: [
          {
            stepNumber: 1,
            action: 'Team lead views team dashboard',
            expectedResult: 'Dashboard shows team workload, SLA status, and individual assignments',
            userInput: { viewDashboard: true }
          },
          {
            stepNumber: 2,
            action: 'Team lead identifies workload imbalance',
            expectedResult: 'System highlights team members with high workload or SLA risks',
            userInput: { filterIncidents: { assignedTeam: 'Infrastructure' } }
          },
          {
            stepNumber: 3,
            action: 'Team lead reassigns incident to available team member',
            expectedResult: 'Incident is reassigned and both old and new assignees are notified',
            userInput: {
              incidentId: 'INC-001',
              assignee: 'available_team_member'
            }
          },
          {
            stepNumber: 4,
            action: 'Team lead escalates critical incident approaching SLA breach',
            expectedResult: 'Incident is escalated and management is notified',
            userInput: {
              incidentId: 'INC-002',
              reason: 'Approaching SLA deadline, requires senior engineer attention'
            }
          }
        ],
        expectedOutcomes: [
          'Team workload is balanced',
          'SLA breaches are prevented',
          'Critical incidents get appropriate attention',
          'Team members are properly notified of changes'
        ],
        acceptanceCriteria: [
          'Dashboard provides clear workload visibility',
          'Reassignment process is quick and easy',
          'Escalation triggers appropriate notifications',
          'SLA tracking is accurate and timely'
        ]
      }
    ];

    teamLeadScenarios.forEach(scenario => {
      test(`should complete scenario: ${scenario.scenarioName}`, async () => {
        await tester.setupUser(scenario.userRole, {
          id: 'team_lead_1',
          name: 'Infrastructure Team Lead',
          team: 'Infrastructure'
        });

        const result = await tester.executeScenario(scenario);

        expect(result.success).toBe(true);
        expect(result.completedSteps).toBe(scenario.steps.length);
      });
    });
  });

  describe('Manager Reporting Scenarios', () => {
    const managerScenarios: UserAcceptanceScenario[] = [
      {
        scenarioName: 'Manager Generates Monthly Incident Report',
        description: 'A manager needs to generate and export monthly incident reports for stakeholders',
        userRole: 'manager',
        preconditions: [
          'Historical incident data is available',
          'Manager has reporting permissions',
          'Current month has ended'
        ],
        steps: [
          {
            stepNumber: 1,
            action: 'Manager accesses reporting dashboard',
            expectedResult: 'Reporting interface is displayed with available report types',
            userInput: { viewDashboard: true }
          },
          {
            stepNumber: 2,
            action: 'Manager selects monthly summary report',
            expectedResult: 'Report configuration options are presented',
            userInput: {
              reportType: 'summary',
              parameters: {
                period: 'monthly',
                month: '2024-01',
                includeMetrics: true,
                includeTrends: true
              }
            }
          },
          {
            stepNumber: 3,
            action: 'Manager generates report',
            expectedResult: 'Report is generated with key metrics and visualizations',
            userInput: {
              reportType: 'summary',
              parameters: {
                period: 'monthly',
                month: '2024-01'
              }
            }
          },
          {
            stepNumber: 4,
            action: 'Manager exports report to PDF',
            expectedResult: 'Report is exported in professional format suitable for stakeholders',
            userInput: {
              format: 'pdf',
              incidentIds: null // All incidents
            }
          },
          {
            stepNumber: 5,
            action: 'Manager schedules automatic monthly reports',
            expectedResult: 'System is configured to generate reports automatically',
            userInput: {
              schedule: 'monthly',
              recipients: ['stakeholder1@company.com', 'stakeholder2@company.com'],
              format: 'pdf'
            }
          }
        ],
        expectedOutcomes: [
          'Comprehensive monthly report is generated',
          'Report includes key performance indicators',
          'Report is exportable in multiple formats',
          'Automatic reporting is configured',
          'Stakeholders receive reports on schedule'
        ],
        acceptanceCriteria: [
          'Report generation completes within 2 minutes',
          'Report includes accurate data and metrics',
          'Export formats are properly formatted',
          'Scheduled reports are delivered reliably',
          'Report content is suitable for executive review'
        ]
      }
    ];

    managerScenarios.forEach(scenario => {
      test(`should complete scenario: ${scenario.scenarioName}`, async () => {
        await tester.setupUser(scenario.userRole, {
          id: 'manager_1',
          name: 'IT Manager',
          department: 'IT'
        });

        const result = await tester.executeScenario(scenario);

        expect(result.success).toBe(true);
        expect(result.completedSteps).toBe(scenario.steps.length);
      });
    });
  });

  describe('Cross-Role Collaboration Scenarios', () => {
    test('should support end-to-end incident resolution collaboration', async () => {
      // Scenario: Complete incident lifecycle with multiple roles

      // Step 1: End user reports incident
      await tester.setupUser('end_user', {
        id: 'business_user',
        name: 'Business User'
      });

      const reportResult = await tester.executeStep({
        stepNumber: 1,
        action: 'report incident',
        expectedResult: 'incident created',
        userInput: {
          title: 'Customer data export functionality broken',
          description: 'Customers cannot export their data, getting error 500',
          priority: 'high',
          category: 'Application'
        }
      });

      expect(reportResult.success).toBe(true);

      // Step 2: Support agent triages
      await tester.setupUser('support_agent', {
        id: 'support_1',
        name: 'Support Agent'
      });

      const triageResult = await tester.executeStep({
        stepNumber: 2,
        action: 'assign incident',
        expectedResult: 'incident assigned',
        userInput: {
          incidentId: 'INC-001', // From previous step
          assignee: 'dev_team_lead'
        }
      });

      expect(triageResult.success).toBe(true);

      // Step 3: Team lead manages resolution
      await tester.setupUser('team_lead', {
        id: 'dev_team_lead',
        name: 'Development Team Lead'
      });

      const updateResult = await tester.executeStep({
        stepNumber: 3,
        action: 'update status',
        expectedResult: 'status updated',
        userInput: {
          incidentId: 'INC-001',
          newStatus: 'in_progress'
        }
      });

      expect(updateResult.success).toBe(true);

      // Step 4: Manager monitors progress
      await tester.setupUser('manager', {
        id: 'it_manager',
        name: 'IT Manager'
      });

      const dashboardResult = await tester.executeStep({
        stepNumber: 4,
        action: 'view dashboard',
        expectedResult: 'dashboard loaded',
        userInput: { viewDashboard: true }
      });

      expect(dashboardResult.success).toBe(true);

      // Verify notifications were sent to all stakeholders
      const notificationResult = await tester.executeStep({
        stepNumber: 5,
        action: 'receive notification',
        expectedResult: 'notifications found',
        userInput: {
          notificationType: 'incident_reported',
          incidentId: 'INC-001'
        }
      });

      expect(notificationResult.success).toBe(true);
    });
  });

  describe('Performance and Usability Acceptance', () => {
    test('should meet performance requirements under normal load', async () => {
      await tester.setupUser('support_agent', {
        id: 'perf_test_user',
        name: 'Performance Test User'
      });

      // Create multiple incidents to simulate load
      const createPromises = Array.from({ length: 50 }, (_, i) =>
        tester.executeStep({
          stepNumber: i + 1,
          action: 'report incident',
          expectedResult: 'incident created',
          userInput: {
            title: `Performance Test Incident ${i + 1}`,
            description: `Load testing incident number ${i + 1}`,
            priority: 'medium',
            category: 'Testing'
          }
        })
      );

      const startTime = Date.now();
      const results = await Promise.all(createPromises);
      const endTime = Date.now();

      const totalTime = endTime - startTime;
      const avgTimePerIncident = totalTime / 50;

      expect(results.every(r => r.success)).toBe(true);
      expect(avgTimePerIncident).toBeLessThan(100); // Less than 100ms per incident
      expect(totalTime).toBeLessThan(5000); // Total under 5 seconds

      console.log(`Performance test: Created 50 incidents in ${totalTime}ms (avg: ${avgTimePerIncident.toFixed(2)}ms per incident)`);
    });

    test('should maintain usability with large incident volumes', async () => {
      await tester.setupUser('team_lead', {
        id: 'usability_test_user',
        name: 'Usability Test User'
      });

      // Test dashboard performance with many incidents
      const dashboardStart = Date.now();
      const dashboardResult = await tester.executeStep({
        stepNumber: 1,
        action: 'view dashboard',
        expectedResult: 'dashboard loaded',
        userInput: { viewDashboard: true }
      });
      const dashboardTime = Date.now() - dashboardStart;

      expect(dashboardResult.success).toBe(true);
      expect(dashboardTime).toBeLessThan(2000); // Dashboard loads within 2 seconds

      // Test search performance
      const searchStart = Date.now();
      const searchResult = await tester.executeStep({
        stepNumber: 2,
        action: 'search incident',
        expectedResult: 'search completed',
        userInput: { query: 'performance' }
      });
      const searchTime = Date.now() - searchStart;

      expect(searchResult.success).toBe(true);
      expect(searchTime).toBeLessThan(1000); // Search completes within 1 second

      console.log(`Usability test: Dashboard load: ${dashboardTime}ms, Search: ${searchTime}ms`);
    });
  });
});