/**
 * Search Ranking Engine - Advanced Result Scoring and Ranking
 *
 * Features:
 * - Multiple ranking algorithms (BM25, TF-IDF, Neural)
 * - Machine learning-based relevance scoring
 * - Context-aware result boosting
 * - User behavior analysis integration
 * - A/B testing support for ranking experiments
 */

import { FTS5SearchResult } from '../../../types/services';

export interface RankingConfig {
  algorithm: 'bm25' | 'tf_idf' | 'neural' | 'hybrid';
  weights: {
    textRelevance: number;
    popularity: number;
    freshness: number;
    userContext: number;
    qualityScore: number;
  };
  boosts: {
    exactMatch: number;
    titleMatch: number;
    categoryMatch: number;
    tagMatch: number;
    userPreference: number;
  };
  penalties: {
    duplicateContent: number;
    lowQuality: number;
    deprecatedContent: number;
  };
}

export interface UserContext {
  userId?: string;
  sessionId?: string;
  searchHistory: string[];
  preferredCategories: string[];
  expertiseLevel: 'beginner' | 'intermediate' | 'expert';
  recentInteractions: Array<{
    entryId: string;
    action: 'view' | 'rate' | 'bookmark';
    timestamp: Date;
  }>;
}

export interface RankingFeatures {
  bm25Score: number;
  tfIdfScore: number;
  popularityScore: number;
  freshnessScore: number;
  qualityScore: number;
  userContextScore: number;
  semanticSimilarity: number;
  queryTermMatches: number;
  fieldMatchBonus: number;
}

/**
 * Advanced Search Ranking Engine
 * Implements multiple ranking algorithms with machine learning insights
 */
export class SearchRankingEngine {
  private config: RankingConfig;
  private userInteractionData = new Map<string, any>();
  private contentQualityScores = new Map<string, number>();

  constructor(config: Partial<RankingConfig> = {}) {
    this.config = {
      algorithm: 'hybrid',
      weights: {
        textRelevance: 0.4,
        popularity: 0.2,
        freshness: 0.1,
        userContext: 0.2,
        qualityScore: 0.1
      },
      boosts: {
        exactMatch: 1.5,
        titleMatch: 1.3,
        categoryMatch: 1.2,
        tagMatch: 1.1,
        userPreference: 1.4
      },
      penalties: {
        duplicateContent: 0.8,
        lowQuality: 0.7,
        deprecatedContent: 0.6
      },
      ...config,
      weights: { ...this.getDefaultWeights(), ...config.weights },
      boosts: { ...this.getDefaultBoosts(), ...config.boosts },
      penalties: { ...this.getDefaultPenalties(), ...config.penalties }
    };
  }

  /**
   * Rank search results using the configured algorithm
   */
  rankResults(
    results: FTS5SearchResult[],
    query: string,
    userContext?: UserContext
  ): FTS5SearchResult[] {
    if (results.length === 0) {
      return results;
    }

    // Extract ranking features for each result
    const rankedResults = results.map(result => {
      const features = this.extractRankingFeatures(result, query, userContext);
      const finalScore = this.calculateFinalScore(features, result, userContext);

      return {
        ...result,
        score: finalScore,
        ranking_features: features,
        debug_ranking: process.env.NODE_ENV === 'development' ? {
          original_score: result.score,
          features,
          algorithm: this.config.algorithm
        } : undefined
      };
    });

    // Sort by final score
    return rankedResults.sort((a, b) => b.score - a.score);
  }

