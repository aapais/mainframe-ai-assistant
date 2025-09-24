/**
 * CategorizationIntegration - Integração com Sistema de Gestão de Incidentes
 *
 * Classe principal que orquestra a integração do sistema de categorização
 * automática com o sistema existente de gestão de incidentes.
 */

const TaxonomyManager = require('./TaxonomyManager');
const TechnologyClassifier = require('./TechnologyClassifier');
const TaggingService = require('./TaggingService');
const RoutingEngine = require('./RoutingEngine');

class CategorizationIntegration {
    constructor(options = {}) {
        this.config = {
            enableAutoClassification: options.enableAutoClassification !== false,
            enableAutoTagging: options.enableAutoTagging !== false,
            enableAutoRouting: options.enableAutoRouting !== false,
            enableWebhooks: options.enableWebhooks !== false,
            enableAuditLog: options.enableAuditLog !== false,
            ...options
        };

        // Inicializar componentes
        this.taxonomyManager = new TaxonomyManager();
        this.classifier = new TechnologyClassifier({
            minConfidence: this.config.minConfidence || 0.6
        });
        this.taggingService = new TaggingService({
            enableAutoTags: this.config.enableAutoTagging,
            enableManualTags: true
        });
        this.routingEngine = new RoutingEngine({
            enableAutoRouting: this.config.enableAutoRouting,
            enableLoadBalancing: true,
            enableEscalation: true
        });

        // Sistema de webhooks para integrações
        this.webhooks = new Map();
        this.eventListeners = new Map();

        // Histórico e auditoria
        this.auditLog = [];
        this.processedIncidents = new Map();

        // Métricas globais
        this.metrics = {
            totalProcessed: 0,
            successfulClassifications: 0,
            successfulRoutings: 0,
            averageProcessingTime: 0,
            errors: 0
        };

        this.initializeIntegrations();
    }

    /**
     * Inicializa integrações e configurações
     */
    initializeIntegrations() {
        // Configurar listeners de eventos
        this.setupEventListeners();

        // Configurar webhooks padrão
        this.setupDefaultWebhooks();

        // Configurar interceptadores
        this.setupInterceptors();
    }

    /**
     * Processa um incidente completo através de todo o pipeline
     */
    async processIncident(incidentData, options = {}) {
        const startTime = Date.now();
        const sessionId = this.generateSessionId();

        try {
            // Log de início
            this.logAudit('process_started', incidentData.id, { sessionId });

            // Validar dados do incidente
            this.validateIncidentData(incidentData);

            // 1. Classificação Automática
            let classificationResult = null;
            if (this.config.enableAutoClassification) {
                classificationResult = await this.performClassification(incidentData, sessionId);
            }

            // 2. Aplicação de Tags
            let taggingResult = null;
            if (this.config.enableAutoTagging && classificationResult) {
                taggingResult = await this.performTagging(incidentData, classificationResult, sessionId);
            }

            // 3. Roteamento Automático
            let routingResult = null;
            if (this.config.enableAutoRouting && classificationResult) {
                routingResult = await this.performRouting(incidentData, classificationResult, sessionId);
            }

            // 4. Consolidar resultado
            const finalResult = this.consolidateResults({
                incident: incidentData,
                classification: classificationResult,
                tagging: taggingResult,
                routing: routingResult,
                sessionId,
                processingTime: Date.now() - startTime
            });

            // 5. Executar webhooks
            if (this.config.enableWebhooks) {
                await this.executeWebhooks('incident_processed', finalResult);
            }

            // 6. Atualizar métricas
            this.updateGlobalMetrics(finalResult);

            // 7. Log final
            this.logAudit('process_completed', incidentData.id, {
                sessionId,
                success: true,
                processingTime: finalResult.processingTime
            });

            return finalResult;

        } catch (error) {
            const errorResult = this.handleProcessingError(incidentData, error, sessionId, Date.now() - startTime);

            this.logAudit('process_failed', incidentData.id, {
                sessionId,
                error: error.message,
                processingTime: Date.now() - startTime
            });

            return errorResult;
        }
    }

    /**
     * Executa classificação do incidente
     */
    async performClassification(incidentData, sessionId) {
        try {
            this.logAudit('classification_started', incidentData.id, { sessionId });

            const result = await this.classifier.classifyIncident(incidentData);

            this.logAudit('classification_completed', incidentData.id, {
                sessionId,
                primaryCategory: result.primaryCategory?.category,
                confidence: result.confidence
            });

            // Emitir evento
            this.emitEvent('classification_completed', {
                incidentId: incidentData.id,
                result,
                sessionId
            });

            return result;

        } catch (error) {
            this.logAudit('classification_failed', incidentData.id, {
                sessionId,
                error: error.message
            });

            throw new Error(`Classification failed: ${error.message}`);
        }
    }

