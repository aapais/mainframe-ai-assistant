/**
 * Progressive Form Component
 * Multi-step form with smart field disclosure and contextual assistance
 */

import React, { useState, useCallback, useEffect, memo } from 'react';

interface KBEntry {
  title: string;
  problem: string;
  solution: string;
  category: string;
  tags?: string[];
}

interface FormStep {
  id: string;
  title: string;
  description: string;
  fields: string[];
  validation?: (data: Partial<KBEntry>) => string[];
}

interface ProgressiveFormProps {
  onSubmit: (entry: KBEntry) => Promise<void>;
  onCancel: () => void;
  initialData?: Partial<KBEntry>;
  categories?: string[];
  suggestedTags?: string[];
  autoSaveInterval?: number;
}

export const ProgressiveFormComponent = memo<ProgressiveFormProps>(({
  onSubmit,
  onCancel,
  initialData = {},
  categories = ['VSAM', 'COBOL', 'JCL', 'DB2', 'CICS', 'IMS', 'Network', 'Utilities', 'Security', 'ISPF', 'JES', 'SDSF', 'Data', 'Performance', 'Other'],
  suggestedTags = [],
  autoSaveInterval = 30000
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<Partial<KBEntry>>(initialData);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'saved' | 'saving' | 'error' | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [showHints, setShowHints] = useState(true);

  // Form steps configuration
  const steps: FormStep[] = [
    {
      id: 'basic',
      title: 'Basic Information',
      description: 'Start with the essential details',
      fields: ['title', 'category'],
      validation: (data) => {
        const errors: string[] = [];
        if (!data.title?.trim()) errors.push('Title is required');
        if (data.title && data.title.length > 200) errors.push('Title must be less than 200 characters');
        if (!data.category) errors.push('Category is required');
        return errors;
      }
    },
    {
      id: 'problem',
      title: 'Problem Description',
      description: 'Describe what went wrong',
      fields: ['problem'],
      validation: (data) => {
        const errors: string[] = [];
        if (!data.problem?.trim()) errors.push('Problem description is required');
        if (data.problem && data.problem.length < 20) errors.push('Please provide more details about the problem');
        return errors;
      }
    },
    {
      id: 'solution',
      title: 'Solution Steps',
      description: 'How did you solve it?',
      fields: ['solution'],
      validation: (data) => {
        const errors: string[] = [];
        if (!data.solution?.trim()) errors.push('Solution is required');
        if (data.solution && data.solution.length < 30) errors.push('Please provide detailed solution steps');
        return errors;
      }
    },
    {
      id: 'tags',
      title: 'Tags & Review',
      description: 'Add tags and review your entry',
      fields: ['tags'],
      validation: () => []
    }
  ];

  // Auto-save functionality
  useEffect(() => {
    if (autoSaveInterval > 0) {
      const interval = setInterval(() => {
        saveToLocalStorage();
      }, autoSaveInterval);

      return () => clearInterval(interval);
    }
  }, [formData, autoSaveInterval]);

  // Load saved data on mount
  useEffect(() => {
    const saved = localStorage.getItem('kb-form-draft');
    if (saved && !initialData.title) {
      try {
        const parsedData = JSON.parse(saved);
        setFormData(parsedData);
      } catch (error) {
        console.warn('Failed to load saved form data:', error);
      }
    }
  }, [initialData]);

  const saveToLocalStorage = useCallback(async () => {
    try {
      setAutoSaveStatus('saving');
      localStorage.setItem('kb-form-draft', JSON.stringify(formData));
      setAutoSaveStatus('saved');
      setTimeout(() => setAutoSaveStatus(null), 2000);
    } catch (error) {
      console.error('Auto-save failed:', error);
      setAutoSaveStatus('error');
      setTimeout(() => setAutoSaveStatus(null), 3000);
    }
  }, [formData]);

  const clearSavedData = () => {
    localStorage.removeItem('kb-form-draft');
  };

  const validateCurrentStep = (): boolean => {
    const currentStepConfig = steps[currentStep];
    const stepErrors = currentStepConfig.validation?.(formData) || [];

    setErrors(prev => ({
      ...prev,
      [currentStepConfig.id]: stepErrors
    }));

    return stepErrors.length === 0;
  };

  const updateField = (field: keyof KBEntry, value: string | string[]) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    // Clear field-specific errors
    const currentStepConfig = steps[currentStep];
    if (currentStepConfig.fields.includes(field)) {
      setErrors(prev => ({
        ...prev,
        [currentStepConfig.id]: []
      }));
    }
  };

  const nextStep = () => {
    if (validateCurrentStep() && currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSubmit = async () => {
    if (!validateCurrentStep()) return;

    // Validate all steps
    const allErrors: string[] = [];
    steps.forEach(step => {
      const stepErrors = step.validation?.(formData) || [];
      allErrors.push(...stepErrors);
    });

    if (allErrors.length > 0) {
      setErrors({ submit: allErrors });
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(formData as KBEntry);
      clearSavedData();
    } catch (error) {
      console.error('Form submission failed:', error);
      setErrors({ submit: ['Failed to save entry. Please try again.'] });
    } finally {
      setIsSubmitting(false);
    }
  };

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !(formData.tags || []).includes(tag)) {
      updateField('tags', [...(formData.tags || []), tag]);
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    updateField('tags', (formData.tags || []).filter(tag => tag !== tagToRemove));
  };

  const getFieldHints = (field: string): string => {
    const hints: Record<string, string> = {
      title: 'Keep it concise but descriptive. Include error codes if applicable.',
      category: 'Choose the most relevant category for easier searching.',
      problem: 'Include error messages, symptoms, and the context when this occurred.',
      solution: 'Provide step-by-step instructions. Be specific with commands and parameters.',
      tags: 'Add keywords that will help others find this solution quickly.'
    };
    return hints[field] || '';
  };

  const getSuggestedTags = (): string[] => {
    const allSuggestions = [...suggestedTags];

    // Add category-based suggestions
    if (formData.category) {
      allSuggestions.push(formData.category.toLowerCase());
    }

    // Add error code suggestions from title or problem
    const text = `${formData.title || ''} ${formData.problem || ''}`.toUpperCase();
    const errorCodes = text.match(/\b[A-Z]\d+[A-Z]?\b/g) || [];
    allSuggestions.push(...errorCodes.map(code => code.toLowerCase()));

    // Remove duplicates and already selected tags
    return [...new Set(allSuggestions)].filter(tag =>
      !(formData.tags || []).includes(tag)
    ).slice(0, 8);
  };

  // Styles
  const containerStyle: React.CSSProperties = {
    maxWidth: '600px',
    margin: '0 auto',
    padding: '2rem',
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  };

  const progressBarStyle: React.CSSProperties = {
    width: '100%',
    height: '4px',
    backgroundColor: '#e5e7eb',
    borderRadius: '2px',
    marginBottom: '2rem',
    overflow: 'hidden'
  };

  const progressFillStyle: React.CSSProperties = {
    width: `${((currentStep + 1) / steps.length) * 100}%`,
    height: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: '2px',
    transition: 'width 0.3s ease'
  };

  const stepHeaderStyle: React.CSSProperties = {
    marginBottom: '2rem',
    textAlign: 'center'
  };

  const stepTitleStyle: React.CSSProperties = {
    fontSize: '1.5rem',
    fontWeight: '600',
    color: '#111827',
    margin: '0 0 0.5rem 0'
  };

  const stepDescriptionStyle: React.CSSProperties = {
    fontSize: '1rem',
    color: '#6b7280',
    margin: 0
  };

  const fieldStyle: React.CSSProperties = {
    marginBottom: '1.5rem'
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.875rem',
    fontWeight: '500',
    color: '#374151',
    marginBottom: '0.5rem'
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.75rem',
    border: '2px solid #e5e7eb',
    borderRadius: '8px',
    fontSize: '1rem',
    outline: 'none',
    transition: 'border-color 0.2s ease',
    boxSizing: 'border-box'
  };

  const textareaStyle: React.CSSProperties = {
    ...inputStyle,
    minHeight: '120px',
    resize: 'vertical',
    fontFamily: 'inherit'
  };

  const hintStyle: React.CSSProperties = {
    fontSize: '0.75rem',
    color: '#6b7280',
    marginTop: '0.25rem',
    fontStyle: 'italic'
  };

  const errorStyle: React.CSSProperties = {
    color: '#dc2626',
    fontSize: '0.75rem',
    marginTop: '0.25rem'
  };

  const tagContainerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '0.5rem'
  };

  const tagInputStyle: React.CSSProperties = {
    ...inputStyle,
    flex: 1
  };

  const buttonStyle: React.CSSProperties = {
    padding: '0.75rem 1.5rem',
    borderRadius: '8px',
    fontSize: '0.875rem',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    border: 'none'
  };

  const primaryButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: '#3b82f6',
    color: 'white'
  };

  const secondaryButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: '#f3f4f6',
    color: '#374151',
    border: '1px solid #d1d5db'
  };

  const autoSaveIndicatorStyle: React.CSSProperties = {
    position: 'fixed',
    top: '20px',
    right: '20px',
    padding: '8px 12px',
    borderRadius: '6px',
    fontSize: '0.75rem',
    fontWeight: '500',
    zIndex: 1000
  };

  const renderCurrentStep = () => {
    const step = steps[currentStep];
    const stepErrors = errors[step.id] || [];

    switch (step.id) {
      case 'basic':
        return (
          <>
            <div style={fieldStyle}>
              <label htmlFor="title" style={labelStyle}>
                Title *
              </label>
              <input
                id="title"
                type="text"
                value={formData.title || ''}
                onChange={(e) => updateField('title', e.target.value)}
                style={inputStyle}
                placeholder="Brief, descriptive title (e.g., 'VSAM Status 35 - File Not Found')"
                maxLength={200}
              />
              {showHints && <div style={hintStyle}>{getFieldHints('title')}</div>}
            </div>

            <div style={fieldStyle}>
              <label htmlFor="category" style={labelStyle}>
                Category *
              </label>
              <select
                id="category"
                value={formData.category || ''}
                onChange={(e) => updateField('category', e.target.value)}
                style={inputStyle}
              >
                <option value="">Select a category</option>
                {categories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
              {showHints && <div style={hintStyle}>{getFieldHints('category')}</div>}
            </div>
          </>
        );

      case 'problem':
        return (
          <div style={fieldStyle}>
            <label htmlFor="problem" style={labelStyle}>
              Problem Description *
            </label>
            <textarea
              id="problem"
              value={formData.problem || ''}
              onChange={(e) => updateField('problem', e.target.value)}
              style={textareaStyle}
              placeholder="Describe the problem or error in detail. Include error messages, symptoms, and context..."
            />
            {showHints && <div style={hintStyle}>{getFieldHints('problem')}</div>}
          </div>
        );

      case 'solution':
        return (
          <div style={fieldStyle}>
            <label htmlFor="solution" style={labelStyle}>
              Solution Steps *
            </label>
            <textarea
              id="solution"
              value={formData.solution || ''}
              onChange={(e) => updateField('solution', e.target.value)}
              style={textareaStyle}
              placeholder="Provide step-by-step solution. Be specific with commands, parameters, and procedures..."
            />
            {showHints && <div style={hintStyle}>{getFieldHints('solution')}</div>}
          </div>
        );

      case 'tags':
        const suggestedTagsList = getSuggestedTags();
        return (
          <>
            <div style={fieldStyle}>
              <label htmlFor="tags" style={labelStyle}>
                Tags
              </label>
              <div style={tagContainerStyle}>
                <input
                  id="tags"
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                  style={tagInputStyle}
                  placeholder="Add tags (press Enter or comma to add)"
                />
                <button
                  type="button"
                  onClick={addTag}
                  style={secondaryButtonStyle}
                >
                  Add
                </button>
              </div>

              {/* Current tags */}
              {formData.tags && formData.tags.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
                  {formData.tags.map(tag => (
                    <span
                      key={tag}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        padding: '0.25rem 0.5rem',
                        backgroundColor: '#e0e7ff',
                        color: '#3730a3',
                        borderRadius: '12px',
                        fontSize: '0.75rem'
                      }}
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        style={{
                          backgroundColor: 'transparent',
                          border: 'none',
                          color: '#6b7280',
                          cursor: 'pointer',
                          fontSize: '0.875rem'
                        }}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Suggested tags */}
              {suggestedTagsList.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                    Suggested tags:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {suggestedTagsList.map(tag => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => updateField('tags', [...(formData.tags || []), tag])}
                        style={{
                          padding: '0.25rem 0.5rem',
                          backgroundColor: '#f3f4f6',
                          color: '#374151',
                          border: '1px solid #d1d5db',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          cursor: 'pointer'
                        }}
                      >
                        + {tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {showHints && <div style={hintStyle}>{getFieldHints('tags')}</div>}
            </div>

            {/* Review summary */}
            <div style={{
              padding: '1rem',
              backgroundColor: '#f9fafb',
              borderRadius: '8px',
              border: '1px solid #e5e7eb'
            }}>
              <h4 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: '600' }}>
                Review Your Entry
              </h4>
              <div style={{ fontSize: '0.875rem', lineHeight: '1.5' }}>
                <div><strong>Title:</strong> {formData.title}</div>
                <div><strong>Category:</strong> {formData.category}</div>
                <div><strong>Problem:</strong> {formData.problem?.substring(0, 100)}...</div>
                <div><strong>Solution:</strong> {formData.solution?.substring(0, 100)}...</div>
                {formData.tags && formData.tags.length > 0 && (
                  <div><strong>Tags:</strong> {formData.tags.join(', ')}</div>
                )}
              </div>
            </div>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div style={containerStyle}>
      {/* Auto-save indicator */}
      {autoSaveStatus && (
        <div style={{
          ...autoSaveIndicatorStyle,
          backgroundColor: autoSaveStatus === 'error' ? '#fef2f2' : '#f0fdf4',
          color: autoSaveStatus === 'error' ? '#dc2626' : '#15803d',
          border: `1px solid ${autoSaveStatus === 'error' ? '#fecaca' : '#bbf7d0'}`
        }}>
          {autoSaveStatus === 'saving' && '💾 Saving...'}
          {autoSaveStatus === 'saved' && '✅ Saved'}
          {autoSaveStatus === 'error' && '❌ Save failed'}
        </div>
      )}

      {/* Progress bar */}
      <div style={progressBarStyle}>
        <div style={progressFillStyle} />
      </div>

      {/* Step header */}
      <div style={stepHeaderStyle}>
        <h2 style={stepTitleStyle}>
          {steps[currentStep].title}
        </h2>
        <p style={stepDescriptionStyle}>
          {steps[currentStep].description}
        </p>
        <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.5rem' }}>
          Step {currentStep + 1} of {steps.length}
        </div>
      </div>

      {/* Form fields */}
      {renderCurrentStep()}

      {/* Errors */}
      {(errors[steps[currentStep].id] || errors.submit) && (
        <div style={{ marginBottom: '1.5rem' }}>
          {[...(errors[steps[currentStep].id] || []), ...(errors.submit || [])].map((error, index) => (
            <div key={index} style={errorStyle}>
              ❌ {error}
            </div>
          ))}
        </div>
      )}

      {/* Navigation buttons */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: '2rem',
        borderTop: '1px solid #e5e7eb'
      }}>
        <div style={{ display: 'flex', gap: '1rem' }}>
          {currentStep > 0 && (
            <button
              type="button"
              onClick={prevStep}
              style={secondaryButtonStyle}
            >
              ← Previous
            </button>
          )}
          <button
            type="button"
            onClick={onCancel}
            style={secondaryButtonStyle}
          >
            Cancel
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            type="button"
            onClick={() => setShowHints(!showHints)}
            style={{
              ...secondaryButtonStyle,
              fontSize: '0.75rem',
              padding: '0.5rem 1rem'
            }}
          >
            {showHints ? '🙈 Hide Hints' : '💡 Show Hints'}
          </button>

          {currentStep < steps.length - 1 ? (
            <button
              type="button"
              onClick={nextStep}
              style={primaryButtonStyle}
            >
              Next →
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              style={{
                ...primaryButtonStyle,
                opacity: isSubmitting ? 0.7 : 1,
                cursor: isSubmitting ? 'not-allowed' : 'pointer'
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
                    animation: 'spin 1s linear infinite'
                  }} />
                  Saving...
                </div>
              ) : (
                'Save Entry'
              )}
            </button>
          )}
        </div>
      </div>

      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
});

ProgressiveFormComponent.displayName = 'ProgressiveFormComponent';