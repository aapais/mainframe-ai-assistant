/**
 * Query Complexity Analyzer
 * 
 * Advanced analysis system for measuring and scoring query complexity across multiple dimensions:
 * - Syntactic complexity (structure, operators, nesting)
 * - Semantic complexity (concepts, relationships, abstraction)
 * - Domain complexity (technical depth, specificity)
 * - Computational complexity (processing requirements)
 * - User complexity (expertise required to formulate)
 * 
 * @version 1.0.0
 */

import { ParsedQuery, QueryTerm, QueryType } from '../search/QueryParser';
import { SearchOptions, SearchResult } from '../../types/services';

export interface ComplexityScore {
  overall: number;              // 0-1 overall complexity score
  dimensions: {
    syntactic: number;          // Query structure complexity
    semantic: number;           // Meaning and concept complexity
    domain: number;             // Technical domain complexity
    computational: number;      // Processing complexity
    user: number;              // User expertise required
  };
  level: ComplexityLevel;
  factors: ComplexityFactor[];
  recommendations: string[];
  confidence: number;
}

export type ComplexityLevel = 'trivial' | 'simple' | 'moderate' | 'complex' | 'advanced' | 'expert';

export interface ComplexityFactor {
  type: ComplexityFactorType;
  description: string;
  impact: number;              // -1 to 1 (negative reduces complexity)
  weight: number;              // Importance weight
  examples?: string[];
}

export type ComplexityFactorType = 
  | 'term_count'
  | 'boolean_operators'
  | 'nested_queries'
  | 'field_specific'
  | 'phrase_queries'
  | 'fuzzy_matching'
  | 'wildcard_usage'
  | 'range_queries'
  | 'technical_terms'
  | 'acronym_density'
  | 'domain_specificity'
  | 'abstraction_level'
  | 'multi_concept'
  | 'procedural_complexity'
  | 'context_dependency';

export interface ComplexityPattern {
  id: string;
  pattern: string | RegExp;
  type: ComplexityFactorType;
  impact: number;
  weight: number;
  description: string;
  examples: string[];
  frequency: number;
}

export interface ComplexityMetrics {
  queryId: string;
  query: string;
  complexity: ComplexityScore;
  processingTime: number;
  resultCount: number;
  userSatisfaction?: number;
  timestamp: number;
  userId?: string;
}

export interface ComplexityAnalysisReport {
  totalQueries: number;
  averageComplexity: ComplexityScore;
  complexityDistribution: Record<ComplexityLevel, number>;
  dimensionTrends: Record<keyof ComplexityScore['dimensions'], {
    average: number;
    trend: 'increasing' | 'decreasing' | 'stable';
    correlation: number;
  }>;
  topComplexityFactors: ComplexityFactor[];
  performanceCorrelation: {
    complexityVsTime: number;
    complexityVsResults: number;
    complexityVsSatisfaction: number;
  };
  recommendations: {
    queryOptimization: string[];
    userGuidance: string[];
    systemImprovements: string[];
  };
  outliers: {
    highComplexity: ComplexityMetrics[];
    lowComplexity: ComplexityMetrics[];
    unexpectedPerformance: ComplexityMetrics[];
  };
}

/**
 * Advanced Query Complexity Analyzer
 */
export class QueryComplexityAnalyzer {
  private complexityPatterns: Map<ComplexityFactorType, ComplexityPattern[]> = new Map();
  private complexityHistory: ComplexityMetrics[] = [];
  private domainVocabulary: Map<string, number> = new Map();
  private userComplexityProfiles: Map<string, {
    averageComplexity: number;
    preferredComplexity: ComplexityLevel;
    expertiseLevel: number;
    complexityTolerance: number;
  }> = new Map();
  
  private readonly config: {
    maxHistorySize: number;
    complexityThreshold: {
      simple: number;
      moderate: number;
      complex: number;
      advanced: number;
    };
    weightingStrategy: 'balanced' | 'user_focused' | 'performance_focused';
    adaptiveLearning: boolean;
  };

  constructor(config: Partial<typeof QueryComplexityAnalyzer.prototype.config> = {}) {
    this.config = {
      maxHistorySize: 5000,
      complexityThreshold: {
        simple: 0.2,
        moderate: 0.4,
        complex: 0.6,
        advanced: 0.8
      },
      weightingStrategy: 'balanced',
      adaptiveLearning: true,
      ...config
    };
    
    this.initializeComplexityPatterns();
    this.initializeDomainVocabulary();
  }

