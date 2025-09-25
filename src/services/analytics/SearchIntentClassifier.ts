/**
 * Search Intent Classifier
 *
 * Advanced machine learning-based intent classification system that:
 * - Classifies user search intent in real-time
 * - Learns from user behavior patterns
 * - Provides confidence scores and alternate classifications
 * - Supports multi-intent queries
 * - Adapts to domain-specific terminology
 *
 * @version 1.0.0
 */

import { ParsedQuery, QueryTerm } from '../search/QueryParser';
import { SearchResult, SearchOptions } from '../../types/services';

export type SearchIntent =
  | 'informational' // Seeking information/knowledge
  | 'navigational' // Finding specific content
  | 'transactional' // Performing an action
  | 'investigational' // Research/analysis
  | 'troubleshooting' // Problem solving
  | 'procedural' // Step-by-step guidance
  | 'comparative' // Comparing options
  | 'definitional' // Understanding concepts
  | 'exploratory' // Discovering new content
  | 'verification'; // Confirming information

export interface IntentClassification {
  primary: SearchIntent;
  confidence: number;
  alternatives: Array<{
    intent: SearchIntent;
    confidence: number;
    reasoning: string;
  }>;
  reasoning: string;
  isMultiIntent: boolean;
  contextFactors: string[];
  domainSpecificity: number;
}

export interface IntentFeatures {
  // Linguistic features
  questionWords: string[];
  verbs: string[];
  modifiers: string[];
  technicalTerms: string[];

  // Structural features
  queryLength: number;
  termCount: number;
  hasQuotes: boolean;
  hasWildcards: boolean;
  hasBooleanOperators: boolean;

  // Semantic features
  urgencyIndicators: string[];
  specificityLevel: number;
  abstractionLevel: number;

  // Domain features
  mainframeConcepts: string[];
  technicalAcronyms: string[];
  businessTerms: string[];
}

export interface IntentContext {
  userId?: string;
  sessionId?: string;
  previousQueries: string[];
  clickedResults: string[];
  timeOfDay: number;
  userRole?: string;
  userExpertise?: 'beginner' | 'intermediate' | 'expert';
}

export interface IntentPattern {
  intent: SearchIntent;
  patterns: Array<{
    type: 'keyword' | 'phrase' | 'structure' | 'context';
    pattern: string | RegExp;
    weight: number;
    examples: string[];
  }>;
  confidence: number;
  frequency: number;
  successRate: number;
}

export interface IntentLearningData {
  query: string;
  classifiedIntent: SearchIntent;
  actualIntent?: SearchIntent; // Ground truth from user feedback
  userInteraction: {
    clickedResults: number[];
    timeSpent: number;
    refinedQuery?: string;
    satisfied: boolean;
  };
  context: IntentContext;
  timestamp: number;
}

/**
 * Advanced Search Intent Classifier
 */
export class SearchIntentClassifier {
  private intentPatterns: Map<SearchIntent, IntentPattern[]> = new Map();
  private learningData: IntentLearningData[] = [];
  private domainVocabulary: Map<string, number> = new Map();
  private userProfiles: Map<
    string,
    {
      intentFrequency: Map<SearchIntent, number>;
      expertise: 'beginner' | 'intermediate' | 'expert';
      preferredTerminology: string[];
    }
  > = new Map();

  private readonly config: {
    confidenceThreshold: number;
    multiIntentThreshold: number;
    learningRate: number;
    maxLearningData: number;
    adaptationEnabled: boolean;
  };

  constructor(config: Partial<typeof SearchIntentClassifier.prototype.config> = {}) {
    this.config = {
      confidenceThreshold: 0.7,
      multiIntentThreshold: 0.4,
      learningRate: 0.1,
      maxLearningData: 5000,
      adaptationEnabled: true,
      ...config,
    };

    this.initializePatterns();
    this.initializeDomainVocabulary();
  }

