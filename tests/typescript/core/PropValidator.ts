/**
 * PropValidator - Specialized utility for validating React component props
 * Provides comprehensive prop type validation and testing capabilities
 */

import { TypeChecker, TypeCheckResult } from './TypeChecker';

export interface PropValidationResult extends TypeCheckResult {
  propName: string;
  required: boolean;
  defaultValue?: any;
  validValues?: any[];
}

export interface PropValidationConfig {
  strict: boolean;
  allowUndefined: boolean;
  allowNull: boolean;
  validateDefaults: boolean;
  checkEnums: boolean;
}

export interface ComponentPropDefinition {
  name: string;
  type: string;
  required: boolean;
  defaultValue?: any;
  validator?: (value: any) => boolean;
  enum?: any[];
  description?: string;
}

export interface ComponentPropsSchema {
  componentName: string;
  props: ComponentPropDefinition[];
  generics?: string[];
  extends?: string[];
}

/**
 * Advanced prop validation utility for React components
 */
export class PropValidator {
  private typeChecker: TypeChecker;
  private config: PropValidationConfig;
  private validationCache: Map<string, PropValidationResult> = new Map();

  constructor(
    typeChecker: TypeChecker,
    config: Partial<PropValidationConfig> = {}
  ) {
    this.typeChecker = typeChecker;
    this.config = {
      strict: true,
      allowUndefined: false,
      allowNull: false,
      validateDefaults: true,
      checkEnums: true,
      ...config
    };
  }

  /**
   * Validates a single prop against its definition
   */
  validateProp<T>(
    propName: string,
    value: T,
    definition: ComponentPropDefinition
  ): PropValidationResult {
    const cacheKey = `${propName}:${JSON.stringify(value)}:${JSON.stringify(definition)}`;

    if (this.validationCache.has(cacheKey)) {
      return this.validationCache.get(cacheKey)!;
    }

    const result = this.performPropValidation(propName, value, definition);
    this.validationCache.set(cacheKey, result);

    return result;
  }

  /**
   * Validates all props for a component against schema
   */
  validateComponentProps<T extends Record<string, any>>(
    props: T,
    schema: ComponentPropsSchema
  ): PropValidationResult[] {
    const results: PropValidationResult[] = [];

    // Validate defined props
    for (const propDef of schema.props) {
      const value = props[propDef.name];
      const result = this.validateProp(propDef.name, value, propDef);
      results.push(result);
    }

    // Check for unknown props in strict mode
    if (this.config.strict) {
      const definedPropNames = new Set(schema.props.map(p => p.name));
      const providedPropNames = Object.keys(props);

      for (const propName of providedPropNames) {
        if (!definedPropNames.has(propName)) {
          results.push({
            propName,
            required: false,
            passed: false,
            errors: [`Unknown prop "${propName}" provided to component "${schema.componentName}"`],
            warnings: [],
            typeInfo: {
              typeName: 'unknown',
              isGeneric: false,
              parameters: [],
              constraints: [],
              assignability: {
                assignableFrom: [],
                assignableTo: [],
                exactMatch: false
              }
            }
          });
        }
      }
    }

    return results;
  }

  /**
   * Validates generic component props
   */
  validateGenericProps<T extends Record<string, any>, G extends Record<string, any>>(
    props: T,
    schema: ComponentPropsSchema,
    generics: G
  ): PropValidationResult[] {
    // Substitute generic types in schema
    const resolvedSchema = this.resolveGenericSchema(schema, generics);
    return this.validateComponentProps(props, resolvedSchema);
  }

  /**
   * Validates prop types with union types
   */
  validateUnionProp<T>(
    propName: string,
    value: T,
    unionTypes: readonly unknown[],
    required: boolean = false
  ): PropValidationResult {
    const typeResult = this.typeChecker.validateUnion(value, unionTypes);

    return {
      propName,
      required,
      passed: typeResult.passed && this.checkRequiredProp(value, required),
      errors: typeResult.errors,
      warnings: typeResult.warnings,
      typeInfo: typeResult.typeInfo
    };
  }

  /**
   * Validates conditional prop types
   */
  validateConditionalProp<T, U>(
    propName: string,
    value: T,
    condition: boolean,
    trueType: unknown,
    falseType: unknown,
    required: boolean = false
  ): PropValidationResult {
    const expectedType = condition ? trueType : falseType;
    const isValid = this.typeChecker.isAssignable(value, expectedType);

    return {
      propName,
      required,
      passed: isValid && this.checkRequiredProp(value, required),
      errors: isValid ? [] : [`Prop "${propName}" does not match conditional type`],
      warnings: [],
      typeInfo: {
        typeName: `Conditional<${condition} ? ${this.getTypeName(trueType)} : ${this.getTypeName(falseType)}>`,
        isGeneric: true,
        parameters: ['T', 'U'],
        constraints: [],
        assignability: {
          assignableFrom: [this.getTypeName(value)],
          assignableTo: [this.getTypeName(expectedType)],
          exactMatch: isValid
        }
      }
    };
  }

