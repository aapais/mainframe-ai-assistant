/**
 * Quick Actions Panel Component
 * Context-aware action buttons for efficient workflow operations
 */

import React, { useState, useCallback, memo } from 'react';

interface KBEntry {
  id: string;
  title: string;
  problem: string;
  solution: string;
  category: string;
  tags?: string[];
  usage_count?: number;
  success_count?: number;
  failure_count?: number;
  created_at?: string;
  score?: number;
}

interface QuickAction {
  id: string;
  label: string;
  icon: string;
  description: string;
  shortcut?: string;
  variant: 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
  action: (entry: KBEntry) => Promise<void> | void;
}

interface QuickActionsPanelProps {
  entry: KBEntry;
  onActionComplete?: (actionId: string, success: boolean) => void;
  showLabels?: boolean;
  orientation?: 'horizontal' | 'vertical';
  size?: 'small' | 'medium' | 'large';
  userPermissions?: {
    canEdit: boolean;
    canDelete: boolean;
    canBookmark: boolean;
    canShare: boolean;
  };
}

export const QuickActionsPanel = memo<QuickActionsPanelProps>(({
  entry,
  onActionComplete,
  showLabels = true,
  orientation = 'horizontal',
  size = 'medium',
  userPermissions = {
    canEdit: true,
    canDelete: true,
    canBookmark: true,
    canShare: true
  }
}) => {
  const [loadingActions, setLoadingActions] = useState<Set<string>>(new Set());
  const [successActions, setSuccessActions] = useState<Set<string>>(new Set());
  const [notifications, setNotifications] = useState<Array<{ id: string; message: string; type: 'success' | 'error' }>>([]);

  const showNotification = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now().toString();
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 3000);
  }, []);

  const executeAction = useCallback(async (action: QuickAction) => {
    setLoadingActions(prev => new Set(prev).add(action.id));

    try {
      await action.action(entry);
      setSuccessActions(prev => new Set(prev).add(action.id));
      showNotification(`${action.label} completed successfully`);
      onActionComplete?.(action.id, true);

      // Clear success state after animation
      setTimeout(() => {
        setSuccessActions(prev => {
          const newSet = new Set(prev);
          newSet.delete(action.id);
          return newSet;
        });
      }, 2000);
    } catch (error) {
      console.error(`Failed to execute ${action.label}:`, error);
      showNotification(`Failed to ${action.label.toLowerCase()}`, 'error');
      onActionComplete?.(action.id, false);
    } finally {
      setLoadingActions(prev => {
        const newSet = new Set(prev);
        newSet.delete(action.id);
        return newSet;
      });
    }
  }, [entry, onActionComplete, showNotification]);

  // Define available quick actions
  const actions: QuickAction[] = [
    {
      id: 'copy',
      label: 'Copy Solution',
      icon: '📋',
      description: 'Copy solution to clipboard',
      shortcut: 'C',
      variant: 'primary',
      action: async (entry) => {
        await navigator.clipboard.writeText(entry.solution);
      }
    },
    {
      id: 'copySummary',
      label: 'Copy Summary',
      icon: '📄',
      description: 'Copy problem and solution summary',
      shortcut: 'Shift+C',
      variant: 'secondary',
      action: async (entry) => {
        const summary = `Problem: ${entry.problem}\n\nSolution: ${entry.solution}\n\nCategory: ${entry.category}`;
        await navigator.clipboard.writeText(summary);
      }
    },
    {
      id: 'markSolved',
      label: 'Mark Solved',
      icon: '✅',
      description: 'Mark this solution as successfully applied',
      shortcut: 'S',
      variant: 'success',
      action: async (entry) => {
        // Simulate API call to mark as solved
        await new Promise(resolve => setTimeout(resolve, 500));
        await window.electronAPI?.kb.rateEntry(entry.id, true);
      }
    },
    {
      id: 'bookmark',
      label: 'Bookmark',
      icon: '🔖',
      description: 'Save to your bookmarks',
      shortcut: 'B',
      variant: 'secondary',
      action: async (entry) => {
        // Simulate bookmark action
        await new Promise(resolve => setTimeout(resolve, 300));
        const bookmarks = JSON.parse(localStorage.getItem('kb-bookmarks') || '[]');
        if (!bookmarks.includes(entry.id)) {
          bookmarks.push(entry.id);
          localStorage.setItem('kb-bookmarks', JSON.stringify(bookmarks));
        }
      }
    },
    {
      id: 'edit',
      label: 'Quick Edit',
      icon: '✏️',
      description: 'Edit this knowledge entry',
      shortcut: 'E',
      variant: 'secondary',
      action: (entry) => {
        // Emit edit event
        window.dispatchEvent(new CustomEvent('kb-edit-entry', { detail: entry }));
      }
    },
    {
      id: 'share',
      label: 'Share',
      icon: '🔗',
      description: 'Generate shareable link',
      shortcut: 'Shift+S',
      variant: 'secondary',
      action: async (entry) => {
        const shareUrl = `${window.location.origin}/kb/${entry.id}`;
        await navigator.clipboard.writeText(shareUrl);
      }
    },
    {
      id: 'createVariation',
      label: 'Create Variation',
      icon: '🔄',
      description: 'Create a variation of this solution',
      variant: 'secondary',
      action: (entry) => {
        window.dispatchEvent(new CustomEvent('kb-create-variation', { detail: entry }));
      }
    },
    {
      id: 'reportIssue',
      label: 'Report Issue',
      icon: '⚠️',
      description: 'Report a problem with this entry',
      variant: 'warning',
      action: (entry) => {
        window.dispatchEvent(new CustomEvent('kb-report-issue', { detail: entry }));
      }
    },
    {
      id: 'delete',
      label: 'Delete',
      icon: '🗑️',
      description: 'Delete this knowledge entry',
      shortcut: 'Delete',
      variant: 'danger',
      action: async (entry) => {
        if (confirm(`Are you sure you want to delete "${entry.title}"?`)) {
          await new Promise(resolve => setTimeout(resolve, 500));
          await window.electronAPI?.kb.deleteEntry(entry.id);
        } else {
          throw new Error('Deletion cancelled');
        }
      }
    }
  ];

  // Filter actions based on permissions
  const availableActions = actions.filter(action => {
    switch (action.id) {
      case 'edit':
        return userPermissions.canEdit;
      case 'delete':
        return userPermissions.canDelete;
      case 'bookmark':
        return userPermissions.canBookmark;
      case 'share':
        return userPermissions.canShare;
      default:
        return true;
    }
  });

  // Style configurations
  const sizes = {
    small: { padding: '6px 10px', fontSize: '0.75rem', iconSize: '14px' },
    medium: { padding: '8px 12px', fontSize: '0.875rem', iconSize: '16px' },
    large: { padding: '10px 16px', fontSize: '1rem', iconSize: '18px' }
  };

  const variants = {
    primary: { bg: '#3b82f6', hoverBg: '#2563eb', color: '#ffffff' },
    secondary: { bg: '#f3f4f6', hoverBg: '#e5e7eb', color: '#374151' },
    success: { bg: '#10b981', hoverBg: '#059669', color: '#ffffff' },
    warning: { bg: '#f59e0b', hoverBg: '#d97706', color: '#ffffff' },
    danger: { bg: '#ef4444', hoverBg: '#dc2626', color: '#ffffff' }
  };

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: orientation === 'vertical' ? 'column' : 'row',
    gap: orientation === 'vertical' ? '8px' : '6px',
    alignItems: orientation === 'vertical' ? 'stretch' : 'center',
    flexWrap: orientation === 'horizontal' ? 'wrap' : 'nowrap',
    position: 'relative'
  };

  const getButtonStyle = (action: QuickAction): React.CSSProperties => {
    const sizeConfig = sizes[size];
    const variantConfig = variants[action.variant];
    const isLoading = loadingActions.has(action.id);
    const isSuccess = successActions.has(action.id);

    return {
      display: 'flex',
      alignItems: 'center',
      gap: showLabels ? '6px' : '0',
      padding: sizeConfig.padding,
      fontSize: sizeConfig.fontSize,
      backgroundColor: isSuccess ? '#10b981' : variantConfig.bg,
      color: variantConfig.color,
      border: action.variant === 'secondary' ? '1px solid #d1d5db' : 'none',
      borderRadius: '6px',
      cursor: isLoading ? 'not-allowed' : 'pointer',
      transition: 'all 0.15s ease',
      opacity: isLoading ? 0.7 : 1,
      transform: isSuccess ? 'scale(1.05)' : 'scale(1)',
      minWidth: showLabels ? 'auto' : sizeConfig.iconSize,
      justifyContent: showLabels ? 'flex-start' : 'center'
    };
  };

  const notificationStyle: React.CSSProperties = {
    position: 'fixed',
    top: '20px',
    right: '20px',
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  };

  const notificationItemStyle = (type: 'success' | 'error'): React.CSSProperties => ({
    padding: '12px 16px',
    backgroundColor: type === 'success' ? '#10b981' : '#ef4444',
    color: '#ffffff',
    borderRadius: '8px',
    fontSize: '0.875rem',
    fontWeight: '500',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    animation: 'slideIn 0.3s ease'
  });

  return (
    <>
      <div style={containerStyle}>
        {availableActions.map(action => {
          const isLoading = loadingActions.has(action.id);
          const isSuccess = successActions.has(action.id);

          return (
            <button
              key={action.id}
              style={getButtonStyle(action)}
              onClick={() => executeAction(action)}
              onMouseEnter={(e) => {
                if (!isLoading) {
                  const variantConfig = variants[action.variant];
                  e.currentTarget.style.backgroundColor = isSuccess ? '#059669' : variantConfig.hoverBg;
                  if (!showLabels) {
                    e.currentTarget.style.transform = 'scale(1.1)';
                  }
                }
              }}
              onMouseLeave={(e) => {
                if (!isLoading) {
                  const variantConfig = variants[action.variant];
                  e.currentTarget.style.backgroundColor = isSuccess ? '#10b981' : variantConfig.bg;
                  e.currentTarget.style.transform = isSuccess ? 'scale(1.05)' : 'scale(1)';
                }
              }}
              disabled={isLoading}
              title={`${action.description}${action.shortcut ? ` (${action.shortcut})` : ''}`}
              aria-label={action.description}
            >
              {isLoading ? (
                <div style={{
                  width: sizes[size].iconSize,
                  height: sizes[size].iconSize,
                  border: '2px solid transparent',
                  borderTop: '2px solid currentColor',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }} />
              ) : isSuccess ? (
                <span style={{ fontSize: sizes[size].iconSize }}>✓</span>
              ) : (
                <span style={{ fontSize: sizes[size].iconSize }}>
                  {action.icon}
                </span>
              )}
              {showLabels && (
                <span style={{ whiteSpace: 'nowrap' }}>
                  {isSuccess ? 'Done!' : action.label}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Notifications */}
      {notifications.length > 0 && (
        <div style={notificationStyle}>
          {notifications.map(notification => (
            <div
              key={notification.id}
              style={notificationItemStyle(notification.type)}
            >
              {notification.message}
            </div>
          ))}
        </div>
      )}

      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }

          @keyframes slideIn {
            0% { transform: translateX(100%); opacity: 0; }
            100% { transform: translateX(0); opacity: 1; }
          }
        `}
      </style>
    </>
  );
});

QuickActionsPanel.displayName = 'QuickActionsPanel';