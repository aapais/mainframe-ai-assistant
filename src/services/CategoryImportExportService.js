"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CategoryImportExportService = exports.CategoryTemplateSchema = exports.ImportResultSchema = exports.ExportOptionsSchema = exports.ImportOptionsSchema = void 0;
const zod_1 = require("zod");
exports.ImportOptionsSchema = zod_1.z.object({
    mergeStrategy: zod_1.z.enum(['replace', 'merge', 'skip', 'prompt']).default('merge'),
    validateStructure: zod_1.z.boolean().default(true),
    preserveIds: zod_1.z.boolean().default(false),
    createMissingParents: zod_1.z.boolean().default(true),
    maxDepth: zod_1.z.number().int().min(1).max(10).default(5),
    allowDuplicateNames: zod_1.z.boolean().default(false),
    backupExisting: zod_1.z.boolean().default(true),
    dryRun: zod_1.z.boolean().default(false),
});
exports.ExportOptionsSchema = zod_1.z.object({
    format: zod_1.z.enum(['json', 'csv', 'xml']).default('json'),
    includeMetadata: zod_1.z.boolean().default(true),
    includeStatistics: zod_1.z.boolean().default(true),
    flattenHierarchy: zod_1.z.boolean().default(false),
    rootCategoryId: zod_1.z.string().uuid().optional(),
    maxDepth: zod_1.z.number().int().min(0).optional(),
    excludeSystemCategories: zod_1.z.boolean().default(false),
    compressOutput: zod_1.z.boolean().default(false),
});
exports.ImportResultSchema = zod_1.z.object({
    success: zod_1.z.boolean(),
    summary: zod_1.z.object({
        totalProcessed: zod_1.z.number().int().min(0),
        imported: zod_1.z.number().int().min(0),
        updated: zod_1.z.number().int().min(0),
        skipped: zod_1.z.number().int().min(0),
        failed: zod_1.z.number().int().min(0),
    }),
    conflicts: zod_1.z.array(zod_1.z.object({
        type: zod_1.z.enum(['duplicate_name', 'invalid_parent', 'depth_exceeded', 'invalid_data']),
        category: zod_1.z.object({
            name: zod_1.z.string(),
            path: zod_1.z.array(zod_1.z.string()),
        }),
        existing: zod_1.z.object({
            id: zod_1.z.string(),
            name: zod_1.z.string(),
            path: zod_1.z.array(zod_1.z.string()),
        }).optional(),
        resolution: zod_1.z.enum(['merged', 'replaced', 'skipped', 'failed']),
        message: zod_1.z.string(),
    })),
    errors: zod_1.z.array(zod_1.z.object({
        category: zod_1.z.string().optional(),
        message: zod_1.z.string(),
        code: zod_1.z.string().optional(),
    })),
    backupPath: zod_1.z.string().optional(),
    rollbackAvailable: zod_1.z.boolean(),
});
exports.CategoryTemplateSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    name: zod_1.z.string().min(1).max(100),
    description: zod_1.z.string().max(500).optional(),
    version: zod_1.z.string().default('1.0'),
    author: zod_1.z.string().max(100).optional(),
    created_at: zod_1.z.date(),
    categories: zod_1.z.array(zod_1.z.object({
        name: zod_1.z.string(),
        description: zod_1.z.string().optional(),
        parent_path: zod_1.z.array(zod_1.z.string()).default([]),
        metadata: zod_1.z.record(zod_1.z.any()).optional(),
    })),
    metadata: zod_1.z.record(zod_1.z.any()).optional(),
});
class CategoryImportExportService {
    templates = new Map();
    backupHistory = [];
    constructor() {
        this.loadDefaultTemplates();
    }
    async exportCategories(categories, options = {}) {
        const opts = exports.ExportOptionsSchema.parse(options);
        const filteredCategories = this.filterCategoriesForExport(categories, opts);
        switch (opts.format) {
            case 'json':
                return this.exportAsJSON(filteredCategories, opts);
            case 'csv':
                return this.exportAsCSV(filteredCategories, opts);
            case 'xml':
                return this.exportAsXML(filteredCategories, opts);
            default:
                throw new Error(`Unsupported export format: ${opts.format}`);
        }
    }
    filterCategoriesForExport(categories, options) {
        let filtered = [...categories];
        if (options.rootCategoryId) {
            filtered = filtered.filter(cat => cat.node.id === options.rootCategoryId ||
                this.isDescendantOf(cat, options.rootCategoryId));
        }
        if (options.maxDepth !== undefined) {
            filtered = this.limitDepth(filtered, options.maxDepth);
        }
        if (options.excludeSystemCategories) {
            filtered = filtered.filter(cat => !cat.node.is_system);
        }
        return filtered;
    }
    exportAsJSON(categories, options) {
        const exportData = {
            version: '1.0',
            exported_at: new Date().toISOString(),
            format: 'hierarchical',
            options: {
                includeMetadata: options.includeMetadata,
                includeStatistics: options.includeStatistics,
            },
            categories: options.flattenHierarchy ?
                this.flattenCategories(categories) :
                this.serializeCategoryTree(categories, options),
            metadata: options.includeMetadata ? {
                total_categories: this.countTotalCategories(categories),
                max_depth: this.calculateMaxDepth(categories),
                export_timestamp: new Date().toISOString(),
            } : undefined,
        };
        const data = JSON.stringify(exportData, null, 2);
        const filename = `categories-export-${new Date().toISOString().slice(0, 10)}.json`;
        return {
            data: options.compressOutput ? this.compressJSON(data) : data,
            filename,
            contentType: 'application/json'
        };
    }
    exportAsCSV(categories, options) {
        const flatCategories = this.flattenCategories(categories);
        const headers = [
            'id',
            'name',
            'description',
            'parent_id',
            'parent_path',
            'level',
            'sort_order',
            'is_active',
            'is_system',
            'created_at',
            'updated_at'
        ];
        if (options.includeStatistics) {
            headers.push('entry_count', 'usage_count');
        }
        const rows = [
            headers.join(','),
            ...flatCategories.map(cat => this.categoryToCSVRow(cat, headers, options))
        ];
        const data = rows.join('\n');
        const filename = `categories-export-${new Date().toISOString().slice(0, 10)}.csv`;
        return {
            data,
            filename,
            contentType: 'text/csv'
        };
    }
    exportAsXML(categories, options) {
        const xmlHeader = '<?xml version="1.0" encoding="UTF-8"?>\n';
        const rootOpen = '<categories>\n';
        const rootClose = '</categories>';
        const metadata = options.includeMetadata ? `
  <metadata>
    <version>1.0</version>
    <exported_at>${new Date().toISOString()}</exported_at>
    <total_categories>${this.countTotalCategories(categories)}</total_categories>
    <max_depth>${this.calculateMaxDepth(categories)}</max_depth>
  </metadata>\n` : '';
        const categoriesXML = this.categoriesToXML(categories, options, 1);
        const data = xmlHeader + rootOpen + metadata + categoriesXML + rootClose;
        const filename = `categories-export-${new Date().toISOString().slice(0, 10)}.xml`;
        return {
            data,
            filename,
            contentType: 'application/xml'
        };
    }
    async importCategories(fileData, format, options = {}) {
        const opts = exports.ImportOptionsSchema.parse(options);
        let backupPath;
        if (opts.backupExisting) {
            backupPath = await this.createBackup();
        }
        const result = {
            success: false,
            summary: {
                totalProcessed: 0,
                imported: 0,
                updated: 0,
                skipped: 0,
                failed: 0,
            },
            conflicts: [],
            errors: [],
            backupPath,
            rollbackAvailable: !!backupPath,
        };
        try {
            const parsedCategories = await this.parseImportData(fileData, format);
            result.summary.totalProcessed = parsedCategories.length;
            if (opts.validateStructure) {
                const validationErrors = this.validateCategoryStructure(parsedCategories, opts);
                if (validationErrors.length > 0) {
                    result.errors.push(...validationErrors);
                    if (!opts.dryRun) {
                        return result;
                    }
                }
            }
            const processResult = await this.processCategoryImport(parsedCategories, opts);
            result.summary = processResult.summary;
            result.conflicts = processResult.conflicts;
            result.errors.push(...processResult.errors);
            result.success = result.summary.failed === 0;
        }
        catch (error) {
            result.errors.push({
                message: `Import failed: ${error.message}`,
                code: 'IMPORT_ERROR'
            });
        }
        return result;
    }
    async parseImportData(fileData, format) {
        switch (format) {
            case 'json':
                return this.parseJSONImport(fileData);
            case 'csv':
                return this.parseCSVImport(fileData);
            case 'xml':
                return this.parseXMLImport(fileData);
            default:
                throw new Error(`Unsupported import format: ${format}`);
        }
    }
    parseJSONImport(data) {
        try {
            const parsed = JSON.parse(data);
            if (parsed.categories && Array.isArray(parsed.categories)) {
                return parsed.categories;
            }
            else if (Array.isArray(parsed)) {
                return parsed;
            }
            else {
                throw new Error('Invalid JSON structure: expected categories array');
            }
        }
        catch (error) {
            throw new Error(`JSON parsing failed: ${error.message}`);
        }
    }
    parseCSVImport(data) {
        const lines = data.trim().split('\n');
        if (lines.length < 2) {
            throw new Error('CSV must have at least a header row and one data row');
        }
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        const categories = [];
        for (let i = 1; i < lines.length; i++) {
            const values = this.parseCSVLine(lines[i]);
            if (values.length !== headers.length) {
                throw new Error(`Row ${i + 1}: Column count mismatch`);
            }
            const category = {};
            headers.forEach((header, index) => {
                const value = values[index].trim().replace(/"/g, '');
                if (['level', 'sort_order', 'entry_count', 'usage_count'].includes(header)) {
                    category[header] = value ? parseInt(value, 10) : 0;
                }
                else if (['is_active', 'is_system'].includes(header)) {
                    category[header] = value.toLowerCase() === 'true';
                }
                else if (header === 'parent_path') {
                    category[header] = value ? value.split('/').filter(Boolean) : [];
                }
                else {
                    category[header] = value || undefined;
                }
            });
            categories.push(category);
        }
        return categories;
    }
    parseXMLImport(data) {
        const categories = [];
        const categoryMatches = data.match(/<category[^>]*>[\s\S]*?<\/category>/g);
        if (!categoryMatches) {
            throw new Error('No categories found in XML data');
        }
        categoryMatches.forEach(categoryXML => {
            const category = {};
            const nameMatch = categoryXML.match(/<name>(.*?)<\/name>/);
            const descMatch = categoryXML.match(/<description>(.*?)<\/description>/);
            const parentPathMatch = categoryXML.match(/<parent_path>(.*?)<\/parent_path>/);
            if (nameMatch)
                category.name = nameMatch[1];
            if (descMatch)
                category.description = descMatch[1];
            if (parentPathMatch) {
                category.parent_path = parentPathMatch[1].split('/').filter(Boolean);
            }
            categories.push(category);
        });
        return categories;
    }
    validateCategoryStructure(categories, options) {
        const errors = [];
        categories.forEach((category, index) => {
            if (!category.name || typeof category.name !== 'string') {
                errors.push({
                    message: `Row ${index + 1}: Category name is required and must be a string`,
                    code: 'INVALID_NAME'
                });
            }
            if (category.name && category.name.length > 100) {
                errors.push({
                    message: `Row ${index + 1}: Category name exceeds maximum length (100 characters)`,
                    code: 'NAME_TOO_LONG'
                });
            }
            if (category.description && category.description.length > 500) {
                errors.push({
                    message: `Row ${index + 1}: Description exceeds maximum length (500 characters)`,
                    code: 'DESCRIPTION_TOO_LONG'
                });
            }
            if (category.parent_path && category.parent_path.length >= options.maxDepth) {
                errors.push({
                    message: `Row ${index + 1}: Category depth exceeds maximum (${options.maxDepth})`,
                    code: 'DEPTH_EXCEEDED'
                });
            }
        });
        return errors;
    }
    async processCategoryImport(categories, options) {
        const summary = {
            totalProcessed: categories.length,
            imported: 0,
            updated: 0,
            skipped: 0,
            failed: 0,
        };
        const conflicts = [];
        const errors = [];
        const sortedCategories = categories.sort((a, b) => {
            const depthA = a.parent_path ? a.parent_path.length : 0;
            const depthB = b.parent_path ? b.parent_path.length : 0;
            return depthA - depthB;
        });
        for (const categoryData of sortedCategories) {
            try {
                const result = await this.processCategory(categoryData, options);
                summary[result.action]++;
                if (result.conflict) {
                    conflicts.push(result.conflict);
                }
            }
            catch (error) {
                summary.failed++;
                errors.push({
                    category: categoryData.name,
                    message: error.message,
                    code: 'PROCESSING_ERROR'
                });
            }
        }
        return { summary, conflicts, errors };
    }
    async processCategory(categoryData, options) {
        let parentId = null;
        if (categoryData.parent_path && categoryData.parent_path.length > 0) {
            parentId = await this.findCategoryByPath(categoryData.parent_path);
            if (!parentId && options.createMissingParents) {
                parentId = await this.createMissingParents(categoryData.parent_path, options);
            }
            if (!parentId) {
                throw new Error(`Parent category not found: ${categoryData.parent_path.join(' > ')}`);
            }
        }
        const existing = await this.findExistingCategory(categoryData.name, parentId);
        if (existing) {
            const conflict = {
                type: 'duplicate_name',
                category: {
                    name: categoryData.name,
                    path: categoryData.parent_path || [],
                },
                existing: {
                    id: existing.id,
                    name: existing.name,
                    path: await this.getCategoryPath(existing.id),
                },
                resolution: 'skipped',
                message: `Category "${categoryData.name}" already exists`,
            };
            switch (options.mergeStrategy) {
                case 'replace':
                    await this.updateCategory(existing.id, categoryData);
                    conflict.resolution = 'replaced';
                    return { action: 'updated', conflict };
                case 'merge':
                    const mergedData = this.mergeCategories(existing, categoryData);
                    await this.updateCategory(existing.id, mergedData);
                    conflict.resolution = 'merged';
                    return { action: 'updated', conflict };
                case 'skip':
                    return { action: 'skipped', conflict };
                case 'prompt':
                    return { action: 'skipped', conflict };
            }
        }
        const newCategory = {
            name: categoryData.name,
            slug: this.generateSlug(categoryData.name),
            description: categoryData.description,
            parent_id: parentId,
            level: parentId ? (await this.getCategoryLevel(parentId)) + 1 : 0,
            sort_order: categoryData.sort_order || 0,
            color: categoryData.color,
            icon: categoryData.icon,
            is_system: categoryData.is_system || false,
            is_active: categoryData.is_active !== false,
            entry_count: categoryData.entry_count || 0,
        };
        await this.createCategory(newCategory);
        return { action: 'imported' };
    }
    async createTemplate(name, description, categories, author) {
        const template = {
            id: this.generateId(),
            name,
            description,
            version: '1.0',
            author,
            created_at: new Date(),
            categories: this.flattenCategories(categories).map(cat => ({
                name: cat.name,
                description: cat.description,
                parent_path: this.getCategoryPathArray(cat),
                metadata: {
                    original_id: cat.id,
                    sort_order: cat.sort_order,
                    color: cat.color,
                    icon: cat.icon,
                }
            })),
            metadata: {
                total_categories: this.countTotalCategories(categories),
                max_depth: this.calculateMaxDepth(categories),
                created_timestamp: new Date().toISOString(),
            }
        };
        this.templates.set(template.id, template);
        await this.saveTemplate(template);
        return template;
    }
    async applyTemplate(templateId, options = {}) {
        const template = this.templates.get(templateId);
        if (!template) {
            throw new Error(`Template not found: ${templateId}`);
        }
        const importData = JSON.stringify({
            version: template.version,
            categories: template.categories
        });
        return this.importCategories(importData, 'json', options);
    }
    getTemplates() {
        return Array.from(this.templates.values());
    }
    async deleteTemplate(templateId) {
        if (!this.templates.has(templateId)) {
            throw new Error(`Template not found: ${templateId}`);
        }
        this.templates.delete(templateId);
        await this.removeTemplateFromStorage(templateId);
    }
    async createBackup() {
        const timestamp = new Date();
        const backupPath = `backup_${timestamp.toISOString().slice(0, 19).replace(/[:.]/g, '-')}.json`;
        const currentCategories = await this.getAllCategories();
        this.backupHistory.push({
            path: backupPath,
            timestamp,
            categories: currentCategories
        });
        if (this.backupHistory.length > 10) {
            this.backupHistory.shift();
        }
        return backupPath;
    }
    async rollback(backupPath) {
        const backup = this.backupHistory.find(b => b.path === backupPath);
        if (!backup) {
            throw new Error(`Backup not found: ${backupPath}`);
        }
        await this.restoreCategories(backup.categories);
    }
    getBackupHistory() {
        return this.backupHistory.map(backup => ({
            path: backup.path,
            timestamp: backup.timestamp,
            categoryCount: backup.categories.length
        }));
    }
    loadDefaultTemplates() {
        const mainframeTemplate = {
            id: 'mainframe-default',
            name: 'Mainframe Default Structure',
            description: 'Standard mainframe category hierarchy',
            version: '1.0',
            author: 'System',
            created_at: new Date(),
            categories: [
                { name: 'JCL', description: 'Job Control Language', parent_path: [] },
                { name: 'Syntax Errors', description: 'JCL syntax issues', parent_path: ['JCL'] },
                { name: 'Allocation Issues', description: 'Dataset allocation problems', parent_path: ['JCL'] },
                { name: 'VSAM', description: 'Virtual Storage Access Method', parent_path: [] },
                { name: 'Status Codes', description: 'VSAM status code errors', parent_path: ['VSAM'] },
                { name: 'File Operations', description: 'VSAM file operation issues', parent_path: ['VSAM'] },
                { name: 'DB2', description: 'Database management', parent_path: [] },
                { name: 'SQL Errors', description: 'SQL execution errors', parent_path: ['DB2'] },
                { name: 'Connection Issues', description: 'Database connectivity', parent_path: ['DB2'] },
            ]
        };
        this.templates.set(mainframeTemplate.id, mainframeTemplate);
    }
    serializeCategoryTree(categories, options) {
        return categories.map(cat => ({
            ...cat.node,
            children: cat.children.length > 0 ? this.serializeCategoryTree(cat.children, options) : undefined,
            path: cat.path,
            depth: cat.depth,
            statistics: options.includeStatistics ? {
                entry_count: cat.node.entry_count,
            } : undefined,
        }));
    }
    flattenCategories(categories) {
        const flattened = [];
        const traverse = (nodes) => {
            for (const node of nodes) {
                flattened.push(node.node);
                if (node.children.length > 0) {
                    traverse(node.children);
                }
            }
        };
        traverse(categories);
        return flattened;
    }
    categoryToCSVRow(category, headers, options) {
        return headers.map(header => {
            const value = category[header];
            if (value === null || value === undefined) {
                return '';
            }
            if (typeof value === 'boolean') {
                return value.toString();
            }
            if (value instanceof Date) {
                return value.toISOString();
            }
            const stringValue = String(value);
            if (stringValue.includes(',') || stringValue.includes('"')) {
                return `"${stringValue.replace(/"/g, '""')}"`;
            }
            return stringValue;
        }).join(',');
    }
    categoriesToXML(categories, options, indent) {
        const indentStr = '  '.repeat(indent);
        let xml = '';
        categories.forEach(cat => {
            xml += `${indentStr}<category>\n`;
            xml += `${indentStr}  <id>${cat.node.id}</id>\n`;
            xml += `${indentStr}  <name>${this.escapeXML(cat.node.name)}</name>\n`;
            if (cat.node.description) {
                xml += `${indentStr}  <description>${this.escapeXML(cat.node.description)}</description>\n`;
            }
            xml += `${indentStr}  <parent_path>${cat.path.join('/')}</parent_path>\n`;
            xml += `${indentStr}  <level>${cat.node.level}</level>\n`;
            xml += `${indentStr}  <is_active>${cat.node.is_active}</is_active>\n`;
            xml += `${indentStr}  <is_system>${cat.node.is_system}</is_system>\n`;
            if (options.includeStatistics && cat.node.entry_count) {
                xml += `${indentStr}  <entry_count>${cat.node.entry_count}</entry_count>\n`;
            }
            if (cat.children.length > 0) {
                xml += `${indentStr}  <children>\n`;
                xml += this.categoriesToXML(cat.children, options, indent + 2);
                xml += `${indentStr}  </children>\n`;
            }
            xml += `${indentStr}</category>\n`;
        });
        return xml;
    }
    parseCSVLine(line) {
        const values = [];
        let current = '';
        let inQuotes = false;
        let i = 0;
        while (i < line.length) {
            const char = line[i];
            if (char === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    current += '"';
                    i += 2;
                }
                else {
                    inQuotes = !inQuotes;
                    i++;
                }
            }
            else if (char === ',' && !inQuotes) {
                values.push(current);
                current = '';
                i++;
            }
            else {
                current += char;
                i++;
            }
        }
        values.push(current);
        return values;
    }
    escapeXML(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
    compressJSON(data) {
        return JSON.stringify(JSON.parse(data));
    }
    countTotalCategories(categories) {
        return this.flattenCategories(categories).length;
    }
    calculateMaxDepth(categories) {
        let maxDepth = 0;
        const traverse = (nodes, currentDepth) => {
            for (const node of nodes) {
                maxDepth = Math.max(maxDepth, currentDepth);
                if (node.children.length > 0) {
                    traverse(node.children, currentDepth + 1);
                }
            }
        };
        traverse(categories, 0);
        return maxDepth;
    }
    isDescendantOf(category, ancestorId) {
        const checkParent = (cat) => {
            if (cat.parent?.id === ancestorId)
                return true;
            if (cat.parent)
                return checkParent({ ...cat, parent: cat.parent });
            return false;
        };
        return checkParent(category);
    }
    limitDepth(categories, maxDepth) {
        return categories.map(cat => ({
            ...cat,
            children: cat.depth < maxDepth ? this.limitDepth(cat.children, maxDepth) : []
        }));
    }
    generateSlug(name) {
        return name
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim();
    }
    generateId() {
        return `cat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    getCategoryPathArray(category) {
        return [];
    }
    mergeCategories(existing, incoming) {
        return {
            ...existing,
            name: incoming.name || existing.name,
            description: incoming.description || existing.description,
            sort_order: incoming.sort_order !== undefined ? incoming.sort_order : existing.sort_order,
            color: incoming.color || existing.color,
            icon: incoming.icon || existing.icon,
            is_active: incoming.is_active !== undefined ? incoming.is_active : existing.is_active,
            updated_at: new Date(),
        };
    }
}
exports.CategoryImportExportService = CategoryImportExportService;
exports.default = CategoryImportExportService;
//# sourceMappingURL=CategoryImportExportService.js.map