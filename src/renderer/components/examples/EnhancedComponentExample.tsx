import React, { useState, useCallback } from 'react';
import { BaseComponent } from '../base/ComponentBase';
import { useEnhancedState, StateAction } from '../state/StateManager';
import { withLoading, withPerformance, withAccessibility, compose } from '../../../components/patterns/CompositionPatterns';
import { VirtualList } from '../virtualization/VirtualScrolling';
import { useTheme, ThemeProvider } from '../design-system/ThemeSystem';
import { useFocusManagement, useAnnouncements } from '../accessibility/AccessibilityUtils';
import { performanceMonitor } from '../performance/PerformanceMonitoring';

/**
 * Example implementation showcasing all enhanced component patterns
 */

// Example data interface
interface KBEntry {
  id: string;
  title: string;
  problem: string;
  solution: string;
  category: string;
  tags: string[];
  usage_count: number;
}

// State management for KB entries
interface KBState {
  entries: KBEntry[];
  selectedEntry: KBEntry | null;
  loading: boolean;
  filter: string;
  sortBy: 'title' | 'usage' | 'category';
}

const initialState: KBState = {
  entries: [],
  selectedEntry: null,
  loading: false,
  filter: '',
  sortBy: 'title'
};

const kbActions = {
  setEntries: (state: KBState, action: StateAction) => ({
    ...state,
    entries: action.payload,
    loading: false
  }),
  setLoading: (state: KBState, action: StateAction) => ({
    ...state,
    loading: action.payload
  }),
  selectEntry: (state: KBState, action: StateAction) => ({
    ...state,
    selectedEntry: action.payload
  }),
  setFilter: (state: KBState, action: StateAction) => ({
    ...state,
    filter: action.payload
  }),
  setSortBy: (state: KBState, action: StateAction) => ({
    ...state,
    sortBy: action.payload
  })
};

