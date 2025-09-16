/**
 * Search IPC Handler
 * 
 * Advanced search handler with AI integration, semantic search,
 * intelligent caching, and comprehensive performance optimization.
 */

import { 
  IPCHandlerFunction,
  KBSearchRequest,
  KBSearchResponse,
  IPCErrorCode,
  BaseIPCResponse
} from '../../../types/ipc';
import { 
  KBEntry, 
  SearchResult, 
  KBCategory 
} from '../../../types/index';
import { DatabaseManager } from '../../../database/DatabaseManager';
import { MultiLayerCacheManager } from '../../../caching/MultiLayerCacheManager';
import { AppError } from '../../../core/errors/AppError';
import axios from 'axios';

interface GeminiConfig {
  apiKey: string;
  model: string;
  endpoint: string;
  timeout: number;
  maxRetries: number;
}

interface AISearchContext {
  originalQuery: string;
  expandedQueries: string[];
  semanticKeywords: string[];
  confidence: number;
  processingTime: number;
}

interface SearchPerformanceMetrics {
  totalSearches: number;
  averageLatency: number;
  aiSuccessRate: number;
  cacheHitRate: number;
  errorRate: number;
  lastUpdated: Date;
}

/**
 * Advanced Search Handler with AI capabilities
 */
export class SearchHandler {
  private geminiConfig: GeminiConfig;
  private performanceMetrics: SearchPerformanceMetrics;
  private searchCache = new Map<string, { results: SearchResult[]; timestamp: number; ttl: number }>();
  private queryExpansionCache = new Map<string, { expanded: string[]; timestamp: number }>();

  constructor(
    private dbManager: DatabaseManager,
    private cacheManager: MultiLayerCacheManager,
    geminiApiKey?: string
  ) {
    this.geminiConfig = {
      apiKey: geminiApiKey || process.env.GEMINI_API_KEY || '',
      model: 'gemini-pro',
      endpoint: 'https://generativelanguage.googleapis.com/v1beta',
      timeout: 10000, // 10 seconds
      maxRetries: 2
    };

    this.performanceMetrics = {
      totalSearches: 0,
      averageLatency: 0,
      aiSuccessRate: 0,
      cacheHitRate: 0,
      errorRate: 0,
      lastUpdated: new Date()
    };

    this.startPerformanceTracking();
  }

  /**
   * Handle AI-enhanced search requests
   */
  handleAISearch: IPCHandlerFunction<'kb:search:ai'> = async (request) => {
    const startTime = Date.now();
    
    try {
      const { query, options = {} } = request;
      
      // Validate search query
      if (!query || query.trim().length === 0) {
        return this.createErrorResponse(
          request.requestId,
          startTime,
          IPCErrorCode.INVALID_SEARCH_QUERY,
          'Search query cannot be empty'
        );
      }

      // Check if AI is available
      if (!this.isAIAvailable()) {
        console.log('🔄 AI not available, falling back to local search');
        return await this.handleLocalSearchFallback(request);
      }

      // Check cache first
      const cacheKey = this.generateAISearchCacheKey(query, options);
      const cached = await this.getCachedResults(cacheKey);
      
      if (cached) {
        this.updatePerformanceMetrics(Date.now() - startTime, true, true);
        return this.createSuccessResponse(
          request.requestId,
          startTime,
          cached,
          {
            cached: true,
            searchType: 'semantic',
            fromCache: 'memory',
            aiConfidence: 90
          }
        );
      }

      // Perform AI-enhanced search
      const aiContext = await this.performAIAnalysis(query, options);
      
      // Execute enhanced search queries
      const searchResults = await this.executeEnhancedSearch(aiContext, options);
      
      // Cache results
      await this.cacheResults(cacheKey, searchResults);
      
      // Record search metrics
      await this.recordSearchAnalytics(query, searchResults.length, 'ai', Date.now() - startTime, aiContext.confidence);

      this.updatePerformanceMetrics(Date.now() - startTime, true, false);

      return this.createSuccessResponse(
        request.requestId,
        startTime,
        searchResults,
        {
          cached: false,
          searchType: 'semantic',
          aiConfidence: aiContext.confidence,
          queryExpansion: aiContext.expandedQueries,
          semanticKeywords: aiContext.semanticKeywords
        }
      );

    } catch (error) {
      console.error('AI search error:', error);
      this.updatePerformanceMetrics(Date.now() - startTime, false, false);
      
      // Fallback to local search
      try {
        console.log('🔄 AI search failed, attempting local fallback');
        return await this.handleLocalSearchFallback(request);
      } catch (fallbackError) {
        return this.createErrorResponse(
          request.requestId,
          startTime,
          IPCErrorCode.EXTERNAL_SERVICE_ERROR,
          `AI search failed and local fallback failed: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`,
          { originalError: error, fallbackError }
        );
      }
    }
  };