  /**
   * Validates event handler props
   */
  validateEventHandler<T extends Function>(
    propName: string,
    handler: T,
    expectedSignature: string,
    required: boolean = false
  ): PropValidationResult {
    const isFunction = typeof handler === 'function';
    const hasCorrectSignature = this.validateFunctionSignature(handler, expectedSignature);

    return {
      propName,
      required,
      passed: isFunction && hasCorrectSignature && this.checkRequiredProp(handler, required),
      errors: [
        ...(!isFunction ? [`Prop "${propName}" must be a function`] : []),
        ...(!hasCorrectSignature ? [`Prop "${propName}" has incorrect function signature`] : [])
      ],
      warnings: [],
      typeInfo: {
        typeName: 'Function',
        isGeneric: false,
        parameters: [],
        constraints: [expectedSignature],
        assignability: {
          assignableFrom: ['Function'],
          assignableTo: [expectedSignature],
          exactMatch: isFunction && hasCorrectSignature
        }
      }
    };
  }

  /**
   * Validates ref props
   */
  validateRef<T>(
    propName: string,
    ref: React.Ref<T>,
    elementType: string,
    required: boolean = false
  ): PropValidationResult {
    const isValidRef = this.isValidRef(ref, elementType);

    return {
      propName,
      required,
      passed: isValidRef && this.checkRequiredProp(ref, required),
      errors: isValidRef ? [] : [`Invalid ref type for "${propName}"`],
      warnings: [],
      typeInfo: {
        typeName: `Ref<${elementType}>`,
        isGeneric: true,
        parameters: ['T'],
        constraints: [elementType],
        assignability: {
          assignableFrom: [this.getTypeName(ref)],
          assignableTo: [`Ref<${elementType}>`],
          exactMatch: isValidRef
        }
      }
    };
  }

  /**
   * Validates children props
   */
  validateChildren(
    children: React.ReactNode,
    allowedTypes: string[] = ['ReactElement', 'string', 'number'],
    required: boolean = false
  ): PropValidationResult {
    const isValidChildren = this.validateChildrenType(children, allowedTypes);

    return {
      propName: 'children',
      required,
      passed: isValidChildren && this.checkRequiredProp(children, required),
      errors: isValidChildren ? [] : ['Invalid children type'],
      warnings: [],
      typeInfo: {
        typeName: 'ReactNode',
        isGeneric: false,
        parameters: [],
        constraints: allowedTypes,
        assignability: {
          assignableFrom: [this.getTypeName(children)],
          assignableTo: ['ReactNode'],
          exactMatch: isValidChildren
        }
      }
    };
  }

  /**
   * Creates a prop validator for a specific component
   */
  createComponentValidator<T extends Record<string, any>>(
    schema: ComponentPropsSchema
  ): (props: T) => PropValidationResult[] {
    return (props: T) => this.validateComponentProps(props, schema);
  }

  /**
   * Generates prop validation report
   */
  generateValidationReport(results: PropValidationResult[]): {
    totalProps: number;
    passedProps: number;
    failedProps: number;
    requiredPropsMissing: string[];
    unexpectedProps: string[];
    typeErrors: string[];
  } {
    const passedProps = results.filter(r => r.passed);
    const failedProps = results.filter(r => !r.passed);
    const requiredPropsMissing = results
      .filter(r => r.required && !r.passed)
      .map(r => r.propName);
    const unexpectedProps = results
      .filter(r => r.errors.some(e => e.includes('Unknown prop')))
      .map(r => r.propName);
    const typeErrors = failedProps
      .flatMap(r => r.errors)
      .filter(e => !e.includes('Unknown prop'));

    return {
      totalProps: results.length,
      passedProps: passedProps.length,
      failedProps: failedProps.length,
      requiredPropsMissing,
      unexpectedProps,
      typeErrors
    };
  }

  // Private helper methods
  private performPropValidation<T>(
    propName: string,
    value: T,
    definition: ComponentPropDefinition
  ): PropValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if required prop is provided
    if (definition.required && (value === undefined || value === null)) {
      errors.push(`Required prop "${propName}" is missing`);
    }

    // Check if undefined/null is allowed
    if (value === undefined && !this.config.allowUndefined && !definition.required) {
      errors.push(`Prop "${propName}" cannot be undefined`);
    }

