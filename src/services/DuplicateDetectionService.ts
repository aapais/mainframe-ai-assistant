/**
 * Duplicate Detection Service
 *
 * Advanced duplicate and similarity detection for KB entries using:
 * - Text similarity algorithms (Jaccard, Cosine, Levenshtein)
 * - Semantic similarity via AI (Gemini)
 * - Fuzzy matching for titles and content
 * - Configurable similarity thresholds
 * - Performance optimizations for large datasets
 *
 * @author Swarm Architecture Team
 * @version 1.0.0
 */

import { KBEntry } from '../database/KnowledgeDB';

// ========================
// Types & Interfaces
// ========================

export interface SimilarityResult {
  /** The compared entry */
  entry: KBEntry;
  /** Overall similarity score (0-1) */
  similarity: number;
  /** Individual similarity scores */
  scores: {
    title: number;
    problem: number;
    solution: number;
    tags: number;
    category: number;
    semantic?: number;
  };
  /** Type of similarity match */
  matchType: 'exact' | 'high' | 'medium' | 'low';
  /** Specific fields that matched */
  matchedFields: string[];
  /** Confidence in the match */
  confidence: number;
}

export interface DuplicateGroup {
  /** Primary entry (usually the oldest or most used) */
  primary: KBEntry;
  /** All similar entries in the group */
  duplicates: KBEntry[];
  /** Average similarity score within the group */
  averageSimilarity: number;
  /** Suggested merge strategy */
  mergeStrategy?: 'keep_primary' | 'merge_all' | 'manual_review';
  /** Conflict indicators */
  conflicts: string[];
}

export interface DetectionOptions {
  /** Minimum similarity threshold for detection (0-1) */
  threshold?: number;
  /** Whether to use AI for semantic similarity */
  useAI?: boolean;
  /** Maximum number of comparisons per entry */
  maxComparisons?: number;
  /** Fields to include in similarity calculation */
  includeFields?: ('title' | 'problem' | 'solution' | 'tags' | 'category')[];
  /** Whether to group similar entries */
  groupSimilar?: boolean;
  /** Performance optimization level */
  optimizationLevel?: 'fast' | 'balanced' | 'thorough';
}

export interface PerformanceMetrics {
  /** Total comparisons performed */
  totalComparisons: number;
  /** Time taken in milliseconds */
  executionTime: number;
  /** Cache hits */
  cacheHits: number;
  /** AI API calls made */
  aiCalls: number;
  /** Memory usage in bytes */
  memoryUsed: number;
}

// ========================
// Similarity Algorithms
// ========================

class SimilarityAlgorithms {
  /**
   * Calculate Jaccard similarity between two text strings
   */
  static jaccard(text1: string, text2: string): number {
    const words1 = new Set(
      text1
        .toLowerCase()
        .split(/\s+/)
        .filter(w => w.length > 2)
    );
    const words2 = new Set(
      text2
        .toLowerCase()
        .split(/\s+/)
        .filter(w => w.length > 2)
    );

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return union.size === 0 ? 0 : intersection.size / union.size;
  }

