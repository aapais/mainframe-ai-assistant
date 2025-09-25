import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import crypto from 'crypto';
import { SSOService } from '../sso/SSOService';
import { SecureKeyManager } from '../services/SecureKeyManager';
import { User, UserSession } from '../../database/schemas/auth/UserSchema';
import { DatabaseManager } from '../../database/DatabaseManager';
import { RedisCache } from '../../services/cache/RedisCache';

export interface SSOJWTPayload extends JwtPayload {
  userId: string;
  email: string;
  role: string;
  permissions: string[];
  providerId?: string;
  sessionId: string;
  deviceId?: string;
  mfaVerified?: boolean;
  tokenType: 'access' | 'refresh';
  scope?: string[];
}

export interface AuthenticatedRequest extends Request {
  user?: User;
  token?: SSOJWTPayload;
  sessionId?: string;
  deviceInfo?: {
    id: string;
    name: string;
    type: string;
    trusted: boolean;
  };
  ssoProvider?: string;
}

export class SSOJWTMiddleware {
  private ssoService: SSOService;
  private keyManager: SecureKeyManager;
  private db: DatabaseManager;
  private cache: RedisCache;
  private jwtSecret: string;
  private refreshSecret: string;

  constructor() {
    this.ssoService = SSOService.getInstance();
    this.keyManager = SecureKeyManager.getInstance();
    this.db = DatabaseManager.getInstance();
    this.cache = new RedisCache();
    this.jwtSecret = process.env.JWT_SECRET || 'default-jwt-secret';
    this.refreshSecret = process.env.JWT_REFRESH_SECRET || 'default-refresh-secret';
  }

