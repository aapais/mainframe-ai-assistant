import type { KBEntry, SearchResult } from '../database/KnowledgeDB';
export interface GeminiConfig {
    apiKey: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    timeout?: number;
}
export interface MatchResult {
    entry: KBEntry;
    confidence: number;
    reasoning?: string;
}
export declare class GeminiService {
    private apiKey;
    private model;
    private temperature;
    private maxTokens;
    private client;
    private baseURL;
    constructor(config: GeminiConfig);
    findSimilar(query: string, entries: KBEntry[], limit?: number): Promise<SearchResult[]>;
    explainError(errorCode: string): Promise<string>;
    analyzeEntry(entry: KBEntry): Promise<{
        suggestions: string[];
        clarity: number;
        completeness: number;
    }>;
    generateTags(entry: KBEntry): Promise<string[]>;
    categorizeproblem(problemDescription: string): Promise<{
        category: string;
        confidence: number;
    }>;
    private generateContent;
    private buildSimilarityPrompt;
    private buildErrorExplanationPrompt;
    private buildEntryAnalysisPrompt;
    private buildTagGenerationPrompt;
    private buildCategorizationPrompt;
    private parseSimilarityResponse;
    private parseAnalysisResponse;
    private parseTagsResponse;
    private parseCategorizationResponse;
    private extractTextResponse;
    private fallbackLocalSearch;
    private getFallbackErrorExplanation;
    private fallbackTagGeneration;
    private fallbackCategorization;
    private calculateSuccessRate;
}
//# sourceMappingURL=GeminiService.d.ts.map