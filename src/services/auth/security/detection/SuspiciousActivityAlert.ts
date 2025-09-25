/**
 * Suspicious Activity Alert System
 * Advanced behavioral analysis and anomaly detection
 */

import { EventEmitter } from 'events';
import { AuditService, AuditEvent } from '../audit/AuditService';

export interface ActivityProfile {
  userId: string;
  ipAddresses: Map<string, IPActivity>;
  userAgents: Map<string, number>;
  accessPatterns: Map<string, AccessPattern>;
  timePatterns: Map<number, number>; // hour -> count
  geolocation: Map<string, LocationActivity>;
  riskScore: number;
  baselineEstablished: boolean;
  lastAnalysis: Date;
  anomalies: ActivityAnomaly[];
}

export interface IPActivity {
  ip: string;
  firstSeen: Date;
  lastSeen: Date;
  requestCount: number;
  successRate: number;
  locations: string[];
  suspicious: boolean;
}

export interface AccessPattern {
  resource: string;
  frequency: number;
  typicalTimes: number[]; // hours
  averageDuration: number;
  errorRate: number;
}

export interface LocationActivity {
  country: string;
  city: string;
  firstSeen: Date;
  lastSeen: Date;
  requestCount: number;
  confidence: number;
}

export interface ActivityAnomaly {
  id: string;
  type: AnomalyType;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  timestamp: Date;
  description: string;
  evidence: Record<string, any>;
  riskScore: number;
  confidence: number;
}

export enum AnomalyType {
  UNUSUAL_LOCATION = 'UNUSUAL_LOCATION',
  UNUSUAL_TIME = 'UNUSUAL_TIME',
  UNUSUAL_VOLUME = 'UNUSUAL_VOLUME',
  UNUSUAL_PATTERN = 'UNUSUAL_PATTERN',
  DEVICE_CHANGE = 'DEVICE_CHANGE',
  PRIVILEGE_ESCALATION = 'PRIVILEGE_ESCALATION',
  RAPID_SUCCESSION = 'RAPID_SUCCESSION',
  IMPOSSIBLE_TRAVEL = 'IMPOSSIBLE_TRAVEL',
  SUSPICIOUS_ENDPOINT = 'SUSPICIOUS_ENDPOINT',
  ABNORMAL_BEHAVIOR = 'ABNORMAL_BEHAVIOR'
}

export interface SuspiciousAlert {
  id: string;
  userId: string;
  timestamp: Date;
  anomalies: ActivityAnomaly[];
  overallRiskScore: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  triggerEvent: AuditEvent;
  recommendedActions: string[];
  metadata: Record<string, any>;
}

export class SuspiciousActivityAlert extends EventEmitter {
  private profiles: Map<string, ActivityProfile> = new Map();
  private ipGeolocation: Map<string, GeolocationInfo> = new Map();
  private baselineWindow = 30 * 24 * 60 * 60 * 1000; // 30 days
  private analysisThresholds: AnalysisThresholds;
  private mlModels: MLModels;

  constructor(
    private auditService: AuditService,
    private config: SuspiciousActivityConfig
  ) {
    super();
    this.analysisThresholds = this.initializeThresholds();
    this.mlModels = this.initializeMLModels();
    this.setupEventMonitoring();
    this.setupPeriodicAnalysis();
  }

  /**
   * Process a new audit event for suspicious activity
   */
  async processEvent(event: AuditEvent): Promise<void> {
    if (!event.userId) return;

    // Update user profile
    await this.updateUserProfile(event);

    // Analyze for anomalies
    const anomalies = await this.detectAnomalies(event);

    if (anomalies.length > 0) {
      await this.generateAlert(event, anomalies);
    }
  }

  /**
   * Get user activity profile
   */
  getUserProfile(userId: string): ActivityProfile | undefined {
    return this.profiles.get(userId);
  }

