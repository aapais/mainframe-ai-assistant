import { KBEntry, KBEntryInput, KBEntryUpdate, SearchResult, SearchOptions, ExportFormat, ImportFormat, ExportOptions, ImportOptions, ImportResult, OptimizationResult, DatabaseMetrics } from '../IStorageService';
export interface IStorageAdapter {
    initialize(): Promise<void>;
    close(): Promise<void>;
    createEntry(entry: KBEntryInput): Promise<string>;
    readEntry(id: string): Promise<KBEntry | null>;
    updateEntry(id: string, updates: KBEntryUpdate): Promise<boolean>;
    deleteEntry(id: string): Promise<boolean>;
    createEntries(entries: KBEntryInput[]): Promise<string[]>;
    readEntries(ids: string[]): Promise<(KBEntry | null)[]>;
    updateEntries(updates: Array<{
        id: string;
        updates: KBEntryUpdate;
    }>): Promise<boolean[]>;
    deleteEntries(ids: string[]): Promise<boolean[]>;
    searchEntries(query: string, options?: SearchOptions): Promise<SearchResult[]>;
    getPopularEntries(limit?: number): Promise<SearchResult[]>;
    getRecentEntries(limit?: number): Promise<SearchResult[]>;
    getSearchSuggestions(query: string, limit?: number): Promise<string[]>;
    executeSQL(sql: string, params?: any[]): Promise<any>;
    beginTransaction(): Promise<StorageTransaction>;
    export(format: ExportFormat, options?: ExportOptions): Promise<string>;
    import(data: string, format: ImportFormat, options?: ImportOptions): Promise<ImportResult>;
    getMetrics(): Promise<DatabaseMetrics>;
    optimize(): Promise<OptimizationResult>;
    healthCheck(): Promise<AdapterHealthStatus>;
    getSchemaInfo(): Promise<SchemaInfo>;
    getConfig(): AdapterConfig;
    updateConfig(config: Partial<AdapterConfig>): Promise<void>;
}
export interface StorageTransaction {
    execute(sql: string, params?: any[]): Promise<any>;
    commit(): Promise<void>;
    rollback(): Promise<void>;
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
export type AdapterType = 'sqlite' | 'postgresql' | 'mysql' | 'memory';
export interface AdapterFactory {
    createAdapter(type: AdapterType, config: any): IStorageAdapter;
    getSupportedTypes(): AdapterType[];
    isSupported(type: AdapterType): boolean;
}
export interface QueryBuilder {
    select(columns?: string[]): QueryBuilder;
    from(table: string): QueryBuilder;
    where(condition: string, ...params: any[]): QueryBuilder;
    and(condition: string, ...params: any[]): QueryBuilder;
    or(condition: string, ...params: any[]): QueryBuilder;
    orderBy(column: string, direction?: 'ASC' | 'DESC'): QueryBuilder;
    limit(count: number): QueryBuilder;
    offset(count: number): QueryBuilder;
    join(table: string, condition: string): QueryBuilder;
    leftJoin(table: string, condition: string): QueryBuilder;
    groupBy(columns: string[]): QueryBuilder;
    having(condition: string, ...params: any[]): QueryBuilder;
    build(): {
        sql: string;
        params: any[];
    };
    execute(): Promise<any[]>;
    first(): Promise<any | null>;
    count(): Promise<number>;
}
export declare class AdapterError extends Error {
    code: string;
    adapterType: AdapterType;
    details?: any | undefined;
    constructor(message: string, code: string, adapterType: AdapterType, details?: any | undefined);
}
export declare class ConnectionError extends AdapterError {
    constructor(message: string, adapterType: AdapterType, details?: any);
}
export declare class QueryError extends AdapterError {
    constructor(message: string, adapterType: AdapterType, sql: string, details?: any);
}
export declare class TransactionError extends AdapterError {
    constructor(message: string, adapterType: AdapterType, details?: any);
}
export declare class SchemaError extends AdapterError {
    constructor(message: string, adapterType: AdapterType, details?: any);
}
//# sourceMappingURL=IStorageAdapter.d.ts.map