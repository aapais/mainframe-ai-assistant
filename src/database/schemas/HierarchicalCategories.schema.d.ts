import { z } from 'zod';
export declare const CategoryNodeSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    slug: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    parent_id: z.ZodNullable<z.ZodString>;
    level: z.ZodNumber;
    sort_order: z.ZodDefault<z.ZodNumber>;
    icon: z.ZodOptional<z.ZodString>;
    color: z.ZodOptional<z.ZodString>;
    is_active: z.ZodDefault<z.ZodBoolean>;
    is_system: z.ZodDefault<z.ZodBoolean>;
    entry_count: z.ZodDefault<z.ZodNumber>;
    created_at: z.ZodOptional<z.ZodDate>;
    updated_at: z.ZodOptional<z.ZodDate>;
    created_by: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    name: string;
    level: number;
    slug: string;
    parent_id: string | null;
    sort_order: number;
    is_active: boolean;
    is_system: boolean;
    entry_count: number;
    created_at?: Date | undefined;
    updated_at?: Date | undefined;
    created_by?: string | undefined;
    icon?: string | undefined;
    description?: string | undefined;
    color?: string | undefined;
}, {
    id: string;
    name: string;
    level: number;
    slug: string;
    parent_id: string | null;
    created_at?: Date | undefined;
    updated_at?: Date | undefined;
    created_by?: string | undefined;
    icon?: string | undefined;
    description?: string | undefined;
    sort_order?: number | undefined;
    color?: string | undefined;
    is_active?: boolean | undefined;
    is_system?: boolean | undefined;
    entry_count?: number | undefined;
}>;
export type CategoryNode = z.infer<typeof CategoryNodeSchema>;
export declare const CategoryTreeSchema: any;
export type CategoryTree = z.infer<typeof CategoryTreeSchema>;
export declare const CreateCategorySchema: z.ZodObject<Omit<{
    id: z.ZodString;
    name: z.ZodString;
    slug: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    parent_id: z.ZodNullable<z.ZodString>;
    level: z.ZodNumber;
    sort_order: z.ZodDefault<z.ZodNumber>;
    icon: z.ZodOptional<z.ZodString>;
    color: z.ZodOptional<z.ZodString>;
    is_active: z.ZodDefault<z.ZodBoolean>;
    is_system: z.ZodDefault<z.ZodBoolean>;
    entry_count: z.ZodDefault<z.ZodNumber>;
    created_at: z.ZodOptional<z.ZodDate>;
    updated_at: z.ZodOptional<z.ZodDate>;
    created_by: z.ZodOptional<z.ZodString>;
}, "id" | "created_at" | "updated_at" | "level" | "entry_count">, "strip", z.ZodTypeAny, {
    name: string;
    slug: string;
    parent_id: string | null;
    sort_order: number;
    is_active: boolean;
    is_system: boolean;
    created_by?: string | undefined;
    icon?: string | undefined;
    description?: string | undefined;
    color?: string | undefined;
}, {
    name: string;
    slug: string;
    parent_id: string | null;
    created_by?: string | undefined;
    icon?: string | undefined;
    description?: string | undefined;
    sort_order?: number | undefined;
    color?: string | undefined;
    is_active?: boolean | undefined;
    is_system?: boolean | undefined;
}>;
export type CreateCategory = z.infer<typeof CreateCategorySchema>;
export declare const UpdateCategorySchema: z.ZodObject<Omit<{
    id: z.ZodOptional<z.ZodString>;
    name: z.ZodOptional<z.ZodString>;
    slug: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    parent_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    level: z.ZodOptional<z.ZodNumber>;
    sort_order: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    icon: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    color: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    is_active: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    is_system: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    entry_count: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    created_at: z.ZodOptional<z.ZodOptional<z.ZodDate>>;
    updated_at: z.ZodOptional<z.ZodOptional<z.ZodDate>>;
    created_by: z.ZodOptional<z.ZodOptional<z.ZodString>>;
}, "id" | "created_at" | "created_by" | "level" | "entry_count">, "strip", z.ZodTypeAny, {
    updated_at?: Date | undefined;
    icon?: string | undefined;
    name?: string | undefined;
    description?: string | undefined;
    slug?: string | undefined;
    parent_id?: string | null | undefined;
    sort_order?: number | undefined;
    color?: string | undefined;
    is_active?: boolean | undefined;
    is_system?: boolean | undefined;
}, {
    updated_at?: Date | undefined;
    icon?: string | undefined;
    name?: string | undefined;
    description?: string | undefined;
    slug?: string | undefined;
    parent_id?: string | null | undefined;
    sort_order?: number | undefined;
    color?: string | undefined;
    is_active?: boolean | undefined;
    is_system?: boolean | undefined;
}>;
export type UpdateCategory = z.infer<typeof UpdateCategorySchema>;
export declare const TagSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodEffects<z.ZodString, string, string>;
    display_name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    category_id: z.ZodNullable<z.ZodString>;
    color: z.ZodOptional<z.ZodString>;
    usage_count: z.ZodDefault<z.ZodNumber>;
    is_system: z.ZodDefault<z.ZodBoolean>;
    is_suggested: z.ZodDefault<z.ZodBoolean>;
    created_at: z.ZodOptional<z.ZodDate>;
    updated_at: z.ZodOptional<z.ZodDate>;
    created_by: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    usage_count: number;
    name: string;
    is_system: boolean;
    display_name: string;
    category_id: string | null;
    is_suggested: boolean;
    created_at?: Date | undefined;
    updated_at?: Date | undefined;
    created_by?: string | undefined;
    description?: string | undefined;
    color?: string | undefined;
}, {
    id: string;
    name: string;
    display_name: string;
    category_id: string | null;
    created_at?: Date | undefined;
    updated_at?: Date | undefined;
    created_by?: string | undefined;
    usage_count?: number | undefined;
    description?: string | undefined;
    color?: string | undefined;
    is_system?: boolean | undefined;
    is_suggested?: boolean | undefined;
}>;
export type Tag = z.infer<typeof TagSchema>;
export declare const CreateTagSchema: z.ZodObject<Omit<{
    id: z.ZodString;
    name: z.ZodEffects<z.ZodString, string, string>;
    display_name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    category_id: z.ZodNullable<z.ZodString>;
    color: z.ZodOptional<z.ZodString>;
    usage_count: z.ZodDefault<z.ZodNumber>;
    is_system: z.ZodDefault<z.ZodBoolean>;
    is_suggested: z.ZodDefault<z.ZodBoolean>;
    created_at: z.ZodOptional<z.ZodDate>;
    updated_at: z.ZodOptional<z.ZodDate>;
    created_by: z.ZodOptional<z.ZodString>;
}, "id" | "created_at" | "updated_at" | "usage_count">, "strip", z.ZodTypeAny, {
    name: string;
    is_system: boolean;
    display_name: string;
    category_id: string | null;
    is_suggested: boolean;
    created_by?: string | undefined;
    description?: string | undefined;
    color?: string | undefined;
}, {
    name: string;
    display_name: string;
    category_id: string | null;
    created_by?: string | undefined;
    description?: string | undefined;
    color?: string | undefined;
    is_system?: boolean | undefined;
    is_suggested?: boolean | undefined;
}>;
export type CreateTag = z.infer<typeof CreateTagSchema>;
export declare const UpdateTagSchema: z.ZodObject<Omit<{
    id: z.ZodOptional<z.ZodString>;
    name: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    display_name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    category_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    color: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    usage_count: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    is_system: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    is_suggested: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    created_at: z.ZodOptional<z.ZodOptional<z.ZodDate>>;
    updated_at: z.ZodOptional<z.ZodOptional<z.ZodDate>>;
    created_by: z.ZodOptional<z.ZodOptional<z.ZodString>>;
}, "id" | "created_at" | "created_by" | "usage_count">, "strip", z.ZodTypeAny, {
    updated_at?: Date | undefined;
    name?: string | undefined;
    description?: string | undefined;
    color?: string | undefined;
    is_system?: boolean | undefined;
    display_name?: string | undefined;
    category_id?: string | null | undefined;
    is_suggested?: boolean | undefined;
}, {
    updated_at?: Date | undefined;
    name?: string | undefined;
    description?: string | undefined;
    color?: string | undefined;
    is_system?: boolean | undefined;
    display_name?: string | undefined;
    category_id?: string | null | undefined;
    is_suggested?: boolean | undefined;
}>;
export type UpdateTag = z.infer<typeof UpdateTagSchema>;
export declare const TagAssociationSchema: z.ZodObject<{
    id: z.ZodString;
    entry_id: z.ZodString;
    tag_id: z.ZodString;
    relevance_score: z.ZodOptional<z.ZodNumber>;
    assigned_by: z.ZodDefault<z.ZodEnum<["user", "system", "ai"]>>;
    confidence: z.ZodOptional<z.ZodNumber>;
    created_at: z.ZodOptional<z.ZodDate>;
    created_by: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    entry_id: string;
    tag_id: string;
    assigned_by: "ai" | "system" | "user";
    created_at?: Date | undefined;
    created_by?: string | undefined;
    confidence?: number | undefined;
    relevance_score?: number | undefined;
}, {
    id: string;
    entry_id: string;
    tag_id: string;
    created_at?: Date | undefined;
    created_by?: string | undefined;
    confidence?: number | undefined;
    relevance_score?: number | undefined;
    assigned_by?: "ai" | "system" | "user" | undefined;
}>;
export type TagAssociation = z.infer<typeof TagAssociationSchema>;
export declare const BulkCategoryOperationSchema: z.ZodObject<{
    operation: z.ZodEnum<["create", "update", "delete", "move", "reorder"]>;
    categories: z.ZodArray<z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        data: z.ZodRecord<z.ZodString, z.ZodAny>;
        target_parent_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        new_sort_order: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        data: Record<string, any>;
        id?: string | undefined;
        target_parent_id?: string | null | undefined;
        new_sort_order?: number | undefined;
    }, {
        data: Record<string, any>;
        id?: string | undefined;
        target_parent_id?: string | null | undefined;
        new_sort_order?: number | undefined;
    }>, "many">;
    options: z.ZodOptional<z.ZodObject<{
        cascade_delete: z.ZodDefault<z.ZodBoolean>;
        preserve_entries: z.ZodDefault<z.ZodBoolean>;
        validate_hierarchy: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        cascade_delete: boolean;
        preserve_entries: boolean;
        validate_hierarchy: boolean;
    }, {
        cascade_delete?: boolean | undefined;
        preserve_entries?: boolean | undefined;
        validate_hierarchy?: boolean | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    operation: "create" | "update" | "delete" | "move" | "reorder";
    categories: {
        data: Record<string, any>;
        id?: string | undefined;
        target_parent_id?: string | null | undefined;
        new_sort_order?: number | undefined;
    }[];
    options?: {
        cascade_delete: boolean;
        preserve_entries: boolean;
        validate_hierarchy: boolean;
    } | undefined;
}, {
    operation: "create" | "update" | "delete" | "move" | "reorder";
    categories: {
        data: Record<string, any>;
        id?: string | undefined;
        target_parent_id?: string | null | undefined;
        new_sort_order?: number | undefined;
    }[];
    options?: {
        cascade_delete?: boolean | undefined;
        preserve_entries?: boolean | undefined;
        validate_hierarchy?: boolean | undefined;
    } | undefined;
}>;
export type BulkCategoryOperation = z.infer<typeof BulkCategoryOperationSchema>;
export declare const BulkTagOperationSchema: z.ZodObject<{
    operation: z.ZodEnum<["create", "update", "delete", "assign", "unassign", "merge"]>;
    tags: z.ZodArray<z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        data: z.ZodRecord<z.ZodString, z.ZodAny>;
        entry_ids: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        merge_into_id: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        data: Record<string, any>;
        id?: string | undefined;
        entry_ids?: string[] | undefined;
        merge_into_id?: string | undefined;
    }, {
        data: Record<string, any>;
        id?: string | undefined;
        entry_ids?: string[] | undefined;
        merge_into_id?: string | undefined;
    }>, "many">;
    options: z.ZodOptional<z.ZodObject<{
        force_delete: z.ZodDefault<z.ZodBoolean>;
        update_usage_count: z.ZodDefault<z.ZodBoolean>;
        validate_associations: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        force_delete: boolean;
        update_usage_count: boolean;
        validate_associations: boolean;
    }, {
        force_delete?: boolean | undefined;
        update_usage_count?: boolean | undefined;
        validate_associations?: boolean | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    tags: {
        data: Record<string, any>;
        id?: string | undefined;
        entry_ids?: string[] | undefined;
        merge_into_id?: string | undefined;
    }[];
    operation: "create" | "update" | "delete" | "merge" | "assign" | "unassign";
    options?: {
        force_delete: boolean;
        update_usage_count: boolean;
        validate_associations: boolean;
    } | undefined;
}, {
    tags: {
        data: Record<string, any>;
        id?: string | undefined;
        entry_ids?: string[] | undefined;
        merge_into_id?: string | undefined;
    }[];
    operation: "create" | "update" | "delete" | "merge" | "assign" | "unassign";
    options?: {
        force_delete?: boolean | undefined;
        update_usage_count?: boolean | undefined;
        validate_associations?: boolean | undefined;
    } | undefined;
}>;
export type BulkTagOperation = z.infer<typeof BulkTagOperationSchema>;
export declare const BulkOperationResultSchema: z.ZodObject<{
    operation: z.ZodString;
    total_items: z.ZodNumber;
    successful: z.ZodNumber;
    failed: z.ZodNumber;
    errors: z.ZodArray<z.ZodObject<{
        item_id: z.ZodOptional<z.ZodString>;
        error: z.ZodString;
        details: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    }, "strip", z.ZodTypeAny, {
        error: string;
        details?: Record<string, any> | undefined;
        item_id?: string | undefined;
    }, {
        error: string;
        details?: Record<string, any> | undefined;
        item_id?: string | undefined;
    }>, "many">;
    execution_time: z.ZodNumber;
    transaction_id: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    failed: number;
    operation: string;
    errors: {
        error: string;
        details?: Record<string, any> | undefined;
        item_id?: string | undefined;
    }[];
    successful: number;
    total_items: number;
    execution_time: number;
    transaction_id?: string | undefined;
}, {
    failed: number;
    operation: string;
    errors: {
        error: string;
        details?: Record<string, any> | undefined;
        item_id?: string | undefined;
    }[];
    successful: number;
    total_items: number;
    execution_time: number;
    transaction_id?: string | undefined;
}>;
export type BulkOperationResult = z.infer<typeof BulkOperationResultSchema>;
export declare const AutocompleteSuggestionSchema: z.ZodObject<{
    id: z.ZodString;
    type: z.ZodEnum<["category", "tag", "entry", "search_term"]>;
    value: z.ZodString;
    display_value: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    score: z.ZodNumber;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    usage_count: z.ZodOptional<z.ZodNumber>;
    last_used: z.ZodOptional<z.ZodDate>;
}, "strip", z.ZodTypeAny, {
    id: string;
    score: number;
    value: string;
    type: "category" | "tag" | "entry" | "search_term";
    display_value: string;
    usage_count?: number | undefined;
    last_used?: Date | undefined;
    description?: string | undefined;
    metadata?: Record<string, any> | undefined;
}, {
    id: string;
    score: number;
    value: string;
    type: "category" | "tag" | "entry" | "search_term";
    display_value: string;
    usage_count?: number | undefined;
    last_used?: Date | undefined;
    description?: string | undefined;
    metadata?: Record<string, any> | undefined;
}>;
export type AutocompleteSuggestion = z.infer<typeof AutocompleteSuggestionSchema>;
export declare const AutocompleteQuerySchema: z.ZodObject<{
    query: z.ZodString;
    types: z.ZodDefault<z.ZodArray<z.ZodEnum<["category", "tag", "entry", "search_term"]>, "many">>;
    limit: z.ZodDefault<z.ZodNumber>;
    context: z.ZodOptional<z.ZodObject<{
        current_category_id: z.ZodOptional<z.ZodString>;
        exclude_ids: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        entry_id: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        entry_id?: string | undefined;
        current_category_id?: string | undefined;
        exclude_ids?: string[] | undefined;
    }, {
        entry_id?: string | undefined;
        current_category_id?: string | undefined;
        exclude_ids?: string[] | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    query: string;
    types: ("category" | "tag" | "entry" | "search_term")[];
    context?: {
        entry_id?: string | undefined;
        current_category_id?: string | undefined;
        exclude_ids?: string[] | undefined;
    } | undefined;
}, {
    query: string;
    limit?: number | undefined;
    context?: {
        entry_id?: string | undefined;
        current_category_id?: string | undefined;
        exclude_ids?: string[] | undefined;
    } | undefined;
    types?: ("category" | "tag" | "entry" | "search_term")[] | undefined;
}>;
export type AutocompleteQuery = z.infer<typeof AutocompleteQuerySchema>;
export declare const SearchFacetSchema: z.ZodObject<{
    key: z.ZodString;
    name: z.ZodString;
    type: z.ZodEnum<["category", "tag", "range", "boolean", "date"]>;
    values: z.ZodArray<z.ZodObject<{
        value: z.ZodString;
        display_value: z.ZodString;
        count: z.ZodNumber;
        selected: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        value: string;
        count: number;
        display_value: string;
        selected: boolean;
    }, {
        value: string;
        count: number;
        display_value: string;
        selected?: boolean | undefined;
    }>, "many">;
    min_value: z.ZodOptional<z.ZodNumber>;
    max_value: z.ZodOptional<z.ZodNumber>;
    is_hierarchical: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    key: string;
    values: {
        value: string;
        count: number;
        display_value: string;
        selected: boolean;
    }[];
    type: "boolean" | "category" | "tag" | "date" | "range";
    name: string;
    is_hierarchical: boolean;
    min_value?: number | undefined;
    max_value?: number | undefined;
}, {
    key: string;
    values: {
        value: string;
        count: number;
        display_value: string;
        selected?: boolean | undefined;
    }[];
    type: "boolean" | "category" | "tag" | "date" | "range";
    name: string;
    min_value?: number | undefined;
    max_value?: number | undefined;
    is_hierarchical?: boolean | undefined;
}>;
export type SearchFacet = z.infer<typeof SearchFacetSchema>;
export declare const FacetedSearchQuerySchema: z.ZodObject<{
    query: z.ZodDefault<z.ZodString>;
    facets: z.ZodRecord<z.ZodString, z.ZodArray<z.ZodString, "many">>;
    sort: z.ZodOptional<z.ZodObject<{
        field: z.ZodString;
        direction: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
    }, "strip", z.ZodTypeAny, {
        field: string;
        direction: "asc" | "desc";
    }, {
        field: string;
        direction?: "asc" | "desc" | undefined;
    }>>;
    pagination: z.ZodOptional<z.ZodObject<{
        page: z.ZodDefault<z.ZodNumber>;
        page_size: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        page_size: number;
        page: number;
    }, {
        page_size?: number | undefined;
        page?: number | undefined;
    }>>;
    filters: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, "strip", z.ZodTypeAny, {
    query: string;
    facets: Record<string, string[]>;
    sort?: {
        field: string;
        direction: "asc" | "desc";
    } | undefined;
    pagination?: {
        page_size: number;
        page: number;
    } | undefined;
    filters?: Record<string, any> | undefined;
}, {
    facets: Record<string, string[]>;
    sort?: {
        field: string;
        direction?: "asc" | "desc" | undefined;
    } | undefined;
    query?: string | undefined;
    pagination?: {
        page_size?: number | undefined;
        page?: number | undefined;
    } | undefined;
    filters?: Record<string, any> | undefined;
}>;
export type FacetedSearchQuery = z.infer<typeof FacetedSearchQuerySchema>;
export declare const CategoryAnalyticsSchema: z.ZodObject<{
    category_id: z.ZodString;
    entry_count: z.ZodNumber;
    view_count: z.ZodNumber;
    search_count: z.ZodNumber;
    success_rate: z.ZodNumber;
    avg_resolution_time: z.ZodOptional<z.ZodNumber>;
    top_tags: z.ZodArray<z.ZodObject<{
        tag_id: z.ZodString;
        tag_name: z.ZodString;
        count: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        count: number;
        tag_id: string;
        tag_name: string;
    }, {
        count: number;
        tag_id: string;
        tag_name: string;
    }>, "many">;
    trend: z.ZodOptional<z.ZodObject<{
        direction: z.ZodEnum<["up", "down", "stable"]>;
        percentage: z.ZodNumber;
        period: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        percentage: number;
        direction: "up" | "down" | "stable";
        period: string;
    }, {
        percentage: number;
        direction: "up" | "down" | "stable";
        period: string;
    }>>;
    last_updated: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    last_updated: Date;
    success_rate: number;
    entry_count: number;
    category_id: string;
    view_count: number;
    search_count: number;
    top_tags: {
        count: number;
        tag_id: string;
        tag_name: string;
    }[];
    avg_resolution_time?: number | undefined;
    trend?: {
        percentage: number;
        direction: "up" | "down" | "stable";
        period: string;
    } | undefined;
}, {
    last_updated: Date;
    success_rate: number;
    entry_count: number;
    category_id: string;
    view_count: number;
    search_count: number;
    top_tags: {
        count: number;
        tag_id: string;
        tag_name: string;
    }[];
    avg_resolution_time?: number | undefined;
    trend?: {
        percentage: number;
        direction: "up" | "down" | "stable";
        period: string;
    } | undefined;
}>;
export type CategoryAnalytics = z.infer<typeof CategoryAnalyticsSchema>;
export declare const TagAnalyticsSchema: z.ZodObject<{
    tag_id: z.ZodString;
    usage_count: z.ZodNumber;
    entry_count: z.ZodNumber;
    categories: z.ZodArray<z.ZodObject<{
        category_id: z.ZodString;
        category_name: z.ZodString;
        count: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        count: number;
        category_id: string;
        category_name: string;
    }, {
        count: number;
        category_id: string;
        category_name: string;
    }>, "many">;
    co_occurrence: z.ZodArray<z.ZodObject<{
        tag_id: z.ZodString;
        tag_name: z.ZodString;
        count: z.ZodNumber;
        correlation: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        count: number;
        tag_id: string;
        tag_name: string;
        correlation: number;
    }, {
        count: number;
        tag_id: string;
        tag_name: string;
        correlation: number;
    }>, "many">;
    trend: z.ZodOptional<z.ZodObject<{
        direction: z.ZodEnum<["up", "down", "stable"]>;
        percentage: z.ZodNumber;
        period: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        percentage: number;
        direction: "up" | "down" | "stable";
        period: string;
    }, {
        percentage: number;
        direction: "up" | "down" | "stable";
        period: string;
    }>>;
    last_updated: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    usage_count: number;
    last_updated: Date;
    categories: {
        count: number;
        category_id: string;
        category_name: string;
    }[];
    entry_count: number;
    tag_id: string;
    co_occurrence: {
        count: number;
        tag_id: string;
        tag_name: string;
        correlation: number;
    }[];
    trend?: {
        percentage: number;
        direction: "up" | "down" | "stable";
        period: string;
    } | undefined;
}, {
    usage_count: number;
    last_updated: Date;
    categories: {
        count: number;
        category_id: string;
        category_name: string;
    }[];
    entry_count: number;
    tag_id: string;
    co_occurrence: {
        count: number;
        tag_id: string;
        tag_name: string;
        correlation: number;
    }[];
    trend?: {
        percentage: number;
        direction: "up" | "down" | "stable";
        period: string;
    } | undefined;
}>;
export type TagAnalytics = z.infer<typeof TagAnalyticsSchema>;
export declare class HierarchicalSchemaValidator {
    static validateCreateCategory(data: unknown): CreateCategory;
    static validateUpdateCategory(data: unknown): UpdateCategory;
    static validateCreateTag(data: unknown): CreateTag;
    static validateUpdateTag(data: unknown): UpdateTag;
    static validateBulkCategoryOperation(data: unknown): BulkCategoryOperation;
    static validateBulkTagOperation(data: unknown): BulkTagOperation;
    static validateAutocompleteQuery(data: unknown): AutocompleteQuery;
    static validateFacetedSearchQuery(data: unknown): FacetedSearchQuery;
    static validateCategoryHierarchy(categories: CategoryNode[]): {
        valid: boolean;
        errors: string[];
    };
}
export declare const HierarchicalSchemas: {
    readonly CategoryNode: z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        slug: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        parent_id: z.ZodNullable<z.ZodString>;
        level: z.ZodNumber;
        sort_order: z.ZodDefault<z.ZodNumber>;
        icon: z.ZodOptional<z.ZodString>;
        color: z.ZodOptional<z.ZodString>;
        is_active: z.ZodDefault<z.ZodBoolean>;
        is_system: z.ZodDefault<z.ZodBoolean>;
        entry_count: z.ZodDefault<z.ZodNumber>;
        created_at: z.ZodOptional<z.ZodDate>;
        updated_at: z.ZodOptional<z.ZodDate>;
        created_by: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        name: string;
        level: number;
        slug: string;
        parent_id: string | null;
        sort_order: number;
        is_active: boolean;
        is_system: boolean;
        entry_count: number;
        created_at?: Date | undefined;
        updated_at?: Date | undefined;
        created_by?: string | undefined;
        icon?: string | undefined;
        description?: string | undefined;
        color?: string | undefined;
    }, {
        id: string;
        name: string;
        level: number;
        slug: string;
        parent_id: string | null;
        created_at?: Date | undefined;
        updated_at?: Date | undefined;
        created_by?: string | undefined;
        icon?: string | undefined;
        description?: string | undefined;
        sort_order?: number | undefined;
        color?: string | undefined;
        is_active?: boolean | undefined;
        is_system?: boolean | undefined;
        entry_count?: number | undefined;
    }>;
    readonly CategoryTree: any;
    readonly CreateCategory: z.ZodObject<Omit<{
        id: z.ZodString;
        name: z.ZodString;
        slug: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        parent_id: z.ZodNullable<z.ZodString>;
        level: z.ZodNumber;
        sort_order: z.ZodDefault<z.ZodNumber>;
        icon: z.ZodOptional<z.ZodString>;
        color: z.ZodOptional<z.ZodString>;
        is_active: z.ZodDefault<z.ZodBoolean>;
        is_system: z.ZodDefault<z.ZodBoolean>;
        entry_count: z.ZodDefault<z.ZodNumber>;
        created_at: z.ZodOptional<z.ZodDate>;
        updated_at: z.ZodOptional<z.ZodDate>;
        created_by: z.ZodOptional<z.ZodString>;
    }, "id" | "created_at" | "updated_at" | "level" | "entry_count">, "strip", z.ZodTypeAny, {
        name: string;
        slug: string;
        parent_id: string | null;
        sort_order: number;
        is_active: boolean;
        is_system: boolean;
        created_by?: string | undefined;
        icon?: string | undefined;
        description?: string | undefined;
        color?: string | undefined;
    }, {
        name: string;
        slug: string;
        parent_id: string | null;
        created_by?: string | undefined;
        icon?: string | undefined;
        description?: string | undefined;
        sort_order?: number | undefined;
        color?: string | undefined;
        is_active?: boolean | undefined;
        is_system?: boolean | undefined;
    }>;
    readonly UpdateCategory: z.ZodObject<Omit<{
        id: z.ZodOptional<z.ZodString>;
        name: z.ZodOptional<z.ZodString>;
        slug: z.ZodOptional<z.ZodString>;
        description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        parent_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        level: z.ZodOptional<z.ZodNumber>;
        sort_order: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
        icon: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        color: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        is_active: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
        is_system: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
        entry_count: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
        created_at: z.ZodOptional<z.ZodOptional<z.ZodDate>>;
        updated_at: z.ZodOptional<z.ZodOptional<z.ZodDate>>;
        created_by: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    }, "id" | "created_at" | "created_by" | "level" | "entry_count">, "strip", z.ZodTypeAny, {
        updated_at?: Date | undefined;
        icon?: string | undefined;
        name?: string | undefined;
        description?: string | undefined;
        slug?: string | undefined;
        parent_id?: string | null | undefined;
        sort_order?: number | undefined;
        color?: string | undefined;
        is_active?: boolean | undefined;
        is_system?: boolean | undefined;
    }, {
        updated_at?: Date | undefined;
        icon?: string | undefined;
        name?: string | undefined;
        description?: string | undefined;
        slug?: string | undefined;
        parent_id?: string | null | undefined;
        sort_order?: number | undefined;
        color?: string | undefined;
        is_active?: boolean | undefined;
        is_system?: boolean | undefined;
    }>;
    readonly Tag: z.ZodObject<{
        id: z.ZodString;
        name: z.ZodEffects<z.ZodString, string, string>;
        display_name: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        category_id: z.ZodNullable<z.ZodString>;
        color: z.ZodOptional<z.ZodString>;
        usage_count: z.ZodDefault<z.ZodNumber>;
        is_system: z.ZodDefault<z.ZodBoolean>;
        is_suggested: z.ZodDefault<z.ZodBoolean>;
        created_at: z.ZodOptional<z.ZodDate>;
        updated_at: z.ZodOptional<z.ZodDate>;
        created_by: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        usage_count: number;
        name: string;
        is_system: boolean;
        display_name: string;
        category_id: string | null;
        is_suggested: boolean;
        created_at?: Date | undefined;
        updated_at?: Date | undefined;
        created_by?: string | undefined;
        description?: string | undefined;
        color?: string | undefined;
    }, {
        id: string;
        name: string;
        display_name: string;
        category_id: string | null;
        created_at?: Date | undefined;
        updated_at?: Date | undefined;
        created_by?: string | undefined;
        usage_count?: number | undefined;
        description?: string | undefined;
        color?: string | undefined;
        is_system?: boolean | undefined;
        is_suggested?: boolean | undefined;
    }>;
    readonly CreateTag: z.ZodObject<Omit<{
        id: z.ZodString;
        name: z.ZodEffects<z.ZodString, string, string>;
        display_name: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        category_id: z.ZodNullable<z.ZodString>;
        color: z.ZodOptional<z.ZodString>;
        usage_count: z.ZodDefault<z.ZodNumber>;
        is_system: z.ZodDefault<z.ZodBoolean>;
        is_suggested: z.ZodDefault<z.ZodBoolean>;
        created_at: z.ZodOptional<z.ZodDate>;
        updated_at: z.ZodOptional<z.ZodDate>;
        created_by: z.ZodOptional<z.ZodString>;
    }, "id" | "created_at" | "updated_at" | "usage_count">, "strip", z.ZodTypeAny, {
        name: string;
        is_system: boolean;
        display_name: string;
        category_id: string | null;
        is_suggested: boolean;
        created_by?: string | undefined;
        description?: string | undefined;
        color?: string | undefined;
    }, {
        name: string;
        display_name: string;
        category_id: string | null;
        created_by?: string | undefined;
        description?: string | undefined;
        color?: string | undefined;
        is_system?: boolean | undefined;
        is_suggested?: boolean | undefined;
    }>;
    readonly UpdateTag: z.ZodObject<Omit<{
        id: z.ZodOptional<z.ZodString>;
        name: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
        display_name: z.ZodOptional<z.ZodString>;
        description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        category_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        color: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        usage_count: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
        is_system: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
        is_suggested: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
        created_at: z.ZodOptional<z.ZodOptional<z.ZodDate>>;
        updated_at: z.ZodOptional<z.ZodOptional<z.ZodDate>>;
        created_by: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    }, "id" | "created_at" | "created_by" | "usage_count">, "strip", z.ZodTypeAny, {
        updated_at?: Date | undefined;
        name?: string | undefined;
        description?: string | undefined;
        color?: string | undefined;
        is_system?: boolean | undefined;
        display_name?: string | undefined;
        category_id?: string | null | undefined;
        is_suggested?: boolean | undefined;
    }, {
        updated_at?: Date | undefined;
        name?: string | undefined;
        description?: string | undefined;
        color?: string | undefined;
        is_system?: boolean | undefined;
        display_name?: string | undefined;
        category_id?: string | null | undefined;
        is_suggested?: boolean | undefined;
    }>;
    readonly TagAssociation: z.ZodObject<{
        id: z.ZodString;
        entry_id: z.ZodString;
        tag_id: z.ZodString;
        relevance_score: z.ZodOptional<z.ZodNumber>;
        assigned_by: z.ZodDefault<z.ZodEnum<["user", "system", "ai"]>>;
        confidence: z.ZodOptional<z.ZodNumber>;
        created_at: z.ZodOptional<z.ZodDate>;
        created_by: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        entry_id: string;
        tag_id: string;
        assigned_by: "ai" | "system" | "user";
        created_at?: Date | undefined;
        created_by?: string | undefined;
        confidence?: number | undefined;
        relevance_score?: number | undefined;
    }, {
        id: string;
        entry_id: string;
        tag_id: string;
        created_at?: Date | undefined;
        created_by?: string | undefined;
        confidence?: number | undefined;
        relevance_score?: number | undefined;
        assigned_by?: "ai" | "system" | "user" | undefined;
    }>;
    readonly BulkCategoryOperation: z.ZodObject<{
        operation: z.ZodEnum<["create", "update", "delete", "move", "reorder"]>;
        categories: z.ZodArray<z.ZodObject<{
            id: z.ZodOptional<z.ZodString>;
            data: z.ZodRecord<z.ZodString, z.ZodAny>;
            target_parent_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            new_sort_order: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            data: Record<string, any>;
            id?: string | undefined;
            target_parent_id?: string | null | undefined;
            new_sort_order?: number | undefined;
        }, {
            data: Record<string, any>;
            id?: string | undefined;
            target_parent_id?: string | null | undefined;
            new_sort_order?: number | undefined;
        }>, "many">;
        options: z.ZodOptional<z.ZodObject<{
            cascade_delete: z.ZodDefault<z.ZodBoolean>;
            preserve_entries: z.ZodDefault<z.ZodBoolean>;
            validate_hierarchy: z.ZodDefault<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            cascade_delete: boolean;
            preserve_entries: boolean;
            validate_hierarchy: boolean;
        }, {
            cascade_delete?: boolean | undefined;
            preserve_entries?: boolean | undefined;
            validate_hierarchy?: boolean | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        operation: "create" | "update" | "delete" | "move" | "reorder";
        categories: {
            data: Record<string, any>;
            id?: string | undefined;
            target_parent_id?: string | null | undefined;
            new_sort_order?: number | undefined;
        }[];
        options?: {
            cascade_delete: boolean;
            preserve_entries: boolean;
            validate_hierarchy: boolean;
        } | undefined;
    }, {
        operation: "create" | "update" | "delete" | "move" | "reorder";
        categories: {
            data: Record<string, any>;
            id?: string | undefined;
            target_parent_id?: string | null | undefined;
            new_sort_order?: number | undefined;
        }[];
        options?: {
            cascade_delete?: boolean | undefined;
            preserve_entries?: boolean | undefined;
            validate_hierarchy?: boolean | undefined;
        } | undefined;
    }>;
    readonly BulkTagOperation: z.ZodObject<{
        operation: z.ZodEnum<["create", "update", "delete", "assign", "unassign", "merge"]>;
        tags: z.ZodArray<z.ZodObject<{
            id: z.ZodOptional<z.ZodString>;
            data: z.ZodRecord<z.ZodString, z.ZodAny>;
            entry_ids: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            merge_into_id: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            data: Record<string, any>;
            id?: string | undefined;
            entry_ids?: string[] | undefined;
            merge_into_id?: string | undefined;
        }, {
            data: Record<string, any>;
            id?: string | undefined;
            entry_ids?: string[] | undefined;
            merge_into_id?: string | undefined;
        }>, "many">;
        options: z.ZodOptional<z.ZodObject<{
            force_delete: z.ZodDefault<z.ZodBoolean>;
            update_usage_count: z.ZodDefault<z.ZodBoolean>;
            validate_associations: z.ZodDefault<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            force_delete: boolean;
            update_usage_count: boolean;
            validate_associations: boolean;
        }, {
            force_delete?: boolean | undefined;
            update_usage_count?: boolean | undefined;
            validate_associations?: boolean | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        tags: {
            data: Record<string, any>;
            id?: string | undefined;
            entry_ids?: string[] | undefined;
            merge_into_id?: string | undefined;
        }[];
        operation: "create" | "update" | "delete" | "merge" | "assign" | "unassign";
        options?: {
            force_delete: boolean;
            update_usage_count: boolean;
            validate_associations: boolean;
        } | undefined;
    }, {
        tags: {
            data: Record<string, any>;
            id?: string | undefined;
            entry_ids?: string[] | undefined;
            merge_into_id?: string | undefined;
        }[];
        operation: "create" | "update" | "delete" | "merge" | "assign" | "unassign";
        options?: {
            force_delete?: boolean | undefined;
            update_usage_count?: boolean | undefined;
            validate_associations?: boolean | undefined;
        } | undefined;
    }>;
    readonly BulkOperationResult: z.ZodObject<{
        operation: z.ZodString;
        total_items: z.ZodNumber;
        successful: z.ZodNumber;
        failed: z.ZodNumber;
        errors: z.ZodArray<z.ZodObject<{
            item_id: z.ZodOptional<z.ZodString>;
            error: z.ZodString;
            details: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
        }, "strip", z.ZodTypeAny, {
            error: string;
            details?: Record<string, any> | undefined;
            item_id?: string | undefined;
        }, {
            error: string;
            details?: Record<string, any> | undefined;
            item_id?: string | undefined;
        }>, "many">;
        execution_time: z.ZodNumber;
        transaction_id: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        failed: number;
        operation: string;
        errors: {
            error: string;
            details?: Record<string, any> | undefined;
            item_id?: string | undefined;
        }[];
        successful: number;
        total_items: number;
        execution_time: number;
        transaction_id?: string | undefined;
    }, {
        failed: number;
        operation: string;
        errors: {
            error: string;
            details?: Record<string, any> | undefined;
            item_id?: string | undefined;
        }[];
        successful: number;
        total_items: number;
        execution_time: number;
        transaction_id?: string | undefined;
    }>;
    readonly AutocompleteSuggestion: z.ZodObject<{
        id: z.ZodString;
        type: z.ZodEnum<["category", "tag", "entry", "search_term"]>;
        value: z.ZodString;
        display_value: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        score: z.ZodNumber;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
        usage_count: z.ZodOptional<z.ZodNumber>;
        last_used: z.ZodOptional<z.ZodDate>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        score: number;
        value: string;
        type: "category" | "tag" | "entry" | "search_term";
        display_value: string;
        usage_count?: number | undefined;
        last_used?: Date | undefined;
        description?: string | undefined;
        metadata?: Record<string, any> | undefined;
    }, {
        id: string;
        score: number;
        value: string;
        type: "category" | "tag" | "entry" | "search_term";
        display_value: string;
        usage_count?: number | undefined;
        last_used?: Date | undefined;
        description?: string | undefined;
        metadata?: Record<string, any> | undefined;
    }>;
    readonly AutocompleteQuery: z.ZodObject<{
        query: z.ZodString;
        types: z.ZodDefault<z.ZodArray<z.ZodEnum<["category", "tag", "entry", "search_term"]>, "many">>;
        limit: z.ZodDefault<z.ZodNumber>;
        context: z.ZodOptional<z.ZodObject<{
            current_category_id: z.ZodOptional<z.ZodString>;
            exclude_ids: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            entry_id: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            entry_id?: string | undefined;
            current_category_id?: string | undefined;
            exclude_ids?: string[] | undefined;
        }, {
            entry_id?: string | undefined;
            current_category_id?: string | undefined;
            exclude_ids?: string[] | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        limit: number;
        query: string;
        types: ("category" | "tag" | "entry" | "search_term")[];
        context?: {
            entry_id?: string | undefined;
            current_category_id?: string | undefined;
            exclude_ids?: string[] | undefined;
        } | undefined;
    }, {
        query: string;
        limit?: number | undefined;
        context?: {
            entry_id?: string | undefined;
            current_category_id?: string | undefined;
            exclude_ids?: string[] | undefined;
        } | undefined;
        types?: ("category" | "tag" | "entry" | "search_term")[] | undefined;
    }>;
    readonly SearchFacet: z.ZodObject<{
        key: z.ZodString;
        name: z.ZodString;
        type: z.ZodEnum<["category", "tag", "range", "boolean", "date"]>;
        values: z.ZodArray<z.ZodObject<{
            value: z.ZodString;
            display_value: z.ZodString;
            count: z.ZodNumber;
            selected: z.ZodDefault<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            value: string;
            count: number;
            display_value: string;
            selected: boolean;
        }, {
            value: string;
            count: number;
            display_value: string;
            selected?: boolean | undefined;
        }>, "many">;
        min_value: z.ZodOptional<z.ZodNumber>;
        max_value: z.ZodOptional<z.ZodNumber>;
        is_hierarchical: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        key: string;
        values: {
            value: string;
            count: number;
            display_value: string;
            selected: boolean;
        }[];
        type: "boolean" | "category" | "tag" | "date" | "range";
        name: string;
        is_hierarchical: boolean;
        min_value?: number | undefined;
        max_value?: number | undefined;
    }, {
        key: string;
        values: {
            value: string;
            count: number;
            display_value: string;
            selected?: boolean | undefined;
        }[];
        type: "boolean" | "category" | "tag" | "date" | "range";
        name: string;
        min_value?: number | undefined;
        max_value?: number | undefined;
        is_hierarchical?: boolean | undefined;
    }>;
    readonly FacetedSearchQuery: z.ZodObject<{
        query: z.ZodDefault<z.ZodString>;
        facets: z.ZodRecord<z.ZodString, z.ZodArray<z.ZodString, "many">>;
        sort: z.ZodOptional<z.ZodObject<{
            field: z.ZodString;
            direction: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
        }, "strip", z.ZodTypeAny, {
            field: string;
            direction: "asc" | "desc";
        }, {
            field: string;
            direction?: "asc" | "desc" | undefined;
        }>>;
        pagination: z.ZodOptional<z.ZodObject<{
            page: z.ZodDefault<z.ZodNumber>;
            page_size: z.ZodDefault<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            page_size: number;
            page: number;
        }, {
            page_size?: number | undefined;
            page?: number | undefined;
        }>>;
        filters: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    }, "strip", z.ZodTypeAny, {
        query: string;
        facets: Record<string, string[]>;
        sort?: {
            field: string;
            direction: "asc" | "desc";
        } | undefined;
        pagination?: {
            page_size: number;
            page: number;
        } | undefined;
        filters?: Record<string, any> | undefined;
    }, {
        facets: Record<string, string[]>;
        sort?: {
            field: string;
            direction?: "asc" | "desc" | undefined;
        } | undefined;
        query?: string | undefined;
        pagination?: {
            page_size?: number | undefined;
            page?: number | undefined;
        } | undefined;
        filters?: Record<string, any> | undefined;
    }>;
    readonly CategoryAnalytics: z.ZodObject<{
        category_id: z.ZodString;
        entry_count: z.ZodNumber;
        view_count: z.ZodNumber;
        search_count: z.ZodNumber;
        success_rate: z.ZodNumber;
        avg_resolution_time: z.ZodOptional<z.ZodNumber>;
        top_tags: z.ZodArray<z.ZodObject<{
            tag_id: z.ZodString;
            tag_name: z.ZodString;
            count: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            count: number;
            tag_id: string;
            tag_name: string;
        }, {
            count: number;
            tag_id: string;
            tag_name: string;
        }>, "many">;
        trend: z.ZodOptional<z.ZodObject<{
            direction: z.ZodEnum<["up", "down", "stable"]>;
            percentage: z.ZodNumber;
            period: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            percentage: number;
            direction: "up" | "down" | "stable";
            period: string;
        }, {
            percentage: number;
            direction: "up" | "down" | "stable";
            period: string;
        }>>;
        last_updated: z.ZodDate;
    }, "strip", z.ZodTypeAny, {
        last_updated: Date;
        success_rate: number;
        entry_count: number;
        category_id: string;
        view_count: number;
        search_count: number;
        top_tags: {
            count: number;
            tag_id: string;
            tag_name: string;
        }[];
        avg_resolution_time?: number | undefined;
        trend?: {
            percentage: number;
            direction: "up" | "down" | "stable";
            period: string;
        } | undefined;
    }, {
        last_updated: Date;
        success_rate: number;
        entry_count: number;
        category_id: string;
        view_count: number;
        search_count: number;
        top_tags: {
            count: number;
            tag_id: string;
            tag_name: string;
        }[];
        avg_resolution_time?: number | undefined;
        trend?: {
            percentage: number;
            direction: "up" | "down" | "stable";
            period: string;
        } | undefined;
    }>;
    readonly TagAnalytics: z.ZodObject<{
        tag_id: z.ZodString;
        usage_count: z.ZodNumber;
        entry_count: z.ZodNumber;
        categories: z.ZodArray<z.ZodObject<{
            category_id: z.ZodString;
            category_name: z.ZodString;
            count: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            count: number;
            category_id: string;
            category_name: string;
        }, {
            count: number;
            category_id: string;
            category_name: string;
        }>, "many">;
        co_occurrence: z.ZodArray<z.ZodObject<{
            tag_id: z.ZodString;
            tag_name: z.ZodString;
            count: z.ZodNumber;
            correlation: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            count: number;
            tag_id: string;
            tag_name: string;
            correlation: number;
        }, {
            count: number;
            tag_id: string;
            tag_name: string;
            correlation: number;
        }>, "many">;
        trend: z.ZodOptional<z.ZodObject<{
            direction: z.ZodEnum<["up", "down", "stable"]>;
            percentage: z.ZodNumber;
            period: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            percentage: number;
            direction: "up" | "down" | "stable";
            period: string;
        }, {
            percentage: number;
            direction: "up" | "down" | "stable";
            period: string;
        }>>;
        last_updated: z.ZodDate;
    }, "strip", z.ZodTypeAny, {
        usage_count: number;
        last_updated: Date;
        categories: {
            count: number;
            category_id: string;
            category_name: string;
        }[];
        entry_count: number;
        tag_id: string;
        co_occurrence: {
            count: number;
            tag_id: string;
            tag_name: string;
            correlation: number;
        }[];
        trend?: {
            percentage: number;
            direction: "up" | "down" | "stable";
            period: string;
        } | undefined;
    }, {
        usage_count: number;
        last_updated: Date;
        categories: {
            count: number;
            category_id: string;
            category_name: string;
        }[];
        entry_count: number;
        tag_id: string;
        co_occurrence: {
            count: number;
            tag_id: string;
            tag_name: string;
            correlation: number;
        }[];
        trend?: {
            percentage: number;
            direction: "up" | "down" | "stable";
            period: string;
        } | undefined;
    }>;
};
//# sourceMappingURL=HierarchicalCategories.schema.d.ts.map