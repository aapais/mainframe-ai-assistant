/**
 * Shared Types Index
 *
 * Central export point for all shared types across the application.
 * This eliminates the need for multiple type definitions and reduces conflicts.
 */

// Performance Types
export * from './performance';

// Configuration Types
export * from './config';

// Service Types
export * from './services';

// Common utility types
export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// Event system types
export interface BaseEvent {
  type: string;
  timestamp: number;
  source: string;
  data?: Record<string, any>;
}

export interface EventHandler<T extends BaseEvent = BaseEvent> {
  (event: T): void | Promise<void>;
}

export interface EventEmitter<T extends BaseEvent = BaseEvent> {
  on(event: string, handler: EventHandler<T>): void;
  off(event: string, handler: EventHandler<T>): void;
  emit(event: T): void;
}

// Error types
export interface ApplicationError {
  code: string;
  message: string;
  details?: Record<string, any>;
  cause?: Error;
  timestamp: number;
  context?: Record<string, any>;
}

export interface ErrorHandler {
  handle(error: ApplicationError): void | Promise<void>;
}

// Response wrapper types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApplicationError;
  metadata?: {
    timestamp: number;
    requestId: string;
    version: string;
  };
}

export interface PaginatedResponse<T = any> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Generic CRUD operations
export interface CrudOperations<T, TCreate = Partial<T>, TUpdate = Partial<T>> {
  create(data: TCreate): Promise<T>;
  read(id: string): Promise<T | null>;
  update(id: string, data: TUpdate): Promise<T>;
  delete(id: string): Promise<boolean>;
  list(options?: ListOptions): Promise<PaginatedResponse<T>>;
}

export interface ListOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filters?: Record<string, any>;
  search?: string;
}

// Async operation states
export type AsyncState = 'idle' | 'loading' | 'success' | 'error';

export interface AsyncOperation<T = any> {
  state: AsyncState;
  data?: T;
  error?: ApplicationError;
  loading: boolean;
}

// Time-related types
export interface TimeRange {
  start: Date;
  end: Date;
}

export interface Duration {
  value: number;
  unit: 'ms' | 's' | 'm' | 'h' | 'd';
}

// File and media types
export interface FileMetadata {
  name: string;
  size: number;
  type: string;
  lastModified: Date;
  checksum?: string;
  encoding?: string;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
  speed?: number; // bytes per second
  remaining?: number; // seconds
}

// Batch operation types
export interface BatchOperation<T> {
  operation: 'create' | 'update' | 'delete';
  data: T;
  id?: string;
}

export interface BatchResult<T> {
  success: T[];
  errors: Array<{
    operation: BatchOperation<T>;
    error: ApplicationError;
  }>;
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
}

// Plugin and extension types
export interface Plugin {
  name: string;
  version: string;
  description?: string;
  author?: string;
  enabled: boolean;
  config?: Record<string, any>;
  hooks?: Record<string, Function[]>;
}

export interface Hook<T = any> {
  name: string;
  priority: number;
  handler: (data: T, context?: Record<string, any>) => T | Promise<T>;
}

// Theme and UI types
export interface ThemeConfig {
  mode: 'light' | 'dark' | 'auto';
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontSize: 'small' | 'medium' | 'large';
  spacing: 'compact' | 'normal' | 'comfortable';
  animations: boolean;
}

export interface UIComponent {
  id: string;
  type: string;
  props: Record<string, any>;
  children?: UIComponent[];
  visible: boolean;
  disabled?: boolean;
}

// Serialization types
export type SerializableValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | Date
  | SerializableValue[]
  | { [key: string]: SerializableValue };

export interface Serializer<T = any> {
  serialize(data: T): string | Buffer;
  deserialize(data: string | Buffer): T;
  getMimeType(): string;
}

// Cache-related types
export interface CacheEntry<T = any> {
  key: string;
  value: T;
  createdAt: Date;
  lastAccessed: Date;
  accessCount: number;
  ttl?: number;
  size?: number;
}

export interface CacheMetrics {
  hits: number;
  misses: number;
  hitRate: number;
  evictions: number;
  size: number;
  memoryUsage?: number;
}

// Search and indexing types
export interface SearchableDocument {
  id: string;
  content: string;
  title?: string;
  category?: string;
  tags?: string[];
  metadata?: Record<string, any>;
  weight?: number;
}

export interface SearchQuery {
  query: string;
  filters?: Record<string, any>;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
  fuzzy?: boolean;
  boost?: Record<string, number>;
}

export interface SearchHit {
  document: SearchableDocument;
  score: number;
  highlights?: Record<string, string[]>;
  explanation?: string;
}

// Validation and schema types
export interface Schema {
  type: string;
  properties?: Record<string, Schema>;
  items?: Schema;
  required?: string[];
  additionalProperties?: boolean;
  pattern?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  enum?: any[];
  format?: string;
}

export interface ValidationContext {
  path: string[];
  root: any;
  parent?: any;
  property?: string;
  schema: Schema;
}

// Utility type helpers
export type KeysOfType<T, U> = {
  [K in keyof T]: T[K] extends U ? K : never;
}[keyof T];

export type RequiredKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? never : K;
}[keyof T];

export type OptionalKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? K : never;
}[keyof T];

export type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

// Function utility types
export type AsyncFunction<T extends any[] = any[], R = any> = (...args: T) => Promise<R>;
export type SyncFunction<T extends any[] = any[], R = any> = (...args: T) => R;
export type AnyFunction<T extends any[] = any[], R = any> = AsyncFunction<T, R> | SyncFunction<T, R>;

// Type assertion helpers
export function isString(value: any): value is string {
  return typeof value === 'string';
}

export function isNumber(value: any): value is number {
  return typeof value === 'number' && !isNaN(value);
}

export function isBoolean(value: any): value is boolean {
  return typeof value === 'boolean';
}

export function isObject(value: any): value is Record<string, any> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function isArray<T = any>(value: any): value is T[] {
  return Array.isArray(value);
}

export function isDate(value: any): value is Date {
  return value instanceof Date && !isNaN(value.getTime());
}

export function isFunction(value: any): value is Function {
  return typeof value === 'function';
}

export function isPromise<T = any>(value: any): value is Promise<T> {
  return value && typeof value.then === 'function';
}

export function isDefined<T>(value: T | undefined | null): value is T {
  return value !== undefined && value !== null;
}

export function isEmpty(value: any): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}