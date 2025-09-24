/**
 * Coletor de Feedback
 *
 * Responsável por coletar e processar feedback de operadores,
 * métricas de sucesso/falha e satisfação do usuário final.
 */

const EventEmitter = require('events');
const logger = require('../../utils/logger');

class FeedbackCollector extends EventEmitter {
    constructor(config = {}) {
        super();

        this.config = {
            // Configurações de coleta
            batchSize: config.batchSize || 100,
            retentionPeriod: config.retentionPeriod || 90 * 24 * 60 * 60 * 1000, // 90 dias

            // Configurações de métricas
            satisfactionScale: config.satisfactionScale || { min: 1, max: 5 },
            confidenceThreshold: config.confidenceThreshold || 0.7,

            // Configurações de armazenamento
            storageProvider: config.storageProvider || 'database',

            ...config
        };

        // Buffers para feedback
        this.feedbackBuffer = {
            operators: [],
            users: [],
            system: []
        };

        // Rastreamento de A/B tests
        this.abTests = new Map();

        // Métricas em tempo real
        this.realtimeMetrics = {
            totalFeedbacks: 0,
            averageSatisfaction: 0,
            successRate: 0,
            avgResolutionTime: 0
        };
    }

    /**
     * Inicializa o coletor de feedback
     */
    async initialize() {
        try {
            logger.info('Inicializando coletor de feedback');

            // Configurar conexões de dados
            await this.setupDataConnections();

            // Inicializar buffers
            this.initializeBuffers();

            // Configurar limpeza automática
            this.setupCleanupSchedule();

            logger.info('Coletor de feedback inicializado com sucesso');

        } catch (error) {
            logger.error('Erro ao inicializar coletor de feedback:', error);
            throw error;
        }
    }

    /**
     * Coleta feedback de operadores
     */
    async collectOperatorFeedback(operatorId, incidentId, feedback) {
        try {
            const feedbackEntry = {
                id: this.generateId(),
                timestamp: new Date(),
                type: 'operator',
                operatorId,
                incidentId,

                // Dados do incidente
                incidentDescription: feedback.incidentDescription,
                category: feedback.category,
                severity: feedback.severity,
                context: feedback.context || {},

                // Solução sugerida vs real
                suggestedSolution: feedback.suggestedSolution,
                actualSolution: feedback.actualSolution,
                solutionSource: feedback.solutionSource, // 'ai_suggestion', 'manual', 'hybrid'

                // Avaliação da sugestão
                suggestionAccuracy: feedback.suggestionAccuracy, // 1-5
                suggestionRelevance: feedback.suggestionRelevance, // 1-5
                suggestionCompleteness: feedback.suggestionCompleteness, // 1-5

                // Métricas de resolução
                timeToResolve: feedback.timeToResolve, // em minutos
                wasSuccessful: feedback.wasSuccessful,
                confidenceLevel: feedback.confidenceLevel || 0,

                // Feedback qualitativo
                comments: feedback.comments || '',
                improvementSuggestions: feedback.improvementSuggestions || [],

                // Contexto adicional
                systemState: feedback.systemState || {},
                environmentInfo: feedback.environmentInfo || {}
            };

            // Adicionar ao buffer
            this.feedbackBuffer.operators.push(feedbackEntry);

            // Processar se buffer está cheio
            if (this.feedbackBuffer.operators.length >= this.config.batchSize) {
                await this.flushOperatorBuffer();
            }

            // Atualizar métricas em tempo real
            this.updateRealtimeMetrics(feedbackEntry);

            // Emitir evento
            this.emit('operatorFeedback', feedbackEntry);

            return feedbackEntry.id;

        } catch (error) {
            logger.error('Erro ao coletar feedback de operador:', error);
            throw error;
        }
    }

