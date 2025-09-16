/**
 * Mock KB Entries for Testing
 */

import { KBEntry } from '../../src/types';

export const mockKBEntries: KBEntry[] = [
  {
    id: 'test-entry-1',
    title: 'VSAM Status 35 Error',
    problem: 'File not found error when trying to access VSAM dataset',
    solution: 'Check catalog and file existence, verify DD statement',
    category: 'VSAM',
    tags: ['vsam', 'error', 'status-35'],
    created_at: new Date('2024-01-15T10:30:00Z'),
    updated_at: new Date('2024-01-15T10:30:00Z'),
    usage_count: 25,
    success_count: 22,
    failure_count: 3,
  },
  {
    id: 'test-entry-2',
    title: 'JCL Syntax Error',
    problem: 'Job fails with syntax error in JCL',
    solution: 'Review JCL syntax and fix errors',
    category: 'JCL',
    tags: ['jcl', 'syntax', 'error'],
    created_at: new Date('2024-01-10T14:20:00Z'),
    updated_at: new Date('2024-01-12T09:15:00Z'),
    usage_count: 15,
    success_count: 13,
    failure_count: 2,
  },
  {
    id: 'test-entry-3',
    title: 'DB2 Connection Timeout',
    problem: 'Database connection times out during batch processing',
    solution: 'Increase timeout settings and optimize queries',
    category: 'DB2',
    tags: ['db2', 'connection', 'timeout', 'batch'],
    created_at: new Date('2024-01-08T16:45:00Z'),
    updated_at: new Date('2024-01-20T11:30:00Z'),
    usage_count: 8,
    success_count: 7,
    failure_count: 1,
  },
  {
    id: 'test-entry-4',
    title: 'COBOL S0C7 Abend',
    problem: 'Program abends with S0C7 data exception',
    solution: 'Check numeric field initialization and data validation',
    category: 'Batch',
    tags: ['cobol', 's0c7', 'abend', 'numeric'],
    created_at: new Date('2024-01-05T13:00:00Z'),
    updated_at: new Date('2024-01-18T08:30:00Z'),
    usage_count: 35,
    success_count: 30,
    failure_count: 5,
  },
  {
    id: 'test-entry-5',
    title: 'Functional Testing Guidelines',
    problem: 'Need standardized approach for functional testing',
    solution: 'Follow test plan template and use automated testing tools',
    category: 'Functional',
    tags: ['testing', 'functional', 'guidelines', 'automation'],
    created_at: new Date('2024-01-03T12:00:00Z'),
    updated_at: new Date('2024-01-15T15:45:00Z'),
    usage_count: 12,
    success_count: 11,
    failure_count: 1,
  },
];

// Specific entry subsets for testing
export const mockVSAMEntries = mockKBEntries.filter(entry => entry.category === 'VSAM');
export const mockJCLEntries = mockKBEntries.filter(entry => entry.category === 'JCL');
export const mockDB2Entries = mockKBEntries.filter(entry => entry.category === 'DB2');
export const mockBatchEntries = mockKBEntries.filter(entry => entry.category === 'Batch');
export const mockFunctionalEntries = mockKBEntries.filter(entry => entry.category === 'Functional');

// High-usage entries for testing popular content
export const mockHighUsageEntries = mockKBEntries
  .filter(entry => entry.usage_count > 20)
  .sort((a, b) => b.usage_count - a.usage_count);

// Recent entries for testing recent content
export const mockRecentEntries = [...mockKBEntries]
  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  .slice(0, 3);

// Entries with high success rates
export const mockHighSuccessEntries = mockKBEntries
  .filter(entry => (entry.success_count / (entry.success_count + entry.failure_count)) > 0.8);

// Template for creating new test entries
export const createMockEntry = (overrides: Partial<KBEntry> = {}): KBEntry => ({
  id: `mock-entry-${Date.now()}`,
  title: 'Test Entry',
  problem: 'Test problem description',
  solution: 'Test solution steps',
  category: 'Other',
  tags: ['test'],
  created_at: new Date(),
  updated_at: new Date(),
  usage_count: 0,
  success_count: 0,
  failure_count: 0,
  ...overrides,
});

// Generate entries for performance testing
export const generateLargeEntrySet = (count: number): KBEntry[] => {
  const entries: KBEntry[] = [];
  const categories = ['VSAM', 'JCL', 'DB2', 'Batch', 'Functional'];
  
  for (let i = 0; i < count; i++) {
    entries.push(createMockEntry({
      id: `perf-entry-${i}`,
      title: `Performance Test Entry ${i}`,
      problem: `Test problem ${i} with various keywords and descriptions`,
      solution: `Test solution ${i} with step-by-step instructions`,
      category: categories[i % categories.length],
      tags: [`tag${i}`, `category${i % categories.length}`, 'performance-test'],
      usage_count: Math.floor(Math.random() * 100),
      success_count: Math.floor(Math.random() * 50),
      failure_count: Math.floor(Math.random() * 10),
    }));
  }
  
  return entries;
};