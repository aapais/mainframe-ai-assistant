import React, { memo } from 'react';
import { SearchResult } from './SearchResultCard';

interface ExpandedDetailsProps {
  result: SearchResult;
  onClose: () => void;
  className?: string;
}

export const ExpandedDetails = memo<ExpandedDetailsProps>(({
  result,
  onClose,
  className = ''
}) => {
  const containerClasses = `
    expanded-details
    ${className}
  `.trim();

  return (
    <div className={containerClasses} role="region" aria-label="Expanded result details">
      <div className="details-header">
        <h4 className="details-title">Details</h4>
        <button
          type="button"
          className="close-button"
          onClick={onClose}
          aria-label="Close expanded details"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="details-content">
        <div className="details-section">
          <h5 className="section-title">Full Content</h5>
          <div className="full-content">
            {result.content}
          </div>
        </div>

        <div className="details-section">
          <h5 className="section-title">Metadata</h5>
          <dl className="metadata-list">
            {result.metadata.author && (
              <>
                <dt>Author</dt>
                <dd>{result.metadata.author}</dd>
              </>
            )}
            <dt>Date</dt>
            <dd>{new Date(result.metadata.date).toLocaleDateString()}</dd>
            <dt>File Type</dt>
            <dd>{result.metadata.fileType}</dd>
            {result.metadata.size && (
              <>
                <dt>Size</dt>
                <dd>{formatFileSize(result.metadata.size)}</dd>
              </>
            )}
            <dt>Source</dt>
            <dd>{result.metadata.source}</dd>
            <dt>Relevance Score</dt>
            <dd>{result.relevanceScore.toFixed(1)}%</dd>
          </dl>
        </div>

        {result.url && (
          <div className="details-section">
            <h5 className="section-title">Location</h5>
            <div className="url-section">
              <code className="url-text">{result.url}</code>
              <button
                type="button"
                className="copy-url-button"
                onClick={() => navigator.clipboard.writeText(result.url!)}
                aria-label="Copy URL"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" />
                  <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {result.highlights.length > 0 && (
          <div className="details-section">
            <h5 className="section-title">Search Terms</h5>
            <div className="highlights-list">
              {result.highlights.map((highlight, index) => (
                <span key={index} className="highlight-term">
                  {highlight}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

ExpandedDetails.displayName = 'ExpandedDetails';

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