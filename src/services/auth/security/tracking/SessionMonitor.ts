/**
 * User Session Monitor
 * Advanced session tracking with anomaly detection and security monitoring
 */

import { EventEmitter } from 'events';
import { AuditService, AuditEvent } from '../audit/AuditService';

export interface UserSession {
  sessionId: string;
  userId: string;
  ipAddress: string;
  userAgent: string;
  deviceFingerprint?: string;
  createdAt: Date;
  lastActivity: Date;
  expiresAt: Date;
  isActive: boolean;
  loginMethod: 'password' | 'sso' | 'api_key' | 'mfa' | 'social';
  geoLocation?: SessionGeolocation;
  deviceInfo: DeviceInfo;
  activityLog: SessionActivity[];
  riskScore: number;
  flags: SessionFlag[];
  metadata: Record<string, any>;
}

export interface SessionActivity {
  timestamp: Date;
  action: string;
  resource: string;
  outcome: 'SUCCESS' | 'FAILURE' | 'WARNING';
  details: Record<string, any>;
  riskScore: number;
}

export interface DeviceInfo {
  type: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  os: string;
  browser: string;
  version: string;
  screen: { width: number; height: number };
  timezone: string;
  language: string[];
}

export interface SessionGeolocation {
  country: string;
  region: string;
  city: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  vpnDetected: boolean;
  proxyDetected: boolean;
}

export interface SessionFlag {
  id: string;
  type: SessionFlagType;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  timestamp: Date;
  description: string;
  evidence: Record<string, any>;
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
}

export enum SessionFlagType {
  CONCURRENT_SESSIONS = 'CONCURRENT_SESSIONS',
  LOCATION_ANOMALY = 'LOCATION_ANOMALY',
  DEVICE_CHANGE = 'DEVICE_CHANGE',
  UNUSUAL_ACTIVITY = 'UNUSUAL_ACTIVITY',
  SESSION_HIJACK = 'SESSION_HIJACK',
  PRIVILEGE_ESCALATION = 'PRIVILEGE_ESCALATION',
  SUSPICIOUS_TIMING = 'SUSPICIOUS_TIMING',
  GEOLOCATION_JUMP = 'GEOLOCATION_JUMP',
  BROWSER_ANOMALY = 'BROWSER_ANOMALY',
  INACTIVE_TIMEOUT = 'INACTIVE_TIMEOUT',
}

export interface SessionAlert {
  id: string;
  sessionId: string;
  userId: string;
  timestamp: Date;
  alertType: SessionFlagType;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  flags: SessionFlag[];
  session: UserSession;
  recommendedActions: string[];
  metadata: Record<string, any>;
}

export interface SessionPolicy {
  maxConcurrentSessions: number;
  sessionTimeout: number; // minutes
  inactivityTimeout: number; // minutes
  requireGeoValidation: boolean;
  requireDeviceValidation: boolean;
  allowedLocations: string[];
  blockedLocations: string[];
  requireMFAForSensitiveActions: boolean;
  enableDeviceFingerprinting: boolean;
}

export class SessionMonitor extends EventEmitter {
  private activeSessions: Map<string, UserSession> = new Map();
  private userSessions: Map<string, Set<string>> = new Map(); // userId -> sessionIds
  private sessionHistory: Map<string, SessionHistory> = new Map();
  private deviceRegistry: Map<string, DeviceRegistry> = new Map();
  private geoHistory: Map<string, GeolocationHistory[]> = new Map();
  private cleanupInterval = 5 * 60 * 1000; // 5 minutes
  private analysisInterval = 60 * 1000; // 1 minute

  constructor(
    private auditService: AuditService,
    private policy: SessionPolicy,
    private config: SessionMonitorConfig
  ) {
    super();
    this.setupEventMonitoring();
    this.setupPeriodicAnalysis();
    this.setupSessionCleanup();
  }

