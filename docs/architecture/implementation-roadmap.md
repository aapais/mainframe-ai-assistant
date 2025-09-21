# Implementation Roadmap: Incident-KB Integration

## Executive Summary

This roadmap outlines the step-by-step implementation of the integrated incident-knowledge base system, with specific tasks, component modifications, and migration strategies.

## Pre-Implementation Assessment

### Current Asset Inventory
- ✅ **15 Incident Components**: Full workflow management
- ✅ **2 KB Components**: Basic entry display
- ✅ **3 Database Schemas**: Legacy, incident, and unified options
- ✅ **Service Layer**: Separate IncidentService and KnowledgeBaseService
- ✅ **Search Infrastructure**: FTS5 implementation ready
- ✅ **UI Framework**: React with TypeScript, modern component architecture

### Critical Dependencies
- Database migration must complete before UI changes
- Service layer integration must precede component updates
- Search indexing must be rebuilt during migration
- User training materials must be ready before rollout

## Phase 1: Database Foundation (Week 1-2)

### 1.1 Schema Migration
**Priority**: Critical | **Duration**: 3-4 days

```sql
-- Deploy unified schema
CREATE TABLE entries (
    id TEXT PRIMARY KEY,
    entry_type TEXT CHECK(entry_type IN ('incident', 'knowledge')),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    solution TEXT,

    -- Classification
    category TEXT NOT NULL,
    severity TEXT NOT NULL,
    tags TEXT, -- JSON array

    -- Incident workflow
    incident_status TEXT,
    priority INTEGER,
    assigned_to TEXT,
    reporter TEXT,
    sla_deadline DATETIME,

    -- Knowledge metrics
    usage_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    confidence_score REAL,

    -- Audit trail
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME,
    created_by TEXT,
    last_used DATETIME
);

-- Migration scripts
INSERT INTO entries (entry_type, title, description, solution, ...)
SELECT 'knowledge', title, problem, solution, ...
FROM kb_entries;

INSERT INTO entries (entry_type, title, description, incident_status, ...)
SELECT 'incident', title, description, status, ...
FROM incidents;
```

**Deliverables**:
- [ ] Unified schema deployment script
- [ ] Data migration scripts with rollback capability
- [ ] Backward compatibility views
- [ ] Data validation and integrity checks
- [ ] Migration testing on copy of production data

### 1.2 Search Index Rebuild
**Priority**: High | **Duration**: 2 days

```sql
-- Unified FTS5 table
CREATE VIRTUAL TABLE entries_fts USING fts5(
    id UNINDEXED,
    title,
    description,
    solution,
    tags,
    entry_type UNINDEXED,
    category UNINDEXED,
    content='entries',
    content_rowid='rowid'
);

-- Triggers for automatic indexing
CREATE TRIGGER entries_ai AFTER INSERT ON entries BEGIN
    INSERT INTO entries_fts(rowid, title, description, solution, tags, entry_type, category)
    VALUES (new.rowid, new.title, new.description, new.solution, new.tags, new.entry_type, new.category);
END;
```

## Phase 2: Service Layer Integration (Week 2-3)

### 2.1 Create UnifiedEntryService
**Priority**: Critical | **Duration**: 4-5 days

**File**: `src/renderer/services/UnifiedEntryService.ts`

```typescript
export class UnifiedEntryService {
    private static instance: UnifiedEntryService;

    // Core CRUD operations
    async createEntry(data: CreateEntryData): Promise<UnifiedEntry>
    async updateEntry(id: string, updates: UpdateEntryData): Promise<UnifiedEntry>
    async getEntry(id: string): Promise<UnifiedEntry>
    async deleteEntry(id: string): Promise<void>

    // Search operations
    async searchEntries(query: string, filters: SearchFilters): Promise<SearchResults>
    async getRelatedEntries(entryId: string): Promise<UnifiedEntry[]>

    // Incident-specific operations
    async createIncident(data: CreateIncidentData): Promise<UnifiedEntry>
    async updateIncidentStatus(id: string, status: IncidentStatus): Promise<void>
    async assignIncident(id: string, assignee: string): Promise<void>
    async resolveIncident(id: string, resolution: ResolutionData): Promise<UnifiedEntry>

    // Knowledge-specific operations
    async recordUsage(id: string, success: boolean): Promise<void>
    async rateEntry(id: string, rating: number): Promise<void>
    async updateKnowledgeMetrics(id: string): Promise<void>

    // Analytics and metrics
    async getIncidentMetrics(timeframe: string): Promise<IncidentMetrics>
    async getKnowledgeMetrics(): Promise<KnowledgeMetrics>
    async getResolutionEffectiveness(): Promise<ResolutionMetrics>
}
```

