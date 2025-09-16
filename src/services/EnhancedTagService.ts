/**
 * Enhanced Tag Management Service
 *
 * Advanced tagging system with autocomplete, frequency analysis,
 * tag relationships, and comprehensive tag management operations.
 *
 * Features:
 * - Frequency-based tag suggestions
 * - Tag synonym management
 * - Tag merging and splitting
 * - Tag analytics and trending
 * - Hierarchical tag relationships
 * - Auto-tagging with AI assistance
 * - Tag validation and normalization
 *
 * @author Swarm Architecture Team
 * @version 1.0.0
 */

import { EventEmitter } from 'events';
import { z } from 'zod';

// ===========================
// TAG SCHEMA DEFINITIONS
// ===========================

export const TagSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(50).regex(/^[a-zA-Z0-9-_\s]+$/, 'Invalid tag characters'),
  normalized_name: z.string().min(1).max(50), // Lowercase, trimmed
  slug: z.string().regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  description: z.string().max(200).optional(),
  color: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  category_id: z.string().uuid().optional(), // Associated category
  parent_tag_id: z.string().uuid().optional(), // For hierarchical tags
  usage_count: z.number().int().min(0).default(0),
  last_used: z.date().optional(),
  trending_score: z.number().min(0).default(0),
  is_system: z.boolean().default(false), // System tags cannot be deleted
  is_active: z.boolean().default(true),
  created_at: z.date().optional(),
  updated_at: z.date().optional(),
  metadata: z.record(z.any()).optional(), // Additional tag metadata
});

export type Tag = z.infer<typeof TagSchema>;

export const TagSuggestionSchema = z.object({
  tag: TagSchema,
  score: z.number().min(0).max(100), // Relevance score
  reason: z.enum(['frequency', 'similarity', 'trending', 'ai', 'related', 'category']),
  confidence: z.number().min(0).max(1),
  context: z.string().optional(), // Why this tag was suggested
});

export type TagSuggestion = z.infer<typeof TagSuggestionSchema>;

export const TagRelationshipSchema = z.object({
  id: z.string().uuid(),
  tag_id: z.string().uuid(),
  related_tag_id: z.string().uuid(),
  relationship_type: z.enum(['synonym', 'related', 'parent', 'child', 'alternative']),
  strength: z.number().min(0).max(1), // Relationship strength
  created_at: z.date().optional(),
  created_by: z.string().optional(), // User or 'system' for auto-detected
});

export type TagRelationship = z.infer<typeof TagRelationshipSchema>;

export const TagAnalyticsSchema = z.object({
  tag_id: z.string().uuid(),
  date: z.date(),
  usage_count: z.number().int().min(0),
  new_entries: z.number().int().min(0),
  search_count: z.number().int().min(0),
  success_rate: z.number().min(0).max(1),
  avg_resolution_time: z.number().min(0).optional(),
});

export type TagAnalytics = z.infer<typeof TagAnalyticsSchema>;

export const TagMergeOperationSchema = z.object({
  source_tag_ids: z.array(z.string().uuid()).min(2),
  target_tag_id: z.string().uuid(),
  preserve_relationships: z.boolean().default(true),
  update_entries: z.boolean().default(true),
});

export type TagMergeOperation = z.infer<typeof TagMergeOperationSchema>;

// ===========================
// ENHANCED TAG SERVICE
// ===========================

export interface TagServiceOptions {
  enableAISuggestions?: boolean;
  maxSuggestions?: number;
  minUsageForTrending?: number;
  trendingTimeWindow?: number; // days
  enableTagValidation?: boolean;
  autoNormalize?: boolean;
  enableCaching?: boolean;
  cacheTimeout?: number; // milliseconds
}

export class EnhancedTagService extends EventEmitter {
  private tags: Map<string, Tag> = new Map();
  private tagsByName: Map<string, Tag> = new Map();
  private tagRelationships: Map<string, TagRelationship[]> = new Map();
  private tagAnalytics: Map<string, TagAnalytics[]> = new Map();
  private suggestionCache: Map<string, { suggestions: TagSuggestion[], timestamp: number }> = new Map();
  private options: Required<TagServiceOptions>;

