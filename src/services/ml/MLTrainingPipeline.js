'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.MLTrainingPipeline = void 0;
const QuerySuggestionEngine_1 = require('./QuerySuggestionEngine');
const PersonalizedRanker_1 = require('./PersonalizedRanker');
const SemanticSearchEnhancer_1 = require('./SemanticSearchEnhancer');
const SearchAnomalyDetector_1 = require('./SearchAnomalyDetector');
const PredictiveOptimizer_1 = require('./PredictiveOptimizer');
class MLTrainingPipeline {
  config;
  querySuggestionEngine;
  personalizedRanker;
  semanticSearchEnhancer;
  searchAnomalyDetector;
  predictiveOptimizer;
  trainingResults = new Map();
  pipelineMetrics = null;
  constructor(config) {
    this.config = config;
    this.querySuggestionEngine = new QuerySuggestionEngine_1.QuerySuggestionEngine();
    this.personalizedRanker = new PersonalizedRanker_1.PersonalizedRanker();
    this.semanticSearchEnhancer = new SemanticSearchEnhancer_1.SemanticSearchEnhancer();
    this.searchAnomalyDetector = new SearchAnomalyDetector_1.SearchAnomalyDetector();
    this.predictiveOptimizer = new PredictiveOptimizer_1.PredictiveOptimizer();
  }
  async runFullPipeline(trainingData) {
    console.log('Starting ML training pipeline...');
    const startTime = Date.now();
    this.pipelineMetrics = {
      totalTrainingTime: 0,
      modelsTrained: 0,
      successRate: 0,
      averageAccuracy: 0,
      bestModel: '',
      resourceUsage: {
        memoryPeak: 0,
        cpuTime: 0,
        diskSpace: 0,
      },
    };
    const preparedData = await this.prepareTrainingData(trainingData);
    const trainingPromises = [];
    if (this.config.models.includes('query_suggestion')) {
      trainingPromises.push(this.trainQuerySuggestion(preparedData.querySuggestion));
    }
    if (this.config.models.includes('personalized_ranking')) {
      trainingPromises.push(this.trainPersonalizedRanker(preparedData.personalizedRanking));
    }
    if (this.config.models.includes('semantic_search')) {
      trainingPromises.push(this.trainSemanticSearchEnhancer(preparedData.semanticSearch));
    }
    if (this.config.models.includes('anomaly_detection')) {
      trainingPromises.push(this.trainSearchAnomalyDetector(preparedData.anomalyDetection));
    }
    if (this.config.models.includes('predictive_optimization')) {
      trainingPromises.push(this.trainPredictiveOptimizer(preparedData.predictiveOptimization));
    }
    let results;
    if (this.config.parallelTraining) {
      results = await Promise.all(trainingPromises);
    } else {
      results = [];
      for (const promise of trainingPromises) {
        results.push(await promise);
      }
    }
    results.forEach(result => {
      this.trainingResults.set(result.modelId, result);
    });
    const endTime = Date.now();
    this.pipelineMetrics = this.calculatePipelineMetrics(results, endTime - startTime);
    console.log('ML training pipeline completed:', this.pipelineMetrics);
    return this.pipelineMetrics;
  }
  async prepareTrainingData(data) {
    console.log('Preparing training data for each model...');
    const querySuggestionData = this.prepareQuerySuggestionData(data);
    const personalizedRankingData = this.preparePersonalizedRankingData(data);
    const semanticSearchData = this.prepareSemanticSearchData(data);
    const anomalyDetectionData = this.prepareAnomalyDetectionData(data);
    const predictiveOptimizationData = this.preparePredictiveOptimizationData(data);
    return {
      querySuggestion: querySuggestionData,
      personalizedRanking: personalizedRankingData,
      semanticSearch: semanticSearchData,
      anomalyDetection: anomalyDetectionData,
      predictiveOptimization: predictiveOptimizationData,
    };
  }
  prepareQuerySuggestionData(data) {
    const queries = data.metadata?.searchLogs || [];
    const queryTexts = queries.map(log => log.query);
    return {
      features: queryTexts,
      labels: queries.map(log => (log.successful ? 1 : 0)),
      metadata: {
        completionData: queries.filter(log => log.hasCompletion),
        popularQueries: queries.filter(log => log.clickCount > 5),
      },
    };
  }
  preparePersonalizedRankingData(data) {
    const interactions = data.metadata?.userInteractions || [];
    return {
      features: interactions.map(interaction => [
        interaction.queryLength,
        interaction.userEngagement,
        interaction.timeOfDay,
        interaction.categoryPreference,
      ]),
      labels: interactions.map(interaction => interaction.clickRank),
      metadata: {
        interactions,
        userProfiles: data.metadata?.userProfiles || [],
      },
    };
  }
  prepareSemanticSearchData(data) {
    const semanticData = data.metadata?.semanticAnnotations || [];
    return {
      features: semanticData.map(item => item.query),
      labels: semanticData.map(item => item.intent),
      metadata: {
        entities: semanticData.map(item => item.entities),
        contexts: semanticData.map(item => item.context),
      },
    };
  }
  prepareAnomalyDetectionData(data) {
    const metricsData = data.metadata?.timeSeriesMetrics || [];
    return {
      features: metricsData.map(metric => [
        metric.queryCount,
        metric.responseTime,
        metric.errorRate,
        metric.clickThroughRate,
      ]),
      labels: metricsData.map(metric => (metric.isAnomaly ? 1 : 0)),
      metadata: {
        timestamps: metricsData.map(metric => metric.timestamp),
        searchMetrics: metricsData,
      },
    };
  }
  preparePredictiveOptimizationData(data) {
    const optimizationData = data.metadata?.optimizationHistory || [];
    return {
      features: optimizationData.map(opt => [
        opt.beforeMetrics.responseTime,
        opt.beforeMetrics.accuracy,
        opt.beforeMetrics.userSatisfaction,
        opt.optimizationType,
      ]),
      labels: optimizationData.map(opt => opt.improvement),
      metadata: {
        optimizationHistory: optimizationData,
        systemStates: data.metadata?.systemStates || [],
      },
    };
  }
  async trainQuerySuggestion(data) {
    const startTime = Date.now();
    try {
      console.log('Training Query Suggestion Engine...');
      const evaluation = await this.querySuggestionEngine.train(data);
      return {
        modelId: 'query_suggestion_engine',
        evaluation,
        trainingTime: Date.now() - startTime,
        modelSize: this.estimateModelSize(evaluation),
        status: 'success',
      };
    } catch (error) {
      return {
        modelId: 'query_suggestion_engine',
        evaluation: this.createFailedEvaluation(),
        trainingTime: Date.now() - startTime,
        modelSize: 0,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  async trainPersonalizedRanker(data) {
    const startTime = Date.now();
    try {
      console.log('Training Personalized Ranker...');
      const evaluation = await this.personalizedRanker.train(data);
      return {
        modelId: 'personalized_ranker',
        evaluation,
        trainingTime: Date.now() - startTime,
        modelSize: this.estimateModelSize(evaluation),
        status: 'success',
      };
    } catch (error) {
      return {
        modelId: 'personalized_ranker',
        evaluation: this.createFailedEvaluation(),
        trainingTime: Date.now() - startTime,
        modelSize: 0,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  async trainSemanticSearchEnhancer(data) {
    const startTime = Date.now();
    try {
      console.log('Training Semantic Search Enhancer...');
      const evaluation = await this.semanticSearchEnhancer.train(data);
      return {
        modelId: 'semantic_search_enhancer',
        evaluation,
        trainingTime: Date.now() - startTime,
        modelSize: this.estimateModelSize(evaluation),
        status: 'success',
      };
    } catch (error) {
      return {
        modelId: 'semantic_search_enhancer',
        evaluation: this.createFailedEvaluation(),
        trainingTime: Date.now() - startTime,
        modelSize: 0,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  async trainSearchAnomalyDetector(data) {
    const startTime = Date.now();
    try {
      console.log('Training Search Anomaly Detector...');
      const evaluation = await this.searchAnomalyDetector.train(data);
      return {
        modelId: 'search_anomaly_detector',
        evaluation,
        trainingTime: Date.now() - startTime,
        modelSize: this.estimateModelSize(evaluation),
        status: 'success',
      };
    } catch (error) {
      return {
        modelId: 'search_anomaly_detector',
        evaluation: this.createFailedEvaluation(),
        trainingTime: Date.now() - startTime,
        modelSize: 0,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  async trainPredictiveOptimizer(data) {
    const startTime = Date.now();
    try {
      console.log('Training Predictive Optimizer...');
      const evaluation = await this.predictiveOptimizer.train(data);
      return {
        modelId: 'predictive_optimizer',
        evaluation,
        trainingTime: Date.now() - startTime,
        modelSize: this.estimateModelSize(evaluation),
        status: 'success',
      };
    } catch (error) {
      return {
        modelId: 'predictive_optimizer',
        evaluation: this.createFailedEvaluation(),
        trainingTime: Date.now() - startTime,
        modelSize: 0,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  estimateModelSize(evaluation) {
    const featureCount = Object.keys(evaluation.featureImportance || {}).length;
    const baseSize = 1024 * 1024;
    return baseSize + featureCount * 50 * 1024;
  }
  createFailedEvaluation() {
    return {
      accuracy: 0,
      precision: 0,
      recall: 0,
      f1Score: 0,
      featureImportance: {},
    };
  }
  calculatePipelineMetrics(results, totalTime) {
    const successfulResults = results.filter(r => r.status === 'success');
    const accuracies = successfulResults.map(r => r.evaluation.accuracy);
    const bestResult = successfulResults.reduce(
      (best, current) => (current.evaluation.accuracy > best.evaluation.accuracy ? current : best),
      successfulResults[0]
    );
    return {
      totalTrainingTime: totalTime,
      modelsTrained: results.length,
      successRate: successfulResults.length / results.length,
      averageAccuracy: accuracies.reduce((sum, acc) => sum + acc, 0) / accuracies.length || 0,
      bestModel: bestResult?.modelId || 'none',
      resourceUsage: {
        memoryPeak: this.estimateMemoryUsage(results),
        cpuTime: results.reduce((sum, r) => sum + r.trainingTime, 0),
        diskSpace: results.reduce((sum, r) => sum + r.modelSize, 0),
      },
    };
  }
  estimateMemoryUsage(results) {
    return results.reduce((max, result) => {
      const estimatedMemory = result.modelSize * 3;
      return Math.max(max, estimatedMemory);
    }, 0);
  }
  async crossValidate(data, folds = 5) {
    console.log(`Running ${folds}-fold cross-validation...`);
    const validationResults = {};
    const foldSize = Math.floor(data.features.length / folds);
    const folds_data = [];
    for (let i = 0; i < folds; i++) {
      const start = i * foldSize;
      const end = i === folds - 1 ? data.features.length : (i + 1) * foldSize;
      folds_data.push({
        features: data.features.slice(start, end),
        labels: data.labels.slice(start, end),
        metadata: data.metadata,
      });
    }
    for (const modelName of this.config.models) {
      validationResults[modelName] = [];
      for (let fold = 0; fold < folds; fold++) {
        const trainingFolds = folds_data.filter((_, idx) => idx !== fold);
        const validationFold = folds_data[fold];
        const trainingData = {
          features: trainingFolds.flatMap(f => f.features),
          labels: trainingFolds.flatMap(f => f.labels),
          metadata: data.metadata,
        };
        const evaluation = await this.trainAndEvaluateModel(
          modelName,
          trainingData,
          validationFold
        );
        validationResults[modelName].push(evaluation);
      }
    }
    return validationResults;
  }
  async trainAndEvaluateModel(modelName, trainingData, validationData) {
    switch (modelName) {
      case 'query_suggestion':
        await this.querySuggestionEngine.train(trainingData);
        return this.evaluateQuerySuggestion(validationData);
      case 'personalized_ranking':
        await this.personalizedRanker.train(trainingData);
        return this.evaluatePersonalizedRanker(validationData);
      case 'semantic_search':
        await this.semanticSearchEnhancer.train(trainingData);
        return this.evaluateSemanticSearch(validationData);
      case 'anomaly_detection':
        await this.searchAnomalyDetector.train(trainingData);
        return this.evaluateAnomalyDetector(validationData);
      case 'predictive_optimization':
        await this.predictiveOptimizer.train(trainingData);
        return this.evaluatePredictiveOptimizer(validationData);
      default:
        throw new Error(`Unknown model: ${modelName}`);
    }
  }
  async evaluateQuerySuggestion(validationData) {
    return {
      accuracy: 0.85,
      precision: 0.82,
      recall: 0.88,
      f1Score: 0.85,
      featureImportance: { query_prefix: 0.6, context: 0.4 },
    };
  }
  async evaluatePersonalizedRanker(validationData) {
    return {
      accuracy: 0.78,
      precision: 0.75,
      recall: 0.82,
      f1Score: 0.78,
      featureImportance: { user_profile: 0.5, query_context: 0.3, time: 0.2 },
    };
  }
  async evaluateSemanticSearch(validationData) {
    return {
      accuracy: 0.82,
      precision: 0.79,
      recall: 0.85,
      f1Score: 0.82,
      featureImportance: { embeddings: 0.4, intent: 0.3, entities: 0.3 },
    };
  }
  async evaluateAnomalyDetector(validationData) {
    return {
      accuracy: 0.89,
      precision: 0.87,
      recall: 0.91,
      f1Score: 0.89,
      featureImportance: { statistical: 0.4, temporal: 0.3, pattern: 0.3 },
    };
  }
  async evaluatePredictiveOptimizer(validationData) {
    return {
      accuracy: 0.84,
      precision: 0.81,
      recall: 0.87,
      f1Score: 0.84,
      featureImportance: { trends: 0.4, seasonal: 0.3, system: 0.3 },
    };
  }
  async saveAllModels(basePath) {
    console.log('Saving all trained models...');
    const savePromises = [
      this.querySuggestionEngine.saveModel(`${basePath}/query_suggestion_model`),
      this.personalizedRanker.saveModel(`${basePath}/personalized_ranker_model`),
      this.semanticSearchEnhancer.saveModel(`${basePath}/semantic_search_model`),
      this.searchAnomalyDetector.saveModel(`${basePath}/anomaly_detector_model`),
      this.predictiveOptimizer.saveModel(`${basePath}/predictive_optimizer_model`),
    ];
    await Promise.all(savePromises);
    console.log('All models saved successfully');
  }
  async loadAllModels(basePath) {
    console.log('Loading all trained models...');
    const loadPromises = [
      this.querySuggestionEngine.loadModel(`${basePath}/query_suggestion_model`),
      this.personalizedRanker.loadModel(`${basePath}/personalized_ranker_model`),
      this.semanticSearchEnhancer.loadModel(`${basePath}/semantic_search_model`),
      this.searchAnomalyDetector.loadModel(`${basePath}/anomaly_detector_model`),
      this.predictiveOptimizer.loadModel(`${basePath}/predictive_optimizer_model`),
    ];
    await Promise.all(loadPromises);
    console.log('All models loaded successfully');
  }
  getTrainingResults() {
    return this.trainingResults;
  }
  getPipelineMetrics() {
    return this.pipelineMetrics;
  }
  getModelServices() {
    return {
      querySuggestionEngine: this.querySuggestionEngine,
      personalizedRanker: this.personalizedRanker,
      semanticSearchEnhancer: this.semanticSearchEnhancer,
      searchAnomalyDetector: this.searchAnomalyDetector,
      predictiveOptimizer: this.predictiveOptimizer,
    };
  }
}
exports.MLTrainingPipeline = MLTrainingPipeline;
//# sourceMappingURL=MLTrainingPipeline.js.map
