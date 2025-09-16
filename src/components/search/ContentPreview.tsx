import React, { memo, useState, useRef, useEffect } from 'react';

interface ContentPreviewProps {
  id?: string;
  content: string;
  highlights: string[];
  maxLines: number;
  isExpanded: boolean;
  onToggle: () => void;
  className?: string;
}

export const ContentPreview = memo<ContentPreviewProps>(({
  id,
  content,
  highlights,
  maxLines,
  isExpanded,
  onToggle,
  className = ''
}) => {
  const [isTruncated, setIsTruncated] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const fullContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (contentRef.current && fullContentRef.current) {
      const truncatedHeight = contentRef.current.scrollHeight;
      const fullHeight = fullContentRef.current.scrollHeight;
      setIsTruncated(fullHeight > truncatedHeight);
    }
  }, [content, maxLines]);

  const highlightedContent = highlightText(content, highlights);

  const containerClasses = `
    content-preview
    ${isExpanded ? 'expanded' : 'collapsed'}
    ${className}
  `.trim();

  return (
    <div id={id} className={containerClasses}>
      {/* Hidden element to measure full content height */}
      <div
        ref={fullContentRef}
        className="content-measurer"
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: highlightedContent }}
      />

      {/* Visible content */}
      <div
        ref={contentRef}
        className={`content-text ${isExpanded ? 'expanded' : 'truncated'}`}
        style={!isExpanded ? { WebkitLineClamp: maxLines } : undefined}
        dangerouslySetInnerHTML={{ __html: highlightedContent }}
      />

      {/* Expand/Collapse control */}
      {isTruncated && (
        <button
          className="expand-toggle"
          onClick={onToggle}
          aria-expanded={isExpanded}
          aria-controls={id}
          aria-label={isExpanded ? 'Show less' : 'Show more'}
        >
          <span className="toggle-text">
            {isExpanded ? 'Show less' : 'Show more'}
          </span>
          <svg
            className={`toggle-icon ${isExpanded ? 'rotated' : ''}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <polyline points="6,9 12,15 18,9" />
          </svg>
        </button>
      )}

      {/* Fade gradient for truncated content */}
      {!isExpanded && isTruncated && (
        <div className="fade-gradient" aria-hidden="true" />
      )}
    </div>
  );
});

ContentPreview.displayName = 'ContentPreview';

function highlightText(text: string, highlights: string[]): string {
  if (!highlights.length) return escapeHtml(text);

  let highlightedText = escapeHtml(text);

  highlights.forEach(term => {
    const escapedTerm = escapeRegExp(term);
    const regex = new RegExp(`(${escapedTerm})`, 'gi');
    highlightedText = highlightedText.replace(
      regex,
      '<mark class="search-highlight" aria-label="highlighted search term">$1</mark>'
    );
  });

  return highlightedText;
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}