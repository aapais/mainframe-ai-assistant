/**
 * SnippetPreview - Enhanced Search Result Preview Component
 *
 * Provides detailed preview with:
 * - Highlighted search terms in context
 * - Expandable sections (problem, solution, details)
 * - Related entries suggestions
 * - Quick actions (copy, share, bookmark)
 * - Responsive layout with smooth animations
 * - Accessibility features
 *
 * @author Frontend Developer
 * @version 2.0.0
 */

import React, {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
  memo
} from 'react';
import {
  X,
  Copy,
  ExternalLink,
  Bookmark,
  BookmarkCheck,
  ChevronDown,
  ChevronUp,
  Clock,
  Tag,
  TrendingUp,
  Share2,
  Eye,
  ThumbsUp,
  AlertCircle,
  CheckCircle2,
  Code,
  FileText
} from 'lucide-react';
import { SearchResult } from '../../types';

// ========================
// Types & Interfaces
// ========================

export interface SnippetPreviewProps {
  /** Search result to preview */
  result: SearchResult;
  /** Search query for highlighting */
  searchQuery: string;
  /** Callback when preview is closed */
  onClose: () => void;
  /** Custom CSS className */
  className?: string;
  /** Enable related entries */
  showRelated?: boolean;
  /** Enable quick actions */
  showActions?: boolean;
  /** Enable expandable sections */
  expandableSections?: boolean;
  /** Compact mode for smaller screens */
  compact?: boolean;
  /** Animation preferences */
  animated?: boolean;
  /** Callback when entry is bookmarked */
  onBookmark?: (entryId: string, bookmarked: boolean) => void;
  /** Callback when entry is shared */
  onShare?: (entry: any) => void;
  /** Callback when entry is opened in full view */
  onOpenFull?: (entry: any) => void;
  /** Related entries data */
  relatedEntries?: SearchResult[];
  /** Whether entry is bookmarked */
  isBookmarked?: boolean;
}

interface ExpandableSection {
  id: string;
  title: string;
  content: string;
  icon: React.ReactNode;
  expanded: boolean;
  priority: number;
}

interface ActionButton {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
}

// ========================
// Utility Functions
// ========================

const highlightSearchTerms = (text: string, searchQuery: string): React.ReactNode => {
  if (!searchQuery.trim()) return text;

  const terms = searchQuery.toLowerCase().split(/\s+/).filter(term => term.length > 1);
  if (terms.length === 0) return text;

  const regex = new RegExp(`(${terms.join('|')})`, 'gi');
  const parts = text.split(regex);

  return parts.map((part, index) => {
    const isMatch = terms.some(term =>
      part.toLowerCase().includes(term.toLowerCase())
    );
    return isMatch ? (
      <mark key={index} className="bg-yellow-200 px-1 rounded">
        {part}
      </mark>
    ) : part;
  });
};

const getMatchTypeIcon = (matchType: SearchResult['matchType']) => {
  const iconMap = {
    exact: <CheckCircle2 size={16} className="text-green-600" />,
    fuzzy: <Eye size={16} className="text-blue-600" />,
    ai: <TrendingUp size={16} className="text-purple-600" />,
    semantic: <AlertCircle size={16} className="text-orange-600" />
  };
  return iconMap[matchType] || <FileText size={16} className="text-gray-600" />;
};

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;

  return date.toLocaleDateString();
};

const generateShareText = (entry: any): string => {
  return `Knowledge Base Entry: ${entry.title}\n\nProblem: ${entry.problem}\n\nSolution: ${entry.solution.substring(0, 200)}...`;
};

// ========================
// Sub-components
// ========================

