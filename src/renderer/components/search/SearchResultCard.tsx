/**
 * SearchResultCard Component
 * Enhanced search result item with inline editing capabilities and quick actions
 */

import React, { useState, useCallback, memo } from 'react';
import {
  Edit,
  Trash2,
  Copy,
  History,
  MoreVertical,
  Check,
  X,
  Calendar,
  Eye,
  TrendingUp,
  Tag,
  AlertTriangle,
  CheckCircle,
  Clock,
  Save,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { SearchResult, KBEntry } from '../../../types/services';
import { formatDate, formatRelativeTime } from '../../utils/formatters';
import QuickActions from './QuickActions';

interface SearchResultCardProps {
  result: SearchResult;
  query: string;
  isSelected?: boolean;
  showCheckbox?: boolean;
  highlightQuery?: boolean;
  showQuickActions?: boolean;
  showInlineEdit?: boolean;
  onSelect?: (result: SearchResult) => void;
  onToggleSelection?: (entryId: string) => void;
  onEdit?: (entry: KBEntry) => void;
  onDelete?: (entry: KBEntry) => void;
  onDuplicate?: (entry: KBEntry) => void;
  onViewHistory?: (entry: KBEntry) => void;
  onRate?: (entryId: string, successful: boolean) => void;
  onQuickUpdate?: (entryId: string, updates: Partial<KBEntry>) => Promise<void>;
  index?: number;
}

/**
 * Inline Edit Component for quick updates
 */
const InlineEditForm: React.FC<{
  entry: KBEntry;
  onSave: (updates: Partial<KBEntry>) => Promise<void>;
  onCancel: () => void;
}> = ({ entry, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    title: entry.title,
    problem: entry.problem,
    solution: entry.solution,
    tags: entry.tags?.join(', ') || '',
    severity: entry.severity || 'medium'
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const updates: Partial<KBEntry> = {
        title: formData.title,
        problem: formData.problem,
        solution: formData.solution,
        tags: formData.tags.split(',').map(tag => tag.trim()).filter(Boolean),
        severity: formData.severity as 'low' | 'medium' | 'high' | 'critical'
      };

      await onSave(updates);
    } catch (error) {
      console.error('Failed to save inline edits:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="inline-edit-form">
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Title
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Problem Description
          </label>
          <textarea
            value={formData.problem}
            onChange={(e) => setFormData(prev => ({ ...prev, problem: e.target.value }))}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Solution
          </label>
          <textarea
            value={formData.solution}
            onChange={(e) => setFormData(prev => ({ ...prev, solution: e.target.value }))}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tags (comma-separated)
            </label>
            <input
              type="text"
              value={formData.tags}
              onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
              placeholder="error, db2, troubleshooting"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Severity
            </label>
            <select
              value={formData.severity}
              onChange={(e) => setFormData(prev => ({ ...prev, severity: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end space-x-3 mt-4 pt-3 border-t border-gray-200">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 focus:outline-none"
          disabled={saving}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {saving ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </>
          )}
        </button>
      </div>
    </form>
  );
};

/**
 * Main Search Result Card Component
 */
export const SearchResultCard = memo<SearchResultCardProps>(({
  result,
  query,
  isSelected = false,
  showCheckbox = false,
  highlightQuery = true,
  showQuickActions = true,
  showInlineEdit = true,
  onSelect,
  onToggleSelection,
  onEdit,
  onDelete,
  onDuplicate,
  onViewHistory,
  onRate,
  onQuickUpdate,
  index = 0
}) => {
  const [expanded, setExpanded] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [inlineEditing, setInlineEditing] = useState(false);
  const [rating, setRating] = useState<'success' | 'failure' | null>(null);

  const { entry, score, matchType, highlights, explanation } = result;

  // Calculate metrics
  const successRate = entry.usage_count > 0
    ? Math.round((entry.success_count / entry.usage_count) * 100)
    : 0;

  // Get severity styling
  const getSeverityColor = (severity?: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Get match type styling
  const getMatchTypeColor = (type: string) => {
    switch (type) {
      case 'exact': return 'bg-green-100 text-green-800';
      case 'fuzzy': return 'bg-blue-100 text-blue-800';
      case 'semantic': return 'bg-purple-100 text-purple-800';
      case 'ai': return 'bg-indigo-100 text-indigo-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Highlight text function
  const getHighlightedText = useCallback((text: string, field: string) => {
    if (!highlightQuery || !highlights || !query.trim()) return text;

    const fieldHighlights = highlights.filter(h => h.field === field);
    if (fieldHighlights.length === 0) {
      // Fallback to simple text highlighting
      const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
      return text.replace(regex, '<mark class="bg-yellow-200 px-1 rounded">$1</mark>');
    }

    let highlightedText = text;
    fieldHighlights
      .sort((a, b) => b.start - a.start)
      .forEach(highlight => {
        const before = highlightedText.substring(0, highlight.start);
        const match = highlightedText.substring(highlight.start, highlight.end);
        const after = highlightedText.substring(highlight.end);
        highlightedText = `${before}<mark class="bg-yellow-200 px-1 rounded">${match}</mark>${after}`;
      });

    return highlightedText;
  }, [highlightQuery, highlights, query]);

  // Handle actions
  const handleCardClick = useCallback(() => {
    if (!inlineEditing) {
      onSelect?.(result);
    }
  }, [inlineEditing, onSelect, result]);

  const handleToggleExpand = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(!expanded);
  }, [expanded]);

  const handleInlineEdit = useCallback(() => {
    setInlineEditing(true);
    setShowActions(false);
  }, []);

  const handleInlineEditSave = useCallback(async (updates: Partial<KBEntry>) => {
    if (onQuickUpdate) {
      await onQuickUpdate(entry.id, updates);
    }
    setInlineEditing(false);
  }, [entry.id, onQuickUpdate]);

  const handleInlineEditCancel = useCallback(() => {
    setInlineEditing(false);
  }, []);

  const handleRate = useCallback((successful: boolean) => {
    setRating(successful ? 'success' : 'failure');
    onRate?.(entry.id, successful);
  }, [entry.id, onRate]);

  return (
    <div
      className={`
        search-result-card bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-all duration-200
        ${isSelected ? 'ring-2 ring-blue-500 border-blue-500' : ''}
        ${inlineEditing ? 'ring-2 ring-green-500 border-green-500' : ''}
      `}
      role="article"
      aria-labelledby={`entry-title-${entry.id}`}
    >
      {/* Header */}
      <div
        className={`p-4 cursor-pointer ${inlineEditing ? 'cursor-default' : ''}`}
        onClick={handleCardClick}
      >
        <div className="flex items-start space-x-3">
          {/* Selection Checkbox */}
          {showCheckbox && (
            <div className="flex-shrink-0 pt-1">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={(e) => {
                  e.stopPropagation();
                  onToggleSelection?.(entry.id);
                }}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                aria-label={`Select ${entry.title}`}
              />
            </div>
          )}

          {/* Rank */}
          <div className="flex-shrink-0">
            <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm font-medium text-gray-600">
              #{index + 1}
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            {/* Title Row */}
            <div className="flex items-start justify-between mb-2">
              <h3
                id={`entry-title-${entry.id}`}
                className="text-lg font-semibold text-gray-900 leading-tight"
                dangerouslySetInnerHTML={{
                  __html: getHighlightedText(entry.title, 'title')
                }}
              />

              <div className="flex items-center space-x-2 ml-4">
                {/* Match Type Badge */}
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getMatchTypeColor(matchType)}`}>
                  {matchType}
                </span>

                {/* Severity Badge */}
                <span className={`px-2 py-1 text-xs font-medium rounded border ${getSeverityColor(entry.severity)}`}>
                  {entry.severity}
                </span>

                {/* Score */}
                <div className="flex items-center space-x-1">
                  <div className="w-12 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 transition-all duration-300"
                      style={{ width: `${Math.min(100, score)}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-600 font-medium">
                    {Math.round(score)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Metadata Row */}
            <div className="flex items-center space-x-4 text-sm text-gray-500 mb-3">
              <span className="flex items-center">
                <Tag className="h-4 w-4 mr-1" />
                {entry.category}
              </span>
              <span className="flex items-center">
                <Eye className="h-4 w-4 mr-1" />
                {entry.usage_count} views
              </span>
              {(entry.success_count + entry.failure_count) > 0 && (
                <span className="flex items-center">
                  <TrendingUp className="h-4 w-4 mr-1" />
                  {successRate}% success
                </span>
              )}
              <span className="flex items-center">
                <Calendar className="h-4 w-4 mr-1" />
                {formatRelativeTime(entry.updated_at)}
              </span>
            </div>

            {/* Problem Preview */}
            {!inlineEditing && (
              <p
                className="text-gray-700 text-sm leading-relaxed mb-3"
                dangerouslySetInnerHTML={{
                  __html: getHighlightedText(
                    entry.problem.length > 200
                      ? entry.problem.substring(0, 200) + '...'
                      : entry.problem,
                    'problem'
                  )
                }}
              />
            )}

            {/* Tags */}
            {!inlineEditing && entry.tags && entry.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                {entry.tags.slice(0, 6).map((tag, tagIndex) => (
                  <span
                    key={tagIndex}
                    className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded-md border border-blue-200"
                    dangerouslySetInnerHTML={{
                      __html: getHighlightedText(tag, 'tags')
                    }}
                  />
                ))}
                {entry.tags.length > 6 && (
                  <span className="px-2 py-1 text-xs bg-gray-50 text-gray-600 rounded-md border border-gray-200">
                    +{entry.tags.length - 6} more
                  </span>
                )}
              </div>
            )}

            {/* Inline Edit Form */}
            {inlineEditing && (
              <div className="mt-4">
                <InlineEditForm
                  entry={entry}
                  onSave={handleInlineEditSave}
                  onCancel={handleInlineEditCancel}
                />
              </div>
            )}
          </div>

          {/* Action Buttons */}
          {!inlineEditing && (
            <div className="flex items-center space-x-2">
              {/* Quick Actions */}
              {showQuickActions && (
                <QuickActions
                  entry={entry}
                  onEdit={showInlineEdit ? handleInlineEdit : onEdit}
                  onDelete={onDelete}
                  onDuplicate={onDuplicate}
                  onViewHistory={onViewHistory}
                  showInlineEdit={showInlineEdit}
                />
              )}

              {/* Expand Button */}
              <button
                onClick={handleToggleExpand}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                aria-label={expanded ? 'Collapse details' : 'Expand details'}
                aria-expanded={expanded}
              >
                {expanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && !inlineEditing && (
        <div className="border-t border-gray-100 p-4 bg-gray-50">
          <div className="space-y-4">
            {/* Full Problem Description */}
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-2">Problem Description</h4>
              <p
                className="text-sm text-gray-700 leading-relaxed"
                dangerouslySetInnerHTML={{
                  __html: getHighlightedText(entry.problem, 'problem')
                }}
              />
            </div>

            {/* Solution */}
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-2">Solution</h4>
              <div
                className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap"
                dangerouslySetInnerHTML={{
                  __html: getHighlightedText(entry.solution, 'solution')
                }}
              />
            </div>

            {/* Match Explanation */}
            {explanation && (
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-2">Why This Matches</h4>
                <p className="text-sm text-blue-700 bg-blue-50 p-3 rounded-md border border-blue-200">
                  {explanation}
                </p>
              </div>
            )}

            {/* Rating Section */}
            <div className="flex items-center justify-between pt-3 border-t border-gray-200">
              <div className="text-sm text-gray-600">
                Was this helpful?
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleRate(true)}
                  disabled={rating !== null}
                  className={`flex items-center px-3 py-1 text-sm rounded-md transition-colors ${
                    rating === 'success'
                      ? 'bg-green-100 text-green-800 border border-green-200'
                      : 'text-gray-600 hover:text-green-600 hover:bg-green-50'
                  }`}
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Yes
                </button>
                <button
                  onClick={() => handleRate(false)}
                  disabled={rating !== null}
                  className={`flex items-center px-3 py-1 text-sm rounded-md transition-colors ${
                    rating === 'failure'
                      ? 'bg-red-100 text-red-800 border border-red-200'
                      : 'text-gray-600 hover:text-red-600 hover:bg-red-50'
                  }`}
                >
                  <X className="h-4 w-4 mr-1" />
                  No
                </button>
              </div>
            </div>

            {rating && (
              <div className="text-sm text-gray-600 bg-gray-100 p-2 rounded-md">
                {rating === 'success'
                  ? '✓ Thank you! This helps improve our search results.'
                  : '✗ Thank you for the feedback. We\'ll work to improve this result.'
                }
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

SearchResultCard.displayName = 'SearchResultCard';

export default SearchResultCard;