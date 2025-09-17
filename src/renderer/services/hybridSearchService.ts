/**
 * Hybrid Search Service - UC001 Implementation
 * 
 * Combines local and AI search capabilities with progressive enhancement:
 * 1. Local search responds in <500ms
 * 2. AI enhancement requires authorization dialog before ANY API call
 * 3. Progressive enhancement: local results first, then AI enrichment
 * 4. Result merging and deduplication logic
 * 5. Performance monitoring and error handling
 */

import { SearchService, SearchQuery, SearchResponse } from './api/SearchService';
import { AIAuthorizationService, AIOperation, AuthorizationResult } from '../../main/services/AIAuthorizationService';
import { SearchResult, KBCategory } from '../../types/services';
import { AIOperationType } from '../../types/authorization.types';

export interface HybridSearchOptions {
  enableAI?: boolean;
  maxLocalResults?: number;
  maxAIResults?: number;
  enableMerging?: boolean;
  prioritizeLocal?: boolean;
  timeoutMs?: number;
}

export interface HybridSearchResult {
  localResults: SearchResult[];
  aiResults: SearchResult[];
  mergedResults: SearchResult[];
  performance: {
    localSearchTime: number;
    aiSearchTime?: number;
    totalTime: number;
    localCompleted: boolean;
    aiCompleted: boolean;
    authorizationRequired: boolean;
  };
  metadata: {
    localResultCount: number;
    aiResultCount: number;
    mergedResultCount: number;
    duplicatesRemoved: number;
    authorizationStatus?: 'approved' | 'denied' | 'pending' | 'not_required';
    errorMessages?: string[];
  };
}

export interface SearchAuthorizationContext {
  query: string;
  operationType: AIOperationType;
  dataContext?: {
    containsPII: boolean;
    isConfidential: boolean;
    dataTypes: string[];
    dataFields: Array<{
      name: string;
      type: string;
      sensitivity: 'public' | 'internal' | 'confidential' | 'restricted';
    }>;
  };
  sessionId?: string;
  userId?: string;
}

export class HybridSearchService {
  private searchService: SearchService;
  private authService: AIAuthorizationService | null = null;
  private performanceThresholds = {
    localSearchMaxTime: 500, // UC001 requirement: <500ms
    aiSearchMaxTime: 10000,
    totalMaxTime: 15000
  };

  constructor() {
    this.searchService = new SearchService();
    this.initializeAIAuthorization();
  }

  /**
   * Initialize AI Authorization Service if available
   */
  private async initializeAIAuthorization(): Promise<void> {
    try {
      // In Electron environment, get service through IPC
      if (window.electronAPI?.getAIAuthorizationService) {
        this.authService = await window.electronAPI.getAIAuthorizationService();
      }
    } catch (error) {
      console.warn('AI Authorization Service not available:', error);
    }
  }

