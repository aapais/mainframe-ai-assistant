/**
 * Storage Adapter Interface
 * Defines the contract for different storage backends (SQLite, PostgreSQL, etc.)
 *
 * This interface enables the Strategy pattern for storage backends, allowing
 * the StorageService to work with different database systems transparently.
 */

import {
  KBEntry,
  KBEntryInput,
  KBEntryUpdate,
  SearchResult,
  SearchOptions,
  ExportFormat,
  ImportFormat,
  ExportOptions,
  ImportOptions,
  ImportResult,
  OptimizationResult,
  DatabaseMetrics,
} from '../IStorageService';

export interface IStorageAdapter {
  // ========================
  // Lifecycle Management
  // ========================

  /**
   * Initialize the storage adapter with configuration
   */
  initialize(): Promise<void>;

  /**
   * Close the storage adapter and cleanup resources
   */
  close(): Promise<void>;

  // ========================
  // Core CRUD Operations
  // ========================

  /**
   * Create a new knowledge base entry
   */
  createEntry(entry: KBEntryInput): Promise<string>;

  /**
   * Read a knowledge base entry by ID
   */
  readEntry(id: string): Promise<KBEntry | null>;

  /**
   * Update an existing knowledge base entry
   */
  updateEntry(id: string, updates: KBEntryUpdate): Promise<boolean>;

  /**
   * Delete a knowledge base entry
   */
  deleteEntry(id: string): Promise<boolean>;

  // ========================
  // Batch Operations
  // ========================

  /**
   * Create multiple knowledge base entries in a single transaction
   */
  createEntries(entries: KBEntryInput[]): Promise<string[]>;

  /**
   * Read multiple knowledge base entries by IDs
   */
  readEntries(ids: string[]): Promise<(KBEntry | null)[]>;

  /**
   * Update multiple knowledge base entries in a single transaction
   */
  updateEntries(updates: Array<{ id: string; updates: KBEntryUpdate }>): Promise<boolean[]>;

  /**
   * Delete multiple knowledge base entries in a single transaction
   */
  deleteEntries(ids: string[]): Promise<boolean[]>;

  // ========================
  // Search Operations
  // ========================

  /**
   * Search knowledge base entries with advanced options
   */
  searchEntries(query: string, options?: SearchOptions): Promise<SearchResult[]>;

  /**
   * Get popular entries based on usage metrics
   */
  getPopularEntries(limit?: number): Promise<SearchResult[]>;

  /**
   * Get recent entries based on creation date
   */
  getRecentEntries(limit?: number): Promise<SearchResult[]>;

  /**
   * Auto-complete search suggestions
   */
  getSearchSuggestions(query: string, limit?: number): Promise<string[]>;

  // ========================
  // Data Management
  // ========================

  /**
   * Execute raw SQL for plugin extensions
   */
  executeSQL(sql: string, params?: any[]): Promise<any>;

  /**
   * Begin a database transaction
   */
  beginTransaction(): Promise<StorageTransaction>;

  /**
   * Export data in specified format
   */
  export(format: ExportFormat, options?: ExportOptions): Promise<string>;

  /**
   * Import data from specified format
   */
  import(data: string, format: ImportFormat, options?: ImportOptions): Promise<ImportResult>;

  // ========================
  // Performance & Monitoring
  // ========================

  /**
   * Get database performance metrics
   */
  getMetrics(): Promise<DatabaseMetrics>;

  /**
   * Optimize database performance
   */
  optimize(): Promise<OptimizationResult>;

  /**
   * Perform health check on the database
   */
  healthCheck(): Promise<AdapterHealthStatus>;

  /**
   * Get database schema information
   */
  getSchemaInfo(): Promise<SchemaInfo>;

  // ========================
  // Configuration
  // ========================

  /**
   * Get adapter-specific configuration
   */
  getConfig(): AdapterConfig;

  /**
   * Update adapter configuration
   */
  updateConfig(config: Partial<AdapterConfig>): Promise<void>;
}

// ========================
// Supporting Interfaces
// ========================

export interface StorageTransaction {
  /**
   * Execute SQL within the transaction
   */
  execute(sql: string, params?: any[]): Promise<any>;

  /**
   * Commit the transaction
   */
  commit(): Promise<void>;

  /**
   * Rollback the transaction
   */
  rollback(): Promise<void>;

  /**
   * Check if transaction is active
   */
  isActive(): boolean;
}

export interface AdapterHealthStatus {
  status: 'healthy' | 'warning' | 'critical';
  uptime: number;
  connectionCount: number;
  lastError?: Error;
  metrics: Record<string, number>;
  issues?: Array<{
    severity: 'warning' | 'critical';
    message: string;
    details?: any;
  }>;
}

export interface SchemaInfo {
  version: string;
  tables: TableInfo[];
  indexes: IndexInfo[];
  triggers: TriggerInfo[];
  constraints: ConstraintInfo[];
}

export interface TableInfo {
  name: string;
  columns: ColumnInfo[];
  rowCount: number;
  size: number;
  lastModified?: Date;
}

