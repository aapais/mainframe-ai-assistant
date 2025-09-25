/**
 * Category Service
 * High-level service for hierarchical category management with caching and validation
 */

import { EventEmitter } from 'events';
import {
  CategoryRepository,
  CategoryQueryOptions,
} from '../database/repositories/CategoryRepository';
import { CacheService } from './CacheService';
import {
  CategoryNode,
  CategoryTree,
  CreateCategory,
  UpdateCategory,
  BulkCategoryOperation,
  BulkOperationResult,
  CategoryAnalytics,
  HierarchicalSchemaValidator,
} from '../database/schemas/HierarchicalCategories.schema';
import { AppError, ErrorCode } from '../core/errors/AppError';

export interface CategoryServiceConfig {
  cacheEnabled?: boolean;
  cacheTTL?: number;
  maxDepth?: number;
  analyticsEnabled?: boolean;
}

export class CategoryService extends EventEmitter {
  private categoryRepository: CategoryRepository;
  private cacheService?: CacheService;
  private config: Required<CategoryServiceConfig>;

  constructor(
    categoryRepository: CategoryRepository,
    cacheService?: CacheService,
    config: CategoryServiceConfig = {}
  ) {
    super();

    this.categoryRepository = categoryRepository;
    this.cacheService = cacheService;
    this.config = {
      cacheEnabled: config.cacheEnabled ?? true,
      cacheTTL: config.cacheTTL ?? 300, // 5 minutes
      maxDepth: config.maxDepth ?? 5,
      analyticsEnabled: config.analyticsEnabled ?? true,
    };
  }

