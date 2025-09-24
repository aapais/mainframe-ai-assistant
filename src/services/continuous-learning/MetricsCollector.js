"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetricsCollector = void 0;

const events_1 = require("events");
const logger = require('../../utils/logger');

class MetricsCollector extends events_1.EventEmitter {
    constructor(config = {}) {
        super();
        this.config = {
            metricsRetention: config.metricsRetention || 30 * 24 * 60 * 60 * 1000, // 30 dias
            aggregationInterval: config.aggregationInterval || 5 * 60 * 1000, // 5 minutos
            enableRealTimeTracking: config.enableRealTimeTracking || true,
            alertThresholds: {
                accuracy: config.alertThresholds?.accuracy || 0.7,
                userSatisfaction: config.alertThresholds?.userSatisfaction || 3.0,
                responseTime: config.alertThresholds?.responseTime || 2000,
                errorRate: config.alertThresholds?.errorRate || 0.05,
                ...config.alertThresholds
            },
            ...config
        };

        this.metrics = new Map();
        this.aggregatedMetrics = new Map();
        this.realTimeMetrics = {
            feedbackCount: 0,
            totalRating: 0,
            totalResponseTime: 0,
            errors: 0,
            lastUpdate: Date.now()
        };
        this.kpis = new Map();
        this.trends = new Map();
        this.alerts = [];
        this.isRunning = false;
        this.aggregationTimer = null;
    }

    async initialize() {
        logger.info('Inicializando MetricsCollector');
        this.isRunning = true;

        // Iniciar agregação periódica
        this.startAggregation();

        this.emit('initialized');
    }

    async shutdown() {
        logger.info('Finalizando MetricsCollector');
        this.isRunning = false;

        if (this.aggregationTimer) {
            clearInterval(this.aggregationTimer);
            this.aggregationTimer = null;
        }

        this.emit('shutdown');
    }

