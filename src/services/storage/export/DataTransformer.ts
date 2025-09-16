/**
 * Data Transformer - Advanced data transformation and mapping
 * Handles cross-system data mapping, versioning, and custom transformations
 */

import { v4 as uuidv4 } from 'uuid';
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

/**
 * Advanced data transformation service with rule-based transformations
 */
export class DataTransformer {
  private pipelines = new Map<string, TransformationPipeline>();
  private systemMappings = new Map<string, Record<string, string>>();
  private versionMappings = new Map<string, TransformationRule[]>();

  constructor() {
    this.initializeSystemMappings();
    this.initializeVersionMappings();
    this.initializeBuiltInPipelines();
  }

  /**
   * Transform data for export
   */
  async transform(
    entries: KBEntry[],
    options: TransformOptions = {}
  ): Promise<any[]> {
    try {
      const context: TransformContext = {
        targetSystem: options.targetSystem,
        targetVersion: options.version,
        metadata: {
          transformationType: 'export',
          timestamp: new Date().toISOString(),
          options
        }
      };

      let transformedData = entries.map(entry => ({ ...entry }));

      // Apply format-specific transformations
      if (options.format) {
        transformedData = await this.applyFormatTransformation(transformedData, options.format);
      }

      // Apply field mappings
      if (options.fieldMappings) {
        transformedData = this.applyFieldMappings(transformedData, options.fieldMappings);
      }

      // Apply system-specific transformations
      if (options.targetSystem) {
        transformedData = await this.applySystemTransformation(
          transformedData,
          options.targetSystem,
          context
        );
      }

      // Apply version-specific transformations
      if (options.version) {
        transformedData = await this.applyVersionTransformation(
          transformedData,
          options.version,
          context
        );
      }

      // Apply custom transformation
      if (options.customTransform) {
        transformedData = transformedData.map(options.customTransform);
      }

      // Filter data based on options
      transformedData = this.filterData(transformedData, options);

      // Add metadata if preserving original
      if (options.preserveOriginal) {
        transformedData = transformedData.map((item, index) => ({
          ...item,
          _original: entries[index],
          _transformMeta: {
            transformedAt: new Date().toISOString(),
            transformContext: context
          }
        }));
      }

      return transformedData;

    } catch (error) {
      throw new Error(`Data transformation failed: ${error.message}`);
    }
  }

  /**
   * Transform data for import
   */
  async transformForImport(
    data: any[],
    options: ImportTransformOptions = {}
  ): Promise<KBEntryInput[]> {
    try {
      const context: TransformContext = {
        sourceSystem: options.sourceSystem,
        sourceVersion: options.sourceVersion,
        metadata: {
          transformationType: 'import',
          timestamp: new Date().toISOString(),
          options
        }
      };

      let transformedData = data.map(item => ({ ...item }));

      // Apply legacy compatibility transformations
      if (options.legacyCompatibility) {
        transformedData = await this.applyLegacyCompatibility(transformedData, context);
      }

      // Apply system-specific import mappings
      if (options.sourceSystem) {
        transformedData = await this.applySystemImportMapping(
          transformedData,
          options.sourceSystem,
          context
        );
      }

      // Apply field mappings
      if (options.fieldMappings) {
        transformedData = this.applyFieldMappings(transformedData, options.fieldMappings);
      }

      // Apply custom transformation
      if (options.customTransform) {
        transformedData = transformedData.map(options.customTransform);
      }

      // Normalize to KBEntryInput format
      const kbEntries = await this.normalizeToKBEntries(transformedData, options);

      // Apply default values
      if (options.defaultValues) {
        kbEntries.forEach(entry => {
          Object.entries(options.defaultValues!).forEach(([key, value]) => {
            if (entry[key] === undefined || entry[key] === null || entry[key] === '') {
              entry[key] = value;
            }
          });
        });
      }

      // Validate required fields
      if (options.requiredFields) {
        this.validateRequiredFields(kbEntries, options.requiredFields);
      }

      return kbEntries;

    } catch (error) {
      throw new Error(`Import transformation failed: ${error.message}`);
    }
  }

