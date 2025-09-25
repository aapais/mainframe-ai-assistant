import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './SSOJWTMiddleware';
import { User, UserRole } from '../../database/schemas/auth/UserSchema';
import { DatabaseManager } from '../../database/DatabaseManager';
import crypto from 'crypto';

export interface RoutePermission {
  resource: string;
  action: string;
  conditions?: Record<string, any>;
}

export interface ProtectionOptions {
  roles?: UserRole[];
  permissions?: string[] | RoutePermission[];
  requireAll?: boolean; // true = AND logic, false = OR logic
  allowOwner?: boolean; // Allow resource owner even without explicit permission
  ownerField?: string; // Field name to check ownership (default: 'userId')
  customValidator?: (req: AuthenticatedRequest, user: User) => Promise<boolean> | boolean;
}

export class RouteProtectionMiddleware {
  private db: DatabaseManager;

  constructor() {
    this.db = DatabaseManager.getInstance();
  }

  /**
   * Protect route with role-based access control
   */
  requireRole(roles: UserRole | UserRole[]) {
    return this.protect({
      roles: Array.isArray(roles) ? roles : [roles]
    });
  }

  /**
   * Protect route with permission-based access control
   */
  requirePermission(permissions: string | string[] | RoutePermission | RoutePermission[]) {
    return this.protect({
      permissions: Array.isArray(permissions) ? permissions : [permissions]
    });
  }

  /**
   * Protect route with combined role and permission checks
   */
  requireRoleAndPermission(roles: UserRole[], permissions: string[]) {
    return this.protect({
      roles,
      permissions,
      requireAll: true
    });
  }

  /**
   * Protect route with owner-based access (user can access their own resources)
   */
  requireOwnership(ownerField: string = 'userId') {
    return this.protect({
      allowOwner: true,
      ownerField
    });
  }

  /**
   * Admin-only access
   */
  requireAdmin() {
    return this.protect({
      roles: ['admin', 'super_admin']
    });
  }

  /**
   * Super admin-only access
   */
  requireSuperAdmin() {
    return this.protect({
      roles: ['super_admin']
    });
  }

