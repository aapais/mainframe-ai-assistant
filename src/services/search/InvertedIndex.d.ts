import { KBEntry } from '../../types';
export interface IndexedDocument {
    id: string;
    fieldBoosts: Record<string, number>;
    termFrequencies: Map<string, number>;
    fieldLengths: Record<string, number>;
    totalTerms: number;
    lastModified: number;
}
export interface PostingList {
    term: string;
    frequency: number;
    documents: Map<string, PostingEntry>;
}
export interface PostingEntry {
    docId: string;
    termFrequency: number;
    positions: number[];
    fields: Set<string>;
    boost: number;
}
export interface IndexStats {
    totalDocuments: number;
    totalTerms: number;
    uniqueTerms: number;
    averageDocumentLength: number;
    indexSize: number;
    buildTime: number;
    lastUpdated: number;
}
export declare class InvertedIndex {
    private index;
    private documents;
    private stats;
    private readonly fieldBoosts;
    private readonly maxTermLength;
    private readonly minTermLength;
    private readonly maxPositions;
    constructor();
    buildIndex(entries: KBEntry[]): Promise<void>;
    addDocument(entry: KBEntry): Promise<void>;
    removeDocument(docId: string): Promise<boolean>;
    search(terms: string[]): Map<string, PostingList>;
    getPostingList(term: string): PostingList | null;
    getDocument(docId: string): IndexedDocument | null;
    findTermsWithPrefix(prefix: string, limit?: number): string[];
    getStats(): IndexStats;
    clear(): void;
    export(): any;
    import(data: any): void;
    private processBatch;
    private createIndexedDocument;
    private addTermToIndex;
    private tokenizeText;
    private updateStats;
}
export default InvertedIndex;
//# sourceMappingURL=InvertedIndex.d.ts.map