/**
 * Category Management IPC Handler
 *
 * Handles all hierarchical category operations including CRUD,
 * tree operations, analytics, and bulk operations.
 */

import {
  IPCHandlerFunction,
  BaseIPCRequest,
  BaseIPCResponse,
  IPCErrorCode,
} from '../../../types/ipc';
import {
  CategoryNode,
  CategoryTree,
  BulkOperationResult,
} from '../../../database/schemas/HierarchicalCategories.schema';
import { CategoryService } from '../../../services/CategoryService';
import { CategoryRepository } from '../../../database/repositories/CategoryRepository';
import { DatabaseManager } from '../../../database/DatabaseManager';
import { MultiLayerCacheManager } from '../../../caching/MultiLayerCacheManager';
import { HandlerUtils, HandlerConfigs } from './index';
import { v4 as uuidv4 } from 'uuid';

// Request/Response Types
interface CategoryCreateRequest extends BaseIPCRequest {
  category: {
    name: string;
    description?: string;
    parent_id?: string;
    color?: string;
    icon?: string;
    metadata?: Record<string, any>;
  };
  options?: {
    validateParent?: boolean;
    checkDuplicates?: boolean;
  };
}

interface CategoryCreateResponse extends BaseIPCResponse {
  data: string; // category ID
  metadata: {
    depth: number;
    siblings: number;
    path: string[];
  };
}

interface CategoryUpdateRequest extends BaseIPCRequest {
  id: string;
  updates: Partial<CategoryNode>;
  options?: {
    validateHierarchy?: boolean;
    cascadeChanges?: boolean;
  };
}

interface CategoryGetHierarchyRequest extends BaseIPCRequest {
  parent_id?: string;
  options?: {
    maxDepth?: number;
    includeAnalytics?: boolean;
    includeInactive?: boolean;
  };
}

interface CategoryGetHierarchyResponse extends BaseIPCResponse {
  data: CategoryTree;
  metadata: {
    totalCategories: number;
    maxDepth: number;
    lastModified: string;
  };
}

interface CategoryMoveRequest extends BaseIPCRequest {
  id: string;
  new_parent_id?: string;
  position?: number;
  options?: {
    validateMove?: boolean;
    preserveOrder?: boolean;
  };
}

interface CategoryBulkRequest extends BaseIPCRequest {
  operations: Array<{
    type: 'create' | 'update' | 'delete' | 'move';
    data: any;
  }>;
  options?: {
    stopOnError?: boolean;
    validateAll?: boolean;
    transaction?: boolean;
  };
}

interface CategoryBulkResponse extends BaseIPCResponse {
  data: BulkOperationResult;
  metadata: {
    totalOperations: number;
    successful: number;
    failed: number;
    rollbackPerformed?: boolean;
  };
}

/**
 * Category Service Handler
 *
 * Provides comprehensive category management with hierarchical
 * operations, validation, and performance optimizations.
 */
export class CategoryHandler {
  private categoryService: CategoryService;

  constructor(
    private dbManager: DatabaseManager,
    private cacheManager: MultiLayerCacheManager
  ) {
    const repository = new CategoryRepository(dbManager);
    this.categoryService = new CategoryService(repository, cacheManager);
  }

