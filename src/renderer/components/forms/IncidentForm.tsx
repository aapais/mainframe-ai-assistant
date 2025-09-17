import React, { useState, useEffect, useCallback, memo } from 'react';
import { Button } from '../common/Button';
import { TextField, TextAreaField, SelectField } from '../common/FormField';
import { useForm } from '../../hooks/useForm';
import { createIncidentValidationSchema, ErrorMessages } from '../../utils/validation';
import { Incident } from '../../types';
import './IncidentForm.css';

interface IncidentFormData {
  title: string;
  description: string;
  impact: string;
  category: 'System Outage' | 'Performance' | 'Database' | 'Application' | 'Security' | 'Network' | 'Hardware' | 'Other';
  priority: 'P1' | 'P2' | 'P3' | 'P4';
  status: 'Open' | 'In Progress' | 'Pending' | 'Resolved' | 'Closed';
  assignee?: string;
  tags: string[];
}

interface IncidentFormProps {
  initialData?: Partial<IncidentFormData>;
  onSubmit: (data: IncidentFormData) => Promise<void>;
  onCancel: () => void;
  onError?: (error: Error) => void;
  mode?: 'create' | 'edit';
  autoSave?: boolean;
  enableDrafts?: boolean;
  showAdvancedOptions?: boolean;
}

const CATEGORY_OPTIONS = [
  { value: 'System Outage', label: 'System Outage - Complete system failure' },
  { value: 'Performance', label: 'Performance Issue - Degraded performance' },
  { value: 'Database', label: 'Database Issue - DB2, IMS, VSAM problems' },
  { value: 'Application', label: 'Application Error - COBOL, CICS, batch failures' },
  { value: 'Security', label: 'Security Incident - RACF, access control' },
  { value: 'Network', label: 'Network Issue - Connectivity problems' },
  { value: 'Hardware', label: 'Hardware Failure - Physical system issues' },
  { value: 'Other', label: 'Other/Miscellaneous' }
];

const PRIORITY_OPTIONS = [
  { value: 'P1', label: 'P1 - Critical (Immediate action required)' },
  { value: 'P2', label: 'P2 - High (Urgent attention needed)' },
  { value: 'P3', label: 'P3 - Medium (Normal timeline)' },
  { value: 'P4', label: 'P4 - Low (When convenient)' }
];

const STATUS_OPTIONS = [
  { value: 'Open', label: 'Open - Newly reported' },
  { value: 'In Progress', label: 'In Progress - Being worked on' },
  { value: 'Pending', label: 'Pending - Waiting for input' },
  { value: 'Resolved', label: 'Resolved - Issue fixed' },
  { value: 'Closed', label: 'Closed - Complete and verified' }
];

const IMPACT_LEVELS = [
  { value: 'Critical', label: 'Critical - Business critical systems affected' },
  { value: 'High', label: 'High - Important business functions impacted' },
  { value: 'Medium', label: 'Medium - Some business functions affected' },
  { value: 'Low', label: 'Low - Minor impact on operations' }
];

/**
 * Enhanced Incident Report Form
 *
 * Features:
 * - Priority and status management
 * - Impact assessment
 * - Advanced validation with real-time feedback
 * - Auto-save and draft functionality
 * - Accessibility support (ARIA labels, keyboard navigation)
 * - Enhanced UX (character counts, hints, tooltips)
 * - Error handling with user-friendly messages
 * - Tag management with validation
 * - Keyboard shortcuts
 */
