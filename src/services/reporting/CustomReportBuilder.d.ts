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
  options?: any[];
}
export interface FieldValidation {
  pattern?: string;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  customValidator?: string;
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
export declare class CustomReportBuilder extends EventEmitter {
  private readonly logger;
  private readonly templates;
  private readonly builders;
  private readonly dataSources;
  constructor(logger: Logger);
  createTemplate(template: Omit<ReportTemplate, 'id' | 'createdAt' | 'usageCount'>): ReportTemplate;
  getTemplate(id: string): ReportTemplate | null;
  listTemplates(category?: string, tags?: string[]): ReportTemplate[];
  updateTemplate(id: string, updates: Partial<ReportTemplate>): ReportTemplate | null;
  deleteTemplate(id: string): boolean;
  createBuilder(name: string, dataSource: string, templateId?: string): ReportBuilder;
  private templateToBuilder;
  getBuilder(id: string): ReportBuilder | null;
  updateBuilder(id: string, updates: Partial<ReportBuilder>): ReportBuilder | null;
  deleteBuilder(id: string): boolean;
  addField(builderId: string, field: SelectedField): boolean;
  removeField(builderId: string, fieldName: string): boolean;
  updateField(builderId: string, fieldName: string, updates: Partial<SelectedField>): boolean;
  addFilter(builderId: string, filter: FilterConfig): boolean;
  removeFilter(builderId: string, index: number): boolean;
  updateFilter(builderId: string, index: number, updates: Partial<FilterConfig>): boolean;
  addAggregation(builderId: string, aggregation: AggregationConfig): boolean;
  removeAggregation(builderId: string, index: number): boolean;
  addVisualization(builderId: string, visualization: VisualizationConfig): boolean;
  removeVisualization(builderId: string, index: number): boolean;
  registerDataSource(name: string, schema: DataSourceSchema): void;
  getDataSourceSchema(name: string): DataSourceSchema | null;
  getAvailableFields(dataSource: string): FieldInfo[];
  validateBuilder(builderId: string): BuilderValidationResult;
  buildReportConfig(builderId: string): ReportConfig | null;
  exportBuilder(builderId: string): any;
  importBuilder(data: any): ReportBuilder | null;
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
//# sourceMappingURL=CustomReportBuilder.d.ts.map
