export interface TokenInfo {
    text: string;
    position: number;
    field: string;
    stemmed: string;
    normalized: string;
    type: TokenType;
    boost: number;
}
export type TokenType = 'word' | 'number' | 'code' | 'error' | 'compound' | 'acronym';
export interface ProcessingOptions {
    stemming: boolean;
    stopWords: boolean;
    minLength: number;
    maxLength: number;
    preserveCase: boolean;
    numbers: boolean;
    mainframeTerms: boolean;
}
export declare class TextProcessor {
    private stemCache;
    private stopWords;
    private mainframeTerms;
    private errorCodePatterns;
    private stats;
    constructor();
    processText(text: string, field?: string, options?: Partial<ProcessingOptions>): TokenInfo[];
    tokenizeQuery(query: string): string[];
    extractSpecialTerms(text: string): {
        errorCodes: string[];
        mainframeTerms: string[];
        systemNames: string[];
    };
    stem(word: string): string;
    getStats(): {
        cacheSize: number;
        cacheHitRate: number;
        tokensProcessed: number;
        cacheHits: number;
        stemOperations: number;
        processingTime: number;
    };
    reset(): void;
    private preprocessText;
    private tokenize;
    private normalizeToken;
    private determineTokenType;
    private calculateTokenBoost;
    private isStopWord;
    private isErrorCode;
    private isSystemName;
    private shouldSkipStemming;
    private applyPorterRules;
    private measure;
    private containsVowel;
    private initializeStopWords;
    private initializeMainframeTerms;
    private initializeErrorPatterns;
}
export default TextProcessor;
//# sourceMappingURL=TextProcessor.d.ts.map