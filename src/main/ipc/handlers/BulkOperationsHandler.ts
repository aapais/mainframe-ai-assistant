/**
 * Bulk Operations IPC Handler
 *
 * Handles complex bulk operations across multiple services with
 * comprehensive transaction support, validation, and rollback capabilities.
 */

import {
  IPCHandlerFunction,
  BaseIPCRequest,
  BaseIPCResponse,
  IPCErrorCode
} from '../../../types/ipc';
import {
  BulkOperationResult,
  CategoryNode,
  Tag
} from '../../../database/schemas/HierarchicalCategories.schema';
import { CategoryService } from '../../../services/CategoryService';
import { TagService } from '../../../services/TagService';
import { DatabaseManager } from '../../../database/DatabaseManager';
import { MultiLayerCacheManager } from '../../../caching/MultiLayerCacheManager';
import { HandlerUtils, HandlerConfigs } from './index';
import { v4 as uuidv4 } from 'uuid';

// Request/Response Types
interface BulkOperation {
  id: string;
  type: 'category_create' | 'category_update' | 'category_delete' | 'category_move' |
        'tag_create' | 'tag_update' | 'tag_delete' | 'tag_associate' | 'tag_dissociate' |
        'kb_entry_create' | 'kb_entry_update' | 'kb_entry_delete';
  data: any;
  dependencies?: string[]; // IDs of operations this depends on
  metadata?: Record<string, any>;
}

interface BulkOperationRequest extends BaseIPCRequest {
  operations: BulkOperation[];
  options?: {
    transaction?: boolean;
    stop_on_error?: boolean;
    validate_dependencies?: boolean;
    validate_all_first?: boolean;
    parallel_execution?: boolean;
    batch_size?: number;
    timeout?: number;
  };
}

interface BulkOperationResponse extends BaseIPCResponse {
  data: BulkOperationResult & {
    dependency_graph?: any;
    execution_plan?: any;
  };
  metadata: {
    total_operations: number;
    successful: number;
    failed: number;
    execution_time: number;
    rollback_performed?: boolean;
    parallel_batches?: number;
  };
}

interface BulkValidationRequest extends BaseIPCRequest {
  operations: BulkOperation[];
  options?: {
    check_dependencies?: boolean;
    check_permissions?: boolean;
    dry_run?: boolean;
  };
}

interface BulkValidationResponse extends BaseIPCResponse {
  data: {
    valid: boolean;
    validation_results: Array<{
      operation_id: string;
      valid: boolean;
      errors?: string[];
      warnings?: string[];
    }>;
    dependency_issues?: Array<{
      operation_id: string;
      missing_dependencies: string[];
      circular_dependencies?: string[];
    }>;
  };
}

interface BulkTemplateRequest extends BaseIPCRequest {
  template_type: 'category_hierarchy' | 'tag_migration' | 'kb_import' | 'data_cleanup';
  template_data: any;
  options?: {
    customize_operations?: boolean;
    include_validation?: boolean;
  };
}

interface BulkTemplateResponse extends BaseIPCResponse {
  data: {
    operations: BulkOperation[];
    estimated_time: number;
    risk_assessment: 'low' | 'medium' | 'high';
    recommendations: string[];
  };
}

/**
 * Bulk Operations Handler
 *
 * Provides comprehensive bulk operation capabilities with dependency management,
 * transaction support, and intelligent execution planning.
 */
export class BulkOperationsHandler {
  constructor(
    private dbManager: DatabaseManager,
    private cacheManager: MultiLayerCacheManager,
    private categoryService: CategoryService,
    private tagService: TagService
  ) {}

