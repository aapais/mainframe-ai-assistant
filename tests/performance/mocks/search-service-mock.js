/**
 * Search Service Mock
 * Realistic mock for search service performance testing
 */

const { performance } = require('perf_hooks');
const EventEmitter = require('events');

class SearchServiceMock extends EventEmitter {
  constructor() {
    super();
    this.cache = new Map();
    this.searchIndex = new Map();
    this.queryCount = 0;
    this.cacheHitCount = 0;
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;
    
    // Simulate building search index
    await this.buildSearchIndex();
    this.isInitialized = true;
  }

  async buildSearchIndex() {
    // Simulate loading and indexing documents
    const documents = this.generateMockDocuments(10000);
    
    documents.forEach(doc => {
      // Create inverted index
      const terms = this.extractTerms(doc.content + ' ' + doc.title);
      
      terms.forEach(term => {
        if (!this.searchIndex.has(term)) {
          this.searchIndex.set(term, []);
        }
        this.searchIndex.get(term).push({
          docId: doc.id,
          score: this.calculateRelevanceScore(term, doc),
          doc
        });
      });
    });
    
    // Sort results by relevance for each term
    this.searchIndex.forEach(results => {
      results.sort((a, b) => b.score - a.score);
    });
  }

  generateMockDocuments(count) {
    const categories = ['javascript', 'react', 'nodejs', 'database', 'api', 'frontend', 'backend'];
    const topics = ['tutorial', 'guide', 'documentation', 'example', 'best practices', 'troubleshooting'];
    
    return Array.from({ length: count }, (_, i) => {
      const category = categories[i % categories.length];
      const topic = topics[i % topics.length];
      
      return {
        id: i + 1,
        title: `${category} ${topic} ${i + 1}`,
        content: this.generateMockContent(category, topic, i),
        category,
        tags: [category, topic, `tag_${i % 20}`],
        created: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
        author: `author_${i % 50}`,
        views: Math.floor(Math.random() * 10000),
        rating: Math.random() * 5
      };
    });
  }

  generateMockContent(category, topic, index) {
    const templates = {
      javascript: `This is a comprehensive ${topic} about ${category}. Learn how to implement advanced ${category} patterns and techniques. Covers modern ES6+ features, async/await, promises, and best practices.`,
      react: `Complete ${topic} for ${category} development. Understand components, hooks, state management, and performance optimization. Includes examples of ${category} patterns.`,
      nodejs: `Server-side ${topic} using ${category}. Build scalable applications with Express.js, middleware, authentication, and database integration. Advanced ${category} techniques included.`,
      database: `Database ${topic} covering ${category} concepts. SQL queries, indexing, performance tuning, and schema design. Learn ${category} optimization strategies.`,
      api: `RESTful ${topic} for ${category} development. API design, documentation, testing, and security. Implement ${category} endpoints with proper error handling.`,
      frontend: `Frontend ${topic} focusing on ${category} development. UI/UX design, responsive layouts, and modern frameworks. Master ${category} best practices.`,
      backend: `Backend ${topic} for ${category} systems. Server architecture, microservices, scaling, and deployment. Advanced ${category} implementation patterns.`
    };
    
    return templates[category] || `Generic ${topic} about ${category} development. Content ${index}.`;
  }

  extractTerms(text) {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(term => term.length > 2)
      .filter(term => !this.isStopWord(term));
  }

  isStopWord(term) {
    const stopWords = new Set([
      'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'man', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use'
    ]);
    return stopWords.has(term);
  }

  calculateRelevanceScore(term, doc) {
    const titleWeight = 3;
    const contentWeight = 1;
    const tagWeight = 2;
    
    let score = 0;
    
    // Title relevance
    const titleTerms = this.extractTerms(doc.title);
    const titleMatches = titleTerms.filter(t => t === term).length;
    score += titleMatches * titleWeight;
    
    // Content relevance
    const contentTerms = this.extractTerms(doc.content);
    const contentMatches = contentTerms.filter(t => t === term).length;
    score += contentMatches * contentWeight;
    
    // Tag relevance
    const tagMatches = doc.tags.filter(tag => 
      this.extractTerms(tag).includes(term)
    ).length;
    score += tagMatches * tagWeight;
    
    // Boost by document popularity
    score *= (1 + doc.views / 10000);
    score *= (1 + doc.rating / 5);
    
    return score;
  }

