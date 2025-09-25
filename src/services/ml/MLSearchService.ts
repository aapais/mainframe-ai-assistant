import { QuerySuggestionEngine } from './QuerySuggestionEngine';
import { PersonalizedRanker } from './PersonalizedRanker';
import { SemanticSearchEnhancer } from './SemanticSearchEnhancer';
import { SearchAnomalyDetector } from './SearchAnomalyDetector';
import { PredictiveOptimizer } from './PredictiveOptimizer';
import { MLTrainingPipeline, PipelineMetrics } from './MLTrainingPipeline';
import { MLModelMonitor } from './MLModelMonitor';
import {
  QuerySuggestion,
  PersonalizationFeatures,
  SearchAnomaly,
  PredictiveInsight,
  TrainingData,
  MLConfig,
} from '../../types/ml';

interface SearchRequest {
  query: string;
  userId?: string;
  sessionId?: string;
  filters?: Record<string, any>;
  pagination?: {
    offset: number;
    limit: number;
  };
  personalization?: PersonalizationFeatures;
}

interface SearchResponse {
  results: any[];
  suggestions: QuerySuggestion[];
  totalCount: number;
  processingTime: number;
  semanticAnalysis?: {
    intent: string;
    entities: any[];
    expandedQuery: string;
    complexity: number;
    sentiment: number;
  };
  personalizationApplied: boolean;
  anomaliesDetected: SearchAnomaly[];
  optimizationInsights: PredictiveInsight[];
}

interface SearchMetrics {
  timestamp: Date;
  queryCount: number;
  uniqueQueries: number;
  averageResponseTime: number;
  clickThroughRate: number;
  bounceRate: number;
  errorRate: number;
  popularityDistribution: Record<string, number>;
  categoryDistribution: Record<string, number>;
}

export class MLSearchService {
  private querySuggestionEngine: QuerySuggestionEngine;
  private personalizedRanker: PersonalizedRanker;
  private semanticSearchEnhancer: SemanticSearchEnhancer;
  private searchAnomalyDetector: SearchAnomalyDetector;
  private predictiveOptimizer: PredictiveOptimizer;
  private trainingPipeline: MLTrainingPipeline;
  private modelMonitor: MLModelMonitor;

  private isInitialized: boolean = false;
  private searchMetrics: SearchMetrics[] = [];

  constructor(private config: MLConfig) {
    this.querySuggestionEngine = new QuerySuggestionEngine(config.models.querySuggestion);
    this.personalizedRanker = new PersonalizedRanker(config.models.personalization);
    this.semanticSearchEnhancer = new SemanticSearchEnhancer(config.models.semanticSearch);
    this.searchAnomalyDetector = new SearchAnomalyDetector(config.models.anomalyDetection);
    this.predictiveOptimizer = new PredictiveOptimizer();

    const trainingConfig = {
      models: [
        'query_suggestion',
        'personalized_ranking',
        'semantic_search',
        'anomaly_detection',
        'predictive_optimization',
      ],
      dataSource: 'search_logs',
      validationSplit: config.training.validationSplit,
      crossValidationFolds: 5,
      hyperparameterTuning: true,
      earlyStoppingPatience: config.training.earlyStoppingPatience,
      maxTrainingTime: 120,
      parallelTraining: true,
    };

    this.trainingPipeline = new MLTrainingPipeline(trainingConfig);
    this.modelMonitor = new MLModelMonitor();
  }

  async initialize(trainingData: TrainingData): Promise<void> {
    console.log('Initializing ML Search Service...');

    try {
      // Train all ML models
      const pipelineMetrics = await this.trainingPipeline.runFullPipeline(trainingData);
      console.log('Training completed:', pipelineMetrics);

      // Initialize model monitoring
      const models = this.trainingPipeline.getModelServices();
      await this.modelMonitor.startMonitoring(
        'query_suggestion',
        models.querySuggestionEngine.getModelInfo()!
      );
      await this.modelMonitor.startMonitoring(
        'personalized_ranking',
        models.personalizedRanker.getModelInfo()!
      );
      await this.modelMonitor.startMonitoring(
        'semantic_search',
        models.semanticSearchEnhancer.getModelInfo()!
      );
      await this.modelMonitor.startMonitoring(
        'anomaly_detection',
        models.searchAnomalyDetector.getModelInfo()!
      );
      await this.modelMonitor.startMonitoring(
        'predictive_optimization',
        models.predictiveOptimizer.getModelInfo()!
      );

      this.isInitialized = true;
      console.log('ML Search Service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize ML Search Service:', error);
      throw error;
    }
  }

