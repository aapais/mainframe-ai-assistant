# Unified User Interface Architecture
## Incident-Knowledge Base Integration

## Overview

This document details the user interface architecture for the integrated incident-knowledge base system, where resolved incidents become searchable knowledge entries.

## Current Component Analysis

### Incident Management Components (15 components)
```
src/renderer/components/incident/
├── IncidentManagementDashboard.tsx    # Main dashboard with tabs
├── IncidentQueue.tsx                  # List view with filters
├── StatusBadge.tsx                    # Status indicators
├── PriorityBadge.tsx                  # Priority indicators
├── StatusWorkflow.tsx                 # Status transitions
├── RelatedIncidentsPanel.tsx          # Related incident viewer
├── BulkUploadModal.tsx               # Mass import
├── CreateIncidentModal.tsx           # New incident form
├── EditIncidentModal.tsx             # Edit incident form
├── IncidentDetailView.tsx            # Full incident view
├── IncidentAIPanel.tsx               # AI integration panel
├── AdvancedFiltersPanel.tsx          # Advanced filtering
└── QuickActions.tsx                  # Quick action buttons
```

### Knowledge Base Components (2 components)
```
src/renderer/components/kb-entry/
├── KBEntryCard.tsx                   # Entry display card
└── KBEntryDetail.tsx                 # Full entry view
```

## Unified Component Architecture

### 1. Core Unified Components

#### A. UnifiedEntryCard
**Purpose**: Single component for displaying both incidents and knowledge entries
```typescript
interface UnifiedEntryCardProps {
  entry: UnifiedEntry;
  variant: 'incident' | 'knowledge' | 'auto';
  showWorkflowActions?: boolean;
  showKnowledgeActions?: boolean;
  onStatusChange?: (newStatus: string) => void;
  onResolve?: (solution: string) => void;
  onRate?: (rating: number) => void;
}

const UnifiedEntryCard: React.FC<UnifiedEntryCardProps> = ({
  entry,
  variant = 'auto',
  ...props
}) => {
  // Auto-detect type if not specified
  const entryType = variant === 'auto'
    ? (entry.entry_type || (entry.incident_status ? 'incident' : 'knowledge'))
    : variant;

  return (
    <Card className={`unified-entry-card unified-entry-card--${entryType}`}>
      {/* Universal header */}
      <EntryHeader entry={entry} type={entryType} />

      {/* Type-specific content */}
      {entryType === 'incident' ? (
        <IncidentContent entry={entry} {...props} />
      ) : (
        <KnowledgeContent entry={entry} {...props} />
      )}

      {/* Universal footer */}
      <EntryFooter entry={entry} type={entryType} />
    </Card>
  );
};
```

#### B. UnifiedSearch Component
**Purpose**: Single search interface for both incidents and knowledge
```typescript
interface UnifiedSearchProps {
  searchType: 'all' | 'incidents' | 'knowledge';
  showActiveIncidentsOnly?: boolean;
  filters?: UnifiedFilters;
  onResultSelect: (entry: UnifiedEntry) => void;
  onSearchTypeChange: (type: string) => void;
}

const UnifiedSearch: React.FC<UnifiedSearchProps> = ({
  searchType = 'all',
  showActiveIncidentsOnly = false,
  ...props
}) => {
  return (
    <div className="unified-search">
      {/* Search type selector */}
      <SearchTypeSelector
        activeType={searchType}
        onChange={props.onSearchTypeChange}
      />

      {/* Search input with intelligent autocomplete */}
      <SearchInput
        placeholder={getPlaceholderText(searchType)}
        onSearch={handleSearch}
        autocomplete={true}
      />

      {/* Context-aware filters */}
      <SearchFilters
        type={searchType}
        showActiveOnly={showActiveIncidentsOnly}
        filters={props.filters}
      />

      {/* Unified results */}
      <SearchResults
        type={searchType}
        onSelect={props.onResultSelect}
      />
    </div>
  );
};
```

#### C. ResolutionWorkflow Component
**Purpose**: Incident resolution form that creates knowledge entries
```typescript
interface ResolutionWorkflowProps {
  incident: UnifiedEntry;
  onResolve: (resolution: ResolutionData) => void;
  onCancel: () => void;
  suggestedSolutions?: KnowledgeEntry[];
}

interface ResolutionData {
  solution: string;
  rootCause?: string;
  preventiveMeasures?: string;
  tags: string[];
  relatedEntries: string[];
  estimatedResolutionTime?: number;
}

const ResolutionWorkflow: React.FC<ResolutionWorkflowProps> = ({
  incident,
  onResolve,
  suggestedSolutions = []
}) => {
  return (
    <Modal title="Resolve Incident & Create Knowledge Entry">
      {/* Solution editor with rich text */}
      <SolutionEditor
        placeholder="Describe the solution that resolved this incident..."
        onValueChange={setSolution}
      />

      {/* Auto-suggest existing solutions */}
      {suggestedSolutions.length > 0 && (
        <SuggestedSolutions
          solutions={suggestedSolutions}
          onSelect={applySolution}
        />
      )}

      {/* Knowledge enhancement */}
      <KnowledgeEnhancementForm
        incident={incident}
        onTagsChange={setTags}
        onRelatedEntriesChange={setRelatedEntries}
      />

      {/* Resolution actions */}
      <ResolutionActions
        onResolve={() => onResolve(resolutionData)}
        onCancel={onCancel}
      />
    </Modal>
  );
};
```

