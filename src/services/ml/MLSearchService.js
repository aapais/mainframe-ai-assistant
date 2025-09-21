"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MLSearchService = void 0;
const QuerySuggestionEngine_1 = require("./QuerySuggestionEngine");
const PersonalizedRanker_1 = require("./PersonalizedRanker");
const SemanticSearchEnhancer_1 = require("./SemanticSearchEnhancer");
const SearchAnomalyDetector_1 = require("./SearchAnomalyDetector");
const PredictiveOptimizer_1 = require("./PredictiveOptimizer");
const MLTrainingPipeline_1 = require("./MLTrainingPipeline");
const MLModelMonitor_1 = require("./MLModelMonitor");
class MLSearchService {
    config;
    querySuggestionEngine;
    personalizedRanker;
    semanticSearchEnhancer;
    searchAnomalyDetector;
    predictiveOptimizer;
    trainingPipeline;
    modelMonitor;
    isInitialized = false;
    searchMetrics = [];
    constructor(config) {
        this.config = config;
        this.querySuggestionEngine = new QuerySuggestionEngine_1.QuerySuggestionEngine(config.models.querySuggestion);
        this.personalizedRanker = new PersonalizedRanker_1.PersonalizedRanker(config.models.personalization);
        this.semanticSearchEnhancer = new SemanticSearchEnhancer_1.SemanticSearchEnhancer(config.models.semanticSearch);
        this.searchAnomalyDetector = new SearchAnomalyDetector_1.SearchAnomalyDetector(config.models.anomalyDetection);
        this.predictiveOptimizer = new PredictiveOptimizer_1.PredictiveOptimizer();
        const trainingConfig = {
            models: ['query_suggestion', 'personalized_ranking', 'semantic_search', 'anomaly_detection', 'predictive_optimization'],
            dataSource: 'search_logs',
            validationSplit: config.training.validationSplit,
            crossValidationFolds: 5,
            hyperparameterTuning: true,
            earlyStoppingPatience: config.training.earlyStoppingPatience,
            maxTrainingTime: 120,
            parallelTraining: true
        };
        this.trainingPipeline = new MLTrainingPipeline_1.MLTrainingPipeline(trainingConfig);
        this.modelMonitor = new MLModelMonitor_1.MLModelMonitor();
    }
    async initialize(trainingData) {
        console.log('Initializing ML Search Service...');
        try {
            const pipelineMetrics = await this.trainingPipeline.runFullPipeline(trainingData);
            console.log('Training completed:', pipelineMetrics);
            const models = this.trainingPipeline.getModelServices();
            await this.modelMonitor.startMonitoring('query_suggestion', models.querySuggestionEngine.getModelInfo());
            await this.modelMonitor.startMonitoring('personalized_ranking', models.personalizedRanker.getModelInfo());
            await this.modelMonitor.startMonitoring('semantic_search', models.semanticSearchEnhancer.getModelInfo());
            await this.modelMonitor.startMonitoring('anomaly_detection', models.searchAnomalyDetector.getModelInfo());
            await this.modelMonitor.startMonitoring('predictive_optimization', models.predictiveOptimizer.getModelInfo());
            this.isInitialized = true;
            console.log('ML Search Service initialized successfully');
        }
        catch (error) {
            console.error('Failed to initialize ML Search Service:', error);
            throw error;
        }
    }
    async search(request) {
        if (!this.isInitialized) {
            throw new Error('ML Search Service not initialized. Call initialize() first.');
        }
        const startTime = Date.now();
        try {
            const suggestions = await this.generateSuggestions(request);
            const semanticAnalysis = await this.enhanceQuerySemantics(request.query);
            const rawResults = await this.performSearch(request, semanticAnalysis);
            const rankedResults = await this.applyPersonalizedRanking(rawResults, request);
            const anomalies = await this.detectSearchAnomalies(request);
            const optimizationInsights = await this.generateOptimizationInsights(request);
            const processingTime = Date.now() - startTime;
            await this.recordSearchMetrics(request, processingTime, rankedResults.length);
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
                    sentiment: await this.semanticSearchEnhancer.analyzeSentiment(request.query)
                },
                personalizationApplied: !!request.personalization,
                anomaliesDetected: anomalies,
                optimizationInsights
            };
        }
        catch (error) {
            console.error('Search failed:', error);
            throw error;
        }
    }
    async generateSuggestions(request) {
        return await this.querySuggestionEngine.getSuggestions(request.query, request.userId, this.config.models.querySuggestion.maxSuggestions);
    }
    async enhanceQuerySemantics(query) {
        return await this.semanticSearchEnhancer.enhanceQuery(query);
    }
    async performSearch(request, semanticAnalysis) {
        const mockResults = [
            {
                id: '1',
                title: `Document about ${  request.query}`,
                content: `This is a document that matches your search query: ${  request.query}`,
                category: 'documents',
                tags: semanticAnalysis.entities.map((e) => e.value),
                popularity: Math.random(),
                timestamp: new Date(),
                baseRelevanceScore: Math.random() * 0.8 + 0.2
            },
            {
                id: '2',
                title: `Related content for ${  semanticAnalysis.expandedQuery}`,
                content: 'Additional content related to your search',
                category: 'articles',
                tags: ['search', 'content'],
                popularity: Math.random(),
                timestamp: new Date(),
                baseRelevanceScore: Math.random() * 0.8 + 0.2
            }
        ];
        return mockResults;
    }
    async applyPersonalizedRanking(results, request) {
        if (!request.personalization) {
            return results;
        }
        return await this.personalizedRanker.rankResults(results, request.query, request.personalization);
    }
    async detectSearchAnomalies(request) {
        const currentMetrics = {
            timestamp: new Date(),
            queryCount: this.searchMetrics.length + 1,
            uniqueQueries: new Set(this.searchMetrics.map(m => m.queryCount)).size + 1,
            averageResponseTime: 150,
            clickThroughRate: 0.75,
            bounceRate: 0.25,
            errorRate: 0.01,
            popularityDistribution: { 'high': 0.2, 'medium': 0.5, 'low': 0.3 },
            categoryDistribution: { 'docs': 0.4, 'articles': 0.3, 'files': 0.3 }
        };
        return await this.searchAnomalyDetector.detectAnomalies(currentMetrics);
    }
    async generateOptimizationInsights(request) {
        const features = {
            temporalFeatures: {
                hour: new Date().getHours(),
                dayOfWeek: new Date().getDay(),
                dayOfMonth: new Date().getDate(),
                month: new Date().getMonth(),
                isWeekend: [0, 6].includes(new Date().getDay()),
                isHoliday: false
            },
            searchFeatures: {
                queryVolume: this.searchMetrics.length,
                averageQueryLength: request.query.length,
                uniqueQueriesRatio: 0.8,
                topCategoriesDistribution: { 'docs': 0.4, 'articles': 0.6 }
            },
            userFeatures: {
                activeUsers: 100,
                newUsers: 20,
                returningUsers: 80,
                averageSessionDuration: 300
            },
            systemFeatures: {
                serverLoad: 0.6,
                responseTime: 150,
                errorRate: 0.01,
                cacheHitRate: 0.85
            },
            externalFeatures: {
                seasonalTrend: 1.0,
                competitorActivity: 0.5,
                marketEvents: []
            }
        };
        return await this.predictiveOptimizer.generatePredictions(features, 24);
    }
    async recordSearchMetrics(request, processingTime, resultCount) {
        const metrics = {
            timestamp: new Date(),
            queryCount: this.searchMetrics.length + 1,
            uniqueQueries: new Set([...this.searchMetrics.map(m => m.queryCount), request.query]).size,
            averageResponseTime: processingTime,
            clickThroughRate: 0.75,
            bounceRate: 0.25,
            errorRate: 0.01,
            popularityDistribution: { 'high': 0.2, 'medium': 0.5, 'low': 0.3 },
            categoryDistribution: { 'docs': 0.4, 'articles': 0.3, 'files': 0.3 }
        };
        this.searchMetrics.push(metrics);
        if (this.searchMetrics.length > 1000) {
            this.searchMetrics.shift();
        }
    }
    async monitorModelPerformance(request, semanticAnalysis, latency) {
        await this.modelMonitor.recordPrediction('query_suggestion', request.query, [], undefined, latency);
        await this.modelMonitor.recordPrediction('semantic_search', request.query, semanticAnalysis, undefined, latency);
        if (request.personalization) {
            await this.modelMonitor.recordPrediction('personalized_ranking', request, [], undefined, latency);
        }
    }
    async updateUserInteraction(userId, resultId, query, action, metadata) {
        await this.personalizedRanker.updateUserInteraction(userId, resultId, query, action, metadata);
        await this.querySuggestionEngine.updateUserContext(userId, query, action === 'click');
        await this.modelMonitor.recordPrediction('personalized_ranking', { userId, query, action }, resultId, action === 'click' ? 1 : 0);
    }
    async retrainModels(newTrainingData) {
        console.log('Retraining ML models with new data...');
        try {
            const pipelineMetrics = await this.trainingPipeline.runFullPipeline(newTrainingData);
            console.log('Retraining completed:', pipelineMetrics);
            const models = this.trainingPipeline.getModelServices();
            await this.modelMonitor.startMonitoring('query_suggestion', models.querySuggestionEngine.getModelInfo());
            await this.modelMonitor.startMonitoring('personalized_ranking', models.personalizedRanker.getModelInfo());
            await this.modelMonitor.startMonitoring('semantic_search', models.semanticSearchEnhancer.getModelInfo());
            await this.modelMonitor.startMonitoring('anomaly_detection', models.searchAnomalyDetector.getModelInfo());
            await this.modelMonitor.startMonitoring('predictive_optimization', models.predictiveOptimizer.getModelInfo());
            console.log('Models retrained and monitoring updated');
        }
        catch (error) {
            console.error('Model retraining failed:', error);
            throw error;
        }
    }
    async getModelHealth() {
        const modelIds = ['query_suggestion', 'personalized_ranking', 'semantic_search', 'anomaly_detection', 'predictive_optimization'];
        const healthStatus = {};
        for (const modelId of modelIds) {
            healthStatus[modelId] = await this.modelMonitor.getModelHealth(modelId);
        }
        return healthStatus;
    }
    async getSystemInsights() {
        const trends = await this.predictiveOptimizer.analyzeOptimizationHistory();
        const recentMetrics = this.searchMetrics.slice(-1)[0];
        const anomalies = recentMetrics ? await this.searchAnomalyDetector.detectAnomalies(recentMetrics) : [];
        const features = {
            temporalFeatures: {
                hour: new Date().getHours(),
                dayOfWeek: new Date().getDay(),
                dayOfMonth: new Date().getDate(),
                month: new Date().getMonth(),
                isWeekend: [0, 6].includes(new Date().getDay()),
                isHoliday: false
            },
            searchFeatures: {
                queryVolume: this.searchMetrics.length,
                averageQueryLength: 12,
                uniqueQueriesRatio: 0.8,
                topCategoriesDistribution: { 'docs': 0.4, 'articles': 0.6 }
            },
            userFeatures: {
                activeUsers: 100,
                newUsers: 20,
                returningUsers: 80,
                averageSessionDuration: 300
            },
            systemFeatures: {
                serverLoad: 0.6,
                responseTime: 150,
                errorRate: 0.01,
                cacheHitRate: 0.85
            },
            externalFeatures: {
                seasonalTrend: 1.0,
                competitorActivity: 0.5,
                marketEvents: []
            }
        };
        const optimizationOpportunities = await this.predictiveOptimizer.generatePredictions(features, 24);
        const modelAlerts = this.modelMonitor.getAlerts();
        return {
            trends,
            anomalies,
            optimizationOpportunities,
            modelAlerts
        };
    }
    async exportModels(basePath) {
        await this.trainingPipeline.saveAllModels(basePath);
        console.log(`All models exported to ${basePath}`);
    }
    async importModels(basePath) {
        await this.trainingPipeline.loadAllModels(basePath);
        console.log(`All models imported from ${basePath}`);
    }
    getSearchMetrics() {
        return [...this.searchMetrics];
    }
    getTrainingPipelineMetrics() {
        return this.trainingPipeline.getPipelineMetrics();
    }
    isServiceInitialized() {
        return this.isInitialized;
    }
}
exports.MLSearchService = MLSearchService;
//# sourceMappingURL=MLSearchService.js.map