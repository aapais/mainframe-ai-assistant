/**
 * Tag Management IPC Handler
 *
 * Handles all tag operations including CRUD, associations,
 * suggestions, analytics, and bulk operations.
 */

import {
  IPCHandlerFunction,
  BaseIPCRequest,
  BaseIPCResponse,
  IPCErrorCode,
} from '../../../types/ipc';
import {
  Tag,
  TagAssociation,
  BulkOperationResult,
  AutocompleteSuggestion,
} from '../../../database/schemas/HierarchicalCategories.schema';
import { TagService } from '../../../services/TagService';
import { TagRepository } from '../../../database/repositories/TagRepository';
import { DatabaseManager } from '../../../database/DatabaseManager';
import { MultiLayerCacheManager } from '../../../caching/MultiLayerCacheManager';
import { HandlerUtils, HandlerConfigs } from './index';
import { v4 as uuidv4 } from 'uuid';

// Request/Response Types
interface TagCreateRequest extends BaseIPCRequest {
  tag: {
    name: string;
    description?: string;
    color?: string;
    category?: string;
    metadata?: Record<string, any>;
  };
  options?: {
    checkDuplicates?: boolean;
    autoComplete?: boolean;
  };
}

interface TagCreateResponse extends BaseIPCResponse {
  data: string; // tag ID
  metadata: {
    isNew: boolean;
    suggestions?: string[];
  };
}

interface TagAssociateRequest extends BaseIPCRequest {
  tag_id: string;
  entry_id: string;
  relevance_score?: number;
  confidence_level?: number;
  metadata?: Record<string, any>;
}

interface TagSearchRequest extends BaseIPCRequest {
  query?: string;
  category?: string;
  options?: {
    limit?: number;
    includeAnalytics?: boolean;
    sortBy?: 'usage' | 'name' | 'relevance' | 'created';
    sortOrder?: 'asc' | 'desc';
  };
}

interface TagSearchResponse extends BaseIPCResponse {
  data: Tag[];
  metadata: {
    totalResults: number;
    hasMore: boolean;
    searchTime: number;
  };
}

interface TagSuggestionsRequest extends BaseIPCRequest {
  entry_content: {
    title: string;
    problem: string;
    solution: string;
    category?: string;
  };
  options?: {
    limit?: number;
    confidence_threshold?: number;
    include_auto_generated?: boolean;
  };
}

interface TagSuggestionsResponse extends BaseIPCResponse {
  data: Array<{
    tag: Tag;
    confidence: number;
    reason: string;
    auto_generated?: boolean;
  }>;
  metadata: {
    processed_content_length: number;
    suggestion_time: number;
  };
}

interface TagBulkRequest extends BaseIPCRequest {
  operations: Array<{
    type: 'create' | 'update' | 'delete' | 'associate' | 'dissociate';
    data: any;
  }>;
  options?: {
    stopOnError?: boolean;
    validateAll?: boolean;
    transaction?: boolean;
  };
}

interface TagBulkResponse extends BaseIPCResponse {
  data: BulkOperationResult;
  metadata: {
    totalOperations: number;
    successful: number;
    failed: number;
    rollbackPerformed?: boolean;
  };
}

interface TagAnalyticsRequest extends BaseIPCRequest {
  tag_id?: string;
  timeframe?: string;
  options?: {
    includeUsageTrends?: boolean;
    includeAssociations?: boolean;
  };
}

interface TagAutoCompleteRequest extends BaseIPCRequest {
  query: string;
  context?: {
    entry_category?: string;
    existing_tags?: string[];
  };
  options?: {
    limit?: number;
    include_popular?: boolean;
    fuzzy_matching?: boolean;
  };
}

interface TagAutoCompleteResponse extends BaseIPCResponse {
  data: AutocompleteSuggestion[];
  metadata: {
    query_processing_time: number;
    total_suggestions: number;
  };
}

/**
 * Tag Service Handler
 *
 * Provides comprehensive tag management with intelligent suggestions,
 * auto-completion, and performance optimizations.
 */
export class TagHandler {
  private tagService: TagService;

  constructor(
    private dbManager: DatabaseManager,
    private cacheManager: MultiLayerCacheManager
  ) {
    const repository = new TagRepository(dbManager);
    this.tagService = new TagService(repository, cacheManager);
  }

