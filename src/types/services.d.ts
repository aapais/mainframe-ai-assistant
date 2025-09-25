import { EventEmitter } from 'events';
import { Readable } from 'stream';
import { KBEntry, KBEntryInput, KBEntryUpdate, KBCategory } from './index';
export interface ServiceConfig {
  database: DatabaseConfig;
  search: SearchConfig;
  cache: CacheConfig;
  metrics: MetricsConfig;
  validation: ValidationConfig;
  gemini?: GeminiConfig;
  logging: LoggingConfig;
}
export interface DatabaseConfig {
  path: string;
  pragmas: Record<string, string | number>;
  backup: {
    enabled: boolean;
    interval: number;
    retention: number;
    path: string;
  };
  performance: {
    connectionPool: number;
    busyTimeout: number;
    cacheSize: number;
  };
}
export interface SearchConfig {
  fts: {
    tokenize: string;
    remove_diacritics: number;
    categories: string;
  };
  ai: {
    enabled: boolean;
    fallback: boolean;
    timeout: number;
    retries: number;
    batchSize: number;
  };
  cache: {
    enabled: boolean;
    ttl: number;
    maxSize: number;
  };
}
export interface CacheConfig {
  maxSize: number;
  ttl: number;
  checkPeriod: number;
  strategy: 'lru' | 'lfu' | 'fifo';
  persistent: boolean;
}
export interface MetricsConfig {
  enabled: boolean;
  retention: number;
  aggregation: {
    enabled: boolean;
    interval: number;
    batch: number;
  };
  alerts: {
    enabled: boolean;
    thresholds: Record<string, number>;
  };
}
export interface ValidationConfig {
  strict: boolean;
  sanitize: boolean;
  maxLength: {
    title: number;
    problem: number;
    solution: number;
    tags: number;
  };
  minLength: {
    title: number;
    problem: number;
    solution: number;
  };
  patterns: {
    tag: RegExp;
    category: string[];
  };
}
export interface GeminiConfig {
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  timeout: number;
  rateLimit: {
    requests: number;
    window: number;
  };
}
export interface LoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  file: {
    enabled: boolean;
    path: string;
    maxSize: number;
    maxFiles: number;
  };
  console: boolean;
  structured: boolean;
}
export interface IKnowledgeBaseService extends EventEmitter {
  initialize(): Promise<void>;
  create(entry: KBEntryInput): Promise<string>;
  createBatch(entries: KBEntryInput[]): Promise<string[]>;
  read(id: string): Promise<KBEntry | null>;
  readBatch(ids: string[]): Promise<KBEntry[]>;
  update(id: string, updates: KBEntryUpdate): Promise<boolean>;
  updateBatch(
    updates: Array<{
      id: string;
      updates: KBEntryUpdate;
    }>
  ): Promise<boolean[]>;
  delete(id: string): Promise<boolean>;
  deleteBatch(ids: string[]): Promise<boolean[]>;
  list(options?: ListOptions): Promise<PaginatedResult<KBEntry>>;
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  recordUsage(id: string, successful: boolean, userId?: string): Promise<void>;
  getMetrics(): Promise<KBMetrics>;
  export(options?: ExportOptions): Promise<string>;
  import(data: string, options?: ImportOptions): Promise<ImportResult>;
  backup(): Promise<string>;
  restore(backupPath: string): Promise<RestoreResult>;
  close(): Promise<void>;
}
export interface IValidationService {
  validateEntry(entry: KBEntryInput): ValidationResult;
  validateUpdate(updates: KBEntryUpdate): ValidationResult;
  validateSearch(query: string, options?: SearchOptions): ValidationResult;
  validateBatch(entries: KBEntryInput[]): ValidationResult[];
  sanitizeEntry(entry: KBEntryInput): KBEntryInput;
  sanitizeUpdate(updates: KBEntryUpdate): KBEntryUpdate;
  sanitizeBatch(entries: KBEntryInput[]): KBEntryInput[];
  addCustomValidator(field: string, validator: CustomValidator): void;
  removeCustomValidator(field: string): void;
}
export interface ISearchService {
  search(query: string, entries: KBEntry[], options?: SearchOptions): Promise<SearchResult[]>;
  searchWithAI(query: string, entries: KBEntry[], options?: SearchOptions): Promise<SearchResult[]>;
  suggest(query: string, limit?: number): Promise<string[]>;
  explain(query: string, result: SearchResult): Promise<string>;
  getRecentSearches(limit?: number): Promise<SearchQuery[]>;
  getPopularSearches(limit?: number): Promise<PopularSearch[]>;
  buildIndex(entries: KBEntry[]): Promise<void>;
  optimizeIndex(): Promise<void>;
}
export interface ICacheService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  mget<T>(keys: string[]): Promise<Array<T | null>>;
  mset<T>(
    items: Array<{
      key: string;
      value: T;
      ttl?: number;
    }>
  ): Promise<void>;
  delete(key: string): Promise<boolean>;
  deletePattern(pattern: string): Promise<number>;
  clear(): Promise<void>;
  has(key: string): Promise<boolean>;
  expire(key: string, ttl: number): Promise<boolean>;
  stats(): CacheStats;
  keys(pattern?: string): Promise<string[]>;
}
export interface IMetricsService extends EventEmitter {
  recordSearch(query: SearchQuery, results: SearchResult[]): Promise<void>;
  recordUsage(entryId: string, action: UsageAction, userId?: string, metadata?: any): Promise<void>;
  recordError(error: ServiceError): Promise<void>;
  recordPerformance(operation: string, duration: number, metadata?: any): Promise<void>;
  getMetrics(period?: string): Promise<KBMetrics>;
  getTrends(period?: string): Promise<MetricTrends>;
  getAlerts(): Promise<MetricAlert[]>;
  acknowledgeAlert(alertId: string): Promise<void>;
  exportMetrics(format: 'json' | 'csv' | 'prometheus'): Promise<string>;
}
export interface IImportExportService {
  exportToJSON(options?: ExportOptions): Promise<string>;
  importFromJSON(data: string, options?: ImportOptions): Promise<ImportResult>;
  exportToCSV(options?: ExportOptions): Promise<string>;
  importFromCSV(data: string, options?: ImportOptions): Promise<ImportResult>;
  exportToXML(options?: ExportOptions): Promise<string>;
  importFromXML(data: string, options?: ImportOptions): Promise<ImportResult>;
  backup(path: string): Promise<void>;
  restore(path: string): Promise<RestoreResult>;
  validateFormat(data: string, format: 'json' | 'csv' | 'xml'): ValidationResult;
  getFormats(): string[];
}
export interface SearchResult {
  entry: KBEntry;
  score: number;
  matchType: SearchMatchType;
  highlights?: SearchHighlight[];
  explanation?: string;
  metadata?: SearchMetadata;
}
export interface SearchHighlight {
  field: keyof KBEntry;
  start: number;
  end: number;
  text: string;
  context: string;
}
export interface SearchMetadata {
  processingTime: number;
  source: 'cache' | 'database' | 'ai';
  confidence: number;
  fallback: boolean;
}
export type SearchMatchType = 'exact' | 'fuzzy' | 'semantic' | 'category' | 'tag' | 'ai';
export interface SearchOptions {
  limit?: number;
  offset?: number;
  category?: KBCategory;
  tags?: string[];
  sortBy?: 'relevance' | 'usage' | 'recent' | 'success_rate' | 'score';
  sortOrder?: 'asc' | 'desc';
  includeHighlights?: boolean;
  useAI?: boolean;
  threshold?: number;
  fuzzyDistance?: number;
  cacheResults?: boolean;
}
export interface SearchQuery {
  text: string;
  options: SearchOptions;
  timestamp: Date;
  user_id?: string;
  session_id?: string;
  metadata?: any;
}
export interface PopularSearch {
  query: string;
  count: number;
  averageResults: number;
  successRate: number;
  lastUsed: Date;
}
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  score?: number;
}
export interface ValidationError {
  field: string;
  code: string;
  message: string;
  value?: any;
  severity: 'error' | 'warning';
}
export interface ValidationWarning {
  field: string;
  code: string;
  message: string;
  suggestion?: string;
  severity: 'warning' | 'info';
}
export interface CustomValidator {
  validate: (value: any) => boolean;
  message: string;
  code: string;
}
export interface ListOptions {
  limit?: number;
  offset?: number;
  category?: KBCategory;
  sortBy?: 'created_at' | 'updated_at' | 'usage_count' | 'success_rate' | 'title';
  sortOrder?: 'asc' | 'desc';
  includeMetrics?: boolean;
  filters?: FilterOptions;
}
export interface FilterOptions {
  createdAfter?: Date;
  createdBefore?: Date;
  updatedAfter?: Date;
  updatedBefore?: Date;
  minUsage?: number;
  minSuccessRate?: number;
  createdBy?: string;
  tags?: string[];
}
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  nextOffset?: number;
  previousOffset?: number;
}
export interface ImportResult {
  success: boolean;
  imported: number;
  updated: number;
  skipped: number;
  errors: ImportError[];
  warnings: ImportWarning[];
  summary: {
    totalProcessed: number;
    processingTime: number;
    validationErrors: number;
    duplicates: number;
  };
}
export interface ImportError {
  line: number;
  field: string;
  message: string;
  value?: any;
  code: string;
}
export interface ImportWarning {
  line: number;
  field: string;
  message: string;
  suggestion?: string;
  code: string;
}
export interface RestoreResult {
  success: boolean;
  restored: number;
  errors: RestoreError[];
  metadata: {
    backupVersion: string;
    restoreTime: Date;
    dataIntegrity: boolean;
  };
}
export interface RestoreError {
  table: string;
  message: string;
  details?: any;
  recoverable: boolean;
}
export interface ExportOptions {
  includeMetrics?: boolean;
  includeHistory?: boolean;
  category?: KBCategory;
  since?: Date;
  until?: Date;
  format?: 'full' | 'minimal' | 'compact';
  encryption?: {
    enabled: boolean;
    algorithm: string;
    password?: string;
  };
}
export interface ImportOptions {
  overwrite?: boolean;
  merge?: boolean;
  validateOnly?: boolean;
  batchSize?: number;
  skipDuplicates?: boolean;
  preserveIds?: boolean;
  updateExisting?: boolean;
  onConflict?: 'skip' | 'overwrite' | 'merge' | 'error';
}
export interface KBMetrics {
  overview: {
    totalEntries: number;
    totalSearches: number;
    averageSuccessRate: number;
    totalUsage: number;
    activeUsers: number;
    uptime: number;
  };
  categories: CategoryMetrics[];
  searches: SearchMetrics;
  usage: UsageMetrics;
  performance: PerformanceMetrics;
  trends: MetricTrends;
  alerts: MetricAlert[];
}
export interface CategoryMetrics {
  category: KBCategory;
  count: number;
  usage: number;
  successRate: number;
  averageScore: number;
  trend: number;
  lastUpdated: Date;
}
export interface SearchMetrics {
  totalSearches: number;
  uniqueQueries: number;
  averageResultCount: number;
  averageResponseTime: number;
  noResultQueries: string[];
  popularQueries: PopularSearch[];
  searchTypes: Record<SearchMatchType, number>;
  aiUsage: {
    totalRequests: number;
    successRate: number;
    averageLatency: number;
    fallbackRate: number;
  };
}
export interface UsageMetrics {
  totalViews: number;
  totalRatings: number;
  averageRating: number;
  uniqueUsers: number;
  mostUsed: Array<
    KBEntry & {
      rank: number;
    }
  >;
  leastUsed: Array<
    KBEntry & {
      rank: number;
    }
  >;
  recentActivity: UsageActivity[];
  userEngagement: {
    dailyActive: number;
    weeklyActive: number;
    monthlyActive: number;
    retention: number;
  };
}
export interface UsageActivity {
  timestamp: Date;
  entryId: string;
  action: UsageAction;
  userId?: string;
  sessionId?: string;
  metadata?: any;
}
export type UsageAction =
  | 'view'
  | 'search'
  | 'rate_success'
  | 'rate_failure'
  | 'create'
  | 'update'
  | 'delete'
  | 'export'
  | 'share';
