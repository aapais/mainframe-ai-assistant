/**
 * Consolidated Service Types
 *
 * This file consolidates all service-related interfaces and types
 * from across the codebase to eliminate duplicates and conflicts.
 */

import { EventEmitter } from 'events';
import type { DatabaseConfig, SearchConfig, CacheConfig } from './config';
import type { PerformanceMetrics } from './performance';

// Base Service Interface
export interface IBaseService {
  readonly name: string;
  readonly version: string;
  readonly status: 'initializing' | 'running' | 'stopping' | 'stopped' | 'error';

  start(): Promise<void>;
  stop(): Promise<void>;
  restart(): Promise<void>;
  getHealth(): Promise<HealthStatus>;
  getMetrics?(): Promise<PerformanceMetrics>;
}

// Health Status
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: number;
  uptime: number;
  checks: HealthCheck[];
  dependencies?: ServiceDependency[];
}

export interface HealthCheck {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  duration: number;
  message?: string;
  details?: Record<string, any>;
}

export interface ServiceDependency {
  name: string;
  status: 'available' | 'unavailable' | 'degraded';
  responseTime?: number;
  version?: string;
}

// Knowledge Base Service
export interface IKnowledgeBaseService extends EventEmitter, IBaseService {
  // CRUD Operations
  create(entry: KBEntryData): Promise<KBEntry>;
  update(id: string, updates: Partial<KBEntryData>): Promise<KBEntry>;
  delete(id: string): Promise<boolean>;
  get(id: string): Promise<KBEntry | null>;
  list(options?: ListOptions): Promise<KBEntryList>;

  // Search Operations
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;

  // Bulk Operations
  bulkCreate(entries: KBEntryData[]): Promise<KBEntry[]>;
  bulkUpdate(updates: Array<{ id: string; data: Partial<KBEntryData> }>): Promise<KBEntry[]>;
  bulkDelete(ids: string[]): Promise<boolean>;

  // Analytics
  getAnalytics(timeRange?: TimeRange): Promise<KBAnalytics>;
}

// Search Service
export interface ISearchService extends IBaseService {
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  index(documents: SearchDocument[]): Promise<void>;
  reindex(): Promise<void>;
  suggest(partial: string, options?: SuggestOptions): Promise<string[]>;
  analyze(text: string): Promise<AnalysisResult>;
  getIndexStats(): Promise<IndexStats>;
}

// Cache Service
export interface ICacheService extends IBaseService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<boolean>;
  clear(): Promise<void>;
  exists(key: string): Promise<boolean>;
  keys(pattern?: string): Promise<string[]>;
  stats(): CacheStats;

  // Bulk operations
  mget<T>(keys: string[]): Promise<(T | null)[]>;
  mset<T>(items: Array<{ key: string; value: T; ttl?: number }>): Promise<void>;
  mdel(keys: string[]): Promise<number>;
}

// Validation Service
export interface IValidationService extends IBaseService {
  validate<T>(data: T, schema: ValidationSchema): Promise<ValidationResult>;
  validateField(value: any, rules: ValidationRule[]): Promise<FieldValidationResult>;
  registerValidator(name: string, validator: ValidatorFunction): void;
  getSchema(name: string): ValidationSchema | null;
  registerSchema(name: string, schema: ValidationSchema): void;
}

// Memory Service
export interface IMemoryService extends IBaseService {
  allocate(size: number, type?: string): Promise<MemoryBlock>;
  deallocate(block: MemoryBlock): Promise<void>;
  getUsage(): MemoryUsage;
  optimize(): Promise<void>;
  createPool(config: MemoryPoolConfig): MemoryPool;
  monitor(): MemoryMonitor;
}

// Operation Logger Service
export interface IOperationLoggerService extends IBaseService {
  log(operation: OperationLog): Promise<void>;
  query(filters: LogQueryFilters): Promise<OperationLog[]>;
  archive(beforeDate: Date): Promise<number>;
  getStats(timeRange: TimeRange): Promise<OperationStats>;
  export(format: ExportFormat, filters?: LogQueryFilters): Promise<string>;
}

// Data Types
export interface KBEntry {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  author?: string;
  status: 'draft' | 'published' | 'archived';
}

export interface KBEntryData {
  title: string;
  content: string;
  category: string;
  tags?: string[];
  metadata?: Record<string, any>;
  author?: string;
  status?: 'draft' | 'published' | 'archived';
}

