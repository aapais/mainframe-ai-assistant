/**
 * Jest setup file for TypeScript type testing
 * Global configuration and utilities for TypeScript type tests
 */

import { TypeChecker } from '../core/TypeChecker';
import { PropValidator } from '../core/PropValidator';
import { GenericTypeTestRunner } from '../core/GenericTypeTestRunner';
import { InterfaceValidator } from '../core/InterfaceValidator';
import { TypeSafetyReporter } from '../core/TypeSafetyReporter';
import { createTypeTestConfig } from './type-test.config';

// Extend Jest matchers for type testing
declare global {
  namespace jest {
    interface Matchers<R> {
      // Type checking matchers
      toBeValidType(): R;
      toPassTypeCheck(): R;
      toBeAssignableTo(targetType: any): R;
      toHaveCorrectTypeSignature(): R;

      // Prop validation matchers
      toBeValidProp(propDefinition: any): R;
      toHaveRequiredProps(props: string[]): R;
      toMatchPropSchema(schema: any): R;

      // Generic type matchers
      toSatisfyConstraints(constraints: any): R;
      toBeValidGenericInstantiation(): R;
      toHaveCorrectVariance(varianceType: 'covariant' | 'contravariant' | 'invariant'): R;

      // Interface validation matchers
      toImplementInterface(interfaceName: string): R;
      toHaveCorrectMethodSignature(methodName: string, signature: any): R;
      toConformToInterface(interfaceDefinition: any): R;

      // Utility type matchers
      toBePartialOf(baseType: any): R;
      toBePickOf(baseType: any, keys: string[]): R;
      toBeOmitOf(baseType: any, keys: string[]): R;
    }
  }
}

// Global test configuration
const testConfig = createTypeTestConfig('test');

// Global instances
let globalTypeChecker: TypeChecker;
let globalPropValidator: PropValidator;
let globalGenericRunner: GenericTypeTestRunner;
let globalInterfaceValidator: InterfaceValidator;
let globalReporter: TypeSafetyReporter;

// Initialize global instances
beforeAll(() => {
  globalTypeChecker = new TypeChecker(testConfig.typeChecker);
  globalPropValidator = new PropValidator(globalTypeChecker, testConfig.propValidator);
  globalGenericRunner = new GenericTypeTestRunner(globalTypeChecker);
  globalInterfaceValidator = new InterfaceValidator(globalTypeChecker, testConfig.interfaceValidator);
  globalReporter = new TypeSafetyReporter(testConfig.reporter);

  // Make instances globally available
  (global as any).typeChecker = globalTypeChecker;
  (global as any).propValidator = globalPropValidator;
  (global as any).genericRunner = globalGenericRunner;
  (global as any).interfaceValidator = globalInterfaceValidator;
  (global as any).reporter = globalReporter;
});

// Clean up after each test
afterEach(() => {
  // Clear caches and reset state
  if (globalTypeChecker) {
    // Reset any internal state if needed
  }

  if (globalGenericRunner) {
    // Clear test results if needed
  }
});

