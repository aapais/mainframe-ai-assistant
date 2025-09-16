import { SearchResult, SearchOptions, KBEntry, GeminiConfig } from '../types/services';
import { SearchService } from './SearchService';
export declare class EnhancedSearchService extends SearchService {
    private fts5Engine?;
    private enhancedSearchMetrics;
    constructor(geminiConfig?: GeminiConfig, database?: any, cacheManager?: any);
    search(query: string, entries: KBEntry[], options?: SearchOptions): Promise<SearchResult[]>;
    private performEnhancedFTS5Search;
    private shouldUseFTS5;
    private selectRankingProfile;
    private convertSnippetsToHighlights;
    private finalizeResults;
    getEnhancedPerformanceMetrics(): {
        fts5Available: boolean;
        fts5SuccessRate: number;
        enhancedFeatures: string[];
        performanceComparison: {
            standardSearch: {
                avg: number;
                p95: number;
            };
            fts5Search: {
                avg: number;
                p95: number;
            };
            improvement: string;
        };
    };
    optimizeFTS5(): Promise<void>;
    clearFTS5Cache(): void;
    getFTS5Statistics(): any;
    private recordEnhancedSearchMetric;
    private recordEnhancedSearch;
    private applyAdvancedRanking;
    private addEnhancedHighlights;
}
export declare function createEnhancedSearchService(geminiConfig?: GeminiConfig, database?: any, cacheManager?: any): EnhancedSearchService;
export default EnhancedSearchService;
//# sourceMappingURL=EnhancedSearchService.d.ts.map