import express from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { Client as OktaClient } from '@okta/okta-sdk-nodejs';
import { DatabaseManager } from '../../database/DatabaseManager';
import { SecureKeyManager } from '../services/SecureKeyManager';
import { User, SSOConfiguration, SSOProvider, UserSSOConnection } from '../../database/schemas/auth/UserSchema';

export interface SSOCallbackData {
  code?: string;
  state?: string;
  error?: string;
  error_description?: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  id_token?: string;
  scope?: string;
}

export interface UserInfo {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  avatarUrl?: string;
  roles?: string[];
  groups?: string[];
}

export class SSOService {
  private static instance: SSOService;
  private db: DatabaseManager;
  private keyManager: SecureKeyManager;
  private configs: Map<string, SSOConfiguration> = new Map();

  private constructor() {
    this.db = DatabaseManager.getInstance();
    this.keyManager = SecureKeyManager.getInstance();
    this.loadConfigurations();
  }

  public static getInstance(): SSOService {
    if (!SSOService.instance) {
      SSOService.instance = new SSOService();
    }
    return SSOService.instance;
  }

  private async loadConfigurations(): Promise<void> {
    try {
      const configs = await this.db.all(`
        SELECT * FROM sso_configurations WHERE is_enabled = 1
        ORDER BY priority ASC
      `);

      for (const config of configs) {
        this.configs.set(config.id, {
          ...config,
          scopes: JSON.parse(config.scopes || '["openid", "profile", "email"]'),
          claimsMapping: JSON.parse(config.claims_mapping || '{}'),
          domainRestriction: config.domain_restriction ? JSON.parse(config.domain_restriction) : undefined,
          metadata: config.metadata ? JSON.parse(config.metadata) : undefined,
        });
      }
    } catch (error) {
      console.error('Erro ao carregar configurações SSO:', error);
    }
  }

  public getAvailableProviders(): SSOConfiguration[] {
    return Array.from(this.configs.values()).filter(config => config.isEnabled);
  }

  public async initiateSSO(providerId: string, redirectUri: string): Promise<string> {
    const config = this.configs.get(providerId);
    if (!config) {
      throw new Error('Provedor SSO não encontrado');
    }

    const state = this.generateState();
    await this.storeState(state, providerId, redirectUri);

    const authUrl = this.buildAuthUrl(config, state, redirectUri);
    return authUrl;
  }

