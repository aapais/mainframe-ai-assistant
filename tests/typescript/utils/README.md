# TypeScript Testing Utilities

A comprehensive suite of TypeScript testing utilities for compile-time and runtime type validation, interface compliance checking, and advanced testing patterns.

## Overview

This module provides powerful utilities for:
- **Type Checking**: Compile-time and runtime type validation
- **React Prop Validation**: Schema-based component prop validation
- **Generic Type Testing**: Type parameter validation and constraint checking
- **Interface Validation**: Structural typing and duck typing verification
- **Test Helpers**: Assertion utilities, mocks, and testing patterns

## Quick Start

```typescript
import {
  TypeChecker,
  PropValidator,
  GenericTypeTest,
  InterfaceValidator,
  expectType,
  assertNever
} from './index';

// Basic type checking
const checker = new TypeChecker();
checker.validateString('hello'); // true

// Compile-time assertions
expectType<string>('hello'); // ✓ passes at compile time

// Interface validation
const validator = new InterfaceValidator(userInterface);
validator.validateInterface(userData); // boolean
```

## Core Modules

### 1. TypeChecker (`/TypeChecker.ts`)

Comprehensive type checking utilities for both compile-time and runtime validation.

**Features:**
- Basic type validation (string, number, boolean, array, object)
- Shape validation for object interfaces
- Type predicate creation
- Union type validation
- Compile-time type assertions

**Usage:**
```typescript
import { TypeChecker, expectType } from './TypeChecker';

const checker = new TypeChecker();

// Runtime validation
checker.validateString('hello'); // true
checker.validateNumber(42); // true
checker.validateArray([1, 2, 3], checker.validateNumber); // true

// Object shape validation
const userShape = {
  id: checker.validateString,
  name: checker.validateString,
  age: checker.validateNumber
};
checker.validateShape(userData, userShape); // boolean

// Compile-time type checking
expectType<string>('hello'); // ✓
expectType<number>('hello'); // ✗ compile error
```

### 2. PropValidator (`/PropValidator.ts`)

React component prop validation with schema-based approach.

**Features:**
- Required vs optional prop checking
- Type validation with custom validators
- Default value application
- Detailed validation results
- HOC for runtime prop validation

**Usage:**
```typescript
import { PropValidator, createPropSchema, PropTypeValidators } from './PropValidator';

interface ButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
}

const buttonSchema = createPropSchema<ButtonProps>({
  label: {
    type: 'string',
    required: true,
    validator: PropTypeValidators.string
  },
  onClick: {
    type: 'function',
    required: true,
    validator: PropTypeValidators.function
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
const result = validator.validateProps(props);
```

### 3. GenericTypeTest (`/GenericTypeTest.ts`)

Advanced generic type testing and constraint validation.

**Features:**
- Generic component type testing
- Type parameter validation
- Constraint checking
- Type inference testing
- Conditional type testing

**Usage:**
```typescript
import { GenericTypeTest, validateConstraints } from './GenericTypeTest';

// Test generic constraints
interface Serializable {
  serialize(): string;
}

const test = new GenericTypeTest<Serializable>();

// Create constraint validator
const constraint = test.createConstraintValidator<{ id: string }>(
  (value): value is Serializable & { id: string } => {
    return typeof value === 'object' &&
           value !== null &&
           'serialize' in value &&
           'id' in value;
  }
);

// Compile-time constraint validation
validateConstraints<User, Serializable>(); // true if User extends Serializable
```

### 4. InterfaceValidator (`/InterfaceValidator.ts`)

Interface compliance and structural type validation.

**Features:**
- Interface compliance checking
- Structural typing (duck typing)
- Index signature validation
- Detailed validation results
- Method signature validation

**Usage:**
```typescript
import { InterfaceValidator, createInterfaceValidator, checkDuckTyping } from './InterfaceValidator';

// Define interface schema
const userInterface = {
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
    age: {
      name: 'age',
      type: 'number',
      required: true,
      validator: (value: unknown): value is number => typeof value === 'number'
    }
  }
};

const validator = createInterfaceValidator(userInterface);

// Strict interface validation
validator.validateInterface(userData); // boolean

// Structural typing (duck typing)
validator.validateStructural(someObject); // boolean

// Duck typing helper
checkDuckTyping(obj, {
  properties: ['type', 'target'],
  methods: ['preventDefault', 'stopPropagation']
});
```

