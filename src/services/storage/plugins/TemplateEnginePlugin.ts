/**
 * Template Engine Plugin (MVP4)
 * Provides template generation, management, and code generation capabilities
 * 
 * This plugin enables the creation of reusable code templates from successful patterns
 * and KB entries, supporting rapid development and standardization.
 */

import { BaseStoragePlugin } from './BaseStoragePlugin';
import { IStorageAdapter } from '../adapters/IStorageAdapter';
import { PluginConfig } from '../IStorageService';

export interface CodeTemplate {
  id: string;
  name: string;
  description: string;
  category: 'error-handling' | 'data-validation' | 'file-operations' | 'calculations' | 'reports' | 'utility' | 'custom';
  type: 'cobol' | 'jcl' | 'copybook' | 'proc' | 'mixed';
  template_content: string;
  parameters: TemplateParameter[];
  validation_rules: ValidationRule[];
  usage_count: number;
  success_rate: number;
  source_pattern?: string;
  source_kb_entries?: string[];
  created_by: string;
  created_at: Date;
  updated_at: Date;
  tags: string[];
  complexity_score: number;
  maintainability_score: number;
  examples: TemplateExample[];
}

export interface TemplateParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'list' | 'object';
  description: string;
  required: boolean;
  default_value?: any;
  validation_pattern?: string;
  allowed_values?: any[];
  placeholder?: string;
  group?: string;
}

export interface ValidationRule {
  name: string;
  type: 'syntax' | 'semantic' | 'performance' | 'security' | 'standards';
  description: string;
  validator: string; // JavaScript function as string
  error_message: string;
  warning_message?: string;
  auto_fix?: boolean;
}

export interface TemplateExample {
  name: string;
  description: string;
  parameters: Record<string, any>;
  expected_output: string;
  explanation: string;
}

export interface GenerationRequest {
  template_id: string;
  parameters: Record<string, any>;
  output_format?: 'formatted' | 'raw' | 'with_comments';
  validate?: boolean;
  customize?: TemplateCustomization;
}

export interface TemplateCustomization {
  line_numbers?: boolean;
  column_format?: 'fixed' | 'free';
  comment_style?: 'standard' | 'detailed' | 'minimal';
  naming_convention?: 'uppercase' | 'lowercase' | 'mixed';
  indentation?: 'spaces' | 'tabs';
  indent_size?: number;
}

export interface GenerationResult {
  template_id: string;
  generated_code: string;
  validation_results: ValidationResult[];
  metadata: GenerationMetadata;
  suggestions?: string[];
  warnings?: string[];
}

export interface ValidationResult {
  rule_name: string;
  passed: boolean;
  message: string;
  line?: number;
  column?: number;
  severity: 'error' | 'warning' | 'info';
  auto_fixable: boolean;
  fix_suggestion?: string;
}

export interface GenerationMetadata {
  generated_at: Date;
  parameters_used: Record<string, any>;
  template_version: string;
  generation_time_ms: number;
  lines_generated: number;
  complexity_estimate: number;
}

export interface TemplateLibrary {
  templates: CodeTemplate[];
  categories: TemplateCategory[];
  total_count: number;
  most_used: CodeTemplate[];
  recent_additions: CodeTemplate[];
  success_metrics: LibraryMetrics;
}

export interface TemplateCategory {
  name: string;
  description: string;
  template_count: number;
  usage_percentage: number;
  average_success_rate: number;
}

export interface LibraryMetrics {
  total_generations: number;
  average_success_rate: number;
  most_popular_category: string;
  total_time_saved_hours: number;
  error_reduction_percentage: number;
}

export interface TemplateEngineConfig extends PluginConfig {
  generation: {
    max_template_size_kb: number;
    generation_timeout_seconds: number;
    auto_validate_output: boolean;
    cache_generated_code: boolean;
    enable_ai_optimization: boolean;
  };
  validation: {
    strict_syntax_checking: boolean;
    performance_analysis: boolean;
    security_scanning: boolean;
    standards_compliance: boolean;
    custom_rules_enabled: boolean;
  };
  library: {
    auto_extract_patterns: boolean;
    min_usage_for_template: number;
    auto_update_templates: boolean;
    version_control: boolean;
    backup_frequency_hours: number;
  };
  ai_integration: {
    template_optimization: boolean;
    smart_parameter_inference: boolean;
    auto_documentation: boolean;
    pattern_recognition: boolean;
  };
}

export class TemplateEnginePlugin extends BaseStoragePlugin {
  private templates: Map<string, CodeTemplate> = new Map();
  private generationCache: Map<string, GenerationResult> = new Map();
  private usageStats: Map<string, number> = new Map();

  constructor(adapter: IStorageAdapter, config: TemplateEngineConfig = {} as TemplateEngineConfig) {
    super(adapter, config);
  }

  // ========================
  // Abstract Method Implementations
  // ========================

  getName(): string {
    return 'template-engine';
  }

  getVersion(): string {
    return '4.0.0';
  }

  getDescription(): string {
    return 'Provides template generation, management, and code generation capabilities';
  }

  getMVPVersion(): number {
    return 4;
  }

  getDependencies(): string[] {
    return ['full-text-search', 'raw-sql'];
  }

  protected getDefaultConfig(): TemplateEngineConfig {
    return {
      enabled: true,
      generation: {
        max_template_size_kb: 100,
        generation_timeout_seconds: 30,
        auto_validate_output: true,
        cache_generated_code: true,
        enable_ai_optimization: false
      },
      validation: {
        strict_syntax_checking: true,
        performance_analysis: true,
        security_scanning: true,
        standards_compliance: true,
        custom_rules_enabled: true
      },
      library: {
        auto_extract_patterns: true,
        min_usage_for_template: 5,
        auto_update_templates: true,
        version_control: true,
        backup_frequency_hours: 24
      },
      ai_integration: {
        template_optimization: false,
        smart_parameter_inference: false,
        auto_documentation: false,
        pattern_recognition: false
      }
    } as TemplateEngineConfig;
  }

