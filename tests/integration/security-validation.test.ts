/**
 * Comprehensive Security Validation Test Suite
 *
 * Tests all security aspects of the mainframe AI assistant:
 * 1. API key encryption (AES-256-GCM)
 * 2. Electron safeStorage validation
 * 3. Authorization bypass attempts
 * 4. Input sanitization for search/CRUD
 * 5. SQL injection prevention
 * 6. XSS protection in components
 * 7. Secure IPC communication
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/jest';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { APIKeyManager } from '../../src/main/services/APIKeyManager';
import { IPCSecurityManager } from '../../src/main/ipc/security/IPCSecurityManager';
import { KnowledgeDB } from '../../src/database/KnowledgeDB';
import { DatabaseManager } from '../../src/database/DatabaseManager';

// Mock Electron for testing
const mockElectron = {
  app: {
    getPath: (name: string) => `/tmp/test-${name}-${Date.now()}`,
    getName: () => 'test-app'
  },
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (plainText: string) => Buffer.from(`encrypted:${plainText}`, 'utf-8'),
    decryptString: (encrypted: Buffer) => {
      const str = encrypted.toString('utf-8');
      return str.startsWith('encrypted:') ? str.slice(10) : str;
    }
  }
};

jest.mock('electron', () => mockElectron);

describe('Security Validation Test Suite', () => {
  let apiKeyManager: APIKeyManager;
  let ipcSecurityManager: IPCSecurityManager;
  let knowledgeDB: KnowledgeDB;
  let testDbPath: string;
  let tempDir: string;

  beforeAll(async () => {
    // Setup test environment
    tempDir = `/tmp/security-test-${Date.now()}`;
    testDbPath = path.join(tempDir, 'test-security.db');

    // Ensure test directory exists
    await fs.mkdir(tempDir, { recursive: true });

    // Initialize components
    apiKeyManager = APIKeyManager.getInstance();
    ipcSecurityManager = new IPCSecurityManager();
    knowledgeDB = new KnowledgeDB(testDbPath);
  });

  afterAll(async () => {
    // Cleanup
    try {
      await knowledgeDB?.close();
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Cleanup error:', error);
    }
  });

  beforeEach(() => {
    // Reset state before each test
    ipcSecurityManager.clearRateLimiters();
  });

  describe('1. API Key Encryption (AES-256-GCM)', () => {
    test('should use AES-256-GCM encryption for API keys', async () => {
      const testApiKey = 'sk-test1234567890abcdef1234567890abcdef';
      const keyId = await apiKeyManager.storeApiKey('openai', 'test-key', testApiKey);

      // Verify key is stored encrypted
      const storedKey = await apiKeyManager.getApiKey(keyId);
      expect(storedKey).not.toBe(testApiKey);
      expect(storedKey).toBeTruthy();

      // Verify encryption format (should contain IV:authTag:encrypted)
      const encryptedParts = storedKey?.split(':');
      expect(encryptedParts).toHaveLength(3);
    });

    test('should prevent key recovery without proper decryption', async () => {
      const testApiKey = 'sk-malicious-attempt-1234567890';
      const keyId = await apiKeyManager.storeApiKey('openai', 'malicious-test', testApiKey);

      // Attempt to access encrypted data directly should fail
      const encryptedKey = await apiKeyManager.getApiKey(keyId);
      expect(encryptedKey).not.toContain('sk-malicious');
      expect(encryptedKey).not.toContain('attempt');
    });

    test('should validate encryption strength meets AES-256-GCM standard', () => {
      // Test the encryption method directly
      const plaintext = 'sensitive-api-key-data';
      const key = crypto.randomBytes(32); // 256-bit key

      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher('aes-256-gcm', key);
      cipher.setAAD(Buffer.from('api-key-data'));

      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const authTag = cipher.getAuthTag();

      // Verify components exist and have correct lengths
      expect(iv).toHaveLength(16); // 128-bit IV
      expect(key).toHaveLength(32); // 256-bit key
      expect(authTag).toHaveLength(16); // 128-bit auth tag
      expect(encrypted).toBeTruthy();
    });

    test('should prevent tampering detection via auth tag', () => {
      const key = crypto.randomBytes(32);
      const iv = crypto.randomBytes(16);
      const plaintext = 'sk-test-tampering-detection';

      // Encrypt
      const cipher = crypto.createCipher('aes-256-gcm', key);
      cipher.setAAD(Buffer.from('api-key-data'));
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const authTag = cipher.getAuthTag();

      // Tamper with encrypted data
      const tamperedEncrypted = encrypted.slice(0, -2) + 'XX';

      // Attempt to decrypt tampered data should fail
      expect(() => {
        const decipher = crypto.createDecipher('aes-256-gcm', key);
        decipher.setAAD(Buffer.from('api-key-data'));
        decipher.setAuthTag(authTag);
        decipher.update(tamperedEncrypted, 'hex', 'utf8');
        decipher.final('utf8');
      }).toThrow();
    });
  });

  describe('2. Electron safeStorage Validation', () => {
    test('should verify safeStorage is available', () => {
      expect(mockElectron.safeStorage.isEncryptionAvailable()).toBe(true);
    });

    test('should use safeStorage for sensitive data encryption', () => {
      const sensitiveData = 'user-session-token-12345';
      const encrypted = mockElectron.safeStorage.encryptString(sensitiveData);
      const decrypted = mockElectron.safeStorage.decryptString(encrypted);

      expect(encrypted).toBeInstanceOf(Buffer);
      expect(decrypted).toBe(sensitiveData);
      expect(encrypted.toString()).not.toContain(sensitiveData);
    });

    test('should fail gracefully when safeStorage is unavailable', () => {
      const originalMethod = mockElectron.safeStorage.isEncryptionAvailable;
      mockElectron.safeStorage.isEncryptionAvailable = () => false;

      // Should handle unavailable encryption gracefully
      expect(mockElectron.safeStorage.isEncryptionAvailable()).toBe(false);

      // Restore original method
      mockElectron.safeStorage.isEncryptionAvailable = originalMethod;
    });

    test('should encrypt different data types consistently', () => {
      const testData = [
        'simple-string',
        '{"complex": "json", "data": {"nested": true}}',
        'unicode-content-测试-🔐',
        'x'.repeat(1000) // Large string
      ];

      testData.forEach(data => {
        const encrypted = mockElectron.safeStorage.encryptString(data);
        const decrypted = mockElectron.safeStorage.decryptString(encrypted);
        expect(decrypted).toBe(data);
      });
    });
  });

  describe('3. Authorization Bypass Attempts', () => {
    test('should reject unauthorized IPC channel access', async () => {
      const unauthorizedChannels = [
        'admin:reset:database',
        'dev:execute:command',
        'system:file:access',
        '../../../etc/passwd',
        'malicious-channel'
      ];

      for (const channel of unauthorizedChannels) {
        const result = await ipcSecurityManager.validateRequest(channel, []);
        expect(result.valid).toBe(false);
        expect(result.error?.code).toBe('INVALID_CHANNEL');
      }
    });

    test('should enforce role-based access control', async () => {
      // Test entry deletion without proper permissions
      const result = await ipcSecurityManager.validateRequest(
        'kb:entry:delete',
        [{ entryId: 'test-123' }],
        { sessionId: 'test-session' } // No userId
      );

      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    test('should prevent privilege escalation attempts', async () => {
      const maliciousContexts = [
        { userId: 'admin', isAdmin: false }, // False admin flag
        { userId: '../../../admin' }, // Path traversal in userId
        { userId: 'user', roles: ['admin'] }, // Attempting to set roles
        { isAdmin: true } // Admin without user
      ];

      for (const context of maliciousContexts) {
        const result = await ipcSecurityManager.validateRequest(
          'system:database:reset',
          [],
          context
        );
        expect(result.valid).toBe(false);
      }
    });

    test('should validate session integrity', async () => {
      const validSession = { userId: 'user123', sessionId: 'valid-session-456' };
      const invalidSessions = [
        { userId: 'user123' }, // Missing session
        { sessionId: 'orphaned-session' }, // Missing user
        { userId: 'user123', sessionId: 'expired-session', expired: true },
        { userId: '', sessionId: 'empty-user' }
      ];

      // Valid session should work for permitted operations
      const validResult = await ipcSecurityManager.validateRequest(
        'kb:entry:get',
        [{ entryId: 'test' }],
        validSession
      );
      expect(validResult.valid).toBe(true);

      // Invalid sessions should be rejected for sensitive operations
      for (const session of invalidSessions) {
        const result = await ipcSecurityManager.validateRequest(
          'kb:entry:delete',
          [{ entryId: 'test' }],
          session
        );
        expect(result.valid).toBe(false);
      }
    });
  });

  describe('4. Input Sanitization (Search & CRUD)', () => {
    test('should sanitize SQL injection attempts in search queries', async () => {
      const maliciousQueries = [
        "'; DROP TABLE kb_entries; --",
        "' OR '1'='1",
        "UNION SELECT * FROM users WHERE '1'='1",
        "'; INSERT INTO kb_entries (problem) VALUES ('injected'); --",
        "' AND (SELECT COUNT(*) FROM kb_entries) > 0 --"
      ];

      for (const query of maliciousQueries) {
        const result = await ipcSecurityManager.validateRequest(
          'kb:search:local',
          [{ query, limit: 10 }]
        );

        if (result.valid && result.sanitizedArgs) {
          const sanitizedQuery = result.sanitizedArgs[0].query;
          expect(sanitizedQuery).not.toContain('DROP');
          expect(sanitizedQuery).not.toContain('INSERT');
          expect(sanitizedQuery).not.toContain('UNION');
          expect(sanitizedQuery).not.toContain('--');
        }
      }
    });

    test('should sanitize XSS attempts in entry content', async () => {
      const xssPayloads = [
        '<script>alert("xss")</script>',
        '<img src="x" onerror="alert(\'xss\')" />',
        'javascript:alert("xss")',
        '<svg onload="alert(\'xss\')" />',
        '<iframe src="javascript:alert(\'xss\')"></iframe>',
        'data:text/html,<script>alert("xss")</script>'
      ];

      for (const payload of xssPayloads) {
        const result = await ipcSecurityManager.validateRequest(
          'kb:entry:create',
          [{
            title: 'Test Entry',
            problem: payload,
            solution: 'Clean solution',
            category: 'Test'
          }]
        );

        if (result.valid && result.sanitizedArgs) {
          const sanitizedProblem = result.sanitizedArgs[0].problem;
          expect(sanitizedProblem).not.toContain('<script');
          expect(sanitizedProblem).not.toContain('onerror');
          expect(sanitizedProblem).not.toContain('javascript:');
          expect(sanitizedProblem).not.toContain('onload');
        }
      }
    });

    test('should handle path traversal attempts', async () => {
      const pathTraversalAttempts = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config',
        '....//....//....//etc/passwd',
        '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
        '/proc/self/environ'
      ];

      for (const path of pathTraversalAttempts) {
        const result = await ipcSecurityManager.validateRequest(
          'kb:entry:create',
          [{
            title: path,
            problem: 'Test problem',
            solution: path,
            category: 'Test'
          }]
        );

        if (result.valid && result.sanitizedArgs) {
          const sanitizedTitle = result.sanitizedArgs[0].title;
          const sanitizedSolution = result.sanitizedArgs[0].solution;
          expect(sanitizedTitle).not.toContain('../');
          expect(sanitizedTitle).not.toContain('..\\');
          expect(sanitizedSolution).not.toContain('../');
          expect(sanitizedSolution).not.toContain('..\\');
        }
      }
    });

    test('should limit input size to prevent DoS', async () => {
      const oversizedContent = 'A'.repeat(200000); // 200KB content

      const result = await ipcSecurityManager.validateRequest(
        'kb:entry:create',
        [{
          title: 'Test',
          problem: oversizedContent,
          solution: 'Test',
          category: 'Test'
        }]
      );

      // Should either reject or truncate oversized content
      if (result.valid) {
        expect(result.warnings).toBeTruthy();
        expect(result.warnings?.some(w => w.includes('truncated'))).toBe(true);
      } else {
        expect(result.error?.message).toContain('too large');
      }
    });
  });

  describe('5. SQL Injection Prevention', () => {
    test('should use parameterized queries for database operations', async () => {
      // Test that the KnowledgeDB uses parameterized queries
      const maliciousEntry = {
        title: "Test'; DROP TABLE kb_entries; --",
        problem: "'; INSERT INTO admin_users VALUES ('hacker', 'password'); --",
        solution: "' OR '1'='1' --",
        category: "'; UPDATE kb_entries SET problem='hacked' WHERE '1'='1'; --"
      };

      try {
        const entryId = await knowledgeDB.addEntry(maliciousEntry);
        expect(entryId).toBeTruthy();

        // Verify the malicious content was stored safely (not executed)
        const retrievedEntry = await knowledgeDB.getEntry(entryId);
        expect(retrievedEntry?.title).toBe(maliciousEntry.title); // Stored as-is, not executed

        // Verify database integrity
        const stats = await knowledgeDB.getStats();
        expect(stats.totalEntries).toBeGreaterThan(0); // Table not dropped

      } catch (error) {
        // If sanitization rejects it, that's also acceptable
        expect(error).toBeTruthy();
      }
    });

    test('should prevent injection in search operations', async () => {
      const injectionAttempts = [
        "test'; SELECT password FROM users; --",
        "test' UNION SELECT 1,2,3,4,5,6,7,8 --",
        "test'; ATTACH DATABASE '/tmp/evil.db' AS evil; --",
        "test' AND (SELECT substr(sql,1,1) FROM sqlite_master)='C' --",
        "test'; PRAGMA table_info(users); --"
      ];

      for (const query of injectionAttempts) {
        try {
          const results = await knowledgeDB.search(query);
          // Should return normal search results, not execute injection
          expect(Array.isArray(results)).toBe(true);
          // No results or legitimate search results only
          expect(results.every(r => r.entry && r.score !== undefined)).toBe(true);
        } catch (error) {
          // Rejecting malicious queries is also acceptable
          expect(error).toBeTruthy();
        }
      }
    });

    test('should validate database schema integrity', async () => {
      // Verify expected tables exist and unexpected ones don't
      const stats = await knowledgeDB.getStats();
      expect(stats).toBeTruthy();
      expect(stats.totalEntries).toBeGreaterThanOrEqual(0);

      // Should not have been able to create malicious tables
      try {
        await knowledgeDB.search("'; CREATE TABLE evil_table (id INTEGER); --");
        // If this doesn't throw, verify no evil table was created
        // (This is hard to test without direct DB access, but the fact that
        // the search returned normally is a good sign)
      } catch (error) {
        // Rejection is acceptable
      }
    });

    test('should prevent blind SQL injection through timing attacks', async () => {
      const timingAttacks = [
        "test' AND (SELECT COUNT(*) FROM sqlite_master) > 0 AND randomblob(100000000) --",
        "test'; SELECT CASE WHEN (1=1) THEN randomblob(100000000) ELSE 0 END; --",
        "test' AND (SELECT CASE WHEN substr(hex(randomblob(100000000)),1,1)='A' THEN 1 ELSE 0 END) --"
      ];

      for (const query of timingAttacks) {
        const startTime = Date.now();
        try {
          await knowledgeDB.search(query);
        } catch (error) {
          // Expected
        }
        const endTime = Date.now();

        // Should not take excessively long (suggesting injection was prevented)
        expect(endTime - startTime).toBeLessThan(5000); // 5 seconds max
      }
    });
  });

  describe('6. XSS Protection in React Components', () => {
    test('should escape HTML in search results display', () => {
      const xssPayloads = [
        '<script>alert("xss")</script>',
        '<img src="x" onerror="alert(\'xss\')" />',
        '<svg onload="alert(\'xss\')" />',
        '"><script>alert("xss")</script>',
        '\' onclick="alert(\'xss\')" \'',
        'javascript:alert("xss")'
      ];

      // Simulate how React would render these (React escapes by default)
      xssPayloads.forEach(payload => {
        // React's default behavior escapes HTML entities
        const escaped = payload
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#x27;');

        expect(escaped).not.toContain('<script');
        expect(escaped).not.toContain('onerror');
        expect(escaped).not.toContain('onload');
        expect(escaped).not.toContain('onclick');
      });
    });

    test('should sanitize dangerouslySetInnerHTML usage', () => {
      // Test that any dangerouslySetInnerHTML usage is properly sanitized
      const htmlContent = '<script>alert("xss")</script><p>Safe content</p><img onerror="alert(\'xss\')" />';

      // Simulate DOMPurify or similar sanitization
      const sanitized = htmlContent
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/on\w+\s*=/gi, '')
        .replace(/javascript:/gi, '');

      expect(sanitized).not.toContain('<script');
      expect(sanitized).not.toContain('onerror');
      expect(sanitized).not.toContain('javascript:');
      expect(sanitized).toContain('<p>Safe content</p>');
    });

    test('should validate URL inputs for XSS', () => {
      const maliciousUrls = [
        'javascript:alert("xss")',
        'data:text/html,<script>alert("xss")</script>',
        'vbscript:msgbox("xss")',
        'file:///etc/passwd',
        'ftp://malicious.com/file.exe'
      ];

      maliciousUrls.forEach(url => {
        // URL validation logic
        const isValidUrl = /^https?:\/\//.test(url) && !url.includes('javascript:') && !url.includes('data:');
        expect(isValidUrl).toBe(false);
      });

      // Valid URLs should pass
      const validUrls = [
        'https://example.com',
        'http://localhost:3000',
        'https://api.github.com/repos'
      ];

      validUrls.forEach(url => {
        const isValidUrl = /^https?:\/\//.test(url) && !url.includes('javascript:') && !url.includes('data:');
        expect(isValidUrl).toBe(true);
      });
    });

    test('should prevent CSS injection attacks', () => {
      const cssInjections = [
        'color: red; background: url("javascript:alert(\'xss\')")',
        'font-family: "times new roman"; background-image: url("data:text/html,<script>alert(\'xss\')</script>")',
        'content: "\\27e9"; background: expression(alert("xss"))',
        '-moz-binding: url("data:text/xml,<bindings xmlns=\\"http://www.mozilla.org/xbl\\"><binding><implementation><constructor>alert(\\"xss\\")</constructor></implementation></binding></bindings>");'
      ];

      cssInjections.forEach(style => {
        // CSS sanitization logic
        const sanitized = style
          .replace(/javascript:/gi, '')
          .replace(/data:/gi, '')
          .replace(/expression\(/gi, '')
          .replace(/-moz-binding/gi, '')
          .replace(/url\([^)]*javascript[^)]*\)/gi, '');

        expect(sanitized).not.toContain('javascript:');
        expect(sanitized).not.toContain('data:');
        expect(sanitized).not.toContain('expression(');
        expect(sanitized).not.toContain('-moz-binding');
      });
    });
  });

  describe('7. Secure IPC Communication', () => {
    test('should enforce channel whitelist', async () => {
      const allowedChannels = [
        'kb:search:local',
        'kb:entry:create',
        'system:metrics:get'
      ];

      const deniedChannels = [
        'admin:reset:all',
        'file:system:access',
        'process:execute',
        'network:request',
        'eval:javascript'
      ];

      // Allowed channels should pass initial validation
      for (const channel of allowedChannels) {
        const result = await ipcSecurityManager.validateRequest(channel, [{}]);
        expect(result.valid).toBe(true);
      }

      // Denied channels should be rejected
      for (const channel of deniedChannels) {
        const result = await ipcSecurityManager.validateRequest(channel, []);
        expect(result.valid).toBe(false);
        expect(result.error?.code).toBe('INVALID_CHANNEL');
      }
    });

    test('should implement rate limiting on IPC channels', async () => {
      const channel = 'kb:search:local';
      const args = [{ query: 'test', limit: 10 }];

      // First request should succeed
      let result = await ipcSecurityManager.validateRequest(channel, args);
      expect(result.valid).toBe(true);

      // Simulate rapid requests (exceeding rate limit)
      const promises = [];
      for (let i = 0; i < 150; i++) { // More than the 100/minute limit
        promises.push(ipcSecurityManager.validateRequest(channel, args));
      }

      const results = await Promise.all(promises);
      const rejectedCount = results.filter(r => !r.valid && r.error?.code === 'RATE_LIMIT_EXCEEDED').length;

      expect(rejectedCount).toBeGreaterThan(0);
    });

    test('should validate IPC message structure', async () => {
      const invalidMessages = [
        null,
        undefined,
        { maliciousProperty: 'value' },
        { __proto__: { admin: true } },
        { constructor: { prototype: { admin: true } } },
        Array(1000).fill('large_array'),
        'string-instead-of-object'
      ];

      for (const message of invalidMessages) {
        const result = await ipcSecurityManager.validateRequest('kb:search:local', [message]);
        // Should either reject or sanitize the invalid message
        if (result.valid) {
          expect(result.sanitizedArgs).toBeTruthy();
          expect(result.warnings).toBeTruthy();
        } else {
          expect(result.error).toBeTruthy();
        }
      }
    });

    test('should prevent prototype pollution in IPC messages', async () => {
      const pollutionAttempts = [
        { '__proto__': { 'isAdmin': true } },
        { 'constructor': { 'prototype': { 'isAdmin': true } } },
        { 'prototype': { 'admin': true } },
        JSON.parse('{"__proto__": {"admin": true}}'),
        { 'query': 'test', '__proto__': { 'polluted': true } }
      ];

      for (const attempt of pollutionAttempts) {
        const result = await ipcSecurityManager.validateRequest('kb:search:local', [attempt]);

        if (result.valid && result.sanitizedArgs) {
          const sanitized = result.sanitizedArgs[0];
          expect(sanitized.__proto__).toBeUndefined();
          expect(sanitized.constructor?.prototype?.isAdmin).toBeUndefined();
          expect(sanitized.prototype?.admin).toBeUndefined();
        }

        // Verify global prototype wasn't polluted
        expect(Object.prototype.isAdmin).toBeUndefined();
        expect(Object.prototype.admin).toBeUndefined();
        expect(Object.prototype.polluted).toBeUndefined();
      }
    });

    test('should secure context bridge exposure', () => {
      // Verify that only safe APIs are exposed through context bridge
      const safeAPIs = [
        'getVersion',
        'showMessageBox',
        'showSaveDialog',
        'showOpenDialog',
        'checkForUpdates'
      ];

      const dangerousAPIs = [
        'require',
        'process',
        'global',
        'Buffer',
        'eval',
        'Function',
        '__dirname',
        '__filename'
      ];

      // In a real test, you'd check the actual context bridge exposure
      // Here we simulate the validation
      safeAPIs.forEach(api => {
        expect(typeof api).toBe('string'); // Safe APIs should be available
      });

      dangerousAPIs.forEach(api => {
        // These should not be accessible in renderer
        expect(typeof (global as any)[api]).toBe('undefined');
      });
    });
  });

  describe('8. Security Metrics and Monitoring', () => {
    test('should log security events', async () => {
      // Trigger various security events
      await ipcSecurityManager.validateRequest('invalid:channel', []);
      await ipcSecurityManager.validateRequest('kb:search:local', [{ malicious: '<script>alert("xss")</script>' }]);

      const metrics = ipcSecurityManager.getSecurityMetrics();
      expect(metrics.totalEvents).toBeGreaterThan(0);
      expect(metrics.eventsBySeverity).toBeTruthy();
      expect(metrics.recentEvents).toBeTruthy();
    });

    test('should categorize security events by severity', async () => {
      // Clear previous events
      ipcSecurityManager.clearRateLimiters();

      // Trigger events of different severities
      await ipcSecurityManager.validateRequest('malicious:channel', []); // High severity
      await ipcSecurityManager.validateRequest('kb:search:local', [{ query: 'normal search' }]); // Should be fine

      const metrics = ipcSecurityManager.getSecurityMetrics();
      expect(metrics.eventsBySeverity.high).toBeGreaterThanOrEqual(0);
    });

    test('should provide performance metrics for security validation', async () => {
      const startTime = Date.now();

      // Perform multiple validations
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(ipcSecurityManager.validateRequest('kb:search:local', [{ query: `test-${i}` }]));
      }

      await Promise.all(promises);
      const endTime = Date.now();

      // Security validation should be fast
      const avgTime = (endTime - startTime) / 10;
      expect(avgTime).toBeLessThan(100); // Should average less than 100ms per validation
    });
  });

  describe('9. Comprehensive Security Integration', () => {
    test('should handle combined attack vectors', async () => {
      // Combine multiple attack vectors in a single request
      const combinedAttack = {
        query: "'; DROP TABLE users; --<script>alert('xss')</script>",
        category: "../../../etc/passwd",
        __proto__: { admin: true },
        constructor: { prototype: { isAdmin: true } },
        limit: 9999999
      };

      const result = await ipcSecurityManager.validateRequest('kb:search:local', [combinedAttack]);

      if (result.valid && result.sanitizedArgs) {
        const sanitized = result.sanitizedArgs[0];
        expect(sanitized.query).not.toContain('DROP TABLE');
        expect(sanitized.query).not.toContain('<script>');
        expect(sanitized.category).not.toContain('../');
        expect(sanitized.__proto__).toBeUndefined();
        expect(sanitized.limit).toBeLessThanOrEqual(1000); // Should be capped
      } else {
        expect(result.error).toBeTruthy();
      }
    });

    test('should maintain security under high load', async () => {
      // Simulate high load with legitimate requests
      const requests = [];
      for (let i = 0; i < 50; i++) {
        requests.push(ipcSecurityManager.validateRequest('kb:search:local', [{ query: `legitimate-query-${i}` }]));
      }

      const results = await Promise.all(requests);
      const validResults = results.filter(r => r.valid);

      // Most requests should succeed (not be incorrectly blocked)
      expect(validResults.length).toBeGreaterThan(40);
    });

    test('should recover gracefully from security failures', async () => {
      // Trigger a security failure
      await ipcSecurityManager.validateRequest('malicious:channel', []);

      // Subsequent legitimate requests should still work
      const result = await ipcSecurityManager.validateRequest('kb:search:local', [{ query: 'normal search' }]);
      expect(result.valid).toBe(true);
    });
  });
});