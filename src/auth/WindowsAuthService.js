/**
 * Windows Local Authentication Service
 * Funciona tanto em Electron quanto no Browser
 * Não requer Azure AD - usa apenas credenciais Windows locais
 */

const os = require('os');
const crypto = require('crypto');
const { Client } = require('pg');

class WindowsAuthService {
  constructor() {
    this.sessions = new Map();
    this.dbClient = null;
    this.isElectron = process.versions && process.versions.electron;
    this.initializeDB();
  }

  async initializeDB() {
    try {
      this.dbClient = new Client({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'mainframe_kb',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
      });
      await this.dbClient.connect();
      console.log('✅ Windows Auth conectado ao PostgreSQL');
    } catch (error) {
      console.log('⚠️ Windows Auth rodando sem banco (modo standalone)');
    }
  }

  /**
   * Obtém informações do usuário Windows atual
   */
  getCurrentWindowsUser() {
    const userInfo = os.userInfo();
    const hostname = os.hostname();
    const domain = process.env.USERDOMAIN || hostname.split('.')[0] || 'LOCAL';

    return {
      username: userInfo.username || process.env.USERNAME,
      domain: domain,
      computer: hostname,
      isInDomain: domain !== 'WORKGROUP' && domain !== hostname,
      upn: `${userInfo.username}@${domain.toLowerCase()}.local`,
      uid: userInfo.uid,
      gid: userInfo.gid,
      home: userInfo.homedir,
    };
  }

  /**
   * Gera um token JWT simples (sem dependências externas)
   */
  generateToken(userData) {
    const header = {
      alg: 'HS256',
      typ: 'JWT',
    };

    const payload = {
      ...userData,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 8 * 60 * 60, // 8 horas
      iss: 'windows-local-auth',
      jti: crypto.randomBytes(16).toString('hex'),
    };

    const base64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
    const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64url');

    const secret = process.env.JWT_SECRET || 'windows-local-secret-' + os.hostname();
    const signature = crypto
      .createHmac('sha256', secret)
      .update(base64Header + '.' + base64Payload)
      .digest('base64url');

    return `${base64Header}.${base64Payload}.${signature}`;
  }

  /**
   * Valida um token JWT
   */
  validateToken(token) {
    try {
      const [header, payload, signature] = token.split('.');

      const secret = process.env.JWT_SECRET || 'windows-local-secret-' + os.hostname();
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(header + '.' + payload)
        .digest('base64url');

      if (signature !== expectedSignature) {
        return null;
      }

      const decodedPayload = JSON.parse(Buffer.from(payload, 'base64url').toString());

      // Verifica expiração
      if (decodedPayload.exp < Math.floor(Date.now() / 1000)) {
        return null;
      }

      return decodedPayload;
    } catch (error) {
      return null;
    }
  }

  /**
   * Login automático com Windows
   */
  async loginWithWindows() {
    const windowsUser = this.getCurrentWindowsUser();

    const userData = {
      id: crypto.createHash('md5').update(windowsUser.upn).digest('hex'),
      username: windowsUser.username,
      email: windowsUser.upn,
      displayName: windowsUser.username,
      domain: windowsUser.domain,
      computer: windowsUser.computer,
      authMethod: 'windows-local',
      roles: ['user'],
    };

    // Salva sessão no banco se disponível
    if (this.dbClient) {
      try {
        await this.dbClient.query(
          `
          INSERT INTO user_sessions (
            session_id, user_id, username, email,
            login_method, created_at, expires_at, is_active
          ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW() + INTERVAL '8 hours', true)
          ON CONFLICT (session_id) DO UPDATE SET
            expires_at = NOW() + INTERVAL '8 hours',
            is_active = true
        `,
          [userData.id, userData.id, userData.username, userData.email, 'windows-local']
        );
      } catch (error) {
        console.log('Sessão salva em memória apenas');
      }
    }

    // Salva em memória
    this.sessions.set(userData.id, {
      ...userData,
      loginTime: new Date(),
      expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
    });

    const token = this.generateToken(userData);

    return {
      success: true,
      user: userData,
      token: token,
      expiresIn: 28800, // 8 horas em segundos
      method: 'Windows Local Authentication',
    };
  }

  /**
   * Verifica se o usuário está autenticado
   */
  async checkAuthentication(token) {
    if (!token) {
      return { authenticated: false, message: 'Token não fornecido' };
    }

    const payload = this.validateToken(token);

    if (!payload) {
      return { authenticated: false, message: 'Token inválido ou expirado' };
    }

    // Verifica se a sessão ainda está ativa no banco
    if (this.dbClient) {
      try {
        const result = await this.dbClient.query(
          'SELECT * FROM user_sessions WHERE session_id = $1 AND is_active = true AND expires_at > NOW()',
          [payload.id]
        );

        if (result.rows.length === 0) {
          return { authenticated: false, message: 'Sessão expirada' };
        }
      } catch (error) {
        // Continua com validação em memória
      }
    }

    return {
      authenticated: true,
      user: {
        id: payload.id,
        username: payload.username,
        email: payload.email,
        domain: payload.domain,
        computer: payload.computer,
      },
    };
  }

  /**
   * Logout
   */
  async logout(token) {
    const payload = this.validateToken(token);

    if (payload) {
      // Remove da memória
      this.sessions.delete(payload.id);

      // Remove do banco
      if (this.dbClient) {
        try {
          await this.dbClient.query(
            'UPDATE user_sessions SET is_active = false WHERE session_id = $1',
            [payload.id]
          );
        } catch (error) {
          // Ignora erro do banco
        }
      }
    }

    return { success: true, message: 'Logout realizado' };
  }

  /**
   * Middleware para Express
   */
  middleware() {
    return async (req, res, next) => {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        req.user = null;
        return next();
      }

      const token = authHeader.substring(7);
      const authResult = await this.checkAuthentication(token);

      if (authResult.authenticated) {
        req.user = authResult.user;
      } else {
        req.user = null;
      }

      next();
    };
  }

  /**
   * Rotas para Express
   */
  setupRoutes(app) {
    // Login automático Windows
    app.get('/api/auth/windows/login', async (req, res) => {
      try {
        const result = await this.loginWithWindows();
        res.json(result);
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    // Status de autenticação
    app.get('/api/auth/status', async (req, res) => {
      const token = req.headers.authorization?.substring(7);
      const result = await this.checkAuthentication(token);

      const windowsUser = this.getCurrentWindowsUser();

      res.json({
        ...result,
        windows: windowsUser,
        server: 'Windows Local Auth',
      });
    });

    // Logout
    app.post('/api/auth/logout', async (req, res) => {
      const token = req.headers.authorization?.substring(7);
      const result = await this.logout(token);
      res.json(result);
    });

    // Perfil do usuário
    app.get('/api/user/profile', async (req, res) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Não autenticado',
        });
      }

      res.json({
        success: true,
        user: req.user,
      });
    });

    console.log('✅ Rotas Windows Auth configuradas');
  }
}

// Singleton
let instance = null;

function getWindowsAuth() {
  if (!instance) {
    instance = new WindowsAuthService();
  }
  return instance;
}

module.exports = {
  WindowsAuthService,
  getWindowsAuth,
};
