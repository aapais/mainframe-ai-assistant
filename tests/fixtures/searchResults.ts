/**
 * Mock Search Results for Testing
 */

import { KBEntry } from '../../src/types';

export const mockKBEntries: KBEntry[] = [
  {
    id: 'entry-1',
    title: 'VSAM Status 35 - File Not Found',
    problem: 'Job abends with VSAM status code 35. The program cannot open the VSAM file.',
    solution: '1. Verify the dataset exists\n2. Check the DD statement in JCL\n3. Ensure file is cataloged properly',
    category: 'VSAM',
    tags: ['vsam', 'status-35', 'file-not-found'],
    created_at: new Date('2024-01-15'),
    updated_at: new Date('2024-01-15'),
    usage_count: 45,
    success_count: 40,
    failure_count: 5,
  },
  {
    id: 'entry-2',
    title: 'S0C7 - Data Exception in COBOL',
    problem: 'Program abends with S0C7 data exception during arithmetic operations.',
    solution: '1. Check for non-numeric data in numeric fields\n2. Initialize all COMP-3 fields properly\n3. Use NUMERIC test before arithmetic',
    category: 'Batch',
    tags: ['s0c7', 'data-exception', 'numeric', 'cobol'],
    created_at: new Date('2024-01-10'),
    updated_at: new Date('2024-01-12'),
    usage_count: 67,
    success_count: 58,
    failure_count: 9,
  },
  {
    id: 'entry-3',
    title: 'JCL Error - Dataset Not Found (IEF212I)',
    problem: 'JCL fails with IEF212I dataset not found error',
    solution: '1. Verify dataset name spelling\n2. Check if dataset exists\n3. Verify UNIT and VOL parameters',
    category: 'JCL',
    tags: ['jcl', 'dataset', 'not-found', 'ief212i'],
    created_at: new Date('2024-01-08'),
    updated_at: new Date('2024-01-20'),
    usage_count: 23,
    success_count: 20,
    failure_count: 3,
  },
  {
    id: 'entry-4',
    title: 'DB2 SQLCODE -904 - Resource Unavailable',
    problem: 'Program receives SQLCODE -904 indicating resource unavailable',
    solution: '1. Check DB2 resource status\n2. Run IMAGE COPY if needed\n3. Contact DBA if persistent',
    category: 'DB2',
    tags: ['db2', 'sqlcode', '-904', 'resource'],
    created_at: new Date('2024-01-05'),
    updated_at: new Date('2024-01-18'),
    usage_count: 12,
    success_count: 10,
    failure_count: 2,
  },
];

export interface SearchResult {
  entry: KBEntry;
  score: number;
  matchType: 'exact' | 'fuzzy' | 'ai';
}

export const mockSearchResults: SearchResult[] = mockKBEntries.map((entry, index) => ({
  entry,
  score: 95 - (index * 5), // Decreasing scores
  matchType: index % 2 === 0 ? 'ai' : 'fuzzy',
}));

export const mockEmptySearchResults: SearchResult[] = [];

export const mockVSAMSearchResults: SearchResult[] = [
  {
    entry: mockKBEntries[0], // VSAM entry
    score: 95,
    matchType: 'ai',
  },
];

export const mockJCLSearchResults: SearchResult[] = [
  {
    entry: mockKBEntries[2], // JCL entry
    score: 90,
    matchType: 'fuzzy',
  },
];

export const mockHighScoreResults: SearchResult[] = mockKBEntries.map((entry, index) => ({
  entry,
  score: 98 - index, // High scores
  matchType: 'ai',
}));

export const mockLowScoreResults: SearchResult[] = mockKBEntries.map((entry, index) => ({
  entry,
  score: 30 + index, // Low scores
  matchType: 'fuzzy',
}));