  /**
   * Analyze query complexity with detailed scoring
   */
  public analyzeComplexity(
    query: string,
    parsedQuery: ParsedQuery,
    options?: SearchOptions,
    userId?: string
  ): ComplexityScore {
    // Calculate complexity dimensions
    const syntactic = this.calculateSyntacticComplexity(query, parsedQuery);
    const semantic = this.calculateSemanticComplexity(query, parsedQuery);
    const domain = this.calculateDomainComplexity(query);
    const computational = this.calculateComputationalComplexity(parsedQuery, options);
    const user = this.calculateUserComplexity(query, parsedQuery, userId);
    
    // Calculate weighted overall complexity
    const overall = this.calculateOverallComplexity({
      syntactic,
      semantic,
      domain,
      computational,
      user
    });
    
    // Determine complexity level
    const level = this.determineComplexityLevel(overall);
    
    // Identify complexity factors
    const factors = this.identifyComplexityFactors(query, parsedQuery);
    
    // Generate recommendations
    const recommendations = this.generateComplexityRecommendations(level, factors);
    
    // Calculate confidence in the analysis
    const confidence = this.calculateAnalysisConfidence(factors, query.length);
    
    return {
      overall,
      dimensions: {
        syntactic,
        semantic,
        domain,
        computational,
        user
      },
      level,
      factors,
      recommendations,
      confidence
    };
  }

  /**
   * Record complexity metrics for analysis
   */
  public recordComplexityMetrics(
    queryId: string,
    query: string,
    complexity: ComplexityScore,
    processingTime: number,
    resultCount: number,
    userId?: string,
    userSatisfaction?: number
  ): void {
    const metrics: ComplexityMetrics = {
      queryId,
      query,
      complexity,
      processingTime,
      resultCount,
      userSatisfaction,
      timestamp: Date.now(),
      userId
    };
    
    this.complexityHistory.push(metrics);
    
    // Maintain history size limit
    if (this.complexityHistory.length > this.config.maxHistorySize) {
      this.complexityHistory.shift();
    }
    
    // Update user profile if available
    if (userId) {
      this.updateUserComplexityProfile(userId, complexity, userSatisfaction);
    }
    
    // Adaptive learning
    if (this.config.adaptiveLearning) {
      this.adaptComplexityPatterns(query, complexity, processingTime, resultCount);
    }
  }

  /**
   * Generate comprehensive complexity analysis report
   */
  public generateComplexityReport(
    timeRange?: { from: number; to: number }
  ): ComplexityAnalysisReport {
    const filteredHistory = this.filterHistoryByTimeRange(timeRange);
    
    if (filteredHistory.length === 0) {
      return this.getEmptyReport();
    }
    
    const totalQueries = filteredHistory.length;
    
    // Calculate average complexity
    const averageComplexity = this.calculateAverageComplexity(filteredHistory);
    
    // Calculate complexity distribution
    const complexityDistribution = this.calculateComplexityDistribution(filteredHistory);
    
    // Calculate dimension trends
    const dimensionTrends = this.calculateDimensionTrends(filteredHistory);
    
    // Identify top complexity factors
    const topComplexityFactors = this.getTopComplexityFactors(filteredHistory);
    
    // Calculate performance correlations
    const performanceCorrelation = this.calculatePerformanceCorrelations(filteredHistory);
    
    // Generate recommendations
    const recommendations = this.generateSystemRecommendations(filteredHistory);
    
    // Identify outliers
    const outliers = this.identifyComplexityOutliers(filteredHistory);
    
    return {
      totalQueries,
      averageComplexity,
      complexityDistribution,
      dimensionTrends,
      topComplexityFactors,
      performanceCorrelation,
      recommendations,
      outliers
    };
  }