  /**
   * Calculate Cosine similarity between two text strings
   */
  static cosine(text1: string, text2: string): number {
    const words1 = text1
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 2);
    const words2 = text2
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 2);

    // Create vocabulary
    const vocab = new Set([...words1, ...words2]);
    const vocabArray = Array.from(vocab);

    // Create frequency vectors
    const vector1 = vocabArray.map(word => words1.filter(w => w === word).length);
    const vector2 = vocabArray.map(word => words2.filter(w => w === word).length);

    // Calculate dot product and magnitudes
    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;

    for (let i = 0; i < vector1.length; i++) {
      dotProduct += vector1[i] * vector2[i];
      magnitude1 += vector1[i] * vector1[i];
      magnitude2 += vector2[i] * vector2[i];
    }

    const magnitude = Math.sqrt(magnitude1) * Math.sqrt(magnitude2);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  /**
   * Calculate Levenshtein distance ratio
   */
  static levenshtein(text1: string, text2: string): number {
    const len1 = text1.length;
    const len2 = text2.length;

    if (len1 === 0) return len2 === 0 ? 1 : 0;
    if (len2 === 0) return 0;

    const matrix = Array(len2 + 1)
      .fill(null)
      .map(() => Array(len1 + 1).fill(null));

    for (let i = 0; i <= len1; i++) matrix[0][i] = i;
    for (let j = 0; j <= len2; j++) matrix[j][0] = j;

    for (let j = 1; j <= len2; j++) {
      for (let i = 1; i <= len1; i++) {
        const indicator = text1[i - 1] === text2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }

    const maxLen = Math.max(len1, len2);
    return (maxLen - matrix[len2][len1]) / maxLen;
  }

  /**
   * Calculate n-gram similarity
   */
  static ngram(text1: string, text2: string, n: number = 2): number {
    const ngrams1 = this.generateNgrams(text1.toLowerCase(), n);
    const ngrams2 = this.generateNgrams(text2.toLowerCase(), n);

    if (ngrams1.size === 0 && ngrams2.size === 0) return 1;
    if (ngrams1.size === 0 || ngrams2.size === 0) return 0;

    const intersection = new Set([...ngrams1].filter(x => ngrams2.has(x)));
    const union = new Set([...ngrams1, ...ngrams2]);

    return intersection.size / union.size;
  }

  private static generateNgrams(text: string, n: number): Set<string> {
    const ngrams = new Set<string>();
    const cleaned = text
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    for (let i = 0; i <= cleaned.length - n; i++) {
      ngrams.add(cleaned.substring(i, i + n));
    }

    return ngrams;
  }

  /**
   * Calculate weighted similarity score
   */
  static weighted(
    similarities: { [key: string]: number },
    weights: { [key: string]: number }
  ): number {
    let weightedSum = 0;
    let totalWeight = 0;

    for (const [field, similarity] of Object.entries(similarities)) {
      const weight = weights[field] || 1;
      weightedSum += similarity * weight;
      totalWeight += weight;
    }

    return totalWeight === 0 ? 0 : weightedSum / totalWeight;
  }
}

// ========================
// Main Service Class
// ========================

export class DuplicateDetectionService {
  private cache = new Map<string, SimilarityResult[]>();
  private performanceMetrics: PerformanceMetrics = {
    totalComparisons: 0,
    executionTime: 0,
    cacheHits: 0,
    aiCalls: 0,
    memoryUsed: 0,
  };

  private defaultWeights = {
    title: 3.0,
    problem: 2.0,
    solution: 1.5,
    tags: 1.0,
    category: 0.5,
    semantic: 4.0,
  };

  /**
   * Find similar entries to a given entry
   */
  async findSimilar(
    targetEntry: KBEntry,
    allEntries: KBEntry[],
    options: DetectionOptions = {}
  ): Promise<SimilarityResult[]> {
    const startTime = Date.now();
    const {
      threshold = 0.7,
      useAI = false,
      maxComparisons = 1000,
      includeFields = ['title', 'problem', 'solution', 'tags', 'category'],
      optimizationLevel = 'balanced',
    } = options;

    // Check cache first
    const cacheKey = this.generateCacheKey(targetEntry, options);
    if (this.cache.has(cacheKey)) {
      this.performanceMetrics.cacheHits++;
      return this.cache.get(cacheKey)!;
    }

    const results: SimilarityResult[] = [];
    const comparisons = Math.min(maxComparisons, allEntries.length);

    // Filter and optimize entry list
    const filteredEntries = this.optimizeEntryList(
      allEntries.filter(entry => entry.id !== targetEntry.id),
      targetEntry,
      optimizationLevel
    ).slice(0, comparisons);

    // Perform similarity comparisons
    for (const entry of filteredEntries) {
      const similarity = await this.calculateSimilarity(targetEntry, entry, includeFields, useAI);

      if (similarity.similarity >= threshold) {
        results.push(similarity);
      }

      this.performanceMetrics.totalComparisons++;
    }

    // Sort by similarity score
    results.sort((a, b) => b.similarity - a.similarity);

    // Cache results
    this.cache.set(cacheKey, results);

    // Update performance metrics
    this.performanceMetrics.executionTime += Date.now() - startTime;

    return results;
  }