export interface PerformanceMetrics {
  averageSearchTime: number;
  averageDbTime: number;
  averageAiTime: number;
  cacheHitRate: number;
  errorRate: number;
  uptime: number;
  memoryUsage: number;
  diskUsage: number;
  throughput: {
    searches: number;
    creates: number;
    updates: number;
  };
}
export interface MetricTrends {
  period: string;
  searches: TrendData[];
  usage: TrendData[];
  successRate: TrendData[];
  performance: TrendData[];
  users: TrendData[];
  errors: TrendData[];
}
export interface TrendData {
  timestamp: Date;
  value: number;
  change?: number;
  trend?: 'up' | 'down' | 'stable';
}
export interface MetricAlert {
  id: string;
  type: 'performance' | 'usage' | 'error' | 'capacity';
  severity: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  value: number;
  threshold: number;
  timestamp: Date;
  acknowledged: boolean;
  metadata?: any;
}
export interface CacheStats {
  hitCount: number;
  missCount: number;
  hitRate: number;
  size: number;
  maxSize: number;
  memoryUsage: number;
  evictions: number;
  averageAge: number;
  oldestEntry: Date;
  newestEntry: Date;
}
export declare class ServiceError extends Error {
  code: string;
  statusCode: number;
  details?: any | undefined;
  recoverable: boolean;
  constructor(
    message: string,
    code: string,
    statusCode?: number,
    details?: any | undefined,
    recoverable?: boolean
  );
  toJSON(): {
    name: string;
    message: string;
    code: string;
    statusCode: number;
    details: any;
    recoverable: boolean;
    stack: string | undefined;
  };
}
export declare class ValidationError extends ServiceError {
  field: string;
  value?: any | undefined;
  constructor(message: string, field: string, value?: any | undefined);
}
export declare class DatabaseError extends ServiceError {
  operation: string;
  details?: any | undefined;
  constructor(message: string, operation: string, details?: any | undefined);
}
export declare class SearchError extends ServiceError {
  query: string;
  details?: any | undefined;
  constructor(message: string, query: string, details?: any | undefined);
}
export declare class CacheError extends ServiceError {
  operation: string;
  details?: any | undefined;
  constructor(message: string, operation: string, details?: any | undefined);
}
export declare class AIServiceError extends ServiceError {
  provider: string;
  details?: any | undefined;
  constructor(message: string, provider: string, details?: any | undefined);
}
export interface ServiceEvents {
  'entry:created': (entry: KBEntry) => void;
  'entry:updated': (entry: KBEntry, changes: KBEntryUpdate) => void;
  'entry:deleted': (entryId: string) => void;
  'entries:batch-created': (entries: KBEntry[]) => void;
  'entries:batch-updated': (
    updates: Array<{
      id: string;
      entry: KBEntry;
      changes: KBEntryUpdate;
    }>
  ) => void;
  'entries:batch-deleted': (entryIds: string[]) => void;
  'search:performed': (query: SearchQuery, results: SearchResult[]) => void;
  'search:no-results': (query: SearchQuery) => void;
  'search:ai-fallback': (query: SearchQuery, reason: string) => void;
  'usage:recorded': (entryId: string, action: UsageAction, userId?: string, metadata?: any) => void;
  'usage:pattern': (pattern: string, frequency: number) => void;
  'error:occurred': (error: ServiceError) => void;
  'performance:degraded': (metric: string, value: number, threshold: number) => void;
  'cache:hit': (key: string) => void;
  'cache:miss': (key: string) => void;
  'cache:evicted': (key: string, reason: string) => void;
  'metrics:updated': (metrics: Partial<KBMetrics>) => void;
  'metrics:alert': (alert: MetricAlert) => void;
  'metrics:threshold-exceeded': (metric: string, value: number, threshold: number) => void;
  'data:imported': (result: ImportResult) => void;
  'data:exported': (format: string, count: number) => void;
  'data:backup-created': (path: string, size: number) => void;
  'data:restored': (result: RestoreResult) => void;
}
export interface DBKBEntry {
  id: string;
  title: string;
  problem: string;
  solution: string;
  category: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  usage_count: number;
  success_count: number;
  failure_count: number;
  version: number;
  metadata?: string;
}
export interface DBKBTag {
  entry_id: string;
  tag: string;
  weight: number;
}
export interface DBSearchHistory {
  id: number;
  query: string;
  timestamp: string;
  results_count: number;
  selected_entry_id?: string;
  user_id?: string;
  session_id?: string;
  search_type: string;
  response_time: number;
  success: boolean;
  metadata?: string;
}
export interface DBUsageMetric {
  id: number;
  entry_id: string;
  action: string;
  timestamp: string;
  user_id?: string;
  session_id?: string;
  metadata?: string;
  value?: number;
}
export interface DBMetricSnapshot {
  id: number;
  timestamp: string;
  metric_type: string;
  metric_name: string;
  value: number;
  metadata?: string;
}
export interface DBAlert {
  id: string;
  type: string;
  severity: string;
  title: string;
  message: string;
  value: number;
  threshold: number;
  timestamp: string;
  acknowledged: boolean;
  acknowledged_at?: string;
  acknowledged_by?: string;
  metadata?: string;
}
export declare const DEFAULT_SERVICE_CONFIG: ServiceConfig;
export type ExportFormat = 'json' | 'csv' | 'xml' | 'parquet' | 'avro' | 'orc';
export type ImportFormat = ExportFormat;
export interface IExportService {
  export(
    format: ExportFormat,
    outputPath: string,
    options?: ExportOptions,
    progressCallback?: ProgressCallback
  ): Promise<ExportResult>;
  exportStream(
    format: ExportFormat,
    options?: ExportOptions & ExportStreamOptions
  ): Promise<Readable>;
  exportBatch(
    jobs: Array<{
      format: ExportFormat;
      outputPath: string;
      options?: ExportOptions;
    }>
  ): Promise<ExportResult[]>;
  exportForSystem(
    targetSystem: string,
    outputPath: string,
    options?: ExportOptions
  ): Promise<ExportResult>;
  exportCompatible(
    targetVersion: string,
    outputPath: string,
    options?: ExportOptions
  ): Promise<ExportResult>;
  getJobStatus(jobId: string): ExportJob | null;
  cancelJob(jobId: string): Promise<boolean>;
  getSupportedFormats(): ExportFormat[];
  validateOptions(format: ExportFormat, options: ExportOptions): ValidationResult;
}
export interface IImportService {
  import(
    filePath: string,
    format: ImportFormat,
    options?: ImportOptions,
    progressCallback?: ProgressCallback
  ): Promise<ImportResult>;
  importStream(
    stream: Readable,
    format: ImportFormat,
    options?: ImportOptions,
    progressCallback?: ProgressCallback
  ): Promise<ImportResult>;
  validateImport(
    filePath: string,
    format: ImportFormat,
    options?: ImportValidationOptions
  ): Promise<ValidationResult>;
  importFromSystem(
    filePath: string,
    sourceSystem: string,
    options?: ImportOptions
  ): Promise<ImportResult>;
  importCompatible(
    filePath: string,
    sourceVersion: string,
    options?: ImportOptions
  ): Promise<ImportResult>;
  resumeImport(jobId: string): Promise<ImportResult>;
  getJobStatus(jobId: string): ImportJob | null;
  cancelJob(jobId: string): Promise<boolean>;
  getSupportedFormats(): ImportFormat[];
}
export interface ExportJob {
  id: string;
  format: ExportFormat;
  options: ExportOptions;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  startTime: Date;
  endTime?: Date;
  result?: ExportResult;
  error?: Error;
  metadata: ExportMetadata;
}
export interface ImportJob {
  id: string;
  source: string;
  format: ImportFormat;
  options: ImportOptions;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  startTime: Date;
  endTime?: Date;
  result?: ImportResult;
  error?: Error;
  metadata: ImportMetadata;
}
export interface ExportResult {
  success: boolean;
  jobId: string;
  format: ExportFormat;
  outputPath: string;
  exportedCount: number;
  fileSize?: number;
  metadata: ExportMetadata;
  processingTime: number;
  error?: string;
}
export interface ExportMetadata {
  version: string;
  exported_at: string;
  exported_by: string;
  source_system: string;
  target_format: ExportFormat;
  export_options: ExportOptions;
  compatibility_version: string;
  total_entries?: number;
  file_size?: number;
  encoding?: string;
  compression?: string;
}
export interface ImportMetadata {
  sourceSystem: string;
  sourceVersion: string;
  importedBy: string;
  validationEnabled: boolean;
  recoveryEnabled: boolean;
}
export interface ProgressCallback {
  (progress: number): void;
}
export interface ExportStreamOptions {
  batchSize?: number;
  compression?: 'gzip' | 'brotli' | 'none';
  encoding?: string;
  transform?: (data: any) => any;
}
export interface ImportValidationOptions {
  strictMode?: boolean;
  allowPartialImport?: boolean;
  validateSchema?: boolean;
  customValidators?: Array<(entry: any) => ValidationResult>;
  transformOnValidation?: boolean;
}
export interface ImportRecoveryOptions {
  enableAutoRecovery?: boolean;
  retryAttempts?: number;
  rollbackOnFailure?: boolean;
  createBackupBeforeImport?: boolean;
  resumeFromCheckpoint?: boolean;
}
export interface EnhancedExportOptions extends ExportOptions {
  limit?: number;
  tags?: string[];
  includeArchived?: boolean;
  targetSystem?: string;
  targetVersion?: string;
  compression?: 'gzip' | 'brotli' | 'none';
  encoding?: string;
  schema?: any;
  customHeaders?: Record<string, string>;
  transform?: Record<string, any>;
}
export interface EnhancedImportOptions extends ImportOptions {
  sourceSystem?: string;
  sourceVersion?: string;
  encoding?: string;
  schema?: any;
  allowPartialImport?: boolean;
  validation?: ImportValidationOptions;
  recovery?: ImportRecoveryOptions;
  transform?: {
    fieldMappings?: Record<string, string>;
    customTransform?: (entry: any) => any;
    systemSpecific?: boolean;
    legacyCompatibility?: boolean;
    enhancedFeatures?: boolean;
  };
  defaultValues?: Record<string, any>;
  requiredFields?: string[];
}
//# sourceMappingURL=services.d.ts.map
