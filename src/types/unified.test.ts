/**
 * Type validation tests for unified entry system
 * Ensures type safety and compilation correctness
 */

import {
  UnifiedEntry,
  UnifiedEntryInput,
  UnifiedEntryUpdate,
  UnifiedSearchQuery,
  UnifiedSearchResult,
  KnowledgeBaseEntry,
  IncidentEntry,
  isIncident,
  isKnowledge,
  isValidIncident,
  isValidKnowledge,
  mapRowToUnifiedEntry,
  mapUnifiedEntryToRow,
  UnifiedEntryRow,
  KnowledgeEntryInput,
  IncidentEntryInput,
} from './unified';

// ===========================
// TYPE VALIDATION TESTS
// ===========================

// Test creating knowledge base entry
const kbInput: KnowledgeEntryInput = {
  title: 'Test KB Entry',
  problem: 'Test problem description',
  solution: 'Test solution description',
  category: 'JCL',
  tags: ['test', 'validation'],
  created_by: 'test-user',
  kb_metadata: {
    verified: true,
    confidence_score: 0.95,
  },
};

// Test creating incident entry
const incidentInput: IncidentEntryInput = {
  title: 'Test Incident',
  problem: 'Test incident description',
  solution: 'Test resolution',
  category: 'DB2',
  tags: ['incident', 'test'],
  created_by: 'test-user',
  status: 'aberto',
  priority: 'P1',
  escalation_level: 'none',
  business_impact: 'high',
  customer_impact: true,
  reporter: 'user123',
  incident_metadata: {
    severity: 'critical',
    sla_breach: false,
  },
};

// Test unified input with discriminated union
const unifiedKBInput: UnifiedEntryInput = {
  entry_type: 'knowledge',
  ...kbInput,
};

const unifiedIncidentInput: UnifiedEntryInput = {
  entry_type: 'incident',
  ...incidentInput,
};

// Test knowledge base entry structure
const mockKBEntry: KnowledgeBaseEntry = {
  id: 'kb_123',
  entry_type: 'knowledge',
  title: 'Test Knowledge Entry',
  problem: 'Sample problem',
  solution: 'Sample solution',
  category: 'VSAM',
  tags: ['test'],
  created_at: new Date(),
  updated_at: new Date(),
  created_by: 'user',
  version: 1,
  usage_count: 5,
  success_count: 4,
  failure_count: 1,
  // Incident fields are explicitly undefined
  status: undefined,
  priority: undefined,
  assigned_to: undefined,
  escalation_level: undefined,
  kb_metadata: {
    verified: true,
    verification_date: new Date(),
    verified_by: 'admin',
  },
};

// Test incident entry structure
const mockIncidentEntry: IncidentEntry = {
  id: 'inc_456',
  entry_type: 'incident',
  title: 'Test Incident Entry',
  problem: 'Critical system issue',
  solution: 'Applied hotfix',
  category: 'DB2',
  tags: ['critical', 'resolved'],
  created_at: new Date(),
  updated_at: new Date(),
  created_by: 'user',
  version: 1,
  usage_count: 2,
  success_count: 1,
  failure_count: 0,
  // Incident-specific fields
  status: 'resolvido',
  priority: 'P1',
  assigned_to: 'tech-lead',
  escalation_level: 'level_1',
  resolution_time: 120,
  sla_deadline: new Date(),
  last_status_change: new Date(),
  affected_systems: ['prod-db', 'app-server'],
  business_impact: 'critical',
  customer_impact: true,
  reporter: 'user123',
  resolver: 'tech-lead',
  incident_number: 'INC-2024-001',
  external_ticket_id: 'JIRA-12345',
  incident_metadata: {
    severity: 'critical',
    root_cause: 'Database connection pool exhausted',
    resolution_type: 'fixed',
    escalation_count: 1,
    reopen_count: 0,
    sla_breach: false,
    related_kb_entries: ['kb_123'],
  },
};

// Test unified entry array
const unifiedEntries: UnifiedEntry[] = [mockKBEntry, mockIncidentEntry];

// ===========================
// TYPE GUARD TESTS
// ===========================