  /**
   * Classify search intent with confidence scoring
   */
  public classifyIntent(
    query: string,
    parsedQuery: ParsedQuery,
    context?: IntentContext
  ): IntentClassification {
    // Extract features from query
    const features = this.extractFeatures(query, parsedQuery);

    // Calculate intent scores
    const intentScores = this.calculateIntentScores(query, features, context);

    // Find primary intent
    const sortedIntents = Object.entries(intentScores)
      .sort(([, a], [, b]) => b - a)
      .map(([intent, score]) => ({ intent: intent as SearchIntent, score }));

    const primary = sortedIntents[0];
    const confidence = primary.score;

    // Identify alternatives
    const alternatives = sortedIntents
      .slice(1, 4)
      .filter(({ score }) => score > this.config.multiIntentThreshold)
      .map(({ intent, score }) => ({
        intent,
        confidence: score,
        reasoning: this.generateReasoning(intent, features),
      }));

    // Check for multi-intent
    const isMultiIntent =
      alternatives.length > 0 && alternatives[0].confidence > this.config.multiIntentThreshold;

    // Generate reasoning
    const reasoning = this.generateReasoning(primary.intent, features);

    // Extract context factors
    const contextFactors = this.extractContextFactors(features, context);

    // Calculate domain specificity
    const domainSpecificity = this.calculateDomainSpecificity(features);

    return {
      primary: primary.intent,
      confidence,
      alternatives,
      reasoning,
      isMultiIntent,
      contextFactors,
      domainSpecificity,
    };
  }

  /**
   * Learn from user interactions
   */
  public learnFromInteraction(
    query: string,
    classifiedIntent: SearchIntent,
    userInteraction: IntentLearningData['userInteraction'],
    context?: IntentContext,
    actualIntent?: SearchIntent
  ): void {
    if (!this.config.adaptationEnabled) return;

    const learningData: IntentLearningData = {
      query,
      classifiedIntent,
      actualIntent,
      userInteraction,
      context: context || {},
      timestamp: Date.now(),
    };

    this.learningData.push(learningData);

    // Maintain data size limit
    if (this.learningData.length > this.config.maxLearningData) {
      this.learningData.shift();
    }

    // Update patterns based on feedback
    if (actualIntent && actualIntent !== classifiedIntent) {
      this.updatePatternsFromFeedback(learningData);
    }

    // Update user profile
    if (context?.userId) {
      this.updateUserProfile(context.userId, classifiedIntent, userInteraction.satisfied);
    }
  }

  /**
   * Get intent distribution for analysis
   */
  public getIntentDistribution(timeRange?: { from: number; to: number }): Record<
    SearchIntent,
    {
      count: number;
      percentage: number;
      avgConfidence: number;
      successRate: number;
    }
  > {
    const filteredData = this.filterLearningData(timeRange);
    const totalQueries = filteredData.length;

    const distribution: Record<
      SearchIntent,
      {
        count: number;
        percentage: number;
        avgConfidence: number;
        successRate: number;
      }
    > = {} as any;

    // Initialize all intents
    const allIntents: SearchIntent[] = [
      'informational',
      'navigational',
      'transactional',
      'investigational',
      'troubleshooting',
      'procedural',
      'comparative',
      'definitional',
      'exploratory',
      'verification',
    ];

    for (const intent of allIntents) {
      const intentData = filteredData.filter(d => d.classifiedIntent === intent);
      const successfulInteractions = intentData.filter(d => d.userInteraction.satisfied);

      distribution[intent] = {
        count: intentData.length,
        percentage: totalQueries > 0 ? (intentData.length / totalQueries) * 100 : 0,
        avgConfidence:
          intentData.length > 0 ? intentData.reduce((sum, d) => sum, 0) / intentData.length : 0,
        successRate: intentData.length > 0 ? successfulInteractions.length / intentData.length : 0,
      };
    }

    return distribution;
  }