**Deliverables**:
- [ ] UnifiedEntryService implementation
- [ ] Type definitions for unified entry model
- [ ] IPC handler updates for unified operations
- [ ] Service integration tests
- [ ] Performance benchmarking

### 2.2 Update IPC Handlers
**Priority**: High | **Duration**: 2-3 days

**File**: `src/main/ipc/handlers/UnifiedHandler.ts`

```typescript
export class UnifiedHandler {
    // Entry operations
    async handleCreateEntry(event: IpcMainInvokeEvent, data: CreateEntryData)
    async handleUpdateEntry(event: IpcMainInvokeEvent, { id, updates })
    async handleGetEntry(event: IpcMainInvokeEvent, { id })
    async handleDeleteEntry(event: IpcMainInvokeEvent, { id })

    // Search operations
    async handleSearchEntries(event: IpcMainInvokeEvent, { query, filters })
    async handleGetRelatedEntries(event: IpcMainInvokeEvent, { entryId })

    // Incident workflow
    async handleResolveIncident(event: IpcMainInvokeEvent, { id, resolution })
    async handleUpdateIncidentStatus(event: IpcMainInvokeEvent, { id, status })

    // Knowledge operations
    async handleRecordUsage(event: IpcMainInvokeEvent, { id, success })
    async handleRateEntry(event: IpcMainInvokeEvent, { id, rating })
}
```

## Phase 3: Core Component Development (Week 3-4)

### 3.1 Create UnifiedEntryCard Component
**Priority**: Critical | **Duration**: 3-4 days

**File**: `src/renderer/components/unified/UnifiedEntryCard.tsx`

```typescript
interface UnifiedEntryCardProps {
    entry: UnifiedEntry;
    variant: 'incident' | 'knowledge' | 'auto' | 'compact';
    showWorkflowActions?: boolean;
    showKnowledgeActions?: boolean;
    onStatusChange?: (newStatus: string) => void;
    onResolve?: (solution: string) => void;
    onRate?: (rating: number) => void;
    onSelect?: (entry: UnifiedEntry) => void;
}

const UnifiedEntryCard: React.FC<UnifiedEntryCardProps> = (props) => {
    // Auto-detect entry type if variant is 'auto'
    const entryType = props.variant === 'auto'
        ? detectEntryType(props.entry)
        : props.variant;

    return (
        <Card className={`unified-entry-card unified-entry-card--${entryType}`}>
            <EntryHeader entry={props.entry} type={entryType} />

            {entryType === 'incident' ? (
                <IncidentContent {...props} />
            ) : (
                <KnowledgeContent {...props} />
            )}

            <EntryFooter entry={props.entry} type={entryType} />
        </Card>
    );
};
```

**Component Structure**:
```
src/renderer/components/unified/
├── UnifiedEntryCard.tsx          # Main card component
├── components/
│   ├── EntryHeader.tsx           # Universal header
│   ├── IncidentContent.tsx       # Incident-specific content
│   ├── KnowledgeContent.tsx      # Knowledge-specific content
│   └── EntryFooter.tsx           # Universal footer
└── styles/
    └── UnifiedEntryCard.css      # Component styles
```

### 3.2 Create UnifiedSearch Component
**Priority**: High | **Duration**: 3-4 days

**File**: `src/renderer/components/unified/UnifiedSearch.tsx`

```typescript
interface UnifiedSearchProps {
    searchType: 'all' | 'incidents' | 'knowledge';
    showActiveIncidentsOnly?: boolean;
    filters?: SearchFilters;
    onResultSelect: (entry: UnifiedEntry) => void;
    onSearchTypeChange: (type: string) => void;
    placeholder?: string;
}

const UnifiedSearch: React.FC<UnifiedSearchProps> = ({
    searchType = 'all',
    showActiveIncidentsOnly = false,
    onResultSelect,
    onSearchTypeChange,
    ...props
}) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<UnifiedEntry[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Debounced search
    const { debouncedValue } = useDebounce(query, 300);

    useEffect(() => {
        if (debouncedValue.length >= 2) {
            performSearch(debouncedValue);
        }
    }, [debouncedValue, searchType, showActiveIncidentsOnly]);

    return (
        <div className="unified-search">
            <SearchTypeSelector
                activeType={searchType}
                onChange={onSearchTypeChange}
            />

            <SearchInput
                value={query}
                onChange={setQuery}
                placeholder={props.placeholder || getPlaceholder(searchType)}
                isLoading={isLoading}
            />

            <SearchFilters
                type={searchType}
                showActiveOnly={showActiveIncidentsOnly}
                filters={props.filters}
                onChange={updateFilters}
            />

            <SearchResults
                results={results}
                onSelect={onResultSelect}
                searchType={searchType}
                isLoading={isLoading}
            />
        </div>
    );
};
```