    /**
     * Coleta feedback de satisfação do usuário
     */
    async collectUserSatisfaction(userId, incidentId, satisfaction) {
        try {
            const satisfactionEntry = {
                id: this.generateId(),
                timestamp: new Date(),
                type: 'user_satisfaction',
                userId,
                incidentId,

                // Avaliação principal
                overallRating: satisfaction.overallRating, // 1-5

                // Dimensões específicas
                resolutionSpeed: satisfaction.resolutionSpeed || null, // 1-5
                resolutionQuality: satisfaction.resolutionQuality || null, // 1-5
                communicationQuality: satisfaction.communicationQuality || null, // 1-5
                supportExperience: satisfaction.supportExperience || null, // 1-5

                // Feedback textual
                positiveAspects: satisfaction.positiveAspects || [],
                negativeAspects: satisfaction.negativeAspects || [],
                suggestions: satisfaction.suggestions || '',

                // Contexto
                incidentCategory: satisfaction.incidentCategory,
                resolutionTime: satisfaction.resolutionTime,
                channelUsed: satisfaction.channelUsed, // 'web', 'mobile', 'phone', 'email'

                // Follow-up
                wouldRecommend: satisfaction.wouldRecommend || null, // boolean
                likelyToUseAgain: satisfaction.likelyToUseAgain || null // 1-5
            };

            // Adicionar ao buffer
            this.feedbackBuffer.users.push(satisfactionEntry);

            // Processar se buffer está cheio
            if (this.feedbackBuffer.users.length >= this.config.batchSize) {
                await this.flushUserBuffer();
            }

            // Atualizar métricas
            this.updateRealtimeMetrics(satisfactionEntry);

            // Emitir evento
            this.emit('userSatisfaction', satisfactionEntry);

            return satisfactionEntry.id;

        } catch (error) {
            logger.error('Erro ao coletar satisfação do usuário:', error);
            throw error;
        }
    }

    /**
     * Coleta métricas do sistema
     */
    async collectSystemMetrics(incidentId, metrics) {
        try {
            const systemEntry = {
                id: this.generateId(),
                timestamp: new Date(),
                type: 'system_metrics',
                incidentId,

                // Métricas de performance
                responseTime: metrics.responseTime, // ms
                processingTime: metrics.processingTime, // ms
                memoryUsage: metrics.memoryUsage, // MB
                cpuUsage: metrics.cpuUsage, // %

                // Métricas de AI/ML
                modelConfidence: metrics.modelConfidence || 0, // 0-1
                embeddingsSimilarity: metrics.embeddingsSimilarity || 0, // 0-1
                vectorSearchTime: metrics.vectorSearchTime || 0, // ms

                // Métricas de resultado
                suggestionAccuracy: metrics.suggestionAccuracy || 0, // 0-1
                userAcceptance: metrics.userAcceptance || false,
                resolutionSuccess: metrics.resolutionSuccess || false,

                // Contexto técnico
                modelVersion: metrics.modelVersion || '',
                algorithmUsed: metrics.algorithmUsed || '',
                featuresUsed: metrics.featuresUsed || [],

                // Erros e warnings
                errors: metrics.errors || [],
                warnings: metrics.warnings || [],

                // Ambiente
                environment: metrics.environment || 'production',
                serverInstance: metrics.serverInstance || '',
                sessionId: metrics.sessionId || ''
            };

            // Adicionar ao buffer
            this.feedbackBuffer.system.push(systemEntry);

            // Processar se buffer está cheio
            if (this.feedbackBuffer.system.length >= this.config.batchSize) {
                await this.flushSystemBuffer();
            }

            // Emitir evento
            this.emit('systemMetrics', systemEntry);

            return systemEntry.id;

        } catch (error) {
            logger.error('Erro ao coletar métricas do sistema:', error);
            throw error;
        }
    }

    /**
     * Coleta feedback agregado para um período
     */
    async collectFeedback(startTime, endTime) {
        try {
            logger.info(`Coletando feedback do período: ${startTime.toISOString()} - ${endTime.toISOString()}`);

            // Flush buffers antes de coletar
            await this.flushAllBuffers();

            // Coletar dados persistidos
            const [operatorData, userData, systemData] = await Promise.all([
                this.getOperatorFeedback(startTime, endTime),
                this.getUserSatisfaction(startTime, endTime),
                this.getSystemMetrics(startTime, endTime)
            ]);

            // Agregar e processar dados
            const aggregatedData = {
                operators: this.aggregateOperatorFeedback(operatorData),
                users: this.aggregateUserSatisfaction(userData),
                system: this.aggregateSystemMetrics(systemData),
                resolutions: this.aggregateResolutionMetrics(operatorData, userData, systemData),
                total: operatorData.length + userData.length + systemData.length,
                timeRange: { startTime, endTime }
            };

            logger.info(`Feedback coletado: ${aggregatedData.total} registros`);

            return aggregatedData;

        } catch (error) {
            logger.error('Erro ao coletar feedback agregado:', error);
            throw error;
        }
    }

