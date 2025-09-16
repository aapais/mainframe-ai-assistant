export interface MainframeTokenizerConfig {
    preserveErrorCodes: boolean;
    preserveJclSyntax: boolean;
    preserveCobolKeywords: boolean;
    preserveSystemMessages: boolean;
    caseSensitive: boolean;
    stemming: boolean;
}
export interface TokenInfo {
    token: string;
    type: 'error_code' | 'jcl_syntax' | 'cobol_keyword' | 'system_msg' | 'general';
    weight: number;
    position: number;
    stemmed?: string;
}
export declare class FTS5MainframeTokenizer {
    private config;
    private readonly ERROR_CODE_PATTERNS;
    private readonly JCL_SYNTAX_PATTERNS;
    private readonly COBOL_KEYWORDS;
    private readonly SYSTEM_MSG_KEYWORDS;
    private readonly VSAM_KEYWORDS;
    constructor(config?: Partial<MainframeTokenizerConfig>);
    tokenize(text: string): TokenInfo[];
    private extractPreservedTokens;
    private standardTokenize;
    private processStandardToken;
    private applyStemming;
    generateFTS5Query(input: string): string;
    getTokenWeights(): Map<string, number>;
    private escapeRegExp;
    shouldIndex(token: string): boolean;
}
export declare function createMainframeTokenizer(config?: Partial<MainframeTokenizerConfig>): FTS5MainframeTokenizer;
export declare function registerMainframeTokenizer(): string;
//# sourceMappingURL=FTS5MainframeTokenizer.d.ts.map