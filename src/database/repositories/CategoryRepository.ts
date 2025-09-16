/**
 * Category Repository
 * Handles hierarchical category operations with optimized queries and caching
 */

import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import {
  CategoryNode,
  CategoryTree,
  CreateCategory,
  UpdateCategory,
  BulkCategoryOperation,
  BulkOperationResult,
  CategoryAnalytics,
  HierarchicalSchemaValidator
} from '../schemas/HierarchicalCategories.schema';
import { AppError, ErrorCode } from '../../core/errors/AppError';

export interface CategoryQueryOptions {
  includeInactive?: boolean;
  includeSystem?: boolean;
  maxDepth?: number;
  parentId?: string | null;
  withStats?: boolean;
}

export class CategoryRepository {
  private db: Database.Database;
  private preparedStatements: Map<string, Database.Statement> = new Map();

  constructor(db: Database.Database) {
    this.db = db;
    this.initializePreparedStatements();
  }

  private initializePreparedStatements(): void {
    // Basic CRUD operations
    this.preparedStatements.set('insertCategory', this.db.prepare(`
      INSERT INTO categories (
        id, name, slug, description, parent_id, level, sort_order,
        icon, color, is_active, is_system, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `));

    this.preparedStatements.set('updateCategory', this.db.prepare(`
      UPDATE categories SET
        name = COALESCE(?, name),
        slug = COALESCE(?, slug),
        description = COALESCE(?, description),
        parent_id = COALESCE(?, parent_id),
        sort_order = COALESCE(?, sort_order),
        icon = COALESCE(?, icon),
        color = COALESCE(?, color),
        is_active = COALESCE(?, is_active),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND is_system = FALSE
    `));

    this.preparedStatements.set('deleteCategory', this.db.prepare(`
      DELETE FROM categories WHERE id = ? AND is_system = FALSE
    `));

    this.preparedStatements.set('selectById', this.db.prepare(`
      SELECT * FROM v_category_stats WHERE id = ?
    `));

    this.preparedStatements.set('selectBySlug', this.db.prepare(`
      SELECT * FROM v_category_stats WHERE slug = ?
    `));

    // Hierarchy operations
    this.preparedStatements.set('selectChildren', this.db.prepare(`
      SELECT * FROM v_category_stats
      WHERE parent_id = ? AND is_active = ?
      ORDER BY sort_order ASC, name ASC
    `));

    this.preparedStatements.set('selectDescendants', this.db.prepare(`
      WITH RECURSIVE descendants AS (
        SELECT id, name, slug, parent_id, level, sort_order, is_active
        FROM categories
        WHERE parent_id = ?

        UNION ALL

        SELECT c.id, c.name, c.slug, c.parent_id, c.level, c.sort_order, c.is_active
        FROM categories c
        JOIN descendants d ON c.parent_id = d.id
        WHERE c.level <= ?
      )
      SELECT DISTINCT * FROM descendants
      WHERE is_active = ?
      ORDER BY level ASC, sort_order ASC, name ASC
    `));

    this.preparedStatements.set('selectAncestors', this.db.prepare(`
      WITH RECURSIVE ancestors AS (
        SELECT id, name, slug, parent_id, level
        FROM categories
        WHERE id = ?

        UNION ALL

        SELECT c.id, c.name, c.slug, c.parent_id, c.level
        FROM categories c
        JOIN ancestors a ON c.id = a.parent_id
      )
      SELECT * FROM ancestors
      WHERE id != ?
      ORDER BY level ASC
    `));

    // Bulk operations
    this.preparedStatements.set('updateSortOrder', this.db.prepare(`
      UPDATE categories SET sort_order = ? WHERE id = ?
    `));

    this.preparedStatements.set('moveCategory', this.db.prepare(`
      UPDATE categories SET parent_id = ?, level = ? WHERE id = ?
    `));

    // Analytics
    this.preparedStatements.set('updateCategoryAnalytics', this.db.prepare(`
      INSERT OR REPLACE INTO category_analytics (
        category_id, entry_count, view_count, search_count,
        success_rate, avg_resolution_time, last_updated
      ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `));
  }

