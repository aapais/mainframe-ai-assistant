import React, { memo, useState, useCallback } from 'react';
import { ChevronDown, ChevronRight, Clock, CheckCircle, XCircle, TrendingUp, Hash, Copy, Share2, BookOpen } from 'lucide-react';
import styles from './KBEntryCard.module.css';
import { formatDistanceToNow } from 'date-fns';
import { CategoryBadge } from './indicators/CategoryBadge';
import { SuccessRateIndicator } from './indicators/SuccessRateIndicator';
import { UsageStats } from './indicators/UsageStats';
import { ProblemDisplay } from './content/ProblemDisplay';
import { SolutionDisplay } from './content/SolutionDisplay';
import { QuickActions } from './actions/QuickActions';

export interface KBEntry {
  id: string;
  title: string;
  problem: string;
  solution: string;
  category: 'JCL' | 'VSAM' | 'DB2' | 'Batch' | 'Functional' | 'Other';
  tags: string[];
  created_at: Date;
  updated_at: Date;
  usage_count: number;
  success_count: number;
  failure_count: number;
  confidence_score?: number;
  related_entries?: string[];
  code_examples?: string[];
  estimated_resolution_time?: number;
}

export interface KBEntryCardProps {
  entry: KBEntry;
  variant?: 'compact' | 'detailed' | 'summary';
  onRate?: (entryId: string, success: boolean) => void;
  onCopy?: (content: string) => void;
  onShare?: (entry: KBEntry) => void;
  onNavigate?: (entryId: string) => void;
  isHighlighted?: boolean;
  searchQuery?: string;
  showActions?: boolean;
  expandedByDefault?: boolean;
}

