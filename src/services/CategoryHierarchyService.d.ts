import { EventEmitter } from 'events';
import { z } from 'zod';
export declare const CategoryNodeSchema: any;
export type CategoryNode = z.infer<typeof CategoryNodeSchema>;
export declare const CategoryTreeSchema: any;
export type CategoryTree = z.infer<typeof CategoryTreeSchema>;
export declare const CategoryStatsSchema: any;
export type CategoryStats = z.infer<typeof CategoryStatsSchema>;
export declare const CategoryMoveOperationSchema: any;
export type CategoryMoveOperation = z.infer<typeof CategoryMoveOperationSchema>;
export interface CategoryHierarchyOptions {
  maxDepth?: number;
  allowDuplicateNames?: boolean;
  autoGenerateSlugs?: boolean;
  enableCaching?: boolean;
  validateOnMove?: boolean;
}
export declare class CategoryHierarchyService extends EventEmitter {
  private categories;
  private categoryTree;
  private parentChildMap;
  private slugMap;
  private pathCache;
  private options;
  constructor(options?: CategoryHierarchyOptions);
  createCategory(
    categoryData: Omit<CategoryNode, 'id' | 'level' | 'created_at' | 'updated_at'>
  ): Promise<CategoryNode>;
  updateCategory(id: string, updates: Partial<CategoryNode>): Promise<CategoryNode>;
  deleteCategory(id: string, force?: boolean): Promise<void>;
  getCategoryTree(rootId?: string): CategoryTree[];
  private buildCategoryTree;
  getCategoryPath(categoryId: string): string[];
  findCategoryByPath(path: string[]): CategoryNode | null;
  getAncestors(categoryId: string): CategoryNode[];
  getDescendants(categoryId: string): CategoryNode[];
  searchCategories(
    query: string,
    options?: {
      includeDescendants?: boolean;
      activeOnly?: boolean;
      maxResults?: number;
    }
  ): CategoryNode[];
  getCategoriesByLevel(level: number): CategoryNode[];
  getPopularCategories(limit?: number): CategoryNode[];
  moveCategory(operation: CategoryMoveOperation): Promise<void>;
  reorderCategories(parentId: string | null, orderedIds: string[]): Promise<void>;
  exportCategories(rootId?: string): any;
  importCategories(
    data: any,
    options?: {
      mergeStrategy?: 'replace' | 'merge' | 'skip';
      validateStructure?: boolean;
    }
  ): Promise<{
    imported: number;
    skipped: number;
    errors: string[];
  }>;
  private initializeSystemCategories;
  private generateId;
  private generateSlug;
  private generateUniqueSlug;
  private getRootCategories;
  private getChildren;
  private validateParentChange;
  private findCategoryBySlug;
  private validateImportStructure;
  private flattenCategoryTree;
  protected abstract insertCategory(category: CategoryNode): Promise<void>;
  protected abstract updateCategoryInStorage(category: CategoryNode): Promise<void>;
  protected abstract deleteCategoryFromStorage(id: string): Promise<void>;
  protected abstract getCategoryEntryCount(categoryId: string): Promise<number>;
}
//# sourceMappingURL=CategoryHierarchyService.d.ts.map
