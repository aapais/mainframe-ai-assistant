/**
 * Search Help System - Inline Guidance and Tips
 *
 * Features:
 * - Contextual help tooltips and hints
 * - Search syntax guide with examples
 * - First-time user onboarding
 * - Keyboard shortcuts reference
 * - Search tips based on user behavior
 * - Interactive tutorials for advanced features
 *
 * @author Search Intelligence Agent
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';

interface SearchTip {
  id: string;
  type: 'syntax' | 'shortcut' | 'feature' | 'troubleshooting' | 'performance';
  title: string;
  description: string;
  example?: string;
  icon: string;
  priority: number;
  conditions?: {
    queryLength?: { min?: number; max?: number };
    context?: string[];
    userType?: 'new' | 'intermediate' | 'advanced';
    searchFailures?: number;
  };
}

interface SearchHelpProps {
  query: string;
  context?: string;
  isVisible: boolean;
  onClose: () => void;
  onTipSelect?: (tip: SearchTip) => void;
  className?: string;
}

interface HelpTooltipProps {
  trigger: React.ReactNode;
  content: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
}

interface KeyboardShortcutsProps {
  isVisible: boolean;
  onClose: () => void;
}

// Comprehensive search tips database
const SEARCH_TIPS: SearchTip[] = [
  // Basic syntax tips
  {
    id: 'quotes-exact',
    type: 'syntax',
    title: 'Exact Phrase Search',
    description: 'Use quotes to search for exact phrases',
    example: '"JCL step error" finds exact phrase',
    icon: '💬',
    priority: 10,
    conditions: { queryLength: { min: 10 } }
  },
  {
    id: 'boolean-and',
    type: 'syntax',
    title: 'Combine Terms with AND',
    description: 'Use AND to find results containing all terms',
    example: 'VSAM AND error AND recovery',
    icon: '🔗',
    priority: 8,
    conditions: { queryLength: { min: 8 } }
  },
  {
    id: 'boolean-or',
    type: 'syntax',
    title: 'Alternative Terms with OR',
    description: 'Use OR to find results with any of the terms',
    example: 'ABEND OR error OR failure',
    icon: '🔀',
    priority: 7,
    conditions: { queryLength: { min: 6 } }
  },
  {
    id: 'wildcard-search',
    type: 'syntax',
    title: 'Wildcard Matching',
    description: 'Use * to match partial words or unknown characters',
    example: 'SOC* finds SOC7, SOC4, SOCB, etc.',
    icon: '✨',
    priority: 6,
    conditions: { userType: 'intermediate' }
  },

  // Keyboard shortcuts
  {
    id: 'shortcut-clear',
    type: 'shortcut',
    title: 'Quick Clear',
    description: 'Press Escape to clear search and close suggestions',
    icon: '⌨️',
    priority: 9
  },
  {
    id: 'shortcut-history',
    type: 'shortcut',
    title: 'Search History',
    description: 'Press ↓ arrow when field is empty to see recent searches',
    icon: '📜',
    priority: 8
  },
  {
    id: 'shortcut-suggestions',
    type: 'shortcut',
    title: 'Navigate Suggestions',
    description: 'Use ↑↓ arrows to navigate, Enter to select',
    icon: '🎯',
    priority: 7
  },

  // Feature tips
  {
    id: 'ai-search',
    type: 'feature',
    title: 'AI-Enhanced Search',
    description: 'Enable AI search for better semantic understanding and contextual results',
    example: 'AI can understand "database connection issues" even if content says "DB connectivity problems"',
    icon: '🤖',
    priority: 9,
    conditions: { context: ['knowledge', 'incidents'] }
  },
  {
    id: 'category-filter',
    type: 'feature',
    title: 'Category Filtering',
    description: 'Filter by specific mainframe categories for more targeted results',
    example: 'Select "JCL" category when searching for job control language issues',
    icon: '🏷️',
    priority: 8
  },
  {
    id: 'smart-suggestions',
    type: 'feature',
    title: 'Smart Suggestions',
    description: 'Get intelligent suggestions based on your search history and context',
    icon: '💡',
    priority: 7
  },

  // Troubleshooting tips
  {
    id: 'no-results',
    type: 'troubleshooting',
    title: 'No Results Found?',
    description: 'Try broader terms, check spelling, or use synonyms',
    example: 'Instead of "ABEND0C7", try "data exception" or "SOC7"',
    icon: '🔍',
    priority: 10,
    conditions: { searchFailures: 2 }
  },
  {
    id: 'too-many-results',
    type: 'troubleshooting',
    title: 'Too Many Results?',
    description: 'Add more specific terms or use category filters',
    example: 'Instead of "error", try "JCL compilation error"',
    icon: '🎯',
    priority: 8
  },
  {
    id: 'typo-help',
    type: 'troubleshooting',
    title: 'Check for Typos',
    description: 'Search includes auto-correction for common mainframe terms',
    example: '"abnd" automatically suggests "ABEND"',
    icon: '✏️',
    priority: 6
  },

  // Performance tips
  {
    id: 'search-performance',
    type: 'performance',
    title: 'Faster Searches',
    description: 'Specific terms and categories lead to faster, more accurate results',
    icon: '⚡',
    priority: 5
  },
  {
    id: 'cache-benefit',
    type: 'performance',
    title: 'Cached Results',
    description: 'Recent and popular searches are cached for instant results',
    icon: '💾',
    priority: 4
  }
];

// Mainframe-specific search examples
const SEARCH_EXAMPLES = [
  { category: 'Error Codes', query: 'SOC7 data exception', description: 'Find information about S0C7 abends' },
  { category: 'JCL', query: '"DD statement" allocation', description: 'Search for dataset allocation issues' },
  { category: 'VSAM', query: 'VSAM cluster alternate index', description: 'Find VSAM indexing information' },
  { category: 'DB2', query: 'DB2 deadlock resolution', description: 'Learn about resolving database deadlocks' },
  { category: 'CICS', query: 'CICS transaction timeout', description: 'Troubleshoot transaction timeouts' },
  { category: 'Performance', query: 'batch job performance tuning', description: 'Optimize batch processing' }
];

/**
 * Help Tooltip Component
 */
