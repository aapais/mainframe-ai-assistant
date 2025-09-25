'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.PredictiveCache = void 0;
const events_1 = require('events');
class PredictiveCache extends events_1.EventEmitter {
  config;
  stats;
  userPatterns = new Map();
  globalPatterns = new Map();
  temporalPatterns = new Map();
  predictionModels = new Map();
  activeModel;
  predictionQueue = [];
  pendingPredictions = new Set();
  predictionHistory = [];
  constructor(config = {}) {
    super();
    this.config = {
      enableMLPredictions: true,
      maxPredictions: 50,
      confidenceThreshold: 0.7,
      predictionHorizon: 30,
      modelUpdateInterval: 60,
      enablePatternLearning: true,
      enableContextualPredictions: true,
      enableTemporalPredictions: true,
      maxPatternHistory: 10000,
      predictionBatchSize: 10,
      ...config,
    };
    this.stats = {
      totalPredictions: 0,
      successfulPredictions: 0,
      predictionAccuracy: 0,
      cacheHitRate: 0,
      computationTimeSaved: 0,
      modelsActive: 0,
      patternsLearned: 0,
      averagePredictionTime: 0,
    };
    this.initializeModels();
    this.startPredictionEngine();
  }
  recordSearchEvent(sessionId, event, userId) {
    const userKey = userId || sessionId;
    if (!this.userPatterns.has(userKey)) {
      this.userPatterns.set(userKey, {
        userId,
        sessionId,
        searchHistory: [],
        categoryPreferences: new Map(),
        timePatterns: new Map(),
        queryPatterns: [],
        behaviorScore: 0,
      });
    }
    const pattern = this.userPatterns.get(userKey);
    pattern.searchHistory.push(event);
    if (pattern.searchHistory.length > 100) {
      pattern.searchHistory = pattern.searchHistory.slice(-100);
    }
    this.updateUserPatterns(pattern, event);
    this.updateGlobalPatterns(event);
    this.updateTemporalPatterns(event);
    this.generatePredictions(userKey);
  }
  async getPredictions(sessionId, userId, context) {
    const userKey = userId || sessionId;
    const userPattern = this.userPatterns.get(userKey);
    if (!userPattern || !this.config.enableMLPredictions) {
      return [];
    }
    const predictions = [];
    if (this.config.enablePatternLearning) {
      const patternPredictions = this.generatePatternBasedPredictions(userPattern, context);
      predictions.push(...patternPredictions);
    }
    if (this.config.enableTemporalPredictions) {
      const temporalPredictions = this.generateTemporalPredictions(userPattern);
      predictions.push(...temporalPredictions);
    }
    if (this.config.enableContextualPredictions && context) {
      const contextualPredictions = this.generateContextualPredictions(userPattern, context);
      predictions.push(...contextualPredictions);
    }
    if (this.activeModel) {
      const mlPredictions = this.generateMLPredictions(userPattern, context);
      predictions.push(...mlPredictions);
    }
    const filtered = this.filterPredictions(predictions);
    const ranked = this.rankPredictions(filtered);
    return ranked.slice(0, this.config.maxPredictions);
  }
  markPredictionSuccess(key) {
    this.pendingPredictions.delete(key);
    this.stats.successfulPredictions++;
    this.updateAccuracy();
    const prediction = this.predictionHistory.find(p => p.prediction.key === key);
    if (prediction) {
      prediction.actual = true;
    }
    this.emit('prediction-success', { key });
  }
  markPredictionFailure(key) {
    this.pendingPredictions.delete(key);
    this.updateAccuracy();
    this.emit('prediction-failure', { key });
  }
  async trainModels() {
    if (!this.config.enableMLPredictions) return;
    const trainingData = this.prepareTrainingData();
    if (trainingData.length < 100) {
      console.log('Insufficient training data for model update');
      return;
    }
    console.log(`Training predictive models with ${trainingData.length} samples...`);
    const model = await this.trainPredictionModel(trainingData);
    if (model.accuracy > (this.activeModel?.accuracy || 0)) {
      this.activeModel = model;
      this.predictionModels.set(model.id, model);
      console.log(`Updated active model (accuracy: ${model.accuracy.toFixed(3)})`);
    }
    this.stats.modelsActive = this.predictionModels.size;
    this.emit('model-updated', { modelId: model.id, accuracy: model.accuracy });
  }
  getStats() {
    this.updateStats();
    return { ...this.stats };
  }
  reset() {
    this.userPatterns.clear();
    this.globalPatterns.clear();
    this.temporalPatterns.clear();
    this.predictionQueue = [];
    this.pendingPredictions.clear();
    this.predictionHistory = [];
    this.stats = {
      totalPredictions: 0,
      successfulPredictions: 0,
      predictionAccuracy: 0,
      cacheHitRate: 0,
      computationTimeSaved: 0,
      modelsActive: 0,
      patternsLearned: 0,
      averagePredictionTime: 0,
    };
  }
  initializeModels() {
    const baseModel = {
      id: 'frequency-base',
      name: 'Frequency-based Predictor',
      version: '1.0',
      accuracy: 0.6,
      lastTraining: Date.now(),
      features: ['query_frequency', 'category_frequency', 'temporal_pattern'],
      weights: [0.4, 0.3, 0.3],
    };
    this.predictionModels.set(baseModel.id, baseModel);
    this.activeModel = baseModel;
    this.stats.modelsActive = 1;
  }
  updateUserPatterns(pattern, event) {
    if (event.category) {
      const currentPref = pattern.categoryPreferences.get(event.category) || 0;
      pattern.categoryPreferences.set(event.category, currentPref + 1);
    }
    const hour = new Date(event.timestamp).getHours();
    const currentTime = pattern.timePatterns.get(hour.toString()) || 0;
    pattern.timePatterns.set(hour.toString(), currentTime + 1);
    this.updateQueryPatterns(pattern, event);
    pattern.behaviorScore = this.calculateBehaviorScore(pattern);
  }
  updateQueryPatterns(pattern, event) {
    const existingPattern = pattern.queryPatterns.find(
      p => this.calculateSimilarity(p.pattern, event.query) > 0.8
    );
    if (existingPattern) {
      existingPattern.frequency++;
      event.followupQueries.forEach(nextQuery => {
        const current = existingPattern.nextQueries.get(nextQuery) || 0;
        existingPattern.nextQueries.set(nextQuery, current + 1);
      });
    } else {
      const newPattern = {
        pattern: event.query,
        frequency: 1,
        nextQueries: new Map(),
        contextClues: this.extractContextClues(event.query),
        temporalPattern: new Array(24).fill(0),
      };
      event.followupQueries.forEach(nextQuery => {
        newPattern.nextQueries.set(nextQuery, 1);
      });
      const hour = new Date(event.timestamp).getHours();
      newPattern.temporalPattern[hour]++;
      pattern.queryPatterns.push(newPattern);
    }
  }
  updateGlobalPatterns(event) {
    const key = this.normalizeQuery(event.query);
    if (!this.globalPatterns.has(key)) {
      this.globalPatterns.set(key, {
        pattern: event.query,
        frequency: 0,
        nextQueries: new Map(),
        contextClues: this.extractContextClues(event.query),
        temporalPattern: new Array(24).fill(0),
      });
    }
    const pattern = this.globalPatterns.get(key);
    pattern.frequency++;
    const hour = new Date(event.timestamp).getHours();
    pattern.temporalPattern[hour]++;
    event.followupQueries.forEach(nextQuery => {
      const current = pattern.nextQueries.get(nextQuery) || 0;
      pattern.nextQueries.set(nextQuery, current + 1);
    });
    this.stats.patternsLearned = this.globalPatterns.size;
  }
  updateTemporalPatterns(event) {
    const date = new Date(event.timestamp);
    const hour = date.getHours();
    const dayOfWeek = date.getDay();
    const key = `${dayOfWeek}-${hour}`;
    if (!this.temporalPatterns.has(key)) {
      this.temporalPatterns.set(key, new Array(24).fill(0));
    }
    const pattern = this.temporalPatterns.get(key);
    pattern[hour]++;
  }
  generatePredictions(userKey) {
    if (this.predictionQueue.length > this.config.maxPredictions) {
      return;
    }
    setTimeout(() => {
      this.getPredictions(userKey).then(predictions => {
        predictions.forEach(prediction => {
          if (!this.pendingPredictions.has(prediction.key)) {
            this.predictionQueue.push(prediction);
            this.pendingPredictions.add(prediction.key);
          }
        });
        this.processPredictionQueue();
      });
    }, 100);
  }
  generatePatternBasedPredictions(userPattern, context) {
    const predictions = [];
    const recentQueries = userPattern.searchHistory.slice(-5).map(event => event.query);
    for (const queryPattern of userPattern.queryPatterns) {
      for (const [nextQuery, frequency] of queryPattern.nextQueries) {
        const confidence = frequency / queryPattern.frequency;
        if (confidence >= this.config.confidenceThreshold) {
          predictions.push({
            key: this.generatePredictionKey(nextQuery, userPattern.sessionId),
            query: nextQuery,
            confidence,
            estimatedValue: this.calculateEstimatedValue(nextQuery, frequency),
            computationCost: this.estimateComputationCost(nextQuery),
            priority: this.calculatePriority(confidence, frequency),
            timeToNeeded: this.estimateTimeToNeeded(queryPattern, context),
            userContext: userPattern.userId,
            tags: ['pattern-based'],
            category: this.predictCategory(nextQuery, userPattern),
          });
        }
      }
    }
    return predictions;
  }
  generateTemporalPredictions(userPattern) {
    const predictions = [];
    const currentHour = new Date().getHours();
    const nextHour = (currentHour + 1) % 24;
    const timeKey = nextHour.toString();
    const timeFrequency = userPattern.timePatterns.get(timeKey) || 0;
    if (timeFrequency > 2) {
      const timeBasedQueries = userPattern.searchHistory
        .filter(event => new Date(event.timestamp).getHours() === nextHour)
        .map(event => event.query);
      const uniqueQueries = [...new Set(timeBasedQueries)];
      uniqueQueries.forEach(query => {
        const frequency = timeBasedQueries.filter(q => q === query).length;
        const confidence = frequency / timeFrequency;
        if (confidence >= this.config.confidenceThreshold) {
          predictions.push({
            key: this.generatePredictionKey(query, userPattern.sessionId),
            query,
            confidence,
            estimatedValue: this.calculateEstimatedValue(query, frequency),
            computationCost: this.estimateComputationCost(query),
            priority: this.calculatePriority(confidence, frequency),
            timeToNeeded: (60 - new Date().getMinutes()) * 60 * 1000,
            userContext: userPattern.userId,
            tags: ['temporal-based'],
            category: this.predictCategory(query, userPattern),
          });
        }
      });
    }
    return predictions;
  }
  generateContextualPredictions(userPattern, context) {
    const predictions = [];
    if (context.currentCategory) {
      const categoryQueries = userPattern.searchHistory
        .filter(event => event.category === context.currentCategory)
        .map(event => event.query);
      const frequency = new Map();
      categoryQueries.forEach(query => {
        frequency.set(query, (frequency.get(query) || 0) + 1);
      });
      for (const [query, count] of frequency) {
        const confidence = count / categoryQueries.length;
        if (confidence >= this.config.confidenceThreshold) {
          predictions.push({
            key: this.generatePredictionKey(query, userPattern.sessionId),
            query,
            confidence,
            estimatedValue: this.calculateEstimatedValue(query, count),
            computationCost: this.estimateComputationCost(query),
            priority: this.calculatePriority(confidence, count),
            timeToNeeded: 5 * 60 * 1000,
            userContext: userPattern.userId,
            tags: ['context-based'],
            category: context.currentCategory,
          });
        }
      }
    }
    return predictions;
  }
  generateMLPredictions(userPattern, context) {
    if (!this.activeModel) return [];
    const predictions = [];
    const features = this.extractFeatures(userPattern, context);
    const prediction = this.applyModel(this.activeModel, features);
    if (prediction.confidence >= this.config.confidenceThreshold) {
      predictions.push({
        key: this.generatePredictionKey(prediction.query, userPattern.sessionId),
        query: prediction.query,
        confidence: prediction.confidence,
        estimatedValue: prediction.value,
        computationCost: this.estimateComputationCost(prediction.query),
        priority: this.calculatePriority(prediction.confidence, 1),
        timeToNeeded: prediction.timeToNeeded,
        userContext: userPattern.userId,
        tags: ['ml-based'],
        category: prediction.category,
      });
    }
    return predictions;
  }
  filterPredictions(predictions) {
    return predictions.filter(prediction => {
      if (prediction.confidence < this.config.confidenceThreshold) {
        return false;
      }
      if (this.pendingPredictions.has(prediction.key)) {
        return false;
      }
      const benefit = prediction.estimatedValue * prediction.confidence;
      const cost = prediction.computationCost;
      return benefit > cost * 1.5;
    });
  }
  rankPredictions(predictions) {
    return predictions.sort((a, b) => {
      const scoreA = this.calculatePredictionScore(a);
      const scoreB = this.calculatePredictionScore(b);
      return scoreB - scoreA;
    });
  }
  calculatePredictionScore(prediction) {
    const confidenceWeight = 0.4;
    const valueWeight = 0.3;
    const urgencyWeight = 0.2;
    const costWeight = -0.1;
    const urgency = Math.max(0, 1 - prediction.timeToNeeded / (30 * 60 * 1000));
    return (
      prediction.confidence * confidenceWeight +
      prediction.estimatedValue * valueWeight +
      urgency * urgencyWeight +
      (1 / prediction.computationCost) * costWeight
    );
  }
  processPredictionQueue() {
    const batch = this.predictionQueue.splice(0, this.config.predictionBatchSize);
    batch.forEach(prediction => {
      this.stats.totalPredictions++;
      this.predictionHistory.push({
        prediction,
        actual: false,
        timestamp: Date.now(),
      });
      this.emit('prediction-generated', prediction);
    });
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    this.predictionHistory = this.predictionHistory.filter(p => p.timestamp > cutoff);
  }
  startPredictionEngine() {
    setInterval(
      () => {
        this.trainModels();
      },
      this.config.modelUpdateInterval * 60 * 1000
    );
    setInterval(
      () => {
        this.cleanupOldPatterns();
      },
      60 * 60 * 1000
    );
  }
  calculateSimilarity(str1, str2) {
    const set1 = new Set(str1.toLowerCase().split(/\s+/));
    const set2 = new Set(str2.toLowerCase().split(/\s+/));
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    return intersection.size / union.size;
  }
  extractContextClues(query) {
    return query
      .toLowerCase()
      .split(/\s+/)
      .filter(term => term.length > 3)
      .slice(0, 5);
  }
  normalizeQuery(query) {
    return query.toLowerCase().trim().replace(/\s+/g, ' ');
  }
  calculateBehaviorScore(pattern) {
    const searchFrequency = pattern.searchHistory.length;
    const categoryDiversity = pattern.categoryPreferences.size;
    const timeSpread = pattern.timePatterns.size;
    return (searchFrequency * 0.5 + categoryDiversity * 0.3 + timeSpread * 0.2) / 100;
  }
  calculateEstimatedValue(query, frequency) {
    const complexityScore = query.split(' ').length * 0.1;
    const frequencyScore = Math.log(frequency + 1) * 0.2;
    return complexityScore + frequencyScore;
  }
  estimateComputationCost(query) {
    const terms = query.split(' ').length;
    const basecost = 0.1;
    return baseCore + terms * 0.05;
  }
  calculatePriority(confidence, frequency) {
    const score = confidence * Math.log(frequency + 1);
    if (score > 2) return 'critical';
    if (score > 1.5) return 'high';
    if (score > 1) return 'medium';
    return 'low';
  }
  estimateTimeToNeeded(pattern, context) {
    const currentHour = new Date().getHours();
    const nextLikelyHour = pattern.temporalPattern.indexOf(Math.max(...pattern.temporalPattern));
    let hoursUntil = nextLikelyHour - currentHour;
    if (hoursUntil <= 0) hoursUntil += 24;
    return hoursUntil * 60 * 60 * 1000;
  }
  predictCategory(query, userPattern) {
    const categories = Array.from(userPattern.categoryPreferences.entries()).sort(
      (a, b) => b[1] - a[1]
    );
    return categories[0]?.[0];
  }
  generatePredictionKey(query, sessionId) {
    return `pred:${sessionId}:${btoa(query).slice(0, 10)}`;
  }
  extractFeatures(userPattern, context) {
    return [
      userPattern.behaviorScore,
      userPattern.searchHistory.length,
      userPattern.categoryPreferences.size,
      userPattern.timePatterns.size,
      context?.urgency || 0,
      context?.sessionLength || 0,
    ];
  }
  applyModel(model, features) {
    let score = 0;
    for (let i = 0; i < Math.min(features.length, model.weights.length); i++) {
      score += features[i] * model.weights[i];
    }
    return {
      query: 'predicted_query',
      confidence: Math.min(1, Math.max(0, score)),
      value: score * 0.5,
      timeToNeeded: 10 * 60 * 1000,
      category: 'General',
    };
  }
  prepareTrainingData() {
    return this.predictionHistory
      .filter(p => Date.now() - p.timestamp < 7 * 24 * 60 * 60 * 1000)
      .map(p => ({
        features: [
          p.prediction.confidence,
          p.prediction.estimatedValue,
          p.prediction.computationCost,
          p.prediction.timeToNeeded,
        ],
        label: p.actual ? 1 : 0,
      }));
  }
  async trainPredictionModel(trainingData) {
    const accuracy = trainingData.filter(d => d.label === 1).length / trainingData.length;
    return {
      id: `model-${Date.now()}`,
      name: 'Trained Predictor',
      version: '2.0',
      accuracy,
      lastTraining: Date.now(),
      features: ['confidence', 'value', 'cost', 'time'],
      weights: [0.4, 0.3, 0.2, 0.1],
    };
  }
  updateAccuracy() {
    const total = this.stats.totalPredictions;
    this.stats.predictionAccuracy = total > 0 ? this.stats.successfulPredictions / total : 0;
  }
  updateStats() {
    this.stats.patternsLearned = this.globalPatterns.size;
    this.stats.modelsActive = this.predictionModels.size;
    const recentPredictions = this.predictionHistory.filter(
      p => Date.now() - p.timestamp < 60 * 60 * 1000
    );
    if (recentPredictions.length > 0) {
      this.stats.averagePredictionTime = recentPredictions.length / 60;
    }
  }
  cleanupOldPatterns() {
    const cutoff = Date.now() - this.config.maxPatternHistory * 60 * 1000;
    for (const [userKey, pattern] of this.userPatterns) {
      pattern.searchHistory = pattern.searchHistory.filter(event => event.timestamp > cutoff);
      if (pattern.searchHistory.length === 0) {
        this.userPatterns.delete(userKey);
      }
    }
    console.log(`Cleaned up old patterns. Active users: ${this.userPatterns.size}`);
  }
}
exports.PredictiveCache = PredictiveCache;
exports.default = PredictiveCache;
//# sourceMappingURL=PredictiveCache.js.map