  /**
   * Create a new category
   */
  async create(categoryData: CreateCategory, userId?: string): Promise<CategoryNode> {
    const validatedData = HierarchicalSchemaValidator.validateCreateCategory(categoryData);

    const transaction = this.db.transaction(() => {
      const id = uuidv4();
      let level = 0;

      // Calculate level based on parent
      if (validatedData.parent_id) {
        const parent = this.preparedStatements.get('selectById')!.get(validatedData.parent_id) as any;
        if (!parent) {
          throw new AppError(ErrorCode.VALIDATION_ERROR, 'Parent category not found');
        }
        if (!parent.is_active) {
          throw new AppError(ErrorCode.VALIDATION_ERROR, 'Parent category is inactive');
        }
        level = parent.level + 1;

        if (level > 5) {
          throw new AppError(ErrorCode.VALIDATION_ERROR, 'Maximum category depth exceeded (5 levels)');
        }
      }

      // Check for duplicate slug
      const existingSlug = this.preparedStatements.get('selectBySlug')!.get(validatedData.slug);
      if (existingSlug) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 'Category slug already exists');
      }

      // Insert category
      this.preparedStatements.get('insertCategory')!.run(
        id,
        validatedData.name,
        validatedData.slug,
        validatedData.description || null,
        validatedData.parent_id || null,
        level,
        validatedData.sort_order || 0,
        validatedData.icon || null,
        validatedData.color || null,
        validatedData.is_active !== false,
        validatedData.is_system === true,
        userId || 'system'
      );

      return this.preparedStatements.get('selectById')!.get(id) as CategoryNode;
    });

    return transaction();
  }

  /**
   * Update an existing category
   */
  async update(id: string, updates: UpdateCategory, userId?: string): Promise<CategoryNode> {
    const validatedUpdates = HierarchicalSchemaValidator.validateUpdateCategory(updates);

    const transaction = this.db.transaction(() => {
      const existing = this.preparedStatements.get('selectById')!.get(id) as any;
      if (!existing) {
        throw new AppError(ErrorCode.RESOURCE_NOT_FOUND, 'Category not found');
      }

      if (existing.is_system && !validatedUpdates.is_active) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 'Cannot modify system category');
      }

      // Handle hierarchy changes
      let newLevel = existing.level;
      if (validatedUpdates.parent_id !== undefined) {
        if (validatedUpdates.parent_id === id) {
          throw new AppError(ErrorCode.VALIDATION_ERROR, 'Category cannot be its own parent');
        }

        if (validatedUpdates.parent_id) {
          const newParent = this.preparedStatements.get('selectById')!.get(validatedUpdates.parent_id) as any;
          if (!newParent) {
            throw new AppError(ErrorCode.VALIDATION_ERROR, 'New parent category not found');
          }

          // Check for circular reference
          if (this.wouldCreateCircularReference(id, validatedUpdates.parent_id)) {
            throw new AppError(ErrorCode.VALIDATION_ERROR, 'Move would create circular reference');
          }

          newLevel = newParent.level + 1;
          if (newLevel > 5) {
            throw new AppError(ErrorCode.VALIDATION_ERROR, 'Move would exceed maximum depth');
          }
        } else {
          newLevel = 0;
        }
      }

      // Check slug uniqueness if changing
      if (validatedUpdates.slug && validatedUpdates.slug !== existing.slug) {
        const existingSlug = this.preparedStatements.get('selectBySlug')!.get(validatedUpdates.slug);
        if (existingSlug) {
          throw new AppError(ErrorCode.VALIDATION_ERROR, 'Category slug already exists');
        }
      }

      // Update category
      this.preparedStatements.get('updateCategory')!.run(
        validatedUpdates.name,
        validatedUpdates.slug,
        validatedUpdates.description,
        validatedUpdates.parent_id,
        validatedUpdates.sort_order,
        validatedUpdates.icon,
        validatedUpdates.color,
        validatedUpdates.is_active,
        id
      );

      // Update level if parent changed
      if (newLevel !== existing.level) {
        this.updateSubtreeLevels(id, newLevel);
      }

      return this.preparedStatements.get('selectById')!.get(id) as CategoryNode;
    });

    return transaction();
  }

  /**
   * Delete a category (soft delete or hard delete based on system flag)
   */
  async delete(id: string, options?: { force?: boolean }): Promise<void> {
    const transaction = this.db.transaction(() => {
      const category = this.preparedStatements.get('selectById')!.get(id) as any;
      if (!category) {
        throw new AppError(ErrorCode.RESOURCE_NOT_FOUND, 'Category not found');
      }

      if (category.is_system && !options?.force) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 'Cannot delete system category');
      }

      // Check for child categories
      const children = this.preparedStatements.get('selectChildren')!.all(id, true) as any[];
      if (children.length > 0) {
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          'Cannot delete category with child categories'
        );
      }

      // Check for associated entries
      const entryCount = this.db.prepare(
        'SELECT COUNT(*) as count FROM kb_entries WHERE category_id = ?'
      ).get(id) as any;

      if (entryCount.count > 0) {
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          `Cannot delete category with ${entryCount.count} associated entries`
        );
      }

      // Delete category
      const result = this.preparedStatements.get('deleteCategory')!.run(id);
      if (result.changes === 0) {
        throw new AppError(ErrorCode.RESOURCE_NOT_FOUND, 'Category not found or is system category');
      }
    });

    transaction();
  }

  /**
   * Get category by ID
   */
  async findById(id: string, options: CategoryQueryOptions = {}): Promise<CategoryNode | null> {
    const category = this.preparedStatements.get('selectById')!.get(id) as any;

    if (!category) return null;
    if (!category.is_active && !options.includeInactive) return null;
    if (!category.is_system && !options.includeSystem && category.is_system) return null;

    return category;
  }

  /**
   * Get category by slug
   */
  async findBySlug(slug: string, options: CategoryQueryOptions = {}): Promise<CategoryNode | null> {
    const category = this.preparedStatements.get('selectBySlug')!.get(slug) as any;

    if (!category) return null;
    if (!category.is_active && !options.includeInactive) return null;

    return category;
  }

  /**
   * Get category hierarchy as tree structure
   */
  async getHierarchy(options: CategoryQueryOptions = {}): Promise<CategoryTree[]> {
    const rootCategories = this.getRootCategories(options);
    return this.buildCategoryTrees(rootCategories, options);
  }

  /**
   * Get category children
   */
  async getChildren(parentId: string | null, options: CategoryQueryOptions = {}): Promise<CategoryNode[]> {
    const isActive = options.includeInactive ? undefined : true;

    if (parentId) {
      return this.preparedStatements.get('selectChildren')!.all(parentId, isActive) as CategoryNode[];
    } else {
      // Get root categories
      return this.db.prepare(`
        SELECT * FROM v_category_stats
        WHERE parent_id IS NULL
        ${!options.includeInactive ? 'AND is_active = TRUE' : ''}
        ${!options.includeSystem ? 'AND is_system = FALSE' : ''}
        ORDER BY sort_order ASC, name ASC
      `).all() as CategoryNode[];
    }
  }

  /**
   * Get category ancestors (breadcrumb path)
   */
  async getAncestors(categoryId: string): Promise<CategoryNode[]> {
    return this.preparedStatements.get('selectAncestors')!.all(categoryId, categoryId) as CategoryNode[];
  }

  /**
   * Get all descendants of a category
   */
  async getDescendants(
    parentId: string,
    options: CategoryQueryOptions = {}
  ): Promise<CategoryNode[]> {
    const maxDepth = options.maxDepth || 5;
    const isActive = options.includeInactive ? undefined : true;

    return this.preparedStatements.get('selectDescendants')!.all(
      parentId,
      maxDepth,
      isActive
    ) as CategoryNode[];
  }

  /**
   * Reorder categories within the same parent
   */
  async reorder(parentId: string | null, categoryIds: string[]): Promise<void> {
    const transaction = this.db.transaction(() => {
      // Verify all categories belong to the same parent
      const categories = categoryIds.map(id => {
        const cat = this.preparedStatements.get('selectById')!.get(id) as any;
        if (!cat) {
          throw new AppError(ErrorCode.RESOURCE_NOT_FOUND, `Category ${id} not found`);
        }
        if (cat.parent_id !== parentId) {
          throw new AppError(
            ErrorCode.VALIDATION_ERROR,
            `Category ${id} does not belong to the specified parent`
          );
        }
        return cat;
      });

      // Update sort orders
      categoryIds.forEach((id, index) => {
        this.preparedStatements.get('updateSortOrder')!.run(index, id);
      });
    });

    transaction();
  }

  /**
   * Move category to a new parent
   */
  async move(categoryId: string, newParentId: string | null): Promise<CategoryNode> {
    const transaction = this.db.transaction(() => {
      const category = this.preparedStatements.get('selectById')!.get(categoryId) as any;
      if (!category) {
        throw new AppError(ErrorCode.RESOURCE_NOT_FOUND, 'Category not found');
      }

      if (category.is_system) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 'Cannot move system category');
      }

      let newLevel = 0;
      if (newParentId) {
        if (newParentId === categoryId) {
          throw new AppError(ErrorCode.VALIDATION_ERROR, 'Category cannot be its own parent');
        }

        const newParent = this.preparedStatements.get('selectById')!.get(newParentId) as any;
        if (!newParent) {
          throw new AppError(ErrorCode.VALIDATION_ERROR, 'New parent category not found');
        }

        // Check for circular reference
        if (this.wouldCreateCircularReference(categoryId, newParentId)) {
          throw new AppError(ErrorCode.VALIDATION_ERROR, 'Move would create circular reference');
        }

        newLevel = newParent.level + 1;
        if (newLevel > 5) {
          throw new AppError(ErrorCode.VALIDATION_ERROR, 'Move would exceed maximum depth');
        }
      }

      // Move category
      this.preparedStatements.get('moveCategory')!.run(newParentId, newLevel, categoryId);

      // Update levels for all descendants
      this.updateSubtreeLevels(categoryId, newLevel);

      return this.preparedStatements.get('selectById')!.get(categoryId) as CategoryNode;
    });

    return transaction();
  }

  /**
   * Bulk operations on categories
   */
  async bulkOperation(operation: BulkCategoryOperation): Promise<BulkOperationResult> {
    const startTime = Date.now();
    const transactionId = uuidv4();
    const result: BulkOperationResult = {
      operation: operation.operation,
      total_items: operation.categories.length,
      successful: 0,
      failed: 0,
      errors: [],
      execution_time: 0,
      transaction_id: transactionId
    };

    const transaction = this.db.transaction(() => {
      for (const item of operation.categories) {
        try {
          switch (operation.operation) {
            case 'create':
              await this.create(item.data as CreateCategory);
              break;
            case 'update':
              if (!item.id) throw new Error('ID required for update operation');
              await this.update(item.id, item.data as UpdateCategory);
              break;
            case 'delete':
              if (!item.id) throw new Error('ID required for delete operation');
              await this.delete(item.id);
              break;
            case 'move':
              if (!item.id || item.target_parent_id === undefined) {
                throw new Error('ID and target_parent_id required for move operation');
              }
              await this.move(item.id, item.target_parent_id);
              break;
            case 'reorder':
              if (!item.id || item.new_sort_order === undefined) {
                throw new Error('ID and new_sort_order required for reorder operation');
              }
              this.preparedStatements.get('updateSortOrder')!.run(item.new_sort_order, item.id);
              break;
            default:
              throw new Error(`Unsupported operation: ${operation.operation}`);
          }
          result.successful++;
        } catch (error) {
          result.failed++;
          result.errors.push({
            item_id: item.id,
            error: error instanceof Error ? error.message : 'Unknown error',
            details: { item }
          });
        }
      }
    });

    try {
      transaction();
    } catch (error) {
      // Transaction failed, all operations rolled back
      result.failed = result.total_items;
      result.successful = 0;
      result.errors = [{
        error: error instanceof Error ? error.message : 'Transaction failed',
        details: { operation }
      }];
    }

    result.execution_time = Date.now() - startTime;
    return result;
  }

  /**
   * Get category analytics
   */
  async getAnalytics(categoryId: string): Promise<CategoryAnalytics | null> {
    const analytics = this.db.prepare(`
      SELECT
        ca.*,
        (
          SELECT GROUP_CONCAT(
            json_object('tag_id', t.id, 'tag_name', t.display_name, 'count', tag_counts.count),
            ','
          )
          FROM (
            SELECT ta.tag_id, COUNT(*) as count
            FROM tag_associations ta
            JOIN kb_entries e ON ta.entry_id = e.id
            WHERE e.category_id = ca.category_id
            GROUP BY ta.tag_id
            ORDER BY count DESC
            LIMIT 10
          ) tag_counts
          JOIN tags t ON tag_counts.tag_id = t.id
        ) as top_tags_json
      FROM category_analytics ca
      WHERE ca.category_id = ?
    `).get(categoryId) as any;

    if (!analytics) return null;

    // Parse top tags JSON
    let topTags = [];
    if (analytics.top_tags_json) {
      try {
        topTags = JSON.parse(`[${analytics.top_tags_json}]`);
      } catch {
        topTags = [];
      }
    }

    return {
      ...analytics,
      top_tags: topTags,
      last_updated: new Date(analytics.last_updated)
    };
  }

  /**
   * Update category analytics
   */
  async updateAnalytics(categoryId: string, analytics: Partial<CategoryAnalytics>): Promise<void> {
    this.preparedStatements.get('updateCategoryAnalytics')!.run(
      categoryId,
      analytics.entry_count || 0,
      analytics.view_count || 0,
      analytics.search_count || 0,
      analytics.success_rate || 0,
      analytics.avg_resolution_time || null
    );
  }

  /**
   * Private helper methods
   */
  private getRootCategories(options: CategoryQueryOptions): CategoryNode[] {
    return this.db.prepare(`
      SELECT * FROM v_category_stats
      WHERE parent_id IS NULL
      ${!options.includeInactive ? 'AND is_active = TRUE' : ''}
      ${!options.includeSystem ? 'AND is_system = FALSE' : ''}
      ORDER BY sort_order ASC, name ASC
    `).all() as CategoryNode[];
  }

  private buildCategoryTrees(categories: CategoryNode[], options: CategoryQueryOptions): CategoryTree[] {
    return categories.map(category => {
      const children = this.getChildren(category.id, options);
      const ancestors = this.getAncestors(category.id);

      return {
        ...category,
        children: this.buildCategoryTrees(children, options),
        path: [...ancestors.map(a => a.name), category.name],
        breadcrumbs: ancestors.map(a => ({
          id: a.id,
          name: a.name,
          slug: a.slug
        }))
      };
    });
  }

  private wouldCreateCircularReference(categoryId: string, newParentId: string): boolean {
    const ancestors = this.getAncestors(newParentId);
    return ancestors.some(ancestor => ancestor.id === categoryId);
  }

  private updateSubtreeLevels(rootId: string, newLevel: number): void {
    // Update the category itself
    this.db.prepare('UPDATE categories SET level = ? WHERE id = ?').run(newLevel, rootId);

    // Update all descendants
    this.db.prepare(`
      WITH RECURSIVE descendants AS (
        SELECT id, level
        FROM categories
        WHERE parent_id = ?

        UNION ALL

        SELECT c.id, d.level + 1
        FROM categories c
        JOIN descendants d ON c.parent_id = d.id
      )
      UPDATE categories SET level = (
        SELECT level FROM descendants WHERE descendants.id = categories.id
      )
      WHERE id IN (SELECT id FROM descendants)
    `).run(rootId);
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.preparedStatements.forEach(stmt => {
      try {
        stmt.finalize();
      } catch (error) {
        console.warn('Error finalizing statement:', error);
      }
    });
    this.preparedStatements.clear();
  }
}

export default CategoryRepository;