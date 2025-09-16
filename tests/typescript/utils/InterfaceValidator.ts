/**
 * InterfaceValidator - Interface compliance and structural type validation utilities
 *
 * This module provides utilities for:
 * - Interface compliance checking
 * - Structural type validation
 * - Duck typing verification
 * - Index signature validation
 *
 * @example
 * ```typescript
 * import { InterfaceValidator, validateInterface, checkDuckTyping } from './InterfaceValidator';
 *
 * interface User {
 *   id: string;
 *   name: string;
 *   email?: string;
 * }
 *
 * const validator = new InterfaceValidator<User>();
 * validator.validateInterface({ id: '1', name: 'John' }); // ✓
 * validator.validateStructural(someObject); // Duck typing check
 * ```
 */

import { TypeChecker } from './TypeChecker';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Interface property metadata
 */
export interface PropertyMetadata {
  name: string;
  type: string;
  required: boolean;
  validator?: (value: unknown) => boolean;
  description?: string;
}

/**
 * Interface definition for validation
 */
export interface InterfaceDefinition<T = any> {
  name: string;
  properties: { [K in keyof T]: PropertyMetadata };
  indexSignature?: {
    keyType: 'string' | 'number' | 'symbol';
    valueType: string;
    validator?: (value: unknown) => boolean;
  };
  extends?: string[];
}

/**
 * Validation result with detailed information
 */
export interface InterfaceValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  missingRequired: string[];
  extraProperties: string[];
  typeViolations: Array<{
    property: string;
    expected: string;
    actual: string;
  }>;
}

/**
 * Structural typing utilities
 */
export type KeysOfType<T, U> = {
  [K in keyof T]: T[K] extends U ? K : never;
}[keyof T];

export type RequiredKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? never : K;
}[keyof T];

export type OptionalKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? K : never;
}[keyof T];

export type PickRequired<T> = Pick<T, RequiredKeys<T>>;
export type PickOptional<T> = Pick<T, OptionalKeys<T>>;

/**
 * Duck typing utilities
 */
export type HasProperty<T, K extends PropertyKey> = K extends keyof T ? true : false;
export type HasMethod<T, K extends PropertyKey> = K extends keyof T ?
  T[K] extends (...args: any[]) => any ? true : false : false;

/**
 * Interface validator class for comprehensive validation
 */
export class InterfaceValidator<T extends Record<string, any>> {
  private typeChecker = new TypeChecker();
  private definition?: InterfaceDefinition<T>;

  constructor(definition?: InterfaceDefinition<T>) {
    this.definition = definition;
  }

  /**
   * Validates object against interface definition
   */
  validateInterface(obj: unknown): obj is T {
    const result = this.validateInterfaceDetailed(obj);
    return result.valid;
  }

  /**
   * Detailed interface validation with comprehensive results
   */
  validateInterfaceDetailed(obj: unknown): InterfaceValidationResult {
    const result: InterfaceValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      missingRequired: [],
      extraProperties: [],
      typeViolations: []
    };

    if (!this.typeChecker.validateObject(obj)) {
      result.valid = false;
      result.errors.push('Value must be an object');
      return result;
    }

    if (!this.definition) {
      return result;
    }

    const objKeys = Object.keys(obj);
    const definedKeys = Object.keys(this.definition.properties);

    // Check required properties
    for (const [propName, metadata] of Object.entries(this.definition.properties)) {
      const value = (obj as any)[propName];

      if (metadata.required && value === undefined) {
        result.valid = false;
        result.missingRequired.push(propName);
        result.errors.push(`Required property '${propName}' is missing`);
        continue;
      }

      // Validate type if property exists
      if (value !== undefined && metadata.validator) {
        if (!metadata.validator(value)) {
          result.valid = false;
          result.typeViolations.push({
            property: propName,
            expected: metadata.type,
            actual: typeof value
          });
          result.errors.push(`Property '${propName}' has invalid type. Expected ${metadata.type}, got ${typeof value}`);
        }
      }
    }

    // Check for extra properties
    for (const key of objKeys) {
      if (!definedKeys.includes(key)) {
        // Check if allowed by index signature
        if (this.definition.indexSignature) {
          const value = (obj as any)[key];
          if (this.definition.indexSignature.validator && !this.definition.indexSignature.validator(value)) {
            result.valid = false;
            result.errors.push(`Index property '${key}' has invalid type`);
          }
        } else {
          result.extraProperties.push(key);
          result.warnings.push(`Extra property '${key}' is not defined in interface`);
        }
      }
    }

