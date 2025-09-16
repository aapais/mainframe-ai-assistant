/**
 * Form Validation Hook
 *
 * Comprehensive form validation hook with:
 * - Real-time validation with debouncing
 * - Custom validation rules and messages
 * - Field-level and form-level validation
 * - Error state management
 * - Accessibility support
 *
 * @author Swarm Architecture Team
 * @version 1.0.0
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { debounce } from 'lodash';

// ========================
// Types & Interfaces
// ========================

export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  email?: boolean;
  url?: boolean;
  custom?: (value: any) => string | null;
  minItems?: number;
  maxItems?: number;
}

export interface ValidationSchema {
  [fieldName: string]: ValidationRule;
}

export interface ValidationErrors {
  [fieldName: string]: string;
}

export interface UseFormValidationOptions {
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
  debounceMs?: number;
  showErrorsImmediately?: boolean;
}

export interface UseFormValidationReturn {
  errors: ValidationErrors;
  isValid: boolean;
  isDirty: boolean;
  touchedFields: Set<string>;
  validate: () => boolean;
  validateField: (field: string, value: any) => string | null;
  setFieldTouched: (field: string) => void;
  setFieldError: (field: string, error: string | null) => void;
  clearErrors: () => void;
  clearFieldError: (field: string) => void;
  reset: () => void;
}

// ========================
// Default Error Messages
// ========================

const DEFAULT_MESSAGES = {
  required: 'This field is required',
  minLength: (min: number) => `Must be at least ${min} characters long`,
  maxLength: (max: number) => `Must be no more than ${max} characters long`,
  min: (min: number) => `Must be at least ${min}`,
  max: (max: number) => `Must be no more than ${max}`,
  email: 'Must be a valid email address',
  url: 'Must be a valid URL',
  pattern: 'Invalid format',
  minItems: (min: number) => `Must have at least ${min} items`,
  maxItems: (max: number) => `Must have no more than ${max} items`
};

// ========================
// Hook Implementation
// ========================

export const useFormValidation = (
  schema: ValidationSchema,
  formData: Record<string, any>,
  options: UseFormValidationOptions = {}
): UseFormValidationReturn => {
  const {
    validateOnChange = true,
    validateOnBlur = true,
    debounceMs = 300,
    showErrorsImmediately = false
  } = options;

  // State management
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());
  const [isDirty, setIsDirty] = useState(false);

  // Refs for debouncing
  const validationTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const previousFormData = useRef<Record<string, any>>(formData);

  // Single field validation
  const validateSingleField = useCallback((field: string, value: any): string | null => {
    const rule = schema[field];
    if (!rule) return null;

    // Required validation
    if (rule.required) {
      if (value === undefined || value === null || value === '') {
        return DEFAULT_MESSAGES.required;
      }

      // For arrays
      if (Array.isArray(value) && value.length === 0) {
        return DEFAULT_MESSAGES.required;
      }
    }

    // Skip other validations if field is empty and not required
    if (!rule.required && (value === undefined || value === null || value === '')) {
      return null;
    }

    // String validations
    if (typeof value === 'string') {
      if (rule.minLength && value.length < rule.minLength) {
        return DEFAULT_MESSAGES.minLength(rule.minLength);
      }

      if (rule.maxLength && value.length > rule.maxLength) {
        return DEFAULT_MESSAGES.maxLength(rule.maxLength);
      }

      if (rule.email && !isValidEmail(value)) {
        return DEFAULT_MESSAGES.email;
      }

      if (rule.url && !isValidUrl(value)) {
        return DEFAULT_MESSAGES.url;
      }

      if (rule.pattern && !rule.pattern.test(value)) {
        return DEFAULT_MESSAGES.pattern;
      }
    }

    // Number validations
    if (typeof value === 'number') {
      if (rule.min !== undefined && value < rule.min) {
        return DEFAULT_MESSAGES.min(rule.min);
      }

      if (rule.max !== undefined && value > rule.max) {
        return DEFAULT_MESSAGES.max(rule.max);
      }
    }

    // Array validations
    if (Array.isArray(value)) {
      if (rule.minItems && value.length < rule.minItems) {
        return DEFAULT_MESSAGES.minItems(rule.minItems);
      }

      if (rule.maxItems && value.length > rule.maxItems) {
        return DEFAULT_MESSAGES.maxItems(rule.maxItems);
      }
    }

    // Custom validation
    if (rule.custom) {
      return rule.custom(value);
    }

    return null;
  }, [schema]);

  // Debounced field validation
  const debouncedValidateField = useMemo(
    () => debounce((field: string, value: any) => {
      const error = validateSingleField(field, value);
      setErrors(prev => ({
        ...prev,
        [field]: error || undefined
      }));
    }, debounceMs),
    [validateSingleField, debounceMs]
  );

  // Validate field immediately or with debounce
  const validateField = useCallback((field: string, value: any): string | null => {
    const error = validateSingleField(field, value);

    if (showErrorsImmediately || touchedFields.has(field)) {
      if (debounceMs > 0) {
        // Clear previous timeout
        const existingTimeout = validationTimeouts.current.get(field);
        if (existingTimeout) {
          clearTimeout(existingTimeout);
        }

        // Set new timeout
        const timeout = setTimeout(() => {
          setErrors(prev => ({
            ...prev,
            [field]: error || undefined
          }));
          validationTimeouts.current.delete(field);
        }, debounceMs);

        validationTimeouts.current.set(field, timeout);
      } else {
        setErrors(prev => ({
          ...prev,
          [field]: error || undefined
        }));
      }
    }

    return error;
  }, [validateSingleField, debounceMs, showErrorsImmediately, touchedFields]);

  // Validate all fields
  const validateAllFields = useCallback((): boolean => {
    const newErrors: ValidationErrors = {};
    let isFormValid = true;

    Object.keys(schema).forEach(field => {
      const value = formData[field];
      const error = validateSingleField(field, value);

      if (error) {
        newErrors[field] = error;
        isFormValid = false;
      }
    });

    setErrors(newErrors);
    return isFormValid;
  }, [schema, formData, validateSingleField]);

  // Set field as touched
  const setFieldTouched = useCallback((field: string) => {
    setTouchedFields(prev => new Set([...prev, field]));
    setIsDirty(true);
  }, []);

  // Set specific field error
  const setFieldError = useCallback((field: string, error: string | null) => {
    setErrors(prev => ({
      ...prev,
      [field]: error || undefined
    }));
  }, []);

  // Clear all errors
  const clearErrors = useCallback(() => {
    setErrors({});
  }, []);

  // Clear specific field error
  const clearFieldError = useCallback((field: string) => {
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[field];
      return newErrors;
    });
  }, []);

  // Reset validation state
  const reset = useCallback(() => {
    setErrors({});
    setTouchedFields(new Set());
    setIsDirty(false);

    // Clear any pending validations
    validationTimeouts.current.forEach(timeout => clearTimeout(timeout));
    validationTimeouts.current.clear();
  }, []);

  // Computed values
  const isValid = useMemo(() => {
    return Object.keys(errors).length === 0;
  }, [errors]);

  // Auto-validate on form data change
  useEffect(() => {
    if (!validateOnChange || !isDirty) return;

    // Check which fields changed
    const changedFields: string[] = [];
    Object.keys(formData).forEach(field => {
      if (formData[field] !== previousFormData.current[field]) {
        changedFields.push(field);
      }
    });

    // Validate changed fields that are touched
    changedFields.forEach(field => {
      if (touchedFields.has(field) || showErrorsImmediately) {
        validateField(field, formData[field]);
      }
    });

    previousFormData.current = { ...formData };
  }, [formData, validateOnChange, validateField, isDirty, touchedFields, showErrorsImmediately]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      validationTimeouts.current.forEach(timeout => clearTimeout(timeout));
      validationTimeouts.current.clear();
    };
  }, []);

  return {
    errors,
    isValid,
    isDirty,
    touchedFields,
    validate: validateAllFields,
    validateField,
    setFieldTouched,
    setFieldError,
    clearErrors,
    clearFieldError,
    reset
  };
};

// ========================
// Utility Functions
// ========================

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export default useFormValidation;