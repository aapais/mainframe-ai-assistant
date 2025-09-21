/**
 * Mock Services for Incident Management Testing
 * Provides mock implementations of all services used in incident management
 */

import { jest } from '@jest/globals';
import { TestIncident, TestUser, TestUtils } from './TestFixtures';

// Mock Database Service
export class MockDatabaseService {
  private incidents: Map<string, TestIncident> = new Map();
  private users: Map<string, TestUser> = new Map();
  private isConnected: boolean = true;
  private latency: number = 50; // Simulated latency in ms

  constructor(initialLatency: number = 50) {
    this.latency = initialLatency;
  }

  // Incident operations
  async createIncident(incident: Omit<TestIncident, 'id' | 'createdAt' | 'updatedAt'>): Promise<TestIncident> {
    await this.simulateLatency();
    this.throwIfDisconnected();

    const fullIncident: TestIncident = {
      ...incident,
      id: `INC-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.incidents.set(fullIncident.id, fullIncident);
    return fullIncident;
  }

  async getIncident(id: string): Promise<TestIncident | null> {
    await this.simulateLatency();
    this.throwIfDisconnected();

    return this.incidents.get(id) || null;
  }

  async updateIncident(id: string, updates: Partial<TestIncident>): Promise<TestIncident> {
    await this.simulateLatency();
    this.throwIfDisconnected();

    const incident = this.incidents.get(id);
    if (!incident) {
      throw new Error(`Incident ${id} not found`);
    }

    const updatedIncident = {
      ...incident,
      ...updates,
      updatedAt: new Date()
    };

    this.incidents.set(id, updatedIncident);
    return updatedIncident;
  }

  async deleteIncident(id: string): Promise<boolean> {
    await this.simulateLatency();
    this.throwIfDisconnected();

    return this.incidents.delete(id);
  }

  async searchIncidents(query: string, filters?: any): Promise<TestIncident[]> {
    await this.simulateLatency();
    this.throwIfDisconnected();

    let incidents = Array.from(this.incidents.values());

    // Apply search query
    if (query) {
      const searchTerm = query.toLowerCase();
      incidents = incidents.filter(incident =>
        incident.title.toLowerCase().includes(searchTerm) ||
        incident.description.toLowerCase().includes(searchTerm) ||
        incident.id.toLowerCase().includes(searchTerm) ||
        incident.tags.some(tag => tag.toLowerCase().includes(searchTerm))
      );
    }

    // Apply filters
    if (filters) {
      if (filters.status) {
        incidents = incidents.filter(i => filters.status.includes(i.status));
      }
      if (filters.priority) {
        incidents = incidents.filter(i => filters.priority.includes(i.priority));
      }
      if (filters.assignee) {
        incidents = incidents.filter(i => i.assignee === filters.assignee);
      }
      if (filters.team) {
        incidents = incidents.filter(i => i.assignedTeam === filters.team);
      }
      if (filters.dateRange) {
        incidents = incidents.filter(i => {
          const incidentDate = new Date(i.createdAt);
          return incidentDate >= filters.dateRange.start && incidentDate <= filters.dateRange.end;
        });
      }
    }

    return incidents;
  }

  async getIncidentsByStatus(status: string): Promise<TestIncident[]> {
    await this.simulateLatency();
    this.throwIfDisconnected();

    return Array.from(this.incidents.values()).filter(incident => incident.status === status);
  }

  async getIncidentMetrics(): Promise<any> {
    await this.simulateLatency();
    this.throwIfDisconnected();

    const incidents = Array.from(this.incidents.values());
    return TestUtils.generateTestMetrics(incidents);
  }

  // User operations
  async getUser(id: string): Promise<TestUser | null> {
    await this.simulateLatency();
    this.throwIfDisconnected();

    return this.users.get(id) || null;
  }

  async createUser(user: TestUser): Promise<TestUser> {
    await this.simulateLatency();
    this.throwIfDisconnected();

    this.users.set(user.id, user);
    return user;
  }

  // Utility methods
  setLatency(latency: number): void {
    this.latency = latency;
  }

  disconnect(): void {
    this.isConnected = false;
  }

  reconnect(): void {
    this.isConnected = true;
  }

  clear(): void {
    this.incidents.clear();
    this.users.clear();
  }

  seedData(incidents: TestIncident[], users: TestUser[] = []): void {
    incidents.forEach(incident => this.incidents.set(incident.id, incident));
    users.forEach(user => this.users.set(user.id, user));
  }

  private async simulateLatency(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, this.latency));
  }

  private throwIfDisconnected(): void {
    if (!this.isConnected) {
      throw new Error('Database connection lost');
    }
  }
}

// Mock Notification Service
export class MockNotificationService {
  private notifications: Array<{
    id: string;
    type: string;
    recipient: string;
    channel: string;
    message: string;
    timestamp: Date;
    status: 'sent' | 'failed' | 'pending';
  }> = [];

  private channelFailures: Set<string> = new Set();
  private globalFailure: boolean = false;

  async send(params: {
    type: string;
    recipient: string;
    channel: string;
    message: string;
    incident?: TestIncident;
  }): Promise<{ success: boolean; notificationId?: string; error?: string }> {
    await TestUtils.simulateNetworkDelay(50, 200);

    if (this.globalFailure) {
      return { success: false, error: 'Notification service unavailable' };
    }

    if (this.channelFailures.has(params.channel)) {
      return { success: false, error: `Channel ${params.channel} is unavailable` };
    }

    const notification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      type: params.type,
      recipient: params.recipient,
      channel: params.channel,
      message: params.message,
      timestamp: new Date(),
      status: 'sent' as const
    };

    this.notifications.push(notification);

    return { success: true, notificationId: notification.id };
  }

  async sendBulk(notifications: Array<{
    type: string;
    recipient: string;
    channel: string;
    message: string;
  }>): Promise<Array<{ success: boolean; notificationId?: string; error?: string }>> {
    const results = [];

    for (const notification of notifications) {
      const result = await this.send(notification);
      results.push(result);
    }

    return results;
  }

  getNotifications(): typeof this.notifications {
    return [...this.notifications];
  }

  getNotificationsByType(type: string): typeof this.notifications {
    return this.notifications.filter(n => n.type === type);
  }

  getNotificationsByRecipient(recipient: string): typeof this.notifications {
    return this.notifications.filter(n => n.recipient === recipient);
  }

  clearNotifications(): void {
    this.notifications = [];
  }

  simulateChannelFailure(channel: string): void {
    this.channelFailures.add(channel);
  }

  restoreChannel(channel: string): void {
    this.channelFailures.delete(channel);
  }

  simulateGlobalFailure(): void {
    this.globalFailure = true;
  }

  restoreService(): void {
    this.globalFailure = false;
    this.channelFailures.clear();
  }
}

// Mock SLA Service
export class MockSlaService {
  private slaTargets: Map<string, Record<string, number>> = new Map();

  constructor() {
    // Default SLA targets (in milliseconds)
    this.slaTargets.set('default', {
      critical: 2 * 60 * 60 * 1000, // 2 hours
      high: 4 * 60 * 60 * 1000, // 4 hours
      medium: 8 * 60 * 60 * 1000, // 8 hours
      low: 24 * 60 * 60 * 1000 // 24 hours
    });
  }

  async calculateSlaStatus(incident: TestIncident): Promise<{
    target: number;
    elapsed: number;
    remaining: number;
    violated: boolean;
    riskLevel: 'low' | 'medium' | 'high';
  }> {
    const target = this.getSlaTarget(incident.category, incident.priority);
    const elapsed = Date.now() - incident.createdAt.getTime();
    const remaining = target - elapsed;
    const violated = elapsed > target;

    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    if (violated) {
      riskLevel = 'high';
    } else if (remaining < target * 0.2) {
      riskLevel = 'high';
    } else if (remaining < target * 0.5) {
      riskLevel = 'medium';
    }

    return {
      target,
      elapsed,
      remaining,
      violated,
      riskLevel
    };
  }

  async calculateTeamSlaCompliance(team: string, period: 'day' | 'week' | 'month' = 'month'): Promise<{
    totalIncidents: number;
    compliantIncidents: number;
    complianceRate: number;
    avgResolutionTime: number;
  }> {
    // Mock implementation
    const totalIncidents = Math.floor(Math.random() * 100) + 50;
    const compliantIncidents = Math.floor(totalIncidents * (0.8 + Math.random() * 0.2));
    const complianceRate = (compliantIncidents / totalIncidents) * 100;
    const avgResolutionTime = Math.random() * 24 * 60 * 60 * 1000; // Random up to 24 hours

    return {
      totalIncidents,
      compliantIncidents,
      complianceRate,
      avgResolutionTime
    };
  }

  setSlaTarget(category: string, priority: string, target: number): void {
    if (!this.slaTargets.has(category)) {
      this.slaTargets.set(category, {});
    }
    const categoryTargets = this.slaTargets.get(category)!;
    categoryTargets[priority] = target;
  }

  getSlaTarget(category: string, priority: string): number {
    const categoryTargets = this.slaTargets.get(category) || this.slaTargets.get('default')!;
    return categoryTargets[priority] || categoryTargets['medium'];
  }
}

// Mock Audit Service
export class MockAuditService {
  private auditLog: Array<{
    id: string;
    eventType: string;
    incidentId?: string;
    userId: string;
    timestamp: Date;
    details: any;
  }> = [];

  async recordEvent(event: {
    eventType: string;
    incidentId?: string;
    userId: string;
    details: any;
  }): Promise<void> {
    const auditEntry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      ...event,
      timestamp: new Date()
    };

    this.auditLog.push(auditEntry);
  }

  async getAuditLog(filters?: {
    incidentId?: string;
    userId?: string;
    eventType?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<typeof this.auditLog> {
    let filteredLog = [...this.auditLog];

    if (filters) {
      if (filters.incidentId) {
        filteredLog = filteredLog.filter(entry => entry.incidentId === filters.incidentId);
      }
      if (filters.userId) {
        filteredLog = filteredLog.filter(entry => entry.userId === filters.userId);
      }
      if (filters.eventType) {
        filteredLog = filteredLog.filter(entry => entry.eventType === filters.eventType);
      }
      if (filters.startDate) {
        filteredLog = filteredLog.filter(entry => entry.timestamp >= filters.startDate!);
      }
      if (filters.endDate) {
        filteredLog = filteredLog.filter(entry => entry.timestamp <= filters.endDate!);
      }
    }

    return filteredLog.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  clearAuditLog(): void {
    this.auditLog = [];
  }

  getEventCount(eventType: string): number {
    return this.auditLog.filter(entry => entry.eventType === eventType).length;
  }
}

// Mock Analytics Service
export class MockAnalyticsService {
  private metrics: Map<string, any> = new Map();

  async recordMetric(name: string, value: number, tags?: Record<string, string>): Promise<void> {
    const metric = {
      name,
      value,
      tags: tags || {},
      timestamp: new Date()
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    this.metrics.get(name)!.push(metric);
  }

  async getMetric(name: string, timeRange?: { start: Date; end: Date }): Promise<any[]> {
    const metricData = this.metrics.get(name) || [];

    if (timeRange) {
      return metricData.filter((metric: any) =>
        metric.timestamp >= timeRange.start && metric.timestamp <= timeRange.end
      );
    }

    return metricData;
  }

  async getIncidentTrends(period: 'day' | 'week' | 'month' = 'week'): Promise<{
    labels: string[];
    datasets: Array<{
      label: string;
      data: number[];
    }>;
  }> {
    // Mock trend data
    const periods = period === 'day' ? 24 : period === 'week' ? 7 : 30;
    const labels = Array.from({ length: periods }, (_, i) => {
      const date = new Date();
      if (period === 'day') {
        date.setHours(date.getHours() - (periods - 1 - i));
        return date.toLocaleTimeString([], { hour: '2-digit' });
      } else {
        date.setDate(date.getDate() - (periods - 1 - i));
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
      }
    });

    const datasets = [
      {
        label: 'New Incidents',
        data: Array.from({ length: periods }, () => Math.floor(Math.random() * 10))
      },
      {
        label: 'Resolved Incidents',
        data: Array.from({ length: periods }, () => Math.floor(Math.random() * 8))
      }
    ];

    return { labels, datasets };
  }

  async getMetricsSummary(): Promise<{
    totalIncidents: number;
    averageResolutionTime: number;
    slaCompliance: number;
    topCategories: Array<{ category: string; count: number }>;
  }> {
    return {
      totalIncidents: Math.floor(Math.random() * 1000) + 500,
      averageResolutionTime: Math.random() * 24 * 60 * 60 * 1000, // Random up to 24 hours
      slaCompliance: 85 + Math.random() * 15, // 85-100%
      topCategories: [
        { category: 'Infrastructure', count: Math.floor(Math.random() * 50) + 20 },
        { category: 'Application', count: Math.floor(Math.random() * 40) + 15 },
        { category: 'Database', count: Math.floor(Math.random() * 30) + 10 }
      ]
    };
  }

  clearMetrics(): void {
    this.metrics.clear();
  }
}

// Mock Escalation Service
export class MockEscalationService {
  private escalationRules: Map<string, any> = new Map();
  private scheduledEscalations: Map<string, any> = new Map();

  async scheduleEscalation(params: {
    incidentId: string;
    level: number;
    delayMinutes: number;
    targetTeam: string;
    condition: string;
  }): Promise<string> {
    const escalationId = `esc-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

    const escalation = {
      id: escalationId,
      ...params,
      scheduledAt: new Date(),
      executedAt: null,
      status: 'scheduled'
    };

    this.scheduledEscalations.set(escalationId, escalation);

    // Simulate automatic execution after delay (for testing)
    setTimeout(() => {
      this.executeEscalation(escalationId);
    }, params.delayMinutes * 1000); // Convert to seconds for testing

    return escalationId;
  }

  async executeEscalation(escalationId: string): Promise<boolean> {
    const escalation = this.scheduledEscalations.get(escalationId);
    if (!escalation || escalation.status !== 'scheduled') {
      return false;
    }

    escalation.executedAt = new Date();
    escalation.status = 'executed';

    // Here you would typically trigger notifications, assignments, etc.
    console.log(`Escalation executed: Level ${escalation.level} for incident ${escalation.incidentId}`);

    return true;
  }

  async cancelEscalation(escalationId: string): Promise<boolean> {
    const escalation = this.scheduledEscalations.get(escalationId);
    if (!escalation || escalation.status !== 'scheduled') {
      return false;
    }

    escalation.status = 'cancelled';
    return true;
  }

  getScheduledEscalations(incidentId?: string): any[] {
    const escalations = Array.from(this.scheduledEscalations.values());

    if (incidentId) {
      return escalations.filter(esc => esc.incidentId === incidentId);
    }

    return escalations;
  }

  clearEscalations(): void {
    this.scheduledEscalations.clear();
  }
}

// Mock Service Factory
export class MockServiceFactory {
  private static instance: MockServiceFactory;
  private services: Map<string, any> = new Map();