  /**
   * Handle local search with optimization
   */
  handleLocalSearch: IPCHandlerFunction<'kb:search:local'> = async (request) => {
    const startTime = Date.now();
    
    try {
      const { query, options = {} } = request;
      
      // Validate search query
      if (!query || query.trim().length === 0) {
        return this.createErrorResponse(
          request.requestId,
          startTime,
          IPCErrorCode.INVALID_SEARCH_QUERY,
          'Search query cannot be empty'
        );
      }

      // Check cache first
      const cacheKey = this.generateLocalSearchCacheKey(query, options);
      const cached = await this.getCachedResults(cacheKey);
      
      if (cached) {
        this.updatePerformanceMetrics(Date.now() - startTime, true, true);
        return this.createSuccessResponse(
          request.requestId,
          startTime,
          cached,
          {
            cached: true,
            searchType: 'fuzzy',
            fromCache: 'memory'
          }
        );
      }

      // Perform local search
      const searchResults = await this.executeLocalSearch(query, options);
      
      // Cache results
      await this.cacheResults(cacheKey, searchResults);
      
      // Record search metrics
      await this.recordSearchAnalytics(query, searchResults.length, 'local', Date.now() - startTime, 85);

      this.updatePerformanceMetrics(Date.now() - startTime, true, false);

      return this.createSuccessResponse(
        request.requestId,
        startTime,
        searchResults,
        {
          cached: false,
          searchType: 'fuzzy'
        }
      );

    } catch (error) {
      console.error('Local search error:', error);
      this.updatePerformanceMetrics(Date.now() - startTime, false, false);
      
      return this.createErrorResponse(
        request.requestId,
        startTime,
        IPCErrorCode.DATABASE_ERROR,
        `Local search failed: ${error instanceof Error ? error.message : String(error)}`,
        { originalError: error }
      );
    }
  };

  /**
   * Get search performance metrics
   */
  getPerformanceMetrics(): SearchPerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  /**
   * Clear search caches
   */
  async clearCaches(): Promise<void> {
    this.searchCache.clear();
    this.queryExpansionCache.clear();
    await this.cacheManager.invalidateByTags(['search-results']);
    console.log('🧹 Search caches cleared');
  }

  // Private methods

  private async performAIAnalysis(query: string, options: any): Promise<AISearchContext> {
    const analysisStart = Date.now();
    
    try {
      // Check query expansion cache
      const expansionCacheKey = `expansion:${query}`;
      const cachedExpansion = this.queryExpansionCache.get(expansionCacheKey);
      
      if (cachedExpansion && Date.now() - cachedExpansion.timestamp < 24 * 60 * 60 * 1000) { // 24 hours
        return {
          originalQuery: query,
          expandedQueries: cachedExpansion.expanded,
          semanticKeywords: [],
          confidence: 90,
          processingTime: Date.now() - analysisStart
        };
      }

      // Prepare AI prompt for mainframe context
      const prompt = this.buildMainframeSearchPrompt(query, options);
      
      // Call Gemini API
      const response = await this.callGeminiAPI(prompt);
      
      // Parse AI response
      const analysis = this.parseAIResponse(response);
      
      // Cache query expansion
      this.queryExpansionCache.set(expansionCacheKey, {
        expanded: analysis.expandedQueries,
        timestamp: Date.now()
      });

      return {
        originalQuery: query,
        expandedQueries: analysis.expandedQueries,
        semanticKeywords: analysis.semanticKeywords,
        confidence: analysis.confidence,
        processingTime: Date.now() - analysisStart
      };

    } catch (error) {
      console.warn('AI analysis failed, using basic expansion:', error);
      
      // Fallback to basic query expansion
      return {
        originalQuery: query,
        expandedQueries: this.generateBasicQueryExpansion(query),
        semanticKeywords: this.extractBasicKeywords(query),
        confidence: 70,
        processingTime: Date.now() - analysisStart
      };
    }
  }

