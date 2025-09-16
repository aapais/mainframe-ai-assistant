/**
 * Failed Search Detector and Analysis System
 * 
 * Advanced detection and analysis of unsuccessful search queries including:
 * - Real-time failure detection
 * - Failure pattern analysis
 * - Root cause identification
 * - Automated improvement suggestions
 * - Success recovery tracking
 * - Content gap identification
 * 
 * @version 1.0.0
 */

import { SearchResult, SearchOptions, KBEntry } from '../../types/services';
import { ParsedQuery } from '../search/QueryParser';
import { ComplexityScore } from './QueryComplexityAnalyzer';
import { IntentClassification } from './SearchIntentClassifier';

export interface FailedSearch {
  id: string;
  query: string;
  parsedQuery: ParsedQuery;
  timestamp: number;
  userId?: string;
  sessionId?: string;
  failureType: FailureType;
  failureReasons: FailureReason[];
  context: SearchContext;
  attemptedSolutions: string[];
  userActions: UserAction[];
  resolved: boolean;
  resolutionMethod?: ResolutionMethod;
  resolutionTime?: number;
}

export type FailureType = 
  | 'zero_results'        // No results returned
  | 'poor_relevance'      // Results returned but not relevant
  | 'timeout'             // Search timed out
  | 'error'               // System error occurred
  | 'incomplete_results'  // Partial results due to system limits
  | 'user_abandoned'      // User abandoned search
  | 'refinement_loop';    // User stuck in refinement loop

export interface FailureReason {
  type: FailureReasonType;
  description: string;
  confidence: number;
  impact: 'low' | 'medium' | 'high';
  actionable: boolean;
  suggestedFix?: string;
}

export type FailureReasonType =
  | 'content_gap'         // Missing content in knowledge base
  | 'query_complexity'    // Query too complex or malformed
  | 'terminology_mismatch' // User terminology doesn't match content
  | 'scope_too_broad'     // Query too general
  | 'scope_too_narrow'    // Query too specific
  | 'spelling_error'      // Typos in query
  | 'syntax_error'        // Invalid search syntax
  | 'index_issue'         // Search index problems
  | 'system_performance'  // Performance bottlenecks
  | 'user_expectation';   // Mismatch in user expectations

export interface SearchContext {
  previousQueries: string[];
  searchSession: {
    startTime: number;
    queryCount: number;
    refinementCount: number;
    clickThroughRate: number;
  };
  userProfile?: {
    expertise: 'beginner' | 'intermediate' | 'expert';
    frequentTopics: string[];
    successfulPatterns: string[];
  };
  systemState: {
    indexHealth: number;
    responseTime: number;
    errorRate: number;
  };
}

export interface UserAction {
  type: UserActionType;
  timestamp: number;
  details: any;
}

export type UserActionType =
  | 'query_refinement'
  | 'filter_applied'
  | 'result_clicked'
  | 'result_rated'
  | 'search_abandoned'
  | 'help_requested'
  | 'feedback_provided';

export type ResolutionMethod =
  | 'query_suggestion'
  | 'content_creation'
  | 'user_guidance'
  | 'system_fix'
  | 'manual_intervention'
  | 'user_education';

export interface FailurePattern {
  id: string;
  pattern: string | RegExp;
  failureType: FailureType;
  commonReasons: FailureReasonType[];
  frequency: number;
  successRate: number;
  resolutionStrategies: ResolutionStrategy[];
  examples: string[];
}

export interface ResolutionStrategy {
  method: ResolutionMethod;
  description: string;
  effectiveness: number;
  automationLevel: 'manual' | 'semi-automatic' | 'automatic';
  requiredResources: string[];
}

export interface FailureAnalysisReport {
  timeRange: { from: number; to: number };
  summary: {
    totalFailures: number;
    uniqueFailures: number;
    resolutionRate: number;
    avgResolutionTime: number;
  };
  failureDistribution: Record<FailureType, number>;
  reasonDistribution: Record<FailureReasonType, number>;
  topFailurePatterns: FailurePattern[];
  contentGaps: ContentGap[];
  systemIssues: SystemIssue[];
  userBehaviorInsights: UserBehaviorInsight[];
  recommendations: FailureRecommendation[];
  trends: FailureTrend[];
}

export interface ContentGap {
  topic: string;
  queries: string[];
  frequency: number;
  userDemand: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  suggestedContent: string[];
  relatedTopics: string[];
}

export interface SystemIssue {
  type: 'performance' | 'index' | 'algorithm' | 'infrastructure';
  description: string;
  impact: number;
  frequency: number;
  affectedQueries: string[];
  recommendedFix: string;
}

