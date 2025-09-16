/**
 * Category Import/Export Service
 *
 * Handles importing and exporting category structures with validation,
 * conflict resolution, and data integrity checks.
 *
 * Features:
 * - Import/export category hierarchies
 * - Support multiple formats (JSON, CSV, XML)
 * - Data validation and sanitization
 * - Conflict resolution strategies
 * - Backup and rollback capabilities
 * - Progress tracking and error handling
 * - Template management
 *
 * @author Swarm Architecture Team
 * @version 1.0.0
 */

import { z } from 'zod';
import { CategoryNode, CategoryTree } from './CategoryHierarchyService';

// ===========================
// SCHEMA DEFINITIONS
// ===========================

export const ImportOptionsSchema = z.object({
  mergeStrategy: z.enum(['replace', 'merge', 'skip', 'prompt']).default('merge'),
  validateStructure: z.boolean().default(true),
  preserveIds: z.boolean().default(false),
  createMissingParents: z.boolean().default(true),
  maxDepth: z.number().int().min(1).max(10).default(5),
  allowDuplicateNames: z.boolean().default(false),
  backupExisting: z.boolean().default(true),
  dryRun: z.boolean().default(false),
});

export type ImportOptions = z.infer<typeof ImportOptionsSchema>;

export const ExportOptionsSchema = z.object({
  format: z.enum(['json', 'csv', 'xml']).default('json'),
  includeMetadata: z.boolean().default(true),
  includeStatistics: z.boolean().default(true),
  flattenHierarchy: z.boolean().default(false),
  rootCategoryId: z.string().uuid().optional(),
  maxDepth: z.number().int().min(0).optional(),
  excludeSystemCategories: z.boolean().default(false),
  compressOutput: z.boolean().default(false),
});

export type ExportOptions = z.infer<typeof ExportOptionsSchema>;

export const ImportResultSchema = z.object({
  success: z.boolean(),
  summary: z.object({
    totalProcessed: z.number().int().min(0),
    imported: z.number().int().min(0),
    updated: z.number().int().min(0),
    skipped: z.number().int().min(0),
    failed: z.number().int().min(0),
  }),
  conflicts: z.array(z.object({
    type: z.enum(['duplicate_name', 'invalid_parent', 'depth_exceeded', 'invalid_data']),
    category: z.object({
      name: z.string(),
      path: z.array(z.string()),
    }),
    existing: z.object({
      id: z.string(),
      name: z.string(),
      path: z.array(z.string()),
    }).optional(),
    resolution: z.enum(['merged', 'replaced', 'skipped', 'failed']),
    message: z.string(),
  })),
  errors: z.array(z.object({
    category: z.string().optional(),
    message: z.string(),
    code: z.string().optional(),
  })),
  backupPath: z.string().optional(),
  rollbackAvailable: z.boolean(),
});

export type ImportResult = z.infer<typeof ImportResultSchema>;

export const CategoryTemplateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  version: z.string().default('1.0'),
  author: z.string().max(100).optional(),
  created_at: z.date(),
  categories: z.array(z.object({
    name: z.string(),
    description: z.string().optional(),
    parent_path: z.array(z.string()).default([]),
    metadata: z.record(z.any()).optional(),
  })),
  metadata: z.record(z.any()).optional(),
});

export type CategoryTemplate = z.infer<typeof CategoryTemplateSchema>;

// ===========================
// CATEGORY IMPORT/EXPORT SERVICE
// ===========================

export class CategoryImportExportService {
  private templates: Map<string, CategoryTemplate> = new Map();
  private backupHistory: Array<{ path: string; timestamp: Date; categories: CategoryNode[] }> = [];

  constructor() {
    this.loadDefaultTemplates();
  }

  // ===========================
  // EXPORT FUNCTIONALITY
  // ===========================

