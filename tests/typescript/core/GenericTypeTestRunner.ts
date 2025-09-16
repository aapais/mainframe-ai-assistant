/**
 * GenericTypeTestRunner - Comprehensive testing utility for generic types
 * Provides advanced testing capabilities for TypeScript generic type parameters
 */

import { TypeChecker, TypeCheckResult } from './TypeChecker';

export interface GenericTestCase<T = any> {
  name: string;
  description: string;
  typeParameters: Record<string, any>;
  constraints?: Record<string, any>;
  expectedResult: boolean;
  errorMessage?: string;
}

export interface GenericTestSuite<T = any> {
  suiteName: string;
  description: string;
  baseType: string;
  testCases: GenericTestCase<T>[];
  setup?: () => void;
  teardown?: () => void;
}

export interface GenericTestResult {
  suiteName: string;
  testName: string;
  passed: boolean;
  actualResult: TypeCheckResult;
  expectedResult: boolean;
  executionTime: number;
  error?: string;
}

export interface GenericTestReport {
  totalSuites: number;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  executionTime: number;
  results: GenericTestResult[];
  coverage: GenericTypeCoverage;
}

export interface GenericTypeCoverage {
  typeParameters: string[];
  constraints: string[];
  instantiations: number;
  edgeCases: number;
  complexTypes: number;
}

/**
 * Advanced generic type testing framework
 */
export class GenericTypeTestRunner {
  private typeChecker: TypeChecker;
  private testSuites: GenericTestSuite[] = [];
  private results: GenericTestResult[] = [];
  private coverage: GenericTypeCoverage = {
    typeParameters: [],
    constraints: [],
    instantiations: 0,
    edgeCases: 0,
    complexTypes: 0
  };

  constructor(typeChecker: TypeChecker) {
    this.typeChecker = typeChecker;
  }

  /**
   * Registers a test suite for generic types
   */
  registerSuite<T>(suite: GenericTestSuite<T>): void {
    this.testSuites.push(suite);
  }

  /**
   * Runs all registered test suites
   */
  async runAllSuites(): Promise<GenericTestReport> {
    const startTime = performance.now();
    this.results = [];
    this.resetCoverage();

    for (const suite of this.testSuites) {
      await this.runSuite(suite);
    }

    const endTime = performance.now();
    const executionTime = endTime - startTime;

    return this.generateReport(executionTime);
  }

  /**
   * Runs a specific test suite
   */
  async runSuite<T>(suite: GenericTestSuite<T>): Promise<GenericTestResult[]> {
    const suiteResults: GenericTestResult[] = [];

    try {
      // Setup
      if (suite.setup) {
        suite.setup();
      }

      // Run test cases
      for (const testCase of suite.testCases) {
        const result = await this.runTestCase(suite, testCase);
        suiteResults.push(result);
        this.results.push(result);
        this.updateCoverage(testCase);
      }

      // Teardown
      if (suite.teardown) {
        suite.teardown();
      }
    } catch (error) {
      console.error(`Error running suite ${suite.suiteName}:`, error);
    }

    return suiteResults;
  }

