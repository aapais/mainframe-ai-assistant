/**
 * Hierarchical Categories and Enhanced Tagging Schema
 * Supports multi-level categories and flexible tagging with metadata
 */

import { z } from 'zod';

// ===========================
// HIERARCHICAL CATEGORIES
// ===========================

/**
 * Category node in hierarchical structure
 */
export const CategoryNodeSchema = z.object({
  id: z.string().uuid(),
  name: z.string()
    .min(1, 'Category name is required')
    .max(100, 'Category name too long')
    .trim(),
  slug: z.string()
    .min(1, 'Category slug is required')
    .max(100, 'Category slug too long')
    .regex(/^[a-z0-9-]+$/, 'Category slug must contain only lowercase letters, numbers, and hyphens'),
  description: z.string()
    .max(500, 'Description too long')
    .optional(),
  parent_id: z.string().uuid().nullable(),
  level: z.number().int().min(0).max(5), // Max 5 levels deep
  sort_order: z.number().int().min(0).default(0),
  icon: z.string().max(50).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  is_active: z.boolean().default(true),
  is_system: z.boolean().default(false), // System categories can't be deleted
  entry_count: z.number().int().min(0).default(0),
  created_at: z.date().optional(),
  updated_at: z.date().optional(),
  created_by: z.string().max(100).optional(),
});

export type CategoryNode = z.infer<typeof CategoryNodeSchema>;

/**
 * Category tree structure for API responses
 */
export const CategoryTreeSchema = z.object({
  ...CategoryNodeSchema.shape,
  children: z.array(z.lazy(() => CategoryTreeSchema)).default([]),
  path: z.array(z.string()).default([]), // Full path from root to this category
  breadcrumbs: z.array(z.object({
    id: z.string().uuid(),
    name: z.string(),
    slug: z.string(),
  })).default([]),
});

export type CategoryTree = z.infer<typeof CategoryTreeSchema>;

/**
 * Category creation input
 */
export const CreateCategorySchema = CategoryNodeSchema.omit({
  id: true,
  level: true,
  entry_count: true,
  created_at: true,
  updated_at: true,
});

export type CreateCategory = z.infer<typeof CreateCategorySchema>;

/**
 * Category update input
 */
export const UpdateCategorySchema = CategoryNodeSchema.partial().omit({
  id: true,
  level: true,
  entry_count: true,
  created_at: true,
  created_by: true,
});

export type UpdateCategory = z.infer<typeof UpdateCategorySchema>;

// ===========================
// ENHANCED TAGGING SYSTEM
// ===========================

/**
 * Tag definition with metadata
 */
export const TagSchema = z.object({
  id: z.string().uuid(),
  name: z.string()
    .min(1, 'Tag name is required')
    .max(50, 'Tag name too long')
    .trim()
    .transform(val => val.toLowerCase()),
  display_name: z.string()
    .min(1, 'Display name is required')
    .max(50, 'Display name too long')
    .trim(),
  description: z.string().max(200).optional(),
  category_id: z.string().uuid().nullable(), // Optional category association
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  usage_count: z.number().int().min(0).default(0),
  is_system: z.boolean().default(false),
  is_suggested: z.boolean().default(false), // Auto-suggested by AI
  created_at: z.date().optional(),
  updated_at: z.date().optional(),
  created_by: z.string().max(100).optional(),
});

export type Tag = z.infer<typeof TagSchema>;

/**
 * Tag creation input
 */
export const CreateTagSchema = TagSchema.omit({
  id: true,
  usage_count: true,
  created_at: true,
  updated_at: true,
});

export type CreateTag = z.infer<typeof CreateTagSchema>;

/**
 * Tag update input
 */
export const UpdateTagSchema = TagSchema.partial().omit({
  id: true,
  usage_count: true,
  created_at: true,
  created_by: true,
});

export type UpdateTag = z.infer<typeof UpdateTagSchema>;

/**
 * Tag association with KB entries
 */
export const TagAssociationSchema = z.object({
  id: z.string().uuid(),
  entry_id: z.string().uuid(),
  tag_id: z.string().uuid(),
  relevance_score: z.number().min(0).max(1).optional(), // How relevant this tag is to the entry
  assigned_by: z.enum(['user', 'system', 'ai']).default('user'),
  confidence: z.number().min(0).max(1).optional(), // AI confidence if assigned by AI
  created_at: z.date().optional(),
  created_by: z.string().max(100).optional(),
});

export type TagAssociation = z.infer<typeof TagAssociationSchema>;

// ===========================
// BULK OPERATIONS
// ===========================

/**
 * Bulk category operation
 */