  /**
   * Main protection middleware
   */
  protect(options: ProtectionOptions = {}) {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        // Check if user is authenticated
        if (!req.user) {
          return this.sendForbidden(res, 'AUTHENTICATION_REQUIRED', 'Autenticação obrigatória');
        }

        const user = req.user;
        
        // Check if user account is active
        if (!user.isActive) {
          return this.sendForbidden(res, 'ACCOUNT_INACTIVE', 'Conta inativa');
        }

        if (user.isSuspended) {
          return this.sendForbidden(res, 'ACCOUNT_SUSPENDED', 'Conta suspensa', {
            reason: user.suspendedReason,
            until: user.suspendedUntil
          });
        }

        // Custom validation
        if (options.customValidator) {
          const customResult = await options.customValidator(req, user);
          if (!customResult) {
            return this.sendForbidden(res, 'CUSTOM_VALIDATION_FAILED', 'Acesso negado pela validação customizada');
          }
        }

        // Check ownership first (if allowed)
        if (options.allowOwner) {
          const isOwner = await this.checkOwnership(req, user, options.ownerField);
          if (isOwner) {
            await this.logAccess(req, user, 'owner');
            return next();
          }
        }

        // Check roles and permissions
        const hasAccess = await this.validateAccess(user, options);
        
        if (!hasAccess.allowed) {
          return this.sendForbidden(res, 'INSUFFICIENT_PRIVILEGES', hasAccess.reason || 'Privilégios insuficientes', {
            requiredRoles: options.roles,
            requiredPermissions: options.permissions,
            userRole: user.role,
            userPermissions: user.permissions
          });
        }

        // Log successful access
        await this.logAccess(req, user, hasAccess.accessType || 'permission');
        
        next();
      } catch (error) {
        console.error('Route protection error:', error);
        return res.status(500).json({
          success: false,
          error: 'PROTECTION_ERROR',
          message: 'Erro interno na proteção da rota'
        });
      }
    };
  }

  /**
   * Dynamic permission checker - evaluates permissions at runtime
   */
  dynamicPermission(permissionResolver: (req: AuthenticatedRequest, user: User) => Promise<string[] | RoutePermission[]>) {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        if (!req.user) {
          return this.sendForbidden(res, 'AUTHENTICATION_REQUIRED', 'Autenticação obrigatória');
        }

        const dynamicPermissions = await permissionResolver(req, req.user);
        
        const hasAccess = await this.validateAccess(req.user, {
          permissions: dynamicPermissions
        });

        if (!hasAccess.allowed) {
          return this.sendForbidden(res, 'DYNAMIC_PERMISSION_DENIED', hasAccess.reason || 'Permissão dinâmica negada');
        }

        await this.logAccess(req, req.user, 'dynamic_permission');
        next();
      } catch (error) {
        console.error('Dynamic permission error:', error);
        return res.status(500).json({
          success: false,
          error: 'DYNAMIC_PERMISSION_ERROR',
          message: 'Erro na validação de permissão dinâmica'
        });
      }
    };
  }

  /**
   * Resource-specific protection
   */
  protectResource(resourceType: string, actions: string[]) {
    return this.protect({
      permissions: actions.map(action => ({
        resource: resourceType,
        action
      })),
      requireAll: false // OR logic - user needs at least one of the permissions
    });
  }

  /**
   * Time-based access control
   */
  requireTimeWindow(startHour: number, endHour: number) {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      const now = new Date();
      const currentHour = now.getHours();
      
      if (currentHour < startHour || currentHour > endHour) {
        return this.sendForbidden(res, 'TIME_RESTRICTION', `Acesso permitido apenas entre ${startHour}h e ${endHour}h`, {
          currentTime: now.toLocaleTimeString(),
          allowedWindow: `${startHour}:00 - ${endHour}:00`
        });
      }
      
      next();
    };
  }

  /**
   * IP-based access control
   */
  requireIPWhitelist(allowedIPs: string[]) {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      const clientIP = this.getClientIP(req);
      
      if (!allowedIPs.includes(clientIP)) {
        return this.sendForbidden(res, 'IP_NOT_ALLOWED', 'IP não autorizado', {
          clientIP,
          allowedIPs: allowedIPs.map(ip => ip.replace(/\d{1,3}$/, 'xxx')) // Mask IPs for security
        });
      }
      
      next();
    };
  }

  /**
   * Device-based access control
   */
  requireTrustedDevice() {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      const deviceInfo = req.deviceInfo;
      
      if (!deviceInfo?.trusted) {
        return this.sendForbidden(res, 'DEVICE_NOT_TRUSTED', 'Dispositivo não confiável', {
          deviceId: deviceInfo?.id,
          deviceName: deviceInfo?.name
        });
      }
      
      next();
    };
  }

  /**
   * MFA requirement for sensitive operations
   */
  requireMFA() {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      const user = req.user;
      const token = req.token;
      
      if (!user?.mfaEnabled) {
        return this.sendForbidden(res, 'MFA_NOT_ENABLED', 'MFA deve estar habilitado para esta operação');
      }
      
      if (!token?.mfaVerified) {
        return this.sendForbidden(res, 'MFA_NOT_VERIFIED', 'MFA deve ser verificado para esta sessão');
      }
      
      next();
    };
  }

  /**
   * Private helper methods
   */
  private async validateAccess(user: User, options: ProtectionOptions): Promise<{
    allowed: boolean;
    reason?: string;
    accessType?: string;
  }> {
    const checks: boolean[] = [];
    let accessType = '';

    // Role-based check
    if (options.roles && options.roles.length > 0) {
      const hasRole = options.roles.includes(user.role) || user.role === 'super_admin';
      checks.push(hasRole);
      accessType += hasRole ? 'role,' : '';
      
      if (!hasRole && options.requireAll) {
        return {
          allowed: false,
          reason: `Papel necessário: ${options.roles.join(' ou ')}. Usuário tem: ${user.role}`
        };
      }
    }

    // Permission-based check
    if (options.permissions && options.permissions.length > 0) {
      const hasPermission = await this.checkPermissions(user, options.permissions);
      checks.push(hasPermission.allowed);
      accessType += hasPermission.allowed ? 'permission,' : '';
      
      if (!hasPermission.allowed && options.requireAll) {
        return {
          allowed: false,
          reason: hasPermission.reason
        };
      }
    }

    // If no checks were performed, deny access
    if (checks.length === 0) {
      return { allowed: false, reason: 'Nenhuma regra de acesso definida' };
    }

    // Apply logic (AND vs OR)
    const allowed = options.requireAll ? checks.every(Boolean) : checks.some(Boolean);
    
    return {
      allowed,
      reason: allowed ? undefined : 'Critérios de acesso não atendidos',
      accessType: accessType.slice(0, -1) // Remove trailing comma
    };
  }

  private async checkPermissions(user: User, permissions: string[] | RoutePermission[]): Promise<{
    allowed: boolean;
    reason?: string;
  }> {
    const userPermissions = user.permissions || [];
    
    // If user is super admin, grant all permissions
    if (user.role === 'super_admin') {
      return { allowed: true };
    }

    // Check each permission
    for (const permission of permissions) {
      if (typeof permission === 'string') {
        // Simple string permission
        if (userPermissions.includes(permission)) {
          return { allowed: true };
        }
      } else {
        // Complex permission with resource and action
        const resourcePermission = `${permission.resource}:${permission.action}`;
        const wildcardPermission = `${permission.resource}:*`;
        
        if (userPermissions.includes(resourcePermission) || userPermissions.includes(wildcardPermission)) {
          return { allowed: true };
        }
      }
    }

    return {
      allowed: false,
      reason: `Permissões necessárias: ${permissions.map(p => 
        typeof p === 'string' ? p : `${p.resource}:${p.action}`
      ).join(', ')}`
    };
  }

  private async checkOwnership(req: AuthenticatedRequest, user: User, ownerField: string = 'userId'): Promise<boolean> {
    try {
      // Check params, body, and query for owner field
      const resourceUserId = req.params[ownerField] || req.body[ownerField] || req.query[ownerField];
      
      if (resourceUserId && resourceUserId === user.id) {
        return true;
      }

      // For dynamic ownership checking, could also query database
      // This would depend on the specific resource being accessed
      
      return false;
    } catch (error) {
      console.error('Ownership check error:', error);
      return false;
    }
  }

  private async logAccess(req: AuthenticatedRequest, user: User, accessType: string): Promise<void> {
    try {
      await this.db.run(`
        INSERT INTO access_log (id, user_id, session_id, resource, action, access_type, ip_address, user_agent, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        crypto.randomUUID(),
        user.id,
        req.sessionId,
        req.path,
        req.method,
        accessType,
        this.getClientIP(req),
        req.headers['user-agent'] || 'unknown',
        new Date().toISOString()
      ]);
    } catch (error) {
      console.error('Access logging error:', error);
    }
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

  private sendForbidden(res: Response, code: string, message: string, additional?: any) {
    return res.status(403).json({
      success: false,
      error: code,
      message,
      timestamp: new Date().toISOString(),
      ...additional
    });
  }
}

export const routeProtection = new RouteProtectionMiddleware();