import { ValidationIssue } from './DataTransformer';
export interface ValidationOptions {
  strictMode?: boolean;
  allowPartialImport?: boolean;
  validateSchema?: boolean;
  customValidators?: Array<(entry: any) => ValidationResult>;
  businessRules?: ValidationRule[];
  dataQualityChecks?: boolean;
}
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  stats?: ValidationStats;
}
export interface ValidationStats {
  totalRecords: number;
  validRecords: number;
  invalidRecords: number;
  duplicateRecords: number;
  missingFields: Record<string, number>;
  invalidFieldValues: Record<string, number>;
}
export interface ValidationRule {
  id: string;
  name: string;
  description: string;
  field: string;
  type: 'required' | 'format' | 'range' | 'custom' | 'business';
  validator: (value: any, record: any, context?: any) => ValidationRuleResult;
  severity: 'error' | 'warning' | 'info';
  category: string;
}
export interface ValidationRuleResult {
  valid: boolean;
  message?: string;
  suggestion?: string;
  correctedValue?: any;
}
export interface DataQualityMetrics {
  completeness: number;
  accuracy: number;
  consistency: number;
  uniqueness: number;
  timeliness: number;
  validity: number;
}
export declare class ValidationService {
  private kbEntrySchema;
  private validationRules;
  private businessRules;
  constructor();
  validateImportData(data: any[], options?: ValidationOptions): Promise<ValidationResult>;
  validateRecord(
    record: any,
    index: number,
    options?: ValidationOptions
  ): Promise<{
    valid: boolean;
    issues: ValidationIssue[];
  }>;
  validateBatch(
    batch: any[],
    batchIndex?: number,
    options?: ValidationOptions
  ): Promise<ValidationResult>;
  getDataQualityMetrics(data: any[]): Promise<DataQualityMetrics>;
  getValidationSuggestions(field: string, value: any, validationError: string): string[];
  private initializeSchemas;
  private initializeValidationRules;
  private initializeBusinessRules;
  private validateSchema;
  private validateBusinessRules;
  private performDataQualityChecks;
  private performRecordQualityChecks;
  private validateTitle;
  private validateCategory;
  private validateTags;
  private isValidDate;
  private detectDuplicates;
  private findClosestCategory;
  private calculateSimilarity;
}
export default ValidationService;
//# sourceMappingURL=ValidationService.d.ts.map