  /**
   * Create a new category
   */
  async createCategory(data: CreateCategory, userId?: string): Promise<CategoryNode> {
    try {
      // Validate data
      const validatedData = HierarchicalSchemaValidator.validateCreateCategory(data);

      // Additional business validations
      if (validatedData.level && validatedData.level > this.config.maxDepth) {
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          `Category level cannot exceed ${this.config.maxDepth}`
        );
      }

      // Create category
      const category = await this.categoryRepository.create(validatedData, userId);

      // Clear relevant cache entries
      if (this.config.cacheEnabled && this.cacheService) {
        await this.invalidateHierarchyCache();
        await this.cacheService.delete(`category:${category.id}`);
      }

      // Emit event
      this.emit('category:created', { category, userId });

      return category;
    } catch (error) {
      this.emit('category:error', { action: 'create', error, data, userId });
      throw error;
    }
  }

  /**
   * Update an existing category
   */
  async updateCategory(
    id: string,
    updates: UpdateCategory,
    userId?: string
  ): Promise<CategoryNode> {
    try {
      // Get existing category for validation
      const existing = await this.categoryRepository.findById(id);
      if (!existing) {
        throw new AppError(ErrorCode.RESOURCE_NOT_FOUND, 'Category not found');
      }

      // Validate updates
      const validatedUpdates = HierarchicalSchemaValidator.validateUpdateCategory(updates);

      // Update category
      const updatedCategory = await this.categoryRepository.update(id, validatedUpdates, userId);

      // Clear cache
      if (this.config.cacheEnabled && this.cacheService) {
        await this.invalidateHierarchyCache();
        await this.cacheService.delete(`category:${id}`);

        // If parent changed, invalidate old parent's children cache
        if (
          validatedUpdates.parent_id !== undefined &&
          existing.parent_id !== validatedUpdates.parent_id
        ) {
          if (existing.parent_id) {
            await this.cacheService.delete(`category:${existing.parent_id}:children`);
          }
          if (validatedUpdates.parent_id) {
            await this.cacheService.delete(`category:${validatedUpdates.parent_id}:children`);
          }
        }
      }

      // Emit event
      this.emit('category:updated', { category: updatedCategory, previous: existing, userId });

      return updatedCategory;
    } catch (error) {
      this.emit('category:error', { action: 'update', error, id, updates, userId });
      throw error;
    }
  }

  /**
   * Delete a category
   */
  async deleteCategory(id: string, options?: { force?: boolean }, userId?: string): Promise<void> {
    try {
      // Get category before deletion for event
      const category = await this.categoryRepository.findById(id);
      if (!category) {
        throw new AppError(ErrorCode.RESOURCE_NOT_FOUND, 'Category not found');
      }

      // Delete category
      await this.categoryRepository.delete(id, options);

      // Clear cache
      if (this.config.cacheEnabled && this.cacheService) {
        await this.invalidateHierarchyCache();
        await this.cacheService.delete(`category:${id}`);

        // Clear parent's children cache
        if (category.parent_id) {
          await this.cacheService.delete(`category:${category.parent_id}:children`);
        }
      }

      // Emit event
      this.emit('category:deleted', { category, userId });
    } catch (error) {
      this.emit('category:error', { action: 'delete', error, id, options, userId });
      throw error;
    }
  }

  /**
   * Get category by ID
   */
  async getCategoryById(
    id: string,
    options: CategoryQueryOptions = {}
  ): Promise<CategoryNode | null> {
    const cacheKey = `category:${id}`;

    try {
      // Check cache first
      if (this.config.cacheEnabled && this.cacheService) {
        const cached = await this.cacheService.get<CategoryNode>(cacheKey);
        if (cached) {
          this.emit('category:cache_hit', { id });
          return cached;
        }
      }

      // Get from repository
      const category = await this.categoryRepository.findById(id, options);

      // Cache result
      if (category && this.config.cacheEnabled && this.cacheService) {
        await this.cacheService.set(cacheKey, category, this.config.cacheTTL);
      }

      this.emit('category:retrieved', { category, id });
      return category;
    } catch (error) {
      this.emit('category:error', { action: 'get', error, id, options });
      throw error;
    }
  }

  /**
   * Get category by slug
   */
  async getCategoryBySlug(
    slug: string,
    options: CategoryQueryOptions = {}
  ): Promise<CategoryNode | null> {
    const cacheKey = `category:slug:${slug}`;

    try {
      // Check cache first
      if (this.config.cacheEnabled && this.cacheService) {
        const cached = await this.cacheService.get<CategoryNode>(cacheKey);
        if (cached) {
          return cached;
        }
      }

      // Get from repository
      const category = await this.categoryRepository.findBySlug(slug, options);

      // Cache result
      if (category && this.config.cacheEnabled && this.cacheService) {
        await this.cacheService.set(cacheKey, category, this.config.cacheTTL);
      }

      return category;
    } catch (error) {
      this.emit('category:error', { action: 'get_by_slug', error, slug, options });
      throw error;
    }
  }

  /**
   * Get full category hierarchy
   */
  async getCategoryHierarchy(options: CategoryQueryOptions = {}): Promise<CategoryTree[]> {
    const cacheKey = `category:hierarchy:${JSON.stringify(options)}`;

    try {
      // Check cache first
      if (this.config.cacheEnabled && this.cacheService) {
        const cached = await this.cacheService.get<CategoryTree[]>(cacheKey);
        if (cached) {
          this.emit('category:cache_hit', { key: 'hierarchy' });
          return cached;
        }
      }

      // Get from repository
      const hierarchy = await this.categoryRepository.getHierarchy(options);

      // Cache result
      if (this.config.cacheEnabled && this.cacheService) {
        await this.cacheService.set(cacheKey, hierarchy, this.config.cacheTTL);
      }

      this.emit('category:hierarchy_retrieved', { hierarchy });
      return hierarchy;
    } catch (error) {
      this.emit('category:error', { action: 'get_hierarchy', error, options });
      throw error;
    }
  }

  /**
   * Get category children
   */
  async getCategoryChildren(
    parentId: string | null,
    options: CategoryQueryOptions = {}
  ): Promise<CategoryNode[]> {
    const cacheKey = `category:${parentId || 'root'}:children:${JSON.stringify(options)}`;

    try {
      // Check cache first
      if (this.config.cacheEnabled && this.cacheService) {
        const cached = await this.cacheService.get<CategoryNode[]>(cacheKey);
        if (cached) {
          return cached;
        }
      }

      // Get from repository
      const children = await this.categoryRepository.getChildren(parentId, options);

      // Cache result
      if (this.config.cacheEnabled && this.cacheService) {
        await this.cacheService.set(cacheKey, children, this.config.cacheTTL);
      }

      return children;
    } catch (error) {
      this.emit('category:error', { action: 'get_children', error, parentId, options });
      throw error;
    }
  }

  /**
   * Get category ancestors (breadcrumb path)
   */
  async getCategoryAncestors(categoryId: string): Promise<CategoryNode[]> {
    const cacheKey = `category:${categoryId}:ancestors`;

    try {
      // Check cache first
      if (this.config.cacheEnabled && this.cacheService) {
        const cached = await this.cacheService.get<CategoryNode[]>(cacheKey);
        if (cached) {
          return cached;
        }
      }

      // Get from repository
      const ancestors = await this.categoryRepository.getAncestors(categoryId);

      // Cache result
      if (this.config.cacheEnabled && this.cacheService) {
        await this.cacheService.set(cacheKey, ancestors, this.config.cacheTTL);
      }

      return ancestors;
    } catch (error) {
      this.emit('category:error', { action: 'get_ancestors', error, categoryId });
      throw error;
    }
  }

  /**
   * Get category descendants
   */
  async getCategoryDescendants(
    parentId: string,
    options: CategoryQueryOptions = {}
  ): Promise<CategoryNode[]> {
    const cacheKey = `category:${parentId}:descendants:${JSON.stringify(options)}`;

    try {
      // Check cache first
      if (this.config.cacheEnabled && this.cacheService) {
        const cached = await this.cacheService.get<CategoryNode[]>(cacheKey);
        if (cached) {
          return cached;
        }
      }

      // Get from repository
      const descendants = await this.categoryRepository.getDescendants(parentId, options);

      // Cache result
      if (this.config.cacheEnabled && this.cacheService) {
        await this.cacheService.set(cacheKey, descendants, this.config.cacheTTL);
      }

      return descendants;
    } catch (error) {
      this.emit('category:error', { action: 'get_descendants', error, parentId, options });
      throw error;
    }
  }

  /**
   * Reorder categories
   */
  async reorderCategories(
    parentId: string | null,
    categoryIds: string[],
    userId?: string
  ): Promise<void> {
    try {
      // Validate that all categories belong to the same parent
      for (const id of categoryIds) {
        const category = await this.categoryRepository.findById(id);
        if (!category) {
          throw new AppError(ErrorCode.RESOURCE_NOT_FOUND, `Category ${id} not found`);
        }
        if (category.parent_id !== parentId) {
          throw new AppError(
            ErrorCode.VALIDATION_ERROR,
            `Category ${id} does not belong to the specified parent`
          );
        }
      }

      // Perform reorder
      await this.categoryRepository.reorder(parentId, categoryIds);

      // Clear cache
      if (this.config.cacheEnabled && this.cacheService) {
        await this.invalidateHierarchyCache();
        await this.cacheService.delete(`category:${parentId || 'root'}:children`);
      }

      // Emit event
      this.emit('category:reordered', { parentId, categoryIds, userId });
    } catch (error) {
      this.emit('category:error', { action: 'reorder', error, parentId, categoryIds, userId });
      throw error;
    }
  }

  /**
   * Move category to a new parent
   */
  async moveCategory(
    categoryId: string,
    newParentId: string | null,
    userId?: string
  ): Promise<CategoryNode> {
    try {
      // Get original category for event
      const originalCategory = await this.categoryRepository.findById(categoryId);
      if (!originalCategory) {
        throw new AppError(ErrorCode.RESOURCE_NOT_FOUND, 'Category not found');
      }

      // Perform move
      const movedCategory = await this.categoryRepository.move(categoryId, newParentId);

      // Clear cache extensively due to hierarchy changes
      if (this.config.cacheEnabled && this.cacheService) {
        await this.invalidateHierarchyCache();
        await this.cacheService.delete(`category:${categoryId}`);
        await this.cacheService.delete(`category:${categoryId}:ancestors`);
        await this.cacheService.delete(`category:${categoryId}:descendants`);

        // Clear old and new parent children cache
        if (originalCategory.parent_id) {
          await this.cacheService.delete(`category:${originalCategory.parent_id}:children`);
        }
        if (newParentId) {
          await this.cacheService.delete(`category:${newParentId}:children`);
        }
      }

      // Emit event
      this.emit('category:moved', {
        category: movedCategory,
        originalParentId: originalCategory.parent_id,
        newParentId,
        userId,
      });

      return movedCategory;
    } catch (error) {
      this.emit('category:error', { action: 'move', error, categoryId, newParentId, userId });
      throw error;
    }
  }

  /**
   * Bulk operations on categories
   */
  async bulkOperation(
    operation: BulkCategoryOperation,
    userId?: string
  ): Promise<BulkOperationResult> {
    try {
      // Validate operation
      const validatedOperation =
        HierarchicalSchemaValidator.validateBulkCategoryOperation(operation);

      // Perform bulk operation
      const result = await this.categoryRepository.bulkOperation(validatedOperation);

      // Clear all hierarchy cache on successful bulk operations
      if (result.successful > 0 && this.config.cacheEnabled && this.cacheService) {
        await this.invalidateAllCache();
      }

      // Emit event
      this.emit('category:bulk_operation', { operation: validatedOperation, result, userId });

      return result;
    } catch (error) {
      this.emit('category:error', { action: 'bulk_operation', error, operation, userId });
      throw error;
    }
  }

  /**
   * Get category analytics
   */
  async getCategoryAnalytics(categoryId: string): Promise<CategoryAnalytics | null> {
    if (!this.config.analyticsEnabled) {
      return null;
    }

    const cacheKey = `category:${categoryId}:analytics`;

    try {
      // Check cache first (shorter TTL for analytics)
      if (this.config.cacheEnabled && this.cacheService) {
        const cached = await this.cacheService.get<CategoryAnalytics>(cacheKey);
        if (cached) {
          return cached;
        }
      }

      // Get from repository
      const analytics = await this.categoryRepository.getAnalytics(categoryId);

      // Cache result with shorter TTL
      if (analytics && this.config.cacheEnabled && this.cacheService) {
        await this.cacheService.set(cacheKey, analytics, Math.min(this.config.cacheTTL, 60)); // Max 1 minute for analytics
      }

      return analytics;
    } catch (error) {
      this.emit('category:error', { action: 'get_analytics', error, categoryId });
      throw error;
    }
  }

  /**
   * Update category analytics
   */
  async updateCategoryAnalytics(
    categoryId: string,
    analytics: Partial<CategoryAnalytics>
  ): Promise<void> {
    if (!this.config.analyticsEnabled) {
      return;
    }

    try {
      // Update analytics
      await this.categoryRepository.updateAnalytics(categoryId, analytics);

      // Clear analytics cache
      if (this.config.cacheEnabled && this.cacheService) {
        await this.cacheService.delete(`category:${categoryId}:analytics`);
      }

      // Emit event
      this.emit('category:analytics_updated', { categoryId, analytics });
    } catch (error) {
      this.emit('category:error', { action: 'update_analytics', error, categoryId, analytics });
      throw error;
    }
  }

  /**
   * Get category usage statistics
   */
  async getCategoryStats(): Promise<{
    totalCategories: number;
    activeCategories: number;
    systemCategories: number;
    maxDepth: number;
    rootCategories: number;
  }> {
    const cacheKey = 'category:stats';

    try {
      // Check cache first
      if (this.config.cacheEnabled && this.cacheService) {
        const cached = await this.cacheService.get<any>(cacheKey);
        if (cached) {
          return cached;
        }
      }

      // Get hierarchy to calculate stats
      const hierarchy = await this.getCategoryHierarchy({
        includeInactive: true,
        includeSystem: true,
      });

      const stats = this.calculateHierarchyStats(hierarchy);

      // Cache result
      if (this.config.cacheEnabled && this.cacheService) {
        await this.cacheService.set(cacheKey, stats, this.config.cacheTTL);
      }

      return stats;
    } catch (error) {
      this.emit('category:error', { action: 'get_stats', error });
      throw error;
    }
  }

  /**
   * Search categories
   */
  async searchCategories(
    query: string,
    options: CategoryQueryOptions = {}
  ): Promise<CategoryNode[]> {
    // This is a simple implementation - could be enhanced with FTS in the future
    const allCategories = await this.getCategoryHierarchy(options);
    const flatCategories = this.flattenHierarchy(allCategories);

    const lowerQuery = query.toLowerCase();
    return flatCategories.filter(
      cat =>
        cat.name.toLowerCase().includes(lowerQuery) ||
        (cat.description && cat.description.toLowerCase().includes(lowerQuery)) ||
        cat.slug.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Validate category hierarchy integrity
   */
  async validateHierarchyIntegrity(): Promise<{ valid: boolean; errors: string[] }> {
    try {
      // Get all categories
      const allCategories = await this.getCategoryHierarchy({
        includeInactive: true,
        includeSystem: true,
      });
      const flatCategories = this.flattenHierarchy(allCategories);

      // Use schema validator
      const validation = HierarchicalSchemaValidator.validateCategoryHierarchy(flatCategories);

      this.emit('category:hierarchy_validated', validation);
      return validation;
    } catch (error) {
      this.emit('category:error', { action: 'validate_hierarchy', error });
      throw error;
    }
  }

  /**
   * Private helper methods
   */
  private async invalidateHierarchyCache(): Promise<void> {
    if (!this.cacheService) return;

    const patterns = [
      'category:hierarchy:*',
      'category:*:children:*',
      'category:*:descendants:*',
      'category:*:ancestors',
      'category:stats',
    ];

    for (const pattern of patterns) {
      await this.cacheService.deletePattern(pattern);
    }
  }

  private async invalidateAllCache(): Promise<void> {
    if (!this.cacheService) return;
    await this.cacheService.deletePattern('category:*');
  }

  private flattenHierarchy(categories: CategoryTree[]): CategoryNode[] {
    const flat: CategoryNode[] = [];

    const traverse = (cats: CategoryTree[]) => {
      for (const cat of cats) {
        flat.push(cat);
        if (cat.children.length > 0) {
          traverse(cat.children);
        }
      }
    };

    traverse(categories);
    return flat;
  }

  private calculateHierarchyStats(hierarchy: CategoryTree[]): any {
    let totalCategories = 0;
    let activeCategories = 0;
    let systemCategories = 0;
    let maxDepth = 0;

    const traverse = (cats: CategoryTree[], depth: number = 0) => {
      maxDepth = Math.max(maxDepth, depth);

      for (const cat of cats) {
        totalCategories++;
        if (cat.is_active) activeCategories++;
        if (cat.is_system) systemCategories++;

        if (cat.children.length > 0) {
          traverse(cat.children, depth + 1);
        }
      }
    };

    traverse(hierarchy);

    return {
      totalCategories,
      activeCategories,
      systemCategories,
      maxDepth,
      rootCategories: hierarchy.length,
    };
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.categoryRepository.cleanup();
    this.removeAllListeners();
  }
}

export default CategoryService;
