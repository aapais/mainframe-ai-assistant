# Unified Types Architecture Documentation

## Overview

This document describes the unified type system implemented for the Mainframe AI Assistant application. The unified types enable a single table structure to handle both knowledge base entries and incident management entries while maintaining strong TypeScript typing and backward compatibility.

## Architecture Principles

### 1. Single Table Structure
- **Unified Storage**: Both knowledge base and incident entries are stored in a single table
- **Entry Type Discriminator**: Uses `entry_type` field to distinguish between 'knowledge' and 'incident' entries
- **Conditional Fields**: Incident-specific fields are nullable for knowledge entries
- **Strong Typing**: TypeScript discriminated unions ensure type safety at compile time

### 2. Backward Compatibility
- **Legacy API Support**: Existing KB interfaces continue to work unchanged
- **Type Aliases**: Legacy types are aliased to new unified types
- **Migration Path**: Smooth transition from separate tables to unified storage

### 3. Type Safety
- **Discriminated Unions**: Entry type is determined at compile time
- **Type Guards**: Runtime validation functions for type checking
- **Strict Null Checks**: Incident fields are properly typed as optional for knowledge entries

## Type Hierarchy

```typescript
// Base interface with common fields
BaseUnifiedEntry
├── entry_type: 'knowledge' | 'incident'
├── id, title, problem, solution
├── category, tags, timestamps
└── usage tracking fields

// Discriminated union types
UnifiedEntry = KnowledgeBaseEntry | IncidentEntry

KnowledgeBaseEntry extends BaseUnifiedEntry
├── entry_type: 'knowledge'
├── incident fields: undefined
└── kb_metadata?: optional KB-specific data

IncidentEntry extends BaseUnifiedEntry
├── entry_type: 'incident'
├── status, priority, escalation_level
├── SLA and assignment fields
└── incident_metadata?: optional incident-specific data
```

## Key Interfaces

### Core Types

```typescript
// Main discriminated union
type UnifiedEntry = KnowledgeBaseEntry | IncidentEntry;

// Input types for creation
type UnifiedEntryInput =
  | ({ entry_type: 'knowledge' } & KnowledgeEntryInput)
  | ({ entry_type: 'incident' } & IncidentEntryInput);

// Update types
type UnifiedEntryUpdate =
  | ({ entry_type: 'knowledge' } & KnowledgeEntryUpdate)
  | ({ entry_type: 'incident' } & IncidentEntryUpdate);
```

### Type Guards

```typescript
// Runtime type checking
function isIncident(entry: UnifiedEntry): entry is IncidentEntry;
function isKnowledge(entry: UnifiedEntry): entry is KnowledgeBaseEntry;
function isValidIncident(entry: UnifiedEntry): entry is IncidentEntry;
function isValidKnowledge(entry: UnifiedEntry): entry is KnowledgeBaseEntry;
```

### Database Mapping

```typescript
// Database row interface
interface UnifiedEntryRow {
  // Common fields
  id: string;
  entry_type: 'knowledge' | 'incident';

  // Incident fields (nullable for knowledge entries)
  status?: string;
  priority?: string;
  // ... other incident fields
}

// Mapping utilities
function mapRowToUnifiedEntry(row: UnifiedEntryRow): UnifiedEntry;
function mapUnifiedEntryToRow(entry: UnifiedEntry): UnifiedEntryRow;
```

## Service Interfaces

### Unified Storage Service

```typescript
interface IUnifiedStorageService {
  // CRUD operations
  create(entry: UnifiedEntryInput): Promise<string>;
  getById(id: string): Promise<UnifiedEntry | null>;
  update(id: string, updates: UnifiedEntryUpdate): Promise<void>;
  delete(id: string): Promise<void>;

  // Search operations
  search(query: UnifiedSearchQuery): Promise<UnifiedSearchResult[]>;

  // Type-specific operations
  getKnowledgeEntries(): Promise<KnowledgeBaseEntry[]>;
  getIncidentEntries(): Promise<IncidentEntry[]>;
}
```

### Legacy Compatibility Service

```typescript
interface ILegacyKBStorageService {
  // Maintains existing KB API while using unified storage
  addEntry(entry: KBEntryInput): Promise<string>;
  getEntries(): Promise<KnowledgeBaseEntry[]>;
  updateEntry(id: string, updates: Partial<KnowledgeBaseEntry>): Promise<void>;
  deleteEntry(id: string): Promise<void>;
}
```

## Usage Examples

### Creating Entries

