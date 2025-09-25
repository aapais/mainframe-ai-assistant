import { EventEmitter } from 'events';
import { Logger } from '../logger/Logger';
import {
  ReportConfig,
  FilterConfig,
  AggregationConfig,
  VisualizationConfig,
  ScheduleConfig,
} from './ReportGenerator';

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  baseConfig: Partial<ReportConfig>;
  customFields: CustomFieldConfig[];
  validationRules: ValidationRule[];
  createdBy: string;
  createdAt: Date;
  isPublic: boolean;
  usageCount: number;
}

export interface CustomFieldConfig {
  name: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'array' | 'object';
  label: string;
  description?: string;
  required: boolean;
  defaultValue?: any;
  validation?: FieldValidation;
  options?: any[]; // For dropdown/select fields
}

export interface FieldValidation {
  pattern?: string; // Regex pattern
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  customValidator?: string; // Function name
}

export interface ValidationRule {
  field: string;
  rule: 'required' | 'format' | 'range' | 'dependency' | 'custom';
  parameters: Record<string, any>;
  message: string;
}

export interface ReportBuilder {
  reportId: string;
  name: string;
  description?: string;
  dataSource: string;
  fields: SelectedField[];
  filters: FilterConfig[];
  aggregations: AggregationConfig[];
  groupBy: string[];
  orderBy: OrderByConfig[];
  visualizations: VisualizationConfig[];
  schedule?: ScheduleConfig;
  format: 'pdf' | 'excel' | 'csv' | 'json';
  parameters: Record<string, any>;
}

export interface SelectedField {
  name: string;
  alias?: string;
  dataType: string;
  transformation?: FieldTransformation;
  formatting?: FieldFormatting;
}

export interface FieldTransformation {
  type: 'none' | 'calculate' | 'aggregate' | 'format' | 'conditional';
  expression?: string;
  conditions?: ConditionalTransformation[];
}

export interface ConditionalTransformation {
  condition: string;
  value: any;
  format?: FieldFormatting;
}

export interface FieldFormatting {
  type: 'currency' | 'percentage' | 'date' | 'number' | 'text';
  precision?: number;
  currencyCode?: string;
  dateFormat?: string;
  customFormat?: string;
}

export interface OrderByConfig {
  field: string;
  direction: 'ASC' | 'DESC';
  nullsLast?: boolean;
}

export interface BuilderValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

export class CustomReportBuilder extends EventEmitter {
  private readonly logger: Logger;
  private readonly templates: Map<string, ReportTemplate>;
  private readonly builders: Map<string, ReportBuilder>;
  private readonly dataSources: Map<string, DataSourceSchema>;

  constructor(logger: Logger) {
    super();
    this.logger = logger;
    this.templates = new Map();
    this.builders = new Map();
    this.dataSources = new Map();
  }

