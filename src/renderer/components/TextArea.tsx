/**
 * Accessible TextArea Component
 *
 * Features:
 * - WCAG 2.1 AA compliant
 * - Full keyboard navigation support
 * - Proper ARIA attributes and roles
 * - Focus management with visible indicators
 * - Auto-resize functionality
 * - Character count display
 * - aria-describedby for helper text
 * - Multiline navigation support
 * - Screen reader announcements
 * - Error and validation states
 * - Label association
 */

import React, { useRef, useEffect, forwardRef, useId, useState, useCallback } from 'react';
import { AriaUtils, announceToScreenReader } from '../utils/accessibility';
import { useKeyboard } from '../contexts/KeyboardContext';
import './TextArea.css';

export interface TextAreaProps {
  /** Current value */
  value: string;
  /** Change handler */
  onChange: (value: string, event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  /** Label text */
  label: string;
  /** Name attribute */
  name?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Whether the textarea is disabled */
  disabled?: boolean;
  /** Whether the textarea is read-only */
  readOnly?: boolean;
  /** Whether the field is required */
  required?: boolean;
  /** Error message to display */
  error?: string;
  /** Helper text */
  helperText?: string;
  /** Maximum character length */
  maxLength?: number;
  /** Minimum character length */
  minLength?: number;
  /** Number of visible rows */
  rows?: number;
  /** Minimum number of rows when auto-resizing */
  minRows?: number;
  /** Maximum number of rows when auto-resizing */
  maxRows?: number;
  /** Enable auto-resize functionality */
  autoResize?: boolean;
  /** Show character count */
  showCharacterCount?: boolean;
  /** Show word count */
  showWordCount?: boolean;
  /** Size variant */
  size?: 'small' | 'medium' | 'large';
  /** Visual variant */
  variant?: 'default' | 'filled' | 'outlined';
  /** Resize behavior */
  resize?: 'none' | 'both' | 'horizontal' | 'vertical';
  /** Custom class name */
  className?: string;
  /** Test ID for testing */
  'data-testid'?: string;
  /** Auto focus on mount */
  autoFocus?: boolean;
  /** Custom aria-label */
  'aria-label'?: string;
  /** Custom aria-describedby */
  'aria-describedby'?: string;
  /** Focus handler */
  onFocus?: (event: React.FocusEvent<HTMLTextAreaElement>) => void;
  /** Blur handler */
  onBlur?: (event: React.FocusEvent<HTMLTextAreaElement>) => void;
  /** Key down handler */
  onKeyDown?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  /** ID for the textarea element */
  id?: string;
  /** Spell check */
  spellCheck?: boolean;
  /** Autocomplete attribute */
  autoComplete?: string;
  /** Auto capitalize */
  autoCapitalize?: 'off' | 'none' | 'on' | 'sentences' | 'words' | 'characters';
  /** Form validation */
  pattern?: string;
  /** Custom validation message */
  validationMessage?: string;
  /** Announce count changes to screen readers */
  announceCountChanges?: boolean;
}

/**
 * Accessible TextArea component
 */
export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(({
  value,
  onChange,
  label,
  name,
  placeholder,
  disabled = false,
  readOnly = false,
  required = false,
  error,
  helperText,
  maxLength,
  minLength,
  rows = 4,
  minRows = 2,
  maxRows = 10,
  autoResize = false,
  showCharacterCount = false,
  showWordCount = false,
  size = 'medium',
  variant = 'default',
  resize = 'vertical',
  className = '',
  'data-testid': testId,
  autoFocus = false,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
  onFocus,
  onBlur,
  onKeyDown,
  id: providedId,
  spellCheck = true,
  autoComplete,
  autoCapitalize = 'sentences',
  pattern,
  validationMessage,
  announceCountChanges = false,
}, ref) => {
  const internalRef = useRef<HTMLTextAreaElement>(null);
  const textareaRef = ref || internalRef;
  const generatedId = useId();
  const id = providedId || generatedId;
  const errorId = error ? `${id}-error` : undefined;
  const helperTextId = helperText ? `${id}-helper` : undefined;
  const countId = (showCharacterCount || showWordCount) ? `${id}-count` : undefined;
  const { state: keyboardState } = useKeyboard();

  // State for character and word counts
  const [characterCount, setCharacterCount] = useState(value.length);
  const [wordCount, setWordCount] = useState(value.trim() ? value.trim().split(/\s+/).length : 0);

  // Previous count values for announcements
  const previousCharacterCountRef = useRef(characterCount);
  const previousWordCountRef = useRef(wordCount);

  // Auto focus
  useEffect(() => {
    if (autoFocus && textareaRef && 'current' in textareaRef && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus, textareaRef]);

  // Auto-resize functionality
  const adjustHeight = useCallback(() => {
    if (!autoResize || !textareaRef || !('current' in textareaRef) || !textareaRef.current) return;

    const textarea = textareaRef.current;

    // Reset height to get correct scrollHeight
    textarea.style.height = 'auto';

    // Calculate new height
    const newHeight = textarea.scrollHeight;

    // Apply min/max rows constraints
    const lineHeight = parseInt(getComputedStyle(textarea).lineHeight) || 24;
    const minHeight = minRows * lineHeight;
    const maxHeight = maxRows * lineHeight;

    const finalHeight = Math.min(Math.max(newHeight, minHeight), maxHeight);

    textarea.style.height = `${finalHeight}px`;

    // Add scrollbar if content exceeds max height
    if (newHeight > maxHeight) {
      textarea.style.overflowY = 'auto';
    } else {
      textarea.style.overflowY = 'hidden';
    }
  }, [autoResize, minRows, maxRows, textareaRef]);

  // Update counts and auto-resize on value change
  useEffect(() => {
    const newCharacterCount = value.length;
    const newWordCount = value.trim() ? value.trim().split(/\s+/).length : 0;

    setCharacterCount(newCharacterCount);
    setWordCount(newWordCount);

    // Announce count changes to screen readers if enabled
    if (announceCountChanges) {
      if (maxLength && newCharacterCount !== previousCharacterCountRef.current) {
        const remaining = maxLength - newCharacterCount;
        if (remaining === 0) {
          announceToScreenReader('Character limit reached', 'assertive');
        } else if (remaining <= 10 && remaining > 0) {
          announceToScreenReader(`${remaining} characters remaining`, 'polite');
        }
      }
    }

    previousCharacterCountRef.current = newCharacterCount;
    previousWordCountRef.current = newWordCount;

    // Auto-resize
    adjustHeight();
  }, [value, maxLength, announceCountChanges, adjustHeight]);

  // Adjust height on mount and window resize
  useEffect(() => {
    adjustHeight();

    if (autoResize) {
      window.addEventListener('resize', adjustHeight);
      return () => window.removeEventListener('resize', adjustHeight);
    }
  }, [adjustHeight, autoResize]);

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (disabled || readOnly) {
      event.preventDefault();
      return;
    }

    const newValue = event.target.value;

    // Enforce max length if specified
    if (maxLength && newValue.length > maxLength) {
      return;
    }

    onChange(newValue, event);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle Tab key for indentation in multiline text
    if (event.key === 'Tab' && !event.shiftKey && !event.ctrlKey && !event.altKey) {
      // Allow tab for navigation when at the start or end of content
      const textarea = event.currentTarget;
      const { selectionStart, selectionEnd } = textarea;
      const atStart = selectionStart === 0;
      const atEnd = selectionEnd === value.length;

      // If there's a selection or we're in the middle, insert tab
      if (selectionStart !== selectionEnd || (!atStart && !atEnd)) {
        event.preventDefault();

        const newValue = value.substring(0, selectionStart) + '\t' + value.substring(selectionEnd);
        const newCursorPos = selectionStart + 1;

        onChange(newValue, {
          ...event,
          target: { ...event.target, value: newValue }
        } as React.ChangeEvent<HTMLTextAreaElement>);

        // Set cursor position after the inserted tab
        setTimeout(() => {
          textarea.setSelectionRange(newCursorPos, newCursorPos);
        }, 0);
      }
    }

    onKeyDown?.(event);
  };

  const handleFocus = (event: React.FocusEvent<HTMLTextAreaElement>) => {
    onFocus?.(event);
  };

  const handleBlur = (event: React.FocusEvent<HTMLTextAreaElement>) => {
    onBlur?.(event);
  };

  // Build CSS classes
  const textareaClasses = [
    'textarea',
    `textarea--${size}`,
    `textarea--${variant}`,
    `textarea--${resize}`,
    disabled && 'textarea--disabled',
    readOnly && 'textarea--readonly',
    error && 'textarea--error',
    required && 'textarea--required',
    autoResize && 'textarea--auto-resize',
    keyboardState.isKeyboardMode && 'textarea--keyboard-mode',
    className
  ].filter(Boolean).join(' ');

  // Build describedBy string
  const describedBy = [
    errorId,
    helperTextId,
    countId,
    ariaDescribedBy
  ].filter(Boolean).join(' ') || undefined;

  // Calculate remaining characters
  const remainingCharacters = maxLength ? maxLength - characterCount : undefined;
  const isNearLimit = remainingCharacters !== undefined && remainingCharacters <= 10;
  const isOverLimit = remainingCharacters !== undefined && remainingCharacters < 0;

  return (
    <div className={textareaClasses} data-testid={testId}>
      {/* Label */}
      <label
        htmlFor={id}
        className="textarea__label"
      >
        {label}
        {required && (
          <span className="textarea__required" aria-label="required">
            *
          </span>
        )}
      </label>

      {/* Textarea container */}
      <div className="textarea__input-container">
        <textarea
          ref={textareaRef}
          id={id}
          name={name}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={readOnly}
          required={required}
          rows={autoResize ? minRows : rows}
          maxLength={maxLength}
          minLength={minLength}
          spellCheck={spellCheck}
          autoComplete={autoComplete}
          autoCapitalize={autoCapitalize}
          pattern={pattern}
          className="textarea__input"
          aria-label={ariaLabel}
          aria-describedby={describedBy}
          aria-invalid={error ? 'true' : undefined}
          aria-required={required || undefined}
          data-testid={testId ? `${testId}-input` : undefined}
        />

        {/* Character/Word count */}
        {(showCharacterCount || showWordCount) && (
          <div
            id={countId}
            className={`textarea__count ${isNearLimit ? 'textarea__count--warning' : ''} ${isOverLimit ? 'textarea__count--error' : ''}`}
            aria-live="polite"
          >
            {showCharacterCount && (
              <span className="textarea__character-count">
                {maxLength ? (
                  <span>
                    <span className={isOverLimit ? 'over-limit' : ''}>{characterCount}</span>
                    /{maxLength} characters
                  </span>
                ) : (
                  <span>{characterCount} characters</span>
                )}
              </span>
            )}
            {showCharacterCount && showWordCount && (
              <span className="textarea__count-separator"> • </span>
            )}
            {showWordCount && (
              <span className="textarea__word-count">
                {wordCount} words
              </span>
            )}
          </div>
        )}
      </div>

      {/* Helper text */}
      {helperText && !error && (
        <div
          id={helperTextId}
          className="textarea__helper-text"
        >
          {helperText}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div
          id={errorId}
          className="textarea__error"
          role="alert"
          aria-live="polite"
        >
          <span className="textarea__error-icon" aria-hidden="true">⚠</span>
          {error}
        </div>
      )}

      {/* Validation message for custom validation */}
      {validationMessage && (
        <div className="textarea__validation-message">
          {validationMessage}
        </div>
      )}

      {/* Screen reader announcements for auto-resize */}
      {autoResize && (
        <div className="sr-only" aria-live="polite" aria-atomic="true">
          Auto-resizing text area
        </div>
      )}
    </div>
  );
});

TextArea.displayName = 'TextArea';

export default TextArea;