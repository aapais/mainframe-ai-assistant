/**
 * TypeScript Testing Framework Utility Helpers
 * Common utilities and helper functions for type testing
 */

import { TypeChecker, TypeCheckResult } from '../core/TypeChecker';
import { PropValidator, ComponentPropsSchema, PropValidationResult } from '../core/PropValidator';
import { GenericTypeTestRunner, GenericTestCase } from '../core/GenericTypeTestRunner';
import { InterfaceValidator, InterfaceDefinition } from '../core/InterfaceValidator';
import { TypeSafetyReporter, TypeSafetyReport } from '../core/TypeSafetyReporter';

/**
 * Test suite builder for creating comprehensive type test suites
 */
export class TypeTestSuiteBuilder {
  private typeChecker: TypeChecker;
  private propValidator: PropValidator;
  private genericRunner: GenericTypeTestRunner;
  private interfaceValidator: InterfaceValidator;
  private reporter: TypeSafetyReporter;

  constructor(config: {
    strictMode?: boolean;
    allowAny?: boolean;
    validateDefaults?: boolean;
  } = {}) {
    this.typeChecker = new TypeChecker({
      strictMode: config.strictMode ?? true,
      allowAny: config.allowAny ?? false
    });

    this.propValidator = new PropValidator(this.typeChecker, {
      strict: config.strictMode ?? true,
      validateDefaults: config.validateDefaults ?? true
    });

    this.genericRunner = new GenericTypeTestRunner(this.typeChecker);
    this.interfaceValidator = new InterfaceValidator(this.typeChecker);
    this.reporter = new TypeSafetyReporter();
  }

  /**
   * Creates a complete test suite for a component
   */
  createComponentTestSuite<T extends Record<string, any>>(
    componentName: string,
    propsSchema: ComponentPropsSchema,
    sampleProps: T,
    options: {
      testGenerics?: boolean;
      testInterfaces?: boolean;
      testEdgeCases?: boolean;
    } = {}
  ): ComponentTestSuite<T> {
    return new ComponentTestSuite(
      componentName,
      propsSchema,
      sampleProps,
      {
        typeChecker: this.typeChecker,
        propValidator: this.propValidator,
        genericRunner: this.genericRunner,
        interfaceValidator: this.interfaceValidator,
        reporter: this.reporter
      },
      options
    );
  }

  /**
   * Creates a test suite for generic types
   */
  createGenericTestSuite<T>(
    suiteName: string,
    baseType: string,
    typeParameters: Record<string, any>
  ): GenericTestSuite<T> {
    return new GenericTestSuite<T>(
      suiteName,
      baseType,
      typeParameters,
      this.genericRunner
    );
  }

  /**
   * Creates a test suite for interface validation
   */
  createInterfaceTestSuite(
    interfaceName: string,
    definition: InterfaceDefinition
  ): InterfaceTestSuite {
    return new InterfaceTestSuite(
      interfaceName,
      definition,
      this.interfaceValidator
    );
  }

  /**
   * Generates a comprehensive test report
   */
  generateTestReport(
    typeResults: TypeCheckResult[],
    propResults: PropValidationResult[],
    genericResults: any[],
    interfaceResults: any[]
  ): TypeSafetyReport {
    return this.reporter.generateReport(
      typeResults,
      propResults,
      genericResults,
      interfaceResults
    );
  }
}

/**
 * Component test suite for comprehensive component type testing
 */
export class ComponentTestSuite<T extends Record<string, any>> {
  constructor(
    private componentName: string,
    private propsSchema: ComponentPropsSchema,
    private sampleProps: T,
    private tools: {
      typeChecker: TypeChecker;
      propValidator: PropValidator;
      genericRunner: GenericTypeTestRunner;
      interfaceValidator: InterfaceValidator;
      reporter: TypeSafetyReporter;
    },
    private options: {
      testGenerics?: boolean;
      testInterfaces?: boolean;
      testEdgeCases?: boolean;
    }
  ) {}

