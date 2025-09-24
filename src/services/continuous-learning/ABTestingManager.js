"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ABTestingManager = void 0;

const events_1 = require("events");
const logger = require('../../utils/logger');

class ABTestingManager extends events_1.EventEmitter {
    constructor(config = {}) {
        super();
        this.config = {
            minSampleSize: config.minSampleSize || 1000,
            significanceLevel: config.significanceLevel || 0.05,
            maxConcurrentTests: config.maxConcurrentTests || 5,
            defaultTestDuration: config.defaultTestDuration || 7 * 24 * 60 * 60 * 1000, // 7 dias
            powerAnalysisThreshold: config.powerAnalysisThreshold || 0.8,
            ...config
        };

        this.experiments = new Map();
        this.assignments = new Map();
        this.results = new Map();
        this.isRunning = false;
    }

    async initialize() {
        logger.info('Inicializando ABTestingManager');
        this.isRunning = true;
        this.emit('initialized');
    }

    async shutdown() {
        logger.info('Finalizando ABTestingManager');
        this.isRunning = false;
        
        // Finalizar todos os experimentos ativos
        for (const [experimentId, experiment] of this.experiments) {
            if (experiment.status === 'active') {
                await this.finalizeExperiment(experimentId, 'shutdown');
            }
        }
        
        this.emit('shutdown');
    }

    async createExperiment(config) {
        if (this.experiments.size >= this.config.maxConcurrentTests) {
            throw new Error('Número máximo de testes concorrentes atingido');
        }

        const experimentId = this.generateExperimentId();
        const experiment = {
            id: experimentId,
            name: config.name,
            hypothesis: config.hypothesis,
            variants: config.variants || [{ id: 'control' }, { id: 'treatment' }],
            targetMetric: config.targetMetric || 'conversion_rate',
            trafficAllocation: config.trafficAllocation || 50, // Percentual do tráfego
            duration: config.duration || this.config.defaultTestDuration,
            status: 'draft',
            createdAt: Date.now(),
            startedAt: null,
            endedAt: null,
            metadata: config.metadata || {},
            
            // Métricas de tracking
            metrics: {
                totalParticipants: 0,
                variantParticipants: new Map(),
                conversions: new Map(),
                outcomes: new Map()
            }
        };

        // Inicializar métricas para cada variante
        experiment.variants.forEach(variant => {
            experiment.metrics.variantParticipants.set(variant.id, 0);
            experiment.metrics.conversions.set(variant.id, 0);
            experiment.metrics.outcomes.set(variant.id, []);
        });

        this.experiments.set(experimentId, experiment);
        
        logger.info(`Experimento criado: ${experimentId} - ${config.name}`);
        this.emit('experimentCreated', experiment);
        
        return experimentId;
    }

    async startExperiment(experimentId) {
        const experiment = this.experiments.get(experimentId);
        if (!experiment) {
            throw new Error(`Experimento ${experimentId} não encontrado`);
        }

        if (experiment.status !== 'draft') {
            throw new Error(`Experimento deve estar em status 'draft' para ser iniciado`);
        }

        experiment.status = 'active';
        experiment.startedAt = Date.now();

        // Agendar finalização automática
        setTimeout(() => {
            this.finalizeExperiment(experimentId, 'duration_reached');
        }, experiment.duration);

        logger.info(`Experimento iniciado: ${experimentId}`);
        this.emit('experimentStarted', experiment);

        return experiment;
    }

    async assignUserToVariant(userId, experimentId, context = {}) {
        const experiment = this.experiments.get(experimentId);
        if (!experiment || experiment.status !== 'active') {
            return null;
        }

        // Verificar se usuário já está assignado
        const existingAssignment = this.assignments.get(`${userId}-${experimentId}`);
        if (existingAssignment) {
            return existingAssignment;
        }

        // Verificar se deve participar do teste (baseado em alocação de tráfego)
        if (Math.random() * 100 > experiment.trafficAllocation) {
            return null;
        }

        // Atribuir variante (distribuição uniforme)
        const variantIndex = this.hashUserId(userId) % experiment.variants.length;
        const variant = experiment.variants[variantIndex];

        const assignment = {
            userId,
            experimentId,
            variantId: variant.id,
            assignedAt: Date.now(),
            context
        };

        this.assignments.set(`${userId}-${experimentId}`, assignment);
        
        // Atualizar métricas
        experiment.metrics.totalParticipants++;
        const currentCount = experiment.metrics.variantParticipants.get(variant.id) || 0;
        experiment.metrics.variantParticipants.set(variant.id, currentCount + 1);

        this.emit('userAssigned', assignment);
        return assignment;
    }

