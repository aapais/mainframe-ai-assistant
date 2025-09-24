/**
 * Rastreador de Métricas
 *
 * Sistema para coleta, processamento e monitoramento
 * de métricas de performance do sistema de aprendizado contínuo.
 */

const EventEmitter = require('events');
const logger = require('../../utils/logger');

class MetricsTracker extends EventEmitter {
    constructor(config = {}) {
        super();

        this.config = {
            // Configurações de coleta
            collectionInterval: config.collectionInterval || 60000, // 1 minuto
            retentionPeriod: config.retentionPeriod || 90 * 24 * 60 * 60 * 1000, // 90 dias
            batchSize: config.batchSize || 1000,

            // Configurações de agregação
            aggregationLevels: config.aggregationLevels || ['minute', 'hour', 'day', 'week'],
            aggregationFunctions: config.aggregationFunctions || ['sum', 'avg', 'min', 'max', 'count'],

            // Configurações de alertas
            alertThresholds: config.alertThresholds || {},
            alertEnabled: config.alertEnabled || true,

            // Configurações de storage
            storageProvider: config.storageProvider || 'memory',

            ...config
        };

        // Métricas em tempo real
        this.realtimeMetrics = new Map();

        // Buffers de coleta
        this.metricsBuffer = [];

        // Métricas agregadas
        this.aggregatedMetrics = new Map();

        // Sistema de alertas
        this.alertStates = new Map();

        // Contadores e estatísticas
        this.counters = {
            totalMetricsCollected: 0,
            totalAlertsTriggered: 0,
            totalAggregations: 0
        };

        // Definir métricas padrão
        this.defineStandardMetrics();
    }

    /**
     * Inicializa o rastreador de métricas
     */
    async initialize() {
        try {
            logger.info('Inicializando rastreador de métricas');

            // Configurar storage
            await this.setupStorage();

            // Inicializar coletores
            await this.initializeCollectors();

            // Carregar dados históricos
            await this.loadHistoricalData();

            // Agendar coletas periódicas
            this.schedulePeriodicCollection();

            // Agendar agregações
            this.scheduleAggregations();

            logger.info('Rastreador de métricas inicializado com sucesso');

        } catch (error) {
            logger.error('Erro ao inicializar rastreador de métricas:', error);
            throw error;
        }
    }

    /**
     * Registra uma métrica
     */
    recordMetric(name, value, tags = {}, timestamp = new Date()) {
        try {
            const metric = {
                name,
                value,
                tags,
                timestamp,
                id: this.generateMetricId()
            };

            // Validar métrica
            this.validateMetric(metric);

            // Adicionar ao buffer
            this.metricsBuffer.push(metric);

            // Atualizar métricas em tempo real
            this.updateRealtimeMetric(metric);

            // Verificar alertas
            this.checkAlerts(metric);

            // Flush se buffer está cheio
            if (this.metricsBuffer.length >= this.config.batchSize) {
                this.flushMetricsBuffer();
            }

            this.counters.totalMetricsCollected++;

            this.emit('metricRecorded', metric);

        } catch (error) {
            logger.error('Erro ao registrar métrica:', error);
        }
    }

    /**
     * Registra múltiplas métricas
     */
    recordMetrics(metrics) {
        for (const metric of metrics) {
            this.recordMetric(metric.name, metric.value, metric.tags, metric.timestamp);
        }
    }

    /**
     * Incrementa um contador
     */
    incrementCounter(name, tags = {}, amount = 1) {
        this.recordMetric(name, amount, { ...tags, type: 'counter' });
    }

    /**
     * Registra um gauge (valor instantâneo)
     */
    recordGauge(name, value, tags = {}) {
        this.recordMetric(name, value, { ...tags, type: 'gauge' });
    }

    /**
     * Registra duração de uma operação
     */
    recordDuration(name, duration, tags = {}) {
        this.recordMetric(name, duration, { ...tags, type: 'duration', unit: 'ms' });
    }

