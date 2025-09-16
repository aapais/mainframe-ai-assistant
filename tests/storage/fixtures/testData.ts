/**
 * Test Data Fixtures for Storage Tests
 * Provides sample data and factory functions for testing
 */

import { KBEntry, KBEntryInput, SearchResult, StorageConfig } from '../../../src/services/storage/IStorageService';
import { v4 as uuidv4 } from 'uuid';

// ========================
// KB Entry Fixtures
// ========================

export function createTestKBEntry(overrides?: Partial<KBEntryInput>): KBEntryInput {
  return {
    title: 'Test Knowledge Entry',
    problem: 'This is a test problem description that explains the issue in detail.',
    solution: 'This is a test solution with step-by-step instructions:\n1. First step\n2. Second step\n3. Third step',
    category: 'JCL',
    tags: ['test', 'sample', 'mock'],
    ...overrides
  };
}

export function createCompleteKBEntry(overrides?: Partial<KBEntry>): KBEntry {
  const id = uuidv4();
  const now = new Date();
  
  return {
    id,
    title: 'Complete Test Entry',
    problem: 'Complete test problem description',
    solution: 'Complete test solution',
    category: 'VSAM',
    tags: ['complete', 'test'],
    created_at: now,
    updated_at: now,
    usage_count: 5,
    success_count: 4,
    failure_count: 1,
    created_by: 'test-user',
    ...overrides
  };
}

export function createBatchKBEntries(count: number): KBEntryInput[] {
  return Array.from({ length: count }, (_, index) => 
    createTestKBEntry({
      title: `Batch Entry ${index + 1}`,
      problem: `Problem description for entry ${index + 1}`,
      solution: `Solution for entry ${index + 1}`,
      category: ['JCL', 'VSAM', 'DB2', 'Batch', 'Functional'][index % 5] as any,
      tags: [`batch-${index + 1}`, 'test', 'automated']
    })
  );
}

// ========================
// Search Result Fixtures
// ========================

export function createTestSearchResult(overrides?: Partial<SearchResult>): SearchResult {
  return {
    entry: createCompleteKBEntry(),
    score: 0.85,
    metadata: {
      method: 'full-text',
      matchedFields: ['title', 'problem'],
      executionTime: 25
    },
    ...overrides
  };
}

export function createSearchResults(count: number, scores?: number[]): SearchResult[] {
  return Array.from({ length: count }, (_, index) => {
    const score = scores?.[index] || (1 - (index * 0.1));
    return createTestSearchResult({
      entry: createCompleteKBEntry({
        title: `Search Result ${index + 1}`,
        category: ['JCL', 'VSAM', 'DB2'][index % 3] as any
      }),
      score: Math.max(0.1, score),
      metadata: {
        method: 'full-text',
        rank: index + 1,
        matchedFields: ['title']
      }
    });
  });
}

// ========================
// Configuration Fixtures
// ========================

export function createMockConfig(overrides?: Partial<StorageConfig>): StorageConfig {
  return {
    database: {
      type: 'sqlite',
      path: ':memory:',
      pragmas: {
        journal_mode: 'WAL',
        synchronous: 'NORMAL',
        foreign_keys: 'ON'
      }
    },
    backup: {
      enabled: false,
      interval: 24 * 60 * 60 * 1000, // 24 hours
      retention: 7,
      compression: true,
      destinations: []
    },
    performance: {
      caching: {
        enabled: true,
        maxSize: 1000,
        ttl: 300000 // 5 minutes
      },
      indexing: {
        fullTextSearch: true,
        customIndexes: []
      },
      maintenance: {
        autoVacuum: true,
        analyzeFrequency: 7 * 24 * 60 * 60 * 1000 // 7 days
      },
      monitoring: {
        enabled: true,
        slowQueryThreshold: 1000,
        performanceWarningThreshold: 2000
      }
    },
    mvp: {
      version: '1',
      features: {
        plugins: true,
        backup: false,
        analytics: false,
        codeAnalysis: false,
        templates: false
      }
    },
    plugins: {
      enabled: [],
      directory: './plugins',
      autoLoad: false
    },
    ...overrides
  };
}

export function createTestDatabaseConfig() {
  return {
    type: 'sqlite' as const,
    path: ':memory:',
    pragmas: {
      journal_mode: 'WAL',
      synchronous: 'NORMAL',
      foreign_keys: 'ON'
    }
  };
}

// ========================
// Sample Data Sets
// ========================