  /**
   * Get all users with suspicious activity
   */
  getSuspiciousUsers(): Array<{ userId: string; riskScore: number; anomalies: number }> {
    return Array.from(this.profiles.values())
      .filter(profile => profile.riskScore > 30)
      .map(profile => ({
        userId: profile.userId,
        riskScore: profile.riskScore,
        anomalies: profile.anomalies.length
      }))
      .sort((a, b) => b.riskScore - a.riskScore);
  }

  /**
   * Manually investigate a user
   */
  async investigateUser(userId: string): Promise<UserInvestigationReport> {
    const profile = this.profiles.get(userId);
    if (!profile) {
      throw new Error('User profile not found');
    }

    // Perform deep analysis
    const recentEvents = await this.auditService.queryEvents({
      userId,
      startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
      limit: 1000
    });

    const timeline = this.buildActivityTimeline(recentEvents);
    const behaviorAnalysis = this.analyzeBehaviorPatterns(profile, recentEvents);
    const riskAssessment = this.assessUserRisk(profile, recentEvents);

    return {
      userId,
      profile,
      timeline,
      behaviorAnalysis,
      riskAssessment,
      recommendations: this.generateInvestigationRecommendations(profile),
      generatedAt: new Date()
    };
  }

  /**
   * Update user activity profile
   */
  private async updateUserProfile(event: AuditEvent): Promise<void> {
    const userId = event.userId!;
    const profile = this.profiles.get(userId) || this.createNewProfile(userId);

    // Update IP activity
    this.updateIPActivity(profile, event);

    // Update user agent tracking
    if (event.userAgent) {
      const count = profile.userAgents.get(event.userAgent) || 0;
      profile.userAgents.set(event.userAgent, count + 1);
    }

    // Update access patterns
    this.updateAccessPatterns(profile, event);

    // Update time patterns
    const hour = event.timestamp.getHours();
    const timeCount = profile.timePatterns.get(hour) || 0;
    profile.timePatterns.set(hour, timeCount + 1);

    // Update geolocation if available
    await this.updateGeolocation(profile, event);

    // Recalculate risk score
    profile.riskScore = this.calculateRiskScore(profile);
    profile.lastAnalysis = new Date();

    this.profiles.set(userId, profile);
  }

  /**
   * Detect anomalies in user behavior
   */
  private async detectAnomalies(event: AuditEvent): Promise<ActivityAnomaly[]> {
    const userId = event.userId!;
    const profile = this.profiles.get(userId)!;
    const anomalies: ActivityAnomaly[] = [];

    // Skip analysis if baseline not established
    if (!profile.baselineEstablished) {
      return anomalies;
    }

    // Location anomaly detection
    const locationAnomaly = await this.detectLocationAnomaly(event, profile);
    if (locationAnomaly) anomalies.push(locationAnomaly);

    // Time pattern anomaly
    const timeAnomaly = this.detectTimeAnomaly(event, profile);
    if (timeAnomaly) anomalies.push(timeAnomaly);

    // Volume anomaly
    const volumeAnomaly = this.detectVolumeAnomaly(event, profile);
    if (volumeAnomaly) anomalies.push(volumeAnomaly);

    // Device/User Agent change
    const deviceAnomaly = this.detectDeviceAnomaly(event, profile);
    if (deviceAnomaly) anomalies.push(deviceAnomaly);

    // Privilege escalation
    const privilegeAnomaly = this.detectPrivilegeEscalation(event, profile);
    if (privilegeAnomaly) anomalies.push(privilegeAnomaly);

    // Rapid succession detection
    const rapidAnomaly = this.detectRapidSuccession(event, profile);
    if (rapidAnomaly) anomalies.push(rapidAnomaly);

    // Impossible travel
    const travelAnomaly = await this.detectImpossibleTravel(event, profile);
    if (travelAnomaly) anomalies.push(travelAnomaly);

    // Unusual endpoint access
    const endpointAnomaly = this.detectUnusualEndpoint(event, profile);
    if (endpointAnomaly) anomalies.push(endpointAnomaly);

    // Store anomalies in profile
    profile.anomalies.push(...anomalies);

    // Keep only recent anomalies (last 30 days)
    const cutoffTime = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    profile.anomalies = profile.anomalies.filter(a => a.timestamp > cutoffTime);

    return anomalies;
  }