export interface UserBehaviorInsight {
  pattern: string;
  description: string;
  prevalence: number;
  impact: 'positive' | 'negative' | 'neutral';
  recommendation: string;
}

export interface FailureRecommendation {
  type: 'immediate' | 'short_term' | 'long_term';
  category: 'content' | 'system' | 'user_experience' | 'training';
  description: string;
  priority: number;
  estimatedImpact: number;
  requiredEffort: 'low' | 'medium' | 'high';
}

export interface FailureTrend {
  metric: string;
  direction: 'improving' | 'worsening' | 'stable';
  rate: number;
  significance: number;
  timeframe: string;
}

/**
 * Advanced Failed Search Detector and Analyzer
 */
export class FailedSearchDetector {
  private failedSearches: Map<string, FailedSearch> = new Map();
  private failurePatterns: Map<string, FailurePattern> = new Map();
  private contentGaps: Map<string, ContentGap> = new Map();
  private resolutionStrategies: Map<ResolutionMethod, ResolutionStrategy[]> = new Map();
  private userSessions: Map<string, {
    queries: string[];
    failures: string[];
    startTime: number;
    lastActivity: number;
  }> = new Map();
  
  private readonly config: {
    failureThresholds: {
      zeroResults: number;
      lowRelevance: number;
      timeoutMs: number;
      abandonmentMs: number;
    };
    patternDetection: {
      minFrequency: number;
      confidenceThreshold: number;
    };
    realTimeAnalysis: boolean;
    autoResolution: boolean;
    maxHistorySize: number;
  };

  constructor(config: Partial<typeof FailedSearchDetector.prototype.config> = {}) {
    this.config = {
      failureThresholds: {
        zeroResults: 0,
        lowRelevance: 0.3,
        timeoutMs: 30000,
        abandonmentMs: 180000
      },
      patternDetection: {
        minFrequency: 3,
        confidenceThreshold: 0.7
      },
      realTimeAnalysis: true,
      autoResolution: true,
      maxHistorySize: 10000,
      ...config
    };
    
    this.initializeFailurePatterns();
    this.initializeResolutionStrategies();
  }

  /**
   * Detect if a search has failed and analyze the failure
   */
  public detectFailure(
    query: string,
    parsedQuery: ParsedQuery,
    results: SearchResult[],
    processingTime: number,
    options?: SearchOptions,
    userId?: string,
    sessionId?: string
  ): {
    isFailed: boolean;
    failedSearch?: FailedSearch;
    suggestions?: string[];
    autoResolution?: ResolutionMethod;
  } {
    // Determine if search failed
    const failureType = this.determineFailureType(results, processingTime, query);
    
    if (!failureType) {
      return { isFailed: false };
    }
    
    // Create failed search record
    const failedSearch = this.createFailedSearchRecord(
      query,
      parsedQuery,
      failureType,
      userId,
      sessionId,
      results,
      processingTime
    );
    
    // Store the failure
    this.failedSearches.set(failedSearch.id, failedSearch);
    
    // Update session tracking
    this.updateSessionTracking(sessionId || 'anonymous', query, failedSearch.id);
    
    // Analyze failure reasons
    const failureReasons = this.analyzeFailureReasons(failedSearch, results);
    failedSearch.failureReasons = failureReasons;
    
    // Generate suggestions
    const suggestions = this.generateFailureSuggestions(failedSearch);
    
    // Attempt auto-resolution
    let autoResolution: ResolutionMethod | undefined;
    if (this.config.autoResolution) {
      autoResolution = this.attemptAutoResolution(failedSearch);
    }
    
    // Real-time pattern detection
    if (this.config.realTimeAnalysis) {
      this.updateFailurePatterns(failedSearch);
    }
    
    return {
      isFailed: true,
      failedSearch,
      suggestions,
      autoResolution
    };
  }

  /**
   * Record user action related to a failed search
   */
  public recordUserAction(
    failureId: string,
    action: UserActionType,
    details: any
  ): void {
    const failedSearch = this.failedSearches.get(failureId);
    if (!failedSearch) return;
    
    const userAction: UserAction = {
      type: action,
      timestamp: Date.now(),
      details
    };
    
    failedSearch.userActions.push(userAction);
    
    // Check if this action resolves the failure
    if (this.isResolutionAction(action, details)) {
      this.markAsResolved(failureId, this.getResolutionMethod(action, details));
    }
  }