const HelpTooltip: React.FC<HelpTooltipProps> = ({
  trigger,
  content,
  position = 'top',
  delay = 300
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const showTooltip = useCallback(() => {
    const id = setTimeout(() => setIsVisible(true), delay);
    setTimeoutId(id);
  }, [delay]);

  const hideTooltip = useCallback(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      setTimeoutId(null);
    }
    setIsVisible(false);
  }, [timeoutId]);

  useEffect(() => {
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [timeoutId]);

  const getTooltipPosition = () => {
    const baseStyles = {
      position: 'absolute' as const,
      zIndex: 1000,
      backgroundColor: '#1f2937',
      color: 'white',
      padding: '8px 12px',
      borderRadius: '6px',
      fontSize: '0.875rem',
      maxWidth: '300px',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
      opacity: isVisible ? 1 : 0,
      visibility: isVisible ? 'visible' : 'hidden',
      transition: 'opacity 200ms, visibility 200ms',
      pointerEvents: 'none' as const
    };

    switch (position) {
      case 'top':
        return { ...baseStyles, bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: '8px' };
      case 'bottom':
        return { ...baseStyles, top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: '8px' };
      case 'left':
        return { ...baseStyles, right: '100%', top: '50%', transform: 'translateY(-50%)', marginRight: '8px' };
      case 'right':
        return { ...baseStyles, left: '100%', top: '50%', transform: 'translateY(-50%)', marginLeft: '8px' };
    }
  };

  return (
    <div
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
    >
      {trigger}
      <div ref={tooltipRef} style={getTooltipPosition()}>
        {content}
      </div>
    </div>
  );
};

/**
 * Keyboard Shortcuts Reference
 */
