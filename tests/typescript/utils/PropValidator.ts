/**
 * PropValidator - React component prop validation utilities
 *
 * This module provides utilities for:
 * - React component prop validation
 * - Required vs optional prop checking
 * - Default prop type validation
 * - Prop type inference helpers
 *
 * @example
 * ```typescript
 * import { PropValidator, validateProps, inferProps } from './PropValidator';
 *
 * interface ButtonProps {
 *   label: string;
 *   onClick: () => void;
 *   disabled?: boolean;
 *   variant?: 'primary' | 'secondary';
 * }
 *
 * const validator = new PropValidator<ButtonProps>();
 * validator.validateRequired({ label: 'Click me', onClick: () => {} }); // ✓
 * validator.validateOptional({ disabled: true }); // ✓
 * ```
 */

import React, { ComponentProps, ComponentType } from 'react';
import { TypeChecker } from './TypeChecker';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Extract required properties from a type
 */
export type RequiredProps<T> = {
  [K in keyof T as T[K] extends undefined ? never : K]: T[K];
};

/**
 * Extract optional properties from a type
 */
export type OptionalProps<T> = {
  [K in keyof T as T[K] extends undefined ? K : never]?: T[K];
};

/**
 * Extract default props type
 */
export type DefaultProps<T> = Partial<T>;

/**
 * Prop validation schema definition
 */
export interface PropSchema<T> {
  [K in keyof T]: {
    type: string;
    required: boolean;
    validator?: (value: unknown) => value is T[K];
    defaultValue?: T[K];
    description?: string;
  };
}

/**
 * Prop validation result
 */
export interface PropValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * React component prop validator class
 */
export class PropValidator<T extends Record<string, any>> {
  private typeChecker = new TypeChecker();
  private schema?: PropSchema<T>;

  constructor(schema?: PropSchema<T>) {
    this.schema = schema;
  }

