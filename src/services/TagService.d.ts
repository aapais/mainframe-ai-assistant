import { EventEmitter } from 'events';
import {
  TagRepository,
  TagQueryOptions,
  TagSearchOptions,
  TagAssociationOptions,
} from '../database/repositories/TagRepository';
import { CacheService } from './CacheService';
import {
  Tag,
  CreateTag,
  UpdateTag,
  TagAssociation,
  BulkTagOperation,
  BulkOperationResult,
  TagAnalytics,
} from '../database/schemas/HierarchicalCategories.schema';
export interface TagServiceConfig {
  cacheEnabled?: boolean;
  cacheTTL?: number;
  suggestionCacheTTL?: number;
  analyticsEnabled?: boolean;
  maxTagsPerEntry?: number;
  enableAutoSuggestions?: boolean;
}
export declare class TagService extends EventEmitter {
  private tagRepository;
  private cacheService?;
  private config;
  constructor(tagRepository: TagRepository, cacheService?: CacheService, config?: TagServiceConfig);
  createTag(data: CreateTag, userId?: string): Promise<Tag>;
  updateTag(id: string, updates: UpdateTag, userId?: string): Promise<Tag>;
  deleteTag(
    id: string,
    options?: {
      force?: boolean;
    },
    userId?: string
  ): Promise<void>;
  getTagById(id: string): Promise<Tag | null>;
  getTagByName(name: string): Promise<Tag | null>;
  searchTags(options: TagSearchOptions): Promise<Tag[]>;
  getAllTags(options?: TagQueryOptions): Promise<Tag[]>;
  getTagsByCategory(categoryId: string, options?: TagQueryOptions): Promise<Tag[]>;
  associateTagWithEntry(
    entryId: string,
    tagId: string,
    options?: TagAssociationOptions,
    userId?: string
  ): Promise<void>;
  dissociateTagFromEntry(entryId: string, tagId: string, userId?: string): Promise<void>;
  getEntryTags(entryId: string): Promise<(Tag & TagAssociation)[]>;
  getTagEntries(tagId: string): Promise<any[]>;
  replaceEntryTags(
    entryId: string,
    tagIds: string[],
    options?: TagAssociationOptions,
    userId?: string
  ): Promise<void>;
  getTagSuggestions(
    query: string,
    options?: {
      limit?: number;
      categoryId?: string;
      contextEntryId?: string;
    }
  ): Promise<Tag[]>;
  getOrCreateTag(
    name: string,
    options?: {
      displayName?: string;
      categoryId?: string;
      color?: string;
      description?: string;
    },
    userId?: string
  ): Promise<Tag>;
  bulkOperation(operation: BulkTagOperation, userId?: string): Promise<BulkOperationResult>;
  getTagAnalytics(tagId: string): Promise<TagAnalytics | null>;
  updateTagAnalytics(tagId: string, analytics: Partial<TagAnalytics>): Promise<void>;
  getMostUsedTags(limit?: number): Promise<Tag[]>;
  getTrendingTags(
    days?: number,
    limit?: number
  ): Promise<
    (Tag & {
      recent_usage: number;
    })[]
  >;
  getTagStats(): Promise<{
    totalTags: number;
    systemTags: number;
    suggestedTags: number;
    mostUsedTag: {
      tag: Tag;
      usage: number;
    } | null;
    averageTagsPerEntry: number;
  }>;
  cleanupUnusedTags(options?: { dryRun?: boolean; excludeSystem?: boolean }): Promise<{
    found: number;
    removed: number;
    tags: Tag[];
  }>;
  private invalidateTagListCache;
  private invalidateAllCache;
  cleanup(): void;
}
export default TagService;
//# sourceMappingURL=TagService.d.ts.map
