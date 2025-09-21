/**
 * Test Fixtures and Utilities for Incident Management Testing
 * Provides reusable test data, mock services, and testing utilities
 */

// Core incident types
export interface TestIncident {
  id: string;
  title: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'new' | 'assigned' | 'in_progress' | 'blocked' | 'resolved' | 'closed';
  category: string;
  assignedTeam?: string;
  assignee?: string;
  reportedBy: string;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  closedAt?: Date;
  tags: string[];
  metadata: Record<string, any>;
  sla: {
    target: number;
    violated: boolean;
    remainingTime: number;
  };
  timeline: TimelineEvent[];
  comments: Comment[];
  relatedIncidents: string[];
}

export interface TimelineEvent {
  id: string;
  event: string;
  timestamp: Date;
  user: string;
  details?: string;
  metadata?: Record<string, any>;
}

export interface Comment {
  id: string;
  text: string;
  author: string;
  timestamp: Date;
  private?: boolean;
  edited?: boolean;
}

export interface TestUser {
  id: string;
  name: string;
  email: string;
  role: 'end_user' | 'support_agent' | 'team_lead' | 'manager' | 'admin';
  team: string;
  permissions: string[];
  preferences: Record<string, any>;
}

export interface TestTeam {
  id: string;
  name: string;
  members: string[];
  escalationContact: string;
  slaTargets: Record<string, number>;
}

// Test data builders
export class IncidentFixtureBuilder {
  private incident: Partial<TestIncident>;