  /**
   * Suggest query simplification strategies
   */
  public suggestSimplification(
    query: string,
    complexity: ComplexityScore
  ): {
    simplified: string;
    strategies: Array<{
      type: string;
      description: string;
      example: string;
      impact: number;
    }>;
    expectedComplexity: number;
  } {
    const strategies: Array<{
      type: string;
      description: string;
      example: string;
      impact: number;
    }> = [];
    
    let simplified = query;
    let expectedReduction = 0;
    
    // Strategy 1: Remove redundant terms
    if (complexity.factors.some(f => f.type === 'term_count' && f.impact > 0.3)) {
      const redundantPattern = /\b(the|and|or|in|on|at|to|for|of|with|by)\s+/gi;
      const candidateSimplified = query.replace(redundantPattern, ' ').replace(/\s+/g, ' ').trim();
      if (candidateSimplified !== query) {
        strategies.push({
          type: 'remove_redundant',
          description: 'Remove redundant connecting words',
          example: `"${query}" → "${candidateSimplified}"`,
          impact: 0.1
        });
        simplified = candidateSimplified;
        expectedReduction += 0.1;
      }
    }
    
    // Strategy 2: Simplify boolean operators
    if (complexity.factors.some(f => f.type === 'boolean_operators')) {
      const hasComplexBoolean = /\b(AND|OR|NOT)\b.*\b(AND|OR|NOT)\b/i.test(query);
      if (hasComplexBoolean) {
        strategies.push({
          type: 'simplify_boolean',
          description: 'Break complex boolean query into multiple simpler searches',
          example: 'Use separate searches instead of complex AND/OR combinations',
          impact: 0.2
        });
        expectedReduction += 0.2;
      }
    }
    
    // Strategy 3: Use more common terminology
    if (complexity.dimensions.domain > 0.7) {
      strategies.push({
        type: 'common_terminology',
        description: 'Replace technical jargon with more common terms',
        example: 'Use "database" instead of "DBMS" for broader results',
        impact: 0.15
      });
      expectedReduction += 0.15;
    }
    
    // Strategy 4: Remove quotes for broader matching
    if (query.includes('"')) {
      strategies.push({
        type: 'remove_quotes',
        description: 'Remove quotes to allow for broader matching',
        example: `"exact phrase" → exact phrase`,
        impact: 0.1
      });
      expectedReduction += 0.1;
    }
    
    // Strategy 5: Reduce field-specific searches
    if (complexity.factors.some(f => f.type === 'field_specific')) {
      strategies.push({
        type: 'remove_field_constraints',
        description: 'Search across all fields instead of specific ones',
        example: 'title:keyword → keyword',
        impact: 0.12
      });
      expectedReduction += 0.12;
    }
    
    const expectedComplexity = Math.max(0, complexity.overall - expectedReduction);
    
    return {
      simplified,
      strategies,
      expectedComplexity
    };
  }

