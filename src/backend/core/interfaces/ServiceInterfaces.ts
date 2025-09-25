/**
 * Core Service Interfaces for Backend Architecture
 * Mainframe KB Assistant - Service Layer Type Definitions
 */

// Core Types
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

// Base Service Interface
export interface IBaseService {
  readonly name: string;
  readonly version: string;
  readonly dependencies: string[];

  initialize(context: ServiceContext): Promise<void>;
  shutdown(): Promise<void>;
  healthCheck(): Promise<ServiceHealth>;

  // Performance monitoring
  getMetrics(): ServiceMetrics;
  resetMetrics(): void;
}

// Knowledge Base Service Interface
export interface IKnowledgeService extends IBaseService {
  // Core CRUD operations
  create(entry: CreateKBEntry): Promise<OperationResult<KBEntry>>;
  update(id: string, updates: UpdateKBEntry): Promise<OperationResult<KBEntry>>;
  findById(id: string): Promise<OperationResult<KBEntry>>;
  findAll(options?: PaginationOptions): Promise<OperationResult<KBEntry[]>>;
  delete(id: string): Promise<OperationResult<void>>;

  // Search operations
  search(query: SearchQuery): Promise<OperationResult<SearchResult[]>>;
  searchWithFacets(query: SearchQuery): Promise<OperationResult<SearchWithFacets>>;
  autocomplete(partial: string, limit?: number): Promise<OperationResult<AutocompleteResult[]>>;

  // Batch operations for performance
  bulkCreate(entries: CreateKBEntry[]): Promise<OperationResult<string[]>>;
  bulkUpdate(updates: Array<{ id: string; data: UpdateKBEntry }>): Promise<OperationResult<void>>;
  bulkDelete(ids: string[]): Promise<OperationResult<void>>;

  // Statistics and analytics
  getStatistics(): Promise<OperationResult<KBStatistics>>;
  getPopularEntries(limit?: number): Promise<OperationResult<SearchResult[]>>;
  getRecentEntries(limit?: number): Promise<OperationResult<SearchResult[]>>;
  getRecentActivity(): Promise<OperationResult<ActivitySummary>>;

  // Category and tag operations
  getCategories(): Promise<OperationResult<CategoryInfo[]>>;
  getTags(limit?: number): Promise<OperationResult<TagInfo[]>>;
  findByCategory(
    category: string,
    options?: SearchOptions
  ): Promise<OperationResult<SearchResult[]>>;
  findByTags(tags: string[], options?: SearchOptions): Promise<OperationResult<SearchResult[]>>;

  // Feedback and usage tracking
  recordFeedback(entryId: string, feedback: FeedbackData): Promise<OperationResult<void>>;
  recordUsage(entryId: string, action: string, metadata?: any): Promise<OperationResult<void>>;
}

// Cache Service Interface
export interface ICacheService extends IBaseService {
  // Basic operations
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<boolean>;
  exists(key: string): Promise<boolean>;
  clear(): Promise<void>;

  // Advanced caching features
  mget(keys: string[]): Promise<Array<any | null>>;
  mset(items: Array<{ key: string; value: any; ttl?: number }>): Promise<void>;
  mdelete(keys: string[]): Promise<number>;

  // Pattern operations
  invalidatePattern(pattern: string): Promise<number>;
  keys(pattern?: string): Promise<string[]>;

  // Cache statistics and management
  getStats(): CacheStatistics;
  getHitRate(): number;
  size(): Promise<number>;
  flush(): Promise<void>;

  // Expiration management
  expire(key: string, seconds: number): Promise<boolean>;
  ttl(key: string): Promise<number>;
}

// Search Service Interface
export interface ISearchService extends IBaseService {
  // Core search operations
  search(query: string, options?: SearchOptions): Promise<OperationResult<SearchResult[]>>;
  fuzzySearch(query: string, threshold?: number): Promise<OperationResult<SearchResult[]>>;
  semanticSearch(query: string, useAI?: boolean): Promise<OperationResult<SearchResult[]>>;

  // Advanced search features
  searchWithFacets(query: string): Promise<OperationResult<SearchWithFacets>>;
  autocomplete(partial: string, limit?: number): Promise<OperationResult<AutocompleteResult[]>>;
  suggest(query: string): Promise<OperationResult<SearchSuggestion[]>>;

  // Index management
  indexEntry(entry: KBEntry): Promise<OperationResult<void>>;
  updateIndex(entryId: string, entry: Partial<KBEntry>): Promise<OperationResult<void>>;
  removeFromIndex(entryId: string): Promise<OperationResult<void>>;
  rebuildIndex(): Promise<OperationResult<void>>;

  // Search analytics
  recordSearch(
    query: string,
    results: SearchResult[],
    metadata?: any
  ): Promise<OperationResult<void>>;
  getSearchAnalytics(): Promise<OperationResult<SearchAnalytics>>;
}