    /**
     * Registra taxa (eventos por unidade de tempo)
     */
    recordRate(name, rate, tags = {}) {
        this.recordMetric(name, rate, { ...tags, type: 'rate' });
    }

    /**
     * Obtém métricas em tempo real
     */
    getRealtimeMetrics(namePattern = null) {
        if (namePattern) {
            const regex = new RegExp(namePattern);
            const filtered = new Map();

            for (const [name, metric] of this.realtimeMetrics) {
                if (regex.test(name)) {
                    filtered.set(name, metric);
                }
            }

            return Object.fromEntries(filtered);
        }

        return Object.fromEntries(this.realtimeMetrics);
    }

    /**
     * Obtém métricas agregadas
     */
    async getAggregatedMetrics(query) {
        const {
            names = [],
            tags = {},
            startTime,
            endTime,
            aggregationLevel = 'hour',
            aggregationFunction = 'avg'
        } = query;

        const results = [];

        for (const name of names) {
            const metricData = await this.getAggregatedMetricData(
                name,
                tags,
                startTime,
                endTime,
                aggregationLevel,
                aggregationFunction
            );

            results.push({
                name,
                aggregationLevel,
                aggregationFunction,
                data: metricData
            });
        }

        return results;
    }

    /**
     * Obtém histórico de métricas
     */
    async getMetricHistory(name, tags = {}, startTime, endTime, limit = 1000) {
        // Implementar busca no storage
        return await this.queryMetricHistory(name, tags, startTime, endTime, limit);
    }

    /**
     * Calcula estatísticas de uma métrica
     */
    async calculateMetricStatistics(name, tags = {}, startTime, endTime) {
        const data = await this.getMetricHistory(name, tags, startTime, endTime);

        if (data.length === 0) {
            return null;
        }

        const values = data.map(d => d.value);

        return {
            count: values.length,
            sum: values.reduce((a, b) => a + b, 0),
            mean: values.reduce((a, b) => a + b, 0) / values.length,
            min: Math.min(...values),
            max: Math.max(...values),
            median: this.calculateMedian(values),
            percentiles: {
                p50: this.calculatePercentile(values, 0.5),
                p90: this.calculatePercentile(values, 0.9),
                p95: this.calculatePercentile(values, 0.95),
                p99: this.calculatePercentile(values, 0.99)
            },
            standardDeviation: this.calculateStandardDeviation(values),
            variance: this.calculateVariance(values)
        };
    }

    /**
     * Configura alerta para uma métrica
     */
    configureAlert(alertConfig) {
        const {
            name,
            metricName,
            condition,
            threshold,
            tags = {},
            cooldownPeriod = 300000, // 5 minutos
            severity = 'medium',
            description = ''
        } = alertConfig;

        const alert = {
            name,
            metricName,
            condition, // 'greater_than', 'less_than', 'equals', 'not_equals'
            threshold,
            tags,
            cooldownPeriod,
            severity,
            description,
            isActive: true,
            lastTriggered: null,
            triggerCount: 0
        };

        this.alertStates.set(name, alert);

        logger.info(`Alerta configurado: ${name} para métrica ${metricName}`);

        return alert;
    }

    /**
     * Remove alerta
     */
    removeAlert(alertName) {
        this.alertStates.delete(alertName);
        logger.info(`Alerta removido: ${alertName}`);
    }

    /**
     * Lista alertas configurados
     */
    getAlerts() {
        return Object.fromEntries(this.alertStates);
    }

    /**
     * Força agregação de métricas
     */
    async forceAggregation(level = 'hour') {
        logger.info(`Forçando agregação de nível: ${level}`);

        const endTime = new Date();
        const startTime = this.getAggregationStartTime(level, endTime);

        await this.performAggregation(level, startTime, endTime);

        this.emit('aggregationCompleted', { level, startTime, endTime });
    }

