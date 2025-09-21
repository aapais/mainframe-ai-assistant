import { EventEmitter } from 'events';
import { KBEntry, KBEntryInput, KBEntryUpdate, SearchResult, SearchOptions } from '../../types';
export interface StorageConfig {
    database: {
        type: 'sqlite' | 'postgresql' | 'mysql';
        path?: string;
        host?: string;
        port?: number;
        database?: string;
        credentials?: DatabaseCredentials;
        pool?: PoolConfig;
        pragmas?: Record<string, string | number>;
    };
    backup: {
        enabled: boolean;
        interval: number;
        retention: number;
        compression: boolean;
        encryption?: EncryptionConfig;
        destinations: BackupDestination[];
    };
    performance: {
        caching: CacheConfig;
        indexing: IndexConfig;
        maintenance: MaintenanceConfig;
        monitoring: MonitoringConfig;
    };
    mvp: {
        version: '1' | '2' | '3' | '4' | '5';
        features: MVPFeatureConfig;
        extensions: ExtensionConfig[];
    };
    integrations: {
        ai: AIIntegrationConfig;
        external: ExternalIntegrationConfig[];
        eventBus: EventBusConfig;
    };
}
export interface DatabaseCredentials {
    username: string;
    password: string;
    ssl?: boolean;
    connectionTimeout?: number;
}
export interface PoolConfig {
    min: number;
    max: number;
    acquireTimeoutMillis: number;
    idleTimeoutMillis: number;
}
export interface EncryptionConfig {
    algorithm: 'aes-256-gcm' | 'aes-256-cbc';
    keyDerivation: 'pbkdf2' | 'scrypt';
    iterations?: number;
    saltLength?: number;
}
export interface BackupDestination {
    type: 'local' | 's3' | 'azure' | 'gcp';
    path: string;
    credentials?: any;
    retention?: number;
}
export interface CacheConfig {
    enabled: boolean;
    provider: 'memory' | 'redis' | 'hybrid';
    maxSize: number;
    ttl: number;
    compression: boolean;
}
export interface IndexConfig {
    strategy: 'automatic' | 'manual' | 'adaptive';
    maintenanceInterval: number;
    analyzePeriod: number;
}
export interface MaintenanceConfig {
    autoVacuum: boolean;
    autoAnalyze: boolean;
    scheduleWindow: string;
}
export interface MonitoringConfig {
    enabled: boolean;
    metricsInterval: number;
    alertThresholds: Record<string, number>;
    exportFormat: 'prometheus' | 'json' | 'influx';
}
export interface MVPFeatureConfig {
    patternDetection?: boolean;
    codeAnalysis?: boolean;
    templateEngine?: boolean;
    autoResolution?: boolean;
    predictiveAnalytics?: boolean;
}
export interface ExtensionConfig {
    name: string;
    enabled: boolean;
    config: Record<string, any>;
}
export interface AIIntegrationConfig {
    gemini?: {
        apiKey: string;
        model: string;
        timeout: number;
    };
    copilot?: {
        apiKey: string;
        endpoint: string;
    };
}
export interface ExternalIntegrationConfig {
    type: 'servicenow' | 'jira' | 'idz' | 'splunk';
    endpoint: string;
    credentials: any;
    syncInterval?: number;
}
export interface EventBusConfig {
    provider: 'memory' | 'redis' | 'kafka';
    config: Record<string, any>;
}
export interface IStorageService extends EventEmitter {
    initialize(config: StorageConfig): Promise<void>;
    close(): Promise<void>;
    createEntry(entry: KBEntryInput): Promise<string>;
    readEntry(id: string): Promise<KBEntry | null>;
    updateEntry(id: string, updates: KBEntryUpdate): Promise<boolean>;
    deleteEntry(id: string): Promise<boolean>;
    searchEntries(query: string, options?: SearchOptions): Promise<SearchResult[]>;
    createEntries(entries: KBEntryInput[]): Promise<string[]>;
    readEntries(ids: string[]): Promise<KBEntry[]>;
    updateEntries(updates: Array<{
        id: string;
        updates: KBEntryUpdate;
    }>): Promise<boolean[]>;
    deleteEntries(ids: string[]): Promise<boolean[]>;
    createPattern(pattern: PatternData): Promise<string>;
    getPatterns(criteria: PatternCriteria): Promise<Pattern[]>;
    updatePattern(id: string, updates: PatternUpdate): Promise<boolean>;
    deletePattern(id: string): Promise<boolean>;
    createIncident(incident: IncidentData): Promise<string>;
    getIncidents(criteria: IncidentCriteria): Promise<Incident[]>;
    updateIncident(id: string, updates: IncidentUpdate): Promise<boolean>;
    linkIncidentToPattern(incidentId: string, patternId: string): Promise<void>;
    storeCodeAnalysis(analysis: CodeAnalysis): Promise<string>;
    getCodeAnalysis(criteria: CodeCriteria): Promise<CodeAnalysis[]>;
    linkCodeToKB(codeId: string, kbId: string, linkType: LinkType): Promise<void>;
    updateCodeAnalysis(id: string, updates: CodeAnalysisUpdate): Promise<boolean>;
    createRepository(repo: RepositoryData): Promise<string>;
    getRepositories(): Promise<Repository[]>;
    scanRepository(repoId: string): Promise<ScanResult>;
    storeTemplate(template: CodeTemplate): Promise<string>;
    getTemplates(criteria: TemplateCriteria): Promise<CodeTemplate[]>;
    updateTemplate(id: string, updates: TemplateUpdate): Promise<boolean>;
    generateTemplate(sourceCode: string, metadata: TemplateMetadata): Promise<string>;
    createProject(project: ProjectData): Promise<string>;
    getProjects(criteria: ProjectCriteria): Promise<Project[]>;
    updateProject(id: string, updates: ProjectUpdate): Promise<boolean>;
    storePrediction(prediction: PredictionData): Promise<string>;
    getPredictions(criteria: PredictionCriteria): Promise<Prediction[]>;
    getAnalytics(timeRange: TimeRange, metrics: string[]): Promise<AnalyticsData>;
    storeModel(model: MLModelData): Promise<string>;
    getModel(id: string): Promise<MLModel | null>;
    updateModelMetrics(id: string, metrics: ModelMetrics): Promise<boolean>;
    backup(options?: BackupOptions): Promise<BackupResult>;
    restore(backupPath: string, options?: RestoreOptions): Promise<RestoreResult>;
    export(format: ExportFormat, options?: ExportOptions): Promise<string>;
    import(data: string, format: ImportFormat, options?: ImportOptions): Promise<ImportResult>;
    migrate(targetVersion: string): Promise<MigrationResult[]>;
    getMetrics(): Promise<StorageMetrics>;
    optimize(): Promise<OptimizationResult>;
    healthCheck(): Promise<HealthStatus>;
    loadPlugin(plugin: IStoragePlugin): Promise<void>;
    unloadPlugin(pluginName: string): Promise<void>;
    getLoadedPlugins(): string[];
    subscribe(event: string, handler: Function): void;
    unsubscribe(event: string, handler: Function): void;
    emit(event: string, ...args: any[]): boolean;
}
export interface PatternData {
    id?: string;
    pattern_type: 'temporal' | 'component' | 'error' | 'correlation';
    description: string;
    confidence: number;
    frequency: number;
    severity: 'low' | 'medium' | 'high' | 'critical';
    first_seen: Date;
    last_seen: Date;
    metadata?: Record<string, any>;
}
export interface Pattern extends PatternData {
    id: string;
    created_at: Date;
    updated_at: Date;
}
export interface PatternCriteria {
    type?: 'temporal' | 'component' | 'error' | 'correlation';
    severity?: 'low' | 'medium' | 'high' | 'critical';
    dateRange?: {
        start: Date;
        end: Date;
    };
    limit?: number;
    offset?: number;
}
export interface PatternUpdate {
    description?: string;
    confidence?: number;
    frequency?: number;
    severity?: 'low' | 'medium' | 'high' | 'critical';
    metadata?: Record<string, any>;
}
export interface IncidentData {
    id?: string;
    ticket_id: string;
    title: string;
    description: string;
    component?: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    status: 'aberto' | 'em_tratamento' | 'resolvido' | 'fechado';
    created_at?: Date;
    resolved_at?: Date;
    resolution?: string;
    kb_entry_id?: string;
    pattern_id?: string;
}
export interface Incident extends IncidentData {
    id: string;
    created_at: Date;
    updated_at: Date;
}
export interface IncidentCriteria {
    status?: 'open' | 'in_progress' | 'resolved' | 'closed';
    severity?: 'low' | 'medium' | 'high' | 'critical';
    component?: string;
    pattern_id?: string;
    dateRange?: {
        start: Date;
        end: Date;
    };
    limit?: number;
    offset?: number;
}
export interface IncidentUpdate {
    title?: string;
    description?: string;
    component?: string;
    severity?: 'low' | 'medium' | 'high' | 'critical';
    status?: 'open' | 'in_progress' | 'resolved' | 'closed';
    resolution?: string;
    resolved_at?: Date;
}
export interface CodeAnalysis {
    id: string;
    repository_id: string;
    file_path: string;
    language: string;
    size_bytes: number;
    lines_count: number;
    complexity_score?: number;
    hash: string;
    parsed_at: Date;
    structure: ParsedStructure;
    issues: CodeIssue[];
    metadata?: Record<string, any>;
}
export interface ParsedStructure {
    functions: FunctionDefinition[];
    variables: VariableDefinition[];
    imports: ImportDefinition[];
    classes?: ClassDefinition[];
}
export interface FunctionDefinition {
    name: string;
    line_start: number;
    line_end: number;
    parameters: string[];
    complexity: number;
}
export interface VariableDefinition {
    name: string;
    type: string;
    line: number;
    scope: string;
}
export interface ImportDefinition {
    module: string;
    items: string[];
    line: number;
}
export interface ClassDefinition {
    name: string;
    line_start: number;
    line_end: number;
    methods: FunctionDefinition[];
}
export interface CodeIssue {
    type: 'error' | 'warning' | 'info';
    message: string;
    line: number;
    column?: number;
    rule?: string;
    severity: number;
}
export interface CodeCriteria {
    repository_id?: string;
    language?: string;
    file_path?: string;
    complexity_min?: number;
    complexity_max?: number;
    has_issues?: boolean;
    limit?: number;
    offset?: number;
}
export interface CodeAnalysisUpdate {
    complexity_score?: number;
    structure?: ParsedStructure;
    issues?: CodeIssue[];
    metadata?: Record<string, any>;
}
export interface RepositoryData {
    id?: string;
    name: string;
    path: string;
    type: 'local' | 'git' | 'idz';
    metadata?: Record<string, any>;
}
export interface Repository extends RepositoryData {
    id: string;
    created_at: Date;
    last_scan?: Date;
}
export interface ScanResult {
    files_scanned: number;
    issues_found: number;
    duration_ms: number;
    errors: string[];
}
export type LinkType = 'solution' | 'reference' | 'example' | 'related';
export interface CodeTemplate {
    id: string;
    name: string;
    description: string;
    language: string;
    category: string;
    template_content: string;
    parameters: TemplateParameter[];
    validation_rules: ValidationRule[];
    usage_count: number;
    success_rate: number;
    created_by?: string;
    created_at: Date;
    updated_at: Date;
}
export interface TemplateParameter {
    name: string;
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    required: boolean;
    default_value?: any;
    description?: string;
    validation?: string;
}
export interface ValidationRule {
    field: string;
    rule: string;
    message: string;
    severity: 'error' | 'warning';
}
export interface TemplateCriteria {
    language?: string;
    category?: string;
    name_pattern?: string;
    min_success_rate?: number;
    limit?: number;
    offset?: number;
}
export interface TemplateUpdate {
    name?: string;
    description?: string;
    template_content?: string;
    parameters?: TemplateParameter[];
    validation_rules?: ValidationRule[];
}
export interface TemplateMetadata {
    name: string;
    description: string;
    language: string;
    category: string;
    created_by?: string;
}
export interface ProjectData {
    id?: string;
    name: string;
    idz_project_path?: string;
    local_workspace_path: string;
    metadata?: Record<string, any>;
}
export interface Project extends ProjectData {
    id: string;
    created_at: Date;
    updated_at: Date;
}
export interface ProjectCriteria {
    name_pattern?: string;
    has_idz_path?: boolean;
    limit?: number;
    offset?: number;
}
export interface ProjectUpdate {
    name?: string;
    idz_project_path?: string;
    local_workspace_path?: string;
    metadata?: Record<string, any>;
}
export interface PredictionData {
    id?: string;
    prediction_type: string;
    target_entity: string;
    target_id: string;
    probability: number;
    predicted_at?: Date;
    expires_at?: Date;
    model_version: string;
    metadata?: Record<string, any>;
}
export interface Prediction extends PredictionData {
    id: string;
    predicted_at: Date;
    actual_outcome?: string;
    accuracy_score?: number;
}
export interface PredictionCriteria {
    prediction_type?: string;
    target_entity?: string;
    target_id?: string;
    min_probability?: number;
    max_probability?: number;
    date_range?: {
        start: Date;
        end: Date;
    };
    limit?: number;
    offset?: number;
}
export interface MLModelData {
    id?: string;
    model_type: string;
    model_data: Buffer;
    training_metadata: TrainingMetadata;
    performance_metrics?: ModelMetrics;
}
export interface MLModel extends MLModelData {
    id: string;
    created_at: Date;
    updated_at: Date;
}
export interface TrainingMetadata {
    algorithm: string;
    parameters: Record<string, any>;
    training_data_size: number;
    training_duration_ms: number;
    features: string[];
}
export interface ModelMetrics {
    accuracy?: number;
    precision?: number;
    recall?: number;
    f1_score?: number;
    validation_loss?: number;
    test_cases_passed?: number;
    test_cases_total?: number;
}
export interface TimeRange {
    start: Date;
    end: Date;
    granularity?: 'hour' | 'day' | 'week' | 'month';
}
export interface AnalyticsData {
    timeRange: TimeRange;
    metrics: Record<string, MetricSeries>;
    aggregations: Record<string, number>;
    trends: Record<string, TrendData>;
}
export interface MetricSeries {
    values: Array<{
        timestamp: Date;
        value: number;
    }>;
    aggregation: 'sum' | 'avg' | 'min' | 'max' | 'count';
}
export interface TrendData {
    direction: 'up' | 'down' | 'stable';
    change_percent: number;
    confidence: number;
}
export interface BackupOptions {
    includeHistory?: boolean;
    compression?: boolean;
    encryption?: EncryptionConfig;
    destination?: string;
}
export interface BackupResult {
    success: boolean;
    backupPath: string;
    size: number;
    duration: number;
    checksum: string;
    metadata: BackupMetadata;
}
export interface BackupMetadata {
    version: string;
    timestamp: Date;
    mvpVersion: string;
    schemaVersion: number;
    entryCount: number;
    compression: boolean;
    encryption: boolean;
}
export interface RestoreOptions {
    validateChecksum?: boolean;
    overwriteExisting?: boolean;
    restoreToDate?: Date;
}
export interface RestoreResult {
    success: boolean;
    restoredEntries: number;
    skippedEntries: number;
    errors: string[];
    duration: number;
    metadata: RestoreMetadata;
}
export interface RestoreMetadata {
    sourceVersion: string;
    targetVersion: string;
    dataIntegrityCheck: boolean;
    migrationRequired: boolean;
}
export type ExportFormat = 'json' | 'csv' | 'xml' | 'parquet' | 'analytics';
export type ImportFormat = 'json' | 'csv' | 'xml' | 'servicenow' | 'jira' | 'cobol' | 'idz_project';
export interface ExportOptions {
    includeMetrics?: boolean;
    includeHistory?: boolean;
    compression?: boolean;
    encryption?: EncryptionConfig;
    filter?: ExportFilter;
}
export interface ExportFilter {
    mvpVersion?: string;
    dateRange?: {
        start: Date;
        end: Date;
    };
    categories?: string[];
    tags?: string[];
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
export interface ImportResult {
    success: boolean;
    imported: number;
    updated: number;
    skipped: number;
    errors: ImportError[];
    warnings: ImportWarning[];
    duration: number;
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
export interface MigrationResult {
    phase: string;
    success: boolean;
    duration: number;
    recordsProcessed?: number;
    error?: string;
}
export interface StorageMetrics {
    database: DatabaseMetrics;
    performance: PerformanceMetrics;
    usage: UsageMetrics;
    cache: CacheMetrics;
    backup: BackupMetrics;
}
export interface DatabaseMetrics {
    size: number;
    tableCount: number;
    indexCount: number;
    connectionCount: number;
    queryCount: number;
    averageQueryTime: number;
}
export interface PerformanceMetrics {
    responseTime: {
        p50: number;
        p95: number;
        p99: number;
    };
    throughput: {
        reads: number;
        writes: number;
        searches: number;
    };
    errors: {
        count: number;
        rate: number;
    };
}
export interface UsageMetrics {
    totalOperations: number;
    operationsByType: Record<string, number>;
    activeUsers: number;
    dataGrowth: {
        entries: number;
        size: number;
    };
}
export interface CacheMetrics {
    hitRate: number;
    missRate: number;
    size: number;
    evictions: number;
    averageResponseTime: number;
}
export interface BackupMetrics {
    lastBackupTime: Date;
    backupCount: number;
    totalBackupSize: number;
    averageBackupDuration: number;
    successRate: number;
}
export interface OptimizationResult {
    success: boolean;
    optimizations: OptimizationItem[];
    performanceImprovement: number;
    duration: number;
}
export interface OptimizationItem {
    type: 'index' | 'vacuum' | 'analyze' | 'config';
    description: string;
    impact: 'low' | 'medium' | 'high';
    executed: boolean;
    error?: string;
}
export interface HealthStatus {
    overall: 'healthy' | 'warning' | 'critical';
    components: ComponentHealth[];
    issues: HealthIssue[];
    recommendations: string[];
}
export interface ComponentHealth {
    name: string;
    status: 'healthy' | 'warning' | 'critical';
    uptime: number;
    lastCheck: Date;
    metrics: Record<string, number>;
}
export interface HealthIssue {
    severity: 'warning' | 'critical';
    component: string;
    message: string;
    details?: any;
    recommendations: string[];
}
export interface IStoragePlugin {
    name: string;
    version: string;
    mvp: number;
    dependencies: string[];
    initialize(storage: IStorageService, config: any): Promise<void>;
    start(): Promise<void>;
    stop(): Promise<void>;
    getSchemaExtensions(): SchemaExtension[];
    getMigrations(): Migration[];
    getDataOperations(): DataOperation[];
    getQueryExtensions(): QueryExtension[];
    getEventHandlers(): EventHandler[];
}
export interface SchemaExtension {
    table: string;
    schema: string;
    indexes?: string[];
    triggers?: string[];
}
export interface Migration {
    version: string;
    description: string;
    up: string;
    down: string;
}
export interface DataOperation {
    name: string;
    handler: Function;
    validation?: Function;
}
export interface QueryExtension {
    name: string;
    query: string;
    parameters?: string[];
}
export interface EventHandler {
    event: string;
    handler: Function;
    priority?: number;
}
export interface StorageEvents {
    'storage:initialized': (config: StorageConfig) => void;
    'storage:closed': () => void;
    'entry:created': (entry: KBEntry) => void;
    'entry:updated': (id: string, updates: KBEntryUpdate) => void;
    'entry:deleted': (id: string) => void;
    'search:performed': (query: string, results: SearchResult[]) => void;
    'pattern:detected': (pattern: Pattern) => void;
    'incident:created': (incident: Incident) => void;
    'code:analyzed': (analysis: CodeAnalysis) => void;
    'template:generated': (template: CodeTemplate) => void;
    'prediction:made': (prediction: Prediction) => void;
    'backup:completed': (result: BackupResult) => void;
    'migration:completed': (results: MigrationResult[]) => void;
    'optimization:completed': (result: OptimizationResult) => void;
    'health:warning': (issue: HealthIssue) => void;
    'health:critical': (issue: HealthIssue) => void;
    'plugin:loaded': (plugin: string) => void;
    'plugin:unloaded': (plugin: string) => void;
    'plugin:error': (plugin: string, error: Error) => void;
    'performance:degraded': (metric: string, value: number) => void;
    'cache:miss': (key: string) => void;
    'query:slow': (query: string, duration: number) => void;
}
//# sourceMappingURL=IStorageService.d.ts.map