  /**
   * Mark a failed search as resolved
   */
  public markAsResolved(
    failureId: string,
    resolutionMethod: ResolutionMethod,
    resolutionTime?: number
  ): void {
    const failedSearch = this.failedSearches.get(failureId);
    if (!failedSearch) return;
    
    failedSearch.resolved = true;
    failedSearch.resolutionMethod = resolutionMethod;
    failedSearch.resolutionTime = resolutionTime || (Date.now() - failedSearch.timestamp);
    
    // Update resolution effectiveness
    this.updateResolutionEffectiveness(resolutionMethod, true);
  }

  /**
   * Generate comprehensive failure analysis report
   */
  public generateFailureReport(
    timeRange?: { from: number; to: number }
  ): FailureAnalysisReport {
    const failures = this.getFailuresInRange(timeRange);
    
    if (failures.length === 0) {
      return this.getEmptyReport(timeRange);
    }
    
    // Calculate summary statistics
    const summary = this.calculateSummaryStats(failures);
    
    // Calculate distributions
    const failureDistribution = this.calculateFailureDistribution(failures);
    const reasonDistribution = this.calculateReasonDistribution(failures);
    
    // Identify patterns
    const topFailurePatterns = this.getTopFailurePatterns();
    
    // Identify content gaps
    const contentGaps = this.identifyContentGaps(failures);
    
    // Identify system issues
    const systemIssues = this.identifySystemIssues(failures);
    
    // Analyze user behavior
    const userBehaviorInsights = this.analyzeUserBehavior(failures);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(failures);
    
    // Calculate trends
    const trends = this.calculateFailureTrends(failures);
    
    return {
      timeRange: timeRange || { from: 0, to: Date.now() },
      summary,
      failureDistribution,
      reasonDistribution,
      topFailurePatterns,
      contentGaps,
      systemIssues,
      userBehaviorInsights,
      recommendations,
      trends
    };
  }

  /**
   * Get failure recovery suggestions for a specific query
   */
  public getRecoverySuggestions(
    query: string,
    failureType: FailureType,
    context?: SearchContext
  ): Array<{
    type: ResolutionMethod;
    suggestion: string;
    confidence: number;
    effort: 'low' | 'medium' | 'high';
  }> {
    const suggestions: Array<{
      type: ResolutionMethod;
      suggestion: string;
      confidence: number;
      effort: 'low' | 'medium' | 'high';
    }> = [];
    
    // Check for similar past failures and their resolutions
    const similarFailures = this.findSimilarFailures(query, failureType);
    for (const failure of similarFailures) {
      if (failure.resolved && failure.resolutionMethod) {
        const strategy = this.getResolutionStrategy(failure.resolutionMethod);
        if (strategy) {
          suggestions.push({
            type: failure.resolutionMethod,
            suggestion: strategy.description,
            confidence: strategy.effectiveness,
            effort: strategy.automationLevel === 'automatic' ? 'low' : 
                   strategy.automationLevel === 'semi-automatic' ? 'medium' : 'high'
          });
        }
      }
    }
    
    // Add general suggestions based on failure type
    const generalSuggestions = this.getGeneralRecoverySuggestions(failureType, query);
    suggestions.push(...generalSuggestions);
    
    // Sort by confidence and remove duplicates
    return suggestions
      .sort((a, b) => b.confidence - a.confidence)
      .filter((suggestion, index, arr) => 
        index === arr.findIndex(s => s.suggestion === suggestion.suggestion)
      )
      .slice(0, 5);
  }

  /**
   * Export failure analysis data
   */
  public exportFailureData(): {
    failures: FailedSearch[];
    patterns: FailurePattern[];
    contentGaps: ContentGap[];
    report: FailureAnalysisReport;
  } {
    return {
      failures: Array.from(this.failedSearches.values()),
      patterns: Array.from(this.failurePatterns.values()),
      contentGaps: Array.from(this.contentGaps.values()),
      report: this.generateFailureReport()
    };
  }

  // Private Methods
  