  // Template Management
  public createTemplate(
    template: Omit<ReportTemplate, 'id' | 'createdAt' | 'usageCount'>
  ): ReportTemplate {
    const newTemplate: ReportTemplate = {
      ...template,
      id: `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      usageCount: 0,
    };

    this.templates.set(newTemplate.id, newTemplate);
    this.logger.info(`Report template created: ${newTemplate.name}`);
    this.emit('templateCreated', newTemplate);

    return newTemplate;
  }

  public getTemplate(id: string): ReportTemplate | null {
    return this.templates.get(id) || null;
  }

  public listTemplates(category?: string, tags?: string[]): ReportTemplate[] {
    const allTemplates = Array.from(this.templates.values());

    return allTemplates.filter(template => {
      if (category && template.category !== category) {
        return false;
      }

      if (tags && tags.length > 0) {
        const hasMatchingTag = tags.some(tag => template.tags.includes(tag));
        if (!hasMatchingTag) {
          return false;
        }
      }

      return true;
    });
  }

  public updateTemplate(id: string, updates: Partial<ReportTemplate>): ReportTemplate | null {
    const template = this.templates.get(id);
    if (!template) {
      return null;
    }

    const updatedTemplate = { ...template, ...updates };
    this.templates.set(id, updatedTemplate);
    this.emit('templateUpdated', updatedTemplate);

    return updatedTemplate;
  }

  public deleteTemplate(id: string): boolean {
    const deleted = this.templates.delete(id);
    if (deleted) {
      this.logger.info(`Report template deleted: ${id}`);
      this.emit('templateDeleted', { id });
    }
    return deleted;
  }

  // Report Builder
  public createBuilder(name: string, dataSource: string, templateId?: string): ReportBuilder {
    const builderId = `builder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    let baseBuilder: Partial<ReportBuilder> = {};

    if (templateId) {
      const template = this.templates.get(templateId);
      if (template) {
        template.usageCount++;
        baseBuilder = this.templateToBuilder(template);
      }
    }

    const builder: ReportBuilder = {
      reportId: builderId,
      name,
      dataSource,
      fields: [],
      filters: [],
      aggregations: [],
      groupBy: [],
      orderBy: [],
      visualizations: [],
      format: 'json',
      parameters: {},
      ...baseBuilder,
    };

    this.builders.set(builderId, builder);
    this.logger.info(`Report builder created: ${name}`);
    this.emit('builderCreated', builder);

    return builder;
  }

  private templateToBuilder(template: ReportTemplate): Partial<ReportBuilder> {
    const baseConfig = template.baseConfig;

    return {
      description: template.description,
      filters: baseConfig.filters || [],
      aggregations: baseConfig.aggregations || [],
      visualizations: baseConfig.visualizations || [],
      schedule: baseConfig.schedule,
      format: baseConfig.format || 'json',
      parameters: baseConfig.parameters || {},
    };
  }

  public getBuilder(id: string): ReportBuilder | null {
    return this.builders.get(id) || null;
  }

  public updateBuilder(id: string, updates: Partial<ReportBuilder>): ReportBuilder | null {
    const builder = this.builders.get(id);
    if (!builder) {
      return null;
    }

    const updatedBuilder = { ...builder, ...updates };
    this.builders.set(id, updatedBuilder);
    this.emit('builderUpdated', updatedBuilder);

    return updatedBuilder;
  }

  public deleteBuilder(id: string): boolean {
    const deleted = this.builders.delete(id);
    if (deleted) {
      this.logger.info(`Report builder deleted: ${id}`);
      this.emit('builderDeleted', { id });
    }
    return deleted;
  }

  // Field Management
  public addField(builderId: string, field: SelectedField): boolean {
    const builder = this.builders.get(builderId);
    if (!builder) {
      return false;
    }

    // Check if field already exists
    const existingField = builder.fields.find(f => f.name === field.name);
    if (existingField) {
      // Update existing field
      Object.assign(existingField, field);
    } else {
      builder.fields.push(field);
    }

    this.emit('fieldAdded', { builderId, field });
    return true;
  }

  public removeField(builderId: string, fieldName: string): boolean {
    const builder = this.builders.get(builderId);
    if (!builder) {
      return false;
    }

    const initialLength = builder.fields.length;
    builder.fields = builder.fields.filter(f => f.name !== fieldName);

    const removed = builder.fields.length < initialLength;
    if (removed) {
      this.emit('fieldRemoved', { builderId, fieldName });
    }

    return removed;
  }

  public updateField(
    builderId: string,
    fieldName: string,
    updates: Partial<SelectedField>
  ): boolean {
    const builder = this.builders.get(builderId);
    if (!builder) {
      return false;
    }

    const field = builder.fields.find(f => f.name === fieldName);
    if (!field) {
      return false;
    }

    Object.assign(field, updates);
    this.emit('fieldUpdated', { builderId, fieldName, updates });
    return true;
  }

  // Filter Management
  public addFilter(builderId: string, filter: FilterConfig): boolean {
    const builder = this.builders.get(builderId);
    if (!builder) {
      return false;
    }

    builder.filters.push(filter);
    this.emit('filterAdded', { builderId, filter });
    return true;
  }

  public removeFilter(builderId: string, index: number): boolean {
    const builder = this.builders.get(builderId);
    if (!builder || index < 0 || index >= builder.filters.length) {
      return false;
    }

    const removedFilter = builder.filters.splice(index, 1)[0];
    this.emit('filterRemoved', { builderId, filter: removedFilter, index });
    return true;
  }

  public updateFilter(builderId: string, index: number, updates: Partial<FilterConfig>): boolean {
    const builder = this.builders.get(builderId);
    if (!builder || index < 0 || index >= builder.filters.length) {
      return false;
    }

    const filter = builder.filters[index];
    Object.assign(filter, updates);
    this.emit('filterUpdated', { builderId, index, filter });
    return true;
  }

  // Aggregation Management
  public addAggregation(builderId: string, aggregation: AggregationConfig): boolean {
    const builder = this.builders.get(builderId);
    if (!builder) {
      return false;
    }

    builder.aggregations.push(aggregation);
    this.emit('aggregationAdded', { builderId, aggregation });
    return true;
  }

  public removeAggregation(builderId: string, index: number): boolean {
    const builder = this.builders.get(builderId);
    if (!builder || index < 0 || index >= builder.aggregations.length) {
      return false;
    }

    const removedAggregation = builder.aggregations.splice(index, 1)[0];
    this.emit('aggregationRemoved', { builderId, aggregation: removedAggregation, index });
    return true;
  }

  // Visualization Management
  public addVisualization(builderId: string, visualization: VisualizationConfig): boolean {
    const builder = this.builders.get(builderId);
    if (!builder) {
      return false;
    }

    builder.visualizations.push(visualization);
    this.emit('visualizationAdded', { builderId, visualization });
    return true;
  }

  public removeVisualization(builderId: string, index: number): boolean {
    const builder = this.builders.get(builderId);
    if (!builder || index < 0 || index >= builder.visualizations.length) {
      return false;
    }

    const removedVisualization = builder.visualizations.splice(index, 1)[0];
    this.emit('visualizationRemoved', { builderId, visualization: removedVisualization, index });
    return true;
  }

  // Data Source Management
  public registerDataSource(name: string, schema: DataSourceSchema): void {
    this.dataSources.set(name, schema);
    this.logger.info(`Data source schema registered: ${name}`);
  }

  public getDataSourceSchema(name: string): DataSourceSchema | null {
    return this.dataSources.get(name) || null;
  }

  public getAvailableFields(dataSource: string): FieldInfo[] {
    const schema = this.dataSources.get(dataSource);
    return schema ? schema.fields : [];
  }

  // Validation
  public validateBuilder(builderId: string): BuilderValidationResult {
    const builder = this.builders.get(builderId);
    if (!builder) {
      return {
        isValid: false,
        errors: ['Builder not found'],
        warnings: [],
        suggestions: [],
      };
    }

    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Basic validation
    if (!builder.name.trim()) {
      errors.push('Report name is required');
    }

    if (!builder.dataSource) {
      errors.push('Data source is required');
    }

    if (builder.fields.length === 0) {
      errors.push('At least one field must be selected');
    }

    // Data source validation
    const schema = this.dataSources.get(builder.dataSource);
    if (schema) {
      // Validate field references
      for (const field of builder.fields) {
        const schemaField = schema.fields.find(f => f.name === field.name);
        if (!schemaField) {
          errors.push(`Field '${field.name}' does not exist in data source`);
        }
      }

      // Validate filter fields
      for (const filter of builder.filters) {
        const schemaField = schema.fields.find(f => f.name === filter.field);
        if (!schemaField) {
          errors.push(`Filter field '${filter.field}' does not exist in data source`);
        }
      }

      // Validate aggregation fields
      for (const agg of builder.aggregations) {
        const schemaField = schema.fields.find(f => f.name === agg.field);
        if (!schemaField) {
          errors.push(`Aggregation field '${agg.field}' does not exist in data source`);
        }
      }
    }

    // Performance warnings
    if (builder.fields.length > 50) {
      warnings.push('Large number of fields selected - may impact performance');
    }

    if (builder.filters.length === 0) {
      warnings.push('No filters applied - result set may be very large');
    }

    // Suggestions
    if (builder.aggregations.length > 0 && builder.groupBy.length === 0) {
      suggestions.push('Consider adding GROUP BY fields when using aggregations');
    }

    if (builder.orderBy.length === 0) {
      suggestions.push('Adding ORDER BY clause can improve result consistency');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
    };
  }

  // Build final report configuration
  public buildReportConfig(builderId: string): ReportConfig | null {
    const builder = this.builders.get(builderId);
    if (!builder) {
      return null;
    }

    const validation = this.validateBuilder(builderId);
    if (!validation.isValid) {
      throw new Error(`Builder validation failed: ${validation.errors.join(', ')}`);
    }

    const config: ReportConfig = {
      id: builder.reportId,
      name: builder.name,
      description: builder.description,
      type: 'custom',
      dataSource: builder.dataSource,
      format: builder.format,
      parameters: builder.parameters,
      filters: builder.filters,
      aggregations: builder.aggregations,
      visualizations: builder.visualizations,
      schedule: builder.schedule,
    };

    this.logger.info(`Report configuration built: ${builder.name}`);
    this.emit('configBuilt', { builderId, config });

    return config;
  }

  // Export/Import builders
  public exportBuilder(builderId: string): any {
    const builder = this.builders.get(builderId);
    if (!builder) {
      return null;
    }

    return {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      builder: builder,
    };
  }

  public importBuilder(data: any): ReportBuilder | null {
    try {
      if (!data.builder) {
        throw new Error('Invalid import data: missing builder');
      }

      const builder = data.builder as ReportBuilder;
      const newId = `builder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      builder.reportId = newId;
      this.builders.set(newId, builder);

      this.logger.info(`Report builder imported: ${builder.name}`);
      this.emit('builderImported', builder);

      return builder;
    } catch (error) {
      this.logger.error('Failed to import builder', error);
      return null;
    }
  }
}

export interface DataSourceSchema {
  name: string;
  version: string;
  description?: string;
  fields: FieldInfo[];
  relationships?: RelationshipInfo[];
  indexes?: IndexInfo[];
}

export interface FieldInfo {
  name: string;
  type: string;
  description?: string;
  nullable: boolean;
  primaryKey: boolean;
  foreignKey?: string;
  defaultValue?: any;
  constraints?: string[];
}

export interface RelationshipInfo {
  name: string;
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
  fromField: string;
  toTable: string;
  toField: string;
}

export interface IndexInfo {
  name: string;
  fields: string[];
  unique: boolean;
  type?: string;
}