const ExpandableSection = memo<{
  section: ExpandableSection;
  onToggle: (sectionId: string) => void;
  searchQuery: string;
  animated?: boolean;
}>(({ section, onToggle, searchQuery, animated = true }) => {
  const contentRef = useRef<HTMLDivElement>(null);

  return (
    <div className={`expandable-section border border-gray-200 rounded-lg ${
      animated ? 'transition-all duration-200' : ''
    }`}>
      <button
        onClick={() => onToggle(section.id)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
        aria-expanded={section.expanded}
        aria-controls={`section-${section.id}-content`}
      >
        <div className="flex items-center gap-3">
          {section.icon}
          <h3 className="font-medium text-left">{section.title}</h3>
        </div>
        {section.expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </button>

      {section.expanded && (
        <div
          id={`section-${section.id}-content`}
          ref={contentRef}
          className={`border-t border-gray-200 p-4 ${
            animated ? 'animate-fadeIn' : ''
          }`}
        >
          <div className="prose prose-sm max-w-none">
            {highlightSearchTerms(section.content, searchQuery)}
          </div>
        </div>
      )}
    </div>
  );
});

const ActionButtons = memo<{
  actions: ActionButton[];
  compact?: boolean;
}>(({ actions, compact = false }) => (
  <div className={`action-buttons flex ${compact ? 'gap-2' : 'gap-3'} flex-wrap`}>
    {actions.map(action => (
      <button
        key={action.id}
        onClick={action.onClick}
        disabled={action.disabled}
        className={`
          flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition-colors
          ${compact ? 'text-xs px-2 py-1' : 'text-sm'}
          ${action.variant === 'primary'
            ? 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300'
            : action.variant === 'danger'
            ? 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:bg-gray-50'
          }
          disabled:cursor-not-allowed
        `}
        title={action.label}
        aria-label={action.label}
      >
        {action.icon}
        {!compact && <span>{action.label}</span>}
      </button>
    ))}
  </div>
));

const RelatedEntries = memo<{
  entries: SearchResult[];
  onEntrySelect?: (entry: SearchResult) => void;
  compact?: boolean;
}>(({ entries, onEntrySelect, compact = false }) => {
  if (entries.length === 0) return null;

  return (
    <div className="related-entries">
      <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
        <TrendingUp size={16} />
        Related Entries
      </h4>

      <div className="space-y-2">
        {entries.slice(0, compact ? 3 : 5).map((entry, index) => (
          <button
            key={entry.entry.id}
            onClick={() => onEntrySelect?.(entry)}
            className="w-full text-left p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h5 className="font-medium text-sm text-gray-900 truncate">
                  {entry.entry.title}
                </h5>
                <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                  {entry.entry.problem}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-gray-500">
                    {entry.entry.category}
                  </span>
                  {getMatchTypeIcon(entry.matchType)}
                </div>
              </div>

              <div className="flex-shrink-0 text-right">
                <div className="text-xs text-gray-500 mb-1">
                  {Math.round(entry.score)}%
                </div>
                <div className={`w-12 h-1 rounded-full ${
                  entry.score >= 80 ? 'bg-green-500' :
                  entry.score >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                }`} />
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
});

// ========================
// Main Component
// ========================

export const SnippetPreview = memo<SnippetPreviewProps>(({
  result,
  searchQuery,
  onClose,
  className = '',
  showRelated = true,
  showActions = true,
  expandableSections = true,
  compact = false,
  animated = true,
  onBookmark,
  onShare,
  onOpenFull,
  relatedEntries = [],
  isBookmarked = false
}) => {
  const { entry, score, matchType, highlights } = result;

  // ========================
  // State Management
  // ========================

  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['problem']) // Problem section expanded by default
  );
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copying' | 'copied'>('idle');

  // ========================
  // Section Configuration
  // ========================

  const sections: ExpandableSection[] = useMemo(() => [
    {
      id: 'problem',
      title: 'Problem Description',
      content: entry.problem,
      icon: <AlertCircle size={16} className="text-orange-600" />,
      expanded: expandedSections.has('problem'),
      priority: 1
    },
    {
      id: 'solution',
      title: 'Solution',
      content: entry.solution,
      icon: <CheckCircle2 size={16} className="text-green-600" />,
      expanded: expandedSections.has('solution'),
      priority: 2
    },
    {
      id: 'details',
      title: 'Additional Details',
      content: entry.details || 'No additional details available.',
      icon: <FileText size={16} className="text-blue-600" />,
      expanded: expandedSections.has('details'),
      priority: 3
    },
    {
      id: 'code',
      title: 'Code Examples',
      content: entry.code_examples || 'No code examples available.',
      icon: <Code size={16} className="text-purple-600" />,
      expanded: expandedSections.has('code'),
      priority: 4
    }
  ].filter(section => section.content && section.content !== 'No additional details available.' && section.content !== 'No code examples available.'), [
    entry,
    expandedSections
  ]);

  // ========================
  // Action Buttons Configuration
  // ========================

  const handleCopy = useCallback(async () => {
    setCopyStatus('copying');
    try {
      const textToCopy = `${entry.title}\n\nProblem:\n${entry.problem}\n\nSolution:\n${entry.solution}`;
      await navigator.clipboard.writeText(textToCopy);
      setCopyStatus('copied');
      setTimeout(() => setCopyStatus('idle'), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
      setCopyStatus('idle');
    }
  }, [entry]);

  const handleShare = useCallback(() => {
    if (navigator.share) {
      navigator.share({
        title: entry.title,
        text: generateShareText(entry),
        url: window.location.href
      }).catch(console.error);
    } else {
      onShare?.(entry);
    }
  }, [entry, onShare]);

  const handleBookmark = useCallback(() => {
    onBookmark?.(entry.id, !isBookmarked);
  }, [entry.id, isBookmarked, onBookmark]);

  const actions: ActionButton[] = useMemo(() => [
    {
      id: 'copy',
      label: copyStatus === 'copied' ? 'Copied!' : 'Copy',
      icon: <Copy size={16} />,
      onClick: handleCopy,
      disabled: copyStatus === 'copying',
      variant: 'secondary'
    },
    {
      id: 'bookmark',
      label: isBookmarked ? 'Bookmarked' : 'Bookmark',
      icon: isBookmarked ? <BookmarkCheck size={16} /> : <Bookmark size={16} />,
      onClick: handleBookmark,
      variant: isBookmarked ? 'primary' : 'secondary'
    },
    {
      id: 'share',
      label: 'Share',
      icon: <Share2 size={16} />,
      onClick: handleShare,
      variant: 'secondary'
    },
    {
      id: 'open',
      label: 'Open Full',
      icon: <ExternalLink size={16} />,
      onClick: () => onOpenFull?.(entry),
      variant: 'primary'
    }
  ], [copyStatus, isBookmarked, handleCopy, handleBookmark, handleShare, onOpenFull, entry]);

  // ========================
  // Event Handlers
  // ========================

  const toggleSection = useCallback((sectionId: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  // ========================
  // Effects
  // ========================

  useEffect(() => {
    // Auto-expand most relevant sections based on search
    if (searchQuery) {
      const relevantSections = new Set(['problem']);

      if (entry.solution.toLowerCase().includes(searchQuery.toLowerCase())) {
        relevantSections.add('solution');
      }

      setExpandedSections(relevantSections);
    }
  }, [searchQuery, entry.solution]);

  // ========================
  // Render
  // ========================

  return (
    <div
      className={`snippet-preview flex flex-col h-full bg-white border-l border-gray-200 ${className}`}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
      role="dialog"
      aria-labelledby="preview-title"
      aria-describedby="preview-content"
    >
      {/* Header */}
      <div className="preview-header flex-shrink-0 p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h2
              id="preview-title"
              className="font-semibold text-lg text-gray-900 mb-2 break-words"
            >
              {highlightSearchTerms(entry.title, searchQuery)}
            </h2>

            <div className="flex items-center gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <Tag size={14} />
                <span>{entry.category}</span>
              </div>

              <div className="flex items-center gap-1">
                <Clock size={14} />
                <span>{formatDate(entry.updated_at)}</span>
              </div>

              <div className="flex items-center gap-1">
                {getMatchTypeIcon(matchType)}
                <span>{Math.round(score)}% match</span>
              </div>
            </div>

            {/* Tags */}
            {entry.tags && entry.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {entry.tags.slice(0, compact ? 3 : 6).map(tag => (
                  <span
                    key={tag}
                    className="inline-block px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
                  >
                    {tag}
                  </span>
                ))}
                {entry.tags.length > (compact ? 3 : 6) && (
                  <span className="text-xs text-gray-500">
                    +{entry.tags.length - (compact ? 3 : 6)} more
                  </span>
                )}
              </div>
            )}
          </div>

          <button
            onClick={onClose}
            className="flex-shrink-0 p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close preview"
          >
            <X size={20} />
          </button>
        </div>

        {/* Quick Actions */}
        {showActions && (
          <div className="mt-4">
            <ActionButtons actions={actions} compact={compact} />
          </div>
        )}
      </div>

      {/* Content */}
      <div
        id="preview-content"
        className="preview-content flex-1 overflow-y-auto p-4 space-y-4"
      >
        {/* Key Highlights */}
        {highlights && highlights.length > 0 && (
          <div className="highlights p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h4 className="font-medium text-yellow-800 mb-2">Key Matches</h4>
            <div className="space-y-1">
              {highlights.slice(0, 3).map((highlight, index) => (
                <p key={index} className="text-sm text-yellow-700">
                  "...{highlight}..."
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Expandable Sections */}
        {expandableSections && sections.length > 0 ? (
          <div className="space-y-3">
            {sections.map(section => (
              <ExpandableSection
                key={section.id}
                section={section}
                onToggle={toggleSection}
                searchQuery={searchQuery}
                animated={animated}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                <AlertCircle size={16} className="text-orange-600" />
                Problem
              </h4>
              <div className="prose prose-sm max-w-none">
                {highlightSearchTerms(entry.problem, searchQuery)}
              </div>
            </div>

            <div>
              <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                <CheckCircle2 size={16} className="text-green-600" />
                Solution
              </h4>
              <div className="prose prose-sm max-w-none">
                {highlightSearchTerms(entry.solution, searchQuery)}
              </div>
            </div>
          </div>
        )}

        {/* Related Entries */}
        {showRelated && relatedEntries.length > 0 && (
          <div className="mt-6 pt-4 border-t border-gray-200">
            <RelatedEntries
              entries={relatedEntries}
              compact={compact}
            />
          </div>
        )}

        {/* Entry Metadata */}
        <div className="mt-6 pt-4 border-t border-gray-200 text-xs text-gray-500 space-y-1">
          <div>Entry ID: {entry.id}</div>
          <div>Usage Count: {entry.usage_count || 0}</div>
          <div>Last Modified: {new Date(entry.updated_at).toLocaleString()}</div>
          {entry.version && <div>Version: {entry.version}</div>}
        </div>
      </div>
    </div>
  );
});

SnippetPreview.displayName = 'SnippetPreview';

export default SnippetPreview;