/**
 * IPC Test Data Fixtures
 * 
 * Comprehensive test data for IPC testing including valid requests,
 * invalid data, edge cases, and performance test scenarios.
 */

import { 
  BaseIPCRequest, 
  BaseIPCResponse, 
  IPCError,
  IPCErrorCode,
  KBSearchRequest,
  KBEntryCreateRequest,
  MetricsRequest,
  IPCChannel 
} from '../../src/types/ipc';
import { KBEntry, KBCategory } from '../../src/types/index';

// ===========================
// Valid Test Data
// ===========================

export const VALID_REQUEST_ID = 'test-request-123';
export const VALID_USER_ID = 'test-user-456';
export const VALID_TIMESTAMP = Date.now();

export const validBaseRequest: BaseIPCRequest = {
  requestId: VALID_REQUEST_ID,
  timestamp: VALID_TIMESTAMP,
  channel: IPCChannel.KB_SEARCH,
  version: '1.0.0',
  userId: VALID_USER_ID
};

export const validKBEntry: KBEntry = {
  id: 'kb-entry-test-1',
  title: 'VSAM Status 35 - File Not Found',
  problem: 'Job abends with VSAM status code 35. The program cannot open the VSAM file.',
  solution: '1. Verify the dataset exists\n2. Check DD statement in JCL\n3. Ensure file is cataloged properly',
  category: KBCategory.VSAM,
  tags: ['vsam', 'status-35', 'file-not-found', 'catalog'],
  created_at: new Date('2024-01-01T00:00:00Z'),
  updated_at: new Date('2024-01-01T00:00:00Z'),
  created_by: 'system',
  usage_count: 5,
  success_count: 4,
  failure_count: 1
};

export const validSearchRequest: KBSearchRequest = {
  ...validBaseRequest,
  channel: IPCChannel.KB_SEARCH,
  query: 'VSAM status 35',
  limit: 10,
  useAI: true,
  filters: {
    category: KBCategory.VSAM,
    tags: ['vsam']
  }
};

export const validCreateRequest: KBEntryCreateRequest = {
  ...validBaseRequest,
  channel: IPCChannel.KB_CREATE,
  entry: {
    title: 'New Test Entry',
    problem: 'Test problem description',
    solution: 'Test solution steps',
    category: KBCategory.JCL,
    tags: ['test', 'jcl']
  }
};

export const validMetricsRequest: MetricsRequest = {
  ...validBaseRequest,
  channel: IPCChannel.METRICS_GET,
  timeframe: '24h',
  includeDetails: true
};

// ===========================
// Invalid Test Data
// ===========================

export const invalidRequests = {
  missingRequestId: {
    ...validBaseRequest,
    requestId: undefined as any
  },
  
  invalidTimestamp: {
    ...validBaseRequest,
    timestamp: 'invalid-timestamp' as any
  },
  
  missingChannel: {
    ...validBaseRequest,
    channel: undefined as any
  },
  
  invalidVersion: {
    ...validBaseRequest,
    version: 999 as any
  },
  
  emptyQuery: {
    ...validSearchRequest,
    query: ''
  },
  
  negativeLimit: {
    ...validSearchRequest,
    limit: -1
  },
  
  invalidCategory: {
    ...validCreateRequest,
    entry: {
      ...validCreateRequest.entry,
      category: 'INVALID_CATEGORY' as any
    }
  },
  
  missingTitle: {
    ...validCreateRequest,
    entry: {
      ...validCreateRequest.entry,
      title: undefined as any
    }
  }
};

// ===========================
// Error Test Data
// ===========================

export const testErrors: { [key: string]: IPCError } = {
  validationError: {
    code: IPCErrorCode.VALIDATION_ERROR,
    message: 'Validation failed for request parameters',
    details: { field: 'query', reason: 'Empty query not allowed' },
    retryable: false,
    severity: 'medium'
  },
  
  notFound: {
    code: IPCErrorCode.NOT_FOUND,
    message: 'Knowledge base entry not found',
    details: { entryId: 'non-existent-id' },
    retryable: false,
    severity: 'low'
  },
  
  internalError: {
    code: IPCErrorCode.INTERNAL_ERROR,
    message: 'Internal server error occurred',
    retryable: true,
    severity: 'high'
  },
  
  timeoutError: {
    code: IPCErrorCode.TIMEOUT,
    message: 'Request timeout after 5000ms',
    retryable: true,
    severity: 'medium'
  },
  
  rateLimitError: {
    code: IPCErrorCode.RATE_LIMIT_EXCEEDED,
    message: 'Rate limit exceeded',
    details: { limit: 100, current: 101, resetTime: Date.now() + 60000 },
    retryable: true,
    severity: 'medium'
  }
};

// ===========================
// Response Test Data
// ===========================

export const validSuccessResponse: BaseIPCResponse = {
  success: true,
  requestId: VALID_REQUEST_ID,
  timestamp: VALID_TIMESTAMP,
  executionTime: 250,
  data: { message: 'Success' },
  metadata: {
    cached: false,
    source: 'database'
  }
};

