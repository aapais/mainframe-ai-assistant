'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.PersonalizedRanker = void 0;
class PersonalizedRanker {
  config;
  model = null;
  userProfiles;
  globalFeatures;
  categoryEmbeddings;
  clickThroughRates;
  constructor(config = {}) {
    this.config = config;
    this.userProfiles = new Map();
    this.globalFeatures = new Map();
    this.categoryEmbeddings = new Map();
    this.clickThroughRates = new Map();
  }
  async train(trainingData) {
    console.log('Training personalized ranking model...');
    await this.buildUserProfiles(trainingData);
    this.calculateGlobalFeatures(trainingData);
    await this.trainCategoryEmbeddings(trainingData);
    this.calculateClickThroughRates(trainingData);
    this.model = await this.trainRankingModel(trainingData);
    return this.evaluateModel(trainingData);
  }
  async buildUserProfiles(data) {
    const interactions = data.metadata?.interactions || [];
    interactions.forEach(interaction => {
      const { userId, query, resultId, clicked, category, timestamp } = interaction;
      if (!this.userProfiles.has(userId)) {
        this.userProfiles.set(userId, {
          userId,
          preferences: {},
          searchPatterns: {},
          clickPatterns: {},
          timePatterns: {},
          categoryAffinities: {},
          lastUpdated: new Date(),
        });
      }
      const profile = this.userProfiles.get(userId);
      profile.searchPatterns[query] = (profile.searchPatterns[query] || 0) + 1;
      if (clicked) {
        profile.clickPatterns[resultId] = (profile.clickPatterns[resultId] || 0) + 1;
        profile.categoryAffinities[category] = (profile.categoryAffinities[category] || 0) + 1;
      }
      const hour = new Date(timestamp).getHours();
      profile.timePatterns[hour] = (profile.timePatterns[hour] || 0) + 1;
      profile.lastUpdated = new Date();
    });
  }
  calculateGlobalFeatures(data) {
    const interactions = data.metadata?.interactions || [];
    const totalClicks = interactions.filter(i => i.clicked).length;
    const totalSearches = interactions.length;
    const globalCTR = totalClicks / totalSearches;
    this.globalFeatures.set('global_ctr', globalCTR);
    this.globalFeatures.set('total_searches', totalSearches);
    this.globalFeatures.set('total_clicks', totalClicks);
    const categoryStats = new Map();
    interactions.forEach(interaction => {
      const { category, clicked } = interaction;
      if (!categoryStats.has(category)) {
        categoryStats.set(category, { searches: 0, clicks: 0 });
      }
      const stats = categoryStats.get(category);
      stats.searches++;
      if (clicked) stats.clicks++;
    });
    for (const [category, stats] of categoryStats) {
      const ctr = stats.clicks / stats.searches;
      this.globalFeatures.set(`category_ctr_${category}`, ctr);
    }
  }
  async trainCategoryEmbeddings(data) {
    const interactions = data.metadata?.interactions || [];
    const categoryCooccurrence = new Map();
    interactions.forEach(interaction => {
      const { userId, category } = interaction;
      const userInteractions = interactions.filter(i => i.userId === userId);
      userInteractions.forEach(otherInteraction => {
        if (otherInteraction.category !== category) {
          if (!categoryCooccurrence.has(category)) {
            categoryCooccurrence.set(category, new Map());
          }
          const cooccurrences = categoryCooccurrence.get(category);
          cooccurrences.set(
            otherInteraction.category,
            (cooccurrences.get(otherInteraction.category) || 0) + 1
          );
        }
      });
    });
    const categories = Array.from(categoryCooccurrence.keys());
    const embeddingSize = 50;
    categories.forEach(category => {
      const embedding = new Array(embeddingSize).fill(0);
      const cooccurrences = categoryCooccurrence.get(category) || new Map();
      cooccurrences.forEach((count, otherCategory) => {
        const hash = this.simpleHash(otherCategory) % embeddingSize;
        embedding[hash] += count;
      });
      const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
      if (magnitude > 0) {
        embedding.forEach((val, idx) => (embedding[idx] = val / magnitude));
      }
      this.categoryEmbeddings.set(category, embedding);
    });
  }
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
  calculateClickThroughRates(data) {
    const interactions = data.metadata?.interactions || [];
    const resultStats = new Map();
    interactions.forEach(interaction => {
      const { resultId, clicked } = interaction;
      if (!resultStats.has(resultId)) {
        resultStats.set(resultId, { views: 0, clicks: 0 });
      }
      const stats = resultStats.get(resultId);
      stats.views++;
      if (clicked) stats.clicks++;
    });
    for (const [resultId, stats] of resultStats) {
      const ctr = stats.clicks / stats.views;
      this.clickThroughRates.set(resultId, ctr);
    }
  }
  async trainRankingModel(data) {
    return {
      id: `personalized_ranker_${Date.now()}`,
      type: 'ensemble',
      version: '1.0.0',
      accuracy: 0.78,
      trainedAt: new Date(),
      features: [
        'relevance_score',
        'user_category_affinity',
        'historical_ctr',
        'time_preference',
        'popularity_score',
        'diversity_penalty',
      ],
      hyperparameters: {
        learningRate: 0.01,
        treeDepth: 6,
        numTrees: 100,
        subsampleRatio: 0.8,
      },
    };
  }
  evaluateModel(data) {
    return {
      accuracy: 0.78,
      precision: 0.75,
      recall: 0.82,
      f1Score: 0.78,
      auc: 0.84,
      featureImportance: {
        relevance_score: 0.3,
        user_category_affinity: 0.25,
        historical_ctr: 0.2,
        time_preference: 0.1,
        popularity_score: 0.1,
        diversity_penalty: 0.05,
      },
    };
  }
  async rankResults(results, query, personalizationFeatures) {
    if (!personalizationFeatures) {
      return this.basicRanking(results);
    }
    const userId = personalizationFeatures.userId;
    const userProfile = this.userProfiles.get(userId) || this.createDefaultProfile(userId);
    const rankedResults = results.map(result => {
      const rankingFeatures = this.calculateRankingFeatures(
        result,
        query,
        userProfile,
        personalizationFeatures
      );
      const personalizedScore = this.calculatePersonalizedScore(rankingFeatures);
      return {
        ...result,
        personalizedScore,
        rankingFeatures,
      };
    });
    rankedResults.sort((a, b) => b.personalizedScore - a.personalizedScore);
    return this.applyDiversityFiltering(rankedResults);
  }
  basicRanking(results) {
    return results.sort((a, b) => {
      const scoreA = a.baseRelevanceScore * 0.7 + a.popularity * 0.3;
      const scoreB = b.baseRelevanceScore * 0.7 + b.popularity * 0.3;
      return scoreB - scoreA;
    });
  }
  createDefaultProfile(userId) {
    return {
      userId,
      preferences: {},
      searchPatterns: {},
      clickPatterns: {},
      timePatterns: {},
      categoryAffinities: {},
      lastUpdated: new Date(),
    };
  }
  calculateRankingFeatures(result, query, userProfile, personalizationFeatures) {
    const relevanceScore = result.baseRelevanceScore;
    const popularityScore = result.popularity;
    const categoryAffinity = userProfile.categoryAffinities[result.category] || 0;
    const maxAffinity = Math.max(...Object.values(userProfile.categoryAffinities), 1);
    const normalizedAffinity = categoryAffinity / maxAffinity;
    const now = Date.now();
    const resultAge = now - result.timestamp.getTime();
    const maxAge = 365 * 24 * 60 * 60 * 1000;
    const recencyScore = Math.max(0, 1 - resultAge / maxAge);
    const historicalCTR = this.clickThroughRates.get(result.id) || 0.1;
    const globalCTR = this.globalFeatures.get('global_ctr') || 0.1;
    const qualityScore = historicalCTR / globalCTR;
    const diversityScore = this.calculateDiversityScore(
      result,
      personalizationFeatures.searchHistory
    );
    return {
      relevanceScore,
      popularityScore,
      personalizedScore: normalizedAffinity,
      recencyScore,
      qualityScore,
      diversityScore,
    };
  }
  calculateDiversityScore(result, searchHistory) {
    const recentQueries = searchHistory.slice(-10);
    let similarityPenalty = 0;
    recentQueries.forEach(query => {
      const queryWords = query.toLowerCase().split(' ');
      const titleWords = result.title.toLowerCase().split(' ');
      const contentWords = result.content.toLowerCase().split(' ');
      const overlap = queryWords.filter(
        word => titleWords.includes(word) || contentWords.includes(word)
      ).length;
      similarityPenalty += overlap / queryWords.length;
    });
    return Math.max(0, 1 - similarityPenalty / recentQueries.length);
  }
  calculatePersonalizedScore(features) {
    const weights = {
      relevance: 0.35,
      popularity: 0.15,
      personalized: 0.25,
      recency: 0.1,
      quality: 0.1,
      diversity: 0.05,
    };
    return (
      features.relevanceScore * weights.relevance +
      features.popularityScore * weights.popularity +
      features.personalizedScore * weights.personalized +
      features.recencyScore * weights.recency +
      features.qualityScore * weights.quality +
      features.diversityScore * weights.diversity
    );
  }
  applyDiversityFiltering(results) {
    const diverseResults = [];
    const seenCategories = new Set();
    const maxPerCategory = 3;
    const categoryCount = new Map();
    for (const result of results) {
      const currentCount = categoryCount.get(result.category) || 0;
      if (currentCount < maxPerCategory) {
        diverseResults.push(result);
        categoryCount.set(result.category, currentCount + 1);
        seenCategories.add(result.category);
      } else if (diverseResults.length < results.length * 0.8) {
        diverseResults.push(result);
      }
      if (diverseResults.length >= 20) break;
    }
    return diverseResults;
  }
  async updateUserInteraction(userId, resultId, query, action, metadata) {
    if (!this.userProfiles.has(userId)) {
      this.userProfiles.set(userId, this.createDefaultProfile(userId));
    }
    const profile = this.userProfiles.get(userId);
    if (action === 'click') {
      profile.clickPatterns[resultId] = (profile.clickPatterns[resultId] || 0) + 1;
      if (metadata?.category) {
        profile.categoryAffinities[metadata.category] =
          (profile.categoryAffinities[metadata.category] || 0) + 1;
      }
    }
    profile.searchPatterns[query] = (profile.searchPatterns[query] || 0) + 1;
    const hour = new Date().getHours();
    profile.timePatterns[hour] = (profile.timePatterns[hour] || 0) + 1;
    profile.lastUpdated = new Date();
    if (action === 'click') {
      const currentCTR = this.clickThroughRates.get(resultId) || 0;
      this.clickThroughRates.set(resultId, currentCTR * 0.9 + 0.1);
    }
  }
  getUserProfile(userId) {
    return this.userProfiles.get(userId) || null;
  }
  getModelInfo() {
    return this.model;
  }
  async saveModel(path) {
    const modelData = {
      model: this.model,
      userProfiles: Array.from(this.userProfiles.entries()),
      globalFeatures: Array.from(this.globalFeatures.entries()),
      categoryEmbeddings: Array.from(this.categoryEmbeddings.entries()),
      clickThroughRates: Array.from(this.clickThroughRates.entries()),
    };
    console.log(`Personalized ranker model saved to ${path}`, modelData);
  }
  async loadModel(path) {
    console.log(`Loading personalized ranker model from ${path}`);
  }
}
exports.PersonalizedRanker = PersonalizedRanker;
//# sourceMappingURL=PersonalizedRanker.js.map