  /**
   * Create a new user session
   */
  async createSession(sessionData: CreateSessionData): Promise<UserSession> {
    const session: UserSession = {
      sessionId: sessionData.sessionId,
      userId: sessionData.userId,
      ipAddress: sessionData.ipAddress,
      userAgent: sessionData.userAgent,
      deviceFingerprint: sessionData.deviceFingerprint,
      createdAt: new Date(),
      lastActivity: new Date(),
      expiresAt: new Date(Date.now() + this.policy.sessionTimeout * 60 * 1000),
      isActive: true,
      loginMethod: sessionData.loginMethod,
      geoLocation: sessionData.geoLocation,
      deviceInfo: sessionData.deviceInfo,
      activityLog: [],
      riskScore: 0,
      flags: [],
      metadata: sessionData.metadata || {},
    };

    // Check concurrent sessions
    await this.checkConcurrentSessions(session);

    // Analyze device and location
    await this.analyzeNewSession(session);

    // Store session
    this.activeSessions.set(session.sessionId, session);

    // Update user session mapping
    if (!this.userSessions.has(session.userId)) {
      this.userSessions.set(session.userId, new Set());
    }
    this.userSessions.get(session.userId)!.add(session.sessionId);

    // Update device registry
    await this.updateDeviceRegistry(session);

    // Update location history
    this.updateGeoHistory(session);

    // Log session creation
    await this.auditService.logEvent({
      eventType: 'AUTHENTICATION',
      category: 'SECURITY',
      resource: 'session_management',
      action: 'session_created',
      outcome: 'SUCCESS',
      ipAddress: session.ipAddress,
      userId: session.userId,
      sessionId: session.sessionId,
      details: {
        loginMethod: session.loginMethod,
        deviceType: session.deviceInfo.type,
        location: session.geoLocation?.city,
        riskScore: session.riskScore,
      },
    });

    this.emit('sessionCreated', session);
    return session;
  }