const KeyboardShortcuts: React.FC<KeyboardShortcutsProps> = ({ isVisible, onClose }) => {
  if (!isVisible) return null;

  const shortcuts = [
    { key: 'Enter', description: 'Perform search' },
    { key: 'Escape', description: 'Clear search / Close suggestions' },
    { key: '↓', description: 'Open search history (when empty)' },
    { key: '↑/↓', description: 'Navigate suggestions' },
    { key: 'Ctrl+K', description: 'Focus search (global)' },
    { key: 'Tab', description: 'Navigate between filters' },
    { key: 'F1', description: 'Show help' }
  ];

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '24px',
          maxWidth: '500px',
          width: '90%',
          maxHeight: '80vh',
          overflowY: 'auto',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0 }}>Keyboard Shortcuts</h2>
          <button
            onClick={onClose}
            style={{
              border: 'none',
              background: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              color: '#6b7280'
            }}
          >
            ×
          </button>
        </div>

        <div style={{ display: 'grid', gap: '12px' }}>
          {shortcuts.map(shortcut => (
            <div
              key={shortcut.key}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 0',
                borderBottom: '1px solid #e5e7eb'
              }}
            >
              <span style={{ fontSize: '0.875rem' }}>{shortcut.description}</span>
              <kbd
                style={{
                  padding: '4px 8px',
                  backgroundColor: '#f3f4f6',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  fontFamily: 'monospace'
                }}
              >
                {shortcut.key}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/**
 * Main Search Help System Component
 */
export const SearchHelpSystem: React.FC<SearchHelpProps> = ({
  query,
  context,
  isVisible,
  onClose,
  onTipSelect,
  className = ''
}) => {
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [userType, setUserType] = useState<'new' | 'intermediate' | 'advanced'>('new');
  const [searchFailures, setSearchFailures] = useState(0);

  // Determine user experience level based on behavior
  useEffect(() => {
    const searchHistory = JSON.parse(localStorage.getItem('search-analytics-v2') || '[]');
    const totalSearches = searchHistory.length;

    if (totalSearches > 50) {
      setUserType('advanced');
    } else if (totalSearches > 10) {
      setUserType('intermediate');
    }
  }, []);

  // Filter tips based on current context and conditions
  const getRelevantTips = useCallback(() => {
    return SEARCH_TIPS.filter(tip => {
      // Check query length conditions
      if (tip.conditions?.queryLength) {
        const { min, max } = tip.conditions.queryLength;
        if (min && query.length < min) return false;
        if (max && query.length > max) return false;
      }

      // Check context conditions
      if (tip.conditions?.context && context) {
        if (!tip.conditions.context.includes(context)) return false;
      }

      // Check user type conditions
      if (tip.conditions?.userType) {
        if (tip.conditions.userType !== userType) return false;
      }

      // Check search failure conditions
      if (tip.conditions?.searchFailures) {
        if (searchFailures < tip.conditions.searchFailures) return false;
      }

      return true;
    }).sort((a, b) => b.priority - a.priority).slice(0, 6);
  }, [query, context, userType, searchFailures]);

  const relevantTips = getRelevantTips();

  if (!isVisible) return null;

  return (
    <>
      <div
        className={`search-help-system ${className}`}
        style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          backgroundColor: 'white',
          border: '1px solid #d1d5db',
          borderRadius: '0 0 8px 8px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          zIndex: 1000,
          maxHeight: '400px',
          overflowY: 'auto'
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 16px',
            borderBottom: '1px solid #e5e7eb',
            backgroundColor: '#f9fafb'
          }}
        >
          <h3 style={{ fontSize: '0.875rem', fontWeight: 'medium', margin: 0 }}>
            💡 Search Tips & Help
          </h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <HelpTooltip
              trigger={
                <button
                  onClick={() => setShowShortcuts(true)}
                  style={{
                    padding: '4px 8px',
                    border: '1px solid #d1d5db',
                    backgroundColor: 'white',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    cursor: 'pointer'
                  }}
                >
                  ⌨️
                </button>
              }
              content="Keyboard shortcuts"
            />
            <button
              onClick={onClose}
              style={{
                padding: '4px 8px',
                border: 'none',
                background: 'none',
                color: '#6b7280',
                cursor: 'pointer',
                fontSize: '0.875rem'
              }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Tips Section */}
        {relevantTips.length > 0 && (
          <div style={{ padding: '12px 16px' }}>
            <h4 style={{ fontSize: '0.75rem', fontWeight: 'medium', margin: '0 0 8px 0', color: '#6b7280' }}>
              Relevant Tips
            </h4>
            <div style={{ display: 'grid', gap: '8px' }}>
              {relevantTips.map(tip => (
                <div
                  key={tip.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                    padding: '8px',
                    backgroundColor: '#f9fafb',
                    borderRadius: '6px',
                    cursor: onTipSelect ? 'pointer' : 'default'
                  }}
                  onClick={() => onTipSelect?.(tip)}
                >
                  <span style={{ fontSize: '1rem' }}>{tip.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: 'medium', marginBottom: '2px' }}>
                      {tip.title}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '4px' }}>
                      {tip.description}
                    </div>
                    {tip.example && (
                      <div
                        style={{
                          fontSize: '0.75rem',
                          fontFamily: 'monospace',
                          backgroundColor: '#e5e7eb',
                          padding: '2px 4px',
                          borderRadius: '3px',
                          color: '#374151'
                        }}
                      >
                        {tip.example}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Examples Section */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid #e5e7eb' }}>
          <h4 style={{ fontSize: '0.75rem', fontWeight: 'medium', margin: '0 0 8px 0', color: '#6b7280' }}>
            Example Searches
          </h4>
          <div style={{ display: 'grid', gap: '6px' }}>
            {SEARCH_EXAMPLES.slice(0, 4).map((example, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '6px 8px',
                  backgroundColor: '#f3f4f6',
                  borderRadius: '4px',
                  fontSize: '0.75rem'
                }}
              >
                <div>
                  <span style={{ fontWeight: 'medium' }}>{example.query}</span>
                  <div style={{ color: '#6b7280', fontSize: '0.7rem' }}>
                    {example.description}
                  </div>
                </div>
                <span
                  style={{
                    padding: '2px 6px',
                    backgroundColor: '#e5e7eb',
                    borderRadius: '3px',
                    fontSize: '0.7rem',
                    fontWeight: 'medium'
                  }}
                >
                  {example.category}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Help Links */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-around',
            padding: '8px 16px',
            borderTop: '1px solid #e5e7eb',
            backgroundColor: '#f9fafb'
          }}
        >
          <button
            onClick={() => setShowShortcuts(true)}
            style={{
              border: 'none',
              background: 'none',
              color: '#3b82f6',
              fontSize: '0.75rem',
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
          >
            Keyboard Shortcuts
          </button>
          <button
            style={{
              border: 'none',
              background: 'none',
              color: '#3b82f6',
              fontSize: '0.75rem',
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
          >
            Search Syntax Guide
          </button>
          <button
            style={{
              border: 'none',
              background: 'none',
              color: '#3b82f6',
              fontSize: '0.75rem',
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
          >
            Advanced Features
          </button>
        </div>
      </div>

      <KeyboardShortcuts
        isVisible={showShortcuts}
        onClose={() => setShowShortcuts(false)}
      />
    </>
  );
};

/**
 * Inline Help Icon Component
 */
export const SearchHelpIcon: React.FC<{
  onClick: () => void;
  hasUnreadTips?: boolean;
}> = ({ onClick, hasUnreadTips = false }) => {
  return (
    <HelpTooltip
      trigger={
        <button
          onClick={onClick}
          style={{
            position: 'relative',
            padding: '6px',
            border: '1px solid #d1d5db',
            backgroundColor: 'white',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '0.875rem',
            color: '#6b7280',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          aria-label="Search help and tips"
        >
          ❓
          {hasUnreadTips && (
            <span
              style={{
                position: 'absolute',
                top: '-2px',
                right: '-2px',
                width: '8px',
                height: '8px',
                backgroundColor: '#ef4444',
                borderRadius: '50%'
              }}
            />
          )}
        </button>
      }
      content="Get search tips and help"
    />
  );
};

export default SearchHelpSystem;