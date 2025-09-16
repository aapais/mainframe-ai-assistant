import { ParsedQuery } from '../search/QueryParser';
export type SearchIntent = 'informational' | 'navigational' | 'transactional' | 'investigational' | 'troubleshooting' | 'procedural' | 'comparative' | 'definitional' | 'exploratory' | 'verification';
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
    questionWords: string[];
    verbs: string[];
    modifiers: string[];
    technicalTerms: string[];
    queryLength: number;
    termCount: number;
    hasQuotes: boolean;
    hasWildcards: boolean;
    hasBooleanOperators: boolean;
    urgencyIndicators: string[];
    specificityLevel: number;
    abstractionLevel: number;
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
    actualIntent?: SearchIntent;
    userInteraction: {
        clickedResults: number[];
        timeSpent: number;
        refinedQuery?: string;
        satisfied: boolean;
    };
    context: IntentContext;
    timestamp: number;
}
export declare class SearchIntentClassifier {
    private intentPatterns;
    private learningData;
    private domainVocabulary;
    private userProfiles;
    private readonly config;
    constructor(config?: Partial<typeof SearchIntentClassifier.prototype.config>);
    classifyIntent(query: string, parsedQuery: ParsedQuery, context?: IntentContext): IntentClassification;
    learnFromInteraction(query: string, classifiedIntent: SearchIntent, userInteraction: IntentLearningData['userInteraction'], context?: IntentContext, actualIntent?: SearchIntent): void;
    getIntentDistribution(timeRange?: {
        from: number;
        to: number;
    }): Record<SearchIntent, {
        count: number;
        percentage: number;
        avgConfidence: number;
        successRate: number;
    }>;
    getPersonalizedSuggestions(userId: string, query: string, context?: IntentContext): Array<{
        intent: SearchIntent;
        suggestion: string;
        confidence: number;
    }>;
    exportModel(): {
        patterns: Record<SearchIntent, IntentPattern[]>;
        vocabulary: Array<{
            term: string;
            score: number;
        }>;
        learningData: IntentLearningData[];
        performance: {
            accuracy: number;
            confidence: number;
            coverage: Record<SearchIntent, number>;
        };
    };
    private initializePatterns;
    private initializeRemainingPatterns;
    private addIntentPattern;
    private initializeDomainVocabulary;
    private extractFeatures;
    private calculateIntentScores;
    private applyFeatureAdjustments;
    private applyContextAdjustments;
    private generateReasoning;
    private extractContextFactors;
    private calculateDomainSpecificity;
    private extractQuestionWords;
    private extractVerbs;
    private extractModifiers;
    private extractTechnicalTerms;
    private extractUrgencyIndicators;
    private calculateSpecificityLevel;
    private calculateAbstractionLevel;
    private extractMainframeConcepts;
    private extractTechnicalAcronyms;
    private extractBusinessTerms;
    private updatePatternsFromFeedback;
    private updateUserProfile;
    private generateIntentSuggestion;
    private filterLearningData;
    private calculateModelPerformance;
}
export default SearchIntentClassifier;
//# sourceMappingURL=SearchIntentClassifier.d.ts.map