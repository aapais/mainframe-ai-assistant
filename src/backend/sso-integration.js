/**
 * SSO Integration Module for Enhanced Backend Server
 * Integrates all SSO components with the existing server
 */

const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');

// Import SSO services
const { SecureKeyManager } = require('../auth/services/SecureKeyManager');
const { SSOService } = require('../auth/sso/SSOService');

// Import middleware
const {
  createAuthChain,
  createSSOChain,
  createAPIChain,
} = require('../auth/middleware/MiddlewareComposer');

// Import routes
const authRoutes = require('../api/routes/auth');
const userRoutes = require('../api/routes/users/users');
const ssoRoutes = require('../api/routes/auth/sso');

class SSOIntegration {
  constructor(app, dbConnection) {
    this.app = app;
    this.db = dbConnection;
    this.secureKeyManager = null;
    this.ssoService = null;
  }

  async initialize() {
    console.log('🔐 Initializing SSO integration...');

    try {
      // Initialize services
      await this.initializeServices();

      // Setup middleware
      this.setupMiddleware();

      // Setup routes
      this.setupRoutes();

      // Setup database
      await this.setupDatabase();

      console.log('✅ SSO integration initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize SSO integration:', error);
      throw error;
    }
  }

  async initializeServices() {
    // Initialize SecureKeyManager
    this.secureKeyManager = SecureKeyManager.getInstance();

    // Initialize SSOService
    this.ssoService = SSOService.getInstance();

    console.log('✅ SSO services initialized');
  }

  setupMiddleware() {
    // Global security middleware for all routes
    this.app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", 'data:', 'https:'],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
          },
        },
        crossOriginEmbedderPolicy: false,
      })
    );

    // CORS configuration for SSO
    const corsOptions = {
      origin: function (origin, callback) {
        // Allow requests with no origin (mobile apps, etc.)
        if (!origin) return callback(null, true);

        const allowedOrigins = [
          'http://localhost:3000',
          'http://localhost:3001',
          'http://localhost:8080',
          'https://login.microsoftonline.com',
          'https://accounts.google.com',
          'https://dev-*.okta.com',
          'https://auth0.com',
        ];

        if (
          allowedOrigins.some(allowed => origin.match(new RegExp(allowed.replace(/\*/g, '.*'))))
        ) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    };

    this.app.use(cors(corsOptions));

    console.log('✅ SSO middleware configured');
  }

  setupRoutes() {
    // Public authentication routes
    this.app.use('/api/auth', ...createAuthChain(), authRoutes);

    // SSO routes with specific SSO middleware
    this.app.use('/api/auth/sso', ...createSSOChain(), ssoRoutes);

    // Protected user management routes
    this.app.use(
      '/api/users',
      ...createAPIChain({
        roles: ['user', 'admin'],
        permissions: ['read'],
      }),
      userRoutes
    );

    // Admin routes
    this.app.use(
      '/api/admin',
      ...createAPIChain({
        roles: ['admin'],
        permissions: ['admin'],
      }),
      this.createAdminRoutes()
    );

    // Existing knowledge base routes - now protected
    const existingKBRoutes = this.app._router?.stack?.find(layer =>
      layer.regexp.test('/api/knowledge-base')
    );

    if (existingKBRoutes) {
      // Wrap existing KB routes with authentication
      this.app.use(
        '/api/knowledge-base',
        ...createAPIChain({
          roles: ['user', 'analyst', 'admin'],
          permissions: ['read'],
        })
      );
    }

    console.log('✅ SSO routes configured');
  }

  createAdminRoutes() {
    const router = express.Router();

    // System status
    router.get('/system/status', async (req, res) => {
      try {
        const status = {
          sso: {
            providers: this.ssoService.getAvailableProviders().length,
            activeUsers: await this.getActiveUserCount(),
          },
          security: {
            failedLogins: await this.getFailedLoginCount(),
            suspiciousActivity: await this.getSuspiciousActivityCount(),
          },
          database: {
            connections: await this.getDatabaseStatus(),
          },
        };

        res.json({ success: true, status });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // User management
    router.get('/users', async (req, res) => {
      try {
        const users = await this.getAllUsers();
        res.json({ success: true, users });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Security events
    router.get('/security/events', async (req, res) => {
      try {
        const events = await this.getSecurityEvents(req.query);
        res.json({ success: true, events });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    return router;
  }

  async setupDatabase() {
    try {
      // Setup SSO database schemas
      await this.secureKeyManager.setupDatabase();
      await this.ssoService.setupDatabase();

      console.log('✅ SSO database schemas created');
    } catch (error) {
      console.error('❌ Error setting up SSO database:', error);
      throw error;
    }
  }

  // Helper methods for admin routes
  async getActiveUserCount() {
    if (!this.db) return 0;

    try {
      const result = await this.db.get(`
        SELECT COUNT(*) as count
        FROM user_sessions
        WHERE status = 'active' AND expires_at > datetime('now')
      `);
      return result?.count || 0;
    } catch (error) {
      return 0;
    }
  }

  async getFailedLoginCount() {
    if (!this.db) return 0;

    try {
      const result = await this.db.get(`
        SELECT COUNT(*) as count
        FROM security_events
        WHERE event_type = 'failed_login'
        AND timestamp > datetime('now', '-24 hours')
      `);
      return result?.count || 0;
    } catch (error) {
      return 0;
    }
  }

  async getSuspiciousActivityCount() {
    if (!this.db) return 0;

    try {
      const result = await this.db.get(`
        SELECT COUNT(*) as count
        FROM security_events
        WHERE severity = 'high'
        AND timestamp > datetime('now', '-24 hours')
        AND resolved = 0
      `);
      return result?.count || 0;
    } catch (error) {
      return 0;
    }
  }

  async getDatabaseStatus() {
    return {
      type: this.db?.client ? 'PostgreSQL' : 'SQLite',
      connected: !!this.db,
      healthy: true,
    };
  }

  async getAllUsers() {
    if (!this.db) return [];

    try {
      const users = await this.db.all(`
        SELECT id, email, first_name, last_name, role, is_active, created_at, last_login
        FROM users
        WHERE deleted_at IS NULL
        ORDER BY created_at DESC
        LIMIT 100
      `);
      return users;
    } catch (error) {
      return [];
    }
  }

  async getSecurityEvents(query = {}) {
    if (!this.db) return [];

    try {
      const { limit = 50, severity, event_type } = query;
      let sql = `
        SELECT id, user_id, event_type, severity, description, timestamp
        FROM security_events
        WHERE 1=1
      `;
      const params = [];

      if (severity) {
        sql += ' AND severity = ?';
        params.push(severity);
      }

      if (event_type) {
        sql += ' AND event_type = ?';
        params.push(event_type);
      }

      sql += ' ORDER BY timestamp DESC LIMIT ?';
      params.push(limit);

      const events = await this.db.all(sql, params);
      return events;
    } catch (error) {
      return [];
    }
  }

  // Method to get SSO status for monitoring
  getStatus() {
    return {
      secureKeyManager: !!this.secureKeyManager,
      ssoService: !!this.ssoService,
      providers: this.ssoService ? this.ssoService.getAvailableProviders().length : 0,
    };
  }

  // Get route handlers for use in enhanced-server.js
  getAuthRoutes() {
    return authRoutes;
  }

  getSSORoutes() {
    return ssoRoutes;
  }

  getAdminRoutes() {
    return this.createAdminRoutes();
  }

  getUserRoutes() {
    return userRoutes;
  }
}

module.exports = SSOIntegration;
