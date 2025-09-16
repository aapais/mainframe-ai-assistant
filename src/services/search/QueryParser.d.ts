import TextProcessor from './TextProcessor';
export interface ParsedQuery {
    type: QueryType;
    terms: QueryTerm[];
    filters: QueryFilter[];
    options: QueryOptions;
    original: string;
    normalized: string;
}
export type QueryType = 'simple' | 'boolean' | 'phrase' | 'field' | 'mixed';
export interface QueryTerm {
    text: string;
    field?: string;
    operator: QueryOperator;
    boost: number;
    fuzzy: boolean;
    proximity?: number;
    required: boolean;
    prohibited: boolean;
}
export type QueryOperator = 'AND' | 'OR' | 'NOT' | 'PHRASE';
export interface QueryFilter {
    field: string;
    value: string | string[];
    operator: FilterOperator;
}
export type FilterOperator = 'equals' | 'contains' | 'in' | 'range' | 'exists';
export interface QueryOptions {
    fuzzyDistance: number;
    phraseSlop: number;
    minimumShouldMatch: number;
    boost: Record<string, number>;
    defaultField: string;
    defaultOperator: QueryOperator;
}
export declare class QueryParser {
    private textProcessor;
    private defaultOptions;
    private tokens;
    private position;
    private current;
    constructor(textProcessor?: TextProcessor);
    parse(queryString: string, options?: Partial<QueryOptions>): ParsedQuery;
    extractSearchTerms(parsedQuery: ParsedQuery): {
        required: string[];
        optional: string[];
        prohibited: string[];
        phrases: string[];
    };
    parseFieldQuery(queryString: string): Record<string, string[]>;
    validate(queryString: string): {
        valid: boolean;
        errors: string[];
        warnings: string[];
    };
    suggest(partialQuery: string, availableFields?: string[]): string[];
    private parseExpression;
    private parseTerm;
    private parseOperatorTerm;
    private parseFieldTerm;
    private parsePhraseTerm;
    private parseFuzzyTerm;
    private parseBoostedTerm;
    private parseWildcardTerm;
    private parseRegularTerm;
    private normalizeQuery;
    private tokenizeQuery;
    private advance;
    private isOperator;
    private normalizeOperator;
    private extractFilters;
    private determineQueryType;
    private createEmptyQuery;
}
export default QueryParser;
//# sourceMappingURL=QueryParser.d.ts.map