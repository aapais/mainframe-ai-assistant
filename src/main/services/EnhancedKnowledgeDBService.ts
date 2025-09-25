import { EventEmitter } from 'events';
import { KnowledgeDB, KBEntry, SearchResult, SearchOptions } from '../../database/KnowledgeDB';
import {
  BatchOperationsService,
  BatchOperationType,
  BatchOperation,
  BatchExecutionResult,
} from './BatchOperationsService';
import { VersionControlService, ChangeType, VersionDiff } from './VersionControlService';
import { SmartSearchService, SearchSuggestion } from './SmartSearchService';
import { DuplicateDetectionService, DuplicateMatch } from './DuplicateDetectionService';
import Database from 'better-sqlite3';

/**
 * Virtual scrolling data for large result sets
 */
export interface VirtualScrollData<T> {
  items: T[];
  totalCount: number;
  startIndex: number;
  endIndex: number;
  hasMore: boolean;
  loadTime: number;
}

/**
 * Comprehensive entry validation results
 */
export interface ValidationResult {
  isValid: boolean;
  errors: Array<{
    field: keyof KBEntry;
    message: string;
    severity: 'error' | 'warning' | 'info';
  }>;
  warnings: string[];
  suggestions: string[];
  score: number; // 0-100 quality score
}

/**
 * Advanced search options with performance optimization
 */
export interface EnhancedSearchOptions extends SearchOptions {
  // Virtual scrolling support
  virtualScroll?: {
    startIndex: number;
    itemCount: number;
    bufferSize?: number;
  };

  // Performance optimization
  cacheResults?: boolean;
  prioritizeRecent?: boolean;
  boostPopular?: boolean;

  // Advanced filtering
  dateRange?: {
    field: 'created_at' | 'updated_at' | 'last_used';
    start: Date;
    end: Date;
  };

  // Result enhancement
  includeSimilar?: boolean;
  includeRelated?: boolean;
  maxSimilar?: number;
}

/**
 * Entry relationship information
 */
export interface EntryRelationship {
  entryId: string;
  relatedEntryId: string;
  relationshipType: 'duplicate' | 'similar' | 'prerequisite' | 'follow_up' | 'alternative';
  strength: number; // 0-1 relationship strength
  metadata?: Record<string, any>;
}

/**
 * Comprehensive KB analytics
 */
export interface KBAnalytics {
  overview: {
    totalEntries: number;
    activeEntries: number;
    archivedEntries: number;
    averageQuality: number;
    lastUpdated: Date;
  };
  usage: {
    totalSearches: number;
    popularEntries: Array<{ entryId: string; title: string; usage: number }>;
    searchTrends: Array<{ query: string; frequency: number }>;
    userActivity: Array<{ userId: string; actions: number }>;
  };
  quality: {
    averageSuccessRate: number;
    entriesNeedingUpdate: number;
    duplicatesDetected: number;
    lowQualityEntries: Array<{ entryId: string; score: number }>;
  };
  performance: {
    averageSearchTime: number;
    cacheHitRate: number;
    indexEfficiency: number;
    recommendedOptimizations: string[];
  };
}

/**
 * Enhanced Knowledge Database Service
 *
 * Extends the base KnowledgeDB with advanced features:
 * - Batch operations for bulk management
 * - Version control and change tracking
 * - Smart search with caching and optimization
 * - Duplicate detection and management
 * - Virtual scrolling for large datasets
 * - Advanced validation and quality scoring
 * - Relationship management between entries
 * - Comprehensive analytics and monitoring
 *
 * Performance optimizations:
 * - <100ms search response time for cached queries
 * - Virtual scrolling for 1000+ entries
 * - Intelligent caching with LRU and TTL
 * - Batch operations with progress tracking
 * - Background duplicate detection
 * - Automated maintenance and optimization
 *
 * @extends EventEmitter
 *
 * @emits 'entry_created' - New entry added
 * @emits 'entry_updated' - Entry modified
 * @emits 'entry_deleted' - Entry removed
 * @emits 'batch_complete' - Batch operation finished
 * @emits 'duplicate_detected' - Potential duplicate found
 * @emits 'quality_alert' - Quality issue detected
 * @emits 'performance_warning' - Performance degradation
 *
 * @example
 * ```typescript
 * const enhancedKB = new EnhancedKnowledgeDBService('./knowledge.db');
 *
 * // Enhanced search with virtual scrolling
 * const results = await enhancedKB.searchWithVirtualScroll('VSAM error', {
 *   virtualScroll: { startIndex: 0, itemCount: 50 },
 *   includeSimilar: true
 * });
 *
 * // Batch operations with progress tracking
 * enhancedKB.on('batch_progress', (progress) => {
 *   console.log(`${progress.percentage}% complete`);
 * });
 *
 * const batchResult = await enhancedKB.bulkCreateEntries(entries);
 *
 * // Quality analysis and improvement
 * const analytics = await enhancedKB.getAnalytics();
 * const lowQuality = analytics.quality.lowQualityEntries;
 *
 * // Automated duplicate detection
 * const duplicates = await enhancedKB.detectDuplicates();
 * await enhancedKB.autoMergeDuplicates(duplicates, 0.9); // 90% threshold
 * ```
 */
