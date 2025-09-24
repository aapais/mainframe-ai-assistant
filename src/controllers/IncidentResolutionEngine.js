const EventEmitter = require('events');
const { Logger } = require('../utils/Logger');
const { DataMaskingService } = require('../services/DataMaskingService');
const { IncidentCategorizationService } = require('../services/IncidentCategorizationService');
const { BankingIncidentAnalyzer } = require('../services/BankingIncidentAnalyzer');
const { AuditService } = require('../services/AuditService');
const { ContinuousLearningService } = require('../services/ContinuousLearningService');
const { KnowledgeBaseService } = require('../services/KnowledgeBaseService');
const { NotificationService } = require('../services/notification/NotificationService');

/**
 * Orquestrador principal do sistema de resolução de incidentes
 * Coordena todos os serviços e gerencia o pipeline completo
 */
class IncidentResolutionEngine extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = {
            timeout: 30000,
            retryAttempts: 3,
            enableMetrics: true,
            enableHealthChecks: true,
            ...config
        };

        this.logger = new Logger('IncidentResolutionEngine');
        this.services = {};
        this.metrics = {
            totalIncidents: 0,
            resolvedIncidents: 0,
            averageResolutionTime: 0,
            errorRate: 0,
            lastHealthCheck: null
        };

        this.isInitialized = false;
        this.healthCheckInterval = null;
    }

    /**
     * Inicializa todos os serviços
     */
    async initialize() {
        try {
            this.logger.info('Inicializando IncidentResolutionEngine...');

            // Inicializar serviços
            this.services.dataMasking = new DataMaskingService();
            this.services.categorization = new IncidentCategorizationService();
            this.services.analyzer = new BankingIncidentAnalyzer();
            this.services.audit = new AuditService();
            this.services.learning = new ContinuousLearningService();
            this.services.knowledgeBase = new KnowledgeBaseService();
            this.services.notification = new NotificationService();

            // Inicializar cada serviço
            await Promise.all([
                this.services.dataMasking.initialize(),
                this.services.categorization.initialize(),
                this.services.analyzer.initialize(),
                this.services.audit.initialize(),
                this.services.learning.initialize(),
                this.services.knowledgeBase.initialize(),
                this.services.notification.initialize()
            ]);

            // Configurar event handlers
            this.setupEventHandlers();

            // Iniciar health checks se habilitado
            if (this.config.enableHealthChecks) {
                this.startHealthChecks();
            }

            this.isInitialized = true;
            this.logger.info('IncidentResolutionEngine inicializado com sucesso');
            this.emit('initialized');

        } catch (error) {
            this.logger.error('Erro ao inicializar IncidentResolutionEngine:', error);
            throw error;
        }
    }

    /**
     * Pipeline principal de processamento de incidentes
     */
    async processIncident(incidentData) {
        const startTime = Date.now();
        const incidentId = incidentData.id || this.generateIncidentId();

        try {
            this.logger.info(`Processando incidente ${incidentId}`);
            this.emit('incident:started', { incidentId, data: incidentData });

            // Validar dados de entrada
            this.validateIncidentData(incidentData);

            // Etapa 1: Mascaramento de dados sensíveis
            const maskedData = await this.maskSensitiveData(incidentData);
            this.emit('incident:masked', { incidentId, maskedData });

            // Etapa 2: Categorização automática
            const category = await this.categorizeIncident(maskedData);
            this.emit('incident:categorized', { incidentId, category });

            // Etapa 3: Análise com LLM
            const analysis = await this.analyzeWithLLM(maskedData, category);
            this.emit('incident:analyzed', { incidentId, analysis });

            // Etapa 4: Gerar sugestões de resolução
            const suggestions = await this.generateSuggestions(maskedData, category, analysis);
            this.emit('incident:suggestions', { incidentId, suggestions });

            // Etapa 5: Buscar conhecimento na base
            const relatedKnowledge = await this.searchKnowledgeBase(maskedData, category);
            this.emit('incident:knowledge', { incidentId, relatedKnowledge });

            // Etapa 6: Auditoria
            await this.auditIncident(incidentId, {
                originalData: incidentData,
                maskedData,
                category,
                analysis,
                suggestions,
                relatedKnowledge
            });

            // Compilar resultado final
            const result = {
                incidentId,
                category,
                analysis,
                suggestions,
                relatedKnowledge,
                processingTime: Date.now() - startTime,
                timestamp: new Date().toISOString(),
                status: 'processed'
            };

            // Atualizar métricas
            this.updateMetrics(result);

            // Notificar resultado
            await this.notifyStakeholders(result);

            this.logger.info(`Incidente ${incidentId} processado com sucesso em ${result.processingTime}ms`);
            this.emit('incident:completed', result);

            return result;

        } catch (error) {
            this.logger.error(`Erro ao processar incidente ${incidentId}:`, error);

            const errorResult = {
                incidentId,
                error: error.message,
                processingTime: Date.now() - startTime,
                timestamp: new Date().toISOString(),
                status: 'error'
            };

            this.emit('incident:error', errorResult);

            // Auditoria de erro
            await this.auditError(incidentId, error, incidentData);

            throw error;
        }
    }

    /**
     * Mascaramento de dados sensíveis
     */
    async maskSensitiveData(incidentData) {
        try {
            return await this.services.dataMasking.maskBankingData(incidentData);
        } catch (error) {
            this.logger.error('Erro no mascaramento de dados:', error);
            throw new Error(`Falha no mascaramento: ${error.message}`);
        }
    }

    /**
     * Categorização do incidente
     */
    async categorizeIncident(maskedData) {
        try {
            return await this.services.categorization.categorizeIncident(maskedData);
        } catch (error) {
            this.logger.error('Erro na categorização:', error);
            throw new Error(`Falha na categorização: ${error.message}`);
        }
    }

    /**
     * Análise com LLM
     */
    async analyzeWithLLM(maskedData, category) {
        try {
            return await this.services.analyzer.analyzeIncident(maskedData, category);
        } catch (error) {
            this.logger.error('Erro na análise LLM:', error);
            throw new Error(`Falha na análise: ${error.message}`);
        }
    }

    /**
     * Geração de sugestões
     */
    async generateSuggestions(maskedData, category, analysis) {
        try {
            return await this.services.analyzer.generateSuggestions(maskedData, category, analysis);
        } catch (error) {
            this.logger.error('Erro na geração de sugestões:', error);
            throw new Error(`Falha na geração de sugestões: ${error.message}`);
        }
    }

    /**
     * Busca na base de conhecimento
     */
    async searchKnowledgeBase(maskedData, category) {
        try {
            return await this.services.knowledgeBase.searchSimilar(maskedData.description, category);
        } catch (error) {
            this.logger.error('Erro na busca de conhecimento:', error);
            return []; // Não falha o pipeline
        }
    }

    /**
     * Auditoria do incidente
     */
    async auditIncident(incidentId, processData) {
        try {
            await this.services.audit.logIncidentProcessing(incidentId, processData);
        } catch (error) {
            this.logger.error('Erro na auditoria:', error);
            // Não falha o pipeline
        }
    }

    /**
     * Auditoria de erro
     */
    async auditError(incidentId, error, originalData) {
        try {
            await this.services.audit.logError(incidentId, error, originalData);
        } catch (auditError) {
            this.logger.error('Erro na auditoria de erro:', auditError);
        }
    }

    /**
     * Notificação de stakeholders
     */
    async notifyStakeholders(result) {
        try {
            await this.services.notification.notifyIncidentProcessed(result);
        } catch (error) {
            this.logger.error('Erro na notificação:', error);
            // Não falha o pipeline
        }
    }

    /**
     * Feedback de resolução para aprendizado contínuo
     */
    async submitResolutionFeedback(incidentId, feedbackData) {
        try {
            this.logger.info(`Processando feedback para incidente ${incidentId}`);

            // Registrar feedback
            await this.services.learning.processFeedback(incidentId, feedbackData);

            // Atualizar base de conhecimento se aplicável
            if (feedbackData.resolution && feedbackData.effectiveness > 0.7) {
                await this.services.knowledgeBase.addSolution({
                    incidentId,
                    resolution: feedbackData.resolution,
                    effectiveness: feedbackData.effectiveness,
                    timestamp: new Date().toISOString()
                });
            }

            this.emit('feedback:processed', { incidentId, feedbackData });
            return { success: true, message: 'Feedback processado com sucesso' };

        } catch (error) {
            this.logger.error('Erro ao processar feedback:', error);
            throw error;
        }
    }

    /**
     * Health check de todos os serviços
     */
    async performHealthCheck() {
        const healthStatus = {
            timestamp: new Date().toISOString(),
            overall: 'healthy',
            services: {}
        };

        try {
            // Verificar cada serviço
            for (const [name, service] of Object.entries(this.services)) {
                try {
                    if (service.healthCheck) {
                        healthStatus.services[name] = await service.healthCheck();
                    } else {
                        healthStatus.services[name] = { status: 'unknown', message: 'Health check não implementado' };
                    }
                } catch (error) {
                    healthStatus.services[name] = {
                        status: 'unhealthy',
                        error: error.message
                    };
                    healthStatus.overall = 'degraded';
                }
            }

            // Verificar métricas gerais
            healthStatus.metrics = { ...this.metrics };
            healthStatus.uptime = process.uptime();

            this.metrics.lastHealthCheck = healthStatus;
            this.emit('health:checked', healthStatus);

            return healthStatus;

        } catch (error) {
            this.logger.error('Erro no health check:', error);
            return {
                timestamp: new Date().toISOString(),
                overall: 'unhealthy',
                error: error.message
            };
        }
    }

    /**
     * Configurar manipuladores de eventos
     */
    setupEventHandlers() {
        // Log de eventos importantes
        this.on('incident:started', (data) => {
            this.logger.info(`Incidente iniciado: ${data.incidentId}`);
        });

        this.on('incident:completed', (result) => {
            this.logger.info(`Incidente concluído: ${result.incidentId} em ${result.processingTime}ms`);
        });

        this.on('incident:error', (error) => {
            this.logger.error(`Erro no incidente: ${error.incidentId} - ${error.error}`);
            this.metrics.errorRate = (this.metrics.errorRate + 1) / this.metrics.totalIncidents;
        });

        // Aprendizado contínuo baseado em eventos
        this.on('incident:completed', async (result) => {
            try {
                await this.services.learning.trackSuccess(result);
            } catch (error) {
                this.logger.error('Erro no tracking de sucesso:', error);
            }
        });
    }

    /**
     * Iniciar health checks periódicos
     */
    startHealthChecks() {
        const interval = this.config.healthCheckInterval || 60000; // 1 minuto

        this.healthCheckInterval = setInterval(async () => {
            try {
                await this.performHealthCheck();
            } catch (error) {
                this.logger.error('Erro no health check periódico:', error);
            }
        }, interval);

        this.logger.info(`Health checks iniciados com intervalo de ${interval}ms`);
    }

    /**
     * Parar health checks
     */
    stopHealthChecks() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
            this.logger.info('Health checks interrompidos');
        }
    }

    /**
     * Validar dados do incidente
     */
    validateIncidentData(data) {
        if (!data || typeof data !== 'object') {
            throw new Error('Dados do incidente inválidos');
        }

        if (!data.description || typeof data.description !== 'string') {
            throw new Error('Descrição do incidente é obrigatória');
        }

        if (!data.priority || !['baixa', 'media', 'alta', 'critica'].includes(data.priority)) {
            throw new Error('Prioridade do incidente inválida');
        }
    }

    /**
     * Gerar ID único para incidente
     */
    generateIncidentId() {
        return `INC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Atualizar métricas
     */
    updateMetrics(result) {
        this.metrics.totalIncidents++;

        if (result.status === 'processed') {
            this.metrics.resolvedIncidents++;

            // Atualizar tempo médio de resolução
            const currentAvg = this.metrics.averageResolutionTime;
            const newAvg = (currentAvg * (this.metrics.resolvedIncidents - 1) + result.processingTime) / this.metrics.resolvedIncidents;
            this.metrics.averageResolutionTime = Math.round(newAvg);
        }
    }

    /**
     * Obter métricas atuais
     */
    getMetrics() {
        return {
            ...this.metrics,
            successRate: this.metrics.totalIncidents > 0 ?
                (this.metrics.resolvedIncidents / this.metrics.totalIncidents) * 100 : 0
        };
    }

    /**
     * Shutdown graceful
     */
    async shutdown() {
        try {
            this.logger.info('Iniciando shutdown do IncidentResolutionEngine...');

            this.stopHealthChecks();

            // Finalizar serviços
            for (const [name, service] of Object.entries(this.services)) {
                if (service.shutdown) {
                    await service.shutdown();
                }
            }

            this.emit('shutdown');
            this.logger.info('IncidentResolutionEngine finalizado');

        } catch (error) {
            this.logger.error('Erro no shutdown:', error);
            throw error;
        }
    }
}

module.exports = { IncidentResolutionEngine };