    /**
     * Configura rastreamento de A/B testing
     */
    trackABTest(testId, config) {
        this.abTests.set(testId, {
            id: testId,
            startTime: new Date(),
            config,
            metrics: {
                controlGroup: { samples: 0, successRate: 0, avgSatisfaction: 0, resolutionTimes: [] },
                testGroup: { samples: 0, successRate: 0, avgSatisfaction: 0, resolutionTimes: [] }
            }
        });

        logger.info(`Iniciado rastreamento A/B test: ${testId}`);
    }

    /**
     * Registra métricas para A/B testing
     */
    recordABTestMetric(testId, group, incident, metrics) {
        const test = this.abTests.get(testId);
        if (!test) return;

        const groupMetrics = test.metrics[group];
        if (!groupMetrics) return;

        groupMetrics.samples++;

        if (metrics.wasSuccessful) {
            groupMetrics.successRate = (groupMetrics.successRate * (groupMetrics.samples - 1) + 1) / groupMetrics.samples;
        } else {
            groupMetrics.successRate = (groupMetrics.successRate * (groupMetrics.samples - 1)) / groupMetrics.samples;
        }

        if (metrics.satisfaction) {
            groupMetrics.avgSatisfaction = (groupMetrics.avgSatisfaction * (groupMetrics.samples - 1) + metrics.satisfaction) / groupMetrics.samples;
        }

        if (metrics.resolutionTime) {
            groupMetrics.resolutionTimes.push(metrics.resolutionTime);
        }
    }

    /**
     * Retorna resultados do A/B testing
     */
    async getABTestResults(testId) {
        const test = this.abTests.get(testId);
        if (!test) {
            throw new Error(`A/B test ${testId} não encontrado`);
        }

        // Calcular estatísticas finais
        const controlGroup = {
            ...test.metrics.controlGroup,
            avgResolutionTime: this.calculateAverage(test.metrics.controlGroup.resolutionTimes),
            medianResolutionTime: this.calculateMedian(test.metrics.controlGroup.resolutionTimes)
        };

        const testGroup = {
            ...test.metrics.testGroup,
            avgResolutionTime: this.calculateAverage(test.metrics.testGroup.resolutionTimes),
            medianResolutionTime: this.calculateMedian(test.metrics.testGroup.resolutionTimes)
        };

        return {
            testId,
            duration: new Date() - test.startTime,
            controlGroup,
            testGroup,
            statisticalSignificance: this.calculateSignificance(controlGroup, testGroup)
        };
    }

    /**
     * Agrega feedback de operadores
     */
    aggregateOperatorFeedback(data) {
        if (!data.length) return { count: 0 };

        return {
            count: data.length,
            averageAccuracy: this.calculateAverage(data.map(d => d.suggestionAccuracy)),
            averageRelevance: this.calculateAverage(data.map(d => d.suggestionRelevance)),
            averageCompleteness: this.calculateAverage(data.map(d => d.suggestionCompleteness)),
            successRate: data.filter(d => d.wasSuccessful).length / data.length,
            averageResolutionTime: this.calculateAverage(data.map(d => d.timeToResolve)),
            solutionSources: this.groupBy(data, 'solutionSource'),
            categories: this.groupBy(data, 'category'),
            improvementSuggestions: data.flatMap(d => d.improvementSuggestions || [])
        };
    }