  /**
   * Update session activity
   */
  async updateSessionActivity(
    sessionId: string,
    activity: Omit<SessionActivity, 'timestamp' | 'riskScore'>
  ): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session || !session.isActive) {
      return;
    }

    const activityRiskScore = this.calculateActivityRiskScore(session, activity);

    const sessionActivity: SessionActivity = {
      ...activity,
      timestamp: new Date(),
      riskScore: activityRiskScore,
    };

    // Add to activity log
    session.activityLog.push(sessionActivity);
    session.lastActivity = new Date();

    // Keep only recent activities (last 24 hours)
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
    session.activityLog = session.activityLog.filter(a => a.timestamp > cutoffTime);

    // Analyze for anomalies
    const flags = await this.analyzeSessionActivity(session, sessionActivity);

    // Update session risk score
    session.riskScore = this.calculateSessionRiskScore(session);

    // Generate alerts if needed
    if (flags.length > 0) {
      await this.generateSessionAlert(session, flags);
    }

    this.emit('sessionUpdated', { session, activity: sessionActivity });
  }

  /**
   * Terminate a session
   */
  async terminateSession(
    sessionId: string,
    reason: string,
    terminatedBy?: string
  ): Promise<boolean> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return false;
    }

    session.isActive = false;

    // Remove from active sessions
    this.activeSessions.delete(sessionId);

    // Update user sessions mapping
    const userSessions = this.userSessions.get(session.userId);
    if (userSessions) {
      userSessions.delete(sessionId);
      if (userSessions.size === 0) {
        this.userSessions.delete(session.userId);
      }
    }

    // Store in history
    this.storeSessionHistory(session, reason);

    // Log termination
    await this.auditService.logEvent({
      eventType: 'AUTHENTICATION',
      category: 'SECURITY',
      resource: 'session_management',
      action: 'session_terminated',
      outcome: 'SUCCESS',
      ipAddress: session.ipAddress,
      userId: session.userId,
      sessionId: session.sessionId,
      details: {
        reason,
        terminatedBy,
        duration: Date.now() - session.createdAt.getTime(),
        activityCount: session.activityLog.length,
        riskScore: session.riskScore,
      },
    });

    this.emit('sessionTerminated', { session, reason, terminatedBy });
    return true;
  }

  /**
   * Get active session
   */
  getSession(sessionId: string): UserSession | undefined {
    return this.activeSessions.get(sessionId);
  }

  /**
   * Get all active sessions for a user
   */
  getUserSessions(userId: string): UserSession[] {
    const sessionIds = this.userSessions.get(userId) || new Set();
    return Array.from(sessionIds)
      .map(id => this.activeSessions.get(id))
      .filter(Boolean) as UserSession[];
  }

  /**
   * Get high-risk sessions
   */
  getHighRiskSessions(): Array<{ session: UserSession; riskFactors: string[] }> {
    return Array.from(this.activeSessions.values())
      .filter(session => session.riskScore > 50)
      .map(session => ({
        session,
        riskFactors: this.identifyRiskFactors(session),
      }))
      .sort((a, b) => b.session.riskScore - a.session.riskScore);
  }

  /**
   * Force terminate all sessions for a user
   */
  async terminateAllUserSessions(
    userId: string,
    reason: string,
    terminatedBy: string
  ): Promise<number> {
    const sessions = this.getUserSessions(userId);
    let terminatedCount = 0;

    for (const session of sessions) {
      const terminated = await this.terminateSession(session.sessionId, reason, terminatedBy);
      if (terminated) terminatedCount++;
    }

    return terminatedCount;
  }

  /**
   * Validate session integrity
   */
  async validateSession(
    sessionId: string,
    requestData: SessionValidationData
  ): Promise<ValidationResult> {
    const session = this.activeSessions.get(sessionId);

    if (!session) {
      return {
        valid: false,
        reason: 'SESSION_NOT_FOUND',
        riskScore: 100,
      };
    }

    if (!session.isActive) {
      return {
        valid: false,
        reason: 'SESSION_INACTIVE',
        riskScore: 90,
      };
    }

    if (new Date() > session.expiresAt) {
      await this.terminateSession(sessionId, 'Session expired');
      return {
        valid: false,
        reason: 'SESSION_EXPIRED',
        riskScore: 80,
      };
    }

    // Check IP consistency
    if (session.ipAddress !== requestData.ipAddress && this.policy.requireGeoValidation) {
      await this.flagSession(session, {
        type: SessionFlagType.SESSION_HIJACK,
        severity: 'HIGH',
        description: 'IP address changed during session',
        evidence: {
          originalIP: session.ipAddress,
          currentIP: requestData.ipAddress,
        },
      });

      return {
        valid: false,
        reason: 'IP_MISMATCH',
        riskScore: 85,
      };
    }

    // Check user agent consistency
    if (session.userAgent !== requestData.userAgent) {
      await this.flagSession(session, {
        type: SessionFlagType.BROWSER_ANOMALY,
        severity: 'MEDIUM',
        description: 'User agent changed during session',
        evidence: {
          originalUserAgent: session.userAgent,
          currentUserAgent: requestData.userAgent,
        },
      });
    }

    // Check device fingerprint if available
    if (
      session.deviceFingerprint &&
      requestData.deviceFingerprint &&
      session.deviceFingerprint !== requestData.deviceFingerprint
    ) {
      await this.flagSession(session, {
        type: SessionFlagType.DEVICE_CHANGE,
        severity: 'HIGH',
        description: 'Device fingerprint changed during session',
        evidence: {
          originalFingerprint: session.deviceFingerprint,
          currentFingerprint: requestData.deviceFingerprint,
        },
      });

      return {
        valid: false,
        reason: 'DEVICE_MISMATCH',
        riskScore: 90,
      };
    }

    return {
      valid: true,
      riskScore: session.riskScore,
    };
  }

  /**
   * Check concurrent sessions policy
   */
  private async checkConcurrentSessions(newSession: UserSession): Promise<void> {
    const existingSessions = this.getUserSessions(newSession.userId);

    if (existingSessions.length >= this.policy.maxConcurrentSessions) {
      await this.flagSession(newSession, {
        type: SessionFlagType.CONCURRENT_SESSIONS,
        severity: 'MEDIUM',
        description: `User has ${existingSessions.length} concurrent sessions`,
        evidence: {
          currentSessions: existingSessions.length,
          maxAllowed: this.policy.maxConcurrentSessions,
        },
      });

      // Optionally terminate oldest session
      if (this.config.autoTerminateOldestSession) {
        const oldestSession = existingSessions.sort(
          (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
        )[0];

        await this.terminateSession(oldestSession.sessionId, 'Concurrent session limit exceeded');
      }
    }
  }

  /**
   * Analyze new session for anomalies
   */
  private async analyzeNewSession(session: UserSession): Promise<void> {
    // Check location anomalies
    await this.checkLocationAnomaly(session);

    // Check device anomalies
    await this.checkDeviceAnomaly(session);

    // Check timing anomalies
    await this.checkTimingAnomaly(session);
  }

  /**
   * Check for location anomalies
   */
  private async checkLocationAnomaly(session: UserSession): Promise<void> {
    if (!session.geoLocation || !this.policy.requireGeoValidation) {
      return;
    }

    const userGeoHistory = this.geoHistory.get(session.userId) || [];

    if (userGeoHistory.length > 0) {
      const lastLocation = userGeoHistory[userGeoHistory.length - 1];
      const distance = this.calculateDistance(lastLocation.location, session.geoLocation);

      const timeDiff = (Date.now() - lastLocation.timestamp.getTime()) / 1000; // seconds
      const maxSpeed = 800; // km/h (commercial flight speed)
      const requiredTime = (distance / maxSpeed) * 3600; // seconds

      if (timeDiff < requiredTime && distance > 100) {
        await this.flagSession(session, {
          type: SessionFlagType.GEOLOCATION_JUMP,
          severity: 'HIGH',
          description: 'Impossible travel detected',
          evidence: {
            previousLocation: lastLocation.location,
            currentLocation: session.geoLocation,
            distance,
            timeDiff,
            requiredTime,
          },
        });
      }
    }

    // Check blocked locations
    if (this.policy.blockedLocations.includes(session.geoLocation.country)) {
      await this.flagSession(session, {
        type: SessionFlagType.LOCATION_ANOMALY,
        severity: 'HIGH',
        description: 'Login from blocked location',
        evidence: {
          location: session.geoLocation,
          blockedLocations: this.policy.blockedLocations,
        },
      });
    }
  }

  /**
   * Check for device anomalies
   */
  private async checkDeviceAnomaly(session: UserSession): Promise<void> {
    if (!this.policy.requireDeviceValidation) {
      return;
    }

    const userDevices = this.deviceRegistry.get(session.userId);

    if (userDevices && !this.isKnownDevice(session, userDevices)) {
      await this.flagSession(session, {
        type: SessionFlagType.DEVICE_CHANGE,
        severity: 'MEDIUM',
        description: 'Login from new device',
        evidence: {
          newDevice: session.deviceInfo,
          knownDevices: Array.from(userDevices.devices.keys()),
        },
      });
    }
  }

  /**
   * Check timing anomalies
   */
  private async checkTimingAnomaly(session: UserSession): Promise<void> {
    const hour = session.createdAt.getHours();

    // Check for off-hours login (configurable)
    if ((hour < 6 || hour > 22) && this.config.flagOffHoursLogin) {
      await this.flagSession(session, {
        type: SessionFlagType.SUSPICIOUS_TIMING,
        severity: 'LOW',
        description: 'Off-hours login detected',
        evidence: {
          loginHour: hour,
          timestamp: session.createdAt,
        },
      });
    }
  }

  /**
   * Analyze session activity for anomalies
   */
  private async analyzeSessionActivity(
    session: UserSession,
    activity: SessionActivity
  ): Promise<SessionFlag[]> {
    const flags: SessionFlag[] = [];

    // Check for privilege escalation
    if (this.isPrivilegeEscalation(activity)) {
      flags.push({
        id: crypto.randomUUID(),
        type: SessionFlagType.PRIVILEGE_ESCALATION,
        severity: 'HIGH',
        timestamp: new Date(),
        description: 'Privilege escalation attempt detected',
        evidence: { activity },
        resolved: false,
      });
    }

    // Check for unusual activity patterns
    const unusualActivity = this.detectUnusualActivity(session, activity);
    if (unusualActivity) {
      flags.push(unusualActivity);
    }

    // Store flags
    session.flags.push(...flags);

    return flags;
  }

  /**
   * Calculate activity risk score
   */
  private calculateActivityRiskScore(
    session: UserSession,
    activity: Omit<SessionActivity, 'timestamp' | 'riskScore'>
  ): number {
    let score = 0;

    // Base score from outcome
    if (activity.outcome === 'FAILURE') score += 10;
    if (activity.outcome === 'WARNING') score += 5;

    // Sensitive action score
    const sensitiveActions = ['admin', 'delete', 'modify', 'export'];
    if (sensitiveActions.some(action => activity.action.toLowerCase().includes(action))) {
      score += 15;
    }

    // Time-based score
    const hour = new Date().getHours();
    if (hour < 6 || hour > 22) score += 5;

    return Math.min(score, 50);
  }

  /**
   * Calculate overall session risk score
   */
  private calculateSessionRiskScore(session: UserSession): number {
    let score = 0;

    // Flags contribution
    score += session.flags.filter(f => !f.resolved).length * 15;

    // Activity risk contribution
    const recentActivities = session.activityLog.slice(-10); // Last 10 activities
    const avgActivityRisk =
      recentActivities.length > 0
        ? recentActivities.reduce((sum, a) => sum + a.riskScore, 0) / recentActivities.length
        : 0;
    score += avgActivityRisk;

    // Session duration factor
    const sessionAge = Date.now() - session.createdAt.getTime();
    const hoursActive = sessionAge / (1000 * 60 * 60);
    if (hoursActive > 12) score += 10; // Long sessions are slightly riskier

    // Geographic factors
    if (session.geoLocation?.vpnDetected) score += 20;
    if (session.geoLocation?.proxyDetected) score += 15;

    return Math.min(score, 100);
  }

  /**
   * Flag a session with a security concern
   */
  private async flagSession(
    session: UserSession,
    flagData: Omit<SessionFlag, 'id' | 'timestamp' | 'resolved'>
  ): Promise<void> {
    const flag: SessionFlag = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      resolved: false,
      ...flagData,
    };

    session.flags.push(flag);
    session.riskScore = this.calculateSessionRiskScore(session);

    await this.auditService.logSecurityEvent(
      `session_${flag.type.toLowerCase()}`,
      flag.severity,
      session.ipAddress,
      {
        sessionId: session.sessionId,
        userId: session.userId,
        flagId: flag.id,
        evidence: flag.evidence,
      }
    );

    this.emit('sessionFlagged', { session, flag });
  }

  /**
   * Generate alert for session issues
   */
  private async generateSessionAlert(session: UserSession, flags: SessionFlag[]): Promise<void> {
    const maxSeverity = flags.reduce(
      (max, f) => (this.compareSeverity(f.severity, max) > 0 ? f.severity : max),
      'LOW'
    );

    const alert: SessionAlert = {
      id: crypto.randomUUID(),
      sessionId: session.sessionId,
      userId: session.userId,
      timestamp: new Date(),
      alertType: flags[0].type,
      severity: maxSeverity,
      flags,
      session,
      recommendedActions: this.generateAlertRecommendations(flags),
      metadata: {
        flagCount: flags.length,
        sessionAge: Date.now() - session.createdAt.getTime(),
        riskScore: session.riskScore,
      },
    };

    this.emit('sessionAlert', alert);
  }

  /**
   * Helper methods
   */
  private updateDeviceRegistry(session: UserSession): void {
    let deviceRegistry = this.deviceRegistry.get(session.userId);

    if (!deviceRegistry) {
      deviceRegistry = {
        userId: session.userId,
        devices: new Map(),
        lastUpdated: new Date(),
      };
      this.deviceRegistry.set(session.userId, deviceRegistry);
    }

    const deviceKey = this.generateDeviceKey(session.deviceInfo);
    deviceRegistry.devices.set(deviceKey, {
      deviceInfo: session.deviceInfo,
      firstSeen: session.createdAt,
      lastSeen: session.createdAt,
      fingerprint: session.deviceFingerprint,
      trusted: false,
    });

    deviceRegistry.lastUpdated = new Date();
  }

  private updateGeoHistory(session: UserSession): void {
    if (!session.geoLocation) return;

    const history = this.geoHistory.get(session.userId) || [];

    history.push({
      location: session.geoLocation,
      timestamp: session.createdAt,
      sessionId: session.sessionId,
    });

    // Keep only last 50 locations
    if (history.length > 50) {
      history.shift();
    }

    this.geoHistory.set(session.userId, history);
  }

  private storeSessionHistory(session: UserSession, terminationReason: string): void {
    const history: SessionHistory = {
      sessionId: session.sessionId,
      userId: session.userId,
      createdAt: session.createdAt,
      terminatedAt: new Date(),
      duration: Date.now() - session.createdAt.getTime(),
      ipAddress: session.ipAddress,
      deviceInfo: session.deviceInfo,
      activityCount: session.activityLog.length,
      flagCount: session.flags.length,
      riskScore: session.riskScore,
      terminationReason,
    };

    this.sessionHistory.set(session.sessionId, history);
  }

  private isKnownDevice(session: UserSession, deviceRegistry: DeviceRegistry): boolean {
    const deviceKey = this.generateDeviceKey(session.deviceInfo);
    return deviceRegistry.devices.has(deviceKey);
  }

  private generateDeviceKey(deviceInfo: DeviceInfo): string {
    return `${deviceInfo.type}-${deviceInfo.os}-${deviceInfo.browser}`;
  }

  private calculateDistance(loc1: SessionGeolocation, loc2: SessionGeolocation): number {
    // Haversine formula
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(loc2.latitude - loc1.latitude);
    const dLon = this.toRad(loc2.longitude - loc1.longitude);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(loc1.latitude)) *
        Math.cos(this.toRad(loc2.latitude)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(value: number): number {
    return (value * Math.PI) / 180;
  }

  private isPrivilegeEscalation(activity: SessionActivity): boolean {
    const privilegeActions = ['admin', 'sudo', 'escalate', 'privilege'];
    return (
      privilegeActions.some(action => activity.action.toLowerCase().includes(action)) &&
      activity.outcome === 'FAILURE'
    );
  }

  private detectUnusualActivity(
    session: UserSession,
    activity: SessionActivity
  ): SessionFlag | null {
    // Implementation would analyze activity patterns
    // For now, return null
    return null;
  }

  private identifyRiskFactors(session: UserSession): string[] {
    const factors: string[] = [];

    if (session.flags.some(f => f.type === SessionFlagType.LOCATION_ANOMALY)) {
      factors.push('Geographic anomalies');
    }

    if (session.flags.some(f => f.type === SessionFlagType.DEVICE_CHANGE)) {
      factors.push('Device inconsistencies');
    }

    if (session.geoLocation?.vpnDetected) {
      factors.push('VPN usage');
    }

    if (session.flags.length > 3) {
      factors.push('Multiple security flags');
    }

    return factors;
  }

  private compareSeverity(a: string, b: string): number {
    const levels = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
    return levels[a] - levels[b];
  }

  private generateAlertRecommendations(flags: SessionFlag[]): string[] {
    const recommendations = new Set<string>();

    for (const flag of flags) {
      switch (flag.type) {
        case SessionFlagType.SESSION_HIJACK:
          recommendations.add('Terminate session immediately');
          recommendations.add('Force user re-authentication');
          break;
        case SessionFlagType.GEOLOCATION_JUMP:
          recommendations.add('Verify user identity');
          recommendations.add('Enable additional security measures');
          break;
        case SessionFlagType.DEVICE_CHANGE:
          recommendations.add('Require device verification');
          recommendations.add('Send security notification');
          break;
        default:
          recommendations.add('Monitor session closely');
      }
    }

    return Array.from(recommendations);
  }

  private setupEventMonitoring(): void {
    this.auditService.on('auditEvent', (event: AuditEvent) => {
      if (event.sessionId) {
        this.updateSessionActivity(event.sessionId, {
          action: event.action,
          resource: event.resource,
          outcome: event.outcome,
          details: event.details,
        });
      }
    });
  }

  private setupPeriodicAnalysis(): void {
    setInterval(() => {
      this.performSessionAnalysis();
    }, this.analysisInterval);
  }

  private setupSessionCleanup(): void {
    setInterval(() => {
      this.cleanupExpiredSessions();
    }, this.cleanupInterval);
  }

  private async performSessionAnalysis(): Promise<void> {
    // Analyze all active sessions for anomalies
    for (const session of this.activeSessions.values()) {
      // Check for inactivity timeout
      const inactiveTime = Date.now() - session.lastActivity.getTime();
      if (inactiveTime > this.policy.inactivityTimeout * 60 * 1000) {
        await this.flagSession(session, {
          type: SessionFlagType.INACTIVE_TIMEOUT,
          severity: 'LOW',
          description: 'Session inactive for extended period',
          evidence: {
            inactiveMinutes: Math.floor(inactiveTime / (60 * 1000)),
            threshold: this.policy.inactivityTimeout,
          },
        });

        if (this.config.autoTerminateInactiveSessions) {
          await this.terminateSession(session.sessionId, 'Inactivity timeout');
        }
      }
    }
  }

  private async cleanupExpiredSessions(): Promise<void> {
    const now = new Date();
    const expiredSessions: string[] = [];

    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (now > session.expiresAt) {
        expiredSessions.push(sessionId);
      }
    }

    for (const sessionId of expiredSessions) {
      await this.terminateSession(sessionId, 'Session expired');
    }
  }
}

