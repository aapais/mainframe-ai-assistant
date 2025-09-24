"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LearningDashboard = void 0;

const events_1 = require("events");
const logger = require('../../utils/logger');

class LearningDashboard extends events_1.EventEmitter {
    constructor(learningPipeline, config = {}) {
        super();
        this.learningPipeline = learningPipeline;
        this.config = {
            refreshInterval: config.refreshInterval || 30000, // 30 segundos
            historicalDataPoints: config.historicalDataPoints || 100,
            enableRealTimeUpdates: config.enableRealTimeUpdates || true,
            ...config
        };

        this.dashboardData = {
            overview: {},
            metrics: {},
            experiments: {},
            patterns: {},
            alerts: {},
            trends: {},
            performance: {}
        };

        this.refreshTimer = null;
        this.isRunning = false;
    }

    async initialize() {
        logger.info('Inicializando Learning Dashboard');

        // Configurar listeners para atualizações em tempo real
        if (this.config.enableRealTimeUpdates) {
            this.setupRealTimeListeners();
        }

        // Carregar dados iniciais
        await this.refreshDashboard();

        // Iniciar refresh automático
        this.startAutoRefresh();

        this.isRunning = true;
        this.emit('initialized');
    }

    async shutdown() {
        logger.info('Finalizando Learning Dashboard');

        this.isRunning = false;

        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
        }

        this.emit('shutdown');
    }

    setupRealTimeListeners() {
        // Ouvir eventos do pipeline para atualizações em tempo real
        this.learningPipeline.on('feedbackCollected', () => {
            this.updateMetricsData();
        });

        this.learningPipeline.on('patternDiscovered', (pattern) => {
            this.updatePatternsData(pattern);
        });

        this.learningPipeline.on('experimentCompleted', (result) => {
            this.updateExperimentsData(result);
        });

        this.learningPipeline.on('driftDetected', (drift) => {
            this.updateAlertsData(drift);
        });

        this.learningPipeline.on('metricsAlert', (alert) => {
            this.updateAlertsData(alert);
        });
    }

    async refreshDashboard() {
        try {
            // Coletar dados de todos os componentes de forma simplificada
            const overview = await this.getOverviewData();
            const metrics = await this.getMetricsData();

            this.dashboardData = {
                overview,
                metrics,
                experiments: { active: [], completed: [], summary: {} },
                patterns: { recent: [], categories: {}, confidence: 0, impact: {} },
                alerts: { active: [], severity: {}, drift: [], trends: {} },
                trends: { accuracy: {}, userSatisfaction: {}, responseTime: {}, feedbackVolume: {} },
                performance: { current: {}, recommendations: [], modelVersions: [] },
                lastUpdated: Date.now()
            };

            this.emit('dashboardUpdated', this.dashboardData);

        } catch (error) {
            logger.error('Erro ao atualizar dashboard:', error);
            this.emit('updateError', error);
        }
    }

    async getOverviewData() {
        try {
            const pipelineStatus = this.learningPipeline.getStatus();

            return {
                pipelineStatus: {
                    isRunning: pipelineStatus.isRunning,
                    lastCycle: pipelineStatus.lastLearningCycle,
                    nextCycle: pipelineStatus.nextCycleIn,
                    cyclesCompleted: pipelineStatus.metrics?.cyclesCompleted || 0
                },
                systemHealth: {
                    overall: 'healthy',
                    components: {
                        abTesting: this.learningPipeline.abTestingManager ? 'active' : 'inactive',
                        modelRetrainer: this.learningPipeline.modelRetrainer ? 'active' : 'inactive',
                        patternAnalyzer: this.learningPipeline.patternAnalyzer ? 'active' : 'inactive',
                        metricsCollector: this.learningPipeline.metricsCollector ? 'active' : 'inactive',
                        driftDetector: this.learningPipeline.driftDetector ? 'active' : 'inactive'
                    }
                },
                keyMetrics: {
                    totalFeedback: 0,
                    averageSatisfaction: 0,
                    modelAccuracy: 0,
                    driftScore: 0
                }
            };
        } catch (error) {
            logger.error('Erro ao obter dados de overview:', error);
            return {
                pipelineStatus: { isRunning: false },
                systemHealth: { overall: 'error' },
                keyMetrics: {}
            };
        }
    }

    async getMetricsData() {
        try {
            return {
                current: {
                    accuracy: 0,
                    userSatisfaction: 0,
                    responseTime: 0,
                    errorRate: 0,
                    feedbackVolume: 0
                },
                historical: {},
                kpis: [],
                segmentation: {},
                benchmarks: []
            };
        } catch (error) {
            logger.error('Erro ao obter dados de métricas:', error);
            return {
                current: {},
                historical: {},
                kpis: [],
                segmentation: {},
                benchmarks: []
            };
        }
    }

    // Métodos de atualização em tempo real simplificados
    async updateMetricsData() {
        try {
            this.dashboardData.metrics = await this.getMetricsData();
            this.dashboardData.lastUpdated = Date.now();
            this.emit('metricsUpdated', this.dashboardData.metrics);
        } catch (error) {
            logger.error('Erro ao atualizar métricas:', error);
        }
    }

    async updatePatternsData(pattern) {
        try {
            // Atualização simplificada de padrões
            this.dashboardData.lastUpdated = Date.now();
            this.emit('patternsUpdated', this.dashboardData.patterns);
        } catch (error) {
            logger.error('Erro ao atualizar padrões:', error);
        }
    }

    async updateExperimentsData(result) {
        try {
            // Atualização simplificada de experimentos
            this.dashboardData.lastUpdated = Date.now();
            this.emit('experimentsUpdated', this.dashboardData.experiments);
        } catch (error) {
            logger.error('Erro ao atualizar experimentos:', error);
        }
    }

    async updateAlertsData(alert) {
        try {
            // Atualização simplificada de alertas
            this.dashboardData.lastUpdated = Date.now();
            this.emit('alertsUpdated', this.dashboardData.alerts);
        } catch (error) {
            logger.error('Erro ao atualizar alertas:', error);
        }
    }

    startAutoRefresh() {
        this.refreshTimer = setInterval(async () => {
            if (this.isRunning) {
                await this.refreshDashboard();
            }
        }, this.config.refreshInterval);
    }

    // API pública
    getDashboardData() {
        return { ...this.dashboardData };
    }

    async exportDashboardData(format = 'json') {
        const data = this.getDashboardData();

        if (format === 'json') {
            return JSON.stringify(data, null, 2);
        }

        return data;
    }

    async generateReport(type = 'summary') {
        const data = this.getDashboardData();

        const report = {
            generatedAt: Date.now(),
            type,
            summary: {
                pipelineHealth: data.overview?.systemHealth?.overall || 'unknown',
                keyMetrics: data.overview?.keyMetrics || {},
                activeExperiments: data.experiments?.active?.length || 0,
                recentPatterns: data.patterns?.recent?.length || 0,
                alertsSeverity: data.alerts?.severity || {}
            }
        };

        if (type === 'detailed') {
            report.detailed = {
                metrics: data.metrics,
                experiments: data.experiments,
                patterns: data.patterns,
                performance: data.performance
            };
        }

        return report;
    }
}

exports.LearningDashboard = LearningDashboard;