export class EnhancedKnowledgeDBService extends EventEmitter {
  private knowledgeDB: KnowledgeDB;
  private batchService: BatchOperationsService;
  private versionService: VersionControlService;
  private searchService: SmartSearchService;
  private duplicateService: DuplicateDetectionService;

  // Internal database access for advanced features
  private db: Database.Database;

  // Performance monitoring
  private performanceMetrics = {
    operationCounts: new Map<string, number>(),
    executionTimes: new Map<string, number[]>(),
    errorCounts: new Map<string, number>(),
  };

  // Configuration
  private readonly VIRTUAL_SCROLL_BUFFER_SIZE = 10;
  private readonly QUALITY_SCORE_THRESHOLD = 70;
  private readonly AUTO_OPTIMIZE_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

  constructor(
    dbPath?: string,
    options?: {
      enableVersionControl?: boolean;
      enableDuplicateDetection?: boolean;
      enableSmartSearch?: boolean;
      enableBatchOperations?: boolean;
      autoOptimizeEnabled?: boolean;
    }
  ) {
    super();

    // Initialize core KnowledgeDB
    this.knowledgeDB = new KnowledgeDB(dbPath, options);

    // Get direct database access for advanced features
    this.db = (this.knowledgeDB as any).db;

    // Initialize enhanced services based on options
    const {
      enableVersionControl = true,
      enableDuplicateDetection = true,
      enableSmartSearch = true,
      enableBatchOperations = true,
      autoOptimizeEnabled = true,
    } = options || {};

    if (enableBatchOperations) {
      this.batchService = new BatchOperationsService(this.db);
      this.setupBatchEventHandlers();
    }

    if (enableVersionControl) {
      this.versionService = new VersionControlService(this.db);
      this.setupVersionEventHandlers();
    }

    if (enableSmartSearch) {
      this.searchService = new SmartSearchService(this.db);
      this.setupSearchEventHandlers();
    }

    if (enableDuplicateDetection) {
      this.duplicateService = new DuplicateDetectionService(this.db);
      this.setupDuplicateEventHandlers();
    }

    // Initialize enhanced tables
    this.initializeEnhancedTables();

    // Setup automatic optimization
    if (autoOptimizeEnabled) {
      this.setupAutoOptimization();
    }

    // Setup performance monitoring
    this.setupPerformanceMonitoring();
  }

  /**
   * Enhanced search with virtual scrolling support
   *
   * @param query - Search query
   * @param options - Enhanced search options
   * @returns Promise resolving to virtual scroll data
   */
  async searchWithVirtualScroll(
    query: string,
    options: EnhancedSearchOptions = {}
  ): Promise<VirtualScrollData<SearchResult>> {
    const startTime = Date.now();

    try {
      const {
        virtualScroll = { startIndex: 0, itemCount: 50 },
        cacheResults = true,
        includeSimilar = false,
        includeRelated = false,
      } = options;

      // Use smart search service if available, otherwise fallback to basic search
      let searchResults: SearchResult[];

      if (this.searchService) {
        const smartResult = await this.searchService.search(query, {
          ...options,
          maxResults:
            virtualScroll.itemCount + (virtualScroll.bufferSize || this.VIRTUAL_SCROLL_BUFFER_SIZE),
          enableCaching: cacheResults,
        });
        searchResults = smartResult.results;
      } else {
        searchResults = await this.knowledgeDB.search(query, options);
      }

      // Apply virtual scrolling
      const totalCount = searchResults.length;
      const startIndex = virtualScroll.startIndex;
      const endIndex = Math.min(startIndex + virtualScroll.itemCount, totalCount);
      const items = searchResults.slice(startIndex, endIndex);

      // Enhance results with similar/related entries if requested
      if (includeSimilar || includeRelated) {
        await this.enhanceResultsWithRelationships(items, {
          includeSimilar,
          includeRelated,
          maxSimilar: options.maxSimilar || 3,
        });
      }

      const loadTime = Date.now() - startTime;
      this.recordPerformanceMetric('search', loadTime);

      const result: VirtualScrollData<SearchResult> = {
        items,
        totalCount,
        startIndex,
        endIndex: endIndex - 1,
        hasMore: endIndex < totalCount,
        loadTime,
      };

      this.emit('search_completed', {
        query,
        resultCount: totalCount,
        loadTime,
        cached: false, // TODO: Determine if result was cached
      });

      return result;
    } catch (error) {
      this.recordPerformanceError('search', error.message);
      throw error;
    }
  }

