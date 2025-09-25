/**
 * Category Hierarchy Management Service
 *
 * Provides hierarchical category management with parent-child relationships,
 * category trees, and organizational structure for KB entries.
 *
 * Features:
 * - Hierarchical category structure (parent/child relationships)
 * - Category validation and conflict detection
 * - Category tree navigation and search
 * - Category statistics and analytics
 * - Import/export category structures
 * - Category template system
 *
 * @author Swarm Architecture Team
 * @version 1.0.0
 */

import { EventEmitter } from 'events';
import { z } from 'zod';

// ===========================
// CATEGORY SCHEMA DEFINITIONS
// ===========================

export const CategoryNodeSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(50),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  description: z.string().max(500).optional(),
  parent_id: z.string().uuid().nullable(),
  level: z.number().int().min(0).max(5), // Max 5 levels deep
  sort_order: z.number().int().min(0).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .optional(), // Hex color code
  icon: z.string().max(50).optional(), // Icon name or emoji
  is_system: z.boolean().default(false), // System categories cannot be deleted
  is_active: z.boolean().default(true),
  created_at: z.date().optional(),
  updated_at: z.date().optional(),
  entry_count: z.number().int().min(0).optional(), // Cached count of entries
});

export type CategoryNode = z.infer<typeof CategoryNodeSchema>;

export const CategoryTreeSchema = z.object({
  node: CategoryNodeSchema,
  children: z.lazy(() => z.array(CategoryTreeSchema)),
  parent: CategoryNodeSchema.nullable(),
  path: z.array(z.string()), // Array of category names from root to this node
  depth: z.number().int().min(0),
});

export type CategoryTree = z.infer<typeof CategoryTreeSchema>;

export const CategoryStatsSchema = z.object({
  category_id: z.string().uuid(),
  entry_count: z.number().int().min(0),
  usage_count: z.number().int().min(0),
  search_count: z.number().int().min(0),
  avg_success_rate: z.number().min(0).max(100),
  last_used: z.date().optional(),
  trending_score: z.number().min(0).optional(),
});

export type CategoryStats = z.infer<typeof CategoryStatsSchema>;

export const CategoryMoveOperationSchema = z.object({
  category_id: z.string().uuid(),
  new_parent_id: z.string().uuid().nullable(),
  new_sort_order: z.number().int().min(0).optional(),
});

export type CategoryMoveOperation = z.infer<typeof CategoryMoveOperationSchema>;

// ===========================
// CATEGORY HIERARCHY SERVICE
// ===========================

export interface CategoryHierarchyOptions {
  maxDepth?: number;
  allowDuplicateNames?: boolean;
  autoGenerateSlugs?: boolean;
  enableCaching?: boolean;
  validateOnMove?: boolean;
}

export class CategoryHierarchyService extends EventEmitter {
  private categories: Map<string, CategoryNode> = new Map();
  private categoryTree: Map<string, CategoryTree> = new Map();
  private parentChildMap: Map<string, string[]> = new Map(); // parent_id -> child_ids
  private slugMap: Map<string, string> = new Map(); // slug -> id
  private pathCache: Map<string, string[]> = new Map(); // id -> path
  private options: Required<CategoryHierarchyOptions>;

  constructor(options: CategoryHierarchyOptions = {}) {
    super();

    this.options = {
      maxDepth: 5,
      allowDuplicateNames: false,
      autoGenerateSlugs: true,
      enableCaching: true,
      validateOnMove: true,
      ...options,
    };

    this.initializeSystemCategories();
  }

  // ===========================
  // CATEGORY CRUD OPERATIONS
  // ===========================

