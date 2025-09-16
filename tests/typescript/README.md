# TypeScript Testing Framework

A comprehensive TypeScript testing framework for UI components, providing advanced type checking, prop validation, generic type testing, and interface validation capabilities.

## 🚀 Features

- **TypeChecker**: Core utility for TypeScript type validation and checking
- **PropValidator**: Specialized validation for React component props
- **GenericTypeTestRunner**: Advanced testing for generic types and constraints
- **InterfaceValidator**: Comprehensive interface validation and structural typing
- **TypeSafetyReporter**: Detailed reporting and analysis for type safety metrics
- **Custom Jest Matchers**: Extended Jest matchers for type testing
- **CI/CD Integration**: Automated scripts for continuous integration

## 📁 Framework Structure

```
tests/typescript/
├── core/                           # Core framework utilities
│   ├── TypeChecker.ts             # Main type checking utility
│   ├── PropValidator.ts           # Component prop validation
│   ├── GenericTypeTestRunner.ts   # Generic type testing
│   ├── InterfaceValidator.ts      # Interface validation
│   └── TypeSafetyReporter.ts      # Reporting and analysis
├── config/                        # Configuration files
│   ├── tsconfig.test.json         # TypeScript test configuration
│   ├── type-test.config.ts        # Framework configuration
│   ├── jest.typescript.config.js  # Jest configuration
│   ├── jest.setup.ts              # Jest setup and custom matchers
│   └── ci-scripts.ts              # CI/CD integration scripts
├── patterns/                      # Test patterns and examples
│   └── TypeTestPatterns.md        # Comprehensive test patterns guide
├── examples/                      # Example implementations
│   └── ComponentTypeTests.test.ts # Real-world component tests
├── utils/                         # Utility helpers
│   └── TypeTestHelpers.ts         # Test suite builders and utilities
└── README.md                      # This file
```

## 🛠️ Quick Start

### 1. Installation

The framework is already integrated into the project. No additional installation required.

### 2. Basic Usage

```typescript
import { TypeChecker, PropValidator } from '../core';

describe('Component Type Tests', () => {
  let typeChecker: TypeChecker;
  let propValidator: PropValidator;

  beforeEach(() => {
    typeChecker = new TypeChecker({ strictMode: true });
    propValidator = new PropValidator(typeChecker);
  });

  test('should validate component props', () => {
    const props = { text: 'Hello', onClick: () => {} };

    expect(props.text).toBeValidType();
    expect(props.onClick).toBeValidType();
    expect(props).toMatchPropSchema(buttonSchema);
  });
});
```

### 3. Running Tests

```bash
# Run all TypeScript type tests
npm run test:types

# Or use the custom script
./scripts/run-typescript-tests.sh

# Run with coverage
./scripts/run-typescript-tests.sh --coverage

# Run in watch mode
./scripts/run-typescript-tests.sh --watch

# Run in CI mode
./scripts/run-typescript-tests.sh --env ci
```

## 🧪 Core Components

### TypeChecker

The main type validation utility:

```typescript
const typeChecker = new TypeChecker({
  strictMode: true,
  allowAny: false,
  checkGenerics: true
});

// Validate basic types
const result = typeChecker.validateType(value, expectedType);

// Test assignability
const isAssignable = typeChecker.isAssignable(source, target);

// Validate union types
const unionResult = typeChecker.validateUnion(value, unionTypes);

// Validate conditional types
const conditionalResult = typeChecker.validateConditional(
  condition, trueType, falseType
);
```

### PropValidator

Specialized for React component prop validation:

```typescript
const propValidator = new PropValidator(typeChecker, {
  strict: true,
  validateDefaults: true
});

// Validate single prop
const propResult = propValidator.validateProp(
  'onClick',
  handleClick,
  propDefinition
);

// Validate all component props
const results = propValidator.validateComponentProps(props, schema);

// Validate event handlers
const handlerResult = propValidator.validateEventHandler(
  'onClick',
  handler,
  signature
);
```

### GenericTypeTestRunner

