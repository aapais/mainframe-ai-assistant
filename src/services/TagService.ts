/**
 * Tag Service
 * High-level service for tag management with caching, validation, and analytics
 */

import { EventEmitter } from 'events';
import { TagRepository, TagQueryOptions, TagSearchOptions, TagAssociationOptions } from '../database/repositories/TagRepository';
import { CacheService } from './CacheService';
import {
  Tag,
  CreateTag,
  UpdateTag,
  TagAssociation,
  BulkTagOperation,
  BulkOperationResult,
  TagAnalytics,
  HierarchicalSchemaValidator
} from '../database/schemas/HierarchicalCategories.schema';
import { AppError, ErrorCode } from '../core/errors/AppError';

export interface TagServiceConfig {
  cacheEnabled?: boolean;
  cacheTTL?: number;
  suggestionCacheTTL?: number;
  analyticsEnabled?: boolean;
  maxTagsPerEntry?: number;
  enableAutoSuggestions?: boolean;
}

export class TagService extends EventEmitter {
  private tagRepository: TagRepository;
  private cacheService?: CacheService;
  private config: Required<TagServiceConfig>;

  constructor(
    tagRepository: TagRepository,
    cacheService?: CacheService,
    config: TagServiceConfig = {}
  ) {
    super();

    this.tagRepository = tagRepository;
    this.cacheService = cacheService;
    this.config = {
      cacheEnabled: config.cacheEnabled ?? true,
      cacheTTL: config.cacheTTL ?? 300, // 5 minutes
      suggestionCacheTTL: config.suggestionCacheTTL ?? 60, // 1 minute
      analyticsEnabled: config.analyticsEnabled ?? true,
      maxTagsPerEntry: config.maxTagsPerEntry ?? 20,
      enableAutoSuggestions: config.enableAutoSuggestions ?? true,
    };
  }

  /**
   * Create a new tag
   */
  async createTag(data: CreateTag, userId?: string): Promise<Tag> {
    try {
      // Validate data
      const validatedData = HierarchicalSchemaValidator.validateCreateTag(data);

      // Create tag
      const tag = await this.tagRepository.create(validatedData, userId);

      // Clear relevant cache entries
      if (this.config.cacheEnabled && this.cacheService) {
        await this.invalidateTagListCache();
        await this.cacheService.delete(`tag:${tag.id}`);
        await this.cacheService.deletePattern('tag:search:*');
        await this.cacheService.deletePattern('tag:suggestions:*');
      }

      // Emit event
      this.emit('tag:created', { tag, userId });

      return tag;
    } catch (error) {
      this.emit('tag:error', { action: 'create', error, data, userId });
      throw error;
    }
  }

  /**
   * Update an existing tag
   */
  async updateTag(id: string, updates: UpdateTag, userId?: string): Promise<Tag> {
    try {
      // Get existing tag for validation
      const existing = await this.tagRepository.findById(id);
      if (!existing) {
        throw new AppError(ErrorCode.RESOURCE_NOT_FOUND, 'Tag not found');
      }

      // Validate updates
      const validatedUpdates = HierarchicalSchemaValidator.validateUpdateTag(updates);

      // Update tag
      const updatedTag = await this.tagRepository.update(id, validatedUpdates, userId);

      // Clear cache
      if (this.config.cacheEnabled && this.cacheService) {
        await this.invalidateTagListCache();
        await this.cacheService.delete(`tag:${id}`);
        await this.cacheService.deletePattern('tag:search:*');
        await this.cacheService.deletePattern('tag:suggestions:*');

        // If category changed, invalidate category-specific caches
        if (validatedUpdates.category_id !== undefined) {
          if (existing.category_id) {
            await this.cacheService.deletePattern(`tag:category:${existing.category_id}:*`);
          }
          if (validatedUpdates.category_id) {
            await this.cacheService.deletePattern(`tag:category:${validatedUpdates.category_id}:*`);
          }
        }
      }

      // Emit event
      this.emit('tag:updated', { tag: updatedTag, previous: existing, userId });

      return updatedTag;
    } catch (error) {
      this.emit('tag:error', { action: 'update', error, id, updates, userId });
      throw error;
    }
  }