  async search(request: SearchRequest): Promise<SearchResponse> {
    if (!this.isInitialized) {
      throw new Error('ML Search Service not initialized. Call initialize() first.');
    }

    const startTime = Date.now();

    try {
      // Generate query suggestions
      const suggestions = await this.generateSuggestions(request);

      // Enhance query semantically
      const semanticAnalysis = await this.enhanceQuerySemantics(request.query);

      // Perform the actual search (mock implementation)
      const rawResults = await this.performSearch(request, semanticAnalysis);

      // Apply personalized ranking
      const rankedResults = await this.applyPersonalizedRanking(rawResults, request);

      // Detect anomalies in search patterns
      const anomalies = await this.detectSearchAnomalies(request);

      // Generate optimization insights
      const optimizationInsights = await this.generateOptimizationInsights(request);

      const processingTime = Date.now() - startTime;

      // Record metrics for monitoring
      await this.recordSearchMetrics(request, processingTime, rankedResults.length);

      // Monitor model performance
      await this.monitorModelPerformance(request, semanticAnalysis, processingTime);

      return {
        results: rankedResults,
        suggestions,
        totalCount: rankedResults.length,
        processingTime,
        semanticAnalysis: {
          intent: semanticAnalysis.intent,
          entities: semanticAnalysis.entities,
          expandedQuery: semanticAnalysis.expandedQuery,
          complexity: await this.semanticSearchEnhancer.analyzeQueryComplexity(request.query),
          sentiment: await this.semanticSearchEnhancer.analyzeSentiment(request.query),
        },
        personalizationApplied: !!request.personalization,
        anomaliesDetected: anomalies,
        optimizationInsights,
      };
    } catch (error) {
      console.error('Search failed:', error);
      throw error;
    }
  }

  private async generateSuggestions(request: SearchRequest): Promise<QuerySuggestion[]> {
    return await this.querySuggestionEngine.getSuggestions(
      request.query,
      request.userId,
      this.config.models.querySuggestion.maxSuggestions
    );
  }

  private async enhanceQuerySemantics(query: string) {
    return await this.semanticSearchEnhancer.enhanceQuery(query);
  }

  private async performSearch(request: SearchRequest, semanticAnalysis: any): Promise<any[]> {
    // Mock search implementation - in real application, this would query the actual search index
    const mockResults = [
      {
        id: '1',
        title: 'Document about ' + request.query,
        content: 'This is a document that matches your search query: ' + request.query,
        category: 'documents',
        tags: semanticAnalysis.entities.map((e: any) => e.value),
        popularity: Math.random(),
        timestamp: new Date(),
        baseRelevanceScore: Math.random() * 0.8 + 0.2,
      },
      {
        id: '2',
        title: 'Related content for ' + semanticAnalysis.expandedQuery,
        content: 'Additional content related to your search',
        category: 'articles',
        tags: ['search', 'content'],
        popularity: Math.random(),
        timestamp: new Date(),
        baseRelevanceScore: Math.random() * 0.8 + 0.2,
      },
    ];

    return mockResults;
  }

  private async applyPersonalizedRanking(results: any[], request: SearchRequest): Promise<any[]> {
    if (!request.personalization) {
      return results;
    }

    return await this.personalizedRanker.rankResults(
      results,
      request.query,
      request.personalization
    );
  }

