/**
 * Test Utilities for KB Components
 *
 * Shared utilities, mocks, and helpers for testing KB management components.
 * Provides consistent test data, mock implementations, and helper functions.
 *
 * @author Swarm Architecture Team
 * @version 1.0.0
 */

import React from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { KnowledgeDB, KBEntry } from '../../../database/KnowledgeDB';
import { BatchOperationsService } from '../../../services/BatchOperationsService';
import { VersionControlService } from '../../../services/VersionControlService';

// ========================
// Test Data
// ========================

export const mockKBEntries: KBEntry[] = [
  {
    id: 'entry-1',
    title: 'VSAM Status 35 - File Not Found',
    problem: 'Job abends with VSAM status code 35. The program cannot open the VSAM file.',
    solution: '1. Verify the dataset exists\n2. Check DD statement\n3. Verify RACF permissions\n4. Check catalog',
    category: 'VSAM',
    tags: ['vsam', 'status-35', 'file-not-found', 'catalog'],
    created_at: new Date('2024-01-01T10:00:00Z'),
    updated_at: new Date('2024-01-01T10:00:00Z'),
    usage_count: 25,
    success_count: 22,
    failure_count: 3,
  },
  {
    id: 'entry-2',
    title: 'S0C7 Data Exception in COBOL',
    problem: 'Program abends with S0C7 data exception during arithmetic operations.',
    solution: '1. Check for non-numeric data\n2. Initialize working storage\n3. Add NUMERIC test\n4. Use debugging',
    category: 'Batch',
    tags: ['s0c7', 'data-exception', 'cobol', 'arithmetic'],
    created_at: new Date('2024-01-02T14:30:00Z'),
    updated_at: new Date('2024-01-02T14:30:00Z'),
    usage_count: 18,
    success_count: 16,
    failure_count: 2,
  },
  {
    id: 'entry-3',
    title: 'JCL Dataset Not Found (IEF212I)',
    problem: 'JCL job fails with IEF212I dataset not found error.',
    solution: '1. Verify dataset name\n2. Check generation for GDG\n3. Verify UNIT and VOL\n4. Check quotes',
    category: 'JCL',
    tags: ['jcl', 'dataset', 'not-found', 'ief212i'],
    created_at: new Date('2024-01-03T09:15:00Z'),
    updated_at: new Date('2024-01-03T09:15:00Z'),
    usage_count: 12,
    success_count: 11,
    failure_count: 1,
  },
  {
    id: 'entry-4',
    title: 'DB2 SQLCODE -904 Resource Unavailable',
    problem: 'Application receives SQLCODE -904 indicating resource unavailable.',
    solution: '1. Check database status\n2. Verify tablespace\n3. Check for locks\n4. Contact DBA if needed',
    category: 'DB2',
    tags: ['db2', 'sqlcode', '-904', 'resource', 'unavailable'],
    created_at: new Date('2024-01-04T16:45:00Z'),
    updated_at: new Date('2024-01-04T16:45:00Z'),
    usage_count: 8,
    success_count: 6,
    failure_count: 2,
  },
];

export const mockStats = {
  totalEntries: mockKBEntries.length,
  totalUsage: mockKBEntries.reduce((sum, entry) => sum + entry.usage_count, 0),
  averageSuccessRate: 0.87,
  categoryCounts: {
    VSAM: 1,
    Batch: 1,
    JCL: 1,
    DB2: 1,
  },
  recentActivity: [
    {
      id: 'activity-1',
      type: 'entry_created',
      timestamp: new Date('2024-01-04T16:45:00Z'),
      details: { entry_id: 'entry-4', title: 'DB2 SQLCODE -904' },
    },
  ],
};

// ========================
// Mock Database
// ========================

export const createMockDB = (): jest.Mocked<KnowledgeDB> => ({
  search: jest.fn().mockResolvedValue([]),
  addEntry: jest.fn().mockResolvedValue('new-entry-id'),
  updateEntry: jest.fn().mockResolvedValue(undefined),
  deleteEntry: jest.fn().mockResolvedValue(undefined),
  duplicateEntry: jest.fn().mockResolvedValue('duplicated-entry-id'),
  getEntry: jest.fn().mockResolvedValue(null),
  getAllEntries: jest.fn().mockResolvedValue(mockKBEntries),
  getStats: jest.fn().mockResolvedValue(mockStats),
  exportEntries: jest.fn().mockResolvedValue('exported-data'),
  importEntries: jest.fn().mockResolvedValue({ success: true, count: 5 }),
  close: jest.fn(),
  // Add any other methods that KnowledgeDB might have
} as any);

// ========================
// Mock Services
// ========================