  /**
   * Main JWT authentication middleware
   */
  authenticate() {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const token = this.extractToken(req);

        if (!token) {
          return this.sendUnauthorized(res, 'AUTH_TOKEN_MISSING', 'Token de acesso obrigatório');
        }

        // Check if token is blacklisted
        const isBlacklisted = await this.cache.get(`blacklist:${token}`);
        if (isBlacklisted) {
          return this.sendUnauthorized(res, 'TOKEN_BLACKLISTED', 'Token revogado');
        }

        // Verify and decode token
        const decoded = await this.verifyToken(token, 'access');
        if (!decoded) {
          return this.sendUnauthorized(res, 'INVALID_TOKEN', 'Token inválido');
        }

        // Get user and validate session
        const user = await this.validateUserAndSession(decoded);
        if (!user) {
          return this.sendUnauthorized(res, 'USER_INVALID', 'Usuário inválido ou sessão expirada');
        }

        // Validate device and location if required
        const deviceValidation = await this.validateDevice(req, decoded);
        if (!deviceValidation.valid) {
          return this.sendUnauthorized(res, deviceValidation.code!, deviceValidation.message!);
        }

        // Set request context
        req.user = user;
        req.token = decoded;
        req.sessionId = decoded.sessionId;
        req.deviceInfo = deviceValidation.deviceInfo;
        req.ssoProvider = decoded.providerId;

        // Update session activity
        await this.updateSessionActivity(decoded.sessionId, req);

        // Check if token needs refresh
        await this.checkTokenRefresh(req, res, decoded);

        next();
      } catch (error) {
        await this.logAuthError(req, error);

        if (error.name === 'TokenExpiredError') {
          return this.sendUnauthorized(res, 'TOKEN_EXPIRED', 'Token expirado', {
            expiredAt: error.expiredAt,
          });
        }

        if (error.name === 'JsonWebTokenError') {
          return this.sendUnauthorized(res, 'TOKEN_INVALID', 'Token inválido');
        }

        return res.status(500).json({
          success: false,
          error: 'INTERNAL_AUTH_ERROR',
          message: 'Erro interno de autenticação',
        });
      }
    };
  }

  /**
   * Optional authentication - doesn't fail if no token
   */
  optionalAuth() {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const token = this.extractToken(req);

        if (!token) {
          return next(); // Continue without authentication
        }

        const decoded = await this.verifyToken(token, 'access');
        if (decoded) {
          const user = await this.validateUserAndSession(decoded);
          if (user) {
            req.user = user;
            req.token = decoded;
            req.sessionId = decoded.sessionId;
          }
        }

        next();
      } catch (error) {
        // Log error but continue
        console.warn('Optional auth failed:', error.message);
        next();
      }
    };
  }

  /**
   * Refresh token middleware
   */
  refreshToken() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const refreshToken = req.body.refreshToken || req.cookies?.refreshToken;

        if (!refreshToken) {
          return res.status(400).json({
            success: false,
            error: 'REFRESH_TOKEN_MISSING',
            message: 'Refresh token obrigatório',
          });
        }

        const decoded = await this.verifyToken(refreshToken, 'refresh');
        if (!decoded) {
          return res.status(401).json({
            success: false,
            error: 'INVALID_REFRESH_TOKEN',
            message: 'Refresh token inválido',
          });
        }

        // Validate user and session
        const user = await this.validateUserAndSession(decoded);
        if (!user) {
          return res.status(401).json({
            success: false,
            error: 'USER_INVALID',
            message: 'Usuário inválido ou sessão expirada',
          });
        }

        // Generate new tokens
        const tokens = await this.generateTokenPair(user, decoded.sessionId, decoded.providerId);

        // Blacklist old refresh token
        await this.blacklistToken(refreshToken, decoded.exp!);

        res.json({
          success: true,
          data: {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresIn: 3600, // 1 hour
            tokenType: 'Bearer',
          },
        });
      } catch (error) {
        console.error('Token refresh error:', error);
        res.status(500).json({
          success: false,
          error: 'REFRESH_ERROR',
          message: 'Erro ao renovar token',
        });
      }
    };
  }

  /**
   * Extract token from request
   */
  private extractToken(req: Request): string | null {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Check cookies as fallback
    if (req.cookies?.accessToken) {
      return req.cookies.accessToken;
    }

    return null;
  }

  /**
   * Verify JWT token
   */
  private async verifyToken(
    token: string,
    type: 'access' | 'refresh'
  ): Promise<SSOJWTPayload | null> {
    try {
      const secret = type === 'access' ? this.jwtSecret : this.refreshSecret;
      const decoded = jwt.verify(token, secret) as SSOJWTPayload;

      if (decoded.tokenType !== type) {
        throw new Error(`Invalid token type. Expected ${type}, got ${decoded.tokenType}`);
      }

      return decoded;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Validate user and session
   */
  private async validateUserAndSession(decoded: SSOJWTPayload): Promise<User | null> {
    try {
      // Get user from database
      const userResult = await this.db.get(
        `
        SELECT * FROM users 
        WHERE id = ? AND is_active = 1 AND is_suspended = 0 AND deleted_at IS NULL
      `,
        [decoded.userId]
      );

      if (!userResult) {
        return null;
      }

      // Validate session
      const sessionResult = await this.db.get(
        `
        SELECT * FROM user_sessions 
        WHERE id = ? AND user_id = ? AND status = 'active' AND expires_at > datetime('now')
      `,
        [decoded.sessionId, decoded.userId]
      );

      if (!sessionResult) {
        return null;
      }

      // Map database result to User object
      const user: User = {
        id: userResult.id,
        email: userResult.email,
        emailVerified: Boolean(userResult.email_verified),
        passwordHash: userResult.password_hash,
        firstName: userResult.first_name,
        lastName: userResult.last_name,
        displayName: userResult.display_name,
        avatarUrl: userResult.avatar_url,
        role: userResult.role,
        permissions: userResult.permissions ? JSON.parse(userResult.permissions) : [],
        isActive: Boolean(userResult.is_active),
        isSuspended: Boolean(userResult.is_suspended),
        suspendedReason: userResult.suspended_reason,
        suspendedUntil: userResult.suspended_until
          ? new Date(userResult.suspended_until)
          : undefined,
        lastLogin: userResult.last_login ? new Date(userResult.last_login) : undefined,
        lastActivity: userResult.last_activity ? new Date(userResult.last_activity) : undefined,
        loginAttempts: userResult.login_attempts || 0,
        lockedUntil: userResult.locked_until ? new Date(userResult.locked_until) : undefined,
        passwordChangedAt: userResult.password_changed_at
          ? new Date(userResult.password_changed_at)
          : undefined,
        mfaEnabled: Boolean(userResult.mfa_enabled),
        mfaSecret: userResult.mfa_secret,
        mfaMethods: userResult.mfa_methods ? JSON.parse(userResult.mfa_methods) : [],
        backupCodes: userResult.backup_codes ? JSON.parse(userResult.backup_codes) : undefined,
        createdAt: new Date(userResult.created_at),
        updatedAt: new Date(userResult.updated_at),
        deletedAt: userResult.deleted_at ? new Date(userResult.deleted_at) : undefined,
        metadata: userResult.metadata ? JSON.parse(userResult.metadata) : undefined,
      };

      return user;
    } catch (error) {
      console.error('Error validating user/session:', error);
      return null;
    }
  }

  /**
   * Validate device and location
   */
  private async validateDevice(req: AuthenticatedRequest, decoded: SSOJWTPayload) {
    const userAgent = req.headers['user-agent'] || 'unknown';
    const ipAddress = this.getClientIp(req);

    try {
      // Get session device info
      const session = await this.db.get(
        `
        SELECT device_id, device_name, device_type, ip_address, metadata
        FROM user_sessions WHERE id = ?
      `,
        [decoded.sessionId]
      );

      if (!session) {
        return { valid: false, code: 'SESSION_NOT_FOUND', message: 'Sessão não encontrada' };
      }

      const deviceInfo = {
        id: session.device_id || crypto.randomUUID(),
        name: session.device_name || 'Unknown Device',
        type: session.device_type || 'unknown',
        trusted: true, // Implement device trust logic as needed
      };

      // Check for suspicious location change (optional)
      const metadata = session.metadata ? JSON.parse(session.metadata) : {};
      if (metadata.strictLocationCheck && session.ip_address !== ipAddress) {
        await this.logSecurityEvent(decoded.userId, 'unusual_location', {
          previousIp: session.ip_address,
          currentIp: ipAddress,
          sessionId: decoded.sessionId,
        });
      }

      return { valid: true, deviceInfo };
    } catch (error) {
      console.error('Device validation error:', error);
      return {
        valid: true,
        deviceInfo: { id: 'unknown', name: 'Unknown', type: 'unknown', trusted: false },
      };
    }
  }

  /**
   * Update session activity
   */
  private async updateSessionActivity(sessionId: string, req: AuthenticatedRequest) {
    try {
      await this.db.run(
        `
        UPDATE user_sessions 
        SET last_activity = datetime('now'), ip_address = ?, user_agent = ?
        WHERE id = ?
      `,
        [this.getClientIp(req), req.headers['user-agent'] || '', sessionId]
      );
    } catch (error) {
      console.error('Failed to update session activity:', error);
    }
  }

  /**
   * Check if token needs refresh
   */
  private async checkTokenRefresh(
    req: AuthenticatedRequest,
    res: Response,
    decoded: SSOJWTPayload
  ) {
    try {
      const now = Math.floor(Date.now() / 1000);
      const timeToExpiry = decoded.exp! - now;

      // If token expires in less than 15 minutes, suggest refresh
      if (timeToExpiry < 900 && timeToExpiry > 0) {
        res.setHeader('X-Token-Refresh-Suggested', 'true');
        res.setHeader('X-Token-Expires-In', timeToExpiry.toString());
      }
    } catch (error) {
      console.error('Token refresh check error:', error);
    }
  }

  /**
   * Generate token pair
   */
  public async generateTokenPair(user: User, sessionId?: string, providerId?: string) {
    const sessionIdToUse = sessionId || crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);

    const basePayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      permissions: user.permissions,
      sessionId: sessionIdToUse,
      providerId,
      mfaVerified: user.mfaEnabled ? false : true, // TODO: Implement MFA check
      iat: now,
    };

    const accessToken = jwt.sign(
      {
        ...basePayload,
        tokenType: 'access',
        scope: ['read', 'write'], // TODO: Implement proper scopes
      },
      this.jwtSecret,
      { expiresIn: '1h' }
    );

    const refreshToken = jwt.sign(
      {
        ...basePayload,
        tokenType: 'refresh',
      },
      this.refreshSecret,
      { expiresIn: '7d' }
    );

    return { accessToken, refreshToken, sessionId: sessionIdToUse };
  }

  /**
   * Blacklist token
   */
  private async blacklistToken(token: string, exp: number) {
    const now = Math.floor(Date.now() / 1000);
    const ttl = exp - now;

    if (ttl > 0) {
      await this.cache.set(`blacklist:${token}`, 'true', ttl);
    }
  }

  /**
   * Get client IP address
   */
  private getClientIp(req: Request): string {
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      (req.headers['x-real-ip'] as string) ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      (req as any).ip ||
      'unknown'
    );
  }

  /**
   * Send unauthorized response
   */
  private sendUnauthorized(res: Response, code: string, message: string, additional?: any) {
    return res.status(401).json({
      success: false,
      error: code,
      message,
      ...additional,
    });
  }

  /**
   * Log authentication error
   */
  private async logAuthError(req: Request, error: any) {
    try {
      console.error('Auth error:', {
        error: error.message,
        ip: this.getClientIp(req),
        userAgent: req.headers['user-agent'],
        path: req.path,
        method: req.method,
        timestamp: new Date().toISOString(),
      });
    } catch (logError) {
      console.error('Failed to log auth error:', logError);
    }
  }

  /**
   * Log security event
   */
  private async logSecurityEvent(userId: string, eventType: string, metadata: any) {
    try {
      await this.db.run(
        `
        INSERT INTO security_events (id, user_id, event_type, severity, description, metadata, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
        [
          crypto.randomUUID(),
          userId,
          eventType,
          'medium',
          `Security event: ${eventType}`,
          JSON.stringify(metadata),
          new Date().toISOString(),
        ]
      );
    } catch (error) {
      console.error('Failed to log security event:', error);
    }
  }
}

export const ssoJWTMiddleware = new SSOJWTMiddleware();