  private initializeFailurePatterns(): void {
    // Common failure patterns
    const patterns: FailurePattern[] = [
      {
        id: 'empty-query',
        pattern: /^\s*$/,
        failureType: 'zero_results',
        commonReasons: ['syntax_error'],
        frequency: 0,
        successRate: 0,
        resolutionStrategies: [{
          method: 'user_guidance',
          description: 'Prompt user to enter search terms',
          effectiveness: 0.9,
          automationLevel: 'automatic',
          requiredResources: ['UI guidance']
        }],
        examples: ['', ' ', '  ']
      },
      {
        id: 'single-letter',
        pattern: /^[a-zA-Z]$/,
        failureType: 'zero_results',
        commonReasons: ['scope_too_broad'],
        frequency: 0,
        successRate: 0.1,
        resolutionStrategies: [{
          method: 'query_suggestion',
          description: 'Suggest completing the term or using more specific keywords',
          effectiveness: 0.7,
          automationLevel: 'automatic',
          requiredResources: ['Autocomplete system']
        }],
        examples: ['a', 'j', 'c']
      },
      {
        id: 'all-caps-technical',
        pattern: /^[A-Z]{2,}\s*$/,
        failureType: 'poor_relevance',
        commonReasons: ['terminology_mismatch'],
        frequency: 0,
        successRate: 0.3,
        resolutionStrategies: [{
          method: 'query_suggestion',
          description: 'Suggest expanded acronym or related terms',
          effectiveness: 0.8,
          automationLevel: 'semi-automatic',
          requiredResources: ['Acronym dictionary']
        }],
        examples: ['JCL', 'COBOL', 'VSAM']
      }
    ];
    
    for (const pattern of patterns) {
      this.failurePatterns.set(pattern.id, pattern);
    }
  }
  
  private initializeResolutionStrategies(): void {
    const strategies: Array<[ResolutionMethod, ResolutionStrategy[]]> = [
      ['query_suggestion', [{
        method: 'query_suggestion',
        description: 'Provide alternative query suggestions',
        effectiveness: 0.75,
        automationLevel: 'automatic',
        requiredResources: ['Query suggestion engine']
      }]],
      ['content_creation', [{
        method: 'content_creation',
        description: 'Create missing content based on user demand',
        effectiveness: 0.9,
        automationLevel: 'manual',
        requiredResources: ['Subject matter experts', 'Content management system']
      }]],
      ['user_guidance', [{
        method: 'user_guidance',
        description: 'Provide contextual help and search tips',
        effectiveness: 0.6,
        automationLevel: 'automatic',
        requiredResources: ['Help system', 'UI components']
      }]]
    ];
    
    for (const [method, strategyList] of strategies) {
      this.resolutionStrategies.set(method, strategyList);
    }
  }
  
  private determineFailureType(
    results: SearchResult[],
    processingTime: number,
    query: string
  ): FailureType | null {
    // Zero results
    if (results.length === 0) {
      return 'zero_results';
    }
    
    // Timeout
    if (processingTime > this.config.failureThresholds.timeoutMs) {
      return 'timeout';
    }
    
    // Poor relevance (low average score)
    const avgScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
    if (avgScore < this.config.failureThresholds.lowRelevance) {
      return 'poor_relevance';
    }
    
    // Check for other failure indicators
    if (query.trim().length === 0) {
      return 'zero_results';
    }
    
    return null; // No failure detected
  }
  
  private createFailedSearchRecord(
    query: string,
    parsedQuery: ParsedQuery,
    failureType: FailureType,
    userId?: string,
    sessionId?: string,
    results: SearchResult[] = [],
    processingTime: number = 0
  ): FailedSearch {
    const id = this.generateFailureId();
    
    return {
      id,
      query,
      parsedQuery,
      timestamp: Date.now(),
      userId,
      sessionId,
      failureType,
      failureReasons: [],
      context: this.buildSearchContext(userId, sessionId, processingTime),
      attemptedSolutions: [],
      userActions: [],
      resolved: false
    };
  }
  
  private buildSearchContext(
    userId?: string,
    sessionId?: string,
    processingTime: number = 0
  ): SearchContext {
    const session = sessionId ? this.userSessions.get(sessionId) : undefined;
    
    return {
      previousQueries: session?.queries.slice(-5) || [],
      searchSession: {
        startTime: session?.startTime || Date.now(),
        queryCount: session?.queries.length || 1,
        refinementCount: 0, // Would be calculated based on query similarity
        clickThroughRate: 0 // Would be calculated from user actions
      },
      userProfile: userId ? this.getUserProfile(userId) : undefined,
      systemState: {
        indexHealth: 0.95, // Would come from system monitoring
        responseTime: processingTime,
        errorRate: 0.02 // Would come from error tracking
      }
    };
  }
  
