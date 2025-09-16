/**
 * InterfaceValidator - Advanced interface validation and testing framework
 * Provides comprehensive validation for TypeScript interfaces and object shapes
 */

import { TypeChecker, TypeCheckResult } from './TypeChecker';

export interface InterfaceDefinition {
  name: string;
  properties: PropertyDefinition[];
  methods?: MethodDefinition[];
  extends?: string[];
  generics?: GenericParameter[];
  optional?: boolean;
  readonly?: boolean;
}

export interface PropertyDefinition {
  name: string;
  type: string;
  optional?: boolean;
  readonly?: boolean;
  description?: string;
  validator?: (value: any) => boolean;
  defaultValue?: any;
}

export interface MethodDefinition {
  name: string;
  parameters: ParameterDefinition[];
  returnType: string;
  optional?: boolean;
  description?: string;
  async?: boolean;
}

export interface ParameterDefinition {
  name: string;
  type: string;
  optional?: boolean;
  defaultValue?: any;
  rest?: boolean;
}

export interface GenericParameter {
  name: string;
  constraint?: string;
  defaultType?: string;
}

export interface InterfaceValidationResult {
  interfaceName: string;
  passed: boolean;
  errors: InterfaceError[];
  warnings: InterfaceWarning[];
  propertyResults: PropertyValidationResult[];
  methodResults: MethodValidationResult[];
  conformanceScore: number;
}

export interface PropertyValidationResult {
  propertyName: string;
  passed: boolean;
  expectedType: string;
  actualType: string;
  errors: string[];
  warnings: string[];
}

export interface MethodValidationResult {
  methodName: string;
  passed: boolean;
  signatureMatch: boolean;
  parameterValidation: ParameterValidationResult[];
  returnTypeValidation: TypeCheckResult;
  errors: string[];
}

export interface ParameterValidationResult {
  parameterName: string;
  passed: boolean;
  expectedType: string;
  actualType: string;
  error?: string;
}

export interface InterfaceError {
  type: 'MISSING_PROPERTY' | 'INVALID_TYPE' | 'MISSING_METHOD' | 'SIGNATURE_MISMATCH' | 'CONSTRAINT_VIOLATION';
  message: string;
  property?: string;
  method?: string;
  expected?: string;
  actual?: string;
}

export interface InterfaceWarning {
  type: 'EXTRA_PROPERTY' | 'DEPRECATED_METHOD' | 'TYPE_MISMATCH_WARNING';
  message: string;
  property?: string;
  method?: string;
}

export interface InterfaceValidationConfig {
  strict: boolean;
  allowExtraProperties: boolean;
  allowExtraMethods: boolean;
  validateMethodImplementations: boolean;
  checkReturnTypes: boolean;
  validateGenerics: boolean;
}

/**
 * Comprehensive interface validation framework
 */
export class InterfaceValidator {
  private typeChecker: TypeChecker;
  private config: InterfaceValidationConfig;
  private interfaceRegistry: Map<string, InterfaceDefinition> = new Map();
  private validationCache: Map<string, InterfaceValidationResult> = new Map();

  constructor(
    typeChecker: TypeChecker,
    config: Partial<InterfaceValidationConfig> = {}
  ) {
    this.typeChecker = typeChecker;
    this.config = {
      strict: true,
      allowExtraProperties: false,
      allowExtraMethods: false,
      validateMethodImplementations: true,
      checkReturnTypes: true,
      validateGenerics: true,
      ...config
    };
  }

  /**
   * Registers an interface definition for validation
   */
  registerInterface(definition: InterfaceDefinition): void {
    this.interfaceRegistry.set(definition.name, definition);
  }

  /**
   * Validates an object against a registered interface
   */
  validateObject<T extends Record<string, any>>(
    obj: T,
    interfaceName: string
  ): InterfaceValidationResult {
    const cacheKey = `${interfaceName}:${JSON.stringify(obj)}`;

    if (this.validationCache.has(cacheKey)) {
      return this.validationCache.get(cacheKey)!;
    }

    const interfaceDefinition = this.interfaceRegistry.get(interfaceName);
    if (!interfaceDefinition) {
      throw new Error(`Interface "${interfaceName}" not found in registry`);
    }

    const result = this.performInterfaceValidation(obj, interfaceDefinition);
    this.validationCache.set(cacheKey, result);

    return result;
  }

