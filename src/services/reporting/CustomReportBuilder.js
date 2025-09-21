"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomReportBuilder = void 0;
const events_1 = require("events");
class CustomReportBuilder extends events_1.EventEmitter {
    logger;
    templates;
    builders;
    dataSources;
    constructor(logger) {
        super();
        this.logger = logger;
        this.templates = new Map();
        this.builders = new Map();
        this.dataSources = new Map();
    }
    createTemplate(template) {
        const newTemplate = {
            ...template,
            id: `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            createdAt: new Date(),
            usageCount: 0
        };
        this.templates.set(newTemplate.id, newTemplate);
        this.logger.info(`Report template created: ${newTemplate.name}`);
        this.emit('templateCreated', newTemplate);
        return newTemplate;
    }
    getTemplate(id) {
        return this.templates.get(id) || null;
    }
    listTemplates(category, tags) {
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
    updateTemplate(id, updates) {
        const template = this.templates.get(id);
        if (!template) {
            return null;
        }
        const updatedTemplate = { ...template, ...updates };
        this.templates.set(id, updatedTemplate);
        this.emit('templateUpdated', updatedTemplate);
        return updatedTemplate;
    }
    deleteTemplate(id) {
        const deleted = this.templates.delete(id);
        if (deleted) {
            this.logger.info(`Report template deleted: ${id}`);
            this.emit('templateDeleted', { id });
        }
        return deleted;
    }
    createBuilder(name, dataSource, templateId) {
        const builderId = `builder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        let baseBuilder = {};
        if (templateId) {
            const template = this.templates.get(templateId);
            if (template) {
                template.usageCount++;
                baseBuilder = this.templateToBuilder(template);
            }
        }
        const builder = {
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
            ...baseBuilder
        };
        this.builders.set(builderId, builder);
        this.logger.info(`Report builder created: ${name}`);
        this.emit('builderCreated', builder);
        return builder;
    }
    templateToBuilder(template) {
        const baseConfig = template.baseConfig;
        return {
            description: template.description,
            filters: baseConfig.filters || [],
            aggregations: baseConfig.aggregations || [],
            visualizations: baseConfig.visualizations || [],
            schedule: baseConfig.schedule,
            format: baseConfig.format || 'json',
            parameters: baseConfig.parameters || {}
        };
    }
    getBuilder(id) {
        return this.builders.get(id) || null;
    }
    updateBuilder(id, updates) {
        const builder = this.builders.get(id);
        if (!builder) {
            return null;
        }
        const updatedBuilder = { ...builder, ...updates };
        this.builders.set(id, updatedBuilder);
        this.emit('builderUpdated', updatedBuilder);
        return updatedBuilder;
    }
    deleteBuilder(id) {
        const deleted = this.builders.delete(id);
        if (deleted) {
            this.logger.info(`Report builder deleted: ${id}`);
            this.emit('builderDeleted', { id });
        }
        return deleted;
    }
    addField(builderId, field) {
        const builder = this.builders.get(builderId);
        if (!builder) {
            return false;
        }
        const existingField = builder.fields.find(f => f.name === field.name);
        if (existingField) {
            Object.assign(existingField, field);
        }
        else {
            builder.fields.push(field);
        }
        this.emit('fieldAdded', { builderId, field });
        return true;
    }
    removeField(builderId, fieldName) {
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
    updateField(builderId, fieldName, updates) {
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
    addFilter(builderId, filter) {
        const builder = this.builders.get(builderId);
        if (!builder) {
            return false;
        }
        builder.filters.push(filter);
        this.emit('filterAdded', { builderId, filter });
        return true;
    }
    removeFilter(builderId, index) {
        const builder = this.builders.get(builderId);
        if (!builder || index < 0 || index >= builder.filters.length) {
            return false;
        }
        const removedFilter = builder.filters.splice(index, 1)[0];
        this.emit('filterRemoved', { builderId, filter: removedFilter, index });
        return true;
    }
    updateFilter(builderId, index, updates) {
        const builder = this.builders.get(builderId);
        if (!builder || index < 0 || index >= builder.filters.length) {
            return false;
        }
        const filter = builder.filters[index];
        Object.assign(filter, updates);
        this.emit('filterUpdated', { builderId, index, filter });
        return true;
    }
    addAggregation(builderId, aggregation) {
        const builder = this.builders.get(builderId);
        if (!builder) {
            return false;
        }
        builder.aggregations.push(aggregation);
        this.emit('aggregationAdded', { builderId, aggregation });
        return true;
    }
    removeAggregation(builderId, index) {
        const builder = this.builders.get(builderId);
        if (!builder || index < 0 || index >= builder.aggregations.length) {
            return false;
        }
        const removedAggregation = builder.aggregations.splice(index, 1)[0];
        this.emit('aggregationRemoved', { builderId, aggregation: removedAggregation, index });
        return true;
    }
    addVisualization(builderId, visualization) {
        const builder = this.builders.get(builderId);
        if (!builder) {
            return false;
        }
        builder.visualizations.push(visualization);
        this.emit('visualizationAdded', { builderId, visualization });
        return true;
    }
    removeVisualization(builderId, index) {
        const builder = this.builders.get(builderId);
        if (!builder || index < 0 || index >= builder.visualizations.length) {
            return false;
        }
        const removedVisualization = builder.visualizations.splice(index, 1)[0];
        this.emit('visualizationRemoved', { builderId, visualization: removedVisualization, index });
        return true;
    }
    registerDataSource(name, schema) {
        this.dataSources.set(name, schema);
        this.logger.info(`Data source schema registered: ${name}`);
    }
    getDataSourceSchema(name) {
        return this.dataSources.get(name) || null;
    }
    getAvailableFields(dataSource) {
        const schema = this.dataSources.get(dataSource);
        return schema ? schema.fields : [];
    }
    validateBuilder(builderId) {
        const builder = this.builders.get(builderId);
        if (!builder) {
            return {
                isValid: false,
                errors: ['Builder not found'],
                warnings: [],
                suggestions: []
            };
        }
        const errors = [];
        const warnings = [];
        const suggestions = [];
        if (!builder.name.trim()) {
            errors.push('Report name is required');
        }
        if (!builder.dataSource) {
            errors.push('Data source is required');
        }
        if (builder.fields.length === 0) {
            errors.push('At least one field must be selected');
        }
        const schema = this.dataSources.get(builder.dataSource);
        if (schema) {
            for (const field of builder.fields) {
                const schemaField = schema.fields.find(f => f.name === field.name);
                if (!schemaField) {
                    errors.push(`Field '${field.name}' does not exist in data source`);
                }
            }
            for (const filter of builder.filters) {
                const schemaField = schema.fields.find(f => f.name === filter.field);
                if (!schemaField) {
                    errors.push(`Filter field '${filter.field}' does not exist in data source`);
                }
            }
            for (const agg of builder.aggregations) {
                const schemaField = schema.fields.find(f => f.name === agg.field);
                if (!schemaField) {
                    errors.push(`Aggregation field '${agg.field}' does not exist in data source`);
                }
            }
        }
        if (builder.fields.length > 50) {
            warnings.push('Large number of fields selected - may impact performance');
        }
        if (builder.filters.length === 0) {
            warnings.push('No filters applied - result set may be very large');
        }
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
            suggestions
        };
    }
    buildReportConfig(builderId) {
        const builder = this.builders.get(builderId);
        if (!builder) {
            return null;
        }
        const validation = this.validateBuilder(builderId);
        if (!validation.isValid) {
            throw new Error(`Builder validation failed: ${validation.errors.join(', ')}`);
        }
        const config = {
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
            schedule: builder.schedule
        };
        this.logger.info(`Report configuration built: ${builder.name}`);
        this.emit('configBuilt', { builderId, config });
        return config;
    }
    exportBuilder(builderId) {
        const builder = this.builders.get(builderId);
        if (!builder) {
            return null;
        }
        return {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            builder
        };
    }
    importBuilder(data) {
        try {
            if (!data.builder) {
                throw new Error('Invalid import data: missing builder');
            }
            const builder = data.builder;
            const newId = `builder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            builder.reportId = newId;
            this.builders.set(newId, builder);
            this.logger.info(`Report builder imported: ${builder.name}`);
            this.emit('builderImported', builder);
            return builder;
        }
        catch (error) {
            this.logger.error('Failed to import builder', error);
            return null;
        }
    }
}
exports.CustomReportBuilder = CustomReportBuilder;
//# sourceMappingURL=CustomReportBuilder.js.map