import { useState, useCallback, useEffect, useRef } from 'react';
import { debounce } from 'lodash';

export interface ValidationRule<T = any> {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: T, formData?: any) => string | Promise<string> | null;
  message?: string;
}

export interface ValidationSchema {
  [key: string]: ValidationRule | ValidationRule[];
}

export interface UseFormValidationOptions {
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
  debounceMs?: number;
  schema?: ValidationSchema;
  onValidationChange?: (isValid: boolean, errors: Record<string, string>) => void;
}

export interface FormValidationResult {
  values: Record<string, any>;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  isValid: boolean;
  isValidating: boolean;
  setValue: (field: string, value: any) => void;
  setFieldError: (field: string, error: string | null) => void;
  setFieldTouched: (field: string, touched: boolean) => void;
  validateField: (field: string) => Promise<boolean>;
  validateForm: () => Promise<boolean>;
  reset: (newValues?: Record<string, any>) => void;
  getFieldProps: (field: string) => {
    name: string;
    value: any;
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
    onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
    'aria-invalid': boolean;
    'aria-describedby': string;
  };
  getFieldError: (field: string) => string | undefined;
  getFieldHelp: (field: string) => string;
}

export const useFormValidation = (
  initialValues: Record<string, any> = {},
  options: UseFormValidationOptions = {}
): FormValidationResult => {
  const {
    validateOnChange = true,
    validateOnBlur = true,
    debounceMs = 300,
    schema = {},
    onValidationChange
  } = options;

  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isValidating, setIsValidating] = useState(false);

  const validationTimeouts = useRef<Record<string, NodeJS.Timeout>>({});
  const mountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      Object.values(validationTimeouts.current).forEach(clearTimeout);
    };
  }, []);

  // Calculate overall validity
  const isValid = Object.keys(errors).length === 0;

  // Notify parent of validation changes
  useEffect(() => {
    onValidationChange?.(isValid, errors);
  }, [isValid, errors, onValidationChange]);

  // Validation functions
  const validateValue = useCallback(async (
    field: string,
    value: any,
    currentFormData: Record<string, any>
  ): Promise<string | null> => {
    const rules = schema[field];
    if (!rules) return null;

    const ruleArray = Array.isArray(rules) ? rules : [rules];

    for (const rule of ruleArray) {
      // Required validation
      if (rule.required && (!value || (typeof value === 'string' && !value.trim()))) {
        return rule.message || `${field} is required`;
      }

      // Skip other validations if value is empty and not required
      if (!value || (typeof value === 'string' && !value.trim())) {
        continue;
      }

      // Min length validation
      if (rule.minLength && typeof value === 'string' && value.length < rule.minLength) {
        return rule.message || `${field} must be at least ${rule.minLength} characters`;
      }

      // Max length validation
      if (rule.maxLength && typeof value === 'string' && value.length > rule.maxLength) {
        return rule.message || `${field} must be no more than ${rule.maxLength} characters`;
      }

      // Pattern validation
      if (rule.pattern && typeof value === 'string' && !rule.pattern.test(value)) {
        return rule.message || `${field} format is invalid`;
      }

      // Custom validation
      if (rule.custom) {
        try {
          const result = await rule.custom(value, currentFormData);
          if (result) return result;
        } catch (error) {
          console.error(`Custom validation error for ${field}:`, error);
          return 'Validation error occurred';
        }
      }
    }

    return null;
  }, [schema]);

  // Debounced validation
  const debouncedValidateField = useCallback(
    debounce(async (field: string, value: any, formData: Record<string, any>) => {
      if (!mountedRef.current) return;

      setIsValidating(true);
      try {
        const error = await validateValue(field, value, formData);

        if (!mountedRef.current) return;

        setErrors(prev => {
          const newErrors = { ...prev };
          if (error) {
            newErrors[field] = error;
          } else {
            delete newErrors[field];
          }
          return newErrors;
        });
      } catch (error) {
        console.error(`Validation error for ${field}:`, error);
      } finally {
        if (mountedRef.current) {
          setIsValidating(false);
        }
      }
    }, debounceMs),
    [validateValue, debounceMs]
  );

  // Manual field validation
  const validateField = useCallback(async (field: string): Promise<boolean> => {
    setIsValidating(true);
    try {
      const error = await validateValue(field, values[field], values);

      setErrors(prev => {
        const newErrors = { ...prev };
        if (error) {
          newErrors[field] = error;
        } else {
          delete newErrors[field];
        }
        return newErrors;
      });

      return !error;
    } catch (error) {
      console.error(`Validation error for ${field}:`, error);
      return false;
    } finally {
      setIsValidating(false);
    }
  }, [validateValue, values]);

  // Validate entire form
  const validateForm = useCallback(async (): Promise<boolean> => {
    setIsValidating(true);
    const newErrors: Record<string, string> = {};

    try {
      const validationPromises = Object.keys(schema).map(async (field) => {
        const error = await validateValue(field, values[field], values);
        return { field, error };
      });

      const results = await Promise.all(validationPromises);

      results.forEach(({ field, error }) => {
        if (error) {
          newErrors[field] = error;
        }
      });

      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    } catch (error) {
      console.error('Form validation error:', error);
      return false;
    } finally {
      setIsValidating(false);
    }
  }, [schema, values, validateValue]);

  // Set field value
  const setValue = useCallback((field: string, value: any) => {
    setValues(prev => ({ ...prev, [field]: value }));

    if (validateOnChange) {
      // Clear any existing timeout
      if (validationTimeouts.current[field]) {
        clearTimeout(validationTimeouts.current[field]);
      }

      // Set new timeout for validation
      validationTimeouts.current[field] = setTimeout(() => {
        debouncedValidateField(field, value, { ...values, [field]: value });
      }, debounceMs);
    }
  }, [validateOnChange, debouncedValidateField, values, debounceMs]);

  // Set field error
  const setFieldError = useCallback((field: string, error: string | null) => {
    setErrors(prev => {
      const newErrors = { ...prev };
      if (error) {
        newErrors[field] = error;
      } else {
        delete newErrors[field];
      }
      return newErrors;
    });
  }, []);

  // Set field touched
  const setFieldTouched = useCallback((field: string, isTouched: boolean) => {
    setTouched(prev => ({ ...prev, [field]: isTouched }));
  }, []);

  // Reset form
  const reset = useCallback((newValues?: Record<string, any>) => {
    setValues(newValues || initialValues);
    setErrors({});
    setTouched({});
    setIsValidating(false);

    // Clear any pending validations
    Object.values(validationTimeouts.current).forEach(clearTimeout);
    validationTimeouts.current = {};
  }, [initialValues]);

  // Get field props for easy integration
  const getFieldProps = useCallback((field: string) => ({
    name: field,
    value: values[field] || '',
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setValue(field, e.target.value);
    },
    onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setFieldTouched(field, true);
      if (validateOnBlur) {
        validateField(field);
      }
    },
    'aria-invalid': !!errors[field],
    'aria-describedby': `${field}-error ${field}-help`
  }), [values, setValue, setFieldTouched, validateOnBlur, validateField, errors]);

  // Get field error
  const getFieldError = useCallback((field: string): string | undefined => {
    return touched[field] ? errors[field] : undefined;
  }, [errors, touched]);

  // Get field help text ID
  const getFieldHelp = useCallback((field: string): string => {
    return `${field}-help`;
  }, []);

  return {
    values,
    errors,
    touched,
    isValid,
    isValidating,
    setValue,
    setFieldError,
    setFieldTouched,
    validateField,
    validateForm,
    reset,
    getFieldProps,
    getFieldError,
    getFieldHelp
  };
};