  /**
   * Create a new category node
   */
  async createCategory(
    categoryData: Omit<CategoryNode, 'id' | 'level' | 'created_at' | 'updated_at'>
  ): Promise<CategoryNode> {
    const validation = CategoryNodeSchema.omit({
      id: true,
      level: true,
      created_at: true,
      updated_at: true,
    }).safeParse(categoryData);

    if (!validation.success) {
      throw new Error(`Invalid category data: ${validation.error.message}`);
    }

    // Calculate level based on parent
    let level = 0;
    if (categoryData.parent_id) {
      const parent = this.categories.get(categoryData.parent_id);
      if (!parent) {
        throw new Error(`Parent category not found: ${categoryData.parent_id}`);
      }
      level = parent.level + 1;

      if (level > this.options.maxDepth) {
        throw new Error(`Maximum category depth exceeded (${this.options.maxDepth})`);
      }
    }

    // Auto-generate slug if needed
    let slug = categoryData.slug;
    if (!slug && this.options.autoGenerateSlugs) {
      slug = this.generateSlug(categoryData.name);
    }

    // Check for duplicate slugs
    if (this.slugMap.has(slug)) {
      if (!this.options.allowDuplicateNames) {
        throw new Error(`Category with slug '${slug}' already exists`);
      }
      slug = this.generateUniqueSlug(categoryData.name);
    }

    const category: CategoryNode = {
      ...categoryData,
      id: this.generateId(),
      slug,
      level,
      created_at: new Date(),
      updated_at: new Date(),
    };

    await this.insertCategory(category);
    this.emit('categoryCreated', category);

    return category;
  }

  /**
   * Update an existing category
   */
  async updateCategory(id: string, updates: Partial<CategoryNode>): Promise<CategoryNode> {
    const existing = this.categories.get(id);
    if (!existing) {
      throw new Error(`Category not found: ${id}`);
    }

    // Prevent updating system categories
    if (existing.is_system && (updates.name || updates.slug || updates.parent_id)) {
      throw new Error('Cannot modify system category structure');
    }

    // Handle parent change - validate hierarchy
    if (updates.parent_id !== undefined && updates.parent_id !== existing.parent_id) {
      await this.validateParentChange(id, updates.parent_id);
    }

    const updated: CategoryNode = {
      ...existing,
      ...updates,
      updated_at: new Date(),
    };

    // Recalculate level if parent changed
    if (updates.parent_id !== undefined) {
      updated.level = updates.parent_id
        ? (this.categories.get(updates.parent_id)?.level ?? 0) + 1
        : 0;
    }

    await this.updateCategoryInStorage(updated);
    this.emit('categoryUpdated', updated, existing);

    return updated;
  }

  /**
   * Delete a category (soft delete if has children)
   */
  async deleteCategory(id: string, force: boolean = false): Promise<void> {
    const category = this.categories.get(id);
    if (!category) {
      throw new Error(`Category not found: ${id}`);
    }

    if (category.is_system) {
      throw new Error('Cannot delete system category');
    }

    const children = this.getChildren(id);
    if (children.length > 0 && !force) {
      throw new Error(
        `Category has ${children.length} child categories. Use force=true to delete.`
      );
    }

    // Check if category has entries
    const entryCount = await this.getCategoryEntryCount(id);
    if (entryCount > 0 && !force) {
      throw new Error(`Category has ${entryCount} entries. Use force=true to delete.`);
    }

    if (force && children.length > 0) {
      // Move children to parent or root
      const newParentId = category.parent_id;
      for (const child of children) {
        await this.updateCategory(child.id, { parent_id: newParentId });
      }
    }

    await this.deleteCategoryFromStorage(id);
    this.emit('categoryDeleted', category);
  }

  // ===========================
  // HIERARCHY NAVIGATION
  // ===========================

  /**
   * Get category tree from root
   */
  getCategoryTree(rootId?: string): CategoryTree[] {
    const roots = rootId ? [rootId] : this.getRootCategories();
    return roots.map(id => this.buildCategoryTree(id)).filter(Boolean) as CategoryTree[];
  }

