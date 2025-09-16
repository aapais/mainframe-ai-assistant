import { ParsedQuery } from '../search/QueryParser';
import { SearchOptions } from '../../types/services';
export interface ComplexityScore {
    overall: number;
    dimensions: {
        syntactic: number;
        semantic: number;
        domain: number;
        computational: number;
        user: number;
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
    impact: number;
    weight: number;
    examples?: string[];
}
export type ComplexityFactorType = 'term_count' | 'boolean_operators' | 'nested_queries' | 'field_specific' | 'phrase_queries' | 'fuzzy_matching' | 'wildcard_usage' | 'range_queries' | 'technical_terms' | 'acronym_density' | 'domain_specificity' | 'abstraction_level' | 'multi_concept' | 'procedural_complexity' | 'context_dependency';
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
export declare class QueryComplexityAnalyzer {
    private complexityPatterns;
    private complexityHistory;
    private domainVocabulary;
    private userComplexityProfiles;
    private readonly config;
    constructor(config?: Partial<typeof QueryComplexityAnalyzer.prototype.config>);
    analyzeComplexity(query: string, parsedQuery: ParsedQuery, options?: SearchOptions, userId?: string): ComplexityScore;
    recordComplexityMetrics(queryId: string, query: string, complexity: ComplexityScore, processingTime: number, resultCount: number, userId?: string, userSatisfaction?: number): void;
    generateComplexityReport(timeRange?: {
        from: number;
        to: number;
    }): ComplexityAnalysisReport;
    suggestSimplification(query: string, complexity: ComplexityScore): {
        simplified: string;
        strategies: Array<{
            type: string;
            description: string;
            example: string;
            impact: number;
        }>;
        expectedComplexity: number;
    };
    getUserComplexityGuidance(userId: string): {
        currentLevel: string;
        recommendations: string[];
        optimalComplexity: number;
        learningPath: string[];
    };
    exportComplexityData(): {
        patterns: Record<ComplexityFactorType, ComplexityPattern[]>;
        history: ComplexityMetrics[];
        userProfiles: Array<{
            userId: string;
            profile: any;
        }>;
        report: ComplexityAnalysisReport;
    };
    private initializeComplexityPatterns;
    private initializeRemainingPatterns;
    private addComplexityPattern;
    private initializeDomainVocabulary;
    private calculateSyntacticComplexity;
    private calculateSemanticComplexity;
    private calculateDomainComplexity;
    private calculateComputationalComplexity;
    private calculateUserComplexity;
    private calculateOverallComplexity;
    private getComplexityWeights;
    private determineComplexityLevel;
    private identifyComplexityFactors;
    private generateComplexityRecommendations;
    private calculateAnalysisConfidence;
    private extractConcepts;
    private countAbstractTerms;
    private identifyDomains;
    private matchesPattern;
    private updateUserComplexityProfile;
    private adaptComplexityPatterns;
    private filterHistoryByTimeRange;
    private calculateAverageComplexity;
    private calculateComplexityDistribution;
    private calculateDimensionTrends;
    private getTopComplexityFactors;
    private calculatePerformanceCorrelations;
    private generateSystemRecommendations;
    private identifyComplexityOutliers;
    private getEmptyReport;
    private determineUserLevel;
}
export default QueryComplexityAnalyzer;
//# sourceMappingURL=QueryComplexityAnalyzer.d.ts.map