export const validErrorResponse: BaseIPCResponse = {
  success: false,
  requestId: VALID_REQUEST_ID,
  timestamp: VALID_TIMESTAMP,
  executionTime: 100,
  error: testErrors.validationError
};

// ===========================
// Performance Test Data
// ===========================

export const performanceTestData = {
  lightweightRequest: {
    ...validSearchRequest,
    query: 'simple',
    limit: 5
  },
  
  heavyRequest: {
    ...validSearchRequest,
    query: 'complex search with multiple terms and filters',
    limit: 100,
    useAI: true
  },
  
  bulkRequests: Array.from({ length: 100 }, (_, i) => ({
    ...validSearchRequest,
    requestId: `bulk-request-${i}`,
    query: `search query ${i}`
  })),
  
  largeEntry: {
    ...validCreateRequest,
    entry: {
      title: 'Large Entry Test',
      problem: 'P'.repeat(10000), // 10KB problem description
      solution: 'S'.repeat(10000), // 10KB solution
      category: KBCategory.OTHER,
      tags: Array.from({ length: 50 }, (_, i) => `tag-${i}`)
    }
  }
};

// ===========================
// Security Test Data
// ===========================

export const securityTestData = {
  sqlInjectionAttempts: [
    "'; DROP TABLE kb_entries; --",
    "' OR 1=1 --",
    "'; INSERT INTO kb_entries (title) VALUES ('hacked'); --"
  ],
  
  xssAttempts: [
    '<script>alert("xss")</script>',
    'javascript:alert("xss")',
    '<img src="x" onerror="alert(\'xss\')">'
  ],
  
  oversizedRequests: {
    ...validCreateRequest,
    entry: {
      title: 'X'.repeat(100000), // 100KB title
      problem: 'P'.repeat(1000000), // 1MB problem
      solution: 'S'.repeat(1000000), // 1MB solution
      category: KBCategory.OTHER,
      tags: ['test']
    }
  },
  
  malformedJson: '{"incomplete": "json"',
  
  unauthorizedRequests: {
    ...validSearchRequest,
    userId: undefined // No user context
  }
};

// ===========================
// Edge Case Test Data
// ===========================

export const edgeCaseData = {
  emptyResults: {
    ...validSearchRequest,
    query: 'nonexistent-search-term-12345'
  },
  
  specialCharacters: {
    ...validCreateRequest,
    entry: {
      title: '测试 título éñ 🔥',
      problem: 'Special chars: àáâãäåçèéêë',
      solution: 'Unicode: αβγδε ✓ ✗ ⚠',
      category: KBCategory.OTHER,
      tags: ['unicode', 'special-chars']
    }
  },
  
  extremeValues: {
    maxLimit: {
      ...validSearchRequest,
      limit: Number.MAX_SAFE_INTEGER
    },
    
    futureTimestamp: {
      ...validSearchRequest,
      timestamp: Date.now() + 1000 * 60 * 60 * 24 * 365 // 1 year in future
    },
    
    negativeTimestamp: {
      ...validSearchRequest,
      timestamp: -1
    }
  }
};

// ===========================
// Test Utilities
// ===========================

export function createMockRequest(overrides: Partial<BaseIPCRequest> = {}): BaseIPCRequest {
  return {
    ...validBaseRequest,
    requestId: `mock-${Date.now()}-${Math.random()}`,
    timestamp: Date.now(),
    ...overrides
  };
}

export function createMockKBEntry(overrides: Partial<KBEntry> = {}): KBEntry {
  return {
    ...validKBEntry,
    id: `mock-kb-${Date.now()}-${Math.random()}`,
    ...overrides
  };
}

export function createMockResponse<T = any>(
  success: boolean = true,
  data?: T,
  error?: IPCError
): BaseIPCResponse<T> {
  return {
    success,
    requestId: `mock-response-${Date.now()}`,
    timestamp: Date.now(),
    executionTime: Math.floor(Math.random() * 1000) + 50,
    data,
    error,
    metadata: {
      cached: Math.random() > 0.5,
      source: 'test'
    }
  };
}

// ===========================
// Test Scenarios
// ===========================

export const testScenarios = {
  happyPath: {
    name: 'Happy Path - Normal Operation',
    requests: [validSearchRequest, validCreateRequest, validMetricsRequest],
    expectedSuccess: true
  },
  
  errorHandling: {
    name: 'Error Handling',
    requests: Object.values(invalidRequests),
    expectedSuccess: false
  },
  
  performance: {
    name: 'Performance Testing',
    requests: [
      performanceTestData.lightweightRequest,
      performanceTestData.heavyRequest,
      ...performanceTestData.bulkRequests.slice(0, 10)
    ],
    expectedSuccess: true,
    timeoutMs: 5000
  },
  
  security: {
    name: 'Security Validation',
    requests: [securityTestData.unauthorizedRequests],
    expectedSuccess: false
  },
  
  edgeCases: {
    name: 'Edge Cases',
    requests: [
      edgeCaseData.emptyResults,
      edgeCaseData.specialCharacters,
      edgeCaseData.extremeValues.maxLimit
    ],
    expectedSuccess: true // Should handle gracefully
  }
};