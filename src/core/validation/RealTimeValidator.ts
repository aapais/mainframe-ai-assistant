import { EventEmitter } from 'events';
import { ValidationEngine, ValidationResult, ValidationContext } from './ValidationEngine';
import { SchemaValidator } from './SchemaValidator';
import { debounceValidation } from './ValidationUtils';

/**
 * Real-time validation configuration
 */
export interface RealTimeValidationConfig {
  debounceMs?: number;
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
  showWarningsAsErrors?: boolean;
  enableAsyncValidation?: boolean;
  autoSuggest?: boolean;
  maxSuggestions?: number;
}

/**
 * Field validation state
 */
export interface FieldValidationState {
  field: string;
  isValid: boolean;
  isValidating: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
  lastValidated: Date;
  validationCount: number;
}

/**
 * Form validation state
 */
export interface FormValidationState {
  isValid: boolean;
  isValidating: boolean;
  fields: Map<string, FieldValidationState>;
  globalErrors: string[];
  globalWarnings: string[];
  lastValidated: Date;
  validationCount: number;
}

/**
 * Validation event data
 */
export interface ValidationEvent {
  type: 'field' | 'form' | 'suggestion';
  field?: string;
  state: FieldValidationState | FormValidationState;
  timestamp: Date;
}

/**
 * Real-time validator with live feedback and suggestions
 *
 * Provides immediate validation feedback as users type, with:
 * - Debounced validation to avoid excessive API calls
 * - Progressive validation (basic -> advanced -> async)
 * - Smart suggestions and auto-completion
 * - Live error/warning display
 * - Form-level validation state management
 *
 * @example
 * ```typescript
 * const validator = new RealTimeValidator({
 *   debounceMs: 300,
 *   validateOnChange: true,
 *   autoSuggest: true
 * });
 *
 * // Setup field validation
 * validator.setupField('title', {
 *   rules: [StringValidators.required(), StringValidators.length(10, 200)],
 *   suggestions: true
 * });
 *
 * // Listen for validation events
 * validator.on('validation', (event) => {
 *   updateUI(event.field, event.state);
 * });
 *
 * // Validate as user types
 * validator.validateField('title', inputValue);
 * ```
 */
export class RealTimeValidator extends EventEmitter {
  private engine: ValidationEngine;
  private schemaValidator: SchemaValidator;
  private config: Required<RealTimeValidationConfig>;
  private formState: FormValidationState;
  private debouncedValidators: Map<string, Function> = new Map();
  private fieldConfigs: Map<string, FieldConfig> = new Map();
  private validationCache: Map<string, CachedValidation> = new Map();

  constructor(config: RealTimeValidationConfig = {}, engine?: ValidationEngine) {
    super();

    this.config = {
      debounceMs: 300,
      validateOnChange: true,
      validateOnBlur: true,
      showWarningsAsErrors: false,
      enableAsyncValidation: true,
      autoSuggest: true,
      maxSuggestions: 5,
      ...config,
    };

    this.engine = engine || new ValidationEngine();
    this.schemaValidator = new SchemaValidator(this.engine);

    this.formState = {
      isValid: true,
      isValidating: false,
      fields: new Map(),
      globalErrors: [],
      globalWarnings: [],
      lastValidated: new Date(),
      validationCount: 0,
    };
  }

  /**
   * Setup field for real-time validation
   */
  setupField(fieldName: string, config: FieldConfig): void {
    this.fieldConfigs.set(fieldName, config);

    // Initialize field state
    this.formState.fields.set(fieldName, {
      field: fieldName,
      isValid: true,
      isValidating: false,
      errors: [],
      warnings: [],
      suggestions: [],
      lastValidated: new Date(),
      validationCount: 0,
    });

    // Create debounced validator for this field
    const debouncedValidator = debounceValidation(
      value => this.performFieldValidation(fieldName, value),
      this.config.debounceMs
    );

    this.debouncedValidators.set(fieldName, debouncedValidator);
  }

