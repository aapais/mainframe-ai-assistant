/**
 * TestHelpers - Comprehensive TypeScript testing helper utilities
 *
 * This module provides utilities for:
 * - expectType<T>() assertion helper
 * - assertNever() for exhaustiveness checking
 * - Type predicate testers
 * - Discriminated union validators
 * - Advanced testing patterns
 *
 * @example
 * ```typescript
 * import { expectType, assertNever, createTypePredicateTest } from './TestHelpers';
 *
 * // Type assertions
 * expectType<string>("hello"); // ✓ compile-time check
 *
 * // Exhaustiveness checking
 * function handleColor(color: 'red' | 'blue' | 'green') {
 *   switch (color) {
 *     case 'red': return '#ff0000';
 *     case 'blue': return '#0000ff';
 *     case 'green': return '#00ff00';
 *     default: return assertNever(color); // Ensures all cases handled
 *   }
 * }
 * ```
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

/**
 * Compile-time type expectation utility
 * Ensures a value matches the expected type at compile time
 */
export function expectType<Expected>(actual: Expected): Expected {
  return actual;
}

/**
 * Compile-time type equality assertion
 * Ensures two types are exactly equal
 */
export function expectExactType<Expected>() {
  return <Actual>(actual: Expected extends Actual ? Actual extends Expected ? Actual : never : never) => actual;
}

/**
 * Compile-time assignability check
 * Ensures a type is assignable to another type
 */
export function expectAssignable<To>() {
  return <From extends To>(from: From): From => from;
}

/**
 * Compile-time non-assignability check
 * Ensures a type is NOT assignable to another type
 */
export function expectNotAssignable<To>() {
  return <From>(from: From extends To ? never : From): From => from;
}

/**
 * Exhaustiveness checking utility for discriminated unions
 * Throws an error if reached, ensuring all cases are handled
 */
export function assertNever(value: never, message?: string): never {
  throw new Error(message || `Unexpected value: ${JSON.stringify(value)}`);
}

/**
 * Runtime exhaustiveness check with logging
 */
export function assertUnreachable(value: never, context?: string): never {
  const error = new Error(
    `Unreachable code reached${context ? ` in ${context}` : ''}: ${JSON.stringify(value)}`
  );
  console.error(error);
  throw error;
}

/**
 * Type predicate testing utilities
 */
export namespace TypePredicateTests {
  /**
   * Creates a test suite for type predicates
   */
  export function createTypePredicateTest<T>(
    predicate: (value: unknown) => value is T,
    trueCases: unknown[],
    falseCases: unknown[],
    description?: string
  ) {
    return {
      name: description || predicate.name,
      predicate,
      test: () => {
        const results = {
          passed: 0,
          failed: 0,
          failures: [] as Array<{ value: unknown; expected: boolean; actual: boolean }>
        };

        // Test true cases
        for (const testCase of trueCases) {
          const result = predicate(testCase);
          if (result) {
            results.passed++;
          } else {
            results.failed++;
            results.failures.push({ value: testCase, expected: true, actual: result });
          }
        }

        // Test false cases
        for (const testCase of falseCases) {
          const result = predicate(testCase);
          if (!result) {
            results.passed++;
          } else {
            results.failed++;
            results.failures.push({ value: testCase, expected: false, actual: result });
          }
        }

        return results;
      }
    };
  }

  /**
   * Batch test multiple type predicates
   */
  export function runTypePredicateTests(tests: ReturnType<typeof createTypePredicateTest>[]) {
    const results = tests.map(test => ({
      name: test.name,
      result: test.test()
    }));

    const summary = {
      totalTests: tests.length,
      passed: results.filter(r => r.result.failed === 0).length,
      failed: results.filter(r => r.result.failed > 0).length,
      details: results
    };

    return summary;
  }
}

/**
 * Discriminated union testing utilities
 */