  private buildAuthUrl(config: SSOConfiguration, state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: config.clientId,
      response_type: 'code',
      scope: config.scopes.join(' '),
      state: state,
      redirect_uri: redirectUri,
    });

    switch (config.provider) {
      case 'google':
        return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
      case 'microsoft':
        return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`;
      case 'azure_ad':
        return `https://login.microsoftonline.com/${config.metadata?.tenantId || 'common'}/oauth2/v2.0/authorize?${params}`;
      case 'okta':
        return `${config.metadata?.domain}/oauth2/default/v1/authorize?${params}`;
      default:
        if (config.authorizationUrl) {
          return `${config.authorizationUrl}?${params}`;
        }
        throw new Error('URL de autorização não configurada');
    }
  }

  public async handleCallback(callbackData: SSOCallbackData): Promise<{ user: User; token: string; isNewUser: boolean }> {
    if (callbackData.error) {
      throw new Error(`Erro de autenticação SSO: ${callbackData.error_description || callbackData.error}`);
    }

    if (!callbackData.code || !callbackData.state) {
      throw new Error('Dados de callback inválidos');
    }

    const stateData = await this.validateState(callbackData.state);
    const config = this.configs.get(stateData.providerId);

    if (!config) {
      throw new Error('Configuração SSO não encontrada');
    }

    const tokenResponse = await this.exchangeCodeForToken(config, callbackData.code, stateData.redirectUri);
    const userInfo = await this.getUserInfo(config, tokenResponse);

    if (config.domainRestriction && config.domainRestriction.length > 0) {
      const emailDomain = userInfo.email.split('@')[1];
      if (!config.domainRestriction.includes(emailDomain)) {
        throw new Error('Domínio de email não autorizado');
      }
    }

    const { user, isNewUser } = await this.findOrCreateUser(userInfo, config);
    await this.storeSSOConnection(user.id, config.id, userInfo.id, tokenResponse);

    const jwtToken = this.generateJWT(user);
    await this.createUserSession(user.id, jwtToken);

    await this.logSecurityEvent({
      userId: user.id,
      eventType: isNewUser ? 'sso_user_created' : 'sso_login',
      description: `Login SSO via ${config.provider}`,
      metadata: {
        provider: config.provider,
        externalId: userInfo.id,
        isNewUser
      }
    });

    return { user, token: jwtToken, isNewUser };
  }

  private async exchangeCodeForToken(config: SSOConfiguration, code: string, redirectUri: string): Promise<TokenResponse> {
    const tokenUrl = config.tokenUrl || this.getDefaultTokenUrl(config);

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code: code,
      redirect_uri: redirectUri,
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      throw new Error(`Falha na troca de código por token: ${response.statusText}`);
    }

    return await response.json() as TokenResponse;
  }

  private async getUserInfo(config: SSOConfiguration, tokenResponse: TokenResponse): Promise<UserInfo> {
    switch (config.provider) {
      case 'google':
        return await this.getGoogleUserInfo(tokenResponse);
      case 'microsoft':
      case 'azure_ad':
        return await this.getMicrosoftUserInfo(tokenResponse, config);
      case 'okta':
        return await this.getOktaUserInfo(tokenResponse, config);
      default:
        return await this.getGenericUserInfo(tokenResponse, config);
    }
  }

  private async getGoogleUserInfo(tokenResponse: TokenResponse): Promise<UserInfo> {
    const client = new OAuth2Client();
    client.setCredentials({ access_token: tokenResponse.access_token });

    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${tokenResponse.access_token}`,
      },
    });

    const data = await response.json();

    return {
      id: data.id,
      email: data.email,
      firstName: data.given_name,
      lastName: data.family_name,
      displayName: data.name,
      avatarUrl: data.picture,
    };
  }

  private async getMicrosoftUserInfo(tokenResponse: TokenResponse, config: SSOConfiguration): Promise<UserInfo> {
    const response = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: {
        Authorization: `Bearer ${tokenResponse.access_token}`,
      },
    });

    const data = await response.json();

    return {
      id: data.id,
      email: data.mail || data.userPrincipalName,
      firstName: data.givenName,
      lastName: data.surname,
      displayName: data.displayName,
    };
  }

  private async getOktaUserInfo(tokenResponse: TokenResponse, config: SSOConfiguration): Promise<UserInfo> {
    const userInfoUrl = config.userinfoUrl || `${config.metadata?.domain}/oauth2/default/v1/userinfo`;

    const response = await fetch(userInfoUrl, {
      headers: {
        Authorization: `Bearer ${tokenResponse.access_token}`,
      },
    });

    const data = await response.json();

    return {
      id: data.sub,
      email: data.email,
      firstName: data.given_name,
      lastName: data.family_name,
      displayName: data.name,
    };
  }

  private async getGenericUserInfo(tokenResponse: TokenResponse, config: SSOConfiguration): Promise<UserInfo> {
    if (!config.userinfoUrl) {
      throw new Error('URL de informações do usuário não configurada');
    }

    const response = await fetch(config.userinfoUrl, {
      headers: {
        Authorization: `Bearer ${tokenResponse.access_token}`,
      },
    });

    const data = await response.json();

    const mapping = config.claimsMapping;

    return {
      id: data.sub || data[mapping.email] || data.id,
      email: data[mapping.email] || data.email,
      firstName: data[mapping.firstName] || data.given_name,
      lastName: data[mapping.lastName] || data.family_name,
      displayName: data[mapping.displayName] || data.name,
    };
  }

  private async findOrCreateUser(userInfo: UserInfo, config: SSOConfiguration): Promise<{ user: User; isNewUser: boolean }> {
    let user = await this.findUserByEmail(userInfo.email);
    let isNewUser = false;

    if (!user && config.autoProvisionUsers) {
      user = await this.createUserFromSSO(userInfo, config);
      isNewUser = true;
    } else if (!user) {
      throw new Error('Usuário não encontrado e auto-provisionamento desabilitado');
    }

    if (!user.isActive) {
      throw new Error('Conta de usuário desativada');
    }

    if (user.isSuspended) {
      throw new Error('Conta de usuário suspensa');
    }

    return { user, isNewUser };
  }

  private async findUserByEmail(email: string): Promise<User | null> {
    const result = await this.db.get(`
      SELECT * FROM users WHERE email = ? AND deleted_at IS NULL
    `, [email]);

    return result ? this.mapDatabaseToUser(result) : null;
  }

  private async createUserFromSSO(userInfo: UserInfo, config: SSOConfiguration): Promise<User> {
    const userId = crypto.randomUUID();
    const now = new Date().toISOString();

    const user: User = {
      id: userId,
      email: userInfo.email,
      emailVerified: true,
      firstName: userInfo.firstName,
      lastName: userInfo.lastName,
      displayName: userInfo.displayName || `${userInfo.firstName} ${userInfo.lastName}`.trim(),
      avatarUrl: userInfo.avatarUrl,
      role: config.defaultRole,
      permissions: this.getDefaultPermissions(config.defaultRole),
      isActive: true,
      isSuspended: false,
      loginAttempts: 0,
      mfaEnabled: false,
      mfaMethods: [],
      createdAt: new Date(now),
      updatedAt: new Date(now),
    };

    await this.db.run(`
      INSERT INTO users (
        id, email, email_verified, first_name, last_name, display_name,
        avatar_url, role, permissions, is_active, is_suspended, login_attempts,
        mfa_enabled, mfa_methods, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      user.id, user.email, user.emailVerified, user.firstName, user.lastName,
      user.displayName, user.avatarUrl, user.role, JSON.stringify(user.permissions),
      user.isActive, user.isSuspended, user.loginAttempts, user.mfaEnabled,
      JSON.stringify(user.mfaMethods), now, now
    ]);

    return user;
  }

  private async storeSSOConnection(userId: string, ssoConfigId: string, externalId: string, tokenResponse: TokenResponse): Promise<void> {
    const connectionId = crypto.randomUUID();
    const now = new Date().toISOString();

    await this.db.run(`
      INSERT OR REPLACE INTO user_sso_connections (
        id, user_id, sso_config_id, external_id, access_token, refresh_token,
        token_expires_at, last_sync, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      connectionId, userId, ssoConfigId, externalId,
      tokenResponse.access_token, tokenResponse.refresh_token,
      tokenResponse.expires_in ? new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString() : null,
      now, true, now, now
    ]);
  }

  private generateState(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private async storeState(state: string, providerId: string, redirectUri: string): Promise<void> {
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos

    await this.db.run(`
      INSERT INTO sso_states (state, provider_id, redirect_uri, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?)
    `, [state, providerId, redirectUri, expiresAt.toISOString(), new Date().toISOString()]);
  }

  private async validateState(state: string): Promise<{ providerId: string; redirectUri: string }> {
    const result = await this.db.get(`
      SELECT * FROM sso_states
      WHERE state = ? AND expires_at > datetime('now')
    `, [state]);

    if (!result) {
      throw new Error('Estado SSO inválido ou expirado');
    }

    // Limpar estado usado
    await this.db.run('DELETE FROM sso_states WHERE state = ?', [state]);

    return {
      providerId: result.provider_id,
      redirectUri: result.redirect_uri
    };
  }

  private generateJWT(user: User): string {
    const secret = process.env.JWT_SECRET || 'default-secret';

    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      permissions: user.permissions,
    };

    return jwt.sign(payload, secret, { expiresIn: '24h' });
  }

  private async createUserSession(userId: string, sessionToken: string): Promise<void> {
    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas

    await this.db.run(`
      INSERT INTO user_sessions (
        id, user_id, session_token, expires_at, status, created_at, last_activity
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      sessionId, userId, sessionToken, expiresAt.toISOString(),
      'active', new Date().toISOString(), new Date().toISOString()
    ]);
  }

  private async logSecurityEvent(event: {
    userId?: string;
    eventType: string;
    description: string;
    metadata?: any;
  }): Promise<void> {
    const eventId = crypto.randomUUID();

    await this.db.run(`
      INSERT INTO security_events (
        id, user_id, event_type, severity, description, metadata, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      eventId, event.userId, event.eventType, 'medium',
      event.description, JSON.stringify(event.metadata || {}),
      new Date().toISOString()
    ]);
  }

  private getDefaultTokenUrl(config: SSOConfiguration): string {
    switch (config.provider) {
      case 'google':
        return 'https://oauth2.googleapis.com/token';
      case 'microsoft':
        return 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
      case 'azure_ad':
        return `https://login.microsoftonline.com/${config.metadata?.tenantId || 'common'}/oauth2/v2.0/token`;
      case 'okta':
        return `${config.metadata?.domain}/oauth2/default/v1/token`;
      default:
        throw new Error('URL de token não configurada');
    }
  }

  private getDefaultPermissions(role: string): string[] {
    const permissionsByRole = {
      user: ['read'],
      analyst: ['read', 'write'],
      admin: ['read', 'write', 'admin'],
      super_admin: ['read', 'write', 'admin', 'system'],
    };

    return permissionsByRole[role] || ['read'];
  }

  private mapDatabaseToUser(dbUser: any): User {
    return {
      id: dbUser.id,
      email: dbUser.email,
      emailVerified: Boolean(dbUser.email_verified),
      passwordHash: dbUser.password_hash,
      firstName: dbUser.first_name,
      lastName: dbUser.last_name,
      displayName: dbUser.display_name,
      avatarUrl: dbUser.avatar_url,
      role: dbUser.role,
      permissions: dbUser.permissions ? JSON.parse(dbUser.permissions) : [],
      isActive: Boolean(dbUser.is_active),
      isSuspended: Boolean(dbUser.is_suspended),
      suspendedReason: dbUser.suspended_reason,
      suspendedUntil: dbUser.suspended_until ? new Date(dbUser.suspended_until) : undefined,
      lastLogin: dbUser.last_login ? new Date(dbUser.last_login) : undefined,
      lastActivity: dbUser.last_activity ? new Date(dbUser.last_activity) : undefined,
      loginAttempts: dbUser.login_attempts || 0,
      lockedUntil: dbUser.locked_until ? new Date(dbUser.locked_until) : undefined,
      passwordChangedAt: dbUser.password_changed_at ? new Date(dbUser.password_changed_at) : undefined,
      mfaEnabled: Boolean(dbUser.mfa_enabled),
      mfaSecret: dbUser.mfa_secret,
      mfaMethods: dbUser.mfa_methods ? JSON.parse(dbUser.mfa_methods) : [],
      backupCodes: dbUser.backup_codes ? JSON.parse(dbUser.backup_codes) : undefined,
      createdAt: new Date(dbUser.created_at),
      updatedAt: new Date(dbUser.updated_at),
      deletedAt: dbUser.deleted_at ? new Date(dbUser.deleted_at) : undefined,
      metadata: dbUser.metadata ? JSON.parse(dbUser.metadata) : undefined,
    };
  }

  public async setupDatabase(): Promise<void> {
    const tables = [
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        email_verified INTEGER DEFAULT 0,
        password_hash TEXT,
        first_name TEXT,
        last_name TEXT,
        display_name TEXT,
        avatar_url TEXT,
        role TEXT DEFAULT 'user',
        permissions TEXT DEFAULT '[]',
        is_active INTEGER DEFAULT 1,
        is_suspended INTEGER DEFAULT 0,
        suspended_reason TEXT,
        suspended_until TEXT,
        last_login TEXT,
        last_activity TEXT,
        login_attempts INTEGER DEFAULT 0,
        locked_until TEXT,
        password_changed_at TEXT,
        mfa_enabled INTEGER DEFAULT 0,
        mfa_secret TEXT,
        mfa_methods TEXT DEFAULT '[]',
        backup_codes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        metadata TEXT
      )`,

      `CREATE TABLE IF NOT EXISTS sso_configurations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        provider TEXT NOT NULL,
        is_enabled INTEGER DEFAULT 1,
        priority INTEGER DEFAULT 0,
        client_id TEXT NOT NULL,
        client_secret TEXT NOT NULL,
        discovery_url TEXT,
        authorization_url TEXT,
        token_url TEXT,
        userinfo_url TEXT,
        scopes TEXT DEFAULT '["openid", "profile", "email"]',
        claims_mapping TEXT DEFAULT '{}',
        domain_restriction TEXT,
        auto_provision_users INTEGER DEFAULT 1,
        default_role TEXT DEFAULT 'user',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        metadata TEXT
      )`,

      `CREATE TABLE IF NOT EXISTS user_sso_connections (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        sso_config_id TEXT NOT NULL,
        external_id TEXT NOT NULL,
        access_token TEXT,
        refresh_token TEXT,
        token_expires_at TEXT,
        last_sync TEXT,
        sync_data TEXT,
        is_active INTEGER DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (sso_config_id) REFERENCES sso_configurations(id),
        UNIQUE(sso_config_id, external_id)
      )`,

      `CREATE TABLE IF NOT EXISTS user_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        session_token TEXT UNIQUE NOT NULL,
        refresh_token TEXT,
        device_id TEXT,
        device_name TEXT,
        device_type TEXT,
        ip_address TEXT,
        user_agent TEXT,
        location_country TEXT,
        location_region TEXT,
        location_city TEXT,
        location_timezone TEXT,
        status TEXT DEFAULT 'active',
        expires_at TEXT NOT NULL,
        last_activity TEXT NOT NULL,
        created_at TEXT NOT NULL,
        revoked_at TEXT,
        revoked_by TEXT,
        revoked_reason TEXT,
        metadata TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`,

      `CREATE TABLE IF NOT EXISTS sso_states (
        state TEXT PRIMARY KEY,
        provider_id TEXT NOT NULL,
        redirect_uri TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`,

      `CREATE TABLE IF NOT EXISTS security_events (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        event_type TEXT NOT NULL,
        severity TEXT DEFAULT 'medium',
        description TEXT NOT NULL,
        metadata TEXT DEFAULT '{}',
        ip_address TEXT,
        user_agent TEXT,
        resolved INTEGER DEFAULT 0,
        resolved_by TEXT,
        resolved_at TEXT,
        action_taken TEXT,
        timestamp TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`
    ];

    for (const table of tables) {
      await this.db.run(table);
    }

    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
      'CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)',
      'CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON user_sessions(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(session_token)',
      'CREATE INDEX IF NOT EXISTS idx_sso_connections_user_id ON user_sso_connections(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON security_events(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(event_type)',
    ];

    for (const index of indexes) {
      await this.db.run(index);
    }
  }
}