export const BulkCategoryOperationSchema = z.object({
  operation: z.enum(['create', 'update', 'delete', 'move', 'reorder']),
  categories: z.array(z.object({
    id: z.string().uuid().optional(),
    data: z.record(z.any()),
    target_parent_id: z.string().uuid().nullable().optional(), // For move operations
    new_sort_order: z.number().int().min(0).optional(), // For reorder operations
  })),
  options: z.object({
    cascade_delete: z.boolean().default(false),
    preserve_entries: z.boolean().default(true),
    validate_hierarchy: z.boolean().default(true),
  }).optional(),
});

export type BulkCategoryOperation = z.infer<typeof BulkCategoryOperationSchema>;

/**
 * Bulk tag operation
 */
export const BulkTagOperationSchema = z.object({
  operation: z.enum(['create', 'update', 'delete', 'assign', 'unassign', 'merge']),
  tags: z.array(z.object({
    id: z.string().uuid().optional(),
    data: z.record(z.any()),
    entry_ids: z.array(z.string().uuid()).optional(), // For assign/unassign operations
    merge_into_id: z.string().uuid().optional(), // For merge operations
  })),
  options: z.object({
    force_delete: z.boolean().default(false),
    update_usage_count: z.boolean().default(true),
    validate_associations: z.boolean().default(true),
  }).optional(),
});

export type BulkTagOperation = z.infer<typeof BulkTagOperationSchema>;

/**
 * Bulk operation result
 */
export const BulkOperationResultSchema = z.object({
  operation: z.string(),
  total_items: z.number().int().min(0),
  successful: z.number().int().min(0),
  failed: z.number().int().min(0),
  errors: z.array(z.object({
    item_id: z.string().optional(),
    error: z.string(),
    details: z.record(z.any()).optional(),
  })),
  execution_time: z.number().min(0),
  transaction_id: z.string().uuid().optional(),
});

export type BulkOperationResult = z.infer<typeof BulkOperationResultSchema>;

// ===========================
// AUTOCOMPLETE & SUGGESTIONS
// ===========================

/**
 * Autocomplete suggestion
 */
export const AutocompleteSuggestionSchema = z.object({
  id: z.string(),
  type: z.enum(['category', 'tag', 'entry', 'search_term']),
  value: z.string(),
  display_value: z.string(),
  description: z.string().optional(),
  score: z.number().min(0).max(100),
  metadata: z.record(z.any()).optional(),
  usage_count: z.number().int().min(0).optional(),
  last_used: z.date().optional(),
});

export type AutocompleteSuggestion = z.infer<typeof AutocompleteSuggestionSchema>;

/**
 * Autocomplete query
 */
export const AutocompleteQuerySchema = z.object({
  query: z.string().min(1).max(100).trim(),
  types: z.array(z.enum(['category', 'tag', 'entry', 'search_term'])).default(['category', 'tag']),
  limit: z.number().int().min(1).max(50).default(10),
  context: z.object({
    current_category_id: z.string().uuid().optional(),
    exclude_ids: z.array(z.string().uuid()).optional(),
    entry_id: z.string().uuid().optional(), // For context-aware suggestions
  }).optional(),
});

export type AutocompleteQuery = z.infer<typeof AutocompleteQuerySchema>;

// ===========================
// FACETED SEARCH ENHANCEMENTS
// ===========================

/**
 * Enhanced facet definition
 */
export const SearchFacetSchema = z.object({
  key: z.string(),
  name: z.string(),
  type: z.enum(['category', 'tag', 'range', 'boolean', 'date']),
  values: z.array(z.object({
    value: z.string(),
    display_value: z.string(),
    count: z.number().int().min(0),
    selected: z.boolean().default(false),
  })),
  min_value: z.number().optional(), // For range facets
  max_value: z.number().optional(), // For range facets
  is_hierarchical: z.boolean().default(false),
});

export type SearchFacet = z.infer<typeof SearchFacetSchema>;

/**
 * Faceted search query
 */
export const FacetedSearchQuerySchema = z.object({
  query: z.string().default(''),
  facets: z.record(z.array(z.string())), // facet_key -> selected_values
  sort: z.object({
    field: z.string(),
    direction: z.enum(['asc', 'desc']).default('desc'),
  }).optional(),
  pagination: z.object({
    page: z.number().int().min(1).default(1),
    page_size: z.number().int().min(1).max(100).default(20),
  }).optional(),
  filters: z.record(z.any()).optional(),
});

export type FacetedSearchQuery = z.infer<typeof FacetedSearchQuerySchema>;

// ===========================
// ANALYTICS & INSIGHTS
// ===========================