  /**
   * Delete a tag
   */
  async deleteTag(id: string, options?: { force?: boolean }, userId?: string): Promise<void> {
    try {
      // Get tag before deletion for event
      const tag = await this.tagRepository.findById(id);
      if (!tag) {
        throw new AppError(ErrorCode.RESOURCE_NOT_FOUND, 'Tag not found');
      }

      // Delete tag
      await this.tagRepository.delete(id, options);

      // Clear cache
      if (this.config.cacheEnabled && this.cacheService) {
        await this.invalidateTagListCache();
        await this.cacheService.delete(`tag:${id}`);
        await this.cacheService.deletePattern('tag:search:*');
        await this.cacheService.deletePattern('tag:suggestions:*');
        await this.cacheService.delete(`tag:${id}:analytics`);

        // Clear category-specific cache if applicable
        if (tag.category_id) {
          await this.cacheService.deletePattern(`tag:category:${tag.category_id}:*`);
        }
      }

      // Emit event
      this.emit('tag:deleted', { tag, userId });
    } catch (error) {
      this.emit('tag:error', { action: 'delete', error, id, options, userId });
      throw error;
    }
  }

  /**
   * Get tag by ID
   */
  async getTagById(id: string): Promise<Tag | null> {
    const cacheKey = `tag:${id}`;

    try {
      // Check cache first
      if (this.config.cacheEnabled && this.cacheService) {
        const cached = await this.cacheService.get<Tag>(cacheKey);
        if (cached) {
          this.emit('tag:cache_hit', { id });
          return cached;
        }
      }

      // Get from repository
      const tag = await this.tagRepository.findById(id);

      // Cache result
      if (tag && this.config.cacheEnabled && this.cacheService) {
        await this.cacheService.set(cacheKey, tag, this.config.cacheTTL);
      }

      this.emit('tag:retrieved', { tag, id });
      return tag;
    } catch (error) {
      this.emit('tag:error', { action: 'get', error, id });
      throw error;
    }
  }

  /**
   * Get tag by name
   */
  async getTagByName(name: string): Promise<Tag | null> {
    const cacheKey = `tag:name:${name.toLowerCase()}`;

    try {
      // Check cache first
      if (this.config.cacheEnabled && this.cacheService) {
        const cached = await this.cacheService.get<Tag>(cacheKey);
        if (cached) {
          return cached;
        }
      }

      // Get from repository
      const tag = await this.tagRepository.findByName(name);

      // Cache result
      if (tag && this.config.cacheEnabled && this.cacheService) {
        await this.cacheService.set(cacheKey, tag, this.config.cacheTTL);
      }

      return tag;
    } catch (error) {
      this.emit('tag:error', { action: 'get_by_name', error, name });
      throw error;
    }
  }

  /**
   * Search tags
   */
  async searchTags(options: TagSearchOptions): Promise<Tag[]> {
    const cacheKey = `tag:search:${JSON.stringify(options)}`;

    try {
      // Check cache first
      if (this.config.cacheEnabled && this.cacheService) {
        const cached = await this.cacheService.get<Tag[]>(cacheKey);
        if (cached) {
          return cached;
        }
      }

      // Search in repository
      const tags = await this.tagRepository.search(options);

      // Cache result
      if (this.config.cacheEnabled && this.cacheService) {
        await this.cacheService.set(cacheKey, tags, this.config.cacheTTL);
      }

      this.emit('tag:searched', { options, resultCount: tags.length });
      return tags;
    } catch (error) {
      this.emit('tag:error', { action: 'search', error, options });
      throw error;
    }
  }