    /**
     * Exporta métricas
     */
    async exportMetrics(query, format = 'json') {
        const {
            names = [],
            tags = {},
            startTime,
            endTime,
            includeRaw = false,
            includeAggregated = true
        } = query;

        const exportData = {
            metadata: {
                exportTime: new Date(),
                query,
                format
            },
            metrics: {}
        };

        for (const name of names) {
            exportData.metrics[name] = {};

            if (includeRaw) {
                exportData.metrics[name].raw = await this.getMetricHistory(
                    name, tags, startTime, endTime
                );
            }

            if (includeAggregated) {
                exportData.metrics[name].aggregated = {};

                for (const level of this.config.aggregationLevels) {
                    exportData.metrics[name].aggregated[level] = await this.getAggregatedMetricData(
                        name, tags, startTime, endTime, level, 'avg'
                    );
                }
            }
        }

        // Converter para formato solicitado
        return this.formatExportData(exportData, format);
    }

    /**
     * Obtém dashboard de métricas principais
     */
    async getDashboard() {
        const now = new Date();
        const lastHour = new Date(now.getTime() - 60 * 60 * 1000);
        const lastDay = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        const dashboard = {
            timestamp: now,
            summary: {
                totalMetrics: this.counters.totalMetricsCollected,
                activeAlerts: Array.from(this.alertStates.values()).filter(a => a.isActive).length,
                realtimeMetricsCount: this.realtimeMetrics.size
            },
            realtimeMetrics: this.getRealtimeMetrics(),
            trends: {},
            alerts: []
        };

        // Calcular tendências principais
        const mainMetrics = [
            'learning.cycle_duration',
            'learning.success_rate',
            'feedback.satisfaction_avg',
            'models.accuracy_avg',
            'incidents.resolution_time_avg'
        ];

        for (const metric of mainMetrics) {
            const hourlyStats = await this.calculateMetricStatistics(metric, {}, lastHour, now);
            const dailyStats = await this.calculateMetricStatistics(metric, {}, lastDay, now);

            dashboard.trends[metric] = {
                lastHour: hourlyStats,
                lastDay: dailyStats
            };
        }

        // Incluir alertas ativos
        for (const alert of this.alertStates.values()) {
            if (alert.lastTriggered && (now - alert.lastTriggered) < 24 * 60 * 60 * 1000) {
                dashboard.alerts.push({
                    name: alert.name,
                    severity: alert.severity,
                    lastTriggered: alert.lastTriggered,
                    description: alert.description
                });
            }
        }

        return dashboard;
    }

    // Métodos internos

    defineStandardMetrics() {
        // Definir métricas padrão do sistema
        this.standardMetrics = {
            // Métricas de aprendizado
            'learning.cycle_duration': { type: 'duration', unit: 'ms' },
            'learning.cycles_completed': { type: 'counter' },
            'learning.success_rate': { type: 'gauge', unit: 'percentage' },

            // Métricas de feedback
            'feedback.total_collected': { type: 'counter' },
            'feedback.satisfaction_avg': { type: 'gauge', unit: 'score' },
            'feedback.operator_feedback_count': { type: 'counter' },
            'feedback.user_feedback_count': { type: 'counter' },

            // Métricas de modelos
            'models.retrained_count': { type: 'counter' },
            'models.accuracy_avg': { type: 'gauge', unit: 'percentage' },
            'models.confidence_avg': { type: 'gauge', unit: 'score' },
            'models.deployment_success_rate': { type: 'gauge', unit: 'percentage' },

            // Métricas de padrões
            'patterns.new_types_discovered': { type: 'counter' },
            'patterns.behavior_changes_detected': { type: 'counter' },
            'patterns.correlations_found': { type: 'counter' },
            'patterns.trends_identified': { type: 'counter' },

            // Métricas de incidentes
            'incidents.total_processed': { type: 'counter' },
            'incidents.resolution_time_avg': { type: 'gauge', unit: 'minutes' },
            'incidents.success_rate': { type: 'gauge', unit: 'percentage' },
            'incidents.reoccurrence_rate': { type: 'gauge', unit: 'percentage' },

            // Métricas de A/B testing
            'abtests.active_count': { type: 'gauge' },
            'abtests.completed_count': { type: 'counter' },
            'abtests.success_rate': { type: 'gauge', unit: 'percentage' },

            // Métricas de sistema
            'system.memory_usage': { type: 'gauge', unit: 'mb' },
            'system.cpu_usage': { type: 'gauge', unit: 'percentage' },
            'system.error_rate': { type: 'gauge', unit: 'percentage' },
            'system.response_time_avg': { type: 'gauge', unit: 'ms' }
        };
    }

