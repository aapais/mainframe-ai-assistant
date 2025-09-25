import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './SSOJWTMiddleware';
import { DatabaseManager } from '../../database/DatabaseManager';
import { RedisCache } from '../../services/cache/RedisCache';
import crypto from 'crypto';

export interface SessionConfig {
  maxAge: number; // Session duration in milliseconds
  renewThreshold: number; // Time before expiry to auto-renew (in milliseconds)
  maxConcurrentSessions: number; // Max sessions per user
  trackDevices: boolean;
  trackLocation: boolean;
  strictIpValidation: boolean;
  logoutOnSuspiciousActivity: boolean;
}

export interface DeviceInfo {
  id: string;
  name: string;
  type: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  os?: string;
  browser?: string;
  trusted: boolean;
}

export interface LocationInfo {
  ip: string;
  country?: string;
  region?: string;
  city?: string;
  timezone?: string;
}

export interface SessionInfo {
  id: string;
  userId: string;
  device: DeviceInfo;
  location: LocationInfo;
  createdAt: Date;
  lastActivity: Date;
  expiresAt: Date;
  isActive: boolean;
  metadata?: Record<string, any>;
}

export class SessionMiddleware {
  private db: DatabaseManager;
  private cache: RedisCache;
  private config: SessionConfig;

  constructor(config: Partial<SessionConfig> = {}) {
    this.db = DatabaseManager.getInstance();
    this.cache = new RedisCache();
    this.config = {
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      renewThreshold: 15 * 60 * 1000, // 15 minutes
      maxConcurrentSessions: 5,
      trackDevices: true,
      trackLocation: true,
      strictIpValidation: false,
      logoutOnSuspiciousActivity: true,
      ...config
    };
  }

