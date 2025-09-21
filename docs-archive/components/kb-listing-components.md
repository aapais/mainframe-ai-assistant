# Knowledge Base Listing Components - Architecture Documentation

## Table of Contents

1. [Component Overview](#component-overview)
2. [AdvancedKBEntryList](#advancedkbentrylist)
3. [KBEntryItem](#kbentryitem)
4. [SearchFilters](#searchfilters)
5. [BatchOperationsPanel](#batchoperationspanel)
6. [MetricsDashboard](#metricsdashboard)
7. [Component Composition](#component-composition)
8. [Styling & Theming](#styling--theming)
9. [Accessibility Features](#accessibility-features)
10. [Performance Optimizations](#performance-optimizations)

---

## Component Overview

The Knowledge Base Listing system is built with a modular component architecture that provides flexibility, reusability, and maintainability. Each component has a specific responsibility and can be composed together to create powerful knowledge management interfaces.

### Component Hierarchy

```
KBManagerApp
├── SearchBar
├── QuickFilters
├── AdvancedKBEntryList
│   ├── BatchToolbar
│   ├── VirtualizedList
│   │   └── KBEntryItem (repeated)
│   │       ├── SelectionCheckbox
│   │       ├── EntryContent
│   │       ├── MetadataDisplay
│   │       └── QuickActions
│   └── ListStatus
├── SearchFilters
├── EntryPreviewPanel
└── MetricsDashboard
```

### Core Design Principles

- **Separation of Concerns**: Each component has a single responsibility
- **Composition over Inheritance**: Components compose together rather than extend
- **Performance First**: Virtual scrolling and lazy loading by default
- **Accessibility Built-in**: WCAG 2.1 AA compliance from the ground up
- **Type Safety**: Full TypeScript support with comprehensive interfaces

---

## AdvancedKBEntryList

The main component for displaying and managing knowledge base entries with advanced features.

### Component Structure

```typescript
export const AdvancedKBEntryList: React.FC<AdvancedKBEntryListProps> = ({
  // Display configuration
  className = '',
  height = 600,
  itemHeight = 120,

  // Search and filtering
  searchQuery = '',
  categoryFilter,
  tagFilter = [],
  sortBy = 'relevance',
  sortOrder = 'desc',

  // View options
  viewMode = 'list',
  showPreview = true,
  showMetrics = true,
  groupBy = 'none',

  // Feature toggles
  enableBatchSelect = true,
  enableInlineEdit = true,
  enableQuickActions = true,

  // Event handlers
  onEntrySelect,
  onEntryEdit,
  onEntryDelete,
  onEntryCopy,
  onBatchOperation,

  // Accessibility
  ariaLabel = 'Knowledge base entries',
  announceChanges = true
}) => {
  // Component implementation...
}
```

### Props Interface

```typescript
interface AdvancedKBEntryListProps {
  /** Styling and layout */
  className?: string;
  height?: number;
  itemHeight?: number;

  /** Data filtering and sorting */
  searchQuery?: string;
  categoryFilter?: KBCategory;
  tagFilter?: string[];
  sortBy?: 'relevance' | 'usage' | 'created' | 'updated' | 'title';
  sortOrder?: 'asc' | 'desc';

  /** Display configuration */
  viewMode?: 'list' | 'grid' | 'compact';
  showPreview?: boolean;
  showMetrics?: boolean;
  groupBy?: 'category' | 'tags' | 'created' | 'none';

  /** Feature flags */
  enableBatchSelect?: boolean;
  enableInlineEdit?: boolean;
  enableQuickActions?: boolean;

  /** Event handlers */
  onEntrySelect?: (entry: KBEntryListItem) => void;
  onEntryEdit?: (entry: KBEntryListItem) => void;
  onEntryDelete?: (entry: KBEntryListItem) => void;
  onEntryCopy?: (entry: KBEntryListItem) => void;
  onBatchOperation?: (operation: string, entries: KBEntryListItem[]) => void;

  /** Version control */
  onShowVersionHistory?: (entry: KBEntryListItem) => void;
  onCompareVersions?: (entry: KBEntryListItem) => void;
  onRollback?: (entry: KBEntryListItem) => void;

  /** Accessibility */
  ariaLabel?: string;
  announceChanges?: boolean;
}
```

### Usage Examples

#### Basic Usage

```typescript
import { AdvancedKBEntryList } from '@/components/KB/AdvancedKBEntryList';

export const BasicKBList: React.FC = () => {
  const [selectedEntry, setSelectedEntry] = useState<KBEntryListItem | null>(null);

  return (
    <AdvancedKBEntryList
      height={500}
      onEntrySelect={setSelectedEntry}
      ariaLabel="Main knowledge base"
    />
  );
};
```

#### Advanced Configuration

```typescript
export const AdvancedKBList: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid' | 'compact'>('list');
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());

  const handleBatchOperation = useCallback((operation: string, entries: KBEntryListItem[]) => {
    switch (operation) {
      case 'delete':
        // Handle batch delete
        break;
      case 'export':
        // Handle batch export
        break;
      case 'duplicate':
        // Handle batch duplicate
        break;
    }
  }, []);

  return (
    <div className="kb-container">
      <div className="kb-controls">
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search knowledge base..."
        />

        <ViewModeToggle
          value={viewMode}
          onChange={setViewMode}
          options={['list', 'grid', 'compact']}
        />
      </div>

      <AdvancedKBEntryList
        className="main-kb-list"
        height={600}
        itemHeight={viewMode === 'compact' ? 60 : viewMode === 'grid' ? 150 : 120}
        searchQuery={searchQuery}
        viewMode={viewMode}
        showPreview={viewMode !== 'compact'}
        showMetrics={true}
        enableBatchSelect={true}
        enableInlineEdit={true}
        enableQuickActions={true}
        onBatchOperation={handleBatchOperation}
        ariaLabel="Knowledge base entries"
        announceChanges={true}
      />
    </div>
  );
};
```

### Internal State Management

```typescript
// Component uses several internal state hooks
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
const [editingId, setEditingId] = useState<string | null>(null);
const [focusedIndex, setFocusedIndex] = useState(0);

// Refs for performance and interaction
const listRef = useRef<List>(null);
const containerRef = useRef<HTMLDivElement>(null);

// Custom hooks integration
const { entries, loading, error, updateEntry } = useKBData();
const { selectedEntries, performBatchOperation } = useBatchOperations(entries, selectedIds);
const { focusedIndex, onFocusChange } = useKeyboardNavigation({
  itemCount: entries.length,
  onSelect: handleEntrySelect,
  onToggleSelect: handleToggleSelect
});
```

### Performance Optimizations

- **Virtual Scrolling**: Only renders visible items using `react-window`
- **Memoized Renders**: Uses `React.memo` for item components
- **Optimized Event Handlers**: Callbacks are memoized to prevent unnecessary re-renders
- **Debounced Updates**: Search and filter changes are debounced
- **Batch DOM Updates**: Multiple selection changes are batched

---

## KBEntryItem

Individual entry component rendered within the virtualized list.

### Component Structure

```typescript
const KBEntryItem = memo<{
  index: number;
  style: React.CSSProperties;
  data: {
    entries: KBEntryListItem[];
    selectedIds: Set<string>;
    editingId: string | null;
    viewMode: string;
    showPreview: boolean;
    showMetrics: boolean;
    onSelect: (entry: KBEntryListItem) => void;
    onToggleSelect: (entry: KBEntryListItem) => void;
    onEdit: (entry: KBEntryListItem) => void;
    onSave: (entry: KBEntryListItem, updates: Partial<KBEntry>) => void;
    onCancel: () => void;
    onQuickAction: (action: string, entry: KBEntryListItem) => void;
  };
}>(({ index, style, data }) => {
  // Component implementation...
});
```

### Entry Display Modes

#### List View
```tsx
<div className="kb-entry-item list">
  <SelectionCheckbox />
  <div className="entry-content">
    <EntryHeader />
    <ProblemPreview />
    <TagsDisplay />
  </div>
  <QuickActions />
</div>
```

#### Grid View
```tsx
<div className="kb-entry-item grid">
  <SelectionCheckbox />
  <div className="entry-card">
    <EntryTitle />
    <CategoryBadge />
    <MetricsDisplay />
    <TagsPreview />
  </div>
  <QuickActions />
</div>
```

#### Compact View
```tsx
<div className="kb-entry-item compact">
  <SelectionCheckbox />
  <EntryTitle />
  <CategoryBadge />
  <UsageMetric />
  <QuickActions />
</div>
```

### Inline Editing Support

```typescript
// Editing state management
const [editValues, setEditValues] = useState<Partial<KBEntry>>({});
const [isEditing, setIsEditing] = useState(false);

// Edit mode rendering
{isEditing ? (
  <EditMode
    values={editValues}
    onChange={setEditValues}
    onSave={handleSave}
    onCancel={handleCancel}
  />
) : (
  <DisplayMode
    entry={entry}
    onEdit={() => setIsEditing(true)}
  />
)}
```

### Keyboard Navigation

```typescript
const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
  switch (e.key) {
    case 'Enter':
      if (e.ctrlKey || e.metaKey) {
        onSelect(entry);
      } else if (isEditing) {
        handleSave();
      }
      break;
    case 'Escape':
      if (isEditing) {
        handleCancel();
      }
      break;
    case ' ':
      if (!isEditing) {
        e.preventDefault();
        onToggleSelect(entry);
      }
      break;
    case 'e':
      if (!isEditing && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        onEdit(entry);
      }
      break;
    case 'd':
      if (!isEditing && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        onQuickAction('duplicate', entry);
      }
      break;
  }
}, [entry, isEditing, onSelect, onToggleSelect, onEdit, onQuickAction]);
```

---

## SearchFilters

Advanced filtering component with faceted search capabilities.

### Component Interface

```typescript
interface SearchFiltersProps {
  /** Current filter state */
  filters: FilterState;

  /** Available filter options */
  availableCategories: string[];
  availableTags: string[];
  availableSeverities: string[];

  /** Event handlers */
  onFiltersChange: (filters: FilterState) => void;
  onClearFilters: () => void;
  onSaveFilter: (name: string, filters: FilterState) => void;
  onLoadFilter: (name: string) => void;

  /** Display options */
  showAdvanced?: boolean;
  collapsible?: boolean;
  horizontal?: boolean;
}

interface FilterState {
  categories?: string[];
  tags?: string[];
  severities?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  usageRange?: {
    min: number;
    max: number;
  };
  successRate?: {
    min: number;
    max: number;
  };
}
```

### Component Structure

```typescript
export const SearchFilters: React.FC<SearchFiltersProps> = ({
  filters,
  availableCategories,
  availableTags,
  availableSeverities,
  onFiltersChange,
  onClearFilters,
  onSaveFilter,
  showAdvanced = false,
  collapsible = true
}) => {
  const [isExpanded, setIsExpanded] = useState(!collapsible);
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  return (
    <div className="search-filters">
      {collapsible && (
        <button
          className="filters-toggle"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
        >
          <FilterIcon />
          Filters ({activeFilterCount})
          <ExpandIcon rotated={isExpanded} />
        </button>
      )}

      {isExpanded && (
        <div className="filters-content">
          <BasicFilters />
          {showAdvanced && <AdvancedFilters />}
          <FilterActions />
        </div>
      )}
    </div>
  );
};
```

### Filter Types

#### Category Filter
```typescript
const CategoryFilter: React.FC<{
  selected: string[];
  available: string[];
  onChange: (categories: string[]) => void;
}> = ({ selected, available, onChange }) => (
  <FilterGroup title="Categories">
    {available.map(category => (
      <FilterCheckbox
        key={category}
        label={category}
        checked={selected.includes(category)}
        onChange={(checked) => {
          if (checked) {
            onChange([...selected, category]);
          } else {
            onChange(selected.filter(c => c !== category));
          }
        }}
      />
    ))}
  </FilterGroup>
);
```

#### Tag Filter with Auto-complete
```typescript
const TagFilter: React.FC = () => {
  const [tagInput, setTagInput] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const handleTagInput = async (value: string) => {
    setTagInput(value);
    if (value.length > 1) {
      const tagSuggestions = await getTagSuggestions(value);
      setSuggestions(tagSuggestions);
    }
  };

  return (
    <FilterGroup title="Tags">
      <TagInput
        value={tagInput}
        onChange={handleTagInput}
        suggestions={suggestions}
        selectedTags={filters.tags || []}
        onTagAdd={handleTagAdd}
        onTagRemove={handleTagRemove}
        placeholder="Add tag filter..."
      />
    </FilterGroup>
  );
};
```

#### Date Range Filter
```typescript
const DateRangeFilter: React.FC = () => (
  <FilterGroup title="Date Range">
    <DateRangePicker
      start={filters.dateRange?.start}
      end={filters.dateRange?.end}
      onChange={(range) => updateFilters({ dateRange: range })}
      presets={[
        { label: 'Last week', value: getLastWeek() },
        { label: 'Last month', value: getLastMonth() },
        { label: 'Last quarter', value: getLastQuarter() }
      ]}
    />
  </FilterGroup>
);
```

### Advanced Filters

#### Usage Range Filter
```typescript
const UsageRangeFilter: React.FC = () => (
  <FilterGroup title="Usage Count">
    <RangeSlider
      min={0}
      max={1000}
      value={[filters.usageRange?.min || 0, filters.usageRange?.max || 1000]}
      onChange={([min, max]) => updateFilters({
        usageRange: { min, max }
      })}
      formatValue={(value) => `${value} uses`}
    />
  </FilterGroup>
);
```

#### Success Rate Filter
```typescript
const SuccessRateFilter: React.FC = () => (
  <FilterGroup title="Success Rate">
    <RangeSlider
      min={0}
      max={100}
      value={[filters.successRate?.min || 0, filters.successRate?.max || 100]}
      onChange={([min, max]) => updateFilters({
        successRate: { min, max }
      })}
      formatValue={(value) => `${value}%`}
      step={5}
    />
  </FilterGroup>
);
```

### Saved Filters

```typescript
const SavedFilters: React.FC = () => {
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);

  const handleSaveFilter = (name: string) => {
    const filter: SavedFilter = {
      id: generateId(),
      name,
      filters: currentFilters,
      createdAt: new Date()
    };
    setSavedFilters(prev => [...prev, filter]);
    localStorage.setItem('kb-saved-filters', JSON.stringify([...savedFilters, filter]));
  };

  const handleLoadFilter = (filter: SavedFilter) => {
    onFiltersChange(filter.filters);
  };

  return (
    <div className="saved-filters">
      <h4>Saved Filters</h4>
      {savedFilters.map(filter => (
        <div key={filter.id} className="saved-filter">
          <button onClick={() => handleLoadFilter(filter)}>
            {filter.name}
          </button>
          <button onClick={() => handleDeleteFilter(filter.id)}>
            ×
          </button>
        </div>
      ))}

      <button onClick={() => setShowSaveDialog(true)}>
        Save Current Filters
      </button>
    </div>
  );
};
```

---

## BatchOperationsPanel

Panel for managing batch operations on selected entries.

### Component Interface

```typescript
interface BatchOperationsPanelProps {
  /** Selected entries */
  selectedEntries: KBEntryListItem[];

  /** Available operations */
  availableOperations: BatchOperation[];

  /** Operation handlers */
  onOperation: (operation: string, entries: KBEntryListItem[]) => Promise<void>;
  onClearSelection: () => void;

  /** Display options */
  position?: 'top' | 'bottom' | 'floating';
  showProgress?: boolean;
}

interface BatchOperation {
  id: string;
  label: string;
  icon: string;
  description: string;
  requiresConfirmation?: boolean;
  permissions?: string[];
  disabled?: boolean;
}
```

### Component Implementation

```typescript
export const BatchOperationsPanel: React.FC<BatchOperationsPanelProps> = ({
  selectedEntries,
  availableOperations,
  onOperation,
  onClearSelection,
  position = 'top',
  showProgress = true
}) => {
  const [activeOperation, setActiveOperation] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const handleOperation = async (operationId: string) => {
    const operation = availableOperations.find(op => op.id === operationId);
    if (!operation) return;

    if (operation.requiresConfirmation) {
      const confirmed = await showConfirmationDialog({
        title: `Confirm ${operation.label}`,
        message: `Are you sure you want to ${operation.label.toLowerCase()} ${selectedEntries.length} entries?`,
        confirmLabel: operation.label,
        cancelLabel: 'Cancel'
      });

      if (!confirmed) return;
    }

    try {
      setActiveOperation(operationId);
      await onOperation(operationId, selectedEntries);
    } catch (error) {
      showErrorDialog({
        title: 'Operation Failed',
        message: `Failed to ${operation.label.toLowerCase()}: ${error.message}`
      });
    } finally {
      setActiveOperation(null);
      setProgress(0);
    }
  };

  if (selectedEntries.length === 0) return null;

  return (
    <div className={`batch-operations-panel ${position}`} role="toolbar">
      <div className="batch-info">
        <span className="selection-count">
          {selectedEntries.length} selected
        </span>

        {showProgress && activeOperation && (
          <ProgressBar
            value={progress}
            max={100}
            label={`Processing ${activeOperation}...`}
          />
        )}
      </div>

      <div className="batch-actions">
        {availableOperations.map(operation => (
          <BatchOperationButton
            key={operation.id}
            operation={operation}
            onClick={() => handleOperation(operation.id)}
            disabled={operation.disabled || activeOperation !== null}
            loading={activeOperation === operation.id}
          />
        ))}
      </div>

      <div className="batch-controls">
        <button
          onClick={onClearSelection}
          className="clear-selection"
          aria-label="Clear selection"
        >
          Clear Selection
        </button>
      </div>
    </div>
  );
};
```

### Batch Operations

#### Standard Operations

```typescript
const standardOperations: BatchOperation[] = [
  {
    id: 'edit',
    label: 'Edit',
    icon: '✏️',
    description: 'Edit multiple entries at once',
    requiresConfirmation: false,
    permissions: ['edit']
  },
  {
    id: 'duplicate',
    label: 'Duplicate',
    icon: '📋',
    description: 'Create copies of selected entries',
    requiresConfirmation: false,
    permissions: ['create']
  },
  {
    id: 'export',
    label: 'Export',
    icon: '📤',
    description: 'Export selected entries to file',
    requiresConfirmation: false,
    permissions: []
  },
  {
    id: 'delete',
    label: 'Delete',
    icon: '🗑️',
    description: 'Delete selected entries',
    requiresConfirmation: true,
    permissions: ['delete']
  },
  {
    id: 'archive',
    label: 'Archive',
    icon: '📦',
    description: 'Archive selected entries',
    requiresConfirmation: true,
    permissions: ['edit']
  }
];
```

#### Progress Tracking

```typescript
const BatchOperationWithProgress: React.FC = () => {
  const handleBatchOperation = async (operation: string, entries: KBEntryListItem[]) => {
    const total = entries.length;
    let completed = 0;

    setProgress(0);
    setActiveOperation(operation);

    try {
      for (const entry of entries) {
        await performSingleOperation(operation, entry);
        completed++;
        setProgress((completed / total) * 100);
      }
    } finally {
      setActiveOperation(null);
      setProgress(0);
    }
  };

  return (
    <BatchOperationsPanel
      selectedEntries={selectedEntries}
      availableOperations={standardOperations}
      onOperation={handleBatchOperation}
      showProgress={true}
    />
  );
};
```

---

## MetricsDashboard

Dashboard component for displaying knowledge base analytics and metrics.

### Component Interface

```typescript
interface MetricsDashboardProps {
  /** Data source */
  stats: DatabaseStats;

  /** Display options */
  showCharts?: boolean;
  showTables?: boolean;
  refreshInterval?: number;

  /** Event handlers */
  onRefresh?: () => void;
  onExportMetrics?: () => void;

  /** Layout options */
  columns?: number;
  compact?: boolean;
}
```

### Dashboard Layout

```typescript
export const MetricsDashboard: React.FC<MetricsDashboardProps> = ({
  stats,
  showCharts = true,
  showTables = true,
  refreshInterval = 30000,
  columns = 3,
  compact = false
}) => {
  return (
    <div className={`metrics-dashboard ${compact ? 'compact' : ''}`}>
      <DashboardHeader>
        <h2>Knowledge Base Metrics</h2>
        <RefreshButton onRefresh={onRefresh} />
        <ExportButton onExport={onExportMetrics} />
      </DashboardHeader>

      <MetricsGrid columns={columns}>
        <OverviewMetrics stats={stats} />
        <UsageMetrics stats={stats} />
        <PerformanceMetrics stats={stats} />

        {showCharts && (
          <>
            <CategoryChart data={stats.categoryCounts} />
            <UsageTrendChart data={stats.usageTrends} />
            <SuccessRateChart data={stats.successRates} />
          </>
        )}

        {showTables && (
          <>
            <TopEntriesTable entries={stats.topEntries} />
            <RecentActivityTable activities={stats.recentActivities} />
          </>
        )}
      </MetricsGrid>
    </div>
  );
};
```

### Metric Components

#### Overview Metrics
```typescript
const OverviewMetrics: React.FC<{ stats: DatabaseStats }> = ({ stats }) => (
  <MetricCard title="Overview">
    <MetricRow
      label="Total Entries"
      value={stats.totalEntries}
      icon="📚"
    />
    <MetricRow
      label="Active Users"
      value={stats.activeUsers}
      icon="👥"
    />
    <MetricRow
      label="Searches Today"
      value={stats.searchesToday}
      icon="🔍"
      trend={stats.searchTrend}
    />
    <MetricRow
      label="Success Rate"
      value={`${stats.averageSuccessRate}%`}
      icon="✅"
      color={stats.averageSuccessRate > 80 ? 'green' : 'orange'}
    />
  </MetricCard>
);
```

#### Category Distribution Chart
```typescript
const CategoryChart: React.FC<{ data: Record<string, number> }> = ({ data }) => {
  const chartData = Object.entries(data).map(([name, count]) => ({
    name,
    count,
    percentage: (count / Object.values(data).reduce((a, b) => a + b, 0)) * 100
  }));

  return (
    <MetricCard title="Category Distribution">
      <PieChart
        data={chartData}
        dataKey="count"
        nameKey="name"
        colors={CATEGORY_COLORS}
        showLabels={true}
        showLegend={true}
      />
    </MetricCard>
  );
};
```

---

## Component Composition

### Complete Integration Example

```typescript
// Main KB application composed of all components
export const KnowledgeBaseApp: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<FilterState>({});
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  const [showMetrics, setShowMetrics] = useState(false);

  const { entries, stats, loading, error } = useKBData(db, {
    autoRefresh: 30000,
    realTimeUpdates: true
  });

  return (
    <div className="kb-app">
      <AppHeader>
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          autoComplete={true}
          suggestions={searchSuggestions}
        />

        <QuickActions>
          <button onClick={() => setShowMetrics(!showMetrics)}>
            📊 Metrics
          </button>
          <button onClick={handleAddEntry}>
            + Add Entry
          </button>
        </QuickActions>
      </AppHeader>

      <AppBody>
        <Sidebar>
          <SearchFilters
            filters={filters}
            availableCategories={getAllCategories(entries)}
            availableTags={getAllTags(entries)}
            availableSeverities={['critical', 'high', 'medium', 'low']}
            onFiltersChange={setFilters}
            onClearFilters={() => setFilters({})}
            showAdvanced={true}
            collapsible={true}
          />
        </Sidebar>

        <MainContent>
          {selectedEntries.size > 0 && (
            <BatchOperationsPanel
              selectedEntries={Array.from(selectedEntries).map(id =>
                entries.find(e => e.id === id)
              ).filter(Boolean)}
              availableOperations={getBatchOperations()}
              onOperation={handleBatchOperation}
              onClearSelection={() => setSelectedEntries(new Set())}
              position="top"
              showProgress={true}
            />
          )}

          <AdvancedKBEntryList
            height={600}
            searchQuery={searchQuery}
            categoryFilter={filters.categories?.[0]}
            tagFilter={filters.tags}
            sortBy="relevance"
            viewMode="list"
            showPreview={true}
            showMetrics={true}
            enableBatchSelect={true}
            enableInlineEdit={true}
            onEntrySelect={handleEntrySelect}
            onBatchOperation={handleBatchOperation}
          />

          {showMetrics && (
            <MetricsDashboard
              stats={stats}
              showCharts={true}
              showTables={true}
              refreshInterval={30000}
              columns={3}
            />
          )}
        </MainContent>
      </AppBody>
    </div>
  );
};
```

---

## Styling & Theming

### CSS Architecture

The component styling follows a modular CSS architecture with BEM methodology:

```scss
// Component-specific styles
.kb-entry-list {
  &__container {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  &__toolbar {
    flex: 0 0 auto;
    padding: var(--spacing-md);
    border-bottom: 1px solid var(--color-border);
  }

  &__items {
    flex: 1 1 auto;
    overflow: hidden;
  }
}

.kb-entry-item {
  display: flex;
  align-items: flex-start;
  padding: var(--spacing-md);
  border-bottom: 1px solid var(--color-border-light);
  transition: background-color 0.2s ease;

  &:hover {
    background-color: var(--color-bg-hover);
  }

  &--selected {
    background-color: var(--color-bg-selected);
    border-color: var(--color-primary);
  }

  &--editing {
    background-color: var(--color-bg-edit);
    box-shadow: inset 2px 0 0 var(--color-primary);
  }
}
```

### CSS Custom Properties

```css
:root {
  /* Colors */
  --color-primary: #007acc;
  --color-secondary: #6c757d;
  --color-success: #28a745;
  --color-warning: #ffc107;
  --color-danger: #dc3545;
  --color-info: #17a2b8;

  /* Backgrounds */
  --color-bg: #ffffff;
  --color-bg-secondary: #f8f9fa;
  --color-bg-hover: #f0f0f0;
  --color-bg-selected: #e3f2fd;
  --color-bg-edit: #fff3cd;

  /* Borders */
  --color-border: #dee2e6;
  --color-border-light: #e9ecef;

  /* Spacing */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;

  /* Typography */
  --font-family-primary: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-family-mono: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
  --font-size-xs: 0.75rem;
  --font-size-sm: 0.875rem;
  --font-size-base: 1rem;
  --font-size-lg: 1.125rem;
  --font-size-xl: 1.25rem;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
}
```

### Theme Support

```typescript
interface Theme {
  name: string;
  colors: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
    success: string;
    warning: string;
    error: string;
  };
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  typography: {
    fontFamily: string;
    fontSize: Record<string, string>;
    fontWeight: Record<string, string | number>;
  };
  shadows: Record<string, string>;
}

const lightTheme: Theme = {
  name: 'light',
  colors: {
    primary: '#007acc',
    secondary: '#6c757d',
    background: '#ffffff',
    surface: '#f8f9fa',
    text: '#212529',
    textSecondary: '#6c757d',
    border: '#dee2e6',
    success: '#28a745',
    warning: '#ffc107',
    error: '#dc3545'
  },
  // ... rest of theme configuration
};

const darkTheme: Theme = {
  name: 'dark',
  colors: {
    primary: '#4fc3f7',
    secondary: '#90a4ae',
    background: '#121212',
    surface: '#1e1e1e',
    text: '#ffffff',
    textSecondary: '#b0b0b0',
    border: '#333333',
    success: '#4caf50',
    warning: '#ff9800',
    error: '#f44336'
  },
  // ... rest of theme configuration
};
```

---

## Accessibility Features

### ARIA Support

All components include comprehensive ARIA support:

```typescript
// List container
<div
  role="listbox"
  aria-label={ariaLabel}
  aria-multiselectable={enableBatchSelect}
  aria-activedescendant={`entry-${focusedIndex}`}
>

// Individual entries
<div
  role="option"
  aria-selected={isSelected}
  aria-label={`Knowledge base entry: ${entry.title}`}
  id={`entry-${index}`}
  tabIndex={isFocused ? 0 : -1}
>

// Batch operations
<div role="toolbar" aria-label="Batch operations">
  <button
    aria-label={`${operation.label} ${selectedCount} entries`}
    aria-describedby={`${operation.id}-description`}
  >
    {operation.label}
  </button>
</div>
```

### Keyboard Navigation

```typescript
const useKeyboardNavigation = ({
  itemCount,
  focusedIndex,
  onFocusChange,
  onSelect,
  onToggleSelect
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          onFocusChange(Math.min(itemCount - 1, focusedIndex + 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          onFocusChange(Math.max(0, focusedIndex - 1));
          break;
        case 'Home':
          e.preventDefault();
          onFocusChange(0);
          break;
        case 'End':
          e.preventDefault();
          onFocusChange(itemCount - 1);
          break;
        case 'Enter':
          e.preventDefault();
          onSelect(focusedIndex);
          break;
        case ' ':
          e.preventDefault();
          onToggleSelect(focusedIndex);
          break;
        case 'PageDown':
          e.preventDefault();
          onFocusChange(Math.min(itemCount - 1, focusedIndex + 10));
          break;
        case 'PageUp':
          e.preventDefault();
          onFocusChange(Math.max(0, focusedIndex - 10));
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [itemCount, focusedIndex, onFocusChange, onSelect, onToggleSelect]);
};
```

### Screen Reader Support

```typescript
// Announcements for screen readers
const announceChange = (message: string) => {
  const announcement = document.createElement('div');
  announcement.setAttribute('aria-live', 'polite');
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = message;

  document.body.appendChild(announcement);

  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
};

// Usage in components
useEffect(() => {
  if (announceChanges && selectedIds.size > 0) {
    announceChange(`${selectedIds.size} entries selected`);
  }
}, [selectedIds.size, announceChanges]);
```

---

## Performance Optimizations

### Virtual Scrolling Implementation

```typescript
// Optimized virtual list rendering
const VirtualizedKBList: React.FC = () => {
  const listRef = useRef<FixedSizeList>(null);

  // Memoized item data to prevent unnecessary re-renders
  const itemData = useMemo(() => ({
    entries: processedEntries,
    selectedIds,
    editingId,
    viewMode,
    showPreview,
    showMetrics,
    onSelect: handleEntrySelect,
    onToggleSelect: handleEntryToggleSelect,
    onEdit: handleEntryEdit,
    onSave: handleEntrySave,
    onCancel: handleEntryCancel,
    onQuickAction: handleQuickAction
  }), [
    processedEntries,
    selectedIds,
    editingId,
    viewMode,
    showPreview,
    showMetrics,
    // ... memoized callbacks
  ]);

  return (
    <FixedSizeList
      ref={listRef}
      height={height}
      itemCount={processedEntries.length}
      itemSize={itemHeight}
      itemData={itemData}
      overscanCount={5} // Render 5 items outside visible area
    >
      {KBEntryItem}
    </FixedSizeList>
  );
};
```

### Memoization Strategies

```typescript
// Component memoization
const KBEntryItem = memo<KBEntryItemProps>(({ index, style, data }) => {
  // Component implementation...
}, (prevProps, nextProps) => {
  // Custom comparison for optimal re-rendering
  const prevEntry = prevProps.data.entries[prevProps.index];
  const nextEntry = nextProps.data.entries[nextProps.index];

  return (
    prevEntry?.id === nextEntry?.id &&
    prevEntry?.title === nextEntry?.title &&
    prevEntry?.updated_at === nextEntry?.updated_at &&
    prevProps.data.selectedIds === nextProps.data.selectedIds &&
    prevProps.data.editingId === nextProps.data.editingId
  );
});

// Hook memoization
const useOptimizedKBData = () => {
  const memoizedSearchEntries = useCallback(
    debounce(async (options: SearchOptions) => {
      return await db.search(options.query, options);
    }, 300),
    [db]
  );

  return { searchEntries: memoizedSearchEntries };
};
```

### Lazy Loading

```typescript
// Lazy loading for large datasets
const useLazyKBData = (pageSize: number = 50) => {
  const [entries, setEntries] = useState<KBEntry[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;

    setLoading(true);
    try {
      const newEntries = await db.getEntries({
        limit: pageSize,
        offset: entries.length
      });

      if (newEntries.length < pageSize) {
        setHasMore(false);
      }

      setEntries(prev => [...prev, ...newEntries]);
    } catch (error) {
      console.error('Failed to load more entries:', error);
    } finally {
      setLoading(false);
    }
  }, [entries.length, pageSize, loading, hasMore, db]);

  return { entries, hasMore, loading, loadMore };
};
```

This comprehensive component architecture documentation provides developers with detailed understanding of how to use, extend, and customize the Knowledge Base Listing & Filtering components effectively.