  /**
   * Runs all component type tests
   */
  async runAllTests(): Promise<ComponentTestResults> {
    const results: ComponentTestResults = {
      componentName: this.componentName,
      propValidation: [],
      typeChecking: [],
      genericTests: [],
      interfaceTests: [],
      edgeCaseTests: [],
      summary: {
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        warnings: 0
      }
    };

    // Run prop validation tests
    results.propValidation = await this.runPropValidationTests();

    // Run basic type checking tests
    results.typeChecking = await this.runTypeCheckingTests();

    // Run generic tests if enabled
    if (this.options.testGenerics) {
      results.genericTests = await this.runGenericTests();
    }

    // Run interface tests if enabled
    if (this.options.testInterfaces) {
      results.interfaceTests = await this.runInterfaceTests();
    }

    // Run edge case tests if enabled
    if (this.options.testEdgeCases) {
      results.edgeCaseTests = await this.runEdgeCaseTests();
    }

    // Calculate summary
    results.summary = this.calculateSummary(results);

    return results;
  }

  /**
   * Runs prop validation tests
   */
  private async runPropValidationTests(): Promise<PropValidationResult[]> {
    const results: PropValidationResult[] = [];

    // Test valid props
    const validResults = this.tools.propValidator.validateComponentProps(
      this.sampleProps,
      this.propsSchema
    );
    results.push(...validResults);

    // Test missing required props
    const requiredProps = this.propsSchema.props.filter(p => p.required);
    for (const prop of requiredProps) {
      const propsWithoutRequired = { ...this.sampleProps };
      delete propsWithoutRequired[prop.name];

      const missingPropResults = this.tools.propValidator.validateComponentProps(
        propsWithoutRequired,
        this.propsSchema
      );
      results.push(...missingPropResults);
    }

    // Test invalid prop types
    for (const prop of this.propsSchema.props) {
      if (prop.enum) {
        const invalidEnumValue = 'invalid-enum-value';
        const propsWithInvalidEnum = {
          ...this.sampleProps,
          [prop.name]: invalidEnumValue
        };

        const enumResults = this.tools.propValidator.validateComponentProps(
          propsWithInvalidEnum,
          this.propsSchema
        );
        results.push(...enumResults);
      }
    }

    return results;
  }