export const createMockBatchService = (): jest.Mocked<BatchOperationsService> => ({
  batchUpdate: jest.fn().mockResolvedValue({
    success: true,
    processed: 3,
    failed: 0,
    duration: 1500,
    progress: { percentComplete: 100, processed: 3, total: 3, currentOperation: 'Update complete' },
  }),
  batchDelete: jest.fn().mockResolvedValue({
    success: true,
    processed: 2,
    failed: 0,
    duration: 800,
    progress: { percentComplete: 100, processed: 2, total: 2, currentOperation: 'Delete complete' },
  }),
  batchDuplicate: jest.fn().mockResolvedValue({
    success: true,
    processed: 1,
    failed: 0,
    duration: 1200,
    duplicatedIds: ['entry-5'],
    progress: { percentComplete: 100, processed: 1, total: 1, currentOperation: 'Duplicate complete' },
  }),
  batchExport: jest.fn().mockResolvedValue({
    success: true,
    processed: 4,
    failed: 0,
    duration: 2000,
    exportPath: '/tmp/kb-export.json',
    fileSize: 1024,
    progress: { percentComplete: 100, processed: 4, total: 4, currentOperation: 'Export complete' },
  }),
  getActiveOperations: jest.fn().mockReturnValue([]),
  cancelOperation: jest.fn().mockResolvedValue(true),
  on: jest.fn(),
  off: jest.fn(),
  emit: jest.fn(),
} as any);

export const createMockVersionService = (): jest.Mocked<VersionControlService> => ({
  createVersion: jest.fn().mockResolvedValue({
    ...mockKBEntries[0],
    version: 2,
    editor_name: 'Test User',
    change_summary: 'Updated entry',
  }),
  getVersion: jest.fn().mockResolvedValue(null),
  getCurrentVersion: jest.fn().mockResolvedValue(1),
  getVersionHistory: jest.fn().mockResolvedValue({
    entry_id: 'entry-1',
    current_version: 1,
    versions: [],
    changes: [],
  }),
  compareVersions: jest.fn().mockResolvedValue({
    differences: [],
    similarity_score: 0.95,
    change_summary: 'Minor changes',
    impact_assessment: 'low',
  }),
  rollbackToVersion: jest.fn().mockResolvedValue({
    ...mockKBEntries[0],
    version: 3,
  }),
  mergeVersions: jest.fn().mockResolvedValue({
    success: true,
    merged_entry: mockKBEntries[0],
    conflicts: [],
  }),
  getRecentChanges: jest.fn().mockResolvedValue([]),
  cleanup: jest.fn().mockResolvedValue(undefined),
  dispose: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
  emit: jest.fn(),
} as any);

// ========================
// Mock Hooks
// ========================

export const mockUseKBData = {
  entries: mockKBEntries,
  searchResults: [],
  stats: mockStats,
  loading: false,
  error: null,
  searchEntries: jest.fn(),
  addEntry: jest.fn().mockResolvedValue('new-entry-id'),
  updateEntry: jest.fn().mockResolvedValue(undefined),
  deleteEntry: jest.fn().mockResolvedValue(undefined),
  duplicateEntry: jest.fn().mockResolvedValue('duplicate-id'),
  refresh: jest.fn(),
  exportEntries: jest.fn().mockResolvedValue('export-data'),
  importEntries: jest.fn().mockResolvedValue({ success: true, count: 5 }),
  getSuggestions: jest.fn().mockResolvedValue([]),
};

export const mockUseBatchOperations = {
  operationState: {
    activeOperation: null,
    progress: null,
    isOperating: false,
    error: null,
    lastResult: null,
    operationHistory: [],
  },
  selectionState: {
    selectedIds: new Set<string>(),
    allSelected: false,
    someSelected: false,
    selectedCount: 0,
  },
  selectedEntries: [],
  canBatchEdit: false,
  canBatchDelete: false,
  canBatchExport: false,
  selectAll: jest.fn(),
  selectNone: jest.fn(),
  selectInvert: jest.fn(),
  selectEntries: jest.fn(),
  toggleSelection: jest.fn(),
  isSelected: jest.fn().mockReturnValue(false),
  performBatchUpdate: jest.fn().mockResolvedValue({ success: true }),
  performBatchDelete: jest.fn().mockResolvedValue({ success: true }),
  performBatchDuplicate: jest.fn().mockResolvedValue({ success: true }),
  performBatchExport: jest.fn().mockResolvedValue({ success: true }),
  performBatchOperation: jest.fn(),
  cancelCurrentOperation: jest.fn().mockResolvedValue(true),
  clearError: jest.fn(),
  clearHistory: jest.fn(),
};

// ========================
// Test Providers
// ========================

interface TestProvidersProps {
  children: React.ReactNode;
  db?: KnowledgeDB;
  batchService?: BatchOperationsService;
  versionService?: VersionControlService;
}