// Validation schema builders
export const createValidationSchema = (): ValidationSchema => ({});

export const required = (message?: string): ValidationRule => ({
  required: true,
  message
});

export const minLength = (min: number, message?: string): ValidationRule => ({
  minLength: min,
  message
});

export const maxLength = (max: number, message?: string): ValidationRule => ({
  maxLength: max,
  message
});

export const pattern = (regex: RegExp, message?: string): ValidationRule => ({
  pattern: regex,
  message
});

export const custom = (
  validator: (value: any, formData?: any) => string | Promise<string> | null,
  message?: string
): ValidationRule => ({
  custom: validator,
  message
});

// Common validation patterns
export const validationPatterns = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone: /^\+?[\d\s\-\(\)]+$/,
  url: /^https?:\/\/.+/,
  alphanumeric: /^[a-zA-Z0-9]+$/,
  noSpecialChars: /^[a-zA-Z0-9\s]+$/
};

// Mainframe-specific validation rules
export const mainframeValidation = {
  jobName: pattern(/^[A-Z][A-Z0-9]{1,7}$/, 'Job name must be 2-8 characters, start with letter, uppercase alphanumeric only'),
  datasetName: pattern(/^[A-Z][A-Z0-9@#$]{0,7}(\.[A-Z][A-Z0-9@#$]{0,7}){0,21}$/, 'Invalid dataset name format'),
  stepName: pattern(/^[A-Z][A-Z0-9]{0,7}$/, 'Step name must be 1-8 characters, start with letter, uppercase alphanumeric only'),
  programName: pattern(/^[A-Z][A-Z0-9]{0,7}$/, 'Program name must be 1-8 characters, start with letter, uppercase alphanumeric only'),
  errorCode: pattern(/^[A-Z0-9]{3,8}$/, 'Error code must be 3-8 uppercase alphanumeric characters')
};

export default useFormValidation;