  /**
   * Validate field value with real-time feedback
   */
  async validateField(
    fieldName: string,
    value: any,
    trigger: 'change' | 'blur' | 'submit' = 'change'
  ): Promise<FieldValidationState> {
    const fieldConfig = this.fieldConfigs.get(fieldName);
    if (!fieldConfig) {
      throw new Error(`Field '${fieldName}' not configured for validation`);
    }

    // Check if validation should run based on trigger
    if (!this.shouldValidate(trigger)) {
      return this.getFieldState(fieldName);
    }

    // Update field state to show validation in progress
    const fieldState = this.getFieldState(fieldName);
    fieldState.isValidating = true;
    this.emitValidationEvent('field', fieldState, fieldName);

    try {
      let validationResult: ValidationResult;

      // Use debounced validation for 'change' events, immediate for others
      if (trigger === 'change' && this.config.debounceMs > 0) {
        const debouncedValidator = this.debouncedValidators.get(fieldName);
        validationResult = await debouncedValidator!(value);
      } else {
        validationResult = await this.performFieldValidation(fieldName, value);
      }

      // Update field state with results
      this.updateFieldState(fieldName, validationResult, value);

      // Generate suggestions if enabled
      if (this.config.autoSuggest && fieldConfig.suggestions) {
        await this.generateSuggestions(fieldName, value, validationResult);
      }

      // Update form-level state
      this.updateFormState();

      const updatedState = this.getFieldState(fieldName);
      this.emitValidationEvent('field', updatedState, fieldName);

      return updatedState;
    } catch (error) {
      // Handle validation errors gracefully
      const errorState = this.createErrorState(fieldName, error);
      this.emitValidationEvent('field', errorState, fieldName);
      return errorState;
    }
  }

  /**
   * Validate entire form
   */
  async validateForm(
    data: Record<string, any>,
    context?: ValidationContext
  ): Promise<FormValidationState> {
    this.formState.isValidating = true;
    this.formState.validationCount++;

    try {
      // Validate each configured field
      const fieldPromises = Array.from(this.fieldConfigs.keys()).map(async fieldName => {
        const fieldValue = data[fieldName];
        return this.validateField(fieldName, fieldValue, 'submit');
      });

      await Promise.all(fieldPromises);

      // Run form-level validation
      const formResult = await this.engine.validateEntry(data, context);

      // Update global errors/warnings
      this.formState.globalErrors = formResult.errors
        .filter(error => !this.fieldConfigs.has(error.field))
        .map(error => error.message);

      this.formState.globalWarnings = formResult.warnings
        .filter(warning => !this.fieldConfigs.has(warning.field))
        .map(warning => warning.message);

      // Update form validation state
      this.updateFormState();

      this.emitValidationEvent('form', this.formState);

      return this.formState;
    } catch (error) {
      this.formState.isValidating = false;
      this.formState.globalErrors = [`Form validation failed: ${error.message}`];
      this.emitValidationEvent('form', this.formState);
      return this.formState;
    }
  }

  /**
   * Get current field validation state
   */
  getFieldState(fieldName: string): FieldValidationState {
    return (
      this.formState.fields.get(fieldName) || {
        field: fieldName,
        isValid: true,
        isValidating: false,
        errors: [],
        warnings: [],
        suggestions: [],
        lastValidated: new Date(),
        validationCount: 0,
      }
    );
  }

  /**
   * Get current form validation state
   */
  getFormState(): FormValidationState {
    return { ...this.formState };
  }

  /**
   * Clear validation state for a field
   */
  clearFieldValidation(fieldName: string): void {
    const fieldState = this.getFieldState(fieldName);
    fieldState.errors = [];
    fieldState.warnings = [];
    fieldState.suggestions = [];
    fieldState.isValid = true;
    fieldState.isValidating = false;

    this.updateFormState();
    this.emitValidationEvent('field', fieldState, fieldName);
  }

