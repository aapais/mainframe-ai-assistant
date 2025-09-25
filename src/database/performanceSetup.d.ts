import { KnowledgeDB } from './KnowledgeDB';
import { ConnectionPool } from './ConnectionPool';
import { QueryCache } from './QueryCache';
import { PerformanceManager } from './PerformanceManager';
export interface PerformanceSetupOptions {
  dbPath?: string;
  maxConnections?: number;
  cacheSize?: number;
  enableBenchmarking?: boolean;
  customThresholds?: {
    maxQueryTime?: number;
    minCacheHitRate?: number;
    maxSlowQueryPercent?: number;
  };
}
export declare function setupPerformanceOptimizedDB(options?: PerformanceSetupOptions): Promise<{
  db: KnowledgeDB;
  connectionPool: ConnectionPool;
  cache: QueryCache;
  manager: PerformanceManager;
}>;
export declare function setupDevelopmentDB(): Promise<{
  db: KnowledgeDB;
  connectionPool: ConnectionPool;
  cache: QueryCache;
  manager: PerformanceManager;
}>;
export declare function setupProductionDB(dbPath: string): Promise<{
  db: KnowledgeDB;
  connectionPool: ConnectionPool;
  cache: QueryCache;
  manager: PerformanceManager;
}>;
export declare function validatePerformanceOptimizations(
  db: KnowledgeDB,
  manager: PerformanceManager
): Promise<{
  passed: boolean;
  results: any[];
  recommendations: string[];
}>;
export * from './PerformanceManager';
export { KnowledgeDB } from './KnowledgeDB';
export { ConnectionPool } from './ConnectionPool';
export { QueryCache } from './QueryCache';
export { AdvancedIndexStrategy } from './AdvancedIndexStrategy';
export { SearchOptimizationEngine } from './SearchOptimizationEngine';
export { SearchPerformanceBenchmark } from './SearchPerformanceBenchmark';
//# sourceMappingURL=performanceSetup.d.ts.map