export interface KBEntryList {
  entries: KBEntry[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface SearchResult {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  score: number;
  highlights?: string[];
  metadata?: Record<string, any>;
}

export interface SearchDocument {
  id: string;
  content: string;
  title?: string;
  category?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface SearchOptions {
  limit?: number;
  offset?: number;
  filters?: Record<string, any>;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  includeHighlights?: boolean;
  fuzzy?: boolean;
  categories?: string[];
  tags?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
}

export interface SuggestOptions {
  limit?: number;
  categories?: string[];
  includeScore?: boolean;
}

export interface ListOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filters?: Record<string, any>;
  search?: string;
}

export interface TimeRange {
  start: Date;
  end: Date;
}

// Analytics and Statistics
export interface KBAnalytics {
  totalEntries: number;
  categoryCounts: Record<string, number>;
  tagCounts: Record<string, number>;
  recentActivity: Array<{
    date: string;
    created: number;
    updated: number;
    viewed: number;
  }>;
  popularEntries: Array<{
    id: string;
    title: string;
    views: number;
  }>;
  searchStats: {
    totalQueries: number;
    avgResultCount: number;
    popularQueries: Array<{
      query: string;
      count: number;
    }>;
  };
}

export interface IndexStats {
  documentCount: number;
  indexSize: number;
  lastUpdated: Date;
  fields: Array<{
    name: string;
    type: string;
    indexed: boolean;
  }>;
  performance: {
    avgQueryTime: number;
    totalQueries: number;
    cacheHitRate: number;
  };
}

export interface AnalysisResult {
  tokens: string[];
  stemmed: string[];
  entities?: Array<{
    text: string;
    type: string;
    confidence: number;
  }>;
  sentiment?: {
    score: number;
    label: 'positive' | 'negative' | 'neutral';
  };
  language?: string;
}

export interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  hitRate: number;
  evictions: number;
  memoryUsage?: number;
  keyCount: number;
  lastAccessed?: Date;
}

// Validation Types
export interface ValidationSchema {
  name: string;
  version: string;
  fields: Record<string, FieldSchema>;
  required?: string[];
  additionalProperties?: boolean;
  rules?: ValidationRule[];
}

export interface FieldSchema {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'date';
  required?: boolean;
  rules?: ValidationRule[];
  children?: Record<string, FieldSchema>;
  items?: FieldSchema;
}

export interface ValidationRule {
  name: string;
  params?: any[];
  message?: string;
  custom?: ValidatorFunction;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  data?: any;
}

export interface FieldValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  value?: any;
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
  code: string;
  value?: any;
}

export type ValidatorFunction = (value: any, params?: any[]) => boolean | Promise<boolean>;

// Memory Management Types
export interface MemoryBlock {
  id: string;
  size: number;
  type: string;
  allocated: Date;
  lastAccessed?: Date;
}

export interface MemoryUsage {
  total: number;
  used: number;
  free: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  arrayBuffers?: number;
}

export interface MemoryPoolConfig {
  blockSize: number;
  initialBlocks: number;
  maxBlocks: number;
  growthFactor: number;
  shrinkThreshold: number;
}

export interface MemoryPool {
  allocate(): MemoryBlock | null;
  deallocate(block: MemoryBlock): void;
  getStats(): MemoryPoolStats;
  resize(newSize: number): void;
}

export interface MemoryPoolStats {
  totalBlocks: number;
  usedBlocks: number;
  freeBlocks: number;
  totalSize: number;
  usedSize: number;
  fragmentationRatio: number;
}

export interface MemoryMonitor {
  start(): void;
  stop(): void;
  getReport(): MemoryReport;
  onAlert(callback: (alert: MemoryAlert) => void): void;
}

export interface MemoryReport {
  timestamp: Date;
  usage: MemoryUsage;
  trends: {
    direction: 'increasing' | 'decreasing' | 'stable';
    rate: number; // bytes per second
  };
  leaks: MemoryLeak[];
  recommendations: string[];
}

export interface MemoryLeak {
  type: string;
  size: number;
  location?: string;
  age: number;
  confidence: number;
}

export interface MemoryAlert {
  type: 'high_usage' | 'leak_detected' | 'fragmentation' | 'gc_pressure';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: Date;
  details: Record<string, any>;
}

// Operation Logging Types
export interface OperationLog {
  id: string;
  timestamp: Date;
  operation: string;
  userId?: string;
  sessionId?: string;
  parameters: Record<string, any>;
  result: 'success' | 'failure' | 'partial';
  duration: number;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

export interface LogQueryFilters {
  startDate?: Date;
  endDate?: Date;
  operation?: string;
  userId?: string;
  result?: 'success' | 'failure' | 'partial';
  limit?: number;
  offset?: number;
}

export interface OperationStats {
  totalOperations: number;
  successRate: number;
  avgDuration: number;
  operationCounts: Record<string, number>;
  errorCounts: Record<string, number>;
  userActivity: Record<string, number>;
  timeDistribution: Array<{
    hour: number;
    count: number;
  }>;
}

export type ExportFormat = 'json' | 'csv' | 'xml';

// Service Factory Types
export interface ServiceRegistration {
  name: string;
  service: IBaseService;
  dependencies?: string[];
  config?: Record<string, any>;
}

export interface ServiceManager {
  register(registration: ServiceRegistration): void;
  start(serviceName?: string): Promise<void>;
  stop(serviceName?: string): Promise<void>;
  get<T extends IBaseService>(serviceName: string): T | null;
  getAll(): IBaseService[];
  getHealth(): Promise<Record<string, HealthStatus>>;
  onServiceStateChange(callback: (service: string, state: string) => void): void;
}

// Type Guards
export function isKBEntry(obj: any): obj is KBEntry {
  return obj && typeof obj.id === 'string' && typeof obj.title === 'string';
}

export function isSearchResult(obj: any): obj is SearchResult {
  return obj && typeof obj.id === 'string' && typeof obj.score === 'number';
}

export function isValidationResult(obj: any): obj is ValidationResult {
  return obj && typeof obj.valid === 'boolean' && Array.isArray(obj.errors);
}