  /**
   * Clear all validation state
   */
  clearAllValidation(): void {
    this.formState.fields.forEach((_, fieldName) => {
      this.clearFieldValidation(fieldName);
    });

    this.formState.globalErrors = [];
    this.formState.globalWarnings = [];
    this.updateFormState();
    this.emitValidationEvent('form', this.formState);
  }

  /**
   * Add custom validation message template
   */
  addMessageTemplate(code: string, template: string): void {
    // Delegate to engine's message system
    // This would be implemented based on the engine's API
  }

  /**
   * Get validation suggestions for a field
   */
  async getSuggestions(fieldName: string, value: any): Promise<string[]> {
    const fieldConfig = this.fieldConfigs.get(fieldName);
    if (!fieldConfig || !fieldConfig.suggestions) {
      return [];
    }

    return this.generateFieldSuggestions(fieldName, value);
  }

  /**
   * Performance monitoring - get validation metrics
   */
  getValidationMetrics(): ValidationMetrics {
    const totalValidations = Array.from(this.formState.fields.values()).reduce(
      (sum, field) => sum + field.validationCount,
      0
    );

    const averageValidationsPerField = totalValidations / this.formState.fields.size || 0;

    return {
      totalValidations,
      fieldsConfigured: this.formState.fields.size,
      averageValidationsPerField,
      cacheHitRate: this.calculateCacheHitRate(),
      lastValidated: this.formState.lastValidated,
    };
  }

  /**
   * Private methods
   */

  private shouldValidate(trigger: 'change' | 'blur' | 'submit'): boolean {
    switch (trigger) {
      case 'change':
        return this.config.validateOnChange;
      case 'blur':
        return this.config.validateOnBlur;
      case 'submit':
        return true;
      default:
        return false;
    }
  }

  private async performFieldValidation(fieldName: string, value: any): Promise<ValidationResult> {
    const fieldConfig = this.fieldConfigs.get(fieldName);
    if (!fieldConfig) {
      return { isValid: true, errors: [], warnings: [] };
    }

    // Check cache first
    const cacheKey = `${fieldName}:${this.hashValue(value)}`;
    const cached = this.validationCache.get(cacheKey);
    if (cached && !this.isCacheExpired(cached)) {
      return cached.result;
    }

    // Perform validation
    const context: ValidationContext = {
      operation: 'update', // Assume update for real-time validation
      entry: this.getCurrentFormData(),
    };

    let result: ValidationResult;

    if (fieldConfig.schema) {
      // Use schema validation
      result = await this.schemaValidator.validateAgainstSchema(
        fieldConfig.schema,
        { [fieldName]: value },
        context
      );
    } else {
      // Use engine validation
      result = await this.engine.validateField(fieldName, value, context);
    }

    // Cache result
    this.validationCache.set(cacheKey, {
      result,
      timestamp: Date.now(),
      fieldName,
      value,
    });

    return result;
  }

  private updateFieldState(fieldName: string, result: ValidationResult, value: any): void {
    const fieldState = this.getFieldState(fieldName);

    fieldState.isValid = result.isValid;
    fieldState.isValidating = false;
    fieldState.errors = result.errors.map(error => this.formatErrorMessage(error));
    fieldState.warnings = this.config.showWarningsAsErrors
      ? []
      : result.warnings.map(warning => this.formatWarningMessage(warning));

    // Add warnings as errors if configured
    if (this.config.showWarningsAsErrors) {
      fieldState.errors.push(...result.warnings.map(warning => this.formatWarningMessage(warning)));
      fieldState.isValid = fieldState.isValid && result.warnings.length === 0;
    }

    fieldState.lastValidated = new Date();
    fieldState.validationCount++;

    this.formState.fields.set(fieldName, fieldState);
  }

  private updateFormState(): void {
    const fields = Array.from(this.formState.fields.values());

    this.formState.isValid =
      fields.every(field => field.isValid) && this.formState.globalErrors.length === 0;

    this.formState.isValidating = fields.some(field => field.isValidating);
    this.formState.lastValidated = new Date();
    this.formState.validationCount++;
  }

