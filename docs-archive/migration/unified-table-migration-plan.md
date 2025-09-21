# Unified Knowledge Base & Incident Management Migration Plan

## Executive Summary

This document outlines the comprehensive migration strategy to unify the `kb_entries` and `incidents` tables into a single `unified_entries` table. This consolidation will improve data consistency, reduce code complexity, and provide a more cohesive management interface while maintaining all existing functionality.

## Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [Unified Schema Design](#unified-schema-design)
3. [Migration Strategy](#migration-strategy)
4. [Backward Compatibility](#backward-compatibility)
5. [Rollback Strategy](#rollback-strategy)
6. [Risk Assessment](#risk-assessment)
7. [Testing Strategy](#testing-strategy)
8. [Breaking Changes](#breaking-changes)
9. [Implementation Timeline](#implementation-timeline)

## Current State Analysis

### KB Entries Table Structure
- **Primary Key**: `id` (TEXT)
- **Core Fields**: `title`, `problem`, `solution`, `category`, `severity`
- **Usage Metrics**: `usage_count`, `success_count`, `failure_count`, `last_used`
- **Metadata**: `created_at`, `updated_at`, `created_by`, `archived`
- **Features**: Full-text search (FTS5), tagging system, audit logging

### Incidents Table Structure
- **Primary Key**: `id` (TEXT)
- **Core Fields**: `title`, `description`, `category`, `severity`, `status`, `priority`
- **Assignment**: `assigned_team`, `assigned_to`, `reporter`
- **Resolution**: `resolution`, `resolution_type`, `root_cause`
- **Time Tracking**: Complex datetime fields for MTTR calculations
- **SLA**: Breach tracking, target times
- **Analytics**: Escalation counts, reopen counts, AI processing
- **Features**: Relationship tracking, comments system, automation rules

### Key Overlaps and Differences

**Overlaps:**
- `title`, `category`, `severity` (similar purpose)
- `created_at`, `updated_at` (common timestamps)
- `archived` status management
- Tag-based categorization

**Major Differences:**
- Incidents have workflow states, KB entries are static
- Incidents have assignment/team management
- Incidents have SLA and time tracking
- Incidents have complex relationship tracking
- KB entries have usage metrics and success tracking

## Unified Schema Design

### Primary Unified Table: `unified_entries`

```sql
-- ===== UNIFIED ENTRIES TABLE =====
CREATE TABLE unified_entries (
    -- Primary identification
    id TEXT PRIMARY KEY,
    entry_type TEXT NOT NULL CHECK(entry_type IN ('knowledge', 'incident')),

    -- Common core fields
    title TEXT NOT NULL CHECK(length(title) >= 3 AND length(title) <= 255),
    description TEXT NOT NULL CHECK(length(description) >= 10 AND length(description) <= 10000),
    category TEXT NOT NULL CHECK(category IN ('JCL', 'VSAM', 'DB2', 'Batch', 'Functional', 'CICS', 'IMS', 'Security', 'Network', 'Hardware', 'Software', 'Other')),
    severity TEXT NOT NULL DEFAULT 'medium' CHECK(severity IN ('critical', 'high', 'medium', 'low')),

    -- Knowledge Base specific fields (NULL for incidents)
    problem TEXT, -- KB: separate problem field, Incidents: use description
    solution TEXT, -- KB: solution field, Incidents: resolution field
    usage_count INTEGER DEFAULT 0 CHECK(usage_count >= 0),
    success_count INTEGER DEFAULT 0 CHECK(success_count >= 0),
    failure_count INTEGER DEFAULT 0 CHECK(failure_count >= 0),
    last_used DATETIME,
    confidence_score REAL CHECK(confidence_score >= 0 AND confidence_score <= 100),

    -- Incident specific fields (NULL for KB entries)
    status TEXT CHECK(status IN ('aberto', 'em_tratamento', 'resolvido', 'fechado', 'reaberto', 'em_revisao')),
    priority INTEGER CHECK(priority >= 1 AND priority <= 5),
    assigned_team TEXT,
    assigned_to TEXT,
    reporter TEXT,
    resolution TEXT, -- Unified with KB solution for incidents
    resolution_type TEXT CHECK(resolution_type IN ('fixed', 'workaround', 'duplicate', 'cannot_reproduce', 'invalid', 'wont_fix')),
    root_cause TEXT,

    -- Time tracking (enhanced for both types)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by TEXT DEFAULT 'system' CHECK(length(created_by) <= 100),
    first_response_at DATETIME,
    assigned_at DATETIME,
    in_progress_at DATETIME,
    resolved_at DATETIME,
    closed_at DATETIME,

    -- SLA tracking (incidents only)
    sla_breach BOOLEAN DEFAULT FALSE,
    sla_target_response_hours INTEGER,
    sla_target_resolution_hours INTEGER,
    resolution_time_hours REAL,
    response_time_hours REAL,

    -- Analytics (both types)
    escalation_count INTEGER DEFAULT 0,
    reopen_count INTEGER DEFAULT 0,
    related_entries TEXT, -- JSON array of related entry IDs

    -- AI and automation
    ai_suggested_category TEXT,
    ai_confidence_score REAL,
    ai_processed BOOLEAN DEFAULT FALSE,

    -- Metadata
    tags TEXT, -- JSON array of tags
    custom_fields TEXT, -- JSON for extensible custom fields
    attachments TEXT, -- JSON array of attachment info
    archived BOOLEAN DEFAULT FALSE,
    checksum TEXT -- For change detection
);
```

### Supporting Tables (Adapted)

```sql
-- ===== UNIFIED TAGS TABLE =====
CREATE TABLE unified_tags (
    entry_id TEXT NOT NULL,
    tag TEXT NOT NULL CHECK(length(tag) >= 1 AND length(tag) <= 50),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (entry_id, tag),
    FOREIGN KEY (entry_id) REFERENCES unified_entries(id) ON DELETE CASCADE
);

-- ===== UNIFIED RELATIONSHIPS TABLE =====
CREATE TABLE unified_relationships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_entry_id TEXT NOT NULL,
    target_entry_id TEXT NOT NULL,
    relationship_type TEXT NOT NULL CHECK(relationship_type IN ('related', 'duplicate', 'blocks', 'blocked_by', 'parent', 'child', 'caused_by', 'causes', 'superseded', 'prerequisite')),
    similarity_score REAL DEFAULT 0.0 CHECK(similarity_score >= 0 AND similarity_score <= 1),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,
    notes TEXT,

    FOREIGN KEY (source_entry_id) REFERENCES unified_entries(id) ON DELETE CASCADE,
    FOREIGN KEY (target_entry_id) REFERENCES unified_entries(id) ON DELETE CASCADE,
    UNIQUE(source_entry_id, target_entry_id, relationship_type)
);

-- ===== UNIFIED COMMENTS/UPDATES TABLE =====
CREATE TABLE unified_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entry_id TEXT NOT NULL,
    comment_type TEXT DEFAULT 'comment' CHECK(comment_type IN ('comment', 'status_change', 'assignment', 'escalation', 'resolution', 'usage_feedback')),
    content TEXT NOT NULL,
    author TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT FALSE,
    rating INTEGER CHECK(rating >= 1 AND rating <= 5), -- For KB feedback
    successful BOOLEAN, -- For KB usage feedback
    resolution_time INTEGER, -- For KB feedback
    metadata TEXT, -- JSON for additional context
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (entry_id) REFERENCES unified_entries(id) ON DELETE CASCADE
);

-- ===== UNIFIED USAGE METRICS TABLE =====
CREATE TABLE unified_usage_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entry_id TEXT NOT NULL,
    action TEXT NOT NULL CHECK(action IN (
        'view', 'copy', 'rate_success', 'rate_failure', 'export', 'print', 'share',
        'create', 'update', 'delete', 'assign', 'status_change', 'escalate', 'resolve'
    )),
    user_id TEXT CHECK(length(user_id) <= 100),
    session_id TEXT CHECK(length(session_id) <= 100),
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    metadata TEXT, -- JSON blob for additional context

    FOREIGN KEY (entry_id) REFERENCES unified_entries(id) ON DELETE CASCADE
);

-- ===== UNIFIED FTS5 SEARCH TABLE =====
CREATE VIRTUAL TABLE unified_fts USING fts5(
    id UNINDEXED,
    entry_type UNINDEXED,
    title,
    description,
    problem,
    solution,
    category UNINDEXED,
    tags,
    tokenize = 'porter unicode61',
    content = 'unified_entries',
    content_rowid = 'rowid'
);
```

## Migration Strategy

### Phase 1: Schema Preparation (1-2 days)

1. **Create Migration Tables**
   ```sql
   -- Create unified schema in parallel
   CREATE TABLE unified_entries_staging AS SELECT ... ;
   CREATE TABLE unified_tags_staging AS SELECT ... ;
   ```

2. **Implement Data Transformation Functions**
   ```sql
   -- Function to convert KB entry to unified format
   CREATE TEMP VIEW kb_to_unified AS
   SELECT
       id,
       'knowledge' as entry_type,
       title,
       COALESCE(problem || '\n\n' || solution, problem) as description,
       problem,
       solution,
       category,
       severity,
       NULL as status,
       NULL as priority,
       -- ... map all fields
   FROM kb_entries;

   -- Function to convert incident to unified format
   CREATE TEMP VIEW incident_to_unified AS
   SELECT
       id,
       'incident' as entry_type,
       title,
       description,
       NULL as problem,
       resolution as solution,
       category,
       severity,
       status,
       priority,
       -- ... map all fields
   FROM incidents;
   ```

### Phase 2: Data Migration (2-3 hours)

1. **Backup Current Database**
   ```bash
   sqlite3 kb-assistant.db ".backup backup_pre_migration_$(date +%Y%m%d_%H%M%S).db"
   ```

2. **Transform and Insert Data**
   ```sql
   -- Insert KB entries
   INSERT INTO unified_entries_staging
   SELECT * FROM kb_to_unified;

   -- Insert incidents
   INSERT INTO unified_entries_staging
   SELECT * FROM incident_to_unified;

   -- Migrate tags
   INSERT INTO unified_tags_staging (entry_id, tag, created_at)
   SELECT entry_id, tag, created_at FROM kb_tags
   UNION ALL
   SELECT incident_id, tag, created_at FROM incident_tags_derived;
   ```

3. **Validate Data Integrity**
   ```sql
   -- Verify row counts
   SELECT
       (SELECT COUNT(*) FROM kb_entries) + (SELECT COUNT(*) FROM incidents) as expected,
       (SELECT COUNT(*) FROM unified_entries_staging) as actual;

   -- Verify no data loss
   SELECT entry_type, COUNT(*) FROM unified_entries_staging GROUP BY entry_type;
   ```

### Phase 3: Application Updates (1-2 weeks)

1. **Update Type Definitions**
   ```typescript
   interface UnifiedEntry {
     id: string;
     entryType: 'knowledge' | 'incident';
     title: string;
     description: string;
     // ... unified fields
   }
   ```

2. **Create Abstraction Layer**
   ```typescript
   class UnifiedEntryService {
     async getKnowledgeEntries(): Promise<KnowledgeEntry[]> {
       return this.query("SELECT * FROM unified_entries WHERE entry_type = 'knowledge'")
         .map(row => this.mapToKnowledgeEntry(row));
     }

     async getIncidents(): Promise<Incident[]> {
       return this.query("SELECT * FROM unified_entries WHERE entry_type = 'incident'")
         .map(row => this.mapToIncident(row));
     }
   }
   ```

3. **Update UI Components**
   - Create unified entry list component
   - Update search to handle both types
   - Maintain separate detail views with type-specific fields

### Phase 4: Schema Switch (1 day)

1. **Atomic Schema Replacement**
   ```sql
   BEGIN TRANSACTION;

   -- Rename old tables
   ALTER TABLE kb_entries RENAME TO kb_entries_backup;
   ALTER TABLE incidents RENAME TO incidents_backup;

   -- Activate new tables
   ALTER TABLE unified_entries_staging RENAME TO unified_entries;
   ALTER TABLE unified_tags_staging RENAME TO unified_tags;

   -- Update indexes and triggers
   -- ... create all indexes and triggers

   COMMIT;
   ```

2. **Update Application Configuration**
   - Update database connection strings
   - Deploy updated application code
   - Run smoke tests

### Phase 5: Cleanup (1 week later)

1. **Monitor for Issues**
2. **Performance Validation**
3. **Remove Backup Tables** (if all tests pass)

## Backward Compatibility

### API Compatibility Layer

```typescript
// Maintain existing API interfaces
class LegacyKBService {
  private unifiedService: UnifiedEntryService;

  async getKBEntries(): Promise<KBEntry[]> {
    return this.unifiedService.getKnowledgeEntries();
  }

  async createKBEntry(entry: CreateKBEntry): Promise<KBEntry> {
    return this.unifiedService.createEntry({
      ...entry,
      entryType: 'knowledge'
    });
  }
}

class LegacyIncidentService {
  private unifiedService: UnifiedEntryService;

  async getIncidents(): Promise<Incident[]> {
    return this.unifiedService.getIncidents();
  }

  async createIncident(incident: CreateIncident): Promise<Incident> {
    return this.unifiedService.createEntry({
      ...incident,
      entryType: 'incident'
    });
  }
}
```

### Database Views for Legacy Compatibility

```sql
-- Legacy KB entries view
CREATE VIEW kb_entries AS
SELECT
    id,
    title,
    problem,
    solution,
    category,
    severity,
    created_at,
    updated_at,
    created_by,
    usage_count,
    success_count,
    failure_count,
    last_used,
    archived,
    confidence_score as confidence_score
FROM unified_entries
WHERE entry_type = 'knowledge';

-- Legacy incidents view
CREATE VIEW incidents AS
SELECT
    id,
    title,
    description,
    category,
    severity,
    status,
    priority,
    assigned_team,
    assigned_to,
    reporter,
    resolution,
    resolution_type,
    root_cause,
    created_at,
    updated_at,
    -- ... all incident-specific fields
FROM unified_entries
WHERE entry_type = 'incident';
```

## Rollback Strategy

### Immediate Rollback (< 1 hour after migration)

```sql
-- Emergency rollback procedure
BEGIN TRANSACTION;

-- Restore original tables
ALTER TABLE unified_entries RENAME TO unified_entries_failed;
ALTER TABLE kb_entries_backup RENAME TO kb_entries;
ALTER TABLE incidents_backup RENAME TO incidents;

-- Restore original indexes and triggers
-- ... restore all original database objects

COMMIT;
```

### Data Recovery Rollback

```sql
-- Extract data back to original tables if needed
INSERT INTO kb_entries
SELECT
    id, title, problem, solution, category, severity,
    created_at, updated_at, created_by, usage_count,
    success_count, failure_count, last_used, archived
FROM unified_entries
WHERE entry_type = 'knowledge';

INSERT INTO incidents
SELECT
    id, title, description, category, severity, status,
    priority, assigned_team, assigned_to, reporter,
    resolution, resolution_type, root_cause,
    created_at, updated_at, -- ... all fields
FROM unified_entries
WHERE entry_type = 'incident';
```

### Application Rollback

1. **Code Rollback**: Revert to previous application version
2. **Configuration Rollback**: Restore original database connection
3. **Dependency Rollback**: Restore service dependencies

## Risk Assessment

### High Risk (Probability: Medium, Impact: High)

1. **Data Loss During Migration**
   - **Mitigation**: Multiple backups, staged migration, validation checks
   - **Contingency**: Immediate rollback procedures

2. **Performance Degradation**
   - **Mitigation**: Index optimization, query analysis, load testing
   - **Contingency**: Performance monitoring, query optimization

3. **Application Downtime**
   - **Mitigation**: Scheduled maintenance, atomic operations, quick rollback
   - **Contingency**: Communication plan, extended maintenance window

### Medium Risk (Probability: Medium, Impact: Medium)

1. **Legacy Code Compatibility Issues**
   - **Mitigation**: Comprehensive testing, gradual rollout
   - **Contingency**: Hotfix deployment capability

2. **Search Functionality Disruption**
   - **Mitigation**: FTS5 rebuild, search validation tests
   - **Contingency**: Fallback search mechanisms

3. **Third-party Integration Failures**
   - **Mitigation**: Integration testing, API compatibility layers
   - **Contingency**: Service isolation, error handling

### Low Risk (Probability: Low, Impact: Low)

1. **Minor UI Inconsistencies**
   - **Mitigation**: UI testing, user acceptance testing
   - **Contingency**: Quick UI fixes

2. **Reporting Discrepancies**
   - **Mitigation**: Report validation, data integrity checks
   - **Contingency**: Report recalculation

## Testing Strategy

### Pre-Migration Testing

1. **Data Validation Testing**
   ```sql
   -- Test data transformation accuracy
   SELECT COUNT(*) FROM kb_entries WHERE id NOT IN (
     SELECT id FROM kb_to_unified_preview
   );
   ```

2. **Performance Baseline Testing**
   ```sql
   -- Measure current query performance
   .timer on
   SELECT * FROM kb_entries WHERE category = 'DB2' LIMIT 10;
   SELECT * FROM incidents WHERE status = 'aberto' LIMIT 10;
   ```

3. **Application Integration Testing**
   - Test all CRUD operations
   - Validate search functionality
   - Check reporting accuracy

### Post-Migration Testing

1. **Data Integrity Verification**
   ```sql
   -- Verify no data loss
   SELECT
     (SELECT COUNT(*) FROM kb_entries_backup) as kb_backup,
     (SELECT COUNT(*) FROM unified_entries WHERE entry_type = 'knowledge') as kb_unified,
     (SELECT COUNT(*) FROM incidents_backup) as inc_backup,
     (SELECT COUNT(*) FROM unified_entries WHERE entry_type = 'incident') as inc_unified;
   ```

2. **Performance Validation**
   ```sql
   -- Compare query performance
   EXPLAIN QUERY PLAN
   SELECT * FROM unified_entries WHERE entry_type = 'knowledge' AND category = 'DB2';
   ```

3. **Functional Testing Checklist**
   - [ ] KB entry creation/update/deletion
   - [ ] Incident creation/update/deletion
   - [ ] Search functionality (both types)
   - [ ] Tag management
   - [ ] Relationship tracking
   - [ ] Comment system
   - [ ] Usage analytics
   - [ ] Export/import functionality
   - [ ] API endpoints
   - [ ] UI responsiveness

### Load Testing

```bash
# Simulate concurrent operations
for i in {1..100}; do
  curl -X POST http://localhost:3000/api/search \
    -d '{"query": "test", "type": "knowledge"}' &
done
wait
```

### User Acceptance Testing

1. **Create test scenarios** for both KB and incident workflows
2. **Train test users** on any UI changes
3. **Document** any usability issues
4. **Validate** business processes end-to-end

## Breaking Changes

### Database Schema Changes

1. **Table Structure Changes**
   - `kb_entries` table replaced with `unified_entries` view
   - `incidents` table replaced with `unified_entries` view
   - New `entry_type` field required for all queries

2. **Field Mapping Changes**
   ```sql
   -- Old KB structure
   kb_entries.problem -> unified_entries.problem
   kb_entries.solution -> unified_entries.solution

   -- Old incident structure
   incidents.description -> unified_entries.description
   incidents.resolution -> unified_entries.solution
   ```

3. **Relationship Changes**
   - `kb_relations` merged into `unified_relationships`
   - `incident_relationships` merged into `unified_relationships`

### API Changes

1. **Endpoint Consolidation**
   ```typescript
   // Old endpoints
   GET /api/kb-entries
   GET /api/incidents

   // New unified endpoint
   GET /api/entries?type=knowledge
   GET /api/entries?type=incident
   ```

2. **Response Format Changes**
   ```typescript
   // Old KB response
   interface KBEntry {
     id: string;
     title: string;
     problem: string;
     solution: string;
   }

   // New unified response
   interface UnifiedEntry {
     id: string;
     entryType: 'knowledge' | 'incident';
     title: string;
     description: string;
     problem?: string; // Only for knowledge entries
     solution?: string;
   }
   ```

### Code Changes

1. **Import Statement Updates**
   ```typescript
   // Old imports
   import { KBEntry, Incident } from './types';

   // New imports
   import { UnifiedEntry, KnowledgeEntry, IncidentEntry } from './types';
   ```

2. **Service Method Changes**
   ```typescript
   // Old methods
   kbService.getEntries()
   incidentService.getIncidents()

   // New methods
   unifiedService.getEntries({ type: 'knowledge' })
   unifiedService.getEntries({ type: 'incident' })
   ```

### UI Component Changes

1. **Component Refactoring**
   - Merge similar list components
   - Update form components for unified fields
   - Modify search components for type filtering

2. **Route Changes**
   ```typescript
   // Old routes
   /knowledge-base
   /incidents

   // New routes (maintain compatibility)
   /entries/knowledge
   /entries/incidents
   ```

## Implementation Timeline

### Week 1: Preparation Phase
- **Day 1-2**: Schema design finalization and review
- **Day 3-4**: Migration script development
- **Day 5**: Backup and staging environment setup

### Week 2: Development Phase
- **Day 1-3**: Application code updates
- **Day 4-5**: Unit and integration testing

### Week 3: Testing Phase
- **Day 1-2**: Performance testing and optimization
- **Day 3-4**: User acceptance testing
- **Day 5**: Final preparation and review

### Week 4: Migration Phase
- **Day 1**: Production backup and final validation
- **Day 2**: Migration execution (scheduled maintenance)
- **Day 3-5**: Post-migration monitoring and issue resolution

### Week 5: Stabilization Phase
- **Day 1-3**: Performance monitoring and optimization
- **Day 4-5**: User feedback collection and minor fixes

## Success Criteria

1. **Zero Data Loss**: All KB entries and incidents successfully migrated
2. **Performance Maintained**: Query performance within 10% of baseline
3. **Functionality Preserved**: All existing features work correctly
4. **User Acceptance**: 95% of users report satisfactory experience
5. **System Stability**: No critical issues for 48 hours post-migration

## Post-Migration Activities

1. **Remove backup tables** after 30 days of stable operation
2. **Update documentation** to reflect new unified structure
3. **Train support staff** on new troubleshooting procedures
4. **Plan future enhancements** leveraging unified structure
5. **Conduct retrospective** to improve future migrations

---

*This migration plan provides a comprehensive roadmap for unifying the knowledge base and incident management systems while maintaining data integrity, system performance, and user experience.*