  private async executeEnhancedSearch(context: AISearchContext, options: any): Promise<SearchResult[]> {
    const allResults = new Map<string, SearchResult>();
    
    // Search with original query
    const originalResults = await this.executeLocalSearch(context.originalQuery, options);
    originalResults.forEach(result => {
      allResults.set(result.entry.id, {
        ...result,
        score: result.score * 1.2 // Boost original query matches
      });
    });

    // Search with expanded queries
    for (const expandedQuery of context.expandedQueries) {
      try {
        const expandedResults = await this.executeLocalSearch(expandedQuery, {
          ...options,
          limit: Math.min(options.limit || 20, 10) // Limit expanded query results
        });
        
        expandedResults.forEach(result => {
          const existingResult = allResults.get(result.entry.id);
          if (existingResult) {
            // Boost score for multiple matches
            existingResult.score = Math.min(100, existingResult.score + result.score * 0.5);
          } else {
            allResults.set(result.entry.id, {
              ...result,
              score: result.score * 0.8, // Slightly lower score for expanded matches
              matchType: 'semantic'
            });
          }
        });
      } catch (error) {
        console.warn(`Expanded query search failed: ${expandedQuery}`, error);
      }
    }

    // Convert to array and sort by score
    const results = Array.from(allResults.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, options.limit || 20);

    // Apply AI confidence weighting
    return results.map(result => ({
      ...result,
      score: Math.min(100, result.score * (context.confidence / 100))
    }));
  }

  private async executeLocalSearch(query: string, options: any): Promise<SearchResult[]> {
    // Build optimized SQL query
    const { sql, params } = this.buildOptimizedSearchQuery(query, options);
    
    // Execute query
    const queryResult = await this.dbManager.query<any[]>(sql, params, {
      useCache: true,
      cacheKey: `search_${Buffer.from(sql + JSON.stringify(params)).toString('base64')}`,
      maxRetries: 2
    });

    if (!queryResult.data || queryResult.data.length === 0) {
      return [];
    }

    // Transform and score results
    const entries = queryResult.data.map(row => this.transformRowToKBEntry(row));
    return this.calculateAdvancedSearchScores(entries, query, options);
  }