  /**
   * Update user interaction data for personalized ranking
   */
  updateUserInteraction(
    userId: string,
    entryId: string,
    action: 'view' | 'rate' | 'bookmark' | 'click',
    metadata?: any
  ): void {
    if (!this.userInteractionData.has(userId)) {
      this.userInteractionData.set(userId, {
        interactions: [],
        preferences: {
          categories: new Map<string, number>(),
          tags: new Map<string, number>(),
          contentTypes: new Map<string, number>()
        },
        totalInteractions: 0
      });
    }

    const userData = this.userInteractionData.get(userId);
    userData.interactions.push({
      entryId,
      action,
      timestamp: new Date(),
      metadata
    });
    userData.totalInteractions++;

    // Keep only recent interactions (last 1000)
    if (userData.interactions.length > 1000) {
      userData.interactions = userData.interactions.slice(-1000);
    }

    // Update preferences based on interaction
    this.updateUserPreferences(userId, entryId, action, metadata);
  }

  /**
   * Get user preferences for personalized ranking
   */
  getUserPreferences(userId: string): {
    preferredCategories: string[];
    preferredTags: string[];
    expertiseLevel: 'beginner' | 'intermediate' | 'expert';
    interactionScore: number;
  } | null {
    const userData = this.userInteractionData.get(userId);
    if (!userData) return null;

    // Analyze user interactions to determine preferences
    const categoryScores = Array.from(userData.preferences.categories.entries())
      .sort(([, a], [, b]) => b - a);

    const tagScores = Array.from(userData.preferences.tags.entries())
      .sort(([, a], [, b]) => b - a);

    // Determine expertise level based on interaction patterns
    const expertiseLevel = this.determineExpertiseLevel(userData);

    return {
      preferredCategories: categoryScores.slice(0, 5).map(([cat]) => cat),
      preferredTags: tagScores.slice(0, 10).map(([tag]) => tag),
      expertiseLevel,
      interactionScore: Math.min(userData.totalInteractions / 100, 1.0)
    };
  }

  /**
   * Update content quality scores based on user feedback
   */
  updateContentQuality(
    entryId: string,
    rating: number,
    feedback?: {
      helpful: boolean;
      accurate: boolean;
      upToDate: boolean;
      wellWritten: boolean;
    }
  ): void {
    const currentScore = this.contentQualityScores.get(entryId) || 0.5;

    // Weighted average with new rating
    const newScore = (currentScore * 0.8) + (rating * 0.2);

    // Apply feedback adjustments
    let adjustedScore = newScore;
    if (feedback) {
      if (feedback.helpful) adjustedScore += 0.1;
      if (feedback.accurate) adjustedScore += 0.1;
      if (feedback.upToDate) adjustedScore += 0.05;
      if (feedback.wellWritten) adjustedScore += 0.05;
    }

    this.contentQualityScores.set(entryId, Math.max(0, Math.min(1, adjustedScore)));
  }

  /**
   * Get ranking statistics and insights
   */
  getRankingStats(): {
    algorithm: string;
    totalUserInteractions: number;
    qualityScoreDistribution: {
      excellent: number;
      good: number;
      average: number;
      poor: number;
    };
    userEngagement: {
      activeUsers: number;
      avgInteractionsPerUser: number;
    };
  } {
    const qualityScores = Array.from(this.contentQualityScores.values());
    const totalInteractions = Array.from(this.userInteractionData.values())
      .reduce((sum, user) => sum + user.totalInteractions, 0);

    return {
      algorithm: this.config.algorithm,
      totalUserInteractions: totalInteractions,
      qualityScoreDistribution: {
        excellent: qualityScores.filter(s => s >= 0.8).length,
        good: qualityScores.filter(s => s >= 0.6 && s < 0.8).length,
        average: qualityScores.filter(s => s >= 0.4 && s < 0.6).length,
        poor: qualityScores.filter(s => s < 0.4).length
      },
      userEngagement: {
        activeUsers: this.userInteractionData.size,
        avgInteractionsPerUser: this.userInteractionData.size > 0
          ? totalInteractions / this.userInteractionData.size
          : 0
      }
    };
  }

  // Private Methods

