"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CategoryService = void 0;
const events_1 = require("events");
const HierarchicalCategories_schema_1 = require("../database/schemas/HierarchicalCategories.schema");
const AppError_1 = require("../core/errors/AppError");
class CategoryService extends events_1.EventEmitter {
    categoryRepository;
    cacheService;
    config;
    constructor(categoryRepository, cacheService, config = {}) {
        super();
        this.categoryRepository = categoryRepository;
        this.cacheService = cacheService;
        this.config = {
            cacheEnabled: config.cacheEnabled ?? true,
            cacheTTL: config.cacheTTL ?? 300,
            maxDepth: config.maxDepth ?? 5,
            analyticsEnabled: config.analyticsEnabled ?? true,
        };
    }
    async createCategory(data, userId) {
        try {
            const validatedData = HierarchicalCategories_schema_1.HierarchicalSchemaValidator.validateCreateCategory(data);
            if (validatedData.level && validatedData.level > this.config.maxDepth) {
                throw new AppError_1.AppError(AppError_1.ErrorCode.VALIDATION_ERROR, `Category level cannot exceed ${this.config.maxDepth}`);
            }
            const category = await this.categoryRepository.create(validatedData, userId);
            if (this.config.cacheEnabled && this.cacheService) {
                await this.invalidateHierarchyCache();
                await this.cacheService.delete(`category:${category.id}`);
            }
            this.emit('category:created', { category, userId });
            return category;
        }
        catch (error) {
            this.emit('category:error', { action: 'create', error, data, userId });
            throw error;
        }
    }
    async updateCategory(id, updates, userId) {
        try {
            const existing = await this.categoryRepository.findById(id);
            if (!existing) {
                throw new AppError_1.AppError(AppError_1.ErrorCode.RESOURCE_NOT_FOUND, 'Category not found');
            }
            const validatedUpdates = HierarchicalCategories_schema_1.HierarchicalSchemaValidator.validateUpdateCategory(updates);
            const updatedCategory = await this.categoryRepository.update(id, validatedUpdates, userId);
            if (this.config.cacheEnabled && this.cacheService) {
                await this.invalidateHierarchyCache();
                await this.cacheService.delete(`category:${id}`);
                if (validatedUpdates.parent_id !== undefined && existing.parent_id !== validatedUpdates.parent_id) {
                    if (existing.parent_id) {
                        await this.cacheService.delete(`category:${existing.parent_id}:children`);
                    }
                    if (validatedUpdates.parent_id) {
                        await this.cacheService.delete(`category:${validatedUpdates.parent_id}:children`);
                    }
                }
            }
            this.emit('category:updated', { category: updatedCategory, previous: existing, userId });
            return updatedCategory;
        }
        catch (error) {
            this.emit('category:error', { action: 'update', error, id, updates, userId });
            throw error;
        }
    }
    async deleteCategory(id, options, userId) {
        try {
            const category = await this.categoryRepository.findById(id);
            if (!category) {
                throw new AppError_1.AppError(AppError_1.ErrorCode.RESOURCE_NOT_FOUND, 'Category not found');
            }
            await this.categoryRepository.delete(id, options);
            if (this.config.cacheEnabled && this.cacheService) {
                await this.invalidateHierarchyCache();
                await this.cacheService.delete(`category:${id}`);
                if (category.parent_id) {
                    await this.cacheService.delete(`category:${category.parent_id}:children`);
                }
            }
            this.emit('category:deleted', { category, userId });
        }
        catch (error) {
            this.emit('category:error', { action: 'delete', error, id, options, userId });
            throw error;
        }
    }
    async getCategoryById(id, options = {}) {
        const cacheKey = `category:${id}`;
        try {
            if (this.config.cacheEnabled && this.cacheService) {
                const cached = await this.cacheService.get(cacheKey);
                if (cached) {
                    this.emit('category:cache_hit', { id });
                    return cached;
                }
            }
            const category = await this.categoryRepository.findById(id, options);
            if (category && this.config.cacheEnabled && this.cacheService) {
                await this.cacheService.set(cacheKey, category, this.config.cacheTTL);
            }
            this.emit('category:retrieved', { category, id });
            return category;
        }
        catch (error) {
            this.emit('category:error', { action: 'get', error, id, options });
            throw error;
        }
    }
    async getCategoryBySlug(slug, options = {}) {
        const cacheKey = `category:slug:${slug}`;
        try {
            if (this.config.cacheEnabled && this.cacheService) {
                const cached = await this.cacheService.get(cacheKey);
                if (cached) {
                    return cached;
                }
            }
            const category = await this.categoryRepository.findBySlug(slug, options);
            if (category && this.config.cacheEnabled && this.cacheService) {
                await this.cacheService.set(cacheKey, category, this.config.cacheTTL);
            }
            return category;
        }
        catch (error) {
            this.emit('category:error', { action: 'get_by_slug', error, slug, options });
            throw error;
        }
    }
    async getCategoryHierarchy(options = {}) {
        const cacheKey = `category:hierarchy:${JSON.stringify(options)}`;
        try {
            if (this.config.cacheEnabled && this.cacheService) {
                const cached = await this.cacheService.get(cacheKey);
                if (cached) {
                    this.emit('category:cache_hit', { key: 'hierarchy' });
                    return cached;
                }
            }
            const hierarchy = await this.categoryRepository.getHierarchy(options);
            if (this.config.cacheEnabled && this.cacheService) {
                await this.cacheService.set(cacheKey, hierarchy, this.config.cacheTTL);
            }
            this.emit('category:hierarchy_retrieved', { hierarchy });
            return hierarchy;
        }
        catch (error) {
            this.emit('category:error', { action: 'get_hierarchy', error, options });
            throw error;
        }
    }
    async getCategoryChildren(parentId, options = {}) {
        const cacheKey = `category:${parentId || 'root'}:children:${JSON.stringify(options)}`;
        try {
            if (this.config.cacheEnabled && this.cacheService) {
                const cached = await this.cacheService.get(cacheKey);
                if (cached) {
                    return cached;
                }
            }
            const children = await this.categoryRepository.getChildren(parentId, options);
            if (this.config.cacheEnabled && this.cacheService) {
                await this.cacheService.set(cacheKey, children, this.config.cacheTTL);
            }
            return children;
        }
        catch (error) {
            this.emit('category:error', { action: 'get_children', error, parentId, options });
            throw error;
        }
    }
    async getCategoryAncestors(categoryId) {
        const cacheKey = `category:${categoryId}:ancestors`;
        try {
            if (this.config.cacheEnabled && this.cacheService) {
                const cached = await this.cacheService.get(cacheKey);
                if (cached) {
                    return cached;
                }
            }
            const ancestors = await this.categoryRepository.getAncestors(categoryId);
            if (this.config.cacheEnabled && this.cacheService) {
                await this.cacheService.set(cacheKey, ancestors, this.config.cacheTTL);
            }
            return ancestors;
        }
        catch (error) {
            this.emit('category:error', { action: 'get_ancestors', error, categoryId });
            throw error;
        }
    }
    async getCategoryDescendants(parentId, options = {}) {
        const cacheKey = `category:${parentId}:descendants:${JSON.stringify(options)}`;
        try {
            if (this.config.cacheEnabled && this.cacheService) {
                const cached = await this.cacheService.get(cacheKey);
                if (cached) {
                    return cached;
                }
            }
            const descendants = await this.categoryRepository.getDescendants(parentId, options);
            if (this.config.cacheEnabled && this.cacheService) {
                await this.cacheService.set(cacheKey, descendants, this.config.cacheTTL);
            }
            return descendants;
        }
        catch (error) {
            this.emit('category:error', { action: 'get_descendants', error, parentId, options });
            throw error;
        }
    }
    async reorderCategories(parentId, categoryIds, userId) {
        try {
            for (const id of categoryIds) {
                const category = await this.categoryRepository.findById(id);
                if (!category) {
                    throw new AppError_1.AppError(AppError_1.ErrorCode.RESOURCE_NOT_FOUND, `Category ${id} not found`);
                }
                if (category.parent_id !== parentId) {
                    throw new AppError_1.AppError(AppError_1.ErrorCode.VALIDATION_ERROR, `Category ${id} does not belong to the specified parent`);
                }
            }
            await this.categoryRepository.reorder(parentId, categoryIds);
            if (this.config.cacheEnabled && this.cacheService) {
                await this.invalidateHierarchyCache();
                await this.cacheService.delete(`category:${parentId || 'root'}:children`);
            }
            this.emit('category:reordered', { parentId, categoryIds, userId });
        }
        catch (error) {
            this.emit('category:error', { action: 'reorder', error, parentId, categoryIds, userId });
            throw error;
        }
    }
    async moveCategory(categoryId, newParentId, userId) {
        try {
            const originalCategory = await this.categoryRepository.findById(categoryId);
            if (!originalCategory) {
                throw new AppError_1.AppError(AppError_1.ErrorCode.RESOURCE_NOT_FOUND, 'Category not found');
            }
            const movedCategory = await this.categoryRepository.move(categoryId, newParentId);
            if (this.config.cacheEnabled && this.cacheService) {
                await this.invalidateHierarchyCache();
                await this.cacheService.delete(`category:${categoryId}`);
                await this.cacheService.delete(`category:${categoryId}:ancestors`);
                await this.cacheService.delete(`category:${categoryId}:descendants`);
                if (originalCategory.parent_id) {
                    await this.cacheService.delete(`category:${originalCategory.parent_id}:children`);
                }
                if (newParentId) {
                    await this.cacheService.delete(`category:${newParentId}:children`);
                }
            }
            this.emit('category:moved', {
                category: movedCategory,
                originalParentId: originalCategory.parent_id,
                newParentId,
                userId
            });
            return movedCategory;
        }
        catch (error) {
            this.emit('category:error', { action: 'move', error, categoryId, newParentId, userId });
            throw error;
        }
    }
    async bulkOperation(operation, userId) {
        try {
            const validatedOperation = HierarchicalCategories_schema_1.HierarchicalSchemaValidator.validateBulkCategoryOperation(operation);
            const result = await this.categoryRepository.bulkOperation(validatedOperation);
            if (result.successful > 0 && this.config.cacheEnabled && this.cacheService) {
                await this.invalidateAllCache();
            }
            this.emit('category:bulk_operation', { operation: validatedOperation, result, userId });
            return result;
        }
        catch (error) {
            this.emit('category:error', { action: 'bulk_operation', error, operation, userId });
            throw error;
        }
    }
    async getCategoryAnalytics(categoryId) {
        if (!this.config.analyticsEnabled) {
            return null;
        }
        const cacheKey = `category:${categoryId}:analytics`;
        try {
            if (this.config.cacheEnabled && this.cacheService) {
                const cached = await this.cacheService.get(cacheKey);
                if (cached) {
                    return cached;
                }
            }
            const analytics = await this.categoryRepository.getAnalytics(categoryId);
            if (analytics && this.config.cacheEnabled && this.cacheService) {
                await this.cacheService.set(cacheKey, analytics, Math.min(this.config.cacheTTL, 60));
            }
            return analytics;
        }
        catch (error) {
            this.emit('category:error', { action: 'get_analytics', error, categoryId });
            throw error;
        }
    }
    async updateCategoryAnalytics(categoryId, analytics) {
        if (!this.config.analyticsEnabled) {
            return;
        }
        try {
            await this.categoryRepository.updateAnalytics(categoryId, analytics);
            if (this.config.cacheEnabled && this.cacheService) {
                await this.cacheService.delete(`category:${categoryId}:analytics`);
            }
            this.emit('category:analytics_updated', { categoryId, analytics });
        }
        catch (error) {
            this.emit('category:error', { action: 'update_analytics', error, categoryId, analytics });
            throw error;
        }
    }
    async getCategoryStats() {
        const cacheKey = 'category:stats';
        try {
            if (this.config.cacheEnabled && this.cacheService) {
                const cached = await this.cacheService.get(cacheKey);
                if (cached) {
                    return cached;
                }
            }
            const hierarchy = await this.getCategoryHierarchy({ includeInactive: true, includeSystem: true });
            const stats = this.calculateHierarchyStats(hierarchy);
            if (this.config.cacheEnabled && this.cacheService) {
                await this.cacheService.set(cacheKey, stats, this.config.cacheTTL);
            }
            return stats;
        }
        catch (error) {
            this.emit('category:error', { action: 'get_stats', error });
            throw error;
        }
    }
    async searchCategories(query, options = {}) {
        const allCategories = await this.getCategoryHierarchy(options);
        const flatCategories = this.flattenHierarchy(allCategories);
        const lowerQuery = query.toLowerCase();
        return flatCategories.filter(cat => cat.name.toLowerCase().includes(lowerQuery) ||
            (cat.description && cat.description.toLowerCase().includes(lowerQuery)) ||
            cat.slug.toLowerCase().includes(lowerQuery));
    }
    async validateHierarchyIntegrity() {
        try {
            const allCategories = await this.getCategoryHierarchy({ includeInactive: true, includeSystem: true });
            const flatCategories = this.flattenHierarchy(allCategories);
            const validation = HierarchicalCategories_schema_1.HierarchicalSchemaValidator.validateCategoryHierarchy(flatCategories);
            this.emit('category:hierarchy_validated', validation);
            return validation;
        }
        catch (error) {
            this.emit('category:error', { action: 'validate_hierarchy', error });
            throw error;
        }
    }
    async invalidateHierarchyCache() {
        if (!this.cacheService)
            return;
        const patterns = [
            'category:hierarchy:*',
            'category:*:children:*',
            'category:*:descendants:*',
            'category:*:ancestors',
            'category:stats'
        ];
        for (const pattern of patterns) {
            await this.cacheService.deletePattern(pattern);
        }
    }
    async invalidateAllCache() {
        if (!this.cacheService)
            return;
        await this.cacheService.deletePattern('category:*');
    }
    flattenHierarchy(categories) {
        const flat = [];
        const traverse = (cats) => {
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
    calculateHierarchyStats(hierarchy) {
        let totalCategories = 0;
        let activeCategories = 0;
        let systemCategories = 0;
        let maxDepth = 0;
        const traverse = (cats, depth = 0) => {
            maxDepth = Math.max(maxDepth, depth);
            for (const cat of cats) {
                totalCategories++;
                if (cat.is_active)
                    activeCategories++;
                if (cat.is_system)
                    systemCategories++;
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
            rootCategories: hierarchy.length
        };
    }
    cleanup() {
        this.categoryRepository.cleanup();
        this.removeAllListeners();
    }
}
exports.CategoryService = CategoryService;
exports.default = CategoryService;
//# sourceMappingURL=CategoryService.js.map