// Additional interfaces
interface CreateSessionData {
  sessionId: string;
  userId: string;
  ipAddress: string;
  userAgent: string;
  deviceFingerprint?: string;
  loginMethod: 'password' | 'sso' | 'api_key' | 'mfa' | 'social';
  geoLocation?: SessionGeolocation;
  deviceInfo: DeviceInfo;
  metadata?: Record<string, any>;
}

interface SessionValidationData {
  ipAddress: string;
  userAgent: string;
  deviceFingerprint?: string;
}

interface ValidationResult {
  valid: boolean;
  reason?: string;
  riskScore: number;
}

interface SessionHistory {
  sessionId: string;
  userId: string;
  createdAt: Date;
  terminatedAt: Date;
  duration: number;
  ipAddress: string;
  deviceInfo: DeviceInfo;
  activityCount: number;
  flagCount: number;
  riskScore: number;
  terminationReason: string;
}

interface DeviceRegistry {
  userId: string;
  devices: Map<string, DeviceRecord>;
  lastUpdated: Date;
}

interface DeviceRecord {
  deviceInfo: DeviceInfo;
  firstSeen: Date;
  lastSeen: Date;
  fingerprint?: string;
  trusted: boolean;
}

interface GeolocationHistory {
  location: SessionGeolocation;
  timestamp: Date;
  sessionId: string;
}

interface SessionMonitorConfig {
  autoTerminateOldestSession?: boolean;
  autoTerminateInactiveSessions?: boolean;
  flagOffHoursLogin?: boolean;
  enableDeviceFingerprinting?: boolean;
  enableGeolocationTracking?: boolean;
}