  /**
   * Get personalized intent suggestions for user
   */
  public getPersonalizedSuggestions(
    userId: string,
    query: string,
    context?: IntentContext
  ): Array<{
    intent: SearchIntent;
    suggestion: string;
    confidence: number;
  }> {
    const userProfile = this.userProfiles.get(userId);
    if (!userProfile) {
      return [];
    }

    const suggestions: Array<{
      intent: SearchIntent;
      suggestion: string;
      confidence: number;
    }> = [];

    // Get user's frequent intents
    const frequentIntents = Array.from(userProfile.intentFrequency.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3);

    for (const [intent, frequency] of frequentIntents) {
      const suggestion = this.generateIntentSuggestion(intent, query, userProfile.expertise);
      if (suggestion) {
        suggestions.push({
          intent,
          suggestion,
          confidence: Math.min(0.9, frequency / 10),
        });
      }
    }

    return suggestions;
  }

  /**
   * Export classification model for analysis
   */
  public exportModel(): {
    patterns: Record<SearchIntent, IntentPattern[]>;
    vocabulary: Array<{ term: string; score: number }>;
    learningData: IntentLearningData[];
    performance: {
      accuracy: number;
      confidence: number;
      coverage: Record<SearchIntent, number>;
    };
  } {
    const patterns: Record<SearchIntent, IntentPattern[]> = {} as any;
    for (const [intent, patternList] of this.intentPatterns.entries()) {
      patterns[intent] = patternList;
    }

    const vocabulary = Array.from(this.domainVocabulary.entries())
      .map(([term, score]) => ({ term, score }))
      .sort((a, b) => b.score - a.score);

    const performance = this.calculateModelPerformance();

    return {
      patterns,
      vocabulary,
      learningData: this.learningData,
      performance,
    };
  }

  // Private Methods

  private initializePatterns(): void {
    // Informational intent patterns
    this.addIntentPattern('informational', [
      {
        type: 'keyword',
        pattern: /\b(what|how|why|when|where|explain|define|describe)\b/i,
        weight: 0.8,
        examples: ['What is COBOL', 'How does JCL work'],
      },
      { type: 'phrase', pattern: 'tell me about', weight: 0.7, examples: ['Tell me about VSAM'] },
      { type: 'structure', pattern: /\?$/, weight: 0.6, examples: ['What is mainframe?'] },
    ]);

    // Navigational intent patterns
    this.addIntentPattern('navigational', [
      {
        type: 'keyword',
        pattern: /\b(find|locate|search|show|display|list)\b/i,
        weight: 0.8,
        examples: ['Find COBOL examples', 'Show JCL procedures'],
      },
      {
        type: 'keyword',
        pattern: /\b(documentation|manual|guide|reference)\b/i,
        weight: 0.7,
        examples: ['COBOL documentation'],
      },
      { type: 'phrase', pattern: 'where is', weight: 0.6, examples: ['Where is the DB2 manual'] },
    ]);

    // Transactional intent patterns
    this.addIntentPattern('transactional', [
      {
        type: 'keyword',
        pattern: /\b(download|export|save|generate|create|build|compile)\b/i,
        weight: 0.9,
        examples: ['Download JCL template', 'Generate COBOL program'],
      },
      {
        type: 'keyword',
        pattern: /\b(install|setup|configure|implement)\b/i,
        weight: 0.8,
        examples: ['Install CICS'],
      },
    ]);

    // Troubleshooting intent patterns
    this.addIntentPattern('troubleshooting', [
      {
        type: 'keyword',
        pattern: /\b(error|problem|issue|fix|solve|debug|troubleshoot)\b/i,
        weight: 0.9,
        examples: ['Fix COBOL error', 'Debug JCL problem'],
      },
      {
        type: 'keyword',
        pattern: /\b(not working|failed|exception|abend)\b/i,
        weight: 0.8,
        examples: ['JCL not working'],
      },
      {
        type: 'phrase',
        pattern: 'how to fix',
        weight: 0.9,
        examples: ['How to fix SQLCODE error'],
      },
    ]);

    // Procedural intent patterns
    this.addIntentPattern('procedural', [
      {
        type: 'keyword',
        pattern: /\b(step|steps|procedure|process|tutorial|guide)\b/i,
        weight: 0.8,
        examples: ['Steps to compile COBOL'],
      },
      { type: 'phrase', pattern: /how to\b/i, weight: 0.7, examples: ['How to create dataset'] },
      {
        type: 'keyword',
        pattern: /\b(walkthrough|instructions|methodology)\b/i,
        weight: 0.7,
        examples: ['CICS installation walkthrough'],
      },
    ]);

    // Add more patterns for other intents...
    this.initializeRemainingPatterns();
  }

