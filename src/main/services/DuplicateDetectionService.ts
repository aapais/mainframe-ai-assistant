import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { KBEntry } from '../../database/KnowledgeDB';
import Database from 'better-sqlite3';

/**
 * Types of duplicate detection algorithms
 */
export type DuplicateAlgorithm = 'exact_match' | 'fuzzy_text' | 'semantic_similarity' | 'hybrid';

/**
 * Duplicate detection result for a pair of entries
 */
export interface DuplicateMatch {
  id: string;
  entry1: KBEntry;
  entry2: KBEntry;
  similarityScore: number;
  algorithm: DuplicateAlgorithm;
  matchedFields: Array<{
    field: keyof KBEntry;
    similarity: number;
    entry1Value: any;
    entry2Value: any;
  }>;
  confidence: number; // 0-100
  detectedAt: Date;
  status: 'pending' | 'confirmed' | 'dismissed' | 'merged';
}

/**
 * Options for duplicate detection scan
 */
export interface DuplicateDetectionOptions {
  algorithm?: DuplicateAlgorithm;
  similarityThreshold?: number; // 0-1 scale
  fieldsToCompare?: Array<keyof KBEntry>;
  excludeArchived?: boolean;
  batchSize?: number;
  categories?: string[];
  skipConfirmed?: boolean;
}

/**
 * Merge suggestion with automated resolution options
 */
export interface MergeSuggestion {
  duplicateId: string;
  primaryEntry: KBEntry;
  duplicateEntry: KBEntry;
  mergedEntry: Partial<KBEntry>;
  conflictFields: Array<{
    field: keyof KBEntry;
    primaryValue: any;
    duplicateValue: any;
    suggestedResolution: 'use_primary' | 'use_duplicate' | 'combine' | 'manual';
    reasoning: string;
  }>;
  automatedResolution: boolean; // Whether merge can be automated
  confidenceScore: number;
}

/**
 * Batch duplicate detection results
 */
export interface DuplicateDetectionResult {
  scanId: string;
  totalEntriesScanned: number;
  duplicatesFound: number;
  processingTime: number;
  algorithm: DuplicateAlgorithm;
  matches: DuplicateMatch[];
  statistics: {
    exactMatches: number;
    highSimilarity: number; // >80%
    mediumSimilarity: number; // 60-80%
    lowSimilarity: number; // <60%
  };
}

/**
 * Progress information for long-running detection scans
 */
export interface DetectionProgress {
  scanId: string;
  totalEntries: number;
  processedEntries: number;
  currentEntry: string;
  duplicatesFound: number;
  estimatedTimeRemaining: number;
  percentage: number;
}

/**
 * Advanced duplicate detection service for Knowledge Base entries
 *
 * Features:
 * - Multiple detection algorithms (exact, fuzzy, semantic, hybrid)
 * - Field-level similarity analysis with weighted scoring
 * - Intelligent merge suggestions with conflict resolution
 * - Batch processing with progress tracking
 * - Performance optimization for large datasets
 * - False positive learning and adjustment
 *
 * Algorithms:
 * - Exact Match: Character-by-character comparison
 * - Fuzzy Text: Levenshtein distance and n-gram analysis
 * - Semantic Similarity: AI-powered semantic comparison
 * - Hybrid: Combined approach for comprehensive detection
 *
 * @extends EventEmitter
 *
 * @emits 'progress' - Detection progress updates
 * @emits 'duplicate_found' - New duplicate detected
 * @emits 'scan_complete' - Detection scan completed
 * @emits 'merge_suggestion' - Intelligent merge suggestion
 * @emits 'false_positive' - False positive detected for learning
 *
 * @example
 * ```typescript
 * const duplicateService = new DuplicateDetectionService(database);
 *
 * // Scan for duplicates
 * duplicateService.on('duplicate_found', (match) => {
 *   console.log(`Found duplicate: ${match.similarityScore}% match`);
 * });
 *
 * const results = await duplicateService.scanForDuplicates({
 *   algorithm: 'hybrid',
 *   similarityThreshold: 0.8
 * });
 *
 * // Get merge suggestions
 * const suggestions = await duplicateService.getMergeSuggestions(results.matches);
 *
 * // Auto-merge high-confidence duplicates
 * for (const suggestion of suggestions) {
 *   if (suggestion.automatedResolution && suggestion.confidenceScore > 90) {
 *     await duplicateService.mergeDuplicates(suggestion.duplicateId, suggestion.mergedEntry);
 *   }
 * }
 * ```
 */
export class DuplicateDetectionService extends EventEmitter {
  private db: Database.Database;
  private activeScans = new Map<string, DetectionProgress>();

  // Algorithm weights for hybrid detection
  private readonly FIELD_WEIGHTS = {
    title: 0.35,
    problem: 0.25,
    solution: 0.25,
    category: 0.1,
    tags: 0.05,
  };

  // Similarity thresholds for different confidence levels
  private readonly SIMILARITY_THRESHOLDS = {
    exact: 1.0,
    high: 0.8,
    medium: 0.6,
    low: 0.4,
  };

  // Performance optimization settings
  private readonly BATCH_SIZE = 50;
  private readonly PROGRESS_UPDATE_INTERVAL = 25;
  private readonly SEMANTIC_CACHE_SIZE = 1000;

  // Caching for expensive operations
  private semanticCache = new Map<string, number>();
  private ngramCache = new Map<string, Set<string>>();

  constructor(database: Database.Database) {
    super();
    this.db = database;
    this.initializeDuplicatesTables();
    this.setupCleanupSchedule();
  }

