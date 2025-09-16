import React from 'react';
import { Button } from './common/Button';

export interface QuickActionsProps {
  onAddEntry: () => void;
  onShowMetrics: () => void;
  onExport?: () => void;
  onImport?: () => void;
  onSettings?: () => void;
  disabled?: boolean;
  className?: string;
}

/**
 * QuickActions Component
 * 
 * Provides quick access to common application actions.
 * Features:
 * - Add new knowledge entry
 * - View metrics dashboard
 * - Import/Export functionality
 * - Settings access
 * - Keyboard shortcuts support
 * - Responsive layout
 */
export const QuickActions: React.FC<QuickActionsProps> = ({
  onAddEntry,
  onShowMetrics,
  onExport,
  onImport,
  onSettings,
  disabled = false,
  className = ''
}) => {
  return (
    <div className={`quick-actions ${className}`} role="toolbar" aria-label="Quick actions">
      <div className="quick-actions__primary">
        <Button
          onClick={onAddEntry}
          variant="primary"
          size="md"
          disabled={disabled}
          title="Add new knowledge entry (Ctrl+N)"
          icon="➕"
        >
          Add Entry
        </Button>
        
        <Button
          onClick={onShowMetrics}
          variant="secondary"
          size="md"
          disabled={disabled}
          title="View analytics and metrics (Ctrl+M)"
          icon="📊"
        >
          Metrics
        </Button>
      </div>

      <div className="quick-actions__secondary">
        {onExport && (
          <Button
            onClick={onExport}
            variant="outline"
            size="sm"
            disabled={disabled}
            title="Export knowledge base"
            icon="📤"
          >
            Export
          </Button>
        )}
        
        {onImport && (
          <Button
            onClick={onImport}
            variant="outline"
            size="sm"
            disabled={disabled}
            title="Import knowledge base entries"
            icon="📥"
          >
            Import
          </Button>
        )}
        
        {onSettings && (
          <Button
            onClick={onSettings}
            variant="ghost"
            size="sm"
            disabled={disabled}
            title="Application settings"
            icon="⚙️"
          >
            Settings
          </Button>
        )}
      </div>
    </div>
  );
};

export default QuickActions;