  private initializeRemainingPatterns(): void {
    // Investigational intent patterns
    this.addIntentPattern('investigational', [
      {
        type: 'keyword',
        pattern: /\b(analyze|research|investigate|study|compare|evaluate)\b/i,
        weight: 0.8,
        examples: ['Analyze COBOL performance'],
      },
      {
        type: 'keyword',
        pattern: /\b(best practices|comparison|alternatives|options)\b/i,
        weight: 0.7,
        examples: ['COBOL best practices'],
      },
    ]);

    // Comparative intent patterns
    this.addIntentPattern('comparative', [
      {
        type: 'keyword',
        pattern: /\b(vs|versus|compared to|difference|compare)\b/i,
        weight: 0.9,
        examples: ['COBOL vs PL/I'],
      },
      {
        type: 'keyword',
        pattern: /\b(which|better|pros and cons|advantages)\b/i,
        weight: 0.7,
        examples: ['Which is better CICS or IMS'],
      },
    ]);

    // Definitional intent patterns
    this.addIntentPattern('definitional', [
      {
        type: 'keyword',
        pattern: /\b(define|definition|meaning|what is|what are)\b/i,
        weight: 0.9,
        examples: ['Define VSAM'],
      },
      {
        type: 'keyword',
        pattern: /\b(acronym|stands for|abbreviation)\b/i,
        weight: 0.8,
        examples: ['What does JCL stand for'],
      },
    ]);

    // Exploratory intent patterns
    this.addIntentPattern('exploratory', [
      {
        type: 'keyword',
        pattern: /\b(explore|overview|introduction|learn about)\b/i,
        weight: 0.8,
        examples: ['Explore mainframe concepts'],
      },
      {
        type: 'keyword',
        pattern: /\b(topics|subjects|areas|domains)\b/i,
        weight: 0.6,
        examples: ['Mainframe topics'],
      },
    ]);

    // Verification intent patterns
    this.addIntentPattern('verification', [
      {
        type: 'keyword',
        pattern: /\b(verify|validate|check|confirm|ensure)\b/i,
        weight: 0.8,
        examples: ['Verify JCL syntax'],
      },
      {
        type: 'keyword',
        pattern: /\b(correct|right|accurate|valid)\b/i,
        weight: 0.7,
        examples: ['Is this COBOL correct'],
      },
    ]);
  }

  private addIntentPattern(intent: SearchIntent, patterns: IntentPattern['patterns']): void {
    const intentPattern: IntentPattern = {
      intent,
      patterns,
      confidence: 0.8,
      frequency: 0,
      successRate: 0.5,
    };

    if (!this.intentPatterns.has(intent)) {
      this.intentPatterns.set(intent, []);
    }
    this.intentPatterns.get(intent)!.push(intentPattern);
  }

  private initializeDomainVocabulary(): void {
    // Mainframe-specific vocabulary with weights
    const vocabulary = {
      // Systems and platforms
      mainframe: 1.0,
      'z/os': 1.0,
      mvs: 0.9,
      zvm: 0.9,
      vse: 0.8,
      cics: 1.0,
      ims: 0.9,
      db2: 1.0,
      idms: 0.8,
      adabas: 0.8,

      // Languages
      cobol: 1.0,
      pli: 0.8,
      assembler: 0.9,
      jcl: 1.0,
      rexx: 0.8,
      rpg: 0.7,
      fortran: 0.6,
      sql: 0.9,

      // Data management
      vsam: 1.0,
      qsam: 0.8,
      isam: 0.7,
      dataset: 0.9,
      gdg: 0.8,
      catalog: 0.8,
      volume: 0.7,
      dasd: 0.8,
      tape: 0.7,

      // Job control and scheduling
      jobcard: 0.9,
      proclib: 0.8,
      steplib: 0.8,
      sysin: 0.7,
      sysout: 0.7,
      allocation: 0.8,
      disposition: 0.7,

      // Tools and utilities
      ispf: 0.9,
      sdsf: 0.8,
      fileaid: 0.7,
      endevor: 0.8,
      changeman: 0.7,
      abendaid: 0.8,
      xpediter: 0.7,

      // Performance and monitoring
      rmf: 0.8,
      smf: 0.8,
      vtam: 0.8,
      racf: 0.9,
      acf2: 0.8,
      topsecret: 0.8,
      omegamon: 0.7,
    };

    for (const [term, weight] of Object.entries(vocabulary)) {
      this.domainVocabulary.set(term.toLowerCase(), weight);
    }
  }

