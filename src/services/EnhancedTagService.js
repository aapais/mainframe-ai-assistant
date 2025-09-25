'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.EnhancedTagService =
  exports.TagMergeOperationSchema =
  exports.TagAnalyticsSchema =
  exports.TagRelationshipSchema =
  exports.TagSuggestionSchema =
  exports.TagSchema =
    void 0;
const events_1 = require('events');
const zod_1 = require('zod');
exports.TagSchema = zod_1.z.object({
  id: zod_1.z.string().uuid(),
  name: zod_1.z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-zA-Z0-9-_\s]+$/, 'Invalid tag characters'),
  normalized_name: zod_1.z.string().min(1).max(50),
  slug: zod_1.z
    .string()
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  description: zod_1.z.string().max(200).optional(),
  color: zod_1.z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .optional(),
  category_id: zod_1.z.string().uuid().optional(),
  parent_tag_id: zod_1.z.string().uuid().optional(),
  usage_count: zod_1.z.number().int().min(0).default(0),
  last_used: zod_1.z.date().optional(),
  trending_score: zod_1.z.number().min(0).default(0),
  is_system: zod_1.z.boolean().default(false),
  is_active: zod_1.z.boolean().default(true),
  created_at: zod_1.z.date().optional(),
  updated_at: zod_1.z.date().optional(),
  metadata: zod_1.z.record(zod_1.z.any()).optional(),
});
exports.TagSuggestionSchema = zod_1.z.object({
  tag: exports.TagSchema,
  score: zod_1.z.number().min(0).max(100),
  reason: zod_1.z.enum(['frequency', 'similarity', 'trending', 'ai', 'related', 'category']),
  confidence: zod_1.z.number().min(0).max(1),
  context: zod_1.z.string().optional(),
});
exports.TagRelationshipSchema = zod_1.z.object({
  id: zod_1.z.string().uuid(),
  tag_id: zod_1.z.string().uuid(),
  related_tag_id: zod_1.z.string().uuid(),
  relationship_type: zod_1.z.enum(['synonym', 'related', 'parent', 'child', 'alternative']),
  strength: zod_1.z.number().min(0).max(1),
  created_at: zod_1.z.date().optional(),
  created_by: zod_1.z.string().optional(),
});
exports.TagAnalyticsSchema = zod_1.z.object({
  tag_id: zod_1.z.string().uuid(),
  date: zod_1.z.date(),
  usage_count: zod_1.z.number().int().min(0),
  new_entries: zod_1.z.number().int().min(0),
  search_count: zod_1.z.number().int().min(0),
  success_rate: zod_1.z.number().min(0).max(1),
  avg_resolution_time: zod_1.z.number().min(0).optional(),
});
exports.TagMergeOperationSchema = zod_1.z.object({
  source_tag_ids: zod_1.z.array(zod_1.z.string().uuid()).min(2),
  target_tag_id: zod_1.z.string().uuid(),
  preserve_relationships: zod_1.z.boolean().default(true),
  update_entries: zod_1.z.boolean().default(true),
});
class EnhancedTagService extends events_1.EventEmitter {
  tags = new Map();
  tagsByName = new Map();
  tagRelationships = new Map();
  tagAnalytics = new Map();
  suggestionCache = new Map();
  options;
  constructor(options = {}) {
    super();
    this.options = {
      enableAISuggestions: true,
      maxSuggestions: 10,
      minUsageForTrending: 5,
      trendingTimeWindow: 30,
      enableTagValidation: true,
      autoNormalize: true,
      enableCaching: true,
      cacheTimeout: 300000,
      ...options,
    };
    this.initializeSystemTags();
  }
  async createTag(tagData) {
    if (this.options.enableTagValidation) {
      this.validateTagName(tagData.name);
    }
    const normalized = this.options.autoNormalize
      ? this.normalizeTagName(tagData.name)
      : tagData.name;
    const slug = this.generateSlug(normalized);
    if (this.tagsByName.has(normalized)) {
      throw new Error(`Tag with name '${normalized}' already exists`);
    }
    const tag = {
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
  async updateTag(id, updates) {
    const existing = this.tags.get(id);
    if (!existing) {
      throw new Error(`Tag not found: ${id}`);
    }
    if (existing.is_system && (updates.name || updates.normalized_name)) {
      throw new Error('Cannot modify system tag name');
    }
    if (updates.name) {
      if (this.options.enableTagValidation) {
        this.validateTagName(updates.name);
      }
      const normalized = this.options.autoNormalize
        ? this.normalizeTagName(updates.name)
        : updates.name;
      const existingByName = this.tagsByName.get(normalized);
      if (existingByName && existingByName.id !== id) {
        throw new Error(`Tag with name '${normalized}' already exists`);
      }
      updates.normalized_name = normalized;
      updates.slug = this.generateSlug(normalized);
    }
    const updated = {
      ...existing,
      ...updates,
      updated_at: new Date(),
    };
    await this.updateTagInStorage(updated);
    this.emit('tagUpdated', updated, existing);
    return updated;
  }
  async deleteTag(id, options = {}) {
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
  async getSuggestions(query, options = {}) {
    const {
      context,
      includeAI = this.options.enableAISuggestions,
      maxResults = this.options.maxSuggestions,
    } = options;
    const cacheKey = this.generateSuggestionCacheKey(query, context);
    if (this.options.enableCaching) {
      const cached = this.suggestionCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.options.cacheTimeout) {
        return cached.suggestions.slice(0, maxResults);
      }
    }
    const suggestions = [];
    const normalizedQuery = this.normalizeTagName(query);
    const exactMatches = this.findTagsByName(normalizedQuery, { exact: true });
    exactMatches.forEach(tag => {
      suggestions.push({
        tag,
        score: 100,
        reason: 'frequency',
        confidence: 1.0,
        context: 'Exact name match',
      });
    });
    const fuzzyMatches = this.findTagsByName(normalizedQuery, { fuzzy: true });
    fuzzyMatches.forEach(tag => {
      if (!exactMatches.some(e => e.id === tag.id)) {
        const similarity = this.calculateStringSimilarity(normalizedQuery, tag.normalized_name);
        suggestions.push({
          tag,
          score: Math.round(similarity * 80),
          reason: 'similarity',
          confidence: similarity,
          context: `Similar to "${tag.name}"`,
        });
      }
    });
    const trendingTags = await this.getTrendingTags(5);
    trendingTags.forEach(tag => {
      if (!suggestions.some(s => s.tag.id === tag.id)) {
        suggestions.push({
          tag,
          score: Math.round(tag.trending_score * 60),
          reason: 'trending',
          confidence: tag.trending_score / 100,
          context: 'Currently trending',
        });
      }
    });
    if (context?.category) {
      const categoryTags = await this.getTagsByCategory(context.category);
      categoryTags.forEach(tag => {
        if (!suggestions.some(s => s.tag.id === tag.id)) {
          suggestions.push({
            tag,
            score: Math.round((tag.usage_count || 0) / 10 + 40),
            reason: 'category',
            confidence: 0.7,
            context: `Common in ${context.category} category`,
          });
        }
      });
    }
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
            context: `Related to existing tags (${relationship.relationship_type})`,
          });
        }
      });
    }
    if (includeAI && context?.entryText) {
      try {
        const aiSuggestions = await this.getAISuggestions(context.entryText, normalizedQuery);
        suggestions.push(...aiSuggestions);
      } catch (error) {
        console.warn('AI suggestions failed:', error);
      }
    }
    const uniqueSuggestions = this.deduplicateSuggestions(suggestions);
    uniqueSuggestions.sort((a, b) => b.score - a.score);
    const finalSuggestions = uniqueSuggestions.slice(0, maxResults);
    if (this.options.enableCaching) {
      this.suggestionCache.set(cacheKey, {
        suggestions: finalSuggestions,
        timestamp: Date.now(),
      });
    }
    return finalSuggestions;
  }
  async getAutocompleteSuggestions(input, excludeTags = [], limit = 10) {
    if (input.length < 2) return [];
    const normalizedInput = this.normalizeTagName(input);
    const suggestions = [];
    Array.from(this.tags.values()).forEach(tag => {
      if (excludeTags.includes(tag.id) || !tag.is_active) return;
      let score = 0;
      if (tag.normalized_name.startsWith(normalizedInput)) {
        score = 100 - tag.normalized_name.length;
      } else if (tag.normalized_name.includes(normalizedInput)) {
        score = 50;
      } else {
        return;
      }
      score += Math.min((tag.usage_count || 0) / 10, 20);
      suggestions.push({ tag, score });
    });
    return suggestions
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(s => s.tag);
  }
  async getTrendingTags(limit = 10) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.options.trendingTimeWindow);
    return Array.from(this.tags.values())
      .filter(
        tag =>
          tag.is_active &&
          (tag.usage_count || 0) >= this.options.minUsageForTrending &&
          (!tag.last_used || tag.last_used > cutoffDate)
      )
      .sort((a, b) => (b.trending_score || 0) - (a.trending_score || 0))
      .slice(0, limit);
  }
  async getTagStats(tagId) {
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
  async getTagCloud(options = {}) {
    const { minUsage = 1, maxTags = 50, category, timeRange } = options;
    let tags = Array.from(this.tags.values()).filter(
      tag => tag.is_active && (tag.usage_count || 0) >= minUsage
    );
    if (category) {
      tags = tags.filter(tag => tag.category_id === category);
    }
    if (timeRange) {
      tags = tags.filter(
        tag => tag.last_used && tag.last_used >= timeRange.from && tag.last_used <= timeRange.to
      );
    }
    const maxUsage = Math.max(...tags.map(t => t.usage_count || 0));
    const minUsageInSet = Math.min(...tags.map(t => t.usage_count || 0));
    return tags
      .map(tag => ({
        tag,
        weight: this.normalizeWeight(tag.usage_count || 0, minUsageInSet, maxUsage),
      }))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, maxTags);
  }
  async createTagRelationship(tagId, relatedTagId, relationshipType, strength = 1.0) {
    if (!this.tags.has(tagId) || !this.tags.has(relatedTagId)) {
      throw new Error('One or both tags not found');
    }
    if (tagId === relatedTagId) {
      throw new Error('Cannot create relationship to same tag');
    }
    const existing = await this.getTagRelationship(tagId, relatedTagId);
    if (existing) {
      throw new Error('Relationship already exists');
    }
    const relationship = {
      id: this.generateId(),
      tag_id: tagId,
      related_tag_id: relatedTagId,
      relationship_type: relationshipType,
      strength: Math.min(Math.max(strength, 0), 1),
      created_at: new Date(),
    };
    await this.insertTagRelationship(relationship);
    if (['synonym', 'related'].includes(relationshipType)) {
      const reverseRelationship = {
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
  async getRelatedTags(tagIds) {
    const related = [];
    for (const tagId of tagIds) {
      const relationships = this.tagRelationships.get(tagId) || [];
      for (const relationship of relationships) {
        const relatedTag = this.tags.get(relationship.related_tag_id);
        if (relatedTag && relatedTag.is_active) {
          related.push({ tag: relatedTag, relationship });
        }
      }
    }
    const uniqueRelated = new Map();
    related.forEach(item => {
      const existing = uniqueRelated.get(item.tag.id);
      if (!existing || item.relationship.strength > existing.relationship.strength) {
        uniqueRelated.set(item.tag.id, item);
      }
    });
    return Array.from(uniqueRelated.values()).sort(
      (a, b) => b.relationship.strength - a.relationship.strength
    );
  }
  async mergeTags(operation) {
    const { source_tag_ids, target_tag_id, preserve_relationships, update_entries } = operation;
    const sourceTags = source_tag_ids.map(id => {
      const tag = this.tags.get(id);
      if (!tag) throw new Error(`Source tag not found: ${id}`);
      return tag;
    });
    const targetTag = this.tags.get(target_tag_id);
    if (!targetTag) throw new Error(`Target tag not found: ${target_tag_id}`);
    if (sourceTags.some(tag => tag.is_system) || targetTag.is_system) {
      throw new Error('Cannot merge system tags');
    }
    if (update_entries) {
      for (const sourceTag of sourceTags) {
        await this.replaceTagInEntries(sourceTag.id, target_tag_id);
      }
    }
    if (preserve_relationships) {
      for (const sourceTag of sourceTags) {
        await this.transferTagRelationships(sourceTag.id, target_tag_id);
      }
    }
    const totalUsage = sourceTags.reduce((sum, tag) => sum + (tag.usage_count || 0), 0);
    await this.updateTag(target_tag_id, {
      usage_count: (targetTag.usage_count || 0) + totalUsage,
      last_used: new Date(),
    });
    for (const sourceTagId of source_tag_ids) {
      await this.deleteTagFromStorage(sourceTagId);
    }
    this.emit('tagsMerged', operation);
  }
  async splitTag(sourceTagId, splits) {
    const sourceTag = this.tags.get(sourceTagId);
    if (!sourceTag) {
      throw new Error(`Source tag not found: ${sourceTagId}`);
    }
    const createdTags = [];
    for (const split of splits) {
      const newTag = await this.createTag({
        name: split.name,
        description: `Split from ${sourceTag.name}`,
        category_id: sourceTag.category_id,
      });
      createdTags.push(newTag);
      await this.applyTagByCriteria(newTag.id, split.criteria);
    }
    this.emit('tagSplit', sourceTagId, createdTags);
    return createdTags;
  }
  async renameTag(tagId, newName) {
    return this.updateTag(tagId, { name: newName });
  }
  async bulkTagOperation(operation, tagIds, data) {
    const results = { success: [], errors: [] };
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
  initializeSystemTags() {
    const systemTags = [
      'error',
      'abend',
      'failure',
      'timeout',
      'performance',
      'security',
      'configuration',
      'network',
      'storage',
      'memory',
      'cpu',
      'urgent',
      'critical',
      'high-priority',
      'resolved',
      'workaround',
      'temporary-fix',
    ];
    systemTags.forEach(tagName => {
      const tag = {
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
  validateTagName(name) {
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
  normalizeTagName(name) {
    return name.toLowerCase().trim().replace(/\s+/g, '-');
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
    return `tag_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  calculateStringSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    if (longer.length === 0) return 1.0;
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }
  levenshteinDistance(str1, str2) {
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
  normalizeWeight(value, min, max) {
    if (max === min) return 1;
    return (value - min) / (max - min);
  }
  generateSuggestionCacheKey(query, context) {
    return `${query}-${JSON.stringify(context || {})}`;
  }
  deduplicateSuggestions(suggestions) {
    const seen = new Set();
    return suggestions.filter(suggestion => {
      if (seen.has(suggestion.tag.id)) return false;
      seen.add(suggestion.tag.id);
      return true;
    });
  }
}
exports.EnhancedTagService = EnhancedTagService;
//# sourceMappingURL=EnhancedTagService.js.map