  /**
   * Validates an object against an interface definition directly
   */
  validateAgainstDefinition<T extends Record<string, any>>(
    obj: T,
    definition: InterfaceDefinition
  ): InterfaceValidationResult {
    return this.performInterfaceValidation(obj, definition);
  }

  /**
   * Validates interface inheritance
   */
  validateInheritance(
    childInterface: string,
    parentInterface: string
  ): InterfaceValidationResult {
    const child = this.interfaceRegistry.get(childInterface);
    const parent = this.interfaceRegistry.get(parentInterface);

    if (!child || !parent) {
      throw new Error('Interface not found in registry');
    }

    return this.validateInterfaceInheritance(child, parent);
  }

  /**
   * Validates generic interface instantiation
   */
  validateGenericInterface<T extends Record<string, any>>(
    obj: T,
    interfaceName: string,
    typeArguments: Record<string, any>
  ): InterfaceValidationResult {
    const interfaceDefinition = this.interfaceRegistry.get(interfaceName);
    if (!interfaceDefinition) {
      throw new Error(`Interface "${interfaceName}" not found in registry`);
    }

    const instantiatedDefinition = this.instantiateGenericInterface(
      interfaceDefinition,
      typeArguments
    );

    return this.performInterfaceValidation(obj, instantiatedDefinition);
  }

  /**
   * Validates structural typing (duck typing)
   */
  validateStructural<T extends Record<string, any>>(
    obj: T,
    requiredShape: Partial<InterfaceDefinition>
  ): InterfaceValidationResult {
    const tempDefinition: InterfaceDefinition = {
      name: 'StructuralValidation',
      properties: requiredShape.properties || [],
      methods: requiredShape.methods || [],
      ...requiredShape
    };

    return this.performInterfaceValidation(obj, tempDefinition);
  }

  /**
   * Validates interface composition
   */
  validateComposition<T extends Record<string, any>>(
    obj: T,
    interfaceNames: string[]
  ): InterfaceValidationResult {
    const composedDefinition = this.composeInterfaces(interfaceNames);
    return this.performInterfaceValidation(obj, composedDefinition);
  }

  /**
   * Validates partial interface implementation
   */
  validatePartial<T extends Record<string, any>>(
    obj: T,
    interfaceName: string,
    requiredProperties?: string[]
  ): InterfaceValidationResult {
    const interfaceDefinition = this.interfaceRegistry.get(interfaceName);
    if (!interfaceDefinition) {
      throw new Error(`Interface "${interfaceName}" not found in registry`);
    }

    const partialDefinition = this.createPartialDefinition(
      interfaceDefinition,
      requiredProperties
    );

    return this.performInterfaceValidation(obj, partialDefinition);
  }

  /**
   * Validates readonly interface properties
   */
  validateReadonly<T extends Record<string, any>>(
    obj: T,
    interfaceName: string
  ): InterfaceValidationResult {
    const result = this.validateObject(obj, interfaceName);

    // Additional validation for readonly properties
    const interfaceDefinition = this.interfaceRegistry.get(interfaceName)!;
    const readonlyErrors = this.validateReadonlyProperties(obj, interfaceDefinition);

    return {
      ...result,
      errors: [...result.errors, ...readonlyErrors]
    };
  }

  /**
   * Creates a validation schema from interface definition
   */
  createValidationSchema(interfaceName: string): ValidationSchema {
    const interfaceDefinition = this.interfaceRegistry.get(interfaceName);
    if (!interfaceDefinition) {
      throw new Error(`Interface "${interfaceName}" not found in registry`);
    }

    return this.convertToValidationSchema(interfaceDefinition);
  }

  /**
   * Generates interface validation report
   */
  generateValidationReport(results: InterfaceValidationResult[]): InterfaceValidationReport {
    const totalInterfaces = results.length;
    const passedInterfaces = results.filter(r => r.passed).length;
    const failedInterfaces = totalInterfaces - passedInterfaces;

    const avgConformanceScore = results.reduce((sum, r) => sum + r.conformanceScore, 0) / totalInterfaces;

    const errorsByType = this.categorizeErrors(results);
    const warningsByType = this.categorizeWarnings(results);

    return {
      totalInterfaces,
      passedInterfaces,
      failedInterfaces,
      averageConformanceScore: avgConformanceScore,
      errorsByType,
      warningsByType,
      detailedResults: results
    };
  }