export namespace DiscriminatedUnionTests {
  /**
   * Tests discriminated union exhaustiveness
   */
  export function testDiscriminatedUnion<
    Union extends { type: string },
    Type extends Union['type']
  >(
    value: Union,
    handlers: Record<Type, (item: Extract<Union, { type: Type }>) => any>
  ): any {
    const handler = handlers[value.type as Type];
    if (!handler) {
      return assertNever(value as never, `Unhandled discriminated union type: ${value.type}`);
    }
    return handler(value as Extract<Union, { type: Type }>);
  }

  /**
   * Validates discriminated union completeness at compile time
   */
  export type ValidateDiscriminatedUnion<
    Union extends { type: string },
    Handlers extends Record<string, any>
  > = Union['type'] extends keyof Handlers
    ? keyof Handlers extends Union['type']
      ? true
      : `Missing handlers for: ${Exclude<keyof Handlers, Union['type']>}`
    : `Missing handlers for: ${Exclude<Union['type'], keyof Handlers>}`;

  /**
   * Creates a type-safe discriminated union handler
   */
  export function createDiscriminatedHandler<Union extends { type: string }>() {
    return <Handlers extends Record<Union['type'], (item: any) => any>>(
      handlers: Handlers & Record<Union['type'], (item: Extract<Union, { type: keyof Handlers }>) => any>
    ) => {
      return (value: Union): ReturnType<Handlers[Union['type']]> => {
        const handler = handlers[value.type];
        if (!handler) {
          return assertNever(value as never);
        }
        return handler(value as any);
      };
    };
  }
}

/**
 * Advanced type testing utilities
 */
export namespace AdvancedTypeTests {
  /**
   * Tests conditional type behavior
   */
  export type TestConditionalType<T, U, Expected> = T extends U
    ? Expected extends true
      ? true
      : `Expected true but got false for ${T} extends ${U}`
    : Expected extends false
    ? true
    : `Expected false but got true for ${T} extends ${U}`;

  /**
   * Tests mapped type behavior
   */
  export type TestMappedType<T, Transform, Expected> = {
    [K in keyof T]: Transform
  } extends Expected ? true : false;

  /**
   * Tests distributive conditional types
   */
  export type TestDistributive<T, Expected> = T extends any
    ? T[]
    : never extends Expected
    ? true
    : false;

  /**
   * Template literal type testing
   */
  export type TestTemplateLiteral<T extends string, Expected> = `prefix_${T}_suffix` extends Expected ? true : false;

  /**
   * Recursive type testing
   */
  export type TestRecursive<T, Expected> = T extends object
    ? { [K in keyof T]: TestRecursive<T[K], any> }
    : T extends Expected
    ? true
    : false;

  /**
   * Variance testing utilities
   */
  export interface CovarianceTest<out T> {
    get(): T;
  }

  export interface ContravarianceTest<in T> {
    set(value: T): void;
  }

  export interface InvarianceTest<in out T> {
    get(): T;
    set(value: T): void;
  }

  /**
   * Tests type variance at compile time
   */
  export type TestCovariance<Sub, Super> = CovarianceTest<Sub> extends CovarianceTest<Super> ? true : false;
  export type TestContravariance<Sub, Super> = ContravarianceTest<Super> extends ContravarianceTest<Sub> ? true : false;
}

/**
 * Mock and stub utilities for testing
 */
export namespace MockUtilities {
  /**
   * Creates a mock object that satisfies a type interface
   */
  export function createMock<T>(): T {
    return {} as T;
  }

  /**
   * Creates a partial mock with some properties defined
   */
  export function createPartialMock<T>(partial: Partial<T>): T {
    return partial as T;
  }

  /**
   * Creates a mock with spies for all methods
   */
  export function createSpyMock<T extends Record<string, any>>(): T & {
    [K in keyof T]: T[K] extends (...args: any[]) => any
      ? T[K] & { callCount: number; lastArgs?: Parameters<T[K]>; lastReturn?: ReturnType<T[K]> }
      : T[K];
  } {
    return new Proxy({} as any, {
      get(target, prop) {
        if (!(prop in target)) {
          if (typeof prop === 'string') {
            const spy = (...args: any[]) => {
              spy.callCount++;
              spy.lastArgs = args;
              return undefined;
            };
            spy.callCount = 0;
            target[prop] = spy;
          }
        }
        return target[prop];
      }
    });
  }