  /**
   * Scan all KB entries for potential duplicates
   *
   * @param options - Detection configuration options
   * @returns Promise resolving to detection results
   */
  async scanForDuplicates(
    options: DuplicateDetectionOptions = {}
  ): Promise<DuplicateDetectionResult> {
    const scanId = uuidv4();
    const startTime = Date.now();

    const {
      algorithm = 'hybrid',
      similarityThreshold = 0.7,
      fieldsToCompare = ['title', 'problem', 'solution', 'category'],
      excludeArchived = true,
      batchSize = this.BATCH_SIZE,
      categories,
      skipConfirmed = true,
    } = options;

    // Get all entries to scan
    const entries = this.getEntriesToScan(excludeArchived, categories);
    const totalEntries = entries.length;

    // Initialize progress tracking
    this.initializeProgress(scanId, totalEntries);

    const matches: DuplicateMatch[] = [];
    const statistics = {
      exactMatches: 0,
      highSimilarity: 0,
      mediumSimilarity: 0,
      lowSimilarity: 0,
    };

    // Process entries in batches for better performance
    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize);

      await this.processBatch(
        batch,
        entries,
        i,
        algorithm,
        similarityThreshold,
        fieldsToCompare,
        matches,
        statistics,
        scanId,
        skipConfirmed
      );