/**
 * Category analytics
 */
export const CategoryAnalyticsSchema = z.object({
  category_id: z.string().uuid(),
  entry_count: z.number().int().min(0),
  view_count: z.number().int().min(0),
  search_count: z.number().int().min(0),
  success_rate: z.number().min(0).max(1),
  avg_resolution_time: z.number().min(0).optional(), // in milliseconds
  top_tags: z.array(z.object({
    tag_id: z.string().uuid(),
    tag_name: z.string(),
    count: z.number().int().min(0),
  })),
  trend: z.object({
    direction: z.enum(['up', 'down', 'stable']),
    percentage: z.number(),
    period: z.string(), // e.g., "7days", "30days"
  }).optional(),
  last_updated: z.date(),
});

export type CategoryAnalytics = z.infer<typeof CategoryAnalyticsSchema>;

/**
 * Tag analytics
 */
export const TagAnalyticsSchema = z.object({
  tag_id: z.string().uuid(),
  usage_count: z.number().int().min(0),
  entry_count: z.number().int().min(0),
  categories: z.array(z.object({
    category_id: z.string().uuid(),
    category_name: z.string(),
    count: z.number().int().min(0),
  })),
  co_occurrence: z.array(z.object({
    tag_id: z.string().uuid(),
    tag_name: z.string(),
    count: z.number().int().min(0),
    correlation: z.number().min(-1).max(1),
  })),
  trend: z.object({
    direction: z.enum(['up', 'down', 'stable']),
    percentage: z.number(),
    period: z.string(),
  }).optional(),
  last_updated: z.date(),
});

export type TagAnalytics = z.infer<typeof TagAnalyticsSchema>;

// ===========================
// VALIDATION UTILITIES
// ===========================

/**
 * Enhanced schema validator with hierarchical support
 */
export class HierarchicalSchemaValidator {
  /**
   * Validate category creation
   */
  static validateCreateCategory(data: unknown): CreateCategory {
    return CreateCategorySchema.parse(data);
  }

  /**
   * Validate category update
   */
  static validateUpdateCategory(data: unknown): UpdateCategory {
    return UpdateCategorySchema.parse(data);
  }

  /**
   * Validate tag creation
   */
  static validateCreateTag(data: unknown): CreateTag {
    return CreateTagSchema.parse(data);
  }

  /**
   * Validate tag update
   */
  static validateUpdateTag(data: unknown): UpdateTag {
    return UpdateTagSchema.parse(data);
  }

  /**
   * Validate bulk operation
   */
  static validateBulkCategoryOperation(data: unknown): BulkCategoryOperation {
    return BulkCategoryOperationSchema.parse(data);
  }

  static validateBulkTagOperation(data: unknown): BulkTagOperation {
    return BulkTagOperationSchema.parse(data);
  }

  /**
   * Validate autocomplete query
   */
  static validateAutocompleteQuery(data: unknown): AutocompleteQuery {
    return AutocompleteQuerySchema.parse(data);
  }

  /**
   * Validate faceted search query
   */
  static validateFacetedSearchQuery(data: unknown): FacetedSearchQuery {
    return FacetedSearchQuerySchema.parse(data);
  }

  /**
   * Validate hierarchy integrity
   */
  static validateCategoryHierarchy(categories: CategoryNode[]): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    const idMap = new Map<string, CategoryNode>();

    // Build ID map
    categories.forEach(cat => idMap.set(cat.id, cat));

    // Validate each category
    categories.forEach(category => {
      // Check parent exists if specified
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

      // Check for circular references
      const visited = new Set<string>();
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
      errors
    };
  }
}

// ===========================
// SCHEMA EXPORT MAP
// ===========================

export const HierarchicalSchemas = {
  CategoryNode: CategoryNodeSchema,
  CategoryTree: CategoryTreeSchema,
  CreateCategory: CreateCategorySchema,
  UpdateCategory: UpdateCategorySchema,
  Tag: TagSchema,
  CreateTag: CreateTagSchema,
  UpdateTag: UpdateTagSchema,
  TagAssociation: TagAssociationSchema,
  BulkCategoryOperation: BulkCategoryOperationSchema,
  BulkTagOperation: BulkTagOperationSchema,
  BulkOperationResult: BulkOperationResultSchema,
  AutocompleteSuggestion: AutocompleteSuggestionSchema,
  AutocompleteQuery: AutocompleteQuerySchema,
  SearchFacet: SearchFacetSchema,
  FacetedSearchQuery: FacetedSearchQuerySchema,
  CategoryAnalytics: CategoryAnalyticsSchema,
  TagAnalytics: TagAnalyticsSchema,
} as const;