```typescript
// Knowledge base entry
const kbEntry: UnifiedEntryInput = {
  entry_type: 'knowledge',
  title: 'JCL Job Debugging',
  problem: 'Job fails with ABEND code',
  solution: 'Check DD statements and JCL syntax',
  category: 'JCL',
  tags: ['debugging', 'abend']
};

// Incident entry
const incidentEntry: UnifiedEntryInput = {
  entry_type: 'incident',
  title: 'Production Database Down',
  problem: 'Database connection timeout',
  category: 'DB2',
  status: 'aberto',
  priority: 'P1',
  escalation_level: 'level_1',
  business_impact: 'critical'
};
```

### Type-Safe Processing

```typescript
function processEntry(entry: UnifiedEntry) {
  // Type discrimination
  if (isIncident(entry)) {
    // TypeScript knows this is IncidentEntry
    console.log(`Incident ${entry.incident_number} has priority ${entry.priority}`);

    // Can access incident-specific fields
    if (entry.sla_deadline && entry.sla_deadline < new Date()) {
      console.log('SLA breach detected!');
    }
  } else if (isKnowledge(entry)) {
    // TypeScript knows this is KnowledgeBaseEntry
    console.log(`KB entry verified: ${entry.kb_metadata?.verified}`);

    // Incident fields are undefined (and TypeScript knows this)
    // entry.status is undefined - no compilation error
  }
}
```

### Search Operations

```typescript
// Unified search across both types
const results = await storageService.search({
  query: 'database connection',
  entry_type: 'both', // or 'knowledge' | 'incident'
  category: 'DB2',

  // KB-specific filters
  verified: true,

  // Incident-specific filters
  status: ['aberto', 'em_tratamento'],
  priority: ['P1', 'P2']
});

// Process results with type safety
results.forEach(result => {
  if (isIncident(result.entry)) {
    console.log(`Incident: ${result.entry.incident_number}`);
  } else {
    console.log(`KB: ${result.entry.title}`);
  }
});
```

## Database Schema Integration

### Unified Table Structure

```sql
CREATE TABLE unified_entries (
  id TEXT PRIMARY KEY,
  entry_type TEXT NOT NULL CHECK(entry_type IN ('knowledge', 'incident')),

  -- Common fields
  title TEXT NOT NULL,
  problem TEXT NOT NULL,
  solution TEXT NOT NULL,
  category TEXT NOT NULL,
  tags TEXT, -- JSON array
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT,
  version INTEGER DEFAULT 1,
  usage_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,

  -- Incident-specific fields (nullable for knowledge entries)
  status TEXT CHECK(status IN ('aberto', 'em_tratamento', 'resolvido', 'fechado', 'reaberto', 'em_revisao')),
  priority TEXT CHECK(priority IN ('P1', 'P2', 'P3', 'P4')),
  assigned_to TEXT,
  escalation_level TEXT CHECK(escalation_level IN ('none', 'level_1', 'level_2', 'level_3')),
  resolution_time INTEGER,
  sla_deadline DATETIME,
  last_status_change DATETIME,
  affected_systems TEXT, -- JSON array
  business_impact TEXT CHECK(business_impact IN ('low', 'medium', 'high', 'critical')),
  customer_impact BOOLEAN,
  reporter TEXT,
  resolver TEXT,
  incident_number TEXT,
  external_ticket_id TEXT,

  -- Metadata fields (JSON)
  kb_metadata TEXT, -- For knowledge entries
  incident_metadata TEXT -- For incident entries
);
```

### Indexes for Performance

```sql
-- Type-specific indexes
CREATE INDEX idx_unified_entries_type ON unified_entries(entry_type, category, created_at DESC);
CREATE INDEX idx_unified_entries_kb ON unified_entries(entry_type, category) WHERE entry_type = 'knowledge';
CREATE INDEX idx_unified_entries_incident_status ON unified_entries(entry_type, status, priority) WHERE entry_type = 'incident';

-- Full-text search
CREATE VIRTUAL TABLE unified_entries_fts USING fts5(
  title, problem, solution, tags,
  content='unified_entries',
  content_rowid='rowid'
);
```

## Migration Strategy

### Phase 1: Type System Implementation ✅
- [x] Create unified type interfaces
- [x] Implement type guards and utilities
- [x] Update service interfaces
- [x] Maintain backward compatibility

### Phase 2: Database Migration (Next)
- [ ] Create unified table structure
- [ ] Migrate existing KB entries
- [ ] Migrate existing incident entries
- [ ] Update database queries

### Phase 3: Service Implementation (Next)
- [ ] Implement unified storage service
- [ ] Update search service for unified entries
- [ ] Implement incident service with unified storage
- [ ] Update UI components to use unified types