For testing generic types and constraints:

```typescript
const genericRunner = new GenericTypeTestRunner(typeChecker);

// Test generic constraints
const constraintResult = genericRunner.testGenericConstraints(
  type,
  constraints
);

// Test variance
const varianceResult = genericRunner.testGenericVariance(
  baseType,
  derivedType,
  'covariant'
);

// Run test suites
await genericRunner.runAllSuites();
```

### InterfaceValidator

For interface validation and structural typing:

```typescript
const interfaceValidator = new InterfaceValidator(typeChecker);

// Register interface
interfaceValidator.registerInterface(interfaceDefinition);

// Validate object against interface
const result = interfaceValidator.validateObject(obj, 'IComponent');

// Test structural typing
const structuralResult = interfaceValidator.validateStructural(
  obj,
  requiredShape
);
```

## 🎯 Custom Jest Matchers

The framework provides custom Jest matchers for type testing:

### Type Checking Matchers

```typescript
expect(value).toBeValidType();
expect(value).toPassTypeCheck();
expect(source).toBeAssignableTo(target);
expect(value).toHaveCorrectTypeSignature();
```

### Prop Validation Matchers

```typescript
expect(value).toBeValidProp(propDefinition);
expect(props).toHaveRequiredProps(['text', 'onClick']);
expect(props).toMatchPropSchema(schema);
```

### Generic Type Matchers

```typescript
expect(value).toSatisfyConstraints(constraints);
expect(value).toBeValidGenericInstantiation();
expect(value).toHaveCorrectVariance('covariant');
```

### Interface Matchers

```typescript
expect(object).toImplementInterface('IComponent');
expect(object).toConformToInterface(interfaceDefinition);
expect(method).toHaveCorrectMethodSignature('render', signature);
```

### Utility Type Matchers

```typescript
expect(partial).toBePartialOf(baseType);
expect(picked).toBePickOf(baseType, ['name', 'email']);
expect(omitted).toBeOmitOf(baseType, ['id']);
```

## 📋 Test Patterns

### Basic Component Testing

```typescript
describe('Button Component', () => {
  test('should validate button props', () => {
    const buttonProps: ButtonProps = {
      text: 'Click me',
      onClick: () => console.log('clicked'),
      variant: 'primary'
    };

    expect(buttonProps).toMatchPropSchema(buttonSchema);
    expect(buttonProps.onClick).toHaveCorrectTypeSignature();
  });
});
```

### Generic Component Testing

```typescript
describe('Generic List Component', () => {
  test('should validate generic props', () => {
    const listProps: ListProps<User> = {
      items: users,
      renderItem: (user) => <UserCard user={user} />,
      keyExtractor: (user) => user.id
    };

    expect(listProps).toSatisfyConstraints({ T: 'User' });
    expect(listProps.renderItem).toHaveCorrectTypeSignature();
  });
});
```

### Union Type Testing

```typescript
describe('Union Types', () => {
  test('should validate union type props', () => {
    type Status = 'loading' | 'success' | 'error';

    const validStatus: Status = 'loading';
    const invalidStatus = 'invalid';

    expect(validStatus).toBeValidType();
    expect(typeChecker.validateUnion(
      validStatus,
      ['loading', 'success', 'error']
    ).passed).toBe(true);
  });
});
```

### Interface Testing

```typescript
describe('Interface Validation', () => {
  test('should validate component interface', () => {
    const component = {
      render: () => <div>Hello</div>,
      props: { text: 'Hello' }
    };

    expect(component).toImplementInterface('IComponent');
  });
});
```

## ⚙️ Configuration

### TypeScript Configuration

