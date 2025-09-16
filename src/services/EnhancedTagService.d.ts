import { EventEmitter } from 'events';
import { z } from 'zod';
export declare const TagSchema: any;
export type Tag = z.infer<typeof TagSchema>;
export declare const TagSuggestionSchema: any;
export type TagSuggestion = z.infer<typeof TagSuggestionSchema>;
export declare const TagRelationshipSchema: any;
export type TagRelationship = z.infer<typeof TagRelationshipSchema>;
export declare const TagAnalyticsSchema: any;
export type TagAnalytics = z.infer<typeof TagAnalyticsSchema>;
export declare const TagMergeOperationSchema: any;
export type TagMergeOperation = z.infer<typeof TagMergeOperationSchema>;
export interface TagServiceOptions {
    enableAISuggestions?: boolean;
    maxSuggestions?: number;
    minUsageForTrending?: number;
    trendingTimeWindow?: number;
    enableTagValidation?: boolean;
    autoNormalize?: boolean;
    enableCaching?: boolean;
    cacheTimeout?: number;
}
export declare class EnhancedTagService extends EventEmitter {
    private tags;
    private tagsByName;
    private tagRelationships;
    private tagAnalytics;
    private suggestionCache;
    private options;
    constructor(options?: TagServiceOptions);
    createTag(tagData: Omit<Tag, 'id' | 'normalized_name' | 'slug' | 'created_at' | 'updated_at'>): Promise<Tag>;
    updateTag(id: string, updates: Partial<Tag>): Promise<Tag>;
    deleteTag(id: string, options?: {
        removeFromEntries?: boolean;
        replaceWith?: string;
    }): Promise<void>;
    getSuggestions(query: string, options?: {
        context?: {
            entryText?: string;
            category?: string;
            existingTags?: string[];
        };
        includeAI?: boolean;
        maxResults?: number;
    }): Promise<TagSuggestion[]>;
    getAutocompleteSuggestions(input: string, excludeTags?: string[], limit?: number): Promise<Tag[]>;
    getTrendingTags(limit?: number): Promise<Tag[]>;
    getTagStats(tagId: string): Promise<{
        usage: TagAnalytics[];
        relationships: TagRelationship[];
        recentEntries: any[];
        trending: {
            score: number;
            rank: number;
        };
    }>;
    getTagCloud(options?: {
        minUsage?: number;
        maxTags?: number;
        category?: string;
        timeRange?: {
            from: Date;
            to: Date;
        };
    }): Promise<Array<{
        tag: Tag;
        weight: number;
    }>>;
    createTagRelationship(tagId: string, relatedTagId: string, relationshipType: TagRelationship['relationship_type'], strength?: number): Promise<TagRelationship>;
    getRelatedTags(tagIds: string[]): Promise<Array<{
        tag: Tag;
        relationship: TagRelationship;
    }>>;
    mergeTags(operation: TagMergeOperation): Promise<void>;
    splitTag(sourceTagId: string, splits: Array<{
        name: string;
        criteria: (entryText: string) => boolean;
    }>): Promise<Tag[]>;
    renameTag(tagId: string, newName: string): Promise<Tag>;
    bulkTagOperation(operation: 'activate' | 'deactivate' | 'delete' | 'update', tagIds: string[], data?: Partial<Tag>): Promise<{
        success: string[];
        errors: Array<{
            id: string;
            error: string;
        }>;
    }>;
    private initializeSystemTags;
    private validateTagName;
    private normalizeTagName;
    private generateSlug;
    private generateId;
    private calculateStringSimilarity;
    private levenshteinDistance;
    private normalizeWeight;
    private generateSuggestionCacheKey;
    private deduplicateSuggestions;
    protected abstract insertTag(tag: Tag): Promise<void>;
    protected abstract updateTagInStorage(tag: Tag): Promise<void>;
    protected abstract deleteTagFromStorage(id: string): Promise<void>;
    protected abstract insertTagRelationship(relationship: TagRelationship): Promise<void>;
    protected abstract removeTagFromAllEntries(tagId: string, replacementTagId?: string): Promise<void>;
    protected abstract replaceTagInEntries(oldTagId: string, newTagId: string): Promise<void>;
    protected abstract transferTagRelationships(fromTagId: string, toTagId: string): Promise<void>;
    protected abstract applyTagByCriteria(tagId: string, criteria: (entryText: string) => boolean): Promise<void>;
    protected abstract getTagsByCategory(categoryId: string): Promise<Tag[]>;
    protected abstract getTagRelationship(tagId1: string, tagId2: string): Promise<TagRelationship | null>;
    protected abstract getRecentEntriesForTag(tagId: string): Promise<any[]>;
    protected abstract getTagTrendingInfo(tagId: string): Promise<{
        score: number;
        rank: number;
    }>;
    protected abstract findTagsByName(query: string, options: {
        exact?: boolean;
        fuzzy?: boolean;
    }): Tag[];
    protected abstract getAISuggestions(entryText: string, query: string): Promise<TagSuggestion[]>;
}
//# sourceMappingURL=EnhancedTagService.d.ts.map