  protected async initializePlugin(): Promise<void> {
    // Create tables for template engine
    await this.createTables();
    
    // Load existing templates
    await this.loadExistingTemplates();
    
    // Load built-in templates
    await this.loadBuiltInTemplates();
    
    // Start template optimization if enabled
    if ((this.config as TemplateEngineConfig).library.auto_extract_patterns) {
      await this.extractPatternsFromKB();
    }
    
    this.log('info', 'Template engine plugin initialized', {
      templates_loaded: this.templates.size,
      auto_extract: (this.config as TemplateEngineConfig).library.auto_extract_patterns
    });
  }

  protected async cleanupPlugin(): Promise<void> {
    // Save current state
    await this.persistTemplates();
    
    // Clear caches
    this.generationCache.clear();
    
    this.log('info', 'Template engine plugin cleaned up');
  }

  async processData(data: any, context?: any): Promise<any> {
    const { action, payload } = data;

    switch (action) {
      case 'create_template':
        return await this.createTemplate(payload);
      
      case 'generate_code':
        return await this.generateCode(payload as GenerationRequest);
      
      case 'get_template':
        return await this.getTemplate(payload.templateId);
      
      case 'list_templates':
        return await this.listTemplates(payload?.filters);
      
      case 'update_template':
        return await this.updateTemplate(payload.templateId, payload.updates);
      
      case 'delete_template':
        return await this.deleteTemplate(payload.templateId);
      
      case 'validate_template':
        return await this.validateTemplate(payload.templateId, payload.parameters);
      
      case 'extract_from_kb':
        return await this.extractTemplateFromKB(payload.kbEntryId, payload.options);
      
      case 'get_library':
        return await this.getTemplateLibrary();
      
      case 'optimize_template':
        return await this.optimizeTemplate(payload.templateId);
      
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  // ========================
  // Core Template Management
  // ========================

  async createTemplate(templateData: Partial<CodeTemplate>): Promise<CodeTemplate> {
    // Validate required fields
    if (!templateData.name || !templateData.template_content) {
      throw new Error('Template name and content are required');
    }
    
    const template: CodeTemplate = {
      id: this.generateTemplateId(templateData.name),
      name: templateData.name,
      description: templateData.description || '',
      category: templateData.category || 'custom',
      type: templateData.type || 'cobol',
      template_content: templateData.template_content,
      parameters: templateData.parameters || [],
      validation_rules: templateData.validation_rules || [],
      usage_count: 0,
      success_rate: 100, // Start optimistic
      source_pattern: templateData.source_pattern,
      source_kb_entries: templateData.source_kb_entries || [],
      created_by: templateData.created_by || 'system',
      created_at: new Date(),
      updated_at: new Date(),
      tags: templateData.tags || [],
      complexity_score: this.calculateComplexity(templateData.template_content),
      maintainability_score: this.calculateMaintainability(templateData.template_content),
      examples: templateData.examples || []
    };
    
    // Validate template syntax
    const validation = await this.validateTemplateContent(template);
    if (!validation.valid) {
      throw new Error(`Template validation failed: ${validation.errors.join(', ')}`);
    }
    
    // Store template
    this.templates.set(template.id, template);
    await this.persistTemplate(template);
    
    this.emit('template-created', { template });
    
    this.log('info', 'Template created', { 
      name: template.name, 
      category: template.category,
      parameters: template.parameters.length 
    });
    
    return template;
  }

  async generateCode(request: GenerationRequest): Promise<GenerationResult> {
    const startTime = Date.now();
    const config = this.config as TemplateEngineConfig;
    
    // Get template
    const template = this.templates.get(request.template_id);
    if (!template) {
      throw new Error(`Template not found: ${request.template_id}`);
    }
    
    // Check cache
    const cacheKey = this.generateCacheKey(request);
    if (config.generation.cache_generated_code && this.generationCache.has(cacheKey)) {
      const cached = this.generationCache.get(cacheKey)!;
      this.log('info', 'Using cached generation', { template: template.name });
      return cached;
    }
    
    // Validate parameters
    const paramValidation = this.validateParameters(template, request.parameters);
    if (!paramValidation.valid) {
      throw new Error(`Parameter validation failed: ${paramValidation.errors.join(', ')}`);
    }
    
    // Generate code
    let generatedCode = await this.processTemplate(template, request.parameters);
    
    // Apply customizations
    if (request.customize) {
      generatedCode = this.applyCustomizations(generatedCode, request.customize);
    }
    
    // Format output
    generatedCode = this.formatOutput(generatedCode, request.output_format || 'formatted');
    
    // Validate generated code
    let validationResults: ValidationResult[] = [];
    if (request.validate !== false && config.generation.auto_validate_output) {
      validationResults = await this.validateGeneratedCode(template, generatedCode);
    }
    
    // Create result
    const result: GenerationResult = {
      template_id: request.template_id,
      generated_code: generatedCode,
      validation_results: validationResults,
      metadata: {
        generated_at: new Date(),
        parameters_used: request.parameters,
        template_version: template.updated_at.toISOString(),
        generation_time_ms: Date.now() - startTime,
        lines_generated: generatedCode.split('\n').length,
        complexity_estimate: this.estimateComplexity(generatedCode)
      },
      suggestions: await this.generateSuggestions(template, generatedCode),
      warnings: this.generateWarnings(validationResults)
    };
    
    // Cache result
    if (config.generation.cache_generated_code) {
      this.generationCache.set(cacheKey, result);
    }
    
    // Update usage statistics
    template.usage_count++;
    this.usageStats.set(template.id, (this.usageStats.get(template.id) || 0) + 1);
    await this.persistTemplate(template);
    
    this.emit('code-generated', { template: template.name, result });
    
    return result;
  }

  private async processTemplate(template: CodeTemplate, parameters: Record<string, any>): Promise<string> {
    let content = template.template_content;
    
    // Replace parameters in template
    for (const param of template.parameters) {
      const value = parameters[param.name];
      if (value !== undefined) {
        content = this.replaceParameter(content, param.name, value, param.type);
      } else if (param.required) {
        throw new Error(`Required parameter missing: ${param.name}`);
      } else if (param.default_value !== undefined) {
        content = this.replaceParameter(content, param.name, param.default_value, param.type);
      }
    }
    
    // Process conditional blocks
    content = this.processConditionals(content, parameters);
    
    // Process loops
    content = this.processLoops(content, parameters);
    
    // Process functions
    content = this.processFunctions(content, parameters);
    
    return content;
  }

  private replaceParameter(content: string, paramName: string, value: any, type: string): string {
    const placeholder = `{{${paramName}}}`;
    const formattedValue = this.formatParameterValue(value, type);
    
    return content.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), formattedValue);
  }

