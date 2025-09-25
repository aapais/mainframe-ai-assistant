import { KBEntry } from '../database/KnowledgeDB';
export interface SimilarityResult {
  entry: KBEntry;
  similarity: number;
  scores: {
    title: number;
    problem: number;
    solution: number;
    tags: number;
    category: number;
    semantic?: number;
  };
  matchType: 'exact' | 'high' | 'medium' | 'low';
  matchedFields: string[];
  confidence: number;
}
export interface DuplicateGroup {
  primary: KBEntry;
  duplicates: KBEntry[];
  averageSimilarity: number;
  mergeStrategy?: 'keep_primary' | 'merge_all' | 'manual_review';
  conflicts: string[];
}
export interface DetectionOptions {
  threshold?: number;
  useAI?: boolean;
  maxComparisons?: number;
  includeFields?: ('title' | 'problem' | 'solution' | 'tags' | 'category')[];
  groupSimilar?: boolean;
  optimizationLevel?: 'fast' | 'balanced' | 'thorough';
}
export interface PerformanceMetrics {
  totalComparisons: number;
  executionTime: number;
  cacheHits: number;
  aiCalls: number;
  memoryUsed: number;
}
export declare class DuplicateDetectionService {
  private cache;
  private performanceMetrics;
  private defaultWeights;
  findSimilar(
    targetEntry: KBEntry,
    allEntries: KBEntry[],
    options?: DetectionOptions
  ): Promise<SimilarityResult[]>;
  detectDuplicateGroups(entries: KBEntry[], options?: DetectionOptions): Promise<DuplicateGroup[]>;
  private calculateSimilarity;
  private calculateSemanticSimilarity;
  private extractTechnicalTerms;
  private classifyMatch;
  private optimizeEntryList;
  private suggestMergeStrategy;
  private identifyConflicts;
  private generateCacheKey;
  getPerformanceMetrics(): PerformanceMetrics;
  clearCache(): void;
  getCacheStats(): {
    size: number;
    hitRate: number;
  };
}
export default DuplicateDetectionService;
//# sourceMappingURL=DuplicateDetectionService.d.ts.map