  /**
   * Build category tree for a specific node
   */
  private buildCategoryTree(categoryId: string, visited = new Set<string>()): CategoryTree | null {
    if (visited.has(categoryId)) {
      console.warn(`Circular reference detected in category hierarchy: ${categoryId}`);
      return null;
    }

    const category = this.categories.get(categoryId);
    if (!category) return null;

    visited.add(categoryId);

    const children = this.getChildren(categoryId)
      .map(child => this.buildCategoryTree(child.id, new Set(visited)))
      .filter(Boolean) as CategoryTree[];

    const parent = category.parent_id ? this.categories.get(category.parent_id) : null;
    const path = this.getCategoryPath(categoryId);

    return {
      node: category,
      children,
      parent,
      path,
      depth: category.level,
    };
  }

  /**
   * Get path from root to category
   */
  getCategoryPath(categoryId: string): string[] {
    if (this.options.enableCaching && this.pathCache.has(categoryId)) {
      return this.pathCache.get(categoryId)!;
    }

    const path: string[] = [];
    let currentId: string | null = categoryId;

    while (currentId) {
      const category = this.categories.get(currentId);
      if (!category) break;

      path.unshift(category.name);
      currentId = category.parent_id;
    }

    if (this.options.enableCaching) {
      this.pathCache.set(categoryId, path);
    }

    return path;
  }

  /**
   * Find category by path
   */
  findCategoryByPath(path: string[]): CategoryNode | null {
    let currentCategories = this.getRootCategories();

    for (const pathSegment of path) {
      const found = currentCategories.find(id => {
        const cat = this.categories.get(id);
        return cat?.name.toLowerCase() === pathSegment.toLowerCase();
      });

      if (!found) return null;

      const category = this.categories.get(found);
      if (!category) return null;

      if (path.indexOf(pathSegment) === path.length - 1) {
        return category; // Found final category
      }

      currentCategories = this.getChildren(found).map(c => c.id);
    }

    return null;
  }

  /**
   * Get all ancestors of a category
   */
  getAncestors(categoryId: string): CategoryNode[] {
    const ancestors: CategoryNode[] = [];
    let currentId = this.categories.get(categoryId)?.parent_id;

    while (currentId) {
      const category = this.categories.get(currentId);
      if (!category) break;

      ancestors.unshift(category);
      currentId = category.parent_id;
    }

    return ancestors;
  }

  /**
   * Get all descendants of a category
   */
  getDescendants(categoryId: string): CategoryNode[] {
    const descendants: CategoryNode[] = [];
    const queue = [...this.getChildren(categoryId)];

    while (queue.length > 0) {
      const category = queue.shift()!;
      descendants.push(category);
      queue.push(...this.getChildren(category.id));
    }

    return descendants;
  }

  // ===========================
  // SEARCH AND FILTERING
  // ===========================

  /**
   * Search categories by name or description
   */
  searchCategories(
    query: string,
    options: {
      includeDescendants?: boolean;
      activeOnly?: boolean;
      maxResults?: number;
    } = {}
  ): CategoryNode[] {
    const { includeDescendants = false, activeOnly = true, maxResults = 50 } = options;

    const lowerQuery = query.toLowerCase();
    let results = Array.from(this.categories.values()).filter(category => {
      if (activeOnly && !category.is_active) return false;

      const nameMatch = category.name.toLowerCase().includes(lowerQuery);
      const descMatch = category.description?.toLowerCase().includes(lowerQuery);
      const slugMatch = category.slug.toLowerCase().includes(lowerQuery);

      return nameMatch || descMatch || slugMatch;
    });

    if (includeDescendants) {
      const additionalResults: CategoryNode[] = [];
      results.forEach(category => {
        additionalResults.push(...this.getDescendants(category.id));
      });
      results = [...results, ...additionalResults];
    }

    // Sort by relevance (exact matches first, then by usage)
    results.sort((a, b) => {
      const aExact = a.name.toLowerCase() === lowerQuery ? 1 : 0;
      const bExact = b.name.toLowerCase() === lowerQuery ? 1 : 0;
      if (aExact !== bExact) return bExact - aExact;

      return (b.entry_count || 0) - (a.entry_count || 0);
    });

    return results.slice(0, maxResults);
  }