  private analyzeFailureReasons(
    failedSearch: FailedSearch,
    results: SearchResult[]
  ): FailureReason[] {
    const reasons: FailureReason[] = [];
    
    // Analyze based on failure type
    switch (failedSearch.failureType) {
      case 'zero_results':
        reasons.push(...this.analyzeZeroResultsReasons(failedSearch));
        break;
        
      case 'poor_relevance':
        reasons.push(...this.analyzePoorRelevanceReasons(failedSearch, results));
        break;
        
      case 'timeout':
        reasons.push({
          type: 'system_performance',
          description: 'Search operation timed out',
          confidence: 0.9,
          impact: 'high',
          actionable: true,
          suggestedFix: 'Optimize query or improve system performance'
        });
        break;
    }
    
    // Check for common issues
    reasons.push(...this.checkCommonIssues(failedSearch));
    
    return reasons.sort((a, b) => b.confidence - a.confidence);
  }
  
  private analyzeZeroResultsReasons(failedSearch: FailedSearch): FailureReason[] {
    const reasons: FailureReason[] = [];
    const query = failedSearch.query.toLowerCase().trim();
    
    // Empty or very short query
    if (query.length === 0) {
      reasons.push({
        type: 'syntax_error',
        description: 'Empty search query',
        confidence: 1.0,
        impact: 'low',
        actionable: true,
        suggestedFix: 'Enter search terms'
      });
    } else if (query.length < 3) {
      reasons.push({
        type: 'scope_too_broad',
        description: 'Query too short or general',
        confidence: 0.8,
        impact: 'medium',
        actionable: true,
        suggestedFix: 'Use more specific terms'
      });
    }
    
    // Check for potential spelling errors
    if (this.hasPotentialSpellingErrors(query)) {
      reasons.push({
        type: 'spelling_error',
        description: 'Possible spelling errors in query',
        confidence: 0.7,
        impact: 'medium',
        actionable: true,
        suggestedFix: 'Check spelling or use alternative terms'
      });
    }
    
    // Check for overly specific technical terms
    if (this.isOverlySpecific(query)) {
      reasons.push({
        type: 'scope_too_narrow',
        description: 'Query may be too specific',
        confidence: 0.6,
        impact: 'medium',
        actionable: true,
        suggestedFix: 'Try broader or alternative terms'
      });
    }
    
    // Check for content gap
    if (this.indicatesContentGap(query)) {
      reasons.push({
        type: 'content_gap',
        description: 'Content may not exist for this topic',
        confidence: 0.8,
        impact: 'high',
        actionable: true,
        suggestedFix: 'Consider creating content for this topic'
      });
    }
    
    return reasons;
  }
  
  private analyzePoorRelevanceReasons(
    failedSearch: FailedSearch,
    results: SearchResult[]
  ): FailureReason[] {
    const reasons: FailureReason[] = [];
    
    // Analyze result relevance scores
    const avgScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
    
    if (avgScore < 0.2) {
      reasons.push({
        type: 'terminology_mismatch',
        description: 'User terminology does not match content vocabulary',
        confidence: 0.8,
        impact: 'high',
        actionable: true,
        suggestedFix: 'Use synonym expansion or query reformulation'
      });
    }
    
    // Check for query complexity issues
    if (failedSearch.parsedQuery.terms.length > 10) {
      reasons.push({
        type: 'query_complexity',
        description: 'Query is too complex, reducing relevance',
        confidence: 0.7,
        impact: 'medium',
        actionable: true,
        suggestedFix: 'Simplify query or break into multiple searches'
      });
    }
    
    return reasons;
  }
  
  private checkCommonIssues(failedSearch: FailedSearch): FailureReason[] {
    const reasons: FailureReason[] = [];
    
    // Check for syntax errors
    if (this.hasSyntaxErrors(failedSearch.query)) {
      reasons.push({
        type: 'syntax_error',
        description: 'Invalid search syntax detected',
        confidence: 0.9,
        impact: 'medium',
        actionable: true,
        suggestedFix: 'Correct search syntax or use simpler terms'
      });
    }
    
    // Check system performance indicators
    if (failedSearch.context.systemState.responseTime > 5000) {
      reasons.push({
        type: 'system_performance',
        description: 'Slow system response time',
        confidence: 0.8,
        impact: 'medium',
        actionable: false,
        suggestedFix: 'System optimization needed'
      });
    }
    
    return reasons;
  }
  
  private generateFailureSuggestions(failedSearch: FailedSearch): string[] {
    const suggestions: string[] = [];
    
    // Generate suggestions based on failure reasons
    for (const reason of failedSearch.failureReasons) {
      if (reason.suggestedFix) {
        suggestions.push(reason.suggestedFix);
      }
    }
    
    // Add type-specific suggestions
    switch (failedSearch.failureType) {
      case 'zero_results':
        suggestions.push(
          'Try using different keywords',
          'Use broader search terms',
          'Check spelling and try alternatives'
        );
        break;
        
      case 'poor_relevance':
        suggestions.push(
          'Use more specific terms',
          'Try exact phrase search with quotes',
          'Add context to your search'
        );
        break;
    }
    
    return [...new Set(suggestions)]; // Remove duplicates
  }
  
