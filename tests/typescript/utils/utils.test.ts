/**
 * Comprehensive test file for TypeScript testing utilities
 * Demonstrates usage of all utility classes and functions
 */

import {
  TypeChecker,
  PropValidator,
  GenericTypeTest,
  InterfaceValidator,
  expectType,
  assertNever,
  PropTypeValidators,
  createPropSchema,
  validateInterface,
  checkDuckTyping,
  createValidationSuite,
  QuickValidators,
  TestingPatterns,
  TypePredicateTests,
  DiscriminatedUnionTests,
  MockUtilities,
  AssertionHelpers
} from './index';

// Test interfaces and types
interface User {
  id: string;
  name: string;
  email?: string;
  age: number;
  preferences: Record<string, any>;
}

interface ButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
}

type Theme = 'light' | 'dark' | 'auto';

// Discriminated union for testing
type APIResponse =
  | { status: 'loading' }
  | { status: 'success'; data: any }
  | { status: 'error'; error: string };

describe('TypeScript Testing Utilities', () => {
  describe('TypeChecker', () => {
    const typeChecker = new TypeChecker();

    test('should validate basic types correctly', () => {
      expect(typeChecker.validateString('hello')).toBe(true);
      expect(typeChecker.validateString(123)).toBe(false);

      expect(typeChecker.validateNumber(42)).toBe(true);
      expect(typeChecker.validateNumber('42')).toBe(false);

      expect(typeChecker.validateBoolean(true)).toBe(true);
      expect(typeChecker.validateBoolean('true')).toBe(false);
    });

    test('should validate arrays correctly', () => {
      expect(typeChecker.validateArray([1, 2, 3], typeChecker.validateNumber)).toBe(true);
      expect(typeChecker.validateArray(['a', 'b'], typeChecker.validateString)).toBe(true);
      expect(typeChecker.validateArray([1, 'a'], typeChecker.validateNumber)).toBe(false);
    });

    test('should validate object shapes', () => {
      const userShape = {
        id: typeChecker.validateString,
        name: typeChecker.validateString,
        age: typeChecker.validateNumber
      };

      const validUser = { id: '1', name: 'John', age: 30 };
      const invalidUser = { id: 1, name: 'John', age: '30' };

      expect(typeChecker.validateShape(validUser, userShape)).toBe(true);
      expect(typeChecker.validateShape(invalidUser, userShape)).toBe(false);
    });

    test('should create type predicates', () => {
      const isPositiveNumber = typeChecker.createTypePredicate<number>(
        (value) => typeChecker.validateNumber(value) && value > 0
      );

      expect(isPositiveNumber(5)).toBe(true);
      expect(isPositiveNumber(-5)).toBe(false);
      expect(isPositiveNumber('5')).toBe(false);
    });
  });

  describe('PropValidator', () => {
    const buttonSchema = createPropSchema<ButtonProps>({
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
        description: 'Click handler'
      },
      disabled: {
        type: 'boolean',
        required: false,
        validator: PropTypeValidators.boolean,
        defaultValue: false
      },
      variant: {
        type: "'primary' | 'secondary' | 'danger'",
        required: false,
        validator: PropTypeValidators.oneOf(['primary', 'secondary', 'danger'] as const),
        defaultValue: 'primary'
      }
    });

    const validator = new PropValidator(buttonSchema);

    test('should validate required props', () => {
      const validProps = { label: 'Click me', onClick: () => {} };
      const invalidProps = { label: 'Click me' }; // missing onClick

      expect(validator.validateRequired(validProps)).toBe(true);
      expect(validator.validateRequired(invalidProps)).toBe(false);
    });

    test('should validate optional props', () => {
      const validOptional = { disabled: true, variant: 'secondary' as const };
      const invalidOptional = { disabled: 'true', variant: 'invalid' };

      expect(validator.validateOptional(validOptional)).toBe(true);
      expect(validator.validateOptional(invalidOptional)).toBe(false);
    });

    test('should provide detailed validation results', () => {
      const invalidProps = {
        label: 123, // should be string
        onClick: 'not-a-function', // should be function
        variant: 'invalid' // should be one of the allowed values
      };

      const result = validator.validateProps(invalidProps);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.typeViolations).toBeDefined();
    });

    test('should apply default values', () => {
      const props = { label: 'Click me', onClick: () => {} };
      const withDefaults = validator.applyDefaults(props);

      expect(withDefaults.disabled).toBe(false);
      expect(withDefaults.variant).toBe('primary');
    });
  });

  describe('GenericTypeTest', () => {
    test('should validate generic constraints at compile time', () => {
      const stringTest = new GenericTypeTest<string>();
      const numberTest = new GenericTypeTest<number>();

      // These are primarily compile-time checks
      expect(stringTest).toBeDefined();
      expect(numberTest).toBeDefined();
    });

    test('should create constraint validators', () => {
      interface Serializable {
        serialize(): string;
      }

      const serializableTest = new GenericTypeTest<Serializable>();

      const constraint = serializableTest.createConstraintValidator<{ id: string }>(
        (value): value is Serializable & { id: string } => {
          return typeof value === 'object' &&
                 value !== null &&
                 'serialize' in value &&
                 typeof (value as any).serialize === 'function' &&
                 'id' in value &&
                 typeof (value as any).id === 'string';
        }
      );

      const validObject = {
        id: '123',
        serialize: () => 'serialized'
      };

      const invalidObject = {
        id: 123, // wrong type
        serialize: () => 'serialized'
      };

      expect(constraint(validObject)).toBe(true);
      expect(constraint(invalidObject)).toBe(false);
    });
  });

  describe('InterfaceValidator', () => {
    const userDefinition = {
      name: 'User',
      properties: {
        id: {
          name: 'id',
          type: 'string',
          required: true,
          validator: (value: unknown): value is string => typeof value === 'string'
        },
        name: {
          name: 'name',
          type: 'string',
          required: true,
          validator: (value: unknown): value is string => typeof value === 'string'
        },
        email: {
          name: 'email',
          type: 'string',
          required: false,
          validator: (value: unknown): value is string => typeof value === 'string'
        },
        age: {
          name: 'age',
          type: 'number',
          required: true,
          validator: (value: unknown): value is number => typeof value === 'number'
        },
        preferences: {
          name: 'preferences',
          type: 'object',
          required: true,
          validator: (value: unknown): value is Record<string, any> =>
            typeof value === 'object' && value !== null && !Array.isArray(value)
        }
      }
    };

    const validator = new InterfaceValidator<User>(userDefinition);

    test('should validate interface compliance', () => {
      const validUser = {
        id: '123',
        name: 'John Doe',
        email: 'john@example.com',
        age: 30,
        preferences: { theme: 'dark' }
      };

      const invalidUser = {
        id: 123, // wrong type
        name: 'John Doe',
        // missing age
        preferences: 'invalid' // wrong type
      };

      expect(validator.validateInterface(validUser)).toBe(true);
      expect(validator.validateInterface(invalidUser)).toBe(false);
    });

    test('should provide detailed validation results', () => {
      const invalidUser = {
        id: 123, // wrong type
        name: 'John Doe',
        // missing age (required)
        preferences: 'invalid', // wrong type
        extraProp: 'not allowed'
      };

      const result = validator.validateInterfaceDetailed(invalidUser);

      expect(result.valid).toBe(false);
      expect(result.missingRequired).toContain('age');
      expect(result.typeViolations.length).toBeGreaterThan(0);
      expect(result.extraProperties).toContain('extraProp');
    });

    test('should validate structural typing (duck typing)', () => {
      const duckTypedObject = {
        id: '123',
        name: 'John',
        age: 30,
        preferences: {},
        // extra properties are allowed in structural typing
        extraProperty: 'allowed'
      };

      expect(validator.validateStructural(duckTypedObject)).toBe(true);
    });
  });

  describe('Test Helpers', () => {
    test('expectType should work at compile time', () => {
      // These are compile-time checks
      expectType<string>('hello');
      expectType<number>(42);
      expectType<boolean>(true);

      // No runtime assertions needed - compile-time verification
      expect(true).toBe(true);
    });

    test('assertNever should handle exhaustiveness', () => {
      function handleTheme(theme: Theme): string {
        switch (theme) {
          case 'light':
            return '#ffffff';
          case 'dark':
            return '#000000';
          case 'auto':
            return 'system';
          default:
            return assertNever(theme);
        }
      }

      expect(handleTheme('light')).toBe('#ffffff');
      expect(handleTheme('dark')).toBe('#000000');
      expect(handleTheme('auto')).toBe('system');
    });

    test('discriminated union handling', () => {
      const handler = DiscriminatedUnionTests.createDiscriminatedHandler<APIResponse>();

      const responseHandler = handler({
        loading: () => 'Loading...',
        success: (response) => `Data: ${JSON.stringify(response.data)}`,
        error: (response) => `Error: ${response.error}`
      });

      const loadingResponse: APIResponse = { status: 'loading' };
      const successResponse: APIResponse = { status: 'success', data: { id: 1 } };
      const errorResponse: APIResponse = { status: 'error', error: 'Not found' };

      expect(responseHandler(loadingResponse)).toBe('Loading...');
      expect(responseHandler(successResponse)).toContain('Data:');
      expect(responseHandler(errorResponse)).toContain('Error: Not found');
    });

    test('type predicate testing', () => {
      const isString = (value: unknown): value is string => typeof value === 'string';

      const test = TypePredicateTests.createTypePredicateTest(
        isString,
        ['hello', 'world', ''], // true cases
        [123, true, null, undefined, [], {}] // false cases
      );

      const result = test.test();

      expect(result.passed).toBe(6); // 3 true + 3 false cases that passed
      expect(result.failed).toBe(0);
      expect(result.failures).toHaveLength(0);
    });

    test('mock utilities', () => {
      interface TestService {
        getValue(): string;
        setValue(value: string): void;
        processData(data: any): Promise<any>;
      }

      const mock = MockUtilities.createSpyMock<TestService>();

      mock.getValue();
      mock.setValue('test');
      mock.processData({ test: true });

      expect(mock.getValue.callCount).toBe(1);
      expect(mock.setValue.callCount).toBe(1);
      expect(mock.setValue.lastArgs).toEqual(['test']);
      expect(mock.processData.callCount).toBe(1);
    });

    test('assertion helpers', () => {
      const isString = (value: unknown): value is string => typeof value === 'string';

      expect(() => {
        AssertionHelpers.assertType('hello', isString);
      }).not.toThrow();

      expect(() => {
        AssertionHelpers.assertType(123, isString);
      }).toThrow();

      expect(() => {
        AssertionHelpers.assertNotNull('value');
      }).not.toThrow();

      expect(() => {
        AssertionHelpers.assertNotNull(null);
      }).toThrow();
    });
  });

  describe('Integration Tests', () => {
    test('validation suite integration', () => {
      const userSuite = createValidationSuite<User>({
        name: 'User',
        interface: {
          name: 'User',
          properties: {
            id: {
              name: 'id',
              type: 'string',
              required: true,
              validator: (value: unknown): value is string => typeof value === 'string'
            },
            name: {
              name: 'name',
              type: 'string',
              required: true,
              validator: (value: unknown): value is string => typeof value === 'string'
            },
            email: {
              name: 'email',
              type: 'string',
              required: false,
              validator: (value: unknown): value is string => typeof value === 'string'
            },
            age: {
              name: 'age',
              type: 'number',
              required: true,
              validator: (value: unknown): value is number => typeof value === 'number'
            },
            preferences: {
              name: 'preferences',
              type: 'object',
              required: true,
              validator: (value: unknown): value is Record<string, any> =>
                typeof value === 'object' && value !== null && !Array.isArray(value)
            }
          }
        }
      });

      const validUser = {
        id: '123',
        name: 'John Doe',
        age: 30,
        preferences: { theme: 'dark' }
      };

      const result = userSuite.validate(validUser);

      expect(result.isValid).toBe(true);
      expect(result.typeValid).toBe(true);
      expect(result.interfaceValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('quick validators', () => {
      expect(QuickValidators.stringRecord({ name: 'John', email: 'john@example.com' })).toBe(true);
      expect(QuickValidators.stringRecord({ name: 'John', age: 30 })).toBe(false);

      expect(QuickValidators.objectArray([{ id: 1 }, { id: 2 }])).toBe(true);
      expect(QuickValidators.objectArray(['not', 'objects'])).toBe(false);

      const apiResponse = {
        data: { users: [] },
        loading: false,
        error: null
      };
      expect(QuickValidators.apiResponse(apiResponse)).toBe(true);
    });

    test('testing patterns for CRUD operations', () => {
      const userFactory = (): User => ({
        id: '123',
        name: 'John Doe',
        age: 30,
        preferences: {}
      });

      const isUser = (obj: unknown): obj is User => {
        return typeof obj === 'object' &&
               obj !== null &&
               'id' in obj &&
               'name' in obj &&
               'age' in obj &&
               'preferences' in obj;
      };

      const crudTests = TestingPatterns.createCrudTests('User', isUser, userFactory);

      expect(crudTests.create.valid.length).toBeGreaterThan(0);
      expect(crudTests.create.invalid.length).toBeGreaterThan(0);
      expect(crudTests.read.validIds.length).toBeGreaterThan(0);
      expect(crudTests.update.valid.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle null and undefined correctly', () => {
      const typeChecker = new TypeChecker();

      expect(typeChecker.validateNull(null)).toBe(true);
      expect(typeChecker.validateNull(undefined)).toBe(false);

      expect(typeChecker.validateUndefined(undefined)).toBe(true);
      expect(typeChecker.validateUndefined(null)).toBe(false);
    });

    test('should handle circular references gracefully', () => {
      const obj: any = { name: 'test' };
      obj.self = obj; // circular reference

      const typeChecker = new TypeChecker();

      // Should not throw, even with circular references
      expect(() => {
        typeChecker.validateObject(obj);
      }).not.toThrow();
    });

    test('should handle edge case values', () => {
      const typeChecker = new TypeChecker();

      // Special number values
      expect(typeChecker.validateNumber(Infinity)).toBe(true);
      expect(typeChecker.validateNumber(-Infinity)).toBe(true);
      expect(typeChecker.validateNumber(NaN)).toBe(false);

      // Empty collections
      expect(typeChecker.validateArray([])).toBe(true);
      expect(typeChecker.validateObject({})).toBe(true);

      // Function edge cases
      expect(typeChecker.createTypePredicate(() => true)(undefined)).toBe(true);
      expect(typeChecker.createTypePredicate(() => false)(undefined)).toBe(false);
    });
  });
});

// Compile-time tests (these don't run but ensure type safety)
namespace CompileTimeValidation {
  // Test that expectType works at compile time
  const stringValue: string = 'hello';
  const numberValue: number = 42;

  expectType<string>(stringValue); // ✓
  expectType<number>(numberValue); // ✓
  // expectType<string>(numberValue); // ✗ Would cause compile error

  // Test discriminated union exhaustiveness
  type Color = 'red' | 'green' | 'blue';

  function handleColor(color: Color): string {
    switch (color) {
      case 'red':
        return '#ff0000';
      case 'green':
        return '#00ff00';
      case 'blue':
        return '#0000ff';
      default:
        return assertNever(color); // Ensures all cases are handled
    }
  }

  // Test generic type constraints
  interface HasId {
    id: string;
  }

  function processEntity<T extends HasId>(entity: T): T {
    return { ...entity, id: entity.id.toUpperCase() };
  }

  // These would compile successfully
  const user: User = { id: '1', name: 'John', age: 30, preferences: {} };
  const processedUser = processEntity(user);

  // This would cause a compile error:
  // const invalidEntity = { name: 'No ID' };
  // processEntity(invalidEntity); // ✗ Missing 'id' property
}