  /**
   * Get categories by level
   */
  getCategoriesByLevel(level: number): CategoryNode[] {
    return Array.from(this.categories.values())
      .filter(category => category.level === level)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  }

  /**
   * Get popular categories based on usage
   */
  getPopularCategories(limit: number = 10): CategoryNode[] {
    return Array.from(this.categories.values())
      .filter(category => category.is_active)
      .sort((a, b) => (b.entry_count || 0) - (a.entry_count || 0))
      .slice(0, limit);
  }

  // ===========================
  // CATEGORY OPERATIONS
  // ===========================

  /**
   * Move category to new parent
   */
  async moveCategory(operation: CategoryMoveOperation): Promise<void> {
    const { category_id, new_parent_id, new_sort_order } = operation;

    if (this.options.validateOnMove) {
      await this.validateParentChange(category_id, new_parent_id);
    }

    const updates: Partial<CategoryNode> = {
      parent_id: new_parent_id,
    };

    if (new_sort_order !== undefined) {
      updates.sort_order = new_sort_order;
    }

    await this.updateCategory(category_id, updates);
    this.emit('categoryMoved', operation);
  }

  /**
   * Reorder categories within same parent
   */
  async reorderCategories(parentId: string | null, orderedIds: string[]): Promise<void> {
    const children = this.getChildren(parentId || '');

    // Validate all IDs belong to same parent
    const validIds = children.map(c => c.id);
    if (!orderedIds.every(id => validIds.includes(id))) {
      throw new Error('Some categories do not belong to the specified parent');
    }

    // Update sort orders
    for (let i = 0; i < orderedIds.length; i++) {
      await this.updateCategory(orderedIds[i], { sort_order: i });
    }

    this.emit('categoriesReordered', parentId, orderedIds);
  }

  // ===========================
  // IMPORT/EXPORT OPERATIONS
  // ===========================

  /**
   * Export category structure to JSON
   */
  exportCategories(rootId?: string): any {
    const tree = this.getCategoryTree(rootId);
    return {
      version: '1.0',
      exported_at: new Date().toISOString(),
      categories: tree,
      metadata: {
        total_count: this.categories.size,
        max_depth: Math.max(...Array.from(this.categories.values()).map(c => c.level)),
        system_categories: Array.from(this.categories.values()).filter(c => c.is_system).length,
      },
    };
  }

  /**
   * Import category structure from JSON
   */
  async importCategories(
    data: any,
    options: {
      mergeStrategy?: 'replace' | 'merge' | 'skip';
      validateStructure?: boolean;
    } = {}
  ): Promise<{ imported: number; skipped: number; errors: string[] }> {
    const { mergeStrategy = 'merge', validateStructure = true } = options;
    const results = { imported: 0, skipped: 0, errors: [] as string[] };

    try {
      if (validateStructure) {
        this.validateImportStructure(data);
      }

      // Import categories level by level to maintain hierarchy
      const categoriesFlat = this.flattenCategoryTree(data.categories);
      const sortedByLevel = categoriesFlat.sort((a, b) => a.level - b.level);

      for (const categoryData of sortedByLevel) {
        try {
          const existing = this.findCategoryBySlug(categoryData.slug);

          if (existing) {
            if (mergeStrategy === 'skip') {
              results.skipped++;
              continue;
            } else if (mergeStrategy === 'replace') {
              await this.updateCategory(existing.id, categoryData);
              results.imported++;
            } else {
              // merge
              const merged = { ...existing, ...categoryData, id: existing.id };
              await this.updateCategory(existing.id, merged);
              results.imported++;
            }
          } else {
            await this.createCategory(categoryData);
            results.imported++;
          }
        } catch (error) {
          results.errors.push(`Category '${categoryData.name}': ${error.message}`);
        }
      }

      this.emit('categoriesImported', results);
    } catch (error) {
      results.errors.push(`Import failed: ${error.message}`);
    }

    return results;
  }