  private extractFeatures(query: string, parsedQuery: ParsedQuery): IntentFeatures {
    const lowerQuery = query.toLowerCase();

    // Linguistic features
    const questionWords = this.extractQuestionWords(lowerQuery);
    const verbs = this.extractVerbs(lowerQuery);
    const modifiers = this.extractModifiers(lowerQuery);
    const technicalTerms = this.extractTechnicalTerms(lowerQuery);

    // Structural features
    const queryLength = query.length;
    const termCount = parsedQuery.terms.length;
    const hasQuotes = query.includes('"');
    const hasWildcards = /[*?]/.test(query);
    const hasBooleanOperators = /\b(AND|OR|NOT)\b/i.test(query);

    // Semantic features
    const urgencyIndicators = this.extractUrgencyIndicators(lowerQuery);
    const specificityLevel = this.calculateSpecificityLevel(query, parsedQuery);
    const abstractionLevel = this.calculateAbstractionLevel(lowerQuery);

    // Domain features
    const mainframeConcepts = this.extractMainframeConcepts(lowerQuery);
    const technicalAcronyms = this.extractTechnicalAcronyms(lowerQuery);
    const businessTerms = this.extractBusinessTerms(lowerQuery);

    return {
      questionWords,
      verbs,
      modifiers,
      technicalTerms,
      queryLength,
      termCount,
      hasQuotes,
      hasWildcards,
      hasBooleanOperators,
      urgencyIndicators,
      specificityLevel,
      abstractionLevel,
      mainframeConcepts,
      technicalAcronyms,
      businessTerms,
    };
  }

  private calculateIntentScores(
    query: string,
    features: IntentFeatures,
    context?: IntentContext
  ): Record<SearchIntent, number> {
    const scores: Record<SearchIntent, number> = {
      informational: 0,
      navigational: 0,
      transactional: 0,
      investigational: 0,
      troubleshooting: 0,
      procedural: 0,
      comparative: 0,
      definitional: 0,
      exploratory: 0,
      verification: 0,
    };

    // Calculate scores based on patterns
    for (const [intent, patterns] of this.intentPatterns.entries()) {
      for (const pattern of patterns) {
        for (const patternItem of pattern.patterns) {
          let patternMatch = 0;

          if (patternItem.type === 'keyword' || patternItem.type === 'phrase') {
            if (patternItem.pattern instanceof RegExp) {
              patternMatch = patternItem.pattern.test(query) ? patternItem.weight : 0;
            } else {
              patternMatch = query.toLowerCase().includes(patternItem.pattern.toLowerCase())
                ? patternItem.weight
                : 0;
            }
          }

          scores[intent] += patternMatch * pattern.confidence;
        }
      }
    }

    // Apply feature-based adjustments
    this.applyFeatureAdjustments(scores, features);

    // Apply context-based adjustments
    if (context) {
      this.applyContextAdjustments(scores, context);
    }

    // Normalize scores
    const maxScore = Math.max(...Object.values(scores));
    if (maxScore > 0) {
      for (const intent of Object.keys(scores) as SearchIntent[]) {
        scores[intent] = scores[intent] / maxScore;
      }
    }

    return scores;
  }