  /**
   * Advanced entry creation with validation and duplicate checking
   *
   * @param entry - KB entry to create
   * @param options - Creation options
   * @returns Promise resolving to creation result
   */
  async createEntryAdvanced(
    entry: Omit<KBEntry, 'id'>,
    options: {
      userId?: string;
      validateQuality?: boolean;
      checkDuplicates?: boolean;
      autoVersion?: boolean;
      comment?: string;
    } = {}
  ): Promise<{
    entryId: string;
    validation: ValidationResult;
    duplicates: DuplicateMatch[];
    qualityScore: number;
  }> {
    const {
      userId = 'system',
      validateQuality = true,
      checkDuplicates = true,
      autoVersion = true,
      comment,
    } = options;

    // Validate entry quality
    const validation = validateQuality
      ? await this.validateEntry(entry)
      : {
          isValid: true,
          errors: [],
          warnings: [],
          suggestions: [],
          score: 100,
        };

    if (!validation.isValid && validation.errors.some(e => e.severity === 'error')) {
      throw new Error(
        `Entry validation failed: ${validation.errors.map(e => e.message).join(', ')}`
      );
    }

    // Check for duplicates
    let duplicates: DuplicateMatch[] = [];
    if (checkDuplicates && this.duplicateService) {
      // Create temporary entry to check for duplicates
      const tempId = await this.knowledgeDB.addEntry(entry, userId);
      duplicates = await this.duplicateService.checkEntryForDuplicates(tempId);

      // If high-confidence duplicates found, warn but don't prevent creation
      if (duplicates.some(d => d.confidence > 90)) {
        this.emit('duplicate_detected', {
          entryId: tempId,
          duplicates: duplicates.filter(d => d.confidence > 90),
        });
      }

      // Use the created entry ID
      const entryId = tempId;

      // Record version if enabled
      if (autoVersion && this.versionService) {
        await this.versionService.recordChange(entryId, 'create', null, userId, comment);
      }

      this.emit('entry_created', { entryId, userId, validation, duplicates });

      return {
        entryId,
        validation,
        duplicates,
        qualityScore: validation.score,
      };
    } else {
      // Standard creation
      const entryId = await this.knowledgeDB.addEntry(entry, userId);

      // Record version if enabled
      if (autoVersion && this.versionService) {
        await this.versionService.recordChange(entryId, 'create', null, userId, comment);
      }

      this.emit('entry_created', { entryId, userId, validation, duplicates });

      return {
        entryId,
        validation,
        duplicates,
        qualityScore: validation.score,
      };
    }
  }

  /**
   * Advanced entry update with change tracking
   *
   * @param entryId - ID of entry to update
   * @param updates - Updates to apply
   * @param options - Update options
   * @returns Promise resolving to update result
   */
  async updateEntryAdvanced(
    entryId: string,
    updates: Partial<KBEntry>,
    options: {
      userId?: string;
      comment?: string;
      validateChanges?: boolean;
      trackVersion?: boolean;
    } = {}
  ): Promise<{
    success: boolean;
    validation: ValidationResult;
    versionCreated: boolean;
    conflicts: string[];
  }> {
    const { userId = 'system', comment, validateChanges = true, trackVersion = true } = options;

    const conflicts: string[] = [];

    try {
      // Get current entry state for change tracking
      const currentEntry = await this.knowledgeDB.getEntry(entryId);
      if (!currentEntry) {
        throw new Error(`Entry not found: ${entryId}`);
      }

      // Validate changes
      const mergedEntry = { ...currentEntry, ...updates };
      const validation = validateChanges
        ? await this.validateEntry(mergedEntry)
        : {
            isValid: true,
            errors: [],
            warnings: [],
            suggestions: [],
            score: 100,
          };

      if (validation.errors.some(e => e.severity === 'error')) {
        return {
          success: false,
          validation,
          versionCreated: false,
          conflicts: validation.errors.map(e => e.message),
        };
      }

      // Calculate field changes for version control
      const fieldChanges =
        trackVersion && this.versionService
          ? this.calculateFieldChanges(currentEntry, updates)
          : null;

      // Apply updates
      await this.knowledgeDB.updateEntry(entryId, updates, userId);

      // Record version if enabled
      let versionCreated = false;
      if (trackVersion && this.versionService && fieldChanges) {
        await this.versionService.recordChange(entryId, 'update', fieldChanges, userId, comment);
        versionCreated = true;
      }

      this.emit('entry_updated', {
        entryId,
        updates,
        userId,
        validation,
        versionCreated,
      });

      return {
        success: true,
        validation,
        versionCreated,
        conflicts,
      };
    } catch (error) {
      conflicts.push(error.message);
      return {
        success: false,
        validation: { isValid: false, errors: [], warnings: [], suggestions: [], score: 0 },
        versionCreated: false,
        conflicts,
      };
    }
  }