  /**
   * Detect all duplicate groups in a set of entries
   */
  async detectDuplicateGroups(
    entries: KBEntry[],
    options: DetectionOptions = {}
  ): Promise<DuplicateGroup[]> {
    const { threshold = 0.8, groupSimilar = true, optimizationLevel = 'balanced' } = options;

    const processedEntries = new Set<string>();
    const duplicateGroups: DuplicateGroup[] = [];

    // Sort entries by usage and date for better primary selection
    const sortedEntries = [...entries].sort((a, b) => {
      const usageA = (a.usage_count || 0) + (a.success_count || 0);
      const usageB = (b.usage_count || 0) + (b.success_count || 0);

      if (usageA !== usageB) {
        return usageB - usageA; // Higher usage first
      }

      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();
      return dateA - dateB; // Older first
    });

    for (const entry of sortedEntries) {
      if (processedEntries.has(entry.id!)) continue;

      const similarEntries = await this.findSimilar(entry, entries, {
        ...options,
        threshold,
        groupSimilar: false,
      });

      if (similarEntries.length > 0) {
        const duplicates = similarEntries
          .map(s => s.entry)
          .filter(e => !processedEntries.has(e.id!));

        if (duplicates.length > 0) {
          const group: DuplicateGroup = {
            primary: entry,
            duplicates,
            averageSimilarity:
              similarEntries.reduce((sum, s) => sum + s.similarity, 0) / similarEntries.length,
            mergeStrategy: this.suggestMergeStrategy(entry, duplicates),
            conflicts: this.identifyConflicts(entry, duplicates),
          };

          duplicateGroups.push(group);

          // Mark all entries in this group as processed
          processedEntries.add(entry.id!);
          duplicates.forEach(d => processedEntries.add(d.id!));
        }
      }
    }

    return duplicateGroups.sort((a, b) => b.averageSimilarity - a.averageSimilarity);
  }

  /**
   * Calculate comprehensive similarity between two entries
   */
  private async calculateSimilarity(
    entry1: KBEntry,
    entry2: KBEntry,
    includeFields: string[],
    useAI: boolean
  ): Promise<SimilarityResult> {
    const scores: SimilarityResult['scores'] = {
      title: 0,
      problem: 0,
      solution: 0,
      tags: 0,
      category: 0,
    };

    const matchedFields: string[] = [];

    // Title similarity
    if (includeFields.includes('title') && entry1.title && entry2.title) {
      scores.title = Math.max(
        SimilarityAlgorithms.jaccard(entry1.title, entry2.title),
        SimilarityAlgorithms.levenshtein(entry1.title, entry2.title),
        SimilarityAlgorithms.ngram(entry1.title, entry2.title)
      );

      if (scores.title > 0.7) matchedFields.push('title');
    }

    // Problem similarity
    if (includeFields.includes('problem') && entry1.problem && entry2.problem) {
      scores.problem = Math.max(
        SimilarityAlgorithms.jaccard(entry1.problem, entry2.problem),
        SimilarityAlgorithms.cosine(entry1.problem, entry2.problem)
      );

      if (scores.problem > 0.6) matchedFields.push('problem');
    }

    // Solution similarity
    if (includeFields.includes('solution') && entry1.solution && entry2.solution) {
      scores.solution = Math.max(
        SimilarityAlgorithms.jaccard(entry1.solution, entry2.solution),
        SimilarityAlgorithms.cosine(entry1.solution, entry2.solution)
      );

      if (scores.solution > 0.6) matchedFields.push('solution');
    }

    // Tags similarity
    if (includeFields.includes('tags') && entry1.tags && entry2.tags) {
      const tags1 = new Set(entry1.tags.map(t => t.toLowerCase()));
      const tags2 = new Set(entry2.tags.map(t => t.toLowerCase()));

      if (tags1.size > 0 || tags2.size > 0) {
        const intersection = new Set([...tags1].filter(x => tags2.has(x)));
        const union = new Set([...tags1, ...tags2]);
        scores.tags = intersection.size / union.size;

        if (scores.tags > 0.5) matchedFields.push('tags');
      }
    }

    // Category similarity
    if (includeFields.includes('category') && entry1.category && entry2.category) {
      scores.category = entry1.category === entry2.category ? 1 : 0;

      if (scores.category === 1) matchedFields.push('category');
    }

    // Semantic similarity via AI (if enabled)
    if (useAI) {
      try {
        scores.semantic = await this.calculateSemanticSimilarity(entry1, entry2);
        this.performanceMetrics.aiCalls++;
      } catch (error) {
        console.warn('AI similarity calculation failed:', error);
        scores.semantic = 0;
      }
    }

    // Calculate weighted overall similarity
    const similarity = SimilarityAlgorithms.weighted(scores, this.defaultWeights);

    // Determine match type and confidence
    const { matchType, confidence } = this.classifyMatch(similarity, scores, matchedFields);

    return {
      entry: entry2,
      similarity,
      scores,
      matchType,
      matchedFields,
      confidence,
    };
  }