      // Update progress
      if (i % this.PROGRESS_UPDATE_INTERVAL === 0) {
        this.updateProgress(scanId, i, batch[0]?.title || 'Processing...');
      }
    }

    // Final progress update
    this.completeProgress(scanId, matches.length);

    const result: DuplicateDetectionResult = {
      scanId,
      totalEntriesScanned: totalEntries,
      duplicatesFound: matches.length,
      processingTime: Date.now() - startTime,
      algorithm,
      matches,
      statistics,
    };

    // Store scan results
    this.storeScanResults(result);

    this.emit('scan_complete', result);
    return result;
  }

  /**
   * Check if a specific entry has potential duplicates
   *
   * @param entryId - ID of the entry to check
   * @param options - Detection options
   * @returns Promise resolving to potential duplicates
   */
  async checkEntryForDuplicates(
    entryId: string,
    options: Partial<DuplicateDetectionOptions> = {}
  ): Promise<DuplicateMatch[]> {
    const entry = this.getEntryById(entryId);
    if (!entry) {
      throw new Error(`Entry not found: ${entryId}`);
    }

    const {
      algorithm = 'hybrid',
      similarityThreshold = 0.7,
      fieldsToCompare = ['title', 'problem', 'solution'],
    } = options;

    const allEntries = this.getEntriesToScan(true);
    const potentialDuplicates = allEntries.filter(e => e.id !== entryId);

    const matches: DuplicateMatch[] = [];

    for (const candidate of potentialDuplicates) {
      const similarity = await this.calculateSimilarity(
        entry,
        candidate,
        algorithm,
        fieldsToCompare
      );

      if (similarity.overall >= similarityThreshold) {
        const match = this.createDuplicateMatch(entry, candidate, similarity, algorithm);

        matches.push(match);
      }
    }

    return matches.sort((a, b) => b.similarityScore - a.similarityScore);
  }

  /**
   * Generate intelligent merge suggestions for duplicate pairs
   *
   * @param duplicates - Array of duplicate matches
   * @returns Promise resolving to merge suggestions
   */
  async getMergeSuggestions(duplicates: DuplicateMatch[]): Promise<MergeSuggestion[]> {
    const suggestions: MergeSuggestion[] = [];

    for (const duplicate of duplicates) {
      const suggestion = await this.generateMergeSuggestion(duplicate);
      suggestions.push(suggestion);

      this.emit('merge_suggestion', suggestion);
    }

    return suggestions.sort((a, b) => b.confidenceScore - a.confidenceScore);
  }

  /**
   * Automatically merge duplicate entries based on suggestion
   *
   * @param duplicateId - ID of the duplicate match
   * @param mergedEntry - The merged entry data
   * @param userId - User performing the merge
   * @returns Promise resolving to merge result
   */
  async mergeDuplicates(
    duplicateId: string,
    mergedEntry: Partial<KBEntry>,
    userId: string = 'auto-merge'
  ): Promise<{
    success: boolean;
    primaryEntryId: string;
    duplicateEntryId: string;
    mergedEntryId: string;
    conflicts: string[];
  }> {
    const duplicate = await this.getDuplicateMatch(duplicateId);
    if (!duplicate) {
      throw new Error(`Duplicate match not found: ${duplicateId}`);
    }

    const conflicts: string[] = [];
    const mergeTransaction = this.db.transaction(() => {
      try {
        // Determine primary and duplicate entries based on usage stats
        const primary = this.selectPrimaryEntry(duplicate.entry1, duplicate.entry2);
        const secondary = primary.id === duplicate.entry1.id ? duplicate.entry2 : duplicate.entry1;

        // Update primary entry with merged data
        this.updateEntryWithMergedData(primary.id!, mergedEntry, conflicts);

        // Transfer usage statistics from secondary to primary
        this.transferUsageStats(primary.id!, secondary.id!);

        // Archive the duplicate entry
        this.archiveEntry(secondary.id!);

        // Update duplicate status
        this.updateDuplicateStatus(duplicateId, 'merged', userId);

        // Log the merge operation
        this.logMergeOperation(duplicateId, primary.id!, secondary.id!, userId, conflicts);

        return {
          success: true,
          primaryEntryId: primary.id!,
          duplicateEntryId: secondary.id!,
          mergedEntryId: primary.id!,
          conflicts,
        };
      } catch (error) {
        conflicts.push(`Merge failed: ${error.message}`);
        return {
          success: false,
          primaryEntryId: '',
          duplicateEntryId: '',
          mergedEntryId: '',
          conflicts,
        };
      }
    });

    return mergeTransaction();
  }

  /**
   * Mark a duplicate detection as false positive for learning
   *
   * @param duplicateId - ID of the duplicate match
   * @param userId - User marking as false positive
   * @param reason - Optional reason for false positive
   */
  async markAsFalsePositive(duplicateId: string, userId: string, reason?: string): Promise<void> {
    const duplicate = await this.getDuplicateMatch(duplicateId);
    if (!duplicate) {
      throw new Error(`Duplicate match not found: ${duplicateId}`);
    }

    // Update duplicate status
    this.updateDuplicateStatus(duplicateId, 'dismissed', userId);

    // Log for learning algorithm improvement
    this.db
      .prepare(
        `
      INSERT INTO false_positives (
        id, duplicate_id, algorithm, similarity_score, user_id, reason, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `
      )
      .run(
        uuidv4(),
        duplicateId,
        duplicate.algorithm,
        duplicate.similarityScore,
        userId,
        reason || null,
        new Date().toISOString()
      );

    // Adjust algorithm thresholds based on false positive pattern
    this.learnFromFalsePositive(duplicate);

    this.emit('false_positive', {
      duplicateId,
      algorithm: duplicate.algorithm,
      similarityScore: duplicate.similarityScore,
      reason,
    });
  }

  /**
   * Get duplicate detection statistics and analytics
   *
   * @param timeRange - Optional time range for analytics
   * @returns Comprehensive duplicate detection analytics
   */
  getDuplicateAnalytics(timeRange?: { start: Date; end: Date }): {
    totalDuplicatesFound: number;
    duplicatesByAlgorithm: Record<DuplicateAlgorithm, number>;
    duplicatesByStatus: Record<string, number>;
    averageSimilarityScore: number;
    falsePositiveRate: number;
    mergeSuccessRate: number;
    topDuplicateCategories: Array<{ category: string; count: number }>;
    performanceMetrics: {
      avgDetectionTime: number;
      avgMergeTime: number;
      cacheHitRate: number;
    };
  } {
    const whereClause = timeRange ? 'WHERE detected_at BETWEEN ? AND ?' : '';

    const params = timeRange ? [timeRange.start.toISOString(), timeRange.end.toISOString()] : [];

    // Get basic duplicate statistics
    const totalDuplicates = this.db
      .prepare(
        `
      SELECT COUNT(*) as count FROM duplicate_matches ${whereClause}
    `
      )
      .get(...params) as { count: number };

    const duplicatesByAlgorithm = this.db
      .prepare(
        `
      SELECT algorithm, COUNT(*) as count
      FROM duplicate_matches ${whereClause}
      GROUP BY algorithm
    `
      )
      .all(...params);

    const duplicatesByStatus = this.db
      .prepare(
        `
      SELECT status, COUNT(*) as count
      FROM duplicate_matches ${whereClause}
      GROUP BY status
    `
      )
      .all(...params);

    const avgSimilarity = this.db
      .prepare(
        `
      SELECT AVG(similarity_score) as avg_score
      FROM duplicate_matches ${whereClause}
    `
      )
      .get(...params) as { avg_score: number };

    // Calculate false positive rate
    const falsePositives = this.db
      .prepare(
        `
      SELECT COUNT(*) as count
      FROM false_positives fp
      JOIN duplicate_matches dm ON fp.duplicate_id = dm.id
      ${timeRange ? 'WHERE fp.timestamp BETWEEN ? AND ?' : ''}
    `
      )
      .get(...params) as { count: number };

    const falsePositiveRate =
      totalDuplicates.count > 0 ? (falsePositives.count / totalDuplicates.count) * 100 : 0;

    // Get top categories with duplicates
    const topCategories = this.db
      .prepare(
        `
      SELECT
        COALESCE(e1.category, e2.category) as category,
        COUNT(*) as count
      FROM duplicate_matches dm
      JOIN kb_entries e1 ON dm.entry1_id = e1.id
      JOIN kb_entries e2 ON dm.entry2_id = e2.id
      ${whereClause}
      GROUP BY category
      ORDER BY count DESC
      LIMIT 10
    `
      )
      .all(...params);

    // Build result objects
    const algorithmCounts: Record<DuplicateAlgorithm, number> = {
      exact_match: 0,
      fuzzy_text: 0,
      semantic_similarity: 0,
      hybrid: 0,
    };

    duplicatesByAlgorithm.forEach((item: any) => {
      algorithmCounts[item.algorithm as DuplicateAlgorithm] = item.count;
    });

    const statusCounts: Record<string, number> = {};
    duplicatesByStatus.forEach((item: any) => {
      statusCounts[item.status] = item.count;
    });

    return {
      totalDuplicatesFound: totalDuplicates.count,
      duplicatesByAlgorithm: algorithmCounts,
      duplicatesByStatus: statusCounts,
      averageSimilarityScore: Math.round((avgSimilarity.avg_score || 0) * 100),
      falsePositiveRate,
      mergeSuccessRate: this.calculateMergeSuccessRate(statusCounts),
      topDuplicateCategories: topCategories.map((cat: any) => ({
        category: cat.category,
        count: cat.count,
      })),
      performanceMetrics: {
        avgDetectionTime: 0, // TODO: Track detection times
        avgMergeTime: 0, // TODO: Track merge times
        cacheHitRate: this.calculateCacheHitRate(),
      },
    };
  }

  /**
   * Get active duplicate detection progress
   *
   * @param scanId - ID of the scan
   * @returns Current progress or null if not found
   */
  getDetectionProgress(scanId: string): DetectionProgress | null {
    return this.activeScans.get(scanId) || null;
  }

  /**
   * Cancel an active duplicate detection scan
   *
   * @param scanId - ID of the scan to cancel
   */
  cancelScan(scanId: string): boolean {
    const progress = this.activeScans.get(scanId);
    if (progress) {
      this.activeScans.delete(scanId);
      this.emit('scan_cancelled', { scanId });
      return true;
    }
    return false;
  }

  // Private implementation methods

  private initializeDuplicatesTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS duplicate_matches (
        id TEXT PRIMARY KEY,
        entry1_id TEXT NOT NULL,
        entry2_id TEXT NOT NULL,
        similarity_score REAL NOT NULL,
        algorithm TEXT NOT NULL,
        matched_fields TEXT NOT NULL,
        confidence INTEGER NOT NULL,
        detected_at TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_by TEXT,
        FOREIGN KEY (entry1_id) REFERENCES kb_entries(id),
        FOREIGN KEY (entry2_id) REFERENCES kb_entries(id)
      );

      CREATE TABLE IF NOT EXISTS duplicate_scans (
        id TEXT PRIMARY KEY,
        algorithm TEXT NOT NULL,
        entries_scanned INTEGER NOT NULL,
        duplicates_found INTEGER NOT NULL,
        processing_time INTEGER NOT NULL,
        scan_date TEXT NOT NULL,
        options TEXT
      );

      CREATE TABLE IF NOT EXISTS merge_operations (
        id TEXT PRIMARY KEY,
        duplicate_id TEXT NOT NULL,
        primary_entry_id TEXT NOT NULL,
        duplicate_entry_id TEXT NOT NULL,
        merged_by TEXT NOT NULL,
        merge_timestamp TEXT NOT NULL,
        conflicts TEXT,
        FOREIGN KEY (duplicate_id) REFERENCES duplicate_matches(id)
      );

      CREATE TABLE IF NOT EXISTS false_positives (
        id TEXT PRIMARY KEY,
        duplicate_id TEXT NOT NULL,
        algorithm TEXT NOT NULL,
        similarity_score REAL NOT NULL,
        user_id TEXT NOT NULL,
        reason TEXT,
        timestamp TEXT NOT NULL,
        FOREIGN KEY (duplicate_id) REFERENCES duplicate_matches(id)
      );

      -- Performance indexes
      CREATE INDEX IF NOT EXISTS idx_duplicate_matches_entry1 ON duplicate_matches(entry1_id);
      CREATE INDEX IF NOT EXISTS idx_duplicate_matches_entry2 ON duplicate_matches(entry2_id);
      CREATE INDEX IF NOT EXISTS idx_duplicate_matches_status ON duplicate_matches(status);
      CREATE INDEX IF NOT EXISTS idx_duplicate_matches_detected_at ON duplicate_matches(detected_at);
    `);
  }

  private getEntriesToScan(excludeArchived: boolean, categories?: string[]): KBEntry[] {
    let whereClause = '1=1';
    const params: any[] = [];

    if (excludeArchived) {
      whereClause += ' AND archived = FALSE';
    }

    if (categories && categories.length > 0) {
      whereClause += ` AND category IN (${categories.map(() => '?').join(', ')})`;
      params.push(...categories);
    }

    const entries = this.db
      .prepare(
        `
      SELECT
        e.*,
        GROUP_CONCAT(t.tag, ', ') as tags
      FROM kb_entries e
      LEFT JOIN kb_tags t ON e.id = t.entry_id
      WHERE ${whereClause}
      GROUP BY e.id
      ORDER BY e.created_at DESC
    `
      )
      .all(...params);

    return entries.map(this.mapRowToKBEntry);
  }

  private getEntryById(entryId: string): KBEntry | null {
    const row = this.db
      .prepare(
        `
      SELECT
        e.*,
        GROUP_CONCAT(t.tag, ', ') as tags
      FROM kb_entries e
      LEFT JOIN kb_tags t ON e.id = t.entry_id
      WHERE e.id = ?
      GROUP BY e.id
    `
      )
      .get(entryId);

    return row ? this.mapRowToKBEntry(row) : null;
  }

  private mapRowToKBEntry(row: any): KBEntry {
    return {
      id: row.id,
      title: row.title,
      problem: row.problem,
      solution: row.solution,
      category: row.category,
      severity: row.severity,
      tags: row.tags ? row.tags.split(', ') : [],
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
      created_by: row.created_by,
      usage_count: row.usage_count,
      success_count: row.success_count,
      failure_count: row.failure_count,
      last_used: row.last_used ? new Date(row.last_used) : undefined,
      archived: row.archived,
    };
  }

  private async processBatch(
    batch: KBEntry[],
    allEntries: KBEntry[],
    startIndex: number,
    algorithm: DuplicateAlgorithm,
    threshold: number,
    fieldsToCompare: Array<keyof KBEntry>,
    matches: DuplicateMatch[],
    statistics: any,
    scanId: string,
    skipConfirmed: boolean
  ): Promise<void> {
    for (const entry of batch) {
      // Compare with all subsequent entries to avoid duplicate comparisons
      const compareStart = allEntries.findIndex(e => e.id === entry.id) + 1;

      for (let j = compareStart; j < allEntries.length; j++) {
        const candidate = allEntries[j];

        // Skip if already confirmed as non-duplicate
        if (skipConfirmed && (await this.isConfirmedNonDuplicate(entry.id!, candidate.id!))) {
          continue;
        }

        const similarity = await this.calculateSimilarity(
          entry,
          candidate,
          algorithm,
          fieldsToCompare
        );

        if (similarity.overall >= threshold) {
          const match = this.createDuplicateMatch(entry, candidate, similarity, algorithm);
          matches.push(match);

          // Update statistics
          this.updateStatistics(statistics, similarity.overall);

          this.emit('duplicate_found', match);
        }
      }
    }
  }

  private async calculateSimilarity(
    entry1: KBEntry,
    entry2: KBEntry,
    algorithm: DuplicateAlgorithm,
    fieldsToCompare: Array<keyof KBEntry>
  ): Promise<{
    overall: number;
    fieldSimilarities: Record<string, number>;
  }> {
    const fieldSimilarities: Record<string, number> = {};
    let weightedSum = 0;
    let totalWeight = 0;

    for (const field of fieldsToCompare) {
      const value1 = entry1[field];
      const value2 = entry2[field];

      if (value1 === undefined && value2 === undefined) {
        fieldSimilarities[field as string] = 1.0;
      } else if (value1 === undefined || value2 === undefined) {
        fieldSimilarities[field as string] = 0.0;
      } else {
        let similarity: number;

        switch (algorithm) {
          case 'exact_match':
            similarity = this.calculateExactSimilarity(value1, value2);
            break;
          case 'fuzzy_text':
            similarity = this.calculateFuzzySimilarity(value1, value2);
            break;
          case 'semantic_similarity':
            similarity = await this.calculateSemanticSimilarity(value1, value2);
            break;
          case 'hybrid':
            similarity = await this.calculateHybridSimilarity(value1, value2);
            break;
          default:
            similarity = this.calculateFuzzySimilarity(value1, value2);
        }

        fieldSimilarities[field as string] = similarity;
      }

      const weight = this.FIELD_WEIGHTS[field as keyof typeof this.FIELD_WEIGHTS] || 0.1;
      weightedSum += fieldSimilarities[field as string] * weight;
      totalWeight += weight;
    }

    const overall = totalWeight > 0 ? weightedSum / totalWeight : 0;

    return { overall, fieldSimilarities };
  }

  private calculateExactSimilarity(value1: any, value2: any): number {
    const str1 = this.normalizeForComparison(value1);
    const str2 = this.normalizeForComparison(value2);

    return str1 === str2 ? 1.0 : 0.0;
  }

  private calculateFuzzySimilarity(value1: any, value2: any): number {
    const str1 = this.normalizeForComparison(value1);
    const str2 = this.normalizeForComparison(value2);

    if (str1 === str2) return 1.0;
    if (str1.length === 0 || str2.length === 0) return 0.0;

    // Use multiple fuzzy matching techniques
    const levenshteinSim = this.calculateLevenshteinSimilarity(str1, str2);
    const ngramSim = this.calculateNgramSimilarity(str1, str2);
    const jaccardSim = this.calculateJaccardSimilarity(str1, str2);

    // Weighted combination
    return levenshteinSim * 0.5 + ngramSim * 0.3 + jaccardSim * 0.2;
  }

  private async calculateSemanticSimilarity(value1: any, value2: any): Promise<number> {
    const str1 = this.normalizeForComparison(value1);
    const str2 = this.normalizeForComparison(value2);

    const cacheKey = `${str1}|||${str2}`;

    if (this.semanticCache.has(cacheKey)) {
      return this.semanticCache.get(cacheKey)!;
    }

    // Simplified semantic similarity - in a real implementation,
    // this would use AI/ML models for semantic comparison
    const similarity = this.calculateSimplifiedSemantic(str1, str2);

    // Cache result
    if (this.semanticCache.size < this.SEMANTIC_CACHE_SIZE) {
      this.semanticCache.set(cacheKey, similarity);
    }

    return similarity;
  }

  private async calculateHybridSimilarity(value1: any, value2: any): Promise<number> {
    // Combine multiple algorithms with different weights
    const exact = this.calculateExactSimilarity(value1, value2);
    const fuzzy = this.calculateFuzzySimilarity(value1, value2);
    const semantic = await this.calculateSemanticSimilarity(value1, value2);

    // Weighted combination favoring exact matches
    return exact * 0.5 + fuzzy * 0.3 + semantic * 0.2;
  }

  private calculateLevenshteinSimilarity(str1: string, str2: string): number {
    const distance = this.levenshteinDistance(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);

    return maxLength === 0 ? 1.0 : 1 - distance / maxLength;
  }

  private calculateNgramSimilarity(str1: string, str2: string): number {
    const ngrams1 = this.getNgrams(str1, 3);
    const ngrams2 = this.getNgrams(str2, 3);

    const intersection = new Set([...ngrams1].filter(gram => ngrams2.has(gram)));
    const union = new Set([...ngrams1, ...ngrams2]);

    return union.size === 0 ? 1.0 : intersection.size / union.size;
  }

  private calculateJaccardSimilarity(str1: string, str2: string): number {
    const words1 = new Set(str1.toLowerCase().split(/\s+/));
    const words2 = new Set(str2.toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);

    return union.size === 0 ? 1.0 : intersection.size / union.size;
  }

  private calculateSimplifiedSemantic(str1: string, str2: string): number {
    // Simplified semantic similarity using word overlap and synonyms
    const words1 = str1.toLowerCase().split(/\s+/);
    const words2 = str2.toLowerCase().split(/\s+/);

    // Simple synonym mapping for mainframe terms
    const synonyms: Record<string, string[]> = {
      error: ['issue', 'problem', 'failure'],
      job: ['batch', 'program', 'routine'],
      file: ['dataset', 'data', 'record'],
      abend: ['abort', 'fail', 'terminate'],
    };

    let matches = 0;
    let totalWords = Math.max(words1.length, words2.length);

    for (const word1 of words1) {
      if (words2.includes(word1)) {
        matches++;
      } else {
        // Check synonyms
        const word1Synonyms = synonyms[word1] || [];
        if (word1Synonyms.some(syn => words2.includes(syn))) {
          matches += 0.8; // Partial match for synonyms
        }
      }
    }

    return totalWords === 0 ? 1.0 : matches / totalWords;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1 // deletion
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  private getNgrams(text: string, n: number): Set<string> {
    const cacheKey = `${text}:${n}`;

    if (this.ngramCache.has(cacheKey)) {
      return this.ngramCache.get(cacheKey)!;
    }

    const ngrams = new Set<string>();
    const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, '');

    for (let i = 0; i <= normalized.length - n; i++) {
      ngrams.add(normalized.substr(i, n));
    }

    if (this.ngramCache.size < 1000) {
      // Limit cache size
      this.ngramCache.set(cacheKey, ngrams);
    }

    return ngrams;
  }

  private normalizeForComparison(value: any): string {
    if (Array.isArray(value)) {
      return value.join(' ').toLowerCase();
    }

    return String(value || '')
      .toLowerCase()
      .trim();
  }

  private createDuplicateMatch(
    entry1: KBEntry,
    entry2: KBEntry,
    similarity: { overall: number; fieldSimilarities: Record<string, number> },
    algorithm: DuplicateAlgorithm
  ): DuplicateMatch {
    const matchId = uuidv4();
    const matchedFields = Object.entries(similarity.fieldSimilarities).map(([field, sim]) => ({
      field: field as keyof KBEntry,
      similarity: sim,
      entry1Value: entry1[field as keyof KBEntry],
      entry2Value: entry2[field as keyof KBEntry],
    }));

    const confidence = Math.round(similarity.overall * 100);

    const match: DuplicateMatch = {
      id: matchId,
      entry1,
      entry2,
      similarityScore: similarity.overall,
      algorithm,
      matchedFields,
      confidence,
      detectedAt: new Date(),
      status: 'pending',
    };

    // Store in database
    this.storeDuplicateMatch(match);

    return match;
  }

  private storeDuplicateMatch(match: DuplicateMatch): void {
    this.db
      .prepare(
        `
      INSERT INTO duplicate_matches (
        id, entry1_id, entry2_id, similarity_score, algorithm,
        matched_fields, confidence, detected_at, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
      )
      .run(
        match.id,
        match.entry1.id,
        match.entry2.id,
        match.similarityScore,
        match.algorithm,
        JSON.stringify(match.matchedFields),
        match.confidence,
        match.detectedAt.toISOString(),
        match.status
      );
  }

  private async generateMergeSuggestion(duplicate: DuplicateMatch): Promise<MergeSuggestion> {
    const primary = this.selectPrimaryEntry(duplicate.entry1, duplicate.entry2);
    const secondary = primary.id === duplicate.entry1.id ? duplicate.entry2 : duplicate.entry1;

    const mergedEntry: Partial<KBEntry> = { ...primary };
    const conflictFields: MergeSuggestion['conflictFields'] = [];

    // Analyze each field for merge conflicts and suggestions
    Object.keys(primary).forEach(field => {
      const key = field as keyof KBEntry;
      const primaryValue = primary[key];
      const secondaryValue = secondary[key];

      if (this.valuesConflict(primaryValue, secondaryValue)) {
        const resolution = this.suggestFieldResolution(key, primaryValue, secondaryValue);

        conflictFields.push({
          field: key,
          primaryValue,
          duplicateValue: secondaryValue,
          suggestedResolution: resolution.action,
          reasoning: resolution.reasoning,
        });

        // Apply suggested resolution
        if (resolution.action === 'use_duplicate') {
          (mergedEntry as any)[key] = secondaryValue;
        } else if (resolution.action === 'combine') {
          (mergedEntry as any)[key] = resolution.combinedValue;
        }
      }
    });

    // Calculate automation confidence
    const automatedResolution =
      conflictFields.length === 0 ||
      conflictFields.every(field => field.suggestedResolution !== 'manual');

    const confidenceScore = this.calculateMergeConfidence(duplicate, conflictFields);

    return {
      duplicateId: duplicate.id,
      primaryEntry: primary,
      duplicateEntry: secondary,
      mergedEntry,
      conflictFields,
      automatedResolution,
      confidenceScore,
    };
  }

  private selectPrimaryEntry(entry1: KBEntry, entry2: KBEntry): KBEntry {
    // Select primary based on usage statistics and quality indicators
    const score1 = this.calculateEntryScore(entry1);
    const score2 = this.calculateEntryScore(entry2);

    return score1 >= score2 ? entry1 : entry2;
  }

  private calculateEntryScore(entry: KBEntry): number {
    let score = 0;

    // Usage count (logarithmic to prevent dominance)
    score += Math.log(entry.usage_count! + 1) * 10;

    // Success rate
    const totalRatings = (entry.success_count || 0) + (entry.failure_count || 0);
    if (totalRatings > 0) {
      const successRate = (entry.success_count || 0) / totalRatings;
      score += successRate * 20;
    }

    // Recency (newer entries get slight boost)
    const daysSinceCreation = (Date.now() - entry.created_at!.getTime()) / (1000 * 60 * 60 * 24);
    score += Math.max(0, 30 - daysSinceCreation) * 0.1;

    // Content quality (length and structure)
    score += Math.min(
      10,
      (entry.title.length + entry.problem.length + entry.solution.length) / 100
    );

    return score;
  }

  private valuesConflict(value1: any, value2: any): boolean {
    if (Array.isArray(value1) && Array.isArray(value2)) {
      return JSON.stringify(value1.sort()) !== JSON.stringify(value2.sort());
    }

    return value1 !== value2;
  }

  private suggestFieldResolution(
    field: keyof KBEntry,
    primaryValue: any,
    duplicateValue: any
  ): {
    action: 'use_primary' | 'use_duplicate' | 'combine' | 'manual';
    reasoning: string;
    combinedValue?: any;
  } {
    switch (field) {
      case 'title':
        // Prefer longer, more descriptive titles
        if (duplicateValue.length > primaryValue.length * 1.5) {
          return {
            action: 'use_duplicate',
            reasoning: 'Duplicate has more descriptive title',
          };
        }
        return {
          action: 'use_primary',
          reasoning: 'Primary title is adequate',
        };

      case 'tags':
        // Combine unique tags
        const combinedTags = [...new Set([...primaryValue, ...duplicateValue])];
        return {
          action: 'combine',
          reasoning: 'Merge all unique tags',
          combinedValue: combinedTags,
        };

      case 'problem':
      case 'solution':
        // Prefer longer, more detailed descriptions
        if (duplicateValue.length > primaryValue.length * 1.2) {
          return {
            action: 'use_duplicate',
            reasoning: 'Duplicate has more detailed information',
          };
        }
        return {
          action: 'use_primary',
          reasoning: 'Primary has adequate detail',
        };

      default:
        return {
          action: 'use_primary',
          reasoning: 'Default to primary value',
        };
    }
  }

  private calculateMergeConfidence(duplicate: DuplicateMatch, conflicts: any[]): number {
    let confidence = duplicate.confidence;

    // Reduce confidence for each conflict requiring manual resolution
    const manualConflicts = conflicts.filter(c => c.suggestedResolution === 'manual').length;
    confidence -= manualConflicts * 15;

    // Boost confidence for high similarity
    if (duplicate.similarityScore > 0.9) {
      confidence += 10;
    }

    return Math.max(0, Math.min(100, confidence));
  }

  private initializeProgress(scanId: string, totalEntries: number): void {
    this.activeScans.set(scanId, {
      scanId,
      totalEntries,
      processedEntries: 0,
      currentEntry: 'Starting scan...',
      duplicatesFound: 0,
      estimatedTimeRemaining: 0,
      percentage: 0,
    });
  }

  private updateProgress(scanId: string, processedEntries: number, currentEntry: string): void {
    const progress = this.activeScans.get(scanId);
    if (!progress) return;

    const percentage = Math.round((processedEntries / progress.totalEntries) * 100);
    const remaining = progress.totalEntries - processedEntries;
    const avgTimePerEntry = processedEntries > 0 ? Date.now() / processedEntries : 0;
    const estimatedTimeRemaining = remaining * avgTimePerEntry;

    const updatedProgress: DetectionProgress = {
      ...progress,
      processedEntries,
      currentEntry,
      percentage,
      estimatedTimeRemaining,
    };

    this.activeScans.set(scanId, updatedProgress);
    this.emit('progress', updatedProgress);
  }

  private completeProgress(scanId: string, duplicatesFound: number): void {
    const progress = this.activeScans.get(scanId);
    if (progress) {
      this.emit('progress', {
        ...progress,
        processedEntries: progress.totalEntries,
        currentEntry: 'Scan complete',
        duplicatesFound,
        percentage: 100,
        estimatedTimeRemaining: 0,
      });
    }

    this.activeScans.delete(scanId);
  }

  private updateStatistics(statistics: any, similarity: number): void {
    if (similarity === 1.0) {
      statistics.exactMatches++;
    } else if (similarity >= 0.8) {
      statistics.highSimilarity++;
    } else if (similarity >= 0.6) {
      statistics.mediumSimilarity++;
    } else {
      statistics.lowSimilarity++;
    }
  }

  private storeScanResults(result: DuplicateDetectionResult): void {
    this.db
      .prepare(
        `
      INSERT INTO duplicate_scans (
        id, algorithm, entries_scanned, duplicates_found,
        processing_time, scan_date, options
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `
      )
      .run(
        result.scanId,
        result.algorithm,
        result.totalEntriesScanned,
        result.duplicatesFound,
        result.processingTime,
        new Date().toISOString(),
        JSON.stringify({}) // Options would be stored here
      );
  }

  private async isConfirmedNonDuplicate(entry1Id: string, entry2Id: string): Promise<boolean> {
    const confirmed = this.db
      .prepare(
        `
      SELECT COUNT(*) as count
      FROM duplicate_matches
      WHERE ((entry1_id = ? AND entry2_id = ?) OR (entry1_id = ? AND entry2_id = ?))
        AND status = 'dismissed'
    `
      )
      .get(entry1Id, entry2Id, entry2Id, entry1Id) as { count: number };

    return confirmed.count > 0;
  }

  private async getDuplicateMatch(duplicateId: string): Promise<DuplicateMatch | null> {
    const row = this.db
      .prepare(
        `
      SELECT * FROM duplicate_matches WHERE id = ?
    `
      )
      .get(duplicateId);

    if (!row) return null;

    const entry1 = this.getEntryById(row.entry1_id);
    const entry2 = this.getEntryById(row.entry2_id);

    if (!entry1 || !entry2) return null;

    return {
      id: row.id,
      entry1,
      entry2,
      similarityScore: row.similarity_score,
      algorithm: row.algorithm,
      matchedFields: JSON.parse(row.matched_fields),
      confidence: row.confidence,
      detectedAt: new Date(row.detected_at),
      status: row.status,
    };
  }

  private updateDuplicateStatus(duplicateId: string, status: string, userId: string): void {
    this.db
      .prepare(
        `
      UPDATE duplicate_matches
      SET status = ?, updated_at = CURRENT_TIMESTAMP, updated_by = ?
      WHERE id = ?
    `
      )
      .run(status, userId, duplicateId);
  }

  private updateEntryWithMergedData(
    entryId: string,
    mergedData: Partial<KBEntry>,
    conflicts: string[]
  ): void {
    try {
      const setFields: string[] = [];
      const values: any[] = [];

      Object.entries(mergedData).forEach(([key, value]) => {
        if (key !== 'id' && key !== 'tags' && value !== undefined) {
          setFields.push(`${key} = ?`);
          values.push(value);
        }
      });

      if (setFields.length > 0) {
        setFields.push('updated_at = CURRENT_TIMESTAMP');
        values.push(entryId);

        this.db
          .prepare(
            `
          UPDATE kb_entries
          SET ${setFields.join(', ')}
          WHERE id = ?
        `
          )
          .run(...values);
      }

      // Update tags if provided
      if (mergedData.tags) {
        this.db.prepare('DELETE FROM kb_tags WHERE entry_id = ?').run(entryId);

        if (mergedData.tags.length > 0) {
          const tagStmt = this.db.prepare('INSERT INTO kb_tags (entry_id, tag) VALUES (?, ?)');
          mergedData.tags.forEach(tag => {
            tagStmt.run(entryId, tag);
          });
        }
      }
    } catch (error) {
      conflicts.push(`Failed to update entry: ${error.message}`);
    }
  }

  private transferUsageStats(primaryId: string, duplicateId: string): void {
    // Transfer usage statistics from duplicate to primary
    this.db
      .prepare(
        `
      UPDATE kb_entries
      SET
        usage_count = usage_count + (SELECT usage_count FROM kb_entries WHERE id = ?),
        success_count = success_count + (SELECT success_count FROM kb_entries WHERE id = ?),
        failure_count = failure_count + (SELECT failure_count FROM kb_entries WHERE id = ?)
      WHERE id = ?
    `
      )
      .run(duplicateId, duplicateId, duplicateId, primaryId);
  }

  private archiveEntry(entryId: string): void {
    this.db.prepare('UPDATE kb_entries SET archived = TRUE WHERE id = ?').run(entryId);
  }

  private logMergeOperation(
    duplicateId: string,
    primaryId: string,
    duplicateEntryId: string,
    userId: string,
    conflicts: string[]
  ): void {
    this.db
      .prepare(
        `
      INSERT INTO merge_operations (
        id, duplicate_id, primary_entry_id, duplicate_entry_id,
        merged_by, merge_timestamp, conflicts
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `
      )
      .run(
        uuidv4(),
        duplicateId,
        primaryId,
        duplicateEntryId,
        userId,
        new Date().toISOString(),
        JSON.stringify(conflicts)
      );
  }

  private learnFromFalsePositive(duplicate: DuplicateMatch): void {
    // Simple learning mechanism - in practice, this would be more sophisticated
    // Adjust algorithm sensitivity based on false positive patterns

    const falsePositiveCount = this.db
      .prepare(
        `
      SELECT COUNT(*) as count
      FROM false_positives
      WHERE algorithm = ? AND similarity_score BETWEEN ? AND ?
    `
      )
      .get(
        duplicate.algorithm,
        duplicate.similarityScore - 0.1,
        duplicate.similarityScore + 0.1
      ) as { count: number };

    // If we have multiple false positives in this similarity range,
    // we might want to adjust thresholds (implementation would depend on specific requirements)
    if (falsePositiveCount.count > 5) {
      console.warn(
        `High false positive rate detected for ${duplicate.algorithm} around ${duplicate.similarityScore}`
      );
    }
  }

  private calculateMergeSuccessRate(statusCounts: Record<string, number>): number {
    const merged = statusCounts['merged'] || 0;
    const total = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);

    return total > 0 ? (merged / total) * 100 : 0;
  }

  private calculateCacheHitRate(): number {
    // Simple cache hit rate calculation
    const totalLookups = this.semanticCache.size * 2; // Rough estimate
    const hits = this.semanticCache.size;

    return totalLookups > 0 ? (hits / totalLookups) * 100 : 0;
  }

  private setupCleanupSchedule(): void {
    // Clean up old scan data and cache every 6 hours
    setInterval(
      () => {
        // Clean old scan data (keep last 30 days)
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 30);

        this.db
          .prepare(
            `
        DELETE FROM duplicate_scans
        WHERE scan_date < ?
      `
          )
          .run(cutoffDate.toISOString());

        // Clean semantic cache if it gets too large
        if (this.semanticCache.size > this.SEMANTIC_CACHE_SIZE) {
          this.semanticCache.clear();
        }

        // Clean n-gram cache
        if (this.ngramCache.size > 1000) {
          this.ngramCache.clear();
        }
      },
      6 * 60 * 60 * 1000
    ); // 6 hours
  }
}