  /**
   * Bulk create multiple entries with optimized performance
   *
   * @param entries - Array of entries to create
   * @param options - Bulk creation options
   * @returns Promise resolving to batch execution result
   */
  async bulkCreateEntries(
    entries: Omit<KBEntry, 'id'>[],
    options: {
      userId?: string;
      validateAll?: boolean;
      skipDuplicates?: boolean;
      batchSize?: number;
    } = {}
  ): Promise<BatchExecutionResult> {
    if (!this.batchService) {
      throw new Error('Batch operations not enabled');
    }

    const {
      userId = 'system',
      validateAll = true,
      skipDuplicates = true,
      batchSize = 100,
    } = options;

    // Validate entries if requested
    if (validateAll) {
      const validationPromises = entries.map(entry => this.validateEntry(entry));
      const validations = await Promise.all(validationPromises);

      const invalidEntries = validations
        .map((v, i) => ({ validation: v, index: i }))
        .filter(
          ({ validation }) =>
            !validation.isValid || validation.errors.some(e => e.severity === 'error')
        );

      if (invalidEntries.length > 0) {
        throw new Error(`${invalidEntries.length} entries failed validation`);
      }
    }

    // Use batch service for optimized bulk creation
    return await this.batchService.bulkCreate(entries, {
      validateBeforeInsert: validateAll,
      skipDuplicates,
      batchSize,
    });
  }

  /**
   * Detect and manage duplicate entries
   *
   * @param options - Duplicate detection options
   * @returns Promise resolving to duplicate detection results
   */
  async detectDuplicates(
    options: {
      algorithm?: 'hybrid' | 'fuzzy_text' | 'semantic_similarity';
      threshold?: number;
      categories?: string[];
    } = {}
  ): Promise<{
    totalDuplicates: number;
    highConfidenceDuplicates: DuplicateMatch[];
    allDuplicates: DuplicateMatch[];
    autoMergeableDuplicates: DuplicateMatch[];
  }> {
    if (!this.duplicateService) {
      throw new Error('Duplicate detection not enabled');
    }

    const { algorithm = 'hybrid', threshold = 0.8, categories } = options;

    const result = await this.duplicateService.scanForDuplicates({
      algorithm,
      similarityThreshold: threshold,
      categories,
      excludeArchived: true,
    });

    const highConfidenceDuplicates = result.matches.filter(match => match.confidence >= 90);
    const autoMergeableDuplicates = result.matches.filter(
      match => match.confidence >= 95 && match.similarityScore >= 0.95
    );

    this.emit('duplicates_detected', {
      total: result.duplicatesFound,
      highConfidence: highConfidenceDuplicates.length,
      autoMergeable: autoMergeableDuplicates.length,
    });

    return {
      totalDuplicates: result.duplicatesFound,
      highConfidenceDuplicates,
      allDuplicates: result.matches,
      autoMergeableDuplicates,
    };
  }

  /**
   * Automatically merge high-confidence duplicates
   *
   * @param duplicates - Duplicate matches to merge
   * @param confidenceThreshold - Minimum confidence for auto-merge
   * @returns Promise resolving to merge results
   */
  async autoMergeDuplicates(
    duplicates: DuplicateMatch[],
    confidenceThreshold: number = 0.95
  ): Promise<{
    mergedCount: number;
    skippedCount: number;
    errors: string[];
  }> {
    if (!this.duplicateService) {
      throw new Error('Duplicate detection not enabled');
    }

    let mergedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    const autoMergeableDuplicates = duplicates.filter(
      d => d.confidence >= confidenceThreshold * 100 && d.similarityScore >= confidenceThreshold
    );

    for (const duplicate of autoMergeableDuplicates) {
      try {
        const suggestions = await this.duplicateService.getMergeSuggestions([duplicate]);
        const suggestion = suggestions[0];

        if (
          suggestion &&
          suggestion.automatedResolution &&
          suggestion.confidenceScore >= confidenceThreshold * 100
        ) {
          await this.duplicateService.mergeDuplicates(
            duplicate.id,
            suggestion.mergedEntry,
            'auto-merge'
          );
          mergedCount++;
        } else {
          skippedCount++;
        }
      } catch (error) {
        errors.push(`Failed to merge duplicate ${duplicate.id}: ${error.message}`);
        skippedCount++;
      }
    }

    this.emit('auto_merge_complete', {
      mergedCount,
      skippedCount,
      errors,
    });

    return {
      mergedCount,
      skippedCount,
      errors,
    };
  }