// Custom matchers implementation
expect.extend({
  // Type checking matchers
  toBeValidType(received: any) {
    const result = globalTypeChecker.validateType(received, received);

    return {
      message: () =>
        result.passed
          ? `Expected ${received} not to be a valid type`
          : `Expected ${received} to be a valid type. Errors: ${result.errors.join(', ')}`,
      pass: result.passed
    };
  },

  toPassTypeCheck(received: any, expectedType?: any) {
    const result = expectedType
      ? globalTypeChecker.validateType(received, expectedType)
      : globalTypeChecker.validateType(received, received);

    return {
      message: () =>
        result.passed
          ? `Expected type check to fail`
          : `Expected type check to pass. Errors: ${result.errors.join(', ')}`,
      pass: result.passed
    };
  },

  toBeAssignableTo(received: any, targetType: any) {
    const isAssignable = globalTypeChecker.isAssignable(received, targetType);

    return {
      message: () =>
        isAssignable
          ? `Expected ${received} not to be assignable to ${targetType}`
          : `Expected ${received} to be assignable to ${targetType}`,
      pass: isAssignable
    };
  },

  toHaveCorrectTypeSignature(received: any) {
    const result = globalTypeChecker.validateType(received, received);
    const hasValidSignature = result.passed && result.typeInfo.assignability.exactMatch;

    return {
      message: () =>
        hasValidSignature
          ? `Expected type signature to be incorrect`
          : `Expected correct type signature`,
      pass: hasValidSignature
    };
  },

  // Prop validation matchers
  toBeValidProp(received: any, propDefinition: any) {
    const result = globalPropValidator.validateProp('test', received, propDefinition);

    return {
      message: () =>
        result.passed
          ? `Expected prop to be invalid`
          : `Expected prop to be valid. Errors: ${result.errors.join(', ')}`,
      pass: result.passed
    };
  },

  toHaveRequiredProps(received: any, props: string[]) {
    const missingProps = props.filter(prop => !(prop in received));
    const hasAllRequired = missingProps.length === 0;

    return {
      message: () =>
        hasAllRequired
          ? `Expected to be missing required props`
          : `Missing required props: ${missingProps.join(', ')}`,
      pass: hasAllRequired
    };
  },

  toMatchPropSchema(received: any, schema: any) {
    const results = globalPropValidator.validateComponentProps(received, schema);
    const allPassed = results.every(r => r.passed);

    return {
      message: () =>
        allPassed
          ? `Expected props not to match schema`
          : `Props don't match schema. Failed: ${results.filter(r => !r.passed).map(r => r.propName).join(', ')}`,
      pass: allPassed
    };
  },

  // Generic type matchers
  toSatisfyConstraints(received: any, constraints: any) {
    const result = globalTypeChecker.validateGeneric(received, constraints);

    return {
      message: () =>
        result.passed
          ? `Expected not to satisfy constraints`
          : `Expected to satisfy constraints. Errors: ${result.errors.join(', ')}`,
      pass: result.passed
    };
  },

  toBeValidGenericInstantiation(received: any) {
    const result = globalGenericRunner.testGenericInstantiation(
      received.constructor || Object,
      received.typeArguments || [],
      received.expectedType || received
    );

    return {
      message: () =>
        result.passed
          ? `Expected generic instantiation to be invalid`
          : `Expected valid generic instantiation. Errors: ${result.errors.join(', ')}`,
      pass: result.passed
    };
  },

  toHaveCorrectVariance(received: any, varianceType: 'covariant' | 'contravariant' | 'invariant') {
    const result = globalGenericRunner.testGenericVariance(
      received.base || received,
      received.derived || received,
      varianceType
    );

    return {
      message: () =>
        result.passed
          ? `Expected variance test to fail`
          : `Expected correct ${varianceType} variance. Errors: ${result.errors.join(', ')}`,
      pass: result.passed
    };
  },

  // Interface validation matchers
  toImplementInterface(received: any, interfaceName: string) {
    const result = globalInterfaceValidator.validateObject(received, interfaceName);

    return {
      message: () =>
        result.passed
          ? `Expected not to implement interface ${interfaceName}`
          : `Expected to implement interface ${interfaceName}. Errors: ${result.errors.map(e => e.message).join(', ')}`,
      pass: result.passed
    };
  },

  toHaveCorrectMethodSignature(received: any, methodName: string, signature: any) {
    const method = received[methodName];
    const isFunction = typeof method === 'function';

    if (!isFunction) {
      return {
        message: () => `Expected ${methodName} to be a function`,
        pass: false
      };
    }

    // Simplified signature validation
    const hasCorrectArity = method.length === (signature.parameters?.length || 0);

    return {
      message: () =>
        hasCorrectArity
          ? `Expected incorrect method signature for ${methodName}`
          : `Expected correct method signature for ${methodName}`,
      pass: hasCorrectArity
    };
  },

  toConformToInterface(received: any, interfaceDefinition: any) {
    const result = globalInterfaceValidator.validateAgainstDefinition(received, interfaceDefinition);

    return {
      message: () =>
        result.passed
          ? `Expected not to conform to interface`
          : `Expected to conform to interface. Errors: ${result.errors.map(e => e.message).join(', ')}`,
      pass: result.passed
    };
  },

  // Utility type matchers
  toBePartialOf(received: any, baseType: any) {
    // Check if all properties in received exist in baseType
    const receivedKeys = Object.keys(received);
    const baseKeys = Object.keys(baseType);
    const isPartial = receivedKeys.every(key => baseKeys.includes(key));

    return {
      message: () =>
        isPartial
          ? `Expected not to be partial of base type`
          : `Expected to be partial of base type`,
      pass: isPartial
    };
  },

  toBePickOf(received: any, baseType: any, keys: string[]) {
    const receivedKeys = Object.keys(received).sort();
    const expectedKeys = keys.sort();
    const isPick = JSON.stringify(receivedKeys) === JSON.stringify(expectedKeys);

    return {
      message: () =>
        isPick
          ? `Expected not to be Pick of base type with keys ${keys.join(', ')}`
          : `Expected to be Pick of base type with keys ${keys.join(', ')}`,
      pass: isPick
    };
  },

  toBeOmitOf(received: any, baseType: any, keys: string[]) {
    const receivedKeys = Object.keys(received).sort();
    const baseKeys = Object.keys(baseType);
    const expectedKeys = baseKeys.filter(key => !keys.includes(key)).sort();
    const isOmit = JSON.stringify(receivedKeys) === JSON.stringify(expectedKeys);

    return {
      message: () =>
        isOmit
          ? `Expected not to be Omit of base type without keys ${keys.join(', ')}`
          : `Expected to be Omit of base type without keys ${keys.join(', ')}`,
      pass: isOmit
    };
  }
});

