"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LearningPipeline = void 0;

const events_1 = require("events");
const ABTestingManager_1 = require("./ABTestingManager");
const ModelRetrainer_1 = require("./ModelRetrainer");
const PatternAnalyzer_1 = require("./PatternAnalyzer");
const MetricsCollector_1 = require("./MetricsCollector");
const DriftDetector_1 = require("./DriftDetector");
const logger = require('../../utils/logger');

class LearningPipeline extends events_1.EventEmitter {
    constructor(config = {}) {
        super();

        this.config = {
            // Configurações do pipeline
            learningCycle: config.learningCycle || 24 * 60 * 60 * 1000, // 24 horas
            feedbackWindow: config.feedbackWindow || 7 * 24 * 60 * 60 * 1000, // 7 dias
            minSamplesForRetraining: config.minSamplesForRetraining || 100,
            confidenceThreshold: config.confidenceThreshold || 0.85,

            // Configurações de validação
            validationSplit: config.validationSplit || 0.2,
            crossValidationFolds: config.crossValidationFolds || 5,

            // Configurações de A/B testing
            abTestDuration: config.abTestDuration || 7 * 24 * 60 * 60 * 1000, // 7 dias
            abTestTrafficSplit: config.abTestTrafficSplit || 0.1, // 10% para teste

            ...config
        };

        // Inicializar componentes integrados
        this.abTestingManager = new ABTestingManager_1.ABTestingManager({
            minSampleSize: 1000,
            significanceLevel: 0.05,
            maxConcurrentTests: 5
        });

        this.modelRetrainer = new ModelRetrainer_1.ModelRetrainer({
            retrainingThreshold: this.config.confidenceThreshold || 0.85,
            validationSplit: 0.2,
            maxTrainingTime: 30 * 60 * 1000,
            autoBackup: true
        });

        this.patternAnalyzer = new PatternAnalyzer_1.PatternAnalyzer({
            minPatternConfidence: 0.7,
            analysisWindow: 24 * 60 * 60 * 1000,
            trendDetectionSensitivity: 0.1
        });

        this.metricsCollector = new MetricsCollector_1.MetricsCollector({
            metricsRetention: 30 * 24 * 60 * 60 * 1000,
            aggregationInterval: 5 * 60 * 1000,
            enableRealTimeTracking: true
        });

        this.driftDetector = new DriftDetector_1.DriftDetector({
            driftThreshold: 0.1,
            windowSize: 1000,
            statisticalTests: ['ks_test', 'chi_square', 'psi']
        });

        // Estado do pipeline
        this.state = {
            isRunning: false,
            lastLearningCycle: null,
            currentABTests: new Map(),
            metrics: {
                cyclesCompleted: 0,
                modelsRetrained: 0,
                patternsDiscovered: 0,
                improvementRate: 0
            }
        };

        this.setupEventHandlers();
    }

    /**
     * Inicializa o pipeline de aprendizado contínuo
     */
    async start() {
        try {
            logger.info('Iniciando pipeline de aprendizado contínuo');

            if (this.state.isRunning) {
                throw new Error('Pipeline já está em execução');
            }

            this.state.isRunning = true;

            // Inicializar componentes integrados
            await this.abTestingManager.initialize();
            await this.modelRetrainer.initialize();
            await this.patternAnalyzer.initialize();
            await this.metricsCollector.initialize();
            await this.driftDetector.initialize();

            // Agendar primeira execução
            this.scheduleNextCycle();

            this.emit('started');
            logger.info('Pipeline de aprendizado contínuo iniciado com sucesso');

        } catch (error) {
            logger.error('Erro ao iniciar pipeline de aprendizado:', error);
            this.state.isRunning = false;
            throw error;
        }
    }