  /**
   * Initialize session management
   */
  manage() {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        if (!req.user || !req.sessionId) {
          return next(); // Skip if no user or session
        }

        const sessionInfo = await this.getSessionInfo(req.sessionId);
        
        if (!sessionInfo) {
          return this.terminateSession(res, 'SESSION_NOT_FOUND', 'Sessão não encontrada');
        }

        if (!sessionInfo.isActive) {
          return this.terminateSession(res, 'SESSION_INACTIVE', 'Sessão inativa');
        }

        if (sessionInfo.expiresAt < new Date()) {
          await this.expireSession(sessionInfo.id);
          return this.terminateSession(res, 'SESSION_EXPIRED', 'Sessão expirada');
        }

        // Validate device and location
        const validationResult = await this.validateSession(req, sessionInfo);
        if (!validationResult.valid) {
          if (this.config.logoutOnSuspiciousActivity) {
            await this.expireSession(sessionInfo.id);
            await this.logSecurityEvent(req.user.id, 'suspicious_session', validationResult.reason);
          }
          return this.terminateSession(res, 'SESSION_VALIDATION_FAILED', validationResult.reason!);
        }

        // Update session activity
        await this.updateSessionActivity(sessionInfo.id, req);

        // Check if session needs renewal
        const needsRenewal = await this.checkRenewalNeeded(sessionInfo);
        if (needsRenewal) {
          res.setHeader('X-Session-Renewal-Required', 'true');
        }

        // Add session info to request
        req.sessionInfo = sessionInfo;
        
        next();
      } catch (error) {
        console.error('Session management error:', error);
        return res.status(500).json({
          success: false,
          error: 'SESSION_ERROR',
          message: 'Erro interno na gestão de sessão'
        });
      }
    };
  }

  /**
   * Create new session
   */
  async createSession(userId: string, req: Request, options: Partial<SessionInfo> = {}): Promise<SessionInfo> {
    try {
      // Clean up expired sessions
      await this.cleanupExpiredSessions(userId);
      
      // Check concurrent session limit
      const activeSessions = await this.getActiveSessions(userId);
      if (activeSessions.length >= this.config.maxConcurrentSessions) {
        // Remove oldest session
        const oldestSession = activeSessions.sort((a, b) => 
          new Date(a.lastActivity).getTime() - new Date(b.lastActivity).getTime()
        )[0];
        await this.expireSession(oldestSession.id);
      }

      const sessionId = crypto.randomUUID();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + this.config.maxAge);
      
      const device = this.extractDeviceInfo(req);
      const location = await this.extractLocationInfo(req);
      
      const sessionInfo: SessionInfo = {
        id: sessionId,
        userId,
        device,
        location,
        createdAt: now,
        lastActivity: now,
        expiresAt,
        isActive: true,
        metadata: options.metadata || {},
        ...options
      };

      // Store session in database
      await this.db.run(`
        INSERT INTO user_sessions (
          id, user_id, device_id, device_name, device_type, ip_address, user_agent,
          location_country, location_region, location_city, location_timezone,
          status, expires_at, last_activity, created_at, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        sessionId, userId, device.id, device.name, device.type,
        location.ip, req.headers['user-agent'],
        location.country, location.region, location.city, location.timezone,
        'active', expiresAt.toISOString(), now.toISOString(), now.toISOString(),
        JSON.stringify(sessionInfo.metadata)
      ]);

      // Cache session for faster access
      await this.cache.set(
        `session:${sessionId}`,
        JSON.stringify(sessionInfo),
        Math.floor(this.config.maxAge / 1000)
      );

      await this.logSecurityEvent(userId, 'session_created', {
        sessionId,
        device: device.name,
        location: `${location.city}, ${location.country}`,
        ip: location.ip
      });

      return sessionInfo;
    } catch (error) {
      console.error('Session creation error:', error);
      throw new Error('Failed to create session');
    }
  }

  /**
   * Expire session
   */
  async expireSession(sessionId: string, reason?: string): Promise<void> {
    try {
      await this.db.run(`
        UPDATE user_sessions 
        SET status = 'expired', revoked_at = ?, revoked_reason = ?
        WHERE id = ?
      `, [new Date().toISOString(), reason || 'expired', sessionId]);

      await this.cache.del(`session:${sessionId}`);

      // Get session info for logging
      const sessionInfo = await this.getSessionInfo(sessionId);
      if (sessionInfo) {
        await this.logSecurityEvent(sessionInfo.userId, 'session_expired', {
          sessionId,
          reason,
          device: sessionInfo.device.name
        });
      }
    } catch (error) {
      console.error('Session expiration error:', error);
    }
  }

  /**
   * Revoke session (logout)
   */
  async revokeSession(sessionId: string, revokedBy?: string, reason?: string): Promise<void> {
    try {
      await this.db.run(`
        UPDATE user_sessions 
        SET status = 'revoked', revoked_at = ?, revoked_by = ?, revoked_reason = ?
        WHERE id = ?
      `, [new Date().toISOString(), revokedBy, reason || 'logout', sessionId]);

      await this.cache.del(`session:${sessionId}`);

      const sessionInfo = await this.getSessionInfo(sessionId);
      if (sessionInfo) {
        await this.logSecurityEvent(sessionInfo.userId, 'session_revoked', {
          sessionId,
          reason,
          revokedBy,
          device: sessionInfo.device.name
        });
      }
    } catch (error) {
      console.error('Session revocation error:', error);
    }
  }

  /**
   * Revoke all user sessions
   */
  async revokeAllUserSessions(userId: string, exceptSessionId?: string, reason?: string): Promise<void> {
    try {
      let query = `
        UPDATE user_sessions 
        SET status = 'revoked', revoked_at = ?, revoked_reason = ?
        WHERE user_id = ? AND status = 'active'
      `;
      let params = [new Date().toISOString(), reason || 'logout_all', userId];

      if (exceptSessionId) {
        query += ' AND id != ?';
        params.push(exceptSessionId);
      }

      await this.db.run(query, params);

      // Clear cache for all user sessions
      const sessions = await this.getActiveSessions(userId);
      for (const session of sessions) {
        if (session.id !== exceptSessionId) {
          await this.cache.del(`session:${session.id}`);
        }
      }

      await this.logSecurityEvent(userId, 'all_sessions_revoked', {
        reason,
        exceptSessionId,
        count: sessions.length
      });
    } catch (error) {
      console.error('Revoke all sessions error:', error);
    }
  }

  /**
   * Renew session expiration
   */
  async renewSession(sessionId: string): Promise<void> {
    try {
      const newExpiresAt = new Date(Date.now() + this.config.maxAge);
      
      await this.db.run(`
        UPDATE user_sessions 
        SET expires_at = ?, last_activity = ?
        WHERE id = ? AND status = 'active'
      `, [newExpiresAt.toISOString(), new Date().toISOString(), sessionId]);

      // Update cache
      const sessionInfo = await this.getSessionInfo(sessionId);
      if (sessionInfo) {
        sessionInfo.expiresAt = newExpiresAt;
        sessionInfo.lastActivity = new Date();
        await this.cache.set(
          `session:${sessionId}`,
          JSON.stringify(sessionInfo),
          Math.floor(this.config.maxAge / 1000)
        );
      }
    } catch (error) {
      console.error('Session renewal error:', error);
    }
  }

  /**
   * Get session information
   */
  async getSessionInfo(sessionId: string): Promise<SessionInfo | null> {
    try {
      // Try cache first
      const cached = await this.cache.get(`session:${sessionId}`);
      if (cached) {
        return JSON.parse(cached);
      }

      // Get from database
      const result = await this.db.get(`
        SELECT * FROM user_sessions WHERE id = ?
      `, [sessionId]);

      if (!result) {
        return null;
      }

      const sessionInfo: SessionInfo = {
        id: result.id,
        userId: result.user_id,
        device: {
          id: result.device_id,
          name: result.device_name,
          type: result.device_type,
          trusted: true // TODO: Implement device trust logic
        },
        location: {
          ip: result.ip_address,
          country: result.location_country,
          region: result.location_region,
          city: result.location_city,
          timezone: result.location_timezone
        },
        createdAt: new Date(result.created_at),
        lastActivity: new Date(result.last_activity),
        expiresAt: new Date(result.expires_at),
        isActive: result.status === 'active',
        metadata: result.metadata ? JSON.parse(result.metadata) : {}
      };

      // Cache for future requests
      if (sessionInfo.isActive) {
        const ttl = Math.floor((sessionInfo.expiresAt.getTime() - Date.now()) / 1000);
        if (ttl > 0) {
          await this.cache.set(`session:${sessionId}`, JSON.stringify(sessionInfo), ttl);
        }
      }

      return sessionInfo;
    } catch (error) {
      console.error('Get session info error:', error);
      return null;
    }
  }

  /**
   * Get active sessions for user
   */
  async getActiveSessions(userId: string): Promise<SessionInfo[]> {
    try {
      const results = await this.db.all(`
        SELECT * FROM user_sessions 
        WHERE user_id = ? AND status = 'active' AND expires_at > datetime('now')
        ORDER BY last_activity DESC
      `, [userId]);

      return results.map(result => ({
        id: result.id,
        userId: result.user_id,
        device: {
          id: result.device_id,
          name: result.device_name,
          type: result.device_type,
          trusted: true
        },
        location: {
          ip: result.ip_address,
          country: result.location_country,
          region: result.location_region,
          city: result.location_city,
          timezone: result.location_timezone
        },
        createdAt: new Date(result.created_at),
        lastActivity: new Date(result.last_activity),
        expiresAt: new Date(result.expires_at),
        isActive: true,
        metadata: result.metadata ? JSON.parse(result.metadata) : {}
      }));
    } catch (error) {
      console.error('Get active sessions error:', error);
      return [];
    }
  }

  /**
   * Private helper methods
   */
  private async validateSession(req: AuthenticatedRequest, sessionInfo: SessionInfo): Promise<{
    valid: boolean;
    reason?: string;
  }> {
    try {
      const currentIp = this.getClientIP(req);
      
      // Validate IP if strict validation is enabled
      if (this.config.strictIpValidation && sessionInfo.location.ip !== currentIp) {
        return {
          valid: false,
          reason: 'IP address changed - session invalidated for security'
        };
      }

      // Check for suspicious activity patterns
      if (this.config.logoutOnSuspiciousActivity) {
        const isSuspicious = await this.detectSuspiciousActivity(req, sessionInfo);
        if (isSuspicious) {
          return {
            valid: false,
            reason: 'Suspicious activity detected'
          };
        }
      }

      return { valid: true };
    } catch (error) {
      console.error('Session validation error:', error);
      return { valid: true }; // Allow on error
    }
  }

  private async detectSuspiciousActivity(req: AuthenticatedRequest, sessionInfo: SessionInfo): Promise<boolean> {
    try {
      const currentIp = this.getClientIP(req);
      const currentUserAgent = req.headers['user-agent'] || '';
      
      // Check for significant location change
      if (this.config.trackLocation) {
        const currentLocation = await this.extractLocationInfo(req);
        if (sessionInfo.location.country && 
            currentLocation.country && 
            sessionInfo.location.country !== currentLocation.country) {
          return true; // Different country might be suspicious
        }
      }

      // Check for user agent changes (possible device switch)
      if (this.config.trackDevices) {
        // Simplified check - in practice, you'd parse and compare specific fields
        const originalUA = sessionInfo.metadata?.userAgent || '';
        if (originalUA && originalUA !== currentUserAgent) {
          // Allow minor differences but flag major changes
          const similarity = this.calculateStringSimilarity(originalUA, currentUserAgent);
          if (similarity < 0.8) {
            return true;
          }
        }
      }

      return false;
    } catch (error) {
      console.error('Suspicious activity detection error:', error);
      return false;
    }
  }

  private extractDeviceInfo(req: Request): DeviceInfo {
    const userAgent = req.headers['user-agent'] || '';
    
    // Simple device type detection
    let type: DeviceInfo['type'] = 'unknown';
    if (/Mobile|Android|iPhone|iPad/.test(userAgent)) {
      type = /iPad/.test(userAgent) ? 'tablet' : 'mobile';
    } else if (/Windows|Mac|Linux/.test(userAgent)) {
      type = 'desktop';
    }

    return {
      id: crypto.createHash('sha256').update(userAgent).digest('hex').substring(0, 16),
      name: this.generateDeviceName(userAgent),
      type,
      trusted: false // New devices start as untrusted
    };
  }

  private async extractLocationInfo(req: Request): Promise<LocationInfo> {
    const ip = this.getClientIP(req);
    
    try {
      // TODO: Implement actual IP geolocation
      // For now, return basic info
      return {
        ip,
        country: 'Unknown',
        region: 'Unknown',
        city: 'Unknown',
        timezone: 'UTC'
      };
    } catch (error) {
      console.error('Location extraction error:', error);
      return { ip };
    }
  }

  private generateDeviceName(userAgent: string): string {
    // Extract browser and OS info from user agent
    const osMatch = userAgent.match(/(Windows|Mac|Linux|Android|iOS)/);
    const browserMatch = userAgent.match(/(Chrome|Firefox|Safari|Edge|Opera)/);
    
    const os = osMatch ? osMatch[1] : 'Unknown OS';
    const browser = browserMatch ? browserMatch[1] : 'Unknown Browser';
    
    return `${browser} on ${os}`;
  }

  private async updateSessionActivity(sessionId: string, req: AuthenticatedRequest): Promise<void> {
    try {
      const now = new Date();
      await this.db.run(`
        UPDATE user_sessions 
        SET last_activity = ?, ip_address = ?, user_agent = ?
        WHERE id = ?
      `, [now.toISOString(), this.getClientIP(req), req.headers['user-agent'], sessionId]);

      // Update cache
      const sessionInfo = await this.getSessionInfo(sessionId);
      if (sessionInfo) {
        sessionInfo.lastActivity = now;
        sessionInfo.location.ip = this.getClientIP(req);
        await this.cache.set(
          `session:${sessionId}`,
          JSON.stringify(sessionInfo),
          Math.floor((sessionInfo.expiresAt.getTime() - Date.now()) / 1000)
        );
      }
    } catch (error) {
      console.error('Update session activity error:', error);
    }
  }

  private async checkRenewalNeeded(sessionInfo: SessionInfo): Promise<boolean> {
    const timeUntilExpiry = sessionInfo.expiresAt.getTime() - Date.now();
    return timeUntilExpiry < this.config.renewThreshold;
  }

  private async cleanupExpiredSessions(userId: string): Promise<void> {
    try {
      await this.db.run(`
        UPDATE user_sessions 
        SET status = 'expired' 
        WHERE user_id = ? AND status = 'active' AND expires_at <= datetime('now')
      `, [userId]);
    } catch (error) {
      console.error('Cleanup expired sessions error:', error);
    }
  }

  private calculateStringSimilarity(str1: string, str2: string): number {
    // Simple similarity calculation
    if (str1 === str2) return 1;
    
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1;
    
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  private getClientIP(req: Request): string {
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      req.headers['x-real-ip'] as string ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      (req as any).ip ||
      'unknown'
    );
  }

  private terminateSession(res: Response, code: string, message: string): Response {
    return res.status(401).json({
      success: false,
      error: code,
      message,
      sessionTerminated: true,
      timestamp: new Date().toISOString()
    });
  }

  private async logSecurityEvent(userId: string, eventType: string, metadata: any): Promise<void> {
    try {
      await this.db.run(`
        INSERT INTO security_events (id, user_id, event_type, severity, description, metadata, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        crypto.randomUUID(),
        userId,
        eventType,
        'medium',
        `Session event: ${eventType}`,
        JSON.stringify(metadata),
        new Date().toISOString()
      ]);
    } catch (error) {
      console.error('Security event logging error:', error);
    }
  }
}

// Extend the AuthenticatedRequest interface
declare module './SSOJWTMiddleware' {
  interface AuthenticatedRequest {
    sessionInfo?: SessionInfo;
  }
}

export const sessionMiddleware = (config?: Partial<SessionConfig>) => new SessionMiddleware(config);