  /**
   * Export categories to specified format
   */
  async exportCategories(
    categories: CategoryTree[],
    options: ExportOptions = {}
  ): Promise<{ data: string; filename: string; contentType: string }> {
    const opts = ExportOptionsSchema.parse(options);

    // Filter categories based on options
    let filteredCategories = this.filterCategoriesForExport(categories, opts);

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

  private filterCategoriesForExport(categories: CategoryTree[], options: ExportOptions): CategoryTree[] {
    let filtered = [...categories];

    // Filter by root category
    if (options.rootCategoryId) {
      filtered = filtered.filter(cat =>
        cat.node.id === options.rootCategoryId ||
        this.isDescendantOf(cat, options.rootCategoryId!)
      );
    }

    // Filter by max depth
    if (options.maxDepth !== undefined) {
      filtered = this.limitDepth(filtered, options.maxDepth);
    }

    // Exclude system categories
    if (options.excludeSystemCategories) {
      filtered = filtered.filter(cat => !cat.node.is_system);
    }

    return filtered;
  }

  private exportAsJSON(categories: CategoryTree[], options: ExportOptions): { data: string; filename: string; contentType: string } {
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

  private exportAsCSV(categories: CategoryTree[], options: ExportOptions): { data: string; filename: string; contentType: string } {
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

  private exportAsXML(categories: CategoryTree[], options: ExportOptions): { data: string; filename: string; contentType: string } {
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

  // ===========================
  // IMPORT FUNCTIONALITY
  // ===========================

  /**
   * Import categories from file data
   */
  async importCategories(
    fileData: string,
    format: 'json' | 'csv' | 'xml',
    options: ImportOptions = {}
  ): Promise<ImportResult> {
    const opts = ImportOptionsSchema.parse(options);

    // Create backup if requested
    let backupPath: string | undefined;
    if (opts.backupExisting) {
      backupPath = await this.createBackup();
    }

    const result: ImportResult = {
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
      // Parse input data
      const parsedCategories = await this.parseImportData(fileData, format);
      result.summary.totalProcessed = parsedCategories.length;

      // Validate structure
      if (opts.validateStructure) {
        const validationErrors = this.validateCategoryStructure(parsedCategories, opts);
        if (validationErrors.length > 0) {
          result.errors.push(...validationErrors);
          if (!opts.dryRun) {
            return result;
          }
        }
      }

      // Process categories
      const processResult = await this.processCategoryImport(parsedCategories, opts);
      result.summary = processResult.summary;
      result.conflicts = processResult.conflicts;
      result.errors.push(...processResult.errors);

      result.success = result.summary.failed === 0;

    } catch (error) {
      result.errors.push({
        message: `Import failed: ${error.message}`,
        code: 'IMPORT_ERROR'
      });
    }

    return result;
  }

  private async parseImportData(fileData: string, format: string): Promise<any[]> {
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

  private parseJSONImport(data: string): any[] {
    try {
      const parsed = JSON.parse(data);

      if (parsed.categories && Array.isArray(parsed.categories)) {
        return parsed.categories;
      } else if (Array.isArray(parsed)) {
        return parsed;
      } else {
        throw new Error('Invalid JSON structure: expected categories array');
      }
    } catch (error) {
      throw new Error(`JSON parsing failed: ${error.message}`);
    }
  }

  private parseCSVImport(data: string): any[] {
    const lines = data.trim().split('\n');
    if (lines.length < 2) {
      throw new Error('CSV must have at least a header row and one data row');
    }

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const categories: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      if (values.length !== headers.length) {
        throw new Error(`Row ${i + 1}: Column count mismatch`);
      }

      const category: any = {};
      headers.forEach((header, index) => {
        const value = values[index].trim().replace(/"/g, '');

        // Type conversion based on header
        if (['level', 'sort_order', 'entry_count', 'usage_count'].includes(header)) {
          category[header] = value ? parseInt(value, 10) : 0;
        } else if (['is_active', 'is_system'].includes(header)) {
          category[header] = value.toLowerCase() === 'true';
        } else if (header === 'parent_path') {
          category[header] = value ? value.split('/').filter(Boolean) : [];
        } else {
          category[header] = value || undefined;
        }
      });

      categories.push(category);
    }

    return categories;
  }

  private parseXMLImport(data: string): any[] {
    // Simplified XML parsing - in production, use a proper XML parser
    const categories: any[] = [];
    const categoryMatches = data.match(/<category[^>]*>[\s\S]*?<\/category>/g);

    if (!categoryMatches) {
      throw new Error('No categories found in XML data');
    }

    categoryMatches.forEach(categoryXML => {
      const category: any = {};

      // Extract attributes and content
      const nameMatch = categoryXML.match(/<name>(.*?)<\/name>/);
      const descMatch = categoryXML.match(/<description>(.*?)<\/description>/);
      const parentPathMatch = categoryXML.match(/<parent_path>(.*?)<\/parent_path>/);

      if (nameMatch) category.name = nameMatch[1];
      if (descMatch) category.description = descMatch[1];
      if (parentPathMatch) {
        category.parent_path = parentPathMatch[1].split('/').filter(Boolean);
      }

      categories.push(category);
    });

    return categories;
  }

  private validateCategoryStructure(categories: any[], options: ImportOptions): Array<{ message: string; code: string }> {
    const errors: Array<{ message: string; code: string }> = [];

    categories.forEach((category, index) => {
      // Required fields
      if (!category.name || typeof category.name !== 'string') {
        errors.push({
          message: `Row ${index + 1}: Category name is required and must be a string`,
          code: 'INVALID_NAME'
        });
      }

      // Name length validation
      if (category.name && category.name.length > 100) {
        errors.push({
          message: `Row ${index + 1}: Category name exceeds maximum length (100 characters)`,
          code: 'NAME_TOO_LONG'
        });
      }

      // Description length validation
      if (category.description && category.description.length > 500) {
        errors.push({
          message: `Row ${index + 1}: Description exceeds maximum length (500 characters)`,
          code: 'DESCRIPTION_TOO_LONG'
        });
      }

      // Depth validation
      if (category.parent_path && category.parent_path.length >= options.maxDepth) {
        errors.push({
          message: `Row ${index + 1}: Category depth exceeds maximum (${options.maxDepth})`,
          code: 'DEPTH_EXCEEDED'
        });
      }
    });

    return errors;
  }

  private async processCategoryImport(categories: any[], options: ImportOptions): Promise<{
    summary: ImportResult['summary'];
    conflicts: ImportResult['conflicts'];
    errors: ImportResult['errors'];
  }> {
    const summary = {
      totalProcessed: categories.length,
      imported: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
    };

    const conflicts: ImportResult['conflicts'] = [];
    const errors: ImportResult['errors'] = [];

    // Sort categories by depth to ensure parents are processed first
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

      } catch (error) {
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

  private async processCategory(categoryData: any, options: ImportOptions): Promise<{
    action: 'imported' | 'updated' | 'skipped' | 'failed';
    conflict?: ImportResult['conflicts'][0];
  }> {
    // Find parent category
    let parentId: string | null = null;
    if (categoryData.parent_path && categoryData.parent_path.length > 0) {
      parentId = await this.findCategoryByPath(categoryData.parent_path);

      if (!parentId && options.createMissingParents) {
        parentId = await this.createMissingParents(categoryData.parent_path, options);
      }

      if (!parentId) {
        throw new Error(`Parent category not found: ${categoryData.parent_path.join(' > ')}`);
      }
    }

    // Check for existing category
    const existing = await this.findExistingCategory(categoryData.name, parentId);

    if (existing) {
      const conflict: ImportResult['conflicts'][0] = {
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
          // In a real implementation, this would prompt the user
          // For now, default to skip
          return { action: 'skipped', conflict };
      }
    }

    // Create new category
    const newCategory: Omit<CategoryNode, 'id' | 'created_at' | 'updated_at'> = {
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

  // ===========================
  // TEMPLATE MANAGEMENT
  // ===========================

  /**
   * Create a template from current category structure
   */
  async createTemplate(
    name: string,
    description: string,
    categories: CategoryTree[],
    author?: string
  ): Promise<CategoryTemplate> {
    const template: CategoryTemplate = {
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

  /**
   * Apply template to current category structure
   */
  async applyTemplate(templateId: string, options: ImportOptions = {}): Promise<ImportResult> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // Convert template to importable format
    const importData = JSON.stringify({
      version: template.version,
      categories: template.categories
    });

    return this.importCategories(importData, 'json', options);
  }

  /**
   * Get all available templates
   */
  getTemplates(): CategoryTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Delete a template
   */
  async deleteTemplate(templateId: string): Promise<void> {
    if (!this.templates.has(templateId)) {
      throw new Error(`Template not found: ${templateId}`);
    }

    this.templates.delete(templateId);
    await this.removeTemplateFromStorage(templateId);
  }

  // ===========================
  // BACKUP AND ROLLBACK
  // ===========================

  /**
   * Create backup of current categories
   */
  async createBackup(): Promise<string> {
    const timestamp = new Date();
    const backupPath = `backup_${timestamp.toISOString().slice(0, 19).replace(/[:.]/g, '-')}.json`;

    // In a real implementation, this would save to file system
    const currentCategories = await this.getAllCategories();

    this.backupHistory.push({
      path: backupPath,
      timestamp,
      categories: currentCategories
    });

    // Keep only last 10 backups
    if (this.backupHistory.length > 10) {
      this.backupHistory.shift();
    }

    return backupPath;
  }

  /**
   * Rollback to a previous backup
   */
  async rollback(backupPath: string): Promise<void> {
    const backup = this.backupHistory.find(b => b.path === backupPath);
    if (!backup) {
      throw new Error(`Backup not found: ${backupPath}`);
    }

    // In a real implementation, this would restore from backup
    await this.restoreCategories(backup.categories);
  }

  /**
   * Get backup history
   */
  getBackupHistory(): Array<{ path: string; timestamp: Date; categoryCount: number }> {
    return this.backupHistory.map(backup => ({
      path: backup.path,
      timestamp: backup.timestamp,
      categoryCount: backup.categories.length
    }));
  }

  // ===========================
  // UTILITY METHODS
  // ===========================

  private loadDefaultTemplates(): void {
    // Load default templates for common mainframe environments
    const mainframeTemplate: CategoryTemplate = {
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

  private serializeCategoryTree(categories: CategoryTree[], options: ExportOptions): any[] {
    return categories.map(cat => ({
      ...cat.node,
      children: cat.children.length > 0 ? this.serializeCategoryTree(cat.children, options) : undefined,
      path: cat.path,
      depth: cat.depth,
      statistics: options.includeStatistics ? {
        entry_count: cat.node.entry_count,
        // Add more statistics as needed
      } : undefined,
    }));
  }

  private flattenCategories(categories: CategoryTree[]): CategoryNode[] {
    const flattened: CategoryNode[] = [];

    const traverse = (nodes: CategoryTree[]) => {
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

  private categoryToCSVRow(category: CategoryNode, headers: string[], options: ExportOptions): string {
    return headers.map(header => {
      let value = category[header as keyof CategoryNode];

      if (value === null || value === undefined) {
        return '';
      }

      if (typeof value === 'boolean') {
        return value.toString();
      }

      if (value instanceof Date) {
        return value.toISOString();
      }

      // Escape commas and quotes in CSV
      const stringValue = String(value);
      if (stringValue.includes(',') || stringValue.includes('"')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }

      return stringValue;
    }).join(',');
  }

  private categoriesToXML(categories: CategoryTree[], options: ExportOptions, indent: number): string {
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

  private parseCSVLine(line: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    let i = 0;

    while (i < line.length) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          // Escaped quote
          current += '"';
          i += 2;
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
          i++;
        }
      } else if (char === ',' && !inQuotes) {
        // End of field
        values.push(current);
        current = '';
        i++;
      } else {
        current += char;
        i++;
      }
    }

    // Add final field
    values.push(current);

    return values;
  }

  private escapeXML(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private compressJSON(data: string): string {
    // Simple compression - remove unnecessary whitespace
    return JSON.stringify(JSON.parse(data));
  }

  private countTotalCategories(categories: CategoryTree[]): number {
    return this.flattenCategories(categories).length;
  }

  private calculateMaxDepth(categories: CategoryTree[]): number {
    let maxDepth = 0;

    const traverse = (nodes: CategoryTree[], currentDepth: number) => {
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

  private isDescendantOf(category: CategoryTree, ancestorId: string): boolean {
    // Check if category is a descendant of the given ancestor
    const checkParent = (cat: CategoryTree): boolean => {
      if (cat.parent?.id === ancestorId) return true;
      if (cat.parent) return checkParent({ ...cat, parent: cat.parent });
      return false;
    };

    return checkParent(category);
  }

  private limitDepth(categories: CategoryTree[], maxDepth: number): CategoryTree[] {
    return categories.map(cat => ({
      ...cat,
      children: cat.depth < maxDepth ? this.limitDepth(cat.children, maxDepth) : []
    }));
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  private generateId(): string {
    return `cat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getCategoryPathArray(category: CategoryNode): string[] {
    // This would be implemented based on your category hierarchy
    return [];
  }

  private mergeCategories(existing: CategoryNode, incoming: any): Partial<CategoryNode> {
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

  // Abstract methods that would be implemented by concrete storage layer
  protected abstract findCategoryByPath(path: string[]): Promise<string | null>;
  protected abstract findExistingCategory(name: string, parentId: string | null): Promise<CategoryNode | null>;
  protected abstract createMissingParents(path: string[], options: ImportOptions): Promise<string>;
  protected abstract getCategoryPath(categoryId: string): Promise<string[]>;
  protected abstract getCategoryLevel(categoryId: string): Promise<number>;
  protected abstract createCategory(category: Omit<CategoryNode, 'id' | 'created_at' | 'updated_at'>): Promise<CategoryNode>;
  protected abstract updateCategory(id: string, updates: Partial<CategoryNode>): Promise<void>;
  protected abstract getAllCategories(): Promise<CategoryNode[]>;
  protected abstract restoreCategories(categories: CategoryNode[]): Promise<void>;
  protected abstract saveTemplate(template: CategoryTemplate): Promise<void>;
  protected abstract removeTemplateFromStorage(templateId: string): Promise<void>;
}

export default CategoryImportExportService;