  private async generateSuggestions(
    fieldName: string,
    value: any,
    validationResult: ValidationResult
  ): Promise<void> {
    const fieldState = this.getFieldState(fieldName);

    try {
      const suggestions = await this.generateFieldSuggestions(fieldName, value, validationResult);
      fieldState.suggestions = suggestions.slice(0, this.config.maxSuggestions);

      if (suggestions.length > 0) {
        this.emitValidationEvent('suggestion', fieldState, fieldName);
      }
    } catch (error) {
      console.warn(`Failed to generate suggestions for ${fieldName}:`, error);
    }
  }

  private async generateFieldSuggestions(
    fieldName: string,
    value: any,
    validationResult?: ValidationResult
  ): Promise<string[]> {
    const suggestions: string[] = [];
    const fieldConfig = this.fieldConfigs.get(fieldName);

    if (!fieldConfig || !value) return suggestions;

    // Generate suggestions based on field type and validation errors
    switch (fieldName) {
      case 'title':
        suggestions.push(...this.generateTitleSuggestions(String(value), validationResult));
        break;
      case 'category':
        suggestions.push(...this.generateCategorySuggestions(String(value)));
        break;
      case 'tags':
        if (Array.isArray(value)) {
          suggestions.push(...this.generateTagSuggestions(value));
        }
        break;
      case 'problem':
      case 'solution':
        suggestions.push(...this.generateContentSuggestions(String(value), validationResult));
        break;
    }

    return suggestions;
  }

  private generateTitleSuggestions(title: string, validationResult?: ValidationResult): string[] {
    const suggestions: string[] = [];
    const lowerTitle = title.toLowerCase();

    // Suggest error codes if missing
    if (!/\b[A-Z]\d{3,4}[A-Z]?\b|S\d{3}\b/i.test(title)) {
      suggestions.push('Consider including specific error codes (S0C7, IEF212I, SQLCODE, etc.)');
    }

    // Suggest component if missing
    const components = ['JCL', 'VSAM', 'DB2', 'CICS', 'IMS', 'COBOL'];
    if (!components.some(comp => lowerTitle.includes(comp.toLowerCase()))) {
      suggestions.push('Consider mentioning the mainframe component (JCL, VSAM, DB2, etc.)');
    }

    // Suggest action words if missing
    const actionWords = ['error', 'issue', 'problem', 'abend', 'failure', 'status'];
    if (!actionWords.some(word => lowerTitle.includes(word))) {
      suggestions.push('Consider using descriptive terms like "error", "issue", or "problem"');
    }

    return suggestions;
  }

  private generateCategorySuggestions(category: string): string[] {
    const validCategories = [
      'JCL',
      'VSAM',
      'DB2',
      'Batch',
      'Functional',
      'CICS',
      'IMS',
      'TSO/ISPF',
      'RACF',
      'System',
      'Network',
      'Other',
    ];
    const suggestions: string[] = [];

    if (category && !validCategories.includes(category)) {
      // Find closest match
      const closest = this.findClosestString(category, validCategories);
      if (closest) {
        suggestions.push(`Did you mean "${closest}"?`);
      }
    }

    return suggestions;
  }

  private generateTagSuggestions(tags: string[]): string[] {
    const suggestions: string[] = [];

    // Common mainframe tags
    const commonTags = [
      'abend',
      'error-code',
      'jcl',
      'vsam',
      'db2',
      'cics',
      'ims',
      'cobol',
      'dataset',
      'file-error',
      'compilation',
      'runtime',
      'sql',
      'status-code',
    ];

    // Suggest commonly used tags that aren't present
    const currentTagsLower = tags.map(tag => tag.toLowerCase());
    const missingCommonTags = commonTags.filter(
      commonTag => !currentTagsLower.some(currentTag => currentTag.includes(commonTag))
    );

    if (missingCommonTags.length > 0) {
      suggestions.push(`Consider adding: ${missingCommonTags.slice(0, 3).join(', ')}`);
    }

    return suggestions;
  }