export const IncidentForm = memo<IncidentFormProps>(({
  initialData,
  onSubmit,
  onCancel,
  onError,
  mode = 'create',
  autoSave = false,
  enableDrafts = true,
  showAdvancedOptions = false
}) => {
  // Tag input state
  const [tagInput, setTagInput] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(showAdvancedOptions);

  // Form management with advanced features
  const form = useForm<IncidentFormData>({
    initialValues: {
      title: initialData?.title || '',
      description: initialData?.description || '',
      impact: initialData?.impact || '',
      category: initialData?.category || 'Other',
      priority: initialData?.priority || 'P3',
      status: initialData?.status || 'Open',
      assignee: initialData?.assignee || '',
      tags: initialData?.tags || []
    },
    validationSchema: createIncidentValidationSchema(mode),
    onSubmit: handleFormSubmit,
    onError: onError,
    validateOnChange: true,
    validateOnBlur: true,
    autoSave: autoSave,
    autoSaveDelay: 2000,
    enableDrafts: enableDrafts,
    draftKey: `incident-${mode}-${initialData?.id || 'new'}`
  });

  async function handleFormSubmit(data: IncidentFormData): Promise<void> {
    try {
      await onSubmit(data);
    } catch (error) {
      console.error('Incident form submission error:', error);
      throw error;
    }
  }

  // Handle draft loading notification
  useEffect(() => {
    if (form.hasDraft && enableDrafts) {
      const shouldLoadDraft = window.confirm(
        'A draft was found for this incident. Would you like to load it?'
      );

      if (shouldLoadDraft) {
        form.loadDraft();
      } else {
        form.clearDraft();
      }
    }
  }, [form.hasDraft, enableDrafts]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey) {
        switch (e.key) {
          case 's':
            e.preventDefault();
            if (form.isValid && !form.isSubmitting) {
              form.handleSubmit();
            }
            break;
          case 'Enter':
            e.preventDefault();
            if (form.isValid && !form.isSubmitting) {
              form.handleSubmit();
            }
            break;
          case 'd':
            e.preventDefault();
            if (enableDrafts) {
              form.saveDraft();
            }
            break;
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [form.isValid, form.isSubmitting, form.handleSubmit, form.saveDraft, onCancel, enableDrafts]);

  // Tag management functions
  const handleAddTag = useCallback(() => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !form.values.tags.includes(tag)) {
      const newTags = [...form.values.tags, tag];
      form.setFieldValue('tags', newTags);
      setTagInput('');
    }
  }, [tagInput, form.values.tags, form.setFieldValue]);

  const handleRemoveTag = useCallback((tagToRemove: string) => {
    const newTags = form.values.tags.filter(tag => tag !== tagToRemove);
    form.setFieldValue('tags', newTags);
  }, [form.values.tags, form.setFieldValue]);

  const handleTagKeyPress = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  }, [handleAddTag]);

  // Handle form reset with confirmation
  const handleReset = useCallback(() => {
    if (form.isDirty) {
      const shouldReset = window.confirm(
        'Are you sure you want to reset the form? All unsaved changes will be lost.'
      );
      if (shouldReset) {
        form.resetForm();
        setTagInput('');
      }
    } else {
      form.resetForm();
      setTagInput('');
    }
  }, [form.isDirty, form.resetForm]);

  // Auto-set priority based on category
  useEffect(() => {
    if (form.values.category === 'System Outage' && form.values.priority !== 'P1') {
      form.setFieldValue('priority', 'P1');
    } else if (form.values.category === 'Security' && !['P1', 'P2'].includes(form.values.priority)) {
      form.setFieldValue('priority', 'P2');
    }
  }, [form.values.category, form.values.priority, form.setFieldValue]);

  return (
    <form
      className="incident-form"
      onSubmit={form.handleSubmit}
      noValidate
      role="form"
      aria-label={mode === 'create' ? 'Report new incident' : 'Edit incident'}
    >
      <div className="incident-form__header">
        <div className="incident-form__title">
          <h2>🚨 {mode === 'create' ? 'Report New Incident' : 'Edit Incident'}</h2>
          {form.isDirty && (
            <span className="incident-form__unsaved-indicator" title="Unsaved changes">
              ●
            </span>
          )}
          {form.isAutoSaving && (
            <span className="incident-form__auto-save-indicator">
              Saving...
            </span>
          )}
        </div>

        {enableDrafts && (
          <div className="incident-form__draft-actions">
            <Button
              type="button"
              variant="ghost"
              size="small"
              onClick={form.saveDraft}
              disabled={!form.isDirty}
              title="Save draft (Ctrl+D)"
            >
              Save Draft
            </Button>
            {form.hasDraft && (
              <Button
                type="button"
                variant="ghost"
                size="small"
                onClick={() => form.loadDraft()}
                title="Load saved draft"
              >
                Load Draft
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="incident-form__fields">
        {/* Title Field */}
        <TextField
          {...form.getFieldProps('title')}
          label="Incident Title"
          placeholder="Brief, descriptive title (e.g., 'Production DB2 Database Unavailable - SQLCODE -904')"
          required
          maxLength={200}
          showCharacterCount
          error={form.getFieldError('title')}
          hint="Include system names, error codes, or key symptoms for quick identification"
          helpText="The title should be specific enough that responders can quickly understand the nature and scope of the incident."
          autoFocus={mode === 'create'}
        />

        {/* Priority and Category Row */}
        <div className="incident-form__row">
          <SelectField
            {...form.getFieldProps('priority')}
            label="Priority"
            options={PRIORITY_OPTIONS}
            required
            error={form.getFieldError('priority')}
            hint="Select based on business impact and urgency"
            className="incident-form__priority-field"
          />

          <SelectField
            {...form.getFieldProps('category')}
            label="Category"
            options={CATEGORY_OPTIONS}
            required
            error={form.getFieldError('category')}
            hint="Select the primary system or component involved"
            className="incident-form__category-field"
          />
        </div>

        {/* Status and Assignee Row */}
        <div className="incident-form__row">
          <SelectField
            {...form.getFieldProps('status')}
            label="Status"
            options={STATUS_OPTIONS}
            error={form.getFieldError('status')}
            hint="Current state of the incident"
            className="incident-form__status-field"
          />

          <TextField
            {...form.getFieldProps('assignee')}
            label="Assign To"
            placeholder="Username or team (optional)"
            error={form.getFieldError('assignee')}
            hint="Leave blank for auto-assignment"
            helpText="Incident will be automatically assigned based on category and priority if left blank"
            className="incident-form__assignee-field"
          />
        </div>

        {/* Incident Description Field */}
        <TextAreaField
          {...form.getFieldProps('description')}
          label="Incident Description"
          placeholder="Describe what happened, when it occurred, what systems are affected, and any error messages observed..."
          required
          rows={4}
          minRows={3}
          maxRows={10}
          maxLength={5000}
          showCharacterCount
          autoResize
          error={form.getFieldError('description')}
          hint="Be specific about timeline, affected systems, and observed symptoms"
          helpText="Include: 1) What happened, 2) When it started, 3) Which systems are affected, 4) Error messages or codes, 5) Steps taken so far."
        />

        {/* Business Impact Field */}
        <TextAreaField
          {...form.getFieldProps('impact')}
          label="Business Impact"
          placeholder="Describe the business impact: number of users affected, revenue impact, affected business processes..."
          required
          rows={3}
          minRows={2}
          maxRows={8}
          maxLength={2000}
          showCharacterCount
          autoResize
          error={form.getFieldError('impact')}
          hint="Quantify the impact on business operations and users"
          helpText="Include: Number of affected users, revenue impact, affected business processes, customer impact, and any SLA implications."
        />

        {/* Tags Field */}
        <div className="incident-form__tag-section">
          <label className="incident-form__tag-label" id="tags-label">
            Tags
            <span className="incident-form__tag-hint">
              Add relevant keywords for categorization and search (press Enter or click Add)
            </span>
          </label>

          <div className="incident-form__tag-input-container">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyPress={handleTagKeyPress}
              placeholder="Add a tag (e.g., outage, database, p1-incident)..."
              maxLength={30}
              className="incident-form__tag-input"
              disabled={form.isSubmitting}
              aria-labelledby="tags-label"
              aria-describedby="tag-counter tag-hint"
              aria-invalid={!!form.getFieldError('tags')}
            />
            <Button
              type="button"
              onClick={handleAddTag}
              size="small"
              variant="secondary"
              disabled={!tagInput.trim() || form.values.tags.length >= 10}
            >
              Add
            </Button>
          </div>

          {form.values.tags.length > 0 && (
            <div className="incident-form__tags-list" role="list" aria-label="Current tags">
              {form.values.tags.map((tag) => (
                <span key={tag} className="incident-form__tag incident-form__tag--incident" role="listitem">
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="incident-form__tag-remove"
                    aria-label={`Remove tag: ${tag}`}
                    disabled={form.isSubmitting}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          {form.getFieldError('tags') && (
            <div className="incident-form__field-error">
              {form.getFieldError('tags')}
            </div>
          )}

          <div className="incident-form__tag-counter" id="tag-counter" aria-live="polite">
            {form.values.tags.length}/10 tags
          </div>
        </div>
      </div>

      {/* Form Status */}
      {ErrorMessages.hasErrors(form.errors) && (
        <div
          className="incident-form__error-summary"
          role="alert"
          aria-live="assertive"
          aria-labelledby="error-summary-title"
        >
          <strong id="error-summary-title">Please correct the following errors:</strong>
          <ul>
            {Object.entries(form.errors)
              .filter(([, error]) => error)
              .map(([field, error]) => (
                <li key={field}>
                  <button
                    type="button"
                    onClick={() => {
                      const element = document.querySelector(`[name="${field}"]`) as HTMLElement;
                      element?.focus();
                    }}
                    className="incident-form__error-link"
                    aria-label={`Fix error: ${error}`}
                  >
                    {error}
                  </button>
                </li>
              ))}
          </ul>
        </div>
      )}

      {/* Form Actions */}
      <div className="incident-form__actions">
        <div className="incident-form__actions-left">
          <Button
            type="button"
            variant="ghost"
            onClick={handleReset}
            disabled={form.isSubmitting || !form.isDirty}
            title="Reset form to initial values"
          >
            Reset
          </Button>

          {enableDrafts && form.hasDraft && (
            <Button
              type="button"
              variant="ghost"
              onClick={form.clearDraft}
              disabled={form.isSubmitting}
              title="Clear saved draft"
            >
              Clear Draft
            </Button>
          )}
        </div>

        <div className="incident-form__actions-right">
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={form.isSubmitting}
          >
            Cancel
          </Button>

          <Button
            type="submit"
            variant="primary"
            loading={form.isSubmitting}
            disabled={!form.isValid || form.isSubmitting}
            title={form.isValid ?
              `${mode === 'create' ? 'Report' : 'Save'} incident (Ctrl+S or Ctrl+Enter)` :
              'Please fix validation errors first'
            }
            className="incident-form__submit-button"
          >
            {form.isSubmitting
              ? (mode === 'create' ? 'Reporting...' : 'Saving...')
              : (mode === 'create' ? '🚨 Report Incident' : '💾 Save Changes')
            }
          </Button>
        </div>
      </div>

      {/* Keyboard Shortcuts Help */}
      <div className="incident-form__shortcuts">
        <details>
          <summary aria-expanded="false">Keyboard Shortcuts</summary>
          <ul role="list" aria-label="Available keyboard shortcuts">
            <li><kbd>Ctrl+S</kbd> or <kbd>Ctrl+Enter</kbd> - Submit form</li>
            <li><kbd>Ctrl+D</kbd> - Save draft</li>
            <li><kbd>Escape</kbd> - Cancel</li>
            <li><kbd>Enter</kbd> in tags field - Add tag</li>
          </ul>
        </details>
      </div>
    </form>
  );
});

IncidentForm.displayName = 'IncidentForm';