'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.SearchIntentClassifier = void 0;
class SearchIntentClassifier {
  intentPatterns = new Map();
  learningData = [];
  domainVocabulary = new Map();
  userProfiles = new Map();
  config;
  constructor(config = {}) {
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
  classifyIntent(query, parsedQuery, context) {
    const features = this.extractFeatures(query, parsedQuery);
    const intentScores = this.calculateIntentScores(query, features, context);
    const sortedIntents = Object.entries(intentScores)
      .sort(([, a], [, b]) => b - a)
      .map(([intent, score]) => ({ intent, score }));
    const primary = sortedIntents[0];
    const confidence = primary.score;
    const alternatives = sortedIntents
      .slice(1, 4)
      .filter(({ score }) => score > this.config.multiIntentThreshold)
      .map(({ intent, score }) => ({
        intent,
        confidence: score,
        reasoning: this.generateReasoning(intent, features),
      }));
    const isMultiIntent =
      alternatives.length > 0 && alternatives[0].confidence > this.config.multiIntentThreshold;
    const reasoning = this.generateReasoning(primary.intent, features);
    const contextFactors = this.extractContextFactors(features, context);
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
  learnFromInteraction(query, classifiedIntent, userInteraction, context, actualIntent) {
    if (!this.config.adaptationEnabled) return;
    const learningData = {
      query,
      classifiedIntent,
      actualIntent,
      userInteraction,
      context: context || {},
      timestamp: Date.now(),
    };
    this.learningData.push(learningData);
    if (this.learningData.length > this.config.maxLearningData) {
      this.learningData.shift();
    }
    if (actualIntent && actualIntent !== classifiedIntent) {
      this.updatePatternsFromFeedback(learningData);
    }
    if (context?.userId) {
      this.updateUserProfile(context.userId, classifiedIntent, userInteraction.satisfied);
    }
  }
  getIntentDistribution(timeRange) {
    const filteredData = this.filterLearningData(timeRange);
    const totalQueries = filteredData.length;
    const distribution = {};
    const allIntents = [
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
  getPersonalizedSuggestions(userId, query, context) {
    const userProfile = this.userProfiles.get(userId);
    if (!userProfile) {
      return [];
    }
    const suggestions = [];
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
  exportModel() {
    const patterns = {};
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
  initializePatterns() {
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
    this.initializeRemainingPatterns();
  }
  initializeRemainingPatterns() {
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
  addIntentPattern(intent, patterns) {
    const intentPattern = {
      intent,
      patterns,
      confidence: 0.8,
      frequency: 0,
      successRate: 0.5,
    };
    if (!this.intentPatterns.has(intent)) {
      this.intentPatterns.set(intent, []);
    }
    this.intentPatterns.get(intent).push(intentPattern);
  }
  initializeDomainVocabulary() {
    const vocabulary = {
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
      cobol: 1.0,
      pli: 0.8,
      assembler: 0.9,
      jcl: 1.0,
      rexx: 0.8,
      rpg: 0.7,
      fortran: 0.6,
      sql: 0.9,
      vsam: 1.0,
      qsam: 0.8,
      isam: 0.7,
      dataset: 0.9,
      gdg: 0.8,
      catalog: 0.8,
      volume: 0.7,
      dasd: 0.8,
      tape: 0.7,
      jobcard: 0.9,
      proclib: 0.8,
      steplib: 0.8,
      sysin: 0.7,
      sysout: 0.7,
      allocation: 0.8,
      disposition: 0.7,
      ispf: 0.9,
      sdsf: 0.8,
      fileaid: 0.7,
      endevor: 0.8,
      changeman: 0.7,
      abendaid: 0.8,
      xpediter: 0.7,
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
  extractFeatures(query, parsedQuery) {
    const lowerQuery = query.toLowerCase();
    const questionWords = this.extractQuestionWords(lowerQuery);
    const verbs = this.extractVerbs(lowerQuery);
    const modifiers = this.extractModifiers(lowerQuery);
    const technicalTerms = this.extractTechnicalTerms(lowerQuery);
    const queryLength = query.length;
    const termCount = parsedQuery.terms.length;
    const hasQuotes = query.includes('"');
    const hasWildcards = /[*?]/.test(query);
    const hasBooleanOperators = /\b(AND|OR|NOT)\b/i.test(query);
    const urgencyIndicators = this.extractUrgencyIndicators(lowerQuery);
    const specificityLevel = this.calculateSpecificityLevel(query, parsedQuery);
    const abstractionLevel = this.calculateAbstractionLevel(lowerQuery);
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
  calculateIntentScores(query, features, context) {
    const scores = {
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
    this.applyFeatureAdjustments(scores, features);
    if (context) {
      this.applyContextAdjustments(scores, context);
    }
    const maxScore = Math.max(...Object.values(scores));
    if (maxScore > 0) {
      for (const intent of Object.keys(scores)) {
        scores[intent] = scores[intent] / maxScore;
      }
    }
    return scores;
  }
  applyFeatureAdjustments(scores, features) {
    if (features.questionWords.length > 0) {
      scores.informational += 0.3 * features.questionWords.length;
      scores.definitional += 0.2 * features.questionWords.length;
    }
    if (features.technicalTerms.length > 2) {
      scores.investigational += 0.2;
      scores.troubleshooting += 0.1;
    }
    if (features.urgencyIndicators.length > 0) {
      scores.troubleshooting += 0.4;
    }
    if (features.specificityLevel > 0.7) {
      scores.navigational += 0.3;
    }
    if (features.termCount > 5 || features.hasBooleanOperators) {
      scores.investigational += 0.2;
    }
    if (features.mainframeConcepts.length > 0) {
      const boost = 0.1 * features.mainframeConcepts.length;
      scores.troubleshooting += boost;
      scores.procedural += boost;
      scores.informational += boost;
    }
  }
  applyContextAdjustments(scores, context) {
    if (context.userExpertise === 'beginner') {
      scores.procedural += 0.2;
      scores.definitional += 0.2;
      scores.informational += 0.1;
    } else if (context.userExpertise === 'expert') {
      scores.investigational += 0.2;
      scores.troubleshooting += 0.1;
    }
    if (context.previousQueries && context.previousQueries.length > 0) {
      const recentQuery = context.previousQueries[context.previousQueries.length - 1];
      if (recentQuery.includes('error') || recentQuery.includes('problem')) {
        scores.troubleshooting += 0.3;
      }
    }
    if (context.timeOfDay >= 17 || context.timeOfDay <= 9) {
      scores.troubleshooting += 0.1;
    }
  }
  generateReasoning(intent, features) {
    const reasons = [];
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
  extractContextFactors(features, context) {
    const factors = [];
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
  calculateDomainSpecificity(features) {
    const domainTerms =
      features.mainframeConcepts.length +
      features.technicalAcronyms.length +
      features.technicalTerms.length;
    const totalTerms = features.termCount;
    return totalTerms > 0 ? Math.min(1.0, domainTerms / totalTerms) : 0;
  }
  extractQuestionWords(query) {
    const questionWords = ['what', 'how', 'why', 'when', 'where', 'who', 'which'];
    return questionWords.filter(word => new RegExp(`\\b${word}\\b`, 'i').test(query));
  }
  extractVerbs(query) {
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
  extractModifiers(query) {
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
  extractTechnicalTerms(query) {
    const technicalPatterns = [/\b[A-Z]{2,}\b/g, /\b\w+\.\w+\b/g, /\b\w+-\w+\b/g];
    const terms = [];
    for (const pattern of technicalPatterns) {
      const matches = query.match(pattern);
      if (matches) {
        terms.push(...matches);
      }
    }
    return [...new Set(terms)];
  }
  extractUrgencyIndicators(query) {
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
  calculateSpecificityLevel(query, parsedQuery) {
    let score = 0;
    if (query.includes('"')) score += 0.3;
    if (parsedQuery.terms.some(t => t.field)) score += 0.3;
    score += Math.min(0.4, parsedQuery.terms.length * 0.1);
    return Math.min(1.0, score);
  }
  calculateAbstractionLevel(query) {
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
  extractMainframeConcepts(query) {
    const concepts = [];
    for (const [term, weight] of this.domainVocabulary.entries()) {
      if (new RegExp(`\\b${term}\\b`, 'i').test(query) && weight > 0.7) {
        concepts.push(term);
      }
    }
    return concepts;
  }
  extractTechnicalAcronyms(query) {
    const acronyms = query.match(/\b[A-Z]{2,}\b/g) || [];
    return acronyms.filter(acronym => this.domainVocabulary.has(acronym.toLowerCase()));
  }
  extractBusinessTerms(query) {
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
  updatePatternsFromFeedback(learningData) {
    const { query, classifiedIntent, actualIntent } = learningData;
    if (actualIntent) {
      const incorrectPatterns = this.intentPatterns.get(classifiedIntent);
      if (incorrectPatterns) {
        for (const pattern of incorrectPatterns) {
          pattern.confidence = Math.max(0.1, pattern.confidence - this.config.learningRate);
        }
      }
      const correctPatterns = this.intentPatterns.get(actualIntent);
      if (correctPatterns) {
        for (const pattern of correctPatterns) {
          pattern.confidence = Math.min(1.0, pattern.confidence + this.config.learningRate);
        }
      }
    }
  }
  updateUserProfile(userId, intent, satisfied) {
    let profile = this.userProfiles.get(userId);
    if (!profile) {
      profile = {
        intentFrequency: new Map(),
        expertise: 'intermediate',
        preferredTerminology: [],
      };
      this.userProfiles.set(userId, profile);
    }
    const currentFreq = profile.intentFrequency.get(intent) || 0;
    profile.intentFrequency.set(intent, currentFreq + 1);
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
  generateIntentSuggestion(intent, query, expertise) {
    const suggestions = {
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
  filterLearningData(timeRange) {
    if (!timeRange) return this.learningData;
    return this.learningData.filter(
      data => data.timestamp >= timeRange.from && data.timestamp <= timeRange.to
    );
  }
  calculateModelPerformance() {
    const dataWithFeedback = this.learningData.filter(d => d.actualIntent);
    if (dataWithFeedback.length === 0) {
      return {
        accuracy: 0,
        confidence: 0,
        coverage: {},
      };
    }
    const correctClassifications = dataWithFeedback.filter(
      d => d.classifiedIntent === d.actualIntent
    ).length;
    const accuracy = correctClassifications / dataWithFeedback.length;
    const confidence = this.learningData.reduce((sum, d) => sum, 0) / this.learningData.length;
    const coverage = {};
    const allIntents = [
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
exports.SearchIntentClassifier = SearchIntentClassifier;
exports.default = SearchIntentClassifier;
//# sourceMappingURL=SearchIntentClassifier.js.map