  private buildOptimizedSearchQuery(query: string, options: any): { sql: string; params: any[] } {
    const { categories, tags, includeArchived, sortBy, sortOrder, limit, offset, minConfidence } = options;
    
    // Use FTS for better performance
    let sql = `
      SELECT 
        e.*,
        GROUP_CONCAT(DISTINCT t.tag) as tags,
        bm25(kb_fts, 1.0, 0.8, 0.6) as relevance_score,
        snippet(kb_fts, 0, '<mark>', '</mark>', '...', 32) as snippet
      FROM kb_fts f
      JOIN kb_entries e ON f.id = e.id
      LEFT JOIN kb_tags t ON e.id = t.entry_id
    `;
    
    const params: any[] = [];
    const whereConditions: string[] = [];
    
    // FTS search condition
    const ftsQuery = this.prepareFTSQuery(query);
    whereConditions.push('kb_fts MATCH ?');
    params.push(ftsQuery);
    
    // Archive filter
    if (!includeArchived) {
      whereConditions.push('(e.archived IS NULL OR e.archived = 0)');
    }
    
    // Category filter
    if (categories && categories.length > 0) {
      whereConditions.push(`e.category IN (${categories.map(() => '?').join(',')})`);
      params.push(...categories);
    }
    
    // Tag filter
    if (tags && tags.length > 0) {
      whereConditions.push(`EXISTS (
        SELECT 1 FROM kb_tags kt 
        WHERE kt.entry_id = e.id 
        AND kt.tag IN (${tags.map(() => '?').join(',')})
      )`);
      params.push(...tags);
    }
    
    // Minimum confidence filter (for AI searches)
    if (minConfidence && minConfidence > 0) {
      whereConditions.push('bm25(kb_fts, 1.0, 0.8, 0.6) <= ?');
      params.push(-minConfidence); // BM25 returns negative scores
    }
    
    // Combine conditions
    if (whereConditions.length > 0) {
      sql += ' WHERE ' + whereConditions.join(' AND ');
    }
    
    sql += ' GROUP BY e.id';
    
    // Sorting
    const orderByMap = {
      relevance: 'relevance_score ASC', // BM25 ascending (lower is better)
      date: 'e.created_at DESC',
      usage: 'e.usage_count DESC',
      rating: `CASE 
        WHEN (e.success_count + e.failure_count) = 0 THEN 0 
        ELSE CAST(e.success_count AS REAL) / (e.success_count + e.failure_count) 
      END DESC`
    };
    
    const orderBy = orderByMap[sortBy as keyof typeof orderByMap] || orderByMap.relevance;
    sql += ` ORDER BY ${orderBy}`;
    
    // Add secondary sort for consistency
    if (sortBy !== 'date') {
      sql += ', e.created_at DESC';
    }
    
    // Pagination
    const limitValue = Math.min(limit || 20, 100); // Max 100 results
    sql += ` LIMIT ${limitValue}`;
    
    if (offset && offset > 0) {
      sql += ` OFFSET ${offset}`;
    }
    
    return { sql, params };
  }

  private calculateAdvancedSearchScores(entries: KBEntry[], query: string, options: any): SearchResult[] {
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);
    
