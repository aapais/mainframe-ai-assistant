import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { 
  X, 
  Edit, 
  Trash2, 
  Copy, 
  Share2, 
  ExternalLink, 
  Printer, 
  BookOpen, 
  Clock, 
  TrendingUp, 
  Hash, 
  ThumbsUp, 
  ThumbsDown,
  Star,
  Code,
  FileText,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { Button } from '../common/Button';
import { CategoryBadge } from './indicators/CategoryBadge';
import { SuccessRateIndicator } from './indicators/SuccessRateIndicator';
import { UsageStats } from './indicators/UsageStats';
import { ProblemDisplay } from './content/ProblemDisplay';
import { SolutionDisplay } from './content/SolutionDisplay';
import { focusManager, AriaUtils, announceToScreenReader } from '../../utils/accessibility';
import { useAccessibleShortcuts } from '../../hooks/useUXEnhancements';
import { formatDistanceToNow, format } from 'date-fns';
import { KBEntry } from './KBEntryCard';
import './KBEntryDetail.css';

interface KBEntryDetailProps {
  /** KB entry to display */
  entry: KBEntry;
  
  /** Whether component is displayed in modal */
  isModal?: boolean;
  
  /** Close handler for modal mode */
  onClose?: () => void;
  
  /** Edit handler */
  onEdit?: (entry: KBEntry) => void;
  
  /** Delete handler */
  onDelete?: (entryId: string) => void;
  
  /** Copy handler */
  onCopy?: (content: string) => void;
  
  /** Share handler */
  onShare?: (entry: KBEntry) => void;
  
  /** Navigation to related entries */
  onNavigateToRelated?: (entryId: string) => void;
  
  /** Rating handler */
  onRate?: (entryId: string, rating: number) => void;
  
  /** Usage tracking */
  onMarkUsed?: (entryId: string, success: boolean) => void;
  
  /** Print handler */
  onPrint?: () => void;
  
  /** Related entries data */
  relatedEntries?: KBEntry[];
  
  /** Loading states */
  isLoading?: boolean;
  isDeleting?: boolean;
  isRating?: boolean;
  
  /** Error states */
  error?: string;
  
  /** User permissions */
  canEdit?: boolean;
  canDelete?: boolean;
  canRate?: boolean;
  
  /** View preferences */
  showMetadata?: boolean;
  showRelatedEntries?: boolean;
  showUsageStats?: boolean;
  enablePrint?: boolean;
}

/**
 * Comprehensive KB Entry Detail Component
 * 
 * Features:
 * - Full entry display with syntax highlighting
 * - Action buttons for CRUD operations
 * - Usage statistics and success rate display
 * - Related entries navigation
 * - Print-friendly view
 * - Accessibility support with ARIA patterns
 * - Keyboard navigation and shortcuts
 * - Responsive design
 * - Copy functionality for code snippets
 * - Share capabilities
 */
const KBEntryDetailComponent: React.FC<KBEntryDetailProps> = ({
  entry,
  isModal = false,
  onClose,
  onEdit,
  onDelete,
  onCopy,
  onShare,
  onNavigateToRelated,
  onRate,
  onMarkUsed,
  onPrint,
  relatedEntries = [],
  isLoading = false,
  isDeleting = false,
  isRating = false,
  error,
  canEdit = true,
  canDelete = true,
  canRate = true,
  showMetadata = true,
  showRelatedEntries = true,
  showUsageStats = true,
  enablePrint = true
}) => {
  const [isPrintView, setIsPrintView] = useState(false);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [showFullProblem, setShowFullProblem] = useState(true);
  const [showFullSolution, setShowFullSolution] = useState(true);
  
  const detailRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedElement = useRef<HTMLElement | null>(null);
  const focusTrapRef = useRef<any>(null);
  
  // Calculate metrics
  const successRate = entry.usage_count > 0 
    ? Math.round((entry.success_count / entry.usage_count) * 100)
    : 0;
    
  const isRecent = new Date(entry.updated_at).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000;
  const isPopular = entry.usage_count > 10;
  const isHighConfidence = entry.confidence_score && entry.confidence_score > 0.8;
  
  // Keyboard shortcuts
  useAccessibleShortcuts([
    {
      key: 'Escape',
      handler: () => isModal && onClose?.(),
      description: 'Close detail view',
      disabled: !isModal
    },
    {
      key: 'e',
      handler: () => canEdit && onEdit?.(entry),
      description: 'Edit entry',
      disabled: !canEdit
    },
    {
      key: 'c',
      handler: handleCopyFull,
      description: 'Copy full content'
    },
    {
      key: 'p',
      handler: handlePrint,
      description: 'Print entry',
      disabled: !enablePrint
    },
    {
      key: 's',
      handler: () => onShare?.(entry),
      description: 'Share entry'
    }
  ]);
  
  // Focus management for modal mode
  useEffect(() => {
    if (isModal && detailRef.current) {
      previouslyFocusedElement.current = document.activeElement as HTMLElement;
      
      // Create focus trap
      focusTrapRef.current = focusManager.createFocusTrap('kb-entry-detail', detailRef.current);
      focusTrapRef.current.activate();
      
      // Announce to screen readers
      announceToScreenReader(`KB Entry details loaded: ${entry.title}`, 'polite');
      
      // Prevent body scroll
      document.body.style.overflow = 'hidden';
      
      return () => {
        if (focusTrapRef.current) {
          focusTrapRef.current.deactivate();
          focusManager.removeFocusTrap('kb-entry-detail');
        }
        
        if (previouslyFocusedElement.current) {
          focusManager.restoreFocus(previouslyFocusedElement.current);
        }
        
        document.body.style.overflow = '';
      };
    }
  }, [isModal, entry.title]);
  
  // Copy functionality with feedback
  const handleCopy = useCallback(async (content: string, section: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedSection(section);
      announceToScreenReader(`${section} copied to clipboard`, 'polite');
      onCopy?.(content);
      
      // Clear feedback after 2 seconds
      setTimeout(() => setCopiedSection(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
      announceToScreenReader('Failed to copy content', 'assertive');
    }
  }, [onCopy]);
  
  const handleCopyFull = useCallback(() => {
    const content = `${entry.title}\n\nProblem:\n${entry.problem}\n\nSolution:\n${entry.solution}\n\nCategory: ${entry.category}\nTags: ${entry.tags.join(', ')}\n\nCreated: ${format(new Date(entry.created_at), 'PPpp')}\nUpdated: ${format(new Date(entry.updated_at), 'PPpp')}`;
    handleCopy(content, 'Full entry');
  }, [entry, handleCopy]);
  
  const handleCopyProblem = useCallback(() => {
    handleCopy(entry.problem, 'Problem description');
  }, [entry.problem, handleCopy]);
  
  const handleCopySolution = useCallback(() => {
    handleCopy(entry.solution, 'Solution');
  }, [entry.solution, handleCopy]);
  
  // Print functionality
  const handlePrint = useCallback(() => {
    if (enablePrint) {
      setIsPrintView(true);
      setTimeout(() => {
        window.print();
        setIsPrintView(false);
      }, 100);
      onPrint?.();
    }
  }, [enablePrint, onPrint]);
  
  // Rating functionality
  const handleRate = useCallback(async (rating: number) => {
    if (canRate && !isRating) {
      setUserRating(rating);
      announceToScreenReader(`Rated entry ${rating} out of 5 stars`, 'polite');
      onRate?.(entry.id, rating);
    }
  }, [canRate, isRating, entry.id, onRate]);
  
  // Usage tracking
  const handleMarkUsed = useCallback((success: boolean) => {
    onMarkUsed?.(entry.id, success);
    announceToScreenReader(
      success ? 'Marked as helpful' : 'Marked as not helpful', 
      'polite'
    );
  }, [entry.id, onMarkUsed]);
  
  // Handle backdrop click in modal mode
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (isModal && e.target === e.currentTarget) {
      onClose?.();
    }
  }, [isModal, onClose]);
  
  if (isLoading) {
    return (
      <div className="kb-entry-detail__loading" role="status" aria-label="Loading entry details">
        <div className="kb-entry-detail__spinner" />
        <span className="sr-only">Loading KB entry details...</span>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="kb-entry-detail__error" role="alert">
        <AlertTriangle className="kb-entry-detail__error-icon" />
        <h3>Error Loading Entry</h3>
        <p>{error}</p>
        <Button onClick={onClose} variant="secondary">
          Close
        </Button>
      </div>
    );
  }
  
  const content = (
    <div 
      ref={detailRef}
      className={`kb-entry-detail ${isPrintView ? 'kb-entry-detail--print' : ''} ${isModal ? 'kb-entry-detail--modal' : ''}`}
      role={isModal ? 'dialog' : 'main'}
      aria-modal={isModal}
      aria-labelledby="entry-title"
      aria-describedby="entry-description"
    >
      {/* Header with title and actions */}
      <header className="kb-entry-detail__header">
        <div className="kb-entry-detail__title-section">
          <h1 id="entry-title" className="kb-entry-detail__title">
            {entry.title}
          </h1>
          
          {/* Priority indicators */}
          <div className="kb-entry-detail__indicators">
            {isHighConfidence && (
              <div className="kb-entry-detail__badge kb-entry-detail__badge--confidence">
                <TrendingUp size={14} />
                High Confidence
              </div>
            )}
            {isRecent && (
              <div className="kb-entry-detail__badge kb-entry-detail__badge--recent">
                <Clock size={14} />
                Recently Updated
              </div>
            )}
            {isPopular && (
              <div className="kb-entry-detail__badge kb-entry-detail__badge--popular">
                <BookOpen size={14} />
                Popular
              </div>
            )}
          </div>
        </div>
        
        {/* Action buttons */}
        <div className="kb-entry-detail__actions">
          {canEdit && (
            <Button
              onClick={() => onEdit?.(entry)}
              variant="secondary"
              size="small"
              title="Edit entry (Press E)"
              aria-label="Edit this KB entry"
            >
              <Edit size={16} />
              Edit
            </Button>
          )}
          
          <Button
            onClick={handleCopyFull}
            variant="ghost"
            size="small"
            title="Copy full content (Press C)"
            aria-label="Copy full entry content"
          >
            <Copy size={16} />
            {copiedSection === 'Full entry' ? 'Copied!' : 'Copy'}
          </Button>
          
          <Button
            onClick={() => onShare?.(entry)}
            variant="ghost"
            size="small"
            title="Share entry (Press S)"
            aria-label="Share this entry"
          >
            <Share2 size={16} />
            Share
          </Button>
          
          {enablePrint && (
            <Button
              onClick={handlePrint}
              variant="ghost"
              size="small"
              title="Print entry (Press P)"
              aria-label="Print this entry"
            >
              <Printer size={16} />
              Print
            </Button>
          )}
          
          {canDelete && (
            <Button
              onClick={() => onDelete?.(entry.id)}
              variant="danger"
              size="small"
              disabled={isDeleting}
              title="Delete entry"
              aria-label="Delete this KB entry"
            >
              <Trash2 size={16} />
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          )}
          
          {isModal && (
            <Button
              onClick={onClose}
              variant="ghost"
              size="small"
              title="Close (Press Escape)"
              aria-label="Close entry details"
            >
              <X size={16} />
            </Button>
          )}
        </div>
      </header>
      
      {/* Metadata section */}
      {showMetadata && (
        <section className="kb-entry-detail__metadata" aria-labelledby="metadata-heading">
          <h2 id="metadata-heading" className="sr-only">Entry Metadata</h2>
          
          <div className="kb-entry-detail__meta-grid">
            <div className="kb-entry-detail__meta-item">
              <span className="kb-entry-detail__meta-label">Category:</span>
              <CategoryBadge category={entry.category} />
            </div>
            
            <div className="kb-entry-detail__meta-item">
              <span className="kb-entry-detail__meta-label">Created:</span>
              <time dateTime={entry.created_at.toISOString()}>
                {format(new Date(entry.created_at), 'PPpp')}
              </time>
            </div>
            
            <div className="kb-entry-detail__meta-item">
              <span className="kb-entry-detail__meta-label">Updated:</span>
              <time dateTime={entry.updated_at.toISOString()}>
                {formatDistanceToNow(new Date(entry.updated_at))} ago
              </time>
            </div>
            
            {entry.estimated_resolution_time && (
              <div className="kb-entry-detail__meta-item">
                <span className="kb-entry-detail__meta-label">Est. Resolution:</span>
                <span>{entry.estimated_resolution_time} minutes</span>
              </div>
            )}
          </div>
          
          {/* Usage statistics */}
          {showUsageStats && (
            <div className="kb-entry-detail__stats">
              <SuccessRateIndicator rate={successRate} showLabel={true} />
              <UsageStats count={entry.usage_count} showTrend={true} />
              
              {entry.confidence_score && (
                <div className="kb-entry-detail__confidence">
                  <span className="kb-entry-detail__meta-label">Confidence:</span>
                  <div className="kb-entry-detail__confidence-bar">
                    <div 
                      className="kb-entry-detail__confidence-fill"
                      style={{ width: `${entry.confidence_score * 100}%` }}
                    />
                    <span className="kb-entry-detail__confidence-text">
                      {Math.round(entry.confidence_score * 100)}%
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}
      
      {/* Problem section */}
      <section className="kb-entry-detail__section" aria-labelledby="problem-heading">
        <div className="kb-entry-detail__section-header">
          <h2 id="problem-heading" className="kb-entry-detail__section-title">
            <FileText size={20} />
            Problem Description
          </h2>
          
          <div className="kb-entry-detail__section-actions">
            <Button
              onClick={handleCopyProblem}
              variant="ghost"
              size="small"
              title="Copy problem description"
            >
              <Copy size={14} />
              {copiedSection === 'Problem description' ? 'Copied!' : 'Copy'}
            </Button>
            
            <Button
              onClick={() => setShowFullProblem(!showFullProblem)}
              variant="ghost"
              size="small"
              aria-expanded={showFullProblem}
            >
              {showFullProblem ? 'Collapse' : 'Expand'}
            </Button>
          </div>
        </div>
        
        <div className="kb-entry-detail__section-content">
          <ProblemDisplay 
            problem={entry.problem}
            showFullContent={showFullProblem}
            enableCodeHighlighting={true}
          />
        </div>
      </section>
      
      {/* Solution section */}
      <section className="kb-entry-detail__section" aria-labelledby="solution-heading">
        <div className="kb-entry-detail__section-header">
          <h2 id="solution-heading" className="kb-entry-detail__section-title">
            <CheckCircle size={20} />
            Solution
          </h2>
          
          <div className="kb-entry-detail__section-actions">
            <Button
              onClick={handleCopySolution}
              variant="ghost"
              size="small"
              title="Copy solution"
            >
              <Copy size={14} />
              {copiedSection === 'Solution' ? 'Copied!' : 'Copy'}
            </Button>
            
            <Button
              onClick={() => setShowFullSolution(!showFullSolution)}
              variant="ghost"
              size="small"
              aria-expanded={showFullSolution}
            >
              {showFullSolution ? 'Collapse' : 'Expand'}
            </Button>
          </div>
        </div>
        
        <div className="kb-entry-detail__section-content">
          <SolutionDisplay 
            solution={entry.solution}
            codeExamples={entry.code_examples}
            showFull={showFullSolution}
            enableCodeHighlighting={true}
            onToggleView={() => setShowFullSolution(!showFullSolution)}
          />
        </div>
      </section>
      
      {/* Tags section */}
      {entry.tags.length > 0 && (
        <section className="kb-entry-detail__section" aria-labelledby="tags-heading">
          <h2 id="tags-heading" className="kb-entry-detail__section-title">
            <Hash size={20} />
            Tags
          </h2>
          
          <div className="kb-entry-detail__tags" role="list">
            {entry.tags.map(tag => (
              <span key={tag} className="kb-entry-detail__tag" role="listitem">
                {tag}
              </span>
            ))}
          </div>
        </section>
      )}
      
      {/* Related entries section */}
      {showRelatedEntries && relatedEntries.length > 0 && (
        <section className="kb-entry-detail__section" aria-labelledby="related-heading">
          <h2 id="related-heading" className="kb-entry-detail__section-title">
            <ExternalLink size={20} />
            Related Entries
          </h2>
          
          <div className="kb-entry-detail__related-list">
            {relatedEntries.map(relatedEntry => (
              <button
                key={relatedEntry.id}
                className="kb-entry-detail__related-item"
                onClick={() => onNavigateToRelated?.(relatedEntry.id)}
                aria-label={`Navigate to related entry: ${relatedEntry.title}`}
              >
                <div className="kb-entry-detail__related-title">
                  {relatedEntry.title}
                </div>
                <div className="kb-entry-detail__related-meta">
                  <CategoryBadge category={relatedEntry.category} size="small" />
                  <span className="kb-entry-detail__related-success">
                    {Math.round((relatedEntry.success_count / relatedEntry.usage_count) * 100)}% success
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}
      
      {/* Rating and feedback section */}
      {canRate && (
        <section className="kb-entry-detail__section" aria-labelledby="rating-heading">
          <h2 id="rating-heading" className="kb-entry-detail__section-title">
            <Star size={20} />
            Rate This Entry
          </h2>
          
          <div className="kb-entry-detail__rating">
            <div className="kb-entry-detail__rating-stars" role="radiogroup" aria-label="Rate this entry">
              {[1, 2, 3, 4, 5].map(rating => (
                <button
                  key={rating}
                  className={`kb-entry-detail__rating-star ${
                    userRating && rating <= userRating ? 'kb-entry-detail__rating-star--filled' : ''
                  }`}
                  onClick={() => handleRate(rating)}
                  disabled={isRating}
                  role="radio"
                  aria-checked={userRating === rating}
                  aria-label={`Rate ${rating} out of 5 stars`}
                >
                  <Star size={20} />
                </button>
              ))}
            </div>
            
            <div className="kb-entry-detail__usage-feedback">
              <span className="kb-entry-detail__feedback-label">Was this helpful?</span>
              <div className="kb-entry-detail__feedback-buttons">
                <Button
                  onClick={() => handleMarkUsed(true)}
                  variant="ghost"
                  size="small"
                  aria-label="Mark as helpful"
                >
                  <ThumbsUp size={16} />
                  Helpful
                </Button>
                <Button
                  onClick={() => handleMarkUsed(false)}
                  variant="ghost"
                  size="small"
                  aria-label="Mark as not helpful"
                >
                  <ThumbsDown size={16} />
                  Not Helpful
                </Button>
              </div>
            </div>
          </div>
        </section>
      )}
      
      {/* Keyboard shortcuts help */}
      {!isPrintView && (
        <div className="kb-entry-detail__shortcuts">
          <details>
            <summary>Keyboard Shortcuts</summary>
            <ul>
              {isModal && <li><kbd>Escape</kbd> - Close</li>}
              {canEdit && <li><kbd>E</kbd> - Edit</li>}
              <li><kbd>C</kbd> - Copy full content</li>
              <li><kbd>S</kbd> - Share</li>
              {enablePrint && <li><kbd>P</kbd> - Print</li>}
            </ul>
          </details>
        </div>
      )}
    </div>
  );
  
  // Wrap in modal backdrop if in modal mode
  if (isModal) {
    return (
      <div 
        className="kb-entry-detail__backdrop"
        onClick={handleBackdropClick}
        data-testid="kb-entry-detail-backdrop"
      >
        {content}
      </div>
    );
  }
  
  return content;
};

export const KBEntryDetail = memo(KBEntryDetailComponent);

KBEntryDetail.displayName = 'KBEntryDetail';