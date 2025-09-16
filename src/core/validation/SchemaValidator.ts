import { ValidationEngine, ValidationResult, ValidationContext } from './ValidationEngine';
import { StringValidators, ArrayValidators, AsyncValidators, CrossFieldValidators } from './ValidationUtils';
import { KBEntry } from '../../database/KnowledgeDB';

/**
 * JSON Schema-like validation schema structure
 */
export interface ValidationSchema {
  type: 'object' | 'string' | 'array' | 'number' | 'boolean';
  required?: string[];
  properties?: Record<string, PropertySchema>;
  additionalProperties?: boolean;
  minProperties?: number;
  maxProperties?: number;
}

export interface PropertySchema {
  type: 'string' | 'array' | 'number' | 'boolean';
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  enum?: string[];
  format?: 'email' | 'url' | 'mainframe-error-code' | 'structured-text';
  items?: PropertySchema;
  uniqueItems?: boolean;
  minimum?: number;
  maximum?: number;
  default?: any;
  description?: string;
  examples?: any[];
  custom?: {
    validator: string;
    params?: Record<string, any>;
    message?: string;
  }[];
}

/**
 * Server-side validation schemas for different operations
 */
export class SchemaValidator {
  private engine: ValidationEngine;
  private schemas: Map<string, ValidationSchema> = new Map();

  constructor(engine?: ValidationEngine) {
    this.engine = engine || new ValidationEngine();
    this.initializeSchemas();
  }

  /**
   * Validate data against a named schema
   */
  async validateAgainstSchema(
    schemaName: string,
    data: any,
    context?: ValidationContext
  ): Promise<ValidationResult> {
    const schema = this.schemas.get(schemaName);
    if (!schema) {
      return {
        isValid: false,
        errors: [{
          field: 'schema',
          code: 'SCHEMA_NOT_FOUND',
          message: `Schema "${schemaName}" not found`,
          value: schemaName
        }],
        warnings: []
      };
    }

    return this.validateWithSchema(data, schema, context);
  }

  /**
   * Get schema as JSON for client-side validation
   */
  getSchemaJSON(schemaName: string): ValidationSchema | null {
    return this.schemas.get(schemaName) || null;
  }

  /**
   * Register a custom schema
   */
  registerSchema(name: string, schema: ValidationSchema): void {
    this.schemas.set(name, schema);
  }

  /**
   * Validate KB entry for creation
   */
  async validateKBEntryCreate(entry: Partial<KBEntry>, context?: ValidationContext): Promise<ValidationResult> {
    return this.validateAgainstSchema('kb-entry-create', entry, context);
  }

  /**
   * Validate KB entry for update
   */
  async validateKBEntryUpdate(entry: Partial<KBEntry>, context?: ValidationContext): Promise<ValidationResult> {
    return this.validateAgainstSchema('kb-entry-update', entry, context);
  }

  /**
   * Validate KB entry import data
   */
  async validateKBEntryImport(entries: Partial<KBEntry>[], context?: ValidationContext): Promise<ValidationResult[]> {
    return Promise.all(entries.map(entry => 
      this.validateAgainstSchema('kb-entry-import', entry, context)
    ));
  }

  /**
   * Generate validation rules from schema
   */
  private validateWithSchema(
    data: any,
    schema: ValidationSchema,
    context?: ValidationContext
  ): Promise<ValidationResult> {
    if (schema.type === 'object') {
      return this.validateObject(data, schema, context);
    } else if (schema.type === 'array') {
      return this.validateArray(data, schema, context);
    } else {
      return this.validatePrimitive(data, schema, context);
    }
  }