    validateMetric(metric) {
        if (!metric.name) {
            throw new Error('Nome da métrica é obrigatório');
        }

        if (typeof metric.value !== 'number') {
            throw new Error('Valor da métrica deve ser numérico');
        }

        if (isNaN(metric.value) || !isFinite(metric.value)) {
            throw new Error('Valor da métrica deve ser um número válido');
        }
    }

    updateRealtimeMetric(metric) {
        const key = this.getMetricKey(metric.name, metric.tags);

        if (!this.realtimeMetrics.has(key)) {
            this.realtimeMetrics.set(key, {
                name: metric.name,
                tags: metric.tags,
                value: metric.value,
                lastUpdated: metric.timestamp,
                count: 1,
                sum: metric.value,
                min: metric.value,
                max: metric.value
            });
        } else {
            const existing = this.realtimeMetrics.get(key);
            existing.value = metric.value;
            existing.lastUpdated = metric.timestamp;
            existing.count++;
            existing.sum += metric.value;
            existing.min = Math.min(existing.min, metric.value);
            existing.max = Math.max(existing.max, metric.value);
        }
    }

    checkAlerts(metric) {
        if (!this.config.alertEnabled) return;

        for (const alert of this.alertStates.values()) {
            if (!alert.isActive) continue;
            if (alert.metricName !== metric.name) continue;

            // Verificar se tags coincidem
            if (!this.tagsMatch(metric.tags, alert.tags)) continue;

            // Verificar cooldown
            if (alert.lastTriggered &&
                (metric.timestamp - alert.lastTriggered) < alert.cooldownPeriod) {
                continue;
            }

            // Verificar condição
            const shouldTrigger = this.evaluateAlertCondition(
                metric.value,
                alert.condition,
                alert.threshold
            );

            if (shouldTrigger) {
                this.triggerAlert(alert, metric);
            }
        }
    }

    triggerAlert(alert, metric) {
        alert.lastTriggered = metric.timestamp;
        alert.triggerCount++;

        const alertEvent = {
            alertName: alert.name,
            metricName: alert.metricName,
            metricValue: metric.value,
            threshold: alert.threshold,
            condition: alert.condition,
            severity: alert.severity,
            description: alert.description,
            timestamp: metric.timestamp,
            tags: metric.tags
        };

        this.counters.totalAlertsTriggered++;

        logger.warn(`Alerta disparado: ${alert.name}`, alertEvent);

        this.emit('alertTriggered', alertEvent);
    }

    evaluateAlertCondition(value, condition, threshold) {
        switch (condition) {
            case 'greater_than':
                return value > threshold;
            case 'less_than':
                return value < threshold;
            case 'equals':
                return Math.abs(value - threshold) < 0.0001; // Para números com ponto flutuante
            case 'not_equals':
                return Math.abs(value - threshold) >= 0.0001;
            case 'greater_or_equal':
                return value >= threshold;
            case 'less_or_equal':
                return value <= threshold;
            default:
                return false;
        }
    }

    tagsMatch(metricTags, alertTags) {
        for (const [key, value] of Object.entries(alertTags)) {
            if (metricTags[key] !== value) {
                return false;
            }
        }
        return true;
    }

    async flushMetricsBuffer() {
        if (this.metricsBuffer.length === 0) return;

        try {
            const batch = [...this.metricsBuffer];
            this.metricsBuffer = [];

            await this.persistMetrics(batch);

            logger.debug(`${batch.length} métricas persistidas`);

        } catch (error) {
            logger.error('Erro ao fazer flush das métricas:', error);
            // Recolocar no buffer em caso de erro
            this.metricsBuffer.unshift(...batch);
        }
    }