  /**
   * Get all tags with optional filtering and pagination
   */
  async getAllTags(options: TagQueryOptions = {}): Promise<Tag[]> {
    const cacheKey = `tag:list:${JSON.stringify(options)}`;

    try {
      // Check cache first
      if (this.config.cacheEnabled && this.cacheService) {
        const cached = await this.cacheService.get<Tag[]>(cacheKey);
        if (cached) {
          return cached;
        }
      }

      // Get from repository
      const tags = await this.tagRepository.findAll(options);

      // Cache result
      if (this.config.cacheEnabled && this.cacheService) {
        await this.cacheService.set(cacheKey, tags, this.config.cacheTTL);
      }

      return tags;
    } catch (error) {
      this.emit('tag:error', { action: 'get_all', error, options });
      throw error;
    }
  }

  /**
   * Get tags by category
   */
  async getTagsByCategory(categoryId: string, options: TagQueryOptions = {}): Promise<Tag[]> {
    const cacheKey = `tag:category:${categoryId}:${JSON.stringify(options)}`;

    try {
      // Check cache first
      if (this.config.cacheEnabled && this.cacheService) {
        const cached = await this.cacheService.get<Tag[]>(cacheKey);
        if (cached) {
          return cached;
        }
      }

      // Get from repository
      const tags = await this.tagRepository.findAll({ ...options, categoryId });

      // Cache result
      if (this.config.cacheEnabled && this.cacheService) {
        await this.cacheService.set(cacheKey, tags, this.config.cacheTTL);
      }

      return tags;
    } catch (error) {
      this.emit('tag:error', { action: 'get_by_category', error, categoryId, options });
      throw error;
    }
  }

