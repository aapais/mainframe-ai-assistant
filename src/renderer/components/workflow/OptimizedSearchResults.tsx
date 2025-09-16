/**
 * Optimized Search Results Component
 * Progressive disclosure with improved visual hierarchy and quick actions
 */

import React, { useState, useCallback, memo } from 'react';

interface KBEntry {
  id: string;
  title: string;
  problem: string;
  solution: string;
  category: string;
  tags?: string[];
  usage_count?: number;
  success_count?: number;
  failure_count?: number;
  created_at?: string;
  score?: number;
}

interface QuickAction {
  id: string;
  label: string;
  icon: string;
  action: (entry: KBEntry) => void;
  shortcut?: string;
}

interface OptimizedSearchResultsProps {
  entries: KBEntry[];
  onEntrySelect: (entry: KBEntry) => void;
  onQuickAction: (action: string, entry: KBEntry) => void;
  viewMode?: 'minimal' | 'compact' | 'detailed';
  selectedEntryId?: string;
  loading?: boolean;
}

export const OptimizedSearchResults = memo<OptimizedSearchResultsProps>(({
  entries,
  onEntrySelect,
  onQuickAction,
  viewMode = 'compact',
  selectedEntryId,
  loading = false
}) => {
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());
  const [hoveredEntry, setHoveredEntry] = useState<string | null>(null);

  const toggleExpanded = useCallback((entryId: string) => {
    setExpandedEntries(prev => {
      const newSet = new Set(prev);
      if (newSet.has(entryId)) {
        newSet.delete(entryId);
      } else {
        newSet.add(entryId);
      }
      return newSet;
    });
  }, []);

  const quickActions: QuickAction[] = [
    {
      id: 'copy',
      label: 'Copy Solution',
      icon: '📋',
      action: (entry) => {
        navigator.clipboard.writeText(entry.solution);
        onQuickAction('copy', entry);
      },
      shortcut: 'C'
    },
    {
      id: 'solved',
      label: 'Mark Solved',
      icon: '✅',
      action: (entry) => onQuickAction('markSolved', entry),
      shortcut: 'S'
    },
    {
      id: 'edit',
      label: 'Quick Edit',
      icon: '✏️',
      action: (entry) => onQuickAction('edit', entry),
      shortcut: 'E'
    },
    {
      id: 'bookmark',
      label: 'Bookmark',
      icon: '🔖',
      action: (entry) => onQuickAction('bookmark', entry),
      shortcut: 'B'
    }
  ];

  const calculateSuccessRate = (entry: KBEntry): number => {
    const total = entry.usage_count || 0;
    const successful = entry.success_count || 0;
    return total > 0 ? Math.round((successful / total) * 100) : 0;
  };

  const getScoreColor = (score: number): string => {
    if (score >= 80) return '#10b981'; // green
    if (score >= 60) return '#f59e0b'; // yellow
    return '#ef4444'; // red
  };

  const getSuccessRateColor = (rate: number): string => {
    if (rate >= 80) return '#10b981';
    if (rate >= 60) return '#f59e0b';
    return '#ef4444';
  };

  // Styles
  const containerStyle: React.CSSProperties = {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    border: '1px solid #e5e7eb',
    overflow: 'hidden',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
  };

  const loadingStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '3rem',
    color: '#6b7280',
    fontSize: '1rem'
  };

  const emptyStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4rem 2rem',
    textAlign: 'center',
    color: '#6b7280'
  };

  const resultCardStyle: React.CSSProperties = {
    padding: viewMode === 'minimal' ? '12px 16px' : '20px',
    borderBottom: '1px solid #f3f4f6',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    position: 'relative'
  };

  const selectedCardStyle: React.CSSProperties = {
    ...resultCardStyle,
    backgroundColor: '#eff6ff',
    borderLeft: '4px solid #3b82f6',
    transform: 'translateX(2px)'
  };

  const hoveredCardStyle: React.CSSProperties = {
    ...resultCardStyle,
    backgroundColor: '#f9fafb',
    transform: 'translateX(1px)',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
  };

  const primaryInfoStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: viewMode === 'minimal' ? '8px' : '12px'
  };

  const titleStyle: React.CSSProperties = {
    fontSize: viewMode === 'minimal' ? '1rem' : '1.125rem',
    fontWeight: '600',
    color: '#111827',
    margin: 0,
    flex: 1,
    lineHeight: '1.4'
  };

  const metricsStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginLeft: '16px',
    flexShrink: 0
  };

  const metricBadgeStyle: React.CSSProperties = {
    padding: '4px 8px',
    borderRadius: '6px',
    fontSize: '0.75rem',
    fontWeight: '600',
    lineHeight: 1
  };

  const categoryBadgeStyle: React.CSSProperties = {
    ...metricBadgeStyle,
    backgroundColor: '#e0e7ff',
    color: '#3730a3'
  };

  const secondaryInfoStyle: React.CSSProperties = {
    fontSize: '0.875rem',
    color: '#4b5563',
    lineHeight: '1.5',
    marginBottom: '12px'
  };

  const tagsStyle: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
    marginBottom: '12px'
  };

  const tagStyle: React.CSSProperties = {
    padding: '2px 6px',
    fontSize: '0.625rem',
    backgroundColor: '#f3f4f6',
    color: '#374151',
    borderRadius: '4px',
    border: '1px solid #e5e7eb'
  };

  const quickActionsStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: '12px',
    paddingTop: '12px',
    borderTop: '1px solid #f3f4f6'
  };

  const usageStatsStyle: React.CSSProperties = {
    fontSize: '0.75rem',
    color: '#6b7280',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  };

  const actionButtonsStyle: React.CSSProperties = {
    display: 'flex',
    gap: '6px'
  };

  const actionButtonStyle: React.CSSProperties = {
    padding: '6px 10px',
    fontSize: '0.75rem',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    cursor: 'pointer',
    backgroundColor: '#ffffff',
    color: '#374151',
    transition: 'all 0.15s ease',
    display: 'flex',
    alignItems: 'center',
    gap: '4px'
  };

  const solutionPreviewStyle: React.CSSProperties = {
    marginTop: '12px',
    padding: '12px',
    backgroundColor: '#f0fdf4',
    border: '1px solid #bbf7d0',
    borderRadius: '6px',
    fontSize: '0.875rem',
    color: '#15803d',
    lineHeight: '1.5'
  };

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={loadingStyle}>
          <div style={{
            width: '24px',
            height: '24px',
            border: '2px solid #f3f4f6',
            borderTop: '2px solid #3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            marginRight: '12px'
          }} />
          Optimizing search results...
        </div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div style={containerStyle}>
        <div style={emptyStyle}>
          <div style={{ fontSize: '4rem', marginBottom: '16px' }}>🔍</div>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '1.5rem', color: '#374151' }}>
            No solutions found
          </h3>
          <p style={{ margin: 0, fontSize: '1rem', maxWidth: '400px' }}>
            Try adjusting your search terms, checking spelling, or exploring different categories.
          </p>
          <div style={{ marginTop: '24px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button style={{
              padding: '8px 16px',
              backgroundColor: '#f3f4f6',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.875rem'
            }}>
              Browse All Categories
            </button>
            <button style={{
              padding: '8px 16px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.875rem'
            }}>
              Add New Solution
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>

      {entries.map((entry, index) => {
        const isSelected = entry.id === selectedEntryId;
        const isExpanded = expandedEntries.has(entry.id);
        const isHovered = hoveredEntry === entry.id;
        const successRate = calculateSuccessRate(entry);

        let cardStyle = resultCardStyle;
        if (isSelected) cardStyle = selectedCardStyle;
        else if (isHovered) cardStyle = hoveredCardStyle;

        return (
          <div
            key={entry.id}
            style={cardStyle}
            onClick={() => onEntrySelect(entry)}
            onMouseEnter={() => setHoveredEntry(entry.id)}
            onMouseLeave={() => setHoveredEntry(null)}
          >
            {/* Primary Information - Always Visible */}
            <div style={primaryInfoStyle}>
              <h3 style={titleStyle}>{entry.title}</h3>
              <div style={metricsStyle}>
                {entry.score && (
                  <span style={{
                    ...metricBadgeStyle,
                    backgroundColor: getScoreColor(entry.score) + '20',
                    color: getScoreColor(entry.score),
                    fontWeight: '700'
                  }}>
                    {Math.round(entry.score)}% match
                  </span>
                )}
                <span style={{
                  ...metricBadgeStyle,
                  backgroundColor: getSuccessRateColor(successRate) + '20',
                  color: getSuccessRateColor(successRate)
                }}>
                  {successRate}% success
                </span>
                <span style={categoryBadgeStyle}>
                  {entry.category}
                </span>
              </div>
            </div>

            {/* Secondary Information - Visible in compact/detailed mode */}
            {viewMode !== 'minimal' && (
              <div style={secondaryInfoStyle}>
                {isExpanded || viewMode === 'detailed'
                  ? entry.problem
                  : `${entry.problem.substring(0, 150)}${entry.problem.length > 150 ? '...' : ''}`
                }
              </div>
            )}

            {/* Tags - Visible when hovered or expanded */}
            {(isHovered || isExpanded || viewMode === 'detailed') && entry.tags && entry.tags.length > 0 && (
              <div style={tagsStyle}>
                {entry.tags.slice(0, isExpanded ? entry.tags.length : 4).map(tag => (
                  <span key={tag} style={tagStyle}>{tag}</span>
                ))}
                {!isExpanded && entry.tags.length > 4 && (
                  <span style={{...tagStyle, color: '#6b7280'}}>
                    +{entry.tags.length - 4} more
                  </span>
                )}
              </div>
            )}

            {/* Solution Preview - Visible when expanded */}
            {isExpanded && (
              <div style={solutionPreviewStyle}>
                <h4 style={{
                  margin: '0 0 8px 0',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  color: '#15803d'
                }}>
                  Solution:
                </h4>
                <div style={{ whiteSpace: 'pre-wrap' }}>
                  {entry.solution}
                </div>
              </div>
            )}

            {/* Quick Actions - Always visible for better accessibility */}
            <div style={quickActionsStyle}>
              <div style={usageStatsStyle}>
                <span>Used {entry.usage_count || 0} times</span>
                {entry.created_at && (
                  <span>• Added {new Date(entry.created_at).toLocaleDateString()}</span>
                )}
              </div>

              <div style={actionButtonsStyle}>
                {quickActions.map(action => (
                  <button
                    key={action.id}
                    style={actionButtonStyle}
                    onClick={(e) => {
                      e.stopPropagation();
                      action.action(entry);
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#f3f4f6';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#ffffff';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                    title={`${action.label}${action.shortcut ? ` (${action.shortcut})` : ''}`}
                  >
                    <span>{action.icon}</span>
                    {(isHovered || isSelected) && (
                      <span style={{ fontSize: '0.75rem' }}>{action.label}</span>
                    )}
                  </button>
                ))}
                <button
                  style={actionButtonStyle}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleExpanded(entry.id);
                  }}
                  title={isExpanded ? "Collapse details" : "Expand details"}
                >
                  <span>{isExpanded ? '▲' : '▼'}</span>
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
});

OptimizedSearchResults.displayName = 'OptimizedSearchResults';