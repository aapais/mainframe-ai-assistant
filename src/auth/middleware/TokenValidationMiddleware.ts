import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { AuthenticatedRequest, SSOJWTPayload, SSOJWTMiddleware } from './SSOJWTMiddleware';
import { RedisCache } from '../../services/cache/RedisCache';
import { DatabaseManager } from '../../database/DatabaseManager';

export interface TokenValidationOptions {
  allowExpired?: boolean;
  requireMFA?: boolean;
  validateScope?: string[];
  maxAge?: number; // in seconds
  issuer?: string;
  audience?: string;
}

export interface TokenValidationResult {
  valid: boolean;
  reason?: string;
  payload?: SSOJWTPayload;
  remainingTime?: number;
  needsRefresh?: boolean;
}

export class TokenValidationMiddleware {
  private cache: RedisCache;
  private db: DatabaseManager;
  private jwtSecret: string;
  private ssoJWT: SSOJWTMiddleware;

  constructor() {
    this.cache = new RedisCache();
    this.db = DatabaseManager.getInstance();
    this.jwtSecret = process.env.JWT_SECRET || 'default-jwt-secret';
    this.ssoJWT = new SSOJWTMiddleware();
  }

  /**
   * Validate token with custom options
   */
  validate(options: TokenValidationOptions = {}) {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const token = this.extractToken(req);

        if (!token) {
          return res.status(401).json({
            success: false,
            error: 'TOKEN_MISSING',
            message: 'Token de acesso obrigatório',
          });
        }

        const validationResult = await this.validateToken(token, options);

        if (!validationResult.valid) {
          return res.status(401).json({
            success: false,
            error: 'TOKEN_VALIDATION_FAILED',
            message: validationResult.reason || 'Token inválido',
          });
        }

        // Additional validations
        if (options.requireMFA && !validationResult.payload?.mfaVerified) {
          return res.status(401).json({
            success: false,
            error: 'MFA_REQUIRED',
            message: 'Autenticação multi-fator obrigatória',
          });
        }

        if (
          options.validateScope &&
          !this.hasRequiredScope(validationResult.payload!, options.validateScope)
        ) {
          return res.status(403).json({
            success: false,
            error: 'INSUFFICIENT_SCOPE',
            message: 'Escopo insuficiente para acessar este recurso',
          });
        }

        // Set validation info in request
        req.tokenValidation = validationResult;

        // Set refresh hint if needed
        if (validationResult.needsRefresh) {
          res.setHeader('X-Token-Refresh-Required', 'true');
        }

        next();
      } catch (error) {
        console.error('Token validation error:', error);
        return res.status(500).json({
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'Erro interno na validação do token',
        });
      }
    };
  }

  /**
   * Validate token structure and claims
   */
  async validateToken(
    token: string,
    options: TokenValidationOptions = {}
  ): Promise<TokenValidationResult> {
    try {
      // Check if token is blacklisted
      const isBlacklisted = await this.cache.get(`blacklist:${token}`);
      if (isBlacklisted) {
        return { valid: false, reason: 'Token está na blacklist' };
      }

      // Verify JWT signature and decode
      const decoded = jwt.verify(token, this.jwtSecret, {
        ignoreExpiration: options.allowExpired,
        issuer: options.issuer,
        audience: options.audience,
      }) as SSOJWTPayload;

      // Validate token age if specified
      if (options.maxAge) {
        const tokenAge = Math.floor(Date.now() / 1000) - (decoded.iat || 0);
        if (tokenAge > options.maxAge) {
          return { valid: false, reason: 'Token muito antigo' };
        }
      }

      // Check if token is close to expiration
      const now = Math.floor(Date.now() / 1000);
      const remainingTime = (decoded.exp || 0) - now;
      const needsRefresh = remainingTime < 900; // 15 minutes

      // Validate session exists and is active
      const sessionExists = await this.validateSession(decoded.sessionId);
      if (!sessionExists) {
        return { valid: false, reason: 'Sessão inválida ou expirada' };
      }

      // Validate user is still active
      const userActive = await this.validateUserStatus(decoded.userId);
      if (!userActive) {
        return { valid: false, reason: 'Usuário inativo ou suspenso' };
      }

      return {
        valid: true,
        payload: decoded,
        remainingTime: Math.max(0, remainingTime),
        needsRefresh,
      };
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return { valid: false, reason: 'Token expirado' };
      }
      if (error.name === 'JsonWebTokenError') {
        return { valid: false, reason: 'Token mal formado' };
      }
      if (error.name === 'NotBeforeError') {
        return { valid: false, reason: 'Token ainda não é válido' };
      }

      return { valid: false, reason: 'Erro na validação do token' };
    }
  }

  /**
   * Validate refresh token specifically
   */
  validateRefreshToken() {
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

        // Validate refresh token
        const refreshSecret = process.env.JWT_REFRESH_SECRET || 'default-refresh-secret';

        try {
          const decoded = jwt.verify(refreshToken, refreshSecret) as SSOJWTPayload;

          if (decoded.tokenType !== 'refresh') {
            return res.status(401).json({
              success: false,
              error: 'INVALID_TOKEN_TYPE',
              message: 'Token não é um refresh token válido',
            });
          }

          // Validate session and user
          const sessionValid = await this.validateSession(decoded.sessionId);
          const userActive = await this.validateUserStatus(decoded.userId);

          if (!sessionValid || !userActive) {
            return res.status(401).json({
              success: false,
              error: 'INVALID_SESSION_OR_USER',
              message: 'Sessão inválida ou usuário inativo',
            });
          }

          // Store decoded token for next middleware
          (req as any).refreshTokenPayload = decoded;
          next();
        } catch (error) {
          return res.status(401).json({
            success: false,
            error: 'INVALID_REFRESH_TOKEN',
            message: 'Refresh token inválido ou expirado',
          });
        }
      } catch (error) {
        console.error('Refresh token validation error:', error);
        return res.status(500).json({
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'Erro na validação do refresh token',
        });
      }
    };
  }

  /**
   * Token rotation middleware - generates new tokens and invalidates old ones
   */
  rotateToken() {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const oldToken = this.extractToken(req);

        if (!oldToken || !req.user) {
          return res.status(401).json({
            success: false,
            error: 'NO_TOKEN_OR_USER',
            message: 'Token ou usuário não encontrado',
          });
        }

        // Generate new token pair
        const tokens = await this.ssoJWT.generateTokenPair(
          req.user,
          req.sessionId,
          req.ssoProvider
        );

        // Blacklist old token
        const decoded = jwt.decode(oldToken) as SSOJWTPayload;
        if (decoded?.exp) {
          await this.blacklistToken(oldToken, decoded.exp);
        }

        // Set new tokens in response
        res.setHeader('X-New-Access-Token', tokens.accessToken);
        res.setHeader('X-New-Refresh-Token', tokens.refreshToken);

        // Optionally set cookies
        if (req.cookies?.accessToken) {
          res.cookie('accessToken', tokens.accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 3600000, // 1 hour
          });
        }

        next();
      } catch (error) {
        console.error('Token rotation error:', error);
        return res.status(500).json({
          success: false,
          error: 'ROTATION_ERROR',
          message: 'Erro na rotação do token',
        });
      }
    };
  }

  /**
   * Validate token structure without verification (for expired tokens)
   */
  validateStructure() {
    return (req: Request, res: Response, next: NextFunction) => {
      try {
        const token = this.extractToken(req);

        if (!token) {
          return res.status(400).json({
            success: false,
            error: 'TOKEN_MISSING',
            message: 'Token obrigatório',
          });
        }

        // Decode without verification to check structure
        const decoded = jwt.decode(token, { complete: true });

        if (!decoded || typeof decoded !== 'object' || !decoded.payload) {
          return res.status(400).json({
            success: false,
            error: 'MALFORMED_TOKEN',
            message: 'Token mal formado',
          });
        }

        const payload = decoded.payload as SSOJWTPayload;

        // Validate required fields
        if (!payload.userId || !payload.sessionId || !payload.tokenType) {
          return res.status(400).json({
            success: false,
            error: 'INVALID_TOKEN_STRUCTURE',
            message: 'Token não contém campos obrigatórios',
          });
        }

        (req as any).decodedToken = payload;
        next();
      } catch (error) {
        return res.status(400).json({
          success: false,
          error: 'TOKEN_DECODE_ERROR',
          message: 'Erro ao decodificar token',
        });
      }
    };
  }

  /**
   * Multi-token validation - validates multiple tokens from different sources
   */
  validateMultiple(sources: ('header' | 'cookie' | 'body')[] = ['header']) {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      const tokens: { source: string; token: string; validation?: TokenValidationResult }[] = [];

      // Collect tokens from different sources
      for (const source of sources) {
        let token: string | null = null;

        switch (source) {
          case 'header':
            token = this.extractToken(req);
            break;
          case 'cookie':
            token = req.cookies?.accessToken;
            break;
          case 'body':
            token = req.body?.token;
            break;
        }

        if (token) {
          tokens.push({ source, token });
        }
      }

      if (tokens.length === 0) {
        return res.status(401).json({
          success: false,
          error: 'NO_TOKENS_FOUND',
          message: 'Nenhum token encontrado nas fontes especificadas',
        });
      }

      // Validate all tokens
      for (const tokenInfo of tokens) {
        tokenInfo.validation = await this.validateToken(tokenInfo.token);
      }

      // Find the first valid token
      const validToken = tokens.find(t => t.validation?.valid);

      if (!validToken) {
        return res.status(401).json({
          success: false,
          error: 'ALL_TOKENS_INVALID',
          message: 'Todos os tokens são inválidos',
          details: tokens.map(t => ({
            source: t.source,
            reason: t.validation?.reason,
          })),
        });
      }

      // Set the valid token info in request
      req.tokenValidation = validToken.validation!;
      req.validTokenSource = validToken.source;

      next();
    };
  }

  /**
   * Private helper methods
   */
  private extractToken(req: Request): string | null {
    const authHeader = req.headers.authorization;
    return authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
  }

  private async validateSession(sessionId: string): Promise<boolean> {
    try {
      const result = await this.db.get(
        `
        SELECT id FROM user_sessions 
        WHERE id = ? AND status = 'active' AND expires_at > datetime('now')
      `,
        [sessionId]
      );

      return !!result;
    } catch (error) {
      console.error('Session validation error:', error);
      return false;
    }
  }

  private async validateUserStatus(userId: string): Promise<boolean> {
    try {
      const result = await this.db.get(
        `
        SELECT id FROM users 
        WHERE id = ? AND is_active = 1 AND is_suspended = 0 AND deleted_at IS NULL
      `,
        [userId]
      );

      return !!result;
    } catch (error) {
      console.error('User validation error:', error);
      return false;
    }
  }

  private hasRequiredScope(payload: SSOJWTPayload, requiredScopes: string[]): boolean {
    const userScopes = payload.scope || [];
    return requiredScopes.every(scope => userScopes.includes(scope));
  }

  private async blacklistToken(token: string, exp: number): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    const ttl = exp - now;

    if (ttl > 0) {
      await this.cache.set(`blacklist:${token}`, 'true', ttl);
    }
  }
}

// Extend the AuthenticatedRequest interface
declare module './SSOJWTMiddleware' {
  interface AuthenticatedRequest {
    tokenValidation?: TokenValidationResult;
    validTokenSource?: string;
    refreshTokenPayload?: SSOJWTPayload;
    decodedToken?: SSOJWTPayload;
  }
}

export const tokenValidation = new TokenValidationMiddleware();