    /**
     * Para o pipeline de aprendizado contínuo
     */
    async stop() {
        try {
            logger.info('Parando pipeline de aprendizado contínuo');

            this.state.isRunning = false;

            // Cancelar timers
            if (this.learningTimer) {
                clearTimeout(this.learningTimer);
                this.learningTimer = null;
            }

            // Finalizar componentes integrados
            await this.abTestingManager.shutdown();
            await this.modelRetrainer.shutdown();
            await this.patternAnalyzer.shutdown();
            await this.metricsCollector.shutdown();
            await this.driftDetector.shutdown();

            this.emit('stopped');
            logger.info('Pipeline de aprendizado contínuo parado');

        } catch (error) {
            logger.error('Erro ao parar pipeline de aprendizado:', error);
            throw error;
        }
    }

    /**
     * Executa um ciclo completo de aprendizado
     */
    async runLearningCycle() {
        try {
            logger.info('Iniciando ciclo de aprendizado');

            const cycleStartTime = new Date();
            const results = {
                feedback: null,
                patterns: null,
                retraining: null,
                validation: null,
                deployment: null
            };

            // Fase 1: Coleta e análise de feedback
            logger.info('Coletando feedback...');
            results.feedback = await this.collectAndProcessFeedback();

            // Fase 2: Análise de padrões
            logger.info('Analisando padrões...');
            results.patterns = await this.analyzePatterns();

            // Fase 3: Retreino de modelos (se necessário)
            if (this.shouldRetrain(results.feedback, results.patterns)) {
                logger.info('Iniciando retreino de modelos...');
                results.retraining = await this.retrainModels(results.feedback, results.patterns);

                // Fase 4: Validação
                logger.info('Validando modelos retreinados...');
                results.validation = await this.validateModels(results.retraining);

                // Fase 5: Deployment condicional (A/B testing)
                if (results.validation.isValid) {
                    logger.info('Iniciando A/B testing...');
                    results.deployment = await this.deployWithABTesting(results.retraining);
                }
            }

            // Atualizar métricas
            this.updateMetrics(results);

            const cycleEndTime = new Date();
            const cycleDuration = cycleEndTime - cycleStartTime;

            logger.info(`Ciclo de aprendizado concluído em ${cycleDuration}ms`);

            this.state.lastLearningCycle = cycleEndTime;
            this.state.metrics.cyclesCompleted++;

            this.emit('cycleCompleted', {
                timestamp: cycleEndTime,
                duration: cycleDuration,
                results
            });

            // Agendar próximo ciclo
            if (this.state.isRunning) {
                this.scheduleNextCycle();
            }

            return results;

        } catch (error) {
            logger.error('Erro durante ciclo de aprendizado:', error);
            this.emit('cycleError', error);

            // Reagendar próximo ciclo mesmo com erro
            if (this.state.isRunning) {
                this.scheduleNextCycle();
            }

            throw error;
        }
    }

    /**
     * Coleta e processa feedback usando o sistema integrado
     */
    async collectAndProcessFeedback() {
        const endTime = new Date();
        const startTime = new Date(endTime.getTime() - this.config.feedbackWindow);

        // Simular coleta de feedback (em produção, viria de fonte de dados real)
        const feedback = await this.simulateFeedbackCollection(startTime, endTime);

        // Processar através do pipeline integrado
        for (const feedbackItem of feedback.items) {
            await this.metricsCollector.recordFeedback(feedbackItem);
            await this.driftDetector.checkForDrift(feedbackItem);
        }

        return {
            operatorFeedback: feedback.operators || [],
            userSatisfaction: feedback.users || [],
            resolutionMetrics: feedback.resolutions || [],
            systemMetrics: feedback.system || {},
            totalSamples: feedback.total || 0,
            timeRange: { startTime, endTime }
        };
    }

    /**
     * Simula coleta de feedback (substituir por integração real)
     */
    async simulateFeedbackCollection(startTime, endTime) {
        // Esta função seria substituída por integração real com banco de dados
        return {
            items: [], // Array de feedback items
            operators: [],
            users: [],
            resolutions: [],
            system: {},
            total: 0
        };
    }

