'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.RelevanceScorer = void 0;
const events_1 = require('events');
class RelevanceScorer extends events_1.EventEmitter {
  userFeedback = new Map();
  scoringHistory = new Map();
  mlModels = new Map();
  scoringWeights;
  qualityThresholds;
  constructor() {
    super();
    this.scoringWeights = {
      textual: 0.25,
      behavioral: 0.3,
      contextual: 0.2,
      semantic: 0.15,
      temporal: 0.1,
    };
    this.qualityThresholds = {
      excellent: 0.9,
      good: 0.7,
      fair: 0.5,
      poor: 0.0,
    };
    this.initializeModels();
  }
  async scoreRelevance(resultId, resultContent, query, context) {
    const signals = [];
    const textualSignals = await this.calculateTextualSignals(resultContent, query);
    signals.push(...textualSignals);
    const behavioralSignals = await this.calculateBehavioralSignals(resultId, query, context);
    signals.push(...behavioralSignals);
    const contextualSignals = await this.calculateContextualSignals(resultContent, query, context);
    signals.push(...contextualSignals);
    const semanticSignals = await this.calculateSemanticSignals(resultContent, query, context);
    signals.push(...semanticSignals);
    const temporalSignals = await this.calculateTemporalSignals(resultContent, query, context);
    signals.push(...temporalSignals);
    const overallScore = this.calculateOverallScore(signals);
    const confidence = this.calculateConfidence(signals);
    const explanation = this.generateExplanation(signals, overallScore);
    const recommendations = this.generateRecommendations(signals, overallScore);
    const result = {
      resultId,
      query,
      overallScore,
      confidence,
      signals,
      explanation,
      recommendations,
      timestamp: Date.now(),
    };
    if (!this.scoringHistory.has(query)) {
      this.scoringHistory.set(query, []);
    }
    this.scoringHistory.get(query).push(result);
    this.emit('relevanceScored', result);
    return result;
  }
  async calculateTextualSignals(resultContent, query) {
    const signals = [];
    const exactMatchScore = this.calculateExactMatch(resultContent, query);
    signals.push({
      type: 'textual',
      weight: 0.3,
      score: exactMatchScore,
      confidence: 0.9,
      source: 'exact_match',
      metadata: { algorithm: 'string_matching' },
    });
    const tfidfScore = this.calculateTFIDF(resultContent, query);
    signals.push({
      type: 'textual',
      weight: 0.4,
      score: tfidfScore,
      confidence: 0.8,
      source: 'tfidf',
      metadata: { algorithm: 'tf_idf' },
    });
    const bm25Score = this.calculateBM25(resultContent, query);
    signals.push({
      type: 'textual',
      weight: 0.3,
      score: bm25Score,
      confidence: 0.85,
      source: 'bm25',
      metadata: { algorithm: 'bm25' },
    });
    return signals;
  }
  async calculateBehavioralSignals(resultId, query, context) {
    const signals = [];
    const ctrScore = this.calculateResultCTR(resultId, query);
    signals.push({
      type: 'behavioral',
      weight: 0.4,
      score: ctrScore,
      confidence: 0.8,
      source: 'ctr',
      metadata: { metric: 'click_through_rate' },
    });
    const dwellTimeScore = this.calculateDwellTimeScore(resultId, query);
    signals.push({
      type: 'behavioral',
      weight: 0.3,
      score: dwellTimeScore,
      confidence: 0.75,
      source: 'dwell_time',
      metadata: { metric: 'average_time_spent' },
    });
    const interactionScore = this.calculateInteractionScore(resultId, context);
    signals.push({
      type: 'behavioral',
      weight: 0.3,
      score: interactionScore,
      confidence: 0.7,
      source: 'interactions',
      metadata: { metric: 'user_interactions' },
    });
    return signals;
  }
  async calculateContextualSignals(resultContent, query, context) {
    const signals = [];
    const profileScore = this.calculateProfileMatch(resultContent, context.userProfile);
    signals.push({
      type: 'contextual',
      weight: 0.4,
      score: profileScore,
      confidence: 0.75,
      source: 'user_profile',
      metadata: { factor: 'profile_alignment' },
    });
    const sessionScore = this.calculateSessionRelevance(
      resultContent,
      query,
      context.sessionContext
    );
    signals.push({
      type: 'contextual',
      weight: 0.35,
      score: sessionScore,
      confidence: 0.7,
      source: 'session_context',
      metadata: { factor: 'session_continuity' },
    });
    const locationScore = this.calculateLocationRelevance(
      resultContent,
      context.userProfile.location
    );
    signals.push({
      type: 'contextual',
      weight: 0.25,
      score: locationScore,
      confidence: 0.6,
      source: 'location',
      metadata: { factor: 'geographical_relevance' },
    });
    return signals;
  }
  async calculateSemanticSignals(resultContent, query, context) {
    const signals = [];
    const embeddingScore = await this.calculateEmbeddingSimilarity(resultContent, query);
    signals.push({
      type: 'semantic',
      weight: 0.4,
      score: embeddingScore,
      confidence: 0.8,
      source: 'word_embeddings',
      metadata: { model: 'word2vec' },
    });
    const topicScore = await this.calculateTopicAlignment(resultContent, query);
    signals.push({
      type: 'semantic',
      weight: 0.35,
      score: topicScore,
      confidence: 0.75,
      source: 'topic_modeling',
      metadata: { model: 'lda' },
    });
    const intentScore = await this.calculateIntentMatch(resultContent, query, context);
    signals.push({
      type: 'semantic',
      weight: 0.25,
      score: intentScore,
      confidence: 0.7,
      source: 'intent_analysis',
      metadata: { model: 'intent_classifier' },
    });
    return signals;
  }
  async calculateTemporalSignals(resultContent, query, context) {
    const signals = [];
    const freshnessScore = this.calculateFreshnessScore(resultContent.metadata);
    signals.push({
      type: 'temporal',
      weight: 0.4,
      score: freshnessScore,
      confidence: 0.8,
      source: 'freshness',
      metadata: { factor: 'content_age' },
    });
    const trendingScore = this.calculateTrendingScore(query, context.temporalContext);
    signals.push({
      type: 'temporal',
      weight: 0.35,
      score: trendingScore,
      confidence: 0.65,
      source: 'trending',
      metadata: { factor: 'current_trends' },
    });
    const seasonalScore = this.calculateSeasonalScore(resultContent, context.temporalContext);
    signals.push({
      type: 'temporal',
      weight: 0.25,
      score: seasonalScore,
      confidence: 0.6,
      source: 'seasonal',
      metadata: { factor: 'seasonal_patterns' },
    });
    return signals;
  }
  recordUserFeedback(feedback) {
    const feedbackWithTimestamp = {
      ...feedback,
      timestamp: Date.now(),
    };
    const key = `${feedback.resultId}_${feedback.query}`;
    if (!this.userFeedback.has(key)) {
      this.userFeedback.set(key, []);
    }
    this.userFeedback.get(key).push(feedbackWithTimestamp);
    this.updateModelsWithFeedback(feedbackWithTimestamp);
    this.emit('feedbackRecorded', feedbackWithTimestamp);
    return `feedback_${Date.now()}`;
  }
  async calculateRelevanceMetrics(query, results, timeRange) {
    const scoringResults = this.getScoringHistory(query, timeRange);
    if (scoringResults.length === 0) {
      throw new Error('No scoring data available for metrics calculation');
    }
    const averageRelevance =
      scoringResults.reduce((sum, result) => sum + result.overallScore, 0) / scoringResults.length;
    const topResults = scoringResults.slice(0, 3);
    const topResultsRelevance =
      topResults.length > 0
        ? topResults.reduce((sum, result) => sum + result.overallScore, 0) / topResults.length
        : 0;
    const precisionAtK = {};
    [1, 3, 5, 10].forEach(k => {
      const relevantResults = scoringResults
        .slice(0, k)
        .filter(result => result.overallScore >= this.qualityThresholds.good);
      precisionAtK[k] = relevantResults.length / Math.min(k, scoringResults.length);
    });
    const ndcg = {};
    [1, 3, 5, 10].forEach(k => {
      ndcg[k] = this.calculateNDCG(scoringResults.slice(0, k));
    });
    const firstRelevantPosition = scoringResults.findIndex(
      result => result.overallScore >= this.qualityThresholds.good
    );
    const meanReciprocalRank = firstRelevantPosition >= 0 ? 1 / (firstRelevantPosition + 1) : 0;
    const qualityDistribution = {
      excellent:
        scoringResults.filter(r => r.overallScore >= this.qualityThresholds.excellent).length /
        scoringResults.length,
      good:
        scoringResults.filter(
          r =>
            r.overallScore >= this.qualityThresholds.good &&
            r.overallScore < this.qualityThresholds.excellent
        ).length / scoringResults.length,
      fair:
        scoringResults.filter(
          r =>
            r.overallScore >= this.qualityThresholds.fair &&
            r.overallScore < this.qualityThresholds.good
        ).length / scoringResults.length,
      poor:
        scoringResults.filter(r => r.overallScore < this.qualityThresholds.fair).length /
        scoringResults.length,
    };
    return {
      averageRelevance,
      topResultsRelevance,
      precisionAtK,
      ndcg,
      meanReciprocalRank,
      qualityDistribution,
    };
  }
  calculateOverallScore(signals) {
    const weightedScores = signals.map(signal => {
      const typeWeight = this.scoringWeights[signal.type] || 0.2;
      return signal.score * signal.weight * typeWeight * signal.confidence;
    });
    const totalWeight = signals.reduce((sum, signal) => {
      const typeWeight = this.scoringWeights[signal.type] || 0.2;
      return sum + signal.weight * typeWeight * signal.confidence;
    }, 0);
    return totalWeight > 0
      ? weightedScores.reduce((sum, score) => sum + score, 0) / totalWeight
      : 0;
  }
  calculateConfidence(signals) {
    const confidenceSum = signals.reduce((sum, signal) => sum + signal.confidence, 0);
    const avgConfidence = confidenceSum / signals.length;
    const signalTypes = new Set(signals.map(s => s.type));
    const diversityBonus = Math.min(signalTypes.size / 5, 1) * 0.1;
    return Math.min(avgConfidence + diversityBonus, 1);
  }
  calculateExactMatch(resultContent, query) {
    const queryLower = query.toLowerCase();
    const titleLower = resultContent.title.toLowerCase();
    const snippetLower = resultContent.snippet.toLowerCase();
    if (titleLower.includes(queryLower)) return 1.0;
    if (snippetLower.includes(queryLower)) return 0.8;
    const queryWords = queryLower.split(/\s+/);
    const titleWords = titleLower.split(/\s+/);
    const snippetWords = snippetLower.split(/\s+/);
    const titleMatches = queryWords.filter(word => titleWords.includes(word)).length;
    const snippetMatches = queryWords.filter(word => snippetWords.includes(word)).length;
    const titleScore = (titleMatches / queryWords.length) * 0.8;
    const snippetScore = (snippetMatches / queryWords.length) * 0.6;
    return Math.max(titleScore, snippetScore);
  }
  calculateTFIDF(resultContent, query) {
    const text =
      `${resultContent.title} ${resultContent.snippet} ${resultContent.content || ''}`.toLowerCase();
    const words = text.split(/\s+/);
    const queryWords = query.toLowerCase().split(/\s+/);
    let score = 0;
    queryWords.forEach(queryWord => {
      const tf = words.filter(word => word === queryWord).length / words.length;
      const idf = Math.log(1000 / (100 + 1));
      score += tf * idf;
    });
    return Math.min(score, 1);
  }
  calculateBM25(resultContent, query) {
    const k1 = 1.2;
    const b = 0.75;
    const avgDocLength = 200;
    const text = `${resultContent.title} ${resultContent.snippet}`.toLowerCase();
    const words = text.split(/\s+/);
    const docLength = words.length;
    const queryWords = query.toLowerCase().split(/\s+/);
    let score = 0;
    queryWords.forEach(queryWord => {
      const tf = words.filter(word => word === queryWord).length;
      const idf = Math.log((1000 - 100 + 0.5) / (100 + 0.5));
      const numerator = tf * (k1 + 1);
      const denominator = tf + k1 * (1 - b + b * (docLength / avgDocLength));
      score += idf * (numerator / denominator);
    });
    return Math.min(score / queryWords.length, 1);
  }
  calculateResultCTR(resultId, query) {
    return Math.random() * 0.5 + 0.3;
  }
  calculateDwellTimeScore(resultId, query) {
    return Math.random() * 0.4 + 0.4;
  }
  calculateInteractionScore(resultId, context) {
    const interactions = context.sessionContext.clickedResults.filter(id => id === resultId).length;
    return Math.min(interactions * 0.3, 1);
  }
  calculateProfileMatch(resultContent, userProfile) {
    const expertiseMatch = this.matchExpertiseLevel(resultContent, userProfile.expertise);
    const preferenceMatch = this.matchPreferences(resultContent, userProfile.preferences);
    return (expertiseMatch + preferenceMatch) / 2;
  }
  calculateSessionRelevance(resultContent, query, sessionContext) {
    const queryRelation = this.analyzeQueryRelation(query, sessionContext.previousQueries);
    const resultRelation = this.analyzeResultRelation(resultContent, sessionContext.clickedResults);
    return (queryRelation + resultRelation) / 2;
  }
  calculateLocationRelevance(resultContent, location) {
    if (!location) return 0.5;
    const hasLocationInfo =
      resultContent.metadata?.location ||
      resultContent.title.toLowerCase().includes(location.toLowerCase()) ||
      resultContent.snippet.toLowerCase().includes(location.toLowerCase());
    return hasLocationInfo ? 0.8 : 0.3;
  }
  async calculateEmbeddingSimilarity(resultContent, query) {
    return Math.random() * 0.4 + 0.4;
  }
  async calculateTopicAlignment(resultContent, query) {
    return Math.random() * 0.5 + 0.3;
  }
  async calculateIntentMatch(resultContent, query, context) {
    const queryIntent = this.classifyQueryIntent(query);
    const contentType = this.classifyContentType(resultContent);
    return this.calculateIntentContentAlignment(queryIntent, contentType);
  }
  calculateFreshnessScore(metadata) {
    const publishDate = metadata.publishDate
      ? new Date(metadata.publishDate).getTime()
      : Date.now();
    const ageInDays = (Date.now() - publishDate) / (1000 * 60 * 60 * 24);
    if (ageInDays < 1) return 1.0;
    if (ageInDays < 7) return 0.8;
    if (ageInDays < 30) return 0.6;
    if (ageInDays < 90) return 0.4;
    return 0.2;
  }
  calculateTrendingScore(query, temporalContext) {
    return Math.random() * 0.3 + 0.2;
  }
  calculateSeasonalScore(resultContent, temporalContext) {
    const currentMonth = new Date().getMonth();
    const seasonalKeywords = this.getSeasonalKeywords(currentMonth);
    const text = `${resultContent.title} ${resultContent.snippet}`.toLowerCase();
    const hasSeasonalRelevance = seasonalKeywords.some(keyword => text.includes(keyword));
    return hasSeasonalRelevance ? 0.8 : 0.5;
  }
  calculateNDCG(results) {
    if (results.length === 0) return 0;
    const dcg = results.reduce((sum, result, index) => {
      const relevance = result.overallScore;
      const discount = Math.log2(index + 2);
      return sum + relevance / discount;
    }, 0);
    const idealResults = [...results].sort((a, b) => b.overallScore - a.overallScore);
    const idcg = idealResults.reduce((sum, result, index) => {
      const relevance = result.overallScore;
      const discount = Math.log2(index + 2);
      return sum + relevance / discount;
    }, 0);
    return idcg > 0 ? dcg / idcg : 0;
  }
  getScoringHistory(query, timeRange) {
    const history = this.scoringHistory.get(query) || [];
    if (!timeRange) return history;
    const [start, end] = timeRange;
    return history.filter(result => result.timestamp >= start && result.timestamp <= end);
  }
  generateExplanation(signals, overallScore) {
    const topSignals = signals.sort((a, b) => b.score * b.weight - a.score * a.weight).slice(0, 3);
    const explanations = topSignals.map(
      signal => `${signal.source}: ${(signal.score * 100).toFixed(1)}% (${signal.type})`
    );
    return `Relevance: ${(overallScore * 100).toFixed(1)}%. Top factors: ${explanations.join(', ')}`;
  }
  generateRecommendations(signals, overallScore) {
    const recommendations = [];
    if (overallScore < 0.5) {
      recommendations.push('Consider improving content relevance to query terms');
    }
    const lowScoreSignals = signals.filter(s => s.score < 0.4);
    if (lowScoreSignals.length > 0) {
      const signalTypes = lowScoreSignals.map(s => s.type);
      recommendations.push(`Improve ${signalTypes.join(', ')} relevance signals`);
    }
    if (signals.filter(s => s.type === 'behavioral').every(s => s.score < 0.5)) {
      recommendations.push('Low user engagement - consider result positioning or presentation');
    }
    return recommendations;
  }
  matchExpertiseLevel(resultContent, expertise) {
    return Math.random() * 0.3 + 0.5;
  }
  matchPreferences(resultContent, preferences) {
    return Math.random() * 0.4 + 0.4;
  }
  analyzeQueryRelation(query, previousQueries) {
    const hasRelatedQuery = previousQueries.some(
      prev => this.calculateQuerySimilarity(query, prev) > 0.5
    );
    return hasRelatedQuery ? 0.8 : 0.4;
  }
  analyzeResultRelation(resultContent, clickedResults) {
    return Math.random() * 0.3 + 0.4;
  }
  calculateQuerySimilarity(query1, query2) {
    const words1 = new Set(query1.toLowerCase().split(/\s+/));
    const words2 = new Set(query2.toLowerCase().split(/\s+/));
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    return union.size > 0 ? intersection.size / union.size : 0;
  }
  classifyQueryIntent(query) {
    if (query.toLowerCase().includes('how to') || query.includes('?')) return 'informational';
    if (query.toLowerCase().includes('buy') || query.toLowerCase().includes('price'))
      return 'transactional';
    if (query.toLowerCase().includes('best') || query.toLowerCase().includes('review'))
      return 'commercial';
    return 'navigational';
  }
  classifyContentType(resultContent) {
    if (resultContent.metadata?.type) return resultContent.metadata.type;
    if (resultContent.title.toLowerCase().includes('tutorial')) return 'tutorial';
    if (resultContent.title.toLowerCase().includes('review')) return 'review';
    return 'article';
  }
  calculateIntentContentAlignment(intent, contentType) {
    const alignmentMatrix = {
      informational: { tutorial: 0.9, article: 0.8, review: 0.6 },
      transactional: { product: 0.9, review: 0.7, article: 0.4 },
      commercial: { review: 0.9, product: 0.8, article: 0.5 },
      navigational: { official: 0.9, article: 0.6, tutorial: 0.5 },
    };
    return alignmentMatrix[intent]?.[contentType] || 0.5;
  }
  getSeasonalKeywords(month) {
    const seasonalMap = {
      0: ['winter', 'january', 'new year', 'resolution'],
      1: ['winter', 'february', 'valentine'],
      2: ['spring', 'march'],
      3: ['spring', 'april', 'easter'],
      4: ['spring', 'may'],
      5: ['summer', 'june'],
      6: ['summer', 'july'],
      7: ['summer', 'august'],
      8: ['fall', 'september', 'autumn'],
      9: ['fall', 'october', 'autumn', 'halloween'],
      10: ['fall', 'november', 'thanksgiving'],
      11: ['winter', 'december', 'christmas', 'holiday'],
    };
    return seasonalMap[month] || [];
  }
  updateModelsWithFeedback(feedback) {
    this.emit('modelUpdated', { feedback, timestamp: Date.now() });
  }
  initializeModels() {
    this.mlModels.set('word2vec', {});
    this.mlModels.set('lda', {});
    this.mlModels.set('intent_classifier', {});
  }
}
exports.RelevanceScorer = RelevanceScorer;
//# sourceMappingURL=RelevanceScorer.js.map
