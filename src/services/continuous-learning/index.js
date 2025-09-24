"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLearningSystem = exports.LearningDashboard = exports.DriftDetector = exports.MetricsCollector = exports.PatternAnalyzer = exports.ModelRetrainer = exports.ABTestingManager = exports.LearningPipeline = void 0;

// Componentes principais integrados
const LearningPipeline_1 = require("./LearningPipeline");
const ABTestingManager_1 = require("./ABTestingManager");
const ModelRetrainer_1 = require("./ModelRetrainer");
const PatternAnalyzer_1 = require("./PatternAnalyzer");
const MetricsCollector_1 = require("./MetricsCollector");
const DriftDetector_1 = require("./DriftDetector");
const LearningDashboard_1 = require("./LearningDashboard");
const logger = require('../../utils/logger');

// Exportar classes
exports.LearningPipeline = LearningPipeline_1.LearningPipeline;
exports.ABTestingManager = ABTestingManager_1.ABTestingManager;
exports.ModelRetrainer = ModelRetrainer_1.ModelRetrainer;
exports.PatternAnalyzer = PatternAnalyzer_1.PatternAnalyzer;
exports.MetricsCollector = MetricsCollector_1.MetricsCollector;
exports.DriftDetector = DriftDetector_1.DriftDetector;
exports.LearningDashboard = LearningDashboard_1.LearningDashboard;

/**
 * Factory function para criar um sistema completo de aprendizado contínuo
 *
 * @param {Object} config - Configuração do sistema
 * @returns {Object} - Sistema completo configurado
 */
async function createLearningSystem(config = {}) {
    const systemConfig = {
        // Configurações padrão do pipeline
        feedbackBatchSize: 100,
        retrainingThreshold: 0.15,
        experimentDuration: 7 * 24 * 60 * 60 * 1000, // 7 dias
        patternAnalysisInterval: 60 * 60 * 1000, // 1 hora
        driftThreshold: 0.1,
        minimumFeedbackCount: 50,
        qualityThreshold: 0.8,
        autoRetrainEnabled: true,

        // Configurações específicas dos componentes
        abTesting: {
            minSampleSize: 1000,
            significanceLevel: 0.05,
            maxConcurrentTests: 5
        },

        modelRetraining: {
            retrainingThreshold: 0.15,
            validationSplit: 0.2,
            maxTrainingTime: 30 * 60 * 1000,
            autoBackup: true
        },

        patternAnalysis: {
            minPatternConfidence: 0.7,
            analysisWindow: 24 * 60 * 60 * 1000,
            trendDetectionSensitivity: 0.1
        },

        metricsCollection: {
            metricsRetention: 30 * 24 * 60 * 60 * 1000,
            aggregationInterval: 5 * 60 * 1000,
            enableRealTimeTracking: true,
            alertThresholds: {
                accuracy: 0.7,
                userSatisfaction: 3.0,
                responseTime: 2000,
                errorRate: 0.05
            }
        },

        driftDetection: {
            driftThreshold: 0.1,
            windowSize: 1000,
            statisticalTests: ['ks_test', 'chi_square', 'psi'],
            minSamplesForTest: 100,
            alertThreshold: 0.05
        },

        dashboard: {
            refreshInterval: 30000,
            historicalDataPoints: 100,
            enableRealTimeUpdates: true
        },

        // Merge com configurações personalizadas
        ...config
    };

    // Criar pipeline principal
    const pipeline = new LearningPipeline_1.LearningPipeline(systemConfig);

    // Criar dashboard
    const dashboard = new LearningDashboard_1.LearningDashboard(pipeline, systemConfig.dashboard);

    // Inicializar sistema
    await pipeline.start();
    await dashboard.initialize();

    // Configurar integração entre componentes
    setupSystemIntegration(pipeline, dashboard);

    return {
        pipeline,
        dashboard,

        // Métodos de conveniência
        async collectFeedback(feedbackData) {
            return await pipeline.collectFeedback(feedbackData);
        },

        async getCurrentInsights() {
            return await pipeline.getCurrentInsights();
        },

        async getSystemStatus() {
            return await pipeline.getSystemStatus();
        },

        async getPerformanceReport() {
            return await pipeline.getPerformanceReport();
        },

        async getDashboardData() {
            return dashboard.getDashboardData();
        },

        async generateReport(type = 'summary') {
            return await dashboard.generateReport(type);
        },

        async shutdown() {
            await dashboard.shutdown();
            await pipeline.stop();
        }
    };
}

/**
 * Configura integração entre componentes do sistema
 */
function setupSystemIntegration(pipeline, dashboard) {
    // Conectar eventos do pipeline ao dashboard
    pipeline.on('feedbackCollected', (feedback) => {
        dashboard.emit('systemEvent', {
            type: 'feedback_collected',
            data: feedback,
            timestamp: Date.now()
        });
    });

    pipeline.on('patternDiscovered', (pattern) => {
        dashboard.emit('systemEvent', {
            type: 'pattern_discovered',
            data: pattern,
            timestamp: Date.now()
        });
    });

    pipeline.on('experimentCompleted', (result) => {
        dashboard.emit('systemEvent', {
            type: 'experiment_completed',
            data: result,
            timestamp: Date.now()
        });
    });

    pipeline.on('driftDetected', (drift) => {
        dashboard.emit('systemEvent', {
            type: 'drift_detected',
            data: drift,
            timestamp: Date.now()
        });
    });

    pipeline.on('modelRetrained', (result) => {
        dashboard.emit('systemEvent', {
            type: 'model_retrained',
            data: result,
            timestamp: Date.now()
        });
    });

    // Configurar log centralizado
    dashboard.on('systemEvent', (event) => {
        logger.info(`Sistema de aprendizado - ${event.type}:`, event.data);
    });
}