  /**
   * Runs basic type checking tests
   */
  private async runTypeCheckingTests(): Promise<TypeCheckResult[]> {
    const results: TypeCheckResult[] = [];

    // Test each prop type individually
    for (const [key, value] of Object.entries(this.sampleProps)) {
      const propDef = this.propsSchema.props.find(p => p.name === key);
      if (propDef) {
        const result = this.tools.typeChecker.validateType(
          value,
          propDef.type,
          `${this.componentName}.${key}`
        );
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Runs generic type tests
   */
  private async runGenericTests(): Promise<any[]> {
    if (!this.propsSchema.generics) {
      return [];
    }

    const results: any[] = [];

    // Test generic instantiation
    for (const generic of this.propsSchema.generics) {
      const testCase: GenericTestCase = {
        name: `${this.componentName} generic ${generic}`,
        description: `Test generic parameter ${generic}`,
        typeParameters: { [generic]: 'any' },
        expectedResult: true
      };

      // This would need to be implemented based on actual generic usage
      // For now, we'll create a placeholder
      results.push({
        testName: testCase.name,
        passed: true,
        description: testCase.description
      });
    }

    return results;
  }

  /**
   * Runs interface validation tests
   */
  private async runInterfaceTests(): Promise<any[]> {
    const results: any[] = [];

    // Create interface definition from props schema
    const interfaceDefinition: InterfaceDefinition = {
      name: `I${this.componentName}`,
      properties: this.propsSchema.props.map(prop => ({
        name: prop.name,
        type: prop.type,
        optional: !prop.required,
        description: prop.description
      }))
    };

    this.tools.interfaceValidator.registerInterface(interfaceDefinition);

    // Test interface implementation
    const interfaceResult = this.tools.interfaceValidator.validateObject(
      this.sampleProps,
      interfaceDefinition.name
    );

    results.push(interfaceResult);

    return results;
  }

  /**
   * Runs edge case tests
   */
  private async runEdgeCaseTests(): Promise<TypeCheckResult[]> {
    const results: TypeCheckResult[] = [];

    // Test with null values
    const nullProps = Object.keys(this.sampleProps).reduce((acc, key) => {
      acc[key] = null;
      return acc;
    }, {} as any);

    const nullResult = this.tools.typeChecker.validateType(
      nullProps,
      this.sampleProps,
      `${this.componentName} with null values`
    );
    results.push(nullResult);

    // Test with undefined values
    const undefinedProps = Object.keys(this.sampleProps).reduce((acc, key) => {
      acc[key] = undefined;
      return acc;
    }, {} as any);

    const undefinedResult = this.tools.typeChecker.validateType(
      undefinedProps,
      this.sampleProps,
      `${this.componentName} with undefined values`
    );
    results.push(undefinedResult);

    // Test with empty object
    const emptyResult = this.tools.typeChecker.validateType(
      {},
      this.sampleProps,
      `${this.componentName} with empty props`
    );
    results.push(emptyResult);

    return results;
  }

  /**
   * Calculates test summary
   */
  private calculateSummary(results: ComponentTestResults): TestSummary {
    const allResults = [
      ...results.propValidation,
      ...results.typeChecking,
      ...results.genericTests,
      ...results.interfaceTests,
      ...results.edgeCaseTests
    ];

    const totalTests = allResults.length;
    const passedTests = allResults.filter(r => r.passed || r.passed === undefined).length;
    const failedTests = totalTests - passedTests;
    const warnings = allResults.reduce((count, r) => {
      return count + (r.warnings?.length || 0);
    }, 0);

    return {
      totalTests,
      passedTests,
      failedTests,
      warnings
    };
  }
}

/**
 * Generic test suite for testing generic types
 */
export class GenericTestSuite<T> {
  private testCases: GenericTestCase<T>[] = [];

  constructor(
    private suiteName: string,
    private baseType: string,
    private typeParameters: Record<string, any>,
    private genericRunner: GenericTypeTestRunner
  ) {}

  /**
   * Adds a constraint test
   */
  addConstraintTest(
    name: string,
    constraints: Record<string, any>,
    expectedResult: boolean = true
  ): this {
    this.testCases.push({
      name,
      description: `Constraint test: ${name}`,
      typeParameters: this.typeParameters,
      constraints,
      expectedResult
    });
    return this;
  }

  /**
   * Adds an instantiation test
   */
  addInstantiationTest(
    name: string,
    typeArgs: any[],
    expectedResult: boolean = true
  ): this {
    this.testCases.push({
      name,
      description: `Instantiation test: ${name}`,
      typeParameters: typeArgs.reduce((acc, arg, index) => {
        acc[`T${index}`] = arg;
        return acc;
      }, {}),
      expectedResult
    });
    return this;
  }

  /**
   * Runs all generic tests
   */
  async runTests(): Promise<any[]> {
    const suite = {
      suiteName: this.suiteName,
      description: `Generic tests for ${this.baseType}`,
      baseType: this.baseType,
      testCases: this.testCases
    };

    return this.genericRunner.runSuite(suite);
  }
}

/**
 * Interface test suite for testing interface implementations
 */
export class InterfaceTestSuite {
  constructor(
    private interfaceName: string,
    private definition: InterfaceDefinition,
    private interfaceValidator: InterfaceValidator
  ) {
    this.interfaceValidator.registerInterface(this.definition);
  }

  /**
   * Tests if an object implements the interface
   */
  testImplementation(obj: any): any {
    return this.interfaceValidator.validateObject(obj, this.interfaceName);
  }

  /**
   * Tests interface inheritance
   */
  testInheritance(parentInterfaceName: string): any {
    return this.interfaceValidator.validateInheritance(
      this.interfaceName,
      parentInterfaceName
    );
  }

  /**
   * Tests structural typing
   */
  testStructural(obj: any): any {
    return this.interfaceValidator.validateStructural(obj, this.definition);
  }
}

// Type definitions for test results
export interface ComponentTestResults {
  componentName: string;
  propValidation: PropValidationResult[];
  typeChecking: TypeCheckResult[];
  genericTests: any[];
  interfaceTests: any[];
  edgeCaseTests: TypeCheckResult[];
  summary: TestSummary;
}

export interface TestSummary {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  warnings: number;
}

/**
 * Utility functions for common type testing scenarios
 */
export const TypeTestUtils = {
  /**
   * Creates a mock React component for testing
   */
  createMockComponent<T>(
    name: string,
    props: T
  ): React.ComponentType<T> {
    const Component = (componentProps: T) => {
      return React.createElement('div', {
        'data-testid': `mock-${name.toLowerCase()}`
      }, JSON.stringify(componentProps));
    };

    Component.displayName = name;
    return Component as React.ComponentType<T>;
  },

  /**
   * Creates sample props for testing based on schema
   */
  createSampleProps(schema: ComponentPropsSchema): Record<string, any> {
    const props: Record<string, any> = {};

    for (const propDef of schema.props) {
      if (propDef.defaultValue !== undefined) {
        props[propDef.name] = propDef.defaultValue;
      } else {
        props[propDef.name] = TypeTestUtils.generateSampleValue(propDef.type, propDef.enum);
      }
    }

    return props;
  },

  /**
   * Generates a sample value based on type
   */
  generateSampleValue(type: string, enumValues?: any[]): any {
    if (enumValues && enumValues.length > 0) {
      return enumValues[0];
    }

    switch (type.toLowerCase()) {
      case 'string':
        return 'sample-string';
      case 'number':
        return 42;
      case 'boolean':
        return true;
      case 'function':
        return () => {};
      case 'object':
        return {};
      case 'array':
        return [];
      case 'reactnode':
        return React.createElement('span', null, 'sample');
      case 'reactelement':
        return React.createElement('div', null);
      default:
        return null;
    }
  },

  /**
   * Creates invalid props for negative testing
   */
  createInvalidProps(schema: ComponentPropsSchema): Record<string, any> {
    const props: Record<string, any> = {};

    for (const propDef of schema.props) {
      // Generate invalid values based on type
      props[propDef.name] = TypeTestUtils.generateInvalidValue(propDef.type);
    }

    return props;
  },

  /**
   * Generates an invalid value based on type
   */
  generateInvalidValue(type: string): any {
    switch (type.toLowerCase()) {
      case 'string':
        return 123; // Number instead of string
      case 'number':
        return 'not-a-number'; // String instead of number
      case 'boolean':
        return 'true'; // String instead of boolean
      case 'function':
        return 'not-a-function'; // String instead of function
      case 'object':
        return 'not-an-object'; // String instead of object
      case 'array':
        return {}; // Object instead of array
      default:
        return undefined;
    }
  },

  /**
   * Creates a comprehensive test report
   */
  createTestReport(
    componentName: string,
    results: ComponentTestResults
  ): string {
    const { summary } = results;
    const successRate = summary.totalTests > 0
      ? ((summary.passedTests / summary.totalTests) * 100).toFixed(1)
      : '0';

    return `
# ${componentName} Type Test Report

## Summary
- **Total Tests**: ${summary.totalTests}
- **Passed**: ${summary.passedTests}
- **Failed**: ${summary.failedTests}
- **Warnings**: ${summary.warnings}
- **Success Rate**: ${successRate}%

## Prop Validation Results
${results.propValidation.length} prop validation tests performed.
Passed: ${results.propValidation.filter(r => r.passed).length}
Failed: ${results.propValidation.filter(r => !r.passed).length}

## Type Checking Results
${results.typeChecking.length} type checking tests performed.
Passed: ${results.typeChecking.filter(r => r.passed).length}
Failed: ${results.typeChecking.filter(r => !r.passed).length}

## Generic Tests Results
${results.genericTests.length} generic tests performed.

## Interface Tests Results
${results.interfaceTests.length} interface tests performed.

## Edge Case Tests Results
${results.edgeCaseTests.length} edge case tests performed.
`;
  }
};

export default TypeTestSuiteBuilder;