export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: any;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  references?: {
    table: string;
    column: string;
  };
}

export interface IndexInfo {
  name: string;
  table: string;
  columns: string[];
  unique: boolean;
  type: string;
  size: number;
  usage: {
    scanCount: number;
    seekCount: number;
    lastUsed?: Date;
  };
}

export interface TriggerInfo {
  name: string;
  table: string;
  event: 'INSERT' | 'UPDATE' | 'DELETE';
  timing: 'BEFORE' | 'AFTER' | 'INSTEAD OF';
  definition: string;
}

export interface ConstraintInfo {
  name: string;
  type: 'PRIMARY KEY' | 'FOREIGN KEY' | 'UNIQUE' | 'CHECK' | 'NOT NULL';
  table: string;
  columns: string[];
  referencedTable?: string;
  referencedColumns?: string[];
  definition: string;
}

export interface AdapterConfig {
  connectionString: string;
  maxConnections: number;
  connectionTimeout: number;
  queryTimeout: number;
  retryAttempts: number;
  enableWAL: boolean;
  enableForeignKeys: boolean;
  pragma: Record<string, string | number>;
  performanceTuning: {
    enableQueryPlan: boolean;
    enableStatistics: boolean;
    autoVacuum: boolean;
    analysisInterval: number;
  };
  security: {
    enableEncryption: boolean;
    encryptionKey?: string;
    enableAudit: boolean;
    auditLevel: 'minimal' | 'standard' | 'comprehensive';
  };
  backup: {
    enableWALCheckpoint: boolean;
    checkpointInterval: number;
    backupOnClose: boolean;
  };
}

// ========================
// Adapter Types
// ========================

export type AdapterType = 'sqlite' | 'postgresql' | 'mysql' | 'memory';

export interface AdapterFactory {
  /**
   * Create a storage adapter instance
   */
  createAdapter(type: AdapterType, config: any): IStorageAdapter;

  /**
   * Get supported adapter types
   */
  getSupportedTypes(): AdapterType[];

  /**
   * Check if adapter type is supported
   */
  isSupported(type: AdapterType): boolean;
}

// ========================
// Query Builder Interface
// ========================

export interface QueryBuilder {
  /**
   * Start a SELECT query
   */
  select(columns?: string[]): QueryBuilder;

  /**
   * Specify FROM table
   */
  from(table: string): QueryBuilder;

  /**
   * Add WHERE condition
   */
  where(condition: string, ...params: any[]): QueryBuilder;

  /**
   * Add AND condition
   */
  and(condition: string, ...params: any[]): QueryBuilder;

  /**
   * Add OR condition
   */
  or(condition: string, ...params: any[]): QueryBuilder;

  /**
   * Add ORDER BY clause
   */
  orderBy(column: string, direction?: 'ASC' | 'DESC'): QueryBuilder;

  /**
   * Add LIMIT clause
   */
  limit(count: number): QueryBuilder;

  /**
   * Add OFFSET clause
   */
  offset(count: number): QueryBuilder;

  /**
   * Add JOIN clause
   */
  join(table: string, condition: string): QueryBuilder;

  /**
   * Add LEFT JOIN clause
   */
  leftJoin(table: string, condition: string): QueryBuilder;

  /**
   * Add GROUP BY clause
   */
  groupBy(columns: string[]): QueryBuilder;

  /**
   * Add HAVING clause
   */
  having(condition: string, ...params: any[]): QueryBuilder;

  /**
   * Build the final SQL query
   */
  build(): { sql: string; params: any[] };

  /**
   * Execute the query
   */
  execute(): Promise<any[]>;

  /**
   * Execute and get first result
   */
  first(): Promise<any | null>;

  /**
   * Execute and get count
   */
  count(): Promise<number>;
}

// ========================
// Error Types
// ========================

export class AdapterError extends Error {
  constructor(
    message: string,
    public code: string,
    public adapterType: AdapterType,
    public details?: any
  ) {
    super(message);
    this.name = 'AdapterError';
  }
}

export class ConnectionError extends AdapterError {
  constructor(message: string, adapterType: AdapterType, details?: any) {
    super(message, 'CONNECTION_ERROR', adapterType, details);
    this.name = 'ConnectionError';
  }
}

export class QueryError extends AdapterError {
  constructor(message: string, adapterType: AdapterType, sql: string, details?: any) {
    super(message, 'QUERY_ERROR', adapterType, { sql, ...details });
    this.name = 'QueryError';
  }
}

export class TransactionError extends AdapterError {
  constructor(message: string, adapterType: AdapterType, details?: any) {
    super(message, 'TRANSACTION_ERROR', adapterType, details);
    this.name = 'TransactionError';
  }
}

export class SchemaError extends AdapterError {
  constructor(message: string, adapterType: AdapterType, details?: any) {
    super(message, 'SCHEMA_ERROR', adapterType, details);
    this.name = 'SchemaError';
  }
}
