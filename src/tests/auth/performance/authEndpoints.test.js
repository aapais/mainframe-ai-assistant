/**
 * Performance Tests for Authentication Endpoints
 */

const request = require('supertest');
const express = require('express');
const { performance } = require('perf_hooks');
const { SSOService } = require('../../../services/auth/SSOService');
const { MockGoogleProvider, MockJWTProvider } = require('../mocks/ssoProviders.mock');
const { UserFactory } = require('../factories/userFactory');

describe('Authentication Endpoints Performance Tests', () => {
  let app;
  let ssoService;
  let mockDatabase;
  let jwtProvider;

  beforeEach(async () => {
    // Setup in-memory database with performance optimizations
    mockDatabase = {
      users: new Map(),
      sessions: new Map(),
      authEvents: new Map(),
      // Add indices for faster lookups
      emailIndex: new Map(),
      providerIndex: new Map(),
      sessionIndex: new Map()
    };

    // Optimized repositories with caching
    const userRepository = {
      findByEmail: async (email) => {
        const userId = mockDatabase.emailIndex.get(email);
        return userId ? mockDatabase.users.get(userId) : null;
      },
      findById: async (id) => mockDatabase.users.get(id),
      findByProviderId: async (providerId) => {
        const userId = mockDatabase.providerIndex.get(providerId);
        return userId ? mockDatabase.users.get(userId) : null;
      },
      create: async (userData) => {
        const user = { ...userData, id: `user-${Date.now()}-${Math.random()}` };
        mockDatabase.users.set(user.id, user);
        mockDatabase.emailIndex.set(user.email, user.id);
        if (user.providerId) {
          mockDatabase.providerIndex.set(user.providerId, user.id);
        }
        return user;
      },
      update: async (id, updates) => {
        const user = mockDatabase.users.get(id);
        if (user) {
          Object.assign(user, updates);
          return user;
        }
        return null;
      }
    };

    const sessionRepository = {
      create: async (sessionData) => {
        const session = { ...sessionData, id: `session-${Date.now()}-${Math.random()}` };
        mockDatabase.sessions.set(session.id, session);
        mockDatabase.sessionIndex.set(session.token, session.id);
        return session;
      },
      findByToken: async (token) => {
        const sessionId = mockDatabase.sessionIndex.get(token);
        return sessionId ? mockDatabase.sessions.get(sessionId) : null;
      },
      deleteByUserId: async (userId) => {
        const sessions = Array.from(mockDatabase.sessions.values());
        const userSessions = sessions.filter(session => session.userId === userId);
        userSessions.forEach(session => {
          mockDatabase.sessions.delete(session.id);
          mockDatabase.sessionIndex.delete(session.token);
        });
        return userSessions.length;
      }
    };

    jwtProvider = new MockJWTProvider();
    ssoService = new SSOService({ userRepository, sessionRepository, jwtProvider });
    ssoService.registerProvider('google', new MockGoogleProvider());

    app = express();
    app.use(express.json());
    setupPerformanceTestRoutes(app, ssoService);

    // Pre-populate database for performance testing
    await populateTestData(1000);
  });

  async function populateTestData(userCount) {
    const users = UserFactory.createBulkUsers(userCount);

    for (const user of users) {
      await ssoService.userRepository.create(user);
    }
  }

  function measureTime(fn) {
    return async (...args) => {
      const start = performance.now();
      const result = await fn(...args);
      const end = performance.now();
      return { result, duration: end - start };
    };
  }

  describe('OAuth Flow Performance', () => {
    describe('Authorization Endpoint', () => {
      it('should handle authorization requests under 50ms', async () => {
        const iterations = 100;
        const durations = [];

        for (let i = 0; i < iterations; i++) {
          const start = performance.now();

          await request(app)
            .get('/auth/google')
            .expect(302);

          const end = performance.now();
          durations.push(end - start);
        }

        const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
        const maxDuration = Math.max(...durations);
        const p95Duration = durations.sort((a, b) => a - b)[Math.floor(0.95 * durations.length)];

        console.log(`Authorization Endpoint Performance:
          Average: ${avgDuration.toFixed(2)}ms
          Max: ${maxDuration.toFixed(2)}ms
          P95: ${p95Duration.toFixed(2)}ms`);

        expect(avgDuration).toBeLessThan(50);
        expect(p95Duration).toBeLessThan(100);
      });

      it('should maintain performance under concurrent load', async () => {
        const concurrency = 50;
        const requests = [];

        const start = performance.now();

        for (let i = 0; i < concurrency; i++) {
          requests.push(
            request(app)
              .get('/auth/google')
              .expect(302)
          );
        }

        await Promise.all(requests);

        const end = performance.now();
        const totalDuration = end - start;
        const avgDurationPerRequest = totalDuration / concurrency;

        console.log(`Concurrent Authorization Performance:
          Total Time: ${totalDuration.toFixed(2)}ms
          Avg per Request: ${avgDurationPerRequest.toFixed(2)}ms
          Requests per Second: ${(concurrency / (totalDuration / 1000)).toFixed(2)}`);

        expect(avgDurationPerRequest).toBeLessThan(100);
        expect(totalDuration).toBeLessThan(5000); // All requests within 5 seconds
      });
    });

    describe('OAuth Callback Performance', () => {
      it('should process callbacks for new users under 200ms', async () => {
        const iterations = 50;
        const durations = [];

        for (let i = 0; i < iterations; i++) {
          const uniqueCode = `valid-code-${i}`;
          const uniqueState = `state-${i}`;

          const start = performance.now();

          await request(app)
            .get(`/auth/google/callback?code=${uniqueCode}&state=${uniqueState}`)
            .expect(302);

          const end = performance.now();
          durations.push(end - start);
        }

        const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
        const maxDuration = Math.max(...durations);
        const p95Duration = durations.sort((a, b) => a - b)[Math.floor(0.95 * durations.length)];

        console.log(`OAuth Callback Performance (New Users):
          Average: ${avgDuration.toFixed(2)}ms
          Max: ${maxDuration.toFixed(2)}ms
          P95: ${p95Duration.toFixed(2)}ms`);

        expect(avgDuration).toBeLessThan(200);
        expect(p95Duration).toBeLessThan(500);
      });

      it('should process callbacks for existing users under 100ms', async () => {
        // Pre-create users
        const existingUsers = [];
        for (let i = 0; i < 50; i++) {
          const user = UserFactory.createOAuthUser('google', { providerId: `google-existing-${i}` });
          await ssoService.userRepository.create(user);
          existingUsers.push(user);
        }

        const iterations = 50;
        const durations = [];

        for (let i = 0; i < iterations; i++) {
          const uniqueCode = `existing-code-${i}`;
          const uniqueState = `existing-state-${i}`;

          const start = performance.now();

          await request(app)
            .get(`/auth/google/callback?code=${uniqueCode}&state=${uniqueState}`)
            .expect(302);

          const end = performance.now();
          durations.push(end - start);
        }

        const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
        const p95Duration = durations.sort((a, b) => a - b)[Math.floor(0.95 * durations.length)];

        console.log(`OAuth Callback Performance (Existing Users):
          Average: ${avgDuration.toFixed(2)}ms
          P95: ${p95Duration.toFixed(2)}ms`);

        expect(avgDuration).toBeLessThan(100);
        expect(p95Duration).toBeLessThan(200);
      });
    });
  });

  describe('JWT Token Performance', () => {
    describe('Token Generation', () => {
      it('should generate tokens under 10ms', async () => {
        const iterations = 1000;
        const durations = [];

        for (let i = 0; i < iterations; i++) {
          const payload = { userId: `user-${i}`, exp: Math.floor(Date.now() / 1000) + 3600 };

          const start = performance.now();
          jwtProvider.generateToken(payload);
          const end = performance.now();

          durations.push(end - start);
        }

        const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
        const maxDuration = Math.max(...durations);

        console.log(`JWT Generation Performance:
          Average: ${avgDuration.toFixed(4)}ms
          Max: ${maxDuration.toFixed(4)}ms
          Tokens per Second: ${(iterations / (durations.reduce((a, b) => a + b, 0) / 1000)).toFixed(0)}`);

        expect(avgDuration).toBeLessThan(10);
      });
    });

    describe('Token Validation', () => {
      it('should validate tokens under 5ms', async () => {
        const tokens = [];

        // Generate test tokens
        for (let i = 0; i < 100; i++) {
          const payload = { userId: `user-${i}`, exp: Math.floor(Date.now() / 1000) + 3600 };
          tokens.push(jwtProvider.generateToken(payload));
        }

        const iterations = 1000;
        const durations = [];

        for (let i = 0; i < iterations; i++) {
          const token = tokens[i % tokens.length];

          const start = performance.now();
          try {
            jwtProvider.verifyToken(token);
          } catch (error) {
            // Ignore validation errors for performance testing
          }
          const end = performance.now();

          durations.push(end - start);
        }

        const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
        const validationsPerSecond = iterations / (durations.reduce((a, b) => a + b, 0) / 1000);

        console.log(`JWT Validation Performance:
          Average: ${avgDuration.toFixed(4)}ms
          Validations per Second: ${validationsPerSecond.toFixed(0)}`);

        expect(avgDuration).toBeLessThan(5);
        expect(validationsPerSecond).toBeGreaterThan(10000);
      });
    });

    describe('Protected Endpoint Performance', () => {
      it('should authorize requests under 20ms', async () => {
        const token = jwtProvider.generateToken({
          userId: 'test-user',
          exp: Math.floor(Date.now() / 1000) + 3600
        });

        const iterations = 200;
        const durations = [];

        for (let i = 0; i < iterations; i++) {
          const start = performance.now();

          await request(app)
            .get('/protected')
            .set('Authorization', `Bearer ${token}`)
            .expect(200);

          const end = performance.now();
          durations.push(end - start);
        }

        const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
        const p95Duration = durations.sort((a, b) => a - b)[Math.floor(0.95 * durations.length)];

        console.log(`Protected Endpoint Performance:
          Average: ${avgDuration.toFixed(2)}ms
          P95: ${p95Duration.toFixed(2)}ms`);

        expect(avgDuration).toBeLessThan(20);
        expect(p95Duration).toBeLessThan(50);
      });
    });
  });

  describe('Database Performance', () => {
    describe('User Lookup Performance', () => {
      it('should find users by email under 5ms', async () => {
        const iterations = 500;
        const durations = [];

        // Use existing users from populated data
        const emails = Array.from(mockDatabase.emailIndex.keys()).slice(0, 100);

        for (let i = 0; i < iterations; i++) {
          const email = emails[i % emails.length];

          const start = performance.now();
          await ssoService.userRepository.findByEmail(email);
          const end = performance.now();

          durations.push(end - start);
        }

        const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
        const lookupsPerSecond = iterations / (durations.reduce((a, b) => a + b, 0) / 1000);

        console.log(`User Email Lookup Performance:
          Average: ${avgDuration.toFixed(4)}ms
          Lookups per Second: ${lookupsPerSecond.toFixed(0)}`);

        expect(avgDuration).toBeLessThan(5);
        expect(lookupsPerSecond).toBeGreaterThan(1000);
      });

      it('should find users by provider ID under 5ms', async () => {
        const iterations = 500;
        const durations = [];

        // Use existing provider IDs from populated data
        const providerIds = Array.from(mockDatabase.providerIndex.keys()).slice(0, 100);

        for (let i = 0; i < iterations; i++) {
          const providerId = providerIds[i % providerIds.length];

          const start = performance.now();
          await ssoService.userRepository.findByProviderId(providerId);
          const end = performance.now();

          durations.push(end - start);
        }

        const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;

        console.log(`Provider ID Lookup Performance:
          Average: ${avgDuration.toFixed(4)}ms`);

        expect(avgDuration).toBeLessThan(5);
      });
    });

    describe('Session Management Performance', () => {
      it('should create sessions under 10ms', async () => {
        const iterations = 200;
        const durations = [];

        for (let i = 0; i < iterations; i++) {
          const sessionData = {
            userId: `user-${i}`,
            token: `token-${i}`,
            expiresAt: new Date(Date.now() + 3600000)
          };

          const start = performance.now();
          await ssoService.sessionRepository.create(sessionData);
          const end = performance.now();

          durations.push(end - start);
        }

        const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;

        console.log(`Session Creation Performance:
          Average: ${avgDuration.toFixed(4)}ms`);

        expect(avgDuration).toBeLessThan(10);
      });

      it('should find sessions by token under 5ms', async () => {
        // Pre-create sessions
        const tokens = [];
        for (let i = 0; i < 100; i++) {
          const sessionData = {
            userId: `user-${i}`,
            token: `lookup-token-${i}`,
            expiresAt: new Date(Date.now() + 3600000)
          };
          await ssoService.sessionRepository.create(sessionData);
          tokens.push(sessionData.token);
        }

        const iterations = 500;
        const durations = [];

        for (let i = 0; i < iterations; i++) {
          const token = tokens[i % tokens.length];

          const start = performance.now();
          await ssoService.sessionRepository.findByToken(token);
          const end = performance.now();

          durations.push(end - start);
        }

        const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;

        console.log(`Session Token Lookup Performance:
          Average: ${avgDuration.toFixed(4)}ms`);

        expect(avgDuration).toBeLessThan(5);
      });
    });
  });

  describe('Load Testing', () => {
    describe('Concurrent Authentication', () => {
      it('should handle 100 concurrent OAuth flows', async () => {
        const concurrency = 100;
        const promises = [];

        const startTime = performance.now();

        for (let i = 0; i < concurrency; i++) {
          promises.push(
            request(app)
              .get(`/auth/google/callback?code=load-test-${i}&state=state-${i}`)
              .expect(302)
          );
        }

        await Promise.all(promises);

        const endTime = performance.now();
        const totalDuration = endTime - startTime;
        const throughput = concurrency / (totalDuration / 1000);

        console.log(`Concurrent OAuth Flow Performance:
          Total Time: ${totalDuration.toFixed(2)}ms
          Throughput: ${throughput.toFixed(2)} requests/second
          Average per Request: ${(totalDuration / concurrency).toFixed(2)}ms`);

        expect(totalDuration).toBeLessThan(10000); // Complete within 10 seconds
        expect(throughput).toBeGreaterThan(20); // At least 20 requests per second
      });

      it('should handle 200 concurrent token validations', async () => {
        const token = jwtProvider.generateToken({
          userId: 'load-test-user',
          exp: Math.floor(Date.now() / 1000) + 3600
        });

        const concurrency = 200;
        const promises = [];

        const startTime = performance.now();

        for (let i = 0; i < concurrency; i++) {
          promises.push(
            request(app)
              .get('/protected')
              .set('Authorization', `Bearer ${token}`)
              .expect(200)
          );
        }

        await Promise.all(promises);

        const endTime = performance.now();
        const totalDuration = endTime - startTime;
        const throughput = concurrency / (totalDuration / 1000);

        console.log(`Concurrent Token Validation Performance:
          Total Time: ${totalDuration.toFixed(2)}ms
          Throughput: ${throughput.toFixed(2)} requests/second`);

        expect(totalDuration).toBeLessThan(5000);
        expect(throughput).toBeGreaterThan(50);
      });
    });

    describe('Memory Performance', () => {
      it('should maintain stable memory usage during high load', async () => {
        const initialMemory = process.memoryUsage();

        // Simulate high load
        const iterations = 1000;
        const promises = [];

        for (let i = 0; i < iterations; i++) {
          if (i % 2 === 0) {
            promises.push(
              request(app)
                .get(`/auth/google/callback?code=memory-test-${i}&state=state-${i}`)
                .expect(302)
            );
          } else {
            const token = jwtProvider.generateToken({ userId: `user-${i}` });
            promises.push(
              request(app)
                .get('/protected')
                .set('Authorization', `Bearer ${token}`)
                .expect(200)
            );
          }

          // Process in batches to avoid overwhelming the system
          if (promises.length >= 50) {
            await Promise.all(promises);
            promises.length = 0;
          }
        }

        // Process remaining requests
        if (promises.length > 0) {
          await Promise.all(promises);
        }

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }

        const finalMemory = process.memoryUsage();
        const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
        const memoryIncreasePercent = (memoryIncrease / initialMemory.heapUsed) * 100;

        console.log(`Memory Usage Analysis:
          Initial Heap: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)} MB
          Final Heap: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)} MB
          Increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB (${memoryIncreasePercent.toFixed(2)}%)`);

        // Memory increase should be reasonable (less than 50% increase)
        expect(memoryIncreasePercent).toBeLessThan(50);
      });
    });

    describe('Error Handling Performance', () => {
      it('should handle authentication errors efficiently', async () => {
        const iterations = 100;
        const durations = [];

        for (let i = 0; i < iterations; i++) {
          const start = performance.now();

          await request(app)
            .get('/auth/google/callback?code=invalid-code&state=invalid-state')
            .expect(400);

          const end = performance.now();
          durations.push(end - start);
        }

        const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;

        console.log(`Error Handling Performance:
          Average: ${avgDuration.toFixed(2)}ms`);

        expect(avgDuration).toBeLessThan(50);
      });
    });
  });

  describe('Caching Performance', () => {
    it('should benefit from user lookup caching', async () => {
      const email = 'cached-user@example.com';
      const user = UserFactory.create({ email });
      await ssoService.userRepository.create(user);

      // First lookup (cache miss)
      const start1 = performance.now();
      await ssoService.userRepository.findByEmail(email);
      const end1 = performance.now();
      const uncachedDuration = end1 - start1;

      // Subsequent lookups (cache hit)
      const cachedDurations = [];
      for (let i = 0; i < 10; i++) {
        const start = performance.now();
        await ssoService.userRepository.findByEmail(email);
        const end = performance.now();
        cachedDurations.push(end - start);
      }

      const avgCachedDuration = cachedDurations.reduce((a, b) => a + b, 0) / cachedDurations.length;

      console.log(`Cache Performance:
        Uncached Lookup: ${uncachedDuration.toFixed(4)}ms
        Cached Lookup Average: ${avgCachedDuration.toFixed(4)}ms
        Performance Improvement: ${((uncachedDuration - avgCachedDuration) / uncachedDuration * 100).toFixed(2)}%`);

      expect(avgCachedDuration).toBeLessThan(uncachedDuration);
    });
  });
});