  /**
   * Create new category
   */
  handleCategoryCreate: IPCHandlerFunction<'category:create'> = async (
    request: CategoryCreateRequest
  ) => {
    const startTime = Date.now();

    try {
      const { category, options = {} } = request;

      // Validate category data
      const validationResult = this.validateCategoryInput(category);
      if (!validationResult.valid) {
        return HandlerUtils.createErrorResponse(
          request.requestId,
          startTime,
          IPCErrorCode.VALIDATION_FAILED,
          validationResult.error || 'Category validation failed'
        );
      }

      // Check for duplicates if requested
      if (options.checkDuplicates) {
        const existing = await this.categoryService.findByName(category.name, category.parent_id);
        if (existing) {
          return HandlerUtils.createErrorResponse(
            request.requestId,
            startTime,
            IPCErrorCode.DUPLICATE_ENTRY,
            `Category with name "${category.name}" already exists in this parent`
          );
        }
      }

      // Validate parent exists if specified
      if (options.validateParent && category.parent_id) {
        const parent = await this.categoryService.getById(category.parent_id);
        if (!parent) {
          return HandlerUtils.createErrorResponse(
            request.requestId,
            startTime,
            IPCErrorCode.VALIDATION_FAILED,
            `Parent category ${category.parent_id} not found`
          );
        }
      }

      // Create category
      const categoryData: CategoryNode = {
        id: uuidv4(),
        name: HandlerUtils.sanitizeString(category.name, 100),
        description: category.description
          ? HandlerUtils.sanitizeString(category.description, 500)
          : undefined,
        parent_id: category.parent_id,
        color: category.color,
        icon: category.icon,
        metadata: category.metadata,
        depth: 0, // Will be calculated by service
        path: '', // Will be calculated by service
        entry_count: 0,
        created_at: new Date(),
        updated_at: new Date(),
        is_active: true,
      };

      const createdId = await this.categoryService.create(categoryData);

      // Get additional metadata for response
      const created = await this.categoryService.getById(createdId);
      const siblings = await this.categoryService.getSiblings(createdId);
      const path = await this.categoryService.getPath(createdId);

      return HandlerUtils.createSuccessResponse(request.requestId, startTime, createdId, {
        depth: created?.depth || 0,
        siblings: siblings.length,
        path: path.map(c => c.name),
      }) as CategoryCreateResponse;
    } catch (error) {
      console.error('Category creation error:', error);
      return HandlerUtils.createErrorResponse(
        request.requestId,
        startTime,
        IPCErrorCode.DATABASE_ERROR,
        `Category creation failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };

  /**
   * Update existing category
   */
  handleCategoryUpdate: IPCHandlerFunction<'category:update'> = async (
    request: CategoryUpdateRequest
  ) => {
    const startTime = Date.now();

    try {
      const { id, updates, options = {} } = request;

      // Validate ID format
      if (!HandlerUtils.isValidUUID(id)) {
        return HandlerUtils.createErrorResponse(
          request.requestId,
          startTime,
          IPCErrorCode.VALIDATION_FAILED,
          'Invalid category ID format'
        );
      }

      // Check category exists
      const existing = await this.categoryService.getById(id);
      if (!existing) {
        return HandlerUtils.createErrorResponse(
          request.requestId,
          startTime,
          IPCErrorCode.ENTRY_NOT_FOUND,
          `Category ${id} not found`
        );
      }

      // Validate updates
      if (updates.name !== undefined) {
        const validation = this.validateCategoryInput({ name: updates.name });
        if (!validation.valid) {
          return HandlerUtils.createErrorResponse(
            request.requestId,
            startTime,
            IPCErrorCode.VALIDATION_FAILED,
            validation.error || 'Category name validation failed'
          );
        }
      }

      // Validate hierarchy if changing parent
      if (options.validateHierarchy && updates.parent_id !== undefined) {
        const hierarchyValid = await this.categoryService.validateMove(id, updates.parent_id);
        if (!hierarchyValid.valid) {
          return HandlerUtils.createErrorResponse(
            request.requestId,
            startTime,
            IPCErrorCode.VALIDATION_FAILED,
            hierarchyValid.error || 'Invalid hierarchy change'
          );
        }
      }

      // Sanitize string updates
      const sanitizedUpdates = { ...updates };
      if (sanitizedUpdates.name) {
        sanitizedUpdates.name = HandlerUtils.sanitizeString(sanitizedUpdates.name, 100);
      }
      if (sanitizedUpdates.description) {
        sanitizedUpdates.description = HandlerUtils.sanitizeString(
          sanitizedUpdates.description,
          500
        );
      }

      // Perform update
      await this.categoryService.update(id, sanitizedUpdates);

      return HandlerUtils.createSuccessResponse(request.requestId, startTime, null, {
        cascadeChanges: options.cascadeChanges || false,
        affectedCategories: options.cascadeChanges ? await this.getCascadeCount(id) : 0,
      });
    } catch (error) {
      console.error('Category update error:', error);
      return HandlerUtils.createErrorResponse(
        request.requestId,
        startTime,
        IPCErrorCode.DATABASE_ERROR,
        `Category update failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };

  /**
   * Get category hierarchy
   */
  handleGetHierarchy: IPCHandlerFunction<'category:hierarchy'> = async (
    request: CategoryGetHierarchyRequest
  ) => {
    const startTime = Date.now();

    try {
      const { parent_id, options = {} } = request;

      // Check cache first
      const cacheKey = HandlerUtils.generateCacheKey('category_hierarchy', parent_id, options);
      const cached = await this.cacheManager.get<CategoryTree>(cacheKey);

      if (cached) {
        return HandlerUtils.createSuccessResponse(request.requestId, startTime, cached, {
          totalCategories: this.countTreeNodes(cached),
          maxDepth: this.getTreeDepth(cached),
          lastModified: 'cached',
          cached: true,
        }) as CategoryGetHierarchyResponse;
      }

      // Get hierarchy from service
      const hierarchy = await this.categoryService.getHierarchy(
        parent_id,
        options.maxDepth,
        options.includeAnalytics,
        !options.includeInactive
      );

      // Cache result
      await this.cacheManager.set(cacheKey, hierarchy, {
        ttl: 300000, // 5 minutes
        layer: 'memory',
        tags: ['category-hierarchy', parent_id ? `parent:${parent_id}` : 'root'],
      });

      // Calculate metadata
      const totalCategories = this.countTreeNodes(hierarchy);
      const maxDepth = this.getTreeDepth(hierarchy);
      const lastModified = new Date().toISOString();

      return HandlerUtils.createSuccessResponse(request.requestId, startTime, hierarchy, {
        totalCategories,
        maxDepth,
        lastModified,
      }) as CategoryGetHierarchyResponse;
    } catch (error) {
      console.error('Get hierarchy error:', error);
      return HandlerUtils.createErrorResponse(
        request.requestId,
        startTime,
        IPCErrorCode.DATABASE_ERROR,
        `Hierarchy retrieval failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };

  /**
   * Move category to new parent
   */
  handleCategoryMove: IPCHandlerFunction<'category:move'> = async (
    request: CategoryMoveRequest
  ) => {
    const startTime = Date.now();

    try {
      const { id, new_parent_id, position, options = {} } = request;

      // Validate ID format
      if (!HandlerUtils.isValidUUID(id)) {
        return HandlerUtils.createErrorResponse(
          request.requestId,
          startTime,
          IPCErrorCode.VALIDATION_FAILED,
          'Invalid category ID format'
        );
      }

      // Validate move if requested
      if (options.validateMove) {
        const validation = await this.categoryService.validateMove(id, new_parent_id);
        if (!validation.valid) {
          return HandlerUtils.createErrorResponse(
            request.requestId,
            startTime,
            IPCErrorCode.VALIDATION_FAILED,
            validation.error || 'Invalid move operation'
          );
        }
      }

      // Perform move
      await this.categoryService.move(id, new_parent_id, position);

      return HandlerUtils.createSuccessResponse(request.requestId, startTime, null, {
        preserveOrder: options.preserveOrder || false,
        affectedCategories: await this.getCascadeCount(id),
      });
    } catch (error) {
      console.error('Category move error:', error);
      return HandlerUtils.createErrorResponse(
        request.requestId,
        startTime,
        IPCErrorCode.DATABASE_ERROR,
        `Category move failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };

  /**
   * Bulk category operations
   */
  handleCategoryBulk: IPCHandlerFunction<'category:bulk'> = async (
    request: CategoryBulkRequest
  ) => {
    const startTime = Date.now();

    try {
      const { operations, options = {} } = request;

      // Validate operations
      if (!operations || operations.length === 0) {
        return HandlerUtils.createErrorResponse(
          request.requestId,
          startTime,
          IPCErrorCode.VALIDATION_FAILED,
          'No operations provided'
        );
      }

      if (operations.length > 100) {
        return HandlerUtils.createErrorResponse(
          request.requestId,
          startTime,
          IPCErrorCode.VALIDATION_FAILED,
          'Too many operations (max 100)'
        );
      }

      // Validate all operations first if requested
      if (options.validateAll) {
        for (const operation of operations) {
          const validation = await this.validateBulkOperation(operation);
          if (!validation.valid) {
            return HandlerUtils.createErrorResponse(
              request.requestId,
              startTime,
              IPCErrorCode.VALIDATION_FAILED,
              `Operation validation failed: ${validation.error}`
            );
          }
        }
      }

      // Execute bulk operations
      const result = await this.categoryService.bulkOperation(operations, {
        transaction: options.transaction !== false,
        stopOnError: options.stopOnError || false,
      });

      return HandlerUtils.createSuccessResponse(request.requestId, startTime, result, {
        totalOperations: operations.length,
        successful: result.results.filter(r => r.success).length,
        failed: result.results.filter(r => !r.success).length,
        rollbackPerformed: !result.success && options.transaction !== false,
      }) as CategoryBulkResponse;
    } catch (error) {
      console.error('Category bulk operation error:', error);
      return HandlerUtils.createErrorResponse(
        request.requestId,
        startTime,
        IPCErrorCode.DATABASE_ERROR,
        `Bulk operation failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };

  /**
   * Delete category
   */
  handleCategoryDelete: IPCHandlerFunction<'category:delete'> = async (
    request: BaseIPCRequest & { id: string; options?: { cascade?: boolean; moveChildren?: string } }
  ) => {
    const startTime = Date.now();

    try {
      const { id, options = {} } = request;

      // Validate ID format
      if (!HandlerUtils.isValidUUID(id)) {
        return HandlerUtils.createErrorResponse(
          request.requestId,
          startTime,
          IPCErrorCode.VALIDATION_FAILED,
          'Invalid category ID format'
        );
      }

      // Check category exists
      const existing = await this.categoryService.getById(id);
      if (!existing) {
        return HandlerUtils.createErrorResponse(
          request.requestId,
          startTime,
          IPCErrorCode.ENTRY_NOT_FOUND,
          `Category ${id} not found`
        );
      }

      // Check for children
      const children = await this.categoryService.getChildren(id);
      if (children.length > 0 && !options.cascade && !options.moveChildren) {
        return HandlerUtils.createErrorResponse(
          request.requestId,
          startTime,
          IPCErrorCode.VALIDATION_FAILED,
          'Category has children. Use cascade or moveChildren option.'
        );
      }

      // Delete with options
      await this.categoryService.delete(id, {
        cascade: options.cascade,
        moveChildrenTo: options.moveChildren,
      });

      return HandlerUtils.createSuccessResponse(request.requestId, startTime, null, {
        childrenAffected: children.length,
        cascadeDelete: options.cascade || false,
      });
    } catch (error) {
      console.error('Category delete error:', error);
      return HandlerUtils.createErrorResponse(
        request.requestId,
        startTime,
        IPCErrorCode.DATABASE_ERROR,
        `Category deletion failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };

  /**
   * Get category analytics
   */
  handleCategoryAnalytics: IPCHandlerFunction<'category:analytics'> = async (
    request: BaseIPCRequest & { id?: string; timeframe?: string }
  ) => {
    const startTime = Date.now();

    try {
      const { id, timeframe = '30d' } = request;

      const analytics = await this.categoryService.getAnalytics(id, timeframe);

      return HandlerUtils.createSuccessResponse(request.requestId, startTime, analytics, {
        timeframe,
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Category analytics error:', error);
      return HandlerUtils.createErrorResponse(
        request.requestId,
        startTime,
        IPCErrorCode.DATABASE_ERROR,
        `Analytics retrieval failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };

  // Private helper methods

  private validateCategoryInput(category: { name: string; description?: string }): {
    valid: boolean;
    error?: string;
  } {
    if (!category.name || category.name.trim().length === 0) {
      return { valid: false, error: 'Category name is required' };
    }

    if (category.name.length > 100) {
      return { valid: false, error: 'Category name must be less than 100 characters' };
    }

    if (category.description && category.description.length > 500) {
      return { valid: false, error: 'Category description must be less than 500 characters' };
    }

    // Check for invalid characters
    if (!/^[a-zA-Z0-9\s\-_().]+$/.test(category.name)) {
      return { valid: false, error: 'Category name contains invalid characters' };
    }

    return { valid: true };
  }

  private async validateBulkOperation(operation: any): Promise<{ valid: boolean; error?: string }> {
    if (!operation.type || !['create', 'update', 'delete', 'move'].includes(operation.type)) {
      return { valid: false, error: 'Invalid operation type' };
    }

    if (!operation.data) {
      return { valid: false, error: 'Operation data is required' };
    }

    switch (operation.type) {
      case 'create':
        return this.validateCategoryInput(operation.data);
      case 'update':
        if (!operation.data.id) {
          return { valid: false, error: 'Update operation requires ID' };
        }
        break;
      case 'delete':
        if (!operation.data.id) {
          return { valid: false, error: 'Delete operation requires ID' };
        }
        break;
      case 'move':
        if (!operation.data.id) {
          return { valid: false, error: 'Move operation requires ID' };
        }
        break;
    }

    return { valid: true };
  }

  private countTreeNodes(tree: CategoryTree): number {
    let count = 0;

    const countRecursive = (node: CategoryNode) => {
      count++;
      if (node.children) {
        node.children.forEach(countRecursive);
      }
    };

    tree.forEach(countRecursive);
    return count;
  }

  private getTreeDepth(tree: CategoryTree): number {
    let maxDepth = 0;

    const getDepthRecursive = (node: CategoryNode, depth: number = 0) => {
      maxDepth = Math.max(maxDepth, depth);
      if (node.children) {
        node.children.forEach(child => getDepthRecursive(child, depth + 1));
      }
    };

    tree.forEach(node => getDepthRecursive(node, 1));
    return maxDepth;
  }

  private async getCascadeCount(categoryId: string): Promise<number> {
    try {
      const descendants = await this.categoryService.getDescendants(categoryId);
      return descendants.length;
    } catch {
      return 0;
    }
  }
}

// Handler configuration with appropriate settings for category operations
export const categoryHandlerConfigs = {
  'category:create': HandlerConfigs.WRITE_OPERATIONS,
  'category:update': HandlerConfigs.WRITE_OPERATIONS,
  'category:hierarchy': HandlerConfigs.READ_HEAVY,
  'category:move': HandlerConfigs.WRITE_OPERATIONS,
  'category:bulk': HandlerConfigs.CRITICAL_OPERATIONS,
  'category:delete': HandlerConfigs.CRITICAL_OPERATIONS,
  'category:analytics': HandlerConfigs.SYSTEM_OPERATIONS,
} as const;
