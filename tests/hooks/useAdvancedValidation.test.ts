/**
 * Test suite for useAdvancedValidation hook
 * Tests debounced validation, async validation, and cross-field validation
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useAdvancedValidation } from '../../implementation/frontend/hooks/useAdvancedValidation';

// Mock lodash debounce
jest.mock('lodash', () => ({
  debounce: (fn: any, delay: number) => {
    const debouncedFn = (...args: any[]) => {
      clearTimeout(debouncedFn._timeoutId);
      debouncedFn._timeoutId = setTimeout(() => fn(...args), delay);
    };
    debouncedFn.cancel = () => clearTimeout(debouncedFn._timeoutId);
    return debouncedFn;
  }
}));

interface TestFormData {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  age: number;
}

describe('useAdvancedValidation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('Basic Functionality', () => {
    test('initializes with default values', () => {
      const defaultValues: Partial<TestFormData> = {
        username: 'testuser',
        email: '',
        password: '',
        confirmPassword: '',
        age: 0
      };

      const { result } = renderHook(() =>
        useAdvancedValidation<TestFormData>({
          defaultValues
        })
      );

      expect(result.current.formState.data).toEqual(defaultValues);
      expect(result.current.isValid).toBe(true);
      expect(result.current.isAsyncValidating).toBe(false);
      expect(result.current.asyncErrors).toEqual({});
      expect(result.current.crossFieldErrors).toEqual({});
    });

    test('updates form data and validates synchronously', async () => {
      const validationRules = {
        username: {
          required: true,
          minLength: 3,
          custom: (value: string) => {
            if (value === 'admin') return 'Username "admin" is not allowed';
            return undefined;
          }
        }
      };

      const { result } = renderHook(() =>
        useAdvancedValidation<TestFormData>({
          validationRules,
          validateOnChange: true
        })
      );

      // Set invalid value
      act(() => {
        result.current.setValue('username', 'ab');
      });

      expect(result.current.formState.errors.username?.message).toBe('Must be at least 3 characters');
      expect(result.current.isValid).toBe(false);

      // Set valid value
      act(() => {
        result.current.setValue('username', 'validuser');
      });

      expect(result.current.formState.errors.username).toBeUndefined();
      expect(result.current.isValid).toBe(true);

      // Test custom validation
      act(() => {
        result.current.setValue('username', 'admin');
      });

      expect(result.current.formState.errors.username?.message).toBe('Username "admin" is not allowed');
    });
  });

  describe('Async Validation', () => {
    test('performs async validation with debouncing', async () => {
      const mockAsyncValidator = jest.fn()
        .mockResolvedValueOnce('Username already exists')
        .mockResolvedValueOnce(undefined); // Success

      const asyncValidationRules = {
        username: {
          validator: mockAsyncValidator,
          debounceMs: 300
        }
      };

      const { result } = renderHook(() =>
        useAdvancedValidation<TestFormData>({
          asyncValidationRules,
          enableAsyncValidation: true,
          debounceMs: 300
        })
      );

      // Set value that will trigger async validation
      act(() => {
        result.current.setValue('username', 'existinguser');
      });

      expect(result.current.isAsyncValidating).toBe(false);
      expect(mockAsyncValidator).not.toHaveBeenCalled();

      // Fast-forward debounce timer
      act(() => {
        jest.advanceTimersByTime(300);
      });

      expect(result.current.isAsyncValidating).toBe(true);

      // Wait for async validation to complete
      await waitFor(() => {
        expect(result.current.isAsyncValidating).toBe(false);
      });

      expect(mockAsyncValidator).toHaveBeenCalledWith('existinguser', expect.any(Object));
      expect(result.current.asyncErrors.username?.message).toBe('Username already exists');

      // Test successful validation
      act(() => {
        result.current.setValue('username', 'availableuser');
      });

      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(result.current.isAsyncValidating).toBe(false);
      });

      expect(result.current.asyncErrors.username).toBeUndefined();
    });

    test('cancels previous async validation when value changes quickly', async () => {
      let resolveFirst: (value: string | undefined) => void;
      let resolveSecond: (value: string | undefined) => void;

      const firstPromise = new Promise<string | undefined>(resolve => {
        resolveFirst = resolve;
      });

      const secondPromise = new Promise<string | undefined>(resolve => {
        resolveSecond = resolve;
      });

      const mockAsyncValidator = jest.fn()
        .mockReturnValueOnce(firstPromise)
        .mockReturnValueOnce(secondPromise);

      const { result } = renderHook(() =>
        useAdvancedValidation<TestFormData>({
          asyncValidationRules: {
            username: { validator: mockAsyncValidator, debounceMs: 100 }
          },
          enableAsyncValidation: true
        })
      );

      // First validation
      act(() => {
        result.current.setValue('username', 'first');
      });

      act(() => {
        jest.advanceTimersByTime(100);
      });

      // Second validation before first completes
      act(() => {
        result.current.setValue('username', 'second');
      });

      act(() => {
        jest.advanceTimersByTime(100);
      });

      // Resolve first validation (should be ignored)
      act(() => {
        resolveFirst('Error from first validation');
      });

      // Resolve second validation
      act(() => {
        resolveSecond('Error from second validation');
      });

      await waitFor(() => {
        expect(result.current.asyncErrors.username?.message).toBe('Error from second validation');
      });
    });

    test('handles async validation errors gracefully', async () => {
      const mockAsyncValidator = jest.fn().mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() =>
        useAdvancedValidation<TestFormData>({
          asyncValidationRules: {
            username: { validator: mockAsyncValidator }
          },
          enableAsyncValidation: true
        })
      );

      act(() => {
        result.current.setValue('username', 'testuser');
      });

      act(() => {
        jest.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(result.current.isAsyncValidating).toBe(false);
      });

      expect(result.current.asyncErrors.username?.message).toBe('Validation failed. Please try again.');
    });

    test('validateAsync validates specific field or all fields', async () => {
      const usernameValidator = jest.fn().mockResolvedValue('Username error');
      const emailValidator = jest.fn().mockResolvedValue(undefined);

      const { result } = renderHook(() =>
        useAdvancedValidation<TestFormData>({
          asyncValidationRules: {
            username: { validator: usernameValidator },
            email: { validator: emailValidator }
          },
          enableAsyncValidation: true
        })
      );

      // Set some data
      act(() => {
        result.current.setValue('username', 'testuser');
        result.current.setValue('email', 'test@example.com');
      });

      // Validate single field
      let isValid: boolean;
      await act(async () => {
        isValid = await result.current.validateAsync('username');
      });

      expect(isValid).toBe(false);
      expect(usernameValidator).toHaveBeenCalledTimes(1);
      expect(emailValidator).not.toHaveBeenCalled();

      // Validate all fields
      await act(async () => {
        isValid = await result.current.validateAsync();
      });

      expect(emailValidator).toHaveBeenCalledTimes(1);
      expect(result.current.asyncErrors.username?.message).toBe('Username error');
      expect(result.current.asyncErrors.email).toBeUndefined();
    });
  });

  describe('Cross-Field Validation', () => {
    test('validates cross-field dependencies', () => {
      const crossFieldValidationRules = [
        {
          fields: ['password', 'confirmPassword'] as Array<keyof TestFormData>,
          validator: (values: Partial<TestFormData>) => {
            if (values.password !== values.confirmPassword) {
              return 'Passwords do not match';
            }
            return undefined;
          },
          message: 'Passwords must match'
        }
      ];

      const { result } = renderHook(() =>
        useAdvancedValidation<TestFormData>({
          crossFieldValidationRules
        })
      );

      // Set mismatched passwords
      act(() => {
        result.current.setValue('password', 'password123');
        result.current.setValue('confirmPassword', 'different123');
      });

      expect(Object.keys(result.current.crossFieldErrors)).toHaveLength(1);
      expect(Object.values(result.current.crossFieldErrors)[0].message).toBe('Passwords do not match');
      expect(result.current.isValid).toBe(false);

      // Fix passwords
      act(() => {
        result.current.setValue('confirmPassword', 'password123');
      });

      expect(Object.keys(result.current.crossFieldErrors)).toHaveLength(0);
      expect(result.current.isValid).toBe(true);
    });

    test('multiple cross-field validation rules', () => {
      const crossFieldValidationRules = [
        {
          fields: ['password', 'confirmPassword'] as Array<keyof TestFormData>,
          validator: (values: Partial<TestFormData>) => {
            if (values.password && values.confirmPassword && values.password !== values.confirmPassword) {
              return 'Passwords do not match';
            }
            return undefined;
          },
          message: 'Passwords must match'
        },
        {
          fields: ['username', 'password'] as Array<keyof TestFormData>,
          validator: (values: Partial<TestFormData>) => {
            if (values.username === values.password) {
              return 'Password cannot be the same as username';
            }
            return undefined;
          },
          message: 'Password must be different from username'
        }
      ];

      const { result } = renderHook(() =>
        useAdvancedValidation<TestFormData>({
          crossFieldValidationRules
        })
      );

      // Set same username and password
      act(() => {
        result.current.setValue('username', 'testuser');
        result.current.setValue('password', 'testuser');
        result.current.setValue('confirmPassword', 'testuser');
      });

      expect(Object.keys(result.current.crossFieldErrors)).toHaveLength(1);
      expect(Object.values(result.current.crossFieldErrors)[0].message).toBe('Password cannot be the same as username');
    });
  });

  describe('Form Submission', () => {
    test('enhanced submit validates all types before submission', async () => {
      const mockOnSubmit = jest.fn().mockResolvedValue({ success: true });
      const mockAsyncValidator = jest.fn().mockResolvedValue(undefined);

      const { result } = renderHook(() =>
        useAdvancedValidation<TestFormData>({
          onSubmit: mockOnSubmit,
          validationRules: {
            username: { required: true }
          },
          asyncValidationRules: {
            email: { validator: mockAsyncValidator }
          },
          crossFieldValidationRules: [
            {
              fields: ['password', 'confirmPassword'] as Array<keyof TestFormData>,
              validator: (values: Partial<TestFormData>) => {
                if (values.password !== values.confirmPassword) {
                  return 'Passwords do not match';
                }
                return undefined;
              },
              message: 'Passwords must match'
            }
          ],
          enableAsyncValidation: true
        })
      );

      // Set valid data
      act(() => {
        result.current.setValue('username', 'testuser');
        result.current.setValue('email', 'test@example.com');
        result.current.setValue('password', 'password123');
        result.current.setValue('confirmPassword', 'password123');
      });

      // Submit form
      await act(async () => {
        await result.current.submit();
      });

      expect(mockAsyncValidator).toHaveBeenCalled();
      expect(mockOnSubmit).toHaveBeenCalled();
    });

    test('prevents submission when async validation fails', async () => {
      const mockOnSubmit = jest.fn();
      const mockAsyncValidator = jest.fn().mockResolvedValue('Async validation error');

      const { result } = renderHook(() =>
        useAdvancedValidation<TestFormData>({
          onSubmit: mockOnSubmit,
          asyncValidationRules: {
            username: { validator: mockAsyncValidator }
          },
          enableAsyncValidation: true
        })
      );

      act(() => {
        result.current.setValue('username', 'testuser');
      });

      await act(async () => {
        await result.current.submit();
      });

      expect(mockAsyncValidator).toHaveBeenCalled();
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    test('prevents submission when cross-field validation fails', async () => {
      const mockOnSubmit = jest.fn();

      const { result } = renderHook(() =>
        useAdvancedValidation<TestFormData>({
          onSubmit: mockOnSubmit,
          crossFieldValidationRules: [
            {
              fields: ['password', 'confirmPassword'] as Array<keyof TestFormData>,
              validator: (values: Partial<TestFormData>) => {
                if (values.password !== values.confirmPassword) {
                  return 'Passwords do not match';
                }
                return undefined;
              },
              message: 'Passwords must match'
            }
          ]
        })
      );

      // Set mismatched passwords
      act(() => {
        result.current.setValue('password', 'password123');
        result.current.setValue('confirmPassword', 'different123');
      });

      await act(async () => {
        await result.current.submit();
      });

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });
  });

  describe('Utility Functions', () => {
    test('clearAsyncError removes specific async error', async () => {
      const mockAsyncValidator = jest.fn().mockResolvedValue('Async error');

      const { result } = renderHook(() =>
        useAdvancedValidation<TestFormData>({
          asyncValidationRules: {
            username: { validator: mockAsyncValidator }
          },
          enableAsyncValidation: true
        })
      );

      // Trigger async validation error
      act(() => {
        result.current.setValue('username', 'testuser');
      });

      act(() => {
        jest.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(result.current.asyncErrors.username?.message).toBe('Async error');
      });

      // Clear the error
      act(() => {
        result.current.clearAsyncError('username');
      });

      expect(result.current.asyncErrors.username).toBeUndefined();
    });

    test('isValid considers all validation types', async () => {
      const { result } = renderHook(() =>
        useAdvancedValidation<TestFormData>({
          validationRules: {
            username: { required: true }
          },
          asyncValidationRules: {
            email: { validator: jest.fn().mockResolvedValue('Async error') }
          },
          crossFieldValidationRules: [
            {
              fields: ['password', 'confirmPassword'] as Array<keyof TestFormData>,
              validator: () => 'Cross-field error',
              message: 'Cross-field validation failed'
            }
          ],
          enableAsyncValidation: true
        })
      );

      // Initially invalid due to required field
      expect(result.current.isValid).toBe(false);

      // Set required field
      act(() => {
        result.current.setValue('username', 'testuser');
      });

      expect(result.current.isValid).toBe(false); // Still invalid due to cross-field

      // Fix cross-field issue
      act(() => {
        result.current.setValue('password', 'same');
        result.current.setValue('confirmPassword', 'same');
      });

      expect(result.current.isValid).toBe(false); // Still invalid due to async error

      // Trigger and wait for async validation
      act(() => {
        result.current.setValue('email', 'test@example.com');
      });

      act(() => {
        jest.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(result.current.isValid).toBe(false); // Invalid due to async error
      });
    });
  });
});