  /**
   * Associate a tag with a KB entry
   */
  async associateTagWithEntry(
    entryId: string,
    tagId: string,
    options: TagAssociationOptions = {},
    userId?: string
  ): Promise<void> {
    try {
      // Check tag limit
      const existingTags = await this.tagRepository.getEntryTags(entryId);
      if (existingTags.length >= this.config.maxTagsPerEntry) {
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          `Entry cannot have more than ${this.config.maxTagsPerEntry} tags`
        );
      }

      // Create association
      await this.tagRepository.associateWithEntry(entryId, tagId, options, userId);

      // Clear entry-specific cache
      if (this.config.cacheEnabled && this.cacheService) {
        await this.cacheService.delete(`entry:${entryId}:tags`);
        await this.cacheService.delete(`tag:${tagId}:entries`);
        await this.cacheService.delete(`tag:${tagId}:analytics`);
      }

      // Emit event
      this.emit('tag:associated', { entryId, tagId, options, userId });
    } catch (error) {
      this.emit('tag:error', { action: 'associate', error, entryId, tagId, options, userId });
      throw error;
    }
  }

  /**
   * Remove tag association from a KB entry
   */
  async dissociateTagFromEntry(entryId: string, tagId: string, userId?: string): Promise<void> {
    try {
      // Remove association
      await this.tagRepository.dissociateFromEntry(entryId, tagId);

      // Clear entry-specific cache
      if (this.config.cacheEnabled && this.cacheService) {
        await this.cacheService.delete(`entry:${entryId}:tags`);
        await this.cacheService.delete(`tag:${tagId}:entries`);
        await this.cacheService.delete(`tag:${tagId}:analytics`);
      }

      // Emit event
      this.emit('tag:dissociated', { entryId, tagId, userId });
    } catch (error) {
      this.emit('tag:error', { action: 'dissociate', error, entryId, tagId, userId });
      throw error;
    }
  }

  /**
   * Get all tags associated with a KB entry
   */
  async getEntryTags(entryId: string): Promise<(Tag & TagAssociation)[]> {
    const cacheKey = `entry:${entryId}:tags`;

    try {
      // Check cache first
      if (this.config.cacheEnabled && this.cacheService) {
        const cached = await this.cacheService.get<(Tag & TagAssociation)[]>(cacheKey);
        if (cached) {
          return cached;
        }
      }

      // Get from repository
      const tags = await this.tagRepository.getEntryTags(entryId);

      // Cache result
      if (this.config.cacheEnabled && this.cacheService) {
        await this.cacheService.set(cacheKey, tags, this.config.cacheTTL);
      }

      return tags;
    } catch (error) {
      this.emit('tag:error', { action: 'get_entry_tags', error, entryId });
      throw error;
    }
  }

  /**
   * Get all KB entries associated with a tag
   */
  async getTagEntries(tagId: string): Promise<any[]> {
    const cacheKey = `tag:${tagId}:entries`;

    try {
      // Check cache first
      if (this.config.cacheEnabled && this.cacheService) {
        const cached = await this.cacheService.get<any[]>(cacheKey);
        if (cached) {
          return cached;
        }
      }

      // Get from repository
      const entries = await this.tagRepository.getTagEntries(tagId);

      // Cache result
      if (this.config.cacheEnabled && this.cacheService) {
        await this.cacheService.set(cacheKey, entries, this.config.cacheTTL);
      }

      return entries;
    } catch (error) {
      this.emit('tag:error', { action: 'get_tag_entries', error, tagId });
      throw error;
    }
  }

  /**
   * Replace all tags for a KB entry
   */
  async replaceEntryTags(
    entryId: string,
    tagIds: string[],
    options: TagAssociationOptions = {},
    userId?: string
  ): Promise<void> {
    try {
      // Validate tag limit
      if (tagIds.length > this.config.maxTagsPerEntry) {
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          `Entry cannot have more than ${this.config.maxTagsPerEntry} tags`
        );
      }

      // Replace tags
      await this.tagRepository.replaceEntryTags(entryId, tagIds, options, userId);

      // Clear entry-specific cache
      if (this.config.cacheEnabled && this.cacheService) {
        await this.cacheService.delete(`entry:${entryId}:tags`);

        // Clear analytics cache for affected tags
        for (const tagId of tagIds) {
          await this.cacheService.delete(`tag:${tagId}:analytics`);
        }
      }

      // Emit event
      this.emit('tag:entry_tags_replaced', { entryId, tagIds, options, userId });
    } catch (error) {
      this.emit('tag:error', { action: 'replace_entry_tags', error, entryId, tagIds, options, userId });
      throw error;
    }
  }

  /**
   * Get tag suggestions for a query
   */
  async getTagSuggestions(
    query: string,
    options: {
      limit?: number;
      categoryId?: string;
      contextEntryId?: string;
    } = {}
  ): Promise<Tag[]> {
    if (!this.config.enableAutoSuggestions) {
      return [];
    }

    const cacheKey = `tag:suggestions:${query}:${JSON.stringify(options)}`;

    try {
      // Check cache first (shorter TTL for suggestions)
      if (this.config.cacheEnabled && this.cacheService) {
        const cached = await this.cacheService.get<Tag[]>(cacheKey);
        if (cached) {
          return cached;
        }
      }

      // Get suggestions from repository
      const suggestions = await this.tagRepository.getSuggestions(query, options);

      // Cache result with shorter TTL
      if (this.config.cacheEnabled && this.cacheService) {
        await this.cacheService.set(cacheKey, suggestions, this.config.suggestionCacheTTL);
      }

      this.emit('tag:suggestions_generated', { query, options, resultCount: suggestions.length });
      return suggestions;
    } catch (error) {
      this.emit('tag:error', { action: 'get_suggestions', error, query, options });
      throw error;
    }
  }

  /**
   * Get or create tag by name (useful for dynamic tagging)
   */
  async getOrCreateTag(
    name: string,
    options: {
      displayName?: string;
      categoryId?: string;
      color?: string;
      description?: string;
    } = {},
    userId?: string
  ): Promise<Tag> {
    try {
      // Try to find existing tag
      let tag = await this.getTagByName(name);

      if (!tag) {
        // Create new tag
        const createData: CreateTag = {
          name: name.toLowerCase(),
          display_name: options.displayName || name,
          category_id: options.categoryId || null,
          color: options.color,
          description: options.description,
          is_system: false,
          is_suggested: true, // Mark as suggested since it's auto-created
        };

        tag = await this.createTag(createData, userId);
        this.emit('tag:auto_created', { tag, originalName: name, userId });
      }

      return tag;
    } catch (error) {
      this.emit('tag:error', { action: 'get_or_create', error, name, options, userId });
      throw error;
    }
  }

  /**
   * Bulk operations on tags
   */
  async bulkOperation(operation: BulkTagOperation, userId?: string): Promise<BulkOperationResult> {
    try {
      // Validate operation
      const validatedOperation = HierarchicalSchemaValidator.validateBulkTagOperation(operation);

      // Perform bulk operation
      const result = await this.tagRepository.bulkOperation(validatedOperation);

      // Clear relevant cache on successful operations
      if (result.successful > 0 && this.config.cacheEnabled && this.cacheService) {
        await this.invalidateAllCache();
      }

      // Emit event
      this.emit('tag:bulk_operation', { operation: validatedOperation, result, userId });

      return result;
    } catch (error) {
      this.emit('tag:error', { action: 'bulk_operation', error, operation, userId });
      throw error;
    }
  }

  /**
   * Get tag analytics
   */
  async getTagAnalytics(tagId: string): Promise<TagAnalytics | null> {
    if (!this.config.analyticsEnabled) {
      return null;
    }

    const cacheKey = `tag:${tagId}:analytics`;

    try {
      // Check cache first (shorter TTL for analytics)
      if (this.config.cacheEnabled && this.cacheService) {
        const cached = await this.cacheService.get<TagAnalytics>(cacheKey);
        if (cached) {
          return cached;
        }
      }

      // Get from repository
      const analytics = await this.tagRepository.getAnalytics(tagId);

      // Cache result with shorter TTL
      if (analytics && this.config.cacheEnabled && this.cacheService) {
        await this.cacheService.set(cacheKey, analytics, Math.min(this.config.cacheTTL, 60)); // Max 1 minute for analytics
      }

      return analytics;
    } catch (error) {
      this.emit('tag:error', { action: 'get_analytics', error, tagId });
      throw error;
    }
  }

  /**
   * Update tag analytics
   */
  async updateTagAnalytics(tagId: string, analytics: Partial<TagAnalytics>): Promise<void> {
    if (!this.config.analyticsEnabled) {
      return;
    }

    try {
      // Update analytics
      await this.tagRepository.updateAnalytics(tagId, analytics);

      // Clear analytics cache
      if (this.config.cacheEnabled && this.cacheService) {
        await this.cacheService.delete(`tag:${tagId}:analytics`);
      }

      // Emit event
      this.emit('tag:analytics_updated', { tagId, analytics });
    } catch (error) {
      this.emit('tag:error', { action: 'update_analytics', error, tagId, analytics });
      throw error;
    }
  }

  /**
   * Get most used tags
   */
  async getMostUsedTags(limit: number = 20): Promise<Tag[]> {
    const cacheKey = `tag:most_used:${limit}`;

    try {
      // Check cache first
      if (this.config.cacheEnabled && this.cacheService) {
        const cached = await this.cacheService.get<Tag[]>(cacheKey);
        if (cached) {
          return cached;
        }
      }

      // Get from repository
      const tags = await this.tagRepository.getMostUsed(limit);

      // Cache result
      if (this.config.cacheEnabled && this.cacheService) {
        await this.cacheService.set(cacheKey, tags, this.config.cacheTTL);
      }

      return tags;
    } catch (error) {
      this.emit('tag:error', { action: 'get_most_used', error, limit });
      throw error;
    }
  }

  /**
   * Get trending tags
   */
  async getTrendingTags(days: number = 7, limit: number = 20): Promise<(Tag & { recent_usage: number })[]> {
    const cacheKey = `tag:trending:${days}:${limit}`;

    try {
      // Check cache first
      if (this.config.cacheEnabled && this.cacheService) {
        const cached = await this.cacheService.get<(Tag & { recent_usage: number })[]>(cacheKey);
        if (cached) {
          return cached;
        }
      }

      // Get from repository
      const tags = await this.tagRepository.getTrending(days, limit);

      // Cache result
      if (this.config.cacheEnabled && this.cacheService) {
        await this.cacheService.set(cacheKey, tags, this.config.cacheTTL);
      }

      return tags;
    } catch (error) {
      this.emit('tag:error', { action: 'get_trending', error, days, limit });
      throw error;
    }
  }

  /**
   * Get tag usage statistics
   */
  async getTagStats(): Promise<{
    totalTags: number;
    systemTags: number;
    suggestedTags: number;
    mostUsedTag: { tag: Tag; usage: number } | null;
    averageTagsPerEntry: number;
  }> {
    const cacheKey = 'tag:stats';

    try {
      // Check cache first
      if (this.config.cacheEnabled && this.cacheService) {
        const cached = await this.cacheService.get<any>(cacheKey);
        if (cached) {
          return cached;
        }
      }

      // Get all tags to calculate stats
      const allTags = await this.getAllTags({ includeSystem: true });
      const mostUsed = await this.getMostUsedTags(1);

      // Calculate average tags per entry (this would need additional query in a real implementation)
      // For now, we'll use a placeholder
      const averageTagsPerEntry = 3.5; // Placeholder

      const stats = {
        totalTags: allTags.length,
        systemTags: allTags.filter(t => t.is_system).length,
        suggestedTags: allTags.filter(t => t.is_suggested).length,
        mostUsedTag: mostUsed.length > 0 ? {
          tag: mostUsed[0],
          usage: mostUsed[0].usage_count
        } : null,
        averageTagsPerEntry
      };

      // Cache result
      if (this.config.cacheEnabled && this.cacheService) {
        await this.cacheService.set(cacheKey, stats, this.config.cacheTTL);
      }

      return stats;
    } catch (error) {
      this.emit('tag:error', { action: 'get_stats', error });
      throw error;
    }
  }

  /**
   * Clean up unused tags (tags with no associations)
   */
  async cleanupUnusedTags(options?: { dryRun?: boolean; excludeSystem?: boolean }): Promise<{
    found: number;
    removed: number;
    tags: Tag[];
  }> {
    try {
      const dryRun = options?.dryRun ?? true;
      const excludeSystem = options?.excludeSystem ?? true;

      // Get all tags
      const allTags = await this.getAllTags({ includeSystem: !excludeSystem });

      // Find unused tags
      const unusedTags: Tag[] = [];

      for (const tag of allTags) {
        if (excludeSystem && tag.is_system) {
          continue;
        }

        const entries = await this.getTagEntries(tag.id);
        if (entries.length === 0) {
          unusedTags.push(tag);
        }
      }

      let removed = 0;

      if (!dryRun) {
        // Delete unused tags
        for (const tag of unusedTags) {
          try {
            await this.deleteTag(tag.id, { force: true });
            removed++;
          } catch (error) {
            this.emit('tag:cleanup_error', { tag, error });
          }
        }
      }

      const result = {
        found: unusedTags.length,
        removed,
        tags: unusedTags
      };

      this.emit('tag:cleanup_completed', result);
      return result;
    } catch (error) {
      this.emit('tag:error', { action: 'cleanup_unused', error, options });
      throw error;
    }
  }

  /**
   * Private helper methods
   */
  private async invalidateTagListCache(): Promise<void> {
    if (!this.cacheService) return;

    const patterns = [
      'tag:list:*',
      'tag:most_used:*',
      'tag:trending:*',
      'tag:stats'
    ];

    for (const pattern of patterns) {
      await this.cacheService.deletePattern(pattern);
    }
  }

  private async invalidateAllCache(): Promise<void> {
    if (!this.cacheService) return;
    await this.cacheService.deletePattern('tag:*');
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.tagRepository.cleanup();
    this.removeAllListeners();
  }
}

export default TagService;