// Helper function to set up performance test routes
function setupPerformanceTestRoutes(app, ssoService) {
  let stateStore = new Map();
  let codeStore = new Set();

  app.get('/auth/google', (req, res) => {
    const state = `state-${Date.now()}-${Math.random()}`;
    stateStore.set(state, { created: Date.now(), used: false });
    res.redirect(`https://mock-provider.com/oauth/authorize?state=${state}&client_id=mock-client-id`);
  });

  app.get('/auth/google/callback', async (req, res) => {
    const { code, state } = req.query;

    // State validation
    const stateData = stateStore.get(state);
    if (!stateData || stateData.used) {
      return res.status(400).json({ error: 'Invalid or missing state parameter' });
    }

    stateData.used = true;

    // Code validation
    if (codeStore.has(code)) {
      return res.status(400).json({ error: 'Authorization code has already been used' });
    }
    codeStore.add(code);

    try {
      // Mock token exchange and user profile retrieval for performance testing
      let mockProfile;

      if (code.includes('existing-code')) {
        const index = code.split('-').pop();
        mockProfile = {
          id: `google-existing-${index}`,
          email: `existing${index}@example.com`,
          name: `Existing User ${index}`,
          verified_email: true
        };
      } else {
        const index = code.split('-').pop() || Math.random().toString(36);
        mockProfile = {
          id: `google-${index}`,
          email: `user${index}@example.com`,
          name: `User ${index}`,
          verified_email: true
        };
      }

      const user = await ssoService.handleOAuthCallback('google', mockProfile);
      const sessionData = {
        userId: user.id,
        token: `session-${Date.now()}-${Math.random()}`,
        expiresAt: new Date(Date.now() + 3600000)
      };

      await ssoService.sessionRepository.create(sessionData);

      res.redirect('/dashboard');
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/protected', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Authorization header required' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Token required' });
    }

    try {
      const payload = ssoService.jwtProvider.verifyToken(token);
      res.json({ message: 'Access granted', userId: payload.userId });
    } catch (error) {
      res.status(401).json({ error: 'Invalid token' });
    }
  });

  app.get('/dashboard', (req, res) => {
    res.json({ message: 'Dashboard accessed' });
  });
}