### 2. Enhanced Existing Components

#### A. Enhanced IncidentQueue
**Purpose**: Show both active incidents and resolved incidents as knowledge
```typescript
interface EnhancedIncidentQueueProps extends IncidentQueueProps {
  showResolvedAsKnowledge?: boolean;
  knowledgeViewMode?: 'inline' | 'separate';
  onViewKnowledge?: (entry: UnifiedEntry) => void;
}
```

#### B. Enhanced Dashboard
**Purpose**: Combined incident management and knowledge base metrics
```typescript
interface UnifiedDashboardProps {
  activeTab: 'incidents' | 'knowledge' | 'analytics' | 'resolution';
  incidentMetrics: IncidentMetrics;
  knowledgeMetrics: KnowledgeMetrics;
  resolutionMetrics: ResolutionMetrics;
}
```

## User Experience Flows

### 1. Incident Lifecycle Flow
```
1. Create Incident → IncidentQueue (Active)
2. Work on Incident → IncidentDetailView (Status updates)
3. Resolve Incident → ResolutionWorkflow (Solution capture)
4. Knowledge Created → SearchResults (Auto-indexed)
5. Knowledge Used → KnowledgeStats (Usage tracking)
```

### 2. Knowledge Discovery Flow
```
1. Search Problem → UnifiedSearch (All types)
2. Find Solution → UnifiedEntryCard (Knowledge view)
3. Apply Solution → UsageTracking (Success/failure)
4. Provide Feedback → KnowledgeImprovement (Ratings)
```

### 3. Cross-Reference Flow
```
1. Working on Incident → IncidentDetailView
2. Search Related → UnifiedSearch (Similar problems)
3. Find Resolution → KnowledgeEntry (Previous solution)
4. Apply & Resolve → ResolutionWorkflow (Build on existing)
```

## State Management

### 1. Unified Entry Store
```typescript
interface UnifiedEntryState {
  entries: Record<string, UnifiedEntry>;
  searchResults: SearchResults;
  filters: UnifiedFilters;
  selectedEntry: string | null;
  activeView: 'list' | 'detail' | 'resolution';
}

const useUnifiedEntryStore = create<UnifiedEntryState>((set, get) => ({
  // Entry operations
  addEntry: (entry: UnifiedEntry) => set(state => ({
    entries: { ...state.entries, [entry.id]: entry }
  })),

  updateEntry: (id: string, updates: Partial<UnifiedEntry>) => set(state => ({
    entries: {
      ...state.entries,
      [id]: { ...state.entries[id], ...updates }
    }
  })),

  // Search operations
  search: async (query: string, filters: UnifiedFilters) => {
    const results = await UnifiedService.search(query, filters);
    set({ searchResults: results });
  },

  // Resolution workflow
  resolveIncident: async (id: string, resolution: ResolutionData) => {
    const entry = get().entries[id];
    const resolvedEntry = await UnifiedService.resolveIncident(entry, resolution);
    set(state => ({
      entries: { ...state.entries, [id]: resolvedEntry }
    }));
  }
}));
```

### 2. Context Providers
```typescript
const UnifiedEntryProvider: React.FC = ({ children }) => {
  const store = useUnifiedEntryStore();

  return (
    <UnifiedEntryContext.Provider value={store}>
      {children}
    </UnifiedEntryContext.Provider>
  );
};
```

## Responsive Design Strategy

### 1. Mobile-First Approach
- **Mobile**: Single-column list view with expandable cards
- **Tablet**: Two-column layout with sidebar filters
- **Desktop**: Multi-panel layout with real-time updates

### 2. Progressive Enhancement
```typescript
const useResponsiveLayout = () => {
  const { width } = useViewport();

  return {
    isMobile: width < 768,
    isTablet: width >= 768 && width < 1024,
    isDesktop: width >= 1024,
    layout: width < 768 ? 'mobile' : width < 1024 ? 'tablet' : 'desktop'
  };
};
```

## Accessibility Implementation

