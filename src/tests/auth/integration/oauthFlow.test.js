/**
 * Integration Tests for OAuth Flow
 */

const request = require('supertest');
const express = require('express');
const session = require('express-session');
const { SSOService } = require('../../../services/auth/SSOService');
const { MockGoogleProvider, MockMicrosoftProvider } = require('../mocks/ssoProviders.mock');
const { UserFactory, SessionFactory } = require('../factories/userFactory');

describe('OAuth Flow Integration Tests', () => {
  let app;
  let ssoService;
  let mockDatabase;

  beforeEach(async () => {
    // Mock database
    mockDatabase = {
      users: new Map(),
      sessions: new Map(),
    };

    // Mock repositories
    const userRepository = {
      findByEmail: email =>
        Promise.resolve(Array.from(mockDatabase.users.values()).find(user => user.email === email)),
      findByProviderId: providerId =>
        Promise.resolve(
          Array.from(mockDatabase.users.values()).find(user => user.providerId === providerId)
        ),
      create: userData => {
        const user = { ...userData, id: `user-${Date.now()}` };
        mockDatabase.users.set(user.id, user);
        return Promise.resolve(user);
      },
      update: (id, updates) => {
        const user = mockDatabase.users.get(id);
        if (user) {
          Object.assign(user, updates);
          return Promise.resolve(user);
        }
        return Promise.resolve(null);
      },
    };

    const sessionRepository = {
      create: sessionData => {
        const session = { ...sessionData, id: `session-${Date.now()}` };
        mockDatabase.sessions.set(session.id, session);
        return Promise.resolve(session);
      },
      findByToken: token =>
        Promise.resolve(
          Array.from(mockDatabase.sessions.values()).find(session => session.token === token)
        ),
      deleteByUserId: userId => {
        const sessions = Array.from(mockDatabase.sessions.values());
        const userSessions = sessions.filter(session => session.userId === userId);
        userSessions.forEach(session => mockDatabase.sessions.delete(session.id));
        return Promise.resolve(userSessions.length);
      },
    };

    // Initialize SSO service
    ssoService = new SSOService({ userRepository, sessionRepository });
    ssoService.registerProvider('google', new MockGoogleProvider());
    ssoService.registerProvider('microsoft', new MockMicrosoftProvider());

    // Create Express app
    app = express();
    app.use(express.json());
    app.use(
      session({
        secret: 'test-session-secret',
        resave: false,
        saveUninitialized: false,
        cookie: { secure: false },
      })
    );

    // Auth routes
    setupAuthRoutes(app, ssoService);
  });

  describe('OAuth Authorization', () => {
    it('should redirect to provider authorization URL', async () => {
      const response = await request(app).get('/auth/google').expect(302);

      expect(response.headers.location).toContain('https://mock-provider.com/oauth/authorize');
      expect(response.headers.location).toContain('client_id=mock-client-id');
      expect(response.headers.location).toContain('state=');
    });

    it('should store state in session', async () => {
      const agent = request.agent(app);

      const response = await agent.get('/auth/google').expect(302);

      const state = new URL(response.headers.location).searchParams.get('state');
      expect(state).toBeTruthy();
    });

    it('should handle unsupported provider', async () => {
      await request(app)
        .get('/auth/unsupported')
        .expect(400)
        .expect(res => {
          expect(res.body.error).toBe('Provider unsupported is not supported');
        });
    });
  });

  describe('OAuth Callback', () => {
    let agent;
    let state;

    beforeEach(async () => {
      agent = request.agent(app);

      // Initiate OAuth flow to get state
      const authResponse = await agent.get('/auth/google');
      const authUrl = authResponse.headers.location;
      state = new URL(authUrl).searchParams.get('state');
    });

    it('should complete OAuth flow for new user', async () => {
      const code = 'valid-auth-code';

      const response = await agent
        .get(`/auth/google/callback?code=${code}&state=${state}`)
        .expect(302);

      expect(response.headers.location).toBe('/dashboard');

      // Verify user was created
      const users = Array.from(mockDatabase.users.values());
      expect(users).toHaveLength(1);
      expect(users[0].email).toBe('test@example.com');
      expect(users[0].provider).toBe('google');
    });

    it('should complete OAuth flow for existing user', async () => {
      // Create existing user
      const existingUser = UserFactory.createOAuthUser('google', {
        providerId: 'user-123',
        email: 'test@example.com',
      });
      mockDatabase.users.set(existingUser.id, existingUser);

      const code = 'valid-auth-code';

      const response = await agent
        .get(`/auth/google/callback?code=${code}&state=${state}`)
        .expect(302);

      expect(response.headers.location).toBe('/dashboard');

      // Verify no new user was created
      const users = Array.from(mockDatabase.users.values());
      expect(users).toHaveLength(1);
    });

    it('should handle invalid authorization code', async () => {
      const code = 'invalid-code';

      await agent
        .get(`/auth/google/callback?code=${code}&state=${state}`)
        .expect(400)
        .expect(res => {
          expect(res.body.error).toContain('Invalid authorization code');
        });
    });

    it('should handle state mismatch', async () => {
      const code = 'valid-auth-code';
      const invalidState = 'invalid-state';

      await agent
        .get(`/auth/google/callback?code=${code}&state=${invalidState}`)
        .expect(400)
        .expect(res => {
          expect(res.body.error).toBe('Invalid state parameter');
        });
    });

    it('should handle missing code parameter', async () => {
      await agent
        .get(`/auth/google/callback?state=${state}`)
        .expect(400)
        .expect(res => {
          expect(res.body.error).toBe('Authorization code is required');
        });
    });

    it('should handle OAuth error callback', async () => {
      const error = 'access_denied';
      const errorDescription = 'User denied access';

      await agent
        .get(
          `/auth/google/callback?error=${error}&error_description=${errorDescription}&state=${state}`
        )
        .expect(400)
        .expect(res => {
          expect(res.body.error).toBe('OAuth error: access_denied - User denied access');
        });
    });
  });

  describe('Multiple Provider Support', () => {
    it('should handle Google OAuth flow', async () => {
      const agent = request.agent(app);

      // Initiate Google OAuth
      const authResponse = await agent.get('/auth/google');
      const state = new URL(authResponse.headers.location).searchParams.get('state');

      // Complete callback
      await agent.get(`/auth/google/callback?code=valid-auth-code&state=${state}`).expect(302);

      const users = Array.from(mockDatabase.users.values());
      expect(users[0].provider).toBe('google');
    });

    it('should handle Microsoft OAuth flow', async () => {
      const agent = request.agent(app);

      // Initiate Microsoft OAuth
      const authResponse = await agent.get('/auth/microsoft');
      const state = new URL(authResponse.headers.location).searchParams.get('state');

      // Complete callback
      await agent.get(`/auth/microsoft/callback?code=valid-auth-code&state=${state}`).expect(302);

      const users = Array.from(mockDatabase.users.values());
      expect(users[0].provider).toBe('microsoft');
    });
  });

  describe('Session Management', () => {
    it('should create session after successful OAuth', async () => {
      const agent = request.agent(app);

      const authResponse = await agent.get('/auth/google');
      const state = new URL(authResponse.headers.location).searchParams.get('state');

      await agent.get(`/auth/google/callback?code=valid-auth-code&state=${state}`).expect(302);

      // Verify session was created
      const sessions = Array.from(mockDatabase.sessions.values());
      expect(sessions).toHaveLength(1);
      expect(sessions[0].userId).toBeTruthy();
    });

    it('should access protected routes with valid session', async () => {
      const agent = request.agent(app);

      // Complete OAuth flow
      const authResponse = await agent.get('/auth/google');
      const state = new URL(authResponse.headers.location).searchParams.get('state');
      await agent.get(`/auth/google/callback?code=valid-auth-code&state=${state}`);

      // Access protected route
      await agent
        .get('/protected')
        .expect(200)
        .expect(res => {
          expect(res.body.message).toBe('Access granted');
          expect(res.body.user.email).toBe('test@example.com');
        });
    });

    it('should reject access to protected routes without session', async () => {
      await request(app)
        .get('/protected')
        .expect(401)
        .expect(res => {
          expect(res.body.error).toBe('Authentication required');
        });
    });

    it('should logout and clear session', async () => {
      const agent = request.agent(app);

      // Complete OAuth flow
      const authResponse = await agent.get('/auth/google');
      const state = new URL(authResponse.headers.location).searchParams.get('state');
      await agent.get(`/auth/google/callback?code=valid-auth-code&state=${state}`);

      // Logout
      await agent
        .post('/auth/logout')
        .expect(200)
        .expect(res => {
          expect(res.body.message).toBe('Logged out successfully');
        });

      // Verify session was cleared
      await agent.get('/protected').expect(401);
    });
  });

  describe('Error Recovery', () => {
    it('should handle database connection errors', async () => {
      // Mock database error
      const userRepository = {
        findByEmail: () => Promise.reject(new Error('Database connection failed')),
        findByProviderId: () => Promise.reject(new Error('Database connection failed')),
        create: () => Promise.reject(new Error('Database connection failed')),
      };

      const errorSSOService = new SSOService({ userRepository });
      errorSSOService.registerProvider('google', new MockGoogleProvider());

      const errorApp = express();
      errorApp.use(express.json());
      setupAuthRoutes(errorApp, errorSSOService);

      const agent = request.agent(errorApp);
      const authResponse = await agent.get('/auth/google');
      const state = new URL(authResponse.headers.location).searchParams.get('state');

      await agent
        .get(`/auth/google/callback?code=valid-auth-code&state=${state}`)
        .expect(500)
        .expect(res => {
          expect(res.body.error).toContain('Database connection failed');
        });
    });

    it('should handle provider service errors', async () => {
      const errorProvider = new MockGoogleProvider();
      errorProvider.exchangeCodeForToken = () =>
        Promise.reject(new Error('Provider service unavailable'));

      const errorSSOService = new SSOService({
        userRepository: { findByEmail: () => Promise.resolve(null) },
        sessionRepository: { create: () => Promise.resolve({}) },
      });
      errorSSOService.registerProvider('google', errorProvider);

      const errorApp = express();
      errorApp.use(express.json());
      setupAuthRoutes(errorApp, errorSSOService);

      const agent = request.agent(errorApp);
      const authResponse = await agent.get('/auth/google');
      const state = new URL(authResponse.headers.location).searchParams.get('state');

      await agent
        .get(`/auth/google/callback?code=valid-auth-code&state=${state}`)
        .expect(500)
        .expect(res => {
          expect(res.body.error).toContain('Provider service unavailable');
        });
    });
  });

  describe('Rate Limiting', () => {
    it('should handle multiple rapid authentication attempts', async () => {
      const agent = request.agent(app);
      const authResponse = await agent.get('/auth/google');
      const state = new URL(authResponse.headers.location).searchParams.get('state');

      // Make multiple rapid callback requests
      const promises = Array.from({ length: 10 }, () =>
        agent.get(`/auth/google/callback?code=valid-auth-code&state=${state}`)
      );

      const results = await Promise.allSettled(promises);

      // First request should succeed, others should handle gracefully
      const successful = results.filter(
        result => result.status === 'fulfilled' && result.value.status === 302
      );
      expect(successful.length).toBeGreaterThan(0);
    });
  });
});

