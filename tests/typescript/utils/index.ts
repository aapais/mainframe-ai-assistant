/**
 * TypeScript Testing Utilities - Main Export File
 *
 * This module provides a comprehensive suite of TypeScript testing utilities including:
 * - Type checking and validation
 * - React prop validation
 * - Generic type testing
 * - Interface compliance checking
 * - Test helpers and assertions
 *
 * @example
 * ```typescript
 * import {
 *   TypeChecker,
 *   PropValidator,
 *   GenericTypeTest,
 *   InterfaceValidator,
 *   expectType,
 *   assertNever
 * } from '@tests/typescript/utils';
 *
 * // Basic type checking
 * const checker = new TypeChecker();
 * checker.validateString('hello'); // true
 *
 * // Compile-time assertions
 * expectType<string>('hello'); // ✓
 *
 * // Interface validation
 * const validator = new InterfaceValidator(userInterface);
 * validator.validateInterface(userData); // boolean
 * ```
 */

// Core utilities
export {
  TypeChecker,
  typeChecker,
  expectType,
  assertType,
  isNotNullish,
  isDefined,
  isTruthy,
  assertNever
} from './TypeChecker';
export type {
  TypesEqual,
  Assert,
  ArrayElement,
  DeepPartial
} from './TypeChecker';

// React prop validation
export {
  PropValidator,
  PropTypeValidators,
  createPropSchema,
  validateProps,
  withPropValidation,
  inferProps
} from './PropValidator';
export type {
  RequiredProps,
  OptionalProps,
  DefaultProps,
  PropSchema,
  PropValidationResult
} from './PropValidator';

// Generic type testing
export {
  GenericTypeTest,
  GenericComponentTest,
  validateConstraints,
  testGenericComponent,
  createGenericValidator
} from './GenericTypeTest';
export type {
  Extends,
  DoesNotExtend,
  ExactlyEquals,
  IsAny,
  IsNever,
  IsUnknown,
  GenericComponentProps,
  GenericFunctionParams,
  GenericFunctionReturn,
  If,
  Not,
  And,
  Or
} from './GenericTypeTest';

// Interface validation
export {
  InterfaceValidator,
  DuckTypingValidator,
  createInterfaceValidator,
  validateInterface,
  checkDuckTyping
} from './InterfaceValidator';
export type {
  PropertyMetadata,
  InterfaceDefinition,
  InterfaceValidationResult,
  KeysOfType,
  RequiredKeys,
  OptionalKeys,
  PickRequired,
  PickOptional,
  HasProperty,
  HasMethod
} from './InterfaceValidator';

// Test helpers and utilities
export {
  expectExactType,
  expectAssignable,
  expectNotAssignable,
  assertUnreachable,
  TypePredicateTests,
  DiscriminatedUnionTests,
  AdvancedTypeTests,
  MockUtilities,
  AssertionHelpers,
  TestCaseGenerators,
  PerformanceTests
} from './TestHelpers';

// Re-export namespaces for easier access
export { CompileTimeTests, RuntimeTests } from './TypeChecker';
export { PropValidationExamples } from './PropValidator';
export { HigherOrderTypeTests, TypeInferenceTests, GenericPatternTests, TestCases } from './GenericTypeTest';
export { InterfaceValidationUtils, InterfaceExamples } from './InterfaceValidator';
export { Examples } from './TestHelpers';

/**
 * Convenience factory functions
 */

/**
 * Creates a complete validation suite for a type
 */
export function createValidationSuite<T extends Record<string, any>>(config: {
  name: string;
  interface?: import('./InterfaceValidator').InterfaceDefinition<T>;
  propSchema?: import('./PropValidator').PropSchema<T>;
  genericConstraints?: any;
}) {
  const suite = {
    name: config.name,
    typeChecker: new TypeChecker(),
    interfaceValidator: config.interface ? new InterfaceValidator(config.interface) : null,
    propValidator: config.propSchema ? new PropValidator(config.propSchema) : null,
    genericTest: new GenericTypeTest<T>(),

    // Comprehensive validation
    validate(obj: unknown): {
      isValid: boolean;
      typeValid: boolean;
      interfaceValid: boolean;
      propValid: boolean;
      errors: string[];
    } {
      const result = {
        isValid: true,
        typeValid: true,
        interfaceValid: true,
        propValid: true,
        errors: [] as string[]
      };

      // Basic type check
      if (!this.typeChecker.validateObject(obj)) {
        result.typeValid = false;
        result.isValid = false;
        result.errors.push('Value is not an object');
      }

      // Interface validation
      if (this.interfaceValidator) {
        const interfaceResult = this.interfaceValidator.validateInterfaceDetailed(obj);
        result.interfaceValid = interfaceResult.valid;
        if (!interfaceResult.valid) {
          result.isValid = false;
          result.errors.push(...interfaceResult.errors);
        }
      }

      // Prop validation
      if (this.propValidator) {
        const propResult = this.propValidator.validateProps(obj);
        result.propValid = propResult.valid;
        if (!propResult.valid) {
          result.isValid = false;
          result.errors.push(...propResult.errors);
        }
      }

      return result;
    }
  };

  return suite;
}

