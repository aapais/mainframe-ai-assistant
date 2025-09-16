import Database from 'better-sqlite3';
import { SearchResult, SearchOptions } from '../types/services';
export interface FTS5SearchOptions extends SearchOptions {
    enableSnippets?: boolean;
    snippetLength?: number;
    highlightTags?: {
        start: string;
        end: string;
    };
    rankingProfile?: 'balanced' | 'precision' | 'recall' | 'mainframe_focused';
    enableSpellCorrection?: boolean;
    proximityBoost?: boolean;
}
export interface SearchSnippet {
    field: 'title' | 'problem' | 'solution';
    text: string;
    highlights: Array<{
        start: number;
        end: number;
        term: string;
    }>;
    score: number;
}
export interface EnhancedSearchResult extends SearchResult {
    snippets?: SearchSnippet[];
    explanation?: string;
    debugInfo?: {
        ftsScore: number;
        rankingProfile: string;
        matchedTerms: string[];
        queryTime: number;
    };
}
export declare class FTS5EnhancedSearch {
    private db;
    private tokenizer;
    private termWeights;
    private queryCache;
    private readonly CACHE_TTL;
    constructor(database: Database.Database);
    private initializeEnhancedFTS5;
    private rebuildFTS5Index;
    search(query: string, options?: FTS5SearchOptions): Promise<EnhancedSearchResult[]>;
    private executeEnhancedSearch;
    private addSnippets;
    private generateSnippet;
    private findBestSnippetStart;
    private getRankingWeights;
    private buildTermWeightBoost;
    private extractMatchedTerms;
    private generateExplanation;
    private generateCacheKey;
    private cleanCache;
    getStatistics(): {
        indexSize: number;
        cacheSize: number;
        totalQueries: number;
        averageQueryTime: number;
    };
    optimize(): void;
    clearCache(): void;
}
export declare function createEnhancedFTS5Search(database: Database.Database): FTS5EnhancedSearch;
//# sourceMappingURL=FTS5EnhancedSearch.d.ts.map