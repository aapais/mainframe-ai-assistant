"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataTransformer = void 0;
const uuid_1 = require("uuid");
class DataTransformer {
    pipelines = new Map();
    systemMappings = new Map();
    versionMappings = new Map();
    constructor() {
        this.initializeSystemMappings();
        this.initializeVersionMappings();
        this.initializeBuiltInPipelines();
    }
    async transform(entries, options = {}) {
        try {
            const context = {
                targetSystem: options.targetSystem,
                targetVersion: options.version,
                metadata: {
                    transformationType: 'export',
                    timestamp: new Date().toISOString(),
                    options
                }
            };
            let transformedData = entries.map(entry => ({ ...entry }));
            if (options.format) {
                transformedData = await this.applyFormatTransformation(transformedData, options.format);
            }
            if (options.fieldMappings) {
                transformedData = this.applyFieldMappings(transformedData, options.fieldMappings);
            }
            if (options.targetSystem) {
                transformedData = await this.applySystemTransformation(transformedData, options.targetSystem, context);
            }
            if (options.version) {
                transformedData = await this.applyVersionTransformation(transformedData, options.version, context);
            }
            if (options.customTransform) {
                transformedData = transformedData.map(options.customTransform);
            }
            transformedData = this.filterData(transformedData, options);
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
        }
        catch (error) {
            throw new Error(`Data transformation failed: ${error.message}`);
        }
    }
    async transformForImport(data, options = {}) {
        try {
            const context = {
                sourceSystem: options.sourceSystem,
                sourceVersion: options.sourceVersion,
                metadata: {
                    transformationType: 'import',
                    timestamp: new Date().toISOString(),
                    options
                }
            };
            let transformedData = data.map(item => ({ ...item }));
            if (options.legacyCompatibility) {
                transformedData = await this.applyLegacyCompatibility(transformedData, context);
            }
            if (options.sourceSystem) {
                transformedData = await this.applySystemImportMapping(transformedData, options.sourceSystem, context);
            }
            if (options.fieldMappings) {
                transformedData = this.applyFieldMappings(transformedData, options.fieldMappings);
            }
            if (options.customTransform) {
                transformedData = transformedData.map(options.customTransform);
            }
            const kbEntries = await this.normalizeToKBEntries(transformedData, options);
            if (options.defaultValues) {
                kbEntries.forEach(entry => {
                    Object.entries(options.defaultValues).forEach(([key, value]) => {
                        if (entry[key] === undefined || entry[key] === null || entry[key] === '') {
                            entry[key] = value;
                        }
                    });
                });
            }
            if (options.requiredFields) {
                this.validateRequiredFields(kbEntries, options.requiredFields);
            }
            return kbEntries;
        }
        catch (error) {
            throw new Error(`Import transformation failed: ${error.message}`);
        }
    }
    async transformWithPipeline(data, pipelineId, context = {}) {
        const pipeline = this.pipelines.get(pipelineId);
        if (!pipeline) {
            throw new Error(`Pipeline not found: ${pipelineId}`);
        }
        let transformedData = [...data];
        try {
            for (const processor of pipeline.preProcessors) {
                transformedData = processor(transformedData, context);
            }
            transformedData = await this.applyTransformationRules(transformedData, pipeline.rules, context);
            for (const processor of pipeline.postProcessors) {
                transformedData = processor(transformedData, context);
            }
            const validationIssues = [];
            for (const validator of pipeline.validations) {
                validationIssues.push(...validator(transformedData, context));
            }
            if (validationIssues.some(issue => issue.level === 'error')) {
                throw new Error(`Pipeline validation failed: ${validationIssues
                    .filter(i => i.level === 'error')
                    .map(i => i.message)
                    .join(', ')}`);
            }
            return transformedData;
        }
        catch (error) {
            throw new Error(`Pipeline transformation failed: ${error.message}`);
        }
    }
    async transformBatch(batch, options, batchIndex = 0) {
        try {
            const isImportTransform = 'sourceSystem' in options;
            if (isImportTransform) {
                return await this.transformForImport(batch, options);
            }
            else {
                return await this.transform(batch, options);
            }
        }
        catch (error) {
            throw new Error(`Batch transformation failed at batch ${batchIndex}: ${error.message}`);
        }
    }
    createPipeline(pipeline) {
        const pipelineWithId = {
            ...pipeline,
            id: (0, uuid_1.v4)()
        };
        this.pipelines.set(pipelineWithId.id, pipelineWithId);
        return pipelineWithId.id;
    }
    getAvailablePipelines() {
        return Array.from(this.pipelines.values()).map(pipeline => ({
            id: pipeline.id,
            name: pipeline.name,
            description: pipeline.description
        }));
    }
    validateTransformation(sampleData, options) {
        const issues = [];
        const suggestions = [];
        try {
            const sample = sampleData.slice(0, Math.min(5, sampleData.length));
            if ('sourceSystem' in options) {
                this.transformForImport(sample, options);
            }
            else {
                this.transform(sample, options);
            }
            if (options.fieldMappings) {
                const sourceFields = new Set(Object.keys(sampleData[0] || {}));
                const mappedFields = new Set(Object.keys(options.fieldMappings));
                const unmappedFields = Array.from(sourceFields).filter(field => !mappedFields.has(field));
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
        }
        catch (error) {
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
    async applyFormatTransformation(data, format) {
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
    applyFieldMappings(data, mappings) {
        return data.map(item => {
            const transformed = {};
            Object.entries(mappings).forEach(([sourceField, targetField]) => {
                if (item.hasOwnProperty(sourceField)) {
                    transformed[targetField] = item[sourceField];
                }
            });
            Object.entries(item).forEach(([key, value]) => {
                if (!mappings.hasOwnProperty(key) && !transformed.hasOwnProperty(key)) {
                    transformed[key] = value;
                }
            });
            return transformed;
        });
    }
    async applySystemTransformation(data, targetSystem, context) {
        const systemMapping = this.systemMappings.get(targetSystem);
        if (!systemMapping) {
            return data;
        }
        return data.map(item => {
            const transformed = {};
            Object.entries(systemMapping).forEach(([sourceField, targetField]) => {
                if (item.hasOwnProperty(sourceField)) {
                    transformed[targetField] = this.transformValue(item[sourceField], sourceField, targetField, targetSystem);
                }
            });
            Object.entries(item).forEach(([key, value]) => {
                if (!systemMapping.hasOwnProperty(key) && !transformed.hasOwnProperty(key)) {
                    transformed[key] = value;
                }
            });
            return transformed;
        });
    }
    async applyVersionTransformation(data, targetVersion, context) {
        const versionRules = this.versionMappings.get(targetVersion);
        if (!versionRules) {
            return data;
        }
        return this.applyTransformationRules(data, versionRules, context);
    }
    async applyTransformationRules(data, rules, context) {
        return data.map(item => {
            const transformed = { ...item };
            rules.forEach(rule => {
                if (rule.condition && !rule.condition(item, context)) {
                    return;
                }
                const sourceValue = item[rule.sourceField];
                switch (rule.transformType) {
                    case 'direct':
                        if (sourceValue !== undefined) {
                            transformed[rule.targetField] = sourceValue;
                        }
                        else if (rule.defaultValue !== undefined) {
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
                        }
                        else if (rule.defaultValue !== undefined) {
                            transformed[rule.targetField] = rule.defaultValue;
                        }
                        break;
                    case 'custom':
                        if (rule.transformFunction) {
                            transformed[rule.targetField] = rule.transformFunction(sourceValue, item, context);
                        }
                        break;
                }
                if (rule.validation && transformed[rule.targetField] !== undefined) {
                    if (!rule.validation(transformed[rule.targetField])) {
                        if (rule.required) {
                            throw new Error(`Validation failed for required field: ${rule.targetField}`);
                        }
                        else {
                            transformed[rule.targetField] = rule.defaultValue;
                        }
                    }
                }
            });
            return transformed;
        });
    }
    async applyLegacyCompatibility(data, context) {
        return data.map(item => {
            const transformed = { ...item };
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
    async applySystemImportMapping(data, sourceSystem, context) {
        const systemConfig = this.getSystemImportConfig(sourceSystem);
        return data.map(item => {
            const transformed = {};
            Object.entries(systemConfig.fieldMappings).forEach(([sourceField, targetField]) => {
                if (item.hasOwnProperty(sourceField)) {
                    transformed[targetField] = item[sourceField];
                }
            });
            if (systemConfig.transformations) {
                systemConfig.transformations.forEach(transform => {
                    if (item.hasOwnProperty(transform.field)) {
                        transformed[transform.field] = transform.transform(item[transform.field]);
                    }
                });
            }
            Object.entries(item).forEach(([key, value]) => {
                if (!systemConfig.fieldMappings.hasOwnProperty(key) && !transformed.hasOwnProperty(key)) {
                    transformed[key] = value;
                }
            });
            return transformed;
        });
    }
    async normalizeToKBEntries(data, options) {
        return data.map(item => {
            const kbEntry = {
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
    validateRequiredFields(entries, requiredFields) {
        entries.forEach((entry, index) => {
            requiredFields.forEach(field => {
                if (!entry[field] || (typeof entry[field] === 'string' && entry[field].trim() === '')) {
                    throw new Error(`Required field '${field}' is missing or empty in record ${index + 1}`);
                }
            });
        });
    }
    filterData(data, options) {
        let filtered = [...data];
        if (!options.includeMetrics) {
            filtered = filtered.map(item => {
                const { usage_count, success_count, failure_count, version, ...rest } = item;
                return rest;
            });
        }
        if (!options.includeHistory) {
            filtered = filtered.map(item => {
                const { history, audit_log, change_log, ...rest } = item;
                return rest;
            });
        }
        return filtered;
    }
    transformValue(value, sourceField, targetField, targetSystem) {
        switch (targetSystem) {
            case 'servicenow':
                if (targetField === 'category' && typeof value === 'string') {
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
    ensureString(value) {
        if (value === null || value === undefined) {
            return '';
        }
        return String(value);
    }
    normalizeCategory(category) {
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
    normalizeTags(tags) {
        if (Array.isArray(tags)) {
            return tags.map(tag => String(tag).trim()).filter(Boolean);
        }
        if (typeof tags === 'string') {
            return tags.split(/[,;|]/).map(tag => tag.trim()).filter(Boolean);
        }
        return [];
    }
    truncateText(text, maxLength) {
        if (!text || text.length <= maxLength) {
            return text;
        }
        return `${text.substring(0, maxLength - 3)  }...`;
    }
    getSystemImportConfig(system) {
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
    initializeSystemMappings() {
        this.systemMappings.set('servicenow', {
            'title': 'short_description',
            'problem': 'description',
            'solution': 'resolution_notes',
            'category': 'category',
            'created_at': 'sys_created_on',
            'updated_at': 'sys_updated_on'
        });
        this.systemMappings.set('jira', {
            'title': 'summary',
            'problem': 'description',
            'solution': 'resolution',
            'category': 'issuetype',
            'created_at': 'created',
            'updated_at': 'updated'
        });
    }
    initializeVersionMappings() {
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
    initializeBuiltInPipelines() {
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
                    const issues = [];
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
exports.DataTransformer = DataTransformer;
exports.default = DataTransformer;
//# sourceMappingURL=DataTransformer.js.map