/**
 * Quick validation helper for common patterns
 */
export const QuickValidators = {
  /**
   * Validates a simple object with string properties
   */
  stringRecord: (obj: unknown): obj is Record<string, string> => {
    const checker = new TypeChecker();
    return checker.validateObject(obj) &&
           Object.values(obj).every(val => checker.validateString(val));
  },

  /**
   * Validates an array of objects
   */
  objectArray: <T>(obj: unknown, itemValidator?: (item: unknown) => item is T): obj is T[] => {
    const checker = new TypeChecker();
    return checker.validateArray(obj, itemValidator);
  },

  /**
   * Validates API response structure
   */
  apiResponse: <T>(obj: unknown, dataValidator?: (data: unknown) => data is T) => {
    const checker = new TypeChecker();
    if (!checker.validateObject(obj)) return false;

    const response = obj as any;
    const hasValidStructure =
      'data' in response ||
      'error' in response ||
      ('loading' in response && checker.validateBoolean(response.loading));

    if (!hasValidStructure) return false;

    if (dataValidator && response.data !== undefined) {
      return dataValidator(response.data);
    }

    return true;
  },

  /**
   * Validates React component props
   */
  reactProps: (obj: unknown): obj is Record<string, any> => {
    const checker = new TypeChecker();
    return checker.validateObject(obj);
  }
};

/**
 * Testing utilities for specific patterns
 */
export const TestingPatterns = {
  /**
   * Creates test cases for CRUD operations
   */
  createCrudTests: <T extends { id: string }>(
    entityName: string,
    validator: (obj: unknown) => obj is T,
    factory: () => T
  ) => ({
    create: {
      valid: [factory()],
      invalid: [null, undefined, {}, { id: 123 }]
    },
    read: {
      validIds: ['valid-id-1', 'valid-id-2'],
      invalidIds: [null, undefined, 123, '']
    },
    update: {
      valid: [{ ...factory(), name: 'updated' }],
      invalid: [null, { id: 123 }]
    },
    delete: {
      validIds: ['valid-id-1'],
      invalidIds: [null, undefined, 123]
    }
  }),

  /**
   * Creates test cases for form validation
   */
  createFormTests: <T>(
    schema: import('./PropValidator').PropSchema<T>
  ) => {
    const requiredFields = Object.entries(schema)
      .filter(([_, config]) => config.required)
      .map(([key]) => key);

    const optionalFields = Object.entries(schema)
      .filter(([_, config]) => !config.required)
      .map(([key]) => key);

    return {
      requiredFields,
      optionalFields,
      missingRequired: requiredFields.map(field => ({
        description: `Missing required field: ${field}`,
        data: requiredFields
          .filter(f => f !== field)
          .reduce((acc, f) => ({ ...acc, [f]: 'value' }), {})
      })),
      invalidTypes: Object.entries(schema).map(([key, config]) => ({
        description: `Invalid type for ${key}`,
        data: { [key]: config.type === 'string' ? 123 : 'invalid' }
      }))
    };
  }
};

/**
 * Default export with all utilities
 */
export default {
  // Core classes
  TypeChecker,
  PropValidator,
  GenericTypeTest,
  InterfaceValidator,
  DuckTypingValidator,

  // Helper functions
  expectType,
  assertNever,
  validateConstraints,
  testGenericComponent,
  createGenericValidator,
  validateInterface,
  checkDuckTyping,

  // Factory functions
  createValidationSuite,

  // Quick validators
  QuickValidators,

  // Testing patterns
  TestingPatterns,

  // Utility namespaces
  TypePredicateTests,
  DiscriminatedUnionTests,
  MockUtilities,
  AssertionHelpers,
  TestCaseGenerators,
  PerformanceTests
};