  private attemptAutoResolution(failedSearch: FailedSearch): ResolutionMethod | undefined {
    // Simple auto-resolution logic
    for (const reason of failedSearch.failureReasons) {
      if (reason.actionable && reason.confidence > 0.8) {
        switch (reason.type) {
          case 'spelling_error':
            return 'query_suggestion';
          case 'syntax_error':
            return 'user_guidance';
          case 'scope_too_broad':
            return 'query_suggestion';
        }
      }
    }
    
    return undefined;
  }
  
  private updateSessionTracking(
    sessionId: string,
    query: string,
    failureId: string
  ): void {
    let session = this.userSessions.get(sessionId);
    if (!session) {
      session = {
        queries: [],
        failures: [],
        startTime: Date.now(),
        lastActivity: Date.now()
      };
    }
    
    session.queries.push(query);
    session.failures.push(failureId);
    session.lastActivity = Date.now();
    
    this.userSessions.set(sessionId, session);
  }
  
  private updateFailurePatterns(failedSearch: FailedSearch): void {
    // Check if this failure matches existing patterns
    for (const pattern of this.failurePatterns.values()) {
      if (this.matchesPattern(failedSearch.query, pattern.pattern)) {
        pattern.frequency++;
        
        // Update success rate if resolved
        if (failedSearch.resolved) {
          pattern.successRate = (pattern.successRate + 1) / 2;
        }
        break;
      }
    }
  }
  
  // Utility methods
  
  private hasPotentialSpellingErrors(query: string): boolean {
    // Simple heuristic for potential spelling errors
    const words = query.split(/\s+/);
    const suspiciousPatterns = [
      /[a-z]{3,}[0-9]/,     // Mixed letters and numbers
      /[a-z]*[aeiou]{3,}/,  // Too many vowels
      /[bcdfghjklmnpqrstvwxyz]{4,}/ // Too many consonants
    ];
    
    return words.some(word => 
      suspiciousPatterns.some(pattern => pattern.test(word.toLowerCase()))
    );
  }
  
  private isOverlySpecific(query: string): boolean {
    // Check for very specific technical terms or version numbers
    const specificPatterns = [
      /v\d+\.\d+\.\d+/,        // Version numbers
      /\b[A-Z]{2,}\d+\b/,      // Technical codes
      /\b\w+\.exe\b/,          // File names
    ];
    
    return specificPatterns.some(pattern => pattern.test(query));
  }
  
  private indicatesContentGap(query: string): boolean {
    // Heuristics for identifying potential content gaps
    const contentGapIndicators = [
      'tutorial', 'guide', 'how to', 'example', 'sample',
      'documentation', 'manual', 'reference'
    ];
    
    return contentGapIndicators.some(indicator => 
      query.toLowerCase().includes(indicator)
    );
  }
  