  /**
   * Execute bulk operations
   */
  handleBulkExecute: IPCHandlerFunction<'bulk:execute'> = async (request: BulkOperationRequest) => {
    const startTime = Date.now();

    try {
      const { operations, options = {} } = request;

      // Validate input
      const inputValidation = this.validateBulkRequest(operations, options);
      if (!inputValidation.valid) {
        return HandlerUtils.createErrorResponse(
          request.requestId,
          startTime,
          IPCErrorCode.VALIDATION_FAILED,
          inputValidation.error || 'Bulk operation validation failed'
        );
      }

      // Validate all operations first if requested
      if (options.validate_all_first) {
        const validationResult = await this.validateAllOperations(operations, options);
        if (!validationResult.valid) {
          return HandlerUtils.createErrorResponse(
            request.requestId,
            startTime,
            IPCErrorCode.VALIDATION_FAILED,
            'Pre-validation failed',
            validationResult
          );
        }
      }

      // Build dependency graph if dependencies exist
      let dependencyGraph: Map<string, string[]> | undefined;
      let executionPlan: string[][] | undefined;

      if (options.validate_dependencies && this.hasDependencies(operations)) {
        const graphResult = this.buildDependencyGraph(operations);
        if (!graphResult.valid) {
          return HandlerUtils.createErrorResponse(
            request.requestId,
            startTime,
            IPCErrorCode.VALIDATION_FAILED,
            'Dependency validation failed',
            graphResult.errors
          );
        }
        dependencyGraph = graphResult.graph;
        executionPlan = graphResult.executionPlan;
      }

      // Execute operations
      const executionStart = Date.now();
      let result: BulkOperationResult;

      if (options.transaction !== false) {
        // Execute in transaction
        result = await this.executeInTransaction(operations, options, executionPlan);
      } else {
        // Execute without transaction
        result = await this.executeOperations(operations, options, executionPlan);
      }

      const executionTime = Date.now() - executionStart;

      // Invalidate relevant caches
      await this.invalidateRelevantCaches(operations);

      // Calculate statistics
      const successful = result.results.filter(r => r.success).length;
      const failed = result.results.filter(r => !r.success).length;

      return HandlerUtils.createSuccessResponse(
        request.requestId,
        startTime,
        {
          ...result,
          dependency_graph: this.serializeDependencyGraph(dependencyGraph),
          execution_plan: executionPlan
        },
        {
          total_operations: operations.length,
          successful,
          failed,
          execution_time: executionTime,
          rollback_performed: !result.success && options.transaction !== false,
          parallel_batches: executionPlan?.length
        }
      ) as BulkOperationResponse;

    } catch (error) {
      console.error('Bulk execution error:', error);
      return HandlerUtils.createErrorResponse(
        request.requestId,
        startTime,
        IPCErrorCode.DATABASE_ERROR,
        `Bulk execution failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };

  /**
   * Validate bulk operations without executing
   */
  handleBulkValidate: IPCHandlerFunction<'bulk:validate'> = async (request: BulkValidationRequest) => {
    const startTime = Date.now();

    try {
      const { operations, options = {} } = request;

      // Basic input validation
      const inputValidation = this.validateBulkRequest(operations, {});
      if (!inputValidation.valid) {
        return HandlerUtils.createErrorResponse(
          request.requestId,
          startTime,
          IPCErrorCode.VALIDATION_FAILED,
          inputValidation.error || 'Input validation failed'
        );
      }

      // Validate each operation
      const validationResults = await this.validateAllOperations(operations, options);

      // Check dependencies if requested
      let dependencyIssues: any[] = [];
      if (options.check_dependencies && this.hasDependencies(operations)) {
        const dependencyResult = this.buildDependencyGraph(operations);
        if (!dependencyResult.valid) {
          dependencyIssues = dependencyResult.errors || [];
        }
      }

      return HandlerUtils.createSuccessResponse(
        request.requestId,
        startTime,
        {
          valid: validationResults.valid && dependencyIssues.length === 0,
          validation_results: validationResults.results,
          dependency_issues: dependencyIssues
        }
      ) as BulkValidationResponse;

    } catch (error) {
      console.error('Bulk validation error:', error);
      return HandlerUtils.createErrorResponse(
        request.requestId,
        startTime,
        IPCErrorCode.DATABASE_ERROR,
        `Bulk validation failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };

  /**
   * Generate bulk operation templates
   */
  handleBulkTemplate: IPCHandlerFunction<'bulk:template'> = async (request: BulkTemplateRequest) => {
    const startTime = Date.now();

    try {
      const { template_type, template_data, options = {} } = request;

      let operations: BulkOperation[];
      let estimatedTime: number;
      let riskAssessment: 'low' | 'medium' | 'high';
      let recommendations: string[];

      switch (template_type) {
        case 'category_hierarchy':
          ({ operations, estimatedTime, riskAssessment, recommendations } =
            await this.generateCategoryHierarchyTemplate(template_data, options));
          break;
        case 'tag_migration':
          ({ operations, estimatedTime, riskAssessment, recommendations } =
            await this.generateTagMigrationTemplate(template_data, options));
          break;
        case 'kb_import':
          ({ operations, estimatedTime, riskAssessment, recommendations } =
            await this.generateKBImportTemplate(template_data, options));
          break;
        case 'data_cleanup':
          ({ operations, estimatedTime, riskAssessment, recommendations } =
            await this.generateDataCleanupTemplate(template_data, options));
          break;
        default:
          return HandlerUtils.createErrorResponse(
            request.requestId,
            startTime,
            IPCErrorCode.VALIDATION_FAILED,
            `Unknown template type: ${template_type}`
          );
      }

      return HandlerUtils.createSuccessResponse(
        request.requestId,
        startTime,
        {
          operations,
          estimated_time: estimatedTime,
          risk_assessment: riskAssessment,
          recommendations
        }
      ) as BulkTemplateResponse;

    } catch (error) {
      console.error('Bulk template error:', error);
      return HandlerUtils.createErrorResponse(
        request.requestId,
        startTime,
        IPCErrorCode.DATABASE_ERROR,
        `Template generation failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };

  // Private helper methods

  private validateBulkRequest(operations: BulkOperation[], options: any): { valid: boolean; error?: string } {
    if (!operations || operations.length === 0) {
      return { valid: false, error: 'No operations provided' };
    }

    if (operations.length > 1000) {
      return { valid: false, error: 'Too many operations (max 1000)' };
    }

    // Check for duplicate operation IDs
    const operationIds = operations.map(op => op.id);
    const uniqueIds = new Set(operationIds);
    if (uniqueIds.size !== operationIds.length) {
      return { valid: false, error: 'Duplicate operation IDs found' };
    }

    // Validate operation types
    const validTypes = [
      'category_create', 'category_update', 'category_delete', 'category_move',
      'tag_create', 'tag_update', 'tag_delete', 'tag_associate', 'tag_dissociate',
      'kb_entry_create', 'kb_entry_update', 'kb_entry_delete'
    ];

    for (const operation of operations) {
      if (!operation.id || !operation.type || !operation.data) {
        return { valid: false, error: 'Invalid operation structure' };
      }

      if (!validTypes.includes(operation.type)) {
        return { valid: false, error: `Invalid operation type: ${operation.type}` };
      }
    }

    return { valid: true };
  }

  private async validateAllOperations(operations: BulkOperation[], options: any): Promise<{
    valid: boolean;
    results: Array<{
      operation_id: string;
      valid: boolean;
      errors?: string[];
      warnings?: string[];
    }>;
  }> {
    const results = [];
    let allValid = true;

    for (const operation of operations) {
      try {
        const validation = await this.validateSingleOperation(operation, options);
        results.push({
          operation_id: operation.id,
          valid: validation.valid,
          errors: validation.errors,
          warnings: validation.warnings
        });

        if (!validation.valid) {
          allValid = false;
        }
      } catch (error) {
        results.push({
          operation_id: operation.id,
          valid: false,
          errors: [`Validation error: ${error instanceof Error ? error.message : String(error)}`]
        });
        allValid = false;
      }
    }

    return { valid: allValid, results };
  }

  private async validateSingleOperation(operation: BulkOperation, options: any): Promise<{
    valid: boolean;
    errors?: string[];
    warnings?: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    switch (operation.type) {
      case 'category_create':
        if (!operation.data.name) {
          errors.push('Category name is required');
        }
        if (operation.data.parent_id) {
          const parent = await this.categoryService.getById(operation.data.parent_id);
          if (!parent) {
            errors.push('Parent category not found');
          }
        }
        break;

      case 'category_update':
        if (!operation.data.id) {
          errors.push('Category ID is required for update');
        } else {
          const existing = await this.categoryService.getById(operation.data.id);
          if (!existing) {
            errors.push('Category not found');
          }
        }
        break;

      case 'tag_create':
        if (!operation.data.name) {
          errors.push('Tag name is required');
        }
        if (operation.data.name && operation.data.name.length > 50) {
          errors.push('Tag name too long (max 50 characters)');
        }
        break;

      case 'tag_associate':
        if (!operation.data.tag_id || !operation.data.entry_id) {
          errors.push('Both tag_id and entry_id are required for association');
        }
        break;

      // Add more validation cases as needed
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  private hasDependencies(operations: BulkOperation[]): boolean {
    return operations.some(op => op.dependencies && op.dependencies.length > 0);
  }

  private buildDependencyGraph(operations: BulkOperation[]): {
    valid: boolean;
    graph?: Map<string, string[]>;
    executionPlan?: string[][];
    errors?: any[];
  } {
    const graph = new Map<string, string[]>();
    const operationIds = new Set(operations.map(op => op.id));
    const errors: any[] = [];

    // Build adjacency list
    operations.forEach(operation => {
      graph.set(operation.id, operation.dependencies || []);

      // Check for missing dependencies
      if (operation.dependencies) {
        const missingDeps = operation.dependencies.filter(dep => !operationIds.has(dep));
        if (missingDeps.length > 0) {
          errors.push({
            operation_id: operation.id,
            missing_dependencies: missingDeps
          });
        }
      }
    });

    // Check for circular dependencies using DFS
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (nodeId: string): boolean => {
      visited.add(nodeId);
      recursionStack.add(nodeId);

      const dependencies = graph.get(nodeId) || [];
      for (const depId of dependencies) {
        if (!visited.has(depId) && hasCycle(depId)) {
          return true;
        } else if (recursionStack.has(depId)) {
          errors.push({
            operation_id: nodeId,
            circular_dependencies: [depId]
          });
          return true;
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    // Check each operation for cycles
    for (const operationId of operationIds) {
      if (!visited.has(operationId)) {
        if (hasCycle(operationId)) {
          break;
        }
      }
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    // Generate execution plan using topological sort
    const executionPlan = this.topologicalSort(graph, operationIds);

    return {
      valid: true,
      graph,
      executionPlan
    };
  }

  private topologicalSort(graph: Map<string, string[]>, allIds: Set<string>): string[][] {
    const inDegree = new Map<string, number>();
    const result: string[][] = [];

    // Initialize in-degrees
    allIds.forEach(id => inDegree.set(id, 0));

    // Calculate in-degrees
    graph.forEach((dependencies, nodeId) => {
      dependencies.forEach(depId => {
        inDegree.set(nodeId, (inDegree.get(nodeId) || 0) + 1);
      });
    });

    // Process nodes in batches
    while (inDegree.size > 0) {
      const currentBatch: string[] = [];

      // Find nodes with in-degree 0
      inDegree.forEach((degree, nodeId) => {
        if (degree === 0) {
          currentBatch.push(nodeId);
        }
      });

      if (currentBatch.length === 0) {
        // This shouldn't happen if we checked for cycles correctly
        break;
      }

      result.push(currentBatch);

      // Remove processed nodes and update in-degrees
      currentBatch.forEach(nodeId => {
        inDegree.delete(nodeId);
        const dependencies = graph.get(nodeId) || [];
        dependencies.forEach(depId => {
          if (inDegree.has(depId)) {
            inDegree.set(depId, (inDegree.get(depId) || 1) - 1);
          }
        });
      });
    }

    return result;
  }

  private async executeInTransaction(
    operations: BulkOperation[],
    options: any,
    executionPlan?: string[][]
  ): Promise<BulkOperationResult> {
    const results = [];
    let success = true;

    try {
      await this.dbManager.transaction(async (db) => {
        if (executionPlan) {
          // Execute in dependency order
          for (const batch of executionPlan) {
            const batchResults = await this.executeBatch(
              operations.filter(op => batch.includes(op.id)),
              options
            );
            results.push(...batchResults.results);

            if (!batchResults.success && options.stop_on_error) {
              success = false;
              throw new Error('Batch execution failed, stopping on error');
            }
          }
        } else {
          // Execute all operations
          const allResults = await this.executeBatch(operations, options);
          results.push(...allResults.results);
          success = allResults.success;
        }
      });

      return {
        success: success,
        results,
        total_operations: operations.length,
        executed_at: new Date(),
        execution_time_ms: 0 // Will be calculated by caller
      };

    } catch (error) {
      console.error('Transaction execution failed:', error);
      return {
        success: false,
        results,
        total_operations: operations.length,
        executed_at: new Date(),
        execution_time_ms: 0,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private async executeOperations(
    operations: BulkOperation[],
    options: any,
    executionPlan?: string[][]
  ): Promise<BulkOperationResult> {
    const results = [];
    let success = true;

    if (executionPlan) {
      // Execute in dependency order
      for (const batch of executionPlan) {
        const batchOperations = operations.filter(op => batch.includes(op.id));
        const batchResults = await this.executeBatch(batchOperations, options);
        results.push(...batchResults.results);

        if (!batchResults.success && options.stop_on_error) {
          success = false;
          break;
        }
      }
    } else {
      // Execute all operations
      const allResults = await this.executeBatch(operations, options);
      results.push(...allResults.results);
      success = allResults.success;
    }

    return {
      success,
      results,
      total_operations: operations.length,
      executed_at: new Date(),
      execution_time_ms: 0 // Will be calculated by caller
    };
  }

  private async executeBatch(operations: BulkOperation[], options: any): Promise<BulkOperationResult> {
    const results = [];
    let batchSuccess = true;

    if (options.parallel_execution && operations.length > 1) {
      // Execute operations in parallel
      const promises = operations.map(operation => this.executeSingleOperation(operation));
      const batchResults = await Promise.allSettled(promises);

      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            operation_id: operations[index].id,
            success: false,
            error: result.reason instanceof Error ? result.reason.message : String(result.reason)
          });
          batchSuccess = false;
        }
      });
    } else {
      // Execute operations sequentially
      for (const operation of operations) {
        try {
          const result = await this.executeSingleOperation(operation);
          results.push(result);

          if (!result.success && options.stop_on_error) {
            batchSuccess = false;
            break;
          }
        } catch (error) {
          const errorResult = {
            operation_id: operation.id,
            success: false,
            error: error instanceof Error ? error.message : String(error)
          };
          results.push(errorResult);
          batchSuccess = false;

          if (options.stop_on_error) {
            break;
          }
        }
      }
    }

    return {
      success: batchSuccess,
      results,
      total_operations: operations.length,
      executed_at: new Date(),
      execution_time_ms: 0
    };
  }

  private async executeSingleOperation(operation: BulkOperation): Promise<any> {
    const startTime = Date.now();

    try {
      let result;

      switch (operation.type) {
        case 'category_create':
          result = await this.categoryService.create(operation.data);
          break;
        case 'category_update':
          result = await this.categoryService.update(operation.data.id, operation.data);
          break;
        case 'category_delete':
          result = await this.categoryService.delete(operation.data.id, operation.data.options);
          break;
        case 'category_move':
          result = await this.categoryService.move(operation.data.id, operation.data.new_parent_id, operation.data.position);
          break;
        case 'tag_create':
          result = await this.tagService.create(operation.data);
          break;
        case 'tag_update':
          result = await this.tagService.update(operation.data.id, operation.data);
          break;
        case 'tag_delete':
          result = await this.tagService.delete(operation.data.id, operation.data.options);
          break;
        case 'tag_associate':
          result = await this.tagService.associateWithEntry(operation.data.tag_id, operation.data.entry_id, operation.data);
          break;
        case 'tag_dissociate':
          result = await this.tagService.dissociateFromEntry(operation.data.tag_id, operation.data.entry_id);
          break;
        default:
          throw new Error(`Unknown operation type: ${operation.type}`);
      }

      return {
        operation_id: operation.id,
        success: true,
        result,
        execution_time: Date.now() - startTime
      };

    } catch (error) {
      return {
        operation_id: operation.id,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        execution_time: Date.now() - startTime
      };
    }
  }

  private serializeDependencyGraph(graph?: Map<string, string[]>): any {
    if (!graph) return undefined;

    const serialized: Record<string, string[]> = {};
    graph.forEach((deps, id) => {
      serialized[id] = deps;
    });
    return serialized;
  }

  private async invalidateRelevantCaches(operations: BulkOperation[]): Promise<void> {
    const tags = new Set<string>();

    operations.forEach(operation => {
      if (operation.type.startsWith('category_')) {
        tags.add('category-hierarchy');
        tags.add('kb-categories');
      }
      if (operation.type.startsWith('tag_')) {
        tags.add('tag-search');
        tags.add('kb-tags');
      }
      if (operation.type.startsWith('kb_entry_')) {
        tags.add('kb-search');
        tags.add('kb-entries');
      }
    });

    if (tags.size > 0) {
      await this.cacheManager.invalidateByTags([...tags]);
    }
  }

  // Template generation methods (simplified implementations)

  private async generateCategoryHierarchyTemplate(data: any, options: any): Promise<{
    operations: BulkOperation[];
    estimatedTime: number;
    riskAssessment: 'low' | 'medium' | 'high';
    recommendations: string[];
  }> {
    const operations: BulkOperation[] = [];

    // This would generate operations based on the hierarchy data
    // For example, creating a mainframe category structure

    return {
      operations,
      estimatedTime: operations.length * 100, // Rough estimate
      riskAssessment: 'low',
      recommendations: ['Validate category names before execution', 'Consider backing up existing categories']
    };
  }

  private async generateTagMigrationTemplate(data: any, options: any): Promise<{
    operations: BulkOperation[];
    estimatedTime: number;
    riskAssessment: 'low' | 'medium' | 'high';
    recommendations: string[];
  }> {
    const operations: BulkOperation[] = [];

    // This would generate tag migration operations

    return {
      operations,
      estimatedTime: operations.length * 50,
      riskAssessment: 'medium',
      recommendations: ['Review tag associations before migration', 'Test with small batch first']
    };
  }

  private async generateKBImportTemplate(data: any, options: any): Promise<{
    operations: BulkOperation[];
    estimatedTime: number;
    riskAssessment: 'low' | 'medium' | 'high';
    recommendations: string[];
  }> {
    const operations: BulkOperation[] = [];

    // This would generate KB entry import operations

    return {
      operations,
      estimatedTime: operations.length * 200,
      riskAssessment: 'high',
      recommendations: ['Validate all KB entries', 'Check for duplicates', 'Use transaction mode']
    };
  }

  private async generateDataCleanupTemplate(data: any, options: any): Promise<{
    operations: BulkOperation[];
    estimatedTime: number;
    riskAssessment: 'low' | 'medium' | 'high';
    recommendations: string[];
  }> {
    const operations: BulkOperation[] = [];

    // This would generate cleanup operations

    return {
      operations,
      estimatedTime: operations.length * 75,
      riskAssessment: 'high',
      recommendations: ['Create backup before cleanup', 'Review cleanup criteria', 'Use dry run first']
    };
  }
}

// Handler configuration
export const bulkOperationsHandlerConfigs = {
  'bulk:execute': {
    ...HandlerConfigs.CRITICAL_OPERATIONS,
    rateLimitConfig: { requests: 2, windowMs: 60000 }, // Very restrictive
    timeout: 300000 // 5 minutes
  },
  'bulk:validate': HandlerConfigs.WRITE_OPERATIONS,
  'bulk:template': HandlerConfigs.SYSTEM_OPERATIONS
} as const;