  /**
   * Runs a single test case
   */
  async runTestCase<T>(
    suite: GenericTestSuite<T>,
    testCase: GenericTestCase<T>
  ): Promise<GenericTestResult> {
    const startTime = performance.now();

    try {
      const actualResult = this.executeGenericTypeTest(testCase);
      const passed = (actualResult.passed === testCase.expectedResult);

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      return {
        suiteName: suite.suiteName,
        testName: testCase.name,
        passed,
        actualResult,
        expectedResult: testCase.expectedResult,
        executionTime,
        error: passed ? undefined : testCase.errorMessage
      };
    } catch (error) {
      const endTime = performance.now();
      const executionTime = endTime - startTime;

      return {
        suiteName: suite.suiteName,
        testName: testCase.name,
        passed: false,
        actualResult: {
          passed: false,
          errors: [error instanceof Error ? error.message : String(error)],
          warnings: [],
          typeInfo: {
            typeName: 'Error',
            isGeneric: false,
            parameters: [],
            constraints: [],
            assignability: {
              assignableFrom: [],
              assignableTo: [],
              exactMatch: false
            }
          }
        },
        expectedResult: testCase.expectedResult,
        executionTime,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Tests generic type constraints
   */
  testGenericConstraints<T extends Record<string, any>>(
    type: T,
    constraints: Record<string, any>,
    description: string = 'Generic constraint test'
  ): TypeCheckResult {
    return this.typeChecker.validateGeneric(type, constraints);
  }

  /**
   * Tests generic type instantiation
   */
  testGenericInstantiation<T, U>(
    genericType: new (...args: any[]) => T,
    typeArguments: any[],
    expectedType: U,
    description: string = 'Generic instantiation test'
  ): TypeCheckResult {
    try {
      const instance = new genericType(...typeArguments);
      return this.typeChecker.validateType(instance, expectedType, description);
    } catch (error) {
      return {
        passed: false,
        errors: [error instanceof Error ? error.message : String(error)],
        warnings: [],
        typeInfo: {
          typeName: 'InstantiationError',
          isGeneric: true,
          parameters: typeArguments.map(arg => this.getTypeName(arg)),
          constraints: [],
          assignability: {
            assignableFrom: [],
            assignableTo: [this.getTypeName(expectedType)],
            exactMatch: false
          }
        }
      };
    }
  }

  /**
   * Tests generic type variance (covariance, contravariance, invariance)
   */
  testGenericVariance<T, U>(
    baseType: T,
    derivedType: U,
    varianceType: 'covariant' | 'contravariant' | 'invariant',
    description: string = 'Generic variance test'
  ): TypeCheckResult {
    switch (varianceType) {
      case 'covariant':
        return this.testCovariance(baseType, derivedType, description);
      case 'contravariant':
        return this.testContravariance(baseType, derivedType, description);
      case 'invariant':
        return this.testInvariance(baseType, derivedType, description);
      default:
        throw new Error(`Unknown variance type: ${varianceType}`);
    }
  }

  /**
   * Tests mapped types
   */
  testMappedType<T extends Record<string, any>>(
    sourceType: T,
    mappingFunction: (key: keyof T, value: T[keyof T]) => any,
    expectedType: any,
    description: string = 'Mapped type test'
  ): TypeCheckResult {
    try {
      const mappedType = this.applyMapping(sourceType, mappingFunction);
      return this.typeChecker.validateType(mappedType, expectedType, description);
    } catch (error) {
      return {
        passed: false,
        errors: [error instanceof Error ? error.message : String(error)],
        warnings: [],
        typeInfo: {
          typeName: 'MappedTypeError',
          isGeneric: true,
          parameters: Object.keys(sourceType),
          constraints: [],
          assignability: {
            assignableFrom: [],
            assignableTo: [],
            exactMatch: false
          }
        }
      };
    }
  }

  /**
   * Tests conditional generic types
   */
  testConditionalGeneric<T, U, V, W>(
    testType: T,
    checkType: U,
    trueType: V,
    falseType: W,
    description: string = 'Conditional generic test'
  ): TypeCheckResult {
    const condition = this.typeChecker.isAssignable(testType, checkType);
    return this.typeChecker.validateConditional(
      condition,
      trueType,
      falseType,
      description
    );
  }

  /**
   * Tests higher-order generic types
   */
  testHigherOrderGeneric<T extends any[], R>(
    higherOrderType: (...args: T) => R,
    typeArguments: T,
    expectedReturnType: R,
    description: string = 'Higher-order generic test'
  ): TypeCheckResult {
    try {
      const result = higherOrderType(...typeArguments);
      return this.typeChecker.validateType(result, expectedReturnType, description);
    } catch (error) {
      return {
        passed: false,
        errors: [error instanceof Error ? error.message : String(error)],
        warnings: [],
        typeInfo: {
          typeName: 'HigherOrderError',
          isGeneric: true,
          parameters: typeArguments.map(arg => this.getTypeName(arg)),
          constraints: [],
          assignability: {
            assignableFrom: [],
            assignableTo: [this.getTypeName(expectedReturnType)],
            exactMatch: false
          }
        }
      };
    }
  }

  /**
   * Creates a generic test suite builder
   */
  createSuiteBuilder<T>(suiteName: string): GenericTestSuiteBuilder<T> {
    return new GenericTestSuiteBuilder<T>(suiteName, this);
  }

  /**
   * Gets test coverage report
   */
  getCoverageReport(): GenericTypeCoverage {
    return { ...this.coverage };
  }

  /**
   * Clears all test results and coverage
   */
  reset(): void {
    this.testSuites = [];
    this.results = [];
    this.resetCoverage();
  }

  // Private helper methods
  private executeGenericTypeTest<T>(testCase: GenericTestCase<T>): TypeCheckResult {
    if (testCase.constraints) {
      return this.typeChecker.validateGeneric(
        testCase.typeParameters,
        testCase.constraints
      );
    }

    return this.typeChecker.validateType(
      testCase.typeParameters,
      {},
      testCase.description
    );
  }

  private testCovariance<T, U>(
    baseType: T,
    derivedType: U,
    description: string
  ): TypeCheckResult {
    // Test if Array<Derived> is assignable to Array<Base>
    const result = this.typeChecker.isAssignable([derivedType], [baseType]);

    return {
      passed: result,
      errors: result ? [] : ['Covariance test failed'],
      warnings: [],
      typeInfo: {
        typeName: `Covariant<${this.getTypeName(derivedType)}, ${this.getTypeName(baseType)}>`,
        isGeneric: true,
        parameters: ['T', 'U'],
        constraints: [],
        assignability: {
          assignableFrom: [this.getTypeName(derivedType)],
          assignableTo: [this.getTypeName(baseType)],
          exactMatch: result
        }
      }
    };
  }

  private testContravariance<T, U>(
    baseType: T,
    derivedType: U,
    description: string
  ): TypeCheckResult {
    // Test if Function<Base> is assignable to Function<Derived>
    const result = this.typeChecker.isAssignable(
      (x: T) => x,
      (x: U) => x
    );

    return {
      passed: result,
      errors: result ? [] : ['Contravariance test failed'],
      warnings: [],
      typeInfo: {
        typeName: `Contravariant<${this.getTypeName(baseType)}, ${this.getTypeName(derivedType)}>`,
        isGeneric: true,
        parameters: ['T', 'U'],
        constraints: [],
        assignability: {
          assignableFrom: [this.getTypeName(baseType)],
          assignableTo: [this.getTypeName(derivedType)],
          exactMatch: result
        }
      }
    };
  }

  private testInvariance<T, U>(
    baseType: T,
    derivedType: U,
    description: string
  ): TypeCheckResult {
    // Test that neither direction is assignable (except for exact match)
    const baseToDerivid = this.typeChecker.isAssignable(baseType, derivedType);
    const derivedToBase = this.typeChecker.isAssignable(derivedType, baseType);
    const result = !baseToDerivid && !derivedToBase;

    return {
      passed: result,
      errors: result ? [] : ['Invariance test failed'],
      warnings: [],
      typeInfo: {
        typeName: `Invariant<${this.getTypeName(baseType)}, ${this.getTypeName(derivedType)}>`,
        isGeneric: true,
        parameters: ['T', 'U'],
        constraints: [],
        assignability: {
          assignableFrom: [this.getTypeName(baseType)],
          assignableTo: [this.getTypeName(derivedType)],
          exactMatch: false
        }
      }
    };
  }

  private applyMapping<T extends Record<string, any>>(
    sourceType: T,
    mappingFunction: (key: keyof T, value: T[keyof T]) => any
  ): Record<keyof T, any> {
    const mapped = {} as Record<keyof T, any>;

    for (const key in sourceType) {
      if (sourceType.hasOwnProperty(key)) {
        mapped[key] = mappingFunction(key, sourceType[key]);
      }
    }

    return mapped;
  }

  private updateCoverage<T>(testCase: GenericTestCase<T>): void {
    // Update type parameters
    Object.keys(testCase.typeParameters).forEach(param => {
      if (!this.coverage.typeParameters.includes(param)) {
        this.coverage.typeParameters.push(param);
      }
    });

    // Update constraints
    if (testCase.constraints) {
      Object.keys(testCase.constraints).forEach(constraint => {
        if (!this.coverage.constraints.includes(constraint)) {
          this.coverage.constraints.push(constraint);
        }
      });
    }

    // Update counts
    this.coverage.instantiations++;

    if (testCase.name.toLowerCase().includes('edge')) {
      this.coverage.edgeCases++;
    }

    if (Object.keys(testCase.typeParameters).length > 2) {
      this.coverage.complexTypes++;
    }
  }

  private generateReport(executionTime: number): GenericTestReport {
    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;

    return {
      totalSuites: this.testSuites.length,
      totalTests,
      passedTests,
      failedTests,
      executionTime,
      results: [...this.results],
      coverage: { ...this.coverage }
    };
  }

  private resetCoverage(): void {
    this.coverage = {
      typeParameters: [],
      constraints: [],
      instantiations: 0,
      edgeCases: 0,
      complexTypes: 0
    };
  }

  private getTypeName(value: unknown): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';

    const type = typeof value;
    if (type === 'object') {
      if (Array.isArray(value)) return 'Array';
      if (value.constructor && value.constructor.name) {
        return value.constructor.name;
      }
      return 'Object';
    }

    return type;
  }
}

/**
 * Builder class for creating generic test suites
 */
export class GenericTestSuiteBuilder<T> {
  private suite: GenericTestSuite<T>;

  constructor(suiteName: string, private runner: GenericTypeTestRunner) {
    this.suite = {
      suiteName,
      description: '',
      baseType: '',
      testCases: []
    };
  }

  description(desc: string): this {
    this.suite.description = desc;
    return this;
  }

  baseType(type: string): this {
    this.suite.baseType = type;
    return this;
  }

  addTest(testCase: GenericTestCase<T>): this {
    this.suite.testCases.push(testCase);
    return this;
  }

  setup(setupFn: () => void): this {
    this.suite.setup = setupFn;
    return this;
  }

  teardown(teardownFn: () => void): this {
    this.suite.teardown = teardownFn;
    return this;
  }

  build(): GenericTestSuite<T> {
    this.runner.registerSuite(this.suite);
    return this.suite;
  }
}

export default GenericTypeTestRunner;