### Phase 4: Testing and Validation (Next)
- [ ] Unit tests for all type operations
- [ ] Integration tests for database operations
- [ ] Performance testing with unified table
- [ ] Backward compatibility testing

## Benefits

### 1. Performance Improvements
- **Single Table**: Reduces query complexity and join operations
- **Better Indexing**: Optimized indexes for common query patterns
- **Reduced Memory**: Single table reduces memory overhead

### 2. Development Efficiency
- **Type Safety**: Compile-time checking prevents runtime errors
- **Code Reuse**: Shared operations work across both entry types
- **Simplified APIs**: Single interface for common operations

### 3. Maintenance Benefits
- **Unified Schema**: Single source of truth for entry structure
- **Consistent Validation**: Shared validation logic
- **Easier Extensions**: New entry types can be added easily

### 4. Feature Enablement
- **Cross-Type Search**: Search across knowledge and incidents simultaneously
- **Relationship Mapping**: Link incidents to related knowledge entries
- **Unified Analytics**: Combined reporting and metrics

## Testing Strategy

### Type Safety Tests
```typescript
// Compile-time type checking
const kbEntry: KnowledgeBaseEntry = createKBEntry();
const incident: IncidentEntry = createIncident();

// Runtime type validation
expect(isKnowledge(kbEntry)).toBe(true);
expect(isIncident(incident)).toBe(true);
expect(isIncident(kbEntry)).toBe(false);
```

### Database Mapping Tests
```typescript
// Round-trip testing
const originalEntry = createTestEntry();
const row = mapUnifiedEntryToRow(originalEntry);
const mappedEntry = mapRowToUnifiedEntry(row);
expect(mappedEntry).toEqual(originalEntry);
```

### Service Integration Tests
```typescript
// End-to-end workflow testing
const entryId = await service.create(entryInput);
const retrieved = await service.getById(entryId);
expect(retrieved?.entry_type).toBe(entryInput.entry_type);
```

## Error Handling

### Type Validation Errors
```typescript
interface ValidationError {
  field: string;
  message: string;
  expected_type: string;
  received_type: string;
}

function validateUnifiedEntry(entry: any): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!entry.entry_type || !['knowledge', 'incident'].includes(entry.entry_type)) {
    errors.push({
      field: 'entry_type',
      message: 'Invalid entry type',
      expected_type: 'knowledge | incident',
      received_type: typeof entry.entry_type
    });
  }

  return errors;
}
```

### Database Constraint Errors
```typescript
function handleDatabaseError(error: Error): AppError {
  if (error.message.includes('entry_type')) {
    return {
      type: 'VALIDATION_ERROR',
      message: 'Invalid entry type specified',
      code: 'INVALID_ENTRY_TYPE'
    };
  }

  return {
    type: 'DATABASE_ERROR',
    message: error.message,
    code: 'DB_CONSTRAINT_VIOLATION'
  };
}
```

## Best Practices

### 1. Always Use Type Guards
```typescript
// ✅ Good
if (isIncident(entry)) {
  console.log(entry.incident_number);
}

// ❌ Bad - runtime error possible
console.log((entry as IncidentEntry).incident_number);
```

### 2. Validate Entry Type on Creation
```typescript
// ✅ Good
function createEntry(input: UnifiedEntryInput): Promise<string> {
  if (input.entry_type === 'incident' && !input.status) {
    throw new Error('Status required for incident entries');
  }
  // ... rest of creation logic
}
```

### 3. Use Discriminated Unions for Updates
```typescript
// ✅ Good
const update: UnifiedEntryUpdate = {
  entry_type: 'incident',
  status: 'resolvido',
  resolver: 'tech-team'
};

// ❌ Bad - type mismatch possible
const badUpdate = {
  status: 'resolvido',
  kb_metadata: { verified: true } // Wrong field for incident
};
```

### 4. Leverage TypeScript Strict Mode
```typescript
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "strictNullChecks": true,
    "noImplicitAny": true,
    "exactOptionalPropertyTypes": true
  }
}
```

## Conclusion

The unified types architecture provides a robust foundation for handling both knowledge base entries and incident management within a single, type-safe system. By leveraging TypeScript's discriminated unions and careful interface design, we achieve:

- **Type Safety**: Compile-time verification of entry types and field access
- **Performance**: Single table structure with optimized queries
- **Maintainability**: Shared code and consistent patterns
- **Extensibility**: Easy addition of new entry types in the future
- **Backward Compatibility**: Existing code continues to work unchanged

This architecture positions the application for future growth while maintaining the stability and reliability required for production use.