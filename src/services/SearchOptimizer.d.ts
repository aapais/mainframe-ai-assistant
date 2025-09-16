import { EventEmitter } from 'events';
import { SearchResult, SearchOptions, KBEntry } from '../types/services';
export interface QueryOptimization {
    originalQuery: string;
    optimizedQuery: string;
    optimizationType: 'rewrite' | 'expand' | 'focus' | 'parallel';
    confidence: number;
    estimatedImprovement: number;
    reasoning: string[];
}
export interface SearchStrategy {
    name: string;
    priority: number;
    estimatedTime: number;
    confidence: number;
    execute: (query: string, entries: KBEntry[], options: SearchOptions) => Promise<SearchResult[]>;
}
export interface OptimizationMetrics {
    totalOptimizations: number;
    averageImprovement: number;
    successRate: number;
    topStrategies: {
        name: string;
        usage: number;
        avgTime: number;
        successRate: number;
    }[];
    performanceBottlenecks: string[];
}
export declare class SearchOptimizer extends EventEmitter {
    private queryCache;
    private strategyMetrics;
    private optimizationHistory;
    private performanceThresholds;
    constructor();
    optimizeSearch(query: string, entries: KBEntry[], options: SearchOptions | undefined, searchMethods: Map<string, (query: string, entries: KBEntry[], options: SearchOptions) => Promise<SearchResult[]>>): Promise<SearchResult[]>;
    optimizeQuery(query: string, options: SearchOptions): Promise<QueryOptimization>;
    private selectStrategies;
    private executeParallelStrategies;
    private optimizeResults;
    private analyzeAndOptimizeQuery;
    private detectQueryIntent;
    private assessQueryComplexity;
    private extractEntities;
    private identifyPatterns;
    private detectImplicitCategory;
    private applySpellCorrection;
    private expandQuery;
    private focusQuery;
    private standardizeTechnicalTerms;
    private mergeStrategyResults;
    private recordStrategyPerformance;
    private recordOptimization;
    private calculateActualImprovement;
    private calculateSemanticAlignment;
    private calculateHistoricalPerformance;
    private calculateContextRelevance;
    private calculateDiversityPenalty;
    private calculateRankingConfidence;
    private cacheOptimization;
    private calculateOptimizationConfidence;
    private estimateImprovement;
    private fallbackSearch;
    private initializeOptimizer;
    private cleanupCache;
    getMetrics(): OptimizationMetrics;
    private identifyBottlenecks;
}
export default SearchOptimizer;
//# sourceMappingURL=SearchOptimizer.d.ts.map