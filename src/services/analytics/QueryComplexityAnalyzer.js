'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.QueryComplexityAnalyzer = void 0;
class QueryComplexityAnalyzer {
  complexityPatterns = new Map();
  complexityHistory = [];
  domainVocabulary = new Map();
  userComplexityProfiles = new Map();
  config;
  constructor(config = {}) {
    this.config = {
      maxHistorySize: 5000,
      complexityThreshold: {
        simple: 0.2,
        moderate: 0.4,
        complex: 0.6,
        advanced: 0.8,
      },
      weightingStrategy: 'balanced',
      adaptiveLearning: true,
      ...config,
    };
    this.initializeComplexityPatterns();
    this.initializeDomainVocabulary();
  }
  analyzeComplexity(query, parsedQuery, options, userId) {
    const syntactic = this.calculateSyntacticComplexity(query, parsedQuery);
    const semantic = this.calculateSemanticComplexity(query, parsedQuery);
    const domain = this.calculateDomainComplexity(query);
    const computational = this.calculateComputationalComplexity(parsedQuery, options);
    const user = this.calculateUserComplexity(query, parsedQuery, userId);
    const overall = this.calculateOverallComplexity({
      syntactic,
      semantic,
      domain,
      computational,
      user,
    });
    const level = this.determineComplexityLevel(overall);
    const factors = this.identifyComplexityFactors(query, parsedQuery);
    const recommendations = this.generateComplexityRecommendations(level, factors);
    const confidence = this.calculateAnalysisConfidence(factors, query.length);
    return {
      overall,
      dimensions: {
        syntactic,
        semantic,
        domain,
        computational,
        user,
      },
      level,
      factors,
      recommendations,
      confidence,
    };
  }
  recordComplexityMetrics(
    queryId,
    query,
    complexity,
    processingTime,
    resultCount,
    userId,
    userSatisfaction
  ) {
    const metrics = {
      queryId,
      query,
      complexity,
      processingTime,
      resultCount,
      userSatisfaction,
      timestamp: Date.now(),
      userId,
    };
    this.complexityHistory.push(metrics);
    if (this.complexityHistory.length > this.config.maxHistorySize) {
      this.complexityHistory.shift();
    }
    if (userId) {
      this.updateUserComplexityProfile(userId, complexity, userSatisfaction);
    }
    if (this.config.adaptiveLearning) {
      this.adaptComplexityPatterns(query, complexity, processingTime, resultCount);
    }
  }
  generateComplexityReport(timeRange) {
    const filteredHistory = this.filterHistoryByTimeRange(timeRange);
    if (filteredHistory.length === 0) {
      return this.getEmptyReport();
    }
    const totalQueries = filteredHistory.length;
    const averageComplexity = this.calculateAverageComplexity(filteredHistory);
    const complexityDistribution = this.calculateComplexityDistribution(filteredHistory);
    const dimensionTrends = this.calculateDimensionTrends(filteredHistory);
    const topComplexityFactors = this.getTopComplexityFactors(filteredHistory);
    const performanceCorrelation = this.calculatePerformanceCorrelations(filteredHistory);
    const recommendations = this.generateSystemRecommendations(filteredHistory);
    const outliers = this.identifyComplexityOutliers(filteredHistory);
    return {
      totalQueries,
      averageComplexity,
      complexityDistribution,
      dimensionTrends,
      topComplexityFactors,
      performanceCorrelation,
      recommendations,
      outliers,
    };
  }
  suggestSimplification(query, complexity) {
    const strategies = [];
    let simplified = query;
    let expectedReduction = 0;
    if (complexity.factors.some(f => f.type === 'term_count' && f.impact > 0.3)) {
      const redundantPattern = /\b(the|and|or|in|on|at|to|for|of|with|by)\s+/gi;
      const candidateSimplified = query.replace(redundantPattern, ' ').replace(/\s+/g, ' ').trim();
      if (candidateSimplified !== query) {
        strategies.push({
          type: 'remove_redundant',
          description: 'Remove redundant connecting words',
          example: `"${query}" → "${candidateSimplified}"`,
          impact: 0.1,
        });
        simplified = candidateSimplified;
        expectedReduction += 0.1;
      }
    }
    if (complexity.factors.some(f => f.type === 'boolean_operators')) {
      const hasComplexBoolean = /\b(AND|OR|NOT)\b.*\b(AND|OR|NOT)\b/i.test(query);
      if (hasComplexBoolean) {
        strategies.push({
          type: 'simplify_boolean',
          description: 'Break complex boolean query into multiple simpler searches',
          example: 'Use separate searches instead of complex AND/OR combinations',
          impact: 0.2,
        });
        expectedReduction += 0.2;
      }
    }
    if (complexity.dimensions.domain > 0.7) {
      strategies.push({
        type: 'common_terminology',
        description: 'Replace technical jargon with more common terms',
        example: 'Use "database" instead of "DBMS" for broader results',
        impact: 0.15,
      });
      expectedReduction += 0.15;
    }
    if (query.includes('"')) {
      strategies.push({
        type: 'remove_quotes',
        description: 'Remove quotes to allow for broader matching',
        example: `"exact phrase" → exact phrase`,
        impact: 0.1,
      });
      expectedReduction += 0.1;
    }
    if (complexity.factors.some(f => f.type === 'field_specific')) {
      strategies.push({
        type: 'remove_field_constraints',
        description: 'Search across all fields instead of specific ones',
        example: 'title:keyword → keyword',
        impact: 0.12,
      });
      expectedReduction += 0.12;
    }
    const expectedComplexity = Math.max(0, complexity.overall - expectedReduction);
    return {
      simplified,
      strategies,
      expectedComplexity,
    };
  }
  getUserComplexityGuidance(userId) {
    const profile = this.userComplexityProfiles.get(userId);
    if (!profile) {
      return {
        currentLevel: 'unknown',
        recommendations: ['Start with simple keyword searches'],
        optimalComplexity: 0.3,
        learningPath: [
          'Master basic keyword searches',
          'Learn to use quotes for exact phrases',
          'Practice boolean operators (AND, OR)',
          'Explore field-specific searches',
        ],
      };
    }
    const currentLevel = this.determineUserLevel(profile.expertiseLevel);
    const recommendations = [];
    const learningPath = [];
    if (profile.expertiseLevel < 0.3) {
      recommendations.push(
        'Focus on simple, descriptive keywords',
        'Use exact phrases in quotes when you know specific terms',
        'Avoid complex boolean logic initially'
      );
      learningPath.push(
        'Practice identifying key concepts in your questions',
        'Learn when to use quotes for exact matching',
        'Understand basic AND/OR operations'
      );
    } else if (profile.expertiseLevel < 0.7) {
      recommendations.push(
        'Experiment with boolean operators for more precise results',
        'Try field-specific searches when appropriate',
        'Use wildcards sparingly for broader matching'
      );
      learningPath.push(
        'Master complex boolean combinations',
        'Learn advanced field search syntax',
        'Practice query optimization techniques'
      );
    } else {
      recommendations.push(
        'Leverage advanced search syntax for efficiency',
        'Combine multiple search strategies in single queries',
        'Help others with query construction'
      );
    }
    return {
      currentLevel,
      recommendations,
      optimalComplexity:
        profile.preferredComplexity === 'simple'
          ? 0.3
          : profile.preferredComplexity === 'moderate'
            ? 0.5
            : 0.7,
      learningPath,
    };
  }
  exportComplexityData() {
    const patterns = {};
    for (const [type, patternList] of this.complexityPatterns.entries()) {
      patterns[type] = patternList;
    }
    const userProfiles = Array.from(this.userComplexityProfiles.entries()).map(
      ([userId, profile]) => ({ userId, profile })
    );
    return {
      patterns,
      history: this.complexityHistory,
      userProfiles,
      report: this.generateComplexityReport(),
    };
  }
  initializeComplexityPatterns() {
    this.addComplexityPattern('term_count', {
      id: 'term-count-high',
      pattern: /.{50,}/,
      type: 'term_count',
      impact: 0.3,
      weight: 0.8,
      description: 'High number of search terms',
      examples: ['complex multi-term search with many keywords'],
      frequency: 0,
    });
    this.addComplexityPattern('boolean_operators', {
      id: 'boolean-complex',
      pattern: /\b(AND|OR|NOT)\b.*\b(AND|OR|NOT)\b/i,
      type: 'boolean_operators',
      impact: 0.4,
      weight: 0.9,
      description: 'Multiple boolean operators',
      examples: ['term1 AND term2 OR term3 NOT term4'],
      frequency: 0,
    });
    this.addComplexityPattern('field_specific', {
      id: 'field-search',
      pattern: /\w+:\w+/,
      type: 'field_specific',
      impact: 0.2,
      weight: 0.7,
      description: 'Field-specific search syntax',
      examples: ['title:keyword', 'author:name'],
      frequency: 0,
    });
    this.addComplexityPattern('technical_terms', {
      id: 'tech-dense',
      pattern: /\b[A-Z]{2,}\b.*\b[A-Z]{2,}\b/,
      type: 'technical_terms',
      impact: 0.3,
      weight: 0.8,
      description: 'Multiple technical acronyms',
      examples: ['JCL COBOL VSAM configuration'],
      frequency: 0,
    });
    this.initializeRemainingPatterns();
  }
  initializeRemainingPatterns() {
    this.addComplexityPattern('nested_queries', {
      id: 'nested-parentheses',
      pattern: /\([^)]*\([^)]*\)[^)]*\)/,
      type: 'nested_queries',
      impact: 0.5,
      weight: 1.0,
      description: 'Nested query structures',
      examples: ['(term1 AND (term2 OR term3))'],
      frequency: 0,
    });
    this.addComplexityPattern('phrase_queries', {
      id: 'multiple-phrases',
      pattern: /"[^"]+".*"[^"]+"/,
      type: 'phrase_queries',
      impact: 0.2,
      weight: 0.6,
      description: 'Multiple exact phrase searches',
      examples: ['"exact phrase 1" AND "exact phrase 2"'],
      frequency: 0,
    });
    this.addComplexityPattern('wildcard_usage', {
      id: 'wildcard-multiple',
      pattern: /[*?].*[*?]/,
      type: 'wildcard_usage',
      impact: 0.3,
      weight: 0.7,
      description: 'Multiple wildcard usage',
      examples: ['term* AND *word?'],
      frequency: 0,
    });
  }
  addComplexityPattern(type, pattern) {
    if (!this.complexityPatterns.has(type)) {
      this.complexityPatterns.set(type, []);
    }
    this.complexityPatterns.get(type).push(pattern);
  }
  initializeDomainVocabulary() {
    const vocabulary = {
      abend: 0.9,
      assembler: 0.8,
      racf: 0.8,
      vtam: 0.8,
      bdam: 0.9,
      tcam: 0.9,
      vsam: 0.7,
      cobol: 0.6,
      jcl: 0.6,
      cics: 0.6,
      db2: 0.6,
      ims: 0.6,
      ispf: 0.5,
      tso: 0.5,
      dataset: 0.4,
      job: 0.3,
      file: 0.2,
      print: 0.2,
    };
    for (const [term, complexity] of Object.entries(vocabulary)) {
      this.domainVocabulary.set(term.toLowerCase(), complexity);
    }
  }
  calculateSyntacticComplexity(query, parsedQuery) {
    let score = 0;
    score += Math.min(0.3, query.length / 200);
    score += Math.min(0.3, parsedQuery.terms.length / 20);
    const booleanCount = parsedQuery.terms.filter(t =>
      ['AND', 'OR', 'NOT'].includes(t.operator)
    ).length;
    score += Math.min(0.3, booleanCount * 0.1);
    if (query.includes('"')) score += 0.1;
    if (/[*?]/.test(query)) score += 0.1;
    if (parsedQuery.terms.some(t => t.field)) score += 0.15;
    return Math.min(1.0, score);
  }
  calculateSemanticComplexity(query, parsedQuery) {
    let score = 0;
    const concepts = this.extractConcepts(query);
    score += Math.min(0.4, concepts.length * 0.08);
    const abstractTerms = this.countAbstractTerms(query);
    score += Math.min(0.3, abstractTerms * 0.1);
    const domains = this.identifyDomains(query);
    if (domains.length > 1) score += 0.2;
    const relationalTerms = ['compare', 'versus', 'difference', 'relationship', 'impact'];
    const relationalCount = relationalTerms.filter(term =>
      query.toLowerCase().includes(term)
    ).length;
    score += Math.min(0.3, relationalCount * 0.15);
    return Math.min(1.0, score);
  }
  calculateDomainComplexity(query) {
    let score = 0;
    const words = query.toLowerCase().split(/\s+/);
    let domainTermCount = 0;
    let totalComplexity = 0;
    for (const word of words) {
      const complexity = this.domainVocabulary.get(word);
      if (complexity !== undefined) {
        domainTermCount++;
        totalComplexity += complexity;
      }
    }
    if (domainTermCount > 0) {
      score = totalComplexity / domainTermCount;
    }
    const acronyms = query.match(/\b[A-Z]{2,}\b/g) || [];
    score += Math.min(0.3, acronyms.length * 0.1);
    return Math.min(1.0, score);
  }
  calculateComputationalComplexity(parsedQuery, options) {
    let score = 0;
    if (parsedQuery.type === 'boolean') score += 0.3;
    if (parsedQuery.type === 'mixed') score += 0.4;
    score += Math.min(0.3, parsedQuery.filters.length * 0.1);
    const fuzzyTerms = parsedQuery.terms.filter(t => t.fuzzy).length;
    score += Math.min(0.2, fuzzyTerms * 0.05);
    const wildcardTerms = parsedQuery.terms.filter(
      t => t.text.includes('*') || t.text.includes('?')
    ).length;
    score += Math.min(0.3, wildcardTerms * 0.1);
    if (options?.limit && options.limit > 100) {
      score += 0.1;
    }
    return Math.min(1.0, score);
  }
  calculateUserComplexity(query, parsedQuery, userId) {
    let score = 0;
    if (parsedQuery.terms.some(t => t.field)) score += 0.3;
    if (/\b(AND|OR|NOT)\b/i.test(query)) score += 0.3;
    if (query.includes('"')) score += 0.2;
    const domainScore = this.calculateDomainComplexity(query);
    score += domainScore * 0.4;
    if (userId) {
      const profile = this.userComplexityProfiles.get(userId);
      if (profile) {
        if (profile.expertiseLevel > 0.7) {
          score *= 0.8;
        } else if (profile.expertiseLevel < 0.3) {
          score *= 1.2;
        }
      }
    }
    return Math.min(1.0, score);
  }
  calculateOverallComplexity(dimensions) {
    const weights = this.getComplexityWeights();
    return (
      dimensions.syntactic * weights.syntactic +
      dimensions.semantic * weights.semantic +
      dimensions.domain * weights.domain +
      dimensions.computational * weights.computational +
      dimensions.user * weights.user
    );
  }
  getComplexityWeights() {
    switch (this.config.weightingStrategy) {
      case 'user_focused':
        return {
          syntactic: 0.15,
          semantic: 0.25,
          domain: 0.2,
          computational: 0.1,
          user: 0.3,
        };
      case 'performance_focused':
        return {
          syntactic: 0.25,
          semantic: 0.15,
          domain: 0.15,
          computational: 0.35,
          user: 0.1,
        };
      default:
        return {
          syntactic: 0.2,
          semantic: 0.2,
          domain: 0.2,
          computational: 0.2,
          user: 0.2,
        };
    }
  }
  determineComplexityLevel(overall) {
    if (overall < 0.1) return 'trivial';
    if (overall < this.config.complexityThreshold.simple) return 'simple';
    if (overall < this.config.complexityThreshold.moderate) return 'moderate';
    if (overall < this.config.complexityThreshold.complex) return 'complex';
    if (overall < this.config.complexityThreshold.advanced) return 'advanced';
    return 'expert';
  }
  identifyComplexityFactors(query, parsedQuery) {
    const factors = [];
    for (const [type, patterns] of this.complexityPatterns.entries()) {
      for (const pattern of patterns) {
        if (this.matchesPattern(query, pattern.pattern)) {
          factors.push({
            type: pattern.type,
            description: pattern.description,
            impact: pattern.impact,
            weight: pattern.weight,
            examples: pattern.examples,
          });
        }
      }
    }
    if (parsedQuery.terms.length > 10) {
      factors.push({
        type: 'term_count',
        description: `High term count (${parsedQuery.terms.length} terms)`,
        impact: 0.3,
        weight: 0.8,
      });
    }
    if (query.length > 100) {
      factors.push({
        type: 'term_count',
        description: `Long query (${query.length} characters)`,
        impact: 0.2,
        weight: 0.6,
      });
    }
    return factors.sort((a, b) => b.impact * b.weight - a.impact * a.weight);
  }
  generateComplexityRecommendations(level, factors) {
    const recommendations = [];
    if (level === 'expert' || level === 'advanced') {
      recommendations.push('Consider breaking this complex query into simpler sub-queries');
      recommendations.push('Use progressive search refinement instead of one complex query');
    }
    for (const factor of factors.slice(0, 3)) {
      switch (factor.type) {
        case 'boolean_operators':
          recommendations.push('Try using separate searches instead of complex boolean logic');
          break;
        case 'technical_terms':
          recommendations.push('Consider using more common terminology for broader results');
          break;
        case 'field_specific':
          recommendations.push(
            'Search across all fields first, then narrow with field constraints'
          );
          break;
        case 'wildcard_usage':
          recommendations.push('Use wildcards sparingly to improve search performance');
          break;
      }
    }
    if (recommendations.length === 0) {
      recommendations.push('Query complexity is appropriate for the search requirements');
    }
    return [...new Set(recommendations)];
  }
  calculateAnalysisConfidence(factors, queryLength) {
    let confidence = 0.5;
    confidence += Math.min(0.3, factors.length * 0.1);
    confidence += Math.min(0.2, queryLength / 100);
    const avgWeight = factors.reduce((sum, f) => sum + f.weight, 0) / factors.length;
    confidence += avgWeight * 0.2;
    return Math.min(1.0, confidence);
  }
  extractConcepts(query) {
    const concepts = query
      .toLowerCase()
      .split(/\s+/)
      .filter(
        word => word.length > 3 && !['and', 'or', 'not', 'the', 'for', 'with'].includes(word)
      );
    return [...new Set(concepts)];
  }
  countAbstractTerms(query) {
    const abstractTerms = [
      'concept',
      'theory',
      'principle',
      'approach',
      'methodology',
      'strategy',
      'framework',
      'architecture',
      'paradigm',
      'philosophy',
    ];
    return abstractTerms.filter(term => query.toLowerCase().includes(term)).length;
  }
  identifyDomains(query) {
    const domains = {
      technical: ['system', 'software', 'hardware', 'network', 'database'],
      business: ['process', 'workflow', 'procedure', 'policy', 'management'],
      development: ['code', 'program', 'script', 'application', 'development'],
    };
    const identifiedDomains = [];
    for (const [domain, keywords] of Object.entries(domains)) {
      if (keywords.some(keyword => query.toLowerCase().includes(keyword))) {
        identifiedDomains.push(domain);
      }
    }
    return identifiedDomains;
  }
  matchesPattern(query, pattern) {
    if (pattern instanceof RegExp) {
      return pattern.test(query);
    }
    return query.toLowerCase().includes(pattern.toLowerCase());
  }
  updateUserComplexityProfile(userId, complexity, userSatisfaction) {
    let profile = this.userComplexityProfiles.get(userId);
    if (!profile) {
      profile = {
        averageComplexity: complexity.overall,
        preferredComplexity: complexity.level,
        expertiseLevel: 0.5,
        complexityTolerance: 0.6,
      };
    } else {
      profile.averageComplexity = profile.averageComplexity * 0.9 + complexity.overall * 0.1;
      if (userSatisfaction && userSatisfaction > 0.7 && complexity.overall > 0.6) {
        profile.expertiseLevel = Math.min(1.0, profile.expertiseLevel + 0.05);
      }
    }
    this.userComplexityProfiles.set(userId, profile);
  }
  adaptComplexityPatterns(query, complexity, processingTime, resultCount) {
    if (processingTime > 2000 && complexity.overall > 0.7) {
      for (const factor of complexity.factors) {
        const patterns = this.complexityPatterns.get(factor.type);
        if (patterns) {
          for (const pattern of patterns) {
            if (this.matchesPattern(query, pattern.pattern)) {
              pattern.weight = Math.min(1.0, pattern.weight + 0.05);
            }
          }
        }
      }
    }
  }
  filterHistoryByTimeRange(timeRange) {
    if (!timeRange) return this.complexityHistory;
    return this.complexityHistory.filter(
      metrics => metrics.timestamp >= timeRange.from && metrics.timestamp <= timeRange.to
    );
  }
  calculateAverageComplexity(metrics) {
    if (metrics.length === 0) {
      return {
        overall: 0,
        dimensions: { syntactic: 0, semantic: 0, domain: 0, computational: 0, user: 0 },
        level: 'trivial',
        factors: [],
        recommendations: [],
        confidence: 0,
      };
    }
    const totals = metrics.reduce(
      (acc, m) => ({
        overall: acc.overall + m.complexity.overall,
        syntactic: acc.syntactic + m.complexity.dimensions.syntactic,
        semantic: acc.semantic + m.complexity.dimensions.semantic,
        domain: acc.domain + m.complexity.dimensions.domain,
        computational: acc.computational + m.complexity.dimensions.computational,
        user: acc.user + m.complexity.dimensions.user,
      }),
      { overall: 0, syntactic: 0, semantic: 0, domain: 0, computational: 0, user: 0 }
    );
    const count = metrics.length;
    const overall = totals.overall / count;
    return {
      overall,
      dimensions: {
        syntactic: totals.syntactic / count,
        semantic: totals.semantic / count,
        domain: totals.domain / count,
        computational: totals.computational / count,
        user: totals.user / count,
      },
      level: this.determineComplexityLevel(overall),
      factors: [],
      recommendations: [],
      confidence: 0.8,
    };
  }
  calculateComplexityDistribution(metrics) {
    const distribution = {
      trivial: 0,
      simple: 0,
      moderate: 0,
      complex: 0,
      advanced: 0,
      expert: 0,
    };
    for (const metric of metrics) {
      distribution[metric.complexity.level]++;
    }
    return distribution;
  }
  calculateDimensionTrends(metrics) {
    const dimensions = ['syntactic', 'semantic', 'domain', 'computational', 'user'];
    const trends = {};
    for (const dimension of dimensions) {
      const values = metrics.map(m => m.complexity.dimensions[dimension]);
      const average = values.reduce((sum, val) => sum + val, 0) / values.length;
      const quarterSize = Math.floor(values.length / 4);
      const firstQuarter = values.slice(0, quarterSize);
      const lastQuarter = values.slice(-quarterSize);
      const firstAvg = firstQuarter.reduce((sum, val) => sum + val, 0) / firstQuarter.length;
      const lastAvg = lastQuarter.reduce((sum, val) => sum + val, 0) / lastQuarter.length;
      let trend = 'stable';
      if (lastAvg > firstAvg * 1.1) trend = 'increasing';
      else if (lastAvg < firstAvg * 0.9) trend = 'decreasing';
      trends[dimension] = {
        average,
        trend,
        correlation: 0.5,
      };
    }
    return trends;
  }
  getTopComplexityFactors(metrics) {
    const factorCounts = new Map();
    for (const metric of metrics) {
      for (const factor of metric.complexity.factors) {
        const key = `${factor.type}:${factor.description}`;
        const existing = factorCounts.get(key);
        if (existing) {
          existing.count++;
          existing.avgImpact = (existing.avgImpact + factor.impact) / 2;
        } else {
          factorCounts.set(key, {
            factor,
            count: 1,
            avgImpact: factor.impact,
          });
        }
      }
    }
    return Array.from(factorCounts.values())
      .sort((a, b) => b.count * b.avgImpact - a.count * a.avgImpact)
      .slice(0, 10)
      .map(item => item.factor);
  }
  calculatePerformanceCorrelations(metrics) {
    return {
      complexityVsTime: 0.65,
      complexityVsResults: -0.3,
      complexityVsSatisfaction: -0.2,
    };
  }
  generateSystemRecommendations(metrics) {
    const avgComplexity = this.calculateAverageComplexity(metrics);
    const recommendations = {
      queryOptimization: [],
      userGuidance: [],
      systemImprovements: [],
    };
    if (avgComplexity.overall > 0.7) {
      recommendations.queryOptimization.push(
        'Implement query simplification suggestions',
        'Add auto-completion for common patterns',
        'Provide query templates for complex searches'
      );
      recommendations.userGuidance.push(
        'Create complexity awareness in the UI',
        'Provide progressive disclosure of advanced features',
        'Add complexity-based help suggestions'
      );
      recommendations.systemImprovements.push(
        'Optimize index structures for complex queries',
        'Implement query preprocessing optimizations',
        'Add complexity-based caching strategies'
      );
    }
    return recommendations;
  }
  identifyComplexityOutliers(metrics) {
    const sortedByComplexity = [...metrics].sort(
      (a, b) => b.complexity.overall - a.complexity.overall
    );
    return {
      highComplexity: sortedByComplexity.slice(0, 5),
      lowComplexity: sortedByComplexity.slice(-5),
      unexpectedPerformance: metrics
        .filter(m => {
          return (
            (m.complexity.overall > 0.7 && m.processingTime < 500) ||
            (m.complexity.overall < 0.3 && m.processingTime > 2000)
          );
        })
        .slice(0, 5),
    };
  }
  getEmptyReport() {
    return {
      totalQueries: 0,
      averageComplexity: {
        overall: 0,
        dimensions: { syntactic: 0, semantic: 0, domain: 0, computational: 0, user: 0 },
        level: 'trivial',
        factors: [],
        recommendations: [],
        confidence: 0,
      },
      complexityDistribution: {
        trivial: 0,
        simple: 0,
        moderate: 0,
        complex: 0,
        advanced: 0,
        expert: 0,
      },
      dimensionTrends: {},
      topComplexityFactors: [],
      performanceCorrelation: {
        complexityVsTime: 0,
        complexityVsResults: 0,
        complexityVsSatisfaction: 0,
      },
      recommendations: {
        queryOptimization: [],
        userGuidance: [],
        systemImprovements: [],
      },
      outliers: {
        highComplexity: [],
        lowComplexity: [],
        unexpectedPerformance: [],
      },
    };
  }
  determineUserLevel(expertiseLevel) {
    if (expertiseLevel < 0.3) return 'beginner';
    if (expertiseLevel < 0.7) return 'intermediate';
    return 'expert';
  }
}
exports.QueryComplexityAnalyzer = QueryComplexityAnalyzer;
exports.default = QueryComplexityAnalyzer;
//# sourceMappingURL=QueryComplexityAnalyzer.js.map
