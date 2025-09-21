/**
 * Simplified Add Entry Form Component
 * No external dependencies, pure React with inline styles
 */

import React, { useState, memo } from 'react';

interface KBEntry {
  title: string;
  problem: string;
  solution: string;
  category: string;
  tags?: string[];
}

interface Props {
  onSubmit: (entry: KBEntry) => Promise<void>;
  onCancel: () => void;
}

export const SimpleAddEntryForm = memo<Props>(({ onSubmit, onCancel }) => {
  const [formData, setFormData] = useState<KBEntry>({
    title: '',
    problem: '',
    solution: '',
    category: 'Other',
    tags: [],
  });
  const [tagInput, setTagInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const categories = ['VSAM', 'COBOL', 'JCL', 'DB2', 'CICS', 'IMS', 'Network', 'Utilities', 'Security', 'ISPF', 'JES', 'SDSF', 'Data', 'Performance', 'Other'];

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }

    if (!formData.problem.trim()) {
      newErrors.problem = 'Problem description is required';
    }

    if (!formData.solution.trim()) {
      newErrors.solution = 'Solution is required';
    }

    if (formData.title.length > 200) {
      newErrors.title = 'Title must be less than 200 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: keyof KBEntry, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleAddTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !formData.tags?.includes(tag)) {
      setFormData(prev => ({
        ...prev,
        tags: [...(prev.tags || []), tag]
      }));
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags?.filter(tag => tag !== tagToRemove) || []
    }));
  };

  const handleTagInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    } else if (e.key === ',') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(formData);
    } catch (error) {
      console.error('Failed to submit form:', error);
      setErrors({ submit: 'Failed to save entry. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Styles
  const formStyle: React.CSSProperties = {
    padding: '2rem',
    backgroundColor: '#ffffff',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  };

  const headerStyle: React.CSSProperties = {
    marginBottom: '2rem',
    paddingBottom: '1rem',
    borderBottom: '1px solid #e5e7eb',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '1.5rem',
    fontWeight: '600',
    color: '#111827',
    margin: '0 0 0.5rem 0',
  };

  const subtitleStyle: React.CSSProperties = {
    fontSize: '0.875rem',
    color: '#6b7280',
    margin: 0,
  };

  const fieldGroupStyle: React.CSSProperties = {
    marginBottom: '1.5rem',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.875rem',
    fontWeight: '500',
    color: '#374151',
    marginBottom: '0.5rem',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.75rem',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '0.875rem',
    outline: 'none',
    transition: 'border-color 0.2s ease',
    boxSizing: 'border-box',
  };

  const inputFocusStyle: React.CSSProperties = {
    ...inputStyle,
    borderColor: '#3b82f6',
    boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.1)',
  };

  const textareaStyle: React.CSSProperties = {
    ...inputStyle,
    minHeight: '120px',
    resize: 'vertical',
    fontFamily: 'inherit',
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    cursor: 'pointer',
  };

  const errorStyle: React.CSSProperties = {
    fontSize: '0.75rem',
    color: '#dc2626',
    marginTop: '0.25rem',
  };

  const tagContainerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '0.5rem',
  };

  const tagInputStyle: React.CSSProperties = {
    ...inputStyle,
    flex: 1,
  };

  const tagButtonStyle: React.CSSProperties = {
    padding: '0.75rem 1rem',
    backgroundColor: '#f3f4f6',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.875rem',
    fontWeight: '500',
    color: '#374151',
  };

  const tagsListStyle: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.5rem',
    marginTop: '0.5rem',
  };

  const tagChipStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
    padding: '0.25rem 0.5rem',
    backgroundColor: '#eff6ff',
    color: '#1d4ed8',
    borderRadius: '12px',
    fontSize: '0.75rem',
    border: '1px solid #dbeafe',
  };

  const removeTagButtonStyle: React.CSSProperties = {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#6b7280',
    cursor: 'pointer',
    fontSize: '0.875rem',
    lineHeight: 1,
  };

  const buttonGroupStyle: React.CSSProperties = {
    display: 'flex',
    gap: '1rem',
    justifyContent: 'flex-end',
    paddingTop: '1.5rem',
    borderTop: '1px solid #e5e7eb',
    marginTop: '2rem',
  };

  const buttonStyle: React.CSSProperties = {
    padding: '0.75rem 1.5rem',
    borderRadius: '6px',
    fontSize: '0.875rem',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    border: 'none',
  };

  const primaryButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: '#3b82f6',
    color: 'white',
  };

  const secondaryButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: '#f3f4f6',
    color: '#374151',
    border: '1px solid #d1d5db',
  };

  const disabledButtonStyle: React.CSSProperties = {
    ...primaryButtonStyle,
    backgroundColor: '#9ca3af',
    cursor: 'not-allowed',
  };

  return (
    <form onSubmit={handleSubmit} style={formStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <h2 style={titleStyle}>Add Knowledge Entry</h2>
        <p style={subtitleStyle}>
          Share your knowledge to help the team solve problems faster
        </p>
      </div>

      {/* Title Field */}
      <div style={fieldGroupStyle}>
        <label htmlFor="title" style={labelStyle}>
          Title *
        </label>
        <input
          id="title"
          type="text"
          value={formData.title}
          onChange={(e) => handleInputChange('title', e.target.value)}
          style={inputStyle}
          onFocus={(e) => Object.assign(e.target.style, inputFocusStyle)}
          onBlur={(e) => Object.assign(e.target.style, inputStyle)}
          placeholder="Brief, descriptive title (e.g., 'VSAM Status 35 - File Not Found')"
          maxLength={200}
        />
        {errors.title && <div style={errorStyle}>{errors.title}</div>}
      </div>

      {/* Category Field */}
      <div style={fieldGroupStyle}>
        <label htmlFor="category" style={labelStyle}>
          Category *
        </label>
        <select
          id="category"
          value={formData.category}
          onChange={(e) => handleInputChange('category', e.target.value)}
          style={selectStyle}
        >
          {categories.map(category => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </div>

      {/* Problem Field */}
      <div style={fieldGroupStyle}>
        <label htmlFor="problem" style={labelStyle}>
          Problem Description *
        </label>
        <textarea
          id="problem"
          value={formData.problem}
          onChange={(e) => handleInputChange('problem', e.target.value)}
          style={textareaStyle}
          onFocus={(e) => Object.assign(e.target.style, { ...textareaStyle, ...inputFocusStyle })}
          onBlur={(e) => Object.assign(e.target.style, textareaStyle)}
          placeholder="Describe the problem or error in detail. Include error messages, symptoms, and context."
        />
        {errors.problem && <div style={errorStyle}>{errors.problem}</div>}
      </div>

      {/* Solution Field */}
      <div style={fieldGroupStyle}>
        <label htmlFor="solution" style={labelStyle}>
          Solution *
        </label>
        <textarea
          id="solution"
          value={formData.solution}
          onChange={(e) => handleInputChange('solution', e.target.value)}
          style={textareaStyle}
          onFocus={(e) => Object.assign(e.target.style, { ...textareaStyle, ...inputFocusStyle })}
          onBlur={(e) => Object.assign(e.target.style, textareaStyle)}
          placeholder="Provide step-by-step solution. Be specific with commands, parameters, and procedures."
        />
        {errors.solution && <div style={errorStyle}>{errors.solution}</div>}
      </div>

      {/* Tags Field */}
      <div style={fieldGroupStyle}>
        <label htmlFor="tags" style={labelStyle}>
          Tags
        </label>
        <div style={tagContainerStyle}>
          <input
            id="tags"
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleTagInputKeyDown}
            style={tagInputStyle}
            placeholder="Add tags (press Enter or comma to add)"
          />
          <button
            type="button"
            onClick={handleAddTag}
            style={tagButtonStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#e5e7eb';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#f3f4f6';
            }}
          >
            Add Tag
          </button>
        </div>

        {formData.tags && formData.tags.length > 0 && (
          <div style={tagsListStyle}>
            {formData.tags.map(tag => (
              <span key={tag} style={tagChipStyle}>
                {tag}
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  style={removeTagButtonStyle}
                  title={`Remove ${tag}`}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}
        <div style={{
          fontSize: '0.75rem',
          color: '#6b7280',
          marginTop: '0.25rem'
        }}>
          Tags help with searching. Use keywords like error codes, components, or technologies.
        </div>
      </div>

      {/* Submit Error */}
      {errors.submit && (
        <div style={{
          ...errorStyle,
          fontSize: '0.875rem',
          padding: '0.75rem',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '4px',
          marginBottom: '1rem',
        }}>
          {errors.submit}
        </div>
      )}

      {/* Button Group */}
      <div style={buttonGroupStyle}>
        <button
          type="button"
          onClick={onCancel}
          style={secondaryButtonStyle}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#e5e7eb';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#f3f4f6';
          }}
        >
          Cancel
        </button>

        <button
          type="submit"
          disabled={isSubmitting}
          style={isSubmitting ? disabledButtonStyle : primaryButtonStyle}
          onMouseEnter={(e) => {
            if (!isSubmitting) {
              e.currentTarget.style.backgroundColor = '#2563eb';
            }
          }}
          onMouseLeave={(e) => {
            if (!isSubmitting) {
              e.currentTarget.style.backgroundColor = '#3b82f6';
            }
          }}
        >
          {isSubmitting ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{
                width: '16px',
                height: '16px',
                border: '2px solid transparent',
                borderTop: '2px solid currentColor',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }} />
              Saving...
            </div>
          ) : (
            'Save Entry'
          )}
        </button>
      </div>

      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </form>
  );
});

SimpleAddEntryForm.displayName = 'SimpleAddEntryForm';