    schedulePeriodicCollection() {
        this.collectionInterval = setInterval(() => {
            this.collectSystemMetrics();
        }, this.config.collectionInterval);
    }

    scheduleAggregations() {
        // Agendar agregações em diferentes níveis
        const schedules = {
            minute: 60 * 1000,      // A cada minuto
            hour: 60 * 60 * 1000,   // A cada hora
            day: 24 * 60 * 60 * 1000, // A cada dia
            week: 7 * 24 * 60 * 60 * 1000 // A cada semana
        };

        for (const [level, interval] of Object.entries(schedules)) {
            setInterval(() => {
                this.performAggregation(level);
            }, interval);
        }
    }

    async collectSystemMetrics() {
        try {
            // Coletar métricas do sistema
            const memoryUsage = process.memoryUsage();
            const cpuUsage = process.cpuUsage();

            this.recordGauge('system.memory_usage', memoryUsage.heapUsed / 1024 / 1024);
            this.recordGauge('system.memory_total', memoryUsage.heapTotal / 1024 / 1024);

            // Coletar métricas específicas do aprendizado contínuo
            this.recordGauge('learning.active_tests', this.getActiveABTestsCount());
            this.recordGauge('learning.realtime_metrics_count', this.realtimeMetrics.size);

        } catch (error) {
            logger.error('Erro ao coletar métricas do sistema:', error);
        }
    }

    async performAggregation(level, startTime = null, endTime = null) {
        try {
            if (!startTime || !endTime) {
                endTime = new Date();
                startTime = this.getAggregationStartTime(level, endTime);
            }

            logger.debug(`Executando agregação ${level}: ${startTime.toISOString()} - ${endTime.toISOString()}`);

            const metrics = await this.getRawMetricsForPeriod(startTime, endTime);
            const aggregated = this.aggregateMetrics(metrics, level);

            await this.persistAggregatedMetrics(aggregated, level);

            this.counters.totalAggregations++;

            this.emit('aggregationCompleted', { level, startTime, endTime, count: aggregated.length });

        } catch (error) {
            logger.error(`Erro na agregação ${level}:`, error);
        }
    }

    getAggregationStartTime(level, endTime) {
        const time = new Date(endTime);

        switch (level) {
            case 'minute':
                time.setMinutes(time.getMinutes() - 1);
                break;
            case 'hour':
                time.setHours(time.getHours() - 1);
                break;
            case 'day':
                time.setDate(time.getDate() - 1);
                break;
            case 'week':
                time.setDate(time.getDate() - 7);
                break;
            default:
                time.setMinutes(time.getMinutes() - 1);
        }

        return time;
    }

    aggregateMetrics(metrics, level) {
        const grouped = new Map();

        // Agrupar métricas por nome e tags
        for (const metric of metrics) {
            const key = this.getMetricKey(metric.name, metric.tags);

            if (!grouped.has(key)) {
                grouped.set(key, {
                    name: metric.name,
                    tags: metric.tags,
                    values: [],
                    timestamps: []
                });
            }

            grouped.get(key).values.push(metric.value);
            grouped.get(key).timestamps.push(metric.timestamp);
        }

        // Calcular agregações
        const aggregated = [];

        for (const group of grouped.values()) {
            if (group.values.length === 0) continue;

            const aggregatedMetric = {
                name: group.name,
                tags: group.tags,
                level,
                startTime: Math.min(...group.timestamps),
                endTime: Math.max(...group.timestamps),
                count: group.values.length,
                sum: group.values.reduce((a, b) => a + b, 0),
                avg: group.values.reduce((a, b) => a + b, 0) / group.values.length,
                min: Math.min(...group.values),
                max: Math.max(...group.values),
                median: this.calculateMedian(group.values),
                p95: this.calculatePercentile(group.values, 0.95),
                stddev: this.calculateStandardDeviation(group.values)
            };

            aggregated.push(aggregatedMetric);
        }

        return aggregated;
    }

    // Métodos utilitários