export const TestProviders: React.FC<TestProvidersProps> = ({
  children,
  db = createMockDB(),
  batchService = createMockBatchService(),
  versionService = createMockVersionService(),
}) => {
  // Provide context or state as needed
  return <>{children}</>;
};

// ========================
// Custom Render Function
// ========================

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  db?: KnowledgeDB;
  batchService?: BatchOperationsService;
  versionService?: VersionControlService;
}

export const renderWithProviders = (
  ui: React.ReactElement,
  options: CustomRenderOptions = {}
) => {
  const { db, batchService, versionService, ...renderOptions } = options;

  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <TestProviders
      db={db}
      batchService={batchService}
      versionService={versionService}
    >
      {children}
    </TestProviders>
  );

  return render(ui, { wrapper: Wrapper, ...renderOptions });
};

// ========================
// Test Utilities
// ========================

export const waitForLoadingToFinish = () => {
  return new Promise(resolve => setTimeout(resolve, 0));
};

export const createMockEvent = (type: string, target: Partial<HTMLElement> = {}) => ({
  type,
  target: {
    value: '',
    checked: false,
    ...target,
  },
  preventDefault: jest.fn(),
  stopPropagation: jest.fn(),
});

export const createMockFile = (name: string, content: string, type = 'application/json') => {
  const blob = new Blob([content], { type });
  const file = new File([blob], name, { type });
  return file;
};

// ========================
// Accessibility Helpers
// ========================

export const checkAccessibility = (element: HTMLElement) => {
  // Basic accessibility checks
  const checks = {
    hasAriaLabel: !!element.getAttribute('aria-label'),
    hasAriaDescribedBy: !!element.getAttribute('aria-describedby'),
    hasRole: !!element.getAttribute('role'),
    hasTabIndex: element.hasAttribute('tabindex'),
    isSemanticElement: ['button', 'input', 'select', 'textarea', 'a'].includes(element.tagName.toLowerCase()),
  };

  return checks;
};

export const getAccessibleName = (element: HTMLElement): string => {
  return (
    element.getAttribute('aria-label') ||
    element.getAttribute('aria-labelledby') ||
    element.textContent ||
    element.getAttribute('alt') ||
    element.getAttribute('title') ||
    ''
  );
};

// ========================
// Performance Helpers
// ========================

export const measureRenderTime = async (renderFunction: () => void): Promise<number> => {
  const start = performance.now();
  renderFunction();
  await waitForLoadingToFinish();
  const end = performance.now();
  return end - start;
};

export const createLargeDataset = (count: number): KBEntry[] => {
  return Array.from({ length: count }, (_, i) => ({
    ...mockKBEntries[i % mockKBEntries.length],
    id: `entry-${i + 1}`,
    title: `Entry ${i + 1} - ${mockKBEntries[i % mockKBEntries.length].title}`,
  }));
};

// ========================
// Mock Response Helpers
// ========================

export const createSearchResponse = (entries: KBEntry[] = mockKBEntries, query = '') => ({
  results: entries.map((entry, index) => ({
    entry,
    score: 100 - index * 10,
    matchType: 'fuzzy' as const,
    highlights: query ? [query] : [],
  })),
  totalFound: entries.length,
  searchTime: 250,
  query,
});

export const createVersionHistoryResponse = (entryId: string, versionCount = 3) => ({
  entry_id: entryId,
  current_version: versionCount,
  versions: Array.from({ length: versionCount }, (_, i) => ({
    ...mockKBEntries[0],
    version: versionCount - i,
    change_summary: `Version ${versionCount - i} changes`,
    editor_name: `User ${versionCount - i}`,
    created_at: new Date(Date.now() - i * 86400000), // i days ago
  })),
  changes: Array.from({ length: versionCount }, (_, i) => ({
    id: `change-${versionCount - i}`,
    entry_id: entryId,
    version: versionCount - i,
    change_type: i === versionCount - 1 ? 'create' : 'update',
    timestamp: new Date(Date.now() - i * 86400000),
    editor_name: `User ${versionCount - i}`,
    change_summary: `Version ${versionCount - i} changes`,
  })),
});

// ========================
// Cleanup Helpers
// ========================

export const cleanupMocks = () => {
  jest.clearAllMocks();
  // Clear any global state
  localStorage.clear();
  sessionStorage.clear();
};

// Default export for convenience
export default {
  mockKBEntries,
  mockStats,
  createMockDB,
  createMockBatchService,
  createMockVersionService,
  renderWithProviders,
  waitForLoadingToFinish,
  checkAccessibility,
  measureRenderTime,
  createLargeDataset,
  cleanupMocks,
};