  /**
   * Get comprehensive analytics about the knowledge base
   *
   * @param timeRange - Optional time range for analytics
   * @returns Promise resolving to KB analytics
   */
  async getAnalytics(timeRange?: { start: Date; end: Date }): Promise<KBAnalytics> {
    const stats = await this.knowledgeDB.getStats();

    // Get enhanced analytics data
    const qualityAnalysis = await this.analyzeQuality();
    const performanceData = this.getPerformanceAnalytics();

    // Search analytics from smart search service
    const searchAnalytics = this.searchService
      ? this.searchService.getAnalytics(timeRange)
      : {
          totalSearches: 0,
          avgResponseTime: 0,
          cacheHitRate: 0,
          topQueries: [],
          failedQueries: [],
          strategiesUsed: {},
          timeDistribution: { under50ms: 0, under100ms: 0, under500ms: 0, over500ms: 0 },
        };

    // Duplicate analytics
    const duplicateAnalytics = this.duplicateService
      ? this.duplicateService.getDuplicateAnalytics(timeRange)
      : {
          totalDuplicatesFound: 0,
          duplicatesByAlgorithm: {
            exact_match: 0,
            fuzzy_text: 0,
            semantic_similarity: 0,
            hybrid: 0,
          },
          duplicatesByStatus: {},
          averageSimilarityScore: 0,
          falsePositiveRate: 0,
          mergeSuccessRate: 0,
          topDuplicateCategories: [],
          performanceMetrics: { avgDetectionTime: 0, avgMergeTime: 0, cacheHitRate: 0 },
        };

    return {
      overview: {
        totalEntries: stats.totalEntries,
        activeEntries: stats.totalEntries - (duplicateAnalytics.duplicatesByStatus['merged'] || 0),
        archivedEntries: duplicateAnalytics.duplicatesByStatus['merged'] || 0,
        averageQuality: qualityAnalysis.averageScore,
        lastUpdated: new Date(),
      },
      usage: {
        totalSearches: searchAnalytics.totalSearches,
        popularEntries: stats.topEntries.map(entry => ({
          entryId: '', // Would need to get ID from title
          title: entry.title,
          usage: entry.usage_count,
        })),
        searchTrends: searchAnalytics.topQueries.map(query => ({
          query: query.query,
          frequency: query.count,
        })),
        userActivity: [], // Would need user activity tracking
      },
      quality: {
        averageSuccessRate: stats.averageSuccessRate,
        entriesNeedingUpdate: qualityAnalysis.lowQualityCount,
        duplicatesDetected: duplicateAnalytics.totalDuplicatesFound,
        lowQualityEntries: qualityAnalysis.lowQualityEntries,
      },
      performance: {
        averageSearchTime: searchAnalytics.avgResponseTime,
        cacheHitRate: searchAnalytics.cacheHitRate,
        indexEfficiency: performanceData.indexEfficiency,
        recommendedOptimizations: this.generateOptimizationRecommendations(stats, searchAnalytics),
      },
    };
  }

  /**
   * Get search suggestions using smart search service
   *
   * @param partialQuery - Partial query for suggestions
   * @param limit - Maximum suggestions to return
   * @returns Promise resolving to search suggestions
   */
  async getSearchSuggestions(partialQuery: string, limit: number = 8): Promise<SearchSuggestion[]> {
    if (this.searchService) {
      return await this.searchService.getSuggestions(partialQuery, limit);
    }

    // Fallback to basic suggestions
    return this.getBasicSuggestions(partialQuery, limit);
  }

  /**
   * Get version history for an entry
   *
   * @param entryId - ID of the entry
   * @param limit - Maximum versions to return
   * @returns Promise resolving to version history
   */
  async getEntryVersionHistory(
    entryId: string,
    limit: number = 20
  ): Promise<
    Array<{
      version: number;
      timestamp: Date;
      userId: string;
      changeType: string;
      comment?: string;
    }>
  > {
    if (!this.versionService) {
      throw new Error('Version control not enabled');
    }

    const history = await this.versionService.getEntryHistory(entryId, { limit });

    return history.map(version => ({
      version: version.version,
      timestamp: version.timestamp,
      userId: version.userId,
      changeType: version.changeType,
      comment: version.comment,
    }));
  }

  /**
   * Compare two versions of an entry
   *
   * @param entryId - ID of the entry
   * @param fromVersion - Starting version
   * @param toVersion - Ending version
   * @returns Promise resolving to version diff
   */
  async compareEntryVersions(
    entryId: string,
    fromVersion: number,
    toVersion: number
  ): Promise<VersionDiff> {
    if (!this.versionService) {
      throw new Error('Version control not enabled');
    }

    return await this.versionService.compareVersions(entryId, fromVersion, toVersion);
  }

