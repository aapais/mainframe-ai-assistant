/**
 * Keyboard-Enhanced Entry List Component
 * Provides full keyboard navigation for knowledge base entries
 */

import React, { useRef, useEffect } from 'react';
import { useListNavigation } from '../hooks/useKeyboardNavigation';
import { useKeyboard } from '../contexts/KeyboardContext';

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

interface KeyboardEnabledEntryListProps {
  entries: KBEntry[];
  onEntrySelect: (entry: KBEntry) => void;
  selectedEntryId?: string;
  loading?: boolean;
  emptyMessage?: string;
  showNumbers?: boolean;
}

export function KeyboardEnabledEntryList({
  entries,
  onEntrySelect,
  selectedEntryId,
  loading = false,
  emptyMessage = 'No entries found',
  showNumbers = true
}: KeyboardEnabledEntryListProps) {
  const { state: keyboardState } = useKeyboard();

  const listNavigation = useListNavigation('vertical', false);

  // Handle entry selection with Enter or Space
  const handleEntryActivation = (entry: KBEntry, index: number) => {
    onEntrySelect(entry);

    // Announce selection to screen readers
    const announcement = `Selected entry: ${entry.title}`;
    const announcer = document.getElementById('live-region');
    if (announcer) {
      announcer.textContent = announcement;
    }
  };

  // Handle number key shortcuts (1-9)
  useEffect(() => {
    const handleNumberKeyPress = (event: KeyboardEvent) => {
      const num = parseInt(event.key);
      if (num >= 1 && num <= 9 && num <= entries.length) {
        const targetEntry = entries[num - 1];
        if (targetEntry) {
          event.preventDefault();
          onEntrySelect(targetEntry);

          // Focus the corresponding entry
          const entryElement = document.querySelector(`[data-entry-index="${num - 1}"]`) as HTMLElement;
          if (entryElement) {
            entryElement.focus();
          }
        }
      }
    };

    if (keyboardState.isKeyboardMode) {
      document.addEventListener('keydown', handleNumberKeyPress);
      return () => document.removeEventListener('keydown', handleNumberKeyPress);
    }
  }, [entries, keyboardState.isKeyboardMode, onEntrySelect]);

  if (loading) {
    return (
      <div style={loadingContainerStyle}>
        <div style={spinnerStyle} aria-live="polite">
          Loading entries...
        </div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div style={emptyStateStyle} role="status" aria-live="polite">
        <p style={emptyMessageStyle}>{emptyMessage}</p>
        <p style={emptyHintStyle}>
          Try adjusting your search terms or browse all entries
        </p>
      </div>
    );
  }

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    maxHeight: '600px',
    overflowY: 'auto',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    backgroundColor: '#ffffff',
    padding: '0.5rem',
  };

  const entryStyle: React.CSSProperties = {
    padding: '1rem',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    backgroundColor: '#ffffff',
    outline: 'none',
    position: 'relative',
  };

  const selectedEntryStyle: React.CSSProperties = {
    ...entryStyle,
    backgroundColor: '#dbeafe',
    borderColor: '#3b82f6',
    boxShadow: '0 0 0 2px rgba(59, 130, 246, 0.1)',
  };

  const entryHeaderStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: '0.5rem',
    gap: '0.5rem',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '1rem',
    fontWeight: '600',
    color: '#111827',
    margin: 0,
    lineHeight: '1.4',
  };

  const categoryStyle: React.CSSProperties = {
    fontSize: '0.75rem',
    fontWeight: '500',
    color: '#ffffff',
    backgroundColor: '#6b7280',
    padding: '0.25rem 0.5rem',
    borderRadius: '4px',
    flexShrink: 0,
  };

  const problemPreviewStyle: React.CSSProperties = {
    fontSize: '0.875rem',
    color: '#6b7280',
    lineHeight: '1.4',
    marginBottom: '0.5rem',
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical' as const,
  };

  const metaStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    fontSize: '0.75rem',
    color: '#9ca3af',
  };

  const numberBadgeStyle: React.CSSProperties = {
    position: 'absolute',
    top: '0.5rem',
    left: '0.5rem',
    width: '1.5rem',
    height: '1.5rem',
    backgroundColor: '#3b82f6',
    color: '#ffffff',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.75rem',
    fontWeight: '600',
    fontFamily: 'monospace',
  };

  const scoreIndicatorStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
    fontSize: '0.75rem',
    fontWeight: '500',
  };

  return (
    <>
      <div
        ref={listNavigation.containerRef}
        style={containerStyle}
        role="listbox"
        aria-label="Knowledge base entries"
        aria-multiselectable="false"
        tabIndex={0}
      >
        {entries.map((entry, index) => {
          const isSelected = entry.id === selectedEntryId;
          const successRate = entry.usage_count && entry.usage_count > 0
            ? ((entry.success_count || 0) / entry.usage_count * 100)
            : 0;

          return (
            <div
              key={entry.id}
              style={isSelected ? selectedEntryStyle : entryStyle}
              onClick={() => handleEntryActivation(entry, index)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleEntryActivation(entry, index);
                }
              }}
              role="option"
              aria-selected={isSelected}
              tabIndex={0}
              data-entry-index={index}
              aria-describedby={`entry-description-${index}`}
            >
              {/* Number badge for keyboard shortcuts */}
              {showNumbers && index < 9 && keyboardState.isKeyboardMode && (
                <div style={numberBadgeStyle} aria-hidden="true">
                  {index + 1}
                </div>
              )}

              <div style={entryHeaderStyle}>
                <h3 style={titleStyle}>{entry.title}</h3>
                <div style={{
                  ...categoryStyle,
                  backgroundColor: getCategoryColor(entry.category)
                }}>
                  {entry.category}
                </div>
              </div>

              <p style={problemPreviewStyle}>
                {entry.problem}
              </p>

              <div style={metaStyle}>
                <span>Used {entry.usage_count || 0} times</span>

                {entry.usage_count && entry.usage_count > 0 && (
                  <div style={scoreIndicatorStyle}>
                    <span style={{
                      color: successRate >= 70 ? '#059669' : successRate >= 40 ? '#d97706' : '#dc2626'
                    }}>
                      {successRate.toFixed(0)}% success
                    </span>
                  </div>
                )}

                {entry.score && (
                  <div style={scoreIndicatorStyle}>
                    <span>Match: {Math.round(entry.score)}%</span>
                  </div>
                )}

                {entry.tags && entry.tags.length > 0 && (
                  <span>
                    Tags: {entry.tags.slice(0, 3).join(', ')}
                    {entry.tags.length > 3 && '...'}
                  </span>
                )}
              </div>

              {/* Hidden description for screen readers */}
              <div id={`entry-description-${index}`} className="visually-hidden">
                Entry {index + 1} of {entries.length}.
                Category: {entry.category}.
                {entry.usage_count ? `Used ${entry.usage_count} times with ${successRate.toFixed(0)}% success rate.` : 'No usage history.'}
                {keyboardState.isKeyboardMode && index < 9 && ` Press ${index + 1} to select quickly.`}
              </div>
            </div>
          );
        })}
      </div>

      {/* Instructions for keyboard users */}
      {keyboardState.isKeyboardMode && (
        <div style={instructionsStyle} aria-live="polite">
          <p style={instructionsTextStyle}>
            <strong>Navigation:</strong> ↑↓ to navigate, Enter/Space to select, 1-9 for quick selection
          </p>
        </div>
      )}

      {/* Live region for announcements */}
      <div
        id="live-region"
        aria-live="polite"
        aria-atomic="true"
        className="visually-hidden"
      />
    </>
  );
}