  private extractRankingFeatures(
    result: FTS5SearchResult,
    query: string,
    userContext?: UserContext
  ): RankingFeatures {
    const queryTerms = query.toLowerCase().split(/\s+/);
    const entryText = [
      result.entry.title,
      result.entry.problem,
      result.entry.solution,
      result.entry.tags.join(' ')
    ].join(' ').toLowerCase();

    return {
      bm25Score: result.bm25_score || 0,
      tfIdfScore: this.calculateTfIdfScore(entryText, queryTerms),
      popularityScore: this.calculatePopularityScore(result.entry),
      freshnessScore: this.calculateFreshnessScore(result.entry.created_at, result.entry.updated_at),
      qualityScore: this.contentQualityScores.get(result.entry.id) || 0.5,
      userContextScore: this.calculateUserContextScore(result, userContext),
      semanticSimilarity: this.calculateSemanticSimilarity(entryText, query),
      queryTermMatches: this.countQueryTermMatches(entryText, queryTerms),
      fieldMatchBonus: this.calculateFieldMatchBonus(result, queryTerms)
    };
  }

  private calculateFinalScore(
    features: RankingFeatures,
    result: FTS5SearchResult,
    userContext?: UserContext
  ): number {
    let score = 0;

    // Apply algorithm-specific scoring
    switch (this.config.algorithm) {
      case 'bm25':
        score = features.bm25Score * 20 + 50;
        break;

      case 'tf_idf':
        score = features.tfIdfScore * 100;
        break;

      case 'neural':
        score = this.calculateNeuralScore(features);
        break;

      case 'hybrid':
      default:
        score = this.calculateHybridScore(features);
        break;
    }

    // Apply weights
    const weightedScore = (
      features.bm25Score * this.config.weights.textRelevance +
      features.popularityScore * this.config.weights.popularity +
      features.freshnessScore * this.config.weights.freshness +
      features.userContextScore * this.config.weights.userContext +
      features.qualityScore * this.config.weights.qualityScore
    ) * 100;

    // Use weighted score as base
    score = Math.max(score, weightedScore);

    // Apply boosts
    score = this.applyBoosts(score, result, features, userContext);

    // Apply penalties
    score = this.applyPenalties(score, result);

    return Math.max(0, Math.min(100, score));
  }

  private calculateTfIdfScore(text: string, queryTerms: string[]): number {
    // Simplified TF-IDF calculation
    let score = 0;
    const words = text.split(/\s+/);
    const totalWords = words.length;

    queryTerms.forEach(term => {
      const termFreq = words.filter(word => word.includes(term)).length;
      if (termFreq > 0) {
        const tf = termFreq / totalWords;
        // Simplified IDF (in real implementation, would use document corpus)
        const idf = Math.log(1000 / (10 + termFreq)); // Estimated corpus size
        score += tf * idf;
      }
    });

    return Math.min(1, score);
  }

  private calculatePopularityScore(entry: any): number {
    const usageCount = entry.usage_count || 0;
    const successCount = entry.success_count || 0;
    const failureCount = entry.failure_count || 0;
    const totalRatings = successCount + failureCount;

    let score = 0;

    // Usage popularity
    if (usageCount > 0) {
      score += Math.min(0.5, Math.log(usageCount + 1) / 10);
    }

    // Success rate
    if (totalRatings > 0) {
      const successRate = successCount / totalRatings;
      score += successRate * 0.5;
    }

    return Math.min(1, score);
  }

  private calculateFreshnessScore(createdAt: Date, updatedAt: Date): number {
    const now = Date.now();
    const created = new Date(createdAt).getTime();
    const updated = new Date(updatedAt).getTime();

    // Use the more recent date
    const mostRecent = Math.max(created, updated);
    const daysSinceUpdate = (now - mostRecent) / (1000 * 60 * 60 * 24);

    // Exponential decay over 365 days
    return Math.exp(-daysSinceUpdate / 365);
  }