  /**
   * Detect location-based anomalies
   */
  private async detectLocationAnomaly(
    event: AuditEvent,
    profile: ActivityProfile
  ): Promise<ActivityAnomaly | null> {
    const ipInfo = await this.getIPGeolocation(event.ipAddress);
    if (!ipInfo) return null;

    const location = `${ipInfo.country}-${ipInfo.city}`;
    const locationActivity = profile.geolocation.get(location);

    // Check if this is a new location
    if (!locationActivity) {
      // Calculate distance from known locations
      const distances = Array.from(profile.geolocation.keys()).map(loc => {
        const [country, city] = loc.split('-');
        return this.calculateDistance(
          { country, city },
          { country: ipInfo.country, city: ipInfo.city }
        );
      });

      const minDistance = Math.min(...distances);

      if (minDistance > this.analysisThresholds.unusualLocationThreshold) {
        return {
          id: crypto.randomUUID(),
          type: AnomalyType.UNUSUAL_LOCATION,
          severity: minDistance > 5000 ? 'HIGH' : 'MEDIUM',
          timestamp: new Date(),
          description: `Access from unusual location: ${ipInfo.city}, ${ipInfo.country}`,
          evidence: {
            newLocation: location,
            distance: minDistance,
            ipAddress: event.ipAddress,
            previousLocations: Array.from(profile.geolocation.keys())
          },
          riskScore: Math.min(minDistance / 100, 50),
          confidence: 0.8
        };
      }
    }

    return null;
  }

  /**
   * Detect time-based anomalies
   */
  private detectTimeAnomaly(
    event: AuditEvent,
    profile: ActivityProfile
  ): ActivityAnomaly | null {
    const hour = event.timestamp.getHours();
    const totalRequests = Array.from(profile.timePatterns.values()).reduce((a, b) => a + b, 0);
    const hourlyPercentage = (profile.timePatterns.get(hour) || 0) / totalRequests;

    // If this hour represents less than 5% of typical activity
    if (hourlyPercentage < 0.05 && totalRequests > 50) {
      return {
        id: crypto.randomUUID(),
        type: AnomalyType.UNUSUAL_TIME,
        severity: 'MEDIUM',
        timestamp: new Date(),
        description: `Access at unusual time: ${hour}:00`,
        evidence: {
          hour,
          typicalPercentage: hourlyPercentage * 100,
          totalRequests
        },
        riskScore: 20,
        confidence: 0.7
      };
    }

    return null;
  }

  /**
   * Detect volume-based anomalies
   */
  private detectVolumeAnomaly(
    event: AuditEvent,
    profile: ActivityProfile
  ): ActivityAnomaly | null {
    const recentHour = new Date();
    recentHour.setMinutes(0, 0, 0);

    // Count events in the last hour (would need to be implemented with event tracking)
    const recentEvents = this.getRecentEventCount(profile, recentHour);
    const averageHourly = this.getAverageHourlyRequests(profile);

    if (recentEvents > averageHourly * this.analysisThresholds.volumeMultiplier) {
      return {
        id: crypto.randomUUID(),
        type: AnomalyType.UNUSUAL_VOLUME,
        severity: recentEvents > averageHourly * 5 ? 'HIGH' : 'MEDIUM',
        timestamp: new Date(),
        description: `Unusual request volume: ${recentEvents} requests in last hour`,
        evidence: {
          recentCount: recentEvents,
          averageHourly,
          multiplier: recentEvents / averageHourly
        },
        riskScore: Math.min((recentEvents / averageHourly) * 10, 40),
        confidence: 0.8
      };
    }

    return null;
  }