// Global helper functions
(global as any).createTypeTest = (name: string, testFn: () => void) => {
  test(`Type Test: ${name}`, testFn);
};

(global as any).createPropTest = (name: string, testFn: () => void) => {
  test(`Prop Test: ${name}`, testFn);
};

(global as any).createGenericTest = (name: string, testFn: () => void) => {
  test(`Generic Test: ${name}`, testFn);
};

(global as any).createInterfaceTest = (name: string, testFn: () => void) => {
  test(`Interface Test: ${name}`, testFn);
};

// Utility functions for common test patterns
(global as any).testTypeEquality = <T, U>(
  type1: T,
  type2: U,
  shouldBeEqual: boolean = true
) => {
  const result = globalTypeChecker.isAssignable(type1, type2) &&
                 globalTypeChecker.isAssignable(type2, type1);
  expect(result).toBe(shouldBeEqual);
};

(global as any).testTypeAssignability = <T, U>(
  source: T,
  target: U,
  shouldBeAssignable: boolean = true
) => {
  const result = globalTypeChecker.isAssignable(source, target);
  expect(result).toBe(shouldBeAssignable);
};

// Error logging for debugging
(global as any).logTypeInfo = (value: any) => {
  const result = globalTypeChecker.validateType(value, value);
  console.log('Type Info:', result.typeInfo);
  return result.typeInfo;
};

// Export test config for access in tests
(global as any).testConfig = testConfig;

// Set up unhandled rejection handling for tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  throw reason;
});

// Console override for cleaner test output
const originalConsoleError = console.error;
console.error = (...args: any[]) => {
  // Filter out known non-critical warnings/errors during tests
  const message = args.join(' ');
  if (
    message.includes('Warning: React.createFactory') ||
    message.includes('Warning: componentWillReceiveProps') ||
    message.includes('act() wrapped')
  ) {
    return;
  }
  originalConsoleError.apply(console, args);
};