  private applyFeatureAdjustments(
    scores: Record<SearchIntent, number>,
    features: IntentFeatures
  ): void {
    // Question words boost informational intent
    if (features.questionWords.length > 0) {
      scores.informational += 0.3 * features.questionWords.length;
      scores.definitional += 0.2 * features.questionWords.length;
    }

    // Technical terms boost investigational intent
    if (features.technicalTerms.length > 2) {
      scores.investigational += 0.2;
      scores.troubleshooting += 0.1;
    }

    // Urgency indicators boost troubleshooting
    if (features.urgencyIndicators.length > 0) {
      scores.troubleshooting += 0.4;
    }

    // High specificity boosts navigational intent
    if (features.specificityLevel > 0.7) {
      scores.navigational += 0.3;
    }

    // Complex queries boost investigational intent
    if (features.termCount > 5 || features.hasBooleanOperators) {
      scores.investigational += 0.2;
    }

    // Mainframe concepts boost all domain-specific intents
    if (features.mainframeConcepts.length > 0) {
      const boost = 0.1 * features.mainframeConcepts.length;
      scores.troubleshooting += boost;
      scores.procedural += boost;
      scores.informational += boost;
    }
  }

  private applyContextAdjustments(
    scores: Record<SearchIntent, number>,
    context: IntentContext
  ): void {
    // User expertise adjustments
    if (context.userExpertise === 'beginner') {
      scores.procedural += 0.2;
      scores.definitional += 0.2;
      scores.informational += 0.1;
    } else if (context.userExpertise === 'expert') {
      scores.investigational += 0.2;
      scores.troubleshooting += 0.1;
    }

    // Previous query context
    if (context.previousQueries && context.previousQueries.length > 0) {
      const recentQuery = context.previousQueries[context.previousQueries.length - 1];
      if (recentQuery.includes('error') || recentQuery.includes('problem')) {
        scores.troubleshooting += 0.3;
      }
    }

    // Time of day adjustments
    if (context.timeOfDay >= 17 || context.timeOfDay <= 9) {
      // Outside business hours - likely troubleshooting
      scores.troubleshooting += 0.1;
    }
  }

  private generateReasoning(intent: SearchIntent, features: IntentFeatures): string {
    const reasons: string[] = [];

    switch (intent) {
      case 'informational':
        if (features.questionWords.length > 0) {
          reasons.push(`Contains question words: ${features.questionWords.join(', ')}`);
        }
        break;

      case 'troubleshooting':
        if (features.urgencyIndicators.length > 0) {
          reasons.push(`Contains urgency indicators: ${features.urgencyIndicators.join(', ')}`);
        }
        break;

      case 'procedural':
        if (features.verbs.some(v => ['create', 'build', 'setup', 'configure'].includes(v))) {
          reasons.push('Contains procedural verbs');
        }
        break;

      case 'navigational':
        if (features.specificityLevel > 0.7) {
          reasons.push('High specificity suggests looking for particular content');
        }
        break;
    }

    if (features.mainframeConcepts.length > 0) {
      reasons.push(`Contains mainframe concepts: ${features.mainframeConcepts.join(', ')}`);
    }

    return reasons.join('; ') || 'Based on query pattern analysis';
  }

  private extractContextFactors(features: IntentFeatures, context?: IntentContext): string[] {
    const factors: string[] = [];

    if (features.technicalTerms.length > 0) {
      factors.push('Technical terminology');
    }

    if (features.urgencyIndicators.length > 0) {
      factors.push('Urgency indicators');
    }

    if (features.hasBooleanOperators) {
      factors.push('Complex query structure');
    }

    if (context?.userExpertise) {
      factors.push(`User expertise: ${context.userExpertise}`);
    }

    if (context?.previousQueries && context.previousQueries.length > 0) {
      factors.push('Query session context');
    }

    return factors;
  }

  private calculateDomainSpecificity(features: IntentFeatures): number {
    const domainTerms =
      features.mainframeConcepts.length +
      features.technicalAcronyms.length +
      features.technicalTerms.length;

    const totalTerms = features.termCount;

    return totalTerms > 0 ? Math.min(1.0, domainTerms / totalTerms) : 0;
  }

  // Feature extraction helper methods

  private extractQuestionWords(query: string): string[] {
    const questionWords = ['what', 'how', 'why', 'when', 'where', 'who', 'which'];
    return questionWords.filter(word => new RegExp(`\\b${word}\\b`, 'i').test(query));
  }

