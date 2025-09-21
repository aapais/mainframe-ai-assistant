/**
 * Simplified Entry List Component
 * Displays search results in a clean, simple format
 */

import React, { useState, memo } from 'react';

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

interface Props {
  entries: KBEntry[];
  onEntrySelect: (entry: KBEntry) => void;
  selectedEntryId?: string;
  loading?: boolean;
}

export const SimpleEntryList = memo<Props>(({
  entries,
  onEntrySelect,
  selectedEntryId,
  loading = false
}) => {
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());

  const toggleExpanded = (entryId: string) => {
    const newExpanded = new Set(expandedEntries);
    if (newExpanded.has(entryId)) {
      newExpanded.delete(entryId);
    } else {
      newExpanded.add(entryId);
    }
    setExpandedEntries(newExpanded);
  };

  const handleEntryClick = (entry: KBEntry) => {
    onEntrySelect(entry);
  };

  const handleRateEntry = async (entry: KBEntry, successful: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await window.electronAPI.kb.rateEntry(entry.id, successful);
      // You might want to trigger a re-fetch of entries here
      console.log(`Rated entry ${entry.id} as ${successful ? 'successful' : 'unsuccessful'}`);
    } catch (error) {
      console.error('Failed to rate entry:', error);
    }
  };

  // Styles
  const containerStyle: React.CSSProperties = {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    overflow: 'hidden',
  };

  const loadingStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
    color: '#6b7280',
  };

  const emptyStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '3rem 2rem',
    textAlign: 'center',
    color: '#6b7280',
  };

  const entryStyle: React.CSSProperties = {
    padding: '1rem',
    borderBottom: '1px solid #f3f4f6',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease',
  };

  const selectedEntryStyle: React.CSSProperties = {
    ...entryStyle,
    backgroundColor: '#eff6ff',
    borderLeft: '4px solid #3b82f6',
  };

  const entryHeaderStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: '0.5rem',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '1.125rem',
    fontWeight: '600',
    color: '#111827',
    margin: 0,
    flex: 1,
  };

  const categoryBadgeStyle: React.CSSProperties = {
    padding: '0.25rem 0.5rem',
    fontSize: '0.75rem',
    fontWeight: '500',
    color: '#ffffff',
    backgroundColor: '#3b82f6',
    borderRadius: '4px',
    marginLeft: '0.5rem',
  };

  const problemStyle: React.CSSProperties = {
    fontSize: '0.875rem',
    color: '#4b5563',
    lineHeight: '1.4',
    marginBottom: '0.75rem',
  };

  const tagsStyle: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.25rem',
    marginBottom: '0.75rem',
  };

  const tagStyle: React.CSSProperties = {
    padding: '0.125rem 0.375rem',
    fontSize: '0.75rem',
    backgroundColor: '#f3f4f6',
    color: '#374151',
    borderRadius: '12px',
    border: '1px solid #d1d5db',
  };

  const statsStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontSize: '0.75rem',
    color: '#6b7280',
  };

  const ratingButtonsStyle: React.CSSProperties = {
    display: 'flex',
    gap: '0.5rem',
  };

  const buttonStyle: React.CSSProperties = {
    padding: '0.25rem 0.5rem',
    fontSize: '0.75rem',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    backgroundColor: '#ffffff',
  };

  const successButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    ':hover': { backgroundColor: '#dcfce7', borderColor: '#16a34a' },
  };

  const failureButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    ':hover': { backgroundColor: '#fef2f2', borderColor: '#dc2626' },
  };

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={loadingStyle}>
          <div style={{
            width: '20px',
            height: '20px',
            border: '2px solid #f3f4f6',
            borderTop: '2px solid #3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            marginRight: '0.5rem',
          }} />
          Searching knowledge base...
        </div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div style={containerStyle}>
        <div style={emptyStyle}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔍</div>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', color: '#374151' }}>
            No entries found
          </h3>
          <p style={{ margin: 0, fontSize: '0.875rem' }}>
            Try a different search term or browse by category
          </p>
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
        const successRate = entry.usage_count ?
          ((entry.success_count || 0) / entry.usage_count * 100).toFixed(0) : 0;

        return (
          <div
            key={entry.id}
            style={isSelected ? selectedEntryStyle : entryStyle}
            onClick={() => handleEntryClick(entry)}
            onMouseEnter={(e) => {
              if (!isSelected) {
                e.currentTarget.style.backgroundColor = '#f9fafb';
              }
            }}
            onMouseLeave={(e) => {
              if (!isSelected) {
                e.currentTarget.style.backgroundColor = 'transparent';
              }
            }}
          >
            {/* Entry Header */}
            <div style={entryHeaderStyle}>
              <h3 style={titleStyle}>{entry.title}</h3>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                {entry.score && (
                  <span style={{
                    fontSize: '0.75rem',
                    color: '#059669',
                    fontWeight: '500',
                    marginRight: '0.5rem'
                  }}>
                    {Math.round(entry.score)}% match
                  </span>
                )}
                <span style={categoryBadgeStyle}>{entry.category}</span>
              </div>
            </div>

            {/* Problem Preview */}
            <div style={problemStyle}>
              {isExpanded ? entry.problem : `${entry.problem.substring(0, 150)}${entry.problem.length > 150 ? '...' : ''}`}
            </div>

            {/* Tags */}
            {entry.tags && entry.tags.length > 0 && (
              <div style={tagsStyle}>
                {entry.tags.slice(0, isExpanded ? entry.tags.length : 4).map(tag => (
                  <span key={tag} style={tagStyle}>{tag}</span>
                ))}
                {!isExpanded && entry.tags.length > 4 && (
                  <span style={tagStyle}>+{entry.tags.length - 4} more</span>
                )}
              </div>
            )}

            {/* Stats and Actions */}
            <div style={statsStyle}>
              <div>
                Used {entry.usage_count || 0} times • Success rate: {successRate}%
                {entry.created_at && ` • Added ${new Date(entry.created_at).toLocaleDateString()}`}
              </div>

              <div style={ratingButtonsStyle}>
                <button
                  style={successButtonStyle}
                  onClick={(e) => handleRateEntry(entry, true, e)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#dcfce7';
                    e.currentTarget.style.borderColor = '#16a34a';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#ffffff';
                    e.currentTarget.style.borderColor = '#d1d5db';
                  }}
                  title="Mark as helpful"
                >
                  👍 Helpful
                </button>
                <button
                  style={failureButtonStyle}
                  onClick={(e) => handleRateEntry(entry, false, e)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#fef2f2';
                    e.currentTarget.style.borderColor = '#dc2626';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#ffffff';
                    e.currentTarget.style.borderColor = '#d1d5db';
                  }}
                  title="Mark as not helpful"
                >
                  👎 Not helpful
                </button>
                <button
                  style={buttonStyle}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleExpanded(entry.id);
                  }}
                  title={isExpanded ? "Collapse" : "Expand"}
                >
                  {isExpanded ? '▲' : '▼'}
                </button>
              </div>
            </div>

            {/* Expanded Solution */}
            {isExpanded && (
              <div style={{
                marginTop: '1rem',
                padding: '1rem',
                backgroundColor: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '4px',
              }}>
                <h4 style={{
                  margin: '0 0 0.5rem 0',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  color: '#374151'
                }}>
                  Solution:
                </h4>
                <div style={{
                  fontSize: '0.875rem',
                  color: '#4b5563',
                  lineHeight: '1.5',
                  whiteSpace: 'pre-wrap',
                }}>
                  {entry.solution}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});

SimpleEntryList.displayName = 'SimpleEntryList';