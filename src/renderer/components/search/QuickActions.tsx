/**
 * QuickActions Component
 * Provides quick action buttons for search results with context-aware functionality
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Edit,
  Trash2,
  Copy,
  History,
  MoreVertical,
  Archive,
  Star,
  StarOff,
  Share,
  Download,
  ExternalLink,
  Clock,
  BarChart3,
  FileText,
  ChevronDown
} from 'lucide-react';
import { KBEntry } from '../../../types/services';

interface QuickActionsProps {
  entry: KBEntry;
  onEdit?: (entry: KBEntry) => void;
  onDelete?: (entry: KBEntry) => void;
  onDuplicate?: (entry: KBEntry) => void;
  onArchive?: (entry: KBEntry) => void;
  onViewHistory?: (entry: KBEntry) => void;
  onFavorite?: (entry: KBEntry) => void;
  onShare?: (entry: KBEntry) => void;
  onExport?: (entry: KBEntry) => void;
  onViewAnalytics?: (entry: KBEntry) => void;
  showInlineEdit?: boolean;
  compact?: boolean;
  disabled?: boolean;
  className?: string;
}

interface ActionButton {
  key: string;
  label: string;
  icon: React.ComponentType<any>;
  onClick: () => void;
  className?: string;
  destructive?: boolean;
  primary?: boolean;
  disabled?: boolean;
  requiresConfirm?: boolean;
  confirmMessage?: string;
  tooltip?: string;
}

export const QuickActions: React.FC<QuickActionsProps> = ({
  entry,
  onEdit,
  onDelete,
  onDuplicate,
  onArchive,
  onViewHistory,
  onFavorite,
  onShare,
  onExport,
  onViewAnalytics,
  showInlineEdit = false,
  compact = false,
  disabled = false,
  className = ''
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [confirmAction, setConfirmAction] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
        setConfirmAction(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle action with optional confirmation
  const handleAction = useCallback((actionKey: string, action: () => void, requiresConfirm = false, confirmMessage = '') => {
    if (requiresConfirm && confirmAction !== actionKey) {
      setConfirmAction(actionKey);
      return;
    }

    action();
    setShowDropdown(false);
    setConfirmAction(null);
  }, [confirmAction]);

  // Define primary actions (always visible)
  const primaryActions: ActionButton[] = [
    {
      key: 'edit',
      label: showInlineEdit ? 'Quick Edit' : 'Edit',
      icon: Edit,
      onClick: () => onEdit?.(entry),
      primary: true,
      disabled: !onEdit,
      tooltip: showInlineEdit ? 'Edit inline in search results' : 'Open in edit modal'
    },
    {
      key: 'duplicate',
      label: 'Duplicate',
      icon: Copy,
      onClick: () => onDuplicate?.(entry),
      disabled: !onDuplicate,
      tooltip: 'Create a copy of this entry'
    }
  ];

  // Define secondary actions (shown in dropdown)
  const secondaryActions: ActionButton[] = [
    {
      key: 'history',
      label: 'View History',
      icon: History,
      onClick: () => onViewHistory?.(entry),
      disabled: !onViewHistory,
      tooltip: 'View edit history and changes'
    },
    {
      key: 'analytics',
      label: 'View Analytics',
      icon: BarChart3,
      onClick: () => onViewAnalytics?.(entry),
      disabled: !onViewAnalytics,
      tooltip: 'View usage statistics and metrics'
    },
    {
      key: 'favorite',
      label: entry.archived ? 'Unstar' : 'Star',
      icon: entry.archived ? StarOff : Star,
      onClick: () => onFavorite?.(entry),
      disabled: !onFavorite,
      tooltip: entry.archived ? 'Remove from favorites' : 'Add to favorites'
    },
    {
      key: 'share',
      label: 'Share',
      icon: Share,
      onClick: () => onShare?.(entry),
      disabled: !onShare,
      tooltip: 'Share this entry with others'
    },
    {
      key: 'export',
      label: 'Export',
      icon: Download,
      onClick: () => onExport?.(entry),
      disabled: !onExport,
      tooltip: 'Export entry as PDF or text'
    },
    {
      key: 'archive',
      label: entry.archived ? 'Unarchive' : 'Archive',
      icon: Archive,
      onClick: () => onArchive?.(entry),
      disabled: !onArchive,
      requiresConfirm: !entry.archived,
      confirmMessage: 'Archive this entry? It will be moved to the archive.',
      tooltip: entry.archived ? 'Restore from archive' : 'Move to archive'
    },
    {
      key: 'delete',
      label: 'Delete',
      icon: Trash2,
      onClick: () => onDelete?.(entry),
      destructive: true,
      disabled: !onDelete,
      requiresConfirm: true,
      confirmMessage: 'Permanently delete this entry? This cannot be undone.',
      tooltip: 'Permanently delete this entry',
      className: 'text-red-700 hover:bg-red-50'
    }
  ];

  // Filter out disabled actions
  const availablePrimaryActions = primaryActions.filter(action => !action.disabled);
  const availableSecondaryActions = secondaryActions.filter(action => !action.disabled);

  if (compact) {
    // Compact mode - show only dropdown
    return (
      <div className={`relative ${className}`} ref={dropdownRef}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowDropdown(!showDropdown);
          }}
          disabled={disabled}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="More actions"
          title="More actions"
        >
          <MoreVertical className="h-4 w-4" />
        </button>

        {showDropdown && (
          <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-50">
            <div className="py-1">
              {[...availablePrimaryActions, ...availableSecondaryActions].map((action) => (
                <ActionMenuItem
                  key={action.key}
                  action={action}
                  onSelect={(actionKey, actionFn, requiresConfirm, confirmMessage) =>
                    handleAction(actionKey, actionFn, requiresConfirm, confirmMessage)
                  }
                  showConfirm={confirmAction === action.key}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Full mode - show primary actions + dropdown for secondary
  return (
    <div className={`flex items-center space-x-1 ${className}`}>
      {/* Primary Actions */}
      {availablePrimaryActions.map((action) => (
        <button
          key={action.key}
          onClick={(e) => {
            e.stopPropagation();
            handleAction(action.key, action.onClick, action.requiresConfirm, action.confirmMessage);
          }}
          disabled={disabled || action.disabled}
          className={`
            p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors
            disabled:opacity-50 disabled:cursor-not-allowed
            ${action.primary ? 'text-blue-600 hover:text-blue-800 hover:bg-blue-50' : ''}
            ${action.className || ''}
          `}
          aria-label={action.label}
          title={action.tooltip || action.label}
        >
          <action.icon className="h-4 w-4" />
        </button>
      ))}

      {/* Secondary Actions Dropdown */}
      {availableSecondaryActions.length > 0 && (
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowDropdown(!showDropdown);
            }}
            disabled={disabled}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="More actions"
            title="More actions"
          >
            <MoreVertical className="h-4 w-4" />
          </button>

          {showDropdown && (
            <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-50">
              <div className="py-1">
                {availableSecondaryActions.map((action) => (
                  <ActionMenuItem
                    key={action.key}
                    action={action}
                    onSelect={(actionKey, actionFn, requiresConfirm, confirmMessage) =>
                      handleAction(actionKey, actionFn, requiresConfirm, confirmMessage)
                    }
                    showConfirm={confirmAction === action.key}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Action Menu Item Component
 */
const ActionMenuItem: React.FC<{
  action: ActionButton;
  onSelect: (key: string, action: () => void, requiresConfirm?: boolean, confirmMessage?: string) => void;
  showConfirm: boolean;
}> = ({ action, onSelect, showConfirm }) => {
  if (showConfirm && action.requiresConfirm) {
    return (
      <div className="px-3 py-2 bg-yellow-50 border-l-4 border-yellow-400">
        <p className="text-sm text-yellow-800 mb-2">{action.confirmMessage}</p>
        <div className="flex space-x-2">
          <button
            onClick={() => onSelect(action.key, action.onClick)}
            className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
          >
            Confirm
          </button>
          <button
            onClick={() => onSelect('cancel', () => {})}
            className="px-2 py-1 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => onSelect(action.key, action.onClick, action.requiresConfirm, action.confirmMessage)}
      className={`
        flex items-center w-full px-3 py-2 text-sm text-left hover:bg-gray-50 transition-colors
        ${action.destructive ? 'text-red-700 hover:bg-red-50' : 'text-gray-700'}
        ${action.className || ''}
      `}
      disabled={action.disabled}
    >
      <action.icon className="h-4 w-4 mr-3 flex-shrink-0" />
      <span className="truncate">{action.label}</span>
    </button>
  );
};

export default QuickActions;