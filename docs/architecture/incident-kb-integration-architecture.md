# Incident-Knowledge Base Integration Architecture

## Executive Summary

This document outlines the architectural strategy for integrating incident management and knowledge base systems, where resolved incidents automatically become searchable knowledge base entries. This approach eliminates data duplication and creates a unified knowledge ecosystem.

## Current State Analysis

### 1. Database Architecture

The system currently has three database schemas:

#### A. Legacy Schema (`schema.sql`)
- **kb_entries**: Traditional knowledge base entries
- **Tags, relationships, search history**: Support tables
- **Full-text search**: FTS5 implementation
- **AI transparency**: Cost tracking and operation monitoring

#### B. Incident Schema (`incident-schema.sql`)
- **incidents**: Dedicated incident tracking
- **Complex workflow**: Status transitions, SLA tracking, automation
- **Relationships**: incident_relationships, comments, metrics
- **Team performance**: Comprehensive analytics

#### C. Unified Schema (`unified-schema.sql`) ⭐ **RECOMMENDED APPROACH**
- **entries table**: Single table for both incidents and KB entries
- **entry_type**: Distinguishes 'incident' vs 'knowledge'
- **Backward compatibility**: Views for legacy code
- **Unified search**: Single FTS5 index for all content

### 2. Component Architecture

#### Frontend Components
- **Incident Management**: 15 specialized components
  - `IncidentManagementDashboard.tsx`: Main dashboard
  - `IncidentQueue.tsx`: List management with filtering
  - `StatusBadge.tsx`, `PriorityBadge.tsx`: UI indicators
  - Status workflow and management components

- **KB Components**: 2 main components
  - `KBEntryCard.tsx`: Display and interaction
  - `KBEntryDetail.tsx`: Full entry view with actions

#### Service Layer
- **IncidentService.ts**: Full CRUD + workflow operations
- **KnowledgeBaseService.ts**: KB-specific operations
- **Unified approach needed**: Single service for integrated operations

## Integration Strategy: "Resolved Incidents = Knowledge Base"

### 1. Conceptual Model

```
New Issue → Incident (Active) → Resolution → Knowledge Entry (Searchable)
                ↓                    ↓              ↓
             Work Queue         Add Solution    Auto-indexed
```

### 2. Lifecycle Integration

#### Phase 1: Incident Creation
```sql
INSERT INTO entries (
    entry_type = 'incident',
    title, description, category, severity, priority,
    incident_status = 'aberto',
    reporter, created_by
)
```

#### Phase 2: Active Incident Management
- Status: `aberto` → `em_tratamento` → `em_revisao`
- Assignment and workflow tracking
- Comments and updates
- SLA monitoring

#### Phase 3: Resolution → Knowledge Conversion
```sql
UPDATE entries SET
    incident_status = 'resolvido',
    solution = '[resolution details]',
    resolved_at = CURRENT_TIMESTAMP,
    -- Auto-enable KB features
    status = 'active'  -- Makes it searchable as KB
WHERE id = incident_id
```

#### Phase 4: Knowledge Base Enhancement
- Auto-tagging based on incident category and problem
- Relationship detection with similar resolved incidents
- Search indexing with enhanced metadata
- Usage tracking as knowledge resource

### 3. Unified Data Model

#### Core Entry Structure
```sql
CREATE TABLE entries (
    -- Universal fields
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,  -- Problem description
    solution TEXT,              -- Added during resolution

    -- Classification
    entry_type TEXT CHECK(entry_type IN ('incident', 'knowledge')),
    category TEXT NOT NULL,
    severity TEXT NOT NULL,

    -- Incident-specific
    incident_status TEXT,       -- aberto, em_tratamento, resolvido, etc.
    priority INTEGER,
    assigned_to TEXT,
    reporter TEXT,

    -- Knowledge-specific (auto-populated from incidents)
    usage_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    confidence_score REAL,

    -- Timestamps
    created_at DATETIME,
    resolved_at DATETIME,       -- When incident becomes knowledge
    last_used DATETIME
)
```

### 4. Search Integration

#### Unified Search Index
```sql
CREATE VIRTUAL TABLE entries_fts USING fts5(
    id UNINDEXED,
    title,
    description,    -- Problem description
    solution,       -- Resolution details
    tags,
    entry_type UNINDEXED,
    category UNINDEXED
)
```

#### Search Behavior
- **Active Incidents**: Search shows open incidents for assignment/tracking
- **Resolved Incidents**: Automatically included in knowledge search
- **Unified Interface**: Single search box covers both contexts
- **Context Filtering**: `entry_type` filter for specific searches

### 5. User Interface Integration

#### A. Unified Search Interface
```typescript
interface UnifiedSearchProps {
    searchType: 'all' | 'incidents' | 'knowledge';
    showActiveIncidents: boolean;
    onIncidentSelect: (incident: Entry) => void;
    onKnowledgeSelect: (entry: Entry) => void;
}
```

#### B. Incident Resolution Workflow
```typescript
interface ResolutionFormProps {
    incident: Entry;
    onResolve: (solution: string, tags: string[]) => void;
    // Auto-converts to knowledge base entry
}
```

#### C. Knowledge View of Incidents
```typescript
interface KnowledgeViewProps {
    entry: Entry;                    // Can be incident or KB entry
    showIncidentHistory: boolean;    // Show original incident details
    showResolutionPath: boolean;     // Show how problem was solved
}
```