  // Private helper methods
  private performInterfaceValidation<T extends Record<string, any>>(
    obj: T,
    definition: InterfaceDefinition
  ): InterfaceValidationResult {
    const errors: InterfaceError[] = [];
    const warnings: InterfaceWarning[] = [];
    const propertyResults: PropertyValidationResult[] = [];
    const methodResults: MethodValidationResult[] = [];

    // Validate properties
    for (const propDef of definition.properties) {
      const propResult = this.validateProperty(obj, propDef);
      propertyResults.push(propResult);

      if (!propResult.passed) {
        errors.push({
          type: 'INVALID_TYPE',
          message: `Property "${propDef.name}" validation failed`,
          property: propDef.name,
          expected: propDef.type,
          actual: propResult.actualType
        });
      }
    }

    // Validate methods
    if (this.config.validateMethodImplementations && definition.methods) {
      for (const methodDef of definition.methods) {
        const methodResult = this.validateMethod(obj, methodDef);
        methodResults.push(methodResult);

        if (!methodResult.passed) {
          errors.push({
            type: 'SIGNATURE_MISMATCH',
            message: `Method "${methodDef.name}" validation failed`,
            method: methodDef.name
          });
        }
      }
    }

    // Check for extra properties/methods in strict mode
    if (this.config.strict) {
      const extraPropertyWarnings = this.checkExtraProperties(obj, definition);
      warnings.push(...extraPropertyWarnings);

      const extraMethodWarnings = this.checkExtraMethods(obj, definition);
      warnings.push(...extraMethodWarnings);
    }

    // Calculate conformance score
    const conformanceScore = this.calculateConformanceScore(
      propertyResults,
      methodResults,
      errors.length
    );

    return {
      interfaceName: definition.name,
      passed: errors.length === 0,
      errors,
      warnings,
      propertyResults,
      methodResults,
      conformanceScore
    };
  }

  private validateProperty<T extends Record<string, any>>(
    obj: T,
    propDef: PropertyDefinition
  ): PropertyValidationResult {
    const value = obj[propDef.name];
    const exists = propDef.name in obj;
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if required property exists
    if (!propDef.optional && !exists) {
      errors.push(`Required property "${propDef.name}" is missing`);
    }

    // Validate type if property exists
    let actualType = 'undefined';
    if (exists) {
      actualType = this.getTypeName(value);
      const typeValid = this.validatePropertyType(value, propDef.type);

      if (!typeValid) {
        errors.push(`Property "${propDef.name}" has incorrect type`);
      }

      // Custom validator
      if (propDef.validator && !propDef.validator(value)) {
        errors.push(`Property "${propDef.name}" failed custom validation`);
      }
    }

    return {
      propertyName: propDef.name,
      passed: errors.length === 0,
      expectedType: propDef.type,
      actualType,
      errors,
      warnings
    };
  }