    /**
     * Executa aplicação de tags
     */
    async performTagging(incidentData, classificationResult, sessionId) {
        try {
            this.logAudit('tagging_started', incidentData.id, { sessionId });

            const result = await this.taggingService.applyAutoTags(incidentData, classificationResult);

            this.logAudit('tagging_completed', incidentData.id, {
                sessionId,
                tagsApplied: result.applied,
                tagsSkipped: result.skipped
            });

            // Emitir evento
            this.emitEvent('tagging_completed', {
                incidentId: incidentData.id,
                result,
                sessionId
            });

            return result;

        } catch (error) {
            this.logAudit('tagging_failed', incidentData.id, {
                sessionId,
                error: error.message
            });

            throw new Error(`Tagging failed: ${error.message}`);
        }
    }

    /**
     * Executa roteamento do incidente
     */
    async performRouting(incidentData, classificationResult, sessionId) {
        try {
            this.logAudit('routing_started', incidentData.id, { sessionId });

            const result = await this.routingEngine.routeIncident(incidentData, classificationResult);

            this.logAudit('routing_completed', incidentData.id, {
                sessionId,
                teamId: result.routing.team.id,
                slaResponse: result.routing.sla.response,
                escalationRequired: result.routing.escalationRequired
            });

            // Emitir evento
            this.emitEvent('routing_completed', {
                incidentId: incidentData.id,
                result,
                sessionId
            });

            return result;

        } catch (error) {
            this.logAudit('routing_failed', incidentData.id, {
                sessionId,
                error: error.message
            });

            throw new Error(`Routing failed: ${error.message}`);
        }
    }

    /**
     * Consolida resultados de todos os componentes
     */
    consolidateResults(data) {
        const result = {
            incident: {
                id: data.incident.id,
                title: data.incident.title,
                description: data.incident.description,
                timestamp: data.incident.timestamp,
                source: data.incident.source
            },
            sessionId: data.sessionId,
            processingTime: data.processingTime,
            timestamp: new Date().toISOString(),
            results: {
                classification: data.classification ? {
                    primaryCategory: data.classification.primaryCategory,
                    confidence: data.classification.confidence,
                    method: 'hybrid',
                    classifications: data.classification.classifications
                } : null,
                tagging: data.tagging ? {
                    applied: data.tagging.applied,
                    tags: data.tagging.tags
                } : null,
                routing: data.routing ? {
                    team: data.routing.routing.team,
                    sla: data.routing.routing.sla,
                    escalationRequired: data.routing.routing.escalationRequired,
                    notifications: data.routing.notifications
                } : null
            },
            success: true,
            error: null
        };

        // Armazenar no cache
        this.processedIncidents.set(data.incident.id, result);

        return result;
    }

    /**
     * Adiciona tag manual a um incidente
     */
    async addManualTag(incidentId, tagId, userId, reason = '') {
        try {
            this.logAudit('manual_tag_added', incidentId, {
                tagId,
                userId,
                reason
            });

            const result = await this.taggingService.addManualTag(incidentId, tagId, userId, reason);

            // Emitir evento
            this.emitEvent('manual_tag_added', {
                incidentId,
                tagId,
                userId,
                reason
            });

            return result;

        } catch (error) {
            this.logAudit('manual_tag_failed', incidentId, {
                tagId,
                userId,
                error: error.message
            });

            throw error;
        }
    }

    /**
     * Remove tag de um incidente
     */
    async removeTag(incidentId, tagId, userId, reason = '') {
        try {
            this.logAudit('tag_removed', incidentId, {
                tagId,
                userId,
                reason
            });

            const result = await this.taggingService.removeTag(incidentId, tagId, userId, reason);

            // Emitir evento
            this.emitEvent('tag_removed', {
                incidentId,
                tagId,
                userId,
                reason
            });

            return result;

        } catch (error) {
            this.logAudit('tag_removal_failed', incidentId, {
                tagId,
                userId,
                error: error.message
            });

            throw error;
        }
    }

    /**
     * Força reclassificação de um incidente
     */
    async reclassifyIncident(incidentId, userId, reason = '') {
        try {
            const incidentData = this.processedIncidents.get(incidentId);
            if (!incidentData) {
                throw new Error('Incident not found in processed cache');
            }

            this.logAudit('reclassification_started', incidentId, {
                userId,
                reason
            });

            // Limpar cache para forçar nova classificação
            this.classifier.clearCache();

            // Processar novamente
            const result = await this.processIncident(incidentData.incident, {
                forceReclassification: true
            });

            this.logAudit('reclassification_completed', incidentId, {
                userId,
                oldCategory: incidentData.results.classification?.primaryCategory?.category,
                newCategory: result.results.classification?.primaryCategory?.category
            });

            return result;

        } catch (error) {
            this.logAudit('reclassification_failed', incidentId, {
                userId,
                error: error.message
            });

            throw error;
        }
    }