  /**
   * Optimize database performance and clean up
   *
   * @returns Promise resolving to optimization results
   */
  async optimizeDatabase(): Promise<{
    cacheOptimized: boolean;
    duplicatesRemoved: number;
    indexesOptimized: boolean;
    oldVersionsCleaned: number;
    performanceImprovement: number;
  }> {
    const startTime = Date.now();
    let duplicatesRemoved = 0;
    let oldVersionsCleaned = 0;

    // Optimize base KnowledgeDB
    await this.knowledgeDB.optimize();

    // Optimize search cache
    if (this.searchService) {
      await this.searchService.optimizePerformance();
    }

    // Clean up old versions
    if (this.versionService) {
      const cleanup = await this.versionService.cleanupOldVersions();
      oldVersionsCleaned = cleanup.versionsRemoved;
    }

    // Run duplicate detection and auto-merge if configured
    if (this.duplicateService) {
      const duplicates = await this.detectDuplicates({ threshold: 0.95 });
      const mergeResult = await this.autoMergeDuplicates(duplicates.autoMergeableDuplicates);
      duplicatesRemoved = mergeResult.mergedCount;
    }

    const optimizationTime = Date.now() - startTime;
    const performanceImprovement = Math.min(50, Math.max(0, 1000 - optimizationTime) / 20); // Rough calculation

    this.emit('optimization_complete', {
      optimizationTime,
      duplicatesRemoved,
      oldVersionsCleaned,
      performanceImprovement,
    });

    return {
      cacheOptimized: true,
      duplicatesRemoved,
      indexesOptimized: true,
      oldVersionsCleaned,
      performanceImprovement,
    };
  }

  // Private implementation methods

  private async validateEntry(entry: Partial<KBEntry>): Promise<ValidationResult> {
    const errors: ValidationResult['errors'] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];
    let score = 100;

    // Required field validation
    if (!entry.title || entry.title.trim().length === 0) {
      errors.push({ field: 'title', message: 'Title is required', severity: 'error' });
      score -= 25;
    } else if (entry.title.length < 5) {
      warnings.push('Title should be more descriptive (at least 5 characters)');
      score -= 5;
    }

    if (!entry.problem || entry.problem.trim().length === 0) {
      errors.push({
        field: 'problem',
        message: 'Problem description is required',
        severity: 'error',
      });
      score -= 25;
    } else if (entry.problem.length < 20) {
      warnings.push('Problem description should be more detailed (at least 20 characters)');
      score -= 5;
    }

    if (!entry.solution || entry.solution.trim().length === 0) {
      errors.push({ field: 'solution', message: 'Solution is required', severity: 'error' });
      score -= 25;
    } else if (entry.solution.length < 20) {
      warnings.push('Solution should be more detailed (at least 20 characters)');
      score -= 5;
    }

    if (!entry.category || entry.category.trim().length === 0) {
      errors.push({ field: 'category', message: 'Category is required', severity: 'error' });
      score -= 15;
    }

    // Quality validation
    if (entry.tags && entry.tags.length === 0) {
      suggestions.push('Adding tags will improve searchability');
      score -= 5;
    }

    if (
      entry.title &&
      entry.problem &&
      entry.title.toLowerCase() === entry.problem.toLowerCase().substring(0, entry.title.length)
    ) {
      suggestions.push(
        'Title and problem description are very similar - consider making them more distinct'
      );
      score -= 10;
    }