  constructor(options: TagServiceOptions = {}) {
    super();

    this.options = {
      enableAISuggestions: true,
      maxSuggestions: 10,
      minUsageForTrending: 5,
      trendingTimeWindow: 30,
      enableTagValidation: true,
      autoNormalize: true,
      enableCaching: true,
      cacheTimeout: 300000, // 5 minutes
      ...options
    };

    this.initializeSystemTags();
  }

  // ===========================
  // TAG CRUD OPERATIONS
  // ===========================

  /**
   * Create a new tag
   */
  async createTag(tagData: Omit<Tag, 'id' | 'normalized_name' | 'slug' | 'created_at' | 'updated_at'>): Promise<Tag> {
    if (this.options.enableTagValidation) {
      this.validateTagName(tagData.name);
    }

    const normalized = this.options.autoNormalize ? this.normalizeTagName(tagData.name) : tagData.name;
    const slug = this.generateSlug(normalized);

    // Check for duplicates
    if (this.tagsByName.has(normalized)) {
      throw new Error(`Tag with name '${normalized}' already exists`);
    }

    const tag: Tag = {
      ...tagData,
      id: this.generateId(),
      normalized_name: normalized,
      slug,
      created_at: new Date(),
      updated_at: new Date(),
    };

    await this.insertTag(tag);
    this.emit('tagCreated', tag);

    return tag;
  }

  /**
   * Update an existing tag
   */
  async updateTag(id: string, updates: Partial<Tag>): Promise<Tag> {
    const existing = this.tags.get(id);
    if (!existing) {
      throw new Error(`Tag not found: ${id}`);
    }

    if (existing.is_system && (updates.name || updates.normalized_name)) {
      throw new Error('Cannot modify system tag name');
    }

    // Handle name updates
    if (updates.name) {
      if (this.options.enableTagValidation) {
        this.validateTagName(updates.name);
      }

      const normalized = this.options.autoNormalize ?
        this.normalizeTagName(updates.name) : updates.name;

      // Check for duplicates (excluding current tag)
      const existingByName = this.tagsByName.get(normalized);
      if (existingByName && existingByName.id !== id) {
        throw new Error(`Tag with name '${normalized}' already exists`);
      }

      updates.normalized_name = normalized;
      updates.slug = this.generateSlug(normalized);
    }

    const updated: Tag = {
      ...existing,
      ...updates,
      updated_at: new Date(),
    };

    await this.updateTagInStorage(updated);
    this.emit('tagUpdated', updated, existing);

    return updated;
  }

  /**
   * Delete a tag
   */
  async deleteTag(id: string, options: {
    removeFromEntries?: boolean;
    replaceWith?: string;
  } = {}): Promise<void> {
    const tag = this.tags.get(id);
    if (!tag) {
      throw new Error(`Tag not found: ${id}`);
    }

    if (tag.is_system) {
      throw new Error('Cannot delete system tag');
    }

    const { removeFromEntries = true, replaceWith } = options;

    if (removeFromEntries) {
      await this.removeTagFromAllEntries(id, replaceWith);
    }

    await this.deleteTagFromStorage(id);
    this.emit('tagDeleted', tag);
  }

  // ===========================
  // TAG SUGGESTIONS & AUTOCOMPLETE
  // ===========================

  /**
   * Get tag suggestions based on input query
   */
  async getSuggestions(query: string, options: {
    context?: {
      entryText?: string;
      category?: string;
      existingTags?: string[];
    };
    includeAI?: boolean;
    maxResults?: number;
  } = {}): Promise<TagSuggestion[]> {
    const {
      context,
      includeAI = this.options.enableAISuggestions,
      maxResults = this.options.maxSuggestions
    } = options;

    const cacheKey = this.generateSuggestionCacheKey(query, context);

    // Check cache first
    if (this.options.enableCaching) {
      const cached = this.suggestionCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.options.cacheTimeout) {
        return cached.suggestions.slice(0, maxResults);
      }
    }

    const suggestions: TagSuggestion[] = [];
    const normalizedQuery = this.normalizeTagName(query);

