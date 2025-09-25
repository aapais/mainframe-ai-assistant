'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.HierarchicalSchemas =
  exports.HierarchicalSchemaValidator =
  exports.TagAnalyticsSchema =
  exports.CategoryAnalyticsSchema =
  exports.FacetedSearchQuerySchema =
  exports.SearchFacetSchema =
  exports.AutocompleteQuerySchema =
  exports.AutocompleteSuggestionSchema =
  exports.BulkOperationResultSchema =
  exports.BulkTagOperationSchema =
  exports.BulkCategoryOperationSchema =
  exports.TagAssociationSchema =
  exports.UpdateTagSchema =
  exports.CreateTagSchema =
  exports.TagSchema =
  exports.UpdateCategorySchema =
  exports.CreateCategorySchema =
  exports.CategoryTreeSchema =
  exports.CategoryNodeSchema =
    void 0;
const zod_1 = require('zod');
exports.CategoryNodeSchema = zod_1.z.object({
  id: zod_1.z.string().uuid(),
  name: zod_1.z
    .string()
    .min(1, 'Category name is required')
    .max(100, 'Category name too long')
    .trim(),
  slug: zod_1.z
    .string()
    .min(1, 'Category slug is required')
    .max(100, 'Category slug too long')
    .regex(
      /^[a-z0-9-]+$/,
      'Category slug must contain only lowercase letters, numbers, and hyphens'
    ),
  description: zod_1.z.string().max(500, 'Description too long').optional(),
  parent_id: zod_1.z.string().uuid().nullable(),
  level: zod_1.z.number().int().min(0).max(5),
  sort_order: zod_1.z.number().int().min(0).default(0),
  icon: zod_1.z.string().max(50).optional(),
  color: zod_1.z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  is_active: zod_1.z.boolean().default(true),
  is_system: zod_1.z.boolean().default(false),
  entry_count: zod_1.z.number().int().min(0).default(0),
  created_at: zod_1.z.date().optional(),
  updated_at: zod_1.z.date().optional(),
  created_by: zod_1.z.string().max(100).optional(),
});
exports.CategoryTreeSchema = zod_1.z.object({
  ...exports.CategoryNodeSchema.shape,
  children: zod_1.z.array(zod_1.z.lazy(() => exports.CategoryTreeSchema)).default([]),
  path: zod_1.z.array(zod_1.z.string()).default([]),
  breadcrumbs: zod_1.z
    .array(
      zod_1.z.object({
        id: zod_1.z.string().uuid(),
        name: zod_1.z.string(),
        slug: zod_1.z.string(),
      })
    )
    .default([]),
});
exports.CreateCategorySchema = exports.CategoryNodeSchema.omit({
  id: true,
  level: true,
  entry_count: true,
  created_at: true,
  updated_at: true,
});
exports.UpdateCategorySchema = exports.CategoryNodeSchema.partial().omit({
  id: true,
  level: true,
  entry_count: true,
  created_at: true,
  created_by: true,
});
exports.TagSchema = zod_1.z.object({
  id: zod_1.z.string().uuid(),
  name: zod_1.z
    .string()
    .min(1, 'Tag name is required')
    .max(50, 'Tag name too long')
    .trim()
    .transform(val => val.toLowerCase()),
  display_name: zod_1.z
    .string()
    .min(1, 'Display name is required')
    .max(50, 'Display name too long')
    .trim(),
  description: zod_1.z.string().max(200).optional(),
  category_id: zod_1.z.string().uuid().nullable(),
  color: zod_1.z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  usage_count: zod_1.z.number().int().min(0).default(0),
  is_system: zod_1.z.boolean().default(false),
  is_suggested: zod_1.z.boolean().default(false),
  created_at: zod_1.z.date().optional(),
  updated_at: zod_1.z.date().optional(),
  created_by: zod_1.z.string().max(100).optional(),
});
exports.CreateTagSchema = exports.TagSchema.omit({
  id: true,
  usage_count: true,
  created_at: true,
  updated_at: true,
});
exports.UpdateTagSchema = exports.TagSchema.partial().omit({
  id: true,
  usage_count: true,
  created_at: true,
  created_by: true,
});
exports.TagAssociationSchema = zod_1.z.object({
  id: zod_1.z.string().uuid(),
  entry_id: zod_1.z.string().uuid(),
  tag_id: zod_1.z.string().uuid(),
  relevance_score: zod_1.z.number().min(0).max(1).optional(),
  assigned_by: zod_1.z.enum(['user', 'system', 'ai']).default('user'),
  confidence: zod_1.z.number().min(0).max(1).optional(),
  created_at: zod_1.z.date().optional(),
  created_by: zod_1.z.string().max(100).optional(),
});
exports.BulkCategoryOperationSchema = zod_1.z.object({
  operation: zod_1.z.enum(['create', 'update', 'delete', 'move', 'reorder']),
  categories: zod_1.z.array(
    zod_1.z.object({
      id: zod_1.z.string().uuid().optional(),
      data: zod_1.z.record(zod_1.z.any()),
      target_parent_id: zod_1.z.string().uuid().nullable().optional(),
      new_sort_order: zod_1.z.number().int().min(0).optional(),
    })
  ),
  options: zod_1.z
    .object({
      cascade_delete: zod_1.z.boolean().default(false),
      preserve_entries: zod_1.z.boolean().default(true),
      validate_hierarchy: zod_1.z.boolean().default(true),
    })
    .optional(),
});
exports.BulkTagOperationSchema = zod_1.z.object({
  operation: zod_1.z.enum(['create', 'update', 'delete', 'assign', 'unassign', 'merge']),
  tags: zod_1.z.array(
    zod_1.z.object({
      id: zod_1.z.string().uuid().optional(),
      data: zod_1.z.record(zod_1.z.any()),
      entry_ids: zod_1.z.array(zod_1.z.string().uuid()).optional(),
      merge_into_id: zod_1.z.string().uuid().optional(),
    })
  ),
  options: zod_1.z
    .object({
      force_delete: zod_1.z.boolean().default(false),
      update_usage_count: zod_1.z.boolean().default(true),
      validate_associations: zod_1.z.boolean().default(true),
    })
    .optional(),
});
exports.BulkOperationResultSchema = zod_1.z.object({
  operation: zod_1.z.string(),
  total_items: zod_1.z.number().int().min(0),
  successful: zod_1.z.number().int().min(0),
  failed: zod_1.z.number().int().min(0),
  errors: zod_1.z.array(
    zod_1.z.object({
      item_id: zod_1.z.string().optional(),
      error: zod_1.z.string(),
      details: zod_1.z.record(zod_1.z.any()).optional(),
    })
  ),
  execution_time: zod_1.z.number().min(0),
  transaction_id: zod_1.z.string().uuid().optional(),
});
exports.AutocompleteSuggestionSchema = zod_1.z.object({
  id: zod_1.z.string(),
  type: zod_1.z.enum(['category', 'tag', 'entry', 'search_term']),
  value: zod_1.z.string(),
  display_value: zod_1.z.string(),
  description: zod_1.z.string().optional(),
  score: zod_1.z.number().min(0).max(100),
  metadata: zod_1.z.record(zod_1.z.any()).optional(),
  usage_count: zod_1.z.number().int().min(0).optional(),
  last_used: zod_1.z.date().optional(),
});
exports.AutocompleteQuerySchema = zod_1.z.object({
  query: zod_1.z.string().min(1).max(100).trim(),
  types: zod_1.z
    .array(zod_1.z.enum(['category', 'tag', 'entry', 'search_term']))
    .default(['category', 'tag']),
  limit: zod_1.z.number().int().min(1).max(50).default(10),
  context: zod_1.z
    .object({
      current_category_id: zod_1.z.string().uuid().optional(),
      exclude_ids: zod_1.z.array(zod_1.z.string().uuid()).optional(),
      entry_id: zod_1.z.string().uuid().optional(),
    })
    .optional(),
});
exports.SearchFacetSchema = zod_1.z.object({
  key: zod_1.z.string(),
  name: zod_1.z.string(),
  type: zod_1.z.enum(['category', 'tag', 'range', 'boolean', 'date']),
  values: zod_1.z.array(
    zod_1.z.object({
      value: zod_1.z.string(),
      display_value: zod_1.z.string(),
      count: zod_1.z.number().int().min(0),
      selected: zod_1.z.boolean().default(false),
    })
  ),
  min_value: zod_1.z.number().optional(),
  max_value: zod_1.z.number().optional(),
  is_hierarchical: zod_1.z.boolean().default(false),
});
exports.FacetedSearchQuerySchema = zod_1.z.object({
  query: zod_1.z.string().default(''),
  facets: zod_1.z.record(zod_1.z.array(zod_1.z.string())),
  sort: zod_1.z
    .object({
      field: zod_1.z.string(),
      direction: zod_1.z.enum(['asc', 'desc']).default('desc'),
    })
    .optional(),
  pagination: zod_1.z
    .object({
      page: zod_1.z.number().int().min(1).default(1),
      page_size: zod_1.z.number().int().min(1).max(100).default(20),
    })
    .optional(),
  filters: zod_1.z.record(zod_1.z.any()).optional(),
});
exports.CategoryAnalyticsSchema = zod_1.z.object({
  category_id: zod_1.z.string().uuid(),
  entry_count: zod_1.z.number().int().min(0),
  view_count: zod_1.z.number().int().min(0),
  search_count: zod_1.z.number().int().min(0),
  success_rate: zod_1.z.number().min(0).max(1),
  avg_resolution_time: zod_1.z.number().min(0).optional(),
  top_tags: zod_1.z.array(
    zod_1.z.object({
      tag_id: zod_1.z.string().uuid(),
      tag_name: zod_1.z.string(),
      count: zod_1.z.number().int().min(0),
    })
  ),
  trend: zod_1.z
    .object({
      direction: zod_1.z.enum(['up', 'down', 'stable']),
      percentage: zod_1.z.number(),
      period: zod_1.z.string(),
    })
    .optional(),
  last_updated: zod_1.z.date(),
});
exports.TagAnalyticsSchema = zod_1.z.object({
  tag_id: zod_1.z.string().uuid(),
  usage_count: zod_1.z.number().int().min(0),
  entry_count: zod_1.z.number().int().min(0),
  categories: zod_1.z.array(
    zod_1.z.object({
      category_id: zod_1.z.string().uuid(),
      category_name: zod_1.z.string(),
      count: zod_1.z.number().int().min(0),
    })
  ),
  co_occurrence: zod_1.z.array(
    zod_1.z.object({
      tag_id: zod_1.z.string().uuid(),
      tag_name: zod_1.z.string(),
      count: zod_1.z.number().int().min(0),
      correlation: zod_1.z.number().min(-1).max(1),
    })
  ),
  trend: zod_1.z
    .object({
      direction: zod_1.z.enum(['up', 'down', 'stable']),
      percentage: zod_1.z.number(),
      period: zod_1.z.string(),
    })
    .optional(),
  last_updated: zod_1.z.date(),
});
class HierarchicalSchemaValidator {
  static validateCreateCategory(data) {
    return exports.CreateCategorySchema.parse(data);
  }
  static validateUpdateCategory(data) {
    return exports.UpdateCategorySchema.parse(data);
  }
  static validateCreateTag(data) {
    return exports.CreateTagSchema.parse(data);
  }
  static validateUpdateTag(data) {
    return exports.UpdateTagSchema.parse(data);
  }
  static validateBulkCategoryOperation(data) {
    return exports.BulkCategoryOperationSchema.parse(data);
  }
  static validateBulkTagOperation(data) {
    return exports.BulkTagOperationSchema.parse(data);
  }
  static validateAutocompleteQuery(data) {
    return exports.AutocompleteQuerySchema.parse(data);
  }
  static validateFacetedSearchQuery(data) {
    return exports.FacetedSearchQuerySchema.parse(data);
  }
  static validateCategoryHierarchy(categories) {
    const errors = [];
    const idMap = new Map();
    categories.forEach(cat => idMap.set(cat.id, cat));
    categories.forEach(category => {
      if (category.parent_id) {
        const parent = idMap.get(category.parent_id);
        if (!parent) {
          errors.push(`Category "${category.name}" has invalid parent_id: ${category.parent_id}`);
        } else if (parent.level >= category.level) {
          errors.push(`Category "${category.name}" has invalid hierarchy level`);
        }
      } else if (category.level > 0) {
        errors.push(`Category "${category.name}" should have parent_id for level > 0`);
      }
      const visited = new Set();
      let current = category;
      while (current.parent_id && !visited.has(current.id)) {
        visited.add(current.id);
        const parent = idMap.get(current.parent_id);
        if (!parent) break;
        current = parent;
      }
      if (visited.has(current.id)) {
        errors.push(`Circular reference detected for category "${category.name}"`);
      }
    });
    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
exports.HierarchicalSchemaValidator = HierarchicalSchemaValidator;
exports.HierarchicalSchemas = {
  CategoryNode: exports.CategoryNodeSchema,
  CategoryTree: exports.CategoryTreeSchema,
  CreateCategory: exports.CreateCategorySchema,
  UpdateCategory: exports.UpdateCategorySchema,
  Tag: exports.TagSchema,
  CreateTag: exports.CreateTagSchema,
  UpdateTag: exports.UpdateTagSchema,
  TagAssociation: exports.TagAssociationSchema,
  BulkCategoryOperation: exports.BulkCategoryOperationSchema,
  BulkTagOperation: exports.BulkTagOperationSchema,
  BulkOperationResult: exports.BulkOperationResultSchema,
  AutocompleteSuggestion: exports.AutocompleteSuggestionSchema,
  AutocompleteQuery: exports.AutocompleteQuerySchema,
  SearchFacet: exports.SearchFacetSchema,
  FacetedSearchQuery: exports.FacetedSearchQuerySchema,
  CategoryAnalytics: exports.CategoryAnalyticsSchema,
  TagAnalytics: exports.TagAnalyticsSchema,
};
//# sourceMappingURL=HierarchicalCategories.schema.js.map
