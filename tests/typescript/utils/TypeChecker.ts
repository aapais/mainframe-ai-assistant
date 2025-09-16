/**
 * TypeChecker - Comprehensive TypeScript testing utilities for compile-time and runtime type checking
 *
 * This module provides utilities for:
 * - Compile-time type checking functions
 * - Runtime type validation helpers
 * - Type assertion utilities
 * - Type narrowing validators
 *
 * @example
 * ```typescript
 * import { TypeChecker, expectType, assertType } from './TypeChecker';
 *
 * // Compile-time type checking
 * expectType<string>("hello"); // ✓ passes
 * expectType<number>("hello"); // ✗ compile error
 *
 * // Runtime type validation
 * const checker = new TypeChecker();
 * checker.validateString("hello"); // true
 * checker.validateNumber("hello"); // false
 * ```
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

/**
 * Compile-time type expectation utility
 * Used to assert that a value is of a specific type at compile time
 */
export function expectType<T>(value: T): T {
  return value;
}

/**
 * Compile-time type assertion that should never be reached
 * Useful for exhaustiveness checking in switch statements
 */
export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${JSON.stringify(value)}`);
}

/**
 * Compile-time type equality checker
 * Ensures two types are exactly equal
 */
export type TypesEqual<T, U> = T extends U ? U extends T ? true : false : false;

/**
 * Compile-time type assertion helper
 * Fails compilation if condition is not true
 */
export type Assert<T extends true> = T;

/**
 * Utility to extract the type of array elements
 */
export type ArrayElement<T> = T extends readonly (infer U)[] ? U : never;

/**
 * Utility to make all properties optional recursively
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Utility to get function parameter types
 */
export type Parameters<T> = T extends (...args: infer P) => any ? P : never;

/**
 * Utility to get function return type
 */
export type ReturnType<T> = T extends (...args: any[]) => infer R ? R : any;

/**
 * Runtime type checker class with comprehensive validation methods
 */
export class TypeChecker {
  /**
   * Validates if value is a string
   */
  validateString(value: unknown): value is string {
    return typeof value === 'string';
  }

  /**
   * Validates if value is a number
   */
  validateNumber(value: unknown): value is number {
    return typeof value === 'number' && !isNaN(value);
  }

  /**
   * Validates if value is a boolean
   */
  validateBoolean(value: unknown): value is boolean {
    return typeof value === 'boolean';
  }

  /**
   * Validates if value is an array
   */
  validateArray<T>(value: unknown, elementValidator?: (item: unknown) => item is T): value is T[] {
    if (!Array.isArray(value)) return false;
    if (!elementValidator) return true;
    return value.every(elementValidator);
  }

  /**
   * Validates if value is an object (not null, not array)
   */
  validateObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  /**
   * Validates if value is null
   */
  validateNull(value: unknown): value is null {
    return value === null;
  }

  /**
   * Validates if value is undefined
   */
  validateUndefined(value: unknown): value is undefined {
    return value === undefined;
  }

  /**
   * Validates if value matches a specific shape/interface
   */
  validateShape<T>(
    value: unknown,
    shape: { [K in keyof T]: (val: unknown) => val is T[K] }
  ): value is T {
    if (!this.validateObject(value)) return false;

    for (const [key, validator] of Object.entries(shape)) {
      if (!validator((value as any)[key])) return false;
    }

    return true;
  }

  /**
   * Validates if value is one of the provided literal types
   */
  validateUnion<T extends readonly unknown[]>(
    value: unknown,
    validators: { [K in keyof T]: (val: unknown) => val is T[K] }
  ): value is T[number] {
    return validators.some(validator => validator(value));
  }

  /**
   * Creates a type predicate function for a specific type
   */
  createTypePredicate<T>(validator: (value: unknown) => boolean): (value: unknown) => value is T {
    return (value: unknown): value is T => validator(value);
  }

  /**
   * Validates if value has a specific property
   */
  hasProperty<K extends string | number | symbol>(
    value: unknown,
    prop: K
  ): value is { [P in K]: unknown } {
    return this.validateObject(value) && prop in value;
  }

  /**
   * Validates if value has all required properties
   */
  hasAllProperties<T extends Record<string, unknown>>(
    value: unknown,
    props: (keyof T)[]
  ): value is T {
    if (!this.validateObject(value)) return false;
    return props.every(prop => prop in value);
  }

  /**
   * Type-safe assertion that throws if validation fails
   */
  assert<T>(value: unknown, validator: (val: unknown) => val is T): asserts value is T {
    if (!validator(value)) {
      throw new TypeError(`Type assertion failed: expected valid type, got ${typeof value}`);
    }
  }

  /**
   * Validates optional values (null, undefined, or specific type)
   */
  validateOptional<T>(
    value: unknown,
    validator: (val: unknown) => val is T
  ): value is T | null | undefined {
    return value == null || validator(value);
  }
}

/**
 * Global type checker instance
 */
export const typeChecker = new TypeChecker();

/**
 * Runtime type assertion with custom error message
 */
export function assertType<T>(
  value: unknown,
  validator: (val: unknown) => val is T,
  message?: string
): asserts value is T {
  if (!validator(value)) {
    throw new TypeError(message || `Type assertion failed for value: ${JSON.stringify(value)}`);
  }
}

/**
 * Type guard for checking if value is not null or undefined
 */
export function isNotNullish<T>(value: T | null | undefined): value is T {
  return value != null;
}

/**
 * Type guard for checking if value is defined (not undefined)
 */
export function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

/**
 * Type guard for checking if value is truthy
 */
export function isTruthy<T>(value: T): value is NonNullable<T> {
  return Boolean(value);
}

/**
 * Compile-time tests and examples
 */
export namespace CompileTimeTests {
  // Test basic type expectations
  export const stringTest = expectType<string>('hello');
  export const numberTest = expectType<number>(42);
  export const booleanTest = expectType<boolean>(true);

  // Test type equality
  export type StringNumberEqual = Assert<TypesEqual<string, string>>;
  export type StringNumberNotEqual = TypesEqual<string, number>; // false

  // Test array element extraction
  export type NumberArrayElement = ArrayElement<number[]>; // number
  export type StringArrayElement = ArrayElement<string[]>; // string

  // Test deep partial
  interface TestInterface {
    name: string;
    age: number;
    address: {
      street: string;
      city: string;
    };
  }
  export type PartialTest = DeepPartial<TestInterface>;

  // Test function types
  const testFunction = (a: string, b: number): boolean => true;
  export type TestParams = Parameters<typeof testFunction>; // [string, number]
  export type TestReturn = ReturnType<typeof testFunction>; // boolean
}

/**
 * Runtime validation examples and tests
 */
export namespace RuntimeTests {
  const checker = new TypeChecker();

  // Basic type validation examples
  export const validateStringExample = () => {
    return checker.validateString('hello'); // true
  };

  export const validateNumberExample = () => {
    return checker.validateNumber(42); // true
  };

  export const validateArrayExample = () => {
    return checker.validateArray([1, 2, 3], checker.validateNumber); // true
  };

  // Shape validation example
  interface User {
    name: string;
    age: number;
    email: string;
  }

  export const validateUserShape = (value: unknown): value is User => {
    return checker.validateShape<User>(value, {
      name: checker.validateString,
      age: checker.validateNumber,
      email: checker.validateString
    });
  };

  // Union type validation example
  export const validateStringOrNumber = (value: unknown): value is string | number => {
    return checker.validateUnion(value, [checker.validateString, checker.validateNumber]);
  };
}

export default TypeChecker;