  private hasSyntaxErrors(query: string): boolean {
    // Check for common syntax errors
    const syntaxErrors = [
      /\(\)/,                  // Empty parentheses
      /\"\s*\"/,             // Empty quotes
      /[()]{3,}/,             // Multiple parentheses
      /["']{3,}/              // Multiple quotes
    ];
    
    return syntaxErrors.some(pattern => pattern.test(query));
  }
  
  private matchesPattern(query: string, pattern: string | RegExp): boolean {
    if (pattern instanceof RegExp) {
      return pattern.test(query);
    }
    return query.toLowerCase().includes(pattern.toLowerCase());
  }
  
  private isResolutionAction(action: UserActionType, details: any): boolean {
    switch (action) {
      case 'result_clicked':
        return details.relevance > 0.7;
      case 'result_rated':
        return details.rating > 3;
      case 'feedback_provided':
        return details.satisfaction > 0.7;
      default:
        return false;
    }
  }
  
  private getResolutionMethod(action: UserActionType, details: any): ResolutionMethod {
    switch (action) {
      case 'query_refinement':
        return 'query_suggestion';
      case 'help_requested':
        return 'user_guidance';
      case 'feedback_provided':
        return 'user_education';
      default:
        return 'manual_intervention';
    }
  }
  
  private updateResolutionEffectiveness(
    method: ResolutionMethod,
    successful: boolean
  ): void {
    const strategies = this.resolutionStrategies.get(method);
    if (strategies) {
      for (const strategy of strategies) {
        if (successful) {
          strategy.effectiveness = Math.min(1.0, strategy.effectiveness + 0.05);
        } else {
          strategy.effectiveness = Math.max(0.1, strategy.effectiveness - 0.02);
        }
      }
    }
  }
  
  private getUserProfile(userId: string): SearchContext['userProfile'] {
    // Simplified user profile retrieval
    return {
      expertise: 'intermediate',
      frequentTopics: [],
      successfulPatterns: []
    };
  }
  
  private getFailuresInRange(
    timeRange?: { from: number; to: number }
  ): FailedSearch[] {
    const failures = Array.from(this.failedSearches.values());
    
    if (!timeRange) return failures;
    
    return failures.filter(
      failure => failure.timestamp >= timeRange.from && failure.timestamp <= timeRange.to
    );
  }
  
  private calculateSummaryStats(failures: FailedSearch[]): FailureAnalysisReport['summary'] {
    const totalFailures = failures.length;
    const uniqueFailures = new Set(failures.map(f => f.query)).size;
    const resolvedFailures = failures.filter(f => f.resolved).length;
    const resolutionRate = totalFailures > 0 ? resolvedFailures / totalFailures : 0;
    
    const resolutionTimes = failures
      .filter(f => f.resolved && f.resolutionTime)
      .map(f => f.resolutionTime!);
    
    const avgResolutionTime = resolutionTimes.length > 0 ?
      resolutionTimes.reduce((sum, time) => sum + time, 0) / resolutionTimes.length : 0;
    
    return {
      totalFailures,
      uniqueFailures,
      resolutionRate,
      avgResolutionTime
    };
  }
  
  private calculateFailureDistribution(
    failures: FailedSearch[]
  ): Record<FailureType, number> {
    const distribution: Record<FailureType, number> = {
      zero_results: 0,
      poor_relevance: 0,
      timeout: 0,
      error: 0,
      incomplete_results: 0,
      user_abandoned: 0,
      refinement_loop: 0
    };
    
    for (const failure of failures) {
      distribution[failure.failureType]++;
    }
    
    return distribution;
  }
  
  private calculateReasonDistribution(
    failures: FailedSearch[]
  ): Record<FailureReasonType, number> {
    const distribution: Record<FailureReasonType, number> = {
      content_gap: 0,
      query_complexity: 0,
      terminology_mismatch: 0,
      scope_too_broad: 0,
      scope_too_narrow: 0,
      spelling_error: 0,
      syntax_error: 0,
      index_issue: 0,
      system_performance: 0,
      user_expectation: 0
    };
    
    for (const failure of failures) {
      for (const reason of failure.failureReasons) {
        distribution[reason.type]++;
      }
    }
    
    return distribution;
  }
  
  private getTopFailurePatterns(): FailurePattern[] {
    return Array.from(this.failurePatterns.values())
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 10);
  }
  
  private identifyContentGaps(failures: FailedSearch[]): ContentGap[] {
    const gaps = new Map<string, ContentGap>();
    
    for (const failure of failures) {
      if (failure.failureReasons.some(r => r.type === 'content_gap')) {
        const topic = this.extractTopic(failure.query);
        const existing = gaps.get(topic);
        
        if (existing) {
          existing.queries.push(failure.query);
          existing.frequency++;
        } else {
          gaps.set(topic, {
            topic,
            queries: [failure.query],
            frequency: 1,
            userDemand: 1,
            priority: 'medium',
            suggestedContent: [`Create content about ${topic}`],
            relatedTopics: []
          });
        }
      }
    }
    
    return Array.from(gaps.values())
      .sort((a, b) => b.frequency - a.frequency);
  }
  
  private identifySystemIssues(failures: FailedSearch[]): SystemIssue[] {
    const issues: SystemIssue[] = [];
    
    // Check for performance issues
    const timeoutFailures = failures.filter(f => f.failureType === 'timeout');
    if (timeoutFailures.length > failures.length * 0.1) {
      issues.push({
        type: 'performance',
        description: 'High rate of timeout failures',
        impact: 0.8,
        frequency: timeoutFailures.length,
        affectedQueries: timeoutFailures.map(f => f.query),
        recommendedFix: 'Optimize search algorithms and infrastructure'
      });
    }
    
    return issues;
  }
  