  /**
   * Validates required properties
   */
  validateRequired(props: unknown): props is RequiredProps<T> {
    if (!this.typeChecker.validateObject(props)) {
      return false;
    }

    if (!this.schema) {
      return true;
    }

    for (const [key, config] of Object.entries(this.schema)) {
      if (config.required && !(key in props)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Validates optional properties
   */
  validateOptional(props: unknown): props is OptionalProps<T> {
    if (!this.typeChecker.validateObject(props)) {
      return false;
    }

    if (!this.schema) {
      return true;
    }

    for (const [key, value] of Object.entries(props)) {
      const config = this.schema[key as keyof T];
      if (config && config.validator && value !== undefined) {
        if (!config.validator(value)) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Comprehensive prop validation with detailed results
   */
  validateProps(props: unknown): PropValidationResult {
    const result: PropValidationResult = {
      valid: true,
      errors: [],
      warnings: []
    };

    if (!this.typeChecker.validateObject(props)) {
      result.valid = false;
      result.errors.push('Props must be an object');
      return result;
    }

    if (!this.schema) {
      return result;
    }

    // Check required props
    for (const [key, config] of Object.entries(this.schema)) {
      const value = (props as any)[key];

      if (config.required && value === undefined) {
        result.valid = false;
        result.errors.push(`Required prop '${key}' is missing`);
        continue;
      }

      // Validate type if value is provided
      if (value !== undefined && config.validator) {
        if (!config.validator(value)) {
          result.valid = false;
          result.errors.push(`Prop '${key}' has invalid type. Expected ${config.type}`);
        }
      }
    }

    // Check for unknown props
    for (const key of Object.keys(props)) {
      if (!(key in this.schema)) {
        result.warnings.push(`Unknown prop '${key}' provided`);
      }
    }

    return result;
  }

  /**
   * Applies default values to props
   */
  applyDefaults(props: Partial<T>): T {
    if (!this.schema) {
      return props as T;
    }

    const result = { ...props };

    for (const [key, config] of Object.entries(this.schema)) {
      if (config.defaultValue !== undefined && (result as any)[key] === undefined) {
        (result as any)[key] = config.defaultValue;
      }
    }

    return result as T;
  }

  /**
   * Creates a type-safe prop validation function
   */
  createValidator(): (props: unknown) => props is T {
    return (props: unknown): props is T => {
      const result = this.validateProps(props);
      return result.valid;
    };
  }

  /**
   * Validates prop types against React component
   */
  validateComponentProps<C extends ComponentType<any>>(
    component: C,
    props: unknown
  ): props is ComponentProps<C> {
    // Basic validation - in practice, you'd want more sophisticated checks
    return this.typeChecker.validateObject(props);
  }
}

/**
 * Common prop type validators
 */
export const PropTypeValidators = {
  string: (value: unknown): value is string => typeof value === 'string',
  number: (value: unknown): value is number => typeof value === 'number' && !isNaN(value),
  boolean: (value: unknown): value is boolean => typeof value === 'boolean',
  function: (value: unknown): value is Function => typeof value === 'function',
  array: <T>(elementValidator?: (item: unknown) => item is T) =>
    (value: unknown): value is T[] => {
      if (!Array.isArray(value)) return false;
      if (!elementValidator) return true;
      return value.every(elementValidator);
    },
  object: (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value),
  oneOf: <T extends readonly unknown[]>(values: T) =>
    (value: unknown): value is T[number] => values.includes(value as any),
  oneOfType: <T>(validators: Array<(val: unknown) => val is any>) =>
    (value: unknown): value is T => validators.some(validator => validator(value)),
  arrayOf: <T>(validator: (val: unknown) => val is T) =>
    (value: unknown): value is T[] => Array.isArray(value) && value.every(validator),
  shape: <T>(shape: { [K in keyof T]: (val: unknown) => val is T[K] }) =>
    (value: unknown): value is T => {
      if (typeof value !== 'object' || value === null) return false;
      return Object.entries(shape).every(([key, validator]) =>
        validator((value as any)[key])
      );
    },
  instanceOf: <T>(constructor: new (...args: any[]) => T) =>
    (value: unknown): value is T => value instanceof constructor,
  node: (value: unknown): value is React.ReactNode => {
    return value === null ||
           value === undefined ||
           typeof value === 'string' ||
           typeof value === 'number' ||
           typeof value === 'boolean' ||
           React.isValidElement(value) ||
           Array.isArray(value);
  },
  element: (value: unknown): value is React.ReactElement => React.isValidElement(value),
  elementType: (value: unknown): value is React.ElementType =>
    typeof value === 'string' || typeof value === 'function'
};

/**
 * Helper function to create prop schemas
 */
export function createPropSchema<T extends Record<string, any>>(
  schema: PropSchema<T>
): PropSchema<T> {
  return schema;
}

/**
 * Helper function to infer prop types from component
 */
export function inferProps<C extends ComponentType<any>>(
  component: C
): ComponentProps<C> {
  return {} as ComponentProps<C>;
}

/**
 * Utility to validate props with a schema
 */
export function validateProps<T extends Record<string, any>>(
  props: unknown,
  schema: PropSchema<T>
): PropValidationResult {
  const validator = new PropValidator(schema);
  return validator.validateProps(props);
}

/**
 * HOC for runtime prop validation in development
 */
export function withPropValidation<P extends Record<string, any>>(
  Component: ComponentType<P>,
  schema: PropSchema<P>
) {
  const validator = new PropValidator(schema);

  return function ValidatedComponent(props: P) {
    if (process.env.NODE_ENV === 'development') {
      const result = validator.validateProps(props);

      if (!result.valid) {
        console.error(`PropValidation failed for ${Component.displayName || Component.name}:`, result.errors);
      }

      if (result.warnings.length > 0) {
        console.warn(`PropValidation warnings for ${Component.displayName || Component.name}:`, result.warnings);
      }
    }

    return React.createElement(Component, props);
  };
}

/**
 * Example schemas and usage
 */
export namespace PropValidationExamples {
  // Button component props
  interface ButtonProps {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    variant?: 'primary' | 'secondary' | 'danger';
    size?: 'small' | 'medium' | 'large';
    children?: React.ReactNode;
  }

  export const buttonSchema = createPropSchema<ButtonProps>({
    label: {
      type: 'string',
      required: true,
      validator: PropTypeValidators.string,
      description: 'Button label text'
    },
    onClick: {
      type: 'function',
      required: true,
      validator: PropTypeValidators.function,
      description: 'Click event handler'
    },
    disabled: {
      type: 'boolean',
      required: false,
      validator: PropTypeValidators.boolean,
      defaultValue: false,
      description: 'Whether button is disabled'
    },
    variant: {
      type: "'primary' | 'secondary' | 'danger'",
      required: false,
      validator: PropTypeValidators.oneOf(['primary', 'secondary', 'danger'] as const),
      defaultValue: 'primary',
      description: 'Button visual variant'
    },
    size: {
      type: "'small' | 'medium' | 'large'",
      required: false,
      validator: PropTypeValidators.oneOf(['small', 'medium', 'large'] as const),
      defaultValue: 'medium',
      description: 'Button size'
    },
    children: {
      type: 'ReactNode',
      required: false,
      validator: PropTypeValidators.node,
      description: 'Button content'
    }
  });

  // Input component props
  interface InputProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    type?: 'text' | 'password' | 'email' | 'number';
    required?: boolean;
    error?: string;
  }

  export const inputSchema = createPropSchema<InputProps>({
    value: {
      type: 'string',
      required: true,
      validator: PropTypeValidators.string,
      description: 'Input value'
    },
    onChange: {
      type: 'function',
      required: true,
      validator: PropTypeValidators.function,
      description: 'Value change handler'
    },
    placeholder: {
      type: 'string',
      required: false,
      validator: PropTypeValidators.string,
      description: 'Input placeholder text'
    },
    type: {
      type: "'text' | 'password' | 'email' | 'number'",
      required: false,
      validator: PropTypeValidators.oneOf(['text', 'password', 'email', 'number'] as const),
      defaultValue: 'text',
      description: 'Input type'
    },
    required: {
      type: 'boolean',
      required: false,
      validator: PropTypeValidators.boolean,
      defaultValue: false,
      description: 'Whether input is required'
    },
    error: {
      type: 'string',
      required: false,
      validator: PropTypeValidators.string,
      description: 'Error message'
    }
  });

  // Usage examples
  export const buttonValidator = new PropValidator(buttonSchema);
  export const inputValidator = new PropValidator(inputSchema);

  // Test cases
  export const testButtonProps = () => {
    const validProps = { label: 'Click me', onClick: () => {} };
    const invalidProps = { label: 123, onClick: 'not-a-function' };

    console.log('Valid button props:', buttonValidator.validateProps(validProps));
    console.log('Invalid button props:', buttonValidator.validateProps(invalidProps));
  };
}

export default PropValidator;