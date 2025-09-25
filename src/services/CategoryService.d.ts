import { EventEmitter } from 'events';
import {
  CategoryRepository,
  CategoryQueryOptions,
} from '../database/repositories/CategoryRepository';
import { CacheService } from './CacheService';
import {
  CategoryNode,
  CategoryTree,
  CreateCategory,
  UpdateCategory,
  BulkCategoryOperation,
  BulkOperationResult,
  CategoryAnalytics,
} from '../database/schemas/HierarchicalCategories.schema';
export interface CategoryServiceConfig {
  cacheEnabled?: boolean;
  cacheTTL?: number;
  maxDepth?: number;
  analyticsEnabled?: boolean;
}
export declare class CategoryService extends EventEmitter {
  private categoryRepository;
  private cacheService?;
  private config;
  constructor(
    categoryRepository: CategoryRepository,
    cacheService?: CacheService,
    config?: CategoryServiceConfig
  );
  createCategory(data: CreateCategory, userId?: string): Promise<CategoryNode>;
  updateCategory(id: string, updates: UpdateCategory, userId?: string): Promise<CategoryNode>;
  deleteCategory(
    id: string,
    options?: {
      force?: boolean;
    },
    userId?: string
  ): Promise<void>;
  getCategoryById(id: string, options?: CategoryQueryOptions): Promise<CategoryNode | null>;
  getCategoryBySlug(slug: string, options?: CategoryQueryOptions): Promise<CategoryNode | null>;
  getCategoryHierarchy(options?: CategoryQueryOptions): Promise<CategoryTree[]>;
  getCategoryChildren(
    parentId: string | null,
    options?: CategoryQueryOptions
  ): Promise<CategoryNode[]>;
  getCategoryAncestors(categoryId: string): Promise<CategoryNode[]>;
  getCategoryDescendants(parentId: string, options?: CategoryQueryOptions): Promise<CategoryNode[]>;
  reorderCategories(parentId: string | null, categoryIds: string[], userId?: string): Promise<void>;
  moveCategory(
    categoryId: string,
    newParentId: string | null,
    userId?: string
  ): Promise<CategoryNode>;
  bulkOperation(operation: BulkCategoryOperation, userId?: string): Promise<BulkOperationResult>;
  getCategoryAnalytics(categoryId: string): Promise<CategoryAnalytics | null>;
  updateCategoryAnalytics(categoryId: string, analytics: Partial<CategoryAnalytics>): Promise<void>;
  getCategoryStats(): Promise<{
    totalCategories: number;
    activeCategories: number;
    systemCategories: number;
    maxDepth: number;
    rootCategories: number;
  }>;
  searchCategories(query: string, options?: CategoryQueryOptions): Promise<CategoryNode[]>;
  validateHierarchyIntegrity(): Promise<{
    valid: boolean;
    errors: string[];
  }>;
  private invalidateHierarchyCache;
  private invalidateAllCache;
  private flattenHierarchy;
  private calculateHierarchyStats;
  cleanup(): void;
}
export default CategoryService;
//# sourceMappingURL=CategoryService.d.ts.map