    /**
     * Agrega satisfação dos usuários
     */
    aggregateUserSatisfaction(data) {
        if (!data.length) return { count: 0 };

        return {
            count: data.length,
            averageRating: this.calculateAverage(data.map(d => d.overallRating)),
            dimensionRatings: {
                speed: this.calculateAverage(data.map(d => d.resolutionSpeed).filter(Boolean)),
                quality: this.calculateAverage(data.map(d => d.resolutionQuality).filter(Boolean)),
                communication: this.calculateAverage(data.map(d => d.communicationQuality).filter(Boolean)),
                experience: this.calculateAverage(data.map(d => d.supportExperience).filter(Boolean))
            },
            recommendationRate: data.filter(d => d.wouldRecommend === true).length / data.length,
            channelDistribution: this.groupBy(data, 'channelUsed'),
            sentimentAnalysis: this.analyzeSentiment(data)
        };
    }

    /**
     * Agrega métricas do sistema
     */
    aggregateSystemMetrics(data) {
        if (!data.length) return { count: 0 };

        return {
            count: data.length,
            performance: {
                averageResponseTime: this.calculateAverage(data.map(d => d.responseTime)),
                averageProcessingTime: this.calculateAverage(data.map(d => d.processingTime)),
                averageMemoryUsage: this.calculateAverage(data.map(d => d.memoryUsage)),
                averageCpuUsage: this.calculateAverage(data.map(d => d.cpuUsage))
            },
            aiMetrics: {
                averageConfidence: this.calculateAverage(data.map(d => d.modelConfidence)),
                averageSimilarity: this.calculateAverage(data.map(d => d.embeddingsSimilarity)),
                averageSearchTime: this.calculateAverage(data.map(d => d.vectorSearchTime))
            },
            errorAnalysis: {
                errorRate: data.filter(d => d.errors.length > 0).length / data.length,
                commonErrors: this.aggregateErrors(data.flatMap(d => d.errors)),
                warningRate: data.filter(d => d.warnings.length > 0).length / data.length
            }
        };
    }

    /**
     * Agrega métricas de resolução
     */
    aggregateResolutionMetrics(operatorData, userData, systemData) {
        const totalResolutions = operatorData.length;
        if (!totalResolutions) return { count: 0 };

        return {
            count: totalResolutions,
            successRate: operatorData.filter(d => d.wasSuccessful).length / totalResolutions,
            averageConfidence: this.calculateAverage(operatorData.map(d => d.confidenceLevel)),
            averageResolutionTime: this.calculateAverage(operatorData.map(d => d.timeToResolve)),
            reoccurrenceRate: this.calculateReoccurrenceRate(operatorData),
            correlationWithSatisfaction: this.calculateCorrelation(operatorData, userData)
        };
    }

    // Métodos auxiliares