  /**
   * Detect device/user agent changes
   */
  private detectDeviceAnomaly(
    event: AuditEvent,
    profile: ActivityProfile
  ): ActivityAnomaly | null {
    if (!event.userAgent) return null;

    const isKnownUserAgent = profile.userAgents.has(event.userAgent);
    const userAgentCount = profile.userAgents.size;

    // New user agent and user has established pattern
    if (!isKnownUserAgent && userAgentCount > 0) {
      return {
        id: crypto.randomUUID(),
        type: AnomalyType.DEVICE_CHANGE,
        severity: userAgentCount === 1 ? 'HIGH' : 'MEDIUM',
        timestamp: new Date(),
        description: 'New device/browser detected',
        evidence: {
          newUserAgent: event.userAgent,
          knownUserAgents: Array.from(profile.userAgents.keys()),
          previousCount: userAgentCount
        },
        riskScore: userAgentCount === 1 ? 30 : 15,
        confidence: 0.7
      };
    }

    return null;
  }

  /**
   * Detect privilege escalation attempts
   */
  private detectPrivilegeEscalation(
    event: AuditEvent,
    profile: ActivityProfile
  ): ActivityAnomaly | null {
    const adminActions = ['ADMIN_ACTION', 'CONFIGURATION_CHANGE'];

    if (adminActions.includes(event.eventType) && event.outcome === 'FAILURE') {
      return {
        id: crypto.randomUUID(),
        type: AnomalyType.PRIVILEGE_ESCALATION,
        severity: 'HIGH',
        timestamp: new Date(),
        description: 'Failed privilege escalation attempt',
        evidence: {
          eventType: event.eventType,
          resource: event.resource,
          action: event.action,
          ipAddress: event.ipAddress
        },
        riskScore: 40,
        confidence: 0.9
      };
    }

    return null;
  }

  /**
   * Detect rapid succession of requests
   */
  private detectRapidSuccession(
    event: AuditEvent,
    profile: ActivityProfile
  ): ActivityAnomaly | null {
    // This would need to track recent request timestamps
    // Implementation would check if multiple requests happened within seconds
    return null;
  }

  /**
   * Detect impossible travel scenarios
   */
  private async detectImpossibleTravel(
    event: AuditEvent,
    profile: ActivityProfile
  ): Promise<ActivityAnomaly | null> {
    const currentLocation = await this.getIPGeolocation(event.ipAddress);
    if (!currentLocation) return null;

    // Check against recent locations (last 4 hours)
    const recentTimeframe = 4 * 60 * 60 * 1000; // 4 hours
    const cutoffTime = new Date(Date.now() - recentTimeframe);

    // This would need access to recent event timeline
    // For now, return null as full implementation requires event history
    return null;
  }

  /**
   * Detect unusual endpoint access
   */
  private detectUnusualEndpoint(
    event: AuditEvent,
    profile: ActivityProfile
  ): ActivityAnomaly | null {
    const accessPattern = profile.accessPatterns.get(event.resource);

    // New resource access
    if (!accessPattern) {
      // Check if it's a sensitive endpoint
      const sensitivePatterns = ['/admin/', '/api/admin/', '/config/', '/system/'];
      const isSensitive = sensitivePatterns.some(pattern =>
        event.resource.includes(pattern)
      );

      if (isSensitive) {
        return {
          id: crypto.randomUUID(),
          type: AnomalyType.SUSPICIOUS_ENDPOINT,
          severity: 'HIGH',
          timestamp: new Date(),
          description: `Access to sensitive endpoint: ${event.resource}`,
          evidence: {
            resource: event.resource,
            action: event.action,
            outcome: event.outcome,
            firstAccess: true
          },
          riskScore: 35,
          confidence: 0.8
        };
      }
    }

    return null;
  }