    /**
     * Força reroteamento de um incidente
     */
    async rerouteIncident(incidentId, targetTeamId, userId, reason = '') {
        try {
            const incidentData = this.processedIncidents.get(incidentId);
            if (!incidentData) {
                throw new Error('Incident not found in processed cache');
            }

            this.logAudit('rerouting_started', incidentId, {
                targetTeamId,
                userId,
                reason
            });

            // Forçar roteamento para equipe específica
            const routingResult = await this.routingEngine.forceRoute(incidentId, targetTeamId, userId, reason);

            this.logAudit('rerouting_completed', incidentId, {
                oldTeam: incidentData.results.routing?.team?.id,
                newTeam: targetTeamId,
                userId
            });

            // Emitir evento
            this.emitEvent('incident_rerouted', {
                incidentId,
                targetTeamId,
                userId,
                reason
            });

            return routingResult;

        } catch (error) {
            this.logAudit('rerouting_failed', incidentId, {
                targetTeamId,
                userId,
                error: error.message
            });

            throw error;
        }
    }

    /**
     * Fornece feedback para melhoria do classificador
     */
    async provideFeedback(incidentId, correctCategory, confidence, userId, comments = '') {
        try {
            this.logAudit('feedback_provided', incidentId, {
                correctCategory,
                confidence,
                userId,
                comments
            });

            // Treinar classificador com feedback
            await this.classifier.trainWithFeedback(incidentId, correctCategory, confidence);

            // Emitir evento
            this.emitEvent('feedback_provided', {
                incidentId,
                correctCategory,
                confidence,
                userId,
                comments
            });

            return true;

        } catch (error) {
            this.logAudit('feedback_failed', incidentId, {
                userId,
                error: error.message
            });

            throw error;
        }
    }

    /**
     * Configura webhook para integração externa
     */
    registerWebhook(event, url, options = {}) {
        if (!this.webhooks.has(event)) {
            this.webhooks.set(event, []);
        }

        const webhook = {
            url,
            method: options.method || 'POST',
            headers: options.headers || {},
            retry: options.retry || 3,
            timeout: options.timeout || 5000,
            enabled: options.enabled !== false
        };

        this.webhooks.get(event).push(webhook);

        this.logAudit('webhook_registered', null, {
            event,
            url,
            options
        });

        return webhook;
    }

    /**
     * Remove webhook
     */
    unregisterWebhook(event, url) {
        if (this.webhooks.has(event)) {
            const webhooks = this.webhooks.get(event);
            const index = webhooks.findIndex(w => w.url === url);

            if (index > -1) {
                webhooks.splice(index, 1);

                this.logAudit('webhook_unregistered', null, {
                    event,
                    url
                });

                return true;
            }
        }

        return false;
    }

    /**
     * Adiciona listener de evento
     */
    addEventListener(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }

        this.eventListeners.get(event).push(callback);
        return true;
    }

    /**
     * Remove listener de evento
     */
    removeEventListener(event, callback) {
        if (this.eventListeners.has(event)) {
            const listeners = this.eventListeners.get(event);
            const index = listeners.indexOf(callback);

            if (index > -1) {
                listeners.splice(index, 1);
                return true;
            }
        }

        return false;
    }

    /**
     * Obtém estatísticas consolidadas
     */
    getStatistics() {
        return {
            global: this.metrics,
            classification: this.classifier.getMetrics(),
            routing: this.routingEngine.getRoutingMetrics(),
            tagging: this.taggingService.getTagStatistics(),
            taxonomy: this.taxonomyManager.getStatistics(),
            audit: {
                totalLogs: this.auditLog.length,
                processedIncidents: this.processedIncidents.size
            }
        };
    }

    /**
     * Obtém histórico de processamento de um incidente
     */
    getIncidentHistory(incidentId) {
        const processedData = this.processedIncidents.get(incidentId);
        const auditLogs = this.auditLog.filter(log => log.incidentId === incidentId);

        return {
            processedData,
            auditLogs,
            timeline: auditLogs.map(log => ({
                timestamp: log.timestamp,
                action: log.action,
                details: log.details
            }))
        };
    }

    /**
     * Exporta configuração completa
     */
    exportConfiguration() {
        return {
            taxonomies: this.taxonomyManager.exportTaxonomies(),
            tags: this.taggingService.exportTags(),
            webhooks: Object.fromEntries(this.webhooks),
            config: this.config,
            metadata: {
                exportDate: new Date().toISOString(),
                version: '1.0.0'
            }
        };
    }

    /**
     * Importa configuração
     */
    importConfiguration(configData) {
        try {
            if (configData.taxonomies) {
                this.taxonomyManager.importTaxonomies(configData.taxonomies);
            }

            if (configData.tags) {
                this.taggingService.importTags(configData.tags);
            }

            if (configData.webhooks) {
                this.webhooks.clear();
                for (const [event, webhooks] of Object.entries(configData.webhooks)) {
                    this.webhooks.set(event, webhooks);
                }
            }

            if (configData.config) {
                this.config = { ...this.config, ...configData.config };
            }

            this.logAudit('configuration_imported', null, {
                source: 'import',
                timestamp: configData.metadata?.exportDate
            });

            return true;

        } catch (error) {
            this.logAudit('configuration_import_failed', null, {
                error: error.message
            });

            throw error;
        }
    }

    /**
     * Configurações internas
     */
    setupEventListeners() {
        // Configurar listeners internos para coordenação entre componentes
    }

    setupDefaultWebhooks() {
        // Configurar webhooks padrão para integrações comuns
        if (this.config.serviceNowWebhook) {
            this.registerWebhook('incident_processed', this.config.serviceNowWebhook);
        }

        if (this.config.slackWebhook) {
            this.registerWebhook('incident_processed', this.config.slackWebhook);
        }
    }

    setupInterceptors() {
        // Configurar interceptadores para pré/pós processamento
    }

    emitEvent(event, data) {
        if (this.eventListeners.has(event)) {
            const listeners = this.eventListeners.get(event);
            listeners.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in event listener for ${event}:`, error);
                }
            });
        }
    }

    async executeWebhooks(event, data) {
        if (!this.webhooks.has(event)) return;

        const webhooks = this.webhooks.get(event).filter(w => w.enabled);
        const promises = webhooks.map(webhook => this.callWebhook(webhook, data));

        try {
            await Promise.allSettled(promises);
        } catch (error) {
            console.error(`Error executing webhooks for ${event}:`, error);
        }
    }

    async callWebhook(webhook, data) {
        // Implementar chamada HTTP para webhook
        try {
            const response = await fetch(webhook.url, {
                method: webhook.method,
                headers: {
                    'Content-Type': 'application/json',
                    ...webhook.headers
                },
                body: JSON.stringify(data),
                timeout: webhook.timeout
            });

            if (!response.ok) {
                throw new Error(`Webhook failed with status ${response.status}`);
            }

            return response;

        } catch (error) {
            console.error(`Webhook call failed for ${webhook.url}:`, error);
            throw error;
        }
    }

    validateIncidentData(incidentData) {
        if (!incidentData.id) {
            throw new Error('Incident ID is required');
        }

        if (!incidentData.title && !incidentData.description) {
            throw new Error('Either title or description is required');
        }
    }

    handleProcessingError(incidentData, error, sessionId, processingTime) {
        this.metrics.errors++;

        return {
            incident: {
                id: incidentData.id,
                title: incidentData.title
            },
            sessionId,
            processingTime,
            timestamp: new Date().toISOString(),
            success: false,
            error: {
                message: error.message,
                type: error.constructor.name
            },
            results: {
                classification: null,
                tagging: null,
                routing: null
            }
        };
    }

    updateGlobalMetrics(result) {
        this.metrics.totalProcessed++;

        if (result.results.classification) {
            this.metrics.successfulClassifications++;
        }

        if (result.results.routing) {
            this.metrics.successfulRoutings++;
        }

        // Atualizar média de tempo de processamento
        const totalTime = this.metrics.averageProcessingTime * (this.metrics.totalProcessed - 1) + result.processingTime;
        this.metrics.averageProcessingTime = totalTime / this.metrics.totalProcessed;
    }

    logAudit(action, incidentId, details = {}) {
        if (!this.config.enableAuditLog) return;

        const logEntry = {
            timestamp: new Date().toISOString(),
            action,
            incidentId,
            details
        };

        this.auditLog.push(logEntry);

        // Manter apenas últimos 10000 logs
        if (this.auditLog.length > 10000) {
            this.auditLog.shift();
        }
    }

    generateSessionId() {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Obtém saúde do sistema
     */
    getHealthStatus() {
        const classifierMetrics = this.classifier.getMetrics();
        const routingMetrics = this.routingEngine.getRoutingMetrics();

        return {
            status: 'healthy', // healthy, degraded, unhealthy
            components: {
                taxonomyManager: { status: 'healthy' },
                classifier: {
                    status: classifierMetrics.successRate > 0.8 ? 'healthy' : 'degraded',
                    successRate: classifierMetrics.successRate
                },
                taggingService: { status: 'healthy' },
                routingEngine: {
                    status: routingMetrics.successRate > 0.9 ? 'healthy' : 'degraded',
                    successRate: routingMetrics.successRate
                }
            },
            metrics: this.metrics,
            uptime: process.uptime(),
            timestamp: new Date().toISOString()
        };
    }
}

module.exports = CategorizationIntegration;