  /**
   * Create new tag
   */
  handleTagCreate: IPCHandlerFunction<'tag:create'> = async (request: TagCreateRequest) => {
    const startTime = Date.now();

    try {
      const { tag, options = {} } = request;

      // Validate tag data
      const validationResult = this.validateTagInput(tag);
      if (!validationResult.valid) {
        return HandlerUtils.createErrorResponse(
          request.requestId,
          startTime,
          IPCErrorCode.VALIDATION_FAILED,
          validationResult.error || 'Tag validation failed'
        );
      }

      // Check for duplicates if requested
      let existingTag: Tag | null = null;
      if (options.checkDuplicates) {
        existingTag = await this.tagService.getByName(tag.name);
        if (existingTag) {
          return HandlerUtils.createSuccessResponse(request.requestId, startTime, existingTag.id, {
            isNew: false,
            suggestions: [],
          }) as TagCreateResponse;
        }
      }

      // Get auto-complete suggestions if requested
      let suggestions: string[] = [];
      if (options.autoComplete) {
        const autocompleteSuggestions = await this.tagService.getAutocompleteSuggestions(
          tag.name,
          5
        );
        suggestions = autocompleteSuggestions.map(s => s.text);
      }

      // Create tag
      const tagData: Tag = {
        id: uuidv4(),
        name: HandlerUtils.sanitizeString(tag.name.toLowerCase(), 50),
        description: tag.description
          ? HandlerUtils.sanitizeString(tag.description, 200)
          : undefined,
        color: tag.color,
        category: tag.category,
        metadata: tag.metadata,
        usage_count: 0,
        relevance_score: 1.0,
        created_at: new Date(),
        updated_at: new Date(),
        is_active: true,
      };

      const createdId = await this.tagService.create(tagData);

      return HandlerUtils.createSuccessResponse(request.requestId, startTime, createdId, {
        isNew: true,
        suggestions,
      }) as TagCreateResponse;
    } catch (error) {
      console.error('Tag creation error:', error);
      return HandlerUtils.createErrorResponse(
        request.requestId,
        startTime,
        IPCErrorCode.DATABASE_ERROR,
        `Tag creation failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };

  /**
   * Associate tag with KB entry
   */
  handleTagAssociate: IPCHandlerFunction<'tag:associate'> = async (
    request: TagAssociateRequest
  ) => {
    const startTime = Date.now();

    try {
      const { tag_id, entry_id, relevance_score = 1.0, confidence_level = 1.0, metadata } = request;

      // Validate IDs
      if (!HandlerUtils.isValidUUID(tag_id) || !HandlerUtils.isValidUUID(entry_id)) {
        return HandlerUtils.createErrorResponse(
          request.requestId,
          startTime,
          IPCErrorCode.VALIDATION_FAILED,
          'Invalid tag or entry ID format'
        );
      }

      // Validate scores
      if (
        relevance_score < 0 ||
        relevance_score > 1 ||
        confidence_level < 0 ||
        confidence_level > 1
      ) {
        return HandlerUtils.createErrorResponse(
          request.requestId,
          startTime,
          IPCErrorCode.VALIDATION_FAILED,
          'Relevance and confidence scores must be between 0 and 1'
        );
      }

      // Create association
      const association: TagAssociation = {
        tag_id,
        entry_id,
        relevance_score,
        confidence_level,
        metadata,
        created_at: new Date(),
        created_by: 'system',
      };

      await this.tagService.associateWithEntry(tag_id, entry_id, association);

      return HandlerUtils.createSuccessResponse(request.requestId, startTime, null, {
        association_created: true,
        relevance_score,
        confidence_level,
      });
    } catch (error) {
      console.error('Tag association error:', error);
      return HandlerUtils.createErrorResponse(
        request.requestId,
        startTime,
        IPCErrorCode.DATABASE_ERROR,
        `Tag association failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };

  /**
   * Search tags
   */
  handleTagSearch: IPCHandlerFunction<'tag:search'> = async (request: TagSearchRequest) => {
    const startTime = Date.now();

    try {
      const { query, category, options = {} } = request;

      // Check cache first for frequently used searches
      const cacheKey = HandlerUtils.generateCacheKey('tag_search', query, category, options);
      const cached = await this.cacheManager.get<Tag[]>(cacheKey);

      if (cached) {
        return HandlerUtils.createSuccessResponse(request.requestId, startTime, cached, {
          totalResults: cached.length,
          hasMore: false,
          searchTime: Date.now() - startTime,
          cached: true,
        }) as TagSearchResponse;
      }

      // Perform search
      const searchStartTime = Date.now();
      const tags = await this.tagService.search({
        query,
        category,
        limit: options.limit || 50,
        includeAnalytics: options.includeAnalytics,
        sortBy: options.sortBy || 'usage',
        sortOrder: options.sortOrder || 'desc',
      });

      const searchTime = Date.now() - searchStartTime;

      // Cache results for popular searches
      if (!query || query.length <= 3) {
        await this.cacheManager.set(cacheKey, tags, {
          ttl: 300000, // 5 minutes
          layer: 'memory',
          tags: ['tag-search', category ? `category:${category}` : 'all-categories'],
        });
      }

      return HandlerUtils.createSuccessResponse(request.requestId, startTime, tags, {
        totalResults: tags.length,
        hasMore: tags.length === (options.limit || 50),
        searchTime,
      }) as TagSearchResponse;
    } catch (error) {
      console.error('Tag search error:', error);
      return HandlerUtils.createErrorResponse(
        request.requestId,
        startTime,
        IPCErrorCode.DATABASE_ERROR,
        `Tag search failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };

  /**
   * Get tag suggestions for content
   */
  handleTagSuggestions: IPCHandlerFunction<'tag:suggestions'> = async (
    request: TagSuggestionsRequest
  ) => {
    const startTime = Date.now();

    try {
      const { entry_content, options = {} } = request;

      // Validate content
      if (!entry_content.title || !entry_content.problem || !entry_content.solution) {
        return HandlerUtils.createErrorResponse(
          request.requestId,
          startTime,
          IPCErrorCode.VALIDATION_FAILED,
          'Entry content must include title, problem, and solution'
        );
      }

      const processingStart = Date.now();
      const contentLength =
        entry_content.title.length + entry_content.problem.length + entry_content.solution.length;

      // Get suggestions from service
      const suggestions = await this.tagService.getSuggestionsForContent(
        entry_content,
        options.limit || 10,
        options.confidence_threshold || 0.6
      );

      const processingTime = Date.now() - processingStart;

      // Transform suggestions to include metadata
      const enrichedSuggestions = suggestions.map(suggestion => ({
        tag: suggestion.tag,
        confidence: suggestion.confidence,
        reason: suggestion.reason,
        auto_generated: suggestion.source === 'auto_generated',
      }));

      return HandlerUtils.createSuccessResponse(request.requestId, startTime, enrichedSuggestions, {
        processed_content_length: contentLength,
        suggestion_time: processingTime,
      }) as TagSuggestionsResponse;
    } catch (error) {
      console.error('Tag suggestions error:', error);
      return HandlerUtils.createErrorResponse(
        request.requestId,
        startTime,
        IPCErrorCode.DATABASE_ERROR,
        `Tag suggestions failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };

  /**
   * Auto-complete tag names
   */
  handleTagAutoComplete: IPCHandlerFunction<'tag:autocomplete'> = async (
    request: TagAutoCompleteRequest
  ) => {
    const startTime = Date.now();

    try {
      const { query, context, options = {} } = request;

      // Validate query
      if (!query || query.length === 0) {
        return HandlerUtils.createErrorResponse(
          request.requestId,
          startTime,
          IPCErrorCode.VALIDATION_FAILED,
          'Query is required for autocomplete'
        );
      }

      if (query.length > 50) {
        return HandlerUtils.createErrorResponse(
          request.requestId,
          startTime,
          IPCErrorCode.VALIDATION_FAILED,
          'Query too long (max 50 characters)'
        );
      }

      const queryStart = Date.now();

      // Get autocomplete suggestions
      const suggestions = await this.tagService.getAutocompleteSuggestions(
        HandlerUtils.sanitizeString(query, 50),
        options.limit || 10,
        {
          category: context?.entry_category,
          existingTags: context?.existing_tags,
          includePopular: options.include_popular !== false,
          fuzzyMatching: options.fuzzy_matching !== false,
        }
      );

      const queryTime = Date.now() - queryStart;

      return HandlerUtils.createSuccessResponse(request.requestId, startTime, suggestions, {
        query_processing_time: queryTime,
        total_suggestions: suggestions.length,
      }) as TagAutoCompleteResponse;
    } catch (error) {
      console.error('Tag autocomplete error:', error);
      return HandlerUtils.createErrorResponse(
        request.requestId,
        startTime,
        IPCErrorCode.DATABASE_ERROR,
        `Tag autocomplete failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };

  /**
   * Bulk tag operations
   */
  handleTagBulk: IPCHandlerFunction<'tag:bulk'> = async (request: TagBulkRequest) => {
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

      if (operations.length > 200) {
        return HandlerUtils.createErrorResponse(
          request.requestId,
          startTime,
          IPCErrorCode.VALIDATION_FAILED,
          'Too many operations (max 200)'
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
      const result = await this.tagService.bulkOperation(operations, {
        transaction: options.transaction !== false,
        stopOnError: options.stopOnError || false,
      });

      return HandlerUtils.createSuccessResponse(request.requestId, startTime, result, {
        totalOperations: operations.length,
        successful: result.results.filter(r => r.success).length,
        failed: result.results.filter(r => !r.success).length,
        rollbackPerformed: !result.success && options.transaction !== false,
      }) as TagBulkResponse;
    } catch (error) {
      console.error('Tag bulk operation error:', error);
      return HandlerUtils.createErrorResponse(
        request.requestId,
        startTime,
        IPCErrorCode.DATABASE_ERROR,
        `Bulk operation failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };

  /**
   * Get tag analytics
   */
  handleTagAnalytics: IPCHandlerFunction<'tag:analytics'> = async (
    request: TagAnalyticsRequest
  ) => {
    const startTime = Date.now();

    try {
      const { tag_id, timeframe = '30d', options = {} } = request;

      // Validate tag_id if provided
      if (tag_id && !HandlerUtils.isValidUUID(tag_id)) {
        return HandlerUtils.createErrorResponse(
          request.requestId,
          startTime,
          IPCErrorCode.VALIDATION_FAILED,
          'Invalid tag ID format'
        );
      }

      const analytics = await this.tagService.getAnalytics(tag_id, timeframe, options);

      return HandlerUtils.createSuccessResponse(request.requestId, startTime, analytics, {
        timeframe,
        includeUsageTrends: options.includeUsageTrends || false,
        includeAssociations: options.includeAssociations || false,
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Tag analytics error:', error);
      return HandlerUtils.createErrorResponse(
        request.requestId,
        startTime,
        IPCErrorCode.DATABASE_ERROR,
        `Analytics retrieval failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };

  /**
   * Update tag
   */
  handleTagUpdate: IPCHandlerFunction<'tag:update'> = async (
    request: BaseIPCRequest & { id: string; updates: Partial<Tag> }
  ) => {
    const startTime = Date.now();

    try {
      const { id, updates } = request;

      // Validate ID format
      if (!HandlerUtils.isValidUUID(id)) {
        return HandlerUtils.createErrorResponse(
          request.requestId,
          startTime,
          IPCErrorCode.VALIDATION_FAILED,
          'Invalid tag ID format'
        );
      }

      // Check tag exists
      const existing = await this.tagService.getById(id);
      if (!existing) {
        return HandlerUtils.createErrorResponse(
          request.requestId,
          startTime,
          IPCErrorCode.ENTRY_NOT_FOUND,
          `Tag ${id} not found`
        );
      }

      // Validate updates
      if (updates.name !== undefined) {
        const validation = this.validateTagInput({ name: updates.name });
        if (!validation.valid) {
          return HandlerUtils.createErrorResponse(
            request.requestId,
            startTime,
            IPCErrorCode.VALIDATION_FAILED,
            validation.error || 'Tag name validation failed'
          );
        }
      }

      // Sanitize string updates
      const sanitizedUpdates = { ...updates };
      if (sanitizedUpdates.name) {
        sanitizedUpdates.name = HandlerUtils.sanitizeString(
          sanitizedUpdates.name.toLowerCase(),
          50
        );
      }
      if (sanitizedUpdates.description) {
        sanitizedUpdates.description = HandlerUtils.sanitizeString(
          sanitizedUpdates.description,
          200
        );
      }

      // Perform update
      await this.tagService.update(id, sanitizedUpdates);

      return HandlerUtils.createSuccessResponse(request.requestId, startTime, null, {
        updated: true,
        affectedAssociations: await this.getAssociationCount(id),
      });
    } catch (error) {
      console.error('Tag update error:', error);
      return HandlerUtils.createErrorResponse(
        request.requestId,
        startTime,
        IPCErrorCode.DATABASE_ERROR,
        `Tag update failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };

  /**
   * Delete tag
   */
  handleTagDelete: IPCHandlerFunction<'tag:delete'> = async (
    request: BaseIPCRequest & { id: string; options?: { removeAssociations?: boolean } }
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
          'Invalid tag ID format'
        );
      }

      // Check tag exists
      const existing = await this.tagService.getById(id);
      if (!existing) {
        return HandlerUtils.createErrorResponse(
          request.requestId,
          startTime,
          IPCErrorCode.ENTRY_NOT_FOUND,
          `Tag ${id} not found`
        );
      }

      // Get association count before deletion
      const associationCount = await this.getAssociationCount(id);

      // Delete tag
      await this.tagService.delete(id, {
        removeAssociations: options.removeAssociations !== false,
      });

      return HandlerUtils.createSuccessResponse(request.requestId, startTime, null, {
        associationsRemoved: associationCount,
        removeAssociations: options.removeAssociations !== false,
      });
    } catch (error) {
      console.error('Tag delete error:', error);
      return HandlerUtils.createErrorResponse(
        request.requestId,
        startTime,
        IPCErrorCode.DATABASE_ERROR,
        `Tag deletion failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };

  // Private helper methods

  private validateTagInput(tag: { name: string; description?: string }): {
    valid: boolean;
    error?: string;
  } {
    if (!tag.name || tag.name.trim().length === 0) {
      return { valid: false, error: 'Tag name is required' };
    }

    if (tag.name.length > 50) {
      return { valid: false, error: 'Tag name must be less than 50 characters' };
    }

    if (tag.description && tag.description.length > 200) {
      return { valid: false, error: 'Tag description must be less than 200 characters' };
    }

    // Check for invalid characters
    if (!/^[a-zA-Z0-9\s\-_.()]+$/.test(tag.name)) {
      return { valid: false, error: 'Tag name contains invalid characters' };
    }

    return { valid: true };
  }

  private async validateBulkOperation(operation: any): Promise<{ valid: boolean; error?: string }> {
    if (
      !operation.type ||
      !['create', 'update', 'delete', 'associate', 'dissociate'].includes(operation.type)
    ) {
      return { valid: false, error: 'Invalid operation type' };
    }

    if (!operation.data) {
      return { valid: false, error: 'Operation data is required' };
    }

    switch (operation.type) {
      case 'create':
        return this.validateTagInput(operation.data);
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
      case 'associate':
      case 'dissociate':
        if (!operation.data.tag_id || !operation.data.entry_id) {
          return { valid: false, error: 'Association operations require tag_id and entry_id' };
        }
        break;
    }

    return { valid: true };
  }

  private async getAssociationCount(tagId: string): Promise<number> {
    try {
      const associations = await this.tagService.getAssociations(tagId);
      return associations.length;
    } catch {
      return 0;
    }
  }
}

// Handler configuration with appropriate settings for tag operations
export const tagHandlerConfigs = {
  'tag:create': HandlerConfigs.WRITE_OPERATIONS,
  'tag:associate': HandlerConfigs.WRITE_OPERATIONS,
  'tag:search': HandlerConfigs.READ_HEAVY,
  'tag:suggestions': HandlerConfigs.SEARCH_OPERATIONS,
  'tag:autocomplete': HandlerConfigs.SEARCH_OPERATIONS,
  'tag:bulk': HandlerConfigs.CRITICAL_OPERATIONS,
  'tag:analytics': HandlerConfigs.SYSTEM_OPERATIONS,
  'tag:update': HandlerConfigs.WRITE_OPERATIONS,
  'tag:delete': HandlerConfigs.CRITICAL_OPERATIONS,
} as const;