### 5. TestHelpers (`/TestHelpers.ts`)

Comprehensive testing utilities and helper functions.

**Features:**
- `expectType<T>()` for compile-time type assertions
- `assertNever()` for exhaustiveness checking
- Type predicate testing
- Discriminated union validators
- Mock utilities
- Performance testing

**Usage:**
```typescript
import {
  expectType,
  assertNever,
  TypePredicateTests,
  DiscriminatedUnionTests,
  MockUtilities
} from './TestHelpers';

// Compile-time type checking
expectType<string>('hello'); // ✓
expectType<number>('hello'); // ✗ compile error

// Exhaustiveness checking
function handleTheme(theme: 'light' | 'dark' | 'auto'): string {
  switch (theme) {
    case 'light': return '#ffffff';
    case 'dark': return '#000000';
    case 'auto': return 'system';
    default: return assertNever(theme); // Ensures all cases handled
  }
}

// Type predicate testing
const isString = (value: unknown): value is string => typeof value === 'string';
const test = TypePredicateTests.createTypePredicateTest(
  isString,
  ['hello', 'world'], // true cases
  [123, true, null] // false cases
);

// Discriminated union handling
type APIResponse =
  | { status: 'loading' }
  | { status: 'success'; data: any }
  | { status: 'error'; error: string };

const handler = DiscriminatedUnionTests.createDiscriminatedHandler<APIResponse>();
const responseHandler = handler({
  loading: () => 'Loading...',
  success: (response) => `Data: ${JSON.stringify(response.data)}`,
  error: (response) => `Error: ${response.error}`
});

// Mock utilities
interface UserService {
  getUser(id: string): Promise<User>;
  createUser(data: Partial<User>): Promise<User>;
}

const mock = MockUtilities.createSpyMock<UserService>();
mock.getUser('123');
console.log(mock.getUser.callCount); // 1
```

## Convenience Functions

### Validation Suite Factory

Create comprehensive validation suites that combine multiple validators:

```typescript
import { createValidationSuite } from './index';

const userSuite = createValidationSuite<User>({
  name: 'User',
  interface: userInterfaceDefinition,
  propSchema: userPropSchema
});

const result = userSuite.validate(userData);
// Returns: { isValid, typeValid, interfaceValid, propValid, errors }
```

### Quick Validators

Common validation patterns for immediate use:

```typescript
import { QuickValidators } from './index';

// Validate string record
QuickValidators.stringRecord({ name: 'John', email: 'john@example.com' }); // true

// Validate object array
QuickValidators.objectArray([{ id: 1 }, { id: 2 }]); // true

// Validate API response structure
QuickValidators.apiResponse({
  data: { users: [] },
  loading: false,
  error: null
}); // true
```

### Testing Patterns

Pre-built test case generators for common scenarios:

```typescript
import { TestingPatterns } from './index';

// CRUD operation tests
const crudTests = TestingPatterns.createCrudTests(
  'User',
  isUserValidator,
  userFactory
);

// Form validation tests
const formTests = TestingPatterns.createFormTests(userPropSchema);
```

## Advanced Features

### Performance Testing

```typescript
import { PerformanceTests } from './TestHelpers';

const performance = PerformanceTests.measureTypeCheckingTime(
  validator,
  testCases,
  1000 // iterations
);

console.log(`Average time: ${performance.averageTime}ms`);
console.log(`Operations per second: ${performance.operationsPerSecond}`);
```

### Compile-Time Type Testing

```typescript
// Type equality assertions
type StringTest = Assert<TypesEqual<string, string>>; // ✓
type NumberTest = TypesEqual<string, number>; // false

// Generic constraint validation
type UserExtendsSerializable = Extends<User, Serializable>; // boolean

// Conditional type testing
type TestResult = TestConditionalType<string, any, true>; // validates behavior
```

### Mock and Spy Utilities

```typescript
import { MockUtilities } from './TestHelpers';

// Create type-safe mocks
const userService = MockUtilities.createSpyMock<UserService>();

// Create test data factories
const userFactory = MockUtilities.createFactory<User>({
  id: '123',
  name: 'John Doe',
  age: 30,
  preferences: {}
});

const testUser = userFactory({ age: 25 }); // Overrides age, keeps other defaults
```