  /**
   * Main hybrid search method implementing UC001 requirements
   */
  async search(
    query: string,
    category?: KBCategory,
    options: HybridSearchOptions = {}
  ): Promise<HybridSearchResult> {
    const startTime = Date.now();
    const searchOptions = {
      enableAI: true,
      maxLocalResults: 50,
      maxAIResults: 20,
      enableMerging: true,
      prioritizeLocal: true,
      timeoutMs: this.performanceThresholds.totalMaxTime,
      ...options
    };

    const result: HybridSearchResult = {
      localResults: [],
      aiResults: [],
      mergedResults: [],
      performance: {
        localSearchTime: 0,
        totalTime: 0,
        localCompleted: false,
        aiCompleted: false,
        authorizationRequired: false
      },
      metadata: {
        localResultCount: 0,
        aiResultCount: 0,
        mergedResultCount: 0,
        duplicatesRemoved: 0,
        errorMessages: []
      }
    };

    try {
      // Step 1: Always start with local search (UC001 requirement)
      const localSearchPromise = this.performLocalSearch(query, category, searchOptions);
      
      // Step 2: Run local search first and ensure it completes within 500ms
      const localStartTime = Date.now();
      const localSearchResult = await Promise.race([
        localSearchPromise,
        new Promise<SearchResponse>((_, reject) => 
          setTimeout(() => reject(new Error('Local search timeout')), this.performanceThresholds.localSearchMaxTime)
        )
      ]);

      result.performance.localSearchTime = Date.now() - localStartTime;
      result.performance.localCompleted = true;
      
      if (localSearchResult.success && localSearchResult.data) {
        result.localResults = localSearchResult.data.results;
        result.metadata.localResultCount = result.localResults.length;
      }

      // Step 3: Progressive enhancement - add AI search if enabled and authorized
      if (searchOptions.enableAI && this.shouldEnhanceWithAI(result.localResults, query)) {
        const aiEnhancementResult = await this.performAIEnhancement(
          query, 
          category, 
          result.localResults,
          searchOptions
        );
        
        result.aiResults = aiEnhancementResult.results;
        result.performance.aiSearchTime = aiEnhancementResult.searchTime;
        result.performance.aiCompleted = aiEnhancementResult.completed;
        result.performance.authorizationRequired = aiEnhancementResult.authorizationRequired;
        result.metadata.aiResultCount = result.aiResults.length;
        result.metadata.authorizationStatus = aiEnhancementResult.authorizationStatus;
        
        if (aiEnhancementResult.errorMessage) {
          result.metadata.errorMessages?.push(aiEnhancementResult.errorMessage);
        }
      }

      // Step 4: Merge and deduplicate results if enabled
      if (searchOptions.enableMerging) {
        const mergeResult = this.mergeAndDeduplicateResults(
          result.localResults,
          result.aiResults,
          searchOptions.prioritizeLocal
        );
        
        result.mergedResults = mergeResult.results;
        result.metadata.duplicatesRemoved = mergeResult.duplicatesRemoved;
        result.metadata.mergedResultCount = result.mergedResults.length;
      } else {
        // If merging disabled, prioritize local results
        result.mergedResults = searchOptions.prioritizeLocal ? 
          [...result.localResults, ...result.aiResults] :
          [...result.aiResults, ...result.localResults];
        result.metadata.mergedResultCount = result.mergedResults.length;
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result.metadata.errorMessages?.push(errorMessage);
      console.error('Hybrid search error:', error);
      
      // Fallback to local results only
      result.mergedResults = result.localResults;
      result.metadata.mergedResultCount = result.localResults.length;
    }

    result.performance.totalTime = Date.now() - startTime;
    return result;
  }

  /**
   * Perform local search with performance monitoring
   */
  private async performLocalSearch(
    query: string,
    category?: KBCategory,
    options: HybridSearchOptions = {}
  ): Promise<any> {
    const searchQuery: SearchQuery = {
      query,
      category,
      useAI: false // Force local-only search
    };

    return await this.searchService.search(searchQuery, {
      pageSize: options.maxLocalResults || 50,
      timeout: this.performanceThresholds.localSearchMaxTime
    });
  }

  /**
   * Determine if AI enhancement should be performed
   */
  private shouldEnhanceWithAI(localResults: SearchResult[], query: string): boolean {
    // Enhance with AI if:
    // 1. Local results are insufficient (< 5 results)
    // 2. Query indicates complex search intent
    // 3. Query contains error codes or technical terms
    
    if (localResults.length < 5) {
      return true;
    }

    // Check for complex queries that benefit from AI
    const complexIndicators = [
      /how\s+to|why\s+does|what\s+causes/i,
      /s0c[0-9]|u[0-9]{4}|ief[0-9]{3}/i, // Error codes
      /explain|analyze|troubleshoot|debug/i,
      /best\s+practice|recommend|suggest/i
    ];

    return complexIndicators.some(pattern => pattern.test(query));
  }

  /**
   * Perform AI enhancement with authorization flow
   */
  private async performAIEnhancement(
    query: string,
    category?: KBCategory,
    localResults: SearchResult[] = [],
    options: HybridSearchOptions = {}
  ): Promise<{
    results: SearchResult[];
    searchTime: number;
    completed: boolean;
    authorizationRequired: boolean;
    authorizationStatus?: 'approved' | 'denied' | 'pending' | 'not_required';
    errorMessage?: string;
  }> {
    const startTime = Date.now();
    
    try {
      // Step 1: Check if authorization is required (UC001 requirement)
      const authContext = this.createAuthorizationContext(query, category);
      const authResult = await this.requestAIAuthorization(authContext);
      
      if (!authResult.authorized) {
        return {
          results: [],
          searchTime: Date.now() - startTime,
          completed: false,
          authorizationRequired: true,
          authorizationStatus: 'denied',
          errorMessage: 'AI search not authorized'
        };
      }

      // Step 2: Perform AI search if authorized
      const searchQuery: SearchQuery = {
        query,
        category,
        useAI: true
      };

      const aiSearchResult = await this.searchService.search(searchQuery, {
        pageSize: options.maxAIResults || 20,
        timeout: this.performanceThresholds.aiSearchMaxTime
      });

      if (aiSearchResult.success && aiSearchResult.data) {
        return {
          results: aiSearchResult.data.results,
          searchTime: Date.now() - startTime,
          completed: true,
          authorizationRequired: true,
          authorizationStatus: 'approved'
        };
      } else {
        return {
          results: [],
          searchTime: Date.now() - startTime,
          completed: false,
          authorizationRequired: true,
          authorizationStatus: 'approved',
          errorMessage: 'AI search failed: ' + (aiSearchResult.error || 'Unknown error')
        };
      }

    } catch (error) {
      return {
        results: [],
        searchTime: Date.now() - startTime,
        completed: false,
        authorizationRequired: true,
        authorizationStatus: 'denied',
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Create authorization context for AI operations
   */
  private createAuthorizationContext(query: string, category?: KBCategory): SearchAuthorizationContext {
    // Analyze query for PII and sensitivity
    const containsPII = this.detectPII(query);
    const isConfidential = this.detectConfidentialData(query);
    
    return {
      query,
      operationType: 'semantic_search',
      dataContext: {
        containsPII,
        isConfidential,
        dataTypes: [category || 'general', 'search_query'],
        dataFields: [
          {
            name: 'search_query',
            type: 'string',
            sensitivity: isConfidential ? 'confidential' : containsPII ? 'internal' : 'public'
          }
        ]
      },
      sessionId: this.generateSessionId(),
      userId: 'current_user' // Should be replaced with actual user ID
    };
  }

  /**
   * Request AI authorization through the authorization service
   */
  private async requestAIAuthorization(context: SearchAuthorizationContext): Promise<AuthorizationResult> {
    if (!this.authService) {
      // Fallback: require explicit user approval for any AI operation
      return {
        authorized: false,
        action: 'ask_always',
        requestId: this.generateRequestId(),
        autoApproved: false,
        reason: 'Authorization service not available'
      };
    }

    const operation: AIOperation = {
      type: context.operationType,
      query: context.query,
      dataContext: context.dataContext!,
      priority: 'medium',
      sessionId: context.sessionId,
      userId: context.userId
    };

    try {
      return await this.authService.requestAuthorization(operation);
    } catch (error) {
      console.error('Authorization request failed:', error);
      return {
        authorized: false,
        action: 'deny',
        requestId: this.generateRequestId(),
        autoApproved: false,
        reason: 'Authorization request failed'
      };
    }
  }

  /**
   * Merge and deduplicate search results from local and AI sources
   */
  private mergeAndDeduplicateResults(
    localResults: SearchResult[],
    aiResults: SearchResult[],
    prioritizeLocal: boolean = true
  ): { results: SearchResult[]; duplicatesRemoved: number } {
    const seenIds = new Set<string>();
    const seenTitles = new Set<string>();
    const mergedResults: SearchResult[] = [];
    let duplicatesRemoved = 0;

    // Define result sources in priority order
    const sources = prioritizeLocal ? 
      [{ results: localResults, source: 'local' }, { results: aiResults, source: 'ai' }] :
      [{ results: aiResults, source: 'ai' }, { results: localResults, source: 'local' }];

    for (const { results, source } of sources) {
      for (const result of results) {
        const id = result.entry.id;
        const title = result.entry.title.trim().toLowerCase();
        
        // Check for exact ID match
        if (seenIds.has(id)) {
          duplicatesRemoved++;
          continue;
        }
        
        // Check for similar titles (fuzzy deduplication)
        if (seenTitles.has(title)) {
          duplicatesRemoved++;
          continue;
        }

        // Add to results
        seenIds.add(id);
        seenTitles.add(title);
        
        // Add source metadata
        const enhancedResult = {
          ...result,
          metadata: {
            ...result.metadata,
            source,
            hybridRank: mergedResults.length + 1
          }
        };
        
        mergedResults.push(enhancedResult);
      }
    }

    return { results: mergedResults, duplicatesRemoved };
  }

  /**
   * Detect potential PII in search query
   */
  private detectPII(query: string): boolean {
    const piiPatterns = [
      /\b\d{3}-\d{2}-\d{4}\b/, // SSN
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email
      /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, // Credit card
      /\b\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/ // Phone number
    ];
    
    return piiPatterns.some(pattern => pattern.test(query));
  }

  /**
   * Detect confidential data patterns
   */
  private detectConfidentialData(query: string): boolean {
    const confidentialKeywords = [
      'password', 'credential', 'secret', 'token', 'key',
      'confidential', 'internal', 'private', 'restricted'
    ];
    
    const lowerQuery = query.toLowerCase();
    return confidentialKeywords.some(keyword => lowerQuery.includes(keyword));
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `hybrid-search-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get service health status
   */
  async getHealthStatus(): Promise<{
    healthy: boolean;
    localSearchAvailable: boolean;
    aiSearchAvailable: boolean;
    authorizationAvailable: boolean;
    performanceMetrics: {
      averageLocalSearchTime: number;
      averageAISearchTime: number;
      averageAuthorizationTime: number;
    };
  }> {
    const localHealth = await this.searchService.healthCheck();
    
    return {
      healthy: localHealth.success && localHealth.data?.healthy || false,
      localSearchAvailable: localHealth.data?.localSearchAvailable || false,
      aiSearchAvailable: localHealth.data?.aiSearchAvailable || false,
      authorizationAvailable: this.authService !== null,
      performanceMetrics: {
        averageLocalSearchTime: localHealth.data?.averageQueryTime || 0,
        averageAISearchTime: 0, // TODO: Implement AI search time tracking
        averageAuthorizationTime: 0 // TODO: Implement authorization time tracking
      }
    };
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.searchService.cleanup();
  }
}

// Export singleton instance
export const hybridSearchService = new HybridSearchService();