  private extractVerbs(query: string): string[] {
    const commonVerbs = [
      'find',
      'search',
      'get',
      'show',
      'display',
      'create',
      'build',
      'setup',
      'configure',
      'install',
      'fix',
      'solve',
      'debug',
      'troubleshoot',
      'analyze',
      'compare',
      'evaluate',
      'verify',
      'check',
      'validate',
    ];

    return commonVerbs.filter(verb => new RegExp(`\\b${verb}\\b`, 'i').test(query));
  }

  private extractModifiers(query: string): string[] {
    const modifiers = [
      'best',
      'better',
      'latest',
      'new',
      'old',
      'fast',
      'slow',
      'easy',
      'difficult',
    ];
    return modifiers.filter(modifier => new RegExp(`\\b${modifier}\\b`, 'i').test(query));
  }

  private extractTechnicalTerms(query: string): string[] {
    const technicalPatterns = [
      /\b[A-Z]{2,}\b/g, // Acronyms
      /\b\w+\.\w+\b/g, // Dotted notation
      /\b\w+-\w+\b/g, // Hyphenated terms
    ];

    const terms: string[] = [];
    for (const pattern of technicalPatterns) {
      const matches = query.match(pattern);
      if (matches) {
        terms.push(...matches);
      }
    }

    return [...new Set(terms)];
  }

  private extractUrgencyIndicators(query: string): string[] {
    const urgencyTerms = [
      'urgent',
      'emergency',
      'asap',
      'immediately',
      'critical',
      'broken',
      'down',
      'failed',
      'not working',
      'stopped',
      'crash',
      'hang',
    ];

    return urgencyTerms.filter(term => new RegExp(`\\b${term}\\b`, 'i').test(query));
  }

  private calculateSpecificityLevel(query: string, parsedQuery: ParsedQuery): number {
    let score = 0;

    // Quoted phrases increase specificity
    if (query.includes('"')) score += 0.3;

    // Field searches increase specificity
    if (parsedQuery.terms.some(t => t.field)) score += 0.3;

    // Longer queries tend to be more specific
    score += Math.min(0.4, parsedQuery.terms.length * 0.1);

    return Math.min(1.0, score);
  }

  private calculateAbstractionLevel(query: string): number {
    const abstractTerms = [
      'concept',
      'theory',
      'principle',
      'overview',
      'introduction',
      'general',
      'basic',
      'fundamental',
      'architecture',
      'design',
    ];

    const abstractMatches = abstractTerms.filter(term =>
      new RegExp(`\\b${term}\\b`, 'i').test(query)
    ).length;

    return Math.min(1.0, abstractMatches * 0.3);
  }

  private extractMainframeConcepts(query: string): string[] {
    const concepts: string[] = [];

    for (const [term, weight] of this.domainVocabulary.entries()) {
      if (new RegExp(`\\b${term}\\b`, 'i').test(query) && weight > 0.7) {
        concepts.push(term);
      }
    }

    return concepts;
  }

  private extractTechnicalAcronyms(query: string): string[] {
    const acronyms = query.match(/\b[A-Z]{2,}\b/g) || [];
    return acronyms.filter(acronym => this.domainVocabulary.has(acronym.toLowerCase()));
  }

  private extractBusinessTerms(query: string): string[] {
    const businessTerms = [
      'cost',
      'budget',
      'performance',
      'efficiency',
      'productivity',
      'compliance',
      'audit',
      'security',
      'governance',
      'process',
    ];

    return businessTerms.filter(term => new RegExp(`\\b${term}\\b`, 'i').test(query));
  }

  private updatePatternsFromFeedback(learningData: IntentLearningData): void {
    // Update pattern confidence based on feedback
    const { query, classifiedIntent, actualIntent } = learningData;

    if (actualIntent) {
      // Decrease confidence for incorrect classification
      const incorrectPatterns = this.intentPatterns.get(classifiedIntent);
      if (incorrectPatterns) {
        for (const pattern of incorrectPatterns) {
          pattern.confidence = Math.max(0.1, pattern.confidence - this.config.learningRate);
        }
      }

      // Increase confidence for correct classification
      const correctPatterns = this.intentPatterns.get(actualIntent);
      if (correctPatterns) {
        for (const pattern of correctPatterns) {
          pattern.confidence = Math.min(1.0, pattern.confidence + this.config.learningRate);
        }
      }
    }
  }