  /**
   * Validate object against schema
   */
  private async validateObject(
    data: any,
    schema: ValidationSchema,
    context?: ValidationContext
  ): Promise<ValidationResult> {
    const errors: any[] = [];
    const warnings: any[] = [];

    if (data === null || data === undefined) {
      errors.push({
        field: 'root',
        code: 'REQUIRED',
        message: 'Object is required',
        value: data
      });
      return { isValid: false, errors, warnings };
    }

    if (typeof data !== 'object' || Array.isArray(data)) {
      errors.push({
        field: 'root',
        code: 'INVALID_TYPE',
        message: 'Expected object',
        value: data
      });
      return { isValid: false, errors, warnings };
    }

    // Check required properties
    if (schema.required) {
      for (const requiredProp of schema.required) {
        if (!(requiredProp in data) || data[requiredProp] === undefined) {
          errors.push({
            field: requiredProp,
            code: 'REQUIRED',
            message: `Property '${requiredProp}' is required`,
            value: undefined
          });
        }
      }
    }

    // Validate each property
    if (schema.properties) {
      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        if (propName in data) {
          const propResult = await this.validateProperty(
            data[propName], 
            propSchema, 
            propName, 
            { ...context, entry: data }
          );
          errors.push(...propResult.errors);
          warnings.push(...propResult.warnings);
        }
      }
    }

    // Check for additional properties
    if (schema.additionalProperties === false) {
      const allowedProps = new Set(Object.keys(schema.properties || {}));
      for (const propName of Object.keys(data)) {
        if (!allowedProps.has(propName)) {
          warnings.push({
            field: propName,
            code: 'ADDITIONAL_PROPERTY',
            message: `Property '${propName}' is not defined in schema`,
            suggestion: 'Remove this property or update schema'
          });
        }
      }
    }

    // Check property count constraints
    const propCount = Object.keys(data).length;
    if (schema.minProperties && propCount < schema.minProperties) {
      errors.push({
        field: 'root',
        code: 'MIN_PROPERTIES',
        message: `Object must have at least ${schema.minProperties} properties (has ${propCount})`,
        value: data,
        metadata: { min: schema.minProperties, current: propCount }
      });
    }