  async search(query, options = {}) {
    this.queryCount++;
    
    const {
      limit = 50,
      offset = 0,
      sortBy = 'relevance',
      filters = {},
      enableCache = true
    } = options;
    
    const cacheKey = this.generateCacheKey(query, options);
    
    // Check cache first
    if (enableCache && this.cache.has(cacheKey)) {
      this.cacheHitCount++;
      const cachedResult = this.cache.get(cacheKey);
      
      // Simulate cache retrieval time (much faster)
      await this.simulateLatency(5, 15);
      
      return {
        ...cachedResult,
        fromCache: true,
        cacheKey,
        queryCount: this.queryCount,
        timestamp: Date.now()
      };
    }
    
    // Simulate search processing time based on query complexity
    const complexity = this.analyzeQueryComplexity(query);
    await this.simulateSearchLatency(complexity);
    
    // Perform search
    const results = this.performSearch(query, filters);
    
    // Apply sorting
    const sortedResults = this.sortResults(results, sortBy);
    
    // Apply pagination
    const paginatedResults = sortedResults.slice(offset, offset + limit);
    
    const searchResult = {
      query,
      results: paginatedResults,
      totalResults: sortedResults.length,
      hasMore: offset + limit < sortedResults.length,
      limit,
      offset,
      sortBy,
      filters,
      processingTime: complexity.estimatedTime,
      complexity: complexity.level,
      fromCache: false,
      queryCount: this.queryCount,
      timestamp: Date.now()
    };
    
    // Cache the result
    if (enableCache) {
      this.cacheResult(cacheKey, searchResult);
    }
    
    return searchResult;
  }

  generateCacheKey(query, options) {
    const normalizedQuery = query.toLowerCase().trim();
    const optionsKey = JSON.stringify({
      limit: options.limit || 50,
      offset: options.offset || 0,
      sortBy: options.sortBy || 'relevance',
      filters: options.filters || {}
    });
    
    return `${normalizedQuery}:${optionsKey}`;
  }

  analyzeQueryComplexity(query) {
    let complexity = {
      level: 'simple',
      factors: [],
      estimatedTime: 50 // base time in ms
    };
    
    // Query length factor
    if (query.length > 50) {
      complexity.factors.push('long_query');
      complexity.estimatedTime += 20;
    }
    
    // Boolean operators
    if (/\b(AND|OR|NOT)\b/i.test(query)) {
      complexity.factors.push('boolean_operators');
      complexity.estimatedTime += 30;
      complexity.level = 'medium';
    }
    
    // Phrase search
    if (query.includes('"')) {
      complexity.factors.push('phrase_search');
      complexity.estimatedTime += 25;
      complexity.level = 'medium';
    }
    
    // Wildcard search
    if (query.includes('*')) {
      complexity.factors.push('wildcard_search');
      complexity.estimatedTime += 40;
      complexity.level = 'complex';
    }
    
    // Fuzzy search
    if (query.includes('~')) {
      complexity.factors.push('fuzzy_search');
      complexity.estimatedTime += 60;
      complexity.level = 'complex';
    }
    
    // Multiple terms
    const terms = query.split(/\s+/).filter(t => t.length > 0);
    if (terms.length > 3) {
      complexity.factors.push('multiple_terms');
      complexity.estimatedTime += terms.length * 5;
    }
    
    // Complex query overall
    if (complexity.factors.length > 2) {
      complexity.level = 'complex';
      complexity.estimatedTime += 50;
    }
    
    return complexity;
  }

  async simulateSearchLatency(complexity) {
    let baseLatency = complexity.estimatedTime;
    
    // Add random variation (±20%)
    const variation = baseLatency * 0.2 * (Math.random() - 0.5) * 2;
    baseLatency += variation;
    
    // Simulate occasional slow searches (2% chance)
    if (Math.random() < 0.02) {
      baseLatency *= 3;
    }
    
    // Simulate system load effect (5% chance of 50% slower)
    if (Math.random() < 0.05) {
      baseLatency *= 1.5;
    }
    
    await this.simulateLatency(baseLatency * 0.8, baseLatency * 1.2);
  }

  async simulateLatency(min, max) {
    const latency = min + Math.random() * (max - min);
    await new Promise(resolve => setTimeout(resolve, latency));
  }

  performSearch(query, filters = {}) {
    const queryTerms = this.extractTerms(query);
    const allResults = new Map(); // docId -> score
    
    // Handle different query types
    if (query.includes('"')) {
      // Phrase search
      return this.performPhraseSearch(query, filters);
    } else if (/\b(AND|OR|NOT)\b/i.test(query)) {
      // Boolean search
      return this.performBooleanSearch(query, filters);
    } else if (query.includes('*')) {
      // Wildcard search
      return this.performWildcardSearch(query, filters);
    } else {
      // Standard search
      return this.performStandardSearch(queryTerms, filters);
    }
  }

  performStandardSearch(queryTerms, filters) {
    const allResults = new Map();
    
    queryTerms.forEach(term => {
      const termResults = this.searchIndex.get(term) || [];
      
      termResults.forEach(result => {
        const currentScore = allResults.get(result.docId) || 0;
        allResults.set(result.docId, currentScore + result.score);
      });
    });
    
    // Convert to result array
    const results = Array.from(allResults.entries())
      .map(([docId, score]) => {
        const docResults = Array.from(this.searchIndex.values())
          .flat()
          .find(r => r.docId === docId);
        
        return {
          ...docResults.doc,
          relevanceScore: score,
          matchedTerms: queryTerms.filter(term => 
            this.extractTerms(docResults.doc.title + ' ' + docResults.doc.content)
              .includes(term)
          )
        };
      })
      .filter(result => this.applyFilters(result, filters));
    
    return results;
  }