  /**
   * Type-safe factory for creating test data
   */
  export function createFactory<T>(defaults: T) {
    return (overrides: Partial<T> = {}): T => ({
      ...defaults,
      ...overrides
    });
  }
}

/**
 * Assertion utilities for runtime testing
 */
export namespace AssertionHelpers {
  /**
   * Type-safe assertion with custom message
   */
  export function assertType<T>(
    value: unknown,
    predicate: (value: unknown) => value is T,
    message?: string
  ): asserts value is T {
    if (!predicate(value)) {
      throw new TypeError(message || `Type assertion failed for value: ${JSON.stringify(value)}`);
    }
  }

  /**
   * Assertion for non-null values
   */
  export function assertNotNull<T>(value: T | null | undefined, message?: string): asserts value is T {
    if (value == null) {
      throw new Error(message || 'Value is null or undefined');
    }
  }

  /**
   * Assertion for defined values
   */
  export function assertDefined<T>(value: T | undefined, message?: string): asserts value is T {
    if (value === undefined) {
      throw new Error(message || 'Value is undefined');
    }
  }

  /**
   * Assertion for array types
   */
  export function assertArray<T>(
    value: unknown,
    elementAssertion?: (item: unknown) => asserts item is T,
    message?: string
  ): asserts value is T[] {
    if (!Array.isArray(value)) {
      throw new TypeError(message || 'Value is not an array');
    }
    if (elementAssertion) {
      value.forEach((item, index) => {
        try {
          elementAssertion(item);
        } catch (error) {
          throw new TypeError(`Array element at index ${index} failed assertion: ${error}`);
        }
      });
    }
  }

  /**
   * Assertion for object properties
   */
  export function assertHasProperty<T, K extends keyof T>(
    obj: T,
    property: K,
    message?: string
  ): asserts obj is T & Required<Pick<T, K>> {
    if (!(property in obj) || obj[property] === undefined) {
      throw new Error(message || `Object does not have required property: ${String(property)}`);
    }
  }
}

/**
 * Test case generators
 */
export namespace TestCaseGenerators {
  /**
   * Generates test cases for primitive types
   */
  export const PrimitiveTestCases = {
    string: {
      valid: ['hello', '', 'test string', '123'],
      invalid: [123, true, null, undefined, [], {}]
    },
    number: {
      valid: [0, 1, -1, 3.14, Infinity, -Infinity],
      invalid: ['123', true, null, undefined, [], {}, NaN]
    },
    boolean: {
      valid: [true, false],
      invalid: ['true', 1, 0, null, undefined, [], {}]
    },
    null: {
      valid: [null],
      invalid: [undefined, 0, false, '', [], {}]
    },
    undefined: {
      valid: [undefined],
      invalid: [null, 0, false, '', [], {}]
    }
  };

  /**
   * Generates test cases for complex types
   */
  export const ComplexTestCases = {
    array: {
      valid: [[], [1, 2, 3], ['a', 'b'], [true, false]],
      invalid: ['not array', 123, true, null, undefined, {}]
    },
    object: {
      valid: [{}, { a: 1 }, { nested: { prop: 'value' } }],
      invalid: [null, [], 'string', 123, true, undefined]
    },
    function: {
      valid: [() => {}, function() {}, async () => {}, function* () {}],
      invalid: [null, undefined, 'function', 123, [], {}]
    }
  };