  private constructor() {
    this.initializeServices();
  }

  static getInstance(): MockServiceFactory {
    if (!MockServiceFactory.instance) {
      MockServiceFactory.instance = new MockServiceFactory();
    }
    return MockServiceFactory.instance;
  }

  private initializeServices(): void {
    this.services.set('database', new MockDatabaseService());
    this.services.set('notification', new MockNotificationService());
    this.services.set('sla', new MockSlaService());
    this.services.set('audit', new MockAuditService());
    this.services.set('analytics', new MockAnalyticsService());
    this.services.set('escalation', new MockEscalationService());
  }

  getService(name: string): any {
    return this.services.get(name);
  }

  getDatabaseService(): MockDatabaseService {
    return this.services.get('database');
  }

  getNotificationService(): MockNotificationService {
    return this.services.get('notification');
  }

  getSlaService(): MockSlaService {
    return this.services.get('sla');
  }

  getAuditService(): MockAuditService {
    return this.services.get('audit');
  }

  getAnalyticsService(): MockAnalyticsService {
    return this.services.get('analytics');
  }

  getEscalationService(): MockEscalationService {
    return this.services.get('escalation');
  }

  reset(): void {
    this.services.forEach(service => {
      if (typeof service.clear === 'function') {
        service.clear();
      }
      if (typeof service.clearNotifications === 'function') {
        service.clearNotifications();
      }
      if (typeof service.clearAuditLog === 'function') {
        service.clearAuditLog();
      }
      if (typeof service.clearMetrics === 'function') {
        service.clearMetrics();
      }
      if (typeof service.clearEscalations === 'function') {
        service.clearEscalations();
      }
      if (typeof service.restoreService === 'function') {
        service.restoreService();
      }
    });
  }

  simulateServiceFailures(serviceNames: string[]): void {
    serviceNames.forEach(serviceName => {
      const service = this.services.get(serviceName);
      if (service) {
        if (typeof service.disconnect === 'function') {
          service.disconnect();
        }
        if (typeof service.simulateGlobalFailure === 'function') {
          service.simulateGlobalFailure();
        }
      }
    });
  }

  restoreServices(): void {
    this.services.forEach(service => {
      if (typeof service.reconnect === 'function') {
        service.reconnect();
      }
      if (typeof service.restoreService === 'function') {
        service.restoreService();
      }
    });
  }
}

export default {
  MockDatabaseService,
  MockNotificationService,
  MockSlaService,
  MockAuditService,
  MockAnalyticsService,
  MockEscalationService,
  MockServiceFactory
};