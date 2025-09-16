/**
 * Form Integration Example
 *
 * Complete example demonstrating how to integrate the enhanced form components
 * with all features enabled:
 * - Rich text editor integration
 * - Auto-save functionality
 * - Draft management
 * - Keyboard shortcuts
 * - Accessibility compliance
 * - Optimistic UI updates
 * - Conflict resolution
 *
 * @author Swarm Coordinator
 * @version 1.0.0
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { KnowledgeDB, KBEntry } from '../../database/KnowledgeDB';
import { EnhancedSmartEntryForm, EnhancedSmartEntryFormRef } from './EnhancedSmartEntryForm';
import { useDraftManager } from '../../hooks/useDraftManager';
import { useFormValidation } from '../../hooks/useFormValidation';
import './FormIntegrationExample.css';

// ========================
// Types & Interfaces
// ========================

interface FormIntegrationExampleProps {
  db: KnowledgeDB;
  entryId?: string; // For editing existing entries
  onSuccess?: (entry: KBEntry) => void;
  onCancel?: () => void;
  className?: string;
}

interface NotificationState {
  show: boolean;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message: string;
  autoHide?: boolean;
}

// ========================
// Main Example Component
// ========================

export const FormIntegrationExample: React.FC<FormIntegrationExampleProps> = ({
  db,
  entryId,
  onSuccess,
  onCancel,
  className = ''
}) => {
  // Refs
  const formRef = useRef<EnhancedSmartEntryFormRef>(null);

  // State management
  const [entry, setEntry] = useState<KBEntry | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(Boolean(entryId));
  const [notification, setNotification] = useState<NotificationState>({
    show: false,
    type: 'info',
    title: '',
    message: ''
  });

  // Load existing entry if editing
  useEffect(() => {
    if (entryId && db) {
      loadEntry(entryId);
    }
  }, [entryId, db]);

  // Load entry function
  const loadEntry = async (id: string) => {
    setIsLoading(true);
    try {
      const loadedEntry = await db.getEntry(id);
      setEntry(loadedEntry);
      showNotification({
        type: 'info',
        title: 'Entry Loaded',
        message: 'Successfully loaded entry for editing',
        autoHide: true
      });
    } catch (error) {
      console.error('Failed to load entry:', error);
      showNotification({
        type: 'error',
        title: 'Load Failed',
        message: 'Failed to load entry. Please try again.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Show notification
  const showNotification = useCallback((notification: Omit<NotificationState, 'show'>) => {
    setNotification({
      ...notification,
      show: true
    });

    if (notification.autoHide) {
      setTimeout(() => {
        setNotification(prev => ({ ...prev, show: false }));
      }, 3000);
    }
  }, []);

  // Hide notification
  const hideNotification = useCallback(() => {
    setNotification(prev => ({ ...prev, show: false }));
  }, []);

  // Handle form submission
  const handleSubmit = useCallback(async (entryData: Omit<KBEntry, 'id'>) => {
    setIsLoading(true);

    try {
      let savedEntry: KBEntry;

      if (entry?.id) {
        // Update existing entry
        savedEntry = await db.updateEntry(entry.id, entryData);
        showNotification({
          type: 'success',
          title: 'Entry Updated',
          message: 'Knowledge base entry has been successfully updated',
          autoHide: true
        });
      } else {
        // Create new entry
        savedEntry = await db.addEntry(entryData);
        showNotification({
          type: 'success',
          title: 'Entry Created',
          message: 'New knowledge base entry has been successfully created',
          autoHide: true
        });
      }

      // Call success callback
      onSuccess?.(savedEntry);

    } catch (error) {
      console.error('Form submission failed:', error);
      showNotification({
        type: 'error',
        title: 'Save Failed',
        message: 'Failed to save entry. Please check your input and try again.'
      });
    } finally {
      setIsLoading(false);
    }
  }, [entry, db, onSuccess]);

  // Handle auto-save
  const handleAutoSave = useCallback(async (entryData: Partial<KBEntry>) => {
    try {
      // In a real implementation, you might save to a different location
      // or use a different API endpoint for drafts
      console.log('Auto-saving:', entryData);

      // For demo purposes, just log the auto-save
      showNotification({
        type: 'info',
        title: 'Auto-saved',
        message: 'Draft saved automatically',
        autoHide: true
      });

    } catch (error) {
      console.error('Auto-save failed:', error);
    }
  }, []);

  // Handle duplicate detection
  const handleDuplicatesFound = useCallback((duplicates: any[]) => {
    if (duplicates.length > 0) {
      showNotification({
        type: 'warning',
        title: 'Possible Duplicates',
        message: `Found ${duplicates.length} similar entries. Please review before saving.`,
      });
    }
  }, []);

  // Handle template selection
  const handleTemplateSelect = useCallback((template: any) => {
    showNotification({
      type: 'info',
      title: 'Template Applied',
      message: `Applied ${template.name} template`,
      autoHide: true
    });
  }, []);

  // Handle conflict resolution
  const handleConflict = useCallback((localVersion: any, remoteVersion: any) => {
    showNotification({
      type: 'warning',
      title: 'Edit Conflict Detected',
      message: 'Another user has modified this entry. Please resolve the conflict.',
    });
  }, []);

  // Handle validation changes
  const handleValidationChange = useCallback((isValid: boolean, errors: Record<string, string>) => {
    if (!isValid && Object.keys(errors).length > 0) {
      const errorCount = Object.keys(errors).length;
      showNotification({
        type: 'warning',
        title: 'Validation Errors',
        message: `Please fix ${errorCount} validation error${errorCount > 1 ? 's' : ''} before saving.`,
        autoHide: true
      });
    }
  }, []);

  // Handle field changes (for analytics/monitoring)
  const handleFieldChange = useCallback((field: string, value: any) => {
    // This could be used for analytics, user behavior tracking, etc.
    console.log(`Field changed: ${field} = ${value}`);
  }, []);

  // Keyboard shortcuts handler
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Global keyboard shortcuts that work outside the form
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case 'h':
          e.preventDefault();
          showNotification({
            type: 'info',
            title: 'Help',
            message: 'Use Ctrl+/ to see all keyboard shortcuts',
            autoHide: true
          });
          break;
      }
    }
  }, []);

  // Configuration for the enhanced form
  const formConfig = {
    enableTemplates: true,
    enableAutoComplete: true,
    enableDuplicateDetection: true,
    enableRichTextEditor: true,
    enableAISuggestions: true,
    enableAutoSave: true,
    enableDraftManager: true,
    enableKeyboardShortcuts: true,
    enableOptimisticUpdates: true,
    duplicateThreshold: 0.7,
    suggestionDelay: 300,
    autoSaveInterval: 30000, // 30 seconds
  };

  if (isLoading) {
    return (
      <div className="form-integration-loading">
        <div className="loading-spinner">
          <span className="spinner" />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`form-integration-example ${className}`}
      onKeyDown={handleKeyDown}
    >
      {/* Notification Bar */}
      {notification.show && (
        <div className={`notification notification-${notification.type}`} role="alert">
          <div className="notification-content">
            <div className="notification-header">
              <strong>{notification.title}</strong>
              <button
                onClick={hideNotification}
                className="notification-close"
                aria-label="Close notification"
              >
                ✕
              </button>
            </div>
            <div className="notification-message">
              {notification.message}
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Form */}
      <EnhancedSmartEntryForm
        ref={formRef}
        db={db}
        entry={entry}
        config={formConfig}
        onSubmit={handleSubmit}
        onCancel={onCancel}
        onDuplicatesFound={handleDuplicatesFound}
        onTemplateSelect={handleTemplateSelect}
        onFieldChange={handleFieldChange}
        onValidationChange={handleValidationChange}
        onAutoSave={handleAutoSave}
        onConflict={handleConflict}
        enableRealTimeCollaboration={true} // Enable for demonstration
        className="main-form"
        ariaLabel={entry ? 'Edit knowledge base entry' : 'Create new knowledge base entry'}
      />

      {/* Action Bar */}
      <div className="action-bar">
        <div className="action-bar-info">
          <span className="entry-status">
            {entry ? `Editing: ${entry.title}` : 'Creating new entry'}
          </span>
        </div>

        <div className="action-bar-controls">
          <button
            type="button"
            onClick={() => formRef.current?.saveDraft()}
            className="action-button secondary"
            title="Save as draft (Ctrl+S)"
          >
            💾 Save Draft
          </button>

          <button
            type="button"
            onClick={() => {
              const isValid = formRef.current?.validate();
              if (isValid) {
                formRef.current?.submit();
              } else {
                showNotification({
                  type: 'warning',
                  title: 'Validation Required',
                  message: 'Please fix validation errors before saving',
                  autoHide: true
                });
              }
            }}
            className="action-button primary"
            title="Submit entry (Ctrl+Shift+S)"
          >
            {entry ? '✓ Update Entry' : '✓ Create Entry'}
          </button>
        </div>
      </div>

      {/* Debug Panel (Development only) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="debug-panel">
          <details>
            <summary>🔧 Debug Information</summary>
            <div className="debug-content">
              <h4>Form State:</h4>
              <ul>
                <li>Mode: {entry ? 'Edit' : 'Create'}</li>
                <li>Entry ID: {entry?.id || 'N/A'}</li>
                <li>Loading: {isLoading ? 'Yes' : 'No'}</li>
                <li>Notification: {notification.show ? notification.type : 'None'}</li>
              </ul>

              <h4>Configuration:</h4>
              <pre>{JSON.stringify(formConfig, null, 2)}</pre>

              <h4>Actions:</h4>
              <button
                onClick={() => formRef.current?.reset()}
                className="debug-button"
              >
                Reset Form
              </button>
              <button
                onClick={() => {
                  const draft = formRef.current?.exportDraft();
                  console.log('Exported draft:', draft);
                }}
                className="debug-button"
              >
                Export Draft
              </button>
              <button
                onClick={() => formRef.current?.loadDraft('test-draft')}
                className="debug-button"
              >
                Load Test Draft
              </button>
            </div>
          </details>
        </div>
      )}
    </div>
  );
};

// ========================
// Helper Components
// ========================

interface NotificationProps {
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message: string;
  onClose: () => void;
}

const Notification: React.FC<NotificationProps> = ({ type, title, message, onClose }) => (
  <div className={`notification notification-${type}`} role="alert">
    <div className="notification-content">
      <div className="notification-header">
        <strong>{title}</strong>
        <button onClick={onClose} className="notification-close" aria-label="Close notification">
          ✕
        </button>
      </div>
      <div className="notification-message">{message}</div>
    </div>
  </div>
);

export default FormIntegrationExample;