    return result;
  }

  /**
   * Structural typing validation (duck typing)
   */
  validateStructural(obj: unknown): obj is T {
    if (!this.typeChecker.validateObject(obj)) {
      return false;
    }

    if (!this.definition) {
      return true;
    }

    // Check if object has all required properties with correct types
    for (const [propName, metadata] of Object.entries(this.definition.properties)) {
      if (metadata.required) {
        const value = (obj as any)[propName];
        if (value === undefined) {
          return false;
        }
        if (metadata.validator && !metadata.validator(value)) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Validates index signatures
   */
  validateIndexSignature(obj: unknown): boolean {
    if (!this.typeChecker.validateObject(obj) || !this.definition?.indexSignature) {
      return true;
    }

    const { indexSignature } = this.definition;
    const definedKeys = Object.keys(this.definition.properties);

    for (const [key, value] of Object.entries(obj)) {
      // Skip defined properties
      if (definedKeys.includes(key)) {
        continue;
      }

      // Validate key type
      if (indexSignature.keyType === 'string' && typeof key !== 'string') {
        return false;
      }
      if (indexSignature.keyType === 'number' && !Number.isInteger(Number(key))) {
        return false;
      }

      // Validate value type
      if (indexSignature.validator && !indexSignature.validator(value)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Checks if object implements a specific method signature
   */
  implementsMethod<K extends keyof T>(
    obj: unknown,
    methodName: K,
    signature?: (...args: any[]) => any
  ): obj is T & Record<K, Function> {
    if (!this.typeChecker.validateObject(obj)) {
      return false;
    }

    const method = (obj as any)[methodName];
    if (typeof method !== 'function') {
      return false;
    }

    // Basic signature check (in practice, you'd want more sophisticated checks)
    if (signature && method.length !== signature.length) {
      return false;
    }

    return true;
  }

  /**
   * Creates a type guard for the interface
   */
  createTypeGuard(): (obj: unknown) => obj is T {
    return (obj: unknown): obj is T => this.validateInterface(obj);
  }

  /**
   * Validates inheritance hierarchy
   */
  validateInheritance(obj: unknown, baseInterfaces: InterfaceValidator<any>[]): boolean {
    // Check if object satisfies all base interfaces
    return baseInterfaces.every(validator => validator.validateStructural(obj));
  }
}

/**
 * Common interface validation utilities
 */
export namespace InterfaceValidationUtils {
  /**
   * Creates property metadata for common types
   */
  export const PropertyTypes = {
    string: (required = true): PropertyMetadata => ({
      name: '',
      type: 'string',
      required,
      validator: (value): value is string => typeof value === 'string'
    }),

    number: (required = true): PropertyMetadata => ({
      name: '',
      type: 'number',
      required,
      validator: (value): value is number => typeof value === 'number' && !isNaN(value)
    }),

    boolean: (required = true): PropertyMetadata => ({
      name: '',
      type: 'boolean',
      required,
      validator: (value): value is boolean => typeof value === 'boolean'
    }),

    array: <T>(elementValidator?: (item: unknown) => item is T, required = true): PropertyMetadata => ({
      name: '',
      type: 'array',
      required,
      validator: (value): value is T[] => {
        if (!Array.isArray(value)) return false;
        if (!elementValidator) return true;
        return value.every(elementValidator);
      }
    }),

    object: (required = true): PropertyMetadata => ({
      name: '',
      type: 'object',
      required,
      validator: (value): value is Record<string, unknown> =>
        typeof value === 'object' && value !== null && !Array.isArray(value)
    }),

    function: (required = true): PropertyMetadata => ({
      name: '',
      type: 'function',
      required,
      validator: (value): value is Function => typeof value === 'function'
    }),

    date: (required = true): PropertyMetadata => ({
      name: '',
      type: 'Date',
      required,
      validator: (value): value is Date => value instanceof Date && !isNaN(value.getTime())
    }),

    union: <T>(validators: Array<(val: unknown) => val is any>, required = true): PropertyMetadata => ({
      name: '',
      type: 'union',
      required,
      validator: (value): value is T => validators.some(validator => validator(value))
    }),

    literal: <T extends string | number | boolean>(literalValue: T, required = true): PropertyMetadata => ({
      name: '',
      type: `literal(${literalValue})`,
      required,
      validator: (value): value is T => value === literalValue
    })
  };

  /**
   * Helper to create interface definitions
   */
  export function createInterface<T extends Record<string, any>>(
    name: string,
    properties: { [K in keyof T]: PropertyMetadata }
  ): InterfaceDefinition<T> {
    return {
      name,
      properties,
    };
  }

  /**
   * Helper to create interface with index signature
   */
  export function createIndexedInterface<T extends Record<string, any>>(
    name: string,
    properties: { [K in keyof T]: PropertyMetadata },
    indexSignature: InterfaceDefinition['indexSignature']
  ): InterfaceDefinition<T> {
    return {
      name,
      properties,
      indexSignature
    };
  }
}

/**
 * Duck typing validation utilities
 */
export class DuckTypingValidator {
  private typeChecker = new TypeChecker();

  /**
   * Checks if object has specific properties
   */
  hasProperties<T extends Record<string, any>>(
    obj: unknown,
    properties: (keyof T)[]
  ): obj is T {
    if (!this.typeChecker.validateObject(obj)) {
      return false;
    }

    return properties.every(prop => prop in obj);
  }

  /**
   * Checks if object has specific methods
   */
  hasMethods<T extends Record<string, Function>>(
    obj: unknown,
    methods: (keyof T)[]
  ): obj is T {
    if (!this.typeChecker.validateObject(obj)) {
      return false;
    }

    return methods.every(method =>
      method in obj && typeof (obj as any)[method] === 'function'
    );
  }

  /**
   * Checks if object behaves like a specific interface (duck typing)
   */
  behavesLike<T>(
    obj: unknown,
    shape: {
      properties?: (keyof T)[];
      methods?: (keyof T)[];
      customChecks?: Array<(obj: any) => boolean>;
    }
  ): obj is T {
    if (!this.typeChecker.validateObject(obj)) {
      return false;
    }

    // Check properties
    if (shape.properties && !this.hasProperties(obj, shape.properties)) {
      return false;
    }

    // Check methods
    if (shape.methods && !this.hasMethods(obj, shape.methods)) {
      return false;
    }

    // Custom checks
    if (shape.customChecks && !shape.customChecks.every(check => check(obj))) {
      return false;
    }

    return true;
  }
}

/**
 * Utility functions for interface validation
 */

/**
 * Creates an interface validator with definition
 */
export function createInterfaceValidator<T extends Record<string, any>>(
  definition: InterfaceDefinition<T>
): InterfaceValidator<T> {
  return new InterfaceValidator(definition);
}

/**
 * Validates object against interface definition
 */
export function validateInterface<T extends Record<string, any>>(
  obj: unknown,
  definition: InterfaceDefinition<T>
): obj is T {
  const validator = new InterfaceValidator(definition);
  return validator.validateInterface(obj);
}

/**
 * Duck typing check
 */
export function checkDuckTyping<T>(
  obj: unknown,
  shape: {
    properties?: (keyof T)[];
    methods?: (keyof T)[];
    customChecks?: Array<(obj: any) => boolean>;
  }
): obj is T {
  const validator = new DuckTypingValidator();
  return validator.behavesLike(obj, shape);
}

/**
 * Example interfaces and usage
 */
export namespace InterfaceExamples {
  // User interface
  interface User {
    id: string;
    name: string;
    email?: string;
    age: number;
    preferences: Record<string, any>;
  }

  export const userDefinition = InterfaceValidationUtils.createInterface<User>('User', {
    id: { ...InterfaceValidationUtils.PropertyTypes.string(), name: 'id' },
    name: { ...InterfaceValidationUtils.PropertyTypes.string(), name: 'name' },
    email: { ...InterfaceValidationUtils.PropertyTypes.string(false), name: 'email' },
    age: { ...InterfaceValidationUtils.PropertyTypes.number(), name: 'age' },
    preferences: { ...InterfaceValidationUtils.PropertyTypes.object(), name: 'preferences' }
  });

  // API Response interface
  interface ApiResponse<T> {
    data?: T;
    error?: string;
    loading: boolean;
    timestamp: Date;
    [key: string]: any; // Index signature
  }

  export const apiResponseDefinition = InterfaceValidationUtils.createIndexedInterface<ApiResponse<any>>('ApiResponse', {
    data: { ...InterfaceValidationUtils.PropertyTypes.object(false), name: 'data' },
    error: { ...InterfaceValidationUtils.PropertyTypes.string(false), name: 'error' },
    loading: { ...InterfaceValidationUtils.PropertyTypes.boolean(), name: 'loading' },
    timestamp: { ...InterfaceValidationUtils.PropertyTypes.date(), name: 'timestamp' }
  }, {
    keyType: 'string',
    valueType: 'any',
    validator: () => true // Allow any additional properties
  });

  // Event interface for duck typing
  interface EventLike {
    type: string;
    target: any;
    preventDefault(): void;
    stopPropagation(): void;
  }

  export const eventValidator = new DuckTypingValidator();

  export const isEventLike = (obj: unknown): obj is EventLike => {
    return eventValidator.behavesLike<EventLike>(obj, {
      properties: ['type', 'target'],
      methods: ['preventDefault', 'stopPropagation']
    });
  };

  // Usage examples
  export const testExamples = () => {
    const userValidator = new InterfaceValidator(userDefinition);
    const apiValidator = new InterfaceValidator(apiResponseDefinition);

    // Test valid user
    const validUser = {
      id: '123',
      name: 'John Doe',
      email: 'john@example.com',
      age: 30,
      preferences: { theme: 'dark' }
    };

    // Test invalid user
    const invalidUser = {
      id: 123, // Should be string
      name: 'John Doe',
      // missing age
      preferences: 'not-an-object' // Should be object
    };

    console.log('Valid user:', userValidator.validateInterfaceDetailed(validUser));
    console.log('Invalid user:', userValidator.validateInterfaceDetailed(invalidUser));

    // Test duck typing
    const eventLikeObject = {
      type: 'click',
      target: document.body,
      preventDefault: () => {},
      stopPropagation: () => {},
      customProperty: 'allowed'
    };

    console.log('Event-like object:', isEventLike(eventLikeObject));
  };
}

export default InterfaceValidator;