    if (value === null && !this.config.allowNull) {
      errors.push(`Prop "${propName}" cannot be null`);
    }

    // Validate type
    if (value !== undefined && value !== null) {
      const typeValid = this.validatePropType(value, definition.type);
      if (!typeValid) {
        errors.push(`Prop "${propName}" has incorrect type. Expected ${definition.type}`);
      }
    }

    // Validate enum values
    if (this.config.checkEnums && definition.enum && value !== undefined) {
      if (!definition.enum.includes(value)) {
        errors.push(`Prop "${propName}" must be one of: ${definition.enum.join(', ')}`);
      }
    }

    // Custom validator
    if (definition.validator && value !== undefined) {
      if (!definition.validator(value)) {
        errors.push(`Prop "${propName}" failed custom validation`);
      }
    }

    // Validate default value
    if (this.config.validateDefaults && definition.defaultValue !== undefined) {
      const defaultValid = this.validatePropType(definition.defaultValue, definition.type);
      if (!defaultValid) {
        warnings.push(`Default value for prop "${propName}" has incorrect type`);
      }
    }

    const typeInfo = {
      typeName: definition.type,
      isGeneric: definition.type.includes('<'),
      parameters: [],
      constraints: definition.enum || [],
      assignability: {
        assignableFrom: [this.getTypeName(value)],
        assignableTo: [definition.type],
        exactMatch: errors.length === 0
      }
    };

    return {
      propName,
      required: definition.required,
      defaultValue: definition.defaultValue,
      validValues: definition.enum,
      passed: errors.length === 0,
      errors,
      warnings,
      typeInfo
    };
  }

  private validatePropType(value: any, expectedType: string): boolean {
    // Simplified type validation
    const actualType = this.getTypeName(value);

    // Handle basic types
    if (expectedType === actualType) return true;
    if (expectedType === 'any') return true;
    if (expectedType === 'unknown') return true;

    // Handle React types
    if (expectedType === 'ReactNode' && this.isReactNode(value)) return true;
    if (expectedType === 'ReactElement' && this.isReactElement(value)) return true;

    return false;
  }

  private resolveGenericSchema(
    schema: ComponentPropsSchema,
    generics: Record<string, any>
  ): ComponentPropsSchema {
    const resolvedProps = schema.props.map(prop => ({
      ...prop,
      type: this.substituteGenericType(prop.type, generics)
    }));

    return {
      ...schema,
      props: resolvedProps
    };
  }

  private substituteGenericType(type: string, generics: Record<string, any>): string {
    let resolvedType = type;
    for (const [generic, actualType] of Object.entries(generics)) {
      resolvedType = resolvedType.replace(new RegExp(`\\b${generic}\\b`, 'g'), this.getTypeName(actualType));
    }
    return resolvedType;
  }

  private checkRequiredProp(value: any, required: boolean): boolean {
    if (!required) return true;
    return value !== undefined && value !== null;
  }

  private validateFunctionSignature(fn: Function, expectedSignature: string): boolean {
    // Simplified function signature validation
    if (typeof fn !== 'function') return false;

    // Extract parameter count from signature
    const paramMatch = expectedSignature.match(/\(([^)]*)\)/);
    if (paramMatch) {
      const params = paramMatch[1].split(',').filter(p => p.trim());
      return fn.length === params.length;
    }

    return true;
  }

  private isValidRef<T>(ref: React.Ref<T>, elementType: string): boolean {
    if (ref === null || ref === undefined) return true;
    if (typeof ref === 'function') return true;
    if (typeof ref === 'object' && 'current' in ref) return true;
    return false;
  }

  private validateChildrenType(children: React.ReactNode, allowedTypes: string[]): boolean {
    if (children === null || children === undefined) return true;

    const childType = this.getReactNodeType(children);
    return allowedTypes.includes(childType);
  }

  private isReactNode(value: any): boolean {
    return (
      value === null ||
      value === undefined ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      this.isReactElement(value) ||
      Array.isArray(value)
    );
  }

  private isReactElement(value: any): boolean {
    return (
      value !== null &&
      typeof value === 'object' &&
      value.$$typeof === Symbol.for('react.element')
    );
  }

  private getReactNodeType(node: React.ReactNode): string {
    if (node === null || node === undefined) return 'null';
    if (typeof node === 'string') return 'string';
    if (typeof node === 'number') return 'number';
    if (typeof node === 'boolean') return 'boolean';
    if (this.isReactElement(node)) return 'ReactElement';
    if (Array.isArray(node)) return 'Array';
    return 'unknown';
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

export default PropValidator;