    async recordConversion(userId, experimentId, value = 1, metadata = {}) {
        const assignment = this.assignments.get(`${userId}-${experimentId}`);
        if (!assignment) {
            return false;
        }

        const experiment = this.experiments.get(experimentId);
        if (!experiment || experiment.status !== 'active') {
            return false;
        }

        // Registrar conversão
        const currentConversions = experiment.metrics.conversions.get(assignment.variantId) || 0;
        experiment.metrics.conversions.set(assignment.variantId, currentConversions + value);

        // Registrar outcome detalhado
        const outcomes = experiment.metrics.outcomes.get(assignment.variantId) || [];
        outcomes.push({
            userId,
            value,
            timestamp: Date.now(),
            metadata
        });
        experiment.metrics.outcomes.set(assignment.variantId, outcomes);

        this.emit('conversionRecorded', {
            userId,
            experimentId,
            variantId: assignment.variantId,
            value,
            metadata
        });

        // Verificar se deve finalizar teste por significância estatística
        if (await this.hasStatisticalSignificance(experimentId)) {
            await this.finalizeExperiment(experimentId, 'statistical_significance');
        }

        return true;
    }

    async updateExperiment(experimentId, feedbackData) {
        const experiment = this.experiments.get(experimentId);
        if (!experiment || experiment.status !== 'active') {
            return;
        }

        // Processar feedback para o experimento
        for (const feedback of feedbackData) {
            if (feedback.metadata && feedback.metadata.sessionId) {
                // Tentar encontrar assignment baseado em session
                const assignment = Array.from(this.assignments.values())
                    .find(a => a.experimentId === experimentId && 
                                a.context.sessionId === feedback.metadata.sessionId);
                
                if (assignment) {
                    await this.recordConversion(
                        assignment.userId,
                        experimentId,
                        feedback.rating || feedback.usefulness || 1,
                        { feedbackType: 'user_satisfaction', ...feedback.metadata }
                    );
                }
            }
        }
    }

    async hasStatisticalSignificance(experimentId) {
        const experiment = this.experiments.get(experimentId);
        if (!experiment || experiment.variants.length !== 2) {
            return false;
        }

        const [variant1, variant2] = experiment.variants;
        
        const n1 = experiment.metrics.variantParticipants.get(variant1.id) || 0;
        const n2 = experiment.metrics.variantParticipants.get(variant2.id) || 0;
        const x1 = experiment.metrics.conversions.get(variant1.id) || 0;
        const x2 = experiment.metrics.conversions.get(variant2.id) || 0;

        // Verificar tamanho mínimo da amostra
        if (n1 < this.config.minSampleSize || n2 < this.config.minSampleSize) {
            return false;
        }

        // Teste Z para proporções
        const p1 = x1 / n1;
        const p2 = x2 / n2;
        const p = (x1 + x2) / (n1 + n2);
        
        const se = Math.sqrt(p * (1 - p) * (1/n1 + 1/n2));
        const z = Math.abs(p1 - p2) / se;
        
        const criticalValue = this.getZCriticalValue(this.config.significanceLevel);
        
        return z > criticalValue;
    }

    async finalizeExperiment(experimentId, reason = 'manual') {
        const experiment = this.experiments.get(experimentId);
        if (!experiment) {
            return;
        }

        experiment.status = 'completed';
        experiment.endedAt = Date.now();

        // Calcular resultados finais
        const results = await this.calculateResults(experimentId);
        this.results.set(experimentId, results);

        // Determinar vencedor
        const winner = this.determineWinner(results);

        logger.info(`Experimento finalizado: ${experimentId} - Razão: ${reason} - Vencedor: ${winner?.variantId || 'nenhum'}`);
        
        this.emit('experimentCompleted', {
            experimentId,
            reason,
            results,
            winner,
            experiment
        });

        return results;
    }

    async calculateResults(experimentId) {
        const experiment = this.experiments.get(experimentId);
        if (!experiment) {
            throw new Error(`Experimento ${experimentId} não encontrado`);
        }

        const results = {
            experimentId,
            duration: experiment.endedAt - experiment.startedAt,
            totalParticipants: experiment.metrics.totalParticipants,
            variants: []
        };

        for (const variant of experiment.variants) {
            const participants = experiment.metrics.variantParticipants.get(variant.id) || 0;
            const conversions = experiment.metrics.conversions.get(variant.id) || 0;
            const outcomes = experiment.metrics.outcomes.get(variant.id) || [];

            const conversionRate = participants > 0 ? conversions / participants : 0;
            const averageValue = outcomes.length > 0 ? 
                outcomes.reduce((sum, o) => sum + o.value, 0) / outcomes.length : 0;

            const standardError = this.calculateStandardError(conversionRate, participants);
            const confidenceInterval = this.calculateConfidenceInterval(
                conversionRate, 
                standardError, 
                this.config.significanceLevel
            );

            results.variants.push({
                variantId: variant.id,
                participants,
                conversions,
                conversionRate,
                averageValue,
                standardError,
                confidenceInterval,
                outcomes: outcomes.length
            });
        }

        // Calcular significância estatística entre variantes
        if (results.variants.length === 2) {
            results.statisticalSignificance = await this.hasStatisticalSignificance(experimentId);
            results.pValue = this.calculatePValue(results.variants[0], results.variants[1]);
        }

        return results;
    }