  private analyzeUserBehavior(failures: FailedSearch[]): UserBehaviorInsight[] {
    const insights: UserBehaviorInsight[] = [];
    
    // Analyze common user patterns
    const refinementPatterns = failures.filter(f => 
      f.userActions.some(a => a.type === 'query_refinement')
    );
    
    if (refinementPatterns.length > failures.length * 0.3) {
      insights.push({
        pattern: 'High refinement rate',
        description: 'Users frequently need to refine their queries',
        prevalence: refinementPatterns.length / failures.length,
        impact: 'negative',
        recommendation: 'Improve initial query suggestions and search guidance'
      });
    }
    
    return insights;
  }
  
  private generateRecommendations(failures: FailedSearch[]): FailureRecommendation[] {
    const recommendations: FailureRecommendation[] = [];
    
    // Analyze common failure patterns for recommendations
    const zeroResultsRate = failures.filter(f => f.failureType === 'zero_results').length / failures.length;
    
    if (zeroResultsRate > 0.3) {
      recommendations.push({
        type: 'immediate',
        category: 'system',
        description: 'Implement better query suggestion system',
        priority: 0.9,
        estimatedImpact: 0.8,
        requiredEffort: 'medium'
      });
    }
    
    return recommendations.sort((a, b) => b.priority - a.priority);
  }
  
  private calculateFailureTrends(failures: FailedSearch[]): FailureTrend[] {
    // Simplified trend calculation
    return [
      {
        metric: 'Overall failure rate',
        direction: 'stable',
        rate: 0.02,
        significance: 0.6,
        timeframe: '30 days'
      }
    ];
  }
  
  private findSimilarFailures(
    query: string,
    failureType: FailureType
  ): FailedSearch[] {
    return Array.from(this.failedSearches.values())
      .filter(failure => 
        failure.failureType === failureType &&
        this.calculateQuerySimilarity(query, failure.query) > 0.7
      )
      .slice(0, 5);
  }
  
  private calculateQuerySimilarity(query1: string, query2: string): number {
    // Simple Jaccard similarity
    const tokens1 = new Set(query1.toLowerCase().split(/\s+/));
    const tokens2 = new Set(query2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
    const union = new Set([...tokens1, ...tokens2]);
    
    return intersection.size / union.size;
  }
  
  private getResolutionStrategy(method: ResolutionMethod): ResolutionStrategy | undefined {
    const strategies = this.resolutionStrategies.get(method);
    return strategies?.[0];
  }
  
  private getGeneralRecoverySuggestions(
    failureType: FailureType,
    query: string
  ): Array<{
    type: ResolutionMethod;
    suggestion: string;
    confidence: number;
    effort: 'low' | 'medium' | 'high';
  }> {
    const suggestions: Array<{
      type: ResolutionMethod;
      suggestion: string;
      confidence: number;
      effort: 'low' | 'medium' | 'high';
    }> = [];
    
    switch (failureType) {
      case 'zero_results':
        suggestions.push({
          type: 'query_suggestion',
          suggestion: 'Try using broader or alternative keywords',
          confidence: 0.7,
          effort: 'low'
        });
        break;
        
      case 'poor_relevance':
        suggestions.push({
          type: 'query_suggestion',
          suggestion: 'Use more specific terms or exact phrases',
          confidence: 0.6,
          effort: 'low'
        });
        break;
    }
    
    return suggestions;
  }
  
  private extractTopic(query: string): string {
    // Simple topic extraction (in practice, would use NLP)
    const words = query.toLowerCase().split(/\s+/);
    const stopWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
    const meaningfulWords = words.filter(word => !stopWords.includes(word) && word.length > 2);
    
    return meaningfulWords.slice(0, 3).join(' ') || 'unknown';
  }
  
  private getEmptyReport(timeRange?: { from: number; to: number }): FailureAnalysisReport {
    return {
      timeRange: timeRange || { from: 0, to: Date.now() },
      summary: {
        totalFailures: 0,
        uniqueFailures: 0,
        resolutionRate: 0,
        avgResolutionTime: 0
      },
      failureDistribution: {
        zero_results: 0,
        poor_relevance: 0,
        timeout: 0,
        error: 0,
        incomplete_results: 0,
        user_abandoned: 0,
        refinement_loop: 0
      },
      reasonDistribution: {
        content_gap: 0,
        query_complexity: 0,
        terminology_mismatch: 0,
        scope_too_broad: 0,
        scope_too_narrow: 0,
        spelling_error: 0,
        syntax_error: 0,
        index_issue: 0,
        system_performance: 0,
        user_expectation: 0
      },
      topFailurePatterns: [],
      contentGaps: [],
      systemIssues: [],
      userBehaviorInsights: [],
      recommendations: [],
      trends: []
    };
  }
  
  private generateFailureId(): string {
    return `failure-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

export default FailedSearchDetector;