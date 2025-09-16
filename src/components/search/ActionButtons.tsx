import React, { memo } from 'react';
import { SearchResult } from './SearchResultCard';

interface ActionButtonsProps {
  result: SearchResult;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onOpen: (result: SearchResult) => void;
  className?: string;
}

export const ActionButtons = memo<ActionButtonsProps>(({
  result,
  isExpanded,
  onToggleExpand,
  onOpen,
  className = ''
}) => {
  const handleOpenClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onOpen(result);
  };

  const handleExpandClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleExpand();
  };

  const containerClasses = `
    action-buttons
    ${className}
  `.trim();

  return (
    <div className={containerClasses} role="toolbar" aria-label="Result actions">
      <button
        type="button"
        className="action-button primary"
        onClick={handleOpenClick}
        aria-label={`Open ${result.title}`}
      >
        <svg className="button-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
          <polyline points="15,3 21,3 21,9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
        <span className="button-text">Open</span>
      </button>

      <button
        type="button"
        className="action-button secondary"
        onClick={handleExpandClick}
        aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
        aria-expanded={isExpanded}
      >
        <svg
          className={`button-icon ${isExpanded ? 'rotated' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <polyline points="6,9 12,15 18,9" />
        </svg>
        <span className="button-text">
          {isExpanded ? 'Less' : 'More'}
        </span>
      </button>

      <button
        type="button"
        className="action-button secondary"
        onClick={(e) => {
          e.stopPropagation();
          navigator.clipboard.writeText(result.url || result.title);
        }}
        aria-label="Copy link"
      >
        <svg className="button-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" />
          <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
        </svg>
        <span className="sr-only">Copy</span>
      </button>

      <button
        type="button"
        className="action-button secondary bookmark-button"
        onClick={(e) => {
          e.stopPropagation();
          // Bookmark functionality would be implemented here
        }}
        aria-label="Bookmark this result"
      >
        <svg className="button-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
        </svg>
        <span className="sr-only">Bookmark</span>
      </button>
    </div>
  );
});

ActionButtons.displayName = 'ActionButtons';