    determineWinner(results) {
        if (results.variants.length < 2) {
            return null;
        }

        // Se não há significância estatística, não há vencedor claro
        if (results.statisticalSignificance === false) {
            return null;
        }

        // Encontrar variante com maior taxa de conversão
        let winner = results.variants[0];
        for (let i = 1; i < results.variants.length; i++) {
            if (results.variants[i].conversionRate > winner.conversionRate) {
                winner = results.variants[i];
            }
        }

        return {
            variantId: winner.variantId,
            conversionRate: winner.conversionRate,
            improvement: winner.conversionRate / results.variants.find(v => v.variantId !== winner.variantId).conversionRate - 1,
            confidence: 1 - (results.pValue || 0)
        };
    }

    calculateStandardError(proportion, sampleSize) {
        if (sampleSize === 0) return 0;
        return Math.sqrt((proportion * (1 - proportion)) / sampleSize);
    }

    calculateConfidenceInterval(proportion, standardError, significanceLevel) {
        const zScore = this.getZCriticalValue(significanceLevel);
        const margin = zScore * standardError;
        
        return {
            lower: Math.max(0, proportion - margin),
            upper: Math.min(1, proportion + margin)
        };
    }

    calculatePValue(variant1, variant2) {
        if (variant1.participants === 0 || variant2.participants === 0) {
            return 1;
        }

        const p1 = variant1.conversionRate;
        const p2 = variant2.conversionRate;
        const n1 = variant1.participants;
        const n2 = variant2.participants;
        
        const p = (variant1.conversions + variant2.conversions) / (n1 + n2);
        const se = Math.sqrt(p * (1 - p) * (1/n1 + 1/n2));
        const z = Math.abs(p1 - p2) / se;
        
        return 2 * (1 - this.normalCDF(Math.abs(z)));
    }

    getZCriticalValue(significanceLevel) {
        // Valores críticos para diferentes níveis de significância
        const criticalValues = {
            0.01: 2.576,
            0.05: 1.96,
            0.10: 1.645
        };
        
        return criticalValues[significanceLevel] || 1.96;
    }

    normalCDF(z) {
        // Aproximação da função de distribuição cumulativa normal
        return 0.5 * (1 + this.erf(z / Math.sqrt(2)));
    }

    erf(x) {
        // Aproximação da função erro
        const a1 = 0.254829592;
        const a2 = -0.284496736;
        const a3 = 1.421413741;
        const a4 = -1.453152027;
        const a5 = 1.061405429;
        const p = 0.3275911;
        
        const sign = x >= 0 ? 1 : -1;
        x = Math.abs(x);
        
        const t = 1.0 / (1.0 + p * x);
        const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
        
        return sign * y;
    }

    hashUserId(userId) {
        // Hash simples para consistência na atribuição de variantes
        let hash = 0;
        for (let i = 0; i < userId.toString().length; i++) {
            const char = userId.toString().charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Converter para 32-bit
        }
        return Math.abs(hash);
    }

    generateExperimentId() {
        return `exp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Public API methods
    getExperiment(experimentId) {
        return this.experiments.get(experimentId);
    }

    getExperimentResults(experimentId) {
        return this.results.get(experimentId);
    }

    getActiveExperiments() {
        return Array.from(this.experiments.values()).filter(exp => exp.status === 'active');
    }

    getUserAssignment(userId, experimentId) {
        return this.assignments.get(`${userId}-${experimentId}`);
    }

    async getDashboard() {
        const activeExperiments = this.getActiveExperiments();
        const completedExperiments = Array.from(this.experiments.values())
            .filter(exp => exp.status === 'completed')
            .slice(-10); // Últimos 10 completados

        const summary = {
            totalExperiments: this.experiments.size,
            activeExperiments: activeExperiments.length,
            completedExperiments: completedExperiments.length,
            totalParticipants: Array.from(this.experiments.values())
                .reduce((sum, exp) => sum + exp.metrics.totalParticipants, 0)
        };

        return {
            summary,
            activeExperiments: activeExperiments.map(exp => ({
                id: exp.id,
                name: exp.name,
                status: exp.status,
                participants: exp.metrics.totalParticipants,
                duration: Date.now() - exp.startedAt,
                variants: exp.variants.map(v => ({
                    id: v.id,
                    participants: exp.metrics.variantParticipants.get(v.id) || 0,
                    conversions: exp.metrics.conversions.get(v.id) || 0
                }))
            })),
            recentResults: completedExperiments.map(exp => {
                const results = this.results.get(exp.id);
                return {
                    id: exp.id,
                    name: exp.name,
                    completedAt: exp.endedAt,
                    winner: results ? this.determineWinner(results) : null,
                    totalParticipants: exp.metrics.totalParticipants
                };
            })
        };
    }
}

exports.ABTestingManager = ABTestingManager;