// Validation Service Interface
export interface IValidationService extends IBaseService {
  // Entry validation
  validateCreateEntry(entry: CreateKBEntry): Promise<ValidationResult<CreateKBEntry>>;
  validateUpdateEntry(entry: UpdateKBEntry): Promise<ValidationResult<UpdateKBEntry>>;
  validateSearchQuery(query: SearchQuery): Promise<ValidationResult<SearchQuery>>;

  // Input sanitization
  sanitizeInput(input: any): any;
  validateAndSanitize<T>(input: T, schema: ValidationSchema): Promise<ValidationResult<T>>;

  // Schema management
  registerSchema(name: string, schema: ValidationSchema): void;
  validateAgainstSchema<T>(data: T, schemaName: string): Promise<ValidationResult<T>>;
}

// Metrics Service Interface
export interface IMetricsService extends IBaseService {
  // Basic metrics
  increment(metric: string, value?: number, tags?: Record<string, string>): void;
  gauge(metric: string, value: number, tags?: Record<string, string>): void;
  histogram(metric: string, value: number, tags?: Record<string, string>): void;
  timer(metric: string): () => void;

  // Operation tracking
  recordOperation(operation: string, success: boolean, duration: number, metadata?: any): void;
  recordError(operation: string, error: Error, metadata?: any): void;
  recordCacheHit(operation: string): void;
  recordCacheMiss(operation: string): void;

  // Performance monitoring
  recordRequestDuration(endpoint: string, duration: number): void;
  recordDatabaseQuery(query: string, duration: number, rows?: number): void;
  recordSlowQuery(query: string, duration: number, metadata?: any): void;

  // Analytics
  getMetrics(timeRange?: TimeRange): Promise<ServiceMetrics>;
  getOperationStats(operation: string): Promise<OperationStats>;
  getSystemHealth(): Promise<SystemHealthReport>;

  // Alerts
  checkAlerts(): Promise<Alert[]>;
  triggerAlert(type: string, data: any): Promise<void>;
}

// Logger Interface
export interface ILogger extends IBaseService {
  debug(message: string, metadata?: any): void;
  info(message: string, metadata?: any): void;
  warn(message: string, metadata?: any): void;
  error(message: string, error?: Error, metadata?: any): void;

  // Structured logging
  log(level: LogLevel, message: string, metadata?: any): void;

  // Context logging
  child(context: Record<string, any>): ILogger;

  // Query methods
  query(options: LogQueryOptions): Promise<LogEntry[]>;
}

// Repository Interfaces
export interface IRepository<T, CreateT = Omit<T, 'id'>, UpdateT = Partial<T>> {
  findById(id: string): Promise<RepositoryResult<T>>;
  findAll(options?: PaginationOptions): Promise<RepositoryResult<T[]>>;
  create(data: CreateT): Promise<RepositoryResult<T>>;
  update(id: string, data: UpdateT): Promise<RepositoryResult<T>>;
  delete(id: string): Promise<RepositoryResult<void>>;
  count(filters?: any): Promise<RepositoryResult<number>>;
}

export interface IKnowledgeBaseRepository
  extends IRepository<KBEntry, CreateKBEntry, UpdateKBEntry> {
  // Search operations
  search(query: SearchQuery): Promise<RepositoryResult<SearchResult[]>>;
  searchWithFacets(query: SearchQuery): Promise<RepositoryResult<SearchWithFacets>>;
  autocomplete(query: string, limit?: number): Promise<RepositoryResult<AutocompleteResult[]>>;

  // Category and tag operations
  findByCategory(
    category: string,
    options?: SearchOptions
  ): Promise<RepositoryResult<SearchResult[]>>;
  findByTags(tags: string[], options?: SearchOptions): Promise<RepositoryResult<SearchResult[]>>;
  getAllCategories(): Promise<RepositoryResult<CategoryInfo[]>>;
  getAllTags(): Promise<RepositoryResult<TagInfo[]>>;

  // Statistics
  getStatistics(): Promise<RepositoryResult<DatabaseStats>>;
  getPopularEntries(limit?: number): Promise<RepositoryResult<SearchResult[]>>;
  getRecentEntries(limit?: number): Promise<RepositoryResult<SearchResult[]>>;

  // Feedback and usage
  recordFeedback(feedback: EntryFeedback): Promise<RepositoryResult<string>>;
  recordUsage(metric: UsageMetric): Promise<RepositoryResult<void>>;
  recordSearch(history: SearchHistory): Promise<RepositoryResult<void>>;

  // Bulk operations
  bulkCreate(entries: CreateKBEntry[]): Promise<RepositoryResult<string[]>>;
  bulkUpdate(updates: Array<{ id: string; data: UpdateKBEntry }>): Promise<RepositoryResult<void>>;
  bulkDelete(ids: string[]): Promise<RepositoryResult<void>>;
}