### 1. ARIA Patterns
```typescript
// Screen reader announcements for state changes
const announceEntryUpdate = (entry: UnifiedEntry, action: string) => {
  const message = `${entry.entry_type} ${entry.title} ${action}`;
  announceToScreenReader(message, 'polite');
};

// Keyboard navigation
const useKeyboardNavigation = () => {
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === '/') {
        focusSearchInput();
      } else if (e.key === 'Escape') {
        clearSearch();
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, []);
};
```

### 2. Focus Management
```typescript
const useFocusManagement = () => {
  const focusTrapRef = useRef<HTMLElement>(null);

  const createFocusTrap = (element: HTMLElement) => {
    // Implementation for modal focus trapping
  };

  const restoreFocus = (element: HTMLElement) => {
    // Restore focus to previously focused element
  };
};
```

## Performance Optimization

### 1. Component Lazy Loading
```typescript
const LazyIncidentDetail = lazy(() => import('./IncidentDetailView'));
const LazyKnowledgeDetail = lazy(() => import('./KBEntryDetail'));
const LazyResolutionWorkflow = lazy(() => import('./ResolutionWorkflow'));

const UnifiedDetailView: React.FC = ({ entry, type }) => {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      {type === 'incident' ? (
        <LazyIncidentDetail entry={entry} />
      ) : (
        <LazyKnowledgeDetail entry={entry} />
      )}
    </Suspense>
  );
};
```

### 2. Virtualization for Large Lists
```typescript
const VirtualizedEntryList: React.FC = ({ entries, onEntrySelect }) => {
  return (
    <FixedSizeList
      height={600}
      itemCount={entries.length}
      itemSize={120}
      itemData={entries}
    >
      {({ index, style, data }) => (
        <div style={style}>
          <UnifiedEntryCard
            entry={data[index]}
            variant="compact"
            onSelect={onEntrySelect}
          />
        </div>
      )}
    </FixedSizeList>
  );
};
```

## Component Migration Strategy

### Phase 1: Create Unified Base Components
1. **UnifiedEntryCard**: Merge KBEntryCard + incident display logic
2. **UnifiedSearch**: Enhanced search with type filtering
3. **ResolutionWorkflow**: New component for incident→knowledge conversion

### Phase 2: Enhance Existing Components
1. **IncidentQueue**: Add knowledge view toggle
2. **IncidentManagementDashboard**: Add knowledge metrics
3. **IncidentDetailView**: Add resolution workflow integration

### Phase 3: Legacy Component Compatibility
1. **Wrapper Components**: Ensure existing code still works
2. **Gradual Migration**: Move features to unified components
3. **Deprecation Plan**: Phase out old components over time

## Testing Strategy

### 1. Component Testing
```typescript
describe('UnifiedEntryCard', () => {
  it('renders incident variant correctly', () => {
    render(<UnifiedEntryCard entry={mockIncident} variant="incident" />);
    expect(screen.getByText('Status:')).toBeInTheDocument();
  });

  it('renders knowledge variant correctly', () => {
    render(<UnifiedEntryCard entry={mockKnowledge} variant="knowledge" />);
    expect(screen.getByText('Success Rate:')).toBeInTheDocument();
  });

  it('auto-detects entry type', () => {
    render(<UnifiedEntryCard entry={mockEntry} variant="auto" />);
    // Assert correct rendering based on entry_type
  });
});
```

### 2. Integration Testing
```typescript
describe('Resolution Workflow', () => {
  it('converts incident to knowledge entry', async () => {
    const { resolveIncident } = useUnifiedEntryStore();
    await resolveIncident('incident-1', mockResolution);

    // Verify entry is now searchable as knowledge
    const searchResults = await search('test problem');
    expect(searchResults).toContain(expect.objectContaining({
      id: 'incident-1',
      entry_type: 'incident',
      status: 'resolved'
    }));
  });
});
```

## Migration Timeline

### Week 1-2: Foundation
- Create UnifiedEntry types and interfaces
- Implement UnifiedEntryCard base component
- Set up unified state management

### Week 3-4: Core Components
- Implement UnifiedSearch component
- Create ResolutionWorkflow component
- Enhanced IncidentQueue with knowledge view

### Week 5-6: Integration
- Update IncidentManagementDashboard
- Implement cross-component communication
- Add performance optimizations

### Week 7-8: Testing & Refinement
- Comprehensive testing suite
- User acceptance testing
- Performance optimization
- Documentation updates

## Conclusion

The unified UI architecture provides:

1. **Consistent Experience**: Single interface for both incidents and knowledge
2. **Natural Workflow**: Incident resolution automatically creates knowledge
3. **Improved Discoverability**: Unified search across all content
4. **Enhanced Productivity**: Reduced context switching between systems
5. **Backward Compatibility**: Existing workflows continue to function

This architecture enables a seamless transition from the current separate systems to a unified knowledge management platform while preserving all existing functionality and user workflows.