  private validateMethod<T extends Record<string, any>>(
    obj: T,
    methodDef: MethodDefinition
  ): MethodValidationResult {
    const method = obj[methodDef.name];
    const exists = methodDef.name in obj;
    const errors: string[] = [];

    if (!methodDef.optional && !exists) {
      errors.push(`Required method "${methodDef.name}" is missing`);
    }

    if (!exists || typeof method !== 'function') {
      return {
        methodName: methodDef.name,
        passed: false,
        signatureMatch: false,
        parameterValidation: [],
        returnTypeValidation: {
          passed: false,
          errors: errors,
          warnings: [],
          typeInfo: {
            typeName: 'undefined',
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
        errors
      };
    }

    // Validate method signature
    const signatureMatch = this.validateMethodSignature(method, methodDef);
    const parameterValidation = this.validateMethodParameters(method, methodDef);

    // Validate return type (if possible)
    const returnTypeValidation = this.validateReturnType(method, methodDef.returnType);

    return {
      methodName: methodDef.name,
      passed: signatureMatch && parameterValidation.every(p => p.passed),
      signatureMatch,
      parameterValidation,
      returnTypeValidation,
      errors
    };
  }

  private validateInterfaceInheritance(
    child: InterfaceDefinition,
    parent: InterfaceDefinition
  ): InterfaceValidationResult {
    const errors: InterfaceError[] = [];
    const warnings: InterfaceWarning[] = [];

    // Check that all parent properties are present in child
    for (const parentProp of parent.properties) {
      const childProp = child.properties.find(p => p.name === parentProp.name);

      if (!childProp) {
        errors.push({
          type: 'MISSING_PROPERTY',
          message: `Child interface missing property "${parentProp.name}" from parent`,
          property: parentProp.name,
          expected: parentProp.type
        });
      } else {
        // Check type compatibility
        const compatible = this.areTypesCompatible(childProp.type, parentProp.type);
        if (!compatible) {
          errors.push({
            type: 'INVALID_TYPE',
            message: `Property "${parentProp.name}" type mismatch in inheritance`,
            property: parentProp.name,
            expected: parentProp.type,
            actual: childProp.type
          });
        }
      }
    }

    // Check methods
    if (parent.methods && child.methods) {
      for (const parentMethod of parent.methods) {
        const childMethod = child.methods.find(m => m.name === parentMethod.name);

        if (!childMethod) {
          errors.push({
            type: 'MISSING_METHOD',
            message: `Child interface missing method "${parentMethod.name}" from parent`,
            method: parentMethod.name
          });
        }
      }
    }

    return {
      interfaceName: `${child.name} extends ${parent.name}`,
      passed: errors.length === 0,
      errors,
      warnings,
      propertyResults: [],
      methodResults: [],
      conformanceScore: errors.length === 0 ? 100 : 0
    };
  }

  private instantiateGenericInterface(
    definition: InterfaceDefinition,
    typeArguments: Record<string, any>
  ): InterfaceDefinition {
    const instantiatedProperties = definition.properties.map(prop => ({
      ...prop,
      type: this.substituteGenericTypes(prop.type, typeArguments)
    }));

    const instantiatedMethods = definition.methods?.map(method => ({
      ...method,
      returnType: this.substituteGenericTypes(method.returnType, typeArguments),
      parameters: method.parameters.map(param => ({
        ...param,
        type: this.substituteGenericTypes(param.type, typeArguments)
      }))
    }));

    return {
      ...definition,
      name: `${definition.name}<${Object.values(typeArguments).join(', ')}>`,
      properties: instantiatedProperties,
      methods: instantiatedMethods
    };
  }

  private composeInterfaces(interfaceNames: string[]): InterfaceDefinition {
    const interfaces = interfaceNames.map(name => {
      const def = this.interfaceRegistry.get(name);
      if (!def) throw new Error(`Interface "${name}" not found`);
      return def;
    });

    const composedProperties: PropertyDefinition[] = [];
    const composedMethods: MethodDefinition[] = [];

    for (const iface of interfaces) {
      composedProperties.push(...iface.properties);
      if (iface.methods) {
        composedMethods.push(...iface.methods);
      }
    }

    return {
      name: `Composed<${interfaceNames.join(' & ')}>`,
      properties: composedProperties,
      methods: composedMethods
    };
  }

  private createPartialDefinition(
    definition: InterfaceDefinition,
    requiredProperties?: string[]
  ): InterfaceDefinition {
    const partialProperties = definition.properties.map(prop => ({
      ...prop,
      optional: requiredProperties ? !requiredProperties.includes(prop.name) : true
    }));

    return {
      ...definition,
      name: `Partial<${definition.name}>`,
      properties: partialProperties
    };
  }

  private validateReadonlyProperties<T extends Record<string, any>>(
    obj: T,
    definition: InterfaceDefinition
  ): InterfaceError[] {
    const errors: InterfaceError[] = [];

    // This is a compile-time check simulation
    // In real TypeScript, readonly is enforced at compile time

    return errors;
  }

  private validatePropertyType(value: any, expectedType: string): boolean {
    const actualType = this.getTypeName(value);
    return this.areTypesCompatible(actualType, expectedType);
  }

  private validateMethodSignature(method: Function, methodDef: MethodDefinition): boolean {
    // Check parameter count
    const expectedParamCount = methodDef.parameters.filter(p => !p.optional).length;
    const actualParamCount = method.length;

    return actualParamCount >= expectedParamCount;
  }

  private validateMethodParameters(
    method: Function,
    methodDef: MethodDefinition
  ): ParameterValidationResult[] {
    return methodDef.parameters.map((param, index) => ({
      parameterName: param.name,
      passed: true, // Simplified validation
      expectedType: param.type,
      actualType: 'any' // Runtime parameter type checking is limited
    }));
  }

  private validateReturnType(method: Function, expectedReturnType: string): TypeCheckResult {
    // Runtime return type validation is limited
    return {
      passed: true,
      errors: [],
      warnings: [],
      typeInfo: {
        typeName: expectedReturnType,
        isGeneric: false,
        parameters: [],
        constraints: [],
        assignability: {
          assignableFrom: [],
          assignableTo: [expectedReturnType],
          exactMatch: false
        }
      }
    };
  }

  private checkExtraProperties<T extends Record<string, any>>(
    obj: T,
    definition: InterfaceDefinition
  ): InterfaceWarning[] {
    const warnings: InterfaceWarning[] = [];
    const definedProperties = new Set(definition.properties.map(p => p.name));

    for (const key of Object.keys(obj)) {
      if (!definedProperties.has(key)) {
        warnings.push({
          type: 'EXTRA_PROPERTY',
          message: `Extra property "${key}" not defined in interface`,
          property: key
        });
      }
    }

    return warnings;
  }

  private checkExtraMethods<T extends Record<string, any>>(
    obj: T,
    definition: InterfaceDefinition
  ): InterfaceWarning[] {
    const warnings: InterfaceWarning[] = [];
    const definedMethods = new Set(definition.methods?.map(m => m.name) || []);

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'function' && !definedMethods.has(key)) {
        warnings.push({
          type: 'EXTRA_PROPERTY',
          message: `Extra method "${key}" not defined in interface`,
          method: key
        });
      }
    }

    return warnings;
  }