  private updateUserProfile(userId: string, intent: SearchIntent, satisfied: boolean): void {
    let profile = this.userProfiles.get(userId);
    if (!profile) {
      profile = {
        intentFrequency: new Map(),
        expertise: 'intermediate',
        preferredTerminology: [],
      };
      this.userProfiles.set(userId, profile);
    }

    // Update intent frequency
    const currentFreq = profile.intentFrequency.get(intent) || 0;
    profile.intentFrequency.set(intent, currentFreq + 1);

    // Adjust expertise level based on query patterns
    // This is a simplified heuristic
    const totalQueries = Array.from(profile.intentFrequency.values()).reduce(
      (sum, freq) => sum + freq,
      0
    );

    if (totalQueries > 50) {
      profile.expertise = 'expert';
    } else if (totalQueries > 20) {
      profile.expertise = 'intermediate';
    }
  }

  private generateIntentSuggestion(
    intent: SearchIntent,
    query: string,
    expertise: 'beginner' | 'intermediate' | 'expert'
  ): string | null {
    const suggestions: Record<SearchIntent, Record<string, string>> = {
      informational: {
        beginner: 'Try asking "What is..." or "How does... work?"',
        intermediate: 'Consider using more specific terminology',
        expert: 'Add technical constraints to narrow results',
      },
      troubleshooting: {
        beginner: 'Include error messages or symptoms in your search',
        intermediate: 'Specify the system component experiencing issues',
        expert: 'Include error codes and system context',
      },
      procedural: {
        beginner: 'Use "how to" or "steps to" in your query',
        intermediate: 'Specify the target environment or version',
        expert: 'Include automation or scripting preferences',
      },
      // Add more suggestions for other intents
      navigational: { beginner: '', intermediate: '', expert: '' },
      transactional: { beginner: '', intermediate: '', expert: '' },
      investigational: { beginner: '', intermediate: '', expert: '' },
      comparative: { beginner: '', intermediate: '', expert: '' },
      definitional: { beginner: '', intermediate: '', expert: '' },
      exploratory: { beginner: '', intermediate: '', expert: '' },
      verification: { beginner: '', intermediate: '', expert: '' },
    };

    return suggestions[intent]?.[expertise] || null;
  }

  private filterLearningData(timeRange?: { from: number; to: number }): IntentLearningData[] {
    if (!timeRange) return this.learningData;

    return this.learningData.filter(
      data => data.timestamp >= timeRange.from && data.timestamp <= timeRange.to
    );
  }

  private calculateModelPerformance(): {
    accuracy: number;
    confidence: number;
    coverage: Record<SearchIntent, number>;
  } {
    const dataWithFeedback = this.learningData.filter(d => d.actualIntent);

    if (dataWithFeedback.length === 0) {
      return {
        accuracy: 0,
        confidence: 0,
        coverage: {} as Record<SearchIntent, number>,
      };
    }

    // Calculate accuracy
    const correctClassifications = dataWithFeedback.filter(
      d => d.classifiedIntent === d.actualIntent
    ).length;

    const accuracy = correctClassifications / dataWithFeedback.length;

    // Calculate average confidence
    const confidence = this.learningData.reduce((sum, d) => sum, 0) / this.learningData.length;

    // Calculate coverage
    const coverage: Record<SearchIntent, number> = {} as any;
    const allIntents: SearchIntent[] = [
      'informational',
      'navigational',
      'transactional',
      'investigational',
      'troubleshooting',
      'procedural',
      'comparative',
      'definitional',
      'exploratory',
      'verification',
    ];

    for (const intent of allIntents) {
      const intentData = this.learningData.filter(d => d.classifiedIntent === intent);
      coverage[intent] = intentData.length;
    }

    return { accuracy, confidence, coverage };
  }
}

export default SearchIntentClassifier;