  constructor() {
    this.incident = {
      id: `INC-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      title: 'Test Incident',
      description: 'This is a test incident for automated testing',
      priority: 'medium',
      status: 'new',
      category: 'General',
      reportedBy: 'test.user',
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: ['test'],
      metadata: {},
      sla: {
        target: 8 * 60 * 60 * 1000, // 8 hours
        violated: false,
        remainingTime: 8 * 60 * 60 * 1000
      },
      timeline: [],
      comments: [],
      relatedIncidents: []
    };
  }

  withId(id: string): this {
    this.incident.id = id;
    return this;
  }

  withTitle(title: string): this {
    this.incident.title = title;
    return this;
  }

  withDescription(description: string): this {
    this.incident.description = description;
    return this;
  }

  withPriority(priority: 'critical' | 'high' | 'medium' | 'low'): this {
    this.incident.priority = priority;

    // Update SLA target based on priority
    const slaTargets = {
      critical: 2 * 60 * 60 * 1000, // 2 hours
      high: 4 * 60 * 60 * 1000, // 4 hours
      medium: 8 * 60 * 60 * 1000, // 8 hours
      low: 24 * 60 * 60 * 1000 // 24 hours
    };

    this.incident.sla = {
      ...this.incident.sla!,
      target: slaTargets[priority],
      remainingTime: slaTargets[priority]
    };

    return this;
  }

  withStatus(status: 'new' | 'assigned' | 'in_progress' | 'blocked' | 'resolved' | 'closed'): this {
    this.incident.status = status;

    // Add appropriate timestamps
    if (status === 'resolved' && !this.incident.resolvedAt) {
      this.incident.resolvedAt = new Date();
    }
    if (status === 'closed' && !this.incident.closedAt) {
      this.incident.closedAt = new Date();
    }

    return this;
  }

  withCategory(category: string): this {
    this.incident.category = category;
    return this;
  }

  withAssignment(team?: string, assignee?: string): this {
    this.incident.assignedTeam = team;
    this.incident.assignee = assignee;
    if (assignee) {
      this.incident.status = 'assigned';
    }
    return this;
  }

  withReporter(reportedBy: string): this {
    this.incident.reportedBy = reportedBy;
    return this;
  }

  withTags(tags: string[]): this {
    this.incident.tags = tags;
    return this;
  }

  withMetadata(metadata: Record<string, any>): this {
    this.incident.metadata = { ...this.incident.metadata, ...metadata };
    return this;
  }

  withSlaViolation(violated: boolean = true): this {
    this.incident.sla = {
      ...this.incident.sla!,
      violated,
      remainingTime: violated ? -3600000 : this.incident.sla!.remainingTime // -1 hour if violated
    };
    return this;
  }

  withTimeline(events: Partial<TimelineEvent>[]): this {
    this.incident.timeline = events.map((event, index) => ({
      id: event.id || `event-${index}`,
      event: event.event || 'Event',
      timestamp: event.timestamp || new Date(),
      user: event.user || 'system',
      details: event.details,
      metadata: event.metadata
    }));
    return this;
  }

  withComments(comments: Partial<Comment>[]): this {
    this.incident.comments = comments.map((comment, index) => ({
      id: comment.id || `comment-${index}`,
      text: comment.text || 'Test comment',
      author: comment.author || 'test.user',
      timestamp: comment.timestamp || new Date(),
      private: comment.private || false,
      edited: comment.edited || false
    }));
    return this;
  }

  withRelatedIncidents(incidentIds: string[]): this {
    this.incident.relatedIncidents = incidentIds;
    return this;
  }

  withAge(ageInHours: number): this {
    const ageInMs = ageInHours * 60 * 60 * 1000;
    this.incident.createdAt = new Date(Date.now() - ageInMs);
    this.incident.updatedAt = new Date(Date.now() - ageInMs + 3600000); // Updated 1 hour after creation

    // Update SLA remaining time
    this.incident.sla = {
      ...this.incident.sla!,
      remainingTime: this.incident.sla!.target - ageInMs,
      violated: ageInMs > this.incident.sla!.target
    };

    return this;
  }

  build(): TestIncident {
    // Add default timeline events
    if (this.incident.timeline!.length === 0) {
      this.incident.timeline = [
        {
          id: 'event-created',
          event: 'Incident Created',
          timestamp: this.incident.createdAt!,
          user: this.incident.reportedBy!
        }
      ];

      if (this.incident.assignee) {
        this.incident.timeline.push({
          id: 'event-assigned',
          event: 'Incident Assigned',
          timestamp: new Date(this.incident.createdAt!.getTime() + 300000), // 5 minutes later
          user: 'system',
          details: `Assigned to ${this.incident.assignee}`
        });
      }

      if (this.incident.status === 'resolved') {
        this.incident.timeline.push({
          id: 'event-resolved',
          event: 'Incident Resolved',
          timestamp: this.incident.resolvedAt!,
          user: this.incident.assignee || 'system'
        });
      }

      if (this.incident.status === 'closed') {
        this.incident.timeline.push({
          id: 'event-closed',
          event: 'Incident Closed',
          timestamp: this.incident.closedAt!,
          user: 'admin'
        });
      }
    }

    return this.incident as TestIncident;
  }
}

// Predefined test fixtures
export class IncidentFixtures {
  static readonly CRITICAL_OUTAGE = new IncidentFixtureBuilder()
    .withId('INC-CRITICAL-001')
    .withTitle('Complete System Outage')
    .withDescription('All systems are down, no users can access any services')
    .withPriority('critical')
    .withStatus('in_progress')
    .withCategory('Infrastructure')
    .withAssignment('Infrastructure', 'john.doe')
    .withTags(['outage', 'critical', 'all-systems'])
    .withAge(0.5) // 30 minutes old
    .withComments([
      { text: 'Initial investigation started', author: 'john.doe' },
      { text: 'Database connectivity confirmed down', author: 'john.doe' }
    ])
    .build();

  static readonly HIGH_PRIORITY_DB = new IncidentFixtureBuilder()
    .withId('INC-HIGH-001')
    .withTitle('Database Performance Degradation')
    .withDescription('Query response times increased significantly')
    .withPriority('high')
    .withStatus('assigned')
    .withCategory('Database')
    .withAssignment('Database', 'jane.smith')
    .withTags(['database', 'performance', 'queries'])
    .withAge(2) // 2 hours old
    .build();

  static readonly MEDIUM_PRIORITY_APP = new IncidentFixtureBuilder()
    .withId('INC-MEDIUM-001')
    .withTitle('Login Page Styling Issue')
    .withDescription('Login button alignment is incorrect on mobile devices')
    .withPriority('medium')
    .withStatus('new')
    .withCategory('Frontend')
    .withTags(['ui', 'mobile', 'styling'])
    .withAge(6) // 6 hours old
    .build();

  static readonly LOW_PRIORITY_FEATURE = new IncidentFixtureBuilder()
    .withId('INC-LOW-001')
    .withTitle('Feature Request: Dark Mode')
    .withDescription('Users requesting dark mode option for better usability')
    .withPriority('low')
    .withStatus('new')
    .withCategory('Enhancement')
    .withTags(['feature-request', 'ui', 'enhancement'])
    .withAge(48) // 2 days old
    .build();

  static readonly RESOLVED_INCIDENT = new IncidentFixtureBuilder()
    .withId('INC-RESOLVED-001')
    .withTitle('Email Service Interruption')
    .withDescription('Outbound emails were failing to send')
    .withPriority('high')
    .withStatus('resolved')
    .withCategory('Email')
    .withAssignment('Infrastructure', 'bob.johnson')
    .withTags(['email', 'smtp', 'resolved'])
    .withAge(24) // 1 day old
    .withComments([
      { text: 'SMTP server configuration error identified', author: 'bob.johnson' },
      { text: 'Configuration fixed and tested', author: 'bob.johnson' }
    ])
    .build();

  static readonly SLA_VIOLATED_INCIDENT = new IncidentFixtureBuilder()
    .withId('INC-SLA-VIOLATION-001')
    .withTitle('API Rate Limiting Issues')
    .withDescription('Third-party API calls are being rate limited')
    .withPriority('medium')
    .withStatus('in_progress')
    .withCategory('API')
    .withAssignment('Backend', 'alice.wilson')
    .withTags(['api', 'rate-limiting', 'third-party'])
    .withAge(12) // 12 hours old (exceeds 8-hour SLA for medium priority)
    .withSlaViolation(true)
    .build();

  static readonly ESCALATED_INCIDENT = new IncidentFixtureBuilder()
    .withId('INC-ESCALATED-001')
    .withTitle('Security Breach Detected')
    .withDescription('Suspicious activity detected in user authentication logs')
    .withPriority('critical')
    .withStatus('in_progress')
    .withCategory('Security')
    .withAssignment('Security', 'security.lead')
    .withTags(['security', 'breach', 'authentication', 'escalated'])
    .withAge(1) // 1 hour old
    .withMetadata({
      escalationLevel: 2,
      escalatedBy: 'support.agent',
      escalationReason: 'Potential security breach requires immediate attention'
    })
    .build();

  // Get a collection of diverse incidents for testing
  static getAllFixtures(): TestIncident[] {
    return [
      this.CRITICAL_OUTAGE,
      this.HIGH_PRIORITY_DB,
      this.MEDIUM_PRIORITY_APP,
      this.LOW_PRIORITY_FEATURE,
      this.RESOLVED_INCIDENT,
      this.SLA_VIOLATED_INCIDENT,
      this.ESCALATED_INCIDENT
    ];
  }

  // Get incidents filtered by status
  static getByStatus(status: string): TestIncident[] {
    return this.getAllFixtures().filter(incident => incident.status === status);
  }

  // Get incidents filtered by priority
  static getByPriority(priority: string): TestIncident[] {
    return this.getAllFixtures().filter(incident => incident.priority === priority);
  }

  // Generate bulk test data
  static generateBulkIncidents(count: number): TestIncident[] {
    const incidents: TestIncident[] = [];
    const priorities = ['critical', 'high', 'medium', 'low'] as const;
    const statuses = ['new', 'assigned', 'in_progress', 'blocked', 'resolved', 'closed'] as const;
    const categories = ['Infrastructure', 'Database', 'Frontend', 'Backend', 'Security', 'Network'];
    const teams = ['Infrastructure', 'Database', 'Frontend', 'Backend', 'Security', 'Network'];

    for (let i = 0; i < count; i++) {
      const builder = new IncidentFixtureBuilder()
        .withId(`INC-BULK-${i.toString().padStart(6, '0')}`)
        .withTitle(`Bulk Test Incident ${i + 1}`)
        .withDescription(`This is bulk test incident number ${i + 1} for load testing`)
        .withPriority(priorities[i % priorities.length])
        .withStatus(statuses[i % statuses.length])
        .withCategory(categories[i % categories.length])
        .withTags([`bulk-${i}`, 'test', 'generated'])
        .withAge(Math.random() * 168); // Random age up to 1 week

      // Randomly assign some incidents
      if (Math.random() > 0.3) {
        builder.withAssignment(
          teams[i % teams.length],
          `user.${(i % 10).toString().padStart(2, '0')}`
        );
      }

      // Add SLA violations for some incidents
      if (Math.random() > 0.8) {
        builder.withSlaViolation(true);
      }

      incidents.push(builder.build());
    }

    return incidents;
  }
}

// User test fixtures
export class UserFixtures {
  static readonly END_USER = {
    id: 'end.user.001',
    name: 'End User',
    email: 'end.user@company.com',
    role: 'end_user' as const,
    team: 'Business',
    permissions: ['report_incident', 'view_own_incidents', 'comment'],
    preferences: {
      notifications: true,
      emailUpdates: true
    }
  };

  static readonly SUPPORT_AGENT = {
    id: 'support.agent.001',
    name: 'Support Agent',
    email: 'support.agent@company.com',
    role: 'support_agent' as const,
    team: 'Support',
    permissions: ['report_incident', 'view_incidents', 'update_status', 'assign', 'comment'],
    preferences: {
      notifications: true,
      emailUpdates: true,
      autoAssign: false
    }
  };

  static readonly TEAM_LEAD = {
    id: 'team.lead.001',
    name: 'Team Lead',
    email: 'team.lead@company.com',
    role: 'team_lead' as const,
    team: 'Infrastructure',
    permissions: ['report_incident', 'view_incidents', 'update_status', 'assign', 'comment', 'escalate', 'generate_reports'],
    preferences: {
      notifications: true,
      emailUpdates: true,
      teamNotifications: true
    }
  };

  static readonly MANAGER = {
    id: 'manager.001',
    name: 'IT Manager',
    email: 'manager@company.com',
    role: 'manager' as const,
    team: 'Management',
    permissions: ['view_all_incidents', 'update_status', 'assign', 'comment', 'escalate', 'generate_reports', 'export_data'],
    preferences: {
      notifications: true,
      emailUpdates: true,
      dashboardUpdates: true
    }
  };

  static readonly ADMIN = {
    id: 'admin.001',
    name: 'System Administrator',
    email: 'admin@company.com',
    role: 'admin' as const,
    team: 'Administration',
    permissions: ['*'], // All permissions
    preferences: {
      notifications: true,
      emailUpdates: true,
      systemAlerts: true
    }
  };

  static getAllUsers(): TestUser[] {
    return [
      this.END_USER,
      this.SUPPORT_AGENT,
      this.TEAM_LEAD,
      this.MANAGER,
      this.ADMIN
    ];
  }

  static getUserByRole(role: string): TestUser | undefined {
    return this.getAllUsers().find(user => user.role === role);
  }
}

// Team test fixtures
export class TeamFixtures {
  static readonly INFRASTRUCTURE = {
    id: 'team-infrastructure',
    name: 'Infrastructure',
    members: ['john.doe', 'jane.smith', 'infrastructure.lead'],
    escalationContact: 'infrastructure.manager',
    slaTargets: {
      critical: 2 * 60, // 2 hours
      high: 4 * 60, // 4 hours
      medium: 8 * 60, // 8 hours
      low: 24 * 60 // 24 hours
    }
  };

  static readonly DATABASE = {
    id: 'team-database',
    name: 'Database',
    members: ['db.admin', 'db.developer', 'database.lead'],
    escalationContact: 'database.manager',
    slaTargets: {
      critical: 1 * 60, // 1 hour
      high: 3 * 60, // 3 hours
      medium: 6 * 60, // 6 hours
      low: 24 * 60 // 24 hours
    }
  };

  static readonly FRONTEND = {
    id: 'team-frontend',
    name: 'Frontend',
    members: ['ui.developer', 'ux.designer', 'frontend.lead'],
    escalationContact: 'frontend.manager',
    slaTargets: {
      critical: 4 * 60, // 4 hours
      high: 8 * 60, // 8 hours
      medium: 16 * 60, // 16 hours
      low: 48 * 60 // 48 hours
    }
  };

  static getAllTeams(): TestTeam[] {
    return [
      this.INFRASTRUCTURE,
      this.DATABASE,
      this.FRONTEND
    ];
  }

  static getTeamById(id: string): TestTeam | undefined {
    return this.getAllTeams().find(team => team.id === id);
  }
}

// Utility functions for test assertions
export class TestUtils {
  static assertIncidentValid(incident: TestIncident): void {
    expect(incident.id).toBeDefined();
    expect(incident.id).toMatch(/^INC-/);
    expect(incident.title).toBeDefined();
    expect(incident.description).toBeDefined();
    expect(['critical', 'high', 'medium', 'low']).toContain(incident.priority);
    expect(['new', 'assigned', 'in_progress', 'blocked', 'resolved', 'closed']).toContain(incident.status);
    expect(incident.createdAt).toBeInstanceOf(Date);
    expect(incident.updatedAt).toBeInstanceOf(Date);
    expect(incident.sla).toBeDefined();
    expect(incident.timeline).toBeDefined();
    expect(incident.comments).toBeDefined();
  }

  static assertTimelineValid(timeline: TimelineEvent[]): void {
    expect(timeline.length).toBeGreaterThan(0);

    // First event should be creation
    expect(timeline[0].event).toBe('Incident Created');

    // Events should be in chronological order
    for (let i = 1; i < timeline.length; i++) {
      expect(timeline[i].timestamp.getTime()).toBeGreaterThanOrEqual(
        timeline[i - 1].timestamp.getTime()
      );
    }
  }

  static assertSlaCalculationValid(incident: TestIncident): void {
    const timeSinceCreation = Date.now() - incident.createdAt.getTime();
    const expectedRemaining = incident.sla.target - timeSinceCreation;
    const expectedViolated = timeSinceCreation > incident.sla.target;

    if (incident.status === 'resolved' || incident.status === 'closed') {
      // For resolved/closed incidents, SLA should be based on resolution time
      return;
    }

    expect(incident.sla.violated).toBe(expectedViolated);

    if (!incident.sla.violated) {
      expect(incident.sla.remainingTime).toBeCloseTo(expectedRemaining, -2); // Within 100ms
    }
  }

  static generateTestMetrics(incidents: TestIncident[]): any {
    return {
      total: incidents.length,
      byStatus: this.groupBy(incidents, 'status'),
      byPriority: this.groupBy(incidents, 'priority'),
      byCategory: this.groupBy(incidents, 'category'),
      slaCompliance: this.calculateSlaCompliance(incidents),
      avgResolutionTime: this.calculateAvgResolutionTime(incidents)
    };
  }

  private static groupBy(incidents: TestIncident[], field: string): Record<string, number> {
    return incidents.reduce((groups, incident) => {
      const key = incident[field as keyof TestIncident] as string;
      groups[key] = (groups[key] || 0) + 1;
      return groups;
    }, {} as Record<string, number>);
  }

  private static calculateSlaCompliance(incidents: TestIncident[]): number {
    if (incidents.length === 0) return 100;

    const compliantIncidents = incidents.filter(incident => !incident.sla.violated);
    return (compliantIncidents.length / incidents.length) * 100;
  }

  private static calculateAvgResolutionTime(incidents: TestIncident[]): number {
    const resolvedIncidents = incidents.filter(incident =>
      incident.status === 'resolved' && incident.resolvedAt
    );

    if (resolvedIncidents.length === 0) return 0;

    const totalTime = resolvedIncidents.reduce((sum, incident) => {
      return sum + (incident.resolvedAt!.getTime() - incident.createdAt.getTime());
    }, 0);

    return totalTime / resolvedIncidents.length;
  }

  // Mock data generators
  static generateMockApiResponse(data: any, success: boolean = true): any {
    return {
      success,
      data: success ? data : null,
      error: success ? null : { message: 'Mock API error' },
      timestamp: new Date().toISOString(),
      requestId: `mock-${Math.random().toString(36).substr(2, 9)}`
    };
  }

  static generateMockNotification(type: string, data: any): any {
    return {
      id: `notif-${Date.now()}`,
      type,
      data,
      timestamp: new Date(),
      read: false,
      channel: 'email'
    };
  }

  static simulateNetworkDelay(minMs: number = 100, maxMs: number = 500): Promise<void> {
    const delay = Math.random() * (maxMs - minMs) + minMs;
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  static createMockError(message: string, code?: string): Error {
    const error = new Error(message);
    if (code) {
      (error as any).code = code;
    }
    return error;
  }
}

// Performance testing utilities
export class PerformanceTestUtils {
  static measureExecutionTime<T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
    const start = performance.now();
    return fn().then(result => ({
      result,
      duration: performance.now() - start
    }));
  }

  static async measureMemoryUsage<T>(fn: () => Promise<T>): Promise<{ result: T; memoryDelta: number }> {
    const initialMemory = this.getMemoryUsage();
    const result = await fn();
    const finalMemory = this.getMemoryUsage();

    return {
      result,
      memoryDelta: finalMemory - initialMemory
    };
  }

  private static getMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed / 1024 / 1024; // MB
    }
    return 0;
  }

  static createPerformanceBenchmark(name: string, threshold: number) {
    return {
      name,
      threshold,
      measure: async <T>(fn: () => Promise<T>): Promise<T> => {
        const start = performance.now();
        const result = await fn();
        const duration = performance.now() - start;

        if (duration > threshold) {
          console.warn(`Performance warning: ${name} took ${duration.toFixed(2)}ms (threshold: ${threshold}ms)`);
        }

        return result;
      }
    };
  }
}

export default {
  IncidentFixtureBuilder,
  IncidentFixtures,
  UserFixtures,
  TeamFixtures,
  TestUtils,
  PerformanceTestUtils
};