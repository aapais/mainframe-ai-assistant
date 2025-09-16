/**
 * IPC Security Tests
 * 
 * Comprehensive security testing for IPC implementation including
 * validation, sanitization, authorization, and attack prevention.
 */

import { IPCSecurityManager } from '../../../src/main/ipc/security/IPCSecurityManager';
import { IPCHandlerRegistry } from '../../../src/main/ipc/IPCHandlerRegistry';
import { KnowledgeBaseHandler } from '../../../src/main/ipc/handlers/KnowledgeBaseHandler';

import {
  validSearchRequest,
  validCreateRequest,
  securityTestData,
  testErrors
} from '../../fixtures/ipc-test-data';

import {
  MockKnowledgeDB,
  MockCacheManager,
  assertSecurityValidation,
  IPCTestEnvironment
} from '../../helpers/ipc-test-utils';

import {
  IPCErrorCode,
  BaseIPCRequest,
  KBEntryCreateRequest
} from '../../../src/types/ipc';

describe('IPCSecurityManager', () => {
  let securityManager: IPCSecurityManager;
  let testEnv: IPCTestEnvironment;

  beforeEach(() => {
    securityManager = new IPCSecurityManager({
      enableRateLimit: true,
      enableInputValidation: true,
      enableSanitization: true,
      maxRequestSize: 1024 * 1024, // 1MB
      rateLimitWindow: 60000, // 1 minute
      rateLimitMax: 100 // 100 requests per minute
    });
    testEnv = new IPCTestEnvironment();
  });

  afterEach(() => {
    testEnv.reset();
  });

  describe('Input Validation', () => {
    it('should validate required request fields', async () => {
      const invalidRequest = {
        // Missing required fields
        channel: 'kb:search'
      } as BaseIPCRequest;

      const result = await securityManager.validateRequest(invalidRequest);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('requestId is required');
      expect(result.errors).toContain('timestamp is required');
    });

    it('should validate request ID format', async () => {
      const invalidRequest = {
        ...validSearchRequest,
        requestId: null as any
      };

      const result = await securityManager.validateRequest(invalidRequest);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid requestId format');
    });

    it('should validate timestamp ranges', async () => {
      const futureRequest = {
        ...validSearchRequest,
        timestamp: Date.now() + 1000 * 60 * 60 * 24 // 24 hours in future
      };

      const result = await securityManager.validateRequest(futureRequest);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Timestamp is too far in the future');
    });

    it('should validate API version compatibility', async () => {
      const incompatibleRequest = {
        ...validSearchRequest,
        version: '0.1.0' // Old version
      };

      const result = await securityManager.validateRequest(incompatibleRequest);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Incompatible API version');
    });

    it('should validate channel existence', async () => {
      const invalidChannelRequest = {
        ...validSearchRequest,
        channel: 'non:existent:channel'
      };

      const result = await securityManager.validateRequest(invalidChannelRequest);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid channel');
    });

    it('should enforce request size limits', async () => {
      const oversizedRequest = {
        ...validCreateRequest,
        entry: {
          ...validCreateRequest.entry,
          problem: 'P'.repeat(2 * 1024 * 1024) // 2MB string
        }
      };

      const result = await securityManager.validateRequest(oversizedRequest);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Request size exceeds limit');
    });
  });

  describe('Input Sanitization', () => {
    it('should sanitize HTML/script tags', async () => {
      const maliciousRequest = {
        ...validCreateRequest,
        entry: {
          ...validCreateRequest.entry,
          title: '<script>alert("xss")</script>Test Title',
          problem: '<img src="x" onerror="alert(\'xss\')" />Problem description'
        }
      };

      const sanitized = await securityManager.sanitizeRequest(maliciousRequest);
      
      expect(sanitized.entry.title).not.toContain('<script>');
      expect(sanitized.entry.title).toContain('Test Title');
      expect(sanitized.entry.problem).not.toContain('<img');
      expect(sanitized.entry.problem).toContain('Problem description');
    });

    it('should prevent SQL injection attempts', async () => {
      const sqlInjectionRequest = {
        ...validSearchRequest,
        query: "'; DROP TABLE kb_entries; --"
      };

      const sanitized = await securityManager.sanitizeRequest(sqlInjectionRequest);
      
      expect(sanitized.query).not.toContain('DROP TABLE');
      expect(sanitized.query).not.toContain('--');
    });

    it('should normalize unicode and special characters', async () => {
      const unicodeRequest = {
        ...validCreateRequest,
        entry: {
          ...validCreateRequest.entry,
          title: '测试 título éñ 🔥',
          tags: ['unicode-test', 'special-chars']
        }
      };

      const sanitized = await securityManager.sanitizeRequest(unicodeRequest);
      
      expect(sanitized.entry.title).toBeDefined();
      expect(sanitized.entry.title.length).toBeGreaterThan(0);
    });

    it('should preserve safe content during sanitization', async () => {
      const safeRequest = {
        ...validCreateRequest,
        entry: {
          ...validCreateRequest.entry,
          title: 'Safe Title with Numbers 123',
          problem: 'Normal problem description with punctuation!',
          solution: '1. Step one\n2. Step two\n3. Step three'
        }
      };

      const sanitized = await securityManager.sanitizeRequest(safeRequest);
      
      expect(sanitized.entry.title).toBe(safeRequest.entry.title);
      expect(sanitized.entry.problem).toBe(safeRequest.entry.problem);
      expect(sanitized.entry.solution).toBe(safeRequest.entry.solution);
    });
  });

  describe('Rate Limiting', () => {
    it('should allow requests within rate limit', async () => {
      const userId = 'test-user-123';
      
      // Send multiple requests within limit
      for (let i = 0; i < 10; i++) {
        const result = await securityManager.checkRateLimit(userId, 'kb:search');
        expect(result.allowed).toBe(true);
      }
    });

    it('should block requests exceeding rate limit', async () => {
      const userId = 'test-user-456';
      
      // Exhaust rate limit
      for (let i = 0; i < 101; i++) {
        await securityManager.checkRateLimit(userId, 'kb:search');
      }
      
      // Next request should be blocked
      const result = await securityManager.checkRateLimit(userId, 'kb:search');
      
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.resetTime).toBeGreaterThan(Date.now());
    });

    it('should reset rate limit after window expires', async () => {
      const userId = 'test-user-789';
      
      // Mock time manipulation for faster testing
      const originalNow = Date.now;
      let mockTime = Date.now();
      
      Date.now = jest.fn(() => mockTime);
      
      try {
        // Exhaust rate limit
        for (let i = 0; i < 101; i++) {
          await securityManager.checkRateLimit(userId, 'kb:search');
        }
        
        // Should be blocked
        let result = await securityManager.checkRateLimit(userId, 'kb:search');
        expect(result.allowed).toBe(false);
        
        // Advance time past window
        mockTime += 61000; // 61 seconds
        
        // Should be allowed again
        result = await securityManager.checkRateLimit(userId, 'kb:search');
        expect(result.allowed).toBe(true);
        
      } finally {
        Date.now = originalNow;
      }
    });

    it('should apply different limits per channel', async () => {
      const userId = 'test-user-channel';
      
      // Different channels should have separate limits
      const searchResult = await securityManager.checkRateLimit(userId, 'kb:search');
      const createResult = await securityManager.checkRateLimit(userId, 'kb:create');
      
      expect(searchResult.allowed).toBe(true);
      expect(createResult.allowed).toBe(true);
      expect(searchResult.remaining).not.toBe(createResult.remaining);
    });
  });

  describe('Authorization', () => {
    it('should validate user permissions for operations', async () => {
      const adminUser = 'admin-user';
      const regularUser = 'regular-user';
      
      const adminPermissions = await securityManager.checkPermissions(adminUser, 'kb:delete');
      const userPermissions = await securityManager.checkPermissions(regularUser, 'kb:delete');
      
      expect(adminPermissions.allowed).toBe(true);
      expect(userPermissions.allowed).toBe(false);
    });

    it('should handle missing user context', async () => {
      const request = {
        ...validSearchRequest,
        userId: undefined
      };

      const permissions = await securityManager.checkPermissions(undefined, 'kb:search');
      
      // Public operations should be allowed
      if (request.channel === 'kb:search') {
        expect(permissions.allowed).toBe(true);
      } else {
        expect(permissions.allowed).toBe(false);
      }
    });

    it('should validate user session tokens', async () => {
      const validToken = 'valid-session-token-123';
      const invalidToken = 'invalid-token';
      
      const validSession = await securityManager.validateSession(validToken);
      const invalidSession = await securityManager.validateSession(invalidToken);
      
      expect(validSession.valid).toBe(true);
      expect(invalidSession.valid).toBe(false);
    });
  });

  describe('Attack Prevention', () => {
    it('should detect and prevent DoS attempts', async () => {
      const attackerIP = '192.168.1.100';
      
      // Simulate rapid requests from same IP
      const requests = Array.from({ length: 1000 }, () => 
        securityManager.checkRateLimit(attackerIP, 'kb:search')
      );
      
      const results = await Promise.all(requests);
      const blockedRequests = results.filter(r => !r.allowed);
      
      expect(blockedRequests.length).toBeGreaterThan(0);
    });

    it('should detect suspicious request patterns', async () => {
      const suspiciousRequests = [
        { ...validSearchRequest, query: securityTestData.sqlInjectionAttempts[0] },
        { ...validSearchRequest, query: securityTestData.sqlInjectionAttempts[1] },
        { ...validSearchRequest, query: securityTestData.sqlInjectionAttempts[2] }
      ];

      for (const request of suspiciousRequests) {
        const threat = await securityManager.analyzeThreat(request);
        expect(threat.riskLevel).toBeGreaterThan(0.5);
        expect(threat.patterns).toContain('SQL_INJECTION');
      }
    });

    it('should implement CSRF protection', async () => {
      const requestWithoutCSRF = {
        ...validCreateRequest,
        // Missing CSRF token
      };

      const csrfCheck = await securityManager.validateCSRF(requestWithoutCSRF);
      
      expect(csrfCheck.valid).toBe(false);
      expect(csrfCheck.error).toBe('Missing CSRF token');
    });

    it('should validate request origin', async () => {
      const suspiciousOrigin = 'http://malicious-site.com';
      const validOrigin = 'http://localhost:3000';
      
      const suspiciousResult = await securityManager.validateOrigin(suspiciousOrigin);
      const validResult = await securityManager.validateOrigin(validOrigin);
      
      expect(suspiciousResult.valid).toBe(false);
      expect(validResult.valid).toBe(true);
    });

    it('should log security events for monitoring', async () => {
      const logSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const maliciousRequest = {
        ...validSearchRequest,
        query: securityTestData.sqlInjectionAttempts[0]
      };

      await securityManager.validateRequest(maliciousRequest);
      
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Security violation detected')
      );
      
      logSpy.mockRestore();
    });
  });

  describe('Error Handling', () => {
    it('should provide secure error messages', async () => {
      const invalidRequest = {
        ...validSearchRequest,
        query: securityTestData.sqlInjectionAttempts[0]
      };

      const result = await securityManager.validateRequest(invalidRequest);
      
      expect(result.isValid).toBe(false);
      // Error message should not expose internal details
      expect(result.errors[0]).not.toContain('SQL');
      expect(result.errors[0]).not.toContain('injection');
      expect(result.errors[0]).toContain('Invalid input');
    });

    it('should handle security manager failures gracefully', async () => {
      // Simulate internal error in security manager
      const failingSecurityManager = new IPCSecurityManager({
        enableRateLimit: true,
        enableInputValidation: true
      });

      // Mock a method to throw an error
      jest.spyOn(failingSecurityManager, 'validateRequest')
        .mockRejectedValue(new Error('Security system failure'));

      try {
        await failingSecurityManager.validateRequest(validSearchRequest);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        // Should not expose internal error details
        expect(error.message).toBe('Security validation failed');
      }
    });
  });

  describe('Integration with Handlers', () => {
    it('should integrate security checks with knowledge base operations', async () => {
      const mockDB = new MockKnowledgeDB();
      const mockCache = new MockCacheManager();
      const handler = new KnowledgeBaseHandler(mockDB as any, mockCache as any);

      // Wrap handler with security checks
      const secureHandler = securityManager.secureHandler(handler);

      const maliciousRequest = {
        ...validCreateRequest,
        entry: {
          ...validCreateRequest.entry,
          title: '<script>alert("xss")</script>'
        }
      };

      const response = await secureHandler.createEntry(maliciousRequest);
      
      assertSecurityValidation(response, true);
    });

    it('should maintain performance with security checks enabled', async () => {
      const startTime = performance.now();
      
      // Run multiple security validations
      for (let i = 0; i < 100; i++) {
        await securityManager.validateRequest({
          ...validSearchRequest,
          requestId: `perf-test-${i}`
        });
      }
      
      const endTime = performance.now();
      const avgTime = (endTime - startTime) / 100;
      
      // Security validation should be fast (< 10ms per request)
      expect(avgTime).toBeLessThan(10);
    });
  });

  describe('Configuration and Customization', () => {
    it('should support configurable security policies', async () => {
      const strictSecurityManager = new IPCSecurityManager({
        enableRateLimit: true,
        enableInputValidation: true,
        enableSanitization: true,
        maxRequestSize: 1024, // Very small limit
        rateLimitMax: 10, // Very restrictive
        strictMode: true
      });

      const largeRequest = {
        ...validCreateRequest,
        entry: {
          ...validCreateRequest.entry,
          problem: 'P'.repeat(2000) // 2KB
        }
      };

      const result = await strictSecurityManager.validateRequest(largeRequest);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Request size exceeds limit');
    });

    it('should support custom validation rules', async () => {
      securityManager.addCustomValidator('custom-business-rule', (request) => {
        if (request.entry && request.entry.title.includes('forbidden')) {
          return {
            isValid: false,
            errors: ['Title contains forbidden content']
          };
        }
        return { isValid: true, errors: [] };
      });

      const forbiddenRequest = {
        ...validCreateRequest,
        entry: {
          ...validCreateRequest.entry,
          title: 'This contains forbidden content'
        }
      };

      const result = await securityManager.validateRequest(forbiddenRequest);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Title contains forbidden content');
    });
  });
});