    if (schema.maxProperties && propCount > schema.maxProperties) {
      errors.push({
        field: 'root',
        code: 'MAX_PROPERTIES',
        message: `Object must have at most ${schema.maxProperties} properties (has ${propCount})`,
        value: data,
        metadata: { max: schema.maxProperties, current: propCount }
      });
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate array against schema
   */
  private async validateArray(
    data: any,
    schema: ValidationSchema,
    context?: ValidationContext
  ): Promise<ValidationResult> {
    const errors: any[] = [];
    const warnings: any[] = [];

    if (!Array.isArray(data)) {
      errors.push({
        field: 'root',
        code: 'INVALID_TYPE',
        message: 'Expected array',
        value: data
      });
      return { isValid: false, errors, warnings };
    }

    // Validate array items
    if (schema.properties?.items) {
      for (let i = 0; i < data.length; i++) {
        const itemResult = await this.validateProperty(
          data[i],
          schema.properties.items,
          `[${i}]`,
          context
        );
        errors.push(...itemResult.errors);
        warnings.push(...itemResult.warnings);
      }
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate primitive value against schema
   */
  private async validatePrimitive(
    data: any,
    schema: ValidationSchema,
    context?: ValidationContext
  ): Promise<ValidationResult> {
    // Basic type checking would go here
    return { isValid: true, errors: [], warnings: [] };
  }

  /**
   * Validate individual property
   */
  private async validateProperty(
    value: any,
    schema: PropertySchema,
    fieldName: string,
    context?: ValidationContext
  ): Promise<ValidationResult> {
    const errors: any[] = [];
    const warnings: any[] = [];

    // Type validation
    if (!this.validateType(value, schema.type)) {
      errors.push({
        field: fieldName,
        code: 'INVALID_TYPE',
        message: `Expected ${schema.type}, got ${typeof value}`,
        value
      });
      return { isValid: false, errors, warnings };
    }

    // String-specific validation
    if (schema.type === 'string' && value != null) {
      const strValue = String(value);

      // Length constraints
      if (schema.minLength && strValue.length < schema.minLength) {
        errors.push({
          field: fieldName,
          code: 'MIN_LENGTH',
          message: `Must be at least ${schema.minLength} characters (current: ${strValue.length})`,
          value,
          metadata: { min: schema.minLength, current: strValue.length }
        });
      }

      if (schema.maxLength && strValue.length > schema.maxLength) {
        errors.push({
          field: fieldName,
          code: 'MAX_LENGTH',
          message: `Must not exceed ${schema.maxLength} characters (current: ${strValue.length})`,
          value,
          metadata: { max: schema.maxLength, current: strValue.length }
        });
      }

      // Pattern validation
      if (schema.pattern) {
        const regex = new RegExp(schema.pattern);
        if (!regex.test(strValue)) {
          errors.push({
            field: fieldName,
            code: 'PATTERN',
            message: `Does not match required pattern`,
            value,
            metadata: { pattern: schema.pattern }
          });
        }
      }

      // Enum validation
      if (schema.enum && !schema.enum.includes(strValue)) {
        errors.push({
          field: fieldName,
          code: 'INVALID_ENUM',
          message: `Must be one of: ${schema.enum.join(', ')}`,
          value,
          metadata: { validValues: schema.enum }
        });
      }

      // Format validation
      if (schema.format) {
        const formatResult = this.validateFormat(strValue, schema.format, fieldName);
        errors.push(...formatResult.errors);
        warnings.push(...formatResult.warnings);
      }
    }

    // Array-specific validation
    if (schema.type === 'array' && Array.isArray(value)) {
      // Unique items
      if (schema.uniqueItems) {
        const seen = new Set();
        const duplicates: any[] = [];
        
        value.forEach((item, index) => {
          const key = JSON.stringify(item);
          if (seen.has(key)) {
            duplicates.push({ item, index });
          } else {
            seen.add(key);
          }
        });

        if (duplicates.length > 0) {
          errors.push({
            field: fieldName,
            code: 'DUPLICATE_ITEMS',
            message: 'Array items must be unique',
            value,
            metadata: { duplicates }
          });
        }
      }

      // Item validation
      if (schema.items) {
        for (let i = 0; i < value.length; i++) {
          const itemResult = await this.validateProperty(
            value[i],
            schema.items,
            `${fieldName}[${i}]`,
            context
          );
          errors.push(...itemResult.errors);
          warnings.push(...itemResult.warnings);
        }
      }
    }

    // Number-specific validation
    if (schema.type === 'number' && typeof value === 'number') {
      if (schema.minimum !== undefined && value < schema.minimum) {
        errors.push({
          field: fieldName,
          code: 'MINIMUM',
          message: `Must be at least ${schema.minimum}`,
          value,
          metadata: { minimum: schema.minimum }
        });
      }

      if (schema.maximum !== undefined && value > schema.maximum) {
        errors.push({
          field: fieldName,
          code: 'MAXIMUM',
          message: `Must be at most ${schema.maximum}`,
          value,
          metadata: { maximum: schema.maximum }
        });
      }
    }

    // Custom validation
    if (schema.custom) {
      for (const customRule of schema.custom) {
        const customResult = await this.executeCustomValidator(
          value,
          customRule,
          fieldName,
          context
        );
        errors.push(...customResult.errors);
        warnings.push(...customResult.warnings);
      }
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate format (email, URL, etc.)
   */
  private validateFormat(value: string, format: string, fieldName: string): ValidationResult {
    const errors: any[] = [];
    const warnings: any[] = [];

    switch (format) {
      case 'email':
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          errors.push({
            field: fieldName,
            code: 'INVALID_EMAIL',
            message: 'Invalid email format',
            value
          });
        }
        break;

      case 'url':
        try {
          new URL(value);
        } catch {
          errors.push({
            field: fieldName,
            code: 'INVALID_URL',
            message: 'Invalid URL format',
            value
          });
        }
        break;

      case 'mainframe-error-code':
        if (!/^[A-Z]\d{3,4}[A-Z]?$|^S\d{3}[A-Z]?$|^\w+CODE\s*-?\d+$/i.test(value)) {
          warnings.push({
            field: fieldName,
            code: 'INVALID_ERROR_CODE',
            message: 'Does not appear to be a valid mainframe error code',
            suggestion: 'Expected format: IEF212I, S0C7, SQLCODE -904, etc.'
          });
        }
        break;

      case 'structured-text':
        const hasStructure = 
          /^\s*(\d+\.|\*|-|•)/.test(value) ||
          /\n\s*(\d+\.|\*|-|•)/.test(value);
        
        if (!hasStructure) {
          warnings.push({
            field: fieldName,
            code: 'UNSTRUCTURED',
            message: 'Text would be more readable with numbered steps or bullet points',
            suggestion: 'Use 1., 2., 3... or bullet points for better structure'
          });
        }
        break;
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Execute custom validator
   */
  private async executeCustomValidator(
    value: any,
    customRule: NonNullable<PropertySchema['custom']>[0],
    fieldName: string,
    context?: ValidationContext
  ): Promise<ValidationResult> {
    // This would integrate with the custom validators defined in ValidationUtils
    // For now, return success
    return { isValid: true, errors: [], warnings: [] };
  }

  /**
   * Basic type validation
   */
  private validateType(value: any, expectedType: string): boolean {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'array':
        return Array.isArray(value);
      default:
        return true;
    }
  }

  /**
   * Initialize built-in schemas
   */
  private initializeSchemas(): void {
    // KB Entry Creation Schema
    this.schemas.set('kb-entry-create', {
      type: 'object',
      required: ['title', 'problem', 'solution', 'category'],
      additionalProperties: false,
      properties: {
        title: {
          type: 'string',
          required: true,
          minLength: 10,
          maxLength: 200,
          description: 'Brief, descriptive title of the problem/solution',
          examples: ['VSAM Status 35 - File Not Found', 'S0C7 Data Exception in COBOL Program']
        },
        problem: {
          type: 'string',
          required: true,
          minLength: 50,
          maxLength: 5000,
          format: 'structured-text',
          description: 'Detailed description of the problem or error condition',
          custom: [
            { validator: 'mainframeTerms', message: 'Consider including mainframe-specific terminology' }
          ]
        },
        solution: {
          type: 'string',
          required: true,
          minLength: 50,
          maxLength: 10000,
          format: 'structured-text',
          description: 'Step-by-step solution or resolution steps'
        },
        category: {
          type: 'string',
          required: true,
          enum: ['JCL', 'VSAM', 'DB2', 'Batch', 'Functional', 'CICS', 'IMS', 'TSO/ISPF', 'RACF', 'System', 'Network', 'Other'],
          description: 'Mainframe component category'
        },
        severity: {
          type: 'string',
          required: false,
          enum: ['critical', 'high', 'medium', 'low'],
          default: 'medium',
          description: 'Severity level indicating urgency/impact'
        },
        tags: {
          type: 'array',
          required: false,
          uniqueItems: true,
          items: {
            type: 'string',
            minLength: 2,
            maxLength: 30,
            pattern: '^[a-zA-Z0-9_-]+$'
          },
          description: 'Array of searchable tags for categorization',
          examples: [['vsam', 'status-35', 'file-not-found']]
        }
      }
    });

    // KB Entry Update Schema (similar to create but all fields optional except id)
    this.schemas.set('kb-entry-update', {
      type: 'object',
      required: ['id'],
      additionalProperties: false,
      properties: {
        id: {
          type: 'string',
          required: true,
          description: 'Unique identifier of the entry to update'
        },
        title: {
          type: 'string',
          minLength: 10,
          maxLength: 200
        },
        problem: {
          type: 'string',
          minLength: 50,
          maxLength: 5000,
          format: 'structured-text'
        },
        solution: {
          type: 'string',
          minLength: 50,
          maxLength: 10000,
          format: 'structured-text'
        },
        category: {
          type: 'string',
          enum: ['JCL', 'VSAM', 'DB2', 'Batch', 'Functional', 'CICS', 'IMS', 'TSO/ISPF', 'RACF', 'System', 'Network', 'Other']
        },
        severity: {
          type: 'string',
          enum: ['critical', 'high', 'medium', 'low']
        },
        tags: {
          type: 'array',
          uniqueItems: true,
          items: {
            type: 'string',
            minLength: 2,
            maxLength: 30,
            pattern: '^[a-zA-Z0-9_-]+$'
          }
        },
        archived: {
          type: 'boolean',
          description: 'Whether entry should be archived (hidden from searches)'
        }
      }
    });

    // KB Entry Import Schema (for bulk imports, more lenient)
    this.schemas.set('kb-entry-import', {
      type: 'object',
      required: ['title', 'problem', 'solution'],
      additionalProperties: true, // Allow additional fields for migration
      properties: {
        title: {
          type: 'string',
          minLength: 5, // More lenient for imports
          maxLength: 300
        },
        problem: {
          type: 'string',
          minLength: 20, // More lenient for imports
          maxLength: 10000
        },
        solution: {
          type: 'string',
          minLength: 10, // More lenient for imports
          maxLength: 20000
        },
        category: {
          type: 'string',
          default: 'Other' // Default category for imports
        },
        severity: {
          type: 'string',
          enum: ['critical', 'high', 'medium', 'low'],
          default: 'medium'
        },
        tags: {
          type: 'array',
          uniqueItems: true,
          items: {
            type: 'string',
            minLength: 1, // More lenient
            maxLength: 50
          }
        }
      }
    });

    // Search Query Schema
    this.schemas.set('search-query', {
      type: 'object',
      required: ['query'],
      properties: {
        query: {
          type: 'string',
          required: true,
          minLength: 1,
          maxLength: 500,
          description: 'Search query string'
        },
        category: {
          type: 'string',
          enum: ['JCL', 'VSAM', 'DB2', 'Batch', 'Functional', 'CICS', 'IMS', 'TSO/ISPF', 'RACF', 'System', 'Network', 'Other'],
          description: 'Filter by category'
        },
        tags: {
          type: 'array',
          items: {
            type: 'string',
            minLength: 1,
            maxLength: 30
          },
          description: 'Filter by tags'
        },
        limit: {
          type: 'number',
          minimum: 1,
          maximum: 100,
          default: 10,
          description: 'Maximum number of results'
        },
        offset: {
          type: 'number',
          minimum: 0,
          default: 0,
          description: 'Number of results to skip'
        },
        sortBy: {
          type: 'string',
          enum: ['relevance', 'usage', 'success_rate', 'created_at'],
          default: 'relevance',
          description: 'Sort order'
        },
        includeArchived: {
          type: 'boolean',
          default: false,
          description: 'Include archived entries'
        }
      }
    });
  }

  /**
   * Get all available schemas
   */
  getAvailableSchemas(): string[] {
    return Array.from(this.schemas.keys());
  }

  /**
   * Validate and sanitize input data
   */
  async validateAndSanitize(
    schemaName: string,
    data: any,
    context?: ValidationContext
  ): Promise<{ isValid: boolean; data: any; result: ValidationResult }> {
    const result = await this.validateAgainstSchema(schemaName, data, context);
    
    // Basic sanitization
    const sanitized = this.sanitizeData(data, this.schemas.get(schemaName));
    
    return {
      isValid: result.isValid,
      data: sanitized,
      result
    };
  }

  /**
   * Basic data sanitization
   */
  private sanitizeData(data: any, schema?: ValidationSchema): any {
    if (!schema || !data || typeof data !== 'object') {
      return data;
    }

    const sanitized = { ...data };

    // Trim strings and apply defaults
    if (schema.properties) {
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        if (key in sanitized) {
          if (propSchema.type === 'string' && typeof sanitized[key] === 'string') {
            sanitized[key] = sanitized[key].trim();
          }
        } else if (propSchema.default !== undefined) {
          sanitized[key] = propSchema.default;
        }
      }
    }

    return sanitized;
  }
}