## Implementation Roadmap

### Phase 1: Database Migration (Week 1-2)
1. **Deploy Unified Schema**
   - Migrate existing KB entries to `entries` table
   - Migrate incidents to `entries` table with `entry_type = 'incident'`
   - Create backward compatibility views

2. **Data Migration Scripts**
   ```sql
   -- Migrate KB entries
   INSERT INTO entries (entry_type, title, description, solution, ...)
   SELECT 'knowledge', title, problem, solution, ...
   FROM kb_entries;

   -- Migrate incidents
   INSERT INTO entries (entry_type, title, description, incident_status, ...)
   SELECT 'incident', title, description, status, ...
   FROM incidents;
   ```

### Phase 2: Service Layer Integration (Week 2-3)
1. **Create UnifiedEntryService**
   ```typescript
   class UnifiedEntryService {
       // CRUD operations for both types
       async createIncident(data): Promise<Entry>
       async resolveIncident(id, solution): Promise<Entry>
       async searchEntries(query, filters): Promise<Entry[]>

       // Incident-specific operations
       async updateIncidentStatus(id, status): Promise<void>
       async assignIncident(id, assignee): Promise<void>

       // Knowledge-specific operations
       async rateEntry(id, rating): Promise<void>
       async recordUsage(id, success): Promise<void>
   }
   ```

2. **Update IPC Handlers**
   - Unified handlers for entry operations
   - Maintain backward compatibility
   - Add incident lifecycle methods

### Phase 3: Component Integration (Week 3-4)
1. **Create UnifiedEntryCard Component**
   ```typescript
   interface UnifiedEntryCardProps {
       entry: Entry;
       variant: 'incident' | 'knowledge' | 'auto';
       showWorkflowActions: boolean;
       showKnowledgeActions: boolean;
   }
   ```

2. **Enhance Search Interface**
   - Single search component for both types
   - Smart filtering based on context
   - Unified results display

3. **Resolution Workflow Integration**
   - Resolution form that creates knowledge
   - Auto-tagging and categorization
   - Immediate searchability

### Phase 4: Advanced Features (Week 4-6)
1. **Smart Knowledge Creation**
   - AI-powered solution enhancement
   - Auto-generate tags from incident data
   - Suggest related entries

2. **Analytics Integration**
   - Track incident → knowledge conversion rates
   - Measure knowledge reuse effectiveness
   - SLA impact of available knowledge

3. **Search Enhancement**
   - Semantic search across both types
   - Resolution pattern recognition
   - Predictive incident resolution

## Technical Decisions & Rationale

### 1. Single Table vs Separate Tables
**Decision**: Single `entries` table with `entry_type` field
**Rationale**:
- Eliminates data duplication
- Enables unified search without complex joins
- Simplifies relationship tracking
- Natural transition from incident to knowledge
- Backward compatibility through views

### 2. Workflow Integration Point
**Decision**: Resolve incident = Create knowledge entry
**Rationale**:
- Natural knowledge capture point
- Ensures solution quality (reviewed before resolution)
- Automatic knowledge base growth
- No additional user effort required

### 3. Search Strategy
**Decision**: Unified FTS5 index with type filtering
**Rationale**:
- Single search interface for users
- Consistent search behavior
- Optimal performance
- Context-aware results

### 4. UI Component Strategy
**Decision**: Enhanced existing components vs new unified components
**Rationale**:
- Preserve existing user workflows
- Gradual migration path
- Leverage existing component investments
- Maintain specialized incident management features

## Migration Considerations

### Data Integrity
- Full backup before migration
- Incremental migration with rollback capability
- Data validation at each step
- Preserve all incident history and relationships

### Performance Impact
- Unified search may be slower initially
- Index optimization required
- Gradual rollout to measure impact
- Performance monitoring during transition

### User Training
- Unified search behavior changes
- Resolution workflow includes knowledge creation
- New knowledge discovery capabilities
- Updated incident management procedures

## Success Metrics

### Operational Metrics
- **Knowledge Creation Rate**: Incidents converted to knowledge entries
- **Search Effectiveness**: Time to find relevant solutions
- **Resolution Speed**: MTTR improvement with knowledge reuse
- **Knowledge Quality**: User ratings and success rates

### Business Metrics
- **Incident Recurrence**: Reduction in similar incidents
- **Team Efficiency**: Cross-team knowledge sharing
- **Training Reduction**: Self-service problem resolution
- **Knowledge Coverage**: Percentage of incident types documented

## Risk Mitigation

### Technical Risks
- **Data Loss**: Comprehensive backup and migration testing
- **Performance Degradation**: Incremental rollout and optimization
- **Search Quality**: Extensive testing and tuning

### Organizational Risks
- **User Adoption**: Training and gradual feature introduction
- **Workflow Disruption**: Maintain familiar interfaces during transition
- **Knowledge Quality**: Review processes for resolutions

## Conclusion

The integrated incident-knowledge base architecture provides significant benefits:

1. **Eliminated Duplication**: Single source of truth for problem-solution pairs
2. **Natural Knowledge Growth**: Every resolved incident becomes searchable knowledge
3. **Improved Resolution Times**: Easy access to previous solutions
4. **Better Analytics**: Unified view of problem patterns and solutions
5. **Reduced Maintenance**: Single schema and search system

The unified schema approach with backward compatibility ensures a smooth transition while enabling powerful new capabilities for knowledge management and incident resolution.