  private calculateUserContextScore(
    result: FTS5SearchResult,
    userContext?: UserContext
  ): number {
    if (!userContext || !userContext.userId) {
      return 0.5; // Neutral score for non-personalized
    }

    const preferences = this.getUserPreferences(userContext.userId);
    if (!preferences) {
      return 0.5;
    }

    let score = 0;

    // Category preference
    if (preferences.preferredCategories.includes(result.entry.category)) {
      score += 0.3;
    }

    // Tag preference
    const matchingTags = result.entry.tags.filter(tag =>
      preferences.preferredTags.includes(tag)
    );
    score += (matchingTags.length / Math.max(result.entry.tags.length, 1)) * 0.3;

    // Expertise level matching
    score += this.calculateExpertiseMatch(result, preferences.expertiseLevel) * 0.2;

    // Interaction history
    score += preferences.interactionScore * 0.2;

    return Math.min(1, score);
  }

  private calculateSemanticSimilarity(text: string, query: string): number {
    // Simplified semantic similarity using word overlap
    const textWords = new Set(text.toLowerCase().split(/\s+/));
    const queryWords = new Set(query.toLowerCase().split(/\s+/));

    const intersection = new Set([...textWords].filter(x => queryWords.has(x)));
    const union = new Set([...textWords, ...queryWords]);

    return intersection.size / union.size;
  }

  private countQueryTermMatches(text: string, queryTerms: string[]): number {
    return queryTerms.filter(term =>
      text.includes(term.toLowerCase())
    ).length / queryTerms.length;
  }

  private calculateFieldMatchBonus(result: FTS5SearchResult, queryTerms: string[]): number {
    let bonus = 0;

    // Title matches
    const titleMatches = queryTerms.filter(term =>
      result.entry.title.toLowerCase().includes(term)
    ).length;
    bonus += (titleMatches / queryTerms.length) * 0.4;

    // Tag matches
    const tagText = result.entry.tags.join(' ').toLowerCase();
    const tagMatches = queryTerms.filter(term => tagText.includes(term)).length;
    bonus += (tagMatches / queryTerms.length) * 0.3;

    // Category match
    if (queryTerms.some(term => result.entry.category.toLowerCase().includes(term))) {
      bonus += 0.3;
    }

    return Math.min(1, bonus);
  }

  private calculateNeuralScore(features: RankingFeatures): number {
    // Simplified neural network-like scoring
    // In a real implementation, this would use a trained model
    const weights = [0.3, 0.2, 0.15, 0.1, 0.1, 0.05, 0.05, 0.05];
    const inputs = [
      features.bm25Score,
      features.tfIdfScore,
      features.popularityScore,
      features.freshnessScore,
      features.qualityScore,
      features.userContextScore,
      features.semanticSimilarity,
      features.queryTermMatches
    ];

    // Weighted sum with sigmoid activation
    const weightedSum = inputs.reduce((sum, input, i) => sum + input * weights[i], 0);
    return 1 / (1 + Math.exp(-weightedSum * 6 - 3)); // Sigmoid with scaling
  }

  private calculateHybridScore(features: RankingFeatures): number {
    // Combine multiple scoring methods
    const bm25Component = features.bm25Score * 30;
    const tfIdfComponent = features.tfIdfScore * 25;
    const neuralComponent = this.calculateNeuralScore(features) * 20;
    const popularityComponent = features.popularityScore * 15;
    const qualityComponent = features.qualityScore * 10;

    return bm25Component + tfIdfComponent + neuralComponent +
           popularityComponent + qualityComponent;
  }

  private applyBoosts(
    score: number,
    result: FTS5SearchResult,
    features: RankingFeatures,
    userContext?: UserContext
  ): number {
    let boostedScore = score;

    // Exact match boost
    if (features.queryTermMatches > 0.8) {
      boostedScore *= this.config.boosts.exactMatch;
    }

    // Field-specific boosts
    if (features.fieldMatchBonus > 0.3) {
      boostedScore *= this.config.boosts.titleMatch;
    }

    // User preference boost
    if (userContext && features.userContextScore > 0.7) {
      boostedScore *= this.config.boosts.userPreference;
    }

    return boostedScore;
  }