    // 1. Exact name matches
    const exactMatches = this.findTagsByName(normalizedQuery, { exact: true });
    exactMatches.forEach(tag => {
      suggestions.push({
        tag,
        score: 100,
        reason: 'frequency',
        confidence: 1.0,
        context: 'Exact name match'
      });
    });

    // 2. Fuzzy name matches
    const fuzzyMatches = this.findTagsByName(normalizedQuery, { fuzzy: true });
    fuzzyMatches.forEach(tag => {
      if (!exactMatches.some(e => e.id === tag.id)) {
        const similarity = this.calculateStringSimilarity(normalizedQuery, tag.normalized_name);
        suggestions.push({
          tag,
          score: Math.round(similarity * 80), // Max 80 for fuzzy
          reason: 'similarity',
          confidence: similarity,
          context: `Similar to "${tag.name}"`
        });
      }
    });

    // 3. Trending tags
    const trendingTags = await this.getTrendingTags(5);
    trendingTags.forEach(tag => {
      if (!suggestions.some(s => s.tag.id === tag.id)) {
        suggestions.push({
          tag,
          score: Math.round(tag.trending_score * 60), // Max 60 for trending
          reason: 'trending',
          confidence: tag.trending_score / 100,
          context: 'Currently trending'
        });
      }
    });

    // 4. Category-related tags
    if (context?.category) {
      const categoryTags = await this.getTagsByCategory(context.category);
      categoryTags.forEach(tag => {
        if (!suggestions.some(s => s.tag.id === tag.id)) {
          suggestions.push({
            tag,
            score: Math.round((tag.usage_count || 0) / 10 + 40), // Base 40 + usage
            reason: 'category',
            confidence: 0.7,
            context: `Common in ${context.category} category`
          });
        }
      });
    }

    // 5. Related tags based on existing tags
    if (context?.existingTags) {
      const relatedTags = await this.getRelatedTags(context.existingTags);
      relatedTags.forEach(({ tag, relationship }) => {
        if (!suggestions.some(s => s.tag.id === tag.id)) {
          const baseScore = relationship.relationship_type === 'synonym' ? 70 : 50;
          suggestions.push({
            tag,
            score: Math.round(baseScore * relationship.strength),
            reason: 'related',
            confidence: relationship.strength,
            context: `Related to existing tags (${relationship.relationship_type})`
          });
        }
      });
    }

    // 6. AI-powered suggestions (if enabled and context available)
    if (includeAI && context?.entryText) {
      try {
        const aiSuggestions = await this.getAISuggestions(context.entryText, normalizedQuery);
        suggestions.push(...aiSuggestions);
      } catch (error) {
        console.warn('AI suggestions failed:', error);
      }
    }

    // Sort by score and remove duplicates
    const uniqueSuggestions = this.deduplicateSuggestions(suggestions);
    uniqueSuggestions.sort((a, b) => b.score - a.score);

    const finalSuggestions = uniqueSuggestions.slice(0, maxResults);

    // Cache results
    if (this.options.enableCaching) {
      this.suggestionCache.set(cacheKey, {
        suggestions: finalSuggestions,
        timestamp: Date.now()
      });
    }