  private generateContentSuggestions(
    content: string,
    validationResult?: ValidationResult
  ): string[] {
    const suggestions: string[] = [];

    // Check for structured format
    const hasSteps = /^\s*\d+\.|\n\s*\d+\.|\*|\-|•/.test(content);
    if (!hasSteps && content.length > 100) {
      suggestions.push('Consider formatting as numbered steps (1., 2., 3.) for better readability');
    }

    // Check for verification steps
    if (!/\b(verify|check|confirm|test|validate)\b/i.test(content) && content.length > 200) {
      suggestions.push('Consider adding verification steps to confirm the solution worked');
    }

    return suggestions;
  }

  private createErrorState(fieldName: string, error: any): FieldValidationState {
    const fieldState = this.getFieldState(fieldName);
    fieldState.isValid = false;
    fieldState.isValidating = false;
    fieldState.errors = [`Validation failed: ${error.message}`];
    fieldState.warnings = [];
    fieldState.lastValidated = new Date();

    return fieldState;
  }

  private getCurrentFormData(): Record<string, any> {
    // This would need to be implemented based on how form data is tracked
    return {};
  }

  private formatErrorMessage(error: any): string {
    return error.message || 'Validation error';
  }

  private formatWarningMessage(warning: any): string {
    return warning.message || 'Validation warning';
  }

  private emitValidationEvent(
    type: 'field' | 'form' | 'suggestion',
    state: FieldValidationState | FormValidationState,
    field?: string
  ): void {
    this.emit('validation', {
      type,
      field,
      state,
      timestamp: new Date(),
    } as ValidationEvent);
  }

  private hashValue(value: any): string {
    return JSON.stringify(value);
  }

  private isCacheExpired(cached: CachedValidation): boolean {
    const maxAge = 30000; // 30 seconds
    return Date.now() - cached.timestamp > maxAge;
  }

  private calculateCacheHitRate(): number {
    // Simple cache hit rate calculation
    return 0.8; // Placeholder
  }

  private findClosestString(input: string, candidates: string[]): string | null {
    const inputLower = input.toLowerCase();
    let bestMatch = '';
    let bestScore = 0;

    for (const candidate of candidates) {
      const candidateLower = candidate.toLowerCase();

      // Simple similarity check
      if (candidateLower.startsWith(inputLower) || inputLower.startsWith(candidateLower)) {
        return candidate;
      }

      // Character overlap similarity
      const score = this.calculateStringSimilarity(inputLower, candidateLower);
      if (score > bestScore && score > 0.3) {
        bestMatch = candidate;
        bestScore = score;
      }
    }

    return bestMatch || null;
  }

  private calculateStringSimilarity(a: string, b: string): number {
    const setA = new Set(a);
    const setB = new Set(b);
    const intersection = new Set([...setA].filter(char => setB.has(char)));
    const union = new Set([...setA, ...setB]);

    return intersection.size / union.size;
  }
}

/**
 * Supporting interfaces
 */

interface FieldConfig {
  rules?: any[];
  schema?: string;
  suggestions?: boolean;
  customValidators?: string[];
}

interface CachedValidation {
  result: ValidationResult;
  timestamp: number;
  fieldName: string;
  value: any;
}

interface ValidationMetrics {
  totalValidations: number;
  fieldsConfigured: number;
  averageValidationsPerField: number;
  cacheHitRate: number;
  lastValidated: Date;
}

/**
 * Factory function for easy initialization
 */
export function createRealTimeValidator(config: RealTimeValidationConfig = {}): RealTimeValidator {
  return new RealTimeValidator(config);
}

/**
 * React hook for real-time validation (if using React)
 */
export function useRealTimeValidation(config: RealTimeValidationConfig = {}) {
  // This would be implemented as a React hook
  // Returns validation state and validation functions
  return {
    validator: new RealTimeValidator(config),
    validateField: () => {},
    validateForm: () => {},
    getFieldState: () => {},
    clearValidation: () => {},
  };
}