export const KBEntryCard = memo(function KBEntryCard({
  entry,
  variant = 'detailed',
  onRate,
  onCopy,
  onShare,
  onNavigate,
  isHighlighted = false,
  searchQuery,
  showActions = true,
  expandedByDefault = false
}: KBEntryCardProps) {
  const [isExpanded, setIsExpanded] = useState(expandedByDefault);
  const [showFullSolution, setShowFullSolution] = useState(false);
  
  const successRate = entry.usage_count > 0 
    ? Math.round((entry.success_count / entry.usage_count) * 100)
    : 0;
    
  const isRecent = new Date(entry.updated_at).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000;
  const isPopular = entry.usage_count > 10;
  const isHighConfidence = entry.confidence_score && entry.confidence_score > 0.8;
  
  const toggleExpanded = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);
  
  const handleRate = useCallback((success: boolean) => {
    onRate?.(entry.id, success);
  }, [entry.id, onRate]);
  
  const handleCopyFull = useCallback(() => {
    const content = `${entry.title}\n\nProblem:\n${entry.problem}\n\nSolution:\n${entry.solution}\n\nCategory: ${entry.category}\nTags: ${entry.tags.join(', ')}`;
    onCopy?.(content);
  }, [entry, onCopy]);
  
  // Compact variant for lists and search results
  if (variant === 'compact') {
    return (
      <article 
        className={`${styles.card} ${styles.compact} ${isHighlighted ? styles.highlighted : ''}`}
        onClick={toggleExpanded}
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        aria-label={`KB Entry: ${entry.title}`}
      >
        <div className={styles.compactHeader}>
          <div className={styles.expandIcon}>
            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </div>
          <h3 className={styles.compactTitle}>{entry.title}</h3>
          <div className={styles.compactIndicators}>
            <CategoryBadge category={entry.category} size="small" />
            {successRate > 70 && <CheckCircle className={styles.successIcon} size={14} />}
            {isRecent && <div className={styles.recentBadge}>New</div>}
          </div>
        </div>
        {isExpanded && (
          <div className={styles.compactContent}>
            <ProblemDisplay problem={entry.problem} truncate={true} searchQuery={searchQuery} />
            <div className={styles.compactMeta}>
              <UsageStats count={entry.usage_count} compact={true} />
              <SuccessRateIndicator rate={successRate} compact={true} />
            </div>
          </div>
        )}
      </article>
    );
  }
  
  // Summary variant for quick overview
  if (variant === 'summary') {
    return (
      <article className={`${styles.card} ${styles.summary} ${isHighlighted ? styles.highlighted : ''}`}>
        <div className={styles.summaryHeader}>
          <h3 className={styles.summaryTitle}>{entry.title}</h3>
          <CategoryBadge category={entry.category} />
        </div>
        <div className={styles.summaryContent}>
          <p className={styles.problemSummary}>
            {entry.problem.substring(0, 150)}{entry.problem.length > 150 && '...'}
          </p>
          <div className={styles.summaryFooter}>
            <div className={styles.tags}>
              {entry.tags.slice(0, 3).map(tag => (
                <span key={tag} className={styles.tag}>
                  <Hash size={10} />
                  {tag}
                </span>
              ))}
            </div>
            <button 
              className={styles.viewDetailsBtn}
              onClick={() => onNavigate?.(entry.id)}
              aria-label="View full details"
            >
              View Details
            </button>
          </div>
        </div>
      </article>
    );
  }
  
  // Detailed variant (default) - full information display
  return (
    <article 
      className={`${styles.card} ${styles.detailed} ${isHighlighted ? styles.highlighted : ''}`}
      aria-label={`KB Entry: ${entry.title}`}
    >
      {/* Priority indicators bar */}
      <div className={styles.priorityBar}>
        {isHighConfidence && (
          <div className={styles.confidenceBadge}>
            <TrendingUp size={12} />
            High Confidence
          </div>
        )}
        {isRecent && (
          <div className={styles.recentBadge}>
            <Clock size={12} />
            Recently Updated
          </div>
        )}
        {isPopular && (
          <div className={styles.popularBadge}>
            <BookOpen size={12} />
            Frequently Used
          </div>
        )}
      </div>
      
      {/* Main header with title and category */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <h2 className={styles.title}>{entry.title}</h2>
          <div className={styles.metadata}>
            <CategoryBadge category={entry.category} />
            <span className={styles.updateTime}>
              Updated {formatDistanceToNow(new Date(entry.updated_at))} ago
            </span>
            {entry.estimated_resolution_time && (
              <span className={styles.estimatedTime}>
                ~{entry.estimated_resolution_time} min to resolve
              </span>
            )}
          </div>
        </div>
        <div className={styles.headerRight}>
          <SuccessRateIndicator rate={successRate} showLabel={true} />
          <UsageStats count={entry.usage_count} showTrend={true} />
        </div>
      </header>
      
      {/* Problem section with enhanced display */}
      <section className={styles.problemSection} aria-labelledby="problem-heading">
        <h3 id="problem-heading" className={styles.sectionTitle}>Problem Description</h3>
        <ProblemDisplay 
          problem={entry.problem} 
          searchQuery={searchQuery}
          showFullContent={true}
        />
      </section>
      
      {/* Solution section with progressive disclosure */}
      <section className={styles.solutionSection} aria-labelledby="solution-heading">
        <h3 id="solution-heading" className={styles.sectionTitle}>Solution</h3>
        <SolutionDisplay 
          solution={entry.solution}
          codeExamples={entry.code_examples}
          showFull={showFullSolution}
          onToggleView={() => setShowFullSolution(!showFullSolution)}
          searchQuery={searchQuery}
        />
      </section>
      
      {/* Tags and related entries */}
      <div className={styles.bottomSection}>
        <div className={styles.tags}>
          {entry.tags.map(tag => (
            <span key={tag} className={styles.tag}>
              <Hash size={12} />
              {tag}
            </span>
          ))}
        </div>
        
        {entry.related_entries && entry.related_entries.length > 0 && (
          <div className={styles.relatedEntries}>
            <span className={styles.relatedLabel}>Related:</span>
            {entry.related_entries.slice(0, 3).map(relatedId => (
              <button
                key={relatedId}
                className={styles.relatedLink}
                onClick={() => onNavigate?.(relatedId)}
                aria-label={`Navigate to related entry ${relatedId}`}
              >
                View #{relatedId.substring(0, 8)}
              </button>
            ))}
          </div>
        )}
      </div>
      
      {/* Quick actions footer */}
      {showActions && (
        <QuickActions
          entry={entry}
          onRate={handleRate}
          onCopy={handleCopyFull}
          onShare={() => onShare?.(entry)}
          successRate={successRate}
        />
      )}
    </article>
  );
});