## File Structure

```
/tests/typescript/utils/
├── TypeChecker.ts          # Core type checking utilities
├── PropValidator.ts        # React prop validation
├── GenericTypeTest.ts      # Generic type testing
├── InterfaceValidator.ts   # Interface validation
├── TestHelpers.ts          # Test helpers and utilities
├── index.ts               # Main export file
├── utils.test.ts          # Comprehensive test suite
└── README.md              # This documentation
```

## Usage Examples

### Example 1: API Response Validation

```typescript
import { createValidationSuite, QuickValidators } from './index';

interface APIResponse<T> {
  data?: T;
  error?: string;
  loading: boolean;
  timestamp: Date;
}

// Validate any API response
const isValidAPIResponse = <T>(
  response: unknown,
  dataValidator?: (data: unknown) => data is T
): response is APIResponse<T> => {
  return QuickValidators.apiResponse(response, dataValidator);
};

// Usage
const userResponse = await fetchUser('123');
if (isValidAPIResponse(userResponse, isUser)) {
  // TypeScript now knows userResponse.data is User | undefined
  console.log(userResponse.data?.name);
}
```

### Example 2: Form Validation

```typescript
import { PropValidator, createPropSchema, PropTypeValidators } from './index';

interface LoginForm {
  username: string;
  password: string;
  rememberMe?: boolean;
}

const loginSchema = createPropSchema<LoginForm>({
  username: {
    type: 'string',
    required: true,
    validator: (value): value is string =>
      typeof value === 'string' && value.length >= 3
  },
  password: {
    type: 'string',
    required: true,
    validator: (value): value is string =>
      typeof value === 'string' && value.length >= 8
  },
  rememberMe: {
    type: 'boolean',
    required: false,
    validator: PropTypeValidators.boolean,
    defaultValue: false
  }
});

const formValidator = new PropValidator(loginSchema);

// Validate form data
const validateLoginForm = (formData: unknown): formData is LoginForm => {
  const result = formValidator.validateProps(formData);
  if (!result.valid) {
    console.error('Form validation errors:', result.errors);
    return false;
  }
  return true;
};
```

### Example 3: Generic Component Testing

```typescript
import { GenericComponentTest, GenericTypeTest } from './index';

// Generic List component
interface ListProps<T> {
  items: T[];
  renderItem: (item: T) => React.ReactNode;
  keyExtractor?: (item: T) => string;
}

const List = <T,>(props: ListProps<T>) => {
  return React.createElement('div', null,
    props.items.map((item, index) =>
      React.createElement('div',
        { key: props.keyExtractor ? props.keyExtractor(item) : index },
        props.renderItem(item)
      )
    )
  );
};

// Test the generic component
const listTester = new GenericComponentTest(List);

const stringListProps: ListProps<string> = {
  items: ['a', 'b', 'c'],
  renderItem: (item) => item,
  keyExtractor: (item) => item
};

const isValid = listTester.testWithProps(stringListProps); // true
```

## Best Practices

1. **Use Compile-Time Validation**: Prefer `expectType<T>()` for compile-time checks
2. **Combine Validators**: Use `createValidationSuite()` for comprehensive validation
3. **Schema-Based Validation**: Define schemas for reusable validation logic
4. **Type-Safe Mocks**: Use `MockUtilities` for type-safe test doubles
5. **Exhaustiveness Checking**: Always use `assertNever()` in switch statements
6. **Performance Testing**: Measure validator performance for critical paths

## Integration with Testing Frameworks

### Jest Integration

```typescript
// jest.config.js
module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
  ],
};

// In your tests
import { TypeChecker, expectType } from '@tests/typescript/utils';

describe('User Service', () => {
  test('should validate user objects', () => {
    const checker = new TypeChecker();
    const user = { id: '123', name: 'John', age: 30 };

    expect(checker.validateObject(user)).toBe(true);

    // Compile-time type checking
    expectType<{ id: string; name: string; age: number }>(user);
  });
});
```

## Contributing

When adding new utilities:

1. Follow the existing patterns and interfaces
2. Include comprehensive documentation and examples
3. Add tests to `utils.test.ts`
4. Update this README with usage examples
5. Ensure TypeScript strict mode compatibility

## License

This module is part of the mainframe-ai-assistant project and follows the same licensing terms.