import { KBEntry, KBEntryInput } from '../../../types/services';
export interface TransformationRule {
  id: string;
  name: string;
  description: string;
  sourceField: string;
  targetField: string;
  transformType: 'direct' | 'computed' | 'lookup' | 'conditional' | 'custom';
  transformFunction?: (value: any, record: any, context: TransformContext) => any;
  condition?: (record: any, context: TransformContext) => boolean;
  defaultValue?: any;
  required?: boolean;
  validation?: (value: any) => boolean;
}
export interface TransformContext {
  sourceSystem?: string;
  targetSystem?: string;
  sourceVersion?: string;
  targetVersion?: string;
  metadata?: Record<string, any>;
  options?: Record<string, any>;
}
export interface TransformationPipeline {
  id: string;
  name: string;
  description: string;
  rules: TransformationRule[];
  preProcessors: Array<(data: any[], context: TransformContext) => any[]>;
  postProcessors: Array<(data: any[], context: TransformContext) => any[]>;
  validations: Array<(data: any[], context: TransformContext) => ValidationIssue[]>;
}
export interface ValidationIssue {
  level: 'error' | 'warning' | 'info';
  field: string;
  message: string;
  recordIndex?: number;
  value?: any;
  suggestion?: string;
}
export interface TransformOptions {
  format?: string;
  includeMetrics?: boolean;
  includeHistory?: boolean;
  customTransform?: (entry: any) => any;
  fieldMappings?: Record<string, string>;
  targetSystem?: string;
  version?: string;
  preserveOriginal?: boolean;
  strictMode?: boolean;
}
export interface ImportTransformOptions {
  fieldMappings?: Record<string, string>;
  customTransform?: (entry: any) => any;
  sourceSystem?: string;
  sourceVersion?: string;
  defaultValues?: Record<string, any>;
  requiredFields?: string[];
  legacyCompatibility?: boolean;
  enhancedFeatures?: boolean;
  systemSpecific?: boolean;
}
export declare class DataTransformer {
  private pipelines;
  private systemMappings;
  private versionMappings;
  constructor();
  transform(entries: KBEntry[], options?: TransformOptions): Promise<any[]>;
  transformForImport(data: any[], options?: ImportTransformOptions): Promise<KBEntryInput[]>;
  transformWithPipeline(
    data: any[],
    pipelineId: string,
    context?: TransformContext
  ): Promise<any[]>;
  transformBatch(
    batch: any[],
    options: TransformOptions | ImportTransformOptions,
    batchIndex?: number
  ): Promise<any[]>;
  createPipeline(pipeline: Omit<TransformationPipeline, 'id'>): string;
  getAvailablePipelines(): Array<{
    id: string;
    name: string;
    description: string;
  }>;
  validateTransformation(
    sampleData: any[],
    options: TransformOptions | ImportTransformOptions
  ): {
    compatible: boolean;
    issues: ValidationIssue[];
    suggestions: string[];
  };
  private applyFormatTransformation;
  private applyFieldMappings;
  private applySystemTransformation;
  private applyVersionTransformation;
  private applyTransformationRules;
  private applyLegacyCompatibility;
  private applySystemImportMapping;
  private normalizeToKBEntries;
  private validateRequiredFields;
  private filterData;
  private transformValue;
  private ensureString;
  private normalizeCategory;
  private normalizeTags;
  private truncateText;
  private getSystemImportConfig;
  private initializeSystemMappings;
  private initializeVersionMappings;
  private initializeBuiltInPipelines;
}
export default DataTransformer;
//# sourceMappingURL=DataTransformer.d.ts.map