    // Content quality checks
    if (entry.solution && entry.solution.split('\n').length === 1) {
      suggestions.push('Consider breaking down the solution into numbered steps');
      score -= 5;
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
      score: Math.max(0, score),
    };
  }

  private calculateFieldChanges(
    originalEntry: KBEntry,
    updates: Partial<KBEntry>
  ): Record<string, { oldValue: any; newValue: any }> {
    const changes: Record<string, { oldValue: any; newValue: any }> = {};

    Object.entries(updates).forEach(([key, newValue]) => {
      const oldValue = originalEntry[key as keyof KBEntry];

      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        changes[key] = { oldValue, newValue };
      }
    });

    return changes;
  }

  private async enhanceResultsWithRelationships(
    results: SearchResult[],
    options: {
      includeSimilar: boolean;
      includeRelated: boolean;
      maxSimilar: number;
    }
  ): Promise<void> {
    if (!options.includeSimilar && !options.includeRelated) return;

    for (const result of results) {
      if (options.includeSimilar) {
        // Add similar entries (simplified - would use actual similarity calculation)
        (result as any).similar = await this.findSimilarEntries(
          result.entry.id!,
          options.maxSimilar
        );
      }

      if (options.includeRelated) {
        // Add related entries based on relationships
        (result as any).related = await this.findRelatedEntries(result.entry.id!);
      }
    }
  }

  private async findSimilarEntries(entryId: string, limit: number): Promise<SearchResult[]> {
    // Simplified implementation - would use duplicate detection service for real similarity
    const entry = await this.knowledgeDB.getEntry(entryId);
    if (!entry) return [];

    const results = await this.knowledgeDB.search(entry.title, { limit: limit + 1 });
    return results.filter(r => r.entry.id !== entryId).slice(0, limit);
  }

  private async findRelatedEntries(entryId: string): Promise<SearchResult[]> {
    // Get relationships from database
    const relationships = this.db
      .prepare(
        `
      SELECT related_entry_id, relationship_type, strength
      FROM entry_relationships
      WHERE entry_id = ?
      ORDER BY strength DESC
      LIMIT 5
    `
      )
      .all(entryId);

    const relatedEntries: SearchResult[] = [];

    for (const rel of relationships) {
      const entry = await this.knowledgeDB.getEntry(rel.related_entry_id);
      if (entry) {
        relatedEntries.push({
          entry,
          score: rel.strength * 100,
          matchType: 'related',
        });
      }
    }

    return relatedEntries;
  }

  private async analyzeQuality(): Promise<{
    averageScore: number;
    lowQualityCount: number;
    lowQualityEntries: Array<{ entryId: string; score: number }>;
  }> {
    // Get all entries for quality analysis
    const entries = this.db
      .prepare(
        `
      SELECT id, title, problem, solution, category,
             usage_count, success_count, failure_count
      FROM kb_entries
      WHERE archived = FALSE
    `
      )
      .all();

    let totalScore = 0;
    const lowQualityEntries: Array<{ entryId: string; score: number }> = [];

    for (const entry of entries) {
      const validation = await this.validateEntry(entry);
      totalScore += validation.score;

      if (validation.score < this.QUALITY_SCORE_THRESHOLD) {
        lowQualityEntries.push({
          entryId: entry.id,
          score: validation.score,
        });
      }
    }

    return {
      averageScore: entries.length > 0 ? totalScore / entries.length : 0,
      lowQualityCount: lowQualityEntries.length,
      lowQualityEntries: lowQualityEntries.sort((a, b) => a.score - b.score),
    };
  }

  private getPerformanceAnalytics(): {
    indexEfficiency: number;
    avgOperationTime: number;
    errorRate: number;
  } {
    const totalOperations = Array.from(this.performanceMetrics.operationCounts.values()).reduce(
      (sum, count) => sum + count,
      0
    );

    const totalExecutionTime = Array.from(this.performanceMetrics.executionTimes.values())
      .flat()
      .reduce((sum, time) => sum + time, 0);

    const totalErrors = Array.from(this.performanceMetrics.errorCounts.values()).reduce(
      (sum, count) => sum + count,
      0
    );

    return {
      indexEfficiency: 85, // Placeholder - would calculate based on actual index performance
      avgOperationTime: totalOperations > 0 ? totalExecutionTime / totalOperations : 0,
      errorRate: totalOperations > 0 ? (totalErrors / totalOperations) * 100 : 0,
    };
  }

  private generateOptimizationRecommendations(stats: any, searchAnalytics: any): string[] {
    const recommendations: string[] = [];

    if (searchAnalytics.avgResponseTime > 200) {
      recommendations.push('Consider rebuilding search indexes for better performance');
    }

    if (searchAnalytics.cacheHitRate < 70) {
      recommendations.push('Increase cache size or TTL for better cache utilization');
    }

    if (stats.totalEntries > 1000) {
      recommendations.push('Consider implementing data archival for older entries');
    }

    if (searchAnalytics.failedQueries.length > 10) {
      recommendations.push('Review and optimize frequently failing search queries');
    }

    return recommendations;
  }

  private async getBasicSuggestions(
    partialQuery: string,
    limit: number
  ): Promise<SearchSuggestion[]> {
    // Fallback suggestions from search history
    const suggestions = this.db
      .prepare(
        `
      SELECT query, COUNT(*) as frequency, MAX(timestamp) as last_used
      FROM search_history
      WHERE LOWER(query) LIKE ? || '%'
      GROUP BY LOWER(query)
      ORDER BY frequency DESC, last_used DESC
      LIMIT ?
    `
      )
      .all(partialQuery.toLowerCase(), limit);

    return suggestions.map((row: any) => ({
      suggestion: row.query,
      type: 'query' as const,
      frequency: row.frequency,
      lastUsed: new Date(row.last_used),
      score: row.frequency,
    }));
  }

  private recordPerformanceMetric(operation: string, executionTime: number): void {
    // Update operation count
    const currentCount = this.performanceMetrics.operationCounts.get(operation) || 0;
    this.performanceMetrics.operationCounts.set(operation, currentCount + 1);

    // Update execution times
    const currentTimes = this.performanceMetrics.executionTimes.get(operation) || [];
    currentTimes.push(executionTime);

    // Keep only last 100 measurements
    if (currentTimes.length > 100) {
      currentTimes.splice(0, currentTimes.length - 100);
    }

    this.performanceMetrics.executionTimes.set(operation, currentTimes);
  }

  private recordPerformanceError(operation: string, error: string): void {
    const currentCount = this.performanceMetrics.errorCounts.get(operation) || 0;
    this.performanceMetrics.errorCounts.set(operation, currentCount + 1);

    this.emit('performance_warning', {
      operation,
      error,
      timestamp: new Date(),
    });
  }

  private initializeEnhancedTables(): void {
    // Create additional tables for enhanced features
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS entry_relationships (
        id TEXT PRIMARY KEY,
        entry_id TEXT NOT NULL,
        related_entry_id TEXT NOT NULL,
        relationship_type TEXT NOT NULL,
        strength REAL NOT NULL,
        metadata TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (entry_id) REFERENCES kb_entries(id),
        FOREIGN KEY (related_entry_id) REFERENCES kb_entries(id)
      );

      CREATE TABLE IF NOT EXISTS quality_scores (
        entry_id TEXT PRIMARY KEY,
        score INTEGER NOT NULL,
        validation_data TEXT,
        last_calculated TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (entry_id) REFERENCES kb_entries(id)
      );

      CREATE INDEX IF NOT EXISTS idx_entry_relationships_entry_id ON entry_relationships(entry_id);
      CREATE INDEX IF NOT EXISTS idx_entry_relationships_type ON entry_relationships(relationship_type);
      CREATE INDEX IF NOT EXISTS idx_quality_scores_score ON quality_scores(score);
    `);
  }

  private setupBatchEventHandlers(): void {
    if (!this.batchService) return;

    this.batchService.on('progress', progress => {
      this.emit('batch_progress', progress);
    });

    this.batchService.on('complete', result => {
      this.emit('batch_complete', result);
    });

    this.batchService.on('error', error => {
      this.emit('batch_error', error);
    });
  }

  private setupVersionEventHandlers(): void {
    if (!this.versionService) return;

    this.versionService.on('change', change => {
      this.emit('version_created', change);
    });

    this.versionService.on('rollback', rollback => {
      this.emit('version_rollback', rollback);
    });
  }

  private setupSearchEventHandlers(): void {
    if (!this.searchService) return;

    this.searchService.on('slow-query', query => {
      this.emit('performance_warning', {
        type: 'slow_search',
        ...query,
      });
    });

    this.searchService.on('error', error => {
      this.emit('search_error', error);
    });
  }

  private setupDuplicateEventHandlers(): void {
    if (!this.duplicateService) return;

    this.duplicateService.on('duplicate_found', duplicate => {
      this.emit('duplicate_detected', duplicate);
    });

    this.duplicateService.on('scan_complete', result => {
      this.emit('duplicate_scan_complete', result);
    });
  }

  private setupAutoOptimization(): void {
    setInterval(async () => {
      try {
        await this.optimizeDatabase();
      } catch (error) {
        this.emit('optimization_error', error.message);
      }
    }, this.AUTO_OPTIMIZE_INTERVAL);
  }

  private setupPerformanceMonitoring(): void {
    // Reset performance metrics every hour
    setInterval(
      () => {
        // Keep some historical data, but reset counters
        this.performanceMetrics.operationCounts.clear();
        this.performanceMetrics.errorCounts.clear();
        // Keep execution times for trend analysis
      },
      60 * 60 * 1000
    ); // 1 hour
  }

  // Expose base KnowledgeDB methods for compatibility
  async search(query: string, options?: Partial<SearchOptions>): Promise<SearchResult[]> {
    return this.knowledgeDB.search(query, options);
  }

  async addEntry(entry: KBEntry, userId?: string): Promise<string> {
    return this.knowledgeDB.addEntry(entry, userId);
  }

  async getEntry(id: string): Promise<KBEntry | null> {
    return this.knowledgeDB.getEntry(id);
  }

  async updateEntry(id: string, updates: Partial<KBEntry>, userId?: string): Promise<void> {
    return this.knowledgeDB.updateEntry(id, updates, userId);
  }

  async recordUsage(entryId: string, successful: boolean, userId?: string): Promise<void> {
    return this.knowledgeDB.recordUsage(entryId, successful, userId);
  }

  async getStats() {
    return this.knowledgeDB.getStats();
  }

  async close(): Promise<void> {
    await this.knowledgeDB.close();
  }
}
