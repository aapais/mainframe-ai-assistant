import Database from 'better-sqlite3';
import {
  Tag,
  CreateTag,
  UpdateTag,
  TagAssociation,
  BulkTagOperation,
  BulkOperationResult,
  TagAnalytics,
} from '../schemas/HierarchicalCategories.schema';
export interface TagQueryOptions {
  includeSystem?: boolean;
  categoryId?: string;
  sortBy?: 'name' | 'usage_count' | 'created_at';
  sortDirection?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}
export interface TagSearchOptions {
  query?: string;
  categoryId?: string;
  excludeIds?: string[];
  limit?: number;
  fuzzy?: boolean;
}
export interface TagAssociationOptions {
  relevanceScore?: number;
  assignedBy?: 'user' | 'system' | 'ai';
  confidence?: number;
}
export declare class TagRepository {
  private db;
  private preparedStatements;
  constructor(db: Database.Database);
  private initializePreparedStatements;
  create(tagData: CreateTag, userId?: string): Promise<Tag>;
  update(id: string, updates: UpdateTag, userId?: string): Promise<Tag>;
  delete(
    id: string,
    options?: {
      force?: boolean;
    }
  ): Promise<void>;
  findById(id: string): Promise<Tag | null>;
  findByName(name: string): Promise<Tag | null>;
  search(options: TagSearchOptions): Promise<Tag[]>;
  findAll(options?: TagQueryOptions): Promise<Tag[]>;
  associateWithEntry(
    entryId: string,
    tagId: string,
    options?: TagAssociationOptions,
    userId?: string
  ): Promise<void>;
  dissociateFromEntry(entryId: string, tagId: string): Promise<void>;
  getEntryTags(entryId: string): Promise<(Tag & TagAssociation)[]>;
  getTagEntries(tagId: string): Promise<any[]>;
  replaceEntryTags(
    entryId: string,
    tagIds: string[],
    options?: TagAssociationOptions,
    userId?: string
  ): Promise<void>;
  getSuggestions(
    query: string,
    options?: {
      limit?: number;
      categoryId?: string;
      contextEntryId?: string;
    }
  ): Promise<Tag[]>;
  bulkOperation(operation: BulkTagOperation): Promise<BulkOperationResult>;
  getAnalytics(tagId: string): Promise<TagAnalytics | null>;
  updateAnalytics(tagId: string, analytics: Partial<TagAnalytics>): Promise<void>;
  getMostUsed(limit?: number): Promise<Tag[]>;
  getTrending(
    days?: number,
    limit?: number
  ): Promise<
    (Tag & {
      recent_usage: number;
    })[]
  >;
  cleanup(): void;
}
export default TagRepository;
//# sourceMappingURL=TagRepository.d.ts.map