  /**
   * Calculate semantic similarity using AI
   */
  private async calculateSemanticSimilarity(entry1: KBEntry, entry2: KBEntry): Promise<number> {
    // This would integrate with Gemini API for semantic similarity
    // For now, return a placeholder implementation
    const text1 = `${entry1.title} ${entry1.problem}`;
    const text2 = `${entry2.title} ${entry2.problem}`;

    // Simple semantic similarity based on common technical terms
    const technicalTerms = this.extractTechnicalTerms(text1, text2);
    const commonTerms = technicalTerms.common;
    const totalTerms = technicalTerms.total;

    return totalTerms > 0 ? commonTerms / totalTerms : 0;
  }

  /**
   * Extract technical terms for semantic analysis
   */
  private extractTechnicalTerms(
    text1: string,
    text2: string
  ): {
    common: number;
    total: number;
  } {
    const technicalPatterns = [
      /S0C\d/g, // System completion codes
      /U\d{4}/g, // User abend codes
      /IEF\d{3}[A-Z]/g, // JES messages
      /DB2|SQL/g, // Database terms
      /VSAM|QSAM|BSAM/g, // Access methods
      /JCL|MVS|TSO/g, // System terms
      /COBOL|PL1|ASSEMBLER/g, // Languages
      /CICS|IMS/g, // Transaction managers
    ];

    const terms1 = new Set<string>();
    const terms2 = new Set<string>();

    technicalPatterns.forEach(pattern => {
      const matches1 = (text1.match(pattern) || []).map(m => m.toLowerCase());
      const matches2 = (text2.match(pattern) || []).map(m => m.toLowerCase());

      matches1.forEach(term => terms1.add(term));
      matches2.forEach(term => terms2.add(term));
    });

    const commonTerms = new Set([...terms1].filter(x => terms2.has(x)));
    const totalTerms = new Set([...terms1, ...terms2]);

    return {
      common: commonTerms.size,
      total: totalTerms.size,
    };
  }

  /**
   * Classify match type and confidence
   */
  private classifyMatch(
    similarity: number,
    scores: SimilarityResult['scores'],
    matchedFields: string[]
  ): { matchType: SimilarityResult['matchType']; confidence: number } {
    let matchType: SimilarityResult['matchType'];
    let confidence = similarity;

    if (similarity >= 0.95) {
      matchType = 'exact';
      confidence = Math.min(1, confidence * 1.1);
    } else if (similarity >= 0.8) {
      matchType = 'high';
      confidence = Math.min(1, confidence * 1.05);
    } else if (similarity >= 0.6) {
      matchType = 'medium';
    } else {
      matchType = 'low';
      confidence = confidence * 0.9;
    }

    // Boost confidence for title matches
    if (matchedFields.includes('title') && scores.title > 0.8) {
      confidence = Math.min(1, confidence * 1.1);
    }

    // Reduce confidence for category mismatches
    if (scores.category === 0 && matchedFields.length > 0) {
      confidence = confidence * 0.9;
    }

    return { matchType, confidence: Math.max(0, Math.min(1, confidence)) };
  }