// Helper function to get category colors
function getCategoryColor(category: string): string {
  const colors: { [key: string]: string } = {
    'JCL': '#dc2626',
    'VSAM': '#059669',
    'DB2': '#2563eb',
    'Batch': '#d97706',
    'Functional': '#7c3aed',
    'Other': '#6b7280'
  };

  return colors[category] || colors['Other'];
}

// Styles
const loadingContainerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '3rem',
  backgroundColor: '#f9fafb',
  borderRadius: '8px',
  border: '1px solid #e5e7eb',
};

const spinnerStyle: React.CSSProperties = {
  fontSize: '1rem',
  color: '#6b7280',
};

const emptyStateStyle: React.CSSProperties = {
  textAlign: 'center',
  padding: '3rem 1rem',
  backgroundColor: '#f9fafb',
  borderRadius: '8px',
  border: '1px solid #e5e7eb',
};

const emptyMessageStyle: React.CSSProperties = {
  fontSize: '1.125rem',
  fontWeight: '500',
  color: '#374151',
  margin: '0 0 0.5rem 0',
};

const emptyHintStyle: React.CSSProperties = {
  fontSize: '0.875rem',
  color: '#6b7280',
  margin: 0,
};

const instructionsStyle: React.CSSProperties = {
  marginTop: '0.5rem',
  padding: '0.75rem',
  backgroundColor: '#f0f9ff',
  border: '1px solid #bae6fd',
  borderRadius: '6px',
};

const instructionsTextStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '0.875rem',
  color: '#0369a1',
};

export default KeyboardEnabledEntryList;