    return entries.map(entry => {
      let score = 0;
      const highlights: string[] = [];
      const explanation: string[] = [];
      
      // Content for analysis
      const titleLower = entry.title.toLowerCase();
      const problemLower = entry.problem.toLowerCase();
      const solutionLower = entry.solution.toLowerCase();
      const allContent = `${titleLower} ${problemLower} ${solutionLower}`;
      
      // Exact phrase matching (highest weight)
      if (allContent.includes(queryLower)) {
        score += 40;
        highlights.push(query);
        explanation.push('Exact phrase match');
      }
      
      // Title matching (high weight)
      if (titleLower.includes(queryLower)) {
        score += 35;
        explanation.push('Title match');
      }
      
      // Individual word matching
      let wordMatches = 0;
      queryWords.forEach(word => {
        if (titleLower.includes(word)) {
          score += 15;
          wordMatches++;
          highlights.push(word);
        } else if (problemLower.includes(word)) {
          score += 10;
          wordMatches++;
          highlights.push(word);
        } else if (solutionLower.includes(word)) {
          score += 8;
          wordMatches++;
          highlights.push(word);
        }
      });
      
      if (wordMatches > 0) {
        explanation.push(`${wordMatches} word matches`);
      }
      
      // Category relevance
      if (entry.category.toLowerCase().includes(queryLower) || 
          queryWords.some(word => entry.category.toLowerCase().includes(word))) {
        score += 20;
        explanation.push('Category match');
      }
      
      // Tag matching
      let tagMatches = 0;
      entry.tags.forEach(tag => {
        const tagLower = tag.toLowerCase();
        if (tagLower.includes(queryLower) || 
            queryWords.some(word => tagLower.includes(word))) {
          score += 12;
          tagMatches++;
          highlights.push(tag);
        }
      });
      
      if (tagMatches > 0) {
        explanation.push(`${tagMatches} tag matches`);
      }
      
      // Usage popularity boost
      const usageBoost = Math.min(10, Math.log(entry.usage_count + 1) * 2);
      score += usageBoost;
      
      // Success rate boost
      const totalFeedback = entry.success_count + entry.failure_count;
      if (totalFeedback > 0) {
        const successRate = entry.success_count / totalFeedback;
        const successBoost = successRate * 15;
        score += successBoost;
        
        if (successRate > 0.8) {
          explanation.push('High success rate');
        }
      }
      
      // Recency boost (newer entries get slight boost)
      const daysSinceCreated = (Date.now() - entry.created_at.getTime()) / (1000 * 60 * 60 * 24);
      const recencyBoost = Math.max(0, 5 - (daysSinceCreated / 30)); // Boost decreases over 30 days
      score += recencyBoost;
      
      return {
        entry,
        score: Math.min(100, Math.max(0, score)),
        matchType: 'fuzzy' as const,
        highlights: [...new Set(highlights)],
        explanation: explanation.join(', ')
      };
    }).sort((a, b) => b.score - a.score);
  }

  private async handleLocalSearchFallback(request: KBSearchRequest): Promise<KBSearchResponse> {
    console.log('🔄 Executing local search fallback');
    return await this.handleLocalSearch(request);
  }

  private buildMainframeSearchPrompt(query: string, options: any): string {
    return `You are a mainframe expert assistant. Help expand this search query to find relevant knowledge base entries.

Query: "${query}"

Context: Searching a mainframe knowledge base containing solutions for:
- JCL (Job Control Language) issues
- VSAM file problems  
- DB2 database errors
- COBOL program issues
- CICS transaction problems
- IMS database issues
- Batch job failures
- System errors and abends

Please provide:
1. 2-3 expanded search queries that include related mainframe terms
2. 3-5 semantic keywords that could help find related solutions
3. Your confidence in the search expansion (0-100)

Format your response as JSON:
{
  "expandedQueries": ["query1", "query2", "query3"],
  "semanticKeywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
  "confidence": 85
}`;
  }

  private async callGeminiAPI(prompt: string): Promise<any> {
    if (!this.geminiConfig.apiKey) {
      throw new Error('Gemini API key not configured');
    }

    let lastError: Error;
    
    for (let attempt = 1; attempt <= this.geminiConfig.maxRetries; attempt++) {
      try {
        const response = await axios.post(
          `${this.geminiConfig.endpoint}/models/${this.geminiConfig.model}:generateContent`,
          {
            contents: [{
              parts: [{ text: prompt }]
            }],
            generationConfig: {
              temperature: 0.3,
              topK: 40,
              topP: 0.95,
              maxOutputTokens: 1024,
            }
          },
          {
            headers: {
              'x-goog-api-key': this.geminiConfig.apiKey,
              'Content-Type': 'application/json'
            },
            timeout: this.geminiConfig.timeout
          }
        );

        if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
          return response.data.candidates[0].content.parts[0].text;
        }
        
        throw new Error('Invalid API response format');

      } catch (error) {
        lastError = error as Error;
        
        if (attempt < this.geminiConfig.maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        break;
      }
    }
    
    throw new Error(`Gemini API failed after ${this.geminiConfig.maxRetries} attempts: ${lastError.message}`);
  }

  private parseAIResponse(response: string): {
    expandedQueries: string[];
    semanticKeywords: string[];
    confidence: number;
  } {
    try {
      // Try to parse as JSON
      const parsed = JSON.parse(response);
      
      return {
        expandedQueries: Array.isArray(parsed.expandedQueries) ? parsed.expandedQueries : [],
        semanticKeywords: Array.isArray(parsed.semanticKeywords) ? parsed.semanticKeywords : [],
        confidence: typeof parsed.confidence === 'number' ? Math.max(0, Math.min(100, parsed.confidence)) : 80
      };
      
    } catch (error) {
      console.warn('Failed to parse AI response as JSON, attempting text parsing:', error);
      
      // Fallback to text parsing
      const lines = response.split('\n').map(line => line.trim()).filter(line => line);
      
      return {
        expandedQueries: lines.slice(0, 3),
        semanticKeywords: lines.slice(3, 8),
        confidence: 75
      };
    }
  }

  private generateBasicQueryExpansion(query: string): string[] {
    const expanded: string[] = [];
    const queryLower = query.toLowerCase();
    
    // Mainframe term expansions
    const expansions: Record<string, string[]> = {
      'jcl': ['job control language', 'job step', 'dd statement'],
      'vsam': ['virtual storage access method', 'dataset', 'ksds', 'esds'],
      'db2': ['database', 'sql', 'table', 'query'],
      'cobol': ['program', 'procedure division', 'working storage'],
      'cics': ['transaction', 'commarea', 'program'],
      'error': ['abend', 'failure', 'problem', 'issue'],
      'file': ['dataset', 'vsam', 'sequential'],
      'job': ['batch', 'jcl', 'step'],
      'sql': ['db2', 'database', 'select', 'update']
    };
    
    // Find expansions for query terms
    Object.entries(expansions).forEach(([term, alternatives]) => {
      if (queryLower.includes(term)) {
        alternatives.forEach(alt => {
          if (!queryLower.includes(alt)) {
            expanded.push(query.replace(new RegExp(term, 'gi'), alt));
          }
        });
      }
    });
    
    // Add related terms
    if (expanded.length === 0) {
      expanded.push(query + ' mainframe', query + ' error', query + ' solution');
    }
    
    return expanded.slice(0, 3);
  }

  private extractBasicKeywords(query: string): string[] {
    const keywords = new Set<string>();
    const queryLower = query.toLowerCase();
    
    // Common mainframe keywords
    const mainframeKeywords = [
      'jcl', 'vsam', 'db2', 'cobol', 'cics', 'ims', 'batch', 'dataset', 
      'abend', 'error', 'sql', 'program', 'job', 'file', 'system'
    ];
    
    mainframeKeywords.forEach(keyword => {
      if (queryLower.includes(keyword)) {
        keywords.add(keyword);
      }
    });
    
    // Extract words from query
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 3);
    queryWords.forEach(word => keywords.add(word));
    
    return Array.from(keywords).slice(0, 5);
  }

  private prepareFTSQuery(query: string): string {
    // Escape special FTS5 characters and prepare query
    const escaped = query.replace(/['"*]/g, '');
    const words = escaped.split(/\s+/).filter(w => w.length > 0);
    
    if (words.length === 0) {
      return query;
    }
    
    // Use phrase search for multiple words, individual words otherwise
    if (words.length > 1) {
      return `"${words.join(' ')}"`;
    }
    
    return words[0];
  }

  private transformRowToKBEntry(row: any): KBEntry {
    return {
      id: row.id,
      title: row.title,
      problem: row.problem,
      solution: row.solution,
      category: row.category,
      tags: row.tags ? row.tags.split(',').map((t: string) => t.trim()) : [],
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
      created_by: row.created_by || 'system',
      usage_count: row.usage_count || 0,
      success_count: row.success_count || 0,
      failure_count: row.failure_count || 0,
      version: row.version || 1
    };
  }

  private async getCachedResults(cacheKey: string): Promise<SearchResult[] | null> {
    // Check memory cache first
    const memoryResult = this.searchCache.get(cacheKey);
    if (memoryResult && Date.now() - memoryResult.timestamp < memoryResult.ttl) {
      return memoryResult.results;
    }
    
    // Check distributed cache
    try {
      const cachedResults = await this.cacheManager.get<SearchResult[]>(cacheKey);
      if (cachedResults) {
        // Update memory cache
        this.searchCache.set(cacheKey, {
          results: cachedResults,
          timestamp: Date.now(),
          ttl: 300000 // 5 minutes
        });
        return cachedResults;
      }
    } catch (error) {
      console.warn('Cache retrieval failed:', error);
    }
    
    return null;
  }

  private async cacheResults(cacheKey: string, results: SearchResult[]): Promise<void> {
    const ttl = 300000; // 5 minutes
    
    // Cache in memory
    this.searchCache.set(cacheKey, {
      results,
      timestamp: Date.now(),
      ttl
    });
    
    // Cache in distributed cache
    try {
      await this.cacheManager.set(cacheKey, results, {
        ttl,
        layer: 'memory',
        tags: ['search-results']
      });
    } catch (error) {
      console.warn('Cache storage failed:', error);
    }
  }

  private async recordSearchAnalytics(
    query: string, 
    resultCount: number, 
    searchType: string, 
    executionTime: number,
    confidence: number
  ): Promise<void> {
    try {
      await this.dbManager.query(`
        INSERT INTO search_analytics (
          query, result_count, search_type, execution_time, confidence, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?)
      `, [query, resultCount, searchType, executionTime, confidence, new Date().toISOString()]);
    } catch (error) {
      console.warn('Failed to record search analytics:', error);
    }
  }

  private generateAISearchCacheKey(query: string, options: any): string {
    const key = `ai_search:${query}:${JSON.stringify(options)}`;
    return Buffer.from(key).toString('base64');
  }

  private generateLocalSearchCacheKey(query: string, options: any): string {
    const key = `local_search:${query}:${JSON.stringify(options)}`;
    return Buffer.from(key).toString('base64');
  }

  private isAIAvailable(): boolean {
    return !!(this.geminiConfig.apiKey && this.geminiConfig.apiKey.length > 0);
  }

  private updatePerformanceMetrics(latency: number, success: boolean, cached: boolean): void {
    this.performanceMetrics.totalSearches++;
    
    // Update average latency
    const totalLatency = this.performanceMetrics.averageLatency * (this.performanceMetrics.totalSearches - 1);
    this.performanceMetrics.averageLatency = (totalLatency + latency) / this.performanceMetrics.totalSearches;
    
    // Update success rates
    if (success) {
      this.performanceMetrics.aiSuccessRate = 
        (this.performanceMetrics.aiSuccessRate * (this.performanceMetrics.totalSearches - 1) + 100) / this.performanceMetrics.totalSearches;
    } else {
      this.performanceMetrics.errorRate = 
        (this.performanceMetrics.errorRate * (this.performanceMetrics.totalSearches - 1) + 100) / this.performanceMetrics.totalSearches;
    }
    
    // Update cache hit rate
    if (cached) {
      this.performanceMetrics.cacheHitRate = 
        (this.performanceMetrics.cacheHitRate * (this.performanceMetrics.totalSearches - 1) + 100) / this.performanceMetrics.totalSearches;
    }
    
    this.performanceMetrics.lastUpdated = new Date();
  }

  private startPerformanceTracking(): void {
    // Clean up old cache entries every 10 minutes
    setInterval(() => {
      const now = Date.now();
      
      // Clean memory cache
      for (const [key, value] of this.searchCache.entries()) {
        if (now - value.timestamp > value.ttl) {
          this.searchCache.delete(key);
        }
      }
      
      // Clean query expansion cache (24 hours)
      for (const [key, value] of this.queryExpansionCache.entries()) {
        if (now - value.timestamp > 24 * 60 * 60 * 1000) {
          this.queryExpansionCache.delete(key);
        }
      }
    }, 10 * 60 * 1000);
  }

  private createSuccessResponse(
    requestId: string,
    startTime: number,
    results: SearchResult[],
    additionalMetadata: any = {}
  ): KBSearchResponse {
    return {
      success: true,
      requestId,
      timestamp: Date.now(),
      executionTime: Date.now() - startTime,
      data: results,
      metadata: {
        cached: false,
        batched: false,
        streamed: false,
        totalResults: results.length,
        queryProcessingTime: Date.now() - startTime,
        hasMoreResults: results.length >= 20,
        ...additionalMetadata
      }
    };
  }

  private createErrorResponse(
    requestId: string,
    startTime: number,
    code: IPCErrorCode,
    message: string,
    details?: any
  ): BaseIPCResponse {
    return {
      success: false,
      requestId,
      timestamp: Date.now(),
      executionTime: Date.now() - startTime,
      error: {
        code,
        message,
        details,
        severity: 'medium',
        retryable: true
      }
    };
  }
}