  performPhraseSearch(query, filters) {
    const phrase = query.match(/"([^"]*)"/)?.[1] || query;
    const phraseTerms = this.extractTerms(phrase);
    
    const results = [];
    
    // Search through all documents for the exact phrase
    this.searchIndex.forEach(termResults => {
      termResults.forEach(result => {
        const docText = (result.doc.title + ' ' + result.doc.content).toLowerCase();
        
        if (docText.includes(phrase.toLowerCase())) {
          const existingResult = results.find(r => r.id === result.doc.id);
          
          if (!existingResult) {
            results.push({
              ...result.doc,
              relevanceScore: result.score * 2, // Boost phrase matches
              matchedTerms: phraseTerms,
              matchType: 'phrase'
            });
          }
        }
      });
    });
    
    return results.filter(result => this.applyFilters(result, filters));
  }

  performBooleanSearch(query, filters) {
    // Simple boolean search implementation
    const results = [];
    
    // For demo purposes, treat as standard search with boosted scoring
    const terms = query.replace(/\b(AND|OR|NOT)\b/gi, '').trim();
    const termResults = this.performStandardSearch(this.extractTerms(terms), filters);
    
    return termResults.map(result => ({
      ...result,
      relevanceScore: result.relevanceScore * 1.3, // Boost boolean queries
      matchType: 'boolean'
    }));
  }

  performWildcardSearch(query, filters) {
    const wildcardPattern = query.replace(/\*/g, '.*');
    const regex = new RegExp(wildcardPattern, 'i');
    
    const results = [];
    
    this.searchIndex.forEach((termResults, term) => {
      if (regex.test(term)) {
        termResults.forEach(result => {
          const existingResult = results.find(r => r.id === result.doc.id);
          
          if (!existingResult) {
            results.push({
              ...result.doc,
              relevanceScore: result.score * 0.8, // Slightly lower score for wildcards
              matchedTerms: [term],
              matchType: 'wildcard'
            });
          }
        });
      }
    });
    
    return results.filter(result => this.applyFilters(result, filters));
  }

  applyFilters(result, filters) {
    if (filters.category && result.category !== filters.category) {
      return false;
    }
    
    if (filters.tags && filters.tags.length > 0) {
      const hasMatchingTag = filters.tags.some(tag => result.tags.includes(tag));
      if (!hasMatchingTag) return false;
    }
    
    if (filters.author && result.author !== filters.author) {
      return false;
    }
    
    if (filters.minRating && result.rating < filters.minRating) {
      return false;
    }
    
    if (filters.dateRange) {
      const resultDate = new Date(result.created);
      if (filters.dateRange.start && resultDate < new Date(filters.dateRange.start)) {
        return false;
      }
      if (filters.dateRange.end && resultDate > new Date(filters.dateRange.end)) {
        return false;
      }
    }
    
    return true;
  }

  sortResults(results, sortBy) {
    switch (sortBy) {
      case 'relevance':
        return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
      
      case 'date':
        return results.sort((a, b) => new Date(b.created) - new Date(a.created));
      
      case 'rating':
        return results.sort((a, b) => b.rating - a.rating);
      
      case 'views':
        return results.sort((a, b) => b.views - a.views);
      
      case 'title':
        return results.sort((a, b) => a.title.localeCompare(b.title));
      
      default:
        return results;
    }
  }

  cacheResult(cacheKey, result) {
    // Implement LRU cache with size limit
    const maxCacheSize = 1000;
    
    if (this.cache.size >= maxCacheSize) {
      // Remove oldest entry
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    // Store with TTL simulation
    const cachedResult = {
      ...result,
      cachedAt: Date.now(),
      ttl: 300000 // 5 minutes
    };
    
    this.cache.set(cacheKey, cachedResult);
  }

  // Cache management methods
  getCacheStats() {
    return {
      size: this.cache.size,
      hitRate: this.queryCount > 0 ? (this.cacheHitCount / this.queryCount) * 100 : 0,
      totalQueries: this.queryCount,
      cacheHits: this.cacheHitCount,
      cacheMisses: this.queryCount - this.cacheHitCount
    };
  }

  clearCache() {
    this.cache.clear();
    this.cacheHitCount = 0;
  }

  // Performance simulation methods
  simulateHighLoad() {
    // Increase latency to simulate high load
    this.highLoadMode = true;
  }

  simulateNormalLoad() {
    this.highLoadMode = false;
  }

  simulateError(errorRate = 0.01) {
    this.errorRate = errorRate;
  }

  // Utility methods for testing
  getSearchStats() {
    return {
      totalQueries: this.queryCount,
      indexSize: this.searchIndex.size,
      documentCount: Array.from(this.searchIndex.values())
        .flat()
        .map(r => r.docId)
        .filter((id, index, arr) => arr.indexOf(id) === index)
        .length,
      cacheStats: this.getCacheStats()
    };
  }
}

module.exports = SearchServiceMock;