    /**
     * Analisa padrões nos dados
     */
    async analyzePatterns() {
        const analysis = await this.patternAnalyzer.analyzeRecentPatterns();

        return {
            newIncidentTypes: analysis.newTypes,
            behaviorChanges: analysis.behaviorChanges,
            trends: analysis.trends,
            correlations: analysis.correlations,
            seasonality: analysis.seasonality,
            recommendations: analysis.recommendations
        };
    }

    /**
     * Determina se deve retreinar modelos
     */
    shouldRetrain(feedbackResults, patternResults) {
        // Critérios para retreino
        const hasEnoughSamples = feedbackResults.totalSamples >= this.config.minSamplesForRetraining;
        const hasNewPatterns = patternResults.newIncidentTypes.length > 0 ||
                              patternResults.behaviorChanges.length > 0;
        const hasLowConfidence = feedbackResults.resolutionMetrics.averageConfidence < this.config.confidenceThreshold;
        const hasLowSatisfaction = feedbackResults.userSatisfaction.averageRating < 3.5;

        return hasEnoughSamples && (hasNewPatterns || hasLowConfidence || hasLowSatisfaction);
    }

    /**
     * Executa retreino dos modelos
     */
    async retrainModels(feedbackResults, patternResults) {
        const retrainingData = this.prepareTrainingData(feedbackResults, patternResults);

        const results = await this.modelRetrainer.retrain({
            trainingData: retrainingData,
            validationSplit: this.config.validationSplit,
            crossValidationFolds: this.config.crossValidationFolds
        });

        this.state.metrics.modelsRetrained++;

        return results;
    }

    /**
     * Prepara dados para retreino
     */
    prepareTrainingData(feedbackResults, patternResults) {
        // Combinar feedback com padrões descobertos
        const trainingData = {
            incidents: [],
            resolutions: [],
            outcomes: [],
            patterns: patternResults.newIncidentTypes
        };

        // Processar feedback de operadores
        feedbackResults.operatorFeedback.forEach(feedback => {
            trainingData.incidents.push({
                id: feedback.incidentId,
                description: feedback.incidentDescription,
                category: feedback.category,
                severity: feedback.severity,
                context: feedback.context
            });

            trainingData.resolutions.push({
                incidentId: feedback.incidentId,
                suggestedSolution: feedback.suggestedSolution,
                actualSolution: feedback.actualSolution,
                effectiveness: feedback.effectiveness,
                timeToResolve: feedback.timeToResolve
            });

            trainingData.outcomes.push({
                incidentId: feedback.incidentId,
                wasSuccessful: feedback.wasSuccessful,
                userSatisfaction: feedback.userSatisfaction,
                reoccurred: feedback.reoccurred
            });
        });

        return trainingData;
    }

    /**
     * Valida modelos retreinados
     */
    async validateModels(retrainingResults) {
        const validation = await this.modelRetrainer.validateModels(retrainingResults);

        return {
            isValid: validation.accuracy > 0.85 && validation.precision > 0.80,
            metrics: validation,
            recommendation: validation.accuracy > 0.90 ? 'deploy' :
                          validation.accuracy > 0.85 ? 'ab_test' : 'reject'
        };
    }

    /**
     * Faz deploy com A/B testing
     */
    async deployWithABTesting(retrainingResults) {
        const testId = `ab_test_${Date.now()}`;

        const abTest = {
            id: testId,
            startTime: new Date(),
            endTime: new Date(Date.now() + this.config.abTestDuration),
            trafficSplit: this.config.abTestTrafficSplit,
            controlModel: 'current',
            testModel: retrainingResults.modelId,
            metrics: {
                controlGroup: { samples: 0, successRate: 0, avgSatisfaction: 0 },
                testGroup: { samples: 0, successRate: 0, avgSatisfaction: 0 }
            }
        };

        this.state.currentABTests.set(testId, abTest);

        // Configurar coleta de métricas para o teste
        await this.setupABTestMetrics(abTest);

        // Agendar finalização do teste
        setTimeout(() => {
            this.finalizeABTest(testId);
        }, this.config.abTestDuration);

        return abTest;
    }

