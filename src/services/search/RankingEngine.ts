/**
 * Advanced Ranking Engine with TF-IDF and BM25 Algorithms
 * Optimized for mainframe knowledge base search relevance
 */

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
    halfLife: number; // days
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
  k1: number; // Term frequency saturation parameter
  b: number;  // Field length normalization parameter
  k2: number; // Query frequency saturation parameter
  k3: number; // Document frequency boost parameter
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

/**
 * High-performance ranking engine with multiple algorithms
 * Features:
 * - TF-IDF with multiple normalization options
 * - BM25 with configurable parameters
 * - Field-specific boosting
 * - Popularity and freshness signals
 * - Query-document matching analysis
 * - Detailed score explanation
 * - Performance optimizations
 */
export class RankingEngine {
  private defaultOptions: RankingOptions;
  private scoreCache = new Map<string, Map<string, RankingScore>>();
  
  // Performance statistics
  private stats = {
    rankingsCalculated: 0,
    cacheHits: 0,
    averageRankingTime: 0,
    totalRankingTime: 0
  };

  constructor() {
    this.defaultOptions = {
      algorithm: 'bm25',
      fieldBoosts: {
        title: 3.0,
        problem: 2.0,
        solution: 1.8,
        tags: 1.5,
        category: 1.2,
        content: 1.0
      },
      documentBoosts: {},
      freshness: {
        enabled: true,
        halfLife: 30, // 30 days
        maxBoost: 1.5
      },
      popularity: {
        enabled: true,
        usageWeight: 0.3,
        successWeight: 0.7
      },
      bm25: {
        k1: 1.5,  // Slightly higher for technical content
        b: 0.75,  // Standard field length normalization
        k2: 100,  // Query frequency saturation
        k3: 8     // Document frequency boost
      },
      tfidf: {
        useLogTF: true,
        useLogIDF: true,
        normalization: 'cosine',
        pivotSlope: 0.2
      },
      combination: {
        tfidf: 0.3,
        bm25: 0.4,
        popularity: 0.15,
        freshness: 0.05,
        fieldMatch: 0.05,
        exactMatch: 0.05
      }
    };
  }

  /**
   * Rank documents based on query relevance
   */
  rankDocuments(
    query: ParsedQuery,
    postingLists: Map<string, PostingList>,
    collection: DocumentCollection,
    options?: Partial<RankingOptions>
  ): RankingScore[] {
    const startTime = Date.now();
    const opts = { ...this.defaultOptions, ...options };
    
    if (query.terms.length === 0 || postingLists.size === 0) {
      return [];
    }

    // Get all candidate documents
    const candidates = this.getCandidateDocuments(postingLists);
    const scores: RankingScore[] = [];

    // Calculate scores for each candidate
    for (const docId of candidates) {
      const doc = collection.documents.get(docId);
      if (!doc) continue;

      // Check cache first
      const cacheKey = this.getCacheKey(query, docId, opts);
      const cached = this.scoreCache.get(cacheKey);
      
      if (cached) {
        scores.push(cached.get(docId)!);
        this.stats.cacheHits++;
        continue;
      }

      // Calculate score
      const score = this.calculateScore(query, docId, doc, postingLists, collection, opts);
      scores.push(score);

      // Cache the result
      this.cacheScore(cacheKey, docId, score);
    }

    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);

    // Update statistics
    const rankingTime = Date.now() - startTime;
    this.stats.rankingsCalculated++;
    this.stats.totalRankingTime += rankingTime;
    this.stats.averageRankingTime = this.stats.totalRankingTime / this.stats.rankingsCalculated;