/**
 * Configurações padrão do sistema
 */
const defaultConfigurations = {
    development: {
        feedbackBatchSize: 10,
        retrainingThreshold: 0.2,
        experimentDuration: 2 * 24 * 60 * 60 * 1000, // 2 dias
        driftThreshold: 0.2,
        minimumFeedbackCount: 10
    },

    production: {
        feedbackBatchSize: 100,
        retrainingThreshold: 0.1,
        experimentDuration: 7 * 24 * 60 * 60 * 1000, // 7 dias
        driftThreshold: 0.05,
        minimumFeedbackCount: 100
    },

    testing: {
        feedbackBatchSize: 5,
        retrainingThreshold: 0.3,
        experimentDuration: 60 * 60 * 1000, // 1 hora
        driftThreshold: 0.3,
        minimumFeedbackCount: 5
    }
};

/**
 * Utilitários para configuração
 */
const utils = {
    /**
     * Valida configuração do sistema
     */
    validateConfig(config) {
        const required = ['feedbackBatchSize', 'retrainingThreshold', 'driftThreshold'];

        for (const field of required) {
            if (config[field] === undefined) {
                throw new Error(`Campo obrigatório ausente: ${field}`);
            }
        }

        if (config.feedbackBatchSize < 1) {
            throw new Error('feedbackBatchSize deve ser maior que 0');
        }

        if (config.retrainingThreshold < 0 || config.retrainingThreshold > 1) {
            throw new Error('retrainingThreshold deve estar entre 0 e 1');
        }

        return true;
    },

    /**
     * Mescla configurações com padrões
     */
    mergeConfigs(userConfig, environment = 'production') {
        const envConfig = defaultConfigurations[environment] || defaultConfigurations.production;
        return { ...envConfig, ...userConfig };
    },

    /**
     * Obtém configuração otimizada para ambiente
     */
    getOptimizedConfig(environment = 'production', customConfig = {}) {
        const baseConfig = defaultConfigurations[environment];
        const merged = { ...baseConfig, ...customConfig };

        this.validateConfig(merged);
        return merged;
    }
};

exports.createLearningSystem = createLearningSystem;

// Exportar utilitários e configurações
module.exports = {
    // Classes principais
    LearningPipeline: LearningPipeline_1.LearningPipeline,
    ABTestingManager: ABTestingManager_1.ABTestingManager,
    ModelRetrainer: require('./ModelRetrainer'),
    PatternAnalyzer: require('./PatternAnalyzer'),
    MetricsCollector: MetricsCollector_1.MetricsCollector,
    DriftDetector: DriftDetector_1.DriftDetector,
    LearningDashboard: LearningDashboard_1.LearningDashboard,

    // Factory principal
    createLearningSystem,

    // Configurações e utilitários
    defaultConfigurations,
    utils,

    // Versão do sistema
    version: '2.0.0',

    // Informações do sistema
    features: [
        'Aprendizado contínuo com feedback',
        'A/B Testing automatizado',
        'Detecção de drift em tempo real',
        'Análise de padrões inteligente',
        'Métricas e KPIs avançados',
        'Dashboard em tempo real',
        'Retreino automático de modelos',
        'Sistema de alertas inteligente'
    ]
};

// Exemplo de uso
if (require.main === module) {
    async function example() {
        console.log('=== Sistema de Aprendizado Contínuo v2.0 - Exemplo ===');

        try {
            // Criar sistema para desenvolvimento
            const system = await createLearningSystem(utils.getOptimizedConfig('development', {
                feedbackBatchSize: 5,
                patternAnalysisInterval: 30 * 60 * 1000 // 30 minutos
            }));

            console.log('Sistema iniciado com sucesso!');

            // Simular coleta de feedback
            console.log('Coletando feedback de exemplo...');

            await system.collectFeedback({
                userId: 'user_001',
                suggestionId: 'sug_001',
                rating: 4,
                usefulness: 4,
                accuracy: 5,
                relevance: 4,
                context: {
                    incidentType: 'performance',
                    severity: 'medium',
                    timeToResolve: 25
                },
                metadata: {
                    userSegment: 'experienced',
                    suggestionType: 'automated',
                    deviceType: 'desktop',
                    sessionId: 'sess_001'
                }
            });

            // Obter status do sistema
            console.log('Status do sistema:', await system.getSystemStatus());

            // Obter insights atuais
            console.log('Insights atuais:', await system.getCurrentInsights());

            // Obter dados do dashboard
            const dashboardData = await system.getDashboardData();
            console.log('Dashboard:', JSON.stringify(dashboardData, null, 2));

            // Gerar relatório
            const report = await system.generateReport('summary');
            console.log('Relatório:', JSON.stringify(report, null, 2));

            console.log('Sistema funcionando... (aguardando 10 segundos)');

            // Finalizar após 10 segundos
            setTimeout(async () => {
                await system.shutdown();
                console.log('Sistema finalizado com sucesso!');
                process.exit(0);
            }, 10000);

        } catch (error) {
            console.error('Erro no exemplo:', error);
            process.exit(1);
        }
    }

    example();
}