  private formatParameterValue(value: any, type: string): string {
    switch (type) {
      case 'string':
        return String(value);
      case 'number':
        return Number(value).toString();
      case 'boolean':
        return value ? 'TRUE' : 'FALSE';
      case 'date':
        return new Date(value).toISOString().split('T')[0];
      case 'list':
        return Array.isArray(value) ? value.join(', ') : String(value);
      default:
        return String(value);
    }
  }

  private processConditionals(content: string, parameters: Record<string, any>): string {
    // Process {{#if condition}} blocks
    const ifPattern = /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
    
    return content.replace(ifPattern, (match, condition, block) => {
      const value = parameters[condition];
      return value ? block : '';
    });
  }

  private processLoops(content: string, parameters: Record<string, any>): string {
    // Process {{#each array}} blocks
    const eachPattern = /\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g;
    
    return content.replace(eachPattern, (match, arrayName, block) => {
      const array = parameters[arrayName];
      if (!Array.isArray(array)) return '';
      
      return array.map((item, index) => {
        let itemBlock = block;
        // Replace {{this}} with current item
        itemBlock = itemBlock.replace(/\{\{this\}\}/g, String(item));
        // Replace {{@index}} with current index
        itemBlock = itemBlock.replace(/\{\{@index\}\}/g, String(index));
        return itemBlock;
      }).join('');
    });
  }

  private processFunctions(content: string, parameters: Record<string, any>): string {
    // Process {{uppercase value}} and other functions
    const funcPattern = /\{\{(\w+)\s+([^}]+)\}\}/g;
    