### 3.3 Create ResolutionWorkflow Component
**Priority**: High | **Duration**: 2-3 days

**File**: `src/renderer/components/unified/ResolutionWorkflow.tsx`

```typescript
interface ResolutionWorkflowProps {
    incident: UnifiedEntry;
    onResolve: (resolution: ResolutionData) => void;
    onCancel: () => void;
    suggestedSolutions?: UnifiedEntry[];
}

const ResolutionWorkflow: React.FC<ResolutionWorkflowProps> = ({
    incident,
    onResolve,
    onCancel,
    suggestedSolutions = []
}) => {
    const [solution, setSolution] = useState('');
    const [rootCause, setRootCause] = useState('');
    const [tags, setTags] = useState<string[]>([]);
    const [relatedEntries, setRelatedEntries] = useState<string[]>([]);

    const handleResolve = () => {
        const resolutionData: ResolutionData = {
            solution,
            rootCause,
            tags: [...tags, ...extractTagsFromIncident(incident)],
            relatedEntries,
            estimatedResolutionTime: calculateResolutionTime(incident)
        };

        onResolve(resolutionData);
    };

    return (
        <Modal title="Resolve Incident & Create Knowledge Entry" onClose={onCancel}>
            <div className="resolution-workflow">
                <IncidentSummary incident={incident} />

                <SolutionEditor
                    value={solution}
                    onChange={setSolution}
                    placeholder="Describe the solution that resolved this incident..."
                />

                {suggestedSolutions.length > 0 && (
                    <SuggestedSolutions
                        solutions={suggestedSolutions}
                        onSelect={applySuggestedSolution}
                    />
                )}

                <RootCauseAnalysis
                    value={rootCause}
                    onChange={setRootCause}
                />

                <TagEditor
                    tags={tags}
                    onChange={setTags}
                    suggestions={getTagSuggestions(incident)}
                />

                <RelatedEntriesSelector
                    selectedEntries={relatedEntries}
                    onChange={setRelatedEntries}
                    incident={incident}
                />

                <div className="resolution-actions">
                    <Button onClick={onCancel} variant="secondary">
                        Cancel
                    </Button>
                    <Button
                        onClick={handleResolve}
                        variant="primary"
                        disabled={!solution.trim()}
                    >
                        Resolve & Create Knowledge
                    </Button>
                </div>
            </div>
        </Modal>
    );
};
```

## Phase 4: Component Integration (Week 4-5)

### 4.1 Enhance IncidentQueue Component
**Priority**: High | **Duration**: 2-3 days

**File**: `src/renderer/components/incident/IncidentQueue.tsx`

**Modifications**:
```typescript
// Add new props for unified functionality
interface EnhancedIncidentQueueProps extends IncidentQueueProps {
    showResolvedAsKnowledge?: boolean;
    knowledgeViewMode?: 'inline' | 'separate';
    onViewKnowledge?: (entry: UnifiedEntry) => void;
}

// Modify the component to use UnifiedEntryCard
const IncidentQueue: React.FC<EnhancedIncidentQueueProps> = ({
    showResolvedAsKnowledge = false,
    knowledgeViewMode = 'inline',
    onViewKnowledge,
    ...props
}) => {
    // Replace incident cards with unified cards
    const renderIncidentRow = (incident: IncidentKBEntry) => (
        <UnifiedEntryCard
            key={incident.id}
            entry={mapIncidentToUnifiedEntry(incident)}
            variant="incident"
            showWorkflowActions={true}
            onStatusChange={(status) => handleStatusChange(incident.id, status)}
            onResolve={(solution) => handleResolve(incident.id, solution)}
            onSelect={() => handleIncidentSelect(incident)}
        />
    );
};
```

### 4.2 Update IncidentManagementDashboard
**Priority**: Medium | **Duration**: 2-3 days

**File**: `src/renderer/components/incident/IncidentManagementDashboard.tsx`

