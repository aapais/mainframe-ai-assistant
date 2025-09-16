import {
  CustomReportBuilder,
  ReportTemplate,
  ReportBuilder,
  SelectedField,
  FilterConfig,
  AggregationConfig,
  VisualizationConfig,
  DataSourceSchema,
  FieldInfo,
  CustomFieldConfig,
  ValidationRule,
  BuilderValidationResult
} from '../../../src/services/reporting/CustomReportBuilder';
import { Logger } from '../../../src/services/logger/Logger';

// Mock logger
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
} as unknown as Logger;

describe('CustomReportBuilder', () => {
  let builder: CustomReportBuilder;
  let mockSchema: DataSourceSchema;

  beforeEach(() => {
    builder = new CustomReportBuilder(mockLogger);

    mockSchema = {
      name: 'test_db',
      version: '1.0',
      description: 'Test database schema',
      fields: [
        { name: 'id', type: 'integer', nullable: false, primaryKey: true, constraints: [] },
        { name: 'name', type: 'varchar', nullable: false, primaryKey: false, constraints: [] },
        { name: 'email', type: 'varchar', nullable: true, primaryKey: false, constraints: [] },
        { name: 'created_at', type: 'timestamp', nullable: false, primaryKey: false, constraints: [] },
        { name: 'score', type: 'decimal', nullable: true, primaryKey: false, constraints: [] }
      ]
    };

    builder.registerDataSource('test_db', mockSchema);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Template Management', () => {
    describe('createTemplate', () => {
      it('should create a new report template', () => {
        const templateData = {
          name: 'User Analytics Template',
          description: 'Template for user analytics reports',
          category: 'analytics',
          tags: ['users', 'analytics'],
          baseConfig: {
            type: 'analytics' as const,
            format: 'json' as const,
            parameters: { includeInactive: false }
          },
          customFields: [
            {
              name: 'dateRange',
              type: 'object' as const,
              label: 'Date Range',
              required: true,
              defaultValue: { start: '2024-01-01', end: '2024-12-31' }
            }
          ] as CustomFieldConfig[],
          validationRules: [] as ValidationRule[],
          createdBy: 'test-user',
          isPublic: true
        };

        const template = builder.createTemplate(templateData);

        expect(template.id).toBeDefined();
        expect(template.name).toBe('User Analytics Template');
        expect(template.createdAt).toBeInstanceOf(Date);
        expect(template.usageCount).toBe(0);
        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.stringContaining('Report template created: User Analytics Template')
        );
      });

      it('should emit templateCreated event', () => {
        const eventListener = jest.fn();
        builder.on('templateCreated', eventListener);

        const templateData = {
          name: 'Test Template',
          description: 'Test description',
          category: 'test',
          tags: [],
          baseConfig: {},
          customFields: [],
          validationRules: [],
          createdBy: 'test-user',
          isPublic: false
        };

        const template = builder.createTemplate(templateData);

        expect(eventListener).toHaveBeenCalledWith(template);
      });
    });

    describe('getTemplate', () => {
      it('should retrieve an existing template', () => {
        const templateData = {
          name: 'Test Template',
          description: 'Test',
          category: 'test',
          tags: [],
          baseConfig: {},
          customFields: [],
          validationRules: [],
          createdBy: 'test-user',
          isPublic: false
        };

        const created = builder.createTemplate(templateData);
        const retrieved = builder.getTemplate(created.id);

        expect(retrieved).toBeTruthy();
        expect(retrieved?.id).toBe(created.id);
      });

      it('should return null for non-existent template', () => {
        const result = builder.getTemplate('non-existent-id');
        expect(result).toBeNull();
      });
    });

    describe('listTemplates', () => {
      beforeEach(() => {
        // Create test templates
        builder.createTemplate({
          name: 'Analytics Template',
          category: 'analytics',
          tags: ['users', 'revenue'],
          baseConfig: {},
          customFields: [],
          validationRules: [],
          createdBy: 'user1',
          isPublic: true
        });

        builder.createTemplate({
          name: 'Performance Template',
          category: 'performance',
          tags: ['metrics', 'kpis'],
          baseConfig: {},
          customFields: [],
          validationRules: [],
          createdBy: 'user2',
          isPublic: false
        });

        builder.createTemplate({
          name: 'Revenue Analytics',
          category: 'analytics',
          tags: ['revenue', 'sales'],
          baseConfig: {},
          customFields: [],
          validationRules: [],
          createdBy: 'user1',
          isPublic: true
        });
      });

      it('should list all templates', () => {
        const templates = builder.listTemplates();
        expect(templates).toHaveLength(3);
      });

      it('should filter templates by category', () => {
        const analyticsTemplates = builder.listTemplates('analytics');
        expect(analyticsTemplates).toHaveLength(2);
        expect(analyticsTemplates.every(t => t.category === 'analytics')).toBe(true);
      });

      it('should filter templates by tags', () => {
        const revenueTemplates = builder.listTemplates(undefined, ['revenue']);
        expect(revenueTemplates).toHaveLength(2);
        expect(revenueTemplates.every(t => t.tags.includes('revenue'))).toBe(true);
      });

      it('should filter by both category and tags', () => {
        const filtered = builder.listTemplates('analytics', ['users']);
        expect(filtered).toHaveLength(1);
        expect(filtered[0].name).toBe('Analytics Template');
      });
    });

    describe('updateTemplate', () => {
      it('should update an existing template', () => {
        const template = builder.createTemplate({
          name: 'Original Name',
          category: 'test',
          tags: [],
          baseConfig: {},
          customFields: [],
          validationRules: [],
          createdBy: 'user',
          isPublic: false
        });

        const updated = builder.updateTemplate(template.id, {
          name: 'Updated Name',
          description: 'New description'
        });

        expect(updated).toBeTruthy();
        expect(updated?.name).toBe('Updated Name');
        expect(updated?.description).toBe('New description');
      });

      it('should emit templateUpdated event', () => {
        const eventListener = jest.fn();
        builder.on('templateUpdated', eventListener);

        const template = builder.createTemplate({
          name: 'Test',
          category: 'test',
          tags: [],
          baseConfig: {},
          customFields: [],
          validationRules: [],
          createdBy: 'user',
          isPublic: false
        });

        builder.updateTemplate(template.id, { name: 'Updated' });

        expect(eventListener).toHaveBeenCalledWith(
          expect.objectContaining({ name: 'Updated' })
        );
      });
    });

    describe('deleteTemplate', () => {
      it('should delete an existing template', () => {
        const template = builder.createTemplate({
          name: 'To Delete',
          category: 'test',
          tags: [],
          baseConfig: {},
          customFields: [],
          validationRules: [],
          createdBy: 'user',
          isPublic: false
        });

        const deleted = builder.deleteTemplate(template.id);
        expect(deleted).toBe(true);

        const retrieved = builder.getTemplate(template.id);
        expect(retrieved).toBeNull();
      });

      it('should return false for non-existent template', () => {
        const deleted = builder.deleteTemplate('non-existent');
        expect(deleted).toBe(false);
      });
    });
  });

  describe('Report Builder Management', () => {
    describe('createBuilder', () => {
      it('should create a new report builder', () => {
        const reportBuilder = builder.createBuilder('Test Report', 'test_db');

        expect(reportBuilder.reportId).toBeDefined();
        expect(reportBuilder.name).toBe('Test Report');
        expect(reportBuilder.dataSource).toBe('test_db');
        expect(reportBuilder.fields).toEqual([]);
        expect(reportBuilder.filters).toEqual([]);
        expect(reportBuilder.format).toBe('json');
      });

      it('should create builder from template', () => {
        const template = builder.createTemplate({
          name: 'Test Template',
          category: 'test',
          tags: [],
          baseConfig: {
            description: 'Template description',
            format: 'csv',
            parameters: { test: true }
          },
          customFields: [],
          validationRules: [],
          createdBy: 'user',
          isPublic: false
        });

        const reportBuilder = builder.createBuilder('From Template', 'test_db', template.id);

        expect(reportBuilder.description).toBe('Template description');
        expect(reportBuilder.format).toBe('csv');
        expect(reportBuilder.parameters).toEqual({ test: true });
        expect(template.usageCount).toBe(1);
      });

      it('should emit builderCreated event', () => {
        const eventListener = jest.fn();
        builder.on('builderCreated', eventListener);

        const reportBuilder = builder.createBuilder('Test', 'test_db');

        expect(eventListener).toHaveBeenCalledWith(reportBuilder);
      });
    });

    describe('field management', () => {
      let reportBuilder: ReportBuilder;

      beforeEach(() => {
        reportBuilder = builder.createBuilder('Test Report', 'test_db');
      });

      it('should add field to builder', () => {
        const field: SelectedField = {
          name: 'name',
          alias: 'user_name',
          dataType: 'varchar',
          transformation: {
            type: 'format',
            expression: 'UPPER(name)'
          }
        };

        const added = builder.addField(reportBuilder.reportId, field);

        expect(added).toBe(true);
        expect(reportBuilder.fields).toHaveLength(1);
        expect(reportBuilder.fields[0]).toEqual(field);
      });

      it('should update existing field', () => {
        const field: SelectedField = {
          name: 'name',
          dataType: 'varchar'
        };

        builder.addField(reportBuilder.reportId, field);

        const updatedField: SelectedField = {
          name: 'name',
          alias: 'user_name',
          dataType: 'varchar'
        };

        builder.addField(reportBuilder.reportId, updatedField);

        expect(reportBuilder.fields).toHaveLength(1);
        expect(reportBuilder.fields[0].alias).toBe('user_name');
      });

      it('should remove field from builder', () => {
        const field: SelectedField = {
          name: 'name',
          dataType: 'varchar'
        };

        builder.addField(reportBuilder.reportId, field);
        const removed = builder.removeField(reportBuilder.reportId, 'name');

        expect(removed).toBe(true);
        expect(reportBuilder.fields).toHaveLength(0);
      });

      it('should update field properties', () => {
        const field: SelectedField = {
          name: 'name',
          dataType: 'varchar'
        };

        builder.addField(reportBuilder.reportId, field);
        const updated = builder.updateField(reportBuilder.reportId, 'name', {
          alias: 'full_name',
          formatting: { type: 'text', customFormat: 'uppercase' }
        });

        expect(updated).toBe(true);
        expect(reportBuilder.fields[0].alias).toBe('full_name');
        expect(reportBuilder.fields[0].formatting?.customFormat).toBe('uppercase');
      });
    });

    describe('filter management', () => {
      let reportBuilder: ReportBuilder;

      beforeEach(() => {
        reportBuilder = builder.createBuilder('Test Report', 'test_db');
      });

      it('should add filter to builder', () => {
        const filter: FilterConfig = {
          field: 'score',
          operator: 'gte',
          value: 80
        };

        const added = builder.addFilter(reportBuilder.reportId, filter);

        expect(added).toBe(true);
        expect(reportBuilder.filters).toHaveLength(1);
        expect(reportBuilder.filters[0]).toEqual(filter);
      });

      it('should remove filter from builder', () => {
        const filter: FilterConfig = {
          field: 'score',
          operator: 'gte',
          value: 80
        };

        builder.addFilter(reportBuilder.reportId, filter);
        const removed = builder.removeFilter(reportBuilder.reportId, 0);

        expect(removed).toBe(true);
        expect(reportBuilder.filters).toHaveLength(0);
      });

      it('should update filter', () => {
        const filter: FilterConfig = {
          field: 'score',
          operator: 'gte',
          value: 80
        };

        builder.addFilter(reportBuilder.reportId, filter);
        const updated = builder.updateFilter(reportBuilder.reportId, 0, {
          operator: 'gt',
          value: 90
        });

        expect(updated).toBe(true);
        expect(reportBuilder.filters[0].operator).toBe('gt');
        expect(reportBuilder.filters[0].value).toBe(90);
      });
    });

    describe('aggregation management', () => {
      let reportBuilder: ReportBuilder;

      beforeEach(() => {
        reportBuilder = builder.createBuilder('Test Report', 'test_db');
      });

      it('should add aggregation to builder', () => {
        const aggregation: AggregationConfig = {
          field: 'score',
          function: 'avg',
          groupBy: ['name']
        };

        const added = builder.addAggregation(reportBuilder.reportId, aggregation);

        expect(added).toBe(true);
        expect(reportBuilder.aggregations).toHaveLength(1);
        expect(reportBuilder.aggregations[0]).toEqual(aggregation);
      });

      it('should remove aggregation from builder', () => {
        const aggregation: AggregationConfig = {
          field: 'score',
          function: 'sum'
        };

        builder.addAggregation(reportBuilder.reportId, aggregation);
        const removed = builder.removeAggregation(reportBuilder.reportId, 0);

        expect(removed).toBe(true);
        expect(reportBuilder.aggregations).toHaveLength(0);
      });
    });

    describe('visualization management', () => {
      let reportBuilder: ReportBuilder;

      beforeEach(() => {
        reportBuilder = builder.createBuilder('Test Report', 'test_db');
      });

      it('should add visualization to builder', () => {
        const visualization: VisualizationConfig = {
          type: 'chart',
          chartType: 'bar',
          title: 'Score Distribution',
          dataMapping: {
            x: 'name',
            y: 'score'
          }
        };

        const added = builder.addVisualization(reportBuilder.reportId, visualization);

        expect(added).toBe(true);
        expect(reportBuilder.visualizations).toHaveLength(1);
        expect(reportBuilder.visualizations[0]).toEqual(visualization);
      });

      it('should remove visualization from builder', () => {
        const visualization: VisualizationConfig = {
          type: 'table',
          title: 'Data Table',
          dataMapping: {}
        };

        builder.addVisualization(reportBuilder.reportId, visualization);
        const removed = builder.removeVisualization(reportBuilder.reportId, 0);

        expect(removed).toBe(true);
        expect(reportBuilder.visualizations).toHaveLength(0);
      });
    });
  });

  describe('Data Source Management', () => {
    it('should register data source schema', () => {
      const newSchema: DataSourceSchema = {
        name: 'new_db',
        version: '2.0',
        fields: [
          { name: 'id', type: 'integer', nullable: false, primaryKey: true, constraints: [] }
        ]
      };

      builder.registerDataSource('new_db', newSchema);

      expect(mockLogger.info).toHaveBeenCalledWith('Data source schema registered: new_db');
    });

    it('should get data source schema', () => {
      const schema = builder.getDataSourceSchema('test_db');

      expect(schema).toBeTruthy();
      expect(schema?.name).toBe('test_db');
      expect(schema?.fields).toHaveLength(5);
    });

    it('should get available fields for data source', () => {
      const fields = builder.getAvailableFields('test_db');

      expect(fields).toHaveLength(5);
      expect(fields.map(f => f.name)).toContain('name');
      expect(fields.map(f => f.name)).toContain('email');
    });

    it('should return empty array for unknown data source', () => {
      const fields = builder.getAvailableFields('unknown_db');
      expect(fields).toEqual([]);
    });
  });

  describe('Validation', () => {
    let reportBuilder: ReportBuilder;

    beforeEach(() => {
      reportBuilder = builder.createBuilder('Test Report', 'test_db');
    });

    it('should validate basic builder requirements', () => {
      // Empty builder should fail validation
      const result = builder.validateBuilder(reportBuilder.reportId);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('At least one field must be selected');
    });

    it('should validate field references against schema', () => {
      // Add valid and invalid fields
      builder.addField(reportBuilder.reportId, {
        name: 'name', // Valid field
        dataType: 'varchar'
      });

      builder.addField(reportBuilder.reportId, {
        name: 'invalid_field', // Invalid field
        dataType: 'varchar'
      });

      const result = builder.validateBuilder(reportBuilder.reportId);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Field 'invalid_field' does not exist in data source");
    });

    it('should validate filter field references', () => {
      builder.addField(reportBuilder.reportId, {
        name: 'name',
        dataType: 'varchar'
      });

      builder.addFilter(reportBuilder.reportId, {
        field: 'invalid_filter_field',
        operator: 'eq',
        value: 'test'
      });

      const result = builder.validateBuilder(reportBuilder.reportId);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Filter field 'invalid_filter_field' does not exist in data source");
    });

    it('should provide performance warnings', () => {
      // Add many fields
      for (let i = 0; i < 60; i++) {
        builder.addField(reportBuilder.reportId, {
          name: 'name',
          alias: `field_${i}`,
          dataType: 'varchar'
        });
      }

      const result = builder.validateBuilder(reportBuilder.reportId);

      expect(result.warnings).toContain('Large number of fields selected - may impact performance');
    });

    it('should provide suggestions for improvement', () => {
      builder.addField(reportBuilder.reportId, {
        name: 'name',
        dataType: 'varchar'
      });

      builder.addAggregation(reportBuilder.reportId, {
        field: 'score',
        function: 'sum'
      });

      const result = builder.validateBuilder(reportBuilder.reportId);

      expect(result.suggestions).toContain('Consider adding GROUP BY fields when using aggregations');
      expect(result.suggestions).toContain('Adding ORDER BY clause can improve result consistency');
    });

    it('should pass validation for valid builder', () => {
      builder.addField(reportBuilder.reportId, {
        name: 'name',
        dataType: 'varchar'
      });

      builder.addField(reportBuilder.reportId, {
        name: 'score',
        dataType: 'decimal'
      });

      const result = builder.validateBuilder(reportBuilder.reportId);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Build Report Configuration', () => {
    let reportBuilder: ReportBuilder;

    beforeEach(() => {
      reportBuilder = builder.createBuilder('Test Report', 'test_db');
      builder.addField(reportBuilder.reportId, {
        name: 'name',
        dataType: 'varchar'
      });
    });

    it('should build valid report configuration', () => {
      const config = builder.buildReportConfig(reportBuilder.reportId);

      expect(config).toBeTruthy();
      expect(config?.id).toBe(reportBuilder.reportId);
      expect(config?.name).toBe('Test Report');
      expect(config?.type).toBe('custom');
      expect(config?.dataSource).toBe('test_db');
    });

    it('should throw error for invalid builder', () => {
      const invalidBuilder = builder.createBuilder('Invalid', 'test_db');
      // Don't add any fields - this makes it invalid

      expect(() => {
        builder.buildReportConfig(invalidBuilder.reportId);
      }).toThrow('Builder validation failed');
    });

    it('should emit configBuilt event', () => {
      const eventListener = jest.fn();
      builder.on('configBuilt', eventListener);

      const config = builder.buildReportConfig(reportBuilder.reportId);

      expect(eventListener).toHaveBeenCalledWith({
        builderId: reportBuilder.reportId,
        config
      });
    });
  });

  describe('Export/Import', () => {
    let reportBuilder: ReportBuilder;

    beforeEach(() => {
      reportBuilder = builder.createBuilder('Export Test', 'test_db');
      builder.addField(reportBuilder.reportId, {
        name: 'name',
        dataType: 'varchar'
      });
    });

    it('should export builder', () => {
      const exported = builder.exportBuilder(reportBuilder.reportId);

      expect(exported).toBeTruthy();
      expect(exported.version).toBe('1.0');
      expect(exported.exportedAt).toBeDefined();
      expect(exported.builder.name).toBe('Export Test');
    });

    it('should return null for non-existent builder', () => {
      const exported = builder.exportBuilder('non-existent');
      expect(exported).toBeNull();
    });

    it('should import builder', () => {
      const exported = builder.exportBuilder(reportBuilder.reportId);
      const imported = builder.importBuilder(exported);

      expect(imported).toBeTruthy();
      expect(imported?.name).toBe('Export Test');
      expect(imported?.reportId).not.toBe(reportBuilder.reportId); // Should have new ID
    });

    it('should handle invalid import data', () => {
      const imported = builder.importBuilder({ invalid: 'data' });
      expect(imported).toBeNull();
    });

    it('should emit builderImported event', () => {
      const eventListener = jest.fn();
      builder.on('builderImported', eventListener);

      const exported = builder.exportBuilder(reportBuilder.reportId);
      const imported = builder.importBuilder(exported);

      expect(eventListener).toHaveBeenCalledWith(imported);
    });
  });
});