// Data Types
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
    categories: Array<{ name: string; count: number }>;
    tags: Array<{ name: string; count: number }>;
    severities: Array<{ name: string; count: number }>;
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
  topEntries: Array<{ id: string; title: string; usage: number }>;
  diskUsage: number;
  performance: PerformanceStats;
  healthStatus: HealthStatus;
  timestamp: Date;
}

export interface ActivitySummary {
  recentSearches: SearchSummary[];
  popularEntries: Array<{ entry: KBEntry; usage: number }>;
  recentEntries: KBEntry[];
  usage: {
    totalViews: number;
    totalSearches: number;
    averageSessionTime: number;
  };
}

// Validation Types
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

// Cache Types
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

// Repository Types
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

// Common Types
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
  dateRange?: { start: Date; end: Date };
  minScore?: number;
  categories?: string[];
  tags?: string[];
  severity?: Severity[];
}

export interface TimeRange {
  start: Date;
  end: Date;
}

// Error Types
export abstract class BaseError extends Error {
  abstract readonly code: string;
  abstract readonly statusCode: number;
  readonly timestamp: Date;
  readonly metadata: Record<string, any>;
  readonly operationId?: string;

  constructor(message: string, metadata: Record<string, any> = {}) {
    super(message);
    this.name = this.constructor.name;
    this.timestamp = new Date();
    this.metadata = metadata;
    this.operationId = metadata.operationId;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ServiceError extends BaseError {
  readonly code: string = 'SERVICE_ERROR';
  readonly statusCode = 500;
}

export class ValidationError extends BaseError {
  readonly code: string = 'VALIDATION_ERROR';
  readonly statusCode = 400;
}

export class NotFoundError extends BaseError {
  readonly code: string = 'NOT_FOUND';
  readonly statusCode = 404;
}

export class ConflictError extends BaseError {
  readonly code: string = 'CONFLICT';
  readonly statusCode = 409;
}

// Helper function to create operation results
export class OperationResultHelper {
  static success<T>(data: T, metadata?: any): OperationResult<T> {
    return { success: true, data, metadata };
  }

  static failure<T>(error: BaseError): OperationResult<T> {
    return { success: false, error };
  }
}

// Additional supporting interfaces
export interface SearchSuggestion {
  text: string;
  type: 'query' | 'category' | 'tag';
  score: number;
}

export interface SearchAnalytics {
  totalSearches: number;
  uniqueQueries: number;
  averageResultCount: number;
  topQueries: Array<{ query: string; count: number }>;
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
  // Additional database-specific stats can be added here
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
  recentErrors: Array<{ timestamp: Date; error: string; operation: string }>;
}

export interface SystemHealthReport {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  services: Record<string, ServiceHealth>;
  resources: {
    memory: { used: number; total: number; percentage: number };
    disk: { used: number; total: number; percentage: number };
    cpu: { percentage: number };
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

// ========================================
// INCIDENT MANAGEMENT INTERFACES
// ========================================

// Incident Types and Enums
export type IncidentPriority = 'P1' | 'P2' | 'P3' | 'P4';
export type IncidentStatus = 'Open' | 'In Progress' | 'Pending' | 'Resolved' | 'Closed';
export type IncidentCategory =
  | 'System Outage'
  | 'Performance'
  | 'Database'
  | 'Application'
  | 'Security'
  | 'Network'
  | 'Hardware'
  | 'Capacity'
  | 'Data'
  | 'Configuration'
  | 'Other';
export type IncidentImpact = 'Critical' | 'High' | 'Medium' | 'Low';

// Core Incident Data Structures
export interface Incident {
  id: string;
  title: string;
  description: string;
  impact: string;
  category: IncidentCategory;
  priority: IncidentPriority;
  status: IncidentStatus;
  assignee?: string;
  tags: string[];
  created_at: Date;
  updated_at: Date;
  resolved_at?: Date;
  closed_at?: Date;
  reported_by: string;
  reported_at: Date;
  resolution_notes?: string;
  estimated_resolution?: Date;
  actual_resolution_time?: number; // in minutes
  escalation_level?: number;
  affected_systems?: string[];
  affected_users_count?: number;
  business_impact_rating?: number; // 1-10 scale
  confidence_score?: number;
  related_incidents?: string[];
  duplicate_of?: string;
  archived: boolean;
}

export interface CreateIncident {
  title: string;
  description: string;
  impact: string;
  category: IncidentCategory;
  priority: IncidentPriority;
  status?: IncidentStatus;
  assignee?: string;
  tags?: string[];
  reported_by: string;
  reported_at?: string;
  estimated_resolution?: Date;
  affected_systems?: string[];
  affected_users_count?: number;
  business_impact_rating?: number;
}
