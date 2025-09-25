import { EventEmitter } from 'events';
import {
  IKnowledgeBaseService,
  IValidationService,
  ISearchService,
  ICacheService,
  IMetricsService,
  IImportExportService,
  ServiceConfig,
  KBEntry,
  KBEntryInput,
  KBEntryUpdate,
  SearchResult,
  SearchOptions,
  ListOptions,
  PaginatedResult,
  KBMetrics,
  ExportOptions,
  ImportOptions,
  ImportResult,
  RestoreResult,
} from '../types/services';
export declare class KnowledgeBaseService extends EventEmitter implements IKnowledgeBaseService {
  private config;
  private validationService?;
  private searchService?;
  private cacheService?;
  private metricsService?;
  private importExportService?;
  private db;
  private isInitialized;
  private transactions;
  private startTime;
  private statements;
  constructor(
    config?: ServiceConfig,
    validationService?: IValidationService | undefined,
    searchService?: ISearchService | undefined,
    cacheService?: ICacheService | undefined,
    metricsService?: IMetricsService | undefined,
    importExportService?: IImportExportService | undefined
  );
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
  private ensureInitialized;
  private initializeDatabase;
  private createSchema;
  private prepareStatements;
  private initializeDependentServices;
  private setupPeriodicTasks;
  private mapDBEntryToKBEntry;
  private updateFTSIndex;
  private getAllEntriesForSearch;
}
export default KnowledgeBaseService;
//# sourceMappingURL=KnowledgeBaseService.d.ts.map