    return content.replace(funcPattern, (match, funcName, args) => {
      const argValue = parameters[args.trim()] || args.trim();
      
      switch (funcName.toLowerCase()) {
        case 'uppercase':
          return String(argValue).toUpperCase();
        case 'lowercase':
          return String(argValue).toLowerCase();
        case 'pad':
          const [str, length] = args.split(',').map(s => s.trim());
          const strValue = parameters[str] || str;
          const lengthValue = parseInt(parameters[length] || length);
          return String(strValue).padEnd(lengthValue, ' ');
        case 'format_date':
          return new Date(argValue).toLocaleDateString();
        default:
          return match; // Unknown function, leave as is
      }
    });
  }

  private applyCustomizations(code: string, customization: TemplateCustomization): string {
    let customized = code;
    
    // Apply naming convention
    if (customization.naming_convention) {
      customized = this.applyNamingConvention(customized, customization.naming_convention);
    }
    
    // Apply indentation
    if (customization.indentation && customization.indent_size) {
      customized = this.applyIndentation(customized, customization.indentation, customization.indent_size);
    }
    
    // Apply line numbers
    if (customization.line_numbers) {
      customized = this.addLineNumbers(customized);
    }
    
    // Apply column format
    if (customization.column_format === 'fixed') {
      customized = this.ensureFixedFormat(customized);
    }
    
    return customized;
  }

  private applyNamingConvention(code: string, convention: string): string {
    // Apply naming convention to COBOL identifiers
    const identifierPattern = /\b[A-Z][A-Z0-9-]*\b/g;
    
    return code.replace(identifierPattern, (match) => {
      switch (convention) {
        case 'uppercase':
          return match.toUpperCase();
        case 'lowercase':
          return match.toLowerCase();
        case 'mixed':
          return match.charAt(0).toUpperCase() + match.slice(1).toLowerCase();
        default:
          return match;
      }
    });
  }

  private applyIndentation(code: string, type: string, size: number): string {
    const lines = code.split('\n');
    const indent = type === 'tabs' ? '\t' : ' '.repeat(size);
    
    return lines.map(line => {
      if (line.trim() && line.length > 7) {
        // Preserve COBOL column structure but adjust indentation
        const prefix = line.substring(0, 7);
        const content = line.substring(7);
        return prefix + indent + content.trim();
      }
      return line;
    }).join('\n');
  }

  private addLineNumbers(code: string): string {
    const lines = code.split('\n');
    return lines.map((line, index) => {
      const lineNum = (index + 1).toString().padStart(6, '0');
      return lineNum + ' ' + line;
    }).join('\n');
  }

  private ensureFixedFormat(code: string): string {
    const lines = code.split('\n');
    return lines.map(line => {
      if (line.length > 72) {
        return line.substring(0, 72);
      }
      if (line.length < 72) {
        return line.padEnd(72, ' ');
      }
      return line;
    }).join('\n');
  }

  private formatOutput(code: string, format: string): string {
    switch (format) {
      case 'raw':
        return code;
      case 'with_comments':
        return this.addGenerationComments(code);
      case 'formatted':
      default:
        return this.formatCode(code);
    }
  }

  private addGenerationComments(code: string): string {
    const timestamp = new Date().toISOString();
    const header = `
      * Generated by Template Engine
      * Timestamp: ${timestamp}
      * Template: Auto-generated
      * Warning: Modify with caution
      *
    `.replace(/^      /gm, '');
    
    return header + code;
  }

  private formatCode(code: string): string {
    // Basic COBOL formatting
    const lines = code.split('\n');
    return lines.map(line => {
      if (line.trim() === '') return line;
      
      // Ensure proper column structure
      if (line.length < 7) {
        line = line.padEnd(7, ' ');
      }
      
      // Trim to 72 columns
      if (line.length > 72) {
        line = line.substring(0, 72);
      }
      
      return line;
    }).join('\n');
  }

  // ========================
  // Template Validation
  // ========================

  private async validateTemplateContent(template: CodeTemplate): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    
    // Check for required parameters placeholders
    const parameterPattern = /\{\{(\w+)\}\}/g;
    const matches = template.template_content.match(parameterPattern);
    
    if (matches) {
      const referencedParams = matches.map(match => match.slice(2, -2));
      const definedParams = template.parameters.map(p => p.name);
      
      for (const param of referencedParams) {
        if (!definedParams.includes(param)) {
          errors.push(`Referenced parameter '${param}' is not defined`);
        }
      }
    }
    
    // Check for syntax issues in template
    if (template.type === 'cobol') {
      const syntaxErrors = this.validateCOBOLSyntax(template.template_content);
      errors.push(...syntaxErrors);
    }
    
    // Validate parameter definitions
    for (const param of template.parameters) {
      if (!param.name || !param.type) {
        errors.push(`Parameter must have name and type: ${JSON.stringify(param)}`);
      }
      
      if (param.validation_pattern) {
        try {
          new RegExp(param.validation_pattern);
        } catch {
          errors.push(`Invalid validation pattern for parameter '${param.name}'`);
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  private validateCOBOLSyntax(content: string): string[] {
    const errors: string[] = [];
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
      const lineNum = index + 1;
      
      // Skip comments and empty lines
      if (line.length < 7 || line[6] === '*' || line.trim() === '') {
        return;
      }
      
      // Check column format
      if (line.length > 72) {
        errors.push(`Line ${lineNum}: Exceeds 72 characters`);
      }
      
      const code = line.substring(7).trim();
      
      // Check for common syntax issues
      if (code.includes('{{') || code.includes('}}')) {
        // Template placeholder - skip detailed syntax check
        return;
      }
      
      // Check for unmatched periods
      if (code.includes('.') && !this.isValidPeriodUsage(code)) {
        errors.push(`Line ${lineNum}: Invalid period usage`);
      }
    });
    
    return errors;
  }

  private isValidPeriodUsage(code: string): boolean {
    // Simplified check for COBOL period usage
    // Periods should be at end of statements or after division/section names
    const periods = code.match(/\./g);
    if (!periods) return true;
    
    // Allow periods in literals
    if (code.includes('"') || code.includes("'")) return true;
    
    // Check if period is at end
    return code.trim().endsWith('.');
  }

  private validateParameters(template: CodeTemplate, parameters: Record<string, any>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    for (const param of template.parameters) {
      const value = parameters[param.name];
      
      // Check required parameters
      if (param.required && (value === undefined || value === null || value === '')) {
        errors.push(`Required parameter missing: ${param.name}`);
        continue;
      }
      
      // Skip validation if parameter not provided and not required
      if (value === undefined) continue;
      
      // Type validation
      if (!this.validateParameterType(value, param.type)) {
        errors.push(`Invalid type for parameter '${param.name}': expected ${param.type}`);
      }
      
      // Pattern validation
      if (param.validation_pattern && typeof value === 'string') {
        const pattern = new RegExp(param.validation_pattern);
        if (!pattern.test(value)) {
          errors.push(`Parameter '${param.name}' does not match required pattern`);
        }
      }
      
      // Allowed values validation
      if (param.allowed_values && param.allowed_values.length > 0) {
        if (!param.allowed_values.includes(value)) {
          errors.push(`Parameter '${param.name}' must be one of: ${param.allowed_values.join(', ')}`);
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  private validateParameterType(value: any, expectedType: string): boolean {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'date':
        return value instanceof Date || !isNaN(Date.parse(value));
      case 'list':
        return Array.isArray(value);
      case 'object':
        return typeof value === 'object' && value !== null;
      default:
        return true; // Unknown type, assume valid
    }
  }

  private async validateGeneratedCode(template: CodeTemplate, generatedCode: string): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];
    
    // Run template-specific validation rules
    for (const rule of template.validation_rules) {
      const result = await this.runValidationRule(rule, generatedCode, template);
      results.push(result);
    }
    
    // Run general validation
    if ((this.config as TemplateEngineConfig).validation.syntax_checking) {
      results.push(...await this.validateSyntax(generatedCode, template.type));
    }
    
    if ((this.config as TemplateEngineConfig).validation.standards_compliance) {
      results.push(...await this.validateStandards(generatedCode));
    }
    
    return results;
  }

  private async runValidationRule(rule: ValidationRule, code: string, template: CodeTemplate): Promise<ValidationResult> {
    try {
      // Create a safe evaluation context
      const context = {
        code,
        template,
        lines: code.split('\n'),
        // Add utility functions
        includes: (search: string) => code.includes(search),
        matches: (pattern: string) => new RegExp(pattern).test(code),
        lineCount: () => code.split('\n').length
      };
      
      // Evaluate the validator function
      const validator = new Function('context', `
        with (context) {
          return ${rule.validator};
        }
      `);
      
      const passed = validator(context);
      
      return {
        rule_name: rule.name,
        passed: Boolean(passed),
        message: passed ? 'Validation passed' : rule.error_message,
        severity: passed ? 'info' : (rule.type === 'syntax' ? 'error' : 'warning'),
        auto_fixable: rule.auto_fix || false
      };
    } catch (error) {
      return {
        rule_name: rule.name,
        passed: false,
        message: `Validation rule error: ${error.message}`,
        severity: 'error',
        auto_fixable: false
      };
    }
  }

  private async validateSyntax(code: string, type: string): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];
    
    if (type === 'cobol') {
      const errors = this.validateCOBOLSyntax(code);
      results.push(...errors.map(error => ({
        rule_name: 'syntax_check',
        passed: false,
        message: error,
        severity: 'error' as const,
        auto_fixable: false
      })));
    }
    
    return results;
  }

  private async validateStandards(code: string): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];
    const lines = code.split('\n');
    
    lines.forEach((line, index) => {
      const lineNum = index + 1;
      
      // Check line length
      if (line.length > 72) {
        results.push({
          rule_name: 'line_length',
          passed: false,
          message: `Line ${lineNum} exceeds 72 characters`,
          line: lineNum,
          severity: 'warning',
          auto_fixable: true,
          fix_suggestion: 'Truncate or wrap line'
        });
      }
    });
    
    return results;
  }

  // ========================
  // Pattern Extraction
  // ========================

  async extractTemplateFromKB(kbEntryId: string, options: any = {}): Promise<CodeTemplate> {
    // Get KB entry
    const kbEntry = await this.adapter.executeSQL('SELECT * FROM kb_entries WHERE id = ?', [kbEntryId]);
    if (!kbEntry || kbEntry.length === 0) {
      throw new Error(`KB entry not found: ${kbEntryId}`);
    }
    
    const entry = kbEntry[0];
    
    // Extract template from solution
    const templateContent = this.extractTemplateFromSolution(entry.solution);
    const parameters = this.inferParameters(templateContent);
    
    const template: Partial<CodeTemplate> = {
      name: `Template: ${entry.title}`,
      description: `Auto-extracted from KB entry: ${entry.title}`,
      category: this.mapCategoryToTemplate(entry.category),
      type: this.inferTemplateType(templateContent),
      template_content: templateContent,
      parameters,
      validation_rules: this.generateValidationRules(templateContent),
      source_kb_entries: [kbEntryId],
      created_by: 'auto-extract',
      tags: entry.tags ? entry.tags.split(',') : [],
      examples: [{
        name: 'Basic Example',
        description: 'Example from KB entry',
        parameters: this.generateExampleParameters(parameters),
        expected_output: templateContent,
        explanation: entry.problem
      }]
    };
    
    return await this.createTemplate(template);
  }

  private extractTemplateFromSolution(solution: string): string {
    // Convert step-by-step solution to template
    let template = solution;
    
    // Replace specific values with parameters
    template = this.parameterizeValues(template);
    
    // Add template structure
    template = this.addTemplateStructure(template);
    
    return template;
  }

  private parameterizeValues(content: string): string {
    let parameterized = content;
    
    // Replace dataset names
    parameterized = parameterized.replace(/\b[A-Z0-9]+\.[A-Z0-9.]+\b/g, '{{DATASET_NAME}}');
    
    // Replace program names
    parameterized = parameterized.replace(/\bPROGRAM-ID\.\s+([A-Z0-9-]+)/g, 'PROGRAM-ID. {{PROGRAM_NAME}}');
    
    // Replace file names
    parameterized = parameterized.replace(/\b[A-Z0-9-]+\.DAT\b/g, '{{FILE_NAME}}');
    
    // Replace numeric values
    parameterized = parameterized.replace(/\b\d+\b/g, (match) => {
      const num = parseInt(match);
      if (num > 100) return '{{RECORD_SIZE}}';
      if (num > 10) return '{{BUFFER_SIZE}}';
      return match;
    });
    
    return parameterized;
  }

  private addTemplateStructure(content: string): string {
    // Add COBOL structure if not present
    if (!content.includes('IDENTIFICATION DIVISION')) {
      return `       IDENTIFICATION DIVISION.
       PROGRAM-ID. {{PROGRAM_NAME}}.
       
       ENVIRONMENT DIVISION.
       
       DATA DIVISION.
       WORKING-STORAGE SECTION.
       {{#if VARIABLES}}
       ${content}
       {{/if}}
       
       PROCEDURE DIVISION.
       MAIN-LOGIC.
           ${content}
           STOP RUN.`;
    }
    
    return content;
  }

  private inferParameters(templateContent: string): TemplateParameter[] {
    const parameters: TemplateParameter[] = [];
    const paramPattern = /\{\{(\w+)\}\}/g;
    const matches = templateContent.match(paramPattern);
    
    if (matches) {
      const uniqueParams = [...new Set(matches.map(m => m.slice(2, -2)))];
      
      for (const paramName of uniqueParams) {
        const parameter: TemplateParameter = {
          name: paramName,
          type: this.inferParameterType(paramName),
          description: this.generateParameterDescription(paramName),
          required: true
        };
        
        // Add validation patterns
        if (paramName.includes('NAME')) {
          parameter.validation_pattern = '^[A-Z0-9-]+$';
        }
        
        parameters.push(parameter);
      }
    }
    
    return parameters;
  }

  private inferParameterType(paramName: string): string {
    const name = paramName.toLowerCase();
    
    if (name.includes('count') || name.includes('size') || name.includes('number')) {
      return 'number';
    }
    
    if (name.includes('enable') || name.includes('flag') || name.includes('option')) {
      return 'boolean';
    }
    
    if (name.includes('date') || name.includes('time')) {
      return 'date';
    }
    
    if (name.includes('list') || name.includes('array')) {
      return 'list';
    }
    
    return 'string';
  }

  private generateParameterDescription(paramName: string): string {
    const name = paramName.toLowerCase().replace(/_/g, ' ');
    return `Parameter for ${name}`;
  }

  private mapCategoryToTemplate(kbCategory: string): CodeTemplate['category'] {
    const mapping: Record<string, CodeTemplate['category']> = {
      'JCL': 'file-operations',
      'VSAM': 'file-operations',
      'DB2': 'data-validation',
      'Batch': 'utility',
      'Functional': 'calculations'
    };
    
    return mapping[kbCategory] || 'custom';
  }

  private inferTemplateType(content: string): CodeTemplate['type'] {
    if (content.includes('IDENTIFICATION DIVISION')) return 'cobol';
    if (content.includes('//JOB') || content.includes('//EXEC')) return 'jcl';
    if (content.includes('PROC ')) return 'proc';
    return 'cobol';
  }

  private generateValidationRules(content: string): ValidationRule[] {
    const rules: ValidationRule[] = [];
    
    // Add basic COBOL validation
    if (content.includes('IDENTIFICATION DIVISION')) {
      rules.push({
        name: 'cobol_structure',
        type: 'syntax',
        description: 'Validate COBOL program structure',
        validator: 'code.includes("IDENTIFICATION DIVISION") && code.includes("PROCEDURE DIVISION")',
        error_message: 'COBOL program must have required divisions'
      });
    }
    
    // Add parameter validation
    rules.push({
      name: 'required_parameters',
      type: 'semantic',
      description: 'Check all parameters are replaced',
      validator: '!code.includes("{{") && !code.includes("}}")',
      error_message: 'All template parameters must be replaced'
    });
    
    return rules;
  }

  private generateExampleParameters(parameters: TemplateParameter[]): Record<string, any> {
    const example: Record<string, any> = {};
    
    for (const param of parameters) {
      switch (param.type) {
        case 'string':
          example[param.name] = param.name.includes('NAME') ? 'EXAMPLE-NAME' : 'EXAMPLE-VALUE';
          break;
        case 'number':
          example[param.name] = 100;
          break;
        case 'boolean':
          example[param.name] = true;
          break;
        case 'date':
          example[param.name] = new Date().toISOString().split('T')[0];
          break;
        case 'list':
          example[param.name] = ['ITEM1', 'ITEM2'];
          break;
        default:
          example[param.name] = 'EXAMPLE';
      }
    }
    
    return example;
  }

  // ========================
  // Helper Methods
  // ========================

  private generateTemplateId(name: string): string {
    return `template-${Date.now()}-${this.hash(name)}`;
  }

  private hash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  private generateCacheKey(request: GenerationRequest): string {
    const params = JSON.stringify(request.parameters);
    const customize = JSON.stringify(request.customize || {});
    return `${request.template_id}-${this.hash(params + customize)}`;
  }

  private calculateComplexity(content: string): number {
    const lines = content.split('\n');
    let complexity = 1;
    
    for (const line of lines) {
      const code = line.toLowerCase();
      // Decision points
      if (code.includes('if ') || code.includes('evaluate') || code.includes('perform until')) {
        complexity++;
      }
      // Loops
      if (code.includes('perform') && code.includes('times')) {
        complexity++;
      }
      // Template complexity
      if (code.includes('{{#if') || code.includes('{{#each')) {
        complexity++;
      }
    }
    
    return complexity;
  }

  private calculateMaintainability(content: string): number {
    const lines = content.split('\n').filter(l => l.trim());
    const commentLines = lines.filter(l => l.includes('*') || l.includes('{{!')).length;
    const codeLines = lines.length - commentLines;
    
    const commentRatio = codeLines > 0 ? commentLines / codeLines : 0;
    const complexity = this.calculateComplexity(content);
    
    // Higher score for well-commented, less complex templates
    return Math.max(0, Math.min(100, 100 - complexity * 5 + commentRatio * 20));
  }

  private estimateComplexity(code: string): number {
    return this.calculateComplexity(code);
  }

  private async generateSuggestions(template: CodeTemplate, generatedCode: string): Promise<string[]> {
    const suggestions: string[] = [];
    
    // Check for potential improvements
    if (generatedCode.split('\n').length > 100) {
      suggestions.push('Consider breaking this into smaller modules for better maintainability');
    }
    
    if (!generatedCode.includes('*')) {
      suggestions.push('Add comments to improve code documentation');
    }
    
    if (template.complexity_score > 10) {
      suggestions.push('Template complexity is high - consider simplification');
    }
    
    return suggestions;
  }

  private generateWarnings(validationResults: ValidationResult[]): string[] {
    return validationResults
      .filter(result => !result.passed && result.severity === 'warning')
      .map(result => result.message);
  }

  // ========================
  // Database Operations
  // ========================

  private async createTables(): Promise<void> {
    const createTemplatesTable = `
      CREATE TABLE IF NOT EXISTS code_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        category TEXT,
        type TEXT,
        template_content TEXT NOT NULL,
        parameters TEXT, -- JSON
        validation_rules TEXT, -- JSON
        usage_count INTEGER DEFAULT 0,
        success_rate REAL DEFAULT 100.0,
        source_pattern TEXT,
        source_kb_entries TEXT, -- JSON array
        created_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        tags TEXT, -- JSON array
        complexity_score REAL,
        maintainability_score REAL,
        examples TEXT -- JSON
      )
    `;
    
    const createGenerationsTable = `
      CREATE TABLE IF NOT EXISTS template_generations (
        id TEXT PRIMARY KEY,
        template_id TEXT NOT NULL,
        parameters_used TEXT, -- JSON
        generated_code TEXT,
        generation_time_ms INTEGER,
        success BOOLEAN,
        validation_passed BOOLEAN,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (template_id) REFERENCES code_templates(id)
      )
    `;
    
    const createIndexes = `
      CREATE INDEX IF NOT EXISTS idx_templates_category ON code_templates(category);
      CREATE INDEX IF NOT EXISTS idx_templates_type ON code_templates(type);
      CREATE INDEX IF NOT EXISTS idx_templates_usage ON code_templates(usage_count DESC);
      CREATE INDEX IF NOT EXISTS idx_generations_template ON template_generations(template_id);
      CREATE INDEX IF NOT EXISTS idx_generations_created ON template_generations(created_at);
    `;
    
    await this.adapter.executeSQL(createTemplatesTable);
    await this.adapter.executeSQL(createGenerationsTable);
    await this.adapter.executeSQL(createIndexes);
  }

  private async loadExistingTemplates(): Promise<void> {
    const templates = await this.adapter.executeSQL('SELECT * FROM code_templates ORDER BY created_at DESC');
    
    templates.forEach((row: any) => {
      const template: CodeTemplate = {
        id: row.id,
        name: row.name,
        description: row.description,
        category: row.category,
        type: row.type,
        template_content: row.template_content,
        parameters: row.parameters ? JSON.parse(row.parameters) : [],
        validation_rules: row.validation_rules ? JSON.parse(row.validation_rules) : [],
        usage_count: row.usage_count,
        success_rate: row.success_rate,
        source_pattern: row.source_pattern,
        source_kb_entries: row.source_kb_entries ? JSON.parse(row.source_kb_entries) : [],
        created_by: row.created_by,
        created_at: new Date(row.created_at),
        updated_at: new Date(row.updated_at),
        tags: row.tags ? JSON.parse(row.tags) : [],
        complexity_score: row.complexity_score,
        maintainability_score: row.maintainability_score,
        examples: row.examples ? JSON.parse(row.examples) : []
      };
      
      this.templates.set(template.id, template);
    });
  }

  private async persistTemplate(template: CodeTemplate): Promise<void> {
    const sql = `
      INSERT OR REPLACE INTO code_templates 
      (id, name, description, category, type, template_content, parameters, validation_rules, 
       usage_count, success_rate, source_pattern, source_kb_entries, created_by, created_at, 
       updated_at, tags, complexity_score, maintainability_score, examples)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    await this.adapter.executeSQL(sql, [
      template.id,
      template.name,
      template.description,
      template.category,
      template.type,
      template.template_content,
      JSON.stringify(template.parameters),
      JSON.stringify(template.validation_rules),
      template.usage_count,
      template.success_rate,
      template.source_pattern,
      JSON.stringify(template.source_kb_entries),
      template.created_by,
      template.created_at.toISOString(),
      template.updated_at.toISOString(),
      JSON.stringify(template.tags),
      template.complexity_score,
      template.maintainability_score,
      JSON.stringify(template.examples)
    ]);
  }

  private async persistTemplates(): Promise<void> {
    for (const template of this.templates.values()) {
      await this.persistTemplate(template);
    }
  }

  private async loadBuiltInTemplates(): Promise<void> {
    // Load some basic built-in templates
    const builtInTemplates: Partial<CodeTemplate>[] = [
      {
        name: 'Basic COBOL Program',
        description: 'Basic COBOL program structure template',
        category: 'utility',
        type: 'cobol',
        template_content: `       IDENTIFICATION DIVISION.
       PROGRAM-ID. {{PROGRAM_NAME}}.
       
       ENVIRONMENT DIVISION.
       
       DATA DIVISION.
       WORKING-STORAGE SECTION.
       01  WS-{{VARIABLE_NAME}}     PIC X({{LENGTH}}).
       
       PROCEDURE DIVISION.
       MAIN-LOGIC.
           DISPLAY "{{MESSAGE}}"
           STOP RUN.`,
        parameters: [
          { name: 'PROGRAM_NAME', type: 'string', description: 'Program name', required: true },
          { name: 'VARIABLE_NAME', type: 'string', description: 'Variable name', required: true },
          { name: 'LENGTH', type: 'number', description: 'Variable length', required: true, default_value: 10 },
          { name: 'MESSAGE', type: 'string', description: 'Display message', required: false, default_value: 'Hello World' }
        ],
        created_by: 'system',
        tags: ['basic', 'cobol', 'structure']
      }
    ];
    
    for (const templateData of builtInTemplates) {
      try {
        await this.createTemplate(templateData);
      } catch (error) {
        // Template might already exist
        this.log('warn', 'Failed to create built-in template', { name: templateData.name, error: error.message });
      }
    }
  }

  private async extractPatternsFromKB(): Promise<void> {
    // Get all KB entries with high success rates
    const successfulEntries = await this.adapter.executeSQL(`
      SELECT * FROM kb_entries 
      WHERE success_count > ? AND (success_count * 1.0 / (success_count + failure_count)) > 0.8
      ORDER BY usage_count DESC
      LIMIT 10
    `, [(this.config as TemplateEngineConfig).library.min_usage_for_template]);
    
    for (const entry of successfulEntries) {
      try {
        await this.extractTemplateFromKB(entry.id);
        this.log('info', 'Extracted template from KB', { entry: entry.title });
      } catch (error) {
        this.log('warn', 'Failed to extract template', { entry: entry.title, error: error.message });
      }
    }
  }

  // ========================
  // Public API Methods
  // ========================

  async getTemplate(templateId: string): Promise<CodeTemplate | null> {
    return this.templates.get(templateId) || null;
  }

  async listTemplates(filters?: any): Promise<TemplateLibrary> {
    let templates = Array.from(this.templates.values());
    
    // Apply filters
    if (filters) {
      if (filters.category) {
        templates = templates.filter(t => t.category === filters.category);
      }
      if (filters.type) {
        templates = templates.filter(t => t.type === filters.type);
      }
      if (filters.tags && filters.tags.length > 0) {
        templates = templates.filter(t => 
          filters.tags.some((tag: string) => t.tags.includes(tag))
        );
      }
    }
    
    // Calculate categories
    const categories = this.calculateCategories(templates);
    
    // Get most used
    const mostUsed = templates
      .sort((a, b) => b.usage_count - a.usage_count)
      .slice(0, 10);
    
    // Get recent additions
    const recentAdditions = templates
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
      .slice(0, 5);
    
    return {
      templates,
      categories,
      total_count: templates.length,
      most_used: mostUsed,
      recent_additions: recentAdditions,
      success_metrics: this.calculateLibraryMetrics(templates)
    };
  }

  private calculateCategories(templates: CodeTemplate[]): TemplateCategory[] {
    const categoryMap = new Map<string, { count: number; totalSuccess: number }>();
    
    for (const template of templates) {
      const existing = categoryMap.get(template.category) || { count: 0, totalSuccess: 0 };
      existing.count++;
      existing.totalSuccess += template.success_rate;
      categoryMap.set(template.category, existing);
    }
    
    const totalTemplates = templates.length;
    
    return Array.from(categoryMap.entries()).map(([name, data]) => ({
      name,
      description: this.getCategoryDescription(name),
      template_count: data.count,
      usage_percentage: totalTemplates > 0 ? (data.count / totalTemplates) * 100 : 0,
      average_success_rate: data.count > 0 ? data.totalSuccess / data.count : 0
    }));
  }

  private getCategoryDescription(category: string): string {
    const descriptions: Record<string, string> = {
      'error-handling': 'Templates for handling errors and exceptions',
      'data-validation': 'Templates for validating and processing data',
      'file-operations': 'Templates for file I/O operations',
      'calculations': 'Templates for mathematical calculations',
      'reports': 'Templates for generating reports',
      'utility': 'General utility templates',
      'custom': 'Custom user-defined templates'
    };
    
    return descriptions[category] || 'Templates in this category';
  }

  private calculateLibraryMetrics(templates: CodeTemplate[]): LibraryMetrics {
    const totalGenerations = templates.reduce((sum, t) => sum + t.usage_count, 0);
    const avgSuccessRate = templates.length > 0 
      ? templates.reduce((sum, t) => sum + t.success_rate, 0) / templates.length 
      : 0;
    
    // Find most popular category
    const categoryUsage = new Map<string, number>();
    templates.forEach(t => {
      categoryUsage.set(t.category, (categoryUsage.get(t.category) || 0) + t.usage_count);
    });
    
    const mostPopularCategory = Array.from(categoryUsage.entries())
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'none';
    
    return {
      total_generations: totalGenerations,
      average_success_rate: avgSuccessRate,
      most_popular_category: mostPopularCategory,
      total_time_saved_hours: totalGenerations * 0.5, // Assume 30 min saved per generation
      error_reduction_percentage: Math.min(90, avgSuccessRate * 0.8) // Estimate
    };
  }

  async updateTemplate(templateId: string, updates: Partial<CodeTemplate>): Promise<CodeTemplate> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }
    
    // Apply updates
    Object.assign(template, updates, { updated_at: new Date() });
    
    // Validate updated template
    const validation = await this.validateTemplateContent(template);
    if (!validation.valid) {
      throw new Error(`Template validation failed: ${validation.errors.join(', ')}`);
    }
    
    // Persist changes
    await this.persistTemplate(template);
    
    this.emit('template-updated', { template });
    
    return template;
  }

  async deleteTemplate(templateId: string): Promise<boolean> {
    const template = this.templates.get(templateId);
    if (!template) {
      return false;
    }
    
    // Remove from memory
    this.templates.delete(templateId);
    
    // Remove from database
    await this.adapter.executeSQL('DELETE FROM code_templates WHERE id = ?', [templateId]);
    await this.adapter.executeSQL('DELETE FROM template_generations WHERE template_id = ?', [templateId]);
    
    this.emit('template-deleted', { templateId, name: template.name });
    
    return true;
  }

  async validateTemplate(templateId: string, parameters: Record<string, any>): Promise<{ valid: boolean; errors: string[] }> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }
    
    return this.validateParameters(template, parameters);
  }

  async getTemplateLibrary(): Promise<TemplateLibrary> {
    return await this.listTemplates();
  }

  async optimizeTemplate(templateId: string): Promise<CodeTemplate> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }
    
    // Analyze usage patterns
    const generations = await this.adapter.executeSQL(
      'SELECT * FROM template_generations WHERE template_id = ? ORDER BY created_at DESC LIMIT 100',
      [templateId]
    );
    
    // Optimize based on common usage patterns
    // This is a simplified optimization - could be much more sophisticated
    if (generations.length > 10) {
      const successRate = generations.filter((g: any) => g.success).length / generations.length;
      template.success_rate = successRate * 100;
      
      // Update maintainability score based on usage
      if (successRate > 0.9) {
        template.maintainability_score = Math.min(100, template.maintainability_score + 5);
      }
      
      await this.persistTemplate(template);
    }
    
    this.emit('template-optimized', { template });
    
    return template;
  }
}