  /**
   * Generates edge case test scenarios
   */
  export function generateEdgeCases<T>(type: string): { valid: T[]; invalid: unknown[] } {
    switch (type) {
      case 'email':
        return {
          valid: ['test@example.com', 'user+tag@domain.co.uk'] as T[],
          invalid: ['invalid-email', '@example.com', 'test@', 'test.example.com']
        };
      case 'url':
        return {
          valid: ['https://example.com', 'http://test.org/path'] as T[],
          invalid: ['not-a-url', 'ftp://invalid', 'example.com', '//invalid']
        };
      case 'uuid':
        return {
          valid: ['123e4567-e89b-12d3-a456-426614174000'] as T[],
          invalid: ['not-a-uuid', '123-456-789', '', null]
        };
      default:
        return { valid: [], invalid: [] };
    }
  }
}

/**
 * Performance testing utilities
 */
export namespace PerformanceTests {
  /**
   * Measures type checking performance
   */
  export function measureTypeCheckingTime<T>(
    validator: (value: unknown) => value is T,
    testCases: unknown[],
    iterations = 1000
  ): { averageTime: number; totalTime: number; operationsPerSecond: number } {
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      for (const testCase of testCases) {
        validator(testCase);
      }
    }

    const end = performance.now();
    const totalTime = end - start;
    const totalOperations = iterations * testCases.length;

    return {
      averageTime: totalTime / totalOperations,
      totalTime,
      operationsPerSecond: totalOperations / (totalTime / 1000)
    };
  }

  /**
   * Compares performance of different validators
   */
  export function compareValidators<T>(
    validators: Array<{ name: string; validator: (value: unknown) => value is T }>,
    testCases: unknown[],
    iterations = 1000
  ) {
    const results = validators.map(({ name, validator }) => ({
      name,
      performance: measureTypeCheckingTime(validator, testCases, iterations)
    }));

    results.sort((a, b) => a.performance.averageTime - b.performance.averageTime);

    return {
      fastest: results[0],
      slowest: results[results.length - 1],
      all: results
    };
  }
}

/**
 * Example usage and test cases
 */
export namespace Examples {
  // Basic type testing
  export const basicExamples = () => {
    // Compile-time type checking
    expectType<string>('hello');
    expectType<number>(42);
    expectType<boolean>(true);

    // Type equality checking
    const exactString = expectExactType<string>();
    exactString('hello'); // ✓
    // exactString(42); // ✗ compile error

    // Assignability checking
    const assignToString = expectAssignable<string | number>();
    assignToString('hello'); // ✓
    assignToString(42); // ✓
    // assignToString(true); // ✗ compile error
  };

  // Discriminated union examples
  type Shape =
    | { type: 'circle'; radius: number }
    | { type: 'rectangle'; width: number; height: number }
    | { type: 'triangle'; base: number; height: number };

  export const discriminatedUnionExample = (shape: Shape): number => {
    const handler = DiscriminatedUnionTests.createDiscriminatedHandler<Shape>();

    return handler({
      circle: (s) => Math.PI * s.radius * s.radius,
      rectangle: (s) => s.width * s.height,
      triangle: (s) => (s.base * s.height) / 2
    })(shape);
  };

  // Type predicate testing
  const isString = (value: unknown): value is string => typeof value === 'string';

  export const typePredicateExample = () => {
    const stringTest = TypePredicateTests.createTypePredicateTest(
      isString,
      ['hello', 'world', ''], // true cases
      [123, true, null, undefined, [], {}] // false cases
    );

    return stringTest.test();
  };

  // Mock usage example
  interface UserService {
    getUser(id: string): Promise<{ id: string; name: string }>;
    createUser(data: { name: string }): Promise<{ id: string; name: string }>;
  }

  export const mockExample = () => {
    const userServiceMock = MockUtilities.createSpyMock<UserService>();

    // Use mock in tests
    userServiceMock.getUser('123');
    userServiceMock.createUser({ name: 'John' });

    console.log('getUser called', userServiceMock.getUser.callCount, 'times');
    console.log('Last getUser args:', userServiceMock.getUser.lastArgs);
  };
}

export default {
  expectType,
  assertNever,
  TypePredicateTests,
  DiscriminatedUnionTests,
  AdvancedTypeTests,
  MockUtilities,
  AssertionHelpers,
  TestCaseGenerators,
  PerformanceTests
};