    return finalSuggestions;
  }

  /**
   * Get autocomplete suggestions for tag input
   */
  async getAutocompleteSuggestions(
    input: string,
    excludeTags: string[] = [],
    limit: number = 10
  ): Promise<Tag[]> {
    if (input.length < 2) return [];

    const normalizedInput = this.normalizeTagName(input);
    const suggestions: { tag: Tag; score: number }[] = [];

    Array.from(this.tags.values()).forEach(tag => {
      if (excludeTags.includes(tag.id) || !tag.is_active) return;

      // Calculate relevance score
      let score = 0;

      // Exact start match gets highest score
      if (tag.normalized_name.startsWith(normalizedInput)) {
        score = 100 - tag.normalized_name.length; // Shorter tags score higher
      }
      // Contains match gets lower score
      else if (tag.normalized_name.includes(normalizedInput)) {
        score = 50;
      }
      // No match
      else {
        return;
      }

      // Boost score based on usage frequency
      score += Math.min((tag.usage_count || 0) / 10, 20);

      suggestions.push({ tag, score });
    });

    return suggestions
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(s => s.tag);
  }

  // ===========================
  // TAG ANALYTICS & INSIGHTS
  // ===========================

  /**
   * Get trending tags
   */
  async getTrendingTags(limit: number = 10): Promise<Tag[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.options.trendingTimeWindow);

    return Array.from(this.tags.values())
      .filter(tag =>
        tag.is_active &&
        (tag.usage_count || 0) >= this.options.minUsageForTrending &&
        (!tag.last_used || tag.last_used > cutoffDate)
      )
      .sort((a, b) => (b.trending_score || 0) - (a.trending_score || 0))
      .slice(0, limit);
  }

  /**
   * Get tag usage statistics
   */
  async getTagStats(tagId: string): Promise<{
    usage: TagAnalytics[];
    relationships: TagRelationship[];
    recentEntries: any[]; // Recent entries using this tag
    trending: { score: number; rank: number };
  }> {
    const tag = this.tags.get(tagId);
    if (!tag) {
      throw new Error(`Tag not found: ${tagId}`);
    }

    const usage = this.tagAnalytics.get(tagId) || [];
    const relationships = this.tagRelationships.get(tagId) || [];
    const recentEntries = await this.getRecentEntriesForTag(tagId);
    const trending = await this.getTagTrendingInfo(tagId);

    return { usage, relationships, recentEntries, trending };
  }

  /**
   * Get tag cloud data
   */
  async getTagCloud(options: {
    minUsage?: number;
    maxTags?: number;
    category?: string;
    timeRange?: { from: Date; to: Date };
  } = {}): Promise<Array<{ tag: Tag; weight: number }>> {
    const {
      minUsage = 1,
      maxTags = 50,
      category,
      timeRange
    } = options;

    let tags = Array.from(this.tags.values()).filter(tag =>
      tag.is_active &&
      (tag.usage_count || 0) >= minUsage
    );

    // Filter by category if specified
    if (category) {
      tags = tags.filter(tag => tag.category_id === category);
    }

    // Filter by time range if specified
    if (timeRange) {
      tags = tags.filter(tag =>
        tag.last_used &&
        tag.last_used >= timeRange.from &&
        tag.last_used <= timeRange.to
      );
    }

    // Calculate weights (normalize usage counts)
    const maxUsage = Math.max(...tags.map(t => t.usage_count || 0));
    const minUsageInSet = Math.min(...tags.map(t => t.usage_count || 0));

    return tags
      .map(tag => ({
        tag,
        weight: this.normalizeWeight(tag.usage_count || 0, minUsageInSet, maxUsage)
      }))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, maxTags);
  }

  // ===========================
  // TAG RELATIONSHIPS
  // ===========================

  /**
   * Create tag relationship
   */
  async createTagRelationship(
    tagId: string,
    relatedTagId: string,
    relationshipType: TagRelationship['relationship_type'],
    strength: number = 1.0
  ): Promise<TagRelationship> {
    if (!this.tags.has(tagId) || !this.tags.has(relatedTagId)) {
      throw new Error('One or both tags not found');
    }

    if (tagId === relatedTagId) {
      throw new Error('Cannot create relationship to same tag');
    }

    // Check for existing relationship
    const existing = await this.getTagRelationship(tagId, relatedTagId);
    if (existing) {
      throw new Error('Relationship already exists');
    }

    const relationship: TagRelationship = {
      id: this.generateId(),
      tag_id: tagId,
      related_tag_id: relatedTagId,
      relationship_type: relationshipType,
      strength: Math.min(Math.max(strength, 0), 1),
      created_at: new Date(),
    };

    await this.insertTagRelationship(relationship);

    // Create reverse relationship for bidirectional types
    if (['synonym', 'related'].includes(relationshipType)) {
      const reverseRelationship: TagRelationship = {
        ...relationship,
        id: this.generateId(),
        tag_id: relatedTagId,
        related_tag_id: tagId,
      };
      await this.insertTagRelationship(reverseRelationship);
    }

    this.emit('tagRelationshipCreated', relationship);
    return relationship;
  }

  /**
   * Get related tags
   */
  async getRelatedTags(tagIds: string[]): Promise<Array<{
    tag: Tag;
    relationship: TagRelationship;
  }>> {
    const related: Array<{ tag: Tag; relationship: TagRelationship }> = [];

    for (const tagId of tagIds) {
      const relationships = this.tagRelationships.get(tagId) || [];
      for (const relationship of relationships) {
        const relatedTag = this.tags.get(relationship.related_tag_id);
        if (relatedTag && relatedTag.is_active) {
          related.push({ tag: relatedTag, relationship });
        }
      }
    }

    // Sort by relationship strength and deduplicate
    const uniqueRelated = new Map<string, { tag: Tag; relationship: TagRelationship }>();
    related.forEach(item => {
      const existing = uniqueRelated.get(item.tag.id);
      if (!existing || item.relationship.strength > existing.relationship.strength) {
        uniqueRelated.set(item.tag.id, item);
      }
    });

    return Array.from(uniqueRelated.values())
      .sort((a, b) => b.relationship.strength - a.relationship.strength);
  }

  // ===========================
  // TAG MANAGEMENT OPERATIONS
  // ===========================

  /**
   * Merge multiple tags into one
   */
  async mergeTags(operation: TagMergeOperation): Promise<void> {
    const { source_tag_ids, target_tag_id, preserve_relationships, update_entries } = operation;

    // Validate all tags exist
    const sourceTags = source_tag_ids.map(id => {
      const tag = this.tags.get(id);
      if (!tag) throw new Error(`Source tag not found: ${id}`);
      return tag;
    });

    const targetTag = this.tags.get(target_tag_id);
    if (!targetTag) throw new Error(`Target tag not found: ${target_tag_id}`);

    // Prevent merging system tags
    if (sourceTags.some(tag => tag.is_system) || targetTag.is_system) {
      throw new Error('Cannot merge system tags');
    }

    // Update entries to use target tag
    if (update_entries) {
      for (const sourceTag of sourceTags) {
        await this.replaceTagInEntries(sourceTag.id, target_tag_id);
      }
    }

    // Transfer relationships
    if (preserve_relationships) {
      for (const sourceTag of sourceTags) {
        await this.transferTagRelationships(sourceTag.id, target_tag_id);
      }
    }

    // Update target tag usage statistics
    const totalUsage = sourceTags.reduce((sum, tag) => sum + (tag.usage_count || 0), 0);
    await this.updateTag(target_tag_id, {
      usage_count: (targetTag.usage_count || 0) + totalUsage,
      last_used: new Date(),
    });

    // Delete source tags
    for (const sourceTagId of source_tag_ids) {
      await this.deleteTagFromStorage(sourceTagId);
    }

    this.emit('tagsMerged', operation);
  }

  /**
   * Split tag usage based on criteria
   */
  async splitTag(
    sourceTagId: string,
    splits: Array<{
      name: string;
      criteria: (entryText: string) => boolean;
    }>
  ): Promise<Tag[]> {
    const sourceTag = this.tags.get(sourceTagId);
    if (!sourceTag) {
      throw new Error(`Source tag not found: ${sourceTagId}`);
    }

    const createdTags: Tag[] = [];

    // Create new tags for each split
    for (const split of splits) {
      const newTag = await this.createTag({
        name: split.name,
        description: `Split from ${sourceTag.name}`,
        category_id: sourceTag.category_id,
      });
      createdTags.push(newTag);

      // Apply tag to matching entries
      await this.applyTagByCriteria(newTag.id, split.criteria);
    }

    this.emit('tagSplit', sourceTagId, createdTags);
    return createdTags;
  }

  /**
   * Rename tag
   */
  async renameTag(tagId: string, newName: string): Promise<Tag> {
    return this.updateTag(tagId, { name: newName });
  }

  /**
   * Bulk tag operations
   */
  async bulkTagOperation(
    operation: 'activate' | 'deactivate' | 'delete' | 'update',
    tagIds: string[],
    data?: Partial<Tag>
  ): Promise<{ success: string[]; errors: Array<{ id: string; error: string }> }> {
    const results = { success: [] as string[], errors: [] as Array<{ id: string; error: string }> };

    for (const tagId of tagIds) {
      try {
        switch (operation) {
          case 'activate':
            await this.updateTag(tagId, { is_active: true });
            break;
          case 'deactivate':
            await this.updateTag(tagId, { is_active: false });
            break;
          case 'delete':
            await this.deleteTag(tagId);
            break;
          case 'update':
            if (data) {
              await this.updateTag(tagId, data);
            }
            break;
        }
        results.success.push(tagId);
      } catch (error) {
        results.errors.push({ id: tagId, error: error.message });
      }
    }

    this.emit('bulkTagOperation', operation, results);
    return results;
  }

  // ===========================
  // UTILITY METHODS
  // ===========================

  private initializeSystemTags(): void {
    const systemTags = [
      'error', 'abend', 'failure', 'timeout', 'performance', 'security',
      'configuration', 'network', 'storage', 'memory', 'cpu', 'urgent',
      'critical', 'high-priority', 'resolved', 'workaround', 'temporary-fix'
    ];

    systemTags.forEach(tagName => {
      const tag: Tag = {
        id: this.generateId(),
        name: tagName,
        normalized_name: this.normalizeTagName(tagName),
        slug: this.generateSlug(tagName),
        is_system: true,
        is_active: true,
        usage_count: 0,
        created_at: new Date(),
        updated_at: new Date(),
      };

      this.tags.set(tag.id, tag);
      this.tagsByName.set(tag.normalized_name, tag);
    });
  }

  private validateTagName(name: string): void {
    if (!name || name.trim().length === 0) {
      throw new Error('Tag name cannot be empty');
    }

    if (name.length > 50) {
      throw new Error('Tag name cannot exceed 50 characters');
    }

    if (!/^[a-zA-Z0-9-_\s]+$/.test(name)) {
      throw new Error('Tag name contains invalid characters');
    }
  }

  private normalizeTagName(name: string): string {
    return name.toLowerCase().trim().replace(/\s+/g, '-');
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
    return `tag_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private calculateStringSimilarity(str1: string, str2: string): number {
    // Simple Levenshtein distance-based similarity
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  private normalizeWeight(value: number, min: number, max: number): number {
    if (max === min) return 1;
    return (value - min) / (max - min);
  }

  private generateSuggestionCacheKey(query: string, context: any): string {
    return `${query}-${JSON.stringify(context || {})}`;
  }

  private deduplicateSuggestions(suggestions: TagSuggestion[]): TagSuggestion[] {
    const seen = new Set<string>();
    return suggestions.filter(suggestion => {
      if (seen.has(suggestion.tag.id)) return false;
      seen.add(suggestion.tag.id);
      return true;
    });
  }

  // Abstract methods to be implemented by concrete storage layer
  protected abstract insertTag(tag: Tag): Promise<void>;
  protected abstract updateTagInStorage(tag: Tag): Promise<void>;
  protected abstract deleteTagFromStorage(id: string): Promise<void>;
  protected abstract insertTagRelationship(relationship: TagRelationship): Promise<void>;
  protected abstract removeTagFromAllEntries(tagId: string, replacementTagId?: string): Promise<void>;
  protected abstract replaceTagInEntries(oldTagId: string, newTagId: string): Promise<void>;
  protected abstract transferTagRelationships(fromTagId: string, toTagId: string): Promise<void>;
  protected abstract applyTagByCriteria(tagId: string, criteria: (entryText: string) => boolean): Promise<void>;
  protected abstract getTagsByCategory(categoryId: string): Promise<Tag[]>;
  protected abstract getTagRelationship(tagId1: string, tagId2: string): Promise<TagRelationship | null>;
  protected abstract getRecentEntriesForTag(tagId: string): Promise<any[]>;
  protected abstract getTagTrendingInfo(tagId: string): Promise<{ score: number; rank: number }>;
  protected abstract findTagsByName(query: string, options: { exact?: boolean; fuzzy?: boolean }): Tag[];
  protected abstract getAISuggestions(entryText: string, query: string): Promise<TagSuggestion[]>;
}