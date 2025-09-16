import { EventEmitter } from 'events';
export interface QueryAnalysis {
    query: string;
    executionTime: number;
    timestamp: number;
    tablesAccessed: string[];
    indexesUsed: string[];
    rowsExamined: number;
    rowsReturned: number;
    sortOperations: number;
    joinOperations: number;
    filterConditions: string[];
    orderByColumns: string[];
    groupByColumns: string[];
}
export interface IndexSuggestion {
    id: string;
    timestamp: number;
    table: string;
    suggestedIndex: {
        name: string;
        columns: string[];
        type: 'btree' | 'hash' | 'gin' | 'gist' | 'partial' | 'unique' | 'composite';
        unique: boolean;
        partial?: string;
    };
    reason: string;
    impact: 'low' | 'medium' | 'high' | 'critical';
    effort: 'low' | 'medium' | 'high';
    estimatedImprovement: number;
    affectedQueries: string[];
    cost: {
        diskSpace: number;
        maintenanceOverhead: number;
        creationTime: number;
    };
    benefits: {
        querySpeedup: number;
        concurrencyImprovement: boolean;
        lockReduction: boolean;
    };
}
export interface IndexStats {
    name: string;
    table: string;
    columns: string[];
    size: number;
    usage: {
        scans: number;
        seeks: number;
        lookups: number;
        updates: number;
    };
    efficiency: number;
    lastUsed: number;
    fragmentationLevel: number;
}
export interface TableStats {
    name: string;
    rowCount: number;
    dataSize: number;
    indexSize: number;
    avgRowSize: number;
    hotColumns: string[];
    slowQueries: QueryAnalysis[];
    indexUtilization: Map<string, number>;
}
export declare class IndexOptimizationAdvisor extends EventEmitter {
    private queryHistory;
    private indexStats;
    private tableStats;
    private suggestions;
    private optimizationRules;
    constructor();
    initialize(): Promise<void>;
    recordQuery(query: QueryAnalysis): void;
    analyzeIndexes(): Promise<any[]>;
    getOptimizationRecommendations(metrics: any[]): Promise<IndexSuggestion[]>;
    applyOptimization(recommendation: any): Promise<boolean>;
    private initializeOptimizationRules;
    private analyzeFilterPatterns;
    private analyzeOrderByPatterns;
    private analyzeMultiColumnPatterns;
    private analyzePartialIndexOpportunities;
    private isPartialIndexCandidate;
    private extractColumnsFromCondition;
    private hasIndexForColumns;
    private hasCompositeIndex;
    private calculateFilterImpact;
    private findQueriesUsingColumns;
    private findQueriesWithOrderBy;
    private estimateIndexSize;
    private identifyUnusedIndexes;
    private identifyDuplicateIndexes;
    private identifyFragmentedIndexes;
    private identifyOversizedIndexes;
    private calculateIndexUtilization;
    private identifyMissingIndexes;
    private updateTableStatistics;
    private analyzeQueryForOptimization;
    private deduplicateRecommendations;
    private prioritizeRecommendations;
    private simulateIndexCreation;
    private recordAppliedOptimization;
    private createIndexAnalysisMetric;
    private loadDatabaseStatistics;
    private analyzeExistingIndexes;
    destroy(): Promise<void>;
}
export default IndexOptimizationAdvisor;
//# sourceMappingURL=IndexOptimizationAdvisor.d.ts.map