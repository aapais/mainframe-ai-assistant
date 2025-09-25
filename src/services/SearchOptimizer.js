'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.SearchOptimizer = void 0;
const events_1 = require('events');
class SearchOptimizer extends events_1.EventEmitter {
  queryCache = new Map();
  strategyMetrics = new Map();
  optimizationHistory = [];
  performanceThresholds = {
    maxQueryTime: 500,
    maxParallelStrategies: 5,
    minConfidenceThreshold: 0.7,
    cacheSize: 1000,
  };
  constructor() {
    super();
    this.initializeOptimizer();
  }
  async optimizeSearch(query, entries, options = {}, searchMethods) {
    const startTime = performance.now();
    try {
      const optimization = await this.optimizeQuery(query, options);
      const strategies = this.selectStrategies(query, entries, options, searchMethods);
      const results = await this.executeParallelStrategies(
        optimization.optimizedQuery || query,
        entries,
        options,
        strategies
      );
      const optimizedResults = await this.optimizeResults(results, query, options);
      await this.recordOptimization(query, optimization, results, performance.now() - startTime);
      return optimizedResults;
    } catch (error) {
      console.error('Search optimization failed:', error);
      return this.fallbackSearch(query, entries, options, searchMethods);
    }
  }
  async optimizeQuery(query, options) {
    const cacheKey = `${query}:${JSON.stringify(options)}`;
    const cached = this.queryCache.get(cacheKey);
    if (cached) {
      return cached;
    }
    const optimization = await this.analyzeAndOptimizeQuery(query, options);
    this.cacheOptimization(cacheKey, optimization);
    return optimization;
  }
  selectStrategies(query, entries, options, searchMethods) {
    const strategies = [];
    const queryIntent = this.detectQueryIntent(query);
    const queryComplexity = this.assessQueryComplexity(query);
    const datasetSize = entries.length;
    if (searchMethods.has('fts5') && datasetSize > 100) {
      strategies.push({
        name: 'fts5_optimized',
        priority: 10,
        estimatedTime: 50,
        confidence: 0.9,
        execute: searchMethods.get('fts5'),
      });
    }
    if (searchMethods.has('ai') && queryComplexity > 0.6 && datasetSize <= 200) {
      strategies.push({
        name: 'ai_semantic',
        priority: 8,
        estimatedTime: 200,
        confidence: 0.8,
        execute: searchMethods.get('ai'),
      });
    }
    if (searchMethods.has('local')) {
      strategies.push({
        name: 'local_fuzzy',
        priority: 6,
        estimatedTime: 100,
        confidence: 0.7,
        execute: searchMethods.get('local'),
      });
    }
    const detectedCategory = this.detectImplicitCategory(query);
    if (detectedCategory && searchMethods.has('category')) {
      strategies.push({
        name: 'category_specific',
        priority: 7,
        estimatedTime: 30,
        confidence: 0.85,
        execute: async (q, e, o) => {
          return searchMethods.get('category')(q, e, { ...o, category: detectedCategory });
        },
      });
    }
    return strategies
      .sort((a, b) => b.priority * b.confidence - a.priority * a.confidence)
      .slice(0, this.performanceThresholds.maxParallelStrategies);
  }
  async executeParallelStrategies(query, entries, options, strategies) {
    const startTime = performance.now();
    const strategyPromises = strategies.map(async strategy => {
      const strategyStart = performance.now();
      try {
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(
            () => reject(new Error(`Strategy timeout: ${strategy.name}`)),
            strategy.estimatedTime * 2
          );
        });
        const searchPromise = strategy.execute(query, entries, options);
        const results = await Promise.race([searchPromise, timeoutPromise]);
        this.recordStrategyPerformance(strategy.name, performance.now() - strategyStart, true);
        return {
          strategy: strategy.name,
          results,
          confidence: strategy.confidence,
          executionTime: performance.now() - strategyStart,
        };
      } catch (error) {
        this.recordStrategyPerformance(strategy.name, performance.now() - strategyStart, false);
        console.warn(`Strategy ${strategy.name} failed:`, error.message);
        return {
          strategy: strategy.name,
          results: [],
          confidence: 0,
          executionTime: performance.now() - strategyStart,
        };
      }
    });
    const strategyResults = await Promise.allSettled(strategyPromises);
    const successfulResults = strategyResults
      .filter(result => result.status === 'fulfilled')
      .map(result => result.value)
      .filter(result => result.results.length > 0);
    if (successfulResults.length === 0) {
      return [];
    }
    return this.mergeStrategyResults(successfulResults, query, options);
  }
  async optimizeResults(results, query, options) {
    if (results.length === 0) return results;
    const rankedResults = results.map((result, index) => {
      let optimizedScore = result.score;
      const semanticScore = this.calculateSemanticAlignment(query, result.entry);
      optimizedScore = optimizedScore * 0.7 + semanticScore * 30;
      const historyScore = this.calculateHistoricalPerformance(result.entry);
      optimizedScore = optimizedScore * 0.85 + historyScore * 15;
      const contextScore = this.calculateContextRelevance(result.entry, options);
      optimizedScore = optimizedScore * 0.95 + contextScore * 5;
      const diversityPenalty = this.calculateDiversityPenalty(result, results, index);
      optimizedScore = Math.max(0, optimizedScore - diversityPenalty);
      return {
        ...result,
        score: Math.min(100, optimizedScore),
        metadata: {
          ...result.metadata,
          optimized: true,
          originalScore: result.score,
          semanticAlignment: semanticScore,
          historicalPerformance: historyScore,
          contextRelevance: contextScore,
          diversityScore: 100 - diversityPenalty,
        },
      };
    });
    return rankedResults
      .sort((a, b) => b.score - a.score)
      .map((result, index) => ({
        ...result,
        metadata: {
          ...result.metadata,
          finalRank: index + 1,
          rankingConfidence: this.calculateRankingConfidence(result, index, rankedResults.length),
        },
      }))
      .slice(0, options.limit || 50);
  }
  async analyzeAndOptimizeQuery(query, options) {
    const analysis = {
      intent: this.detectQueryIntent(query),
      complexity: this.assessQueryComplexity(query),
      entities: this.extractEntities(query),
      patterns: this.identifyPatterns(query),
    };
    let optimizedQuery = query;
    const optimizations = [];
    let optimizationType = 'rewrite';
    const spellCorrected = await this.applySpellCorrection(query);
    if (spellCorrected !== query) {
      optimizedQuery = spellCorrected;
      optimizations.push('Applied spell correction');
    }
    if (query.split(' ').length <= 2 && analysis.entities.length > 0) {
      optimizedQuery = await this.expandQuery(optimizedQuery, analysis.entities);
      optimizations.push('Expanded short query with context');
      optimizationType = 'expand';
    }
    if (query.split(' ').length > 8) {
      optimizedQuery = await this.focusQuery(optimizedQuery, analysis.patterns);
      optimizations.push('Focused overly broad query');
      optimizationType = 'focus';
    }
    optimizedQuery = this.standardizeTechnicalTerms(optimizedQuery);
    if (optimizedQuery !== query) {
      optimizations.push('Standardized technical terminology');
    }
    const confidence = this.calculateOptimizationConfidence(query, optimizedQuery, analysis);
    const estimatedImprovement = this.estimateImprovement(query, optimizedQuery, analysis);
    return {
      originalQuery: query,
      optimizedQuery,
      optimizationType,
      confidence,
      estimatedImprovement,
      reasoning: optimizations,
    };
  }
  detectQueryIntent(query) {
    const errorPatterns = /error|fail|abend|exception|status|code|problem/i;
    const howToPatterns = /how\s+to|setup|configure|install|create/i;
    const troublePatterns = /debug|troubleshoot|fix|solve|resolve|issue/i;
    if (errorPatterns.test(query)) return 'error_resolution';
    if (howToPatterns.test(query)) return 'how_to';
    if (troublePatterns.test(query)) return 'troubleshooting';
    return 'information';
  }
  assessQueryComplexity(query) {
    const wordCount = query.split(/\s+/).length;
    const hasSpecialChars = /[^\w\s]/.test(query);
    const hasTechnicalTerms = /\b(jcl|vsam|db2|cobol|cics|ims|sql|mainframe)\b/i.test(query);
    const hasNumbers = /\d/.test(query);
    let complexity = Math.min(1, wordCount / 10);
    if (hasSpecialChars) complexity += 0.2;
    if (hasTechnicalTerms) complexity += 0.3;
    if (hasNumbers) complexity += 0.1;
    return Math.min(1, complexity);
  }
  extractEntities(query) {
    const entities = [];
    const errorCodePattern = /\b(s0c[0-9a-f]|u\d{4}|ief\d{3}[a-z]|sqlcode\s*-?\d+)\b/gi;
    const errorCodes = query.match(errorCodePattern) || [];
    errorCodes.forEach(code => {
      entities.push({ term: code, type: 'error_code', confidence: 0.9 });
    });
    const systemPattern = /\b(jcl|vsam|db2|cobol|cics|ims|tso|ispf|racf)\b/gi;
    const systems = query.match(systemPattern) || [];
    systems.forEach(system => {
      entities.push({ term: system, type: 'system', confidence: 0.8 });
    });
    const datasetPattern = /\b[a-z0-9]+\.[a-z0-9]+\.[a-z0-9]+\b/gi;
    const datasets = query.match(datasetPattern) || [];
    datasets.forEach(dataset => {
      entities.push({ term: dataset, type: 'dataset', confidence: 0.7 });
    });
    return entities;
  }
  identifyPatterns(query) {
    const patterns = [];
    if (/\berror\s+\w+/i.test(query)) patterns.push('error_with_code');
    if (/\bhow\s+to\b/i.test(query)) patterns.push('how_to_question');
    if (/\bfail(ed|ing|ure)?\b/i.test(query)) patterns.push('failure_scenario');
    if (/\b(setup|install|configure)\b/i.test(query)) patterns.push('setup_instruction');
    return patterns;
  }
  detectImplicitCategory(query) {
    const categoryPatterns = {
      JCL: /\b(jcl|job|step|dd|dataset|allocation)\b/i,
      VSAM: /\b(vsam|ksds|esds|rrds|cluster|catalog)\b/i,
      DB2: /\b(db2|sql|table|cursor|plan|package)\b/i,
      COBOL: /\b(cobol|program|paragraph|copybook|working.storage)\b/i,
      Batch: /\b(batch|abend|s0c[0-9a-f]|program|job)\b/i,
    };
    for (const [category, pattern] of Object.entries(categoryPatterns)) {
      if (pattern.test(query)) {
        return category;
      }
    }
    return null;
  }
  async applySpellCorrection(query) {
    const corrections = {
      jcl: ['jcl', 'job control language'],
      vsam: ['vsam', 'virtual storage access method'],
      cobal: 'cobol',
      cicss: 'cics',
      db2: ['db2', 'database 2'],
      tso: ['tso', 'time sharing option'],
      ispf: ['ispf', 'interactive system productivity facility'],
    };
    let corrected = query;
    for (const [correct, variants] of Object.entries(corrections)) {
      const variantArray = Array.isArray(variants) ? variants : [variants];
      variantArray.forEach(variant => {
        const regex = new RegExp(`\\b${variant}\\b`, 'gi');
        corrected = corrected.replace(regex, correct);
      });
    }
    return corrected;
  }
  async expandQuery(query, entities) {
    let expanded = query;
    entities.forEach(entity => {
      if (entity.type === 'error_code') {
        expanded += ` ${entity.term} abend error`;
      } else if (entity.type === 'system') {
        expanded += ` ${entity.term} mainframe`;
      }
    });
    return expanded;
  }
  async focusQuery(query, patterns) {
    const words = query.split(/\s+/);
    const importantWords = words.filter(
      word =>
        word.length > 3 && !/\b(and|the|for|with|from|that|this|when|where|what|how)\b/i.test(word)
    );
    return importantWords.slice(0, 5).join(' ');
  }
  standardizeTechnicalTerms(query) {
    const standardizations = {
      'job control language': 'JCL',
      'virtual storage access method': 'VSAM',
      'database 2': 'DB2',
      'customer information control system': 'CICS',
      'information management system': 'IMS',
    };
    let standardized = query;
    for (const [original, standard] of Object.entries(standardizations)) {
      const regex = new RegExp(original, 'gi');
      standardized = standardized.replace(regex, standard);
    }
    return standardized;
  }
  mergeStrategyResults(strategyResults, query, options) {
    const merged = new Map();
    const strategyWeights = {
      fts5_optimized: 1.0,
      ai_semantic: 0.9,
      category_specific: 0.8,
      local_fuzzy: 0.7,
    };
    strategyResults.forEach(({ strategy, results, confidence }) => {
      const weight = strategyWeights[strategy] || 0.5;
      results.forEach(result => {
        const existing = merged.get(result.entry.id);
        if (existing) {
          const boost = weight * confidence * 0.2;
          existing.score = Math.min(100, existing.score + boost);
          existing.metadata = {
            ...existing.metadata,
            multiStrategy: true,
            strategies: [...(existing.metadata?.strategies || []), strategy],
          };
        } else {
          merged.set(result.entry.id, {
            ...result,
            score: result.score * weight * confidence,
            metadata: {
              ...result.metadata,
              strategy,
              strategyWeight: weight,
              strategyConfidence: confidence,
            },
          });
        }
      });
    });
    return Array.from(merged.values()).sort((a, b) => b.score - a.score);
  }
  recordStrategyPerformance(strategyName, executionTime, success) {
    if (!this.strategyMetrics.has(strategyName)) {
      this.strategyMetrics.set(strategyName, {
        usage: 0,
        totalTime: 0,
        successCount: 0,
        failureCount: 0,
      });
    }
    const metrics = this.strategyMetrics.get(strategyName);
    metrics.usage++;
    metrics.totalTime += executionTime;
    if (success) {
      metrics.successCount++;
    } else {
      metrics.failureCount++;
    }
  }
  async recordOptimization(query, optimization, results, executionTime) {
    const improvement = this.calculateActualImprovement(results, optimization);
    this.optimizationHistory.push({
      query,
      optimization,
      resultImprovement: improvement,
      timestamp: Date.now(),
    });
    if (this.optimizationHistory.length > 1000) {
      this.optimizationHistory = this.optimizationHistory.slice(-1000);
    }
    this.emit('optimization-recorded', {
      query,
      improvement,
      executionTime,
    });
  }
  calculateActualImprovement(results, optimization) {
    const avgScore =
      results.length > 0 ? results.reduce((sum, r) => sum + r.score, 0) / results.length : 0;
    return Math.min(100, avgScore);
  }
  calculateSemanticAlignment(query, entry) {
    const queryTerms = query.toLowerCase().split(/\s+/);
    const entryText = `${entry.title} ${entry.problem} ${entry.solution}`.toLowerCase();
    const matches = queryTerms.filter(term => entryText.includes(term));
    return (matches.length / queryTerms.length) * 100;
  }
  calculateHistoricalPerformance(entry) {
    const totalRatings = entry.success_count + entry.failure_count;
    if (totalRatings === 0) return 50;
    const successRate = entry.success_count / totalRatings;
    const usageBoost = Math.min(20, Math.log(entry.usage_count + 1) * 3);
    return successRate * 80 + usageBoost;
  }
  calculateContextRelevance(entry, options) {
    let relevance = 50;
    if (options.category && entry.category === options.category) {
      relevance += 30;
    }
    if (options.tags && options.tags.length > 0) {
      const matchingTags = options.tags.filter(tag =>
        entry.tags.some(entryTag => entryTag.toLowerCase().includes(tag.toLowerCase()))
      );
      relevance += (matchingTags.length / options.tags.length) * 20;
    }
    return Math.min(100, relevance);
  }
  calculateDiversityPenalty(result, allResults, index) {
    if (index === 0) return 0;
    let penalty = 0;
    const currentCategory = result.entry.category;
    const currentTags = result.entry.tags;
    for (let i = 0; i < index; i++) {
      const otherResult = allResults[i];
      if (otherResult.entry.category === currentCategory) {
        penalty += 2;
      }
      const commonTags = currentTags.filter(tag => otherResult.entry.tags.includes(tag));
      penalty += commonTags.length * 0.5;
    }
    return Math.min(20, penalty);
  }
  calculateRankingConfidence(result, position, totalResults) {
    const positionFactor = 1 - position / totalResults;
    const scoreFactor = result.score / 100;
    return Math.round((positionFactor * 0.6 + scoreFactor * 0.4) * 100);
  }
  cacheOptimization(key, optimization) {
    if (this.queryCache.size >= this.performanceThresholds.cacheSize) {
      const firstKey = this.queryCache.keys().next().value;
      this.queryCache.delete(firstKey);
    }
    this.queryCache.set(key, optimization);
  }
  calculateOptimizationConfidence(original, optimized, analysis) {
    let confidence = 0.5;
    if (optimized !== original) confidence += 0.2;
    if (analysis.entities.length > 0) confidence += 0.2;
    if (analysis.patterns.length > 0) confidence += 0.1;
    return Math.min(1, confidence);
  }
  estimateImprovement(original, optimized, analysis) {
    let improvement = 0;
    if (optimized !== original) improvement += 15;
    if (analysis.entities.length > 0) improvement += 10;
    if (analysis.complexity > 0.7) improvement += 20;
    return Math.min(100, improvement);
  }
  async fallbackSearch(query, entries, options, searchMethods) {
    const localSearch = searchMethods.get('local');
    if (localSearch) {
      return localSearch(query, entries, options);
    }
    return [];
  }
  initializeOptimizer() {
    setInterval(() => {
      this.cleanupCache();
    }, 300000);
    console.log('✅ SearchOptimizer initialized');
  }
  cleanupCache() {
    const now = Date.now();
    const maxAge = 3600000;
    this.optimizationHistory = this.optimizationHistory.filter(
      entry => now - entry.timestamp < maxAge
    );
    if (this.optimizationHistory.length > 500) {
      this.optimizationHistory = this.optimizationHistory.slice(-500);
    }
  }
  getMetrics() {
    const topStrategies = Array.from(this.strategyMetrics.entries())
      .map(([name, metrics]) => ({
        name,
        usage: metrics.usage,
        avgTime: metrics.totalTime / metrics.usage,
        successRate: metrics.successCount / (metrics.successCount + metrics.failureCount),
      }))
      .sort((a, b) => b.usage - a.usage);
    const avgImprovement =
      this.optimizationHistory.length > 0
        ? this.optimizationHistory.reduce((sum, opt) => sum + opt.resultImprovement, 0) /
          this.optimizationHistory.length
        : 0;
    const successRate =
      this.optimizationHistory.length > 0
        ? this.optimizationHistory.filter(opt => opt.resultImprovement > 50).length /
          this.optimizationHistory.length
        : 0;
    return {
      totalOptimizations: this.optimizationHistory.length,
      averageImprovement: Math.round(avgImprovement),
      successRate: Math.round(successRate * 100) / 100,
      topStrategies: topStrategies.slice(0, 5),
      performanceBottlenecks: this.identifyBottlenecks(),
    };
  }
  identifyBottlenecks() {
    const bottlenecks = [];
    this.strategyMetrics.forEach((metrics, name) => {
      const avgTime = metrics.totalTime / metrics.usage;
      if (avgTime > this.performanceThresholds.maxQueryTime) {
        bottlenecks.push(`Strategy ${name} averaging ${Math.round(avgTime)}ms`);
      }
    });
    const cacheSize = this.queryCache.size;
    if (cacheSize < this.performanceThresholds.cacheSize * 0.5) {
      bottlenecks.push('Low query optimization cache utilization');
    }
    return bottlenecks;
  }
}
exports.SearchOptimizer = SearchOptimizer;
exports.default = SearchOptimizer;
//# sourceMappingURL=SearchOptimizer.js.map