  /**
   * Transform data using pipeline
   */
  async transformWithPipeline(
    data: any[],
    pipelineId: string,
    context: TransformContext = {}
  ): Promise<any[]> {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) {
      throw new Error(`Pipeline not found: ${pipelineId}`);
    }

    let transformedData = [...data];

    try {
      // Pre-processors
      for (const processor of pipeline.preProcessors) {
        transformedData = processor(transformedData, context);
      }

      // Apply transformation rules
      transformedData = await this.applyTransformationRules(
        transformedData,
        pipeline.rules,
        context
      );

      // Post-processors
      for (const processor of pipeline.postProcessors) {
        transformedData = processor(transformedData, context);
      }

      // Validate results
      const validationIssues: ValidationIssue[] = [];
      for (const validator of pipeline.validations) {
        validationIssues.push(...validator(transformedData, context));
      }

      if (validationIssues.some(issue => issue.level === 'error')) {
        throw new Error(
          `Pipeline validation failed: ${validationIssues
            .filter(i => i.level === 'error')
            .map(i => i.message)
            .join(', ')}`
        );
      }

      return transformedData;

    } catch (error) {
      throw new Error(`Pipeline transformation failed: ${error.message}`);
    }
  }

  /**
   * Transform batch for streaming operations
   */
  async transformBatch(
    batch: any[],
    options: TransformOptions | ImportTransformOptions,
    batchIndex = 0
  ): Promise<any[]> {
    try {
      // Determine transformation type
      const isImportTransform = 'sourceSystem' in options;
      
      if (isImportTransform) {
        return await this.transformForImport(batch, options as ImportTransformOptions);
      } else {
        return await this.transform(batch as KBEntry[], options as TransformOptions);
      }

    } catch (error) {
      throw new Error(`Batch transformation failed at batch ${batchIndex}: ${error.message}`);
    }
  }

  /**
   * Create custom transformation pipeline
   */
  createPipeline(pipeline: Omit<TransformationPipeline, 'id'>): string {
    const pipelineWithId: TransformationPipeline = {
      ...pipeline,
      id: uuidv4()
    };
    
    this.pipelines.set(pipelineWithId.id, pipelineWithId);
    return pipelineWithId.id;
  }

  /**
   * Get available pipelines
   */
  getAvailablePipelines(): Array<{
    id: string;
    name: string;
    description: string;
  }> {
    return Array.from(this.pipelines.values()).map(pipeline => ({
      id: pipeline.id,
      name: pipeline.name,
      description: pipeline.description
    }));
  }

  /**
   * Validate transformation compatibility
   */
  validateTransformation(
    sampleData: any[],
    options: TransformOptions | ImportTransformOptions
  ): {
    compatible: boolean;
    issues: ValidationIssue[];
    suggestions: string[];
  } {
    const issues: ValidationIssue[] = [];
    const suggestions: string[] = [];

    try {
      // Sample transformation test
      const sample = sampleData.slice(0, Math.min(5, sampleData.length));
      
      if ('sourceSystem' in options) {
        this.transformForImport(sample, options as ImportTransformOptions);
      } else {
        this.transform(sample as KBEntry[], options as TransformOptions);
      }

      // Check for potential data loss
      if (options.fieldMappings) {
        const sourceFields = new Set(Object.keys(sampleData[0] || {}));
        const mappedFields = new Set(Object.keys(options.fieldMappings));
        
        const unmappedFields = Array.from(sourceFields).filter(
          field => !mappedFields.has(field)
        );
        
        if (unmappedFields.length > 0) {
          issues.push({
            level: 'warning',
            field: 'field_mapping',
            message: `Unmapped fields will be lost: ${unmappedFields.join(', ')}`,
            suggestion: 'Consider adding mappings for these fields'
          });
        }
      }

      return {
        compatible: issues.filter(i => i.level === 'error').length === 0,
        issues,
        suggestions
      };

    } catch (error) {
      issues.push({
        level: 'error',
        field: 'compatibility',
        message: `Transformation compatibility check failed: ${error.message}`
      });

      return {
        compatible: false,
        issues,
        suggestions: ['Review transformation options and sample data format']
      };
    }
  }

  // =========================
  // Private Methods
  // =========================

  private async applyFormatTransformation(data: any[], format: string): Promise<any[]> {
    switch (format) {
      case 'minimal':
        return data.map(entry => ({
          id: entry.id,
          title: entry.title,
          problem: entry.problem,
          solution: entry.solution,
          category: entry.category,
          tags: entry.tags
        }));

      case 'compact':
        return data.map(entry => ({
          ...entry,
          problem: this.truncateText(entry.problem, 200),
          solution: this.truncateText(entry.solution, 300)
        }));

      case 'full':
      default:
        return data;
    }
  }

  private applyFieldMappings(data: any[], mappings: Record<string, string>): any[] {
    return data.map(item => {
      const transformed: any = {};
      
      // Apply direct mappings
      Object.entries(mappings).forEach(([sourceField, targetField]) => {
        if (item.hasOwnProperty(sourceField)) {
          transformed[targetField] = item[sourceField];
        }
      });

      // Include unmapped fields
      Object.entries(item).forEach(([key, value]) => {
        if (!mappings.hasOwnProperty(key) && !transformed.hasOwnProperty(key)) {
          transformed[key] = value;
        }
      });

      return transformed;
    });
  }

  private async applySystemTransformation(
    data: any[],
    targetSystem: string,
    context: TransformContext
  ): Promise<any[]> {
    const systemMapping = this.systemMappings.get(targetSystem);
    if (!systemMapping) {
      return data;
    }

    return data.map(item => {
      const transformed: any = {};

      // Apply system-specific mappings
      Object.entries(systemMapping).forEach(([sourceField, targetField]) => {
        if (item.hasOwnProperty(sourceField)) {
          transformed[targetField] = this.transformValue(
            item[sourceField],
            sourceField,
            targetField,
            targetSystem
          );
        }
      });

      // Include unmapped fields
      Object.entries(item).forEach(([key, value]) => {
        if (!systemMapping.hasOwnProperty(key) && !transformed.hasOwnProperty(key)) {
          transformed[key] = value;
        }
      });

      return transformed;
    });
  }

  private async applyVersionTransformation(
    data: any[],
    targetVersion: string,
    context: TransformContext
  ): Promise<any[]> {
    const versionRules = this.versionMappings.get(targetVersion);
    if (!versionRules) {
      return data;
    }

    return this.applyTransformationRules(data, versionRules, context);
  }

  private async applyTransformationRules(
    data: any[],
    rules: TransformationRule[],
    context: TransformContext
  ): Promise<any[]> {
    return data.map(item => {
      const transformed = { ...item };

      rules.forEach(rule => {
        // Check condition if present
        if (rule.condition && !rule.condition(item, context)) {
          return;
        }

        const sourceValue = item[rule.sourceField];

        switch (rule.transformType) {
          case 'direct':
            if (sourceValue !== undefined) {
              transformed[rule.targetField] = sourceValue;
            } else if (rule.defaultValue !== undefined) {
              transformed[rule.targetField] = rule.defaultValue;
            }
            break;

          case 'computed':
            if (rule.transformFunction) {
              transformed[rule.targetField] = rule.transformFunction(sourceValue, item, context);
            }
            break;

          case 'conditional':
            if (rule.condition && rule.condition(item, context)) {
              transformed[rule.targetField] = rule.transformFunction
                ? rule.transformFunction(sourceValue, item, context)
                : sourceValue;
            } else if (rule.defaultValue !== undefined) {
              transformed[rule.targetField] = rule.defaultValue;
            }
            break;

          case 'custom':
            if (rule.transformFunction) {
              transformed[rule.targetField] = rule.transformFunction(sourceValue, item, context);
            }
            break;
        }

        // Validate transformed value
        if (rule.validation && transformed[rule.targetField] !== undefined) {
          if (!rule.validation(transformed[rule.targetField])) {
            if (rule.required) {
              throw new Error(`Validation failed for required field: ${rule.targetField}`);
            } else {
              transformed[rule.targetField] = rule.defaultValue;
            }
          }
        }
      });

      return transformed;
    });
  }

  private async applyLegacyCompatibility(
    data: any[],
    context: TransformContext
  ): Promise<any[]> {
    return data.map(item => {
      const transformed = { ...item };

      // Convert legacy field names
      const legacyMappings = {
        'desc': 'description',
        'prob': 'problem',
        'sol': 'solution',
        'cat': 'category',
        'created': 'created_at',
        'modified': 'updated_at'
      };

      Object.entries(legacyMappings).forEach(([legacy, modern]) => {
        if (item.hasOwnProperty(legacy) && !item.hasOwnProperty(modern)) {
          transformed[modern] = item[legacy];
          delete transformed[legacy];
        }
      });

      // Convert legacy date formats
      ['created_at', 'updated_at'].forEach(field => {
        if (transformed[field] && typeof transformed[field] === 'string') {
          const date = new Date(transformed[field]);
          if (!isNaN(date.getTime())) {
            transformed[field] = date;
          }
        }
      });

      return transformed;
    });
  }

  private async applySystemImportMapping(
    data: any[],
    sourceSystem: string,
    context: TransformContext
  ): Promise<any[]> {
    const systemConfig = this.getSystemImportConfig(sourceSystem);
    
    return data.map(item => {
      const transformed: any = {};

      // Apply reverse system mappings (for import)
      Object.entries(systemConfig.fieldMappings).forEach(([sourceField, targetField]) => {
        if (item.hasOwnProperty(sourceField)) {
          transformed[targetField] = item[sourceField];
        }
      });

      // Apply system-specific transformations
      if (systemConfig.transformations) {
        systemConfig.transformations.forEach(transform => {
          if (item.hasOwnProperty(transform.field)) {
            transformed[transform.field] = transform.transform(item[transform.field]);
          }
        });
      }

      // Include unmapped fields
      Object.entries(item).forEach(([key, value]) => {
        if (!systemConfig.fieldMappings.hasOwnProperty(key) && !transformed.hasOwnProperty(key)) {
          transformed[key] = value;
        }
      });

      return transformed;
    });
  }

  private async normalizeToKBEntries(
    data: any[],
    options: ImportTransformOptions
  ): Promise<KBEntryInput[]> {
    return data.map(item => {
      const kbEntry: KBEntryInput = {
        title: this.ensureString(item.title || item.summary || item.name || 'Untitled'),
        problem: this.ensureString(item.problem || item.description || item.issue || ''),
        solution: this.ensureString(item.solution || item.resolution || item.fix || ''),
        category: this.normalizeCategory(item.category || item.type || 'Other'),
        tags: this.normalizeTags(item.tags || item.keywords || []),
        created_by: this.ensureString(item.created_by || item.author || 'imported')
      };

      return kbEntry;
    });
  }

  private validateRequiredFields(entries: KBEntryInput[], requiredFields: string[]): void {
    entries.forEach((entry, index) => {
      requiredFields.forEach(field => {
        if (!entry[field] || (typeof entry[field] === 'string' && entry[field].trim() === '')) {
          throw new Error(`Required field '${field}' is missing or empty in record ${index + 1}`);
        }
      });
    });
  }

  private filterData(data: any[], options: TransformOptions): any[] {
    let filtered = [...data];

    // Remove metrics if not requested
    if (!options.includeMetrics) {
      filtered = filtered.map(item => {
        const { usage_count, success_count, failure_count, version, ...rest } = item;
        return rest;
      });
    }

    // Remove history if not requested
    if (!options.includeHistory) {
      filtered = filtered.map(item => {
        const { history, audit_log, change_log, ...rest } = item;
        return rest;
      });
    }

    return filtered;
  }

  private transformValue(
    value: any,
    sourceField: string,
    targetField: string,
    targetSystem: string
  ): any {
    // Apply system-specific value transformations
    switch (targetSystem) {
      case 'servicenow':
        if (targetField === 'category' && typeof value === 'string') {
          // Map categories to ServiceNow values
          const categoryMap = {
            'JCL': 'software',
            'VSAM': 'database',
            'DB2': 'database',
            'Batch': 'software',
            'Functional': 'business'
          };
          return categoryMap[value] || 'software';
        }
        break;

      case 'jira':
        if (targetField === 'issuetype' && typeof value === 'string') {
          return value.toLowerCase();
        }
        break;
    }

    return value;
  }

  private ensureString(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }
    return String(value);
  }

  private normalizeCategory(category: any): string {
    const categoryMap = {
      'jcl': 'JCL',
      'vsam': 'VSAM', 
      'db2': 'DB2',
      'batch': 'Batch',
      'functional': 'Functional'
    };

    const normalized = String(category).toLowerCase();
    return categoryMap[normalized] || 'Other';
  }

  private normalizeTags(tags: any): string[] {
    if (Array.isArray(tags)) {
      return tags.map(tag => String(tag).trim()).filter(Boolean);
    }
    
    if (typeof tags === 'string') {
      return tags.split(/[,;|]/).map(tag => tag.trim()).filter(Boolean);
    }

    return [];
  }

  private truncateText(text: string, maxLength: number): string {
    if (!text || text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength - 3) + '...';
  }

  private getSystemImportConfig(system: string): any {
    const configs = {
      servicenow: {
        fieldMappings: {
          'short_description': 'title',
          'description': 'problem',
          'resolution_notes': 'solution',
          'category': 'category'
        },
        transformations: []
      },
      jira: {
        fieldMappings: {
          'summary': 'title',
          'description': 'problem',
          'resolution': 'solution',
          'issuetype': 'category'
        },
        transformations: []
      }
    };

    return configs[system] || { fieldMappings: {}, transformations: [] };
  }

  private initializeSystemMappings(): void {
    // ServiceNow mappings
    this.systemMappings.set('servicenow', {
      'title': 'short_description',
      'problem': 'description',
      'solution': 'resolution_notes',
      'category': 'category',
      'created_at': 'sys_created_on',
      'updated_at': 'sys_updated_on'
    });

    // Jira mappings
    this.systemMappings.set('jira', {
      'title': 'summary',
      'problem': 'description',
      'solution': 'resolution',
      'category': 'issuetype',
      'created_at': 'created',
      'updated_at': 'updated'
    });
  }

  private initializeVersionMappings(): void {
    // Version 1.0 compatibility rules
    this.versionMappings.set('1.0', [
      {
        id: 'v1-compat-1',
        name: 'Remove Enhanced Fields',
        description: 'Remove fields not supported in v1.0',
        sourceField: 'version',
        targetField: '',
        transformType: 'custom',
        transformFunction: () => undefined
      }
    ]);
  }

  private initializeBuiltInPipelines(): void {
    // Basic export pipeline
    this.createPipeline({
      name: 'Basic Export',
      description: 'Standard export transformation pipeline',
      rules: [],
      preProcessors: [
        (data, context) => {
          console.log(`Processing ${data.length} records for export`);
          return data;
        }
      ],
      postProcessors: [
        (data, context) => {
          console.log(`Export transformation completed for ${data.length} records`);
          return data;
        }
      ],
      validations: []
    });

    // Basic import pipeline
    this.createPipeline({
      name: 'Basic Import',
      description: 'Standard import transformation pipeline',
      rules: [],
      preProcessors: [
        (data, context) => {
          console.log(`Processing ${data.length} records for import`);
          return data;
        }
      ],
      postProcessors: [
        (data, context) => {
          console.log(`Import transformation completed for ${data.length} records`);
          return data;
        }
      ],
      validations: [
        (data, context) => {
          const issues: ValidationIssue[] = [];
          data.forEach((item, index) => {
            if (!item.title || !item.problem || !item.solution) {
              issues.push({
                level: 'error',
                field: 'required_fields',
                message: 'Missing required fields (title, problem, solution)',
                recordIndex: index
              });
            }
          });
          return issues;
        }
      ]
    });
  }
}

export default DataTransformer;