import { KBEntry } from '../../types';
import { PostingList, IndexedDocument } from './InvertedIndex';
import { ParsedQuery, QueryTerm } from './QueryParser';
export interface RankingScore {
  docId: string;
  score: number;
  components: ScoreComponent[];
  explanation: string;
  boosted: boolean;
  algorithm: RankingAlgorithm;
}
export interface ScoreComponent {
  factor: string;
  value: number;
  weight: number;
  contribution: number;
  explanation: string;
}
export type RankingAlgorithm = 'tfidf' | 'bm25' | 'combined' | 'custom';
export interface RankingOptions {
  algorithm: RankingAlgorithm;
  fieldBoosts: Record<string, number>;
  documentBoosts: Record<string, number>;
  freshness: {
    enabled: boolean;
    halfLife: number;
    maxBoost: number;
  };
  popularity: {
    enabled: boolean;
    usageWeight: number;
    successWeight: number;
  };
  bm25: BM25Parameters;
  tfidf: TFIDFParameters;
  combination: CombinationWeights;
}
export interface BM25Parameters {
  k1: number;
  b: number;
  k2: number;
  k3: number;
}
export interface TFIDFParameters {
  useLogTF: boolean;
  useLogIDF: boolean;
  normalization: 'cosine' | 'pivoted' | 'none';
  pivotSlope: number;
}
export interface CombinationWeights {
  tfidf: number;
  bm25: number;
  popularity: number;
  freshness: number;
  fieldMatch: number;
  exactMatch: number;
}
export interface DocumentCollection {
  documents: Map<string, IndexedDocument>;
  totalDocuments: number;
  averageDocumentLength: number;
  fieldAverageLength: Record<string, number>;
}
export declare class RankingEngine {
  private defaultOptions;
  private scoreCache;
  private stats;
  constructor();
  rankDocuments(
    query: ParsedQuery,
    postingLists: Map<string, PostingList>,
    collection: DocumentCollection,
    options?: Partial<RankingOptions>
  ): RankingScore[];
  calculateBM25(
    queryTerms: QueryTerm[],
    docId: string,
    doc: IndexedDocument,
    postingLists: Map<string, PostingList>,
    collection: DocumentCollection,
    params?: BM25Parameters
  ): number;
  calculateTFIDF(
    queryTerms: QueryTerm[],
    docId: string,
    doc: IndexedDocument,
    postingLists: Map<string, PostingList>,
    collection: DocumentCollection,
    params?: TFIDFParameters
  ): number;
  calculatePopularityScore(entry: KBEntry, options: RankingOptions['popularity']): number;
  calculateFreshnessScore(entry: KBEntry, options: RankingOptions['freshness']): number;
  explainScore(score: RankingScore): string;
  getStats(): {
    cacheSize: number;
    cacheHitRate: number;
    rankingsCalculated: number;
    cacheHits: number;
    averageRankingTime: number;
    totalRankingTime: number;
  };
  clearCache(): void;
  private calculateScore;
  private calculateCustomScore;
  private calculateFieldMatchBonus;
  private calculateExactMatchBonus;
  private getCandidateDocuments;
  private isErrorCode;
  private isSystemName;
  private isMainframeTerm;
  private getCacheKey;
  private cacheScore;
}
export default RankingEngine;
//# sourceMappingURL=RankingEngine.d.ts.map