  /**
   * Optimize entry list for comparison performance
   */
  private optimizeEntryList(
    entries: KBEntry[],
    targetEntry: KBEntry,
    optimizationLevel: string
  ): KBEntry[] {
    switch (optimizationLevel) {
      case 'fast':
        // Only compare entries in same category
        return entries.filter(entry => entry.category === targetEntry.category);

      case 'thorough':
        // Compare all entries
        return entries;

      case 'balanced':
      default:
        // Prioritize same category, then similar tags, then chronologically close
        const sameCategory = entries.filter(entry => entry.category === targetEntry.category);
        const similarTags = entries.filter(entry => {
          if (!entry.tags || !targetEntry.tags) return false;
          const commonTags = entry.tags.filter(tag =>
            targetEntry.tags!.some(tTag => tTag.toLowerCase().includes(tag.toLowerCase()))
          );
          return commonTags.length > 0;
        });

        const combined = [...new Set([...sameCategory, ...similarTags])];
        return combined.length > 0 ? combined : entries.slice(0, 200);
    }
  }

  /**
   * Suggest merge strategy for duplicate groups
   */
  private suggestMergeStrategy(
    primary: KBEntry,
    duplicates: KBEntry[]
  ): DuplicateGroup['mergeStrategy'] {
    const primaryUsage = (primary.usage_count || 0) + (primary.success_count || 0);
    const maxDuplicateUsage = Math.max(
      ...duplicates.map(d => (d.usage_count || 0) + (d.success_count || 0))
    );

    // If primary has significantly more usage, keep it
    if (primaryUsage > maxDuplicateUsage * 2) {
      return 'keep_primary';
    }

    // If duplicates have much more recent activity, suggest manual review
    const primaryDate = new Date(primary.updated_at || primary.created_at || 0).getTime();
    const maxDuplicateDate = Math.max(
      ...duplicates.map(d => new Date(d.updated_at || d.created_at || 0).getTime())
    );

    if (maxDuplicateDate > primaryDate + 30 * 24 * 60 * 60 * 1000) {
      // 30 days
      return 'manual_review';
    }

    // Default to merging all
    return 'merge_all';
  }

  /**
   * Identify conflicts between entries
   */
  private identifyConflicts(primary: KBEntry, duplicates: KBEntry[]): string[] {
    const conflicts: string[] = [];

    duplicates.forEach(duplicate => {
      // Category conflicts
      if (primary.category !== duplicate.category) {
        conflicts.push(`Category mismatch: ${primary.category} vs ${duplicate.category}`);
      }

      // Solution length differences
      const primarySolLength = primary.solution?.length || 0;
      const duplicateSolLength = duplicate.solution?.length || 0;

      if (Math.abs(primarySolLength - duplicateSolLength) > primarySolLength * 0.5) {
        conflicts.push('Significant solution length difference');
      }

      // Recent update conflicts
      const primaryUpdate = new Date(primary.updated_at || 0).getTime();
      const duplicateUpdate = new Date(duplicate.updated_at || 0).getTime();

      if (duplicateUpdate > primaryUpdate + 7 * 24 * 60 * 60 * 1000) {
        // 7 days
        conflicts.push('Duplicate has more recent updates');
      }
    });

    return [...new Set(conflicts)]; // Remove duplicates
  }

  /**
   * Generate cache key for similarity results
   */
  private generateCacheKey(entry: KBEntry, options: DetectionOptions): string {
    return `${entry.id}_${JSON.stringify(options)}`;
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  /**
   * Clear cache and reset metrics
   */
  clearCache(): void {
    this.cache.clear();
    this.performanceMetrics = {
      totalComparisons: 0,
      executionTime: 0,
      cacheHits: 0,
      aiCalls: 0,
      memoryUsed: 0,
    };
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; hitRate: number } {
    const totalRequests =
      this.performanceMetrics.totalComparisons + this.performanceMetrics.cacheHits;
    const hitRate = totalRequests > 0 ? this.performanceMetrics.cacheHits / totalRequests : 0;

    return {
      size: this.cache.size,
      hitRate,
    };
  }
}

export default DuplicateDetectionService;