  /**
   * Generate alert for suspicious activity
   */
  private async generateAlert(event: AuditEvent, anomalies: ActivityAnomaly[]): Promise<void> {
    const overallRiskScore = anomalies.reduce((sum, a) => sum + a.riskScore, 0);
    const maxSeverity = anomalies.reduce((max, a) =>
      this.compareSeverity(a.severity, max) > 0 ? a.severity : max
    , 'LOW');

    const alert: SuspiciousAlert = {
      id: crypto.randomUUID(),
      userId: event.userId!,
      timestamp: new Date(),
      anomalies,
      overallRiskScore,
      severity: maxSeverity,
      triggerEvent: event,
      recommendedActions: this.generateAlertRecommendations(anomalies),
      metadata: {
        eventCount: anomalies.length,
        highestRisk: Math.max(...anomalies.map(a => a.riskScore)),
        anomalyTypes: anomalies.map(a => a.type)
      }
    };

    this.emit('suspiciousActivity', alert);

    await this.auditService.logSecurityEvent(
      'suspicious_activity_detected',
      maxSeverity,
      event.ipAddress,
      {
        userId: event.userId,
        alertId: alert.id,
        anomalyCount: anomalies.length,
        overallRiskScore,
        anomalyTypes: anomalies.map(a => a.type)
      }
    );
  }

  /**
   * Helper methods
   */
  private createNewProfile(userId: string): ActivityProfile {
    return {
      userId,
      ipAddresses: new Map(),
      userAgents: new Map(),
      accessPatterns: new Map(),
      timePatterns: new Map(),
      geolocation: new Map(),
      riskScore: 0,
      baselineEstablished: false,
      lastAnalysis: new Date(),
      anomalies: []
    };
  }

  private updateIPActivity(profile: ActivityProfile, event: AuditEvent): void {
    const ipActivity = profile.ipAddresses.get(event.ipAddress) || {
      ip: event.ipAddress,
      firstSeen: event.timestamp,
      lastSeen: event.timestamp,
      requestCount: 0,
      successRate: 1.0,
      locations: [],
      suspicious: false
    };

    ipActivity.lastSeen = event.timestamp;
    ipActivity.requestCount++;

    // Update success rate
    const successCount = event.outcome === 'SUCCESS' ? 1 : 0;
    ipActivity.successRate = (ipActivity.successRate * (ipActivity.requestCount - 1) + successCount) / ipActivity.requestCount;

    profile.ipAddresses.set(event.ipAddress, ipActivity);
  }

  private updateAccessPatterns(profile: ActivityProfile, event: AuditEvent): void {
    const pattern = profile.accessPatterns.get(event.resource) || {
      resource: event.resource,
      frequency: 0,
      typicalTimes: [],
      averageDuration: 0,
      errorRate: 0
    };

    pattern.frequency++;
    pattern.typicalTimes.push(event.timestamp.getHours());

    if (event.outcome === 'FAILURE') {
      pattern.errorRate = (pattern.errorRate * (pattern.frequency - 1) + 1) / pattern.frequency;
    } else {
      pattern.errorRate = (pattern.errorRate * (pattern.frequency - 1)) / pattern.frequency;
    }

    profile.accessPatterns.set(event.resource, pattern);
  }

  private async updateGeolocation(profile: ActivityProfile, event: AuditEvent): Promise<void> {
    const ipInfo = await this.getIPGeolocation(event.ipAddress);
    if (!ipInfo) return;

    const location = `${ipInfo.country}-${ipInfo.city}`;
    const locationActivity = profile.geolocation.get(location) || {
      country: ipInfo.country,
      city: ipInfo.city,
      firstSeen: event.timestamp,
      lastSeen: event.timestamp,
      requestCount: 0,
      confidence: ipInfo.confidence
    };

    locationActivity.lastSeen = event.timestamp;
    locationActivity.requestCount++;

    profile.geolocation.set(location, locationActivity);
  }

  private calculateRiskScore(profile: ActivityProfile): number {
    let score = 0;

    // Anomaly score
    score += profile.anomalies.length * 5;

    // IP diversity score
    if (profile.ipAddresses.size > 10) score += 15;

    // User agent diversity score
    if (profile.userAgents.size > 5) score += 10;

    // Location diversity score
    if (profile.geolocation.size > 3) score += 20;

    // Time pattern irregularity
    const timeEntropy = this.calculateTimeEntropy(profile.timePatterns);
    if (timeEntropy > 2.5) score += 10;

    return Math.min(score, 100);
  }