  private calculateConformanceScore(
    propertyResults: PropertyValidationResult[],
    methodResults: MethodValidationResult[],
    errorCount: number
  ): number {
    const totalChecks = propertyResults.length + methodResults.length;
    if (totalChecks === 0) return 100;

    const passedChecks =
      propertyResults.filter(p => p.passed).length +
      methodResults.filter(m => m.passed).length;

    const baseScore = (passedChecks / totalChecks) * 100;
    const errorPenalty = Math.min(errorCount * 5, 50); // Max 50% penalty

    return Math.max(0, baseScore - errorPenalty);
  }

  private areTypesCompatible(actualType: string, expectedType: string): boolean {
    if (actualType === expectedType) return true;
    if (expectedType === 'any' || expectedType === 'unknown') return true;

    // Add more sophisticated type compatibility logic
    return false;
  }

  private substituteGenericTypes(type: string, typeArguments: Record<string, any>): string {
    let substituted = type;
    for (const [generic, actualType] of Object.entries(typeArguments)) {
      substituted = substituted.replace(
        new RegExp(`\\b${generic}\\b`, 'g'),
        this.getTypeName(actualType)
      );
    }
    return substituted;
  }

  private convertToValidationSchema(definition: InterfaceDefinition): ValidationSchema {
    return {
      type: 'object',
      properties: definition.properties.reduce((acc, prop) => {
        acc[prop.name] = {
          type: prop.type,
          required: !prop.optional,
          validator: prop.validator
        };
        return acc;
      }, {} as Record<string, any>),
      methods: definition.methods?.reduce((acc, method) => {
        acc[method.name] = {
          type: 'function',
          parameters: method.parameters,
          returnType: method.returnType
        };
        return acc;
      }, {} as Record<string, any>) || {}
    };
  }

  private categorizeErrors(results: InterfaceValidationResult[]): Record<string, number> {
    const categories: Record<string, number> = {};

    for (const result of results) {
      for (const error of result.errors) {
        categories[error.type] = (categories[error.type] || 0) + 1;
      }
    }

    return categories;
  }

  private categorizeWarnings(results: InterfaceValidationResult[]): Record<string, number> {
    const categories: Record<string, number> = {};

    for (const result of results) {
      for (const warning of result.warnings) {
        categories[warning.type] = (categories[warning.type] || 0) + 1;
      }
    }

    return categories;
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

// Additional type definitions
export interface ValidationSchema {
  type: string;
  properties: Record<string, any>;
  methods: Record<string, any>;
}

export interface InterfaceValidationReport {
  totalInterfaces: number;
  passedInterfaces: number;
  failedInterfaces: number;
  averageConformanceScore: number;
  errorsByType: Record<string, number>;
  warningsByType: Record<string, number>;
  detailedResults: InterfaceValidationResult[];
}

export default InterfaceValidator;