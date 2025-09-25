import { BaseStoragePlugin } from './BaseStoragePlugin';
import { IStorageAdapter } from '../adapters/IStorageAdapter';
import { PluginConfig } from '../IStorageService';
export interface CodeTemplate {
  id: string;
  name: string;
  description: string;
  category:
    | 'error-handling'
    | 'data-validation'
    | 'file-operations'
    | 'calculations'
    | 'reports'
    | 'utility'
    | 'custom';
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
  validator: string;
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
export declare class TemplateEnginePlugin extends BaseStoragePlugin {
  private templates;
  private generationCache;
  private usageStats;
  constructor(adapter: IStorageAdapter, config?: TemplateEngineConfig);
  getName(): string;
  getVersion(): string;
  getDescription(): string;
  getMVPVersion(): number;
  getDependencies(): string[];
  protected getDefaultConfig(): TemplateEngineConfig;
  protected initializePlugin(): Promise<void>;
  protected cleanupPlugin(): Promise<void>;
  processData(data: any, context?: any): Promise<any>;
  createTemplate(templateData: Partial<CodeTemplate>): Promise<CodeTemplate>;
  generateCode(request: GenerationRequest): Promise<GenerationResult>;
  private processTemplate;
  private replaceParameter;
  private formatParameterValue;
  private processConditionals;
  private processLoops;
  private processFunctions;
  private applyCustomizations;
  private applyNamingConvention;
  private applyIndentation;
  private addLineNumbers;
  private ensureFixedFormat;
  private formatOutput;
  private addGenerationComments;
  private formatCode;
  private validateTemplateContent;
  private validateCOBOLSyntax;
  private isValidPeriodUsage;
  private validateParameters;
  private validateParameterType;
  private validateGeneratedCode;
  private runValidationRule;
  private validateSyntax;
  private validateStandards;
  extractTemplateFromKB(kbEntryId: string, options?: any): Promise<CodeTemplate>;
  private extractTemplateFromSolution;
  private parameterizeValues;
  private addTemplateStructure;
  private inferParameters;
  private inferParameterType;
  private generateParameterDescription;
  private mapCategoryToTemplate;
  private inferTemplateType;
  private generateValidationRules;
  private generateExampleParameters;
  private generateTemplateId;
  private hash;
  private generateCacheKey;
  private calculateComplexity;
  private calculateMaintainability;
  private estimateComplexity;
  private generateSuggestions;
  private generateWarnings;
  private createTables;
  private loadExistingTemplates;
  private persistTemplate;
  private persistTemplates;
  private loadBuiltInTemplates;
  private extractPatternsFromKB;
  getTemplate(templateId: string): Promise<CodeTemplate | null>;
  listTemplates(filters?: any): Promise<TemplateLibrary>;
  private calculateCategories;
  private getCategoryDescription;
  private calculateLibraryMetrics;
  updateTemplate(templateId: string, updates: Partial<CodeTemplate>): Promise<CodeTemplate>;
  deleteTemplate(templateId: string): Promise<boolean>;
  validateTemplate(
    templateId: string,
    parameters: Record<string, any>
  ): Promise<{
    valid: boolean;
    errors: string[];
  }>;
  getTemplateLibrary(): Promise<TemplateLibrary>;
  optimizeTemplate(templateId: string): Promise<CodeTemplate>;
}
//# sourceMappingURL=TemplateEnginePlugin.d.ts.map