  private calculateTimeEntropy(timePatterns: Map<number, number>): number {
    const total = Array.from(timePatterns.values()).reduce((a, b) => a + b, 0);
    if (total === 0) return 0;

    let entropy = 0;
    for (const count of timePatterns.values()) {
      const probability = count / total;
      if (probability > 0) {
        entropy -= probability * Math.log2(probability);
      }
    }

    return entropy;
  }

  private async getIPGeolocation(ipAddress: string): Promise<GeolocationInfo | null> {
    if (this.ipGeolocation.has(ipAddress)) {
      return this.ipGeolocation.get(ipAddress)!;
    }

    // Implementation would call a geolocation service
    // For now, return mock data
    const mockGeoLocation: GeolocationInfo = {
      country: 'Unknown',
      city: 'Unknown',
      confidence: 0.5,
      latitude: 0,
      longitude: 0
    };

    this.ipGeolocation.set(ipAddress, mockGeoLocation);
    return mockGeoLocation;
  }

  private calculateDistance(loc1: { country: string; city: string }, loc2: { country: string; city: string }): number {
    // Implementation would calculate actual geographical distance
    // For now, return 0 for same country, 1000 for different countries
    return loc1.country === loc2.country ? 0 : 1000;
  }

  private getRecentEventCount(profile: ActivityProfile, since: Date): number {
    // Implementation would count events since the given time
    return 0;
  }

  private getAverageHourlyRequests(profile: ActivityProfile): number {
    const total = Array.from(profile.timePatterns.values()).reduce((a, b) => a + b, 0);
    return total / 24; // Rough average
  }

  private compareSeverity(a: string, b: string): number {
    const levels = { 'LOW': 1, 'MEDIUM': 2, 'HIGH': 3, 'CRITICAL': 4 };
    return levels[a] - levels[b];
  }

  private generateAlertRecommendations(anomalies: ActivityAnomaly[]): string[] {
    const recommendations = new Set<string>();

    for (const anomaly of anomalies) {
      switch (anomaly.type) {
        case AnomalyType.UNUSUAL_LOCATION:
          recommendations.add('Verify user identity');
          recommendations.add('Enable MFA for this user');
          break;
        case AnomalyType.PRIVILEGE_ESCALATION:
          recommendations.add('Review user permissions');
          recommendations.add('Block suspicious IP');
          break;
        case AnomalyType.UNUSUAL_VOLUME:
          recommendations.add('Apply rate limiting');
          recommendations.add('Monitor closely');
          break;
        default:
          recommendations.add('Investigate further');
      }
    }

    return Array.from(recommendations);
  }

  private generateInvestigationRecommendations(profile: ActivityProfile): string[] {
    const recommendations: string[] = [];

    if (profile.riskScore > 70) {
      recommendations.push('Consider account suspension');
      recommendations.push('Force password reset');
      recommendations.push('Enable enhanced monitoring');
    }

    if (profile.geolocation.size > 5) {
      recommendations.push('Implement geo-restrictions');
      recommendations.push('Verify legitimate locations');
    }

    return recommendations;
  }

  private buildActivityTimeline(events: AuditEvent[]): ActivityTimelineEntry[] {
    return events.map(event => ({
      timestamp: event.timestamp,
      eventType: event.eventType,
      resource: event.resource,
      outcome: event.outcome,
      ipAddress: event.ipAddress,
      riskScore: event.riskScore
    }));
  }

  private analyzeBehaviorPatterns(profile: ActivityProfile, events: AuditEvent[]): BehaviorAnalysis {
    return {
      consistencyScore: this.calculateConsistencyScore(profile),
      riskTrends: this.calculateRiskTrends(events),
      anomalyFrequency: profile.anomalies.length / 30, // per day
      baselineDeviation: this.calculateBaselineDeviation(profile)
    };
  }

