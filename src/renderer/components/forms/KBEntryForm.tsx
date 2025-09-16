import React, { useState, useEffect, useCallback, memo } from 'react';
import { Button } from '../common/Button';
import { TextField, TextAreaField, SelectField } from '../common/FormField';
import { useForm } from '../../hooks/useForm';
import { createKBEntryValidationSchema, ErrorMessages } from '../../utils/validation';
import { KBEntry } from '../../types';
import './KBEntryForm.css';

interface KBEntryFormData {
  title: string;
  problem: string;
  solution: string;
  category: 'JCL' | 'VSAM' | 'DB2' | 'Batch' | 'Functional' | 'Other';
  severity?: 'critical' | 'high' | 'medium' | 'low';
  tags: string[];
}

interface KBEntryFormProps {
  initialData?: Partial<KBEntryFormData>;
  onSubmit: (data: KBEntryFormData) => Promise<void>;
  onCancel: () => void;
  onError?: (error: Error) => void;
  mode?: 'create' | 'edit';
  autoSave?: boolean;
  enableDrafts?: boolean;
  showAdvancedOptions?: boolean;
}

const CATEGORY_OPTIONS = [
  { value: 'JCL', label: 'JCL - Job Control Language' },
  { value: 'VSAM', label: 'VSAM - Virtual Storage Access Method' },
  { value: 'DB2', label: 'DB2 - Database Management' },
  { value: 'Batch', label: 'Batch Processing' },
  { value: 'Functional', label: 'Functional/Business Logic' },
  { value: 'Other', label: 'Other/Miscellaneous' }
];

const SEVERITY_OPTIONS = [
  { value: 'critical', label: 'Critical - System Down' },
  { value: 'high', label: 'High - Major Impact' },
  { value: 'medium', label: 'Medium - Moderate Impact' },
  { value: 'low', label: 'Low - Minor Issue' }
];

/**
 * Enhanced Knowledge Base Entry Form
 * 
 * Features:
 * - Advanced validation with real-time feedback
 * - Auto-save and draft functionality
 * - Accessibility support (ARIA labels, keyboard navigation)
 * - Enhanced UX (character counts, hints, tooltips)
 * - Error handling with user-friendly messages
 * - Tag management with validation
 * - Keyboard shortcuts
 */
