import React, { useState, memo, useCallback } from 'react';
import { RankingIndicator } from './RankingIndicator';
import { ContentPreview } from './ContentPreview';
import { ActionButtons } from './ActionButtons';
import { ExpandedDetails } from './ExpandedDetails';

export interface SearchResult {
  id: string;
  title: string;
  content: string;
  url?: string;
  metadata: {
    author?: string;
    date: string;
    fileType: string;
    size?: number;
    source: string;
  };
  relevanceScore: number;
  highlights: string[];
}

interface SearchResultCardProps {
  result: SearchResult;
  index: number;
  isExpanded?: boolean;
  onExpand: (id: string) => void;
  onCollapse: (id: string) => void;
  onOpen: (result: SearchResult) => void;
  viewMode: 'compact' | 'detailed' | 'list';
  className?: string;
}

export const SearchResultCard = memo<SearchResultCardProps>(({
  result,
  index,
  isExpanded = false,
  onExpand,
  onCollapse,
  onOpen,
  viewMode,
  className = ''
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const handleToggleExpand = useCallback(() => {
    if (isExpanded) {
      onCollapse(result.id);
    } else {
      onExpand(result.id);
    }
  }, [isExpanded, onCollapse, onExpand, result.id]);

  const handleCardClick = useCallback((e: React.MouseEvent) => {
    // Don't trigger if clicking on interactive elements
    if ((e.target as HTMLElement).closest('button, a, [role="button"]')) {
      return;
    }
    onOpen(result);
  }, [onOpen, result]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Enter':
        onOpen(result);
        break;
      case ' ':
        e.preventDefault();
        handleToggleExpand();
        break;
      case 'Escape':
        if (isExpanded) {
          onCollapse(result.id);
        }
        break;
    }
  }, [onOpen, result, handleToggleExpand, isExpanded, onCollapse]);

  const cardClasses = `
    search-result-card
    ${className}
    ${viewMode}
    ${isHovered ? 'hovered' : ''}
    ${isFocused ? 'focused' : ''}
    ${isExpanded ? 'expanded' : ''}
  `.trim();

  return (
    <article
      className={cardClasses}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="listitem"
      aria-describedby={`result-score-${result.id} result-preview-${result.id}`}
      aria-expanded={isExpanded}
      aria-label={`Search result ${index + 1}: ${result.title}`}
    >
      <div className="card-header">
        <div className="title-section">
          <h3 className="result-title">
            <a
              href={result.url}
              onClick={(e) => e.stopPropagation()}
              tabIndex={-1}
              aria-label={`Open ${result.title}`}
            >
              {result.title}
            </a>
          </h3>
          <div className="metadata-row">
            <span className="file-type">{result.metadata.fileType}</span>
            {result.metadata.author && (
              <span className="author">by {result.metadata.author}</span>
            )}
            <span className="date">{result.metadata.date}</span>
            {result.metadata.size && (
              <span className="size">{formatFileSize(result.metadata.size)}</span>
            )}
          </div>
        </div>

        <div className="ranking-section">
          <RankingIndicator
            id={`result-score-${result.id}`}
            score={result.relevanceScore}
            visualType="badge"
            showTooltip={isHovered}
          />
        </div>
      </div>

      <ContentPreview
        id={`result-preview-${result.id}`}
        content={result.content}
        highlights={result.highlights}
        maxLines={viewMode === 'compact' ? 2 : 4}
        isExpanded={isExpanded}
        onToggle={handleToggleExpand}
      />

      <ActionButtons
        result={result}
        isExpanded={isExpanded}
        onToggleExpand={handleToggleExpand}
        onOpen={onOpen}
      />

      {isExpanded && (
        <ExpandedDetails
          result={result}
          onClose={() => onCollapse(result.id)}
        />
      )}
    </article>
  );
});

SearchResultCard.displayName = 'SearchResultCard';

function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}