  private assessUserRisk(profile: ActivityProfile, events: AuditEvent[]): RiskAssessment {
    return {
      currentRisk: profile.riskScore,
      riskCategory: profile.riskScore > 70 ? 'HIGH' : profile.riskScore > 40 ? 'MEDIUM' : 'LOW',
      primaryThreats: this.identifyPrimaryThreats(profile),
      mitigationRecommendations: this.generateInvestigationRecommendations(profile)
    };
  }

  private calculateConsistencyScore(profile: ActivityProfile): number {
    // Implementation would analyze consistency of behavior patterns
    return 75; // Mock value
  }

  private calculateRiskTrends(events: AuditEvent[]): Array<{ date: Date; risk: number }> {
    // Implementation would calculate risk trends over time
    return [];
  }

  private calculateBaselineDeviation(profile: ActivityProfile): number {
    // Implementation would measure deviation from established baseline
    return 15; // Mock percentage
  }

  private identifyPrimaryThreats(profile: ActivityProfile): string[] {
    const threats: string[] = [];

    if (profile.anomalies.some(a => a.type === AnomalyType.UNUSUAL_LOCATION)) {
      threats.push('Geographic anomalies');
    }

    if (profile.anomalies.some(a => a.type === AnomalyType.PRIVILEGE_ESCALATION)) {
      threats.push('Privilege escalation attempts');
    }

    return threats;
  }

  private initializeThresholds(): AnalysisThresholds {
    return {
      unusualLocationThreshold: 1000, // km
      volumeMultiplier: 3,
      timeAnomalyThreshold: 0.05,
      riskScoreThreshold: 50
    };
  }

  private initializeMLModels(): MLModels {
    return {
      behaviorClassifier: null,
      anomalyDetector: null,
      riskPredictor: null
    };
  }

  private setupEventMonitoring(): void {
    this.auditService.on('auditEvent', (event: AuditEvent) => {
      this.processEvent(event);
    });
  }

  private setupPeriodicAnalysis(): void {
    // Run every 15 minutes
    setInterval(() => {
      this.performPeriodicAnalysis();
    }, 15 * 60 * 1000);
  }

  private async performPeriodicAnalysis(): Promise<void> {
    // Update baseline establishment
    for (const profile of this.profiles.values()) {
      const profileAge = Date.now() - profile.lastAnalysis.getTime();
      if (profileAge > this.baselineWindow && !profile.baselineEstablished) {
        profile.baselineEstablished = true;
        this.emit('baselineEstablished', { userId: profile.userId });
      }
    }
  }
}

// Additional interfaces
interface GeolocationInfo {
  country: string;
  city: string;
  confidence: number;
  latitude: number;
  longitude: number;
}

interface SuspiciousActivityConfig {
  baselineWindow?: number;
  enableMLAnalysis?: boolean;
  geoLocationService?: string;
  anomalyThresholds?: Record<string, number>;
}

interface AnalysisThresholds {
  unusualLocationThreshold: number;
  volumeMultiplier: number;
  timeAnomalyThreshold: number;
  riskScoreThreshold: number;
}

interface MLModels {
  behaviorClassifier: any;
  anomalyDetector: any;
  riskPredictor: any;
}

interface UserInvestigationReport {
  userId: string;
  profile: ActivityProfile;
  timeline: ActivityTimelineEntry[];
  behaviorAnalysis: BehaviorAnalysis;
  riskAssessment: RiskAssessment;
  recommendations: string[];
  generatedAt: Date;
}

interface ActivityTimelineEntry {
  timestamp: Date;
  eventType: string;
  resource: string;
  outcome: string;
  ipAddress: string;
  riskScore: number;
}

interface BehaviorAnalysis {
  consistencyScore: number;
  riskTrends: Array<{ date: Date; risk: number }>;
  anomalyFrequency: number;
  baselineDeviation: number;
}

interface RiskAssessment {
  currentRisk: number;
  riskCategory: 'LOW' | 'MEDIUM' | 'HIGH';
  primaryThreats: string[];
  mitigationRecommendations: string[];
}