The framework uses a specialized TypeScript configuration in `config/tsconfig.test.json`:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "exactOptionalPropertyTypes": true
  }
}
```

### Framework Configuration

Configure the framework behavior in `config/type-test.config.ts`:

```typescript
export const testConfig = createTypeTestConfig('development', {
  typeChecker: {
    strictMode: true,
    allowAny: false
  },
  propValidator: {
    strict: true,
    validateDefaults: true
  }
});
```

### Jest Configuration

The Jest configuration is in `config/jest.typescript.config.js` with custom setup in `config/jest.setup.ts`.

## 🔄 CI/CD Integration

### GitHub Actions

```yaml
name: TypeScript Type Tests
on: [push, pull_request]
jobs:
  type-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      - name: Install dependencies
        run: npm install
      - name: Run type tests
        run: ./scripts/run-typescript-tests.sh --env ci
```

### Manual CI Execution

```bash
# Set environment variables
export CI_ENVIRONMENT=ci
export FAIL_ON_WARNINGS=true

# Run CI pipeline
node -r ts-node/register tests/typescript/config/ci-scripts.ts
```

## 📊 Reporting

### Generate Reports

```typescript
import { TypeSafetyReporter } from './core/TypeSafetyReporter';

const reporter = new TypeSafetyReporter({
  format: 'html',
  includeRecommendations: true
});

const report = reporter.generateReport(
  typeResults,
  propResults,
  genericResults,
  interfaceResults
);

// Export report
await reporter.exportReport(report);
```

### Report Formats

- **JSON**: Machine-readable format for integration
- **HTML**: Rich visual reports with charts
- **Markdown**: Documentation-friendly format
- **PDF**: Printable reports for stakeholders

## 🛡️ Best Practices

### 1. Organize Tests by Complexity

```typescript
// Start simple
describe('Basic Types', () => {});

// Progress to components
describe('Component Props', () => {});

// Advanced generics
describe('Generic Types', () => {});

// Real-world scenarios
describe('Integration Tests', () => {});
```

### 2. Use Descriptive Test Names

```typescript
// Good
test('should validate required string prop with length constraint', () => {});

// Bad
test('should work', () => {});
```

### 3. Test Edge Cases

```typescript
describe('Edge Cases', () => {
  test('should handle null and undefined values', () => {});
  test('should validate empty arrays and objects', () => {});
  test('should handle recursive type definitions', () => {});
});
```

### 4. Leverage Helper Utilities

```typescript
import { TypeTestSuiteBuilder, TypeTestUtils } from './utils/TypeTestHelpers';

const builder = new TypeTestSuiteBuilder();
const componentSuite = builder.createComponentTestSuite(
  'Button',
  buttonSchema,
  sampleProps
);
```

## 🔧 Extending the Framework

### Custom Type Validators

```typescript
export class CustomTypeValidator extends TypeChecker {
  validateCustomType<T>(value: T, customRule: (value: T) => boolean): TypeCheckResult {
    // Custom validation logic
    return {
      passed: customRule(value),
      errors: [],
      warnings: [],
      typeInfo: this.analyzeType(value, value)
    };
  }
}
```

### Custom Jest Matchers

```typescript
expect.extend({
  toBeCustomType(received: any, expectedType: string) {
    // Custom matcher implementation
    return {
      message: () => `Expected ${received} to be custom type ${expectedType}`,
      pass: customValidation(received, expectedType)
    };
  }
});
```

### Adding New Test Patterns

1. Create new pattern in `patterns/` directory
2. Add corresponding utilities in `utils/`
3. Update Jest setup with new matchers
4. Document usage in README

## 📚 Resources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Jest Testing Framework](https://jestjs.io/docs/getting-started)
- [React TypeScript Cheatsheet](https://react-typescript-cheatsheet.netlify.app/)
- [Type-Level TypeScript](https://type-level-typescript.com/)

## 🤝 Contributing

1. Follow the existing code patterns
2. Add tests for new functionality
3. Update documentation
4. Ensure CI passes

## 📄 License

This TypeScript Testing Framework is part of the mainframe-ai-assistant project and follows the same licensing terms.

---

## Support

For questions or issues with the TypeScript Testing Framework:

1. Check the patterns documentation
2. Review example implementations
3. Run the test suite to see working examples
4. Consult the TypeScript handbook for advanced type concepts

Happy Type Testing! 🎉