    /**
     * Configura coleta de métricas para A/B testing
     */
    async setupABTestMetrics(abTest) {
        // Implementar tracking de métricas para grupos de controle e teste
        this.feedbackCollector.trackABTest(abTest.id, {
            trafficSplit: abTest.trafficSplit,
            metrics: ['successRate', 'satisfactionScore', 'resolutionTime']
        });
    }

    /**
     * Finaliza A/B testing e toma decisão de deployment
     */
    async finalizeABTest(testId) {
        try {
            const abTest = this.state.currentABTests.get(testId);
            if (!abTest) return;

            // Coletar métricas finais
            const finalMetrics = await this.feedbackCollector.getABTestResults(testId);
            abTest.metrics = finalMetrics;

            // Analisar resultados e tomar decisão
            const decision = this.analyzeABTestResults(finalMetrics);

            if (decision === 'deploy') {
                await this.deployNewModel(abTest.testModel);
                logger.info(`Modelo ${abTest.testModel} implantado após A/B testing bem-sucedido`);
            } else {
                logger.info(`Modelo ${abTest.testModel} rejeitado após A/B testing`);
            }

            // Remover teste da lista ativa
            this.state.currentABTests.delete(testId);

            this.emit('abTestCompleted', { testId, decision, metrics: finalMetrics });

        } catch (error) {
            logger.error(`Erro ao finalizar A/B test ${testId}:`, error);
        }
    }

    /**
     * Analisa resultados do A/B testing
     */
    analyzeABTestResults(metrics) {
        const { controlGroup, testGroup } = metrics;

        // Critérios para aprovação
        const successRateImprovement = testGroup.successRate - controlGroup.successRate;
        const satisfactionImprovement = testGroup.avgSatisfaction - controlGroup.avgSatisfaction;

        const isSignificantImprovement = successRateImprovement > 0.05 && satisfactionImprovement > 0.2;
        const hasEnoughSamples = testGroup.samples >= 50 && controlGroup.samples >= 50;

        return isSignificantImprovement && hasEnoughSamples ? 'deploy' : 'reject';
    }

    /**
     * Faz deploy do novo modelo
     */
    async deployNewModel(modelId) {
        await this.modelRetrainer.deployModel(modelId);
        this.emit('modelDeployed', { modelId, timestamp: new Date() });
    }

    /**
     * Atualiza métricas do pipeline
     */
    updateMetrics(cycleResults) {
        if (cycleResults.patterns) {
            this.state.metrics.patternsDiscovered += cycleResults.patterns.newIncidentTypes.length;
        }

        if (cycleResults.deployment) {
            // Calcular taxa de melhoria baseada em A/B tests
            // Será atualizada quando os testes terminarem
        }
    }

    /**
     * Agenda próximo ciclo de aprendizado
     */
    scheduleNextCycle() {
        this.learningTimer = setTimeout(() => {
            this.runLearningCycle().catch(error => {
                logger.error('Erro em ciclo agendado:', error);
            });
        }, this.config.learningCycle);
    }

    /**
     * Configura handlers de eventos integrados
     */
    setupEventHandlers() {
        // Drift detection
        this.driftDetector.on('driftDetected', async (driftEvent) => {
            await this.handleDriftDetection(driftEvent);
        });

        // Pattern insights
        this.patternAnalyzer.on('patternDetected', async (pattern) => {
            await this.handlePatternDetection(pattern);
        });

        // A/B test results
        this.abTestingManager.on('experimentCompleted', async (result) => {
            await this.handleExperimentCompletion(result);
        });

        // Model retraining completion
        this.modelRetrainer.on('retrainingCompleted', async (result) => {
            await this.handleRetrainingCompletion(result);
        });

        // Metrics alerts
        this.metricsCollector.on('alertGenerated', async (alert) => {
            await this.handleMetricsAlert(alert);
        });

        // Legacy handlers
        this.patternAnalyzer.on('newPattern', (pattern) => {
            this.emit('patternDiscovered', pattern);
        });

        this.modelRetrainer.on('retrainingComplete', (result) => {
            this.emit('modelRetrained', result);
        });
    }