  private async detectSearchAnomalies(request: SearchRequest): Promise<SearchAnomaly[]> {
    const currentMetrics: SearchMetrics = {
      timestamp: new Date(),
      queryCount: this.searchMetrics.length + 1,
      uniqueQueries: new Set(this.searchMetrics.map(m => m.queryCount)).size + 1,
      averageResponseTime: 150,
      clickThroughRate: 0.75,
      bounceRate: 0.25,
      errorRate: 0.01,
      popularityDistribution: { high: 0.2, medium: 0.5, low: 0.3 },
      categoryDistribution: { docs: 0.4, articles: 0.3, files: 0.3 },
    };

    return await this.searchAnomalyDetector.detectAnomalies(currentMetrics);
  }

  private async generateOptimizationInsights(request: SearchRequest): Promise<PredictiveInsight[]> {
    const features = {
      temporalFeatures: {
        hour: new Date().getHours(),
        dayOfWeek: new Date().getDay(),
        dayOfMonth: new Date().getDate(),
        month: new Date().getMonth(),
        isWeekend: [0, 6].includes(new Date().getDay()),
        isHoliday: false,
      },
      searchFeatures: {
        queryVolume: this.searchMetrics.length,
        averageQueryLength: request.query.length,
        uniqueQueriesRatio: 0.8,
        topCategoriesDistribution: { docs: 0.4, articles: 0.6 },
      },
      userFeatures: {
        activeUsers: 100,
        newUsers: 20,
        returningUsers: 80,
        averageSessionDuration: 300,
      },
      systemFeatures: {
        serverLoad: 0.6,
        responseTime: 150,
        errorRate: 0.01,
        cacheHitRate: 0.85,
      },
      externalFeatures: {
        seasonalTrend: 1.0,
        competitorActivity: 0.5,
        marketEvents: [],
      },
    };

    return await this.predictiveOptimizer.generatePredictions(features, 24);
  }

  private async recordSearchMetrics(
    request: SearchRequest,
    processingTime: number,
    resultCount: number
  ): Promise<void> {
    const metrics: SearchMetrics = {
      timestamp: new Date(),
      queryCount: this.searchMetrics.length + 1,
      uniqueQueries: new Set([...this.searchMetrics.map(m => m.queryCount), request.query]).size,
      averageResponseTime: processingTime,
      clickThroughRate: 0.75, // Mock CTR
      bounceRate: 0.25, // Mock bounce rate
      errorRate: 0.01, // Mock error rate
      popularityDistribution: { high: 0.2, medium: 0.5, low: 0.3 },
      categoryDistribution: { docs: 0.4, articles: 0.3, files: 0.3 },
    };

    this.searchMetrics.push(metrics);

    // Keep only recent metrics
    if (this.searchMetrics.length > 1000) {
      this.searchMetrics.shift();
    }
  }

  private async monitorModelPerformance(
    request: SearchRequest,
    semanticAnalysis: any,
    latency: number
  ): Promise<void> {
    // Record performance for each model
    await this.modelMonitor.recordPrediction(
      'query_suggestion',
      request.query,
      [],
      undefined,
      latency
    );
    await this.modelMonitor.recordPrediction(
      'semantic_search',
      request.query,
      semanticAnalysis,
      undefined,
      latency
    );

    if (request.personalization) {
      await this.modelMonitor.recordPrediction(
        'personalized_ranking',
        request,
        [],
        undefined,
        latency
      );
    }
  }

  async updateUserInteraction(
    userId: string,
    resultId: string,
    query: string,
    action: 'click' | 'view' | 'skip',
    metadata?: Record<string, any>
  ): Promise<void> {
    // Update personalized ranker
    await this.personalizedRanker.updateUserInteraction(userId, resultId, query, action, metadata);

    // Update query suggestion engine
    await this.querySuggestionEngine.updateUserContext(userId, query, action === 'click');

    // Record for model monitoring
    await this.modelMonitor.recordPrediction(
      'personalized_ranking',
      { userId, query, action },
      resultId,
      action === 'click' ? 1 : 0
    );
  }