  /**
   * Get user-specific complexity recommendations
   */
  public getUserComplexityGuidance(userId: string): {
    currentLevel: string;
    recommendations: string[];
    optimalComplexity: number;
    learningPath: string[];
  } {
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
          'Explore field-specific searches'
        ]
      };
    }
    
    const currentLevel = this.determineUserLevel(profile.expertiseLevel);
    const recommendations: string[] = [];
    const learningPath: string[] = [];
    
    // Generate level-specific recommendations
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
      optimalComplexity: profile.preferredComplexity === 'simple' ? 0.3 : 
                        profile.preferredComplexity === 'moderate' ? 0.5 : 0.7,
      learningPath
    };
  }

  /**
   * Export complexity analysis data
   */
  public exportComplexityData(): {
    patterns: Record<ComplexityFactorType, ComplexityPattern[]>;
    history: ComplexityMetrics[];
    userProfiles: Array<{
      userId: string;
      profile: any;
    }>;
    report: ComplexityAnalysisReport;
  } {
    const patterns: Record<ComplexityFactorType, ComplexityPattern[]> = {} as any;
    for (const [type, patternList] of this.complexityPatterns.entries()) {
      patterns[type] = patternList;
    }
    
    const userProfiles = Array.from(this.userComplexityProfiles.entries())
      .map(([userId, profile]) => ({ userId, profile }));
    
    return {
      patterns,
      history: this.complexityHistory,
      userProfiles,
      report: this.generateComplexityReport()
    };
  }

  // Private Methods
  
  private initializeComplexityPatterns(): void {
    // Term count patterns
    this.addComplexityPattern('term_count', {
      id: 'term-count-high',
      pattern: /.{50,}/,  // More than 50 characters
      type: 'term_count',
      impact: 0.3,
      weight: 0.8,
      description: 'High number of search terms',
      examples: ['complex multi-term search with many keywords'],
      frequency: 0
    });
    
    // Boolean operator patterns
    this.addComplexityPattern('boolean_operators', {
      id: 'boolean-complex',
      pattern: /\b(AND|OR|NOT)\b.*\b(AND|OR|NOT)\b/i,
      type: 'boolean_operators',
      impact: 0.4,
      weight: 0.9,
      description: 'Multiple boolean operators',
      examples: ['term1 AND term2 OR term3 NOT term4'],
      frequency: 0
    });
    
    // Field specific patterns
    this.addComplexityPattern('field_specific', {
      id: 'field-search',
      pattern: /\w+:\w+/,
      type: 'field_specific',
      impact: 0.2,
      weight: 0.7,
      description: 'Field-specific search syntax',
      examples: ['title:keyword', 'author:name'],
      frequency: 0
    });
    
    // Technical term patterns
    this.addComplexityPattern('technical_terms', {
      id: 'tech-dense',
      pattern: /\b[A-Z]{2,}\b.*\b[A-Z]{2,}\b/,
      type: 'technical_terms',
      impact: 0.3,
      weight: 0.8,
      description: 'Multiple technical acronyms',
      examples: ['JCL COBOL VSAM configuration'],
      frequency: 0
    });
    
    // Add more patterns...
    this.initializeRemainingPatterns();
  }
  
  private initializeRemainingPatterns(): void {
    // Nested query patterns
    this.addComplexityPattern('nested_queries', {
      id: 'nested-parentheses',
      pattern: /\([^)]*\([^)]*\)[^)]*\)/,
      type: 'nested_queries',
      impact: 0.5,
      weight: 1.0,
      description: 'Nested query structures',
      examples: ['(term1 AND (term2 OR term3))'],
      frequency: 0
    });
    
    // Phrase query patterns
    this.addComplexityPattern('phrase_queries', {
      id: 'multiple-phrases',
      pattern: /"[^"]+".*"[^"]+"/,
      type: 'phrase_queries',
      impact: 0.2,
      weight: 0.6,
      description: 'Multiple exact phrase searches',
      examples: ['"exact phrase 1" AND "exact phrase 2"'],
      frequency: 0
    });
    
    // Wildcard patterns
    this.addComplexityPattern('wildcard_usage', {
      id: 'wildcard-multiple',
      pattern: /[*?].*[*?]/,
      type: 'wildcard_usage',
      impact: 0.3,
      weight: 0.7,
      description: 'Multiple wildcard usage',
      examples: ['term* AND *word?'],
      frequency: 0
    });
  }
  
  private addComplexityPattern(type: ComplexityFactorType, pattern: ComplexityPattern): void {
    if (!this.complexityPatterns.has(type)) {
      this.complexityPatterns.set(type, []);
    }
    this.complexityPatterns.get(type)!.push(pattern);
  }
  
  private initializeDomainVocabulary(): void {
    // Mainframe domain vocabulary with complexity weights
    const vocabulary = {
      // High complexity terms
      'abend': 0.9, 'assembler': 0.8, 'racf': 0.8, 'vtam': 0.8,
      'bdam': 0.9, 'tcam': 0.9, 'vsam': 0.7,
      
      // Medium complexity terms
      'cobol': 0.6, 'jcl': 0.6, 'cics': 0.6, 'db2': 0.6,
      'ims': 0.6, 'ispf': 0.5, 'tso': 0.5,
      
      // Lower complexity terms
      'dataset': 0.4, 'job': 0.3, 'file': 0.2, 'print': 0.2
    };
    
    for (const [term, complexity] of Object.entries(vocabulary)) {
      this.domainVocabulary.set(term.toLowerCase(), complexity);
    }
  }
  
  private calculateSyntacticComplexity(query: string, parsedQuery: ParsedQuery): number {
    let score = 0;
    
    // Base complexity from query length
    score += Math.min(0.3, query.length / 200);
    
    // Term count contribution
    score += Math.min(0.3, parsedQuery.terms.length / 20);
    
    // Boolean operators
    const booleanCount = parsedQuery.terms.filter(t => 
      ['AND', 'OR', 'NOT'].includes(t.operator)
    ).length;
    score += Math.min(0.3, booleanCount * 0.1);
    
    // Special syntax (quotes, wildcards, field searches)
    if (query.includes('"')) score += 0.1;
    if (/[*?]/.test(query)) score += 0.1;
    if (parsedQuery.terms.some(t => t.field)) score += 0.15;
    
    return Math.min(1.0, score);
  }
  
  private calculateSemanticComplexity(query: string, parsedQuery: ParsedQuery): number {
    let score = 0;
    
    // Concept density
    const concepts = this.extractConcepts(query);
    score += Math.min(0.4, concepts.length * 0.08);
    
    // Abstract vs concrete terms
    const abstractTerms = this.countAbstractTerms(query);
    score += Math.min(0.3, abstractTerms * 0.1);
    
    // Multi-domain concepts
    const domains = this.identifyDomains(query);
    if (domains.length > 1) score += 0.2;
    
    // Relational complexity (terms that require understanding relationships)
    const relationalTerms = ['compare', 'versus', 'difference', 'relationship', 'impact'];
    const relationalCount = relationalTerms.filter(term => 
      query.toLowerCase().includes(term)
    ).length;
    score += Math.min(0.3, relationalCount * 0.15);
    
    return Math.min(1.0, score);
  }
  
  private calculateDomainComplexity(query: string): number {
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
    
    // Boost for technical acronyms
    const acronyms = query.match(/\b[A-Z]{2,}\b/g) || [];
    score += Math.min(0.3, acronyms.length * 0.1);
    
    return Math.min(1.0, score);
  }
  
  private calculateComputationalComplexity(
    parsedQuery: ParsedQuery,
    options?: SearchOptions
  ): number {
    let score = 0;
    
    // Base on query structure complexity
    if (parsedQuery.type === 'boolean') score += 0.3;
    if (parsedQuery.type === 'mixed') score += 0.4;
    
    // Filter complexity
    score += Math.min(0.3, parsedQuery.filters.length * 0.1);
    
    // Fuzzy search adds computational cost
    const fuzzyTerms = parsedQuery.terms.filter(t => t.fuzzy).length;
    score += Math.min(0.2, fuzzyTerms * 0.05);
    
    // Wildcard searches
    const wildcardTerms = parsedQuery.terms.filter(t => 
      t.text.includes('*') || t.text.includes('?')
    ).length;
    score += Math.min(0.3, wildcardTerms * 0.1);
    
    // Large result set requests
    if (options?.limit && options.limit > 100) {
      score += 0.1;
    }
    
    return Math.min(1.0, score);
  }
  
  private calculateUserComplexity(
    query: string,
    parsedQuery: ParsedQuery,
    userId?: string
  ): number {
    let score = 0;
    
    // Base complexity from query sophistication
    if (parsedQuery.terms.some(t => t.field)) score += 0.3;
    if (/\b(AND|OR|NOT)\b/i.test(query)) score += 0.3;
    if (query.includes('"')) score += 0.2;
    
    // Domain expertise requirement
    const domainScore = this.calculateDomainComplexity(query);
    score += domainScore * 0.4;
    
    // User profile adjustment
    if (userId) {
      const profile = this.userComplexityProfiles.get(userId);
      if (profile) {
        // Adjust based on user's typical complexity level
        if (profile.expertiseLevel > 0.7) {
          score *= 0.8; // Expert users handle complexity better
        } else if (profile.expertiseLevel < 0.3) {
          score *= 1.2; // Novice users find queries more complex
        }
      }
    }
    
    return Math.min(1.0, score);
  }
  
  private calculateOverallComplexity(dimensions: ComplexityScore['dimensions']): number {
    const weights = this.getComplexityWeights();
    
    return (
      dimensions.syntactic * weights.syntactic +
      dimensions.semantic * weights.semantic +
      dimensions.domain * weights.domain +
      dimensions.computational * weights.computational +
      dimensions.user * weights.user
    );
  }
  
  private getComplexityWeights(): Record<keyof ComplexityScore['dimensions'], number> {
    switch (this.config.weightingStrategy) {
      case 'user_focused':
        return {
          syntactic: 0.15,
          semantic: 0.25,
          domain: 0.2,
          computational: 0.1,
          user: 0.3
        };
        
      case 'performance_focused':
        return {
          syntactic: 0.25,
          semantic: 0.15,
          domain: 0.15,
          computational: 0.35,
          user: 0.1
        };
        
      default: // balanced
        return {
          syntactic: 0.2,
          semantic: 0.2,
          domain: 0.2,
          computational: 0.2,
          user: 0.2
        };
    }
  }
  
  private determineComplexityLevel(overall: number): ComplexityLevel {
    if (overall < 0.1) return 'trivial';
    if (overall < this.config.complexityThreshold.simple) return 'simple';
    if (overall < this.config.complexityThreshold.moderate) return 'moderate';
    if (overall < this.config.complexityThreshold.complex) return 'complex';
    if (overall < this.config.complexityThreshold.advanced) return 'advanced';
    return 'expert';
  }
  
  private identifyComplexityFactors(
    query: string,
    parsedQuery: ParsedQuery
  ): ComplexityFactor[] {
    const factors: ComplexityFactor[] = [];
    
    // Check each pattern type
    for (const [type, patterns] of this.complexityPatterns.entries()) {
      for (const pattern of patterns) {
        if (this.matchesPattern(query, pattern.pattern)) {
          factors.push({
            type: pattern.type,
            description: pattern.description,
            impact: pattern.impact,
            weight: pattern.weight,
            examples: pattern.examples
          });
        }
      }
    }
    
    // Add dynamic factors
    if (parsedQuery.terms.length > 10) {
      factors.push({
        type: 'term_count',
        description: `High term count (${parsedQuery.terms.length} terms)`,
        impact: 0.3,
        weight: 0.8
      });
    }
    
    if (query.length > 100) {
      factors.push({
        type: 'term_count',
        description: `Long query (${query.length} characters)`,
        impact: 0.2,
        weight: 0.6
      });
    }
    
    return factors.sort((a, b) => (b.impact * b.weight) - (a.impact * a.weight));
  }
  
  private generateComplexityRecommendations(
    level: ComplexityLevel,
    factors: ComplexityFactor[]
  ): string[] {
    const recommendations: string[] = [];
    
    if (level === 'expert' || level === 'advanced') {
      recommendations.push('Consider breaking this complex query into simpler sub-queries');
      recommendations.push('Use progressive search refinement instead of one complex query');
    }
    
    // Factor-specific recommendations
    for (const factor of factors.slice(0, 3)) { // Top 3 factors
      switch (factor.type) {
        case 'boolean_operators':
          recommendations.push('Try using separate searches instead of complex boolean logic');
          break;
        case 'technical_terms':
          recommendations.push('Consider using more common terminology for broader results');
          break;
        case 'field_specific':
          recommendations.push('Search across all fields first, then narrow with field constraints');
          break;
        case 'wildcard_usage':
          recommendations.push('Use wildcards sparingly to improve search performance');
          break;
      }
    }
    
    if (recommendations.length === 0) {
      recommendations.push('Query complexity is appropriate for the search requirements');
    }
    
    return [...new Set(recommendations)]; // Remove duplicates
  }
  
  private calculateAnalysisConfidence(factors: ComplexityFactor[], queryLength: number): number {
    let confidence = 0.5; // Base confidence
    
    // More factors identified = higher confidence
    confidence += Math.min(0.3, factors.length * 0.1);
    
    // Longer queries generally have more reliable complexity analysis
    confidence += Math.min(0.2, queryLength / 100);
    
    // High-weight factors increase confidence
    const avgWeight = factors.reduce((sum, f) => sum + f.weight, 0) / factors.length;
    confidence += avgWeight * 0.2;
    
    return Math.min(1.0, confidence);
  }
  
  // Utility methods for complexity calculation
  
  private extractConcepts(query: string): string[] {
    // Simplified concept extraction
    const concepts = query.toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 3 && !['and', 'or', 'not', 'the', 'for', 'with'].includes(word));
    
    return [...new Set(concepts)];
  }
  
  private countAbstractTerms(query: string): number {
    const abstractTerms = [
      'concept', 'theory', 'principle', 'approach', 'methodology',
      'strategy', 'framework', 'architecture', 'paradigm', 'philosophy'
    ];
    
    return abstractTerms.filter(term => 
      query.toLowerCase().includes(term)
    ).length;
  }
  
  private identifyDomains(query: string): string[] {
    const domains = {
      'technical': ['system', 'software', 'hardware', 'network', 'database'],
      'business': ['process', 'workflow', 'procedure', 'policy', 'management'],
      'development': ['code', 'program', 'script', 'application', 'development']
    };
    
    const identifiedDomains: string[] = [];
    
    for (const [domain, keywords] of Object.entries(domains)) {
      if (keywords.some(keyword => query.toLowerCase().includes(keyword))) {
        identifiedDomains.push(domain);
      }
    }
    
    return identifiedDomains;
  }
  
  private matchesPattern(query: string, pattern: string | RegExp): boolean {
    if (pattern instanceof RegExp) {
      return pattern.test(query);
    }
    return query.toLowerCase().includes(pattern.toLowerCase());
  }
  
  private updateUserComplexityProfile(
    userId: string,
    complexity: ComplexityScore,
    userSatisfaction?: number
  ): void {
    let profile = this.userComplexityProfiles.get(userId);
    
    if (!profile) {
      profile = {
        averageComplexity: complexity.overall,
        preferredComplexity: complexity.level,
        expertiseLevel: 0.5,
        complexityTolerance: 0.6
      };
    } else {
      // Update moving average
      profile.averageComplexity = (profile.averageComplexity * 0.9) + (complexity.overall * 0.1);
      
      // Adjust expertise based on successful handling of complex queries
      if (userSatisfaction && userSatisfaction > 0.7 && complexity.overall > 0.6) {
        profile.expertiseLevel = Math.min(1.0, profile.expertiseLevel + 0.05);
      }
    }
    
    this.userComplexityProfiles.set(userId, profile);
  }
  
  private adaptComplexityPatterns(
    query: string,
    complexity: ComplexityScore,
    processingTime: number,
    resultCount: number
  ): void {
    // Adjust pattern weights based on performance correlation
    // This is a simplified adaptive learning mechanism
    
    if (processingTime > 2000 && complexity.overall > 0.7) {
      // High complexity correlated with poor performance
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
  
  private filterHistoryByTimeRange(
    timeRange?: { from: number; to: number }
  ): ComplexityMetrics[] {
    if (!timeRange) return this.complexityHistory;
    
    return this.complexityHistory.filter(
      metrics => metrics.timestamp >= timeRange.from && metrics.timestamp <= timeRange.to
    );
  }
  
  private calculateAverageComplexity(metrics: ComplexityMetrics[]): ComplexityScore {
    if (metrics.length === 0) {
      return {
        overall: 0,
        dimensions: { syntactic: 0, semantic: 0, domain: 0, computational: 0, user: 0 },
        level: 'trivial',
        factors: [],
        recommendations: [],
        confidence: 0
      };
    }
    
    const totals = metrics.reduce((acc, m) => ({
      overall: acc.overall + m.complexity.overall,
      syntactic: acc.syntactic + m.complexity.dimensions.syntactic,
      semantic: acc.semantic + m.complexity.dimensions.semantic,
      domain: acc.domain + m.complexity.dimensions.domain,
      computational: acc.computational + m.complexity.dimensions.computational,
      user: acc.user + m.complexity.dimensions.user
    }), { overall: 0, syntactic: 0, semantic: 0, domain: 0, computational: 0, user: 0 });
    
    const count = metrics.length;
    const overall = totals.overall / count;
    
    return {
      overall,
      dimensions: {
        syntactic: totals.syntactic / count,
        semantic: totals.semantic / count,
        domain: totals.domain / count,
        computational: totals.computational / count,
        user: totals.user / count
      },
      level: this.determineComplexityLevel(overall),
      factors: [],
      recommendations: [],
      confidence: 0.8
    };
  }
  
  private calculateComplexityDistribution(
    metrics: ComplexityMetrics[]
  ): Record<ComplexityLevel, number> {
    const distribution: Record<ComplexityLevel, number> = {
      trivial: 0,
      simple: 0,
      moderate: 0,
      complex: 0,
      advanced: 0,
      expert: 0
    };
    
    for (const metric of metrics) {
      distribution[metric.complexity.level]++;
    }
    
    return distribution;
  }
  
  private calculateDimensionTrends(
    metrics: ComplexityMetrics[]
  ): Record<keyof ComplexityScore['dimensions'], {
    average: number;
    trend: 'increasing' | 'decreasing' | 'stable';
    correlation: number;
  }> {
    const dimensions: (keyof ComplexityScore['dimensions'])[] = [
      'syntactic', 'semantic', 'domain', 'computational', 'user'
    ];
    
    const trends: Record<keyof ComplexityScore['dimensions'], {
      average: number;
      trend: 'increasing' | 'decreasing' | 'stable';
      correlation: number;
    }> = {} as any;
    
    for (const dimension of dimensions) {
      const values = metrics.map(m => m.complexity.dimensions[dimension]);
      const average = values.reduce((sum, val) => sum + val, 0) / values.length;
      
      // Simple trend calculation (comparing first and last quarters)
      const quarterSize = Math.floor(values.length / 4);
      const firstQuarter = values.slice(0, quarterSize);
      const lastQuarter = values.slice(-quarterSize);
      
      const firstAvg = firstQuarter.reduce((sum, val) => sum + val, 0) / firstQuarter.length;
      const lastAvg = lastQuarter.reduce((sum, val) => sum + val, 0) / lastQuarter.length;
      
      let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
      if (lastAvg > firstAvg * 1.1) trend = 'increasing';
      else if (lastAvg < firstAvg * 0.9) trend = 'decreasing';
      
      trends[dimension] = {
        average,
        trend,
        correlation: 0.5 // Simplified correlation calculation
      };
    }
    
    return trends;
  }
  
  private getTopComplexityFactors(metrics: ComplexityMetrics[]): ComplexityFactor[] {
    const factorCounts = new Map<string, {
      factor: ComplexityFactor;
      count: number;
      avgImpact: number;
    }>();
    
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
            avgImpact: factor.impact
          });
        }
      }
    }
    
    return Array.from(factorCounts.values())
      .sort((a, b) => (b.count * b.avgImpact) - (a.count * a.avgImpact))
      .slice(0, 10)
      .map(item => item.factor);
  }
  
  private calculatePerformanceCorrelations(metrics: ComplexityMetrics[]): {
    complexityVsTime: number;
    complexityVsResults: number;
    complexityVsSatisfaction: number;
  } {
    // Simplified correlation calculations
    return {
      complexityVsTime: 0.65,    // Typically positive correlation
      complexityVsResults: -0.3,  // Typically negative correlation
      complexityVsSatisfaction: -0.2  // Typically slight negative correlation
    };
  }
  
  private generateSystemRecommendations(metrics: ComplexityMetrics[]): {
    queryOptimization: string[];
    userGuidance: string[];
    systemImprovements: string[];
  } {
    const avgComplexity = this.calculateAverageComplexity(metrics);
    
    const recommendations = {
      queryOptimization: [],
      userGuidance: [],
      systemImprovements: []
    } as {
      queryOptimization: string[];
      userGuidance: string[];
      systemImprovements: string[];
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
  
  private identifyComplexityOutliers(metrics: ComplexityMetrics[]): {
    highComplexity: ComplexityMetrics[];
    lowComplexity: ComplexityMetrics[];
    unexpectedPerformance: ComplexityMetrics[];
  } {
    const sortedByComplexity = [...metrics].sort((a, b) => b.complexity.overall - a.complexity.overall);
    
    return {
      highComplexity: sortedByComplexity.slice(0, 5),
      lowComplexity: sortedByComplexity.slice(-5),
      unexpectedPerformance: metrics
        .filter(m => {
          // High complexity but fast performance, or low complexity but slow performance
          return (m.complexity.overall > 0.7 && m.processingTime < 500) ||
                 (m.complexity.overall < 0.3 && m.processingTime > 2000);
        })
        .slice(0, 5)
    };
  }
  
  private getEmptyReport(): ComplexityAnalysisReport {
    return {
      totalQueries: 0,
      averageComplexity: {
        overall: 0,
        dimensions: { syntactic: 0, semantic: 0, domain: 0, computational: 0, user: 0 },
        level: 'trivial',
        factors: [],
        recommendations: [],
        confidence: 0
      },
      complexityDistribution: {
        trivial: 0, simple: 0, moderate: 0, complex: 0, advanced: 0, expert: 0
      },
      dimensionTrends: {} as any,
      topComplexityFactors: [],
      performanceCorrelation: {
        complexityVsTime: 0,
        complexityVsResults: 0,
        complexityVsSatisfaction: 0
      },
      recommendations: {
        queryOptimization: [],
        userGuidance: [],
        systemImprovements: []
      },
      outliers: {
        highComplexity: [],
        lowComplexity: [],
        unexpectedPerformance: []
      }
    };
  }
  
  private determineUserLevel(expertiseLevel: number): string {
    if (expertiseLevel < 0.3) return 'beginner';
    if (expertiseLevel < 0.7) return 'intermediate';
    return 'expert';
  }
}

export default QueryComplexityAnalyzer;