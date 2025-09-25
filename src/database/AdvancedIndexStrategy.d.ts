import Database from 'better-sqlite3';
export interface IndexMetrics {
  name: string;
  table: string;
  columns: string[];
  unique: boolean;
  partial: boolean;
  size: number;
  usage: number;
  effectiveness: number;
  recommendations: string[];
}
export interface CoveringIndexConfig {
  name: string;
  table: string;
  keyColumns: string[];
  includedColumns: string[];
  whereClause?: string;
  rationale: string;
}
export declare class AdvancedIndexStrategy {
  private db;
  private indexUsageStats;
  constructor(db: Database.Database);
  private initializeAdvancedIndexes;
  private createCoveringIndex;
  private createCompositeIndexes;
  private createExpressionIndexes;
  private setupUsageTracking;
  private trackIndexUsage;
  analyzeIndexEffectiveness(): IndexMetrics[];
  optimizeForQueryPatterns(): {
    created: string[];
    dropped: string[];
    recommendations: string[];
  };
  createAdaptiveIndexes(): void;
  private createPatternSpecificIndex;
  private analyzeSearchPatterns;
  private identifyUnusedIndexes;
  private getPerformanceRecommendations;
  private estimateIndexSize;
  private calculateIndexEffectiveness;
  private getIndexRecommendations;
  private extractColumnsFromSQL;
  generateMaintenanceReport(): {
    summary: {
      totalIndexes: number;
      usedIndexes: number;
      effectiveness: number;
      recommendations: number;
    };
    details: IndexMetrics[];
    actions: string[];
  };
}
//# sourceMappingURL=AdvancedIndexStrategy.d.ts.map
