import Database from 'better-sqlite3';
import {
  CategoryNode,
  CategoryTree,
  CreateCategory,
  UpdateCategory,
  BulkCategoryOperation,
  BulkOperationResult,
  CategoryAnalytics,
} from '../schemas/HierarchicalCategories.schema';
export interface CategoryQueryOptions {
  includeInactive?: boolean;
  includeSystem?: boolean;
  maxDepth?: number;
  parentId?: string | null;
  withStats?: boolean;
}
export declare class CategoryRepository {
  private db;
  private preparedStatements;
  constructor(db: Database.Database);
  private initializePreparedStatements;
  create(categoryData: CreateCategory, userId?: string): Promise<CategoryNode>;
  update(id: string, updates: UpdateCategory, userId?: string): Promise<CategoryNode>;
  delete(
    id: string,
    options?: {
      force?: boolean;
    }
  ): Promise<void>;
  findById(id: string, options?: CategoryQueryOptions): Promise<CategoryNode | null>;
  findBySlug(slug: string, options?: CategoryQueryOptions): Promise<CategoryNode | null>;
  getHierarchy(options?: CategoryQueryOptions): Promise<CategoryTree[]>;
  getChildren(parentId: string | null, options?: CategoryQueryOptions): Promise<CategoryNode[]>;
  getAncestors(categoryId: string): Promise<CategoryNode[]>;
  getDescendants(parentId: string, options?: CategoryQueryOptions): Promise<CategoryNode[]>;
  reorder(parentId: string | null, categoryIds: string[]): Promise<void>;
  move(categoryId: string, newParentId: string | null): Promise<CategoryNode>;
  bulkOperation(operation: BulkCategoryOperation): Promise<BulkOperationResult>;
  getAnalytics(categoryId: string): Promise<CategoryAnalytics | null>;
  updateAnalytics(categoryId: string, analytics: Partial<CategoryAnalytics>): Promise<void>;
  private getRootCategories;
  private buildCategoryTrees;
  private wouldCreateCircularReference;
  private updateSubtreeLevels;
  cleanup(): void;
}
export default CategoryRepository;
//# sourceMappingURL=CategoryRepository.d.ts.map
