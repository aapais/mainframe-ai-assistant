export interface FuzzyMatch {
  term: string;
  distance: number;
  similarity: number;
  confidence: number;
  algorithm: FuzzyAlgorithm;
  transformations: string[];
}
export type FuzzyAlgorithm =
  | 'levenshtein'
  | 'damerau'
  | 'jaro'
  | 'jaro_winkler'
  | 'soundex'
  | 'metaphone';
export interface FuzzyOptions {
  maxDistance: number;
  minSimilarity: number;
  algorithm: FuzzyAlgorithm[];
  weights: AlgorithmWeights;
  caseInsensitive: boolean;
  skipShortTerms: boolean;
  mainframeSpecific: boolean;
}
export interface AlgorithmWeights {
  levenshtein: number;
  damerau: number;
  jaro: number;
  jaro_winkler: number;
  soundex: number;
  metaphone: number;
}
export declare class FuzzyMatcher {
  private cache;
  private soundexCache;
  private metaphoneCache;
  private similarTerms;
  private defaultOptions;
  constructor();
  findMatches(term: string, vocabulary: string[], options?: Partial<FuzzyOptions>): FuzzyMatch[];
  similarity(term1: string, term2: string, algorithm?: FuzzyAlgorithm): number;
  suggest(term: string, vocabulary: string[], maxSuggestions?: number): string[];
  areVariants(term1: string, term2: string): boolean;
  clearCache(): void;
  getCacheStats(): {
    fuzzyCache: number;
    soundexCache: number;
    metaphoneCache: number;
  };
  private calculateMatch;
  private getEditDistance;
  private levenshteinDistance;
  private damerauLevenshteinDistance;
  private levenshteinSimilarity;
  private damerauSimilarity;
  private jaroSimilarity;
  private jaroWinklerSimilarity;
  private soundexSimilarity;
  private metaphoneSimilarity;
  private getSoundex;
  private calculateSoundex;
  private getMetaphone;
  private calculateMetaphone;
  private isVowel;
  private getTransformations;
  private getCacheKey;
  private cacheResult;
}
export default FuzzyMatcher;
//# sourceMappingURL=FuzzyMatcher.d.ts.map