  async retrainModels(newTrainingData: TrainingData): Promise<void> {
    console.log('Retraining ML models with new data...');

    try {
      const pipelineMetrics = await this.trainingPipeline.runFullPipeline(newTrainingData);
      console.log('Retraining completed:', pipelineMetrics);

      // Update model monitoring baselines
      const models = this.trainingPipeline.getModelServices();
      await this.modelMonitor.startMonitoring(
        'query_suggestion',
        models.querySuggestionEngine.getModelInfo()!
      );
      await this.modelMonitor.startMonitoring(
        'personalized_ranking',
        models.personalizedRanker.getModelInfo()!
      );
      await this.modelMonitor.startMonitoring(
        'semantic_search',
        models.semanticSearchEnhancer.getModelInfo()!
      );
      await this.modelMonitor.startMonitoring(
        'anomaly_detection',
        models.searchAnomalyDetector.getModelInfo()!
      );
      await this.modelMonitor.startMonitoring(
        'predictive_optimization',
        models.predictiveOptimizer.getModelInfo()!
      );

      console.log('Models retrained and monitoring updated');
    } catch (error) {
      console.error('Model retraining failed:', error);
      throw error;
    }
  }

  async getModelHealth(): Promise<Record<string, any>> {
    const modelIds = [
      'query_suggestion',
      'personalized_ranking',
      'semantic_search',
      'anomaly_detection',
      'predictive_optimization',
    ];
    const healthStatus: Record<string, any> = {};

    for (const modelId of modelIds) {
      healthStatus[modelId] = await this.modelMonitor.getModelHealth(modelId);
    }

    return healthStatus;
  }

  async getSystemInsights(): Promise<{
    trends: any[];
    anomalies: SearchAnomaly[];
    optimizationOpportunities: PredictiveInsight[];
    modelAlerts: any[];
  }> {
    // Get optimization trends
    const trends = await this.predictiveOptimizer.analyzeOptimizationHistory();

    // Get recent anomalies
    const recentMetrics = this.searchMetrics.slice(-1)[0];
    const anomalies = recentMetrics
      ? await this.searchAnomalyDetector.detectAnomalies(recentMetrics)
      : [];

    // Get optimization opportunities
    const features = {
      temporalFeatures: {
        hour: new Date().getHours(),
        dayOfWeek: new Date().getDay(),
        dayOfMonth: new Date().getDate(),
        month: new Date().getMonth(),
        isWeekend: [0, 6].includes(new Date().getDay()),
        isHoliday: false,
      },
      searchFeatures: {
        queryVolume: this.searchMetrics.length,
        averageQueryLength: 12,
        uniqueQueriesRatio: 0.8,
        topCategoriesDistribution: { docs: 0.4, articles: 0.6 },
      },
      userFeatures: {
        activeUsers: 100,
        newUsers: 20,
        returningUsers: 80,
        averageSessionDuration: 300,
      },
      systemFeatures: {
        serverLoad: 0.6,
        responseTime: 150,
        errorRate: 0.01,
        cacheHitRate: 0.85,
      },
      externalFeatures: {
        seasonalTrend: 1.0,
        competitorActivity: 0.5,
        marketEvents: [],
      },
    };

    const optimizationOpportunities = await this.predictiveOptimizer.generatePredictions(
      features,
      24
    );

    // Get model alerts
    const modelAlerts = this.modelMonitor.getAlerts();

    return {
      trends,
      anomalies,
      optimizationOpportunities,
      modelAlerts,
    };
  }

  async exportModels(basePath: string): Promise<void> {
    await this.trainingPipeline.saveAllModels(basePath);
    console.log(`All models exported to ${basePath}`);
  }

  async importModels(basePath: string): Promise<void> {
    await this.trainingPipeline.loadAllModels(basePath);
    console.log(`All models imported from ${basePath}`);
  }

  getSearchMetrics(): SearchMetrics[] {
    return [...this.searchMetrics];
  }

  getTrainingPipelineMetrics(): PipelineMetrics | null {
    return this.trainingPipeline.getPipelineMetrics();
  }

  isServiceInitialized(): boolean {
    return this.isInitialized;
  }
}