export const SAMPLE_KB_ENTRIES: KBEntryInput[] = [
  {
    title: 'VSAM Status 35 - File Not Found',
    problem: 'Job abends with VSAM status code 35. The VSAM file cannot be accessed or opened.',
    solution: 'Steps to resolve:\n1. Check if dataset exists using LISTCAT\n2. Verify catalog entries\n3. Check RACF permissions\n4. Verify correct DD statement syntax',
    category: 'VSAM',
    tags: ['vsam', 'status-35', 'file-not-found', 'abend']
  },
  {
    title: 'S0C7 Data Exception in COBOL',
    problem: 'Program terminates with S0C7 data exception during numeric operation.',
    solution: 'Troubleshooting steps:\n1. Check for uninitialized numeric fields\n2. Verify COMP-3 field definitions\n3. Use NUMERIC test before arithmetic\n4. Check input data validity',
    category: 'Batch',
    tags: ['s0c7', 'data-exception', 'cobol', 'numeric', 'abend']
  },
  {
    title: 'JCL Syntax Error - Invalid DD Statement',
    problem: 'Job fails during JCL validation with syntax error on DD statement.',
    solution: 'Common fixes:\n1. Check for missing commas\n2. Verify continuation characters\n3. Check DSN syntax\n4. Validate DISP parameters',
    category: 'JCL',
    tags: ['jcl', 'syntax-error', 'dd-statement', 'validation']
  },
  {
    title: 'DB2 SQLCODE -904 Resource Unavailable',
    problem: 'Application receives SQLCODE -904 indicating resource is not available.',
    solution: 'Resolution steps:\n1. Check tablespace status\n2. Verify page set availability\n3. Check for locks\n4. Review IRLM parameters',
    category: 'DB2',
    tags: ['db2', 'sqlcode', '-904', 'resource', 'unavailable']
  },
  {
    title: 'CICS Transaction Timeout ATNI',
    problem: 'CICS transaction times out with ATNI abend code.',
    solution: 'Actions to take:\n1. Check transaction definition\n2. Review timeout settings\n3. Examine deadlock conditions\n4. Check system load',
    category: 'Functional',
    tags: ['cics', 'timeout', 'atni', 'transaction', 'abend']
  }
];

export const SAMPLE_CATEGORIES = ['JCL', 'VSAM', 'DB2', 'Batch', 'Functional'];

export const SAMPLE_TAGS = [
  'abend', 'error', 'syntax', 'timeout', 'performance',
  'vsam', 'db2', 'cics', 'jcl', 'cobol',
  'file-not-found', 'data-exception', 'resource',
  'status-code', 'sqlcode', 'transaction'
];

// ========================
// Error Scenarios
// ========================

export const ERROR_SCENARIOS = {
  INVALID_ENTRY: {
    title: '', // Invalid: empty title
    problem: 'Valid problem',
    solution: 'Valid solution',
    category: 'JCL',
    tags: []
  },
  
  MISSING_REQUIRED_FIELDS: {
    title: 'Valid title',
    // Missing problem and solution
    category: 'VSAM',
    tags: []
  },
  
  INVALID_CATEGORY: {
    title: 'Valid title',
    problem: 'Valid problem',
    solution: 'Valid solution',
    category: 'INVALID_CATEGORY' as any,
    tags: []
  },

  SQL_INJECTION_ATTEMPT: {
    title: "'; DROP TABLE kb_entries; --",
    problem: "SQL injection test problem",
    solution: "This should be safely escaped",
    category: 'JCL',
    tags: ['injection', 'security']
  },

  LARGE_DATA_ENTRY: {
    title: 'Large data test entry',
    problem: 'A'.repeat(10000), // Very large problem text
    solution: 'B'.repeat(10000), // Very large solution text
    category: 'Batch',
    tags: Array.from({ length: 100 }, (_, i) => `tag-${i}`)
  }
};

// ========================
// Performance Test Data
// ========================

export function createPerformanceTestData(entryCount: number): KBEntryInput[] {
  const categories = SAMPLE_CATEGORIES;
  const baseProblems = [
    'System experiencing high CPU usage',
    'Database connection failures detected',
    'File processing errors occurring',
    'Network timeout issues reported',
    'Memory allocation problems found'
  ];
  
  return Array.from({ length: entryCount }, (_, index) => ({
    title: `Performance Test Entry ${index + 1}`,
    problem: `${baseProblems[index % baseProblems.length]} - Instance ${index + 1}`,
    solution: `Standard solution procedure for issue type ${(index % 5) + 1}:\n` +
             `1. Identify root cause\n` +
             `2. Apply appropriate fix\n` +
             `3. Monitor for recurrence\n` +
             `4. Document resolution`,
    category: categories[index % categories.length] as any,
    tags: [
      `perf-test-${index + 1}`,
      `category-${index % 5}`,
      `batch-${Math.floor(index / 100)}`,
      'performance-test'
    ]
  }));
}

