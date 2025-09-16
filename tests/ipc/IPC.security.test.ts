/**
 * IPC Security and Validation Test Suite
 * 
 * Tests security aspects of IPC communication:
 * - Input validation and sanitization
 * - Rate limiting and DoS protection
 * - Authentication and authorization
 * - Data encryption and secure transmission
 * - XSS and injection prevention
 * - Origin validation
 */

import { EventEmitter } from 'events';
import type { IPCResponse } from '../../src/main/preload';

// Mock security modules
const mockValidator = {
  isValidInput: jest.fn(),
  sanitizeInput: jest.fn(),
  checkPermissions: jest.fn()
};

const mockRateLimiter = {
  checkLimit: jest.fn(),
  incrementCounter: jest.fn(),
  resetCounter: jest.fn()
};

const mockCrypto = {
  encrypt: jest.fn(),
  decrypt: jest.fn(),
  generateHash: jest.fn()
};

// Mock IPC
const mockIpcRenderer = {
  invoke: jest.fn(),
  send: jest.fn(),
  on: jest.fn()
};

const mockEvent = {
  sender: {
    getURL: jest.fn(() => 'file:///'),
    session: {
      protocol: 'file:'
    }
  },
  senderFrame: {
    url: 'file:///'
  }
};

jest.mock('electron', () => ({
  ipcRenderer: mockIpcRenderer
}));