**Modifications**:
```typescript
// Add knowledge metrics to dashboard
interface UnifiedDashboardMetrics extends DashboardMetrics {
    knowledgeMetrics: {
        totalKnowledgeEntries: number;
        recentlyResolved: number;
        averageReuseRate: number;
        topKnowledgeCategories: Array<{ category: string; count: number }>;
    };
    resolutionMetrics: {
        averageTimeToKnowledge: number;
        knowledgeCreationRate: number;
        solutionEffectiveness: number;
    };
}

// Add new tabs for knowledge and analytics
const enhancedTabs = [
    { value: 'overview', label: 'Overview', icon: Activity },
    { value: 'incidents', label: 'Active Incidents', icon: AlertTriangle },
    { value: 'knowledge', label: 'Knowledge Base', icon: BookOpen },
    { value: 'analytics', label: 'Analytics', icon: BarChart3 },
    { value: 'resolution', label: 'Resolution Workflow', icon: CheckCircle }
];
```

### 4.3 Create Unified Detail View
**Priority**: Medium | **Duration**: 2-3 days

**File**: `src/renderer/components/unified/UnifiedDetailView.tsx`

```typescript
interface UnifiedDetailViewProps {
    entry: UnifiedEntry;
    onClose?: () => void;
    onEdit?: (entry: UnifiedEntry) => void;
    onDelete?: (entryId: string) => void;
    onResolve?: (solution: string) => void;
}

const UnifiedDetailView: React.FC<UnifiedDetailViewProps> = ({
    entry,
    onClose,
    onEdit,
    onDelete,
    onResolve
}) => {
    const entryType = entry.entry_type || detectEntryType(entry);

    return (
        <div className="unified-detail-view">
            {entryType === 'incident' ? (
                <IncidentDetailView
                    incident={entry}
                    onClose={onClose}
                    onEdit={onEdit}
                    onResolve={onResolve}
                />
            ) : (
                <KBEntryDetail
                    entry={entry}
                    onClose={onClose}
                    onEdit={onEdit}
                    onDelete={onDelete}
                />
            )}
        </div>
    );
};
```

## Phase 5: Advanced Features (Week 5-6)

### 5.1 Smart Resolution Suggestions
**Priority**: Medium | **Duration**: 3-4 days

**File**: `src/renderer/services/ResolutionSuggestionService.ts`

```typescript
export class ResolutionSuggestionService {
    async getSuggestedSolutions(incident: UnifiedEntry): Promise<UnifiedEntry[]> {
        // Search for similar resolved incidents
        const similarIncidents = await this.searchSimilarIncidents(incident);

        // Filter by success rate and relevance
        return similarIncidents
            .filter(entry => entry.success_count > 0)
            .sort((a, b) => this.calculateRelevanceScore(b, incident) -
                            this.calculateRelevanceScore(a, incident))
            .slice(0, 5);
    }

    private calculateRelevanceScore(entry: UnifiedEntry, incident: UnifiedEntry): number {
        let score = 0;

        // Category match
        if (entry.category === incident.category) score += 30;

        // Tag overlap
        const tagOverlap = this.calculateTagOverlap(entry.tags, incident.tags);
        score += tagOverlap * 20;

        // Success rate
        const successRate = entry.success_count / (entry.usage_count || 1);
        score += successRate * 25;

        // Recency
        const daysSinceResolution = this.daysSince(entry.resolved_at);
        score += Math.max(0, 25 - daysSinceResolution);

        return score;
    }
}
```

### 5.2 Analytics and Reporting
**Priority**: Low | **Duration**: 2-3 days

**File**: `src/renderer/components/analytics/UnifiedAnalytics.tsx`

```typescript
const UnifiedAnalytics: React.FC = () => {
    const [metrics, setMetrics] = useState<UnifiedMetrics | null>(null);

    return (
        <div className="unified-analytics">
            <MetricsDashboard>
                <MetricCard
                    title="Knowledge Creation Rate"
                    value={metrics?.knowledgeCreationRate}
                    trend={metrics?.knowledgeCreationTrend}
                />
                <MetricCard
                    title="Solution Reuse Rate"
                    value={metrics?.solutionReuseRate}
                    trend={metrics?.solutionReuseTrend}
                />
                <MetricCard
                    title="Average Resolution Time"
                    value={metrics?.averageResolutionTime}
                    trend={metrics?.resolutionTimeTrend}
                />
            </MetricsDashboard>

            <ChartsSection>
                <IncidentToKnowledgeFlow />
                <CategoryEffectiveness />
                <ResolutionTimeDistribution />
            </ChartsSection>
        </div>
    );
};
```