export const KBEntryForm = memo<KBEntryFormProps>(({
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
  const form = useForm<KBEntryFormData>({
    initialValues: {
      title: initialData?.title || '',
      problem: initialData?.problem || '',
      solution: initialData?.solution || '',
      category: initialData?.category || 'Other',
      severity: initialData?.severity || 'medium',
      tags: initialData?.tags || []
    },
    validationSchema: createKBEntryValidationSchema(mode),
    onSubmit: handleFormSubmit,
    onError: onError,
    validateOnChange: true,
    validateOnBlur: true,
    autoSave: autoSave,
    autoSaveDelay: 2000,
    enableDrafts: enableDrafts,
    draftKey: `kb-entry-${mode}-${initialData?.id || 'new'}`
  });

  async function handleFormSubmit(data: KBEntryFormData): Promise<void> {
    try {
      await onSubmit(data);
    } catch (error) {
      console.error('Form submission error:', error);
      throw error;
    }
  }

  // Handle draft loading notification
  useEffect(() => {
    if (form.hasDraft && enableDrafts) {
      const shouldLoadDraft = window.confirm(
        'A draft was found for this entry. Would you like to load it?'
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

  return (
    <form
      className="kb-entry-form"
      onSubmit={form.handleSubmit}
      noValidate
      role="form"
      aria-label={mode === 'create' ? 'Add new knowledge entry' : 'Edit knowledge entry'}
    >
      <div className="kb-entry-form__header">
        <div className="kb-entry-form__title">
          <h2>{mode === 'create' ? 'Add New Knowledge Entry' : 'Edit Knowledge Entry'}</h2>
          {form.isDirty && (
            <span className="kb-entry-form__unsaved-indicator" title="Unsaved changes">
              ●
            </span>
          )}
          {form.isAutoSaving && (
            <span className="kb-entry-form__auto-save-indicator">
              Saving...
            </span>
          )}
        </div>
        
        {enableDrafts && (
          <div className="kb-entry-form__draft-actions">
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

      <div className="kb-entry-form__fields">
        {/* Title Field */}
        <TextField
          {...form.getFieldProps('title')}
          label="Title"
          placeholder="Brief, descriptive title (e.g., 'VSAM Status 35 - File Not Found')"
          required
          maxLength={200}
          showCharacterCount
          error={form.getFieldError('title')}
          hint="Provide a clear, concise title that describes the problem"
          helpText="The title should be specific enough that someone can quickly identify if this entry is relevant to their issue. Include error codes, system names, or key symptoms."
          autoFocus={mode === 'create'}
        />

        {/* Category Field */}
        <SelectField
          {...form.getFieldProps('category')}
          label="Category"
          options={CATEGORY_OPTIONS}
          required
          error={form.getFieldError('category')}
          hint="Select the primary system or component involved"
        />

        {/* Advanced Options Toggle */}
        <div className="kb-entry-form__advanced-toggle">
          <button
            type="button"
            className="kb-entry-form__toggle-button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            aria-expanded={showAdvanced}
            aria-controls="advanced-options"
            aria-label={showAdvanced ? 'Hide advanced options' : 'Show advanced options'}
          >
            <span
              className={`kb-entry-form__toggle-icon ${showAdvanced ? 'expanded' : ''}`}
              aria-hidden="true"
            >
              ▶
            </span>
            Advanced Options
          </button>
        </div>

        {/* Advanced Options */}
        {showAdvanced && (
          <div
            className="kb-entry-form__advanced-options"
            id="advanced-options"
            role="region"
            aria-label="Advanced options"
          >
            <SelectField
              {...form.getFieldProps('severity')}
              label="Severity Level"
              options={SEVERITY_OPTIONS}
              error={form.getFieldError('severity')}
              hint="Indicate the business impact level"
              helpText="Severity helps prioritize issues and set expectations for resolution urgency."
            />
          </div>
        )}

        {/* Problem Description Field */}
        <TextAreaField
          {...form.getFieldProps('problem')}
          label="Problem Description"
          placeholder="Describe the problem or error in detail. Include error messages, symptoms, and context..."
          required
          rows={4}
          minRows={3}
          maxRows={10}
          maxLength={5000}
          showCharacterCount
          autoResize
          error={form.getFieldError('problem')}
          hint="Be specific about error messages, symptoms, and the context when the problem occurs"
          helpText="A good problem description includes: 1) What you were trying to do, 2) What happened instead, 3) Any error messages or codes, 4) When and where it occurs."
        />

        {/* Solution Field */}
        <TextAreaField
          {...form.getFieldProps('solution')}
          label="Solution"
          placeholder="Provide step-by-step solution instructions..."
          required
          rows={6}
          minRows={4}
          maxRows={15}
          maxLength={10000}
          showCharacterCount
          autoResize
          error={form.getFieldError('solution')}
          hint="Use numbered steps for clarity and include verification steps"
          helpText="Structure your solution with: 1) Prerequisites/preparation, 2) Step-by-step actions, 3) Verification steps, 4) Additional notes or warnings."
        />

        {/* Tags Field */}
        <div className="kb-entry-form__tag-section">
          <label className="kb-entry-form__tag-label" id="tags-label">
            Tags
            <span className="kb-entry-form__tag-hint">
              Add searchable keywords (press Enter or click Add)
            </span>
          </label>
          
          <div className="kb-entry-form__tag-input-container">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyPress={handleTagKeyPress}
              placeholder="Add a tag..."
              maxLength={30}
              className="kb-entry-form__tag-input"
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
            <div className="kb-entry-form__tags-list" role="list" aria-label="Current tags">
              {form.values.tags.map((tag) => (
                <span key={tag} className="kb-entry-form__tag" role="listitem">
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="kb-entry-form__tag-remove"
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
            <div className="kb-entry-form__field-error">
              {form.getFieldError('tags')}
            </div>
          )}
          
          <div className="kb-entry-form__tag-counter" id="tag-counter" aria-live="polite">
            {form.values.tags.length}/10 tags
          </div>
        </div>
      </div>

      {/* Form Status */}
      {ErrorMessages.hasErrors(form.errors) && (
        <div
          className="kb-entry-form__error-summary"
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
                    className="kb-entry-form__error-link"
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
      <div className="kb-entry-form__actions">
        <div className="kb-entry-form__actions-left">
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

        <div className="kb-entry-form__actions-right">
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
              `${mode === 'create' ? 'Add' : 'Save'} entry (Ctrl+S or Ctrl+Enter)` : 
              'Please fix validation errors first'
            }
          >
            {form.isSubmitting 
              ? (mode === 'create' ? 'Adding...' : 'Saving...') 
              : (mode === 'create' ? 'Add Entry' : 'Save Changes')
            }
          </Button>
        </div>
      </div>

      {/* Keyboard Shortcuts Help */}
      <div className="kb-entry-form__shortcuts">
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

KBEntryForm.displayName = 'KBEntryForm';