import React, { memo, useState } from 'react';
import { ThumbsUp, ThumbsDown, Copy, Share2, Edit, Bookmark, ExternalLink, MessageSquare } from 'lucide-react';
import styles from './QuickActions.module.css';

export interface QuickActionsProps {
  entry: any;
  onRate?: (success: boolean) => void;
  onCopy?: () => void;
  onShare?: () => void;
  onEdit?: () => void;
  onBookmark?: () => void;
  onComment?: () => void;
  onViewSource?: () => void;
  successRate?: number;
  isBookmarked?: boolean;
  commentCount?: number;
}

export const QuickActions = memo(function QuickActions({
  entry,
  onRate,
  onCopy,
  onShare,
  onEdit,
  onBookmark,
  onComment,
  onViewSource,
  successRate = 0,
  isBookmarked = false,
  commentCount = 0
}: QuickActionsProps) {
  const [userRating, setUserRating] = useState<'success' | 'failure' | null>(null);
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  
  const handleRate = (success: boolean) => {
    setUserRating(success ? 'success' : 'failure');
    onRate?.(success);
  };
  
  const handleCopy = async () => {
    if (onCopy) {
      onCopy();
    } else {
      // Default copy behavior
      const text = `${entry.title}\n\nProblem:\n${entry.problem}\n\nSolution:\n${entry.solution}`;
      await navigator.clipboard.writeText(text);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  const handleShare = async () => {
    if (onShare) {
      onShare();
    } else if (navigator.share) {
      // Web Share API
      try {
        await navigator.share({
          title: entry.title,
          text: entry.problem,
          url: window.location.href
        });
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      } catch (err) {
        // User cancelled or error
      }
    }
  };
  
  return (
    <div className={styles.container}>
      {/* Primary Actions */}
      <div className={styles.primaryActions}>
        <div className={styles.ratingSection}>
          <span className={styles.ratingLabel}>Was this helpful?</span>
          <div className={styles.ratingButtons}>
            <button
              className={`${styles.ratingButton} ${userRating === 'success' ? styles.active : ''}`}
              onClick={() => handleRate(true)}
              aria-label="Mark as helpful"
              aria-pressed={userRating === 'success'}
              disabled={userRating !== null}
            >
              <ThumbsUp size={16} />
              <span>Yes</span>
              {successRate > 0 && userRating === null && (
                <span className={styles.ratingCount}>{Math.round(successRate)}%</span>
              )}
            </button>
            <button
              className={`${styles.ratingButton} ${userRating === 'failure' ? styles.active : ''}`}
              onClick={() => handleRate(false)}
              aria-label="Mark as not helpful"
              aria-pressed={userRating === 'failure'}
              disabled={userRating !== null}
            >
              <ThumbsDown size={16} />
              <span>No</span>
              {successRate > 0 && userRating === null && (
                <span className={styles.ratingCount}>{100 - Math.round(successRate)}%</span>
              )}
            </button>
          </div>
          {userRating && (
            <div className={styles.ratingFeedback}>
              Thank you for your feedback!
            </div>
          )}
        </div>
      </div>
      
      {/* Secondary Actions */}
      <div className={styles.secondaryActions}>
        <button
          className={`${styles.actionButton} ${copied ? styles.success : ''}`}
          onClick={handleCopy}
          aria-label="Copy to clipboard"
          title="Copy to clipboard"
        >
          <Copy size={16} />
          <span>{copied ? 'Copied!' : 'Copy'}</span>
        </button>
        
        {navigator.share && (
          <button
            className={`${styles.actionButton} ${shared ? styles.success : ''}`}
            onClick={handleShare}
            aria-label="Share"
            title="Share"
          >
            <Share2 size={16} />
            <span>{shared ? 'Shared!' : 'Share'}</span>
          </button>
        )}
        
        {onEdit && (
          <button
            className={styles.actionButton}
            onClick={onEdit}
            aria-label="Edit entry"
            title="Edit entry"
          >
            <Edit size={16} />
            <span>Edit</span>
          </button>
        )}
        
        {onBookmark && (
          <button
            className={`${styles.actionButton} ${isBookmarked ? styles.bookmarked : ''}`}
            onClick={onBookmark}
            aria-label={isBookmarked ? 'Remove bookmark' : 'Add bookmark'}
            aria-pressed={isBookmarked}
            title={isBookmarked ? 'Remove bookmark' : 'Add bookmark'}
          >
            <Bookmark size={16} fill={isBookmarked ? 'currentColor' : 'none'} />
            <span>{isBookmarked ? 'Saved' : 'Save'}</span>
          </button>
        )}
        
        {onComment && (
          <button
            className={styles.actionButton}
            onClick={onComment}
            aria-label="Add comment"
            title="Add comment"
          >
            <MessageSquare size={16} />
            <span>Comment</span>
            {commentCount > 0 && (
              <span className={styles.commentCount}>{commentCount}</span>
            )}
          </button>
        )}
        
        {onViewSource && (
          <button
            className={styles.actionButton}
            onClick={onViewSource}
            aria-label="View source"
            title="View source"
          >
            <ExternalLink size={16} />
            <span>Source</span>
          </button>
        )}
      </div>
    </div>
  );
});