function testTypeGuards() {
  // Test type guards work correctly
  unifiedEntries.forEach(entry => {
    if (isIncident(entry)) {
      // TypeScript should know this is IncidentEntry
      console.log(`Incident ${entry.incident_number} has status: ${entry.status}`);
      console.log(`Priority: ${entry.priority}, SLA: ${entry.sla_deadline}`);
    } else if (isKnowledge(entry)) {
      // TypeScript should know this is KnowledgeBaseEntry
      console.log(`Knowledge entry verified: ${entry.kb_metadata?.verified}`);
      // These should be undefined for knowledge entries
      console.log(`Status should be undefined: ${entry.status}`);
    }
  });

  // Test validation guards
  if (isValidIncident(mockIncidentEntry)) {
    console.log('Valid incident entry');
  }

  if (isValidKnowledge(mockKBEntry)) {
    console.log('Valid knowledge entry');
  }
}

// ===========================
// SEARCH QUERY TESTS
// ===========================

const searchQuery: UnifiedSearchQuery = {
  query: 'database connection',
  entry_type: 'both',
  category: 'DB2',
  tags: ['critical'],
  status: ['aberto', 'em_tratamento'],
  priority: ['P1', 'P2'],
  verified: true,
  useAI: true,
  limit: 10,
  created_after: new Date('2024-01-01'),
};

const searchResult: UnifiedSearchResult = {
  entry: mockIncidentEntry,
  score: 0.95,
  matchType: 'ai',
  highlights: ['database', 'connection'],
  explanation: 'Matches incident involving database connection issues',
  context: {
    sla_status: 'on_time',
    urgency_score: 8.5,
  },
};

// ===========================
// DATABASE MAPPING TESTS
// ===========================

function testDatabaseMapping() {
  // Test database row structure
  const mockRow: UnifiedEntryRow = {
    id: 'test_123',
    title: 'Test Entry',
    problem: 'Test problem',
    solution: 'Test solution',
    category: 'JCL',
    tags: '["test", "validation"]',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    created_by: 'test-user',
    version: 1,
    usage_count: 0,
    success_count: 0,
    failure_count: 0,
    entry_type: 'knowledge',
    kb_metadata: '{"verified": true}',
  };

  // Test row to entry mapping
  const mappedEntry = mapRowToUnifiedEntry(mockRow);
  console.log('Mapped entry type:', mappedEntry.entry_type);

  // Test entry to row mapping
  const mappedRow = mapUnifiedEntryToRow(mockKBEntry);
  console.log('Mapped row type:', mappedRow.entry_type);
}

// ===========================
// UPDATE OPERATIONS TESTS
// ===========================

const kbUpdate: UnifiedEntryUpdate = {
  entry_type: 'knowledge',
  title: 'Updated KB Entry',
  solution: 'Updated solution',
  tags: ['updated'],
  kb_metadata: {
    verified: true,
    verification_date: new Date(),
  },
};

const incidentUpdate: UnifiedEntryUpdate = {
  entry_type: 'incident',
  status: 'resolvido',
  solution: 'Issue resolved',
  resolver: 'tech-team',
  incident_metadata: {
    resolution_type: 'fixed',
  },
};

// ===========================
// COMPILATION TEST
// ===========================

export function validateUnifiedTypes(): boolean {
  try {
    testTypeGuards();
    testDatabaseMapping();

    // Verify all interfaces compile correctly
    const _kb: KnowledgeBaseEntry = mockKBEntry;
    const _incident: IncidentEntry = mockIncidentEntry;
    const _unified: UnifiedEntry[] = [_kb, _incident];
    const _query: UnifiedSearchQuery = searchQuery;
    const _result: UnifiedSearchResult = searchResult;

    console.log('All unified types compiled successfully');
    return true;
  } catch (error) {
    console.error('Type compilation failed:', error);
    return false;
  }
}

// Export test utilities for use in other files
export {
  mockKBEntry,
  mockIncidentEntry,
  searchQuery,
  searchResult,
  testTypeGuards,
  testDatabaseMapping,
};
