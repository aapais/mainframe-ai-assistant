export interface ServiceContext {
    app: Electron.App;
    dataPath: string;
    isDevelopment: boolean;
    config: any;
    logger: ILogger;
    metrics: IMetricsService;
    getService<T extends IBaseService>(name: string): T | null;
}
export interface ServiceHealth {
    healthy: boolean;
    responseTime?: number;
    error?: string;
    details?: Record<string, any>;
    lastCheck: Date;
}
export interface ServiceMetrics {
    operationsCount: number;
    averageResponseTime: number;
    errorRate: number;
    uptime: number;
    memoryUsage: number;
    cacheHitRate?: number;
}
export interface OperationResult<T> {
    success: boolean;
    data?: T;
    error?: BaseError;
    metadata?: {
        operationId: string;
        duration: number;
        cacheHit?: boolean;
        source?: string;
    };
}
export interface IBaseService {
    readonly name: string;
    readonly version: string;
    readonly dependencies: string[];
    initialize(context: ServiceContext): Promise<void>;
    shutdown(): Promise<void>;
    healthCheck(): Promise<ServiceHealth>;
    getMetrics(): ServiceMetrics;
    resetMetrics(): void;
}
export interface IKnowledgeService extends IBaseService {
    create(entry: CreateKBEntry): Promise<OperationResult<KBEntry>>;
    update(id: string, updates: UpdateKBEntry): Promise<OperationResult<KBEntry>>;
    findById(id: string): Promise<OperationResult<KBEntry>>;
    findAll(options?: PaginationOptions): Promise<OperationResult<KBEntry[]>>;
    delete(id: string): Promise<OperationResult<void>>;
    search(query: SearchQuery): Promise<OperationResult<SearchResult[]>>;
    searchWithFacets(query: SearchQuery): Promise<OperationResult<SearchWithFacets>>;
    autocomplete(partial: string, limit?: number): Promise<OperationResult<AutocompleteResult[]>>;
    bulkCreate(entries: CreateKBEntry[]): Promise<OperationResult<string[]>>;
    bulkUpdate(updates: Array<{
        id: string;
        data: UpdateKBEntry;
    }>): Promise<OperationResult<void>>;
    bulkDelete(ids: string[]): Promise<OperationResult<void>>;
    getStatistics(): Promise<OperationResult<KBStatistics>>;
    getPopularEntries(limit?: number): Promise<OperationResult<SearchResult[]>>;
    getRecentEntries(limit?: number): Promise<OperationResult<SearchResult[]>>;
    getRecentActivity(): Promise<OperationResult<ActivitySummary>>;
    getCategories(): Promise<OperationResult<CategoryInfo[]>>;
    getTags(limit?: number): Promise<OperationResult<TagInfo[]>>;
    findByCategory(category: string, options?: SearchOptions): Promise<OperationResult<SearchResult[]>>;
    findByTags(tags: string[], options?: SearchOptions): Promise<OperationResult<SearchResult[]>>;
    recordFeedback(entryId: string, feedback: FeedbackData): Promise<OperationResult<void>>;
    recordUsage(entryId: string, action: string, metadata?: any): Promise<OperationResult<void>>;
}
export interface ICacheService extends IBaseService {
    get<T>(key: string): Promise<T | null>;
    set<T>(key: string, value: T, ttl?: number): Promise<void>;
    delete(key: string): Promise<boolean>;
    exists(key: string): Promise<boolean>;
    clear(): Promise<void>;
    mget(keys: string[]): Promise<Array<any | null>>;
    mset(items: Array<{
        key: string;
        value: any;
        ttl?: number;
    }>): Promise<void>;
    mdelete(keys: string[]): Promise<number>;
    invalidatePattern(pattern: string): Promise<number>;
    keys(pattern?: string): Promise<string[]>;
    getStats(): CacheStatistics;
    getHitRate(): number;
    size(): Promise<number>;
    flush(): Promise<void>;
    expire(key: string, seconds: number): Promise<boolean>;
    ttl(key: string): Promise<number>;
}
export interface ISearchService extends IBaseService {
    search(query: string, options?: SearchOptions): Promise<OperationResult<SearchResult[]>>;
    fuzzySearch(query: string, threshold?: number): Promise<OperationResult<SearchResult[]>>;
    semanticSearch(query: string, useAI?: boolean): Promise<OperationResult<SearchResult[]>>;
    searchWithFacets(query: string): Promise<OperationResult<SearchWithFacets>>;
    autocomplete(partial: string, limit?: number): Promise<OperationResult<AutocompleteResult[]>>;
    suggest(query: string): Promise<OperationResult<SearchSuggestion[]>>;
    indexEntry(entry: KBEntry): Promise<OperationResult<void>>;
    updateIndex(entryId: string, entry: Partial<KBEntry>): Promise<OperationResult<void>>;
    removeFromIndex(entryId: string): Promise<OperationResult<void>>;
    rebuildIndex(): Promise<OperationResult<void>>;
    recordSearch(query: string, results: SearchResult[], metadata?: any): Promise<OperationResult<void>>;
    getSearchAnalytics(): Promise<OperationResult<SearchAnalytics>>;
}
export interface IValidationService extends IBaseService {
    validateCreateEntry(entry: CreateKBEntry): Promise<ValidationResult<CreateKBEntry>>;
    validateUpdateEntry(entry: UpdateKBEntry): Promise<ValidationResult<UpdateKBEntry>>;
    validateSearchQuery(query: SearchQuery): Promise<ValidationResult<SearchQuery>>;
    sanitizeInput(input: any): any;
    validateAndSanitize<T>(input: T, schema: ValidationSchema): Promise<ValidationResult<T>>;
    registerSchema(name: string, schema: ValidationSchema): void;
    validateAgainstSchema<T>(data: T, schemaName: string): Promise<ValidationResult<T>>;
}
export interface IMetricsService extends IBaseService {
    increment(metric: string, value?: number, tags?: Record<string, string>): void;
    gauge(metric: string, value: number, tags?: Record<string, string>): void;
    histogram(metric: string, value: number, tags?: Record<string, string>): void;
    timer(metric: string): () => void;
    recordOperation(operation: string, success: boolean, duration: number, metadata?: any): void;
    recordError(operation: string, error: Error, metadata?: any): void;
    recordCacheHit(operation: string): void;
    recordCacheMiss(operation: string): void;
    recordRequestDuration(endpoint: string, duration: number): void;
    recordDatabaseQuery(query: string, duration: number, rows?: number): void;
    recordSlowQuery(query: string, duration: number, metadata?: any): void;
    getMetrics(timeRange?: TimeRange): Promise<MetricsReport>;
    getOperationStats(operation: string): Promise<OperationStats>;
    getSystemHealth(): Promise<SystemHealthReport>;
    checkAlerts(): Promise<Alert[]>;
    triggerAlert(type: string, data: any): Promise<void>;
}
export interface ILogger extends IBaseService {
    debug(message: string, metadata?: any): void;
    info(message: string, metadata?: any): void;
    warn(message: string, metadata?: any): void;
    error(message: string, error?: Error, metadata?: any): void;
    log(level: LogLevel, message: string, metadata?: any): void;
    child(context: Record<string, any>): ILogger;
    query(options: LogQueryOptions): Promise<LogEntry[]>;
}
export interface IRepository<T, CreateT = Omit<T, 'id'>, UpdateT = Partial<T>> {
    findById(id: string): Promise<RepositoryResult<T>>;
    findAll(options?: PaginationOptions): Promise<RepositoryResult<T[]>>;
    create(data: CreateT): Promise<RepositoryResult<T>>;
    update(id: string, data: UpdateT): Promise<RepositoryResult<T>>;
    delete(id: string): Promise<RepositoryResult<void>>;
    count(filters?: any): Promise<RepositoryResult<number>>;
}
export interface IKnowledgeBaseRepository extends IRepository<KBEntry, CreateKBEntry, UpdateKBEntry> {
    search(query: SearchQuery): Promise<RepositoryResult<SearchResult[]>>;
    searchWithFacets(query: SearchQuery): Promise<RepositoryResult<SearchWithFacets>>;
    autocomplete(query: string, limit?: number): Promise<RepositoryResult<AutocompleteResult[]>>;
    findByCategory(category: string, options?: SearchOptions): Promise<RepositoryResult<SearchResult[]>>;
    findByTags(tags: string[], options?: SearchOptions): Promise<RepositoryResult<SearchResult[]>>;
    getAllCategories(): Promise<RepositoryResult<CategoryInfo[]>>;
    getAllTags(): Promise<RepositoryResult<TagInfo[]>>;
    getStatistics(): Promise<RepositoryResult<DatabaseStats>>;
    getPopularEntries(limit?: number): Promise<RepositoryResult<SearchResult[]>>;
    getRecentEntries(limit?: number): Promise<RepositoryResult<SearchResult[]>>;
    recordFeedback(feedback: EntryFeedback): Promise<RepositoryResult<string>>;
    recordUsage(metric: UsageMetric): Promise<RepositoryResult<void>>;
    recordSearch(history: SearchHistory): Promise<RepositoryResult<void>>;
    bulkCreate(entries: CreateKBEntry[]): Promise<RepositoryResult<string[]>>;
    bulkUpdate(updates: Array<{
        id: string;
        data: UpdateKBEntry;
    }>): Promise<RepositoryResult<void>>;
    bulkDelete(ids: string[]): Promise<RepositoryResult<void>>;
}
export interface KBEntry {
    id: string;
    title: string;
    problem: string;
    solution: string;
    category: KBCategory;
    severity?: Severity;
    tags: string[];
    created_at: Date;
    updated_at: Date;
    created_by: string;
    usage_count: number;
    success_count: number;
    failure_count: number;
    last_used?: Date;
    archived: boolean;
    confidence_score?: number;
}
export interface CreateKBEntry {
    title: string;
    problem: string;
    solution: string;
    category: KBCategory;
    severity?: Severity;
    tags?: string[];
    created_by?: string;
}
export interface UpdateKBEntry {
    title?: string;
    problem?: string;
    solution?: string;
    category?: KBCategory;
    severity?: Severity;
    tags?: string[];
    archived?: boolean;
}
export interface SearchQuery {
    query: string;
    category?: KBCategory;
    tags?: string[];
    severity?: Severity;
    limit?: number;
    offset?: number;
    sortBy?: SortOption;
    useAI?: boolean;
    filters?: SearchFilters;
}
export interface SearchResult {
    entry: KBEntry;
    score: number;
    matchType: SearchMatchType;
    highlights: string[];
    executionTime: number;
}
export interface SearchWithFacets {
    results: SearchResult[];
    facets: {
        categories: Array<{
            name: string;
            count: number;
        }>;
        tags: Array<{
            name: string;
            count: number;
        }>;
        severities: Array<{
            name: string;
            count: number;
        }>;
    };
    totalCount: number;
    executionTime?: number;
}
export interface AutocompleteResult {
    suggestion: string;
    category: string;
    score: number;
}
export interface CategoryInfo {
    name: string;
    count: number;
    description?: string;
}
export interface TagInfo {
    name: string;
    count: number;
    category?: string;
}
export interface KBStatistics {
    totalEntries: number;
    categoryCounts: Record<string, number>;
    recentActivity: number;
    searchesToday: number;
    averageSuccessRate: number;
    topEntries: Array<{
        id: string;
        title: string;
        usage: number;
    }>;
    diskUsage: number;
    performance: PerformanceStats;
    healthStatus: HealthStatus;
    timestamp: Date;
}
export interface ActivitySummary {
    recentSearches: SearchSummary[];
    popularEntries: Array<{
        entry: KBEntry;
        usage: number;
    }>;
    recentEntries: KBEntry[];
    usage: {
        totalViews: number;
        totalSearches: number;
        averageSessionTime: number;
    };
}
export interface ValidationResult<T> {
    isValid: boolean;
    data?: T;
    errors: ValidationError[];
    warnings?: ValidationWarning[];
}
export interface ValidationError {
    field: string;
    message: string;
    code: string;
    value?: any;
}
export interface ValidationWarning {
    field: string;
    message: string;
    suggestion?: string;
}
export interface ValidationSchema {
    type: string;
    properties: Record<string, PropertySchema>;
    required?: string[];
    additionalProperties?: boolean;
}
export interface PropertySchema {
    type: string;
    format?: string;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    enum?: any[];
}
export interface CacheStatistics {
    hits: number;
    misses: number;
    hitRate: number;
    size: number;
    maxSize: number;
    evictions: number;
    averageGetTime: number;
    averageSetTime: number;
}
export interface RepositoryResult<T> {
    success: boolean;
    data?: T;
    error?: BaseError;
    metadata?: {
        executionTime: number;
        cacheHit: boolean;
        affectedRows?: number;
        queryHash?: string;
    };
}
export type KBCategory = 'JCL' | 'VSAM' | 'DB2' | 'Batch' | 'Functional' | 'Other';
export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type SearchMatchType = 'exact' | 'fuzzy' | 'semantic' | 'category' | 'tag' | 'fts';
export type SortOption = 'relevance' | 'date' | 'usage' | 'title' | 'category';
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export interface PaginationOptions {
    limit?: number;
    offset?: number;
}
export interface SearchOptions extends PaginationOptions {
    sortBy?: SortOption;
    filters?: SearchFilters;
}
export interface SearchFilters {
    dateRange?: {
        start: Date;
        end: Date;
    };
    minScore?: number;
    categories?: string[];
    tags?: string[];
    severity?: Severity[];
}
export interface TimeRange {
    start: Date;
    end: Date;
}
export declare abstract class BaseError extends Error {
    abstract readonly code: string;
    abstract readonly statusCode: number;
    readonly timestamp: Date;
    readonly metadata: Record<string, any>;
    readonly operationId?: string;
    constructor(message: string, metadata?: Record<string, any>);
}
export declare class ServiceError extends BaseError {
    readonly code = "SERVICE_ERROR";
    readonly statusCode = 500;
}
export declare class ValidationError extends BaseError {
    readonly code: "VALIDATION_ERROR";
    readonly statusCode = 400;
}
export declare class NotFoundError extends BaseError {
    readonly code = "NOT_FOUND";
    readonly statusCode = 404;
}
export declare class ConflictError extends BaseError {
    readonly code = "CONFLICT";
    readonly statusCode = 409;
}
export declare class OperationResult {
    static success<T>(data: T, metadata?: any): OperationResult<T>;
    static failure<T>(error: BaseError): OperationResult<T>;
}
export interface SearchSuggestion {
    text: string;
    type: 'query' | 'category' | 'tag';
    score: number;
}
export interface SearchAnalytics {
    totalSearches: number;
    uniqueQueries: number;
    averageResultCount: number;
    topQueries: Array<{
        query: string;
        count: number;
    }>;
    noResultQueries: string[];
    averageResponseTime: number;
}
export interface FeedbackData {
    rating: number;
    successful: boolean;
    comment?: string;
    resolution_time?: number;
    session_id?: string;
}
export interface EntryFeedback {
    id?: string;
    entry_id: string;
    user_id?: string;
    rating: number;
    successful: boolean;
    comment?: string;
    session_id?: string;
    resolution_time?: number;
    timestamp?: Date;
}
export interface UsageMetric {
    entry_id?: string;
    action: string;
    user_id?: string;
    session_id?: string;
    timestamp?: Date;
    metadata?: Record<string, any>;
}
export interface SearchHistory {
    query: string;
    normalized_query?: string;
    results_count?: number;
    selected_entry_id?: string;
    user_id?: string;
    session_id?: string;
    search_time_ms?: number;
    filters_used?: Record<string, any>;
    ai_used?: boolean;
    timestamp?: Date;
}
export interface SearchSummary {
    query: string;
    timestamp: Date;
    resultCount: number;
    selected?: boolean;
}
export interface PerformanceStats {
    avgSearchTime: number;
    cacheHitRate: number;
    slowQueries: number;
    errorRate: number;
}
export interface HealthStatus {
    overall: 'healthy' | 'degraded' | 'unhealthy';
    database: boolean;
    cache: boolean;
    indexes: boolean;
    backup: boolean;
    issues: string[];
}
export interface DatabaseStats extends KBStatistics {
}
export interface MetricsReport {
    timeRange: TimeRange;
    operations: Record<string, OperationStats>;
    system: SystemStats;
    errors: ErrorStats;
}
export interface OperationStats {
    count: number;
    averageDuration: number;
    minDuration: number;
    maxDuration: number;
    errorRate: number;
    successRate: number;
    throughput: number;
}
export interface SystemStats {
    memoryUsage: number;
    cpuUsage: number;
    diskUsage: number;
    uptime: number;
}
export interface ErrorStats {
    totalErrors: number;
    errorsByType: Record<string, number>;
    recentErrors: Array<{
        timestamp: Date;
        error: string;
        operation: string;
    }>;
}
export interface SystemHealthReport {
    overall: 'healthy' | 'degraded' | 'unhealthy';
    services: Record<string, ServiceHealth>;
    resources: {
        memory: {
            used: number;
            total: number;
            percentage: number;
        };
        disk: {
            used: number;
            total: number;
            percentage: number;
        };
        cpu: {
            percentage: number;
        };
    };
    alerts: Alert[];
    timestamp: Date;
}
export interface Alert {
    id: string;
    type: string;
    severity: 'critical' | 'warning' | 'info';
    message: string;
    data: any;
    timestamp: Date;
    resolved?: boolean;
}
export interface LogEntry {
    timestamp: Date;
    level: LogLevel;
    message: string;
    metadata?: any;
    service?: string;
    operationId?: string;
}
export interface LogQueryOptions {
    level?: LogLevel;
    service?: string;
    operationId?: string;
    timeRange?: TimeRange;
    limit?: number;
    offset?: number;
}
//# sourceMappingURL=ServiceInterfaces.d.ts.map