    generateId() {
        return `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    calculateAverage(values) {
        const validValues = values.filter(v => v != null && !isNaN(v));
        return validValues.length > 0 ? validValues.reduce((a, b) => a + b, 0) / validValues.length : 0;
    }

    calculateMedian(values) {
        const validValues = values.filter(v => v != null && !isNaN(v)).sort((a, b) => a - b);
        if (validValues.length === 0) return 0;

        const mid = Math.floor(validValues.length / 2);
        return validValues.length % 2 === 0 ?
            (validValues[mid - 1] + validValues[mid]) / 2 :
            validValues[mid];
    }

    groupBy(data, key) {
        return data.reduce((groups, item) => {
            const group = item[key] || 'unknown';
            groups[group] = (groups[group] || 0) + 1;
            return groups;
        }, {});
    }

    analyzeSentiment(data) {
        // Implementar análise de sentimento simples baseada em palavras-chave
        const positiveKeywords = ['bom', 'ótimo', 'excelente', 'rápido', 'eficiente', 'útil'];
        const negativeKeywords = ['ruim', 'lento', 'péssimo', 'demorado', 'inútil', 'confuso'];

        let positive = 0, negative = 0, neutral = 0;

        data.forEach(entry => {
            const text = (entry.suggestions || '').toLowerCase();
            const hasPositive = positiveKeywords.some(word => text.includes(word));
            const hasNegative = negativeKeywords.some(word => text.includes(word));

            if (hasPositive && !hasNegative) positive++;
            else if (hasNegative && !hasPositive) negative++;
            else neutral++;
        });

        return { positive, negative, neutral };
    }

    calculateReoccurrenceRate(data) {
        // Implementar cálculo de taxa de reincidência
        const incidents = this.groupBy(data, 'incidentId');
        const reoccurred = Object.values(incidents).filter(count => count > 1).length;
        return Object.keys(incidents).length > 0 ? reoccurred / Object.keys(incidents).length : 0;
    }

    calculateCorrelation(operatorData, userData) {
        // Implementar cálculo de correlação simples
        return 0.75; // Placeholder
    }

    calculateSignificance(controlGroup, testGroup) {
        // Implementar teste de significância estatística
        return {
            pValue: 0.05,
            isSignificant: true,
            confidenceLevel: 0.95
        };
    }

    aggregateErrors(errors) {
        return this.groupBy(errors, 'type');
    }

    updateRealtimeMetrics(entry) {
        this.realtimeMetrics.totalFeedbacks++;

        if (entry.type === 'operator') {
            const currentSuccess = this.realtimeMetrics.successRate * (this.realtimeMetrics.totalFeedbacks - 1);
            this.realtimeMetrics.successRate = (currentSuccess + (entry.wasSuccessful ? 1 : 0)) / this.realtimeMetrics.totalFeedbacks;

            const currentTime = this.realtimeMetrics.avgResolutionTime * (this.realtimeMetrics.totalFeedbacks - 1);
            this.realtimeMetrics.avgResolutionTime = (currentTime + entry.timeToResolve) / this.realtimeMetrics.totalFeedbacks;
        }

        if (entry.type === 'user_satisfaction') {
            const currentSat = this.realtimeMetrics.averageSatisfaction * (this.realtimeMetrics.totalFeedbacks - 1);
            this.realtimeMetrics.averageSatisfaction = (currentSat + entry.overallRating) / this.realtimeMetrics.totalFeedbacks;
        }
    }

    // Métodos de persistência e buffer

    async flushAllBuffers() {
        await Promise.all([
            this.flushOperatorBuffer(),
            this.flushUserBuffer(),
            this.flushSystemBuffer()
        ]);
    }

    async flushOperatorBuffer() {
        if (this.feedbackBuffer.operators.length === 0) return;

        const data = [...this.feedbackBuffer.operators];
        this.feedbackBuffer.operators = [];

        await this.persistOperatorFeedback(data);
    }

    async flushUserBuffer() {
        if (this.feedbackBuffer.users.length === 0) return;

        const data = [...this.feedbackBuffer.users];
        this.feedbackBuffer.users = [];

        await this.persistUserSatisfaction(data);
    }

    async flushSystemBuffer() {
        if (this.feedbackBuffer.system.length === 0) return;

        const data = [...this.feedbackBuffer.system];
        this.feedbackBuffer.system = [];

        await this.persistSystemMetrics(data);
    }

    // Métodos de persistência (implementar conforme provider)

    async setupDataConnections() {
        // Implementar conexões de dados
    }

    initializeBuffers() {
        // Implementar inicialização de buffers
    }

    setupCleanupSchedule() {
        // Implementar limpeza automática de dados antigos
        setInterval(() => {
            this.cleanupOldData();
        }, 24 * 60 * 60 * 1000); // Diário
    }

    async cleanupOldData() {
        const cutoffDate = new Date(Date.now() - this.config.retentionPeriod);
        // Implementar limpeza de dados antigos
    }

    async persistOperatorFeedback(data) {
        // Implementar persistência
        logger.debug(`Persistindo ${data.length} feedbacks de operadores`);
    }

    async persistUserSatisfaction(data) {
        // Implementar persistência
        logger.debug(`Persistindo ${data.length} avaliações de usuários`);
    }

    async persistSystemMetrics(data) {
        // Implementar persistência
        logger.debug(`Persistindo ${data.length} métricas de sistema`);
    }

    async getOperatorFeedback(startTime, endTime) {
        // Implementar recuperação de dados
        return [];
    }

    async getUserSatisfaction(startTime, endTime) {
        // Implementar recuperação de dados
        return [];
    }

    async getSystemMetrics(startTime, endTime) {
        // Implementar recuperação de dados
        return [];
    }

    async shutdown() {
        logger.info('Finalizando coletor de feedback');
        await this.flushAllBuffers();
    }
}

module.exports = FeedbackCollector;