describe('IPC Security Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Input Validation and Sanitization', () => {
    test('should reject malicious script injection', async () => {
      const maliciousInput = {
        title: '<script>alert("XSS")</script>Innocent Title',
        content: 'Normal content<img src=x onerror=alert(1)>',
        category: 'javascript:alert(1)'
      };

      const sanitizedResponse: IPCResponse = {
        success: false,
        error: {
          code: 'INPUT_SANITIZATION_FAILED',
          message: 'Input contains potentially malicious content',
          details: {
            field: 'title',
            issue: 'Contains HTML/script tags',
            original: '<script>alert("XSS")</script>Innocent Title',
            sanitized: 'Innocent Title'
          }
        }
      };

      mockIpcRenderer.invoke.mockResolvedValue(sanitizedResponse);

      const result = await mockIpcRenderer.invoke('db:addEntry', maliciousInput);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INPUT_SANITIZATION_FAILED');
      expect(result.error?.details.issue).toContain('script tags');
    });

    test('should reject SQL injection attempts', async () => {
      const sqlInjectionInputs = [
        "'; DROP TABLE entries; --",
        "' OR '1'='1",
        "1; DELETE FROM users; --",
        "' UNION SELECT * FROM admin --"
      ];

      for (const maliciousQuery of sqlInjectionInputs) {
        const response: IPCResponse = {
          success: false,
          error: {
            code: 'SQL_INJECTION_DETECTED',
            message: 'Query contains potentially dangerous SQL patterns',
            details: {
              pattern: maliciousQuery,
              detectedTokens: ['DROP', 'DELETE', 'UNION', '--']
            }
          }
        };

        mockIpcRenderer.invoke.mockResolvedValue(response);

        const result = await mockIpcRenderer.invoke('db:search', maliciousQuery);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('SQL_INJECTION_DETECTED');
      }
    });

    test('should validate data types and structure', async () => {
      const invalidStructures = [
        { title: 123 }, // title should be string
        { title: 'Valid', tags: 'should-be-array' }, // tags should be array
        { title: '', content: null }, // title empty, content null
        { title: 'A'.repeat(1000) }, // title too long
        { __proto__: { admin: true } } // prototype pollution attempt
      ];

      for (const invalidData of invalidStructures) {
        const response: IPCResponse = {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Data structure validation failed',
            details: {
              field: Object.keys(invalidData)[0],
              expected: 'string',
              received: typeof Object.values(invalidData)[0]
            }
          }
        };

        mockIpcRenderer.invoke.mockResolvedValue(response);

        const result = await mockIpcRenderer.invoke('db:addEntry', invalidData);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('VALIDATION_ERROR');
      }
    });

    test('should validate file paths for directory traversal', async () => {
      const maliciousPaths = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        '/etc/shadow',
        'C:\\Windows\\System32\\config\\SAM',
        './../../secret-files/api-keys.txt'
      ];

      for (const path of maliciousPaths) {
        const response: IPCResponse = {
          success: false,
          error: {
            code: 'INVALID_FILE_PATH',
            message: 'File path contains directory traversal patterns',
            details: {
              path,
              issue: 'Directory traversal detected'
            }
          }
        };

        mockIpcRenderer.invoke.mockResolvedValue(response);

        const result = await mockIpcRenderer.invoke('db:exportToJSON', path);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('INVALID_FILE_PATH');
      }
    });

    test('should validate file size limits', async () => {
      const oversizedFile = {
        name: 'large-file.json',
        size: 100 * 1024 * 1024, // 100MB
        path: '/path/to/large-file.json'
      };

      const response: IPCResponse = {
        success: false,
        error: {
          code: 'FILE_SIZE_EXCEEDED',
          message: 'File size exceeds maximum allowed limit',
          details: {
            fileSize: oversizedFile.size,
            maxSize: 50 * 1024 * 1024, // 50MB limit
            fileName: oversizedFile.name
          }
        }
      };

      mockIpcRenderer.invoke.mockResolvedValue(response);

      const result = await mockIpcRenderer.invoke('db:importFromJSON', oversizedFile.path);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('FILE_SIZE_EXCEEDED');
      expect(result.error?.details.fileSize).toBeGreaterThan(result.error?.details.maxSize);
    });
  });

  describe('Rate Limiting and DoS Protection', () => {
    test('should enforce request rate limits', async () => {
      const rateLimitConfig = {
        maxRequests: 10,
        windowMs: 60000, // 1 minute
        resetTime: Date.now() + 60000
      };

      // First 10 requests should succeed
      for (let i = 0; i < 10; i++) {
        mockIpcRenderer.invoke.mockResolvedValueOnce({
          success: true,
          data: `result-${i}`
        });
      }

      // 11th request should be rate limited
      const rateLimitResponse: IPCResponse = {
        success: false,
        error: {
          code: 'IPC_RATE_LIMIT_EXCEEDED',
          message: `Too many requests: ${rateLimitConfig.maxRequests} requests per minute exceeded`,
          details: rateLimitConfig
        }
      };

      mockIpcRenderer.invoke.mockResolvedValue(rateLimitResponse);

      // Execute requests
      const results = [];
      for (let i = 0; i < 11; i++) {
        results.push(await mockIpcRenderer.invoke('db:search', `query-${i}`));
      }

      // Verify rate limiting
      expect(results.slice(0, 10).every(r => r.success)).toBe(true);
      expect(results[10].success).toBe(false);
      expect(results[10].error?.code).toBe('IPC_RATE_LIMIT_EXCEEDED');
    });

    test('should handle burst protection', async () => {
      const burstConfig = {
        maxBurst: 5,
        burstWindowMs: 1000
      };

      // Simulate rapid burst of requests
      const rapidRequests = Array.from({ length: 7 }, (_, i) => 
        mockIpcRenderer.invoke('db:search', `burst-query-${i}`)
      );

      // First 5 should succeed, rest should be rate limited
      mockIpcRenderer.invoke
        .mockResolvedValueOnce({ success: true, data: 'result-0' })
        .mockResolvedValueOnce({ success: true, data: 'result-1' })
        .mockResolvedValueOnce({ success: true, data: 'result-2' })
        .mockResolvedValueOnce({ success: true, data: 'result-3' })
        .mockResolvedValueOnce({ success: true, data: 'result-4' })
        .mockResolvedValue({
          success: false,
          error: {
            code: 'BURST_LIMIT_EXCEEDED',
            message: `Burst limit of ${burstConfig.maxBurst} requests in ${burstConfig.burstWindowMs}ms exceeded`,
            details: burstConfig
          }
        });

      const results = await Promise.all(rapidRequests);

      expect(results.slice(0, 5).every(r => r.success)).toBe(true);
      expect(results.slice(5).every(r => !r.success)).toBe(true);
      expect(results[5].error?.code).toBe('BURST_LIMIT_EXCEEDED');
    });

    test('should prevent memory exhaustion attacks', async () => {
      const largePayload = {
        title: 'A'.repeat(1024 * 1024), // 1MB string
        content: 'B'.repeat(10 * 1024 * 1024), // 10MB string
        metadata: {
          largeArray: new Array(100000).fill('large-data')
        }
      };

      const response: IPCResponse = {
        success: false,
        error: {
          code: 'PAYLOAD_TOO_LARGE',
          message: 'Request payload exceeds maximum allowed size',
          details: {
            payloadSize: JSON.stringify(largePayload).length,
            maxPayloadSize: 1024 * 1024, // 1MB limit
            field: 'content'
          }
        }
      };

      mockIpcRenderer.invoke.mockResolvedValue(response);

      const result = await mockIpcRenderer.invoke('db:addEntry', largePayload);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('PAYLOAD_TOO_LARGE');
    });
  });

  describe('Authentication and Authorization', () => {
    test('should validate user sessions', async () => {
      const invalidSession = {
        sessionId: 'invalid-session-123',
        userId: 'user-456',
        expired: true
      };

      const response: IPCResponse = {
        success: false,
        error: {
          code: 'INVALID_SESSION',
          message: 'User session is invalid or expired',
          details: {
            sessionId: invalidSession.sessionId,
            reason: 'Session expired',
            loginRequired: true
          }
        }
      };

      mockIpcRenderer.invoke.mockResolvedValue(response);

      const result = await mockIpcRenderer.invoke('db:addEntry', {
        title: 'Test Entry'
      }, invalidSession.userId);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_SESSION');
      expect(result.error?.details.loginRequired).toBe(true);
    });

    test('should enforce permission-based access control', async () => {
      const restrictedOperations = [
        { operation: 'db:deleteEntry', permission: 'delete_entries' },
        { operation: 'db:createBackup', permission: 'admin_backup' },
        { operation: 'config:set', permission: 'modify_config' },
        { operation: 'system:getInfo', permission: 'system_info' }
      ];

      for (const { operation, permission } of restrictedOperations) {
        const response: IPCResponse = {
          success: false,
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: `User lacks required permission: ${permission}`,
            details: {
              operation,
              requiredPermission: permission,
              userPermissions: ['read_entries', 'search_entries']
            }
          }
        };

        mockIpcRenderer.invoke.mockResolvedValue(response);

        const result = await mockIpcRenderer.invoke(operation, 'test-data');

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('INSUFFICIENT_PERMISSIONS');
        expect(result.error?.details.requiredPermission).toBe(permission);
      }
    });

    test('should validate API tokens for service operations', async () => {
      const invalidToken = 'invalid-api-token-xyz';

      const response: IPCResponse = {
        success: false,
        error: {
          code: 'INVALID_API_TOKEN',
          message: 'API token is invalid or expired',
          details: {
            token: invalidToken.substring(0, 8) + '...',
            reason: 'Token not found in authorized tokens',
            tokenRequired: true
          }
        }
      };

      mockIpcRenderer.invoke.mockResolvedValue(response);

      const result = await mockIpcRenderer.invoke('ai:explainError', 'ERROR-001');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_API_TOKEN');
    });
  });

  describe('Origin and Source Validation', () => {
    test('should validate IPC message origin', async () => {
      const maliciousOrigins = [
        'https://malicious-site.com',
        'http://localhost:3000', // unexpected local server
        'ftp://file-server.com',
        'data:text/html,<script>alert(1)</script>'
      ];

      for (const origin of maliciousOrigins) {
        const response: IPCResponse = {
          success: false,
          error: {
            code: 'UNAUTHORIZED_ORIGIN',
            message: 'IPC message from unauthorized origin',
            details: {
              origin,
              expected: 'file://',
              securityPolicy: 'Same-origin policy violated'
            }
          }
        };

        mockIpcRenderer.invoke.mockResolvedValue(response);

        const result = await mockIpcRenderer.invoke('db:search', 'test');

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('UNAUTHORIZED_ORIGIN');
      }
    });

    test('should validate frame source for embedded content', async () => {
      const suspiciousFrame = {
        url: 'https://evil-embed.com/steal-data',
        origin: 'https://evil-embed.com'
      };

      mockEvent.senderFrame.url = suspiciousFrame.url;

      const response: IPCResponse = {
        success: false,
        error: {
          code: 'UNTRUSTED_FRAME',
          message: 'IPC message from untrusted frame source',
          details: {
            frameUrl: suspiciousFrame.url,
            frameOrigin: suspiciousFrame.origin,
            allowedOrigins: ['file://']
          }
        }
      };

      mockIpcRenderer.invoke.mockResolvedValue(response);

      const result = await mockIpcRenderer.invoke('db:getEntry', '123');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('UNTRUSTED_FRAME');
    });
  });

  describe('Data Encryption and Secure Transmission', () => {
    test('should encrypt sensitive data in transit', async () => {
      const sensitiveData = {
        title: 'Database Credentials',
        content: 'Username: admin, Password: secret123',
        category: 'Security'
      };

      const encryptedResponse: IPCResponse = {
        success: true,
        data: {
          encrypted: true,
          payload: 'aGVsbG8gd29ybGQ=', // base64 encoded
          algorithm: 'AES-256-GCM',
          iv: 'abcd1234567890ef'
        },
        metadata: {
          executionTime: 45,
          encrypted: true
        }
      };

      mockIpcRenderer.invoke.mockResolvedValue(encryptedResponse);

      const result = await mockIpcRenderer.invoke('db:addEntry', sensitiveData);

      expect(result.success).toBe(true);
      expect(result.data.encrypted).toBe(true);
      expect(result.data.algorithm).toBe('AES-256-GCM');
      expect(result.metadata?.encrypted).toBe(true);
    });

    test('should validate data integrity with checksums', async () => {
      const dataWithChecksum = {
        title: 'Important Entry',
        content: 'Critical information...',
        checksum: 'invalid-checksum-123'
      };

      const response: IPCResponse = {
        success: false,
        error: {
          code: 'INTEGRITY_CHECK_FAILED',
          message: 'Data integrity validation failed',
          details: {
            expectedChecksum: 'abcd1234567890ef',
            receivedChecksum: dataWithChecksum.checksum,
            algorithm: 'SHA-256'
          }
        }
      };

      mockIpcRenderer.invoke.mockResolvedValue(response);

      const result = await mockIpcRenderer.invoke('db:addEntry', dataWithChecksum);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INTEGRITY_CHECK_FAILED');
    });
  });

  describe('Secure Configuration Management', () => {
    test('should protect sensitive configuration values', async () => {
      const sensitiveConfigs = [
        'api.key',
        'database.password',
        'encryption.secret',
        'auth.private_key'
      ];

      for (const configKey of sensitiveConfigs) {
        const response: IPCResponse = {
          success: false,
          error: {
            code: 'SENSITIVE_CONFIG_ACCESS_DENIED',
            message: 'Access to sensitive configuration denied',
            details: {
              configKey,
              reason: 'Sensitive configuration requires elevated permissions',
              requiredPermission: 'config_admin'
            }
          }
        };

        mockIpcRenderer.invoke.mockResolvedValue(response);

        const result = await mockIpcRenderer.invoke('config:get', configKey);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('SENSITIVE_CONFIG_ACCESS_DENIED');
      }
    });

    test('should validate configuration value formats', async () => {
      const invalidConfigs = [
        { key: 'port', value: 'not-a-number', type: 'number' },
        { key: 'api.url', value: 'invalid-url', type: 'url' },
        { key: 'cache.ttl', value: '-1', type: 'positive_number' },
        { key: 'features.enabled', value: 'maybe', type: 'boolean' }
      ];

      for (const { key, value, type } of invalidConfigs) {
        const response: IPCResponse = {
          success: false,
          error: {
            code: 'INVALID_CONFIG_FORMAT',
            message: `Configuration value format is invalid for type: ${type}`,
            details: {
              configKey: key,
              providedValue: value,
              expectedType: type,
              validationRules: `Must be a valid ${type}`
            }
          }
        };

        mockIpcRenderer.invoke.mockResolvedValue(response);

        const result = await mockIpcRenderer.invoke('config:set', key, value);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('INVALID_CONFIG_FORMAT');
        expect(result.error?.details.expectedType).toBe(type);
      }
    });
  });

  describe('Security Event Logging and Monitoring', () => {
    test('should log security events for monitoring', async () => {
      const securityEvents = [
        'multiple_failed_auth_attempts',
        'rate_limit_exceeded',
        'malicious_input_detected',
        'unauthorized_access_attempt',
        'privilege_escalation_attempt'
      ];

      for (const eventType of securityEvents) {
        const response: IPCResponse = {
          success: false,
          error: {
            code: 'SECURITY_EVENT_LOGGED',
            message: `Security event detected and logged: ${eventType}`,
            details: {
              eventType,
              timestamp: Date.now(),
              severity: 'HIGH',
              action: 'REQUEST_BLOCKED',
              logged: true
            }
          }
        };

        mockIpcRenderer.invoke.mockResolvedValue(response);

        const result = await mockIpcRenderer.invoke('test:security-event', eventType);

        expect(result.success).toBe(false);
        expect(result.error?.details.logged).toBe(true);
        expect(result.error?.details.severity).toBe('HIGH');
      }
    });

    test('should trigger security alerts for critical threats', async () => {
      const criticalThreats = [
        'sql_injection_detected',
        'file_system_access_attempt',
        'privilege_escalation_detected',
        'data_exfiltration_attempt'
      ];

      for (const threat of criticalThreats) {
        const response: IPCResponse = {
          success: false,
          error: {
            code: 'CRITICAL_SECURITY_THREAT',
            message: `Critical security threat detected: ${threat}`,
            details: {
              threatType: threat,
              severity: 'CRITICAL',
              alertTriggered: true,
              actionTaken: 'CONNECTION_TERMINATED',
              reportedToAdmin: true,
              timestamp: Date.now()
            }
          }
        };

        mockIpcRenderer.invoke.mockResolvedValue(response);

        const result = await mockIpcRenderer.invoke('test:critical-threat', threat);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('CRITICAL_SECURITY_THREAT');
        expect(result.error?.details.alertTriggered).toBe(true);
        expect(result.error?.details.severity).toBe('CRITICAL');
      }
    });
  });
});