    return scores;
  }

  /**
   * Calculate BM25 score for a document
   */
  calculateBM25(
    queryTerms: QueryTerm[],
    docId: string,
    doc: IndexedDocument,
    postingLists: Map<string, PostingList>,
    collection: DocumentCollection,
    params: BM25Parameters = this.defaultOptions.bm25
  ): number {
    let score = 0;
    const { k1, b, k2, k3 } = params;
    const { totalDocuments, averageDocumentLength } = collection;

    for (const queryTerm of queryTerms) {
      const postingList = postingLists.get(queryTerm.text);
      if (!postingList) continue;

      const posting = postingList.documents.get(docId);
      if (!posting) continue;

      // Term frequency in document
      const tf = posting.termFrequency;
      
      // Document frequency
      const df = postingList.documents.size;
      
      // Inverse document frequency
      const idf = Math.log((totalDocuments - df + 0.5) / (df + 0.5));
      
      // Document length normalization
      const docLength = doc.totalTerms;
      const normalizedTF = tf / (tf + k1 * (1 - b + b * (docLength / averageDocumentLength)));
      
      // Query term frequency (simplified - assuming 1)
      const qtf = 1;
      const normalizedQTF = qtf / (qtf + k2);
      
      // Term score
      const termScore = idf * normalizedTF * normalizedQTF * (k3 + 1);
      
      // Apply field boosting
      const fieldBoost = posting.boost || 1.0;
      score += termScore * fieldBoost * queryTerm.boost;
    }

    return Math.max(0, score);
  }

  /**
   * Calculate TF-IDF score for a document
   */
  calculateTFIDF(
    queryTerms: QueryTerm[],
    docId: string,
    doc: IndexedDocument,
    postingLists: Map<string, PostingList>,
    collection: DocumentCollection,
    params: TFIDFParameters = this.defaultOptions.tfidf
  ): number {
    let score = 0;
    const { totalDocuments } = collection;
    let docVector = 0; // For cosine normalization

    for (const queryTerm of queryTerms) {
      const postingList = postingLists.get(queryTerm.text);
      if (!postingList) continue;

      const posting = postingList.documents.get(docId);
      if (!posting) continue;

      // Term frequency
      const rawTF = posting.termFrequency;
      const tf = params.useLogTF ? Math.log(1 + rawTF) : rawTF;
      
      // Inverse document frequency
      const df = postingList.documents.size;
      const rawIDF = totalDocuments / df;
      const idf = params.useLogIDF ? Math.log(rawIDF) : rawIDF;
      
      // TF-IDF weight
      const weight = tf * idf;
      
      // Apply field boosting
      const fieldBoost = posting.boost || 1.0;
      const termScore = weight * fieldBoost * queryTerm.boost;
      
      score += termScore;
      
      // For cosine normalization
      if (params.normalization === 'cosine') {
        docVector += weight * weight;
      }
    }

    // Apply normalization
    if (params.normalization === 'cosine' && docVector > 0) {
      score = score / Math.sqrt(docVector);
    } else if (params.normalization === 'pivoted') {
      const docLength = doc.totalTerms;
      const avgLength = collection.averageDocumentLength;
      const pivot = (1 - params.pivotSlope) + params.pivotSlope * (docLength / avgLength);
      score = score / pivot;
    }

    return Math.max(0, score);
  }

  /**
   * Calculate popularity score based on usage metrics
   */
  calculatePopularityScore(
    entry: KBEntry,
    options: RankingOptions['popularity']
  ): number {
    if (!options.enabled) return 0;

    const usageCount = entry.usage_count || 0;
    const successCount = entry.success_count || 0;
    const failureCount = entry.failure_count || 0;
    
    // Usage score (logarithmic to prevent dominance)
    const usageScore = usageCount > 0 ? Math.log(1 + usageCount) / Math.log(1 + 100) : 0;
    
    // Success rate score
    const totalRatings = successCount + failureCount;
    const successRate = totalRatings > 0 ? successCount / totalRatings : 0.5;
    
    return (usageScore * options.usageWeight + successRate * options.successWeight);
  }

  /**
   * Calculate freshness score based on document age
   */
  calculateFreshnessScore(
    entry: KBEntry,
    options: RankingOptions['freshness']
  ): number {
    if (!options.enabled) return 0;

    const now = Date.now();
    const created = entry.created_at?.getTime() || now;
    const updated = entry.updated_at?.getTime() || created;
    const mostRecent = Math.max(created, updated);
    
    // Age in days
    const ageInDays = (now - mostRecent) / (1000 * 60 * 60 * 24);
    
    // Exponential decay based on half-life
    const decayFactor = Math.pow(0.5, ageInDays / options.halfLife);
    
    return Math.min(options.maxBoost, 1 + decayFactor);
  }

  /**
   * Get detailed score explanation
   */
  explainScore(score: RankingScore): string {
    const explanations: string[] = [];
    
    explanations.push(`Overall Score: ${score.score.toFixed(3)} (${score.algorithm})`);
    
    for (const component of score.components) {
      const contribution = (component.contribution * 100).toFixed(1);
      explanations.push(
        `- ${component.factor}: ${component.value.toFixed(3)} × ${component.weight.toFixed(2)} = ${contribution}% (${component.explanation})`
      );
    }
    
    if (score.boosted) {
      explanations.push('- Applied field and popularity boosting');
    }
    
    return explanations.join('\n');
  }

  /**
   * Get ranking statistics
   */
  getStats() {
    return {
      ...this.stats,
      cacheSize: this.scoreCache.size,
      cacheHitRate: this.stats.rankingsCalculated > 0 
        ? this.stats.cacheHits / this.stats.rankingsCalculated 
        : 0
    };
  }

  /**
   * Clear caches to free memory
   */
  clearCache(): void {
    this.scoreCache.clear();
  }

  // =========================
  // Private Implementation
  // =========================

  private calculateScore(
    query: ParsedQuery,
    docId: string,
    doc: IndexedDocument,
    postingLists: Map<string, PostingList>,
    collection: DocumentCollection,
    options: RankingOptions
  ): RankingScore {
    const components: ScoreComponent[] = [];
    let totalScore = 0;

    // Base relevance score
    let relevanceScore = 0;
    
    switch (options.algorithm) {
      case 'tfidf':
        relevanceScore = this.calculateTFIDF(query.terms, docId, doc, postingLists, collection, options.tfidf);
        break;
      case 'bm25':
        relevanceScore = this.calculateBM25(query.terms, docId, doc, postingLists, collection, options.bm25);
        break;
      case 'combined':
        const tfidfScore = this.calculateTFIDF(query.terms, docId, doc, postingLists, collection, options.tfidf);
        const bm25Score = this.calculateBM25(query.terms, docId, doc, postingLists, collection, options.bm25);
        relevanceScore = tfidfScore * options.combination.tfidf + bm25Score * options.combination.bm25;
        break;
      case 'custom':
        relevanceScore = this.calculateCustomScore(query, docId, doc, postingLists, collection);
        break;
    }

    components.push({
      factor: 'relevance',
      value: relevanceScore,
      weight: 1.0,
      contribution: relevanceScore,
      explanation: `${options.algorithm.toUpperCase()} base relevance score`
    });

    totalScore += relevanceScore;

    // Field matching bonus
    const fieldMatchScore = this.calculateFieldMatchBonus(query, doc, postingLists);
    if (fieldMatchScore > 0) {
      const contribution = fieldMatchScore * options.combination.fieldMatch;
      components.push({
        factor: 'field_match',
        value: fieldMatchScore,
        weight: options.combination.fieldMatch,
        contribution,
        explanation: 'Bonus for matching important fields'
      });
      totalScore += contribution;
    }

    // Exact match bonus
    const exactMatchScore = this.calculateExactMatchBonus(query, doc);
    if (exactMatchScore > 0) {
      const contribution = exactMatchScore * options.combination.exactMatch;
      components.push({
        factor: 'exact_match',
        value: exactMatchScore,
        weight: options.combination.exactMatch,
        contribution,
        explanation: 'Bonus for exact phrase matches'
      });
      totalScore += contribution;
    }

    return {
      docId,
      score: Math.max(0, totalScore),
      components,
      explanation: '',
      boosted: fieldMatchScore > 0 || exactMatchScore > 0,
      algorithm: options.algorithm
    };
  }

  private calculateCustomScore(
    query: ParsedQuery,
    docId: string,
    doc: IndexedDocument,
    postingLists: Map<string, PostingList>,
    collection: DocumentCollection
  ): number {
    // Custom mainframe-specific scoring logic
    let score = 0;
    
    // Weight error codes and system names higher
    for (const queryTerm of query.terms) {
      const postingList = postingLists.get(queryTerm.text);
      if (!postingList) continue;

      const posting = postingList.documents.get(docId);
      if (!posting) continue;

      let termWeight = 1.0;
      
      // Boost error codes
      if (this.isErrorCode(queryTerm.text)) {
        termWeight *= 3.0;
      }
      
      // Boost system names
      if (this.isSystemName(queryTerm.text)) {
        termWeight *= 2.0;
      }
      
      // Boost mainframe-specific terms
      if (this.isMainframeTerm(queryTerm.text)) {
        termWeight *= 1.5;
      }
      
      score += posting.termFrequency * termWeight * posting.boost;
    }
    
    return score;
  }

  private calculateFieldMatchBonus(
    query: ParsedQuery,
    doc: IndexedDocument,
    postingLists: Map<string, PostingList>
  ): number {
    let bonus = 0;
    
    // Bonus for matches in high-value fields
    for (const queryTerm of query.terms) {
      const postingList = postingLists.get(queryTerm.text);
      if (!postingList) continue;

      const posting = postingList.documents.get(doc.id);
      if (!posting) continue;

      // Check which fields contain the term
      for (const field of posting.fields) {
        if (field === 'title') bonus += 2.0;
        else if (field === 'problem') bonus += 1.5;
        else if (field === 'tags') bonus += 1.2;
      }
    }
    
    return bonus;
  }

  private calculateExactMatchBonus(query: ParsedQuery, doc: IndexedDocument): number {
    // Simplified exact match detection
    const phraseTerms = query.terms.filter(t => t.operator === 'PHRASE');
    return phraseTerms.length * 2.0; // Bonus per phrase match
  }

  private getCandidateDocuments(postingLists: Map<string, PostingList>): Set<string> {
    const candidates = new Set<string>();
    
    for (const postingList of postingLists.values()) {
      for (const docId of postingList.documents.keys()) {
        candidates.add(docId);
      }
    }
    
    return candidates;
  }

  private isErrorCode(term: string): boolean {
    const errorPatterns = [
      /^S0C[0-9A-F]$/i,
      /^U\d{4}$/i,
      /^IEF\d{3}[A-Z]$/i,
      /^SQLCODE-?\d+$/i,
      /^STATUS\d+$/i
    ];
    
    return errorPatterns.some(pattern => pattern.test(term));
  }

  private isSystemName(term: string): boolean {
    const systemNames = /^(MVS|CICS|DB2|IMS|VSAM|JCL|COBOL|TSO|ISPF|RACF|SDSF|DFSORT)$/i;
    return systemNames.test(term);
  }

  private isMainframeTerm(term: string): boolean {
    const mainframeTerms = [
      'abend', 'dataset', 'jcl', 'vsam', 'cics', 'db2', 'ims', 'cobol',
      'tso', 'ispf', 'sdsf', 'racf', 'sort', 'copy', 'proc', 'parm',
      'region', 'space', 'unit', 'disp', 'cond', 'step', 'exec'
    ];
    
    return mainframeTerms.includes(term.toLowerCase());
  }

  private getCacheKey(query: ParsedQuery, docId: string, options: RankingOptions): string {
    const termText = query.terms.map(t => t.text).sort().join(',');
    return `${termText}_${options.algorithm}_${docId}`;
  }

  private cacheScore(cacheKey: string, docId: string, score: RankingScore): void {
    if (!this.scoreCache.has(cacheKey)) {
      this.scoreCache.set(cacheKey, new Map());
    }
    
    const docCache = this.scoreCache.get(cacheKey)!;
    if (docCache.size < 100) { // Limit cache size
      docCache.set(docId, score);
    }
  }
}

export default RankingEngine;