    async recordFeedback(feedbackData) {
        const timestamp = Date.now();
        const metricEntry = {
            timestamp,
            type: 'feedback',
            data: feedbackData,
            processed: false
        };

        // Armazenar métrica individual
        const metricId = `feedback_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;
        this.metrics.set(metricId, metricEntry);

        // Atualizar métricas em tempo real
        if (this.config.enableRealTimeTracking) {
            this.updateRealTimeMetrics(feedbackData);
        }

        // Processar para KPIs imediatos
        await this.processImmediateMetrics(feedbackData);

        this.emit('feedbackRecorded', metricEntry);
    }

    updateRealTimeMetrics(feedbackData) {
        this.realTimeMetrics.feedbackCount++;
        this.realTimeMetrics.lastUpdate = Date.now();

        if (feedbackData.rating !== undefined) {
            this.realTimeMetrics.totalRating += feedbackData.rating;
        }

        if (feedbackData.responseTime !== undefined) {
            this.realTimeMetrics.totalResponseTime += feedbackData.responseTime;
        }

        // Detectar erros baseado em feedback muito negativo
        if (feedbackData.rating !== undefined && feedbackData.rating < 2) {
            this.realTimeMetrics.errors++;
        }
    }

    async processImmediateMetrics(feedbackData) {
        // Processar métricas que precisam de ação imediata
        const currentPerformance = await this.getCurrentPerformance();

        // Verificar thresholds e gerar alertas se necessário
        await this.checkAlertThresholds(currentPerformance);
    }

    async processBatch(feedbackBatch) {
        const batchTimestamp = Date.now();
        const batchMetrics = {
            timestamp: batchTimestamp,
            type: 'batch',
            size: feedbackBatch.length,
            metrics: this.calculateBatchMetrics(feedbackBatch)
        };

        // Armazenar métricas do batch
        this.aggregatedMetrics.set(`batch_${batchTimestamp}`, batchMetrics);

        // Atualizar KPIs
        await this.updateKPIs(batchMetrics);

        // Calcular tendências
        await this.updateTrends(batchMetrics);

        this.emit('batchProcessed', batchMetrics);

        return batchMetrics;
    }

    calculateBatchMetrics(feedbackBatch) {
        const metrics = {
            accuracy: { total: 0, count: 0 },
            userSatisfaction: { total: 0, count: 0 },
            usefulness: { total: 0, count: 0 },
            relevance: { total: 0, count: 0 },
            responseTime: { total: 0, count: 0 },
            errorRate: { errors: 0, total: 0 },
            qualityScore: { total: 0, count: 0 },
            segmentation: {
                byUserSegment: new Map(),
                bySuggestionType: new Map(),
                byDeviceType: new Map()
            }
        };

        for (const feedback of feedbackBatch) {
            // Métricas básicas
            if (feedback.accuracy !== undefined) {
                metrics.accuracy.total += feedback.accuracy;
                metrics.accuracy.count++;
            }

            if (feedback.rating !== undefined) {
                metrics.userSatisfaction.total += feedback.rating;
                metrics.userSatisfaction.count++;
            }

            if (feedback.usefulness !== undefined) {
                metrics.usefulness.total += feedback.usefulness;
                metrics.usefulness.count++;
            }

            if (feedback.relevance !== undefined) {
                metrics.relevance.total += feedback.relevance;
                metrics.relevance.count++;
            }

            if (feedback.responseTime !== undefined) {
                metrics.responseTime.total += feedback.responseTime;
                metrics.responseTime.count++;
            }

            if (feedback.quality !== undefined) {
                metrics.qualityScore.total += feedback.quality;
                metrics.qualityScore.count++;
            }

            // Rate de erro (baseado em rating muito baixo ou feedback negativo)
            metrics.errorRate.total++;
            if (feedback.rating !== undefined && feedback.rating < 2) {
                metrics.errorRate.errors++;
            }

            // Segmentação
            if (feedback.metadata) {
                this.updateSegmentationMetrics(metrics.segmentation, feedback.metadata);
            }
        }

        // Calcular médias
        return {
            accuracy: metrics.accuracy.count > 0 ? metrics.accuracy.total / metrics.accuracy.count : 0,
            userSatisfaction: metrics.userSatisfaction.count > 0 ? metrics.userSatisfaction.total / metrics.userSatisfaction.count : 0,
            usefulness: metrics.usefulness.count > 0 ? metrics.usefulness.total / metrics.usefulness.count : 0,
            relevance: metrics.relevance.count > 0 ? metrics.relevance.total / metrics.relevance.count : 0,
            averageResponseTime: metrics.responseTime.count > 0 ? metrics.responseTime.total / metrics.responseTime.count : 0,
            errorRate: metrics.errorRate.total > 0 ? metrics.errorRate.errors / metrics.errorRate.total : 0,
            qualityScore: metrics.qualityScore.count > 0 ? metrics.qualityScore.total / metrics.qualityScore.count : 0,
            segmentation: {
                byUserSegment: Object.fromEntries(metrics.segmentation.byUserSegment),
                bySuggestionType: Object.fromEntries(metrics.segmentation.bySuggestionType),
                byDeviceType: Object.fromEntries(metrics.segmentation.byDeviceType)
            },
            sampleSize: feedbackBatch.length
        };
    }

    updateSegmentationMetrics(segmentation, metadata) {
        // Segmentação por usuário
        if (metadata.userSegment) {
            const segment = metadata.userSegment;
            if (!segmentation.byUserSegment.has(segment)) {
                segmentation.byUserSegment.set(segment, { count: 0, totalRating: 0 });
            }
            const segmentData = segmentation.byUserSegment.get(segment);
            segmentData.count++;
            if (metadata.rating !== undefined) {
                segmentData.totalRating += metadata.rating;
            }
        }

        // Segmentação por tipo de sugestão
        if (metadata.suggestionType) {
            const type = metadata.suggestionType;
            if (!segmentation.bySuggestionType.has(type)) {
                segmentation.bySuggestionType.set(type, { count: 0, totalRating: 0 });
            }
            const typeData = segmentation.bySuggestionType.get(type);
            typeData.count++;
            if (metadata.rating !== undefined) {
                typeData.totalRating += metadata.rating;
            }
        }

        // Segmentação por dispositivo
        if (metadata.deviceType) {
            const device = metadata.deviceType;
            if (!segmentation.byDeviceType.has(device)) {
                segmentation.byDeviceType.set(device, { count: 0, totalRating: 0 });
            }
            const deviceData = segmentation.byDeviceType.get(device);
            deviceData.count++;
            if (metadata.rating !== undefined) {
                deviceData.totalRating += metadata.rating;
            }
        }
    }

    async updateKPIs(batchMetrics) {
        const timestamp = batchMetrics.timestamp;

        // KPIs principais
        const kpis = {
            timestamp,
            accuracy: batchMetrics.metrics.accuracy,
            userSatisfaction: batchMetrics.metrics.userSatisfaction,
            averageResponseTime: batchMetrics.metrics.averageResponseTime,
            errorRate: batchMetrics.metrics.errorRate,
            qualityScore: batchMetrics.metrics.qualityScore,
            feedbackVolume: batchMetrics.size,

            // KPIs derivados
            overallPerformance: this.calculateOverallPerformance(batchMetrics.metrics),
            userEngagement: this.calculateUserEngagement(batchMetrics.metrics),
            systemReliability: this.calculateSystemReliability(batchMetrics.metrics)
        };

        this.kpis.set(timestamp, kpis);

        // Manter apenas KPIs recentes
        this.cleanupOldKPIs();

        this.emit('kpisUpdated', kpis);
    }

    calculateOverallPerformance(metrics) {
        // Combinar múltiplas métricas em um score geral
        const weights = {
            accuracy: 0.3,
            userSatisfaction: 0.4,
            qualityScore: 0.2,
            errorRate: -0.1 // Peso negativo para taxa de erro
        };

        let score = 0;
        let totalWeight = 0;

        if (metrics.accuracy > 0) {
            score += metrics.accuracy * weights.accuracy;
            totalWeight += weights.accuracy;
        }

        if (metrics.userSatisfaction > 0) {
            score += (metrics.userSatisfaction / 5) * weights.userSatisfaction; // Normalizar para 0-1
            totalWeight += weights.userSatisfaction;
        }

        if (metrics.qualityScore > 0) {
            score += metrics.qualityScore * weights.qualityScore;
            totalWeight += weights.qualityScore;
        }

        if (metrics.errorRate >= 0) {
            score += (1 - metrics.errorRate) * Math.abs(weights.errorRate);
            totalWeight += Math.abs(weights.errorRate);
        }

        return totalWeight > 0 ? score / totalWeight : 0;
    }

    calculateUserEngagement(metrics) {
        // Baseado em volume de feedback e qualidade das respostas
        const baseEngagement = Math.min(metrics.sampleSize / 100, 1); // Normalizar volume
        const qualityFactor = metrics.qualityScore || 0.5;
        const satisfactionFactor = metrics.userSatisfaction ? (metrics.userSatisfaction / 5) : 0.5;

        return (baseEngagement * 0.4 + qualityFactor * 0.3 + satisfactionFactor * 0.3);
    }

    calculateSystemReliability(metrics) {
        // Baseado em tempo de resposta e taxa de erro
        const responseTimeFactor = metrics.averageResponseTime > 0 ?
            Math.max(0, 1 - (metrics.averageResponseTime / 5000)) : 1; // 5s como referência
        const errorFactor = 1 - metrics.errorRate;

        return (responseTimeFactor * 0.5 + errorFactor * 0.5);
    }

    async updateTrends(batchMetrics) {
        const metricNames = ['accuracy', 'userSatisfaction', 'averageResponseTime', 'errorRate', 'feedbackVolume'];

        for (const metricName of metricNames) {
            if (!this.trends.has(metricName)) {
                this.trends.set(metricName, []);
            }

            const trendData = this.trends.get(metricName);
            const value = metricName === 'feedbackVolume' ?
                batchMetrics.size : batchMetrics.metrics[metricName];

            trendData.push({
                timestamp: batchMetrics.timestamp,
                value: value || 0
            });

            // Manter apenas últimos 100 pontos
            if (trendData.length > 100) {
                trendData.shift();
            }
        }
    }

    async getCurrentPerformance() {
        // Calcular performance atual baseada em métricas em tempo real e última agregação
        const latestKPI = Array.from(this.kpis.values()).slice(-1)[0];
        const realTime = this.realTimeMetrics;

        return {
            accuracy: latestKPI?.accuracy || 0,
            userSatisfaction: realTime.feedbackCount > 0 ?
                realTime.totalRating / realTime.feedbackCount : 0,
            averageResponseTime: realTime.feedbackCount > 0 ?
                realTime.totalResponseTime / realTime.feedbackCount : 0,
            errorRate: realTime.feedbackCount > 0 ?
                realTime.errors / realTime.feedbackCount : 0,
            feedbackVolume: realTime.feedbackCount,
            overallPerformance: latestKPI?.overallPerformance || 0,
            driftScore: 0, // Será preenchido pelo DriftDetector
            lastUpdate: realTime.lastUpdate
        };
    }

    async checkAlertThresholds(currentPerformance) {
        const alerts = [];

        // Verificar accuracy
        if (currentPerformance.accuracy < this.config.alertThresholds.accuracy) {
            alerts.push({
                type: 'accuracy_drop',
                severity: 'high',
                message: `Accuracy abaixo do threshold: ${currentPerformance.accuracy.toFixed(3)} < ${this.config.alertThresholds.accuracy}`,
                value: currentPerformance.accuracy,
                threshold: this.config.alertThresholds.accuracy,
                timestamp: Date.now()
            });
        }

        // Verificar satisfação do usuário
        if (currentPerformance.userSatisfaction < this.config.alertThresholds.userSatisfaction) {
            alerts.push({
                type: 'user_satisfaction_drop',
                severity: 'high',
                message: `Satisfação do usuário abaixo do threshold: ${currentPerformance.userSatisfaction.toFixed(2)} < ${this.config.alertThresholds.userSatisfaction}`,
                value: currentPerformance.userSatisfaction,
                threshold: this.config.alertThresholds.userSatisfaction,
                timestamp: Date.now()
            });
        }

        // Verificar tempo de resposta
        if (currentPerformance.averageResponseTime > this.config.alertThresholds.responseTime) {
            alerts.push({
                type: 'response_time_high',
                severity: 'medium',
                message: `Tempo de resposta acima do threshold: ${currentPerformance.averageResponseTime.toFixed(0)}ms > ${this.config.alertThresholds.responseTime}ms`,
                value: currentPerformance.averageResponseTime,
                threshold: this.config.alertThresholds.responseTime,
                timestamp: Date.now()
            });
        }

        // Verificar taxa de erro
        if (currentPerformance.errorRate > this.config.alertThresholds.errorRate) {
            alerts.push({
                type: 'error_rate_high',
                severity: 'critical',
                message: `Taxa de erro acima do threshold: ${(currentPerformance.errorRate * 100).toFixed(1)}% > ${(this.config.alertThresholds.errorRate * 100)}%`,
                value: currentPerformance.errorRate,
                threshold: this.config.alertThresholds.errorRate,
                timestamp: Date.now()
            });
        }

        // Armazenar e emitir alertas
        for (const alert of alerts) {
            this.alerts.push(alert);
            this.emit('alertGenerated', alert);
            logger.warn(`ALERTA: ${alert.message}`);
        }

        // Limpar alertas antigos
        this.cleanupOldAlerts();
    }

    async getHistoricalTrends() {
        const trends = {};

        for (const [metricName, data] of this.trends) {
            trends[metricName] = data.slice(); // Cópia dos dados
        }

        return trends;
    }

    async getComprehensiveReport() {
        const currentPerformance = await this.getCurrentPerformance();
        const trends = await this.getHistoricalTrends();
        const recentKPIs = Array.from(this.kpis.values()).slice(-10);
        const recentAlerts = this.alerts.slice(-20);

        return {
            currentPerformance,
            trends,
            kpis: recentKPIs,
            alerts: recentAlerts,
            summary: {
                totalMetrics: this.metrics.size,
                totalKPIs: this.kpis.size,
                totalAlerts: this.alerts.length,
                dataRetentionDays: this.config.metricsRetention / (24 * 60 * 60 * 1000),
                lastUpdate: currentPerformance.lastUpdate
            },
            segmentation: this.getSegmentationAnalysis(),
            performance: {
                overallScore: currentPerformance.overallPerformance,
                trend: this.calculateOverallTrend(),
                benchmarks: this.getBenchmarkComparison()
            }
        };
    }

    getSegmentationAnalysis() {
        // Analisar performance por segmento
        const latestBatch = Array.from(this.aggregatedMetrics.values()).slice(-1)[0];

        if (!latestBatch || !latestBatch.metrics.segmentation) {
            return {};
        }

        const segmentation = latestBatch.metrics.segmentation;
        const analysis = {};

        // Análise por segmento de usuário
        if (segmentation.byUserSegment) {
            analysis.userSegments = Object.entries(segmentation.byUserSegment).map(([segment, data]) => ({
                segment,
                count: data.count,
                averageRating: data.count > 0 ? data.totalRating / data.count : 0,
                percentage: (data.count / latestBatch.size * 100).toFixed(1)
            }));
        }

        // Análise por tipo de sugestão
        if (segmentation.bySuggestionType) {
            analysis.suggestionTypes = Object.entries(segmentation.bySuggestionType).map(([type, data]) => ({
                type,
                count: data.count,
                averageRating: data.count > 0 ? data.totalRating / data.count : 0,
                percentage: (data.count / latestBatch.size * 100).toFixed(1)
            }));
        }

        return analysis;
    }

    calculateOverallTrend() {
        const overallPerformanceTrend = this.trends.get('overallPerformance') || [];

        if (overallPerformanceTrend.length < 2) {
            return 'stable';
        }

        const recent = overallPerformanceTrend.slice(-5);
        const slope = this.calculateTrendSlope(recent);

        if (slope > 0.01) return 'improving';
        if (slope < -0.01) return 'declining';
        return 'stable';
    }

    calculateTrendSlope(dataPoints) {
        if (dataPoints.length < 2) return 0;

        const n = dataPoints.length;
        const sumX = dataPoints.reduce((sum, _, i) => sum + i, 0);
        const sumY = dataPoints.reduce((sum, point) => sum + point.value, 0);
        const sumXY = dataPoints.reduce((sum, point, i) => sum + i * point.value, 0);
        const sumX2 = dataPoints.reduce((sum, _, i) => sum + i * i, 0);

        return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    }

    getBenchmarkComparison() {
        // Benchmarks da indústria (valores exemplo)
        const benchmarks = {
            accuracy: 0.85,
            userSatisfaction: 4.0,
            responseTime: 1500,
            errorRate: 0.02
        };

        const current = this.realTimeMetrics;
        const currentPerformance = {
            accuracy: 0.8, // Placeholder - seria calculado
            userSatisfaction: current.feedbackCount > 0 ? current.totalRating / current.feedbackCount : 0,
            responseTime: current.feedbackCount > 0 ? current.totalResponseTime / current.feedbackCount : 0,
            errorRate: current.feedbackCount > 0 ? current.errors / current.feedbackCount : 0
        };

        return Object.entries(benchmarks).map(([metric, benchmark]) => ({
            metric,
            current: currentPerformance[metric],
            benchmark,
            comparison: currentPerformance[metric] >= benchmark ? 'above' : 'below',
            difference: ((currentPerformance[metric] / benchmark - 1) * 100).toFixed(1)
        }));
    }

    startAggregation() {
        this.aggregationTimer = setInterval(async () => {
            try {
                await this.performPeriodicAggregation();
            } catch (error) {
                logger.error('Erro na agregação periódica:', error);
            }
        }, this.config.aggregationInterval);
    }

    async performPeriodicAggregation() {
        // Agregar métricas individuais em batches
        const recentMetrics = Array.from(this.metrics.entries())
            .filter(([_, metric]) => !metric.processed)
            .slice(0, 100); // Processar até 100 métricas por vez

        if (recentMetrics.length === 0) {
            return;
        }

        const feedbackBatch = recentMetrics.map(([_, metric]) => metric.data);
        await this.processBatch(feedbackBatch);

        // Marcar métricas como processadas
        for (const [metricId, _] of recentMetrics) {
            const metric = this.metrics.get(metricId);
            if (metric) {
                metric.processed = true;
            }
        }

        // Cleanup periódico
        this.cleanupOldMetrics();
    }

    cleanupOldMetrics() {
        const cutoffTime = Date.now() - this.config.metricsRetention;

        for (const [metricId, metric] of this.metrics) {
            if (metric.timestamp < cutoffTime) {
                this.metrics.delete(metricId);
            }
        }
    }

    cleanupOldKPIs() {
        const cutoffTime = Date.now() - this.config.metricsRetention;

        for (const [timestamp, _] of this.kpis) {
            if (timestamp < cutoffTime) {
                this.kpis.delete(timestamp);
            }
        }
    }

    cleanupOldAlerts() {
        const cutoffTime = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 dias

        this.alerts = this.alerts.filter(alert => alert.timestamp >= cutoffTime);
    }

    // Public API methods
    getMetrics(limit = 100) {
        return Array.from(this.metrics.values()).slice(-limit);
    }

    getKPIs(limit = 50) {
        return Array.from(this.kpis.values()).slice(-limit);
    }

    getAlerts(severity = null, limit = 20) {
        let alerts = this.alerts.slice(-limit);

        if (severity) {
            alerts = alerts.filter(alert => alert.severity === severity);
        }

        return alerts;
    }

    async exportMetrics(format = 'json') {
        const data = {
            metrics: Array.from(this.metrics.values()),
            kpis: Array.from(this.kpis.values()),
            trends: Object.fromEntries(this.trends),
            alerts: this.alerts
        };

        if (format === 'json') {
            return JSON.stringify(data, null, 2);
        }

        // Outros formatos podem ser implementados
        return data;
    }
}

exports.MetricsCollector = MetricsCollector;