    async handleDriftDetection(driftEvent) {
        logger.warn(`Drift detectado: ${driftEvent.type} - Score: ${driftEvent.driftScore}`);

        if (driftEvent.severity === 'high') {
            // Trigger immediate retraining for high severity drift
            const emergencyRetraining = true;
            this.scheduleEmergencyRetraining(driftEvent);
        }

        this.emit('driftDetected', driftEvent);
    }

    async handlePatternDetection(pattern) {
        logger.info(`Novo padrão detectado: ${pattern.type} - Confiança: ${pattern.confidence}`);

        // Create A/B experiment if pattern confidence is high
        if (pattern.confidence > 0.8) {
            await this.createPatternBasedExperiment(pattern);
        }

        this.emit('patternDiscovered', pattern);
    }

    async handleExperimentCompletion(result) {
        logger.info(`Experimento completado: ${result.experimentId} - Resultado: ${result.winner || 'inconclusivo'}`);

        if (result.winner && result.confidence > 0.95) {
            // Deploy winning variant
            await this.deployWinningVariant(result);
        }

        this.emit('experimentCompleted', result);
    }

    async handleRetrainingCompletion(result) {
        logger.info(`Retreino completado - Modelo: ${result.modelId} - Performance: ${result.accuracy}`);

        // Create A/B test for new model
        await this.createModelValidationExperiment(result);

        this.emit('modelRetrained', result);
    }

    async handleMetricsAlert(alert) {
        logger.warn(`Alerta de métricas: ${alert.type} - ${alert.message}`);

        // Take action based on alert severity
        if (alert.severity === 'critical') {
            await this.handleCriticalAlert(alert);
        }

        this.emit('metricsAlert', alert);
    }

    async scheduleEmergencyRetraining(driftEvent) {
        logger.info('Agendando retreino de emergência devido a drift alto');
        // Implementation for emergency retraining
    }

    async createPatternBasedExperiment(pattern) {
        logger.info(`Criando experimento baseado em padrão: ${pattern.type}`);
        // Implementation for pattern-based A/B test
    }

    async deployWinningVariant(result) {
        logger.info(`Implantando variante vencedora: ${result.winner}`);
        // Implementation for deployment
    }

    async createModelValidationExperiment(result) {
        logger.info(`Criando experimento de validação para modelo: ${result.modelId}`);
        // Implementation for model validation A/B test
    }

    async handleCriticalAlert(alert) {
        logger.error(`Manipulando alerta crítico: ${alert.type}`);
        // Implementation for critical alert handling
    }

    /**
     * Retorna status atual do pipeline
     */
    getStatus() {
        return {
            isRunning: this.state.isRunning,
            lastLearningCycle: this.state.lastLearningCycle,
            metrics: { ...this.state.metrics },
            activeABTests: Array.from(this.state.currentABTests.values()),
            nextCycleIn: this.learningTimer ?
                new Date(Date.now() + this.config.learningCycle) : null
        };
    }

    /**
     * Força execução de um ciclo de aprendizado
     */
    async forceLearningCycle() {
        if (!this.state.isRunning) {
            throw new Error('Pipeline não está em execução');
        }

        // Cancelar ciclo agendado
        if (this.learningTimer) {
            clearTimeout(this.learningTimer);
            this.learningTimer = null;
        }

        // Executar ciclo imediatamente
        const result = await this.runLearningCycle();

        return result;
    }
}

exports.LearningPipeline = LearningPipeline;