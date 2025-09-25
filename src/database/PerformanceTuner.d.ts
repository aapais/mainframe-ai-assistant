import Database from 'better-sqlite3';
export interface PerformanceConfig {
  cacheSize: number;
  mmapSize: number;
  journalMode: 'DELETE' | 'TRUNCATE' | 'PERSIST' | 'MEMORY' | 'WAL' | 'OFF';
  synchronous: 'OFF' | 'NORMAL' | 'FULL' | 'EXTRA';
  tempStore: 'DEFAULT' | 'FILE' | 'MEMORY';
  lockingMode: 'NORMAL' | 'EXCLUSIVE';
  autoVacuum: 'NONE' | 'FULL' | 'INCREMENTAL';
}
export declare class PerformanceTuner {
  private db;
  private config;
  constructor(db: Database.Database);
  private getOptimalConfig;
  private applyConfiguration;
  private logConfiguration;
  optimize(): {
    sizeBefore: number;
    sizeAfter: number;
    duration: number;
    operations: string[];
  };
  getPerformanceMetrics(): {
    cacheHitRatio: number;
    pageCount: number;
    pageSize: number;
    databaseSize: number;
    walSize?: number;
    freePages: number;
    indexUsage: Array<{
      name: string;
      used: boolean;
    }>;
  };
  scheduleMaintenace(): void;
  benchmark(): Promise<{
    insertTime: number;
    searchTime: number;
    updateTime: number;
    deleteTime: number;
    ftsSearchTime: number;
  }>;
  private estimateAvailableRAM;
  private isLocalDatabase;
  private getDatabaseSize;
  private formatBytes;
  private checkIndexUsage;
  getRecommendations(): string[];
}
//# sourceMappingURL=PerformanceTuner.d.ts.map