## Phase 6: Testing and Optimization (Week 6-7)

### 6.1 Testing Strategy
**Duration**: 5-7 days

#### Unit Tests
```typescript
// Component tests
describe('UnifiedEntryCard', () => {
    test('renders incident variant correctly');
    test('renders knowledge variant correctly');
    test('auto-detects entry type');
    test('handles status changes');
    test('handles resolution workflow');
});

// Service tests
describe('UnifiedEntryService', () => {
    test('creates incident successfully');
    test('resolves incident and creates knowledge');
    test('searches across both types');
    test('handles error cases gracefully');
});
```

#### Integration Tests
```typescript
// Workflow tests
describe('Incident Resolution Workflow', () => {
    test('full incident lifecycle');
    test('knowledge creation from resolution');
    test('search includes resolved incidents');
    test('metrics update correctly');
});
```

### 6.2 Performance Optimization
**Duration**: 2-3 days

- Database query optimization
- Search index tuning
- Component virtualization for large lists
- Lazy loading for detail views
- Caching strategy for frequently accessed data

### 6.3 User Acceptance Testing
**Duration**: 3-4 days

- Test all existing incident workflows
- Verify knowledge creation process
- Validate search functionality
- Confirm accessibility compliance
- Performance benchmarking

## Phase 7: Deployment and Migration (Week 7-8)

### 7.1 Production Deployment Strategy
**Duration**: 2-3 days

#### Feature Flags
```typescript
interface FeatureFlags {
    unifiedSearch: boolean;
    resolutionWorkflow: boolean;
    knowledgeCreation: boolean;
    legacyMode: boolean;
}

const useFeatureFlags = (): FeatureFlags => {
    return {
        unifiedSearch: process.env.FEATURE_UNIFIED_SEARCH === 'true',
        resolutionWorkflow: process.env.FEATURE_RESOLUTION_WORKFLOW === 'true',
        knowledgeCreation: process.env.FEATURE_KNOWLEDGE_CREATION === 'true',
        legacyMode: process.env.FEATURE_LEGACY_MODE === 'true'
    };
};
```

#### Gradual Rollout
1. **Week 1**: Deploy with all features disabled (safety deployment)
2. **Week 2**: Enable unified search for test users
3. **Week 3**: Enable resolution workflow for selected teams
4. **Week 4**: Full rollout with monitoring

### 7.2 Data Migration
**Duration**: 1-2 days

```bash
# Migration script
./scripts/migrate-to-unified.sh --backup --verify --rollback-plan

# Verification
./scripts/verify-migration.py --check-integrity --validate-search
```

### 7.3 User Training
**Duration**: 2-3 days

- Updated documentation
- Video tutorials for new workflows
- Training sessions for key users
- Support materials and FAQ

## Risk Mitigation

### Technical Risks
- **Database Migration Failure**: Full backup + tested rollback procedure
- **Performance Degradation**: Incremental rollout with monitoring
- **Search Quality Issues**: A/B testing and tuning

### User Adoption Risks
- **Workflow Disruption**: Maintain legacy interfaces during transition
- **Training Requirements**: Comprehensive training materials and support
- **Feature Confusion**: Clear UI indicators and contextual help

## Success Metrics

### Technical Metrics
- Migration success rate: 100% data integrity
- Search performance: <200ms average response time
- System availability: >99.9% uptime during transition

### User Metrics
- Knowledge creation rate: Increase in entries from resolved incidents
- Search effectiveness: Reduced time to find solutions
- User satisfaction: Positive feedback on unified interface

### Business Metrics
- Incident resolution time: Reduction due to knowledge reuse
- Knowledge base growth: Organic growth from incident resolutions
- Team efficiency: Reduced context switching between systems

## Post-Implementation

### Monitoring
- Performance metrics dashboard
- User behavior analytics
- Knowledge base growth tracking
- Incident resolution effectiveness

### Continuous Improvement
- Regular user feedback collection
- Performance optimization based on usage patterns
- Feature enhancement based on user requests
- Knowledge quality improvement processes

## Conclusion

This implementation roadmap provides a structured approach to integrating incident management and knowledge base systems. The phased approach ensures minimal disruption to existing workflows while delivering significant improvements in knowledge management and incident resolution efficiency.

The key to success is maintaining backward compatibility during the transition while gradually introducing new unified features that demonstrate clear value to users.