"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TagService = void 0;
const events_1 = require("events");
const HierarchicalCategories_schema_1 = require("../database/schemas/HierarchicalCategories.schema");
const AppError_1 = require("../core/errors/AppError");
class TagService extends events_1.EventEmitter {
    tagRepository;
    cacheService;
    config;
    constructor(tagRepository, cacheService, config = {}) {
        super();
        this.tagRepository = tagRepository;
        this.cacheService = cacheService;
        this.config = {
            cacheEnabled: config.cacheEnabled ?? true,
            cacheTTL: config.cacheTTL ?? 300,
            suggestionCacheTTL: config.suggestionCacheTTL ?? 60,
            analyticsEnabled: config.analyticsEnabled ?? true,
            maxTagsPerEntry: config.maxTagsPerEntry ?? 20,
            enableAutoSuggestions: config.enableAutoSuggestions ?? true,
        };
    }
    async createTag(data, userId) {
        try {
            const validatedData = HierarchicalCategories_schema_1.HierarchicalSchemaValidator.validateCreateTag(data);
            const tag = await this.tagRepository.create(validatedData, userId);
            if (this.config.cacheEnabled && this.cacheService) {
                await this.invalidateTagListCache();
                await this.cacheService.delete(`tag:${tag.id}`);
                await this.cacheService.deletePattern('tag:search:*');
                await this.cacheService.deletePattern('tag:suggestions:*');
            }
            this.emit('tag:created', { tag, userId });
            return tag;
        }
        catch (error) {
            this.emit('tag:error', { action: 'create', error, data, userId });
            throw error;
        }
    }
    async updateTag(id, updates, userId) {
        try {
            const existing = await this.tagRepository.findById(id);
            if (!existing) {
                throw new AppError_1.AppError(AppError_1.ErrorCode.RESOURCE_NOT_FOUND, 'Tag not found');
            }
            const validatedUpdates = HierarchicalCategories_schema_1.HierarchicalSchemaValidator.validateUpdateTag(updates);
            const updatedTag = await this.tagRepository.update(id, validatedUpdates, userId);
            if (this.config.cacheEnabled && this.cacheService) {
                await this.invalidateTagListCache();
                await this.cacheService.delete(`tag:${id}`);
                await this.cacheService.deletePattern('tag:search:*');
                await this.cacheService.deletePattern('tag:suggestions:*');
                if (validatedUpdates.category_id !== undefined) {
                    if (existing.category_id) {
                        await this.cacheService.deletePattern(`tag:category:${existing.category_id}:*`);
                    }
                    if (validatedUpdates.category_id) {
                        await this.cacheService.deletePattern(`tag:category:${validatedUpdates.category_id}:*`);
                    }
                }
            }
            this.emit('tag:updated', { tag: updatedTag, previous: existing, userId });
            return updatedTag;
        }
        catch (error) {
            this.emit('tag:error', { action: 'update', error, id, updates, userId });
            throw error;
        }
    }
    async deleteTag(id, options, userId) {
        try {
            const tag = await this.tagRepository.findById(id);
            if (!tag) {
                throw new AppError_1.AppError(AppError_1.ErrorCode.RESOURCE_NOT_FOUND, 'Tag not found');
            }
            await this.tagRepository.delete(id, options);
            if (this.config.cacheEnabled && this.cacheService) {
                await this.invalidateTagListCache();
                await this.cacheService.delete(`tag:${id}`);
                await this.cacheService.deletePattern('tag:search:*');
                await this.cacheService.deletePattern('tag:suggestions:*');
                await this.cacheService.delete(`tag:${id}:analytics`);
                if (tag.category_id) {
                    await this.cacheService.deletePattern(`tag:category:${tag.category_id}:*`);
                }
            }
            this.emit('tag:deleted', { tag, userId });
        }
        catch (error) {
            this.emit('tag:error', { action: 'delete', error, id, options, userId });
            throw error;
        }
    }
    async getTagById(id) {
        const cacheKey = `tag:${id}`;
        try {
            if (this.config.cacheEnabled && this.cacheService) {
                const cached = await this.cacheService.get(cacheKey);
                if (cached) {
                    this.emit('tag:cache_hit', { id });
                    return cached;
                }
            }
            const tag = await this.tagRepository.findById(id);
            if (tag && this.config.cacheEnabled && this.cacheService) {
                await this.cacheService.set(cacheKey, tag, this.config.cacheTTL);
            }
            this.emit('tag:retrieved', { tag, id });
            return tag;
        }
        catch (error) {
            this.emit('tag:error', { action: 'get', error, id });
            throw error;
        }
    }
    async getTagByName(name) {
        const cacheKey = `tag:name:${name.toLowerCase()}`;
        try {
            if (this.config.cacheEnabled && this.cacheService) {
                const cached = await this.cacheService.get(cacheKey);
                if (cached) {
                    return cached;
                }
            }
            const tag = await this.tagRepository.findByName(name);
            if (tag && this.config.cacheEnabled && this.cacheService) {
                await this.cacheService.set(cacheKey, tag, this.config.cacheTTL);
            }
            return tag;
        }
        catch (error) {
            this.emit('tag:error', { action: 'get_by_name', error, name });
            throw error;
        }
    }
    async searchTags(options) {
        const cacheKey = `tag:search:${JSON.stringify(options)}`;
        try {
            if (this.config.cacheEnabled && this.cacheService) {
                const cached = await this.cacheService.get(cacheKey);
                if (cached) {
                    return cached;
                }
            }
            const tags = await this.tagRepository.search(options);
            if (this.config.cacheEnabled && this.cacheService) {
                await this.cacheService.set(cacheKey, tags, this.config.cacheTTL);
            }
            this.emit('tag:searched', { options, resultCount: tags.length });
            return tags;
        }
        catch (error) {
            this.emit('tag:error', { action: 'search', error, options });
            throw error;
        }
    }
    async getAllTags(options = {}) {
        const cacheKey = `tag:list:${JSON.stringify(options)}`;
        try {
            if (this.config.cacheEnabled && this.cacheService) {
                const cached = await this.cacheService.get(cacheKey);
                if (cached) {
                    return cached;
                }
            }
            const tags = await this.tagRepository.findAll(options);
            if (this.config.cacheEnabled && this.cacheService) {
                await this.cacheService.set(cacheKey, tags, this.config.cacheTTL);
            }
            return tags;
        }
        catch (error) {
            this.emit('tag:error', { action: 'get_all', error, options });
            throw error;
        }
    }
    async getTagsByCategory(categoryId, options = {}) {
        const cacheKey = `tag:category:${categoryId}:${JSON.stringify(options)}`;
        try {
            if (this.config.cacheEnabled && this.cacheService) {
                const cached = await this.cacheService.get(cacheKey);
                if (cached) {
                    return cached;
                }
            }
            const tags = await this.tagRepository.findAll({ ...options, categoryId });
            if (this.config.cacheEnabled && this.cacheService) {
                await this.cacheService.set(cacheKey, tags, this.config.cacheTTL);
            }
            return tags;
        }
        catch (error) {
            this.emit('tag:error', { action: 'get_by_category', error, categoryId, options });
            throw error;
        }
    }
    async associateTagWithEntry(entryId, tagId, options = {}, userId) {
        try {
            const existingTags = await this.tagRepository.getEntryTags(entryId);
            if (existingTags.length >= this.config.maxTagsPerEntry) {
                throw new AppError_1.AppError(AppError_1.ErrorCode.VALIDATION_ERROR, `Entry cannot have more than ${this.config.maxTagsPerEntry} tags`);
            }
            await this.tagRepository.associateWithEntry(entryId, tagId, options, userId);
            if (this.config.cacheEnabled && this.cacheService) {
                await this.cacheService.delete(`entry:${entryId}:tags`);
                await this.cacheService.delete(`tag:${tagId}:entries`);
                await this.cacheService.delete(`tag:${tagId}:analytics`);
            }
            this.emit('tag:associated', { entryId, tagId, options, userId });
        }
        catch (error) {
            this.emit('tag:error', { action: 'associate', error, entryId, tagId, options, userId });
            throw error;
        }
    }
    async dissociateTagFromEntry(entryId, tagId, userId) {
        try {
            await this.tagRepository.dissociateFromEntry(entryId, tagId);
            if (this.config.cacheEnabled && this.cacheService) {
                await this.cacheService.delete(`entry:${entryId}:tags`);
                await this.cacheService.delete(`tag:${tagId}:entries`);
                await this.cacheService.delete(`tag:${tagId}:analytics`);
            }
            this.emit('tag:dissociated', { entryId, tagId, userId });
        }
        catch (error) {
            this.emit('tag:error', { action: 'dissociate', error, entryId, tagId, userId });
            throw error;
        }
    }
    async getEntryTags(entryId) {
        const cacheKey = `entry:${entryId}:tags`;
        try {
            if (this.config.cacheEnabled && this.cacheService) {
                const cached = await this.cacheService.get(cacheKey);
                if (cached) {
                    return cached;
                }
            }
            const tags = await this.tagRepository.getEntryTags(entryId);
            if (this.config.cacheEnabled && this.cacheService) {
                await this.cacheService.set(cacheKey, tags, this.config.cacheTTL);
            }
            return tags;
        }
        catch (error) {
            this.emit('tag:error', { action: 'get_entry_tags', error, entryId });
            throw error;
        }
    }
    async getTagEntries(tagId) {
        const cacheKey = `tag:${tagId}:entries`;
        try {
            if (this.config.cacheEnabled && this.cacheService) {
                const cached = await this.cacheService.get(cacheKey);
                if (cached) {
                    return cached;
                }
            }
            const entries = await this.tagRepository.getTagEntries(tagId);
            if (this.config.cacheEnabled && this.cacheService) {
                await this.cacheService.set(cacheKey, entries, this.config.cacheTTL);
            }
            return entries;
        }
        catch (error) {
            this.emit('tag:error', { action: 'get_tag_entries', error, tagId });
            throw error;
        }
    }
    async replaceEntryTags(entryId, tagIds, options = {}, userId) {
        try {
            if (tagIds.length > this.config.maxTagsPerEntry) {
                throw new AppError_1.AppError(AppError_1.ErrorCode.VALIDATION_ERROR, `Entry cannot have more than ${this.config.maxTagsPerEntry} tags`);
            }
            await this.tagRepository.replaceEntryTags(entryId, tagIds, options, userId);
            if (this.config.cacheEnabled && this.cacheService) {
                await this.cacheService.delete(`entry:${entryId}:tags`);
                for (const tagId of tagIds) {
                    await this.cacheService.delete(`tag:${tagId}:analytics`);
                }
            }
            this.emit('tag:entry_tags_replaced', { entryId, tagIds, options, userId });
        }
        catch (error) {
            this.emit('tag:error', { action: 'replace_entry_tags', error, entryId, tagIds, options, userId });
            throw error;
        }
    }
    async getTagSuggestions(query, options = {}) {
        if (!this.config.enableAutoSuggestions) {
            return [];
        }
        const cacheKey = `tag:suggestions:${query}:${JSON.stringify(options)}`;
        try {
            if (this.config.cacheEnabled && this.cacheService) {
                const cached = await this.cacheService.get(cacheKey);
                if (cached) {
                    return cached;
                }
            }
            const suggestions = await this.tagRepository.getSuggestions(query, options);
            if (this.config.cacheEnabled && this.cacheService) {
                await this.cacheService.set(cacheKey, suggestions, this.config.suggestionCacheTTL);
            }
            this.emit('tag:suggestions_generated', { query, options, resultCount: suggestions.length });
            return suggestions;
        }
        catch (error) {
            this.emit('tag:error', { action: 'get_suggestions', error, query, options });
            throw error;
        }
    }
    async getOrCreateTag(name, options = {}, userId) {
        try {
            let tag = await this.getTagByName(name);
            if (!tag) {
                const createData = {
                    name: name.toLowerCase(),
                    display_name: options.displayName || name,
                    category_id: options.categoryId || null,
                    color: options.color,
                    description: options.description,
                    is_system: false,
                    is_suggested: true,
                };
                tag = await this.createTag(createData, userId);
                this.emit('tag:auto_created', { tag, originalName: name, userId });
            }
            return tag;
        }
        catch (error) {
            this.emit('tag:error', { action: 'get_or_create', error, name, options, userId });
            throw error;
        }
    }
    async bulkOperation(operation, userId) {
        try {
            const validatedOperation = HierarchicalCategories_schema_1.HierarchicalSchemaValidator.validateBulkTagOperation(operation);
            const result = await this.tagRepository.bulkOperation(validatedOperation);
            if (result.successful > 0 && this.config.cacheEnabled && this.cacheService) {
                await this.invalidateAllCache();
            }
            this.emit('tag:bulk_operation', { operation: validatedOperation, result, userId });
            return result;
        }
        catch (error) {
            this.emit('tag:error', { action: 'bulk_operation', error, operation, userId });
            throw error;
        }
    }
    async getTagAnalytics(tagId) {
        if (!this.config.analyticsEnabled) {
            return null;
        }
        const cacheKey = `tag:${tagId}:analytics`;
        try {
            if (this.config.cacheEnabled && this.cacheService) {
                const cached = await this.cacheService.get(cacheKey);
                if (cached) {
                    return cached;
                }
            }
            const analytics = await this.tagRepository.getAnalytics(tagId);
            if (analytics && this.config.cacheEnabled && this.cacheService) {
                await this.cacheService.set(cacheKey, analytics, Math.min(this.config.cacheTTL, 60));
            }
            return analytics;
        }
        catch (error) {
            this.emit('tag:error', { action: 'get_analytics', error, tagId });
            throw error;
        }
    }
    async updateTagAnalytics(tagId, analytics) {
        if (!this.config.analyticsEnabled) {
            return;
        }
        try {
            await this.tagRepository.updateAnalytics(tagId, analytics);
            if (this.config.cacheEnabled && this.cacheService) {
                await this.cacheService.delete(`tag:${tagId}:analytics`);
            }
            this.emit('tag:analytics_updated', { tagId, analytics });
        }
        catch (error) {
            this.emit('tag:error', { action: 'update_analytics', error, tagId, analytics });
            throw error;
        }
    }
    async getMostUsedTags(limit = 20) {
        const cacheKey = `tag:most_used:${limit}`;
        try {
            if (this.config.cacheEnabled && this.cacheService) {
                const cached = await this.cacheService.get(cacheKey);
                if (cached) {
                    return cached;
                }
            }
            const tags = await this.tagRepository.getMostUsed(limit);
            if (this.config.cacheEnabled && this.cacheService) {
                await this.cacheService.set(cacheKey, tags, this.config.cacheTTL);
            }
            return tags;
        }
        catch (error) {
            this.emit('tag:error', { action: 'get_most_used', error, limit });
            throw error;
        }
    }
    async getTrendingTags(days = 7, limit = 20) {
        const cacheKey = `tag:trending:${days}:${limit}`;
        try {
            if (this.config.cacheEnabled && this.cacheService) {
                const cached = await this.cacheService.get(cacheKey);
                if (cached) {
                    return cached;
                }
            }
            const tags = await this.tagRepository.getTrending(days, limit);
            if (this.config.cacheEnabled && this.cacheService) {
                await this.cacheService.set(cacheKey, tags, this.config.cacheTTL);
            }
            return tags;
        }
        catch (error) {
            this.emit('tag:error', { action: 'get_trending', error, days, limit });
            throw error;
        }
    }
    async getTagStats() {
        const cacheKey = 'tag:stats';
        try {
            if (this.config.cacheEnabled && this.cacheService) {
                const cached = await this.cacheService.get(cacheKey);
                if (cached) {
                    return cached;
                }
            }
            const allTags = await this.getAllTags({ includeSystem: true });
            const mostUsed = await this.getMostUsedTags(1);
            const averageTagsPerEntry = 3.5;
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
            if (this.config.cacheEnabled && this.cacheService) {
                await this.cacheService.set(cacheKey, stats, this.config.cacheTTL);
            }
            return stats;
        }
        catch (error) {
            this.emit('tag:error', { action: 'get_stats', error });
            throw error;
        }
    }
    async cleanupUnusedTags(options) {
        try {
            const dryRun = options?.dryRun ?? true;
            const excludeSystem = options?.excludeSystem ?? true;
            const allTags = await this.getAllTags({ includeSystem: !excludeSystem });
            const unusedTags = [];
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
                for (const tag of unusedTags) {
                    try {
                        await this.deleteTag(tag.id, { force: true });
                        removed++;
                    }
                    catch (error) {
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
        }
        catch (error) {
            this.emit('tag:error', { action: 'cleanup_unused', error, options });
            throw error;
        }
    }
    async invalidateTagListCache() {
        if (!this.cacheService)
            return;
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
    async invalidateAllCache() {
        if (!this.cacheService)
            return;
        await this.cacheService.deletePattern('tag:*');
    }
    cleanup() {
        this.tagRepository.cleanup();
        this.removeAllListeners();
    }
}
exports.TagService = TagService;
exports.default = TagService;
//# sourceMappingURL=TagService.js.map