// Enhanced KnowledgeBase component using composition patterns
const KnowledgeBaseComponent: React.FC = () => {
  const { theme } = useTheme();
  const { announce } = useAnnouncements();
  const [state, dispatch] = useEnhancedState({
    initialState,
    actions: kbActions,
    persistence: {
      key: 'kb-state',
      storage: 'localStorage'
    },
    devTools: true
  });

  // Mock data for demonstration
  const mockEntries: KBEntry[] = Array.from({ length: 1000 }, (_, index) => ({
    id: `entry-${index}`,
    title: `Knowledge Entry ${index + 1}`,
    problem: `Sample problem description for entry ${index + 1}`,
    solution: `Sample solution for entry ${index + 1}`,
    category: ['JCL', 'VSAM', 'DB2', 'Batch'][index % 4],
    tags: [`tag-${index % 5}`, `category-${index % 3}`],
    usage_count: Math.floor(Math.random() * 100)
  }));

  React.useEffect(() => {
    dispatch({ type: 'setEntries', payload: mockEntries });
  }, [dispatch]);

  const filteredEntries = React.useMemo(() => {
    let filtered = state.entries.filter(entry =>
      entry.title.toLowerCase().includes(state.filter.toLowerCase()) ||
      entry.problem.toLowerCase().includes(state.filter.toLowerCase())
    );

    return filtered.sort((a, b) => {
      switch (state.sortBy) {
        case 'usage':
          return b.usage_count - a.usage_count;
        case 'category':
          return a.category.localeCompare(b.category);
        default:
          return a.title.localeCompare(b.title);
      }
    });
  }, [state.entries, state.filter, state.sortBy]);

  const handleEntrySelect = useCallback((entry: KBEntry) => {
    dispatch({ type: 'selectEntry', payload: entry });
    announce(`Selected entry: ${entry.title}`);
  }, [dispatch, announce]);

  const handleFilterChange = useCallback((filter: string) => {
    dispatch({ type: 'setFilter', payload: filter });
    announce(`Filter updated. ${filteredEntries.length} entries found`);
  }, [dispatch, announce, filteredEntries.length]);

  const renderEntry = ({ index, item, style }: any) => (
    <div
      style={{
        ...style,
        padding: theme.spacing[4],
        borderBottom: `1px solid ${theme.colors.border.default}`,
        cursor: 'pointer',
        backgroundColor: state.selectedEntry?.id === item.id 
          ? theme.colors.primary[100] 
          : theme.colors.background.paper
      }}
      onClick={() => handleEntrySelect(item)}
      role="button"
      tabIndex={0}
      aria-label={`Knowledge entry: ${item.title}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleEntrySelect(item);
        }
      }}
    >
      <h3 style={{ margin: '0 0 8px 0', color: theme.colors.text.primary }}>
        {item.title}
      </h3>
      <p style={{ 
        margin: '0 0 8px 0', 
        color: theme.colors.text.secondary,
        fontSize: theme.typography.fontSize.sm
      }}>
        {item.problem.substring(0, 100)}...
      </p>
      <div style={{ display: 'flex', gap: theme.spacing[2], alignItems: 'center' }}>
        <span style={{
          padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
          backgroundColor: theme.colors.primary[500],
          color: theme.colors.text.inverse,
          fontSize: theme.typography.fontSize.xs,
          borderRadius: theme.borderRadius.sm
        }}>
          {item.category}
        </span>
        <span style={{ 
          fontSize: theme.typography.fontSize.xs, 
          color: theme.colors.text.secondary 
        }}>
          Used {item.usage_count} times
        </span>
      </div>
    </div>
  );

  return (
    <div style={{ 
      display: 'flex', 
      height: '100vh', 
      backgroundColor: theme.colors.background.default,
      fontFamily: theme.typography.fontFamily.sans
    }}>
      {/* Left Panel - Entry List */}
      <div style={{ 
        width: '400px', 
        borderRight: `1px solid ${theme.colors.border.default}`,
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{ 
          padding: theme.spacing[4], 
          borderBottom: `1px solid ${theme.colors.border.default}` 
        }}>
          <h2 style={{ 
            margin: '0 0 16px 0', 
            color: theme.colors.text.primary,
            fontSize: theme.typography.fontSize.xl
          }}>
            Knowledge Base
          </h2>
          
          <input
            type="text"
            placeholder="Search entries..."
            value={state.filter}
            onChange={(e) => handleFilterChange(e.target.value)}
            style={{
              width: '100%',
              padding: theme.spacing[2],
              border: `1px solid ${theme.colors.border.default}`,
              borderRadius: theme.borderRadius.base,
              fontSize: theme.typography.fontSize.base,
              backgroundColor: theme.colors.background.paper,
              color: theme.colors.text.primary
            }}
            aria-label="Search knowledge base entries"
          />
          
          <select
            value={state.sortBy}
            onChange={(e) => dispatch({ type: 'setSortBy', payload: e.target.value })}
            style={{
              marginTop: theme.spacing[2],
              width: '100%',
              padding: theme.spacing[2],
              border: `1px solid ${theme.colors.border.default}`,
              borderRadius: theme.borderRadius.base,
              backgroundColor: theme.colors.background.paper,
              color: theme.colors.text.primary
            }}
            aria-label="Sort entries by"
          >
            <option value="title">Sort by Title</option>
            <option value="usage">Sort by Usage</option>
            <option value="category">Sort by Category</option>
          </select>
          
          <div style={{ 
            marginTop: theme.spacing[2], 
            fontSize: theme.typography.fontSize.sm,
            color: theme.colors.text.secondary
          }}>
            {filteredEntries.length} entries
          </div>
        </div>
        
        <div style={{ flex: 1 }}>
          <VirtualList
            items={filteredEntries}
            itemHeight={120}
            height={window.innerHeight - 200}
            renderItem={renderEntry}
            overscan={5}
            className="kb-entry-list"
          />
        </div>
      </div>
      
      {/* Right Panel - Entry Details */}
      <div style={{ 
        flex: 1, 
        padding: theme.spacing[4],
        overflow: 'auto'
      }}>
        {state.selectedEntry ? (
          <EntryDetails entry={state.selectedEntry} />
        ) : (
          <div style={{ 
            textAlign: 'center', 
            color: theme.colors.text.secondary,
            marginTop: theme.spacing[16]
          }}>
            <h3>Select an entry to view details</h3>
            <p>Choose an entry from the list to see the full problem description and solution.</p>
          </div>
        )}
      </div>
    </div>
  );
};

// Entry details component with accessibility features
interface EntryDetailsProps {
  entry: KBEntry;
}

const EntryDetailsComponent: React.FC<EntryDetailsProps> = ({ entry }) => {
  const { theme } = useTheme();
  const { announce } = useAnnouncements();
  const [copied, setCopied] = useState(false);

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      announce('Solution copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      announce('Failed to copy to clipboard');
    }
  };

  return (
    <div>
      <header style={{ marginBottom: theme.spacing[6] }}>
        <h1 style={{ 
          margin: '0 0 16px 0',
          color: theme.colors.text.primary,
          fontSize: theme.typography.fontSize['2xl'],
          lineHeight: theme.typography.lineHeight.tight
        }}>
          {entry.title}
        </h1>
        
        <div style={{ display: 'flex', gap: theme.spacing[2], marginBottom: theme.spacing[4] }}>
          <span style={{
            padding: `${theme.spacing[1]} ${theme.spacing[3]}`,
            backgroundColor: theme.colors.primary[500],
            color: theme.colors.text.inverse,
            fontSize: theme.typography.fontSize.sm,
            borderRadius: theme.borderRadius.md,
            fontWeight: theme.typography.fontWeight.medium
          }}>
            {entry.category}
          </span>
          
          {entry.tags.map(tag => (
            <span key={tag} style={{
              padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
              backgroundColor: theme.colors.neutral[200],
              color: theme.colors.neutral[700],
              fontSize: theme.typography.fontSize.xs,
              borderRadius: theme.borderRadius.sm
            }}>
              {tag}
            </span>
          ))}
        </div>
        
        <div style={{
          fontSize: theme.typography.fontSize.sm,
          color: theme.colors.text.secondary
        }}>
          Used {entry.usage_count} times
        </div>
      </header>
      
      <main>
        <section style={{ marginBottom: theme.spacing[8] }}>
          <h2 style={{ 
            margin: '0 0 16px 0',
            color: theme.colors.text.primary,
            fontSize: theme.typography.fontSize.lg,
            fontWeight: theme.typography.fontWeight.semibold
          }}>
            Problem
          </h2>
          
          <div style={{
            padding: theme.spacing[4],
            backgroundColor: theme.colors.error[50],
            border: `1px solid ${theme.colors.error[200]}`,
            borderRadius: theme.borderRadius.md,
            lineHeight: theme.typography.lineHeight.relaxed,
            color: theme.colors.text.primary
          }}>
            {entry.problem}
          </div>
        </section>
        
        <section>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: theme.spacing[4]
          }}>
            <h2 style={{ 
              margin: 0,
              color: theme.colors.text.primary,
              fontSize: theme.typography.fontSize.lg,
              fontWeight: theme.typography.fontWeight.semibold
            }}>
              Solution
            </h2>
            
            <button
              onClick={() => handleCopy(entry.solution)}
              style={{
                padding: `${theme.spacing[2]} ${theme.spacing[4]}`,
                backgroundColor: copied ? theme.colors.success[500] : theme.colors.primary[500],
                color: theme.colors.text.inverse,
                border: 'none',
                borderRadius: theme.borderRadius.md,
                cursor: 'pointer',
                fontSize: theme.typography.fontSize.sm,
                fontWeight: theme.typography.fontWeight.medium,
                transition: `background-color ${theme.transitions.duration.normal}`
              }}
              aria-label="Copy solution to clipboard"
            >
              {copied ? 'Copied!' : 'Copy Solution'}
            </button>
          </div>
          
          <div style={{
            padding: theme.spacing[4],
            backgroundColor: theme.colors.success[50],
            border: `1px solid ${theme.colors.success[200]}`,
            borderRadius: theme.borderRadius.md,
            lineHeight: theme.typography.lineHeight.relaxed,
            whiteSpace: 'pre-wrap',
            color: theme.colors.text.primary,
            fontFamily: theme.typography.fontFamily.mono,
            fontSize: theme.typography.fontSize.sm
          }}>
            {entry.solution}
          </div>
        </section>
      </main>
    </div>
  );
};

// Apply all enhancement patterns
const EntryDetails = compose(
  withAccessibility,
  withPerformance,
  withLoading
)(EntryDetailsComponent);

const EnhancedKnowledgeBase = compose(
  withAccessibility,
  withPerformance
)(KnowledgeBaseComponent);

// Main example component with theme provider
export const EnhancedComponentExample: React.FC = () => {
  const [showPerformance, setShowPerformance] = useState(false);

  return (
    <ThemeProvider defaultTheme="light" enableSystemTheme>
      <div>
        <EnhancedKnowledgeBase />
        
        {/* Performance monitoring in development */}
        {process.env.NODE_ENV === 'development' && (
          <>
            <button
              onClick={() => setShowPerformance(!showPerformance)}
              style={{
                position: 'fixed',
                top: 10,
                right: 10,
                zIndex: 10000,
                background: '#007acc',
                border: 'none',
                color: 'white',
                padding: '8px 16px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              Toggle Performance Monitor
            </button>
            
            {showPerformance && (
              <div
                style={{
                  position: 'fixed',
                  top: 50,
                  right: 10,
                  zIndex: 9999,
                  background: 'rgba(0, 0, 0, 0.9)',
                  color: 'white',
                  padding: '16px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  maxWidth: '300px'
                }}
              >
                <h4 style={{ margin: '0 0 8px 0' }}>Performance Metrics</h4>
                <p style={{ margin: '4px 0' }}>Components monitored: Active</p>
                <p style={{ margin: '4px 0' }}>Virtual scrolling: Enabled</p>
                <p style={{ margin: '4px 0' }}>Accessibility: Active</p>
                <p style={{ margin: '4px 0' }}>Theme system: Active</p>
                <button
                  onClick={() => {
                    const report = performanceMonitor.generateReport();
                    console.log('Performance Report:', report);
                  }}
                  style={{
                    marginTop: '8px',
                    background: '#007acc',
                    border: 'none',
                    color: 'white',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '11px'
                  }}
                >
                  Generate Report
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </ThemeProvider>
  );
};

export default EnhancedComponentExample;