    generateMetricId() {
        return `metric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    getMetricKey(name, tags) {
        const tagString = Object.entries(tags)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, value]) => `${key}=${value}`)
            .join(',');

        return `${name}${tagString ? `|${tagString}` : ''}`;
    }

    calculateMedian(values) {
        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);

        return sorted.length % 2 === 0 ?
            (sorted[mid - 1] + sorted[mid]) / 2 :
            sorted[mid];
    }

    calculatePercentile(values, percentile) {
        const sorted = [...values].sort((a, b) => a - b);
        const index = Math.ceil(sorted.length * percentile) - 1;
        return sorted[index];
    }

    calculateStandardDeviation(values) {
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
        return Math.sqrt(variance);
    }

    calculateVariance(values) {
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        return values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
    }

    formatExportData(data, format) {
        switch (format.toLowerCase()) {
            case 'json':
                return JSON.stringify(data, null, 2);
            case 'csv':
                return this.convertToCSV(data);
            case 'prometheus':
                return this.convertToPrometheusFormat(data);
            default:
                return data;
        }
    }

    convertToCSV(data) {
        // Implementar conversão para CSV
        const lines = [];
        lines.push('timestamp,metric_name,value,tags');

        for (const [name, metricData] of Object.entries(data.metrics)) {
            if (metricData.raw) {
                for (const point of metricData.raw) {
                    const tagsStr = Object.entries(point.tags || {})
                        .map(([k, v]) => `${k}=${v}`)
                        .join(';');
                    lines.push(`${point.timestamp},${name},${point.value},"${tagsStr}"`);
                }
            }
        }

        return lines.join('\n');
    }

    convertToPrometheusFormat(data) {
        // Implementar conversão para formato Prometheus
        const lines = [];

        for (const [name, metricData] of Object.entries(data.metrics)) {
            if (metricData.raw) {
                const latest = metricData.raw[metricData.raw.length - 1];
                if (latest) {
                    const tagsStr = Object.entries(latest.tags || {})
                        .map(([k, v]) => `${k}="${v}"`)
                        .join(',');
                    lines.push(`${name.replace(/\./g, '_')}{${tagsStr}} ${latest.value}`);
                }
            }
        }

        return lines.join('\n');
    }

    getActiveABTestsCount() {
        // Implementar busca por testes A/B ativos
        return 0; // Placeholder
    }

    // Métodos de storage (implementar conforme provider)

    async setupStorage() {
        logger.info('Configurando storage de métricas');
    }

    async initializeCollectors() {
        logger.info('Inicializando coletores de métricas');
    }

    async loadHistoricalData() {
        logger.info('Carregando dados históricos');
    }

    async persistMetrics(metrics) {
        // Implementar persistência conforme provider
        logger.debug(`Persistindo ${metrics.length} métricas`);
    }

    async persistAggregatedMetrics(aggregated, level) {
        // Implementar persistência de métricas agregadas
        logger.debug(`Persistindo ${aggregated.length} métricas agregadas (${level})`);
    }

    async getRawMetricsForPeriod(startTime, endTime) {
        // Implementar busca de métricas brutas
        return [];
    }

    async getAggregatedMetricData(name, tags, startTime, endTime, level, func) {
        // Implementar busca de métricas agregadas
        return [];
    }

    async queryMetricHistory(name, tags, startTime, endTime, limit) {
        // Implementar busca histórica
        return [];
    }

    async shutdown() {
        logger.info('Finalizando rastreador de métricas');

        // Fazer flush final
        await this.flushMetricsBuffer();

        // Limpar intervalos
        if (this.collectionInterval) {
            clearInterval(this.collectionInterval);
        }
    }

    getStatus() {
        return {
            isActive: true,
            counters: { ...this.counters },
            realtimeMetricsCount: this.realtimeMetrics.size,
            activeAlertsCount: Array.from(this.alertStates.values()).filter(a => a.isActive).length,
            bufferSize: this.metricsBuffer.length
        };
    }
}

module.exports = MetricsTracker;