  // ===========================
  // UTILITY METHODS
  // ===========================

  private initializeSystemCategories(): void {
    // Initialize default mainframe categories
    const systemCategories = [
      { name: 'JCL', slug: 'jcl', description: 'Job Control Language related issues' },
      { name: 'VSAM', slug: 'vsam', description: 'Virtual Storage Access Method' },
      { name: 'DB2', slug: 'db2', description: 'DB2 database related issues' },
      { name: 'Batch Processing', slug: 'batch', description: 'Batch job processing' },
      { name: 'CICS', slug: 'cics', description: 'Customer Information Control System' },
      { name: 'IMS', slug: 'ims', description: 'Information Management System' },
      { name: 'System', slug: 'system', description: 'System level issues' },
      { name: 'Other', slug: 'other', description: 'Miscellaneous issues' },
    ];

    systemCategories.forEach(cat => {
      const category: CategoryNode = {
        id: this.generateId(),
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        parent_id: null,
        level: 0,
        is_system: true,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };
      this.categories.set(category.id, category);
      this.slugMap.set(category.slug, category.id);
    });
  }

  private generateId(): string {
    return `cat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  private generateUniqueSlug(name: string): string {
    const baseSlug = this.generateSlug(name);
    let counter = 1;
    let slug = baseSlug;

    while (this.slugMap.has(slug)) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }

  private getRootCategories(): string[] {
    return Array.from(this.categories.values())
      .filter(category => !category.parent_id && category.is_active)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
      .map(category => category.id);
  }

  private getChildren(parentId: string): CategoryNode[] {
    return Array.from(this.categories.values())
      .filter(category => category.parent_id === (parentId || null) && category.is_active)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  }

  private async validateParentChange(
    categoryId: string,
    newParentId: string | null
  ): Promise<void> {
    if (!newParentId) return; // Moving to root is always valid

    const category = this.categories.get(categoryId);
    const newParent = this.categories.get(newParentId);

    if (!category) throw new Error('Category not found');
    if (!newParent) throw new Error('New parent category not found');

    // Check for circular reference
    const ancestors = this.getAncestors(newParentId);
    if (ancestors.some(ancestor => ancestor.id === categoryId)) {
      throw new Error('Cannot move category to its own descendant');
    }

    // Check depth limit
    if (newParent.level + 1 > this.options.maxDepth) {
      throw new Error(`Maximum category depth exceeded (${this.options.maxDepth})`);
    }
  }

  private findCategoryBySlug(slug: string): CategoryNode | null {
    const id = this.slugMap.get(slug);
    return id ? this.categories.get(id) || null : null;
  }

  private validateImportStructure(data: any): void {
    if (!data.version || !data.categories) {
      throw new Error('Invalid import format');
    }
    // Add more validation logic as needed
  }

  private flattenCategoryTree(tree: CategoryTree[]): CategoryNode[] {
    const flattened: CategoryNode[] = [];

    const traverse = (nodes: CategoryTree[]) => {
      for (const node of nodes) {
        flattened.push(node.node);
        if (node.children.length > 0) {
          traverse(node.children);
        }
      }
    };

    traverse(tree);
    return flattened;
  }

  // Abstract methods to be implemented by concrete storage layer
  protected abstract insertCategory(category: CategoryNode): Promise<void>;
  protected abstract updateCategoryInStorage(category: CategoryNode): Promise<void>;
  protected abstract deleteCategoryFromStorage(id: string): Promise<void>;
  protected abstract getCategoryEntryCount(categoryId: string): Promise<number>;
}
