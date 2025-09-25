'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.CategoryHierarchyService =
  exports.CategoryMoveOperationSchema =
  exports.CategoryStatsSchema =
  exports.CategoryTreeSchema =
  exports.CategoryNodeSchema =
    void 0;
const events_1 = require('events');
const zod_1 = require('zod');
exports.CategoryNodeSchema = zod_1.z.object({
  id: zod_1.z.string().uuid(),
  name: zod_1.z.string().min(1).max(50),
  slug: zod_1.z
    .string()
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  description: zod_1.z.string().max(500).optional(),
  parent_id: zod_1.z.string().uuid().nullable(),
  level: zod_1.z.number().int().min(0).max(5),
  sort_order: zod_1.z.number().int().min(0).optional(),
  color: zod_1.z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .optional(),
  icon: zod_1.z.string().max(50).optional(),
  is_system: zod_1.z.boolean().default(false),
  is_active: zod_1.z.boolean().default(true),
  created_at: zod_1.z.date().optional(),
  updated_at: zod_1.z.date().optional(),
  entry_count: zod_1.z.number().int().min(0).optional(),
});
exports.CategoryTreeSchema = zod_1.z.object({
  node: exports.CategoryNodeSchema,
  children: zod_1.z.lazy(() => zod_1.z.array(exports.CategoryTreeSchema)),
  parent: exports.CategoryNodeSchema.nullable(),
  path: zod_1.z.array(zod_1.z.string()),
  depth: zod_1.z.number().int().min(0),
});
exports.CategoryStatsSchema = zod_1.z.object({
  category_id: zod_1.z.string().uuid(),
  entry_count: zod_1.z.number().int().min(0),
  usage_count: zod_1.z.number().int().min(0),
  search_count: zod_1.z.number().int().min(0),
  avg_success_rate: zod_1.z.number().min(0).max(100),
  last_used: zod_1.z.date().optional(),
  trending_score: zod_1.z.number().min(0).optional(),
});
exports.CategoryMoveOperationSchema = zod_1.z.object({
  category_id: zod_1.z.string().uuid(),
  new_parent_id: zod_1.z.string().uuid().nullable(),
  new_sort_order: zod_1.z.number().int().min(0).optional(),
});
class CategoryHierarchyService extends events_1.EventEmitter {
  categories = new Map();
  categoryTree = new Map();
  parentChildMap = new Map();
  slugMap = new Map();
  pathCache = new Map();
  options;
  constructor(options = {}) {
    super();
    this.options = {
      maxDepth: 5,
      allowDuplicateNames: false,
      autoGenerateSlugs: true,
      enableCaching: true,
      validateOnMove: true,
      ...options,
    };
    this.initializeSystemCategories();
  }
  async createCategory(categoryData) {
    const validation = exports.CategoryNodeSchema.omit({
      id: true,
      level: true,
      created_at: true,
      updated_at: true,
    }).safeParse(categoryData);
    if (!validation.success) {
      throw new Error(`Invalid category data: ${validation.error.message}`);
    }
    let level = 0;
    if (categoryData.parent_id) {
      const parent = this.categories.get(categoryData.parent_id);
      if (!parent) {
        throw new Error(`Parent category not found: ${categoryData.parent_id}`);
      }
      level = parent.level + 1;
      if (level > this.options.maxDepth) {
        throw new Error(`Maximum category depth exceeded (${this.options.maxDepth})`);
      }
    }
    let slug = categoryData.slug;
    if (!slug && this.options.autoGenerateSlugs) {
      slug = this.generateSlug(categoryData.name);
    }
    if (this.slugMap.has(slug)) {
      if (!this.options.allowDuplicateNames) {
        throw new Error(`Category with slug '${slug}' already exists`);
      }
      slug = this.generateUniqueSlug(categoryData.name);
    }
    const category = {
      ...categoryData,
      id: this.generateId(),
      slug,
      level,
      created_at: new Date(),
      updated_at: new Date(),
    };
    await this.insertCategory(category);
    this.emit('categoryCreated', category);
    return category;
  }
  async updateCategory(id, updates) {
    const existing = this.categories.get(id);
    if (!existing) {
      throw new Error(`Category not found: ${id}`);
    }
    if (existing.is_system && (updates.name || updates.slug || updates.parent_id)) {
      throw new Error('Cannot modify system category structure');
    }
    if (updates.parent_id !== undefined && updates.parent_id !== existing.parent_id) {
      await this.validateParentChange(id, updates.parent_id);
    }
    const updated = {
      ...existing,
      ...updates,
      updated_at: new Date(),
    };
    if (updates.parent_id !== undefined) {
      updated.level = updates.parent_id
        ? (this.categories.get(updates.parent_id)?.level ?? 0) + 1
        : 0;
    }
    await this.updateCategoryInStorage(updated);
    this.emit('categoryUpdated', updated, existing);
    return updated;
  }
  async deleteCategory(id, force = false) {
    const category = this.categories.get(id);
    if (!category) {
      throw new Error(`Category not found: ${id}`);
    }
    if (category.is_system) {
      throw new Error('Cannot delete system category');
    }
    const children = this.getChildren(id);
    if (children.length > 0 && !force) {
      throw new Error(
        `Category has ${children.length} child categories. Use force=true to delete.`
      );
    }
    const entryCount = await this.getCategoryEntryCount(id);
    if (entryCount > 0 && !force) {
      throw new Error(`Category has ${entryCount} entries. Use force=true to delete.`);
    }
    if (force && children.length > 0) {
      const newParentId = category.parent_id;
      for (const child of children) {
        await this.updateCategory(child.id, { parent_id: newParentId });
      }
    }
    await this.deleteCategoryFromStorage(id);
    this.emit('categoryDeleted', category);
  }
  getCategoryTree(rootId) {
    const roots = rootId ? [rootId] : this.getRootCategories();
    return roots.map(id => this.buildCategoryTree(id)).filter(Boolean);
  }
  buildCategoryTree(categoryId, visited = new Set()) {
    if (visited.has(categoryId)) {
      console.warn(`Circular reference detected in category hierarchy: ${categoryId}`);
      return null;
    }
    const category = this.categories.get(categoryId);
    if (!category) return null;
    visited.add(categoryId);
    const children = this.getChildren(categoryId)
      .map(child => this.buildCategoryTree(child.id, new Set(visited)))
      .filter(Boolean);
    const parent = category.parent_id ? this.categories.get(category.parent_id) : null;
    const path = this.getCategoryPath(categoryId);
    return {
      node: category,
      children,
      parent,
      path,
      depth: category.level,
    };
  }
  getCategoryPath(categoryId) {
    if (this.options.enableCaching && this.pathCache.has(categoryId)) {
      return this.pathCache.get(categoryId);
    }
    const path = [];
    let currentId = categoryId;
    while (currentId) {
      const category = this.categories.get(currentId);
      if (!category) break;
      path.unshift(category.name);
      currentId = category.parent_id;
    }
    if (this.options.enableCaching) {
      this.pathCache.set(categoryId, path);
    }
    return path;
  }
  findCategoryByPath(path) {
    let currentCategories = this.getRootCategories();
    for (const pathSegment of path) {
      const found = currentCategories.find(id => {
        const cat = this.categories.get(id);
        return cat?.name.toLowerCase() === pathSegment.toLowerCase();
      });
      if (!found) return null;
      const category = this.categories.get(found);
      if (!category) return null;
      if (path.indexOf(pathSegment) === path.length - 1) {
        return category;
      }
      currentCategories = this.getChildren(found).map(c => c.id);
    }
    return null;
  }
  getAncestors(categoryId) {
    const ancestors = [];
    let currentId = this.categories.get(categoryId)?.parent_id;
    while (currentId) {
      const category = this.categories.get(currentId);
      if (!category) break;
      ancestors.unshift(category);
      currentId = category.parent_id;
    }
    return ancestors;
  }
  getDescendants(categoryId) {
    const descendants = [];
    const queue = [...this.getChildren(categoryId)];
    while (queue.length > 0) {
      const category = queue.shift();
      descendants.push(category);
      queue.push(...this.getChildren(category.id));
    }
    return descendants;
  }
  searchCategories(query, options = {}) {
    const { includeDescendants = false, activeOnly = true, maxResults = 50 } = options;
    const lowerQuery = query.toLowerCase();
    let results = Array.from(this.categories.values()).filter(category => {
      if (activeOnly && !category.is_active) return false;
      const nameMatch = category.name.toLowerCase().includes(lowerQuery);
      const descMatch = category.description?.toLowerCase().includes(lowerQuery);
      const slugMatch = category.slug.toLowerCase().includes(lowerQuery);
      return nameMatch || descMatch || slugMatch;
    });
    if (includeDescendants) {
      const additionalResults = [];
      results.forEach(category => {
        additionalResults.push(...this.getDescendants(category.id));
      });
      results = [...results, ...additionalResults];
    }
    results.sort((a, b) => {
      const aExact = a.name.toLowerCase() === lowerQuery ? 1 : 0;
      const bExact = b.name.toLowerCase() === lowerQuery ? 1 : 0;
      if (aExact !== bExact) return bExact - aExact;
      return (b.entry_count || 0) - (a.entry_count || 0);
    });
    return results.slice(0, maxResults);
  }
  getCategoriesByLevel(level) {
    return Array.from(this.categories.values())
      .filter(category => category.level === level)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  }
  getPopularCategories(limit = 10) {
    return Array.from(this.categories.values())
      .filter(category => category.is_active)
      .sort((a, b) => (b.entry_count || 0) - (a.entry_count || 0))
      .slice(0, limit);
  }
  async moveCategory(operation) {
    const { category_id, new_parent_id, new_sort_order } = operation;
    if (this.options.validateOnMove) {
      await this.validateParentChange(category_id, new_parent_id);
    }
    const updates = {
      parent_id: new_parent_id,
    };
    if (new_sort_order !== undefined) {
      updates.sort_order = new_sort_order;
    }
    await this.updateCategory(category_id, updates);
    this.emit('categoryMoved', operation);
  }
  async reorderCategories(parentId, orderedIds) {
    const children = this.getChildren(parentId || '');
    const validIds = children.map(c => c.id);
    if (!orderedIds.every(id => validIds.includes(id))) {
      throw new Error('Some categories do not belong to the specified parent');
    }
    for (let i = 0; i < orderedIds.length; i++) {
      await this.updateCategory(orderedIds[i], { sort_order: i });
    }
    this.emit('categoriesReordered', parentId, orderedIds);
  }
  exportCategories(rootId) {
    const tree = this.getCategoryTree(rootId);
    return {
      version: '1.0',
      exported_at: new Date().toISOString(),
      categories: tree,
      metadata: {
        total_count: this.categories.size,
        max_depth: Math.max(...Array.from(this.categories.values()).map(c => c.level)),
        system_categories: Array.from(this.categories.values()).filter(c => c.is_system).length,
      },
    };
  }
  async importCategories(data, options = {}) {
    const { mergeStrategy = 'merge', validateStructure = true } = options;
    const results = { imported: 0, skipped: 0, errors: [] };
    try {
      if (validateStructure) {
        this.validateImportStructure(data);
      }
      const categoriesFlat = this.flattenCategoryTree(data.categories);
      const sortedByLevel = categoriesFlat.sort((a, b) => a.level - b.level);
      for (const categoryData of sortedByLevel) {
        try {
          const existing = this.findCategoryBySlug(categoryData.slug);
          if (existing) {
            if (mergeStrategy === 'skip') {
              results.skipped++;
              continue;
            } else if (mergeStrategy === 'replace') {
              await this.updateCategory(existing.id, categoryData);
              results.imported++;
            } else {
              const merged = { ...existing, ...categoryData, id: existing.id };
              await this.updateCategory(existing.id, merged);
              results.imported++;
            }
          } else {
            await this.createCategory(categoryData);
            results.imported++;
          }
        } catch (error) {
          results.errors.push(`Category '${categoryData.name}': ${error.message}`);
        }
      }
      this.emit('categoriesImported', results);
    } catch (error) {
      results.errors.push(`Import failed: ${error.message}`);
    }
    return results;
  }
  initializeSystemCategories() {
    const systemCategories = [
      { name: 'JCL', slug: 'jcl', description: 'Job Control Language related issues' },
      { name: 'VSAM', slug: 'vsam', description: 'Virtual Storage Access Method' },
      { name: 'DB2', slug: 'db2', description: 'DB2 database related issues' },
      { name: 'Batch Processing', slug: 'batch', description: 'Batch job processing' },
      { name: 'CICS', slug: 'cics', description: 'Customer Information Control System' },
      { name: 'IMS', slug: 'ims', description: 'Information Management System' },
      { name: 'System', slug: 'system', description: 'System level issues' },
      { name: 'Other', slug: 'other', description: 'Miscellaneous issues' },
    ];
    systemCategories.forEach(cat => {
      const category = {
        id: this.generateId(),
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        parent_id: null,
        level: 0,
        is_system: true,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };
      this.categories.set(category.id, category);
      this.slugMap.set(category.slug, category.id);
    });
  }
  generateId() {
    return `cat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  generateSlug(name) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }
  generateUniqueSlug(name) {
    const baseSlug = this.generateSlug(name);
    let counter = 1;
    let slug = baseSlug;
    while (this.slugMap.has(slug)) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
    return slug;
  }
  getRootCategories() {
    return Array.from(this.categories.values())
      .filter(category => !category.parent_id && category.is_active)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
      .map(category => category.id);
  }
  getChildren(parentId) {
    return Array.from(this.categories.values())
      .filter(category => category.parent_id === (parentId || null) && category.is_active)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  }
  async validateParentChange(categoryId, newParentId) {
    if (!newParentId) return;
    const category = this.categories.get(categoryId);
    const newParent = this.categories.get(newParentId);
    if (!category) throw new Error('Category not found');
    if (!newParent) throw new Error('New parent category not found');
    const ancestors = this.getAncestors(newParentId);
    if (ancestors.some(ancestor => ancestor.id === categoryId)) {
      throw new Error('Cannot move category to its own descendant');
    }
    if (newParent.level + 1 > this.options.maxDepth) {
      throw new Error(`Maximum category depth exceeded (${this.options.maxDepth})`);
    }
  }
  findCategoryBySlug(slug) {
    const id = this.slugMap.get(slug);
    return id ? this.categories.get(id) || null : null;
  }
  validateImportStructure(data) {
    if (!data.version || !data.categories) {
      throw new Error('Invalid import format');
    }
  }
  flattenCategoryTree(tree) {
    const flattened = [];
    const traverse = nodes => {
      for (const node of nodes) {
        flattened.push(node.node);
        if (node.children.length > 0) {
          traverse(node.children);
        }
      }
    };
    traverse(tree);
    return flattened;
  }
}
exports.CategoryHierarchyService = CategoryHierarchyService;
//# sourceMappingURL=CategoryHierarchyService.js.map