// ========================
// Search Test Scenarios
// ========================

export const SEARCH_TEST_SCENARIOS = [
  {
    name: 'exact_match',
    query: 'VSAM Status 35',
    expectedResults: 1,
    expectedCategory: 'VSAM'
  },
  {
    name: 'partial_match',
    query: 'data exception',
    expectedResults: 1,
    expectedCategory: 'Batch'
  },
  {
    name: 'category_filter',
    query: '',
    options: { filters: { category: 'DB2' } },
    expectedResults: 1,
    expectedCategory: 'DB2'
  },
  {
    name: 'tag_filter',
    query: '',
    options: { filters: { tags: ['abend'] } },
    expectedResults: 3, // Multiple entries with 'abend' tag
    expectedCategory: null
  },
  {
    name: 'no_results',
    query: 'nonexistent problem',
    expectedResults: 0,
    expectedCategory: null
  },
  {
    name: 'empty_query',
    query: '',
    expectedResults: 5, // All sample entries
    expectedCategory: null
  }
];

// ========================
// Utility Functions
// ========================

export function createRandomKBEntry(): KBEntryInput {
  const randomTitle = `Random Entry ${Math.floor(Math.random() * 1000)}`;
  const randomCategory = SAMPLE_CATEGORIES[Math.floor(Math.random() * SAMPLE_CATEGORIES.length)];
  const randomTags = SAMPLE_TAGS
    .sort(() => 0.5 - Math.random())
    .slice(0, Math.floor(Math.random() * 5) + 1);

  return createTestKBEntry({
    title: randomTitle,
    category: randomCategory as any,
    tags: randomTags
  });
}

export function createEntriesWithTags(tagGroups: string[][]): KBEntryInput[] {
  return tagGroups.map((tags, index) => 
    createTestKBEntry({
      title: `Entry with tags ${tags.join(', ')}`,
      tags,
      category: SAMPLE_CATEGORIES[index % SAMPLE_CATEGORIES.length] as any
    })
  );
}

export function createEntriesForCategory(category: string, count: number): KBEntryInput[] {
  return Array.from({ length: count }, (_, index) =>
    createTestKBEntry({
      title: `${category} Entry ${index + 1}`,
      category: category as any,
      tags: [category.toLowerCase(), `entry-${index + 1}`]
    })
  );
}

export function waitForDelay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function createTestDate(daysAgo: number = 0): Date {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date;
}

export function createEntryWithAge(daysAgo: number): KBEntry {
  const date = createTestDate(daysAgo);
  return createCompleteKBEntry({
    created_at: date,
    updated_at: date
  });
}

// ========================
// Validation Helpers
// ========================

export function validateKBEntry(entry: KBEntry): boolean {
  return !!(
    entry.id &&
    entry.title &&
    entry.problem &&
    entry.solution &&
    entry.category &&
    entry.created_at &&
    entry.updated_at
  );
}

export function validateSearchResult(result: SearchResult): boolean {
  return !!(
    result.entry &&
    validateKBEntry(result.entry) &&
    typeof result.score === 'number' &&
    result.score >= 0 &&
    result.score <= 1
  );
}

export function assertArrayContainsEntry(array: KBEntry[], entryId: string): boolean {
  return array.some(entry => entry.id === entryId);
}

export function assertScoresDescending(results: SearchResult[]): boolean {
  for (let i = 1; i < results.length; i++) {
    if (results[i].score > results[i - 1].score) {
      return false;
    }
  }
  return true;
}

// ========================
// Export All
// ========================

export const TestData = {
  // Factories
  createTestKBEntry,
  createCompleteKBEntry,
  createBatchKBEntries,
  createTestSearchResult,
  createSearchResults,
  createMockConfig,
  createTestDatabaseConfig,
  createPerformanceTestData,
  createRandomKBEntry,
  createEntriesWithTags,
  createEntriesForCategory,
  createEntryWithAge,
  
  // Sample data
  SAMPLE_KB_ENTRIES,
  SAMPLE_CATEGORIES,
  SAMPLE_TAGS,
  ERROR_SCENARIOS,
  SEARCH_TEST_SCENARIOS,
  
  // Utilities
  waitForDelay,
  createTestDate,
  validateKBEntry,
  validateSearchResult,
  assertArrayContainsEntry,
  assertScoresDescending
};