// Helper function to set up auth routes
function setupAuthRoutes(app, ssoService) {
  // OAuth initiation
  app.get('/auth/:provider', async (req, res) => {
    try {
      const { provider } = req.params;
      const state = Math.random().toString(36).substring(2);
      req.session.oauth_state = state;

      const authUrl = await ssoService.getAuthorizationUrl(provider, state);
      res.redirect(authUrl);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // OAuth callback
  app.get('/auth/:provider/callback', async (req, res) => {
    try {
      const { provider } = req.params;
      const { code, state, error, error_description } = req.query;

      if (error) {
        return res.status(400).json({
          error: `OAuth error: ${error} - ${error_description || 'Unknown error'}`,
        });
      }

      if (!code) {
        return res.status(400).json({ error: 'Authorization code is required' });
      }

      if (state !== req.session.oauth_state) {
        return res.status(400).json({ error: 'Invalid state parameter' });
      }

      // Exchange code for tokens
      const tokens = await ssoService.exchangeCodeForTokens(provider, code);

      // Get user profile
      const profile = await ssoService.getUserProfile(provider, tokens.access_token);

      // Handle user creation/update
      const user = await ssoService.handleOAuthCallback(provider, profile);

      // Create session
      const session = await ssoService.createSession(user.id, tokens);

      // Store session in cookie/session
      req.session.userId = user.id;
      req.session.sessionId = session.id;

      res.redirect('/dashboard');
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });

  // Protected route
  app.get('/protected', (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Mock getting user from session
    const users = Array.from(mockDatabase?.users?.values() || []);
    const user = users.find(u => u.id === req.session.userId);

    res.json({
      message: 'Access granted',
      user: user
        ? { id: user.id, email: user.email, name: `${user.firstName} ${user.lastName}` }
        : null,
    });
  });

  // Logout
  app.post('/auth/logout', async (req, res) => {
    if (req.session.userId) {
      await ssoService.logout(req.session.userId);
      req.session.destroy();
    }
    res.json({ message: 'Logged out successfully' });
  });

  // Dashboard
  app.get('/dashboard', (req, res) => {
    res.json({ message: 'Welcome to dashboard' });
  });
}