  private applyPenalties(score: number, result: FTS5SearchResult): number {
    let penalizedScore = score;

    // Quality penalty
    const qualityScore = this.contentQualityScores.get(result.entry.id) || 0.5;
    if (qualityScore < 0.3) {
      penalizedScore *= this.config.penalties.lowQuality;
    }

    // Freshness penalty for very old content
    const daysSinceUpdate = (Date.now() - new Date(result.entry.updated_at).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceUpdate > 730) { // 2 years
      penalizedScore *= this.config.penalties.deprecatedContent;
    }

    return penalizedScore;
  }

  private updateUserPreferences(
    userId: string,
    entryId: string,
    action: string,
    metadata: any
  ): void {
    const userData = this.userInteractionData.get(userId);
    if (!userData) return;

    // This would typically fetch entry details to update preferences
    // For now, we'll use a simplified approach

    const weight = this.getActionWeight(action);

    // Update category preferences
    if (metadata?.category) {
      const currentWeight = userData.preferences.categories.get(metadata.category) || 0;
      userData.preferences.categories.set(metadata.category, currentWeight + weight);
    }

    // Update tag preferences
    if (metadata?.tags && Array.isArray(metadata.tags)) {
      metadata.tags.forEach((tag: string) => {
        const currentWeight = userData.preferences.tags.get(tag) || 0;
        userData.preferences.tags.set(tag, currentWeight + weight);
      });
    }
  }

  private getActionWeight(action: string): number {
    const weights = {
      view: 0.1,
      click: 0.2,
      rate: 0.5,
      bookmark: 0.7
    };
    return weights[action] || 0.1;
  }

  private determineExpertiseLevel(userData: any): 'beginner' | 'intermediate' | 'expert' {
    const totalInteractions = userData.totalInteractions;
    const uniqueCategories = userData.preferences.categories.size;

    if (totalInteractions < 10) return 'beginner';
    if (totalInteractions < 50 || uniqueCategories < 3) return 'intermediate';
    return 'expert';
  }

  private calculateExpertiseMatch(
    result: FTS5SearchResult,
    expertiseLevel: string
  ): number {
    // This would analyze content complexity and match to user expertise
    // Simplified implementation
    const contentComplexity = this.estimateContentComplexity(result);

    const expertiseMap = { beginner: 0.3, intermediate: 0.6, expert: 0.9 };
    const userLevel = expertiseMap[expertiseLevel] || 0.5;

    // Return higher score for better matches
    return 1 - Math.abs(contentComplexity - userLevel);
  }

  private estimateContentComplexity(result: FTS5SearchResult): number {
    // Simplified complexity estimation based on content characteristics
    const text = `${result.entry.title} ${result.entry.problem} ${result.entry.solution}`;
    const words = text.split(/\s+/);
    const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / words.length;
    const technicalTerms = words.filter(word => word.length > 8).length;

    // Normalize to 0-1 scale
    const lengthScore = Math.min(avgWordLength / 10, 1);
    const techScore = Math.min(technicalTerms / words.length * 10, 1);

    return (lengthScore + techScore) / 2;
  }

  private getDefaultWeights() {
    return {
      textRelevance: 0.4,
      popularity: 0.2,
      freshness: 0.1,
      userContext: 0.2,
      qualityScore: 0.1
    };
  }

  private getDefaultBoosts() {
    return {
      exactMatch: 1.5,
      titleMatch: 1.3,
      categoryMatch: 1.2,
      tagMatch: 1.1,
      userPreference: 1.4
    };
  }

  private getDefaultPenalties() {
    return {
      duplicateContent: 0.8,
      lowQuality: 0.7,
      deprecatedContent: 0.6
    };
  }
}